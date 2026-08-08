# Plan: stan „brak licytacji" (zero odzywek)

Data ustaleń: 2026-08-08. Status: **zaimplementowane i zweryfikowane** (2026-08-08).

## Problem

Rozdanie może nie mieć zapisanej licytacji (`deal.bidding` puste). Dziś w takim
przypadku:

- **Desktop** — w prawym górnym rogu filcu renderuje się pusta tabela licytacji:
  sam nagłówek `W/N/E/S`, a pod nim (zależnie od rozdającego) zero albo jeden
  pusty wiersz. Wygląda jak diagram, który się nie doczytał.
- **Mobile** — chip „Licytacja" jest w pełni aktywny i otwiera arkusz z pustą
  tabelą. Stuknięcie kończy się rozczarowaniem.

**Skala: to nie jest przypadek brzegowy.** 269 z 340 plików rozdań w `imports/`
ma `"bidding": []` — ~79%. Wyszarzony stan będzie widoczny w czterech rozdaniach
na pięć i musi wyglądać jak świadoma decyzja, nie jak awaria.

## Zakres

Wyłącznie prezentacja stanu pustego. **Gdy licytacja istnieje — zero zmian**
w wyglądzie i działaniu (jeden świadomy wyjątek: patrz D3).

## Decyzje

### D1. Definicja „pustej licytacji"

Pusta = **zero odzywek**: `bidding` nie jest tablicą, jest `null`, albo
`bidding.flat().length === 0`. Kontrola defensywna, bo `bidding` idzie prosto
z JSON-a w bazie ([`useDeals.ts:48`](../src/hooks/useDeals.ts)) — bez
normalizacji i bez gwarancji ze strony typu `string[][]`.

Cztery pasy (`[["P","P","P","P"]]`) to **licytacja**, nie stan pusty. W tym
projekcie i tak nie może wystąpić — każde rozdanie ma `contract` i `declarer`,
więc rozdanie spasowane nie istnieje w danych.

### D2. Desktop — wyszarzony diagram

Panel **zostaje na swoim miejscu** w prawym górnym rogu (`w-64`, `absolute`, więc
nie wpływa na layout stołu). Zawartość:

- nagłówek `W / N / E / S` bez zmian,
- pod nim **jeden wiersz z podpisem „brak licytacji"** rozciągnięty na całą
  szerokość, zamiast pustych komórek,
- całość przygaszona (~40% krycia).

Uzasadnienie podpisu: sam szary prostokąt czyta się jak błąd ładowania. Podpis
mówi, że to stan rozdania. Uzasadnienie zachowania siatki: prawy górny róg filcu
i tak nie ma innego zastosowania, a stałe miejsce panelu oznacza, że nic nie
skacze przy przechodzeniu między rozdaniami z licytacją i bez.

Efekt uboczny (pożądany): znika dzisiejsza niespójność wysokości pustej tabeli
zależna od rozdającego — pochodna pętli budującej wiersze w
[`BiddingTable.tsx:49-61`](../src/components/BiddingTable.tsx).

Objaśnienia alertów (`bidAlerts`) nie wymagają osobnej obsługi: filtr
`flat[a.index] !== undefined` przy pustej licytacji i tak daje pustą listę, a
blok renderuje się warunkowo.

### D3. Mobile — zablokowany chip „Licytacja"

- `<button disabled>` ze wzorcem z [`ControlPanel.tsx:22`](../src/components/ControlPanel.tsx):
  `disabled:cursor-not-allowed disabled:opacity-30`,
- **chevron znika** (nie ma czego rozwijać — strzałka obiecywałaby akcję, której
  nie będzie),
- `aria-expanded` znika (nic nie jest rozwijalne),
- dochodzi `title` / `aria-label`: „Brak licytacji w tym rozdaniu".

Arkusz nie renderuje się przy pustej licytacji.

**Zmiana zachowania (świadoma):** stan `sheetOpen` jest zerowany **przy każdej
zmianie rozdania**, także między rozdaniami z licytacją. Powód: `BridgeTable`
nie dostaje `key` w [`App.tsx:286`](../src/App.tsx), więc stan przeżywa zmianę
rozdania. Bez zerowania da się wejść w stan, w którym arkusz jest otwarty nad
rozdaniem bez licytacji, a chip, którym normalnie się go zamyka, jest już
zablokowany. Wybrano prostszą regułę (zawsze zeruj) zamiast warunkowej, kosztem
drobnej różnicy wobec dzisiejszego zachowania.

### D4. Założenia (vulnerability) na telefonie — świadoma strata

Arkusz licytacji to dziś jedyne miejsce na telefonie, gdzie widać
`vulnerability` (stopka arkusza, [`BridgeTable.tsx:277-282`](../src/components/BridgeTable.tsx)).
Po zablokowaniu chipa ta informacja **znika z telefonu w rozdaniach bez
licytacji** — razem z kategorią i trudnością (te dwie zostają dostępne na liście
rozdań w sidebarze).

Decyzja: **akceptujemy stratę.** Rozważane i odrzucone: dodanie założeń do paska
chipów na stałe oraz osobny mini-chip pokazywany tylko przy pustej licytacji —
oba wykraczały poza „gdy licytacja istnieje, zostaw jak było".

Jeśli w przyszłości okaże się, że brak założeń na telefonie przeszkadza —
najtańsza poprawka to rozszerzenie `ContractChip` o założenia.

## Poza zakresem

- Oznaczanie rozdań bez licytacji na liście w sidebarze.
- Zmiany w `DealBuilder` / panelu admina (`BiddingTable` nie jest tam używany —
  jedyny konsument to `BridgeTable`).
- Uzupełnianie brakujących licytacji w danych.

## Zmienione pliki

| Plik | Zmiana |
| --- | --- |
| [`src/lib/bidding.ts`](../src/lib/bidding.ts) | Nowy: predykat `hasBidding` — jedno źródło prawdy dla obu widoków (D1) |
| [`src/components/BiddingTable.tsx`](../src/components/BiddingTable.tsx) | Stan pusty: `EmptyBidding` — wyszarzenie + wiersz „brak licytacji" (D2) |
| [`src/components/BridgeTable.tsx`](../src/components/BridgeTable.tsx) | Blokada chipa, guard arkusza, zerowanie `sheetOpen` przy zmianie rozdania (D3) |

Dwa odstępstwa od planu, oba wymuszone przez lintera i oba na korzyść:

- Predykat trafił do osobnego modułu w `lib/`, a nie do `BiddingTable.tsx` —
  eksport funkcji z pliku komponentu psuje fast refresh (`react-refresh/only-export-components`).
- `sheetOpen` zerowany **korektą stanu w trakcie renderu** (porównanie `deal.id`
  z zapamiętanym `sheetDealId`), a nie w `useEffect` — reguła
  `react-hooks/set-state-in-effect`. Efekt uboczny jest lepszy: React powtarza
  render natychmiast, więc nie ma klatki z arkuszem nad nowym rozdaniem.

## Weryfikacja (wykonana na `?preview=table`, 375×812 i 1280×800)

1. Desktop, rozdanie z licytacją — panel bez zmian (`Pas 1♥ Pas 4♥ Pas Pas Pas`). ✅
2. Desktop, rozdanie bez licytacji — nagłówek `W/N/E/S` + „brak licytacji",
   panel 256×50 px, krycie 0.4, kolor `brand-dim`. Wysokość niezależna od
   rozdającego, bo `EmptyBidding` w ogóle go nie czyta. ✅
3. Mobile, rozdanie z licytacją — chip aktywny, krycie 1, strzałka obecna,
   `aria-expanded` przełącza się `false` → `true`, arkusz się otwiera. ✅
4. Mobile, rozdanie bez licytacji — `disabled`, krycie 0.3, `cursor: not-allowed`,
   brak strzałki, brak `aria-expanded`, `title="Brak licytacji w tym rozdaniu"`,
   kliknięcie nie otwiera arkusza. ✅
5. Mobile, otwarty arkusz → zmiana rozdania — arkusz zamknięty, chip zablokowany. ✅
6. `tsc --noEmit` i `eslint` na zmienionych plikach — czysto. Konsola bez błędów. ✅

Zrzutów ekranu nie ma: panel przeglądarki był w tej sesji ukryty, więc weryfikacja
poszła przez odczyt DOM i styli wyliczonych, nie przez obraz.
