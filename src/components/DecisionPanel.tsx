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
    <div className="slide-up border-t border-slate-700 bg-slate-900/95">
      {phase === 'decision' && (
        <div className="px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="text-yellow-400 text-xl mt-0.5">🤔</div>
            <div className="flex-1">
              <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Moment decyzji
              </div>
              <p className="text-slate-200 text-sm leading-relaxed">{prompt}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button
              onClick={onReveal}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors shadow-lg shadow-blue-900/40 border border-blue-500"
            >
              Pokaż pełne rozwiązanie →
            </button>
          </div>
        </div>
      )}

      {phase === 'revealed' && (
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-emerald-400 text-xl mt-0.5">💡</div>
            <div className="flex-1">
              <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Rozwiązanie
              </div>
              <p className="text-slate-200 text-sm leading-relaxed">{solutionText}</p>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-4">
            <div className="text-slate-400 text-xs text-center mb-3 uppercase tracking-wider">
              Jak Ci poszło?
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onWrong}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-900/70 hover:bg-red-800 text-red-300 hover:text-red-200 rounded-lg font-semibold text-sm transition-colors border border-red-700"
              >
                <span>❌</span>
                <span>Mój Błąd</span>
              </button>
              <button
                onClick={onCorrect}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-900/70 hover:bg-emerald-800 text-emerald-300 hover:text-emerald-200 rounded-lg font-semibold text-sm transition-colors border border-emerald-700"
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
