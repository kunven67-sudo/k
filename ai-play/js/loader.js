/* AI Play - loads a game file (or a whole game folder) into a sandbox the AI can see and control.
 *
 * How it works: the game's files get turned into in-memory "blob" URLs, the game's HTML is
 * rewritten to point at them, and a tiny "shim" script is injected at the very top of the game.
 * The shim gives the game a FAKE localStorage (so the AI gets its own fresh save and never sees
 * or touches yours), lets AI Play read the pixels + text the game draws, and fakes mouse lock.
 */
'use strict';

AIP.loader = (function () {
  const FAKE = 'http://aiplay.game/';
  const MIME = {
    html: 'text/html', htm: 'text/html', js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
    css: 'text/css', json: 'application/json', map: 'application/json', txt: 'text/plain', xml: 'application/xml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg',
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    wasm: 'application/wasm', glb: 'model/gltf-binary', gltf: 'model/gltf+json', obj: 'text/plain', bin: 'application/octet-stream',
  };
  const ext = (p) => { const m = /\.([a-z0-9]+)$/i.exec(p); return m ? m[1].toLowerCase() : ''; };
  const mimeOf = (p) => MIME[ext(p)] || 'application/octet-stream';
  const isHtml = (p) => /\.html?$/i.test(p);
  const dirOf = (p) => (p.indexOf('/') >= 0 ? p.slice(0, p.lastIndexOf('/') + 1) : '');

  /* ---------- importing files into the library ---------- */
  async function fromFileList(fileList) {
    const files = {};
    const arr = Array.from(fileList || []);
    if (!arr.length) throw new Error('no files picked');
    // Folder picks come with "folder/sub/file.js" paths - strip the top folder name.
    const rel = arr.map((f) => (f.webkitRelativePath || f.name).replace(/\\/g, '/'));
    const tops = new Set(rel.map((r) => (r.indexOf('/') > 0 ? r.split('/')[0] : '')));
    const strip = tops.size === 1 && rel.every((r) => r.indexOf('/') > 0);
    arr.forEach((f, i) => {
      let p = rel[i];
      if (strip) p = p.slice(p.indexOf('/') + 1);
      if (/(^|\/)(\.git|node_modules)\//.test(p)) return;
      files[p] = f;
    });
    return makeGame(files, strip ? [...tops][0] : null);
  }

  // Drag + drop can include folders (via the old-but-works webkitGetAsEntry API).
  async function fromDataTransfer(dt) {
    const items = Array.from(dt.items || []).map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null)).filter(Boolean);
    if (!items.length) return fromFileList(dt.files);
    const files = {};
    async function walk(entry, path) {
      if (entry.isFile) {
        const f = await new Promise((res, rej) => entry.file(res, rej));
        files[path + entry.name] = f;
      } else if (entry.isDirectory) {
        if (entry.name === '.git' || entry.name === 'node_modules') return;
        const reader = entry.createReader();
        let batch;
        do {
          batch = await new Promise((res, rej) => reader.readEntries(res, rej));
          for (const e of batch) await walk(e, path + entry.name + '/');
        } while (batch.length);
      }
    }
    for (const e of items) await walk(e, '');
    let folder = null;
    if (items.length === 1 && items[0].isDirectory) {
      folder = items[0].name;
      const pre = folder + '/';
      const out = {};
      Object.keys(files).forEach((k) => { out[k.slice(pre.length)] = files[k]; });
      return makeGame(out, folder);
    }
    return makeGame(files, folder);
  }

  async function makeGame(files, folderName) {
    const paths = Object.keys(files);
    const htmls = paths.filter(isHtml).sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
    if (!htmls.length) throw new Error("there's no .html file in there, so I can't find the game 😢");
    const entry = htmls.find((p) => /(^|\/)index\.html?$/i.test(p) && p.split('/').length === htmls[0].split('/').length) || htmls[0];
    const blobs = {};
    let size = 0;
    for (const p of paths) {
      const f = files[p];
      size += f.size || 0;
      blobs[p] = f instanceof Blob ? new Blob([f], { type: f.type || mimeOf(p) }) : new Blob([f], { type: mimeOf(p) });
    }
    const html = await blobs[entry].text();
    const t = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    let name = (t && t[1].trim()) || folderName || entry.replace(/\.html?$/i, '');
    name = name.replace(/\s*\(\d+\)$/, '').slice(0, 60);
    return {
      id: AIP.util.uid(), name, entry, files: blobs, size,
      isFolder: paths.length > 1, addedAt: Date.now(), thumb: null,
    };
  }

  /* ---------- saving a game's internet parts so it works OFFLINE ---------- */
  // Lots of games load stuff from the internet (like Three.js from a CDN, or Google Fonts).
  // When we're online, grab a copy of those and keep it with the game, so next time no internet is needed.
  async function fetchWithTimeout(url, ms) {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ac && ac.abort(), ms);
    try { return await fetch(url, ac ? { signal: ac.signal, mode: 'cors' } : { mode: 'cors' }); } finally { clearTimeout(t); }
  }
  function offlinePath(url, type) {
    const u = new URL(url);
    let p = '_offline/' + u.host + u.pathname.replace(/\/+$/, '/index');
    if (u.search) p += '_' + AIP.util.hashStr(u.search).toString(36);
    if (!/\.[a-z0-9]{1,5}$/i.test(p)) p += /css/.test(type) ? '.css' : /javascript/.test(type) ? '.js' : '';
    return p.replace(/[^\w./-]/g, '_');
  }
  async function cacheExternals(game) {
    game.offline = game.offline || {};
    const out = { changed: false, failed: [], saved: 0 };
    let html = '';
    try { html = await game.files[game.entry].text(); } catch (e) { return out; }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const want = [];
    doc.querySelectorAll('script[src]').forEach((e) => want.push(e.getAttribute('src')));
    doc.querySelectorAll('link[href]').forEach((e) => { if (/stylesheet|preload|modulepreload/i.test(e.getAttribute('rel') || '')) want.push(e.getAttribute('href')); });
    const ext = [...new Set(want.filter((u) => /^https?:\/\//i.test(u || '') && !game.offline[u]))];
    for (const url of ext) {
      try {
        const r = await fetchWithTimeout(url, 10000);
        if (!r.ok) { out.failed.push(url); continue; }
        const type = (r.headers.get('content-type') || '').split(';')[0] || mimeOf(url);
        const path = offlinePath(url, type);
        let blob = await r.blob();
        if (/css/.test(type)) {
          // a stylesheet from the internet can point at more internet stuff (fonts) - grab those too
          let css = await blob.text();
          const inner = [...new Set([...css.matchAll(/url\(\s*['"]?(https?:\/\/[^'")\s]+)['"]?\s*\)/g)].map((m) => m[1]))].slice(0, 40);
          for (const fu of inner) {
            try {
              const fr = await fetchWithTimeout(fu, 10000);
              if (!fr.ok) continue;
              const ft = (fr.headers.get('content-type') || '').split(';')[0] || mimeOf(fu);
              const fp = offlinePath(fu, ft);
              game.files[fp] = new Blob([await fr.arrayBuffer()], { type: ft });
              // point the stylesheet at our copy (written relative to where the stylesheet lives)
              css = css.split(fu).join('../'.repeat(path.split('/').length - 1) + fp);
            } catch (e) { /* that font stays online-only */ }
          }
          blob = new Blob([css], { type: 'text/css' });
        } else blob = new Blob([await blob.arrayBuffer()], { type });
        game.files[path] = blob;
        game.offline[url] = path;
        out.changed = true; out.saved++;
      } catch (e) { out.failed.push(url); }
    }
    return out;
  }
  /* ---------- building the sandboxed game page ---------- */

  // Finds every import specifier in a JS module and lets us swap it out.
  const STATIC_IMPORT = /(\bimport\s*(?:[\w$*{}\s,]+?\s*from\s*)?|\bexport\s*(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*)(['"])([^'"\n]+)\2/g;
  const DYNAMIC_IMPORT = /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;

  function specifiers(code) {
    const out = [];
    let m;
    STATIC_IMPORT.lastIndex = 0;
    while ((m = STATIC_IMPORT.exec(code))) out.push(m[3]);
    DYNAMIC_IMPORT.lastIndex = 0;
    while ((m = DYNAMIC_IMPORT.exec(code))) out.push(m[2]);
    return out;
  }
  function rewriteSpecifiers(code, baseUrl) {
    const fix = (spec) => {
      if (/^(\.\.?\/|\/)/.test(spec)) {
        try { return new URL(spec, baseUrl).href; } catch (e) { return spec; }
      }
      return spec;
    };
    code = code.replace(STATIC_IMPORT, (all, head, q, spec) => head + q + fix(spec) + q);
    code = code.replace(DYNAMIC_IMPORT, (all, q, spec) => 'import(' + q + fix(spec) + q + ')');
    code = code.replace(/\bimport\.meta\.url\b/g, JSON.stringify(baseUrl));
    return code;
  }
  const fakePath = (url) => {
    try {
      const u = new URL(url);
      if (u.origin + '/' !== FAKE) return null;
      return decodeURIComponent(u.pathname.replace(/^\//, ''));
    } catch (e) { return null; }
  };
  function rewriteCss(css, cssPath, urlFor) {
    const base = FAKE + cssPath;
    const fix = (u) => {
      if (/^(data:|blob:|https?:|#)/i.test(u)) return u;
      const p = fakePath(new URL(u, base).href);
      return (p && urlFor(p)) || u;
    };
    css = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, u) => 'url(' + q + fix(u.trim()) + q + ')');
    css = css.replace(/@import\s+(['"])([^'"]+)\1/g, (all, q, u) => '@import ' + q + fix(u) + q);
    return css;
  }

  /**
   * Turns a library game into a full HTML string ready for <iframe srcdoc>.
   * sandbox = { id, store } -> the AI's own private save data for this game.
   * Returns { html, revoke() }.
   */
  async function build(game, sandbox) {
    const urls = [];
    const made = {};
    const files = game.files;
    const entry = game.entry;
    const entryDir = dirOf(entry);
    const mk = (blob, type) => { const u = URL.createObjectURL(type ? new Blob([blob], { type }) : blob); urls.push(u); return u; };

    const srcText = await files[entry].text();
    const doc = new DOMParser().parseFromString(srcText, 'text/html');

    // --- import maps the game already has ---
    let gameMap = { imports: {}, scopes: {} };
    doc.querySelectorAll('script[type="importmap"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent);
        Object.assign(gameMap.imports, j.imports || {});
        Object.assign(gameMap.scopes, j.scopes || {});
      } catch (e) { /* broken import map, skip it */ }
      s.remove();
    });
    const htmlBase = FAKE + entry;
    const mapLocal = (val) => { const p = fakePath(new URL(val, htmlBase).href); return p != null && files[p] ? p : null; };
    const resolveBare = (spec) => {
      const im = gameMap.imports;
      if (im[spec]) return mapLocal(im[spec]);
      let best = null;
      Object.keys(im).forEach((k) => { if (k.endsWith('/') && spec.startsWith(k) && (!best || k.length > best.length)) best = k; });
      if (best) return mapLocal(im[best] + spec.slice(best.length));
      return null;
    };
    const resolveSpec = (spec, fromUrl) => {
      if (/^(\.\.?\/|\/)/.test(spec)) { const p = fakePath(new URL(spec, fromUrl).href); return p != null && files[p] ? p : null; }
      if (spec.startsWith(FAKE)) { const p = fakePath(spec); return files[p] ? p : null; }
      if (/^[a-z]+:/i.test(spec)) return null;
      return resolveBare(spec);
    };

    // --- find every JS module (follow imports from module scripts) ---
    const modules = new Set();
    const queue = [];
    const addMod = (p) => { if (p && !modules.has(p)) { modules.add(p); queue.push(p); } };
    const inlineModuleSpecs = [];
    doc.querySelectorAll('script[type="module"]').forEach((s) => {
      const src = s.getAttribute('src');
      if (src) addMod(mapLocal(src));
      else inlineModuleSpecs.push(...specifiers(s.textContent));
    });
    inlineModuleSpecs.forEach((sp) => addMod(resolveSpec(sp, htmlBase)));
    Object.values(gameMap.imports).forEach((v) => { if (typeof v === 'string' && !v.endsWith('/')) { const p = mapLocal(v); if (p && /\.(m?js)$/i.test(p)) addMod(p); } });
    doc.querySelectorAll('link[rel="modulepreload"]').forEach((l) => addMod(mapLocal(l.getAttribute('href') || '')));
    const modText = {};
    while (queue.length) {
      const p = queue.shift();
      let code = '';
      try { code = await files[p].text(); } catch (e) { continue; }
      modText[p] = code;
      specifiers(code).forEach((sp) => addMod(resolveSpec(sp, FAKE + p)));
    }

    // --- blob URLs for every file (modules get rewritten first, CSS gets its url()s fixed) ---
    const urlFor = (p) => made[p] || null;
    for (const p of Object.keys(files)) {
      if (modules.has(p) || ext(p) === 'css' || isHtml(p)) continue;
      made[p] = mk(files[p], files[p].type || mimeOf(p));
    }
    for (const p of modules) {
      const code = modText[p] != null ? modText[p] : '';
      made[p] = mk(rewriteSpecifiers(code, FAKE + p), 'text/javascript');
    }
    for (const p of Object.keys(files)) {
      if (ext(p) !== 'css') continue;
      const css = await files[p].text();
      made[p] = mk(rewriteCss(css, p, urlFor), 'text/css');
    }
    for (const p of Object.keys(files)) if (isHtml(p) && !made[p]) made[p] = mk(files[p], 'text/html');

    // --- the import map we hand the game: fake URLs -> blob URLs, plus the game's own entries ---
    const imports = {};
    for (const p of modules) imports[FAKE + p] = made[p];
    Object.keys(gameMap.imports).forEach((k) => {
      const v = gameMap.imports[k];
      if (typeof v !== 'string') return;
      if (k.endsWith('/') && v.endsWith('/')) {
        const local = /^[a-z]+:/i.test(v) ? null : fakePath(new URL(v, htmlBase).href);
        if (local != null) {
          Object.keys(made).forEach((p) => { if (p.startsWith(local)) imports[k + p.slice(local.length)] = made[p]; });
        } else imports[k] = v;
      } else {
        const p = mapLocal(v);
        imports[k] = p ? made[p] : v;
      }
    });
    const scopes = {};
    Object.keys(gameMap.scopes).forEach((sc) => {
      const o = {};
      Object.keys(gameMap.scopes[sc]).forEach((k) => { const p = mapLocal(gameMap.scopes[sc][k]); o[k] = p ? made[p] : gameMap.scopes[sc][k]; });
      scopes[new URL(sc, htmlBase).href] = o;
    });

    // --- rewrite the HTML ---
    const offline = game.offline || {};
    const fixAttr = (el, attr, baseUrl) => {
      const v = el.getAttribute(attr);
      if (v && offline[v] && made[offline[v]]) { el.setAttribute(attr, made[offline[v]]); el.removeAttribute('integrity'); el.removeAttribute('crossorigin'); return; }
      if (!v || /^(data:|blob:|https?:|javascript:|#|mailto:)/i.test(v)) return;
      const p = fakePath(new URL(v, baseUrl || htmlBase).href);
      if (p != null && made[p]) el.setAttribute(attr, made[p]);
    };
    doc.querySelectorAll('meta[http-equiv]').forEach((m) => { if (/content-security-policy/i.test(m.getAttribute('http-equiv'))) m.remove(); });
    doc.querySelectorAll('base').forEach((b) => b.remove());
    doc.querySelectorAll('script[src]').forEach((s) => fixAttr(s, 'src'));
    doc.querySelectorAll('script[type="module"]:not([src])').forEach((s) => { s.textContent = rewriteSpecifiers(s.textContent, htmlBase); });
    doc.querySelectorAll('link[href]').forEach((l) => fixAttr(l, 'href'));
    doc.querySelectorAll('img[src],audio[src],video[src],source[src],track[src],embed[src],input[src],iframe[src]').forEach((e) => fixAttr(e, 'src'));
    doc.querySelectorAll('video[poster]').forEach((e) => fixAttr(e, 'poster'));
    doc.querySelectorAll('object[data]').forEach((e) => fixAttr(e, 'data'));
    doc.querySelectorAll('img[srcset],source[srcset]').forEach((e) => {
      const v = e.getAttribute('srcset');
      e.setAttribute('srcset', v.split(',').map((part) => {
        const bits = part.trim().split(/\s+/);
        const p = bits[0] && !/^(data:|blob:|https?:)/i.test(bits[0]) ? fakePath(new URL(bits[0], htmlBase).href) : null;
        if (p != null && made[p]) bits[0] = made[p];
        return bits.join(' ');
      }).join(', '));
    });
    doc.querySelectorAll('style').forEach((s) => { s.textContent = rewriteCss(s.textContent, entry, urlFor); });
    doc.querySelectorAll('[style]').forEach((e) => { const v = e.getAttribute('style'); if (/url\(/i.test(v)) e.setAttribute('style', rewriteCss(v, entry, urlFor)); });

    // --- inject: <meta charset>, <base>, the shim, then the import map, all at the very top of <head> ---
    const head = doc.head || doc.documentElement.insertBefore(doc.createElement('head'), doc.body);
    const vfs = {};
    Object.keys(made).forEach((p) => { vfs[p] = made[p]; });
    const cfg = {
      fake: FAKE, entryDir, vfs, store: sandbox.store || {},
      idbPrefix: 'aiplay-sandbox-' + sandbox.id + '-',
    };
    const shim = doc.createElement('script');
    shim.textContent = '(' + SHIM.toString() + ')(' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ');';
    const base = doc.createElement('base');
    base.setAttribute('href', FAKE + entryDir);
    const map = doc.createElement('script');
    map.setAttribute('type', 'importmap');
    map.textContent = JSON.stringify({ imports, scopes }).replace(/</g, '\\u003c');
    const charset = doc.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    head.insertBefore(map, head.firstChild);
    head.insertBefore(shim, head.firstChild);
    head.insertBefore(base, head.firstChild);
    head.insertBefore(charset, head.firstChild);
    doc.querySelectorAll('meta[charset]').forEach((m) => { if (m !== charset) m.remove(); });

    const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    return { html, revoke: () => urls.forEach((u) => URL.revokeObjectURL(u)) };
  }

  /* ---------- THE SHIM: runs inside the game, before the game's own code ---------- */
  // Keep this self-contained: it gets turned into text and injected into the game page.
  function SHIM(CFG) {
    var W = window, D = document;
    var aip = W.__aip = { texts: [], errors: [], alerts: [], frames: 0, store: CFG.store || {}, session: {}, dirty: false, lockEl: null, realLock: false, keysDown: {} };
    var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

    // 1) Fake storage: the AI gets its OWN save, separate from yours.
    function makeStorage(data, persist) {
      var mark = function () { if (persist) aip.dirty = true; };
      var api = {
        getItem: function (k) { k = String(k); return has(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[String(k)] = String(v); mark(); },
        removeItem: function (k) { delete data[String(k)]; mark(); },
        clear: function () { Object.keys(data).forEach(function (k) { delete data[k]; }); mark(); },
        key: function (i) { var ks = Object.keys(data); return i < ks.length ? ks[i] : null; },
      };
      return new Proxy(api, {
        get: function (t, p) {
          if (p === 'length') return Object.keys(data).length;
          if (has(t, p)) return t[p];
          if (typeof p === 'symbol') return undefined;
          return has(data, p) ? data[p] : undefined;
        },
        set: function (t, p, v) { if (has(t, p)) return true; data[String(p)] = String(v); mark(); return true; },
        deleteProperty: function (t, p) { delete data[p]; mark(); return true; },
        has: function (t, p) { return has(t, p) || has(data, p); },
        ownKeys: function () { return Object.keys(data); },
        getOwnPropertyDescriptor: function (t, p) {
          if (has(data, p)) return { value: data[p], writable: true, enumerable: true, configurable: true };
          return undefined;
        },
      });
    }
    var LS = makeStorage(aip.store, true), SS = makeStorage(aip.session, false);
    try { Object.defineProperty(W, 'localStorage', { configurable: true, enumerable: true, get: function () { return LS; } }); } catch (e) { aip.errors.push('storage shim: ' + e.message); }
    try { Object.defineProperty(W, 'sessionStorage', { configurable: true, enumerable: true, get: function () { return SS; } }); } catch (e) { /* ignore */ }
    try {
      var IDBF = W.IDBFactory && W.IDBFactory.prototype;
      if (IDBF) {
        var oOpen = IDBF.open, oDel = IDBF.deleteDatabase, oDbs = IDBF.databases;
        IDBF.open = function (n, v) { return v === undefined ? oOpen.call(this, CFG.idbPrefix + n) : oOpen.call(this, CFG.idbPrefix + n, v); };
        IDBF.deleteDatabase = function (n) { return oDel.call(this, CFG.idbPrefix + n); };
        if (oDbs) IDBF.databases = function () { return oDbs.call(this).then(function (l) { return l.filter(function (x) { return x.name.indexOf(CFG.idbPrefix) === 0; }).map(function (x) { return { name: x.name.slice(CFG.idbPrefix.length), version: x.version }; }); }); };
      }
    } catch (e) { /* ignore */ }

    // 2) Files: when the game asks for "sprites/hero.png", hand it the in-memory copy.
    var FAKE_ORIGIN = CFG.fake.replace(/\/$/, '');
    function mapURL(u) {
      try {
        if (u == null) return u;
        var s = String(u);
        if (/^(blob:|data:|javascript:|about:)/i.test(s)) return u;
        var abs = new URL(s, D.baseURI);
        if (abs.origin !== FAKE_ORIGIN) return u;
        var p = decodeURIComponent(abs.pathname.replace(/^\//, ''));
        return CFG.vfs[p] || u;
      } catch (e) { return u; }
    }
    aip.mapURL = mapURL;
    try {
      var oFetch = W.fetch;
      if (oFetch) W.fetch = function (input, init) {
        if (typeof input === 'string' || (W.URL && input instanceof W.URL)) return oFetch.call(this, mapURL(String(input)), init);
        if (input && input.url) { var m = mapURL(input.url); if (m !== input.url) return oFetch.call(this, m, init); }
        return oFetch.apply(this, arguments);
      };
      var oXO = W.XMLHttpRequest.prototype.open;
      W.XMLHttpRequest.prototype.open = function (m, u) { var a = Array.prototype.slice.call(arguments); a[1] = mapURL(u); return oXO.apply(this, a); };
      var patchProp = function (proto, prop) {
        if (!proto) return;
        var d = Object.getOwnPropertyDescriptor(proto, prop);
        if (!d || !d.set) return;
        Object.defineProperty(proto, prop, { configurable: true, enumerable: d.enumerable, get: d.get, set: function (v) { d.set.call(this, mapURL(v)); } });
      };
      [W.HTMLImageElement, W.HTMLMediaElement, W.HTMLSourceElement, W.HTMLScriptElement, W.HTMLEmbedElement, W.HTMLTrackElement, W.HTMLInputElement].forEach(function (C) { if (C) patchProp(C.prototype, 'src'); });
      if (W.HTMLLinkElement) patchProp(W.HTMLLinkElement.prototype, 'href');
      var oSA = W.Element.prototype.setAttribute;
      W.Element.prototype.setAttribute = function (n, v) {
        var ln = String(n).toLowerCase();
        if ((ln === 'src' || ln === 'href' || ln === 'poster') && /^(IMG|SCRIPT|AUDIO|VIDEO|SOURCE|LINK|EMBED|TRACK|INPUT)$/.test(this.tagName)) v = mapURL(v);
        return oSA.call(this, n, v);
      };
      var OA = W.Audio;
      if (OA) { var NA = function (src) { var a = new OA(); if (src !== undefined) a.src = src; return a; }; NA.prototype = OA.prototype; W.Audio = NA; }
      var OWk = W.Worker;
      if (OWk) { var NW = function (u, o) { return new OWk(mapURL(u), o); }; NW.prototype = OWk.prototype; W.Worker = NW; }
    } catch (e) { aip.errors.push('file shim: ' + e.message); }

    // 3) Eyes: keep 3D canvases readable, and remember all text drawn on canvases (score, HP...).
    try {
      var oGC = W.HTMLCanvasElement.prototype.getContext;
      W.HTMLCanvasElement.prototype.getContext = function (type, opts) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') { opts = Object.assign({}, opts || {}); opts.preserveDrawingBuffer = true; }
        return oGC.call(this, type, opts);
      };
      var C2 = W.CanvasRenderingContext2D.prototype;
      ['fillText', 'strokeText'].forEach(function (fn) {
        var o = C2[fn];
        C2[fn] = function (text, x, y) {
          try {
            var cv = this.canvas;
            if (cv && cv.isConnected) {
              var m = this.getTransform ? this.getTransform() : null;
              if (aip.texts.length > 800) aip.texts.splice(0, 400);
              aip.texts.push({ t: performance.now(), c: cv, s: String(text), x: m ? m.a * x + m.c * y + m.e : x, y: m ? m.b * x + m.d * y + m.f : y, f: this.font });
            }
          } catch (e) { /* ignore */ }
          return o.apply(this, arguments);
        };
      });
    } catch (e) { aip.errors.push('canvas shim: ' + e.message); }

    // 4) Mouse lock: real pointer lock needs a real click, so the AI gets a pretend one.
    try {
      var lockEl = null;
      var oRPL = W.Element.prototype.requestPointerLock;
      var oPLE = Object.getOwnPropertyDescriptor(W.Document.prototype, 'pointerLockElement');
      var oEPL = W.Document.prototype.exitPointerLock;
      var fireLock = function () { try { D.dispatchEvent(new W.Event('pointerlockchange', { bubbles: true })); } catch (e) { /* ignore */ } };
      W.Element.prototype.requestPointerLock = function () {
        if (aip.realLock && oRPL) { try { return oRPL.apply(this, arguments); } catch (e) { /* fall through to fake */ } }
        lockEl = this; aip.lockEl = this;
        setTimeout(fireLock, 0);
        return Promise.resolve();
      };
      Object.defineProperty(W.Document.prototype, 'pointerLockElement', {
        configurable: true,
        get: function () {
          if (aip.realLock && oPLE && oPLE.get) { var r = oPLE.get.call(this); if (r) return r; }
          return lockEl && lockEl.isConnected ? lockEl : null;
        },
      });
      W.Document.prototype.exitPointerLock = function () {
        if (aip.realLock && oEPL) { try { oEPL.call(this); } catch (e) { /* ignore */ } }
        if (lockEl) { lockEl = null; aip.lockEl = null; setTimeout(fireLock, 0); }
      };
      aip.dropLock = function () { if (lockEl) { lockEl = null; aip.lockEl = null; fireLock(); } };
    } catch (e) { aip.errors.push('lock shim: ' + e.message); }

    // 5) No popups / alerts freezing everything / fullscreen grabs.
    try {
      W.alert = function (m) { aip.alerts.push(String(m)); };
      W.confirm = function (m) { aip.alerts.push(String(m)); return true; };
      W.prompt = function (m, d) { aip.alerts.push(String(m)); return d == null ? '' : String(d); };
      W.open = function () { return null; };
      W.Element.prototype.requestFullscreen = function () { return Promise.resolve(); };
      W.Element.prototype.webkitRequestFullscreen = function () {};
    } catch (e) { /* ignore */ }

    // 6) Health check: count frames + catch crashes.
    try {
      var oRAF = W.requestAnimationFrame;
      W.requestAnimationFrame = function (cb) { return oRAF.call(W, function (t) { aip.frames++; cb(t); }); };
    } catch (e) { /* ignore */ }
    W.addEventListener('error', function (e) {
      var msg = e && e.message ? e.message : (e && e.target && (e.target.src || e.target.href) ? "couldn't load " + (e.target.src || e.target.href) : 'error');
      if (aip.errors.length < 50) aip.errors.push(String(msg));
    }, true);
    W.addEventListener('unhandledrejection', function (e) {
      if (aip.errors.length < 50) aip.errors.push('promise: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
    });
  }

  return { fromFileList, fromDataTransfer, makeGame, build, cacheExternals, FAKE };
})();
