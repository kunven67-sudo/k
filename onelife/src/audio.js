// Sounds made live (no files): wind that follows your speed, steps that get higher-pitched the smaller you are,
// the sonic boom, the suit's shrink whine, heartbeat when you're badly hurt, sparks, bone cracks, deep-realm drones.
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.8; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.out = C.createGain(); this.out.gain.value = this.vol;
    const comp = C.createDynamicsCompressor(); this.out.connect(comp).connect(C.destination);
    const len = C.sampleRate * 2, nb = C.createBuffer(1, len, C.sampleRate), d = nb.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5 + w * 0.15; } // brown-ish noise
    this.noise = nb;
    const wn = C.createBuffer(1, len, C.sampleRate), wd = wn.getChannelData(0); for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1; this.white = wn;
    // wind bed
    const ws = C.createBufferSource(); ws.buffer = nb; ws.loop = true;
    this.windF = C.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 300; this.windF.Q.value = 0.6;
    this.windG = C.createGain(); this.windG.gain.value = 0.05; ws.connect(this.windF).connect(this.windG).connect(this.out); ws.start();
    // suit whine
    this.whine = C.createOscillator(); this.whine.type = 'sawtooth'; this.whineF = C.createBiquadFilter(); this.whineF.type = 'lowpass'; this.whineF.frequency.value = 1200;
    this.whineG = C.createGain(); this.whineG.gain.value = 0; this.whine.connect(this.whineF).connect(this.whineG).connect(this.out); this.whine.start();
    // deep drone
    this.drone = [C.createOscillator(), C.createOscillator()]; this.droneG = C.createGain(); this.droneG.gain.value = 0;
    this.drone.forEach((o, i) => { o.type = 'sine'; o.frequency.value = 55 * (i ? 1.5 : 1); o.connect(this.droneG); o.start(); }); this.droneG.connect(this.out);
    this.beatT = 0;
  }
  set volume(v) { this.vol = v; if (this.out) this.out.gain.value = v; }
  // ---------- real recorded sounds (CC0, assets/sound/CREDITS.txt) ----------
  async loadReal() {
    const C = this.ctx; if (!C || this.real) return; this.real = {};
    const get = async n => { try { const r = await fetch('assets/sound/' + n + '.mp3'); return await C.decodeAudioData(await r.arrayBuffer()); } catch (e) { return null; } };
    const names = ['meadow', 'steps', 'boom', 'zap', 'tuning', 'meteor'];
    const bufs = await Promise.all(names.map(get)); names.forEach((n, i) => this.real[n] = bufs[i]);
    // meadow bed: muffled + slowed the smaller you get, gone when you're past the light
    if (this.real.meadow) {
      const s = C.createBufferSource(); s.buffer = this.real.meadow; s.loop = true; this.amb = s;
      this.ambF = C.createBiquadFilter(); this.ambF.type = 'lowpass'; this.ambF.frequency.value = 18000;
      this.ambG = C.createGain(); this.ambG.gain.value = 0; s.connect(this.ambF).connect(this.ambG).connect(this.out); s.start();
    }
    // cut single footsteps out of the real walking recording (find each step's thump)
    const st = this.real.steps;
    if (st) {
      const d = st.getChannelData(0), win = Math.floor(st.sampleRate * 0.01), env = [];
      for (let i = 0; i + win < d.length; i += win) { let e = 0; for (let j = 0; j < win; j++) e += d[i + j] * d[i + j]; env.push(Math.sqrt(e / win)); }
      const avg = env.reduce((a, b) => a + b, 0) / env.length; this.stepAt = [];
      for (let i = 3; i < env.length - 30; i++) if (env[i] > avg * 2.2 && env[i] > env[i - 1] && env[i] >= env[i + 1] && env[i - 3] < env[i] * 0.6 && (!this.stepAt.length || i * 0.01 - this.stepAt[this.stepAt.length - 1] > 0.35)) this.stepAt.push(Math.max(0, i * 0.01 - 0.03));
    }
    // reality tearing: the meteor blast, slowed way down + played backwards, ring-modulated, always there once you break it
    if (this.real.meteor) {
      const m = this.real.meteor, rev = C.createBuffer(m.numberOfChannels, m.length, m.sampleRate);
      for (let c = 0; c < m.numberOfChannels; c++) rev.getChannelData(c).set(m.getChannelData(c).slice().reverse());
      this.real.meteorRev = rev;
      this.tearG = C.createGain(); this.tearG.gain.value = 0;
      const ring = C.createGain(); ring.gain.value = 0; const mod = C.createOscillator(); mod.frequency.value = 31; mod.connect(ring.gain); mod.start(); this.tearMod = mod;
      const shaper = C.createWaveShaper(); const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6) * (Math.round(x * 6) / 6 * 0.5 + 0.5); } shaper.curve = curve;
      [[m, 0.22], [rev, 0.37], [m, 0.09]].forEach(([b, r]) => { const s = C.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = r; s.connect(ring); s.start(); });
      const sub = C.createOscillator(); sub.type = 'sine'; sub.frequency.value = 23; const subG = C.createGain(); subG.gain.value = 0.6; sub.connect(subG).connect(this.tearG); sub.start(); this.tearSub = sub;
      ring.connect(shaper).connect(this.tearG); this.tearG.connect(this.out);
    }
  }
  play(name, { rate = 1, vol = 1, at = 0, dur = 0, rev = false } = {}) {
    const C = this.ctx, b = this.real?.[rev ? name + 'Rev' : name]; if (!C || !b) return false;
    const s = C.createBufferSource(), g = C.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g).connect(this.out); const t = C.currentTime;
    if (dur) { g.gain.setValueAtTime(vol, t + dur * 0.7 / rate); g.gain.linearRampToValueAtTime(0.0001, t + dur / rate); s.start(t, at, dur + 0.05); } else s.start(t, at);
    return true;
  }
  // one big hit when you tear through: light speed, the Planck floor
  tear() { this.play('meteor', { rate: 0.4, vol: 1 }); this.play('meteor', { rate: 0.7, vol: 0.7, rev: true }); this.tone(400, 18, 2.5, 'sawtooth', 0.35); this.tone(9000, 40, 1.8, 'square', 0.08); }
  zap(big) { if (!this.play('zap', { rate: big ? 0.8 : 1.1 + Math.random() * 0.2, vol: big ? 1 : 0.7 })) this.spark(); }
  // ---------- the radio ----------
  initRadio(list) {
    this.stations = list; this.station = -1;
    this.radioEl = new window.Audio(); this.radioEl.crossOrigin = 'anonymous'; this.radioEl.preload = 'auto';
    const C = this.ctx; if (!C) return;
    const src = C.createMediaElementSource(this.radioEl);
    // a little speaker in the suit's helmet: real radio band (no deep bass, no fizz) + a touch of crackle
    const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    this.radioG = C.createGain(); this.radioG.gain.value = 0.55; src.connect(hp).connect(lp).connect(this.radioG).connect(this.out);
    this.radioEl.addEventListener('ended', () => this.nextSong());
    this.staticG = C.createGain(); this.staticG.gain.value = 0;
    const sn = C.createBufferSource(); sn.buffer = this.white; sn.loop = true; const sf = C.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2500; sf.Q.value = 0.4;
    sn.connect(sf).connect(this.staticG).connect(this.out); sn.start();
  }
  // R = next station: off -> 1 -> 2 -> ... -> off. A real radio: stations keep playing while you're away.
  radioNext() {
    if (!this.stations) return null; this.play('tuning', { at: Math.random() * 2, dur: 0.7, vol: 0.5 });
    this.station = this.station + 1 >= this.stations.length ? -1 : this.station + 1;
    const st = this.stations[this.station];
    if (!st || !st.songs.length) { this.radioEl.pause(); this.staticG.gain.setTargetAtTime(st ? 0.05 : 0, this.ctx.currentTime, 0.05); return st ? st.name + ' - no signal' : 'Radio off'; }
    this.staticG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    st.t0 ??= performance.now() / 1000 - Math.random() * 300; st.i ??= Math.floor(Math.random() * st.songs.length);
    this.playSong(st, true); return st.name;
  }
  playSong(st, catchUp) {
    const el = this.radioEl; el.src = 'assets/sound/radio/' + st.songs[st.i].file;
    el.onloadedmetadata = () => { if (catchUp && isFinite(el.duration)) el.currentTime = ((performance.now() / 1000 - st.t0) % el.duration); el.play().catch(() => {}); el.onloadedmetadata = null; };
    el.load(); this.song = st.songs[st.i].title;
  }
  nextSong() { const st = this.stations?.[this.station]; if (!st) return; st.i = (st.i + 1) % st.songs.length; st.t0 = performance.now() / 1000; this.playSong(st, false); }
  burst(dur, type, freq, q, v, t0 = 0, white = true) {
    const C = this.ctx; if (!C) return; const t = C.currentTime + t0;
    const s = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
    s.buffer = white ? this.white : this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(f0, f1, dur, type, v, t0 = 0) {
    const C = this.ctx; if (!C) return; const t = C.currentTime + t0;
    const o = C.createOscillator(), g = C.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  step(k) {
    // real footsteps: tinier you = lighter + higher (your weight drops with size cubed)
    if (this.stepAt?.length) { const at = this.stepAt[Math.floor(Math.random() * this.stepAt.length)]; this.play('steps', { at, dur: 0.32, rate: Math.min(3.5, Math.pow(Math.max(k, 1e-4), -0.12)) * (0.94 + Math.random() * 0.12), vol: 0.9 * Math.min(1, 0.35 + k) }); return; }
    const p = Math.min(6000, 160 / Math.pow(Math.max(k, 1e-4), 0.35)); this.burst(0.09, 'lowpass', p * 4, 0.7, 0.18, 0, false); this.burst(0.04, 'bandpass', p * 10, 1.5, 0.05);
  }
  land(force) { if (this.stepAt?.length) this.play('steps', { at: this.stepAt[0], dur: 0.4, rate: 0.75, vol: Math.min(1.4, 0.5 + force * 0.2) }); this.burst(0.3, 'lowpass', 400, 0.7, Math.min(1, 0.2 + force * 0.15), 0, false); }
  crack() { this.burst(0.08, 'highpass', 2500, 0.9, 0.7); this.burst(0.18, 'lowpass', 700, 1, 0.6, 0.01, false); }
  boom() { if (!this.play('boom', { vol: 1.2 })) { this.tone(70, 28, 1.4, 'sine', 0.9); this.burst(0.5, 'lowpass', 900, 0.5, 0.9, 0, false); } this.tone(60, 24, 1.6, 'sine', 0.6); }
  spark() { if (this.play('zap', { rate: 0.9 + Math.random() * 0.3, vol: 0.8 })) return; for (let i = 0; i < 7; i++) this.burst(0.03 + Math.random() * 0.05, 'highpass', 3000 + Math.random() * 3000, 1, 0.5, i * 0.03 * Math.random()); this.tone(120, 100, 0.4, 'sawtooth', 0.15); }
  click() { this.burst(0.03, 'bandpass', 3500, 2, 0.25); }
  screw(on) { this.tone(on ? 900 : 1300, on ? 1300 : 900, 0.25, 'triangle', 0.06); this.burst(0.25, 'bandpass', 5000, 3, 0.05); }
  snip() { this.burst(0.05, 'highpass', 5000, 1, 0.5); this.burst(0.04, 'bandpass', 1500, 2, 0.3, 0.02); }
  sizzle() { this.burst(0.6, 'highpass', 4000, 0.5, 0.2); }
  hurt() { this.burst(0.25, 'lowpass', 300, 1, 0.5, 0, false); }
  // called every frame
  update(dt, s) {
    if (!this.ctx) return; const C = this.ctx, t = C.currentTime;
    const v = s.speed; // m/s real
    const wind = Math.min(1, s.fallBH * 0.08 + Math.log10(1 + v) * 0.22 + (s.deep ? 0 : 0.03));
    this.windG.gain.setTargetAtTime(s.menu ? 0.05 : wind * 0.5 * (s.deep ? 0 : 1), t, 0.1);
    this.windF.frequency.setTargetAtTime(200 + Math.min(4000, v * 8 + s.fallBH * 60), t, 0.1);
    this.whineG.gain.setTargetAtTime(s.sizing ? 0.035 : 0, t, 0.05);
    this.whine.frequency.setTargetAtTime(Math.min(4000, 90 * Math.pow(10, -Math.log10(Math.max(s.k, 1e-40)) * 0.06)), t, 0.05);
    this.droneG.gain.setTargetAtTime(s.deep ? 0.06 : 0, t, 0.5);
    this.drone[0].frequency.setTargetAtTime(30 + s.realm * 9, t, 1); this.drone[1].frequency.setTargetAtTime((30 + s.realm * 9) * 1.498, t, 1);
    // real meadow: full outside, muffled + slowed as you shrink, gone in the deep
    if (this.ambG) {
      const lk = -Math.log10(Math.max(s.k, 1e-40));
      this.ambG.gain.setTargetAtTime(s.deep || s.menu ? (s.menu ? 0.25 : 0) : 0.45 * Math.max(0.15, 1 - lk * 0.12), t, 0.3);
      this.ambF.frequency.setTargetAtTime(Math.max(400, 18000 / Math.pow(1 + lk, 1.6)), t, 0.3);
      this.amb.playbackRate.setTargetAtTime(Math.max(0.35, 1 - lk * 0.09), t, 0.4);
    }
    // reality tearing: grows with how far past light speed / past the Planck floor you are
    if (this.tearG) {
      this.tearG.gain.setTargetAtTime(Math.min(0.9, (s.tear || 0) * 0.45), t, 0.15);
      this.tearMod.frequency.setTargetAtTime(20 + (s.tear || 0) * 60 + Math.random() * 30, t, 0.05);
      this.tearSub.frequency.setTargetAtTime(18 + Math.random() * 14, t, 0.08);
    }
    if (s.health < 40 && !s.dead) { this.beatT -= dt; if (this.beatT <= 0) { this.beatT = 0.55 + s.health / 80; this.tone(60, 40, 0.15, 'sine', 0.5); this.tone(55, 38, 0.15, 'sine', 0.35, 0.18); } }
  }
}
