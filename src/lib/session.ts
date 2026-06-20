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

  // Step 3 — new deals fill remaining slots up to X.
  const used = new Set(slots.map(s => s.dealId));
  for (const deal of deals) {
    if (slots.length >= X) break;
    if (used.has(deal.id)) continue;
    if (entryOf(deal.id).status !== 'NEW') continue;
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
