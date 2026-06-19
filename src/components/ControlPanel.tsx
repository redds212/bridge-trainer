import type { GamePhase } from '../types';

interface Props {
  phase: GamePhase;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onRewind: () => void;
}

export function ControlPanel({ phase, currentStep, totalSteps, onNext, onPrev, onRewind }: Props) {
  const atDecision = phase === 'decision' || phase === 'revealed' || phase === 'rated';
  const canPrev = currentStep > 0 && phase === 'intro';
  const canNext = !atDecision;

  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button
        onClick={onRewind}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-colors border border-slate-600"
      >
        <span>⏮</span>
        <span>RESTART</span>
      </button>

      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-colors border border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span>◀</span>
        <span>POPRZEDNI</span>
      </button>

      <div className="text-slate-500 text-xs font-mono w-16 text-center">
        {phase === 'intro' ? `${currentStep}/${totalSteps}` : atDecision ? '●' : ''}
      </div>

      <button
        onClick={onNext}
        disabled={!canNext}
        className={`flex items-center gap-1.5 px-6 py-2 rounded-lg text-sm font-semibold transition-all border ${
          canNext
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-900/40'
            : 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed opacity-30'
        }`}
      >
        <span>NEXT</span>
        <span>▶</span>
      </button>
    </div>
  );
}
