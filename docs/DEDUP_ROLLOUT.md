# Wdrożenie blokady duplikatów — krok po kroku

Instrukcja operacyjna. Projekt i uzasadnienie decyzji: [DEDUP_PLAN.md](DEDUP_PLAN.md).

Całość zajmuje kilkanaście minut. Kroki 1–2 są obowiązkowe **zanim** nowa wersja aplikacji
trafi do użytkowników. Kroki 3–6 możesz zrobić spokojnie później.

| Krok | Co robisz | Gdzie |
|---|---|---|
| 1 | Migracja `0006` — dodaje kolumnę | Supabase SQL Editor |
| 2 | Sprawdzasz, że kolumna jest | Supabase SQL Editor |
| 3 | „Przelicz sygnatury" | Panel administracyjny |
| 4 | Sprzątasz duplikaty, jeśli są | Panel + SQL Editor |
| 5 | Migracja `0007` — unikalny indeks | Supabase SQL Editor |
| 6 | Import 150 plansz + test kontrolny | Panel administracyjny |

---

## Krok 0 — zanim zaczniesz

**Kolejność ma znaczenie.** Nowy kod zapisuje kolumnę `deals.card_signature`. Jeśli aplikacja
ruszy przed migracją `0006`, każdy zapis rozdania padnie na `column "card_signature" does not exist`.

- Pracujesz tylko lokalnie (`npm run dev`)? Wystarczy, że zrobisz krok 1 przed dodaniem
  kolejnego rozdania.
- Masz wersję wystawioną publicznie? **Najpierw krok 1, potem deploy.**

Potrzebujesz konta z `is_admin = true` — panel administracyjny i cała ścieżka importu są za tym.

---

## Krok 1 — migracja 0006 (kolumna)

Plik w repo: **`supabase/migrations/0006_deal_signature.sql`**

1. Wejdź na [supabase.com](https://supabase.com) → Twój projekt → **SQL Editor** (ikona w lewym menu).
2. **New query**.
3. Wklej całość poniżej i naciśnij **Run** (albo `Ctrl+Enter`).

```sql
-- 0006_deal_signature.sql — sygnatura rozkładu kart (blokada duplikatów przy imporcie).
alter table public.deals add column if not exists card_signature text;

comment on column public.deals.card_signature is
  'Kanoniczna tożsamość rozkładu 52 kart (src/lib/dealSignature.ts), np. '
  '"N:SK9762.H52.DKQ7.C1063|E:…|S:…|W:…". Liczona RAZ przy INSERT i nigdy nie '
  'przeliczana przy edycji — poprawka błędnie wydrukowanej karty nie może otworzyć '
  'drogi ponownemu importowi oryginalnego pliku. NULL = mniej niż 52 znane karty '
  '(ręka ukryta bez ujawnienia) → wiersz zwolniony z unikalnego indeksu.';

-- PostgREST trzyma schemat w cache — bez tego aplikacja może przez chwilę
-- nie widzieć nowej kolumny.
notify pgrst, 'reload schema';
```

Oczekiwany wynik: `Success. No rows returned`. Migracja jest idempotentna — ponowne
uruchomienie niczego nie zepsuje.

---

## Krok 2 — sprawdź, że kolumna istnieje

```sql
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'deals' and column_name = 'card_signature';
```

Musi zwrócić **jeden wiersz**: `card_signature | text | YES`.

Jeśli wróci pusto — krok 1 się nie wykonał. Jeśli wiersz jest, a aplikacja dalej krzyczy
o brakującej kolumnie, przeładuj cache ręcznie:

```sql
notify pgrst, 'reload schema';
```

Od tego momentu możesz bezpiecznie wypuścić nową wersję aplikacji.

---

## Krok 3 — „Przelicz sygnatury"

Rozdania dodane **przed** tą zmianą mają `card_signature = NULL`, a `NULL` jest zwolniony
z unikalnego indeksu. Bez tego kroku właśnie te rozdania — najbardziej narażone na
przypadkowy ponowny import — zostałyby bez ochrony.

1. Otwórz aplikację, zaloguj się jako administrator.
2. **Panel administracyjny → zakładka Rozdania**.
3. Nad tabelą pojawi się panel **„Sygnatury rozkładu"** z licznikiem, np.
   *„Sygnatury rozkładu: 0/168 podpisanych · 168 do uzupełnienia"*.
4. Kliknij **„Przelicz sygnatury"**.
5. Poczekaj — przy ~170 rozdaniach to kilka sekund. Na końcu zobaczysz zielony komunikat:
   *„Uzupełniono sygnatury: N. Zwolnionych (mniej niż 52 karty): M."*

**Co znaczy „zwolnionych"?** To rozdania, w których nie da się odtworzyć wszystkich 52 kart
(ukryta ręka bez ujawnienia w rozwiązaniu). Zostają z `NULL` na stałe i nie podlegają kontroli
duplikatów. To celowe — inaczej dwa puste szkice z kreatora kolidowałyby ze sobą.

Panel znika sam, kiedy nie ma już nic do zrobienia.

Sprawdzenie w SQL, gdyby coś budziło wątpliwości:

```sql
select count(*) filter (where card_signature is not null) as podpisane,
       count(*) filter (where card_signature is null)     as bez_sygnatury,
       count(*)                                           as razem
  from public.deals;
```

---

## Krok 4 — sprzątnij duplikaty, jeśli jakieś są

Jeśli w bazie leżą już rozdania o identycznym rozkładzie, panel z kroku 3 pokaże czerwoną
sekcję **„Duplikaty już w bazie: N grup"** z listą w formacie `„Tytuł A" = „Tytuł B"`.
Bez ich usunięcia **indeks z kroku 5 się nie założy**.

Pełna lista w SQL:

```sql
select card_signature,
       count(*)                             as ile,
       array_agg(id    order by created_at) as ids,
       array_agg(title order by created_at) as tytuly
  from public.deals
 where card_signature is not null
 group by card_signature
having count(*) > 1;
```

### Którą kopię zostawić

**Usunięcie rozdania kasuje kaskadowo `srs_progress` — czyli całą historię powtórek z nim
związaną.** Zostaw tę kopię, która ma postępy. Sprawdź to, podstawiając identyfikatory z zapytania wyżej:

```sql
select d.id, d.title, d.created_at,
       count(s.user_id) as uzytkownikow_z_postepem,
       max(s.last_seen) as ostatnio_widziane
  from public.deals d
  left join public.srs_progress s on s.deal_id = d.id
 where d.id in ('deal-XXXX', 'deal-YYYY')
 group by d.id, d.title, d.created_at
 order by uzytkownikow_z_postepem desc;
```

Potem usuń nadmiarową kopię — **w panelu**, nie w SQL: przycisk *Usuń* (archiwizuje),
a następnie na zarchiwizowanym *Usuń trwale*. Panel ma potwierdzenie, SQL nie.

> Uwaga: archiwizacja **nie wystarczy**. Zarchiwizowany wiersz nadal jest w tabeli i nadal
> blokuje założenie indeksu. Duplikat trzeba usunąć trwale.

Alternatywa, jeśli wolisz zachować oba rozdania: zmień karty w jednym z nich w edytorze —
ale to **nie zmieni** jego zapisanej sygnatury (jest zamrożona). Wtedy trzeba wyczyścić ją
ręcznie i przeliczyć od nowa:

```sql
update public.deals set card_signature = null where id = 'deal-XXXX';
```

…po czym ponownie kliknąć „Przelicz sygnatury".

---

## Krok 5 — migracja 0007 (unikalny indeks)

Plik w repo: **`supabase/migrations/0007_deal_signature_unique.sql`**

Dopiero teraz. SQL Editor → New query → wklej → Run:

```sql
-- 0007_deal_signature_unique.sql — unikalny indeks na sygnaturze rozkładu.
do $$
declare
  dup_groups int;
  unsigned_rows int;
begin
  select count(*) into dup_groups
    from (
      select card_signature
        from public.deals
       where card_signature is not null
       group by card_signature
      having count(*) > 1
    ) d;

  if dup_groups > 0 then
    raise exception
      'Nie mogę założyć indeksu: % grup rozdań ma tę samą sygnaturę. Posprzątaj je najpierw.',
      dup_groups;
  end if;

  select count(*) into unsigned_rows from public.deals where card_signature is null;

  if unsigned_rows > 0 then
    raise notice
      'Uwaga: % wierszy bez sygnatury — są zwolnione z indeksu.', unsigned_rows;
  end if;
end $$;

create unique index if not exists deals_card_signature_key
  on public.deals (card_signature)
  where card_signature is not null;
```

Możliwe wyniki:

- **`Success`** — gotowe, duplikat jest od teraz niemożliwy do zapisania.
- **`ERROR: Nie mogę założyć indeksu: N grup…`** — bezpiecznik zadziałał. Wróć do kroku 4.
  Nic nie zostało zmienione.
- **`NOTICE: Uwaga: N wierszy bez sygnatury`** — to tylko informacja, indeks powstał.
  Jeśli N jest większe niż liczba rozdań z ukrytymi rękami, wróć do kroku 3.

Sprawdzenie:

```sql
select indexname from pg_indexes
 where schemaname = 'public' and tablename = 'deals' and indexname = 'deals_card_signature_key';
```

---

## Krok 6 — import plansz i test kontrolny

1. Panel administracyjny → **Importuj JSON**.
2. W oknie wyboru plików przejdź do `imports/vec-part1/` i zaznacz **wszystkie** pliki
   `board-*.json` naraz (`Ctrl+A`, potem odznacz `euvc.json`, `PLAN.md`, `REVIEW-NOTES.md`
   — albo zaznacz je i tak, `.md` nie przejdzie filtra, a `euvc.json` zostanie wyłapany jako duplikat).
3. Poczekaj na raport.

Spodziewany wynik przy czystej bazie: **„Zaimportowano 150 · pominięto 0 duplikatów"**.

### Test, że blokada naprawdę działa

Zaimportuj **te same pliki jeszcze raz**. Musisz zobaczyć:

> Zaimportowano **0** · pominięto **150** duplikatów

…z rozwijaną listą, gdzie każdy wpis wygląda jak
`„Rozdanie 100 (Rosja)" → „Rozdanie 100 (Rosja)" (w bazie)`.

Drugi test — wrzuć sam **`euvc.json`** (ten sam materiał w jednym pliku).
Wynik musi być identyczny: 0 dodanych, 150 pominiętych.

---

## Co zobaczysz w codziennej pracy

**Panel potwierdzenia (pomarańczowy).** Pojawia się, gdy plik ma tytuł już obecny w bazie,
ale **inny rozkład kart** — zwykle znaczy to, że plik został poprawiony albo kartę poprawiono
wcześniej w aplikacji. Wybierasz: *Importuj wszystko*, *Pomiń te*, *Anuluj*. Nic nie jest
nadpisywane w żadnym wariancie.

**Raport importu.** Cztery osobne koszyki, każdy z rozwijaną listą: duplikaty (ten sam rozkład),
błędy walidacji, odrzucone przez bazę, nieczytelne pliki. Duplikaty **nie są** błędami i są
liczone osobno.

---

## Rozwiązywanie problemów

| Objaw | Przyczyna | Co zrobić |
|---|---|---|
| `column "card_signature" does not exist` | Migracja 0006 nie przeszła albo PostgREST ma stary cache | Krok 2, potem `notify pgrst, 'reload schema';` |
| `duplicate key value violates unique constraint "deals_card_signature_key"` | Indeks zadziałał — próbujesz zapisać rozdanie o rozkładzie, który już jest | Nic. Aplikacja tłumaczy to na *„rozdanie o tym rozkładzie kart już istnieje w bazie"* |
| 0007 przerywa z `raise exception` | W bazie są duplikaty | Krok 4 |
| Import: „pominięto N duplikatów", a Ty ich nie widzisz w tabeli | Duplikat może być **zarchiwizowany** — indeks obejmuje też archiwum | *Pokaż zarchiwizowane* nad tabelą |
| Panel „Sygnatury rozkładu" nie znika | Zostały wiersze do uzupełnienia albo grupy duplikatów | Kliknij „Przelicz sygnatury"; jeśli licznik stoi — te rozdania nie mają kompletu 52 kart i to normalne (znikną z licznika „do uzupełnienia", zostaną w „zwolnione") |
| Ten sam board wszedł dwa razy mimo blokady | Rozkłady różnią się choćby jedną kartą (poprawka błędu druku po jednej ze stron) | To zadziałało zgodnie z projektem — kontrola tytułu miała Cię o tym ostrzec przed importem |

---

## Wycofanie zmian

Sam indeks (kontrola przestaje obowiązywać, dane zostają):

```sql
drop index if exists public.deals_card_signature_key;
```

Całość — **tylko razem z cofnięciem kodu aplikacji**, bo bieżąca wersja zapisuje tę kolumnę
przy każdym nowym rozdaniu:

```sql
drop index if exists public.deals_card_signature_key;
alter table public.deals drop column if exists card_signature;
notify pgrst, 'reload schema';
```
