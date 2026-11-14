-- 0012_offline_sync.sql — etap 1 trybu offline (docs/OFFLINE_PLAN.md, O2).
-- Uruchom raz w Supabase SQL Editor, PRZED wdrożeniem wersji aplikacji, która
-- wysyła `rated_at` i `client_id`. Idempotentne: można uruchomić ponownie.
--
-- Zgodne wstecz: aplikacja sprzed tej migracji (np. karta otwarta od wczoraj)
-- nie zna nowych kolumn i dalej zapisuje poprawnie — patrz gałąź „stary klient"
-- w wyzwalaczu.

-- =========================================================
-- srs_progress: późniejsza ocena wygrywa
-- =========================================================

-- Moment ZAPISU wiersza na urządzeniu. `last_seen` się do tego nie nadaje: RESTART
-- przywraca wpis sprzed wizyty razem ze starym `last_seen`, a mimo to jest
-- najnowszą decyzją użytkownika i ma wygrać z wcześniejszą oceną.
alter table public.srs_progress add column if not exists rated_at timestamptz;

-- Dotychczasowe wiersze: najlepsze przybliżenie to chwila ostatniej oceny. Wiersze
-- bez `last_seen` zostają z NULL — „brak daty", czyli przegrywają z każdym zapisem.
update public.srs_progress
   set rated_at = last_seen
 where rated_at is null and last_seen is not null;

create or replace function public.srs_progress_latest_wins()
returns trigger language plpgsql as $$
begin
  -- Zegar telefonu ustawiony w przyszłość nie może zablokować wiersza na zapas.
  if new.rated_at is not null and new.rated_at > now() then
    new.rated_at := now();
  end if;

  if tg_op = 'INSERT' then
    new.rated_at := coalesce(new.rated_at, now());
    return new;
  end if;

  if new.rated_at is null or new.rated_at is not distinct from old.rated_at then
    -- Stary klient: upsert nie zawiera `rated_at`, więc kolumna przychodzi
    -- nietknięta. Taki zapis dzieje się online, „teraz". Identyczne ponowienie
    -- nowego klienta też tu trafia — wtedy nic się nie zmienia poza znacznikiem.
    if (new.status, new.consecutive_correct, new.interval,
        new.next_review_date, new.last_seen, new.flag_difficult)
       is distinct from
       (old.status, old.consecutive_correct, old.interval,
        old.next_review_date, old.last_seen, old.flag_difficult) then
      new.rated_at := now();
    else
      new.rated_at := old.rated_at;
    end if;
    return new;
  end if;

  -- Zapis starszy niż to, co już leży w bazie (telefon dosyła oceny sprzed
  -- kilku godzin, a komputer zdążył ocenić to samo rozdanie później): pomijamy
  -- po cichu. Zwrócenie NULL anuluje UPDATE bez błędu dla klienta.
  if old.rated_at is not null and new.rated_at < old.rated_at then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists srs_progress_latest_wins on public.srs_progress;
create trigger srs_progress_latest_wins
  before insert or update on public.srs_progress
  for each row execute function public.srs_progress_latest_wins();

-- =========================================================
-- attempts: to samo podejście nie zapisze się dwa razy
-- =========================================================

-- Identyfikator nadawany przez urządzenie w chwili odpowiedzi. Kolejka offline
-- ponawia wysyłkę po zerwanym połączeniu, nie wiedząc, czy poprzednia próba
-- doszła — bez tego historia i statystyki liczyłyby podejście podwójnie.
alter table public.attempts add column if not exists client_id uuid;

-- Indeks pełny, nie częściowy: tylko taki da się wskazać w `on conflict` przez
-- API. Stare wiersze mają NULL, a NULL-e nie kolidują ze sobą.
create unique index if not exists attempts_user_client_idx
  on public.attempts (user_id, client_id);
