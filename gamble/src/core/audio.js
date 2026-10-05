// Audio engine (Web Audio). Everything is original — sounds are synthesized into AudioBuffers
// once and cached; music is composed in code (src/audio/music/*). Real recordings (owner voice
// lines, licensed songs, Self Radio) play through the same buses.
//
// Buses: master → { music, sfx, ambience, voice, ui }. Each has its own Settings volume.
// Spatial: audio.play(buffer, { position, ... }) uses an HRTF PannerNode; the engine moves the
// listener with the camera every frame. Rooms: audio.setRoom('bathroom'|'motel'|'casino'|
// 'outdoor'|'car'|...) crossfades a convolution reverb send so spaces sound like spaces.
// Muffling: pass { occluded: 0..1 } (e.g. neighbor TV through a wall) for a lowpass.

import { settings } from './settings.js';
import { bus } from './events.js';
import { clamp } from './util.js';

const BUS_SETTINGS = {
  music: 'musicVolume',
  sfx: 'sfxVolume',
  ambience: 'ambienceVolume',
  voice: 'voiceVolume',
  ui: 'uiVolume',
};

// Reverb character for each kind of space: [seconds, decay power, wet level, damping 0..1].
export const ROOMS = {
  none: [0.1, 4, 0.0, 0.5],
  outdoor: [1.2, 3.2, 0.06, 0.6],
  street: [1.6, 3.0, 0.1, 0.55],
  motel: [0.45, 3.5, 0.12, 0.7],
  bathroom: [0.9, 2.2, 0.32, 0.25],
  car: [0.15, 4, 0.05, 0.85],
  casino: [2.4, 2.6, 0.2, 0.55],
  hall: [3.2, 2.4, 0.26, 0.45],
  garage: [2.0, 2.2, 0.3, 0.35],
  dmv: [1.1, 2.8, 0.16, 0.5],
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buses = {};
    this.buffers = new Map(); // name -> AudioBuffer (procedural cache)
    this.generators = new Map(); // name -> (ctx) => AudioBuffer
    this.unlocked = false;
    this.room = 'none';
    this._reverbs = {};
  }

  // Must be called from a user gesture on iOS; safe to call repeatedly.
  async unlock() {
    if (!this.ctx) this._create();
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        /* ignore */
      }
    }
    if (!this.unlocked && this.ctx.state === 'running') {
      this.unlocked = true;
      // iOS: play a silent buffer to fully unlock output.
      const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      s.connect(this.ctx.destination);
      s.start();
      bus.emit('audio:unlocked');
    }
  }

  _create() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;
    this.master.connect(this.limiter).connect(ctx.destination);
    for (const name of Object.keys(BUS_SETTINGS)) {
      const g = ctx.createGain();
      g.connect(this.master);
      this.buses[name] = g;
    }
    // Shared reverb send per room preset, crossfaded by setRoom().
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    for (const [name, preset] of Object.entries(ROOMS)) {
      const conv = ctx.createConvolver();
      conv.buffer = this._impulse(preset);
      const wet = ctx.createGain();
      wet.gain.value = name === this.room ? preset[2] : 0;
      this.reverbSend.connect(conv).connect(wet).connect(this.master);
      this._reverbs[name] = { conv, wet, preset };
    }
    this._applyVolumes();
    bus.on('settings:changed', ({ key }) => {
      if (key === 'masterVolume' || Object.values(BUS_SETTINGS).includes(key)) this._applyVolumes();
    });
  }

  _applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.get('masterVolume'), t, 0.05);
    for (const [name, key] of Object.entries(BUS_SETTINGS)) {
      this.buses[name].gain.setTargetAtTime(settings.get(key), t, 0.05);
    }
  }

  _impulse([seconds, power, , damping]) {
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(seconds * rate));
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, power);
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * (1 - damping * (i / len)); // darker tail over time
        data[i] = lp * env;
      }
    }
    return buf;
  }

  setRoom(name, fade = 0.4) {
    if (!this.ctx || !this._reverbs[name] || name === this.room) {
      this.room = name;
      return;
    }
    const t = this.ctx.currentTime;
    for (const [n, r] of Object.entries(this._reverbs)) {
      r.wet.gain.setTargetAtTime(n === name ? r.preset[2] : 0, t, fade / 3);
    }
    this.room = name;
  }

  // Listener follows the active camera (engine calls this each frame).
  setListener(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = camera.getWorldPosition(this._tmpP || (this._tmpP = camera.position.clone()));
    const m = camera.matrixWorld.elements;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(-m[8], t, 0.02);
      l.forwardY.setTargetAtTime(-m[9], t, 0.02);
      l.forwardZ.setTargetAtTime(-m[10], t, 0.02);
      l.upX.setTargetAtTime(m[4], t, 0.02);
      l.upY.setTargetAtTime(m[5], t, 0.02);
      l.upZ.setTargetAtTime(m[6], t, 0.02);
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(-m[8], -m[9], -m[10], m[4], m[5], m[6]);
    }
  }

  // Register a procedural sound: generator(ctx) returns an AudioBuffer. Built lazily, cached.
  define(name, generator) {
    this.generators.set(name, generator);
  }

  buffer(name) {
    if (!this.ctx) this._create();
    let b = this.buffers.get(name);
    if (!b) {
      const gen = this.generators.get(name);
      if (!gen) {
        console.warn(`[audio] unknown sound "${name}"`);
        return null;
      }
      b = gen(this.ctx);
      this.buffers.set(name, b);
    }
    return b;
  }

  // Load a real audio file (owner voice lines, Self Radio songs).
  async loadFile(name, url) {
    if (!this.ctx) this._create();
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const b = await this.ctx.decodeAudioData(arr);
    this.buffers.set(name, b);
    return b;
  }

  /**
   * Play a sound. Returns a handle { source, gain, stop(fadeSec), setPosition(v3) }.
   * opts: bus ('sfx'), gain (1), rate (1), detune (cents), loop (false), position ({x,y,z} → 3D),
   *       refDistance (2), rolloff (1.2), maxDistance (80), reverb (0..1 send, default 0.6),
   *       occluded (0..1 lowpass), when (sec offset), offset (start offset in buffer)
   */
  play(nameOrBuffer, opts = {}) {
    if (!this.ctx) this._create();
    const ctx = this.ctx;
    const buffer = typeof nameOrBuffer === 'string' ? this.buffer(nameOrBuffer) : nameOrBuffer;
    if (!buffer) return null;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = !!opts.loop;
    src.playbackRate.value = opts.rate ?? 1;
    if (opts.detune) src.detune.value = opts.detune;
    const gain = ctx.createGain();
    gain.gain.value = opts.gain ?? 1;
    let node = src;
    let filter = null;
    if (opts.occluded) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 18000 * Math.pow(1 - clamp(opts.occluded, 0, 0.98), 2.2) + 250;
      node.connect(filter);
      node = filter;
    }
    let panner = null;
    if (opts.position) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = opts.refDistance ?? 2;
      panner.rolloffFactor = opts.rolloff ?? 1.2;
      panner.maxDistance = opts.maxDistance ?? 80;
      const p = opts.position;
      if (panner.positionX) {
        panner.positionX.value = p.x;
        panner.positionY.value = p.y;
        panner.positionZ.value = p.z;
      } else panner.setPosition(p.x, p.y, p.z);
      node.connect(panner);
      node = panner;
    }
    node.connect(gain);
    gain.connect(this.buses[opts.bus || 'sfx']);
    const send = opts.reverb ?? (opts.bus === 'ui' || opts.bus === 'music' ? 0 : 0.6);
    if (send > 0) {
      const sg = ctx.createGain();
      sg.gain.value = send;
      gain.connect(sg).connect(this.reverbSend);
    }
    const when = ctx.currentTime + (opts.when || 0);
    src.start(when, opts.offset || 0);
    const handle = {
      source: src,
      gain,
      panner,
      filter,
      ended: false,
      stop(fade = 0.05) {
        if (handle.ended) return;
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + fade);
        try {
          src.stop(t + fade + 0.01);
        } catch {
          /* already stopped */
        }
      },
      setPosition(p) {
        if (!panner) return;
        const t = ctx.currentTime;
        if (panner.positionX) {
          panner.positionX.setTargetAtTime(p.x, t, 0.03);
          panner.positionY.setTargetAtTime(p.y, t, 0.03);
          panner.positionZ.setTargetAtTime(p.z, t, 0.03);
        } else panner.setPosition(p.x, p.y, p.z);
      },
      setGain(v, tc = 0.05) {
        gain.gain.setTargetAtTime(v, ctx.currentTime, tc);
      },
      setOcclusion(o) {
        if (filter) filter.frequency.setTargetAtTime(18000 * Math.pow(1 - clamp(o, 0, 0.98), 2.2) + 250, ctx.currentTime, 0.05);
      },
    };
    src.onended = () => {
      handle.ended = true;
    };
    return handle;
  }

  // Convenience for UI clicks etc.
  ui(name, opts = {}) {
    return this.play(name, { bus: 'ui', reverb: 0, ...opts });
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}

export const audio = new AudioEngine();

// Helper for generators: render `seconds` of audio with a sample callback (t, i) => [l, r] | v.
export function synth(ctx, seconds, fn, { stereo = false } = {}) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(seconds * rate));
  const buf = ctx.createBuffer(stereo ? 2 : 1, len, rate);
  const L = buf.getChannelData(0);
  const R = stereo ? buf.getChannelData(1) : null;
  for (let i = 0; i < len; i++) {
    const v = fn(i / rate, i, rate);
    if (stereo) {
      L[i] = v[0];
      R[i] = v[1];
    } else L[i] = v;
  }
  return buf;
}
