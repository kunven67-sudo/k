// Telephone network tones for the Calling… screen (North American standards).

import { audio, synth } from '../../core/audio.js';

const TAU = Math.PI * 2;

// Ringback: 440 + 480 Hz, 2 s on / 4 s off — two rings.
audio.define('life.ringback', (ctx) =>
  synth(ctx, 7, (t) => {
    const c = t % 6;
    if (c > 2) return 0;
    const e = Math.min(1, c * 40, (2 - c) * 40);
    return (Math.sin(TAU * 440 * t) + Math.sin(TAU * 480 * t)) * 0.22 * e;
  }),
);

// Special Information Tones (913.8, 1370.6, 1776.7 Hz) — "the number you have dialed…".
audio.define('life.sit', (ctx) => {
  const f = [913.8, 1370.6, 1776.7];
  const d = [0.274, 0.274, 0.38];
  return synth(ctx, 1.0, (t) => {
    let s = 0;
    for (let i = 0; i < 3; i++) {
      const tt = t - s;
      if (tt >= 0 && tt < d[i]) return Math.sin(TAU * f[i] * t) * 0.3 * Math.min(1, tt * 200, (d[i] - tt) * 200);
      s += d[i];
    }
    return 0;
  });
});
