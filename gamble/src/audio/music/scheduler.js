// Lookahead note scheduler ("A Tale of Two Clocks" pattern): a coarse JS timer asks the track for
// whole bars a little ahead of the audio clock and schedules every note sample-accurately as a
// BufferSource on the Web Audio timeline. Swing and humanisation are applied here, so tracks can
// write straight eighths.

import { noteBuffer, INSTRUMENTS } from './instruments.js';

// Damper / release time constants (s) applied at note-off for instruments that ring naturally.
const RELEASE = { rhodes: 0.07, vibes: 0.35, bass: 0.06, guitar: 0.12 };
// Players sit slightly behind or ahead of the beat (s): bass pushes, lead lays back.
const FEEL = { bass: -0.006, trumpet: 0.014, vibes: 0.01, steel: 0.012, ride: -0.004 };

export class Scheduler {
  /**
   * @param ctx   BaseAudioContext (realtime or Offline)
   * @param dest  AudioNode the band plays into
   * @param track a player from TRACKS[id]()
   */
  constructor(ctx, dest, track) {
    this.ctx = ctx;
    this.dest = dest;
    this.track = track;
    this.barTime = 0;
    this.bar = 0;
    this.live = []; // { src, end } for cancelling on stop
    this.timer = null;
    this.pans = new Map(); // shared StereoPanner per pan value
  }

  /** Map straight beat positions to swung time: the off-eighth lands at `swing` of the beat. */
  swingT(at) {
    const s = this.track.swing;
    const b = Math.floor(at);
    const f = at - b;
    return b + (f < 0.5 ? (f / 0.5) * s : s + ((f - 0.5) / 0.5) * (1 - s));
  }

  _panNode(p) {
    const k = Math.round(p * 20) / 20;
    let n = this.pans.get(k);
    if (!n) {
      n = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
      if (n.pan) n.pan.value = k;
      n.connect(this.dest);
      this.pans.set(k, n);
    }
    return n;
  }

  /** Schedule all bars that start before `until` (audio-clock seconds). */
  pump(until) {
    const ctx = this.ctx;
    const tr = this.track;
    const spb = 60 / tr.bpm;
    while (this.barTime < until) {
      const { events } = tr.nextBar();
      for (const e of events) {
        const I = INSTRUMENTS[e.inst];
        if (!I) continue;
        const durS = e.dur * spb;
        const buf = noteBuffer(ctx, e.inst, e.midi, e.vel, durS);
        if (!buf) continue;
        const human = (Math.random() - 0.5) * (I.drum ? 0.008 : 0.016) + (FEEL[e.inst] ?? 0);
        const t = Math.max(ctx.currentTime + 0.005, this.barTime + this.swingT(e.at) * spb + human);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        if (tr.detune && !I.drum) src.detune.value = (Math.random() - 0.5) * 2 * tr.detune;
        const g = ctx.createGain();
        const level = Math.pow(e.vel, 1.4) * (tr.mix?.[e.inst] ?? 0.5) * (0.92 + Math.random() * 0.16);
        g.gain.value = level;
        let end = t + buf.duration;
        const rel = RELEASE[e.inst];
        if (rel && t + durS < end) {
          g.gain.setValueAtTime(level, t + durS);
          g.gain.setTargetAtTime(0, t + durS, rel);
          end = Math.min(end, t + durS + rel * 6);
        }
        src.connect(g).connect(this._panNode(e.pan ?? 0));
        src.start(t);
        src.stop(end);
        this.live.push({ src, g, end });
      }
      this.barTime += 4 * spb;
      this.bar++;
    }
    const now = ctx.currentTime;
    if (this.live.length > 64) this.live = this.live.filter((n) => n.end > now);
  }

  /** Start in real time: first bar at `when`, refilled every 200 ms with 1.5 s lookahead. */
  start(when) {
    this.barTime = when;
    this.pump(this.ctx.currentTime + 1.5);
    this.timer = setInterval(() => this.pump(this.ctx.currentTime + 1.5), 200);
  }

  /** Stop scheduling; already-queued notes are cut at `at` (audio time). */
  stop(at = this.ctx.currentTime) {
    clearInterval(this.timer);
    this.timer = null;
    for (const n of this.live) {
      try {
        n.src.stop(Math.max(at, this.ctx.currentTime));
      } catch {
        /* not started / already stopped */
      }
    }
    this.live = [];
  }
}
