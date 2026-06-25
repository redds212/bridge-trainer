import type { GamePhase } from '../types';

interface Props {
  phase: GamePhase;
  currentStep: number;
  totalSteps: number;
  isAnimating: boolean;
  onNext: () => void;
  onPrev: () => void;
  onRewind: () => void;
}

export function ControlPanel({ phase, currentStep, totalSteps, isAnimating, onNext, onPrev, onRewind }: Props) {
  const atDecision = phase === 'decision' || phase === 'revealed' || phase === 'rated';
  // Allow stepping back through tricks also at the decision moment (review before solving).
  const canPrev = currentStep > 0 && !isAnimating && (phase === 'intro' || phase === 'decision');
  const canNext = !atDecision && !isAnimating;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-3 px-2 flex-shrink-0">
      <button
        onClick={onRewind}
        className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-[9px] bg-brand-soft hover:bg-brand-line/60 text-brand-dim hover:text-brand-text text-sm font-medium transition-colors border border-brand-line"
      >
        <span>⏮</span>
        <span>RESTART</span>
      </button>

      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-[9px] bg-brand-soft hover:bg-brand-line/60 text-brand-dim hover:text-brand-text text-sm font-medium transition-colors border border-brand-line disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span>◀</span>
        <span>POPRZEDNI</span>
      </button>

      <div className="text-brand-dim text-xs font-mono w-10 md:w-16 text-center">
        {phase === 'intro' ? `${currentStep}/${totalSteps}` : atDecision ? '●' : ''}
      </div>

      <button
        onClick={onNext}
        disabled={!canNext}
        className={`flex items-center gap-1.5 px-4 md:px-6 py-2 rounded-[9px] text-sm font-semibold transition-all border ${
          canNext
            ? 'bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text border-brand-accent shadow-lg shadow-black/30'
            : 'bg-brand-soft text-brand-dim border-brand-line cursor-not-allowed opacity-30'
        }`}
      >
        <span>NEXT</span>
        <span>▶</span>
      </button>
    </div>
  );
}
