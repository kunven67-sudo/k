// Store + everyday sounds for REAL LIFE: barcode scanner beeps, the register drawer, the
// anti-theft gate alarm, automatic doors, picking things up, coins, the TV turning on, a tap.

import { oneShot, buf, noise, pink, lp, hp, bp, env, mix, modal, burst, gen, TAU } from '../dsp.js';

const G = { group: 'store' };

oneShot('store.beep', (sr) => {
  // Scanner beep: a clean ~2.8 kHz tone with a soft square edge.
  const x = gen(0.13, sr, (t) => {
    const s = Math.sin(TAU * 2810 * t);
    return (s + 0.18 * Math.sign(s)) * Math.min(1, t / 0.004) * (t < 0.1 ? 1 : Math.exp(-(t - 0.1) * 120));
  });
  return x;
}, { db: -12, ...G });

oneShot('store.register', (sr, r) => {
  // Drawer pops open (spring + slide) and a little bell ding.
  const x = buf(1.1, sr);
  mix(x, burst(sr, 0.02, 1800, 1, r), sr, 0, 0.8);
  const slide = noise(Math.floor(0.25 * sr), r);
  bp(slide, sr, 900, 0.6);
  env(slide, sr, (t) => Math.exp(-t * 10) * 0.6);
  mix(x, slide, sr, 0.02, 1);
  modal(x, sr, [[180, 0.6, 0.08], [420, 0.3, 0.05]], 0.24, 1, r); // drawer stop
  modal(x, sr, [[2093, 0.5, 0.9], [4186, 0.18, 0.5], [6280, 0.06, 0.3]], 0.3, 0.6, r); // ding
  return x;
}, { db: -8, ...G });

oneShot('store.alarm', (sr) => {
  // Anti-theft gate: alternating two-tone beeps for ~2 s.
  const x = gen(2.2, sr, (t) => {
    const k = Math.floor(t / 0.18);
    const on = t % 0.18 < 0.13;
    const f = k % 2 ? 2400 : 3000;
    const s = Math.sin(TAU * f * t);
    return on ? Math.sign(s) * 0.45 + s * 0.3 : 0;
  });
  lp(x, sr, 6000);
  return x;
}, { db: -9, ...G });

oneShot('door.slide', (sr, r) => {
  // Automatic door: motor whir + rubber seal swish.
  const x = gen(1.4, sr, (t) => Math.sin(TAU * (110 + 40 * Math.min(1, t)) * t) * 0.25 * Math.sin(Math.PI * Math.min(1, t / 1.4)));
  const air = pink(x.length, r);
  bp(air, sr, 700, 0.5);
  env(air, sr, (t) => Math.sin(Math.PI * Math.min(1, t / 1.4)) * 0.5);
  mix(x, air, sr, 0, 1);
  modal(x, sr, [[240, 0.3, 0.06]], 1.25, 1, r);
  return x;
}, { db: -14, ...G });

oneShot('item.pickup', (sr, r) => {
  // Grabbing a package: cardboard/plastic scuff + tiny knock.
  const x = buf(0.25, sr);
  const sc = noise(Math.floor(0.12 * sr), r);
  bp(sc, sr, 2200, 0.7);
  env(sc, sr, (t) => Math.exp(-t * 30));
  mix(x, sc, sr, 0, 0.7);
  modal(x, sr, [[380, 0.4, 0.04], [960, 0.2, 0.02]], 0.03, 1, r);
  return x;
}, { db: -12, ...G });

oneShot('bag.rustle', (sr, r) => {
  const x = noise(Math.floor(0.45 * sr), r);
  hp(x, sr, 1800);
  env(x, sr, (t) => (0.5 + 0.5 * Math.sin(t * 60)) * Math.exp(-t * 6));
  return x;
}, { db: -14, ...G });

oneShot('coins', (sr, r) => {
  const x = buf(0.7, sr);
  for (let i = 0; i < 6; i++) {
    const f = 3800 + ((i * 977) % 1900);
    modal(x, sr, [[f, 0.3, 0.12], [f * 1.53, 0.15, 0.08], [f * 2.4, 0.06, 0.05]], 0.02 + i * 0.07 + (r() * 0.03), 1, r);
  }
  return x;
}, { db: -10, ...G });

oneShot('ui.open', (sr) => gen(0.12, sr, (t) => Math.sin(TAU * (520 + 900 * t) * t) * Math.exp(-t * 30) * 0.6), { db: -16, ...G });

oneShot('tv.on', (sr, r) => {
  // Click + CRT/LED power-on whine + a burst of static.
  const x = buf(0.6, sr);
  mix(x, burst(sr, 0.004, 4000, 1, r), sr, 0, 0.8);
  const st = noise(Math.floor(0.3 * sr), r);
  hp(st, sr, 1500);
  env(st, sr, (t) => Math.exp(-t * 12) * 0.4);
  mix(x, st, sr, 0.02, 1);
  mix(x, gen(0.5, sr, (t) => Math.sin(TAU * 15700 * t) * 0.05 * Math.exp(-t * 4)), sr, 0, 1);
  return x;
}, { db: -12, ...G });

oneShot('home.tap', (sr, r) => {
  // Tap running into a glass for a second or two.
  const x = noise(Math.floor(1.6 * sr), r);
  bp(x, sr, (t) => 1400 + t * 600, 0.9);
  env(x, sr, (t) => Math.min(1, t / 0.08) * (t < 1.3 ? 1 : Math.exp(-(t - 1.3) * 14)) * 0.7);
  return x;
}, { db: -14, ...G });
