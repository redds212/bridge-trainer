# System sygnatur rozdań — blokada duplikatów przy imporcie

Status: **zaimplementowane 2026-07-24** (kod), **migracje do uruchomienia ręcznie**.

> ## ⚠ Kolejność wdrożenia — najpierw migracja 0006
>
> Kod zapisuje teraz kolumnę `deals.card_signature`. Jeśli aplikacja trafi na produkcję
> **przed** uruchomieniem `0006_deal_signature.sql`, każdy zapis nowego rozdania padnie
> na `column "card_signature" does not exist`. Wklej 0006 do Supabase SQL Editor przed
> wypuszczeniem tej wersji. Migracja 0007 może poczekać — do czasu jej uruchomienia
> kontrola duplikatów działa po stronie klienta (skutecznie przy pracy z jednej karty
> przeglądarki), a indeks czyni ją nieobejściową.

## Problem

Import JSON w panelu admina tworzy nowy wiersz przy **każdym** wczytaniu pliku:

- `AdminPanel.importDeals` ([src/admin/AdminPanel.tsx:86](../src/admin/AdminPanel.tsx)) waliduje rozdanie i wywołuje `onAdd(d)`.
- `useDeals.addDeal` ([src/hooks/useDeals.ts:104](../src/hooks/useDeals.ts)) **ignoruje `id` z pliku** i generuje własne: `deal-${crypto.randomUUID()}`.

Skutki:

1. Ten sam plik wczytany dwa razy → dwa wiersze.
2. Nawet gdyby honorować `id` z pliku, to za mało — każdy przebieg generowania plików przez Claude stempluje świeże UUID-y, więc `board-100-russia.json` wygenerowany ponownie ma inne `id` przy identycznych kartach.
3. W `imports/vec-part1/` leży 150 plików `board-*.json` **oraz** `euvc.json` zawierający te same 150 rozdań — kolizja jest gwarantowana, nie hipotetyczna.

**W projekcie nie istnieje żaden system sygnatur.** Jedyne pokrewne rzeczy to kontrola duplikatów kart *wewnątrz* rozdania w `validateDeal.ts` oraz klucz główny `deals.id`. Trzeba zbudować od zera.

## Decyzje projektowe

### 1. Definicja duplikatu: wyłącznie 52 karty

Sygnatura liczona jest **tylko** z rozkładu kart: `initialHands` scalone z `solution.revealAllCards`
(ręce ukryte biorą karty z ujawnienia), karty w kolorze posortowane kanonicznie, klucz per pozycja (N/E/S/W).

Poza sygnaturą (zmiana ich **nigdy** nie zmienia tożsamości rozdania):
`title`, `category`, `difficulty`, `contract`, `declarer`, `dealer`, `vulnerability`,
`bidding`, `bidAlerts`, `introSequence` (rozegrane karty), `decisionPrompt`, `solution.text`,
`sourceId`, `sourceDetails`, `tagIds`, `createdAt`.

Uzasadnienie: losowy rozkład 52 kart jest odciskiem palca. Dwa pliki o identycznych kartach
pochodzą z tego samego rozdania książkowego niezależnie od tego, jak wpisano tytuł czy kontrakt.
Świadomie przyjęte ryzyko: gdyby książka postawiła dwa różne problemy na jednym rozkładzie,
drugi zostanie zablokowany i trzeba go dodać ręcznie.

Znane ograniczenie: sygnatura jest kluczowana **po pozycjach**, więc ten sam rozkład obrócony
o jedną pozycję (inny rozdający/rozgrywający) da inną sygnaturę i nie zostanie wykryty.
Uznane za akceptowalne — jako *problem* to i tak inne rozdanie.

### 2. Sygnatura zamrożona w momencie zapisu

Sygnatura liczona jest **raz, przy INSERT** i nigdy nie przeliczana przy edycji.

Powód: `imports/vec-part1/REVIEW-NOTES.md` wymienia 11 poprawionych błędów druku i 5 rozdań
oznaczonych *„Please verify against the book"* (55, 65, 110, 118, 164). Zakładany przebieg pracy
to: import → wykrycie złej karty → poprawka w aplikacji. Gdyby sygnatura była przeliczana,
ta poprawka zmieniłaby tożsamość rozdania i **ponowny import oryginalnego pliku przeszedłby jako nowe rozdanie**.
Zamrożenie zamyka tę dziurę: sygnatura to token tożsamości importu, nie żywy hash treści.

Konsekwencja do zaakceptowania: po ręcznej poprawce karty `card_signature` przestaje opisywać
aktualną zawartość wiersza. To celowe.

### 3. Druga, miękka kontrola: kolizja tytułu

Zamrożenie nie chroni przed przypadkiem odwrotnym: plik został **poprawiony** (Claude wygenerował
Board 110 z właściwym trefl), a w bazie leży wersja oryginalna. Inne karty → inna sygnatura → przejdzie.

Dlatego przy imporcie dodatkowo porównywany jest **znormalizowany tytuł** (trim + lowercase +
scalone spacje). Trafienie **nie blokuje** — wymaga potwierdzenia i jest wykazane w raporcie
(„Rozdanie 110 (Liechtenstein) już istnieje, ale ma inne karty").

### 4. Egzekwowanie: unikalny indeks w bazie, NULL dla niekompletnych

- Nowa kolumna `public.deals.card_signature text` (nullable).
- `create unique index ... on public.deals (card_signature) where card_signature is not null`.
- Sygnatura liczona **tylko gdy znane są wszystkie 52 karty**. Rozdanie z ukrytą, nieujawnioną
  ręką zapisuje `NULL` i jest zwolnione z kontroli.

Dlaczego zwolnienie jest konieczne: `validateDeal` traktuje niekompletne/nieujawnione ręce jako
**ostrzeżenia, nie błędy** ([validateDeal.ts:82](../src/lib/validateDeal.ts), [:98](../src/lib/validateDeal.ts)),
więc baza legalnie zawiera rozdania z mniej niż 52 znanymi kartami. Bez wyjątku dwa puste szkice
z `DealBuilder` miałyby tę samą „pustą" sygnaturę i drugi zostałby odrzucony bez powodu.

Indeks w bazie jest autorytetem — nie da się go obejść z drugiej karty przeglądarki, ze
zdezaktualizowanego widoku ani bezpośrednim wywołaniem Supabase. Kontrola po stronie klienta
istnieje **wyłącznie** po to, żeby pokazać czytelny polski komunikat zamiast
`duplicate key value violates unique constraint`.

Sygnatura liczona jest w TypeScript (potrzebuje parsera z `validateDeal.ts`: `"10"` zamiast `T`,
obsługa renonsu). **Nie duplikujemy tego parsera w PL/pgSQL** — dwie kopie rozjechałyby się.

### 5. Wdrożenie dwufazowe (backfill przed indeksem)

`create unique index` **nie powstanie**, jeśli w tabeli są już kolidujące wiersze. A ponieważ
sygnatura liczy się w JS, istniejące wiersze musi podpisać aplikacja:

1. **Migracja `0006_deal_signature.sql`** — dodaje samą kolumnę (nullable, bez indeksu).
2. **Akcja admina „Przelicz sygnatury"** — liczy sygnatury w JS dla wszystkich istniejących
   wierszy, zapisuje je, po czym **wypisuje grupy duplikatów** i zostawia decyzję użytkownikowi
   (archiwizacja / usunięcie). Nic nie kasuje automatycznie — `srs_progress` pozostaje nietknięte.
3. **Migracja `0007_deal_signature_unique.sql`** — zakłada unikalny indeks, gdy lista jest czysta.

Ryzyko rollout-u: zatrzymanie się po kroku 1 zostawia kolumnę bez ochrony. Kroki 2 i 3 trzeba
domknąć. Wiersz z `card_signature = NULL` jest zwolniony z indeksu — czyli rozdania *już
zaimportowane*, najbardziej narażone na przypadkowy ponowny import, są bez backfillu bezbronne.

Odrzucone: backfill w PL/pgSQL (drugi parser), reset biblioteki (`deals.id` kaskaduje na
`srs_progress` — utrata całej historii SRS), brak backfillu.

### 6. Zachowanie importera przy kolizji: pominięcie + wykaz

- Duplikat jest **pomijany**, nigdy nie zapisywany, i liczony w osobnym koszyku niż błędy walidacji:
  `Zaimportowano 12 · pominięto 138 duplikatów · 3 błędy`.
- Rozwijalna lista nazywa każde pominięte rozdanie i tytuł rozdania, z którym kolidowało.
  (Dziś [AdminPanel.tsx:105](../src/admin/AdminPanel.tsx) pokazuje tylko `reasons[0]` — przy 150
  rozdaniach bezużyteczne.)
- Ten sam przebieg wykrywa duplikaty **wewnątrz** wsadu, więc wrzucenie `euvc.json` po plikach
  pojedynczych daje 150 czystych pominięć zamiast lawiny błędów.
- **Istniejące rozdania nigdy nie są modyfikowane** — ręczne poprawki z `REVIEW-NOTES.md` są bezpieczne.

Odrzucone: upsert/aktualizacja przy trafieniu (nadpisałby poprawki i przeczy wymaganiu
„jeśli rozdanie istnieje, nie importuj drugiego"), modal per rozdanie (150 kliknięć).

### 7. Import wielu plików naraz — w zakresie

`multiple` na inpucie ([AdminPanel.tsx:193](../src/admin/AdminPanel.tsx)), pliki czytane
sekwencyjnie do **jednego** wspólnego przebiegu dedup i **jednego** raportu. Bez tego wykaz
z punktu 6 jest per plik i trzeba by przeczytać 150 raportów.

## Co powstało

| Plik | Rola |
|---|---|
| `src/lib/cards.ts` | **nowy** — parser notacji wyjęty z `validateDeal.ts` (`parseRanks`, `handToCodes`, `isHidden`, `seatCards`, `RANKS`). Jedna kopia dla walidacji i sygnatury. |
| `src/lib/dealSignature.ts` | **nowy** — `dealSignature()` + `normalizeTitle()`. |
| `src/lib/validateDeal.ts` | odchudzony o parser, importuje z `cards.ts`. Zachowanie bez zmian. |
| `supabase/migrations/0006_deal_signature.sql` | kolumna `card_signature` (bez indeksu). |
| `supabase/migrations/0007_deal_signature_unique.sql` | unikalny indeks częściowy + bezpiecznik `raise exception` z liczbą grup duplikatów. |
| `src/lib/database.types.ts` | `DealRow.card_signature`, opcjonalne w `Insert`. |
| `src/hooks/useDeals.ts` | `DealRecord.cardSignature`; `addDeal` podpisuje; **nowe** `addDeals()` (wsad) i `backfillSignatures()`; `dealColumns()` celowo bez sygnatury. |
| `src/admin/AdminPanel.tsx` | przegląd plików przed zapisem, panel potwierdzenia kolizji tytułów, raport z rozwijanymi listami, panel konserwacji sygnatur, `multiple` na inpucie. |
| `src/App.tsx` | przekazanie `onAddMany` / `onBackfill`. |

Odstępstwo od planu: parser wylądował w osobnym `cards.ts`, a nie w `dealSignature.ts` —
`validateDeal.ts` importujący z modułu o nazwie „sygnatura" byłby mylący.

Format sygnatury: **czytelny łańcuch kanoniczny**, nie hash — debugowalny wprost w SQL,
bez asynchronicznego `crypto.subtle`. Przykład (Board 100, Rosja):

```
N:SK9762.H52.DKQ7.C1063|E:SJ10.H10987.D542.CQJ97|S:S8543.HJ643.DJ3.CK42|W:SAQ.HAKQ.DA10986.CA85
```

Wsadowy zapis: `addDeals()` wysyła porcje po 50 wierszy jednym `insert`; porcja odrzucona
przez bazę jest ponawiana wiersz po wierszu, żeby wskazać winowajcę zamiast wywalić cały wsad.
Wcześniej import wołał `addDeal()` (a więc i pełne przeładowanie listy) 150 razy.

## Weryfikacja na prawdziwych danych

Sprawdzone na `imports/vec-part1/` (skrypt jednorazowy, poza repo):

- 150 plików `board-*.json` → **150 sygnatur, 150 unikalnych, 0 kolizji**, 0 niekompletnych.
- `euvc.json` (150 rozdań) → **150/150 pokrywa się** z plikami pojedynczymi, czyli import
  po nich doda 0 nowych. To była gwarantowana kolizja na dysku.
- Sygnatura **nie zmienia się** przy: innej kolejności kolorów/figur w zapisie, małych literach,
  zmianie tytułu, kontraktu, rozgrywającego, trudności, promptu, treści rozwiązania i `introSequence`.
- Sygnatura **zmienia się** przy poprawce karty — dlatego zamrażamy ją przy INSERT.
- `null` (wiersz zwolniony z indeksu) przy: ukrytej ręce bez ujawnienia, powtórzonej karcie.

`tsc -b` i `npm run build` przechodzą; aplikacja startuje bez błędów w konsoli.

## Pozostało do zrobienia ręcznie

Instrukcja krok po kroku z gotowym SQL do wklejenia: **[DEDUP_ROLLOUT.md](DEDUP_ROLLOUT.md)**. W skrócie:

1. **Uruchom `0006_deal_signature.sql`** w Supabase SQL Editor — przed wypuszczeniem tej wersji.
2. Wejdź w Panel administracyjny → Rozdania. Pojawi się panel „Sygnatury rozkładu"
   z liczbą wierszy do uzupełnienia → **„Przelicz sygnatury"**.
3. Jeśli panel wykaże grupy duplikatów już w bazie — posprzątaj je.
   Usunięcie rozdania kaskaduje na `srs_progress`: zostaw kopię, która ma historię powtórek.
4. **Uruchom `0007_deal_signature_unique.sql`.** Przerwie z komunikatem, jeśli krok 3 nie jest domknięty.
5. Zaimportuj `imports/vec-part1/` (zaznacz wszystkie pliki naraz — inne niż `.json` nie przejdą filtra).
