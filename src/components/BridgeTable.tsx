import type { Deal } from '../types';
import type { GameState } from '../hooks/useGameState';
import { HandDisplay } from './HandDisplay';
import { TrickDisplay } from './TrickDisplay';
import { BiddingTable } from './BiddingTable';
import { ContractBox } from './ContractBox';

type Seat = import('../types').Seat;

function buildPlayedBySeat(state: GameState): Partial<Record<Seat, string[]>> {
  const sets: Partial<Record<Seat, Set<string>>> = {};
  const add = (seat: string, card: string) => {
    (sets[seat as Seat] ??= new Set()).add(card);
  };
  for (const trick of state.tricks) {
    for (const [seat, card] of Object.entries(trick.cards)) {
      if (card) add(seat, card);
    }
  }
  for (const [seat, card] of Object.entries(state.visibleTrick)) {
    if (card) add(seat, card);
  }
  const result: Partial<Record<Seat, string[]>> = {};
  for (const [seat, set] of Object.entries(sets)) {
    result[seat as Seat] = [...set];
  }
  return result;
}

function buildKnownVoids(state: GameState): Partial<Record<Seat, Set<string>>> {
  const voids: Partial<Record<Seat, Set<string>>> = {};
  const addVoid = (seat: Seat, suit: string) => {
    (voids[seat] ??= new Set()).add(suit);
  };
  const checkTrick = (leader: Seat | null, cards: Partial<Record<Seat, string>>) => {
    if (!leader) return;
    const ledCard = cards[leader];
    if (!ledCard) return;
    const ledSuit = ledCard[0];
    for (const [seat, card] of Object.entries(cards) as [Seat, string][]) {
      if (seat === leader || !card) continue;
      if (card[0] !== ledSuit) addVoid(seat, ledSuit);
    }
  };
  for (const trick of state.tricks) {
    checkTrick(trick.leader as Seat, trick.cards as Partial<Record<Seat, string>>);
  }
  checkTrick(state.currentTrickLeader, state.visibleTrick);
  return voids;
}

interface Props {
  deal: Deal;
  state: GameState;
}

export function BridgeTable({ deal, state }: Props) {
  const playedBySeat = buildPlayedBySeat(state);
  const knownVoids = buildKnownVoids(state);

  return (
    // Mobile: vertical scrollable stack. Desktop (md+): felt with absolute-positioned elements.
    <div className="relative h-full w-full bg-felt rounded-xl border border-felt-dark shadow-2xl overflow-x-hidden overflow-y-auto md:overflow-hidden flex flex-col md:block">
      {/* Felt texture overlay (desktop only) */}
      <div className="hidden md:block absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      />

      {/* Category + difficulty */}
      <div className="md:absolute md:top-3 md:left-3 z-10 flex flex-row gap-1 items-center p-2 md:p-0 flex-shrink-0">
        <span className="text-[10px] bg-slate-800/80 text-slate-400 px-1.5 py-0.5 rounded border border-slate-600">
          {deal.category}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
          deal.difficulty === 'Easy' ? 'bg-emerald-900/60 text-emerald-400 border-emerald-700' :
          deal.difficulty === 'Medium' ? 'bg-yellow-900/60 text-yellow-400 border-yellow-700' :
          deal.difficulty === 'Hard' ? 'bg-red-900/60 text-red-400 border-red-700' :
          'bg-violet-900/60 text-violet-400 border-violet-700'
        }`}>
          {deal.difficulty}
        </span>
      </div>

      {/* Bidding table */}
      <div className="md:absolute md:top-3 md:right-3 z-10 w-full md:w-64 px-2 md:px-0 flex-shrink-0">
        <BiddingTable bidding={deal.bidding} dealer={deal.dealer} bidAlerts={deal.bidAlerts} />
      </div>

      {/* Cross layout: N top, S bottom, W left, E right */}
      <div className="md:absolute md:inset-0 flex flex-col items-center justify-center gap-2 p-2 md:pt-14 flex-shrink-0">

        {/* North */}
        <HandDisplay seat="N" hand={state.hands['N']} seatPlayed={playedBySeat['N']} knownVoids={knownVoids['N']} />

        <div className="flex items-center gap-2">
          {/* West */}
          <HandDisplay seat="W" hand={state.hands['W']} seatPlayed={playedBySeat['W']} knownVoids={knownVoids['W']} />

          {/* Center: trick area */}
          <div className="bg-felt-dark/60 rounded-xl border border-felt-dark w-24 h-24 md:w-32 md:h-32 flex items-center justify-center shadow-inner flex-shrink-0">
            <TrickDisplay
              visibleTrick={state.visibleTrick as Partial<Record<import('../types').Seat, string>>}
              leader={state.currentTrickLeader as import('../types').Seat | null}
            />
          </div>

          {/* East */}
          <HandDisplay seat="E" hand={state.hands['E']} seatPlayed={playedBySeat['E']} knownVoids={knownVoids['E']} />
        </div>

        {/* South */}
        <HandDisplay seat="S" hand={state.hands['S']} seatPlayed={playedBySeat['S']} knownVoids={knownVoids['S']} />
      </div>

      {/* Contract box */}
      <div className="md:absolute md:bottom-3 md:right-3 z-10 flex justify-center md:block p-2 md:p-0 flex-shrink-0">
        <ContractBox
          contract={deal.contract}
          declarer={deal.declarer}
          trickScores={state.trickScores}
          vulnerability={deal.vulnerability}
        />
      </div>
    </div>
  );
}
