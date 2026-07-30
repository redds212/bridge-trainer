import { useCallback, useSyncExternalStore } from 'react';

/**
 * Instalacja PWA w dwóch smakach.
 *
 * Android/Chrome: przeglądarka sama zgłasza `beforeinstallprompt`, a my odkładamy
 * zdarzenie na później i wywołujemy je z własnego przycisku. Zdarzenie leci RAZ,
 * zaraz po starcie — dlatego nasłuch siedzi na poziomie modułu, a nie w efekcie
 * komponentu, który mógłby się zamontować za późno i przegapić je na zawsze.
 *
 * iOS/Safari: takiego zdarzenia nie ma i nie da się wywołać instalacji z kodu.
 * Zostaje instrukcja „Udostępnij → Dodaj do ekranu początkowego".
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'bridgeloop.install.dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false; // tryb prywatny / zablokowane storage — trudno, pokażemy baner
  }
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    // Safari na iOS nie wspiera `display-mode`, ma własną flagę.
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// iPadOS 13+ podaje się za macOS — rozróżnia je dopiero obecność ekranu dotykowego.
const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua)
  || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

let deferred: BeforeInstallPromptEvent | null = null;
let installed = isStandalone();
let dismissed = readDismissed();
// Natywne okno instalacji zostało pokazane i zamknięte bez instalacji. Trzymamy to
// osobno, bo `deferred` musi wtedy i tak wylecieć (zdarzenia nie da się użyć drugi
// raz), a bez tej flagi panel wpadał w komunikat „ta przeglądarka nie zgłasza
// możliwości instalacji" — pokazywany komuś, kto właśnie odrzucił propozycję.
let promptDeclined = false;

// Licznik wersji zamiast obiektu-migawki: useSyncExternalStore porównuje wynik
// referencyjnie, więc świeży obiekt przy każdym odczycie zapętliłby render.
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const getSnapshot = () => version;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // bez tego Chrome pokazuje własny pasek w swoim momencie
  deferred = e as BeforeInstallPromptEvent;
  promptDeclined = false; // przeglądarka znów proponuje instalację
  emit();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  installed = true;
  emit();
});

export interface InstallPrompt {
  /** Jest co pokazać: natywny prompt albo instrukcja dla iOS. */
  available: boolean;
  /** iOS — instalacji nie da się wywołać kodem, trzeba pokazać kroki ręczne. */
  needsManualSteps: boolean;
  /** Aplikacja już działa jako zainstalowana (albo właśnie ją zainstalowano). */
  installed: boolean;
  /** Użytkownik schował baner; przycisk w panelu i tak zostaje dostępny. */
  dismissed: boolean;
  /** Natywne okno instalacji zostało odrzucone — pomoże odświeżenie strony. */
  promptDeclined: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismiss: () => void;
}

export function useInstallPrompt(): InstallPrompt {
  useSyncExternalStore(subscribe, getSnapshot);

  const install = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    const event = deferred;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Zdarzenia nie da się użyć drugi raz; przy odmowie Chrome przyśle nowe przy
    // kolejnej nawigacji — do tego czasu mówimy o tym wprost zamiast udawać, że
    // przeglądarka nie wspiera instalacji.
    deferred = null;
    if (outcome !== 'accepted') promptDeclined = true;
    emit();
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    dismissed = true;
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* nie szkodzi */ }
    emit();
  }, []);

  return {
    available: !installed && (deferred !== null || isIOS),
    needsManualSteps: isIOS && deferred === null,
    installed,
    dismissed,
    promptDeclined,
    install,
    dismiss,
  };
}
