// Checks deal JSON files (imports/, exports, anything shaped like the importer input)
// with the app's OWN validators — not a reimplementation. src/lib/{cards,validateDeal,
// dealSignature}.ts are transpiled to CommonJS on the fly with the bundled `typescript`,
// because the project has no tsx/ts-node/esbuild binary.
//
// Run with:
//   node scripts/check-deals.mjs imports/rpbridge-8d65
//   node scripts/check-deals.mjs imports/vec-part1/board-21-spain.json
//   node scripts/check-deals.mjs imports            (recursive; expect the known
//                                                    euvc*.json bundle duplicates)
//
// Two passes:
//   1. validateDeal() + dealSignature() per deal, then signature collisions inside the
//      checked set. The bar for an import is ZERO errors and ZERO warnings; a deal
//      without a signature is missing its 52nd card and escapes dedup on import.
//   2. Optional replay. validateDeal() only verifies cards used in `introSequence`, so
//      hands in solution.revealAllCards are otherwise unchecked. Drop a `lines.json`
//      next to the deals with the source's full published play and this replays it:
//      every card must belong to that hand, nobody may revoke, and each trick winner
//      must match the source. That is what actually proves the hidden hands.
//
//      lines.json — { "<deal file>": { "trump": "S"|null, "tricks": [
//                       [leader, [cards in play order], winner], ... ] } }
//      Cards use library notation ("C6", "S10", "HQ"); trump null for notrump.
import { readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename, relative } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');

// ── load the app's validators ────────────────────────────────────────────────
const work = mkdtempSync(join(tmpdir(), 'bt-check-'));
for (const file of ['cards.ts', 'validateDeal.ts', 'dealSignature.ts']) {
  const src = readFileSync(resolve(root, 'src/lib', file), 'utf8');
  const js = ts
    .transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    })
    .outputText.replace(/require\("(\.\.?\/[\w/]+)"\)/g, 'require("$1.cjs")');
  writeFileSync(join(work, file.replace(/\.ts$/, '.cjs')), js);
}
const load = createRequire(join(work, 'index.cjs'));
const { validateDeal } = load('./validateDeal.cjs');
const { dealSignature } = load('./dealSignature.cjs');
const { seatCards } = load('./cards.cjs');

// ── inputs ───────────────────────────────────────────────────────────────────
const RANKS_LOW_TO_HIGH = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CLOCKWISE = ['N', 'E', 'S', 'W'];
const clockwiseFrom = (leader) => {
  const i = CLOCKWISE.indexOf(leader);
  return [...CLOCKWISE.slice(i), ...CLOCKWISE.slice(0, i)];
};

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['imports'];
const dealFiles = [];
const lineSets = new Map(); // folder -> parsed lines.json

const collect = (p) => {
  const abs = resolve(root, p);
  if (statSync(abs).isDirectory()) {
    const entries = readdirSync(abs, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name === 'lines.json')) {
      lineSets.set(abs, JSON.parse(readFileSync(join(abs, 'lines.json'), 'utf8')));
    }
    for (const e of entries) {
      if (e.isDirectory()) collect(join(abs, e.name));
      else if (e.name.endsWith('.json') && e.name !== 'lines.json') dealFiles.push(join(abs, e.name));
    }
    return;
  }
  dealFiles.push(abs);
};
targets.forEach(collect);
dealFiles.sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));

// ── pass 1: validateDeal + signature ─────────────────────────────────────────
let errors = 0;
let warnings = 0;
let deals = 0;
let unsigned = 0;
const bySignature = new Map();

for (const file of dealFiles) {
  const label = relative(root, file).replace(/\\/g, '/');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.log(`BŁĄD ${label}: nieprawidłowy JSON — ${err.message}`);
    errors++;
    continue;
  }
  for (const deal of Array.isArray(parsed) ? parsed : [parsed]) {
    if (!deal?.id || !deal?.title) {
      console.log(`BŁĄD ${label}: wpis bez id/title — import go odrzuci`);
      errors++;
      continue;
    }
    deals++;
    const v = validateDeal(deal);
    const sig = dealSignature(deal);
    errors += v.errors.length;
    warnings += v.warnings.length;
    if (!sig) unsigned++;

    const clean = !v.errors.length && !v.warnings.length && sig;
    const counts = CLOCKWISE.map((s) => seatCards(deal, s)?.codes.length ?? '?').join('/');
    console.log(`${clean ? 'OK  ' : 'UWAGA'} ${label} — „${deal.title}" [N/E/S/W ${counts}]${sig ? '' : ' BEZ SYGNATURY'}`);
    v.errors.forEach((e) => console.log(`        BŁĄD: ${e}`));
    v.warnings.forEach((w) => console.log(`        ostrz.: ${w}`));

    if (sig) {
      const hit = bySignature.get(sig);
      if (hit) console.log(`        duplikat rozkładu: „${deal.title}" == „${hit}"`);
      else bySignature.set(sig, deal.title);
    }
  }
}

// ── pass 2: replay the source's published play ───────────────────────────────
let replayed = 0;
let mismatches = 0;

for (const [folder, lines] of lineSets) {
  for (const [name, line] of Object.entries(lines)) {
    if (name.startsWith('_')) continue; // komentarze w lines.json
    const file = join(folder, name);
    const label = relative(root, file).replace(/\\/g, '/');
    const deal = JSON.parse(readFileSync(file, 'utf8'))[0];
    const hands = Object.fromEntries(CLOCKWISE.map((s) => [s, new Set(seatCards(deal, s)?.codes ?? [])]));
    const problems = [];
    const fail = (msg) => problems.push(msg);

    let nsTricks = 0;
    line.tricks.forEach(([leader, cards, srcWinner], i) => {
      const seats = clockwiseFrom(leader);
      const led = cards[0][0];
      let best = 0;
      cards.forEach((card, k) => {
        const seat = seats[k];
        if (!hands[seat].has(card)) return fail(`lewa ${i + 1}: ${seat} nie ma karty ${card}`);
        hands[seat].delete(card);
        if (card[0] !== led && [...hands[seat]].some((c) => c[0] === led))
          fail(`lewa ${i + 1}: ${seat} nie dodał do koloru ${led} (zagrał ${card})`);
        const beaten = cards[best];
        const wins =
          card[0] === beaten[0]
            ? RANKS_LOW_TO_HIGH.indexOf(card.slice(1)) > RANKS_LOW_TO_HIGH.indexOf(beaten.slice(1))
            : card[0] === line.trump && beaten[0] !== line.trump;
        if (wins) best = k;
      });
      const winner = seats[best];
      if (winner !== srcWinner) fail(`lewa ${i + 1}: bierze ${winner}, źródło mówi ${srcWinner}`);
      if (winner === 'N' || winner === 'S') nsTricks++;
    });

    const left = CLOCKWISE.map((s) => hands[s].size);
    if (new Set(left).size !== 1) fail(`nierówna liczba kart po rozgrywce: ${left.join('/')}`);
    replayed++;
    mismatches += problems.length;
    console.log(
      `${problems.length ? 'UWAGA' : 'ODTW '} ${label} — ${line.tricks.length} lew, NS bierze ${nsTricks}, zostaje po ${left[0]} kart`
    );
    problems.forEach((p) => console.log(`        ${p}`));
  }
}

rmSync(work, { recursive: true, force: true });

console.log(
  `\nSprawdzono ${deals} rozdań w ${dealFiles.length} plikach: ${errors} błędów, ${warnings} ostrzeżeń` +
    (unsigned ? `, ${unsigned} bez sygnatury` : '') +
    (replayed ? ` · odtworzono ${replayed} pełnych linii: ${mismatches} niezgodności` : '')
);
process.exit(errors || mismatches ? 1 : 0);
