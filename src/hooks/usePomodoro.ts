import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_POMODORO_CONFIG, idle, parsePomodoro, parsePomodoroConfig, remainingMs, startBreak, startWork, stop, tick,
  type Pomodoro, type PomodoroConfig,
} from '../lib/pomodoro';

const storageKey = (userId: string | null) => `bridgeloop:pomodoro:v1:${userId ?? 'anon'}`;
const configKey = (userId: string | null) => `bridgeloop:pomodoro-config:v1:${userId ?? 'anon'}`;

function readConfig(userId: string | null): PomodoroConfig {
  try {
    const raw = window.localStorage.getItem(configKey(userId));
    return parsePomodoroConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_POMODORO_CONFIG;
  }
}

function read(userId: string | null, now: number): Pomodoro {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return parsePomodoro(raw ? JSON.parse(raw) : null, now);
  } catch {
    return idle(now);
  }
}

function write(userId: string | null, p: Pomodoro) {
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify(p)); } catch { /* bez pamięci lokalnej żyje tylko w karcie */ }
}

/** Krótki sygnał końca odcinka. Bez dźwięku (blokada autoodtwarzania, brak API) po prostu nic. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    osc.onended = () => { void ctx.close(); };
  } catch { /* brak dźwięku nie jest błędem */ }
  // Wibracja bez wcześniejszego dotknięcia strony jest blokowana (i Chrome loguje błąd) — wtedy pomijamy.
  try { if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(200); } catch { /* jw. */ }
}

/**
 * Pomidor dla konta. Stan i wybrane długości odcinków są w pamięci lokalnej (per konto), więc przeżywają
 * przeładowanie strony i wracają w innej karcie; czas liczy się od `endsAt`, nie od tyknięć. Tyka co
 * sekundę tylko wtedy, gdy jakiś odcinek biegnie.
 */
export function usePomodoro(userId: string | null) {
  const [state, setState] = useState<{ userId: string | null; p: Pomodoro; config: PomodoroConfig }>(
    () => ({ userId, p: read(userId, Date.now()), config: readConfig(userId) }),
  );
  const [now, setNow] = useState(() => Date.now());

  let { p, config } = state;
  if (state.userId !== userId) {
    p = read(userId, now);
    config = readConfig(userId);
    setState({ userId, p, config });
  }

  // Przejście wywołane UPŁYWEM czasu (koniec pracy, koniec przerwy) daje sygnał; akcje użytkownika — nie.
  const prevPhase = useRef(p.phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = p.phase;
    if ((prev === 'work' && p.phase === 'wrapup') || (prev === 'break' && p.phase === 'ready')) chime();
  }, [p.phase]);

  // Przejścia dostają aktualne ustawienia: nowy odcinek ma długość wybraną w chwili jego startu.
  const apply = useCallback((next: (cur: Pomodoro, t: number, cfg: PomodoroConfig) => Pomodoro) => {
    const t = Date.now();
    setState(cur => {
      const updated = next(cur.p, t, cur.config);
      if (updated === cur.p) return cur;
      write(userId, updated);
      return { ...cur, p: updated };
    });
    setNow(t);
  }, [userId]);

  const setConfig = useCallback((patch: Partial<PomodoroConfig>) => {
    setState(cur => {
      const updated = parsePomodoroConfig({ ...cur.config, ...patch });
      try { window.localStorage.setItem(configKey(userId), JSON.stringify(updated)); } catch { /* zostaje w karcie */ }
      return { ...cur, config: updated };
    });
  }, [userId]);

  const running = p.phase === 'work' || p.phase === 'break';
  useEffect(() => {
    if (!running) return;
    const onTick = () => apply(tick);
    const id = window.setInterval(onTick, 1000);
    // Powrót do karty: sprawdź od razu, nie czekaj na najbliższy tik (przeglądarka zwalnia timery w tle).
    document.addEventListener('visibilitychange', onTick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onTick); };
  }, [running, apply]);

  // Zmiana w innej karcie tej samej przeglądarki.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(userId)) setState(cur => ({ ...cur, p: read(userId, Date.now()) }));
      else if (e.key === configKey(userId)) setState(cur => ({ ...cur, config: readConfig(userId) }));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);

  return {
    phase: p.phase,
    done: p.done,
    config,
    setConfig,
    remaining: remainingMs(p, now),
    start: useCallback(() => apply(startWork), [apply]),
    beginBreak: useCallback(() => apply(startBreak), [apply]),
    stop: useCallback(() => apply(stop), [apply]),
  };
}

export type PomodoroApi = ReturnType<typeof usePomodoro>;
