// Felt sound. Space is silent, so everything here is what you'd feel through
// your own body: deep rumbles from impacts and jets, grinding under tidal stress,
// and a low drone that gets deeper as you grow.

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
