import { useState, useEffect, useCallback, useRef } from 'react';
import type { Attempt, AttemptPhase } from '../types';
import type { AttemptRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { todayKey } from '../lib/date';
import { isOfflineFailure } from '../lib/network';
import { cacheGet, cachePut, cacheKeys } from '../lib/localCache';
import { flushOutbox, outboxAddAttempt, outboxDrop, outboxPending } from '../lib/outbox';

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

function rowToAttempt(r: Pick<AttemptRow, 'deal_id' | 'correct' | 'phase' | 'ts'>): Attempt {
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

const attemptKey = (a: Attempt) => `${a.ts}|${a.dealId}`;

/** Dokłada podejścia, których na liście jeszcze nie ma, i układa całość po czasie. */
function mergeAttempts(base: Attempt[], extra: Attempt[]): Attempt[] {
  if (!extra.length) return base;
  const seen = new Set(base.map(attemptKey));
  const added = extra.filter(a => !seen.has(attemptKey(a)));
  if (!added.length) return base;
  return [...base, ...added].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

/**
 * Attempt history backed by the `attempts` table. Hydrated on login; new
 * attempts append in memory and go out through the write queue (`lib/outbox`).
 *
 * `offline`: historia idzie z kopii lokalnej; nowe podejścia dopisują się dalej i
 * czekają w kolejce (etap 3 trybu offline). Zablokowane zostaje tylko „wyczyść".
 */
export function useHistory(userId: string | null, offline = false) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  // Konto, dla którego lista jest wiarygodna — patrz `useSRS`.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const hydratedRef = useRef<string | null>(null);
  // Podejścia dopisane w trakcie wczytywania — odpowiedź z bazy jeszcze ich nie zna.
  const addedRef = useRef<Attempt[]>([]);

  useEffect(() => {
    if (!userId) { setAttempts([]); setHydratedFor(null); hydratedRef.current = null; setLoading(false); return; }
    const resync = hydratedRef.current === userId; // ciche odświeżenie — patrz `useSRS`
    if (resync && offline) return;
    let active = true;
    if (!resync) { setLoading(true); setHydratedFor(null); }
    addedRef.current = [];

    const finish = async (list: Attempt[] | null) => {
      const pending = (await outboxPending(userId)).attempts.map(rowToAttempt);
      if (!active) return;
      if (list) {
        setAttempts(mergeAttempts(mergeAttempts(list, pending), addedRef.current));
        hydratedRef.current = userId;
        setHydratedFor(userId);
      }
      setLoading(false);
    };
    const fromCache = async () => finish(await cacheGet<Attempt[]>(cacheKeys.attempts(userId)));

    void (async () => {
      // Najpierw własne zapisy, potem świeży stan (O6).
      if (offline || await flushOutbox(userId) === 'offline') { await fromCache(); return; }
      const { data, error } = await supabase.from('attempts').select('*')
        .eq('user_id', userId).order('ts', { ascending: true });
      if (isOfflineFailure(error)) { await fromCache(); return; }
      if (error) console.error('History load failed:', error.message);
      await finish(error || !data ? null : data.map(rowToAttempt));
    })();
    return () => { active = false; };
  }, [userId, offline]);

  useEffect(() => {
    if (!userId || hydratedFor !== userId) return;
    void cachePut(cacheKeys.attempts(userId), attempts);
  }, [attempts, userId, hydratedFor]);

  const record = useCallback((dealId: string, correct: boolean, phase: AttemptPhase) => {
    // Czas i id nadaje urządzenie: `ts` to chwila odpowiedzi (nie dotarcia do bazy),
    // a `client_id` sprawia, że ponowiona wysyłka nie dopisze podejścia drugi raz.
    const attempt: Attempt = { dealId, correct, phase, ts: new Date().toISOString() };
    addedRef.current.push(attempt);
    setAttempts(prev => [...prev, attempt]);
    if (userId) {
      outboxAddAttempt(userId, {
        user_id: userId, deal_id: dealId, correct, phase, ts: attempt.ts, client_id: crypto.randomUUID(),
      });
    }
  }, [userId]);

  // Wymaga sieci (O5): lista znika dopiero, gdy baza potwierdzi skasowanie.
  const clear = useCallback(async () => {
    if (offline) return;
    if (userId) {
      const { error } = await supabase.from('attempts').delete().eq('user_id', userId);
      if (error) { console.error('History clear failed:', error.message); return; }
      outboxDrop(userId, 'attempts');
    }
    setAttempts([]);
  }, [userId, offline]);

  return { attempts, record, clear, stats: computeStats(attempts), loading };
}

