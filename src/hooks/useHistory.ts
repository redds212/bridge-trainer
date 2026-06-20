import { useState, useEffect, useCallback } from 'react';
import type { Attempt, AttemptPhase } from '../types';
import type { AttemptRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { todayKey } from '../lib/date';

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

function rowToAttempt(r: AttemptRow): Attempt {
  return { dealId: r.deal_id, correct: r.correct, phase: r.phase, ts: r.ts };
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

/**
 * Attempt history backed by the `attempts` table. Hydrated on login; new
 * attempts append in memory and insert through to the database.
 */
export function useHistory(userId: string | null) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setAttempts([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    supabase.from('attempts').select('*').eq('user_id', userId).order('ts', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('History load failed:', error.message);
        else if (data) setAttempts(data.map(rowToAttempt));
        setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  const record = useCallback((dealId: string, correct: boolean, phase: AttemptPhase) => {
    setAttempts(prev => [...prev, { dealId, correct, phase, ts: new Date().toISOString() }]);
    if (userId) {
      supabase.from('attempts').insert({ user_id: userId, deal_id: dealId, correct, phase })
        .then(({ error }) => { if (error) console.error('History save failed:', error.message); });
    }
  }, [userId]);

  const clear = useCallback(() => {
    setAttempts([]);
    if (userId) {
      supabase.from('attempts').delete().eq('user_id', userId)
        .then(({ error }) => { if (error) console.error('History clear failed:', error.message); });
    }
  }, [userId]);

  return { attempts, record, clear, stats: computeStats(attempts), loading };
}
