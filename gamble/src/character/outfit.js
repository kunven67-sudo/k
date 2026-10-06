// Outfit -> garment list (which cage garments, colours, fabrics, layering) + printed graphics
// (shirt prints, SECURITY lettering, badges, name tags) drawn once into small canvas textures.

import * as THREE from 'three';
import { CLOTH_COLORS } from './schema.js';
import { GARMENTS } from './clothes.js';

const printCache = new Map();
function canvasTex(key, w, h, draw) {
  let t = printCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  printCache.set(key, t);
  return t;
}

const FONT = '"Bebas Neue", "Arial Narrow", sans-serif';

/** Shirt graphics. Transparent canvases; the cloth shader blends them over the weave. */
function printTex(kind) {
  return canvasTex(`print-${kind}`, 256, 256, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    if (kind === 'dice') {
      const die = (x, y, s, rot, pips) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.fillStyle = '#f1ece0';
        ctx.strokeStyle = '#1b1a1a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#b3121b';
        for (const [px, py] of pips) {
          ctx.beginPath();
          ctx.arc(px * s * 0.28, py * s * 0.28, s * 0.085, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };
      die(95, 120, 92, -0.25, [[-1, -1], [0, 0], [1, 1]]);
      die(165, 140, 92, 0.3, [[-1, -1], [1, -1], [-1, 1], [1, 1]]);
      ctx.fillStyle = '#f1ece0';
      ctx.font = `bold 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('ROLL WITH IT', 128, 232);
    } else if (kind === 'stripe') {
      ctx.fillStyle = 'rgba(240,236,226,0.95)';
      ctx.fillRect(0, 96, W, 30);
      ctx.fillStyle = 'rgba(180,30,36,0.95)';
      ctx.fillRect(0, 132, W, 16);
    } else if (kind === 'reno') {
      ctx.fillStyle = '#f3e7c8';
      ctx.font = `bold 92px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('RENO', 128, 150);
      ctx.font = `bold 26px ${FONT}`;
      ctx.fillText('THE BIGGEST LITTLE CITY', 128, 186);
      ctx.strokeStyle = '#f3e7c8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(128, 150, 108, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (kind === 'cherries') {
      for (const [x, y] of [[100, 160], [150, 172]]) {
        ctx.fillStyle = '#c2141f';
        ctx.beginPath();
        ctx.arc(x, y, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(x - 11, y - 12, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#2f6b25';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(100, 128);
      ctx.quadraticCurveTo(120, 70, 150, 50);
      ctx.moveTo(150, 140);
      ctx.quadraticCurveTo(150, 90, 150, 50);
      ctx.stroke();
    } else if (kind === 'pocket') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 4;
      ctx.setLineDash([7, 6]);
      ctx.strokeRect(150, 70, 70, 80);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(150, 70, 70, 80);
    }
  });
}

function backTextTex(text) {
  return canvasTex(`back-${text}`, 512, 128, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f2f0ea';
    ctx.font = `bold 104px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H / 2 + 6);
  });
}

function badgeTex() {
  return canvasTex('badge', 128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    const g = ctx.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, '#f6dc8a');
    g.addColorStop(0.5, '#b8902f');
    g.addColorStop(1, '#f0d27a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(64, 6);
    ctx.lineTo(118, 26);
    ctx.lineTo(108, 86);
    ctx.lineTo(64, 122);
    ctx.lineTo(20, 86);
    ctx.lineTo(10, 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6e5418';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#6e5418';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 14 : 30;
      ctx.lineTo(64 + Math.cos(a) * r, 62 + Math.sin(a) * r);
    }
    ctx.fill();
  });
}

function nameTagTex(name, style) {
  return canvasTex(`tag-${style}-${name}`, 256, 96, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = style === 'gold' ? '#d9b65a' : '#f4f2ec';
    ctx.beginPath();
    ctx.roundRect(4, 4, W - 8, H - 8, 12);
    ctx.fill();
    ctx.strokeStyle = style === 'gold' ? '#7a5c1c' : '#2a3b62';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = style === 'gold' ? '#3a2a0c' : '#1d2a48';
    ctx.font = `bold 58px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.toUpperCase(), W / 2, H / 2 + 4);
  });
}

function buckleTex() {
  return canvasTex('buckle', 96, 72, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#e9d9a6');
    g.addColorStop(0.5, '#9a7a3a');
    g.addColorStop(1, '#d8c27e');
    ctx.strokeStyle = g;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.roundRect(10, 10, W - 20, H - 20, 10);
    ctx.stroke();
    ctx.fillStyle = '#7a6230';
    ctx.fillRect(W / 2 - 4, 14, 8, H - 28);
  });
}

const colorHex = (name, fallback = 0x808080) => CLOTH_COLORS[name] ?? fallback;
const FIRST = ['Sam', 'Lou', 'Jo', 'Pat', 'Rita', 'Dee', 'Manny', 'Gus', 'Val', 'Rae', 'Hal', 'Ines', 'Tony', 'Mae', 'Cruz', 'Bev'];

/**
 * Garments for params p: [{ name, spec, fabric, color, extraOff, prints, sole }].
 * `j` = rig joints (to place prints), `s` = body scale.
 */
export function outfitGarments(p, j, s) {
  const out = [];
  const chestY = j.chest.y + 0.07 * s;
  const tucked = p.top === 'dealer' || p.top === 'security' || p.top === 'button';
  const name = p.name || FIRST[(p.seed >>> 3) % FIRST.length];
  const add = (gname, color, opts = {}) => {
    const spec = GARMENTS[gname];
    if (!spec) return;
    out.push({ name: gname, spec, fabric: opts.fabric || spec.fabric, color, extraOff: opts.extraOff || 0, prints: opts.prints || [], sole: opts.sole || null });
  };
  // Bottoms (not with a dress).
  if (p.top !== 'dress') {
    const bc = colorHex(p.bottomColor, 0x3c5679);
    const gname = p.bottom === 'skirt' ? 'skirt' : p.bottom;
    add(gname, bc, { extraOff: tucked ? 0.008 : 0 });
    if (GARMENTS[gname]?.belt) add('belt', p.bottom === 'jeans' || p.bottom === 'cargo' ? 0x4a2e1c : 0x161414, { extraOff: tucked ? 0.008 : 0, prints: [{ tex: buckleTex(), center: [0, j.hips.y + 0.07 * s], size: [0.06 * s, 0.045 * s], side: 1 }] });
  }
  // Top.
  const tc = colorHex(p.topColor, 0x1f2a44);
  const top = p.top;
  if (top === 'dealer') {
    add('dealer', 0xefece4);
    add('dealerVest', 0x17161a, { extraOff: 0.002, prints: [{ tex: nameTagTex(name, 'gold'), center: [0.085 * s, chestY - 0.02 * s], size: [0.075 * s, 0.028 * s], side: 1 }] });
  } else if (top === 'security') {
    add('security', 0x23262d, {
      prints: [
        { tex: backTextTex('SECURITY'), center: [0, chestY - 0.02 * s], size: [0.3 * s, 0.075 * s], side: -1 },
        { tex: badgeTex(), center: [0.085 * s, chestY], size: [0.05 * s, 0.05 * s], side: 1 },
      ],
    });
  } else if (top === 'clerk') {
    add('clerk', 0x6b2230, { prints: [{ tex: nameTagTex(name, 'white'), center: [0.085 * s, chestY], size: [0.07 * s, 0.026 * s], side: 1 }] });
  } else {
    const prints = p.print && p.print !== 'none' && (top === 'tshirt' || top === 'tank' || top === 'hoodie') ? [{ tex: printTex(p.print), center: [0, chestY - 0.03 * s], size: [0.2 * s, 0.2 * s], side: 1 }] : [];
    add(top, tc, { prints });
  }
  // Outerwear.
  if (p.outer && p.outer !== 'none' && top !== 'dealer' && top !== 'security') add(p.outer, colorHex(p.outerColor, 0x5a3c26), { extraOff: top === 'hoodie' ? 0.014 : 0.004 });
  // Shoes.
  const shoeName = { sneakers: 'sneakers', boots: 'boots', dress: 'dress-shoes', cowboy: 'cowboy', slides: 'slides' }[p.shoes] || 'sneakers';
  const sc = colorHex(p.shoesColor, 0xe9e6df);
  const soleCol = shoeName === 'sneakers' ? 0xeeeae2 : shoeName === 'slides' ? 0x2a2a2a : 0x2b211b;
  add(shoeName, sc, { sole: { height: GARMENTS[shoeName].shoe.sole * s * 0.62, color: soleCol } });
  return out;
}
