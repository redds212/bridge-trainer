import type { Seat, BidAlert, Suit } from '../types';
import { SUIT_COLORS } from '../lib/suitColors';

interface Props {
  bidding: string[][];
  dealer: Seat;
  bidAlerts?: BidAlert[];
}

const SEAT_ORDER: Seat[] = ['W', 'N', 'E', 'S'];

const SUIT_SYM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

function bidContent(bid: string) {
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
        <span style={{ color: SUIT_COLORS.bidding[suit as Suit] }}>{SUIT_SYM[suit]}</span>
      </span>
    );
  }
  return <span className="text-slate-200">{bid}</span>;
}

function BidCell({ bid, alerted }: { bid: string | null; alerted?: boolean }) {
  if (!bid) return null;
  return (
    <span className="whitespace-nowrap">
      {bidContent(bid)}
      {alerted && <sup className="text-amber-300 font-bold text-[0.85em] ml-px">A</sup>}
    </span>
  );
}

export function BiddingTable({ bidding, dealer, bidAlerts = [] }: Props) {
  const dealerIdx = SEAT_ORDER.indexOf(dealer);
  const flat = bidding.flat();
  const alertedSet = new Set(bidAlerts.map(a => a.index));

  type Cell = { bid: string; flatIndex: number } | null;
  const rawCells: Cell[] = [];
  for (let i = 0; i < dealerIdx; i++) rawCells.push(null);
  flat.forEach((bid, fi) => rawCells.push({ bid, flatIndex: fi }));

  const rows: Cell[][] = [];
  let row: Cell[] = [];
  rawCells.forEach(cell => {
    row.push(cell);
    if (row.length === 4) { rows.push(row); row = []; }
  });
  if (row.length) {
    while (row.length < 4) row.push(null);
    rows.push(row);
  }

  const explanations = [...bidAlerts]
    .filter(a => flat[a.index] !== undefined && a.explanation.trim())
    .sort((a, b) => a.index - b.index)
    .map(a => ({ bid: flat[a.index], explanation: a.explanation.trim() }));

  return (
    <div className="space-y-1">
      <div className="bg-slate-800/90 rounded-lg border border-slate-600 overflow-hidden text-xs">
        <div className="grid grid-cols-4 bg-slate-700/80">
          {SEAT_ORDER.map(s => (
            <div key={s} className="text-center py-1 text-slate-300 font-semibold border-r border-slate-600 last:border-0">
              {s}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={ri} className="grid grid-cols-4 border-t border-slate-700">
            {r.map((cell, ci) => (
              <div key={ci} className="text-center py-1 px-1 border-r border-slate-700 last:border-0">
                <BidCell bid={cell?.bid ?? null} alerted={cell ? alertedSet.has(cell.flatIndex) : false} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {explanations.length > 0 && (
        <div className="bg-slate-800/90 rounded-lg border border-slate-600 px-2 py-1.5 text-xs space-y-0.5">
          {explanations.map((e, i) => (
            <div key={i} className="flex items-baseline gap-1">
              <BidCell bid={e.bid} />
              <span className="text-slate-500">=</span>
              <span className="text-slate-300">{e.explanation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
