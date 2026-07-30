import { useState } from 'react';
import type { GamePhase } from '../types';
import { Icon } from './Icon';

interface Props {
  phase: GamePhase;
  prompt: string;
  solutionText: string;
  onReveal: () => void;
  onCorrect: () => void;
  onWrong: () => void;
  /** Czas w trybie na czas dobiegł zera — wynik jest przesądzony, nie ma samooceny. */
  timedOut?: boolean;
}

function Chevron({ up }: { up: boolean }) {
  return <Icon name="chevron-down" size={14} strokeWidth={3} className={up ? 'rotate-180' : ''} />;
}

// Telefon w poziomie ma ~375 px wysokości: rozwinięty opis, dok i pasek nie mieszczą
// się tam razem ze stołem. Poniżej tego progu panel startuje zwinięty — treść jest
// o jedno stuknięcie dalej, ale diagram zostaje widoczny.
const SHORT_VIEWPORT = '(max-height: 500px)';
const startsExpanded = () => !window.matchMedia(SHORT_VIEWPORT).matches;

export function DecisionPanel({ phase, prompt, solutionText, onReveal, onCorrect, onWrong, timedOut }: Props) {
  // Na telefonie tekst i diagram konkurują o ten sam ekran: rozwinięty opis zostawia
  // filcowi ~225 px, przez co figury schodzą do ~8 px. Dlatego panel da się zwinąć do
  // paska — czytasz treść, zwijasz, analizujesz rozdanie w pełnej skali. Na desktopie
  // (md+) miejsca starczy na jedno i drugie, więc panel jest zawsze rozwinięty.
  const [expanded, setExpanded] = useState(startsExpanded);

  // Nowa treść (wejście w decyzję, potem odsłonięcie rozwiązania) zawsze rozwija panel.
  // Reset w trakcie renderu, nie w efekcie — brak dodatkowego przebiegu i migotania.
  const contentKey = `${phase}|${prompt}|${solutionText}`;
  const [seenKey, setSeenKey] = useState(contentKey);
  if (seenKey !== contentKey) {
    setSeenKey(contentKey);
    setExpanded(startsExpanded());
  }

  if (phase === 'intro' || phase === 'rated') return null;

  const revealed = phase === 'revealed';
  const body = revealed ? solutionText : prompt;

  return (
    <div
      className="slide-up flex min-h-0 flex-col border-t border-brand-line bg-brand-bg/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="flex w-full flex-shrink-0 items-center gap-2 px-4 pb-1 pt-2.5 text-left md:cursor-default md:px-6 md:pt-4"
      >
        <span className="text-base leading-none">{revealed ? '💡' : '🤔'}</span>
        <span className={`text-xs font-semibold uppercase tracking-wider ${revealed ? 'text-brand-accent-soft' : 'text-brand-accent-2'}`}>
          {revealed ? 'Rozwiązanie' : 'Moment decyzji'}
        </span>
        {!expanded && (
          <span className="min-w-0 flex-1 truncate text-xs text-brand-dim md:hidden">{body}</span>
        )}
        <span className="ml-auto text-brand-dim md:hidden">
          <Chevron up={expanded} />
        </span>
      </button>

      <div className={`min-h-0 overflow-y-auto px-4 md:!block md:px-6 ${expanded ? 'max-h-[32dvh] flex-1 pb-2' : 'hidden'}`}>
        <p className="text-sm leading-relaxed text-brand-text">{body}</p>
      </div>

      <div className="flex-shrink-0 px-4 pb-3 pt-2 md:px-6 md:pb-5">
        {revealed && timedOut ? (
          // Po zerze nie ma „jak Ci poszło" — wynik jest już przesądzony. Zostaje
          // przeczytanie rozwiązania i przejście dalej; klik zapisuje błąd.
          <>
            <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-red-300">
              <span>⏱</span>
              <span>Czas minął — zaliczone jako błąd</span>
            </div>
            <button
              onClick={onWrong}
              className="h-11 w-full rounded-[9px] border border-red-700 bg-red-900/70 text-sm font-semibold text-red-200 transition-colors hover:bg-red-800 md:mx-auto md:block md:w-auto md:px-8"
            >
              Dalej
            </button>
          </>
        ) : !revealed ? (
          <button
            onClick={onReveal}
            className="h-11 w-full rounded-[9px] bg-brand-accent font-display text-sm font-bold text-brand-btn-text shadow-lg shadow-black/30 transition-colors hover:bg-brand-accent-soft md:mx-auto md:block md:w-auto md:px-8"
          >
            Pokaż pełne rozwiązanie →
          </button>
        ) : (
          <>
            <div className="mb-2 text-center text-xs uppercase tracking-wider text-brand-dim">
              Jak Ci poszło?
            </div>
            <div className="flex gap-2.5 md:justify-center md:gap-3">
              <button
                onClick={onWrong}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-red-700 bg-red-900/70 text-sm font-semibold text-red-300 transition-colors hover:bg-red-800 hover:text-red-200 md:flex-none md:px-6"
              >
                <span>❌</span>
                <span>Mój błąd</span>
              </button>
              <button
                onClick={onCorrect}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-900/70 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-800 hover:text-emerald-200 md:flex-none md:px-6"
              >
                <span>✅</span>
                <span className="md:hidden">Dobrze</span>
                <span className="hidden md:inline">Rozwiązałem poprawnie</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
