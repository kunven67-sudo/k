// Synthesized band for the music engine. Every instrument renders one note into a Float32Array
// (mono, or [L, R]) the first time that pitch/velocity/length is needed; the result is cached as an
// AudioBuffer so the scheduler only ever creates cheap BufferSource nodes.
//
//   rhodes   FM electric piano (1:1 body pair + 14:1 tine pair, velocity-dependent bark)
//   bass     Karplus-Strong upright (finger thump, woody body resonance)
//   guitar   Karplus-Strong steel string (country radio)
//   vibes    modal vibraphone bar with motor tremolo
//   trumpet  additive brass through a harmon-mute formant (scoop + delayed vibrato)
//   steel    pedal-steel swell (slide into the note)
//   pad      detuned polyBLEP saw ensemble (slow strings)
//   ride / tap / swish / kick / hat / rim / shaker   brushed jazz kit (variant = "midi" arg)

import { TAU, rng, noise, biquad, lp, hp, bp, peak, env, modal, drive, fades, dcBlock, mtof } from '../dsp.js';
import { synth } from '../../core/audio.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Normalise the channels to a common peak so the mixer works with predictable levels. */
function norm(chs, p = 0.9) {
  let m = 1e-9;
  for (const x of chs) for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  for (const x of chs) for (let i = 0; i < x.length; i++) x[i] *= p / m;
  return chs;
}

// ---------------------------------------------------------------- keys & mallets

function rhodes(sr, midi, vel) {
  const f = mtof(midi);
  const reg = clamp((midi - 36) / 60, 0, 1);
  const dec = 1.0 + 2.6 * (1 - reg); // low notes ring longer
  const len = Math.min(4.5, dec * 3.2);
  const x = new Float32Array(Math.floor(len * sr));
  const w = (TAU * f) / sr;
  const bark = 0.5 + 2.2 * vel; // harder hits growl
  for (let i = 0; i < x.length; i++) {
    const t = i / sr;
    const ph = w * i;
    const i1 = bark * Math.exp(-t / 0.35) + 0.25;
    const a1 = Math.exp(-t / dec) * Math.min(1, t / 0.0015);
    const body = Math.sin(ph + i1 * Math.sin(ph));
    const i2 = (0.6 + vel) * Math.exp(-t / 0.05);
    const tine = Math.sin(ph + i2 * Math.sin(ph * 14.0)) * Math.exp(-t / 0.18) * 0.35;
    x[i] = (body + tine) * a1;
  }
  drive(x, 1.1 + vel * 0.8); // pickup asymmetry / amp warmth
  peak(x, sr, 220, 0.8, 2);
  return [fades(dcBlock(x), sr, 1, 40)];
}

function vibes(sr, midi, vel, dur, r) {
  const f = mtof(midi);
  const dec = clamp(3.6 - (midi - 53) / 14, 1.2, 4);
  const x = new Float32Array(Math.floor((dec * 1.6 + 0.2) * sr));
  modal(x, sr, [[f, 1, dec], [f * 3.984, 0.22 * vel + 0.05, dec * 0.22], [f * 9.95, 0.05, 0.12]], 0.002, 1, r);
  // Soft yarn mallet: low-passed contact thump.
  const m = noise(Math.floor(0.012 * sr), r);
  lp(m, sr, 1800 + vel * 2500, 0.7);
  env(m, sr, (t) => Math.exp(-t / 0.002));
  for (let i = 0; i < m.length; i++) x[i] += m[i] * 0.4;
  // Motor tremolo (rotating discs), phase randomised per note so chords shimmer.
  const ph = r() * TAU;
  env(x, sr, (t) => 1 - 0.32 * (0.5 + 0.5 * Math.sin(TAU * 5.3 * t + ph)) * Math.min(1, t * 6));
  return [fades(x, sr, 0.5, 60)];
}

// ---------------------------------------------------------------- plucked strings

/** Karplus-Strong string. `bright` 0..1 shapes the excitation; `t60` sets the ring time. */
function ks(sr, f, vel, len, bright, t60, r) {
  const N = Math.max(2, sr / f);
  const Ni = Math.floor(N), fr = N - Ni;
  const x = new Float32Array(Math.floor(len * sr));
  const line = new Float32Array(Ni + 2);
  // Excitation: noise low-passed by pluck brightness, blended with a smooth "finger" bump.
  const ex = noise(Ni + 2, r);
  lp(ex, sr, 300 + bright * 5000 + vel * 1500, 0.6);
  for (let i = 0; i < line.length; i++) line[i] = ex[i] * 0.7 + Math.sin((Math.PI * i) / line.length) * 0.6;
  // Zero-mean excitation: any DC would circulate in the loop as an inaudible offset.
  let mean = 0;
  for (let i = 0; i < line.length; i++) mean += line[i] / line.length;
  for (let i = 0; i < line.length; i++) line[i] -= mean;
  const g = Math.pow(10, -3 / (f * t60));
  let p = 0, prev = 0;
  for (let i = 0; i < x.length; i++) {
    // Fractional delay by linear interpolation keeps upper notes in tune.
    const a = line[p], b = line[(p + 1) % line.length];
    const out = a * (1 - fr) + b * fr;
    const y = g * (0.5 * out + 0.5 * prev);
    prev = out;
    line[p] = y;
    p = (p + 1) % line.length;
    x[i] = out;
  }
  return x;
}

function bass(sr, midi, vel, dur, r) {
  const f = mtof(midi);
  const x = ks(sr, f, vel, 2.4, 0.15, 2.2, r);
  lp(x, sr, 900 + vel * 500, 0.7);
  hp(x, sr, 30, 0.7);
  peak(x, sr, 95, 1.2, 4); // body resonance
  peak(x, sr, 700, 1.5, 3); // woody growl
  // Finger slap against the fingerboard.
  const s = noise(Math.floor(0.03 * sr), r);
  bp(s, sr, 900, 1.2);
  env(s, sr, (t) => Math.exp(-t / 0.006));
  for (let i = 0; i < s.length; i++) x[i] += s[i] * 0.25 * vel;
  env(x, sr, (t) => Math.exp(-t / 1.4));
  drive(x, 1.4);
  return [fades(dcBlock(x), sr, 1, 60)];
}

function guitar(sr, midi, vel, dur, r) {
  const x = ks(sr, mtof(midi), vel, 2.2, 0.7, 2.6, r);
  peak(x, sr, 2400, 1, 4); // steel-string sparkle
  hp(x, sr, 90, 0.7);
  peak(x, sr, 180, 1, 3); // box body
  return [fades(dcBlock(x), sr, 0.5, 60)];
}

// ---------------------------------------------------------------- sustained voices

/** Additive harmonic tone with a brightness envelope; shared by trumpet and steel. */
function additive(sr, f0, len, { amp, bright, pitch, rolloff, maxF = 9000 }) {
  const x = new Float32Array(Math.floor(len * sr));
  const K = Math.max(1, Math.floor(Math.min(maxF, sr * 0.45) / f0));
  const phs = new Float64Array(K + 1);
  const roll = Float64Array.from({ length: K + 1 }, (_, k) => (k ? 1 / Math.pow(k, rolloff) : 0));
  for (let i = 0; i < x.length; i++) {
    const t = i / sr;
    const a = amp(t);
    if (a < 1e-5) continue;
    const f = f0 * pitch(t);
    const q = Math.exp(-bright(t)); // per-harmonic brightness falloff
    const dph = (TAU * f) / sr;
    let s = 0, w = 1;
    for (let k = 1; k <= K; k++) {
      phs[k] += dph * k;
      s += Math.sin(phs[k]) * w * roll[k];
      w *= q;
      if (w < 2e-3) break;
    }
    x[i] = s * a;
  }
  return x;
}

function trumpet(sr, midi, vel, dur, r) {
  const f = mtof(midi);
  const len = dur + 0.12;
  const rel = (t) => (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.1));
  const x = additive(sr, f, len, {
    amp: (t) => Math.min(1, t / 0.035) * (0.85 + 0.15 * Math.exp(-t / 0.15)) * rel(t),
    bright: (t) => 0.55 - 0.28 * vel * Math.exp(-t / 0.25) - 0.1 * Math.min(1, t / 0.08),
    pitch: (t) => {
      const scoop = -0.025 * Math.exp(-t / 0.035); // lip into the note
      const vib = t > 0.28 ? 0.006 * Math.min(1, (t - 0.28) / 0.3) * Math.sin(TAU * 5.4 * t) : 0;
      return Math.pow(2, scoop + vib);
    },
    rolloff: 0.7,
    maxF: 6500,
  });
  // Breath at the attack.
  const b = noise(Math.floor(0.12 * sr), r);
  bp(b, sr, 2600, 1);
  env(b, sr, (t) => Math.exp(-t / 0.03));
  for (let i = 0; i < b.length && i < x.length; i++) x[i] += b[i] * 0.15;
  // Harmon mute: thin, nasal, buzzy.
  hp(x, sr, 480, 0.8);
  peak(x, sr, 1600, 1.6, 9);
  peak(x, sr, 3300, 2, 5);
  lp(x, sr, 6500, 0.7);
  drive(x, 1.6);
  return [fades(dcBlock(x), sr, 1, 20)];
}

function steel(sr, midi, vel, dur, r) {
  const f = mtof(midi);
  const len = dur + 0.6;
  const x = additive(sr, f, len, {
    amp: (t) => Math.min(1, t / 0.12) * Math.exp(-t / 2.6) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.15)),
    bright: () => 0.55,
    pitch: (t) => Math.pow(2, (-1 / 12) * Math.exp(-t / 0.07) + 0.004 * Math.sin(TAU * 4.8 * t) * Math.min(1, t * 2)),
    rolloff: 1.2,
    maxF: 5000,
  });
  peak(x, sr, 1200, 1, 3);
  return [fades(dcBlock(x), sr, 1, 40)];
}

/** PolyBLEP sawtooth. */
function saw(f, sr, n, r) {
  const x = new Float32Array(n);
  let p = r();
  const dt = f / sr;
  for (let i = 0; i < n; i++) {
    let v = 2 * p - 1;
    if (p < dt) {
      const q = p / dt;
      v -= q + q - q * q - 1;
    } else if (p > 1 - dt) {
      const q = (p - 1) / dt;
      v -= q * q + q + q + 1;
    }
    x[i] = v;
    p += dt;
    if (p >= 1) p -= 1;
  }
  return x;
}

function pad(sr, midi, vel, dur, r) {
  const f = mtof(midi);
  const len = dur + 1.0;
  const n = Math.floor(len * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const det = [-9, -3, 4, 10];
  det.forEach((c, k) => {
    const s = saw(f * Math.pow(2, c / 1200), sr, n, r);
    const gl = k % 2 ? 0.35 : 0.65;
    for (let i = 0; i < n; i++) {
      L[i] += s[i] * gl;
      R[i] += s[i] * (1 - gl);
    }
  });
  for (const x of [L, R]) {
    lp(x, sr, (t) => 900 + 1400 * Math.min(1, t / 0.8) + vel * 600, 0.6);
    peak(x, sr, 2400, 1.2, -4);
    env(x, sr, (t) => Math.min(1, t / 0.45) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.35)));
  }
  return [fades(L, sr, 1, 20), fades(R, sr, 1, 20)];
}

// ---------------------------------------------------------------- brushed kit

const RIDE = [1, 1.47, 2.09, 2.56, 2.98, 3.71, 4.23, 4.87, 5.6, 6.62, 7.4, 8.9, 10.3, 11.7];
function ride(sr, v, vel, dur, r) {
  const x = new Float32Array(Math.floor(2.4 * sr));
  const f0 = 340 + v * 7;
  modal(x, sr, RIDE.map((k, i) => [f0 * k * (1 + (r() - 0.5) * 0.01), (0.5 + r() * 0.5) / (1 + i * 0.15), 0.6 + r() * 1.4]), 0, 0.05, r);
  const w = noise(x.length, r); // wash
  hp(w, sr, 5500, 0.7);
  env(w, sr, (t) => 0.22 * Math.exp(-t / 0.5));
  const k = noise(Math.floor(0.02 * sr), r); // stick ping
  bp(k, sr, 5200, 2);
  env(k, sr, (t) => Math.exp(-t / 0.003));
  for (let i = 0; i < x.length; i++) x[i] += w[i] + (i < k.length ? k[i] * 0.6 : 0);
  hp(x, sr, 400, 0.7);
  return [fades(x, sr, 0.3, 60)];
}

function tap(sr, v, vel, dur, r) {
  const x = noise(Math.floor(0.35 * sr), r);
  const wires = x.slice();
  hp(x, sr, 1400, 0.7);
  env(x, sr, (t) => Math.min(1, t / 0.002) * Math.exp(-t / (0.035 + v * 0.01)));
  bp(wires, sr, 3200 + v * 300, 0.6);
  env(wires, sr, (t) => 0.5 * Math.exp(-t / 0.11));
  modal(x, sr, [[185, 0.35, 0.05], [330, 0.15, 0.03]], 0, 1, r); // drum head
  for (let i = 0; i < x.length; i++) x[i] += wires[i];
  return [fades(x, sr, 0.3, 40)];
}

function swish(sr, v, vel, dur, r) {
  const len = 0.35 + v * 0.1;
  const x = noise(Math.floor(len * sr), r);
  bp(x, sr, (t) => 3000 + 2500 * (t / len), 0.7);
  hp(x, sr, 1500, 0.7);
  env(x, sr, (t) => Math.sin(Math.PI * Math.pow(t / len, 0.6)) ** 2);
  return [fades(x, sr, 1, 10)];
}

function kick(sr, v, vel, dur, r) {
  const x = new Float32Array(Math.floor(0.45 * sr));
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / sr;
    ph += (TAU * (52 + 45 * Math.exp(-t / 0.03))) / sr;
    x[i] = Math.sin(ph) * Math.exp(-t / 0.2);
  }
  const c = noise(Math.floor(0.01 * sr), r);
  lp(c, sr, 1500, 0.7);
  for (let i = 0; i < c.length; i++) x[i] += c[i] * 0.2 * (1 - i / c.length);
  return [fades(dcBlock(x), sr, 0.3, 30)];
}

function hat(sr, v, vel, dur, r) {
  const x = noise(Math.floor(0.12 * sr), r);
  bp(x, sr, 7500 + v * 400, 1.2);
  env(x, sr, (t) => Math.min(1, t / 0.003) * Math.exp(-t / 0.028));
  modal(x, sr, [[3150, 0.08, 0.03], [5320, 0.06, 0.025]], 0, 1, r);
  return [fades(x, sr, 0.2, 20)];
}

function rim(sr, v, vel, dur, r) {
  const x = new Float32Array(Math.floor(0.2 * sr));
  modal(x, sr, [[1720, 0.6, 0.025], [820, 0.4, 0.03], [3900, 0.2, 0.012]], 0, 1, r);
  const c = noise(Math.floor(0.008 * sr), r);
  bp(c, sr, 3500, 1);
  for (let i = 0; i < c.length; i++) x[i] += c[i] * 0.5 * (1 - i / c.length);
  return [fades(x, sr, 0.2, 20)];
}

function shaker(sr, v, vel, dur, r) {
  const len = 0.11;
  const x = noise(Math.floor(len * sr), r);
  bp(x, sr, 6200, 0.9);
  env(x, sr, (t) => Math.sin(Math.PI * Math.min(1, t / len)) ** 3);
  return [fades(x, sr, 0.2, 10)];
}

// ---------------------------------------------------------------- registry + cache

/**
 * key: instrument id → { render(sr, midiOrVariant, vel, durSec, rand), sustain (render depends
 * on duration), drum (midi arg is a variant 0..2) }.
 */
export const INSTRUMENTS = {
  rhodes: { render: rhodes },
  vibes: { render: vibes },
  bass: { render: bass },
  guitar: { render: guitar },
  trumpet: { render: trumpet, sustain: true },
  steel: { render: steel, sustain: true },
  pad: { render: pad, sustain: true },
  ride: { render: ride, drum: true },
  tap: { render: tap, drum: true },
  swish: { render: swish, drum: true },
  kick: { render: kick, drum: true },
  hat: { render: hat, drum: true },
  rim: { render: rim, drum: true },
  shaker: { render: shaker, drum: true },
};

const cache = new Map();

/**
 * Cached AudioBuffer for a note. Velocity is bucketed to 4 timbres, sustained lengths to 1/4 s,
 * drum variants to 0..2 — a typical track settles at ~150 buffers after its first chorus.
 */
export function noteBuffer(ctx, inst, midi, vel, dur = 1) {
  const I = INSTRUMENTS[inst];
  if (!I) return null;
  const vb = clamp(Math.round(vel * 4), 1, 4) / 4;
  const db = I.sustain ? clamp(Math.ceil(dur * 4) / 4, 0.25, 8) : 0;
  const m = I.drum ? Math.abs(Math.round(midi)) % 3 : Math.round(midi);
  const key = `${ctx.sampleRate}|${inst}|${m}|${vb}|${db}`;
  let b = cache.get(key);
  if (!b) {
    const chs = norm(I.render(ctx.sampleRate, m, vb, db, rng(m * 7919 + vb * 131 + inst.length)));
    const sr = ctx.sampleRate;
    const [L, R] = chs;
    b = R
      ? synth(ctx, L.length / sr, (t, i) => [L[i] || 0, R[i] || 0], { stereo: true })
      : synth(ctx, L.length / sr, (t, i) => L[i] || 0);
    cache.set(key, b);
  }
  return b;
}

/** Raw render (for tests / spectrogram previews). */
export function renderNote(sr, inst, midi, vel = 0.7, dur = 1) {
  const I = INSTRUMENTS[inst];
  return norm(I.render(sr, midi, vel, dur, rng(midi + 1)));
}
