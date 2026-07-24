import type { Deal } from '../types';
import { RANKS, SEATS, SUITS, seatCards } from './cards';

// Tożsamość rozdania = wyłącznie rozkład 52 kart. Patrz docs/DEDUP_PLAN.md.
//
// Poza sygnaturą (zmiana ich NIGDY nie zmienia tożsamości rozdania): tytuł,
// kategoria, trudność, kontrakt, rozgrywający, rozdający, założenia, licytacja,
// introSequence (rozegrane karty), prompt decyzji, treść rozwiązania, źródło, motywy.
//
// Kluczowanie jest PO POZYCJACH — ten sam rozkład obrócony o jedną pozycję da inną
// sygnaturę i nie zostanie wykryty jako duplikat. Świadome ograniczenie: jako
// *problem* to i tak inne rozdanie (inny rozgrywający).

const rankIndex = new Map(RANKS.map((r, i) => [r, i] as const));

/** "SK9762.H52.DKQ7.C1063" — kolory w stałej kolejności, figury malejąco. */
function handPart(codes: string[]): string {
  return SUITS
    .map(suit => {
      const ranks = codes
        .filter(c => c[0] === suit)
        .map(c => c.slice(1))
        .sort((a, b) => (rankIndex.get(a) ?? 99) - (rankIndex.get(b) ?? 99));
      return `${suit}${ranks.join('')}`;
    })
    .join('.');
}

/**
 * Kanoniczna sygnatura rozkładu, np.
 * `N:SK9762.H52.DKQ7.C1063|E:SJ10.H10987.D542.CQJ97|S:…|W:…`
 *
 * Zwraca `null`, gdy rozdanie nie ma kompletu 52 znanych kart (ręka ukryta bez
 * ujawnienia, ręka niepełna, karta powtórzona, nieznana figura). `null` = wiersz
 * zwolniony z unikalnego indeksu — bez tego dwa puste szkice z DealBuildera
 * kolidowałyby ze sobą.
 *
 * Liczona RAZ, przy zapisie nowego rozdania, i nigdy nie przeliczana przy edycji:
 * poprawka błędnie wydrukowanej karty nie może otworzyć drogi oryginalnemu plikowi.
 */
export function dealSignature(deal: Deal): string | null {
  const parts: string[] = [];
  const seen = new Set<string>();

  for (const seat of SEATS) {
    const hand = seatCards(deal, seat);
    if (!hand || hand.codes.length !== 13) return null;

    const codes: string[] = [];
    for (const raw of hand.codes) {
      const code = raw.toUpperCase();
      if (!rankIndex.has(code.slice(1))) return null; // nieznana figura
      if (seen.has(code)) return null;                // ta sama karta dwa razy → to nie jest rozdanie
      seen.add(code);
      codes.push(code);
    }
    parts.push(`${seat}:${handPart(codes)}`);
  }

  return seen.size === 52 ? parts.join('|') : null;
}

/** Porównanie tytułów dla miękkiej kontroli „ten sam board, poprawione karty". */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}
