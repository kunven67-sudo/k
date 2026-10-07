// Doors and locks. The reference door is a cheap hollow-core motel door in a loose frame:
// low boomy panel modes (~90-400 Hz), a rattling latch, a squeaky hinge, a brass deadbolt.

import { oneShot, buf, noise, pink, biquad, lp, hp, bp, env, mix, modal, burst, gen, verb, TAU } from '../dsp.js';

/** Hollow door panel struck at `at`: membrane-like modes + frame rattle. */
function panelHit(x, sr, at, g, r, { soft = 0, rattle = 0.3 } = {}) {
  const f = 88 + r() * 10;
  mix(x, burst(sr, 0.05 + soft * 0.03, 600 - soft * 300, 0.7, r, 'lp'), sr, at, g * 1.2);
  modal(x, sr, [
    [f, 0.6, 0.16], [f * 1.97, 0.4, 0.11], [f * 2.9, 0.3, 0.08], [f * 4.6, 0.18, 0.05],
    [f * 7.3, 0.1 * (1 - soft), 0.03], [f * 11.8, 0.06 * (1 - soft), 0.02],
  ], at, g, r);
  if (rattle > 0) latchRattle(x, sr, at + 0.01, g * rattle, r);
}

/** Loose latch/hinge pins rattling in the frame after an impact. */
function latchRattle(x, sr, at, g, r) {
  let t = at, gap = 0.018;
  for (let k = 0; k < 7; k++) {
    mix(x, burst(sr, 0.003, 3200 + r() * 1500, 1.5, r), sr, t, g * (1 - k / 8));
    modal(x, sr, [[1900 + r() * 400, 0.1, 0.02]], t, g * (1 - k / 8), r);
    t += gap * (0.6 + r() * 0.8);
  }
}

/** Metal latch tongue click (spring bolt snapping into the strike plate). */
function latch(x, sr, at, g, r, pitch = 1) {
  mix(x, burst(sr, 0.004, 4200, 1.2, r), sr, at, g);
  modal(x, sr, [[1750 * pitch, 0.3, 0.035], [3900 * pitch, 0.2, 0.02], [6100 * pitch, 0.1, 0.012]], at, g, r);
}

/** Hinge creak: stick-slip friction (irregular pulse train) through squeaky formants. */
function creak(x, sr, at, dur, g, r, f0 = 70, f1 = 160) {
  const n = Math.floor(dur * sr);
  const c = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const p = t / dur;
    const f = f0 + (f1 - f0) * Math.sin(p * Math.PI * 0.8) + 15 * Math.sin(TAU * 3 * t);
    ph += f / sr;
    if (ph >= 1) {
      ph -= 1 + (r() - 0.5) * 0.15; // jitter = stick-slip irregularity
      c[i] = 1;
    }
  }
  const a = c.slice(), b = c.slice(), d = c.slice();
  bp(a, sr, 1100, 9);
  bp(b, sr, 2300, 11);
  bp(d, sr, 650, 6);
  for (let i = 0; i < n; i++) c[i] = (a[i] + b[i] * 0.7 + d[i] * 0.5) * Math.sin(Math.PI * Math.min(1, i / n)) ** 0.7;
  mix(x, c, sr, at, g * 3);
}

/** Air moved by the door swing. */
function swingAir(x, sr, at, dur, g, r) {
  const n = pink(Math.floor(dur * sr), r);
  lp(n, sr, 500);
  env(n, sr, (t) => Math.sin(Math.PI * Math.min(1, t / dur)));
  mix(x, n, sr, at, g);
}

oneShot('door.open', (sr, r) => {
  const x = buf(1.2, sr);
  mix(x, burst(sr, 0.03, 1200, 1, r), sr, 0, 0.3); // handle turning
  latch(x, sr, 0.09, 0.6, r, 0.9); // latch pulls back
  panelHit(x, sr, 0.1, 0.12, r, { soft: 1, rattle: 0.1 });
  creak(x, sr, 0.18, 0.75, 0.25, r, 60, 140);
  swingAir(x, sr, 0.15, 0.8, 0.5, r);
  return x;
}, { group: 'door' });

oneShot('door.close', (sr, r) => {
  const x = buf(0.9, sr);
  swingAir(x, sr, 0, 0.3, 0.6, r);
  panelHit(x, sr, 0.28, 0.75, r, { soft: 0.4, rattle: 0.35 });
  latch(x, sr, 0.29, 0.8, r);
  return x;
}, { group: 'door' });

oneShot('door.creak', (sr, r) => {
  const x = buf(1.6, sr);
  creak(x, sr, 0.02, 1.4, 1, r, 55, 190);
  return x;
}, { group: 'door' });

oneShot('door.knock', (sr, r) => {
  // Three polite knuckle raps.
  const x = buf(0.95, sr);
  [0, 0.17, 0.34].forEach((t, k) => {
    const g = k === 0 ? 0.9 : 1 - k * 0.08;
    mix(x, burst(sr, 0.006, 2400, 0.9, r), sr, t, 0.5 * g); // knuckle bone click
    panelHit(x, sr, t, 0.6 * g, r, { soft: 0.2, rattle: 0.08 });
  });
  return x;
}, { group: 'door' });

oneShot('door.bang', (sr, r) => {
  // Heavy fist on a cheap hollow door: BANG ... BANG. Low boom, flexing panel, frame rattle.
  const x = buf(1.6, sr);
  for (const [t, g] of [[0, 1], [0.42, 1.05]]) {
    mix(x, burst(sr, 0.09, 220, 0.8, r, 'lp'), sr, t, 1.8 * g); // fist mass
    panelHit(x, sr, t, 1.1 * g, r, { soft: 0, rattle: 0.6 });
    const flex = gen(0.25, sr, (s) => Math.sin(TAU * (62 + 30 * Math.exp(-s * 20)) * s) * Math.exp(-s * 14));
    mix(x, flex, sr, t, 0.7 * g); // the whole door bowing in its frame
  }
  const w = verb(x, sr, 0.35, 0.5); // hallway
  mix(x, w, sr, 0, 0.18);
  return x;
}, { group: 'door', db: -1.5 });

oneShot('door.lock', (sr, r) => {
  // Deadbolt thrown: key/thumbturn rotate, bolt slide, solid clack home.
  const x = buf(0.5, sr);
  const turn = noise(Math.floor(0.12 * sr), r);
  bp(turn, sr, 2200, 2);
  env(turn, sr, (t) => Math.sin(Math.PI * (t / 0.12)) * 0.6);
  mix(x, turn, sr, 0, 0.4);
  latch(x, sr, 0.13, 1, r, 0.75);
  panelHit(x, sr, 0.135, 0.15, r, { soft: 0.8, rattle: 0 });
  return x;
}, { group: 'door' });

oneShot('door.unlock', (sr, r) => {
  // Key slid in (pin tumbler clicks), turned, bolt retracts.
  const x = buf(0.85, sr);
  for (let k = 0; k < 5; k++) mix(x, burst(sr, 0.003, 5000 + k * 300, 2, r), sr, 0.02 + k * 0.025, 0.35);
  const scrape = noise(Math.floor(0.13 * sr), r);
  bp(scrape, sr, 3500, 1.5);
  env(scrape, sr, (t) => 0.4 * Math.sin(Math.PI * (t / 0.13)));
  mix(x, scrape, sr, 0.02, 0.4);
  const turn = noise(Math.floor(0.15 * sr), r);
  bp(turn, sr, 1800, 2);
  env(turn, sr, (t) => Math.sin(Math.PI * (t / 0.15)) * 0.5);
  mix(x, turn, sr, 0.3, 0.4);
  latch(x, sr, 0.46, 0.9, r, 0.7);
  return x;
}, { group: 'door' });

oneShot('door.slam', (sr, r) => {
  const x = buf(1.5, sr);
  swingAir(x, sr, 0, 0.2, 0.9, r);
  mix(x, burst(sr, 0.1, 200, 0.8, r, 'lp'), sr, 0.18, 2);
  panelHit(x, sr, 0.18, 1.2, r, { rattle: 0.9 });
  latch(x, sr, 0.185, 1, r);
  const w = verb(x, sr, 0.5, 0.45);
  mix(x, w, sr, 0, 0.25);
  return x;
}, { group: 'door', db: -1.5 });
