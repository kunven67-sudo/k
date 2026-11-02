// The menus in VR: the same menu lists as on PC, drawn on a floating screen. Point with your right hand, pull the
// trigger to press. Colors and font follow the console picked in Game System 3 (GS3Console.theme()).
import * as THREE from 'three';

const W = 1024, H = 1280;
const imgCache = new Map();
function img(src) {
  let i = imgCache.get(src);
  if (!i) { i = new Image(); i.src = src; imgCache.set(src, i); }
  return i;
}
function theme() {
  const t = window.GS3Console ? window.GS3Console.theme() : {};
  return {
    font: (t.font || 'sans-serif').replace(/"/g, ''), text: t.text || '#f3f4f7', text2: t.text2 || 'rgba(243,244,247,.66)',
    panel: t.panel || 'rgba(24,26,32,.96)', button: t.button || 'rgba(255,255,255,.1)', focus: t.focus || '#fff',
    focusText: t.focusText || '#0b0c10', accent: t.accent || '#6aa8ff', radius: t.radius || 22
  };
}
function rr(g, x, y, w, h, r) {
  r = Math.min(r, h / 2, w / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function wrap(g, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

export function createPanel(widthM = 1.1) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, widthM * H / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  mesh.renderOrder = 30;
  mesh.visible = false;
  return { mesh, canvas, g: canvas.getContext('2d'), tex, regions: [], scroll: 0, maxScroll: 0, hover: -1, drag: null, menu: null };
}

export function drawMenu(P, m) {
  const g = P.g, t = theme();
  P.menu = m;
  P.regions = [];
  g.clearRect(0, 0, W, H);
  g.fillStyle = t.panel;
  rr(g, 0, 0, W, H, 34); g.fill();
  const pad = 56;
  let y = 60 - P.scroll;
  const F = (w, s) => `${w} ${s}px ${t.font}`;
  const add = (r) => { P.regions.push(r); return P.regions.length - 1; };
  const isHover = (i) => P.hover === i;
  g.textBaseline = 'middle';
  if (m.logo || m.title) {
    g.fillStyle = t.text; g.font = F(m.logo ? 800 : 300, m.logo ? 72 : 52);
    g.fillText(m.logo ? 'ANYFORGE' : m.title, pad, y + 30); y += 84;
  }
  if (m.sub) { g.font = F(400, 26); g.fillStyle = t.text2; for (const l of wrap(g, m.sub, W - pad * 2)) { g.fillText(l, pad, y + 14); y += 36; } y += 18; }
  for (const it of m.items()) {
    if (!it) continue;
    const rowW = W - pad * 2;
    switch (it.type) {
      case 'heading': g.font = F(600, 22); g.fillStyle = t.text2; g.fillText(it.text.toUpperCase(), pad, y + 26); y += 54; break;
      case 'note': g.font = F(400, 24); g.fillStyle = t.text2; for (const l of wrap(g, it.text, rowW)) { g.fillText(l, pad, y + 14); y += 34; } y += 10; break;
      case 'button': case 'toggle': case 'live': {
        const i = add({ x: pad, y, w: rowW, h: 76, on: it.type === 'button' ? it.on : it.type === 'toggle' ? () => it.set(!it.get()) : null });
        const hov = isHover(i);
        g.fillStyle = hov ? t.focus : t.button; rr(g, pad, y, rowW, 70, 14); g.fill();
        g.fillStyle = hov ? t.focusText : t.text; g.font = F(600, 30); g.fillText(it.label, pad + 26, y + 35);
        if (it.type === 'button' && it.value != null) { g.textAlign = 'right'; g.font = F(400, 24); g.fillStyle = hov ? t.focusText : t.text2; g.fillText(String(it.value).slice(0, 44), pad + rowW - 24, y + 35); g.textAlign = 'left'; }
        if (it.type === 'live') { g.textAlign = 'right'; g.font = F(700, 30); g.fillStyle = '#ff6b6b'; g.fillText(it.get(), pad + rowW - 24, y + 35); g.textAlign = 'left'; }
        if (it.type === 'toggle') {
          const on = it.get(), x = pad + rowW - 110, yy = y + 17;
          g.fillStyle = on ? t.accent : 'rgba(255,255,255,.22)'; rr(g, x, yy, 84, 36, 18); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(on ? x + 66 : x + 18, yy + 18, 14, 0, 7); g.fill();
        }
        y += 80; break;
      }
      case 'slider': {
        g.font = F(600, 28); g.fillStyle = t.text; g.fillText(it.label, pad + 4, y + 22);
        const v = it.get(), f = (v - it.min) / (it.max - it.min);
        g.textAlign = 'right'; g.font = F(400, 26); g.fillStyle = t.text2; g.fillText(it.fmt ? it.fmt(v) : String(+v.toFixed(3)), pad + rowW, y + 22); g.textAlign = 'left';
        const ty = y + 64;
        const i = add({ x: pad, y: ty - 26, w: rowW, h: 52, slide: (fx) => { let nv = it.min + Math.max(0, Math.min(1, fx)) * (it.max - it.min); nv = Math.round(nv / it.step) * it.step; it.set(+nv.toFixed(4)); } });
        g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, pad, ty - 5, rowW, 10, 5); g.fill();
        g.fillStyle = t.accent; rr(g, pad, ty - 5, rowW * f, 10, 5); g.fill();
        g.fillStyle = isHover(i) ? t.accent : '#fff'; g.beginPath(); g.arc(pad + rowW * f, ty, 18, 0, 7); g.fill();
        y += 100; break;
      }
      case 'choice': case 'tabs': case 'swatches': {
        if (it.label) { g.font = F(600, 28); g.fillStyle = t.text; g.fillText(it.label, pad + 4, y + 22); y += 50; }
        let x = pad;
        const list = it.type === 'swatches' ? it.colors.map((c) => [c, '']) : (it.options || it.tabs);
        for (const [v, l] of list) {
          const sw = it.type === 'swatches';
          g.font = F(600, 24);
          const w = sw ? 58 : g.measureText(l).width + 44;
          if (x + w > pad + rowW) { x = pad; y += 70; }
          const sel = String(it.get()).toLowerCase() === String(v).toLowerCase();
          const i = add({ x, y, w, h: 58, on: () => it.set(v) });
          if (sw) {
            g.fillStyle = v; g.beginPath(); g.arc(x + 29, y + 29, 25, 0, 7); g.fill();
            if (sel || isHover(i)) { g.strokeStyle = sel ? t.text : t.accent; g.lineWidth = 5; g.stroke(); }
          } else {
            g.fillStyle = sel ? t.accent : isHover(i) ? t.focus : t.button; rr(g, x, y, w, 54, 27); g.fill();
            g.fillStyle = sel ? '#fff' : isHover(i) ? t.focusText : t.text; g.fillText(l, x + 22, y + 28);
          }
          x += w + 12;
        }
        y += 76; break;
      }
      case 'grid': {
        const cols = 4, gap = 14, tw = (rowW - gap * (cols - 1)) / cols, th = tw + 54;
        it.tiles.forEach((tile, k) => {
          const cx = pad + (k % cols) * (tw + gap), cy = y + Math.floor(k / cols) * (th + gap);
          const i = add({ x: cx, y: cy, w: tw, h: th, on: tile.on });
          g.fillStyle = isHover(i) ? t.focus : tile.sel ? 'rgba(255,255,255,.16)' : t.button; rr(g, cx, cy, tw, th, 16); g.fill();
          if (tile.img) { const im = img(tile.img); if (im.complete && im.naturalWidth) g.drawImage(im, cx + 12, cy + 10, tw - 24, tw - 24); }
          g.fillStyle = isHover(i) ? t.focusText : t.text; g.font = F(600, 22); g.textAlign = 'center';
          g.fillText(tile.label.slice(0, 18), cx + tw / 2, cy + tw + 16); g.textAlign = 'left';
        });
        y += Math.ceil(it.tiles.length / cols) * (th + gap) + 10; break;
      }
      case 'row': {
        let x = pad;
        g.font = F(600, 26);
        for (const b of it.buttons) {
          const w = Math.max(180, g.measureText(b.label).width + 60);
          const i = add({ x, y, w, h: 66, on: b.on });
          g.fillStyle = isHover(i) ? t.focus : b.primary ? t.accent : t.button; rr(g, x, y, w, 64, 32); g.fill();
          g.fillStyle = isHover(i) ? t.focusText : '#fff'; g.textAlign = 'center'; g.fillText(b.label, x + w / 2, y + 33); g.textAlign = 'left';
          x += w + 14;
          if (x > pad + rowW - 180) { x = pad; y += 78; }
        }
        y += 88; break;
      }
      case 'keys': {
        g.font = F(400, 22);
        for (const [k, d] of it.rows) { g.fillStyle = t.text; g.fillText(k, pad, y + 16); g.fillStyle = t.text2; for (const l of wrap(g, d, rowW - 260)) { g.fillText(l, pad + 260, y + 16); y += 32; } y += 4; }
        y += 10; break;
      }
    }
  }
  // close button
  const ci = add({ x: W - 110, y: 20, w: 90, h: 90, on: () => P.onClose && P.onClose(), fixed: true });
  g.fillStyle = P.hover === ci ? t.focus : 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(W - 65, 65, 36, 0, 7); g.fill();
  g.strokeStyle = P.hover === ci ? t.focusText : '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(W - 80, 50); g.lineTo(W - 50, 80); g.moveTo(W - 50, 50); g.lineTo(W - 80, 80); g.stroke();
  P.maxScroll = Math.max(0, y + P.scroll + 40 - H);
  if (P.maxScroll > 0) {
    const bh = H * H / (H + P.maxScroll), by = (P.scroll / P.maxScroll) * (H - bh);
    g.fillStyle = 'rgba(255,255,255,.25)'; rr(g, W - 14, by, 8, bh, 4); g.fill();
  }
  P.tex.needsUpdate = true;
}
// uv (0..1) on the panel -> index of what is there
export function hitTest(P, uv) {
  const x = uv.x * W, y = (1 - uv.y) * H;
  for (let i = P.regions.length - 1; i >= 0; i--) {
    const r = P.regions[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { i, r, fx: (x - r.x) / r.w };
  }
  return null;
}
