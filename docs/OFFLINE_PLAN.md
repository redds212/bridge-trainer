# Tryb offline — uzgodniony plan

Stan: **plan zatwierdzony 2026-11-14. Etap 1 napisany (migracja 0012 + zapis `rated_at`
i `client_id` w aplikacji), czeka na uruchomienie migracji w Supabase i wdrożenie.**
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
