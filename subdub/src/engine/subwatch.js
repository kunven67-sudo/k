// Watches the picture for subtitles. When a subtitle appears in a language you can't read, it gets translated.
// English subtitles are passed along too (they make the best text for the English voice).
import { guessLang } from './langid.js';
import { scriptOf } from './textclean.js';

export class SubWatch extends EventTarget {
  // video: an element showing the picture. clock(): current time on the dub's timeline (seconds).
  constructor({ eyes, translate, video, clock, settings }) {
    super();
    this.eyes = eyes; this.tr = translate; this.v = video; this.clock = clock; this.settings = settings;
    this.cv = document.createElement('canvas'); this.cx = this.cv.getContext('2d', { willReadFrequently: true });
    this.small = document.createElement('canvas'); this.small.width = 96; this.small.height = 24; this.sx = this.small.getContext('2d', { willReadFrequently: true });
    this.prevSig = null; this.stableCount = 0; this.current = null; this.busy = false; this.seen = new Map();
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
    // tiny grey thumbnail of the band; subtitles are bright/dark edges so this changes when the text changes
    this.sx.drawImage(this.v, 0, band.y * this.scale, this.v.videoWidth, band.h * this.scale, 0, 0, 96, 24);
    const d = this.sx.getImageData(0, 0, 96, 24).data, sig = new Uint8Array(96 * 24);
    for (let i = 0; i < sig.length; i++) sig[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) > 200 ? 1 : 0;
    return sig;
  }
  async tick() {
    const v = this.v;
    if (this.busy || !v.videoWidth || v.readyState < 2 || this.settings.readSubs === false) return;
    const W = Math.min(1280, v.videoWidth), H = Math.round(v.videoHeight * W / v.videoWidth);
    this.scale = v.videoWidth / W;
    const band = this.bands(W, H)[0];
    const sig = this._signature(band);
    // the band changed? wait until it holds still for one more look (subtitles appear in one go)
    let diff = 0;
    if (this.prevSig) for (let i = 0; i < sig.length; i++) diff += sig[i] !== this.prevSig[i];
    this.prevSig = sig;
    if (diff > 12) { this.stableCount = 0; return; }
    if (++this.stableCount !== 1) {
      // nothing changed: keep the current subtitle alive
      if (this.current) this.current.e = this.clock();
      return;
    }
    this.busy = true;
    try {
      const t = this.clock();
      this.cv.width = W; this.cv.height = band.h;
      this.cx.drawImage(v, 0, band.y * this.scale, v.videoWidth, band.h * this.scale, 0, 0, W, band.h);
      const img = this.cx.getImageData(0, 0, W, band.h);
      const kinds = ['main', ...(this.settings.ocrKinds || [])];
      let lines = await this.eyes.call('read', { img: { data: img.data, width: W, height: band.h }, kinds, maxSide: 1280 });
      // subtitles: reasonably sized, roughly centered text
      lines = lines.filter(l => {
        const bw = l.box.x2 - l.box.x, bh = l.box.y2 - l.box.y, cx = (l.box.x + l.box.x2) / 2;
        return bh > H * 0.025 && bh < H * 0.14 && l.conf > 0.6 && Math.abs(cx - W / 2) < W * 0.3 && bw > W * 0.04;
      });
      // retry low-confidence lines with other alphabets (accents, Korean, Cyrillic)
      if (lines.length && lines.some(l => l.conf < 0.85) && !this.settings.ocrKinds) {
        const more = await this.eyes.call('read', { img: { data: img.data, width: W, height: band.h }, kinds: ['main', 'latin', 'korean', 'eslav'], maxSide: 1280 });
        if (more.length) lines = more.filter(l => l.conf > 0.6 && (l.box.y2 - l.box.y) > H * 0.025);
      }
      const text = lines.map(l => l.text).join('\n').trim();
      this._close(t);
      if (!text || scriptOf(text).total < 2) return;
      // ignore things that never go away (channel logos, watermarks)
      const k = text.replace(/\s+/g, '');
      const seen = this.seen.get(k) || { first: t, n: 0 };
      seen.n++; this.seen.set(k, seen);
      if (t - seen.first > 40 && seen.n > 20) return;
      const lang = guessLang(text) || 'auto';
      const box = lines.reduce((b, l) => ({ x: Math.min(b.x, l.box.x), y: Math.min(b.y, l.box.y), x2: Math.max(b.x2, l.box.x2), y2: Math.max(b.y2, l.box.y2) }), { x: 1e9, y: 1e9, x2: 0, y2: 0 });
      const sub = { s: t, e: t, text, lang, where: band.where, box: { x: box.x / W, y: (band.y + box.y) / H, w: (box.x2 - box.x) / W, h: (box.y2 - box.y) / H } };
      this.current = sub;
      if (lang !== 'en') sub.en = await this.tr.toEnglish(text.replace(/\n/g, ' '), lang === 'auto' ? null : lang);
      this.emit('sub', sub);
    } catch (e) { this.emit('error', e); }
    finally { this.busy = false; }
  }
  _close(t) { if (this.current) { this.current.e = t; this.emit('subEnd', this.current); this.current = null; } }
}
