// Typing sound packs, synthesized with Web Audio (no sound files needed).
// Each role renders into an OfflineAudioContext once; playback just replays
// the buffers, so a key press costs almost nothing and has no delay.

export const SOUND_CATEGORIES = [
  { id: 'mech', name: 'Mechanical keyboards', emoji: '⌨️' },
  { id: 'type', name: 'Typewriters', emoji: '📜' },
  { id: 'game', name: 'Game / 8-bit', emoji: '👾' },
  { id: 'funny', name: 'Funny', emoji: '🤪' },
];

const noiseCache = new WeakMap();
function noise(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

// Filtered noise burst with an exponential decay.
function hit(ctx, { t = 0, dur = 0.05, type = 'bandpass', freq = 2000, q = 1, gain = 0.5, attack = 0.001 }) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

// Oscillator note with optional pitch glide.
function tone(ctx, { t = 0, freq = 440, to = null, type = 'sine', dur = 0.1, gain = 0.3, attack = 0.002, glide = null, vibrato = 0, vibratoRate = 20 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + (glide ?? dur));
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = vibratoRate; lg.gain.value = vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Band-passed buzz, used for the duck.
function formant(ctx, { t = 0, freq = 250, dur = 0.15, gain = 0.3, formants = [900, 1400], to = null }) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.setValueAtTime(gain, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const fq of formants) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = 6;
    o.connect(f).connect(g);
  }
  g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const note = (semi, base = 523.25) => base * 2 ** (semi / 12);
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

function mech({ click = 0, clickFreq = 4200, bump = 0, thock = 900, thockQ = 0.8, body = 0.35, bottom = 0.04, ring = 0 }) {
  const key = (ctx, r) => {
    const v = 0.85 + r() * 0.3;
    if (click) hit(ctx, { t: 0, dur: 0.012, type: 'bandpass', freq: clickFreq * v, q: 3, gain: click });
    if (bump) hit(ctx, { t: 0.002, dur: 0.02, type: 'bandpass', freq: 1800 * v, q: 1.5, gain: bump });
    hit(ctx, { t: 0.008, dur: bottom + r() * 0.015, type: 'lowpass', freq: thock * v, q: thockQ, gain: body });
    hit(ctx, { t: 0.006, dur: 0.01, type: 'highpass', freq: 5000, q: 0.7, gain: 0.08 });
    if (ring) tone(ctx, { t: 0.01, freq: 2400 * v, dur: 0.05, gain: ring, type: 'triangle' });
    return 0.12;
  };
  const big = (scale) => (ctx, r) => {
    if (click) hit(ctx, { t: 0, dur: 0.014, type: 'bandpass', freq: clickFreq * 0.8, q: 3, gain: click * 0.8 });
    hit(ctx, { t: 0.01, dur: bottom * scale, type: 'lowpass', freq: thock * 0.6, q: thockQ, gain: body * 1.15 });
    hit(ctx, { t: 0.03, dur: 0.03, type: 'bandpass', freq: 1400, q: 2, gain: 0.07 });
    void r;
    return 0.18;
  };
  return {
    key,
    space: big(2.4),
    enter: big(1.8),
    backspace: big(1.4),
    up: (ctx, r) => { hit(ctx, { t: 0, dur: 0.02, type: 'lowpass', freq: thock * 1.4 * (0.9 + r() * 0.2), q: 0.8, gain: body * 0.35 }); return 0.06; },
    mouse: (ctx) => { hit(ctx, { t: 0, dur: 0.01, type: 'bandpass', freq: 3200, q: 2, gain: 0.5 }); return 0.05; },
  };
}

function typewriter({ weight = 1, sharp = 1 }) {
  const clack = (ctx, r) => {
    const v = 0.9 + r() * 0.2;
    hit(ctx, { t: 0, dur: 0.02 * weight, type: 'bandpass', freq: 2600 * v * sharp, q: 2.5, gain: 0.55 });
    hit(ctx, { t: 0.004, dur: 0.06 * weight, type: 'lowpass', freq: 700 * v, q: 1, gain: 0.45 * weight });
    tone(ctx, { t: 0.002, freq: 3100 * v, dur: 0.035, gain: 0.05, type: 'square' });
    return 0.14;
  };
  return {
    key: clack,
    space: (ctx, r) => { hit(ctx, { t: 0, dur: 0.09 * weight, type: 'lowpass', freq: 500, q: 1, gain: 0.55 }); hit(ctx, { t: 0.02, dur: 0.04, type: 'bandpass', freq: 1600, q: 3, gain: 0.15 }); void r; return 0.15; },
    enter: (ctx) => {
      tone(ctx, { t: 0, freq: 2093, dur: 1.2, gain: 0.25 });
      tone(ctx, { t: 0, freq: 5274, dur: 0.7, gain: 0.08 });
      tone(ctx, { t: 0, freq: 3136, dur: 0.9, gain: 0.07 });
      const src = ctx.createBufferSource(); src.buffer = noise(ctx);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
      f.frequency.setValueAtTime(900, 0.15); f.frequency.linearRampToValueAtTime(2600, 0.55);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0.15); g.gain.linearRampToValueAtTime(0.25, 0.2); g.gain.linearRampToValueAtTime(0.0001, 0.6);
      src.connect(f).connect(g).connect(ctx.destination); src.start(0.15); src.stop(0.65);
      hit(ctx, { t: 0.62, dur: 0.1, type: 'lowpass', freq: 600, gain: 0.5 });
      return 1.3;
    },
    backspace: (ctx, r) => { clack(ctx, r); hit(ctx, { t: 0.05, dur: 0.05, type: 'bandpass', freq: 1200, q: 2, gain: 0.2 }); return 0.16; },
    up: (ctx) => { hit(ctx, { t: 0, dur: 0.015, type: 'bandpass', freq: 1800, q: 3, gain: 0.12 }); return 0.04; },
    mouse: (ctx, r) => clack(ctx, r),
  };
}

const PACKS = [
  { id: 'mech-blue', name: 'Blue Clicky', cat: 'mech', emoji: '🔵', desc: 'Loud, sharp click. The classic gamer keyboard.', ...mech({ click: 0.55, clickFreq: 4300, body: 0.3, bottom: 0.035, ring: 0.02 }) },
  { id: 'mech-brown', name: 'Brown Tactile', cat: 'mech', emoji: '🟤', desc: 'Soft bump, quiet and satisfying.', ...mech({ bump: 0.3, body: 0.35, bottom: 0.04 }) },
  { id: 'mech-red', name: 'Red Linear', cat: 'mech', emoji: '🔴', desc: 'Smooth, just the bottom-out.', ...mech({ body: 0.42, thock: 1100, bottom: 0.035 }) },
  { id: 'mech-thock', name: 'Deep Thock', cat: 'mech', emoji: '🪵', desc: 'Low, deep and bassy. Custom-board vibes.', ...mech({ body: 0.6, thock: 420, thockQ: 1.4, bottom: 0.06 }) },
  { id: 'mech-creamy', name: 'Creamy', cat: 'mech', emoji: '🍦', desc: 'Muted and marbly.', ...mech({ body: 0.45, thock: 650, thockQ: 0.6, bottom: 0.05, bump: 0.08 }) },
  { id: 'mech-topre', name: 'Topre Pop', cat: 'mech', emoji: '🫧', desc: 'Rounded, poppy thock.', ...mech({ body: 0.5, thock: 780, thockQ: 2.2, bottom: 0.045, ring: 0.03 }) },
  { id: 'typewriter', name: 'Classic Typewriter', cat: 'type', emoji: '📜', desc: 'Clack clack... DING!', ...typewriter({}) },
  { id: 'typewriter-old', name: 'Old Manual', cat: 'type', emoji: '🗞️', desc: 'Heavy, clunky, ancient.', ...typewriter({ weight: 1.6, sharp: 0.8 }) },
  { id: 'typewriter-electric', name: 'Electric Typewriter', cat: 'type', emoji: '⚡', desc: 'Tight and snappy.', ...typewriter({ weight: 0.7, sharp: 1.3 }) },
  {
    id: 'retro-blip', name: 'Retro Blip', cat: 'game', emoji: '🕹️', desc: 'Every key is a little melody note.',
    key: (ctx, r) => { tone(ctx, { freq: note(pick(PENTA, r)), type: 'square', dur: 0.06, gain: 0.12 }); return 0.08; },
    space: (ctx) => { tone(ctx, { freq: note(-12), type: 'square', dur: 0.08, gain: 0.12 }); return 0.1; },
    enter: (ctx) => { [0, 4, 7, 12].forEach((s, i) => tone(ctx, { t: i * 0.05, freq: note(s), type: 'square', dur: 0.07, gain: 0.12 })); return 0.3; },
    backspace: (ctx) => { tone(ctx, { freq: note(7), to: note(-5), type: 'square', dur: 0.09, gain: 0.1 }); return 0.1; },
    up: (ctx) => { tone(ctx, { freq: note(24), type: 'square', dur: 0.015, gain: 0.03 }); return 0.03; },
    mouse: (ctx) => { tone(ctx, { freq: note(12), type: 'square', dur: 0.04, gain: 0.1 }); return 0.05; },
  },
  {
    id: 'coin', name: 'Coin Collector', cat: 'game', emoji: '🪙', desc: 'Ka-ching on every key.',
    key: (ctx, r) => { const b = 988 * (0.97 + r() * 0.06); tone(ctx, { freq: b, type: 'square', dur: 0.05, gain: 0.1 }); tone(ctx, { t: 0.05, freq: b * 1.335, type: 'square', dur: 0.12, gain: 0.1 }); return 0.2; },
    space: (ctx) => { tone(ctx, { freq: 660, type: 'square', dur: 0.05, gain: 0.1 }); tone(ctx, { t: 0.05, freq: 880, type: 'square', dur: 0.1, gain: 0.1 }); return 0.17; },
    enter: (ctx) => { [0, 4, 7, 12, 16].forEach((s, i) => tone(ctx, { t: i * 0.06, freq: note(s, 988), type: 'square', dur: 0.1, gain: 0.08 })); return 0.45; },
    backspace: (ctx) => { tone(ctx, { freq: 700, to: 300, type: 'square', dur: 0.12, gain: 0.1 }); return 0.14; },
    up: () => 0.01,
    mouse: (ctx) => { tone(ctx, { freq: 1319, type: 'square', dur: 0.05, gain: 0.08 }); return 0.06; },
  },
  {
    id: 'laser', name: 'Laser Pew', cat: 'game', emoji: '🔫', desc: 'Pew pew pew.',
    key: (ctx, r) => { const f = 1400 + r() * 500; tone(ctx, { freq: f, to: 180, type: 'sawtooth', dur: 0.11, gain: 0.09 }); return 0.13; },
    space: (ctx) => { tone(ctx, { freq: 900, to: 60, type: 'sawtooth', dur: 0.25, gain: 0.1 }); hit(ctx, { dur: 0.2, type: 'lowpass', freq: 400, gain: 0.3 }); return 0.28; },
    enter: (ctx) => { tone(ctx, { freq: 200, to: 2000, type: 'sawtooth', dur: 0.3, gain: 0.08 }); hit(ctx, { t: 0.28, dur: 0.3, type: 'lowpass', freq: 300, gain: 0.5 }); return 0.62; },
    backspace: (ctx) => { tone(ctx, { freq: 300, to: 1200, type: 'square', dur: 0.1, gain: 0.08 }); return 0.12; },
    up: () => 0.01,
    mouse: (ctx) => { tone(ctx, { freq: 2200, to: 400, type: 'sawtooth', dur: 0.08, gain: 0.08 }); return 0.1; },
  },
  {
    id: 'jump', name: 'Platformer Jump', cat: 'game', emoji: '🍄', desc: 'Boing-y jump sounds.',
    key: (ctx, r) => { const f = 300 + r() * 120; tone(ctx, { freq: f, to: f * 3, type: 'square', dur: 0.12, gain: 0.08, glide: 0.1 }); return 0.14; },
    space: (ctx) => { tone(ctx, { freq: 200, to: 800, type: 'square', dur: 0.2, gain: 0.09 }); return 0.22; },
    enter: (ctx) => { [0, 7, 12, 19, 24].forEach((s, i) => tone(ctx, { t: i * 0.07, freq: note(s, 262), type: 'square', dur: 0.09, gain: 0.08 })); return 0.45; },
    backspace: (ctx) => { tone(ctx, { freq: 600, to: 120, type: 'square', dur: 0.2, gain: 0.08 }); return 0.22; },
    up: () => 0.01,
    mouse: (ctx) => { tone(ctx, { freq: 400, to: 900, type: 'square', dur: 0.07, gain: 0.08 }); return 0.09; },
  },
  {
    id: 'arcade-mix', name: 'Arcade Mix', cat: 'game', emoji: '🎰', desc: 'Random blips, coins and lasers.',
    key: (ctx, r) => {
      const n = r();
      if (n < 0.34) tone(ctx, { freq: note(pick(PENTA, r)), type: 'square', dur: 0.06, gain: 0.1 });
      else if (n < 0.67) { tone(ctx, { freq: 988, type: 'square', dur: 0.04, gain: 0.08 }); tone(ctx, { t: 0.04, freq: 1319, type: 'square', dur: 0.08, gain: 0.08 }); }
      else tone(ctx, { freq: 1600, to: 200, type: 'sawtooth', dur: 0.1, gain: 0.07 });
      return 0.14;
    },
    space: (ctx) => { tone(ctx, { freq: 110, type: 'triangle', dur: 0.12, gain: 0.3 }); return 0.14; },
    enter: (ctx) => { [0, 4, 7, 11, 14].forEach((s, i) => tone(ctx, { t: i * 0.05, freq: note(s), type: 'square', dur: 0.08, gain: 0.08 })); return 0.35; },
    backspace: (ctx) => { hit(ctx, { dur: 0.1, type: 'bandpass', freq: 1200, q: 1, gain: 0.3 }); return 0.12; },
    up: () => 0.01,
    mouse: (ctx) => { tone(ctx, { freq: 880, type: 'square', dur: 0.04, gain: 0.08 }); return 0.05; },
  },
  {
    id: 'bubble', name: 'Bubble Pop', cat: 'funny', emoji: '🫧', desc: 'Blup blup blup.',
    key: (ctx, r) => { const f = 280 + r() * 200; tone(ctx, { freq: f, to: f * 4, dur: 0.07, gain: 0.35, glide: 0.05 }); return 0.09; },
    space: (ctx) => { tone(ctx, { freq: 150, to: 700, dur: 0.12, gain: 0.4 }); return 0.14; },
    enter: (ctx) => { [0, 0.07, 0.14].forEach((t, i) => tone(ctx, { t, freq: 250 + i * 80, to: 1200 + i * 300, dur: 0.08, gain: 0.3 })); return 0.25; },
    backspace: (ctx) => { tone(ctx, { freq: 900, to: 200, dur: 0.09, gain: 0.3 }); return 0.1; },
    up: () => 0.01,
    mouse: (ctx) => { tone(ctx, { freq: 400, to: 1500, dur: 0.06, gain: 0.3 }); return 0.08; },
  },
  {
    id: 'quack', name: 'Duck Quack', cat: 'funny', emoji: '🦆', desc: 'Every key is a duck. You are welcome.',
    key: (ctx, r) => { const f = 230 + r() * 60; formant(ctx, { freq: f, to: f * 0.8, dur: 0.13, gain: 0.35, formants: [950, 1500] }); return 0.16; },
    space: (ctx) => { formant(ctx, { freq: 180, to: 150, dur: 0.2, gain: 0.35, formants: [800, 1300] }); return 0.22; },
    enter: (ctx) => { [0, 0.16, 0.32].forEach((t) => formant(ctx, { t, freq: 250, to: 200, dur: 0.13, gain: 0.3, formants: [950, 1500] })); return 0.5; },
    backspace: (ctx) => { formant(ctx, { freq: 300, to: 180, dur: 0.18, gain: 0.3, formants: [1100, 1700] }); return 0.2; },
    up: () => 0.01,
    mouse: (ctx) => { formant(ctx, { freq: 260, to: 210, dur: 0.1, gain: 0.3, formants: [950, 1500] }); return 0.12; },
  },
  {
    id: 'boing', name: 'Boing', cat: 'funny', emoji: '🌀', desc: 'Cartoon springs.',
    key: (ctx, r) => { tone(ctx, { freq: 140 + r() * 60, to: 260, dur: 0.22, gain: 0.3, vibrato: 25, vibratoRate: 28 }); return 0.26; },
    space: (ctx) => { tone(ctx, { freq: 90, to: 200, dur: 0.35, gain: 0.35, vibrato: 30, vibratoRate: 22 }); return 0.38; },
    enter: (ctx) => { tone(ctx, { freq: 120, to: 600, dur: 0.5, gain: 0.3, vibrato: 40, vibratoRate: 18 }); return 0.55; },
    backspace: (ctx) => { tone(ctx, { freq: 400, to: 90, dur: 0.3, gain: 0.3, vibrato: 30, vibratoRate: 25 }); return 0.33; },
    up: () => 0.01,
    mouse: (ctx) => { tone(ctx, { freq: 200, to: 320, dur: 0.15, gain: 0.3, vibrato: 20, vibratoRate: 30 }); return 0.18; },
  },
  {
    id: 'squeaky', name: 'Squeaky Toy', cat: 'funny', emoji: '🐤', desc: 'Squeak squeak.',
    key: (ctx, r) => { const f = 1300 + r() * 500; tone(ctx, { freq: f, to: f * 1.3, dur: 0.1, gain: 0.15, type: 'triangle', vibrato: 60, vibratoRate: 35 }); return 0.12; },
    space: (ctx) => { tone(ctx, { freq: 900, to: 1400, dur: 0.18, gain: 0.15, type: 'triangle', vibrato: 80, vibratoRate: 30 }); return 0.2; },
    enter: (ctx) => { tone(ctx, { freq: 1600, to: 900, dur: 0.12, gain: 0.15, type: 'triangle', vibrato: 60 }); tone(ctx, { t: 0.14, freq: 900, to: 1700, dur: 0.14, gain: 0.15, type: 'triangle', vibrato: 60 }); return 0.3; },
    backspace: (ctx) => { tone(ctx, { freq: 1800, to: 700, dur: 0.15, gain: 0.15, type: 'triangle', vibrato: 50 }); return 0.17; },
    up: () => 0.01,
    mouse: (ctx) => { tone(ctx, { freq: 1500, to: 1900, dur: 0.08, gain: 0.14, type: 'triangle', vibrato: 60 }); return 0.1; },
  },
  {
    id: 'piano', name: 'Typing Piano', cat: 'funny', emoji: '🎹', desc: 'You make a song while you type.',
    key: (ctx, r) => {
      const f = note(pick(PENTA, r), 392);
      tone(ctx, { freq: f, dur: 0.6, gain: 0.18, type: 'triangle' });
      tone(ctx, { freq: f * 2, dur: 0.3, gain: 0.05 });
      return 0.65;
    },
    space: (ctx) => { tone(ctx, { freq: 196, dur: 0.7, gain: 0.2, type: 'triangle' }); tone(ctx, { freq: 293.7, dur: 0.7, gain: 0.12, type: 'triangle' }); return 0.75; },
    enter: (ctx) => { [0, 4, 7, 12].forEach((s) => tone(ctx, { freq: note(s, 392), dur: 1, gain: 0.1, type: 'triangle' })); return 1.05; },
    backspace: (ctx) => { tone(ctx, { freq: 370, dur: 0.4, gain: 0.15, type: 'triangle' }); tone(ctx, { freq: 349, dur: 0.4, gain: 0.12, type: 'triangle' }); return 0.45; },
    up: () => 0.01,
    mouse: (ctx) => { tone(ctx, { freq: 784, dur: 0.3, gain: 0.12, type: 'triangle' }); return 0.35; },
  },
  {
    id: 'drums', name: 'Drum Kit', cat: 'funny', emoji: '🥁', desc: 'Type a beat.',
    key: (ctx, r) => {
      const n = r();
      if (n < 0.45) hit(ctx, { dur: 0.05, type: 'highpass', freq: 7000, gain: 0.3 });
      else if (n < 0.75) { hit(ctx, { dur: 0.15, type: 'bandpass', freq: 1800, q: 0.8, gain: 0.45 }); tone(ctx, { freq: 190, dur: 0.1, gain: 0.25, type: 'triangle' }); }
      else tone(ctx, { freq: 150, to: 45, dur: 0.25, gain: 0.8, glide: 0.12 });
      return 0.3;
    },
    space: (ctx) => { tone(ctx, { freq: 150, to: 40, dur: 0.35, gain: 0.9, glide: 0.15 }); return 0.38; },
    enter: (ctx) => { hit(ctx, { dur: 0.9, type: 'highpass', freq: 5000, q: 0.5, gain: 0.35 }); tone(ctx, { freq: 150, to: 40, dur: 0.35, gain: 0.8, glide: 0.15 }); return 0.95; },
    backspace: (ctx) => { hit(ctx, { dur: 0.2, type: 'bandpass', freq: 1500, q: 0.8, gain: 0.5 }); return 0.22; },
    up: () => 0.01,
    mouse: (ctx) => { hit(ctx, { dur: 0.05, type: 'highpass', freq: 8000, gain: 0.25 }); return 0.06; },
  },
];

export const SOUND_PACKS = PACKS;
export const PACK_MAP = new Map(PACKS.map((p) => [p.id, p]));
export const ROLES = ['key', 'space', 'enter', 'backspace', 'up', 'mouse'];
export const KEY_VARIANTS = 6;

// Renders every role of a pack into AudioBuffers.
export async function renderPack(pack, sampleRate = 44100) {
  const out = {};
  const rand = Math.random;
  for (const role of ROLES) {
    const fn = pack[role] || pack.key;
    const count = role === 'key' ? KEY_VARIANTS : 1;
    out[role] = [];
    for (let i = 0; i < count; i++) {
      // measure first with a throwaway context so the buffer is just long enough
      const len = Math.ceil(sampleRate * 1.5);
      const ctx = new OfflineAudioContext(1, len, sampleRate);
      const dur = fn(ctx, rand) || 0.2;
      const buf = await ctx.startRendering();
      const trimmed = new AudioBuffer({ length: Math.min(len, Math.ceil((dur + 0.05) * sampleRate)), sampleRate, numberOfChannels: 1 });
      trimmed.copyToChannel(buf.getChannelData(0).subarray(0, trimmed.length), 0);
      out[role].push(trimmed);
    }
  }
  return out;
}
