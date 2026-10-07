// Downtown Reno at night: traffic swells, distant sirens, wind between buildings, neon
// transformers humming, Union Pacific horns, cars passing and honking.

import { loopShot, oneShot, buf, noise, pink, brown, biquad, lp, hp, bp, peak, env, mix, modal, burst, gen, wander, verb, upsample, TAU } from '../dsp.js';

const G = { group: 'city' };

/** Engine/tyre sound of one passing vehicle. dur = pass length, returns mono. */
function vehicle(srOut, dur, r, { rpm = 30, bright = 1, down = 1 } = {}) {
  // Distant vehicles are rendered at srOut/down (they carry little above 3 kHz) for speed.
  const sr = Math.round(srOut / down);
  const x = buf(dur, sr);
  const mid = dur * (0.4 + r() * 0.2);
  const prox = (t) => 1 / (1 + ((t - mid) / (dur * 0.18)) ** 2); // inverse-square-ish swell
  const tyre = pink(x.length, r);
  biquad(tyre, sr, 'bp', (t) => 500 + 900 * prox(t) * bright, 0.6);
  mix(x, tyre, sr, 0, 1);
  let ph = 0;
  const eng = gen(dur, sr, (t) => {
    const dop = 1 + 0.06 * Math.tanh((mid - t) * 3); // Doppler: higher approaching, lower leaving
    ph += (TAU * rpm * dop) / sr;
    return Math.sin(ph) * 0.6 + Math.sin(ph * 2 + 0.5) * 0.4 + Math.sin(ph * 3) * 0.2;
  });
  lp(eng, sr, 400);
  mix(x, eng, sr, 0, 0.5);
  env(x, sr, (t) => prox(t) * Math.min(1, t / 0.3) * Math.min(1, (dur - t) / 0.3));
  if (down === 1) return x;
  const y = upsample(x, down);
  return lp(y, srOut, sr * 0.4);
}

/** Distant two-tone/wail siren with room. Returns mono. */
function siren(sr, dur, r, gain = 1) {
  let ph = 0;
  const x = gen(dur, sr, (t) => {
    const f = 700 + 450 * (0.5 - 0.5 * Math.cos(TAU * 0.28 * t)); // slow wail
    ph += (TAU * f) / sr;
    const s = Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph);
    return s * Math.sin(Math.PI * (t / dur)) ** 1.5 * gain;
  });
  lp(x, sr, 1800);
  const w = verb(x, sr, 0.9, 0.6);
  mix(x, w, sr, 0, 1.2);
  return x;
}

/** Traffic bed (one channel): rumble + random vehicle passes. */
function trafficLayer(sr, T, r, density = 1) {
  const x = brown(Math.floor(T * sr), r);
  lp(x, sr, 220);
  const w = wander(T, sr, 0.12, r);
  env(x, sr, (t) => 0.4 + 0.6 * w(t));
  const n = Math.round(T * 0.6 * density);
  for (let k = 0; k < n; k++) {
    const d = 3 + r() * 4;
    mix(x, vehicle(sr, d, r, { rpm: 22 + r() * 25, bright: 0.6 + r() * 0.6, down: 4 }), sr, r() * (T - d * 0.5) - d * 0.3, 0.25 + r() * 0.35);
  }
  return x;
}

loopShot('amb.traffic', (sr, r) => {
  const T = 12 + 1.5;
  return [trafficLayer(sr, T, r, 1.2), trafficLayer(sr, T, r, 1.2)];
}, { db: -12, xf: 1.5, ...G, group: 'amb' });

loopShot('amb.city', (sr, r) => {
  // Traffic swells + one distant siren + gusts between the casinos + far crowd bustle.
  const T = 14 + 1.5;
  const L = trafficLayer(sr, T, r, 0.8), R = trafficLayer(sr, T, r, 0.8);
  for (const x of [L, R]) {
    const wind = noise(x.length, r);
    const w = wander(T, sr, 0.2, r);
    biquad(wind, sr, 'bp', (t) => 350 + 500 * w(t), 0.9);
    env(wind, sr, (t) => 0.05 + 0.2 * w(t) ** 2);
    mix(x, wind, sr, 0, 1);
  }
  const s = siren(sr, 8, r, 0.12);
  mix(L, s, sr, 3, 0.7);
  mix(R, s, sr, 3.02, 1);
  return [L, R];
}, { db: -12, xf: 1.5, ...G, group: 'amb' });

loopShot('neon.buzz', (sr, r) => {
  // Neon transformer: 120 Hz magnetostriction buzz rich in odd/even harmonics + HV sizzle.
  const d = 2, xf = 0.25;
  const x = gen(d + xf, sr, (t) => {
    let v = 0;
    for (let h = 1; h <= 9; h++) v += Math.sin(TAU * 120 * h * t + h * 0.7) / (h ** 1.2);
    return Math.tanh(v * 1.5);
  });
  const sizzle = noise(x.length, r);
  bp(sizzle, sr, 6000, 0.8);
  env(sizzle, sr, (t) => 0.5 + 0.5 * Math.abs(Math.sin(TAU * 60 * t)));
  mix(x, sizzle, sr, 0, 0.08);
  return x;
}, { db: -14, xf: 0.25, ...G, group: 'neon' });

oneShot('neon.flicker', (sr, r) => {
  // A tube struggling to strike: crackly arcing pops, buzz stutter, then it catches.
  const d = 1.2;
  const x = buf(d, sr);
  let on = false;
  const b = gen(d, sr, (t) => {
    if (t < 0.9 && r() < 0.0012) on = !on;
    const lit = t > 0.9 || on;
    return lit ? Math.tanh(2 * (Math.sin(TAU * 120 * t) + 0.5 * Math.sin(TAU * 240 * t + 1))) * 0.4 : 0;
  });
  mix(x, b, sr, 0, 1);
  for (let k = 0; k < 9; k++) mix(x, burst(sr, 0.004, 3000 + r() * 4000, 0.8, r), sr, r() * 0.9, 0.6 + r() * 0.4);
  mix(x, burst(sr, 0.01, 1500, 0.7, r), sr, 0.9, 1);
  return x;
}, { ...G, group: 'neon' });

oneShot('train.horn', (sr, r) => {
  // Five-chime freight horn chord (a nostalgic minor-ish voicing), long-long-short-long, far off.
  const notes = [311, 370, 415, 494, 622];
  const pattern = [[0, 1.4], [1.7, 1.4], [3.4, 0.5], [4.1, 2.0]];
  const d = 7.5;
  const x = buf(d, sr);
  for (const [at, len] of pattern) {
    const tone = gen(len, sr, (t) => {
      let v = 0;
      for (const f of notes) {
        const ph = TAU * f * t + Math.sin(TAU * 4 * t) * 0.3;
        v += Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph);
      }
      return Math.tanh(v * 0.35) * Math.min(1, t / 0.08) * Math.min(1, (len - t) / 0.15);
    });
    mix(x, tone, sr, at, 1);
  }
  lp(x, sr, 2200);
  const w = verb(x, sr, 0.95, 0.65); // echoing between buildings
  mix(x, w, sr, 0, 1.4);
  return x;
}, G);

oneShot('siren.distant', (sr, r) => siren(sr, 7, r), G);

oneShot('car.pass', (sr, r) => {
  const d = 4;
  const L = vehicle(sr, d, r, { rpm: 34, bright: 1.2 });
  const R = new Float32Array(L.length);
  // Pan left → right as it passes.
  for (let i = 0; i < L.length; i++) {
    const p = Math.min(1, Math.max(0, (i / sr - d * 0.3) / (d * 0.4)));
    R[i] = L[i] * Math.sin(p * Math.PI * 0.5);
    L[i] *= Math.cos(p * Math.PI * 0.5);
  }
  return [L, R];
}, G);

oneShot('car.horn', (sr, r) => {
  // Dual-tone electromagnetic horn (~400 + 500 Hz), buzzy diaphragm, two honks.
  const x = buf(1.2, sr);
  for (const [at, len] of [[0, 0.22], [0.32, 0.5]]) {
    const h = gen(len, sr, (t) => {
      const a = (Math.sin(TAU * 405 * t) > 0 ? 1 : -1) * 0.5 + (Math.sin(TAU * 498 * t) > 0 ? 1 : -1) * 0.5;
      return a * Math.min(1, t / 0.01) * Math.min(1, (len - t) / 0.02);
    });
    bp(h, sr, 1400, 0.8);
    peak(h, sr, 2600, 2, 6);
    mix(x, h, sr, at, 1);
  }
  return x;
}, G);
