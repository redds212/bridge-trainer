import type { Deal, Seat, TrickStep } from '../types';
import { SEATS, seatCards } from './cards';

export interface DealValidation {
  errors: string[];   // block save / import
  warnings: string[]; // advisory
}

const CLOCKWISE: Seat[] = ['N', 'E', 'S', 'W'];
const SUIT_SYM: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

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
  // ── kształt sekwencji wstępnej ──────────────────────────────
  // Niepełna lewa jest legalna wyłącznie jako punkt decyzji, czyli na samym końcu.
  // W środku sekwencji nie doliczyłaby się do NS/EW (useGameState wymaga kompletu
  // czterech kart), więc licznik lew rozjechałby się z tym, co gracz widzi na filcu —
  // a przy nauce rozgrywki licznik jest częścią zadania.
  //
  // Reguły dotyczą tylko `introSequence`. `continuationTricks` nie są dziś nigdzie
  // renderowane, więc zaostrzanie ich blokowałoby import na danych, których nikt nie ogląda.
  const checkIntroShape = (tricks: TrickStep[]) => {
    tricks.forEach((trick, i) => {
      if (!trick.leader) return; // brak wyjściowego łapie checkTrick
      const label = `Lewa ${trick.trick ?? i + 1}`;
      const order = clockwiseFrom(trick.leader);
      const played = order.map(seat => trick.cards?.[seat]);
      const gap = played.findIndex(card => !card);
      if (gap !== -1 && played.slice(gap).some(Boolean)) {
        errors.push(`${label}: karty muszą iść po kolei od wyjściowego (${trick.leader}) — brak karty gracza ${order[gap]}.`);
      }
      const count = played.filter(Boolean).length;
      if (count < 4 && i < tricks.length - 1) {
        errors.push(`${label}: niepełna lewa (${count}/4) może być tylko ostatnia — punkt decyzji kończy sekwencję.`);
      }
      if (count < 4 && trick.winner) {
        warnings.push(`${label}: niepełna lewa ma wskazanego zwycięzcę (${trick.winner}) — zostanie zignorowany.`);
      }
    });
  };

  (deal.introSequence ?? []).forEach((t, i) => checkTrick(t, i + 1));
  (deal.solution?.continuationTricks ?? []).forEach((t, i) => checkTrick(t, i + 1));
  checkIntroShape(deal.introSequence ?? []);

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
