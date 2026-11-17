import { useEffect, useRef } from 'react';

/**
 * Przejście na nową wersję aplikacji bez ręcznego zamykania.
 *
 * Service worker z `skipWaiting` + `clientsClaim` instaluje nową wersję sam, ale
 * otwarta karta dalej wykonuje kod, z którym wystartowała. iPhone potrafi trzymać
 * aplikację z ekranu początkowego w pamięci całymi dniami, więc bez przeładowania
 * stara wersja żyła aż do wyrzucenia aplikacji z listy otwartych.
 *
 * Moduł pilnuje, kiedy nowy worker przejmie stronę (`controllerchange` przy już
 * istniejącym kontrolerze), a hook przeładowuje stronę tylko w bezpiecznym momencie:
 * zaraz po wejściu do aplikacji albo powrocie z tła, gdy na stole nie ma rozdania
 * w toku ani aktywnej sesji. Oceny i stan sesji leżą wtedy w IndexedDB, więc
 * przeładowanie niczego nie gubi.
 */

const supported = import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

/** Tyle po starcie albo powrocie z tła przeładowanie jest jeszcze „niezauważalne". */
const RESUME_WINDOW_MS = 10_000;
/** Ochrona przed pętlą przeładowań, gdyby coś poszło nie tak z workerem. */
const RELOAD_GUARD_KEY = 'bridgeloop.updateReloadAt';
const RELOAD_GUARD_MS = 60_000;

let updateReady = false;
let resumedAt = Date.now();
const listeners = new Set<() => void>();

if (supported) {
  // Pierwsza instalacja też wywołuje `controllerchange` (clientsClaim), ale wtedy
  // strona nie miała kontrolera i działa już na najnowszym kodzie.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    updateReady = true;
    listeners.forEach(fn => fn());
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    resumedAt = Date.now();
    // Powrót z tła to dobra chwila, żeby zapytać serwer o nową wersję — bez tego
    // przeglądarka sprawdza ją tylko przy nawigacji, a tej w otwartej aplikacji nie ma.
    if (navigator.onLine) {
      void navigator.serviceWorker.getRegistration().then(reg => reg?.update()).catch(() => {});
    }
    listeners.forEach(fn => fn());
  });
}

function recentlyReloaded(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    return Date.now() - at < RELOAD_GUARD_MS;
  } catch {
    return false;
  }
}

function reloadNow() {
  try { sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now())); } catch { /* bez ochrony */ }
  window.location.reload();
}

/** `safe`: na stole nie ma pracy, którą przeładowanie by przerwało. */
export function useAppUpdate(safe: boolean) {
  const safeRef = useRef(safe);

  useEffect(() => {
    if (!supported) return;
    const check = () => {
      if (!updateReady || !safeRef.current) return;
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - resumedAt > RESUME_WINDOW_MS) return; // poczeka do następnego powrotu
      if (recentlyReloaded()) return;
      reloadNow();
    };
    listeners.add(check);
    check();
    return () => { listeners.delete(check); };
  }, []);

  // Rozdanie skończone tuż po powrocie z tła — też dobra chwila.
  useEffect(() => {
    safeRef.current = safe;
    if (!supported || !safe) return;
    listeners.forEach(fn => fn());
  }, [safe]);
}
