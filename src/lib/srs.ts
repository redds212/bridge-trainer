import type { SRSEntry, SRSStatus } from '../types';
import { addDaysKey, toDateKey, isOnOrBefore, todayKey } from './date';

// Interval (in days) after the Nth consecutive correct answer.
// 1st → 3, 2nd → 9, 3rd → 27, 4th → 90 (mastered).
export const SUCCESS_INTERVALS = [3, 9, 27, 90] as const;
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
  consecutiveCorrect = Math.max(0, Math.min(MASTERED_STEP, consecutiveCorrect)) as SRSEntry['consecutiveCorrect'];

  const interval =
    typeof e.interval === 'number'
      ? e.interval
      : status === 'LEARNING'
        ? 1
        : consecutiveCorrect > 0
          ? SUCCESS_INTERVALS[consecutiveCorrect - 1]
          : 0;

  return {
    status,
    consecutiveCorrect: consecutiveCorrect as SRSEntry['consecutiveCorrect'],
    interval,
    nextReviewDate: toDateKey(typeof e.nextReviewDate === 'string' ? e.nextReviewDate : null),
    lastSeen: typeof e.lastSeen === 'string' ? e.lastSeen : null,
    flagDifficult: e.flagDifficult === true ? true : undefined,
  };
}

/**
 * Apply a first-try answer in the MAIN session (Section 4 of the spec for
 * success; Section 3 step-2 for an immediate miss).
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
  const step = Math.min(MASTERED_STEP, entry.consecutiveCorrect + 1) as SRSEntry['consecutiveCorrect'];
  const interval = SUCCESS_INTERVALS[step - 1];
  const mastered = step === MASTERED_STEP;
  return {
    status: mastered ? 'MASTERED' : 'REVIEW',
    consecutiveCorrect: step,
    interval,
    nextReviewDate: mastered ? null : addDaysKey(interval, now),
    lastSeen: now.toISOString(),
    flagDifficult: entry.flagDifficult,
  };
}

/**
 * Finalize a deal that went through the session buffer (Section 3, step 4):
 * regardless of the retry result it returns tomorrow with the counter reset.
 * `retrySucceeded === false` flags it as difficult.
 */
export function finalizeBuffer(prev: SRSEntry, retrySucceeded: boolean, now: Date = new Date()): SRSEntry {
  return {
    status: 'LEARNING',
    consecutiveCorrect: 0,
    interval: 1,
    nextReviewDate: addDaysKey(1, now),
    lastSeen: now.toISOString(),
    flagDifficult: retrySucceeded ? undefined : true,
  };
}

export function isReviewDue(entry: SRSEntry, now: Date = new Date()): boolean {
  const e = normalizeEntry(entry);
  if (e.status === 'MASTERED') return false;
  if (e.status === 'NEW') return e.nextReviewDate === null;
  return isOnOrBefore(e.nextReviewDate, todayKey(now));
}

/** A deal missed yesterday (or earlier) that is due now — Section 2, step 1. */
export function isRetryDue(entry: SRSEntry, now: Date = new Date()): boolean {
  const e = normalizeEntry(entry);
  return e.status === 'LEARNING' && e.interval === 1 && isOnOrBefore(e.nextReviewDate, todayKey(now));
}
