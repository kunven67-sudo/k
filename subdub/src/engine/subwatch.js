// Watches the picture for subtitles. When a subtitle appears in a language you can't read, it gets translated.
// English subtitles are passed along too (they make the best text for the English voice).
import { guessLang } from './langid.js';
import { scriptOf, sameText } from './textclean.js';

const SW = 160, SH = 40; // size of the quick 'did anything change?' look at the subtitle area

export class SubWatch extends EventTarget {
  // video: an element showing the picture. clock(): current time on the dub's timeline (seconds).
  constructor({ eyes, translate, video, clock, settings }) {
    super();
    this.eyes = eyes; this.tr = translate; this.v = video; this.clock = clock; this.settings = settings;
    this.cv = document.createElement('canvas'); this.cx = this.cv.getContext('2d', { willReadFrequently: true });
    this.small = document.createElement('canvas'); this.small.width = SW; this.small.height = SH; this.sx = this.small.getContext('2d', { willReadFrequently: true });
    this.prevSig = null; this.lastReadAt = -1e9; this.current = null; this.busy = false; this.seen = new Map();
  }
  start() { this.timer = setInterval(() => this.tick(), 220); }
  stop() { clearInterval(this.timer); this.timer = null; }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  // which part of the picture to read: bottom band (+ top band for signs/second subtitles)
  bands(w, h) {
    const b = [{ y: Math.round(h * 0.66), h: Math.round(h * 0.34), where: 'bottom' }];
    if (this.settings.readTop) b.push({ y: 0, h: Math.round(h * 0.2), where: 'top' });
    return b;
  }
  _signature(band) {
    // small grey copy of the subtitle area, as sharp edges (subtitle letters are strong light/dark edges)
    this.sx.drawImage(this.v, 0, band.y * this.scale, this.v.videoWidth, band.h * this.scale, 0, 0, SW, SH);
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
    const band = this.bands(W, H)[0];
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
      this.cv.width = W; this.cv.height = band.h;
      this.cx.drawImage(v, 0, band.y * this.scale, v.videoWidth, band.h * this.scale, 0, 0, W, band.h);
      const img = this.cx.getImageData(0, 0, W, band.h);
      // every alphabet's reader has a go (main = English/Chinese/Japanese, accents, Korean, Cyrillic); the best read wins
      const kinds = this.settings.ocrKinds || ['main', 'latin', 'korean', 'eslav'];
      // (texts on screen right now: if the quick read matches one, the other alphabets are skipped)
      const known = this.current ? [this.current.text] : [];
      let lines = await this.eyes.call('read', { img: { data: img.data, width: W, height: band.h }, kinds, maxSide: 1280, known });
      // subtitles: reasonably sized, roughly centered text
      lines = lines.filter(l => {
        const bw = l.box.x2 - l.box.x, bh = l.box.y2 - l.box.y, cx = (l.box.x + l.box.x2) / 2;
        return bh > H * 0.025 && bh < H * 0.14 && l.conf > 0.6 && Math.abs(cx - W / 2) < W * 0.3 && bw > W * 0.04;
      });
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
      const box = lines.reduce((b, l) => ({ x: Math.min(b.x, l.box.x), y: Math.min(b.y, l.box.y), x2: Math.max(b.x2, l.box.x2), y2: Math.max(b.y2, l.box.y2) }), { x: 1e9, y: 1e9, x2: 0, y2: 0 });
      const sub = { s: t, e: t, text, lang, where: band.where, box: { x: box.x / W, y: (band.y + box.y) / H, w: (box.x2 - box.x) / W, h: (box.y2 - box.y) / H } };
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
