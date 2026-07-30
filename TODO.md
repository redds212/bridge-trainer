# TODO — BridgeLoop

Pomysły do realizacji. Notatki na tyle szczegółowe, żeby wrócić do tematu po przerwie.
Stan na: 2026-06-25.

---

## 1. Timer podczas rozwiązywania rozdań — ✅ ZROBIONE (odliczanie „na czas")

**Zrealizowany wariant (2026-07-21):** opcjonalny **tryb na czas** — odliczanie w dół, którego limit zależy od opanowania danego rozdania (SRS `consecutiveCorrect`):

| poziom (`consecutiveCorrect`) | 0 (nowe) | 1 | 2 | 3 | 4 (opanowane) |
|---|---|---|---|---|---|
| limit | 2:00 | 1:15 | 0:45 | 0:25 | 0:15 |

- **Opt-in:** przełącznik w „Mój panel → Ustawienia nauki" (kolumna `profiles.timed_mode`, zapis przez `update_my_settings`). Domyślnie wyłączony.
- **Start:** wejście w fazę `decision`. **Bez pauzy** — biegnie też przy przeglądaniu lew wstecz (POPRZEDNI).
- **Po zerze (od 2026-07-30):** rozwiązanie odsłania się automatycznie **i rozdanie jest
  zaliczane jako błąd** — samoocena znika, zostaje komunikat „Czas minął — zaliczone jako
  błąd" i przycisk „Dalej", który zapisuje wynik negatywny (`handleRate(false)`, w sesji
  `session.answer(false)`). Wcześniej zero tylko odsłaniało rozwiązanie, a użytkownik i tak
  mógł kliknąć „Dobrze", więc przeczekanie czasu było bez konsekwencji.
  - Ręczne kliknięcie „Pokaż pełne rozwiązanie" **przed** zerem zatrzymuje zegar i zostawia
    normalną samoocenę — świadoma decyzja użytkownika, nie porażka na czas.
  - RESTART po wyzerowaniu nie daje świeżego czasu (sygnatura biegu nie zależy od fazy),
    więc nie da się w ten sposób wyzerować porażki.
  - Bez migracji: zapisujemy wynik, nie czas.
- **UI:** dyskretny licznik mono w rogu stołu ([src/components/DealTimer.tsx](src/components/DealTimer.tsx)); ostatnie 10 s na bursztynowo.
- **Pliki:** [src/hooks/useDealTimer.ts](src/hooks/useDealTimer.ts), [src/components/DealTimer.tsx](src/components/DealTimer.tsx), [src/App.tsx](src/App.tsx) (`TrainerApp`), [src/hooks/useSettings.ts](src/hooks/useSettings.ts), [src/components/UserPanel.tsx](src/components/UserPanel.tsx), [src/auth/AuthContext.tsx](src/auth/AuthContext.tsx), typy + [supabase/migrations/0002_timed_mode.sql](supabase/migrations/0002_timed_mode.sql).
- **⚠️ Wdrożenie:** uruchomić `0002_timed_mode.sql` w Supabase SQL Editor **przed** deployem (dodaje kolumnę + nową sygnaturę RPC).
- **Odrzucone (2026-07-30):** zapis realnego czasu do `Attempt`/historii i średnia w panelu.
  Wymagałoby migracji, a sam wynik na czas wystarcza. Użycie czasu jako sygnału SRS pozostaje
  odłożone — zachęca do pośpiechu.

<details><summary>Oryginalne notatki projektowe (przed realizacją)</summary>

**Cel:** pokazać, ile czasu zajęło rozwiązanie rozdania; opcjonalnie wykorzystać czas jako sygnał trudności/postępu.

**Do przemyślenia — jak ma działać:**
- **Kiedy start?** Najsensowniej w momencie wejścia w fazę `decision` (gdy intro lew się skończyło i użytkownik faktycznie myśli). Alternatywa: od pierwszego kroku `intro` — ale wtedy mierzymy też oglądanie rozdania, nie samo myślenie.
- **Kiedy stop?** W momencie oceny (`handleRate`) albo odsłonięcia rozwiązania (`revealSolution`). Decyzja: czy „Pokaż rozwiązanie" zatrzymuje timer, czy dopiero ocena?
- **Pauza?** Czy POPRZEDNI / przeglądanie lew wstecz ma pauzować timer? Prawdopodobnie tak — inaczej czas zawyżony.
- **Co z trybem sesji vs. swobodnym?** W sesji dziennej (`useDailySession`) czas mógłby liczyć się per rozdanie.
- **Gdzie wyświetlać?** Mały licznik mono (IBM Plex Mono) w rogu stołu lub przy `DecisionPanel`. Stonowany, żeby nie stresował.

**Warianty zakresu:**
- *Mini (tylko UI):* licznik rośnie, pokazany po ocenie („rozwiązałeś w 0:42"). Bez zapisu.
- *Ze statystyką:* zapis czasu do historii prób (`Attempt` w [src/types/index.ts](src/types/index.ts), zapisywane przez [src/hooks/useHistory.ts](src/hooks/useHistory.ts)) → średni czas w panelu użytkownika ([src/components/UserPanel.tsx](src/components/UserPanel.tsx)).
- *Jako sygnał SRS:* bardzo szybka poprawna odpowiedź = mocniej opanowane. Ryzykowne — może zachęcać do pośpiechu. Raczej odłożyć.

**Pliki, których dotknie:** [src/hooks/useGameState.ts](src/hooks/useGameState.ts) (fazy), [src/App.tsx](src/App.tsx) (`TrainerApp`, `handleRate`), [src/components/DecisionPanel.tsx](src/components/DecisionPanel.tsx). Jeśli zapis — `Attempt` + tabela w Supabase ([supabase/](supabase/)).

**Decyzja do podjęcia przed kodowaniem:** którą wersję zakresu (mini / ze statystyką / SRS).

</details>

---

## 2. Opcja zgłoszenia błędu w rozdaniu — ✅ ZROBIONE (tabela + panel admina)

**Wersja druga (2026-07-30):** zgłoszenie zapisuje się w tabeli `deal_reports`
i pojawia się w panelu admina. Pierwsza wersja składała `mailto:` — wymagała od
użytkownika własnego klienta pocztowego i ręcznego wysłania, a zgłoszenie przepadało,
jeśli klient się nie otworzył.

- **⚠️ Wdrożenie:** uruchomić [0008_deal_reports.sql](supabase/migrations/0008_deal_reports.sql)
  w Supabase SQL Editor **przed** deployem. Bez tabeli przycisk „Wyślij" zwróci błąd.
- **Pliki:** [src/components/ReportDeal.tsx](src/components/ReportDeal.tsx) (formularz),
  [src/hooks/useDealReports.ts](src/hooks/useDealReports.ts),
  [src/admin/ReportsAdmin.tsx](src/admin/ReportsAdmin.tsx) (zakładka „Zgłoszenia”).
  Przycisk wstrzykiwany do [BridgeTable](src/components/BridgeTable.tsx) propsem `report`
  (jak `timer`), żeby stół nie zależał od `useAuth` i nie psuł harnessu `?preview=table`.
- **Schemat:** `deal_id` bez klucza obcego (jak w `attempts`) — zgłoszenie przeżywa
  usunięcie rozdania; `deal_title` i `reporter_label` kopiowane w chwili zgłoszenia, żeby
  treść pozostała czytelna po edycji rozdania i po usunięciu konta. Statusy: new / seen /
  resolved. RLS: wstawiać może zatwierdzony użytkownik we własnym imieniu, czytać
  i zmieniać tylko admin.
- **Bez maila.** Zgłoszenia trzeba przeglądać w panelu; nie ma powiadomień. Dołożenie
  wysyłki to Edge Function (wzorzec: `delete-user`) plus klucz dostawcy poczty w sekretach
  Supabase — tabela jest już gotowym fundamentem, nic nie trzeba przerabiać.

<details><summary>Oryginalne notatki projektowe (wariant z tabelą — nadal aktualne, gdyby wracać)</summary>

**Cel:** użytkownik może zgłosić błąd w konkretnym rozdaniu (zła licytacja, zły układ kart, błąd w rozwiązaniu).

**UI:**
- Mały przycisk/ikonka „Zgłoś błąd" — kandydaci na lokalizację: róg stołu ([src/components/BridgeTable.tsx](src/components/BridgeTable.tsx)) albo `DecisionPanel`. Dyskretny.
- Po kliknięciu: prosty modal z polem tekstowym (opis) + automatycznie dołączony `dealId` i `title` rozdania oraz `user`.

**Dane / backend:**
- Nowa tabela w Supabase, np. `deal_reports` (kolumny: `id`, `deal_id`, `user_id`, `message`, `status` [new/seen/resolved], `created_at`).
- Klient: dodać funkcję w warstwie danych obok [src/lib/supabase.ts](src/lib/supabase.ts); typy w [src/lib/database.types.ts](src/lib/database.types.ts).
- RLS: użytkownik może wstawiać własne zgłoszenia; admin może czytać wszystkie.

**Przegląd przez admina:**
- Zakładka/sekcja w [src/admin/AdminPanel.tsx](src/admin/AdminPanel.tsx) z listą zgłoszeń, oznaczanie jako rozwiązane, szybki link do edycji rozdania ([src/admin/DealBuilder.tsx](src/admin/DealBuilder.tsx)).

**Fallback bez backendu (gdyby Supabase miało być później):** `mailto:kontakt@bridgeloop.pl` z prewypełnionym tematem zawierającym `dealId`. Szybkie do wdrożenia, ale bez panelu admina.

**Decyzja podjęta (2026-07-30):** szybki `mailto`.

</details>

---

## 3. Przejście na ikonki w niektórych miejscach — ✅ ZROBIONE

**Zrealizowany wariant (2026-07-30):** komponent [src/components/Icon.tsx](src/components/Icon.tsx)
z zestawem 10 ikon obrysowych 24×24 (`currentColor`, zaokrąglone końce).

Co zmienione:
- **ControlPanel** — znaki Unicode `⏮ ◀ ▶` zastąpione ikonami. To była najpilniejsza
  pozycja: te znaki na Androidzie potrafią wyjść jako kolorowe emoji zamiast szarej ikonki,
  a na telefonie są jedyną treścią przycisków (etykiety chowają się poniżej `md:`).
- **Sidebar** — „Wyloguj" na samą ikonę o stałej szerokości (`aria-label` + tooltip),
  „Mój panel" i „Admin" dostały ikonki obok tekstu. Rząd przy foncie 10 px był ciasny:
  dwa przyciski tekstowe urosły z ~74 px do ~97 px.
- **Konsolidacja** — hamburger, oba chevrony (panel decyzji, chip licytacji), flaga
  zgłoszenia błędu i ikona „Udostępnij" z instrukcji iOS przeniesione do wspólnego
  zestawu zamiast powtarzanych `<svg>` w plikach.

**Decyzja techniczna — inline zamiast sprite'a.** Pierwotna notatka zakładała
`<use href="/icons.svg#…">`, ale opierała się na nieistniejącym sprite (patrz sprostowanie
poniżej). Skoro trzeba było zaczynać od zera, wygrał zapis zgodny z resztą kodu — reszta
ikon też jest inline'owana. Przy okazji: żadnego dodatkowego żądania sieciowego ani pliku
do cache'owania w service workerze.

Pozostałości szablonu z `src/assets/` (`react.svg`, `vite.svg`, `hero.png`) usunięte
przy okazji — nic ich nie importowało. Repo nie ma już żadnych plików ze scaffoldu Vite.

<details><summary>Oryginalne notatki projektowe</summary>

**Cel:** zastąpić część przycisków tekstowych ikonami — czytelniej i oszczędniej miejscowo (zwłaszcza na mobile).

**Kandydaci:**
- **Wyloguj** — ikona „wyjścia" zamiast/obok tekstu w sidebarze ([src/components/Sidebar.tsx](src/components/Sidebar.tsx)). Uwaga: zostawić `aria-label`/tooltip dla dostępności.
- **Zgłoszenie błędu** (z pkt. 2) — ikona „flaga"/„!".
- Ewentualnie: Mój panel / Admin (ikony), RESTART/POPRZEDNI/NEXT w [src/components/ControlPanel.tsx](src/components/ControlPanel.tsx) (część ma już strzałki ⏮ ◀ ▶ jako tekst — można ujednolicić na prawdziwe ikony).

**Jak technicznie:**
- ⚠️ Sprostowanie do pierwotnej notatki (2026-07-30): `public/icons.svg` **nie był** spritem
  projektu — zawierał ikony Bluesky, Discorda, GitHuba i X, czyli pozostałość po szablonie
  Vite. Razem z równie nieużywanym `public/favicon.svg` (fioletowy znaczek bez związku
  z BridgeLoop) został usunięty; oba lądowały w precache service workera. Sprite trzeba
  więc zrobić od zera.
- Wzorzec komponentu ikony: jak [src/components/SuitIcon.tsx](src/components/SuitIcon.tsx). Można zrobić mały komponent `<Icon name="logout" />` używający `<use href="/icons.svg#logout">`.
- Kolory z tokenów brand (`--brand-dim`, hover `--brand-text`), spójnie z resztą.

**Zasada:** ikona bez etykiety tekstowej musi mieć `aria-label` + najlepiej tooltip (`title`). Nie psuć dostępności ani układu mobilnego.

**Decyzja podjęta (2026-07-30):** ControlPanel (najpilniejsze) + Wyloguj + ikonki przy
Mój panel / Admin. Zgłoszenie błędu dostało flagę już przy realizacji punktu 2.

</details>

---

## 4. PWA — co zostało po adaptacji na telefon (2026-07-29)

Zrobione: breakpoint `md:` zależny też od wysokości, wcięcia bezpieczne (góra/boki),
ekran „Brak połączenia" zamiast fałszywego „konto oczekuje na akceptację",
ikona maskable, `apple-mobile-web-app-title`, baner + karta „Zainstaluj",
`screenshots` w manifeście (1290×2796, `form_factor: narrow`, wyłączone z precache'u
przez `globIgnores` — czyta je tylko przeglądarka w dialogu instalacji).

Zrzuty powstały w DevTools: preset iPhone'a + **Capture screenshot** (nie „full size" —
ta wersja rozciąga stronę i psuje układ oparty na `100dvh`). Gdyby trzeba je odświeżyć:
ten sam preset dla wszystkich zrzutów, bo Chrome wymaga jednakowych proporcji, a `sizes`
musi zgadzać się co do piksela z plikiem.

**Zostało — realny tryb offline (osobny, duży temat).** Dziś service worker cache'uje
tylko powłokę; rozdania, SRS i historia idą wyłącznie z Supabase, więc bez sieci nie ma
czego trenować. Pełny offline = cache rozdań w IndexedDB + kolejka ocen synchronizowana
po powrocie sieci. Do przemyślenia przed kodowaniem: co przy konflikcie zapisu z dwóch
urządzeń i czy sesja dzienna ma się dać rozpocząć offline.

## Notatki ogólne
- Deploy: push na `master` → GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) → `bridgeloop.pl`. Praca na branchu `dev`, merge ff do `master`.
- Po dłuższej przerwie: sprawdzić, czy certyfikat HTTPS dla domeny już się wystawił i włączyć „Enforce HTTPS" w Settings → Pages.
