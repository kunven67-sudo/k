// Cabinet signage drawn on canvases: game logos (topper, screen header, belly glass, bank sign),
// the deck button label atlas, the players-club reader display and the Silverlode maker badge.
// All cached; textures are ≤ 1024².

import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { FONTS, METAL, metalGrad, vGrad, rGrad, bevelText, sparkle, artRng, star, TAU, slotFontsReady } from './paint.js';
import { symbolAtlas } from './atlas.js';

export const MAKER = 'SILVERLODE';

const texCache = new Map();
function cachedTexture(key, w, h, draw) {
  let tex = texCache.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.redraw = () => {
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
    tex.needsUpdate = true;
  };
  texCache.set(key, tex);
  return tex;
}
// Re-render every sign once the vendored fonts are in.
slotFontsReady().then(() => {
  for (const tex of texCache.values()) tex.userData.redraw?.();
});

// ---- logos ------------------------------------------------------------------------------------------

/** Draw a theme's logo lockup centred in (w × h). */
export function drawLogo(g, theme, w, h, { backdrop = true } = {}) {
  const fn = LOGOS[theme];
  g.save();
  fn(g, w, h, backdrop);
  g.restore();
}

const LOGOS = {
  'classic-fruit'(g, w, h, bd) {
    if (bd) {
      g.fillStyle = rGrad(g, w / 2, h * 1.1, 10, w * 0.9, '#ff6a2a', '#c8101c', '#4a0408');
      g.fillRect(0, 0, w, h);
      g.save();
      g.translate(w / 2, h * 1.05);
      for (let i = 0; i < 28; i++) {
        g.rotate(Math.PI / 28);
        g.fillStyle = i % 2 ? 'rgba(255,220,140,.12)' : 'rgba(255,255,255,.04)';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(-w * 0.07, -w);
        g.lineTo(w * 0.07, -w);
        g.fill();
      }
      g.restore();
    }
    const s = Math.min(w / 512, h / 200);
    bevelText(g, 'Sierra', w / 2, h * 0.3, { font: `italic 400 ${64 * s}px ${FONTS.serif}`, fill: metalGrad(g, 0, h * 0.1, 0, h * 0.45, METAL.gold), inkW: 7 * s, maxW: w * 0.8 });
    bevelText(g, 'SEVENS', w / 2, h * 0.7, { font: `400 ${112 * s}px ${FONTS.display}`, fill: vGrad(g, h * 0.45, h * 0.95, '#ffffff', '#ffe0e0', '#ff9a9a'), ink: '#3a0004', inkW: 10 * s, tracking: 6 * s, maxW: w * 0.9 });
    sparkle(g, w * 0.2, h * 0.25, 18 * s, 0.9);
    sparkle(g, w * 0.82, h * 0.62, 14 * s, 0.8);
  },
  'wild-west'(g, w, h, bd) {
    if (bd) {
      g.fillStyle = vGrad(g, 0, h, '#ffcf7a', '#ff8a3a', '#a03a1a', '#3a1408');
      g.fillRect(0, 0, w, h);
      // mesas
      g.fillStyle = 'rgba(70,24,10,.75)';
      g.beginPath();
      g.moveTo(0, h);
      g.lineTo(0, h * 0.72);
      g.lineTo(w * 0.12, h * 0.72);
      g.lineTo(w * 0.16, h * 0.6);
      g.lineTo(w * 0.32, h * 0.6);
      g.lineTo(w * 0.36, h * 0.76);
      g.lineTo(w * 0.62, h * 0.78);
      g.lineTo(w * 0.68, h * 0.56);
      g.lineTo(w * 0.86, h * 0.56);
      g.lineTo(w * 0.9, h * 0.7);
      g.lineTo(w, h * 0.7);
      g.lineTo(w, h);
      g.fill();
      g.fillStyle = 'rgba(255,240,200,.85)';
      g.beginPath();
      g.arc(w * 0.5, h * 0.66, h * 0.16, Math.PI, TAU);
      g.fill();
    }
    const s = Math.min(w / 512, h / 200);
    bevelText(g, 'BOUNTY GULCH', w / 2, h * 0.28, { font: `400 ${50 * s}px ${FONTS.western}`, fill: vGrad(g, h * 0.12, h * 0.42, '#fff3d8', '#f0c890', '#b07a40'), ink: '#2a0e04', inkW: 8 * s, maxW: w * 0.9 });
    bevelText(g, 'GOLD', w / 2, h * 0.67, { font: `400 ${108 * s}px ${FONTS.western}`, fill: metalGrad(g, 0, h * 0.42, 0, h * 0.92, METAL.gold), ink: '#2a0e04', inkW: 10 * s, tracking: 4 * s, maxW: w * 0.8 });
    sparkle(g, w * 0.7, h * 0.5, 16 * s, 0.95);
  },
  space(g, w, h, bd) {
    if (bd) {
      g.fillStyle = vGrad(g, 0, h, '#05031a', '#1a0a4a', '#3a0a5a');
      g.fillRect(0, 0, w, h);
      const r = artRng(21);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`;
        g.fillRect(r() * w, r() * h, 1.5, 1.5);
      }
      // the beam
      const bx = w * 0.84;
      const bm = g.createLinearGradient(0, h * 0.2, 0, h);
      bm.addColorStop(0, 'rgba(120,255,160,.5)');
      bm.addColorStop(1, 'rgba(120,255,160,0)');
      g.fillStyle = bm;
      g.beginPath();
      g.moveTo(bx - w * 0.03, h * 0.28);
      g.lineTo(bx + w * 0.03, h * 0.28);
      g.lineTo(bx + w * 0.09, h);
      g.lineTo(bx - w * 0.09, h);
      g.fill();
      const atlas = symbolAtlas('space');
      atlas.draw(g, 'W', bx - h * 0.2, h * 0.02, h * 0.4);
      atlas.draw(g, 'H2', bx - h * 0.13, h * 0.62, h * 0.26);
    }
    const s = Math.min(w / 512, h / 200);
    g.save();
    g.shadowColor = '#ff3ea5';
    g.shadowBlur = 18 * s;
    bevelText(g, 'SAUCER', w * 0.44, h * 0.33, { font: `400 ${64 * s}px ${FONTS.neon}`, fill: '#ffd0ec', ink: '#ff3ea5', inkW: 4 * s, inner: null, shadow: false, maxW: w * 0.72 });
    g.restore();
    bevelText(g, 'STAMPEDE', w * 0.44, h * 0.72, { font: `400 ${84 * s}px ${FONTS.display}`, fill: vGrad(g, h * 0.5, h * 0.95, '#f0ffe0', '#7dff4a', '#1aa02a'), ink: '#04200a', inkW: 9 * s, tracking: 5 * s, maxW: w * 0.74 });
  },
  dragon(g, w, h, bd) {
    if (bd) {
      g.fillStyle = rGrad(g, w / 2, h * 0.5, 10, w * 0.7, '#e0301c', '#a00a12', '#3a0206');
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,200,100,.18)';
      g.lineWidth = 3;
      const r = artRng(8);
      for (let i = 0; i < 16; i++) {
        const x = r() * w;
        const y = r() * h;
        const s = 14 + r() * 20;
        g.beginPath();
        g.arc(x, y, s, Math.PI, TAU);
        g.arc(x + s * 1.5, y, s * 0.5, Math.PI, TAU);
        g.stroke();
      }
      const atlas = symbolAtlas('dragon');
      atlas.draw(g, 'C', w * 0.04, h * 0.18, h * 0.64);
      atlas.draw(g, 'C', w - w * 0.04 - h * 0.64, h * 0.18, h * 0.64);
    }
    const s = Math.min(w / 512, h / 200);
    bevelText(g, 'GOLDEN PEARL', w / 2, h * 0.3, { font: `700 ${44 * s}px ${FONTS.serif}`, fill: metalGrad(g, 0, h * 0.14, 0, h * 0.44, METAL.gold), ink: '#3a0204', inkW: 7 * s, tracking: 3 * s, maxW: w * 0.64 });
    bevelText(g, 'DRAGON', w / 2, h * 0.68, { font: `700 ${92 * s}px ${FONTS.serif}`, fill: metalGrad(g, 0, h * 0.44, 0, h * 0.92, METAL.gold), ink: '#3a0204', inkW: 10 * s, tracking: 6 * s, maxW: w * 0.66 });
    sparkle(g, w * 0.66, h * 0.44, 15 * s, 1);
  },
};

export function logoTexture(theme) {
  return cachedTexture(`logo|${theme}`, 512, 200, (g, w, h) => {
    drawLogo(g, theme, w, h);
    makerTag(g, w - 8, h - 8, 0.8, 'right');
  });
}

/** Small engraved maker badge. */
export function makerTag(g, x, y, s = 1, align = 'center') {
  bevelText(g, MAKER, x, y, { font: `400 ${16 * s}px ${FONTS.display}`, fill: metalGrad(g, 0, y - 10 * s, 0, y + 2 * s, METAL.silver), inkW: 3 * s, inner: null, shadow: false, align, baseline: 'bottom', tracking: 3 * s });
}

/** Lit belly glass under the deck: logo + a strip of the theme's symbols. */
export function bellyTexture(theme) {
  return cachedTexture(`belly|${theme}`, 512, 256, (g, w, h) => {
    drawLogo(g, theme, w, h * 0.7);
    g.fillStyle = vGrad(g, h * 0.7, h, '#141018', '#050408');
    g.fillRect(0, h * 0.7, w, h * 0.3);
    const atlas = symbolAtlas(theme);
    const keys = atlas.keys.filter((k) => k !== '-').slice(0, 7);
    keys.forEach((k, i) => atlas.draw(g, k, 18 + i * ((w - 36) / keys.length), h * 0.72, h * 0.26));
    g.strokeStyle = metalGrad(g, 0, 0, 0, h, METAL.gold);
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
  });
}

/** Big bank sign: logo + denomination banner. */
export function bankSignTexture(theme, denom) {
  return cachedTexture(`bank|${theme}|${denom}`, 1024, 256, (g, w, h) => {
    drawLogo(g, theme, w, h);
    const label = denomLabel(denom);
    const bw = 190;
    for (const x of [16, w - 16 - bw]) {
      g.fillStyle = vGrad(g, h * 0.62, h * 0.94, '#ffe680', '#ffb000', '#a05a00');
      g.beginPath();
      g.roundRect(x, h * 0.62, bw, h * 0.32, 14);
      g.fill();
      g.strokeStyle = '#2a1000';
      g.lineWidth = 4;
      g.stroke();
      bevelText(g, label, x + bw / 2, h * 0.78, { font: `400 64px ${FONTS.display}`, fill: '#3a1400', inkW: 0, inner: null, shadow: false, maxW: bw - 20 });
    }
  });
}

export function denomLabel(denom) {
  if (denom >= 1) return `$${denom}`;
  return `${Math.round(denom * 100)}¢`;
}

// ---- deck buttons -------------------------------------------------------------------------------------

export const BUTTON_TYPES = ['cashout', 'help', 'lines', 'betminus', 'betplus', 'maxbet', 'service', 'betone', 'betmax', 'spin', 'repeat'];
const BUTTON_STYLE = {
  cashout: ['#ffd23a', '#c08a00', '#2a1a00'],
  help: ['#6ac8ff', '#1a6ab0', '#001428'],
  lines: ['#ffffff', '#b8c0cc', '#1a1a20'],
  betminus: ['#ff6a5a', '#b01a20', '#2a0004'],
  betplus: ['#7dff7a', '#1a9a2a', '#00200a'],
  maxbet: ['#ffb84a', '#d05a00', '#2a1000'],
  service: ['#e0e0ff', '#7a7ab0', '#14142a'],
  betone: ['#ffffff', '#c0c8d4', '#1a1a20'],
  betmax: ['#ffb84a', '#d05a00', '#2a1000'],
  spin: ['#9aff6a', '#18b020', '#003a08'],
  repeat: ['#9aff6a', '#18b020', '#003a08'],
};

/** Label atlas: 4 × 4 cells of 256 × 128. Returns { texture, rect(type) → [u0, v0, du, dv] }. */
export function buttonAtlas() {
  const tex = cachedTexture('buttons', 1024, 512, (g) => {
    BUTTON_TYPES.forEach((type, i) => {
      const x = (i % 4) * 256;
      const y = Math.floor(i / 4) * 128;
      const [c1, c2, ink] = BUTTON_STYLE[type];
      g.save();
      g.translate(x, y);
      // plate: translucent coloured plastic lit from inside
      g.fillStyle = vGrad(g, 0, 128, c1, c2);
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = rGrad(g, 128, 50, 10, 160, 'rgba(255,255,255,.55)', 'rgba(255,255,255,0)');
      g.fillRect(0, 0, 256, 128);
      g.strokeStyle = 'rgba(0,0,0,.45)';
      g.lineWidth = 10;
      g.strokeRect(5, 5, 246, 118);
      const label = t(`slots.btn.${type}`);
      const lines = label.split('\n');
      const size = lines.length > 1 ? 40 : 52;
      lines.forEach((ln, k) => {
        bevelText(g, ln, 128, 64 + (k - (lines.length - 1) / 2) * size * 0.92, { font: `400 ${size}px ${FONTS.display}`, fill: ink, inkW: 0, inner: 'rgba(255,255,255,.35)', innerW: 1, shadow: false, maxW: 220, tracking: 2 });
      });
      g.restore();
    });
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return {
    texture: tex,
    rect(type) {
      const i = BUTTON_TYPES.indexOf(type);
      // canvas y grows down, texture v grows up (flipY): v0 is the cell's bottom edge
      return [(i % 4) * 0.25, 1 - (Math.floor(i / 4) + 1) * 0.25, 0.25, 0.25];
    },
  };
}

/** Players-club reader display (shared): amber text on black. */
export function clubDisplayTexture() {
  return cachedTexture('club', 256, 96, (g, w, h) => {
    g.fillStyle = '#060504';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,170,40,.12)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    bevelText(g, t('slots.club.line1'), w / 2, h * 0.34, { font: `600 26px ${FONTS.ui}`, fill: '#ffb030', inkW: 0, inner: null, shadow: false, maxW: w - 16 });
    bevelText(g, t('slots.club.line2'), w / 2, h * 0.72, { font: `600 22px ${FONTS.ui}`, fill: '#ff9a20', inkW: 0, inner: null, shadow: false, maxW: w - 16 });
  });
}

/** Plain-coloured star burst used for coin-shower particles on screens. */
export function coinSprite(size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(size / 48, size / 48);
  g.fillStyle = metalGrad(g, 0, 4, 0, 44, METAL.gold);
  g.beginPath();
  g.arc(24, 24, 20, 0, TAU);
  g.fill();
  g.strokeStyle = '#7a4a00';
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = 'rgba(120,70,0,.5)';
  g.fill(star(24, 24, 5, 11, 5));
  return c;
}
