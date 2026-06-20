import { useState, useCallback, useEffect, useRef } from 'react';
import type { SRSStore, SRSEntry } from '../types';
import type { SrsProgressRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { getDefaultEntry, normalizeEntry, applyAnswer, finalizeBuffer, isReviewDue } from '../lib/srs';

// Re-export so existing imports (`from '../hooks/useSRS'`) keep working.
export { getDefaultEntry, isReviewDue };

function rowToEntry(r: SrsProgressRow): SRSEntry {
  return {
    status: r.status,
    consecutiveCorrect: Math.max(0, Math.min(4, r.consecutive_correct)) as SRSEntry['consecutiveCorrect'],
    interval: r.interval,
    nextReviewDate: r.next_review_date,
    lastSeen: r.last_seen,
    flagDifficult: r.flag_difficult || undefined,
  };
}

function entryToRow(userId: string, dealId: string, e: SRSEntry): SrsProgressRow {
  return {
    user_id: userId,
    deal_id: dealId,
    status: e.status,
    consecutive_correct: e.consecutiveCorrect,
    interval: e.interval,
    next_review_date: e.nextReviewDate,
    last_seen: e.lastSeen,
    flag_difficult: !!e.flagDifficult,
  };
}

/**
 * SRS store backed by the `srs_progress` table. The in-memory `store` is
 * hydrated on login and kept as the synchronous source of truth; mutations
 * update it optimistically and write through to the database.
 */
export function useSRS(userId: string | null) {
  const [store, setStore] = useState<SRSStore>({});
  const [loading, setLoading] = useState(true);
  const storeRef = useRef<SRSStore>({});
  storeRef.current = store;

  useEffect(() => {
    if (!userId) { setStore({}); setLoading(false); return; }
    let active = true;
    setLoading(true);
    supabase.from('srs_progress').select('*').eq('user_id', userId).then(({ data, error }) => {
      if (!active) return;
      const s: SRSStore = {};
      if (error) console.error('SRS load failed:', error.message);
      else if (data) for (const r of data) s[r.deal_id] = rowToEntry(r);
      setStore(s);
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const getEntry = useCallback(
    (id: string): SRSEntry => normalizeEntry(store[id] ?? getDefaultEntry()),
    [store],
  );

  const persist = useCallback((dealId: string, entry: SRSEntry) => {
    if (!userId) return;
    supabase.from('srs_progress')
      .upsert(entryToRow(userId, dealId, entry), { onConflict: 'user_id,deal_id' })
      .then(({ error }) => { if (error) console.error('SRS save failed:', error.message); });
  }, [userId]);

  const mutate = useCallback((id: string, compute: (prev: SRSEntry) => SRSEntry) => {
    const next = compute(normalizeEntry(storeRef.current[id] ?? getDefaultEntry()));
    const updated = { ...storeRef.current, [id]: next };
    storeRef.current = updated;
    setStore(updated);
    persist(id, next);
  }, [persist]);

  const applyResult = useCallback((id: string, correct: boolean) => {
    mutate(id, prev => applyAnswer(prev, correct));
  }, [mutate]);

  const finalizeBufferResult = useCallback((id: string, retrySucceeded: boolean) => {
    mutate(id, prev => finalizeBuffer(prev, retrySucceeded));
  }, [mutate]);

  const resetEntry = useCallback((id: string) => {
    const { [id]: _removed, ...rest } = storeRef.current;
    storeRef.current = rest;
    setStore(rest);
    if (userId) {
      supabase.from('srs_progress').delete().eq('user_id', userId).eq('deal_id', id)
        .then(({ error }) => { if (error) console.error('SRS reset failed:', error.message); });
    }
  }, [userId]);

  // Wipe all of the user's SRS progress (every deal back to NEW).
  const clearAll = useCallback(async () => {
    storeRef.current = {};
    setStore({});
    if (!userId) return;
    const { error } = await supabase.from('srs_progress').delete().eq('user_id', userId);
    if (error) console.error('SRS clear-all failed:', error.message);
  }, [userId]);

  return { getEntry, applyResult, finalizeBufferResult, resetEntry, clearAll, store, loading };
}
