// Skin: colour, shared detail textures, the per-person face paint and the skin material.
//
// - Skin tone comes from a curated ramp (schema.SKIN_RAMP) shifted by undertone and age.
// - Shared detail (baked once): mottling, pores (as a normal map), body-hair strokes and hair
//   follicle dots. Sampled triplanar in bind space so it stays glued to the deforming body.
// - Face paint (per person, cached by the params that affect it): an albedo-multiplier map
//   (lips, blush, under-eye, freckles, moles, birthmarks, scars, acne, age spots, nostrils,
//   brow shadow) + a "face normal" map whose RG is a normal from painted wrinkle/scar height,
//   B the beard-shadow mask and A the scalp-hair mask. Painted in head-UV space using the
//   template's landmarks, so it fits every person (their vertices carry template UVs).
// - The material is MeshPhysicalMaterial (Standard on low tier) patched with: wrapped diffuse
//   (subsurface feel), triplanar pores, stubble, body hair, nails, redness, cavity darkening for
//   the mouth, bruises, sweat sheen and grime — all driven by uniforms the Human updates.

import * as THREE from 'three';
import { TileNoise } from '../gfx/noise.js';
import { Rng, hashString } from '../core/rng.js';
import { clamp, smoothstep, lerp } from '../core/util.js';
import { SKIN_RAMP, HAIR_COLOR_HEX } from './schema.js';
import { TRI_VERT_DECL, TRI_VERT_AXES, TRI_VERT_POS, TRI_FRAG_DECL, lightsWithSSS, patch } from './shaderlib.js';

// ---- colours ----------------------------------------------------------------------------------

function srgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b].map((v) => v); // THREE.Color(hex) is already linear; convert below
}

/** Skin base colour (linear) for a person. */
export function skinColor(p) {
  const t = clamp(p.skinTone, 0, 1) * (SKIN_RAMP.length - 1);
  const i = Math.min(SKIN_RAMP.length - 2, Math.floor(t));
  const f = t - i;
  const a = new THREE.Color().setHex(SKIN_RAMP[i], THREE.SRGBColorSpace);
  const b = new THREE.Color().setHex(SKIN_RAMP[i + 1], THREE.SRGBColorSpace);
  const c = a.lerp(b, f);
  // Undertone: + warm/olive (yellower), − cool/pink (redder, a touch bluer).
  const u = p.undertone;
  c.r *= 1 + (u < 0 ? -u * 0.03 : u * 0.0);
  c.g *= 1 + (u > 0 ? u * 0.025 : u * 0.035);
  c.b *= 1 + (u > 0 ? -u * 0.09 : -u * 0.02);
  // Age: slightly sallower/greyer.
  const old = clamp((p.age - 55) / 35, 0, 1);
  const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  c.r = lerp(c.r, lum, old * 0.12);
  c.g = lerp(c.g, lum, old * 0.12);
  c.b = lerp(c.b, lum, old * 0.12);
  return c;
}

/** Hair colour (linear), greyed by p.gray. */
export function hairColor(p, which = 'hair') {
  const base = new THREE.Color().setHex(HAIR_COLOR_HEX[p.hairColor] ?? 0x3a2a1c, THREE.SRGBColorSpace);
  const g = which === 'brow' ? p.gray * 0.6 : which === 'beard' ? Math.min(1, p.gray * 1.15) : p.gray;
  const grey = new THREE.Color().setHex(p.gray > 0.85 ? 0xe8e4dc : 0xa8a49e, THREE.SRGBColorSpace);
  return base.lerp(grey, smoothstep(0.05, 1, g));
}
void srgb;

// ---- shared detail textures -------------------------------------------------------------------

let detail = null;
/**
 * RGBA detail tile: R mottling, G pore depth, B body-hair strokes, A follicle dots (value = a
 * per-follicle random id so a density threshold reveals more or fewer). Plus a pore normal map.
 */
export function skinDetail() {
  if (detail) return detail;
  const S = 512;
  const N = new TileNoise(971);
  const data = new Uint8Array(S * S * 4);
  const height = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const v = y / S;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const i = y * S + x;
      const mottle = N.fbm(u, v, { freq: 3, octaves: 4 }) * 0.5 + 0.5;
      const w = N.worley(u, v, 46);
      const pore = (1 - smoothstep(0.0, 0.2, w.f1)) * (0.45 + 0.55 * ((w.id * 0.6180339) % 1));
      const fine = N.perlin(u * 128, v * 128, 128);
      const hatch = N.ridged(u, v, { freq: 16, octaves: 3 });
      const crease = smoothstep(0.86, 0.99, hatch);
      height[i] = 0.5 - pore * 0.55 + fine * 0.07 - crease * 0.14;
      data[i * 4] = clamp(mottle, 0, 1) * 255;
      data[i * 4 + 1] = clamp(pore + crease * 0.3, 0, 1) * 255;
    }
  }
  // Strokes and follicle dots are easier to draw than to compute.
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const rng = new Rng(4242);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    ctx.lineCap = 'round';
    for (let k = 0; k < 900; k++) {
      const x = rng.next() * S;
      const y = rng.next() * S;
      const a = Math.PI / 2 + rng.gaussian(0, 0.35);
      const len = 5 + rng.next() * 11;
      const bend = rng.gaussian(0, 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + rng.next() * 0.5})`;
      ctx.lineWidth = 0.7 + rng.next() * 0.5;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        if (x + ox < -20 || x + ox > S + 20 || y + oy < -20 || y + oy > S + 20) continue;
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(x + ox + Math.cos(a) * len * 0.5 + bend, y + oy + Math.sin(a) * len * 0.5, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
        ctx.stroke();
      }
    }
    const strokes = ctx.getImageData(0, 0, S, S).data;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 5200; k++) {
      const x = rng.next() * S;
      const y = rng.next() * S;
      const id = 0.12 + rng.next() * 0.88;
      const g = Math.round(id * 255);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      const r = 0.9 + rng.next() * 0.7;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        if (x + ox < -4 || x + ox > S + 4 || y + oy < -4 || y + oy > S + 4) continue;
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, r, r * 1.6, rng.next() * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const dots = ctx.getImageData(0, 0, S, S).data;
    for (let i = 0; i < S * S; i++) {
      // Canvas rows are top-down; DataTexture rows bottom-up — irrelevant for a random tile.
      data[i * 4 + 2] = strokes[i * 4];
      data[i * 4 + 3] = dots[i * 4];
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  const nrm = heightToNormal(height, S, 2.2, true);
  detail = { tex, nrm };
  return detail;
}

function heightToNormal(height, S, strength, wrap) {
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const xm = wrap ? (x - 1 + S) % S : Math.max(0, x - 1);
      const xp = wrap ? (x + 1) % S : Math.min(S - 1, x + 1);
      const ym = wrap ? (y - 1 + S) % S : Math.max(0, y - 1);
      const yp = wrap ? (y + 1) % S : Math.min(S - 1, y + 1);
      const dx = (height[y * S + xp] - height[y * S + xm]) * strength;
      const dy = (height[yp * S + x] - height[ym * S + x]) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      out[i] = (-dx / l * 0.5 + 0.5) * 255;
      out[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
      out[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// ---- face paint -------------------------------------------------------------------------------

const paintCache = new Map();

/** Keys that affect the face paint. */
const PAINT_KEYS = ['faceWidth', 'jaw', 'chin', 'cheeks', 'cheekbones', 'noseSize', 'noseWidth', 'noseTip', 'noseBridge', 'mouthWidth', 'eyeSize', 'eyeSpacing', 'eyeTilt', 'lids', 'browRidge', 'browArch', 'fat', 'height', 'skinTone', 'undertone', 'freckles', 'moles', 'birthmark', 'acne', 'wrinkles', 'scar', 'blush', 'age', 'lips', 'facialHair', 'stubble', 'hairStyle', 'gray', 'hairColor', 'browThickness', 'seed'];

/**
 * Paint a person's face textures. Returns { paint, facen } (THREE.DataTexture each).
 * `size`: 256 (crowd), 512 (default), 1024 (hero close-ups).
 */
export function paintFace(p, mapper, size = 512) {
  const key = `${size}|${PAINT_KEYS.map((k) => (typeof p[k] === 'number' ? p[k].toFixed(2) : p[k])).join('|')}`;
  const hit = paintCache.get(key);
  if (hit) {
    hit.refs++;
    return hit;
  }
  const res = drawFace(p, mapper, size);
  res.key = key;
  res.refs = 1;
  paintCache.set(key, res);
  return res;
}

export function releaseFace(res) {
  if (!res || --res.refs > 0) return;
  paintCache.delete(res.key);
  res.paint.dispose();
  res.facen.dispose();
}

function drawFace(p, mapper, S) {
  const L = mapper.L;
  const rng = new Rng(hashString(`face${p.seed}`));
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
  };
  // Albedo multiplier (0.5 grey = ×1), gloss (0.5 neutral), height (0.5), beard mask, scalp mask.
  const cA = mk();
  const cG = mk();
  const cH = mk();
  const cB = mk();
  const cS = mk();
  const A = cA.getContext('2d');
  const G = cG.getContext('2d');
  const Hh = cH.getContext('2d');
  const Bd = cB.getContext('2d');
  const Sc = cS.getContext('2d');
  for (const [ctx, col] of [[A, '#808080'], [G, '#808080'], [Hh, '#808080'], [Bd, '#000'], [Sc, '#000']]) {
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, S, S);
  }
  // Head-space (x, y) on the front surface → canvas px.
  const px = (x, y, zOverride) => {
    const uv = mapper.uvOf(x, y, zOverride);
    return [uv[0] * S, (1 - uv[1]) * S];
  };
  // Soft elliptical blob of colour (radii in head-space metres).
  const blob = (ctx, x, y, rx, ry, rgba, hard = 0) => {
    const c = px(x, y);
    const ex = px(x + rx, y);
    const ey = px(x, y + ry);
    const sx = Math.max(0.5, Math.hypot(ex[0] - c[0], ex[1] - c[1]));
    const sy = Math.max(0.5, Math.hypot(ey[0] - c[0], ey[1] - c[1]));
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.scale(sx, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba);
    g.addColorStop(hard, rgba);
    g.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  // Polygon through head-space points.
  const poly = (ctx, pts, fill) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const q = px(x, y);
      if (i) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  // Soft line (groove/ridge) through head-space points; drawn as layered strokes.
  const line = (ctx, pts, width, rgba, layers = 4) => {
    const w0 = Math.hypot(...[0, 1].map((k) => px(pts[0][0] + width, pts[0][1])[k] - px(pts[0][0], pts[0][1])[k]));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let l = layers; l >= 1; l--) {
      ctx.lineWidth = Math.max(0.6, (w0 * l) / layers);
      ctx.strokeStyle = rgba.replace(/[\d.]+\)$/, `${(parseFloat(rgba.match(/[\d.]+\)$/)[0]) / layers).toFixed(3)})`);
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const q = px(x, y);
        if (i) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
      });
      ctx.stroke();
    }
  };
  const dark = clamp(p.skinTone, 0, 1);
  const old = clamp((p.age - 30) / 55, 0, 1);
  const wr = clamp(p.wrinkles * 0.75 + old * 0.65, 0, 1);
  const hw = L.mouthHalfW;
  const my = L.mouthY;
  const eyes = L.eyes.map((e) => e.c);

  // --- broad tone variation: warmer cheeks/nose/ears, slightly darker around the eyes & jaw.
  const blushA = 0.12 + p.blush * 0.32 - dark * 0.08;
  for (const sx of [1, -1]) {
    blob(A, sx * 0.05, -0.03, 0.03, 0.022, `rgba(150,100,100,${blushA.toFixed(3)})`);
    // Under-eye: a touch darker/cooler (more with age and on lighter skin it reads purple).
    blob(A, eyes[sx > 0 ? 0 : 1].x + sx * 0.003, -0.016, 0.019, 0.007, `rgba(${100 - dark * 10},${92 - dark * 8},${100 - dark * 8},${(0.28 + old * 0.35).toFixed(3)})`);
    // Upper lid / crease shadow.
    blob(A, eyes[sx > 0 ? 0 : 1].x, L.eyeY + 0.016, 0.02, 0.008, `rgba(112,98,96,0.35)`);
    // Brow base (hair tint under the brow cards).
    const bt = p.browThickness;
    const browPts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x = sx * lerp(0.014, 0.064 * L.fw, t);
      const y = L.browY - 0.002 + Math.sin(t * Math.PI * 0.85) * (0.004 + 0.006 * p.browArch) - t * 0.004;
      browPts.push([x, y]);
    }
    line(A, browPts, 0.004 + 0.004 * bt, `rgba(70,58,50,${(0.25 + bt * 0.25).toFixed(3)})`, 3);
  }
  blob(A, 0, L.noseTipY, 0.015, 0.012, `rgba(150,104,104,${(blushA * 0.9).toFixed(3)})`);
  blob(A, 0, -0.135, 0.03, 0.018, `rgba(140,112,108,0.18)`);
  // Nostrils.
  for (const sx of [1, -1]) blob(A, sx * 0.0078, L.noseTipY - 0.018, 0.004, 0.0028, 'rgba(40,24,22,0.85)', 0.4);

  // --- lips: vermilion with a cupid's bow; darker line where they meet.
  const lipCol = dark > 0.55 ? [118, 78, 82] : [140, 84, 88];
  const upper = [];
  const lower = [];
  const lh = 0.0125 + 0.006 * p.lips;
  const ll = 0.014 + 0.007 * p.lips;
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * 2 - 1;
    const x = t * hw * 1.04;
    const bow = 0.0018 * Math.exp(-((x / 0.0055) ** 2)) - 0.0012 * Math.exp(-(((Math.abs(x) - 0.009) / 0.005) ** 2));
    upper.push([x, my + lh * Math.pow(1 - t * t, 0.55) - bow]);
  }
  for (let i = 16; i >= 0; i--) upper.push([((i / 16) * 2 - 1) * hw * 1.04, my - 0.0004]);
  for (let i = 0; i <= 16; i++) lower.push([((i / 16) * 2 - 1) * hw * 1.0, my + 0.0004]);
  for (let i = 16; i >= 0; i--) {
    const t = (i / 16) * 2 - 1;
    lower.push([t * hw * 0.96, my - ll * Math.pow(1 - t * t, 0.5)]);
  }
  const lipA = 0.75 - old * 0.25;
  poly(A, upper, `rgba(${lipCol[0] - 6},${lipCol[1] - 4},${lipCol[2] - 2},${lipA})`);
  poly(A, lower, `rgba(${lipCol[0]},${lipCol[1] + 2},${lipCol[2] + 2},${lipA})`);
  line(A, [[-hw, my + 0.0008], [0, my - 0.0002], [hw, my + 0.0008]], 0.0018, 'rgba(60,30,32,0.7)', 3);
  poly(G, lower, 'rgba(190,190,190,0.8)');
  poly(G, upper, 'rgba(165,165,165,0.8)');
  // T-zone shine (forehead, nose).
  blob(G, 0, 0.07, 0.04, 0.03, 'rgba(160,160,160,0.6)');
  blob(G, 0, L.noseTipY + 0.01, 0.012, 0.025, 'rgba(175,175,175,0.6)');
  // Philtrum ridges + lip lines (height).
  for (const sx of [1, -1]) line(Hh, [[sx * 0.0045, L.noseTipY - 0.02], [sx * 0.0055, my + lh * 0.9]], 0.0022, 'rgba(170,170,170,0.5)', 3);
  for (let i = 0; i < 18; i++) {
    const x = ((i + 0.5) / 18 * 2 - 1) * hw * 0.9;
    line(Hh, [[x, my + 0.0015], [x * 1.04, my + lh * 0.7]], 0.0006, 'rgba(90,90,90,0.25)', 1);
    line(Hh, [[x, my - 0.0015], [x * 1.04, my - ll * 0.7]], 0.0006, 'rgba(90,90,90,0.25)', 1);
  }

  // --- wrinkles (height grooves).
  if (wr > 0.02) {
    const g = (a) => `rgba(20,20,20,${clamp(a, 0, 1).toFixed(3)})`;
    // Forehead lines.
    const nF = 3 + Math.round(wr * 2);
    for (let i = 0; i < nF; i++) {
      const y = L.browY + 0.016 + i * 0.0105 + rng.gaussian(0, 0.0015);
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const x = ((k / 10) * 2 - 1) * (0.05 - i * 0.003) + rng.gaussian(0, 0.001);
        pts.push([x, y + Math.cos(x * 30) * 0.0025 + rng.gaussian(0, 0.0006)]);
      }
      line(Hh, pts, 0.0022, g(0.55 * wr), 3);
    }
    // Glabella 11s.
    for (const sx of [1, -1]) line(Hh, [[sx * 0.006, L.browY + 0.002], [sx * 0.0075, L.browY + 0.016]], 0.0018, g(0.5 * wr), 3);
    for (const [sx, e] of [[1, eyes[0]], [-1, eyes[1]]]) {
      // Crow's feet.
      for (let k = -1; k <= 1; k++) {
        const ox = e.x + sx * (L.eyeR + 0.006);
        line(Hh, [[ox, L.eyeY + k * 0.004], [ox + sx * 0.012, L.eyeY + k * 0.008 + 0.001]], 0.0016, g(0.6 * wr), 3);
      }
      // Under-eye bag line.
      line(Hh, [[e.x - sx * 0.012, L.eyeY - 0.021], [e.x, L.eyeY - 0.025], [e.x + sx * 0.014, L.eyeY - 0.021]], 0.0022, g(0.5 * wr), 3);
      // Nasolabial fold.
      line(Hh, [[sx * 0.019, L.noseTipY - 0.008], [sx * 0.03, my - 0.004], [sx * (hw + 0.007), my - 0.016]], 0.004, g(0.35 + 0.45 * wr + p.fat * 0.15), 4);
      // Marionette lines (older).
      if (old > 0.4) line(Hh, [[sx * (hw + 0.002), my - 0.006], [sx * (hw + 0.006), my - 0.03]], 0.0028, g((old - 0.4) * 1.2 * wr), 3);
    }
    // Neck rings.
    for (let i = 0; i < 2; i++) line(Hh, [[-0.05, -0.17 - i * 0.012], [0, -0.172 - i * 0.012], [0.05, -0.17 - i * 0.012]], 0.0025, g(0.4 * wr), 3);
  }
  // Chin dimple / cleft (some people).
  if (rng.chance(0.18)) line(Hh, [[0, -0.122], [0, -0.135]], 0.002, 'rgba(30,30,30,0.45)', 3);

  // --- freckles, moles, age spots, acne.
  if (p.freckles > 0.02) {
    const n = Math.round(80 + p.freckles * 420);
    for (let i = 0; i < n; i++) {
      // Concentrated over the nose bridge and upper cheeks.
      const x = rng.gaussian(0, 0.032);
      const y = rng.gaussian(-0.012, 0.016);
      if (Math.abs(x) < 0.012 && y > 0.02) continue;
      const r = 0.0007 + rng.next() * 0.0012;
      blob(A, x, y, r, r, `rgba(${110 - dark * 30},${80 - dark * 20},${62 - dark * 15},${(0.25 + rng.next() * 0.45 * p.freckles).toFixed(3)})`, 0.3);
    }
  }
  const nMoles = Math.round(p.moles * 6 + (rng.next() < p.moles ? 1 : 0));
  for (let i = 0; i < nMoles; i++) {
    const x = rng.range(-0.075, 0.075);
    const y = rng.range(-0.13, 0.06);
    if (Math.abs(y - my) < 0.015 && Math.abs(x) < hw + 0.004) continue;
    const r = 0.0012 + rng.next() * 0.0014;
    blob(A, x, y, r, r, 'rgba(58,36,28,0.85)', 0.55);
    blob(Hh, x, y, r, r, 'rgba(200,200,200,0.5)', 0.4);
  }
  if (old > 0.45) {
    for (let i = 0; i < Math.round((old - 0.45) * 22); i++) {
      const x = rng.range(-0.09, 0.09);
      const y = rng.range(0.0, 0.12);
      const r = 0.002 + rng.next() * 0.004;
      blob(A, x, y, r, r * 0.8, `rgba(120,96,78,${(0.15 + rng.next() * 0.2).toFixed(3)})`);
    }
  }
  if (p.acne > 0.02) {
    const n = Math.round(p.acne * 40);
    for (let i = 0; i < n; i++) {
      const x = rng.gaussian(0, 0.04);
      const y = rng.pick([rng.gaussian(0.06, 0.015), rng.gaussian(-0.04, 0.015), rng.gaussian(-0.115, 0.01)]);
      const r = 0.0012 + rng.next() * 0.0018;
      blob(A, x, y, r * 1.6, r * 1.6, 'rgba(170,80,78,0.5)');
      blob(Hh, x, y, r, r, 'rgba(210,210,210,0.6)');
    }
  }
  // --- birthmark.
  if (p.birthmark !== 'none') {
    const at = { cheek: [0.05, -0.04], forehead: [-0.03, 0.08], neck: [0.035, -0.19], temple: [0.075, 0.03] }[p.birthmark];
    const port = rng.chance(0.45);
    for (let i = 0; i < 7; i++) {
      blob(A, at[0] + rng.gaussian(0, 0.008), at[1] + rng.gaussian(0, 0.006), 0.008 + rng.next() * 0.008, 0.006 + rng.next() * 0.006, port ? 'rgba(150,70,80,0.28)' : 'rgba(118,88,66,0.3)');
    }
  }
  // --- scar.
  if (p.scar !== 'none') {
    const s = {
      brow: [[0.04, L.browY + 0.012], [0.046, L.browY - 0.008]],
      cheek: [[0.05, -0.02], [0.062, -0.052]],
      lip: [[0.008, my + 0.018], [0.011, my - 0.004]],
      chin: [[-0.012, -0.128], [0.012, -0.136]],
      nose: [[-0.006, 0.0], [0.006, -0.012]],
    }[p.scar];
    line(A, s, 0.0035, 'rgba(176,140,138,0.8)', 3);
    line(Hh, s, 0.003, 'rgba(225,225,225,0.8)', 3);
    if (p.scar === 'brow') line(A, s, 0.0028, 'rgba(176,150,140,0.9)', 2);
  }

  // --- beard shadow mask (where facial hair grows) — stubble shader uses it.
  {
    const lowCheek = -0.028;
    const region = [];
    // Outline: sideburn → jawline → chin → other side, top edge along the cheek line.
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = lerp(0.092 * L.fw, 0.018, t);
      region.push([x, lerp(0.02, lowCheek - 0.012, smoothstep(0, 0.7, t)) - t * 0.004]);
    }
    region.push([hw + 0.006, my + 0.004], [0.006, L.noseTipY - 0.022], [-0.006, L.noseTipY - 0.022], [-hw - 0.006, my + 0.004]);
    for (let i = 12; i >= 0; i--) {
      const t = i / 12;
      const x = -lerp(0.092 * L.fw, 0.018, t);
      region.push([x, lerp(0.02, lowCheek - 0.012, smoothstep(0, 0.7, t)) - t * 0.004]);
    }
    region.push([-0.085, -0.13], [-0.05, -0.2], [0.05, -0.2], [0.085, -0.13]);
    Bd.filter = 'none';
    poly(Bd, region, 'rgba(255,255,255,1)');
    // Keep the lips themselves clean.
    poly(Bd, upper, 'rgba(0,0,0,1)');
    poly(Bd, lower, 'rgba(0,0,0,1)');
  }
  // --- scalp mask: where head hair grows (used for buzz cuts and the hairline under hair).
  {
    const style = p.hairStyle;
    const recede = style === 'receding' ? 0.6 : style === 'comb-over' ? 0.8 : style === 'bald' ? 1 : clamp((p.age - 45) / 50, 0, 0.35);
    const hl = 0.098 + recede * 0.035; // hairline height at the front
    // Hairline sampled around the head (u runs with azimuth), filled up to the crown (v = 1).
    Sc.beginPath();
    Sc.moveTo(0, 0);
    for (let i = 0; i <= 64; i++) {
      const az = -Math.PI + (i / 64) * Math.PI * 2;
      const x = Math.sin(az) * 0.115;
      const zf = Math.cos(az);
      const y = zf > 0 ? hl - (1 - zf) * 0.07 - Math.abs(Math.sin(az)) * 0.02 * (1 - recede) : -0.04 - (1 + zf) * 0.02;
      const uv = mapper.uvOf(x, y, zf * 0.12);
      Sc.lineTo(i === 0 ? 0 : i === 64 ? S : uv[0] * S, (1 - uv[1]) * S);
    }
    Sc.lineTo(S, 0);
    Sc.closePath();
    if (style !== 'bald') {
      Sc.fillStyle = '#fff';
      Sc.fill();
    }
    // Bald / receding: a horseshoe fringe remains at the sides and back.
    if (recede > 0.5) {
      Sc.fillStyle = '#000';
      blobCtx(Sc, px(0, 0.13, 0.08), 0.35 * S * recede, 0.18 * S * recede);
    }
  }

  // Soften the masks (blur by downsample/upsample: cheap and portable).
  for (const c of [cB, cS]) softenCanvas(c, Math.max(2, S / 128));
  // ---- assemble textures.
  const a = A.getImageData(0, 0, S, S).data;
  const gl = G.getImageData(0, 0, S, S).data;
  const hh = Hh.getImageData(0, 0, S, S).data;
  const bd = Bd.getImageData(0, 0, S, S).data;
  const sc = Sc.getImageData(0, 0, S, S).data;
  // Canvas row 0 is the top (v = 1). DataTexture row 0 is v = 0 → flip rows.
  const paint = new Uint8Array(S * S * 4);
  const facen = new Uint8Array(S * S * 4);
  const height = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    const src = (S - 1 - y) * S;
    for (let x = 0; x < S; x++) {
      const i = (src + x) * 4;
      const o = (y * S + x) * 4;
      paint[o] = a[i];
      paint[o + 1] = a[i + 1];
      paint[o + 2] = a[i + 2];
      paint[o + 3] = gl[i];
      height[y * S + x] = hh[i] / 255;
      facen[o + 2] = bd[i];
      facen[o + 3] = sc[i];
    }
  }
  const strength = 1.4 * (S / 512);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(S - 1, x + 1);
      const ym = Math.max(0, y - 1);
      const yp = Math.min(S - 1, y + 1);
      const dx = (height[y * S + xp] - height[y * S + xm]) * strength;
      const dy = (height[yp * S + x] - height[ym * S + x]) * strength;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * S + x) * 4;
      facen[o] = (-dx / l * 0.5 + 0.5) * 255;
      facen[o + 1] = (-dy / l * 0.5 + 0.5) * 255;
    }
  }
  const mkTex = (arr) => {
    const t = new THREE.DataTexture(arr, S, S, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  };
  return { paint: mkTex(paint), facen: mkTex(facen) };
}

function blobCtx(ctx, c, rx, ry) {
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.6, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function softenCanvas(c, factor) {
  const w = Math.max(8, Math.round(c.width / factor));
  const t = document.createElement('canvas');
  t.width = t.height = w;
  const tc = t.getContext('2d');
  tc.imageSmoothingEnabled = true;
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(c, 0, 0, w, w);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(t, 0, 0, c.width, c.height);
}

// ---- material ---------------------------------------------------------------------------------

let blankFace = null;
function blankFaceTextures() {
  if (blankFace) return blankFace;
  const a = new Uint8Array([128, 128, 128, 128]);
  const b = new Uint8Array([128, 128, 0, 0]);
  const mk = (d) => {
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  };
  blankFace = { paint: mk(a), facen: mk(b) };
  return blankFace;
}

/**
 * Skin material for one person. Returns the material; `material.userData.u` holds the live
 * uniforms (update .value to animate sweat, dirt, flush, bruises…).
 */
export function createSkinMaterial({ tierName = 'high', skin, hair, face = null, eyeUV = [[0.4, 0.5], [0.6, 0.5]] } = {}) {
  const physical = tierName !== 'low';
  const det = skinDetail();
  const fp = face || blankFaceTextures();
  const sheenColor = skin.clone().multiplyScalar(1.6);
  const M = physical
    ? new THREE.MeshPhysicalMaterial({ roughness: 0.6, metalness: 0, ior: 1.4, specularIntensity: 0.65, sheen: 0.35, sheenRoughness: 0.55, sheenColor })
    : new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
  M.name = 'skin';
  const U = {
    uSkinColor: { value: skin.clone() },
    uHairColor: { value: hair.clone() },
    uSkinTex: { value: det.tex },
    uSkinNrm: { value: det.nrm },
    uFacePaint: { value: fp.paint },
    uFaceN: { value: fp.facen },
    uBodyHair: { value: 0.3 },
    uStubble: { value: 0.0 },
    uScalp: { value: 0.0 },
    uDirt: { value: 0.0 },
    uSweat: { value: 0.0 },
    uFlush: { value: 0.0 },
    uPale: { value: 0.0 },
    uSSS: { value: 1.0 },
    uSSSTint: { value: new THREE.Vector3(1.0, 0.96, 0.95) },
    uPore: { value: physical ? 0.22 : 0.0 },
    uWrinkle: { value: 1.0 },
    uBruiseEye: { value: new THREE.Vector2(0, 0) },
    uBruiseCheek: { value: 0 },
    uBruiseKnuckles: { value: new THREE.Vector2(0, 0) },
    uEyeUV: { value: [new THREE.Vector2(...eyeUV[0]), new THREE.Vector2(...eyeUV[1])] },
  };
  M.userData.u = U;
  M.defines = { SKIN_SSS: '' };
  M.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    let vs = sh.vertexShader;
    vs = patch(vs, 'common', `${TRI_VERT_DECL}
attribute vec4 skinMask;
attribute vec2 faceUV;
attribute vec4 faceData;
varying vec4 vSkinMask;
varying vec2 vFaceUV;
varying vec4 vFaceData;`);
    vs = patch(vs, 'skinnormal_vertex', TRI_VERT_AXES);
    vs = patch(vs, 'begin_vertex', `${TRI_VERT_POS}
vSkinMask = skinMask;
vFaceUV = faceUV;
vFaceData = faceData;`);
    sh.vertexShader = vs;
    let fs = sh.fragmentShader;
    fs = patch(fs, 'common', `${TRI_FRAG_DECL}
uniform sampler2D uSkinTex;
uniform sampler2D uSkinNrm;
uniform sampler2D uFacePaint;
uniform sampler2D uFaceN;
uniform vec3 uSkinColor;
uniform vec3 uHairColor;
uniform float uBodyHair, uStubble, uScalp, uDirt, uSweat, uFlush, uPale, uSSS, uPore, uWrinkle, uBruiseCheek;
uniform vec3 uSSSTint;
uniform vec2 uBruiseEye;
uniform vec2 uBruiseKnuckles;
uniform vec2 uEyeUV[ 2 ];
varying vec4 vSkinMask;
varying vec2 vFaceUV;
varying vec4 vFaceData;
vec3 gSkinTW;
vec4 gFaceP;
vec4 gFaceN;
vec4 gDetS;`);
    fs = fs.replace('#include <lights_physical_pars_fragment>', lightsWithSSS());
    fs = patch(fs, 'map_fragment', `
{
  gSkinTW = triWeights( vBindN );
  gDetS = triSample( uSkinTex, vBindPos * 14.0, gSkinTW );
  vec4 detL = triSample( uSkinTex, vBindPos * 2.3, gSkinTW );
  float isFace = vFaceData.x;
  gFaceP = mix( vec4( 0.5 ), texture2D( uFacePaint, vFaceUV ), isFace );
  gFaceN = mix( vec4( 0.5, 0.5, 0.0, 0.0 ), texture2D( uFaceN, vFaceUV ), isFace );
  vec3 col = uSkinColor * ( 0.92 + 0.16 * detL.r );
  // Warm flush where blood sits close to the skin (knees, elbows, knuckles, ears).
  col *= mix( vec3( 1.0 ), vec3( 1.08, 0.86, 0.84 ), clamp( vSkinMask.r * 0.6 + vFaceData.z * 0.35, 0.0, 1.0 ) );
  col *= gFaceP.rgb * 2.0;
  // Stubble: follicle dots revealed by the beard mask × stubble amount.
  float follicle = texture2D( uSkinTex, vFaceUV * vec2( 64.0, 46.0 ) ).a;
  float stubD = gFaceN.b * uStubble;
  float stub = stubD * ( 0.28 + 0.72 * smoothstep( 1.0 - stubD * 0.9, 1.05 - stubD * 0.9, follicle ) );
  col = mix( col, uHairColor * 0.75, clamp( stub, 0.0, 0.92 ) * 0.8 );
  // Scalp hair (buzz cuts / hairline density under hair).
  float sc = gFaceN.a * uScalp;
  col = mix( col, uHairColor * 0.8, clamp( sc * ( 0.5 + 0.5 * smoothstep( 0.3, 0.7, follicle ) ), 0.0, 1.0 ) );
  // Body hair strokes (forearms, shins, chest).
  float bh = vSkinMask.g * uBodyHair * ( 1.0 - isFace );
  col = mix( col, uHairColor * 0.7, clamp( bh * gDetS.b, 0.0, 1.0 ) * 0.75 );
  // Nails and knuckles.
  col = mix( col, col * vec3( 1.1, 0.97, 0.95 ) + vec3( 0.06, 0.045, 0.045 ), vSkinMask.a );
  col *= mix( vec3( 1.0 ), vec3( 0.93, 0.88, 0.88 ), vSkinMask.b * 0.6 );
  // Emotional flush (embarrassed / angry / drunk) and pallor (sick / scared).
  float flushZone = isFace * ( 1.0 - smoothstep( 0.02, 0.2, abs( vFaceUV.y - 0.47 ) ) );
  col = mix( col, col * vec3( 1.12, 0.8, 0.8 ), uFlush * flushZone * 0.8 );
  col = mix( col, vec3( dot( col, vec3( 0.33 ) ) ) * vec3( 0.98, 1.0, 0.97 ), uPale * 0.5 );
  // Bruises: black eyes, cheek, knuckles (purple core, yellow-green rim).
  float be = 0.0;
  for ( int i = 0; i < 2; i++ ) {
    vec2 d = ( vFaceUV - uEyeUV[ i ] ) * vec2( 1.0, 1.35 );
    float r = length( d - vec2( 0.0, -0.012 ) );
    be = max( be, ( i == 0 ? uBruiseEye.x : uBruiseEye.y ) * ( 1.0 - smoothstep( 0.03, 0.075, r ) ) );
  }
  be *= isFace;
  float bk = vSkinMask.b * max( uBruiseKnuckles.x, uBruiseKnuckles.y );
  float bruise = max( be, bk );
  col = mix( col, col * vec3( 0.55, 0.32, 0.45 ), smoothstep( 0.15, 0.7, bruise ) * 0.85 );
  col = mix( col, col * vec3( 1.0, 1.02, 0.7 ), smoothstep( 0.0, 0.25, bruise ) * ( 1.0 - smoothstep( 0.25, 0.6, bruise ) ) * 0.5 );
  // Grime: blotches, heavier on hands/forearms/feet.
  float gN = smoothstep( 0.35, 0.8, detL.g * 0.6 + detL.r * 0.7 );
  col = mix( col, col * vec3( 0.58, 0.5, 0.43 ), uDirt * gN * 0.75 );
  // Mouth interior / nostrils: wet, dark, red.
  col = mix( col, mix( vec3( 0.34, 0.09, 0.09 ), vec3( 0.06, 0.015, 0.015 ), vFaceData.y ), smoothstep( 0.0, 0.25, vFaceData.y ) );
  // Baked sculpt occlusion (head/ears): warm, blood-tinted darkening in creases.
  col *= mix( vec3( 0.5, 0.36, 0.34 ), vec3( 1.0 ), smoothstep( 0.2, 1.0, vFaceData.w ) );
  diffuseColor.rgb = col;
}`);
    fs = patch(fs, 'aomap_fragment', `
{
  float aoS = clamp( vFaceData.w, 0.0, 1.0 );
  reflectedLight.indirectDiffuse *= aoS;
  reflectedLight.indirectSpecular *= aoS * aoS;
}`);
    fs = patch(fs, 'roughnessmap_fragment', `
roughnessFactor = 0.6 - ( gFaceP.a - 0.5 ) * 0.9 + gDetS.g * 0.08;
roughnessFactor -= uSweat * 0.34;
roughnessFactor = mix( roughnessFactor, 0.3, vSkinMask.a );
roughnessFactor = mix( roughnessFactor, 0.22, smoothstep( 0.0, 0.3, vFaceData.y ) );
roughnessFactor = clamp( roughnessFactor, 0.12, 1.0 );`);
    fs = patch(fs, 'normal_fragment_maps', `
{
  vec3 pert = triNormalPert( uSkinNrm, vBindPos * 14.0, gSkinTW ) * uPore * ( 1.0 - vFaceData.y );
  normal = normalize( normal + pert );
  mat3 tbnF = cotangentFrame( normal, - vViewPosition, vFaceUV );
  vec3 wn = vec3( ( gFaceN.rg * 2.0 - 1.0 ) * uWrinkle, 1.0 );
  normal = normalize( mix( normal, normalize( tbnF * wn ), vFaceData.x ) );
}`);
    sh.fragmentShader = fs;
  };
  M.customProgramCacheKey = () => `gamble-skin-${physical ? 'p' : 's'}-2`;
  return M;
}
