import type { Suit } from '../types';

// BridgeLoop 4-color deck (docs/design/README.md). Used everywhere suit glyphs
// render: hands (panel), bidding table (lighter variants), contract box (panel).
export type SuitContext = 'panel' | 'bidding';

export const SUIT_COLORS: Record<SuitContext, Record<Suit, string>> = {
  panel:   { S: '#5b9be8', H: '#e0524d', D: '#df8a2e', C: '#36ad63' },
  bidding: { S: '#5b9be8', H: '#ff6b6b', D: '#f0a44a', C: '#4cc97e' },
};

export function suitColor(suit: Suit, ctx: SuitContext = 'panel'): string {
  return SUIT_COLORS[ctx][suit];
}
