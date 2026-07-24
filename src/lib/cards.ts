import type { Deal, HandCards, HandData, Seat } from '../types';

// Card-notation primitives shared by validateDeal() and dealSignature().
// Single source of truth for the library's notation: suit letter + concatenated
// ranks, "10" written literally (never "T"), void = "" / "-" / "void".

export const SEATS: Seat[] = ['N', 'E', 'S', 'W'];
export const SUITS = ['S', 'H', 'D', 'C'] as const;

/** Ranks high → low. Order is canonical — dealSignature() sorts by it. */
export const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

export function parseRanks(s: string | undefined): string[] {
  if (!s) return [];
  const low = s.toLowerCase();
  if (low === 'void' || s === '-') return [];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === ' ') { i++; continue; }
    if (s[i] === '1' && s[i + 1] === '0') { out.push('10'); i += 2; }
    else { out.push(s[i]); i++; }
  }
  return out;
}

export function handToCodes(h: HandCards): string[] {
  return SUITS.flatMap(suit => parseRanks(h[suit]).map(r => `${suit}${r}`));
}

export function isHidden(h: HandData): h is { hidden: true } {
  return !!h && (h as { hidden?: boolean }).hidden === true;
}

/** The cards known to belong to a seat (visible hand, or a hidden hand's reveal). */
export function seatCards(deal: Deal, seat: Seat): { codes: string[]; complete: boolean } | null {
  const h = deal.initialHands?.[seat];
  if (!h) return null;
  if (isHidden(h)) {
    const rev = deal.solution?.revealAllCards?.[seat];
    if (!rev) return null; // hidden and not revealed → unknown
    const codes = handToCodes(rev);
    return { codes, complete: codes.length === 13 };
  }
  const codes = handToCodes(h as HandCards);
  return { codes, complete: codes.length === 13 };
}
