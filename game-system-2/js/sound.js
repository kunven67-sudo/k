/* Game System 2.0 — UI sounds, synthesized live with Web Audio (no sound files needed). */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var enabled = true;
  var volume = 0.55;
  var noiseBuf = null;
  var lastMove = 0;
  /* each theme sounds a bit different */
  var STYLES = {
    neon: { wave: null, pitch: 1, decay: 1, gain: 1 },
    hacker: { wave: 'square', pitch: 1.5, decay: 0.55, gain: 0.45 },
    lava: { wave: 'sawtooth', pitch: 0.7, decay: 1.25, gain: 0.55, lowpass: 1600 },
    ice: { wave: 'sine', pitch: 1.6, decay: 2.2, gain: 0.9 }
  };
  var style = STYLES.neon;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = volume;
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        master.connect(comp);
        comp.connect(ctx.destination);
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }

  function getNoise() {
    if (noiseBuf) return noiseBuf;
    var len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /* one oscillator note with a quick envelope (UI sounds follow the theme's style) */
  function tone(freq, dur, opts) {
    var c = ensure();
    if (!c) return;
    opts = opts || {};
    var st = opts.raw ? STYLES.neon : style;
    freq *= st.pitch;
    if (opts.to) opts.to *= st.pitch;
    dur *= st.decay;
    var t0 = c.currentTime + (opts.delay || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = st.wave || opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    var peak = (opts.gain == null ? 0.2 : opts.gain) * st.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    if (st.lowpass) {
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = st.lowpass;
      g.connect(lp);
      lp.connect(opts.out || master);
    } else {
      g.connect(opts.out || master);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /* ---------------- menu music (made live, matches the theme) ---------------- */
  var MUSIC = {
    neon: { chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], pad: 'sawtooth', cut: 900, arp: 'triangle', arpOct: 12, arpEvery: 0.5, bars: 4 },
    hacker: { chords: [[45, 48, 52], [43, 46, 50], [41, 45, 48], [40, 43, 47]], pad: 'sine', cut: 700, arp: 'square', arpOct: 24, arpEvery: 0.25, bars: 4 },
    lava: { chords: [[38, 45, 50], [36, 43, 48], [34, 41, 46], [36, 43, 48]], pad: 'sawtooth', cut: 420, arp: 'sawtooth', arpOct: 12, arpEvery: 1, bars: 5 },
    ice: { chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 66]], pad: 'sine', cut: 2400, arp: 'sine', arpOct: 24, arpEvery: 0.5, bars: 5 }
  };
  var music = { on: false, style: 'neon', bus: null, timer: 0, step: 0, playing: false };
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function musicBlocked() {
    try {
      if (window.Player && Player.isPlaying()) return true;
      if (window.Win && Win.isOpen('gs2-music')) return true;
    } catch (e) { /* ignore */ }
    return document.hidden;
  }
  function musicTick() {
    clearTimeout(music.timer);
    if (!music.on || !enabled) { fadeMusic(0); return; }
    var c = ensure();
    if (!c) return;
    if (!music.bus) {
      music.bus = c.createGain();
      music.bus.gain.value = 0;
      music.bus.connect(master);
    }
    var m = MUSIC[music.style] || MUSIC.neon;
    var bar = m.bars;
    if (musicBlocked()) { fadeMusic(0); music.timer = setTimeout(musicTick, 1500); return; }
    fadeMusic(0.5);
    var chord = m.chords[music.step % m.chords.length];
    music.step++;
    var t0 = c.currentTime + 0.05;
    /* pad */
    chord.forEach(function (n, i) {
      [-6, 6].forEach(function (det) {
        var o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = m.pad;
        o.frequency.value = midi(n - 12);
        o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = m.cut;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.035 / chord.length, t0 + 1.2);
        g.gain.setValueAtTime(0.035 / chord.length, t0 + bar - 1);
        g.gain.linearRampToValueAtTime(0.0001, t0 + bar + 0.4);
        o.connect(f); f.connect(g); g.connect(music.bus);
        o.start(t0); o.stop(t0 + bar + 0.5);
      });
      void i;
    });
    /* arpeggio */
    var steps = Math.floor(bar / m.arpEvery);
    for (var k = 0; k < steps; k++) {
      var n = chord[k % chord.length] + m.arpOct - 12;
      var at = t0 + k * m.arpEvery;
      var o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = m.arp;
      o2.frequency.value = midi(n);
      var len = Math.min(0.9, m.arpEvery * 1.6);
      g2.gain.setValueAtTime(0.0001, at);
      g2.gain.exponentialRampToValueAtTime(m.arp === 'square' ? 0.008 : 0.018, at + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o2.connect(g2); g2.connect(music.bus);
      o2.start(at); o2.stop(at + len + 0.05);
    }
    music.timer = setTimeout(musicTick, bar * 1000 - 60);
  }
  function fadeMusic(to) {
    if (!music.bus || !ctx) return;
    var g = music.bus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(to, ctx.currentTime + 1.2);
  }

  function noise(dur, opts) {
    var c = ensure();
    if (!c) return;
    opts = opts || {};
    var t0 = c.currentTime + (opts.delay || 0);
    var src = c.createBufferSource();
    src.buffer = getNoise();
    var f = c.createBiquadFilter();
    f.type = opts.filter || 'bandpass';
    f.Q.value = opts.q || 1.2;
    f.frequency.setValueAtTime(opts.from || 400, t0);
    f.frequency.exponentialRampToValueAtTime(opts.to || 4000, t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.25, t0 + dur * (opts.peakAt || 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  var Sound = {
    unlock: function () { ensure(); if (music.on) musicTick(); },
    setEnabled: function (on) {
      enabled = !!on;
      if (!on && ctx) ctx.suspend().catch(function () {});
      if (on && music.on) musicTick();
    },
    setStyle: function (name) { style = STYLES[name] || STYLES.neon; },
    setMusicStyle: function (name) { music.style = MUSIC[name] ? name : 'neon'; },
    /* background music in the menus (stops while a game or the Music app plays) */
    setMusic: function (on) {
      music.on = !!on;
      if (on) { if (ctx) musicTick(); } else { clearTimeout(music.timer); fadeMusic(0); }
    },
    setVolume: function (v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = volume;
    },
    /* soft tick when moving between things */
    move: function () {
      var now = performance.now();
      if (now - lastMove < 45) return;
      lastMove = now;
      tone(1500, 0.045, { type: 'sine', gain: 0.05 });
    },
    hover: function () {
      var now = performance.now();
      if (now - lastMove < 70) return;
      lastMove = now;
      tone(2100, 0.03, { type: 'sine', gain: 0.025 });
    },
    select: function () {
      tone(660, 0.08, { type: 'triangle', gain: 0.12 });
      tone(990, 0.12, { type: 'triangle', gain: 0.1, delay: 0.05 });
    },
    back: function () {
      tone(720, 0.07, { type: 'triangle', gain: 0.1 });
      tone(480, 0.1, { type: 'triangle', gain: 0.09, delay: 0.05 });
    },
    open: function () {
      tone(420, 0.16, { type: 'sine', to: 880, gain: 0.08 });
      noise(0.18, { from: 800, to: 5000, gain: 0.05 });
    },
    toast: function () {
      tone(1046, 0.12, { type: 'sine', gain: 0.07 });
      tone(1568, 0.2, { type: 'sine', gain: 0.06, delay: 0.07 });
    },
    good: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.18, { type: 'triangle', gain: 0.09, delay: i * 0.06 }); });
    },
    error: function () {
      tone(160, 0.22, { type: 'sawtooth', gain: 0.07 });
      tone(120, 0.26, { type: 'sawtooth', gain: 0.06, delay: 0.09 });
    },
    launch: function () {
      noise(0.9, { from: 200, to: 9000, gain: 0.22, q: 0.8, peakAt: 0.75 });
      tone(55, 0.9, { type: 'sine', to: 38, gain: 0.5, delay: 0.62, attack: 0.01, raw: true });
      tone(110, 0.5, { type: 'triangle', to: 70, gain: 0.15, delay: 0.62, raw: true });
    },
    boot: function () {
      tone(48, 1.6, { type: 'sine', to: 36, gain: 0.55, attack: 0.01, raw: true });
      noise(1.2, { from: 6000, to: 300, filter: 'lowpass', gain: 0.18, peakAt: 0.08, q: 0.5 });
      [261.6, 392, 523.3, 659.3, 784].forEach(function (f, i) {
        tone(f, 1.8, { type: 'sine', gain: 0.045, delay: 0.12 + i * 0.07, attack: 0.08 });
      });
    },
    /* camera shutter: two quick clicks */
    shutter: function () {
      noise(0.05, { filter: 'highpass', from: 2500, to: 6000, gain: 0.35, peakAt: 0.15 });
      noise(0.08, { filter: 'bandpass', from: 1800, to: 900, gain: 0.25, peakAt: 0.2, delay: 0.07 });
    },
    /* recording started / stopped */
    recStart: function () {
      tone(660, 0.12, { type: 'sine', gain: 0.12, raw: true });
      tone(990, 0.18, { type: 'sine', gain: 0.12, delay: 0.1, raw: true });
    },
    recStop: function () {
      tone(990, 0.12, { type: 'sine', gain: 0.12, raw: true });
      tone(560, 0.22, { type: 'sine', gain: 0.12, delay: 0.1, raw: true });
    },
    /* a timer or alarm going off: called once a second (n = how many times so far) */
    alarm: function (n) {
      var hi = (n || 0) % 4 === 3 ? 1320 : 1046;
      tone(hi, 0.12, { type: 'square', gain: 0.07, raw: true });
      tone(hi, 0.12, { type: 'square', gain: 0.07, delay: 0.18, raw: true });
      tone(hi * 1.25, 0.16, { type: 'square', gain: 0.06, delay: 0.36, raw: true });
    },
    /* a trophy unlocked */
    trophy: function () {
      [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0.22, { type: 'triangle', gain: 0.08, delay: i * 0.07 }); });
      tone(2093, 0.5, { type: 'sine', gain: 0.05, delay: 0.3 });
    },
    /* a short sample of the theme's sound (for the theme picker) */
    sample: function () {
      [523, 659, 784].forEach(function (f, i) { tone(f, 0.16, { type: 'triangle', gain: 0.09, delay: i * 0.07 }); });
    }
  };

  window.Sound = Sound;
})();
