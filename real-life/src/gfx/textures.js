// Procedural PBR texture generation. A "kind" is described by a per-pixel function that returns
// height / color / roughness / metalness / ao; this module bakes it into GPU textures:
//   map            (sRGB color)
//   normalMap      (from the height field, tangent space)
//   ormMap         (R = ambient occlusion, G = roughness, B = metalness) → used as aoMap,
//                  roughnessMap and metalnessMap at once.
// Everything tiles seamlessly (use the periodic noise in noise.js with u, v in [0,1)).
// Results are cached per key so a kind is only generated once per session.

import * as THREE from 'three';
import { currentTier } from '../core/quality.js';

const cache = new Map();
let maxAnisotropy = 8;

export function setMaxAnisotropy(n) {
  maxAnisotropy = n;
}

export function textureSize(base = 512) {
  const tier = currentTier().name;
  const scale = { low: 0.5, medium: 0.5, high: 1, ultra: 2 }[tier] ?? 1;
  return Math.max(64, Math.min(2048, Math.round(base * scale)));
}

function makeTexture(data, size, srgb) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Bake a PBR texture set.
 * @param {string} key cache key
 * @param {number} size texture resolution (power of two)
 * @param {(u:number, v:number, out:object) => void} fn fills out.{r,g,b (0..1 sRGB), h (0..1),
 *        rough (0..1), metal (0..1), ao (0..1)}
 * @param {{normalStrength?:number}} opts
 */
export function bakePBR(key, size, fn, { normalStrength = 2.0 } = {}) {
  if (cache.has(key)) return cache.get(key);
  const n = size * size;
  const color = new Uint8Array(n * 4);
  const orm = new Uint8Array(n * 4);
  const height = new Float32Array(n);
  const out = { r: 0.5, g: 0.5, b: 0.5, h: 0.5, rough: 0.8, metal: 0, ao: 1 };
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      out.r = out.g = out.b = 0.5;
      out.h = 0.5;
      out.rough = 0.8;
      out.metal = 0;
      out.ao = 1;
      fn(u, v, out);
      const i = y * size + x;
      color[i * 4] = clamp255(out.r);
      color[i * 4 + 1] = clamp255(out.g);
      color[i * 4 + 2] = clamp255(out.b);
      color[i * 4 + 3] = 255;
      orm[i * 4] = clamp255(out.ao);
      orm[i * 4 + 1] = clamp255(out.rough);
      orm[i * 4 + 2] = clamp255(out.metal);
      orm[i * 4 + 3] = 255;
      height[i] = out.h;
    }
  }
  const normal = new Uint8Array(n * 4);
  const s = normalStrength * (size / 512);
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1 + size) % size) * size;
    const yp = ((y + 1) % size) * size;
    const yc = y * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (height[yc + xp] - height[yc + xm]) * s;
      const dy = (height[yp + x] - height[ym + x]) * s;
      // DataTexture rows go bottom-up in UV space, so +y in the array is +v.
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (yc + x) * 4;
      normal[i] = (nx * 0.5 + 0.5) * 255;
      normal[i + 1] = (ny * 0.5 + 0.5) * 255;
      normal[i + 2] = (nz * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
    }
  }
  const set = {
    map: makeTexture(color, size, true),
    ormMap: makeTexture(orm, size, false),
    normalMap: makeTexture(normal, size, false),
    height,
    size,
  };
  cache.set(key, set);
  return set;
}

function clamp255(v) {
  return v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0;
}

// Canvas-drawn texture (signage, posters, labels, patterns that are easier to draw than compute).
export function canvasTexture(key, width, height, draw, { srgb = true, repeat = false } = {}) {
  if (key && cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (key) cache.set(key, tex);
  return tex;
}

// Small color helpers (sRGB 0..1 space).
export function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  c.convertLinearToSRGB();
  return [c.r, c.g, c.b];
}

export function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
