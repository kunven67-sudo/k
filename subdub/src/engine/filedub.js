// File mode: turns a downloaded episode into an English dub, a piece at a time, ahead of where you are watching.
//   1. cut the voices out of the soundtrack (music + sound effects stay)
//   2. find every spoken line, read it (speech-to-text), find out who says it (girl/boy, which character)
//   3. translate to English, speak it with that character's English voice, fit it to the line's length
// Lines that are already English, or are just screams/laughs, keep the character's real voice.
import { resample, semitones, rms, fadeEdges } from '../lib/resample.js';
import { looksEnglish } from './textclean.js';
import { isNonverbal } from './nonverbal.js';

export const PIECE = 30;     // seconds of audio handled at once
const SR = 44100;            // soundtrack rate used for separating + mixing

const toI16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const v = f[i]; o[i] = v > 1 ? 32767 : v < -1 ? -32767 : v * 32767; } return o; };

export class FileDub extends EventTarget {
  constructor({ engine, cast, translate, settings }) {
    super();
    this.e = engine; this.cast = cast; this.tr = translate; this.settings = settings;
    this.lines = []; this.pieces = []; this.stopped = false; this.playhead = 0;
    this.showLang = null; this.langVotes = {};
    this.subs = null;          // English subtitle lines from the file, if it has them
  }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  // Decode the soundtrack at 44.1 kHz stereo
  async load(fileOrBuffer, { onProgress } = {}) {
    onProgress?.(0.05);
    const buf = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    onProgress?.(0.4);
    const ctx = new OfflineAudioContext(2, 1, SR);
    const ab = await ctx.decodeAudioData(buf);
    onProgress?.(0.9);
    this.setAudio(ab.getChannelData(0), ab.numberOfChannels > 1 ? ab.getChannelData(1) : ab.getChannelData(0));
    onProgress?.(1);
  }
  setAudio(L, R) {
    this.n = L.length; this.duration = L.length / SR;
    this.oL = toI16(L); this.oR = toI16(R);
    this.vL = new Int16Array(this.n); this.vR = new Int16Array(this.n);   // separated voices
    this.voice16 = new Float32Array(Math.ceil(this.duration * 16000) + 16);
    this.pieces = [];
    for (let s = 0, i = 0; s < this.duration; s += PIECE, i++) this.pieces.push({ i, s, e: Math.min(this.duration, s + PIECE), sep: 'todo', lines: 'todo' });
    this.vadCursor = 0;
  }
  readyUntil() {
    // seconds from the start that are fully dubbed
    let t = 0;
    for (const p of this.pieces) { if (p.lines === 'done') { t = p.e; continue; } if (p.lines === 'busy' && p.doneUntil > p.s) t = p.doneUntil; break; }
    return t;
  }
  isReadyAt(t) { const p = this.pieceAt(t); return p?.lines === 'done' || (p?.lines === 'busy' && p.doneUntil > t); }
  pieceAt(t) { return this.pieces[Math.max(0, Math.min(this.pieces.length - 1, Math.floor(t / PIECE)))]; }
  // how far a piece can already be played (it's finished line by line)
  readyIn(p) { return p.lines === 'done' ? p.e : p.lines === 'busy' ? (p.doneUntil || p.s) : p.s; }
  setPlayhead(t) { this.playhead = t; this._wake?.(); }
  stop() { this.stopped = true; this._wake?.(); }

  // ---------- separation ----------
  async _separate(p) {
    if (p.sep === 'done') return;
    if (p.sepPromise) return p.sepPromise;
    p.sep = 'busy';
    p.sepPromise = (async () => {
      const m = 2.5; // context so the cut points don't click
      const a = Math.max(0, Math.floor((p.s - m) * SR)), b = Math.min(this.n, Math.ceil((p.e + m) * SR));
      const L = new Float32Array(b - a), R = new Float32Array(b - a);
      for (let i = a; i < b; i++) { L[i - a] = this.oL[i] / 32767; R[i - a] = this.oR[i] / 32767; }
      const v = await this.e.sep.call('separate', { L, R }, [L.buffer, R.buffer]);
      const s0 = Math.floor(p.s * SR), s1 = Math.min(this.n, Math.floor(p.e * SR));
      const mono = new Float32Array(s1 - s0);
      for (let i = s0; i < s1; i++) {
        const l = v.L[i - a], r = v.R[i - a];
        this.vL[i] = l * 32767; this.vR[i] = r * 32767; mono[i - s0] = (l + r) / 2;
      }
      this.voice16.set(resample(mono, SR, 16000), Math.floor(p.s * 16000));
      p.sep = 'done';
      this.emit('progress', this.progress());
    })();
    return p.sepPromise;
  }

  // ---------- main loop ----------
  progress() {
    const sep = this.pieces.filter(p => p.sep === 'done').length, done = this.pieces.filter(p => p.lines === 'done').length;
    return { sep, done, total: this.pieces.length, readyUntil: this.readyUntil(), duration: this.duration };
  }
  async run() {
    while (!this.stopped) {
      // next piece to dub = first unfinished piece at/after the playhead (then wrap to earlier ones)
      const at = Math.floor(this.playhead / PIECE);
      const order = [...this.pieces.slice(at), ...this.pieces.slice(0, at)];
      const p = order.find(x => x.lines !== 'done');
      if (!p) { this.emit('done', this.progress()); return; }
      // cut voices for this piece and the next one (in parallel with reading the lines)
      await this._separate(p);
      const nxt = this.pieces[p.i + 1];
      if (nxt && nxt.sep === 'todo') this._separate(nxt).catch(e => this.emit('error', e));
      await this._dubPiece(p);
    }
  }

  async _dubPiece(p) {
    p.lines = 'busy';
    // voice activity on the clean voice track. Lines that run into the next piece wait for it.
    const last = p.i === this.pieces.length - 1;
    const nxt = this.pieces[p.i + 1];
    if (!last && nxt.sep !== 'done') await this._separate(nxt);
    // start right after the last line we already did (a line can run past the end of its piece)
    let from = p.s;
    for (const l of this.lines) if (l.s < p.s && l.e > from) from = l.e;
    const to = last ? this.duration : Math.min(this.duration, p.e + PIECE * 0.5);
    const audio = this.voice16.slice(Math.floor(from * 16000), Math.floor(to * 16000));
    const segs = await this.e.listen.call('vadSegments', { audio, offset: from, opts: { minSilence: 0.3, maxLen: 14 } });
    // take lines that START in this piece (lines starting later belong to the next piece)
    const mine = segs.filter(([a]) => a >= from - 0.01 && (a < p.e || last));
    // everything before the first line is ready already (music only); then it grows line by line
    p.doneUntil = mine.length ? Math.max(p.s, mine[0][0] - 0.05) : p.e;
    this.emit('progress', this.progress());
    for (let k = 0; k < mine.length; k++) {
      const [a, b] = mine[k];
      if (this.stopped) return;
      if (!this.lines.some(l => l.s < b && l.e > a && l.seg)) await this._dubSegment(a, b); // (skip lines a previous piece did)
      p.doneUntil = Math.min(p.e, k + 1 < mine.length ? mine[k + 1][0] - 0.05 : p.e);
      this.emit('progress', this.progress());
    }
    p.lines = 'done';
    this.emit('progress', this.progress());
  }

  // one speech segment -> one or more dub lines (split where the speaker changes)
  async _dubSegment(a, b) {
    const clip = this.voice16.slice(Math.floor(a * 16000), Math.floor(b * 16000));
    if (clip.length < 16000 * 0.25) return;
    const lead = this._leadLang();
    const prior = lead ? { [lead]: this.showLang ? 6 : 3 } : null;
    // very short lines can't be told apart reliably: they are in the show's language
    const force = this.settings.forceLang || (lead && b - a < 1.2 ? lead : null);
    const heard = await this.e.asr.call('hear', { audio: clip, tier: this.settings.fileModel || 'good', prior, showLang: lead, force });
    this._voteLang(heard.lang, b - a);
    let sents = heard.sentences.length ? heard.sentences : [{ a: 0, b: b - a, text: '' }];
    // who says each sentence?
    const groups = [];
    for (const s of sents) {
      const sa = Math.max(0, s.a), sb = Math.min(b - a, Math.max(s.b, s.a + 0.3));
      const piece = clip.subarray(Math.floor(sa * 16000), Math.floor(sb * 16000));
      const info = await this.e.listen.call('analyze', { audio: piece.length > 16000 * 0.4 || sents.length === 1 ? piece : clip });
      const ch = this.cast.match(info, a + sa);
      const g = groups.at(-1);
      if (g && g.ch === ch) { g.texts.push(s.text); g.b = sb; g.loud.push(rms(piece)); }
      else groups.push({ ch, a: sa, b: sb, texts: [s.text], loud: [rms(piece)] });
    }
    // edges of the first/last group follow the segment edges
    groups[0].a = 0; groups.at(-1).b = b - a;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const text = g.texts.join(' ').trim();
      const line = {
        id: 'L' + Math.round((a + g.a) * 1000), seg: true, s: a + g.a, e: a + g.b, charId: g.ch.id,
        lang: heard.lang, src: text, en: '', keep: false, why: '', audio: null, gain: 1,
      };
      if (!text) { line.keep = true; line.why = 'unclear'; }
      else if (heard.lang === 'en' || looksEnglish(text)) { line.keep = true; line.why = 'english'; line.en = text; }
      else if (isNonverbal(text)) { line.keep = true; line.why = 'sound'; }
      this._insert(line);
      if (!line.keep) {
        line.en = this._subtitleFor(line.s, line.e) || await this.tr.toEnglish(text, heard.lang);
        if (isNonverbal(text, line.en)) { line.keep = true; line.why = 'sound'; }
      }
      if (!line.keep && line.en) {
        await this.speakLine(line, Math.max(...g.loud));
        const prev = this._prevDub(line);
        if (prev && prev.s + prev.dur > line.s + 0.25) { await this.speakLine(prev); this.emit('line', prev); }
      }
      g.ch.lastText = line.en || text;
      this.emit('line', line);
    }
  }
  _prevDub(line) {
    const i = this.lines.indexOf(line);
    for (let k = i - 1; k >= 0; k--) if (this.lines[k].audio && !this.lines[k].keep) return this.lines[k];
    return null;
  }
  _leadLang() {
    if (this.showLang) return this.showLang;
    const best = Object.entries(this.langVotes).sort((x, y) => y[1] - x[1])[0];
    return best && best[1] >= 4 ? best[0] : null;
  }
  _voteLang(lang, w) {
    if (lang === 'en') return;
    this.langVotes[lang] = (this.langVotes[lang] || 0) + w;
    const best = Object.entries(this.langVotes).sort((x, y) => y[1] - x[1])[0];
    const total = Object.values(this.langVotes).reduce((s, v) => s + v, 0);
    if (total > 15 && best[1] / total > 0.6) this.showLang = best[0];
  }
  _insert(line) {
    let i = this.lines.length;
    while (i > 0 && this.lines[i - 1].s > line.s) i--;
    this.lines.splice(i, 0, line);
  }
  _subtitleFor(s, e) {
    if (!this.subs?.length) return null;
    const hits = this.subs.filter(x => Math.min(e, x.e) - Math.max(s, x.s) > Math.min(0.4, (e - s) * 0.4));
    return hits.length ? hits.map(x => x.text).join(' ') : null;
  }

  // English voice for a line, fitted to its time slot. Also used again when the voice or character changes.
  async speakLine(line, srcLoud = null) {
    const ch = this.cast.byId(line.charId), v = this.cast.voice(ch);
    const next = this.lines.find(l => l.s > line.s + 0.05 && !l.keep);
    const slot = Math.max(0.5, Math.min((next ? next.s : this.duration) - line.s - 0.08, (line.e - line.s) + 1.0));
    const ratio = semitones(v.shift || 0);
    // first try: guess the speed from the text length (about 15 letters a second)
    let speed = Math.min(1.45, Math.max(0.9, (line.en.length / 15) / slot));
    let r = await this.e.tts.call('speak', { text: line.en, mix: v.mix, speed: speed / ratio });
    let dur = r.audio.length / r.sr / ratio;
    if (dur > slot * 1.06 && speed < 1.45) {
      speed = Math.min(1.5, speed * dur / slot);
      r = await this.e.tts.call('speak', { text: line.en, mix: v.mix, speed: speed / ratio });
      dur = r.audio.length / r.sr / ratio;
    }
    const out = fadeEdges(resample(r.audio, r.sr * ratio, SR), SR);
    // match the loudness of the original voice (but keep it clear)
    const target = srcLoud ?? line.loud ?? 0.08;
    line.loud = target;
    const g = Math.min(4, Math.max(0.35, (Math.max(0.03, Math.min(0.25, target)) * 1.1) / (rms(out) || 1)));
    line.audio = out; line.gain = g; line.speed = speed; line.voiceId = v.id; line.dur = dur;
    return line;
  }

  // ---------- what plays ----------
  // Background (music + effects) for a piece, with the real voice put back where a line keeps it.
  background(p) {
    const s0 = Math.floor(p.s * SR), s1 = Math.min(this.n, Math.floor(p.e * SR)), n = s1 - s0;
    const L = new Float32Array(n), R = new Float32Array(n);
    const dub = this.settings.mode === 'dub' || !this.settings.mode;
    for (let i = 0; i < n; i++) {
      const k = s0 + i;
      L[i] = (this.oL[k] - (dub ? this.vL[k] : 0)) / 32767; R[i] = (this.oR[k] - (dub ? this.vR[k] : 0)) / 32767;
    }
    if (dub) {
      // put real voices back for lines that keep them, and for anything spoken that has no English yet
      const fade = Math.floor(SR * 0.03);
      for (const l of this.lines) {
        if (l.e < p.s || l.s > p.e) continue;
        if (!(l.keep || !l.audio)) continue;
        const a = Math.max(s0, Math.floor(l.s * SR) - fade), b = Math.min(s1, Math.ceil(l.e * SR) + fade);
        for (let k = a; k < b; k++) {
          const g = Math.min(1, (k - a) / fade, (b - k) / fade);
          L[k - s0] += g * this.vL[k] / 32767; R[k - s0] += g * this.vR[k] / 32767;
        }
      }
    }
    return { L, R, sr: SR };
  }
}
