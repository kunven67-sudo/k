// Casino chips: physical pocket items counted by denomination and by casino (DESIGN §9, §39).
//
// Chips are not cash. You buy them at the cage (or with cash at a table), carry them in your
// pockets, and cash them out at the same casino's cage — Eldorado chips are worthless at the
// Peppermill. Counts live in the 'chips' save slice; the phone wallet reads the total from
// money.chips, which this module keeps in sync.
//
//   import { chips, DENOMS } from '../casino/chips.js';
//   chips.total('eldorado')                    → 237.5
//   chips.counts('eldorado')                   → { 1: 7, 5: 4, 25: 8, ... }
//   chips.buyIn(100, 'eldorado', 'cage')        // gives chips worth $100 the way a cashier would
//   chips.pay(37.5, 'eldorado', 'blackjack')    // a dealer pays a win (prefers small chips)
//   chips.take(25, 'eldorado', 'bet')           // removes $25 of chips (breaks bigger ones if needed)
//   chips.removeAll('eldorado', 'cashout')      // → total removed
//
// Every change emits bus 'chips:changed' { chips (all casinos), total (this casino), delta,
// casino, reason }.

import { save } from '../core/save.js';
import { bus } from '../core/events.js';
import { slice as lifeSlice, addCash } from '../life/state.js';

// Standard Nevada colours. `stripe` is the edge-spot colour, `ink` the centre inlay print.
export const DENOMS = [
  { v: 1, name: 'white', color: 0xeeeae0, stripe: 0x2b58a8, ink: 0x1c2a52 },
  { v: 2.5, name: 'pink', color: 0xe59ab0, stripe: 0xffffff, ink: 0x5a1a2c },
  { v: 5, name: 'red', color: 0xb11d26, stripe: 0xf4f0e6, ink: 0x2a0a0c },
  { v: 25, name: 'green', color: 0x1c7a3b, stripe: 0xf4f0e6, ink: 0x0a2a14 },
  { v: 100, name: 'black', color: 0x1b1b1d, stripe: 0xf4f0e6, ink: 0xd8c08a },
  { v: 500, name: 'purple', color: 0x5a2a8a, stripe: 0xf2d24a, ink: 0x1e0c30 },
  { v: 1000, name: 'yellow', color: 0xe3b223, stripe: 0x1b1b1d, ink: 0x3a2a06 },
];
export const DENOM_VALUES = DENOMS.map((d) => d.v);
export const denomInfo = (v) => DENOMS.find((d) => d.v === v);

// Real chip: 39 mm across, 3.3 mm thick, ~10 g clay composite.
export const CHIP_RADIUS = 0.0195;
export const CHIP_THICKNESS = 0.0033;

save.registerSlice('chips', { create: () => ({ byCasino: {} }) });

const round2 = (v) => Math.round(v * 100) / 100;

// Dev pages run without a life: keep an in-memory stand-in so the games still work.
const fallback = { byCasino: {} };

function store() {
  const s = save.slice('chips') || fallback;
  if (!s.byCasino) s.byCasino = {};
  return s;
}

function bag(casino) {
  const s = store();
  if (!s.byCasino[casino]) s.byCasino[casino] = {};
  return s.byCasino[casino];
}

function valueOf(counts) {
  let v = 0;
  for (const [d, n] of Object.entries(counts)) v += +d * n;
  return round2(v);
}

/**
 * Split an amount into chips.
 *  style 'cage'  — what a cashier hands over for a buy-in: mostly the largest sensible chip, with
 *                  a few smaller ones so you can bet (e.g. $100 → 3×$25 + 5×$5).
 *  style 'pay'   — a dealer's payout: largest first, exact (blackjack 3:2 uses the pink $2.50).
 *  style 'large' — colour-up: as few chips as possible.
 * Anything under $1 that chips can't make (50¢ from odd 3:2 payouts) is returned as `coins`.
 */
export function breakdown(amount, style = 'pay') {
  let left = round2(amount);
  const out = {};
  const desc = [...DENOM_VALUES].sort((a, b) => b - a);
  if (style === 'cage') {
    // Keep a playable spread: never more than ~60% of the value in the top chip, and never hand a
    // $500+ chip for a buy-in under $2,000.
    const maxDen = left >= 5000 ? 1000 : left >= 2000 ? 500 : left >= 400 ? 100 : left >= 50 ? 25 : left >= 10 ? 5 : 1;
    for (const d of desc) {
      if (d > maxDen || d === 2.5) continue;
      let n = Math.floor(left / d);
      if (d === maxDen && d > 1) n = Math.min(n, Math.max(1, Math.floor((left * 0.6) / d)));
      if (n > 0) {
        out[d] = n;
        left = round2(left - n * d);
      }
    }
  } else {
    // A half-dollar fraction is paid with one pink $2.50 (3:2 on $5 = $7.50 → $5 + $2.50); the
    // rest is whole dollars, so greedy without the pink is exact.
    if (left % 1 !== 0 && left >= 2.5) {
      out[2.5] = 1;
      left = round2(left - 2.5);
    }
    for (const d of desc) {
      if (d === 2.5) continue;
      const n = Math.floor(left / d + 1e-9);
      if (n > 0) {
        out[d] = n;
        left = round2(left - n * d);
      }
    }
  }
  return { counts: out, coins: round2(left) };
}

function changed(casino, delta, reason) {
  const s = store();
  let all = 0;
  for (const c of Object.keys(s.byCasino)) all += valueOf(s.byCasino[c]);
  all = round2(all);
  lifeSlice('money').chips = all;
  save.markDirty?.();
  bus.emit('chips:changed', { chips: all, total: valueOf(bag(casino)), delta: round2(delta), casino, reason });
}

export const chips = {
  counts(casino = 'eldorado') {
    return { ...bag(casino) };
  },

  total(casino) {
    if (casino) return valueOf(bag(casino));
    const s = store();
    let v = 0;
    for (const c of Object.keys(s.byCasino)) v += valueOf(s.byCasino[c]);
    return round2(v);
  },

  /** Casinos you hold chips from (non-empty). */
  casinos() {
    const s = store();
    return Object.keys(s.byCasino).filter((c) => valueOf(s.byCasino[c]) > 0);
  },

  /** Add exact chip counts ({ 25: 2, 5: 3 }). */
  addCounts(counts, casino = 'eldorado', reason = '') {
    const b = bag(casino);
    let delta = 0;
    for (const [d, n] of Object.entries(counts)) {
      if (!n) continue;
      b[d] = (b[d] || 0) + n;
      delta += +d * n;
    }
    changed(casino, delta, reason);
    return counts;
  },

  /** Cashier buy-in. Returns the counts handed over. */
  buyIn(amount, casino = 'eldorado', reason = 'cage') {
    const { counts } = breakdown(amount, 'cage');
    return this.addCounts(counts, casino, reason);
  },

  /** Dealer payout. Returns { counts, coins } — coins (< $1) are the caller's to hand over as cash. */
  pay(amount, casino = 'eldorado', reason = 'win') {
    const r = breakdown(amount, 'pay');
    this.addCounts(r.counts, casino, reason);
    return r;
  },

  /** Remove exact counts. False (and nothing changes) if you don't have them. */
  removeCounts(counts, casino = 'eldorado', reason = '') {
    const b = bag(casino);
    for (const [d, n] of Object.entries(counts)) if ((b[d] || 0) < n) return false;
    let delta = 0;
    for (const [d, n] of Object.entries(counts)) {
      b[d] -= n;
      if (!b[d]) delete b[d];
      delta -= +d * n;
    }
    changed(casino, delta, reason);
    return true;
  },

  /**
   * Remove `amount` worth of chips: the largest chips that fit first, then — when what you hold
   * can't make the exact amount — the dealer breaks the smallest bigger chip and the change goes
   * back into your stacks (any 50¢ comes back as a coin, into cash).
   * Returns the counts that end up on the felt (exactly `amount`), or null if you can't cover it.
   */
  take(amount, casino = 'eldorado', reason = 'bet') {
    amount = round2(amount);
    if (amount <= 0 || this.total(casino) + 1e-9 < amount) return null;
    const b = bag(casino);
    const have = { ...b };
    let left = amount;
    for (const d of [...DENOM_VALUES].sort((x, y) => y - x)) {
      const n = Math.min(have[d] || 0, Math.floor(left / d + 1e-9));
      if (n > 0) {
        have[d] -= n;
        left = round2(left - n * d);
      }
    }
    let coins = 0;
    if (left > 0) {
      const big = DENOM_VALUES.filter((d) => d > left && (have[d] || 0) > 0).sort((x, y) => x - y)[0];
      if (big == null) return null;
      have[big] -= 1;
      const change = breakdown(round2(big - left), 'pay');
      for (const [d, n] of Object.entries(change.counts)) have[d] = (have[d] || 0) + n;
      coins = change.coins;
    }
    for (const k of Object.keys(b)) delete b[k];
    for (const [d, n] of Object.entries(have)) if (n > 0) b[d] = n;
    if (coins > 0) addCash(coins, 'change');
    changed(casino, -amount - coins, reason);
    return breakdown(amount, 'pay').counts;
  },

  /** Everything from one casino (cash-out at the cage). Returns the total removed. */
  removeAll(casino = 'eldorado', reason = 'cashout') {
    const v = this.total(casino);
    if (v <= 0) return 0;
    const s = store();
    s.byCasino[casino] = {};
    changed(casino, -v, reason);
    return v;
  },

  /** Colour up: swap small chips for fewer large ones (dealers do it when you leave a table). */
  colorUp(casino = 'eldorado') {
    const v = this.total(casino);
    const r = breakdown(v, 'pay');
    store().byCasino[casino] = { ...r.counts };
    if (r.coins > 0) addCash(r.coins, 'color-up');
    changed(casino, -r.coins, 'color-up');
    return { counts: { ...r.counts }, coins: r.coins };
  },
};

export { valueOf as chipValue };
