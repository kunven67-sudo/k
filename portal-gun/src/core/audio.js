// Every sound in the game is synthesized here with WebAudio. No audio files.
import { clamp, rand } from '../util.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.volumes = { master: 0.8, music: 0.55, sfx: 0.9, voice: 1 };
    this._noise = null;
    this.loops = new Set();
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
  }

  /** Must be called from a click/keypress (browsers block audio before that). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.connect(this.comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.amb = ctx.createGain();
    this.amb.connect(this.master);
    this.applyVolumes();
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const v = this.volumes;
    this.master.gain.value = v.master;
    this.sfx.gain.value = v.sfx;
    this.amb.gain.value = v.sfx * 0.8;
    this.music.gain.value = v.music;
  }

  noiseBuffer() {
    if (!this._noise) {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    }
    return this._noise;
  }

  _env(g, when, peak, attack, hold, release) {
    const p = g.gain;
    p.cancelScheduledValues(when);
    p.setValueAtTime(0.0001, when);
    p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
    p.setValueAtTime(Math.max(peak, 0.0002), when + attack + hold);
    p.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  }

  /** basic oscillator note */
  tone({ type = 'sine', f = 440, f2 = null, dur = 0.2, gain = 0.3, attack = 0.005, when = 0, dest = null, curve = 'exp', detune = 0, pan = 0 }) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const t0 = this.t + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    o.detune.value = detune;
    if (f2 !== null) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
      else o.frequency.linearRampToValueAtTime(f2, t0 + dur);
    }
    const g = ctx.createGain();
    this._env(g, t0, gain, attack, 0, Math.max(0.01, dur - attack));
    let node = o.connect(g);
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(dest || this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  /** filtered noise burst */
  noise({ dur = 0.2, gain = 0.3, type = 'bandpass', f = 1000, f2 = null, q = 1, attack = 0.005, when = 0, dest = null, pan = 0 }) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const t0 = this.t + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuffer();
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t0);
    if (f2 !== null) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = ctx.createGain();
    this._env(g, t0, gain, attack, 0, Math.max(0.01, dur - attack));
    let node = s.connect(fl).connect(g);
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(dest || this.sfx);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + dur + 0.05);
    return s;
  }

  /** gain + stereo pan for a sound at a world position */
  spatial(x, y, z, range = 25) {
    const L = this.listener;
    const dx = x - L.x, dy = y - L.y, dz = z - L.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const g = clamp(1 - d / range, 0, 1) ** 1.6;
    // right vector of the listener
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const pan = d > 0.01 ? clamp((dx * rx + dz * rz) / d, -1, 1) * 0.8 : 0;
    return { g, pan };
  }

  // ---------------------------------------------------------------- game sfx

  portalShoot() {
    this.tone({ type: 'sine', f: 1500, f2: 260, dur: 0.22, gain: 0.32 });
    this.tone({ type: 'square', f: 760, f2: 140, dur: 0.16, gain: 0.07 });
    this.tone({ type: 'sine', f: 140, f2: 45, dur: 0.25, gain: 0.45 });
    this.noise({ dur: 0.18, gain: 0.18, type: 'lowpass', f: 2600, f2: 500, q: 2 });
    for (let i = 0; i < 4; i++) this.tone({ type: 'sine', f: rand(500, 1100), f2: rand(900, 1700), dur: 0.05, gain: 0.07, when: 0.05 + i * 0.035 });
  }

  portalOpen(x, y, z) {
    const { g, pan } = x === undefined ? { g: 1, pan: 0 } : this.spatial(x, y, z, 40);
    if (g <= 0.01) return;
    this.noise({ dur: 0.95, gain: 0.35 * g, type: 'bandpass', f: 380, f2: 1700, q: 5, attack: 0.08, pan });
    this.noise({ dur: 0.7, gain: 0.18 * g, type: 'lowpass', f: 300, f2: 1200, q: 1, attack: 0.05, pan });
    this.tone({ type: 'sine', f: 70, f2: 150, dur: 0.8, gain: 0.4 * g, attack: 0.06, pan });
    this.tone({ type: 'triangle', f: 220, f2: 660, dur: 0.55, gain: 0.08 * g, attack: 0.05, pan });
    for (let i = 0; i < 9; i++) {
      this.tone({ type: 'sine', f: rand(300, 700), f2: rand(700, 1300), dur: rand(0.04, 0.08), gain: 0.09 * g, when: 0.12 + i * rand(0.05, 0.08), pan });
    }
  }

  portalClose(x, y, z) {
    const { g, pan } = x === undefined ? { g: 1, pan: 0 } : this.spatial(x, y, z, 30);
    if (g <= 0.01) return;
    this.noise({ dur: 0.45, gain: 0.25 * g, type: 'bandpass', f: 1500, f2: 250, q: 4, pan });
    this.tone({ type: 'sine', f: 180, f2: 50, dur: 0.4, gain: 0.3 * g, pan });
  }

  portalTravel() {
    this.noise({ dur: 0.8, gain: 0.45, type: 'bandpass', f: 2400, f2: 180, q: 3, attack: 0.02 });
    this.tone({ type: 'sine', f: 90, f2: 35, dur: 0.7, gain: 0.55 });
    this.tone({ type: 'sawtooth', f: 400, f2: 80, dur: 0.35, gain: 0.05 });
    for (let i = 0; i < 6; i++) this.tone({ type: 'sine', f: rand(400, 900), f2: rand(150, 300), dur: 0.08, gain: 0.08, when: 0.1 + i * 0.06 });
  }

  fizzle() {
    this.noise({ dur: 0.3, gain: 0.2, type: 'highpass', f: 2500, f2: 800, q: 1 });
    this.tone({ type: 'square', f: 300, f2: 90, dur: 0.25, gain: 0.08 });
  }

  /** Rick's signature burp. */
  burp(strength = 1) {
    if (!this.ctx) return 0.6;
    const ctx = this.ctx;
    const t0 = this.t;
    const dur = rand(0.45, 0.8) * (0.7 + strength * 0.3);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f0 = rand(68, 92);
    o.frequency.setValueAtTime(f0 * 1.15, t0);
    o.frequency.linearRampToValueAtTime(f0, t0 + dur * 0.3);
    o.frequency.linearRampToValueAtTime(f0 * 0.82, t0 + dur);
    // croaky roughness
    const rough = ctx.createOscillator();
    rough.type = 'square';
    rough.frequency.value = rand(22, 34);
    const roughG = ctx.createGain();
    roughG.gain.value = 0.45;
    const am = ctx.createGain();
    am.gain.value = 0.6;
    rough.connect(roughG).connect(am.gain);
    const jitter = ctx.createOscillator();
    jitter.frequency.value = rand(5, 9);
    const jg = ctx.createGain();
    jg.gain.value = 9;
    jitter.connect(jg).connect(o.frequency);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = rand(420, 560);
    f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = rand(850, 1100);
    f2.Q.value = 5;
    const mix = ctx.createGain();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.9 * strength, t0 + 0.04);
    g.gain.setValueAtTime(0.8 * strength, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(am);
    am.connect(f1).connect(mix);
    am.connect(f2).connect(mix);
    mix.connect(g).connect(this.sfx);
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 700;
    const ng = ctx.createGain();
    ng.gain.value = 0.08;
    n.connect(nf).connect(ng).connect(g);
    for (const s of [o, rough, jitter, n]) {
      s.start(t0);
      s.stop(t0 + dur + 0.05);
    }
    return dur;
  }

  /** TV censor bleep */
  bleep(dur = 0.45) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.t;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.01);
    g.gain.setValueAtTime(0.28, t0 + dur - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  step(surface = 'wood', vol = 1) {
    const v = vol * rand(0.8, 1.1);
    switch (surface) {
      case 'carpet':
        this.noise({ dur: 0.09, gain: 0.08 * v, type: 'lowpass', f: 380, q: 0.7 });
        break;
      case 'concrete':
        this.noise({ dur: 0.06, gain: 0.12 * v, type: 'bandpass', f: rand(1700, 2300), q: 1.2 });
        this.tone({ type: 'sine', f: 110, f2: 70, dur: 0.06, gain: 0.1 * v });
        break;
      case 'grass':
        this.noise({ dur: 0.13, gain: 0.1 * v, type: 'bandpass', f: rand(2800, 4200), q: 0.9 });
        break;
      case 'metal':
        this.tone({ type: 'triangle', f: rand(900, 1300), f2: 700, dur: 0.12, gain: 0.05 * v });
        this.noise({ dur: 0.05, gain: 0.08 * v, type: 'highpass', f: 1800 });
        break;
      case 'tile':
        this.noise({ dur: 0.05, gain: 0.1 * v, type: 'bandpass', f: rand(2600, 3400), q: 2 });
        break;
      default: // wood
        this.noise({ dur: 0.07, gain: 0.1 * v, type: 'lowpass', f: 900, q: 1 });
        this.tone({ type: 'sine', f: rand(120, 150), f2: 80, dur: 0.08, gain: 0.12 * v });
    }
  }

  jump() {
    this.noise({ dur: 0.12, gain: 0.07, type: 'bandpass', f: 600, f2: 1200, q: 1 });
  }

  land(surface) {
    this.step(surface, 1.6);
    this.tone({ type: 'sine', f: 90, f2: 50, dur: 0.12, gain: 0.18 });
  }

  door(open = true) {
    const base = open ? 170 : 210;
    this.tone({ type: 'sawtooth', f: base, f2: base * 1.35, dur: 0.45, gain: 0.025, curve: 'lin' });
    this.noise({ dur: 0.4, gain: 0.04, type: 'bandpass', f: 900, f2: 1300, q: 8 });
    this.tone({ type: 'square', f: 90, f2: 60, dur: 0.06, gain: 0.08, when: open ? 0 : 0.38 });
    this.noise({ dur: 0.05, gain: 0.12, type: 'lowpass', f: 600, when: open ? 0 : 0.38 });
  }

  click() {
    this.tone({ type: 'square', f: 1800, f2: 1200, dur: 0.03, gain: 0.06 });
  }

  dial() {
    this.tone({ type: 'square', f: 2400, f2: 1800, dur: 0.025, gain: 0.05 });
    this.tone({ type: 'sine', f: 880, dur: 0.07, gain: 0.08, when: 0.03 });
  }

  uiMove() {
    this.tone({ type: 'triangle', f: 660, f2: 880, dur: 0.06, gain: 0.07 });
  }

  uiConfirm() {
    this.tone({ type: 'triangle', f: 523, dur: 0.08, gain: 0.1 });
    this.tone({ type: 'triangle', f: 784, dur: 0.12, gain: 0.1, when: 0.07 });
  }

  denied() {
    this.tone({ type: 'square', f: 180, dur: 0.12, gain: 0.08 });
    this.tone({ type: 'square', f: 140, dur: 0.18, gain: 0.08, when: 0.14 });
  }

  pickup() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.14, gain: 0.1, when: i * 0.06 }));
  }

  objective() {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f, dur: 0.22, gain: 0.08, when: i * 0.07 }));
    this.tone({ type: 'sine', f: 1568, dur: 0.6, gain: 0.05, when: 0.35 });
  }

  refill() {
    for (let i = 0; i < 14; i++) {
      const f = 220 + i * 45 + rand(-20, 20);
      this.tone({ type: 'sine', f, f2: f * 1.6, dur: 0.07, gain: 0.08, when: i * 0.07 });
    }
    this.tone({ type: 'triangle', f: 200, f2: 900, dur: 1.0, gain: 0.05, curve: 'lin' });
  }

  lowFluid() {
    this.tone({ type: 'square', f: 1200, dur: 0.07, gain: 0.05 });
    this.tone({ type: 'square', f: 900, dur: 0.07, gain: 0.05, when: 0.1 });
  }

  tvChannel() {
    this.noise({ dur: 0.35, gain: 0.18, type: 'highpass', f: 900, q: 0.5 });
    this.tone({ type: 'square', f: 60, dur: 0.05, gain: 0.05 });
  }

  whoosh(gain = 0.3) {
    this.noise({ dur: 0.5, gain, type: 'bandpass', f: 300, f2: 1600, q: 2, attack: 0.15 });
  }

  thud() {
    this.tone({ type: 'sine', f: 120, f2: 40, dur: 0.25, gain: 0.4 });
    this.noise({ dur: 0.1, gain: 0.15, type: 'lowpass', f: 500 });
  }

  snore() {
    this.noise({ dur: 1.1, gain: 0.05, type: 'bandpass', f: 220, f2: 380, q: 4, attack: 0.5 });
  }

  /** gross gulp from Rick's flask */
  gulp() {
    for (let i = 0; i < 3; i++) {
      this.tone({ type: 'sine', f: 260, f2: 140, dur: 0.12, gain: 0.18, when: i * 0.22 });
      this.noise({ dur: 0.1, gain: 0.05, type: 'lowpass', f: 400, when: i * 0.22 });
    }
  }

  // ---------------------------------------------------------------- loops

  /** A sustained sound whose gain/params you can drive every frame. */
  loop(kind) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const pan = ctx.createStereoPanner();
    out.connect(pan).connect(kind === 'crickets' || kind === 'birds' || kind === 'hum' ? this.amb : this.sfx);
    const nodes = [];
    const params = {};
    const noiseSrc = () => {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuffer();
      s.loop = true;
      nodes.push(s);
      return s;
    };
    const osc = (type, f) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      nodes.push(o);
      return o;
    };
    if (kind === 'portal') {
      const a = osc('triangle', 55);
      const b = osc('sine', 110.5);
      const lfo = osc('sine', 0.7);
      const lg = ctx.createGain();
      lg.gain.value = 0.25;
      const ag = ctx.createGain();
      ag.gain.value = 0.35;
      lfo.connect(lg).connect(ag.gain);
      a.connect(ag);
      b.connect(ag);
      ag.connect(out);
      const n = noiseSrc();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 1.5;
      const lfo2 = osc('sine', 0.37);
      const l2g = ctx.createGain();
      l2g.gain.value = 350;
      lfo2.connect(l2g).connect(bp.frequency);
      const ng = ctx.createGain();
      ng.gain.value = 0.12;
      n.connect(bp).connect(ng).connect(out);
    } else if (kind === 'engine') {
      const a = osc('sawtooth', 48);
      const b = osc('sawtooth', 48.7);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      a.connect(lp);
      b.connect(lp);
      const eg = ctx.createGain();
      eg.gain.value = 0.25;
      lp.connect(eg).connect(out);
      const hum = osc('sine', 220);
      const vib = osc('sine', 5);
      const vg = ctx.createGain();
      vg.gain.value = 6;
      vib.connect(vg).connect(hum.frequency);
      const hg = ctx.createGain();
      hg.gain.value = 0.06;
      hum.connect(hg).connect(out);
      const n = noiseSrc();
      const nl = ctx.createBiquadFilter();
      nl.type = 'bandpass';
      nl.frequency.value = 500;
      nl.Q.value = 0.6;
      const ngn = ctx.createGain();
      ngn.gain.value = 0.15;
      n.connect(nl).connect(ngn).connect(out);
      params.throttle = (v) => {
        const t = this.t;
        a.frequency.setTargetAtTime(44 + v * 50, t, 0.1);
        b.frequency.setTargetAtTime(44.8 + v * 51, t, 0.1);
        lp.frequency.setTargetAtTime(260 + v * 900, t, 0.1);
        nl.frequency.setTargetAtTime(400 + v * 1400, t, 0.1);
        hum.frequency.setTargetAtTime(200 + v * 140, t, 0.2);
      };
    } else if (kind === 'crickets') {
      // chirps are scheduled from update()
      params.chirp = () => {
        const f = rand(4200, 4800);
        const reps = 2 + ((Math.random() * 3) | 0);
        const p = rand(-0.8, 0.8);
        for (let i = 0; i < reps; i++) {
          const t0 = this.t + i * 0.09;
          const o = ctx.createOscillator();
          o.frequency.value = f;
          const am = ctx.createOscillator();
          am.frequency.value = 45;
          const amg = ctx.createGain();
          amg.gain.value = 0.5;
          const g = ctx.createGain();
          g.gain.value = 0.5;
          am.connect(amg).connect(g.gain);
          const e = ctx.createGain();
          this._env(e, t0, 0.04, 0.005, 0.03, 0.02);
          const pp = ctx.createStereoPanner();
          pp.pan.value = p;
          o.connect(g).connect(e).connect(pp).connect(out);
          o.start(t0);
          am.start(t0);
          o.stop(t0 + 0.08);
          am.stop(t0 + 0.08);
        }
      };
    } else if (kind === 'birds') {
      params.chirp = () => {
        const base = rand(2200, 3600);
        const n = 2 + ((Math.random() * 4) | 0);
        const p = rand(-0.9, 0.9);
        for (let i = 0; i < n; i++) {
          const t0 = this.t + i * rand(0.08, 0.14);
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(base * rand(0.9, 1.1), t0);
          o.frequency.exponentialRampToValueAtTime(base * rand(1.2, 1.6), t0 + 0.06);
          const e = ctx.createGain();
          this._env(e, t0, 0.03, 0.005, 0.02, 0.04);
          const pp = ctx.createStereoPanner();
          pp.pan.value = p;
          o.connect(e).connect(pp).connect(out);
          o.start(t0);
          o.stop(t0 + 0.1);
        }
      };
    } else if (kind === 'hum') {
      const a = osc('sine', 60);
      const b = osc('sine', 120);
      const g = ctx.createGain();
      g.gain.value = 0.05;
      a.connect(g);
      b.connect(g);
      g.connect(out);
    } else if (kind === 'static') {
      const n = noiseSrc();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.value = 0.06;
      n.connect(hp).connect(g).connect(out);
    }
    for (const n of nodes) n.start();
    const handle = {
      kind,
      params,
      gain: (v, tc = 0.08) => out.gain.setTargetAtTime(v, this.t, tc),
      pan: (v) => pan.pan.setTargetAtTime(clamp(v, -1, 1), this.t, 0.05),
      stop: () => {
        out.gain.setTargetAtTime(0, this.t, 0.05);
        setTimeout(() => {
          for (const n of nodes) {
            try { n.stop(); } catch { /* already stopped */ }
          }
          out.disconnect();
        }, 400);
        this.loops.delete(handle);
      },
    };
    this.loops.add(handle);
    return handle;
  }
}

export const audio = new AudioSys();
