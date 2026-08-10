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
  /** Cel dzienny obowiązujący tę kolejkę — po nim poznajemy zmianę ustawień. */
  target: number;
  /** Tryb nauki obowiązujący tę kolejkę. */
  mode: LearningMode;
}

/**
 * Cel dzienny dla konta, które go jeszcze nie ustawiło. Musi zgadzać się z
 * `default` kolumny `profiles.daily_target` (migracja 0011) — inaczej świeże konto
 * widziałoby inną kolejkę przed pierwszym zapisem ustawień niż po nim.
 * Mieszka tutaj, a nie przy `DAILY_TARGET_MIN/MAX` w `useSettings`, bo czyta go też
 * `AuthContext`, a `useSettings` sam importuje z `AuthContext` (byłby cykl).
 */
export const DEFAULT_DAILY_TARGET = 20;

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

interface DuePools {
  /** Wczorajsze pudła — najwyższy priorytet. */
  retries: string[];
  /** Zaplanowane powtórki, najbardziej zaległe pierwsze. */
  reviews: string[];
  /** Nigdy nierozwiązane, potasowane ziarnem z daty. */
  fresh: string[];
}

/** Pule wg stanu SRS na `today`. Wołane też przy dopychaniu kolejki po zmianie celu. */
function buildPools(deals: Deal[], store: SRSStore, today: string, now: Date): DuePools {
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

  // Losujemy z CAŁEJ puli nowych, zamiast brać pierwsze z brzegu: baza oddaje
  // rozdania posortowane (`is_base`, potem `created_at`), więc branie po kolei
  // oznaczało w kółko te same, najstarsze pozycje — zwłaszcza gdy sesja została
  // przerwana i zaczynana od nowa.
  const fresh = shuffled(
    deals.filter(d => entryOf(d.id).status === 'NEW'),
    seededRandom(hashSeed(today)),
  );

  return {
    retries: retries.map(d => d.id),
    reviews: reviews.map(d => d.id),
    fresh: fresh.map(d => d.id),
  };
}

/**
 * Dopycha kolejkę do X wg hierarchii ze specyfikacji:
 *   Krok 1 — wczorajsze pudła (retry); zjadają limit powtórek, ogranicza je tylko X.
 *   Krok 2 — zaplanowane powtórki do limitu z `modeSplit`; nadmiar się odkłada.
 *            Niewykorzystany limit powtórek przechodzi na nowe.
 *   Krok 3 — nowe (nigdy nierozwiązane) wypełniają resztę do X.
 *
 * Sloty już obecne w `slots` zostają nietknięte i wykluczają swoje rozdania.
 * Bez tego wykluczenia dopychanie po zmianie celu (D4) podałoby z powrotem te
 * same, wciąż zaległe powtórki, które przecież czekają w kolejce.
 */
function fillToTarget(slots: SessionSlot[], pools: DuePools, settings: UserSettings): SessionSlot[] {
  const X = Math.max(0, Math.floor(settings.dailyTarget));
  const { reviewLimit } = modeSplit(settings);

  const out = [...slots];
  const queued = new Set(out.map(s => s.dealId));
  let reviewUsed = out.filter(s => s.kind !== 'new').length;

  const push = (dealId: string, kind: SessionKind) => {
    out.push({ dealId, kind });
    queued.add(dealId);
    if (kind !== 'new') reviewUsed++;
  };

  for (const id of pools.retries) {
    if (out.length >= X) break;
    if (!queued.has(id)) push(id, 'retry');
  }
  for (const id of pools.reviews) {
    if (out.length >= X || reviewUsed >= reviewLimit) break;
    if (!queued.has(id)) push(id, 'review');
  }
  for (const id of pools.fresh) {
    if (out.length >= X) break;
    if (!queued.has(id)) push(id, 'new');
  }

  return out;
}

/**
 * Składa `DailySession` z gotowej listy slotów. Liczniki są zawsze przeliczane
 * ze slotów, żeby migawka wczytana z bazy nie mogła się z nimi rozjechać.
 */
export function sessionFromSlots(
  date: string,
  slots: SessionSlot[],
  deferredReviewIds: string[],
  target: number,
  mode: LearningMode,
): DailySession {
  return {
    date,
    slots,
    retryCount: slots.filter(s => s.kind === 'retry').length,
    reviewCount: slots.filter(s => s.kind === 'review').length,
    newCount: slots.filter(s => s.kind === 'new').length,
    deferredReviewIds,
    target,
    mode,
  };
}

/** Odłożone = zaległe powtórki, które nie weszły do kolejki. */
function finish(date: string, slots: SessionSlot[], pools: DuePools, settings: UserSettings): DailySession {
  const queued = new Set(slots.map(s => s.dealId));
  return sessionFromSlots(
    date,
    slots,
    pools.reviews.filter(id => !queued.has(id)),
    Math.max(0, Math.floor(settings.dailyTarget)),
    settings.mode,
  );
}

/** Build today's queue of exactly (up to) X slots. */
export function generateDailySession(
  deals: Deal[],
  store: SRSStore,
  settings: UserSettings,
  now: Date = new Date(),
): DailySession {
  const today = todayKey(now);
  const pools = buildPools(deals, store, today, now);
  return finish(today, fillToTarget([], pools, settings), pools, settings);
}

/**
 * Przelicza kolejkę po zmianie celu dziennego albo trybu (SESSION_RESUME_PLAN.md, D4).
 * Podniesienie celu dopisuje sloty na koniec — najpierw zaległe powtórki, potem
 * nowe. Obniżenie ucina ogon czekających, ale nigdy poniżej `keepMin`, czyli tego,
 * co już zrobione. Zwraca `prev` bez zmian, gdy ustawienia zgadzają się z migawką.
 */
export function adaptSession(
  prev: DailySession,
  keepMin: number,
  deals: Deal[],
  store: SRSStore,
  settings: UserSettings,
  now: Date = new Date(),
): DailySession {
  const target = Math.max(0, Math.floor(settings.dailyTarget));
  if (target === prev.target && settings.mode === prev.mode) return prev;

  const today = todayKey(now);
  const pools = buildPools(deals, store, today, now);
  const keep = Math.max(keepMin, Math.min(prev.slots.length, target));
  return finish(today, fillToTarget(prev.slots.slice(0, keep), pools, settings), pools, settings);
}
