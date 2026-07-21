-- 0002_timed_mode.sql — opcjonalny „tryb na czas": odliczanie zależne od
-- opanowania rozdania (consecutive_correct). Uruchom raz w Supabase SQL Editor.
-- Idempotentny: bezpieczny do ponownego uruchomienia.

-- Nowe pole preferencji na profilu (domyślnie wyłączone).
alter table public.profiles
  add column if not exists timed_mode boolean not null default false;

-- Rozszerzamy update_my_settings o p_timed_mode. Stara 2-argumentowa wersja
-- musi zniknąć, żeby PostgREST nie miał dwóch przeciążeń o tej samej nazwie.
drop function if exists public.update_my_settings(int, text);

create or replace function public.update_my_settings(
  p_daily_target int,
  p_mode text,
  p_timed_mode boolean default null
)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set daily_target = greatest(1, least(100, p_daily_target)),
         mode = case when p_mode in ('maintenance','balanced','intensive') then p_mode else mode end,
         timed_mode = coalesce(p_timed_mode, timed_mode)
   where id = auth.uid();
$$;

grant execute on function public.update_my_settings(int, text, boolean) to authenticated;
