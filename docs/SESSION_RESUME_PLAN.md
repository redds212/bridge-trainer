# Plan: wznawianie przerwanej sesji dziennej

Data ustaleń: 2026-08-09. Status: **zaimplementowane w kodzie; czeka na migrację
`0010_daily_sessions.sql` w Supabase** — do czasu jej uruchomienia zapytania o
migawkę kończą się błędem w konsoli, a sesja działa jak dotąd (bez wznawiania).

Aktualizacja 2026-09-17: **bufor poprawek usunięty** — pudło idzie od razu na jutro
(D13, zastępuje D5 i D6) — oraz **dodatkowa partia** na wylosowanych rozdaniach
(D14–D16). Bez nowej migracji.

## Problem

Sesja dzienna żyje wyłącznie w pamięci. `Runtime` w
[`useDailySession.ts`](../src/hooks/useDailySession.ts) trzyma `session.slots`,
`index`, `buffer`, `bufferIndex` i `inBuffer` w `useState` — odświeżenie strony,
zamknięcie karty PWA albo kliknięcie „Przerwij" kasuje wszystko. Po przerobieniu
4 z 12 rozdań wracasz do zera.

**Kolejki nie da się odtworzyć przez ponowne wygenerowanie.**
[`generateDailySession`](../src/lib/session.ts) czyta bieżący stan SRS, a każda
odpowiedź ten stan zmienia (`applyResult` pisze od razu do `srs_progress`). Po
czterech odpowiedziach ta sama funkcja zwróci inny zestaw slotów: odpowiedziane
rozdania wypadną z puli zaległych, a na ich miejsce wejdą kolejne. Losowanie
nowych jest zaziarnione datą, ale to nie ratuje sprawy — przesuwają się powtórki
i retry. **Trzeba zapisać migawkę kolejki, nie parametry do jej odtworzenia.**

Zakres jest za to wąski, bo wyniki są już trwałe: `applyResult`,
`finalizeBufferResult` i `recordHistory` piszą do bazy po każdej odpowiedzi.
Ginie sam wskaźnik „gdzie jestem".

## Decyzje

### D1. Migawka w Supabase, jeden wiersz per użytkownik

Nowa tabela `daily_sessions`, klucz główny `user_id` — **jeden wiersz na
konto**, nadpisywany przy każdym starcie sesji. Data siedzi w zwykłej kolumnie i
służy tylko do sprawdzenia ważności (D2). Skoro migawka wygasa o północy, a nowa
sesja tego samego dnia i tak zastępuje poprzednią, wiersz per dzień niczego by
nie kupił, a wymagałby sprzątania. Zapis write-through po każdej odpowiedzi —
dokładnie ten sam wzorzec co
`srs_progress` w [`useSRS.ts`](../src/hooks/useSRS.ts): stan w pamięci jest
synchronicznym źródłem prawdy, mutacja leci optymistycznie i dopiero potem do
bazy. Sesja przeżywa zmianę urządzenia i czyszczenie danych przeglądarki.

Odrzucone: localStorage (nie przenosi się między telefonem a laptopem, ginie z
danymi PWA, może się rozjechać z SRS w bazie) i hybryda localStorage + baza
(kupuje tylko szybszy pierwszy render, płaci rozstrzyganiem konfliktów).

### D2. Migawka wygasa o lokalnej północy

Wznowienie tylko wtedy, gdy zapisane `date` równa się dzisiejszemu
`todayKey()`. Wiersz z innym dniem jest ignorowany i nadpisywany nową sesją.
Spójne z resztą systemu — całe planowanie powtórek tnie dobę lokalną północą,
bez okna łaski ([`date.ts:5`](../src/lib/date.ts)).

Nic przez to nie ginie: rozdania, na które nie zdążyłeś odpowiedzieć, mają
nietknięty wpis SRS, więc same wracają do puli — tyle że w świeżej, aktualnej
kolejce.

### D3. „Przerwij" znaczy pauza, nie skasowanie

Wyjście z sesji chowa pasek i wraca do swobodnej gry, ale wiersz w bazie
zostaje. Dotyczy wszystkich trzech dzisiejszych dróg wyjścia — przycisku
„Przerwij" ([`SessionBar.tsx:39`](../src/components/SessionBar.tsx)),
kliknięcia rozdania w liście ([`App.tsx:189`](../src/App.tsx)) i „Powtórz" z
panelu ([`App.tsx:96`](../src/App.tsx)). Sesję kończy tylko jej dokończenie albo
jawne „Zacznij od nowa".

Wznowienie jest **jawne**: po otwarciu aplikacji nie wskakujemy w sesję sami.
Przycisk startu zmienia się w „Wznów sesję (4/12)", a obok, słabiej
wyeksponowane, „Zacznij od nowa".

### D4. Kolejka adaptacyjna — cel dzienny działa od razu

Zmiana `dailyTarget` (lub trybu) przy istniejącej, wstrzymanej sesji przelicza
kolejkę **w przebiegu głównym**:

- **podniesienie celu** dopisuje sloty na koniec — najpierw z
  `deferredReviewIds` zapisanych w migawce (to powtórki, które już raz nie
  zmieściły się w limicie), potem ze świeżego generowania z **jawnym
  wykluczeniem wszystkiego, co już jest w kolejce** — zrobionego i czekającego.
  Bez tego wykluczenia `generateDailySession` poda z powrotem te same, wciąż
  zaległe powtórki. Podział nowe/powtórki dla dopisywanych slotów liczy się
  z `modeSplit` dla **nowego** celu, pomniejszonego o to, co już w kolejce;
- **obniżenie celu** ucina ogon czekających slotów, ale nigdy poniżej tego, co
  już zrobione (`index`). Cel 20 → 12 przy `index = 15` daje całość 15.

Przyjęty koszt: „całość" sesji potrafi urosnąć w trakcie dnia, więc pasek
postępu cofa się procentowo. Świadoma decyzja — licznik ma pokazywać prawdę o
dzisiejszym celu, nie stałą z chwili startu.

Gdy pula jest wyczerpana, sesja po prostu jest krótsza od celu.

### D5. Wejście w bufor zamyka przebieg główny

> **Nieaktualne od 2026-09-17** — bufora poprawek nie ma (D13).

Od momentu przejścia do bufora błędów **nic się już nie dopisuje** — zmiana celu
działa dopiero od następnej sesji. Chcesz więcej rozdań: kończysz i startujesz
nową.

Powód: bufor to poprawianie błędów z zamkniętej puli. Dopisanie do niego
świeżych rozdań kazałoby paskowi przeskakiwać z „🔁 Bufor sesji" z powrotem na
„▶ Sesja dzienna" i mieszałoby dwie różne reguły SRS — `applyAnswer` w
przebiegu głównym kontra `finalizeBuffer` w buforze, gdzie wynik zawsze resetuje
licznik i wystawia rozdanie na jutro.

### D6. W buforze nie ma pauzy, ale migawka nadal się zapisuje

> **Nieaktualne od 2026-09-17** — bufora poprawek nie ma (D13). Opisany niżej
> „cichy wyciek" zniknął razem z nim: pudło trafia do SRS-u w chwili odpowiedzi.

W fazie bufora pasek nie oferuje wyjścia (przycisk „Przerwij" znika). Bufor idzie
na raz. Zapis migawki jednak trwa, więc awaryjne zamknięcie karty, odświeżenie
albo padnięcie PWA wraca do bufora w tym samym miejscu. Nie oferujemy pauzy, ale
nie karzemy za awarię.

Wyjście bokiem — kliknięcie rozdania w liście w trakcie bufora — zachowuje się
dokładnie jak awaria: migawka zostaje, a przycisk pokazuje „🔁 Wznów poprawki".
Egzekwujemy więc brak pauzy przez nieoferowanie jej, a nie przez kasowanie
postępu; alternatywa (usuwanie wiersza przy wyjściu) karałaby za przypadkowe
kliknięcie i utrwalała wyciek opisany niżej.

**Zapisany skutek uboczny:** porzucenie sesji przed buforem zostawia cichy
wyciek. Nietrafione rozdanie z przebiegu głównego nie dostaje żadnej aktualizacji
SRS — `applyResult` woła się tylko przy trafieniu
([`useDailySession.ts:71`](../src/hooks/useDailySession.ts)), a kara jest
odłożona do `finalizeBuffer`. Jeśli bufor nigdy nie nastąpi, rozdanie zachowuje
stary licznik i nie dostaje flagi „trudne". Wznawialny przebieg główny mocno
zmniejsza szansę na taki scenariusz, ale go nie likwiduje.

### D7. Rozdanie, które zniknęło z puli, pomijamy po cichu

Jeśli między pauzą a powrotem admin zarchiwizuje rozdanie z kolejki, slot jest
przeskakiwany, a łączna liczba maleje. Inaczej sesja zacięłaby się na rozdaniu,
którego `dealsHook.deals` już nie zawiera.

### D8. Sesja jest źródłem prawdy dla swojego licznika

Rozdanie z kolejki ocenione w swobodnej grze podczas pauzy **wróci** w sesji.
Nie odejmujemy go i nie oznaczamy jako zrobione — licznik sesji liczy
odpowiedzi udzielone w sesji.

### D9. Karta „Dzisiejsza sesja" czyta migawkę, nie generuje podglądu

[`UserPanel.tsx:50`](../src/components/UserPanel.tsx) woła
`generateDailySession` przy każdym renderze, żeby pokazać rozbicie na
retry/powtórki/nowe. Przy wstrzymanej sesji ten podgląd pokaże **inny** zestaw
niż ta, do której wracasz — SRS zmienił się po czterech odpowiedziach. Gdy
migawka na dziś istnieje, karta musi renderować jej liczniki i postęp (4/12),
a przycisk zmienić się w „Wznów sesję". Świeży podgląd zostaje tylko wtedy, gdy
migawki nie ma.

### D10. Rozstrzyganie równoległych zapisów: ostatni wygrywa

Bez blokad i bez wykrywania konfliktów. Dwie karty albo dwa urządzenia z tą samą
sesją nadpiszą się nawzajem — akceptowane, bo to aplikacja jednoosobowa, a
wyniki (SRS, historia) i tak zapisują się niezależnie i nic z nich nie ginie.

### D11. Doba przełamuje się w trakcie działania aplikacji

Kolejka jest „na dziś”, więc o 00:00 czasu lokalnego wczorajsza sesja przestaje
obowiązywać — niezależnie od tego, ile z niej zostało.
[`useDayKey`](../src/hooks/useDayKey.ts) trzyma klucz doby jako stan i przełamuje
go timerem do najbliższej północy. Sam timer nie wystarcza: w karcie w tle
przeglądarka go dławi, a uśpione urządzenie przeskakuje całą noc bez jednego
tiku — dlatego dobę sprawdzamy też przy powrocie do karty
(`visibilitychange`) i przy odzyskaniu focusu.

Przy zmianie klucza [`useDailySession`](../src/hooks/useDailySession.ts) zeruje
`runtime`, `paused` i `completed` oraz kasuje wiersz w bazie, a `todayQueue`
generuje zestaw na nowy dzień. Każde przeliczenie w hooku dostaje `now` z tego
klucza (`dayNow`), więc podgląd, `start()` i migawka nigdy nie mówią o różnych
dniach — to samo w karcie „Dzisiejsza sesja” i planie powtórek (D9).

Nic przy tym nie ginie: każda udzielona odpowiedź poszła write-through do
`srs_progress` i `attempts` w momencie kliknięcia. Przepada tylko ogon
wczorajszej kolejki, który z definicji ma być policzony od nowa — pulę nowych
tasuje ziarno z daty ([`session.ts`](../src/lib/session.ts)), więc następnego dnia
wypada inny zestaw.

### D12. Listę rekomendacji filtruje SRS, licznika sesji nie

D8 mówi, że rozdanie z kolejki ocenione w swobodnej grze **wróci** w sesji i nie
odejmujemy go od licznika — to zostaje bez zmian. Ale „Rekomendowane na dziś”
odpowiada na inne pytanie: *co jest jeszcze do zrobienia dziś*. Migawka zmienia
się wyłącznie od odpowiedzi udzielonych w sesji, więc bez filtru rozdanie
rozwiązane przy pauzie wisiało na liście do końca dnia.

Dlatego `todayQueue` przepuszcza resztę migawki przez `isAnsweredToday` z
aktualnym `store`: wypada wszystko, co dziś już oceniono — trafione i pudło, bo
żadne z nich dziś nie wraca (D13). Ten sam filtr działa dla partii, której sloty
bywają przed terminem, więc sprawdzanie terminu (`isReviewDue`, jak do 2026-09-17)
wyrzucałoby je z listy od razu. Cofnięcie oceny RESTARTEM przywraca poprzedni
wpis razem z `lastSeen`, więc pozycja wraca na listę sama. Kolejność sesji zostaje
nietknięta — filtr tylko usuwa.

## Zmiany z 2026-09-17

### D13. Pudło idzie od razu na jutro — bez bufora poprawek

Dotąd nietrafione rozdanie z przebiegu głównego wracało pod koniec tej samej sesji
w buforze („🔁 Bufor sesji"), a kara (`finalizeBuffer`: jutro, licznik od zera)
zapadała dopiero tam. Teraz `answer` stosuje `applyAnswer` od razu, dla obu wyników:
pudło dostaje powtórkę na jutro i licznik od zera w chwili kliknięcia, a sesja idzie
dalej. Jutro rozdanie wchodzi do kolejki jako retry, z najwyższym priorytetem. Tego
samego dnia ocenione rozdanie już nie wraca — ani w sesji, ani w partii (D14), ani na
liście rekomendacji (D12).

Skutki:

- sesja ma jedną fazę: znikają „🔁 Bufor sesji", „Wznów poprawki", `finalizeBuffer`
  i `inBuffer` w migawce, a „Przerwij" działa do ostatniego rozdania (D5 i D6
  nieaktualne);
- zniknął cichy wyciek z D6 — porzucona sesja nie zostawia pudeł bez kary;
- `flagDifficult` nie ma już kto ustawiać; flaga tylko przechodzi dalej przy
  kolejnych ocenach, a w historii zostają dawne próby z `phase: 'buffer'`;
- kolumny `buffer`, `buffer_index`, `in_buffer` zostają w tabeli (bez migracji)
  i są zapisywane puste. Upsert nadpisuje tylko podane pola, więc bez tego stan
  zostawiony przez starszą wersję przetrwałby w wierszu.

**Przejście.** Migawka zapisana przez starszą wersję może nieść w buforze pudła, którym
nikt już nie wymierzy kary. Przy wczytaniu dzisiejszego wiersza `pendingBufferMisses`
wybiera niedomknięte (w fazie bufora — od `buffer_index`), a hook, gdy wczyta się SRS,
stosuje im `applyAnswer(…, false)`. Pomija rozdania z `lastSeen` świeższym niż
`updated_at` migawki: oceniono je już po jej zapisie (swobodna gra przy pauzie albo
kara z poprzedniego wczytania), więc ponowne wczytanie tego samego wiersza nie karze
drugi raz. Wiersz zapisany w fazie bufora ma wyczerpany przebieg główny, więc nie ma
już czego wznawiać.

### D14. Dodatkowa partia: skład

„🎲 Wylosuj partię (N)" otwiera zwartą sesję na wylosowanych rozdaniach — dalszy
trening po sesji dziennej. `generateExtraSession`:

- **rozmiar** = cel dzienny; mniejszy, gdy pula się kończy. Liczba na przycisku to
  faktyczny rozmiar (`extraBatchSize`);
- **pula** = rozdania nieocenione dziś (`isAnsweredToday`), więc kolejne partie tego
  samego dnia nie powtarzają ani siebie nawzajem, ani sesji dziennej;
- **proporcja** nowe/powtórki z trybu nauki (`modeSplit`), jak w sesji dziennej —
  inaczej skład zależałby od tego, czego akurat więcej w bibliotece. Niedobór jednej
  puli dopełnia druga;
- wśród powtórek **pierwszeństwo mają zaległe** (odłożone ponad dzienny limit). Te
  przed terminem dochodzą dopiero potem, bo trafienie wydłuża interwał tak samo jak
  w terminie, choć rozdanie nie odczekało jeszcze swojego;
- wybór i kolejność są losowe i świeże przy każdym kliknięciu. Partia nie ma
  podglądu, z którym musiałaby się zgadzać, więc ziarno z daty (jak dla nowych
  w sesji dziennej) nie jest potrzebne.

Odpowiedzi w partii liczą się w SRS i historii dokładnie jak w sesji dziennej — tak
samo jak ocena w swobodnej grze. W historii mają `phase: 'main'`: ograniczenie
`attempts.phase` w bazie innej wartości nie przepuści, a nowa wymagałaby migracji.

Odrzucone:

- losowanie z całej biblioteki bez proporcji i bez pierwszeństwa zaległych — przy
  wielu powtórkach przed terminem partie masowo rozciągałyby interwały;
- partia bez wpływu na SRS — nowe rozdanie przerobione w partii zostałoby „nowe"
  i wróciło jutro w sesji dziennej jak nieznane, a pudło nie trafiłoby na jutro.

### D15. Partia w migawce

Partia używa tego samego wiersza `daily_sessions` i tych samych mechanizmów: zapis po
każdej odpowiedzi, pauza, „Wznów partię (2 / 5)", wygaśnięcie o północy (D11),
przeskakiwanie zarchiwizowanych (D7). Typ (`DailySession.type`: `'daily' | 'extra'`)
nie ma własnej kolumny — sloty partii mają `kind: 'extra'` i po nim `sessionFromSlots`
rozpoznaje partię wczytaną z bazy. Bez migracji, więc wdrożenie nie czeka na SQL Editor.

Zmiana celu dziennego albo trybu **nie przelicza** partii (D4 dotyczy tylko sesji
dziennej): partia to stała liczba wylosowanych rozdań, a dopychanie brałoby z pul
sesji dziennej. Pasek partii jest bursztynowy („🎲 Partia dodatkowa", dawny kolor
bufora), żeby nie mylił się z sesją dzienną.

### D16. Kiedy można wylosować partię

Przycisk stoi tam, gdzie start sesji, i tylko wtedy, gdy nic nie trwa ani nie czeka
wstrzymane — jeden wiersz na konto znaczy, że nowa partia zastąpiłaby wstrzymaną sesję:

- w podsumowaniu („Sesja ukończona!" / „Partia ukończona!") jako główny przycisk — to
  moment, w którym chce się dalszego treningu. Gdy nie ma czego losować, zostaje samo
  „Zamknij";
- na ekranie powitalnym i w karcie „Dzisiejsza sesja" w panelu — obok startu sesji
  dziennej.

Wstrzymanej partii nie zaczyna się „od nowa". Zamiast tego jest „Zakończ partię" (z tym
samym dwustopniowym potwierdzeniem): porzuca resztę kolejki i wraca do wyboru między
sesją dzienną a kolejną partią. Restart tego samego rodzaju odciąłby drogę do sesji
dziennej komuś, kto wylosował partię, zanim ją zrobił.

Przy okazji dwa uszczelnienia w tym samym przepływie:

- wejście do panelu pauzuje sesję jak każde inne wyjście (D3). Wcześniej karta nie
  wiedziała o sesji w toku, a jej przyciski startu podmieniały ją bez potwierdzenia;
- po odpowiedzi w sesji rozdanie przechodzi w fazę `rated`. Po ostatniej odpowiedzi
  zostaje na stole pod podsumowaniem, a dotąd wisiały pod nim przyciski oceny —
  kliknięcie ich po „Zamknij" liczyło to samo rozdanie drugi raz jako swobodną grę.

## Kształt danych

Tabela `daily_sessions`, klucz główny `user_id`:

| kolumna | typ | zawartość |
| --- | --- | --- |
| `user_id` | `uuid` | klucz główny; FK do `auth.users`, kaskada przy usunięciu konta |
| `date` | `date` | doba lokalna migawki, porównywana po stronie klienta z `todayKey()` |
| `slots` | `jsonb` | migawka kolejki: `[{ dealId, kind }]`; `kind: 'extra'` = partia (D15) |
| `idx` | `int` | wskaźnik w przebiegu głównym (`index` jest słowem zastrzeżonym w SQL) |
| `buffer` | `jsonb` | ~~`dealId[]` nietrafionych w przebiegu głównym~~ — od D13 zawsze `[]` |
| `buffer_index` | `int` | ~~wskaźnik w buforze~~ — od D13 zawsze `0` |
| `in_buffer` | `bool` | ~~faza sesji~~ — od D13 zawsze `false` |
| `deferred_review_ids` | `jsonb` | `dealId[]` — źródło dopisywania z D4 |
| `target` | `int` | cel dzienny obowiązujący migawkę (do wykrycia zmiany) |
| `mode` | `text` | tryb nauki obowiązujący migawkę |
| `updated_at` | `timestamptz` | diagnostyka |

RLS jak przy `srs_progress` w
[`0001_init.sql`](../supabase/migrations/0001_init.sql): select/insert/update
tylko własne wiersze i tylko dla konta `approved`, delete własnych bez warunku
`is_approved` (żeby dało się posprzątać po odrzuconym koncie). Plus `grant` dla
roli `authenticated`. Migracja: `0010_daily_sessions.sql`.

Sprzątanie odpada: wiersz jest jeden i nadpisuje się przy starcie kolejnej
sesji. Migawka z wczoraj jest odrzucana przy hydratacji po dacie, a gdy doba
przełamie się przy otwartej aplikacji, wiersz kasuje się od razu (D11) — tabela
ma tyle wierszy, ile kont.

## Kolejność prac

1. **Migracja + typy** — `0010_daily_sessions.sql`, wiersz w
   [`database.types.ts`](../src/lib/database.types.ts).
2. **Trwałość w hooku** — [`useDailySession.ts`](../src/hooks/useDailySession.ts)
   dostaje `userId`, hydratację przy logowaniu, zapis po każdej odpowiedzi,
   `pause()` obok `cancel()`, `resume()` i `restart()`. Hydratacja wchodzi do
   bramki ładowania w [`App.tsx:67`](../src/App.tsx), obok `srs.loading` i
   `history.loading`.
3. **Adaptacyjne przeliczanie** — helper w
   [`session.ts`](../src/lib/session.ts) dopisujący i ucinający sloty przy
   zmianie celu (D4), wołany ze zmiany ustawień.
4. **UI paska** — [`SessionBar.tsx`](../src/components/SessionBar.tsx): „Przerwij"
   pauzuje, w fazie bufora przycisku nie ma. Obok `PausedSessionBar` — pasek
   wstrzymanej sesji w tym samym miejscu, bo po pauzie wybrane rozdanie zostaje
   na ekranie i `WelcomeScreen` (z przyciskiem „Wznów") się nie pokazuje.
5. **Wznawianie w UI** — `WelcomeScreen` ([`App.tsx`](../src/App.tsx)) i karta
   w [`UserPanel.tsx`](../src/components/UserPanel.tsx): „Wznów sesję (4/12)" +
   „Zacznij od nowa"; wyjścia z sesji przestają kasować (D3).
6. **Karta panelu na migawce** — D9.

## Uruchomienie

Migracja `0010_daily_sessions.sql` idzie tą samą drogą co poprzednie
([BACKEND_SETUP.md](./BACKEND_SETUP.md)): **SQL Editor → New query** → wklej
całość → **Run**. Sprawdzenie: w **Table Editor** pojawia się `daily_sessions`.
Przed jej uruchomieniem aplikacja działa dalej, tylko bez wznawiania — zapytanie
o migawkę kończy się błędem w konsoli i sesja startuje od zera.

## Zweryfikowane

- `tsc -b` i `npm run build` — czysto.
- 27 sprawdzeń czystej logiki kolejki (generowanie, kolejność retry → powtórki →
  nowe, limit z `modeSplit`, podnoszenie i obniżanie celu, brak duplikatów przy
  dopychaniu, „nigdy poniżej zrobionych", odłożone powtórki, zmiana trybu).
- Aplikacja startuje bez błędów w konsoli.
- **Niezweryfikowane end-to-end**: sam przepływ wznawiania wymaga uruchomionej
  migracji i zalogowanego konta.

Zmiany z 2026-09-17 (D13–D16):

- `tsc -b` i `npm run build` — czysto; lint bez nowych uwag; podglądu nie ma
  w produkcyjnym bundlu.
- 51 sprawdzeń czystej logiki: pudło → jutro i retry nazajutrz, żadne odpowiedziane
  rozdanie nie wraca tego samego dnia, skład partii w trzech trybach przez 200
  losowań, pierwszeństwo zaległych, dopełnianie niedoborów, krótsza i pusta partia,
  trzy partie z rzędu bez powtórek, typ z `kind` slotów, kara dla starego bufora
  (także idempotentność i format daty z Postgresa). Trzy celowe mutacje kodu —
  wszystkie wykryte.
- Przepływ w podglądzie `?preview=session` (prawdziwe hooki w pamięci): sesja
  dzienna z pudłami bez rundy poprawek, podsumowanie z „Wylosuj partię", partia,
  pauza i wznowienie, pauza przy wejściu do panelu, zmiana celu przy wstrzymanej
  partii, „Zakończ partię", regres „Zacznij od nowa"; układ na 375 px.
- **Niezweryfikowane end-to-end**: kara dla starego bufora na prawdziwym wierszu
  z bazy — sprawdzona tylko czysta funkcja `pendingBufferMisses`.

## Rozstrzygnięte w trakcie wdrożenia

- **Potwierdzenie przy „Zacznij od nowa"** — dwustopniowy przycisk (bez modala),
  z treścią: „Kolejka przepadnie. Wyniki dotychczasowych rozdań zostają
  w historii i w powtórkach". Tak samo w ekranie powitalnym i w panelu.
- **Dopychanie kolejki po podniesieniu celu** bierze powtórki z aktualnie
  przeliczonych pul, a nie z zapisanej listy `deferredReviewIds`. Zbiór wychodzi
  ten sam (ta sama kolejność: najbardziej zaległe pierwsze), ale odpadają
  rozdania odpowiedziane w międzyczasie w swobodnej grze. Zapisana lista została
  w wierszu, bo zasila kartę w panelu.
