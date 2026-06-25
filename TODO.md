# TODO — BridgeLoop

Pomysły do realizacji. Notatki na tyle szczegółowe, żeby wrócić do tematu po przerwie.
Stan na: 2026-06-25.

---

## 1. Timer podczas rozwiązywania rozdań

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

---

## 2. Opcja zgłoszenia błędu w rozdaniu

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

**Decyzja do podjęcia:** pełna tabela + panel admina vs. szybki `mailto`.

---

## 3. Przejście na ikonki w niektórych miejscach

**Cel:** zastąpić część przycisków tekstowych ikonami — czytelniej i oszczędniej miejscowo (zwłaszcza na mobile).

**Kandydaci:**
- **Wyloguj** — ikona „wyjścia" zamiast/obok tekstu w sidebarze ([src/components/Sidebar.tsx](src/components/Sidebar.tsx)). Uwaga: zostawić `aria-label`/tooltip dla dostępności.
- **Zgłoszenie błędu** (z pkt. 2) — ikona „flaga"/„!".
- Ewentualnie: Mój panel / Admin (ikony), RESTART/POPRZEDNI/NEXT w [src/components/ControlPanel.tsx](src/components/ControlPanel.tsx) (część ma już strzałki ⏮ ◀ ▶ jako tekst — można ujednolicić na prawdziwe ikony).

**Jak technicznie:**
- W projekcie jest już sprite SVG: [public/icons.svg](public/icons.svg) — sprawdzić, jakie ikony zawiera; ewentualnie dodać brakujące (logout, flag).
- Wzorzec komponentu ikony: jak [src/components/SuitIcon.tsx](src/components/SuitIcon.tsx). Można zrobić mały komponent `<Icon name="logout" />` używający `<use href="/icons.svg#logout">`.
- Kolory z tokenów brand (`--brand-dim`, hover `--brand-text`), spójnie z resztą.

**Zasada:** ikona bez etykiety tekstowej musi mieć `aria-label` + najlepiej tooltip (`title`). Nie psuć dostępności ani układu mobilnego.

**Decyzja do podjęcia:** które konkretnie przyciski na ikony (minimalnie: Wyloguj + Zgłoś błąd), żeby nie rozjechać spójności.

---

## Notatki ogólne
- Deploy: push na `master` → GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) → `bridgeloop.pl`. Praca na branchu `dev`, merge ff do `master`.
- Po dłuższej przerwie: sprawdzić, czy certyfikat HTTPS dla domeny już się wystawił i włączyć „Enforce HTTPS" w Settings → Pages.
