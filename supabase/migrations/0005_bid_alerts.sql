-- 0005_bid_alerts.sql — Alerty odzywek sztucznych.
-- Przechowuje listę { index, explanation } (index = pozycja w spłaszczonej licytacji).
-- Wstecznie kompatybilne: kolumna nullable, istniejące rozdania działają.
-- Uruchom raz w Supabase SQL Editor.

alter table public.deals add column if not exists bid_alerts jsonb;
