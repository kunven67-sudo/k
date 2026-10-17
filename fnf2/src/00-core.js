// FNF 2 - core: namespace, canvas, loop, input, settings, save, screens,
// camera, conductor, text + drawing helpers, character/stage registries.
// Every other module attaches to the global G object.

const G = window.G = window.G || {};
G.VERSION = '2.0.0';
G.W = 1280; G.H = 720;

// ------------------------------------------------------------------ math
G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
// frame-rate independent smoothing: move a toward b, `rate` = fraction per second-ish
G.damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
G.ease = {
  linear: t => t,
  quadIn: t => t * t,
  quadOut: t => 1 - (1 - t) * (1 - t),
  quadInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  cubeIn: t => t * t * t,
  cubeOut: t => 1 - Math.pow(1 - t, 3),
  cubeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  expoOut: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  quartOut: t => 1 - Math.pow(1 - t, 4),
  sineInOut: t => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elasticOut: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
};
// deterministic RNG (mulberry32). G.rng(seed) -> () => [0,1)
G.rng = function (seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
G.hash = function (str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
G.pick = (rand, arr) => arr[Math.floor(rand() * arr.length) % arr.length];
G.fmtTime = function (sec) {
  sec = Math.max(0, Math.floor(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
};
G.hexToRgb = function (hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
G.mixColor = function (a, b, t) {
  const A = G.hexToRgb(a), B = G.hexToRgb(b);
  const r = Math.round(G.lerp(A[0], B[0], t)), g = Math.round(G.lerp(A[1], B[1], t)), bl = Math.round(G.lerp(A[2], B[2], t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
};
G.rgba = function (hex, a) { const c = G.hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };

// ------------------------------------------------------------------ storage
G.store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } },
};

// ------------------------------------------------------------------ settings
G.DEFAULT_BINDS = {
  note0: ['KeyA', 'ArrowLeft'], note1: ['KeyS', 'ArrowDown'], note2: ['KeyW', 'ArrowUp'], note3: ['KeyD', 'ArrowRight'],
  dodge: ['Space', 'ShiftLeft'],
};
G.DFJK_BINDS = {
  note0: ['KeyD', 'ArrowLeft'], note1: ['KeyF', 'ArrowDown'], note2: ['KeyJ', 'ArrowUp'], note3: ['KeyK', 'ArrowRight'],
  dodge: ['Space', 'ShiftLeft'],
};
G.DEFAULT_SETTINGS = {
  // gameplay
  downscroll: false, middlescroll: false, ghostTapping: true,
  speedType: 'chart',   // 'chart' | 'mult' | 'const'
  speedValue: 1,        // multiplier (mult) or fixed speed (const), 0.5 - 4
  songSpeed: 1,         // playback rate 0.5 - 2 (pitch is kept)
  offset: 0,            // ms; positive = notes judged later (fixes audio delay)
  hitsound: 0,          // 0..1 volume of a click on every hit
  botplay: false, practice: false,
  // visuals
  noteSplashes: true, camZoom: true, flashing: true, fps: false,
  quality: 'auto',      // 'auto' | 'high' | 'low'
  timeBar: 'name',      // 'name' | 'left' | 'elapsed' | 'off'
  comboPopups: true,
  naughty: true,        // FNF's 'Naughtyness' (off = the clean versions of scenes)
  // audio
  vol: { master: 0.9, music: 0.8, vocals: 1, sfx: 0.8 },
  // controls
  binds: JSON.parse(JSON.stringify(G.DEFAULT_BINDS)),
  // misc / remembered menu state
  player: 'ace', diff: 1, lastWeek: 0, lastFreeplay: 0,
  seenMechanics: {},
};
G.settings = (function () {
  const saved = G.store.get('fnf2.settings', {}) || {};
  const s = JSON.parse(JSON.stringify(G.DEFAULT_SETTINGS));
  for (const k in saved) {
    if (!(k in s)) continue;
    if (k === 'vol' || k === 'binds' || k === 'seenMechanics') Object.assign(s[k], saved[k]);
    else s[k] = saved[k];
  }
  return s;
})();
G.saveSettings = () => G.store.set('fnf2.settings', G.settings);
G.resetSettings = function () {
  const keep = { player: G.settings.player, seenMechanics: G.settings.seenMechanics };
  G.settings = Object.assign(JSON.parse(JSON.stringify(G.DEFAULT_SETTINGS)), keep);
  G.saveSettings();
};

// ------------------------------------------------------------------ save data
// scores keyed by `${songId}|${diff}|${player}` ; week scores by `${weekId}|${diff}|${player}`
G.save = (function () {
  const d = G.store.get('fnf2.save', null) || {};
  d.scores = d.scores || {};
  d.weekScores = d.weekScores || {};
  d.customCharts = d.customCharts || {};
  d.deaths = d.deaths || 0;
  d.stats = d.stats || { plays: 0, notesHit: 0 };
  return d;
})();
G.saveData = () => G.store.set('fnf2.save', G.save);
G.scoreKey = (songId, diff, player) => songId + '|' + diff + '|' + (player || 'ace');
G.getScore = (songId, diff, player) => G.save.scores[G.scoreKey(songId, diff, player)] || null;
// rec = {score, acc (0..1), misses, rank, fc}. Returns true if it was a new best.
G.submitScore = function (songId, diff, player, rec) {
  const k = G.scoreKey(songId, diff, player);
  const old = G.save.scores[k];
  if (!old || rec.score > old.score) { G.save.scores[k] = Object.assign({}, rec); G.saveData(); return true; }
  return false;
};
G.getWeekScore = (weekId, diff, player) => G.save.weekScores[G.scoreKey(weekId, diff, player)] || 0;
G.submitWeekScore = function (weekId, diff, player, score) {
  const k = G.scoreKey(weekId, diff, player);
  if (!G.save.weekScores[k] || score > G.save.weekScores[k]) { G.save.weekScores[k] = score; G.saveData(); return true; }
  return false;
};

// ------------------------------------------------------------------ difficulties
G.DIFFS = [
  { id: 'easy', name: 'EASY', color: '#7bff6b' },
  { id: 'normal', name: 'NORMAL', color: '#ffe45c' },
  { id: 'hard', name: 'HARD', color: '#ff4f6d' },
  { id: 'erupt', name: 'ERUPT', color: '#ff8a1f' },
  { id: 'nightfall', name: 'NIGHTFALL', color: '#a35cff' },
];
G.diffIndex = id => Math.max(0, G.DIFFS.findIndex(d => d.id === id));

// ------------------------------------------------------------------ canvas
G.canvas = document.getElementById('game');
G.ctx = G.canvas.getContext('2d', { alpha: false });
G.q = 1;            // canvas pixels per game pixel
G.autoQ = 1;        // auto-quality multiplier (drops when FPS is low)
G.resize = function () {
  const iw = window.innerWidth, ih = window.innerHeight;
  const fit = Math.min(iw / G.W, ih / G.H);
  const dpr = window.devicePixelRatio || 1;
  let q = fit * dpr;
  const qual = G.settings.quality;
  const cap = qual === 'low' ? 0.75 : qual === 'high' ? 2 : 1.5 * G.autoQ;
  q = G.clamp(q, 0.4, cap);
  G.q = q;
  const cw = Math.round(G.W * q), ch = Math.round(G.H * q);
  if (G.canvas.width !== cw || G.canvas.height !== ch) { G.canvas.width = cw; G.canvas.height = ch; }
  G.canvas.style.width = Math.floor(G.W * fit) + 'px';
  G.canvas.style.height = Math.floor(G.H * fit) + 'px';
  G.ctx.imageSmoothingEnabled = true;
};
window.addEventListener('resize', () => G.resize());

// transform helpers. All drawing happens in 1280x720 game space.
// screen-wide camera zoom/offset a menu can set while it draws (freeplay rank camera, shakes)
G.screenZoom = 1; G.screenOff = { x: 0, y: 0 };
G.setScreenT = function (ctx, zoom) {
  // HUD space; optional zoom about the screen centre (FNF camHUD bop)
  const q = G.q, z = (zoom || 1) * (G.screenZoom || 1), o = G.screenOff;
  ctx.setTransform(q * z, 0, 0, q * z, q * (G.W / 2) * (1 - z) + q * o.x, q * (G.H / 2) * (1 - z) + q * o.y);
};
G.Camera = class {
  constructor(x, y, zoom) { this.x = x || G.W / 2; this.y = y || G.H / 2; this.zoom = zoom || 1; this.angle = 0; this.sx = 0; this.sy = 0; this.shakeI = 0; this.shakeT = 0; }
  shake(intensity, dur) { this.shakeI = Math.max(this.shakeI, intensity); this.shakeT = Math.max(this.shakeT, dur); }
  update(dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeI * G.W;
      this.sx = (Math.random() * 2 - 1) * m; this.sy = (Math.random() * 2 - 1) * m;
      if (this.shakeT <= 0) { this.shakeI = 0; this.sx = this.sy = 0; }
    }
  }
  // world -> screen for a layer with scroll factor sf (Flixel style: sf<1 = far away)
  apply(ctx, sf) {
    if (sf == null) sf = 1;
    const q = G.q, z = this.zoom;
    const tx = G.W / 2 - this.x * sf * z + this.sx, ty = G.H / 2 - this.y * sf * z + this.sy;
    if (this.angle) {
      const c = Math.cos(this.angle) * z, s = Math.sin(this.angle) * z;
      ctx.setTransform(q * c, q * s, -q * s, q * c, 0, 0);
      // rotate about screen centre
      const cx = G.W / 2, cy = G.H / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(q, q); ctx.translate(cx + this.sx, cy + this.sy); ctx.rotate(this.angle); ctx.scale(z, z);
      ctx.translate(-this.x * sf, -this.y * sf);
      return;
    }
    ctx.setTransform(q * z, 0, 0, q * z, q * tx, q * ty);
  }
  // visible world rect for a layer of scroll factor sf (useful for tiling backgrounds)
  view(sf) {
    if (sf == null) sf = 1;
    const hw = G.W / 2 / this.zoom, hh = G.H / 2 / this.zoom;
    const cx = this.x * sf - this.sx / this.zoom, cy = this.y * sf - this.sy / this.zoom;
    return { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
  }
};

// offscreen canvases + memoised renders
G.makeCanvas = function (w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
};
G._cache = new Map();
// G.cached(key, w, h, fn(ctx, w, h)) -> canvas (rendered once, reused)
G.cached = function (key, w, h, fn) {
  let c = G._cache.get(key);
  if (c) return c;
  c = G.makeCanvas(w, h);
  const cx = c.getContext('2d');
  fn(cx, w, h);
  if (!(G.A && G.A.busy())) G._cache.set(key, c);   // a picture it used may not be decoded yet: build it again next time
  return c;
};
G.uncache = function (prefix) { for (const k of Array.from(G._cache.keys())) if (k.startsWith(prefix)) G._cache.delete(k); };

// ------------------------------------------------------------------ fonts
// window.__FNF_FONTS is filled by the build (base64 TTFs). Names used everywhere:
//   'FNFAlpha' - Spicy Rice: chunky hand-inked menu letters (FNF "Alphabet" look)
//   'FNFVcr'   - VT323: VCR-style mono font for the in-song HUD + small UI text
//   'FNFBody'  - Chewy: rounded hand-drawn font for dialogue + buttons
G.FONT = {
  alpha: "'FNFAlpha', 'Arial Black', Impact, sans-serif",
  vcr: "'FNFVcr', 'Courier New', monospace",
  body: "'FNFBody', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif",
};
G.fontsReady = (function () {
  const list = window.__FNF_FONTS || {};
  const ps = [];
  for (const name in list) {
    try {
      const bin = atob(list[name]);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const ff = new FontFace(name, buf.buffer);
      ps.push(ff.load().then(f => { document.fonts.add(f); }).catch(() => {}));
    } catch (e) { /* ignore, fallback fonts are fine */ }
  }
  return Promise.all(ps).then(() => { G._cache.clear(); });
})();

// ------------------------------------------------------------------ text
// G.text(ctx, str, x, y, {size, font:'alpha'|'vcr'|'body', color, outline (px), outlineColor,
//   align, baseline, alpha, maxWidth, letterSpacing})
G.text = function (ctx, str, x, y, o) {
  o = o || {};
  str = String(str);
  const size = o.size || 24;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.font = (o.weight ? o.weight + ' ' : '') + size + 'px ' + (G.FONT[o.font || 'body'] || o.font);
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'alphabetic';
  if (o.letterSpacing != null && 'letterSpacing' in ctx) ctx.letterSpacing = o.letterSpacing + 'px';
  if (o.outline) {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    ctx.lineWidth = o.outline * 2;
    ctx.strokeStyle = o.outlineColor || '#000';
    ctx.strokeText(str, x, y, o.maxWidth);
  }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(str, x, y, o.maxWidth);
  ctx.restore();
};
G.measure = function (ctx, str, size, font) {
  ctx.save();
  ctx.font = size + 'px ' + (G.FONT[font || 'body'] || font);
  const w = ctx.measureText(String(str)).width;
  ctx.restore();
  return w;
};
// FNF "Alphabet" text. Real FNF menu words are hand-inked: chunky letters of
// slightly different sizes, tilts and heights. Two looks:
//   style 'menu'    -> BLACK letters with a WHITE border (unselected menu item)
//   style 'menuSel' -> WHITE letters, thick BLACK border + black drop shadow (selected item)
//   style 'bold'    -> WHITE letters with a BLACK border (freeplay list, titles)  [default]
// The tilt/size of every letter is fixed per string (seed), plus a tiny 24fps
// re-ink wobble so it feels like animated sprite letters.
// opts: {size (70), style, color, outlineColor, outline, align:'left'|'center'|'right', alpha,
//        wobble (0..1, default 1), jitter (0..1, default 1), time, seed, spacing (0.96)}
G.alpha = function (ctx, str, x, y, o) {
  o = o || {};
  str = String(str).toUpperCase();
  const size = o.size || 70;
  const style = o.style || 'bold';
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.font = size + 'px ' + G.FONT.alpha;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  const spacing = o.spacing || 0.96;
  const widths = [];
  let total = 0;
  for (const ch of str) { const w = ctx.measureText(ch).width; widths.push(w); total += w * spacing; }
  let cx = x;
  if (o.align === 'center') cx = x - total / 2; else if (o.align === 'right') cx = x - total;
  const wob = o.wobble == null ? 1 : o.wobble;
  const jit = o.jitter == null ? 1 : o.jitter;
  const frame = Math.floor((o.time != null ? o.time : G.time) * 8);
  const seed = o.seed != null ? o.seed : G.hash(str);
  let fill = o.color, line = o.outlineColor;
  if (style === 'menu') { fill = fill || '#000'; line = line || '#fff'; }
  else { fill = fill || '#fff'; line = line || '#000'; }
  const ow = o.outline != null ? o.outline : size * (style === 'menuSel' ? 0.12 : 0.1);
  const shadow = o.shadow != null ? o.shadow : style === 'menuSel';
  const r = G.rng(seed);
  let i = 0;
  for (const ch of str) {
    const w = widths[i];
    const sc = 1 + (r() - 0.5) * 0.16 * jit, rot = (r() - 0.5) * 0.12 * jit, dy = (r() - 0.5) * size * 0.1 * jit;
    if (ch !== ' ') {
      const wr = G.rng(seed + i * 131 + frame * 977);
      const wx = (wr() - 0.5) * size * 0.012 * wob, wy = (wr() - 0.5) * size * 0.016 * wob;
      ctx.save();
      ctx.translate(cx + w / 2 + wx, y + dy + wy);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      if (shadow) {
        ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.lineWidth = ow * 2;
        ctx.strokeText(ch, -w / 2 + size * 0.05, size * 0.07); ctx.fillText(ch, -w / 2 + size * 0.05, size * 0.07);
      }
      ctx.lineWidth = ow * 2; ctx.strokeStyle = line;
      ctx.strokeText(ch, -w / 2, 0);
      ctx.fillStyle = fill;
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();
    }
    cx += w * spacing; i++;
  }
  ctx.restore();
  return total;
};
G.alphaWidth = function (ctx, str, size, spacing) { return G.measure(ctx, String(str).toUpperCase(), size || 70, 'alpha') * (spacing || 0.96); };
G.roundRect = function (ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
// wrap text into lines that fit maxWidth (uses current font settings)
G.wrap = function (ctx, str, maxWidth, size, font) {
  ctx.save();
  ctx.font = size + 'px ' + (G.FONT[font || 'body'] || font);
  const words = String(str).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
};

// ------------------------------------------------------------------ sound shortcut
// Safe even before audio exists. Names are listed in CONTRACT.md (sfx list).
G.sfx = function (name, opts) { try { if (G.audio && G.audio.sfx) return G.audio.sfx(name, opts); } catch (e) { console.warn(e); } };

// ------------------------------------------------------------------ conductor
// Tracks beats/steps for a time source in ms. Call update(posMs) every frame;
// it calls onStep(step) / onBeat(beat) once for every new step/beat crossed.
G.Conductor = class {
  constructor(bpm) { this.setBpm(bpm || 100); this.lastStep = -Infinity; this.pos = 0; }
  setBpm(bpm) { this.bpm = bpm; this.crochet = 60000 / bpm; this.stepCrochet = this.crochet / 4; }
  get beatF() { return this.pos / this.crochet; }
  get stepF() { return this.pos / this.stepCrochet; }
  reset(posMs) { this.pos = posMs || 0; this.lastStep = Math.floor(this.pos / this.stepCrochet) - 1; }
  update(posMs, onStep, onBeat) {
    this.pos = posMs;
    const step = Math.floor(posMs / this.stepCrochet);
    if (step < this.lastStep) this.lastStep = step - 1;     // time went backwards (loop/seek)
    if (step - this.lastStep > 64) this.lastStep = step - 1; // big jump: don't spam
    while (this.lastStep < step) {
      this.lastStep++;
      if (onStep) onStep(this.lastStep);
      if (this.lastStep % 4 === 0 && onBeat) onBeat(this.lastStep / 4);
    }
  }
};

// ------------------------------------------------------------------ registries
// Characters. See CONTRACT.md for the def format.
G.chars = {
  defs: {},
  register(def) {
    if (!def || !def.id) throw new Error('char needs id');
    def.anims = def.anims || {};
    def.box = def.box || { w: 400, h: 450 };
    def.camOffset = def.camOffset || { x: 0, y: -260 };
    def.faces = def.faces || 'right';
    def.dance = def.dance || 'idle';
    def.singDuration = def.singDuration || 4;
    def.healthColor = def.healthColor || '#a1a1a1';
    this.defs[def.id] = def;
    return def;
  },
  get(id) { return this.defs[id] || null; },
  list() { return Object.keys(this.defs); },
  has(def, anim) { return !!(def && def.anims && def.anims[anim]); },
  // anim fallbacks so a missing optional anim never crashes or vanishes
  FALLBACK: {
    singLEFTmiss: 'singLEFT', singDOWNmiss: 'singDOWN', singUPmiss: 'singUP', singRIGHTmiss: 'singRIGHT',
    'singLEFT-alt': 'singLEFT', 'singDOWN-alt': 'singDOWN', 'singUP-alt': 'singUP', 'singRIGHT-alt': 'singRIGHT',
    hey: 'singUP', cheer: 'hey', scared: 'idle', sad: 'idle', danceLeft: 'idle', danceRight: 'idle',
    firstDeath: 'singDOWNmiss', deathLoop: 'firstDeath', deathConfirm: 'hey', shoot: 'singRIGHT', transform: 'singUP',
    laugh: 'hey', idle: 'danceLeft', resultsLoss: 'sad', resultsGood: 'idle', resultsGreat: 'hey', resultsPerfect: 'hey',
  },
  resolve(def, anim) {
    let a = anim, guard = 0;
    while (def && !def.anims[a] && guard++ < 6) a = this.FALLBACK[a] || 'idle';
    if (def && !def.anims[a]) { a = Object.keys(def.anims)[0]; }
    return a;
  },
  // Draw a character. ctx must already be in world (or screen) space.
  // x,y = feet position. flip = mirror horizontally (play handles LEFT/RIGHT swap).
  // info = {beat, time, form, lowQuality, tint:'#hex', tintAmt:0..1, alpha:0..1}
  // tint/alpha are applied to the WHOLE character through an offscreen buffer
  // (so a miss can tint the sprite purple like FNF without tinting the stage).
  draw(ctx, id, anim, at, x, y, scale, flip, info) {
    const def = this.get(id);
    if (!def) return;
    info = info || {};
    const a = this.resolve(def, anim);
    const fn = def.anims[a];
    if (!fn) return;
    const s = (scale || 1) * (def.scale || 1);
    const needBuf = (info.tint && info.tintAmt !== 0) || (info.alpha != null && info.alpha < 1);
    if (!needBuf) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip ? -s : s, s);
      try { fn(ctx, at || 0, info); } catch (e) { G.reportError(e, 'char ' + id + ' ' + a); }
      ctx.restore();
      return;
    }
    if (info.alpha != null && info.alpha <= 0) return;
    // device-space bounds of the character box
    const m = ctx.getTransform();
    const bw = def.box.w * 1.4, bh = def.box.h * 1.25;
    const pts = [[x - bw / 2 * s, y - bh * s], [x + bw / 2 * s, y - bh * s], [x - bw / 2 * s, y + bh * 0.12 * s], [x + bw / 2 * s, y + bh * 0.12 * s]]
      .map(p => [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f]);
    let x0 = Math.floor(Math.min(...pts.map(p => p[0]))), y0 = Math.floor(Math.min(...pts.map(p => p[1])));
    let x1 = Math.ceil(Math.max(...pts.map(p => p[0]))), y1 = Math.ceil(Math.max(...pts.map(p => p[1])));
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, ctx.canvas.width); y1 = Math.min(y1, ctx.canvas.height);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    let buf = this._buf;
    if (!buf || buf.width < w || buf.height < h) { buf = this._buf = G.makeCanvas(Math.max(w, buf ? buf.width : 0), Math.max(h, buf ? buf.height : 0)); this._bctx = buf.getContext('2d'); }
    const b = this._bctx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, w, h);
    b.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
    b.translate(x, y);
    b.scale(flip ? -s : s, s);
    try { fn(b, at || 0, info); } catch (e) { G.reportError(e, 'char ' + id + ' ' + a); }
    if (info.tint && info.tintAmt !== 0) {
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.globalCompositeOperation = 'source-atop';
      b.globalAlpha = info.tintAmt == null ? 0.45 : info.tintAmt;
      b.fillStyle = info.tint; b.fillRect(0, 0, w, h);
      b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (info.alpha != null) ctx.globalAlpha *= info.alpha;
    ctx.drawImage(buf, 0, 0, w, h, x0, y0, w, h);
    ctx.restore();
  },
  icon(ctx, id, x, y, size, losing, t) {
    const def = this.get(id);
    ctx.save();
    ctx.translate(x, y);
    try {
      if (def && def.icon) def.icon(ctx, size || 150, !!losing, t || 0);
      else {
        ctx.fillStyle = (def && def.healthColor) || '#888';
        ctx.beginPath(); ctx.arc(0, 0, (size || 150) * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.stroke();
      }
    } catch (e) { G.reportError(e, 'icon ' + id); }
    ctx.restore();
  },
  portrait(ctx, id, x, y, w, h, emotion, t) {
    const def = this.get(id);
    if (!def || !def.portrait) return false;
    ctx.save(); ctx.translate(x, y);
    try { def.portrait(ctx, w, h, emotion || 'normal', t || 0); } catch (e) { G.reportError(e, 'portrait ' + id); }
    ctx.restore();
    return true;
  },
};
// One placed, beat-dancing character (menus, story band, results, gameplay).
// FNF rules: 'idle' dancers bop every 2nd beat, 'leftRight' dancers (MEL) swap
// danceLeft/danceRight every beat. A special anim with `lock` seconds is not
// interrupted by beats until the lock runs out.
G.Dancer = class {
  constructor(id) { this.id = id; this.anim = 'idle'; this.at = 0; this.lock = 0; this.side = false; }
  get def() { return G.chars.get(this.id); }
  play(anim, lock) { this.anim = anim; this.at = 0; this.lock = lock || 0; }
  beat(b, force) {
    const d = this.def;
    if (!d) return;
    if (this.lock > 0 && !force) return;
    if (d.dance === 'leftRight') { this.side = !this.side; this.play(this.side ? 'danceLeft' : 'danceRight'); }
    else if (b % 2 === 0 || force) this.play('idle');
  }
  update(dt) { this.at += dt; if (this.lock > 0) this.lock -= dt; }
  draw(ctx, x, y, scale, flip, info) {
    if (this.def) G.chars.draw(ctx, this.id, this.anim, this.at, x, y, scale, flip, info);
    else if (G.drawPlaceholderChar) { ctx.save(); ctx.translate(x, y); ctx.scale(scale || 1, scale || 1); G.drawPlaceholderChar(ctx, this.id || '?', '#777'); ctx.restore(); }
  }
};
// Stages. See CONTRACT.md for the def format.
G.stages = {
  defs: {},
  register(def) {
    if (!def || !def.id) throw new Error('stage needs id');
    def.zoom = def.zoom || 0.9;
    def.dad = def.dad || { x: 380, y: 900 };
    def.gf = def.gf || { x: 740, y: 860 };
    def.bf = def.bf || { x: 1100, y: 900 };
    this.defs[def.id] = def;
    return def;
  },
  get(id) { return this.defs[id] || this.defs.practice || null; },
  list() { return Object.keys(this.defs); },
};

// ------------------------------------------------------------------ errors
G.errors = [];
G.reportError = function (e, where) {
  const msg = (where ? where + ': ' : '') + (e && e.message ? e.message : String(e));
  if (G.errors.length < 30 && !G.errors.some(x => x.msg === msg)) G.errors.push({ msg, t: performance.now() });
  console.error('[FNF2]', msg, e);
};
window.addEventListener('error', ev => G.reportError(ev.error || ev.message, 'global'));
window.addEventListener('unhandledrejection', ev => G.reportError(ev.reason, 'promise'));

// ------------------------------------------------------------------ toasts
G.toasts = [];
G.toast = function (msg, color) { G.toasts.push({ msg, color: color || '#fff', t: 0, life: 2.6 }); if (G.toasts.length > 4) G.toasts.shift(); };

// ------------------------------------------------------------------ input
G.input = {
  down: {},          // code -> true
  actionsDown: {},   // action -> count of held keys
  pointers: {},      // id -> {x,y}
  touchMode: false,  // becomes true after first touch
  lastCode: null,
  // non-note actions (menus). Note lanes + dodge come from G.settings.binds.
  UI: {
    ui_left: ['ArrowLeft', 'KeyA'], ui_down: ['ArrowDown', 'KeyS'], ui_up: ['ArrowUp', 'KeyW'], ui_right: ['ArrowRight', 'KeyD'],
    accept: ['Enter', 'NumpadEnter', 'Space'], back: ['Escape', 'Backspace'], pause: ['Enter', 'Escape', 'NumpadEnter'],
    reset: ['KeyR'], debug7: ['Digit7'], debug8: ['Digit8'], tab: ['Tab'], shift: ['ShiftLeft', 'ShiftRight'],
    ctrl: ['ControlLeft', 'ControlRight'],
  },
  actionsFor(code) {
    const out = [];
    const b = G.settings.binds;
    for (const a in b) if (b[a].includes(code)) out.push(a);
    for (const a in this.UI) if (this.UI[a].includes(code)) out.push(a);
    return out;
  },
  isDown(action) { return (this.actionsDown[action] || 0) > 0; },
  // game-space coordinates of a client point
  toGame(clientX, clientY) {
    const r = G.canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * G.W, y: (clientY - r.top) / r.height * G.H };
  },
  blockKeys: false, // set true while a text box / key-rebind is capturing raw keys
};
(function () {
  const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab', 'Backspace']);
  function onKey(e, down) {
    if (G.audio && G.audio.unlock) G.audio.unlock();
    const code = e.code || e.key;
    if (PREVENT.has(code) && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) e.preventDefault();
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const I = G.input;
    const repeat = !!e.repeat || (down && I.down[code]);
    if (down) { I.down[code] = true; I.lastCode = code; } else delete I.down[code];
    const acts = I.actionsFor(code);
    if (!repeat) for (const a of acts) {
      I.actionsDown[a] = Math.max(0, (I.actionsDown[a] || 0) + (down ? 1 : -1));
    }
    G.touchMode = false;
    const scr = G.screen;
    if (G.trans.active && down) return; // ignore presses mid transition
    if (scr && scr.onKey) { try { if (scr.onKey(code, down, repeat, e) === true) return; } catch (err) { G.reportError(err, 'onKey'); } }
    if (I.blockKeys) return;
    // a screen returns true when it used the key, so a key bound to two actions (Enter = accept + pause) only fires once
  if (scr && scr.onAction) for (const a of acts) { try { if (scr.onAction(a, down, repeat, e) === true) break; } catch (err) { G.reportError(err, 'onAction ' + a); } }
  }
  window.addEventListener('keydown', e => onKey(e, true));
  window.addEventListener('keyup', e => onKey(e, false));
  window.addEventListener('blur', () => {
    // release everything so nothing stays "held" after alt-tab
    const I = G.input;
    for (const code in I.down) onKey({ code, repeat: false, preventDefault() {}, target: null }, false);
    I.actionsDown = {};
    if (G.screen && G.screen.onBlur) try { G.screen.onBlur(); } catch (e) { G.reportError(e, 'onBlur'); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen && G.screen.onBlur) try { G.screen.onBlur(); } catch (e) { G.reportError(e, 'onBlur'); }
  });
  function ptr(type, e) {
    if (G.audio && G.audio.unlock) G.audio.unlock();
    const p = G.input.toGame(e.clientX, e.clientY);
    if (e.pointerType === 'touch') G.touchMode = true;
    if (type === 'down') G.input.pointers[e.pointerId] = p;
    else if (type === 'move' && G.input.pointers[e.pointerId]) G.input.pointers[e.pointerId] = p;
    else if (type === 'up') delete G.input.pointers[e.pointerId];
    const scr = G.screen;
    if (G.trans.active && type === 'down') return;
    if (scr && scr.onPointer) { try { scr.onPointer(type, p.x, p.y, e.pointerId, e); } catch (err) { G.reportError(err, 'onPointer'); } }
  }
  G.canvas.addEventListener('pointerdown', e => { e.preventDefault(); try { G.canvas.setPointerCapture(e.pointerId); } catch (x) {} ptr('down', e); });
  G.canvas.addEventListener('pointermove', e => ptr('move', e));
  G.canvas.addEventListener('pointerup', e => ptr('up', e));
  G.canvas.addEventListener('pointercancel', e => ptr('up', e));
  G.canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (G.screen && G.screen.onWheel) try { G.screen.onWheel(Math.sign(e.deltaY), e); } catch (err) { G.reportError(err, 'onWheel'); }
  }, { passive: false });
  G.canvas.addEventListener('contextmenu', e => e.preventDefault());
})();
// swipe helper for menus on phones: call from onPointer; returns 'up'|'down'|'left'|'right'|'tap'|null on 'up'
G.Swipe = class {
  constructor() { this.start = null; }
  handle(type, x, y) {
    if (type === 'down') { this.start = { x, y, t: performance.now() }; return null; }
    if (type === 'up' && this.start) {
      const dx = x - this.start.x, dy = y - this.start.y, s = this.start; this.start = null;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return { dir: 'tap', x: s.x, y: s.y };
      if (Math.abs(dx) > Math.abs(dy)) return { dir: dx > 0 ? 'right' : 'left', x: s.x, y: s.y };
      return { dir: dy > 0 ? 'down' : 'up', x: s.x, y: s.y };
    }
    return null;
  }
};

// ------------------------------------------------------------------ screens + transitions
// Screen object: {enter(params), leave(), update(dt), draw(ctx), onAction(action, down, repeat, e),
//   onKey(code, down, repeat, e) -> true to swallow, onPointer(type,x,y,id,e), onWheel(dir), onBlur()}
G.screens = {};
G.screen = null;
G.screenName = '';
G.trans = { active: false, phase: 0, t: 0, dur: 0.45, pending: null };
G.setScreen = function (name, params, opts) {
  opts = opts || {};
  if (!G.screens[name]) { G.reportError(new Error('no screen ' + name), 'setScreen'); return; }
  const T = G.trans;
  if (opts.instant || !G.screen) { G._switch(name, params); if (!opts.instant && G.screen) { T.active = true; T.phase = 2; T.t = 0; } return; }
  if (T.active && T.phase === 1) { T.pending = { name, params }; return; }
  T.active = true; T.phase = 1; T.t = 0; T.pending = { name, params };
};
G._switch = function (name, params) {
  if (G.screen && G.screen.leave) try { G.screen.leave(); } catch (e) { G.reportError(e, 'leave ' + G.screenName); }
  G.screen = G.screens[name]; G.screenName = name;
  if (G.screen.enter) try { G.screen.enter(params || {}); } catch (e) { G.reportError(e, 'enter ' + name); }
};
G.drawTransition = function (ctx) {
  const T = G.trans;
  if (!T.active) return;
  // FNF style: a black block with a soft gradient edge sweeping down the screen
  G.setScreenT(ctx);
  const p = G.clamp(T.t / T.dur, 0, 1);
  const H = G.H, grad = 260;
  let top;
  if (T.phase === 1) top = G.lerp(-H - grad, 0, G.ease.quadOut(p));          // covering
  else top = G.lerp(0, H + grad, G.ease.quadIn(p));                           // revealing
  const g = ctx.createLinearGradient(0, top - grad, 0, top);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  if (T.phase === 1) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, -grad, G.W, top + H + grad);
    const g2 = ctx.createLinearGradient(0, top + H, 0, top + H + grad);
    g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, top + H, G.W, grad);
  } else {
    ctx.fillStyle = g; ctx.fillRect(0, top - grad, G.W, grad);
    ctx.fillStyle = '#000'; ctx.fillRect(0, top, G.W, H);
  }
};
G.updateTransition = function (dt) {
  const T = G.trans;
  if (!T.active) return;
  if (T.phase === 2 && G.A.busy()) return;     // stay covered until the new screen's pictures are ready
  T.t += dt;
  if (T.t >= T.dur) {
    if (T.phase === 1) {
      const p = T.pending; T.pending = null;
      if (p) G._switch(p.name, p.params);
      T.phase = 2; T.t = 0;
    } else { T.active = false; }
  }
};

// ------------------------------------------------------------------ main loop
G.time = 0; G.dt = 0; G.frame = 0;
G.fps = 60; G._fpsAcc = 0; G._fpsN = 0; G._lowFpsTime = 0;
G._last = performance.now();
G.loop = function () {
  const now = performance.now();
  let dt = (now - G._last) / 1000; G._last = now;
  if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
  G.dt = dt; G.time += dt; G.frame++;
  G._fpsAcc += dt; G._fpsN++;
  if (G._fpsAcc >= 0.5) {
    G.fps = Math.round(G._fpsN / G._fpsAcc); G._fpsAcc = 0; G._fpsN = 0;
    // auto quality: drop render resolution if we're struggling for a while
    if (G.settings.quality === 'auto' && !document.hidden) {
      if (G.fps < 45) G._lowFpsTime += 0.5; else G._lowFpsTime = Math.max(0, G._lowFpsTime - 0.25);
      if (G._lowFpsTime >= 3 && G.autoQ > 0.55) { G.autoQ = Math.max(0.55, G.autoQ - 0.15); G._lowFpsTime = 0; G.resize(); }
    }
  }
  const ctx = G.ctx;
  // big pictures still decoding: hold the screen (keep the last frame up), then hand them to the GPU
  const busy = G.A.busy() || G.A.fresh.length > 0;
  if (G.A.fresh.length) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    for (const img of G.A.fresh.splice(0)) try { ctx.drawImage(img, 0, 0, 1, 1); } catch (e) {}
  }
  if (busy) { try { if (G.audio && G.audio.update) G.audio.update(dt); } catch (e) {} G.updateTransition(dt); requestAnimationFrame(G.loop); return; }
  if (G.A._after.length) for (const fn of G.A._after.splice(0)) try { fn(); } catch (e) { G.reportError(e, 'afterLoad'); }
  try {
    if (G.audio && G.audio.update) G.audio.update(dt);
    if (G.screen && G.screen.update) G.screen.update(dt);
  } catch (e) { G.reportError(e, 'update ' + G.screenName); }
  G.updateTransition(dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
  G.screenZoom = 1; G.screenOff.x = G.screenOff.y = 0;
  try { if (G.screen && G.screen.draw) G.screen.draw(ctx); } catch (e) { G.reportError(e, 'draw ' + G.screenName); }
  G.screenZoom = 1; G.screenOff.x = G.screenOff.y = 0;
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  G.drawTransition(ctx);
  if (G.stickers && G.stickers.active) { try { G.stickers.update(dt); G.stickers.draw(ctx); } catch (e) { G.reportError(e, 'stickers'); G.stickers.active = false; } }
  G.drawOverlay(ctx, dt);
  requestAnimationFrame(G.loop);
};
G.drawOverlay = function (ctx, dt) {
  G.setScreenT(ctx);
  ctx.globalAlpha = 1;
  if (G.settings.fps) {
    G.text(ctx, 'FPS: ' + G.fps, 10, 22, { font: 'vcr', size: 22, outline: 2 });
  }
  let y = 60;
  for (const t of G.toasts) {
    t.t += dt;
    const a = Math.min(1, t.t * 6, (t.life - t.t) * 3);
    if (a > 0) {
      G.text(ctx, t.msg, G.W / 2, y, { font: 'body', size: 26, align: 'center', color: t.color, outline: 4, alpha: a });
      y += 36;
    }
  }
  G.toasts = G.toasts.filter(t => t.t < t.life);
  if (G.DEBUG && G.errors.length) {
    let ey = G.H - 10;
    for (const er of G.errors.slice(-5)) { G.text(ctx, er.msg.slice(0, 120), 8, ey, { font: 'vcr', size: 18, color: '#ff5050', outline: 2 }); ey -= 20; }
  }
};
G.DEBUG = /[?&](debug|dev)=/.test(location.search);
G.query = (function () { const o = {}; new URLSearchParams(location.search).forEach((v, k) => o[k] = v); return o; })();

// started by 99-main.js once every module has loaded
G.start = function (firstScreen, params) {
  const boot = document.getElementById('boot'); if (boot) boot.remove();
  G.resize();
  G.setScreen(firstScreen, params, { instant: true });
  requestAnimationFrame(G.loop);
};
