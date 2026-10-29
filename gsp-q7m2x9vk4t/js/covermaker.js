/* Cover maker: crop any picture to a 16:9 cover, and put the game's name on it as a logo.
   - The logo font is matched to the game (spooky, pixel, racing, cute...), its colors come from the picture,
     and it goes in the calmest part of the picture so it doesn't sit on the main character.
   - Two pictures are saved: the clean one and the one with the name, so the name can be switched off later. */
import { h } from './dom.js';
import { icon } from './icons.js';
import { modal } from './modal.js';
import { Sound } from './sound.js';

const W = 1280, H = 720;

export const LOGOS = {
  bold: { name: 'Bold', font: '400 {s}px "GS Logo Anton"', upper: true, track: 0.03, size: 1 },
  arcade: { name: 'Arcade', font: '400 {s}px "GS Logo Bungee"', upper: true, track: 0.01, size: 0.85 },
  spooky: { name: 'Spooky', font: '400 {s}px "GS Logo Creepster"', upper: true, track: 0.04, size: 1 },
  pixel: { name: 'Pixel', font: '400 {s}px "GS Logo Pixel"', upper: true, track: 0.02, size: 0.6 },
  racing: { name: 'Racing', font: '400 {s}px "GS Logo Racing"', upper: true, track: 0.01, size: 1 },
  cute: { name: 'Cute', font: '700 {s}px "GS Logo Fredoka"', upper: false, track: 0, size: 1 },
  shooter: { name: 'Shooter', font: '400 {s}px "GS Logo Ops"', upper: true, track: 0.02, size: 0.9 },
  epic: { name: 'Epic', font: '900 {s}px "GS Logo Cinzel"', upper: true, track: 0.06, size: 0.85 },
  scifi: { name: 'Sci-fi', font: '900 {s}px "GS Logo Orbitron"', upper: true, track: 0.12, size: 0.8 }
};
const ORDER = Object.keys(LOGOS);
const SPOTS = ['auto', 'bottom', 'top', 'middle', 'bottom-left', 'bottom-right', 'top-left', 'top-right'];
const SPOT_NAME = { auto: 'Auto', 'bottom-left': 'Bottom left', bottom: 'Bottom', 'bottom-right': 'Bottom right', 'top-left': 'Top left', top: 'Top', 'top-right': 'Top right', middle: 'Middle' };

/* the font that fits the game, from its name */
const MATCH = [
  ['spooky', /horror|scary|night|dead|zombie|ghost|haunt|blood|scp|fnaf|creep|nightmare|hell|demon|grim|evil|slender|backroom|death|\bdie\b|kill|wrath|hollow|\.exe|curse|shadow|skull|witch|vamp/i],
  ['pixel', /pixel|8.?bit|retro|block|craft|mine|tetris|snake|pong|mario|voxel|terraria/i],
  ['racing', /rac(e|ing)|driv|\bcar|kart|drift|speed|turbo|rally|moto|road|highway|traffic|rail|dash|nitro|street/i],
  ['cute', /cute|cat\b|kitty|dog|pupp|bunny|meadow|critter|cozy|pet|candy|bear|garden|farm|flower|sweet|baby|tiny|pocket|bubble|slime|cookie|cake|pony|panda|hamster/i],
  ['shooter', /gun|shoot|sniper|war\b|battle|soldier|tank|strike|ops\b|combat|army|squad|blitz|bullet|iron|metal|rifle|apex|siege/i],
  ['epic', /quest|legend|kingdom|dragon|knight|sword|realm|magic|vault|throne|myth|dungeon|empire|\bgod|titan|rune|saga|elden|souls/i],
  ['scifi', /space|star|galaxy|robot|cyber|alien|planet|rocket|mech|neon|future|astro|orbit|nova|quantum|portal|rift|solar|lab\b|scrap|tron|matrix/i],
  ['arcade', /fnf|funkin|rhythm|beat|click|flip|jump|party|ball|bounce|smash|arcade|pinball|combo|clicker|frenzy/i]
];
/* the logo's font for HTML (Steam's tall tiles show the name as text instead of cutting the logo off) */
export function logoFont(style) {
  const m = /^(\d+) \{s\}px (.*)$/.exec((LOGOS[style] || LOGOS.bold).font);
  return { fontWeight: m[1], fontFamily: m[2], textTransform: (LOGOS[style] || LOGOS.bold).upper ? 'uppercase' : 'none' };
}

/* show a game's name as its logo in HTML (the PS5 home + game hub, the Xbox game page: real consoles show the game's
   logo there, not plain text) */
export function applyLogo(el, g) {
  const id = (g.logo && LOGOS[g.logo.style]) ? g.logo.style : autoStyle(g.name);
  const f = logoFont(id);
  el.classList.add('logo');
  el.style.fontFamily = f.fontFamily;
  el.style.fontWeight = f.fontWeight;
  el.style.textTransform = f.textTransform;
  el.style.letterSpacing = LOGOS[id].track + 'em';
  el.style.setProperty('--logo-size', String(LOGOS[id].size));
  return el;
}

export function autoStyle(name) {
  const n = String(name || '');
  for (const m of MATCH) if (m[1].test(n)) return m[0];
  return 'bold';
}

export function loadImage(url) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error('picture')); };
    img.src = url;
  });
}

let fontsReady = null;
function fonts() {
  if (!fontsReady) fontsReady = Promise.all(ORDER.map(function (k) { return document.fonts.load(LOGOS[k].font.replace('{s}', '80')); })).catch(function () {});
  return fontsReady;
}

/* ---------- colors + calm spots ---------- */
function mix(c, to, k) { return c.map(function (v, i) { return Math.round(v + (to[i] - v) * k); }); }
function rgb(c, a) { return a == null ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + a + ')'; }
function hueOf(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hh *= 60;
  return hh < 0 ? hh + 360 : hh;
}

/* the picture's main bright color (most common saturated hue), or a soft blue */
export function accentOf(src) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 36;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, 64, 36);
  const d = x.getImageData(0, 0, 64, 36).data;
  const bins = {};
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    if (sat < 0.38 || mx < 90) continue;
    const k = Math.round(hueOf([r, g, b]) / 24) % 15;
    const bin = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 });
    const w = sat * mx / 255;
    bin.n += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
  }
  let best = null;
  Object.keys(bins).forEach(function (k) { if (!best || bins[k].n > best.n) best = bins[k]; });
  if (!best || best.n < 3) return [120, 175, 255];
  let col = [best.r / best.n, best.g / best.n, best.b / best.n].map(Math.round);
  const mx = Math.max.apply(null, col);
  if (mx < 200) col = col.map(function (v) { return Math.min(255, Math.round(v * 200 / mx)); });
  return col;
}

/* how busy each part of the cover is (edges), to keep the name off the main character */
function busyMap(cv) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 36;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(cv, 0, 0, 64, 36);
  const d = x.getImageData(0, 0, 64, 36).data;
  const lum = new Float32Array(64 * 36);
  for (let i = 0; i < lum.length; i++) lum[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
  const e = new Float32Array(64 * 36);
  for (let y = 1; y < 35; y++) for (let xx = 1; xx < 63; xx++) {
    const i = y * 64 + xx;
    e[i] = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + 64] - lum[i - 64]);
  }
  return function (rx, ry, rw, rh) {
    let s = 0, n = 0;
    for (let y = Math.max(0, Math.floor(ry * 36)); y < Math.min(36, Math.ceil((ry + rh) * 36)); y++) {
      for (let xx = Math.max(0, Math.floor(rx * 64)); xx < Math.min(64, Math.ceil((rx + rw) * 64)); xx++) { s += e[y * 64 + xx]; n++; }
    }
    return n ? s / n : 0;
  };
}
/* the name stays inside the middle square of the cover: square tiles (PS5, Switch...) cut the sides off */
function spotBox(spot) {
  const v = /^top/.test(spot) ? 0.06 : spot === 'middle' ? 0.36 : 0.66;
  return { x: 0.254, y: v, w: 0.492, h: 0.28 };
}
export function calmestSpot(cv) {
  const busy = busyMap(cv);
  let best = 'bottom', score = Infinity;
  ['bottom', 'top'].forEach(function (s, i) {
    const b = spotBox(s);
    const v = busy(b.x, b.y, b.w, b.h) * (1 + i * 0.04);   /* ties go to the bottom */
    if (v < score) { score = v; best = s; }
  });
  return best;
}

/* ---------- drawing the name ---------- */
function lines(text, max) {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max || t.indexOf(' ') < 0) return [t];
  const words = t.split(' ');
  let best = [t], bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) { bestDiff = diff; best = [a, b]; }
  }
  return best;
}

export function drawLogo(x, name, styleId, spot, accent) {
  const st = LOGOS[styleId] || LOGOS.bold;
  const text = st.upper ? String(name).toUpperCase() : String(name);
  const ls = lines(text, styleId === 'pixel' ? 12 : 16);
  const box = spotBox(spot);
  const maxW = box.w * W, align = /left$/.test(spot) ? 'left' : /right$/.test(spot) ? 'right' : 'center';
  /* as big as real cover logos: fills the spot's width, but never taller than about a fifth of the cover */
  const fontAt = function (s) { return st.font.replace('{s}', String(s)); };
  x.save();
  x.font = fontAt(100);
  x.letterSpacing = (st.track * 100).toFixed(1) + 'px';
  const w100 = Math.max.apply(null, ls.map(function (l) { return x.measureText(l).width; }));
  const capH = H * 0.22 * st.size * (ls.length > 1 ? 0.72 : 1);
  const size = Math.max(12, Math.floor(Math.min(capH, 100 * maxW / w100)));
  x.font = fontAt(size);
  x.letterSpacing = (st.track * size).toFixed(1) + 'px';
  const lh = size * (styleId === 'pixel' ? 1.35 : 1.02);
  const blockH = lh * ls.length;
  const ax = align === 'left' ? box.x * W : align === 'right' ? (box.x + box.w) * W : W / 2;
  let top = /^top/.test(spot) ? H * 0.07 : spot === 'middle' ? (H - blockH) / 2 : H * 0.93 - blockH;
  const blockW = Math.min(maxW, Math.max.apply(null, ls.map(function (l) { return x.measureText(l).width; })));
  const cx = align === 'left' ? ax + blockW / 2 : align === 'right' ? ax - blockW / 2 : ax;

  /* a soft dark patch behind the name so it reads on any picture (like real key art) */
  const sc = x.createRadialGradient(cx, top + blockH / 2, 0, cx, top + blockH / 2, Math.max(blockW, blockH) * 0.85);
  sc.addColorStop(0, 'rgba(0,0,0,0.5)');
  sc.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = sc;
  x.fillRect(0, 0, W, H);

  x.textAlign = align;
  x.textBaseline = 'top';
  x.lineJoin = styleId === 'pixel' ? 'miter' : 'round';
  const light = mix(accent, [255, 255, 255], 0.55), dark = mix(accent, [0, 0, 0], 0.6);
  const green = hueOf(accent) > 70 && hueOf(accent) < 170;
  const grad = function (stops) {
    const g = x.createLinearGradient(0, top, 0, top + blockH);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    return g;
  };
  const each = function (fn) { ls.forEach(function (l, i) { fn(l, ax, top + i * lh); }); };
  const shadow = function (col, blur, ox, oy) { x.shadowColor = col; x.shadowBlur = blur; x.shadowOffsetX = ox || 0; x.shadowOffsetY = oy || 0; };
  const noShadow = function () { shadow('transparent', 0); };

  if (styleId === 'racing') {
    x.translate(ax, top);
    x.transform(1, 0, -0.2, 1, 0, 0);
    x.translate(-ax, -top);
    [0.45, 0.3, 0.15].forEach(function (k, i) {
      x.fillStyle = rgb(accent, [0.1, 0.18, 0.28][i]);
      each(function (l, px, py) { x.fillText(l, px - size * k, py); });
    });
  }
  if (styleId === 'cute') {
    x.translate(cx, top + blockH / 2);
    x.rotate(-0.045);
    x.translate(-cx, -(top + blockH / 2));
  }

  /* glow / shadow under everything */
  const under = {
    bold: [rgb(accent, 0.45), size * 0.5], arcade: [rgb(dark), 0, 0, size * 0.09], spooky: [green ? 'rgba(90,255,60,0.55)' : 'rgba(255,20,20,0.55)', size * 0.45],
    pixel: [rgb(dark), 0, size * 0.12, size * 0.12], racing: ['rgba(0,0,0,0.6)', size * 0.2, 0, size * 0.06], cute: ['rgba(0,0,0,0.35)', size * 0.18, 0, size * 0.08],
    shooter: ['rgba(0,0,0,0.75)', size * 0.22, 0, size * 0.05], epic: ['rgba(255,190,80,0.5)', size * 0.45], scifi: [rgb(accent, 0.95), size * 0.35]
  }[styleId] || ['rgba(0,0,0,.6)', 20];
  shadow(under[0], under[1], under[2], under[3]);

  const outline = {
    arcade: ['#12131a', 0.12], pixel: ['#0b0b10', 0.14], racing: ['#0b0b10', 0.1], cute: ['#ffffff', 0.2],
    shooter: ['#111214', 0.07], epic: ['#3a2306', 0.05], scifi: [rgb(accent), 0.03], spooky: ['#090606', 0.06]
  }[styleId];
  if (outline) {
    x.strokeStyle = outline[0];
    x.lineWidth = size * outline[1];
    each(function (l, px, py) { x.strokeText(l, px, py); });
    if (styleId !== 'scifi') noShadow();
  }

  x.fillStyle = {
    bold: grad([[0, '#ffffff'], [1, '#d6dce8']]),
    arcade: grad([[0, rgb(mix(light, [255, 255, 255], 0.4))], [1, rgb(accent)]]),
    spooky: green ? grad([[0, '#d9ff9a'], [1, '#2f7a12']]) : grad([[0, '#ff5a48'], [0.55, '#c4120f'], [1, '#5c0000']]),
    pixel: '#ffffff',
    racing: grad([[0, '#ffffff'], [1, rgb(light)]]),
    cute: grad([[0, rgb(mix(accent, [255, 255, 255], 0.72))], [1, rgb(mix(accent, [255, 255, 255], 0.38))]]),
    shooter: grad([[0, '#f6f6f6'], [0.48, '#b9bec8'], [0.52, '#6e737d'], [1, '#e6e6e6']]),
    epic: grad([[0, '#fff6cf'], [0.45, '#f0c75e'], [0.55, '#b07a1e'], [1, '#ffe7a0']]),
    scifi: '#f4fbff'
  }[styleId] || '#fff';
  each(function (l, px, py) { x.fillText(l, px, py); });
  if (styleId === 'scifi' || styleId === 'bold') {
    /* second glow pass makes neon / soft light */
    shadow(styleId === 'scifi' ? rgb(mix(accent, [255, 255, 255], 0.3)) : 'rgba(0,0,0,0.5)', styleId === 'scifi' ? size * 0.12 : size * 0.12, 0, styleId === 'bold' ? size * 0.04 : 0);
    each(function (l, px, py) { x.fillText(l, px, py); });
  }
  x.restore();
}

/* ---------- making the cover ---------- */
function render(img, crop, logo, name, accent, logoLayer) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, W, H);
  if (logo && logo.on) {
    if (logoLayer) x.drawImage(logoLayer, 0, 0);
    else drawLogo(x, name, logo.style, logo.spot === 'auto' ? calmestSpot(cv) : logo.spot, accent);
  }
  return cv;
}
function bytes(cv) {
  return new Promise(function (resolve) {
    cv.toBlob(function (b) { b.arrayBuffer().then(function (a) { resolve(new Uint8Array(a)); }); }, 'image/jpeg', 0.92);
  });
}
function fullCrop(img) {
  const w = img.naturalWidth, hh = img.naturalHeight;
  let cw = w, ch = hh;
  if (w / hh > 16 / 9) cw = hh * 16 / 9; else ch = w * 9 / 16;
  return { x: (w - cw) / 2, y: (hh - ch) / 2, w: cw, h: ch };
}

/* does the picture already show the game's name? (title screens do) Uses Windows' own text reading. */
async function showsName(img, name) {
  if (typeof window.TextDetector !== 'function') return false;
  try {
    const found = await new window.TextDetector().detect(img);
    const seen = found.map(function (f) { return f.rawValue || ''; }).join(' ').toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
    const words = String(name).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(function (w) { return w.length >= 3; });
    if (!words.length) return false;
    const hits = words.filter(function (w) { return seen.indexOf(w) >= 0; }).length;
    return hits / words.length >= 0.5 || seen.replace(/ /g, '').indexOf(words.join('')) >= 0;
  } catch (e) { return false; }
}

/* a cover that was made by itself: add the name (keeps the picture as the clean one),
   unless the picture already shows it. force = the player switched the name on themselves. */
export async function addLogo(g, logo, force) {
  await fonts();
  const img = await loadImage(g.coverClean || g.cover);
  if (!force && await showsName(img, g.name)) return window.gs.invoke('covers:logo-off', g.id);
  const lg = Object.assign({ on: true, style: autoStyle(g.name), spot: 'auto' }, logo || {}, { on: true });
  const cv = render(img, fullCrop(img), lg, g.name, accentOf(img));
  return window.gs.invoke('covers:save', g.id, { clean: null, final: await bytes(cv), logo: lg, kind: g.coverKind === 'auto' ? 'auto' : 'picked' });
}

/* the editor: drag to move, scroll / LB RB to zoom, name on/off, font, spot.
   Resolves true when saved, false when closed, null when the picture can't be opened. */
export async function editCover(g, url) {
  let img;
  try { [img] = await Promise.all([loadImage(url), fonts()]); } catch (e) { return null; }
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const base = fullCrop(img);
  let zoom = 1, cx = nw / 2, cy = nh / 2;
  const accent = accentOf(img);
  const logo = { on: !(g.logo && g.logo.on === false), style: (g.logo && LOGOS[g.logo.style]) ? g.logo.style : autoStyle(g.name), spot: (g.logo && SPOTS.indexOf(g.logo.spot) >= 0) ? g.logo.spot : 'auto' };

  function crop() {
    const w = base.w / zoom, hh = base.h / zoom;
    cx = Math.max(w / 2, Math.min(nw - w / 2, cx));
    cy = Math.max(hh / 2, Math.min(nh - hh / 2, cy));
    return { x: cx - w / 2, y: cy - hh / 2, w: w, h: hh };
  }

  const stage = h('canvas.cm-stage', { 'data-f': '', width: W, height: H });
  const sx = stage.getContext('2d');
  let layer = null, autoSpot = 'bottom', layerKey = '';
  function drawLayer(spotNow) {
    const key = [logo.on, logo.style, spotNow].join('|');
    if (key === layerKey && layer) return;
    layerKey = key;
    layer = document.createElement('canvas');
    layer.width = W; layer.height = H;
    if (logo.on) drawLogo(layer.getContext('2d'), g.name, logo.style, spotNow, accent);
  }
  function paint(recalc) {
    const c = crop();
    sx.clearRect(0, 0, W, H);
    sx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, W, H);
    if (logo.spot === 'auto' && recalc) {
      const clean = document.createElement('canvas');
      clean.width = W; clean.height = H;
      clean.getContext('2d').drawImage(img, c.x, c.y, c.w, c.h, 0, 0, W, H);
      autoSpot = calmestSpot(clean);
    }
    drawLayer(logo.spot === 'auto' ? autoSpot : logo.spot);
    if (logo.on) sx.drawImage(layer, 0, 0);
    spotBtn.querySelector('b').textContent = SPOT_NAME[logo.spot] + (logo.spot === 'auto' ? ' (' + SPOT_NAME[autoSpot].toLowerCase() + ')' : '');
  }
  let settle = null;
  function moved() { paint(false); clearTimeout(settle); settle = setTimeout(function () { paint(true); }, 160); }
  function pan(dx, dy) { const c = crop(); cx += dx * c.w; cy += dy * c.h; moved(); }
  function zoomBy(k) { zoom = Math.max(1, Math.min(4, zoom * k)); moved(); }

  /* mouse: drag + wheel */
  let drag = null;
  stage.addEventListener('pointerdown', function (e) { stage.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener('pointermove', function (e) {
    if (!drag) return;
    const r = stage.getBoundingClientRect(), c = crop();
    cx -= (e.clientX - drag.x) * c.w / r.width;
    cy -= (e.clientY - drag.y) * c.h / r.height;
    drag = { x: e.clientX, y: e.clientY };
    moved();
  });
  stage.addEventListener('pointerup', function () { drag = null; });
  stage.addEventListener('wheel', function (e) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });

  const tool = function (ic, label, val, fn) {
    return h('button.btn', { 'data-f': '', onclick: function () { Sound.press(); fn(); } }, h('span', { html: icon(ic) }), label, val != null ? h('b', val) : null);
  };
  const nameBtn = tool('text', 'Name', logo.on ? 'On' : 'Off', function () { logo.on = !logo.on; nameBtn.querySelector('b').textContent = logo.on ? 'On' : 'Off'; paint(true); });
  const fontBtn = tool('edit', 'Font', LOGOS[logo.style].name, function () {
    logo.style = ORDER[(ORDER.indexOf(logo.style) + 1) % ORDER.length];
    fontBtn.querySelector('b').textContent = LOGOS[logo.style].name;
    if (!logo.on) { logo.on = true; nameBtn.querySelector('b').textContent = 'On'; }
    paint(false);
  });
  const spotBtn = tool('grid', 'Spot', '', function () { logo.spot = SPOTS[(SPOTS.indexOf(logo.spot) + 1) % SPOTS.length]; paint(true); });
  const tools = h('div.cm-tools',
    tool('search', 'Zoom out', null, function () { zoomBy(1 / 1.2); }),
    tool('plus', 'Zoom in', null, function () { zoomBy(1.2); }),
    h('span.sep'), nameBtn, fontBtn, spotBtn);
  const body = h('div', stage, h('div.cm-hint', 'Drag the picture to move it, scroll to zoom. Controller: highlight the picture, move with the stick, LB / RB zoom.'), tools);
  paint(true);

  return new Promise(function (resolve) {
    let saved = false;
    const m = modal({
      title: 'Cover for ' + g.name, body: body, wide: true,
      onKey: function (action) {
        if (action === 'prev') { zoomBy(1 / 1.15); return true; }
        if (action === 'next') { zoomBy(1.15); return true; }
        if (stage.classList.contains('focus') && /^(up|down|left|right)$/.test(action)) {
          /* moves the picture; once it can't go further that way, the highlight leaves the picture */
          const a = crop();
          pan(action === 'left' ? -0.04 : action === 'right' ? 0.04 : 0, action === 'up' ? -0.04 : action === 'down' ? 0.04 : 0);
          const b = crop();
          return Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5;
        }
        /* from the picture, Enter = done */
        if (stage.classList.contains('focus') && action === 'ok') { save(); return true; }
        return false;
      },
      onClose: function () { resolve(saved); },
      actions: [
        { label: 'Cancel' },
        { label: 'Save cover', kind: 'primary', icon: 'check', default: true, onClick: function () { save(); return false; } }
      ]
    });
    async function save() {
      if (saved) return;
      saved = true;
      const c = crop();
      const spotNow = logo.spot === 'auto' ? autoSpot : logo.spot;
      const clean = render(img, c, null, g.name, accent);
      drawLayer(spotNow);
      const final = logo.on ? render(img, c, { on: true }, g.name, accent, layer) : clean;
      const ok = await window.gs.invoke('covers:save', g.id, { clean: await bytes(clean), final: await bytes(final), logo: { on: logo.on, style: logo.style, spot: logo.spot } });
      saved = !!ok;
      m.close();
    }
    m.focus(stage);
  });
}
