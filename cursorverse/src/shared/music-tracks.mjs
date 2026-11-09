// Built-in music: original songs generated live with Web Audio.
// A track is a recipe (tempo, key, chords, style, seed); MusicPlayer turns it
// into drums, bass, chords and melody with a look-ahead scheduler.
import { rng } from './draw-helpers.mjs';

export const GENRES = [
  { id: 'lofi', name: 'Lofi / chill', emoji: '☕' },
  { id: 'chip', name: '8-bit / game', emoji: '👾' },
  { id: 'synth', name: 'Synthwave / EDM', emoji: '🌆' },
  { id: 'ambient', name: 'Ambient / rain', emoji: '🌧️' },
];

export const TRACKS = [
  { id: 'lofi-rainy', name: 'Rainy Window', genre: 'lofi', bpm: 76, root: 60, scale: 'major', prog: [3, 2, 5, 0], seed: 11, bars: 48, rain: 0.25 },
  { id: 'lofi-study', name: 'Late Night Study', genre: 'lofi', bpm: 72, root: 57, scale: 'minor', prog: [0, 5, 2, 6], seed: 23, bars: 48 },
  { id: 'lofi-coffee', name: 'Coffee Steam', genre: 'lofi', bpm: 84, root: 65, scale: 'major', prog: [0, 3, 1, 4], seed: 37, bars: 48 },
  { id: 'chip-quest', name: 'Pixel Quest', genre: 'chip', bpm: 140, root: 60, scale: 'major', prog: [0, 5, 3, 4], seed: 5, bars: 64 },
  { id: 'chip-boss', name: 'Boss Room', genre: 'chip', bpm: 162, root: 52, scale: 'minor', prog: [0, 0, 5, 4], seed: 99, bars: 64 },
  { id: 'chip-cave', name: 'Coin Cave', genre: 'chip', bpm: 118, root: 55, scale: 'major', prog: [0, 3, 0, 4], seed: 71, bars: 48 },
  { id: 'synth-highway', name: 'Neon Highway', genre: 'synth', bpm: 108, root: 57, scale: 'minor', prog: [0, 5, 2, 6], seed: 3, bars: 64 },
  { id: 'synth-drive', name: 'Night Drive', genre: 'synth', bpm: 96, root: 54, scale: 'minor', prog: [0, 3, 5, 4], seed: 42, bars: 56 },
  { id: 'synth-rave', name: 'Laser Rave', genre: 'synth', bpm: 128, root: 53, scale: 'minor', prog: [0, 0, 5, 6], seed: 128, bars: 64, edm: true },
  { id: 'amb-rain', name: 'Rain on Glass', genre: 'ambient', bpm: 60, root: 57, scale: 'major', prog: [0, 3, 5, 4], seed: 8, bars: 40, rain: 1 },
  { id: 'amb-space', name: 'Deep Space', genre: 'ambient', bpm: 56, root: 50, scale: 'minor', prog: [0, 5, 3, 6], seed: 61, bars: 40 },
  { id: 'amb-storm', name: 'Thunderstorm', genre: 'ambient', bpm: 58, root: 48, scale: 'minor', prog: [0, 6, 5, 6], seed: 17, bars: 40, rain: 1.2, thunder: true },
];

export const TRACK_MAP = new Map(TRACKS.map((t) => [t.id, t]));

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function scaleNote(track, degree, octave = 0) {
  const s = SCALES[track.scale];
  const d = ((degree % 7) + 7) % 7;
  const o = Math.floor(degree / 7);
  return track.root + s[d] + 12 * (o + octave);
}

function chord(track, degree, size = 3, octave = 0) {
  return Array.from({ length: size }, (_, i) => scaleNote(track, degree + i * 2, octave));
}

export function trackDuration(track) {
  return (track.bars * 4 * 60) / track.bpm;
}

export class MusicPlayer {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 18000;
    this.master.connect(this.tone).connect(this.comp).connect(destination);
    // simple echo send for space
    this.delay = ctx.createDelay(1.5);
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.35;
    this.delayOut = ctx.createGain();
    this.delayOut.gain.value = 0.25;
    this.delay.connect(this.fb).connect(this.delay);
    this.delay.connect(this.delayOut).connect(this.master);
    this.noiseBuf = this.makeNoise();
    this.track = null;
    this.timer = null;
    this.loops = [];
    this.onEnd = null;
  }

  makeNoise() {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  get position() {
    if (!this.track) return 0;
    return Math.max(0, Math.min(this.duration, this.ctx.currentTime - this.startTime));
  }

  get duration() {
    return this.track ? trackDuration(this.track) : 0;
  }

  play(track) {
    this.stop(0.05);
    this.track = track;
    this.rand = rng(track.seed * 7919);
    this.motifs = this.makeMotifs(track);
    this.stepDur = 60 / track.bpm / 4;
    this.startTime = this.ctx.currentTime + 0.12;
    this.nextStep = 0;
    this.totalSteps = track.bars * 16;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(0.8, now + 1.5);
    this.tone.frequency.value = track.genre === 'lofi' ? 3200 : track.genre === 'ambient' ? 6000 : 16000;
    this.delay.delayTime.value = (60 / track.bpm) * 0.75;
    this.startLoops(track);
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop(fade = 0.4) {
    clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + fade);
    const loops = this.loops;
    this.loops = [];
    setTimeout(() => loops.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), fade * 1000 + 50);
    this.track = null;
  }

  // ---- background loops (rain, vinyl crackle)
  startLoops(track) {
    const ctx = this.ctx;
    if (track.rain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.value = 0.09 * track.rain;
      src.connect(hp).connect(lp).connect(g).connect(this.master);
      src.start();
      this.loops.push(src);
    }
    if (track.genre === 'lofi') {
      const len = ctx.sampleRate * 3;
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      const r = rng(track.seed);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * 0.012;
        if (r() < 0.0004) d[i] += (r() * 2 - 1) * 0.6;
      }
      const src = ctx.createBufferSource();
      src.buffer = b; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(g).connect(this.master);
      src.start();
      this.loops.push(src);
    }
  }

  makeMotifs(track) {
    // two one-bar melodies built from scale degrees; songs reuse them (A A B A)
    const r = this.rand;
    const density = { lofi: 0.35, chip: 0.7, synth: 0.45, ambient: 0.15 }[track.genre];
    const make = () => Array.from({ length: 16 }, (_, i) => {
      const strong = i % 4 === 0;
      if (r() > (strong ? density + 0.25 : density * (i % 2 ? 0.6 : 1))) return null;
      return { deg: Math.floor(r() * 8) - 1, len: 1 + Math.floor(r() * (track.genre === 'chip' ? 2 : 4)) };
    });
    return [make(), make(), make()];
  }

  schedule() {
    if (!this.track) return;
    const ahead = this.ctx.currentTime + 0.15;
    while (this.nextStep < this.totalSteps) {
      const t = this.startTime + this.nextStep * this.stepDur;
      if (t > ahead) break;
      this.step(this.nextStep, t);
      this.nextStep++;
    }
    if (this.nextStep >= this.totalSteps && this.ctx.currentTime > this.startTime + this.totalSteps * this.stepDur) {
      const cb = this.onEnd;
      this.stop(1.5);
      cb?.();
    }
  }

  step(n, t) {
    const tr = this.track;
    const bar = Math.floor(n / 16);
    const s = n % 16;
    const deg = tr.prog[bar % tr.prog.length];
    const section = Math.floor(bar / 8) % 4; // 0 intro-ish, 1 main, 2 break, 3 main
    const g = tr.genre;
    const swing = g === 'lofi' && s % 2 === 1 ? this.stepDur * 0.28 : 0;
    const tt = t + swing;
    const intro = bar < 2;

    if (g === 'lofi') {
      if (s === 0) this.epiano(t, chord(tr, deg, 4, 0).map(mtof), this.stepDur * 16);
      if (!intro) {
        if (s === 0 || s === 10 || (s === 7 && bar % 2)) this.kick(tt, 0.7);
        if (s === 4 || s === 12) this.snare(tt, 0.35, 2200);
        if (s % 2 === 0 || this.rand() < 0.2) this.hat(tt, 0.06 + (s % 4 === 2 ? 0.03 : 0));
        if (s === 0 || s === 8) this.bass(t, mtof(scaleNote(tr, deg, -2)), this.stepDur * 6, 'triangle', 0.35);
      }
      if (section !== 2) this.melody(tr, bar, s, t, 'triangle', 0.1, 1);
    } else if (g === 'chip') {
      if (!intro || s % 4 === 0) {
        if (s % 8 === 0) this.chipKick(t);
        if (s === 4 || s === 12) this.chipSnare(t);
        if (s % 2 === 1) this.hat(t, 0.035);
      }
      if (s % 2 === 0) this.bass(t, mtof(scaleNote(tr, deg, -1) + (s % 4 === 2 ? 12 : 0)), this.stepDur * 1.8, 'triangle', 0.3);
      if (s % 2 === 0 && section === 2) {
        const c = chord(tr, deg, 3, 1);
        this.pluck(t, mtof(c[(s / 2) % 3]), this.stepDur * 1.5, 'square', 0.06);
      } else this.melody(tr, bar, s, t, 'square', 0.07, 1);
    } else if (g === 'synth') {
      if (s === 0) this.pad(t, chord(tr, deg, 3, 0).map(mtof), this.stepDur * 16, 0.07);
      const c = chord(tr, deg, 3, 1);
      if (!intro) this.pluck(t, mtof(c[s % 3] + (s % 6 >= 3 ? 12 : 0)), this.stepDur * 0.9, 'sawtooth', 0.04, true);
      if (!intro && !(section === 2 && !tr.edm)) {
        if (tr.edm ? s % 4 === 0 : s === 0 || s === 8 || s === 11) this.kick(t, 0.8);
        if (s === 4 || s === 12) this.snare(t, 0.4, 1800, true);
        if (tr.edm ? s % 4 === 2 : s % 2 === 0) this.hat(t, tr.edm ? 0.08 : 0.045);
      }
      if (s % 2 === 0) this.bass(t, mtof(scaleNote(tr, deg, -2)), this.stepDur * 1.6, 'sawtooth', 0.22, true);
      if (section === 1 || section === 3) this.melody(tr, bar, s, t, 'sawtooth', 0.05, 1, true);
    } else {
      if (s === 0 && bar % 2 === 0) this.pad(t, chord(tr, deg, 4, 0).map(mtof), this.stepDur * 32, 0.06, true);
      if (s === 0 && bar % 2 === 0) this.bass(t, mtof(scaleNote(tr, deg, -2)), this.stepDur * 30, 'sine', 0.2);
      if (this.rand() < 0.05) this.bell(t, mtof(scaleNote(tr, Math.floor(this.rand() * 7), 2)));
      if (tr.thunder && s === 0 && this.rand() < 0.12) this.thunder(t);
    }
  }

  melody(tr, bar, s, t, type, gain, octave, echo = false) {
    const arrangement = [0, 0, 1, 0, 2, 2, 1, 0];
    const m = this.motifs[arrangement[bar % 8]];
    const note = m[s];
    if (!note) return;
    const deg = tr.prog[bar % tr.prog.length];
    const midi = scaleNote(tr, deg + note.deg, octave);
    this.pluck(t, mtof(midi), this.stepDur * note.len, type, gain, echo);
  }

  // ---- instruments
  env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  osc(type, freq, t, dur, gain, a = 0.005, echo = false, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const g = this.ctx.createGain();
    this.env(g, t, gain, a, dur);
    o.connect(g).connect(this.master);
    if (echo) g.connect(this.delay);
    o.start(t); o.stop(t + a + dur + 0.05);
    return { o, g };
  }

  kick(t, gain = 0.8) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, gain, 0.002, 0.3);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.35);
  }

  noiseHit(t, type, freq, gain, dur, q = 1, echo = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, gain, 0.001, dur);
    src.connect(f).connect(g).connect(this.master);
    if (echo) g.connect(this.delay);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  snare(t, gain, freq = 2000, echo = false) {
    this.noiseHit(t, 'bandpass', freq, gain, 0.18, 0.7, echo);
    this.osc('triangle', 185, t, 0.08, gain * 0.5);
  }

  hat(t, gain) { this.noiseHit(t, 'highpass', 7500, gain, 0.04); }
  chipKick(t) {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    const g = this.ctx.createGain();
    this.env(g, t, 0.18, 0.002, 0.1);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.15);
  }
  chipSnare(t) { this.noiseHit(t, 'highpass', 1500, 0.2, 0.1); }

  bass(t, freq, dur, type, gain, filtered = false) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    this.env(g, t, gain, 0.01, dur);
    if (filtered) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
      o.connect(f).connect(g);
    } else o.connect(g);
    g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  pluck(t, freq, dur, type, gain, echo = false) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(type === 'square' ? 6000 : 4200, t);
    f.frequency.exponentialRampToValueAtTime(600, t + Math.max(0.08, dur));
    const g = this.ctx.createGain();
    this.env(g, t, gain, 0.004, Math.max(0.06, dur));
    o.connect(f).connect(g).connect(this.master);
    if (echo) g.connect(this.delay);
    o.start(t); o.stop(t + dur + 0.1);
  }

  epiano(t, freqs, dur) {
    for (const fq of freqs) {
      this.osc('sine', fq, t, dur, 0.06, 0.01, false);
      this.osc('triangle', fq * 2, t, dur * 0.4, 0.015, 0.005, false, 4);
    }
  }

  pad(t, freqs, dur, gain, echo = false) {
    for (const fq of freqs) {
      for (const det of [-9, 9]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = fq; o.detune.value = det;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 1200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(gain / freqs.length, t + dur * 0.25);
        g.gain.linearRampToValueAtTime(gain / freqs.length * 0.7, t + dur * 0.8);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(f).connect(g).connect(this.master);
        if (echo) g.connect(this.delay);
        o.start(t); o.stop(t + dur + 0.05);
      }
    }
  }

  bell(t, freq) {
    this.osc('sine', freq, t, 2.5, 0.05, 0.005, true);
    this.osc('sine', freq * 2.76, t, 1.2, 0.015, 0.005, true);
  }

  thunder(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 180;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 4.6);
  }
}
