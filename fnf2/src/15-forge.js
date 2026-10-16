// FNF 2 - character forge: our own characters, made from the real FNF art.
// A character here = a real FNF character (its drawings + every animation) copied under a new id,
// with its colors repainted. Recoloring works in HSV so the original shading, outlines and
// anti-aliasing stay exactly as drawn. Rules can target the whole sheet or only some parts.
//
// G.OWN[id] = {
//   base: 'pico',                    // real FNF character id (preload/data/characters/<base>.json)
//   name: 'Razor',
//   rules: [ { h: 200, hr: 25, s: [0.25, 1], v: [0.1, 1], to: '#ff3b6a', sat: 1, val: 1 }, ... ],
//   parts: { 'sprite name prefix': [rules] }   // atlas characters: rules only for those spritemap parts
//   icon: true                       // also repaint the health + freeplay icons
//   tweak(data)                      // optional edit of the copied character json (scale, offsets...)
// }
(function () {
  G.OWN = G.OWN || {};

  // ---------------------------------------------------------------- colour helpers
  function rgb2hsv(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx / 255];
  }
  function hsv2rgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  const hex2hsv = hex => rgb2hsv(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  // compile a rule: source region (hue centre/range, sat + value windows) -> target colour
  function compile(r) {
    const c = Object.assign({ hr: 20, s: [0.2, 1], v: [0.08, 1], soft: 8 }, r);
    if (r.from) { const f = hex2hsv(r.from); c.fh = f[0]; c.fs = f[1]; c.fv = f[2]; if (r.h == null) c.h = f[0]; }
    else { c.fh = c.h; c.fs = c.fs || 0.6; c.fv = c.fv || 0.8; }
    if (r.to) { const t = hex2hsv(r.to); c.th = t[0]; c.ts = t[1]; c.tv = t[2]; }
    c.gray = !!r.gray || c.h == null;   // grey rules match whites/greys by value + low saturation (hue ignored)
    return c;
  }
  // repaint one pixel (r,g,b) -> [r,g,b] or null when no rule matches
  function apply(rules, R, Gc, B) {
    const [h, s, v] = rgb2hsv(R, Gc, B);
    for (const c of rules) {
      if (s < c.s[0] || s > c.s[1] || v < c.v[0] || v > c.v[1]) continue;
      let w = 1;
      if (!c.gray) {
        const d = hueDist(h, c.h); if (d > c.hr + c.soft) continue;
        if (d > c.hr) w = 1 - (d - c.hr) / c.soft;
      }
      if (c.keep) return null;
      if (c.alpha != null && !c.to && c.dh == null && c.sat == null && c.val == null) return [R, Gc, B, c.alpha];
      let nh, ns, nv;
      if (c.to) {
        // keep this pixel's shading relative to the rule's source colour
        nh = (c.th + (c.gray ? 0 : (h - c.fh)) + 720) % 360;
        if (c.gray) { ns = c.ts * (c.keepSat ? 1 : 1); nv = Math.min(1, v / Math.max(0.05, c.fv) * c.tv); }
        else { ns = Math.min(1, s * (c.ts / Math.max(0.05, c.fs))); nv = Math.min(1, v * (c.tv / Math.max(0.05, c.fv))); }
      } else { nh = (h + (c.dh || 0) + 360) % 360; ns = Math.min(1, s * (c.sat == null ? 1 : c.sat)); nv = Math.min(1, v * (c.val == null ? 1 : c.val)); }
      if (c.sat != null && c.to) ns = Math.min(1, ns * c.sat);
      if (c.val != null && c.to) nv = Math.min(1, nv * c.val);
      const o = hsv2rgb(nh, ns, nv);
      if (c.alpha != null) o[3] = c.alpha;
      if (w >= 1) return o;
      return [Math.round(R + (o[0] - R) * w), Math.round(Gc + (o[1] - Gc) * w), Math.round(B + (o[2] - B) * w)];
    }
    return null;
  }
  // repaint an image -> canvas. rects = [{x,y,w,h,rules}] get their own rules (for those pixels only),
  // every other pixel uses `rules`. Rules may set {alpha} (0 = erase) or {keep:true} (leave as is).
  function recolor(img, rules, rects) {
    const W = img.width, H = img.height;
    const c = G.makeCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const sets = [(rules || []).map(compile)].concat((rects || []).map(z => (z.rules || []).map(compile)));
    if (sets.every(r => !r.length)) return c;
    const owner = rects && rects.length ? new Int16Array(W * H) : null;
    if (owner) rects.forEach((z, zi) => {
      const x0 = Math.max(0, z.x | 0), y0 = Math.max(0, z.y | 0), x1 = Math.min(W, (z.x + z.w) | 0), y1 = Math.min(H, (z.y + z.h) | 0);
      for (let yy = y0; yy < y1; yy++) owner.fill(zi + 1, yy * W + x0, yy * W + x1);
    });
    const id = x.getImageData(0, 0, W, H), d = id.data;
    const memos = sets.map(() => new Map());
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      if (d[i + 3] === 0) continue;
      const si = owner ? owner[p] : 0, rr = sets[si];
      if (!rr.length) continue;
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2], memo = memos[si];
      let o = memo.get(key);
      if (o === undefined) { o = apply(rr, d[i], d[i + 1], d[i + 2]); memo.set(key, o); }
      if (o) { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; if (o[3] != null) d[i + 3] = Math.round(d[i + 3] * o[3]); }
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- building a character
  G.Forge = {
    built: {},
    recolor, compile, apply, hex2hsv,
    // copy every packed file under srcPrefix to dstPrefix (images repainted)
    clone(srcPrefix, dstPrefix, def) {
      const A = G.A;
      for (const k of Object.keys(A.raw)) {
        if (!(k.startsWith(srcPrefix + '/') || k.startsWith(srcPrefix + '.'))) continue;
        const nk = dstPrefix + k.slice(srcPrefix.length);
        if (k.endsWith('.png')) {
          const img = A.image(k); if (!img) continue;
          let rects = null;
          // atlas parts: repaint only the named spritemap sprites
          if (def.parts && /spritemap\d*\.png$/.test(k)) {
            const sj = A.json(k.replace(/\.png$/, '.json'));
            rects = [];
            if (sj) for (const s of sj.ATLAS.SPRITES) {
              const S = s.SPRITE;
              // part keys: exact sprite name, or "prefix*"
              for (const key in def.parts) if (key === S.name || (key.endsWith('*') && S.name.startsWith(key.slice(0, -1)))) { rects.push({ x: S.x, y: S.y, w: S.rotated ? S.h : S.w, h: S.rotated ? S.w : S.h, rules: def.parts[key] }); break; }
            }
          }
          A._img.set(nk, recolor(img, def.rules || [], rects));
          A.raw[nk] = 'data:forged';
        } else A.raw[nk] = A.raw[k];
      }
    },
    ensure(id) {
      const def = G.OWN[id];
      if (!def || this.built[id]) return !!def;
      this.built[id] = true;
      const A = G.A;
      const bd = A.json('preload/data/characters/' + def.base + '.json');
      if (!bd) return false;
      const d = JSON.parse(JSON.stringify(bd));
      d.name = def.name || id;
      // every image the base uses (main sheet + per-animation sheets)
      const paths = new Set([bd.assetPath].concat((bd.animations || []).map(a => a.assetPath)).filter(Boolean));
      const map = {};
      for (const p of paths) {
        const src = A.imagePath(p);                       // e.g. shared/images/characters/pico
        const dst = 'own/images/' + id + '/' + src.split('/images/')[1];
        this.clone(src, dst, def);
        map[p] = 'own:' + id + '/' + src.split('/images/')[1];
        // optional edits of the copied Animate atlas (extra layers, hidden parts, scaled elements)
        if (def.edit && A.raw[dst + '/Animation.json']) { const atlas = G.Atlas.load(dst); if (atlas) def.edit(atlas, { G, path: p, dst }); }
      }
      d.assetPath = map[bd.assetPath] || d.assetPath;
      for (const a of d.animations || []) if (a.assetPath && map[a.assetPath]) a.assetPath = map[a.assetPath];
      // health icon + freeplay pixel icon
      const iconId = (bd.healthIcon && bd.healthIcon.id) || def.base;
      const ip = 'preload/images/icons/icon-' + iconId + '.png';
      if (A.image(ip)) { A._img.set('preload/images/icons/icon-' + id + '.png', recolor(A.image(ip), def.iconRules || def.rules || [])); A.raw['preload/images/icons/icon-' + id + '.png'] = 'data:forged'; }
      d.healthIcon = Object.assign({}, bd.healthIcon || {}, { id });
      if (def.healthColor) d.healthColor = def.healthColor;
      const pix = 'preload/images/freeplay/icons/' + iconId.replace(/-.*$/, '') + 'pixel';
      if (A.image(pix + '.png')) { this.clone(pix, 'preload/images/freeplay/icons/' + id + 'pixel', { rules: def.iconRules || def.rules || [] }); }
      if (def.tweak) def.tweak(d);
      A.raw['preload/data/characters/' + id + '.json'] = JSON.stringify(d);
      A._json.delete('preload/data/characters/' + id + '.json');
      return true;
    },
    // dominant colours of a character (for writing rules): [{hex, h, s, v, n}]
    palette(id, k) {
      const bd = G.A.json('preload/data/characters/' + id + '.json'); if (!bd) return [];
      const base = G.A.imagePath(bd.assetPath);
      const imgs = Object.keys(G.A.raw).filter(p => p.startsWith(base) && p.endsWith('.png')).map(p => G.A.image(p)).filter(Boolean);
      const bins = new Map();
      for (const img of imgs) {
        const c = G.makeCanvas(img.width, img.height), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, img.width, img.height).data;
        for (let i = 0; i < d.length; i += 16) {
          if (d[i + 3] < 250) continue;
          const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
          if (v < 0.12) continue;
          const key = (s < 0.12 ? 'g' + Math.round(v * 10) : Math.round(h / 10) + ':' + Math.round(s * 4) + ':' + Math.round(v * 4));
          const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; bins.set(key, b);
        }
      }
      return [...bins.values()].sort((a, b) => b.n - a.n).slice(0, k || 24).map(b => {
        const r = Math.round(b.r / b.n), g = Math.round(b.g / b.n), bl = Math.round(b.b / b.n), [h, s, v] = rgb2hsv(r, g, bl);
        return { hex: '#' + [r, g, bl].map(q => q.toString(16).padStart(2, '0')).join(''), h: Math.round(h), s: +s.toFixed(2), v: +v.toFixed(2), n: b.n };
      });
    },
  };
})();
