/* Menu sounds. Game System 3's own are made live (a quiet "tik" when you move, a deep soft "thoom" when you
   press). Console styles use that console's real sound files when we have them (sounds/ui-*.ogg), and a
   matching live-made sound when we don't. */
let ctx = null;
let master = null;
let verb = null;
let volume = 0.7;

function ac() {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    verb = ctx.createConvolver();
    verb.buffer = impulse(2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    verb.connect(wet).connect(master);
  } catch (e) { ctx = null; }
  return ctx;
}

function impulse(sec) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * sec);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

function noise(sec) {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function tone(type, f0, f1, dur, gain, opts) {
  const c = ac();
  if (!c || volume <= 0) return;
  const t = c.currentTime + (opts && opts.delay || 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + (opts && opts.attack || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o.connect(g);
  if (opts && opts.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.lp;
    node = g.connect(f);
  }
  node.connect(master);
  if (opts && opts.verb) node.connect(verb);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/* ---------- real sound files ---------- */
const buffers = new Map();
function load(name) {
  if (buffers.has(name)) return buffers.get(name);
  const p = fetch('sounds/' + name + '.ogg').then(function (r) { return r.arrayBuffer(); })
    .then(function (b) { return ac().decodeAudioData(b); }).catch(function () { return null; });
  buffers.set(name, p);
  return p;
}
const last = {};   /* the move sound still ringing */
function sample(name, gain, kind) {
  const c = ac();
  if (!c || volume <= 0) return;
  load(name).then(function (buf) {
    if (!buf) return;
    /* a new move cuts the last one off (like a real console), so fast scrolling doesn't pile up */
    if (kind === 'move' && last.move) {
      const p = last.move;
      p.g.gain.setTargetAtTime(0, c.currentTime, 0.008);
      try { p.src.stop(c.currentTime + 0.05); } catch (e) { /* already ended */ }
    }
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buf;
    g.gain.value = gain == null ? 0.8 : gain;
    src.connect(g).connect(master);
    src.start();
    if (kind === 'move') {
      const me = { src: src, g: g };
      last.move = me;
      src.onended = function () { if (last.move === me) last.move = null; };
    }
  });
}

/* live-made sounds for consoles we have no button sound files for */
const PRESETS = {
  gs3: null,
  ps5: {
    move: function () { tone('sine', 2600, 2500, 0.03, 0.03, { lp: 6000 }); },
    ok: function () { tone('sine', 1250, 1100, 0.07, 0.05, { lp: 4000 }); tone('sine', 180, 120, 0.2, 0.08, { lp: 800 }); },
    back: function () { tone('sine', 900, 700, 0.06, 0.04, { lp: 4000 }); }
  },
  ps4: {
    move: function () { tone('triangle', 3100, 3000, 0.035, 0.03, { lp: 7000 }); },
    ok: function () { tone('sine', 1500, 1500, 0.09, 0.05, { verb: true }); tone('sine', 2250, 2250, 0.12, 0.03, { delay: 0.04, verb: true }); },
    back: function () { tone('sine', 1100, 800, 0.08, 0.04) ; }
  },
  xbox: {
    move: function () { tone('triangle', 520, 470, 0.05, 0.06, { lp: 2500 }); },
    ok: function () { tone('triangle', 700, 620, 0.06, 0.07, { lp: 3000 }); tone('sine', 140, 90, 0.18, 0.12, { lp: 600 }); },
    back: function () { tone('triangle', 430, 360, 0.07, 0.06, { lp: 2400 }); }
  },
  x360: {
    move: function () { tone('sine', 1900, 1700, 0.05, 0.04, { lp: 5000, verb: true }); },
    ok: function () { tone('sine', 880, 1320, 0.14, 0.05, { verb: true }); },
    back: function () { tone('sine', 1320, 880, 0.12, 0.04, { verb: true }); }
  },
  switch: {
    move: function () { tone('square', 3400, 3300, 0.012, 0.018, { lp: 6000 }); },
    ok: function () { tone('square', 2400, 2300, 0.02, 0.03, { lp: 5000 }); tone('sine', 1200, 1200, 0.05, 0.03, { delay: 0.02 }); },
    back: function () { tone('square', 1900, 1800, 0.018, 0.025, { lp: 5000 }); }
  },
  steam: {
    move: function () { tone('sine', 1700, 1900, 0.04, 0.035, { lp: 5000 }); },
    ok: function () { tone('sine', 900, 1400, 0.09, 0.05); },
    back: function () { tone('sine', 1300, 800, 0.08, 0.04); }
  },
  gc: {
    move: function () { tone('sine', 1760, 1760, 0.045, 0.035, { lp: 5000 }); },
    back: function () { tone('sine', 1175, 880, 0.08, 0.035, { lp: 4000 }); }
  },
  dreamcast: {
    move: function () { tone('square', 1568, 1568, 0.04, 0.02, { lp: 4000 }); },
    ok: function () { tone('square', 1046, 1046, 0.05, 0.025, { lp: 4000 }); tone('square', 1568, 1568, 0.07, 0.025, { lp: 4000, delay: 0.05 }); },
    back: function () { tone('square', 1046, 784, 0.08, 0.025, { lp: 4000 }); }
  }
};

/* the active pack: real files first, then the live-made preset, then Game System 3's own */
let pack = {};
let preset = null;
function play(kind, fallback) {
  if (pack[kind]) { sample(pack[kind], pack.gain, kind); return; }
  if (preset && preset[kind]) { preset[kind](); return; }
  fallback();
}

/* long sounds (startup, game start): played as audio so they can be stopped/faded */
let longEl = null;
function playLong(name, vol) {
  if (!name) return null;
  if (longEl) { longEl.pause(); longEl = null; }
  const el = new Audio('sounds/' + name + '.ogg');
  el.volume = Math.max(0, Math.min(1, (vol == null ? 0.9 : vol) * Math.max(volume, 0.35)));
  el.play().catch(function () {});
  longEl = el;
  return el;
}

export const Sound = {
  setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = volume;
  },
  unlock() { const c = ac(); if (c && c.state === 'suspended') c.resume(); },
  /* pack = { move, ok, back, open, error, good, home: sound file names, preset: live-made sound set, gain } */
  usePack(p) {
    pack = p || {};
    preset = PRESETS[pack.preset] || null;
    ['move', 'ok', 'back', 'open', 'error', 'good', 'home'].forEach(function (k) { if (pack[k]) load(pack[k]); });
  },
  preload: load,
  playLong: playLong,
  stopLong(fadeMs) {
    const el = longEl;
    if (!el) return;
    longEl = null;
    const v0 = el.volume, t0 = performance.now(), ms = fadeMs || 400;
    (function step(t) {
      const k = Math.min(1, (t - t0) / ms);
      el.volume = v0 * (1 - k);
      if (k < 1) requestAnimationFrame(step); else el.pause();
    })(t0);
  },
  /* the sound when a game starts: a sound file (ui- or boot- names), or a live-made one */
  launch(id) {
    if (!id || id === 'none') return;
    if (/^(ui|boot)-/.test(id)) { playLong(id, 0.85); return; }
    const L = {
      gs3: function () { tone('sine', 150, 54, 0.6, 0.34, { lp: 900, verb: true }); tone('sine', 300, 900, 0.5, 0.04, { lp: 3000, verb: true }); },
      ps4: function () { tone('sine', 1318, 1318, 0.35, 0.05, { verb: true }); tone('sine', 1975, 1975, 0.5, 0.04, { delay: 0.12, verb: true }); },
      ps2: function () { tone('sine', 110, 82, 1.2, 0.3, { lp: 700, verb: true }); tone('sine', 660, 990, 0.8, 0.03, { verb: true }); },
      xbox: function () { tone('triangle', 196, 98, 0.5, 0.22, { lp: 900, verb: true }); tone('sine', 784, 1175, 0.25, 0.04, { verb: true }); },
      x360: function () { tone('sine', 523, 1046, 0.45, 0.05, { verb: true }); tone('sine', 784, 1568, 0.5, 0.04, { delay: 0.1, verb: true }); },
      steam: function () { tone('sine', 400, 1200, 0.35, 0.05, { lp: 4000, verb: true }); },
      dreamcast: function () { [1046, 1318, 1568, 2093].forEach(function (f, i) { tone('square', f, f, 0.09, 0.025, { lp: 4000, delay: i * 0.07 }); }); }
    };
    (L[id] || L.gs3)();
  },
  move() { play('move', function () { tone('sine', 2300, 2100, 0.035, 0.035, { lp: 5000 }); }); },
  press() {
    play('ok', function () {
      tone('sine', 150, 54, 0.42, 0.34, { lp: 900, verb: true });
      tone('triangle', 880, 660, 0.09, 0.025, { lp: 3000 });
    });
  },
  back() { play('back', function () { tone('sine', 820, 560, 0.08, 0.05, { lp: 3000 }); }); },
  open() { play('open', function () { tone('sine', 520, 780, 0.12, 0.05, { lp: 3500, verb: true }); }); },
  error() { play('error', function () { tone('triangle', 240, 200, 0.12, 0.08, { lp: 1200 }); tone('triangle', 200, 170, 0.16, 0.08, { lp: 1200, delay: 0.13 }); }); },
  /* back on the home screen from a game: only consoles that have a sound for it (Switch HOME) */
  home() { play('home', function () {}); },
  good() { play('good', function () { tone('sine', 660, 660, 0.12, 0.05, { verb: true }); tone('sine', 990, 990, 0.2, 0.05, { delay: 0.09, verb: true }); }); },
  shutter() {
    const c = ac();
    if (!c || volume <= 0) return;
    [0, 0.07].forEach(function (d) {
      const n = noise(0.05);
      const f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8;
      const g = c.createGain();
      const t = c.currentTime + d;
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(f).connect(g).connect(master);
      n.start(t);
    });
  },
  /* deep startup sound: a slow chord that opens up while the light sweeps across */
  boot() {
    const c = ac();
    if (!c || volume <= 0) return;
    const t = c.currentTime + 0.05;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + 1.6);
    lp.frequency.exponentialRampToValueAtTime(900, t + 3.6);
    const bus = c.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(0.5, t + 0.9);
    bus.gain.setValueAtTime(0.5, t + 1.9);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + 4.4);
    lp.connect(bus);
    bus.connect(master);
    bus.connect(verb);
    [[55, 'sine', 0.55], [110, 'sine', 0.4], [164.81, 'triangle', 0.12], [220, 'sine', 0.16], [277.18, 'sine', 0.08], [329.63, 'sine', 0.06]].forEach(function (n, i) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = n[1];
      o.frequency.value = n[0];
      o.detune.value = (i % 2 ? 4 : -4);
      g.gain.value = n[2];
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + 4.6);
    });
    /* soft air with the light sweep */
    const air = noise(2.4);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t + 0.6);
    bp.frequency.exponentialRampToValueAtTime(5200, t + 2.4);
    const ag = c.createGain();
    ag.gain.setValueAtTime(0.0001, t + 0.6);
    ag.gain.exponentialRampToValueAtTime(0.05, t + 1.4);
    ag.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
    air.connect(bp).connect(ag).connect(master);
    ag.connect(verb);
    air.start(t + 0.6);
  }
};
