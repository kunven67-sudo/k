// Video slot math engine (5 reels × 3 rows): reel strips, line / 243-ways evaluation, scatters,
// free spins and the three theme features (sticky wilds, expanding wilds, hold & spin).
//
// Pure functions, no DOM / three.js: the same code runs in the game (outcomes from
// `fairRandom` through the `rng` adapter) and in `tools/slot-sim.mjs` (Monte-Carlo, a fast PRNG).
//
//   const m = compileTheme(PAR);              // once per theme (strips → int arrays, line table)
//   const r = playSpin(m, rng, { detail: true });  // → { total, base, feature, grid, wins, ... }
//
// Every amount here is in "bet units": a line game pays per 1 credit on each line (multiply by the
// credits per line), scatter / coin / jackpot awards are multiples of the TOTAL bet. `total` is
// returned as a multiple of the total bet so RTP = mean(total).
//
// rng adapter: { random(): [0,1), int(n): 0..n-1 }.

import { Rng } from '../../../core/rng.js';

export const REELS = 5;
export const ROWS = 3;
export const CELLS = REELS * ROWS; // cell index = reel * 3 + row

/** Build a reel strip from symbol counts, deterministically (same strip in the game and the sim). */
export function buildStrip(counts, { seed = 1, stacks = {} } = {}) {
  const r = new Rng(seed);
  // Blocks: stacked symbols are placed as contiguous runs, everything else as singles.
  const blocks = [];
  for (const [key, n] of Object.entries(counts)) {
    let left = n;
    const st = stacks[key];
    if (st) {
      while (left >= st) {
        blocks.push(Array(st).fill(key));
        left -= st;
      }
    }
    for (let i = 0; i < left; i++) blocks.push([key]);
  }
  // Shuffle blocks, then repair neighbours so the same single symbol rarely sits next to itself
  // (a strip of "K K K" reads like a bug, real strips spread symbols out).
  r.shuffle(blocks);
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < blocks.length; i++) {
      const a = blocks[i];
      const b = blocks[(i + 1) % blocks.length];
      if (a[a.length - 1] !== b[0]) continue;
      const j = r.int(0, blocks.length - 1);
      [blocks[(i + 1) % blocks.length], blocks[j]] = [blocks[j], blocks[(i + 1) % blocks.length]];
    }
  }
  // Scatters are spaced at least 3 stops apart, so a reel never shows two in its window.
  let strip = blocks.flat();
  for (let pass = 0; pass < 200; pass++) {
    const n = strip.length;
    let bad = -1;
    for (let i = 0; i < n && bad < 0; i++) {
      if (!spread.includes(strip[i])) continue;
      for (let d = 1; d < 3; d++) if (strip[(i + d) % n] === strip[i]) bad = (i + d) % n;
    }
    if (bad < 0) break;
    const j = r.int(0, n - 1);
    if (strip[j] === strip[bad] || stacked(strip, j)) continue;
    [strip[bad], strip[j]] = [strip[j], strip[bad]];
  }
  return strip;
}

const spread = ['S'];
// Don't break up a stack when moving a scatter.
function stacked(strip, j) {
  const n = strip.length;
  const k = strip[j];
  return strip[(j + 1) % n] === k || strip[(j - 1 + n) % n] === k;
}

/** Compile a PAR definition into int arrays the evaluator can run fast. */
export function compileTheme(par) {
  const keys = par.symbols.map((s) => s.key);
  const idx = Object.fromEntries(keys.map((k, i) => [k, i]));
  const W = idx.W ?? -1;
  const S = idx.S ?? -1;
  const C = idx.C ?? -1;
  const pays = keys.map((k) => {
    const p = par.pays[k] || [];
    return Float64Array.from({ length: 6 }, (_, i) => p[i] || 0);
  });
  const mkStrips = (set, tag) =>
    set.map((counts, ri) => {
      const keyStrip = buildStrip(counts, { seed: hash(`${par.id}|${tag}|${ri}`), stacks: par.stacks?.[tag]?.[ri] || par.stacks?.all || {} });
      return { keys: keyStrip, ids: Int8Array.from(keyStrip.map((k) => idx[k])) };
    });
  const strips = { base: mkStrips(par.reels.base, 'base'), free: mkStrips(par.reels.free || par.reels.base, 'free') };
  const lines = (par.lines || []).map((l) => Int8Array.from(l.map((row, reel) => reel * 3 + row)));
  // Symbols that can form a way / line win (not scatter / coin / blank).
  const payers = [];
  for (let i = 0; i < keys.length; i++) if (i !== S && i !== C && i !== W && pays[i].some((x) => x > 0)) payers.push(i);
  return {
    par,
    keys,
    idx,
    W,
    S,
    C,
    pays,
    payers,
    strips,
    lines,
    kind: par.kind,
    feature: par.feature,
    scatter: par.scatter,
    waysUnit: par.waysUnit || 1,
    // scratch buffers (not re-entrant; the game and the sim are single-threaded per instance)
    _grid: new Int8Array(CELLS),
    _wild: new Uint8Array(CELLS),
  };
}

function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Spin the reels: random stop per reel, the 3 visible symbols are stop-1, stop, stop+1. */
export function spinStops(m, rng, set = 'base', out = new Int16Array(REELS)) {
  const strips = m.strips[set];
  for (let r = 0; r < REELS; r++) out[r] = rng.int(strips[r].ids.length);
  return out;
}

export function fillGrid(m, stops, set = 'base', grid = new Int8Array(CELLS)) {
  const strips = m.strips[set];
  for (let r = 0; r < REELS; r++) {
    const s = strips[r].ids;
    const n = s.length;
    const st = stops[r];
    grid[r * 3] = s[(st - 1 + n) % n];
    grid[r * 3 + 1] = s[st];
    grid[r * 3 + 2] = s[(st + 1) % n];
  }
  return grid;
}

// ---- evaluation -----------------------------------------------------------------------------------

/**
 * Line wins for a grid (wild substitutes for every paying symbol; a line made of wilds pays the
 * better of the wild pay and the substituted symbol). Returns the sum in line-bet units; pushes
 * { kind:'line', line, sym, count, cells, pay } into `wins` when given.
 */
export function evalLines(m, grid, wins = null, lineMult = 1) {
  const { lines, pays, W, S, C } = m;
  let total = 0;
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li];
    let wildRun = 0;
    while (wildRun < REELS && grid[L[wildRun]] === W) wildRun++;
    const wildPay = W >= 0 ? pays[W][wildRun] : 0;
    let pay = 0;
    let sym = W;
    let count = wildRun;
    if (wildRun < REELS) {
      const t = grid[L[wildRun]];
      if (t !== S && t !== C) {
        let n = wildRun + 1;
        while (n < REELS && (grid[L[n]] === t || grid[L[n]] === W)) n++;
        const p = pays[t][n];
        if (p > wildPay) {
          pay = p;
          sym = t;
          count = n;
        }
      }
    }
    if (pay === 0 && wildPay > 0) {
      pay = wildPay;
      sym = W;
      count = wildRun;
    }
    if (pay > 0) {
      total += pay * lineMult;
      if (wins) wins.push({ kind: 'line', line: li, sym, count, cells: Array.from(L.slice(0, count)), pay: pay * lineMult });
    }
  }
  return total;
}

/**
 * 243-ways wins: a symbol pays when it (or a wild) appears on adjacent reels from the left;
 * pay = table × number of ways. Units: per waysUnit credits of bet (divide by it for × total bet).
 */
export function evalWays(m, grid, wins = null, mult = 1) {
  const { payers, pays, W } = m;
  let total = 0;
  for (let k = 0; k < payers.length; k++) {
    const s = payers[k];
    let ways = 1;
    let n = 0;
    for (let r = 0; r < REELS; r++) {
      let c = 0;
      const b = r * 3;
      for (let row = 0; row < 3; row++) {
        const g = grid[b + row];
        if (g === s || g === W) c++;
      }
      if (c === 0) break;
      ways *= c;
      n++;
    }
    const p = pays[s][n];
    if (p > 0) {
      const pay = p * ways * mult;
      total += pay;
      if (wins) {
        const cells = [];
        for (let r = 0; r < n; r++) for (let row = 0; row < 3; row++) if (grid[r * 3 + row] === s || grid[r * 3 + row] === W) cells.push(r * 3 + row);
        wins.push({ kind: 'ways', sym: s, count: n, ways, cells, pay });
      }
    }
  }
  return total;
}

export function countSym(grid, s) {
  let c = 0;
  for (let i = 0; i < CELLS; i++) if (grid[i] === s) c++;
  return c;
}

/** Wins of one grid as a multiple of the total bet (lines: all lines played at 1 credit each). */
function gridWin(m, grid, wins, mult = 1) {
  if (m.kind === 'ways') return evalWays(m, grid, wins, mult) / m.waysUnit;
  return evalLines(m, grid, wins, mult) / m.lines.length;
}

// ---- features -------------------------------------------------------------------------------------

/** Expanding wilds: any wild on an allowed reel turns that whole reel wild. Returns reels expanded. */
function expandWilds(m, grid, expandedOut) {
  const reelsAllowed = m.feature.reels;
  let n = 0;
  for (const r of reelsAllowed) {
    const b = r * 3;
    if (grid[b] === m.W || grid[b + 1] === m.W || grid[b + 2] === m.W) {
      grid[b] = grid[b + 1] = grid[b + 2] = m.W;
      n++;
      if (expandedOut) expandedOut.push(r);
    }
  }
  return n;
}

/** Hold & spin: coins lock, 3 respins, every new coin resets to 3. 15 independent cells. */
export function playHoldSpin(m, rng, startCells, detail) {
  const f = m.feature;
  const value = new Float64Array(CELLS); // × total bet; 0 = empty
  const label = detail ? new Array(CELLS).fill(null) : null;
  let filled = 0;
  const draw = (cell) => {
    const v = pickWeighted(f.values, rng);
    value[cell] = v.x;
    if (label) label[cell] = v.label || null;
    filled++;
  };
  for (const c of startCells) draw(c);
  const steps = detail ? [{ cells: startCells.slice(), respins: 3 }] : null;
  let respins = 3;
  while (respins > 0 && filled < CELLS) {
    respins--;
    const fresh = [];
    const q = f.cellChance[Math.min(filled, f.cellChance.length - 1)];
    for (let c = 0; c < CELLS; c++) {
      if (value[c] > 0) continue;
      if (rng.random() < q) {
        draw(c);
        fresh.push(c);
      }
    }
    if (fresh.length) respins = 3;
    if (steps) steps.push({ cells: fresh, respins });
  }
  let total = 0;
  for (let c = 0; c < CELLS; c++) total += value[c];
  let grand = 0;
  if (filled === CELLS) {
    grand = f.fullScreen;
    total += grand;
  }
  if (!detail) return { total };
  return { total, steps, values: Array.from(value), labels: label, full: filled === CELLS, fullAward: grand };
}

function pickWeighted(list, rng) {
  // list: [{ x, w, label? }] with precomputed list.totalW
  let tw = list.totalW;
  if (tw == null) {
    tw = 0;
    for (const e of list) tw += e.w;
    list.totalW = tw;
  }
  let u = rng.random() * tw;
  for (const e of list) {
    if ((u -= e.w) < 0) return e;
  }
  return list[list.length - 1];
}

/** Values shown on coins that land in the base game (cosmetic until 6+ trigger the feature). */
export function coinFace(m, rng) {
  return pickWeighted(m.feature.values, rng);
}

/** One free-spins session. Returns { total, spins: [...] } (spins only with detail). */
function playFree(m, rng, count, detail) {
  const f = m.feature;
  const sc = m.scatter;
  const spins = detail ? [] : null;
  const stops = new Int16Array(REELS);
  const grid = new Int8Array(CELLS);
  const sticky = new Uint8Array(CELLS);
  let left = count;
  let played = 0;
  let total = 0;
  while (left > 0 && played < (sc.maxFree || 50)) {
    left--;
    played++;
    spinStops(m, rng, 'free', stops);
    fillGrid(m, stops, 'free', grid);
    const landed = detail ? Int8Array.from(grid) : null;
    let mult = sc.freeMult || 1;
    const expanded = detail ? [] : null;
    const newSticky = detail ? [] : null;
    if (f.type === 'sticky') {
      for (let c = 0; c < CELLS; c++) {
        if (grid[c] === m.W && !sticky[c]) {
          sticky[c] = 1;
          if (newSticky) newSticky.push(c);
        }
        if (sticky[c]) grid[c] = m.W;
      }
    } else if (f.type === 'expand') {
      const n = expandWilds(m, grid, expanded);
      if (n > 0) mult *= f.freeMultPerReel[n];
    }
    const wins = detail ? [] : null;
    let win = gridWin(m, grid, wins, mult);
    const scat = countSym(grid, m.S);
    if (scat >= 3) {
      const sp = (sc.pays[scat] || 0) * (sc.freeScatterPay ? 1 : 0);
      if (sp && wins) wins.push({ kind: 'scatter', sym: m.S, count: scat, cells: cellsOf(grid, m.S), pay: sp });
      win += sp;
      if (sc.retrigger) left += sc.retrigger[scat] || 0;
    }
    let hold = null;
    if (f.type === 'holdspin' && countSym(grid, m.C) >= f.trigger) {
      hold = playHoldSpin(m, rng, cellsOf(grid, m.C), detail);
      win += hold.total;
    }
    total += win;
    if (spins) spins.push({ stops: Array.from(stops), landed: Array.from(landed), grid: Array.from(grid), wins, win, mult, expanded, newSticky, sticky: Array.from(sticky), hold, left, scatters: scat });
  }
  return { total, spins, played };
}

function cellsOf(grid, s) {
  const out = [];
  for (let i = 0; i < CELLS; i++) if (grid[i] === s) out.push(i);
  return out;
}

/**
 * One paid spin. Returns totals as multiples of the total bet:
 *   { total, base, scatter, free, hold, hit, trigger:'free'|'hold'|null, ... detail fields }
 * With { detail: true } also: stops, landed (pre-feature grid), grid (after expansion), wins
 * (line/ways/scatter), expanded reels, free: {spins,total}, holdSpin: {...}, coinFaces.
 */
export function playSpin(m, rng, { detail = false, stops: forced = null } = {}) {
  const stops = forced ? Int16Array.from(forced) : spinStops(m, rng, 'base');
  const grid = detail ? new Int8Array(CELLS) : m._grid;
  fillGrid(m, stops, 'base', grid);
  const landed = detail ? Int8Array.from(grid) : null;
  const f = m.feature;
  const sc = m.scatter;
  let expanded = null;
  if (f.type === 'expand' && f.base) {
    expanded = detail ? [] : null;
    expandWilds(m, grid, expanded);
  }
  const wins = detail ? [] : null;
  const base = gridWin(m, grid, wins, 1);
  let scatter = 0;
  let free = 0;
  let hold = 0;
  let freeRes = null;
  let holdRes = null;
  let trigger = null;
  const scat = countSym(grid, m.S);
  if (scat >= 3) {
    scatter = sc.pays[scat] || 0;
    if (wins && scatter) wins.push({ kind: 'scatter', sym: m.S, count: scat, cells: cellsOf(grid, m.S), pay: scatter });
    const n = sc.spins[scat] || 0;
    if (n > 0) {
      freeRes = playFree(m, rng, n, detail);
      free = freeRes.total;
      trigger = 'free';
    }
  }
  if (f.type === 'holdspin') {
    const coins = countSym(grid, m.C);
    if (coins >= f.trigger) {
      holdRes = playHoldSpin(m, rng, cellsOf(grid, m.C), detail);
      hold = holdRes.total;
      trigger = trigger ? 'both' : 'hold';
    }
  }
  const total = base + scatter + free + hold;
  if (!detail) {
    m._last = { total, base, scatter, free, hold, trigger };
    return m._last;
  }
  return {
    total,
    base,
    scatter,
    free,
    hold,
    trigger,
    hit: total > 0,
    stops: Array.from(stops),
    landed: Array.from(landed),
    grid: Array.from(grid),
    wins,
    expanded,
    scatters: scat,
    freeGame: freeRes,
    holdSpin: holdRes,
  };
}
