import type { Seat } from '../types';

interface Props {
  bidding: string[][];
  dealer: Seat;
}

const SEAT_ORDER: Seat[] = ['W', 'N', 'E', 'S'];

const SUIT_SYM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_COL: Record<string, string> = {
  S: 'text-blue-400',
  H: 'text-red-400',
  D: 'text-orange-400',
  C: 'text-emerald-400',
};

function BidCell({ bid }: { bid: string | null }) {
  if (!bid) return null;
  if (bid === 'P' || bid === 'Pass') return <span className="text-slate-400">Pas</span>;
  if (bid === 'X') return <span className="text-red-400 font-bold">Ktr</span>;
  if (bid === 'XX') return <span className="text-blue-400 font-bold">Rktr</span>;
  const match = bid.match(/^(\d)(S|H|D|C|NT)$/);
  if (match) {
    const [, level, suit] = match;
    if (suit === 'NT') return <span className="text-slate-200">{level}BA</span>;
    return (
      <span>
        <span className="text-slate-200">{level}</span>
        <span className={SUIT_COL[suit]}>{SUIT_SYM[suit]}</span>
      </span>
    );
  }
  return <span className="text-slate-200">{bid}</span>;
}

export function BiddingTable({ bidding, dealer }: Props) {
  const dealerIdx = SEAT_ORDER.indexOf(dealer);
  const flat = bidding.flat();

  const rawCells: Array<string | null> = [];
  for (let i = 0; i < dealerIdx; i++) rawCells.push(null);
  flat.forEach(bid => rawCells.push(bid));

  const rows: Array<Array<string | null>> = [];
  let row: Array<string | null> = [];
  rawCells.forEach(cell => {
    row.push(cell);
    if (row.length === 4) { rows.push(row); row = []; }
  });
  if (row.length) {
    while (row.length < 4) row.push(null);
    rows.push(row);
  }

  return (
    <div className="bg-slate-800/90 rounded-lg border border-slate-600 overflow-hidden text-xs">
      <div className="grid grid-cols-4 bg-slate-700/80">
        {SEAT_ORDER.map(s => (
          <div key={s} className="text-center py-1 text-slate-300 font-semibold border-r border-slate-600 last:border-0">
            {s}
          </div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-4 border-t border-slate-700">
          {row.map((cell, ci) => (
            <div key={ci} className="text-center py-1 px-1 border-r border-slate-700 last:border-0">
              <BidCell bid={cell} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
