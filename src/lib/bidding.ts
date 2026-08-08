/**
 * Czy rozdanie ma zapisaną licytację. Stan pusty to nie przypadek brzegowy —
 * ma go zdecydowana większość importowanych rozdań, więc jest pełnoprawnym
 * wariantem widoku (wyszarzony diagram na desktopie, zablokowany chip na
 * telefonie), a nie błędem do obsłużenia po cichu.
 *
 * `bidding` idzie prosto z JSON-a w bazie (useDeals), bez normalizacji, więc typ
 * `string[][]` jest tu obietnicą bez pokrycia — stąd kontrola defensywna zamiast
 * samego `.length`.
 *
 * Cztery pasy to licytacja, nie stan pusty; w tym projekcie i tak nie wystąpią,
 * bo każde rozdanie ma kontrakt i rozgrywającego.
 *
 * Puste i białoznakowe wpisy nie liczą się jako odzywki: `[["","","",""]]` to dla
 * użytkownika dokładnie to samo co brak licytacji (BidCell nic z nich nie rysuje),
 * więc sam rozmiar tablicy nie wystarcza.
 */
export function hasBidding(bidding: string[][] | null | undefined): boolean {
  return Array.isArray(bidding) && bidding.flat().some(bid => typeof bid === 'string' && bid.trim() !== '');
}
