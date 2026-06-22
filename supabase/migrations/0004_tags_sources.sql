-- 0004_tags_sources.sql — Motywy techniczne (tagi M2M) + zarządzanie źródłami.
-- Wstecznie kompatybilne: nowe kolumny na deals są nullable, istniejące rozdania działają.
-- Uruchom raz w Supabase SQL Editor. Idempotentne.
-- TODO (i18n): wartości source_type i nazwy motywów są po polsku; angielską warstwę dodamy później.

-- ── Tabele ───────────────────────────────────────────────
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  source_type text not null default 'Inne'
              check (source_type in ('Książka', 'Strona WWW', 'Turniej', 'Własne', 'Inne')),
  source_url  text,
  created_at  timestamptz not null default now()
);

-- Nowe pola na deals (opcjonalne).
alter table public.deals add column if not exists source_id uuid references public.sources(id) on delete set null;
alter table public.deals add column if not exists source_details text;

-- Relacja wiele-do-wielu deals <-> tags.
create table if not exists public.deal_tags (
  deal_id text not null references public.deals(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  primary key (deal_id, tag_id)
);
create index if not exists deal_tags_tag_idx on public.deal_tags (tag_id);

-- ── RLS ──────────────────────────────────────────────────
alter table public.tags       enable row level security;
alter table public.sources    enable row level security;
alter table public.deal_tags  enable row level security;

drop policy if exists tags_select on public.tags;
create policy tags_select on public.tags
  for select using (public.is_approved(auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists tags_admin_write on public.tags;
create policy tags_admin_write on public.tags
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists sources_select on public.sources;
create policy sources_select on public.sources
  for select using (public.is_approved(auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists sources_admin_write on public.sources;
create policy sources_admin_write on public.sources
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists deal_tags_select on public.deal_tags;
create policy deal_tags_select on public.deal_tags
  for select using (public.is_approved(auth.uid()) or public.is_admin(auth.uid()));
drop policy if exists deal_tags_admin_write on public.deal_tags;
create policy deal_tags_admin_write on public.deal_tags
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ── Grants ───────────────────────────────────────────────
grant select, insert, update, delete on public.tags, public.sources, public.deal_tags to authenticated;

-- ── Seed: domyślne motywy brydżowe ───────────────────────
insert into public.tags (name) values
  ('Przymus'),
  ('Wpustka'),
  ('Eliminacja'),
  ('Bezpieczna rozgrywka'),
  ('Komunikacja / Odblokowanie'),
  ('Gra na przebitki'),
  ('Pierwszy wist'),
  ('Sygnalizacja'),
  ('Promocja atutowa')
on conflict (name) do nothing;
