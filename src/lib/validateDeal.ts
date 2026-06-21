import type { Deal, Seat, HandCards, HandData, TrickStep } from '../types';

export interface DealValidation {
  errors: string[];   // block save / import
  warnings: string[]; // advisory
}

const SEATS: Seat[] = ['N', 'E', 'S', 'W'];
const CLOCKWISE: Seat[] = ['N', 'E', 'S', 'W'];
const SUIT_SYM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

function parseRanks(s: string | undefined): string[] {
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

function handToCodes(h: HandCards): string[] {
  return (['S', 'H', 'D', 'C'] as const).flatMap(suit => parseRanks(h[suit]).map(r => `${suit}${r}`));
}

function isHidden(h: HandData): h is { hidden: true } {
  return !!h && (h as { hidden?: boolean }).hidden === true;
}

/** The cards known to belong to a seat (visible hand, or a hidden hand's reveal). */
function seatCards(deal: Deal, seat: Seat): { codes: string[]; complete: boolean } | null {
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

function pretty(code: string): string {
  return `${SUIT_SYM[code[0]] ?? code[0]}${code.slice(1)}`;
}

function clockwiseFrom(leader: Seat): Seat[] {
  const i = CLOCKWISE.indexOf(leader);
  return [...CLOCKWISE.slice(i), ...CLOCKWISE.slice(0, i)];
}

function lastContractBid(bidding: string[][] | undefined): string | null {
  if (!bidding) return null;
  let last: string | null = null;
  for (const bid of bidding.flat()) {
    if (/^[1-7](C|D|H|S|NT)$/.test(bid)) last = bid;
  }
  return last;
}

/**
 * Validates a Deal beyond what the builder UI enforces at input time, and
 * covers the JSON-import path (which bypasses the UI entirely).
 */
export function validateDeal(deal: Deal): DealValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── hands: duplicates, sizes, completeness ──────────────────
  const known: Partial<Record<Seat, { codes: string[]; complete: boolean }>> = {};
  const unknown: Seat[] = [];
  for (const s of SEATS) {
    const c = seatCards(deal, s);
    if (!c) { unknown.push(s); continue; }
    known[s] = c;
    if (c.codes.length > 13) errors.push(`Ręka ${s} ma ${c.codes.length} kart (maksimum 13).`);
    else if (c.codes.length < 13) warnings.push(`Ręka ${s} ma ${c.codes.length}/13 kart (niekompletna).`);
  }

  const owner = new Map<string, Seat>();
  for (const s of SEATS) {
    for (const code of known[s]?.codes ?? []) {
      const prev = owner.get(code);
      if (prev) errors.push(`Karta ${pretty(code)} występuje w dwóch rękach (${prev} i ${s}).`);
      else owner.set(code, s);
    }
  }

  const totalKnown = SEATS.reduce((n, s) => n + (known[s]?.codes.length ?? 0), 0);
  if (unknown.length === 0 && totalKnown < 52) {
    warnings.push(`Rozdanie ma ${totalKnown}/52 kart — uzupełnij brakujące.`);
  }
  if (unknown.length) {
    warnings.push(`Ręce ukryte bez pełnego ujawnienia: ${unknown.join(', ')} — nie sprawdzę kart w ich zagraniach.`);
  }

  // ── tricks: every played card must belong to that seat's known hand ──
  const checkTrick = (trick: TrickStep, idx: number) => {
    const label = `Lewa ${trick.trick ?? idx}`;
    const leader = trick.leader;
    if (leader && trick.cards && !(leader in trick.cards)) {
      warnings.push(`${label}: wskazany wyjściowy (${leader}) nie ma karty w tej lewie.`);
    }
    for (const seat of clockwiseFrom(leader)) {
      const card = trick.cards?.[seat];
      if (!card) continue;
      const hand = known[seat];
      if (!hand || !hand.complete) continue; // can't verify partial / unknown hands
      if (!hand.codes.includes(card)) {
        errors.push(`${label}: ${seat} zagrywa ${pretty(card)}, której nie ma w swojej ręce.`);
      }
    }
  };
  (deal.introSequence ?? []).forEach((t, i) => checkTrick(t, i + 1));
  (deal.solution?.continuationTricks ?? []).forEach((t, i) => checkTrick(t, i + 1));

  // ── teaching layer ──────────────────────────────────────────
  if (!deal.introSequence || deal.introSequence.length === 0) {
    warnings.push('Brak sekwencji lew — gracz nie zobaczy rozgrywki przed decyzją.');
  }
  if (!deal.decisionPrompt?.trim()) warnings.push('Pusty prompt decyzji.');
  if (!deal.solution?.text?.trim()) warnings.push('Puste rozwiązanie (komentarz).');

  // ── contract vs bidding ─────────────────────────────────────
  const last = lastContractBid(deal.bidding);
  if (last && deal.contract && last !== deal.contract) {
    warnings.push(`Kontrakt (${deal.contract}) nie zgadza się z ostatnią odzywką licytacji (${last}).`);
  }

  return { errors, warnings };
}
