// FNF 2 - graphics: Sparrow sheets, Adobe Animate texture atlases, a Flixel-style
// sprite, Flixel's camera math and FNF's Alphabet text. Behaviour follows
// HaxeFlixel + the Funkin' engine so offsets/positions from FNF's data files work as-is.

// ------------------------------------------------------------------ Sparrow (XML) sheets
G.Sparrow = {
  cache: new Map(),
  // base = "shared/images/notes" (no extension)
  load(base) {
    if (this.cache.has(base)) return this.cache.get(base);
    const xml = G.A.text(base + '.xml'), img = G.A.image(base + '.png');
    let sheet = null;
    if (xml && img) {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const frames = [];
      for (const n of doc.getElementsByTagName('SubTexture')) {
        const g = k => n.getAttribute(k), num = k => (g(k) == null ? null : parseFloat(g(k)));
        const f = { name: g('name'), x: num('x'), y: num('y'), w: num('width'), h: num('height'), rot: g('rotated') === 'true' };
        if (g('frameX') != null) { f.ox = -num('frameX'); f.oy = -num('frameY'); f.fw = num('frameWidth'); f.fh = num('frameHeight'); }
        else { f.ox = 0; f.oy = 0; f.fw = f.rot ? f.h : f.w; f.fh = f.rot ? f.w : f.h; }
        frames.push(f);
      }
      sheet = { kind: 'sparrow', img, frames, base };
    }
    this.cache.set(base, sheet);
    return sheet;
  },
  // frames whose name is prefix + a frame number, in order (FNF/Flixel addByPrefix)
  byPrefix(sheet, prefix, indices) {
    const list = sheet.frames.filter(f => f.name.startsWith(prefix) && /^\d*$/.test(f.name.slice(prefix.length).replace(/\.png$/, '')));
    list.sort((a, b) => (parseInt(a.name.slice(prefix.length)) || 0) - (parseInt(b.name.slice(prefix.length)) || 0));
    if (!indices) return list;
    return indices.map(i => list[i]).filter(Boolean);
  },
  draw(ctx, sheet, f) {
    if (!f) return;
    if (!f.rot) { ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, f.ox, f.oy, f.w, f.h); return; }
    // stored rotated 90deg: draw region rotated back (Flixel ANGLE_NEG_90)
    ctx.save(); ctx.translate(f.ox, f.oy); ctx.transform(0, -1, 1, 0, 0, f.w);
    ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    ctx.restore();
  },
};

// ------------------------------------------------------------------ Adobe Animate texture atlas
const mul = (p, l) => [p[0] * l[0] + p[2] * l[1], p[1] * l[0] + p[3] * l[1], p[0] * l[2] + p[2] * l[3], p[1] * l[2] + p[3] * l[3], p[0] * l[4] + p[2] * l[5] + p[4], p[1] * l[4] + p[3] * l[5] + p[5]];
const BLEND = { 0: 'lighter', 2: 'darken', 3: 'difference', 5: 'hard-light', 8: 'lighten', 9: 'multiply', 11: 'overlay', 12: 'screen' };
// Animate exports use short ("G", "LP") or long ("graphic", "loop") names
const SYMTYPE = { G: 'G', graphic: 'G', MC: 'MC', movieclip: 'MC', B: 'B', button: 'B' };
const LOOPTYPE = { LP: 'LP', loop: 'LP', PO: 'PO', playonce: 'PO', SF: 'SF', singleframe: 'SF', RP: 'RP', playreverse: 'RP' };
function readMatrix(o) {
  if (o.MX) return o.MX.slice(0, 6);
  if (o.M3D) { const m = o.M3D; return Array.isArray(m) ? [m[0], m[1], m[4], m[5], m[12], m[13]] : [m.m00, m.m01, m.m10, m.m11, m.m30, m.m31]; }
  return [1, 0, 0, 1, 0, 0];
}
function parseTimeline(tl, name) {
  const layers = [];
  let frameCount = 0;
  for (const L of (tl.L || tl.LAYERS || [])) {
    const frames = [];
    for (const F of (L.FR || L.Frames || [])) {
      const els = [];
      for (const E of (F.E || F.elements || [])) {
        const si = E.SI || E.SYMBOL_Instance, asi = E.ASI || E.ATLAS_SPRITE_instance;
        if (si) {
          const C = si.C || si.color;
          const am = C ? (C.AM != null ? C.AM : C.alphaMultiplier) : null;
          const trp = si.TRP || si.transformationPoint || null;
          els.push({ s: si.SN || si.SYMBOL_name, ff: si.FF || si.firstFrame || 0, st: SYMTYPE[si.ST || si.symbolType] || 'G', lp: LOOPTYPE[si.LP || si.loop] || 'LP', m: readMatrix(si), b: BLEND[si.B != null ? si.B : si.blend] || null, a: am != null ? am : 1, trp });
        }
        else if (asi) els.push({ n: asi.N || asi.name, m: readMatrix(asi) });
      }
      const fi = F.I != null ? F.I : F.index, du = F.DU != null ? F.DU : F.duration;
      frames.push({ i: fi, du, label: F.N || F.name || null, els });
      frameCount = Math.max(frameCount, fi + du);
    }
    layers.push({ name: L.LN || L.Layer_name, type: L.LT || null, frames });
  }
  // keyframe lookup tables
  for (const L of layers) {
    L.at = new Int16Array(frameCount).fill(-1);
    L.frames.forEach((F, k) => { for (let i = F.i; i < F.i + F.du && i < frameCount; i++) L.at[i] = k; });
  }
  return { name, layers, frameCount };
}
G.Atlas = {
  cache: new Map(),
  // base = "shared/images/characters/bf" (folder with Animation.json + spritemap1.json/png ...)
  load(base) {
    if (this.cache.has(base)) return this.cache.get(base);
    const anim = G.A.json(base + '/Animation.json');
    if (!anim) { this.cache.set(base, null); return null; }
    const sprites = {};
    for (let i = 1; i < 10; i++) {
      const sj = G.A.json(base + '/spritemap' + i + '.json'), img = G.A.image(base + '/spritemap' + i + '.png');
      if (!sj || !img) break;
      for (const s of sj.ATLAS.SPRITES) { const S = s.SPRITE; sprites[S.name] = { img, x: S.x, y: S.y, w: S.w, h: S.h, rot: !!S.rotated }; }
    }
    const AN = anim.AN || anim.ANIMATION;
    const symbols = {};
    const SD = anim.SD || anim.SYMBOL_DICTIONARY;
    if (SD) for (const s of (SD.S || SD.Symbols || [])) symbols[s.SN || s.SYMBOL_name] = parseTimeline(s.TL || s.TIMELINE, s.SN || s.SYMBOL_name);
    const main = parseTimeline(AN.TL || AN.TIMELINE, AN.SN || AN.SYMBOL_name);
    const labels = {};
    for (const L of main.layers) for (const F of L.frames) if (F.label) labels[F.label] = { start: F.i, len: F.du };
    const md = anim.MD || anim.metadata || {};
    // the main symbol's placement on the Animate stage (used when a sprite applies the stage matrix, e.g. freeplay DJs)
    const sti = AN.STI || AN.StageInstance; const stiSI = sti && (sti.SI || sti.SYMBOL_Instance);
    const stage = stiSI ? readMatrix(stiSI) : [1, 0, 0, 1, 0, 0];
    const atlas = { kind: 'atlas', base, sprites, symbols, main, labels, stage, fps: md.FRT || md.framerate || 24, _bounds: new Map(), swaps: {} };
    // the main symbol also lives in the dictionary for nested lookups
    if (!symbols[main.name]) symbols[main.name] = main;
    this.cache.set(base, atlas);
    return atlas;
  },
  // FunkinSprite.scaleElement: grow the first element of a symbol (frame 0) by `scale` (added to the matrix)
  scaleElement(atlas, symbol, scale, posOff) {
    const sym = atlas && atlas.symbols[symbol]; if (!sym) return;
    let e = null;
    for (const L of sym.layers) { const k = L.at[0]; if (k >= 0 && L.frames[k].els.length) { e = L.frames[k].els[0]; break; } }
    if (!e || e._scaled) return;
    e._scaled = true;
    const tp = e.trp || { x: 0, y: 0 };
    e.m = e.m.slice(); e.m[0] += scale; e.m[3] += scale;
    e.m[4] -= tp.x * scale + (posOff || 0); e.m[5] -= tp.y * scale + (posOff || 0);
    // keep the bounds measured at load time: the sprite's anchor doesn't move (like flixel-animate)
  },
  // which frame of a symbol to show for an instance placed on a keyframe
  subFrame(e, local, count) {
    if (e.st === 'MC') return 0;                               // movie clips: first frame only (Animate preview mode)
    if (e.lp === 'SF') return Math.min(e.ff, count - 1);
    const f = e.ff + local;
    if (e.lp === 'PO') return Math.min(f, count - 1);
    return count > 0 ? f % count : 0;
  },
  draw(ctx, atlas, tl, frame) {
    const layers = tl.layers;
    for (let li = layers.length - 1; li >= 0; li--) {
      const L = layers[li];
      if (L.type === 'Clp' || L.type === 'Clipper') continue;
      const k = frame < L.at.length ? L.at[frame] : -1;
      if (k < 0) continue;
      const F = L.frames[k];
      for (const e of F.els) {
        const m = e.m;
        ctx.save();
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        if (e.n != null) {
          const s = atlas.sprites[e.n];
          if (s) {
            if (s.rot) { ctx.transform(0, -1, 1, 0, 0, s.w); }
            ctx.drawImage(s.img, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
          }
        } else {
          const swap = atlas.swaps[e.s];
          if (swap) { if (e.a !== 1) ctx.globalAlpha *= e.a; ctx.drawImage(swap.img, swap.x || 0, swap.y || 0, swap.w || swap.img.width, swap.h || swap.img.height); ctx.restore(); continue; }
          const sym = atlas.symbols[e.s];
          if (sym) {
            if (e.a !== 1) ctx.globalAlpha *= e.a;
            if (e.b) ctx.globalCompositeOperation = e.b;
            this.draw(ctx, atlas, sym, this.subFrame(e, frame - F.i, sym.frameCount));
          }
        }
        ctx.restore();
      }
    }
  },
  // bounding box of one frame (in timeline space), accumulated into r
  boundsFrame(atlas, tl, frame, M, r) {
    for (let li = tl.layers.length - 1; li >= 0; li--) {
      const L = tl.layers[li];
      if (L.type === 'Clp' || L.type === 'Clipper') continue;
      const k = frame < L.at.length ? L.at[frame] : -1;
      if (k < 0) continue;
      const F = L.frames[k];
      for (const e of F.els) {
        const m = mul(M, e.m);
        if (e.n != null) {
          const s = atlas.sprites[e.n]; if (!s) continue;
          const w = s.rot ? s.h : s.w, h = s.rot ? s.w : s.h;
          for (const [px, py] of [[0, 0], [w, 0], [0, h], [w, h]]) {
            const X = m[0] * px + m[2] * py + m[4], Y = m[1] * px + m[3] * py + m[5];
            if (X < r.x0) r.x0 = X; if (Y < r.y0) r.y0 = Y; if (X > r.x1) r.x1 = X; if (Y > r.y1) r.y1 = Y;
          }
        } else {
          const sym = atlas.symbols[e.s];
          if (sym) this.boundsFrame(atlas, sym, this.subFrame(e, frame - F.i, sym.frameCount), m, r);
        }
      }
    }
  },
  // whole-timeline bounds (union of every frame), like flixel-animate's timeline bounds
  bounds(atlas, tl) {
    tl = tl || atlas.main;
    if (atlas._bounds.has(tl)) return atlas._bounds.get(tl);
    const r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (let f = 0; f < tl.frameCount; f++) this.boundsFrame(atlas, tl, f, [1, 0, 0, 1, 0, 0], r);
    const b = isFinite(r.x0) ? { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 } : { x: 0, y: 0, w: 1, h: 1 };
    atlas._bounds.set(tl, b);
    return b;
  },
};

// ------------------------------------------------------------------ Flixel-style sprite
// Position (x,y) is the top-left of the hitbox, like FlxSprite. offset/origin/scale behave the same,
// scroll is the parallax factor. Animations come from a Sparrow sheet, an Animate atlas, or a static image.
G.Sprite = class {
  constructor(x, y) {
    this.x = x || 0; this.y = y || 0;
    this.scale = { x: 1, y: 1 }; this.scroll = { x: 1, y: 1 }; this.offset = { x: 0, y: 0 }; this.origin = { x: 0, y: 0 };
    this.alpha = 1; this.visible = true; this.flipX = false; this.flipY = false; this.angle = 0; this.zIndex = 0;
    this.blend = null; this.antialias = true;
    this.frameW = 0; this.frameH = 0; this.width = 0; this.height = 0;
    this.anims = {}; this.cur = null; this.animName = ''; this.fi = 0; this.t = 0; this.finished = true; this.paused = false;
    this.animOffsets = {}; this.globalOffsets = [0, 0]; this.useAnimOffsets = false; this._ao = [0, 0];
    this.onFinish = null;
  }
  // ---- loaders
  loadImage(path) {
    const img = typeof path === 'string' ? G.A.image(path) : path;
    this.img = img; this.sheet = null; this.atlas = null;
    this.frameW = img ? img.width : 1; this.frameH = img ? img.height : 1;
    this.resetSize(); return this;
  }
  makeSolid(w, h, color) { this.solid = color; this.img = null; this.frameW = w; this.frameH = h; this.resetSize(); return this; }
  loadSparrow(base) {
    this.sheet = G.Sparrow.load(base); this.img = null; this.atlas = null;
    if (this.sheet && this.sheet.frames[0]) { this.frameW = this.sheet.frames[0].fw; this.frameH = this.sheet.frames[0].fh; this.resetSize(); }
    return this;
  }
  loadAtlas(base) {
    this.atlas = G.Atlas.load(base); this.sheet = null; this.img = null;
    if (this.atlas) { const b = G.Atlas.bounds(this.atlas); this.frameW = b.w; this.frameH = b.h; this.resetSize(); }
    return this;
  }
  resetSize() { this.width = this.frameW * Math.abs(this.scale.x); this.height = this.frameH * Math.abs(this.scale.y); this.origin.x = this.frameW / 2; this.origin.y = this.frameH / 2; }
  updateHitbox() {
    this.width = Math.abs(this.scale.x) * this.frameW; this.height = Math.abs(this.scale.y) * this.frameH;
    this.offset.x = -0.5 * (this.width - this.frameW); this.offset.y = -0.5 * (this.height - this.frameH);
    this.origin.x = this.frameW / 2; this.origin.y = this.frameH / 2;
  }
  setGraphicSize(w, h) { const sx = w / this.frameW, sy = h ? h / this.frameH : sx; this.scale.x = sx; this.scale.y = h ? sy : sx; return this; }
  screenCenter(axis) { if (axis !== 'y') this.x = (G.W - this.width) / 2; if (axis !== 'x') this.y = (G.H - this.height) / 2; return this; }
  // ---- animations
  // Sparrow: prefix = frame-name prefix. Atlas: prefix = frame label (or symbol name). indices optional.
  addAnim(name, prefix, fps, loop, indices, src) {
    const sheet = src && src.kind === 'sparrow' ? src : (src ? null : this.sheet);
    const atlas = src && src.kind === 'atlas' ? src : (src ? null : this.atlas);
    if (sheet) {
      const frames = G.Sparrow.byPrefix(sheet, prefix, indices);
      if (!frames.length) return false;
      this.anims[name] = { kind: 'sparrow', sheet, frames, fps: fps || 24, loop: !!loop, n: frames.length };
      return true;
    }
    if (atlas) {
      let tl = atlas.main, list;
      const lab = atlas.labels[prefix];
      if (lab) list = []; else if (atlas.symbols[prefix]) { tl = atlas.symbols[prefix]; list = null; }
      if (lab) { for (let i = 0; i < lab.len; i++) list.push(lab.start + i); }
      else if (atlas.symbols[prefix]) { list = []; for (let i = 0; i < tl.frameCount; i++) list.push(i); }
      else return false;
      if (indices) list = indices.map(i => list[i]).filter(v => v != null);
      if (!list.length) return false;
      this.anims[name] = { kind: 'atlas', atlas, tl, frames: list, fps: fps || atlas.fps, loop: !!loop, n: list.length };
      return true;
    }
    return false;
  }
  hasAnim(n) { return !!this.anims[n]; }
  play(name, force, reversed) {
    const a = this.anims[name];
    if (!a) return false;
    if (!force && this.cur === a && !this.finished) return true;
    this.cur = a; this.animName = name; this.t = 0; this.fi = reversed ? a.n - 1 : 0; this.rev = !!reversed; this.finished = false;
    if (a.kind === 'sparrow') { const f = a.frames[this.fi]; this.frameW = f.fw; this.frameH = f.fh; }
    else { const b = G.Atlas.bounds(a.atlas, a.tl); this.frameW = b.w; this.frameH = b.h; }
    if (this.useAnimOffsets) this._ao = this.animOffsets[name] || [0, 0];
    return true;
  }
  update(dt) {
    const a = this.cur;
    if (!a || this.paused || this.finished) return;
    this.t += dt;
    const step = 1 / a.fps;
    while (this.t >= step && !this.finished) {
      this.t -= step;
      if (!this.rev) {
        if (this.fi < a.n - 1) this.fi++;
        else if (a.loop) this.fi = 0;
        else { this.finished = true; if (this.onFinish) this.onFinish(this.animName); }
      } else {
        if (this.fi > 0) this.fi--; else if (a.loop) this.fi = a.n - 1; else { this.finished = true; if (this.onFinish) this.onFinish(this.animName); }
      }
    }
    if (a.kind === 'sparrow') { const f = a.frames[this.fi]; this.frameW = f.fw; this.frameH = f.fh; }
  }
  // ---- drawing. cam = G.FCam (or null = raw screen space)
  draw(ctx, cam) {
    if (!this.visible || this.alpha <= 0) return;
    if (cam) cam.apply(ctx, this.scroll.x, this.scroll.y); else G.setScreenT(ctx);
    let sx = this.x - this.offset.x, sy = this.y - this.offset.y;
    if (this.useAnimOffsets) { sx -= (this._ao[0] - this.globalOffsets[0]) * this.scale.x; sy -= (this._ao[1] - this.globalOffsets[1]) * this.scale.y; }
    ctx.save();
    ctx.translate(sx + this.origin.x, sy + this.origin.y);
    if (this.angle) ctx.rotate(this.angle * Math.PI / 180);
    ctx.scale(this.scale.x, this.scale.y);
    ctx.translate(-this.origin.x, -this.origin.y);
    if (this.flipX) { ctx.translate(this.frameW, 0); ctx.scale(-1, 1); }
    if (this.flipY) { ctx.translate(0, this.frameH); ctx.scale(1, -1); }
    if (this.alpha < 1) ctx.globalAlpha *= this.alpha;
    if (this.blend) ctx.globalCompositeOperation = this.blend;
    ctx.imageSmoothingEnabled = this.antialias;
    this.drawContent(ctx);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
  }
  drawContent(ctx) {
    const a = this.cur;
    if (a && a.kind === 'sparrow') G.Sparrow.draw(ctx, a.sheet, a.frames[this.fi]);
    else if (a && a.kind === 'atlas') {
      const b = G.Atlas.bounds(a.atlas, a.tl);
      ctx.translate(-b.x, -b.y);
      G.Atlas.draw(ctx, a.atlas, a.tl, a.frames[this.fi]);
    } else if (this.sheet && this.sheet.frames[0]) G.Sparrow.draw(ctx, this.sheet, this.sheet.frames[0]);
    else if (this.img) ctx.drawImage(this.img, 0, 0);
    else if (this.solid) { ctx.fillStyle = this.solid; ctx.fillRect(0, 0, this.frameW, this.frameH); }
  }
};

// ------------------------------------------------------------------ Flixel camera
// x,y = the world point at the screen centre (FlxCamera.scroll + half the screen).
G.FCam = class {
  constructor(zoom) { this.x = G.W / 2; this.y = G.H / 2; this.zoom = zoom || 1; this.tx = this.x; this.ty = this.y; this.followRate = 0.04; this.shakeI = 0; this.shakeT = 0; this.sx = 0; this.sy = 0; this.alpha = 1; this.flashA = 0; this.flashC = '#fff'; this.flashD = 1; this.fadeA = 0; }
  focus(x, y) { this.x = this.tx = x; this.y = this.ty = y; }
  follow(x, y) { this.tx = x; this.ty = y; }
  shake(i, d) { this.shakeI = Math.max(this.shakeI, i); this.shakeT = Math.max(this.shakeT, d); }
  flash(c, d) { this.flashC = c || '#fff'; this.flashA = 1; this.flashD = d || 1; }
  update(dt) {
    // Flixel LOCKON lerp is framerate dependent: lerp = rate * 60 * dt per frame
    const k = 1 - Math.pow(1 - this.followRate, dt * 60);
    this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k;
    if (this.shakeT > 0) { this.shakeT -= dt; const m = this.shakeI * G.W; this.sx = (Math.random() * 2 - 1) * m * this.zoom; this.sy = (Math.random() * 2 - 1) * m * this.zoom; if (this.shakeT <= 0) { this.shakeI = 0; this.sx = this.sy = 0; } }
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt / this.flashD);
  }
  // world -> screen for a layer with scroll factor (sfx, sfy). Flixel: screen = zoom*(x - scroll*sf - W/2) + W/2
  apply(ctx, sfx, sfy) {
    if (sfy == null) sfy = sfx;
    const q = G.q, z = this.zoom;
    const scx = this.x - G.W / 2, scy = this.y - G.H / 2;
    const ox = G.W / 2 - z * (scx * sfx + G.W / 2) + this.sx, oy = G.H / 2 - z * (scy * sfy + G.H / 2) + this.sy;
    ctx.setTransform(q * z, 0, 0, q * z, q * ox, q * oy);
  }
  drawFX(ctx) {
    if (this.flashA > 0) { G.setScreenT(ctx); ctx.globalAlpha = this.flashA; ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
  }
};
// HUD camera: zoom about the screen centre, no scrolling
G.HudCam = class {
  constructor() { this.zoom = 1; this.alpha = 1; this.sx = 0; this.sy = 0; this.shakeI = 0; this.shakeT = 0; this.angle = 0; }
  apply(ctx) {
    const q = G.q, z = this.zoom;
    ctx.setTransform(q * z, 0, 0, q * z, q * (G.W / 2 * (1 - z) + this.sx), q * (G.H / 2 * (1 - z) + this.sy));
  }
  shake(i, d) { this.shakeI = Math.max(this.shakeI, i); this.shakeT = Math.max(this.shakeT, d); }
  update(dt) { if (this.shakeT > 0) { this.shakeT -= dt; const m = this.shakeI * G.W; this.sx = (Math.random() * 2 - 1) * m; this.sy = (Math.random() * 2 - 1) * m; if (this.shakeT <= 0) { this.shakeI = 0; this.sx = this.sy = 0; } } }
};

// ------------------------------------------------------------------ FNF Alphabet text
// Same rules as the Funkin' engine's AtlasText: one sparrow sheet per font
// (preload/images/fonts/bold|default|freeplay-clear), letters bottom-aligned on
// the tallest glyph, spaces 40px. Fonts that only have capitals force upper case.
const ATLAS_SYM = {
  '&': '-andpersand-', "'": '-apostraphie-', '\\': '-back slash-', ',': '-comma-', '-': '-dash-', '!': '-exclamation point-',
  '/': '-forward slash-', '>': '-greater than-', '<': '-less than-', '*': '-multiply x-', '.': '-period-', '?': '-question mark-',
  '\u2190': '-left arrow-', '\u2192': '-right arrow-', '\u2191': '-up arrow-', '\u2193': '-down arrow-', '\u2665': '-heart-',
  '\u201c': '-start quote-', '\u201d': '-end quote-', '"': '-start quote-',
};
G.AtlasFont = {
  cache: {},
  get(name) {
    if (name in this.cache) return this.cache[name];
    const sheet = G.Sparrow.load('preload/images/fonts/' + name);
    let font = null;
    if (sheet) {
      let maxH = 0, up = false, low = false;
      for (const f of sheet.frames) { maxH = Math.max(maxH, f.h); if (/^[A-Z]\d+$/.test(f.name)) up = true; if (/^[a-z]\d+$/.test(f.name)) low = true; }
      font = { sheet, maxH, caseAllowed: up !== low ? (up ? 'upper' : 'lower') : 'both', glyphs: {} };
    }
    this.cache[name] = font;
    return font;
  },
  glyph(font, ch) {
    if (ch in font.glyphs) return font.glyphs[ch];
    const frames = G.Sparrow.byPrefix(font.sheet, ATLAS_SYM[ch] || ch);
    return (font.glyphs[ch] = frames.length ? frames : null);
  },
};
G.Alphabet = class {
  // bold = true -> 'bold' font (white menu letters), false -> 'default' (black letters), or pass a font name
  constructor(text, bold, x, y) {
    this.x = x || 0; this.y = y || 0;
    this.fontName = typeof bold === 'string' ? bold : (bold !== false ? 'bold' : 'default');
    this.bold = this.fontName === 'bold';
    this.scale = 1; this.alpha = 1; this.visible = true;
    this.t = 0; this.scroll = 0;
    this.setText(text || '');
    // FNF menu-item behaviour (isMenuItem + targetY)
    this.isMenuItem = false; this.targetY = 0; this.changeX = true; this.changeY = true; this.distancePerItem = { x: 20, y: 120 }; this.startPosition = { x: 0, y: 0 };
  }
  setText(text) {
    this.text = String(text);
    const font = this.font = G.AtlasFont.get(this.fontName);
    this.sheet = font && font.sheet;
    this.letters = [];
    this.width = 0; this.height = font ? font.maxH : 70;
    if (!font) return;
    let str = this.text;
    if (font.caseAllowed === 'upper') str = str.toUpperCase(); else if (font.caseAllowed === 'lower') str = str.toLowerCase();
    let x = 0, y = 0;
    for (const ch of str) {
      if (ch === ' ') { x += 40; continue; }
      if (ch === '\n') { x = 0; y += font.maxH; continue; }
      const frames = G.AtlasFont.glyph(font, ch);
      if (!frames) { x += 40; continue; }
      const f0 = frames[0];
      this.letters.push({ frames, x, y: y + font.maxH - f0.fh });
      x += f0.fw;
      this.width = Math.max(this.width, x);
    }
    this.height = y + font.maxH;
  }
  update(dt) {
    this.t += dt;
    if (this.isMenuItem) {
      const k = 1 - Math.pow(1 - 0.16, dt * 60);
      if (this.changeX) this.x += ((this.targetY * this.distancePerItem.x) + this.startPosition.x - this.x) * k;
      if (this.changeY) this.y += ((this.targetY * 1.3 * this.distancePerItem.y) + this.startPosition.y - this.y) * k;
    }
  }
  draw(ctx, cam) {
    if (!this.visible || this.alpha <= 0 || !this.sheet) return;
    if (cam && cam.apply) cam.apply(ctx, this.scroll, this.scroll); else G.setScreenT(ctx);
    ctx.save();
    ctx.translate(this.x, this.y); ctx.scale(this.scale, this.scale);
    ctx.globalAlpha *= this.alpha;
    const fi = Math.floor(this.t * 24);
    for (const L of this.letters) {
      const f = L.frames[fi % L.frames.length];
      ctx.save(); ctx.translate(L.x, L.y);
      G.Sparrow.draw(ctx, this.sheet, f);
      ctx.restore();
    }
    ctx.restore();
  }
};
// VCR text like FNF's FlxText with a black border
G.vcr = function (ctx, str, x, y, o) {
  o = o || {};
  G.text(ctx, str, x, y, { font: 'vcr', size: o.size || 32, color: o.color || '#fff', outline: o.outline == null ? 2 : o.outline, outlineColor: o.outlineColor || '#000', align: o.align || 'left', baseline: o.baseline || 'top', alpha: o.alpha, maxWidth: o.maxWidth });
};
