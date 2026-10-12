// Boombox radio: three generated "stations" sequenced live with Web Audio oscillators.
const STATIONS = [
  { name: 'Lo-Fi 88.1', bpm: 78 },
  { name: 'Rock 101.5', bpm: 132 },
  { name: 'Hip-Hop 97.3', bpm: 92 },
];
export const STATION_NAMES = STATIONS.map((s) => s.name);

const midi = (m) => 440 * 2 ** ((m - 69) / 12);

export class Radio {
  constructor(ac, out) {
    this.ac = ac;
    this.out = ac.createGain();
    this.out.gain.value = 0.55;
    // a little speaker coloration: cheap boombox band-limit
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const lpf = ac.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 7000;
    this.out.connect(hp); hp.connect(lpf); lpf.connect(out);
    this.station = -1;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.dist = ac.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 6); }
    this.dist.curve = curve;
    this.dist.connect(this.out);
  }

  // Cycle: off -> station 1 -> 2 -> 3 -> off
  next() {
    this.station = this.station + 1 >= STATIONS.length ? -1 : this.station + 1;
    if (this.station < 0) { this.stop(); return null; }
    this.step = 0;
    this.nextTime = this.ac.currentTime + 0.05;
    this.staticBurst();
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
    return STATIONS[this.station].name;
  }

  stop() { clearInterval(this.timer); this.timer = null; this.station = -1; }

  staticBurst() {
    const s = this.ac.createBufferSource(); s.buffer = this.noise;
    const g = this.ac.createGain(); g.gain.setValueAtTime(0.25, this.ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, this.ac.currentTime + 0.35);
    s.connect(g); g.connect(this.out); s.start(); s.stop(this.ac.currentTime + 0.4);
  }

  schedule() {
    if (this.station < 0) return;
    const st = STATIONS[this.station];
    const sixteenth = 60 / st.bpm / 4;
    while (this.nextTime < this.ac.currentTime + 0.12) {
      this.play(this.station, this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth * (this.station === 0 && this.step % 2 === 1 ? 1.1 : this.station === 0 ? 0.9 : 1); // lo-fi swing
      this.step++;
    }
  }

  tone(t, f, dur, type, vol, dest = this.out, attack = 0.005, filterHz = 0) {
    const o = this.ac.createOscillator(); o.type = type; o.frequency.value = f;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    if (filterHz) {
      const flt = this.ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = filterHz;
      o.connect(flt); flt.connect(g);
    } else o.connect(g);
    g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  kick(t, vol = 0.9) {
    const o = this.ac.createOscillator(); const g = this.ac.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.4);
  }
  noiseHit(t, dur, hz, vol, type = 'highpass') {
    const s = this.ac.createBufferSource(); s.buffer = this.noise;
    const f = this.ac.createBiquadFilter(); f.type = type; f.frequency.value = hz;
    const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(station, step, t, six) {
    const bar = Math.floor(step / 16), s = step % 16;
    if (station === 0) {
      // Lo-fi: jazzy 7th chords, soft drums, vinyl crackle
      const chords = [[57, 60, 64, 67], [55, 59, 62, 65], [53, 57, 60, 64], [52, 55, 59, 62]];
      const ch = chords[bar % 4];
      if (s === 0 || s === 10) ch.forEach((n) => this.tone(t, midi(n), six * 7, 'triangle', 0.06, this.out, 0.03, 1400));
      if (s === 0 || s === 7 || s === 10) this.kick(t, 0.6);
      if (s === 4 || s === 12) this.noiseHit(t, 0.18, 1500, 0.18, 'bandpass');
      if (s % 2 === 0) this.noiseHit(t, 0.05, 7000, 0.05);
      if (s === 0) this.tone(t, midi(ch[0] - 24), six * 8, 'sine', 0.22, this.out, 0.01);
      if (Math.random() < 0.3) this.noiseHit(t + Math.random() * six, 0.01, 3000, 0.04);
      if (s === 14 && bar % 2 === 1) this.tone(t, midi(ch[3] + 12), six * 3, 'sine', 0.05);
    } else if (station === 1) {
      // Rock: distorted power chords, driving drums
      const roots = [40, 40, 43, 45, 38, 38, 43, 40];
      const r = roots[(bar * 2 + Math.floor(s / 8)) % 8];
      if (s % 2 === 0) [r, r + 7, r + 12].forEach((n) => this.tone(t, midi(n), six * 1.8, 'sawtooth', 0.05, this.dist, 0.003, 2600));
      if (s === 0 || s === 6 || s === 8) this.kick(t, 1);
      if (s === 4 || s === 12) this.noiseHit(t, 0.22, 1200, 0.45, 'bandpass');
      this.noiseHit(t, 0.04, 8000, s % 4 === 2 ? 0.12 : 0.07);
      if (s === 0 && bar % 4 === 0) this.noiseHit(t, 1.2, 5000, 0.2);
      if (s % 2 === 0) this.tone(t, midi(r - 12), six * 1.9, 'square', 0.08, this.out, 0.003, 600);
    } else {
      // Hip-hop: 808 bass, boom-bap drums, dark keys
      const bass = [36, 36, 39, 34];
      const b = bass[bar % 4];
      if (s === 0 || s === 3 || s === 10) {
        const o = this.ac.createOscillator(); const g = this.ac.createGain();
        o.frequency.setValueAtTime(midi(b) * 1.5, t); o.frequency.exponentialRampToValueAtTime(midi(b), t + 0.05);
        g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + six * 5);
        o.connect(g); g.connect(this.out); o.start(t); o.stop(t + six * 5 + 0.05);
        this.kick(t, 0.8);
      }
      if (s === 4 || s === 12) { this.noiseHit(t, 0.25, 1800, 0.5, 'bandpass'); this.tone(t, 190, 0.1, 'triangle', 0.15); }
      if (s % 2 === 0 || (s === 15)) this.noiseHit(t, 0.03, 9000, s % 4 === 0 ? 0.1 : 0.06);
      if (s === 0 && bar % 2 === 0) [b + 24, b + 27, b + 31].forEach((n) => this.tone(t, midi(n), six * 14, 'triangle', 0.045, this.out, 0.02, 1800));
    }
  }
}
