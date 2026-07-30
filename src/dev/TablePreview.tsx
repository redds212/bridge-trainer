import { useState } from 'react';
import type { Deal } from '../types';
import { useGameState } from '../hooks/useGameState';
import { BridgeTable } from '../components/BridgeTable';
import { ControlPanel } from '../components/ControlPanel';
import { DecisionPanel } from '../components/DecisionPanel';
import { DealTimer } from '../components/DealTimer';
import mockDeals from '../data/dealsMock.json';

/**
 * Dev-only harness: montuje sam stół z rozdaniem mockowym, bez Supabase i bez
 * logowania — żeby dało się iterować nad układem (zwłaszcza mobilnym) i robić
 * zrzuty. Wchodzi tylko przez `?preview=table` w trybie dev; produkcyjny build
 * nie importuje tego pliku (dynamiczny import w main.tsx).
 */
export function TablePreview() {
  const deals = mockDeals as unknown as Deal[];
  const [index, setIndex] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const deal = deals[index];
  const { state, next, prev, rewind, revealSolution, setPhase } = useGameState(deal);

  if (!state) return null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-brand-bg">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-brand-line bg-brand-panel px-3 py-2">
        <span className="text-brand-accent-2 text-[10px] font-mono uppercase tracking-wider">preview</span>
        <span className="min-w-0 flex-1 truncate text-sm text-brand-text">{deal.title}</span>
        <button
          onClick={() => setShowTimer(t => !t)}
          className="rounded-[7px] border border-brand-line bg-brand-soft px-2 py-1 text-[11px] text-brand-dim"
        >
          Timer
        </button>
        <button
          onClick={() => setIndex(i => (i + 1) % deals.length)}
          className="rounded-[7px] border border-brand-line bg-brand-soft px-2 py-1 text-[11px] text-brand-dim"
        >
          Zmień rozdanie
        </button>
      </div>

      <div className="relative flex min-h-[min(240px,35dvh)] flex-1 flex-col p-2 md:min-h-0 md:p-3">
        <BridgeTable
          deal={deal}
          state={state}
          timer={<DealTimer remaining={72} limit={120} visible={showTimer} />}
        />
      </div>

      <ControlPanel
        phase={state.phase}
        currentStep={state.currentStep}
        totalSteps={deal.introSequence.length}
        isAnimating={state.isAnimating}
        onNext={next}
        onPrev={prev}
        onRewind={rewind}
      />

      <DecisionPanel
        phase={state.phase}
        prompt={deal.decisionPrompt}
        solutionText={deal.solution.text}
        onReveal={revealSolution}
        onCorrect={() => setPhase('rated')}
        onWrong={() => setPhase('rated')}
      />
    </div>
  );
}
