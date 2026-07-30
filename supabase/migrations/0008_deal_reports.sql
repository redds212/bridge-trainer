-- Zgłoszenia błędów w rozdaniach.
--
-- `deal_id` bez klucza obcego, tak samo jak w `attempts`: zgłoszenie ma przetrwać
-- usunięcie rozdania, bo bez niego nie da się odtworzyć, czego dotyczyło. Tytuł
-- kopiujemy w chwili zgłoszenia z tego samego powodu — po edycji rozdania treść
-- zgłoszenia nadal ma sens.
--
-- `user_id` na `set null`: usunięcie konta nie kasuje zgłoszenia, ale odcina je od
-- osoby. `reporter_label` zostaje jako ślad, kto zgłaszał.

create table if not exists public.deal_reports (
  id             bigint generated always as identity primary key,
  deal_id        text not null,
  deal_title     text not null default '',
  user_id        uuid references auth.users(id) on delete set null,
  reporter_label text not null default '',
  message        text not null,
  status         text not null default 'new' check (status in ('new','seen','resolved')),
  created_at     timestamptz not null default now()
);

create index if not exists deal_reports_status_created_idx
  on public.deal_reports (status, created_at desc);

alter table public.deal_reports enable row level security;

-- Zgłaszać może każdy zatwierdzony użytkownik, ale wyłącznie we własnym imieniu.
drop policy if exists deal_reports_insert_own on public.deal_reports;
create policy deal_reports_insert_own on public.deal_reports
  for insert with check (
    user_id = auth.uid()
    and (public.is_approved(auth.uid()) or public.is_admin(auth.uid()))
  );

-- Czytać, zmieniać status i kasować może tylko admin. Zwykły użytkownik nie widzi
-- nawet własnych zgłoszeń — nie ma w aplikacji miejsca, które by je pokazywało.
drop policy if exists deal_reports_admin_read on public.deal_reports;
create policy deal_reports_admin_read on public.deal_reports
  for select using (public.is_admin(auth.uid()));

drop policy if exists deal_reports_admin_write on public.deal_reports;
create policy deal_reports_admin_write on public.deal_reports
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists deal_reports_admin_delete on public.deal_reports;
create policy deal_reports_admin_delete on public.deal_reports
  for delete using (public.is_admin(auth.uid()));

-- Granty muszą być jawne (jak dla tags/sources w 0004) — same polityki RLS nie
-- wystarczą, bez tego każde zapytanie kończy się „permission denied for table".
grant select, insert, update, delete on public.deal_reports to authenticated;
