import { h, section, slider, toggle, chips, button, row, toast, select } from '../lib.js';
import { state, set, refreshMyCursors } from '../state.js';
import { nav } from '../nav.js';
import { CURSORS, CURSOR_MAP } from '../../../shared/cursor-library.mjs';
import { renderFrame } from '../../../shared/cursor-render.mjs';

const cv = window.cv;

const PALETTE = [
  '#000000', '#ffffff', '#7f7f7f', '#c3c3c3', '#ff0000', '#ff7f27', '#ffd400', '#22b14c',
  '#00e5ff', '#3f48cc', '#a349a4', '#ff2bd6', '#880015', '#b97a57', '#fff200', '#b5e61d',
  '#99d9ea', '#7092be', '#c8bfe7', '#ffaec9', '#39ff14', '#ff6a00', '#1a1a2e', '#f4f1e1',
];
const TOOLS = [
  ['pencil', '✏️', 'Pencil'], ['eraser', '🧽', 'Eraser'], ['fill', '🪣', 'Fill'], ['picker', '💧', 'Pick color'],
  ['line', '📏', 'Line'], ['rect', '⬜', 'Rectangle'], ['hotspot', '🎯', 'Set click point (hotspot)'],
];

// editor state survives page switches
const ed = {
  mode: 'draw', grid: 32, frames: null, cur: 0, tool: 'pencil', color: '#00e5ff', mirror: false, onion: true,
  fps: 8, hotspot: [0, 0], name: 'My Cursor', editingId: null, undo: [], redo: [], upload: null,
};

function blank(n) { return new ImageData(n, n); }
function cloneFrames() { return ed.frames.map((f) => new ImageData(new Uint8ClampedArray(f.data), f.width, f.height)); }
function snapshot() { ed.undo.push({ frames: cloneFrames(), cur: ed.cur }); if (ed.undo.length > 60) ed.undo.shift(); ed.redo = []; }

function hexToRgba(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
function rgbaToHex(d, i) { return `#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`; }

function setPx(img, x, y, rgba) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = rgba[0]; img.data[i + 1] = rgba[1]; img.data[i + 2] = rgba[2]; img.data[i + 3] = rgba[3];
}
function paint(img, x, y, rgba) {
  setPx(img, x, y, rgba);
  if (ed.mirror) setPx(img, img.width - 1 - x, y, rgba);
}
function linePts(x0, y0, x1, y1) {
  const pts = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}
function flood(img, x, y, rgba) {
  const w = img.width, hgt = img.height, d = img.data;
  const i0 = (y * w + x) * 4;
  const target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
  if (target.every((v, k) => v === rgba[k])) return;
  const same = (i) => d[i] === target[0] && d[i + 1] === target[1] && d[i + 2] === target[2] && d[i + 3] === target[3];
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= w || cy >= hgt) continue;
    const i = (cy * w + cx) * 4;
    if (!same(i)) continue;
    d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2]; d[i + 3] = rgba[3];
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

function frameToDataUrl(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

async function dataUrlToImageData(url, w, hgt) {
  const im = new Image();
  im.src = url;
  await im.decode();
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(im, 0, 0, w, hgt);
  return x.getImageData(0, 0, w, hgt);
}

function templateFrames(id, n) {
  const def = CURSOR_MAP.get(id);
  const count = def.animated ? Math.min(def.frames, 16) : 1;
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true });
  const out = [];
  for (let i = 0; i < count; i++) {
    renderFrame(x, def, {}, i / count, n);
    out.push(x.getImageData(0, 0, n, n));
  }
  const hs = def.px ? def.hotspot : [Math.round((def.hotspot[0] * n) / 64), Math.round((def.hotspot[1] * n) / 64)];
  return { frames: out, hotspot: hs, fps: def.animated ? Math.min(def.fps, 16) : 8 };
}

// ---------------------------------------------------------------- draw mode

function drawMode(main) {
  if (!ed.frames) ed.frames = [blank(ed.grid)];
  const n = ed.grid;
  const scale = Math.max(6, Math.floor(448 / n));
  const canvas = h('canvas', { class: 'ed-canvas', width: n * scale, height: n * scale });
  const ctx = canvas.getContext('2d');
  const preview = h('canvas', { width: 96, height: 96, class: 'checker', style: { borderRadius: '10px' } });
  const pctx = preview.getContext('2d');
  const framesBox = h('div', { class: 'frames' });
  let drag = null;

  const redraw = (overlay) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#cfcfe0' : '#e9e9f3';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    const drawImg = (img, alpha) => {
      const d = img.data;
      ctx.globalAlpha = alpha;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        if (!d[i + 3]) continue;
        ctx.fillStyle = `rgba(${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3] / 255})`;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
      ctx.globalAlpha = 1;
    };
    if (ed.onion && ed.cur > 0) drawImg(ed.frames[ed.cur - 1], 0.25);
    drawImg(ed.frames[ed.cur], 1);
    if (overlay) for (const [x, y] of overlay) { ctx.fillStyle = ed.tool === 'eraser' ? 'rgba(255,255,255,.7)' : ed.color; ctx.fillRect(x * scale, y * scale, scale, scale); }
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * scale + 0.5, 0); ctx.lineTo(i * scale + 0.5, n * scale); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * scale + 0.5); ctx.lineTo(n * scale, i * scale + 0.5); ctx.stroke();
    }
    const [hx, hy] = ed.hotspot;
    ctx.strokeStyle = '#ff0040'; ctx.lineWidth = 2;
    ctx.strokeRect(hx * scale + 1, hy * scale + 1, scale - 2, scale - 2);
    ctx.beginPath(); ctx.arc(hx * scale + scale / 2, hy * scale + scale / 2, 2, 0, Math.PI * 2); ctx.fillStyle = '#ff0040'; ctx.fill();
    drawFrames();
  };

  const drawFrames = () => {
    framesBox.replaceChildren(...ed.frames.map((f, i) => {
      const c = h('canvas', { width: n, height: n, class: 'checker', style: { width: '56px', height: '56px', imageRendering: 'pixelated', display: 'block' } });
      c.getContext('2d').putImageData(f, 0, 0);
      return h('div', { class: `frame-thumb${i === ed.cur ? ' active' : ''}`, onclick: () => { ed.cur = i; redraw(); } }, c, h('span', {}, i + 1));
    }));
  };

  let pv = 0;
  const pvTimer = setInterval(() => {
    const f = ed.frames[pv % ed.frames.length];
    pv++;
    const c = document.createElement('canvas');
    c.width = n; c.height = n;
    c.getContext('2d').putImageData(f, 0, 0);
    pctx.clearRect(0, 0, 96, 96);
    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(c, 0, 0, 96, 96);
  }, 1000 / ed.fps);

  const cell = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * n), Math.floor(((e.clientY - r.top) / r.height) * n)];
  };
  const shapePts = (a, b) => {
    if (ed.tool === 'line') return linePts(a[0], a[1], b[0], b[1]);
    const pts = [];
    const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
    const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    for (let x = x0; x <= x1; x++) { pts.push([x, y0], [x, y1]); }
    for (let y = y0; y <= y1; y++) { pts.push([x0, y], [x1, y]); }
    return pts;
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = cell(e);
    const img = ed.frames[ed.cur];
    const rgba = ed.tool === 'eraser' || e.button === 2 ? [0, 0, 0, 0] : hexToRgba(ed.color);
    if (ed.tool === 'hotspot') { ed.hotspot = [x, y]; redraw(); return; }
    if (ed.tool === 'picker') {
      const i = (y * n + x) * 4;
      if (img.data[i + 3]) { ed.color = rgbaToHex(img.data, i); drawPalette(); }
      return;
    }
    snapshot();
    if (ed.tool === 'fill') { flood(img, x, y, rgba); redraw(); return; }
    drag = { start: [x, y], last: [x, y], rgba };
    if (ed.tool === 'pencil' || ed.tool === 'eraser') { paint(img, x, y, rgba); redraw(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [x, y] = cell(e);
    if (ed.tool === 'pencil' || ed.tool === 'eraser') {
      for (const [px, py] of linePts(drag.last[0], drag.last[1], x, y)) paint(ed.frames[ed.cur], px, py, drag.rgba);
      drag.last = [x, y];
      redraw();
    } else if (ed.tool === 'line' || ed.tool === 'rect') {
      redraw(shapePts(drag.start, [x, y]));
    }
  });
  const end = (e) => {
    if (!drag) return;
    const [x, y] = cell(e);
    if (ed.tool === 'line' || ed.tool === 'rect') for (const [px, py] of shapePts(drag.start, [x, y])) paint(ed.frames[ed.cur], px, py, drag.rgba);
    drag = null;
    redraw();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const paletteBox = h('div');
  const drawPalette = () => paletteBox.replaceChildren(
    h('div', { class: 'palette' }, PALETTE.map((c) => h('div', { class: `swatch${ed.color === c ? ' active' : ''}`, style: { background: c }, onclick: () => { ed.color = c; drawPalette(); } }))),
    h('label', { class: 'color-field', style: { marginTop: '8px' } }, h('input', { type: 'color', value: ed.color, oninput: (e) => { ed.color = e.target.value; } }), 'Any color'),
  );
  drawPalette();

  const toolsBox = h('div');
  const drawTools = () => toolsBox.replaceChildren(h('div', { class: 'tools' }, TOOLS.map(([id, emo, title]) => h('button', { class: `tool${ed.tool === id ? ' active' : ''}`, title, onclick: () => { ed.tool = id; drawTools(); } }, emo))));
  drawTools();

  const undo = () => { const s = ed.undo.pop(); if (!s) return; ed.redo.push({ frames: cloneFrames(), cur: ed.cur }); ed.frames = s.frames; ed.cur = Math.min(s.cur, s.frames.length - 1); redraw(); };
  const redo = () => { const s = ed.redo.pop(); if (!s) return; ed.undo.push({ frames: cloneFrames(), cur: ed.cur }); ed.frames = s.frames; ed.cur = Math.min(s.cur, s.frames.length - 1); redraw(); };
  const onKey = (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  };
  window.addEventListener('keydown', onKey);

  const newCanvas = (size) => { ed.grid = size; ed.frames = [blank(size)]; ed.cur = 0; ed.hotspot = [0, 0]; ed.undo = []; ed.redo = []; ed.editingId = null; nav.go('editor'); };

  const save = async (use) => {
    const name = (ed.name || 'My Cursor').slice(0, 40);
    const rec = await cv.myCursors.save({ id: ed.editingId || undefined, name, w: n, h: n, hotspot: ed.hotspot, fps: ed.fps, smooth: false, kind: 'pixel', frames: ed.frames.map(frameToDataUrl) });
    ed.editingId = rec.id;
    await refreshMyCursors();
    if (use) set({ cursor: { id: rec.id } });
    toast(use ? `⭐ "${name}" saved and applied!` : `💾 "${name}" saved to My Cursors`, 'good');
  };

  main.append(
    h('div', { class: 'editor' },
      h('div', {},
        canvas,
        h('p', { class: 'hint' }, 'Left click draws · right click erases · 🎯 sets where the click happens (red box) · Ctrl+Z / Ctrl+Y undo/redo'),
      ),
      h('div', {},
        section('🛠️ Tools', toolsBox, h('div', { style: { marginTop: '10px' } }, row(
          toggle({ label: 'Mirror', desc: 'Draw both sides at once', checked: ed.mirror, onChange: (v) => { ed.mirror = v; } }),
          toggle({ label: 'Onion skin', desc: 'See the last frame faintly', checked: ed.onion, onChange: (v) => { ed.onion = v; redraw(); } }))),
        row(button('↩️ Undo', undo, 'small'), button('↪️ Redo', redo, 'small'), button('🗑️ Clear frame', () => { snapshot(); ed.frames[ed.cur] = blank(n); redraw(); }, 'small'))),
        section('🎨 Colors', paletteBox),
        section('🎞️ Frames (animation)',
          framesBox,
          row(
            button('➕ New', () => { snapshot(); ed.frames.splice(ed.cur + 1, 0, blank(n)); ed.cur++; redraw(); }, 'small'),
            button('📄 Copy', () => { snapshot(); ed.frames.splice(ed.cur + 1, 0, new ImageData(new Uint8ClampedArray(ed.frames[ed.cur].data), n, n)); ed.cur++; redraw(); }, 'small'),
            button('❌ Delete', () => { if (ed.frames.length < 2) return; snapshot(); ed.frames.splice(ed.cur, 1); ed.cur = Math.max(0, ed.cur - 1); redraw(); }, 'small'),
            button('⬅️', () => { if (ed.cur < 1) return; snapshot(); [ed.frames[ed.cur - 1], ed.frames[ed.cur]] = [ed.frames[ed.cur], ed.frames[ed.cur - 1]]; ed.cur--; redraw(); }, 'small'),
            button('➡️', () => { if (ed.cur >= ed.frames.length - 1) return; snapshot(); [ed.frames[ed.cur + 1], ed.frames[ed.cur]] = [ed.frames[ed.cur], ed.frames[ed.cur + 1]]; ed.cur++; redraw(); }, 'small')),
          h('div', { class: 'row', style: { marginTop: '10px' } }, preview,
            slider({ label: 'Speed', min: 1, max: 30, value: ed.fps, format: (v) => `${v} fps`, onInput: (v) => { ed.fps = v; }, live: false }))),
        section('💾 Save',
          h('input', { class: 'text', value: ed.name, placeholder: 'Name', oninput: (e) => { ed.name = e.target.value; } }),
          h('div', { class: 'row', style: { marginTop: '10px' } }, button('💾 Save', () => save(false)), button('⭐ Save & use it', () => save(true), 'primary'))),
        section('📐 New / start from',
          row(select({ label: 'Canvas size', value: ed.grid, options: [16, 24, 32, 48].map((v) => ({ value: v, label: `${v} x ${v}` })), onChange: (v) => newCanvas(Number(v)) }),
            select({
              label: 'Start from a built-in cursor', value: '',
              options: [{ value: '', label: '— pick one —' }, ...CURSORS.map((c) => ({ value: c.id, label: `${c.name}${c.animated ? ' (animated)' : ''}` }))],
              onChange: (id) => { if (!id) return; snapshot(); const t = templateFrames(id, n); ed.frames = t.frames; ed.hotspot = t.hotspot; ed.fps = t.fps; ed.cur = 0; ed.name = `${CURSOR_MAP.get(id).name} Remix`; nav.go('editor'); },
            }))),
      ),
    ),
  );
  redraw();
  return () => { clearInterval(pvTimer); window.removeEventListener('keydown', onKey); };
}

// ---------------------------------------------------------------- upload mode

async function decodeUpload(file) {
  const MAX = 128;
  const fit = (w, hgt) => { const k = Math.min(1, MAX / Math.max(w, hgt)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(hgt * k))]; };
  if (file.ext === 'gif' && 'ImageDecoder' in window) {
    const data = await (await fetch(file.dataUrl)).arrayBuffer();
    const dec = new ImageDecoder({ data, type: 'image/gif' });
    await dec.tracks.ready;
    const count = Math.min(dec.tracks.selectedTrack.frameCount, 60);
    const frames = [];
    let totalMs = 0;
    let size = null;
    for (let i = 0; i < count; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      if (!size) size = fit(image.displayWidth, image.displayHeight);
      const c = document.createElement('canvas');
      c.width = size[0]; c.height = size[1];
      c.getContext('2d').drawImage(image, 0, 0, size[0], size[1]);
      frames.push(c.toDataURL('image/png'));
      totalMs += (image.duration || 100000) / 1000;
      image.close();
    }
    const fps = Math.max(1, Math.min(30, Math.round(1000 / Math.max(16, totalMs / count))));
    return { frames, w: size[0], h: size[1], fps };
  }
  const im = new Image();
  im.src = file.dataUrl;
  await im.decode();
  const [w, hgt] = fit(im.naturalWidth, im.naturalHeight);
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  c.getContext('2d').drawImage(im, 0, 0, w, hgt);
  return { frames: [c.toDataURL('image/png')], w, h: hgt, fps: 8 };
}

function uploadMode(main) {
  const u = ed.upload;
  const body = h('div');
  main.append(section('🖼️ Turn any image into a cursor',
    h('p', {}, 'PNG, JPG, WEBP or GIF. GIFs turn into animated cursors! Big images get shrunk to 128px max.'),
    button('📂 Choose image...', async () => {
      try {
        const [file] = await cv.library.import('image');
        if (!file) return;
        toast('Loading image...', 'info', 1200);
        const dec = await decodeUpload(file);
        ed.upload = { ...dec, name: file.name.slice(0, 40), hotspot: [0, 0], smooth: true };
        nav.go('editor', { mode: 'upload' });
      } catch (err) { toast(`😤 ${err.message}`, 'bad'); }
    }, 'primary')), body);
  if (!u) return;

  const S = 256;
  const k = S / Math.max(u.w, u.h);
  const canvas = h('canvas', { width: Math.round(u.w * k), height: Math.round(u.h * k), class: 'checker', style: { cursor: 'crosshair', borderRadius: '8px' } });
  const ctx = canvas.getContext('2d');
  const imgs = [];
  let i = 0;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imgs[i % imgs.length]) ctx.drawImage(imgs[i % imgs.length], 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ff0040'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(u.hotspot[0] * k, u.hotspot[1] * k, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(u.hotspot[0] * k - 11, u.hotspot[1] * k); ctx.lineTo(u.hotspot[0] * k + 11, u.hotspot[1] * k);
    ctx.moveTo(u.hotspot[0] * k, u.hotspot[1] * k - 11); ctx.lineTo(u.hotspot[0] * k, u.hotspot[1] * k + 11); ctx.stroke();
  };
  Promise.all(u.frames.map((src) => { const im = new Image(); im.src = src; return im.decode().then(() => im); })).then((list) => { imgs.push(...list); draw(); });
  const timer = u.frames.length > 1 ? setInterval(() => { i++; draw(); }, 1000 / u.fps) : null;
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    u.hotspot = [Math.round(((e.clientX - r.left) / r.width) * u.w), Math.round(((e.clientY - r.top) / r.height) * u.h)];
    draw();
  });

  body.append(h('div', { class: 'grid2' },
    section('🎯 Click where the "click point" should be', canvas,
      h('p', { class: 'hint' }, `${u.w} x ${u.h}px · ${u.frames.length} frame${u.frames.length > 1 ? 's' : ''}`),
      row(button('↖️ Top-left', () => { u.hotspot = [0, 0]; draw(); }, 'small'), button('🎯 Center', () => { u.hotspot = [Math.floor(u.w / 2), Math.floor(u.h / 2)]; draw(); }, 'small'))),
    section('💾 Save',
      h('input', { class: 'text', value: u.name, oninput: (e) => { u.name = e.target.value; } }),
      h('div', { style: { margin: '10px 0' } }, toggle({ label: 'Smooth scaling', desc: 'Turn off for pixel art so it stays crispy', checked: u.smooth, onChange: (v) => { u.smooth = v; } })),
      u.frames.length > 1 ? slider({ label: 'Animation speed', min: 1, max: 30, value: u.fps, format: (v) => `${v} fps`, onInput: (v) => { u.fps = v; } }) : null,
      row(button('⭐ Save & use it', async () => {
        const rec = await cv.myCursors.save({ name: u.name || 'Uploaded', w: u.w, h: u.h, hotspot: u.hotspot, fps: u.fps, smooth: u.smooth, kind: 'image', frames: u.frames });
        await refreshMyCursors();
        set({ cursor: { id: rec.id } });
        ed.upload = null;
        toast('⭐ Your cursor is on!', 'good');
        nav.go('cursors');
      }, 'primary')))));
  return () => { if (timer) clearInterval(timer); };
}

export default {
  id: 'editor', title: 'Pixel Editor', emoji: '✏️',
  render(main, arg) {
    if (arg?.mode) ed.mode = arg.mode;
    if (arg?.edit) {
      const rec = state.myCursors.find((c) => c.id === arg.edit);
      if (rec) {
        ed.mode = 'draw';
        ed.editingId = rec.id; ed.name = rec.name; ed.fps = rec.fps || 8; ed.hotspot = rec.hotspot || [0, 0];
        const size = Math.max(rec.w, rec.h);
        ed.grid = [16, 24, 32, 48].includes(size) ? size : 32;
        ed.frames = [blank(ed.grid)];
        Promise.all(rec.frames.map((f) => dataUrlToImageData(f, ed.grid, ed.grid))).then((frames) => { ed.frames = frames; ed.cur = 0; nav.go('editor'); });
      }
    }
    main.append(h('div', { class: 'page-head' },
      h('div', {}, h('h2', {}, '✏️ Make your own cursor'), h('p', {}, ed.editingId ? `Editing "${ed.name}"` : 'Draw it pixel by pixel, or upload a picture or GIF.')),
      chips({ value: ed.mode, options: [{ value: 'draw', label: 'Draw', emoji: '✏️' }, { value: 'upload', label: 'Upload image / GIF', emoji: '🖼️' }], onChange: (v) => { ed.mode = v; nav.go('editor'); } })));
    return ed.mode === 'upload' ? uploadMode(main) : drawMode(main);
  },
  onSettings() {},
  onMyCursors() {},
};
