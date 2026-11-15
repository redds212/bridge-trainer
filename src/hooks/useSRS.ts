import { useState, useCallback, useEffect, useRef } from 'react';
import type { SRSStore, SRSEntry } from '../types';
import type { SrsProgressRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { getDefaultEntry, normalizeEntry, applyAnswer, isReviewDue, MAX_STEP } from '../lib/srs';
import { isOfflineFailure } from '../lib/network';
import { cacheGet, cachePut, cacheKeys } from '../lib/localCache';
import { flushOutbox, outboxDrop, outboxPending, outboxPutSrs } from '../lib/outbox';

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

/** Wiersz „nowe" — tak zapisujemy reset rozdania (O5); w pamięci to po prostu brak wpisu. */
const isBlankRow = (r: SrsProgressRow) => r.status === 'NEW' && !r.last_seen && !r.flag_difficult;

function overlayRows(store: SRSStore, rows: SrsProgressRow[]) {
  for (const r of rows) {
    if (isBlankRow(r)) delete store[r.deal_id];
    else store[r.deal_id] = rowToEntry(r);
  }
}

/**
 * SRS store backed by the `srs_progress` table. The in-memory `store` is
 * hydrated on login and kept as the synchronous source of truth; mutations
 * update it optimistically and go out through the write queue (`lib/outbox`).
 *
 * `offline`: stan idzie z kopii lokalnej. Oceny działają dalej — czekają w kolejce
 * na powrót sieci (etap 3 trybu offline). Zablokowane zostaje tylko „wyczyść wszystko".
 */
export function useSRS(userId: string | null, offline = false) {
  const [store, setStore] = useState<SRSStore>({});
  const [loading, setLoading] = useState(true);
  const storeRef = useRef<SRSStore>({});
  storeRef.current = store;
  // Konto, dla którego `store` jest wiarygodny (wczytany z bazy albo z kopii). Po
  // nieudanym wczytaniu zostaje `null`, żeby pusty stan nie nadpisał dobrej kopii.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const hydratedRef = useRef<string | null>(null);
  // Rozdania zmienione lokalnie w trakcie wczytywania — ich stan z pamięci wygrywa
  // z tym, co za chwilę przyjdzie z bazy.
  const dirtyRef = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) { setStore({}); setHydratedFor(null); hydratedRef.current = null; setLoading(false); return; }
    // To samo konto, zmienił się tylko stan sieci: odświeżamy po cichu, bez ekranu
    // ładowania, żeby powrót sieci nie zrywał rozdania w toku.
    const resync = hydratedRef.current === userId;
    if (resync && offline) return; // pamięć już jest prawdą, a kopia za nią podąża
    let active = true;
    if (!resync) { setLoading(true); setHydratedFor(null); }
    dirtyRef.current = new Set();

    const finish = async (s: SRSStore, ok: boolean) => {
      overlayRows(s, Object.values((await outboxPending(userId)).srs));
      if (!active) return;
      if (ok || !resync) {
        for (const id of dirtyRef.current) {
          const local = storeRef.current[id];
          if (local) s[id] = local; else delete s[id];
        }
        storeRef.current = s;
        setStore(s);
      }
      if (ok) { hydratedRef.current = userId; setHydratedFor(userId); }
      setLoading(false);
    };
    const fromCache = async () => {
      const cached = await cacheGet<SRSStore>(cacheKeys.srs(userId));
      await finish(cached ?? {}, cached !== null);
    };

    void (async () => {
      // Najpierw własne zapisy, potem świeży stan (O6).
      if (offline || await flushOutbox(userId) === 'offline') { await fromCache(); return; }
      const { data, error } = await supabase.from('srs_progress').select('*').eq('user_id', userId);
      if (isOfflineFailure(error)) { await fromCache(); return; }
      const s: SRSStore = {};
      if (error) console.error('SRS load failed:', error.message);
      else if (data) overlayRows(s, data);
      await finish(s, !error);
    })();
    return () => { active = false; };
  }, [userId, offline]);

  // Kopia lokalna podąża za stanem w pamięci — także offline, żeby oceny wystawione
  // bez sieci przeżyły zamknięcie aplikacji.
  useEffect(() => {
    if (!userId || hydratedFor !== userId) return;
    void cachePut(cacheKeys.srs(userId), store);
  }, [store, userId, hydratedFor]);

  const getEntry = useCallback(
    (id: string): SRSEntry => normalizeEntry(store[id] ?? getDefaultEntry()),
    [store],
  );

  /** `entry: null` kasuje wpis w pamięci, a do bazy idzie wiersz „nowe" z godziną (O5). */
  const write = useCallback((id: string, entry: SRSEntry | null) => {
    const updated = { ...storeRef.current };
    if (entry) updated[id] = entry; else delete updated[id];
    storeRef.current = updated;
    setStore(updated);
    dirtyRef.current.add(id);
    if (userId) outboxPutSrs(userId, entryToRow(userId, id, entry ?? getDefaultEntry()));
  }, [userId]);

  const applyResult = useCallback((id: string, correct: boolean) => {
    write(id, applyAnswer(normalizeEntry(storeRef.current[id] ?? getDefaultEntry()), correct));
  }, [write]);

  // Apply a rating computed from an explicit baseline (free-play anti-gaming):
  // re-rating always starts from the pre-visit snapshot, so it never accumulates.
  const applyFromSnapshot = useCallback((id: string, snapshot: SRSEntry, correct: boolean) => {
    write(id, applyAnswer(normalizeEntry(snapshot), correct));
  }, [write]);

  // Write a specific entry (used to revert a rating to a prior snapshot).
  const setEntry = useCallback((id: string, entry: SRSEntry) => write(id, entry), [write]);

  // Reset to NEW. Zapis, nie kasowanie wiersza: skasowany wiersz wskrzesiłaby
  // spóźniona, wcześniejsza ocena z innego urządzenia.
  const resetEntry = useCallback((id: string) => write(id, null), [write]);

  // Wipe all of the user's SRS progress (every deal back to NEW). Wymaga sieci (O5):
  // postęp znika dopiero, gdy baza potwierdzi skasowanie.
  const clearAll = useCallback(async () => {
    if (offline) return;
    if (userId) {
      const { error } = await supabase.from('srs_progress').delete().eq('user_id', userId);
      if (error) { console.error('SRS clear-all failed:', error.message); return; }
      outboxDrop(userId, 'srs');
    }
    storeRef.current = {};
    setStore({});
  }, [userId, offline]);

  return { getEntry, applyResult, applyFromSnapshot, setEntry, resetEntry, clearAll, store, loading };
}
