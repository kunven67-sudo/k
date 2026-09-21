// Central procedural WebAudio helper. Every sound effect in the game is synthesized here
// (oscillators + generated noise buffers) - no audio files. Everything routes through a
// single master gain node so the Settings volume slider affects all of it uniformly.
import { getSettings, onSettingsChange } from './settings.js';

let ctx = null;
let master = null;
let droneBus = null; // gain node ambient drones connect through, separate from one-shot SFX
let droneOscs = [];
let hissSource = null;
let hissGain = null;
let horrorIntensity = 0;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return; // very old browser, fail silently - game still playable without sound
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = getSettings().volume;
  master.connect(ctx.destination);
  onSettingsChange(s => { if (master) master.gain.setTargetAtTime(s.volume, ctx.currentTime, 0.05); });
}

// Some browsers create AudioContext in "suspended" state until a user gesture; call this
// from the first click/keydown handler.
export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function now() { return ctx ? ctx.currentTime : 0; }

function noiseBuffer(dur) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(sr * dur)), sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function tone({ freq = 440, type = 'sine', dur = 0.2, attack = 0.005, decay = 0.1, sustainLevel = 0.5,
  release = 0.15, gain = 0.3, detune = 0, freqEnd = null, delay = 0, destination = null } = {}) {
  if (!ctx) return;
  const dest = destination || master;
  const t0 = now() + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  osc.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * sustainLevel), t0 + attack + decay);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay + release);
  osc.connect(g); g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + attack + decay + release + 0.05);
  return { osc, g };
}

function noiseBurst({ dur = 0.25, gain = 0.3, filterType = 'lowpass', filterFreq = 1200, filterQ = 0.7,
  attack = 0.005, release = 0.2, delay = 0, destination = null, freqRamp = null } = {}) {
  if (!ctx) return;
  const dest = destination || master;
  const t0 = now() + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + release + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, t0);
  if (freqRamp) filter.frequency.linearRampToValueAtTime(freqRamp, t0 + dur);
  filter.Q.value = filterQ;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur + release);
  src.connect(filter); filter.connect(g); g.connect(dest);
  src.start(t0);
  src.stop(t0 + attack + dur + release + 0.05);
}

// ---------- Gameplay SFX ----------
export function playShotgunBlast() {
  noiseBurst({ dur: 0.12, gain: 0.9, filterType: 'lowpass', filterFreq: 3200, attack: 0.001, release: 0.22 });
  tone({ freq: 130, freqEnd: 38, type: 'sawtooth', dur: 0.18, attack: 0.001, decay: 0.05, sustainLevel: 0.3, release: 0.15, gain: 0.55 });
}

export function playPump() {
  noiseBurst({ dur: 0.06, gain: 0.5, filterType: 'bandpass', filterFreq: 900, filterQ: 2, attack: 0.001, release: 0.05 });
  noiseBurst({ dur: 0.05, gain: 0.4, filterType: 'bandpass', filterFreq: 1400, filterQ: 3, attack: 0.001, release: 0.05, delay: 0.11 });
}

export function playEmptyClick() {
  tone({ freq: 900, type: 'square', dur: 0.03, attack: 0.001, decay: 0.02, sustainLevel: 0.2, release: 0.03, gain: 0.25 });
}

export function playDuckQuack() {
  const f = 380 + Math.random() * 90;
  tone({ freq: f, freqEnd: f * 0.6, type: 'sawtooth', dur: 0.12, attack: 0.005, decay: 0.05, sustainLevel: 0.5, release: 0.08, gain: 0.28 });
}

export function playDuckHitSquawk() {
  tone({ freq: 500, freqEnd: 150, type: 'square', dur: 0.22, attack: 0.001, decay: 0.05, sustainLevel: 0.5, release: 0.15, gain: 0.35, detune: -20 });
  noiseBurst({ dur: 0.15, gain: 0.25, filterType: 'highpass', filterFreq: 1500, release: 0.1 });
}

export function playWingFlap() {
  noiseBurst({ dur: 0.1, gain: 0.15, filterType: 'bandpass', filterFreq: 700, filterQ: 1, release: 0.08 });
}

export function playFootstep(surface = 'wood') {
  const cfg = {
    wood: { freq: 1400, gain: 0.14 },
    tile: { freq: 2200, gain: 0.12 },
    carpet: { freq: 500, gain: 0.1 },
    grass: { freq: 900, gain: 0.1 },
  }[surface] || { freq: 1400, gain: 0.12 };
  noiseBurst({ dur: 0.045, gain: cfg.gain, filterType: 'bandpass', filterFreq: cfg.freq, filterQ: 1.2, attack: 0.001, release: 0.05 });
}

export function playDoorbell() {
  tone({ freq: 784, type: 'sine', dur: 0.35, attack: 0.01, decay: 0.1, sustainLevel: 0.6, release: 0.3, gain: 0.3 });
  tone({ freq: 622, type: 'sine', dur: 0.45, attack: 0.01, decay: 0.1, sustainLevel: 0.6, release: 0.4, gain: 0.3, delay: 0.32 });
}

export function playDoorCreak() {
  if (!ctx) return;
  const t0 = now();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.7);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(280, t0);
  filter.frequency.linearRampToValueAtTime(650, t0 + 0.35);
  filter.frequency.linearRampToValueAtTime(320, t0 + 0.7);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
  src.connect(filter); filter.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + 0.75);
}

export function playBoxOpen() {
  noiseBurst({ dur: 0.3, gain: 0.35, filterType: 'bandpass', filterFreq: 1800, filterQ: 0.8, attack: 0.01, release: 0.2 });
  noiseBurst({ dur: 0.2, gain: 0.25, filterType: 'bandpass', filterFreq: 900, filterQ: 1.2, attack: 0.01, release: 0.2, delay: 0.15 });
}

export function playDiscInsert() {
  noiseBurst({ dur: 0.08, gain: 0.2, filterType: 'highpass', filterFreq: 2000, release: 0.06 });
  tone({ freq: 220, type: 'square', dur: 0.04, attack: 0.001, decay: 0.02, sustainLevel: 0.3, release: 0.04, gain: 0.18, delay: 0.1 });
}

export function playDialogueBlip() {
  tone({ freq: 260 + Math.random() * 120, type: 'square', dur: 0.02, attack: 0.001, decay: 0.01, sustainLevel: 0.3, release: 0.02, gain: 0.12 });
}

export function playUIClick() {
  tone({ freq: 520, type: 'square', dur: 0.03, attack: 0.001, decay: 0.02, sustainLevel: 0.3, release: 0.03, gain: 0.18 });
}

export function playUIHover() {
  tone({ freq: 700, type: 'sine', dur: 0.02, attack: 0.001, decay: 0.01, sustainLevel: 0.2, release: 0.02, gain: 0.08 });
}

export function playAchievementJingle() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone({ freq: f, type: 'triangle', dur: 0.16, attack: 0.005, decay: 0.05, sustainLevel: 0.5, release: 0.15, gain: 0.22, delay: i * 0.09 });
  });
}

export function playDogBark() {
  noiseBurst({ dur: 0.05, gain: 0.3, filterType: 'lowpass', filterFreq: 1200, release: 0.05 });
  tone({ freq: 220, freqEnd: 140, type: 'sawtooth', dur: 0.1, attack: 0.001, decay: 0.04, sustainLevel: 0.4, release: 0.08, gain: 0.3 });
}

export function playDogPant() {
  noiseBurst({ dur: 0.08, gain: 0.08, filterType: 'bandpass', filterFreq: 1600, filterQ: 1, release: 0.08 });
  noiseBurst({ dur: 0.08, gain: 0.07, filterType: 'bandpass', filterFreq: 1500, filterQ: 1, release: 0.08, delay: 0.16 });
}

export function playDogLaugh() {
  // playful chuckle - a few quick ascending "yip" blips, NOT the growl/sting used for horror beats
  [0, 0.12, 0.24].forEach((d, i) => {
    tone({ freq: 300 + i * 60, freqEnd: 380 + i * 60, type: 'triangle', dur: 0.08, attack: 0.005, decay: 0.03,
      sustainLevel: 0.5, release: 0.06, gain: 0.22, delay: d });
  });
}

export function playDogYelp() {
  // A single startled yelp - used only for the moment the dog gets shot (dark ending trigger).
  tone({ freq: 700, freqEnd: 260, type: 'square', dur: 0.18, attack: 0.001, decay: 0.04, sustainLevel: 0.5, release: 0.14, gain: 0.32 });
  noiseBurst({ dur: 0.1, gain: 0.2, filterType: 'highpass', filterFreq: 1800, release: 0.08, delay: 0.02 });
}

export function playDogGrowlSting() {
  // low, detuned, slightly wobbling growl for the "something's wrong" beats
  if (!ctx) return;
  const t0 = now();
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, t0);
  osc.frequency.linearRampToValueAtTime(55, t0 + 0.8);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 6.5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 8;
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
  osc.connect(g); g.connect(master);
  osc.start(t0); lfo.start(t0);
  osc.stop(t0 + 0.95); lfo.stop(t0 + 0.95);
}

export function playGlitchWhoosh() {
  noiseBurst({ dur: 0.3, gain: 0.4, filterType: 'bandpass', filterFreq: 2200, filterQ: 0.6, release: 0.2, freqRamp: 300 });
  tone({ freq: 900, freqEnd: 80, type: 'square', dur: 0.35, attack: 0.001, decay: 0.1, sustainLevel: 0.4, release: 0.2, gain: 0.2 });
}

export function playTVShutoff() {
  tone({ freq: 1200, freqEnd: 40, type: 'square', dur: 0.4, attack: 0.001, decay: 0.15, sustainLevel: 0.3, release: 0.2, gain: 0.3 });
  noiseBurst({ dur: 0.05, gain: 0.3, filterType: 'highpass', filterFreq: 3000, release: 0.05, delay: 0.02 });
}

// ---------- Ambient drone bed ----------
export function startAmbientDrone(kind = 'menu') {
  if (!ctx) return;
  stopAmbientDrone();
  droneBus = ctx.createGain();
  droneBus.gain.value = kind === 'menu' ? 0.06 : 0.05;
  droneBus.connect(master);
  const freqs = kind === 'menu' ? [110, 165, 220] : [82, 123, 164.5];
  droneOscs = freqs.map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = f;
    o.detune.value = (i - 1) * 4;
    const g = ctx.createGain();
    g.gain.value = 1 / freqs.length;
    o.connect(g); g.connect(droneBus);
    o.start();
    return o;
  });

  hissGain = ctx.createGain();
  hissGain.gain.value = 0.0001;
  const hiss = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  hiss.buffer = buf; hiss.loop = true;
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'highpass';
  hissFilter.frequency.value = 4000;
  hiss.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(master);
  hiss.start();
  hissSource = hiss;
  horrorIntensity = 0;
}

export function stopAmbientDrone() {
  droneOscs.forEach(o => { try { o.stop(); } catch (e) { /* already stopped */ } });
  droneOscs = [];
  if (hissSource) { try { hissSource.stop(); } catch (e) { /* already stopped */ } hissSource = null; }
  droneBus = null; hissGain = null;
}

// Ramps the ambient bed toward a more unsettling texture as the duck-hunt horror arc escalates.
// level is 0 (normal) to 1 (full escalation).
export function setHorrorIntensity(level) {
  horrorIntensity = Math.max(0, Math.min(1, level));
  if (!ctx) return;
  const t = ctx.currentTime;
  droneOscs.forEach((o, i) => {
    o.detune.setTargetAtTime((i - 1) * (4 + horrorIntensity * 40), t, 0.4);
  });
  if (hissGain) hissGain.gain.setTargetAtTime(0.008 + horrorIntensity * 0.05, t, 0.4);
  if (droneBus) droneBus.gain.setTargetAtTime(0.05 + horrorIntensity * 0.03, t, 0.4);
}
