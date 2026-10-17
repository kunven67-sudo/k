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
  image(p) { return this._img.get(p) || null; },
  // decode every packed image once (fast: WebP data URLs), so drawing never waits
  loadImages(filter) {
    const jobs = [];
    for (const p in this.raw) {
      if (!p.endsWith('.png') || this._img.has(p) || (filter && !filter(p))) continue;
      const img = new Image();
      img.src = this.raw[p];
      this._img.set(p, img);
      jobs.push((img.decode ? img.decode() : new Promise(r => { img.onload = r; })).catch(() => {}).then(() => {
        done++; const el = document.getElementById('boot'); if (el) el.textContent = 'Loading... ' + Math.round(done / jobs.length * 100) + '%';
      }));
    }
    let done = 0;
    return Promise.all(jobs);
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
