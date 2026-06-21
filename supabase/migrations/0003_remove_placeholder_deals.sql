-- 0003_remove_placeholder_deals.sql
-- Usuwa wadliwe rozdania-placeholdery (deal-101..105) z bazy.
-- Miały realne błędy (duplikaty kart, kody typu "SK3", ręce 14/12 kart) —
-- nie były spójnymi rozkładami 52 kart. Kasowanie kaskadowo czyści srs_progress.
-- Uruchom raz w Supabase SQL Editor.

delete from public.deals
where id in ('deal-101', 'deal-102', 'deal-103', 'deal-104', 'deal-105');
