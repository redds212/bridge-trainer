/**
 * Pomidor: odcinek treningu (15/20/25 min) i przerwa (1/3/5 min). Czysta maszyna stanów liczona od czasu ściennego
 * (`endsAt`), więc karta w tle, uśpiony telefon ani przeładowanie strony nie wydłużają odcinka.
 *
 *   idle ──start──▶ work ──czas──▶ wrapup ──koniec rozdania──▶ break ──czas──▶ ready
 *                    ▲                                           │              │
 *                    └──────────────── next (pomiń / kolejny) ───┴──────────────┘
 *
 * `wrapup`: czas pracy minął, ale rozdanie jest w toku — dokańczasz je, przerwa zaczyna się po
 * ocenie. Przerwanie w pół rozdania kasowałoby przemyślenie, a wynik i tak nie byłby zapisany.
 * Licznik `done` (ukończone pomidory) liczy się w obrębie lokalnej doby.
 */
export const WORK_OPTIONS = [15, 20, 25] as const;
export const BREAK_OPTIONS = [1, 3, 5] as const;
export type WorkMinutes = (typeof WORK_OPTIONS)[number];
export type BreakMinutes = (typeof BREAK_OPTIONS)[number];

/** Długości odcinków wybrane w panelu użytkownika. Zmiana działa od NASTĘPNEGO odcinka. */
export interface PomodoroConfig {
  workMin: WorkMinutes;
  breakMin: BreakMinutes;
}

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = { workMin: 15, breakMin: 3 };

/** Odczyt ustawień: wartość spoza listy wyboru wraca do domyślnej (osobno dla nauki i przerwy). */
export function parsePomodoroConfig(raw: unknown): PomodoroConfig {
  const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const workMin = WORK_OPTIONS.find(v => v === r.workMin) ?? DEFAULT_POMODORO_CONFIG.workMin;
  const breakMin = BREAK_OPTIONS.find(v => v === r.breakMin) ?? DEFAULT_POMODORO_CONFIG.breakMin;
  return { workMin, breakMin };
}

export function pomodoroHint(cfg: PomodoroConfig): string {
  return `Pomidor: ${cfg.workMin} min treningu (sesja, potem partie), ${cfg.breakMin} min przerwy`;
}

/** Zapisany stan starszy niż to (licząc od końca odcinka) jest porzucony — nikt już na niego nie czeka. */
export const STALE_MS = 60 * 60_000;

export type PomodoroPhase = 'idle' | 'work' | 'wrapup' | 'break' | 'ready';

export interface Pomodoro {
  phase: PomodoroPhase;
  /** Koniec bieżącego odcinka (ms) — tylko `work` i `break`. */
  endsAt: number | null;
  /** Ukończone dziś pomidory. */
  done: number;
  /** Lokalna doba, której dotyczy `done` (YYYY-MM-DD). */
  day: string;
}

export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function idle(now: number, done = 0): Pomodoro {
  return { phase: 'idle', endsAt: null, done, day: dayKey(now) };
}

/** Licznik `done` z poprzedniej doby wraca do zera. */
function todayDone(p: Pomodoro, now: number): number {
  return p.day === dayKey(now) ? p.done : 0;
}

/** Start albo kolejny odcinek pracy (także „Pomiń przerwę"). */
export function startWork(p: Pomodoro, now: number, cfg: PomodoroConfig = DEFAULT_POMODORO_CONFIG): Pomodoro {
  return { phase: 'work', endsAt: now + cfg.workMin * 60_000, done: todayDone(p, now), day: dayKey(now) };
}

/** Rozdanie skończone po upływie czasu pracy — liczymy pomidora i zaczynamy przerwę. */
export function startBreak(p: Pomodoro, now: number, cfg: PomodoroConfig = DEFAULT_POMODORO_CONFIG): Pomodoro {
  if (p.phase !== 'wrapup' && p.phase !== 'work') return p;
  return { phase: 'break', endsAt: now + cfg.breakMin * 60_000, done: todayDone(p, now) + 1, day: dayKey(now) };
}

export function stop(p: Pomodoro, now: number): Pomodoro {
  return idle(now, todayDone(p, now));
}

/** Upływ czasu: praca → dokończenie rozdania, przerwa → gotowość do kolejnego pomidora. */
export function tick(p: Pomodoro, now: number): Pomodoro {
  if (p.endsAt === null || now < p.endsAt) return p;
  if (p.phase === 'work') return { ...p, phase: 'wrapup', endsAt: null };
  if (p.phase === 'break') return { ...p, phase: 'ready', endsAt: null };
  return p;
}

export function remainingMs(p: Pomodoro, now: number): number {
  return p.endsAt === null ? 0 : Math.max(0, p.endsAt - now);
}

export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Odczyt z pamięci lokalnej: wszystko, co nie jest poprawnym stanem, daje `idle`. Stan, którego
 * odcinek skończył się dawno (np. przerwa zostawiona na noc), też wraca do `idle` z licznikiem doby.
 */
export function parsePomodoro(raw: unknown, now: number): Pomodoro {
  if (!raw || typeof raw !== 'object') return idle(now);
  const r = raw as Record<string, unknown>;
  const phases: PomodoroPhase[] = ['idle', 'work', 'wrapup', 'break', 'ready'];
  if (!phases.includes(r.phase as PomodoroPhase)) return idle(now);
  const day = typeof r.day === 'string' ? r.day : dayKey(now);
  const done = typeof r.done === 'number' && Number.isFinite(r.done) && r.done >= 0 ? Math.floor(r.done) : 0;
  const endsAt = typeof r.endsAt === 'number' && Number.isFinite(r.endsAt) ? r.endsAt : null;
  const phase = r.phase as PomodoroPhase;
  const p: Pomodoro = { phase, endsAt: phase === 'work' || phase === 'break' ? endsAt : null, done, day };
  if ((phase === 'work' || phase === 'break') && p.endsAt === null) return idle(now, todayDone(p, now));
  if (phase === 'idle') return idle(now, todayDone(p, now));
  // `wrapup` i `ready` nie mają końca; za świeżość wystarcza ta sama doba.
  if ((phase === 'wrapup' || phase === 'ready') && day !== dayKey(now)) return idle(now);
  if (p.endsAt !== null && now - p.endsAt > STALE_MS) return idle(now, todayDone(p, now));
  return tick(p, now);
}

/** Czy przycisk startu ma sens: pomidor nie biegnie (przerwa ma własne okno z „Kolejny"). */
export function canStartPomodoro(phase: PomodoroPhase): boolean {
  return phase === 'idle' || phase === 'ready';
}

/** To, czego pomidor potrzebuje od sesji (podzbiór `useDailySession`). */
export interface TrainingControls {
  active: boolean;
  pausedProgress: unknown;
  todayQueue: readonly string[];
  extraSize: number;
  resume: () => void;
  start: () => void;
  startExtra: () => void;
}

/** Czy jest z czego trenować: trwająca lub wstrzymana sesja, kolejka na dziś albo partia do wylosowania. */
export function canTrain(s: TrainingControls): boolean {
  return s.active || !!s.pausedProgress || s.todayQueue.length > 0 || s.extraSize > 0;
}

/**
 * Wejście w trening dla pomidora: wznów wstrzymaną sesję (lub partię), inaczej zacznij dzisiejszą
 * sesję, a gdy na dziś nic nie zostało — wylosuj partię. Trwającej sesji nie rusza.
 */
export function startTraining(s: TrainingControls): void {
  if (s.active) return;
  if (s.pausedProgress) s.resume();
  else if (s.todayQueue.length > 0) s.start();
  else if (s.extraSize > 0) s.startExtra();
}
