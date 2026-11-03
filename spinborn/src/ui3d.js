// 3D panels (canvas on a plane) with buttons that work with the mouse and with VR lasers. Colors follow the GS3 console look.
import * as THREE from 'three';
import { FONT, roundRect, wrap, drawText } from './text.js';

export function theme() {
  const t = (window.GS3Console && window.GS3Console.theme && window.GS3Console.theme()) || {};
  return {
    bg: t.panel || 'rgba(14,16,22,0.92)', line: 'rgba(255,255,255,0.14)', text: t.text || '#ffffff', dim: t.text2 || '#a7b0bd',
    accent: t.focus || t.accent || '#3d7cf0', accentText: t.focusText || '#ffffff', font: t.font || FONT
  };
}

let PANELS = [];
export class Panel {
  constructor({ w = 1, h = 0.6, ppm = 512, render, name = 'panel' } = {}) {
    this.w = w; this.h = h; this.render = render;
    this.cw = Math.min(2048, Math.round(w * ppm)); this.ch = Math.min(2048, Math.round(h * ppm));
    this.canvas = document.createElement('canvas'); this.canvas.width = this.cw; this.canvas.height = this.ch;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, toneMapped: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat); this.mesh.name = name; this.mesh.renderOrder = 10;
    this.mesh.userData.panel = this;
    this.buttons = []; this.hover = null; this.visible = true;
    PANELS.push(this);
  }
  button(id, x, y, w, h, label, onClick, style = {}) { this.buttons.push({ id, x, y, w, h, label, onClick, style }); }
  clearButtons() { this.buttons = []; }
  draw() {
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cw, this.ch);
    if (this.render) this.render(g, this.cw, this.ch, this);
    for (const b of this.buttons) drawButton(g, b, this.hover === b.id);
    this.tex.needsUpdate = true;
  }
  hitUV(uv) {
    const x = uv.x * this.cw, y = (1 - uv.y) * this.ch;
    for (const b of this.buttons) if (!b.style.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    return null;
  }
  setHover(id) { if (this.hover !== id) { this.hover = id; this.draw(); } }
  show(v) { this.visible = v; this.mesh.visible = v; if (!v) this.setHover(null); }
  dispose() { this.tex.dispose(); this.mat.dispose(); this.mesh.geometry.dispose(); PANELS = PANELS.filter(p => p !== this); }
}

export function drawButton(g, b, hot) {
  const th = theme(); const s = b.style;
  const r = Math.min(b.h / 2, s.radius ?? 22);
  roundRect(g, b.x, b.y, b.w, b.h, r);
  const on = s.on ?? false;
  g.fillStyle = s.fill || (s.primary || on ? th.accent : hot ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)');
  if (hot && (s.primary || on)) g.fillStyle = shade(th.accent, 1.18);
  g.fill();
  g.lineWidth = hot ? 4 : 2; g.strokeStyle = hot ? '#ffffff' : (s.stroke || 'rgba(255,255,255,0.22)'); g.stroke();
  const size = s.size || Math.min(44, b.h * 0.42);
  g.save(); roundRect(g, b.x, b.y, b.w, b.h, r); g.clip();
  if (s.sub) {
    drawText(g, b.label, b.x + 24, b.y + b.h * 0.42, { size, weight: 700, color: s.primary || on ? th.accentText : th.text, maxW: b.w - 48 });
    drawText(g, s.sub, b.x + 24, b.y + b.h * 0.76, { size: size * 0.62, weight: 500, color: s.primary || on ? th.accentText : th.dim, maxW: b.w - 48 });
  } else {
    drawText(g, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, { size, weight: 700, color: s.primary || on ? th.accentText : th.text, align: 'center', base: 'middle', maxW: b.w - 24 });
  }
  if (s.value != null) drawText(g, s.value, b.x + b.w - 24, b.y + b.h / 2 + 1, { size: size * 0.8, weight: 600, color: th.dim, align: 'right', base: 'middle' });
  g.restore();
}
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

export function panelBackground(g, W, H, { title, sub, radius = 40 } = {}) {
  const th = theme();
  roundRect(g, 4, 4, W - 8, H - 8, radius);
  g.fillStyle = th.bg; g.fill(); g.lineWidth = 3; g.strokeStyle = th.line; g.stroke();
  let y = 0;
  if (title) { drawText(g, title, 48, 92, { size: 58, weight: 800, color: th.text, maxW: W - 96 }); y = 110; }
  if (sub) {
    g.font = `500 30px ${FONT}`; const lines = wrap(g, sub, W - 96);
    lines.forEach((l, i) => drawText(g, l, 48, y + 46 + i * 40, { size: 30, weight: 500, color: th.dim }));
    y += 40 + lines.length * 40;
  }
  return y;
}

// A menu panel from a simple model: { title, sub, items: [{ label, sub, value, onClick, primary, on }] }
export function menuPanel(model, { w = 1.3, rowH = 112 } = {}) {
  const head = 140 + (model.sub ? 46 + Math.ceil(model.sub.length / 48) * 40 : 0);
  const H = head + model.items.length * (rowH + 18) + 40;
  const p = new Panel({ w, h: H / 512, ppm: 512, name: 'menu' });
  p.render = (g, W) => panelBackground(g, W, H, { title: model.title, sub: model.sub });
  model.items.forEach((it, i) => p.button('m' + i, 40, head + i * (rowH + 18), p.cw - 80, rowH, it.label, it.onClick,
    { primary: it.primary, on: it.on, sub: it.sub, value: it.value, size: it.sub ? 40 : 42 }));
  p.draw();
  return p;
}

// ---------- pointer / laser interaction (mouse + both controllers) ----------
export class Interact {
  constructor(camera, scene) {
    this.camera = camera; this.ray = new THREE.Raycaster(); this.ray.camera = camera; this.targets = []; this.hot = new Map();
    this.extra = []; // { object, onHover(hit), onClick(hit) }
  }
  add(obj, handlers) { this.extra.push({ object: obj, ...handlers }); }
  remove(obj) { this.extra = this.extra.filter(e => e.object !== obj); }
  list() {
    const meshes = PANELS.filter(p => p.visible && p.mesh.parent && isShown(p.mesh)).map(p => p.mesh);
    return meshes.concat(this.extra.filter(e => isShown(e.object)).map(e => e.object));
  }
  cast(origin, dir) {
    this.ray.set(origin, dir); this.ray.far = 30;
    const hits = this.ray.intersectObjects(this.list(), true);
    for (const h of hits) {
      let o = h.object; while (o && !o.userData.panel && !this.extra.find(e => e.object === o)) o = o.parent;
      if (!o) continue;
      if (o.userData.panel) { const b = h.uv ? o.userData.panel.hitUV(h.uv) : null; return { hit: h, panel: o.userData.panel, button: b }; }
      return { hit: h, extra: this.extra.find(e => e.object === o) };
    }
    return null;
  }
  // source = 'mouse' | 'left' | 'right'
  hover(source, origin, dir) {
    const r = this.cast(origin, dir);
    const prev = this.hot.get(source);
    if (prev && prev.panel && (!r || r.panel !== prev.panel)) prev.panel.setHover(null);
    if (r && r.panel) r.panel.setHover(r.button ? r.button.id : null);
    if (r && r.extra && r.extra.onHover) r.extra.onHover(r.hit, source);
    if (prev && prev.extra && (!r || r.extra !== prev.extra) && prev.extra.onOut) prev.extra.onOut(source);
    this.hot.set(source, r);
    return r;
  }
  click(source) {
    const r = this.hot.get(source);
    if (!r) return false;
    if (r.button && r.button.onClick) { r.button.onClick(r.button); return true; }
    if (r.extra && r.extra.onClick) { r.extra.onClick(r.hit, source); return true; }
    return !!r.panel;
  }
}
function isShown(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

// ---------- VR keyboard for the comment ----------
export class KeyboardPanel extends Panel {
  constructor({ suggestions = [], onDone, maxLen = 90 }) {
    super({ w: 1.5, h: 1.5, ppm: 512, name: 'keyboard' });
    this.text = ''; this.onDone = onDone; this.maxLen = maxLen; this.caps = false; this.suggestions = suggestions;
    this.render = (g, W, H) => {
      const th = theme();
      panelBackground(g, W, H, {});
      drawText(g, 'Comment what you think you\'re gonna be', 44, 70, { size: 40, weight: 800, color: th.text });
      roundRect(g, 40, 92, W - 80, 86, 18); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill(); g.strokeStyle = th.line; g.lineWidth = 2; g.stroke();
      drawText(g, (this.text || '') + (Math.floor(performance.now() / 500) % 2 ? '|' : ' '), 60, 148, { size: 40, weight: 600, color: this.text ? '#fff' : th.dim, maxW: W - 120 });
    };
    this.layout();
    this.draw();
  }
  layout() {
    this.clearButtons();
    const W = this.cw; const rows = ['1234567890', 'qwertyuiop', 'asdfghjkl\'', 'zxcvbnm,.?'];
    const kw = 64, kh = 62, gap = 8; let y = 196;
    rows.forEach((row, ri) => {
      const x0 = (W - (row.length * (kw + gap) - gap)) / 2 - (ri === 3 ? 40 : 0);
      [...row].forEach((ch, ci) => {
        const label = this.caps ? ch.toUpperCase() : ch;
        this.button('k' + ri + ci, x0 + ci * (kw + gap), y, kw, kh, label, () => this.type(label), { size: 30, radius: 12 });
      });
      if (ri === 3) this.button('bs', x0 + row.length * (kw + gap), y, 120, kh, 'Delete', () => { this.text = this.text.slice(0, -1); this.draw(); }, { size: 26, radius: 12 });
      y += kh + gap;
    });
    this.button('caps', 80, y, 150, kh, 'Shift', () => { this.caps = !this.caps; this.layout(); this.draw(); }, { size: 26, radius: 12, on: this.caps });
    this.button('sp', 240, y, W - 560, kh, 'space', () => this.type(' '), { size: 26, radius: 12 });
    this.button('ok', W - 310, y, 230, kh, 'Post', () => this.onDone && this.onDone(this.text.trim()), { size: 28, radius: 12, primary: true });
    y += kh + 18;
    // ready-made comments (2 columns)
    const cw = (W - 100) / 2;
    this.suggestions.slice(0, 6).forEach((s, i) => {
      this.button('s' + i, 40 + (i % 2) * (cw + 20), y + Math.floor(i / 2) * 58, cw, 50, s, () => { this.text = s; this.draw(); }, { size: 22, radius: 12 });
    });
  }
  type(ch) { if (this.text.length < this.maxLen) { this.text += ch; if (this.caps) { this.caps = false; this.layout(); } this.draw(); } }
}
