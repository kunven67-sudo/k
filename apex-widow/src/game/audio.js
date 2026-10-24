// Sound: the movie soundtrack (Kevin MacLeod, CC BY 4.0) crossfading by situation, and every sound effect made live
// with WebAudio: spider steps that get deeper as you grow, bites, slurps, silk, hisses, the elevator ding, stomps,
// gunshots, glass, alarms, heartbeat, rain, the lab hum, muffled giant voices when you're tiny.
import * as THREE from 'three';
import { audioBuffer, hasAsset } from '../core/assets.js';
import { clamp, rand } from '../core/util.js';

export class Audio {
  constructor(game) {
    this.game = game; this.ctx = null; this.ready = false;
    this.music = {}; this.track = null; this.wantTrack = null; this.trackGain = {};
    this.loops = {}; this.t = 0; this.stepT = 0;
  }
  // must be called from a click (browsers block sound before that)
  async unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.connect(C.destination);
    const comp = C.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.connect(this.master); this.out = comp;
    this.bus = {};
    for (const k of ['music', 'sfx', 'spider', 'voices', 'world', 'news']) { const g = C.createGain(); g.connect(this.out); this.bus[k] = g; }
    // a small room reverb for everything that isn't music
    this.verb = C.createConvolver(); this.verb.buffer = this.impulse(1.8, 2.2); const vg = C.createGain(); vg.gain.value = 0.22; this.verb.connect(vg); vg.connect(this.out);
    this.noise = this.makeNoise();
    this.applyVolumes();
    this.ready = true;
    this.startLoops();
    // music decodes in the background
    for (const k of ['menu', 'tiny', 'tense', 'city', 'huge', 'space', 'boss', 'end']) {
      if (!hasAsset(`music/${k}.ogg`)) continue;
      audioBuffer(C, `music/${k}.ogg`).then(b => { this.music[k] = b; if (this.wantTrack === k && this.track !== k) this.playTrack(k); }).catch(() => {});
    }
  }
  applyVolumes() {
    if (!this.ctx) return;
    const s = this.game.settings;
    this.master.gain.value = (s.master ?? 1);
    this.bus.music.gain.value = (s.music ?? 0.7) * 0.8;
    this.bus.sfx.gain.value = s.sfx ?? 1; this.bus.spider.gain.value = s.spiderVol ?? 1; this.bus.voices.gain.value = s.voices ?? 1;
    this.bus.world.gain.value = s.world ?? 1; this.bus.news.gain.value = s.news ?? 1;
  }
  impulse(sec, decay) {
    const C = this.ctx, n = Math.floor(C.sampleRate * sec), b = C.createBuffer(2, n, C.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay; }
    return b;
  }
  makeNoise() { const C = this.ctx, n = C.sampleRate * 2, b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }

  // ------------------------------------------------------------------ music
  setTrack(k) {
    this.wantTrack = k;
    if (!this.ready || this.track === k) return;
    if (this.music[k]) this.playTrack(k);
  }
  playTrack(k) {
    const C = this.ctx;
    const old = this.cur;
    if (old) { old.g.gain.cancelScheduledValues(C.currentTime); old.g.gain.setValueAtTime(old.g.gain.value, C.currentTime); old.g.gain.linearRampToValueAtTime(0, C.currentTime + 3); old.src.stop(C.currentTime + 3.2); }
    if (!k || !this.music[k]) { this.cur = null; this.track = k; return; }
    const src = C.createBufferSource(); src.buffer = this.music[k]; src.loop = true;
    const g = C.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(1, C.currentTime + 3);
    src.connect(g); g.connect(this.bus.music); src.start();
    this.cur = { src, g, k }; this.track = k;
  }
  zoneChanged(z) { /* picked in update() from the situation */ }
  pickTrack() {
    const G = this.game;
    if (G.state === 'menu') return 'menu';
    if (G.story && G.story.musicOverride) return G.story.musicOverride;
    if (!G.zone || !G.player) return 'menu';
    const p = G.player, z = G.zone.id;
    if (G.wanted && G.wanted.level >= 2 && G.wanted.heat > 0.3) return 'tense';
    if (z === 'halvern') { if (p.sizeM > 60) return 'huge'; if (G.zone.inside && !G.zone.inside(p.pos)) return 'city'; return 'tiny'; }
    if (z === 'earth') return 'huge';
    if (G.story && G.story.flags.boss) return 'boss';
    return 'space';
  }

  // ------------------------------------------------------------------ helpers
  env(node, t0, a, peak, d, end = 0.0001) { const g = node.gain; g.setValueAtTime(0.0001, t0); g.linearRampToValueAtTime(peak, t0 + a); g.exponentialRampToValueAtTime(Math.max(end, 0.0001), t0 + a + d); }
  noiseBurst({ dur = 0.1, f = 2000, q = 1, type = 'bandpass', vol = 0.5, bus = 'sfx', pan = 0, at = 0, verb = 0.3, rate = 1 }) {
    if (!this.ready) return;
    const C = this.ctx, t = C.currentTime + at;
    const s = C.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate;
    const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = C.createGain(); this.env(g, t, 0.003, vol, dur);
    const p = C.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    s.connect(fl); fl.connect(g); g.connect(p); p.connect(this.bus[bus]); if (verb) { const vg = C.createGain(); vg.gain.value = verb; p.connect(vg); vg.connect(this.verb); }
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  tone({ f = 440, f2 = null, dur = 0.2, type = 'sine', vol = 0.3, bus = 'sfx', pan = 0, at = 0, a = 0.005, verb = 0.2 }) {
    if (!this.ready) return;
    const C = this.ctx, t = C.currentTime + at;
    const o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = C.createGain(); this.env(g, t, a, vol, dur);
    const p = C.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    o.connect(g); g.connect(p); p.connect(this.bus[bus]); if (verb) { const vg = C.createGain(); vg.gain.value = verb; p.connect(vg); vg.connect(this.verb); }
    o.start(t); o.stop(t + a + dur + 0.05);
  }
  // where is a sound relative to the camera: pan + loudness (distance measured in YOUR body lengths, like you hear it)
  spatial(pos) {
    const G = this.game, cam = G.camera; if (!pos) return { pan: 0, vol: 1 };
    const rel = pos.clone().applyMatrix4(cam.matrixWorldInverse);
    const s = G.player ? Math.max(G.player.sizeM / (G.zone ? G.zone.unit : 1), 1e-9) : 1;
    const dBL = rel.length() / s;
    return { pan: clamp(rel.x / (Math.abs(rel.z) + Math.abs(rel.x) + 1e-9), -1, 1) * 0.8, vol: clamp(6 / (dBL + 6), 0, 1) };
  }

  // ------------------------------------------------------------------ the spider's own sounds (deeper + louder as it grows)
  sizePitch() { const m = this.game.player ? this.game.player.sizeM : 0.004; return clamp(Math.pow(0.004 / m, 0.18), 0.12, 1.4); }
  step(p, L) {
    this.stepT += 1; if (!this.ready || this.stepT % 2) return;
    const k = this.sizePitch(), big = 1 - k;
    this.noiseBurst({ dur: 0.02 + big * 0.12, f: 4200 * k + 120, q: 2.5, vol: 0.03 + big * 0.35, bus: 'spider', pan: rand(-0.3, 0.3), verb: 0.1 + big * 0.4 });
    if (p.sizeM > 2) this.tone({ f: 60 * k + 25, f2: 30, dur: 0.25, type: 'sine', vol: clamp(big * 0.6, 0, 0.6), bus: 'spider', verb: 0.5 });
  }
  land(p, impact) { const k = this.sizePitch(); this.noiseBurst({ dur: 0.08 + (1 - k) * 0.3, f: 1500 * k + 90, q: 1, vol: clamp(0.1 + impact * 0.04, 0, 0.8), bus: 'spider', verb: 0.4 }); }
  jump(p) { const k = this.sizePitch(); this.noiseBurst({ dur: 0.05, f: 3000 * k, q: 3, vol: 0.12, bus: 'spider' }); }
  bite() { const k = this.sizePitch(); this.noiseBurst({ dur: 0.05, f: 5200 * k + 200, q: 6, vol: 0.4, bus: 'spider' }); this.noiseBurst({ dur: 0.12, f: 900 * k + 80, q: 1.5, vol: 0.35, bus: 'spider', at: 0.02 }); this.tone({ f: 2200 * k + 100, f2: 900 * k + 60, dur: 0.05, type: 'square', vol: 0.06, bus: 'spider' }); }
  crunch() { const k = this.sizePitch(); for (let i = 0; i < 4; i++) this.noiseBurst({ dur: 0.04 + Math.random() * 0.05, f: (2500 + Math.random() * 2500) * k + 100, q: 4, vol: 0.32, bus: 'spider', at: i * 0.06 + Math.random() * 0.03 }); }
  slurpStart() {
    if (!this.ready || this.slurp) return;
    const C = this.ctx, k = this.sizePitch();
    const s = C.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 * k + 80; f.Q.value = 5;
    const lfo = C.createOscillator(); lfo.frequency.value = 5.5; const lg = C.createGain(); lg.gain.value = 400 * k + 40; lfo.connect(lg); lg.connect(f.frequency);
    const g = C.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.22, C.currentTime + 0.2);
    s.connect(f); f.connect(g); g.connect(this.bus.spider); s.start(); lfo.start();
    this.slurp = { s, g, lfo };
  }
  slurpStop() { if (!this.slurp) return; const C = this.ctx, S = this.slurp; S.g.gain.linearRampToValueAtTime(0, C.currentTime + 0.2); S.s.stop(C.currentTime + 0.25); S.lfo.stop(C.currentTime + 0.25); this.slurp = null; }
  silk() { const k = this.sizePitch(); this.noiseBurst({ dur: 0.18, f: 6000 * k + 300, q: 0.8, type: 'highpass', vol: 0.18, bus: 'spider', verb: 0.1 }); this.tone({ f: 1800 * k + 100, f2: 600 * k + 50, dur: 0.15, type: 'sine', vol: 0.04, bus: 'spider' }); }
  hurt(p) { const k = this.sizePitch(); this.noiseBurst({ dur: 0.15, f: 1800 * k + 100, q: 2, vol: 0.4, bus: 'spider' }); this.tone({ f: 300 * k + 40, f2: 120 * k + 30, dur: 0.2, type: 'sawtooth', vol: 0.08, bus: 'spider' }); }
  hissMe() { const k = this.sizePitch(); this.noiseBurst({ dur: 0.5, f: 4500 * k + 200, q: 0.7, type: 'highpass', vol: 0.3, bus: 'spider', verb: 0.3 }); }
  molt() { const k = this.sizePitch(); for (let i = 0; i < 12; i++) this.noiseBurst({ dur: 0.03, f: (3000 + Math.random() * 3000) * k + 100, q: 6, vol: 0.2, bus: 'spider', at: i * 0.14 + Math.random() * 0.1 }); }
  death() { this.slurpStop(); this.tone({ f: 120, f2: 40, dur: 2.2, type: 'sine', vol: 0.5, bus: 'sfx', verb: 0.6 }); this.noiseBurst({ dur: 1.2, f: 300, q: 0.7, type: 'lowpass', vol: 0.4, verb: 0.6 }); }
  heartbeat(vol = 0.5) { for (const at of [0, 0.22]) this.tone({ f: 55, f2: 38, dur: 0.18, type: 'sine', vol: vol * (at ? 0.7 : 1), bus: 'sfx', at, verb: 0.05 }); }
  ui(kind = 'click') { if (kind === 'click') this.tone({ f: 1200, f2: 800, dur: 0.05, type: 'triangle', vol: 0.08, bus: 'sfx', verb: 0 }); else if (kind === 'card') this.noiseBurst({ dur: 0.25, f: 3000, q: 0.5, vol: 0.12, verb: 0.2 }); else if (kind === 'level') { this.tone({ f: 440, dur: 0.4, vol: 0.12, verb: 0.5 }); this.tone({ f: 660, dur: 0.6, vol: 0.12, at: 0.12, verb: 0.5 }); } }

  // ------------------------------------------------------------------ world sounds at a position
  at(name, pos) {
    if (!this.ready) return;
    const { pan, vol } = this.spatial(pos);
    if (vol < 0.01) return;
    switch (name) {
      case 'ding': this.tone({ f: 1318, dur: 0.9, vol: 0.25 * vol, pan, bus: 'world', verb: 0.5 }); this.tone({ f: 1046, dur: 1.2, vol: 0.22 * vol, pan, at: 0.32, bus: 'world', verb: 0.5 }); break;
      case 'liftStart': this.tone({ f: 70, f2: 90, dur: 1.5, type: 'sawtooth', vol: 0.05 * vol, pan, bus: 'world', a: 0.4 }); break;
      case 'stomp': this.tone({ f: 70, f2: 35, dur: 0.3, vol: 0.9 * vol, pan, bus: 'world', verb: 0.4 }); this.noiseBurst({ dur: 0.15, f: 400, q: 1, type: 'lowpass', vol: 0.7 * vol, pan, bus: 'world' }); break;
      case 'gunshot': this.noiseBurst({ dur: 0.35, f: 1200, q: 0.4, type: 'lowpass', vol: 1.0 * vol, pan, bus: 'world', verb: 0.8 }); this.tone({ f: 90, f2: 40, dur: 0.3, vol: 0.6 * vol, pan, bus: 'world' }); break;
      case 'critterBite': this.noiseBurst({ dur: 0.06, f: 3000, q: 4, vol: 0.4 * vol, pan, bus: 'world' }); break;
      case 'hiss': this.noiseBurst({ dur: 0.7, f: 5000, q: 0.6, type: 'highpass', vol: 0.4 * vol, pan, bus: 'world', verb: 0.3 }); break;
      case 'glass': for (let i = 0; i < 9; i++) this.tone({ f: 2500 + Math.random() * 4500, dur: 0.3 + Math.random() * 0.6, type: 'sine', vol: 0.08 * vol, pan, at: Math.random() * 0.25, bus: 'world', verb: 0.6 }); this.noiseBurst({ dur: 0.5, f: 5000, q: 0.5, type: 'highpass', vol: 0.6 * vol, pan, bus: 'world', verb: 0.6 }); break;
      case 'scream': this.tone({ f: 620, f2: 880, dur: 0.9, type: 'sawtooth', vol: 0.06 * vol, pan, bus: 'voices', a: 0.08, verb: 0.5 }); break;
      case 'spray': this.noiseBurst({ dur: 0.4, f: 7000, q: 0.5, type: 'highpass', vol: 0.25 * vol, pan, bus: 'world' }); break;
      case 'crash': this.noiseBurst({ dur: 1.4, f: 500, q: 0.5, type: 'lowpass', vol: 1.0 * vol, pan, bus: 'world', verb: 0.8 }); this.tone({ f: 50, f2: 25, dur: 1.2, vol: 0.8 * vol, pan, bus: 'world' }); break;
      case 'alarm': this.tone({ f: 740, f2: 990, dur: 0.6, type: 'square', vol: 0.06 * vol, bus: 'world', verb: 0.6 }); break;
      default: break;
    }
  }
  // a giant voice: muffled booming babble when you're tiny, clear (with subtitles) when you're bigger
  voice(h, sizeM) {
    if (!this.ready) return;
    const C = this.ctx, { pan, vol } = this.spatial(h.pos);
    const clear = clamp((sizeM - 0.01) / 0.3, 0, 1);
    const base = (h.sex === 'f' ? 210 : 120) * (0.55 + 0.45 * clear);
    const n = 6 + Math.floor(Math.random() * 8);
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 350 + clear * 3000;
    const pn = C.createStereoPanner(); pn.pan.value = pan; lp.connect(pn); pn.connect(this.bus.voices);
    const vg = C.createGain(); vg.gain.value = 0.35; pn.connect(vg); vg.connect(this.verb);
    for (let i = 0; i < n; i++) {
      const t = C.currentTime + i * 0.13 + Math.random() * 0.04, d = 0.08 + Math.random() * 0.09;
      const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.25), t); o.frequency.linearRampToValueAtTime(base * (0.85 + Math.random() * 0.3), t + d);
      const f1 = C.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 500 + Math.random() * 600; f1.Q.value = 4;
      const f2 = C.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1200 + Math.random() * 1400; f2.Q.value = 5;
      const g = C.createGain(); this.env(g, t, 0.02, 0.5 * vol, d);
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(lp); o.start(t); o.stop(t + d + 0.05);
    }
  }

  // ------------------------------------------------------------------ ambience loops
  startLoops() {
    const C = this.ctx;
    const mk = (f, q, type, bus) => { const s = C.createBufferSource(); s.buffer = this.noise; s.loop = true; const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = C.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.bus[bus]); s.start(); return { g, fl }; };
    this.loops.rain = mk(3500, 0.4, 'highpass', 'world');
    this.loops.wind = mk(300, 0.7, 'lowpass', 'world');
    this.loops.room = mk(150, 1, 'lowpass', 'world');
    const o = C.createOscillator(); o.frequency.value = 120; o.type = 'sine'; const hg = C.createGain(); hg.gain.value = 0; o.connect(hg); hg.connect(this.bus.world); o.start(); this.loops.hum = { g: hg, o };
  }
  update(dt) {
    if (!this.ready) return;
    this.t += dt;
    this.setTrack(this.pickTrack());
    const G = this.game, Z = G.zone, p = G.player;
    const inside = Z && Z.inside && p ? Z.inside(G.camera.position) : false;
    const k = 1 - Math.exp(-dt * 2);
    const set = (L, v) => { L.g.gain.value += (v - L.g.gain.value) * k; };
    const play = G.state === 'play' || G.state === 'cutscene' || G.state === 'evolve';
    const rain = Z && Z.city ? Z.city.rain : 0;
    set(this.loops.rain, play && Z && Z.id === 'halvern' ? rain * (inside ? 0.04 : 0.22) : 0);
    set(this.loops.wind, play && Z ? (inside ? 0.01 : 0.08) : 0);
    set(this.loops.room, play && inside ? 0.05 : 0);
    set(this.loops.hum, play && inside ? 0.015 : 0);
    // heartbeat when hurt or hunted
    if (play && p && (p.hp < 30 || (G.wanted && G.wanted.heat > 0.7))) { this.hbT = (this.hbT || 0) - dt; if (this.hbT <= 0) { this.hbT = p.hp < 15 ? 0.6 : 0.9; this.heartbeat(0.35); } }
  }
}
