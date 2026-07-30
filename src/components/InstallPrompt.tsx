import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * Kroki instalacji dla iOS — Safari nie daje żadnego API, więc zostaje pokazanie
 * palcem, gdzie kliknąć. Ikona udostępniania jest narysowana, bo po samym opisie
 * słownym trudno ją znaleźć wzrokiem na pasku.
 */
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-3px]">
      <path d="M12 16V4" />
      <polyline points="8 8 12 4 16 8" />
      <path d="M6 12H5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function IosInstructions({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-brand-panel border border-brand-line rounded-2xl p-6 max-w-sm w-full shadow-2xl slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-brand-text font-bold text-lg mb-1">Dodaj do ekranu początkowego</h2>
        <p className="text-brand-dim text-xs mb-4">
          Na iPhonie instalację uruchamia się z menu Safari — przeglądarka nie pozwala zrobić tego przyciskiem.
        </p>
        <ol className="space-y-3 text-sm text-brand-text">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-soft text-brand-accent-soft text-[11px] font-bold flex items-center justify-center">1</span>
            <span>Stuknij <ShareIcon /> <span className="text-brand-dim">Udostępnij</span> na dolnym pasku Safari.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-soft text-brand-accent-soft text-[11px] font-bold flex items-center justify-center">2</span>
            <span>Przewiń listę i wybierz <span className="text-brand-text font-medium">Do ekranu początkowego</span>.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-soft text-brand-accent-soft text-[11px] font-bold flex items-center justify-center">3</span>
            <span>Potwierdź <span className="text-brand-text font-medium">Dodaj</span> — ikona wyląduje obok innych aplikacji.</span>
          </li>
        </ol>
        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-[9px] bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold text-sm transition-colors"
        >
          Jasne
        </button>
      </div>
    </div>
  );
}

/**
 * Pasek nad stołem: jedyne miejsce widoczne bez otwierania szuflady. Znika po
 * instalacji albo po „×" (na stałe), więc nie zabiera wysokości w kółko.
 */
export function InstallBanner() {
  const { available, dismissed, needsManualSteps, install, dismiss } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  if (!available || dismissed) return null;

  return (
    <>
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-brand-line bg-brand-soft px-3 py-2">
        <span className="text-base leading-none">📲</span>
        <div className="min-w-0 flex-1">
          <div className="text-brand-text text-xs font-medium leading-tight">Zainstaluj BridgeLoop</div>
          <div className="text-brand-dim text-[10px] leading-tight">Pełny ekran, ikona na pulpicie, szybszy start</div>
        </div>
        <button
          onClick={() => (needsManualSteps ? setShowSteps(true) : void install())}
          className="flex-shrink-0 px-3 h-8 rounded-[7px] bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text font-display font-bold text-xs transition-colors"
        >
          Zainstaluj
        </button>
        <button
          onClick={dismiss}
          aria-label="Ukryj propozycję instalacji"
          className="flex-shrink-0 w-8 h-8 rounded-[7px] text-brand-dim hover:text-brand-text hover:bg-brand-line/50 transition-colors"
        >
          ×
        </button>
      </div>
      {showSteps && <IosInstructions onClose={() => setShowSteps(false)} />}
    </>
  );
}

/**
 * Wersja stała, w „Mój panel" — dla kogoś, kto baner zamknął i po miesiącu
 * zmienił zdanie. Styl slate, bo panel nie został jeszcze przeniesiony na tokeny brand.
 */
export function InstallCard() {
  const { available, needsManualSteps, installed, install } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  return (
    <section className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-slate-200 font-semibold text-sm mb-1">Aplikacja</h2>
      {installed ? (
        <p className="text-emerald-400/90 text-sm">✓ BridgeLoop działa jako zainstalowana aplikacja.</p>
      ) : available ? (
        <>
          <p className="text-slate-400 text-xs mb-3">
            Zainstaluj BridgeLoop na telefonie: uruchamia się na pełnym ekranie, bez paska adresu,
            z własną ikoną obok pozostałych aplikacji.
          </p>
          <button
            onClick={() => (needsManualSteps ? setShowSteps(true) : void install())}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            {needsManualSteps ? 'Jak zainstalować?' : 'Zainstaluj aplikację'}
          </button>
        </>
      ) : (
        <p className="text-slate-400 text-xs">
          Ta przeglądarka nie zgłasza możliwości instalacji. Na telefonie otwórz bridgeloop.pl
          w Chrome (Android) lub Safari (iPhone) — tam pojawi się propozycja instalacji.
        </p>
      )}
      {showSteps && <IosInstructions onClose={() => setShowSteps(false)} />}
    </section>
  );
}
