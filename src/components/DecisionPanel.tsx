import type { GamePhase } from '../types';

interface Props {
  phase: GamePhase;
  prompt: string;
  solutionText: string;
  onReveal: () => void;
  onCorrect: () => void;
  onWrong: () => void;
}

export function DecisionPanel({ phase, prompt, solutionText, onReveal, onCorrect, onWrong }: Props) {
  if (phase === 'intro' || phase === 'rated') return null;

  return (
    // On mobile cap the height and scroll inside, so the answer buttons stay reachable
    // and the panel never pushes the controls off-screen.
    <div className="slide-up border-t border-brand-line bg-brand-bg/95 flex-shrink-0 max-h-[55dvh] overflow-y-auto md:max-h-none md:overflow-visible">
      {phase === 'decision' && (
        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="text-brand-accent-2 text-2xl mt-0.5">🤔</div>
            <div className="flex-1">
              <div className="text-brand-accent-2 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Moment decyzji
              </div>
              <p className="text-brand-text text-sm leading-relaxed">{prompt}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-center">
            <button
              onClick={onReveal}
              className="px-8 py-3 bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text rounded-[9px] font-display font-bold text-sm transition-colors shadow-lg shadow-black/30"
            >
              Pokaż pełne rozwiązanie →
            </button>
          </div>
        </div>
      )}

      {phase === 'revealed' && (
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-brand-accent-soft text-2xl mt-0.5">💡</div>
            <div className="flex-1">
              <div className="text-brand-accent-soft text-xs font-semibold uppercase tracking-wider mb-1.5">
                Rozwiązanie
              </div>
              <p className="text-brand-text text-sm leading-relaxed">{solutionText}</p>
            </div>
          </div>
          <div className="border-t border-brand-line pt-4">
            <div className="text-brand-dim text-xs text-center mb-3 uppercase tracking-wider">
              Jak Ci poszło?
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onWrong}
                className="flex items-center gap-2 px-6 py-3 bg-red-900/70 hover:bg-red-800 text-red-300 hover:text-red-200 rounded-lg font-semibold text-sm transition-colors border border-red-700"
              >
                <span>❌</span>
                <span>Mój Błąd</span>
              </button>
              <button
                onClick={onCorrect}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-900/70 hover:bg-emerald-800 text-emerald-300 hover:text-emerald-200 rounded-lg font-semibold text-sm transition-colors border border-emerald-700"
              >
                <span>✅</span>
                <span>Rozwiązałem Poprawnie</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
