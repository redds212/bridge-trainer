/**
 * Kolejka zapisów do trybu offline (docs/OFFLINE_PLAN.md, etap 3, O6).
 *
 * Każdy zapis postępów — ocena, podejście, migawka sesji — trafia najpierw tutaj
 * (pamięć + IndexedDB), a dopiero stąd do Supabase. Z siecią wysyłka następuje od
 * razu; bez sieci pozycje czekają i przeżywają zamknięcie aplikacji.
 *
 * Kolejka jest scalona, nie chronologiczna:
 *  - powtórki: jeden wiersz na rozdanie, ostatni zapis zastępuje poprzedni (O2 —
 *    o tym, czy wygra z serwerem, rozstrzyga `rated_at` w wyzwalaczu bazy),
 *  - podejścia: lista „tylko dopisz", `client_id` chroni przed duplikatem,
 *  - sesja: tylko ostatni stan — migawka albo jej skasowanie (O3).
 */
import type { SrsProgressRow, DailySessionRow, AttemptRow } from './database.types';
import { supabase } from './supabase';
import { cacheGet, cachePut, cacheKeys } from './localCache';
import { isOfflineFailure } from './network';
import { todayKey, toDateKey } from './date';

export type PendingAttempt = Omit<AttemptRow, 'id' | 'client_id'> & { client_id: string };

export type PendingSession =
  | { kind: 'put'; row: DailySessionRow }
  /** Skasuj migawkę z doby `day` albo starszą — nowszej (z innego urządzenia) nie ruszaj. */
  | { kind: 'clear'; day: string };

export interface Outbox {
  srs: Record<string, SrsProgressRow>;
  attempts: PendingAttempt[];
  session: PendingSession | null;
}

/** `offline` — zapytanie nie doleciało; `error` — baza odpowiedziała błędem. W obu kolejka zostaje. */
export type FlushResult = 'ok' | 'offline' | 'error';

export interface OutboxState {
  /** Ile rozdań ma niewysłane zapisy (sama migawka sesji liczy się jako 1). */
  pending: number;
  /** `sending` widać tylko po wcześniejszym niepowodzeniu — zwykła wysyłka online nie mruga. */
  status: 'idle' | 'sending' | 'offline' | 'error';
}

const empty = (): Outbox => ({ srs: {}, attempts: [], session: null });
const isEmpty = (b: Outbox) => !b.attempts.length && !b.session && Object.keys(b.srs).length === 0;

let owner: string | null = null;
let box: Outbox = empty();
let ready: Promise<void> = Promise.resolve();
/** Tryb offline z logowania: nie próbujemy wysyłać, dopóki profil nie potwierdzi sieci i dostępu. */
let paused = false;
let sending = false;
let failure: 'offline' | 'error' | null = null;
let stalled = false;
let inflight: Promise<FlushResult> | null = null;

let state: OutboxState = { pending: 0, status: 'idle' };
const listeners = new Set<() => void>();

/** Ile rozdań ma niewysłane zapisy; sama migawka sesji liczy się jako 1. */
function countPending(b: Outbox): number {
  const deals = new Set([...Object.keys(b.srs), ...b.attempts.map(a => a.deal_id)]);
  return deals.size || (b.session ? 1 : 0);
}

function emit() {
  const pending = countPending(box);
  const status: OutboxState['status'] =
    sending && stalled ? 'sending' : failure && pending > 0 ? failure : 'idle';
  if (pending === state.pending && status === state.status) return;
  state = { pending, status };
  listeners.forEach(l => l());
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const getOutboxState = (): OutboxState => state;

function attach(userId: string) {
  if (owner === userId) return;
  owner = userId;
  box = empty();
  failure = null;
  stalled = false;
  ready = cacheGet<Outbox>(cacheKeys.outbox(userId)).then(saved => {
    if (owner !== userId || !saved) return;
    box = { srs: saved.srs ?? {}, attempts: saved.attempts ?? [], session: saved.session ?? null };
    emit();
  });
}

function update(userId: string, change: (b: Outbox) => Outbox) {
  if (owner !== userId) return;
  box = change(box);
  void cachePut(cacheKeys.outbox(userId), box);
  emit();
}

function enqueue(userId: string, change: (b: Outbox) => Outbox) {
  attach(userId);
  void ready.then(() => {
    update(userId, change);
    if (!paused) void flushOutbox(userId);
  });
}

export function outboxPutSrs(userId: string, row: SrsProgressRow) {
  enqueue(userId, b => ({ ...b, srs: { ...b.srs, [row.deal_id]: row } }));
}

export function outboxAddAttempt(userId: string, attempt: PendingAttempt) {
  enqueue(userId, b => ({ ...b, attempts: [...b.attempts, attempt] }));
}

export function outboxPutSession(userId: string, row: DailySessionRow) {
  enqueue(userId, b => ({ ...b, session: { kind: 'put', row } }));
}

export function outboxClearSession(userId: string, day: string) {
  enqueue(userId, b => ({ ...b, session: { kind: 'clear', day } }));
}

/** Po „wyczyść wszystko" na serwerze czekające zapisy tego rodzaju nie mogą wrócić. */
export function outboxDrop(userId: string, what: 'srs' | 'attempts') {
  attach(userId);
  void ready.then(() => update(userId, b => (what === 'srs' ? { ...b, srs: {} } : { ...b, attempts: [] })));
}

/** Czekające zapisy — hooki nakładają je na to, co wczytały z bazy albo z kopii. */
export async function outboxPending(userId: string): Promise<Outbox> {
  attach(userId);
  await ready;
  return owner === userId ? box : empty();
}

/** Liczba rozdań z niewysłanymi zapisami — do ostrzeżenia przy wylogowaniu (O7). */
export async function outboxPendingCount(userId: string): Promise<number> {
  return countPending(await outboxPending(userId));
}

/** Wylogowanie albo cofnięty dostęp: zebrane zapisy odpadają (O4, O7). Kopię w IndexedDB kasuje `cacheClearUser`. */
export function outboxReset() {
  owner = null;
  box = empty();
  ready = Promise.resolve();
  failure = null;
  stalled = false;
  emit();
}

export function setOutboxPaused(value: boolean) {
  paused = value;
}

type DbError = { message: string; code?: string } | null;
/** Rozdanie usunięte na stałe w czasie offline — ocena odpada bez komunikatu (O8). */
const isMissingDeal = (e: DbError) => e?.code === '23503';

async function sendOnce(userId: string): Promise<FlushResult> {
  const snap = box;
  const out = { worst: 'ok' as FlushResult };
  const failed = (e: DbError): boolean => {
    if (!e) return false;
    console.error('Offline sync failed:', e.message);
    out.worst = isOfflineFailure(e) ? 'offline' : 'error';
    return true;
  };

  if (snap.attempts.length) {
    const { error } = await supabase.from('attempts')
      .upsert(snap.attempts, { onConflict: 'user_id,client_id', ignoreDuplicates: true });
    if (!failed(error)) {
      const sent = new Set(snap.attempts.map(a => a.client_id));
      update(userId, b => ({ ...b, attempts: b.attempts.filter(a => !sent.has(a.client_id)) }));
    } else if (out.worst === 'offline') return out.worst;
  }

  const rows = Object.values(snap.srs);
  if (rows.length) {
    // Zdejmujemy tylko to, co poszło: ocena wystawiona w trakcie wysyłki zostaje w kolejce.
    const drop = (sent: SrsProgressRow[]) => update(userId, b => {
      const srs = { ...b.srs };
      for (const r of sent) if (srs[r.deal_id] === r) delete srs[r.deal_id];
      return { ...b, srs };
    });
    const { error } = await supabase.from('srs_progress').upsert(rows, { onConflict: 'user_id,deal_id' });
    if (!error) drop(rows);
    else if (isMissingDeal(error)) {
      // Jedno usunięte rozdanie odrzuca cały wsad — wysyłamy po wierszu, żeby wskazać winnego.
      for (const row of rows) {
        const one = await supabase.from('srs_progress').upsert(row, { onConflict: 'user_id,deal_id' });
        if (!one.error || isMissingDeal(one.error)) drop([row]);
        else if (failed(one.error) && out.worst === 'offline') return out.worst;
      }
    } else if (failed(error) && out.worst === 'offline') return out.worst;
  }

  const op = snap.session;
  if (op) {
    let error: DbError = null;
    if (op.kind === 'clear') {
      ({ error } = await supabase.from('daily_sessions').delete().eq('user_id', userId).lte('date', op.day));
    } else if (toDateKey(op.row.date) === todayKey()) {
      ({ error } = await supabase.from('daily_sessions').upsert(op.row, { onConflict: 'user_id' }));
    } // kolejka z poprzedniej doby odpada (O3)
    if (!failed(error)) update(userId, b => (b.session === op ? { ...b, session: null } : b));
  }

  return out.worst;
}

/**
 * Wysyła kolejkę. Jedna wysyłka naraz — kolejne wywołania dostają tę samą obietnicę.
 * Hooki wołają to przed pobraniem danych: najpierw własne zapisy, potem świeży stan (O6).
 */
export function flushOutbox(userId: string): Promise<FlushResult> {
  attach(userId);
  if (inflight) return inflight;
  inflight = (async (): Promise<FlushResult> => {
    await ready;
    if (owner !== userId) return 'ok';
    let result: FlushResult = 'ok';
    if (!isEmpty(box)) {
      sending = true;
      emit();
      for (let round = 0; round < 5 && result === 'ok' && !isEmpty(box) && owner === userId; round++) {
        result = await sendOnce(userId);
      }
      sending = false;
    }
    if (owner === userId) {
      failure = result === 'ok' ? null : result;
      if (failure) stalled = true;
      else if (isEmpty(box)) stalled = false;
      emit();
    }
    return result;
  })().finally(() => {
    inflight = null;
    // Zapis, który wpadł tuż po ostatnim obrocie pętli, nie może czekać do następnej okazji.
    if (!paused && !failure && owner && !isEmpty(box)) void flushOutbox(owner);
  });
  return inflight;
}
