// Procedural material textures (albedo detail, roughness, normal) generated at load.
// Stand-ins until real photo-scanned textures can be downloaded; assets/ textures override these.
// Albedo maps are mostly luminance so a material's color (or a paint color) tints them.
import * as THREE from 'three';

const S = 512;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Tileable value-noise fBm. Lattice wraps so textures repeat seamlessly.
function fbm(seed, baseFreq, octaves = 5, sx = 1, sy = 1) {
  const r = rng(seed);
  const out = new Float32Array(S * S);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const fx = Math.max(1, Math.round(baseFreq * sx * 2 ** o)), fy = Math.max(1, Math.round(baseFreq * sy * 2 ** o));
    const lat = new Float32Array(fx * fy);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < S; y++) {
      const gy = (y / S) * fy, iy = Math.floor(gy), ty = gy - iy, sy2 = ty * ty * (3 - 2 * ty);
      const y0 = (iy % fy) * fx, y1 = ((iy + 1) % fy) * fx;
      for (let x = 0; x < S; x++) {
        const gx = (x / S) * fx, ix = Math.floor(gx), tx = gx - ix, sx2 = tx * tx * (3 - 2 * tx);
        const x0 = ix % fx, x1 = (ix + 1) % fx;
        const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
        out[y * S + x] += amp * (a + (b - a) * sx2 + (c - a) * sy2 + (a - b - c + d) * sx2 * sy2);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function speckles(arr, seed, count, rMin, rMax, value, mode = 'set') {
  const r = rng(seed);
  for (let n = 0; n < count; n++) {
    const cx = r() * S, cy = r() * S, rad = rMin + r() * (rMax - rMin);
    const R = Math.ceil(rad);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy) / rad;
      if (d > 1) continue;
      const x = (Math.floor(cx + dx) + S) % S, y = (Math.floor(cy + dy) + S) % S;
      const k = 1 - d * d;
      const i = y * S + x;
      arr[i] = mode === 'set' ? arr[i] + (value - arr[i]) * k : arr[i] + value * k;
    }
  }
}

function toTexture(fill, srgb) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  fill(img.data);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function grayTex(arr, lo, hi, srgb = true) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += lo + (hi - lo) * arr[i];
  const t = toTexture((d) => {
    for (let i = 0; i < arr.length; i++) {
      const v = clamp(255 * (lo + (hi - lo) * arr[i]));
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
  }, srgb);
  t.userData.mean = Math.min(1, Math.max(0.02, sum / arr.length));
  return t;
}

// RGB albedo from luminance + a tint function (for e.g. rust spots on metal).
function tintTex(lum, tintFn) {
  return toTexture((d) => {
    for (let i = 0; i < lum.length; i++) {
      const [r, g, b] = tintFn(i, lum[i]);
      d[i * 4] = clamp(r * 255); d[i * 4 + 1] = clamp(g * 255); d[i * 4 + 2] = clamp(b * 255); d[i * 4 + 3] = 255;
    }
  }, true);
}

function normalTex(h, strength) {
  return toTexture((d) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const l = h[y * S + ((x - 1 + S) % S)], r = h[y * S + ((x + 1) % S)];
      const u = h[((y - 1 + S) % S) * S + x], dn = h[((y + 1) % S) * S + x];
      let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * S + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }, false);
}

// --------------------------------------------------------------------------- recipes
function concrete(seed = 11, coarse = false) {
  const base = fbm(seed, coarse ? 6 : 4, 6);
  const fine = fbm(seed + 1, 32, 3);
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = base[i] * 0.6 + fine[i] * 0.4;
  speckles(h, seed + 2, coarse ? 900 : 500, 0.6, coarse ? 3.5 : 2.2, 0.05);  // air pits
  speckles(h, seed + 3, 700, 0.5, 1.6, 0.9);                                 // aggregate
  const lum = h.map((v, i) => 0.82 + (v - 0.5) * 0.35 + (base[i] - 0.5) * 0.25);
  const rough = h.map((v) => 0.75 + (1 - v) * 0.25);
  return { map: grayTex(lum, 0, 1), roughnessMap: grayTex(rough, 0, 1, false), normalMap: normalTex(h, coarse ? 7 : 4), tile: 1.5 };
}

function wood(seed = 21, light = false) {
  // grain runs along U; rings warped by low-frequency noise
  const warp = fbm(seed, 3, 4, 1, 4);
  const fine = fbm(seed + 1, 8, 4, 1, 24);
  const lum = new Float32Array(S * S), h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const ring = Math.sin(((y / S) * 18 + warp[i] * 6) * Math.PI * 2);
    const late = Math.pow(ring * 0.5 + 0.5, light ? 6 : 3);
    lum[i] = (light ? 1.0 : 0.95) - late * (light ? 0.18 : 0.32) + (fine[i] - 0.5) * 0.18;
    h[i] = late * 0.6 + fine[i] * 0.4;
  }
  speckles(lum, seed + 4, light ? 3 : 6, 3, 9, 0.45); // knots
  const rough = h.map((v) => 0.62 + v * 0.3);
  return { map: grayTex(lum, 0, 1), roughnessMap: grayTex(rough, 0, 1, false), normalMap: normalTex(h, 2.5), tile: 1.2 };
}

function metal(seed = 31, rusty = true, brushed = true) {
  const brush = fbm(seed, 2, 5, 1, 40);
  const blot = fbm(seed + 1, 3, 5);
  const fine = fbm(seed + 2, 24, 3);
  const lum = new Float32Array(S * S), rough = new Float32Array(S * S), h = new Float32Array(S * S);
  const rust = new Float32Array(S * S);
  for (let i = 0; i < lum.length; i++) {
    const r = rusty ? Math.max(0, (blot[i] - 0.62) * 4) * (0.6 + fine[i] * 0.8) : 0;
    rust[i] = Math.min(1, r);
    lum[i] = 0.92 + (brushed ? (brush[i] - 0.5) * 0.16 : 0) + (fine[i] - 0.5) * 0.06 - (blot[i] - 0.5) * 0.12;
    rough[i] = 0.35 + (brushed ? brush[i] * 0.2 : 0) + rust[i] * 0.5 + (blot[i] - 0.5) * 0.2;
    h[i] = (brushed ? brush[i] * 0.3 : 0) + rust[i] * fine[i];
  }
  const map = tintTex(lum, (i, l) => {
    const r = rust[i];
    // rust: orange-brown, multiplied by the material/paint color later
    return [l * (1 - r) + r * 0.62 * (0.7 + l * 0.3), l * (1 - r) + r * 0.36, l * (1 - r) + r * 0.22];
  });
  return { map, roughnessMap: grayTex(rough, 0, 1, false), normalMap: normalTex(h, 3), tile: 1 };
}

function rubber(seed = 41) {
  const f = fbm(seed, 40, 3);
  return { map: grayTex(f.map((v) => 0.9 + (v - 0.5) * 0.2), 0, 1), roughnessMap: grayTex(f.map((v) => 0.8 + v * 0.2), 0, 1, false), normalMap: normalTex(f, 2), tile: 0.5 };
}

function plastic(seed = 51) {
  const f = fbm(seed, 6, 4);
  const fine = fbm(seed + 1, 64, 2);
  return { map: grayTex(f.map((v, i) => 0.96 + (v - 0.5) * 0.08 + (fine[i] - 0.5) * 0.04), 0, 1), roughnessMap: grayTex(f.map((v) => 0.4 + v * 0.3), 0, 1, false), normalMap: normalTex(fine, 0.8), tile: 0.6 };
}

function cardboard(seed = 61) {
  const fib = fbm(seed, 10, 4, 1, 6);
  const blot = fbm(seed + 1, 4, 4);
  const lum = new Float32Array(S * S), h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const flute = Math.sin((y / S) * Math.PI * 2 * 48) * 0.5 + 0.5;
    lum[i] = 0.93 + (fib[i] - 0.5) * 0.18 - (blot[i] - 0.5) * 0.15;
    h[i] = flute * 0.35 + fib[i] * 0.3;
  }
  return { map: grayTex(lum, 0, 1), roughnessMap: grayTex(h.map((v) => 0.85 + v * 0.15), 0, 1, false), normalMap: normalTex(h, 1.5), tile: 0.5 };
}

function ice(seed = 71) {
  const f = fbm(seed, 5, 5);
  const cracks = new Float32Array(S * S);
  const r = rng(seed + 3);
  // a few hairline cracks
  for (let n = 0; n < 14; n++) {
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
    for (let s = 0; s < 220; s++) {
      a += (r() - 0.5) * 0.5;
      x = (x + Math.cos(a) + S) % S; y = (y + Math.sin(a) + S) % S;
      cracks[Math.floor(y) * S + Math.floor(x)] = 1;
    }
  }
  const lum = f.map((v, i) => 0.92 + (v - 0.5) * 0.12 + cracks[i] * 0.1);
  return { map: grayTex(lum, 0, 1), roughnessMap: grayTex(f.map((v, i) => 0.05 + v * 0.15 + cracks[i] * 0.4), 0, 1, false), normalMap: normalTex(f.map((v, i) => v * 0.4 + cracks[i]), 1.5), tile: 0.8 };
}

function paperWrap(seed = 81) {
  const f = fbm(seed, 12, 4, 1, 3);
  return { map: grayTex(f.map((v) => 0.92 + (v - 0.5) * 0.16), 0, 1), roughnessMap: grayTex(f.map((v) => 0.7 + v * 0.2), 0, 1, false), normalMap: normalTex(f, 1), tile: 0.4 };
}

function glassSmudge(seed = 91) {
  const f = fbm(seed, 5, 5);
  return { roughnessMap: grayTex(f.map((v) => 0.02 + Math.max(0, v - 0.55) * 0.5), 0, 1, false), tile: 1 };
}

const RECIPES = {
  concrete: () => concrete(11),
  cinder: () => concrete(13, true),
  wood: () => wood(21),
  plywood: () => wood(23, true),
  steel: () => metal(31, true, true),
  aluminum: () => metal(33, false, true),
  rubber: () => rubber(),
  plastic: () => plastic(),
  cardboard: () => cardboard(),
  ice: () => ice(),
  tnt: () => paperWrap(),
  glass: () => glassSmudge(),
  tempered: () => glassSmudge(93),
};

const cache = new Map();
export function proceduralTextures(id) {
  if (cache.has(id)) return cache.get(id);
  const fn = RECIPES[id];
  const t = fn ? fn() : null;
  if (t) for (const k of ['map', 'roughnessMap', 'normalMap']) if (t[k]) t[k].repeat.set(1 / t.tile, 1 / t.tile);
  cache.set(id, t);
  return t;
}
export const PROC_IDS = Object.keys(RECIPES);
