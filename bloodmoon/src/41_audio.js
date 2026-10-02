
// =====================================================================
// AUDIO — every sound and every note is synthesized live (no files).
// Sfx: one-shot effects placed in 3D around the listener. Music: songs
// per mood. Amb: wind, rain, river, fire, birds, crickets, frogs, town.
// =====================================================================
const AU = {
  ctx: null, master: null, sfx: null, amb: null, music: null, verbIn: null, noise: null, longNoise: null,
  init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ac = (this.ctx = new AC());
      this.master = ac.createGain(); this.master.connect(ac.destination);
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.connect(this.master);
      this.sfx = ac.createGain(); this.amb = ac.createGain(); this.music = ac.createGain();
      for (const b of [this.sfx, this.amb, this.music]) b.connect(comp);
      const len = Math.floor(ac.sampleRate * 2.8), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      const conv = ac.createConvolver(); conv.buffer = ir; this.verbIn = ac.createGain(); this.verbIn.gain.value = 0.55; this.verbIn.connect(conv); conv.connect(comp);
      const mk = (sec) => { const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; };
      this.noise = mk(0.6); this.longNoise = mk(3);
      this.vols(); Amb.init();
    } catch (e) { this.ctx = null; }
  },
  unlock() { if (!this.ctx) this.init(); else if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
  vols() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime((SET.sfx / 100) * 0.7, t, 0.05); this.amb.gain.setTargetAtTime((SET.sfx / 100) * 0.55, t, 0.05); this.music.gain.setTargetAtTime((SET.music / 100) * 0.42, t, 0.05);
  },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function auRoute(node, dest, o) {
  const ac = AU.ctx;
  if (o.lp2) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp2; node.connect(f); node = f; }
  if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); node.connect(p); node = p; }
  node.connect(dest);
  if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; node.connect(s); s.connect(AU.verbIn); }
}
function aTone(dest, f, dur, o = {}) {
  const ac = AU.ctx; if (!ac) return; const t = o.at != null ? o.at : ac.currentTime + (o.delay || 0);
  const os = ac.createOscillator(); os.type = o.type || 'square'; os.frequency.setValueAtTime(Math.max(10, f), t);
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
function aNoise(dest, dur, o = {}) {
  const ac = AU.ctx; if (!ac || !AU.noise) return; const t = o.at != null ? o.at : ac.currentTime + (o.delay || 0);
  const s = ac.createBufferSource(); s.buffer = dur > 0.5 ? AU.longNoise : AU.noise; s.playbackRate.value = o.rate || 1;
  const f = ac.createBiquadFilter(); f.type = o.f || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1200, t); f.Q.value = o.q || 1;
  if (o.fslide) f.frequency.exponentialRampToValueAtTime(Math.max(30, (o.freq || 1200) + o.fslide), t + dur);
  const g = ac.createGain(), v = o.vol == null ? 0.2 : o.vol;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.attack || 0.003));
  if (o.hold) g.gain.setValueAtTime(v, t + Math.max(0.01, dur - (o.release || 0.2)));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); auRoute(g, dest, o); s.start(t, Math.random() * 0.2); s.stop(t + dur + 0.05);
}
const A = (o, extra) => Object.assign({}, o, extra);
// ---------- sound effects: (dest, loudness, options) ----------
const SFX = {
  swing: (d, m, o) => aNoise(d, 0.14, A(o, { freq: 2600, fslide: -1700, q: 1.4, vol: 0.22 * m })),
  swing_heavy: (d, m, o) => { aNoise(d, 0.24, A(o, { freq: 1300, fslide: -900, q: 1.2, vol: 0.3 * m })); aTone(d, 90, 0.2, A(o, { type: 'sine', vol: 0.08 * m, slide: -30 })); },
  hit_flesh: (d, m, o) => { aNoise(d, 0.12, A(o, { freq: 520, q: 0.9, vol: 0.42 * m })); aTone(d, 120, 0.1, A(o, { type: 'sine', vol: 0.18 * m, slide: -60 })); aNoise(d, 0.18, A(o, { freq: 1400, q: 3, vol: 0.12 * m, delay: 0.03 })); },
  gore: (d, m, o) => { aNoise(d, 0.25, A(o, { freq: 380, q: 1.2, vol: 0.4 * m })); for (let i = 0; i < 3; i++) aNoise(d, 0.08, A(o, { freq: 900 + i * 300, q: 4, vol: 0.14 * m, delay: 0.05 + i * 0.05 })); },
  bone: (d, m, o) => { aNoise(d, 0.05, A(o, { freq: 2600, q: 5, vol: 0.4 * m })); aNoise(d, 0.06, A(o, { freq: 1800, q: 6, vol: 0.3 * m, delay: 0.04 })); aTone(d, 220, 0.06, A(o, { type: 'triangle', vol: 0.12 * m })); },
  dismember: (d, m, o) => { SFX.gore(d, m * 1.2, o); SFX.bone(d, m, o); aNoise(d, 0.6, A(o, { freq: 700, f: 'lowpass', vol: 0.18 * m, delay: 0.1 })); },
  clang: (d, m, o) => { aTone(d, 1250, 0.4, A(o, { type: 'triangle', vol: 0.12 * m })); aTone(d, 1870, 0.3, A(o, { type: 'sine', vol: 0.08 * m })); aNoise(d, 0.06, A(o, { freq: 4000, vol: 0.25 * m })); },
  block: (d, m, o) => { aTone(d, 150, 0.1, A(o, { vol: 0.16 * m })); aNoise(d, 0.09, A(o, { freq: 1600, vol: 0.32 * m })); aTone(d, 900, 0.18, A(o, { type: 'triangle', vol: 0.06 * m })); },
  parry: (d, m, o) => { SFX.clang(d, m * 1.4, o); aTone(d, 2400, 0.6, A(o, { type: 'sine', vol: 0.08 * m, verb: 0.5 })); },
  crit: (d, m, o) => { SFX.hit_flesh(d, m * 1.2, o); aTone(d, 300, 0.15, A(o, { vol: 0.1 * m, slide: 300 })); },
  bow_draw: (d, m, o) => { for (let i = 0; i < 4; i++) aNoise(d, 0.08, A(o, { freq: 300 + i * 120, q: 6, vol: 0.06 * m, delay: i * 0.12 })); },
  bow_release: (d, m, o) => { aTone(d, 180, 0.12, A(o, { type: 'triangle', vol: 0.2 * m, slide: -80 })); aNoise(d, 0.25, A(o, { freq: 3200, fslide: -2400, vol: 0.12 * m })); },
  arrow_hit: (d, m, o) => { aNoise(d, 0.06, A(o, { freq: 900, q: 1.4, vol: 0.32 * m })); aTone(d, 160, 0.08, A(o, { type: 'triangle', vol: 0.12 * m })); },
  arrow_wood: (d, m, o) => { aTone(d, 420, 0.12, A(o, { type: 'triangle', vol: 0.12 * m, slide: -150 })); aNoise(d, 0.05, A(o, { freq: 2000, vol: 0.12 * m })); },
  fire_cast: (d, m, o) => { aNoise(d, 0.5, A(o, { freq: 600, fslide: 1600, q: 0.8, vol: 0.3 * m })); aTone(d, 110, 0.4, A(o, { type: 'sawtooth', vol: 0.08 * m, slide: 120, lp: 800 })); },
  boom: (d, m, o) => { aNoise(d, 0.9, A(o, { freq: 200, f: 'lowpass', vol: 0.7 * m, verb: 0.3 })); aTone(d, 55, 0.6, A(o, { type: 'sine', vol: 0.35 * m, slide: -25 })); aNoise(d, 0.6, A(o, { freq: 1200, q: 0.6, vol: 0.18 * m, delay: 0.05 })); },
  lightning: (d, m, o) => { for (let i = 0; i < 7; i++) aNoise(d, 0.05, A(o, { freq: 2500 + Math.random() * 4000, q: 3, vol: 0.28 * m, delay: i * 0.025 })); aTone(d, 1800, 0.25, A(o, { type: 'sawtooth', vol: 0.08 * m, slide: -1500 })); aNoise(d, 0.8, A(o, { freq: 160, f: 'lowpass', vol: 0.3 * m, delay: 0.08 })); },
  ice_cast: (d, m, o) => { aNoise(d, 0.45, A(o, { freq: 6500, f: 'highpass', vol: 0.18 * m })); aTone(d, 2200, 0.4, A(o, { type: 'sine', vol: 0.07 * m, slide: -1200 })); },
  ice_shatter: (d, m, o) => { for (let i = 0; i < 6; i++) aTone(d, 2500 + Math.random() * 2500, 0.12, A(o, { type: 'sine', vol: 0.06 * m, delay: i * 0.03 })); aNoise(d, 0.2, A(o, { freq: 5000, f: 'highpass', vol: 0.2 * m })); },
  hurt: (d, m, o) => { aNoise(d, 0.12, A(o, { freq: 500, vol: 0.3 * m })); aTone(d, 90, 0.18, A(o, { type: 'sine', vol: 0.2 * m, slide: -40 })); },
  heartbeat: (d, m, o) => { aTone(d, 60, 0.12, A(o, { type: 'sine', vol: 0.3 * m })); aTone(d, 55, 0.12, A(o, { type: 'sine', vol: 0.22 * m, delay: 0.22 })); },
  death: (d, m, o) => { aTone(d, 110, 1.6, A(o, { type: 'sawtooth', vol: 0.12 * m, slide: -60, lp: 700, verb: 0.6 })); aNoise(d, 1.6, A(o, { freq: 200, f: 'lowpass', vol: 0.2 * m })); },
  dodge: (d, m, o) => aNoise(d, 0.2, A(o, { freq: 1800, fslide: -1200, vol: 0.18 * m })),
  jump: (d, m, o) => aNoise(d, 0.1, A(o, { freq: 600, f: 'lowpass', vol: 0.12 * m })),
  land: (d, m, o) => { aNoise(d, 0.12, A(o, { freq: 300, f: 'lowpass', vol: 0.25 * m })); aTone(d, 70, 0.1, A(o, { type: 'sine', vol: 0.12 * m })); },
  splash: (d, m, o) => { aNoise(d, 0.4, A(o, { freq: 1400, fslide: -900, q: 0.7, vol: 0.3 * m })); aNoise(d, 0.25, A(o, { freq: 3200, q: 1, vol: 0.1 * m, delay: 0.08 })); },
  swim: (d, m, o) => aNoise(d, 0.35, A(o, { freq: 900, fslide: -400, q: 0.6, vol: 0.12 * m })),
  whistle: (d, m, o) => { aTone(d, 2200, 0.25, A(o, { type: 'sine', vol: 0.1 * m, slide: 500, slideT: 0.18 })); aTone(d, 2600, 0.45, A(o, { type: 'sine', vol: 0.1 * m, slide: -700, delay: 0.3, verb: 0.3 })); },
  neigh: (d, m, o) => { aTone(d, 700, 0.9, A(o, { type: 'sawtooth', vol: 0.06 * m, slide: -350, vib: [18, 60], lp: 2400 })); aNoise(d, 0.6, A(o, { freq: 1200, q: 2, vol: 0.06 * m, delay: 0.1 })); },
  snort: (d, m, o) => aNoise(d, 0.3, A(o, { freq: 500, q: 0.8, vol: 0.14 * m })),
  eat: (d, m, o) => { for (let i = 0; i < 3; i++) aNoise(d, 0.07, A(o, { freq: 900 + i * 200, q: 2, vol: 0.12 * m, delay: i * 0.16 })); },
  drink: (d, m, o) => { for (let i = 0; i < 4; i++) aTone(d, 280 + i * 70, 0.08, A(o, { type: 'sine', vol: 0.12 * m, slide: 180, delay: i * 0.1 })); },
  coin: (d, m, o) => { aTone(d, 1760, 0.07, A(o, { type: 'triangle', vol: 0.06 * m })); aTone(d, 2350, 0.12, A(o, { type: 'triangle', vol: 0.05 * m, delay: 0.05 })); },
  pickup: (d, m, o) => { aNoise(d, 0.08, A(o, { freq: 1500, vol: 0.1 * m })); aTone(d, 520, 0.08, A(o, { type: 'triangle', vol: 0.06 * m, delay: 0.04 })); },
  herb: (d, m, o) => { aNoise(d, 0.15, A(o, { freq: 2500, f: 'highpass', vol: 0.1 * m })); aTone(d, 880, 0.1, A(o, { type: 'sine', vol: 0.05 * m, delay: 0.08 })); },
  craft: (d, m, o) => { for (let i = 0; i < 3; i++) aTone(d, 400 + i * 160, 0.1, A(o, { type: 'sine', vol: 0.08 * m, delay: i * 0.12 })); aNoise(d, 0.3, A(o, { freq: 1200, q: 3, vol: 0.06 * m })); },
  hammer: (d, m, o) => { aTone(d, 1650, 0.3, A(o, { type: 'triangle', vol: 0.09 * m })); aNoise(d, 0.05, A(o, { freq: 3500, vol: 0.16 * m })); },
  page: (d, m, o) => { aNoise(d, 0.12, A(o, { freq: 4000, f: 'highpass', vol: 0.1 * m })); aNoise(d, 0.1, A(o, { freq: 3000, f: 'highpass', vol: 0.08 * m, delay: 0.13 })); },
  door: (d, m, o) => { aTone(d, 140, 0.5, A(o, { type: 'sawtooth', vol: 0.05 * m, slide: 60, vib: [12, 20], lp: 900 })); aNoise(d, 0.12, A(o, { freq: 300, f: 'lowpass', vol: 0.25 * m, delay: 0.45 })); },
  level: (d, m, o) => [262, 330, 392, 523].forEach((f, i) => aTone(d, f, 0.9, A(o, { type: 'triangle', vol: 0.07 * m, delay: i * 0.12, verb: 0.5 }))),
  quest: (d, m, o) => [220, 277, 330, 440].forEach((f, i) => aTone(d, f, 0.5, A(o, { type: 'sawtooth', vol: 0.05 * m, delay: i * 0.1, lp: 1500, verb: 0.4 }))),
  trophy: (d, m, o) => { SFX.hammer(d, m, o); [330, 440, 554].forEach((f, i) => aTone(d, f, 0.6, A(o, { type: 'triangle', vol: 0.06 * m, delay: 0.2 + i * 0.1, verb: 0.4 }))); },
  sense: (d, m, o) => { aNoise(d, 1.2, A(o, { freq: 300, fslide: 2400, q: 1.5, vol: 0.18 * m, verb: 0.6 })); aTone(d, 55, 1.2, A(o, { type: 'sine', vol: 0.15 * m })); },
  mutate: (d, m, o) => { aTone(d, 80, 1.4, A(o, { type: 'sawtooth', vol: 0.1 * m, slide: 40, vib: [7, 15], lp: 600, verb: 0.5 })); SFX.heartbeat(d, m, A(o, { delay: 0.3 })); },
  finisher: (d, m, o) => { aTone(d, 60, 0.8, A(o, { type: 'sine', vol: 0.3 * m, slide: -20 })); aNoise(d, 0.6, A(o, { freq: 300, f: 'lowpass', vol: 0.25 * m })); },
  bloodmoon: (d, m, o) => { aTone(d, 73, 4, A(o, { type: 'sawtooth', vol: 0.12 * m, lp: 500, attack: 1, verb: 0.8 })); aTone(d, 77.8, 4, A(o, { type: 'sawtooth', vol: 0.1 * m, lp: 500, attack: 1.2 })); aTone(d, 146, 3, A(o, { type: 'triangle', vol: 0.06 * m, attack: 1.5, verb: 0.8 })); },
  rooster: (d, m, o) => { aTone(d, 700, 0.18, A(o, { type: 'sawtooth', vol: 0.03 * m, slide: 300, lp: 2500 })); aTone(d, 1000, 0.5, A(o, { type: 'sawtooth', vol: 0.03 * m, slide: -400, lp: 2500, delay: 0.2 })); },
  bell: (d, m, o) => { aTone(d, 392, 3, A(o, { type: 'sine', vol: 0.1 * m, verb: 0.8 })); aTone(d, 1080, 1.6, A(o, { type: 'sine', vol: 0.04 * m })); },
  thunder: (d, m, o) => { aNoise(d, 3, A(o, { freq: 110, f: 'lowpass', vol: 0.8 * m, attack: 0.05, verb: 0.7 })); aNoise(d, 0.4, A(o, { freq: 700, vol: 0.25 * m })); },
  fire_crackle: (d, m, o) => { for (let i = 0; i < 4; i++) aNoise(d, 0.03, A(o, { freq: 2000 + Math.random() * 2000, q: 4, vol: 0.1 * m, delay: Math.random() * 0.4 })); },
  click: (d, m, o) => aTone(d, 760, 0.03, A(o, { type: 'triangle', vol: 0.05 * m })),
  error: (d, m, o) => aTone(d, 130, 0.18, A(o, { type: 'sawtooth', vol: 0.06 * m, lp: 800 })),
  blip: (d, m, o) => aTone(d, 330 * (o.pitch || 1), 0.04, A(o, { type: 'triangle', vol: 0.05 * m })),
};
// footsteps per surface, for feet and hooves
const STEP = {
  grass: (d, m, o) => aNoise(d, 0.09, A(o, { freq: 700, f: 'lowpass', vol: 0.14 * m })),
  forest: (d, m, o) => { aNoise(d, 0.1, A(o, { freq: 900, f: 'lowpass', vol: 0.13 * m })); if (chance(0.3)) aNoise(d, 0.03, A(o, { freq: 3000, q: 4, vol: 0.08 * m, delay: 0.03 })); },
  dirt: (d, m, o) => aNoise(d, 0.08, A(o, { freq: 1100, q: 0.8, vol: 0.13 * m })),
  stone: (d, m, o) => { aNoise(d, 0.04, A(o, { freq: 2600, q: 2, vol: 0.1 * m })); aTone(d, 240, 0.03, A(o, { type: 'triangle', vol: 0.05 * m })); },
  wood: (d, m, o) => { aTone(d, 140, 0.08, A(o, { type: 'triangle', vol: 0.12 * m, slide: -40 })); aNoise(d, 0.05, A(o, { freq: 500, f: 'lowpass', vol: 0.08 * m })); },
  water: (d, m, o) => aNoise(d, 0.2, A(o, { freq: 1500, fslide: -800, q: 0.7, vol: 0.16 * m })),
  snow: (d, m, o) => { aNoise(d, 0.07, A(o, { freq: 1700, q: 1.5, vol: 0.12 * m })); aNoise(d, 0.06, A(o, { freq: 1200, q: 1.5, vol: 0.09 * m, delay: 0.05 })); },
  mud: (d, m, o) => { aNoise(d, 0.14, A(o, { freq: 380, f: 'lowpass', vol: 0.16 * m })); aTone(d, 85, 0.1, A(o, { type: 'sine', vol: 0.07 * m, slide: 40 })); },
  sand: (d, m, o) => aNoise(d, 0.1, A(o, { freq: 2600, f: 'highpass', vol: 0.07 * m })),
  rock: (d, m, o) => STEP.stone(d, m, o),
};
const SURF_STEP = ['grass', 'forest', 'dirt', 'rock', 'snow', 'sand', 'mud', 'dirt', 'stone', 'sand'];
// creature voices (no human voices anywhere in the game)
const VOICE = {
  growl: (d, m, p, o) => { aTone(d, 80 * p, 0.7, A(o, { type: 'sawtooth', vol: 0.16 * m, slide: -15, vib: [26, 14], lp: 650 })); aNoise(d, 0.6, A(o, { freq: 260 * p, f: 'lowpass', vol: 0.14 * m })); },
  howl: (d, m, p, o) => aTone(d, 380 * p, 2.4, A(o, { type: 'sine', vol: 0.1 * m, slide: 300, slideT: 0.8, vib: [5, 9], attack: 0.3, hold: 1, release: 1, verb: 0.8 })),
  roar: (d, m, p, o) => { aNoise(d, 1, A(o, { freq: 300 * p, q: 0.7, vol: 0.5 * m, attack: 0.06 })); aTone(d, 62 * p, 1, A(o, { type: 'sawtooth', vol: 0.2 * m, slide: -20, lp: 450, verb: 0.4 })); },
  screech: (d, m, p, o) => { aTone(d, 1250 * p, 0.45, A(o, { type: 'sawtooth', vol: 0.07 * m, slide: 800, lp: 3800 })); aNoise(d, 0.35, A(o, { freq: 3000 * p, q: 2, vol: 0.12 * m })); },
  hiss: (d, m, p, o) => aNoise(d, 0.6, A(o, { freq: 4200 * p, f: 'highpass', vol: 0.16 * m, attack: 0.06 })),
  gurgle: (d, m, p, o) => { for (let i = 0; i < 5; i++) aTone(d, (160 + Math.random() * 120) * p, 0.08, A(o, { type: 'sine', vol: 0.12 * m, slide: 80, delay: i * 0.07 })); aNoise(d, 0.4, A(o, { freq: 500, f: 'lowpass', vol: 0.12 * m })); },
  snarl: (d, m, p, o) => { aTone(d, 140 * p, 0.35, A(o, { type: 'sawtooth', vol: 0.12 * m, vib: [30, 20], lp: 1200 })); aNoise(d, 0.3, A(o, { freq: 800 * p, q: 1, vol: 0.12 * m })); },
  bleat: (d, m, p, o) => aTone(d, 520 * p, 0.35, A(o, { type: 'sawtooth', vol: 0.04 * m, vib: [14, 30], lp: 2200 })),
  caw: (d, m, p, o) => { for (let i = 0; i < 2; i++) aTone(d, 900 * p, 0.18, A(o, { type: 'sawtooth', vol: 0.05 * m, slide: -350, lp: 2600, delay: i * 0.26 })); },
  demon: (d, m, p, o) => { SFX.bloodmoon(d, m * 0.6, o); VOICE.roar(d, m, 0.6 * p, o); },
  squeal: (d, m, p, o) => aTone(d, 900 * p, 0.25, A(o, { type: 'sawtooth', vol: 0.05 * m, slide: 400, lp: 3000 })),
};
// ---------- playing sounds in 3D ----------
const _ap = new THREE.Vector3(), _ar = new THREE.Vector3();
function spatial(o) {
  const out = {}; let m = 1;
  if (o && o.x != null && camera) {
    const dx = o.x - camera.position.x, dy = (o.y || 0) - camera.position.y, dz = o.z - camera.position.z, d = Math.hypot(dx, dy, dz), range = o.range || 60;
    m = clamp(1 - d / range, 0, 1); if (m < 0.02) return null; m = m * m;
    _ar.set(1, 0, 0).applyQuaternion(camera.quaternion); out.pan = d > 0.5 ? clamp((dx * _ar.x + dz * _ar.z) / d, -1, 1) * 0.85 : 0;
    if (d > range * 0.4) out.lp2 = 2400;
  }
  if (o && o.vol) m *= o.vol; if (o && o.pitch) out.pitch = o.pitch;
  if (G.area !== 'outside') out.verb = 0.35;
  return [m, out];
}
const Sfx = {
  last: {},
  play(name, o) {
    if (!AU.ctx || SET.sfx <= 0) return; const now = performance.now(); if (this.last[name] && now - this.last[name] < 30) return; this.last[name] = now;
    const s = spatial(o); if (!s) return; const f = SFX[name]; if (f) f(AU.sfx, s[0], s[1]);
  },
  step(surf, o) { if (!AU.ctx || SET.sfx <= 0) return; const s = spatial(o); if (!s) return; (STEP[surf] || STEP.dirt)(AU.sfx, s[0], s[1]); },
  voice(kind, pitch = 1, o) { if (!AU.ctx || SET.sfx <= 0 || !VOICE[kind]) return; const s = spatial(Object.assign({ range: 90 }, o)); if (!s) return; VOICE[kind](AU.sfx, s[0], pitch, s[1]); },
  blip(pitch = 1) { if (!AU.ctx || SET.sfx <= 0) return; SFX.blip(AU.sfx, 1, { pitch }); },
};
// ---------- music: a mood = tempo, scale, chords and parts ----------
const MOODS = {
  title: { bpm: 60, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], parts: [{ i: 'choir', chord: 1, v: 0.05 }, { i: 'bass', pat: 'x...............', oct: -1, len: 16, v: 0.12 }, { i: 'bell', rnd: 0.07, oct: 1, v: 0.04 }, { i: 'drum', pat: 'x.......x.......', v: 0.12, every: 2 }] },
  town: { bpm: 84, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 4, 0], parts: [{ i: 'pad', chord: 1, v: 0.022 }, { i: 'pluck', pat: 'x.x.x.x.x.x.x.x.', arp: [0, 1, 2, 1, 3, 1, 2, 1], oct: 0, len: 3, v: 0.055 }, { i: 'bass', pat: 'x.......x.......', oct: -1, len: 7, v: 0.12 }, { i: 'flute', mel: 0.3, oct: 1, v: 0.03 }] },
  wild: { bpm: 58, root: 47, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 5, 1], parts: [{ i: 'drone', chord: 1, v: 0.045, wob: 1 }, { i: 'bell', rnd: 0.06, oct: 1, v: 0.035, dis: 1 }, { i: 'pluck', pat: 'x.......x.......', arp: [0, 2], oct: -1, len: 8, v: 0.04, every: 2 }] },
  night: { bpm: 52, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 0, 6], parts: [{ i: 'drone', chord: 1, v: 0.05 }, { i: 'choir', chord: 1, v: 0.02 }, { i: 'bell', rnd: 0.05, oct: 1, v: 0.03, dis: 1 }] },
  fight: { bpm: 132, root: 45, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 6, 4], parts: [{ i: 'bass', pat: 'x.x.xx.xx.x.xx.x', oct: -1, len: 1, v: 0.13 }, { i: 'brass', pat: 'x.......x.....x.', v: 0.05 }, { i: 'tom', pat: 'x..x..x.x..x..x.', v: 0.22 }, { i: 'kick', pat: 'x...x...x...x...', v: 0.26 }, { i: 'snare', pat: '....x.......x..x', v: 0.11 }, { i: 'strings', mel: 0.5, oct: 1, v: 0.035, fast: 1 }] },
  blood: { bpm: 146, root: 44, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 1, 0, 6], parts: [{ i: 'choir', chord: 1, v: 0.06 }, { i: 'bass', pat: 'xxxxxxxxxxxxxxxx', oct: -1, len: 1, v: 0.11 }, { i: 'tom', pat: 'x.xx.xx.x.xx.x.x', v: 0.24 }, { i: 'kick', pat: 'x..x..x...x..x..', v: 0.3 }, { i: 'brass', pat: 'x...............', v: 0.06 }, { i: 'bell', rnd: 0.14, oct: 1, v: 0.04, dis: 1 }] },
  castle: { bpm: 70, root: 43, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 3, 4], parts: [{ i: 'organ', chord: 1, v: 0.04 }, { i: 'bass', pat: 'x.......x.......', oct: -1, len: 8, v: 0.12 }, { i: 'choir', chord: 1, v: 0.025 }, { i: 'bell', rnd: 0.05, oct: 1, v: 0.03 }] },
  shrine: { bpm: 50, root: 38, scale: [0, 1, 3, 4, 6, 8, 10], prog: [0, 1, 0, 1], parts: [{ i: 'drone', chord: 1, v: 0.06, wob: 1 }, { i: 'choir', chord: 1, v: 0.04 }, { i: 'tom', pat: 'x...............', v: 0.25 }, { i: 'bell', rnd: 0.08, oct: 0, v: 0.04, dis: 1 }] },
  sad: { bpm: 56, root: 50, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], parts: [{ i: 'pad', chord: 1, v: 0.035 }, { i: 'pluck', pat: 'x...x...x...x...', arp: [0, 1, 2, 1], oct: 0, len: 6, v: 0.05 }, { i: 'flute', mel: 0.2, oct: 1, v: 0.025 }] },
  victory: { bpm: 80, root: 50, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], parts: [{ i: 'choir', chord: 1, v: 0.045 }, { i: 'brass', pat: 'x.......x.......', v: 0.05 }, { i: 'pluck', pat: 'x.x.x.x.x.x.x.x.', arp: [0, 1, 2, 3], oct: 0, len: 3, v: 0.045 }, { i: 'tom', pat: 'x.......x.......', v: 0.15 }] },
  dark: { bpm: 48, root: 40, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 6, 5, 1], parts: [{ i: 'organ', chord: 1, v: 0.045 }, { i: 'drone', chord: 1, v: 0.04 }, { i: 'bell', rnd: 0.06, oct: 0, v: 0.04, dis: 1 }] },
};
const Music = {
  mood: null, playing: null, gain: null, next: 0, step: 0, bar: 0, mel: 7,
  set(mood) { this.mood = mood; },
  sting(kind) { if (!AU.ctx) return; if (kind === 'blood') SFX.bloodmoon(AU.music, 1.4, {}); },
  degToMidi(M, deg, oct) { const n = M.scale.length, o = Math.floor(deg / n); return M.root + (oct + o) * 12 + M.scale[((deg % n) + n) % n]; },
  tick() {
    const ac = AU.ctx; if (!ac) return;
    if (this.playing !== this.mood) {
      const t = ac.currentTime;
      if (this.gain) { const old = this.gain; old.gain.setTargetAtTime(0.0001, t, 0.9); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 6000); }
      this.playing = this.mood; this.gain = null; if (!this.mood) return;
      this.gain = ac.createGain(); this.gain.gain.setValueAtTime(0.0001, t); this.gain.gain.setTargetAtTime(1, t + 0.3, 1.2); this.gain.connect(AU.music);
      const sv = ac.createGain(); sv.gain.value = 0.3; this.gain.connect(sv); sv.connect(AU.verbIn);
      this.step = 0; this.bar = 0; this.next = t + 0.2;
    }
    const M = MOODS[this.playing]; if (!M || !this.gain) return;
    const sd = 60 / M.bpm / 4, steps = 16;
    if (this.next < ac.currentTime - 0.2) this.next = ac.currentTime + 0.05;
    while (this.next < ac.currentTime + 0.3) { this.playStep(M, this.next, sd, steps); this.next += sd; if (++this.step >= steps) { this.step = 0; this.bar++; } }
  },
  playStep(M, t, sd, steps) {
    const d = this.gain, s = this.step, cd = M.prog[this.bar % M.prog.length], chord = [cd, cd + 2, cd + 4, cd + 6];
    for (const p of M.parts) {
      if (p.every && this.bar % p.every) continue; const on = p.pat ? p.pat[s] : null;
      switch (p.i) {
        case 'pad': case 'drone': case 'choir': case 'organ':
          if (s === 0) { const notes = p.i === 'drone' ? [this.degToMidi(M, cd, -1), this.degToMidi(M, cd + 4, -1)] : chord.slice(0, 3).map((g) => this.degToMidi(M, g, 0)); for (const n of notes) this.inst(p.i, d, n, t, sd * steps, p.v, p); }
          break;
        case 'bass': if (on === 'x') this.inst('bass', d, this.degToMidi(M, cd, p.oct || -1), t, sd * (p.len || 2), p.v); break;
        case 'pluck': if (on === 'x') { const k = p.arp[(s / 2 | 0) % p.arp.length]; this.inst('pluck', d, this.degToMidi(M, chord[k], p.oct || 0), t, sd * (p.len || 3), p.v); } break;
        case 'brass': if (on === 'x') for (const g of chord.slice(0, 2)) this.inst('brass', d, this.degToMidi(M, g, -1), t, sd * 6, p.v); break;
        case 'bell': if (s % 2 === 0 && Math.random() < p.rnd) { const deg = p.dis && Math.random() < 0.4 ? cd + pick([1, 3, 5]) : pick(chord.slice(0, 3)); this.inst('bell', d, this.degToMidi(M, deg, p.oct || 1), t, 2.4, p.v); } break;
        case 'flute': case 'strings': {
          const grid = p.fast ? 1 : 2; if (s % grid) break;
          if (Math.random() < p.mel) { if (s % 4 === 0) { const target = pick(chord.slice(0, 3)) + 7; this.mel += clamp(target - this.mel, -2, 2); } else this.mel += pick([-1, -1, 1, 1, 2, -2, 0]); this.mel = clamp(this.mel, 3, 13); this.inst(p.i, d, this.degToMidi(M, this.mel, (p.oct || 1) - 1), t, sd * grid * pick([1, 2, 2, 3]), p.v); }
          break;
        }
        default: if (on === 'x') this.inst(p.i, d, 0, t, sd, p.v);
      }
    }
  },
  inst(kind, d, midi, t, dur, v, p = {}) {
    const f = midi ? mtof(midi) : 0;
    switch (kind) {
      case 'pad': aTone(d, f, dur + 0.6, { type: 'sawtooth', vol: v, attack: 0.8, hold: 1, release: 0.8, lp: 800, at: t, detune: -7 }); aTone(d, f, dur + 0.6, { type: 'sawtooth', vol: v * 0.8, attack: 0.8, hold: 1, release: 0.8, lp: 800, at: t, detune: 8 }); break;
      case 'drone': aTone(d, f, dur + 1, { type: 'sawtooth', vol: v, attack: 1.5, hold: 1, release: 1, lp: 380, at: t, vib: p.wob ? [0.5, 3] : null }); break;
      case 'choir': aTone(d, f, dur + 0.6, { type: 'triangle', vol: v, attack: 0.7, hold: 1, release: 0.7, vib: [5, 3], at: t }); aTone(d, f * 2, dur + 0.6, { type: 'sine', vol: v * 0.5, attack: 0.8, hold: 1, vib: [5.5, 4], at: t }); break;
      case 'organ': aTone(d, f, dur + 0.4, { type: 'square', vol: v * 0.6, attack: 0.2, hold: 1, release: 0.4, lp: 1400, at: t }); aTone(d, f * 2, dur + 0.4, { type: 'sine', vol: v * 0.6, attack: 0.2, hold: 1, at: t }); aTone(d, f / 2, dur + 0.4, { type: 'sine', vol: v * 0.8, attack: 0.3, hold: 1, at: t }); break;
      case 'bass': aTone(d, f, dur, { type: 'triangle', vol: v, attack: 0.01, at: t }); aTone(d, f, dur * 0.6, { type: 'sawtooth', vol: v * 0.25, lp: 400, at: t }); break;
      case 'pluck': aTone(d, f, dur + 0.3, { type: 'triangle', vol: v, attack: 0.003, at: t, lp: 2200 }); aTone(d, f * 2, dur * 0.5, { type: 'sine', vol: v * 0.3, at: t }); break;
      case 'flute': aTone(d, f, dur + 0.15, { type: 'sine', vol: v * 1.4, attack: 0.06, vib: [5, 5], hold: 1, release: 0.12, at: t }); break;
      case 'strings': aTone(d, f, dur + 0.1, { type: 'sawtooth', vol: v, attack: 0.04, lp: 1600, vib: [6, 5], hold: 1, release: 0.1, at: t }); aTone(d, f, dur + 0.1, { type: 'sawtooth', vol: v * 0.7, attack: 0.04, lp: 1600, detune: 9, at: t }); break;
      case 'brass': aTone(d, f, dur, { type: 'sawtooth', vol: v, attack: 0.08, lp: 900, q: 2, hold: 1, release: 0.3, at: t }); break;
      case 'bell': aTone(d, f, dur, { type: 'sine', vol: v, attack: 0.002, at: t }); aTone(d, f * 2.76, dur * 0.4, { type: 'sine', vol: v * 0.3, attack: 0.002, at: t }); break;
      case 'kick': aTone(d, 130, 0.22, { type: 'sine', vol: v, slide: -90, slideT: 0.14, at: t }); break;
      case 'tom': aTone(d, 95, 0.3, { type: 'sine', vol: v, slide: -40, at: t }); aNoise(d, 0.08, { freq: 400, vol: v * 0.3, at: t }); break;
      case 'snare': aNoise(d, 0.14, { freq: 1700, q: 0.7, vol: v, at: t }); break;
      case 'drum': aTone(d, 110, 0.4, { type: 'sine', vol: v, slide: -50, at: t }); break;
    }
  },
};
// ---------- ambience ----------
const Amb = {
  loops: {}, eventT: 1,
  init() {
    const ac = AU.ctx; if (!ac) return;
    const mk = (name, type, freq, q, lfoHz, lfoAmt) => {
      const src = ac.createBufferSource(); src.buffer = AU.longNoise; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const mod = ac.createGain(); mod.gain.value = 1; const g = ac.createGain(); g.gain.value = 0.0001;
      src.connect(f); f.connect(mod); mod.connect(g); g.connect(AU.amb); src.start();
      if (lfoHz) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = lfoHz; lg.gain.value = lfoAmt; l.connect(lg); lg.connect(mod.gain); l.start(); }
      this.loops[name] = g;
    };
    mk('wind', 'bandpass', 380, 0.6, 0.09, 0.7); mk('leaves', 'highpass', 2500, 0.4, 0.3, 0.6); mk('rain', 'highpass', 1300, 0.4); mk('river', 'bandpass', 1100, 0.9, 0.5, 0.25);
    mk('fire', 'bandpass', 700, 2.5, 3.1, 0.6); mk('cave', 'lowpass', 110, 0.8, 0.05, 0.4); mk('town', 'bandpass', 600, 0.5, 0.25, 0.5);
  },
  set(t0) { const ac = AU.ctx; if (!ac) return; const t = ac.currentTime; for (const k in this.loops) this.loops[k].gain.setTargetAtTime(Math.max(0.0001, (t0[k] || 0) * 0.5), t, 0.8); },
  tick(dt, env) {
    if (!AU.ctx || SET.sfx <= 0) return; this.eventT -= dt; if (this.eventT > 0) return; this.eventT = rand(0.4, 1.3);
    const d = AU.amb, pan = rand(-0.8, 0.8);
    if (env.inside) { if (env.area === 'shrine' && chance(0.3)) aNoise(d, 2, { freq: 70, f: 'lowpass', vol: 0.2, attack: 0.5, verb: 0.6 }); if (env.area === 'castle' && chance(0.08)) SFX.door(d, 0.3, { pan, verb: 0.6 }); return; }
    if (env.night) {
      if (!env.cold && !env.rain && chance(0.75)) for (let i = 0; i < 3; i++) aTone(d, rand(4300, 4900), 0.05, { type: 'sine', vol: 0.022, delay: i * 0.07, pan });
      if (chance(env.blood ? 0.1 : 0.03)) VOICE.howl(d, 0.45, rand(0.8, 1.1), { pan, verb: 0.7 });
      if (chance(0.05)) { aTone(d, 410, 0.3, { type: 'sine', vol: 0.04, pan }); aTone(d, 370, 0.45, { type: 'sine', vol: 0.04, delay: 0.38, pan }); }
    } else if (!env.rain) {
      if (env.trees > 0.2 && chance(0.6)) { const b = rand(2300, 3700), n = randi(2, 5); for (let i = 0; i < n; i++) aTone(d, b + rand(-200, 500), 0.07, { type: 'sine', vol: 0.028, slide: rand(-700, 900), delay: i * 0.1, pan }); }
      if (chance(0.06)) VOICE.caw(d, 0.4, rand(0.9, 1.1), { pan });
      if (env.town && chance(0.05)) SFX.hammer(d, 0.25, { pan, verb: 0.3 });
    }
    if (env.swamp && chance(0.5)) { aTone(d, rand(120, 180), 0.12, { vol: 0.08, lp: 900, pan }); aTone(d, rand(110, 160), 0.14, { vol: 0.08, lp: 900, delay: 0.15, pan }); }
  },
};
