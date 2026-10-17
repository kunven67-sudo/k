// UI sounds. The menus are a card table, so the UI speaks in felt, clay chips and card stock —
// tactile and quiet, never beepy. Everything is short (<0.4 s) and soft-edged so it can repeat
// rapidly (hovering down a list) without fatigue.

import { oneShot, buf, noise, pink, biquad, lp, bp, env, mix, modal, burst, gen, mtof, TAU } from '../dsp.js';

const G = { group: 'ui' };

oneShot('ui.hover', (sr, r) => {
  // A fingertip brushing felt + the faintest high tick.
  const x = buf(0.09, sr);
  const n = pink(Math.floor(0.06 * sr), r);
  bp(n, sr, 2600, 0.9);
  env(n, sr, (t) => Math.sin(Math.PI * Math.min(1, t / 0.06)));
  mix(x, n, sr, 0, 0.6);
  modal(x, sr, [[4200, 0.08, 0.01]], 0.004, 1, r);
  return x;
}, { db: -9, ...G });

oneShot('ui.click', (sr, r) => {
  // A single clay chip tapped down: crisp, short, satisfying.
  const x = buf(0.12, sr);
  mix(x, burst(sr, 0.005, 5000, 0.9, r), sr, 0, 0.7);
  modal(x, sr, [[3300, 0.35, 0.016], [5600, 0.2, 0.01], [1500, 0.12, 0.02]], 0, 1, r);
  mix(x, burst(sr, 0.015, 600, 0.8, r, 'lp'), sr, 0, 0.6);
  return x;
}, { db: -5, ...G });

oneShot('ui.back', (sr, r) => {
  // Chip slid back off the betting line: short reverse swish, lower click.
  const x = buf(0.2, sr);
  const n = noise(Math.floor(0.12 * sr), r);
  biquad(n, sr, 'bp', (t) => 3500 - t * 16000, 1.2);
  env(n, sr, (t) => Math.sin(Math.PI * Math.min(1, t / 0.12)) ** 2);
  mix(x, n, sr, 0, 0.6);
  modal(x, sr, [[2200, 0.3, 0.014], [3900, 0.15, 0.01]], 0.11, 1, r);
  return x;
}, { db: -6, ...G });

oneShot('ui.toggle', (sr, r) => {
  // Two-stage mechanical switch: tick-tock.
  const x = buf(0.12, sr);
  modal(x, sr, [[2800, 0.3, 0.008], [4700, 0.2, 0.006]], 0, 1, r);
  mix(x, burst(sr, 0.003, 6000, 1, r), sr, 0, 0.5);
  modal(x, sr, [[1900, 0.25, 0.012], [3300, 0.12, 0.008]], 0.035, 1, r);
  return x;
}, { db: -6, ...G });

oneShot('ui.slider', (sr, r) => {
  // One detent of a slider: a tiny ratchet tick (callers retrigger with rate jitter).
  const x = buf(0.04, sr);
  mix(x, burst(sr, 0.003, 3800, 1.5, r), sr, 0, 1);
  modal(x, sr, [[2500, 0.15, 0.006]], 0, 1, r);
  return x;
}, { db: -10, ...G });

oneShot('ui.chip-place', (sr, r) => {
  // Chip set on felt, then a neighbour chip settling against it.
  const x = buf(0.22, sr);
  mix(x, burst(sr, 0.02, 900, 0.7, r, 'lp'), sr, 0, 1);
  modal(x, sr, [[3100, 0.25, 0.018], [5300, 0.15, 0.01]], 0.001, 1, r);
  modal(x, sr, [[3400, 0.12, 0.012]], 0.035, 1, r);
  return x;
}, { db: -4, ...G });

oneShot('ui.card-flip', (sr, r) => {
  const x = buf(0.2, sr);
  mix(x, burst(sr, 0.01, 3600, 1.1, r), sr, 0, 0.6);
  const n = noise(Math.floor(0.07 * sr), r);
  biquad(n, sr, 'bp', (t) => 2000 + t * 40000, 1.4);
  env(n, sr, (t) => Math.sin(Math.PI * Math.min(1, t / 0.07)));
  mix(x, n, sr, 0.01, 0.35);
  mix(x, burst(sr, 0.02, 1500, 0.6, r, 'lp'), sr, 0.085, 0.8);
  return x;
}, { db: -5, ...G });

oneShot('ui.paper', (sr, r) => {
  // Page/menu sheet: crinkly broadband with granular crackle.
  const d = 0.28;
  const x = buf(d + 0.02, sr);
  const n = noise(Math.floor(d * sr), r);
  bp(n, sr, 3000, 0.6);
  let crackle = 0;
  env(n, sr, (t) => {
    if (r() < 0.004) crackle = 1;
    crackle *= 0.996;
    return Math.sin(Math.PI * (t / d)) * (0.3 + 0.7 * crackle);
  });
  mix(x, n, sr, 0, 1);
  return x;
}, { db: -7, ...G });

oneShot('ui.whoosh', (sr, r) => {
  // Panel transition: airy rising-then-falling band sweep with a soft low body.
  const d = 0.45;
  const x = buf(d, sr);
  const n = pink(x.length, r);
  biquad(n, sr, 'bp', (t) => 400 + 2600 * Math.sin(Math.PI * (t / d)), 0.9);
  env(n, sr, (t) => Math.sin(Math.PI * (t / d)) ** 2);
  mix(x, n, sr, 0, 1);
  return x;
}, { db: -8, ...G });

oneShot('ui.error', (sr, r) => {
  // Two low dull wood knocks (a dealer tapping "no") instead of a buzzer.
  const x = buf(0.3, sr);
  for (const t of [0, 0.11]) {
    mix(x, burst(sr, 0.02, 500, 0.8, r, 'lp'), sr, t, 1);
    modal(x, sr, [[310, 0.3, 0.05], [740, 0.15, 0.03], [1290, 0.06, 0.02]], t, t ? 0.8 : 1, r);
  }
  return x;
}, { db: -5, ...G });

oneShot('ui.confirm', (sr, r) => {
  // Chip click + a soft two-note vibraphone-like chime (perfect fifth up).
  const x = buf(0.9, sr);
  modal(x, sr, [[3300, 0.2, 0.014], [5600, 0.1, 0.01]], 0, 1, r);
  const chime = (f, at) => modal(x, sr, [[f, 0.3, 0.45], [f * 4, 0.05, 0.08], [f * 10, 0.02, 0.02]], at, 1, r);
  chime(mtof(79), 0.02);
  chime(mtof(86), 0.1);
  return x;
}, { db: -6, ...G });

oneShot('ui.type', (sr, r) => {
  // A soft key press (typing names/fields): plastic tick + bottom-out thock.
  const x = buf(0.08, sr);
  mix(x, burst(sr, 0.003, 4500, 1.2, r), sr, 0, 0.5);
  modal(x, sr, [[1800 + r() * 300, 0.2, 0.01], [3200, 0.08, 0.006]], 0.004, 1, r);
  const th = gen(0.03, sr, (t) => Math.sin(TAU * 210 * t) * Math.exp(-t * 160));
  mix(x, th, sr, 0.006, 0.4);
  return x;
}, { db: -9, ...G });
