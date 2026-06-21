-- 0002_seed_base_deals.sql — AUTO-GENERATED from src/data/dealsMock.json
-- by scripts/gen-seed.mjs. Do not edit by hand. Idempotent (upsert on id).
-- Run AFTER 0001_init.sql in the Supabase SQL Editor.

insert into public.deals
  (id, title, category, difficulty, contract, declarer, dealer, vulnerability,
   bidding, initial_hands, intro_sequence, decision_prompt, solution, is_base, archived)
values
  ('deal-106', 'Test wielu lew (A) — wyciąganie atutów', 'Rozgrywający', 'Easy', '4H',
   'S', 'W', 'None',
   '[["P","1H","P","4H"],["P","P","P"]]'::jsonb, '{"S":{"S":"AK3","H":"AKQJ8","D":"A54","C":"Q6"},"N":{"S":"Q75","H":"1072","D":"KQJ","C":"K543"},"E":{"hidden":true},"W":{"hidden":true}}'::jsonb, '[{"trick":1,"leader":"W","cards":{"W":"C10","N":"C3","E":"CA","S":"C6"},"winner":"E"},{"trick":2,"leader":"E","cards":{"E":"CJ","S":"CQ","W":"C9","N":"C4"},"winner":"S"},{"trick":3,"leader":"S","cards":{"S":"HA","W":"H3","N":"H2","E":"H5"},"winner":"S"},{"trick":4,"leader":"S","cards":{"S":"HK","W":"H4","N":"H7","E":"H6"},"winner":"S"},{"trick":5,"leader":"S","cards":{"S":"HQ","W":"D2"}}]'::jsonb, 'Zabrałeś 2 lewy treflowe i 2 rundy atutów. Grasz Damę kier — Zachód zrzuca karowego (wolant w kierach!), Wschód ma jeszcze jednego kiera. Czy wyciągnąć ostatniego atu Damą kier, czy od razu zakasować lewy karowe z dziadka (KQJ)?', '{"text":"Wyciągnij ostatniego atu Damą kier! Standardowa zasada: wyciągnij wszystkie atuty zanim zaczniesz zbierać lewy boczne. Gdybyś poszedł po lewy karowe bez wyciągnięcia ostatniego atu, Wschód mógłby wejść z kierem i przebić Twoją lewę karową od dziadka, niszcząc kontrakt.","revealAllCards":{"E":{"S":"J109","H":"965","D":"10987","C":"AJ2"},"W":{"S":"8642","H":"43","D":"632","C":"10987"}},"continuationTricks":[{"trick":5,"leader":"S","cards":{"S":"HQ","W":"D2","N":"H10","E":"H9"},"winner":"S"}]}'::jsonb, true, false)
on conflict (id) do update set
  title = excluded.title, category = excluded.category, difficulty = excluded.difficulty,
  contract = excluded.contract, declarer = excluded.declarer, dealer = excluded.dealer,
  vulnerability = excluded.vulnerability, bidding = excluded.bidding,
  initial_hands = excluded.initial_hands, intro_sequence = excluded.intro_sequence,
  decision_prompt = excluded.decision_prompt, solution = excluded.solution, is_base = true;

insert into public.deals
  (id, title, category, difficulty, contract, declarer, dealer, vulnerability,
   bidding, initial_hands, intro_sequence, decision_prompt, solution, is_base, archived)
values
  ('deal-107', 'Test wielu lew (B) — garda w kierach', 'Obrona', 'Medium', '3NT',
   'S', 'N', 'None',
   '[["1NT","P","3NT","P"],["P","P"]]'::jsonb, '{"W":{"S":"KQ97","H":"J52","D":"K85","C":"Q43"},"E":{"S":"843","H":"A1074","D":"Q73","C":"J65"},"N":{"hidden":true},"S":{"hidden":true}}'::jsonb, '[{"trick":1,"leader":"W","cards":{"W":"S7","N":"S5","E":"S8","S":"SA"},"winner":"S"},{"trick":2,"leader":"S","cards":{"S":"C8","W":"C3","N":"C2","E":"C5"},"winner":"S"},{"trick":3,"leader":"S","cards":{"S":"C9","W":"C4","N":"C7","E":"C6"},"winner":"S"},{"trick":4,"leader":"S","cards":{"S":"C10","W":"CQ","N":"CA","E":"CJ"},"winner":"N"},{"trick":5,"leader":"N","cards":{"N":"H9"}}]'::jsonb, 'Rozgrywający zabrał 4 lewy (pika i trzy trefle), dziadek wziął czwartą Asem trefl. Dziadek zagrał teraz 9 kier. Twój partner (Wschód) dołożył 4 kier, a rozgrywający wziął Królem kier. Ty (Zachód) masz J52 w kierach. Czy zrzucasz Waleta kier (odblokowanie dla Wschodu), czy zatrzymujesz Waleta (H2 lub H5) jako gardę?', '{"text":"Zachowaj Waleta kier! Nie zrzucaj gardy. Wschód ma A107 kier — razem macie 2 lewy kierkowe do zabrania gdy wejdziecie. Gdybyś zrzucił HJ, rozgrywający mógłby zagrać Damę kier i obejść Asem Wschodu, eliminując Waszą obronę w tym kolorze. Garda Waleta kier jest kluczowym stopem dla obrony.","revealAllCards":{"N":{"S":"J65","H":"986","D":"AJ96","C":"A72"},"S":{"S":"A102","H":"KQ3","D":"1042","C":"K1098"}},"continuationTricks":[{"trick":5,"leader":"N","cards":{"N":"H9","E":"H4","S":"HK","W":"H5"},"winner":"S"}]}'::jsonb, true, false)
on conflict (id) do update set
  title = excluded.title, category = excluded.category, difficulty = excluded.difficulty,
  contract = excluded.contract, declarer = excluded.declarer, dealer = excluded.dealer,
  vulnerability = excluded.vulnerability, bidding = excluded.bidding,
  initial_hands = excluded.initial_hands, intro_sequence = excluded.intro_sequence,
  decision_prompt = excluded.decision_prompt, solution = excluded.solution, is_base = true;

