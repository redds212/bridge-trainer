import type { Deal, SRSStore, UserSettings, LearningMode } from '../types';
import { normalizeEntry, isRetryDue } from './srs';
import { todayKey, toDateKey, isOnOrBefore } from './date';

export type SessionKind = 'retry' | 'review' | 'new';

export interface SessionSlot {
  dealId: string;
  kind: SessionKind;
}

export interface DailySession {
  date: string; // todayKey
  slots: SessionSlot[];
  retryCount: number;
  reviewCount: number;
  newCount: number;
  /** Due reviews that didn't fit today's limit and roll to a later day. */
  deferredReviewIds: string[];
}

// New / Review split for the steady state (Section 1).
export const MODE_PROPORTIONS: Record<LearningMode, { newPct: number; reviewPct: number }> = {
  maintenance: { newPct: 0.2, reviewPct: 0.8 },
  balanced: { newPct: 0.4, reviewPct: 0.6 },
  intensive: { newPct: 0.7, reviewPct: 0.3 },
};

export const MODE_LABELS: Record<LearningMode, string> = {
  maintenance: 'Utrwalenie',
  balanced: 'Zrównoważony',
  intensive: 'Intensywny',
};

export interface SessionSplit {
  reviewLimit: number;
  newLimit: number;
}

/**
 * Losowanie nowych rozdań musi być POWTARZALNE w obrębie dnia, a nie świeże przy
 * każdym wywołaniu. `generateDailySession` woła nie tylko `start()`, ale też panel
 * użytkownika przy każdym renderze („Dzisiejsza sesja" i plan powtórek) — przy
 * `Math.random()` podgląd pokazywałby inny zestaw niż ten, który potem dostaniesz,
 * a licznik skakałby przy każdym przeliczeniu. Ziarno z daty daje jedno tasowanie
 * na dobę: dziś stałe, jutro inne.
 */
function hashSeed(text: string): number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32 — kilka linijek, dobry rozrzut, w zupełności wystarcza do tasowania. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates na kopii — wejście zostaje nietknięte. */
function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function modeSplit(settings: UserSettings): SessionSplit {
  const prop = MODE_PROPORTIONS[settings.mode];
  const reviewLimit = Math.round(settings.dailyTarget * prop.reviewPct);
  return { reviewLimit, newLimit: settings.dailyTarget - reviewLimit };
}

/**
 * Build today's queue of exactly (up to) X slots following the spec hierarchy:
 *   Step 1 — yesterday's misses (retry) first; they eat into the review limit.
 *   Step 2 — standard due reviews up to the review limit; overflow is deferred.
 *            Unused review capacity is handed to new deals.
 *   Step 3 — new (never-attempted) deals fill the rest up to X.
 */
export function generateDailySession(
  deals: Deal[],
  store: SRSStore,
  settings: UserSettings,
  now: Date = new Date(),
): DailySession {
  const today = todayKey(now);
  const X = Math.max(0, Math.floor(settings.dailyTarget));
  const { reviewLimit } = modeSplit(settings);

  const entryOf = (id: string) => normalizeEntry(store[id]);

  // Partition the due pool into retries (step 1) and standard reviews (step 2).
  const retries: Deal[] = [];
  const reviews: Deal[] = [];
  for (const deal of deals) {
    const e = entryOf(deal.id);
    if (e.status === 'MASTERED' || e.status === 'NEW') continue;
    if (!isOnOrBefore(e.nextReviewDate, today)) continue;
    if (isRetryDue(e, now)) retries.push(deal);
    else reviews.push(deal);
  }

  // Most overdue reviews first.
  reviews.sort((a, b) => {
    const ka = toDateKey(entryOf(a.id).nextReviewDate) ?? today;
    const kb = toDateKey(entryOf(b.id).nextReviewDate) ?? today;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const slots: SessionSlot[] = [];

  // Step 1 — retries (mandatory, highest priority, capped only by X).
  for (const deal of retries) {
    if (slots.length >= X) break;
    slots.push({ dealId: deal.id, kind: 'retry' });
  }

  // Step 2 — standard reviews up to the review limit; the rest defer.
  let reviewUsed = slots.length; // retries already consumed review capacity
  const deferredReviewIds: string[] = [];
  for (const deal of reviews) {
    if (slots.length < X && reviewUsed < reviewLimit) {
      slots.push({ dealId: deal.id, kind: 'review' });
      reviewUsed++;
    } else {
      deferredReviewIds.push(deal.id);
    }
  }

  // Step 3 — new deals fill remaining slots up to X. Losujemy z CAŁEJ puli nowych,
  // zamiast brać pierwsze z brzegu: baza oddaje rozdania posortowane (`is_base`,
  // potem `created_at`), więc branie po kolei oznaczało w kółko te same, najstarsze
  // pozycje — zwłaszcza gdy sesja została przerwana i zaczynana od nowa.
  const used = new Set(slots.map(s => s.dealId));
  const newPool = deals.filter(d => !used.has(d.id) && entryOf(d.id).status === 'NEW');
  for (const deal of shuffled(newPool, seededRandom(hashSeed(today)))) {
    if (slots.length >= X) break;
    slots.push({ dealId: deal.id, kind: 'new' });
  }

  return {
    date: today,
    slots,
    retryCount: slots.filter(s => s.kind === 'retry').length,
    reviewCount: slots.filter(s => s.kind === 'review').length,
    newCount: slots.filter(s => s.kind === 'new').length,
    deferredReviewIds,
  };
}
