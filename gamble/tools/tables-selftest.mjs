// Table games self-test (lane B): verifies the real house edge of the blackjack and roulette rules
// the 3D tables use (src/casino/tables/rules/*). Pure node, no browser.
//
//   node gamble/tools/tables-selftest.mjs                # 100k blackjack hands + 1M roulette spins
//   node gamble/tools/tables-selftest.mjs 10000000 10000000   # precise run (≈ 1 min)
//
// Blackjack: one basic-strategy player, flat 1-unit bets, 6 decks, cut card at 75 %, burn card,
// H17 ($5 table) and S17 ($25 table), DAS, split to 4, no RSA, no surrender, peek. Expected edge
// ≈ 0.6–0.65 % (H17) and ≈ 0.4–0.45 % (S17).
// Roulette: exact enumeration of every bet on the layout (5.26 %, top line 7.89 %), then Monte
// Carlo over random bets of every kind with fairInt outcomes.
import { Shoe, simulateRound, DEFAULT_RULES, basicStrategy } from '../src/casino/tables/rules/blackjack.js';
import { BETS, betReturn, exactEdge, spinOutcome, WHEEL_ORDER, betAt, BET_BY_ID } from '../src/casino/tables/rules/roulette.js';

const bjHands = +(process.argv[2] || 100000);
const spins = +(process.argv[3] || 1000000);
let fail = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) fail++;
};

// ---- blackjack ------------------------------------------------------------------------------
function runBJ(h17, n) {
  const rules = { ...DEFAULT_RULES, h17 };
  const shoe = new Shoe({ decks: 6, penetration: 0.75 });
  shoe.burn();
  let net = 0;
  let sq = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const r = simulateRound(shoe, rules);
    net += r;
    sq += r * r;
  }
  const mean = net / n;
  const sd = Math.sqrt(sq / n - mean * mean);
  return { edge: -mean * 100, se: (sd / Math.sqrt(n)) * 100, ms: Date.now() - t0, shuffles: shoe.shuffles };
}

// Strategy spot checks (well-known chart cells).
const C = (r, s = 0) => s * 13 + r; // rank index 0 = A
const strat = (a, b, up, h17 = true) => basicStrategy([C(a), C(b, 1)], C(up, 2), { h17 });
check(strat(9, 0, 5) === 'S' && strat(9, 9, 5) === 'S', 'BS: 20 stands, T-T never split');
check(strat(7, 7, 0) === 'P' && strat(0, 0, 9) === 'P', 'BS: 8-8 and A-A always split');
check(strat(4, 5, 0, true) === 'D' && strat(4, 5, 0, false) === 'H', 'BS: 11 vs A doubles on H17, hits on S17');
check(strat(0, 6, 1, true) === 'D' && strat(0, 6, 1, false) === 'S', 'BS: A-7 vs 2 doubles on H17, stands on S17');
check(strat(9, 1, 3) === 'S' && strat(9, 1, 2) === 'H', 'BS: 12 stands vs 4, hits vs 3');
check(strat(9, 5, 6) === 'H' && strat(9, 5, 5) === 'S', 'BS: 16 hits vs 7, stands vs 6');

for (const [name, h17, lo, hi] of [['H17 ($5 table)', true, 0.5, 0.7], ['S17 ($25 table)', false, 0.3, 0.55]]) {
  const r = runBJ(h17, bjHands);
  const z = Math.max(0, Math.max(lo - r.edge, r.edge - hi)) / r.se;
  console.log(`      blackjack ${name}: ${bjHands.toLocaleString()} hands, house edge ${r.edge.toFixed(3)} % ± ${r.se.toFixed(3)} (1 SE), ${r.shuffles} shoes, ${r.ms} ms`);
  check(z < 3, `blackjack ${name} edge within ${lo}–${hi} % (inside 3 SE)`);
}

// ---- roulette -------------------------------------------------------------------------------
check(WHEEL_ORDER.length === 38 && new Set(WHEEL_ORDER).size === 38, 'wheel has 38 distinct pockets in real order');
const kinds = {};
for (const b of BETS) {
  const e = exactEdge(b);
  (kinds[b.kind] ||= []).push(e);
}
for (const [k, es] of Object.entries(kinds)) {
  const want = k === 'topline' ? 3 / 38 : 2 / 38;
  const ok = es.every((e) => Math.abs(e - want) < 1e-12);
  check(ok, `roulette ${k.padEnd(8)} ×${String(es.length).padStart(2)}: exact edge ${(es[0] * 100).toFixed(3)} %`);
}
check(BETS.length === 38 + 57 + 5 + 3 + 12 + 11 + 22 + 1 + 3 + 3 + 6, `layout has every bet (${BETS.length})`);
check(betAt(BET_BY_ID.get('c1').x + 0.003, BET_BY_ID.get('c1').z)?.id === 'c1' && betAt(BET_BY_ID.get('s17').x, BET_BY_ID.get('s17').z)?.id === 's17', 'hit test: corner wins near the line, box in the middle');

{
  const t0 = Date.now();
  const per = {};
  let staked = 0;
  let back = 0;
  const hist = new Array(38).fill(0);
  const lists = Object.keys(kinds).filter((k) => k !== 'topline').map((k) => [k, BETS.filter((b) => b.kind === k)]);
  let sq = 0;
  for (let i = 0; i < spins; i++) {
    const res = spinOutcome();
    hist[res]++;
    // Each spin: one random bet of every kind (minus the top line), 1 unit each.
    let spinNet = 0;
    for (const [k, list] of lists) {
      const b = list[(Math.random() * list.length) | 0];
      const r = betReturn(b, 1, res);
      (per[k] ||= { s: 0, r: 0 }).s += 1;
      per[k].r += r;
      staked += 1;
      back += r;
      spinNet += r - 1;
    }
    sq += spinNet * spinNet;
  }
  const perSpin = staked / spins;
  const meanNet = (back - staked) / spins;
  const se = (Math.sqrt(sq / spins - meanNet * meanNet) / perSpin / Math.sqrt(spins)) * 100;
  const edge = (1 - back / staked) * 100;
  console.log(`      roulette: ${spins.toLocaleString()} spins, ${staked.toLocaleString()} unit bets, overall edge ${edge.toFixed(3)} % ± ${se.toFixed(3)} (1 SE) (${Date.now() - t0} ms)`);
  for (const [k, v] of Object.entries(per)) console.log(`        ${k.padEnd(8)} edge ${((1 - v.r / v.s) * 100).toFixed(2)} %`);
  // Outcome distribution: chi-square over 38 pockets (df 37, p≈0.001 critical ≈ 69.3).
  const exp = spins / 38;
  const chi = hist.reduce((a, o) => a + (o - exp) ** 2 / exp, 0);
  check(chi < 69.3, `fairInt outcome distribution uniform (chi² ${chi.toFixed(1)}, df 37)`);
  check(Math.abs(edge - 5.263) < 3.5 * se, 'roulette overall edge ≈ 5.26 % (inside 3.5 SE)');
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
