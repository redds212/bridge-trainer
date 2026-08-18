import type { Deal, Difficulty } from '../types';

/**
 * Filtrowanie rozdań po nazwie i po poziomie trudności — wspólne dla panelu
 * bocznego i przycisku „Następne →" (docs/DEAL_SEARCH_PLAN.md, D2 i D5). Oba
 * miejsca muszą liczyć identycznie, inaczej przycisk prowadziłby poza listę,
 * którą użytkownik widzi.
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
 * Puste zapytanie i pusty zbiór poziomów przepuszczają całość: brak filtru to nie
 * jest zero wyników. Zwraca tę samą tablicę, więc bez żadnego filtru nie ma nawet
 * nowej referencji.
 *
 * „Nic nie zaznaczone" = wszystkie poziomy (a nie żaden) — dzięki temu odklikanie
 * ostatniego chipa samo kasuje filtr i nie potrzeba osobnego „Wszystkie".
 */
export function filterDeals(
  deals: Deal[],
  query: string,
  difficulties: readonly Difficulty[] = [],
): Deal[] {
  const tokens = tokenize(query);
  if (tokens.length === 0 && difficulties.length === 0) return deals;

  return deals.filter(deal => {
    if (difficulties.length > 0 && !difficulties.includes(deal.difficulty)) return false;
    const title = normalize(deal.title);
    return tokens.every(token => title.includes(token));
  });
}

/**
 * Dopasowanie do dowolnego tekstu, tą samą normalizacją i tą samą regułą AND.
 * Panel admina szuka po szerszym zestawie pól niż panel boczny (tytuł, kategoria,
 * id), bo pokazuje je wszystkie w wierszu tabeli — a wklejony identyfikator ze
 * zgłoszenia albo z listy duplikatów ma trafiać w wiersz. Reguła dopasowania zostaje
 * przy tym wspólna: jedno miejsce na normalizację diakrytyków i podział na tokeny.
 */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = normalize(text);
  return tokenize(query).every(token => haystack.includes(token));
}
