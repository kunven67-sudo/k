/* HANDS OFF: every sound is made live in code. The music starts as a hum, turns into phonk the longer
   you hold still, then into breakcore chaos. Milestones drop the bass, worlds change the key, resets tape-stop it. */
(function (root) {
  'use strict';
  let ctx = null, master, comp, musicBus, musicFilter, sfxBus, crush, verb, verbSend, noiseBuf, drive;
  let musicVol = 0.7, sfxVol = 0.8;
  let mode = 'menu', inten = 0, world = 0, slow = 0;
  let timer = null, nextStep = 0, step = 0, barN = 0;
  const BPM = 140, SPB = 60 / BPM / 4; // one 16th note
  const kicks = [];
  let drone = null, droneRoot = 0, stopped = false;
  let duckUntil = 0;
  const last = {};

  // ---------- helpers ----------
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];   // minor pentatonic-ish
  function rootHz(w) { return 55 * Math.pow(2, (((w * 5) % 12 + 12) % 12) / 12); } // every world moves a fourth
  const midiRatio = (s) => Math.pow(2, s / 12);
  function rnd(seed) { let x = (seed | 0) * 374761393 + 668265263; x = (x ^ (x >>> 13)) * 1274126177; x ^= x >>> 16; return (x >>> 0) / 4294967296; }
  function g(v, dest) { const n = ctx.createGain(); n.gain.value = v; if (dest) n.connect(dest); return n; }
  function makeNoise() {
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return b;
  }
  function curve(fn, n) { const c = new Float32Array(n || 1024); for (let i = 0; i < c.length; i++) c[i] = fn(i / (c.length - 1) * 2 - 1); return c; }
  function envAt(gn, t, a, peak, d) {
    gn.gain.cancelScheduledValues(t);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.001, a));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, f, t, a, d, peak, dest, f2, glide) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + (glide || d));
    const e = g(0, dest); o.connect(e); envAt(e, t, a, peak, d);
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function hiss(t, dur, peak, type, freq, q, dest, f2) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 0.7;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const e = g(0, dest); s.connect(f); f.connect(e); envAt(e, t, 0.002, peak, dur);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function limited(name, ms) { const n = performance.now(); if (last[name] && n - last[name] < ms) return true; last[name] = n; return false; }
  const bursts = {};
  function limitedN(name, ms, n) { // no more than n in any ms window
    const now = performance.now(), a = bursts[name] || (bursts[name] = []);
    while (a.length && now - a[0] > ms) a.shift();
    if (a.length >= n) return true;
    a.push(now); return false;
  }

  // ---------- recorded sounds (real glass, CC0) ----------
  const bufs = {};
  function loadSamples() {
    const S = root.HOSAMPLES || {};
    for (const k in S) {
      try {
        const bin = atob(S[k]), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const p = ctx.decodeAudioData(u.buffer, (b) => { bufs[k] = b; }, () => {});
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* one bad sound never stops the rest */ }
    }
  }
  function play(name, t, o) {
    const b = bufs[name];
    if (!b) return false;
    o = o || {};
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = o.rate || 1;
    let node = s;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    const gn = g(o.gain === undefined ? 1 : o.gain);
    node.connect(gn);
    let out = gn;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); gn.connect(p); out = p; }
    out.connect(o.dest || sfxBus);
    if (o.verb) gn.connect(g(o.verb, verbSend));
    s.start(t);
    return true;
  }
  const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
  // the deep movie horn: detuned saws, a filter that opens and closes, a bit of grit
  function braam(t, f0, dur, amt) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2.2;
    f.frequency.setValueAtTime(140, t); f.frequency.exponentialRampToValueAtTime(2000, t + 0.28); f.frequency.exponentialRampToValueAtTime(240, t + dur);
    const sh = ctx.createWaveShaper(); sh.curve = curve((x) => Math.tanh(x * 2.6));
    const e = g(0); f.connect(sh); sh.connect(e); e.connect(sfxBus); e.connect(g(0.5, verbSend));
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.32 * amt, t + 0.07); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [m, det] of [[1, -9], [1, 8], [1.5, -5], [2, 6], [0.5, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0 * m; o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  // ---------- setup ----------
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; return; } }
    try {
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.22;
      // master -> cut the sub-rumble nobody can hear -> glue compressor -> brickwall limiter (never clips)
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; hp.Q.value = 0.7;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      master = g(0.7); master.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
      musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 1200; musicFilter.Q.value = 0.8;
      musicBus = g(0); musicBus.connect(musicFilter); musicFilter.connect(master);
      sfxBus = g(sfxVol, master);
      drive = ctx.createWaveShaper(); drive.curve = curve((x) => Math.tanh(x * 2.2)); drive.connect(g(0.5, musicBus));
      crush = ctx.createWaveShaper(); crush.curve = curve((x) => Math.round(x * 7) / 7 * 0.9, 2048); crush.connect(musicBus);
      noiseBuf = makeNoise();
      verb = ctx.createConvolver(); verb.buffer = impulse(2.6);
      verbSend = g(0.22); verbSend.connect(verb); verb.connect(master);
      startDrone();
      loadSamples();
      nextStep = ctx.currentTime + 0.12;
      timer = setInterval(schedule, 25);
    } catch (e) { ctx = null; }
  }
  function startDrone() {
    const r = rootHz(world);
    droneRoot = r;
    const out = g(0.0001, musicBus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3;
    lp.connect(out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoAmt = g(260); lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency); lfo.start();
    const oscs = [['sawtooth', 1, 0.16], ['sawtooth', 1.006, 0.16], ['sine', 1, 0.28], ['sawtooth', 1.5, 0.07], ['triangle', 2, 0.05]].map(([type, m, v]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = r * m;
      const gg = g(v, lp); o.connect(gg); o.start();
      return { o, m };
    });
    drone = { out, lp, oscs };
  }
  function retune(w, t) {
    if (!drone) return;
    const r = rootHz(w);
    droneRoot = r;
    for (const d of drone.oscs) d.o.frequency.setTargetAtTime(r * d.m, t, 0.4);
  }

  // ---------- music ----------
  function kick(t, big) {
    kicks.push(t); if (kicks.length > 16) kicks.shift();
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(big ? 170 : 150, t); o.frequency.exponentialRampToValueAtTime(droneRoot * 0.8, t + 0.09);
    const e = g(0, drive); o.connect(e); envAt(e, t, 0.002, big ? 1 : 0.8, big ? 0.9 : 0.42);
    o.start(t); o.stop(t + 1);
  }
  function snare(t, v, dest) {
    hiss(t, 0.16, 0.5 * v, 'bandpass', 1900, 0.9, dest || musicBus);
    hiss(t, 0.06, 0.4 * v, 'highpass', 5000, 0.7, dest || musicBus);
    tone('triangle', 210, t, 0.001, 0.09, 0.25 * v, dest || musicBus, 160);
  }
  function hat(t, v, open, dest) { hiss(t, open ? 0.18 : 0.035, 0.32 * v, 'highpass', 8200, 0.6, dest || musicBus); }
  function cowbell(t, semis, v) {
    const k = midiRatio(semis);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 * k; bp.Q.value = 2.5;
    const e = g(0, musicBus); bp.connect(e); bp.connect(verbSend);
    for (const f of [540, 800]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * k; o.connect(bp); o.start(t); o.stop(t + 0.4); }
    envAt(e, t, 0.002, 0.26 * v, 0.28);
  }
  function bass808(t, semis, len) {
    const f = droneRoot * midiRatio(semis);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const e = g(0, drive); o.connect(e);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.55, t + 0.01); e.gain.setTargetAtTime(0.0001, t + len * 0.7, len * 0.25);
    o.start(t); o.stop(t + len + 0.3);
  }
  function reese(t, semis, len, v) {
    const f = droneRoot * midiRatio(semis);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(900, t + len * 0.5); lp.frequency.linearRampToValueAtTime(260, t + len); lp.Q.value = 4;
    const e = g(0, crush); lp.connect(e);
    for (const m of [1, 1.012, 0.994]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * m; o.connect(lp); o.start(t); o.stop(t + len + 0.1); }
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.03); e.gain.setTargetAtTime(0.0001, t + len * 0.85, 0.05);
  }
  const PHONK_K = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  const MELODY = [
    [0, -1, 0, 3, -1, 5, 3, -1, 0, -1, 0, 7, -1, 5, 3, -1],
    [12, -1, 10, 7, -1, 5, -1, 3, 0, -1, 3, -1, 5, 7, -1, 3],
    [0, 0, -1, 3, -1, 0, 5, -1, 7, -1, 5, 3, -1, 0, -1, -1],
    [7, -1, 5, -1, 3, -1, 5, 7, 10, -1, 7, -1, 5, 3, 0, -1],
  ];
  const BASSLINE = [0, 0, -2, -4];
  const BREAK = [
    ['k', '', 'k', '', 's', '', '', 's', '', 's', 'k', '', 's', '', '', 's'],
    ['k', '', '', 'k', 's', '', 'k', '', '', 'k', 's', '', 'k', 's', 's', 's'],
    ['k', 'k', '', '', 's', '', 's', '', 'k', '', 's', 'k', '', 's', 'k', 's'],
  ];
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (nextStep < now - 0.05) nextStep = now + 0.05; // after a pause, don't machine-gun the missed steps
    while (nextStep < now + 0.12) { playStep(step, nextStep); nextStep += SPB; step = (step + 1) % 16; if (!step) barN++; }
  }
  function playStep(s, t) {
    const live = mode === 'live' || mode === 'arming';
    if (!live || stopped || t < duckUntil) return;
    const I = mode === 'arming' ? Math.min(inten, 0.2) : inten; // arming: just the hum, the beat drops back in when you go live
    const phrase = Math.floor(barN / 2) % 4;
    const breakcore = I >= 0.62;
    // phonk drums
    if (I >= 0.22 && !breakcore) {
      const fill = barN % 4 === 3 && s >= 12;
      if (PHONK_K[s] || (fill && s % 2 === 0)) kick(t, s === 0);
      if (s === 4 || s === 12) snare(t, 1);
      if (I >= 0.32 && s % 2 === 0) hat(t, s % 4 === 2 ? 1 : 0.6, s === 14 && barN % 2 === 1);
      if (I >= 0.46 && s % 2 === 1) hat(t, 0.45);
      if (I >= 0.52 && rnd(barN * 31 + s) < 0.12) { hat(t + SPB / 3, 0.4); hat(t + SPB * 2 / 3, 0.4); }
    }
    // 808 bass
    if (I >= 0.3 && (s === 0 || s === 6 || s === 10)) bass808(t, BASSLINE[barN % 4] + (s === 10 ? 12 * (rnd(barN) < 0.3 ? 1 : 0) : 0), s === 0 ? SPB * 6 : SPB * 4);
    // the cowbell melody (the phonk sound)
    if (I >= 0.38) {
      const n = MELODY[phrase][s];
      if (n >= 0 && !(breakcore && rnd(barN * 7 + s) < 0.35)) cowbell(t, n + (I > 0.8 && rnd(barN + s) < 0.15 ? 12 : 0), 1);
    }
    // breakcore: double-time chopped breaks, crushed
    if (breakcore) {
      const pat = BREAK[(barN + (rnd(barN) < 0.3 ? 1 : 0)) % BREAK.length];
      const hit = pat[s];
      const stutter = rnd(barN * 13 + s) < 0.08 + (I - 0.62) * 0.25;
      if (hit === 'k') kick(t, false);
      if (hit === 's') snare(t, 0.9, crush);
      if (stutter) for (let i = 0; i < 4; i++) snare(t + i * SPB / 4, 0.5 - i * 0.08, crush);
      hat(t, s % 2 ? 0.35 : 0.6, false, crush);
      hat(t + SPB / 2, 0.3, false, crush);
      if (I >= 0.78 && s === 0) reese(t, BASSLINE[barN % 4], SPB * 16, Math.min(1, (I - 0.7) * 3));
      if (I >= 0.9 && rnd(barN * 3 + s) < 0.05) glitchBurst(t, crush);
    }
  }
  function glitchBurst(t, dest) {
    for (let i = 0; i < 6; i++) tone('square', 200 + rnd(i * 9 + Math.floor(t * 10)) * 1800, t + i * 0.018, 0.001, 0.016, 0.12, dest || sfxBus);
  }

  // ---------- state from the game ----------
  function update(dt, o) {
    if (!ctx) return;
    const prevMode = mode, prevWorld = world;
    mode = o.mode; inten = o.intensity || 0; slow = o.slow || 0;
    if (o.world !== undefined && o.world !== world) { world = o.world; if (mode === 'live' || mode === 'arming') retune(world, ctx.currentTime); }
    const t = ctx.currentTime;
    let level = 0, cut = 18000;
    if (mode === 'menu') { level = 0.55; cut = 700; }
    else if (mode === 'arming') { level = 0.7; cut = 1000 + inten * 3000; }
    else if (mode === 'live') { level = 1; cut = 900 + Math.min(1, inten / 0.55) * 17000; }
    else if (mode === 'pending') { level = 0.8; cut = 350; }
    else if (mode === 'reset') level = 0;
    if (slow > 0.05) cut = Math.min(cut, 18000 * (1 - slow * 0.92));
    if (prevMode !== mode) {
      if (mode === 'reset') tapeStop(t);
      if (prevMode === 'reset' || (stopped && mode !== 'reset')) { stopped = false; retune(world, t); }
    }
    if (!stopped) {
      musicBus.gain.setTargetAtTime(musicVol * level * 0.62, t, mode === 'pending' ? 0.05 : 0.35);
      musicFilter.frequency.setTargetAtTime(cut, t, mode === 'pending' ? 0.04 : 0.5);
    }
    if (drone) drone.out.gain.setTargetAtTime(mode === 'reset' ? 0.0001 : 0.22 * (1 - Math.min(0.5, inten * 0.5)), t, 0.6);
  }
  function tapeStop(t) {
    stopped = true;
    if (drone) for (const d of drone.oscs) { d.o.frequency.cancelScheduledValues(t); d.o.frequency.setValueAtTime(d.o.frequency.value, t); d.o.frequency.exponentialRampToValueAtTime(Math.max(1, droneRoot * d.m * 0.12), t + 0.75); }
    musicFilter.frequency.cancelScheduledValues(t); musicFilter.frequency.setValueAtTime(musicFilter.frequency.value, t); musicFilter.frequency.exponentialRampToValueAtTime(60, t + 0.8);
    musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(0, t + 0.8);
    // the tape itself winding down
    tone('sawtooth', 220, t, 0.01, 0.8, 0.12, sfxBus, 18, 0.75);
  }
  function beat() {
    if (!ctx || ctx.state !== 'running') return null;
    if (mode !== 'live' && mode !== 'arming') return 0;
    const now = ctx.currentTime;
    let k = -1;
    for (const x of kicks) if (x <= now && x > k) k = x;
    return k < 0 ? 0 : Math.exp(-(now - k) * 7);
  }

  // ---------- sound effects ----------
  const SFX = {
    tick(t, o) { tone('sine', o && o.n === 1 ? 1320 : 880, t, 0.002, 0.12, 0.25, sfxBus); tone('sine', 110, t, 0.002, 0.15, 0.3, sfxBus, 60); },
    armed(t) {
      for (const [f, v] of [[220, 0.2], [277.2, 0.14], [329.6, 0.14], [440, 0.12]]) tone('sawtooth', f, t, 0.004, 0.6, v, sfxBus);
      tone('sine', 90, t, 0.002, 0.5, 0.6, sfxBus, 40);
      hiss(t, 0.5, 0.25, 'highpass', 3000, 0.7, verbSend);
    },
    nope(t) { tone('square', 92, t, 0.002, 0.14, 0.14, sfxBus); tone('square', 87, t + 0.07, 0.002, 0.12, 0.12, sfxBus); },
    crack(t) {
      play(pickOf(['glass_hit_01', 'glass_hit_02']), t, { rate: 1.2 + Math.random() * 0.35, gain: 0.75, verb: 0.2 });
      hiss(t, 0.09, 0.9, 'highpass', 2500, 0.8, sfxBus);
      for (let i = 0; i < 7; i++) tone('sine', 2500 + Math.random() * 4500, t + i * 0.012 + Math.random() * 0.02, 0.001, 0.06, 0.18, sfxBus);
      tone('sine', 140, t, 0.001, 0.2, 0.5, sfxBus, 50);
    },
    shatter(t, o) {
      if (play('glass_breaking', t, { gain: 1, verb: 0.35 })) {
        play('glass_breaking_06', t + 0.03, { gain: 0.6, pan: -0.4, rate: 1.05 });
        play('glass_breaking_03', t + 0.06, { gain: 0.5, pan: 0.45, rate: 0.95 });
        tone('sine', 120, t, 0.001, 0.6, 0.9, sfxBus, 32);
        if (o && o.big) {
          // time slows down: the same crash, stretched out and far away, then it all comes back at full speed
          play('glass_breaking', t + 0.12, { rate: 0.32, gain: 0.45, lp: 2600, verb: 0.9 });
          play('glass_breaking_04', t + 0.42, { rate: 0.4, gain: 0.25, lp: 3000, verb: 0.9, pan: 0.3 });
          hiss(t + 0.1, 1.4, 0.12, 'bandpass', 900, 0.7, verbSend, 200);
          tone('sine', 46, t + 0.1, 0.4, 1.2, 0.35, sfxBus, 38);
          hiss(t + 1.2, 0.4, 0.28, 'highpass', 700, 0.7, sfxBus, 7000);
        }
        return;
      }
      hiss(t, 0.7, 0.9, 'highpass', 1800, 0.6, sfxBus);
      hiss(t, 1.2, 0.35, 'bandpass', 5000, 1.5, verbSend);
      for (let i = 0; i < 46; i++) {
        const dt = Math.pow(Math.random(), 1.8) * 1.3;
        tone('sine', 2200 + Math.random() * 6500, t + dt, 0.001, 0.05 + Math.random() * 0.25, 0.05 + Math.random() * 0.12 * (1 - dt / 1.5), Math.random() < 0.4 ? verbSend : sfxBus);
      }
      tone('sine', 120, t, 0.001, 0.5, 0.8, sfxBus, 35);
    },
    rewind(t) {
      hiss(t, 1.6, 0.25, 'bandpass', 3500, 3, sfxBus, 700);
      for (let i = 0; i < 26; i++) { const tt = t + 0.05 + i * 0.06; tone('sawtooth', 1800 - i * 50, tt, 0.002, 0.045, 0.06, sfxBus, 300); }
    },
    slam(t) {
      tone('sine', 70, t, 0.002, 1.2, 1, sfxBus, 32);
      hiss(t, 0.35, 0.8, 'lowpass', 2500, 0.7, sfxBus);
      for (const f of [110, 116.5, 164.8]) tone('sawtooth', f, t, 0.004, 0.9, 0.12, sfxBus);
      hiss(t, 1.8, 0.3, 'bandpass', 1200, 0.8, verbSend);
    },
    milestone(t, o) {
      const tier = (o && o.tier) || 1;
      duckUntil = t + 0.12;
      braam(t, rootHz(world) * (tier % 2 ? 1 : 0.84), 1.9, 1);
      tone('sine', 62, t, 0.002, 1.6, 1, sfxBus, 30);
      tone('sine', 124, t, 0.002, 0.5, 0.35, sfxBus, 60);
      hiss(t, 1.4, 0.45, 'highpass', 6000, 0.7, verbSend);
      hiss(t, 0.25, 0.5, 'lowpass', 3000, 0.6, sfxBus);
      const base = 440 * Math.pow(2, ((tier * 7) % 12) / 12);
      [0, 3, 7, 12, 15, 19].forEach((s, i) => tone('triangle', base * midiRatio(s), t + 0.04 + i * 0.045, 0.002, 0.5, 0.09, verbSend));
    },
    world(t, o) {
      hiss(t, 1.4, 0.35, 'bandpass', 400, 2, sfxBus, 9000);
      tone('sine', 50, t + 1.1, 0.002, 2.2, 0.9, sfxBus, 28);
      braam(t + 1.1, rootHz((o && o.w) || world) * 0.75, 2.6, 1.2);
      for (const f of [65.4, 98, 130.8, 155.6]) tone('sawtooth', f, t + 1.1, 0.01, 2, 0.08, verbSend);
      hiss(t + 1.1, 2, 0.4, 'highpass', 4000, 0.6, verbSend);
    },
    buy(t, o) {
      if (limited('buy', 110)) return;
      const f = o && o.kind === 'tempo' ? 990 : o && o.kind === 'resonance' ? 1480 : 1250;
      tone('sine', f, t, 0.002, 0.07, 0.06, sfxBus, f * 1.5, 0.05);
    },
    level(t) { if (limited('level', 300)) return; tone('triangle', 660, t, 0.002, 0.08, 0.05, sfxBus); },
    toast(t) { tone('sine', 1046.5, t, 0.003, 0.25, 0.14, sfxBus); tone('sine', 1568, t + 0.09, 0.003, 0.35, 0.12, verbSend); },
    bait(t) { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone('square', f, t + i * 0.06, 0.002, 0.09, 0.05, sfxBus)); },
    error(t) { tone('square', 330, t, 0.003, 0.16, 0.09, sfxBus); tone('square', 262, t + 0.16, 0.003, 0.22, 0.09, sfxBus); },
    fakeclick(t) { hiss(t, 0.012, 0.6, 'highpass', 3000, 0.7, sfxBus); hiss(t + 0.08, 0.01, 0.4, 'highpass', 3500, 0.7, sfxBus); },
    glitch(t) { glitchBurst(t, sfxBus); hiss(t, 0.15, 0.3, 'bandpass', 2000, 4, sfxBus); },
    event(t, o) {
      hiss(t, 0.6, 0.3, 'bandpass', 300, 3, sfxBus, 4000);
      if (o && (o.name === 'glitchstorm' || o.name === 'scramble')) glitchBurst(t + 0.05, sfxBus);
      if (o && o.name === 'freeze') { tone('sine', 880, t, 0.002, 0.6, 0.1, sfxBus, 40, 0.5); }
    },
    ui(t) { tone('sine', 520, t, 0.002, 0.06, 0.08, sfxBus); },
    // a shard landing on the floor: real glass, pitched by how small it is, louder the harder it hits
    tinkle(t, o) {
      if (limitedN('tinkle', 260, 10)) return;
      const v = (o && o.v) || 0.5, size = (o && o.size) || 0.05;
      const name = v > 1.6 ? pickOf(['glass_breaking_02', 'glass_breaking_05', 'glass_falling_01']) : v > 0.8 ? pickOf(['glass_falling_01', 'glass_falling_03', 'glass_falling_04', 'glass_hit_01']) : pickOf(['glass_hit_01', 'glass_hit_02', 'glass_falling_03']);
      if (!play(name, t + Math.random() * 0.01, { rate: (size < 0.03 ? 1.35 : size < 0.07 ? 1.12 : 0.95) * (0.9 + Math.random() * 0.25), gain: Math.min(0.7, 0.1 + v * 0.28), pan: (o && o.pan) || 0, verb: 0.25 }))
        tone('sine', 2500 + Math.random() * 4000, t, 0.001, 0.08, 0.05 * Math.min(1, v), sfxBus);
    },
    // a bead of mercury snapping off the blob
    drip(t) { if (limited('drip', 900)) return; tone('sine', 480 + Math.random() * 220, t, 0.002, 0.07, 0.04, verbSend, 1500, 0.04); },
  };
  function sfx(name, o) {
    if (!ctx || ctx.state !== 'running' || sfxVol <= 0.001) return;
    const f = SFX[name];
    if (!f) return;
    try { f(ctx.currentTime + 0.005, o); } catch (e) { /* a sound failing is never worth a crash */ }
  }

  function setVolumes(m, s) {
    musicVol = Math.max(0, Math.min(1, +m || 0));
    sfxVol = Math.max(0, Math.min(1, +s || 0));
    if (ctx) sfxBus.gain.setTargetAtTime(sfxVol, ctx.currentTime, 0.05);
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }

  root.HOAUDIO = { init, resume, suspend, setVolumes, update, beat, sfx };
})(typeof window !== 'undefined' ? window : globalThis);
