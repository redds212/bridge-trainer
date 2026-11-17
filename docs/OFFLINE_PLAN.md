# Tryb offline — uzgodniony plan

Stan: **plan zatwierdzony 2026-11-14. Etapy 1 i 2 wdrożone 2026-11-14 (migracja 0012,
zapis `rated_at` i `client_id`, kopia lokalna). Etap 3 wdrożony 2026-11-15, test na
iPhonie zaliczony 2026-11-17. Etap 4 (ostrzeżenie przy wylogowaniu) napisany 2026-11-17
i sprawdzony w Chrome; czeka na wdrożenie i test na iPhonie (lista na końcu pliku).**
Urządzenie docelowe: iPhone, aplikacja dodana do ekranu początkowego. Przerwy w sieci
do 24–36 godzin.

Dziś service worker trzyma tylko powłokę aplikacji; rozdania, powtórki, historia i sesja
dzienna idą wyłącznie z Supabase, więc bez sieci widać ekran „brak sieci". Celem jest
pełny trening bez sieci i wysyłka wyników po jej powrocie.

## Decyzje

### O1. Zakres

| Obszar | Offline |
|---|---|
| Rozdania i tagi | tylko odczyt (kopia lokalna, odświeżana przy każdym wejściu z siecią) |
| Sesja dzienna i dodatkowa partia | pełne |
| Oceny i powtórki (SRS) | pełne, zapis lokalny + wysyłka później |
| Historia podejść | pełna, nowe podejścia dopisywane lokalnie |
| Pomidor 🍅 | pełny (licznik nie używa sieci) |
| Ustawienia (w tym długość pomidora) | tylko odczyt |
| Zgłoszenia błędów w rozdaniach | nie — przycisk nieaktywny |
| Panel admina, edycja rozdań | nie |
| Logowanie, rejestracja, reset hasła | nie |

### O2. Konflikt ocen: późniejsza wygrywa

- Konflikt rozstrzygany **per rozdanie**; wygrywa cały wiersz powtórek z późniejszą oceną,
  wcześniejszy odpada.
- Liczy się **moment oceny** (zegar urządzenia), nie moment wysyłki.
- Gdyby daty nie było, wygrywają dane z offline.
- Historia podejść jest listą „tylko dopisz" — oba podejścia zawsze zostają.
- Zaakceptowana strata: dwie oceny tego samego rozdania na dwóch urządzeniach w jednym
  okresie offline dają krok jak po jednej ocenie (np. 27 zamiast 81). Odtwarzanie ocen
  po kolei odrzucone jako zbyt złożone.
- Zaakceptowane ryzyko: źle ustawiony zegar telefonu może wskazać złego zwycięzcę.

### O3. Sesja dzienna: kolejka z telefonu wygrywa zawsze

- Sesję i partię można rozpocząć offline.
- Po synchronizacji kolejka z telefonu zastępuje kolejkę z serwera **niezależnie od godziny**.
- Oceny łączą się per rozdanie według O2 — nic z drugiego urządzenia nie ginie.
- Przy wznowieniu pomijane są rozdania ocenione już dziś na dowolnym urządzeniu; jeśli
  nie zostaje żadne, sesja zamyka się sama.
- Kolejka z poprzedniej doby odpada; telefon wysyła wtedy same oceny.
- Zaakceptowany skutek: w takim dniu można zrobić więcej rozdań niż cel dzienny.

### O4. Dostęp

- Warunek: co najmniej jedno udane wejście online na tym telefonie jako zatwierdzony
  użytkownik. Pierwsze uruchomienie bez sieci pokazuje obecny ekran „brak sieci".
- Bez limitu czasu offline.
- Cofnięcie dostępu działa z opóźnieniem: po powrocie sieci aplikacja sprawdza status,
  blokuje dostęp, kasuje lokalną kopię, a oceny zebrane w tym czasie odpadają.
- Aplikacja pokazuje, z kiedy są dane („offline, dane z …").

### O5. Akcje cofające i kasujące

| Akcja | Offline |
|---|---|
| RESTART (cofnięcie oceny) | działa — zwykły zapis z godziną, podlega O2 |
| Oznaczenie „trudne" | działa |
| Porzucenie wstrzymanej sesji | działa |
| Reset pojedynczego rozdania | działa — zapis „skasowane o godzinie X", późniejsza ocena z innego urządzenia wygrywa |
| Wyczyść cały postęp powtórek | zablokowane, „wymaga połączenia" |
| Wyczyść całą historię | zablokowane, „wymaga połączenia" |

### O6. Synchronizacja

- Tylko przy otwartej aplikacji (iPhone nie ma wysyłki w tle): gdy wraca sieć, przy
  otwarciu aplikacji i przy powrocie do niej.
- Kolejność: najpierw wysyłka własnych zapisów, potem pobranie świeżego stanu.
- Znacznik w nagłówku: brak (zsynchronizowane) / „offline · N do wysłania" / „wysyłanie…" /
  „nie udało się wysłać, ponowię".
- Błąd wysyłki nie kasuje kolejki; ponowienie przy następnej okazji.
- Kolejka leży w pamięci telefonu (IndexedDB), przeżywa zamknięcie aplikacji.
- Brak sieci wykrywany po nieudanym zapytaniu, nie po `navigator.onLine`.

### O7. Wylogowanie

- Z siecią: wysyłka kolejki → wylogowanie → kasowanie lokalnej kopii użytkownika
  (rozdania mogą zostać).
- Bez sieci, coś czeka: ostrzeżenie „masz N niewysłanych ocen, wylogowanie je skasuje",
  przyciski „Zostań" / „Wyloguj mimo to".
- Bez sieci, nic nie czeka: od razu, z kasowaniem kopii.
- Logowanie na inne konto wymaga sieci; dane dwóch kont nigdy się nie mieszają.

### O8. Rozdania zmienione na serwerze w czasie offline

| Zmiana | Po synchronizacji |
|---|---|
| Dodane | pojawiają się po pobraniu kopii |
| Poprawione | ocena wystawiona na starej wersji zostaje; telefon pobiera nową wersję |
| Zarchiwizowane | ocena zostaje; rozdanie znika z kolejki |
| Usunięte na stałe | ocena odpada bez komunikatu |

Wersjonowanie rozdań odrzucone.

## Założenia techniczne (decyzje wykonawcy)

- Nowa migracja bazy (`0012_offline_sync.sql`): chwila zapisu wiersza powtórek w osobnej
  kolumnie `rated_at` (`last_seen` się nie nadaje, bo RESTART przywraca starą wartość),
  reguła O2 pilnowana wyzwalaczem po stronie serwera, `client_id` w podejściach jako
  ochrona przed podwójnym zapisem przy ponowieniu wysyłki.
- Zegar ustawiony w przyszłość jest przycinany do czasu serwera, żeby nie blokował wiersza.
- Reset pojedynczego rozdania (O5) w etapie 3 zostanie zapisem wpisu „nowe" z godziną,
  nie kasowaniem wiersza — inaczej spóźniona wcześniejsza ocena by go wskrzesiła.
- Aplikacja online też zapisuje godzinę oceny, żeby porównanie działało w obie strony.
- Supabase nadal nie trafia do cache'u service workera; kopia lokalna to osobny magazyn
  w IndexedDB.
- iPhone: wymagana instalacja na ekranie początkowym (karta Safari traci dane po 7 dniach
  nieużywania; zainstalowana aplikacja ma osobną pamięć).

## Etapy wdrożenia

Każdy etap wdrażany osobno, żaden nie zmienia działania online. Etapy 1 i 2 mają poleżeć
na produkcji co najmniej dzień przed etapem 3.

1. **Baza** — migracja, reguła O2 na serwerze, ochrona przed duplikatami. Niewidoczne.
2. **Kopia lokalna** — profil, rozdania, powtórki, historia zapisywane w telefonie; bez
   sieci aplikacja otwiera się do przeglądania, trening wyszarzony.
3. **Trening offline** — kolejka zapisów, synchronizacja, znacznik stanu, sesja i partia
   offline (O2, O3, O5, O6).
4. **Domknięcie** — wylogowanie (O7), wyszarzone akcje, kasowanie kopii po cofnięciu
   dostępu (O4).

## Testowanie

- Wykonawca: testy automatyczne reguł łączenia (scenariusze z O2, O3, O5) i przejście
  przepływu w Chrome z odciętą siecią po każdym etapie.
- Właściciel: lista kontrolna na iPhonie w trybie samolotowym po etapach 2 i 3
  (ok. 10 minut na etap). iPhone'a nie da się sprawdzić z komputera.

## Etap 2 — jak działa kopia lokalna

- Magazyn: IndexedDB `bridgeloop-offline`, słownik klucz → wartość (`src/lib/localCache.ts`).
  Klucze per konto: `profile`, `deals`, `srs`, `attempts`, `session`.
- Kopia powstaje przy każdym udanym wczytaniu online i podąża za stanem w pamięci, więc
  obejmuje też oceny wystawione po wczytaniu.
- Brak sieci rozpoznajemy po nieudanym zapytaniu (`src/lib/network.ts`). Hooki danych
  czytają wtedy z kopii. W etapie 2 pomijały każdą mutację; od etapu 3 zapisy idą do
  kolejki (niżej), a wyłączone zostaje tylko to, co wymaga sieci według O1 i O5.
- Tożsamość zalogowanego konta jest pamiętana osobno (`bridgeloop.identity` w
  localStorage). Po godzinie bez sieci token wygasa, a supabase-js zwraca wtedy
  `session: null` — bez własnego zapisu aplikacja pokazałaby ekran logowania.
- Przy wygasłym tokenie supabase-js ponawia odświeżanie przez ok. 30 s. Dlatego po 2,5 s
  bez odpowiedzi aplikacja startuje z kopii, a wylogowanie offline usuwa sesję z dysku
  samo, bez `signOut()`.
- Kopia konta jest kasowana przy wylogowaniu i gdy serwer potwierdzi brak dostępu.

## Lista kontrolna iPhone — etap 2

Warunek: aplikacja dodana do ekranu początkowego i uruchamiana z ikony.

1. Z siecią: otwórz aplikację, poczekaj na ekran główny, oceń jedno rozdanie.
2. Zamknij aplikację (wyrzuć z listy otwartych). Włącz tryb samolotowy.
3. Otwórz aplikację. Oczekiwane: żółty pasek „Offline · dane z … · przeglądanie bez
   oceniania" i informacja, że trening wymaga połączenia. Nie ekran „Brak połączenia".
4. Otwórz menu: lista rozdań jest pełna, a rozdanie z punktu 1 ma status po ocenie.
5. Otwórz dowolne rozdanie, przejdź do decyzji, odsłoń rozwiązanie. Oczekiwane:
   rozwiązanie widać, zamiast przycisków oceny jest napis „Offline — ocena wymaga
   połączenia".
6. „Mój panel": statystyki i historia są widoczne, ustawienia wyszarzone, „Usuń postępy"
   nieaktywne.
7. Zostaw telefon w trybie samolotowym na ponad godzinę, potem otwórz aplikację.
   Oczekiwane: po 2–3 sekundach znów tryb offline, nie ekran logowania.
8. Wyłącz tryb samolotowy i wróć do aplikacji. Oczekiwane: pasek znika sam albo po
   „Połącz", wracają przyciski sesji i oceny.

## Etap 3 — jak działa kolejka zapisów

- Każdy zapis postępów idzie przez kolejkę (`src/lib/outbox.ts`), także online: ocena,
  podejście i stan sesji trafiają do pamięci i do IndexedDB (klucz `outbox`), a stamtąd
  do Supabase. Z siecią wysyłka następuje od razu, więc online nic się nie zmienia.
- Kolejka jest scalona: jeden wiersz powtórek na rozdanie (ostatni zapis zastępuje
  poprzedni), lista podejść „tylko dopisz", jeden ostatni stan sesji (migawka albo jej
  skasowanie).
- Kopia lokalna podąża za stanem w pamięci także bez sieci, więc oceny wystawione offline
  przeżywają zamknięcie aplikacji.
- Wczytanie danych zawsze zaczyna się od wysyłki kolejki, dopiero potem idzie pobranie
  (O6). Na pobrany stan nakładane są zapisy, które jeszcze nie wyszły.
- Okazje do wysyłki: każdy nowy zapis, zdarzenie `online`, powrót do aplikacji, co dwie
  minuty przy otwartej aplikacji, przycisk w pasku stanu. W trybie offline z logowania
  wysyłka stoi, dopóki odświeżenie profilu nie potwierdzi sieci i dostępu (O4).
- Powrót sieci odświeża dane po cichu — bez ekranu ładowania, rozdanie i sesja w toku
  zostają na stole.
- Pasek stanu: „Offline · dane z … · N do wysłania" (start bez sieci), „Offline · N do
  wysłania" (sieć padła w trakcie), „Wysyłanie… (N)", „Nie udało się wysłać (N) · ponowię".
  N to liczba rozdań z niewysłanymi zapisami.
- Reguły:
  - O2 — rozstrzyga wyzwalacz bazy po `rated_at`; telefon po wysyłce pobiera wynik.
  - O3 — stan sesji z telefonu nadpisuje wiersz na serwerze; migawka z poprzedniej doby
    nie jest wysyłana; kasowanie dotyczy tylko migawki z tej samej albo starszej doby.
    Sesja pomija rozdania ocenione dziś poza nią (swobodna gra, inne urządzenie) — także
    online; gdy nie zostaje żadne, zamyka się sama.
  - O5 — reset rozdania i RESTART to zapis wiersza „nowe" z godziną, nie kasowanie.
    „Wyczyść historię" i „Usuń postępy" wymagają sieci i czyszczą dopiero po
    potwierdzeniu z bazy.
  - O8 — ocena rozdania usuniętego na stałe odpada przy wysyłce (błąd klucza obcego),
    reszta wsadu idzie dalej.
  - O4, O7 — cofnięty dostęp i wylogowanie kasują kolejkę razem z kopią; wylogowanie
    z siecią najpierw wysyła kolejkę. Ostrzeżenie przy wylogowaniu — etap 4, niżej.

## Lista kontrolna iPhone — etap 3

Warunek: aplikacja uruchamiana z ikony, po wdrożeniu otwarta raz z siecią.

1. Z siecią: otwórz aplikację, zacznij sesję dzienną, oceń jedno rozdanie, przerwij sesję.
2. Zamknij aplikację. Włącz tryb samolotowy. Otwórz aplikację.
   Oczekiwane: pasek „Offline · dane z …" i przycisk „Wznów sesję".
3. Wznów sesję i oceń dwa rozdania. Oczekiwane: sesja idzie dalej, pasek pokazuje
   „2 do wysłania".
4. Przerwij sesję, wybierz z listy inne rozdanie i oceń je. Oczekiwane: „3 do wysłania".
5. Zamknij aplikację (wyrzuć z listy otwartych) i otwórz ponownie, dalej w trybie
   samolotowym. Oczekiwane: nadal „3 do wysłania", sesja czeka w tym samym miejscu,
   ocenione rozdania mają na liście nowy status.
6. „Mój panel": historia zawiera oceny z punktów 3–4; „Usuń postępy" jest nieaktywne.
7. Wyłącz tryb samolotowy i wróć do aplikacji. Oczekiwane: pasek znika w kilka sekund
   (sam albo po „Połącz"), rozdanie na stole się nie resetuje.
8. Na komputerze otwórz bridgeloop.pl. Oczekiwane: oceny z punktów 3–4 są w historii
   i w powtórkach, a wstrzymana sesja jest tą z telefonu.
9. Konflikt: w trybie samolotowym oceń na telefonie rozdanie X. Potem na komputerze oceń
   to samo rozdanie X inaczej. Wyłącz tryb samolotowy. Oczekiwane: na obu urządzeniach
   zostaje ocena z komputera (późniejsza), a w historii są oba podejścia.

## Etap 4 — wylogowanie z niewysłanymi ocenami

- Przycisk „Wyloguj" najpierw próbuje wysłać kolejkę (z siecią), potem liczy, co w niej
  zostało. Pusta kolejka — wylogowanie od razu, jak dotąd.
- Coś zostało (brak sieci albo błąd bazy): okno „Niewysłane oceny — oceny za N rozdań nie
  dotarły jeszcze na serwer. Wylogowanie je skasuje." z przyciskami „Zostań" i „Wyloguj
  mimo to". „Zostań" niczego nie rusza; „Wyloguj mimo to" kasuje kolejkę i kopię (O7).
- Ekran „konto oczekuje na akceptację" i ekran nowego hasła wylogowują bez pytania — te
  konta nie mają czego wysyłać.

## Lista kontrolna iPhone — etap 4

1. Z siecią: otwórz aplikację, wyloguj się i zaloguj ponownie. Oczekiwane: bez okna.
2. Włącz tryb samolotowy, oceń dwa rozdania, wybierz „Wyloguj". Oczekiwane: okno
   „Niewysłane oceny" z „2 rozdania".
3. „Zostań". Oczekiwane: okno znika, pasek dalej pokazuje „2 do wysłania".
4. Wyłącz tryb samolotowy, poczekaj aż pasek zniknie, wybierz „Wyloguj". Oczekiwane:
   wylogowanie bez okna, a na komputerze oceny z punktu 2 są w historii.
