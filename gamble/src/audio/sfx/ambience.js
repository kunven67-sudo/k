// Ambience beds (stereo, seamless, ~-12 dBFS) plus the crowd cheer one-shot.
//
// Beds are built from independent L/R layers so they feel wide; every bed is 8-12 s with a
// ~1 s crossfade so the loop point is inaudible.

import { loopShot, oneShot, buf, noise, pink, brown, biquad, lp, hp, bp, env, mix, modal, burst, gen, wander, verb, mtof, upsample, TAU } from '../dsp.js';
import { bell, coinHit } from './casino.js';
import { voice } from './body.js';
import { bubble } from './steps.js';

const VOWELS = [[750, 1150, 2500], [450, 1700, 2500], [320, 800, 2300], [500, 850, 2400], [350, 2000, 2800], [600, 1200, 2450]];

/**
 * One talker: syllables with vowel changes, phrase-level pauses and pitch declination.
 * Intelligibility is deliberately nil — it is speech-shaped, never words.
 */
export function talker(sr, dur, r, f0base = 120, rate = 4.5, down = 4) {
  // Rendered at sr/down (speech-shaped content needs < 4 kHz) then upsampled: 4x cheaper.
  const out = sr;
  sr = Math.round(sr / down);
  const syl = [];
  let t = r() * 0.4;
  while (t < dur) {
    const phrase = 0.8 + r() * 2.2;
    const end = Math.min(dur, t + phrase);
    while (t < end) {
      const len = (0.6 + r() * 0.8) / rate;
      syl.push({ t, len, v: VOWELS[Math.floor(r() * VOWELS.length)], p: 0.85 + r() * 0.35, start: end - phrase });
      t += len;
    }
    t += 0.25 + r() * 0.9; // breath pause
  }
  const at = (tt) => {
    let lo = 0, hi = syl.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (syl[m].t <= tt) lo = m; else hi = m - 1;
    }
    return syl[lo];
  };
  const v = voice(sr, dur, {
    r, breath: 0.15, rough: 0.06,
    f0: (tt) => {
      const s = at(tt);
      return f0base * s.p * (1.1 - 0.15 * Math.min(1, (tt - s.start) / 2.5));
    },
    form: (tt) => at(tt).v,
    amp: (tt) => {
      const s = at(tt);
      const p = (tt - s.t) / s.len;
      return p >= 0 && p <= 1 ? Math.sin(Math.PI * p) ** 0.8 : 0;
    },
  });
  const y = upsample(v, down);
  lp(y, out, sr * 0.42);
  return y.length >= Math.floor(dur * out) ? y : (() => { const z = new Float32Array(Math.floor(dur * out)); z.set(y); return z; })();
}

/** Crowd murmur: many distant talkers, blurred together. Returns [L, R]. */
function murmur(sr, dur, r, n = 10) {
  const L = buf(dur, sr), R = buf(dur, sr);
  for (let k = 0; k < n; k++) {
    const v = talker(sr, dur, r, r() < 0.5 ? 100 + r() * 30 : 180 + r() * 50, 4 + r() * 1.5);
    const pan = r();
    mix(L, v, sr, 0, (1 - pan) * (0.5 + r() * 0.5));
    mix(R, v, sr, 0, pan * (0.5 + r() * 0.5));
  }
  for (const x of [L, R]) lp(x, sr, 1800);
  return [L, R];
}

loopShot('amb.casino', (sr, r) => {
  const d = 12, xf = 1.2, T = d + xf;
  const [L, R] = murmur(sr, T, r, 9);
  // HVAC: broadband air + 120 Hz air-handler hum.
  for (const x of [L, R]) {
    const h = pink(x.length, r);
    lp(h, sr, 500);
    mix(x, h, sr, 0, 0.5);
    mix(x, gen(T, sr, (t) => 0.02 * Math.sin(TAU * 120 * t)), sr, 0, 1);
  }
  // Distant slot machines: chime runs, reel ticks, coin clinks — through a big room.
  const jingle = buf(T, sr);
  const scale = [72, 74, 76, 79, 81, 84, 86, 88, 91];
  for (let k = 0; k < 26; k++) {
    const at = r() * (T - 1);
    const base = Math.floor(r() * 4);
    const len = 2 + Math.floor(r() * 4);
    for (let j = 0; j < len; j++) bell(jingle, sr, at + j * 0.08, mtof(scale[base + j] ?? 88), 0.15, r, 0.5);
  }
  for (let k = 0; k < 10; k++) {
    const at = r() * (T - 2);
    for (let j = 0; j < 30; j++) mix(jingle, burst(sr, 0.006, 2400, 1.4, r), sr, at + j / 18, 0.05);
  }
  for (let k = 0; k < 40; k++) coinHit(jingle, sr, r() * T, 0.04, r, 0.5);
  lp(jingle, sr, 5000);
  const wet = verb(jingle, sr, 0.85, 0.5);
  // Chip clatter from nearby tables.
  const chips = buf(T, sr);
  for (let k = 0; k < 30; k++) {
    const at = r() * T, f = 2900 + r() * 900;
    modal(chips, sr, [[f, 0.1, 0.015], [f * 1.73, 0.06, 0.01]], at, 1, r);
    if (r() < 0.4) modal(chips, sr, [[f * 1.05, 0.06, 0.012]], at + 0.02, 1, r);
  }
  const p = r();
  mix(L, jingle, sr, 0, 0.6 * p + 0.2); mix(R, jingle, sr, 0, 0.8 - 0.6 * p);
  mix(L, wet, sr, 0, 0.7); mix(R, wet, sr, 0.013, 0.7);
  mix(L, chips, sr, 0, 0.5); mix(R, chips, sr, 0.004, 0.35);
  return [L, R];
}, { db: -12, xf: 1.2, group: 'amb' });

loopShot('amb.night', (sr, r) => {
  // Desert night: crickets (pulsed ~4.6 kHz chirps in pairs/triplets), far traffic wash, breeze.
  const d = 10, xf = 1, T = d + xf;
  const out = [buf(T, sr), buf(T, sr)];
  for (let c = 0; c < 6; c++) {
    const x = out[c % 2];
    const f = 4300 + r() * 700, period = 0.55 + r() * 0.4, pulses = 2 + Math.floor(r() * 3), g = 0.06 + r() * 0.08;
    for (let t = r() * period; t < T; t += period * (0.95 + r() * 0.1)) {
      for (let p = 0; p < pulses; p++) {
        const at = t + p * 0.035;
        mix(x, gen(0.025, sr, (s) => Math.sin(TAU * f * s) * Math.sin(Math.PI * (s / 0.025))), sr, at, g);
      }
    }
  }
  for (const x of out) {
    const far = brown(x.length, r);
    lp(far, sr, 250);
    mix(x, far, sr, 0, 0.6);
    const air = pink(x.length, r);
    bp(air, sr, 900, 0.5);
    const w = wander(T, sr, 0.15, r);
    env(air, sr, (t) => 0.1 + 0.15 * w(t));
    mix(x, air, sr, 0, 1);
  }
  return out;
}, { db: -14, xf: 1, group: 'amb' });

loopShot('amb.motel-room', (sr, r) => {
  // Room tone: wall unit air, faint mains hum, traffic through glass, plumbing ticks.
  const d = 10, xf = 1, T = d + xf;
  const out = [];
  for (let c = 0; c < 2; c++) {
    const x = pink(Math.floor(T * sr), r);
    lp(x, sr, 350);
    env(x, sr, () => 0.5);
    mix(x, gen(T, sr, (t) => 0.015 * Math.sin(TAU * 60 * t) + 0.008 * Math.sin(TAU * 180 * t)), sr, 0, 1);
    const traffic = brown(x.length, r);
    lp(traffic, sr, 180);
    const w = wander(T, sr, 0.2, r);
    env(traffic, sr, (t) => 0.3 + 0.7 * w(t) ** 2);
    mix(x, traffic, sr, 0, 0.6);
    out.push(x);
  }
  for (let k = 0; k < 4; k++) {
    const at = r() * (T - 0.5); // pipe ticks / ice settling in the cooler
    modal(out[k % 2], sr, [[900 + r() * 700, 0.04, 0.03], [2200 + r() * 600, 0.02, 0.015]], at, 1, r);
  }
  return out;
}, { db: -18, xf: 1, group: 'amb' });

/** Gusting wind layer (one channel). */
function windLayer(sr, T, r, f = 500) {
  const x = noise(Math.floor(T * sr), r);
  const w = wander(T, sr, 0.25, r), w2 = wander(T, sr, 0.9, r);
  biquad(x, sr, 'bp', (t) => f * (0.6 + w(t) * 0.9 + w2(t) * 0.3), 1.2);
  env(x, sr, (t) => 0.15 + 0.85 * Math.pow(w(t), 1.6));
  const whistle = noise(x.length, r);
  biquad(whistle, sr, 'bp', (t) => 1100 + 700 * w2(t), 18);
  env(whistle, sr, (t) => Math.max(0, w(t) - 0.55) * 3);
  mix(x, whistle, sr, 0, 0.6);
  return x;
}

loopShot('amb.wind', (sr, r) => {
  const T = 12 + 1.5;
  return [windLayer(sr, T, r, 420), windLayer(sr, T, r, 520)];
}, { db: -12, xf: 1.5, group: 'amb' });

loopShot('amb.rain', (sr, r) => {
  // Steady rain: dense droplet clicks and tiny bubbles on a hiss bed, plus a gutter drip.
  const d = 8, xf = 1, T = d + xf;
  const out = [];
  for (let c = 0; c < 2; c++) {
    const x = noise(Math.floor(T * sr), r);
    lp(x, sr, 6000);
    hp(x, sr, 400);
    env(x, sr, () => 0.25);
    for (let k = 0; k < T * 260; k++) mix(x, burst(sr, 0.003, 2500 + r() * 5000, 1.2, r), sr, r() * T, 0.15 + r() * 0.35);
    for (let k = 0; k < T * 25; k++) bubble(x, sr, r() * T, 1200 + r() * 2500, 0.05 + r() * 0.06, 0.008);
    out.push(x);
  }
  for (let t = 0.3; t < T; t += 0.62 + r() * 0.1) bubble(out[0], sr, t, 700 + r() * 150, 0.4, 0.02); // gutter
  return out;
}, { db: -12, xf: 1, group: 'amb' });

loopShot('amb.neighbor-tv', (sr, r) => {
  // Through the wall: a game-show host and guests talking, laugh track swells, a jingle.
  // Rendered dry and dark (the wall eats the highs); callers can add more occlusion.
  const d = 12, xf = 1, T = d + xf;
  const x = buf(T, sr);
  const host = talker(sr, T, r, 115, 5);
  const guest = talker(sr, T, r, 200, 4.2);
  mix(x, host, sr, 0, 1);
  mix(x, guest, sr, 0, 0.6);
  for (let k = 0; k < 3; k++) { // laugh track: cluster of breathy "ha" pulses
    const at = 1 + k * 4 + r();
    for (let j = 0; j < 12; j++) {
      const h = voice(sr, 0.9, {
        r, breath: 0.5, rough: 0.1, f0: (t) => 160 + r() * 120, form: () => [700, 1200, 2500],
        amp: (t) => Math.max(0, Math.sin(TAU * 5.5 * t)) * Math.exp(-t * 2),
      });
      mix(x, h, sr, at + r() * 0.2, 0.25);
    }
  }
  const melody = [67, 71, 74, 79, 78, 74];
  melody.forEach((m, k) => {
    const f = mtof(m);
    mix(x, gen(0.3, sr, (t) => (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t)) * Math.exp(-t * 6)), sr, 9 + k * 0.16, 0.4);
  });
  lp(x, sr, 700);
  lp(x, sr, 900);
  const thump = brown(x.length, r); // TV speaker resonating the wall
  lp(thump, sr, 120);
  mix(x, thump, sr, 0, 0.3);
  return x;
}, { db: -14, xf: 1, group: 'amb' });

oneShot('amb.crowd-cheer', (sr, r) => {
  // A table erupting: 18 voices "yeah!/woo!", claps and a whistle, all in a big room.
  const d = 3;
  const L = buf(d, sr), R = buf(d, sr);
  for (let k = 0; k < 18; k++) {
    const f0 = (r() < 0.6 ? 140 : 240) * (0.9 + r() * 0.3);
    const vow = r() < 0.5 ? [[450, 1700, 2500], [750, 1150, 2500]] : [[320, 800, 2300], [320, 800, 2300]];
    const len = 0.8 + r() * 1.4;
    const v = voice(sr, len, {
      r, breath: 0.35, rough: 0.08,
      f0: (t) => f0 * (1 + 0.5 * Math.sin(Math.PI * Math.min(1, t / len)) - 0.2 * (t / len)),
      form: (t) => (t < 0.12 ? vow[0] : vow[1]),
      amp: (t) => Math.min(1, t / 0.05) * Math.max(0, 1 - t / len),
    });
    const p = r(), at = r() * 0.3;
    mix(L, v, sr, at, 1 - p);
    mix(R, v, sr, at, p);
  }
  for (let k = 0; k < 60; k++) { // claps
    const c = burst(sr, 0.012, 1300 + r() * 900, 0.9, r);
    const at = 0.2 + r() * 2.2;
    mix(r() < 0.5 ? L : R, c, sr, at, 0.5 * (1 - at / 3));
  }
  let ph = 0;
  mix(L, gen(0.9, sr, (t) => { // finger whistle
    ph += (TAU * (2200 + 900 * Math.sin(Math.PI * Math.min(1, t / 0.45)))) / sr;
    return Math.sin(ph) * Math.sin(Math.PI * (t / 0.9)) * 0.25;
  }), sr, 0.4, 1);
  const w = verb(L, sr, 0.8, 0.5);
  mix(L, w, sr, 0, 0.3);
  mix(R, w, sr, 0.011, 0.3);
  return [L, R];
}, { db: -3, group: 'amb' });
