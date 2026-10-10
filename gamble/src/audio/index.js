// Audio module entry: registers every procedural sound name from ARCHITECTURE.md §5 and exports
// the music engine plus a few conveniences.
//
//   import { music, playStep, prewarm } from './audio/index.js';
//   playStep('tile', { position, gain });    // random variant, ±8% rate jitter
//   music.play('menu-lounge', { fade: 2 });
//   prewarm(['amb.casino', 'amb.city']);     // build heavy buffers in idle time before needed

import { audio } from '../core/audio.js';
import { catalog } from './dsp.js';
import './sfx/casino.js';
import './sfx/ui.js';
import { SURFACES } from './sfx/steps.js';
import './sfx/doors.js';
import './sfx/home.js';
import './sfx/bath.js';
import './sfx/body.js';
import './sfx/phone.js';
import './sfx/ambience.js';
import './sfx/city.js';
import './sfx/splash.js';
import { music } from './music/index.js';

export { music, catalog, SURFACES };

let lastVariant = {};

/**
 * Play one footstep on `surface` (see SURFACES). Picks a random variant (never the same one
 * twice in a row) and jitters playback rate ±8% and gain ±10%. opts are passed to audio.play.
 * Unknown surfaces fall back to concrete.
 */
export function playStep(surface, opts = {}) {
  const s = SURFACES.includes(surface) ? surface : 'concrete';
  let v = 1 + Math.floor(Math.random() * 4);
  if (v === lastVariant[s]) v = (v % 4) + 1;
  lastVariant[s] = v;
  return audio.play(`step.${s}.${v}`, {
    ...opts,
    rate: (opts.rate ?? 1) * (0.92 + Math.random() * 0.16),
    gain: (opts.gain ?? 1) * (0.9 + Math.random() * 0.2),
  });
}

/**
 * Build buffers ahead of time without jank: one sound per idle slice. Heavy ambience beds take
 * 0.2-0.8 s each to synthesise, so call this on loading screens / state enter. Returns a
 * Promise that resolves when all are cached.
 */
export function prewarm(names) {
  const queue = [...names];
  const idle = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 16));
  return new Promise((resolve) => {
    const step = () => {
      const n = queue.shift();
      if (!n) return resolve();
      try {
        audio.buffer(n);
      } catch (e) {
        console.warn('[audio] prewarm failed', n, e);
      }
      idle(step);
    };
    idle(step);
  });
}

/** All registered names (for dev tools / validation). */
export const soundNames = () => catalog.map((c) => c.name);
