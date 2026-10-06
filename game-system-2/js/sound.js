/* Game System 2.0 — UI sounds, synthesized live with Web Audio (no sound files needed). */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var enabled = true;
  var volume = 0.55;
  var noiseBuf = null;
  var lastMove = 0;

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

  /* one oscillator note with a quick envelope */
  function tone(freq, dur, opts) {
    var c = ensure();
    if (!c) return;
    opts = opts || {};
    var t0 = c.currentTime + (opts.delay || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    var peak = opts.gain == null ? 0.2 : opts.gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(opts.out || master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
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
    unlock: function () { ensure(); },
    setEnabled: function (on) { enabled = !!on; if (!on && ctx) ctx.suspend().catch(function () {}); },
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
      tone(55, 0.9, { type: 'sine', to: 38, gain: 0.5, delay: 0.62, attack: 0.01 });
      tone(110, 0.5, { type: 'triangle', to: 70, gain: 0.15, delay: 0.62 });
    },
    boot: function () {
      tone(48, 1.6, { type: 'sine', to: 36, gain: 0.55, attack: 0.01 });
      noise(1.2, { from: 6000, to: 300, filter: 'lowpass', gain: 0.18, peakAt: 0.08, q: 0.5 });
      [261.6, 392, 523.3, 659.3, 784].forEach(function (f, i) {
        tone(f, 1.8, { type: 'sine', gain: 0.045, delay: 0.12 + i * 0.07, attack: 0.08 });
      });
    }
  };

  window.Sound = Sound;
})();
