// Fully procedural audio: every sound effect, ambience loop and music bed is synthesized with WebAudio.
import { getSettings, onSettingChange } from './settings.js';

let ctx = null, master, musicBus, sfxBus, reverb, reverbSend, comp, noiseBuf;
let musicState = null;
const listenerPos = { x: 0, y: 0, z: 0 };

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(2.6, 2.2);
  reverbSend = ctx.createGain(); reverbSend.gain.value = 0.25;
  musicBus.connect(master); sfxBus.connect(master);
  sfxBus.connect(reverbSend); reverbSend.connect(reverb); reverb.connect(master);
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = makeNoise(2);
  applyVolumes();
  onSettingChange(applyVolumes);
}

export function resumeAudio() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
export function audioTime() { return ctx ? ctx.currentTime : 0; }

function applyVolumes() {
  if (!ctx) return;
  const s = getSettings();
  master.gain.value = s.masterVolume;
  musicBus.gain.value = s.musicVolume * 0.6;
  sfxBus.gain.value = s.sfxVolume;
}

export function setReverb(amount) { if (reverbSend) reverbSend.gain.setTargetAtTime(amount, ctx.currentTime, 0.5); }

function makeNoise(seconds) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function makeImpulse(seconds, decay) {
  const len = ctx.sampleRate * seconds;
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

export function setListener(pos, forward) {
  if (!ctx) return;
  const L = ctx.listener;
  listenerPos.x = pos.x; listenerPos.y = pos.y; listenerPos.z = pos.z;
  if (L.positionX) {
    L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z;
    L.forwardX.value = forward.x; L.forwardY.value = forward.y; L.forwardZ.value = forward.z;
    L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
  } else if (L.setPosition) {
    L.setPosition(pos.x, pos.y, pos.z);
    L.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
  }
}

// Output node for a sound: plain bus, or an HRTF panner when a world position is given.
function out(opts = {}) {
  let node = sfxBus;
  if (opts.pos && getSettings().immersion5d !== false) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = opts.ref || 6;
    p.rolloffFactor = opts.rolloff || 1.2;
    p.maxDistance = 10000;
    setPannerPos(p, opts.pos);
    p.connect(sfxBus);
    node = p;
  } else if (opts.pos) {
    // Non-spatial fallback: simple distance attenuation.
    const g = ctx.createGain();
    const d = Math.hypot(opts.pos.x - listenerPos.x, opts.pos.y - listenerPos.y, opts.pos.z - listenerPos.z);
    g.gain.value = Math.min(1, (opts.ref || 6) / Math.max(opts.ref || 6, d));
    g.connect(sfxBus);
    node = g;
  }
  return node;
}

function setPannerPos(p, pos) {
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
  else p.setPosition(pos.x, pos.y, pos.z);
}

function env(g, t, a, peak, d, sustain = 0) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
}

function noise(dest, t, dur, { type = 'bandpass', freq = 1000, q = 1, vol = 0.5, attack = 0.005, freqEnd = null } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  env(g, t, attack, vol, dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + attack + 0.05);
  return src;
}

function tone(dest, t, dur, { type = 'sine', freq = 440, freqEnd = null, vol = 0.3, attack = 0.005, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + dur);
  const g = ctx.createGain();
  env(g, t, attack, vol, dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + attack + 0.05);
  return o;
}

const SURF = {
  wood: { freq: 900, q: 1.5, vol: 0.18, body: 140 },
  carpet: { freq: 500, q: 0.7, vol: 0.08, body: 0 },
  tile: { freq: 2200, q: 2.5, vol: 0.14, body: 300 },
  fabric: { freq: 400, q: 0.6, vol: 0.07, body: 0 },
  paper: { freq: 3000, q: 1, vol: 0.12, body: 0 },
  grass: { freq: 2600, q: 0.6, vol: 0.12, body: 0 },
  dirt: { freq: 700, q: 0.8, vol: 0.12, body: 80 },
  leaf: { freq: 3400, q: 0.8, vol: 0.14, body: 0 },
  digital: { freq: 1800, q: 8, vol: 0.08, body: 0, tone: true },
  micro: { freq: 300, q: 3, vol: 0.06, body: 0 },
  plastic: { freq: 1600, q: 3, vol: 0.12, body: 400 },
  glass: { freq: 3200, q: 6, vol: 0.1, body: 900 },
  concrete: { freq: 1100, q: 1, vol: 0.14, body: 90 },
};

// One-shot sound effects. `opts.pos` makes them positional.
export function sfx(name, opts = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + (opts.delay || 0);
  const o = out(opts);
  const v = opts.vol ?? 1;
  switch (name) {
    case 'step': {
      const s = SURF[opts.surface] || SURF.wood;
      noise(o, t, 0.06, { freq: s.freq * (0.85 + Math.random() * 0.3), q: s.q, vol: s.vol * v });
      if (s.body) tone(o, t, 0.05, { freq: s.body, vol: s.vol * 0.6 * v });
      if (s.tone) tone(o, t, 0.04, { type: 'square', freq: 600 + Math.random() * 400, vol: 0.03 * v });
      break;
    }
    case 'jump': noise(o, t, 0.12, { freq: 1200, freqEnd: 2400, vol: 0.08 * v }); tone(o, t, 0.1, { freq: 220, freqEnd: 330, vol: 0.05 * v }); break;
    case 'land': noise(o, t, 0.12, { type: 'lowpass', freq: opts.soft ? 400 : 900, vol: (opts.soft ? 0.12 : 0.25) * v }); tone(o, t, 0.12, { freq: 90, freqEnd: 50, vol: 0.2 * v }); break;
    case 'hurt': tone(o, t, 0.2, { type: 'sawtooth', freq: 300, freqEnd: 140, vol: 0.12 * v }); noise(o, t, 0.1, { freq: 800, vol: 0.2 * v }); break;
    case 'death': tone(o, t, 1.4, { type: 'sawtooth', freq: 220, freqEnd: 40, vol: 0.2 * v }); tone(o, t, 1.4, { type: 'sine', freq: 110, freqEnd: 30, vol: 0.3 * v }); break;
    case 'pickup': tone(o, t, 0.08, { type: 'triangle', freq: 880, vol: 0.12 * v }); tone(o, t + 0.07, 0.12, { type: 'triangle', freq: 1320, vol: 0.12 * v }); break;
    case 'craft': [523, 659, 784, 1046].forEach((f, i) => tone(o, t + i * 0.06, 0.25, { type: 'triangle', freq: f, vol: 0.1 * v })); noise(o, t, 0.2, { freq: 3000, vol: 0.06 * v }); break;
    case 'click': tone(o, t, 0.04, { type: 'square', freq: 1400, vol: 0.05 * v }); break;
    case 'hover': tone(o, t, 0.03, { type: 'sine', freq: 2200, vol: 0.025 * v }); break;
    case 'whoosh': noise(o, t, opts.dur || 0.5, { freq: 400, freqEnd: 2500, q: 0.8, vol: 0.25 * v, attack: 0.1 }); break;
    case 'swing': noise(o, t, 0.18, { freq: 700, freqEnd: 3000, q: 1.2, vol: 0.18 * v, attack: 0.02 }); break;
    case 'hit': noise(o, t, 0.1, { freq: 1500, vol: 0.3 * v }); tone(o, t, 0.12, { freq: 180, freqEnd: 80, vol: 0.25 * v }); break;
    case 'punch': noise(o, t, 0.08, { type: 'lowpass', freq: 900, vol: 0.3 * v }); tone(o, t, 0.08, { freq: 120, freqEnd: 60, vol: 0.2 * v }); break;
    case 'zap': for (let i = 0; i < 6; i++) tone(o, t + i * 0.03, 0.05, { type: 'sawtooth', freq: 400 + Math.random() * 1600, vol: 0.08 * v }); noise(o, t, 0.25, { freq: 5000, q: 0.5, vol: 0.12 * v }); break;
    case 'explosion': noise(o, t, 2.2, { type: 'lowpass', freq: 1800, freqEnd: 60, vol: 0.9 * v, attack: 0.01 }); tone(o, t, 1.5, { freq: 70, freqEnd: 25, vol: 0.6 * v }); break;
    case 'glitch': for (let i = 0; i < 10; i++) tone(o, t + i * 0.025, 0.03, { type: 'square', freq: 100 + Math.random() * 3000, vol: 0.06 * v }); break;
    case 'notify': tone(o, t, 0.12, { freq: 1175, vol: 0.12 * v }); tone(o, t + 0.12, 0.2, { freq: 1568, vol: 0.12 * v }); break;
    case 'scroll': noise(o, t, 0.08, { freq: 2600, freqEnd: 1200, q: 2, vol: 0.05 * v }); break;
    case 'like': tone(o, t, 0.08, { type: 'triangle', freq: 988, vol: 0.08 * v }); tone(o, t + 0.05, 0.1, { type: 'triangle', freq: 1480, vol: 0.08 * v }); break;
    case 'bark': {
      for (let i = 0; i < (opts.count || 1); i++) {
        const tt = t + i * 0.28;
        tone(o, tt, 0.16, { type: 'sawtooth', freq: 420, freqEnd: 190, vol: 0.5 * v });
        noise(o, tt, 0.14, { freq: 900, q: 1.5, vol: 0.5 * v });
      }
      break;
    }
    case 'growl': tone(o, t, 1.2, { type: 'sawtooth', freq: 85, freqEnd: 70, vol: 0.35 * v, attack: 0.2 }); noise(o, t, 1.2, { type: 'lowpass', freq: 300, vol: 0.3 * v, attack: 0.2 }); break;
    case 'chomp': noise(o, t, 0.15, { type: 'lowpass', freq: 700, vol: 0.9 * v }); tone(o, t, 0.2, { freq: 90, freqEnd: 40, vol: 0.6 * v }); break;
    case 'splash': noise(o, t, 0.7, { freq: 1200, freqEnd: 300, q: 0.6, vol: 0.4 * v }); break;
    case 'flush': noise(o, t, 3.5, { type: 'lowpass', freq: 1500, freqEnd: 200, vol: 0.6 * v, attack: 0.3 }); break;
    case 'squish': noise(o, t, 0.2, { type: 'lowpass', freq: 500, vol: 0.4 * v }); tone(o, t, 0.2, { freq: 200, freqEnd: 60, vol: 0.2 * v }); break;
    case 'crunch': noise(o, t, 0.2, { freq: 2200, q: 1, vol: 0.3 * v }); noise(o, t + 0.05, 0.15, { freq: 1200, q: 1, vol: 0.2 * v }); break;
    case 'chop': noise(o, t, 0.12, { freq: 1800, q: 1.5, vol: 0.35 * v }); tone(o, t, 0.1, { freq: 260, freqEnd: 120, vol: 0.2 * v }); break;
    case 'mine': tone(o, t, 0.3, { type: 'triangle', freq: 1900, freqEnd: 1700, vol: 0.18 * v }); noise(o, t, 0.08, { freq: 4000, vol: 0.2 * v }); break;
    case 'buzz': tone(o, t, 0.6, { type: 'sawtooth', freq: 180 + Math.random() * 40, vol: 0.08 * v, attack: 0.05 }); break;
    case 'hiss': noise(o, t, 0.6, { type: 'highpass', freq: 3000, vol: 0.25 * v, attack: 0.05 }); break;
    case 'virus': tone(o, t, 0.15, { type: 'square', freq: 200 + Math.random() * 300, freqEnd: 900, vol: 0.06 * v }); break;
    case 'heartbeat': tone(o, t, 0.12, { freq: 60, freqEnd: 40, vol: 0.5 * v }); tone(o, t + 0.2, 0.12, { freq: 55, freqEnd: 38, vol: 0.4 * v }); break;
    case 'achievement': [659, 784, 988, 1319].forEach((f, i) => tone(o, t + i * 0.09, 0.4, { type: 'triangle', freq: f, vol: 0.12 * v })); break;
    case 'fail': tone(o, t, 0.35, { type: 'sine', freq: 480, vol: 0.15 * v }); tone(o, t, 0.35, { type: 'sine', freq: 620, vol: 0.15 * v }); tone(o, t + 0.5, 0.35, { freq: 480, vol: 0.15 * v }); tone(o, t + 0.5, 0.35, { freq: 620, vol: 0.15 * v }); tone(o, t + 1.0, 0.8, { freq: 380, vol: 0.15 * v }); break;
    case 'dial': tone(o, t, 1.8, { freq: 440, vol: 0.08 * v, attack: 0.02 }); tone(o, t, 1.8, { freq: 480, vol: 0.08 * v, attack: 0.02 }); break;
    case 'shrink': tone(o, t, 2.5, { type: 'sine', freq: 900, freqEnd: 60, vol: 0.25 * v }); noise(o, t, 2.5, { freq: 3000, freqEnd: 200, vol: 0.15 * v, attack: 0.5 }); break;
    case 'grow': tone(o, t, 3, { type: 'sine', freq: 60, freqEnd: 900, vol: 0.25 * v }); noise(o, t, 3, { freq: 200, freqEnd: 4000, vol: 0.15 * v, attack: 0.5 }); break;
    case 'eat': noise(o, t, 0.1, { freq: 900, vol: 0.2 * v }); noise(o, t + 0.15, 0.1, { freq: 800, vol: 0.2 * v }); break;
    case 'drink': for (let i = 0; i < 3; i++) tone(o, t + i * 0.15, 0.1, { freq: 300 + i * 40, freqEnd: 500, vol: 0.12 * v }); break;
    case 'place': noise(o, t, 0.15, { type: 'lowpass', freq: 600, vol: 0.3 * v }); tone(o, t, 0.1, { freq: 160, vol: 0.15 * v }); break;
    case 'error': tone(o, t, 0.15, { type: 'square', freq: 180, vol: 0.06 * v }); break;
    case 'squeak': tone(o, t, 0.15, { type: 'sine', freq: 1800, freqEnd: 2600, vol: 0.1 * v }); break;
    case 'car': noise(o, t, opts.dur || 2.5, { type: 'lowpass', freq: 500, vol: 0.5 * v, attack: 0.8 }); tone(o, t, opts.dur || 2.5, { type: 'sawtooth', freq: 55, freqEnd: 45, vol: 0.15 * v, attack: 0.8 }); break;
    case 'rumble': tone(o, t, opts.dur || 1.5, { freq: 40, vol: 0.4 * v, attack: 0.2 }); noise(o, t, opts.dur || 1.5, { type: 'lowpass', freq: 200, vol: 0.4 * v, attack: 0.2 }); break;
    case 'yawn': tone(o, t, 1.4, { type: 'sine', freq: 300, freqEnd: 180, vol: 0.08 * v, attack: 0.3 }); noise(o, t, 1.4, { freq: 600, q: 4, vol: 0.05 * v, attack: 0.3 }); break;
    case 'pop': tone(o, t, 0.08, { freq: 600, freqEnd: 1400, vol: 0.2 * v }); break;
    case 'scratch': noise(o, t, 0.05, { freq: 2600, q: 1.4, vol: 0.28 * v }); noise(o, t + 0.05, 0.04, { freq: 1900, q: 1.2, vol: 0.18 * v }); break;
    case 'sizzle': noise(o, t, 0.4, { type: 'highpass', freq: 5000, vol: 0.12 * v }); break;
    case 'boss': tone(o, t, 3, { type: 'sawtooth', freq: 55, vol: 0.3 * v, attack: 0.5 }); tone(o, t, 3, { type: 'sawtooth', freq: 58, vol: 0.3 * v, attack: 0.5 }); break;
    default: break;
  }
}

// Continuous positional loops. Returns a handle with setPos / setVolume / stop.
export function loop(name, opts = {}) {
  if (!ctx) return nullLoop();
  const dest = out(opts);
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(dest);
  const nodes = [];
  const t = ctx.currentTime;
  const add = (n) => { nodes.push(n); return n; };
  const noiseSrc = (filterType, freq, q = 1, gain = 1) => {
    const s = add(ctx.createBufferSource()); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const gg = ctx.createGain(); gg.gain.value = gain;
    s.connect(f); f.connect(gg); gg.connect(g); s.start(t, Math.random());
    return { s, f, gg };
  };
  const osc = (type, freq, gain = 1) => {
    const o = add(ctx.createOscillator()); o.type = type; o.frequency.value = freq;
    const gg = ctx.createGain(); gg.gain.value = gain;
    o.connect(gg); gg.connect(g); o.start(t);
    return { o, gg };
  };
  const lfo = (target, rate, depth, base) => {
    const l = add(ctx.createOscillator()); l.frequency.value = rate;
    const lg = ctx.createGain(); lg.gain.value = depth;
    l.connect(lg); lg.connect(target); l.start(t);
    if (base !== undefined) target.value = base;
  };
  let tick = null;
  switch (name) {
    case 'snore': { const n = noiseSrc('bandpass', 180, 2, 1); lfo(n.gg.gain, 0.22, 0.9, 0.5); const o = osc('sawtooth', 55, 0.25); lfo(o.gg.gain, 0.22, 0.25, 0.1); break; }
    case 'vacuum': { noiseSrc('bandpass', 900, 0.8, 0.8); const o = osc('sawtooth', 110, 0.08); lfo(o.o.frequency, 0.3, 4, 110); osc('sine', 2200, 0.03); break; }
    case 'fridge': { osc('sine', 60, 0.5); osc('sine', 120, 0.2); noiseSrc('lowpass', 200, 0.5, 0.3); break; }
    case 'wind': { const n = noiseSrc('bandpass', 500, 0.5, 1); lfo(n.f.frequency, 0.08, 300, 500); lfo(n.gg.gain, 0.13, 0.4, 0.6); break; }
    case 'room': { noiseSrc('lowpass', 250, 0.5, 0.5); osc('sine', 50, 0.12); break; }
    case 'traffic': { noiseSrc('lowpass', 300, 0.5, 1); break; }
    case 'whine': { const o = osc('sawtooth', 620, 0.2); lfo(o.o.frequency, 7, 25, 620); break; }
    case 'flybuzz': { const o = osc('sawtooth', 190, 0.22); lfo(o.o.frequency, 11, 18, 190); const o2 = osc('square', 380, 0.04); lfo(o2.o.frequency, 9, 30, 380); break; }
    case 'hum': { osc('sawtooth', 100, 0.15); osc('square', 50, 0.05); noiseSrc('highpass', 6000, 0.5, 0.2); break; }
    case 'micro': { const n = noiseSrc('lowpass', 180, 1, 1); lfo(n.f.frequency, 0.05, 80, 180); const o = osc('sine', 41, 0.4); lfo(o.gg.gain, 0.1, 0.3, 0.3); break; }
    case 'heat': { noiseSrc('highpass', 4000, 0.3, 0.6); break; }
    case 'water': { const n = noiseSrc('bandpass', 1400, 0.4, 1); lfo(n.f.frequency, 0.5, 500, 1400); break; }
    case 'birds': {
      noiseSrc('bandpass', 3000, 0.4, 0.08);
      tick = setInterval(() => {
        if (!ctx || Math.random() < 0.4) return;
        const tt = ctx.currentTime;
        const base = 2000 + Math.random() * 2500;
        const n = 2 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) tone(g, tt + i * 0.09, 0.07, { freq: base * (1 + (Math.random() - 0.5) * 0.3), freqEnd: base * 1.3, vol: 0.12 });
      }, 700);
      break;
    }
    case 'clock': {
      tick = setInterval(() => { if (ctx) noise(g, ctx.currentTime, 0.02, { freq: 4000, q: 4, vol: 0.5 }); }, 1000);
      break;
    }
    default: break;
  }
  const target = opts.vol ?? 1;
  g.gain.setTargetAtTime(target, t, opts.fade ?? 0.5);
  return {
    setVolume(v, tc = 0.2) { if (ctx) g.gain.setTargetAtTime(v, ctx.currentTime, tc); },
    setPos(p) { if (dest.positionX || dest.setPosition) setPannerPos(dest, p); },
    setRate(r) { nodes.forEach((n) => { if (n.playbackRate) n.playbackRate.value = r; }); },
    stop(fade = 0.4) {
      if (tick) clearInterval(tick);
      if (!ctx) return;
      g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
      const end = ctx.currentTime + fade + 0.1;
      nodes.forEach((n) => { try { n.stop(end); } catch (e) { /* already stopped */ } });
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* ignore */ } }, (fade + 0.3) * 1000);
    },
  };
}

function nullLoop() { return { setVolume() {}, setPos() {}, setRate() {}, stop() {} }; }

// ---------------------------------------------------------------- generative music
const MOODS = {
  menu:    { root: 57, prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 5], [-2, 2, 5, 9]], bpm: 60, pad: 0.1, pluck: 0.07, kick: 0, cutoff: 1200 },
  night:   { root: 52, prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [2, 5, 9, 12]], bpm: 56, pad: 0.09, pluck: 0.05, kick: 0, cutoff: 900 },
  wonder:  { root: 60, prog: [[0, 4, 7, 14], [5, 9, 12, 16], [-3, 0, 4, 11], [7, 11, 14, 17]], bpm: 70, pad: 0.1, pluck: 0.08, kick: 0, cutoff: 1800 },
  tension: { root: 50, prog: [[0, 3, 7, 8], [0, 3, 6, 10], [-1, 3, 6, 9], [0, 3, 7, 13]], bpm: 84, pad: 0.1, pluck: 0.04, kick: 0.25, cutoff: 700 },
  digital: { root: 57, prog: [[0, 3, 7, 12], [3, 7, 10, 15], [-4, 0, 3, 8], [-2, 2, 5, 10]], bpm: 118, pad: 0.06, pluck: 0.07, kick: 0.3, cutoff: 2600, square: true },
  outdoor: { root: 55, prog: [[0, 4, 7, 12], [7, 11, 14, 19], [9, 12, 16, 21], [5, 9, 12, 17]], bpm: 76, pad: 0.08, pluck: 0.09, kick: 0, cutoff: 2200 },
  danger:  { root: 45, prog: [[0, 1, 7, 12], [0, 3, 6, 12], [0, 1, 6, 11], [-1, 2, 6, 11]], bpm: 128, pad: 0.12, pluck: 0.05, kick: 0.45, cutoff: 900 },
  micro:   { root: 48, prog: [[0, 7, 14, 19], [3, 10, 15, 22], [-2, 5, 12, 17], [5, 12, 17, 24]], bpm: 48, pad: 0.12, pluck: 0.06, kick: 0, cutoff: 700, shimmer: true },
  finale:  { root: 55, prog: [[0, 4, 7, 12], [-3, 0, 4, 9], [5, 9, 12, 17], [7, 11, 14, 19]], bpm: 90, pad: 0.12, pluck: 0.1, kick: 0.35, cutoff: 3000 },
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function playMusic(mood) {
  if (!ctx) return;
  if (musicState && musicState.mood === mood) return;
  stopMusic(2.5);
  if (!mood || !MOODS[mood]) return;
  const M = MOODS[mood];
  const bus = ctx.createGain();
  bus.gain.value = 0;
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = M.cutoff; filt.Q.value = 0.6;
  const verb = ctx.createGain(); verb.gain.value = 0.5;
  bus.connect(filt); filt.connect(musicBus); filt.connect(verb); verb.connect(reverb);
  bus.gain.setTargetAtTime(1, ctx.currentTime, 2);
  const state = { mood, bus, bar: 0, timer: null, next: ctx.currentTime + 0.1 };
  const beat = 60 / M.bpm;
  const barLen = beat * 4;
  const schedule = () => {
    if (!ctx) return;
    while (state.next < ctx.currentTime + 1.5) {
      const chord = M.prog[state.bar % M.prog.length];
      const t = state.next;
      // Pad: detuned saws per chord tone
      chord.forEach((iv) => {
        const f = midi(M.root + iv);
        [-7, 7].forEach((det) => {
          const o = ctx.createOscillator(); o.type = M.square ? 'square' : 'sawtooth'; o.frequency.value = f; o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(M.pad * 0.25, t + barLen * 0.3);
          g.gain.exponentialRampToValueAtTime(0.0001, t + barLen * 1.05);
          o.connect(g); g.connect(bus); o.start(t); o.stop(t + barLen * 1.1);
        });
      });
      // Bass
      tone(bus, t, barLen * 0.9, { type: 'sine', freq: midi(M.root + chord[0] - 12), vol: M.pad * 0.9, attack: 0.05 });
      // Plucks: a gentle arpeggio that varies bar to bar
      const steps = M.bpm > 100 ? 8 : 4;
      for (let i = 0; i < steps; i++) {
        if (Math.random() < 0.3) continue;
        const iv = chord[Math.floor(Math.random() * chord.length)] + (Math.random() < 0.5 ? 12 : 0);
        tone(bus, t + i * barLen / steps, 0.6, { type: 'triangle', freq: midi(M.root + iv + 12), vol: M.pluck });
      }
      if (M.shimmer) for (let i = 0; i < 3; i++) tone(bus, t + Math.random() * barLen, 1.5, { type: 'sine', freq: midi(M.root + 36 + chord[i % 4]), vol: 0.02, attack: 0.4 });
      if (M.kick) for (let i = 0; i < 4; i++) {
        tone(bus, t + i * beat, 0.25, { type: 'sine', freq: 110, freqEnd: 40, vol: M.kick });
        if (i % 2 === 1) noise(bus, t + i * beat, 0.08, { type: 'highpass', freq: 6000, vol: M.kick * 0.25 });
      }
      state.next += barLen;
      state.bar++;
    }
  };
  schedule();
  state.timer = setInterval(schedule, 400);
  musicState = state;
}

export function stopMusic(fade = 1.5) {
  if (!musicState || !ctx) { musicState = null; return; }
  const s = musicState;
  clearInterval(s.timer);
  s.bus.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
  setTimeout(() => { try { s.bus.disconnect(); } catch (e) { /* ignore */ } }, fade * 1000 + 3000);
  musicState = null;
}

// ---------------------------------------------------------------- voice (text-to-speech)
let chosenVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const pref = ['Google UK English Male', 'Daniel', 'Alex', 'Microsoft Guy', 'Microsoft Ryan', 'Microsoft David', 'Aaron', 'Fred'];
  for (const p of pref) { const v = en.find((x) => x.name.includes(p)); if (v) return v; }
  return en.find((v) => /male/i.test(v.name) && !/female/i.test(v.name)) || en[0] || voices[0];
}
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { chosenVoice = pickVoice(); };
}

export function speak(text, { pitch = 1.05, rate = 1.02, onend } = {}) {
  if (!getSettings().voice || !('speechSynthesis' in window)) { if (onend) onend(); return false; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_]/g, ''));
    if (!chosenVoice) chosenVoice = pickVoice();
    if (chosenVoice) u.voice = chosenVoice;
    u.pitch = pitch; u.rate = rate;
    u.volume = Math.min(1, getSettings().masterVolume * 1.1);
    if (onend) u.onend = onend;
    speechSynthesis.speak(u);
    return true;
  } catch (e) { if (onend) onend(); return false; }
}

export function stopSpeaking() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
