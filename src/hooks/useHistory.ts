import { useState, useEffect, useCallback } from 'react';
import type { Attempt, AttemptPhase } from '../types';
import { todayKey } from '../lib/date';

const MAX_HISTORY = 500;

function key(userId: string | null): string {
  return `bridge-history-${userId ?? 'guest'}`;
}

function load(k: string): Attempt[] {
  try {
    const raw = localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface HistoryStats {
  totalAttempts: number;
  totalCorrect: number;
  activeDays: number;
  avgPerDay: number;
  streak: number;
  solvedToday: number;
  /** active day keys, newest first */
  perDay: { day: string; count: number; correct: number }[];
}

function computeStats(attempts: Attempt[], now: Date = new Date()): HistoryStats {
  const byDay = new Map<string, { count: number; correct: number }>();
  for (const a of attempts) {
    const day = todayKey(new Date(a.ts));
    const cur = byDay.get(day) ?? { count: 0, correct: 0 };
    cur.count++;
    if (a.correct) cur.correct++;
    byDay.set(day, cur);
  }

  const perDay = [...byDay.entries()]
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  const activeDays = perDay.length;
  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter(a => a.correct).length;
  const avgPerDay = activeDays ? totalAttempts / activeDays : 0;

  // Streak: consecutive active days ending today (or yesterday as grace).
  const active = new Set(perDay.map(p => p.day));
  let streak = 0;
  const cursor = new Date(now);
  if (!active.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (active.has(todayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const solvedToday = byDay.get(todayKey(now))?.count ?? 0;

  return { totalAttempts, totalCorrect, activeDays, avgPerDay, streak, solvedToday, perDay };
}

export function useHistory(userId: string | null) {
  const [attempts, setAttempts] = useState<Attempt[]>(() => load(key(userId)));

  useEffect(() => {
    setAttempts(load(key(userId)));
  }, [userId]);

  const record = useCallback((dealId: string, correct: boolean, phase: AttemptPhase) => {
    setAttempts(prev => {
      const next = [...prev, { dealId, correct, phase, ts: new Date().toISOString() }];
      const trimmed = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      localStorage.setItem(key(userId), JSON.stringify(trimmed));
      return trimmed;
    });
  }, [userId]);

  const clear = useCallback(() => {
    localStorage.removeItem(key(userId));
    setAttempts([]);
  }, [userId]);

  return { attempts, record, clear, stats: computeStats(attempts) };
}
