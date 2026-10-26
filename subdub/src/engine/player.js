// Plays a FileDub in sync with a (muted) <video>: background track per piece + every English line at its exact time.
import { PIECE } from './filedub.js';

export class DubPlayer extends EventTarget {
  constructor(video, dub, settings) {
    super();
    this.v = video; this.dub = dub; this.settings = settings;
    this.ctx = new AudioContext({ latencyHint: 'playback' });
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.bgGain = this.ctx.createGain(); this.bgGain.connect(this.master);
    this.voGain = this.ctx.createGain(); this.voGain.connect(this.master);
    this.bufs = new Map();      // piece index -> {ab, ver}
    this.dirty = new Map();     // piece index -> version
    this.playing = []; this.sched = null; this.waiting = false;
    this.lineSrc = new Map();   // line id -> what is scheduled for it (so a re-fitted line replaces the old one)
    this.pieceSrc = new Map();  // piece index -> scheduled background (rebuilt when a kept line changes it)
    this.applyVolumes();
    video.muted = true;
    const re = () => this.reschedule();
    for (const ev of ['play', 'playing', 'seeked', 'ratechange']) video.addEventListener(ev, re);
    video.addEventListener('pause', () => this.stopAll());
    video.addEventListener('seeking', () => { this.stopAll(); dub.setPlayhead(video.currentTime); });
    dub.addEventListener('line', (e) => this._lineChanged(e.detail));
    this.timer = setInterval(() => this.tick(), 250);
  }
  applyVolumes() {
    const s = this.settings;
    this.bgGain.gain.value = s.bgVolume ?? 1;
    this.voGain.gain.value = s.mode === 'captions' ? 0 : (s.voiceVolume ?? 1);
    this.master.gain.value = s.volume ?? 1;
  }
  _lineChanged(line) {
    const i = Math.floor(line.s / PIECE);
    // only kept lines (real voice put back) and lines with no English voice change the background
    if (line.keep || !line.audio) for (const k of [i - 1, i, i + 1]) this.dirty.set(k, (this.dirty.get(k) || 0) + 1);
    // a new/changed line close ahead of us gets scheduled right away
    if (!this.v.paused && this.sched && line.audio && line.s > this.v.currentTime - 0.2 && line.s < this.v.currentTime + 60) this._scheduleLine(line);
  }
  markAllDirty() { for (const p of this.dub.pieces) this.dirty.set(p.i, (this.dirty.get(p.i) || 0) + 1); this.reschedule(); }
  _buffer(p) {
    const ver = this.dirty.get(p.i) || 0, have = this.bufs.get(p.i);
    if (have && have.ver === ver) return have.ab;
    const { L, R, sr } = this.dub.background(p);
    const ab = this.ctx.createBuffer(2, L.length, sr);
    ab.copyToChannel(L, 0); ab.copyToChannel(R, 1);
    this.bufs.set(p.i, { ab, ver });
    // keep memory low: only pieces near the playhead
    for (const k of this.bufs.keys()) if (Math.abs(k - p.i) > 3) this.bufs.delete(k);
    return ab;
  }
  stopAll() {
    for (const n of this.playing) { try { n.stop(); } catch {} n.disconnect(); }
    this.playing = []; this.sched = null; this.lineSrc.clear(); this.pieceSrc.clear();
  }
  // map media time <-> audio clock
  _when(t) { return this.sched.base + (t - this.sched.t0) / this.sched.rate; }
  reschedule() {
    this.stopAll();
    if (this.v.paused || this.v.seeking) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t0 = this.v.currentTime, rate = this.v.playbackRate || 1;
    this.sched = { t0, base: this.ctx.currentTime + 0.05, rate };
    this._fill();
  }
  _fill() {
    if (!this.sched) return;
    const now = this.v.currentTime, ahead = now + 40;
    for (const p of this.dub.pieces) {
      if (p.e < now - 0.1 || p.s > ahead || this.settings.mode === 'original') continue;
      if (this.dub.readyIn(p) <= Math.max(p.s, now)) continue;  // nothing playable in it yet
      const ver = this.dirty.get(p.i) || 0, have = this.pieceSrc.get(p.i);
      if (have && have.ver === ver) continue;
      // (re)start this piece's background from where we are, with a tiny crossfade
      const from = Math.max(p.s, this.sched.t0, have || p.s < now ? now + 0.1 : 0);
      if (from >= p.e) continue;
      const ab = this._buffer(p), src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = ab; src.playbackRate.value = this.sched.rate; src.connect(g).connect(this.bgGain);
      const when = Math.max(this.ctx.currentTime + 0.01, this._when(from));
      if (have) {
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + 0.02);
        have.g.gain.setValueAtTime(1, when); have.g.gain.linearRampToValueAtTime(0, when + 0.02);
        try { have.src.stop(when + 0.03); } catch {}
      }
      src.start(when, from - p.s);
      this.playing.push(src); this.pieceSrc.set(p.i, { src, g, ver });
    }
    for (const l of this.dub.lines) {
      if (l.s > ahead) break;
      this._scheduleLine(l);
    }
    if (this.playing.length > 400) this.playing = this.playing.filter(n => n._end === undefined || n._end > this.ctx.currentTime);
  }
  _scheduleLine(l) {
    if (!this.sched || !l.audio) return;
    const key = l.voiceId + ':' + l.speed + ':' + l.audio.length + ':' + l.keep, old = this.lineSrc.get(l.id);
    if (old?.key === key) return;
    if (old) { try { old.src.stop(); } catch {} this.lineSrc.delete(l.id); }
    if (l.keep || this.settings.mode === 'captions' || this.settings.mode === 'original') return;
    const end = l.s + l.audio.length / 44100;
    if (end < this.sched.t0) return;
    const ab = this.ctx.createBuffer(1, l.audio.length, 44100); ab.copyToChannel(l.audio, 0);
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = ab; src.playbackRate.value = this.sched.rate; g.gain.value = l.gain;
    src.connect(g).connect(this.voGain);
    const off = Math.max(0, this.sched.t0 - l.s);
    const when = this._when(Math.max(l.s, this.sched.t0));
    src.start(Math.max(this.ctx.currentTime, when), off);
    src._end = when + (ab.duration - off) / this.sched.rate;
    this.playing.push(src); this.lineSrc.set(l.id, { src, key });
  }
  tick() {
    const v = this.v;
    this.dub.setPlayhead(v.currentTime);
    // not translated yet here: wait
    if (!v.paused && !this.dub.isReadyAt(v.currentTime + 0.5) && this.settings.mode !== 'original') {
      v.pause(); this.waiting = true; this.dispatchEvent(new Event('waiting'));
    } else if (this.waiting && this.dub.isReadyAt(v.currentTime + 0.5)) {
      this.waiting = false; this.dispatchEvent(new Event('ready')); v.play();
    }
    if (!this.sched || v.paused) return;
    // stay in sync with the picture
    const expect = this.sched.t0 + (this.ctx.currentTime - this.sched.base) * this.sched.rate;
    if (Math.abs(expect - v.currentTime) > 0.09) { this.reschedule(); return; }
    this._fill();
  }
  // English line(s) to show right now
  captionsAt(t) {
    const out = this.dub.lines.filter(l => l.s <= t && t <= Math.max(l.e, l.s + (l.dur || 0)) + 0.35 && (l.en || (l.keep && l.why === 'english')));
    // foreign subtitles read off the picture (covered with English)
    for (const s of this.dub.screenSubs || []) if (s.en && s.s <= t && t <= Math.max(s.e ?? s.s, s.s + 1.2) + 0.2) out.push(s);
    return out;
  }
  destroy() { clearInterval(this.timer); this.stopAll(); this.ctx.close(); }
}
