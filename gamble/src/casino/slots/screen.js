// The video slot's portrait screen, drawn on a canvas each frame it is visible and dirty:
// logo header (+ fixed jackpot plaques on the dragon), a 5×3 reel window with real strip
// scrolling (motion-blurred atlas when fast, overshoot bounce on stop), win highlights and
// paylines, expanding saucer beams, sticky wild frames, flaming-pearl values, the hold & spin
// grid, big-win celebrations with a coin shower, the on-screen paytable and the meters.
//
// The machine (director) drives it: spinStart(), stopReel(), showWins(), setMeters()… and calls
// update(dt) + draw() at whatever rate the machine's distance/visibility allows.

import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { symbolAtlas, reelBackground } from './art/atlas.js';
import { drawLogo, makerTag, coinSprite, denomLabel } from './art/signage.js';
import { FONTS, METAL, metalGrad, vGrad, rGrad, bevelText, sparkle, TAU } from './art/paint.js';
import { VIDEO_PARS, DRAGON_JACKPOTS } from './math/themes.js';
import { videoMath } from './math/index.js';

const BASE_W = 512;
const BASE_H = 872;
const REEL = { x: 16, y: 292, cell: 96 };
const LINE_COLORS = ['#ff3b3b', '#3bd2ff', '#7dff4a', '#ffd23a', '#ff6af0', '#ff9a2a', '#a07aff', '#3affc8', '#ffffff', '#ff5a8a'];

export function fmt$(x) {
  const v = Math.round(x * 100) / 100;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const easeOutBack = (x, s = 1.4) => {
  const c = x - 1;
  return 1 + (s + 1) * c * c * c + s * c * c;
};

export class VideoScreen {
  /** scale: 1 = 512×872, 0.75 for medium tier, 0.5 for NPC screens. */
  constructor(theme, { scale = 1, denom = 0.01 } = {}) {
    this.theme = theme;
    this.par = VIDEO_PARS[theme];
    this.m = videoMath(theme);
    this.denom = denom;
    this.scale = scale;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(BASE_W * scale);
    this.canvas.height = Math.round(BASE_H * scale);
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.atlas = symbolAtlas(theme, scale >= 0.9 ? 128 : 96);
    this.time = 0;
    this.reels = Array.from({ length: 5 }, (_, r) => ({ pos: 1 + r * 7, vel: 0, mode: 'idle', set: 'base', anim: null, tease: false }));
    this.cells = new Array(15).fill(null); // overrides: { key, label, sticky, glow }
    this.expanded = new Set();
    this.win = null; // { cells:Set, line, text, color }
    this.meters = { credit: 0, bet: 0, win: 0, lines: 25, betPerLine: 1, mult: 1 };
    this.message = '';
    this.subMessage = '';
    this.banner = null; // { title, sub, t }
    this.mode = 'reels'; // 'reels' | 'hold' | 'paytable'
    this.hold = null;
    this.big = null; // { label, amount, t, coins: [] }
    this.freeInfo = null; // { i, n, total }
    this.lockText = null;
    this.attract = false;
    this.dirty = true;
    this._logo = null;
    this._coin = coinSprite(48);
    this._bgVersion = -1;
  }

  // ---- reel control -------------------------------------------------------------------------------

  stripOf(r) {
    return this.m.strips[this.reels[r].set][r].keys;
  }

  spinStart(set = 'base') {
    for (const [r, R] of this.reels.entries()) {
      R.set = set;
      R.mode = 'spin';
      R.tease = false;
      R.anim = { kind: 'start', t: -r * 0.07, from: R.pos };
      R.vel = 0;
    }
    this.expanded.clear();
    this.win = null;
    this.dirty = true;
  }

  /** Land reel r on strip index `stop` (middle row). Returns seconds until it lands. */
  stopReel(r, stop, { extra = 0, tease = false } = {}) {
    const R = this.reels[r];
    const n = this.stripOf(r).length;
    const target = stop - 1; // pos = index at the top row
    // travel downward (pos decreasing) at least 3 symbols + whatever extra the tease adds
    let d = (((R.pos - target) % n) + n) % n;
    const minTravel = 4 + extra * 18;
    while (d < minTravel) d += n;
    const dur = 0.32 + extra + d * 0.004;
    R.anim = { kind: 'stop', t: 0, from: R.pos, dist: d, dur, target };
    R.tease = tease;
    R.mode = 'stopping';
    this.dirty = true;
    return dur;
  }

  /** Snap all reels to stops (no animation) — attract screens / restoring state. */
  setStops(stops, set = 'base') {
    stops.forEach((s, r) => {
      const R = this.reels[r];
      R.set = set;
      R.pos = s - 1;
      R.mode = 'idle';
      R.anim = null;
    });
    this.dirty = true;
  }

  get spinning() {
    return this.reels.some((R) => R.mode !== 'idle');
  }

  /** Symbol key visible in a cell (after overrides). */
  cellKey(c) {
    const ov = this.cells[c];
    if (ov?.key) return ov.key;
    const r = Math.floor(c / 3);
    const R = this.reels[r];
    const strip = this.stripOf(r);
    const n = strip.length;
    return strip[(((Math.round(R.pos) + (c % 3)) % n) + n) % n];
  }

  update(dt) {
    this.time += dt;
    for (const R of this.reels) {
      const a = R.anim;
      if (!a) continue;
      this.dirty = true;
      if (a.kind === 'start') {
        // anticipation: nudge up a third of a symbol, then accelerate downward
        a.t += dt;
        if (a.t < 0) continue;
        if (a.t < 0.12) R.pos = a.from + Math.sin((a.t / 0.12) * Math.PI) * 0.28;
        else {
          R.vel = Math.min(19, R.vel + dt * 90);
          R.pos -= R.vel * dt;
        }
      } else if (a.kind === 'stop') {
        a.t += dt;
        const u = Math.min(1, a.t / a.dur);
        // fast linear travel, then ease out with a mechanical overshoot
        const k = u < 0.6 ? (u / 0.6) * 0.82 : 0.82 + 0.18 * easeOutBack((u - 0.6) / 0.4, 2.2);
        R.pos = a.from - a.dist * k;
        R.vel = u < 0.6 ? a.dist / a.dur : (1 - u) * 6;
        if (u >= 1) {
          R.pos = a.target;
          R.vel = 0;
          R.anim = null;
          R.mode = 'idle';
          R.tease = false;
        }
      }
    }
    if (this.win || this.big || this.banner || this.attract || this.hold || this.lockText || this.expanded.size) this.dirty = true;
    if (this.big) this._updateCoins(dt);
  }

  // ---- presentation state ----------------------------------------------------------------------------

  setMeters(m) {
    Object.assign(this.meters, m);
    this.dirty = true;
  }

  setMessage(text, sub = '') {
    this.message = text;
    this.subMessage = sub;
    this.dirty = true;
  }

  showWin(w, credits) {
    if (!w) {
      this.win = null;
      return;
    }
    const cells = new Set(w.cells || []);
    let text = '';
    const amt = fmt$(credits * this.denom);
    if (w.kind === 'line') text = t('slots.screen.linePays', { n: w.line + 1, amt });
    else if (w.kind === 'ways') text = t('slots.screen.waysPays', { sym: '', ways: w.ways, amt }).replace(/^\s*×\s*/, '');
    else if (w.kind === 'scatter') text = t('slots.screen.scatterPays', { amt });
    this.win = { cells, line: w.kind === 'line' ? w.line : null, text, color: LINE_COLORS[(w.line ?? 0) % LINE_COLORS.length], t0: this.time, sym: w.sym };
    this.dirty = true;
  }

  showAllWins(wins) {
    const cells = new Set();
    for (const w of wins) for (const c of w.cells || []) cells.add(c);
    this.win = { cells, line: null, lines: wins.filter((w) => w.kind === 'line').map((w) => w.line), text: '', color: '#ffffff', t0: this.time };
    this.dirty = true;
  }

  clearWin() {
    this.win = null;
    this.dirty = true;
  }

  setBanner(title, sub = '', dur = 2.5) {
    this.banner = title ? { title, sub, t: 0, dur } : null;
    this.dirty = true;
  }

  bigWin(label, amount) {
    this.big = label ? { label, amount, t: 0, coins: [] } : null;
    this.dirty = true;
  }

  // ---- drawing ---------------------------------------------------------------------------------------

  draw() {
    const g = this.g;
    const s = this.scale;
    g.setTransform(s, 0, 0, s, 0, 0);
    if (this.banner) this.banner.t += 1 / 30;
    this._drawFrame(g);
    if (this.mode === 'paytable') this._drawPaytable(g);
    else if (this.mode === 'hold') this._drawHold(g);
    else this._drawReels(g);
    this._drawMeters(g);
    if (this.banner) this._drawBanner(g);
    if (this.big) this._drawBig(g);
    if (this.lockText) this._drawLock(g);
    this.texture.needsUpdate = true;
    this.dirty = false;
  }

  _logoCanvas() {
    if (this._logo && this._bgVersion === this.atlas.version) return this._logo;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 210;
    drawLogo(c.getContext('2d'), this.theme, 512, 210);
    this._logo = c;
    this._bgVersion = this.atlas.version;
    return c;
  }

  _drawFrame(g) {
    const look = FRAME[this.theme];
    g.fillStyle = vGrad(g, 0, BASE_H, ...look.bg);
    g.fillRect(0, 0, BASE_W, BASE_H);
    g.drawImage(this._logoCanvas(), 0, 0, 512, 210);
    // header shimmer sweep (attract & idle)
    const sweep = ((this.time * 0.35) % 1.6) - 0.3;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const sg = g.createLinearGradient((sweep - 0.12) * 512, 0, (sweep + 0.12) * 512, 210);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,.16)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.fillRect(0, 0, 512, 210);
    g.restore();
    if (this.theme === 'dragon') this._drawJackpots(g);
    else {
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(0, 212, 512, 30);
      const tag = this.theme === 'wild-west' ? t('slots.screen.sticky') : t('slots.screen.expand');
      bevelText(g, `${t('slots.screen.free')} · ${tag}`, 256, 228, { font: `400 22px ${FONTS.display}`, fill: look.accent, inkW: 0, inner: null, shadow: false, tracking: 2, maxW: 490 });
    }
    // message bar
    const msg = this.freeInfo ? t('slots.screen.freeOf', { i: this.freeInfo.i, n: this.freeInfo.n }) : this.message;
    if (msg) {
      const pulse = this.attract ? 0.75 + 0.25 * Math.sin(this.time * 5) : 1;
      g.globalAlpha = pulse;
      bevelText(g, msg, 256, 268, { font: `400 30px ${FONTS.display}`, fill: metalGrad(g, 0, 252, 0, 284, METAL.gold), inkW: 5, tracking: 2, maxW: 490 });
      g.globalAlpha = 1;
    }
    // reel window frame
    const x = REEL.x - 8;
    const y = REEL.y - 8;
    const w = REEL.cell * 5 + 16;
    const h = REEL.cell * 3 + 16;
    g.fillStyle = metalGrad(g, 0, y, 0, y + h, look.frame);
    g.beginPath();
    g.roundRect(x, y, w, h, 12);
    g.fill();
    g.fillStyle = '#000';
    g.fillRect(REEL.x - 2, REEL.y - 2, REEL.cell * 5 + 4, REEL.cell * 3 + 4);
  }

  _drawJackpots(g) {
    const bet = this.meters.bet || 0.3;
    const plaques = [
      ['major', DRAGON_JACKPOTS.major, ['#fff0a0', '#ff9a00', '#8a3a00']],
      ['minor', DRAGON_JACKPOTS.minor, ['#ffd0d0', '#e0303a', '#5a0208']],
      ['mini', DRAGON_JACKPOTS.mini, ['#d0ffe0', '#20a050', '#04300e']],
    ];
    plaques.forEach(([k, x, pal], i) => {
      const px = 10 + i * 168;
      g.fillStyle = vGrad(g, 206, 246, ...pal);
      g.beginPath();
      g.roundRect(px, 208, 156, 38, 8);
      g.fill();
      g.strokeStyle = metalGrad(g, 0, 206, 0, 246, METAL.gold);
      g.lineWidth = 3;
      g.stroke();
      bevelText(g, t(`slots.screen.${k}`), px + 40, 227, { font: `700 17px ${FONTS.serif}`, fill: '#fff', ink: 'rgba(0,0,0,.6)', inkW: 3, inner: null, shadow: false });
      bevelText(g, fmt$(x * bet), px + 110, 227, { font: `400 24px ${FONTS.display}`, fill: '#fff8e0', ink: 'rgba(0,0,0,.7)', inkW: 3, inner: null, shadow: false, maxW: 84 });
    });
  }

  _drawReels(g) {
    const { x: X, y: Y, cell: C } = REEL;
    g.save();
    g.beginPath();
    g.rect(X, Y, C * 5, C * 3);
    g.clip();
    g.drawImage(reelBackground(this.theme, C * 5, C * 3), X, Y);
    for (let r = 0; r < 5; r++) {
      const R = this.reels[r];
      const strip = this.stripOf(r);
      const n = strip.length;
      const base = Math.floor(R.pos);
      const frac = R.pos - base;
      const blur = Math.abs(R.vel) > 7;
      const x = X + r * C;
      if (R.tease) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const a = 0.25 + 0.2 * Math.sin(this.time * 18);
        g.fillStyle = `rgba(255,220,90,${a})`;
        g.fillRect(x, Y, C, C * 3);
        g.restore();
      }
      for (let k = -1; k <= 3; k++) {
        const idx = (((base + k) % n) + n) % n;
        const yy = Y + (k - frac) * C;
        const cellIdx = r * 3 + k;
        const ov = !R.anim && k >= 0 && k < 3 ? this.cells[cellIdx] : null;
        const key = ov?.key || strip[idx];
        if (this.expanded.has(r) && !R.anim) continue;
        this._drawCell(g, key, x, yy, C, blur, ov, cellIdx);
      }
      // sticky wilds ride on top of the spinning reel
      if (R.anim) {
        for (let k = 0; k < 3; k++) {
          const ov = this.cells[r * 3 + k];
          if (ov?.sticky) this._drawCell(g, 'W', x, Y + k * C, C, false, ov, r * 3 + k);
        }
      }
      if (this.expanded.has(r) && !R.anim) this._drawBeam(g, x, Y, C);
    }
    // reel separators
    g.fillStyle = 'rgba(0,0,0,.5)';
    for (let r = 1; r < 5; r++) g.fillRect(X + r * C - 1, Y, 2, C * 3);
    // top/bottom shading (curved glass feel)
    const sh = g.createLinearGradient(0, Y, 0, Y + C * 3);
    sh.addColorStop(0, 'rgba(0,0,0,.5)');
    sh.addColorStop(0.12, 'rgba(0,0,0,0)');
    sh.addColorStop(0.88, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = sh;
    g.fillRect(X, Y, C * 5, C * 3);
    this._drawWin(g);
    g.restore();
  }

  _drawCell(g, key, x, y, C, blur, ov, cellIdx) {
    const winning = this.win?.cells.has(cellIdx) && !blur;
    let pad = 4;
    if (winning) {
      const p = 0.5 + 0.5 * Math.sin((this.time - this.win.t0) * 9);
      pad = 4 - p * 4;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rGrad(g, x + C / 2, y + C / 2, 4, C * 0.7, `rgba(255,240,170,${0.35 + p * 0.25})`, 'rgba(255,200,80,0)');
      g.fillRect(x, y, C, C);
      g.restore();
    }
    if (key === 'C' && this.theme === 'dragon' && !blur) {
      // pearls glow
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rGrad(g, x + C / 2, y + C / 2, 4, C * 0.6, 'rgba(255,150,40,.35)', 'rgba(255,90,0,0)');
      g.fillRect(x, y, C, C);
      g.restore();
    }
    this.atlas.draw(g, key, x + pad, y + pad, C - pad * 2, { blur });
    if (ov?.sticky) {
      g.strokeStyle = metalGrad(g, 0, y, 0, y + C, METAL.gold);
      g.lineWidth = 4;
      g.strokeRect(x + 3, y + 3, C - 6, C - 6);
      bevelText(g, t('slots.screen.sticky').split(' ')[0], x + C / 2, y + C - 10, { font: `400 14px ${FONTS.display}`, fill: '#fff6c8', ink: '#3a1a00', inkW: 3, inner: null, shadow: false });
    }
    if (ov?.label && !blur) {
      const jp = ['mini', 'minor', 'major'].includes(ov.label);
      const text = jp ? t(`slots.screen.${ov.label}`) : ov.label;
      bevelText(g, text, x + C / 2, y + C / 2 + 2, { font: `400 ${jp ? 26 : 24}px ${FONTS.display}`, fill: jp ? metalGrad(g, 0, y + 30, 0, y + 66, METAL.gold) : '#ffffff', ink: '#4a0a00', inkW: 5, inner: null, maxW: C - 12 });
    }
    if (winning) {
      g.strokeStyle = this.win.line != null ? this.win.color : 'rgba(255,230,140,.95)';
      g.lineWidth = 3;
      g.strokeRect(x + 2, y + 2, C - 4, C - 4);
    }
  }

  _drawBeam(g, x, Y, C) {
    // expanded saucer wild: the saucer at the top, a tractor beam filling the reel, WILD down the middle
    const bm = g.createLinearGradient(0, Y, 0, Y + C * 3);
    bm.addColorStop(0, 'rgba(150,255,170,.85)');
    bm.addColorStop(1, 'rgba(60,200,90,.35)');
    g.fillStyle = 'rgba(4,20,10,.85)';
    g.fillRect(x, Y, C, C * 3);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = bm;
    g.beginPath();
    g.moveTo(x + C * 0.35, Y + C * 0.5);
    g.lineTo(x + C * 0.65, Y + C * 0.5);
    g.lineTo(x + C, Y + C * 3);
    g.lineTo(x, Y + C * 3);
    g.fill();
    for (let i = 0; i < 8; i++) {
      const yy = Y + C * 0.6 + ((this.time * 120 + i * 40) % (C * 2.4));
      g.fillStyle = 'rgba(220,255,230,.25)';
      g.fillRect(x + 6, yy, C - 12, 3);
    }
    g.restore();
    this.atlas.draw(g, 'W', x - 4, Y - 6, C + 8);
    const letters = 'WILD';
    for (let i = 0; i < 4; i++) bevelText(g, letters[i], x + C / 2, Y + C * 1.12 + i * C * 0.44, { font: `400 ${C * 0.46}px ${FONTS.display}`, fill: vGrad(g, Y, Y + C * 3, '#f0ffe0', '#7dff4a'), ink: '#04200a', inkW: 6, inner: null });
  }

  _drawWin(g) {
    const w = this.win;
    if (!w) return;
    const lines = w.line != null ? [w.line] : w.lines || [];
    const { x: X, y: Y, cell: C } = REEL;
    for (const li of lines) {
      const L = this.par.lines?.[li];
      if (!L) continue;
      const col = LINE_COLORS[li % LINE_COLORS.length];
      g.save();
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(0,0,0,.6)';
      g.lineWidth = 9;
      g.beginPath();
      L.forEach((row, r) => {
        const px = X + r * C + C / 2;
        const py = Y + row * C + C / 2;
        if (r) g.lineTo(px, py);
        else g.moveTo(X - 4, py);
      });
      g.lineTo(X + C * 5 + 4, Y + L[4] * C + C / 2);
      g.stroke();
      g.strokeStyle = col;
      g.shadowColor = col;
      g.shadowBlur = 10;
      g.lineWidth = 4;
      g.stroke();
      g.restore();
    }
  }

  _drawHold(g) {
    const { x: X, y: Y, cell: C } = REEL;
    const H = this.hold;
    g.save();
    g.fillStyle = vGrad(g, Y, Y + C * 3, '#2a0206', '#12010a');
    g.fillRect(X, Y, C * 5, C * 3);
    for (let c = 0; c < 15; c++) {
      const r = Math.floor(c / 3);
      const row = c % 3;
      const x = X + r * C;
      const y = Y + row * C;
      g.strokeStyle = 'rgba(255,190,90,.35)';
      g.lineWidth = 2;
      g.strokeRect(x + 3, y + 3, C - 6, C - 6);
      const cell = H.cells[c];
      if (cell) {
        const age = this.time - cell.t;
        const pop = age < 0.35 ? easeOutBack(Math.min(1, age / 0.35), 2) : 1;
        const sz = (C - 8) * pop;
        this.atlas.draw(g, 'C', x + (C - sz) / 2, y + (C - sz) / 2, sz);
        if (age > 0.2) this._drawCell(g, null, x, y, C, false, { label: cell.label }, -1);
      } else if (H.spinning) {
        // empty cell spinning: blurred pearls/blanks streaking down
        const off = (this.time * 900 + c * 37) % C;
        g.save();
        g.beginPath();
        g.rect(x + 4, y + 4, C - 8, C - 8);
        g.clip();
        g.globalAlpha = 0.35;
        this.atlas.draw(g, 'C', x + 14, y - C + off, C - 28, { blur: true });
        this.atlas.draw(g, 'C', x + 14, y + off, C - 28, { blur: true });
        g.restore();
      }
    }
    g.restore();
    // respins counter
    const left = H.respins;
    bevelText(g, t('slots.screen.respins'), 180, 604, { font: `400 24px ${FONTS.display}`, fill: '#ffe0a0', inkW: 4, inner: null });
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i < left ? rGrad(g, 290 + i * 34, 604, 1, 14, '#fff6c0', '#ffb000', '#8a4a00') : 'rgba(255,255,255,.12)';
      g.beginPath();
      g.arc(290 + i * 34, 604, 12, 0, TAU);
      g.fill();
    }
    bevelText(g, `${t('slots.screen.holdTotal')} ${fmt$(H.total)}`, 256, 636, { font: `400 26px ${FONTS.display}`, fill: metalGrad(g, 0, 622, 0, 650, METAL.gold), inkW: 4 });
  }

  _drawMeters(g) {
    const look = FRAME[this.theme];
    const y0 = 662;
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(0, y0 - 6, 512, 140);
    if (this.mode === 'reels' && this.win?.text) {
      bevelText(g, this.win.text, 256, 616, { font: `400 30px ${FONTS.display}`, fill: '#ffffff', ink: '#000', inkW: 5, tracking: 1, maxW: 490 });
    } else if (this.mode === 'reels' && this.subMessage) {
      bevelText(g, this.subMessage, 256, 616, { font: `400 26px ${FONTS.display}`, fill: look.accent, inkW: 4, tracking: 1, maxW: 490 });
    }
    const M = this.meters;
    const boxes = [
      [t('slots.screen.credit'), fmt$(M.credit)],
      [t('slots.screen.bet'), fmt$(M.bet)],
      [t('slots.screen.win'), fmt$(M.win)],
    ];
    boxes.forEach(([label, val], i) => {
      const x = 12 + i * 166;
      g.fillStyle = 'rgba(255,255,255,.06)';
      g.beginPath();
      g.roundRect(x, y0, 156, 74, 8);
      g.fill();
      g.strokeStyle = look.accent;
      g.globalAlpha = 0.5;
      g.lineWidth = 2;
      g.stroke();
      g.globalAlpha = 1;
      bevelText(g, label, x + 78, y0 + 16, { font: `600 15px ${FONTS.ui}`, fill: look.accent, inkW: 0, inner: null, shadow: false, tracking: 1 });
      bevelText(g, val, x + 78, y0 + 48, { font: `400 36px ${FONTS.display}`, fill: i === 2 && M.win > 0 ? '#fff28a' : '#ffffff', ink: '#000', inkW: 4, inner: null, shadow: false, maxW: 146 });
    });
    // footer: bet layout, denomination, maker
    const info = this.par.kind === 'ways' ? t('slots.screen.ways', { b: M.mult * 25 }) : t('slots.screen.lines', { n: M.lines, b: M.betPerLine });
    bevelText(g, info, 14, 772, { font: `400 22px ${FONTS.display}`, fill: '#e8e0d0', inkW: 0, inner: null, shadow: false, align: 'left', tracking: 1 });
    g.fillStyle = vGrad(g, 758, 786, '#ffe680', '#c08a00');
    g.beginPath();
    g.roundRect(420, 758, 80, 28, 14);
    g.fill();
    bevelText(g, denomLabel(this.denom), 460, 773, { font: `400 22px ${FONTS.display}`, fill: '#3a1a00', inkW: 0, inner: null, shadow: false });
    makerTag(g, 256, 864, 1.1);
    bevelText(g, t('slots.btn.help'), 470, 842, { font: `400 16px ${FONTS.display}`, fill: 'rgba(255,255,255,.45)', inkW: 0, inner: null, shadow: false });
  }

  _drawBanner(g) {
    const b = this.banner;
    const a = Math.min(1, b.t * 4) * Math.min(1, Math.max(0, (b.dur - b.t) * 3));
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(0, 330, 512, 210);
    const s = 0.85 + 0.15 * easeOutBack(Math.min(1, b.t * 2.5));
    g.translate(256, 420);
    g.scale(s, s);
    bevelText(g, b.title, 0, 0, { font: `400 64px ${FRAME[this.theme].titleFont}`, fill: metalGrad(g, 0, -34, 0, 34, METAL.gold), inkW: 9, tracking: 2, maxW: 470 });
    if (b.sub) bevelText(g, b.sub, 0, 62, { font: `400 34px ${FONTS.display}`, fill: '#ffffff', inkW: 5, tracking: 2, maxW: 470 });
    g.restore();
  }

  _updateCoins(dt) {
    const B = this.big;
    B.t += dt;
    if (B.coins.length < 70 && Math.random() < 0.9) {
      B.coins.push({ x: Math.random() * 512, y: -30, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 160, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 10, s: 22 + Math.random() * 22 });
    }
    for (const c of B.coins) {
      c.vy += 420 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.r += c.vr * dt;
    }
    B.coins = B.coins.filter((c) => c.y < BASE_H + 40);
  }

  _drawBig(g) {
    const B = this.big;
    g.save();
    g.fillStyle = `rgba(0,0,0,${Math.min(0.6, B.t * 2)})`;
    g.fillRect(0, 0, 512, BASE_H);
    // rays
    g.save();
    g.translate(256, 430);
    g.rotate(this.time * 0.4);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      g.rotate(TAU / 16);
      g.fillStyle = 'rgba(255,200,80,.09)';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-60, -600);
      g.lineTo(60, -600);
      g.fill();
    }
    g.restore();
    for (const c of B.coins) {
      g.save();
      g.translate(c.x, c.y);
      g.scale(Math.cos(c.r), 1);
      g.drawImage(this._coin, -c.s / 2, -c.s / 2, c.s, c.s);
      g.restore();
    }
    const s = 0.7 + 0.3 * easeOutBack(Math.min(1, B.t * 1.6)) + 0.03 * Math.sin(this.time * 6);
    g.translate(256, 400);
    g.scale(s, s);
    bevelText(g, B.label, 0, 0, { font: `400 86px ${FRAME[this.theme].titleFont}`, fill: metalGrad(g, 0, -44, 0, 44, METAL.gold), inkW: 11, tracking: 3, maxW: 490 });
    bevelText(g, fmt$(B.amount), 0, 92, { font: `400 64px ${FONTS.display}`, fill: '#ffffff', ink: '#3a1a00', inkW: 8, tracking: 2, maxW: 470 });
    g.restore();
    sparkle(g, 120 + 40 * Math.sin(this.time * 3), 330, 20, 0.8);
    sparkle(g, 400, 470 + 30 * Math.cos(this.time * 2.6), 16, 0.8);
  }

  _drawLock(g) {
    g.fillStyle = 'rgba(0,0,0,.72)';
    g.fillRect(0, 286, 512, 300);
    const on = Math.sin(this.time * 6) > 0;
    bevelText(g, t('slots.screen.handpay'), 256, 370, { font: `400 64px ${FONTS.display}`, fill: on ? '#ffffff' : '#ffd23a', ink: '#5a0000', inkW: 8, tracking: 4 });
    bevelText(g, this.lockText, 256, 450, { font: `400 34px ${FONTS.display}`, fill: metalGrad(g, 0, 432, 0, 468, METAL.gold), inkW: 5, maxW: 480 });
    bevelText(g, t('slots.screen.callAttendant'), 256, 520, { font: `400 30px ${FONTS.display}`, fill: on ? '#ff5a4a' : '#ffffff', inkW: 4, tracking: 3 });
  }

  _drawPaytable(g) {
    const { x: X, y: Y, cell: C } = REEL;
    g.save();
    g.fillStyle = 'rgba(8,6,12,.94)';
    g.fillRect(X - 8, Y - 8, C * 5 + 16, C * 3 + 16 + 58);
    bevelText(g, t('slots.screen.paytable'), 256, Y + 12, { font: `400 28px ${FONTS.display}`, fill: metalGrad(g, 0, Y, 0, Y + 24, METAL.gold), inkW: 4, tracking: 3 });
    const pays = this.par.pays;
    const keys = Object.keys(pays).filter((k) => pays[k].some((v) => v > 0));
    const unit = this.par.kind === 'ways' ? this.meters.mult : this.meters.betPerLine;
    keys.forEach((k, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = X + 6 + col * 242;
      const y = Y + 32 + row * 44;
      this.atlas.draw(g, k, x, y, 42);
      const p = pays[k];
      const txt = `5× ${p[5] * unit}   4× ${p[4] * unit}   3× ${p[3] * unit}`;
      bevelText(g, txt, x + 50, y + 22, { font: `400 19px ${FONTS.display}`, fill: '#f4ecd8', inkW: 0, inner: null, shadow: false, align: 'left', maxW: 186 });
    });
    const help = this.par.kind === 'ways' ? t('slots.screen.payHelpWays') : t('slots.screen.payHelpLines');
    const feat = { 'wild-west': 'payHelpWest', space: 'payHelpSpace', dragon: 'payHelpDragon' }[this.theme];
    wrapText(g, `${help} ${t(`slots.screen.${feat}`)}`, 256, Y + 32 + Math.ceil(keys.length / 2) * 44 + 2, 480, 17, `500 15px ${FONTS.ui}`, '#d8d0c0');
    bevelText(g, t('slots.screen.touchToClose'), 256, Y + C * 3 + 44, { font: `400 18px ${FONTS.display}`, fill: 'rgba(255,255,255,.6)', inkW: 0, inner: null, shadow: false });
    g.restore();
  }

  dispose() {
    this.texture.dispose();
  }
}

function wrapText(g, text, cx, y, maxW, lh, font, color) {
  g.save();
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, cx, y);
      y += lh;
      line = w;
    } else line = test;
  }
  if (line) g.fillText(line, cx, y);
  g.restore();
}

const FRAME = {
  'wild-west': { bg: ['#3a1a0a', '#1a0a04', '#2a1208'], frame: METAL.goldDark, accent: '#ffcf7a', titleFont: FONTS.western },
  space: { bg: ['#0a0628', '#05031a', '#140a3a'], frame: METAL.silver, accent: '#7dffb4', titleFont: FONTS.display },
  dragon: { bg: ['#4a0408', '#22020a', '#3a0406'], frame: METAL.gold, accent: '#ffd88a', titleFont: FONTS.serif },
};

/** One shared, slowly animated attract screen per theme (+denom) for every idle machine. */
const attracts = new Map();
export function attractScreen(theme, denom) {
  const key = `${theme}|${denom}`;
  let a = attracts.get(key);
  if (!a) {
    a = new VideoScreen(theme, { scale: 0.75, denom });
    a.attract = true;
    a.setMessage(t('slots.screen.playMe'), t('slots.screen.insert'));
    a.setStops(a.reels.map((_, r) => Math.floor((a.stripOf(r).length * (r + 1)) / 6)));
    a._last = -1;
    attracts.set(key, a);
  }
  return a;
}

/** Advance shared attract screens at ~5 fps (called by every bank; runs once per frame). */
let lastAttractFrame = -1;
export function tickAttracts(dt, frameId) {
  if (frameId === lastAttractFrame) return;
  lastAttractFrame = frameId;
  for (const a of attracts.values()) {
    a.time += dt;
    a._acc = (a._acc || 0) + dt;
    if (a._acc > 0.2) {
      a._acc = 0;
      a.draw();
    }
  }
}
