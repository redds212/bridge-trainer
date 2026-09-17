import type { SRSEntry, SRSStatus } from '../types';
import { addDaysKey, toDateKey, isOnOrBefore, todayKey } from './date';

// Interval (in days) after the Nth consecutive correct answer.
// 1st → 3, 2nd → 9, 3rd → 27, 4th → 81, 5th and every later one → 160.
// A deal never retires; a miss sends it back to the start (tomorrow).
export const SUCCESS_INTERVALS = [3, 9, 27, 81, 160] as const;
/** The counter stops here — past the last step the interval stays at the cap. */
export const MAX_STEP = SUCCESS_INTERVALS.length;
/** From this step (81+ days) a deal counts as mastered: a label for stats, not an exit. */
export const MASTERED_STEP = 4;

export function getDefaultEntry(): SRSEntry {
  return {
    status: 'NEW',
    consecutiveCorrect: 0,
    interval: 0,
    nextReviewDate: null,
    lastSeen: null,
  };
}

/**
 * Bring any stored entry (including the legacy {intervalStep} shape) into the
 * current SRSEntry shape without losing scheduling information.
 */
export function normalizeEntry(raw: unknown): SRSEntry {
  if (!raw || typeof raw !== 'object') return getDefaultEntry();
  const e = raw as Record<string, unknown>;

  // Legacy entries used `intervalStep` and different intervals.
  const legacyStep = typeof e.intervalStep === 'number' ? e.intervalStep : undefined;
  const status = (typeof e.status === 'string' ? e.status : 'NEW') as SRSStatus;

  let consecutiveCorrect =
    typeof e.consecutiveCorrect === 'number'
      ? e.consecutiveCorrect
      : status === 'MASTERED'
        ? MASTERED_STEP
        : status === 'LEARNING'
          ? 0
          : legacyStep ?? 0;
  consecutiveCorrect = Math.max(0, Math.min(MAX_STEP, consecutiveCorrect)) as SRSEntry['consecutiveCorrect'];

  let interval =
    typeof e.interval === 'number'
      ? e.interval
      : status === 'LEARNING'
        ? 1
        : consecutiveCorrect > 0
          ? SUCCESS_INTERVALS[consecutiveCorrect - 1]
          : 0;
  let nextReviewDate = toDateKey(typeof e.nextReviewDate === 'string' ? e.nextReviewDate : null);
  const lastSeen = typeof e.lastSeen === 'string' ? e.lastSeen : null;

  // Deals used to retire on mastery: step 4, no review date. Put such a deal back on
  // the schedule as if its last answer had just earned the 81-day step.
  if (status === 'MASTERED' && !nextReviewDate) {
    consecutiveCorrect = MASTERED_STEP;
    interval = SUCCESS_INTERVALS[MASTERED_STEP - 1];
    nextReviewDate = lastSeen ? addDaysKey(interval, new Date(lastSeen)) : todayKey();
  }

  return {
    status,
    consecutiveCorrect: consecutiveCorrect as SRSEntry['consecutiveCorrect'],
    interval,
    nextReviewDate,
    lastSeen,
    flagDifficult: e.flagDifficult === true ? true : undefined,
  };
}

/**
 * Apply an answer — in a session or in free play (Section 4 of the spec for
 * success). A miss is final right away: the deal returns tomorrow with the
 * counter reset, never later in the same session (SESSION_RESUME_PLAN.md, D13).
 */
export function applyAnswer(prev: SRSEntry, correct: boolean, now: Date = new Date()): SRSEntry {
  const entry = normalizeEntry(prev);
  if (!correct) {
    return {
      status: 'LEARNING',
      consecutiveCorrect: 0,
      interval: 1,
      nextReviewDate: addDaysKey(1, now),
      lastSeen: now.toISOString(),
      flagDifficult: entry.flagDifficult,
    };
  }
  const step = Math.min(MAX_STEP, entry.consecutiveCorrect + 1) as SRSEntry['consecutiveCorrect'];
  const interval = SUCCESS_INTERVALS[step - 1];
  return {
    status: step >= MASTERED_STEP ? 'MASTERED' : 'REVIEW',
    consecutiveCorrect: step,
    interval,
    nextReviewDate: addDaysKey(interval, now),
    lastSeen: now.toISOString(),
    flagDifficult: entry.flagDifficult,
  };
}

export function isReviewDue(entry: SRSEntry, now: Date = new Date()): boolean {
  const e = normalizeEntry(entry);
  if (e.status === 'NEW') return e.nextReviewDate === null;
  return isOnOrBefore(e.nextReviewDate, todayKey(now));
}

/** A deal missed yesterday (or earlier) that is due now — Section 2, step 1. */
export function isRetryDue(entry: SRSEntry, now: Date = new Date()): boolean {
  const e = normalizeEntry(entry);
  return e.status === 'LEARNING' && e.interval === 1 && isOnOrBefore(e.nextReviewDate, todayKey(now));
}

/**
 * Rozdanie ocenione dziś — w sesji, w partii albo w swobodnej grze. Tego samego dnia
 * już nie wraca: pudło czeka do jutra, trafienie na swój interwał (D13).
 */
export function isAnsweredToday(entry: SRSEntry, now: Date = new Date()): boolean {
  return toDateKey(normalizeEntry(entry).lastSeen) === todayKey(now);
}
