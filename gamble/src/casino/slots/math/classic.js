// Classic Fruit: a 3-reel mechanical stepper ("Sierra Sevens" by Silverlode Gaming), the way real
// Nevada reel machines work since the 1980s: each reel has 22 physical stops (11 symbols, 11
// blanks) printed on a strip, and the RNG picks a stop on a larger VIRTUAL reel (72 stops) that
// maps onto the physical one. The top award (the Sierra Sevens wild) owns a single virtual stop,
// while the blanks right above and below it own many — so the wild shows up just off the payline
// far more often than on it (the legal near miss).
//
// Two variants share the symbol set:
//   'single' — one payline, 1–3 coins, the top award is bonused for 3 coins (buy-a-pay feel).
//   'three'  — three paylines (centre, top, bottom), each coin lights one more line.
//
// Pay rules (per coin, per line):
//   Wild substitutes for every symbol when it completes a combination with at least one real
//   symbol, and multiplies: one wild ×2, two wilds ×4. Three wilds pay the top award.
//   Cherries pay anywhere on the line (1 → 2, 2 → 5, 3 → 10); mixed bars pay 5.
//
// Exact math: `exactClassic(m)` enumerates all 72³ virtual combinations (no Monte Carlo needed
// for a stepper); the sim tool also cross-checks it with ≥ 10 M random spins.

export const CLASSIC_SYMBOLS = ['W', '7', 'B3', 'B2', 'B1', 'CH', '-'];

// Pay table per coin: 3-of-a-kind (wilds substitute, ×2 per wild).
export const CLASSIC_PAYS = { '7': 100, B3: 40, B2: 20, B1: 10, CH: 10 };
export const ANY_BAR = 5;
export const CHERRY_PAYS = [0, 2, 5, 10];

/**
 * Physical strips (22 stops, symbols on even stops, blanks on odd) + virtual weights per stop.
 * Weights sum to 72 per reel. Blanks touching the wild get the heavy weights (near misses).
 */
const SINGLE = {
  id: 'classic-1',
  variant: 'single',
  title: 'Sierra Sevens',
  lines: 1,
  maxCoins: 3,
  top: [1000, 2000, 5000], // three wilds, by coins bet
  reels: [
    {
      syms: ['W', '7', 'B1', 'B3', 'CH', 'B2', 'B1', '7', 'B2', 'CH', 'B1'],
      //      W  -  7  -  B1 -  B3 -  CH -  B2 -  B1 -  7  -  B2 -  CH -  B1 -
      w: [1, 7, 3, 3, 4, 2, 3, 2, 2, 2, 3, 2, 4, 2, 3, 2, 3, 2, 2, 2, 4, 15],
    },
    {
      syms: ['W', 'B2', 'CH', 'B1', '7', 'B3', 'B1', 'CH', 'B2', '7', 'B1'],
      w: [1, 7, 3, 2, 2, 2, 4, 2, 3, 2, 3, 2, 4, 2, 2, 2, 3, 2, 3, 2, 4, 15],
    },
    {
      syms: ['W', 'B1', '7', 'CH', 'B3', 'B2', 'B1', '7', 'CH', 'B2', 'B1'],
      w: [1, 7, 4, 2, 3, 2, 2, 2, 3, 2, 2, 2, 4, 2, 3, 2, 2, 2, 3, 2, 4, 16],
    },
  ],
};

const THREE = {
  id: 'classic-3',
  variant: 'three',
  title: 'Sierra Sevens Triple Line',
  lines: 3,
  maxCoins: 3,
  top: [1000, 1000, 1000],
  reels: [
    {
      syms: ['W', '7', 'B1', 'B3', 'CH', 'B2', 'B1', '7', 'B2', 'CH', 'B1'],
      w: [1, 4, 3, 3, 4, 3, 3, 3, 2, 3, 3, 3, 4, 3, 3, 3, 3, 3, 2, 3, 3, 6],
    },
    {
      syms: ['W', 'B2', 'CH', 'B1', '7', 'B3', 'B1', 'CH', 'B2', '7', 'B1'],
      w: [1, 4, 3, 3, 2, 3, 4, 3, 3, 3, 3, 3, 4, 3, 2, 3, 3, 3, 3, 3, 4, 5],
    },
    {
      syms: ['W', 'B1', '7', 'CH', 'B3', 'B2', 'B1', '7', 'CH', 'B2', 'B1'],
      w: [1, 4, 4, 3, 3, 3, 2, 3, 3, 3, 2, 3, 4, 3, 3, 3, 2, 3, 3, 3, 3, 6],
    },
  ],
};

export const CLASSIC_PARS = { single: SINGLE, three: THREE };

const SYM_ID = Object.fromEntries(CLASSIC_SYMBOLS.map((s, i) => [s, i]));
const W = SYM_ID.W;
const CH = SYM_ID.CH;
const BLANK = SYM_ID['-'];
const BARS = new Set([SYM_ID.B1, SYM_ID.B2, SYM_ID.B3]);
const THREE_KIND = Object.entries(CLASSIC_PAYS).map(([k, v]) => [SYM_ID[k], v]);

export function compileClassic(par) {
  const reels = par.reels.map((r) => {
    const phys = [];
    for (let i = 0; i < 11; i++) phys.push(SYM_ID[r.syms[i]], BLANK);
    const virt = [];
    r.w.forEach((w, stop) => {
      for (let k = 0; k < w; k++) virt.push(stop);
    });
    return { phys: Int8Array.from(phys), keys: phys.map((i) => CLASSIC_SYMBOLS[i]), weights: r.w.slice(), virt: Int8Array.from(virt) };
  });
  return { par, reels, virtualSize: reels.map((r) => r.virt.length) };
}

/** Pay for one line (a, b, c are symbol ids), per coin. Returns { pay, kind } kind for display. */
export function payLine(a, b, c, topPay) {
  const w = (a === W) + (b === W) + (c === W);
  if (w === 3) return { pay: topPay, kind: 'top' };
  const mult = w === 2 ? 4 : w === 1 ? 2 : 1;
  let best = 0;
  let kind = null;
  for (const [s, p] of THREE_KIND) {
    if ((a === s || a === W) && (b === s || b === W) && (c === s || c === W)) {
      const v = p * mult;
      if (v > best) {
        best = v;
        kind = CLASSIC_SYMBOLS[s];
      }
    }
  }
  const isBar = (x) => BARS.has(x) || x === W;
  if (isBar(a) && isBar(b) && isBar(c)) {
    const v = ANY_BAR * mult;
    if (v > best) {
      best = v;
      kind = 'anybar';
    }
  }
  const ch = (a === CH) + (b === CH) + (c === CH);
  if (ch > 0) {
    const n = Math.min(3, ch + w);
    const v = n === 3 ? 0 : CHERRY_PAYS[n] * (w ? mult : 1); // 3 handled above as 3-of-a-kind
    if (v > best) {
      best = v;
      kind = 'cherry';
    }
  }
  return { pay: best, kind };
}

/** Physical stop of each reel for the visible rows: row 0 (top) = stop-1, row 2 = stop+1. */
export function rowSym(reel, stop, row) {
  const n = reel.phys.length;
  return reel.phys[(stop + row - 1 + n) % n];
}

/**
 * One spin. coins = 1..3. Returns { stops (physical), virt, lines: [{ line, row, pay, kind }],
 * win (credits), hit, top }. For 'single' only the centre line pays; for 'three' line k (0 centre,
 * 1 top, 2 bottom) is live when coins > k.
 */
export function spinClassic(m, rng, coins = 1) {
  const virt = m.reels.map((r) => rng.int(r.virt.length));
  return evalClassic(m, virt, coins);
}

const LINE_ROWS = [1, 0, 2]; // centre, top, bottom

export function evalClassic(m, virt, coins) {
  const par = m.par;
  const stops = virt.map((v, i) => m.reels[i].virt[v]);
  const lines = [];
  let win = 0;
  const nLines = par.variant === 'three' ? coins : 1;
  const perLineCoins = par.variant === 'three' ? 1 : coins;
  for (let k = 0; k < nLines; k++) {
    const row = LINE_ROWS[k];
    const s = m.reels.map((r, i) => rowSym(r, stops[i], row));
    const top = par.variant === 'three' ? par.top[0] : par.top[coins - 1];
    const res = payLine(s[0], s[1], s[2], top);
    const pay = res.kind === 'top' ? (par.variant === 'three' ? top : top) : res.pay * perLineCoins;
    if (pay > 0) {
      lines.push({ line: k, row, pay, kind: res.kind });
      win += pay;
    }
  }
  return { virt, stops, lines, win, hit: win > 0, top: lines.some((l) => l.kind === 'top') };
}

/** Exact enumeration of every virtual combination → RTP per coin level, hit rate, top-award odds. */
export function exactClassic(m) {
  const [r0, r1, r2] = m.reels;
  const n0 = r0.virt.length;
  const n1 = r1.virt.length;
  const n2 = r2.virt.length;
  const total = n0 * n1 * n2;
  const out = [];
  for (let coins = 1; coins <= m.par.maxCoins; coins++) {
    let pay = 0;
    let pay2 = 0;
    let hits = 0;
    let tops = 0;
    let max = 0;
    const kinds = {};
    // Iterate over physical stops weighted by their virtual weight (same result, 22³ loops).
    for (let a = 0; a < 22; a++) {
      const wa = r0.weights[a];
      if (!wa) continue;
      for (let b = 0; b < 22; b++) {
        const wb = r1.weights[b];
        if (!wb) continue;
        for (let c = 0; c < 22; c++) {
          const wc = r2.weights[c];
          if (!wc) continue;
          const w = wa * wb * wc;
          const res = evalStops(m, [a, b, c], coins);
          if (res.win > 0) {
            hits += w;
            pay += res.win * w;
            pay2 += res.win * res.win * w;
            if (res.win > max) max = res.win;
            for (const l of res.lines) kinds[l.kind] = (kinds[l.kind] || 0) + (l.pay * w);
          }
          if (res.top) tops += w;
        }
      }
    }
    const bet = coins;
    const mean = pay / total / bet;
    const sd = Math.sqrt(pay2 / total / (bet * bet) - mean * mean);
    out.push({
      coins,
      rtp: mean,
      hitRate: hits / total,
      topOdds: tops ? total / tops : Infinity,
      maxWin: max,
      sd,
      breakdown: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v / total / bet])),
    });
  }
  return out;
}

function evalStops(m, stops, coins) {
  const par = m.par;
  const lines = [];
  let win = 0;
  const nLines = par.variant === 'three' ? coins : 1;
  const perLineCoins = par.variant === 'three' ? 1 : coins;
  for (let k = 0; k < nLines; k++) {
    const row = LINE_ROWS[k];
    const s = m.reels.map((r, i) => rowSym(r, stops[i], row));
    const top = par.variant === 'three' ? par.top[0] : par.top[coins - 1];
    const res = payLine(s[0], s[1], s[2], top);
    const pay = res.kind === 'top' ? top : res.pay * perLineCoins;
    if (pay > 0) {
      lines.push({ line: k, row, pay, kind: res.kind });
      win += pay;
    }
  }
  return { lines, win, top: lines.some((l) => l.kind === 'top') };
}
