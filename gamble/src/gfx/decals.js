// Decals: grime, oil stains, gum, cracks, dried puddles, graffiti tags, faded posters, cigarette
// burns, rust/water streaks, skid marks, pigeon droppings.
//
//   addDecal(target, kind, { position, normal, size, rotation, variant, opacity, tint, seed })
//     target   any Object3D. Decals added to the same target share ONE instanced draw call
//              (a DecalLayer is attached to the target on first use and grows as needed).
//     kind     'grime' | 'oil' | 'gum' | 'crack' | 'puddle' | 'graffiti' | 'poster' | 'burn' |
//              'streak' | 'skid' | 'droppings' | 'chalk'
//     size     number (square) or [w, h] in metres; rotation radians around the normal
//   projectDecal(mesh, kind, opts)  → Mesh using three's DecalGeometry for curved surfaces
//   decalMaterial()                 → the shared atlas material (for custom geometry)
//
// Art is generated once into a canvas atlas (8 × 4 cells) with matching roughness data
// (oil / puddle stains are glossy, posters are matte paper, graffiti is semi-gloss spray paint).
// Quads are oriented to the surface normal and nudged off it with polygon offset, so placing a
// decal on any flat surface (street, wall, counter, floor) just works.

import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { Rng } from '../core/rng.js';
import { TileNoise } from './noise.js';
import { currentTier } from '../core/quality.js';

const COLS = 8;
const ROWS = 4;

// kind → atlas cells (variants)
const KINDS = {
  grime: [0, 1, 2, 3],
  oil: [4, 5, 6],
  gum: [7, 8],
  crack: [9, 10, 11, 12],
  puddle: [13, 14, 15],
  graffiti: [16, 17, 18, 19, 20],
  poster: [21, 22, 23, 24],
  burn: [25, 26],
  streak: [27, 28],
  skid: [29],
  droppings: [30],
  chalk: [31],
};
export const DECAL_KINDS = Object.keys(KINDS);

let atlas = null; // { color, rough, cell }

function buildAtlas() {
  const tier = currentTier().name;
  const cell = tier === 'low' ? 128 : tier === 'medium' ? 192 : 256;
  const W = cell * COLS;
  const H = cell * ROWS;
  const cc = document.createElement('canvas');
  cc.width = W;
  cc.height = H;
  const rc = document.createElement('canvas');
  rc.width = W;
  rc.height = H;
  const g = cc.getContext('2d', { willReadFrequently: true });
  const r = rc.getContext('2d');
  r.fillStyle = 'rgb(0,200,0)';
  r.fillRect(0, 0, W, H);
  const N = new TileNoise(911);
  for (const [kind, cells] of Object.entries(KINDS)) {
    cells.forEach((idx, vi) => {
      const x = (idx % COLS) * cell;
      const y = Math.floor(idx / COLS) * cell;
      const rng = new Rng(idx * 7919 + 13);
      g.save();
      r.save();
      g.translate(x, y);
      r.translate(x, y);
      g.beginPath();
      g.rect(0, 0, cell, cell);
      g.clip();
      r.beginPath();
      r.rect(0, 0, cell, cell);
      r.clip();
      DRAW[kind](g, r, cell, rng, vi, N);
      g.restore();
      r.restore();
    });
  }
  const color = new THREE.CanvasTexture(cc);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 4;
  const rough = new THREE.CanvasTexture(rc);
  rough.colorSpace = THREE.NoColorSpace;
  atlas = { color, rough, cell };
  return atlas;
}

// ---- Procedural art -----------------------------------------------------------------------

function blob(g, cx, cy, rad, rng, color, alpha, lumps = 9) {
  // Irregular soft blob from overlapping radial gradients.
  for (let i = 0; i < lumps; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.range(0, rad * 0.55);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const rr = rad * rng.range(0.35, 0.7);
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, `rgba(${color},${alpha})`);
    grd.addColorStop(0.6, `rgba(${color},${alpha * 0.55})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
}

function hardBlob(g, cx, cy, rad, rng, N, irregular = 0.35, steps = 64) {
  g.beginPath();
  const o = rng.range(0, 10);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const n = N.fbm(Math.cos(a) * 0.15 + o, Math.sin(a) * 0.15 + o, { freq: 3, octaves: 3 });
    const rr = rad * (1 + n * irregular * 2);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

function speckle(g, S, rng, n, color, alphaMax, rMax) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${color},${rng.range(0.1, alphaMax)})`;
    g.beginPath();
    g.arc(rng.range(S * 0.08, S * 0.92), rng.range(S * 0.08, S * 0.92), rng.range(0.4, rMax), 0, Math.PI * 2);
    g.fill();
  }
}

function crackPath(g, x, y, ang, len, width, rng, depth) {
  let px = x;
  let py = y;
  const steps = Math.max(4, Math.floor(len / 4));
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(px, py);
  for (let i = 0; i < steps; i++) {
    ang += rng.range(-0.5, 0.5);
    px += Math.cos(ang) * (len / steps);
    py += Math.sin(ang) * (len / steps);
    g.lineTo(px, py);
    if (depth < 3 && rng.chance(0.12)) {
      g.stroke();
      crackPath(g, px, py, ang + rng.range(-1.2, 1.2), len * rng.range(0.25, 0.5), width * 0.6, rng, depth + 1);
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(px, py);
    }
  }
  g.stroke();
}

const TAGS = ['SK8R', 'DUKE', 'RN0', 'KOBRA', 'MIZZ', 'Z3RO', 'TRUCKEE', 'LUCKY7', 'OKSI', 'VEGA'];
const TAG_COLORS = [['#e33b8f', '#1c1c1c'], ['#f2f2f2', '#2b2b2b'], ['#36a3ff', '#0d1a40'], ['#ffd23a', '#3a1d0b'], ['#59d36b', '#0e2a12'], ['#ff6a2b', '#1f0d06']];

const DRAW = {
  grime(g, r, S, rng) {
    blob(g, S / 2, S / 2, S * 0.42, rng, '38,30,22', 0.42, 14);
    speckle(g, S, rng, 160, '30,24,18', 0.35, 1.6);
    r.fillStyle = 'rgba(0,235,0,0.6)';
  },
  oil(g, r, S, rng, vi, N) {
    g.save();
    hardBlob(g, S / 2, S / 2, S * 0.3, rng, N, 0.3);
    g.clip();
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.45);
    grd.addColorStop(0, 'rgba(10,9,8,0.82)');
    grd.addColorStop(0.7, 'rgba(18,15,12,0.7)');
    grd.addColorStop(1, 'rgba(25,22,18,0.25)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    // Faint rainbow sheen ring.
    g.globalCompositeOperation = 'lighter';
    for (const [c, k] of [['80,20,90', 0.62], ['20,70,90', 0.7], ['90,80,20', 0.78]]) {
      g.strokeStyle = `rgba(${c},0.1)`;
      g.lineWidth = S * 0.02;
      g.beginPath();
      g.arc(S / 2 + rng.range(-4, 4), S / 2 + rng.range(-4, 4), S * 0.3 * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    blob(g, S / 2, S / 2, S * 0.45, rng, '20,17,14', 0.18, 8);
    // Drips (secondary drops).
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(12,10,9,0.7)';
      g.beginPath();
      g.arc(S / 2 + rng.range(-S * 0.4, S * 0.4), S / 2 + rng.range(-S * 0.4, S * 0.4), rng.range(1, S * 0.025), 0, Math.PI * 2);
      g.fill();
    }
    r.save();
    hardBlob(r, S / 2, S / 2, S * 0.3, new Rng(vi + 99), N, 0.3);
    r.fillStyle = 'rgb(0,125,0)'; // satin, not a mirror: reads as a stain at grazing angles
    r.fill();
    r.restore();
  },
  gum(g, r, S, rng) {
    for (let i = 0; i < 26; i++) {
      const x = rng.range(S * 0.1, S * 0.9);
      const y = rng.range(S * 0.1, S * 0.9);
      const rad = rng.range(S * 0.012, S * 0.035);
      const tone = rng.range(25, 95);
      g.fillStyle = `rgba(${tone},${tone * 0.97},${tone * 0.93},0.9)`;
      g.beginPath();
      g.ellipse(x, y, rad, rad * rng.range(0.7, 1), rng.next() * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.beginPath();
      g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.4, 0, Math.PI * 2);
      g.fill();
      r.fillStyle = 'rgb(0,120,0)';
      r.beginPath();
      r.arc(x, y, rad, 0, Math.PI * 2);
      r.fill();
    }
  },
  crack(g, r, S, rng, vi) {
    g.strokeStyle = 'rgba(14,12,10,0.85)';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const n = 1 + (vi % 2);
    for (let k = 0; k < n; k++) crackPath(g, S * rng.range(0.1, 0.3), S * rng.range(0.2, 0.8), rng.range(-0.4, 0.4), S * 0.8, S * 0.012, rng, 0);
    // Weeds in bigger cracks (variant 3).
    if (vi === 3) {
      for (let i = 0; i < 9; i++) {
        const x = rng.range(S * 0.2, S * 0.8);
        const y = rng.range(S * 0.3, S * 0.7);
        g.strokeStyle = `rgba(${rng.int(60, 95)},${rng.int(85, 120)},${rng.int(35, 55)},0.9)`;
        g.lineWidth = 1.4;
        for (let j = 0; j < 5; j++) {
          g.beginPath();
          g.moveTo(x, y);
          const a = rng.range(0, Math.PI * 2);
          g.lineTo(x + Math.cos(a) * rng.range(3, S * 0.04), y + Math.sin(a) * rng.range(3, S * 0.04));
          g.stroke();
        }
      }
    }
    // Dirt collected along the crack: a soft darker band under the line work.
    g.globalCompositeOperation = 'destination-over';
    g.strokeStyle = 'rgba(40,34,28,0.18)';
    crackPath(g, S * 0.15, S * 0.5, 0, S * 0.75, S * 0.05, new Rng(vi + 7), 2);
    g.globalCompositeOperation = 'source-over';
    r.fillStyle = 'rgba(0,240,0,1)';
  },
  puddle(g, r, S, rng, vi, N) {
    g.save();
    hardBlob(g, S / 2, S / 2, S * 0.36, rng, N, 0.45);
    g.clip();
    const grd = g.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.5);
    grd.addColorStop(0, 'rgba(20,18,16,0.55)');
    grd.addColorStop(0.85, 'rgba(22,20,17,0.42)');
    grd.addColorStop(1, 'rgba(40,34,28,0.6)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    g.restore();
    // Dried rim: sediment ring.
    g.save();
    hardBlob(g, S / 2, S / 2, S * 0.36, new Rng(vi * 3 + 5), N, 0.45);
    g.strokeStyle = 'rgba(120,108,92,0.35)';
    g.lineWidth = S * 0.012;
    g.stroke();
    g.restore();
    r.save();
    hardBlob(r, S / 2, S / 2, S * 0.36, new Rng(vi * 3 + 5), N, 0.45);
    r.fillStyle = 'rgb(0,70,0)';
    r.fill();
    r.restore();
  },
  graffiti(g, r, S, rng, vi) {
    const [fill, outline] = TAG_COLORS[(vi * 2 + 1) % TAG_COLORS.length];
    const tag = TAGS[(vi * 3) % TAGS.length];
    const fonts = ['"Monoton"', '"Rye"', '"Bebas Neue"', '"Special Elite"', '"Playfair Display"'];
    const font = fonts[vi % fonts.length];
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(rng.range(-0.25, 0.15));
    g.transform(1, 0, rng.range(-0.4, 0.1), 1, 0, 0);
    let size = S * 0.34;
    g.font = `${vi === 4 ? 'italic 700' : '400'} ${size}px ${font}, sans-serif`;
    while (g.measureText(tag).width > S * 0.86 && size > 8) {
      size *= 0.92;
      g.font = `${vi === 4 ? 'italic 700' : '400'} ${size}px ${font}, sans-serif`;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    // Overspray halo.
    g.shadowColor = fill;
    g.shadowBlur = S * 0.03;
    g.strokeStyle = outline;
    g.lineWidth = size * 0.16;
    g.strokeText(tag, 0, 0);
    g.shadowBlur = 0;
    g.fillStyle = fill;
    g.fillText(tag, 0, 0);
    // Highlight streak.
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = size * 0.025;
    g.beginPath();
    g.moveTo(-S * 0.3, -size * 0.18);
    g.lineTo(-S * 0.12, -size * 0.22);
    g.stroke();
    g.restore();
    // Paint drips.
    g.fillStyle = fill;
    for (let i = 0; i < 7; i++) {
      const x = rng.range(S * 0.2, S * 0.8);
      const y = S * 0.5 + rng.range(0, S * 0.12);
      const l = rng.range(S * 0.03, S * 0.18);
      g.fillRect(x, y, 1.6, l);
      g.beginPath();
      g.arc(x + 0.8, y + l, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    // Weathering: knock paint out in speckles.
    g.globalCompositeOperation = 'destination-out';
    speckle(g, S, rng, 260, '0,0,0', 0.6, 1.6);
    g.globalCompositeOperation = 'source-over';
    r.fillStyle = 'rgba(0,95,0,1)';
    r.fillRect(0, 0, S, S);
  },
  poster(g, r, S, rng, vi) {
    const pw = S * 0.62;
    const ph = S * 0.86;
    const x0 = (S - pw) / 2;
    const y0 = (S - ph) / 2;
    // Torn outline.
    g.save();
    g.beginPath();
    const tear = (x, y) => [x + rng.range(-2, 2), y + rng.range(-2, 2)];
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push(tear(x0 + (pw * i) / 12, y0));
    for (let i = 0; i <= 16; i++) pts.push(tear(x0 + pw, y0 + (ph * i) / 16));
    // Bottom-right corner torn away on some.
    const torn = vi % 2 === 0;
    for (let i = 12; i >= 0; i--) {
      const x = x0 + (pw * i) / 12;
      const lift = torn && i > 7 ? (i - 7) * ph * 0.05 : 0;
      pts.push(tear(x, y0 + ph - lift));
    }
    for (let i = 16; i >= 0; i--) pts.push(tear(x0, y0 + (ph * i) / 16));
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    const bg = ['#e8dcc0', '#f0e6d0', '#d9c79e', '#efe7d6'][vi % 4];
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cx = S / 2;
    const ink = ['#b8271f', '#1b2b5a', '#1e1e1e', '#a34d0f'][vi % 4];
    g.fillStyle = ink;
    if (vi === 0) {
      g.font = `400 ${S * 0.1}px "Bebas Neue", sans-serif`;
      g.fillText('FIGHT NIGHT', cx, y0 + ph * 0.12);
      g.fillRect(x0 + pw * 0.12, y0 + ph * 0.22, pw * 0.76, ph * 0.38);
      g.fillStyle = bg;
      g.font = `400 ${S * 0.14}px "Bebas Neue", sans-serif`;
      g.fillText('VS', cx, y0 + ph * 0.41);
      g.fillStyle = ink;
      g.font = `400 ${S * 0.055}px "Bebas Neue", sans-serif`;
      g.fillText('SAT 9PM · DOORS 8', cx, y0 + ph * 0.7);
      g.fillText('LIVE AT THE ROW', cx, y0 + ph * 0.8);
    } else if (vi === 1) {
      g.font = `400 ${S * 0.11}px "Special Elite", monospace`;
      g.fillText('LOST DOG', cx, y0 + ph * 0.12);
      g.fillStyle = '#6b6152';
      g.fillRect(x0 + pw * 0.18, y0 + ph * 0.2, pw * 0.64, ph * 0.36);
      g.fillStyle = ink;
      g.font = `400 ${S * 0.045}px "Special Elite", monospace`;
      g.fillText('"BINGO" - BROWN MUTT', cx, y0 + ph * 0.64);
      g.fillText('ANSWERS TO TREATS', cx, y0 + ph * 0.71);
      // Pull tabs at the bottom.
      for (let i = 0; i < 7; i++) {
        const tx = x0 + pw * (0.08 + i * 0.13);
        if (i === 2 || i === 5) continue; // torn off
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.strokeRect(tx, y0 + ph * 0.8, pw * 0.11, ph * 0.18);
      }
    } else if (vi === 2) {
      g.fillStyle = '#d6a21e';
      g.fillRect(x0, y0, pw, ph * 0.3);
      g.fillStyle = ink;
      g.font = `400 ${S * 0.12}px "Bebas Neue", sans-serif`;
      g.fillText('WE BUY', cx, y0 + ph * 0.1);
      g.fillText('GOLD', cx, y0 + ph * 0.22);
      g.font = `400 ${S * 0.05}px "Bebas Neue", sans-serif`;
      g.fillText('CASH TODAY', cx, y0 + ph * 0.42);
      g.fillText('JEWELRY · COINS · WATCHES', cx, y0 + ph * 0.52);
      g.font = `400 ${S * 0.06}px "Bebas Neue", sans-serif`;
      g.fillText('775-555-0147', cx, y0 + ph * 0.7);
    } else {
      g.font = `italic 400 ${S * 0.08}px "Playfair Display", serif`;
      g.fillText('Midnight Lounge', cx, y0 + ph * 0.13);
      g.beginPath();
      g.arc(cx, y0 + ph * 0.42, pw * 0.26, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = bg;
      g.font = `400 ${S * 0.06}px "Monoton", sans-serif`;
      g.fillText('JAZZ', cx, y0 + ph * 0.42);
      g.fillStyle = ink;
      g.font = `400 ${S * 0.045}px "Bebas Neue", sans-serif`;
      g.fillText('EVERY THURSDAY · NO COVER', cx, y0 + ph * 0.76);
    }
    // Sun fade + water stain + creases.
    const fade = g.createLinearGradient(0, y0, 0, y0 + ph);
    fade.addColorStop(0, 'rgba(240,235,220,0.45)');
    fade.addColorStop(1, 'rgba(240,235,220,0.15)');
    g.fillStyle = fade;
    g.fillRect(0, 0, S, S);
    blob(g, x0 + pw * rng.range(0.2, 0.8), y0 + ph * rng.range(0.5, 0.9), S * 0.18, rng, '120,95,60', 0.25, 6);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0, y0 + ph * 0.5);
    g.lineTo(x0 + pw, y0 + ph * 0.52);
    g.stroke();
    g.restore();
    // Staples.
    g.fillStyle = 'rgba(190,190,190,1)';
    for (const [sx, sy] of [[x0 + 5, y0 + 5], [x0 + pw - 9, y0 + 5]]) g.fillRect(sx, sy, 5, 1.5);
    r.fillStyle = 'rgba(0,235,0,1)';
    r.fillRect(0, 0, S, S);
  },
  burn(g, r, S, rng) {
    for (let i = 0; i < 6; i++) {
      const x = rng.range(S * 0.2, S * 0.8);
      const y = rng.range(S * 0.2, S * 0.8);
      const rad = rng.range(S * 0.025, S * 0.06);
      const grd = g.createRadialGradient(x, y, 0, x, y, rad * 1.8);
      grd.addColorStop(0, 'rgba(15,10,6,0.95)');
      grd.addColorStop(0.45, 'rgba(40,24,12,0.85)');
      grd.addColorStop(0.75, 'rgba(110,70,30,0.35)');
      grd.addColorStop(1, 'rgba(110,70,30,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(x, y, rad * 1.8, rad * 1.5, rng.next() * 3, 0, Math.PI * 2);
      g.fill();
    }
  },
  streak(g, r, S, rng, vi) {
    const col = vi === 0 ? '110,60,25' : '45,40,34';
    for (let i = 0; i < 14; i++) {
      const x = rng.range(S * 0.3, S * 0.7);
      const w = rng.range(2, S * 0.05);
      const l = rng.range(S * 0.4, S * 0.95);
      const grd = g.createLinearGradient(0, S * 0.03, 0, S * 0.03 + l);
      grd.addColorStop(0, `rgba(${col},0.55)`);
      grd.addColorStop(0.3, `rgba(${col},0.35)`);
      grd.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grd;
      g.fillRect(x - w / 2, S * 0.03, w, l);
    }
    blob(g, S / 2, S * 0.08, S * 0.12, rng, col, 0.4, 5);
  },
  skid(g, r, S, rng) {
    for (const off of [-0.17, 0.17]) {
      const grd = g.createLinearGradient(0, 0, S, 0);
      grd.addColorStop(0, 'rgba(12,12,12,0)');
      grd.addColorStop(0.2, 'rgba(12,12,12,0.55)');
      grd.addColorStop(0.85, 'rgba(12,12,12,0.4)');
      grd.addColorStop(1, 'rgba(12,12,12,0)');
      g.strokeStyle = grd;
      g.lineWidth = S * 0.07;
      g.beginPath();
      g.moveTo(S * 0.03, S * (0.5 + off));
      g.bezierCurveTo(S * 0.4, S * (0.5 + off + 0.02), S * 0.6, S * (0.5 + off - 0.05), S * 0.97, S * (0.5 + off + 0.04));
      g.stroke();
    }
    g.globalCompositeOperation = 'destination-out';
    speckle(g, S, rng, 200, '0,0,0', 0.5, 1.2);
    g.globalCompositeOperation = 'source-over';
  },
  droppings(g, r, S, rng) {
    for (let i = 0; i < 30; i++) {
      const x = rng.range(S * 0.15, S * 0.85);
      const y = rng.range(S * 0.15, S * 0.85);
      const rad = rng.range(2, S * 0.03);
      g.fillStyle = `rgba(${rng.int(215, 240)},${rng.int(212, 235)},${rng.int(200, 220)},0.9)`;
      g.beginPath();
      g.ellipse(x, y, rad, rad * rng.range(0.6, 1), rng.next() * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(60,55,45,0.8)';
      g.beginPath();
      g.arc(x + rad * 0.2, y, rad * 0.35, 0, Math.PI * 2);
      g.fill();
    }
  },
  chalk(g, r, S, rng) {
    // Faded kids' hopscotch / a chalk heart.
    g.strokeStyle = 'rgba(235,225,240,0.55)';
    g.lineWidth = S * 0.018;
    g.lineCap = 'round';
    const cell = S * 0.18;
    const cx = S / 2;
    let y = S * 0.88;
    for (const n of [1, 2, 1, 2, 1]) {
      for (let i = 0; i < n; i++) {
        const x = cx - (n * cell) / 2 + i * cell;
        g.strokeRect(x + rng.range(-1, 1), y - cell, cell, cell);
      }
      y -= cell;
    }
    g.globalCompositeOperation = 'destination-out';
    speckle(g, S, rng, 400, '0,0,0', 0.7, 1.4);
    g.globalCompositeOperation = 'source-over';
  },
};

// ---- Material ------------------------------------------------------------------------------

let sharedMat = null;
export function decalMaterial() {
  if (sharedMat) return sharedMat;
  const A = atlas || buildAtlas();
  const m = new THREE.MeshStandardMaterial({
    map: A.color,
    roughnessMap: A.rough,
    roughness: 1,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aAtlas;\nattribute vec4 aTint;\nvarying vec4 vTint;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vec2 atlasUv = aAtlas.xy + uv * aAtlas.zw;
        #else
          vec2 atlasUv = uv;
        #endif
        vMapUv = atlasUv;
        vRoughnessMapUv = atlasUv;
        #ifdef USE_INSTANCING
          vTint = aTint;
        #else
          vTint = vec4(1.0);
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTint;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb *= vTint.rgb;
        diffuseColor.a *= vTint.a;`);
  };
  m.customProgramCacheKey = () => 'decal-atlas';
  m.name = 'decals';
  sharedMat = m;
  return m;
}

// ---- Layers --------------------------------------------------------------------------------

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qr = new THREE.Quaternion();
const _z = new THREE.Vector3(0, 0, 1);
const _n = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

class DecalLayer {
  constructor(target) {
    this.target = target;
    this.capacity = 0;
    this.count = 0;
    this.mesh = null;
    this.grow(64);
  }

  grow(cap) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const atlasAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    const tintAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    geo.setAttribute('aAtlas', atlasAttr);
    geo.setAttribute('aTint', tintAttr);
    const mesh = new THREE.InstancedMesh(geo, decalMaterial(), cap);
    mesh.name = 'decals';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.renderOrder = 1;
    mesh.frustumCulled = false; // bounds recomputed below; decals are spread over the target
    if (this.mesh) {
      for (let i = 0; i < this.count; i++) {
        this.mesh.getMatrixAt(i, _m);
        mesh.setMatrixAt(i, _m);
        for (let k = 0; k < 4; k++) {
          atlasAttr.array[i * 4 + k] = this.mesh.geometry.attributes.aAtlas.array[i * 4 + k];
          tintAttr.array[i * 4 + k] = this.mesh.geometry.attributes.aTint.array[i * 4 + k];
        }
      }
      this.target.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    mesh.count = this.count;
    this.mesh = mesh;
    this.capacity = cap;
    this.target.add(mesh);
  }

  add(kind, o) {
    const cells = KINDS[kind];
    if (!cells) {
      console.warn(`[decals] unknown kind "${kind}"`);
      return -1;
    }
    if (this.count >= this.capacity) this.grow(this.capacity * 2);
    const i = this.count++;
    const variant = o.variant != null ? o.variant % cells.length : Math.floor((o.seed ?? Math.random()) * cells.length) % cells.length;
    const idx = cells[variant];
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    // Inset UVs by half a texel-ish to avoid bleeding from neighbouring cells.
    const e = 0.004;
    const aa = this.mesh.geometry.attributes.aAtlas;
    aa.array[i * 4] = col / COLS + e / COLS;
    aa.array[i * 4 + 1] = 1 - (row + 1) / ROWS + e / ROWS;
    aa.array[i * 4 + 2] = (1 - 2 * e) / COLS;
    aa.array[i * 4 + 3] = (1 - 2 * e) / ROWS;
    aa.needsUpdate = true;
    const ta = this.mesh.geometry.attributes.aTint;
    _c.set(o.tint ?? 0xffffff);
    ta.array[i * 4] = _c.r;
    ta.array[i * 4 + 1] = _c.g;
    ta.array[i * 4 + 2] = _c.b;
    ta.array[i * 4 + 3] = o.opacity ?? 1;
    ta.needsUpdate = true;
    // Orientation: +Z of the quad → surface normal, then spin around it.
    _n.copy(o.normal || new THREE.Vector3(0, 1, 0)).normalize();
    _q.setFromUnitVectors(_z, _n);
    _qr.setFromAxisAngle(_z, o.rotation ?? 0);
    _q.multiply(_qr);
    const sz = Array.isArray(o.size) ? o.size : [o.size ?? 1, o.size ?? 1];
    _s.set(sz[0], sz[1], 1);
    _p.copy(o.position).addScaledVector(_n, o.offset ?? 0.004);
    // Position is given in world space; convert to the target's local space.
    this.target.updateWorldMatrix(true, false);
    _m.compose(_p, _q, _s);
    _m.premultiply(new THREE.Matrix4().copy(this.target.matrixWorld).invert());
    this.mesh.setMatrixAt(i, _m);
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    return i;
  }
}

/**
 * Add a decal to `target` (world-space position/normal).
 * @returns {number} instance index within the target's decal layer
 */
export function addDecal(target, kind, o = {}) {
  let layer = target.userData.__decals;
  if (!layer) {
    layer = new DecalLayer(target);
    target.userData.__decals = layer;
  }
  return layer.add(kind, { ...o, position: o.position || new THREE.Vector3() });
}

/** Decal wrapped over a curved mesh via three's DecalGeometry (one draw call each — use sparingly). */
export function projectDecal(mesh, kind, { position, orientation = new THREE.Euler(), size = 1, variant = 0 } = {}) {
  const cells = KINDS[kind];
  const idx = cells[variant % cells.length];
  const s = Array.isArray(size) ? new THREE.Vector3(size[0], size[1], size[2] ?? 1) : new THREE.Vector3(size, size, size);
  const geo = new DecalGeometry(mesh, position, orientation, s);
  // Remap 0..1 UVs into the atlas cell.
  const uv = geo.attributes.uv;
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (col + uv.getX(i)) / COLS, 1 - (row + 1 - uv.getY(i)) / ROWS);
  }
  const m = new THREE.Mesh(geo, decalMaterial());
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}

/** Scatter helper: n decals of a kind over a horizontal rectangle at height y. */
export function scatterDecals(target, kind, n, { x0, x1, z0, z1, y = 0, size = [0.6, 1.6], rng, opacity = [0.6, 1], avoid } = {}) {
  const r = rng || new Rng(kind.length * 31 + n);
  for (let i = 0; i < n; i++) {
    const x = r.range(x0, x1);
    const z = r.range(z0, z1);
    if (avoid && avoid(x, z)) continue;
    const s = r.range(size[0], size[1]);
    addDecal(target, kind, {
      position: new THREE.Vector3(x, y, z),
      normal: new THREE.Vector3(0, 1, 0),
      size: s,
      rotation: r.range(0, Math.PI * 2),
      seed: r.next(),
      opacity: r.range(opacity[0], opacity[1]),
    });
  }
}
