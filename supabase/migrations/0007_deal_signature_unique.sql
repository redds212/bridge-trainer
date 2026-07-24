-- 0007_deal_signature_unique.sql — unikalny indeks na sygnaturze rozkładu.
-- Uruchom w Supabase SQL Editor DOPIERO po 0006 i po „Przelicz sygnatury" w panelu.
-- Idempotentne.
--
-- Od tego momentu duplikat jest niemożliwy do zapisania także z drugiej karty
-- przeglądarki, ze zdezaktualizowanego widoku i bezpośrednim wywołaniem Supabase.
-- Kontrola po stronie klienta służy już tylko czytelnym komunikatom.

-- ── Bezpiecznik: przerwij z sensownym komunikatem zamiast surowego błędu indeksu ──
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
      'Nie mogę założyć indeksu: % grup rozdań ma tę samą sygnaturę. Posprzątaj je najpierw (patrz zapytanie niżej).',
      dup_groups;
  end if;

  select count(*) into unsigned_rows
    from public.deals
   where card_signature is null;

  if unsigned_rows > 0 then
    raise notice
      'Uwaga: % wierszy bez sygnatury — są zwolnione z indeksu. Jeśli to nie są rozdania z ukrytymi rękami, uruchom najpierw „Przelicz sygnatury".',
      unsigned_rows;
  end if;
end $$;

create unique index if not exists deals_card_signature_key
  on public.deals (card_signature)
  where card_signature is not null;

-- ── Wykaz duplikatów (gdyby bezpiecznik wyżej przerwał) ──────────────────────
-- select card_signature, count(*), array_agg(id), array_agg(title)
--   from public.deals
--  where card_signature is not null
--  group by card_signature
-- having count(*) > 1;
--
-- UWAGA przy sprzątaniu: usunięcie rozdania kaskaduje na srs_progress i kasuje
-- historię powtórek. Zostaw tę kopię, która ma postępy; drugą archiwizuj lub usuń.
