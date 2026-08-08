# Punkt decyzji w połowie lewy

Status: **zaimplementowane 2026-08-08**.

## Problem

Autor wpisuje 2–3 karty lewy i klika „⚡ Ustaw tu punkt decyzji". Zapisuje się lewa
z **jedną** kartą — wyjściową. Pozostałe znikają bez ostrzeżenia.

To nie jest błąd renderowania, tylko celowe obcięcie w
[`markDecision`](../src/admin/DealBuilder.tsx) ([DealBuilder.tsx:385](../src/admin/DealBuilder.tsx)):

```ts
const partialCards: Partial<Record<Seat, string>> = { [activeTrick.leader]: activeTrick.cards[activeTrick.leader]! };
```

Builder zakładał, że punkt decyzji może wypaść **wyłącznie po wyjściu**.

### Runtime jest już gotowy

Strona gracza obsługuje niepełną lewę o dowolnej liczbie kart — nic tu nie trzeba zmieniać:

- [useGameState.ts:95](../src/hooks/useGameState.ts) — `clockwiseOrder(leader).filter(s => s in cards)`
  animuje tylko obecne miejsca; `ordered.length === 4` pilnuje, żeby niepełna lewa **nie
  weszła do `tricks` i nie doliczyła się do NS/EW**.
- [BridgeTable.tsx:54](../src/components/BridgeTable.tsx) — `buildPlayedBySeat` odejmuje karty
  z `visibleTrick`, więc ręce na diagramie zgadzają się z filcem.
- [BridgeTable.tsx:82](../src/components/BridgeTable.tsx) — `buildKnownVoids` wykrywa renonsy
  także z niepełnej lewy.
- [TrickDisplay.tsx:10](../src/components/TrickDisplay.tsx) — karty leżą w krzyżu N/W/E/S,
  więc puste pole samo w sobie wskazuje miejsce do zagrania.

Model danych też jest gotowy: `TrickStep.cards` to `Partial<Record<Seat, string>>`,
a `winner` jest opcjonalny.

**Cała zmiana mieści się w edytorze**, plus jeden drobiazg wizualny w `TrickDisplay`.

## Decyzje

### 1. ⚡ tnie dokładnie tam, gdzie stoisz — i dochodzi cofanie karty

⚡ zapisuje **wszystkie wpisane karty** (1–3). Dodatkowo w aktywnej lewie pojawia się
„← cofnij kartę".

Odrzucone: znaczniki „stop tutaj" przy każdym graczu (trzy przyciski zamiast jednego,
i tak nie ratują sytuacji, gdy chcesz podmienić kartę, a nie ją usunąć).

Powód dołożenia cofania: dziś nadmiarowe kliknięcie karty jest nieszkodliwe, bo ⚡ i tak
tnie do wyjścia. Po zmianie każde kliknięcie staje się nieodwracalne aż do „Anuluj" —
to regresja, którą wprowadzalibyśmy sami.

### 2. Przy komplecie 4 kart ⚡ znika

Punkt decyzji po **pełnej** lewie już działa i nie wymaga znacznika: koniec `introSequence`
sam przełącza fazę ([useGameState.ts:98](../src/hooks/useGameState.ts)). Gdyby ⚡ zostało
widoczne przy 4 kartach, zapisywałoby te same karty z `winner: undefined` — czyli **lewa
przestałaby się liczyć do NS/EW**. Ten sam footgun co dziś, przesunięty o trzy karty.

Odrzucone: ⚡ przy 4 kartach jako „zapisz z winnerem i zamknij sekwencję". Wymagałoby, żeby
`isDecision` stało się prawdziwą flagą (dziś [DealBuilder.tsx:177](../src/admin/DealBuilder.tsx)
wylicza je jako `!step.winner`, więc pełna lewa z decyzją nie przeżyłaby edycji) plus przycisku
„cofnij punkt decyzji" — a w grze nie zmieniłoby **niczego**.

Rekompensata w copy: pod listą lew linijka, że decyzja następuje po ostatniej lewie.

### 3. „?" pokazuje, kto jest na zagraniu

W fazie `decision` przerywany żółty „?" ląduje w polu gracza na zagraniu, nie tylko
wyjściowego. Reużywamy słownika, który gracz zna z animacji
([TrickDisplay.tsx:26](../src/components/TrickDisplay.tsx)).

Przy 3 kartach puste pole i tak jest czytelne — realną wartość ma to przy 1–2 kartach,
czyli w najczęstszym przypadku.

### 4. Niepełna lewa w środku sekwencji = błąd walidacji

Runtime taką sekwencję przyjmie, ale rozegrana lewa **nie zwiększy licznika NS/EW** — a licznik
lew jest częścią zadania w treningu rozgrywki. Autor nie ma jak tego zauważyć.

Skrót dydaktyczny („pokazuję tylko wyjście i przebitkę") da się zrobić inaczej: sekwencja nie
musi zaczynać się od pierwszej lewy.

## Zakres zmian

### `src/admin/DealBuilder.tsx`

| co | jak |
|---|---|
| `markDecision` ([:385](../src/admin/DealBuilder.tsx)) | przestaje budować `partialCards`; zapisuje `activeTrick.cards` w całości, `winner: undefined`, `isDecision: true` |
| nowe `undoCard()` | z `playOrder(leader)` bierze ostatnie miejsce z kartą, usuwa je, ustawia na nie `trickSeat` i **czyści `winner`** |
| przycisk „← cofnij kartę" | widoczny, gdy w aktywnej lewie jest ≥1 karta; obok „Anuluj" |
| warunek ⚡ ([:889](../src/admin/DealBuilder.tsx)) | `activeTrick.cards[leader] && !activeTrick.winner` — znika przy komplecie |
| copy pod listą lew | informacja, że bez ⚡ decyzja wypada po ostatniej dodanej lewie |

Czyszczenie `winner` w `undoCard` jest krytyczne: bez tego po cofnięciu z 4 na 3 karty
zostałby widoczny „✓ Dodaj lewę — wygrywa X" z nieaktualnym zwycięzcą.

Bez zmian: `fromDeal` ([:177](../src/admin/DealBuilder.tsx)) dalej wylicza
`isDecision: !step.winner` — niepełna lewa nigdy nie ma `winner`, więc round-trip edycji działa.

### `src/components/TrickDisplay.tsx` + `BridgeTable.tsx`

Nowy prop (np. `pendingSeat: Seat | null`). `BridgeTable` liczy go ze `state`: pierwsze miejsce
w kolejności zegarowej od `currentTrickLeader`, które nie ma karty — **tylko gdy
`state.phase === 'decision'`**. Placeholder wyjściowego z animacji zostaje bez zmian.

Przypadki brzegowe: pełna lewa → `pendingSeat = null`, nic się nie rysuje. Rozdanie bez
`introSequence` → `currentTrickLeader === null`, też nic (i tak leci ostrzeżenie walidacji).

### `src/lib/validateDeal.ts`

| reguła | poziom |
|---|---|
| lewa < 4 kart tylko jako **ostatnia** w `introSequence` | błąd |
| karty muszą tworzyć nieprzerwany prefiks kolejności zegarowej od wyjściowego | błąd |
| lewa < 4 kart ma `winner` | ostrzeżenie |

Dotychczasowe ostrzeżenie „wskazany wyjściowy nie ma karty"
([validateDeal.ts:70](../src/lib/validateDeal.ts)) **zostaje**: reguła o luce milczy przy lewie
zupełnie pustej (sam wyjściowy bez karty), a to jedyny przypadek, który tamto ostrzeżenie łapie.
Dotyczy też `continuationTricks`, których nowe reguły nie obejmują.

Ostrzeżenie zamiast błędu przy `winner`: runtime i tak go ignoruje przy niepełnej lewie,
dane są sprzeczne, ale gra się nie psuje.

**Świadome ograniczenie:** reguły dotyczą wyłącznie `introSequence`. `continuationTricks` są
dziś sprawdzane przez ten sam `checkTrick`, ale **nigdzie nie są renderowane** — zaostrzanie
walidacji zablokowałoby import plików na podstawie danych, których nikt nie ogląda.

## Rzeczy, których świadomie nie robimy

- **Naprawy istniejących rozdań.** Lewa z jedną kartą jest w pełni legalna (i najczęstsza),
  więc rozdań okrojonych przez ten błąd **nie da się odróżnić** od zamierzonych. Poprawka
  wyłącznie ręczna, przez autora, na rozdaniach, które pamięta.
- **Bez skutków dla dedupu.** `introSequence` jest poza sygnaturą rozdania
  ([dealSignature.ts:8](../src/lib/dealSignature.ts)) — poprawienie sekwencji nie zmienia
  tożsamości i nie tworzy duplikatu przy ponownym imporcie.
- **Edycji `continuationTricks`** w builderze (nie istnieje dziś, poza zakresem).
- **Walidacji odpowiedzi gracza** — samoocena zostaje jak jest.

## Lista kontrolna

Gra i walidacja sprawdzone 2026-08-08 (harness `?preview=table` + `validateDeal` odpalony
na 648 rozdaniach z `imports/` — **żadne nie wpadło w nowe reguły**). Builder wymaga
logowania admina, więc jego punkty przeszły tylko typecheck i przegląd kodu.

Builder (do sprawdzenia ręcznie po zalogowaniu):
- [ ] ⚡ po 1, 2 i 3 kartach zapisuje dokładnie tyle kart
- [ ] ⚡ znika po wpisaniu 4. karty; zostaje „✓ Dodaj lewę"
- [ ] „← cofnij kartę" wraca o jedno miejsce i pozwala wpisać inną kartę
- [ ] cofnięcie z 4 na 3 karty chowa „✓ Dodaj lewę" (zniknął `winner`)
- [ ] edycja zapisanego rozdania z 3-kartową lewą pokazuje ją w całości i z badge „⚡ punkt decyzji"

Gra (`deal-106`: decyzja po 2 kartach, `deal-107`: po 1):
- [x] NEXT dochodzi do niepełnej lewy i zatrzymuje się na fazie `decision`
- [x] licznik NS/EW **nie** rośnie po niepełnej lewie (`NS 3 · EW 1` przy 4 pełnych lewach)
- [x] POPRZEDNI cofa niepełną lewę i przywraca stan (`4/5`, pełna lewa, „?" znika)
- [x] „?" stoi w polu gracza na zagraniu — N przy wyjściu S+W, E przy samym wyjściu N

Walidacja:
- [x] niepełna lewa w środku → błąd
- [x] luka w kolejności → błąd
- [x] `winner` przy niepełnej lewie → ostrzeżenie, zapis możliwy
- [x] niepełna lewa na końcu → czysto
