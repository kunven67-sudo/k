// Slot sounds. The shared contract names (slot.*, cash.bill, coins.drop — ARCHITECTURE §5) come
// from src/audio; the few machine voices that are specific to these games (rollup ticks, the bill
// validator motor, anticipation tease, per-theme win jingles, feature fanfares) are defined here
// under the private 'slots.' prefix with the same DSP toolkit.
//
//   machineSound(machine, 'slot.reel-stop', { gain, rate })  → positional at the machine, quieter
//                                                              for NPC play, never throws

import { audio } from '../../core/audio.js';
import { oneShot, loopShot, buf, noise, bp, lp, mix, modal, burst, gen, mtof, env, TAU } from '../../audio/dsp.js';
import { bell, coinHit } from '../../audio/sfx/casino.js';

// ---- private voices -------------------------------------------------------------------------------

oneShot('slots.rollup', (sr, r) => {
  // one credit tick: bright two-partial blip (played with rising rate during a rollup)
  const x = buf(0.09, sr);
  modal(x, sr, [[1760, 0.5, 0.025], [3520, 0.18, 0.012]], 0, 1, r);
  mix(x, burst(sr, 0.004, 6000, 1, r), sr, 0, 0.15);
  return x;
}, { db: -9 });

oneShot('slots.bill-in', (sr, r) => {
  // validator grabs the bill: rubber rollers + motor whine, a stop and a soft clunk into the stacker
  const x = buf(1.3, sr);
  let ph = 0;
  const motor = gen(0.95, sr, (t) => {
    ph += (TAU * (210 + 40 * Math.min(1, t * 6))) / sr;
    return (Math.sin(ph) * 0.3 + Math.sin(ph * 2.01) * 0.12) * Math.min(1, t * 20) * (t < 0.85 ? 1 : (0.95 - t) * 10);
  });
  mix(x, motor, sr, 0.05, 0.6);
  const roll = noise(Math.floor(0.9 * sr), r);
  bp(roll, sr, 1300, 0.8);
  env(roll, sr, (t) => 0.3 * Math.min(1, t * 15) * (t < 0.8 ? 1 : Math.max(0, (0.9 - t) * 10)));
  mix(x, roll, sr, 0.05, 0.5);
  mix(x, burst(sr, 0.04, 300, 0.8, r, 'lp'), sr, 1.02, 1.2);
  modal(x, sr, [[240, 0.2, 0.05], [610, 0.1, 0.03]], 1.02, 1, r);
  return x;
}, { db: -6 });

loopShot('slots.tease', (sr, r) => {
  // anticipation: a fast tremolo roll on a rising shimmer, 2 s loop
  const d = 2.0;
  const xf = 0.2;
  const x = gen(d + xf, sr, (t) => {
    const trem = 0.5 + 0.5 * Math.sin(TAU * 16 * t);
    return (Math.sin(TAU * 523.25 * t) * 0.18 + Math.sin(TAU * 659.25 * t) * 0.12 + Math.sin(TAU * 783.99 * t) * 0.1) * trem;
  });
  const sh = noise(x.length, r);
  bp(sh, sr, 7000, 0.6);
  mix(x, sh, sr, 0, 0.05);
  return x;
}, { db: -10, xf: 0.2 });

// Per-theme win jingles (short, cheerful, in each theme's own instrument colour).
const pluck = (x, sr, at, f, g, len = 0.5) => {
  // Karplus-ish twang via decaying harmonics (banjo / guitar colour)
  modal(x, sr, [[f, 0.5, len], [f * 2, 0.25, len * 0.6], [f * 3, 0.12, len * 0.35], [f * 4.02, 0.06, len * 0.2]], at, g);
};
const synthBlip = (x, sr, at, f, g, len = 0.25) => {
  const n = Math.floor(len * sr);
  const o = Math.floor(at * sr);
  for (let i = 0; i < n && o + i < x.length; i++) {
    const t = i / sr;
    const sq = Math.sign(Math.sin(TAU * f * t)) * 0.3 + Math.sin(TAU * f * 2 * t) * 0.2;
    x[o + i] += sq * Math.exp(-t / (len * 0.35)) * g;
  }
};
const gong = (x, sr, at, f, g) => modal(x, sr, [[f, 0.4, 1.4], [f * 1.52, 0.2, 1.0], [f * 2.31, 0.12, 0.7], [f * 3.1, 0.06, 0.4]], at, g);

oneShot('slots.jingle.wild-west', (sr) => {
  const x = buf(1.4, sr);
  [55, 59, 62, 67].forEach((m, i) => pluck(x, sr, i * 0.11, mtof(m), 0.7));
  pluck(x, sr, 0.5, mtof(71), 0.8, 0.9);
  return x;
});
oneShot('slots.jingle.space', (sr) => {
  const x = buf(1.2, sr);
  [72, 76, 79, 84, 88].forEach((m, i) => synthBlip(x, sr, i * 0.07, mtof(m), 0.5));
  lp(x, sr, 5000);
  return x;
});
oneShot('slots.jingle.dragon', (sr, r) => {
  const x = buf(1.8, sr);
  // pentatonic run on a bright plucked zither colour, then a small gong
  [62, 64, 67, 69, 74].forEach((m, i) => pluck(x, sr, i * 0.09, mtof(m), 0.6, 0.6));
  gong(x, sr, 0.5, 220, 0.4);
  void r;
  return x;
});
oneShot('slots.jingle.classic-fruit', (sr, r) => {
  const x = buf(1.0, sr);
  bell(x, sr, 0, mtof(84), 0.6, r, 0.5);
  bell(x, sr, 0.12, mtof(88), 0.6, r, 0.6);
  return x;
});

oneShot('slots.feature', (sr, r) => {
  // feature trigger fanfare: rising arpeggio + shimmering bell cluster
  const x = buf(2.6, sr);
  [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => bell(x, sr, i * 0.08, mtof(m), 0.5, r, 0.7));
  [84, 88, 91].forEach((m) => bell(x, sr, 0.62, mtof(m), 0.45, r, 1.6));
  return x;
}, { db: -3 });

oneShot('slots.expand', (sr, r) => {
  // saucer beam: a falling-then-rising sci-fi sweep with shimmer
  const x = buf(1.1, sr);
  let ph = 0;
  const sw = gen(1.0, sr, (t) => {
    const f = 1400 * Math.exp(-t * 3) + 300 + 600 * t;
    ph += (TAU * f) / sr;
    return Math.sin(ph + 2 * Math.sin(ph * 0.5)) * 0.4 * Math.exp(-t * 1.6);
  });
  mix(x, sw, sr, 0, 1);
  const n = noise(x.length, r);
  bp(n, sr, 5000, 0.8);
  env(n, sr, (t) => 0.12 * Math.exp(-t * 3));
  mix(x, n, sr, 0, 1);
  return x;
}, { db: -6 });

oneShot('slots.pearl', (sr, r) => {
  // a pearl locks: soft gong + coin shimmer
  const x = buf(1.2, sr);
  gong(x, sr, 0, 330, 0.5);
  coinHit(x, sr, 0.02, 0.4, r, 0.8);
  return x;
}, { db: -6 });

oneShot('slots.video-stop', (sr, r) => {
  // video reel landing: a soft electronic thunk with a short tonal tail
  const x = buf(0.25, sr);
  mix(x, burst(sr, 0.03, 180, 0.7, r, 'lp'), sr, 0, 1.2);
  modal(x, sr, [[392, 0.25, 0.05], [784, 0.08, 0.03]], 0, 1, r);
  return x;
}, { db: -6 });

oneShot('slots.scatter', (sr, r) => {
  const x = buf(1.0, sr);
  bell(x, sr, 0, mtof(91), 0.8, r, 0.8);
  bell(x, sr, 0.04, mtof(96), 0.4, r, 0.6);
  return x;
}, { db: -5 });

// ---- playing --------------------------------------------------------------------------------------

const _p = { x: 0, y: 0, z: 0 };

/**
 * Play a sound at a machine. NPC machines are quieter and ignore rare sounds when far away.
 * opts: gain, rate, loop, detune.
 */
export function machineSound(machine, name, opts = {}) {
  try {
    const p = machine.soundPos();
    _p.x = p.x;
    _p.y = p.y;
    _p.z = p.z;
    const npc = !machine.active;
    const gain = (opts.gain ?? 1) * (npc ? 0.28 : 1);
    return audio.play(name, { bus: 'sfx', position: npc || opts.positional ? { ..._p } : null, refDistance: npc ? 1.5 : 2.5, rolloff: 1.6, reverb: 0.35, ...opts, gain }) || null;
  } catch {
    return null;
  }
}
