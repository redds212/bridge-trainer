import type { Seat, HandData, HandCards, Suit } from '../types';
import { SuitIcon, SUIT_ORDER, SUIT_SYMBOLS } from './SuitIcon';

interface Props {
  seat: Seat;
  hand: HandData;
  orientation?: 'horizontal' | 'vertical';
}

function isHidden(hand: HandData): hand is { hidden: true } {
  return (hand as any).hidden === true;
}

function parseCards(s: string): string[] {
  const ranks: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '1' && s[i + 1] === '0') {
      ranks.push('10');
      i += 2;
    } else {
      ranks.push(s[i]);
      i++;
    }
  }
  return ranks;
}

const SEAT_LABELS: Record<Seat, string> = { N: 'Północ', S: 'Południe', E: 'Wschód', W: 'Zachód' };
const SEAT_SHORT: Record<Seat, string> = { N: 'N', S: 'S', E: 'E', W: 'W' };

const SUIT_COLOR: Record<Suit, string> = {
  S: 'text-slate-900', H: 'text-red-600', D: 'text-red-600', C: 'text-slate-900',
};

export function HandDisplay({ seat, hand, orientation = 'vertical' }: Props) {
  const label = SEAT_LABELS[seat];

  if (isHidden(hand)) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{SEAT_SHORT[seat]}</div>
        <div className="bg-slate-700/60 rounded-lg border border-slate-600 px-2 py-1.5 flex flex-col gap-0.5 min-w-[80px]">
          {SUIT_ORDER.map(suit => (
            <div key={suit} className="flex items-center gap-1">
              <span className={`text-sm ${SUIT_COLOR[suit]}`}>{SUIT_SYMBOLS[suit]}</span>
              <span className="text-slate-400 text-xs whitespace-nowrap">? ? ? ?</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cards = hand as HandCards;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider">{SEAT_SHORT[seat]}</div>
      <div className="bg-slate-800/80 rounded-lg border border-slate-600 px-2 py-1.5 flex flex-col gap-0.5 min-w-[80px] fade-in">
        {SUIT_ORDER.map(suit => {
          const rankStr = cards[suit] ?? '';
          const ranks = parseCards(rankStr);
          return (
            <div key={suit} className="flex items-center gap-1 min-h-[1.1rem]">
              <span className={`text-sm w-4 ${SUIT_COLOR[suit]}`}>{SUIT_SYMBOLS[suit]}</span>
              <span className="text-white text-xs font-mono whitespace-nowrap">
                {ranks.length ? ranks.join(' ') : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
