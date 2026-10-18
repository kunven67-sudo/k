// FNF 2 - asset access. In the private build, window.__FNF_ASSETS maps
// "lib/path/file.ext" -> data URL (images, audio, fonts) or text (json, xml, txt).
// Library rules follow FNF's Paths: "shared:characters/bf" -> shared/images/characters/bf,
// "default:ui/x" -> preload/images/ui/x, no library -> search shared then preload.

G.A = {
  raw: window.__FNF_ASSETS || {},

  _img: new Map(),     // path -> HTMLImageElement (decoded)
  _json: new Map(),
  _buf: new Map(),     // path -> Promise<AudioBuffer>
  has(p) { return p in this.raw; },
  text(p) { const v = this.raw[p]; return typeof v === 'string' && !v.startsWith('data:') ? v : null; },
  json(p) {
    // our own characters are made on first use from a real one (15-forge.js)
    if (p.startsWith('preload/data/characters/') && G.OWN && G.Forge) { const id = p.slice(24, -5); if (G.OWN[id] && !G.Forge.built[id]) G.Forge.ensure(id); }
    if (this._json.has(p)) return this._json.get(p);
    const t = this.text(p); let v = null;
    if (t != null) { try { v = JSON.parse(t); } catch (e) { G.reportError(e, 'json ' + p); } }
    this._json.set(p, v); return v;
  },
  // "lib:key" -> {lib, key}
  split(path) { const i = path.indexOf(':'); return i > 0 ? { lib: path.slice(0, i), key: path.slice(i + 1) } : { lib: null, key: path }; },
  // image/atlas base path without extension, e.g. "shared/images/characters/bf"
  imagePath(path, dir) {
    const { lib, key } = this.split(path);
    const libs = lib ? [lib === 'default' ? 'preload' : lib] : (dir ? [dir, 'shared', 'preload'] : ['shared', 'preload']);
    for (const l of libs) {
      const base = l + '/images/' + key;
      if (this.raw[base + '.png'] || this.raw[base + '.xml'] || this.raw[base + '/Animation.json']) return base;
    }
    return (libs[0] || 'shared') + '/images/' + key;
  },
  // Pictures. The small ones (under 8 MB once decoded) are decoded at boot. The big ones (title GF,
  // freeplay cards, results art, stage layers...) are decoded the first time a screen asks for them;
  // the main loop holds the screen (G.A.busy) until they're ready, so nothing pops in half-drawn.
  // Decoding all 1.4 GB at boot made the browser throw pictures away and decode them again mid-song.
  image(p) {
    let img = this._img.get(p);
    if (!img) {
      // let go earlier but still alive somewhere (a sprite kept it): use it again, no second decode
      const w = this._weak.get(p), old = w && w.deref();
      if (old) { img = old; this._img.set(p, old); }
    }
    if (img) { this._touch.set(img, this._gen); return img; }
    return this.raw[p] && p.endsWith('.png') ? this._load(p) : null;
  },
  // Memory: only pictures under 2 MB (once decoded) are decoded at boot (~110 MB, menus + UI). Bigger
  // ones decode when a screen asks for them (the screen waits). A few seconds after every screen change,
  // big pictures that screen never asked for are let go, so memory doesn't keep growing with every
  // stage you visit (it used to hold 370 MB at boot and climb past 1 GB).
  HEAVY: 2e6,
  _gen: 0, _touch: new WeakMap(), _weak: new Map(), _releaseAt: 0,
  touch(img) { if (img) this._touch.set(img, this._gen); },
  newScreen() { this._gen++; this._releaseAt = performance.now() + 2500; },
  releaseUnused() {
    let freed = 0;
    for (const [p, img] of this._img) {
      if (this._touch.get(img) === this._gen || img.width * img.height * 4 < this.HEAVY) continue;
      this._img.delete(p); this._weak.set(p, new WeakRef(img));
      if (G.Sparrow && G.Sparrow.forget) G.Sparrow.forget(img);
      if (G.Atlas && G.Atlas.forget) G.Atlas.forget(img);
      freed += img.width * img.height * 4;
    }
    for (const [p, w] of this._weak) if (!w.deref()) this._weak.delete(p);
    return freed;
  },
  pending: new Set(),
  fresh: [],          // just decoded: drawn once on the real canvas so the GPU has them before they're needed
  busy() { return this.pending.size > 0; },
  _after: [],
  afterLoad(fn) { if (this.busy()) this._after.push(fn); else fn(); },   // run once every picture asked for so far is decoded
  warmNow(list) { for (const i of list) if (i) this.fresh.push(i); },     // hand these to the GPU on the next frame
  // picture size straight from the file header (PNG or WebP), without decoding it
  dims(p) {
    const v = this.raw[p]; if (!v || !v.startsWith('data:')) return null;
    const i = v.indexOf(',') + 1, bin = atob(v.slice(i, i + 64)), b = k => bin.charCodeAt(k);
    if (bin.slice(0, 4) === 'RIFF') {
      const f = bin.slice(12, 16);
      if (f === 'VP8 ') return [(b(26) | b(27) << 8) & 0x3fff, (b(28) | b(29) << 8) & 0x3fff];
      if (f === 'VP8L') { const bits = (b(21) | b(22) << 8 | b(23) << 16 | b(24) << 24) >>> 0; return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]; }
      if (f === 'VP8X') return [1 + (b(24) | b(25) << 8 | b(26) << 16), 1 + (b(27) | b(28) << 8 | b(29) << 16)];
    }
    if (b(1) === 0x50 && b(2) === 0x4e) return [(b(16) << 24 | b(17) << 16 | b(18) << 8 | b(19)) >>> 0, (b(20) << 24 | b(21) << 16 | b(22) << 8 | b(23)) >>> 0];
    return null;
  },
  _load(p) {
    const img = new Image(), d = this.dims(p);
    if (d) { img.width = d[0]; img.height = d[1]; }    // code can read the size before it's decoded
    img.src = this.raw[p];
    this._img.set(p, img); this._touch.set(img, this._gen); this._weak.delete(p);
    const pr = (img.decode ? img.decode() : new Promise(r => { img.onload = r; })).catch(() => {}).then(() => { this.pending.delete(pr); this.fresh.push(img); });
    this.pending.add(pr);
    return img;
  },
  loadImages() {
    let n = 0;
    for (const p in this.raw) {
      if (!p.endsWith('.png') || this._img.has(p)) continue;
      const d = this.dims(p);
      if (d && d[0] * d[1] * 4 >= this.HEAVY) continue;
      this._load(p); n++;
    }
    const all = [...this.pending];
    let done = 0;
    for (const pr of all) pr.then(() => { done++; const el = document.getElementById('boot'); if (el) el.textContent = 'Loading... ' + Math.round(done / all.length * 100) + '%'; });
    return Promise.all(all).then(() => { this.fresh.length = 0; });
  },
  // audio: decoded on demand and cached. A decoded 3 minute song track is ~65 MB, so the cache has a
  // budget: when it's over, the tracks used longest ago go (the song being played + the menu music are
  // pinned, little sounds always stay). Before this every song you previewed or played stayed decoded
  // forever, and memory filled up until everything lagged.
  AUDIO_BUDGET: 280e6,
  _use: new Map(), _size: new Map(), _pinned: new Set(['preload/music/freakyMenu/freakyMenu.ogg']),
  audio(p) {
    this._use.set(p, performance.now());
    if (this._buf.has(p)) return this._buf.get(p);
    const data = this.raw[p];
    if (!data || !G.audio || !G.audio.ctx) return Promise.resolve(null);
    const b64 = data.slice(data.indexOf(',') + 1);
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const pr = new Promise(res => {
      try {
        G.audio.ctx.decodeAudioData(u8.buffer, b => {
          if (this._buf.get(p) === pr) { this._size.set(p, b.length * b.numberOfChannels * 4); this.trimAudio(); }
          res(b);
        }, () => res(null));
      } catch (e) { res(null); }
    });
    this._buf.set(p, pr);
    return pr;
  },
  // just one part of a track (freeplay previews): the whole track is decoded, the part is copied out
  // and the rest is thrown away again (unless something else is using the whole track)
  audioClip(p, from, to) {
    const key = p + '#' + from + ':' + to;
    this._use.set(key, performance.now());
    if (this._buf.has(key)) return this._buf.get(key);
    const had = this._buf.has(p);
    const pr = this.audio(p).then(full => {
      if (!full) return null;
      if (!had && !this._pinned.has(p)) { this._buf.delete(p); this._size.delete(p); }
      const sr = full.sampleRate, s0 = Math.max(0, Math.floor(from * sr)), s1 = Math.min(full.length, Math.max(s0 + 1, Math.floor(to * sr)));
      const clip = G.audio.ctx.createBuffer(full.numberOfChannels, s1 - s0, sr);
      for (let c = 0; c < full.numberOfChannels; c++) clip.copyToChannel(full.getChannelData(c).subarray(s0, s1), c);
      if (this._buf.get(key) === pr) { this._size.set(key, clip.length * clip.numberOfChannels * 4); this.trimAudio(); }
      return clip;
    });
    this._buf.set(key, pr);
    return pr;
  },
  // keep these decoded no matter what (the song being played); replaces the previous song's pins
  pinSong(paths) {
    for (const k of this._songPins || []) this._pinned.delete(k);
    this._songPins = paths.filter(Boolean);
    for (const k of this._songPins) this._pinned.add(k);
  },
  trimAudio() {
    let total = 0; for (const v of this._size.values()) total += v;
    if (total <= this.AUDIO_BUDGET) return;
    const now = performance.now();
    const order = [...this._size.keys()].sort((a, b) => (this._use.get(a) || 0) - (this._use.get(b) || 0));
    for (const k of order) {
      if (total <= this.AUDIO_BUDGET) break;
      const sz = this._size.get(k);
      if (sz < 2e6 || this._pinned.has(k) || now - (this._use.get(k) || 0) < 8000) continue;
      this._buf.delete(k); this._size.delete(k); total -= sz;   // a sound still playing keeps its own copy until it ends
    }
  },
  sound(p) { // "lib:sounds/name" style helper -> path
    return p;
  },
};
// FNF's real VCR font (falls back to VT323 from the base build)
G.FONT.vcr = "'VCR', 'FNFVcr', 'Courier New', monospace";
G.FONT.f5 = "'5by7', 'VCR', monospace";
G.FONT.f5b = "'5by7b', '5by7', 'VCR', monospace";
G.FONT.gone = "'YoureGone', 'VCR', sans-serif";
G.FONT.pixel = "'PixelArial', 'VCR', monospace";
G.assetsReady = (async function () {
  // FNF's own fonts: VCR (HUD/menus) and 5by7 (freeplay)
  for (const [file, name] of [['fonts/vcr.ttf', 'VCR'], ['fonts/5by7.ttf', '5by7'], ['fonts/5by7_b.ttf', '5by7b'], ['fonts/YoureGone-Regular.otf', 'YoureGone'], ['fonts/pixel.otf', 'PixelArial']]) {
    const f = G.A.raw[file];
    if (!f) continue;
    try {
      const bin = atob(f.slice(f.indexOf(',') + 1)); const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const ff = new FontFace(name, u8.buffer); await ff.load(); document.fonts.add(ff);
    } catch (e) { /* fallback font is fine */ }
  }
  await G.A.loadImages();
})();
G.HAS_FNF = Object.keys(G.A.raw).length > 0;
// the asset <script> tag's own text (the whole ~110 MB pack a second time) isn't needed once it has run
(function () { const el = document.getElementById('fnf-assets'); if (el) el.remove(); try { delete window.__FNF_ASSETS; } catch (e) { window.__FNF_ASSETS = null; } })();
