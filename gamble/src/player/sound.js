// Optional audio glue for the player / world state. The audio module may be absent or partly
// built (another agent owns it), so everything here degrades to silence instead of throwing.
//
//   await loadSound();            // registers sfx names, returns { playStep, music }
//   step(surface, opts)           // footstep on a surface family
//   sfx(name, opts)               // one-shot / loop through the core engine (null on failure)
//   muffle(amount)                // 0..1 lowpass on the master bus (hangover ears)
import { audio } from '../core/audio.js';

let mod = null;
let tried = null;

export function loadSound() {
  if (tried) return tried;
  tried = (async () => {
    try {
      mod = await import('../audio/index.js');
    } catch {
      // Entry point unavailable (e.g. music engine missing): register what we can piecemeal.
      mod = {};
      for (const f of ['steps', 'doors', 'home', 'body', 'ambience', 'city']) {
        try {
          const m = await import(`../audio/sfx/${f}.js`);
          if (m.SURFACES) mod.SURFACES = m.SURFACES;
        } catch {
          /* piece missing */
        }
      }
    }
    return mod;
  })();
  return tried;
}

export function step(surface, opts = {}) {
  try {
    if (mod?.playStep) return mod.playStep(surface, opts);
    const v = 1 + Math.floor(Math.random() * 4);
    return audio.play(`step.${surface}.${v}`, { ...opts, rate: 0.92 + Math.random() * 0.16 });
  } catch {
    return null;
  }
}

export function sfx(name, opts = {}) {
  try {
    return audio.play(name, opts) || null;
  } catch {
    return null;
  }
}

export function music() {
  return mod?.music || null;
}

// Hangover ears: splice a lowpass between the master gain and the limiter (runtime only).
let lp = null;
export function muffle(amount) {
  const ctx = audio.ctx;
  if (!ctx || !audio.master || !audio.limiter) return;
  try {
    if (!lp && amount > 0.001) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.4;
      audio.master.disconnect();
      audio.master.connect(lp).connect(audio.limiter);
    }
    if (!lp) return;
    const f = 20000 * Math.pow(400 / 20000, Math.min(1, Math.max(0, amount)));
    lp.frequency.setTargetAtTime(f, ctx.currentTime, 0.1);
    if (amount <= 0.001) {
      audio.master.disconnect();
      audio.master.connect(audio.limiter);
      lp.disconnect();
      lp = null;
    }
  } catch {
    lp = null;
  }
}
