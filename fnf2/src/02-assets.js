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
    const img = this._img.get(p);
    if (img) return img;
    return this.raw[p] && p.endsWith('.png') ? this._load(p) : null;
  },
  HEAVY: 8e6,
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
    this._img.set(p, img);
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
  // audio: decoded on demand and cached
  audio(p) {
    if (this._buf.has(p)) return this._buf.get(p);
    const data = this.raw[p];
    if (!data || !G.audio || !G.audio.ctx) return Promise.resolve(null);
    const b64 = data.slice(data.indexOf(',') + 1);
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const pr = new Promise(res => {
      try { G.audio.ctx.decodeAudioData(u8.buffer, b => res(b), () => res(null)); } catch (e) { res(null); }
    });
    this._buf.set(p, pr);
    return pr;
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
G.assetsReady = (async function () {
  // FNF's own fonts: VCR (HUD/menus) and 5by7 (freeplay)
  for (const [file, name] of [['fonts/vcr.ttf', 'VCR'], ['fonts/5by7.ttf', '5by7'], ['fonts/5by7_b.ttf', '5by7b'], ['fonts/YoureGone-Regular.otf', 'YoureGone']]) {
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
