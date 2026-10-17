// Phone sounds: original tones (no imitation of real OS jingles), haptic buzz, glass taps.

import { oneShot, buf, noise, lp, hp, bp, env, mix, modal, burst, gen, mtof, TAU } from '../dsp.js';

const G = { group: 'phone' };

oneShot('phone.vibrate', (sr, r) => {
  // ERM motor: ~175 Hz buzz with spin-up/down, rattling against a hard surface. Two pulses.
  const x = buf(1.1, sr);
  for (const at of [0, 0.6]) {
    const d = 0.4;
    let ph = 0;
    const m = gen(d, sr, (t) => {
      const spin = Math.min(1, t / 0.05) * Math.min(1, (d - t) / 0.06);
      ph += (TAU * (120 + 55 * spin)) / sr;
      const s = Math.sin(ph);
      return spin * (s + 0.5 * Math.sign(s) * Math.abs(s) ** 6); // case slapping the table
    });
    const rattle = m.slice();
    hp(rattle, sr, 900);
    lp(rattle, sr, 4000);
    mix(x, m, sr, at, 0.6);
    mix(x, rattle, sr, at, 0.8);
  }
  return x;
}, G);

oneShot('phone.notify', (sr, r) => {
  // Two soft kalimba-ish plucks, a rising major sixth — friendly, short, original.
  const x = buf(1.0, sr);
  const pluck = (m, at, g) => {
    const f = mtof(m);
    modal(x, sr, [[f, 0.5, 0.35], [f * 2.0, 0.12, 0.12], [f * 5.4, 0.05, 0.03], [f * 8.9, 0.02, 0.01]], at, g, r);
  };
  pluck(81, 0, 1);
  pluck(90, 0.12, 0.9);
  return x;
}, G);

oneShot('phone.unlock', (sr, r) => {
  // Soft tick + quick airy upward blip.
  const x = buf(0.25, sr);
  mix(x, burst(sr, 0.003, 4500, 1.4, r), sr, 0, 0.5);
  let ph = 0;
  mix(x, gen(0.12, sr, (t) => {
    ph += (TAU * (900 + 2400 * t)) / sr;
    return Math.sin(ph) * Math.sin(Math.PI * (t / 0.12)) ** 2 * 0.4;
  }), sr, 0.02, 1);
  return x;
}, G);

oneShot('phone.lock', (sr, r) => {
  // Short firm "tock" — a damped wooden-ish click.
  const x = buf(0.15, sr);
  mix(x, burst(sr, 0.004, 2600, 1, r), sr, 0, 0.7);
  modal(x, sr, [[1250, 0.4, 0.018], [2900, 0.2, 0.01], [600, 0.2, 0.02]], 0, 1, r);
  return x;
}, G);

oneShot('phone.tap', (sr, r) => {
  // Fingertip on glass: very short, very quiet.
  const x = buf(0.06, sr);
  mix(x, burst(sr, 0.003, 3200, 1, r), sr, 0, 0.6);
  modal(x, sr, [[2100, 0.2, 0.008]], 0, 1, r);
  return x;
}, { ...G, db: -10 });

oneShot('phone.camera', (sr, r) => {
  // Synthetic shutter: curtain open/close clicks with a spring whirr between.
  const x = buf(0.35, sr);
  for (const [at, f] of [[0, 3800], [0.075, 3000]]) {
    mix(x, burst(sr, 0.008, f, 1.1, r), sr, at, 1);
    modal(x, sr, [[f * 0.45, 0.3, 0.015], [f * 0.9, 0.15, 0.01]], at, 1, r);
  }
  const w = noise(Math.floor(0.07 * sr), r);
  bp(w, sr, 5500, 1.2);
  env(w, sr, (t) => Math.sin(Math.PI * (t / 0.07)) * 0.3);
  mix(x, w, sr, 0.005, 1);
  return x;
}, G);
