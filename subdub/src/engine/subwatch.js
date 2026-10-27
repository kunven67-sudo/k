// Watches the picture for subtitles. When a subtitle appears in a language you can't read, it gets translated.
// English subtitles are passed along too (they make the best text for the English voice).
import { guessLang } from './langid.js';
import { scriptOf, sameText } from './textclean.js';

const SW = 160, SH = 40; // size of the quick 'did anything change?' look at the subtitle area
const PW = 96, PH = 54;  // size of the look for black bars around the picture

export class SubWatch extends EventTarget {
  // video: an element showing the picture. clock(): current time on the dub's timeline (seconds).
  constructor({ eyes, translate, video, clock, settings }) {
    super();
    this.eyes = eyes; this.tr = translate; this.v = video; this.clock = clock; this.settings = settings;
    this.cv = document.createElement('canvas'); this.cx = this.cv.getContext('2d', { willReadFrequently: true });
    this.small = document.createElement('canvas'); this.small.width = SW; this.small.height = SH; this.sx = this.small.getContext('2d', { willReadFrequently: true });
    this.probe = document.createElement('canvas'); this.probe.width = PW; this.probe.height = PH; this.px = this.probe.getContext('2d', { willReadFrequently: true });
    this.prevSig = null; this.lastReadAt = -1e9; this.current = null; this.busy = false; this.seen = new Map();
    this.boxes = []; this.boxAt = -1e9; this.boxFor = '';
  }
  start() { this.timer = setInterval(() => this.tick(), 220); }
  stop() { clearInterval(this.timer); this.timer = null; }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  // Where the picture really is: a phone shown on a PC (a mirror app, BroCast) or a 4:3 show sits
  // inside black bars. Reading only the picture makes the subtitles bigger for the reader. Bars have
  // to stay for ~10 s before they count (a dark scene isn't a bar), and the area below the picture
  // is always kept (some subtitles sit in the black bar under a movie).
  contentBox(W, H) {
    const key = W + 'x' + H, now = performance.now();
    if (key !== this.boxFor) { this.boxFor = key; this.boxes = []; this.boxAt = -1e9; }
    if (now - this.boxAt > 2000) {
      this.boxAt = now;
      const found = this._findPicture();
      if (found) { this.boxes.push(found); if (this.boxes.length > 5) this.boxes.shift(); }
    }
    if (this.boxes.length < 3) return { x: 0, y: 0, w: W, h: H };
    // the biggest area seen lately: bars must be there every time to be cut off
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const b of this.boxes) { x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
    const x = Math.floor(x0 * W), y = Math.floor(y0 * H);
    return { x, y, w: Math.max(16, Math.ceil(x1 * W) - x), h: Math.max(16, Math.ceil(y1 * H) - y) };
  }
  _findPicture() {
    const v = this.v;
    this.px.drawImage(v, 0, 0, v.videoWidth, v.videoHeight, 0, 0, PW, PH);
    const d = this.px.getImageData(0, 0, PW, PH).data;
    const rows = new Uint8Array(PH), cols = new Uint8Array(PW);
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const i = (y * PW + x) * 4;
      if (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 > 28) { rows[y] = 1; cols[x] = 1; }
    }
    const top = rows.indexOf(1), bottom = rows.lastIndexOf(1), left = cols.indexOf(1), right = cols.lastIndexOf(1);
    if (top < 0 || bottom - top < PH * 0.25 || right - left < PW * 0.25) return null; // (almost) black: can't tell
    // one probe cell of margin each way
    return { x0: Math.max(0, left - 1) / PW, y0: Math.max(0, top - 1) / PH, x1: Math.min(PW, right + 2) / PW, y1: Math.min(PH, bottom + 2) / PH };
  }

  // which part of the picture to read: bottom band (+ top band for signs/second subtitles)
  bands(box, H) {
    const y = box.y + Math.round(box.h * 0.66);
    const b = [{ x: box.x, w: box.w, y, h: H - y, where: 'bottom' }];
    if (this.settings.readTop) b.push({ x: box.x, w: box.w, y: box.y, h: Math.round(box.h * 0.2), where: 'top' });
    return b;
  }
  _signature(band) {
    // small grey copy of the subtitle area, as sharp edges (subtitle letters are strong light/dark edges)
    const sc = this.scale;
    this.sx.drawImage(this.v, band.x * sc, band.y * sc, band.w * sc, band.h * sc, 0, 0, SW, SH);
    const d = this.sx.getImageData(0, 0, SW, SH).data, sig = new Uint8Array(SW * SH);
    const lum = (i) => d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
    for (let y = 0; y < SH; y++) for (let x = 1; x < SW; x++) { const i = y * SW + x; sig[i] = Math.abs(lum(i) - lum(i - 1)) > 60 ? 1 : 0; }
    return sig;
  }
  async tick() {
    const v = this.v;
    if (this.busy || !v.videoWidth || v.readyState < 2 || this.settings.readSubs === false) return;
    const W = Math.min(1280, v.videoWidth), H = Math.round(v.videoHeight * W / v.videoWidth);
    this.scale = v.videoWidth / W;
    const box = this.contentBox(W, H);
    const band = this.bands(box, H)[0];
    // read the picture's own size, not the bars: up to 1280 wide like a full-width read
    const zoom = Math.max(1, Math.min(1280 / band.w, this.scale));
    const sig = this._signature(band);
    // read again when the area looks different from the last read (anime moves a lot behind the text, so we don't
    // wait for a still picture), at most about 3 times a second, and every 1.5 s anyway
    let diff = this.prevSig ? 0 : 1e9;
    if (this.prevSig) for (let i = 0; i < sig.length; i++) diff += sig[i] !== this.prevSig[i];
    const now = performance.now(), since = now - this.lastReadAt;
    if (this.debug) console.log('SUBDUB tick', this.clock().toFixed(2), 'diff', diff, 'since', Math.round(since));
    if (since < 330 || (diff < 25 && since < 1500)) {
      if (this.current && diff < 25) this.current.e = this.clock(); // same picture: the subtitle is still there
      return;
    }
    this.prevSig = sig; this.lastReadAt = now;
    this.busy = true;
    try {
      const t = this.clock();
      const RW = Math.round(band.w * zoom), RH = Math.round(band.h * zoom);
      this.cv.width = RW; this.cv.height = RH;
      this.cx.drawImage(v, band.x * this.scale, band.y * this.scale, band.w * this.scale, band.h * this.scale, 0, 0, RW, RH);
      const img = this.cx.getImageData(0, 0, RW, RH);
      // every alphabet's reader has a go (main = English/Chinese/Japanese, accents, Korean, Cyrillic); the best read wins
      const kinds = this.settings.ocrKinds || ['main', 'latin', 'korean', 'eslav'];
      // (texts on screen right now: if the quick read matches one, the other alphabets are skipped)
      const known = this.current ? [this.current.text] : [];
      let lines = await this.eyes.call('read', { img: { data: img.data, width: RW, height: RH }, kinds, maxSide: 1280, known });
      // subtitles: reasonably sized (next to the picture's height), roughly centered text
      const PH_ = box.h * zoom;
      lines = lines.filter(l => {
        const bw = l.box.x2 - l.box.x, bh = l.box.y2 - l.box.y, cx = (l.box.x + l.box.x2) / 2;
        return bh > PH_ * 0.025 && bh < PH_ * 0.14 && l.conf > 0.6 && Math.abs(cx - RW / 2) < RW * 0.3 && bw > RW * 0.04;
      });
      // two subtitles at once (e.g. Chinese on top, English under it): the English one can already be
      // read, so only the other one is the subtitle to translate
      if (lines.length > 1) {
        const langs = lines.map(l => guessLang(l.text));
        if (langs.includes('en')) {
          const foreign = lines.filter((l, i) => langs[i] && langs[i] !== 'en');
          if (foreign.length) lines = foreign;
        }
      }
      const text = lines.map(l => l.text).join('\n').trim();
      this._close(t);
      if (!text || scriptOf(text).total < 2) return;
      // ignore things that never go away (channel logos, watermarks)
      const k = text.replace(/\s+/g, '');
      const seen = this.seen.get(k) || { first: t, n: 0 };
      seen.n++; this.seen.set(k, seen);
      if (t - seen.first > 40 && seen.n > 20) return;
      // the same subtitle read again a moment later (often a cleaner read): fix up the one we have instead of adding a copy
      const prev = this.last;
      if (prev && t - (prev.e ?? prev.s) < 1.0 && sameText(prev.text, text)) {
        this.current = prev; prev.e = t;
        if (prev.text !== text && (prev.lang === 'en') === (guessLang(text) === 'en')) {
          prev.text = text;
          if (prev.lang !== 'en') this.tr.toEnglish(text.replace(/\n/g, ' '), prev.lang === 'auto' ? null : prev.lang).then((en) => { prev.en = en; this.emit('sub', prev); }).catch(() => {});
        }
        return;
      }
      const lang = guessLang(text) || 'auto';
      const tb = lines.reduce((b, l) => ({ x: Math.min(b.x, l.box.x), y: Math.min(b.y, l.box.y), x2: Math.max(b.x2, l.box.x2), y2: Math.max(b.y2, l.box.y2) }), { x: 1e9, y: 1e9, x2: 0, y2: 0 });
      // (box in 0..1 of the whole frame, for covering the subtitle on the video)
      const sub = { s: t, e: t, text, lang, where: band.where, box: { x: (band.x + tb.x / zoom) / W, y: (band.y + tb.y / zoom) / H, w: (tb.x2 - tb.x) / zoom / W, h: (tb.y2 - tb.y) / zoom / H } };
      this.current = sub; this.last = sub;
      if (lang === 'en') { this.emit('sub', sub); return; }
      // translate without holding up the reading (the next subtitle can come while this one is translated)
      this.tr.toEnglish(text.replace(/\n/g, ' '), lang === 'auto' ? null : lang)
        .then((en) => { sub.en = en; this.emit('sub', sub); })
        .catch((e) => this.emit('error', e));
    } catch (e) { this.emit('error', e); }
    finally { this.busy = false; }
  }
  _close(t) { if (this.current) { this.current.e = t; this.emit('subEnd', this.current); this.current = null; } }
}
