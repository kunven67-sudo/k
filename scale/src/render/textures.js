// Procedural textures, generated in code at load (no image files). Each generator draws a height
// field and a color field; the normal map is derived from the height so bumps light correctly.
import * as THREE from 'three';
import { hash3 } from '../core/util.js';

const cache = new Map();

// --- noise ---------------------------------------------------------------------------------------
function vnoise(x, y, seed, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const P = (a) => ((a % period) + period) % period;
  const a = hash3(P(xi), P(yi), 0, seed), b = hash3(P(xi + 1), P(yi), 0, seed);
  const c = hash3(P(xi), P(yi + 1), 0, seed), d = hash3(P(xi + 1), P(yi + 1), 0, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Tileable fractal noise in [0,1]. (x,y) in [0,1) over the texture.
export function fbm(x, y, { freq = 8, oct = 5, seed = 1, gain = 0.5 } = {}) {
  let s = 0, amp = 1, norm = 0, f = freq;
  for (let o = 0; o < oct; o++) {
    s += vnoise(x * f, y * f, seed + o * 31, f) * amp;
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return s / norm;
}

// --- builders ------------------------------------------------------------------------------------
function makeTex(data, size, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// Fill color/height/roughness from fn(u, v) -> [r,g,b, height, rough] (0..1 each).
export function generate(key, size, fn, { normalStrength = 2 } = {}) {
  if (cache.has(key)) return cache.get(key);
  const col = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const o = fn(x / size, y / size);
      col[i * 4] = Math.max(0, Math.min(255, o[0] * 255));
      col[i * 4 + 1] = Math.max(0, Math.min(255, o[1] * 255));
      col[i * 4 + 2] = Math.max(0, Math.min(255, o[2] * 255));
      col[i * 4 + 3] = 255;
      h[i] = o[3];
      const r = Math.max(0, Math.min(255, o[4] * 255));
      rough[i * 4] = r;
      rough[i * 4 + 1] = r; // roughnessMap reads G
      rough[i * 4 + 2] = r;
      rough[i * 4 + 3] = 255;
    }
  }
  const nrm = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const d = h[((y - 1 + size) % size) * size + x], u = h[((y + 1) % size) * size + x];
      let nx = (l - r) * normalStrength, ny = (d - u) * normalStrength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      nrm[i] = (nx * 0.5 + 0.5) * 255;
      nrm[i + 1] = (ny * 0.5 + 0.5) * 255;
      nrm[i + 2] = (nz * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
    }
  }
  const out = {
    map: makeTex(col, size),
    normalMap: makeTex(nrm, size, { srgb: false }),
    roughnessMap: makeTex(rough, size, { srgb: false }),
  };
  cache.set(key, out);
  return out;
}

// Same texture set with its own repeat (textures are shared, repeat is per clone).
export function withRepeat(set, rx, ry = rx) {
  const o = {};
  for (const k of Object.keys(set)) {
    const t = set[k].clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    o[k] = t;
  }
  return o;
}

const mix = (a, b, t) => a + (b - a) * t;
const hex = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

// Oak plank floor: 6 planks across, staggered ends, grain lines, knots, satin finish.
export function woodFloor(base = 0x8a5a36) {
  const [br, bg, bb] = hex(base);
  return generate(`wood${base}`, 512, (u, v) => {
    const planks = 6;
    const pi = Math.floor(v * planks);
    const pv = v * planks - pi;
    const off = hash3(pi, 0, 0, 7) * 0.9;
    const uu = (u + off) % 1;
    const len = 0.5;
    const pj = Math.floor(uu / len);
    const pu = (uu / len) % 1;
    const tone = 0.82 + hash3(pi, pj, 0, 3) * 0.3;
    const grain = fbm(uu * 0.6, pv * 0.15 + pi * 0.37, { freq: 4, oct: 4, seed: 11 });
    const lines = Math.sin((pv * 22 + grain * 9 + hash3(pi, pj, 1, 5) * 6) * Math.PI) * 0.5 + 0.5;
    const knot = Math.max(0, 1 - Math.hypot((pu - hash3(pi, pj, 2, 9)) * 3, (pv - 0.5) * 1.4) * 6);
    let d = tone * (0.78 + lines * 0.18 + grain * 0.12) - knot * 0.25;
    const seam = Math.min(pv, 1 - pv) < 0.012 || Math.min(pu, 1 - pu) < 0.004 ? 0.55 : 1;
    d *= seam;
    const height = seam < 1 ? 0 : 0.6 + lines * 0.06 - knot * 0.1;
    return [br * d, bg * d, bb * d, height, 0.38 + lines * 0.1 + (seam < 1 ? 0.3 : 0)];
  }, { normalStrength: 3 });
}

// Painted drywall / plaster: very subtle orange-peel texture.
export function plaster(base = 0xe8e2d8) {
  const [r, g, b] = hex(base);
  return generate(`plaster${base}`, 256, (u, v) => {
    const n = fbm(u, v, { freq: 16, oct: 4, seed: 21 });
    const d = 0.96 + n * 0.06;
    return [r * d, g * d, b * d, n * 0.6, 0.85];
  }, { normalStrength: 1.2 });
}

// Woven fabric (sofa, curtains): over-under weave + fuzz.
export function fabric(base = 0x55606e, weave = 64) {
  const [r, g, b] = hex(base);
  return generate(`fabric${base}_${weave}`, 256, (u, v) => {
    const wx = Math.sin(u * weave * Math.PI * 2), wy = Math.sin(v * weave * Math.PI * 2);
    const over = (Math.floor(u * weave) + Math.floor(v * weave)) % 2 ? wx : wy;
    const fuzz = fbm(u, v, { freq: 32, oct: 3, seed: 41 });
    const d = 0.85 + over * 0.07 + fuzz * 0.12;
    return [r * d, g * d, b * d, 0.5 + over * 0.25 + fuzz * 0.15, 0.92];
  }, { normalStrength: 2.5 });
}

// Cut-pile rug/carpet: dense speckle of fiber tips.
export function carpet(base = 0x8a7c6a) {
  const [r, g, b] = hex(base);
  return generate(`carpet${base}`, 256, (u, v) => {
    const s = hash3(Math.floor(u * 256), Math.floor(v * 256), 0, 51);
    const n = fbm(u, v, { freq: 8, oct: 3, seed: 52 });
    const d = 0.72 + s * 0.35 + n * 0.12;
    return [r * d, g * d, b * d, s * 0.8 + n * 0.2, 0.98];
  }, { normalStrength: 2 });
}

// Ceramic floor tile with grout lines.
export function tile(base = 0xd9d4cb, grout = 0x8d877c, n = 4) {
  const [r, g, b] = hex(base), [gr, gg, gb] = hex(grout);
  return generate(`tile${base}_${n}`, 512, (u, v) => {
    const tu = (u * n) % 1, tv = (v * n) % 1;
    const edge = Math.min(tu, 1 - tu, tv, 1 - tv);
    const gro = edge < 0.015;
    const n2 = fbm(u, v, { freq: 6, oct: 4, seed: 61 });
    const tint = 0.95 + hash3(Math.floor(u * n), Math.floor(v * n), 0, 62) * 0.06 + n2 * 0.05;
    if (gro) return [gr, gg, gb, 0, 0.95];
    const bevel = Math.min(1, edge / 0.03);
    return [r * tint, g * tint, b * tint, 0.4 + bevel * 0.6, 0.18 + n2 * 0.1];
  }, { normalStrength: 2.5 });
}

// Brushed metal (appliances, the RIFT machine panels).
export function brushed(base = 0xb8bcc2) {
  const [r, g, b] = hex(base);
  return generate(`brushed${base}`, 256, (u, v) => {
    const s = fbm(u * 0.05, v, { freq: 64, oct: 3, seed: 71 });
    const d = 0.9 + s * 0.15;
    return [r * d, g * d, b * d, s, 0.32 + s * 0.15];
  }, { normalStrength: 0.8 });
}

// Lawn seen from above (normal size); real blades are added near you when you're small.
export function grass() {
  return generate('grass', 512, (u, v) => {
    const n = fbm(u, v, { freq: 8, oct: 5, seed: 81 });
    const s = hash3(Math.floor(u * 512), Math.floor(v * 512), 0, 82);
    const dry = fbm(u, v, { freq: 3, oct: 3, seed: 83 });
    const g = 0.32 + n * 0.22 + s * 0.12;
    return [g * (0.55 + dry * 0.35), g * (1.0 + dry * 0.1), g * 0.32, s * 0.7 + n * 0.3, 0.95];
  }, { normalStrength: 3 });
}

// Concrete / sidewalk.
export function concrete(base = 0xa7a39b) {
  const [r, g, b] = hex(base);
  return generate(`concrete${base}`, 512, (u, v) => {
    const n = fbm(u, v, { freq: 6, oct: 6, seed: 91 });
    const pore = hash3(Math.floor(u * 512), Math.floor(v * 512), 0, 92) > 0.985 ? -0.25 : 0;
    const d = 0.85 + n * 0.25 + pore;
    return [r * d, g * d, b * d, n + pore, 0.9];
  }, { normalStrength: 2 });
}
