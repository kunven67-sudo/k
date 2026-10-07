// Offline DSP toolkit for procedural sound design.
//
// Every sound in GAMBLE is rendered once into a Float32Array with these helpers, then wrapped
// into an AudioBuffer via core synth(). Nothing here runs per-frame; it only runs the first
// time a sound is requested, so clarity beats micro-optimisation (but loops stay O(n)).
//
// Conventions: `x` is a Float32Array of samples, `sr` the sample rate, times in seconds.

import { audio, synth } from '../core/audio.js';

export const TAU = Math.PI * 2;

/** Deterministic PRNG (mulberry32) so every build of a sound is identical. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Allocate `sec` seconds of silence. */
export const buf = (sec, sr) => new Float32Array(Math.max(1, Math.floor(sec * sr)));

/** White noise in [-1, 1]. */
export function noise(n, r = Math.random) {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}

/** Pink-ish noise (Paul Kellet's economy filter) — softer, more natural than white. */
export function pink(n, r = Math.random) {
  const x = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    x[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
  }
  return x;
}

/** Brown noise (integrated white) — rumble, HVAC, distant traffic. */
export function brown(n, r = Math.random) {
  const x = new Float32Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    v = (v + (r() * 2 - 1) * 0.02) * 0.998;
    x[i] = v * 3.5;
  }
  return x;
}

// RBJ cookbook biquad coefficients → [b0, b1, b2, a1, a2] normalised by a0.
function coefs(type, f, q, sr, gainDb) {
  const w0 = (TAU * Math.min(Math.max(f, 10), sr * 0.49)) / sr;
  const c = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp':
      b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
      break;
    case 'hp':
      b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
      break;
    case 'bp': // constant 0 dB peak gain
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
      break;
    case 'peak': {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + alpha * A; b1 = -2 * c; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * c; a2 = 1 - alpha / A;
      break;
    }
    default:
      throw new Error('biquad type ' + type);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/**
 * Filter `x` in place with a biquad. `f` may be a number or a function (t) => Hz for sweeps
 * (coefficients refreshed every 32 samples). Returns x.
 */
export function biquad(x, sr, type, f, q = 0.707, gainDb = 0) {
  const sweep = typeof f === 'function';
  let [b0, b1, b2, a1, a2] = coefs(type, sweep ? f(0) : f, q, sr, gainDb);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (sweep && (i & 31) === 0) [b0, b1, b2, a1, a2] = coefs(type, f(i / sr), q, sr, gainDb);
    const v = x[i];
    const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

export const lp = (x, sr, f, q) => biquad(x, sr, 'lp', f, q);
export const hp = (x, sr, f, q) => biquad(x, sr, 'hp', f, q);
export const bp = (x, sr, f, q) => biquad(x, sr, 'bp', f, q);
export const peak = (x, sr, f, q, db) => biquad(x, sr, 'peak', f, q, db);

/** One-pole lowpass, cheap smoothing (e.g. envelopes, darker noise). */
export function onepole(x, sr, f) {
  const a = Math.exp((-TAU * f) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y = x[i] * (1 - a) + y * a;
  return x;
}

/** Multiply by an envelope function env(t, i). */
export function env(x, sr, fn) {
  for (let i = 0; i < x.length; i++) x[i] *= fn(i / sr, i);
  return x;
}

/** Attack/exp-decay envelope multiplier: linear rise over `a` s, then e^(-t/d). */
export const ad = (a, d) => (t) => (t < a ? t / a : Math.exp(-(t - a) / d));

/** Add `src` into `dst` starting at time `at` (seconds) with gain `g`. */
export function mix(dst, src, sr, at = 0, g = 1) {
  const o = Math.floor(at * sr);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[o + i] += src[i] * g;
  return dst;
}

/**
 * Modal synthesis: add a struck resonator to `x`. `modes` = [[freqHz, amp, decaySec], ...].
 * Each mode is a decaying sinusoid with a tiny random phase; `at` = strike time (s).
 */
export function modal(x, sr, modes, at = 0, gain = 1, r = Math.random) {
  const o = Math.floor(at * sr);
  for (const [f, a, d] of modes) {
    if (f >= sr * 0.48) continue;
    const w = (TAU * f) / sr;
    const k = Math.exp(-1 / (d * sr));
    // Recursive oscillator: cheaper than calling sin() per sample.
    let s0 = Math.sin(r() * 0.3), s1 = Math.sin(r() * 0.3 - w);
    const c2 = 2 * Math.cos(w);
    let amp = a * gain;
    const n = Math.min(x.length - o, Math.ceil(d * sr * 7));
    for (let i = 0; i < n; i++) {
      const s = c2 * s0 - s1;
      s1 = s0; s0 = s;
      x[o + i] += s * amp;
      amp *= k;
    }
  }
  return x;
}

/** A short filtered noise burst (the "click" / contact transient of an impact). */
export function burst(sr, dur, f, q = 1, r = Math.random, type = 'bp') {
  const x = noise(Math.floor(dur * sr), r);
  biquad(x, sr, type, f, q);
  return env(x, sr, (t) => Math.exp(-t / (dur * 0.25)));
}

/** Soft saturation (tanh-ish) for warmth / speaker breakup. */
export function drive(x, amt = 2) {
  const n = Math.tanh(amt);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * amt) / n;
  return x;
}

/** Linear fades at both ends (default 5 ms) to kill clicks. */
export function fades(x, sr, inMs = 5, outMs = 5) {
  const a = Math.min(x.length, Math.floor((inMs / 1000) * sr));
  const b = Math.min(x.length, Math.floor((outMs / 1000) * sr));
  for (let i = 0; i < a; i++) x[i] *= i / a;
  for (let i = 0; i < b; i++) x[x.length - 1 - i] *= i / b;
  return x;
}

/** Remove DC offset (mean). */
export function dcBlock(x) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m += x[i];
  m /= x.length;
  for (let i = 0; i < x.length; i++) x[i] -= m;
  return x;
}

/** Scale channels jointly so the absolute peak hits `db` dBFS. */
export function normalize(chs, db = -3) {
  let p = 1e-9;
  for (const x of chs) for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  const g = Math.pow(10, db / 20) / p;
  for (const x of chs) for (let i = 0; i < x.length; i++) x[i] *= g;
  return chs;
}

/**
 * Make a seamless loop: the last `xf` seconds are equal-power crossfaded into the head and the
 * tail is cut off, so sample N-1 flows straight into sample 0.
 */
export function loopify(x, sr, xf = 0.5) {
  const n = Math.floor(xf * sr);
  const len = x.length - n;
  const out = x.slice(0, len);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    out[i] = x[i] * Math.sin(p * Math.PI * 0.5) + x[len + i] * Math.cos(p * Math.PI * 0.5);
  }
  return out;
}

/**
 * Tiny Schroeder reverb (4 combs + 2 allpasses) for baked-in "space" on sounds that should
 * carry their own environment (distant sirens, hallway bangs). Returns a new wet array.
 */
export function verb(x, sr, size = 0.5, damp = 0.4) {
  const y = new Float32Array(x.length);
  const combs = [1116, 1188, 1277, 1356].map((d) => Math.floor(d * (sr / 44100) * (0.4 + size)));
  const fb = 0.7 + size * 0.25;
  for (const d of combs) {
    const line = new Float32Array(d);
    let p = 0, f = 0;
    for (let i = 0; i < x.length; i++) {
      const o = line[p];
      f = o * (1 - damp) + f * damp;
      line[p] = x[i] + f * fb;
      p = (p + 1) % d;
      y[i] += o * 0.25;
    }
  }
  for (const d of [556, 441].map((d) => Math.floor((d * sr) / 44100))) {
    const line = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < y.length; i++) {
      const b = line[p];
      const v = y[i] + b * 0.5;
      line[p] = v;
      y[i] = b - v * 0.5;
      p = (p + 1) % d;
    }
  }
  return y;
}

/** Wrap Float32Array channel(s) into an AudioBuffer via core synth(). */
export function toBuffer(ctx, chs) {
  const sr = ctx.sampleRate;
  const [L, R] = chs;
  if (!R) return synth(ctx, L.length / sr + 0.5 / sr, (t, i) => L[i] || 0);
  return synth(ctx, L.length / sr + 0.5 / sr, (t, i) => [L[i] || 0, R[i] || 0], { stereo: true });
}

const asChannels = (out) => (out instanceof Float32Array ? [out] : out);

// Registry of everything we define (name → { kind, group }) — used by the dev audition board.
export const catalog = [];

/**
 * Define a one-shot. render(sr, r) returns Float32Array or [L, R]. Post: DC removal, 5 ms
 * fades, peak-normalise to `db` (default -3 dBFS).
 */
export function oneShot(name, render, { db = -3, seed, group } = {}) {
  catalog.push({ name, loop: false, group: group || name.split('.')[0] });
  audio.define(name, (ctx) => {
    const sr = ctx.sampleRate;
    const chs = asChannels(render(sr, rng(seed ?? hashStr(name))));
    for (const x of chs) fades(dcBlock(x), sr, 2, 5);
    return toBuffer(ctx, normalize(chs, db));
  });
}

/**
 * Define a seamless loop. render(sr, r) returns `sec + xf` seconds of material; the tail is
 * crossfaded into the head. Ambience loops default to -12 dBFS, mechanical loops can go louder.
 */
export function loopShot(name, render, { db = -12, xf = 0.6, seed, group } = {}) {
  catalog.push({ name, loop: true, group: group || name.split('.')[0] });
  audio.define(name, (ctx) => {
    const sr = ctx.sampleRate;
    const chs = asChannels(render(sr, rng(seed ?? hashStr(name)))).map((x) => loopify(dcBlock(x), sr, xf));
    return toBuffer(ctx, normalize(chs, db));
  });
}

/** Stable string hash for default seeds. */
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Convenience: fill a buffer with fn(t) samples. */
export function gen(sec, sr, fn) {
  const x = buf(sec, sr);
  for (let i = 0; i < x.length; i++) x[i] = fn(i / sr, i);
  return x;
}

/** Smooth random control signal (value noise) at `hz` changes per second, range [0,1]. */
export function wander(sec, sr, hz, r = Math.random) {
  const pts = Math.ceil(sec * hz) + 3;
  const v = Array.from({ length: pts }, () => r());
  return (t) => {
    const p = t * hz;
    const i = Math.floor(p);
    const f = p - i;
    const s = f * f * (3 - 2 * f);
    return v[i % pts] * (1 - s) + v[(i + 1) % pts] * s;
  };
}

/** MIDI note → Hz. */
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Linear-interpolating upsample by an integer factor (pair with a lowpass afterwards). */
export function upsample(x, factor) {
  const y = new Float32Array(x.length * factor);
  for (let i = 0; i < x.length; i++) {
    const a = x[i], b = i + 1 < x.length ? x[i + 1] : a;
    for (let k = 0; k < factor; k++) y[i * factor + k] = a + (b - a) * (k / factor);
  }
  return y;
}
