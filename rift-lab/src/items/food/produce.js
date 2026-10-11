// Produce aisle: fresh fruit + vegetables, loose and bagged (see FOOD_CONTRACT.md).
// Every surface is painted in code: banana ridges + sugar spots, orange pores, strawberry seeds in
// their dimples, grape bloom, russet netting + eyes, romaine ribs, watermelon stripes + field spot.
// Every bag/clamshell gets a printed label with a see-through window, a Nutrition Facts panel and a UPC.
//
// Note on bites: the engine re-meshes a bitten lathe with v = height, so every lathe that gets
// bitten uses uv: 'wrap' (v = height) from the start, and cut faces are very slightly domed so
// their rings (rind, flesh) still land on the right texture rows.

import * as THREE from 'three';
import { box, cyl, sph, lathe, curve } from '../parts.js';
import { registerMaterial, registerPhysical, registerLabel, canvasTex, heightToNormal, cached } from '../materials.js';
import { mulberry32, tileFbm } from '../../core/noise.js';

const DEG = Math.PI / 180;
const SANS = 'Inter, "Liberation Sans", Arial, sans-serif';
const SERIF = 'Georgia, "Bitstream Charter", "Liberation Serif", serif';

// =====================================================================================
// small helpers
// =====================================================================================
const C = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const scl = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
function mkRamp(stops) {
  const s = stops.map(([t, h]) => [t, C(h)]);
  return (t) => {
    if (t <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) if (t <= s[i][0]) return mixc(s[i - 1][1], s[i][1], (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
    return s[s.length - 1][1];
  };
}
// per-pixel painter (fn returns [r,g,b] or [r,g,b,a])
function paint(ctx, W, H, fn) {
  const img = ctx.createImageData(W, H), d = img.data;
  let o = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++, o += 4) {
    const c = fn(x, y);
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c.length > 3 ? c[3] : 255;
  }
  ctx.putImageData(img, 0, 0);
}
// fractal noise that tiles across x (u wraps around fruit); cells = noise cells across the width
function field(W, H, cells, oct, seed, sy = 1) {
  const f = new Float32Array(W * H), k = cells / W;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) f[y * W + x] = tileFbm(x * k, y * k * sy, cells, oct, seed);
  return f;
}
// soft bump into a height field (wraps across x)
function stamp(hgt, W, H, cx, cy, r, amt) {
  const R = Math.ceil(r), r2 = r * r;
  for (let dy = -R; dy <= R; dy++) {
    const y = Math.round(cy) + dy;
    if (y < 0 || y >= H) continue;
    for (let dx = -R; dx <= R; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const x = (((Math.round(cx) + dx) % W) + W) % W;
      hgt[y * W + x] += amt * (1 - d2 / r2);
    }
  }
}
// draw at x and its wrapped copies (u wraps around)
function wrapX(W, x, r, fn) { fn(x); if (x - r < 0) fn(x + W); if (x + r > W) fn(x - W); }
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); ctx.fill(); }

// transform a list of parts (rotate about the origin, then move): used to place fruit in bags
function xf(parts, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG));
  const P = new THREE.Vector3(...pos);
  return parts.map((pt) => {
    const p = new THREE.Vector3(...(pt.p || [0, 0, 0])).applyQuaternion(q).add(P);
    const pq = pt.rot ? new THREE.Quaternion().setFromEuler(new THREE.Euler(pt.rot[0] * DEG, pt.rot[1] * DEG, pt.rot[2] * DEG)) : new THREE.Quaternion();
    const e = new THREE.Euler().setFromQuaternion(q.clone().multiply(pq));
    return { ...pt, p: p.toArray(), rot: [e.x / DEG, e.y / DEG, e.z / DEG] };
  });
}
const qToRot = (q) => { const e = new THREE.Euler().setFromQuaternion(q); return [e.x / DEG, e.y / DEG, e.z / DEG]; };
const unitOf = (parts, i) => parts.map((p) => ({ ...p, unit: i }));

// =====================================================================================
// printing helpers (labels)
// =====================================================================================
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function txt(ctx, s, x, y, o = {}) {
  const { size = 20, weight = 700, fam = SANS, color = '#111', align = 'center', maxW = 0, stroke = null, lw = 0, italic = false, base = 'alphabetic', track = 0 } = o;
  let px = size;
  ctx.letterSpacing = track ? `${track}px` : '0px';
  const set = () => { ctx.font = `${italic ? 'italic ' : ''}${weight} ${px.toFixed(1)}px ${fam}`; };
  set();
  if (maxW) while (ctx.measureText(s).width > maxW && px > 5) { px *= 0.95; set(); }
  ctx.textAlign = align; ctx.textBaseline = base;
  if (stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width;
  ctx.letterSpacing = '0px';
  return w;
}
function lines(ctx, arr, x, y, lh, o) { arr.forEach((s, i) => txt(ctx, s, x, y + i * lh, o)); }
// cut a hole out of the printing (see-through window, vent holes, handle slots)
function cut(ctx, pathFn) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; pathFn(); ctx.fill(); ctx.restore(); }

// FDA-style Nutrition Facts panel. Returns its height.
function nutritionPanel(ctx, x, y, w, n) {
  const u = w / 22, L = x + u * 0.6, R = x + w - u * 0.6;
  const dv = (v, d) => `${Math.round((v / d) * 100)}%`;
  const run = (draw) => {
    let cy = y + u * 0.3;
    const t = (s, px, wt, tx, ty, align = 'left') => {
      if (!draw) return 0;
      ctx.letterSpacing = '0px'; ctx.font = `${wt} ${px.toFixed(1)}px ${SANS}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#111';
      ctx.fillText(s, tx, ty); return ctx.measureText(s).width;
    };
    const rule = (hh) => { if (draw) { ctx.fillStyle = '#111'; ctx.fillRect(L, cy, R - L, hh); } cy += hh; };
    cy += u * 2.35; t('Nutrition Facts', u * 2.62, 900, L - u * 0.05, cy);
    cy += u * 0.4; rule(u * 0.07);
    cy += u * 1.3; t(`${n.servings} servings per container`, u * 1.08, 400, L, cy);
    cy += u * 1.45; t('Serving size', u * 1.28, 800, L, cy); t(n.size, u * 1.28, 800, R, cy, 'right');
    cy += u * 0.35; rule(u * 0.85);
    cy += u * 1.05; t('Amount per serving', u * 0.88, 800, L, cy);
    cy += u * 2.25; t('Calories', u * 2.15, 900, L, cy); t(String(n.kcal), u * 2.65, 900, R, cy, 'right');
    cy += u * 0.3; rule(u * 0.45);
    cy += u * 1.05; t('% Daily Value*', u * 0.88, 700, R, cy, 'right');
    const item = (label, val, pct, indent = 0, bold = true) => {
      cy += u * 0.25; rule(u * 0.05);
      cy += u * 1.15;
      const lw = t(label, u * 1.0, bold ? 800 : 400, L + indent * u, cy);
      if (val) t(' ' + val, u * 1.0, 400, L + indent * u + lw, cy);
      if (pct != null) t(pct, u * 1.0, 800, R, cy, 'right');
    };
    item('Total Fat', n.fat + 'g', dv(n.fat, 78));
    item('Saturated Fat', '0g', '0%', 1, false);
    item('Trans Fat', '0g', null, 1, false);
    item('Cholesterol', '0mg', '0%');
    item('Sodium', n.sodium + 'mg', dv(n.sodium, 2300));
    item('Total Carbohydrate', n.carb + 'g', dv(n.carb, 275));
    item('Dietary Fiber', n.fiber + 'g', dv(n.fiber, 28), 1, false);
    item('Total Sugars', n.sugar + 'g', null, 1, false);
    item('Includes 0g Added Sugars', '', '0%', 2, false);
    item('Protein', n.protein + 'g', null);
    cy += u * 0.3; rule(u * 0.85);
    const vit = (label, val, pct) => { cy += u * 1.3; t(`${label} ${val}`, u * 0.98, 400, L, cy); t(pct, u * 0.98, 400, R, cy, 'right'); cy += u * 0.12; rule(u * 0.04); };
    vit('Vitamin D', '0mcg', '0%');
    vit('Calcium', n.ca + 'mg', dv(n.ca, 1300));
    vit('Iron', n.fe + 'mg', dv(n.fe, 18));
    vit('Potassium', n.k + 'mg', dv(n.k, 4700));
    for (const [a, b, c] of n.extra || []) vit(a, b, c);
    cy += u * 0.25; rule(u * 0.4);
    ['* The % Daily Value (DV) tells you how much a nutrient in a', 'serving of food contributes to a daily diet. 2,000 calories', 'a day is used for general nutrition advice.'].forEach((s) => { cy += u * 0.92; t(s, u * 0.7, 400, L, cy); });
    cy += u * 0.55;
    return cy;
  };
  const end = run(false);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, end - y);
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1, u * 0.14); ctx.strokeRect(x, y, w, end - y);
  run(true);
  return end - y;
}

// a real UPC-A (check digit + L/R encodings + guard bars)
const UPC_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
function upc(ctx, x, y, w, h, d11) {
  let s = 0;
  for (let i = 0; i < 11; i++) s += +d11[i] * (i % 2 ? 1 : 3);
  const d = d11 + ((10 - (s % 10)) % 10);
  let bits = '101';
  for (let i = 0; i < 6; i++) bits += UPC_L[+d[i]];
  bits += '01010';
  for (let i = 6; i < 12; i++) bits += UPC_L[+d[i]].replace(/[01]/g, (c) => (c === '0' ? '1' : '0'));
  bits += '101';
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
  const m = (w * 0.84) / 95, x0 = x + w * 0.08, top = y + h * 0.07, bh = h * 0.68;
  ctx.fillStyle = '#111';
  for (let i = 0; i < 95; i++) if (bits[i] === '1') { const g = i < 3 || (i >= 45 && i < 50) || i >= 92; ctx.fillRect(x0 + i * m, top, m * 1.03, g ? bh + h * 0.1 : bh); }
  ctx.letterSpacing = '0px';
  ctx.font = `500 ${(h * 0.17).toFixed(1)}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const ty = y + h * 0.95;
  ctx.fillText(d[0], x + w * 0.04, ty); ctx.fillText(d.slice(1, 6), x0 + m * 24, ty);
  ctx.fillText(d.slice(6, 11), x0 + m * 71, ty); ctx.fillText(d[11], x + w * 0.96, ty);
}
// "please recycle" chasing-arrows triangle with the resin code
function recycle(ctx, x, y, s, num, code, color = '#222') {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.09; ctx.lineJoin = 'round';
  const pts = [[x, y - s * 0.5], [x + s * 0.5, y + s * 0.38], [x - s * 0.5, y + s * 0.38]];
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 3];
    const sx = ax + (bx - ax) * 0.16, sy = ay + (by - ay) * 0.16, ex = ax + (bx - ax) * 0.78, ey = ay + (by - ay) * 0.78;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    const a = Math.atan2(by - ay, bx - ax);
    ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * s * 0.12, ey + Math.sin(a) * s * 0.12);
    ctx.lineTo(ex + Math.cos(a + 2.3) * s * 0.13, ey + Math.sin(a + 2.3) * s * 0.13); ctx.lineTo(ex + Math.cos(a - 2.3) * s * 0.13, ey + Math.sin(a - 2.3) * s * 0.13); ctx.closePath(); ctx.fill();
  }
  txt(ctx, String(num), x, y + s * 0.26, { size: s * 0.42, weight: 800, color });
  txt(ctx, code, x, y + s * 0.85, { size: s * 0.3, weight: 800, color });
  ctx.restore();
}
function starburst(ctx, cx, cy, r, n, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, rr2 = i % 2 ? r * 0.84 : r; ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = r * 0.05; ctx.stroke(); }
}
// vent holes punched through the film (rows of small holes)
function vents(ctx, x0, y0, x1, y1, step, r) {
  for (let y = y0, row = 0; y <= y1; y += step, row++) for (let x = x0 + (row % 2) * step * 0.5; x <= x1; x += step) cut(ctx, () => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); });
}

// ---------- produce art (drawn with gradients, used on the packaging) ----------
function applePath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.68);
  ctx.bezierCurveTo(cx + r * 0.45, cy - r * 1.02, cx + r * 1.12, cy - r * 0.78, cx + r * 1.02, cy - r * 0.02);
  ctx.bezierCurveTo(cx + r * 0.96, cy + r * 0.62, cx + r * 0.52, cy + r * 1.0, cx + r * 0.22, cy + r * 0.92);
  ctx.bezierCurveTo(cx + r * 0.1, cy + r * 0.88, cx - r * 0.1, cy + r * 0.88, cx - r * 0.22, cy + r * 0.92);
  ctx.bezierCurveTo(cx - r * 0.52, cy + r * 1.0, cx - r * 0.96, cy + r * 0.62, cx - r * 1.02, cy - r * 0.02);
  ctx.bezierCurveTo(cx - r * 1.12, cy - r * 0.78, cx - r * 0.45, cy - r * 1.02, cx, cy - r * 0.68);
  ctx.closePath();
}
function drawLeaf(ctx, x, y, len, ang, c1 = '#6fae3a', c2 = '#2f6a1f') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, -len * 0.25, 0, len * 0.25); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.45, -len * 0.4, len, 0); ctx.quadraticCurveTo(len * 0.45, len * 0.4, 0, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(225,240,190,0.75)'; ctx.lineWidth = Math.max(1, len * 0.03);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.92, 0); ctx.stroke();
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    ctx.beginPath(); ctx.moveTo(len * t * 0.88, 0); ctx.lineTo(len * (t * 0.88 + 0.12), -len * 0.15 * (1 - t * 0.6));
    ctx.moveTo(len * t * 0.88, 0); ctx.lineTo(len * (t * 0.88 + 0.12), len * 0.15 * (1 - t * 0.6)); ctx.stroke();
  }
  ctx.restore();
}
function drawApple(ctx, cx, cy, r) {
  ctx.save();
  applePath(ctx, cx, cy, r);
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.28, r * 0.05, cx, cy, r * 1.15);
  g.addColorStop(0, '#ff9b70'); g.addColorStop(0.32, '#d8302d'); g.addColorStop(1, '#801018');
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  const b = ctx.createRadialGradient(cx + r * 0.55, cy + r * 0.65, 0, cx + r * 0.55, cy + r * 0.65, r * 0.85);
  b.addColorStop(0, 'rgba(244,190,70,0.85)'); b.addColorStop(1, 'rgba(244,190,70,0)');
  ctx.fillStyle = b; ctx.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
  ctx.strokeStyle = 'rgba(120,10,20,0.33)'; ctx.lineWidth = Math.max(1, r * 0.035);
  for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.15, cy - r * 0.72); ctx.quadraticCurveTo(cx + i * r * 0.2, cy, cx + i * r * 0.14, cy + r * 0.95); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,240,200,0.5)';
  for (let i = 0; i < 40; i++) { const a = i * 2.4, d = (i % 7) / 7; ell(ctx, cx + Math.cos(a) * r * d * 0.9, cy + Math.sin(a) * r * d * 0.8, r * 0.018, r * 0.018); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(ctx, cx - r * 0.45, cy - r * 0.3, r * 0.13, r * 0.27, -0.5);
  ctx.restore();
  ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = r * 0.075; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.62); ctx.quadraticCurveTo(cx + r * 0.04, cy - r * 0.9, cx + r * 0.15, cy - r * 1.08); ctx.stroke();
  drawLeaf(ctx, cx + r * 0.12, cy - r * 0.92, r * 0.62, -0.45);
}
function drawStrawberry(ctx, cx, cy, s, rot = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s * 0.55, s * 0.72, -s * 0.86, -s * 0.08, -s * 0.64, -s * 0.48);
  ctx.bezierCurveTo(-s * 0.42, -s * 0.8, s * 0.42, -s * 0.8, s * 0.64, -s * 0.48);
  ctx.bezierCurveTo(s * 0.86, -s * 0.08, s * 0.55, s * 0.72, 0, s);
  const g = ctx.createRadialGradient(-s * 0.25, -s * 0.2, s * 0.05, 0, 0, s * 1.1);
  g.addColorStop(0, '#ff6d5c'); g.addColorStop(0.45, '#de1d29'); g.addColorStop(1, '#8a0a15');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  for (let r = 0; r < 8; r++) for (let c = -4; c <= 4; c++) {
    const x = c * s * 0.19 + (r % 2) * s * 0.095, y = -s * 0.42 + r * s * 0.18;
    ctx.fillStyle = 'rgba(100,0,10,0.45)'; ell(ctx, x, y + s * 0.01, s * 0.045, s * 0.055);
    ctx.fillStyle = '#f4d85e'; ell(ctx, x, y, s * 0.024, s * 0.04, 0.2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -s * 0.3, -s * 0.18, s * 0.09, s * 0.22, 0.4);
  ctx.restore();
  for (const a of [165, 195, 228, 270, 312, 345, 15]) {
    ctx.save(); ctx.translate(0, -s * 0.58); ctx.rotate(a * DEG);
    const lg = ctx.createLinearGradient(0, 0, s * 0.36, 0); lg.addColorStop(0, '#2f7a24'); lg.addColorStop(1, '#5aa83a');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.18, -s * 0.09, s * 0.36, 0); ctx.quadraticCurveTo(s * 0.18, s * 0.09, 0, 0); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#3b6b22'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -s * 0.6); ctx.quadraticCurveTo(s * 0.04, -s * 0.78, -s * 0.03, -s * 0.9); ctx.stroke();
  ctx.restore();
}
function drawGrapes(ctx, cx, cy, s) {
  ctx.save();
  ctx.strokeStyle = '#6b5a2a'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.95); ctx.quadraticCurveTo(cx + s * 0.05, cy - s * 0.7, cx, cy - s * 0.5); ctx.stroke();
  drawLeaf(ctx, cx + s * 0.04, cy - s * 0.86, s * 0.7, -0.35, '#7fb04a', '#3c6e24');
  const rows = [5, 6, 5, 5, 4, 3, 2, 1], r = s * 0.15;
  rows.forEach((n, ri) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * r * 1.75 + (ri % 2 ? r * 0.2 : -r * 0.1), y = cy - s * 0.5 + ri * r * 1.55;
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
      g.addColorStop(0, '#d9708a'); g.addColorStop(0.45, '#8c2443'); g.addColorStop(1, '#3a0a1e');
      ctx.fillStyle = g; ell(ctx, x, y, r, r * 1.08);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, x - r * 0.38, y - r * 0.42, r * 0.18, r * 0.26, -0.5);
    }
  });
  ctx.restore();
}
function drawCarrot(ctx, x, y, len, ang) {
  const w = len * 0.17;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.strokeStyle = '#3f8f2a'; ctx.lineWidth = w * 0.18; ctx.lineCap = 'round';
  for (const a of [-0.5, -0.2, 0.15, 0.45]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-len * 0.12, a * len * 0.2, -len * 0.3, a * len * 0.45); ctx.stroke(); }
  ctx.fillStyle = '#4ea232';
  for (const a of [-0.5, -0.2, 0.15, 0.45]) ell(ctx, -len * 0.3, a * len * 0.45, len * 0.05, len * 0.025, a);
  ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.quadraticCurveTo(len * 0.6, -w * 0.42, len, 0); ctx.quadraticCurveTo(len * 0.6, w * 0.42, 0, w / 2); ctx.closePath();
  const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2); g.addColorStop(0, '#ffa53a'); g.addColorStop(0.45, '#f07a12'); g.addColorStop(1, '#b84e08');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(140,60,0,0.45)'; ctx.lineWidth = Math.max(1, w * 0.06);
  for (let i = 1; i < 9; i++) { const t = i / 9, hw = (w / 2) * (1 - t * 0.85); ctx.beginPath(); ctx.moveTo(len * t, -hw * 0.6); ctx.lineTo(len * t + w * 0.05, hw * 0.1); ctx.stroke(); }
  ctx.restore();
}
function drawPotato(ctx, cx, cy, s, rot = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, k = 1 + 0.05 * Math.sin(a * 3) + 0.03 * Math.cos(a * 5); ctx.lineTo(Math.cos(a) * s * k, Math.sin(a) * s * 0.62 * k); }
  const g = ctx.createRadialGradient(-s * 0.3, -s * 0.2, s * 0.1, 0, 0, s * 1.1);
  g.addColorStop(0, '#d9b083'); g.addColorStop(0.5, '#a87a4c'); g.addColorStop(1, '#5e3f22');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(70,40,20,0.6)';
  for (const [a, b] of [[-0.5, -0.1], [0.3, 0.2], [0.6, -0.25], [-0.15, 0.32], [0.05, -0.3]]) ell(ctx, a * s, b * s, s * 0.05, s * 0.025, a);
  ctx.fillStyle = 'rgba(255,240,210,0.25)'; ell(ctx, -s * 0.35, -s * 0.2, s * 0.25, s * 0.1, -0.2);
  ctx.restore();
}
function drawLettuce(ctx, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy);
  const leaf = (dx, ang, len, wid, c1, c2) => {
    ctx.save(); ctx.translate(dx, 0); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-wid * 0.25, 0);
    for (let i = 0; i <= 12; i++) { const t = i / 12; ctx.lineTo(-wid * (0.25 + 0.3 * Math.sin(t * Math.PI)) - Math.sin(t * 40) * wid * 0.04 * t, -len * t); }
    for (let i = 12; i >= 0; i--) { const t = i / 12; ctx.lineTo(wid * (0.25 + 0.3 * Math.sin(t * Math.PI)) + Math.sin(t * 40) * wid * 0.04 * t, -len * t); }
    const g = ctx.createLinearGradient(0, 0, 0, -len); g.addColorStop(0, '#eef3d2'); g.addColorStop(0.4, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(240,248,220,0.9)'; ctx.lineWidth = wid * 0.08; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * 0.85); ctx.stroke();
    ctx.restore();
  };
  leaf(-s * 0.28, -0.32, s * 1.6, s * 0.6, '#8cc35a', '#3f7f28');
  leaf(s * 0.28, 0.32, s * 1.6, s * 0.6, '#8cc35a', '#3f7f28');
  leaf(-s * 0.1, -0.1, s * 1.75, s * 0.62, '#9fd068', '#4a8c2e');
  leaf(s * 0.12, 0.12, s * 1.7, s * 0.6, '#a6d46e', '#4f9432');
  ctx.restore();
}

// =====================================================================================
// food surfaces
// =====================================================================================
const phys = (k, density, friction = 0.6, sound = 'soft') => registerPhysical(k, { density, friction, sound });

// ---------- bag film (clear poly with crinkles) + kraft paper ----------
registerMaterial('produce-film', () => {
  const nm = cached('produce-film-n', () => {
    const W = 256, rand = mulberry32(5), hgt = new Float32Array(W * W);
    const n = field(W, W, 6, 3, 15);
    for (let i = 0; i < W * W; i++) hgt[i] = n[i] * 0.7;
    for (let k = 0; k < 46; k++) {
      const x = rand() * W, y = rand() * W, a = rand() * Math.PI, len = 20 + rand() * 90;
      for (let s = 0; s < len; s++) { const xi = (((Math.round(x + Math.cos(a) * s)) % W) + W) % W, yi = (((Math.round(y + Math.sin(a) * s)) % W) + W) % W; hgt[yi * W + xi] += 0.9; }
    }
    return heightToNormal(hgt, W, W, 1.4);
  });
  const m = new THREE.MeshPhysicalMaterial({ color: 0xf4f7f6, roughness: 0.14, metalness: 0, transparent: true, opacity: 0.2, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide, normalMap: nm, normalScale: new THREE.Vector2(0.4, 0.4) });
  m.userData.glass = true; m.userData.tile = 0.16;
  return m;
});
phys('produce-film', 50, 0.55);

function kraftTex() {
  return cached('produce-kraft', () => {
    const W = 512, rand = mulberry32(61);
    const n = field(W, W, 8, 4, 33);
    return canvasTex((ctx) => {
      paint(ctx, W, W, (x, y) => { const k = n[y * W + x]; return scl(C('#b88d5c'), 0.93 + k * 0.12); });
      for (let i = 0; i < 2600; i++) { const v = rand(); ctx.fillStyle = v < 0.5 ? `rgba(90,60,30,${0.05 + rand() * 0.12})` : `rgba(235,205,160,${0.05 + rand() * 0.12})`; ctx.fillRect(rand() * W, rand() * W, 1 + rand() * 10, 1); }
    }, { w: W, h: W });
  });
}
registerMaterial('produce-kraft', () => { const m = new THREE.MeshStandardMaterial({ map: kraftTex(), roughness: 0.92 }); m.userData.tile = 0.35; return m; });
registerMaterial('produce-kraftin', () => { const m = new THREE.MeshStandardMaterial({ map: kraftTex(), roughness: 0.95, color: 0xb8aa98, side: THREE.BackSide }); m.userData.tile = 0.35; return m; });
phys('produce-kraft', 300, 0.7, 'cardboard');
phys('produce-kraftin', 300, 0.7, 'cardboard');

// ---------- Gala apple (the ones in the bag) ----------
registerMaterial('produce-bagapple', () => {
  const t = cached('produce-bagapple', () => {
    const W = 512, H = 512, rand = mulberry32(95), hgt = new Float32Array(W * H);
    const n = field(W, H, 5, 3, 401);
    const base = mkRamp([[0, '#d8b247'], [0.18, '#e0a23a'], [0.42, '#d5652f'], [0.72, '#c33f2b'], [0.93, '#a93228'], [1, '#86682c']]);
    const deep = C('#9c1c26');
    const map = canvasTex((ctx) => {
      paint(ctx, W, H, (x, y) => {
        const v = 1 - y / H, u = x / W, k = n[y * W + x];
        const sun = sat(0.5 + 0.5 * Math.sin(u * Math.PI * 2 + 0.6) + k * 0.7);
        return mixc(base(v), deep, sun * 0.5 * sstep(0.12, 0.55, v));
      });
      for (let i = 0; i < 330; i++) {
        const x = rand() * W, w = 1 + rand() * 4.5, top = rand() * H * 0.18, len = H * (0.42 + rand() * 0.5);
        const a = 0.14 + rand() * 0.3 * (0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2 + 0.6));
        const sg = ctx.createLinearGradient(0, top, 0, top + len);
        sg.addColorStop(0, `rgba(140,22,24,${a})`); sg.addColorStop(1, 'rgba(140,22,24,0)');
        ctx.fillStyle = sg; wrapX(W, x, w, (xx) => ctx.fillRect(xx, top, w, len));
      }
      for (let i = 0; i < 1500; i++) {
        const x = rand() * W, y = rand() * H, r = 0.6 + rand() * 1.1;
        ctx.fillStyle = `rgba(246,226,168,${0.3 + rand() * 0.4})`; ell(ctx, x, y, r, r);
        stamp(hgt, W, H, x, y, 1.5, 1);
      }
      const rg = ctx.createLinearGradient(0, 0, 0, H * 0.07); rg.addColorStop(0, 'rgba(110,84,40,0.9)'); rg.addColorStop(1, 'rgba(110,84,40,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H * 0.07);
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 0.6) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.35 });
});
phys('produce-bagapple', 820);

// woody stems (apple, pear) + green-brown stalks (grapes, melon) + banana stem/crown
registerMaterial('produce-stem', (kind) => {
  const key = 'produce-stem-' + (kind || 'wood');
  const map = cached(key, () => canvasTex((ctx, w, h) => {
    const rand = mulberry32(kind === 'green' ? 4 : kind === 'banana' ? 9 : 3);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    const [a, b] = kind === 'green' ? ['#7a7a3a', '#55602a'] : kind === 'banana' ? ['#7b7a34', '#4f4c22'] : kind === 'tip' ? ['#2e2418', '#1c150e'] : ['#6a4a2a', '#41301c'];
    g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, a);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${rand() < 0.5 ? '30,22,10' : '190,170,110'},${0.1 + rand() * 0.2})`; ctx.fillRect(rand() * w, rand() * h, 1, 4 + rand() * 30); }
    if (kind === 'banana') { ctx.fillStyle = 'rgba(40,30,15,0.7)'; ctx.fillRect(0, 0, w, h * 0.12); }
  }, { w: 64, h: 128 }));
  return new THREE.MeshStandardMaterial({ map, roughness: kind === 'tip' ? 0.9 : 0.75 });
});
phys('produce-stem', 700, 0.7);

// ---------- banana: near-white detail map, the color comes from ripeness (green -> yellow -> spotty -> brown) ----------
const BANANA_RIPEN = ['#d3d24c', '#f1d24b', '#d9ae36', '#6e4b23'];
registerMaterial('produce-bananaskin', () => {
  const t = cached('produce-bananaskin', () => {
    const W = 256, H = 512, rand = mulberry32(11), hgt = new Float32Array(W * H);
    const n = field(W, H, 6, 3, 21);
    const map = canvasTex((ctx) => {
      // u (x) = around the banana, v (canvas up) = blossom tip (bottom) -> stem end (top)
      paint(ctx, W, H, (x, y) => {
        const u = x / W, v = 1 - y / H, k = n[y * W + x];
        const ru = (u * 5) % 1, dr = Math.min(ru, 1 - ru);                 // 5 ridges around
        const fib = tileFbm(x * 40 / W, y * 0.6 / W, 40, 2, 7);           // fibers along the length
        hgt[y * W + x] = Math.sin(Math.PI * ru) * 1.0 + fib * 0.15;
        let c = scl([248, 246, 238], 0.96 + k * 0.05 + fib * 0.03);
        c = mixc(c, [196, 186, 150], Math.exp(-((dr * 30) ** 2)) * 0.55);  // the ridge line itself
        c = mixc(c, [205, 235, 150], sstep(0.82, 0.97, v) * 0.55);         // the neck stays greener
        c = mixc(c, [70, 52, 30], sstep(0.065, 0.015, v));                 // dark blossom tip
        c = mixc(c, [110, 96, 52], sstep(0.975, 1, v) * 0.8);              // stem end
        return c;
      });
      // a few sugar spots + faint bruise streaks
      for (let i = 0; i < 70; i++) { const x = rand() * W, y = H * (0.1 + rand() * 0.8), r = 0.6 + rand() * 1.8; ctx.fillStyle = `rgba(110,72,34,${0.25 + rand() * 0.45})`; wrapX(W, x, r, (xx) => ell(ctx, xx, y, r, r * 1.3)); }
      for (let i = 0; i < 5; i++) { const x = rand() * W, y = H * (0.2 + rand() * 0.5); ctx.fillStyle = 'rgba(130,100,60,0.12)'; ctx.fillRect(x, y, 2 + rand() * 4, 30 + rand() * 80); }
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 1.2) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), color: new THREE.Color(BANANA_RIPEN[0]), roughness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.6 });
});
phys('produce-bananaskin', 960);
registerMaterial('produce-bananaflesh', () => {
  const map = cached('produce-bananaflesh', () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(12);
    paint(ctx, W, H, (x, y) => {
      const u = x / W, v = 1 - y / H, f = tileFbm(x * 30 / W, y * 0.5 / W, 30, 2, 3);
      let c = scl([246, 236, 204], 0.97 + f * 0.04);
      const r3 = (u * 3) % 1; c = mixc(c, [226, 206, 160], Math.exp(-((Math.min(r3, 1 - r3) * 40) ** 2)) * 0.5); // the 3 seams
      c = mixc(c, [205, 180, 120], sstep(0.06, 0.0, v) * 0.6);
      return c;
    });
    for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(255,252,236,${rand() * 0.35})`; ctx.fillRect(rand() * W, rand() * H, 1, 8 + rand() * 30); }
  }, { w: 128, h: 256 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xfff6dc), sheenRoughness: 0.5 });
});
phys('produce-bananaflesh', 950);

// ---------- navel orange ----------
function drawPeel(ctx, W, y0, y1, rand, hgt, H) {
  // pores (oil glands) over an orange gradient: rows y0..y1 of the canvas
  const n = field(W, Math.max(1, y1 - y0), 8, 3, 55);
  const img = ctx.getImageData(0, y0, W, y1 - y0), d = img.data;
  for (let i = 0; i < W * (y1 - y0); i++) { const k = n[i], c = mixc(C('#f2891c'), C('#e06a10'), sat(0.5 + k * 0.9)); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, y0);
  const count = Math.round((W * (y1 - y0)) / 55);
  for (let i = 0; i < count; i++) {
    const x = rand() * W, y = y0 + rand() * (y1 - y0), r = 0.8 + rand() * 1.3;
    ctx.fillStyle = `rgba(170,70,8,${0.25 + rand() * 0.35})`; ell(ctx, x, y, r, r);
    ctx.fillStyle = `rgba(255,190,90,${0.25 * rand()})`; ell(ctx, x - r * 0.4, y - r * 0.4, r * 0.4, r * 0.4);
    if (hgt) stamp(hgt, W, H, x, y, r * 1.4, -1);
  }
}
registerMaterial('produce-orangepeel', (kind) => {
  const t = cached('produce-orangepeel-' + (kind || 'skin'), () => {
    const W = 512, H = 512, rand = mulberry32(kind === 'navel' ? 41 : 40), hgt = new Float32Array(W * H);
    const map = canvasTex((ctx) => {
      drawPeel(ctx, W, 0, H, rand, hgt, H);
      if (kind === 'navel') { ctx.fillStyle = 'rgba(160,80,20,0.35)'; ctx.fillRect(0, 0, W, H); return; }
      // stem scar at the bottom (v=0), the navel at the top (v=1): folds + a darker ring
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.07); g.addColorStop(0, 'rgba(150,72,15,0.75)'); g.addColorStop(1, 'rgba(150,72,15,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.07);
      for (let i = 0; i < 24; i++) { const x = (i / 24) * W; ctx.fillStyle = 'rgba(120,55,10,0.35)'; ctx.fillRect(x, 0, 3, H * 0.045); stamp(hgt, W, H, x, H * 0.02, 5, -1.5); }
      const s = ctx.createLinearGradient(0, H, 0, H * 0.94); s.addColorStop(0, 'rgba(110,120,40,0.8)'); s.addColorStop(1, 'rgba(110,120,40,0)');
      ctx.fillStyle = s; ctx.fillRect(0, H * 0.94, W, H * 0.06);
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 0.9) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.65, 0.65), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
});
phys('produce-orangepeel', 850);
// segments: juice vesicles under a thin shiny membrane
registerMaterial('produce-orangeflesh', (kind) => {
  const map = cached('produce-orangeflesh-' + (kind || 'seg'), () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(44);
    if (kind === 'pith') {
      paint(ctx, W, H, (x, y) => scl([246, 214, 160], 0.95 + tileFbm(x * 8 / W, y * 8 / W, 8, 3, 9) * 0.06));
      for (let i = 0; i < 200; i++) { ctx.fillStyle = `rgba(255,250,235,${rand() * 0.5})`; ctx.fillRect(rand() * W, rand() * H, 1, 5 + rand() * 20); }
      return;
    }
    ctx.fillStyle = '#f39a26'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      const x = rand() * W, y = rand() * H, a = (rand() - 0.5) * 0.5, l = 6 + rand() * 9, w = 2.2 + rand() * 2;
      const c = mixc(C('#f7a531'), C('#e57d12'), rand());
      ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; wrapX(W, x, l, (xx) => ell(ctx, xx, y, w, l, a));
      ctx.fillStyle = 'rgba(255,215,140,0.55)'; wrapX(W, x, l, (xx) => ell(ctx, xx - 0.6, y - l * 0.3, w * 0.35, l * 0.45, a));
    }
    for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(255,236,200,0.18)'; ctx.fillRect(0, (i / 4) * H, W, 2); }
  }, { w: 256, h: 256 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: kind === 'pith' ? 0.7 : 0.26, clearcoat: kind === 'pith' ? 0 : 0.7, clearcoatRoughness: 0.25, emissive: new THREE.Color(0x3a1500), emissiveIntensity: kind === 'pith' ? 0 : 0.35, sheen: 0.4, sheenColor: new THREE.Color(0xffd8a0) });
});
phys('produce-orangeflesh', 1000);
// peel pieces + the bottom "cup" of peel: lathe made of an outer profile (orange) then an inner one (white pith)
const CUP_SPLIT = [0.47, 0.53]; // v: outer peel below, rim between, pith above
registerMaterial('produce-orangecup', () => {
  const map = cached('produce-orangecup', () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(46);
    const yRim0 = Math.round(H * (1 - CUP_SPLIT[1])), yRim1 = Math.round(H * (1 - CUP_SPLIT[0]));
    drawPeel(ctx, W, yRim1, H, rand, null, H);
    paint2(ctx, W, 0, yRim0, (x, y) => scl([247, 238, 214], 0.94 + tileFbm(x * 10 / W, y * 10 / W, 10, 3, 4) * 0.07));
    for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(240,200,140,${rand() * 0.35})`; ctx.fillRect(rand() * W, rand() * yRim0, 1.2, 4 + rand() * 18); }
    const g = ctx.createLinearGradient(0, yRim0, 0, yRim1); g.addColorStop(0, '#f6efd9'); g.addColorStop(0.55, '#f4d9a6'); g.addColorStop(1, '#ec8a24');
    ctx.fillStyle = g; ctx.fillRect(0, yRim0, W, yRim1 - yRim0);
  }, { w: 256, h: 256 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.5, clearcoat: 0.2 });
});
phys('produce-orangecup', 800);
function paint2(ctx, W, y0, y1, fn) {
  const img = ctx.getImageData(0, y0, W, y1 - y0), d = img.data;
  let o = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++, o += 4) { const c = fn(x, y); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
  ctx.putImageData(img, 0, y0);
}

// ---------- Bartlett pear (ripens green -> yellow, so the map is a light detail layer) ----------
const PEAR_RIPEN = ['#b4c656', '#d4d45a', '#e9d35c', '#a8843a'];
registerMaterial('produce-pear', () => {
  const t = cached('produce-pear', () => {
    const W = 512, H = 512, rand = mulberry32(71), hgt = new Float32Array(W * H);
    const n = field(W, H, 6, 3, 72);
    const map = canvasTex((ctx) => {
      paint(ctx, W, H, (x, y) => {
        const u = x / W, v = 1 - y / H, k = n[y * W + x];
        let c = scl([250, 248, 236], 0.95 + k * 0.06);
        c = mixc(c, [255, 214, 196], sat(Math.sin(u * Math.PI * 2 - 0.4) * 0.6 + k * 0.4) * 0.32 * sstep(0.1, 0.45, v)); // faint sunny blush
        c = mixc(c, [196, 160, 110], sstep(0.84, 0.97, v) * 0.55 * sat(0.6 + k));                              // russet at the neck
        c = mixc(c, [170, 140, 100], sstep(0.05, 0.0, v) * 0.6);                                                // calyx end
        return c;
      });
      for (let i = 0; i < 1700; i++) {
        const x = rand() * W, y = rand() * H, r = 0.5 + rand() * 1.2;
        ctx.fillStyle = `rgba(${120 + rand() * 40},${100 + rand() * 30},60,${0.35 + rand() * 0.4})`; ell(ctx, x, y, r, r);
        stamp(hgt, W, H, x, y, 1.6, -0.8);
      }
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(150,120,80,0.18)'; ell(ctx, rand() * W, H * (0.2 + rand() * 0.6), 6 + rand() * 12, 4 + rand() * 8, rand()); }
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 0.5) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), color: new THREE.Color(PEAR_RIPEN[0]), roughness: 0.45, clearcoat: 0.22, clearcoatRoughness: 0.5 });
});
phys('produce-pear', 1000);
// cores: cream flesh browning at the edges, dark seeds in the middle (apple/pear style)
registerMaterial('produce-core', (kind) => {
  const map = cached('produce-core-' + (kind || 'pear'), () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(73);
    paint(ctx, W, H, (x, y) => scl(kind === 'potato' ? [240, 226, 182] : [242, 232, 204], 0.94 + tileFbm(x * 12 / W, y * 12 / W, 12, 3, 6) * 0.06));
    for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(${150 + rand() * 40},${115 + rand() * 30},60,${rand() * 0.22})`; ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 4, 1 + rand() * 4); }
    ctx.fillStyle = 'rgba(165,120,60,0.55)'; ctx.fillRect(0, 0, W, H * 0.1); ctx.fillRect(0, H * 0.9, W, H * 0.1);
    if (kind !== 'potato') for (let i = 0; i < 5; i++) { ctx.fillStyle = '#4a2c16'; ell(ctx, (i + 0.5) * W / 5, H * 0.52, 5, 10, 0.3); ctx.fillStyle = 'rgba(255,230,190,0.4)'; ell(ctx, (i + 0.5) * W / 5 - 1.5, H * 0.5, 1.5, 3, 0.3); }
  }, { w: 128, h: 128 }));
  return new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
});
phys('produce-core', 750);

// ---------- strawberries: seeds (achenes) sitting in little dimples ----------
registerMaterial('produce-strawberry', () => {
  const t = cached('produce-strawberry', () => {
    const W = 512, H = 512, rand = mulberry32(31), hgt = new Float32Array(W * H);
    const n = field(W, H, 7, 3, 77);
    const base = mkRamp([[0, '#9a0d16'], [0.25, '#bd141e'], [0.65, '#d0202a'], [0.85, '#d93530'], [0.93, '#e2664f'], [1, '#efb48c']]);
    const map = canvasTex((ctx) => {
      paint(ctx, W, H, (x, y) => mixc(base(1 - y / H), C('#6e0812'), sat(n[y * W + x] * 0.6 + 0.15) * 0.4));
      const rows = 18, cols = 15;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = ((c + (r % 2) * 0.5) / cols) * W + (rand() - 0.5) * 7, y = H * (0.05 + (r / rows) * 0.86) + (rand() - 0.5) * 7;
        wrapX(W, x, 9, (xx) => {
          ctx.fillStyle = 'rgba(90,3,12,0.5)'; ell(ctx, xx, y, 7.5, 6.5);
          ctx.fillStyle = 'rgba(255,120,110,0.25)'; ell(ctx, xx, y - 5, 6, 2);
          ctx.fillStyle = rand() < 0.75 ? '#e9cf62' : '#c49536'; ell(ctx, xx, y + 0.5, 2.6, 3.6, 0.25);
          ctx.fillStyle = 'rgba(255,248,210,0.7)'; ell(ctx, xx - 0.8, y - 0.8, 0.9, 1.2);
        });
        stamp(hgt, W, H, x, y, 8, -1.2); stamp(hgt, W, H, x, y + 0.5, 3, 1.2);
      }
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 1.1) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.18 });
});
phys('produce-strawberry', 900);
// the green calyx on top of a strawberry (a star cut out of a disc)
registerMaterial('produce-calyx', () => {
  const map = cached('produce-calyx', () => canvasTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2, L = W * (0.42 + (i % 3) * 0.03);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, '#2c6a1e'); g.addColorStop(0.7, '#4f9a32'); g.addColorStop(1, '#6aae3e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(L * 0.5, -W * 0.07, L, 0); ctx.quadraticCurveTo(L * 0.5, W * 0.07, 0, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(200,230,150,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.9, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#3f7a28'; ell(ctx, cx, cy, W * 0.08, W * 0.08);
  }, { w: 128, h: 128 }));
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
});
phys('produce-calyx', 500);

// ---------- red seedless grapes (three slightly different berries) ----------
registerMaterial('produce-grape', (v = 'a') => {
  const map = cached('produce-grape-' + v, () => canvasTex((ctx, W, H) => {
    const seed = { a: 1, b: 2, c: 3 }[v] || 1, rand = mulberry32(300 + seed);
    const n = field(W, H, 4, 3, 310 + seed);
    const [c0, c1] = { a: [C('#5c1630'), C('#7e2a40')], b: [C('#7a1e30'), C('#9b3a44')], c: [C('#8c3a40'), C('#a8604a')] }[v] || [C('#5c1630'), C('#7e2a40')];
    paint(ctx, W, H, (x, y) => { const k = n[y * W + x], vv = 1 - y / H; return mixc(mixc(c0, c1, sat(0.5 + k)), C('#4a6a2a'), sstep(0.93, 1, vv) * 0.35); });
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(${v === 'c' ? '170,120,60' : '150,60,70'},${0.12 + rand() * 0.18})`; ctx.fillRect(rand() * W, 0, 2 + rand() * 4, H); }
    for (let i = 0; i < 200; i++) { ctx.fillStyle = `rgba(230,200,210,${rand() * 0.35})`; ell(ctx, rand() * W, rand() * H, 0.7, 0.7); }
    for (let i = 0; i < 7; i++) { ctx.fillStyle = 'rgba(225,215,225,0.22)'; ell(ctx, rand() * W, rand() * H, 10 + rand() * 18, 6 + rand() * 12, rand()); } // bloom
  }, { w: 128, h: 64 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.7, sheenColor: new THREE.Color(0xc8b8c4), sheenRoughness: 0.7 });
});
phys('produce-grape', 1000);
// what you see deeper in the bag: more grapes (painted), so the bag looks full without 400 meshes
registerMaterial('produce-grapefill', () => {
  const map = cached('produce-grapefill', () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(320);
    ctx.fillStyle = '#1e0a12'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) {
      const x = rand() * W, y = rand() * H, r = 42 + rand() * 14;
      wrapX(W, x, r, (xx) => {
        const g = ctx.createRadialGradient(xx - r * 0.3, y - r * 0.35, r * 0.1, xx, y, r);
        const c = [['#b0506a', '#6e1a34', '#2a0812'], ['#c05a5c', '#842a3a', '#300c14'], ['#9a4a5c', '#5a1428', '#200610']][i % 3];
        g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
        ctx.fillStyle = g; ell(ctx, xx, y, r, r * 1.1);
      });
    }
  }, { w: 512, h: 512 }));
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.5 }); m.userData.tile = 0.11; return m;
});
phys('produce-grapefill', 700);

// ---------- Roma tomato ----------
const TOMATO_RIPEN = ['#ffffff', '#f4ece6', '#e6d6cc', '#b8a080'];
registerMaterial('produce-tomato', () => {
  const t = cached('produce-tomato', () => {
    const W = 512, H = 512, rand = mulberry32(81), hgt = new Float32Array(W * H);
    const n = field(W, H, 5, 3, 82);
    const map = canvasTex((ctx) => {
      // v: 0 = blossom end, 1 = stem end (shoulders a bit orange)
      paint(ctx, W, H, (x, y) => {
        const v = 1 - y / H, k = n[y * W + x];
        let c = mixc(C('#c9221a'), C('#a8160f'), sat(0.5 + k * 0.8));
        c = mixc(c, C('#d9541e'), sstep(0.8, 0.95, v) * 0.6);
        c = mixc(c, C('#8a7a2a'), sstep(0.975, 1, v) * 0.7);
        c = mixc(c, C('#e8b080'), sstep(0.025, 0.0, v) * 0.7);
        return c;
      });
      for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(255,190,150,${rand() * 0.25})`; ell(ctx, rand() * W, rand() * H, 0.8, 0.8); }
      for (let i = 0; i < 10; i++) { const x = (i / 10) * W; ctx.fillStyle = 'rgba(240,150,90,0.25)'; ctx.fillRect(x, 0, 3, H * 0.12); }
      for (let i = 0; i < W * H / 40; i++) stamp(hgt, W, H, rand() * W, rand() * H, 2, (rand() - 0.5) * 0.4);
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 0.6) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.2, 0.2), color: new THREE.Color(TOMATO_RIPEN[0]), roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.08 });
});
phys('produce-tomato', 990);
registerMaterial('produce-sepal', () => {
  const map = cached('produce-sepal', () => canvasTex((ctx, W, H) => {
    paint(ctx, W, H, (x, y) => mixc(C('#3f7426'), C('#5c9436'), sat(0.5 + tileFbm(x * 6 / W, y * 6 / W, 6, 2, 2))));
    const rand = mulberry32(5); for (let i = 0; i < 300; i++) { ctx.fillStyle = 'rgba(200,230,170,0.25)'; ctx.fillRect(rand() * W, rand() * H, 1, 3); }
  }, { w: 64, h: 64 }));
  return new THREE.MeshStandardMaterial({ map, roughness: 0.75 });
});
phys('produce-sepal', 600);

// ---------- English cucumber: dark green, faint stripes, tiny bumps ----------
registerMaterial('produce-cucumber', (kind) => {
  const t = cached('produce-cucumber-' + (kind || 'skin'), () => {
    const W = 256, H = 1024, rand = mulberry32(91), hgt = new Float32Array(W * H);
    const map = canvasTex((ctx) => {
      if (kind === 'end') {
        paint(ctx, W, H, (x, y) => { const v = 1 - y / H; return mixc(C('#2f5a26'), C('#cfe0a6'), sstep(0.3, 0.0, v)); });
        return;
      }
      const n = field(W, H, 4, 3, 92, 0.25);
      paint(ctx, W, H, (x, y) => {
        const u = x / W, v = 1 - y / H, k = n[y * W + x];
        const st = (u * 9) % 1, stripe = Math.exp(-(((Math.min(st, 1 - st)) * 7) ** 2));
        let c = mixc(C('#24491f'), C('#3d6a2c'), sat(stripe * 0.7 + k * 0.5));
        c = mixc(c, C('#7c8a3a'), sstep(0.02, 0.0, v) * 0.8);
        c = mixc(c, C('#4f7a34'), sstep(0.95, 1, v) * 0.7);
        return c;
      });
      for (let i = 0; i < 520; i++) {
        const x = rand() * W, y = rand() * H, r = 1.6 + rand() * 1.6;
        wrapX(W, x, r * 2, (xx) => { ctx.fillStyle = 'rgba(120,160,80,0.35)'; ell(ctx, xx, y, r * 1.4, r * 2); ctx.fillStyle = 'rgba(20,40,15,0.5)'; ell(ctx, xx, y + r * 0.3, r * 0.5, r * 0.6); });
        stamp(hgt, W, H, x, y, r * 2, 1);
      }
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 0.9) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: kind === 'end' ? null : t.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.3 });
});
phys('produce-cucumber', 960);

// ---------- Hass avocado: pebbly skin (detail map; ripeness gives the color) ----------
const AVO_RIPEN = ['#4b6a2a', '#3c4a22', '#2e2621', '#1c1512'];
function avoPebbles(W, H, seed) {
  return cached('produce-avo-peb-' + seed, () => {
    const hgt = new Float32Array(W * H), rand = mulberry32(seed);
    const n = field(W, H, 24, 2, seed);
    for (let i = 0; i < W * H; i++) hgt[i] = 1 - Math.abs(n[i]) * 2.2;
    for (let i = 0; i < 1400; i++) stamp(hgt, W, H, rand() * W, rand() * H, 2.5 + rand() * 3, 0.6);
    return hgt;
  });
}
registerMaterial('produce-avoskin', () => {
  const t = cached('produce-avoskin', () => {
    const W = 512, H = 512, rand = mulberry32(51), hgt = avoPebbles(W, H, 51);
    const map = canvasTex((ctx) => {
      paint(ctx, W, H, (x, y) => { const h = hgt[y * W + x]; return scl([236, 240, 222], 0.62 + sat(h) * 0.38); });
      for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(200,190,120,${rand() * 0.3})`; ell(ctx, rand() * W, rand() * H, 1, 1); }
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 1.6) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(1.1, 1.1), color: new THREE.Color(AVO_RIPEN[0]), roughness: 0.62, clearcoat: 0.18, clearcoatRoughness: 0.5 });
});
phys('produce-avoskin', 1000);
// cut-face flesh: v = height, the dome on top runs rim (green) -> center (pale yellow)
const AVO_V_RIM = 0.9;
registerMaterial('produce-avoflesh', (kind) => {
  const map = cached('produce-avoflesh-' + (kind || 'pit'), () => canvasTex((ctx, W, H) => {
    const g = mkRamp([[0, '#9cc04e'], [AVO_V_RIM, '#9cc04e'], [AVO_V_RIM + 0.02, '#5f9a2e'], [AVO_V_RIM + 0.045, '#9ec64e'], [0.97, '#d9e07a'], [1, '#ece7a4']]);
    paint(ctx, W, H, (x, y) => {
      const v = 1 - y / H;
      let c = scl(g(v), 0.97 + tileFbm(x * 10 / W, y * 10 / W, 10, 2, 8) * 0.04);
      if (kind === 'cavity') c = mixc(c, C('#c2b85e'), sstep(0.985, 0.995, v) * 0.6);
      return c;
    });
  }, { w: 128, h: 512 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 });
});
phys('produce-avoflesh', 950);
// empty half skins: outer pebbly skin, dark rim, pale green inside
const SHELL_V = [0.47, 0.53];
registerMaterial('produce-avoshell', () => {
  const t = cached('produce-avoshell', () => {
    const W = 512, H = 512, hgt = avoPebbles(W, H, 52);
    const y0 = Math.round(H * (1 - SHELL_V[1])), y1 = Math.round(H * (1 - SHELL_V[0]));
    const map = canvasTex((ctx) => {
      paint(ctx, W, H, (x, y) => {
        if (y >= y1) { const h = hgt[y * W + x]; return scl([62, 84, 34], 0.65 + sat(h) * 0.4); }
        if (y >= y0) return mixc(C('#2a3a16'), C('#8fb54a'), (y1 - y) / (y1 - y0));
        return scl(C('#b9d06a'), 0.94 + tileFbm(x * 8 / W, y * 8 / W, 8, 2, 3) * 0.06);
      });
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 1.2) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.55, clearcoat: 0.2 });
});
phys('produce-avoshell', 900);
registerMaterial('produce-avopit', () => {
  const map = cached('produce-avopit', () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(53);
    paint(ctx, W, H, (x, y) => mixc(C('#7a4a28'), C('#5a3018'), sat(0.5 + tileFbm(x * 5 / W, y * 5 / W, 5, 3, 54))));
    for (let i = 0; i < 9; i++) { ctx.fillStyle = `rgba(200,160,110,${0.25 + rand() * 0.3})`; ell(ctx, rand() * W, rand() * H, 10 + rand() * 25, 6 + rand() * 14, rand() * 3); }
    ctx.strokeStyle = 'rgba(60,30,12,0.4)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(rand() * W, 0); ctx.bezierCurveTo(rand() * W, H * 0.3, rand() * W, H * 0.7, rand() * W, H); ctx.stroke(); }
  }, { w: 256, h: 128 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });
});
phys('produce-avopit', 1100);

// ---------- seedless watermelon ----------
function melonStripes(ctx, W, y0, y1, seed) {
  // jagged dark-green stripes running pole to pole over a light-green base
  const rand = mulberry32(seed);
  const nb = field(W, y1 - y0, 10, 3, seed + 1);
  paint2(ctx, W, y0, y1, (x, y) => mixc(C('#86b456'), C('#6a9a40'), sat(0.5 + nb[(y - y0) * W + x] * 0.9)));
  const n = 16;
  for (let s = 0; s < n; s++) {
    const cx = ((s + 0.5) / n) * W, wid = W / n * 0.42;
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0);
      const wob = Math.sin(t * 38 + s * 1.7) * wid * 0.22 + Math.sin(t * 91 + s) * wid * 0.12 + (rand() - 0.5) * wid * 0.2;
      const w = wid * (0.75 + 0.25 * Math.sin(t * 9 + s));
      ctx.fillStyle = `rgb(${30 + rand() * 10},${70 + rand() * 12},${28 + rand() * 8})`;
      wrapX(W, cx + wob, w, (xx) => ctx.fillRect(xx - w / 2, y, w, 1));
      if (rand() < 0.35) { const jx = cx + wob + (rand() < 0.5 ? -1 : 1) * (w / 2 + rand() * wid * 0.3); ctx.fillRect(jx - 2, y, 4 + rand() * 5, 1); }
    }
  }
}
registerMaterial('produce-melonrind', () => {
  const t = cached('produce-melonrind', () => {
    const W = 1024, H = 512, rand = mulberry32(201);
    const map = canvasTex((ctx) => {
      melonStripes(ctx, W, 0, H, 202);
      // field spot: where it lay in the field (bottom of the melon: u = 0.75)
      const fx = W * 0.75, fy = H * 0.5;
      const g = ctx.createRadialGradient(fx, fy, 10, fx, fy, H * 0.3);
      g.addColorStop(0, 'rgba(232,212,120,0.95)'); g.addColorStop(0.6, 'rgba(220,205,110,0.7)'); g.addColorStop(1, 'rgba(220,205,110,0)');
      ctx.fillStyle = g; ctx.save(); ctx.translate(fx, fy); ctx.scale(0.75, 1.3); ctx.translate(-fx, -fy); ctx.beginPath(); ctx.arc(fx, fy, H * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(${rand() < 0.5 ? '230,240,200' : '20,40,15'},${rand() * 0.12})`; ctx.fillRect(rand() * W, rand() * H, 1.5, 1.5); }
      // blossom end (v=0) + stem end (v=1)
      const b = ctx.createLinearGradient(0, H, 0, H * 0.96); b.addColorStop(0, 'rgba(120,110,60,0.9)'); b.addColorStop(1, 'rgba(120,110,60,0)');
      ctx.fillStyle = b; ctx.fillRect(0, H * 0.96, W, H * 0.04);
      const s = ctx.createLinearGradient(0, 0, 0, H * 0.03); s.addColorStop(0, 'rgba(90,100,40,0.8)'); s.addColorStop(1, 'rgba(90,100,40,0)');
      ctx.fillStyle = s; ctx.fillRect(0, 0, W, H * 0.03);
    }, { w: W, h: H });
    return { map };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
});
phys('produce-melonrind', 960);
// a melon half: v = height. Rind outside up to the rim, then (on the barely-domed cut face)
// dark green skin edge, pale green rind, white, then red flesh with a ring of soft white seeds
const MELON = { Rb: 0.118, hb: 0.13 };
const MELON_V = (() => {
  const h = MELON.hb;
  return { rim: (h - 0.012) / h, light: (h - 0.0112) / h, white: (h - 0.0102) / h, red: (h - 0.0088) / h };
})();
registerMaterial('produce-melonhalf', () => {
  const map = cached('produce-melonhalf', () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(210);
    const yv = (v) => Math.round(H * (1 - v));
    melonStripes(ctx, W, yv(MELON_V.rim), H, 211);
    const band = (v0, v1, c0, c1) => { const g = ctx.createLinearGradient(0, yv(v0), 0, yv(v1)); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, yv(v1), W, yv(v0) - yv(v1) + 1); };
    band(MELON_V.rim, MELON_V.light, '#2c5a22', '#5e8e3a');
    band(MELON_V.light, MELON_V.white, '#a9c879', '#d9e6b4');
    band(MELON_V.white, MELON_V.red, '#eef0d8', '#f4c8b8');
    // red flesh: v from MELON_V.red (outer) to 1 (center)
    const y0 = 0, y1 = yv(MELON_V.red);
    paint2(ctx, W, y0, y1, (x, y) => {
      const v = 1 - y / H, r = (1 - v) / (1 - MELON_V.red); // 0 center .. 1 outer edge of the red
      const k = tileFbm(x * 24 / W, y * 0.2, 24, 3, 9);
      let c = mixc(C('#e2333b'), C('#c81f2c'), sat(0.5 + k));
      c = mixc(c, C('#f06a6a'), sstep(0.75, 1, r) * 0.6);
      return c;
    });
    for (let i = 0; i < 2600; i++) { const y = rand() * y1; ctx.fillStyle = `rgba(255,${190 + rand() * 50},${190 + rand() * 50},${rand() * 0.35})`; ctx.fillRect(rand() * W, y, 1.5, 2 + rand() * 4); }
    // soft white seeds of a seedless melon, in a ring about half way out
    const ySeed = yv(1 - (1 - MELON_V.red) * 0.52);
    for (let i = 0; i < 34; i++) {
      const x = (i / 34) * W + (rand() - 0.5) * 8, y = ySeed + (rand() - 0.5) * 14;
      ctx.fillStyle = 'rgba(250,240,225,0.95)'; ell(ctx, x, y, 3.2, 7, (rand() - 0.5) * 0.4);
      ctx.fillStyle = 'rgba(200,170,150,0.6)'; ell(ctx, x + 0.8, y + 1, 1.2, 3);
    }
    for (let i = 0; i < 6; i++) { const x = rand() * W, y = ySeed - 30 + rand() * 60; ctx.fillStyle = '#2a1a12'; ell(ctx, x, y, 2.6, 5.5, rand() - 0.5); }
  }, { w: 512, h: 2048 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.25 });
});
phys('produce-melonhalf', 960);
registerMaterial('produce-melonshell', () => {
  const map = cached('produce-melonshell', () => canvasTex((ctx, W, H) => {
    const y0 = Math.round(H * (1 - SHELL_V[1])), y1 = Math.round(H * (1 - SHELL_V[0]));
    melonStripes(ctx, W, y1, H, 221);
    const g = ctx.createLinearGradient(0, y1, 0, y0);
    g.addColorStop(0, '#2c5a22'); g.addColorStop(0.3, '#9cc070'); g.addColorStop(0.65, '#eef0d8'); g.addColorStop(1, '#f2b4aa');
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
    paint2(ctx, W, 0, y0, (x, y) => mixc(C('#e8eccc'), C('#f0b6ae'), sat(sstep(0.5, 1, y / y0) + tileFbm(x * 12 / W, y * 12 / W, 12, 2, 4) * 0.3)));
  }, { w: 512, h: 512 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.45, clearcoat: 0.3 });
});
phys('produce-melonshell', 900);

// ---------- baby-cut carrots ----------
registerMaterial('produce-carrot', () => {
  const map = cached('produce-carrot', () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(61);
    paint(ctx, W, H, (x, y) => { const k = tileFbm(x * 4 / W, y * 16 / W, 4, 3, 62); return mixc(C('#f27d16'), C('#e0640c'), sat(0.5 + k)); });
    // growth rings across the root + little root-hair pores
    for (let i = 0; i < 26; i++) { const y = rand() * H; ctx.fillStyle = `rgba(150,60,5,${0.18 + rand() * 0.22})`; ctx.fillRect(0, y, W, 1 + rand() * 1.5); ctx.fillStyle = 'rgba(255,190,120,0.18)'; ctx.fillRect(0, y + 2, W, 1); }
    for (let i = 0; i < 70; i++) { ctx.fillStyle = 'rgba(120,50,5,0.45)'; ell(ctx, rand() * W, rand() * H, 1.2 + rand() * 2, 0.7); }
    ctx.fillStyle = 'rgba(255,200,130,0.5)'; ctx.fillRect(0, 0, W, 4); ctx.fillRect(0, H - 4, W, 4);
  }, { w: 128, h: 256 }));
  return new THREE.MeshPhysicalMaterial({ map, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
});
phys('produce-carrot', 1030);

// ---------- russet potato: netted brown skin, eyes, a little dirt ----------
registerMaterial('produce-potato', () => {
  const t = cached('produce-potato', () => {
    const W = 512, H = 512, rand = mulberry32(141), hgt = new Float32Array(W * H);
    const n = field(W, H, 6, 3, 142), net = field(W, H, 22, 2, 143);
    const map = canvasTex((ctx) => {
      paint(ctx, W, H, (x, y) => {
        const i = y * W + x, k = n[i], m = Math.abs(net[i]);
        const line = sstep(0.07, 0.0, m);
        hgt[i] = -line * 0.8 + k * 0.4;
        let c = mixc(C('#a7794b'), C('#8a5f37'), sat(0.5 + k));
        c = mixc(c, C('#6a4526'), line * 0.55);
        return c;
      });
      for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(225,195,150,${0.2 + rand() * 0.3})`; ell(ctx, rand() * W, rand() * H, 0.8 + rand() * 1.4, 0.6 + rand()); }
      for (let i = 0; i < 9; i++) {
        const x = rand() * W, y = H * (0.12 + rand() * 0.76), a = rand() * 3;
        ctx.fillStyle = 'rgba(60,35,15,0.85)'; ell(ctx, x, y, 5, 2.2, a);
        ctx.strokeStyle = 'rgba(180,140,95,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y - 3, 8, 4, a, Math.PI, Math.PI * 2); ctx.stroke();
        stamp(hgt, W, H, x, y, 7, -2);
      }
      for (let i = 0; i < 8; i++) { ctx.fillStyle = `rgba(80,55,30,${0.15 + rand() * 0.2})`; ell(ctx, rand() * W, rand() * H, 14 + rand() * 30, 8 + rand() * 18, rand() * 3); }
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 1.3) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.88 });
});
phys('produce-potato', 1080);

// ---------- romaine leaves: pale ribbed base -> ruffled dark-green tips ----------
registerMaterial('produce-romaine', (kind = 'outer') => {
  const t = cached('produce-romaine-' + kind, () => {
    const W = 256, H = 512, rand = mulberry32(kind === 'inner' ? 162 : 161), hgt = new Float32Array(W * H);
    const n = field(W, H, 8, 3, 163);
    const g = kind === 'inner'
      ? mkRamp([[0, '#eef2d4'], [0.3, '#dfeaa8'], [0.6, '#bcd878'], [0.85, '#94c25a'], [1, '#7cb24a']])
      : mkRamp([[0, '#e8eec8'], [0.22, '#cfe39a'], [0.45, '#9bc962'], [0.7, '#5f9c38'], [0.88, '#3f7f28'], [1, '#356f22']]);
    const map = canvasTex((ctx) => {
      paint(ctx, W, H, (x, y) => {
        const u = x / W, v = 1 - y / H, k = n[y * W + x];
        const du = Math.min(u, 1 - u);                                          // the midrib runs at u = 0
        const rib = Math.exp(-((du / (0.045 - v * 0.03)) ** 2)) * sstep(0.95, 0.6, v);
        const vein = Math.pow(Math.abs(Math.sin((v * 22 - du * 9) * Math.PI)), 18) * sstep(0.1, 0.4, v) * sstep(0.95, 0.75, v) * 0.6;
        const ruff = sstep(0.55, 0.9, v) * k;
        hgt[y * W + x] = rib * 1.4 + vein * 0.5 + ruff * 1.2 + Math.abs(tileFbm(x * 30 / W, y * 30 / W, 30, 2, 5)) * sstep(0.5, 0.9, v) * 0.8;
        let c = scl(g(v), 0.93 + k * 0.1);
        c = mixc(c, [240, 244, 220], rib * 0.85 + vein * 0.5);
        return c;
      });
      for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(30,70,20,${rand() * 0.15})`; ell(ctx, rand() * W, rand() * H * 0.4, 2 + rand() * 4, 1 + rand() * 3); }
    }, { w: W, h: H });
    return { map, normalMap: heightToNormal(hgt, W, H, 1.6) };
  });
  return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color(0xe8f4d0) });
});
phys('produce-romaine', 560);
registerMaterial('produce-romainecore', () => {
  const map = cached('produce-romainecore', () => canvasTex((ctx, W, H) => {
    const rand = mulberry32(170);
    paint(ctx, W, H, (x, y) => scl([238, 236, 206], 0.95 + tileFbm(x * 6 / W, y * 6 / W, 6, 3, 171) * 0.06));
    const g = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2);
    g.addColorStop(0, 'rgba(210,190,140,0.6)'); g.addColorStop(0.5, 'rgba(190,150,90,0.35)'); g.addColorStop(1, 'rgba(160,120,70,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(150,110,60,0.35)'; ell(ctx, rand() * W, rand() * H, 2 + rand() * 3, 1 + rand() * 2); }
  }, { w: 128, h: 128 }));
  return new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
});
phys('produce-romainecore', 900);

// =====================================================================================
// printed packaging + stickers
// =====================================================================================
// a fruit sticker (oval, transparent around it)
function sticker(id, { bg, ring, text, brand, line1, line2, plu, w = 256, h = 192, script = false }) {
  registerLabel(id, {
    w, h, finish: 'gloss', transparent: true,
    draw(ctx, W, H) {
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.4, H * 0.35, 4, W / 2, H / 2, W * 0.55);
      g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
      ctx.fillStyle = g; ell(ctx, W / 2, H / 2, W * 0.48, H * 0.46);
      ctx.strokeStyle = ring; ctx.lineWidth = W * 0.025; ctx.beginPath(); ctx.ellipse(W / 2, H / 2, W * 0.44, H * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      txt(ctx, brand, W / 2, H * 0.36, { size: H * 0.19, weight: 800, fam: script ? SERIF : SANS, italic: script, color: text, maxW: W * 0.78 });
      txt(ctx, line1, W / 2, H * 0.53, { size: H * 0.12, weight: 700, color: text, maxW: W * 0.7, track: 1 });
      txt(ctx, plu, W / 2, H * 0.76, { size: H * 0.2, weight: 900, color: text });
      if (line2) txt(ctx, line2, W / 2, H * 0.88, { size: H * 0.075, weight: 600, color: text });
    },
  });
}
sticker('produce-sticker-banana', { bg: ['#2f6fd0', '#173f8c'], ring: '#f5d230', text: '#ffffff', brand: 'Tierra Dorada', line1: 'ECUADOR', plu: '4011', line2: 'BANANA', script: true });
sticker('produce-sticker-orange', { bg: ['#ffffff', '#f2efe6'], ring: '#1f7a3a', text: '#1d5a2c', brand: 'Sunbarrow', line1: 'NAVEL · USA', plu: '4012', line2: 'CALIFORNIA', script: true });
sticker('produce-sticker-pear', { bg: ['#fff7d8', '#f0e2a4'], ring: '#7a2d1a', text: '#5a2412', brand: 'Tallpine', line1: 'BARTLETT', plu: '4409', line2: 'PRODUCT OF USA', script: true });
sticker('produce-sticker-tomato', { bg: ['#ffffff', '#eef2f4'], ring: '#0e4c6e', text: '#0e4c6e', brand: 'Harbor Market', line1: 'ROMA', plu: '4087', line2: 'PRODUCT OF MEXICO' });
sticker('produce-sticker-avocado', { bg: ['#202a1a', '#0f150c'], ring: '#9fd04a', text: '#e8f6c8', brand: 'Ojo Verde', line1: 'HASS · LARGE', plu: '4225', line2: 'MEXICO', script: true });
sticker('produce-sticker-melon', { bg: ['#ffffff', '#f1f1ea'], ring: '#d22a3a', text: '#2a6a2a', brand: 'Sweet Acre', line1: 'SEEDLESS', plu: '3421', line2: 'PRODUCT OF USA', script: true, w: 320, h: 240 });

// ---------- 3 lb Gala apple pouch ----------
registerLabel('produce-applebag-front', {
  w: 920, h: 800, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.fillStyle = '#fbf5e6'; ctx.fillRect(0, 0, w, h);
    // red banner with a curved gold rule
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.32); g.addColorStop(0, '#d52b30'); g.addColorStop(1, '#8f1520');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.2); ctx.quadraticCurveTo(w / 2, h * 0.34, 0, h * 0.2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, h * 0.222); ctx.quadraticCurveTo(w / 2, h * 0.355, w, h * 0.222); ctx.stroke();
    txt(ctx, 'Orchard Lane', w / 2, h * 0.12, { size: 96, weight: 700, fam: SERIF, italic: true, color: '#fff8e6', maxW: w * 0.8, stroke: 'rgba(90,10,15,0.5)', lw: 6 });
    txt(ctx, 'FAMILY ORCHARDS · EST. 1962', w / 2, h * 0.19, { size: 27, weight: 800, color: '#f6d58a', track: 3 });
    // sides: little orchard drawings + claims
    drawApple(ctx, w * 0.12, h * 0.47, 44); drawApple(ctx, w * 0.88, h * 0.55, 38);
    drawLeaf(ctx, w * 0.06, h * 0.62, 70, 0.4); drawLeaf(ctx, w * 0.95, h * 0.4, 60, 2.6);
    txt(ctx, 'Sweet', w * 0.12, h * 0.63, { size: 36, weight: 700, fam: SERIF, italic: true, color: '#b3212b' });
    txt(ctx, '& Crisp', w * 0.12, h * 0.68, { size: 30, weight: 700, fam: SERIF, italic: true, color: '#b3212b' });
    txt(ctx, 'Washington', w * 0.88, h * 0.7, { size: 28, weight: 700, fam: SERIF, italic: true, color: '#2f6a1f' });
    txt(ctx, 'Grown', w * 0.88, h * 0.745, { size: 28, weight: 700, fam: SERIF, italic: true, color: '#2f6a1f' });
    // product name under the window
    txt(ctx, 'GALA APPLES', w / 2, h * 0.865, { size: 96, weight: 900, color: '#c0262d', stroke: '#ffffff', lw: 12, maxW: w * 0.86 });
    // green footer
    const f = ctx.createLinearGradient(0, h * 0.9, 0, h); f.addColorStop(0, '#3f7f2a'); f.addColorStop(1, '#2a5c1c');
    ctx.fillStyle = f; ctx.fillRect(0, h * 0.895, w, h * 0.105);
    txt(ctx, 'NET WT 3 LB (1.36 kg)', w * 0.5, h * 0.965, { size: 40, weight: 800, color: '#ffffff', track: 1 });
    // the apple-shaped window
    const cx = w * 0.5, cy = h * 0.545, r = 168;
    cut(ctx, () => applePath(ctx, cx, cy, r));
    ctx.lineWidth = 9; ctx.strokeStyle = '#c0262d'; applePath(ctx, cx, cy, r + 4); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#f2c14e'; applePath(ctx, cx, cy, r + 10); ctx.stroke();
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.7); ctx.quadraticCurveTo(cx + 4, cy - r * 0.95, cx + 22, cy - r * 1.12); ctx.stroke();
    drawLeaf(ctx, cx + 18, cy - r * 0.98, 120, -0.4);
    // 3 LB badge
    starburst(ctx, w * 0.8, h * 0.33, 78, 16, '#f6c33b', '#c0262d');
    txt(ctx, '3 LB', w * 0.8, h * 0.335, { size: 48, weight: 900, color: '#b3212b' });
    txt(ctx, 'BAG', w * 0.8, h * 0.375, { size: 24, weight: 800, color: '#b3212b', track: 2 });
    vents(ctx, w * 0.25, h * 0.745, w * 0.75, h * 0.77, 26, 4.5);
  },
});
registerLabel('produce-applebag-back', {
  w: 920, h: 800, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.fillStyle = '#fbf5e6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b3212b'; ctx.fillRect(0, 0, w, 46); ctx.fillStyle = '#3f7f2a'; ctx.fillRect(0, h - 40, w, 40);
    txt(ctx, 'ORCHARD LANE · GALA', w / 2, 33, { size: 28, weight: 800, color: '#fff', track: 4 });
    nutritionPanel(ctx, 34, 70, 300, { servings: 'About 9', size: '1 apple (154g)', kcal: 90, fat: 0, sodium: 0, carb: 21, fiber: 4, sugar: 16, protein: 0, ca: 10, fe: 0.2, k: 170, extra: [['Vitamin C', '7mg', '8%']] });
    const x = 370;
    txt(ctx, 'Gala Apples', x, 120, { size: 46, weight: 700, fam: SERIF, italic: true, color: '#b3212b', align: 'left' });
    lines(ctx, ['Mild, honey-sweet and crisp. Great for snacking,', 'school lunches, salads and baking.'], x, 165, 30, { size: 22, weight: 500, color: '#3a2a20', align: 'left' });
    txt(ctx, 'KEEP THEM CRISP', x, 260, { size: 22, weight: 800, color: '#2f6a1f', align: 'left', track: 2 });
    lines(ctx, ['Refrigerate for up to 6 weeks, or keep in a cool', 'spot for about 3. Wash before eating.'], x, 292, 30, { size: 22, weight: 500, color: '#3a2a20', align: 'left' });
    lines(ctx, ['Packed by Orchard Lane Fruit Co.', 'Wenatchee, WA 98801 · Product of USA'], x, 390, 30, { size: 20, weight: 600, color: '#3a2a20', align: 'left' });
    upc(ctx, x, 470, 270, 135, '03338344210');
    recycle(ctx, x + 380, 520, 70, 4, 'LDPE');
    txt(ctx, 'Store drop-off', x + 380, 600, { size: 16, weight: 600, color: '#333' });
    // window on the back too
    cut(ctx, () => rr(ctx, 360, 640, w - 400, 110, 30));
  },
});
registerLabel('produce-applebag-header', {
  w: 920, h: 184, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.fillStyle = '#fbf8f0'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c0262d'; ctx.fillRect(0, h - 26, w, 26);
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(0, h - 32, w, 6);
    for (let x = 0; x < w; x += 8) { ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x, 0, 3, 12); } // heat-seal texture
    txt(ctx, 'Orchard Lane', w * 0.17, h * 0.55, { size: 40, weight: 700, fam: SERIF, italic: true, color: '#b3212b' });
    recycle(ctx, w * 0.86, h * 0.42, 52, 4, 'LDPE', '#555');
    cut(ctx, () => rr(ctx, w * 0.36, h * 0.24, w * 0.28, h * 0.38, h * 0.19));
  },
});

// ---------- 1 lb strawberry clamshell ----------
registerLabel('produce-berry-lid', {
  w: 800, h: 520, finish: 'gloss',
  draw(ctx, w, h) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.42); g.addColorStop(0, '#e2283a'); g.addColorStop(1, '#a3121f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.3); ctx.bezierCurveTo(w * 0.7, h * 0.44, w * 0.3, h * 0.24, 0, h * 0.38); ctx.closePath(); ctx.fill();
    txt(ctx, 'Berry Hollow', w * 0.36, h * 0.17, { size: 70, weight: 700, fam: SERIF, italic: true, color: '#fff', maxW: w * 0.6 });
    txt(ctx, 'F A R M S', w * 0.36, h * 0.27, { size: 26, weight: 800, color: '#ffd9dc' });
    drawStrawberry(ctx, w * 0.8, h * 0.4, 92, 0.25);
    drawStrawberry(ctx, w * 0.66, h * 0.55, 60, -0.35);
    txt(ctx, 'STRAWBERRIES', w * 0.36, h * 0.6, { size: 74, weight: 900, color: '#c4141f', maxW: w * 0.64 });
    ctx.fillStyle = '#2f7a24'; rr(ctx, w * 0.06, h * 0.68, w * 0.5, h * 0.13, 16); ctx.fill();
    txt(ctx, '1 LB (454 g)', w * 0.31, h * 0.775, { size: 46, weight: 900, color: '#fff' });
    lines(ctx, ['Grown in Watsonville, California', 'Keep refrigerated · Rinse just before eating'], w * 0.5, h * 0.88, 34, { size: 26, weight: 600, color: '#3a3a3a' });
  },
});
registerLabel('produce-berry-front', {
  w: 900, h: 210, finish: 'gloss',
  draw(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e2283a'); g.addColorStop(1, '#a3121f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, h - 14, w, 5);
    drawStrawberry(ctx, 90, 100, 72, -0.2);
    txt(ctx, 'Berry Hollow Farms', 400, 92, { size: 62, weight: 700, fam: SERIF, italic: true, color: '#fff', maxW: 470 });
    txt(ctx, 'FRESH STRAWBERRIES · 1 LB (16 OZ) 454 g', 400, 150, { size: 26, weight: 800, color: '#ffe2e4', maxW: 480 });
    upc(ctx, 690, 26, 190, 150, '07104512201');
  },
});
registerLabel('produce-berry-side', {
  w: 520, h: 340, finish: 'gloss',
  draw(ctx, w, h) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    nutritionPanel(ctx, 8, 4, 196, { servings: 'About 3', size: '8 berries (147g)', kcal: 45, fat: 0.5, sodium: 0, carb: 11, fiber: 3, sugar: 7, protein: 1, ca: 24, fe: 0.6, k: 225, extra: [] });
    txt(ctx, 'STRAWBERRIES', 360, 46, { size: 32, weight: 900, color: '#c4141f', maxW: 290 });
    lines(ctx, ['Rinse right before eating.', 'Keep refrigerated (34-38°F).', 'Do not freeze in this', 'container.'], 360, 88, 26, { size: 19, weight: 500, color: '#333' });
    lines(ctx, ['Packed by Berry Hollow Farms', 'Watsonville, CA 95076', 'Product of USA'], 360, 210, 22, { size: 15, weight: 600, color: '#444' });
    recycle(ctx, 360, 300, 46, 1, 'PET');
  },
});

// ---------- ~2 lb red seedless grapes, stand-up zip pouch ----------
registerLabel('produce-grapebag-front', {
  w: 860, h: 800, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    // purple header with a vine
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.28); g.addColorStop(0, '#5a1f5e'); g.addColorStop(1, '#3a0f40');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.22); ctx.bezierCurveTo(w * 0.7, h * 0.3, w * 0.35, h * 0.18, 0, h * 0.26); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8bbf4a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, h * 0.272); ctx.bezierCurveTo(w * 0.35, h * 0.195, w * 0.7, h * 0.315, w, h * 0.232); ctx.stroke();
    txt(ctx, 'VINECREST', w * 0.42, h * 0.12, { size: 92, weight: 900, color: '#f4e9f6', track: 6, maxW: w * 0.7 });
    txt(ctx, 'VINEYARDS · CALIFORNIA', w * 0.42, h * 0.18, { size: 26, weight: 700, color: '#d9b8e0', track: 4 });
    drawGrapes(ctx, w * 0.86, h * 0.17, 120);
    // product name printed on the clear film
    txt(ctx, 'Red Seedless', w * 0.5, h * 0.42, { size: 84, weight: 700, fam: SERIF, italic: true, color: '#ffffff', stroke: '#5a1f5e', lw: 12 });
    txt(ctx, 'GRAPES', w * 0.5, h * 0.53, { size: 96, weight: 900, color: '#ffffff', stroke: '#5a1f5e', lw: 12, track: 8 });
    // green footer band
    const f = ctx.createLinearGradient(0, h * 0.78, 0, h); f.addColorStop(0, '#5f9a32'); f.addColorStop(1, '#3d6e22');
    ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(0, h * 0.82); ctx.bezierCurveTo(w * 0.3, h * 0.78, w * 0.6, h * 0.86, w, h * 0.8); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    txt(ctx, 'NET WT 2 LB (907 g)', w * 0.36, h * 0.92, { size: 44, weight: 900, color: '#fff' });
    txt(ctx, 'Rinse before eating · PLU 4023', w * 0.36, h * 0.97, { size: 22, weight: 600, color: '#e8f6d8' });
    starburst(ctx, w * 0.84, h * 0.9, 64, 14, '#f6c33b', '#5a1f5e');
    txt(ctx, 'SWEET', w * 0.84, h * 0.895, { size: 24, weight: 900, color: '#5a1f5e' }); txt(ctx, '& CRISP', w * 0.84, h * 0.928, { size: 18, weight: 800, color: '#5a1f5e' });
    // faint film tint over the window so it reads as plastic
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, h * 0.28, w, h * 0.5);
    vents(ctx, w * 0.08, h * 0.3, w * 0.92, h * 0.32, 34, 4);
  },
});
registerLabel('produce-grapebag-back', {
  w: 860, h: 800, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#4a1650'; ctx.fillRect(0, 0, w, 60);
    txt(ctx, 'VINECREST · RED SEEDLESS GRAPES', w / 2, 42, { size: 28, weight: 800, color: '#f4e9f6', track: 3 });
    ctx.fillStyle = '#fbf8f2'; rr(ctx, 20, 470, w - 40, 310, 16); ctx.fill();
    nutritionPanel(ctx, 30, 480, 170, { servings: 'About 7', size: '1 cup (126g)', kcal: 90, fat: 0, sodium: 0, carb: 23, fiber: 1, sugar: 20, protein: 1, ca: 13, fe: 0.5, k: 240 });
    txt(ctx, 'Crisp, juicy, no seeds.', 230, 520, { size: 30, weight: 700, fam: SERIF, italic: true, color: '#5a1f5e', align: 'left' });
    lines(ctx, ['Keep refrigerated. Rinse just before eating.', 'Snack them cold, freeze them for a treat,', 'or toss them in a salad.'], 230, 560, 28, { size: 20, weight: 500, color: '#333', align: 'left' });
    lines(ctx, ['Packed by Vinecrest Vineyards, Delano, CA 93215', 'Product of USA'], 230, 660, 24, { size: 16, weight: 600, color: '#444', align: 'left' });
    upc(ctx, 560, 680, 200, 90, '08549301129');
    recycle(ctx, 250, 735, 48, 4, 'LDPE');
    vents(ctx, w * 0.08, 90, w * 0.92, 110, 34, 4);
  },
});
registerLabel('produce-grapebag-header', {
  w: 920, h: 160, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.fillStyle = 'rgba(245,240,248,0.92)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5a1f5e'; ctx.fillRect(0, h * 0.72, w, h * 0.12);           // zipper track
    ctx.fillStyle = '#7d3a82'; ctx.fillRect(0, h * 0.75, w, h * 0.03);
    txt(ctx, 'PRESS TO CLOSE', w * 0.15, h * 0.62, { size: 22, weight: 800, color: '#5a1f5e', track: 2 });
    txt(ctx, 'PRESS TO CLOSE', w * 0.85, h * 0.62, { size: 22, weight: 800, color: '#5a1f5e', track: 2 });
    cut(ctx, () => rr(ctx, w * 0.37, h * 0.16, w * 0.26, h * 0.36, h * 0.18));
  },
});

// ---------- 1 lb baby-cut carrots, pillow bag lying flat (print "up" points away from you) ----------
registerLabel('produce-carrotbag-top', {
  w: 620, h: 920, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    // green leafy header
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.26); g.addColorStop(0, '#2f7a2a'); g.addColorStop(1, '#1f5a1e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.2); ctx.quadraticCurveTo(w / 2, h * 0.3, 0, h * 0.2); ctx.closePath(); ctx.fill();
    txt(ctx, 'Crunch Valley', w / 2, h * 0.1, { size: 74, weight: 700, fam: SERIF, italic: true, color: '#fff', maxW: w * 0.86 });
    txt(ctx, 'FARMS', w / 2, h * 0.155, { size: 26, weight: 800, color: '#cfe8b4', track: 8 });
    // orange name band
    const o = ctx.createLinearGradient(0, h * 0.27, 0, h * 0.4); o.addColorStop(0, '#f58a1c'); o.addColorStop(1, '#d9650a');
    ctx.fillStyle = o; rr(ctx, w * 0.06, h * 0.265, w * 0.88, h * 0.13, 24); ctx.fill();
    txt(ctx, 'BABY-CUT', w / 2, h * 0.325, { size: 66, weight: 900, color: '#fff', track: 3 });
    txt(ctx, 'CARROTS', w / 2, h * 0.38, { size: 50, weight: 900, color: '#fff3e0', track: 10 });
    drawCarrot(ctx, w * 0.15, h * 0.5, 120, -0.5);
    // footer
    ctx.fillStyle = '#1f5a1e'; ctx.fillRect(0, h * 0.86, w, h * 0.14);
    txt(ctx, 'NET WT 16 OZ (1 LB) 454 g', w / 2, h * 0.915, { size: 36, weight: 900, color: '#fff' });
    txt(ctx, 'Washed & peeled · ready to eat · keep refrigerated', w / 2, h * 0.96, { size: 20, weight: 600, color: '#d8efc6' });
    starburst(ctx, w * 0.82, h * 0.79, 66, 14, '#f6c33b', '#d9650a');
    txt(ctx, 'SNACK', w * 0.82, h * 0.79, { size: 24, weight: 900, color: '#1f5a1e' }); txt(ctx, 'SIZE!', w * 0.82, h * 0.82, { size: 22, weight: 900, color: '#1f5a1e' });
    // see-through window (rounded) in between
    ctx.strokeStyle = '#f58a1c'; ctx.lineWidth = 8; rr(ctx, w * 0.1, h * 0.43, w * 0.8, h * 0.4, 40); ctx.stroke();
    cut(ctx, () => rr(ctx, w * 0.1 + 4, h * 0.43 + 4, w * 0.8 - 8, h * 0.4 - 8, 36));
    drawCarrot(ctx, w * 0.62, h * 0.47, 170, 0.35);
  },
});
registerLabel('produce-carrotbag-bottom', {
  w: 620, h: 920, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fdf8f0'; rr(ctx, 20, 20, w - 40, h - 40, 20); ctx.fill();
    nutritionPanel(ctx, 40, 40, 260, { servings: 'About 5', size: '3 oz (85g)', kcal: 30, fat: 0, sodium: 65, carb: 7, fiber: 2, sugar: 4, protein: 1, ca: 27, fe: 0.8, k: 200, extra: [['Vitamin A', '590mcg', '70%']] });
    txt(ctx, 'Crunch Valley', 460, 90, { size: 36, weight: 700, fam: SERIF, italic: true, color: '#1f5a1e', maxW: 260 });
    lines(ctx, ['Keep refrigerated', '(33-38°F).', 'Use within 2 weeks', 'of opening.', 'A white blush is', 'just the carrot', 'drying out. Rinse', 'it right off.'], 460, 140, 28, { size: 19, weight: 500, color: '#333' });
    lines(ctx, ['Distributed by', 'Crunch Valley Farms', 'Bakersfield, CA 93307', 'Product of USA'], 460, 400, 26, { size: 17, weight: 600, color: '#444' });
    upc(ctx, 330, 720, 250, 130, '03383811402');
    recycle(ctx, 120, 760, 60, 4, 'LDPE');
  },
});
registerLabel('produce-carrotbag-seal', {
  w: 660, h: 64, finish: 'gloss',
  draw(ctx, w, h) {
    ctx.fillStyle = '#e9f3e2'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 6) { ctx.fillStyle = 'rgba(31,90,30,0.25)'; ctx.fillRect(x, 0, 2, h); }   // crimp lines
    ctx.fillStyle = '#1f5a1e'; ctx.fillRect(0, 0, w, 6);
    ctx.fillStyle = '#d9650a'; ctx.beginPath(); ctx.moveTo(w - 30, 0); ctx.lineTo(w - 18, h * 0.5); ctx.lineTo(w - 30, h); ctx.lineTo(w, h); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
    txt(ctx, 'TEAR HERE ▸', w - 46, h * 0.68, { size: 26, weight: 900, color: '#1f5a1e', align: 'right' });
  },
});
registerLabel('produce-carrotbag-torn', {
  w: 660, h: 40, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(233,243,226,0.9)';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * (0.2 + ((x * 7919) % 13) / 20));
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,20,10,0.55)'; ctx.fillRect(w * 0.04, h * 0.75, w * 0.92, h * 0.12);
  },
});

// ---------- 5 lb russet potatoes, kraft paper bag with a mesh window (3x2 atlas) ----------
const POTATO_NUT = { servings: 'About 15', size: '1 potato (148g)', kcal: 120, fat: 0, sodium: 5, carb: 27, fiber: 2, sugar: 1, protein: 3, ca: 20, fe: 1.3, k: 620, extra: [['Vitamin C', '9mg', '10%']] };
registerLabel('produce-potatobag', {
  w: 1536, h: 1024, finish: 'matte', transparent: true,
  draw(ctx, w, h) {
    const cw = w / 3, ch = h / 2, rand = mulberry32(150);
    const kraftCell = (x0, y0) => {
      const n = field(256, 256, 8, 3, 151);
      const img = ctx.createImageData(cw, ch), d = img.data;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const k = n[(y % 256) * 256 + (x % 256)], o = (y * cw + x) * 4; d[o] = 184 + k * 14; d[o + 1] = 141 + k * 12; d[o + 2] = 92 + k * 9; d[o + 3] = 255; }
      ctx.putImageData(img, x0, y0);
      for (let i = 0; i < 900; i++) { ctx.fillStyle = rand() < 0.5 ? `rgba(90,60,30,${0.05 + rand() * 0.1})` : `rgba(235,205,160,${0.05 + rand() * 0.1})`; ctx.fillRect(x0 + rand() * cw, y0 + rand() * ch, 1 + rand() * 9, 1); }
    };
    for (let i = 0; i < 6; i++) kraftCell((i % 3) * cw, Math.floor(i / 3) * ch);
    const ink = '#3a2a1a', red = '#a3322a';
    // narrow side faces (0.13 m wide on a 0.25 m tall bag): draw stretched so they look right
    const side = (x0, y0, fn) => { ctx.save(); ctx.translate(x0, y0); ctx.scale(1.92, 1); fn(cw / 1.92); ctx.restore(); };
    // +x side: storage + cooking tips
    side(0, 0, (sw) => {
      txt(ctx, 'RUSSET', sw / 2, 70, { size: 40, weight: 900, color: red, track: 2, maxW: sw - 20 });
      txt(ctx, 'POTATOES', sw / 2, 108, { size: 26, weight: 800, color: ink, track: 3, maxW: sw - 20 });
      lines(ctx, ['Store in a cool,', 'dark, dry place.', 'Do not refrigerate.', '', 'Bake · Mash · Fry', 'Roast · Wedges'], sw / 2, 170, 34, { size: 21, weight: 600, color: ink, maxW: sw - 16 });
      ctx.fillStyle = 'rgba(58,42,26,0.8)'; ctx.fillRect(14, 410, sw - 28, 3);
      txt(ctx, 'U.S. No. 1', sw / 2, 455, { size: 28, weight: 900, color: ink });
    });
    // -x side: nutrition facts
    side(cw, 0, (sw) => { nutritionPanel(ctx, 8, 10, sw - 16, POTATO_NUT); });
    // front: brand badge, name, the window
    const fx = cw, fy = ch;
    ctx.save(); ctx.translate(fx, fy);
    ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.strokeRect(14, 14, cw - 28, ch - 28);
    ctx.fillStyle = red; ctx.beginPath(); ctx.arc(cw / 2, 92, 66, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f3e6cc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cw / 2, 92, 58, 0, Math.PI * 2); ctx.stroke();
    txt(ctx, 'BASIN', cw / 2, 82, { size: 30, weight: 900, color: '#f3e6cc', track: 3 });
    txt(ctx, 'BLUFF', cw / 2, 112, { size: 30, weight: 900, color: '#f3e6cc', track: 3 });
    txt(ctx, 'FARMS · SINCE 1948', cw / 2, 188, { size: 20, weight: 800, color: ink, track: 3 });
    txt(ctx, 'Russet', cw / 2, 252, { size: 64, weight: 700, fam: SERIF, italic: true, color: red });
    // window: a mesh net over a clear cut-out
    const wx = 70, wy = 280, ww = cw - 140, wh = 140;
    ctx.restore();
    cut(ctx, () => rr(ctx, fx + wx, fy + wy, ww, wh, 26));
    ctx.save(); ctx.translate(fx, fy);
    ctx.save(); rr(ctx, wx, wy, ww, wh, 26); ctx.clip();
    ctx.strokeStyle = 'rgba(200,170,120,0.55)'; ctx.lineWidth = 1.6;
    for (let k = -wh; k < ww + wh; k += 14) { ctx.beginPath(); ctx.moveTo(wx + k, wy); ctx.lineTo(wx + k + wh, wy + wh); ctx.stroke(); ctx.beginPath(); ctx.moveTo(wx + k + wh, wy); ctx.lineTo(wx + k, wy + wh); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = 4; rr(ctx, wx, wy, ww, wh, 26); ctx.stroke();
    txt(ctx, 'POTATOES', cw / 2, 466, { size: 52, weight: 900, color: ink, track: 6 });
    ctx.fillStyle = red; ctx.fillRect(40, 482, cw - 80, 2);
    txt(ctx, 'NET WT 5 LB (2.27 kg)', cw / 2, 500, { size: 22, weight: 800, color: ink });
    drawPotato(ctx, 64, 248, 30, -0.3); drawPotato(ctx, cw - 64, 248, 30, 0.4);
    ctx.restore();
    // back: barcode + a recipe
    ctx.save(); ctx.translate(2 * cw, ch);
    txt(ctx, 'The Perfect Baked Potato', cw / 2, 70, { size: 34, weight: 700, fam: SERIF, italic: true, color: red, maxW: cw - 40 });
    lines(ctx, ['1. Heat oven to 425°F.', '2. Scrub, dry, prick with a fork.', '3. Rub with oil and salt.', '4. Bake on the rack 50-60 min,', '    until a knife slides right in.'], 40, 125, 34, { size: 22, weight: 500, color: ink, align: 'left' });
    lines(ctx, ['Packed by Basin Bluff Farms', 'American Falls, ID 83211', 'Product of USA'], cw / 2, 330, 28, { size: 20, weight: 700, color: ink });
    upc(ctx, cw / 2 - 130, 400, 260, 100, '04120055031');
    ctx.restore();
    // bottom: fold lines
    ctx.strokeStyle = 'rgba(80,55,30,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, ch + ch * 0.5); ctx.lineTo(cw, ch + ch * 0.5); ctx.moveTo(0, ch); ctx.lineTo(cw * 0.5, ch * 1.5); ctx.lineTo(0, h); ctx.moveTo(cw, ch); ctx.lineTo(cw * 0.5, ch * 1.5); ctx.lineTo(cw, h); ctx.stroke();
  },
});
registerLabel('produce-potatobag-fin', {
  w: 800, h: 192, finish: 'matte', transparent: true,
  draw(ctx, w, h) {
    const n = field(256, 64, 8, 3, 152);
    paint(ctx, w, h, (x, y) => { const k = n[(y % 64) * 256 + (x % 256)]; return [184 + k * 14, 141 + k * 12, 92 + k * 9]; });
    ctx.strokeStyle = 'rgba(58,42,26,0.6)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, h * 0.86); ctx.lineTo(w, h * 0.86); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, 'BASIN BLUFF', w * 0.16, h * 0.56, { size: 30, weight: 900, color: '#a3322a', track: 3 });
    txt(ctx, '5 LB', w * 0.86, h * 0.58, { size: 40, weight: 900, color: '#3a2a1a' });
    cut(ctx, () => rr(ctx, w * 0.35, h * 0.22, w * 0.3, h * 0.42, h * 0.2));
  },
});

// ---------- romaine hearts 3-pack, clear sleeve lying flat ----------
registerLabel('produce-romainebag-top', {
  w: 720, h: 900, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.22); g.addColorStop(0, '#2c6e3a'); g.addColorStop(1, '#1d4f2a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.17); ctx.quadraticCurveTo(w / 2, h * 0.25, 0, h * 0.17); ctx.closePath(); ctx.fill();
    drawLettuce(ctx, w * 0.12, h * 0.17, 40);
    txt(ctx, 'Greenfurrow', w * 0.55, h * 0.1, { size: 76, weight: 700, fam: SERIF, italic: true, color: '#fff', maxW: w * 0.7 });
    txt(ctx, 'SALINAS VALLEY GROWN', w * 0.55, h * 0.155, { size: 22, weight: 800, color: '#bfe2c0', track: 4 });
    // name band across the middle (over the window)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; rr(ctx, w * 0.06, h * 0.52, w * 0.88, h * 0.17, 22); ctx.fill();
    ctx.strokeStyle = '#2c6e3a'; ctx.lineWidth = 5; rr(ctx, w * 0.06, h * 0.52, w * 0.88, h * 0.17, 22); ctx.stroke();
    txt(ctx, 'ROMAINE HEARTS', w / 2, h * 0.6, { size: 72, weight: 900, color: '#1d4f2a', maxW: w * 0.8 });
    txt(ctx, '3 HEARTS · NET WT 18 OZ (510 g)', w / 2, h * 0.66, { size: 28, weight: 800, color: '#2c6e3a' });
    // footer
    ctx.fillStyle = '#1d4f2a'; ctx.fillRect(0, h * 0.9, w, h * 0.1);
    txt(ctx, 'Keep refrigerated · Rinse before use', w / 2, h * 0.962, { size: 28, weight: 700, color: '#e6f4e0' });
    starburst(ctx, w * 0.84, h * 0.3, 70, 14, '#f6c33b', '#1d4f2a');
    txt(ctx, 'CRISP', w * 0.84, h * 0.3, { size: 26, weight: 900, color: '#1d4f2a' }); txt(ctx, '& SWEET', w * 0.84, h * 0.33, { size: 18, weight: 800, color: '#1d4f2a' });
    vents(ctx, w * 0.1, h * 0.8, w * 0.9, h * 0.86, 30, 4);
  },
});
registerLabel('produce-romainebag-bottom', {
  w: 720, h: 900, finish: 'gloss', transparent: true,
  draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fbfaf3'; rr(ctx, 30, 380, w - 60, 490, 20); ctx.fill();
    nutritionPanel(ctx, 44, 392, 250, { servings: 'About 6', size: '1 1/2 cups (85g)', kcal: 15, fat: 0, sodium: 5, carb: 3, fiber: 2, sugar: 1, protein: 1, ca: 30, fe: 0.8, k: 210, extra: [['Vitamin A', '370mcg', '40%']] });
    txt(ctx, 'Greenfurrow', 500, 440, { size: 40, weight: 700, fam: SERIF, italic: true, color: '#1d4f2a' });
    lines(ctx, ['Wash before eating.', 'Keep refrigerated', 'at 34-38°F.', '', 'Packed by Greenfurrow', 'Growers, Salinas, CA', '93901 · Product of USA'], 500, 490, 28, { size: 19, weight: 600, color: '#333' });
    upc(ctx, 380, 730, 240, 110, '07390221813');
  },
});

// ---------- English cucumber: printed band on the shrink wrap (text runs along the cucumber) ----------
registerLabel('produce-cukeband', {
  w: 1024, h: 288, finish: 'gloss',
  draw(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#0f4a2a'); g.addColorStop(0.5, '#1d6a3a'); g.addColorStop(1, '#0f4a2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8f2d8'; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
    // the front of the band is u = 0.5; text is rotated so it reads along the cucumber
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(Math.PI / 2);
    txt(ctx, 'GLASSHOUSE GREENS', 0, -92, { size: 22, weight: 800, color: '#bfe6a8', maxW: h - 30, track: 2 });
    txt(ctx, 'English', 0, -40, { size: 48, weight: 700, fam: SERIF, italic: true, color: '#ffffff', maxW: h - 30 });
    txt(ctx, 'CUCUMBER', 0, 8, { size: 42, weight: 900, color: '#ffffff', maxW: h - 30 });
    txt(ctx, 'Greenhouse grown · no peeling needed', 0, 44, { size: 15, weight: 600, color: '#d8efc6', maxW: h - 30 });
    txt(ctx, 'PLU 4593 · CANADA', 0, 84, { size: 22, weight: 900, color: '#f6d34a', maxW: h - 30 });
    ctx.restore();
    ctx.save(); ctx.translate(w * 0.18, h / 2); ctx.rotate(Math.PI / 2); upc(ctx, -110, -40, 220, 80, '06812440017'); ctx.restore();
  },
});

// =====================================================================================
// shapes
// =====================================================================================
// ---------- Gala apple (same 7.5 cm shape as the single apple), centered on its middle ----------
const APPLE_SKIN = [[0, 0.0045], [0.008, 0.0035], [0.016, 0.0012], [0.022, 0.0], [0.028, 0.0028], [0.033, 0.009], [0.0362, 0.018], [0.0376, 0.028],
  [0.0378, 0.037], [0.0368, 0.046], [0.0342, 0.055], [0.0298, 0.0625], [0.0238, 0.0675], [0.0172, 0.0695], [0.011, 0.0672], [0.006, 0.0635], [0.0025, 0.0618], [0, 0.0615]];
function bagApple(i, pos, rot, s) {
  return unitOf(xf([
    lathe(APPLE_SKIN, 0, -0.035 * s, 0, 'produce-bagapple', { seg: 28, col: false, scale: [s, s, s] }),
    cyl(0.0016, 0.016, 0.0012, 0.033 * s, 0, 'produce-stem', { seg: 6, rot: [0, 0, -12], col: false }),
    sph(0.0365 * s, 0, 0, 0, 'produce-bagapple', { vis: false }),
  ], pos, rot), i);
}

// ---------- banana: a curved tube lying on its side, curving toward you, the stem end lifted ----------
const BAN_SPAN = 70 * DEG, BAN_R = 0.165;
const BAN_RAD = [[0, 0.0055], [0.06, 0.0128], [0.15, 0.0174], [0.3, 0.019], [0.5, 0.0192], [0.68, 0.0184], [0.8, 0.016], [0.9, 0.0117], [0.96, 0.0084], [1, 0.0074]];
function banR(t) {
  for (let i = 1; i < BAN_RAD.length; i++) if (t <= BAN_RAD[i][0]) { const [t0, r0] = BAN_RAD[i - 1], [t1, r1] = BAN_RAD[i]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0); }
  return BAN_RAD[BAN_RAD.length - 1][1];
}
function banC(t) {
  const a = (t - 0.5) * BAN_SPAN, c = (BAN_R * (1 + Math.cos(BAN_SPAN / 2))) / 2;
  return new THREE.Vector3(BAN_R * Math.sin(a), banR(t) + 0.0035 * (1 - t) ** 4 + 0.011 * t ** 4, c - BAN_R * Math.cos(a));
}
function banFrame(t) {
  const T = banC(Math.min(1, t + 0.01)).sub(banC(Math.max(0, t - 0.01))).normalize();
  const side = new THREE.Vector3().crossVectors(T, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(side, T).normalize();
  return { T, side, up };
}
function banPts(t0, t1, n, rf) {
  const pts = [], rs = [];
  for (let i = 0; i < n; i++) { const t = t0 + ((t1 - t0) * i) / (n - 1); pts.push(banC(t).toArray()); rs.push(rf(t)); }
  return { pts, rs };
}
const BAN_STEM_TIP = (() => { const e = banC(1), { T, up } = banFrame(0.995); return e.clone().addScaledVector(T, 0.021).addScaledVector(up, 0.0045); })();
// mode 'single' = the full banana (peel, flesh, leftover peel); 'unit' = just the whole banana in a bunch
function bananaParts(mode, withSticker) {
  const single = mode === 'single';
  const skin = banPts(0, 1, 11, banR);
  const e = banC(1), f1 = banFrame(0.995), b = banC(0), f0 = banFrame(0.005);
  const s1 = e.clone().addScaledVector(f1.T, 0.011).addScaledVector(f1.up, 0.0018);
  const parts = [
    curve(skin.pts, 0, 0, 0, 0, 'produce-bananaskin', { rs: skin.rs, seg: 12, ripen: true, ...(single ? { closed: true } : {}) }),
    curve([e.clone().addScaledVector(f1.T, -0.004).toArray(), s1.toArray(), BAN_STEM_TIP.toArray()], 0.005, 0, 0, 0, 'produce-stem:banana', { rs: [0.0064, 0.0047, 0.0052], seg: 8, col: false, ...(single ? { closed: true } : {}) }),
    sph(0.0036, ...b.clone().addScaledVector(f0.T, -0.0042).toArray(), 'produce-stem:tip', { seg: 10, col: false, ...(single ? { pack: true } : {}) }),
  ];
  if (withSticker) {
    const fm = banFrame(0.52), n = fm.up.clone().multiplyScalar(0.8).addScaledVector(fm.side, 0.6).normalize();
    const c = banC(0.52).addScaledVector(n, banR(0.52) - 0.0002);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); // text runs along the banana
    parts.push(box(0.02, 0.0135, 0.0005, ...c.toArray(), 'label:produce-sticker-banana', { uv: 'fit', col: false, rot: qToRot(q), ...(single ? { closed: true } : {}) }));
  }
  if (!single) return parts;
  // inside: the fruit (dent), then what's left once it's peeled + eaten
  const flesh = banPts(0.035, 0.94, 11, (t) => Math.min(banR(t) * 0.86, banR(t) - 0.0018));
  parts.push(curve(flesh.pts, 0, 0, 0, 0, 'produce-bananaflesh', { rs: flesh.rs, seg: 14, eat: true }));
  const cup = banPts(0, 0.2, 5, (t) => banR(t) * 0.985);
  parts.push(curve(cup.pts, 0, 0, 0, 0, 'produce-bananaskin', { rs: cup.rs, seg: 12, ripen: true, opened: true, pack: true }));
  // the peel strips (hidden inside the fruit until it's gone): 4 strips from the cup to the stem end
  for (const a of [45, 135, 225, 315]) {
    const pts = [], rs = [];
    for (let i = 0; i < 8; i++) {
      const t = 0.16 + (i / 7) * 0.78, fr = banFrame(t), R = banR(t);
      const dir = fr.side.clone().multiplyScalar(Math.cos(a * DEG)).addScaledVector(fr.up, Math.sin(a * DEG));
      pts.push(banC(t).addScaledVector(dir, R * 0.5).toArray()); rs.push(R * 0.24);
    }
    parts.push(curve(pts, 0, 0, 0, 0, 'produce-bananaskin', { rs, seg: 8, ripen: true, opened: true, pack: true, col: false }));
  }
  return parts;
}

// ---------- navel orange ----------
const ORANGE = (() => {
  const pts = [[0, 0.0006], [0.008, 0.0004], [0.0135, 0.0016]];
  for (let i = 3; i <= 15; i++) { const ph = -Math.PI / 2 + (i / 16) * Math.PI; pts.push([0.0402 * Math.cos(ph), 0.041 + 0.041 * Math.sin(ph)]); }
  pts.push([0.0042, 0.0814], [0.002, 0.0803], [0, 0.0799]);
  return pts;
})();
// a peel "cup" / peel chip: outer profile (peel) up to the rim, then back down the inside (pith)
function peelCup(R, Hc, yTop, thick, n = 8) {
  const end = Math.asin(Math.max(-1, Math.min(1, (yTop - Hc) / Hc)));
  const out = [], inn = [];
  for (let i = 0; i <= n; i++) { const ph = -Math.PI / 2 + (i / n) * (end + Math.PI / 2); out.push([R * Math.cos(ph), Hc + Hc * Math.sin(ph)]); }
  for (let i = n; i >= 0; i--) { const ph = -Math.PI / 2 + (i / n) * (end + Math.PI / 2); inn.push([(R - thick) * Math.cos(ph), Hc + (Hc - thick) * Math.sin(ph)]); }
  out[0][0] = 0; inn[inn.length - 1][0] = 0;
  return [...out, ...inn];
}

// ---------- Bartlett pear ----------
const PEAR = [[0, 0.0045], [0.008, 0.0032], [0.016, 0.001], [0.024, 0.0018], [0.0302, 0.0062], [0.0342, 0.0142], [0.0362, 0.0242], [0.0364, 0.032], [0.0354, 0.041],
  [0.0326, 0.05], [0.0283, 0.0588], [0.0238, 0.0668], [0.0207, 0.0748], [0.0187, 0.0828], [0.0166, 0.0898], [0.0136, 0.0958], [0.0088, 0.0998], [0.0042, 0.1013], [0, 0.1013]];
const PEAR_CORE = [[0, 0.004], [0.008, 0.006], [0.0118, 0.015], [0.0128, 0.03], [0.0112, 0.045], [0.0094, 0.06], [0.0082, 0.075], [0.0076, 0.09], [0.0042, 0.0985], [0, 0.0995]];

// ---------- Roma tomato (lathe along its length, laid on its side) ----------
const ROMA = [[0, 0.0005], [0.006, 0.0012], [0.012, 0.0035], [0.017, 0.0075], [0.0205, 0.013], [0.0228, 0.02], [0.024, 0.029], [0.0242, 0.038], [0.0238, 0.047],
  [0.0228, 0.055], [0.0205, 0.062], [0.0168, 0.0675], [0.011, 0.071], [0.006, 0.0715], [0.0025, 0.0705], [0, 0.0702]];

// ---------- Hass avocado ----------
const AVO = [[0, 0.0008], [0.0095, 0.0018], [0.0175, 0.0048], [0.0243, 0.0098], [0.0292, 0.0165], [0.0322, 0.0245], [0.033, 0.033], [0.0322, 0.042], [0.03, 0.051],
  [0.0268, 0.0605], [0.0228, 0.07], [0.0182, 0.079], [0.0128, 0.0868], [0.0072, 0.0925], [0.003, 0.0962], [0, 0.0975]];
// a cut half lying cut-side up: a bowl (vertical axis, stretched along x). r = half-width, d = depth
function avoFleshProfile(r, d) {
  const pts = [];
  for (let i = 0; i <= 9; i++) { const ph = (i / 9) * Math.PI / 2; pts.push([r * Math.sin(ph), 0.0025 + (d - 0.0025) * (1 - Math.cos(ph))]); }
  for (const k of [0.82, 0.62, 0.42, 0.22, 0]) pts.push([r * k, d + (1 - k) * 0.0022]); // barely domed cut face
  return pts;
}
function avoShellProfile(R, d, thick) {
  const out = [], inn = [];
  for (let i = 0; i <= 8; i++) { const ph = (i / 8) * Math.PI / 2; out.push([R * Math.sin(ph), d * (1 - Math.cos(ph))]); }
  for (let i = 8; i >= 0; i--) { const ph = (i / 8) * Math.PI / 2; inn.push([(R - thick) * Math.sin(ph), thick + (d - thick) * (1 - Math.cos(ph))]); }
  return [...out, ...inn];
}
function avoHalf(x, z, withPit, eatTag) {
  const S = 1.36, r = 0.031, d = 0.0285;
  const parts = [
    lathe(avoShellProfile(r + 0.0012, d, 0.0016), x, 0, z, 'produce-avoshell', { seg: 32, scale: [S, 1, 1], opened: true, pack: true }),
    lathe(avoFleshProfile(r - 0.0006, d - 0.0006), x, 0, z, 'produce-avoflesh:' + (withPit ? 'pit' : 'cavity'), { seg: 32, scale: [S, 1, 1], uv: 'wrap', eat: eatTag, col: false }),
  ];
  if (withPit) parts.push(sph(0.0168, x + 0.006, d - 0.002, z, 'produce-avopit', { seg: 24, scale: [1.12, 0.95, 1], opened: true, pack: true, col: false }));
  return parts;
}

// ---------- watermelon ----------
const MELON_WHOLE = (() => { const p = []; for (let i = 0; i <= 18; i++) { const ph = -Math.PI / 2 + (i / 18) * Math.PI; p.push([0.125 * Math.pow(Math.cos(ph), 0.92), 0.135 * (1 + Math.sin(ph))]); } return p; })();
function melonHalfProfile() {
  const { Rb, hb } = MELON, top = hb - 0.012, pts = [];
  for (let i = 0; i <= 12; i++) { const ph = (i / 12) * Math.PI / 2; pts.push([Rb * Math.sin(ph), top * (1 - Math.cos(ph))]); }
  pts.push([Rb - 0.0025, hb - 0.0112], [Rb - 0.006, hb - 0.0102], [Rb - 0.013, hb - 0.0088]);
  const rr0 = Rb - 0.013;
  for (const k of [0.8, 0.6, 0.4, 0.2, 0]) pts.push([rr0 * k, hb - 0.0088 * k]);
  return pts;
}

// ---------- russet potato (along its length) ----------
const POTATO = [[0, 0.001], [0.009, 0.0022], [0.017, 0.0065], [0.024, 0.013], [0.029, 0.021], [0.0325, 0.032], [0.0338, 0.045], [0.034, 0.058], [0.0335, 0.07],
  [0.0322, 0.081], [0.0298, 0.091], [0.0258, 0.1], [0.0195, 0.1075], [0.011, 0.1125], [0.004, 0.1145], [0, 0.115]];
// centered on its middle, lying along x
function potatoBody(mat, o = {}) {
  return lathe(POTATO, 0.0575, 0, 0, mat, { seg: 30, rot: [0, 0, 90], scale: [0.85, 1, 0.95], ...o });
}

// ---------- romaine heart: leaves (stretched lathes) around a core, lying along +x from the root ----------
const LEAF = [[0, 0], [0.006, 0.004], [0.0085, 0.02], [0.0115, 0.05], [0.0155, 0.09], [0.0198, 0.13], [0.0228, 0.165], [0.024, 0.19], [0.0222, 0.208], [0.0172, 0.22], [0.0092, 0.226], [0, 0.228]];
const HEART_YC = 0.0325;
function romaineHeart(mode) {
  const single = mode === 'single';
  const parts = [];
  const leaves = [
    [45, 0.0115, 1, 1, 5, 1, 'outer'], [315, 0.0115, 1, 0.99, 5, 2, 'outer'], [135, 0.0115, 1, 1, 4, 3, 'outer'], [225, 0.0115, 1, 0.98, 4, 4, 'outer'],
    [0, 0.0065, 0.82, 0.96, 3, 5, 'inner'], [120, 0.0065, 0.82, 0.95, 3, 6, 'inner'], [240, 0.0065, 0.82, 0.95, 3, 7, 'inner'], [60, 0, 0.6, 0.9, 0, 8, 'inner'],
  ];
  for (const [aDeg, d, rs, ls, splay, eatN, kind] of leaves) {
    const a = aDeg * DEG, o = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
    const dir = new THREE.Vector3(1, 0, 0).addScaledVector(o, Math.tan(splay * DEG)).normalize();
    const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    // roll so the midrib (u = 0, local +z) faces outward
    const zAfter = new THREE.Vector3(0, 0, 1).applyQuaternion(q1);
    const want = o.clone().addScaledVector(dir, -o.dot(dir)).normalize();
    const ang = Math.atan2(new THREE.Vector3().crossVectors(zAfter, want).dot(dir), zAfter.dot(want));
    const q = new THREE.Quaternion().setFromAxisAngle(dir, ang).multiply(q1);
    parts.push(lathe(LEAF, 0.003, HEART_YC + d * Math.cos(a), d * Math.sin(a), 'produce-romaine:' + kind, { seg: 20, scale: [rs, ls, rs], rot: qToRot(q), col: false, ...(single ? { eat: eatN } : {}) }));
  }
  // the cut root end (pale, a little brown) stays as the leftover stub
  parts.push(cyl(0.0135, 0.03, 0.015, HEART_YC, 0, 'produce-romainecore', { seg: 18, rot: [0, 0, 90], uv: 'fit', ...(single ? { pack: true } : { col: false }) }));
  return parts;
}

// =====================================================================================
// the items
// =====================================================================================
const produceFood = (o) => ({ kind: 'food', raw: false, rawRisk: 0, units: 0, unitId: null, ripen: null, ...o });

export default [
  // ------------------------------------------------------------------ apples (bag)
  {
    id: 'produce-apple-gala-3lb', aisle: 'produce', name: 'Gala Apples, 3 lb Bag', brand: 'Orchard Lane', price: 4.49, mass: 1.46,
    rating: 4.6, reviews: 5291,
    blurb: 'Eight sweet, crisp Washington Galas in a stand-up pouch with a handle. Keeps about 3 weeks on the counter, 6 in the fridge.',
    quotes: ['"Way cheaper per apple than buying them loose, and they were all firm."', '"Great lunchbox size. Only one had a tiny bruise."'],
    food: produceFood({
      eat: { kcal: 0, waterL: 0 }, netKg: 0, bites: 1, bite: 'none', open: null,
      units: 8, unitId: 'produce-apple-gala',
      keep: 'room', shelf: { room: 21, fridge: 42, freezer: 240, opened: 0 },
      taste: ['Crisp and sweet.'], sound: 'crunch', leftover: 'keep',
    }),
    build() {
      const W = 0.25, Hb = 0.212, D = 0.092;
      const parts = [
        box(W, Hb, D, 0, Hb / 2, 0, 'produce-film', { round: 0.014, pack: true }),
        box(0.226, 0.19, 0.0006, 0, 0.108, D / 2 + 0.0004, 'label:produce-applebag-front', { uv: 'fit', col: false, pack: true }),
        box(0.226, 0.19, 0.0006, 0, 0.108, -D / 2 - 0.0004, 'label:produce-applebag-back', { uv: 'fit', col: false, pack: true, rot: [0, 180, 0] }),
        box(W, 0.05, 0.004, 0, Hb + 0.025, 0, 'label:produce-applebag-header', { uv: 'fit', col: false, pack: true }),
        box(W - 0.02, 0.012, 0.03, 0, Hb + 0.002, 0, 'produce-film', { round: 0.005, col: false, pack: true }),
      ];
      // 3 on the bottom, 2 nested in the middle, 3 on top (taken out from the top first)
      const spots = [[-0.078, 0.038, 0.004], [0, 0.0375, -0.003], [0.078, 0.038, 0.002], [-0.039, 0.101, -0.002], [0.039, 0.1, 0.003], [-0.078, 0.164, 0.001], [0, 0.163, -0.002], [0.078, 0.165, 0.003]];
      const rand = mulberry32(8);
      spots.forEach(([x, y, z], i) => {
        const s = 0.96 + rand() * 0.06;
        parts.push(...bagApple(i, [x, y, z], [(rand() - 0.5) * 50, rand() * 360, (rand() - 0.5) * 50], s));
      });
      return { mass: 1.46, parts };
    },
  },

  // ------------------------------------------------------------------ bananas
  {
    id: 'produce-banana-bunch', aisle: 'produce', name: 'Bananas, Bunch of 6', brand: 'Tierra Dorada', price: 1.65, mass: 1.1,
    rating: 4.5, reviews: 12873,
    blurb: 'A hand of six Cavendish bananas, about 2.4 lb, yellow with green tips. Ripe in 1-2 days on the counter; refrigerate once ripe to slow them down (the peel darkens).',
    quotes: ['"Perfectly green-tipped. Ready two days later."', '"Six bananas for less than two bucks. Can\'t beat it."'],
    food: produceFood({
      eat: { kcal: 0, waterL: 0 }, netKg: 0, bites: 1, bite: 'none', open: null,
      units: 6, unitId: 'produce-banana', ripen: { colors: BANANA_RIPEN },
      keep: 'room', shelf: { room: 6, fridge: 9, freezer: 75, opened: 0 },
      taste: ['Sweet and creamy.'], sound: 'soft', leftover: 'keep',
    }),
    build() {
      // four on the bottom, two nested on top, all coming out of one crown
      const lay = [[-0.045, 0], [-0.015, 0], [0.015, 0], [0.045, 0], [-0.03, 0.03], [0.03, 0.03]];
      const parts = [];
      const cx = BAN_STEM_TIP.x + 0.004;
      lay.forEach(([z, y], i) => {
        const yaw = z * 125, P = new THREE.Vector3(cx, BAN_STEM_TIP.y + 0.004 + y, z);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw * DEG);
        const off = BAN_STEM_TIP.clone().applyQuaternion(q);
        parts.push(...unitOf(xf(bananaParts('unit', i === 5), P.sub(off).toArray(), [0, yaw, 0]), i));
      });
      parts.push(box(0.022, 0.046, 0.112, cx + 0.009, BAN_STEM_TIP.y + 0.021, 0, 'produce-stem:banana', { round: 0.009, pack: true }));
      parts.push(box(0.003, 0.038, 0.1, cx + 0.0205, BAN_STEM_TIP.y + 0.021, 0, 'produce-stem:tip', { round: 0.001, col: false, pack: true }));
      return { mass: 1.1, parts };
    },
  },
  {
    id: 'produce-banana', aisle: 'produce', name: 'Banana', brand: 'Tierra Dorada', price: 0.27, mass: 0.18,
    rating: 4.6, reviews: 9640,
    blurb: 'One medium Cavendish banana (7-8 in). Ripens on the counter: green tips today, yellow tomorrow, sweet and spotty in a few days.',
    quotes: ['"Exactly as ripe as I wanted."', '"Bought one for the road. It was a good banana."'],
    food: produceFood({
      eat: { kcal: 105, waterL: 0.088, proteinG: 1.3, carbsG: 27, sugarG: 14.4, fatG: 0.4, fiberG: 3.1, sodiumMg: 1, caffeineMg: 0 },
      netKg: 0.118, bites: 7, bite: 'dent', open: 'peel',
      ripen: { colors: BANANA_RIPEN },
      keep: 'room', shelf: { room: 6, fridge: 9, freezer: 75, opened: 1 },
      taste: ['Sweet, soft and creamy.', 'Perfectly ripe. Tastes like banana bread smells.', 'A little starchy still, but good.'],
      sound: 'soft', leftover: 'keep',
    }),
    build() { return { mass: 0.18, parts: bananaParts('single', true) }; },
  },

  // ------------------------------------------------------------------ orange
  {
    id: 'produce-orange-navel', aisle: 'produce', name: 'Navel Orange, Large', brand: 'Sunbarrow Groves', price: 1.25, mass: 0.23,
    rating: 4.5, reviews: 3318,
    blurb: 'A large seedless California navel, about 3 1/4 in across. Peels easily into 10 segments. Keeps 10 days on the counter, 3-4 weeks in the fridge.',
    quotes: ['"So juicy it ran down my wrist."', '"Easy to peel, zero seeds, sweet with a little tang."'],
    food: produceFood({
      eat: { kcal: 81, waterL: 0.143, proteinG: 1.5, carbsG: 20.6, sugarG: 14, fatG: 0.25, fiberG: 3.6, sodiumMg: 2, caffeineMg: 0 },
      netKg: 0.165, bites: 10, bite: 'hide', open: 'peel',
      keep: 'room', shelf: { room: 10, fridge: 28, freezer: 120, opened: 1 },
      taste: ['Sweet, bright and juicy.', 'Juice everywhere. Worth it.', 'Tangy-sweet, really fresh.'],
      sound: 'soft', leftover: 'keep',
    }),
    build() {
      const parts = [
        lathe(ORANGE, 0, 0, 0, 'produce-orangepeel', { seg: 40, closed: true }),
        sph(0.0062, 0, 0.0795, 0, 'produce-orangepeel:navel', { seg: 14, scale: [1, 0.42, 1], col: false, closed: true }),
        box(0.021, 0.015, 0.0005, 0, 0.0645, 0.0336, 'label:produce-sticker-orange', { uv: 'fit', col: false, closed: true, rot: [-35, 0, 0] }),
        // what's left of the peel: the bottom cup you peel it into + a few pieces in it
        lathe(peelCup(0.0396, 0.0406, 0.046, 0.0042), 0, 0.0004, 0, 'produce-orangecup', { seg: 36, opened: true, pack: true }),
      ];
      // 10 segments around a pale core (eaten one at a time)
      for (let k = 0; k < 10; k++) {
        const th = k * 36 + 8;
        parts.push(sph(0.036, 0.019 * Math.cos(th * DEG), 0.0415, -0.019 * Math.sin(th * DEG), 'produce-orangeflesh', { seg: 20, scale: [0.46, 1.0, 0.37], rot: [0, th, 0], col: false, eat: k + 1 }));
      }
      parts.push(sph(0.029, 0, 0.0415, 0, 'produce-orangeflesh:pith', { seg: 18, scale: [1, 1.2, 1], col: false, eat: 10 }));
      parts.push(sph(0.0365, 0, 0.0415, 0, 'produce-orangeflesh', { vis: false, eat: 10 }));
      const chip = peelCup(0.033, 0.033, 0.009, 0.0035, 8);
      parts.push(lathe(chip, 0.008, 0.0145, 0.004, 'produce-orangecup', { seg: 18, rot: [180, 0, 18], col: false, leftover: true }));
      parts.push(lathe(chip, -0.009, 0.006, -0.006, 'produce-orangecup', { seg: 18, rot: [8, 40, -14], col: false, leftover: true }));
      parts.push(lathe(chip, 0.004, 0.022, -0.008, 'produce-orangecup', { seg: 18, rot: [160, 70, 30], col: false, leftover: true }));
      return { mass: 0.23, parts };
    },
  },

  // ------------------------------------------------------------------ pear
  {
    id: 'produce-pear-bartlett', aisle: 'produce', name: 'Bartlett Pear', brand: 'Tallpine Orchards', price: 0.75, mass: 0.19,
    rating: 4.4, reviews: 1407,
    blurb: 'A medium Pacific Northwest Bartlett. Ripens on the counter from green to buttery yellow in a few days; check the neck, it gives a little when ready.',
    quotes: ['"Bought green, perfect three days later."', '"Juicy, sweet, that classic pear smell."'],
    food: produceFood({
      eat: { kcal: 97, waterL: 0.143, proteinG: 0.6, carbsG: 25.9, sugarG: 16.6, fatG: 0.2, fiberG: 5.3, sodiumMg: 2, caffeineMg: 0 },
      netKg: 0.17, bites: 9, bite: 'dent', open: null,
      ripen: { colors: PEAR_RIPEN },
      keep: 'room', shelf: { room: 5, fridge: 12, freezer: 240, opened: 0 },
      taste: ['Buttery, sweet and super juicy.', 'Soft and floral. Perfectly ripe.', 'A little gritty, very sweet.'],
      sound: 'soft', leftover: 'keep',
    }),
    build() {
      return { mass: 0.19, parts: [
        lathe(PEAR, 0, 0, 0, 'produce-pear', { seg: 36, uv: 'wrap', eat: true, ripen: true }),
        lathe(PEAR_CORE, 0, 0, 0, 'produce-core:pear', { seg: 16, leftover: true }),
        curve([[0, 0.0985, 0], [0.0012, 0.108, 0], [0.004, 0.118, 0.001], [0.0085, 0.124, 0.002]], 0.0017, 0, 0, 0, 'produce-stem', { rs: [0.0021, 0.0017, 0.0016, 0.0018], seg: 7, col: false, pack: true }),
        // the sticker sits low on the side (you bite higher up)
        box(0.021, 0.015, 0.0005, 0, 0.027, 0.0367, 'label:produce-sticker-pear', { uv: 'fit', col: false, eat: true, rot: [1, 0, 0] }),
      ] };
    },
  },

  // ------------------------------------------------------------------ strawberries
  {
    id: 'produce-strawberries-1lb', aisle: 'produce', name: 'Strawberries, 1 lb Clamshell', brand: 'Berry Hollow Farms', price: 3.49, mass: 0.48,
    rating: 4.3, reviews: 8822,
    blurb: 'About 16 large California strawberries in a vented PET clamshell. Keep refrigerated and rinse right before eating; they last about 5 days.',
    quotes: ['"Red all the way through, actually sweet."', '"Check the bottom ones before you buy. These were all good."'],
    food: produceFood({
      eat: { kcal: 139, waterL: 0.396, proteinG: 2.9, carbsG: 33.4, sugarG: 21.3, fatG: 1.3, fiberG: 8.7, sodiumMg: 4, caffeineMg: 0 },
      netKg: 0.435, bites: 24, bite: 'hide', open: 'lid',
      keep: 'fridge', shelf: { room: 2, fridge: 5, freezer: 300, opened: 0 },
      taste: ['Sweet and juicy, really ripe.', 'Bright, a little tart.', 'Tastes like summer.'],
      sound: 'soft', leftover: 'keep',
    }),
    build() {
      const W = 0.186, D = 0.12, Hb = 0.07, t = 0.0018, P = 'clearplastic';
      const parts = [
        box(W, t, D, 0, t / 2, 0, P, { col: false, pack: true }),
        box(W, Hb, t, 0, Hb / 2, D / 2 - t / 2, P, { col: false, pack: true }),
        box(W, Hb, t, 0, Hb / 2, -D / 2 + t / 2, P, { col: false, pack: true }),
        box(t, Hb, D - 2 * t, W / 2 - t / 2, Hb / 2, 0, P, { col: false, pack: true }),
        box(t, Hb, D - 2 * t, -W / 2 + t / 2, Hb / 2, 0, P, { col: false, pack: true }),
        box(W + 0.008, 0.002, D + 0.008, 0, Hb - 0.001, 0, P, { col: false, pack: true, round: 0.0009 }),       // the rim flange
        box(W, Hb, D, 0, Hb / 2, 0, P, { vis: false, pack: true }),                                              // tray collision
        box(0.15, 0.036, 0.0006, 0, 0.027, D / 2 + 0.0004, 'label:produce-berry-front', { uv: 'fit', col: false, pack: true }),
        box(0.0006, 0.055, 0.085, W / 2 + 0.0004, 0.034, 0, 'label:produce-berry-side', { uv: 'fit', col: false, pack: true }),
        // lid: closed on top, or flipped back on its hinge
        box(W + 0.006, 0.017, D + 0.006, 0, Hb + 0.0085, 0, P, { round: 0.006, closed: true }),
        box(0.13, 0.0006, 0.085, 0, Hb + 0.0172, 0.004, 'label:produce-berry-lid', { uv: 'fit', col: false, closed: true }),
        box(W + 0.006, 0.017, D + 0.006, 0, Hb - 0.0085, -D - 0.003, P, { round: 0.006, col: false, opened: true }),
        box(W * 0.9, 0.003, 0.004, 0, Hb, -D / 2 - 0.0015, P, { col: false, pack: true }),                         // hinge
      ];
      // 16 berries: 8 on the bottom, 8 on top (eaten top first)
      const rand = mulberry32(2024);
      const BERRY = [[0, 0], [0.004, 0.0025], [0.0085, 0.008], [0.0125, 0.0145], [0.0155, 0.021], [0.0175, 0.027], [0.0185, 0.032], [0.0182, 0.036], [0.016, 0.0395], [0.0115, 0.0418], [0.006, 0.0425], [0, 0.0415]];
      const spots = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) spots.push({ x: -0.066 + i * 0.044 + (rand() - 0.5) * 0.006, z: -0.026 + j * 0.052 + (rand() - 0.5) * 0.006, y: 0.0215, tilt: 80 + rand() * 25, top: false });
      const topSpots = [[-0.044, 0], [0, 0.002], [0.044, -0.001], [-0.068, 0.028], [-0.022, -0.027], [0.022, 0.027], [0.068, -0.026], [0.066, 0.03]];
      for (const [x, z] of topSpots) spots.push({ x: x + (rand() - 0.5) * 0.006, z: z + (rand() - 0.5) * 0.006, y: 0.049, tilt: rand() < 0.35 ? 10 + rand() * 30 : 70 + rand() * 40, top: true });
      let eatN = 9;
      let topN = 1;
      for (const sp of spots) {
        const s = 0.88 + rand() * 0.17, n = sp.top ? topN++ : eatN++;
        const berry = [
          lathe(BERRY.map(([r, y]) => [r * s, y * s]), 0, -0.022 * s, 0, 'produce-strawberry', { seg: 24, col: false, eat: n }),
          cyl(0.0175 * s, 0.0004, 0, 0.0198 * s, 0, 'produce-calyx', { seg: 18, uv: 'fit', col: false, eat: n }),
          cyl(0.0016, 0.007, 0.0004, 0.0232 * s, 0, 'produce-sepal', { seg: 6, col: false, eat: n, rot: [0, 0, 12] }),
        ];
        const yLift = sp.top ? 0 : (s - 1) * 0.0185;
        parts.push(...xf(berry, [sp.x, sp.y + yLift, sp.z], [0, rand() * 360, sp.tilt]));
      }
      return { mass: 0.48, parts };
    },
  },

  // ------------------------------------------------------------------ grapes
  {
    id: 'produce-grapes-red', aisle: 'produce', name: 'Red Seedless Grapes, ~2 lb Bag', brand: 'Vinecrest', price: 5.48, mass: 0.92,
    rating: 4.4, reviews: 4105,
    blurb: 'About 2 lb of crisp red seedless grapes on the stem, in a vented zip-top pouch. Keep refrigerated and rinse right before eating.',
    quotes: ['"Crunchy, sweet, barely any mushy ones."', '"Freeze them. Trust me."'],
    food: produceFood({
      eat: { kcal: 614, waterL: 0.716, proteinG: 6.4, carbsG: 161, sugarG: 138, fatG: 1.4, fiberG: 8, sodiumMg: 18, caffeineMg: 0 },
      netKg: 0.89, bites: 60, bite: 'hide', open: null,
      keep: 'fridge', shelf: { room: 2, fridge: 10, freezer: 300, opened: 0 },
      taste: ['Crisp, cold and sweet.', 'Pop. Sweet with a little tart skin.', 'Super crunchy grapes.'],
      sound: 'crunch', leftover: 'keep',
    }),
    build() {
      const W = 0.23, Hb = 0.22, D = 0.095;
      const parts = [
        box(W, Hb, D, 0, Hb / 2, 0, 'produce-film', { round: 0.016, pack: true }),
        box(0.216, 0.2, 0.0006, 0, 0.11, D / 2 + 0.0004, 'label:produce-grapebag-front', { uv: 'fit', col: false, pack: true }),
        box(0.216, 0.2, 0.0006, 0, 0.11, -D / 2 - 0.0004, 'label:produce-grapebag-back', { uv: 'fit', col: false, pack: true, rot: [0, 180, 0] }),
        box(W, 0.04, 0.004, 0, Hb + 0.02, 0, 'label:produce-grapebag-header', { uv: 'fit', col: false, pack: true }),
        box(W - 0.02, 0.012, 0.03, 0, Hb + 0.002, 0, 'produce-film', { round: 0.005, col: false, pack: true }),
      ];
      // grapes against the front + across the top (what you can see), painted grapes behind them
      const rand = mulberry32(77), g = [], R = 0.0112;
      const ok = (p) => g.every((q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 > (R * 1.82) ** 2);
      const topY = (x) => 0.168 + 0.012 * Math.cos((x / 0.1) * 1.4);
      for (let k = 0; k < 4000 && g.length < 62; k++) { const x = (rand() - 0.5) * 0.19, y = 0.013 + rand() * 0.16, p = [x, y, 0.029 + (rand() - 0.5) * 0.008]; if (y < topY(x) && ok(p)) g.push(p); }
      for (let k = 0; k < 3000 && g.length < 84; k++) { const x = (rand() - 0.5) * 0.19, z = (rand() - 0.5) * 0.062, p = [x, topY(x) + (rand() - 0.5) * 0.008, z]; if (ok(p)) g.push(p); }
      for (let k = 0; k < 3000 && g.length < 100; k++) { const x = (rand() < 0.5 ? -1 : 1) * (0.088 + rand() * 0.008), p = [x, 0.013 + rand() * 0.15, (rand() - 0.5) * 0.06]; if (ok(p)) g.push(p); }
      g.sort((a, b) => b[1] - a[1]);
      const vars = ['a', 'b', 'c', 'a', 'b'];
      g.forEach((p, i) => parts.push(sph(R * (0.92 + rand() * 0.14), p[0], p[1], p[2], 'produce-grape:' + vars[i % 5], { seg: 12, scale: [1, 1.13, 1], rot: [(rand() - 0.5) * 60, 0, (rand() - 0.5) * 60], col: false, eat: i + 1 })));
      const n = g.length, at = (y) => Math.max(1, g.filter((p) => p[1] > y).length);
      parts.push(box(0.17, 0.055, 0.044, 0, 0.14, -0.004, 'produce-grapefill', { round: 0.012, col: false, eat: at(0.14) }));
      parts.push(box(0.17, 0.06, 0.044, 0, 0.083, -0.004, 'produce-grapefill', { round: 0.012, col: false, eat: at(0.083) }));
      parts.push(box(0.17, 0.05, 0.044, 0, 0.034, -0.004, 'produce-grapefill', { round: 0.012, col: false, eat: n }));
      // stems peeking out on top (eaten around), and the bare stems left in the bottom of the bag
      const stem = (pts, o) => curve(pts, 0.0016, 0, 0, 0, 'produce-stem:green', { seg: 6, col: false, ...o });
      parts.push(stem([[-0.06, 0.17, 0.0], [-0.04, 0.185, 0.01], [-0.018, 0.182, 0.004], [0.004, 0.19, -0.01]], { eat: 3 }));
      parts.push(stem([[0.03, 0.172, -0.02], [0.05, 0.187, -0.008], [0.072, 0.18, 0.006]], { eat: 6 }));
      parts.push(stem([[-0.07, 0.006, 0.01], [-0.03, 0.01, -0.012], [0.01, 0.007, 0.006], [0.05, 0.011, -0.01], [0.075, 0.006, 0.012]], { leftover: true }));
      parts.push(stem([[-0.05, 0.006, -0.02], [-0.02, 0.012, 0.0], [0.03, 0.007, 0.018]], { leftover: true }));
      return { mass: 0.92, parts };
    },
  },

  // ------------------------------------------------------------------ tomato
  {
    id: 'produce-tomato-roma', aisle: 'produce', name: 'Roma Tomato', brand: 'Harbor Market', price: 0.22, mass: 0.062,
    rating: 4.2, reviews: 2210,
    blurb: 'One firm, meaty Roma (plum) tomato, about 2.8 in long. Fewer seeds, great for sauce and slicing. Keep on the counter, stem side down, out of the sun.',
    quotes: ['"Firm and red, perfect for pico."', '"Better than the ones in the clamshell."'],
    food: produceFood({
      eat: { kcal: 11, waterL: 0.058, proteinG: 0.5, carbsG: 2.4, sugarG: 1.6, fatG: 0.1, fiberG: 0.7, sodiumMg: 3, caffeineMg: 0 },
      netKg: 0.06, bites: 4, bite: 'dent', open: null,
      ripen: { colors: TOMATO_RIPEN },
      keep: 'room', shelf: { room: 5, fridge: 10, freezer: 60, opened: 0 },
      taste: ['Fresh and tomato-y, a little sweet.', 'Juicy, mild and meaty.'],
      sound: 'soft', leftover: 'keep',
    }),
    build() {
      const L = 0.0715, r = 0.0242 * 0.94;
      const parts = [
        lathe(ROMA, L / 2, r, 0, 'produce-tomato', { seg: 32, uv: 'wrap', rot: [0, 0, 90], scale: [0.94, 1, 1], eat: true, ripen: true }),
        // the stem end you leave behind
        lathe([[0, 0], [0.008, 0.0008], [0.0112, 0.003], [0.0108, 0.0045], [0, 0.0048]], -L / 2 + 0.0045, r, 0, 'produce-tomato', { seg: 16, rot: [0, 0, 90], leftover: true }),
        cyl(0.0022, 0.006, -L / 2 - 0.0018, r, 0, 'produce-sepal', { seg: 8, rot: [0, 0, 90], col: false, pack: true }),
        box(0.02, 0.0005, 0.0145, 0.008, 2 * r - 0.0001, 0, 'label:produce-sticker-tomato', { uv: 'fit', col: false, eat: true }),
      ];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.3, dy = Math.cos(a), dz = Math.sin(a);
        const at = (dx, rho) => [-L / 2 + dx, r + dy * rho * 0.94, dz * rho];
        parts.push(curve([at(-0.0012, 0.0016), at(-0.0012, 0.007), at(0.0002, 0.0118), at(0.0036, 0.0166)], 0.0011, 0, 0, 0, 'produce-sepal', { rs: [0.0014, 0.0012, 0.001, 0.0005], seg: 5, col: false, pack: true }));
      }
      return { mass: 0.062, parts };
    },
  },

  // ------------------------------------------------------------------ cucumber
  {
    id: 'produce-cucumber-english', aisle: 'produce', name: 'English Cucumber', brand: 'Glasshouse Greens', price: 1.69, mass: 0.42,
    rating: 4.6, reviews: 2752,
    blurb: 'One long, seedless greenhouse cucumber (about 12-13 in), shrink-wrapped to stay crisp. Thin skin, no peeling needed. Refrigerate; good for about 10 days.',
    quotes: ['"Crisp all the way to the end."', '"The plastic wrap keeps it fresh way longer than regular cukes."'],
    food: produceFood({
      eat: { kcal: 60, waterL: 0.381, proteinG: 2.6, carbsG: 14.5, sugarG: 6.7, fatG: 0.4, fiberG: 2, sodiumMg: 8, caffeineMg: 0 },
      netKg: 0.4, bites: 20, bite: 'dent', open: 'tear',
      keep: 'fridge', shelf: { room: 3, fridge: 10, freezer: 1, opened: 5 },
      taste: ['Cool, crisp and fresh.', 'Watery-crunchy. Super refreshing.'],
      sound: 'crunch', leftover: 'keep',
    }),
    build() {
      const N = 10, rs = [0.0115, 0.0185, 0.0222, 0.0232, 0.0234, 0.0233, 0.0229, 0.0218, 0.0185, 0.0128], pts = [];
      for (let i = 0; i < N; i++) { const x = -0.155 + (i / (N - 1)) * 0.31, z = 0.006 * (1 - (x / 0.155) ** 2); pts.push([x, rs[i] + 0.0006, z]); }
      const wrap = rs.map((r) => r + 0.0007);
      const parts = [
        curve(pts, 0, 0, 0, 0, 'produce-cucumber', { rs, seg: 16, eat: true }),
        curve(pts, 0, 0, 0, 0, 'produce-film', { rs: wrap, seg: 16, col: false, closed: true }),
        cyl(0.0245, 0.044, -0.03, rs[4] + 0.0006, 0.0058, 'label:produce-cukeband', { seg: 40, uv: 'wrap', rot: [0, 0, 90], col: false, closed: true }),
        // the stem end you leave
        curve([pts[N - 2], [pts[N - 1][0] - 0.004, pts[N - 1][1], pts[N - 1][2]]], 0, 0, 0, 0, 'produce-cucumber:end', { rs: [rs[N - 2] * 0.92, rs[N - 1] * 0.95], seg: 14, leftover: true }),
      ];
      return { mass: 0.42, parts };
    },
  },

  // ------------------------------------------------------------------ avocado
  {
    id: 'produce-avocado-hass', aisle: 'produce', name: 'Hass Avocado, Large', brand: 'Ojo Verde', price: 1.29, mass: 0.2,
    rating: 4.1, reviews: 6033,
    blurb: 'One large Hass avocado. Ripens on the counter from green to purple-black in 3-5 days; it\'s ready when it gives a little. Cut in half with a knife and scoop.',
    quotes: ['"Perfect for guac in two days."', '"Nice buttery inside, small pit."'],
    food: produceFood({
      eat: { kcal: 227, waterL: 0.098, proteinG: 2.7, carbsG: 11.8, sugarG: 0.4, fatG: 21, fiberG: 9.2, sodiumMg: 11, caffeineMg: 0 },
      netKg: 0.136, bites: 8, bite: 'dent', open: 'knife',
      ripen: { colors: AVO_RIPEN },
      keep: 'room', shelf: { room: 5, fridge: 10, freezer: 150, opened: 1 },
      taste: ['Rich, buttery and nutty.', 'Creamy. Needs a little salt.'],
      sound: 'soft', leftover: 'keep',
    }),
    build() {
      const yc = 0.033 * 0.92;
      return { mass: 0.2, parts: [
        lathe(AVO, 0.049, yc, 0, 'produce-avoskin', { seg: 36, rot: [0, 0, 90], scale: [0.92, 1, 1], ripen: true, closed: true }),
        cyl(0.0032, 0.005, -0.0505, yc + 0.0004, 0, 'produce-stem', { seg: 8, rot: [0, 0, 90], col: false, closed: true }),
        box(0.021, 0.015, 0.0005, 0.012, 0.0558, 0.0186, 'label:produce-sticker-avocado', { uv: 'fit', col: false, closed: true, rot: [-56, 0, 0] }),
        // cut in half: one half where it lay, the half with the pit set down in front
        ...avoHalf(0.006, 0, false, true),
        ...avoHalf(0.004, 0.074, true, true),
      ] };
    },
  },

  // ------------------------------------------------------------------ watermelon
  {
    id: 'produce-watermelon-seedless', aisle: 'produce', name: 'Seedless Watermelon, Whole', brand: 'Sweet Acre', price: 6.99, mass: 8.0,
    rating: 4.5, reviews: 3876,
    blurb: 'A whole seedless watermelon, about 17-18 lb. Look for the creamy yellow field spot. Keeps 7-10 days on the counter; once cut, wrap and refrigerate.',
    quotes: ['"Thumped it, it sounded hollow, it was perfect."', '"Super sweet and red right up to the rind."'],
    food: produceFood({
      eat: { kcal: 1500, waterL: 4.57, proteinG: 30.5, carbsG: 377, sugarG: 310, fatG: 7.5, fiberG: 20, sodiumMg: 50, caffeineMg: 0 },
      netKg: 5.0, bites: 200, bite: 'dent', open: 'knife',
      keep: 'room', shelf: { room: 10, fridge: 18, freezer: 240, opened: 1 },
      taste: ['Ice-cold, crisp and sweet.', 'So juicy. Tastes like July.'],
      sound: 'crunch', leftover: 'keep',
    }),
    build() {
      const yc = 0.125 * 0.97, { Rb, hb } = MELON;
      const shell = avoShellProfile(Rb * 0.985, hb - 0.013, 0.013);
      return { mass: 8.0, parts: [
        lathe(MELON_WHOLE, 0.135, yc, 0, 'produce-melonrind', { seg: 44, rot: [0, 0, 90], scale: [0.97, 1, 1], closed: true }),
        curve([[-0.134, yc, 0], [-0.142, yc + 0.003, 0.002], [-0.148, yc + 0.009, 0.006]], 0.0035, 0, 0, 0, 'produce-stem:green', { rs: [0.0045, 0.0035, 0.004], seg: 8, col: false, closed: true }),
        box(0.05, 0.0006, 0.038, 0.012, 2 * yc - 0.0011, 0.022, 'label:produce-sticker-melon', { uv: 'fit', col: false, closed: true, rot: [10, 0, 0] }),
        // cut in half across the middle: one half where it lay (cut face up), the other set in front
        lathe(melonHalfProfile(), 0, 0, 0, 'produce-melonhalf', { seg: 48, uv: 'wrap', eat: true }),
        lathe(melonHalfProfile(), 0, 0, 0.25, 'produce-melonhalf', { seg: 48, uv: 'wrap', eat: true }),
        lathe(shell, 0, 0.001, 0, 'produce-melonshell', { seg: 40, leftover: true }),
        lathe(shell, 0, 0.001, 0.25, 'produce-melonshell', { seg: 40, leftover: true }),
      ] };
    },
  },

  // ------------------------------------------------------------------ baby carrots
  {
    id: 'produce-carrots-baby-1lb', aisle: 'produce', name: 'Baby-Cut Carrots, 1 lb Bag', brand: 'Crunch Valley', price: 1.59, mass: 0.465,
    rating: 4.5, reviews: 7714,
    blurb: 'A pound of washed, peeled, ready-to-eat baby-cut carrots (about 45). Keep refrigerated; good about 3 weeks unopened, 1-2 weeks after opening.',
    quotes: ['"Crunchy and sweet, not slimy at all."', '"Snack-drawer staple. Dip in ranch."'],
    food: produceFood({
      eat: { kcal: 159, waterL: 0.41, proteinG: 2.9, carbsG: 37.4, sugarG: 21.6, fatG: 0.6, fiberG: 13.2, sodiumMg: 354, caffeineMg: 0 },
      netKg: 0.454, bites: 60, bite: 'hide', open: 'tear',
      keep: 'fridge', shelf: { room: 1, fridge: 28, freezer: 300, opened: 12 },
      taste: ['Crunchy, cold and sweet.', 'Super crisp carrot.'],
      sound: 'crunch', leftover: 'keep',
    }),
    build() {
      const W = 0.17, H = 0.042, L = 0.25;
      const parts = [
        box(W, H, L, 0, H / 2, 0, 'produce-film', { round: 0.013, pack: true }),
        box(0.158, 0.0006, 0.232, 0, H + 0.0004, 0, 'label:produce-carrotbag-top', { uv: 'fit', col: false, pack: true }),
        box(0.158, 0.0006, 0.232, 0, 0.0007, 0, 'label:produce-carrotbag-bottom', { uv: 'fit', col: false, pack: true, rot: [0, 0, 180] }),
        box(0.166, 0.0016, 0.017, 0, H / 2, L / 2 + 0.0075, 'label:produce-carrotbag-seal', { uv: 'fit', col: false, pack: true, rot: [0, 180, 0] }),
        box(0.166, 0.0016, 0.017, 0, H / 2, -L / 2 - 0.0075, 'label:produce-carrotbag-seal', { uv: 'fit', col: false, closed: true }),
        box(0.164, 0.0012, 0.008, 0, H / 2, -L / 2 - 0.004, 'label:produce-carrotbag-torn', { uv: 'fit', col: false, opened: true }),
      ];
      const rand = mulberry32(46), c = [];
      for (let layer = 0; layer < 2; layer++) {
        for (let k = 0; k < 2200 && c.length < (layer ? 46 : 26); k++) {
          const x = (rand() - 0.5) * 0.11, z = (rand() - 0.5) * 0.2, yaw = (rand() - 0.5) * 70 + (rand() < 0.25 ? 90 : 0);
          if (c.every((q) => q.layer !== layer || (q.x - x) ** 2 + (q.z - z) ** 2 > 0.0182 ** 2 * (Math.abs(q.yaw - yaw) < 30 ? 1 : 2.4))) c.push({ x, z, yaw, layer });
        }
      }
      c.sort((a, b) => b.layer - a.layer || a.z - b.z);
      c.forEach((p, i) => {
        const len = 0.044 + rand() * 0.012, bend = (rand() - 0.5) * 0.004;
        const pts = [[-len / 2, 0, 0], [0, 0, bend], [len / 2, 0, 0]];
        const y = p.layer ? 0.026 + rand() * 0.004 : 0.0098;
        parts.push(curve(pts, 0, p.x, y, p.z, 'produce-carrot', { rs: [0.0068 + rand() * 0.001, 0.0088 + rand() * 0.0012, 0.0074], seg: 10, rot: [(rand() - 0.5) * 30, p.yaw, (rand() - 0.5) * 16], col: false, eat: i + 1 }));
      });
      return { mass: 0.465, parts };
    },
  },

  // ------------------------------------------------------------------ russet potatoes
  {
    id: 'produce-potatoes-russet-5lb', aisle: 'produce', name: 'Russet Potatoes, 5 lb Bag', brand: 'Basin Bluff Farms', price: 4.29, mass: 2.36,
    rating: 4.6, reviews: 6489,
    blurb: 'Ten U.S. No. 1 russets in a kraft paper bag with a window. The classic baking potato: fluffy inside, crisp skin. Store cool, dark and dry, not in the fridge.',
    quotes: ['"Big, clean, no green spots."', '"Paper bag keeps them from sprouting as fast."'],
    food: produceFood({
      eat: { kcal: 0, waterL: 0 }, netKg: 0, bites: 1, bite: 'none', open: null,
      units: 10, unitId: 'produce-potato-russet', raw: true,
      keep: 'room', shelf: { room: 30, fridge: 14, freezer: 1, opened: 0 },
      taste: ['Raw potato. Starchy.'], sound: 'crunch', leftover: 'keep',
    }),
    build() {
      const W = 0.25, Hb = 0.25, D = 0.13;
      const parts = [
        box(W, Hb, D, 0, Hb / 2, 0, 'label:produce-potatobag:matte', { uv: 'atlas', pack: true }),
        box(W - 0.004, Hb - 0.004, D - 0.004, 0, Hb / 2, 0, 'produce-kraftin', { col: false, pack: true }),
        // gusseted top: two sloped shoulders up to a flat fin with a die-cut handle
        box(W, 0.079, 0.002, 0, Hb + 0.0255, D / 4 + 0.0015, 'produce-kraft', { rot: [-50.7, 0, 0], col: false, pack: true }),
        box(W, 0.079, 0.002, 0, Hb + 0.0255, -D / 4 - 0.0015, 'produce-kraft', { rot: [50.7, 0, 0], col: false, pack: true }),
        cyl(0.05, 0.002, W / 2 - 0.001, Hb + 0.0167, 0, 'produce-kraft', { seg: 3, rot: [-90, 0, -90], scale: [1.5, 1, 0.667], col: false, pack: true }),
        cyl(0.05, 0.002, -W / 2 + 0.001, Hb + 0.0167, 0, 'produce-kraft', { seg: 3, rot: [-90, 0, -90], scale: [1.5, 1, 0.667], col: false, pack: true }),
        box(W, 0.06, 0.006, 0, Hb + 0.05 + 0.03, 0, 'label:produce-potatobag-fin:matte', { uv: 'fit', col: false, pack: true }),
      ];
      const spots = [
        [-0.062, 0.03, -0.032, 6], [0.062, 0.03, -0.03, -8], [-0.06, 0.03, 0.032, -5], [0.062, 0.031, 0.031, 10],
        [-0.078, 0.088, 0, 84], [0, 0.09, -0.002, 96], [0.078, 0.087, 0.002, 80],
        [-0.04, 0.146, -0.02, 20], [0.05, 0.147, 0.018, -15], [-0.02, 0.15, 0.035, 160],
      ];
      const rand = mulberry32(17);
      spots.forEach(([x, y, z, yaw], i) => {
        const s = 0.95 + rand() * 0.08;
        const pot = [
          { ...potatoBody('produce-potato', { col: false }), p: [0.0575 * s, 0, 0], scale: [0.85 * s, s, 0.95 * s] },
          box(0.1, 0.05, 0.058, 0, 0, 0, 'produce-potato', { vis: false, round: 0.022 }),
        ];
        parts.push(...unitOf(xf(pot, [x, y, z], [(rand() - 0.5) * 16, yaw, (rand() - 0.5) * 12]), i));
      });
      return { mass: 2.36, parts };
    },
  },
  {
    id: 'produce-potato-russet', aisle: 'produce', name: 'Russet Potato', brand: 'Basin Bluff Farms', price: 0.55, mass: 0.23,
    rating: 4.5, reviews: 1188,
    blurb: 'One medium-large russet (about half a pound). Bake, mash or fry it; it\'s not great raw. Store somewhere cool and dark.',
    quotes: ['"Baked up fluffy in an hour."', '"Good size, nice thin skin."'],
    food: produceFood({
      eat: { kcal: 182, waterL: 0.181, proteinG: 4.9, carbsG: 41.6, sugarG: 1.4, fatG: 0.2, fiberG: 3, sodiumMg: 12, caffeineMg: 0 },
      netKg: 0.23, bites: 12, bite: 'dent', open: null,
      raw: true, rawRisk: 0,
      keep: 'room', shelf: { room: 30, fridge: 14, freezer: 1, opened: 0 },
      taste: ['Raw potato: crunchy, starchy, kind of earthy. Better cooked.', 'Chalky and bland. This wants an oven.'],
      sound: 'crunch', leftover: 'remove',
    }),
    build() {
      const y = 0.034 * 0.85;
      return { mass: 0.23, parts: [potatoBody('produce-potato', { p: [0.0575, y, 0], uv: 'wrap', eat: true })] };
    },
  },

  // ------------------------------------------------------------------ romaine hearts
  {
    id: 'produce-romaine-hearts-3pk', aisle: 'produce', name: 'Romaine Hearts, 3 Count', brand: 'Greenfurrow', price: 3.99, mass: 0.522,
    rating: 4.4, reviews: 3902,
    blurb: 'Three crisp romaine hearts (18 oz) in a vented sleeve, trimmed and ready to chop. Keep refrigerated; best within a week to 10 days.',
    quotes: ['"Crunchy, sweet hearts, barely any outer leaves to toss."', '"Makes the best Caesar."'],
    food: produceFood({
      eat: { kcal: 0, waterL: 0 }, netKg: 0, bites: 1, bite: 'none', open: null,
      units: 3, unitId: 'produce-romaine-heart',
      keep: 'fridge', shelf: { room: 1, fridge: 10, freezer: 1, opened: 5 },
      taste: ['Crisp lettuce.'], sound: 'crunch', leftover: 'keep',
    }),
    build() {
      const W = 0.235, H = 0.074, L = 0.272;
      const parts = [
        box(W, H, L, 0, H / 2, 0, 'produce-film', { round: 0.016, pack: true }),
        box(0.218, 0.0006, 0.254, 0, H + 0.0004, 0, 'label:produce-romainebag-top', { uv: 'fit', col: false, pack: true }),
        box(0.218, 0.0006, 0.254, 0, 0.0007, 0, 'label:produce-romainebag-bottom', { uv: 'fit', col: false, pack: true, rot: [0, 0, 180] }),
        box(0.226, 0.0016, 0.016, 0, H / 2, L / 2 + 0.007, 'produce-film', { col: false, pack: true }),
        box(0.226, 0.0016, 0.016, 0, H / 2, -L / 2 - 0.007, 'produce-film', { col: false, pack: true }),
      ];
      // three hearts side by side, roots toward you
      [-0.074, 0, 0.074].forEach((x, i) => {
        const heart = [...romaineHeart('unit'), box(0.2, 0.062, 0.066, 0.115, HEART_YC, 0, 'produce-romaine', { vis: false, round: 0.02 })];
        parts.push(...unitOf(xf(heart, [x, 0.0012, 0.116], [0, 90, 0]), i));
      });
      return { mass: 0.522, parts };
    },
  },
  {
    id: 'produce-romaine-heart', aisle: 'produce', name: 'Romaine Heart', brand: 'Greenfurrow', price: 1.33, mass: 0.17, shop: false,
    rating: 4.4, reviews: 3902,
    blurb: 'One romaine heart from the 3-count bag: crunchy pale ribs, sweet leafy tips.',
    quotes: ['"Crunchy, sweet hearts."'],
    food: produceFood({
      eat: { kcal: 26, waterL: 0.147, proteinG: 1.9, carbsG: 5.1, sugarG: 1.8, fatG: 0.5, fiberG: 3.3, sodiumMg: 12, caffeineMg: 0 },
      netKg: 0.155, bites: 10, bite: 'hide', open: null,
      keep: 'fridge', shelf: { room: 1, fridge: 10, freezer: 1, opened: 0 },
      taste: ['Cold, crisp and watery-sweet.', 'Crunchy rib, leafy tip. Very fresh.'],
      sound: 'crunch', leftover: 'keep',
    }),
    build() {
      return { mass: 0.17, parts: xf([
        ...romaineHeart('single'),
        box(0.2, 0.065, 0.066, 0.115, HEART_YC, 0, 'produce-romaine', { vis: false, round: 0.02, eat: 8 }),
      ], [-0.115, 0, 0], [0, 0, 0]) };
    },
  },
];
