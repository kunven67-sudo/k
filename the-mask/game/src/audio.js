// THE MASK - sound. Everything is made live with Web Audio (no files): punches, guns, the black hole, rain, the
// grandfather clock, the rewind. Sounds can sit at a spot in the room (3D) and a small room echo glues them together.
import * as THREE from 'three';
import { S } from './settings.js';

let ctx = null, master, sfxBus, voiceBus, ambBus, verb, verbSend, noiseBuf, rainNodes = null;
const tmp = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3();
let spatialHRTF = false;

function makeNoise(c) {
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function makeVerb(c) { // small wooden room
  const len = (c.sampleRate * 0.9) | 0, b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  const v = c.createConvolver(); v.buffer = b; return v;
}

export const audio = {
  get ctx() { return ctx; },
  get ready() { return !!ctx; },
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); voiceBus = ctx.createGain(); ambBus = ctx.createGain();
    verb = makeVerb(ctx); verbSend = ctx.createGain(); verbSend.gain.value = 0.22;
    verbSend.connect(verb); verb.connect(master);
    for (const b of [sfxBus, voiceBus, ambBus]) b.connect(master);
    sfxBus.connect(verbSend); voiceBus.connect(verbSend);
    noiseBuf = makeNoise(ctx);
    this.applyVolumes();
    return ctx;
  },
  applyVolumes() {
    if (!ctx) return;
    master.gain.value = S.master; sfxBus.gain.value = S.sfx; voiceBus.gain.value = S.voices * 1.4; ambBus.gain.value = S.ambience;
    if (rainNodes) rainNodes.out.gain.value = S.rain ? 1 : 0;
  },
  setSpatial(hrtf) { spatialHRTF = hrtf; },
  voiceBus: () => voiceBus,
  // where your ears are
  listen(cam) {
    if (!ctx) return;
    cam.getWorldPosition(tmp); fwd.set(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    up.set(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    const L = ctx.listener, t = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(tmp.x, t, 0.02); L.positionY.setTargetAtTime(tmp.y, t, 0.02); L.positionZ.setTargetAtTime(tmp.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.setTargetAtTime(up.x, t, 0.02); L.upY.setTargetAtTime(up.y, t, 0.02); L.upZ.setTargetAtTime(up.z, t, 0.02);
    } else { L.setPosition(tmp.x, tmp.y, tmp.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  },
  // a 3D spot for a sound; returns the node to connect into
  panner(pos, bus = sfxBus) {
    const p = ctx.createPanner();
    p.panningModel = spatialHRTF ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = 1.1; p.maxDistance = 30;
    if (pos) setPannerPos(p, pos);
    p.connect(bus);
    return p;
  },
  setPannerPos,
  play(name, pos = null, k = 1) {
    if (!ctx || ctx.state !== 'running') return null;
    const f = SOUNDS[name]; if (!f) return null;
    const out = ctx.createGain(); out.gain.value = k;
    out.connect(pos ? this.panner(pos) : sfxBus);
    return f(ctx.currentTime, out, k);
  },
  startRain() {
    if (!ctx || rainNodes) return;
    const out = ctx.createGain(); out.gain.value = S.rain ? 1 : 0; out.connect(ambBus);
    const n = loopNoise(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
    const g = ctx.createGain(); g.gain.value = 0.16; n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
    // the window right behind the table: brighter patter from the back of the room
    const n2 = loopNoise(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7;
    const g2 = ctx.createGain(); g2.gain.value = 0.05; const pan = this.panner(new THREE.Vector3(0, 1.7, -3.4), out);
    n2.connect(bp); bp.connect(g2); g2.connect(pan);
    rainNodes = { out };
  },
  // a sound that keeps going until stopped (the black hole's hum). returns { stop(), move(pos) }
  hum(pos) {
    if (!ctx || ctx.state !== 'running') return { stop() {}, move() {} };
    const t = ctx.currentTime, p = this.panner(pos), out = ctx.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.9, t + 0.4); out.connect(p);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(out);
    const oscs = [42, 44.5, 63].map((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.25; o.connect(g); g.connect(lp); o.start(t); return o; });
    const n = loopNoise(); const ng = ctx.createGain(); ng.gain.value = 0.35; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 120; n.connect(bp); bp.connect(ng); ng.connect(lp);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7; const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t);
    return {
      move: (q) => setPannerPos(p, q),
      stop: () => { const e = ctx.currentTime; out.gain.cancelScheduledValues(e); out.gain.setValueAtTime(out.gain.value, e); out.gain.linearRampToValueAtTime(0, e + 0.25); setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); n.stop(); p.disconnect(); }, 400); }
    };
  }
};

function setPannerPos(p, v) {
  if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; } else p.setPosition(v.x, v.y, v.z);
}
function loopNoise() { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.loopStart = Math.random(); n.start(); return n; }
function noise(t, dur, out, { type = 'bandpass', f = 1000, q = 1, f2 = null, a = 0.002, peak = 1, curve = 3 } = {}) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.playbackRate.value = 1;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g.gain, t, a, dur, peak, curve);
  n.connect(fl); fl.connect(g); g.connect(out); n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
}
function tone(t, dur, out, { type = 'sine', f = 440, f2 = null, a = 0.003, peak = 0.5, curve = 3, vib = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  if (vib) { const l = ctx.createOscillator(); l.frequency.value = 9; const lg = ctx.createGain(); lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
  const g = ctx.createGain(); env(g.gain, t, a, dur, peak, curve);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function env(param, t, a, dur, peak, curve) {
  param.setValueAtTime(0.0001, t); param.linearRampToValueAtTime(peak, t + a);
  // exponential-ish fall: setTargetAtTime with a time constant from the length
  param.setTargetAtTime(0.0001, t + a, Math.max(0.005, (dur - a) / curve));
}

const SOUNDS = {
  punch(t, o, k) { tone(t, 0.16, o, { f: 140, f2: 45, peak: 0.9 }); noise(t, 0.07, o, { f: 1400, q: 0.8, peak: 0.55 * k }); noise(t, 0.12, o, { type: 'lowpass', f: 500, peak: 0.6 }); },
  thud(t, o, k) { const f = 160 + Math.random() * 220; noise(t, 0.12 + 0.1 * k, o, { f, q: 2.2, peak: 0.9 }); tone(t, 0.12, o, { f: 90, f2: 50, peak: 0.4 }); },
  tap(t, o) { noise(t, 0.05, o, { f: 1800 + Math.random() * 1500, q: 3, peak: 0.5 }); },
  zap(t, o) { tone(t, 0.16, o, { type: 'sawtooth', f: 1700, f2: 220, peak: 0.28 }); tone(t, 0.12, o, { type: 'square', f: 900, f2: 130, peak: 0.12 }); noise(t, 0.05, o, { type: 'highpass', f: 2500, peak: 0.7 }); noise(t, 0.18, o, { type: 'lowpass', f: 300, peak: 0.6 }); },
  hit(t, o) { noise(t, 0.09, o, { f: 700, q: 1.4, peak: 0.9 }); tone(t, 0.1, o, { f: 110, f2: 60, peak: 0.5 }); noise(t, 0.2, o, { f: 260, q: 4, peak: 0.25, a: 0.02 }); },
  ping(t, o) { const f = 1800 + Math.random() * 1400; tone(t, 0.35, o, { f, f2: f * 0.8, peak: 0.12 }); noise(t, 0.03, o, { type: 'highpass', f: 4000, peak: 0.4 }); },
  bh_fire(t, o) { tone(t, 0.5, o, { type: 'sawtooth', f: 60, f2: 240, peak: 0.25, a: 0.05 }); noise(t, 0.4, o, { f: 300, f2: 1500, q: 1, peak: 0.5, a: 0.05 }); },
  bh_open(t, o) { tone(t, 0.9, o, { f: 220, f2: 38, peak: 0.6 }); noise(t, 0.8, o, { type: 'lowpass', f: 2000, f2: 120, peak: 0.6 }); },
  bh_eat(t, o) { tone(t, 0.3, o, { type: 'triangle', f: 800 + Math.random() * 400, f2: 60, peak: 0.25 }); },
  bh_end(t, o) { noise(t, 1.4, o, { type: 'lowpass', f: 900, f2: 60, peak: 1, curve: 4 }); tone(t, 1.0, o, { f: 70, f2: 28, peak: 0.9 }); noise(t, 0.08, o, { type: 'highpass', f: 1500, peak: 0.6 }); },
  freeze(t, o) { for (let i = 0; i < 6; i++) tone(t + i * 0.025, 0.6, o, { f: 2000 + Math.random() * 3000, peak: 0.07 }); tone(t, 0.08, o, { type: 'square', f: 300, peak: 0.08 }); noise(t, 0.25, o, { type: 'highpass', f: 5000, peak: 0.25 }); },
  unfreeze(t, o) { for (let i = 0; i < 4; i++) tone(t + i * 0.04, 0.3, o, { f: 4000 - i * 600, peak: 0.05 }); },
  grow(t, o) { tone(t, 0.45, o, { type: 'triangle', f: 160, f2: 560, peak: 0.35, vib: 30 }); },
  shrink(t, o) { tone(t, 0.4, o, { type: 'triangle', f: 700, f2: 140, peak: 0.35, vib: 30 }); },
  float(t, o) { noise(t, 0.7, o, { f: 300, f2: 2400, q: 2, peak: 0.45, a: 0.1 }); tone(t, 0.6, o, { f: 330, f2: 660, peak: 0.12, a: 0.1 }); },
  land(t, o) { noise(t, 0.4, o, { f: 2000, f2: 250, q: 2, peak: 0.35 }); },
  clone(t, o) { noise(t, 0.05, o, { type: 'highpass', f: 1200, peak: 0.6 }); tone(t + 0.02, 0.3, o, { f: 880, peak: 0.18 }); tone(t + 0.08, 0.35, o, { f: 1320, peak: 0.15 }); },
  rewind(t, o) { noise(t, 0.85, o, { f: 600, f2: 4000, q: 1.5, peak: 0.45, a: 0.6, curve: 8 }); tone(t, 0.85, o, { type: 'sawtooth', f: 900, f2: 90, peak: 0.08, a: 0.5, curve: 8 }); for (let i = 0; i < 14; i++) noise(t + i * 0.055, 0.02, o, { type: 'highpass', f: 3000, peak: 0.25 }); },
  tick(t, o) { noise(t, 0.025, o, { f: 3200, q: 4, peak: 0.5 }); tone(t, 0.04, o, { f: 1900, peak: 0.05 }); },
  tock(t, o) { noise(t, 0.03, o, { f: 2300, q: 4, peak: 0.5 }); tone(t, 0.05, o, { f: 1300, peak: 0.05 }); },
  rec_start(t, o) { tone(t, 0.09, o, { f: 660, peak: 0.25 }); tone(t + 0.11, 0.14, o, { f: 990, peak: 0.25 }); },
  rec_stop(t, o) { tone(t, 0.09, o, { f: 990, peak: 0.25 }); tone(t + 0.11, 0.16, o, { f: 560, peak: 0.25 }); },
  mask_on(t, o) { [440, 554, 659, 880].forEach((f, i) => tone(t + i * 0.05, 1.4, o, { f, peak: 0.12, a: 0.06 })); noise(t, 0.6, o, { f: 5000, q: 1, peak: 0.12, a: 0.2 }); },
  copy_born(t, o) { tone(t, 0.6, o, { f: 523, peak: 0.12, a: 0.03 }); tone(t + 0.07, 0.7, o, { f: 784, peak: 0.1, a: 0.03 }); noise(t, 0.5, o, { f: 2500, f2: 600, q: 1, peak: 0.2 }); },
  shatter(t, o) { noise(t, 0.3, o, { type: 'highpass', f: 2500, peak: 0.6 }); for (let i = 0; i < 6; i++) tone(t + Math.random() * 0.12, 0.25, o, { f: 1500 + Math.random() * 3500, peak: 0.05 }); },
  glitch(t, o) { for (let i = 0; i < 5; i++) tone(t + i * 0.03, 0.03, o, { type: 'square', f: 200 + Math.random() * 1200, peak: 0.08 }); },
  ui(t, o) { tone(t, 0.05, o, { f: 1200, peak: 0.12 }); noise(t, 0.02, o, { type: 'highpass', f: 3000, peak: 0.2 }); },
  ui_back(t, o) { tone(t, 0.06, o, { f: 700, peak: 0.12 }); },
  grab(t, o) { noise(t, 0.05, o, { f: 1700, q: 2, peak: 0.35 }); },
  throw(t, o) { noise(t, 0.3, o, { f: 500, f2: 1800, q: 1.4, peak: 0.4, a: 0.05 }); },
  swing(t, o) { noise(t, 0.22, o, { f: 900, f2: 300, q: 1.2, peak: 0.4, a: 0.04 }); },
  ouch(t, o) { tone(t, 0.25, o, { f: 90, f2: 40, peak: 0.8 }); noise(t, 0.2, o, { type: 'lowpass', f: 400, peak: 0.6 }); },
  thunder(t, o, k) { noise(t, 3.5, o, { type: 'lowpass', f: 420, f2: 70, peak: 0.9 * k, a: 0.08, curve: 3 }); noise(t + 0.05, 0.6, o, { type: 'lowpass', f: 1600, peak: 0.4 * k, a: 0.01 }); for (let i = 0; i < 4; i++) noise(t + 0.2 + Math.random() * 1.5, 0.5, o, { type: 'lowpass', f: 300, peak: 0.5 * k }); }
};
