// Symbol atlases: every theme's symbols painted once into a canvas grid (sharp + vertical motion
// blur copy) that the video screens and reel strips blit from. Rebuilt once when the vendored
// fonts finish loading (`version` bumps so screens know to redraw).
//
//   const a = symbolAtlas('space');   a.draw(g, 'H1', x, y, size, { blur })

import { CLASSIC_ART } from './classic.js';
import { WEST_ART, westReelBg } from './west.js';
import { SPACE_ART, spaceReelBg } from './space.js';
import { DRAGON_ART, dragonReelBg } from './dragon.js';
import { slotFontsReady, vGrad } from './paint.js';

export const THEME_ART = {
  'classic-fruit': { art: CLASSIC_ART, bg: null },
  'wild-west': { art: WEST_ART, bg: westReelBg },
  space: { art: SPACE_ART, bg: spaceReelBg },
  dragon: { art: DRAGON_ART, bg: dragonReelBg },
};

const atlases = new Map();
let fontsDone = false;

slotFontsReady().then(() => {
  fontsDone = true;
  for (const a of atlases.values()) a.rebuild();
});

class Atlas {
  constructor(theme, cell) {
    this.theme = theme;
    this.cell = cell;
    this.keys = Object.keys(THEME_ART[theme].art);
    this.cols = 4;
    this.rows = Math.ceil(this.keys.length / this.cols);
    this.index = Object.fromEntries(this.keys.map((k, i) => [k, i]));
    this.canvas = document.createElement('canvas');
    this.blur = document.createElement('canvas');
    this.canvas.width = this.blur.width = this.cols * cell;
    this.canvas.height = this.blur.height = this.rows * cell;
    this.version = 0;
    this.rebuild();
  }

  rebuild() {
    const { cell } = this;
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const art = THEME_ART[this.theme].art;
    this.keys.forEach((k, i) => {
      g.save();
      g.translate((i % this.cols) * cell, Math.floor(i / this.cols) * cell);
      g.beginPath();
      g.rect(0, 0, cell, cell);
      g.clip();
      g.scale(cell / 128, cell / 128);
      try {
        art[k](g);
      } catch (e) {
        console.warn('[slots] symbol art failed', this.theme, k, e);
      }
      g.restore();
    });
    // Motion-blur copy: stacked vertical offsets, per cell (no bleeding between cells).
    const b = this.blur.getContext('2d');
    b.clearRect(0, 0, this.blur.width, this.blur.height);
    for (let i = 0; i < this.keys.length; i++) {
      const x = (i % this.cols) * cell;
      const y = Math.floor(i / this.cols) * cell;
      b.save();
      b.beginPath();
      b.rect(x, y, cell, cell);
      b.clip();
      const n = 7;
      for (let k = 0; k < n; k++) {
        b.globalAlpha = 0.3;
        b.drawImage(this.canvas, x, y, cell, cell, x, y + ((k - (n - 1) / 2) * cell) / 9, cell, cell);
      }
      b.restore();
    }
    this.version++;
    this.fontsDone = fontsDone;
  }

  /** Blit symbol `key` into a cell (x, y, size) of another canvas. */
  draw(g, key, x, y, size, { blur = false, alpha = 1 } = {}) {
    const i = this.index[key];
    if (i == null) return;
    const src = blur ? this.blur : this.canvas;
    const c = this.cell;
    if (alpha !== 1) g.globalAlpha = alpha;
    g.drawImage(src, (i % this.cols) * c, Math.floor(i / this.cols) * c, c, c, x, y, size, size);
    if (alpha !== 1) g.globalAlpha = 1;
  }
}

export function symbolAtlas(theme, cell = 128) {
  const key = `${theme}|${cell}`;
  let a = atlases.get(key);
  if (!a) {
    a = new Atlas(theme, cell);
    atlases.set(key, a);
  }
  return a;
}

/** Cached reel-window background for a theme (w × h). */
const bgCache = new Map();
export function reelBackground(theme, w, h) {
  const key = `${theme}|${w}|${h}`;
  let c = bgCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const fn = THEME_ART[theme].bg;
    if (fn) fn(g, w, h);
    else {
      g.fillStyle = vGrad(g, 0, h, '#f6efe0', '#fffaf0', '#e9dfca');
      g.fillRect(0, 0, w, h);
    }
    bgCache.set(key, c);
  }
  return c;
}
