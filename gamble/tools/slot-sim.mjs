// Monte-Carlo verifier for the slot PAR sheets (src/casino/slots/math). Runs the exact game math
// (same modules the machines use) with a fast PRNG on worker threads.
//
//   node gamble/tools/slot-sim.mjs                 all themes, 10 M spins each
//   node gamble/tools/slot-sim.mjs space 2e6       one theme, 2 M spins
//   node gamble/tools/slot-sim.mjs all 2e7 --workers 4
//
// Themes: classic-fruit (single-line + 3-line steppers: exact enumeration + MC cross-check),
// wild-west, space, dragon. Prints RTP with a 95 % confidence interval, hit frequency, the
// contribution of each part (base / scatter / free spins / hold & spin), feature odds, the
// standard deviation per spin (volatility index) and the biggest win seen.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const MATH = new URL('../src/casino/slots/math/', import.meta.url);

// xoshiro128** — fast, good-quality 32-bit PRNG for simulation only (the game uses fairRandom).
function makeRng(seed) {
  let a = seed ^ 0x9e3779b9;
  let b = Math.imul(seed, 0x85ebca6b) ^ 0xc2b2ae35;
  let c = Math.imul(seed ^ 0x27d4eb2f, 0x165667b1);
  let d = seed * 7 + 0x61c88647;
  const next = () => {
    const r = Math.imul(rotl(Math.imul(b, 5), 7), 9);
    const t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return r >>> 0;
  };
  for (let i = 0; i < 16; i++) next();
  return {
    random: () => (next() * 2 ** 21 + (next() >>> 11)) / 2 ** 53,
    int: (n) => Math.floor((next() / 4294967296) * n),
  };
}
function rotl(x, k) {
  return (x << k) | (x >>> (32 - k));
}

async function runVideo(theme, spins, seed) {
  const { compileTheme, playSpin } = await import(new URL('engine.js', MATH));
  const { VIDEO_PARS } = await import(new URL('themes.js', MATH));
  const m = compileTheme(VIDEO_PARS[theme]);
  const rng = makeRng(seed);
  const s = { n: 0, sum: 0, sum2: 0, hits: 0, base: 0, scatter: 0, free: 0, hold: 0, freeN: 0, holdN: 0, max: 0, big: 0, b10: 0, b100: 0 };
  for (let i = 0; i < spins; i++) {
    const r = playSpin(m, rng);
    const x = r.total;
    s.n++;
    s.sum += x;
    s.sum2 += x * x;
    if (x > 0) s.hits++;
    s.base += r.base;
    s.scatter += r.scatter;
    s.free += r.free;
    s.hold += r.hold;
    if (r.trigger === 'free' || r.trigger === 'both') s.freeN++;
    if (r.trigger === 'hold' || r.trigger === 'both') s.holdN++;
    if (x > s.max) s.max = x;
    if (x >= 10) s.b10++;
    if (x >= 100) s.b100++;
  }
  return s;
}

async function runClassic(variant, spins, seed) {
  const { CLASSIC_PARS, compileClassic, spinClassic } = await import(new URL('classic.js', MATH));
  const m = compileClassic(CLASSIC_PARS[variant]);
  const rng = makeRng(seed);
  const out = [];
  for (let coins = 1; coins <= 3; coins++) {
    const s = { n: 0, sum: 0, sum2: 0, hits: 0, tops: 0, max: 0 };
    const per = Math.floor(spins / 3);
    for (let i = 0; i < per; i++) {
      const r = spinClassic(m, rng, coins);
      const x = r.win / coins;
      s.n++;
      s.sum += x;
      s.sum2 += x * x;
      if (r.win > 0) s.hits++;
      if (r.top) s.tops++;
      if (r.win > s.max) s.max = r.win;
    }
    out.push(s);
  }
  return out;
}

if (!isMainThread) {
  const { kind, theme, spins, seed } = workerData;
  const res = kind === 'classic' ? await runClassic(theme, spins, seed) : await runVideo(theme, spins, seed);
  parentPort.postMessage(res);
} else {
  const args = process.argv.slice(2);
  const wi = args.indexOf('--workers');
  const workers = wi >= 0 ? +args[wi + 1] : Math.max(1, Math.min(8, availableParallelism()));
  const pos = args.filter((a, i) => !a.startsWith('--') && (wi < 0 || i !== wi + 1));
  const which = pos[0] || 'all';
  const spins = Math.round(Number(pos[1] || 1e7));
  const themes = which === 'all' ? ['classic-fruit', 'wild-west', 'space', 'dragon'] : [which];
  const self = fileURLToPath(import.meta.url);

  const par = (kind, theme) =>
    Promise.all(
      Array.from({ length: workers }, (_, k) =>
        new Promise((resolve, reject) => {
          const w = new Worker(self, { workerData: { kind, theme, spins: Math.ceil(spins / workers), seed: (Date.now() + k * 7919) | 0 } });
          w.once('message', resolve);
          w.once('error', reject);
        }),
      ),
    );
  const pct = (x) => `${(x * 100).toFixed(2)}%`;
  const merge = (parts) => {
    const s = {};
    for (const p of parts) for (const [k, v] of Object.entries(p)) s[k] = k === 'max' ? Math.max(s[k] || 0, v) : (s[k] || 0) + v;
    return s;
  };
  for (const theme of themes) {
    const t0 = Date.now();
    if (theme === 'classic-fruit') {
      const { CLASSIC_PARS, compileClassic, exactClassic } = await import(new URL('classic.js', MATH));
      for (const variant of ['single', 'three']) {
        const m = compileClassic(CLASSIC_PARS[variant]);
        const exact = exactClassic(m);
        const parts = await par('classic', variant);
        console.log(`\n== Classic Fruit — ${CLASSIC_PARS[variant].title} (${variant}, virtual reels ${m.virtualSize.join('/')}) ==`);
        for (let c = 0; c < 3; c++) {
          const s = merge(parts.map((p) => p[c]));
          const mean = s.sum / s.n;
          const sd = Math.sqrt(s.sum2 / s.n - mean * mean);
          const ci = 1.96 * (sd / Math.sqrt(s.n));
          const e = exact[c];
          console.log(
            `  ${c + 1} coin${c ? 's' : ' '}: exact RTP ${pct(e.rtp)} hit ${pct(e.hitRate)} top 1/${Math.round(e.topOdds).toLocaleString()} max ${e.maxWin} sd ${e.sd.toFixed(2)}` +
              ` | MC ${s.n.toLocaleString()} spins RTP ${pct(mean)} ±${pct(ci)} hit ${pct(s.hits / s.n)} tops ${s.tops}`,
          );
        }
      }
    } else {
      const parts = await par('video', theme);
      const s = merge(parts);
      const mean = s.sum / s.n;
      const sd = Math.sqrt(s.sum2 / s.n - mean * mean);
      const ci = 1.96 * (sd / Math.sqrt(s.n));
      console.log(`\n== ${theme} — ${s.n.toLocaleString()} spins (${((Date.now() - t0) / 1000).toFixed(1)} s) ==`);
      console.log(`  RTP ${pct(mean)} ±${pct(ci)} (95% CI)   hit ${pct(s.hits / s.n)}   sd ${sd.toFixed(2)} × bet`);
      console.log(`  base ${pct(s.base / s.n)}  scatter ${pct(s.scatter / s.n)}  free ${pct(s.free / s.n)}  hold ${pct(s.hold / s.n)}`);
      console.log(
        `  free spins 1 in ${s.freeN ? Math.round(s.n / s.freeN) : '∞'} (avg ${s.freeN ? (s.free / s.freeN).toFixed(1) : 0}×)` +
          `  hold&spin 1 in ${s.holdN ? Math.round(s.n / s.holdN) : '∞'} (avg ${s.holdN ? (s.hold / s.holdN).toFixed(1) : 0}×)`,
      );
      console.log(`  wins ≥10× 1 in ${Math.round(s.n / Math.max(1, s.b10))}  ≥100× 1 in ${Math.round(s.n / Math.max(1, s.b100))}  max ${s.max.toFixed(1)}× bet`);
    }
  }
}
