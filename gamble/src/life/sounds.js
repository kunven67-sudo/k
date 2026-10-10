// A few body sounds the shared sound list doesn't have (ARCHITECTURE §5 names are used first).
// All procedural; each buffer is built lazily the first time it plays.

import { audio, synth } from '../core/audio.js';

const TAU = Math.PI * 2;
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// Dry swallow: a soft throat click, then a low muscular "glunk" with a dry tail.
audio.define('life.swallow', (ctx) => {
  let lp = 0;
  return synth(ctx, 0.55, (t) => {
    const n = Math.random() * 2 - 1;
    lp += (n - lp) * 0.08;
    const click = t > 0.06 && t < 0.075 ? n * 0.6 * (1 - (t - 0.06) / 0.015) : 0;
    const gl = t > 0.12 ? Math.sin(TAU * (150 - 70 * (t - 0.12)) * t) * env(t - 0.12, 0.02, 0.07) * 0.5 : 0;
    const dry = lp * env(t - 0.2, 0.05, 0.12) * (t > 0.2 ? 0.35 : 0);
    return click + gl + dry;
  });
});

// Chattering teeth (cold): fast irregular clicks.
audio.define('life.chatter', (ctx) => {
  const hits = [];
  for (let x = 0; x < 1.2; x += 0.045 + Math.random() * 0.03) hits.push(x);
  return synth(ctx, 1.3, (t) => {
    let v = 0;
    for (const h of hits) {
      const d = t - h;
      if (d >= 0 && d < 0.012) v += (Math.random() * 2 - 1) * (1 - d / 0.012) * 0.35 * Math.sin(TAU * 2600 * d);
    }
    return v * (t < 1.0 ? 1 : (1.3 - t) / 0.3);
  });
});

// Trickle (the bladder gave up): band-limited noise with a wobbling filter.
audio.define('life.trickle', (ctx) => {
  let a = 0;
  let b = 0;
  return synth(ctx, 4.5, (t) => {
    const n = Math.random() * 2 - 1;
    const f = 0.18 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 7.3);
    a += (n - a) * f;
    b += (a - b) * f;
    const amp = Math.min(1, t * 4) * Math.min(1, (4.5 - t) / 1.2) * (0.7 + 0.3 * Math.sin(t * 31));
    return (a - b) * 2.4 * amp;
  });
});

// Phone fallbacks in case the shared audio module hasn't defined them (dev pages, etc.).
if (!audio.generators?.has('phone.tap')) {
  audio.define('phone.tap', (ctx) => synth(ctx, 0.04, (t) => Math.sin(TAU * 1800 * t) * Math.exp(-t * 160) * 0.3));
}
if (!audio.generators?.has('phone.camera')) {
  audio.define('phone.camera', (ctx) =>
    synth(ctx, 0.25, (t) => (Math.random() * 2 - 1) * (env(t, 0.002, 0.02) + (t > 0.09 ? env(t - 0.09, 0.002, 0.03) : 0)) * 0.5),
  );
}
if (!audio.generators?.has('phone.unlock')) {
  audio.define('phone.unlock', (ctx) => synth(ctx, 0.12, (t) => Math.sin(TAU * (900 + t * 3000) * t) * Math.exp(-t * 30) * 0.25));
}
if (!audio.generators?.has('phone.lock')) {
  audio.define('phone.lock', (ctx) => synth(ctx, 0.08, (t) => (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.4));
}
if (!audio.generators?.has('phone.vibrate')) {
  audio.define('phone.vibrate', (ctx) => synth(ctx, 0.9, (t) => Math.sin(TAU * 170 * t) * (Math.sin(TAU * 2.2 * t) > 0 ? 0.35 : 0)));
}

/** Play a sound if the audio engine is alive; never throws. */
export function sfx(name, opts) {
  try {
    return audio.play(name, opts);
  } catch {
    return null;
  }
}
