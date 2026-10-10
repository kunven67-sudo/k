// Stepper reel drums: real 3D cylinders wrapped in the printed reel strip, backlit, spinning on
// their axles. Every drum in a bank is one instance of a single InstancedMesh (per-instance
// strip column + motion blur), so a bank of eight 3-reel machines is ONE draw call.
//
// Strip atlas: 512 × 1024 canvas, 6 columns of 84 px (3 reels × 2 variants) × 22 stops of 46.5 px.
// Drum angle convention: `pos` = physical stop index at the payline (fractional while moving);
// moving the strip DOWN (the way real reels spin) decreases pos.

import * as THREE from 'three';
import { CLASSIC_ART } from './art/classic.js';
import { CLASSIC_PARS } from './math/classic.js';
import { slotFontsReady, vGrad, FONTS, bevelText } from './art/paint.js';
import { t } from '../../core/i18n.js';

const COLS = 6;
const COL_W = 84;
const STOPS = 22;
const TEX_W = 512;
const TEX_H = 1024;
const STOP_H = TEX_H / STOPS;

let stripTex = null;

function drawStrips(g, blur) {
  g.clearRect(0, 0, TEX_W, TEX_H);
  ['single', 'three'].forEach((variant, vi) => {
    const par = CLASSIC_PARS[variant];
    par.reels.forEach((reel, ri) => {
      const x0 = (vi * 3 + ri) * COL_W;
      // backlit film: warm white with a faint vertical falloff per stop
      g.fillStyle = '#fbf6ea';
      g.fillRect(x0, 0, COL_W, TEX_H);
      for (let k = 0; k < STOPS; k++) {
        const y = k * STOP_H;
        g.fillStyle = vGrad(g, y, y + STOP_H, 'rgba(120,90,50,.10)', 'rgba(120,90,50,0)', 'rgba(120,90,50,0)', 'rgba(120,90,50,.10)');
        g.fillRect(x0, y, COL_W, STOP_H);
        const key = k % 2 === 0 ? reel.syms[k / 2] : '-';
        if (key === '-') continue;
        const size = STOP_H * 0.94;
        g.save();
        g.translate(x0 + COL_W / 2 - size / 2, y + (STOP_H - size) / 2);
        g.scale(size / 128, size / 128);
        CLASSIC_ART[key](g);
        g.restore();
      }
      // sprocket edge marks
      g.fillStyle = 'rgba(60,40,20,.25)';
      g.fillRect(x0, 0, 2, TEX_H);
      g.fillRect(x0 + COL_W - 2, 0, 2, TEX_H);
    });
  });
  if (blur) {
    const copy = document.createElement('canvas');
    copy.width = TEX_W;
    copy.height = TEX_H;
    copy.getContext('2d').drawImage(g.canvas, 0, 0);
    g.clearRect(0, 0, TEX_W, TEX_H);
    g.globalAlpha = 0.16;
    for (let k = -6; k <= 6; k++) {
      g.drawImage(copy, 0, k * STOP_H * 0.16);
      g.drawImage(copy, 0, k * STOP_H * 0.16 + (k < 0 ? TEX_H : -TEX_H));
    }
    g.globalAlpha = 1;
  }
}

function makeStripTextures() {
  if (stripTex) return stripTex;
  const mk = (blur) => {
    const c = document.createElement('canvas');
    c.width = TEX_W;
    c.height = TEX_H;
    drawStrips(c.getContext('2d'), blur);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.userData.redraw = () => {
      drawStrips(c.getContext('2d'), blur);
      tex.needsUpdate = true;
    };
    return tex;
  };
  stripTex = { sharp: mk(false), blur: mk(true) };
  slotFontsReady().then(() => {
    stripTex.sharp.userData.redraw();
    stripTex.blur.userData.redraw();
  });
  return stripTex;
}

/** Open drum geometry: axis along X, u across the reel width, v around (see header). */
function drumGeometry(radius, width, segs = 66) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const phi = -Math.PI + (i / segs) * Math.PI * 2;
    const y = Math.sin(phi) * radius;
    const z = Math.cos(phi) * radius;
    const v = 1 - 0.5 / STOPS + phi / (Math.PI * 2);
    for (const j of [0, 1]) {
      pos.push((j - 0.5) * width, y, z);
      nor.push(0, Math.sin(phi), Math.cos(phi));
      uv.push(j, v);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Instanced drums for a bank. drums: [{ center (bank-local Vector3), quat (bank-local), column }].
 * Returns { mesh, setDrum(i, pos, blur) }.
 */
export function createDrums(drums, { radius, width }) {
  const tex = makeStripTextures();
  const geo = drumGeometry(radius, width);
  const col = new Float32Array(drums.length);
  const blur = new Float32Array(drums.length);
  drums.forEach((d, i) => (col[i] = d.column));
  geo.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 1));
  const blurAttr = new THREE.InstancedBufferAttribute(blur, 1);
  blurAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iBlur', blurAttr);
  const mat = new THREE.MeshStandardMaterial({ map: tex.sharp, roughness: 0.42, metalness: 0, emissive: 0xfff2dc, emissiveMap: tex.sharp, emissiveIntensity: 0.55 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBlurMap = { value: tex.blur };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float iCol;\nattribute float iBlur;\nvarying float vBlur;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvec2 stripUv = vec2((iCol + uv.x) * ${(COL_W / TEX_W).toFixed(6)}, uv.y);\n#ifdef USE_MAP\nvMapUv = stripUv;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv = stripUv;\n#endif\nvBlur = iBlur;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uBlurMap;\nvarying float vBlur;')
      .replace('#include <map_fragment>', '#ifdef USE_MAP\nvec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(uBlurMap, vMapUv), vBlur);\ndiffuseColor *= sampledDiffuseColor;\n#endif')
      .replace('#include <emissivemap_fragment>', '#ifdef USE_EMISSIVEMAP\nvec4 emissiveColor = mix(texture2D(emissiveMap, vEmissiveMapUv), texture2D(uBlurMap, vEmissiveMapUv), vBlur);\ntotalEmissiveRadiance *= emissiveColor.rgb;\n#endif');
  };
  mat.name = 'slot-reels';
  const mesh = new THREE.InstancedMesh(geo, mat, drums.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _r = new THREE.Quaternion();
  const _x = new THREE.Vector3(1, 0, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const dTheta = (Math.PI * 2) / STOPS;
  const setDrum = (i, pos, b = 0) => {
    const d = drums[i];
    // rotating by θ about X maps angle φ → φ − θ; stop c sits at φ = −c·Δ, so θ = −pos·Δ
    _r.setFromAxisAngle(_x, -pos * dTheta);
    _q.copy(d.quat).multiply(_r);
    _m.compose(d.center, _q, one);
    mesh.setMatrixAt(i, _m);
    mesh.instanceMatrix.needsUpdate = true;
    if (blur[i] !== b) {
      blur[i] = b;
      blurAttr.needsUpdate = true;
    }
  };
  drums.forEach((d, i) => setDrum(i, d.initial ?? 0, 0));
  mesh.computeBoundingSphere?.();
  return { mesh, setDrum };
}

export const STRIP_COLUMN = (variant, reel) => (variant === 'three' ? 3 : 0) + reel;

// ---- red LED meters for steppers (one atlas canvas per bank, one row per machine) ----------------

export class MeterAtlas {
  constructor(count) {
    this.rowH = 64;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = Math.min(1024, Math.max(64, THREE.MathUtils.ceilPowerOfTwo(count * this.rowH)));
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.count = count;
    this.values = [];
    this.dirty = true;
  }

  /** UV rect [u0, v0, du, dv] for row i (texture v grows up). */
  rect(i) {
    const H = this.canvas.height;
    return [0, 1 - ((i + 1) * this.rowH) / H, 1, this.rowH / H];
  }

  set(i, credits, bet, paid, flags = {}) {
    const v = `${credits}|${bet}|${paid}|${flags.blink ? Math.floor(performance.now() / 300) % 2 : 0}`;
    if (this.values[i] === v) return;
    this.values[i] = v;
    const g = this.g;
    const y = i * this.rowH;
    g.fillStyle = '#080203';
    g.fillRect(0, y, 512, this.rowH);
    const cols = [
      [t('slots.meter.credits'), credits, 6, 12],
      [t('slots.meter.bet'), bet, 1, 232],
      [t('slots.meter.paid'), paid, 5, 318],
    ];
    for (const [label, val, digits, x] of cols) {
      g.font = `600 11px ${FONTS.ui}`;
      g.fillStyle = '#ff9a7a';
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText(label, x, y + 4);
      const s = String(Math.max(0, Math.round(val))).padStart(digits, ' ');
      const ghost = '8'.repeat(digits);
      g.font = `400 44px ${FONTS.display}`;
      g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(255,40,30,.10)';
      for (let k = 0; k < digits; k++) g.fillText(ghost[k], x + k * 26, y + 58);
      g.shadowColor = '#ff2a1a';
      g.shadowBlur = 10;
      g.fillStyle = flags.blink && Math.floor(performance.now() / 300) % 2 ? '#5a0a06' : '#ff3a22';
      for (let k = 0; k < digits; k++) if (s[k] !== ' ') g.fillText(s[k], x + k * 26, y + 58);
      g.shadowBlur = 0;
    }
    this.dirty = true;
  }

  flush() {
    if (this.dirty) {
      this.texture.needsUpdate = true;
      this.dirty = false;
    }
  }
}

/** Lit top glass for the steppers: logo + per-coin paytable. Cached per variant. */
const glassCache = new Map();
export function topGlassTexture(variant, drawLogo) {
  let tex = glassCache.get(variant);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 640;
  const draw = () => {
    const g = c.getContext('2d');
    drawLogo(g, 'classic-fruit', 512, 230);
    g.fillStyle = vGrad(g, 230, 640, '#1a0306', '#0a0103');
    g.fillRect(0, 230, 512, 410);
    const par = CLASSIC_PARS[variant];
    const rows = [
      ['W', 'W', 'W', par.top],
      ['7', '7', '7', [100, 200, 300]],
      ['B3', 'B3', 'B3', [40, 80, 120]],
      ['B2', 'B2', 'B2', [20, 40, 60]],
      ['B1', 'B1', 'B1', [10, 20, 30]],
      ['ANY', 'BAR', '', [5, 10, 15]],
      ['CH', 'CH', 'CH', [10, 20, 30]],
      ['CH', 'CH', '', [5, 10, 15]],
      ['CH', '', '', [2, 4, 6]],
    ];
    const three = variant === 'three';
    bevelText(g, three ? '1 · 2 · 3 LINES' : '1 COIN   2 COINS   3 COINS', 340, 252, { font: `400 22px ${FONTS.display}`, fill: '#ffd88a', inkW: 0, inner: null, shadow: false, tracking: 2 });
    rows.forEach((row, i) => {
      const y = 272 + i * 40;
      for (let k = 0; k < 3; k++) {
        const key = row[k];
        if (!key) continue;
        if (key === 'ANY' || key === 'BAR') {
          bevelText(g, key, 40 + k * 52, y + 18, { font: `400 24px ${FONTS.display}`, fill: '#fff', inkW: 3, inner: null, shadow: false });
          continue;
        }
        g.save();
        g.translate(18 + k * 52, y);
        g.scale(36 / 128, 36 / 128);
        CLASSIC_ART[key](g);
        g.restore();
      }
      const pays = row[3];
      const vals = three ? [pays[0]] : pays;
      vals.forEach((v, k) => {
        const x = three ? 340 : 230 + k * 110;
        const top = i === 0 && (three || k === 2);
        bevelText(g, String(v), x, y + 18, { font: `400 ${top ? 34 : 30}px ${FONTS.display}`, fill: top ? '#ffe680' : '#ffffff', inkW: 3, inner: null, shadow: false });
      });
    });
    g.fillStyle = '#ffd88a';
    g.font = `600 13px ${FONTS.ui}`;
    g.textAlign = 'center';
    g.fillText(t('slots.screen.payHelpLines').split('.')[1]?.trim() || '', 256, 632);
  };
  draw();
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  slotFontsReady().then(() => {
    draw();
    tex.needsUpdate = true;
  });
  glassCache.set(variant, tex);
  return tex;
}
