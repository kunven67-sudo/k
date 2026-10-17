// Suburban ambience for REAL LIFE: daytime songbirds over a soft breeze (Ohio backyard in
// spring/summer), a far-off dog now and then. Two independent stereo layers so it feels wide.

import { loopShot, buf, pink, lp, hp, env, mix, TAU } from '../dsp.js';

/** One bird phrase: a few fast frequency-swept chirps (robin / sparrow-ish). */
function chirps(sr, r, at, out) {
  const kind = r();
  const n = 2 + Math.floor(r() * 5);
  const base = 2400 + r() * 2600;
  let t = at;
  for (let k = 0; k < n; k++) {
    const dur = kind < 0.5 ? 0.05 + r() * 0.06 : 0.12 + r() * 0.1;
    const f0 = base * (0.85 + r() * 0.35);
    const sweep = (r() - 0.4) * 1800;
    const len = Math.floor(dur * sr);
    const s0 = Math.floor(t * sr);
    let ph = 0;
    for (let i = 0; i < len && s0 + i < out.length; i++) {
      const u = i / len;
      const f = f0 + sweep * u + Math.sin(u * TAU * (kind < 0.5 ? 2 : 9)) * 160;
      ph += (TAU * f) / sr;
      const e = Math.sin(Math.PI * u) ** 1.5;
      out[s0 + i] += Math.sin(ph) * e * 0.35;
    }
    t += dur + 0.03 + r() * (kind < 0.5 ? 0.05 : 0.12);
  }
}

function bark(sr, r, at, out) {
  // Distant dog: two muffled formant thumps.
  for (let k = 0; k < 2; k++) {
    const s0 = Math.floor((at + k * 0.32) * sr);
    const len = Math.floor(0.14 * sr);
    let ph = 0;
    for (let i = 0; i < len && s0 + i < out.length; i++) {
      const u = i / len;
      ph += (TAU * (520 - 220 * u)) / sr;
      out[s0 + i] += (Math.sin(ph) + 0.4 * Math.sin(ph * 2.1)) * Math.exp(-u * 4) * 0.12;
    }
  }
}

loopShot('amb.birds', (sr, r) => {
  const T = 12 + 1;
  const layer = () => {
    const x = pink(Math.floor(T * sr), r);
    lp(x, sr, 900);
    env(x, sr, (t) => 0.05 + 0.03 * Math.sin(t * 0.6));
    const birds = buf(T, sr);
    for (let t = 0.2; t < T - 1; t += 0.6 + r() * 1.8) chirps(sr, r, t, birds);
    hp(birds, sr, 1500);
    lp(birds, sr, 7000); // a bit away, through the leaves
    mix(x, birds, sr, 0, 0.8);
    if (r() < 0.6) {
      const dog = buf(T, sr);
      bark(sr, r, 2 + r() * (T - 4), dog);
      lp(dog, sr, 1200);
      mix(x, dog, sr, 0, 1);
    }
    return x;
  };
  return [layer(), layer()];
}, { db: -16, xf: 1, group: 'amb' });
