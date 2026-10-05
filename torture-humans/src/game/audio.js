// Sound, all made in code (no sound files): footsteps that get deeper and
// heavier the bigger you are, babbling voices for speech bubbles (squeaky when
// tiny), the shrink ray, squishes, glass, and the world around you (birds by
// day, crickets at night, rain, the hum of the lab).
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

export class Audio {
  constructor({ settings, camera }) {
    this.settings = settings;
    this.camera = camera;
    this.ctx = null;
    // browsers only allow sound after you click or press a key
    const start = () => this.start();
    addEventListener('pointerdown', start, { once: true });
    addEventListener('keydown', start, { once: true });
    settings.onChange?.(() => this.applyVolumes());
  }

  vol(kind) {
    const a = this.settings.get('audio') || {};
    return (a.master ?? 1) * (a[kind] ?? 1);
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.bus = {};
    for (const k of ['effects', 'voices', 'ambience']) { this.bus[k] = ctx.createGain(); this.bus[k].connect(this.master); }
    this.applyVolumes();
    // one second of white noise, reused by everything noisy
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbience();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = 0.8;
    for (const k of Object.keys(this.bus)) this.bus[k].gain.value = this.vol(k);
  }

  // a sound at a place in the world: panned and quieter with distance
  spatial(pos, ref = 2, bus = 'effects') {
    const ctx = this.ctx;
    const out = ctx.createGain();
    if (!pos) { out.connect(this.bus[bus]); return out; }
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = 1.2;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    out.connect(p);
    p.connect(this.bus[bus]);
    return out;
  }

  noiseBurst({ at = null, ref = 2, dur = 0.08, freq = 800, q = 1, gain = 0.3, type = 'bandpass', bus = 'effects', when = 0 }) {
    const ctx = this.ctx;
    if (!ctx) return; // sound starts after your first click/key
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rand(0.9, 1.1);
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.spatial(at, ref, bus));
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  tone({ at = null, ref = 2, freq = 440, to = null, dur = 0.2, gain = 0.2, type = 'sine', bus = 'effects', when = 0, attack = 0.01 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.spatial(at, ref, bus));
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---- sounds

  // your footstep: a soft scuff when small, a heavy thud when big (and a BOOM as a giant)
  step(scale, surface = 'floor') {
    if (!this.ctx) return;
    const s = THREE.MathUtils.clamp(scale, 0.001, 30);
    const k = Math.pow(s, -0.45);
    const base = surface === 'grass' ? 500 : surface === 'wood' ? 900 : 1300;
    this.noiseBurst({ freq: THREE.MathUtils.clamp(base * k, 60, 9000), q: 0.8, dur: 0.06 + 0.05 * Math.min(4, Math.sqrt(s)), gain: THREE.MathUtils.clamp(0.08 * Math.pow(s, 0.35), 0.01, 0.6) });
    if (s > 1.5) this.tone({ freq: 70 / Math.sqrt(s / 1.5), to: 30, dur: 0.25 + s * 0.03, gain: Math.min(0.9, 0.1 * s), type: 'sine' });
  }

  land(scale, hard) {
    if (!this.ctx) return;
    this.noiseBurst({ freq: 300 / Math.sqrt(Math.max(scale, 0.01)), q: 0.6, dur: 0.15, gain: Math.min(0.7, 0.15 + hard * 0.3) });
    this.tone({ freq: 90 / Math.sqrt(Math.max(scale, 0.01)), to: 40, dur: 0.2, gain: Math.min(0.6, 0.1 + hard * 0.3) });
  }

  // babble for a speech bubble: syllables at the speaker's pitch (small people squeak)
  voice(h, text, { shout = false } = {}) {
    if (!this.ctx || !text) return;
    const at = h.character?.root?.getWorldPosition(new THREE.Vector3());
    const female = h.character?.gender === 'f';
    const scale = Math.max(0.002, h.scale ?? 1);
    const base = (female ? 220 : 130) * Math.pow(scale, -0.35) * (h.pitch ??= rand(0.9, 1.12)) * (shout ? 1.25 : 1);
    // you're tiny and they're big: their voice is a deep, slow rumble to you
    const rumble = this.playerScale && this.playerScale < 0.2 && scale > this.playerScale * 5;
    const slow = rumble ? 1.6 : 1;
    const syl = Math.min(14, Math.max(2, Math.round(text.replace(/[^a-z]/gi, '').length / 3)));
    const ref = Math.max(0.4, 3 * Math.sqrt(scale));
    for (let i = 0; i < syl; i++) {
      const when = i * 0.085 * slow + rand(0, 0.02);
      const f = base * rand(0.85, 1.25) * (rumble ? 0.55 : 1);
      this.tone({ at, ref: rumble ? ref * 3 : ref, freq: f, to: f * rand(0.8, 1.1), dur: 0.07 * slow, gain: (shout ? 0.11 : 0.06) * (rumble ? 1.6 : 1), type: rumble ? 'sine' : 'triangle', bus: 'voices', when, attack: 0.008 });
      this.tone({ at, ref, freq: f * 2.7, dur: 0.05, gain: 0.015, type: 'sine', bus: 'voices', when });
    }
  }

  chargeHum(level) {
    if (!this.ctx) return;
    if (!this.hum) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = this.ctx.createGain(); g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.bus.effects); o.start();
      this.hum = { o, g };
    }
    this.hum.o.frequency.setTargetAtTime(90 + level * 600, this.ctx.currentTime, 0.05);
    this.hum.g.gain.setTargetAtTime(level > 0 ? 0.05 + level * 0.06 : 0, this.ctx.currentTime, 0.04);
  }

  zap(grow = false) {
    if (!this.ctx) return;
    this.tone({ freq: grow ? 300 : 2400, to: grow ? 2400 : 120, dur: 0.35, gain: 0.18, type: 'sawtooth' });
    this.noiseBurst({ freq: 3000, q: 0.5, dur: 0.25, gain: 0.08, type: 'highpass' });
  }

  squish(at) {
    if (!this.ctx) return;
    this.noiseBurst({ at, freq: 400, q: 2, dur: 0.18, gain: 0.35, type: 'lowpass' });
    this.tone({ at, freq: 180, to: 60, dur: 0.15, gain: 0.15, type: 'sine' });
  }

  clink(at) {
    if (!this.ctx) return;
    for (const [f, g] of [[2100, 0.08], [3900, 0.05], [6200, 0.03]]) this.tone({ at, freq: f, dur: 0.6, gain: g, type: 'sine', attack: 0.002 });
  }

  // Mom's vacuum cleaner: a loud whine + rushing air while it's on (pos = where it is, null = off)
  vacuum(pos) {
    if (!this.ctx) return;
    if (!this.vac && pos) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.7;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 220;
      const og = ctx.createGain(); og.gain.value = 0.04;
      const g = ctx.createGain(); g.gain.value = 0;
      const pan = ctx.createPanner(); pan.panningModel = 'equalpower'; pan.refDistance = 1.5; pan.rolloffFactor = 1.3;
      src.connect(f); f.connect(g); o.connect(og); og.connect(g); g.connect(pan); pan.connect(this.bus.effects);
      src.start(); o.start();
      this.vac = { g, pan };
    }
    if (!this.vac) return;
    if (pos) { this.vac.pan.positionX.value = pos.x; this.vac.pan.positionY.value = pos.y; this.vac.pan.positionZ.value = pos.z; }
    this.vac.g.gain.setTargetAtTime(pos ? 0.35 : 0, this.ctx.currentTime, 0.2);
  }

  click() { if (this.ctx) this.tone({ freq: 1200, dur: 0.04, gain: 0.05, type: 'square' }); }

  // ---- the world around you

  startAmbience() {
    const ctx = this.ctx;
    const loop = (filterType, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.bus.ambience); src.start();
      return g;
    };
    this.rain = loop('bandpass', 2500, 0.4);
    this.wind = loop('lowpass', 300, 0.7);
    // the lab: a low electrical hum
    const o = ctx.createOscillator(); o.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.frequency.value = 120;
    this.labHum = ctx.createGain(); this.labHum.gain.value = 0;
    o.connect(this.labHum); o2.connect(this.labHum); this.labHum.connect(this.bus.ambience);
    o.start(); o2.start();
    this.nextCritter = 1;
  }

  updateListener() {
    const l = this.ctx.listener, c = this.camera;
    const f = c.getWorldDirection(new THREE.Vector3());
    if (l.positionX) {
      l.positionX.value = c.position.x; l.positionY.value = c.position.y; l.positionZ.value = c.position.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(c.position.x, c.position.y, c.position.z);
      l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  update(dt, { env, zone, player }) {
    this.playerScale = player?.scale ?? 1;
    if (!this.ctx) return;
    this.updateListener();
    const t = this.ctx.currentTime;
    const outside = zone === 'outside', lab = zone === 'lab';
    const rain = env?.weather?.rain ?? 0;
    this.rain.gain.setTargetAtTime(rain * (outside ? 0.25 : lab ? 0.0 : 0.08), t, 0.5);
    this.wind.gain.setTargetAtTime(outside ? 0.05 + (env?.weather?.cloud ?? 0) * 0.08 : 0, t, 0.5);
    this.labHum.gain.setTargetAtTime(lab ? 0.012 : 0, t, 0.5);
    // birds in the day, crickets at night (outside, or faintly through the window)
    this.nextCritter -= dt;
    if (this.nextCritter <= 0 && !lab) {
      const night = env?.night ?? 0;
      const far = outside ? 1 : 0.25;
      const around = this.camera.position.clone().add(new THREE.Vector3(rand(-15, 15), rand(2, 6), rand(-15, 15)));
      if (night > 0.5) {
        for (let i = 0; i < 6; i++) this.tone({ at: around, ref: 6, freq: 4300 + rand(-80, 80), dur: 0.03, gain: 0.03 * far, type: 'sine', bus: 'ambience', when: i * 0.06 });
        this.nextCritter = rand(0.4, 1.4);
      } else if (rain < 0.3) {
        const f0 = rand(2600, 4200), n = Math.floor(rand(2, 6));
        for (let i = 0; i < n; i++) this.tone({ at: around, ref: 8, freq: f0 * rand(0.9, 1.15), to: f0 * rand(1.1, 1.4), dur: rand(0.06, 0.12), gain: 0.035 * far, type: 'sine', bus: 'ambience', when: i * rand(0.08, 0.14) });
        this.nextCritter = rand(1.5, 5);
      } else this.nextCritter = 2;
    }
    // your footsteps: one per stride (a stride is ~0.7 of your height-scaled meter)
    if (player) {
      const moving = player.grounded && (player.actualSpeed ?? 0) > 0.15 * player.scale && !player.ladder?.active;
      if (moving) {
        this.stepDist = (this.stepDist ?? 0) + player.actualSpeed * dt;
        if (this.stepDist > 0.75 * player.scale) { this.stepDist = 0; this.step(player.scale, outside ? 'grass' : lab ? 'floor' : 'wood'); }
      } else this.stepDist = 0.5 * player.scale;
      if (player.grounded && this.wasAir && this.airT > 0.25) this.land(player.scale, Math.min(1, this.airT));
      this.airT = player.grounded ? 0 : (this.airT ?? 0) + dt;
      this.wasAir = !player.grounded;
    }
  }
}
