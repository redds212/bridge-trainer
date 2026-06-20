// Local-timezone calendar-day helpers.
// All SRS scheduling compares whole days in the user's local timezone,
// so we key dates as "YYYY-MM-DD" derived from local time (not UTC).

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysKey(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

/** Normalize any stored date (full ISO or YYYY-MM-DD) to a local-day key. */
export function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  // Already a date key
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Full ISO timestamp → convert to local day
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return todayKey(d);
}

export function dateKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from aKey to bKey (bKey - aKey). Negative if bKey is earlier. */
export function daysBetween(aKey: string, bKey: string): number {
  const a = dateKeyToDate(aKey).getTime();
  const b = dateKeyToDate(bKey).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** True when reviewKey falls on or before today (i.e. the review is due). */
export function isOnOrBefore(reviewKey: string | null, today: string = todayKey()): boolean {
  if (!reviewKey) return false;
  return daysBetween(reviewKey, today) >= 0;
}

const WEEKDAYS_PL = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
const MONTHS_PL = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

/** Human label like "dziś", "jutro", or "śr. 24 czerwca". */
export function formatDayKey(key: string, now: Date = new Date()): string {
  const diff = daysBetween(todayKey(now), key);
  if (diff === 0) return 'dziś';
  if (diff === 1) return 'jutro';
  if (diff === -1) return 'wczoraj';
  const d = dateKeyToDate(key);
  return `${WEEKDAYS_PL[d.getDay()]} ${d.getDate()} ${MONTHS_PL[d.getMonth()]}`;
}
