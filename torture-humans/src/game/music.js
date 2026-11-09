// Music, composed on the fly (no files): endless songs in four styles, picked in
// Settings > Sound. Chords follow a progression, the melody remembers its
// motifs (so it sounds like a tune, not random notes), sections change every
// 8 bars. The mood follows the game: calmer at night, tense and faster when the
// police are chasing you.
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

const STYLES = {
  goofy: { bpm: 118, scale: MAJOR, root: 60, progs: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3]], swing: 0, lead: 'marimba', bass: 'pluck', drums: 'bouncy', pad: false },
  lofi: { bpm: 76, scale: MAJOR, root: 57, progs: [[1, 4, 0, 5], [3, 2, 1, 4], [5, 1, 4, 0]], swing: 0.18, lead: 'keys', bass: 'soft', drums: 'lofi', pad: 'keys7', crackle: true },
  chiptune: { bpm: 140, scale: MAJOR, root: 64, progs: [[0, 5, 3, 4], [5, 3, 0, 4], [0, 4, 5, 3]], swing: 0, lead: 'square', bass: 'triangle', drums: 'noise', arp: true },
  epic: { bpm: 88, scale: MINOR, root: 50, progs: [[0, 5, 2, 6], [0, 3, 4, 4], [5, 3, 0, 4]], swing: 0, lead: 'brass', bass: 'strings', drums: 'taiko', pad: 'strings' },
};

export class Music {
  constructor(audio) {
    this.a = audio;
    this.style = null;
    this.mood = 'day';
    this.next = 0;      // time of the next 16th note
    this.step = 0;      // 16th notes since the song started
    this.section = 0;
  }

  get ctx() { return this.a.ctx; }

  setStyle(name) {
    if (name === this.style) return;
    this.style = name;
    this.newSong();
  }

  newSong() {
    const s = STYLES[this.style];
    if (!s) return;
    this.key = s.root + pick([0, 2, -3, 5, -2]);
    this.prog = pick(s.progs);
    this.motifs = [this.makeMotif(), this.makeMotif()];
    this.step = 0;
    this.section = 0;
    if (this.ctx) this.next = this.ctx.currentTime + 0.1;
  }

  // a 2-bar melody shape: scale degrees + rhythm (16ths), reused and varied
  makeMotif() {
    const notes = [];
    let deg = pick([0, 2, 4]);
    for (let i = 0; i < 32; i++) {
      const strong = i % 4 === 0;
      if (Math.random() < (strong ? 0.75 : 0.28)) {
        deg += pick([-2, -1, -1, 0, 1, 1, 2, 3, -3]);
        deg = Math.max(-3, Math.min(9, deg));
        notes.push({ at: i, deg, len: pick([1, 2, 2, 3, 4]) });
      }
    }
    return notes;
  }

  noteOf(deg, octave = 0) {
    const sc = STYLES[this.style].scale;
    const o = Math.floor(deg / 7);
    const d = ((deg % 7) + 7) % 7;
    return this.key + sc[d] + 12 * (o + octave);
  }

  // ---- instruments (all synthesized)

  out(gain, when, dur, pan = 0) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    let node = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(this.a.bus.music);
    return g;
  }

  osc(type, freq, when, dur, gain, { attack = 0.005, release = null, detune = 0, filter = null, pan = 0, glide = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, when + dur);
    o.detune.value = detune;
    const g = this.out(gain, when, dur, pan);
    const rel = release ?? dur;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + rel);
    let src = o;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(filter[0], when); f.frequency.exponentialRampToValueAtTime(filter[1], when + attack + rel); src.connect(f); src = f; }
    src.connect(g);
    o.start(when);
    o.stop(when + attack + rel + 0.05);
  }

  noise(when, dur, gain, { type = 'highpass', freq = 6000, q = 0.7, pan = 0 } = {}) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.a.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.out(gain, when, dur, pan);
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f); f.connect(g);
    s.start(when, Math.random() * 0.5, dur + 0.05);
  }

  lead(n, when, dur, vel) {
    const s = STYLES[this.style];
    const f = midi(n);
    if (s.lead === 'marimba') {
      this.osc('sine', f, when, 0.35, 0.16 * vel, { release: 0.35, pan: 0.15 });
      this.osc('sine', f * 4, when, 0.06, 0.04 * vel, { release: 0.06, pan: 0.15 });
    } else if (s.lead === 'keys') {
      this.osc('sine', f, when, dur, 0.1 * vel, { attack: 0.01, release: dur + 0.4, pan: -0.1 });
      this.osc('triangle', f * 2, when, dur, 0.025 * vel, { attack: 0.01, release: dur * 0.5, detune: 6 });
    } else if (s.lead === 'square') {
      this.osc('square', f, when, dur, 0.05 * vel, { attack: 0.002, release: dur * 0.9, filter: [5000, 2500] });
    } else if (s.lead === 'brass') {
      this.osc('sawtooth', f, when, dur, 0.06 * vel, { attack: 0.06, release: dur + 0.15, filter: [600, 2400], detune: -4 });
      this.osc('sawtooth', f, when, dur, 0.05 * vel, { attack: 0.06, release: dur + 0.15, filter: [600, 2400], detune: 5 });
    }
  }

  bass(n, when, dur) {
    const s = STYLES[this.style];
    const f = midi(n - 24);
    if (s.bass === 'pluck') this.osc('square', f, when, 0.18, 0.09, { release: 0.18, filter: [1200, 200] });
    else if (s.bass === 'soft') this.osc('sine', f, when, dur, 0.16, { attack: 0.02, release: dur });
    else if (s.bass === 'triangle') this.osc('triangle', f, when, dur * 0.8, 0.14, { release: dur * 0.8 });
    else if (s.bass === 'strings') {
      this.osc('sawtooth', f, when, dur, 0.05, { attack: 0.25, release: dur, filter: [400, 300], detune: -6 });
      this.osc('sawtooth', f * 2, when, dur, 0.035, { attack: 0.3, release: dur, filter: [700, 500], detune: 7 });
    }
  }

  chord(degs, when, dur) {
    const s = STYLES[this.style];
    if (s.pad === 'keys7') for (const d of degs) this.osc('sine', midi(this.noteOf(d, -1)), when, dur, 0.035, { attack: 0.02, release: dur + 0.3 });
    else if (s.pad === 'strings') for (const [i, d] of degs.entries()) this.osc('sawtooth', midi(this.noteOf(d, -1)), when, dur, 0.022, { attack: 0.5, release: dur + 0.4, filter: [900, 700], detune: (i - 1) * 8 });
  }

  drums(i, when, intense) {
    const s = STYLES[this.style];
    const b = i % 16;
    if (s.drums === 'bouncy') {
      if (b % 8 === 0) this.osc('sine', 120, when, 0.15, 0.4, { glide: 45, release: 0.15 });           // boom
      if (b % 8 === 4) this.noise(when, 0.12, 0.12, { type: 'bandpass', freq: 1800, q: 0.8 });           // clap
      if (b % 2 === 0) this.noise(when, 0.03, 0.03 + (intense ? 0.03 : 0));                              // tick
      if (b === 14 && Math.random() < 0.4) this.osc('sine', 600, when, 0.08, 0.1, { glide: 1400, release: 0.08 }); // boing
    } else if (s.drums === 'lofi') {
      if (b === 0 || b === 10) this.osc('sine', 90, when, 0.2, 0.32, { glide: 40, release: 0.2 });
      if (b === 4 || b === 12) this.noise(when, 0.14, 0.07, { type: 'bandpass', freq: 1400, q: 0.6 });
      if (b % 2 === 0) this.noise(when, 0.025, 0.018);
    } else if (s.drums === 'noise') {
      if (b % 4 === 0) this.osc('square', 110, when, 0.08, 0.12, { glide: 40, release: 0.08 });
      if (b % 8 === 4) this.noise(when, 0.08, 0.1, { type: 'highpass', freq: 2000 });
      if (b % 2 === 1 || intense) this.noise(when, 0.02, 0.03);
    } else if (s.drums === 'taiko') {
      if (b === 0 || b === 6 || (intense && b % 4 === 0)) this.osc('sine', 75, when, 0.5, 0.45, { glide: 38, release: 0.5 });
      if (b === 12) { this.osc('sine', 140, when, 0.25, 0.2, { glide: 70, release: 0.25 }); this.noise(when, 0.2, 0.05, { type: 'lowpass', freq: 800 }); }
    }
  }

  // schedule a 16th note
  play16(i, when) {
    const s = STYLES[this.style];
    const night = this.mood === 'night', chase = this.mood === 'chase';
    const bar = Math.floor(i / 16), beat16 = i % 16;
    const chordDeg = this.prog[bar % this.prog.length];
    const tri = [chordDeg, chordDeg + 2, chordDeg + 4, chordDeg + 6];
    const spb = 60 / this.bpm / 4; // seconds per 16th
    // a new section every 8 bars: swap motif, sometimes a breakdown (drums out)
    if (beat16 === 0 && bar % 8 === 0 && bar > 0) {
      this.section++;
      if (this.section % 3 === 0) this.motifs[this.section % 2] = this.makeMotif();
      if (this.section % 4 === 0) this.prog = pick(s.progs);
    }
    const breakdown = this.section % 4 === 3;
    if (beat16 === 0) {
      this.bass(this.noteOf(chordDeg), when, spb * 7);
      this.chord(tri.slice(0, s.pad === 'keys7' ? 4 : 3), when, spb * 16);
    }
    if (s.bass === 'pluck' && beat16 === 8) this.bass(this.noteOf(chordDeg + 4), when, spb * 4);
    if (s.bass === 'triangle' && beat16 % 4 === 2) this.bass(this.noteOf(chordDeg + (beat16 === 10 ? 4 : 0)), when, spb * 2);
    if (!breakdown && !(night && beat16 % 4 !== 0)) this.drums(i, when, chase);
    // chiptune arpeggio
    if (s.arp && beat16 % 2 === 0) this.osc('square', midi(this.noteOf(tri[(beat16 / 2) % 3], 1)), when, spb, 0.02, { release: spb * 0.9 });
    // the melody: the motif of this half-section, varied a little on repeats
    if (!(night && Math.random() < 0.4)) {
      const m = this.motifs[(Math.floor(bar / 4)) % 2];
      const pos = i % 32;
      for (const n of m) {
        if (n.at !== pos) continue;
        const vary = this.section % 2 && Math.random() < 0.25 ? pick([-1, 1, 2]) : 0;
        // fit the melody to the chord on strong beats
        let deg = n.deg + vary;
        if (pos % 4 === 0) deg = tri.reduce((best, c) => (Math.abs(c - deg) < Math.abs(best - deg) ? c : best), tri[0]);
        this.lead(this.noteOf(deg, s.lead === 'brass' ? 0 : 1), when, spb * n.len, pos % 4 === 0 ? 1 : 0.75);
      }
    }
    // vinyl crackle (lo-fi)
    if (s.crackle && Math.random() < 0.5) this.noise(when + Math.random() * spb, 0.01, 0.012, { type: 'highpass', freq: 3000 });
  }

  get bpm() {
    const s = STYLES[this.style];
    return s.bpm * (this.mood === 'chase' ? 1.18 : this.mood === 'night' ? 0.88 : 1);
  }

  update({ style, mood }) {
    if (!this.ctx || !this.a.bus?.music) return;
    if (mood) this.mood = mood;
    if (style !== this.style) this.setStyle(style);
    if (!STYLES[this.style]) return;
    const now = this.ctx.currentTime;
    if (this.next < now) this.next = now + 0.05; // fell behind (tab hidden): skip ahead, don't burst
    while (this.next < now + 0.25) {
      const s = STYLES[this.style];
      const spb = 60 / this.bpm / 4;
      const swing = s.swing && this.step % 2 === 1 ? spb * s.swing : 0;
      this.play16(this.step, this.next + swing);
      this.step++;
      this.next += spb;
      if (this.step > 16 * 64) this.newSong(); // a new song every 64 bars
    }
  }
}
