// Generates supabase/migrations/0002_seed_base_deals.sql from src/data/dealsMock.json.
// Run with: node scripts/gen-seed.mjs
// Re-run whenever the base deals change.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const deals = JSON.parse(readFileSync(resolve(root, 'src/data/dealsMock.json'), 'utf8'));

const q = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`;            // text literal
const j = (o) => `'${JSON.stringify(o ?? null).replace(/'/g, "''")}'::jsonb`; // jsonb literal

let sql = `-- 0002_seed_base_deals.sql — AUTO-GENERATED from src/data/dealsMock.json
-- by scripts/gen-seed.mjs. Do not edit by hand. Idempotent (upsert on id).
-- Run AFTER 0001_init.sql in the Supabase SQL Editor.

`;

for (const d of deals) {
  sql += `insert into public.deals
  (id, title, category, difficulty, contract, declarer, dealer, vulnerability,
   bidding, initial_hands, intro_sequence, decision_prompt, solution, is_base, archived)
values
  (${q(d.id)}, ${q(d.title)}, ${q(d.category)}, ${q(d.difficulty)}, ${q(d.contract)},
   ${q(d.declarer)}, ${q(d.dealer)}, ${q(d.vulnerability)},
   ${j(d.bidding)}, ${j(d.initialHands)}, ${j(d.introSequence)}, ${q(d.decisionPrompt)}, ${j(d.solution)}, true, false)
on conflict (id) do update set
  title = excluded.title, category = excluded.category, difficulty = excluded.difficulty,
  contract = excluded.contract, declarer = excluded.declarer, dealer = excluded.dealer,
  vulnerability = excluded.vulnerability, bidding = excluded.bidding,
  initial_hands = excluded.initial_hands, intro_sequence = excluded.intro_sequence,
  decision_prompt = excluded.decision_prompt, solution = excluded.solution, is_base = true;

`;
}

mkdirSync(resolve(root, 'supabase/migrations'), { recursive: true });
writeFileSync(resolve(root, 'supabase/migrations/0002_seed_base_deals.sql'), sql);
console.log(`Wrote supabase/migrations/0002_seed_base_deals.sql (${deals.length} deals)`);
