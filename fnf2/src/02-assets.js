// FNF 2 - asset access. In the private build, window.__FNF_ASSETS maps
// "lib/path/file.ext" -> data URL (images, audio, fonts) or text (json, xml, txt).
// Library rules follow FNF's Paths: "shared:characters/bf" -> shared/images/characters/bf,
// "default:ui/x" -> preload/images/ui/x, no library -> search shared then preload.

G.A = {
  raw: window.__FNF_ASSETS || (window.__FNF_ASSETS = {}),

  _img: new Map(),     // path -> HTMLImageElement (decoded)
  _json: new Map(),
  // data files the game makes itself (WRATH's eye): kept apart, the cache above is emptied once the mod packs are in
  made: {},
  _buf: new Map(),     // path -> Promise<AudioBuffer>
  has(p) { return p in this.raw || G.Packs.owner.has(p); },
  text(p) { const v = this.raw[p]; return typeof v === 'string' && !v.startsWith('data:') ? v : null; },
  json(p) {
    // our own characters are made on first use from a real one (15-forge.js)
    if (p.startsWith('preload/data/characters/') && G.OWN && G.Forge) { const id = p.slice(24, -5); if (G.OWN[id] && !G.Forge.built[id]) G.Forge.ensure(id); }
    if (this._json.has(p)) return this._json.get(p);
    if (this.made[p]) return this.made[p];
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
      if (this.has(base + '.png') || this.raw[base + '.xml'] || this.raw[base + '/Animation.json']) return base;   // (has: also a mod pack picture not loaded yet)
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
    if (img) { this.touch(img); return img; }
    if (this.raw[p]) return p.endsWith('.png') ? this._load(p) : null;
    // a picture in a mod pack's body that isn't loaded yet: the body loads, then it decodes (the screen waits)
    const pk = G.Packs.owner.get(p);
    return pk && p.endsWith('.png') ? this._loadPacked(p, pk) : null;
  },
  _loadPacked(p, pk) {
    const img = new Image(), d = pk.body[p];
    if (d && d[1]) { img.width = d[1]; img.height = d[2]; }
    img._pack = pk;
    this._img.set(p, img); this._touch.set(img, this._gen); this._weak.delete(p); pk.used = this._gen;
    const pr = G.Packs.needBody(pk).then(ok => {
      if (!ok || !this.raw[p]) return;
      img.src = this.raw[p];
      return img.decode ? img.decode() : new Promise(r => { img.onload = r; });
    }).catch(() => {}).then(() => { this.pending.delete(pr); this.fresh.push(img); });
    this.pending.add(pr);
    return img;
  },
  // Memory: only pictures under 2 MB (once decoded) are decoded at boot (~110 MB, menus + UI). Bigger
  // ones decode when a screen asks for them (the screen waits). A few seconds after every screen change,
  // big pictures that screen never asked for are let go, so memory doesn't keep growing with every
  // stage you visit (it used to hold 370 MB at boot and climb past 1 GB).
  HEAVY: G.phone ? 0.6e6 : 2e6,
  // big ones that are always ready anyway (the loading screen has to show right away; the arrows are in every song)
  KEEP: new Set(['preload/images/funkay.png', 'shared/images/noteStrumline.png', 'shared/images/notes.png']),     // (phones decode even less at boot: they have much less memory)
  _gen: 0, _touch: new WeakMap(), _weak: new Map(), _releaseAt: 0,
  touch(img) { if (img) { this._touch.set(img, this._gen); if (img._pack) img._pack.used = this._gen; } },   // (a mod pack's picture: the pack is in use too)
  newScreen() { this._gen++; this._releaseAt = performance.now() + 2500; },
  releaseUnused() {
    let freed = 0;
    for (const [p, img] of this._img) {
      if (this._touch.get(img) === this._gen || img.width * img.height * 4 < this.HEAVY || img._keep) continue;
      this._img.delete(p); this._weak.set(p, new WeakRef(img));
      if (G.Sparrow && G.Sparrow.forget) G.Sparrow.forget(img);
      if (G.Atlas && G.Atlas.forget) G.Atlas.forget(img);
      freed += img.width * img.height * 4;
    }
    for (const [p, w] of this._weak) if (!w.deref()) this._weak.delete(p);
    if (G.Pin) G.Pin.releaseUnused(this._gen);
    G.Packs.releaseUnused(this._gen);
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
      if (d && d[0] * d[1] * 4 >= this.HEAVY && !this.KEEP.has(p)) continue;
      const img = this._load(p); n++;
      if (this.KEEP.has(p)) img._keep = true;
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
  AUDIO_BUDGET: G.phone ? 140e6 : 280e6,
  _use: new Map(), _size: new Map(), _pinned: new Set(['preload/music/freakyMenu/freakyMenu.ogg']),
  audio(p) {
    this._use.set(p, performance.now());
    if (this._buf.has(p)) return this._buf.get(p);
    const data = this.raw[p];
    if (!data && G.Packs.owner.has(p)) {   // in a mod pack's body: load the body first
      const pk = G.Packs.owner.get(p); pk.used = this._gen;
      return G.Packs.needBody(pk).then(ok => ok && this.raw[p] ? this.audio(p) : null);
    }
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
    // a mod song that isn't loaded: its pack has the preview part cut out already (no need to load the whole mod)
    const pv = !this.raw[p] && G.Packs.preview(p, from, to);
    if (pv) { const pr = this.audio(pv); this._buf.set(key, pr); pr.then(b => { if (b && this._buf.get(key) === pr) { this._size.set(key, b.length * b.numberOfChannels * 4); this.trimAudio(); } }); return pr; }
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
// ------------------------------------------------------------------ mod packs
// Every mod is its own pack: two files in the packs/ folder next to the game.
//   <id>.head.js  small: the mod's data (songs, charts, stages, characters, dialogue, weeks), its small pictures
//                 (icons, freeplay + character select art), fonts and a short preview of every song. Read when the
//                 game starts, so its songs are in freeplay + story mode.
//   <id>.body.js  big: the mod's pictures, music and videos. Only read when something of the mod is needed (you
//                 play one of its songs...), and let go again a few seconds after you leave (memory).
// packs/index.js lists them. Phones and the Game System app can't read a folder: Options > Mods > Load Packs
// keeps the files in the browser (IndexedDB) instead. Mods can be switched off (Options > Mods).
G.Packs = {
  all: {},              // id -> {id, name, credit, src: 'folder' | 'saved', head: true when it's in, body: {path: [bytes, w, h]}, bodyLoaded}
  owner: new Map(),     // a body file's path -> its pack
  heads: new Map(),     // a head file's path -> every pack that brings it (two mods can both have 'speakers/bf.json')
  previews: new Map(),  // 'songs/x/Inst.ogg' -> [from, to] (seconds): the preview cut into the head as path + '#preview'
  folder: [],           // what packs/index.js lists
  keep: G.phone ? 0 : 1,   // how many packs not in use stay loaded (PC: the last one, so playing it again is instant)
  settings() { return G.store.get('fnf2.packs', {}) || {}; },
  isOn(id) { return this.settings()[id] !== false; },
  setOn(id, on) { const s = this.settings(); s[id] = !!on; G.store.set('fnf2.packs', s); },
  has(id) { return !!(this.all[id] && this.all[id].head); },
  loadingNow: null,
  loadScript(src) {
    return new Promise(res => {
      const el = document.createElement('script'); el.src = src; el.async = true;
      el.onload = () => { el.remove(); res(true); }; el.onerror = () => { el.remove(); res(false); };
      document.head.appendChild(el);
    });
  },
  // ---- the head scripts call these
  register(meta, head) {
    if (this.all[meta.id] && this.all[meta.id].head) return;   // (the folder one wins over a saved copy)
    const p = this.all[meta.id] = Object.assign(this.all[meta.id] || {}, meta, { head: true, bodyLoaded: false, src: this._src || 'folder' });
    Object.assign(G.A.raw, head);
    p.headFiles = head;
    for (const k in head) { const l = this.heads.get(k); if (l) l.push(meta.id); else this.heads.set(k, [meta.id]); }
    for (const k in p.body) this.owner.set(k, p);
    for (const k in p.previews || {}) this.previews.set(k, p.previews[k]);
    // its weeks go after the others in story mode + freeplay
    for (const w of p.weeks || []) if (G.WEEK_ORDER && !G.WEEK_ORDER.includes(w)) G.WEEK_ORDER.push(w);
  },
  // (a big body comes in parts, each file under 100 MB so it fits on GitHub: part k of n)
  gotBody(id, files, k, n) {
    const p = this.all[id]; if (!p) return;
    Object.assign(G.A.raw, files); p.bodyKeys = (p.bodyKeys || []).concat(Object.keys(files));
    p._parts = (p._parts || 0) + 1;
    if (p._parts >= (n || 1)) p.bodyLoaded = true;
  },
  partName(id, k) { return id + '.body' + (k > 1 ? k : '') + '.js'; },
  // which pack a head file came from (the first one that has it), and a json read from one pack's own copy
  // (a mod's talking scene uses its own speakers, not another mod's file with the same name)
  packOf(path) { const l = this.heads.get(path); return l ? l[0] : null; },
  jsonIn(id, path) {
    const p = id && this.all[id], t = p && p.headFiles && p.headFiles[path];
    if (typeof t !== 'string' || t.startsWith('data:')) return G.A.json(path);
    p._json = p._json || new Map();
    if (!p._json.has(path)) { let v = null; try { v = JSON.parse(t); } catch (e) {} p._json.set(path, v); }
    return p._json.get(path);
  },
  // ---- body: loaded when one of its files is asked for
  needBody(p) {
    if (p.bodyLoaded) return Promise.resolve(true);
    if (p.loading) return p.loading;
    this.loadingNow = p; p.loadT0 = performance.now();
    p.loading = (async () => {
      let ok = true; p._parts = 0; p.bodyKeys = null;
      for (let k = 1; ok && k <= (p.bodyParts || 1); k++) {
        let src = 'packs/' + this.partName(p.id, k), blob = null;
        if (p.src === 'saved') { blob = await this.idb('get', this.partName(p.id, k)); if (!blob) { ok = false; break; } src = URL.createObjectURL(blob); }
        ok = await this.loadScript(src);
        if (blob) URL.revokeObjectURL(src);
      }
      p.loading = null; if (this.loadingNow === p) this.loadingNow = null;
      if (!ok || !p.bodyLoaded) G.toast && G.toast('Could not load ' + (p.name || p.id) + ' (its pack file is missing)', '#ff7070');
      return ok && p.bodyLoaded;
    })();
    return p.loading;
  },
  unloadBody(p) {
    for (const k of p.bodyKeys || []) {
      delete G.A.raw[k];
      const img = G.A._img.get(k);
      if (img) { G.A._img.delete(k); if (G.Pin) G.Pin.drop(img); if (G.Sparrow && G.Sparrow.forget) G.Sparrow.forget(img); if (G.Atlas && G.Atlas.forget) G.Atlas.forget(img); }
      G.A._weak.delete(k);
      if (!G.A._pinned.has(k)) { G.A._buf.delete(k); G.A._size.delete(k); }
    }
    p.bodyKeys = null; p.bodyLoaded = false; p._parts = 0;
  },
  // packs this screen didn't use: let go (PC keeps the last one used)
  releaseUnused(gen) {
    const idle = Object.values(this.all).filter(p => p.bodyLoaded && !p.loading && p.used !== gen).sort((a, b) => (b.used || 0) - (a.used || 0));
    for (const p of idle.slice(this.keep)) this.unloadBody(p);
  },
  preview(path, from, to) {
    const w = this.previews.get(path);
    return w && Math.abs(w[0] - from) < 0.05 && Math.abs(w[1] - to) < 0.05 && G.A.raw[path + '#preview'] ? path + '#preview' : null;
  },
  // ---- saved packs (phones / Game System): IndexedDB 'fnf2-packs', file name -> Blob
  _db: null,
  idb(op, key, val) {
    return new Promise(res => {
      try {
        const go = db => {
          const tx = db.transaction('files', op === 'get' || op === 'keys' ? 'readonly' : 'readwrite'), st = tx.objectStore('files');
          const r = op === 'get' ? st.get(key) : op === 'keys' ? st.getAllKeys() : op === 'put' ? st.put(val, key) : st.delete(key);
          r.onsuccess = () => res(op === 'put' || op === 'del' ? true : r.result); r.onerror = () => res(null);
        };
        if (this._db) return go(this._db);
        const rq = indexedDB.open('fnf2-packs', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('files');
        rq.onsuccess = () => { this._db = rq.result; go(this._db); };
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  },
  // the first line of every pack file says what it is: /*FNF-PACK {"id":..,"name":..,"part":"head"|"body"}*/
  async readMeta(blob) {
    try { const t = await blob.slice(0, 600).text(), m = /^\/\*FNF-PACK (\{.*?\})\*\//.exec(t); return m ? JSON.parse(m[1]) : null; } catch (e) { return null; }
  },
  // a .zip (the update's own zip, so phones never have to unzip anything): its pack files, read straight out of it.
  // Only the central directory is read whole; each pack is a slice of the zip (stored) or unpacked as a stream
  // (deflate), so a 400 MB zip never sits in memory.
  async unzip(file) {
    const u16 = (d, o) => d.getUint16(o, true), u32 = (d, o) => d.getUint32(o, true);
    const tailLen = Math.min(file.size, 65557), tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
    let e = -1; for (let i = tailLen - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { e = i; break; }
    if (e < 0) return [];
    const count = u16(tail, e + 10), cdSize = u32(tail, e + 12), cdOff = u32(tail, e + 16);
    const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), dec = new TextDecoder();
    const out = [];
    for (let i = 0, o = 0; i < count && o + 46 <= cd.byteLength; i++) {
      const method = u16(cd, o + 10), csize = u32(cd, o + 20), nlen = u16(cd, o + 28), xlen = u16(cd, o + 30), clen = u16(cd, o + 32), lho = u32(cd, o + 42);
      const name = dec.decode(new Uint8Array(cd.buffer, o + 46, nlen));
      o += 46 + nlen + xlen + clen;
      if (!/(\.(head|body\d*)\.js|fnf2-data\/\d+\.js)$/.test(name) || (method !== 0 && method !== 8)) continue;
      const lh = new DataView(await file.slice(lho, lho + 30).arrayBuffer());
      const start = lho + 30 + u16(lh, 26) + u16(lh, 28), raw = file.slice(start, start + csize);
      const blob = method === 0 ? raw : await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      out.push(blob);
    }
    return out;
  },
  // Options > Mods > Load Packs: pick the pack files (any number) or the update's zip, they're kept in the browser
  async save(files) {
    const done = [];
    this.savedData = 0;
    // (ask the browser to keep it for good: a phone low on space could clear a site's data otherwise)
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    const list = [];
    for (const f of files) {
      // (a zip by what's inside, not its name: phones can save it as 'main', 'main.zip.download', ...)
      const zip = /\.zip$/i.test(f.name || '') || await f.slice(0, 4).text().then(t => t === 'PK\x03\x04').catch(() => false);
      if (zip) { try { list.push(...await this.unzip(f)); } catch (e) { G.reportError(e, 'unzip ' + f.name); } }
      else list.push(f);
    }
    for (const f of list) {
      // (the game's own pictures + music, when the game file came without its fnf2-data folder: phones)
      const d = await this.readData(f);
      if (d) { if (await this.idb('put', 'fnf2-data.' + d.n + '.js', f)) this.savedData++; continue; }
      const m = await this.readMeta(f);
      if (!m || !m.id || !/^(head|body)$/.test(m.part)) continue;
      if (await this.idb('put', m.part === 'body' ? this.partName(m.id, m.n || 1) : m.id + '.head.js', f)) done.push(m);
    }
    return done;
  },
  async readData(blob) {
    try { const t = await blob.slice(0, 200).text(), m = /^\/\*FNF-DATA (\{.*?\})\*\//.exec(t); return m ? JSON.parse(m[1]) : null; } catch (e) { return null; }
  },
  async forget(id) { await this.idb('del', id + '.head.js'); for (let k = 1; k <= ((this.all[id] && this.all[id].bodyParts) || 1); k++) await this.idb('del', this.partName(id, k)); },
  // the game's own data next to it (fnf2-data/1.js ... as <script> tags) didn't come in: a phone opened the game file
  // on its own. Use the copy kept in the browser (picked from the zip once).
  async bootData() {
    const n = window.__FNF_DATA_N || 0;
    if (!n || (window.__FNF_DATA_OK || 0) >= n) return true;
    window.__FNF_DATA_OK = 0;
    for (let k = 1; k <= n; k++) {
      const blob = await this.idb('get', 'fnf2-data.' + k + '.js'); if (!blob) return false;
      window.__FNF_ASSETS = G.A.raw;    // (the pieces fill the game's own table: set again here, the boot clears it)
      const url = URL.createObjectURL(blob); await this.loadScript(url); URL.revokeObjectURL(url);
    }
    try { delete window.__FNF_ASSETS; } catch (e) { window.__FNF_ASSETS = null; }
    return (window.__FNF_DATA_OK || 0) >= n;
  },
  async boot() {
    // 1. the packs/ folder next to the game (PC)
    window.FNF_PACK_INDEX = list => { this.folder = list || []; };
    window.FNF_PACK = (meta, head) => this.register(meta, head);
    window.FNF_PACK_BODY = (id, files, k, n) => this.gotBody(id, files, k, n);
    if (await this.loadScript('packs/index.js')) {
      this._src = 'folder';
      for (const e of this.folder) {
        this.all[e.id] = Object.assign(this.all[e.id] || {}, e, { src: 'folder' });
        if (this.isOn(e.id)) await this.loadScript('packs/' + e.id + '.head.js');
      }
    }
    // 2. packs kept in the browser
    const keys = await this.idb('keys');
    this._src = 'saved';
    for (const k of keys || []) {
      const m = /^(.+)\.head\.js$/.exec(k); if (!m || (this.all[m[1]] && this.all[m[1]].src === 'folder')) continue;
      const blob = await this.idb('get', k), meta = blob && await this.readMeta(blob);
      this.all[m[1]] = Object.assign(this.all[m[1]] || {}, meta || { id: m[1] }, { src: 'saved' });
      // only half of it saved (no body): its songs couldn't load, so it stays out until the body is loaded too
      const parts = (meta && meta.parts) || 1;
      let miss = false; for (let k = 1; k <= parts; k++) if (!keys.includes(this.partName(m[1], k))) miss = true;
      if (miss) { this.all[m[1]].missingBody = true; continue; }
      if (!blob || !this.isOn(m[1])) continue;
      const url = URL.createObjectURL(blob); await this.loadScript(url); URL.revokeObjectURL(url);
    }
    this._src = null;
  },
};

// FNF's real VCR font (falls back to VT323 from the base build)
G.FONT.vcr = "'VCR', 'FNFVcr', 'Courier New', monospace";
G.FONT.f5 = "'5by7', 'VCR', monospace";
G.FONT.f5b = "'5by7b', '5by7', 'VCR', monospace";
G.FONT.gone = "'YoureGone', 'VCR', sans-serif";
G.FONT.pixel = "'PixelArial', 'VCR', monospace";
G.assetsReady = (async function () {
  try { G.dataMissing = !(await G.Packs.bootData()); } catch (e) { G.dataMissing = true; G.reportError(e, 'data'); }
  try { await G.Packs.boot(); } catch (e) { G.reportError(e, 'packs'); }
  // anything read before the packs came in (and maybe found missing, or overridden by a pack since) is read again
  G.A._json.clear(); if (G.Sparrow) G.Sparrow.cache.clear(); if (G.Atlas) G.Atlas.cache.clear();
  // FNF's own fonts: VCR (HUD/menus) and 5by7 (freeplay)
  const known = [['fonts/vcr.ttf', 'VCR'], ['fonts/5by7.ttf', '5by7'], ['fonts/5by7_b.ttf', '5by7b'], ['fonts/YoureGone-Regular.otf', 'YoureGone'], ['fonts/pixel.otf', 'PixelArial']];
  // mods bring their own fonts (fonts/mods/<name>.ttf|otf): they're registered under their file name
  for (const k in G.A.raw) if (/^fonts\/mods\/.+\.(ttf|otf)$/i.test(k)) known.push([k, k.slice(11).replace(/\.(ttf|otf)$/i, '')]);
  for (const [file, name] of known) {
    const f = G.A.raw[file];
    if (!f) continue;
    try {
      const bin = atob(f.slice(f.indexOf(',') + 1)); const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const ff = new FontFace(name, u8.buffer); await ff.load(); document.fonts.add(ff);
    } catch (e) { /* fallback font is fine */ }
  }
  G.HAS_FNF = Object.keys(G.A.raw).length > 0;
  await G.A.loadImages();
})();
G.HAS_FNF = Object.keys(G.A.raw).length > 0;
// the asset <script> tag's own text (the whole ~110 MB pack a second time) isn't needed once it has run
(function () { for (const el of document.querySelectorAll('#fnf-assets, script.fnf-assets')) el.remove(); try { delete window.__FNF_ASSETS; } catch (e) { window.__FNF_ASSETS = null; } })();
