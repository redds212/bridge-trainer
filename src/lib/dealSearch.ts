import type { Deal } from '../types';

/**
 * Filtrowanie rozdań po nazwie — wspólne dla panelu bocznego i przycisku
 * „Następne →" (docs/DEAL_SEARCH_PLAN.md, D2 i D5). Oba miejsca muszą liczyć
 * identycznie, inaczej przycisk prowadziłby poza listę, którą użytkownik widzi.
 */

/**
 * Małe litery bez znaków diakrytycznych. NFD rozbija „ó" na „o" + znak łączący,
 * a `\p{M}` zdejmuje ten drugi — dzięki temu „atutow" wstukane w biegu na
 * telefonie trafia w „wyciąganie atutów".
 */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Tokeny łączone przez AND, bez znaczenia kolejności. Tytuły są długie i opisowe
 * („Test wielu lew (A) — wyciąganie atutów"), więc naturalne zapytanie
 * „test atutów" nie jest ich spójnym podciągiem — pojedyncze `includes` całej
 * frazy zwracałoby tu zero wyników i wyglądało na zepsute.
 */
function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/**
 * Puste zapytanie przepuszcza całość: brak filtru to nie jest zero wyników.
 * Zwraca tę samą tablicę, więc bez wpisanej frazy nie ma nawet nowej referencji.
 */
export function filterDeals(deals: Deal[], query: string): Deal[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return deals;

  return deals.filter(deal => {
    const title = normalize(deal.title);
    return tokens.every(token => title.includes(token));
  });
}
