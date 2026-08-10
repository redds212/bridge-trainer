-- Domyślny cel dzienny: 10 → 20.
--
-- Powód: „Rekomendowane na dziś" pokazuje teraz faktyczną kolejkę sesji, czyli
-- dokładnie `daily_target` pozycji. Przy dziesiątce wczorajsze pudła potrafią zjeść
-- cały limit powtórek (0.6 × 10 = 6), więc zaplanowane powtórki spadają do zera i
-- odkładają się na kolejne dni. Dwudziestka mieści jedno i drugie.
--
-- Zmieniamy TYLKO wartość domyślną kolumny, czyli to, co dostają nowe konta.
-- Istniejące wiersze zostają nietknięte — po `daily_target = 10` nie da się odróżnić
-- konta, które nigdy nie ruszyło suwaka, od takiego, które świadomie wybrało 10.
-- Kto chce dwudziestki, przesuwa suwak w panelu („Rozdań dziennie").
--
-- Idempotentne: safe to re-run.

alter table public.profiles
  alter column daily_target set default 20;
