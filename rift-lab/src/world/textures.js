// All textures are painted in code (no downloads): grass, forest-floor leaves,
// dirt, rock, mud, bark and leaf clusters. Tileable so they repeat seamlessly.

import * as THREE from 'three';
import { tileFbm, mulberry32, clamp, lerp } from '../core/noise.js';

const S = 512;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Height field -> tangent-space normal map (RG = xy, B = height for parallax blending).
function normalFromHeight(height, w, h, strength) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = height[y * w + ((x - 1 + w) % w)], r = height[y * w + ((x + 1) % w)];
      const u = height[((y - 1 + h) % h) * w + x], d = height[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const o = (y * w + x) * 4;
      out[o] = (nx * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * 0.5 + 0.5) * 255;
      out[o + 2] = nz * 255;
      out[o + 3] = clamp(height[y * w + x], 0, 1) * 255;
    }
  }
  return out;
}

function rgb(hex) { return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255]; }
function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

// ---------- Terrain layers ----------
// layer 0 grass, 1 forest-floor leaf litter, 2 dirt, 3 rock, 4 wet mud/sand

function paintGrass(seed) {
  const col = new Float32Array(S * S * 3), hgt = new Float32Array(S * S);
  const rand = mulberry32(seed);
  const dark = rgb(0x33452a), mid = rgb(0x5a6e35), dry = rgb(0x9c8c58), light = rgb(0x788a44);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tileFbm(x / 32, y / 32, S / 32, 4, seed) * 0.5 + 0.5;
    const n2 = tileFbm(x / 8, y / 8, S / 8, 2, seed + 7) * 0.5 + 0.5;
    let c = mix3(dark, mid, n);
    c = mix3(c, dry, clamp((n2 - 0.62) * 2.2, 0, 1) * 0.6);
    const k = y * S + x;
    col.set(c, k * 3);
    hgt[k] = n * 0.3;
  }
  // thousands of little blades, drawn as short strokes
  for (let b = 0; b < 26000; b++) {
    const x0 = rand() * S, y0 = rand() * S;
    const len = 4 + rand() * 9, ang = -Math.PI / 2 + (rand() - 0.5) * 1.3;
    const shade = rand();
    const c = shade < 0.12 ? dry : shade < 0.55 ? light : mid;
    for (let s = 0; s < len; s++) {
      const px = Math.floor(x0 + Math.cos(ang) * s + S) % S, py = Math.floor(y0 + Math.sin(ang) * s + S) % S;
      const k = py * S + px;
      const t = (s / len) * 0.6;
      col[k * 3] = lerp(col[k * 3], c[0] * (0.8 + t), 0.7);
      col[k * 3 + 1] = lerp(col[k * 3 + 1], c[1] * (0.8 + t), 0.7);
      col[k * 3 + 2] = lerp(col[k * 3 + 2], c[2] * (0.8 + t), 0.7);
      hgt[k] = 0.3 + 0.7 * (s / len);
    }
  }
  return { col, hgt };
}

function paintLitter(seed) {
  // Fall forest floor: fallen oak + maple leaves over dark soil, twigs.
  const col = new Float32Array(S * S * 3), hgt = new Float32Array(S * S);
  const rand = mulberry32(seed);
  const soil = rgb(0x2e2116);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tileFbm(x / 24, y / 24, S / 24, 4, seed) * 0.5 + 0.5;
    const k = y * S + x;
    col.set(mix3(soil, rgb(0x4a3826), n), k * 3);
    hgt[k] = n * 0.2;
  }
  const leafCols = [0x6b4a2a, 0x7a5532, 0x5a3d22, 0x8a6a3a, 0x6e3a20, 0x7f5f35, 0x4d3a24, 0x8c4a24, 0x9a6b2e, 0x5f4528].map(rgb);
  for (let l = 0; l < 2600; l++) {
    const cx = rand() * S, cy = rand() * S;
    const size = 5 + rand() * 9, ang = rand() * Math.PI * 2;
    const c = leafCols[Math.floor(rand() * leafCols.length)];
    const shade = 0.62 + rand() * 0.38;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lift = rand();
    for (let v = -size; v <= size; v++) for (let u = -size; u <= size; u++) {
      const lx = (u * ca + v * sa) / size, ly = (-u * sa + v * ca) / size;
      // lobed leaf silhouette
      const w = Math.sqrt(Math.max(0, 1 - ly * ly)) * (0.55 + 0.18 * Math.abs(Math.sin(ly * 9)));
      if (Math.abs(lx) > w || Math.abs(ly) > 1) continue;
      const px = Math.floor(cx + u + S) % S, py = Math.floor(cy + v + S) % S;
      const k = py * S + px;
      const vein = Math.abs(lx) < 0.06 ? 0.75 : 1;
      col[k * 3] = c[0] * shade * vein;
      col[k * 3 + 1] = c[1] * shade * vein;
      col[k * 3 + 2] = c[2] * shade * vein;
      hgt[k] = 0.45 + 0.4 * lift + 0.1 * (1 - Math.abs(lx) / (w || 1));
    }
  }
  for (let t = 0; t < 260; t++) {
    const x0 = rand() * S, y0 = rand() * S, len = 10 + rand() * 30, ang = rand() * Math.PI;
    for (let s = 0; s < len; s++) {
      const px = Math.floor(x0 + Math.cos(ang) * s + S) % S, py = Math.floor(y0 + Math.sin(ang) * s + S) % S;
      const k = py * S + px;
      col.set(rgb(0x3b2a1b), k * 3);
      hgt[k] = 0.95;
    }
  }
  return { col, hgt };
}

function paintDirt(seed) {
  const col = new Float32Array(S * S * 3), hgt = new Float32Array(S * S);
  const rand = mulberry32(seed);
  const a = rgb(0x4b3a29), b = rgb(0x6d5639), c3 = rgb(0x3a2c1f);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tileFbm(x / 40, y / 40, S / 40, 5, seed) * 0.5 + 0.5;
    const g = tileFbm(x / 3, y / 3, S / 3, 2, seed + 3) * 0.5 + 0.5;
    const k = y * S + x;
    col.set(mix3(mix3(c3, a, n), b, g * 0.35), k * 3);
    hgt[k] = n * 0.5 + g * 0.15;
  }
  for (let p = 0; p < 900; p++) { // pebbles
    const cx = rand() * S, cy = rand() * S, r = 1.5 + rand() * 4;
    const shade = 0.35 + rand() * 0.35;
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const d = (u * u + v * v) / (r * r);
      if (d > 1) continue;
      const k = (Math.floor(cy + v + S) % S) * S + (Math.floor(cx + u + S) % S);
      const lit = 1 - d * 0.5;
      col[k * 3] = shade * lit; col[k * 3 + 1] = shade * 0.95 * lit; col[k * 3 + 2] = shade * 0.88 * lit;
      hgt[k] = 0.6 + 0.4 * (1 - d);
    }
  }
  return { col, hgt };
}

function paintRock(seed) {
  const col = new Float32Array(S * S * 3), hgt = new Float32Array(S * S);
  const g1 = rgb(0x6b6862), g2 = rgb(0x8f8a80), dk = rgb(0x3e3c38), lichen = rgb(0x8c8f52);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tileFbm(x / 64, y / 64, S / 64, 6, seed) * 0.5 + 0.5;
    const cr = Math.abs(tileFbm(x / 48, y / 48, S / 48, 3, seed + 9)); // crack lines where noise crosses 0
    const crack = clamp(1 - cr * 14, 0, 1);
    const sp = tileFbm(x / 2, y / 2, S / 2, 1, seed + 5) * 0.5 + 0.5; // granite speckle
    const li = clamp((tileFbm(x / 20, y / 20, S / 20, 3, seed + 11) - 0.35) * 3, 0, 1);
    let c = mix3(g1, g2, n);
    c = mix3(c, dk, sp > 0.78 ? 0.6 : 0);
    c = mix3(c, lichen, li * 0.55);
    c = mix3(c, dk, crack * 0.85);
    const k = y * S + x;
    col.set(c, k * 3);
    hgt[k] = n * 0.8 - crack * 0.5 + sp * 0.08;
  }
  return { col, hgt };
}

function paintMud(seed) {
  const col = new Float32Array(S * S * 3), hgt = new Float32Array(S * S);
  const rand = mulberry32(seed);
  const wet = rgb(0x3b3326), sand = rgb(0x8c7a5b), silt = rgb(0x5b5040);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tileFbm(x / 36, y / 36, S / 36, 5, seed) * 0.5 + 0.5;
    const r = tileFbm(x / 6, y / 14, S / 6, 2, seed + 2) * 0.5 + 0.5; // ripples
    const k = y * S + x;
    col.set(mix3(mix3(wet, silt, n), sand, clamp(r - 0.4, 0, 1) * 0.5), k * 3);
    hgt[k] = n * 0.4 + r * 0.2;
  }
  for (let p = 0; p < 1400; p++) { // river pebbles
    const cx = rand() * S, cy = rand() * S, r = 2 + rand() * 5, rr = r * (0.6 + rand() * 0.4);
    const base = mix3(rgb(0x6d6a63), rgb(0xa49c8c), rand());
    for (let v = -r; v <= r; v++) for (let u = -r; u <= r; u++) {
      const d = (u * u) / (r * r) + (v * v) / (rr * rr);
      if (d > 1) continue;
      const k = (Math.floor(cy + v + S) % S) * S + (Math.floor(cx + u + S) % S);
      const lit = 1 - d * 0.45 + (u < 0 ? 0.08 : 0);
      col[k * 3] = base[0] * lit; col[k * 3 + 1] = base[1] * lit; col[k * 3 + 2] = base[2] * lit;
      hgt[k] = 0.55 + 0.45 * (1 - d);
    }
  }
  return { col, hgt };
}

function toArrayTexture(layers, srgb) {
  const count = layers.length;
  const data = new Uint8Array(S * S * 4 * count);
  layers.forEach((layer, li) => data.set(layer, li * S * S * 4));
  const tex = new THREE.DataArrayTexture(data, S, S, count);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function packColor(col) {
  const out = new Uint8Array(S * S * 4);
  for (let k = 0; k < S * S; k++) {
    // linear-ish painted values -> sRGB bytes
    out[k * 4] = Math.pow(clamp(col[k * 3], 0, 1), 1 / 1.0) * 255;
    out[k * 4 + 1] = Math.pow(clamp(col[k * 3 + 1], 0, 1), 1 / 1.0) * 255;
    out[k * 4 + 2] = Math.pow(clamp(col[k * 3 + 2], 0, 1), 1 / 1.0) * 255;
    out[k * 4 + 3] = 255;
  }
  return out;
}

export function makeTerrainTextures(seed = 1) {
  const painters = [paintGrass, paintLitter, paintDirt, paintRock, paintMud];
  const strengths = [3, 4, 5, 7, 4];
  const albedo = [], normal = [];
  painters.forEach((paint, i) => {
    const { col, hgt } = paint(seed + i * 1000);
    albedo.push(packColor(col));
    normal.push(normalFromHeight(hgt, S, S, strengths[i]));
  });
  return { albedo: toArrayTexture(albedo, true), normal: toArrayTexture(normal, false) };
}

// ---------- Bark ----------
export function makeBarkTexture(kind, seed = 3) {
  const w = 256, h = 512;
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const hgt = new Float32Array(w * h);
  const base = kind === 'birch' ? rgb(0xe6e1d6) : kind === 'maple' ? rgb(0x6d665c) : rgb(0x5a4c3e);
  const deep = kind === 'birch' ? rgb(0x2a2724) : rgb(0x2b241d);
  const rand = mulberry32(seed + (kind === 'oak' ? 1 : kind === 'maple' ? 2 : 3));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v;
    if (kind === 'birch') {
      const band = tileFbm(x / 32, y / 6, w / 32, 3, seed) * 0.5 + 0.5;
      v = band > 0.72 ? 0 : 1;
    } else {
      // vertical furrows (oak deep + blocky, maple shallower plates)
      const fx = x / (kind === 'oak' ? 18 : 26), fy = y / (kind === 'oak' ? 90 : 60);
      const ridges = Math.abs(tileFbm(fx, fy, w / (kind === 'oak' ? 18 : 26), 4, seed));
      v = clamp(ridges * (kind === 'oak' ? 3.4 : 2.6), 0, 1);
    }
    const n = tileFbm(x / 10, y / 10, w / 10, 2, seed + 4) * 0.5 + 0.5;
    const k = y * w + x;
    hgt[k] = v * 0.85 + n * 0.15;
    const cc = mix3(deep, base, clamp(v * 0.9 + n * 0.2, 0, 1));
    const o = k * 4;
    img.data[o] = cc[0] * 255; img.data[o + 1] = cc[1] * 255; img.data[o + 2] = cc[2] * 255; img.data[o + 3] = 255;
  }
  if (kind === 'birch') {
    for (let l = 0; l < 70; l++) { // lenticels: thin dark horizontal dashes
      const x0 = rand() * w, y0 = rand() * h, len = 6 + rand() * 22;
      for (let s = 0; s < len; s++) {
        const k = (Math.floor(y0) % h) * w + Math.floor(x0 + s) % w;
        img.data[k * 4] = 40; img.data[k * 4 + 1] = 36; img.data[k * 4 + 2] = 32;
        hgt[k] = 0.2;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const nd = normalFromHeight(hgt, w, h, kind === 'oak' ? 6 : 4);
  const normalMap = new THREE.DataTexture(nd, w, h, THREE.RGBAFormat);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.generateMipmaps = true;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.needsUpdate = true;
  return { map, normalMap };
}

// ---------- Leaf clusters ----------
// Channels: R = shading (lit vs shadowed leaves), G = per-leaf random (used to pick
// fall colors + which leaves have dropped), B = vein darkening, A = cutout.
function leafOutline(kind, t) {
  // returns radius factor for polar angle t (0 = tip direction)
  if (kind === 'maple') {
    const lobes = Math.pow(Math.abs(Math.cos(2.5 * t)), 2.2);
    const taper = 0.62 + 0.38 * Math.cos(t / 2);
    const teeth = 0.06 * Math.abs(Math.sin(15 * t));
    return (0.42 + 0.58 * lobes) * taper + teeth;
  }
  if (kind === 'birch') return 0.9 * Math.pow(Math.abs(Math.cos(t / 2)), 0.6) + 0.04 * Math.abs(Math.sin(24 * t));
  // oak: long leaf with rounded lobes along the sides
  const along = Math.cos(t);
  const lobe = 0.5 + 0.5 * Math.abs(Math.sin(t * 4.5));
  return (0.35 + 0.65 * Math.pow(Math.abs(along), 0.8)) * (0.6 + 0.4 * lobe);
}

export function makeLeafTexture(kind, seed = 9) {
  const size = 512;
  const c = canvas(size, size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rand = mulberry32(seed + kind.length * 77);
  const count = kind === 'birch' ? 70 : kind === 'maple' ? 34 : 42;
  const order = [];
  for (let i = 0; i < count; i++) order.push(i);
  for (const i of order) {
    // leaves spread around a twig cluster center, back ones darker
    const ang = rand() * Math.PI * 2, dist = Math.sqrt(rand()) * size * 0.38;
    const cx = size / 2 + Math.cos(ang) * dist, cy = size / 2 + Math.sin(ang) * dist;
    const len = (kind === 'maple' ? 54 : kind === 'birch' ? 30 : 58) * (0.75 + rand() * 0.5);
    const rot = ang + (rand() - 0.5) * 1.2;
    const shade = 0.55 + 0.45 * (i / count) + (rand() - 0.5) * 0.1;
    const leafRand = rand();
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const R = Math.ceil(len * 1.1);
    for (let v = -R; v <= R; v++) for (let u = -R; u <= R; u++) {
      const px = Math.round(cx + u), py = Math.round(cy + v);
      if (px < 0 || py < 0 || px >= size || py >= size) continue;
      // leaf space: x along midrib (tip = +x)
      const lx = (u * ca + v * sa), ly = (-u * sa + v * ca);
      let r, t;
      if (kind === 'oak') {
        // elongated: scale y
        const ex = lx / len, ey = ly / (len * 0.42);
        r = Math.hypot(ex, ey); t = Math.atan2(ey, ex);
      } else {
        const ex = lx / (len * 0.55), ey = ly / (len * 0.55);
        r = Math.hypot(ex, ey); t = Math.atan2(ey, ex);
      }
      const edge = leafOutline(kind, t);
      if (r > edge) continue;
      const o = (py * size + px) * 4;
      const rim = clamp((edge - r) * 6, 0, 1);
      const midrib = Math.abs(ly) < 1.2 && lx > -len * 0.4 ? 1 : 0;
      const veins = Math.abs(Math.sin(Math.atan2(ly, lx - len * 0.1) * (kind === 'maple' ? 2.5 : 5))) < 0.05 ? 1 : 0;
      d[o] = clamp(shade * (0.82 + 0.18 * rim), 0, 1) * 255;
      d[o + 1] = leafRand * 255;
      d[o + 2] = (midrib || veins ? 0.55 : 1) * 255;
      d[o + 3] = 255;
    }
    // stem
    for (let s = 0; s < len * 0.35; s++) {
      const px = Math.round(cx - ca * s), py = Math.round(cy - sa * s);
      if (px < 0 || py < 0 || px >= size || py >= size) continue;
      const o = (py * size + px) * 4;
      if (d[o + 3] === 0) { d[o] = 90; d[o + 1] = leafRand * 255; d[o + 2] = 120; d[o + 3] = 255; }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; // data channels, not colors
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.premultiplyAlpha = false;
  return tex;
}

// ---------- Water ripples (normal map) ----------
export function makeWaterNormal(seed = 21) {
  const w = 256;
  const hgt = new Float32Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    hgt[y * w + x] = tileFbm(x / 16, y / 16, w / 16, 5, seed) * 0.5 + 0.5;
  }
  const nd = normalFromHeight(hgt, w, w, 2.5);
  const tex = new THREE.DataTexture(nd, w, w, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
