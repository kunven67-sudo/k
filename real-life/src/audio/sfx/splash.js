// Boot splash + logo stingers. These are the first things anyone hears, so they are
// cinematic: stereo, big baked-in space, a sub layer for weight, and a musical tail.

import { oneShot, buf, noise, pink, biquad, lp, hp, bp, env, mix, modal, burst, gen, verb, mtof, TAU } from '../dsp.js';
import { diceHit, coinHit, bell, snap, swish } from './casino.js';

const G = { group: 'splash' };

/** Stereo-ise a mono dry signal with a wide reverb (different L/R pre-delays). */
function space(dry, sr, size = 0.85, wet = 0.6) {
  const w = verb(dry, sr, size, 0.45);
  const L = dry.slice(), R = dry.slice();
  mix(L, w, sr, 0.0, wet);
  mix(R, w, sr, 0.017, wet);
  return [L, R];
}

/** Sub-bass drop: a sine sweeping down, the "weight" of a cinematic hit. */
function sub(x, sr, at, g, f0 = 90, f1 = 38, len = 1.2) {
  let ph = 0;
  mix(x, gen(len, sr, (t) => {
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t * 6))) / sr;
    return Math.sin(ph) * Math.min(1, t / 0.004) * Math.exp(-t / (len * 0.35));
  }), sr, at, g);
}

/** Reverse-swell whoosh into an impact. */
function riser(x, sr, at, dur, g, r) {
  const n = pink(Math.floor(dur * sr), r);
  biquad(n, sr, 'bp', (t) => 300 + 3500 * (t / dur) ** 2, 1.1);
  env(n, sr, (t) => (t / dur) ** 2.5);
  mix(x, n, sr, at, g);
}

oneShot('splash.dice-roll', (sr, r) => {
  // Two dice tumbling across felt in near-slow-motion, each bounce blooming in the room.
  const x = buf(2.6, sr);
  riser(x, sr, 0, 0.35, 0.5, r);
  let t = 0.3;
  for (let k = 0; k < 9; k++) {
    diceHit(x, sr, t, 1 - k * 0.07, r, k % 3 === 0 ? 0.7 : 0.2);
    diceHit(x, sr, t + 0.025 + r() * 0.02, 0.8 - k * 0.07, r, 0.2);
    t += 0.17 + k * 0.02 + r() * 0.03;
  }
  return space(x, sr, 0.7, 0.45);
}, { ...G, db: -3 });

oneShot('splash.dice-land', (sr, r) => {
  // The final landing: a hard clack, a deep boom and a long dark tail.
  const x = buf(3.2, sr);
  diceHit(x, sr, 0, 1.3, r, 1);
  diceHit(x, sr, 0.012, 1, r, 1);
  sub(x, sr, 0, 1.4, 110, 36, 1.8);
  mix(x, burst(sr, 0.12, 180, 0.7, r, 'lp'), sr, 0, 1.4);
  const [L, R] = space(x, sr, 0.95, 0.7);
  return [L, R];
}, { ...G, db: -1.5 });

oneShot('logo.neon-on', (sr, r) => {
  // Neon sign striking: stuttering arcs, then the buzz settles and a warm Maj9 swell rises.
  const d = 3.5;
  const x = buf(d, sr);
  const flick = [0, 0.09, 0.15, 0.31, 0.36, 0.55];
  flick.forEach((t, k) => {
    mix(x, burst(sr, 0.006, 3500, 0.8, r), sr, t, 0.8);
    const on = k === flick.length - 1 ? d - t : 0.03 + r() * 0.04;
    mix(x, gen(on, sr, (s) => Math.tanh(2 * Math.sin(TAU * 120 * s) + Math.sin(TAU * 240 * s)) *
      0.25 * Math.min(1, (on - s) / 0.02) * (k === flick.length - 1 ? Math.exp(-s * 1.2) * 0.7 + 0.1 : 1)), sr, t, 1);
  });
  // Pad: Dbmaj9 (Db F Ab C Eb), slow attack, gently detuned saws filtered warm.
  const chord = [49, 56, 60, 63, 65].map(mtof);
  const pad = gen(d - 0.55, sr, (t) => {
    let v = 0;
    for (const f of chord) for (const det of [-0.004, 0.004]) v += ((f * (1 + det) * t) % 1) * 2 - 1;
    return v * 0.08 * Math.min(1, t / 1.2) * Math.min(1, (d - 0.55 - t) / 0.8);
  });
  lp(pad, sr, 1600);
  mix(x, pad, sr, 0.55, 1);
  sub(x, sr, 0.55, 0.5, 70, 45, 1.5);
  return space(x, sr, 0.8, 0.5);
}, G);

oneShot('logo.coins', (sr, r) => {
  // A shower of coins onto a hard surface, with a high bell shimmer on top.
  const x = buf(3.2, sr);
  for (let k = 0; k < 140; k++) {
    const t = 0.05 + Math.pow(r(), 1.5) * 2.0;
    coinHit(x, sr, t, (0.2 + r() * 0.4) * (1 - t / 2.4), r, 0.8);
  }
  [84, 88, 91, 96].forEach((m, k) => bell(x, sr, k * 0.06, mtof(m), 0.3, r, 1.4));
  sub(x, sr, 0, 0.6, 80, 45, 0.8);
  return space(x, sr, 0.75, 0.4);
}, G);

oneShot('logo.cards', (sr, r) => {
  // A deck fanned across the table in one sweep, then the top card snapped face-up.
  const x = buf(2.4, sr);
  swish(x, sr, 0, 0.6, 0.6, r, 600, 3500);
  for (let k = 0; k < 34; k++) snap(x, sr, 0.05 + k * 0.016 + r() * 0.003, 0.25 + 0.2 * Math.sin((k / 34) * Math.PI), r, 2600 + r() * 2000, 0.007);
  snap(x, sr, 0.9, 1, r, 3000, 0.015);
  mix(x, burst(sr, 0.04, 900, 0.6, r, 'lp'), sr, 0.9, 1);
  sub(x, sr, 0.9, 0.4, 90, 50, 0.6);
  return space(x, sr, 0.7, 0.4);
}, G);

oneShot('logo.reels', (sr, r) => {
  // Three reels spin up, then stop one after another — thunk, thunk, THUNK — and a ding.
  const x = buf(3.4, sr);
  let ph = 0;
  mix(x, gen(1.6, sr, (t) => {
    ph += (TAU * (100 + 120 * Math.min(1, t / 0.4))) / sr;
    return Math.sin(ph) * 0.15 * Math.min(1, t / 0.2) * Math.min(1, (1.6 - t) / 0.1);
  }), sr, 0, 1);
  for (let t = 0; t < 1.6; t += 1 / (12 + 10 * Math.min(1, t / 0.4))) mix(x, burst(sr, 0.007, 2400, 1.4, r), sr, t, 0.3);
  [0.9, 1.25, 1.6].forEach((t, k) => {
    mix(x, burst(sr, 0.05, 240, 0.8, r, 'lp'), sr, t, 1.2 + k * 0.3);
    modal(x, sr, [[300, 0.3, 0.07], [760, 0.15, 0.05], [1600, 0.07, 0.03]], t, 1 + k * 0.2, r);
    if (k === 2) sub(x, sr, t, 0.6, 85, 45, 0.8);
  });
  bell(x, sr, 1.75, mtof(88), 0.7, r, 1.5);
  bell(x, sr, 1.75, mtof(95), 0.35, r, 1.5);
  return space(x, sr, 0.75, 0.4);
}, G);
