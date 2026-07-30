import type { GamePhase } from '../types';
import { Icon } from './Icon';

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

  // Kciukowy dok: na telefonie ikony 44 px + szerokie NEXT (jedyny przycisk
  // wciskany kilkanaście razy pod rząd). Na desktopie wracają etykiety.
  const secondary = 'flex h-11 items-center justify-center gap-1.5 rounded-[9px] border border-brand-line bg-brand-soft px-3 text-sm font-medium text-brand-dim transition-colors hover:bg-brand-line/60 hover:text-brand-text disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center gap-2 px-2 pt-2 md:gap-3 md:pt-3"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <button onClick={onRewind} aria-label="Restart" title="Restart" className={`${secondary} w-11 md:w-auto`}>
        <Icon name="restart" size={15} />
        <span className="hidden md:inline">RESTART</span>
      </button>

      <button onClick={onPrev} disabled={!canPrev} aria-label="Poprzedni" title="Poprzedni" className={`${secondary} w-11 md:w-auto`}>
        <Icon name="chevron-left" size={15} strokeWidth={2.5} />
        <span className="hidden md:inline">POPRZEDNI</span>
      </button>

      <div className="w-9 flex-shrink-0 text-center font-mono text-xs text-brand-dim md:w-16">
        {phase === 'intro' ? `${currentStep}/${totalSteps}` : atDecision ? '●' : ''}
      </div>

      <button
        onClick={onNext}
        disabled={!canNext}
        className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[9px] border text-sm font-semibold transition-all md:h-auto md:flex-none md:px-6 md:py-2 ${
          canNext
            ? 'bg-brand-accent hover:bg-brand-accent-soft text-brand-btn-text border-brand-accent shadow-lg shadow-black/30'
            : 'bg-brand-soft text-brand-dim border-brand-line cursor-not-allowed opacity-30'
        }`}
      >
        <span>NEXT</span>
        <Icon name="chevron-right" size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}
