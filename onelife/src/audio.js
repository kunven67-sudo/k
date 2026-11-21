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
  step(k) { const p = Math.min(6000, 160 / Math.pow(Math.max(k, 1e-4), 0.35)); this.burst(0.09, 'lowpass', p * 4, 0.7, 0.18, 0, false); this.burst(0.04, 'bandpass', p * 10, 1.5, 0.05); }
  land(force) { this.burst(0.3, 'lowpass', 400, 0.7, Math.min(1, 0.2 + force * 0.15), 0, false); }
  crack() { this.burst(0.08, 'highpass', 2500, 0.9, 0.7); this.burst(0.18, 'lowpass', 700, 1, 0.6, 0.01, false); }
  boom() { this.tone(70, 28, 1.4, 'sine', 0.9); this.burst(0.5, 'lowpass', 900, 0.5, 0.9, 0, false); this.burst(0.15, 'highpass', 1800, 0.7, 0.6); }
  spark() { for (let i = 0; i < 7; i++) this.burst(0.03 + Math.random() * 0.05, 'highpass', 3000 + Math.random() * 3000, 1, 0.5, i * 0.03 * Math.random()); this.tone(120, 100, 0.4, 'sawtooth', 0.15); }
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
    if (s.health < 40 && !s.dead) { this.beatT -= dt; if (this.beatT <= 0) { this.beatT = 0.55 + s.health / 80; this.tone(60, 40, 0.15, 'sine', 0.5); this.tone(55, 38, 0.15, 'sine', 0.35, 0.18); } }
  }
}
