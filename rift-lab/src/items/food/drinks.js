// Drinks aisle: cans, PET bottles, glass bottles, a gallon jug, a juice box, and the multipacks they come in.
// (The 500 mL Clearwell water + its 24-pack live in _example.js.)
// Real sizes in meters, real weights in kg (whole thing as sold), 2026 US prices, label-accurate nutrition.
// Every package is printed in canvas 2D: made-up brands, real-looking Nutrition Facts panels, real UPC-A barcodes.

import * as THREE from 'three';
import { box, cyl, lathe, curve } from '../parts.js';
import { registerMaterial, registerPhysical, registerLabel, canvasTex, cached } from '../materials.js';
import { mulberry32 } from '../../core/noise.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const SANS = 'Inter, "DejaVu Sans", sans-serif';
const DISP = '"Inter Display", Inter, sans-serif';
const SERIF = '"Liberation Serif", "DejaVu Serif", serif';
const CHARTER = '"Bitstream Charter", "Liberation Serif", serif';
const F = (wt, px, fam = SANS, style = '') => `${style} ${wt} ${Math.max(1, px).toFixed(1)}px ${fam}`.trim();

// ============================================================================================
// drawing kit
// ============================================================================================
function T(ctx, s, x, y, font, color, o = {}) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.base || 'alphabetic';
  ctx.letterSpacing = (o.track || 0) + 'px';
  if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); x = 0; y = 0; }
  if (o.skew) { ctx.translate(x, y); ctx.transform(1, 0, o.skew, 1, 0, 0); x = 0; y = 0; }
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur ?? 12; ctx.shadowOffsetY = o.sy ?? 0; }
  if (o.stroke) {
    ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 6;
    if (o.max) ctx.strokeText(s, x, y, o.max); else ctx.strokeText(s, x, y);
    if (!o.keepShadow) ctx.shadowColor = 'transparent';
  }
  ctx.fillStyle = color;
  if (o.max) ctx.fillText(s, x, y, o.max); else ctx.fillText(s, x, y);
  ctx.restore();
}

function wrapText(ctx, str, x, y, maxW, lineH, font, color = '#222', align = 'left') {
  ctx.save();
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const words = str.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lineH; } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  ctx.restore();
  return yy + lineH;
}

function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// US "Nutrition Facts" panel (2020 format), drawn at 240 px wide then scaled to w. Returns its height.
function nutritionFacts(ctx, x, y, w, n) {
  const s = w / 240;
  const extra = n.extra || [];
  const Hd = 177 + n.rows.length * 14.5 + extra.length * 13;
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 240, Hd);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.strokeRect(0.75, 0.75, 238.5, Hd - 1.5);
  const L = 6, R = 234, W = R - L;
  let y0 = 6;
  const tx = (str, xx, yy, font, align = 'left', max) => {
    ctx.font = font; ctx.textAlign = align; ctx.fillStyle = '#111'; ctx.letterSpacing = '0px';
    if (max) ctx.fillText(str, xx, yy, max); else ctx.fillText(str, xx, yy);
  };
  const bar = (hh) => { ctx.fillStyle = '#111'; ctx.fillRect(L, y0, W, hh); };
  tx('Nutrition Facts', L - 1, y0 + 24, F(900, 28), 'left', W); y0 += 29;
  ctx.fillRect(L, y0, W, 0.8);
  tx(n.serv, L, y0 + 11, F(400, 10.5), 'left', W); y0 += 13;
  tx('Serving size', L, y0 + 14, F(800, 13)); tx(n.size, R, y0 + 14, F(800, 13), 'right', 130); y0 += 18;
  bar(8); y0 += 8;
  tx('Amount per serving', L, y0 + 10, F(800, 9)); y0 += 12;
  tx('Calories', L, y0 + 24, F(900, 23)); tx(String(n.kcal), R, y0 + 26, F(900, 31), 'right'); y0 += 28;
  bar(4.5); y0 += 5;
  tx('% Daily Value*', R, y0 + 10, F(800, 9), 'right'); y0 += 14;
  for (const [name, amt, dv, ind = 0] of n.rows) {
    ctx.fillStyle = '#111'; ctx.fillRect(L + (ind ? 10 : 0), y0, W - (ind ? 10 : 0), 0.7);
    const xx = L + ind * 10;
    ctx.font = F(ind ? 400 : 800, 10.5); ctx.textAlign = 'left'; ctx.fillText(name, xx, y0 + 11);
    const nw = ctx.measureText(name).width;
    if (amt) { ctx.font = F(400, 10.5); ctx.fillText(' ' + amt, xx + nw, y0 + 11); }
    if (dv) tx(dv, R, y0 + 11, F(800, 10.5), 'right');
    y0 += 14.5;
  }
  bar(8); y0 += 8;
  for (const [name, amt, dv] of extra) {
    tx(name + ' ' + amt, L, y0 + 10, F(400, 9.5), 'left', 170);
    if (dv) tx(dv, R, y0 + 10, F(400, 9.5), 'right');
    ctx.fillStyle = '#111'; ctx.fillRect(L, y0 + 12.5, W, 0.6);
    y0 += 13;
  }
  y0 += 4;
  ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  wrapText(ctx, '*The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.',
    L, y0 + 7, W, 8.4, F(400, 7.2), '#111');
  ctx.restore();
  return Hd * s;
}

// a real UPC-A barcode (with its check digit). code11 = 11 digits. rot = radians (cans print them sideways)
function upc(ctx, x, y, w, h, code11, rot = 0) {
  const d = code11.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += d[i] * (i % 2 ? 1 : 3);
  d.push((10 - (sum % 10)) % 10);
  const Lp = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  let bits = '101';
  for (let i = 0; i < 6; i++) bits += Lp[d[i]];
  bits += '01010';
  for (let i = 6; i < 12; i++) bits += Lp[d[i]].replace(/./g, (c) => (c === '0' ? '1' : '0'));
  bits += '101';
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  const pad = w * 0.09, m = (w - pad * 2) / 95, bh = h * 0.7;
  ctx.fillStyle = '#111';
  for (let i = 0; i < 95; i++) {
    if (bits[i] !== '1') continue;
    const ext = i < 10 || (i >= 45 && i < 50) || i >= 85;
    ctx.fillRect(pad + i * m, h * 0.07, m + 0.25, ext ? bh + h * 0.09 : bh);
  }
  ctx.font = F(500, h * 0.15); ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  const ty = h * 0.07 + bh + h * 0.15;
  ctx.textAlign = 'center';
  ctx.fillText(String(d[0]), pad * 0.5, ty);
  ctx.fillText(d.slice(1, 6).join(''), pad + 27.5 * m, ty, 33 * m);
  ctx.fillText(d.slice(6, 11).join(''), pad + 67.5 * m, ty, 33 * m);
  ctx.fillText(String(d[11]), w - pad * 0.5, ty);
  ctx.restore();
}

function bubbles(ctx, rand, x, y, w, h, n, rgb = '255,255,255', a = 0.35, rmax = 8) {
  for (let i = 0; i < n; i++) {
    const r = 1.2 + rand() ** 2 * rmax, bx = x + rand() * w, by = y + rand() * h;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU);
    ctx.fillStyle = `rgba(${rgb},${a * 0.22})`; ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${a * (0.45 + rand() * 0.55)})`; ctx.lineWidth = Math.max(1, r * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.22, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${a * 1.4})`; ctx.fill();
  }
}

// a citrus slice (cross-section): rind, pith, juicy segments with vesicles, gloss
function citrus(ctx, x, y, r, c, rand) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = r * 0.18; ctx.shadowOffsetY = r * 0.06;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = c.rind; ctx.fill();
  ctx.shadowColor = 'transparent';
  const rg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  rg.addColorStop(0, c.rindHi || c.rind); rg.addColorStop(1, c.rind);
  ctx.fillStyle = rg; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, TAU); ctx.fillStyle = c.pith; ctx.fill();
  const n = c.n || 10;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + 0.05, a1 = ((i + 1) / n) * TAU - 0.05, am = (a0 + a1) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(am) * r * 0.1, y + Math.sin(am) * r * 0.1);
    ctx.arc(x, y, r * 0.84, a0, a1);
    ctx.closePath();
    const g = ctx.createRadialGradient(x, y, r * 0.08, x, y, r * 0.86);
    g.addColorStop(0, c.core); g.addColorStop(0.6, c.flesh); g.addColorStop(1, c.edge || c.flesh);
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    for (let k = 0; k < 18; k++) {
      const a = a0 + rand() * (a1 - a0), rr = r * (0.18 + rand() * 0.64);
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * 0.07, r * 0.017, a, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${0.1 + rand() * 0.22})`; ctx.fill();
    }
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(x, y, r * 0.07, 0, TAU); ctx.fillStyle = c.pith; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.95, Math.PI * 1.08, Math.PI * 1.45);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = r * 0.035; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
}
const LEMON = { rind: '#f2c81c', rindHi: '#ffe866', pith: '#fff7d6', flesh: '#f7e15a', core: '#fff3a8', edge: '#efd03a', n: 10 };
const LIME = { rind: '#3f9a1f', rindHi: '#7ccc3a', pith: '#effad2', flesh: '#a9d84a', core: '#e2f5a6', edge: '#8cc63a', n: 10 };
const ORANGE = { rind: '#ef7d0a', rindHi: '#ffad3a', pith: '#fff1d8', flesh: '#f99a1c', core: '#ffd27a', edge: '#f2850e', n: 11 };
const GRAPEFRUIT = { rind: '#f4a640', rindHi: '#ffd27a', pith: '#fff0e2', flesh: '#f2566c', core: '#ffa0ac', edge: '#e8455c', n: 12 };

// a whole round fruit (orange): shaded sphere + peel dimples + highlight
function fruit(ctx, x, y, r, base, hi, lo, rand) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = r * 0.2; ctx.shadowOffsetY = r * 0.08;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, hi); g.addColorStop(0.55, base); g.addColorStop(1, lo);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  for (let i = 0; i < r * 9; i++) {
    const a = rand() * TAU, rr = Math.sqrt(rand()) * r;
    ctx.fillStyle = rand() < 0.5 ? 'rgba(90,30,0,0.10)' : 'rgba(255,240,200,0.12)';
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.6 + rand() * r * 0.018, 0, TAU); ctx.fill();
  }
  const s = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, 0, x - r * 0.4, y - r * 0.45, r * 0.5);
  s.addColorStop(0, 'rgba(255,255,255,0.7)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function leaf(ctx, x, y, len, ang, c1 = '#4a9a2c', c2 = '#2a6a1c') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = len * 0.1; ctx.shadowOffsetY = len * 0.04;
  const g = ctx.createLinearGradient(0, -len * 0.25, 0, len * 0.25);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -len * 0.34, len, 0);
  ctx.quadraticCurveTo(len * 0.45, len * 0.34, 0, 0);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, len * 0.022);
  ctx.beginPath(); ctx.moveTo(len * 0.04, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.03, len * 0.93, 0); ctx.stroke();
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    ctx.beginPath(); ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.1), -len * 0.12 * (1 - t * 0.6)); ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.1), len * 0.12 * (1 - t * 0.6));
    ctx.lineWidth = Math.max(0.6, len * 0.01); ctx.stroke();
  }
  ctx.restore();
}

// a shiny red apple with yellow streaks, stem and a leaf
function apple(ctx, x, y, r, rand) {
  ctx.save();
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.72);
    ctx.bezierCurveTo(x + r * 0.5, y - r * 1.05, x + r * 1.12, y - r * 0.62, x + r * 0.98, y + r * 0.1);
    ctx.bezierCurveTo(x + r * 0.88, y + r * 0.75, x + r * 0.45, y + r * 1.02, x, y + r * 0.88);
    ctx.bezierCurveTo(x - r * 0.45, y + r * 1.02, x - r * 0.88, y + r * 0.75, x - r * 0.98, y + r * 0.1);
    ctx.bezierCurveTo(x - r * 1.12, y - r * 0.62, x - r * 0.5, y - r * 1.05, x, y - r * 0.72);
    ctx.closePath();
  };
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.3, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, '#ff7262'); g.addColorStop(0.5, '#d82a20'); g.addColorStop(1, '#7e120c');
  path();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = r * 0.22; ctx.shadowOffsetY = r * 0.07;
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); path(); ctx.clip();
  for (let i = 0; i < 40; i++) {
    const sx = x - r + rand() * r * 2;
    ctx.strokeStyle = `rgba(255,200,80,${0.05 + rand() * 0.12})`; ctx.lineWidth = 1 + rand() * r * 0.04;
    ctx.beginPath(); ctx.moveTo(sx, y + r * 0.9); ctx.quadraticCurveTo(sx + (sx - x) * 0.2, y, sx + (sx - x) * 0.1, y - r * 0.8); ctx.stroke();
  }
  for (let i = 0; i < r * 2; i++) { ctx.fillStyle = 'rgba(255,230,170,0.35)'; ctx.beginPath(); ctx.arc(x - r + rand() * r * 2, y - r + rand() * r * 2, 0.6 + rand() * r * 0.012, 0, TAU); ctx.fill(); }
  const s = ctx.createRadialGradient(x - r * 0.42, y - r * 0.38, 0, x - r * 0.42, y - r * 0.38, r * 0.42);
  s.addColorStop(0, 'rgba(255,255,255,0.8)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.68); ctx.quadraticCurveTo(x + r * 0.02, y - r * 0.95, x + r * 0.14, y - r * 1.1); ctx.stroke();
  ctx.restore();
  leaf(ctx, x + r * 0.1, y - r * 0.92, r * 0.62, -0.45, '#6cbf3a', '#2f7d22');
}

// kraft paper / card: warm brown with fibers
function kraft(ctx, w, h, rand, base = '#c7a172') {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 60; i++) {
    const x = rand() * w, y = rand() * h, l = 2 + rand() * 9, a = rand() * TAU;
    ctx.strokeStyle = rand() < 0.5 ? `rgba(90,60,30,${0.05 + rand() * 0.1})` : `rgba(255,235,200,${0.05 + rand() * 0.1})`;
    ctx.lineWidth = 0.6 + rand();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  for (let i = 0; i < (w * h) / 900; i++) { ctx.fillStyle = `rgba(60,35,15,${0.1 + rand() * 0.25})`; ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 1.5, 1 + rand() * 1.5); }
}

// draw into one cell of a 3x2 box atlas (0 +x, 1 -x, 2 top / 3 bottom, 4 front, 5 back) with the face's real aspect
function atlasCell(ctx, W, H, idx, fw, fh, draw) {
  const cw = W / 3, ch = H / 2, cx = (idx % 3) * cw, cy = idx < 3 ? 0 : ch;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
  ctx.translate(cx, cy); ctx.scale(cw / fw, ch / fh);
  draw(ctx, fw, fh);
  ctx.restore();
}

function recycleMark(ctx, x, y, s, color, num) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.09; ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.rotate((i * TAU) / 3);
    ctx.beginPath(); ctx.moveTo(-s * 0.32, s * 0.28); ctx.lineTo(s * 0.32, s * 0.28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.28); ctx.lineTo(s * 0.24, s * 0.18); ctx.lineTo(s * 0.24, s * 0.38); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (num) { ctx.font = F(800, s * 0.36); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(num, 0, s * 0.02); }
  ctx.restore();
}

// ============================================================================================
// materials
// ============================================================================================
// aluminum (can lids, bottoms, tabs, foil) + painted/colored metal caps
registerMaterial('drinks-alu', (tone = 'silver') => {
  const tones = {
    silver: { color: 0xd3d7dc, metalness: 1, roughness: 0.26 },
    score: { color: 0xa9aeb5, metalness: 1, roughness: 0.34 },
    black: { color: 0x1b1b1d, metalness: 0.5, roughness: 0.32 },
    gold: { color: 0xd7b25c, metalness: 1, roughness: 0.28 },
    foil: { color: 0xdfe2e5, metalness: 0.55, roughness: 0.38 },
  };
  const t = tones[tone] || { color: Number(tone), metalness: 0.85, roughness: 0.3 };
  return new THREE.MeshStandardMaterial(t);
});
registerPhysical('drinks-alu', { density: 2700, friction: 0.4, sound: 'metal' });

// can printing: the label art on shiny metal (real cans are printed straight onto the aluminum)
const PRINTS = new Map();
function design(id, w, h, draw, finish = 'gloss') {
  registerLabel(id, { w, h, finish, draw });
  PRINTS.set(id, { w, h, draw });
}
registerMaterial('drinks-canprint', (id) => {
  const d = PRINTS.get(id);
  const map = cached('drinks-canprint-' + id, () => {
    const t = canvasTex((ctx, w, h) => d.draw(ctx, w, h), { w: d.w, h: d.h });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 16;
    return t;
  });
  return new THREE.MeshPhysicalMaterial({ map, metalness: 0.14, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08 });
});

// the visible walls of glass + PET bottles: mostly see-through with sharp highlights, so the drink inside keeps
// its real color (the collision/breaking shapes underneath stay 'glass:clear' / 'clearplastic')
// (a faint dark veil + strong Fresnel reflections: a white veil would turn black coffee gray)
registerMaterial('drinks-glass', (tint) => {
  const m = new THREE.MeshPhysicalMaterial({ color: tint ? Number(tint) : 0x16201c, roughness: 0.02, metalness: 0, transparent: true, opacity: tint ? 0.22 : 0.13,
    ior: 1.52, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 6, depthWrite: false });
  m.userData.glass = true;
  return m;
});
registerMaterial('drinks-pet', (tint) => {
  const m = new THREE.MeshPhysicalMaterial({ color: tint ? Number(tint) : 0x1a2020, roughness: 0.04, metalness: 0, transparent: true, opacity: tint ? 0.16 : 0.09,
    ior: 1.57, specularIntensity: 1, clearcoat: 0.8, clearcoatRoughness: 0.04, envMapIntensity: tint ? 2.5 : 5, depthWrite: false, side: THREE.DoubleSide });
  m.userData.glass = true;
  return m;
});
registerPhysical('drinks-glass', { density: 2500, friction: 0.35, sound: 'glass', breaks: null, strength: 9 });
registerPhysical('drinks-pet', { density: 1380, friction: 0.4, sound: 'plastic', breaks: null, strength: 9 });

// natural HDPE (gallon jug): milky, translucent, satin
registerMaterial('drinks-hdpe', () => new THREE.MeshPhysicalMaterial({
  color: 0xeef2f0, roughness: 0.42, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, ior: 1.54, sheen: 0.3, sheenColor: new THREE.Color(0xffffff),
}));
registerPhysical('drinks-hdpe', { density: 950, friction: 0.5, sound: 'plastic', breaks: null, strength: 9 });

// plain kraft paperboard (multipack trays): no printing
registerMaterial('drinks-kraft', () => {
  const map = cached('drinks-kraft', () => canvasTex((ctx, w, h) => kraft(ctx, w, h, mulberry32(4), '#b99467'), { w: 256, h: 256 }));
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.92 });
  m.userData.tile = 0.25;
  return m;
});
registerPhysical('drinks-kraft', { density: 600, friction: 0.6, sound: 'cardboard', breaks: 'tear', strength: 0.5 });

// collision-only stand-ins (whole filled thing as one solid)
registerPhysical('drinks-can', { density: 900, friction: 0.42, sound: 'metal', breaks: null, strength: 9 });
registerPhysical('drinks-carton', { density: 12, friction: 0.6, sound: 'cardboard', breaks: null, strength: 9 });
registerPhysical('drinks-juicebox', { density: 1000, friction: 0.6, sound: 'cardboard', breaks: null, strength: 9 });

// ============================================================================================
// shapes
// ============================================================================================
// move/rotate a group of parts as one (rot in degrees, about the group's origin)
function place(parts, p = [0, 0, 0], rot = [0, 0, 0], extra = {}) {
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG));
  return parts.map((pt) => {
    const v = new THREE.Vector3(...(pt.p || [0, 0, 0])).applyQuaternion(q0).add(new THREE.Vector3(...p));
    const q = new THREE.Quaternion();
    if (pt.rot) q.setFromEuler(new THREE.Euler(pt.rot[0] * DEG, pt.rot[1] * DEG, pt.rot[2] * DEG));
    const e = new THREE.Euler().setFromQuaternion(q0.clone().multiply(q));
    return { ...pt, p: [v.x, v.y, v.z], rot: [e.x / DEG, e.y / DEG, e.z / DEG], ...extra };
  });
}

// liquid inside a bottle: the bottle's inside wall (inset t) filled up to fillY
function liquidProfile(outer, t, fillY) {
  const pts = [];
  for (let i = 0; i < outer.length; i++) {
    const [r, y] = outer[i];
    if (y > fillY) {
      const [r0, y0] = outer[i - 1];
      const k = (fillY - y0) / (y - y0);
      pts.push([Math.max(0, r0 + (r - r0) * k - t), fillY]);
      break;
    }
    pts.push([Math.max(0, r - t), y + t * 0.8]);
  }
  pts.push([0, fillY]);
  return pts;
}

// ---- aluminum beverage can (202 end). H = 0.1228 (12 oz) or 0.157 (16 oz) ----
function canProfile(H) {
  const d = H - 0.1228;
  return [[0, 0.0095], [0.012, 0.0086], [0.019, 0.0062], [0.0234, 0.0028], [0.0248, 0.0004], [0.0262, 0], [0.0285, 0.0022], [0.0312, 0.0068], [0.0328, 0.0112], [0.033, 0.0125],
    [0.033, 0.1035 + d], [0.0319, 0.1085 + d], [0.0296, 0.1143 + d], [0.0279, 0.1183 + d], [0.0273, 0.1203 + d], [0.0277, 0.1222 + d], [0.0271, 0.1229 + d],
    [0.0261, 0.1218 + d], [0.0254, 0.1188 + d], [0.0246, 0.118 + d], [0, 0.1183 + d]];
}
// the printed band (a hair outside the metal), from the bottom taper up the neck
function canPrintProfile(H) {
  const d = H - 0.1228;
  return [[0.03135, 0.0068], [0.03295, 0.0112], [0.03315, 0.0125], [0.03315, 0.1035 + d], [0.03205, 0.1085 + d], [0.02975, 0.1143 + d], [0.02805, 0.1183 + d], [0.02745, 0.1203 + d]];
}
// canvas rows of the straight body (the rest of the band is the base taper + neck)
function canRows(h, H) {
  const d = H - 0.1228, span = 0.1135 + d;
  return { top: h * (1 - (0.1035 + d - 0.0068) / span), bot: h * (1 - (0.0125 - 0.0068) / span) };
}
const canBandW = 2 * Math.PI * 0.03315;
// u of a wrapped label's main art: 0.5 is dead front (+z); 0.55 turns it a touch toward the front-right 3/4 view
const FRONT = 0.55;

function canParts(H, print, { liquid = 'liquid:0x2a1208:0.92', tab = 'silver', lite = false } = {}) {
  const lid = 0.1183 + (H - 0.1228);
  const parts = [
    lathe(canProfile(H), 0, 0, 0, 'drinks-alu', { seg: 48, col: false, pack: true }),
    lathe(canPrintProfile(H), 0, 0, 0, 'drinks-canprint:' + print, { seg: 56, uv: 'wrap', col: false, pack: true }),
    cyl(0.033, H, 0, H / 2, 0, 'drinks-can', { vis: false, seg: 24 }),
  ];
  if (lite) return parts;
  parts.push(
    cyl(0.0318, lid - 0.012, 0, 0.009 + (lid - 0.012) / 2, 0, liquid, { seg: 24, col: false, liquid: true }),
    cyl(0.0019, 0.0009, 0, lid + 0.0004, 0, 'drinks-alu', { seg: 12, col: false, pack: true }), // rivet
    // the drinking hole is always there; the scored panel sits over it until you pull the tab
    cyl(0.0078, 0.0002, 0, lid + 0.0001, 0.0122, 'plastic:0x0b0705', { seg: 24, col: false, pack: true, scale: [1.0, 1, 1.12] }),
    cyl(0.0079, 0.0003, 0, lid + 0.00028, 0.0122, 'drinks-alu:score', { seg: 24, col: false, closed: true, scale: [1.0, 1, 1.12] }),
    // pull tab (people fold it back down after opening)
    box(0.0122, 0.0008, 0.0205, 0, lid + 0.0011, -0.0042, 'drinks-alu:' + tab, { col: false, pack: true }),
    box(0.0058, 0.0009, 0.0062, 0, lid + 0.00115, -0.0098, 'plastic:0x0e0e10', { col: false, pack: true }), // finger hole in the tab
  );
  return parts;
}

// ============================================================================================
// LABELS
// ============================================================================================

// ---------- Crestline Cola ----------
function colaBackground(ctx, w, h, rand, top = 0, bot = h) {
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#a30f19'); g.addColorStop(0.35, '#ee2230'); g.addColorStop(0.7, '#d81a26'); g.addColorStop(1, '#8a0a13');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // the "crest line": a gold mountain ridge running all the way around
  const ry = top + (bot - top) * 0.7;
  ctx.beginPath(); ctx.moveTo(0, ry);
  const pts = [];
  for (let x = 0; x <= w; x += w / 40) pts.push([x, ry - (Math.sin(x * 0.011) * 0.5 + 0.5) * (bot - top) * 0.1 - rand() * (bot - top) * 0.08]);
  pts.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(w, bot); ctx.lineTo(0, bot); ctx.closePath();
  const dg = ctx.createLinearGradient(0, ry - (bot - top) * 0.2, 0, bot);
  dg.addColorStop(0, 'rgba(90,0,8,0.4)'); dg.addColorStop(1, 'rgba(50,0,4,0.7)');
  ctx.fillStyle = dg; ctx.fill();
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = '#e8bf55'; ctx.lineWidth = Math.max(2, (bot - top) * 0.008); ctx.stroke();
  bubbles(ctx, rand, 0, top, w, (bot - top) * 0.75, Math.round(w * 0.12), '255,225,205', 0.32, (bot - top) * 0.012);
}

function goldFill(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff3c0'); g.addColorStop(0.45, '#e9bb4c'); g.addColorStop(1, '#a8741b');
  return g;
}

// emblem + "Crestline" + "COLA". s = scale (1 = Crestline at 120 px)
function colaMark(ctx, cx, cy, s) {
  // emblem: gold ring with a mountain crest and a star
  const ey = cy - 175 * s, er = 44 * s;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, ey, er, 0, TAU); ctx.fillStyle = '#5a050a'; ctx.fill();
  ctx.lineWidth = 5 * s; ctx.strokeStyle = goldFill(ctx, ey - er, ey + er); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, ey, er * 0.8, 0, TAU); ctx.lineWidth = 1.5 * s; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - er * 0.62, ey + er * 0.32); ctx.lineTo(cx - er * 0.25, ey - er * 0.18); ctx.lineTo(cx - er * 0.05, ey + er * 0.08);
  ctx.lineTo(cx + er * 0.22, ey - er * 0.38); ctx.lineTo(cx + er * 0.62, ey + er * 0.32); ctx.closePath();
  ctx.fillStyle = goldFill(ctx, ey - er * 0.4, ey + er * 0.3); ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? er * 0.08 : er * 0.2; ctx.lineTo(cx + Math.cos(a) * rr, ey - er * 0.5 + Math.sin(a) * rr * 0.9); }
  ctx.closePath(); ctx.fillStyle = '#fff4d8'; ctx.fill();
  ctx.restore();
  T(ctx, 'EST.', cx - er - 34 * s, ey + 8 * s, F(700, 20 * s), '#f3d68a', { track: 3 * s });
  T(ctx, '1931', cx + er + 36 * s, ey + 8 * s, F(700, 20 * s), '#f3d68a', { track: 3 * s });
  T(ctx, 'Crestline', cx, cy, F(700, 124 * s, SERIF, 'italic'), '#fff4dc', { stroke: '#4a0307', lw: 11 * s, shadow: 'rgba(0,0,0,0.5)', blur: 14 * s, sy: 5 * s });
  // swash under the name
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx - 250 * s, cy + 26 * s); ctx.bezierCurveTo(cx - 80 * s, cy + 6 * s, cx + 90 * s, cy + 46 * s, cx + 260 * s, cy + 16 * s);
  ctx.lineCap = 'round'; ctx.lineWidth = 6 * s; ctx.strokeStyle = goldFill(ctx, cy, cy + 40 * s); ctx.stroke();
  ctx.restore();
  T(ctx, 'COLA', cx, cy + 118 * s, F(900, 100 * s, DISP), goldFill(ctx, cy + 40 * s, cy + 118 * s), { track: 24 * s, stroke: '#4a0307', lw: 8 * s, shadow: 'rgba(0,0,0,0.45)', blur: 10 * s, sy: 4 * s });
}

const COLA_NF = {
  serv: '1 serving per container', size: '1 can', kcal: 140,
  rows: [['Total Fat', '0g', '0%'], ['Sodium', '45mg', '2%'], ['Total Carbohydrate', '39g', '14%'], ['Total Sugars', '39g', '', 1], ['Includes 39g Added Sugars', '', '78%', 2], ['Protein', '0g', '']],
  extra: [['Not a significant source of other nutrients.', '', '']],
};
const DEPOSIT = 'CA CASH REFUND · HI ME NY OR VT 5¢ · MI 10¢';

design('drinks-cola-can', 1536, Math.round(1536 * (0.1135 / canBandW)), (ctx, w, h) => {
  const rand = mulberry32(1931);
  const { top, bot } = canRows(h, 0.1228);
  colaBackground(ctx, w, h, rand, top, bot);
  // neck + base: deep red with gold pinstripes
  ctx.fillStyle = '#3c0407'; ctx.fillRect(0, 0, w, top - 8); ctx.fillRect(0, bot + 6, w, h - bot);
  ctx.fillStyle = '#e2b54a'; ctx.fillRect(0, top - 8, w, 3); ctx.fillRect(0, bot + 4, w, 3);
  for (let i = 0; i < 6; i++) T(ctx, 'CRESTLINE ★', (i + 0.5) * (w / 6), top * 0.62, F(800, top * 0.22), '#d9ad48', { track: 4 });
  const cx = w * FRONT, body = bot - top;
  colaMark(ctx, cx, top + body * 0.53, 0.7);
  T(ctx, 'ORIGINAL', cx, top + body * 0.77, F(800, 22), '#fbe7c0', { track: 12 });
  T(ctx, '12 FL OZ (355 mL)', cx, bot - 18, F(700, 25), '#fff1d6', { track: 2 });
  // sides (visible as you turn it)
  T(ctx, 'ICE COLD SINCE 1931', w * 0.745, top + body * 0.5, F(800, 26), '#f2cd6a', { track: 8, rot: -Math.PI / 2 });
  T(ctx, 'CAFFEINE 34 mg / 12 FL OZ', w * 0.355, top + body * 0.5, F(700, 20), '#f8dcb0', { track: 4, rot: -Math.PI / 2 });
  // back: nutrition + ingredients | barcode + deposit + maker
  const nh = nutritionFacts(ctx, w * 0.07, top + 26, w * 0.16, COLA_NF);
  rrect(ctx, w * 0.065, top + 26 + nh + 6, w * 0.17, 116, 8); ctx.fillStyle = 'rgba(60,0,6,0.55)'; ctx.fill();
  wrapText(ctx, 'INGREDIENTS: CARBONATED WATER, HIGH FRUCTOSE CORN SYRUP, CARAMEL COLOR, PHOSPHORIC ACID, NATURAL FLAVORS, CAFFEINE.', w * 0.072, top + 26 + nh + 30, w * 0.158, 19, F(600, 15), '#fff0d8');
  upc(ctx, w * 0.835, top + body * 0.3, w * 0.12, body * 0.22, '08523100121', -Math.PI / 2);
  T(ctx, DEPOSIT, w * 0.895, top + body * 0.71, F(700, 14), '#fff0d8');
  T(ctx, 'CRESTLINE BEVERAGE CO. · DAYTON, OH 45402', w * 0.895, top + body * 0.76, F(500, 13), '#f1d6b4');
  recycleMark(ctx, w * 0.895, top + body * 0.87, 40, '#f1d6b4');
});

// ---- 12-pack fridge pack panels ----
const PK = { L: 0.402, H: 0.136, D: 0.126, t: 0.0012 };
PK.endW = PK.D - 2 * PK.t; PK.endH = PK.H - 2 * PK.t; PK.low = 0.03; PK.flapH = PK.endH - PK.low;

function miniCan(ctx, x, y, cw, ch, rand, tilt = 0) {
  // a cold can photo-illustration: crimson body, silver neck + lid, condensation
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = cw * 0.12; ctx.shadowOffsetY = cw * 0.05;
  const body = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  body.addColorStop(0, '#5a0509'); body.addColorStop(0.18, '#c8161f'); body.addColorStop(0.32, '#ff6a6a'); body.addColorStop(0.42, '#d01822'); body.addColorStop(0.85, '#8a0a12'); body.addColorStop(1, '#4a0307');
  rrect(ctx, -cw / 2, -ch / 2 + ch * 0.08, cw, ch * 0.9, cw * 0.06); ctx.fillStyle = body; ctx.fill();
  ctx.shadowColor = 'transparent';
  const met = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  met.addColorStop(0, '#7c8086'); met.addColorStop(0.3, '#f2f4f6'); met.addColorStop(0.6, '#b7bcc2'); met.addColorStop(1, '#6a6e74');
  ctx.beginPath(); ctx.moveTo(-cw / 2, -ch / 2 + ch * 0.1); ctx.lineTo(-cw * 0.41, -ch / 2 + ch * 0.02); ctx.lineTo(cw * 0.41, -ch / 2 + ch * 0.02); ctx.lineTo(cw / 2, -ch / 2 + ch * 0.1); ctx.closePath();
  ctx.fillStyle = met; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -ch / 2 + ch * 0.02, cw * 0.41, cw * 0.09, 0, 0, TAU); ctx.fillStyle = met; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -ch / 2 + ch * 0.022, cw * 0.36, cw * 0.07, 0, 0, TAU); ctx.fillStyle = '#c3c7cc'; ctx.fill();
  ctx.fillStyle = '#9aa0a6'; rrect(ctx, -cw * 0.08, -ch / 2 + ch * 0.005, cw * 0.16, cw * 0.05, cw * 0.02); ctx.fill();
  ctx.save(); ctx.rotate(-Math.PI / 2);
  T(ctx, 'Crestline', ch * 0.02, cw * 0.1, F(700, cw * 0.36, SERIF, 'italic'), '#fff4dc', { stroke: '#4a0307', lw: cw * 0.03 });
  ctx.restore();
  T(ctx, 'COLA', 0, ch * 0.36, F(900, cw * 0.17, DISP), '#e9bb4c', { track: cw * 0.03 });
  // condensation drops
  for (let i = 0; i < 70; i++) {
    const dx = (rand() - 0.5) * cw * 0.9, dy = (rand() - 0.42) * ch * 0.85, r = cw * (0.006 + rand() * 0.018);
    ctx.beginPath(); ctx.ellipse(dx, dy, r, r * 1.25, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    ctx.beginPath(); ctx.arc(dx - r * 0.3, dy - r * 0.4, r * 0.35, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  }
  ctx.restore();
}

design('drinks-cola-12pk-front', 2048, Math.round(2048 * PK.H / PK.L), (ctx, w, h) => {
  const rand = mulberry32(12);
  colaBackground(ctx, w, h, rand, 0, h);
  colaMark(ctx, w * 0.3, h * 0.6, 1.25);
  // two cold cans on the right
  miniCan(ctx, w * 0.66, h * 0.55, h * 0.36, h * 0.7, rand, -0.12);
  miniCan(ctx, w * 0.77, h * 0.53, h * 0.36, h * 0.7, rand, 0.1);
  // ice splash arcs
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(w * 0.715, h * 0.6, h * (0.42 + i * 0.06), Math.PI * 1.1, Math.PI * 1.45); ctx.stroke(); }
  // 12 CANS burst
  const bx = w * 0.9, by = h * 0.36, br = h * 0.17;
  ctx.beginPath();
  for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU, rr = i % 2 ? br * 0.86 : br; ctx.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = goldFill(ctx, by - br, by + br); ctx.fill();
  T(ctx, '12', bx, by + br * 0.18, F(900, br * 0.95, DISP), '#5a050a');
  T(ctx, 'CANS', bx, by + br * 0.58, F(900, br * 0.3, DISP), '#5a050a', { track: 4 });
  T(ctx, 'FRIDGE PACK ›', w * 0.9, h * 0.72, F(800, 30), '#fff1d6', { track: 4 });
  // bottom strip
  ctx.fillStyle = 'rgba(30,0,3,0.75)'; ctx.fillRect(0, h * 0.885, w, h * 0.115);
  T(ctx, '12 - 12 FL OZ (355 mL) CANS · 144 FL OZ (4.26 L)', w * 0.5, h * 0.965, F(700, 34), '#fff1d6', { track: 3 });
});

design('drinks-cola-12pk-back', 2048, Math.round(2048 * PK.H / PK.L), (ctx, w, h) => {
  const rand = mulberry32(13);
  colaBackground(ctx, w, h, rand, 0, h);
  colaMark(ctx, w * 0.22, h * 0.6, 1.0);
  const nh = nutritionFacts(ctx, w * 0.39, h * 0.06, h * 0.52, COLA_NF);
  rrect(ctx, w * 0.6, h * 0.05, w * 0.235, h * 0.66, 14); ctx.fillStyle = 'rgba(50,0,5,0.55)'; ctx.fill();
  wrapText(ctx, 'INGREDIENTS: CARBONATED WATER, HIGH FRUCTOSE CORN SYRUP, CARAMEL COLOR, PHOSPHORIC ACID, NATURAL FLAVORS, CAFFEINE.', w * 0.62, h * 0.12, w * 0.2, 30, F(600, 22), '#fff0d8');
  T(ctx, 'CAFFEINE CONTENT: 34 mg / 12 FL OZ', w * 0.62, h * 0.44, F(800, 22), '#f2cd6a', { align: 'left' });
  T(ctx, DEPOSIT, w * 0.62, h * 0.52, F(700, 20), '#fff0d8', { align: 'left' });
  T(ctx, 'Distributed by Crestline Beverage Co., Dayton, OH 45402', w * 0.62, h * 0.6, F(500, 20), '#f1d6b4', { align: 'left' });
  T(ctx, 'Store in a cool, dry place. Do not freeze: cans can burst.', w * 0.62, h * 0.67, F(500, 20), '#f1d6b4', { align: 'left' });
  upc(ctx, w * 0.85, h * 0.1, w * 0.12, h * 0.38, '08523100124');
  recycleMark(ctx, w * 0.91, h * 0.7, 70, '#f1d6b4');
  T(ctx, 'PAPERBOARD', w * 0.91, h * 0.85, F(800, 18), '#f1d6b4', { track: 2 });
  ctx.fillStyle = 'rgba(30,0,3,0.75)'; ctx.fillRect(0, h * 0.885, w, h * 0.115);
  T(ctx, 'ENJOY ICE COLD · 12 - 12 FL OZ CANS', w * 0.5, h * 0.965, F(700, 34), '#fff1d6', { track: 3 });
  void nh;
});

design('drinks-cola-12pk-top', 2048, Math.round(2048 * PK.endW / PK.L), (ctx, w, h) => {
  const rand = mulberry32(14);
  colaBackground(ctx, w, h, rand, 0, h);
  T(ctx, 'Crestline', w * 0.3, h * 0.6, F(700, h * 0.3, SERIF, 'italic'), '#fff4dc', { stroke: '#4a0307', lw: 10, shadow: 'rgba(0,0,0,0.5)', blur: 12, max: w * 0.4 });
  T(ctx, 'COLA', w * 0.66, h * 0.6, F(900, h * 0.25, DISP), goldFill(ctx, h * 0.38, h * 0.6), { track: 18, stroke: '#4a0307', lw: 7 });
  T(ctx, '12 PACK · 12 FL OZ CANS', w * 0.3, h * 0.84, F(700, h * 0.07), '#fff1d6', { track: 6 });
  T(ctx, 'DISPENSER END ›', w * 0.88, h * 0.84, F(800, h * 0.07), '#f2cd6a', { track: 4 });
});

function colaEnd(ctx, w, h, rand) {
  colaBackground(ctx, w, h, rand, 0, h);
  T(ctx, 'Crestline', w / 2, h * 0.4, F(700, w * 0.2, SERIF, 'italic'), '#fff4dc', { stroke: '#4a0307', lw: 7 });
  T(ctx, 'COLA', w / 2, h * 0.56, F(900, w * 0.16, DISP), goldFill(ctx, h * 0.45, h * 0.56), { track: 10, stroke: '#4a0307', lw: 5 });
  T(ctx, '12 CANS', w / 2, h * 0.7, F(800, w * 0.08), '#fff1d6', { track: 6 });
}
design('drinks-cola-12pk-end', 512, Math.round(512 * PK.endH / PK.endW), (ctx, w, h) => colaEnd(ctx, w, h, mulberry32(15)));
design('drinks-cola-12pk-endlow', 512, Math.round(512 * PK.low / PK.endW), (ctx, w, h) => {
  const rand = mulberry32(16);
  ctx.fillStyle = '#5a050a'; ctx.fillRect(0, 0, w, h);
  bubbles(ctx, rand, 0, 0, w, h, 40, '255,225,205', 0.3, 4);
  T(ctx, 'CANS ROLL OUT HERE', w / 2, h * 0.62, F(800, h * 0.3), '#f2cd6a', { track: 4 });
  ctx.setLineDash([10, 7]); ctx.strokeStyle = '#fff1d6'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(6, 2); ctx.lineTo(w - 6, 2); ctx.stroke();
});
design('drinks-cola-12pk-flap', 512, Math.round(512 * PK.flapH / PK.endW), (ctx, w, h) => {
  const rand = mulberry32(17);
  colaBackground(ctx, w, h, rand, 0, h);
  // perforated tear line around the flap + the finger notch
  ctx.setLineDash([12, 8]); ctx.strokeStyle = '#fff1d6'; ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 14);
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(w / 2, 10, 34, 0, Math.PI); ctx.fillStyle = '#3c0407'; ctx.fill();
  T(ctx, 'PUSH IN', w / 2, 38, F(800, 15), '#f2cd6a', { track: 2 });
  T(ctx, 'OPEN', w / 2, h * 0.42, F(900, w * 0.15, DISP), '#fff4dc', { track: 10, stroke: '#4a0307', lw: 6 });
  T(ctx, 'TEAR ALONG PERFORATION', w / 2, h * 0.55, F(800, w * 0.042), '#fff1d6', { track: 3 });
  ctx.fillStyle = '#f2cd6a';
  ctx.beginPath(); ctx.moveTo(w / 2 - 30, h * 0.66); ctx.lineTo(w / 2 + 30, h * 0.66); ctx.lineTo(w / 2, h * 0.76); ctx.closePath(); ctx.fill();
  T(ctx, 'Crestline', w / 2, h * 0.92, F(700, w * 0.13, SERIF, 'italic'), '#fff4dc', { stroke: '#4a0307', lw: 5 });
});

// ---------- Voltura energy drink (16 oz) ----------
const VOLT_NF = {
  serv: '1 serving per container', size: '1 can', kcal: 220,
  rows: [['Total Fat', '0g', '0%'], ['Sodium', '370mg', '16%'], ['Total Carbohydrate', '56g', '20%'], ['Total Sugars', '54g', '', 1], ['Includes 54g Added Sugars', '', '108%', 2], ['Protein', '0g', '']],
  extra: [['Riboflavin', '3.4mg', '260%'], ['Niacin', '38mg', '240%'], ['Vitamin B6', '4mg', '240%'], ['Vitamin B12', '12mcg', '500%']],
};
function lightning(ctx, rand, x, y, len, ang, width) {
  ctx.save();
  ctx.shadowColor = '#3ff6ff'; ctx.shadowBlur = width * 6;
  ctx.strokeStyle = '#c9fdff'; ctx.lineWidth = width; ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
  const seg = 9;
  let px = x, py = y;
  ctx.beginPath(); ctx.moveTo(px, py);
  for (let i = 0; i < seg; i++) {
    const a = ang + (rand() - 0.5) * 1.2;
    px += Math.cos(a) * (len / seg); py += Math.sin(a) * (len / seg);
    ctx.lineTo(px, py);
    if (rand() < 0.35) {
      const ba = a + (rand() < 0.5 ? -0.8 : 0.8);
      ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ba) * len * 0.12, py + Math.sin(ba) * len * 0.12); ctx.moveTo(px, py);
    }
  }
  ctx.stroke();
  ctx.restore();
}

design('drinks-energy-can', 1536, Math.round(1536 * ((0.1135 + 0.0342) / canBandW)), (ctx, w, h) => {
  const rand = mulberry32(160);
  const { top, bot } = canRows(h, 0.157);
  const body = bot - top, cx = w * FRONT;
  const bg = ctx.createRadialGradient(cx, top + body * 0.45, 20, cx, top + body * 0.45, w * 0.55);
  bg.addColorStop(0, '#4a1490'); bg.addColorStop(0.45, '#22094a'); bg.addColorStop(1, '#0b0416');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // hex mesh texture
  ctx.strokeStyle = 'rgba(120,80,255,0.12)'; ctx.lineWidth = 1.5;
  for (let y = 0; y < h; y += 26) for (let x = (y / 26) % 2 ? 15 : 0; x < w; x += 30) { ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke(); }
  // diagonal neon slash behind the logo
  ctx.save();
  const sg = ctx.createLinearGradient(cx - 400, 0, cx + 400, 0);
  sg.addColorStop(0, 'rgba(255,40,200,0)'); sg.addColorStop(0.3, '#ff2bd0'); sg.addColorStop(0.7, '#2bf3ff'); sg.addColorStop(1, 'rgba(43,243,255,0)');
  ctx.fillStyle = sg; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.moveTo(cx - 520, top + body * 0.62); ctx.lineTo(cx + 420, top + body * 0.2); ctx.lineTo(cx + 520, top + body * 0.28); ctx.lineTo(cx - 420, top + body * 0.7); ctx.closePath(); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 9; i++) lightning(ctx, rand, rand() * w, top + rand() * body * 0.3, body * (0.35 + rand() * 0.35), Math.PI / 2 + (rand() - 0.5) * 0.6, 2 + rand() * 3);
  // wordmark: big, italic, stacked
  const wy = top + body * 0.47;
  T(ctx, 'VOLTURA', cx, wy, F(900, 128, DISP), (() => { const g = ctx.createLinearGradient(0, wy - 130, 0, wy); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#a6fbff'); g.addColorStop(1, '#26d9ff'); return g; })(),
    { skew: -0.22, stroke: '#0b0416', lw: 14, shadow: '#2bf3ff', blur: 30, max: w * 0.27 });
  T(ctx, 'ENERGY', cx, wy + 70, F(900, 50, DISP), '#ffffff', { track: 24, skew: -0.22, shadow: '#ff2bd0', blur: 18 });
  // flavor tag
  ctx.save(); ctx.translate(cx, wy + 160); ctx.transform(1, 0, -0.22, 1, 0, 0);
  rrect(ctx, -170, -38, 340, 64, 12); ctx.fillStyle = '#ff2bd0'; ctx.fill();
  ctx.restore();
  T(ctx, 'BLUE RAZZ', cx, wy + 176, F(900, 42, DISP), '#ffffff', { track: 8, skew: -0.22 });
  // caffeine badge on the right side
  const bx = w * 0.7, by = top + body * 0.8, br = 62;
  ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fillStyle = '#2bf3ff'; ctx.fill();
  ctx.beginPath(); ctx.arc(bx, by, br - 7, 0, TAU); ctx.strokeStyle = '#0b0416'; ctx.lineWidth = 3; ctx.stroke();
  T(ctx, '160', bx, by + 8, F(900, 44, DISP), '#0b0416');
  T(ctx, 'MG CAFFEINE', bx, by + 32, F(800, 13), '#0b0416', { track: 1 });
  T(ctx, 'ZERO CHILL · FULL CHARGE', w * 0.365, top + body * 0.5, F(800, 24), '#a6fbff', { track: 8, rot: -Math.PI / 2 });
  T(ctx, '16 FL OZ (473 mL)', cx, bot - 22, F(800, 28), '#ffffff', { track: 3 });
  // neck: black with a cyan pinstripe
  ctx.fillStyle = '#07030d'; ctx.fillRect(0, 0, w, top - 6); ctx.fillRect(0, bot + 6, w, h - bot);
  ctx.fillStyle = '#2bf3ff'; ctx.fillRect(0, top - 6, w, 3); ctx.fillRect(0, bot + 4, w, 3);
  for (let i = 0; i < 6; i++) T(ctx, 'VOLTURA', (i + 0.5) * (w / 6), top * 0.65, F(900, top * 0.26, DISP), '#8a5cff', { track: 10, skew: -0.2 });
  // back
  const nx = w * 0.06, nw = w * 0.17;
  rrect(ctx, nx - 8, top + 12, nw + 16, body * 0.86, 10); ctx.fillStyle = 'rgba(8,3,16,0.82)'; ctx.fill();
  rrect(ctx, w * 0.785, top + body * 0.53, w * 0.16, body * 0.2, 10); ctx.fillStyle = 'rgba(8,3,16,0.82)'; ctx.fill();
  const nh = nutritionFacts(ctx, nx, top + 20, nw, VOLT_NF);
  wrapText(ctx, 'INGREDIENTS: CARBONATED WATER, SUGAR, GLUCOSE, CITRIC ACID, NATURAL AND ARTIFICIAL FLAVORS, TAURINE, SODIUM CITRATE, COLOR ADDED, PANAX GINSENG ROOT EXTRACT, CAFFEINE, SORBIC ACID, BENZOIC ACID, NIACINAMIDE, SUCROSE, SALT, D-GLUCURONOLACTONE, INOSITOL, GUARANA SEED EXTRACT, PYRIDOXINE HYDROCHLORIDE, RIBOFLAVIN, MALTODEXTRIN, CYANOCOBALAMIN.',
    nx, top + 20 + nh + 24, nw, 17, F(600, 13), '#d9ccff');
  wrapText(ctx, 'CONTAINS 160 MG CAFFEINE PER CAN. NOT RECOMMENDED FOR CHILDREN, PEOPLE SENSITIVE TO CAFFEINE, PREGNANT OR NURSING WOMEN. LIMIT 2 CANS PER DAY.',
    w * 0.79, top + body * 0.58, w * 0.15, 18, F(700, 14), '#ffffff');
  upc(ctx, w * 0.8, top + body * 0.12, w * 0.13, body * 0.17, '07316400160', -Math.PI / 2);
  T(ctx, DEPOSIT, w * 0.865, top + body * 0.9, F(700, 13), '#d9ccff');
  T(ctx, 'VOLTURA BEVERAGE CO. · TEMPE, AZ', w * 0.865, top + body * 0.94, F(500, 13), '#b9a6ff');
});

// ---------- Little Ripple sparkling water (12 oz) ----------
const RIPPLE_NF = {
  serv: '1 serving per container', size: '1 can', kcal: 0,
  rows: [['Total Fat', '0g', '0%'], ['Sodium', '0mg', '0%'], ['Total Carbohydrate', '0g', '0%'], ['Total Sugars', '0g', '', 1], ['Includes 0g Added Sugars', '', '0%', 2], ['Protein', '0g', '']],
  extra: [['Not a significant source of other nutrients.', '', '']],
};
design('drinks-seltzer-can', 1536, Math.round(1536 * (0.1135 / canBandW)), (ctx, w, h) => {
  const rand = mulberry32(355);
  const { top, bot } = canRows(h, 0.1228);
  const body = bot - top, cx = w * FRONT;
  ctx.fillStyle = '#fdf6ee'; ctx.fillRect(0, 0, w, h);
  // ripple rings spreading around the can
  for (let k = 0; k < 3; k++) {
    const ox = (k + 0.5) * (w / 3) + (k === 1 ? 0 : 0), oy = top + body * (k === 1 ? 0.33 : 0.55);
    for (let i = 1; i < 14; i++) {
      ctx.beginPath(); ctx.ellipse(ox, oy, i * 34, i * 15, 0, 0, TAU);
      ctx.strokeStyle = `rgba(${i % 2 ? '242,110,120' : '255,170,120'},${0.35 - i * 0.02})`; ctx.lineWidth = 6 - i * 0.3; ctx.stroke();
    }
  }
  const band = ctx.createLinearGradient(0, top + body * 0.82, 0, bot);
  band.addColorStop(0, '#ff9a8a'); band.addColorStop(1, '#f2566c');
  ctx.fillStyle = band; ctx.fillRect(0, top + body * 0.82, w, bot - top - body * 0.82 + 8);
  bubbles(ctx, rand, 0, top, w, body * 0.8, 120, '242,110,120', 0.35, 7);
  citrus(ctx, cx, top + body * 0.24, body * 0.18, GRAPEFRUIT, rand);
  leaf(ctx, cx + body * 0.15, top + body * 0.09, body * 0.15, -0.5, '#6cbf3a', '#2f7d22');
  T(ctx, 'little', cx, top + body * 0.53, F(800, 96), '#e0465a', { track: -2, shadow: 'rgba(255,255,255,0.9)', blur: 8 });
  T(ctx, 'ripple', cx, top + body * 0.65, F(800, 96), '#e0465a', { track: -2, shadow: 'rgba(255,255,255,0.9)', blur: 8 });
  T(ctx, 'SPARKLING WATER', cx, top + body * 0.715, F(700, 22), '#7a3c44', { track: 10 });
  T(ctx, 'GRAPEFRUIT', cx, top + body * 0.785, F(900, 38, DISP), '#f05a6e', { track: 8 });
  T(ctx, '0 CALORIES · 0 SWEETENERS · 0 SODIUM', cx, top + body * 0.9, F(800, 20), '#ffffff', { track: 3 });
  T(ctx, '12 FL OZ (355 mL)', cx, bot - 14, F(700, 22), '#ffffff', { track: 2 });
  ctx.fillStyle = '#f2566c'; ctx.fillRect(0, 0, w, top - 6); ctx.fillRect(0, bot + 6, w, h - bot);
  for (let i = 0; i < 8; i++) T(ctx, 'little ripple', (i + 0.5) * (w / 8), top * 0.64, F(800, top * 0.25), '#ffe1dc');
  T(ctx, 'NATURALLY ESSENCED', w * 0.74, top + body * 0.42, F(800, 22), '#e0465a', { track: 8, rot: -Math.PI / 2 });
  // back
  const nh = nutritionFacts(ctx, w * 0.07, top + 26, w * 0.16, RIPPLE_NF);
  wrapText(ctx, 'INGREDIENTS: CARBONATED WATER, NATURAL GRAPEFRUIT FLAVOR.', w * 0.07, top + 26 + nh + 28, w * 0.16, 20, F(600, 15), '#7a3c44');
  upc(ctx, w * 0.835, top + body * 0.1, w * 0.12, body * 0.22, '08671200355', -Math.PI / 2);
  T(ctx, DEPOSIT, w * 0.895, top + body * 0.66, F(700, 13), '#7a3c44');
  T(ctx, 'LITTLE RIPPLE WATER CO. · ASHEVILLE, NC', w * 0.895, top + body * 0.71, F(500, 13), '#7a3c44');
});

// ---------- Sunbolt lemon-lime soda (2 L) ----------
const L2 = { r: 0.0548, y0: 0.075, y1: 0.175 };
design('drinks-lemonlime-2l', 2048, Math.round(2048 * (L2.y1 - L2.y0) / (TAU * L2.r)), (ctx, w, h) => {
  const rand = mulberry32(2000);
  const cx = w * FRONT;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b6b33'); g.addColorStop(0.5, '#1f9d45'); g.addColorStop(1, '#0a5a2a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // sunburst behind the logo
  ctx.save(); ctx.translate(cx, h * 0.48);
  for (let i = 0; i < 36; i++) {
    ctx.rotate(TAU / 36);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.3, -18); ctx.lineTo(w * 0.3, 18); ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(255,240,90,0.13)' : 'rgba(255,255,255,0.05)'; ctx.fill();
  }
  ctx.restore();
  const glow = ctx.createRadialGradient(cx, h * 0.45, 10, cx, h * 0.45, h * 0.7);
  glow.addColorStop(0, 'rgba(255,248,150,0.55)'); glow.addColorStop(1, 'rgba(255,248,150,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  bubbles(ctx, rand, 0, 0, w, h, 260, '255,255,255', 0.4, 9);
  // fruit
  citrus(ctx, cx - 360, h * 0.52, h * 0.3, LIME, rand);
  citrus(ctx, cx + 360, h * 0.5, h * 0.32, LEMON, rand);
  leaf(ctx, cx + 450, h * 0.18, h * 0.28, -0.6, '#7ccc3a', '#2f7d22');
  // wordmark
  ctx.save(); ctx.translate(cx, h * 0.3);
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fillStyle = '#ffe23a'; ctx.fill();
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillRect(40, -4, 18, 8); }
  ctx.restore();
  T(ctx, 'SUNBOLT', cx, h * 0.66, F(900, 136, DISP), '#ffffff', { skew: -0.18, stroke: '#0a4d24', lw: 16, shadow: 'rgba(0,0,0,0.4)', blur: 14, sy: 6, max: w * 0.27 });
  T(ctx, 'LEMON-LIME SODA', cx, h * 0.79, F(900, 40, DISP), '#ffe95a', { track: 8, stroke: '#0a4d24', lw: 6 });
  ctx.fillStyle = '#0a4d24'; ctx.fillRect(0, h * 0.86, w, h * 0.14);
  T(ctx, '2 LITERS (67.6 FL OZ)', cx, h * 0.955, F(800, 40), '#ffffff', { track: 4 });
  T(ctx, 'CAFFEINE FREE', cx + 520, h * 0.955, F(800, 26), '#ffe95a', { track: 4 });
  T(ctx, '100% NATURAL FLAVORS', cx - 540, h * 0.955, F(800, 26), '#ffe95a', { track: 4 });
  // back
  const nh = nutritionFacts(ctx, w * 0.08, h * 0.04, w * 0.11, {
    serv: 'About 5.5 servings per container', size: '12 fl oz (360mL)', kcal: 140,
    rows: [['Total Fat', '0g', '0%'], ['Sodium', '65mg', '3%'], ['Total Carbohydrate', '38g', '14%'], ['Total Sugars', '38g', '', 1], ['Includes 38g Added Sugars', '', '76%', 2], ['Protein', '0g', '']],
  });
  void nh;
  wrapText(ctx, 'INGREDIENTS: CARBONATED WATER, HIGH FRUCTOSE CORN SYRUP, CITRIC ACID, NATURAL FLAVORS, SODIUM CITRATE, SODIUM BENZOATE (TO PROTECT TASTE).',
    w * 0.19, h * 0.12, w * 0.085, 22, F(600, 17), '#eaffd8');
  upc(ctx, w * 0.865, h * 0.1, w * 0.1, h * 0.36, '04498702000');
  T(ctx, DEPOSIT, w * 0.915, h * 0.58, F(700, 15), '#eaffd8', { max: w * 0.16 });
  T(ctx, 'SUNBOLT BOTTLING · FRESNO, CA 93721', w * 0.915, h * 0.64, F(500, 15), '#cfe9c0', { max: w * 0.16 });
  recycleMark(ctx, w * 0.915, h * 0.75, 44, '#eaffd8', '1');
});

// ---------- Harbor Market spring water (1 gallon) ----------
function harborLogo(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#0f3a66'; ctx.fill();
  ctx.lineWidth = r * 0.08; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, TAU); ctx.stroke();
  // anchor
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y - r * 0.42, r * 0.11, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.3); ctx.lineTo(x, y + r * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r * 0.28, y - r * 0.14); ctx.lineTo(x + r * 0.28, y - r * 0.14); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y + r * 0.06, r * 0.45, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  // wave
  ctx.strokeStyle = '#4fc3e8'; ctx.lineWidth = r * 0.08;
  ctx.beginPath(); ctx.moveTo(x - r * 0.62, y + r * 0.58);
  ctx.bezierCurveTo(x - r * 0.3, y + r * 0.42, x - r * 0.1, y + r * 0.74, x + r * 0.2, y + r * 0.58);
  ctx.bezierCurveTo(x + r * 0.4, y + r * 0.48, x + r * 0.5, y + r * 0.62, x + r * 0.62, y + r * 0.56); ctx.stroke();
  ctx.restore();
}
const JUG = { W: 0.152, D: 0.152, H: 0.205, round: 0.016, lw: 0.118, lh: 0.1, ly: 0.1 };
design('drinks-gallon-front', 1024, Math.round(1024 * JUG.lh / JUG.lw), (ctx, w, h) => {
  const rand = mulberry32(3785);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#9fd8ff'); sky.addColorStop(1, '#f2fbff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // mountains with snow caps
  const range = (base, peaks, col) => {
    ctx.beginPath(); ctx.moveTo(0, base);
    peaks.forEach(([x, y]) => ctx.lineTo(w * x, h * y));
    ctx.lineTo(w, base); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  range(h * 0.5, [[0.1, 0.36], [0.22, 0.44], [0.38, 0.2], [0.52, 0.38], [0.66, 0.26], [0.82, 0.42], [0.95, 0.34]], '#5b8fbf');
  ctx.fillStyle = '#ffffff';
  [[0.38, 0.2], [0.66, 0.26]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(w * x, h * y); ctx.lineTo(w * (x - 0.05), h * (y + 0.07)); ctx.lineTo(w * (x - 0.015), h * (y + 0.055)); ctx.lineTo(w * (x + 0.02), h * (y + 0.075)); ctx.lineTo(w * (x + 0.05), h * (y + 0.065)); ctx.closePath(); ctx.fill(); });
  range(h * 0.6, [[0.15, 0.48], [0.35, 0.56], [0.55, 0.46], [0.78, 0.55], [1, 0.5]], '#3d7f5a');
  // spring stream
  ctx.beginPath(); ctx.moveTo(w * 0.47, h * 0.5); ctx.bezierCurveTo(w * 0.4, h * 0.56, w * 0.6, h * 0.6, w * 0.38, h * 0.66); ctx.lineTo(w * 0.62, h * 0.66); ctx.bezierCurveTo(w * 0.66, h * 0.6, w * 0.5, h * 0.56, w * 0.53, h * 0.5); ctx.closePath();
  ctx.fillStyle = '#bfe9ff'; ctx.fill();
  // navy band with the brand
  const band = ctx.createLinearGradient(0, h * 0.6, 0, h);
  band.addColorStop(0, '#13497d'); band.addColorStop(1, '#0b2f55');
  ctx.fillStyle = band; ctx.beginPath(); ctx.moveTo(0, h * 0.64); ctx.bezierCurveTo(w * 0.3, h * 0.6, w * 0.7, h * 0.7, w, h * 0.63); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  harborLogo(ctx, w * 0.5, h * 0.17, h * 0.11);
  T(ctx, 'HARBOR MARKET', w * 0.5, h * 0.33, F(900, 46, DISP), '#0f3a66', { track: 10, stroke: 'rgba(255,255,255,0.9)', lw: 8 });
  T(ctx, 'SPRING WATER', w * 0.5, h * 0.79, F(900, 112, DISP), '#ffffff', { track: 2, max: w * 0.92 });
  T(ctx, '1 GALLON (3.78 L)', w * 0.5, h * 0.88, F(800, 50), '#9fe0ff', { track: 4 });
  T(ctx, 'NATURALLY SODIUM FREE · BOTTLED AT THE SOURCE', w * 0.5, h * 0.95, F(600, 24), '#d7ecff', { track: 2 });
  bubbles(ctx, rand, 0, h * 0.66, w, h * 0.3, 30, '180,230,255', 0.25, 5);
});
design('drinks-gallon-back', 1024, Math.round(1024 * JUG.lh / JUG.lw), (ctx, w, h) => {
  ctx.fillStyle = '#f4f9fd'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0f3a66'; ctx.fillRect(0, 0, w, h * 0.12); ctx.fillRect(0, h * 0.94, w, h * 0.06);
  T(ctx, 'HARBOR MARKET SPRING WATER', w / 2, h * 0.085, F(800, 40), '#ffffff', { track: 4 });
  nutritionFacts(ctx, w * 0.05, h * 0.16, w * 0.42, {
    serv: '16 servings per container', size: '8 fl oz (240mL)', kcal: 0,
    rows: [['Total Fat', '0g', '0%'], ['Sodium', '0mg', '0%'], ['Total Carbohydrate', '0g', '0%'], ['Total Sugars', '0g', '', 1], ['Protein', '0g', '']],
    extra: [['Not a significant source of other nutrients.', '', '']],
  });
  wrapText(ctx, 'SOURCE: Cedar Hollow Spring, Laurel Ridge, PA. Our spring water is naturally filtered through layers of rock, then ozonated and micro-filtered for purity.', w * 0.53, h * 0.2, w * 0.43, 34, F(500, 26), '#173b5c');
  wrapText(ctx, 'Store in a cool, dry place away from sunlight and chemicals. Refrigerate after opening.', w * 0.53, h * 0.5, w * 0.43, 34, F(500, 26), '#173b5c');
  upc(ctx, w * 0.56, h * 0.64, w * 0.3, h * 0.22, '07170403785');
  recycleMark(ctx, w * 0.92, h * 0.76, 60, '#173b5c', '2');
  T(ctx, 'Distributed by Harbor Market Inc., Portland, ME 04101', w / 2, h * 0.985, F(500, 22), '#ffffff');
});

// ---------- Sunvale orange juice (52 oz) ----------
const OJL = { r: 0.0524, y0: 0.024, y1: 0.098 };
design('drinks-oj-52', 2048, Math.round(2048 * (OJL.y1 - OJL.y0) / (TAU * OJL.r)), (ctx, w, h) => {
  const rand = mulberry32(52);
  const cx = w * FRONT;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(0.62, '#fff1d6'); g.addColorStop(0.63, '#f7a21b'); g.addColorStop(1, '#e8730a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // sunrise rays
  ctx.save(); ctx.translate(cx, h * 0.62);
  for (let i = 0; i < 18; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 18); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.05) * w * 0.4, Math.sin(a - 0.05) * w * 0.4); ctx.lineTo(Math.cos(a + 0.05) * w * 0.4, Math.sin(a + 0.05) * w * 0.4); ctx.closePath(); ctx.fillStyle = 'rgba(255,190,80,0.12)'; ctx.fill(); }
  ctx.restore();
  // orange grove art on the left of the front
  leaf(ctx, cx - 470, h * 0.36, h * 0.34, -1.95);
  leaf(ctx, cx - 300, h * 0.3, h * 0.36, -0.7);
  fruit(ctx, cx - 440, h * 0.52, h * 0.26, '#f4870f', '#ffc061', '#c25a05', rand);
  citrus(ctx, cx - 285, h * 0.62, h * 0.25, ORANGE, rand);
  // wordmark
  T(ctx, 'Sunvale', cx + 110, h * 0.36, F(700, 120, SERIF, 'italic'), '#e2620b', { stroke: '#ffffff', lw: 10, shadow: 'rgba(120,50,0,0.35)', blur: 10, sy: 4 });
  T(ctx, '100% ORANGE JUICE', cx + 120, h * 0.53, F(900, 46, DISP), '#1f5e2c', { track: 5 });
  T(ctx, 'NOT FROM CONCENTRATE · PASTEURIZED', cx + 120, h * 0.6, F(700, 20), '#7a4a1a', { track: 3 });
  // NO PULP badge
  rrect(ctx, cx + 380, h * 0.12, 190, 70, 35); ctx.fillStyle = '#1f5e2c'; ctx.fill();
  T(ctx, 'NO PULP', cx + 475, h * 0.12 + 48, F(900, 34, DISP), '#ffffff', { track: 4 });
  T(ctx, '52 FL OZ (1.53 L)', cx + 110, h * 0.82, F(800, 40), '#ffffff', { track: 4 });
  T(ctx, 'KEEP REFRIGERATED', cx + 110, h * 0.93, F(800, 22), '#fff1d6', { track: 6 });
  T(ctx, 'GOOD SOURCE OF POTASSIUM', cx + 500, h * 0.93, F(800, 20), '#fff1d6', { track: 2 });
  // back
  nutritionFacts(ctx, w * 0.1, h * 0.03, w * 0.075, {
    serv: 'About 6.5 servings per container', size: '8 fl oz (240mL)', kcal: 110,
    rows: [['Total Fat', '0g', '0%'], ['Sodium', '0mg', '0%'], ['Total Carbohydrate', '26g', '9%'], ['Dietary Fiber', '<1g', '2%', 1], ['Total Sugars', '22g', '', 1], ['Includes 0g Added Sugars', '', '0%', 2], ['Protein', '2g', '']],
    extra: [['Vitamin C', '72mg', '80%'], ['Potassium', '450mg', '10%']],
  });
  wrapText(ctx, 'INGREDIENTS: 100% PURE SQUEEZED PASTEURIZED ORANGE JUICE. Shake well. Keep refrigerated. Once opened, enjoy within 7-10 days.', w * 0.18, h * 0.1, w * 0.07, 21, F(600, 16), '#5a3410');
  upc(ctx, w * 0.865, h * 0.06, w * 0.08, h * 0.4, '04877005200');
  T(ctx, 'Sunvale Groves · Lake Wales, FL 33853', w * 0.905, h * 0.56, F(600, 15), '#5a3410', { max: w * 0.15 });
  recycleMark(ctx, w * 0.905, h * 0.7, 36, '#ffffff', '1');
});

// ---------- Stride sports drink (28 oz) ----------
const SPL = { r: 0.0408, y0: 0.024, y1: 0.108 };
design('drinks-sport-28', 1536, Math.round(1536 * (SPL.y1 - SPL.y0) / (TAU * SPL.r)), (ctx, w, h) => {
  const rand = mulberry32(28);
  const cx = w * FRONT;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#071840'); g.addColorStop(0.5, '#0d3a8c'); g.addColorStop(1, '#071840');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // speed stripes
  for (let i = 0; i < 14; i++) {
    const x = rand() * w, sw = 10 + rand() * 50;
    ctx.fillStyle = i % 3 ? `rgba(60,180,255,${0.12 + rand() * 0.2})` : `rgba(255,255,255,${0.08 + rand() * 0.1})`;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + sw, 0); ctx.lineTo(x + sw - h * 0.5, h); ctx.lineTo(x - h * 0.5, h); ctx.closePath(); ctx.fill();
  }
  // droplet mark
  ctx.save(); ctx.translate(cx - 270, h * 0.38);
  ctx.beginPath(); ctx.moveTo(0, -56); ctx.bezierCurveTo(30, -14, 40, 6, 40, 22); ctx.arc(0, 22, 40, 0, Math.PI); ctx.bezierCurveTo(-40, 6, -30, -14, 0, -56);
  const dg = ctx.createLinearGradient(0, -56, 0, 62); dg.addColorStop(0, '#9ff0ff'); dg.addColorStop(1, '#1aa8ff');
  ctx.fillStyle = dg; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-14, 16, 8, 16, -0.3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  ctx.restore();
  T(ctx, 'STRIDE', cx + 40, h * 0.48, F(900, 124, DISP), '#ffffff', { skew: -0.25, stroke: '#00c2ff', lw: 8, shadow: 'rgba(0,0,0,0.5)', blur: 14, sy: 5, max: w * 0.3 });
  T(ctx, 'ELECTROLYTE SPORTS DRINK', cx, h * 0.6, F(800, 28), '#9fe3ff', { track: 8 });
  rrect(ctx, cx - 210, h * 0.66, 420, 64, 32); ctx.fillStyle = '#00c2ff'; ctx.fill();
  T(ctx, 'BLUE RASPBERRY', cx, h * 0.66 + 46, F(900, 38, DISP), '#071840', { track: 4 });
  T(ctx, '28 FL OZ (828 mL)', cx, h * 0.92, F(800, 30), '#ffffff', { track: 3 });
  T(ctx, 'REPLENISH · REHYDRATE', cx + 40, h * 0.17, F(800, 22), '#9fe3ff', { track: 4 });
  T(ctx, '380mg SODIUM · 110mg POTASSIUM', cx - 330, h * 0.83, F(800, 18), '#ffffff', { track: 2 });
  nutritionFacts(ctx, w * 0.07, h * 0.03, w * 0.1, {
    serv: 'About 2.5 servings per container', size: '12 fl oz (360mL)', kcal: 80,
    rows: [['Total Fat', '0g', '0%'], ['Sodium', '160mg', '7%'], ['Total Carbohydrate', '22g', '8%'], ['Total Sugars', '21g', '', 1], ['Includes 21g Added Sugars', '', '42%', 2], ['Protein', '0g', '']],
    extra: [['Potassium', '50mg', '2%']],
  });
  wrapText(ctx, 'INGREDIENTS: WATER, SUGAR, DEXTROSE, CITRIC ACID, SALT, SODIUM CITRATE, MONOPOTASSIUM PHOSPHATE, NATURAL FLAVOR, BLUE 1.', w * 0.18, h * 0.1, w * 0.1, 20, F(600, 15), '#cfe8ff');
  upc(ctx, w * 0.84, h * 0.08, w * 0.11, h * 0.36, '05200002828');
  T(ctx, 'STRIDE SPORTS NUTRITION · AUSTIN, TX', w * 0.895, h * 0.6, F(600, 14), '#cfe8ff', { max: w * 0.17 });
  recycleMark(ctx, w * 0.895, h * 0.75, 40, '#cfe8ff', '1');
});

// ---------- Blackwater Bay cold brew (11 oz glass) ----------
// full-body shrink sleeve over the heel + straight body
const CBL = { r: 0.0323, y0: 0.004, y1: 0.1, top: 0.1, sleeve: [[0.0312, 0.004], [0.0321, 0.01], [0.0323, 0.02], [0.0323, 0.1]] };
design('drinks-coldbrew', 1024, Math.round(1024 * (CBL.y1 - CBL.y0) / (TAU * CBL.r)), (ctx, w, h) => {
  const rand = mulberry32(11);
  const cx = w * FRONT;
  kraft(ctx, w, h, rand);
  const ink = '#17110c';
  // emblem: crescent moon over three waves inside a ring
  const ey = h * 0.19, er = h * 0.12;
  ctx.save();
  ctx.lineWidth = 3; ctx.strokeStyle = ink;
  ctx.beginPath(); ctx.arc(cx, ey, er, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, ey, er * 0.88, 0, TAU); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - er * 0.18, ey - er * 0.2, er * 0.36, 0, TAU); ctx.fillStyle = ink; ctx.fill();
  ctx.beginPath(); ctx.arc(cx - er * 0.06, ey - er * 0.28, er * 0.32, 0, TAU); ctx.fillStyle = '#c7a172'; ctx.fill();
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const wy = ey + er * (0.25 + i * 0.18);
    ctx.beginPath();
    for (let x = -er * 0.7; x <= er * 0.7; x += 2) ctx.lineTo(cx + x, wy + Math.sin(x * 0.18 + i) * 3);
    ctx.stroke();
  }
  ctx.restore();
  T(ctx, 'BLACKWATER BAY', cx, h * 0.37, F(700, 27, CHARTER), ink, { track: 4 });
  ctx.fillStyle = ink; ctx.fillRect(cx - 120, h * 0.395, 70, 2); ctx.fillRect(cx + 50, h * 0.395, 70, 2);
  T(ctx, 'COFFEE CO.', cx, h * 0.405, F(700, 12), ink, { track: 3 });
  T(ctx, 'COLD', cx, h * 0.52, F(900, 62, DISP), ink, { track: 4 });
  T(ctx, 'BREW', cx, h * 0.635, F(900, 62, DISP), ink, { track: 4 });
  T(ctx, 'BLACK · UNSWEETENED', cx, h * 0.69, F(700, 14), '#4a2a14', { track: 3 });
  T(ctx, 'STEEPED 18 HOURS', cx, h * 0.73, F(600, 12), '#4a2a14', { track: 2 });
  T(ctx, '11 FL OZ (325 mL)', cx, h * 0.795, F(700, 16), ink, { track: 2 });
  // the heel: an ink band
  ctx.fillStyle = ink; ctx.fillRect(0, h * 0.835, w, h * 0.165);
  T(ctx, 'KEEP REFRIGERATED · SHAKE WELL · KEEP REFRIGERATED · SHAKE WELL', cx, h * 0.92, F(700, 14), '#d9b98a', { track: 4 });
  T(ctx, '200 MG CAFFEINE', w * 0.72, h * 0.45, F(800, 14), ink, { track: 4, rot: -Math.PI / 2 });
  T(ctx, 'SINGLE ORIGIN COLOMBIA', w * 0.38, h * 0.45, F(800, 13), ink, { track: 3, rot: -Math.PI / 2 });
  // back
  nutritionFacts(ctx, w * 0.06, h * 0.05, w * 0.15, {
    serv: '1 serving per container', size: '1 bottle', kcal: 5,
    rows: [['Total Fat', '0g', '0%'], ['Sodium', '15mg', '1%'], ['Total Carbohydrate', '1g', '0%'], ['Total Sugars', '0g', '', 1], ['Protein', '0g', '']],
    extra: [['Potassium', '300mg', '6%']],
  });
  wrapText(ctx, 'INGREDIENTS: COLD BREWED COFFEE (FILTERED WATER, COFFEE). Shake well. Keep refrigerated. Enjoy within 7 days of opening.', w * 0.79, h * 0.08, w * 0.16, 15, F(600, 11), ink);
  upc(ctx, w * 0.8, h * 0.4, w * 0.15, h * 0.22, '08609100011');
  T(ctx, 'BREWED IN PORTLAND, OR', w * 0.875, h * 0.68, F(700, 11), ink, { track: 2 });
  T(ctx, 'GLASS · PLEASE RECYCLE', w * 0.875, h * 0.72, F(700, 11), ink, { track: 2 });
}, 'matte');

// ---------- Porchlight iced tea (18.5 oz glass) ----------
const TEAL = { r: 0.0368, y0: 0.004, y1: 0.148, top: 0.135, sleeve: [[0.0349, 0.004], [0.0366, 0.01], [0.0368, 0.02], [0.0368, 0.135], [0.0358, 0.148]] };
design('drinks-icedtea', 1536, Math.round(1536 * (TEAL.y1 - TEAL.y0) / (TAU * TEAL.r)), (ctx, w, h) => {
  const rand = mulberry32(185);
  const cx = w * FRONT;
  ctx.fillStyle = '#f7f0de'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { ctx.fillStyle = `rgba(160,120,60,${rand() * 0.06})`; ctx.fillRect(rand() * w, rand() * h, 2, 2); }
  // shoulder: amber with a gold pinstripe
  ctx.fillStyle = '#6e3510'; ctx.fillRect(0, 0, w, h * 0.085);
  ctx.fillStyle = '#e8b45a'; ctx.fillRect(0, h * 0.085, w, 4);
  for (let i = 0; i < 3; i++) T(ctx, 'PORCHLIGHT ✦ BREWED TEA', (i + 0.5) * (w / 3), h * 0.058, F(700, h * 0.03), '#e8b45a', { track: 3 });
  // tea wave across the lower half
  const tg = ctx.createLinearGradient(0, h * 0.48, 0, h);
  tg.addColorStop(0, '#d4862a'); tg.addColorStop(0.45, '#a5541a'); tg.addColorStop(1, '#5e2c0c');
  ctx.beginPath(); ctx.moveTo(0, h * 0.5);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.5 + Math.sin(x * 0.012) * h * 0.022);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = tg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,180,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.5 + Math.sin(x * 0.012) * h * 0.022); ctx.stroke();
  bubbles(ctx, rand, 0, h * 0.55, w, h * 0.33, 110, '255,220,160', 0.25, 6);
  // lemon + tea leaves
  citrus(ctx, cx + 335, h * 0.3, h * 0.1, LEMON, rand);
  leaf(ctx, cx - 380, h * 0.26, h * 0.16, -0.4, '#5f9a3a', '#2f5e1e');
  leaf(ctx, cx - 360, h * 0.31, h * 0.14, 0.5, '#4f8a2e', '#2a521a');
  leaf(ctx, cx + 220, h * 0.17, h * 0.11, -1.2, '#5f9a3a', '#2f5e1e');
  // porch lantern mark
  ctx.save(); ctx.translate(cx, h * 0.17); ctx.scale(1.3, 1.3);
  const lg = ctx.createRadialGradient(0, 8, 2, 0, 8, 40); lg.addColorStop(0, 'rgba(255,210,90,0.9)'); lg.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(0, 8, 40, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 3; ctx.fillStyle = '#ffd36a';
  ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(12, -12); ctx.lineTo(16, 24); ctx.lineTo(-16, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(18, -12); ctx.lineTo(0, -24); ctx.closePath(); ctx.fillStyle = '#3b2412'; ctx.fill();
  ctx.fillRect(-19, 24, 38, 5);
  ctx.restore();
  T(ctx, 'Porchlight', cx, h * 0.34, F(700, 112, SERIF, 'italic'), '#3b2412', { shadow: 'rgba(255,255,255,0.8)', blur: 6, max: w * 0.28 });
  T(ctx, 'BREWED ICED TEA', cx, h * 0.41, F(800, 32), '#a0521c', { track: 8 });
  T(ctx, 'LEMON', cx, h * 0.62, F(900, 64, DISP), '#ffe27a', { track: 14, stroke: '#5a2a0c', lw: 7 });
  T(ctx, 'REAL BREWED BLACK TEA', cx, h * 0.68, F(700, 22), '#ffeccc', { track: 4 });
  T(ctx, 'SWEETENED WITH CANE SUGAR', cx, h * 0.715, F(700, 22), '#ffeccc', { track: 4 });
  T(ctx, '18.5 FL OZ (547 mL)', cx, h * 0.8, F(800, 28), '#ffffff', { track: 3 });
  ctx.fillStyle = 'rgba(40,16,4,0.55)'; ctx.fillRect(0, h * 0.89, w, h * 0.11);
  // back
  nutritionFacts(ctx, w * 0.08, h * 0.11, w * 0.11, {
    serv: '1 serving per container', size: '1 bottle', kcal: 160,
    rows: [['Total Fat', '0g', '0%'], ['Sodium', '15mg', '1%'], ['Total Carbohydrate', '42g', '15%'], ['Total Sugars', '41g', '', 1], ['Includes 40g Added Sugars', '', '80%', 2], ['Protein', '0g', '']],
    extra: [['Caffeine', '50mg', '']],
  });
  wrapText(ctx, 'INGREDIENTS: BREWED BLACK TEA (FILTERED WATER, BLACK TEA LEAVES), CANE SUGAR, CITRIC ACID, NATURAL LEMON FLAVOR. Refrigerate after opening.', w * 0.19, h * 0.14, w * 0.09, 21, F(600, 16), '#3b2412');
  upc(ctx, w * 0.845, h * 0.12, w * 0.1, h * 0.2, '06321800185');
  T(ctx, 'PORCHLIGHT TEA CO. · SAVANNAH, GA', w * 0.895, h * 0.42, F(600, 15), '#3b2412', { max: w * 0.18 });
  T(ctx, DEPOSIT, w * 0.895, h * 0.45, F(700, 13), '#3b2412', { max: w * 0.18 });
});

// ---------- Tiny Grove apple juice box (200 mL) ----------
const JB = { W: 0.052, H: 0.105, D: 0.04 };
const JB_NF = {
  serv: '1 serving per container', size: '1 box', kcal: 90,
  rows: [['Total Fat', '0g', '0%'], ['Sodium', '15mg', '1%'], ['Total Carbohydrate', '23g', '8%'], ['Total Sugars', '21g', '', 1], ['Includes 0g Added Sugars', '', '0%', 2], ['Protein', '0g', '']],
  extra: [['Vitamin C', '90mg', '100%'], ['Potassium', '210mg', '4%']],
};
function groveSky(ctx, w, h, rand) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#9ed9ff'); g.addColorStop(0.55, '#e6f7ff'); g.addColorStop(0.56, '#8fd14f'); g.addColorStop(1, '#3f9a2c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#6cbf3a';
  ctx.beginPath(); ctx.moveTo(0, h * 0.6); ctx.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.58); ctx.quadraticCurveTo(w * 0.85, h * 0.63, w, h * 0.56); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,255,255,${rand() * 0.15})`; ctx.fillRect(rand() * w, h * 0.6 + rand() * h * 0.4, 2, 5); }
}
registerLabel('drinks-ajbox', {
  w: 1536, h: 1024, finish: 'gloss',
  draw(ctx, W, H) {
    const rand = mulberry32(675);
    const k = 5000; // virtual px per meter
    // FRONT
    atlasCell(ctx, W, H, 4, JB.W * k, JB.H * k, (c, w, h) => {
      groveSky(c, w, h, rand);
      // sun
      const sg = c.createRadialGradient(w * 0.82, h * 0.12, 4, w * 0.82, h * 0.12, 50); sg.addColorStop(0, '#fff6a0'); sg.addColorStop(0.5, '#ffd84a'); sg.addColorStop(1, 'rgba(255,216,74,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(w * 0.82, h * 0.12, 50, 0, TAU); c.fill();
      T(c, 'Tiny Grove', w / 2, h * 0.14, F(800, 40), '#2f7d2a', { stroke: '#ffffff', lw: 8, max: w * 0.92 });
      apple(c, w / 2, h * 0.43, w * 0.27, rand);
      // juice splash drops
      for (let i = 0; i < 8; i++) { const a = rand() * TAU; c.beginPath(); c.arc(w / 2 + Math.cos(a) * w * 0.38, h * 0.43 + Math.sin(a) * w * 0.33, 3 + rand() * 5, 0, TAU); c.fillStyle = 'rgba(255,220,120,0.85)'; c.fill(); }
      rrect(c, w * 0.06, h * 0.64, w * 0.88, 74, 12); c.fillStyle = '#ffffff'; c.fill();
      T(c, '100% APPLE', w / 2, h * 0.64 + 34, F(900, 30, DISP), '#c8261d', { max: w * 0.82 });
      T(c, 'JUICE', w / 2, h * 0.64 + 66, F(900, 30, DISP), '#c8261d', { track: 6 });
      T(c, 'NO SUGAR ADDED*', w / 2, h * 0.85, F(800, 17), '#ffffff', { track: 1, max: w * 0.9 });
      T(c, '6.75 FL OZ (200 mL)', w / 2, h * 0.95, F(700, 17), '#ffffff', { max: w * 0.9 });
    });
    // BACK
    atlasCell(ctx, W, H, 5, JB.W * k, JB.H * k, (c, w, h) => {
      c.fillStyle = '#fff8e8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3f9a2c'; c.fillRect(0, 0, w, h * 0.12); c.fillRect(0, h * 0.9, w, h * 0.1);
      T(c, 'APPLE FUN FACT', w / 2, h * 0.08, F(800, 18), '#ffffff', { track: 1, max: w * 0.9 });
      apple(c, w * 0.28, h * 0.24, w * 0.12, rand);
      wrapText(c, 'It takes about 3 apples to make one Tiny Grove juice box!', w * 0.46, h * 0.2, w * 0.5, 20, F(600, 16), '#3b2a14');
      wrapText(c, 'Shake well. Best served cold. Do not squeeze the box when the straw is in!', w * 0.08, h * 0.42, w * 0.84, 20, F(500, 16), '#3b2a14');
      recycleMark(c, w / 2, h * 0.72, 46, '#3f9a2c');
      T(c, 'PLEASE RECYCLE', w / 2, h * 0.82, F(800, 15), '#3f9a2c', { track: 2 });
      T(c, '*NOT A REDUCED CALORIE FOOD', w / 2, h * 0.96, F(600, 12), '#ffffff', { max: w * 0.92 });
    });
    // +X side: nutrition
    atlasCell(ctx, W, H, 0, JB.D * k, JB.H * k, (c, w, h) => {
      c.fillStyle = '#8fd14f'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(40,90,20,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * 0.09); c.lineTo(w, 0); c.stroke(); // folded ear
      nutritionFacts(c, w * 0.06, h * 0.12, w * 0.88, JB_NF);
    });
    // -X side: ingredients + barcode
    atlasCell(ctx, W, H, 1, JB.D * k, JB.H * k, (c, w, h) => {
      c.fillStyle = '#8fd14f'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(40,90,20,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * 0.09); c.lineTo(w, 0); c.stroke();
      T(c, 'Tiny Grove', w / 2, h * 0.17, F(800, 26), '#2f7d2a', { stroke: '#ffffff', lw: 5, max: w * 0.9 });
      wrapText(c, 'INGREDIENTS: FILTERED WATER, APPLE JUICE CONCENTRATE, ASCORBIC ACID (VITAMIN C).', w * 0.08, h * 0.25, w * 0.84, 17, F(700, 13), '#1f3d12');
      wrapText(c, 'Pasteurized. No refrigeration needed until opened. Distributed by Tiny Grove Foods, Yakima, WA 98901.', w * 0.08, h * 0.45, w * 0.84, 15, F(500, 11.5), '#1f3d12');
      upc(c, w * 0.1, h * 0.66, w * 0.8, h * 0.18, '04191600200');
      T(c, 'BEST BY 06 14 27', w / 2, h * 0.95, F(700, 12, '"DejaVu Sans Mono", monospace'), '#1f3d12');
    });
    // TOP: straw hole marker (hole at x +14 mm, z +8 mm)
    atlasCell(ctx, W, H, 2, JB.W * k, JB.D * k, (c, w, h) => {
      c.fillStyle = '#e8f5d2'; c.fillRect(0, 0, w, h);
      const hx = (0.014 + JB.W / 2) * k, hy = (0.008 + JB.D / 2) * k;
      c.setLineDash([5, 4]); c.strokeStyle = '#3f9a2c'; c.lineWidth = 2.5; c.beginPath(); c.arc(hx, hy, 30, 0, TAU); c.stroke(); c.setLineDash([]);
      T(c, 'STRAW', hx - 80, hy - 6, F(800, 16), '#2f7d2a');
      T(c, 'HERE ›', hx - 80, hy + 14, F(800, 16), '#2f7d2a');
      T(c, 'Tiny Grove', w * 0.3, h * 0.88, F(800, 18), '#2f7d2a');
    });
    // BOTTOM
    atlasCell(ctx, W, H, 3, JB.W * k, JB.D * k, (c, w, h) => {
      c.fillStyle = '#3f9a2c'; c.fillRect(0, 0, w, h);
      T(c, 'L2 0614 27 14:32', w / 2, h / 2, F(700, 16, '"DejaVu Sans Mono", monospace'), '#e8f5d2');
    });
  },
});
// 8-pack tray walls
const TR = { W: 0.2115, D: 0.1005, H: 0.04 };
registerLabel('drinks-ajbox-8pk-wall', {
  w: 1024, h: Math.round(1024 * TR.H / TR.W), finish: 'matte',
  draw(ctx, w, h) {
    const rand = mulberry32(8);
    groveSky(ctx, w, h * 1.6, rand);
    ctx.fillStyle = 'rgba(47,125,42,0.9)'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
    apple(ctx, w * 0.08, h * 0.45, h * 0.3, rand);
    T(ctx, 'Tiny Grove', w * 0.3, h * 0.5, F(800, h * 0.4), '#2f7d2a', { stroke: '#ffffff', lw: 8 });
    T(ctx, '100% APPLE JUICE', w * 0.72, h * 0.42, F(900, h * 0.22, DISP), '#c8261d', { stroke: '#ffffff', lw: 5 });
    T(ctx, '8 - 6.75 FL OZ (200 mL) BOXES · 54 FL OZ (1.6 L)', w * 0.5, h * 0.88, F(700, h * 0.17), '#ffffff', { track: 1 });
  },
});
registerLabel('drinks-ajbox-8pk-side', {
  w: 512, h: Math.round(512 * TR.H / TR.D), finish: 'matte',
  draw(ctx, w, h) {
    ctx.fillStyle = '#3f9a2c'; ctx.fillRect(0, 0, w, h);
    T(ctx, '8 PACK', w / 2, h * 0.62, F(900, h * 0.45, DISP), '#ffffff', { track: 6 });
  },
});

// ============================================================================================
// bottle shapes
// ============================================================================================
// 2 L PET: petaloid base, 10.9 cm wide, 31.5 cm tall with the cap
const PET2L = [[0, 0.006], [0.02, 0.0022], [0.032, 0], [0.042, 0.003], [0.05, 0.012], [0.054, 0.028], [0.0545, 0.045], [0.0545, 0.19], [0.0532, 0.205], [0.0485, 0.226],
  [0.041, 0.246], [0.032, 0.263], [0.0225, 0.276], [0.0158, 0.2845], [0.0138, 0.2885], [0.0138, 0.2985], [0.013, 0.2988]];
// 52 oz OJ carafe: round with a grip waist, 38 mm cap
const OJB = [[0, 0.005], [0.025, 0.002], [0.04, 0], [0.0485, 0.004], [0.0515, 0.012], [0.052, 0.024], [0.052, 0.098], [0.0495, 0.108], [0.045, 0.118], [0.0442, 0.13], [0.0458, 0.142],
  [0.0505, 0.152], [0.052, 0.162], [0.052, 0.192], [0.0495, 0.206], [0.0435, 0.219], [0.0355, 0.229], [0.0275, 0.236], [0.0228, 0.239], [0.0212, 0.242], [0.0212, 0.252], [0.0204, 0.2524]];
// 28 oz sports bottle: grip waist, wide 38 mm mouth
const SPB = [[0, 0.005], [0.02, 0.002], [0.032, 0], [0.038, 0.004], [0.0402, 0.012], [0.0405, 0.022], [0.0405, 0.112], [0.038, 0.122], [0.0345, 0.132], [0.034, 0.142], [0.0365, 0.152],
  [0.0402, 0.162], [0.0405, 0.172], [0.0405, 0.19], [0.0385, 0.2], [0.033, 0.209], [0.0265, 0.215], [0.0225, 0.218], [0.0212, 0.221], [0.0212, 0.229], [0.0204, 0.2294]];
// 11 oz glass stubby (cold brew)
const CBB = [[0, 0.0055], [0.02, 0.0028], [0.028, 0.0004], [0.0308, 0.003], [0.0318, 0.01], [0.032, 0.02], [0.032, 0.102], [0.0308, 0.112], [0.0275, 0.122], [0.0225, 0.131],
  [0.0185, 0.137], [0.0172, 0.1415], [0.0172, 0.1475], [0.0178, 0.149], [0.0178, 0.1515], [0.017, 0.1525]];
// 18.5 oz glass (iced tea): long shoulder
const TEAB = [[0, 0.006], [0.02, 0.0035], [0.03, 0.0005], [0.0345, 0.003], [0.0362, 0.01], [0.0365, 0.02], [0.0365, 0.135], [0.0355, 0.148], [0.0325, 0.162], [0.0275, 0.176],
  [0.0225, 0.188], [0.0195, 0.196], [0.0192, 0.199], [0.0198, 0.2005], [0.0198, 0.2025], [0.019, 0.2032]];

// a printed label/sleeve: an open tube (no end caps) following [r, y] points, art wraps once around
function band(profile, mat, extra = {}) {
  return lathe(profile, 0, 0, 0, mat, { seg: 56, uv: 'wrap', col: false, pack: true, ...extra });
}

function capParts(r, h, y, mat, ringR, ringY, extra = {}) {
  const parts = [
    cyl(r, h, 0, y + h / 2, 0, mat, { seg: 36, col: false, closed: true, ...extra }),
    cyl(r * 0.93, 0.0008, 0, y + h + 0.0004, 0, mat, { seg: 36, col: false, closed: true, ...extra }), // the slightly domed top
  ];
  if (ringR) parts.push(cyl(ringR, 0.0026, 0, ringY, 0, mat, { seg: 32, col: false, pack: true, ...extra })); // tamper ring stays on the neck
  return parts;
}

// ============================================================================================
// ITEMS
// ============================================================================================
const COLA_FOOD = {
  kind: 'drink',
  eat: { kcal: 140, waterL: 0.33, proteinG: 0, carbsG: 39, sugarG: 39, fatG: 0, fiberG: 0, sodiumMg: 45, caffeineMg: 34 },
  netKg: 0.37, bites: 11, bite: 'level', open: 'tab',
  // cans keep ~9 months; a frozen can bursts (so the freezer "ruins" it in a day); an open can goes flat in a day
  keep: 'room', shelf: { room: 270, fridge: 270, freezer: 1, opened: 1 },
  taste: ['Ice-cold cola: sweet, a little vanilla and spice, sharp bubbles.', 'Fizzy and sweet. Here comes the burp.', 'That first sip of a cold cola. Perfect.'],
  sound: 'fizz', leftover: 'keep',
};

const JUICEBOX_FOOD = {
  kind: 'drink',
  eat: { kcal: 90, waterL: 0.18, proteinG: 0, carbsG: 23, sugarG: 21, fatG: 0, fiberG: 0, sodiumMg: 15, caffeineMg: 0 },
  netKg: 0.209, bites: 10, bite: 'level', open: 'peel',
  keep: 'room', shelf: { room: 240, fridge: 240, freezer: 240, opened: 1 },
  taste: ['Sweet apple juice through a tiny straw. Very nostalgic.', 'Crisp, sweet apple. You squeeze the box a little and it shoots up the straw.'],
  sound: 'slurp', leftover: 'keep',
};

// one juice box (also used, lighter, as a unit in the 8-pack)
function juiceBoxParts(lite = false) {
  const { W, H, D } = JB;
  const hx = 0.014, hz = 0.008;
  const parts = [
    box(W, H, D, 0, H / 2, 0, 'label:drinks-ajbox', { uv: 'atlas', pack: true }),                               // the carton (+ its collision)
    box(W - 0.002, 0.0012, 0.008, 0, H + 0.0006, -0.004, 'plastic:0xd9ecbc', { col: false, pack: true }),        // the folded top seal fin
    cyl(0.0042, 0.0004, hx, H + 0.0002, hz, 'drinks-alu:foil', { seg: 20, col: false, closed: true }),          // foil over the straw hole
    // the straw in its cellophane, glued on the back
    cyl(0.0034, 0.096, -0.004, 0.054, -D / 2 - 0.0034, 'clearplastic', { seg: 12, col: false, closed: true, rot: [0, 0, -14] }),
    cyl(0.0021, 0.092, -0.004, 0.054, -D / 2 - 0.0034, 'plastic:0xf3efe4', { seg: 10, col: false, closed: true, rot: [0, 0, -14] }),
  ];
  if (lite) return parts;
  parts.push(
    box(W - 0.003, H - 0.005, D - 0.003, 0, H / 2, 0, 'liquid:0xd9a441:0.95', { col: false, liquid: true }),
    // opened: the straw poked through the hole, bent toward you
    curve([[0, -0.04, 0], [0, 0.03, 0], [0, 0.041, 0.004], [0, 0.047, 0.013]], 0.0021, hx, H, hz, 'plastic:0xf3efe4', { seg: 10, col: false, opened: true }),
    cyl(0.0042, 0.0004, hx, H + 0.0002, hz, 'plastic:0x0e0c08', { seg: 20, col: false, opened: true }),
  );
  return parts;
}

export default [
  // ---------------------------------------------------------------- Crestline Cola can
  {
    id: 'drinks-cola-can', aisle: 'drinks', name: 'Crestline Cola, 12 fl oz Can', brand: 'Crestline', price: 1.29, mass: 0.383,
    rating: 4.5, reviews: 6120,
    blurb: 'Classic cola in a 12 fl oz aluminum can. 140 calories, 34 mg caffeine. Best ice cold; don\'t freeze it, cans burst.',
    quotes: ['"Tastes like the old-school stuff. Not too syrupy."', '"Bought one from the checkout cooler and immediately wanted another."'],
    shop: true,
    food: COLA_FOOD,
    build() { return { mass: 0.383, parts: canParts(0.1228, 'drinks-cola-can') }; },
  },
  // ---------------------------------------------------------------- 12-pack fridge pack
  {
    id: 'drinks-cola-12pk', aisle: 'drinks', name: 'Crestline Cola, 12 pk 12 fl oz Cans (Fridge Pack)', brand: 'Crestline', price: 7.99, mass: 4.681,
    rating: 4.7, reviews: 18452,
    blurb: '12 cans in a fridge pack: they lie on their sides, two rows of six. Tear the perforated end flap and the cans roll out one at a time.',
    quotes: ['"Fits perfectly on the bottom shelf of my fridge."', '"The tear-open end is genius until the last two cans won\'t roll out."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 0, waterL: 0 }, netKg: 0, bites: 1, bite: 'none', open: 'tear',
      units: 12, unitId: 'drinks-cola-can',
      keep: 'room', shelf: { room: 270, fridge: 270, freezer: 1, opened: 0 },
      taste: ['Cola.'], sound: 'fizz', leftover: 'keep',
    },
    build() {
      const { L, H, D, t } = PK;
      const parts = [
        box(L, H, t, 0, H / 2, D / 2 - t / 2, 'label:drinks-cola-12pk-front', { uv: 'fit', col: false, pack: true }),
        box(L, H, t, 0, H / 2, -D / 2 + t / 2, 'label:drinks-cola-12pk-back', { uv: 'fit', col: false, pack: true }),
        box(L, t, D - 2 * t, 0, H - t / 2, 0, 'label:drinks-cola-12pk-top', { uv: 'fit', col: false, pack: true }),
        box(L, t, D - 2 * t, 0, t / 2, 0, 'label:drinks-cola-12pk-top', { uv: 'fit', col: false, pack: true }),
        box(t, PK.endH, PK.endW, -L / 2 + t / 2, H / 2, 0, 'label:drinks-cola-12pk-end', { uv: 'fit', col: false, pack: true }),
        // the dispenser end: a fixed strip at the bottom + the perforated flap that tears away
        box(t, PK.low, PK.endW, L / 2 - t / 2, t + PK.low / 2, 0, 'label:drinks-cola-12pk-endlow', { uv: 'fit', col: false, pack: true }),
        box(t, PK.flapH, PK.endW, L / 2 - t / 2, t + PK.low + PK.flapH / 2, 0, 'label:drinks-cola-12pk-flap', { uv: 'fit', col: false, closed: true }),
        box(L, H, D, 0, H / 2, 0, 'drinks-carton', { vis: false, pack: true }),                                    // the box's collision
      ];
      // 12 cans on their sides (axis front-to-back), 2 rows x 6. The two at the dispenser end come out first.
      const pitch = 0.0664;
      for (let col = 0; col < 6; col++) for (let row = 0; row < 2; row++) {
        const unit = col * 2 + row;
        const x = -L / 2 + t + 0.0335 + col * pitch, y = t + 0.0333 + row * pitch;
        // lying on its side with the logo turned toward the dispenser end
        parts.push(...place(canParts(0.1228, 'drinks-cola-can', { lite: true }), [x, y, -0.0614], [90, 90, 0], { unit }));
      }
      return { mass: 4.681, parts };
    },
  },
  // ---------------------------------------------------------------- Sunbolt 2 L
  {
    id: 'drinks-lemonlime-2l', aisle: 'drinks', name: 'Sunbolt Lemon-Lime Soda, 2 L Bottle', brand: 'Sunbolt', price: 2.79, mass: 2.133,
    rating: 4.4, reviews: 3877,
    blurb: 'Crisp, caffeine-free lemon-lime soda in a 2-liter bottle. Keeps its fizz about 3 days once opened if you cap it tight.',
    quotes: ['"Bright and citrusy, less sweet than the big brand."', '"Party staple. Cap clicks back on nice and tight."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 790, waterL: 1.87, proteinG: 0, carbsG: 214, sugarG: 214, fatG: 0, fiberG: 0, sodiumMg: 366, caffeineMg: 0 },
      netKg: 2.08, bites: 57, bite: 'level', open: 'cap',
      keep: 'room', shelf: { room: 120, fridge: 120, freezer: 1, opened: 3 },
      taste: ['Sharp lemon-lime fizz, clean and sweet.', 'Crisp and bubbly. Tastes like summer.', 'Cold lemon-lime soda. The bubbles bite.'],
      sound: 'fizz', leftover: 'keep',
    },
    build() {
      return { mass: 2.133, parts: [
        lathe(PET2L, 0, 0, 0, 'drinks-pet:0x1e8a3c', { seg: 40, col: false, pack: true }),
        lathe(liquidProfile(PET2L, 0.0012, 0.262), 0, 0, 0, 'liquid:0xd2ecc0:0.1', { seg: 36, col: false, liquid: true }),
        band([[L2.r, L2.y0], [L2.r, L2.y1]], 'label:drinks-lemonlime-2l'),
        ...capParts(0.0157, 0.0165, 0.2905, 'plastic:0x1f8a3a', 0.0172, 0.2878),
        cyl(0.0545, 0.3078, 0, 0.1539, 0, 'clearplastic', { vis: false, seg: 20 }),
      ] };
    },
  },
  // ---------------------------------------------------------------- Harbor Market gallon
  {
    id: 'drinks-water-gallon', aisle: 'drinks', name: 'Harbor Market Spring Water, 1 Gallon', brand: 'Harbor Market', price: 1.49, mass: 3.85,
    rating: 4.6, reviews: 9415,
    blurb: '1 gallon (3.78 L) of natural spring water in a recyclable HDPE jug with a carry handle. Refrigerate after opening.',
    quotes: ['"Cheapest good-tasting water in the store."', '"Handle is sturdy, cap snaps back on. Fits in the fridge door."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 0, waterL: 3.785, proteinG: 0, carbsG: 0, sugarG: 0, fatG: 0, fiberG: 0, sodiumMg: 15, caffeineMg: 0 },
      netKg: 3.785, bites: 108, bite: 'level', open: 'cap',
      keep: 'room', shelf: { room: 730, fridge: 730, freezer: 730, opened: 7 },
      taste: ['Cold, clean spring water.', 'Crisp and neutral. Just water.', 'Refreshing. Tastes faintly of minerals.'],
      sound: 'gulp', leftover: 'keep',
    },
    build() {
      const { W, D, H } = JUG;
      const dome = [[0.07, 0.199], [0.0695, 0.209], [0.064, 0.221], [0.053, 0.232], [0.039, 0.2395], [0.026, 0.2435], [0.0196, 0.2445]];
      return { mass: 3.85, parts: [
        box(W, H, D, 0, H / 2, 0, 'drinks-hdpe', { round: JUG.round, col: false, pack: true }),
        lathe(dome, 0, 0, 0, 'drinks-hdpe', { seg: 40, col: false, pack: true }),
        cyl(0.0196, 0.0145, 0, 0.2512, 0, 'drinks-hdpe', { seg: 28, col: false, pack: true }),                  // neck
        cyl(0.0232, 0.0022, 0, 0.2475, 0, 'drinks-hdpe', { seg: 28, col: false, pack: true }),                  // neck ring
        // molded carry handle at the back
        curve([[0, 0.236, -0.031], [0, 0.259, -0.044], [0, 0.2635, -0.06], [0, 0.251, -0.0705], [0, 0.224, -0.0712], [0, 0.198, -0.0682]], 0.0098, 0, 0, 0, 'drinks-hdpe', { seg: 14, col: false, pack: true }),
        box(W - 0.006, 0.195, D - 0.006, 0, 0.1005, 0, 'liquid:0xd2e9f1:0.2', { round: 0.013, col: false, liquid: true }),
        box(JUG.lw, JUG.lh, 0.0003, 0, JUG.ly, D / 2 + 0.0007, 'label:drinks-gallon-front', { uv: 'fit', col: false, pack: true }),
        box(JUG.lw, JUG.lh, 0.0002, 0, JUG.ly, D / 2 + 0.0002, 'paint:White', { col: false, pack: true }),          // the label's paper back
        box(JUG.lw, JUG.lh, 0.0003, 0, JUG.ly, -D / 2 - 0.0007, 'label:drinks-gallon-back', { uv: 'fit', col: false, pack: true }),
        box(JUG.lw, JUG.lh, 0.0002, 0, JUG.ly, -D / 2 - 0.0002, 'paint:White', { col: false, pack: true }),
        ...capParts(0.0212, 0.0155, 0.252, 'plastic:0x1f6fd1'),
        box(W, 0.262, D, 0, 0.131, 0, 'drinks-hdpe', { vis: false }),
      ] };
    },
  },
  // ---------------------------------------------------------------- Sunvale OJ 52 oz
  {
    id: 'drinks-oj-52', aisle: 'drinks', name: 'Sunvale 100% Orange Juice, No Pulp, 52 fl oz', brand: 'Sunvale', price: 4.99, mass: 1.666,
    rating: 4.7, reviews: 7342,
    blurb: 'Not-from-concentrate pasteurized orange juice, no pulp. Keep refrigerated; finish within 7-10 days of opening.',
    quotes: ['"Tastes like actual oranges, not that tinny concentrate taste."', '"The grip in the middle makes it easy to pour one-handed."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 715, waterL: 1.41, proteinG: 13, carbsG: 169, sugarG: 143, fatG: 0, fiberG: 3, sodiumMg: 15, caffeineMg: 0 },
      netKg: 1.607, bites: 44, bite: 'level', open: 'cap',
      keep: 'fridge', shelf: { room: 1, fridge: 21, freezer: 300, opened: 8 },
      taste: ['Sweet, bright orange juice. Smooth, no pulp.', 'Cold OJ. Tangy and sweet.', 'Fresh-tasting orange juice. A little tart at the end.'],
      sound: 'gulp', leftover: 'keep',
    },
    build() {
      return { mass: 1.666, parts: [
        lathe(OJB, 0, 0, 0, 'drinks-pet', { seg: 40, col: false, pack: true }),
        lathe(liquidProfile(OJB, 0.0012, 0.214), 0, 0, 0, 'liquid:0xf08300:1', { seg: 36, col: false, liquid: true }),
        band([[OJL.r, OJL.y0], [OJL.r, OJL.y1]], 'label:drinks-oj-52'),
        ...capParts(0.0228, 0.0165, 0.2405, 'plastic:0xf07a0c', 0.0236, 0.2392),
        cyl(0.052, 0.258, 0, 0.129, 0, 'clearplastic', { vis: false, seg: 20 }),
      ] };
    },
  },
  // ---------------------------------------------------------------- Voltura energy 16 oz
  {
    id: 'drinks-energy-16', aisle: 'drinks', name: 'Voltura Energy, Blue Razz, 16 fl oz Can', brand: 'Voltura', price: 2.99, mass: 0.51,
    rating: 4.3, reviews: 5208,
    blurb: '16 fl oz energy drink with 160 mg caffeine, taurine and B vitamins. Not for kids or anyone sensitive to caffeine.',
    quotes: ['"Blue razz is the best flavor, tastes like a melted slushie."', '"One of these and I finished my whole shift without a crash."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 220, waterL: 0.42, proteinG: 0, carbsG: 56, sugarG: 54, fatG: 0, fiberG: 0, sodiumMg: 370, caffeineMg: 160 },
      netKg: 0.494, bites: 15, bite: 'level', open: 'tab',
      keep: 'room', shelf: { room: 540, fridge: 540, freezer: 1, opened: 1 },
      taste: ['Blue raspberry candy fizz with that energy-drink tang.', 'Sweet, sour and electric. Your heart rate noticed.', 'Tastes like a blue slushie that plugged itself in.'],
      sound: 'fizz', leftover: 'keep',
    },
    build() { return { mass: 0.51, parts: canParts(0.157, 'drinks-energy-can', { liquid: 'liquid:0x2f7fe0:0.9', tab: '0x2bd8ff' }) }; },
  },
  // ---------------------------------------------------------------- Blackwater Bay cold brew
  {
    id: 'drinks-coldbrew-11', aisle: 'drinks', name: 'Blackwater Bay Cold Brew Coffee, Black, 11 fl oz', brand: 'Blackwater Bay', price: 4.49, mass: 0.546,
    rating: 4.6, reviews: 2290,
    blurb: 'Single-origin coffee steeped 18 hours, black and unsweetened, about 200 mg caffeine. Glass bottle: keep refrigerated and don\'t drop it.',
    quotes: ['"Smooth and chocolatey, zero bitterness. Strong though!"', '"Love the glass bottle, I reuse them for salad dressing."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 5, waterL: 0.32, proteinG: 0.5, carbsG: 1, sugarG: 0, fatG: 0, fiberG: 0, sodiumMg: 15, caffeineMg: 200 },
      netKg: 0.325, bites: 10, bite: 'level', open: 'cap',
      keep: 'fridge', shelf: { room: 1, fridge: 60, freezer: 1, opened: 7 },
      taste: ['Smooth, dark chocolate and roasted nuts. Very strong.', 'Cold, bold, a little earthy. No bitterness.', 'Inky black coffee. You feel it right away.'],
      sound: 'slurp', leftover: 'keep',
    },
    build() {
      return { mass: 0.546, parts: [
        lathe(CBB, 0, 0, 0, 'drinks-glass', { seg: 40, col: false, pack: true }),
        lathe(liquidProfile(CBB, 0.0032, 0.133), 0, 0, 0, 'liquid:0x140904:1', { seg: 36, col: false, liquid: true }),
        band(CBL.sleeve, 'label:drinks-coldbrew:matte'),
        // the glass body is the collision (and what shatters if you drop it); it sits just inside the sleeve
        cyl(0.0316, CBL.top, 0, CBL.top / 2, 0, 'glass:clear', { seg: 40, pack: true }),
        ...capParts(0.0188, 0.0115, 0.1445, 'drinks-alu:black'),
      ] };
    },
  },
  // ---------------------------------------------------------------- Stride sports drink 28 oz
  {
    id: 'drinks-sport-28', aisle: 'drinks', name: 'Stride Electrolyte Sports Drink, Blue Raspberry, 28 fl oz', brand: 'Stride', price: 2.29, mass: 0.885,
    rating: 4.5, reviews: 4135,
    blurb: '28 fl oz of electrolyte sports drink with sodium and potassium to replace what you sweat out. Wide-mouth cap.',
    quotes: ['"Tastes like the blue one we all know and love."', '"Wide mouth means I can drop ice cubes in. Perfect after a run."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 190, waterL: 0.79, proteinG: 0, carbsG: 51, sugarG: 49, fatG: 0, fiberG: 0, sodiumMg: 380, caffeineMg: 0 },
      netKg: 0.849, bites: 24, bite: 'level', open: 'cap',
      keep: 'room', shelf: { room: 270, fridge: 270, freezer: 365, opened: 2 },
      taste: ['Sweet blue raspberry, a little salty. Goes down easy.', 'Cold and thirst-quenching.', 'Tastes like every after-practice ever.'],
      sound: 'gulp', leftover: 'keep',
    },
    build() {
      return { mass: 0.885, parts: [
        lathe(SPB, 0, 0, 0, 'drinks-pet', { seg: 40, col: false, pack: true }),
        lathe(liquidProfile(SPB, 0.0012, 0.198), 0, 0, 0, 'liquid:0x0a6fe0:0.82', { seg: 36, col: false, liquid: true }),
        band([[SPL.r, SPL.y0], [SPL.r, SPL.y1]], 'label:drinks-sport-28'),
        ...capParts(0.0229, 0.0185, 0.2195, 'plastic:0x123c8c', 0.0228, 0.2181),
        cyl(0.0405, 0.2388, 0, 0.1194, 0, 'clearplastic', { vis: false, seg: 20 }),
      ] };
    },
  },
  // ---------------------------------------------------------------- Little Ripple sparkling 12 oz
  {
    id: 'drinks-seltzer-can', aisle: 'drinks', name: 'Little Ripple Sparkling Water, Grapefruit, 12 fl oz Can', brand: 'Little Ripple', price: 1.09, mass: 0.368,
    rating: 4.4, reviews: 3011,
    blurb: 'Unsweetened sparkling water with natural grapefruit essence. 0 calories, 0 sweeteners, 0 sodium.',
    quotes: ['"Actually tastes like grapefruit, not like a vague memory of it."', '"Super bubbly. My soda replacement."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 0, waterL: 0.355, proteinG: 0, carbsG: 0, sugarG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, caffeineMg: 0 },
      netKg: 0.355, bites: 11, bite: 'level', open: 'tab',
      keep: 'room', shelf: { room: 365, fridge: 365, freezer: 1, opened: 1 },
      taste: ['Sharp bubbles with a hint of pink grapefruit.', 'Crisp, dry and fizzy. A whisper of citrus.', 'Cold sparkling water. The bubbles tickle your nose.'],
      sound: 'fizz', leftover: 'keep',
    },
    build() { return { mass: 0.368, parts: canParts(0.1228, 'drinks-seltzer-can', { liquid: 'liquid:0xe8f3f5:0.3' }) }; },
  },
  // ---------------------------------------------------------------- Porchlight iced tea
  {
    id: 'drinks-icedtea-185', aisle: 'drinks', name: 'Porchlight Brewed Iced Tea, Lemon, 18.5 fl oz Glass Bottle', brand: 'Porchlight', price: 2.49, mass: 0.872,
    rating: 4.6, reviews: 3560,
    blurb: 'Real brewed black tea with lemon, sweetened with cane sugar, in a glass bottle. Refrigerate after opening.',
    quotes: ['"Tastes like actual brewed tea, not powder."', '"That pop when you twist the cap is so satisfying."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 160, waterL: 0.52, proteinG: 0, carbsG: 42, sugarG: 41, fatG: 0, fiberG: 0, sodiumMg: 15, caffeineMg: 50 },
      netKg: 0.566, bites: 16, bite: 'level', open: 'cap',
      keep: 'room', shelf: { room: 270, fridge: 270, freezer: 1, opened: 2 },
      taste: ['Brisk black tea, sweet, with a squeeze of lemon.', 'Smooth sweet tea. Porch-swing energy.', 'Cold tea, bright lemon, just sweet enough.'],
      sound: 'gulp', leftover: 'keep',
    },
    build() {
      return { mass: 0.872, parts: [
        lathe(TEAB, 0, 0, 0, 'drinks-glass', { seg: 40, col: false, pack: true }),
        lathe(liquidProfile(TEAB, 0.0034, 0.182), 0, 0, 0, 'liquid:0x8a420c:0.93', { seg: 36, col: false, liquid: true }),
        band(TEAL.sleeve, 'label:drinks-icedtea'),
        cyl(0.0361, TEAL.top, 0, TEAL.top / 2, 0, 'glass:clear', { seg: 40, pack: true }),                         // glass body: collision + shatters
        ...capParts(0.0208, 0.0125, 0.1965, 'drinks-alu:gold'),
      ] };
    },
  },
  // ---------------------------------------------------------------- Tiny Grove juice box
  {
    id: 'drinks-apple-juicebox', aisle: 'drinks', name: 'Tiny Grove 100% Apple Juice Box, 6.75 fl oz', brand: 'Tiny Grove', price: 0.56, mass: 0.219,
    rating: 4.7, reviews: 1290,
    blurb: 'One 200 mL box of 100% apple juice with vitamin C. Peel the straw off the back and poke it through the foil.',
    quotes: ['"Lunchbox essential."', '"My kid can actually get the straw in by herself."'],
    shop: false,
    food: JUICEBOX_FOOD,
    build() { return { mass: 0.219, parts: juiceBoxParts() }; },
  },
  {
    id: 'drinks-apple-juicebox-8pk', aisle: 'drinks', name: 'Tiny Grove 100% Apple Juice Boxes, 8 pk 6.75 fl oz', brand: 'Tiny Grove', price: 4.49, mass: 1.782,
    rating: 4.8, reviews: 6604,
    blurb: '8 shelf-stable 6.75 fl oz (200 mL) juice boxes of 100% apple juice, no sugar added. Straws attached.',
    quotes: ['"Way cheaper than the name brand, my kids can\'t tell."', '"Not too sweet. 100% juice, which is all I care about."'],
    shop: true,
    food: {
      kind: 'drink',
      eat: { kcal: 0, waterL: 0 }, netKg: 0, bites: 1, bite: 'none', open: null,
      units: 8, unitId: 'drinks-apple-juicebox',
      keep: 'room', shelf: { room: 240, fridge: 240, freezer: 240, opened: 0 },
      taste: ['Apple juice.'], sound: 'slurp', leftover: 'keep',
    },
    build() {
      const { W, D, H } = TR, t = 0.0015;
      const parts = [
        box(W, 0.003, D, 0, 0.0015, 0, 'drinks-kraft', { pack: true }),                                           // tray floor (+ collision)
        box(W, H, t, 0, H / 2, D / 2 - t / 2, 'label:drinks-ajbox-8pk-wall', { uv: 'fit', col: false, pack: true }),
        box(W, H, t, 0, H / 2, -D / 2 + t / 2, 'label:drinks-ajbox-8pk-wall', { uv: 'fit', col: false, pack: true }),
        box(t, H, D - 2 * t, -W / 2 + t / 2, H / 2, 0, 'label:drinks-ajbox-8pk-side', { uv: 'fit', col: false, pack: true }),
        box(t, H, D - 2 * t, W / 2 - t / 2, H / 2, 0, 'label:drinks-ajbox-8pk-side', { uv: 'fit', col: false, pack: true }),
      ];
      let unit = 0;
      for (const z of [-0.0215, 0.0255]) for (let i = 0; i < 4; i++) {
        parts.push(...place(juiceBoxParts(true), [-0.078 + i * 0.052, 0.003, z], [0, 0, 0], { unit }));
        unit++;
      }
      return { mass: 1.782, parts };
    },
  },
];
