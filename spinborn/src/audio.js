// SPINBORN sound: music, wheel clicks, lever, reveal ding + boom, meme sounds, flashbang (bang + ear ring + muffled world).
export class Audio {
  constructor(base = 'assets/') {
    this.base = base; this.ctx = null; this.buf = new Map(); this.music = null; this.musicName = null;
    this.vol = { music: 0.45, sfx: 0.9 }; this.lastTick = 0; this.muffleUntil = 0;
  }
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.lp = this.ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.vol.music; this.musicGain.connect(this.lp);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.vol.sfx; this.sfxGain.connect(this.lp);
      this.rawGain = this.ctx.createGain(); this.rawGain.gain.value = this.vol.sfx; this.rawGain.connect(this.master); // flashbang ring skips the muffle
    }
    if (this.ctx.state === 'suspended') try { await this.ctx.resume(); } catch (e) { }
  }
  setVolume(kind, v) { this.vol[kind] = v; if (!this.ctx) return; (kind === 'music' ? this.musicGain : this.sfxGain).gain.value = v; if (kind === 'sfx') this.rawGain.gain.value = v; }
  async load(path) {
    if (this.buf.has(path)) return this.buf.get(path);
    const p = (async () => {
      try { const r = await fetch(this.base + path); const a = await r.arrayBuffer(); return await this.ctx.decodeAudioData(a); } catch (e) { return null; }
    })();
    this.buf.set(path, p); return p;
  }
  async play(path, { gain = 1, rate = 1, raw = false } = {}) {
    if (!this.ctx) return null;
    const b = await this.load(path); if (!b) return null;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(raw ? this.rawGain : this.sfxGain); s.start();
    return s;
  }
  async playMusic(name) {
    if (!this.ctx || this.musicName === name) return;
    this.musicName = name;
    const b = await this.load(`audio/${name}.mp3`); if (!b || this.musicName !== name) return;
    const now = this.ctx.currentTime;
    if (this.music) { const old = this.music; old.g.gain.setTargetAtTime(0, now, 0.6); setTimeout(() => { try { old.s.stop(); } catch (e) { } }, 3000); }
    const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, now, 0.8);
    s.connect(g); g.connect(this.musicGain); s.start();
    this.music = { s, g };
  }
  duckMusic(on) { if (this.ctx && this.music) this.music.g.gain.setTargetAtTime(on ? 0.25 : 1, this.ctx.currentTime, 0.15); }

  // wheel click: tiny plastic flap (short filtered noise + click), pitch rises as it slows
  tick(slow = 0) {
    if (!this.ctx) return; const now = this.ctx.currentTime;
    if (now - this.lastTick < 0.028) return; this.lastTick = now;
    const n = this.ctx.createBufferSource(); n.buffer = this.noise(0.03);
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400 + slow * 1400; bp.Q.value = 2.2;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.5, now + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    n.connect(bp); bp.connect(g); g.connect(this.sfxGain); n.start(now); n.stop(now + 0.05);
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 900 + slow * 600;
    const og = this.ctx.createGain(); og.gain.setValueAtTime(0.12, now); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    o.connect(og); og.connect(this.sfxGain); o.start(now); o.stop(now + 0.03);
  }
  lever() {
    if (!this.ctx) return; const now = this.ctx.currentTime;
    const n = this.ctx.createBufferSource(); n.buffer = this.noise(0.5);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(300, now); f.frequency.exponentialRampToValueAtTime(2200, now + 0.35);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.35, now + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    n.connect(f); f.connect(g); g.connect(this.sfxGain); n.start(now); n.stop(now + 0.5);
    this.play('audio/impact2.mp3', { gain: 0.5, rate: 1.3 });
  }
  reveal(big = false) {
    this.play('audio/ding.mp3', { gain: big ? 0.9 : 0.55 });
    if (big) this.play('audio/impact1.mp3', { gain: 0.9, rate: 0.8 });
  }
  golden() {
    if (!this.ctx) return; const now = this.ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain(); const t = now + i * 0.07; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + 1.3);
    });
    this.play('audio/ding2.mp3', { gain: 0.8 });
  }
  // flashbang: the sound cut from his videos (bang + ring) + the rest of the world muffled for ~2.4 s
  flashbang() {
    if (!this.ctx) return; const now = this.ctx.currentTime;
    this.play('memes/snd/flashbang.mp3', { gain: 1, raw: true });
    this.lp.frequency.cancelScheduledValues(now);
    this.lp.frequency.setValueAtTime(20000, now); this.lp.frequency.exponentialRampToValueAtTime(380, now + 0.25);
    this.lp.frequency.setTargetAtTime(20000, now + 2.0, 0.6);
    this.duckMusic(true); setTimeout(() => this.duckMusic(false), 2600);
  }
  noise(sec) {
    const key = 'noise' + sec; if (this[key]) return this[key];
    const b = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * sec), this.ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this[key] = b; return b;
  }
}
