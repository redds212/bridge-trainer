-- 0001_init.sql — Bridge Trainer backend: schema, helper functions, RLS, auth trigger.
-- Run once in the Supabase SQL Editor (it runs as the table owner, so RLS is bypassed here).
-- Idempotent: safe to re-run.

-- =========================================================
-- Tables
-- =========================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  is_admin     boolean not null default false,
  status       text not null default 'pending' check (status in ('pending','approved')),
  daily_target int not null default 10 check (daily_target between 1 and 100),
  mode         text not null default 'balanced' check (mode in ('maintenance','balanced','intensive')),
  created_at   timestamptz not null default now()
);

create table if not exists public.deals (
  id              text primary key,
  title           text not null,
  category        text not null,
  difficulty      text not null,
  contract        text not null default '',
  declarer        text not null default 'N',
  dealer          text not null default 'N',
  vulnerability   text not null default '',
  bidding         jsonb not null default '[]'::jsonb,
  initial_hands   jsonb not null default '{}'::jsonb,
  intro_sequence  jsonb not null default '[]'::jsonb,
  decision_prompt text not null default '',
  solution        jsonb not null default '{}'::jsonb,
  is_base         boolean not null default false,
  archived        boolean not null default false,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table if not exists public.srs_progress (
  user_id             uuid not null references auth.users(id) on delete cascade,
  deal_id             text not null references public.deals(id) on delete cascade,
  status              text not null default 'NEW',
  consecutive_correct int  not null default 0,
  interval            int  not null default 0,
  next_review_date    date,
  last_seen           timestamptz,
  flag_difficult      boolean not null default false,
  primary key (user_id, deal_id)
);

create table if not exists public.attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id text not null,
  correct boolean not null,
  phase   text not null check (phase in ('main','buffer','free')),
  ts      timestamptz not null default now()
);

create index if not exists attempts_user_ts_idx on public.attempts (user_id, ts desc);
create index if not exists srs_progress_user_idx on public.srs_progress (user_id);

-- =========================================================
-- Helper functions.
-- SECURITY DEFINER → they run as the function owner and bypass RLS, which both
-- (a) lets policies call them without recursing into the policies, and
-- (b) keeps the role/status checks authoritative.
-- =========================================================

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

create or replace function public.is_approved(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'approved' from public.profiles where id = uid), false);
$$;

-- Lets a user change ONLY their own SRS settings (never is_admin / status).
create or replace function public.update_my_settings(p_daily_target int, p_mode text)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set daily_target = greatest(1, least(100, p_daily_target)),
         mode = case when p_mode in ('maintenance','balanced','intensive') then p_mode else mode end
   where id = auth.uid();
$$;

-- Auto-create the profile row when a new auth user signs up (status defaults to 'pending').
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.profiles     enable row level security;
alter table public.deals        enable row level security;
alter table public.srs_progress enable row level security;
alter table public.attempts     enable row level security;

-- ---- profiles ----
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete using (public.is_admin(auth.uid()));
-- (No user INSERT/UPDATE policy: inserts happen via the signup trigger,
--  and users change settings only through update_my_settings().)

-- ---- deals ----
drop policy if exists deals_select_approved_or_admin on public.deals;
create policy deals_select_approved_or_admin on public.deals
  for select using (
    (public.is_approved(auth.uid()) and not archived) or public.is_admin(auth.uid())
  );

drop policy if exists deals_admin_insert on public.deals;
create policy deals_admin_insert on public.deals
  for insert with check (public.is_admin(auth.uid()));

drop policy if exists deals_admin_update on public.deals;
create policy deals_admin_update on public.deals
  for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists deals_admin_delete on public.deals;
create policy deals_admin_delete on public.deals
  for delete using (public.is_admin(auth.uid()));

-- ---- srs_progress (own rows, only while approved) ----
drop policy if exists srs_select_own on public.srs_progress;
create policy srs_select_own on public.srs_progress
  for select using (user_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists srs_insert_own on public.srs_progress;
create policy srs_insert_own on public.srs_progress
  for insert with check (user_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists srs_update_own on public.srs_progress;
create policy srs_update_own on public.srs_progress
  for update using (user_id = auth.uid() and public.is_approved(auth.uid()))
            with check (user_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists srs_delete_own on public.srs_progress;
create policy srs_delete_own on public.srs_progress
  for delete using (user_id = auth.uid());

-- ---- attempts (own rows, only while approved; delete own to clear history) ----
drop policy if exists attempts_select_own on public.attempts;
create policy attempts_select_own on public.attempts
  for select using (user_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists attempts_insert_own on public.attempts;
create policy attempts_insert_own on public.attempts
  for insert with check (user_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists attempts_delete_own on public.attempts;
create policy attempts_delete_own on public.attempts
  for delete using (user_id = auth.uid());

-- =========================================================
-- Grants (RLS still applies on top of these)
-- =========================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.deals, public.srs_progress, public.attempts to authenticated;
grant execute on function public.update_my_settings(int, text) to authenticated;
grant execute on function public.is_admin(uuid)    to authenticated;
grant execute on function public.is_approved(uuid) to authenticated;
