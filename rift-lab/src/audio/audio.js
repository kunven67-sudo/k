// All sound is made in code (no sound files): wind, leaves, river, birds by day,
// crickets + owls at night, footsteps for each kind of ground, breathing, splashes,
// and soft ambient music (a setting: off / ambient / dynamic).

import { settings, onSettingChange } from '../core/settings.js';
import { clamp, lerp } from '../core/noise.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.started = false;
  }

  start() {
    if (this.started) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.started = true;
    this.master = ctx.createGain();
    this.underwaterFilter = ctx.createBiquadFilter();
    this.underwaterFilter.type = 'lowpass';
    this.underwaterFilter.frequency.value = 20000;
    this.master.connect(this.underwaterFilter).connect(ctx.destination);
    this.fx = ctx.createGain();
    this.amb = ctx.createGain();
    this.music = ctx.createGain();
    this.fx.connect(this.master); this.amb.connect(this.master); this.music.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.2, 3.5);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.18;
    this.reverb.connect(revGain).connect(this.master);
    this.applyVolumes();
    onSettingChange((k) => { if (k.startsWith('vol') || k === 'musicMode') this.applyVolumes(); });

    this.noise = this.makeNoise(4, 'white');
    this.pink = this.makeNoise(4, 'pink');
    this.brown = this.makeNoise(4, 'brown');

    // looping beds
    this.wind = this.loopBed(this.pink, 'bandpass', 380, 0.6, this.amb);
    this.leaves = this.loopBed(this.noise, 'highpass', 2600, 0.3, this.amb);
    this.river = this.loopBed(this.brown, 'lowpass', 900, 0.4, this.amb);
    this.riverHi = this.loopBed(this.noise, 'bandpass', 2200, 0.9, this.amb);
    this.nextBird = 1;
    this.nextNight = 2;
    this.musicT = 0;
    this.nextChord = 0;
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = settings.volMaster;
    this.fx.gain.value = settings.volEffects;
    this.amb.gain.value = settings.volAmbience;
    this.music.gain.value = settings.musicMode === 'off' ? 0 : settings.volMusic * 0.5;
  }

  makeNoise(seconds, kind) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return buf;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  loopBed(buffer, type, freq, q, out) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(out);
    src.start();
    return { src, f, g };
  }

  // one-shot noise burst through a filter (footsteps, crunches, splashes)
  burst({ dur = 0.08, freq = 1000, q = 1, type = 'bandpass', gain = 0.3, attack = 0.004, buffer, rate = 1, pan = 0, out, delay = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buffer || this.noise;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(out || this.fx);
    src.start(t, Math.random() * 2, dur + 0.05);
    return g;
  }

  tone({ freq = 440, freqEnd, dur = 0.2, type = 'sine', gain = 0.1, attack = 0.01, pan = 0, out, delay = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(out || this.fx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  footstep(surface, mode, wading) {
    if (!this.ctx) return;
    const loud = mode === 'sprint' ? 1.3 : mode === 'jog' ? 1.05 : mode === 'crouch' ? 0.45 : 0.8;
    const pan = (Math.random() - 0.5) * 0.2;
    const r = 0.85 + Math.random() * 0.3;
    switch (surface) {
      case 'leaves': // dry fall leaves: lots of tiny crackles
        this.burst({ dur: 0.12, freq: 3200 * r, q: 0.7, gain: 0.16 * loud, pan });
        for (let i = 0; i < 6; i++) this.burst({ dur: 0.02 + Math.random() * 0.03, freq: 2000 + Math.random() * 4000, q: 3, gain: 0.12 * loud, pan, delay: Math.random() * 0.12 });
        this.burst({ dur: 0.09, freq: 180, type: 'lowpass', gain: 0.25 * loud, buffer: this.brown, pan });
        break;
      case 'rock':
        this.burst({ dur: 0.05, freq: 2400 * r, q: 2.5, gain: 0.16 * loud, pan });
        this.burst({ dur: 0.08, freq: 260, type: 'lowpass', gain: 0.32 * loud, buffer: this.brown, pan });
        break;
      case 'mud':
        this.burst({ dur: 0.18, freq: 420 * r, q: 1.6, gain: 0.22 * loud, buffer: this.brown, pan });
        this.tone({ freq: 140 * r, freqEnd: 90, dur: 0.12, gain: 0.05 * loud, type: 'sine', pan });
        break;
      case 'water':
        this.burst({ dur: 0.28 + wading * 0.2, freq: 900 * r, q: 0.6, gain: (0.18 + wading * 0.2) * loud, pan });
        this.burst({ dur: 0.2, freq: 3500, q: 0.8, gain: 0.08 * loud, pan, delay: 0.05 });
        break;
      case 'wood':
        this.burst({ dur: 0.07, freq: 700 * r, q: 3, gain: 0.25 * loud, pan });
        this.tone({ freq: 190 * r, freqEnd: 150, dur: 0.09, gain: 0.08 * loud, type: 'triangle', pan });
        break;
      default: // grass: soft swish + muffled thump
        this.burst({ dur: 0.14, freq: 2600 * r, q: 0.5, gain: 0.1 * loud, pan, attack: 0.02 });
        this.burst({ dur: 0.08, freq: 160, type: 'lowpass', gain: 0.28 * loud, buffer: this.brown, pan });
    }
  }

  land(speed) {
    if (!this.ctx) return;
    const g = clamp(speed / 8, 0.2, 1.4);
    this.burst({ dur: 0.18, freq: 140, type: 'lowpass', gain: 0.5 * g, buffer: this.brown });
    this.burst({ dur: 0.1, freq: 1800, q: 0.8, gain: 0.12 * g });
  }

  splash(speed) {
    if (!this.ctx) return;
    const g = clamp(speed / 6, 0.3, 1.5);
    this.burst({ dur: 0.7, freq: 700, q: 0.4, gain: 0.35 * g });
    for (let i = 0; i < 8; i++) this.burst({ dur: 0.08, freq: 1500 + Math.random() * 3000, q: 4, gain: 0.08 * g, delay: 0.1 + Math.random() * 0.5 });
  }

  hurt() {
    if (!this.ctx) return;
    this.tone({ freq: 70, freqEnd: 45, dur: 0.35, gain: 0.25, type: 'sine' });
  }

  ui(kind = 'click') {
    if (!this.ctx) return;
    if (kind === 'click') this.tone({ freq: 1400, freqEnd: 900, dur: 0.05, gain: 0.05, type: 'triangle' });
    else if (kind === 'open') this.burst({ dur: 0.25, freq: 1800, q: 0.6, gain: 0.06, attack: 0.08 });
  }

  // called every frame with what's around you
  update(dt, s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const k = (node, v, tc = 0.3) => node.gain.setTargetAtTime(v, t, tc);

    // wind: gusty, stronger in the open + up high
    this.windPhase = (this.windPhase || 0) + dt;
    const gust = 0.55 + 0.45 * Math.sin(this.windPhase * 0.31) * Math.sin(this.windPhase * 0.13 + 1.3);
    const windAmt = s.wind * gust * (0.6 + 0.4 * (1 - s.treeDensity)) * (1 + s.altitude * 0.004);
    k(this.wind.g, 0.22 * windAmt);
    this.wind.f.frequency.setTargetAtTime(260 + 420 * gust, t, 0.5);
    k(this.leaves.g, 0.05 * s.treeDensity * windAmt * (s.season > 0.6 ? 1.4 : 1));

    // water nearby
    const river = clamp(1 - s.riverDist / 60, 0, 1);
    const lake = clamp(1 - s.lakeDist / 40, 0, 1) * 0.35;
    k(this.river.g, 0.35 * river * river + 0.15 * lake);
    k(this.riverHi.g, 0.06 * river * river + 0.02 * lake);

    // underwater muffling
    this.underwaterFilter.frequency.setTargetAtTime(s.underwater ? 450 : 20000, t, 0.08);

    // birds by day (more at dawn), crickets + owls at night
    const day = 1 - s.night;
    const dawn = Math.exp(-Math.pow((s.hours - 6.8) / 1.2, 2));
    this.nextBird -= dt;
    if (this.nextBird <= 0 && day > 0.3 && !s.underwater) {
      this.nextBird = (2.5 + Math.random() * 6) / (0.4 + dawn * 2 + (s.season > 0.7 ? -0.15 : 0.3));
      this.birdCall(clamp(s.treeDensity + 0.3, 0.3, 1));
    }
    this.nextNight -= dt;
    if (this.nextNight <= 0 && s.night > 0.6 && !s.underwater) {
      this.nextNight = 0.4 + Math.random() * 1.2;
      // October: crickets are slower + fewer in the cold
      if (Math.random() < (s.season > 0.75 ? 0.35 : 0.8)) this.cricket();
      if (Math.random() < 0.025) this.owl();
    }

    // breathing when tired
    const tired = 1 - s.stamina / 100;
    this.breathT = (this.breathT || 0) + dt * (0.35 + tired * 0.9);
    if (tired > 0.45 && this.breathT > 1) {
      this.breathT = 0;
      const g = (tired - 0.45) * 0.35;
      this.burst({ dur: 0.45, freq: 900, q: 0.5, gain: g, attack: 0.15, buffer: this.pink });
      this.burst({ dur: 0.5, freq: 600, q: 0.5, gain: g * 0.8, attack: 0.1, buffer: this.pink, delay: 0.55 });
    }

    this.updateMusic(dt, s);
  }

  birdCall(near) {
    const pan = Math.random() * 1.6 - 0.8;
    const g = 0.025 + 0.04 * near * Math.random();
    const kind = Math.floor(Math.random() * 5);
    const d0 = 0;
    if (kind === 0) { // robin-like phrase: cheerily cheer-up
      for (let i = 0; i < 4; i++) this.tone({ freq: 2600 + Math.random() * 700, freqEnd: 2100 + Math.random() * 900, dur: 0.16, gain: g, pan, delay: d0 + i * 0.24 });
    } else if (kind === 1) { // chickadee "fee-bee"
      this.tone({ freq: 3900, freqEnd: 3850, dur: 0.32, gain: g, pan });
      this.tone({ freq: 3300, freqEnd: 3250, dur: 0.3, gain: g, pan, delay: 0.38 });
    } else if (kind === 2) { // cardinal whistle "cheer cheer"
      for (let i = 0; i < 3; i++) this.tone({ freq: 4200, freqEnd: 1900, dur: 0.22, gain: g, pan, delay: i * 0.3 });
    } else if (kind === 3) { // crow caw
      for (let i = 0; i < 3; i++) {
        this.tone({ freq: 620, freqEnd: 480, dur: 0.28, gain: g * 0.8, type: 'sawtooth', pan, delay: i * 0.45 });
        this.burst({ dur: 0.26, freq: 900, q: 2, gain: g * 0.5, pan, delay: i * 0.45 });
      }
    } else { // twittering sparrow
      const n = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) this.tone({ freq: 4500 + Math.random() * 2000, freqEnd: 3500 + Math.random() * 2500, dur: 0.05, gain: g * 0.7, pan, delay: i * 0.07 });
    }
  }

  cricket() {
    const pan = Math.random() * 1.6 - 0.8;
    const f = 4300 + Math.random() * 500;
    for (let i = 0; i < 3; i++) this.tone({ freq: f, dur: 0.035, gain: 0.012, pan, delay: i * 0.055 });
  }

  owl() {
    const pan = Math.random() * 1.4 - 0.7;
    const t = [0, 0.5, 0.75, 1.5, 2.0];
    for (const d of t) this.tone({ freq: 380, freqEnd: 330, dur: d === 0.5 || d === 0.75 ? 0.18 : 0.45, gain: 0.03, pan, delay: d, attack: 0.05 });
  }

  // Soft pads. "dynamic" follows the time of day + what you're doing.
  updateMusic(dt, s) {
    if (settings.musicMode === 'off') return;
    this.nextChord -= dt;
    if (this.nextChord > 0) return;
    this.nextChord = 9 + Math.random() * 7;
    const dynamic = settings.musicMode === 'dynamic';
    const nightMood = dynamic ? s.night : 0.3;
    // a few calm chords; night uses lower, darker voicings
    const roots = [261.63, 220.0, 196.0, 174.61, 233.08];
    const root = roots[Math.floor(Math.random() * roots.length)] * (nightMood > 0.5 ? 0.5 : 1);
    const chord = nightMood > 0.5 ? [1, 1.189, 1.498, 1.782] : [1, 1.26, 1.498, 1.888];
    chord.forEach((m, i) => {
      const o = this.ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = root * m;
      o.detune.value = (Math.random() - 0.5) * 8;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.018, t + 4);
      g.gain.linearRampToValueAtTime(0, t + 15);
      o.connect(g);
      g.connect(this.music);
      g.connect(this.reverb);
      o.start(t + i * 0.4);
      o.stop(t + 16);
    });
  }
}

export const audio = new Audio();
