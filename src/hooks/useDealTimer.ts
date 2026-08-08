import { useState, useEffect, useRef, useCallback } from 'react';
import type { GamePhase } from '../types';

// Limit czasu (w sekundach) zależny od opanowania rozdania — indeks = consecutiveCorrect.
// 0 (nowe) → 2:00, rośnie presja aż do 0:15 dla opanowanego rozdania (4).
export const TIMED_LIMITS = [120, 75, 45, 25, 15] as const;

export function timeLimitForLevel(consecutiveCorrect: number): number {
  const i = Math.max(0, Math.min(TIMED_LIMITS.length - 1, Math.round(consecutiveCorrect)));
  return TIMED_LIMITS[i];
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

interface Options {
  /** Tryb na czas włączony i mamy załadowane rozdanie. */
  enabled: boolean;
  phase: GamePhase | undefined;
  limitSeconds: number;
  /** Zmiana resetuje timer (zwykle id rozdania). */
  resetKey: string | null;
  /** Wywoływane raz, gdy czas dobiegnie zera. */
  onExpire: () => void;
}

/**
 * Odliczanie per rozdanie. Start w chwili wejścia w fazę `decision`; biegnie
 * dalej bez pauzy nawet przy przeglądaniu lew wstecz (POPRZEDNI → faza `intro`).
 * Zatrzymuje się po odsłonięciu rozwiązania/ocenie albo po wyzerowaniu (→ onExpire).
 * RESTART (`suspendUntilDecision`) zdejmuje licznik z ekranu I wstrzymuje odliczanie
 * aż do ponownego wejścia w moment decyzji — schowany zegar nie może więc dojechać
 * do zera i zapisać błędu za plecami użytkownika. Po powrocie wznawia od tego, co
 * zostało (RESTART nie fabrykuje świeżego czasu).
 *
 * Reset i „start" korygują stan w trakcie renderu (wzorzec React na resetowanie
 * stanu przy zmianie propsów) — dzięki temu nie ma migotania między klatkami.
 */
export function useDealTimer({ enabled, phase, limitSeconds, resetKey, onExpire }: Options) {
  const [remaining, setRemaining] = useState(limitSeconds);
  const [started, setStarted] = useState(false);
  const [expired, setExpired] = useState(false);
  // RESTART cofa na początek rozdania, więc licznik schodzi z ekranu i staje; wraca
  // dopiero przy ponownym wejściu w moment decyzji — tam, gdzie pokazuje się normalnie.
  const [suspended, setSuspended] = useState(false);
  // Sygnatura biegu — jej zmiana oznacza nowe rozdanie / limit / przełączenie trybu.
  const [signature, setSignature] = useState(`${resetKey}|${limitSeconds}|${enabled}`);

  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; });

  const nextSignature = `${resetKey}|${limitSeconds}|${enabled}`;
  if (nextSignature !== signature) {
    setSignature(nextSignature);
    setStarted(false);
    setExpired(false);
    setSuspended(false);
    setRemaining(limitSeconds);
  } else if (enabled && phase === 'decision') {
    // Zatrzask startu przy pierwszym wejściu w moment decyzji; każde kolejne
    // wejście (po RESTARCIE) wznawia wstrzymany licznik.
    if (!started && !expired) setStarted(true);
    if (suspended) setSuspended(false);
  }

  const finished = phase === 'revealed' || phase === 'rated';
  const active = enabled && started && !expired && !finished && !suspended;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id);
          setExpired(true);
          onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  const visible = enabled && started && !finished && !suspended;

  /** RESTART: chowa licznik i wstrzymuje go do ponownego wejścia w moment decyzji. */
  const suspendUntilDecision = useCallback(() => setSuspended(true), []);

  // `expired` wychodzi na zewnątrz, bo o wyniku decyduje teraz nie użytkownik, tylko
  // zegar: wyzerowanie zalicza rozdanie jako błąd. RESTART naciśnięty PO wyzerowaniu
  // tego nie kasuje — sygnatura biegu nie zależy od fazy, więc powrót na początek nie
  // daje świeżego czasu (rozwiązanie i tak zostało już pokazane). Kasuje natomiast
  // ryzyko wyzerowania w przyszłości: wstrzymany licznik nie tyka.
  return { remaining, visible, expired, suspendUntilDecision };
}
