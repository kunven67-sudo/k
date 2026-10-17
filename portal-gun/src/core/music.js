// Original procedural music (no samples, not the show's theme).
// A tiny step sequencer schedules notes slightly ahead of time.
import { audio } from './audio.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// chord = root note + intervals
const CH = (root, ...iv) => iv.map((i) => root + i);

const SONGS = {
  menu: {
    bpm: 100,
    chords: [CH(57, 0, 3, 7, 10, 14), CH(53, 0, 4, 7, 11, 14), CH(48, 0, 4, 7, 11, 16), CH(55, 0, 4, 7, 9, 14)],
    arp: [0, 2, 1, 3, 2, 4, 3, 1],
    arpOct: 12,
    bass: [0, null, null, 0, null, null, 0, null, 0, null, null, 0, null, 7, null, null],
    drums: null,
    lead: [[76, 6], [74, 2], [72, 8], [69, 4], [71, 4], [72, 6], [74, 2], [76, 8], [79, 4], [77, 4]],
    pad: true,
  },
  night: {
    bpm: 70,
    chords: [CH(50, 0, 3, 7, 10, 14), CH(46, 0, 4, 7, 11, 14), CH(53, 0, 4, 7, 11, 14), CH(48, 0, 2, 7, 12, 16)],
    arp: [0, 2, 4, 2, 3, 1, 2, 4],
    arpOct: 24,
    bass: [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null],
    drums: null,
    lead: null,
    pad: true,
    soft: true,
  },
  flight: {
    bpm: 118,
    chords: [CH(52, 0, 3, 7, 10), CH(48, 0, 4, 7, 11), CH(50, 0, 4, 7, 9), CH(47, 0, 3, 7, 10)],
    arp: [0, 1, 2, 3, 2, 1, 0, 2],
    arpOct: 12,
    bass: [0, null, 0, null, 12, null, 0, null, 0, null, 0, 7, null, 12, null, 10],
    drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1] },
    lead: [[79, 4], [78, 4], [76, 8], [74, 4], [76, 4], [71, 8], [72, 6], [74, 2], [76, 8], [64, 8]],
    pad: true,
  },
  house: {
    bpm: 88,
    chords: [CH(53, 0, 4, 7, 11, 14), CH(52, 0, 3, 7, 10), CH(50, 0, 3, 7, 10, 14), CH(48, 0, 4, 7, 11)],
    arp: null,
    keys: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    bass: [0, null, null, null, null, null, 7, null, 0, null, null, 12, null, null, 7, null],
    drums: { kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1] },
    lead: null,
    pad: false,
    lofi: true,
  },
};

export class Music {
  constructor() {
    this.song = null;
    this.name = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.custom = null; // HTMLAudioElement for the player's own song
    this.customName = '';
    this.leadIdx = 0;
    this.leadLeft = 0;
  }

  _fx() {
    const ctx = audio.ctx;
    if (this.bus) return;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.6;
    this.bus.connect(audio.music);
    // echo
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.36;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 2200;
    this.delay.connect(dl).connect(fb).connect(this.delay);
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.35;
    this.delaySend.connect(this.delay);
    this.delay.connect(this.bus);
    // reverb
    const len = ctx.sampleRate * 2.6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    this.verbSend = ctx.createGain();
    this.verbSend.gain.value = 0.5;
    this.verbSend.connect(this.verb).connect(this.bus);
  }

  play(name) {
    if (this.name === name) return;
    this.name = name;
    if (this.custom) return; // the player's own song wins
    this._start();
  }

  _start() {
    this.stopSequencer();
    if (!audio.ctx || !this.name || !SONGS[this.name]) return;
    this._fx();
    this.song = SONGS[this.name];
    this.step = 0;
    this.leadIdx = 0;
    this.leadLeft = 0;
    this.nextTime = audio.t + 0.15;
    this.timer = setInterval(() => this._schedule(), 30);
  }

  stopSequencer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  stop() {
    this.stopSequencer();
    this.name = null;
  }

  /** Play a song file the player picked from their own computer. Never uploaded anywhere. */
  setCustom(file) {
    this.clearCustom();
    const url = URL.createObjectURL(file);
    const el = new Audio(url);
    el.loop = true;
    el.volume = Math.min(1, audio.volumes.music * audio.volumes.master * 1.2);
    el.play().catch(() => {});
    this.custom = el;
    this.customUrl = url;
    this.customName = file.name;
    this.stopSequencer();
  }

  clearCustom() {
    if (this.custom) {
      this.custom.pause();
      URL.revokeObjectURL(this.customUrl);
    }
    this.custom = null;
    this.customName = '';
    if (this.name) this._start();
  }

  syncVolume() {
    if (this.custom) this.custom.volume = Math.min(1, audio.volumes.music * audio.volumes.master * 1.2);
  }

  pauseCustom(p) {
    if (!this.custom) return;
    if (p) this.custom.pause();
    else this.custom.play().catch(() => {});
  }

  _schedule() {
    const s = this.song;
    if (!s || !audio.ctx) return;
    const stepDur = 60 / s.bpm / 4;
    while (this.nextTime < audio.t + 0.12) {
      this._playStep(s, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  _playStep(s, step, t, sd) {
    const bar = Math.floor(step / 16) % s.chords.length;
    const i = step % 16;
    const chord = s.chords[bar];
    if (i === 0 && s.pad) this._pad(chord, t, sd * 16, s.soft ? 0.05 : 0.07);
    if (s.arp && i % 2 === 0) {
      const idx = s.arp[(i / 2) % s.arp.length] % chord.length;
      this._pluck(chord[idx] + s.arpOct, t, s.soft ? 0.05 : 0.06);
    }
    if (s.keys && s.keys[i]) {
      for (const n of chord.slice(0, 4)) this._keys(n + 12, t, sd * 2.5);
    }
    if (s.bass && s.bass[i] !== null && s.bass[i] !== undefined) this._bass(chord[0] - 12 + s.bass[i], t, sd * 1.8, s.soft ? 0.12 : 0.18);
    if (s.drums) {
      if (s.drums.kick[i]) this._kick(t);
      if (s.drums.snare[i]) this._snare(t, s.lofi);
      if (s.drums.hat[i]) this._hat(t, i % 4 === 2 ? 0.05 : 0.03);
    }
    if (s.lead && i % 2 === 0) {
      if (this.leadLeft <= 0) {
        const [note, len] = s.lead[this.leadIdx % s.lead.length];
        this.leadIdx++;
        this.leadLeft = len;
        this._lead(note, t, len * sd * 2);
      }
      this.leadLeft -= 1;
    }
  }

  _voice(type, f, t, dur, gain, { attack = 0.01, release = 0.2, detune = 0, filter = null, send = 0.3, verb = 0.2 } = {}) {
    const ctx = audio.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
    let n = o.connect(g);
    if (filter) {
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = filter;
      n = n.connect(f2);
    }
    n.connect(this.bus);
    if (send) {
      const sg = ctx.createGain();
      sg.gain.value = send;
      n.connect(sg).connect(this.delaySend);
    }
    if (verb) {
      const vg = ctx.createGain();
      vg.gain.value = verb;
      n.connect(vg).connect(this.verbSend);
    }
    o.start(t);
    o.stop(t + dur + release + 0.05);
    return o;
  }

  _pad(chord, t, dur, gain) {
    for (const n of chord.slice(0, 4)) {
      this._voice('sawtooth', midi(n), t, dur, gain * 0.35, { attack: 0.8, release: 1.2, detune: -7, filter: 900, send: 0, verb: 0.6 });
      this._voice('sawtooth', midi(n), t, dur, gain * 0.35, { attack: 0.8, release: 1.2, detune: 7, filter: 900, send: 0, verb: 0.6 });
    }
  }

  _pluck(n, t, gain) {
    this._voice('triangle', midi(n), t, 0.05, gain, { attack: 0.004, release: 0.35, send: 0.6, verb: 0.3 });
    this._voice('sine', midi(n + 12), t, 0.03, gain * 0.4, { attack: 0.003, release: 0.25, send: 0.4, verb: 0.2 });
  }

  _keys(n, t, dur) {
    this._voice('triangle', midi(n), t, dur, 0.035, { attack: 0.01, release: 0.4, send: 0.15, verb: 0.35, filter: 1800 });
    this._voice('sine', midi(n) * 2.01, t, dur * 0.4, 0.012, { attack: 0.005, release: 0.2, send: 0, verb: 0.2 });
  }

  _bass(n, t, dur, gain) {
    this._voice('sine', midi(n), t, dur, gain, { attack: 0.01, release: 0.12, send: 0, verb: 0 });
    this._voice('square', midi(n), t, dur, gain * 0.18, { attack: 0.01, release: 0.1, send: 0, verb: 0, filter: 500 });
  }

  _lead(n, t, dur) {
    // theremin-ish: wobbly sine sliding into the note
    const ctx = audio.ctx;
    const o = this._voice('sine', midi(n), t, dur * 0.9, 0.05, { attack: 0.12, release: 0.3, send: 0.45, verb: 0.5 });
    o.frequency.setValueAtTime(midi(n - 1), t);
    o.frequency.exponentialRampToValueAtTime(midi(n), t + 0.12);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = midi(n) * 0.012;
    vib.connect(vg).connect(o.frequency);
    vib.start(t);
    vib.stop(t + dur + 0.4);
  }

  _kick(t) {
    const ctx = audio.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  _snare(t, lofi) {
    const ctx = audio.ctx;
    const s = ctx.createBufferSource();
    s.buffer = audio.noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = lofi ? 'bandpass' : 'highpass';
    f.frequency.value = lofi ? 1800 : 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(lofi ? 0.12 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (lofi ? 0.12 : 0.18));
    s.connect(f).connect(g).connect(this.bus);
    const vg = ctx.createGain();
    vg.gain.value = 0.15;
    g.connect(vg).connect(this.verbSend);
    s.start(t, Math.random());
    s.stop(t + 0.2);
  }

  _hat(t, gain) {
    const ctx = audio.ctx;
    const s = ctx.createBufferSource();
    s.buffer = audio.noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(this.bus);
    s.start(t, Math.random());
    s.stop(t + 0.06);
  }
}

export const music = new Music();
