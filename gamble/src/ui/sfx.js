// UI sound helper. Feature code calls the contract names from ARCHITECTURE §5 ('ui.click',
// 'slot.lever', 'splash.dice-land'…). The audio module (src/audio) owns those sounds; until it is
// present — or if it lacks a name — we fall back to small procedural sounds defined here under a
// private prefix, so the front end is never silent and never spams "unknown sound" warnings.
//
//   uiSound('ui.click', { rate: 1.05 })   → handle | null
//
// Nothing plays before the first user gesture unlocks audio (avoids autoplay warnings).

import { audio, synth } from '../core/audio.js';

const FALLBACK = '__ui.';
const TAU = Math.PI * 2;

// Tiny deterministic noise so fallback buffers sound identical every launch.
function noiseGen(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

// One-pole filters used by several generators.
function lowpass(alpha) {
  let y = 0;
  return (x) => (y += (x - y) * alpha);
}

const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

const defs = {
  'ui.hover': (ctx) => synth(ctx, 0.07, (t) => Math.sin(TAU * 2400 * t) * env(t, 0.002, 0.012) * 0.18),
  'ui.click': (ctx) => {
    const n = noiseGen(3);
    const lp = lowpass(0.35);
    return synth(ctx, 0.12, (t) => (lp(n()) * 0.7 + Math.sin(TAU * 1800 * t) * 0.4) * env(t, 0.001, 0.018) * 0.5);
  },
  'ui.back': (ctx) => synth(ctx, 0.16, (t) => Math.sin(TAU * (900 - t * 2500) * t) * env(t, 0.002, 0.04) * 0.3),
  'ui.confirm': (ctx) =>
    synth(ctx, 0.5, (t) => (Math.sin(TAU * 880 * t) * env(t, 0.003, 0.12) + Math.sin(TAU * 1320 * Math.max(0, t - 0.08)) * (t > 0.08 ? env(t - 0.08, 0.003, 0.18) : 0)) * 0.22),
  'ui.error': (ctx) => synth(ctx, 0.3, (t) => Math.sign(Math.sin(TAU * 150 * t)) * env(t, 0.004, 0.08) * 0.12),
  'ui.toggle': (ctx) => {
    const n = noiseGen(7);
    return synth(ctx, 0.08, (t) => (n() * 0.5 + Math.sin(TAU * 3200 * t) * 0.5) * env(t, 0.0005, 0.008) * 0.45);
  },
  'ui.slider': (ctx) => synth(ctx, 0.04, (t) => Math.sin(TAU * 4200 * t) * env(t, 0.0005, 0.006) * 0.15),
  // Clay chip landing on felt: a dull knock plus a short ceramic ring.
  'ui.chip-place': (ctx) => {
    const n = noiseGen(11);
    const lp = lowpass(0.2);
    return synth(ctx, 0.2, (t) => (lp(n()) * env(t, 0.0008, 0.012) * 1.2 + Math.sin(TAU * 2900 * t) * env(t, 0.001, 0.03) * 0.25 + Math.sin(TAU * 4700 * t) * env(t, 0.001, 0.02) * 0.12) * 0.6);
  },
  'ui.card-flip': (ctx) => {
    const n = noiseGen(13);
    const lp = lowpass(0.5);
    return synth(ctx, 0.14, (t) => lp(n()) * Math.sin(Math.min(1, t / 0.11) * Math.PI) * 0.35 * (1 - t / 0.14));
  },
  'ui.whoosh': (ctx) => {
    const n = noiseGen(17);
    let y = 0;
    return synth(ctx, 0.45, (t) => {
      const a = 0.02 + 0.25 * Math.sin((t / 0.45) * Math.PI);
      y += (n() - y) * a;
      return y * Math.sin((t / 0.45) * Math.PI) * 0.6;
    });
  },
  'ui.paper': (ctx) => {
    const n = noiseGen(19);
    const lp = lowpass(0.6);
    return synth(ctx, 0.35, (t) => lp(n()) * (0.5 + 0.5 * Math.sin(t * 90)) * env(t, 0.02, 0.12) * 0.3);
  },
  'slot.button': (ctx) => {
    const n = noiseGen(23);
    const lp = lowpass(0.25);
    return synth(ctx, 0.14, (t) => (lp(n()) * env(t, 0.0005, 0.01) + Math.sin(TAU * 620 * t) * env(t, 0.001, 0.03) * 0.5) * 0.55);
  },
  // Lever: ratcheting clicks on the pull, then a heavy clunk.
  'slot.lever': (ctx) => {
    const n = noiseGen(29);
    const lp = lowpass(0.3);
    return synth(ctx, 0.75, (t) => {
      let v = 0;
      const k = Math.floor(t / 0.045);
      const tt = t - k * 0.045;
      if (t < 0.45) v += n() * env(tt, 0.0005, 0.004) * 0.4;
      if (t > 0.5) v += (lp(n()) * 1.4 + Math.sin(TAU * 90 * t) * 0.6) * env(t - 0.5, 0.002, 0.05);
      return v * 0.6;
    });
  },
  'slot.reel-spin': (ctx) => {
    const n = noiseGen(31);
    const lp = lowpass(0.15);
    return synth(ctx, 0.5, (t) => {
      const tick = (t * 24) % 1;
      return (lp(n()) * 0.25 + n() * Math.exp(-tick * 30) * 0.18) * 0.5;
    });
  },
  'slot.reel-stop': (ctx) => {
    const n = noiseGen(37);
    const lp = lowpass(0.18);
    return synth(ctx, 0.22, (t) => (lp(n()) * 1.3 + Math.sin(TAU * 140 * t) * 0.5) * env(t, 0.001, 0.035) * 0.55);
  },
  'slot.ding': (ctx) =>
    synth(ctx, 1.4, (t) => (Math.sin(TAU * 1568 * t) + 0.5 * Math.sin(TAU * 3136 * t) + 0.25 * Math.sin(TAU * 4704 * t)) * env(t, 0.002, 0.4) * 0.18),
  'slot.win-small': (ctx) => {
    const notes = [784, 988, 1175, 1568];
    return synth(ctx, 0.9, (t) => {
      const i = Math.min(3, Math.floor(t / 0.11));
      const tt = t - i * 0.11;
      return Math.sin(TAU * notes[i] * t) * env(tt, 0.002, 0.09) * 0.2;
    });
  },
  'slot.win-big': (ctx) => {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    return synth(ctx, 1.8, (t) => {
      const i = Math.min(7, Math.floor(t / 0.12));
      const tt = t - i * 0.12;
      const f = notes[i];
      return (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t)) * env(tt, 0.002, i === 7 ? 0.5 : 0.1) * 0.16;
    });
  },
  'coins.drop': (ctx) => {
    const n = noiseGen(41);
    return synth(ctx, 1.2, (t) => {
      let v = 0;
      for (let k = 0; k < 9; k++) {
        const at = k * 0.09 + (k % 3) * 0.021;
        if (t > at) {
          const tt = t - at;
          const f = 3200 + ((k * 977) % 2100);
          v += (Math.sin(TAU * f * tt) * 0.6 + Math.sin(TAU * f * 1.48 * tt) * 0.4) * env(tt, 0.0005, 0.05 + (k % 4) * 0.02) * 0.14;
        }
      }
      return v + n() * 0.004;
    });
  },
  // Dice: a bright bone-on-felt knock, and a rolling chatter.
  'dice.hit-felt': (ctx) => {
    const n = noiseGen(43);
    const lp = lowpass(0.4);
    return synth(ctx, 0.12, (t) => (lp(n()) * 0.8 + Math.sin(TAU * 1150 * t) * 0.6 + Math.sin(TAU * 2630 * t) * 0.3) * env(t, 0.0004, 0.012) * 0.5);
  },
  'splash.dice-roll': (ctx) => {
    const n = noiseGen(47);
    const lp = lowpass(0.35);
    const hits = [0, 0.13, 0.21, 0.36, 0.44, 0.58, 0.66, 0.83];
    return synth(ctx, 1.1, (t) => {
      let v = lp(n()) * 0.04 * Math.max(0, 1 - t);
      for (let k = 0; k < hits.length; k++) {
        const tt = t - hits[k];
        if (tt > 0 && tt < 0.08) v += (Math.sin(TAU * (1000 + k * 110) * tt) * 0.5 + n() * 0.3) * env(tt, 0.0004, 0.01) * (0.6 - k * 0.05);
      }
      return v * 0.6;
    });
  },
  'splash.dice-land': (ctx) => {
    const n = noiseGen(53);
    const lp = lowpass(0.3);
    return synth(ctx, 0.5, (t) => (lp(n()) * 0.9 + Math.sin(TAU * 1220 * t) * 0.7 + Math.sin(TAU * 2410 * t) * 0.3 + Math.sin(TAU * 95 * t) * 0.6) * env(t, 0.0005, 0.03) * 0.55);
  },
  // Neon transformer: mains hum with buzzy harmonics (loop-safe length: whole 60 Hz cycles).
  'neon.buzz': (ctx) => synth(ctx, 1.0, (t) => (Math.sin(TAU * 120 * t) * 0.5 + Math.sign(Math.sin(TAU * 120 * t)) * 0.12 + Math.sin(TAU * 360 * t) * 0.15) * 0.08),
  'logo.neon-on': (ctx) => {
    const n = noiseGen(59);
    return synth(ctx, 0.35, (t) => (n() * env(t, 0.001, 0.02) * 0.6 + Math.sin(TAU * 120 * t) * env(t, 0.01, 0.2) * 0.4) * 0.5);
  },
  'logo.coins': (ctx) => defs['coins.drop'](ctx),
  'logo.cards': (ctx) => defs['ui.card-flip'](ctx),
  'logo.reels': (ctx) => defs['slot.reel-stop'](ctx),
  'slot.jackpot-siren': (ctx) => synth(ctx, 1.0, (t) => Math.sin(TAU * (700 + 300 * Math.sin(TAU * 2 * t)) * t) * 0.12),
  'chip.clack': (ctx) => defs['ui.chip-place'](ctx),
  'card.flip': (ctx) => defs['ui.card-flip'](ctx),
};

let registered = false;
function registerFallbacks() {
  if (registered) return;
  registered = true;
  for (const [name, gen] of Object.entries(defs)) audio.define(FALLBACK + name, gen);
}

/** Play a contract sound name, falling back to the built-in version. Never throws. */
export function uiSound(name, opts = {}) {
  try {
    if (!audio.unlocked) return null;
    registerFallbacks();
    const bus = opts.bus || (name.startsWith('ui.') ? 'ui' : 'sfx');
    const real = audio.generators.has(name) || audio.buffers.has(name);
    const key = real ? name : defs[name] ? FALLBACK + name : null;
    if (!key) return null;
    return audio.play(key, { bus, reverb: bus === 'ui' ? 0 : 0.25, ...opts });
  } catch (err) {
    console.warn('[ui] sound failed', name, err);
    return null;
  }
}

/** Small random pitch spread so repeated clicks don't sound machine-gunned. */
export const vary = (amount = 0.06) => 1 + (Math.random() * 2 - 1) * amount;

// Music lives in src/audio (built by another module). Import it lazily and tolerate absence.
let musicPromise = null;
export function getMusic() {
  if (!musicPromise) {
    musicPromise = import('../audio/index.js').then((m) => m.music || null).catch(() => null);
  }
  return musicPromise;
}
