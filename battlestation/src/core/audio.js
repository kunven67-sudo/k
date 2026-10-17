import * as THREE from 'three';
import { getBuffer } from './assets.js';

// Web Audio with 3D (HRTF) positioning, a small-room reverb and muffling through walls.
export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.sources = new Set();
    this.volumes = { master: 0.9, sfx: 1, ambient: 0.8 };
    this.occluder = null; // (position) => 0..1 how blocked a sound is from the listener
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(0.55, 2.6);
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = 0.22;
    this.reverbIn.connect(this.reverb).connect(this.master);
    this.bus = {};
    for (const k of ['sfx', 'ambient']) {
      this.bus[k] = ctx.createGain();
      this.bus[k].gain.value = this.volumes[k];
      this.bus[k].connect(this.master);
      this.bus[k].connect(this.reverbIn);
    }
  }

  impulse(seconds, decay) {
    const rate = this.ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < rate * 0.004 ? 0 : 1);
    }
    return buf;
  }

  setVolume(k, v) {
    this.volumes[k] = v;
    if (!this.ctx) return;
    if (k === 'master') this.master.gain.value = v; else this.bus[k].gain.value = v;
  }

  async load(name) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    const p = getBuffer('sounds/' + name).then(b => this.ctx.decodeAudioData(b.slice(0))).catch(e => { console.warn('sound', name, e.message); return null; });
    this.buffers.set(name, p);
    return p;
  }

  // Returns a handle you can stop / move. pos = THREE.Vector3 or null for "in your head".
  play(name, o = {}) {
    if (!this.ctx) return null;
    const h = { stopped: false, pos: o.pos ? o.pos.clone() : null, vol: o.vol ?? 1, src: null };
    this.load(name).then(buf => {
      if (!buf || h.stopped) return;
      this.attach(h, buf, o);
    });
    h.stop = (fade = 0.05) => {
      h.stopped = true;
      if (!h.src) return;
      const t = this.ctx.currentTime;
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setTargetAtTime(0, t, fade / 3);
      try { h.src.stop(t + fade + 0.05); } catch (e) { /* already stopped */ }
      this.sources.delete(h);
    };
    h.setVolume = v => { h.vol = v; if (h.gain) h.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); };
    h.setRate = r => { if (h.src) h.src.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.05); };
    h.setPos = p => { h.pos?.copy(p); };
    return h;
  }

  attach(h, buf, o) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = !!o.loop;
    src.playbackRate.value = (o.rate ?? 1) * (o.jitter ? 1 + (Math.random() * 2 - 1) * o.jitter : 1);
    const gain = ctx.createGain();
    gain.gain.value = h.vol;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lowpass ?? 20000;
    src.connect(lp).connect(gain);
    let out = gain;
    if (h.pos) {
      const pan = ctx.createPanner();
      pan.panningModel = 'HRTF';
      pan.distanceModel = 'inverse';
      pan.refDistance = o.ref ?? 0.6;
      pan.rolloffFactor = o.rolloff ?? 1.2;
      pan.positionX.value = h.pos.x; pan.positionY.value = h.pos.y; pan.positionZ.value = h.pos.z;
      gain.connect(pan);
      out = pan;
      h.pan = pan;
    }
    out.connect(this.bus[o.bus || 'sfx']);
    h.src = src; h.gain = gain; h.lp = lp; h.base = o.lowpass ?? 20000;
    src.start(0, o.offset ? o.offset % buf.duration : 0);
    this.sources.add(h);
    src.onended = () => { this.sources.delete(h); };
    if (h.pos) this.updateSource(h, true);
  }

  updateSource(h, now) {
    if (!h.pan) return;
    const t = this.ctx.currentTime;
    if (now) { h.pan.positionX.value = h.pos.x; h.pan.positionY.value = h.pos.y; h.pan.positionZ.value = h.pos.z; }
    else { h.pan.positionX.setTargetAtTime(h.pos.x, t, 0.02); h.pan.positionY.setTargetAtTime(h.pos.y, t, 0.02); h.pan.positionZ.setTargetAtTime(h.pos.z, t, 0.02); }
    if (this.occluder) {
      const occ = this.occluder(h.pos);
      h.lp.frequency.setTargetAtTime(Math.min(h.base, 20000 * Math.pow(0.03, occ)), t, 0.08);
    }
  }

  update(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener, t = this.ctx.currentTime;
    const p = camera.getWorldPosition(_v);
    const f = _f.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_q));
    const u = _u.set(0, 1, 0).applyQuaternion(_q);
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.01); l.positionY.setTargetAtTime(p.y, t, 0.01); l.positionZ.setTargetAtTime(p.z, t, 0.01);
      l.forwardX.setTargetAtTime(f.x, t, 0.01); l.forwardY.setTargetAtTime(f.y, t, 0.01); l.forwardZ.setTargetAtTime(f.z, t, 0.01);
      l.upX.setTargetAtTime(u.x, t, 0.01); l.upY.setTargetAtTime(u.y, t, 0.01); l.upZ.setTargetAtTime(u.z, t, 0.01);
    } else {
      l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
    for (const h of this.sources) if (h.pos) this.updateSource(h, false);
  }

  // A simple electronic beep (microwave, router, BIOS POST).
  noiseBuf() {
    if (this._noise) return this._noise;
    const ctx = this.ctx, len = ctx.sampleRate * 4;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = w * 0.5 + last * 3; }
    return (this._noise = b);
  }

  // short shaped burst of noise: can opening, fizz, cloth, spray. env = [attack, hold, release] seconds
  burst(o = {}) {
    if (!this.ctx) return;
    this.noiseBuf();
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = this._noise; src.playbackRate.value = o.rate ?? 1;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.frequency.value = o.freq ?? 3000; f.Q.value = o.q ?? 0.8;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + (o.env?.[0] ?? 0.01) + (o.env?.[1] ?? 0.1) + (o.env?.[2] ?? 0.2));
    const g = ctx.createGain();
    const [a, h, r] = o.env || [0.005, 0.08, 0.25];
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.1, t + a);
    g.gain.setValueAtTime(o.vol ?? 0.1, t + a + h); g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + r);
    src.connect(f).connect(g);
    let out = g;
    if (o.pos) {
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.refDistance = 0.4;
      pan.positionX.value = o.pos.x; pan.positionY.value = o.pos.y; pan.positionZ.value = o.pos.z;
      g.connect(pan); out = pan;
    }
    out.connect(this.bus.sfx);
    src.start(t, Math.random() * 2); src.stop(t + a + h + r + 0.05);
  }

  beep(freq = 2000, dur = 0.12, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol ?? 0.08, t + 0.004);
    g.gain.setValueAtTime(o.vol ?? 0.08, t + dur - 0.01);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
    osc.connect(lp).connect(g);
    let out = g;
    if (o.pos) {
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.refDistance = 0.5;
      pan.positionX.value = o.pos.x; pan.positionY.value = o.pos.y; pan.positionZ.value = o.pos.z;
      g.connect(pan); out = pan;
    }
    out.connect(this.bus.sfx);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // Filtered noise loop: PC fans, room tone, fridge compressor, shower...
  noiseLoop(o = {}) {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    this.noiseBuf();
    const src = ctx.createBufferSource();
    src.buffer = this._noise; src.loop = true;
    src.playbackRate.value = o.rate ?? 1;
    const bp = ctx.createBiquadFilter(); bp.type = o.filter || 'bandpass'; bp.frequency.value = o.freq ?? 300; bp.Q.value = o.q ?? 0.7;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp).connect(g);
    let out = g;
    const h = { pos: o.pos ? o.pos.clone() : null, base: 20000 };
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
    g.connect(lp); out = lp;
    if (h.pos) {
      const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = o.ref ?? 0.5; pan.rolloffFactor = o.rolloff ?? 1.4;
      pan.positionX.value = h.pos.x; pan.positionY.value = h.pos.y; pan.positionZ.value = h.pos.z;
      lp.connect(pan); out = pan; h.pan = pan;
    }
    out.connect(this.bus[o.bus || 'ambient']);
    src.start(0, Math.random() * 3);
    h.src = src; h.gain = g; h.filter = bp; h.lp = lp;
    h.setVolume = (v, tc = 0.3) => g.gain.setTargetAtTime(v, ctx.currentTime, tc);
    h.setFreq = f => bp.frequency.setTargetAtTime(f, ctx.currentTime, 0.3);
    h.stop = () => { try { src.stop(); } catch (e) { /* stopped */ } this.sources.delete(h); };
    this.sources.add(h);
    h.setVolume(o.vol ?? 0.1, 0.5);
    return h;
  }
}

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Quaternion();
