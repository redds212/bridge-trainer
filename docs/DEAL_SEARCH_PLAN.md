# Plan: wyszukiwarka rozdań w panelu bocznym

Data ustaleń: 2026-08-08. Status: **ustalone, do implementacji**.

## Problem

Lista rozdań w panelu bocznym ([`Sidebar.tsx:135`](../src/components/Sidebar.tsx))
rośnie razem z bazą i jedyną nawigacją jest przewijanie pogrupowanych kategorii.
Żeby znaleźć konkretne rozdanie po nazwie, trzeba je wypatrzeć wzrokiem.

Potrzebne jest małe pole tekstowe nad listą: po wpisaniu frazy lista pokazuje
wyłącznie rozdania, które mają tę frazę w nazwie (np. `123` → `rozdanie 123`
i pozostałe z `123` w tytule). Reszta znika do momentu wyczyszczenia pola.

## Zakres

Filtrowanie **nazwy** rozdania (`deal.title`). Bez zmian w SRS, w danych i w
sposobie ładowania rozdań. Filtr jest narzędziem nawigacyjnym — nie zmienia
tego, co użytkownik ma dziś do powtórki.

## Decyzje

### D1. Filtr obejmuje wyłącznie główną listę

Zapytanie filtruje **tylko listę pogrupowaną po kategoriach**. Nietknięte
zostają:

- blok `★ Rekomendowane na dziś` ([`Sidebar.tsx:112`](../src/components/Sidebar.tsx))
  — to podpowiedź planisty SRS, a nie część biblioteki. Filtrowanie go sprawiłoby,
  że szukanie `123` potrafiłoby wyczyścić jedyne miejsce mówiące, co dziś ćwiczyć.
- liczniki w stopce (`NEW / LEARNING / MASTERED`) — pozostają globalne. Liczniki
  cicho zmieniające się od wpisanego tekstu to gotowe zgłoszenie błędu.

### D2. Dopasowanie: normalizacja + tokeny AND

Tytuły są długie i opisowe, z polskimi znakami i myślnikiem jako separatorem
(`Test wielu lew (A) — wyciąganie atutów`). Naiwne `title.includes(query)` psuje
się na dwa sposoby, więc:

1. **Normalizacja obu stron** — `toLowerCase()` + `normalize('NFD')` z usunięciem
   znaków łączących. Dzięki temu `atutow` znajduje `atutów` (realny przypadek przy
   pisaniu na telefonie).
2. **Tokeny łączone przez AND** — zapytanie dzielone po białych znakach, każdy
   token musi wystąpić gdziekolwiek w znormalizowanym tytule, niezależnie od
   kolejności. `test atutów` znajduje rozdanie wyżej, choć nie jest jego
   spójnym podciągiem.

`123` działa dokładnie tak, jak w opisie zgłoszenia. Świadomy koszt: bardzo krótkie
zapytania są zachłanne (`a b` pasuje do prawie wszystkiego) — problem znika przy
kolejnych znakach.

Predykat trafia do wspólnego helpera `src/lib/dealSearch.ts`, bo używają go **dwa**
miejsca (panel boczny i `handleNextDeal`, patrz D5) i muszą liczyć identycznie.

### D3. Renderowanie listy: filtr przed grupowaniem

Najpierw filtrowanie rozdań, potem `reduce` do `byCategory`. Konsekwencje:

- **Kategorie bez trafień znikają w całości** — razem z nagłówkiem. Nagłówek
  z pustą zawartością za każdym razem wygląda jak błąd renderowania.
- Kolejność i grupowanie poza tym bez zmian — rozdanie zostaje tam, gdzie zawsze
  było, tylko z mniejszą liczbą sąsiadów. Etykieta kategorii to realny kontekst
  wyniku.
- **Brak trafień** → jedna spokojna linia `Brak rozdań pasujących do „…"` zamiast
  pustego miejsca, żeby panel nigdy nie wyglądał na zepsuty albo wciąż ładujący się.

Odrzucone: płaska lista przy aktywnym filtrze. Wymagałaby reguły sortowania,
drugiej ścieżki renderowania i gubiłaby kontekst kategorii.

### D4. Stan zapytania mieszka w `App`

Zapytanie trzymane w `App` i przekazywane do `Sidebar` jako `value` + `onChange`.

> Pierwotnie ustalono stan lokalny w `Sidebar`. **Zmienione przez D5** — skoro
> `handleNextDeal` ma respektować filtr, zapytanie musi być widoczne w `App`.

Zachowanie:

- **Utrzymuje się** przy wybieraniu rozdań i przeglądaniu — sens funkcji to
  „wyszukaj raz, przerób trafienia”. Automatyczne czyszczenie przy wyborze jest
  odrzucone: na mobile szuflada i tak się zamyka
  ([`App.tsx:236`](../src/App.tsx)), więc użytkownik nawet by tego nie zobaczył —
  po prostu zastałby puste pole przy następnym otwarciu.
- **Przeżywa** przejście do Admina / Mojego panelu i z powrotem, bo `App` się nie
  odmontowuje (inaczej niż `TrainerApp`, [`App.tsx:63`](../src/App.tsx),
  [`App.tsx:81`](../src/App.tsx)). Akceptowane — `✕` jest na wyciągnięcie ręki.
- **Czyszczenie**: przycisk `✕` wewnątrz pola, widoczny tylko przy niepustym
  zapytaniu, oraz `Escape` przy aktywnym polu.

### D5. `Następne →` respektuje filtr

Przycisk `Następne →` w `RatedBanner` ([`App.tsx:295`](../src/App.tsx)) chodzi dziś
po pełnej tablicy `deals` po indeksie. Przy aktywnym filtrze ma chodzić **po
przefiltrowanym zbiorze**: z trzech trafień `123` prowadzi na drugie, potem trzecie.

Zaakceptowane ryzyko: na mobile szuflada jest zamknięta, więc podczas rozwiązywania
filtr pozostaje niewidoczny. Marker na przycisku (D7) pokrywa moment, w którym filtr
faktycznie steruje nawigacją.

Bez kolizji z sesją prowadzoną: `RatedBanner` renderuje się tylko przy
`!session.active`, a wybór z panelu bocznego i tak anuluje sesję
([`App.tsx:178`](../src/App.tsx)) — bez zmian.

### D6. Koniec przefiltrowanego zbioru: przycisk wyszarzony

Dziś `handleNextDeal` to `if (nextDeal) handleSelect(...)` — bez następnego
rozdania przycisk renderuje się i nic nie robi. Przy trzech trafieniach trafia się
to non stop, więc:

Na ostatnim trafieniu przycisk **zostaje widoczny, ale nieaktywny** — przygaszony,
nieklikalny, `title="To ostatnie rozdanie pasujące do wyszukiwania"`. Layout nie
skacze, a stan tłumaczy sam siebie. Przy okazji naprawia ten sam martwy przycisk na
końcu pełnej biblioteki.

Odrzucone: ukrywanie przycisku (skok layoutu dokładnie w chwili sięgania po niego)
oraz zawijanie do pierwszego trafienia (cichy powrót do właśnie ocenionego rozdania
bez żadnej wskazówki wygląda jak pudło przycisku).

### D7. Marker tylko na etykiecie przycisku

Format `Następne (2/3) →`, gdzie liczby opisują pozycję **bieżącego** rozdania
w przefiltrowanym zbiorze. Bez filtru — zwykłe `Następne →`. Na ostatnim trafieniu
`(3/3)` i stan nieaktywny z D6.

Odrzucone: trwały chip `Filtr: „123" ✕` w górnym pasku mobile
([`App.tsx:250`](../src/App.tsx)) i w panelu głównym. Rozwiązywałby problem, który
panel boczny już tłumaczy — tekst zapytania jest widoczny w polu, obok jest `✕`,
a brak trafień ma komunikat z D3. Górny pasek mobile ma miejsce mniej więcej na
jedną rzecz.

### D8. Umiejscowienie: zawsze widoczne, stały slot

Pole renderuje się **zawsze**, w stałym miejscu bezpośrednio nad kontenerem
przewijania: pod blokiem rekomendacji, gdy ten istnieje, a pod paskiem użytkownika,
gdy go nie ma (blok jest warunkowy — `dueToday.length > 0`). Przesuwa się o ~90 px
między dniem z powtórkami a dniem bez nich; zawsze jest ostatnią rzeczą przed listą.

**Poza** obszarem przewijania — zostaje na miejscu, gdy lista jedzie pod nim. Koszt
to na stałe zajęte ~40 px wysokości; alternatywa (przewijanie razem z listą) znika
dokładnie wtedy, gdy długa lista każe jej szukać.

Odrzucone: renderowanie warunkowe (np. dopiero od 10 rozdań). Kontrolka pojawiająca
się i znikająca według niewidocznej reguły jest gorsza niż 40 px i nie da się jej
zapamiętać ruchowo.

Pozostałe ustalenia tego kroku:

- **Bez autofocusa** — na mobile podnosiłby klawiaturę przy każdym otwarciu szuflady,
  zasłaniając listę, po którą się przyszło.
- **Bez licznika wyników** (`3 z 42`) — przy trzech widocznych wierszach to zbędna
  ozdoba w panelu szerokim na 256 px.
- Placeholder `Szukaj rozdania…`, ikona lupy dodana do `Icon.tsx` jako `search`
  (dziś jej tam nie ma), styl zgodny z istniejącymi polami
  (`bg-brand-soft` / `border-brand-line`).

## Pliki

| Plik | Zmiana |
| --- | --- |
| `src/lib/dealSearch.ts` | **nowy** — `normalize()` i `matchesQuery(deal, query)` (D2) |
| `src/components/Icon.tsx` | ikona `search` (D8) |
| `src/components/Sidebar.tsx` | pole wyszukiwania + `✕`/`Escape`, propsy `query`/`onQueryChange`, filtr przed `byCategory`, stan braku trafień (D1, D3, D4, D8) |
| `src/App.tsx` | stan `dealQuery`, przekazanie do `Sidebar`, `handleNextDeal` po przefiltrowanej liście, marker i stan nieaktywny w `RatedBanner` (D4, D5, D6, D7) |

## Świadomie odrzucone

- Filtrowanie bloku `Rekomendowane na dziś` i liczników w stopce (D1).
- Płaska lista wyników zamiast grupowania (D3).
- Czyszczenie zapytania przy wyborze rozdania (D4).
- `Następne →` ignorujące filtr (D5).
- Ukrywanie albo zawijanie `Następne →` na końcu zbioru (D6).
- Trwały chip filtra w panelu głównym / górnym pasku mobile (D7).
- Warunkowe renderowanie pola zależnie od wielkości biblioteki (D8).
