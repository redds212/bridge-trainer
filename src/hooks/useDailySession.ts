import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Deal, SRSStore, UserSettings, AttemptPhase } from '../types';
import type { DailySessionRow } from '../lib/database.types';
import { supabase } from '../lib/supabase';
import { todayKey, toDateKey, dateKeyToDate } from '../lib/date';
import {
  generateDailySession, generateExtraSession, extraBatchSize, adaptSession, sessionFromSlots,
  pendingBufferMisses, type DailySession, type SessionType,
} from '../lib/session';
import { normalizeEntry, isAnsweredToday } from '../lib/srs';
import { useDayKey } from './useDayKey';

interface Runtime {
  session: DailySession;
  index: number;        // pointer into slots
  token: number;        // bumps on every answer to force a deal reload
}

interface Args {
  userId: string | null;
  deals: Deal[];
  store: SRSStore;
  /** `store` jeszcze się wczytuje — kara dla pudeł ze starego bufora musi na niego poczekać. */
  storeLoading: boolean;
  settings: UserSettings;
  applyResult: (id: string, correct: boolean) => void;
  recordHistory: (id: string, correct: boolean, phase: AttemptPhase) => void;
}

export interface SessionProgress {
  type: SessionType;
  done: number;
  total: number;
}

/** Etykieta przycisku wznowienia — sesja i partia wracają tym samym przyciskiem. */
export function resumeLabel(p: SessionProgress): string {
  return `▶ Wznów ${p.type === 'extra' ? 'partię' : 'sesję'} (${p.done} / ${p.total})`;
}

function toProgress(rt: Runtime): SessionProgress {
  return { type: rt.session.type, done: rt.index, total: rt.session.slots.length };
}

function rowToRuntime(r: DailySessionRow): Runtime {
  const slots = Array.isArray(r.slots) ? r.slots : [];
  const session = sessionFromSlots(
    toDateKey(r.date) ?? r.date,
    slots,
    Array.isArray(r.deferred_review_ids) ? r.deferred_review_ids : [],
    r.target,
    r.mode,
  );
  return { session, index: Math.max(0, Math.min(r.idx, slots.length)), token: 1 };
}

function runtimeToRow(userId: string, rt: Runtime): DailySessionRow {
  return {
    user_id: userId,
    date: rt.session.date,
    slots: rt.session.slots,
    idx: rt.index,
    // Bufora już nie ma (D13), ale kolumny zostały. Upsert nadpisuje tylko podane
    // pola, więc bez jawnych zer stan zostawiony przez starszą wersję przetrwałby
    // w wierszu i wracał przy każdym wczytaniu.
    buffer: [],
    buffer_index: 0,
    in_buffer: false,
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
function advance(rt: Runtime): Runtime | 'done' {
  const index = rt.index + 1;
  return index < rt.session.slots.length ? { ...rt, index, token: rt.token + 1 } : 'done';
}

/**
 * Sesja dzienna i dodatkowa partia z migawką w bazie (`daily_sessions`) — patrz
 * docs/SESSION_RESUME_PLAN.md.
 *
 * Stan trzymamy w dwóch osobnych miejscach: `runtime` to sesja, w której właśnie
 * jesteś, `paused` to wstrzymana migawka czekająca na „Wznów". Rozdzielenie jest
 * celowe — po otwarciu aplikacji nie wskakujemy w sesję sami (D3), więc migawka
 * wczytana z bazy ląduje jako `paused`, a nie jako aktywny przebieg.
 */
export function useDailySession(args: Args) {
  const { userId, deals, store, storeLoading, settings, applyResult, recordHistory } = args;
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [paused, setPaused] = useState<Runtime | null>(null);
  const [completed, setCompleted] = useState<DailySession | null>(null);
  const [loading, setLoading] = useState(true);
  // Dzisiejszy wiersz zapisany przez starszą wersję, w którego buforze mogły zostać
  // pudła bez kary (D13). Czeka tu, aż wczyta się SRS.
  const [legacyRow, setLegacyRow] = useState<DailySessionRow | null>(null);
  // Doba, na którą pracuje kolejka. Każde przeliczenie w tym hooku dostaje `now`
  // z tego klucza, więc podgląd, `start()` i migawka mówią o tym samym dniu.
  const dayKey = useDayKey();
  const dayNow = useMemo(() => dateKeyToDate(dayKey), [dayKey]);

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
    if (!userId) { setRuntime(null); setPaused(null); setLegacyRow(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    supabase.from('daily_sessions').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('Session load failed:', error.message);
        const row = data && toDateKey(data.date) === todayKey() ? data : null;
        const snap = row?.slots?.length ? rowToRuntime(row) : null;
        // Wiersz ze starszej wersji zapisany w buforze ma wyczerpany przebieg główny —
        // bez bufora nie zostaje w nim nic do wznowienia.
        const fresh = snap && snap.index < snap.session.slots.length ? snap : null;
        syncedRef.current = fresh; // to, co właśnie wczytaliśmy, już jest w bazie
        setLegacyRow(row?.buffer?.length ? row : null);
        setPaused(fresh);
        setRuntime(null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  // Pudła, które starsza wersja odłożyła do bufora, dostają karę, jakiej bufor nie
  // zdążył wymierzyć (D13) — tak jakby padły już po zmianie. Czekamy na SRS, bo
  // `applyResult` liczy z bieżącego wpisu, a wczytanie `store` po fakcie nadpisałoby
  // wynik policzony z pustego. Ponowne wczytanie tego samego wiersza nic nie psuje:
  // `pendingBufferMisses` pomija rozdania ocenione po zapisie migawki.
  const punishedRef = useRef<DailySessionRow | null>(null);
  useEffect(() => {
    if (storeLoading || !legacyRow || punishedRef.current === legacyRow) return;
    punishedRef.current = legacyRow;
    for (const id of pendingBufferMisses(legacyRow, storeRef.current)) applyResult(id, false);
  }, [storeLoading, legacyRow, applyResult]);

  // Przełom doby (00:00 czasu lokalnego). Kolejka jest „na dziś”, więc wczorajsza
  // sesja przestaje obowiązywać niezależnie od tego, ile z niej zostało: migawka
  // leci do kosza, a `todayQueue` generuje zestaw na nowy dzień. Nic się przy tym nie
  // gubi — każda udzielona odpowiedź poszła write-through do SRS-u i historii w
  // momencie kliknięcia; przepada tylko ogon wczorajszej kolejki, który z definicji
  // ma być policzony od nowa.
  const dayRef = useRef(dayKey);
  useEffect(() => {
    if (dayRef.current === dayKey) return;
    dayRef.current = dayKey;
    setRuntime(null);
    setPaused(null);
    setCompleted(null); // podsumowanie wczorajszej sesji nie ma czego pilnować
    clearRow();         // wiersz w bazie jest z wczoraj
  }, [dayKey, clearRow]);

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

  /** Start gotowej kolejki — sesji dziennej albo partii. Zastępuje wstrzymaną migawkę. */
  const begin = useCallback((session: DailySession) => {
    setCompleted(null);
    setPaused(null);
    if (!session.slots.length) {
      setCompleted(session); // nothing to do — surface an empty summary
      setRuntime(null);
      clearRow();
      return;
    }
    setRuntime({ session, index: 0, token: 1 });
  }, [clearRow]);

  const start = useCallback(() => {
    begin(generateDailySession(deals, store, settings, dayNow));
  }, [begin, deals, store, settings, dayNow]);

  /** Dodatkowa partia na wylosowanych rozdaniach — po sesji dziennej, na dalszy trening (D14). */
  const startExtra = useCallback(() => {
    begin(generateExtraSession(deals, store, settings, dayNow));
  }, [begin, deals, store, settings, dayNow]);

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

  /** Porzucenie wstrzymanej migawki bez startu nowej — wyniki zostają, znika sama kolejka (D16). */
  const discard = useCallback(() => {
    if (!paused) return;
    setPaused(null);
    clearRow();
  }, [paused, clearRow]);

  const dismissCompleted = useCallback(() => setCompleted(null), []);

  /**
   * Co zostało na dziś — źródło dla „Rekomendowane na dziś" w panelu bocznym.
   * Poza sesją to podgląd kolejki, którą dostaniesz po „Rozpocznij", więc najwyżej
   * `dailyTarget` pozycji zamiast całej puli zaległości (reszta i tak wraca w kolejne
   * dni). Gdy sesja albo partia trwa lub czeka wstrzymana, bierzemy JEJ kolejkę:
   * świeże generowanie zwróciłoby inny zestaw niż ten, do którego wracasz (D9) — ale
   * bez rozdań ocenionych dziś, bo migawka nie wie o ocenach wystawionych poza nią (D12).
   */
  const todayQueue = useMemo<string[]>(() => {
    const snap = runtime ?? paused;
    if (snap) {
      // Migawka zmienia się wyłącznie od odpowiedzi udzielonych W sesji, więc bez
      // tego filtru rozdanie ocenione w swobodnej grze przy pauzie wisiało na liście
      // do końca dnia. Ocenione dziś — trafione czy pudło — dziś nie ma już czego
      // robić (D13). Cofnięcie oceny RESTARTEM przywraca poprzedni wpis, więc pozycja
      // wraca na listę sama.
      return snap.session.slots.slice(snap.index)
        .map(s => s.dealId)
        .filter(id => !isAnsweredToday(normalizeEntry(store[id]), dayNow));
    }
    return deals.length ? generateDailySession(deals, store, settings, dayNow).slots.map(s => s.dealId) : [];
  }, [runtime, paused, deals, store, settings, dayNow]);

  /** Ile rozdań wylosuje „Wylosuj partię" — zero, gdy wszystko było dziś rozwiązane. */
  const extraSize = useMemo(
    () => extraBatchSize(deals, store, settings, dayNow),
    [deals, store, settings, dayNow],
  );

  const currentDealId = useMemo(
    () => runtime?.session.slots[runtime.index]?.dealId ?? null,
    [runtime],
  );

  // Rozdanie zniknęło z aktywnej puli (admin je zarchiwizował) — przeskakujemy
  // slot, zamiast zacinać sesję na czymś, czego nie da się wczytać (D7).
  useEffect(() => {
    if (!runtime || !deals.length || !currentDealId) return;
    if (deals.some(d => d.id === currentDealId)) return;
    commit(advance(runtime), runtime.session);
  }, [runtime, deals, currentDealId, commit]);

  // Zmiana celu dziennego albo trybu przelicza kolejkę sesji dziennej (D4). Partii
  // nie ruszamy: to stała liczba wylosowanych rozdań, a dopychanie brałoby z pul
  // sesji dziennej (D15).
  useEffect(() => {
    const snap = runtime ?? paused;
    if (!snap || snap.session.type === 'extra' || !deals.length) return;

    const next = adaptSession(snap.session, snap.index, deals, storeRef.current, settings, dayNow);
    if (next === snap.session) return;

    const updated: Runtime = { ...snap, session: next, token: snap.token + 1 };
    if (updated.index < next.slots.length) {
      if (runtime) setRuntime(updated); else setPaused(updated);
    } else if (runtime) {
      // Cel spadł do poziomu tego, co już zrobione — sesja jest domknięta.
      commit('done', next);
    } else {
      setPaused(null);
      clearRow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, paused, deals.length, settings.dailyTarget, settings.mode, dayNow, commit, clearRow]);

  /**
   * handleUserAnswer — wynik od razu trafia do SRS-u i historii. Pudło wraca jutro,
   * a nie w tej samej sesji: bufora poprawek już nie ma (D13).
   */
  const answer = useCallback((correct: boolean) => {
    if (!runtime) return;
    const id = runtime.session.slots[runtime.index]?.dealId;
    if (!id) return;
    recordHistory(id, correct, 'main');
    applyResult(id, correct);
    commit(advance(runtime), runtime.session);
  }, [runtime, recordHistory, applyResult, commit]);

  return {
    active: runtime !== null,
    loading,
    currentDealId,
    currentKind: runtime?.session.slots[runtime.index]?.kind ?? null,
    progress: runtime ? toProgress(runtime) : null,
    sessionToken: runtime?.token ?? 0,
    completed,
    /** Id rozdań, które zostały na dziś — w kolejności sesji. */
    todayQueue,
    extraSize,
    /** Wstrzymana migawka na dziś — źródło liczników „Wznów sesję (4/12)". */
    pausedSession: paused?.session ?? null,
    pausedProgress: paused ? toProgress(paused) : null,
    start,
    startExtra,
    answer,
    pause,
    resume,
    discard,
    dismissCompleted,
  };
}
