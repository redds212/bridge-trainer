import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Deal, SRSStore, UserSettings, AttemptPhase } from '../types';
import type { DailySessionRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { todayKey, toDateKey } from '../lib/date';
import { generateDailySession, adaptSession, sessionFromSlots, type DailySession } from '../lib/session';

interface Runtime {
  session: DailySession;
  index: number;        // pointer into main slots
  buffer: string[];     // dealIds missed in the main pass
  inBuffer: boolean;
  bufferIndex: number;
  token: number;        // bumps on every answer to force a deal reload
}

interface Args {
  userId: string | null;
  deals: Deal[];
  store: SRSStore;
  settings: UserSettings;
  applyResult: (id: string, correct: boolean) => void;
  finalizeBufferResult: (id: string, retrySucceeded: boolean) => void;
  recordHistory: (id: string, correct: boolean, phase: AttemptPhase) => void;
}

export interface SessionProgress {
  inBuffer: boolean;
  mainDone: number;
  mainTotal: number;
  bufferDone: number;
  bufferTotal: number;
}

/** Etykieta przycisku wznowienia — bufor liczy się osobno od przebiegu głównego. */
export function resumeLabel(p: SessionProgress): string {
  return p.inBuffer
    ? `🔁 Wznów poprawki (${p.bufferDone} / ${p.bufferTotal})`
    : `▶ Wznów sesję (${p.mainDone} / ${p.mainTotal})`;
}

function toProgress(rt: Runtime): SessionProgress {
  return {
    inBuffer: rt.inBuffer,
    mainDone: rt.inBuffer ? rt.session.slots.length : rt.index,
    mainTotal: rt.session.slots.length,
    bufferDone: rt.bufferIndex,
    bufferTotal: rt.buffer.length,
  };
}

function rowToRuntime(r: DailySessionRow): Runtime {
  const slots = Array.isArray(r.slots) ? r.slots : [];
  const buffer = Array.isArray(r.buffer) ? r.buffer : [];
  const session = sessionFromSlots(
    toDateKey(r.date) ?? r.date,
    slots,
    Array.isArray(r.deferred_review_ids) ? r.deferred_review_ids : [],
    r.target,
    r.mode,
  );
  return {
    session,
    index: Math.max(0, Math.min(r.idx, slots.length)),
    buffer,
    inBuffer: r.in_buffer,
    bufferIndex: Math.max(0, Math.min(r.buffer_index, buffer.length)),
    token: 1,
  };
}

function runtimeToRow(userId: string, rt: Runtime): DailySessionRow {
  return {
    user_id: userId,
    date: rt.session.date,
    slots: rt.session.slots,
    idx: rt.index,
    buffer: rt.buffer,
    buffer_index: rt.bufferIndex,
    in_buffer: rt.inBuffer,
    deferred_review_ids: rt.session.deferredReviewIds,
    target: rt.session.target,
    mode: rt.session.mode,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Następny stan po odpowiedzi albo pominięciu slotu; `'done'` gdy sesja się domyka.
 * Wydzielone z `answer`, bo tą samą drogą idzie przeskakiwanie rozdań, które
 * zniknęły z puli — tam nie wolno tknąć SRS-u ani historii.
 */
function advance(rt: Runtime, toBuffer: boolean): Runtime | 'done' {
  if (!rt.inBuffer) {
    const id = rt.session.slots[rt.index]?.dealId;
    const buffer = toBuffer && id ? [...rt.buffer, id] : rt.buffer;
    const index = rt.index + 1;
    if (index < rt.session.slots.length) return { ...rt, index, buffer, token: rt.token + 1 };
    if (buffer.length) return { ...rt, index, buffer, inBuffer: true, bufferIndex: 0, token: rt.token + 1 };
    return 'done';
  }
  const bufferIndex = rt.bufferIndex + 1;
  if (bufferIndex >= rt.buffer.length) return 'done';
  return { ...rt, bufferIndex, token: rt.token + 1 };
}

/**
 * Sesja dzienna z migawką w bazie (`daily_sessions`) — patrz docs/SESSION_RESUME_PLAN.md.
 *
 * Stan trzymamy w dwóch osobnych miejscach: `runtime` to sesja, w której właśnie
 * jesteś, `paused` to wstrzymana migawka czekająca na „Wznów". Rozdzielenie jest
 * celowe — po otwarciu aplikacji nie wskakujemy w sesję sami (D3), więc migawka
 * wczytana z bazy ląduje jako `paused`, a nie jako aktywny przebieg.
 */
export function useDailySession(args: Args) {
  const { userId, deals, store, settings, applyResult, finalizeBufferResult, recordHistory } = args;
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [paused, setPaused] = useState<Runtime | null>(null);
  const [completed, setCompleted] = useState<DailySession | null>(null);
  const [loading, setLoading] = useState(true);

  // Ostatni stan, o którym wiemy, że siedzi w bazie. Chroni przed odesłaniem z
  // powrotem tego, co przed chwilą wczytaliśmy, i przed zapisem przy samej
  // zmianie pauza↔wznowienie (dane się wtedy nie zmieniają).
  const syncedRef = useRef<Runtime | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  const clearRow = useCallback(() => {
    syncedRef.current = null;
    if (!userId) return;
    supabase.from('daily_sessions').delete().eq('user_id', userId)
      .then(({ error }) => { if (error) console.error('Session clear failed:', error.message); });
  }, [userId]);

  // Hydratacja przy logowaniu. Migawka z innego dnia jest ignorowana (D2) —
  // zostanie nadpisana przy pierwszym starcie, więc nie ma czego sprzątać.
  useEffect(() => {
    if (!userId) { setRuntime(null); setPaused(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    supabase.from('daily_sessions').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('Session load failed:', error.message);
        const fresh = data && toDateKey(data.date) === todayKey() && data.slots?.length
          ? rowToRuntime(data)
          : null;
        syncedRef.current = fresh; // to, co właśnie wczytaliśmy, już jest w bazie
        setPaused(fresh);
        setRuntime(null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  // Zapis write-through: każdy nowy stan sesji ląduje w bazie, tak samo jak
  // wyniki w `useSRS`. Dzięki temu awaryjne zamknięcie karty nic nie kosztuje.
  useEffect(() => {
    if (!userId || loading) return;
    const snap = runtime ?? paused;
    if (!snap || snap === syncedRef.current) return;
    syncedRef.current = snap;
    supabase.from('daily_sessions').upsert(runtimeToRow(userId, snap), { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.error('Session save failed:', error.message); });
  }, [runtime, paused, userId, loading]);

  const commit = useCallback((next: Runtime | 'done', finished: DailySession) => {
    if (next !== 'done') { setRuntime(next); return; }
    setCompleted(finished);
    setRuntime(null);
    setPaused(null);
    clearRow(); // ukończonej sesji nie ma po co wznawiać
  }, [clearRow]);

  const start = useCallback(() => {
    const session = generateDailySession(deals, store, settings);
    setCompleted(null);
    setPaused(null);
    if (!session.slots.length) {
      setCompleted(session); // nothing to do — surface an empty summary
      setRuntime(null);
      clearRow();
      return session;
    }
    setRuntime({ session, index: 0, buffer: [], inBuffer: false, bufferIndex: 0, token: 1 });
    return session;
  }, [deals, store, settings, clearRow]);

  /** Wyjście z sesji bez jej kasowania — migawka czeka na „Wznów" (D3). */
  const pause = useCallback(() => {
    if (!runtime) return;
    setPaused(runtime);
    setRuntime(null);
  }, [runtime]);

  const resume = useCallback(() => {
    if (!paused) return;
    setCompleted(null);
    setRuntime({ ...paused, token: paused.token + 1 });
    setPaused(null);
  }, [paused]);

  const dismissCompleted = useCallback(() => setCompleted(null), []);

  /**
   * Co zostało na dziś — źródło dla „Rekomendowane na dziś" w panelu bocznym.
   * Poza sesją to podgląd kolejki, którą dostaniesz po „Rozpocznij", więc najwyżej
   * `dailyTarget` pozycji zamiast całej puli zaległości (reszta i tak wraca w kolejne
   * dni). Gdy sesja trwa albo czeka wstrzymana, bierzemy JEJ kolejkę: świeże
   * generowanie zwróciłoby inny zestaw niż ten, do którego wracasz (D9).
   */
  const todayQueue = useMemo<string[]>(() => {
    const snap = runtime ?? paused;
    if (snap) {
      // W buforze przebieg główny jest już wyczerpany; poza nim bufor to ogon, który
      // dopiero przyjdzie — stąd obie części w tej samej liście.
      const main = snap.inBuffer ? [] : snap.session.slots.slice(snap.index).map(s => s.dealId);
      return [...main, ...snap.buffer.slice(snap.inBuffer ? snap.bufferIndex : 0)];
    }
    return deals.length ? generateDailySession(deals, store, settings).slots.map(s => s.dealId) : [];
  }, [runtime, paused, deals, store, settings]);

  const currentDealId = useMemo(() => {
    if (!runtime) return null;
    return runtime.inBuffer
      ? runtime.buffer[runtime.bufferIndex] ?? null
      : runtime.session.slots[runtime.index]?.dealId ?? null;
  }, [runtime]);

  // Rozdanie zniknęło z aktywnej puli (admin je zarchiwizował) — przeskakujemy
  // slot, zamiast zacinać sesję na czymś, czego nie da się wczytać (D7).
  useEffect(() => {
    if (!runtime || !deals.length || !currentDealId) return;
    if (deals.some(d => d.id === currentDealId)) return;
    commit(advance(runtime, false), runtime.session);
  }, [runtime, deals, currentDealId, commit]);

  // Zmiana celu dziennego albo trybu przelicza kolejkę (D4). W buforze kolejka
  // jest zamknięta (D5), więc zmiana zadziała dopiero od następnej sesji.
  useEffect(() => {
    const snap = runtime ?? paused;
    if (!snap || snap.inBuffer || !deals.length) return;

    const next = adaptSession(snap.session, snap.index, deals, storeRef.current, settings);
    if (next === snap.session) return;

    const updated: Runtime = { ...snap, session: next, token: snap.token + 1 };
    if (updated.index < next.slots.length) {
      if (runtime) setRuntime(updated); else setPaused(updated);
      return;
    }
    // Cel spadł do poziomu tego, co już zrobione — przebieg główny jest wyczerpany.
    if (updated.buffer.length) {
      const drained: Runtime = { ...updated, inBuffer: true, bufferIndex: 0 };
      if (runtime) setRuntime(drained); else setPaused(drained);
    } else if (runtime) {
      commit('done', next);
    } else {
      setPaused(null);
      clearRow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, paused, deals.length, settings.dailyTarget, settings.mode, commit, clearRow]);

  /** handleUserAnswer — Sections 3 & 4 of the SRS spec. */
  const answer = useCallback((correct: boolean) => {
    if (!runtime) return;

    if (!runtime.inBuffer) {
      const id = runtime.session.slots[runtime.index]?.dealId;
      if (!id) return;
      recordHistory(id, correct, 'main');
      if (correct) {
        applyResult(id, true); // success scaling now
      }
      // A miss is NOT finalized here — it is deferred to the session buffer.
      commit(advance(runtime, !correct), runtime.session);
      return;
    }

    // Session buffer pass — regardless of result the deal returns tomorrow.
    const id = runtime.buffer[runtime.bufferIndex];
    if (!id) return;
    recordHistory(id, correct, 'buffer');
    finalizeBufferResult(id, correct);
    commit(advance(runtime, false), runtime.session);
  }, [runtime, recordHistory, applyResult, finalizeBufferResult, commit]);

  return {
    active: runtime !== null,
    loading,
    currentDealId,
    currentKind: runtime && !runtime.inBuffer ? runtime.session.slots[runtime.index]?.kind ?? null : null,
    progress: runtime ? toProgress(runtime) : null,
    sessionToken: runtime?.token ?? 0,
    completed,
    /** Id rozdań, które zostały na dziś — w kolejności sesji. */
    todayQueue,
    /** Wstrzymana migawka na dziś — źródło liczników „Wznów sesję (4/12)". */
    pausedSession: paused?.session ?? null,
    pausedProgress: paused ? toProgress(paused) : null,
    start,
    answer,
    pause,
    resume,
    dismissCompleted,
  };
}
