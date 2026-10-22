/* HANDS OFF: numbers, economy, saves. No DOM in here. */
(function (root) {
  'use strict';

  // ---------- endless numbers ----------
  // Every amount is stored as its log10, so it can grow forever (1e308 is not a wall).
  // -Infinity means zero.
  const ZERO = -Infinity;
  const L = {
    from(x) { return x > 0 ? Math.log10(x) : ZERO; },
    add(a, b) {
      if (a === ZERO) return b;
      if (b === ZERO) return a;
      const hi = Math.max(a, b), lo = Math.min(a, b);
      if (hi - lo > 17) return hi;
      return hi + Math.log10(1 + Math.pow(10, lo - hi));
    },
    sub(a, b) { // a - b, floored at zero
      if (b === ZERO) return a;
      if (b >= a) return ZERO;
      if (a - b > 17) return a;
      return a + Math.log10(1 - Math.pow(10, b - a));
    },
  };

  // Conway-Wechsler names: 10^(3n+3) = the n-illion, works for any size
  const SMALL = ['', 'm', 'b', 'tr', 'quadr', 'quint', 'sext', 'sept', 'oct', 'non'];
  const UNITS = ['', 'un', 'duo', 'tre', 'quattuor', 'quinqua', 'se', 'septe', 'octo', 'nove'];
  const TENS = [['', ''], ['deci', 'N'], ['viginti', 'MS'], ['triginta', 'NS'], ['quadraginta', 'NS'], ['quinquaginta', 'NS'],
    ['sexaginta', 'N'], ['septuaginta', 'N'], ['octoginta', 'MX'], ['nonaginta', '']];
  const HUNDREDS = [['', ''], ['centi', 'NX'], ['ducenti', 'N'], ['trecenti', 'NS'], ['quadringenti', 'NS'], ['quingenti', 'NS'],
    ['sescenti', 'N'], ['septingenti', 'N'], ['octingenti', 'MX'], ['nongenti', '']];

  function groupPrefix(g) { // 1..999 -> latin chunk ending in a vowel
    if (g < 10) return SMALL[g] + 'i';
    const u = g % 10, t = Math.floor(g / 10) % 10, h = Math.floor(g / 100);
    const next = t ? TENS[t] : HUNDREDS[h];
    const mark = next[1];
    let unit = UNITS[u];
    if (u === 3 && /[SX]/.test(mark)) unit = 'tres';
    else if (u === 6 && mark.includes('S')) unit = 'ses';
    else if (u === 6 && mark.includes('X')) unit = 'sex';
    else if ((u === 7 || u === 9) && mark.includes('M')) unit += 'm';
    else if ((u === 7 || u === 9) && mark.includes('N')) unit += 'n';
    let s = unit + TENS[t][0] + HUNDREDS[h][0];
    s = s.replace(/[aeiou]$/, '') + 'i';
    return s;
  }
  function illionName(n) { // n >= 1
    if (n < 1) return '';
    const groups = [];
    let x = n;
    while (x > 0) { groups.unshift(x % 1000); x = Math.floor(x / 1000); }
    let s = '';
    groups.forEach((g, i) => { s += (g === 0 ? 'n' : groupPrefix(g).replace(/i$/, '')) + (i < groups.length - 1 ? 'illi' : 'illion'); });
    return s.replace(/^illi/, '');
  }
  // tier t means 10^(3t): 1 = thousand, 2 = million, ...
  function tierName(t) {
    if (t <= 0) return '';
    if (t === 1) return 'thousand';
    return illionName(t - 1);
  }

  function trimNum(x, digits) {
    const s = x.toFixed(digits);
    return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
  }
  // { num: '421.6', word: 'quadrillion', tier } with 3-4 significant digits, never rounds up past 999
  function parts(l) {
    if (l === ZERO || !(l > -1e300)) return { num: '0', word: '', tier: 0 };
    if (l < 6) {
      const v = Math.floor(Math.pow(10, l) + 1e-9);
      return { num: v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','), word: '', tier: 0 };
    }
    let t = Math.floor(l / 3 + 1e-12);
    let m = Math.pow(10, l - t * 3);
    if (m >= 1000) { m /= 1000; t += 1; }
    let s;
    const e = 1e-7; // 10^(log10 5) comes back as 4.99999999
    if (m >= 100) s = String(Math.floor(m * 10 + e) / 10);
    else if (m >= 10) s = trimNum(Math.floor(m * 100 + e) / 100, 2);
    else s = trimNum(Math.floor(m * 1000 + e) / 1000, 3);
    if (s.indexOf('.') < 0 && m >= 100 && m < 1000) s = String(Math.floor(m));
    return { num: s, word: tierName(t), tier: t };
  }
  function short(l) { // compact for small labels: 4.21e15 style past the named range
    if (l === ZERO) return '0';
    if (l < 6) return parts(l).num;
    const p = parts(l);
    if (p.word.length <= 13) return p.num + ' ' + p.word;
    const e = Math.floor(l + 1e-12);
    return trimNum(Math.floor(Math.pow(10, l - e) * 100 + 1e-7) / 100, 2) + 'e' + e;
  }
  function fmtTime(sec) {
    sec = Math.max(0, sec || 0);
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    const p2 = (x) => (x < 10 ? '0' : '') + x;
    if (d > 0) return d + 'd ' + p2(h) + ':' + p2(m) + ':' + p2(s);
    if (h > 0) return h + ':' + p2(m) + ':' + p2(s);
    return p2(m) + ':' + p2(s);
  }

  // ---------- economy ----------
  const LV = Math.log10(1.4);       // every level multiplies income by 1.4
  const BASE = 2;                   // log10 of starting income (100 per second)
  // seconds per level at speed 1: the first levels fly by in a third of a second, then it settles
  const LEVEL_REQ = (lv) => 1.2 + 0.06 * lv - 0.85 * Math.exp(-lv / 10);
  const WORLD_LEVELS = 20;

  function hash(n) { // deterministic 0..1
    let x = (n | 0) * 374761393 + 668265263;
    x = (x ^ (x >>> 13)) * 1274126177;
    x = x ^ (x >>> 16);
    return (x >>> 0) / 4294967296;
  }

  // The endless upgrade list. Each one buys itself as soon as it costs 10% or less of what you have.
  const PRE = ['PHASE', 'NULL', 'ECHO', 'VOID', 'QUANTUM', 'STATIC', 'PRISM', 'HALO', 'FRACTURE', 'SINGULAR', 'CHROME', 'DRIFT',
    'APEX', 'GHOST', 'HYPER', 'DARK', 'INFINITE', 'RECURSIVE', 'ORBITAL', 'SILENT', 'BROKEN', 'MIRROR', 'ZERO', 'FERAL'];
  const NOUN = ['LOCK', 'ENGINE', 'LOOP', 'FIELD', 'CORE', 'GATE', 'SPIRAL', 'LENS', 'SHELL', 'PULSE', 'ARRAY', 'WELL',
    'ANCHOR', 'CROWN', 'STORM', 'SEED', 'THREAD', 'VEIN', 'HORIZON', 'ENGRAM', 'LATTICE', 'SIGIL', 'REACTOR', 'TIDE'];
  const upCache = [];
  function upgrade(k) {
    if (upCache[k]) return upCache[k];
    const kind = k % 10 === 9 ? 'resonance' : k % 4 === 3 ? 'tempo' : 'mult';
    const name = PRE[Math.floor(hash(k * 7 + 1) * PRE.length)] + ' ' + NOUN[Math.floor(hash(k * 13 + 5) * NOUN.length)];
    const u = {
      k, kind, name,
      cost: 1.3 + 0.75 * k + 0.0028 * k * k,             // log10 price
      mult: kind === 'mult' ? Math.log10(1.8 + Math.floor(hash(k * 31 + 9) * 14) / 10) : kind === 'tempo' ? Math.log10(1.3) : 0,
      speed: kind === 'tempo' ? 0.04 : 0, // added, not multiplied (multiplying ran away to infinity)
      seed: Math.floor(hash(k * 101 + 3) * 1e9),
    };
    upCache[k] = u;
    return u;
  }

  // money gets a new name (and icon) at every x1000 milestone
  const MONEY = ['FLUX', 'VOID', 'STATIC', 'PRISM', 'SHARDS', 'ECHO', 'NULL', 'HALO', 'DRIFT', 'APEX', 'PULSE', 'RIFT',
    'CORE', 'GHOST', 'QUANTA', 'AETHER', 'NOVA', 'ENTROPY', 'ZERO', 'OMEN', 'SIGNAL', 'MASS', 'EVENT', 'SILENCE'];
  function moneyName(tier) {
    const i = Math.max(0, tier);
    const base = MONEY[i % MONEY.length];
    const lap = Math.floor(i / MONEY.length);
    return lap ? base + ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(lap - 1, 8)] + (lap > 9 ? '+' : '') : base;
  }

  const LOOKS = ['EVENT HORIZON', 'PILLARS', 'RINGED GIANT', 'PULSAR', 'QUASAR', 'COLLISION'];
  function worldOf(level) { return Math.floor(level / WORLD_LEVELS); }
  function worldName(w) {
    const lap = Math.floor(w / LOOKS.length);
    return LOOKS[w % LOOKS.length] + (lap ? ' ' + (lap + 1) : '');
  }

  function newRun(now) {
    return { start: now, t: 0, level: 0, lp: 0, logC: ZERO, ups: 0, upLog: 0, speed: 1, maxTier: 0, maxLog: ZERO, earned: ZERO };
  }

  function incomeLog(r) {
    // resonance upgrades scale with your level, so they keep paying more the longer you hold still
    const res = Math.floor((r.ups + 1) / 10) * Math.log10(1 + r.level / 40);
    return BASE + r.level * LV + r.upLog + res;
  }

  // Advance a run by dt seconds. Returns what happened (for effects). Same math online and offline.
  function step(r, dt, out) {
    out = out || { levels: 0, bought: [], milestones: [] };
    let left = dt;
    const maxSlice = Math.max(2.5, dt / 150000); // keeps a month offline fast to work out
    while (left > 1e-9) {
      const req = LEVEL_REQ(r.level) / r.speed;
      const toNext = (1 - r.lp) * req;
      const h = Math.max(1e-6, Math.min(left, toNext, maxSlice));
      // income over this slice (level fixed inside a slice)
      const gain = incomeLog(r) + Math.log10(h);
      r.logC = L.add(r.logC, gain);
      r.earned = L.add(r.earned, gain);
      r.lp += h / req;
      r.t += h;
      left -= h;
      if (r.lp >= 1 - 1e-9) { r.lp = 0; r.level++; out.levels++; }
      // self-buying upgrades
      for (let guard = 0; guard < 50; guard++) {
        const u = upgrade(r.ups);
        if (r.logC < u.cost + 1) break;
        r.logC = L.sub(r.logC, u.cost);
        r.ups++;
        r.upLog += u.mult;
        r.speed += u.speed;
        if (out.bought.length < 64) out.bought.push(u.k);
      }
      if (r.logC > r.maxLog) r.maxLog = r.logC;
      const tier = r.maxLog >= 3 ? Math.floor(r.maxLog / 3 + 1e-12) : 0;
      while (r.maxTier < tier) { r.maxTier++; if (out.milestones.length < 64) out.milestones.push(r.maxTier); }
    }
    return out;
  }

  // ---------- saves ----------
  const VERSION = 1;
  function newSave(now) {
    return {
      v: VERSION, created: now, savedAt: now,
      run: null,            // null = no run going (start screen shows START)
      rec: { bestTime: 0, bestLog: ZERO, bestLevel: 0, bestWorld: 0, resets: 0, runs: 0, totalTime: 0 },
      tro: {},
      set: { quality: 'auto', music: 0.7, sfx: 0.8, flashes: true },
    };
  }
  const num = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= (lo === undefined ? 0 : lo) && v <= (hi === undefined ? Infinity : hi) ? v : d);
  const logNum = (v) => (v === null || v === undefined || v === '-inf' ? ZERO : typeof v === 'number' && isFinite(v) && v > -1e6 && v < 1e15 ? v : ZERO);
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const now = Date.now();
    const s = newSave(now);
    s.created = num(raw.created, now);
    s.savedAt = num(raw.savedAt, now);
    if (raw.rec && typeof raw.rec === 'object') {
      s.rec.bestTime = num(raw.rec.bestTime, 0);
      s.rec.bestLog = logNum(raw.rec.bestLog);
      s.rec.bestLevel = Math.floor(num(raw.rec.bestLevel, 0));
      s.rec.bestWorld = Math.floor(num(raw.rec.bestWorld, 0));
      s.rec.resets = Math.floor(num(raw.rec.resets, 0));
      s.rec.runs = Math.floor(num(raw.rec.runs, 0));
      s.rec.totalTime = num(raw.rec.totalTime, 0);
    }
    if (raw.tro && typeof raw.tro === 'object') for (const id in raw.tro) if (TRO[id] && raw.tro[id]) s.tro[id] = num(raw.tro[id], now) || now;
    if (raw.set && typeof raw.set === 'object') {
      s.set.quality = ['auto', 'low', 'high', 'max', 'insane'].indexOf(raw.set.quality) >= 0 ? raw.set.quality : 'auto';
      s.set.music = num(raw.set.music, 0.7, 0, 1);
      s.set.sfx = num(raw.set.sfx, 0.8, 0, 1);
      s.set.flashes = raw.set.flashes !== false;
    }
    const r = raw.run;
    if (r && typeof r === 'object' && typeof r.level === 'number') {
      const n = newRun(num(r.start, now));
      n.t = num(r.t, 0);
      n.level = Math.floor(num(r.level, 0, 0, 1e9));
      n.lp = num(r.lp, 0, 0, 1);
      n.logC = logNum(r.logC);
      n.ups = Math.floor(num(r.ups, 0, 0, 1e5));
      n.upLog = 0; n.speed = 1;
      for (let k = 0; k < n.ups; k++) { const u = upgrade(k); n.upLog += u.mult; n.speed += u.speed; } // rebuilt, never trusted
      n.maxLog = Math.max(logNum(r.maxLog), n.logC);
      n.maxTier = n.maxLog >= 3 ? Math.floor(n.maxLog / 3 + 1e-12) : 0;
      n.earned = Math.max(logNum(r.earned), n.logC);
      s.run = n;
    }
    return s;
  }
  function serialize(s) {
    return JSON.stringify(s, (k, v) => (v === ZERO ? '-inf' : v));
  }
  function parse(str) {
    if (typeof str !== 'string' || !str) return null;
    try { return sanitize(JSON.parse(str)); } catch (e) { return null; }
  }

  // ---------- trophies (kept forever) ----------
  const TROPHIES = [];
  const TRO = {};
  function T(id, group, name, desc) { const t = { id, group, name, desc }; TROPHIES.push(t); TRO[id] = t; }
  [[60, 'STILL', '1 minute'], [600, 'STILLER', '10 minutes'], [3600, 'STATUE', '1 hour'], [21600, 'FOSSIL', '6 hours'],
   [86400, 'ENTROPY', '24 hours'], [604800, 'HEAT DEATH', '1 week']]
    .forEach(([s, name, d], i) => T('time' + i, 'time', name, 'Hands off for ' + d + ' straight.'));
  T('reset1', 'roast', 'WHY WOULD YOU DO SOMETHING?', 'Reset for the first time.');
  T('reset10', 'roast', 'AGAIN??', 'Reset 10 times.');
  T('reset50', 'roast', 'BRO.', 'Reset 50 times.');
  T('reset100', 'roast', 'YOU HAD ONE JOB', 'Reset 100 times.');
  T('flinch', 'roast', 'FLINCH', 'Reset in the first second.');
  T('close', 'roast', 'SO CLOSE', 'Reset right before a milestone.');
  T('push', 'roast', 'YOU PUSHED IT', 'Pressed the PUSH button.');
  T('bait', 'roast', 'THERE WAS NOTHING FREE', 'Fell for a free reward.');
  T('error', 'roast', 'IT WASN\'T BROKEN', 'Tried to fix a fake error.');
  T('keys', 'roast', 'BUTTERFINGERS', 'Reset with the keyboard.');
  T('touch', 'roast', 'TOUCHY', 'Reset by touching the screen.');
  T('scroll', 'roast', 'SCROLL OF SHAME', 'Reset by scrolling.');
  T('pad', 'roast', 'PUT IT DOWN', 'Reset with a controller.');
  [[6, 'MILLION', 'a million'], [9, 'BILLION', 'a billion'], [12, 'TRILLION', 'a trillion'], [33, 'DECILLION', 'a decillion'],
   [100, 'GOOGOL', 'a googol (10^100)'], [303, 'CENTILLION', 'a centillion (10^303)'], [1000, 'BEYOND NUMBERS', '10^1000']]
    .forEach(([lg, name, d], i) => { T('num' + i, 'number', name, 'Reach ' + d + ' in one run.'); TRO['num' + i].log = lg; });
  [[1, 'ELSEWHERE'], [5, 'DEEPER'], [10, 'NO WAY BACK'], [50, 'PAST THE EDGE']]
    .forEach(([w, name], i) => { T('world' + i, 'world', name, 'Reach world ' + (w + 1) + '.'); TRO['world' + i].world = w; });
  const TIME_SECS = [60, 600, 3600, 21600, 86400, 604800];

  const API = {
    ZERO, L, parts, short, fmtTime, tierName, illionName, hash,
    LV, LEVEL_REQ, WORLD_LEVELS, upgrade, incomeLog, moneyName, worldOf, worldName, LOOKS, MONEY,
    newRun, step, newSave, sanitize, serialize, parse, TROPHIES, TRO, TIME_SECS, VERSION,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.HO = API;
})(typeof window !== 'undefined' ? window : globalThis);
