// File mode: turns a downloaded episode into an English dub, a piece at a time, ahead of where you are watching.
//   1. cut the voices out of the soundtrack (music + sound effects stay)
//   2. find every spoken line, read it (speech-to-text), find out who says it (girl/boy, which character)
//   3. translate to English, speak it with that character's English voice, fit it to the line's length
// Lines that are already English, or are just screams/laughs, keep the character's real voice.
import { resample, semitones, rms, fadeEdges } from '../lib/resample.js';
import { looksEnglish } from './textclean.js';
import { isNonverbal } from './nonverbal.js';
import { hearRound } from './hearround.js';

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
    this.stats = {};           // time spent per step (ms), for tuning
    this.cps = 15;             // English letters per second the voices say at normal speed (learned)
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
      const tC = performance.now();
      const v = await this.e.sep.call('separate', { L, R }, [L.buffer, R.buffer]);
      this._t('cutVoices', tC);
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
    if (!this.showLang && !this.settings.forceLang && !this.langProbed) await this._probeLang(segs);
    // everything before the first line is ready already (music only); then it grows line by line
    p.doneUntil = mine.length ? Math.max(p.s, mine[0][0] - 0.05) : p.e;
    this.emit('progress', this.progress());
    // lines are read in rounds (one pass of the big model each); the very first round is small so you can start sooner
    for (let k = 0; k < mine.length;) {
      if (this.stopped) return;
      const cap = this.readyUntil() < 1 ? 8 : 26, round = [];
      let tot = 0;
      while (k < mine.length && (!round.length || tot + mine[k][1] - mine[k][0] + 0.8 <= cap)) {
        const [a, b] = mine[k++];
        if (this.lines.some(l => l.s < b && l.e > a && l.seg)) continue; // a previous piece did it already
        if (b - a < 0.25) continue;
        round.push([a, b]); tot += b - a + 0.8;
      }
      if (round.length) {
        // each line with 0.4 s of its real surrounding sound (Whisper reads joined lines best that way)
        const pads = round.map(([a, b]) => [Math.min(0.4, a), Math.min(0.4, this.duration - b)]);
        const clips = round.map(([a, b], i) => this.voice16.slice(Math.floor((a - pads[i][0]) * 16000), Math.floor((b + pads[i][1]) * 16000)));
        const lead = this._leadLang();
        const heards = await hearRound(this.e.asr, clips, { pads, tier: this.settings.fileModel || 'good', lead, showLang: this.showLang, force: this.settings.forceLang || null, stats: this.stats });
        for (let i = 0; i < round.length; i++) {
          if (this.stopped) return;
          await this._dubSegment(round[i][0], round[i][1], heards[i]);
          p.doneUntil = Math.min(p.e, round[i + 1] ? round[i + 1][0] - 0.05 : k < mine.length ? mine[k][0] - 0.05 : p.e);
          this.emit('progress', this.progress());
        }
      }
      p.doneUntil = Math.min(p.e, k < mine.length ? mine[k][0] - 0.05 : p.e);
    }
    p.lines = 'done';
    this.emit('progress', this.progress());
  }

  // one speech segment -> one or more dub lines (split where the speaker changes)
  async _dubSegment(a, b, heard) {
    const clip = this.voice16.slice(Math.floor(a * 16000), Math.floor(b * 16000));
    if (clip.length < 16000 * 0.25) return;
    this._voteLang(heard.lang, b - a);
    let sents = heard.sentences.length ? heard.sentences : [{ a: 0, b: b - a, text: '' }];
    // who says each sentence?
    const groups = [];
    for (const s of sents) {
      const sa = Math.max(0, s.a), sb = Math.min(b - a, Math.max(s.b, s.a + 0.3));
      const piece = clip.subarray(Math.floor(sa * 16000), Math.floor(sb * 16000));
      const tA = performance.now();
      const info = await this.e.listen.call('analyze', { audio: piece.length > 16000 * 0.4 || sents.length === 1 ? piece : clip });
      this._t('analyze', tA);
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
        const tT = performance.now();
        line.en = this._subtitleFor(line.s, line.e) || await this.tr.toEnglish(text, heard.lang);
        this._t('translate', tT);
        if (isNonverbal(text, line.en)) { line.keep = true; line.why = 'sound'; }
      }
      if (!line.keep && line.en) {
        const tS = performance.now();
        await this.speakLine(line, Math.max(...g.loud));
        this._t('voice', tS);
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
  // listen to ~25 s of talking at once to learn the show's language before the first lines
  async _probeLang(segs) {
    let n = 0; const parts = [];
    for (const [a, b] of segs) { if (n > 25) break; parts.push(this.voice16.subarray(Math.floor(a * 16000), Math.floor(b * 16000))); n += b - a; }
    if (n < 6) return;   // not enough talking here yet: try again on the next piece
    this.langProbed = true;
    const audio = new Float32Array(parts.reduce((s, x) => s + x.length + 1600, 0));
    let o = 0; for (const x of parts) { audio.set(x, o); o += x.length + 1600; }
    try {
      const top = await this.e.asr.call('detectLang', { audio, tier: this.settings.fileModel || 'good' });
      const [lang, pr] = top[0];
      if (lang !== 'en' && pr > 0.5) { this.langVotes[lang] = (this.langVotes[lang] || 0) + 8 * pr; if (pr > 0.8) this.showLang = lang; }
    } catch (e) { this.emit('error', e); }
  }
  _t(k, t0) { this.stats[k] = (this.stats[k] || 0) + performance.now() - t0; }
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
    // guess the speed from the text length, using how fast the voices really talked so far (learned as we go),
    // so the line only has to be made a second time when the guess was clearly off
    const len = line.en.length;
    let speed = Math.min(1.45, Math.max(0.9, len / (this.cps * slot)));
    let r = await this.e.tts.call('speak', { text: line.en, mix: v.mix, speed: speed / ratio });
    let dur = r.audio.length / r.sr / ratio;
    if (len >= 8) this.cps = this.cps * 0.8 + 0.2 * Math.min(25, Math.max(8, len / (dur * speed)));
    if (dur > slot * 1.12 && speed < 1.45) {
      speed = Math.min(1.5, speed * dur / slot);
      r = await this.e.tts.call('speak', { text: line.en, mix: v.mix, speed: speed / ratio });
      dur = r.audio.length / r.sr / ratio;
      this.stats.remade = (this.stats.remade || 0) + 1;
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
