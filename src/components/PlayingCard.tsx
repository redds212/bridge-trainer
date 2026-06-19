import { parseSuitCard, SuitIcon, suitColor } from './SuitIcon';
import type { Suit } from '../types';

interface Props {
  code: string;
  small?: boolean;
  animated?: boolean;
}

const RANK_DISPLAY: Record<string, string> = {
  A: 'A', K: 'K', Q: 'Q', J: 'J', '10': '10',
  '9': '9', '8': '8', '7': '7', '6': '6', '5': '5',
  '4': '4', '3': '3', '2': '2', '1': 'A',
};

export function PlayingCard({ code, small = false, animated = false }: Props) {
  const parsed = parseSuitCard(code);
  if (!parsed) return null;

  const { suit, rank } = parsed;
  const color = suitColor(suit as Suit);
  const displayRank = RANK_DISPLAY[rank] ?? rank;

  if (small) {
    return (
      <span className={`inline-flex items-center gap-0.5 bg-white rounded px-1 py-0.5 shadow text-xs font-bold border border-slate-200 ${animated ? 'deal-card' : ''}`}>
        <span className={color}>{displayRank}</span>
        <SuitIcon suit={suit as Suit} className="text-xs" />
      </span>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md border border-slate-200 flex flex-col items-center justify-center w-10 h-14 select-none ${animated ? 'deal-card' : ''}`}>
      <span className={`text-sm font-bold leading-none ${color}`}>{displayRank}</span>
      <SuitIcon suit={suit as Suit} className="text-base" />
    </div>
  );
}
