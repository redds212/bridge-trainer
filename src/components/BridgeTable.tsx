import type { Deal } from '../types';
import type { GameState } from '../hooks/useGameState';
import { HandDisplay } from './HandDisplay';
import { TrickDisplay } from './TrickDisplay';
import { BiddingTable } from './BiddingTable';
import { ContractBox } from './ContractBox';

interface Props {
  deal: Deal;
  state: GameState;
}

export function BridgeTable({ deal, state }: Props) {
  return (
    <div className="relative h-full w-full bg-felt rounded-xl border border-felt-dark shadow-2xl overflow-hidden">
      {/* Felt texture overlay */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      />

      {/* Bidding table — top right */}
      <div className="absolute top-3 right-3 z-10 w-44">
        <BiddingTable bidding={deal.bidding} dealer={deal.dealer} />
      </div>

      {/* Contract box — bottom right */}
      <div className="absolute bottom-3 right-3 z-10">
        <ContractBox
          contract={deal.contract}
          declarer={deal.declarer}
          trickScores={state.trickScores}
          vulnerability={deal.vulnerability}
        />
      </div>

      {/* Category + difficulty — top left */}
      <div className="absolute top-3 left-3 z-10 flex flex-row gap-1 items-center">
        <span className="text-[10px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded border border-slate-600">
          {deal.category}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
          deal.difficulty === 'Easy' ? 'bg-emerald-900/60 text-emerald-400 border-emerald-700' :
          deal.difficulty === 'Medium' ? 'bg-yellow-900/60 text-yellow-400 border-yellow-700' :
          'bg-red-900/60 text-red-400 border-red-700'
        }`}>
          {deal.difficulty}
        </span>
      </div>

      {/* Cross layout: N top, S bottom, W left, E right */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 pt-20">

        {/* North */}
        <HandDisplay seat="N" hand={state.hands['N']} />

        <div className="flex items-center gap-2">
          {/* West */}
          <HandDisplay seat="W" hand={state.hands['W']} />

          {/* Center: trick area */}
          <div className="bg-felt-dark/60 rounded-xl border border-felt-dark w-24 h-24 flex items-center justify-center shadow-inner flex-shrink-0">
            <TrickDisplay
              visibleTrick={state.visibleTrick as Partial<Record<import('../types').Seat, string>>}
              leader={state.currentTrickLeader as import('../types').Seat | null}
            />
          </div>

          {/* East */}
          <HandDisplay seat="E" hand={state.hands['E']} />
        </div>

        {/* South */}
        <HandDisplay seat="S" hand={state.hands['S']} />
      </div>
    </div>
  );
}
