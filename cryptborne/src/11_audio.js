
// =====================================================================
// AUDIO — everything is synthesized live with WebAudio (no sound files).
// AU: context + buses (sfx, ambience, music) and a small reverb.
// Sfx: one-shot effects, optionally positional. Music: procedural songs
// per mood. Amb: looping ambience beds and random nature sounds.
// =====================================================================
const AU = {
  ctx: null, master: null, sfx: null, amb: null, music: null, verbIn: null, noise: null, longNoise: null,
  init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ac = (this.ctx = new AC());
      this.master = ac.createGain(); this.master.connect(ac.destination);
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.master);
      this.sfx = ac.createGain(); this.amb = ac.createGain(); this.music = ac.createGain();
      for (const b of [this.sfx, this.amb, this.music]) b.connect(comp);
      // small generated reverb
      const len = Math.floor(ac.sampleRate * 2.2), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      const conv = ac.createConvolver(); conv.buffer = ir; this.verbIn = ac.createGain(); this.verbIn.gain.value = 0.6; this.verbIn.connect(conv); conv.connect(comp);
      const mk = (sec) => { const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; };
      this.noise = mk(0.6); this.longNoise = mk(3);
      this.vols(); Amb.init();
    } catch (e) { this.ctx = null; }
  },
  unlock() { if (!this.ctx) this.init(); else if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
  vols() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime((SET.sfx / 100) * 0.6, t, 0.05);
    this.amb.gain.setTargetAtTime((SET.sfx / 100) * 0.5, t, 0.05);
    this.music.gain.setTargetAtTime((SET.music / 100) * 0.45, t, 0.05);
  },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function auRoute(node, dest, o) {
  const ac = AU.ctx;
  if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); node.connect(p); node = p; }
  node.connect(dest);
  if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; node.connect(s); s.connect(AU.verbIn); }
}
// one oscillator voice with an envelope
function aTone(dest, f, dur, o = {}) {
  const ac = AU.ctx; if (!ac) return; const t = o.at != null ? o.at : ac.currentTime + (o.delay || 0);
  const os = ac.createOscillator(); os.type = o.type || 'square'; os.frequency.setValueAtTime(f, t);
  if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, f + o.slide), t + (o.slideT || dur));
  if (o.detune) os.detune.value = o.detune;
  if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + 0.1); }
  let node = os;
  if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = o.q || 0.7; node.connect(fl); node = fl; }
  const g = ac.createGain(), v = o.vol == null ? 0.2 : o.vol, a = o.attack || 0.004;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
  if (o.hold) g.gain.setValueAtTime(v, t + Math.max(a, dur - (o.release || 0.15)));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g); auRoute(g, dest, o); os.start(t); os.stop(t + dur + 0.05);
}
// filtered noise burst
function aNoise(dest, dur, o = {}) {
  const ac = AU.ctx; if (!ac || !AU.noise) return; const t = o.at != null ? o.at : ac.currentTime + (o.delay || 0);
  const s = ac.createBufferSource(); s.buffer = AU.noise; s.playbackRate.value = o.rate || 1;
  const f = ac.createBiquadFilter(); f.type = o.f || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1200, t); f.Q.value = o.q || 1;
  if (o.fslide) f.frequency.exponentialRampToValueAtTime(Math.max(30, (o.freq || 1200) + o.fslide), t + dur);
  const g = ac.createGain(), v = o.vol == null ? 0.2 : o.vol;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.attack || 0.003)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); auRoute(g, dest, o); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.05);
}

// ---------- sound effects ----------
const SFX = {
  swing: (d, m, o) => aNoise(d, 0.09, Object.assign({ freq: 2400, fslide: -1200, vol: 0.18 * m }, o)),
  heavy: (d, m, o) => { aNoise(d, 0.16, Object.assign({ freq: 900, fslide: -500, vol: 0.25 * m }, o)); },
  shoot: (d, m, o) => { aTone(d, 660, 0.08, Object.assign({ vol: 0.06 * m, slide: -300 }, o)); aNoise(d, 0.05, Object.assign({ freq: 3000, vol: 0.08 * m }, o)); },
  magic: (d, m, o) => { aTone(d, 440, 0.22, Object.assign({ type: 'sawtooth', vol: 0.05 * m, slide: 500, lp: 2200 }, o)); aTone(d, 880, 0.3, Object.assign({ type: 'sine', vol: 0.05 * m, slide: 300 }, o)); },
  hit: (d, m, o) => { aNoise(d, 0.07, Object.assign({ freq: 900, vol: 0.32 * m }, o)); aTone(d, 180, 0.06, Object.assign({ vol: 0.09 * m, slide: -80 }, o)); },
  crit: (d, m, o) => { aNoise(d, 0.1, Object.assign({ freq: 700, vol: 0.38 * m }, o)); aTone(d, 300, 0.12, Object.assign({ vol: 0.12 * m, slide: 300 }, o)); },
  hurt: (d, m, o) => { aTone(d, 220, 0.18, Object.assign({ type: 'sawtooth', vol: 0.14 * m, slide: -140, lp: 1800 }, o)); aNoise(d, 0.1, Object.assign({ freq: 500, vol: 0.2 * m }, o)); },
  kill: (d, m, o) => { aTone(d, 300, 0.08, Object.assign({ vol: 0.08 * m, slide: -150 }, o)); aNoise(d, 0.16, Object.assign({ freq: 400, vol: 0.2 * m }, o)); },
  coin: (d, m, o) => { aTone(d, 988, 0.05, Object.assign({ vol: 0.05 * m }, o)); aTone(d, 1319, 0.11, Object.assign({ vol: 0.05 * m, delay: 0.05 }, o)); },
  pickup: (d, m, o) => { aTone(d, 660, 0.06, Object.assign({ type: 'triangle', vol: 0.13 * m }, o)); aTone(d, 880, 0.09, Object.assign({ type: 'triangle', vol: 0.13 * m, delay: 0.05 }, o)); },
  chest: (d, m, o) => [523, 659, 784, 1047].forEach((f, i) => aTone(d, f, 0.14, Object.assign({ vol: 0.06 * m, delay: i * 0.07 }, o))),
  level: (d, m, o) => [523, 659, 784, 1047, 1319].forEach((f, i) => aTone(d, f, 0.18, Object.assign({ vol: 0.08 * m, delay: i * 0.09, verb: 0.3 }, o))),
  dodge: (d, m, o) => aNoise(d, 0.16, Object.assign({ freq: 3000, fslide: -2000, vol: 0.14 * m }, o)),
  block: (d, m, o) => { aTone(d, 140, 0.08, Object.assign({ vol: 0.14 * m }, o)); aNoise(d, 0.07, Object.assign({ freq: 1800, vol: 0.28 * m }, o)); },
  parry: (d, m, o) => { aTone(d, 1200, 0.15, Object.assign({ type: 'triangle', vol: 0.16 * m, slide: -400 }, o)); aTone(d, 1800, 0.3, Object.assign({ type: 'sine', vol: 0.09 * m, verb: 0.4 }, o)); },
  portal: (d, m, o) => aTone(d, 200, 0.6, Object.assign({ type: 'sine', vol: 0.14 * m, slide: 600, verb: 0.4 }, o)),
  buy: (d, m, o) => { aTone(d, 784, 0.06, Object.assign({ vol: 0.07 * m }, o)); aTone(d, 1175, 0.1, Object.assign({ vol: 0.07 * m, delay: 0.06 }, o)); },
  error: (d, m, o) => aTone(d, 150, 0.15, Object.assign({ vol: 0.09 * m }, o)),
  drink: (d, m, o) => { for (let i = 0; i < 3; i++) aTone(d, 300 + i * 90, 0.08, Object.assign({ type: 'sine', vol: 0.12 * m, slide: 200, delay: i * 0.09 }, o)); },
  boss: (d, m, o) => { aTone(d, 110, 0.8, Object.assign({ type: 'sawtooth', vol: 0.13 * m, slide: -50, lp: 900, verb: 0.5 }, o)); aTone(d, 82, 1, Object.assign({ vol: 0.08 * m, delay: 0.2, lp: 600 }, o)); },
  death: (d, m, o) => aTone(d, 300, 0.9, Object.assign({ type: 'sawtooth', vol: 0.15 * m, slide: -250, lp: 1200, verb: 0.4 }, o)),
  click: (d, m, o) => aTone(d, 880, 0.03, Object.assign({ vol: 0.035 * m }, o)),
  explode: (d, m, o) => { aNoise(d, 0.4, Object.assign({ freq: 300, f: 'lowpass', vol: 0.45 * m, verb: 0.2 }, o)); aTone(d, 60, 0.3, Object.assign({ type: 'sine', vol: 0.25 * m, slide: -30 }, o)); },
  slam: (d, m, o) => { aNoise(d, 0.3, Object.assign({ freq: 200, f: 'lowpass', vol: 0.5 * m }, o)); aTone(d, 70, 0.35, Object.assign({ vol: 0.16 * m, slide: -30 }, o)); },
  splash: (d, m, o) => aNoise(d, 0.22, Object.assign({ freq: 1300, fslide: -700, q: 0.8, vol: 0.16 * m }, o)),
  unlock: (d, m, o) => { aTone(d, 520, 0.06, Object.assign({ vol: 0.08 * m }, o)); aNoise(d, 0.08, Object.assign({ freq: 2500, vol: 0.15 * m, delay: 0.07 }, o)); aTone(d, 780, 0.15, Object.assign({ vol: 0.08 * m, delay: 0.12 }, o)); },
  lever: (d, m, o) => { aNoise(d, 0.25, Object.assign({ freq: 600, vol: 0.3 * m }, o)); aTone(d, 90, 0.3, Object.assign({ vol: 0.12 * m, delay: 0.1 }, o)); },
  gate: (d, m, o) => { for (let i = 0; i < 6; i++) aNoise(d, 0.12, Object.assign({ freq: 300 + i * 40, vol: 0.25 * m, delay: i * 0.13 }, o)); aTone(d, 55, 1.2, Object.assign({ type: 'sawtooth', vol: 0.1 * m, lp: 300, verb: 0.5 }, o)); },
  heal: (d, m, o) => [523, 784, 1047].forEach((f, i) => aTone(d, f, 0.5, Object.assign({ type: 'sine', vol: 0.06 * m, delay: i * 0.08, verb: 0.5 }, o))),
  page: (d, m, o) => { aNoise(d, 0.12, Object.assign({ freq: 4000, f: 'highpass', vol: 0.1 * m }, o)); aNoise(d, 0.1, Object.assign({ freq: 3000, f: 'highpass', vol: 0.08 * m, delay: 0.13 }, o)); },
  special: (d, m, o) => { aTone(d, 330, 0.3, Object.assign({ type: 'sawtooth', vol: 0.06 * m, slide: 330, lp: 2000 }, o)); aNoise(d, 0.25, Object.assign({ freq: 1500, fslide: 1500, vol: 0.12 * m }, o)); },
  zap: (d, m, o) => { for (let i = 0; i < 4; i++) aNoise(d, 0.05, Object.assign({ freq: 3000 + Math.random() * 2000, q: 4, vol: 0.18 * m, delay: i * 0.03 }, o)); aTone(d, 1400, 0.12, Object.assign({ type: 'sawtooth', vol: 0.05 * m, slide: -900 }, o)); },
  freeze: (d, m, o) => { aNoise(d, 0.4, Object.assign({ freq: 6000, f: 'highpass', vol: 0.12 * m }, o)); aTone(d, 2000, 0.4, Object.assign({ type: 'sine', vol: 0.05 * m, slide: -800 }, o)); },
  thunder: (d, m, o) => { aNoise(d, 2.2, Object.assign({ freq: 120, f: 'lowpass', vol: 0.7 * m, attack: 0.02, verb: 0.6 }, o)); aNoise(d, 0.3, Object.assign({ freq: 800, vol: 0.3 * m }, o)); },
  hammer: (d, m, o) => { aTone(d, 1650, 0.25, Object.assign({ type: 'triangle', vol: 0.09 * m }, o)); aTone(d, 2470, 0.18, Object.assign({ type: 'sine', vol: 0.05 * m }, o)); aNoise(d, 0.05, Object.assign({ freq: 3500, vol: 0.16 * m }, o)); },
  fail: (d, m, o) => { aNoise(d, 0.3, Object.assign({ freq: 2500, vol: 0.25 * m }, o)); aTone(d, 200, 0.4, Object.assign({ type: 'sawtooth', vol: 0.08 * m, slide: -120, lp: 900 }, o)); },
  pet: (d, m, o) => { aTone(d, 900, 0.07, Object.assign({ type: 'sine', vol: 0.08 * m, slide: 300 }, o)); aTone(d, 1200, 0.08, Object.assign({ type: 'sine', vol: 0.06 * m, delay: 0.08 }, o)); },
  quest: (d, m, o) => [392, 523, 659, 784].forEach((f, i) => aTone(d, f, 0.2, Object.assign({ type: 'triangle', vol: 0.09 * m, delay: i * 0.08 }, o))),
  bell: (d, m, o) => { aTone(d, 660, 2.4, Object.assign({ type: 'sine', vol: 0.12 * m, verb: 0.6 }, o)); aTone(d, 1820, 1.2, Object.assign({ type: 'sine', vol: 0.04 * m }, o)); },
  // footsteps per surface
  st_grass: (d, m, o) => aNoise(d, 0.06, Object.assign({ freq: 700, f: 'lowpass', vol: 0.09 * m }, o)),
  st_stone: (d, m, o) => { aNoise(d, 0.035, Object.assign({ freq: 2600, q: 2, vol: 0.06 * m }, o)); aTone(d, 260, 0.025, Object.assign({ type: 'triangle', vol: 0.04 * m }, o)); },
  st_wood: (d, m, o) => { aTone(d, 150, 0.07, Object.assign({ type: 'triangle', vol: 0.09 * m, slide: -40 }, o)); aNoise(d, 0.04, Object.assign({ freq: 500, f: 'lowpass', vol: 0.06 * m }, o)); },
  st_water: (d, m, o) => aNoise(d, 0.14, Object.assign({ freq: 1500, fslide: -800, q: 0.7, vol: 0.11 * m }, o)),
  st_sand: (d, m, o) => aNoise(d, 0.08, Object.assign({ freq: 2500, f: 'highpass', vol: 0.05 * m }, o)),
  st_snow: (d, m, o) => { aNoise(d, 0.05, Object.assign({ freq: 1700, q: 1.5, vol: 0.09 * m }, o)); aNoise(d, 0.05, Object.assign({ freq: 1200, q: 1.5, vol: 0.07 * m, delay: 0.04 }, o)); },
  st_mud: (d, m, o) => { aNoise(d, 0.1, Object.assign({ freq: 400, f: 'lowpass', vol: 0.1 * m }, o)); aTone(d, 90, 0.08, Object.assign({ type: 'sine', vol: 0.06 * m, slide: 40 }, o)); },
};
// monster voices: [kind, pitch]
const VOICE = {
  squelch: (d, m, p, o) => { aTone(d, 140 * p, 0.2, Object.assign({ type: 'sine', vol: 0.22 * m, slide: -70 }, o)); aNoise(d, 0.12, Object.assign({ freq: 350, f: 'lowpass', vol: 0.12 * m }, o)); },
  squeak: (d, m, p, o) => { aTone(d, 1900 * p, 0.06, Object.assign({ vol: 0.05 * m, slide: 700 }, o)); aTone(d, 2100 * p, 0.05, Object.assign({ vol: 0.04 * m, slide: 500, delay: 0.08 }, o)); },
  growl: (d, m, p, o) => { aTone(d, 85 * p, 0.5, Object.assign({ type: 'sawtooth', vol: 0.13 * m, slide: -15, vib: [23, 12], lp: 700 }, o)); aNoise(d, 0.45, Object.assign({ freq: 280, f: 'lowpass', vol: 0.1 * m }, o)); },
  howl: (d, m, p, o) => aTone(d, 420 * p, 1.6, Object.assign({ type: 'sine', vol: 0.09 * m, slide: 260, slideT: 0.6, vib: [5, 8], attack: 0.25, verb: 0.7 }, o)),
  cackle: (d, m, p, o) => { for (let i = 0; i < 4; i++) aTone(d, (620 + (i % 2) * 260) * p, 0.06, Object.assign({ vol: 0.05 * m, delay: i * 0.07 }, o)); },
  rattle: (d, m, p, o) => { for (let i = 0; i < 6; i++) aNoise(d, 0.025, Object.assign({ freq: 3200 * p, q: 3, vol: 0.12 * m, delay: i * 0.035 }, o)); },
  hiss: (d, m, p, o) => aNoise(d, 0.4, Object.assign({ freq: 4500 * p, f: 'highpass', vol: 0.12 * m, attack: 0.05 }, o)),
  grunt: (d, m, p, o) => { aTone(d, 110 * p, 0.22, Object.assign({ type: 'sawtooth', vol: 0.16 * m, slide: -40, lp: 600 }, o)); aNoise(d, 0.18, Object.assign({ freq: 220, f: 'lowpass', vol: 0.12 * m }, o)); },
  screech: (d, m, p, o) => aTone(d, 1100 * p, 0.32, Object.assign({ type: 'sawtooth', vol: 0.06 * m, slide: 700, lp: 3500 }, o)),
  rumble: (d, m, p, o) => { aNoise(d, 0.7, Object.assign({ freq: 120 * p, f: 'lowpass', vol: 0.45 * m }, o)); aTone(d, 48 * p, 0.7, Object.assign({ type: 'sine', vol: 0.2 * m }, o)); },
  wail: (d, m, p, o) => { aTone(d, 380 * p, 1.1, Object.assign({ type: 'sine', vol: 0.09 * m, slide: 180, vib: [6, 10], attack: 0.2, verb: 0.6 }, o)); aTone(d, 290 * p, 1.1, Object.assign({ type: 'sine', vol: 0.05 * m, slide: 120, attack: 0.3 }, o)); },
  croak: (d, m, p, o) => { aTone(d, 150 * p, 0.12, Object.assign({ vol: 0.1 * m, lp: 900 }, o)); aTone(d, 130 * p, 0.14, Object.assign({ vol: 0.1 * m, lp: 900, delay: 0.15 }, o)); },
  chime: (d, m, p, o) => { aTone(d, 1320 * p, 0.6, Object.assign({ type: 'sine', vol: 0.06 * m, verb: 0.6 }, o)); aTone(d, 1980 * p, 0.4, Object.assign({ type: 'sine', vol: 0.04 * m, delay: 0.06 }, o)); },
  roar: (d, m, p, o) => { aNoise(d, 0.8, Object.assign({ freq: 320 * p, q: 0.8, vol: 0.45 * m, attack: 0.05 }, o)); aTone(d, 70 * p, 0.8, Object.assign({ type: 'sawtooth', vol: 0.18 * m, slide: -25, lp: 500, verb: 0.3 }, o)); },
  shout: (d, m, p, o) => { aTone(d, 210 * p, 0.25, Object.assign({ vol: 0.09 * m, slide: -50, lp: 1500 }, o)); aNoise(d, 0.2, Object.assign({ freq: 1000, vol: 0.08 * m }, o)); },
  clack: (d, m, p, o) => { for (let i = 0; i < 3; i++) aNoise(d, 0.03, Object.assign({ freq: 2600 * p, q: 5, vol: 0.16 * m, delay: i * 0.06 }, o)); },
  moan: (d, m, p, o) => aTone(d, 170 * p, 0.9, Object.assign({ type: 'triangle', vol: 0.13 * m, slide: -45, vib: [4, 6], attack: 0.15, lp: 800 }, o)),
  crackle: (d, m, p, o) => { for (let i = 0; i < 5; i++) aNoise(d, 0.04, Object.assign({ freq: 1800 * p, q: 2, vol: 0.12 * m, delay: Math.random() * 0.3 }, o)); },
};
const Sfx = {
  last: {},
  // o: { x, y } plays positionally relative to the hero
  play(name, o) {
    const ac = AU.ctx; if (!ac || SET.sfx <= 0) return;
    const nowMs = performance.now(); if (this.last[name] && nowMs - this.last[name] < 35) return; this.last[name] = nowMs;
    const opt = {}; let m = 1;
    if (o && o.x != null && typeof G !== 'undefined' && G.p) { const d = dist(o.x, o.y, G.p.x, G.p.y); m = clamp(1 - d / (o.range || 320), 0, 1); if (m < 0.03) return; m *= m; opt.pan = clamp((o.x - G.p.x) / 220, -0.9, 0.9); }
    if (o && o.vol) m *= o.vol;
    if (typeof G !== 'undefined' && G.area && G.area.kind === 'dungeon') opt.verb = 0.28;
    const f = SFX[name]; if (f) f(AU.sfx, m, opt);
  },
  voice(kind, pitch = 1, o) {
    const ac = AU.ctx; if (!ac || SET.sfx <= 0 || !VOICE[kind]) return;
    const opt = {}; let m = 1;
    if (o && o.x != null && G.p) { const d = dist(o.x, o.y, G.p.x, G.p.y); m = clamp(1 - d / 300, 0, 1); if (m < 0.04) return; m *= m; opt.pan = clamp((o.x - G.p.x) / 220, -0.9, 0.9); }
    if (G.area && G.area.kind === 'dungeon') opt.verb = 0.3;
    VOICE[kind](AU.sfx, m, pitch, opt);
  },
};

// ---------- procedural music ----------
// A mood = tempo, scale, chord progression (scale degrees) and parts. Patterns
// use one character per 16th note: 'x' plays, 'o' plays accented, '.' rests.
const MOODS = {
  title: { bpm: 72, root: 50, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], parts: [
    { i: 'pad', chord: 1, v: 0.045 }, { i: 'bass', pat: 'x...............', oct: -1, len: 14, v: 0.16 },
    { i: 'bell', rnd: 0.09, oct: 1, v: 0.05 }, { i: 'drum', pat: 'x...........x...', v: 0.18 } ] },
  town: { bpm: 96, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], parts: [
    { i: 'pad', chord: 1, v: 0.025 }, { i: 'bass', pat: 'x.......x.......', oct: -1, len: 6, v: 0.15, walk: [0, 2] },
    { i: 'pluck', pat: 'x.x.x.x.x.x.x.x.', arp: [0, 1, 2, 1, 0, 2, 1, 2], oct: 0, len: 3, v: 0.06 },
    { i: 'lead', mel: 0.34, oct: 1, v: 0.035, inst: 'flute' }, { i: 'hat', pat: '..x...x...x...x.', v: 0.025 } ] },
  wild: { bpm: 112, root: 57, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 0, 6], parts: [
    { i: 'pad', chord: 1, v: 0.025 }, { i: 'bass', pat: 'x.x.x.x.x.x.x.x.', oct: -1, len: 2, v: 0.13 },
    { i: 'pluck', pat: 'x..x..x.x..x..x.', arp: [0, 2, 1, 2], oct: 0, len: 3, v: 0.05 },
    { i: 'lead', mel: 0.42, oct: 1, v: 0.035 }, { i: 'kick', pat: 'x.......x.......', v: 0.22 }, { i: 'hat', pat: '..x...x...x...x.', v: 0.03 } ] },
  night: { bpm: 66, root: 52, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 3, 0, 4], parts: [
    { i: 'pad', chord: 1, v: 0.04 }, { i: 'bell', rnd: 0.12, oct: 1, v: 0.045 }, { i: 'bass', pat: 'x...............', oct: -1, len: 12, v: 0.1 } ] },
  dungeon: { bpm: 58, root: 48, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 0, 1, 0], parts: [
    { i: 'drone', chord: 1, v: 0.05 }, { i: 'bell', rnd: 0.07, oct: 1, v: 0.04, dis: 1 }, { i: 'drum', pat: 'x...............', v: 0.2, every: 2 } ] },
  boss: { bpm: 150, root: 52, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 6, 4], parts: [
    { i: 'bass', pat: 'xxxxxxxxxxxxxxxx', oct: -1, len: 1, v: 0.12 }, { i: 'saw', pat: 'x.....x.....x...', v: 0.05 },
    { i: 'lead', mel: 0.55, oct: 1, v: 0.04, fast: 1 }, { i: 'kick', pat: 'x...x...x...x...', v: 0.28 }, { i: 'snare', pat: '....x.......x...', v: 0.13 }, { i: 'hat', pat: 'x.x.x.x.x.x.x.x.', v: 0.025 } ] },
  final: { bpm: 140, root: 50, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 3, 4], parts: [
    { i: 'choir', chord: 1, v: 0.05 }, { i: 'bass', pat: 'x.xxx.xxx.xxx.xx', oct: -1, len: 1, v: 0.12 }, { i: 'saw', pat: 'x.......x.......', v: 0.045 },
    { i: 'kick', pat: 'x..x..x.x..x..x.', v: 0.28 }, { i: 'snare', pat: '....x.......x...', v: 0.13 }, { i: 'bell', rnd: 0.14, oct: 1, v: 0.04 } ] },
  swamp: { bpm: 74, root: 54, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 3, 1, 0], parts: [
    { i: 'drone', chord: 1, v: 0.04, wob: 1 }, { i: 'bass', pat: 'x.....x.........', oct: -1, len: 4, v: 0.13 }, { i: 'bell', rnd: 0.08, oct: 1, v: 0.04 }, { i: 'drum', pat: '........x.......', v: 0.12 } ] },
  frost: { bpm: 80, root: 59, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], parts: [
    { i: 'pad', chord: 1, v: 0.03 }, { i: 'bell', pat: 'x..x..x...x..x..', arp: [0, 1, 2, 3], oct: 1, v: 0.04 }, { i: 'lead', mel: 0.22, oct: 1, v: 0.03, inst: 'flute' } ] },
  desert: { bpm: 100, root: 50, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 0, 1, 0], parts: [
    { i: 'drone', chord: 1, v: 0.035 }, { i: 'drum', pat: 'x..x..x.x..x....', v: 0.16 }, { i: 'tek', pat: '..x...x...x..xx.', v: 0.06 },
    { i: 'lead', mel: 0.45, oct: 1, v: 0.04, inst: 'reed' } ] },
  coast: { bpm: 126, steps: 12, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], parts: [
    { i: 'bass', pat: 'x.....x.....', oct: -2, len: 4, v: 0.15, walk: [0, 2] }, { i: 'pluck', pat: '..x.x...x.x.', arp: [1, 2, 1, 2], oct: 0, len: 2, v: 0.05 },
    { i: 'lead', mel: 0.4, oct: 1, v: 0.035, inst: 'reed' }, { i: 'kick', pat: 'x.....x.....', v: 0.18 } ] },
  sad: { bpm: 60, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], parts: [
    { i: 'pad', chord: 1, v: 0.035 }, { i: 'pluck', pat: 'x...x...x...x...', arp: [0, 1, 2, 1], oct: 0, len: 6, v: 0.06 }, { i: 'bell', rnd: 0.06, oct: 1, v: 0.035 } ] },
  victory: { bpm: 90, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], parts: [
    { i: 'pad', chord: 1, v: 0.04 }, { i: 'pluck', pat: 'x.x.x.x.x.x.x.x.', arp: [0, 1, 2, 3], oct: 0, len: 3, v: 0.05 }, { i: 'lead', mel: 0.4, oct: 1, v: 0.04, inst: 'flute' }, { i: 'drum', pat: 'x.......x.......', v: 0.14 } ] },
};
const Music = {
  mood: null, playing: null, gain: null, next: 0, step: 0, bar: 0, mel: 2,
  set(mood) { this.mood = mood; },
  degToMidi(M, deg, oct) { const n = M.scale.length, o = Math.floor(deg / n); return M.root + (oct + o) * 12 + M.scale[((deg % n) + n) % n]; },
  tick() {
    const ac = AU.ctx; if (!ac) return;
    if (this.playing !== this.mood) {
      const t = ac.currentTime;
      if (this.gain) { const old = this.gain; old.gain.setTargetAtTime(0.0001, t, 0.5); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 4000); }
      this.playing = this.mood; this.gain = null;
      if (!this.mood) return;
      this.gain = ac.createGain(); this.gain.gain.setValueAtTime(0.0001, t); this.gain.gain.setTargetAtTime(1, t + 0.2, 0.7); this.gain.connect(AU.music);
      const sv = ac.createGain(); sv.gain.value = 0.22; this.gain.connect(sv); sv.connect(AU.verbIn);
      this.step = 0; this.bar = 0; this.next = t + 0.15;
    }
    const M = MOODS[this.playing]; if (!M || !this.gain) return;
    const sd = 60 / M.bpm / 4, steps = M.steps || 16;
    if (this.next < ac.currentTime - 0.2) this.next = ac.currentTime + 0.05; // after the tab was hidden
    while (this.next < ac.currentTime + 0.3) {
      this.playStep(M, this.next, sd, steps);
      this.next += sd; if (++this.step >= steps) { this.step = 0; this.bar++; }
    }
  },
  playStep(M, t, sd, steps) {
    const d = this.gain, s = this.step, chordDeg = M.prog[this.bar % M.prog.length];
    const chord = [chordDeg, chordDeg + 2, chordDeg + 4, chordDeg + 6];
    for (const p of M.parts) {
      if (p.every && this.bar % p.every) continue;
      const on = p.pat ? p.pat[s] : null;
      switch (p.i) {
        case 'pad': case 'drone': case 'choir':
          if (s === 0) { const notes = p.i === 'drone' ? [this.degToMidi(M, chordDeg, -1), this.degToMidi(M, chordDeg + 4, -1)] : chord.slice(0, 3).map((g) => this.degToMidi(M, g, 0)); for (const n of notes) this.inst(p.i, d, n, t, sd * steps, p.v, p); }
          break;
        case 'bass': if (on === 'x' || on === 'o') { const w = p.walk ? p.walk[(s / (steps / p.walk.length)) | 0] || 0 : 0; this.inst('bass', d, this.degToMidi(M, chordDeg + w, p.oct || -1), t, sd * (p.len || 2), p.v); } break;
        case 'pluck': if (on === 'x' || on === 'o') { const k = p.arp[(s / 2 | 0) % p.arp.length]; this.inst('pluck', d, this.degToMidi(M, chord[k], p.oct || 0), t, sd * (p.len || 3), p.v); } break;
        case 'bell':
          if (p.pat) { if (on === 'x') { const k = p.arp[(s / 3 | 0) % p.arp.length]; this.inst('bell', d, this.degToMidi(M, chord[k] , p.oct || 1), t, 1.6, p.v); } }
          else if (s % 2 === 0 && Math.random() < p.rnd) { const deg = p.dis && Math.random() < 0.4 ? chordDeg + pick([1, 3, 5]) : pick(chord.slice(0, 3)); this.inst('bell', d, this.degToMidi(M, deg, p.oct || 1), t, 2.2, p.v); }
          break;
        case 'lead': {
          const grid = p.fast ? 1 : 2; if (s % grid) break;
          if (Math.random() < p.mel) {
            const strong = s % 4 === 0;
            if (strong) { const target = pick(chord.slice(0, 3)) + 7; this.mel += clamp(target - this.mel, -2, 2); } else this.mel += pick([-1, -1, 1, 1, 2, -2, 0]);
            this.mel = clamp(this.mel, 3, 13);
            this.inst(p.inst || 'lead', d, this.degToMidi(M, this.mel, (p.oct || 1) - 1), t, sd * grid * pick([1, 1, 2, 3]), p.v);
          }
          break;
        }
        case 'saw': if (on === 'x') { this.inst('saw', d, this.degToMidi(M, chordDeg, -1), t, sd * 3, p.v); this.inst('saw', d, this.degToMidi(M, chordDeg, -1) + 7, t, sd * 3, p.v); } break;
        default: if (on === 'x' || on === 'o') this.inst(p.i, d, 0, t, sd, p.v * (on === 'o' ? 1.4 : 1));
      }
    }
  },
  inst(kind, d, midi, t, dur, v, p = {}) {
    const f = midi ? mtof(midi) : 0;
    switch (kind) {
      case 'pad': aTone(d, f, dur + 0.6, { type: 'sawtooth', vol: v, attack: 0.6, hold: 1, release: 0.6, lp: 900, at: t, detune: -6 }); aTone(d, f, dur + 0.6, { type: 'sawtooth', vol: v * 0.8, attack: 0.6, hold: 1, release: 0.6, lp: 900, at: t, detune: 7 }); break;
      case 'drone': aTone(d, f, dur + 0.8, { type: 'sawtooth', vol: v, attack: 1.2, hold: 1, release: 0.8, lp: 420, at: t, vib: p.wob ? [0.6, 4] : null }); break;
      case 'choir': aTone(d, f, dur + 0.5, { type: 'triangle', vol: v, attack: 0.4, hold: 1, release: 0.5, vib: [5, 3], at: t }); aTone(d, f * 2, dur + 0.5, { type: 'sine', vol: v * 0.5, attack: 0.5, hold: 1, vib: [5.5, 4], at: t }); break;
      case 'bass': aTone(d, f, dur, { type: 'triangle', vol: v, attack: 0.01, at: t }); aTone(d, f, dur * 0.6, { type: 'sawtooth', vol: v * 0.25, lp: 500, at: t }); break;
      case 'pluck': aTone(d, f, dur + 0.25, { type: 'triangle', vol: v, attack: 0.003, at: t, lp: 2600 }); aTone(d, f * 2, dur * 0.5, { type: 'sine', vol: v * 0.3, at: t }); break;
      case 'lead': aTone(d, f, dur + 0.1, { type: 'square', vol: v, attack: 0.02, lp: 1700, vib: [5.5, 4], hold: 1, release: 0.1, at: t }); break;
      case 'flute': aTone(d, f, dur + 0.15, { type: 'sine', vol: v * 1.4, attack: 0.05, vib: [5, 5], hold: 1, release: 0.12, at: t }); aTone(d, f * 2, dur, { type: 'sine', vol: v * 0.25, attack: 0.05, at: t }); break;
      case 'reed': aTone(d, f, dur + 0.1, { type: 'sawtooth', vol: v * 0.8, attack: 0.03, lp: 1300, q: 3, vib: [6, 6], hold: 1, release: 0.1, at: t }); break;
      case 'bell': aTone(d, f, dur, { type: 'sine', vol: v, attack: 0.002, at: t }); aTone(d, f * 2.76, dur * 0.4, { type: 'sine', vol: v * 0.3, attack: 0.002, at: t }); break;
      case 'saw': aTone(d, f, dur, { type: 'sawtooth', vol: v, attack: 0.005, lp: 1500, at: t }); break;
      case 'kick': aTone(d, 140, 0.18, { type: 'sine', vol: v, slide: -95, slideT: 0.12, at: t }); break;
      case 'snare': aNoise(d, 0.13, { freq: 1800, q: 0.7, vol: v, at: t }); aTone(d, 190, 0.08, { type: 'triangle', vol: v * 0.5, at: t }); break;
      case 'hat': aNoise(d, 0.03, { freq: 7500, f: 'highpass', vol: v, at: t }); break;
      case 'drum': aTone(d, 170, 0.16, { type: 'sine', vol: v, slide: -80, at: t }); aNoise(d, 0.05, { freq: 800, vol: v * 0.4, at: t }); break;
      case 'tek': aNoise(d, 0.04, { freq: 3200, q: 2, vol: v, at: t }); break;
    }
  },
};

// ---------- ambience ----------
const Amb = {
  loops: {}, chirpT: 0, eventT: 1,
  init() {
    const ac = AU.ctx; if (!ac) return;
    const mk = (name, type, freq, q, lfoHz, lfoAmt) => {
      const src = ac.createBufferSource(); src.buffer = AU.longNoise; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const mod = ac.createGain(); mod.gain.value = 1;
      const g = ac.createGain(); g.gain.value = 0.0001;
      src.connect(f); f.connect(mod); mod.connect(g); g.connect(AU.amb); src.start();
      if (lfoHz) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = lfoHz; lg.gain.value = lfoAmt; l.connect(lg); lg.connect(mod.gain); l.start(); }
      this.loops[name] = g;
    };
    mk('wind', 'bandpass', 420, 0.7, 0.11, 0.6); mk('rain', 'highpass', 1400, 0.4); mk('sea', 'lowpass', 520, 0.6, 0.09, 0.8);
    mk('water', 'bandpass', 1500, 1.4, 0.7, 0.3); mk('cave', 'lowpass', 120, 0.8, 0.05, 0.4); mk('sand', 'bandpass', 950, 0.5, 0.2, 0.5); mk('fire', 'bandpass', 700, 2.5, 3.1, 0.6);
  },
  // targets: { wind, rain, sea, water, cave, sand, fire } (0..1)
  set(targets) {
    const ac = AU.ctx; if (!ac) return; const t = ac.currentTime;
    for (const k in this.loops) this.loops[k].gain.setTargetAtTime(Math.max(0.0001, (targets[k] || 0) * 0.5), t, 0.8);
  },
  // random one-shot nature sounds; env from the game each frame
  tick(dt, env) {
    if (!AU.ctx || SET.sfx <= 0) return;
    this.eventT -= dt; if (this.eventT > 0) return; this.eventT = rand(0.4, 1.4);
    const d = AU.amb, pan = rand(-0.8, 0.8);
    if (env.dungeon) { if (chance(0.5)) { const f = rand(900, 1600); aTone(d, f, 0.18, { type: 'sine', vol: 0.05, slide: -f * 0.5, pan, verb: 0.7 }); } if (chance(0.04)) aNoise(d, 1.5, { freq: 90, f: 'lowpass', vol: 0.12, attack: 0.3, verb: 0.5 }); return; }
    if (!env.outdoors) return;
    if (env.night) {
      if (env.biome !== 'frost' && chance(0.7)) for (let i = 0; i < 3; i++) aTone(d, rand(4200, 4800), 0.05, { type: 'sine', vol: 0.025, delay: i * 0.07, pan });
      if (env.biome === 'vale' && chance(0.03)) VOICE.howl(d, 0.5, 1, { pan, verb: 0.6 });
      if (chance(0.05)) { aTone(d, 420, 0.25, { type: 'sine', vol: 0.04, pan }); aTone(d, 380, 0.4, { type: 'sine', vol: 0.04, delay: 0.32, pan }); } // owl
    } else {
      if ((env.biome === 'vale' || env.biome === 'coast') && !env.rain && chance(0.6)) { const b = rand(2400, 3600); const n = randi(2, 4); for (let i = 0; i < n; i++) aTone(d, b + rand(-200, 400), 0.07, { type: 'sine', vol: 0.03, slide: rand(-600, 900), delay: i * 0.1, pan }); }
      if (env.biome === 'coast' && chance(0.12)) aTone(d, 1500, 0.3, { type: 'sawtooth', vol: 0.02, slide: -500, lp: 2500, pan }); // gull
    }
    if (env.biome === 'swamp' && chance(0.45)) VOICE.croak(d, 0.5, rand(0.8, 1.3), { pan });
    if (env.storm && chance(0.025)) { Sfx.play('thunder'); if (typeof Weather !== 'undefined') Weather.flash = 1; }
  },
};
