// Body sounds (source-filter voice synthesis) and personal foley (clothes, pockets, keys).
//
// Voice model: a glottal pulse train with jitter/shimmer → three time-varying formant
// bandpasses (vowel shape) + aspiration noise. Enough to read as a human yawn/groan/burp
// without any recordings.

import { oneShot, loopShot, buf, noise, pink, brown, biquad, lp, hp, bp, peak, env, mix, modal, burst, gen, wander, TAU } from '../dsp.js';

const G = { group: 'body' };

/**
 * Render a voiced gesture. f0(t) Hz, form(t) → [F1, F2, F3] Hz, amp(t) 0..1, breath 0..1,
 * rough 0..1 (pulse jitter for creak/burps).
 */
export function voice(sr, dur, { f0, form, amp, breath = 0.2, rough = 0.05, r }) {
  const n = Math.floor(dur * sr);
  const src = new Float32Array(n);
  const ampv = new Float32Array(n);
  // Control-rate evaluation (every 16 samples, linearly interpolated) keeps this fast enough
  // for crowds of talkers while staying smooth.
  const K = 16;
  let ph = 0, jit = 0, fA = f0(0), fB = fA, aA = amp(0), aB = aA;
  for (let i = 0; i < n; i++) {
    const k = i % K;
    if (k === 0) {
      fA = fB; aA = aB;
      const tn = Math.min(i + K, n - 1) / sr;
      fB = f0(tn); aB = amp(tn);
      if (i === 0) { fA = f0(0); aA = amp(0); }
    }
    const u = k / K;
    ph += ((fA + (fB - fA) * u) * (1 + jit)) / sr;
    ampv[i] = aA + (aB - aA) * u;
    if (ph >= 1) {
      ph -= 1;
      jit = (r() - 0.5) * rough; // per-period pitch jitter
    }
    // Rosenberg-ish glottal pulse: smooth opening, sharp closure (rich, voice-like spectrum).
    const g = ph < 0.6 ? 0.5 - 0.5 * Math.cos(Math.PI * (ph / 0.6)) : Math.cos((Math.PI / 2) * ((ph - 0.6) / 0.4));
    src[i] = g - 0.4 + (r() * 2 - 1) * breath;
  }
  const out = new Float32Array(n);
  const gains = [1, 0.6, 0.3];
  for (let k = 0; k < 3; k++) {
    const c = src.slice();
    biquad(c, sr, 'bp', (t) => form(t)[k], 5 + k * 2);
    for (let i = 0; i < n; i++) out[i] += c[i] * gains[k];
  }
  for (let i = 0; i < n; i++) out[i] *= ampv[i];
  return out;
}

const lerp = (a, b, p) => a + (b - a) * Math.min(1, Math.max(0, p));
const vowelMix = (A, B, p) => [lerp(A[0], B[0], p), lerp(A[1], B[1], p), lerp(A[2], B[2], p)];
const V = { a: [750, 1150, 2500], o: [500, 850, 2400], u: [320, 800, 2300], e: [450, 1700, 2500], m: [280, 900, 2200], uh: [600, 1200, 2450] };

oneShot('body.yawn', (sr, r) => {
  const d = 2.4;
  const x = voice(sr, d, {
    r, breath: 0.35, rough: 0.04,
    f0: (t) => 115 + 120 * Math.sin(Math.PI * Math.min(1, t / 1.6)) ** 2 * (t < 1.6 ? 1 : 0) + (t > 1.6 ? -20 * (t - 1.6) : 0),
    form: (t) => (t < 0.4 ? vowelMix(V.uh, V.a, t / 0.4) : t < 1.5 ? V.a : vowelMix(V.a, V.m, (t - 1.5) / 0.6)),
    amp: (t) => Math.min(1, t / 0.35) * (t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 0.8)) * (0.8 + 0.2 * Math.sin(TAU * 3 * t)),
  });
  const air = noise(Math.floor(0.9 * sr), r); // the big inhale at the start
  bp(air, sr, 1200, 0.8);
  env(air, sr, (t) => Math.sin(Math.PI * (t / 0.9)) * 0.4);
  mix(x, air, sr, 0, 0.35);
  return x;
}, G);

oneShot('body.groan', (sr, r) => {
  const d = 1.3;
  return voice(sr, d, {
    r, breath: 0.15, rough: 0.25, // creaky voice
    f0: (t) => 105 - 30 * (t / d),
    form: (t) => vowelMix(V.uh, V.u, t / d),
    amp: (t) => Math.min(1, t / 0.15) * Math.max(0, 1 - Math.max(0, t - 0.8) / 0.5),
  });
}, G);

oneShot('body.burp', (sr, r) => {
  const d = 0.75;
  const x = voice(sr, d, {
    r, breath: 0.1, rough: 0.6, // esophageal: very irregular
    f0: (t) => 78 + 18 * Math.sin(TAU * 5 * t) - 20 * t,
    form: (t) => vowelMix(V.o, V.uh, t / d),
    amp: (t) => Math.min(1, t / 0.03) * Math.exp(-Math.max(0, t - 0.25) * 5) * (0.7 + 0.3 * Math.sin(TAU * 11 * t)),
  });
  lp(x, sr, 2200);
  return x;
}, G);

oneShot('body.hiccup', (sr, r) => {
  // Diaphragm spasm: sharp gasp + glottis snapping shut ("hic").
  const x = buf(0.35, sr);
  const gasp = noise(Math.floor(0.08 * sr), r);
  bp(gasp, sr, 1600, 1.5);
  env(gasp, sr, (t) => Math.exp(-t * 35));
  mix(x, gasp, sr, 0, 0.6);
  const v = voice(sr, 0.11, {
    r, breath: 0.25, rough: 0.05,
    f0: (t) => 290 - 300 * t, form: () => V.e,
    amp: (t) => Math.min(1, t / 0.005) * Math.exp(-t * 28),
  });
  mix(x, v, sr, 0.008, 1);
  mix(x, burst(sr, 0.004, 900, 1, r), sr, 0.1, 0.8); // glottal stop click
  return x;
}, G);

oneShot('body.stomach', (sr, r) => {
  // Borborygmus: a wandering low growl with squelchy formant + gas bubbles.
  const d = 1.9;
  const w = wander(d, sr, 4, r);
  const x = voice(sr, d, {
    r, breath: 0.05, rough: 0.5,
    f0: (t) => 45 + 140 * w(t),
    form: (t) => [260 + 300 * w(t * 1.3), 700 + 300 * w(t * 0.7 + 3), 1600],
    amp: (t) => Math.sin(Math.PI * (t / d)) ** 0.6 * (0.4 + 0.6 * w(t * 2 + 1)),
  });
  lp(x, sr, 900);
  for (let k = 0; k < 8; k++) {
    const t0 = 0.2 + r() * 1.5, f = 180 + r() * 300;
    mix(x, gen(0.12, sr, (t) => Math.sin(TAU * f * (1 + 4 * t) * t) * Math.exp(-t / 0.03)), sr, t0, 0.25);
  }
  return x;
}, G);

oneShot('body.breath-heavy', (sr, r) => {
  // Two winded breath cycles (inhale shorter/brighter, exhale longer/darker, mouth open).
  const x = buf(2.0, sr);
  let t = 0;
  for (let k = 0; k < 2; k++) {
    const inh = noise(Math.floor(0.38 * sr), r);
    bp(inh, sr, 1700, 1.2);
    env(inh, sr, (s) => Math.sin(Math.PI * (s / 0.38)) ** 1.5);
    mix(x, inh, sr, t, 0.55);
    const ex = noise(Math.floor(0.55 * sr), r);
    bp(ex, sr, 900, 0.9);
    peak(ex, sr, 1250, 3, 8);
    env(ex, sr, (s) => Math.min(1, s / 0.05) * Math.exp(-s * 3.2));
    mix(x, ex, sr, t + 0.4, 0.8);
    t += 1.0;
  }
  return x;
}, G);

loopShot('body.heartbeat', (sr, r) => {
  // 75 bpm lub-dub, 4 beats = exactly 3.2 s loop; felt more than heard (sub-heavy).
  const beat = 0.8, d = beat * 4, xf = 0.05;
  const x = buf(d + xf, sr);
  const thud = (at, f, g, len) => {
    mix(x, gen(len * 5, sr, (t) => Math.sin(TAU * f * (1 - 0.3 * t) * t) * Math.min(1, t / 0.006) * Math.exp(-t / len)), sr, at, g);
    mix(x, burst(sr, 0.03, 150, 0.7, r, 'lp'), sr, at, g * 0.4);
  };
  for (let b = 0; b < 5; b++) {
    thud(b * beat, 52, 1, 0.045); // lub (AV valves)
    thud(b * beat + 0.28, 68, 0.6, 0.03); // dub (semilunar valves)
  }
  return x;
}, { db: -6, xf: 0.05, ...G });

// ---------- personal foley ----------

/** Crinkly fabric noise with stochastic micro-folds. */
function fabric(sr, dur, f, density, r) {
  const n = noise(Math.floor(dur * sr), r);
  bp(n, sr, f, 0.7);
  let g = 0;
  return env(n, sr, (t) => {
    if (r() < density) g = 0.3 + r() * 0.7;
    g *= 0.997;
    return g * Math.sin(Math.PI * Math.min(1, t / dur)) ** 0.5;
  });
}

oneShot('cloth.rustle', (sr, r) => {
  const x = buf(0.6, sr);
  mix(x, fabric(sr, 0.55, 2400, 0.004, r), sr, 0, 1);
  mix(x, fabric(sr, 0.4, 900, 0.002, r), sr, 0.08, 0.6);
  return x;
}, { group: 'foley' });

oneShot('pocket.pat', (sr, r) => {
  // Palm patting jeans pockets twice (thumps + denim brush), maybe something inside.
  const x = buf(0.75, sr);
  for (const [t, g] of [[0, 1], [0.24, 0.85], [0.46, 0.7]]) {
    mix(x, burst(sr, 0.04, 320, 0.7, r, 'lp'), sr, t, g * 1.2);
    mix(x, fabric(sr, 0.08, 1800, 0.01, r), sr, t, g * 0.4);
  }
  return x;
}, { group: 'foley' });

/** A small key/ring: high inharmonic modes, bright and short. */
function keyHit(x, sr, at, g, r) {
  const f = 2600 + r() * 2600;
  modal(x, sr, [[f, 0.25, 0.09], [f * 1.53, 0.18, 0.07], [f * 2.31, 0.12, 0.05], [f * 3.4, 0.08, 0.03]], at, g, r);
  mix(x, burst(sr, 0.002, 8000, 1, r), sr, at, g * 0.3);
}

oneShot('keys.jingle', (sr, r) => {
  const x = buf(0.9, sr);
  for (let k = 0; k < 26; k++) {
    const t = Math.pow(r(), 1.3) * 0.6;
    keyHit(x, sr, t, (0.4 + r() * 0.6) * (1 - t), r);
  }
  return x;
}, { group: 'foley' });

oneShot('wallet.open', (sr, r) => {
  // Leather bifold: press-stud snap, leather creak as it unfolds, bills shifting.
  const x = buf(0.8, sr);
  mix(x, burst(sr, 0.004, 3500, 1.2, r), sr, 0, 0.9);
  modal(x, sr, [[2100, 0.2, 0.02], [4300, 0.1, 0.01]], 0, 1, r);
  const cr = new Float32Array(Math.floor(0.35 * sr)); // leather stick-slip
  let ph = 0;
  for (let i = 0; i < cr.length; i++) {
    ph += (40 + 60 * (i / cr.length)) / sr;
    if (ph >= 1) { ph -= 1 + (r() - 0.5) * 0.3; cr[i] = 1; }
  }
  bp(cr, sr, 700, 3);
  env(cr, sr, (t) => Math.sin(Math.PI * (t / 0.35)));
  mix(x, cr, sr, 0.06, 1.6);
  mix(x, fabric(sr, 0.25, 3200, 0.008, r), sr, 0.3, 0.35);
  return x;
}, { group: 'foley' });

oneShot('bag.zip', (sr, r) => {
  // Zipper: slider clicking over teeth at an accelerating-then-slowing rate.
  const d = 0.6;
  const x = buf(d + 0.05, sr);
  let ph = 0;
  const z = gen(d, sr, (t) => {
    ph += (180 + 260 * Math.sin(Math.PI * (t / d))) / sr;
    if (ph >= 1) { ph -= 1; return 1; }
    return 0;
  });
  const zz = z.slice();
  bp(z, sr, 3200, 2);
  bp(zz, sr, 1400, 2);
  for (let i = 0; i < z.length; i++) z[i] = (z[i] + zz[i] * 0.7) * Math.sin(Math.PI * Math.min(1, i / z.length)) ** 0.4;
  mix(x, z, sr, 0, 3);
  mix(x, fabric(sr, d, 2000, 0.003, r), sr, 0, 0.2);
  return x;
}, { group: 'foley' });
