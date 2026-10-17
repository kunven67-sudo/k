// Motel-room appliances: a tired fridge, a wall light switch, a CRT on a dead channel and a
// window AC unit with a loose panel.

import { oneShot, loopShot, buf, noise, pink, brown, biquad, lp, hp, bp, peak, env, mix, modal, burst, gen, wander, TAU } from '../dsp.js';

const G = { group: 'home' };

oneShot('fridge.open', (sr, r) => {
  // Magnetic gasket peeling off (a sticky "thup"), bottles clinking in the door shelf.
  const x = buf(0.9, sr);
  const peel = noise(Math.floor(0.12 * sr), r);
  biquad(peel, sr, 'bp', (t) => 300 + t * 5000, 1.2);
  env(peel, sr, (t) => Math.exp(-t * 25) * (0.6 + 0.4 * Math.sin(TAU * 140 * t)));
  mix(x, peel, sr, 0, 1);
  mix(x, gen(0.1, sr, (t) => Math.sin(TAU * 75 * t) * Math.exp(-t * 40)), sr, 0, 0.6);
  for (const [t, f] of [[0.09, 2900], [0.13, 3400], [0.2, 2700]]) {
    modal(x, sr, [[f, 0.12, 0.15], [f * 2.32, 0.06, 0.08], [f * 3.9, 0.03, 0.04]], t, 1, r);
  }
  const air = pink(Math.floor(0.6 * sr), r); // cold air rolling out
  lp(air, sr, 700);
  env(air, sr, (t) => Math.sin(Math.PI * (t / 0.6)) * 0.4);
  mix(x, air, sr, 0.05, 0.6);
  return x;
}, G);

oneShot('fridge.close', (sr, r) => {
  // Soft door thud + gasket seal "whump" + bottle rattle.
  const x = buf(0.7, sr);
  mix(x, burst(sr, 0.07, 260, 0.8, r, 'lp'), sr, 0, 1.4);
  modal(x, sr, [[120, 0.4, 0.09], [265, 0.25, 0.06], [540, 0.1, 0.04]], 0, 1, r);
  for (const [t, f] of [[0.012, 3100], [0.03, 2600], [0.05, 3500]]) modal(x, sr, [[f, 0.1, 0.1], [f * 2.4, 0.05, 0.05]], t, 1, r);
  return x;
}, G);

loopShot('fridge.hum', (sr, r) => {
  // Compressor: 60 Hz mains hum + harmonics, a wobbling bearing tone, faint refrigerant hiss.
  const d = 6, xf = 1;
  const w = wander(d + xf, sr, 0.5, r);
  const x = gen(d + xf, sr, (t) => {
    const a = 0.9 + 0.1 * w(t);
    return a * (0.5 * Math.sin(TAU * 60 * t) + 0.35 * Math.sin(TAU * 120 * t + 1) +
      0.15 * Math.sin(TAU * 180 * t + 2) + 0.08 * Math.sin(TAU * 240 * t) +
      0.04 * Math.sin(TAU * 397 * t) * (0.5 + 0.5 * Math.sin(TAU * 0.7 * t)));
  });
  const h = noise(x.length, r);
  bp(h, sr, 4500, 0.7);
  mix(x, h, sr, 0, 0.015);
  const rum = brown(x.length, r);
  lp(rum, sr, 90);
  mix(x, rum, sr, 0, 0.2);
  return x;
}, { db: -14, xf: 1, ...G });

oneShot('light.switch', (sr, r) => {
  // Cheap toggle switch: spring snap + plastic plate resonance.
  const x = buf(0.15, sr);
  mix(x, burst(sr, 0.003, 5000, 1.2, r), sr, 0, 0.8);
  modal(x, sr, [[2300, 0.35, 0.02], [4100, 0.2, 0.012], [1150, 0.2, 0.03], [6800, 0.08, 0.006]], 0.001, 1, r);
  mix(x, burst(sr, 0.01, 600, 0.8, r, 'lp'), sr, 0, 0.5);
  return x;
}, G);

loopShot('tv.static', (sr, r) => {
  // CRT snow: hissy white noise with a band-limited "fizz", 15.7 kHz flyback whine and a
  // 60 Hz vertical buzz, played through the set's small speaker.
  const d = 3, xf = 0.4;
  const n = Math.floor((d + xf) * sr);
  const x = noise(n, r);
  hp(x, sr, 300);
  lp(x, sr, 7000);
  peak(x, sr, 2500, 1, 6);
  const buzz = gen(d + xf, sr, (t) => 0.12 * Math.sign(Math.sin(TAU * 60 * t)) + 0.02 * Math.sin(TAU * 15734 * t));
  lp(buzz, sr, 2000);
  mix(x, buzz, sr, 0, 1);
  return x;
}, { db: -10, xf: 0.4, ...G });

loopShot('ac.rattle', (sr, r) => {
  // Window AC: fan roar, motor hum, and a loose louvre panel buzzing against the housing,
  // the buzz coming and going as the vibration drifts in and out of resonance.
  const d = 6, xf = 1;
  const len = Math.floor((d + xf) * sr);
  const fan = pink(len, r);
  lp(fan, sr, 1400);
  const x = fan;
  env(x, sr, (t) => 0.8 + 0.2 * Math.sin(TAU * 7.5 * t)); // blade beat
  const hum = gen(d + xf, sr, (t) => 0.25 * Math.sin(TAU * 120 * t) + 0.1 * Math.sin(TAU * 240 * t));
  mix(x, hum, sr, 0, 1);
  const w = wander(d + xf, sr, 0.8, r);
  const rattle = gen(d + xf, sr, (t) => {
    const a = Math.max(0, w(t) - 0.45) * 2.2;
    const s = Math.sin(TAU * 60 * t);
    return s > 0.6 ? a * (r() * 2 - 1) : 0; // panel slapping on each vibration peak
  });
  bp(rattle, sr, 1700, 1.2);
  mix(x, rattle, sr, 0, 0.8);
  return x;
}, { db: -12, xf: 1, ...G });
