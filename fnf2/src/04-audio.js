// FNF 2 - audio: plays FNF's real music + sounds through WebAudio.
// Songs = instrumental + one track per singer's voice, all started on the same
// audio-clock tick so they stay locked together (the song position comes from the clock).
G.audio = (function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = null; }
  const A = { ctx, ready: !!ctx };
  if (!ctx) return Object.assign(A, { unlock() {}, update() {}, sfx() {}, applyVolumes() {}, music: { play() {}, stop() {}, time: () => G.time * 1000, current: () => null, setVolume() {} }, song: () => null });
  const master = ctx.createGain(); master.connect(ctx.destination);
  const bus = { music: ctx.createGain(), vocals: ctx.createGain(), sfx: ctx.createGain() };
  for (const k in bus) bus[k].connect(master);
  A.bus = bus;
  // the song's instrumental also feeds an analyser (Nene's A-Bot visualizer bars)
  A.analyser = ctx.createAnalyser(); A.analyser.fftSize = 1024; A.analyser.smoothingTimeConstant = 0.5;
  A.applyVolumes = function () {
    const v = G.settings.vol;
    master.gain.value = v.master; bus.music.gain.value = v.music; bus.vocals.gain.value = v.vocals; bus.sfx.gain.value = v.sfx;
  };
  A.applyVolumes();
  A.unlock = function () { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
  A.latency = () => ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000;

  // ---- sound effects (path = packed asset path, e.g. "preload/sounds/scrollMenu.ogg")
  A.sfx = function (path, o) {
    o = o || {};
    if (!path.includes('/')) path = SFX[path] || path;
    G.A.audio(path).then(buf => {
      if (!buf) return;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = o.vol == null ? 1 : o.vol;
      src.connect(g); g.connect(bus.sfx); src.start();
    });
  };
  // short names used around the game
  const SFX = {
    fav: 'preload/sounds/fav.ogg', unfav: 'preload/sounds/unfav.ogg',
    scroll: 'preload/sounds/scrollMenu.ogg', confirm: 'preload/sounds/confirmMenu.ogg', cancel: 'preload/sounds/cancelMenu.ogg',
    miss1: 'shared/sounds/missnote1.ogg', miss2: 'shared/sounds/missnote2.ogg', miss3: 'shared/sounds/missnote3.ogg',
    intro3: 'shared/sounds/gameplay/countdown/funkin/introTHREE.ogg', intro2: 'shared/sounds/gameplay/countdown/funkin/introTWO.ogg',
    intro1: 'shared/sounds/gameplay/countdown/funkin/introONE.ogg', introGo: 'shared/sounds/gameplay/countdown/funkin/introGO.ogg',
    death: 'shared/sounds/gameplay/gameover/fnf_loss_sfx.ogg', deathPico: 'shared/sounds/gameplay/gameover/fnf_loss_sfx-pico.ogg',
  };
  A.SFX = SFX;
  A.preload = list => Promise.all(list.map(p => G.A.audio(SFX[p] || p)));

  // ---- one looping/one-shot music track (menus, pause, game over)
  const M = { src: null, gain: null, id: null, bpm: 102, start: 0, dur: 0, loop: true, vol: 1 };
  A.music = {
    play(path, o) {
      o = o || {};
      if (M.id === path && M.src && !o.restart) { if (o.vol != null) this.setVolume(o.vol, 0.3); return; }
      this.stop(o.fadeOutOld || 0);
      M.id = path; M.bpm = o.bpm || 102; M.loop = o.loop !== false; M.vol = o.vol == null ? 1 : o.vol;
      const token = M.token = {};
      G.A.audio(path).then(buf => {
        if (!buf || M.token !== token) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = M.loop;
        const g = ctx.createGain(); src.connect(g); g.connect(bus.music);
        const t = ctx.currentTime;
        if (o.fadeIn) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(M.vol, t + o.fadeIn); } else g.gain.value = M.vol;
        // offset/end in seconds: start partway in, and loop only that part (freeplay song previews)
        // randomStart: start somewhere in the first part but still loop the whole track (pause music)
        const off = o.randomStart ? Math.random() * buf.duration * o.randomStart : Math.max(0, Math.min(buf.duration - 0.05, o.offset || 0));
        const end = o.end && o.end > off + 1 ? Math.min(o.end, buf.duration) : 0;
        if (M.loop && !o.randomStart && (off || end)) { src.loopStart = off; src.loopEnd = end || buf.duration; }
        if (o.onEnd) src.onended = () => { if (M.src === src) { M.src = null; M.id = null; o.onEnd(); } };
        src.start(t, off); M.src = src; M.gain = g; M.start = t - off; M.dur = buf.duration;
        M.loopA = M.loop && !o.randomStart ? off : 0; M.loopB = M.loop ? (end || buf.duration) : buf.duration;
      });
    },
    stop(fade) {
      M.token = null;
      if (!M.src) { M.id = null; return; }
      const s = M.src, g = M.gain, t = ctx.currentTime;
      if (fade) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + fade); s.stop(t + fade + 0.05); }
      else try { s.stop(); } catch (e) {}
      M.src = null; M.id = null;
    },
    setVolume(v, fade) { M.vol = v; if (!M.gain) return; const t = ctx.currentTime; M.gain.gain.cancelScheduledValues(t); M.gain.gain.setValueAtTime(M.gain.gain.value, t); M.gain.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + (fade || 0.01)); },
    current() { return M.src ? { id: M.id, bpm: M.bpm } : null; },
    // playback speed (pitch goes with it, like FlxSound.pitch)
    setRate(r, fade) { if (!M.src) return; const p = M.src.playbackRate, t = ctx.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(r, t + (fade || 0.01)); },
    duration() { return M.dur || 0; },
    time() {
      if (!M.src) return 0; let t = (ctx.currentTime - M.start) * 1000 - A.latency(); if (t < 0) return 0;
      if (M.loop && M.dur) { const a = (M.loopA || 0) * 1000, b = (M.loopB || M.dur) * 1000; if (t >= b) t = a + (t - b) % (b - a); }
      return t;
    },  // never wrap the first few ms of latency to the end of the loop
  };

  // ---- songs: {inst, voices:[{path, who:'p'|'o'}]} -> handle
  A.song = async function (def) {
    const inst = await G.A.audio(def.inst);
    const vbufs = await Promise.all((def.voices || []).map(v => G.A.audio(v.path)));
    const tracks = [];
    if (inst) tracks.push({ buf: inst, who: 'inst', vol: 1, bus: bus.music });
    (def.voices || []).forEach((v, i) => { if (vbufs[i]) tracks.push({ buf: vbufs[i], who: v.who, vol: 1, bus: bus.vocals }); });
    const length = inst ? inst.duration * 1000 : Math.max(0, ...vbufs.filter(Boolean).map(b => b.duration * 1000));
    const H = {
      length, rate: def.rate || 1, paused: true, ended: false, pos: 0, t0: 0,
      _play(posMs) {
        this._stopNodes();
        const now = ctx.currentTime;
        // t0 = audio-clock time of song position 0
        this.t0 = now - posMs / 1000 / this.rate;
        for (const tr of tracks) {
          const g = ctx.createGain(); g.gain.value = tr.vol; g.connect(tr.bus);
          if (tr.who === 'inst') g.connect(A.analyser);
          const s = ctx.createBufferSource(); s.buffer = tr.buf; s.playbackRate.value = this.rate; s.connect(g);
          if (posMs >= 0) s.start(now, posMs / 1000); else s.start(now - posMs / 1000 / this.rate, 0);
          tr.src = s; tr.gain = g;
        }
        this.paused = false; A.songPlaying = true;
      },
      _stopNodes() { A.songPlaying = false; for (const tr of tracks) { if (tr.src) { try { tr.src.stop(); } catch (e) {} tr.src.disconnect(); tr.src = null; } } },
      play(posMs) { this.ended = false; this._play(posMs || 0); },
      time() {
        if (this.paused) return this.pos;
        const t = (ctx.currentTime - this.t0) * 1000 * this.rate - A.latency();
        if (t >= this.length && !this.ended) this.ended = true;
        return t;
      },
      pause() { if (this.paused) return; this.pos = this.time() + A.latency(); this._stopNodes(); this.paused = true; },
      resume() { if (!this.paused) return; this._play(this.pos); },
      seek(ms) { if (this.paused) this.pos = ms; else this._play(ms); },
      stop() { this._stopNodes(); this.paused = true; },
      // FNF: player vocals mute on a miss, come back on the next hit
      setVolume(who, v) {
        for (const tr of tracks) if (tr.who === who) { tr.vol = v; if (tr.gain) { const t = ctx.currentTime; tr.gain.gain.cancelScheduledValues(t); tr.gain.gain.setValueAtTime(tr.gain.gain.value, t); tr.gain.gain.linearRampToValueAtTime(v, t + 0.01); } }
      },
      hasVoices: tracks.some(t => t.who !== 'inst'),
    };
    return H;
  };
  A.update = function () {};
  // resume the context on the first gesture (mobile browsers start it suspended)
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, () => A.unlock(), { passive: true });
  return A;
})();
G.sfx = function (name, o) { try { if (G.audio) G.audio.sfx(name, o); } catch (e) { console.warn(e); } };
