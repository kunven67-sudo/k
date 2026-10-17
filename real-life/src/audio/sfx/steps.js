// Footsteps. Each surface gets 4 seeded variants (step.<surface>.1..4) plus step.<surface>
// (= variant 1) for callers that just want "a step". A footfall = heel strike, then the toe
// rolling down ~50-80 ms later, plus the surface's own texture (grit, crunch, ring, splash).
// Use playStep(surface, opts) from src/audio/index.js for random variant + ±8% rate jitter.

import { oneShot, buf, noise, pink, brown, biquad, lp, hp, bp, env, mix, modal, burst, gen, TAU } from '../dsp.js';

export const SURFACES = ['carpet', 'tile', 'wood', 'concrete', 'asphalt', 'gravel', 'metal', 'grass', 'snow', 'water'];

/** Low body thump of a shoe (lowpassed noise + a damped sine). */
function thump(x, sr, at, g, r, f = 120, cut = 400) {
  mix(x, burst(sr, 0.04, cut, 0.7, r, 'lp'), sr, at, g);
  mix(x, gen(0.08, sr, (t) => Math.sin(TAU * f * t) * Math.exp(-t * 45)), sr, at, g * 0.5);
}

/** Granular texture: `n` micro-impacts spread over `dur` with a decaying density. */
function grains(x, sr, at, dur, n, f, q, g, r, len = 0.004) {
  for (let k = 0; k < n; k++) {
    const t = at + Math.pow(r(), 1.6) * dur;
    mix(x, burst(sr, len, f * (0.7 + r() * 0.6), q, r), sr, t, g * (0.3 + r() * 0.7));
  }
}

/** Short shoe scuff (sole sliding a few millimetres). */
function scuff(x, sr, at, dur, f, g, r) {
  const n = noise(Math.floor(dur * sr), r);
  bp(n, sr, f, 0.8);
  env(n, sr, (t) => Math.sin(Math.PI * Math.min(1, t / dur)));
  mix(x, n, sr, at, g);
}

/** Air bubble (Minnaert resonance with rising pitch) — the core of water sounds. */
export function bubble(x, sr, at, f0, g, d = 0.03) {
  let ph = 0;
  const b = gen(d * 5, sr, (t) => {
    ph += (TAU * f0 * (1 + 8 * t)) / sr;
    return Math.sin(ph) * Math.exp(-t / d);
  });
  mix(x, b, sr, at, g);
}

const RECIPES = {
  carpet(x, sr, r, toe) {
    thump(x, sr, 0, 1, r, 90, 250);
    thump(x, sr, toe, 0.5, r, 110, 300);
    const n = pink(Math.floor(0.12 * sr), r); // pile brushing against the sole
    lp(n, sr, 1400);
    env(n, sr, (t) => Math.exp(-t * 25));
    mix(x, n, sr, 0.005, 0.25);
  },
  tile(x, sr, r, toe) {
    thump(x, sr, 0, 0.7, r, 140, 500);
    mix(x, burst(sr, 0.004, 3800, 1, r), sr, 0, 0.9); // hard heel click
    modal(x, sr, [[1250 + r() * 200, 0.12, 0.02], [2600 + r() * 300, 0.08, 0.012]], 0, 1, r);
    mix(x, burst(sr, 0.004, 3300, 1, r), sr, toe, 0.5);
    thump(x, sr, toe, 0.35, r, 150, 500);
  },
  wood(x, sr, r, toe) {
    thump(x, sr, 0, 1, r, 100, 350);
    const f = 170 + r() * 40; // board resonance (hollow subfloor)
    modal(x, sr, [[f, 0.35, 0.07], [f * 2.3, 0.18, 0.05], [f * 5.1, 0.06, 0.025]], 0, 1, r);
    mix(x, burst(sr, 0.005, 2400, 1, r), sr, 0, 0.35);
    thump(x, sr, toe, 0.5, r, 110, 400);
    modal(x, sr, [[f * 1.1, 0.15, 0.05]], toe, 1, r);
    if (r() < 0.35) { // occasional board creak
      let ph = 0;
      const c = gen(0.12, sr, (t) => {
        ph += (TAU * (420 + 120 * t)) / sr;
        return Math.sign(Math.sin(ph)) * Math.sin(Math.PI * (t / 0.12)) * (0.5 + 0.5 * Math.sin(TAU * 48 * t));
      });
      bp(c, sr, 900, 3);
      mix(x, c, sr, toe + 0.02, 0.06);
    }
  },
  concrete(x, sr, r, toe) {
    thump(x, sr, 0, 0.9, r, 120, 450);
    mix(x, burst(sr, 0.005, 2800, 0.9, r), sr, 0, 0.5);
    scuff(x, sr, 0.01, 0.05, 2600, 0.15, r);
    thump(x, sr, toe, 0.45, r, 130, 450);
    grains(x, sr, toe, 0.04, 6, 5000, 2, 0.08, r);
  },
  asphalt(x, sr, r, toe) {
    thump(x, sr, 0, 0.8, r, 110, 400);
    grains(x, sr, 0, 0.06, 14, 4500, 1.5, 0.14, r); // grit and loose aggregate
    scuff(x, sr, 0.015, 0.06, 3200, 0.12, r);
    thump(x, sr, toe, 0.4, r, 120, 400);
    grains(x, sr, toe, 0.05, 8, 5000, 1.5, 0.1, r);
  },
  gravel(x, sr, r, toe) {
    thump(x, sr, 0, 0.6, r, 90, 300);
    grains(x, sr, 0, 0.16, 70, 2600, 1.2, 0.3, r, 0.006); // stones shifting
    grains(x, sr, toe, 0.12, 45, 3200, 1.2, 0.22, r, 0.005);
  },
  metal(x, sr, r, toe) {
    thump(x, sr, 0, 0.6, r, 130, 400);
    const f = 290 + r() * 60; // grate / stair tread ring
    modal(x, sr, [[f, 0.25, 0.18], [f * 2.76, 0.18, 0.12], [f * 5.4, 0.1, 0.07], [f * 8.9, 0.05, 0.04]], 0, 1, r);
    mix(x, burst(sr, 0.004, 4000, 1, r), sr, 0, 0.4);
    modal(x, sr, [[f * 1.04, 0.12, 0.12], [f * 2.8, 0.08, 0.08]], toe, 1, r);
    thump(x, sr, toe, 0.3, r, 130, 400);
  },
  grass(x, sr, r, toe) {
    thump(x, sr, 0, 0.45, r, 80, 220);
    const n = noise(Math.floor(0.18 * sr), r); // blades swishing against the shoe
    bp(n, sr, 3800, 0.7);
    env(n, sr, (t) => Math.sin(Math.PI * Math.min(1, t / 0.18)) ** 2);
    mix(x, n, sr, 0, 0.3);
    grains(x, sr, 0.01, 0.12, 20, 2200, 1, 0.07, r, 0.008); // small twigs and thatch
    thump(x, sr, toe, 0.25, r, 90, 220);
  },
  snow(x, sr, r, toe) {
    thump(x, sr, 0, 0.5, r, 80, 250);
    // Compacting snow: dense squeaky crunch, band-limited around 1.5-3 kHz.
    const d = 0.2;
    const n = noise(Math.floor(d * sr), r);
    let g = 0;
    env(n, sr, (t) => {
      if (r() < 0.02) g = 0.4 + r() * 0.6;
      g *= 0.985;
      return g * Math.sin(Math.PI * Math.min(1, t / d));
    });
    bp(n, sr, 2000, 0.9);
    mix(x, n, sr, 0.005, 0.8);
  },
  water(x, sr, r, toe) {
    thump(x, sr, 0, 0.35, r, 70, 200);
    const n = noise(Math.floor(0.25 * sr), r); // splash spray
    bp(n, sr, 1800, 0.6);
    env(n, sr, (t) => Math.exp(-t * 18));
    mix(x, n, sr, 0, 0.5);
    for (let k = 0; k < 7; k++) bubble(x, sr, 0.01 + r() * 0.15, 500 + r() * 1300, 0.12 + r() * 0.12, 0.02 + r() * 0.03);
    const d = brown(Math.floor(0.2 * sr), r); // water pushed aside
    lp(d, sr, 600);
    env(d, sr, (t) => Math.exp(-t * 14));
    mix(x, d, sr, toe, 0.3);
  },
};

for (const s of SURFACES) {
  for (let v = 1; v <= 4; v++) {
    const render = (sr, r) => {
      const x = buf(0.42, sr);
      RECIPES[s](x, sr, r, 0.045 + r() * 0.035);
      hp(x, sr, 40); // no sub rumble buildup in the walk loop
      return x;
    };
    // Variant 1 normalises a little hotter; the rest vary ±1.5 dB for a natural gait.
    const db = -3 - (v - 1) * 0.5;
    oneShot(`step.${s}.${v}`, render, { db, seed: 1000 * v + s.length * 17 + s.charCodeAt(0), group: 'step' });
    if (v === 1) oneShot(`step.${s}`, render, { db, seed: 1000 + s.length * 17 + s.charCodeAt(0), group: 'step' });
  }
}
