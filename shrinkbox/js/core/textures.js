// Every texture in the game is painted by code at start-up (no image files to download).
import * as THREE from 'three';
import { fbm, vnoise, rng, clamp } from './noise.js';

let RES = 512;
export function setTextureRes(r) { RES = r; }
const cache = new Map();

function canvas(w, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// Fill an ImageData with fn(u, v) -> [r, g, b] (0..255) and a height (0..1) for normals.
function paint(size, fn) {
  const c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = fn(x / size, y / size, x, y);
    const i = (y * size + x) * 4;
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255;
    height[y * size + x] = o[3] ?? 0.5;
  }
  ctx.putImageData(img, 0, 0);
  return { c, height };
}

function normalFrom(height, size, strength = 2) {
  const c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  const H = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

function grayTex(height, size, fn) {
  const c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size), d = img.data;
  for (let i = 0; i < size * size; i++) { const v = clamp(fn(height[i]), 0, 1) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// Returns { map, normalMap, roughnessMap } for a named surface.
export function surface(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const S = opts.size || RES;
  let out;
  const make = (fn, nStrength, roughFn) => {
    const { c, height } = paint(S, fn);
    const r = { map: tex(c), normalMap: tex(normalFrom(height, S, nStrength), { srgb: false }) };
    if (roughFn) r.roughnessMap = tex(grayTex(height, S, roughFn), { srgb: false });
    return r;
  };
  switch (name) {
    case 'wood': { // desk / bed frame / floor planks
      const a = hex(opts.a ?? 0x8a5a33), b = hex(opts.b ?? 0x5b3a20);
      out = make((u, v) => {
        const w = fbm(u * 4, v * 40, 4, 4) * 6 + v * 3;
        const ring = (Math.sin(w * 6.283 * 2 + fbm(u * 8, v * 8, 3, 8) * 4) + 1) / 2;
        const grain = vnoise(u * 900, v * 12, 900);
        const t = clamp(ring * 0.65 + grain * 0.35, 0, 1);
        const col = mix(a, b, t);
        return [...col, 0.5 + ring * 0.2 - grain * 0.15];
      }, 1.2, (h) => 0.5 + (0.6 - h) * 0.5);
      break;
    }
    case 'planks': {
      const a = hex(opts.a ?? 0x9c6b42), b = hex(opts.b ?? 0x6a4428);
      out = make((u, v) => {
        const row = Math.floor(v * 8), off = (row * 0.37) % 1;
        const pu = (u + off) % 1, seam = Math.min(v * 8 % 1, 1 - v * 8 % 1) < 0.015 || Math.min(pu * 2 % 1, 1 - pu * 2 % 1) < 0.006;
        const w = fbm(pu * 2 + row, v * 60, 4, 64) * 5;
        const ring = (Math.sin(w * 9 + row) + 1) / 2;
        const tone = vnoise(row * 3.1, Math.floor(pu * 2), 64);
        let col = mix(a, b, ring * 0.5 + tone * 0.4);
        if (seam) col = mix(col, [30, 18, 10], 0.75);
        return [...col, seam ? 0.1 : 0.5 + ring * 0.1];
      }, 2, (h) => 0.35 + (0.5 - h) * 0.8);
      break;
    }
    case 'carpet': {
      const a = hex(opts.color ?? 0x6f7680);
      out = make((u, v) => {
        const fib = vnoise(u * S * 0.9, v * S * 0.9, S * 0.9) * 0.6 + vnoise(u * S * 0.3, v * S * 0.3, Math.round(S * 0.3)) * 0.4;
        const blot = fbm(u * 6, v * 6, 3, 6);
        const t = fib * 0.7 + blot * 0.3;
        return [...mix(a.map((x) => x * 0.65), a.map((x) => Math.min(255, x * 1.2)), t), fib];
      }, 3.5, () => 0.95);
      break;
    }
    case 'fabric': { // bed sheets, hoodie, couch
      const a = hex(opts.color ?? 0x3b5b8a);
      out = make((u, v, x, y) => {
        const weave = ((x + y) % 4 < 2 ? 1 : 0) * 0.5 + ((x - y + 1000) % 4 < 2 ? 1 : 0) * 0.5;
        const n = fbm(u * 10, v * 10, 3, 10);
        const t = weave * 0.25 + n * 0.5;
        return [...mix(a.map((x) => x * 0.75), a.map((x) => Math.min(255, x * 1.1)), t), weave * 0.6 + n * 0.4];
      }, 1.5, () => 0.9);
      break;
    }
    case 'plastic': { // matte console plastic, fine texture
      const a = hex(opts.color ?? 0x15171a);
      out = make((u, v) => {
        const n = vnoise(u * S * 0.5, v * S * 0.5, Math.round(S * 0.5)) * 0.5 + fbm(u * 20, v * 20, 3, 20) * 0.5;
        const scratch = Math.abs(Math.sin((u * 3 + v * 7) * 40 + fbm(u * 3, v * 3, 2, 3) * 30)) > 0.998 ? 1 : 0;
        const col = a.map((x) => clamp(x * (0.92 + n * 0.16) + scratch * 25, 0, 255));
        return [...col, n * 0.6];
      }, 0.8, (h) => 0.55 + h * 0.2);
      break;
    }
    case 'metal': { // brushed aluminium
      const a = hex(opts.color ?? 0xb8bcc2);
      out = make((u, v) => {
        const brush = vnoise(u * 4, v * S, S) * 0.7 + vnoise(u * 2, v * S * 0.5, Math.round(S * 0.5)) * 0.3;
        return [...a.map((x) => clamp(x * (0.85 + brush * 0.25), 0, 255)), brush];
      }, 0.6, (h) => 0.28 + h * 0.15);
      break;
    }
    case 'paint': { // wall paint with faint roller texture
      const a = hex(opts.color ?? 0xd9d4c7);
      out = make((u, v) => {
        const n = fbm(u * 30, v * 30, 4, 30) * 0.6 + vnoise(u * S * 0.6, v * S * 0.6, Math.round(S * 0.6)) * 0.4;
        return [...a.map((x) => clamp(x * (0.95 + n * 0.08), 0, 255)), n];
      }, 0.9, () => 0.85);
      break;
    }
    case 'pcb': { // green circuit board with copper traces
      const R = rng(7);
      const { c, height } = paint(S, (u, v) => {
        const n = vnoise(u * S * 0.4, v * S * 0.4, Math.round(S * 0.4));
        return [...mix([18, 70, 38], [28, 96, 52], n), 0.4];
      });
      const ctx = c.getContext('2d');
      ctx.lineCap = 'round';
      for (let i = 0; i < 160; i++) {
        let x = R() * S, y = R() * S;
        ctx.strokeStyle = R() < 0.85 ? 'rgba(60,140,80,0.9)' : 'rgba(205,160,70,0.95)';
        ctx.lineWidth = 1 + R() * 2.5 * S / 512;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          const len = (20 + R() * 90) * S / 512, dir = Math.floor(R() * 8) * Math.PI / 4;
          x += Math.cos(dir) * len; y += Math.sin(dir) * len; ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(210,190,140,1)';
        ctx.beginPath(); ctx.arc(x, y, 2.5 * S / 512, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(240,240,230,.85)'; ctx.font = `${10 * S / 512}px monospace`;
      for (let i = 0; i < 30; i++) ctx.fillText(['R', 'C', 'U', 'L', 'Q', 'J'][i % 6] + Math.floor(R() * 400), R() * S, R() * S);
      out = { map: tex(c), normalMap: tex(normalFrom(height, S, 1), { srgb: false }) };
      break;
    }
    case 'skin': {
      const a = hex(opts.color ?? 0xc68a64);
      out = make((u, v) => {
        const n = fbm(u * 40, v * 40, 3, 40), pore = vnoise(u * S * 0.7, v * S * 0.7, Math.round(S * 0.7));
        return [...a.map((x, i) => clamp(x * (0.94 + n * 0.1) + (i === 0 ? n * 8 : 0), 0, 255)), pore * 0.5 + n * 0.5];
      }, 0.6, (h) => 0.55 + h * 0.15);
      break;
    }
    case 'concrete': {
      out = make((u, v) => {
        const n = fbm(u * 8, v * 8, 5, 8), p = vnoise(u * S * 0.8, v * S * 0.8, Math.round(S * 0.8));
        const g = 120 + n * 60 + p * 20;
        return [g, g * 0.98, g * 0.95, n * 0.7 + p * 0.3];
      }, 2, () => 0.92);
      break;
    }
    default: throw new Error('unknown surface ' + name);
  }
  cache.set(key, out);
  return out;
}

// Generic canvas painter for labels, screens, posters. draw(ctx, w, h).
export function drawTexture(w, h, draw, key) {
  if (key && cache.has(key)) return cache.get(key);
  const c = canvas(w, h);
  draw(c.getContext('2d'), w, h);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (key) cache.set(key, t);
  return t;
}
