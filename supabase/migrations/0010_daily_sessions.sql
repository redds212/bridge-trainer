-- Migawka przerwanej sesji dziennej — patrz docs/SESSION_RESUME_PLAN.md.
--
-- Zapisujemy GOTOWĄ listę slotów, a nie parametry do jej odtworzenia. Powód:
-- `generateDailySession` czyta bieżący stan SRS, a każda odpowiedź ten stan
-- zmienia (odpowiedziane rozdanie wypada z puli zaległych). Po czterech
-- odpowiedziach ta sama funkcja zwróciłaby inną kolejkę, więc „wznowienie"
-- przez ponowne wygenerowanie dałoby inne rozdania niż te, które zostawiłeś.
--
-- Jeden wiersz na konto (`user_id` jest kluczem głównym), nadpisywany przy
-- każdym starcie sesji. `date` nie wchodzi do klucza, bo migawka i tak wygasa
-- o lokalnej północy: wiersz z innym dniem jest ignorowany i zastępowany.
-- Dzięki temu nie ma czego sprzątać — tabela ma tyle wierszy, ile kont.

create table if not exists public.daily_sessions (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  -- Doba lokalna użytkownika (klucz „YYYY-MM-DD" liczony po stronie klienta),
  -- nie UTC — tak samo jak `next_review_date` w `srs_progress`.
  date                date    not null,
  -- [{ dealId, kind }] — zamrożona kolejka przebiegu głównego.
  slots               jsonb   not null default '[]'::jsonb,
  -- Wskaźnik w `slots`. Nie „index", bo to słowo zastrzeżone w SQL.
  idx                 int     not null default 0,
  -- dealId[] nietrafionych w przebiegu głównym, czekających na bufor.
  buffer              jsonb   not null default '[]'::jsonb,
  buffer_index        int     not null default 0,
  in_buffer           boolean not null default false,
  -- dealId[] powtórek, które nie zmieściły się w dzisiejszym limicie.
  deferred_review_ids jsonb   not null default '[]'::jsonb,
  -- Cel dzienny i tryb obowiązujące migawkę. Po nich poznajemy, że ustawienia
  -- zmieniły się w trakcie dnia i kolejkę trzeba dopchnąć albo przyciąć.
  target              int     not null default 0,
  mode                text    not null default 'balanced',
  updated_at          timestamptz not null default now()
);

alter table public.daily_sessions enable row level security;

-- Własny wiersz, dokładnie jak przy `srs_progress` w 0001: czytać i pisać może
-- tylko konto zatwierdzone, kasować można zawsze (sprzątanie po koncie, które
-- straciło zatwierdzenie).
drop policy if exists daily_sessions_select_own on public.daily_sessions;
create policy daily_sessions_select_own on public.daily_sessions
  for select using (user_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists daily_sessions_insert_own on public.daily_sessions;
create policy daily_sessions_insert_own on public.daily_sessions
  for insert with check (user_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists daily_sessions_update_own on public.daily_sessions;
create policy daily_sessions_update_own on public.daily_sessions
  for update using (user_id = auth.uid() and public.is_approved(auth.uid()))
            with check (user_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists daily_sessions_delete_own on public.daily_sessions;
create policy daily_sessions_delete_own on public.daily_sessions
  for delete using (user_id = auth.uid());

-- Granty muszą być jawne (jak dla `deal_reports` w 0008) — same polityki RLS nie
-- wystarczą, bez tego każde zapytanie kończy się „permission denied for table".
grant select, insert, update, delete on public.daily_sessions to authenticated;
