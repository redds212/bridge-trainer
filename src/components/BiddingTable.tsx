import type { Seat } from '../types';

interface Props {
  bidding: string[][];
  dealer: Seat;
}

const SEAT_ORDER: Seat[] = ['W', 'N', 'E', 'S'];
const SUIT_MAP: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣', NT: 'SA' };

function formatBid(bid: string): string {
  if (!bid) return '';
  if (bid === 'P' || bid === 'Pass') return 'Pas';
  if (bid === 'X') return 'Ktr';
  if (bid === 'XX') return 'Rktr';
  const match = bid.match(/^(\d)(S|H|D|C|NT)$/);
  if (match) return `${match[1]}${SUIT_MAP[match[2]] ?? match[2]}`;
  return bid;
}

export function BiddingTable({ bidding, dealer }: Props) {
  const dealerIdx = SEAT_ORDER.indexOf(dealer);
  const flat = bidding.flat();

  const cells: Array<{ seat: Seat; bid: string } | null> = [];
  for (let i = 0; i < dealerIdx; i++) cells.push(null);
  flat.forEach((bid, i) => {
    cells.push({ seat: SEAT_ORDER[(dealerIdx + i) % 4], bid });
  });

  const rows: Array<Array<string | null>> = [];
  let row: Array<string | null> = [];
  cells.forEach(cell => {
    row.push(cell ? formatBid(cell.bid) : null);
    if (row.length === 4) { rows.push(row); row = []; }
  });
  if (row.length) {
    while (row.length < 4) row.push(null);
    rows.push(row);
  }

  const redBids = new Set(['♥', '♦']);

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
          {row.map((cell, ci) => {
            const isRed = cell && (cell.includes('♥') || cell.includes('♦'));
            return (
              <div
                key={ci}
                className={`text-center py-1 px-1 border-r border-slate-700 last:border-0 ${
                  cell ? (isRed ? 'text-red-400' : 'text-slate-200') : ''
                }`}
              >
                {cell ?? ''}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
