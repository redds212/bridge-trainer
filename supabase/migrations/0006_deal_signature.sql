-- 0006_deal_signature.sql — sygnatura rozkładu kart (blokada duplikatów przy imporcie).
-- Uruchom raz w Supabase SQL Editor. Idempotentne.
--
-- KROK 1 z 3. Sama kolumna, bez unikalnego indeksu — istniejące wiersze nie mają
-- jeszcze sygnatur, a `create unique index` nie powstałby, gdyby w tabeli były
-- kolidujące rozdania.
--
-- KROK 2: Panel administracyjny → „Przelicz sygnatury" (liczy je w JS tym samym
--         parserem, którego używa import) → przejrzyj i posprzątaj wykazane duplikaty.
-- KROK 3: 0007_deal_signature_unique.sql — zakłada unikalny indeks.
--
-- Nie liczymy sygnatur w PL/pgSQL celowo: parser notacji („10" zamiast „T", renonsy)
-- żyje w src/lib/cards.ts i druga kopia w SQL rozjechałaby się z aplikacją.

alter table public.deals add column if not exists card_signature text;

comment on column public.deals.card_signature is
  'Kanoniczna tożsamość rozkładu 52 kart (src/lib/dealSignature.ts), np. '
  '"N:SK9762.H52.DKQ7.C1063|E:…|S:…|W:…". Liczona RAZ przy INSERT i nigdy nie '
  'przeliczana przy edycji — poprawka błędnie wydrukowanej karty nie może otworzyć '
  'drogi ponownemu importowi oryginalnego pliku. NULL = mniej niż 52 znane karty '
  '(ręka ukryta bez ujawnienia) → wiersz zwolniony z unikalnego indeksu.';

-- PostgREST trzyma schemat w cache. Bez przeładowania aplikacja może przez chwilę
-- widzieć „column card_signature does not exist" mimo poprawnie dodanej kolumny.
notify pgrst, 'reload schema';
