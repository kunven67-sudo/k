// All sounds are synthesized live with WebAudio (no sound files). Sounds are "realistic":
// louder when close, muffled when you're inside something, echoey inside hollow things.
import { settings, onSettings } from './settings.js';

let ctx = null, master = null, muffle = null, verbSend = null, verb = null;
const noiseBufs = {};

export function initAudio() {
  if (ctx) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ctx.createGain(); master.gain.value = settings.volume;
  muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000;
  verb = ctx.createConvolver(); verb.buffer = impulse(1.6, 2.5);
  verbSend = ctx.createGain(); verbSend.gain.value = 0.08;
  muffle.connect(master); muffle.connect(verbSend); verbSend.connect(verb); verb.connect(master);
  master.connect(ctx.destination);
  onSettings((s) => { master.gain.value = s.volume; });
}
export function resumeAudio() { initAudio(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
export const audioCtx = () => ctx;
export const audioOut = () => muffle;

function impulse(sec, decay) {
  const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}
function noise(kind = 'white') {
  if (noiseBufs[kind]) return noiseBufs[kind];
  const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.5; }
    else d[i] = w;
  }
  noiseBufs[kind] = b; return b;
}

// Environment: how muffled/echoey everything sounds (0 = open room, 1 = deep inside something).
export function setEnclosure(inside, echo) {
  if (!ctx) return;
  const t = ctx.currentTime;
  muffle.frequency.setTargetAtTime(inside ? 2200 : 20000, t, 0.2);
  verbSend.gain.setTargetAtTime(0.08 + echo * 0.5, t, 0.3);
}

function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }

// one-shot sounds --------------------------------------------------------------------------
export const sfx = {
  click(vol = 0.3) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 1800; o.type = 'square'; env(g, t, 0.002, vol * 0.3, 0.04); o.connect(g).connect(muffle); o.start(t); o.stop(t + 0.06); },
  beep(f = 1400, dur = 0.08, vol = 0.25) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.type = 'sine'; env(g, t, 0.005, vol, dur); o.connect(g).connect(muffle); o.start(t); o.stop(t + dur + 0.05); },
  thud(vol = 0.5, pitch = 1) {
    if (!ctx || vol < 0.01) return; const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noise('brown'); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300 * pitch;
    const g = ctx.createGain(); env(g, t, 0.003, Math.min(1, vol), 0.18 / pitch); s.connect(f).connect(g).connect(muffle); s.start(t, Math.random()); s.stop(t + 0.3);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(90 * pitch, t); o.frequency.exponentialRampToValueAtTime(40 * pitch, t + 0.15);
    const g2 = ctx.createGain(); env(g2, t, 0.002, Math.min(1, vol) * 0.6, 0.15); o.connect(g2).connect(muffle); o.start(t); o.stop(t + 0.2);
  },
  tick(vol = 0.2, pitch = 1) { if (!ctx) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000 * pitch; f.Q.value = 2; const g = ctx.createGain(); env(g, t, 0.001, vol, 0.03); s.connect(f).connect(g).connect(muffle); s.start(t, Math.random()); s.stop(t + 0.05); },
  step(vol = 0.15, soft = 0.5) { if (!ctx) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise('pink'); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600 + (1 - soft) * 2500; const g = ctx.createGain(); env(g, t, 0.004, vol, 0.08); s.connect(f).connect(g).connect(muffle); s.start(t, Math.random()); s.stop(t + 0.12); },
  zap(vol = 0.4) {
    if (!ctx) return; const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noise(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 8; i++) g.gain.setValueAtTime(Math.random() * vol, t + i * 0.025);
    g.gain.setValueAtTime(0, t + 0.22); s.connect(f).connect(g).connect(muffle); s.start(t); s.stop(t + 0.25);
  },
  whoosh(up = false, vol = 0.4, dur = 0.8) {
    if (!ctx) return; const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noise('pink'); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(up ? 300 : 3000, t); f.frequency.exponentialRampToValueAtTime(up ? 3000 : 250, t + dur);
    const g = ctx.createGain(); env(g, t, dur * 0.3, vol, dur * 0.7); s.connect(f).connect(g).connect(muffle); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  },
  knock() { for (let i = 0; i < 3; i++) setTimeout(() => sfx.thud(0.7, 1.6), i * 180); },
  pop(vol = 0.3) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); env(g, t, 0.002, vol, 0.08); o.connect(g).connect(muffle); o.start(t); o.stop(t + 0.1); },
  hurt() { sfx.thud(0.8, 0.7); },
  splash(vol = 0.4) { if (!ctx) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.7; const g = ctx.createGain(); env(g, t, 0.01, vol, 0.45); s.connect(f).connect(g).connect(muffle); s.start(t, Math.random()); s.stop(t + 0.5); },
};

// Looping sounds (fans, hum, fizz). Returns {set(volume, rate), stop()}
export function loop(kind) {
  if (!ctx) return { set() {}, stop() {} };
  const g = ctx.createGain(); g.gain.value = 0; g.connect(muffle);
  let nodes = [];
  if (kind === 'hum' || kind === 'charge') {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = kind === 'hum' ? 60 : 180;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    o.connect(f).connect(g); o.start(); nodes = [o, f];
    return { set(v, rate = 1) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.05); o.frequency.setTargetAtTime((kind === 'hum' ? 60 : 180) * rate, ctx.currentTime, 0.05); }, stop() { o.stop(); g.disconnect(); } };
  }
  // noise-based: fan, wind, fizz, rumble
  const s = ctx.createBufferSource(); s.buffer = noise(kind === 'rumble' ? 'brown' : 'pink'); s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = kind === 'fizz' ? 'highpass' : 'lowpass';
  f.frequency.value = { fan: 900, wind: 500, fizz: 4000, rumble: 120 }[kind] || 800;
  s.connect(f).connect(g); s.start(0, Math.random() * 2); nodes = [s, f];
  return {
    set(v, rate = 1) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.08); s.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.1); },
    stop() { s.stop(); g.disconnect(); },
  };
}

// Distance-based volume: louder when close, scaled to how big YOU are (a fan sounds huge when tiny).
export function vol3d(dist, loudness, playerScale) {
  const d = Math.max(dist, 0.02 * playerScale);
  return Math.min(1, loudness / (1 + (d * d) / Math.max(1e-6, 0.25 * playerScale ** 0.6)));
}
