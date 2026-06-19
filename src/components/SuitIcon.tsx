import type { Suit } from '../types';

const SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const COLORS: Record<Suit, string> = { S: 'text-slate-900', H: 'text-red-600', D: 'text-red-600', C: 'text-slate-900' };

interface Props { suit: Suit; className?: string }

export function SuitIcon({ suit, className = '' }: Props) {
  return (
    <span className={`${COLORS[suit]} ${className}`}>
      {SYMBOLS[suit]}
    </span>
  );
}

export function parseSuitCard(code: string): { suit: Suit; rank: string } | null {
  if (!code || code.length < 2) return null;
  const suit = code[0] as Suit;
  const rank = code.slice(1);
  if (!['S', 'H', 'D', 'C'].includes(suit)) return null;
  return { suit, rank };
}

export function suitColor(suit: Suit): string {
  return suit === 'H' || suit === 'D' ? 'text-red-600' : 'text-slate-900';
}

export const SUIT_ORDER: Suit[] = ['S', 'H', 'D', 'C'];
export const SUIT_SYMBOLS = SYMBOLS;
