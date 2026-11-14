import { useState, useCallback, useEffect, useRef } from 'react';
import type { SRSStore, SRSEntry } from '../types';
import type { SrsProgressRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { getDefaultEntry, normalizeEntry, applyAnswer, isReviewDue, MAX_STEP } from '../lib/srs';
import { isOfflineFailure } from '../lib/network';
import { cacheGet, cachePut, cacheKeys } from '../lib/localCache';

// Re-export so existing imports (`from '../hooks/useSRS'`) keep working.
export { getDefaultEntry, isReviewDue };

function rowToEntry(r: SrsProgressRow): SRSEntry {
  return {
    status: r.status,
    consecutiveCorrect: Math.max(0, Math.min(MAX_STEP, r.consecutive_correct)) as SRSEntry['consecutiveCorrect'],
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
    // Chwila tego zapisu, nie `lastSeen`: RESTART przywraca stary `lastSeen`, a i tak
    // jest najnowszą decyzją. Baza odrzuca zapis starszy niż ten, który już ma.
    rated_at: new Date().toISOString(),
  };
}

/**
 * SRS store backed by the `srs_progress` table. The in-memory `store` is
 * hydrated on login and kept as the synchronous source of truth; mutations
 * update it optimistically and write through to the database.
 *
 * `offline`: stan idzie z kopii lokalnej i jest tylko do odczytu — każda mutacja
 * jest pomijana (etap 2 trybu offline; kolejka zapisów dojdzie w etapie 3).
 */
export function useSRS(userId: string | null, offline = false) {
  const [store, setStore] = useState<SRSStore>({});
  const [loading, setLoading] = useState(true);
  const storeRef = useRef<SRSStore>({});
  storeRef.current = store;
  // Konto, dla którego `store` jest wiarygodny (wczytany z bazy albo z kopii). Po
  // nieudanym wczytaniu zostaje `null`, żeby pusty stan nie nadpisał dobrej kopii.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setStore({}); setHydratedFor(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setHydratedFor(null);
    const finish = (s: SRSStore, ok: boolean) => {
      if (!active) return;
      setStore(s);
      setHydratedFor(ok ? userId : null);
      setLoading(false);
    };
    const fromCache = async () => {
      const cached = await cacheGet<SRSStore>(cacheKeys.srs(userId));
      finish(cached ?? {}, cached !== null);
    };
    if (offline) { void fromCache(); return () => { active = false; }; }

    supabase.from('srs_progress').select('*').eq('user_id', userId).then(({ data, error }) => {
      if (isOfflineFailure(error)) { void fromCache(); return; }
      const s: SRSStore = {};
      if (error) console.error('SRS load failed:', error.message);
      else if (data) for (const r of data) s[r.deal_id] = rowToEntry(r);
      finish(s, !error);
    });
    return () => { active = false; };
  }, [userId, offline]);

  // Kopia lokalna podąża za stanem w pamięci, więc obejmuje też oceny wystawione
  // po wczytaniu — nie tylko to, co było w bazie przy starcie.
  useEffect(() => {
    if (!userId || offline || hydratedFor !== userId) return;
    void cachePut(cacheKeys.srs(userId), store);
  }, [store, userId, offline, hydratedFor]);

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
    if (offline) return;
    const next = compute(normalizeEntry(storeRef.current[id] ?? getDefaultEntry()));
    const updated = { ...storeRef.current, [id]: next };
    storeRef.current = updated;
    setStore(updated);
    persist(id, next);
  }, [persist, offline]);

  const applyResult = useCallback((id: string, correct: boolean) => {
    mutate(id, prev => applyAnswer(prev, correct));
  }, [mutate]);

  // Apply a rating computed from an explicit baseline (free-play anti-gaming):
  // re-rating always starts from the pre-visit snapshot, so it never accumulates.
  const applyFromSnapshot = useCallback((id: string, snapshot: SRSEntry, correct: boolean) => {
    if (offline) return;
    const next = applyAnswer(normalizeEntry(snapshot), correct);
    const updated = { ...storeRef.current, [id]: next };
    storeRef.current = updated;
    setStore(updated);
    persist(id, next);
  }, [persist, offline]);

  // Write a specific entry (used to revert a rating to a prior snapshot).
  const setEntry = useCallback((id: string, entry: SRSEntry) => {
    if (offline) return;
    const updated = { ...storeRef.current, [id]: entry };
    storeRef.current = updated;
    setStore(updated);
    persist(id, entry);
  }, [persist, offline]);

  const resetEntry = useCallback((id: string) => {
    if (offline) return;
    const { [id]: _removed, ...rest } = storeRef.current;
    storeRef.current = rest;
    setStore(rest);
    if (userId) {
      supabase.from('srs_progress').delete().eq('user_id', userId).eq('deal_id', id)
        .then(({ error }) => { if (error) console.error('SRS reset failed:', error.message); });
    }
  }, [userId, offline]);

  // Wipe all of the user's SRS progress (every deal back to NEW).
  const clearAll = useCallback(async () => {
    if (offline) return;
    storeRef.current = {};
    setStore({});
    if (!userId) return;
    const { error } = await supabase.from('srs_progress').delete().eq('user_id', userId);
    if (error) console.error('SRS clear-all failed:', error.message);
  }, [userId, offline]);

  return { getEntry, applyResult, applyFromSnapshot, setEntry, resetEntry, clearAll, store, loading };
}
