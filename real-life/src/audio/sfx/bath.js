// Bathroom plumbing: toilet flush, running tap, extractor fan. Water is built from Minnaert
// bubbles (short sine chirps whose pitch rises as the bubble surfaces) over band-passed rush.

import { oneShot, loopShot, buf, noise, pink, lp, hp, bp, peak, env, mix, modal, gen, wander, TAU } from '../dsp.js';

const G = { group: 'bath' };

/** One bubble: decaying sine starting at f0 and gliding up by `rise` (ratio per second). */
function bubble(x, sr, at, f0, amp, dec, rise = 1.5) {
  const o = Math.floor(at * sr);
  const n = Math.min(x.length - o, Math.floor(dec * 6 * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (TAU * f0 * (1 + rise * t)) / sr;
    x[o + i] += Math.sin(ph) * amp * Math.exp(-t / dec) * Math.min(1, t / 0.0008);
  }
}

oneShot('toilet.flush', (sr, r) => {
  // Lever clunk → roaring bowl swirl with gurgles → throat glugs → tank refill hiss.
  const D = 6.5;
  const x = buf(D, sr);
  modal(x, sr, [[1450, 0.25, 0.03], [2380, 0.15, 0.02], [610, 0.3, 0.05]], 0, 1, r); // lever
  modal(x, sr, [[320, 0.4, 0.06], [880, 0.15, 0.03]], 0.09, 1, r); // flapper thunk
  const rush = noise(Math.floor(4.2 * sr), r);
  const sw = wander(4.2, sr, 9, r);
  bp(rush, sr, (t) => 500 + 900 * Math.exp(-t / 1.6) + 300 * sw(t), 0.8);
  lp(rush, sr, 3200, 0.7);
  env(rush, sr, (t) => Math.min(1, (t / 0.18) ** 2) * (t < 1.8 ? 1 : Math.exp(-(t - 1.8) / 0.9)) * (0.75 + 0.25 * sw(t * 1.7)));
  mix(x, rush, sr, 0.12, 1.1);
  // Swirl gurgles and throat glugs as the bowl empties.
  for (let k = 0; k < 140; k++) {
    const t = 0.2 + r() * 2.6;
    bubble(x, sr, t, 250 + r() * 700, 0.05 + r() * 0.08, 0.012 + r() * 0.02, 2 + r() * 3);
  }
  for (let k = 0; k < 9; k++) {
    const t = 2.2 + k * 0.17 + r() * 0.08;
    bubble(x, sr, t, 90 + r() * 70, 0.35, 0.05 + r() * 0.03, 1.2);
  }
  // Refill: thin pressurised hiss with a faint valve whistle.
  const fill = noise(Math.floor(3.6 * sr), r);
  bp(fill, sr, 2600, 1.1);
  mix(fill, gen(3.6, sr, (t) => 0.06 * Math.sin(TAU * (1180 + 15 * Math.sin(TAU * 0.7 * t)) * t)), sr);
  env(fill, sr, (t) => Math.min(1, t / 0.6) * Math.max(0, 1 - Math.max(0, t - 2.4) / 1.2));
  mix(x, fill, sr, 2.8, 0.22);
  hp(x, sr, 60, 0.7);
  return x;
}, { db: -3, ...G });

loopShot('water.run', (sr, r) => {
  // Tap running into a sink: fluttering stream + a steady population of bubbles.
  const d = 5, xf = 0.8;
  const len = Math.floor((d + xf) * sr);
  const s = noise(len, r);
  bp(s, sr, 1900, 0.6);
  peak(s, sr, 650, 1, 5); // basin resonance
  const fl = wander(d + xf, sr, 23, r);
  env(s, sr, (t) => 0.55 + 0.45 * fl(t));
  const L = s, R = s.slice();
  for (let k = 0; k < 900; k++) {
    const t = r() * (d + xf - 0.05);
    const f = 900 + r() * r() * 3600;
    bubble(r() < 0.5 ? L : R, sr, t, f, 0.05 + r() * 0.09, 0.004 + r() * 0.01, 3 + r() * 6);
  }
  for (const x of [L, R]) hp(x, sr, 180, 0.7);
  return [L, R];
}, { db: -12, xf: 0.8, ...G });

loopShot('fan.hum', (sr, r) => {
  // Bathroom extractor: motor hum, blade-pass whoosh, duct air and a faint bearing whine.
  const d = 6, xf = 1;
  const len = Math.floor((d + xf) * sr);
  const air = pink(len, r);
  lp(air, sr, 900, 0.7);
  env(air, sr, (t) => 0.75 + 0.25 * Math.sin(TAU * 37 * t)); // blade pass (37 Hz)
  const w = wander(d + xf, sr, 0.5, r);
  const hum = gen(d + xf, sr, (t) => 0.32 * Math.sin(TAU * 100 * t) + 0.12 * Math.sin(TAU * 200 * t + 1) + 0.05 * Math.sin(TAU * 300 * t));
  const whine = gen(d + xf, sr, (t) => 0.018 * (0.6 + 0.4 * w(t)) * Math.sin(TAU * 1870 * t + 3 * Math.sin(TAU * 0.3 * t)));
  mix(air, hum, sr, 0, 1);
  mix(air, whine, sr, 0, 1);
  peak(air, sr, 420, 3, 4); // duct resonance
  hp(air, sr, 45, 0.7);
  return air;
}, { db: -12, xf: 1, ...G });
