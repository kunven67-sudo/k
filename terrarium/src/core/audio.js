// All sound is made in code: sound effects, babble voices and the music tracks.
import { settings } from './settings.js';
import { clamp, rand } from './util.js';

let ctx = null;
let master, musicBus, sfxBus, voiceBus, noiseBuf;
const loops = new Map();

export function audioCtx() { return ctx; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; return; }
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  voiceBus = ctx.createGain(); voiceBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
}

export function applyVolumes() {
  if (!ctx) return;
  master.gain.value = settings.master;
  musicBus.gain.value = settings.music * 0.6;
  sfxBus.gain.value = settings.sfx;
  voiceBus.gain.value = settings.voices;
}

export const voiceOut = () => voiceBus;

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function osc(type, f, t, dur, vol, bus = sfxBus, f2 = null) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  env(g, t, Math.min(0.01, dur * 0.2), vol, dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
  return o;
}

function noise(t, dur, vol, filterType = 'bandpass', freq = 1000, q = 1, bus = sfxBus, freq2 = null) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = filterType; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.005, vol, dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

// vol scaled by how far away the sound is (dist in "player sizes")
export function sfx(name, opts = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  const v = clamp(opts.vol ?? 1, 0, 2);
  if (v < 0.02) return;
  const p = opts.pitch ?? 1;
  switch (name) {
    case 'zap': osc('sawtooth', 900 * p, t, 0.18, 0.18 * v, sfxBus, 180 * p); osc('square', 1800 * p, t, 0.08, 0.06 * v, sfxBus, 600); break;
    case 'beam': osc('sine', 1200 * p, t, 0.25, 0.12 * v, sfxBus, 300 * p); noise(t, 0.2, 0.08 * v, 'highpass', 3000); break;
    case 'shrink': osc('sine', 1200 * p, t, 0.5, 0.2 * v, sfxBus, 2600 * p); osc('triangle', 600, t + 0.05, 0.45, 0.1 * v, sfxBus, 1500); break;
    case 'grow': osc('sine', 1400 * p, t, 0.6, 0.2 * v, sfxBus, 220 * p); osc('triangle', 300, t, 0.6, 0.12 * v, sfxBus, 80); break;
    case 'poof': noise(t, 0.25, 0.25 * v, 'bandpass', 1800 * p, 0.8, sfxBus, 300); osc('sine', 500 * p, t, 0.15, 0.15 * v, sfxBus, 1200 * p); break;
    case 'fizzle': noise(t, 0.4, 0.15 * v, 'bandpass', 2500, 2, sfxBus, 600); osc('square', 200, t, 0.3, 0.04 * v, sfxBus, 90); break;
    case 'squish': noise(t, 0.18, 0.4 * v, 'lowpass', 900 * p, 2, sfxBus, 200); osc('sine', 160 * p, t, 0.15, 0.25 * v, sfxBus, 60); break;
    case 'splat': noise(t, 0.12, 0.35 * v, 'lowpass', 1400 * p, 1, sfxBus, 300); break;
    case 'slice': noise(t, 0.12, 0.25 * v, 'highpass', 3500 * p, 1, sfxBus, 7000); noise(t + 0.04, 0.12, 0.3 * v, 'lowpass', 900, 2); break;
    case 'thud': osc('sine', 110 * p, t, 0.18, 0.35 * v, sfxBus, 45); noise(t, 0.08, 0.15 * v, 'lowpass', 500); break;
    case 'hit': osc('triangle', 220 * p, t, 0.08, 0.25 * v, sfxBus, 90); noise(t, 0.06, 0.2 * v, 'bandpass', 1200 * p); break;
    case 'glass': osc('sine', 2400 * p, t, 0.35, 0.12 * v); osc('sine', 3700 * p, t, 0.2, 0.06 * v); break;
    case 'crack': noise(t, 0.3, 0.35 * v, 'highpass', 2000, 1); osc('square', 900, t, 0.05, 0.05 * v, sfxBus, 300); break;
    case 'shatter': for (let i = 0; i < 8; i++) osc('sine', 2000 + Math.random() * 4000, t + i * 0.03, 0.3, 0.06 * v); noise(t, 0.5, 0.3 * v, 'highpass', 2500); break;
    case 'step': noise(t, 0.05, 0.08 * v, 'lowpass', 600 * p, 1); break;
    case 'pick': osc('sine', 500 * p, t, 0.08, 0.12 * v, sfxBus, 900 * p); break;
    case 'drop': osc('sine', 700 * p, t, 0.1, 0.1 * v, sfxBus, 300 * p); break;
    case 'click': osc('square', 1300, t, 0.03, 0.05 * v); break;
    case 'ui': osc('triangle', 880, t, 0.06, 0.07 * v); osc('triangle', 1320, t + 0.04, 0.06, 0.05 * v); break;
    case 'error': osc('square', 220, t, 0.12, 0.08 * v); osc('square', 180, t + 0.1, 0.15, 0.08 * v); break;
    case 'freeze': for (let i = 0; i < 5; i++) osc('sine', 3000 + i * 600, t + i * 0.04, 0.25, 0.05 * v); noise(t, 0.4, 0.12 * v, 'highpass', 6000); break;
    case 'teleport': osc('sine', 300, t, 0.4, 0.15 * v, sfxBus, 2400); osc('sine', 2400, t + 0.2, 0.3, 0.1 * v, sfxBus, 300); break;
    case 'fire': noise(t, 0.6, 0.2 * v, 'bandpass', 700, 0.6, sfxBus, 300); break;
    case 'explode': noise(t, 1.2, 0.6 * v, 'lowpass', 1200 * p, 0.7, sfxBus, 80); osc('sine', 90 * p, t, 0.8, 0.5 * v, sfxBus, 30); break;
    case 'thunder': noise(t, 2.5, 0.5 * v, 'lowpass', 600, 0.5, sfxBus, 60); osc('sine', 60, t, 1.5, 0.3 * v, sfxBus, 30); break;
    case 'coin': osc('square', 1600, t, 0.06, 0.06 * v); osc('square', 2400, t + 0.06, 0.12, 0.06 * v); break;
    case 'chop': noise(t, 0.07, 0.3 * v, 'bandpass', 900 * p, 3); osc('triangle', 300 * p, t, 0.05, 0.15 * v, sfxBus, 150); break;
    case 'mine': osc('square', 1800 * p, t, 0.05, 0.08 * v, sfxBus, 900); noise(t, 0.06, 0.2 * v, 'highpass', 2500); break;
    case 'hammer': osc('triangle', 600 * p, t, 0.05, 0.15 * v, sfxBus, 300); noise(t, 0.04, 0.15 * v, 'bandpass', 2000); break;
    case 'heart': osc('sine', 660, t, 0.15, 0.1 * v); osc('sine', 880, t + 0.12, 0.25, 0.1 * v); break;
    case 'bite': noise(t, 0.08, 0.3 * v, 'bandpass', 2500 * p, 2); osc('square', 400 * p, t, 0.04, 0.05 * v); break;
    case 'door': osc('sawtooth', 90, t, 0.4, 0.05 * v, sfxBus, 70); noise(t, 0.3, 0.06 * v, 'lowpass', 400); break;
    case 'slide': noise(t, 0.9, 0.12 * v, 'lowpass', 300, 1, sfxBus, 200); osc('sawtooth', 60, t, 0.9, 0.04 * v, sfxBus, 50); break;
    case 'bubble': for (let i = 0; i < 4; i++) osc('sine', 300 + Math.random() * 500, t + i * 0.07, 0.08, 0.08 * v, sfxBus, 900); break;
    case 'drum': osc('sine', 140 * p, t, 0.2, 0.3 * v, sfxBus, 50); break;
    case 'horn': osc('square', 400, t, 0.4, 0.08 * v); osc('square', 500, t, 0.4, 0.08 * v); break;
    case 'siren': { const o = osc('sawtooth', 700, t, 1.6, 0.06 * v); o.frequency.linearRampToValueAtTime(1100, t + 0.4); o.frequency.linearRampToValueAtTime(700, t + 0.8); o.frequency.linearRampToValueAtTime(1100, t + 1.2); o.frequency.linearRampToValueAtTime(700, t + 1.6); break; }
    case 'cash': osc('triangle', 1200, t, 0.08, 0.08 * v); osc('triangle', 1800, t + 0.08, 0.2, 0.08 * v); noise(t, 0.1, 0.05 * v, 'highpass', 5000); break;
    case 'machine': osc('sawtooth', 55, t, 1.2, 0.08 * v, sfxBus, 110); osc('sine', 220, t, 1.2, 0.05 * v, sfxBus, 880); break;
    case 'steam': noise(t, 1.2, 0.2 * v, 'highpass', 3000, 0.5, sfxBus, 1200); break;
    case 'cough': noise(t, 0.12, 0.2 * v, 'bandpass', 800 * p, 2); noise(t + 0.18, 0.1, 0.15 * v, 'bandpass', 700 * p, 2); break;
    case 'electric': for (let i = 0; i < 6; i++) noise(t + i * 0.04, 0.03, 0.2 * v, 'bandpass', 3000 + Math.random() * 3000, 4); break;
    case 'blackhole': osc('sine', 80, t, 2.5, 0.3 * v, sfxBus, 25); noise(t, 2.5, 0.15 * v, 'lowpass', 400, 1, sfxBus, 60); break;
    case 'wind': noise(t, 1.5, 0.12 * v, 'bandpass', 500, 0.5, sfxBus, 900); break;
    case 'engine': osc('sawtooth', 50 * p, t, 0.5, 0.05 * v, sfxBus, 55 * p); break;
    default: break;
  }
}

// Looping ambience (rain, fire, machine hum). Call setLoop(name, vol) each frame or when it changes.
export function setLoop(name, vol) {
  if (!ctx) return;
  let l = loops.get(name);
  if (!l && vol <= 0.001) return;
  if (!l) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain(); g.gain.value = 0;
    if (name === 'rain') { f.type = 'highpass'; f.frequency.value = 1500; }
    else if (name === 'fire') { f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.5; }
    else if (name === 'hum') { f.type = 'lowpass'; f.frequency.value = 160; }
    else if (name === 'traffic') { f.type = 'lowpass'; f.frequency.value = 300; }
    else if (name === 'wind') { f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.4; }
    else { f.type = 'lowpass'; f.frequency.value = 800; }
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start();
    l = { s, g };
    loops.set(name, l);
  }
  l.g.gain.setTargetAtTime(clamp(vol, 0, 1) * 0.5, ctx.currentTime, 0.2);
}

// ------------------------------------------------------------- music
// A few hand-written procedural tracks. The player picks one; it does not change by itself.
export const TRACKS = {
  lab: { name: 'Basement Hum', bpm: 70, root: 45, scale: [0, 3, 7, 10, 14], style: 'pad' },
  chill: { name: 'Glass Garden', bpm: 84, root: 57, scale: [0, 4, 7, 9, 11, 14], style: 'arp' },
  tense: { name: 'Something Is Wrong', bpm: 118, root: 40, scale: [0, 1, 5, 7, 8], style: 'drive' },
  tiny: { name: 'Small World Epic', bpm: 96, root: 50, scale: [0, 2, 3, 7, 10, 12], style: 'epic' },
  spooky: { name: 'Pumpkin Lab', bpm: 76, root: 47, scale: [0, 1, 4, 6, 7, 11], style: 'spooky' },
  off: { name: 'No music', off: true },
};

let musicTimer = null;
let musicStep = 0;
let mp3El = null;
let mp3Node = null;

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (mp3El) { mp3El.pause(); }
}

export function playMp3(file) {
  if (!ctx) initAudio();
  if (!ctx) return;
  stopMusic();
  if (!mp3El) {
    mp3El = new Audio();
    mp3El.loop = true;
    mp3Node = ctx.createMediaElementSource(mp3El);
    mp3Node.connect(musicBus);
  }
  if (mp3El.src) URL.revokeObjectURL(mp3El.src);
  mp3El.src = URL.createObjectURL(file);
  mp3El.play().catch(() => {});
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function note(f, t, dur, vol, type = 'triangle', cutoff = 2000) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const fl = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = type; o2.type = type;
  o.frequency.value = f; o2.frequency.value = f * 1.004;
  fl.type = 'lowpass'; fl.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(musicBus);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}

function kick(t, vol) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25);
}

function hat(t, vol) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.06);
}

export function playTrack(id) {
  if (!ctx) initAudio();
  if (!ctx) return;
  stopMusic();
  const tr = TRACKS[id] || TRACKS.lab;
  if (tr.off) return;
  musicStep = 0;
  const stepDur = 60 / tr.bpm / 2; // eighth notes
  let next = ctx.currentTime + 0.1;
  const prog = [0, 3, 4, 2];
  const tick = () => {
    while (next < ctx.currentTime + 0.4) {
      const s = musicStep++;
      const bar = Math.floor(s / 8) % prog.length;
      const deg = prog[bar];
      const sc = tr.scale;
      const chordRoot = tr.root + sc[deg % sc.length];
      const beat = s % 8;
      if (tr.style === 'pad') {
        if (beat === 0) { note(mtof(chordRoot), next, stepDur * 8, 0.05, 'sawtooth', 500); note(mtof(chordRoot + 7), next, stepDur * 8, 0.035, 'sawtooth', 600); note(mtof(chordRoot + 15), next, stepDur * 8, 0.02, 'sine', 900); }
        if (beat === 5 && rand() < 0.5) note(mtof(tr.root + 24 + sc[(s * 3) % sc.length]), next, stepDur * 3, 0.03, 'sine', 3000);
      } else if (tr.style === 'arp') {
        const n = chordRoot + 12 + sc[(beat * 2) % sc.length];
        note(mtof(n), next, stepDur * 1.6, 0.045, 'triangle', 2500);
        if (beat === 0) note(mtof(chordRoot - 12), next, stepDur * 8, 0.06, 'sine', 400);
        if (beat % 4 === 2) hat(next, 0.03);
      } else if (tr.style === 'drive') {
        if (beat % 2 === 0) kick(next, 0.35);
        hat(next, beat % 2 ? 0.05 : 0.02);
        note(mtof(chordRoot - 12 + (beat % 2 ? 12 : 0)), next, stepDur * 0.9, 0.07, 'sawtooth', 700);
        if (beat === 0) note(mtof(chordRoot + 12), next, stepDur * 6, 0.03, 'square', 1200);
      } else if (tr.style === 'epic') {
        if (beat === 0 || beat === 3 || beat === 6) kick(next, 0.3);
        if (beat === 0) { note(mtof(chordRoot), next, stepDur * 8, 0.05, 'sawtooth', 900); note(mtof(chordRoot + 7), next, stepDur * 8, 0.04, 'sawtooth', 900); }
        note(mtof(chordRoot + 12 + sc[(beat + bar) % sc.length]), next, stepDur * 0.8, 0.035, 'square', 1800);
      } else if (tr.style === 'spooky') {
        if (beat === 0) note(mtof(chordRoot - 12), next, stepDur * 8, 0.06, 'sine', 300);
        if (beat % 3 === 0) note(mtof(chordRoot + 12 + sc[(s * 5) % sc.length]), next, stepDur * 2, 0.04, 'sine', 4000);
        if (beat === 4) note(mtof(chordRoot + 13), next, stepDur * 3, 0.025, 'triangle', 2000);
      }
      next += stepDur;
    }
  };
  tick();
  musicTimer = setInterval(tick, 120);
}

// ------------------------------------------------------------- babble voice
// Each person has a voice: base pitch + speed + vowel color. Tiny people sound squeaky.
const VOWELS = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [440, 1020], [660, 1720]];
export function babble(text, voice, opts = {}) {
  if (!ctx) return 0;
  const vol = (opts.vol ?? 1) * 0.5;
  if (vol < 0.02) return text.length * 0.06;
  const pitch = voice.pitch * (opts.pitchMul ?? 1);
  const syl = Math.max(2, Math.min(40, Math.round(text.replace(/[^a-z]/gi, '').length / 2.6)));
  let t = ctx.currentTime + 0.02;
  const rate = voice.rate || 1;
  const angry = opts.angry, scared = opts.scared;
  for (let i = 0; i < syl; i++) {
    const d = (0.06 + Math.random() * 0.05) / rate;
    const vw = VOWELS[(voice.seed + i * 3 + (text.charCodeAt(i % text.length) || 0)) % VOWELS.length];
    const f0 = pitch * (1 + (Math.random() - 0.5) * (scared ? 0.5 : 0.2)) * (i === syl - 1 && text.endsWith('?') ? 1.25 : 1);
    const o = ctx.createOscillator();
    o.type = angry ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (0.92 + Math.random() * 0.16), t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * (angry ? 0.5 : 0.35), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = vw[0] * voice.formant; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = vw[1] * voice.formant; f2.Q.value = 6;
    const mix = ctx.createGain(); mix.gain.value = 1.6;
    o.connect(f1); o.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(g); g.connect(voiceBus);
    o.start(t); o.stop(t + d + 0.02);
    t += d + (text[i * 3] === ' ' ? 0.03 : 0.006) / rate;
  }
  return t - ctx.currentTime;
}
