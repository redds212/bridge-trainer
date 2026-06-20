import type { Seat, HandData, HandCards, Suit } from '../types';
import { SUIT_ORDER, SUIT_SYMBOLS } from './SuitIcon';

interface Props {
  seat: Seat;
  hand: HandData;
  seatPlayed?: string[];
  knownVoids?: Set<string>; // suits (S/H/D/C) confirmed void by discarding off-suit
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

const SEAT_SHORT: Record<Seat, string> = { N: 'N', S: 'S', E: 'E', W: 'W' };

const SUIT_COLOR: Record<Suit, string> = {
  S: 'text-slate-900', H: 'text-red-600', D: 'text-red-600', C: 'text-slate-900',
};

// High to low: A K Q J 10 9 8 7 6 5 4 3 2
const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

function sortedHighToLow(ranks: string[]): string[] {
  return [...ranks].sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));
}

const HIDDEN_COUNT = 4; // initial ? marks per suit for hidden hands

export function HandDisplay({ seat, hand, seatPlayed = [], knownVoids }: Props) {
  const playedSet = new Set(seatPlayed);

  if (isHidden(hand)) {
    // Group played cards by suit for this hidden seat
    const playedBySuit: Partial<Record<Suit, string[]>> = {};
    for (const code of seatPlayed) {
      const suit = code[0] as Suit;
      const rank = code.slice(1);
      if (['S', 'H', 'D', 'C'].includes(suit)) {
        (playedBySuit[suit] ??= []).push(rank);
      }
    }

    return (
      <div className="flex flex-col items-center gap-1">
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{SEAT_SHORT[seat]}</div>
        <div className="bg-slate-700/60 rounded-lg border border-slate-600 px-3 py-2 flex flex-col gap-1 min-w-[105px]">
          {SUIT_ORDER.map(suit => {
            const played = sortedHighToLow(playedBySuit[suit] ?? []);
            const remaining = knownVoids?.has(suit) ? 0 : Math.max(0, HIDDEN_COUNT - played.length);
            return (
              <div key={suit} className="flex items-center gap-1 min-h-[1.4rem]">
                <span className={`text-sm w-4 flex-shrink-0 ${SUIT_COLOR[suit]}`}>{SUIT_SYMBOLS[suit]}</span>
                <div className="flex items-baseline gap-1 font-mono whitespace-nowrap">
                  {played.map((rank, i) => (
                    <span key={i} className="text-sm text-slate-300">{rank}</span>
                  ))}
                  {Array.from({ length: remaining }, (_, i) => (
                    <span key={`q${i}`} className="text-sm text-slate-400">?</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const cards = hand as HandCards;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-slate-300 text-xs font-semibold uppercase tracking-wider">{SEAT_SHORT[seat]}</div>
      <div className="bg-slate-800/80 rounded-lg border border-slate-600 px-3 py-2 flex flex-col gap-1 min-w-[105px] fade-in">
        {SUIT_ORDER.map(suit => {
          const rankStr = cards[suit] ?? '';
          const ranks = parseCards(rankStr);
          return (
            <div key={suit} className="flex items-center gap-1 min-h-[1.4rem]">
              <span className={`text-sm w-4 flex-shrink-0 ${SUIT_COLOR[suit]}`}>{SUIT_SYMBOLS[suit]}</span>
              <div className="flex items-baseline gap-1 font-mono whitespace-nowrap">
                {ranks.length ? ranks.map((rank, i) => {
                  const played = playedSet.has(`${suit}${rank}`);
                  return (
                    <span
                      key={i}
                      className={`text-sm transition-colors ${played ? 'text-slate-600' : 'text-white'}`}
                    >
                      {rank}
                    </span>
                  );
                }) : <span className="text-sm text-slate-500">—</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
