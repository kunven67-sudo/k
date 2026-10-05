// Felt sound. Space is silent, so everything here is what you'd feel through
// your own body: deep rumbles from impacts and jets, grinding under tidal stress,
// and a low drone that gets deeper as you grow. On top of that, sounds made the
// way scientists turn real space data into sound: pulsar beats, plasma
// whistlers, the chirp of merging black holes, and the radio chatter of a
// civilisation.

export class Rumble {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.started = false;
  }

  start() {
    if (this.started) {
      this.ctx?.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    this.started = true;
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.brown = this.makeNoise('brown', 6);
    this.white = this.makeNoise('white', 3);

    // ambient drone
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.0;
    this.droneGain.connect(this.master);
    const dn = this.loop(this.brown);
    this.droneLP = ctx.createBiquadFilter();
    this.droneLP.type = 'lowpass';
    this.droneLP.frequency.value = 90;
    dn.connect(this.droneLP).connect(this.droneGain);
    this.oscA = ctx.createOscillator();
    this.oscB = ctx.createOscillator();
    this.oscA.frequency.value = 43;
    this.oscB.frequency.value = 43 * 1.498;
    const og = ctx.createGain();
    og.gain.value = 0.09;
    this.oscA.connect(og); this.oscB.connect(og);
    og.connect(this.droneGain);
    this.oscA.start(); this.oscB.start();
    this.droneGain.gain.setTargetAtTime(0.5, ctx.currentTime, 3);

    // jets: low roar + volcanic crackle
    this.jetGain = ctx.createGain();
    this.jetGain.gain.value = 0;
    this.jetLP = ctx.createBiquadFilter();
    this.jetLP.type = 'lowpass';
    this.jetLP.frequency.value = 120;
    this.loop(this.brown).connect(this.jetLP).connect(this.jetGain).connect(this.master);
    this.crackGain = ctx.createGain();
    this.crackGain.gain.value = 0;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.8;
    this.loop(this.white).connect(bp).connect(this.crackGain).connect(this.master);

    // tidal grinding
    this.grindGain = ctx.createGain();
    this.grindGain.gain.value = 0;
    const gbp = ctx.createBiquadFilter();
    gbp.type = 'bandpass';
    gbp.frequency.value = 140;
    gbp.Q.value = 5;
    const trem = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.5;
    lfo.connect(lfoG).connect(trem.gain);
    lfo.start();
    this.loop(this.brown).connect(gbp).connect(trem).connect(this.grindGain).connect(this.master);

    // boiling surface: hiss when a star cooks you
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2400;
    hp.Q.value = 0.6;
    this.loop(this.white).connect(hp).connect(this.hissGain).connect(this.master);

    // pulsar: a pulse train at the spin rate (a beat when slow, a buzzing tone when fast)
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 0;
    this.pulseOsc = ctx.createOscillator();
    this.pulseOsc.type = 'square';
    this.pulseOsc.frequency.value = 2;
    const pbp = ctx.createBiquadFilter();
    pbp.type = 'bandpass';
    pbp.frequency.value = 900;
    pbp.Q.value = 0.7;
    const pshape = ctx.createGain();
    pshape.gain.value = 0.5;
    this.pulseOsc.connect(pshape).connect(pbp).connect(this.pulseGain).connect(this.master);
    this.pulseOsc.start();

    // civilisation radio: static with voices and beeps far away
    this.radioGain = ctx.createGain();
    this.radioGain.gain.value = 0;
    const rbp = ctx.createBiquadFilter();
    rbp.type = 'bandpass';
    rbp.frequency.value = 1400;
    rbp.Q.value = 1.2;
    const am = ctx.createGain();
    const amLfo = ctx.createOscillator();
    amLfo.frequency.value = 3.3;
    const amDepth = ctx.createGain();
    amDepth.gain.value = 0.4;
    amLfo.connect(amDepth).connect(am.gain);
    amLfo.start();
    this.loop(this.white).connect(rbp).connect(am).connect(this.radioGain).connect(this.master);
    this.radioT = 0;
    this.whistleT = 10;
  }

  // the chirp of two black holes merging (what LIGO heard in 2015, made audible)
  chirp() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    g.connect(this.master);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(35, t);
    o.frequency.exponentialRampToValueAtTime(320, t + 1.15);
    o.frequency.exponentialRampToValueAtTime(250, t + 1.5);
    o.connect(g);
    o.start(t);
    o.stop(t + 1.6);
  }

  // a whistler: lightning's radio waves sliding down along a magnetic field line
  whistler(vol = 0.08) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    g.connect(this.master);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(5500, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 1.7);
    o.connect(g);
    o.start(t);
    o.stop(t + 1.9);
  }

  // a short burst of radio: beeps or a garbled voice
  radioBurst(vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(this.master);
    if (Math.random() < 0.5) {
      // beeps
      let tt = t;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 6); i++) {
        const len = Math.random() < 0.5 ? 0.07 : 0.2;
        const o = ctx.createOscillator();
        o.frequency.value = 900 + Math.random() * 300;
        const og = ctx.createGain();
        og.gain.setValueAtTime(vol, tt);
        og.gain.setValueAtTime(0, tt + len);
        o.connect(og).connect(g);
        o.start(tt);
        o.stop(tt + len + 0.02);
        tt += len + 0.08;
      }
    } else {
      // a voice-like warble
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(140 + Math.random() * 80, t);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 6;
      for (let i = 0; i < 10; i++) f.frequency.setValueAtTime(500 + Math.random() * 1600, t + i * 0.09);
      const og = ctx.createGain();
      og.gain.setValueAtTime(vol * 0.7, t);
      og.gain.setValueAtTime(0, t + 0.95);
      o.connect(f).connect(og).connect(g);
      o.start(t);
      o.stop(t + 1);
    }
  }

  makeNoise(kind, seconds) {
    const ctx = this.ctx;
    const n = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  loop(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = 0;
    s.start(0, Math.random() * buf.duration);
    return s;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // called every frame with the current state of things
  update(s) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // the bigger you are, the deeper the drone
    const base = 52 - Math.min(28, s.stage * 1.7);
    this.oscA.frequency.setTargetAtTime(base, t, 1.5);
    this.oscB.frequency.setTargetAtTime(base * (s.compact ? 1.335 : 1.498), t, 1.5);
    this.droneLP.frequency.setTargetAtTime(s.star ? 180 : 90, t, 1);
    this.droneGain.gain.setTargetAtTime(s.paused ? 0.15 : 0.45 + (s.star ? 0.25 : 0), t, 0.5);
    const j = s.jet || 0;
    this.jetGain.gain.setTargetAtTime(j * (s.boost ? 1.1 : 0.6), t, 0.08);
    this.jetLP.frequency.setTargetAtTime(70 + j * (s.boost ? 220 : 110), t, 0.1);
    const crack = s.star || s.compact ? 0 : j * (0.05 + Math.random() * 0.12) * (s.boost ? 1.8 : 1);
    this.crackGain.gain.setTargetAtTime(crack, t, 0.02);
    this.grindGain.gain.setTargetAtTime(Math.min(1.2, s.stress * 2.2), t, 0.1);
    this.hissGain.gain.setTargetAtTime(Math.min(0.12, s.ablate * 4), t, 0.2);
    const w = s.world;
    const p = w?.player;
    // pulsar beats
    let pulse = 0, rate = 2;
    if (p && p.compact === 'ns' && !s.paused) { pulse = 0.12; rate = Math.min(p.nsSpin || 1, 700); }
    this.pulseGain.gain.setTargetAtTime(pulse, t, 0.3);
    this.pulseOsc.frequency.setTargetAtTime(Math.max(0.5, rate), t, 0.2);
    // radio chatter from your own civilisation (or a living world nearby)
    const life = s.life;
    let radio = 0;
    if (life && life.stage >= 7 && !s.paused) radio = 0.012 + 0.006 * (life.stage - 7);
    if (w && !s.paused) for (const b of w.bodies) if (b.alive && b.life === 2 && b !== p && p && p.distTo(b) < p.rEff * 60) radio = Math.max(radio, 0.02);
    this.radioGain.gain.setTargetAtTime(radio, t, 0.5);
    this.radioT -= 1 / 60;
    if (radio > 0 && this.radioT <= 0) { this.radioT = 1.5 + Math.random() * 4; this.radioBurst(radio * 3); }
    // whistlers on a world with a magnetic field and lightning
    this.whistleT -= 1 / 60;
    if (this.whistleT <= 0) {
      this.whistleT = 15 + Math.random() * 30;
      const pm = w?.planet;
      if (!s.paused && pm && !pm.giant && pm.field > 0.2 && pm.oceanState === 'liquid') this.whistler(0.05);
    }
  }

  // a deep thud; size 0..1
  impact(size, crunch = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(this.master);
    const amp = Math.min(1.2, 0.12 + size);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + size * 1.6);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70 + size * 20, t);
    o.frequency.exponentialRampToValueAtTime(22, t + 0.6 + size);
    o.connect(g);
    o.start(t);
    o.stop(t + 2.4 + size * 2);
    const n = this.ctx.createBufferSource();
    n.buffer = this.brown;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160 + crunch * 600;
    n.connect(lp).connect(g);
    n.start(t, Math.random() * 3);
    n.stop(t + 2 + size * 2);
    if (crunch > 0.05) {
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(crunch * 0.5, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      const w = ctx.createBufferSource();
      w.buffer = this.white;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 380;
      bp.Q.value = 1.4;
      w.connect(bp).connect(cg).connect(this.master);
      w.start(t, Math.random());
      w.stop(t + 0.4);
    }
  }

  // a slow swell for reaching a new stage
  swell(major = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(major ? 0.35 : 0.2, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + 7);
    g.connect(this.master);
    for (const f of [55, 82.4, 110, 164.8]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * (major ? 0.75 : 1);
      const og = ctx.createGain();
      og.gain.value = f > 100 ? 0.25 : 0.5;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 7.2);
    }
  }

  // supernovae, death: an enormous rolling rumble
  cataclysm() {
    if (!this.ctx) return;
    this.impact(1.2, 0.6);
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 9);
    g.connect(this.master);
    const n = ctx.createBufferSource();
    n.buffer = this.brown;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(40, t + 8);
    n.connect(lp).connect(g);
    n.start(t);
    n.stop(t + 9.5);
  }

  blip() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    const o = ctx.createOscillator();
    o.frequency.value = 180;
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }
}
