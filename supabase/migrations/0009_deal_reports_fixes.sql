-- Poprawki do 0008_deal_reports.sql (przegląd kodu, TODO pkt 5: C, E, F).

-- ---------------------------------------------------------
-- C. Usunięcie konta nie może zostawiać adresu e-mail.
--
-- `user_id` ma `on delete set null`, ale `reporter_label` trzyma „login (e-mail)"
-- jako zwykły tekst — admin kasujący konto usuwał profil, postępy i historię,
-- a adres zostawał w zgłoszeniach na zawsze.
--
-- Trigger BEFORE DELETE, nie zmiana w Edge Function `delete-user`: łapie też
-- usunięcia zrobione poza aplikacją (panel Supabase, SQL). BEFORE, bo po akcji
-- klucza obcego `user_id` byłby już NULL i nie dałoby się dopasować wierszy.
--
-- Pusty łańcuch, nie tekst zastępczy: klient mapuje pusty `reporter_label`
-- na „(konto usunięte)" (useDealReports.ts), więc etykieta zostaje w jednym miejscu.
-- ---------------------------------------------------------
create or replace function public.anonymize_deal_reports()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.deal_reports set reporter_label = '' where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_anonymize_reports on auth.users;
create trigger on_auth_user_deleted_anonymize_reports
  before delete on auth.users
  for each row execute function public.anonymize_deal_reports();

-- ---------------------------------------------------------
-- E. Ograniczenie długości zgłoszenia.
--
-- Formularz pilnuje 800 znaków przez `maxLength`, ale to tylko UI — zatwierdzony
-- użytkownik mógł ominąć interfejs i wstawić dowolnie długi tekst. Limit w bazie
-- z zapasem (2000), żeby nie odrzucić niczego, co przeszłoby przez formularz.
-- ---------------------------------------------------------
alter table public.deal_reports drop constraint if exists deal_reports_message_len;
alter table public.deal_reports
  add constraint deal_reports_message_len
  check (char_length(message) between 1 and 2000);

-- ---------------------------------------------------------
-- F. Użytkownik widzi własne zgłoszenia.
--
-- Dotąd miał tylko INSERT, przez co całość działała wyłącznie dzięki temu, że
-- `insert()` bez `.select()` nie prosi PostgREST o zwrócenie wiersza. Dopisanie
-- `.select()` — choćby po `id` — wywaliłoby każde zgłoszenie na błędzie RLS.
--
-- Polityka jak `srs_select_own` i `attempts_select_own`: własne wiersze, konto
-- zatwierdzone. Wyrównuje `deal_reports` do reszty tabel użytkownika i likwiduje
-- pułapkę, zamiast ostrzegać przed nią komentarzem.
-- ---------------------------------------------------------
drop policy if exists deal_reports_select_own on public.deal_reports;
create policy deal_reports_select_own on public.deal_reports
  for select using (user_id = auth.uid() and public.is_approved(auth.uid()));
