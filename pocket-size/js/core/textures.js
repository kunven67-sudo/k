// Procedural PBR texture sets (color + normal + roughness) generated on canvases at load time.
// Nothing here is downloaded: every plank, fiber and tile is computed from noise.
import * as THREE from 'three';
import { fbm2, perlin2, worley2, hash2, mulberry32, clamp, smoothstep } from './noise.js';
import { getPreset } from './settings.js';

const cache = new Map();
let anisotropy = 8;

export function setAnisotropy(a) { anisotropy = a; }

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, srgb, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Builds color/normal/roughness canvases from a per-pixel function.
// fn(u, v, x, y) must return [r, g, b, height(0..1), roughness(0..1)] with rgb in 0..255.
function build(size, fn, normalStrength = 2) {
  const col = canvas(size), nrm = canvas(size), rgh = canvas(size);
  const cctx = col.getContext('2d'), nctx = nrm.getContext('2d'), rctx = rgh.getContext('2d');
  const cimg = cctx.createImageData(size, size), nimg = nctx.createImageData(size, size), rimg = rctx.createImageData(size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const o = fn(u, v, x, y);
      const i = y * size + x, p = i * 4;
      cimg.data[p] = clamp(o[0], 0, 255); cimg.data[p + 1] = clamp(o[1], 0, 255); cimg.data[p + 2] = clamp(o[2], 0, 255); cimg.data[p + 3] = 255;
      H[i] = o[3];
      const r = clamp(o[4], 0, 1) * 255;
      rimg.data[p] = r; rimg.data[p + 1] = r; rimg.data[p + 2] = r; rimg.data[p + 3] = 255;
    }
  }
  // Sobel normal map from the height field, wrapping at the edges so it tiles.
  const s = normalStrength * size / 256;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size, xp = (x + 1) % size, ym = (y - 1 + size) % size, yp = (y + 1) % size;
      const tl = H[ym * size + xm], t = H[ym * size + x], tr = H[ym * size + xp];
      const l = H[y * size + xm], r = H[y * size + xp];
      const bl = H[yp * size + xm], b = H[yp * size + x], br = H[yp * size + xp];
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * s, ny = dy * s, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const p = (y * size + x) * 4;
      nimg.data[p] = (nx * 0.5 + 0.5) * 255; nimg.data[p + 1] = (ny * 0.5 + 0.5) * 255; nimg.data[p + 2] = (nz * 0.5 + 0.5) * 255; nimg.data[p + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0); nctx.putImageData(nimg, 0, 0); rctx.putImageData(rimg, 0, 0);
  return { col, nrm, rgh };
}

function set(key, size, fn, normalStrength) {
  if (cache.has(key)) return cache.get(key);
  const c = build(size, fn, normalStrength);
  const out = {
    map: toTexture(c.col, true),
    normalMap: toTexture(c.nrm, false),
    roughnessMap: toTexture(c.rgh, false),
  };
  cache.set(key, out);
  return out;
}

// Returns a clone of a texture set with its own repeat, sharing the GPU image.
export function withRepeat(texSet, rx, ry = rx) {
  const out = {};
  for (const k of Object.keys(texSet)) {
    const t = texSet[k].clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    out[k] = t;
  }
  return out;
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sz = (mul = 1) => Math.max(128, Math.round(getPreset().texSize * mul));

// ---------------------------------------------------------------- wood
export function woodPlanks({ light = 0xb98a5a, dark = 0x7a4e2b, rows = 6, seed = 1 } = {}) {
  const L = hex(light), D = hex(dark);
  return set(`planks${light}${dark}${rows}${seed}`, sz(1), (u, v) => {
    const row = Math.floor(v * rows);
    const rv = (v * rows) - row;
    const offs = hash2(row, 0, seed);
    const pu = (u + offs) % 1;
    const plankLen = 0.5;
    const plank = Math.floor(pu / plankLen);
    const pl = (pu / plankLen) - plank;
    const pid = hash2(row, plank, seed + 3);
    const grain = fbm2(u * 3 + pid * 9, v * rows * 0.35 * 18, { octaves: 4, seed: seed + 11, period: 0 });
    const rings = Math.sin((grain * 7 + v * rows * 3 + pid * 20) * Math.PI) * 0.5 + 0.5;
    let t = clamp(0.35 + grain * 0.5 + rings * 0.25 + (pid - 0.5) * 0.45, 0, 1);
    let c = mix(L, D, t);
    const fine = perlin2(u * 220, v * 30, seed + 5) * 0.06;
    c = c.map((x) => x * (1 + fine));
    const edge = Math.min(rv, 1 - rv, pl * rows * plankLen * 4, (1 - pl) * rows * plankLen * 4);
    const gap = smoothstep(0.0, 0.025, edge);
    c = c.map((x) => x * (0.35 + 0.65 * gap));
    const h = 0.5 + grain * 0.08 + (gap - 1) * 0.5;
    return [c[0], c[1], c[2], h, 0.38 + (1 - gap) * 0.4 + rings * 0.12];
  }, 3);
}

export function wood({ light = 0xa0714a, dark = 0x5c3a20, seed = 2, scale = 1 } = {}) {
  const L = hex(light), D = hex(dark);
  return set(`wood${light}${dark}${seed}${scale}`, sz(0.5), (u, v) => {
    const g = fbm2(u * 2 * scale, v * 16 * scale, { octaves: 4, seed, period: 0 });
    const rings = Math.sin((g * 9 + u * 6) * Math.PI) * 0.5 + 0.5;
    const t = clamp(0.4 + g * 0.6 + rings * 0.3, 0, 1);
    const c = mix(L, D, t);
    return [c[0], c[1], c[2], 0.5 + g * 0.1, 0.45 + rings * 0.15];
  }, 1.5);
}

// ---------------------------------------------------------------- soft stuff
export function carpet({ color = 0x8c8f97, seed = 3 } = {}) {
  const C = hex(color);
  return set(`carpet${color}${seed}`, sz(0.5), (u, v) => {
    const n = fbm2(u * 64, v * 64, { octaves: 3, seed, period: 64 });
    const blotch = fbm2(u * 4, v * 4, { octaves: 3, seed: seed + 9, period: 4 });
    const k = 0.78 + n * 0.45 + blotch * 0.12;
    return [C[0] * k, C[1] * k, C[2] * k, 0.5 + n * 0.5, 0.95];
  }, 5);
}

export function fabric({ color = 0x3b5b8c, color2 = 0x22334f, pattern = 'plain', weave = 96, seed = 4 } = {}) {
  const A = hex(color), B = hex(color2);
  return set(`fabric${color}${color2}${pattern}${weave}${seed}`, sz(1), (u, v) => {
    const wu = Math.sin(u * weave * Math.PI * 2), wv = Math.sin(v * weave * Math.PI * 2);
    const over = (Math.floor(u * weave) + Math.floor(v * weave)) % 2 === 0;
    const thread = over ? wu * 0.5 + 0.5 : wv * 0.5 + 0.5;
    let c = A;
    if (pattern === 'plaid') {
      const bandU = (Math.sin(u * Math.PI * 2 * 4) > 0.55 ? 1 : 0) + (Math.sin(u * Math.PI * 2 * 12) > 0.85 ? 0.6 : 0);
      const bandV = (Math.sin(v * Math.PI * 2 * 4) > 0.55 ? 1 : 0) + (Math.sin(v * Math.PI * 2 * 12) > 0.85 ? 0.6 : 0);
      c = mix(A, B, clamp((bandU + bandV) * 0.45, 0, 1));
      if (bandU > 0.9 && bandV > 0.9) c = mix(c, [235, 230, 220], 0.35);
    } else if (pattern === 'stripe') {
      c = Math.sin(u * Math.PI * 2 * 8) > 0.2 ? A : B;
    } else if (pattern === 'check') {
      c = ((Math.floor(u * 8) + Math.floor(v * 8)) % 2) ? A : B;
    }
    const n = fbm2(u * 8, v * 8, { octaves: 3, seed, period: 8 });
    const fuzz = perlin2(u * weave * 3, v * weave * 3, seed + 7, weave * 3) * 0.5 + 0.5;
    const k = 0.9 + thread * 0.07 + n * 0.08 + fuzz * 0.05;
    return [c[0] * k, c[1] * k, c[2] * k, thread * 0.45 + fuzz * 0.25 + n * 0.3, 0.9];
  }, 1.6);
}

export function plaster({ color = 0xe8e2d6, seed = 5 } = {}) {
  const C = hex(color);
  return set(`plaster${color}${seed}`, sz(0.5), (u, v) => {
    const n = fbm2(u * 16, v * 16, { octaves: 5, seed, period: 16 });
    const fine = perlin2(u * 180, v * 180, seed + 3, 180);
    const k = 0.97 + n * 0.04 + fine * 0.015;
    return [C[0] * k, C[1] * k, C[2] * k, 0.5 + n * 0.05 + fine * 0.12, 0.85];
  }, 0.5);
}

export function tiles({ color = 0xf1f1ee, grout = 0x9a978f, n = 4, seed = 6, variation = 0.06 } = {}) {
  const C = hex(color), G = hex(grout);
  return set(`tiles${color}${grout}${n}${seed}`, sz(1), (u, v) => {
    const tu = u * n, tv = v * n;
    const iu = Math.floor(tu), iv = Math.floor(tv);
    const fu = tu - iu, fv = tv - iv;
    const e = Math.min(fu, 1 - fu, fv, 1 - fv);
    const g = smoothstep(0.015, 0.035, e);
    const tid = hash2(iu, iv, seed);
    const n1 = fbm2(u * 24, v * 24, { octaves: 3, seed, period: 24 });
    let c = C.map((x) => x * (1 - variation / 2 + tid * variation + n1 * 0.03));
    c = mix(G, c, g);
    const bevel = smoothstep(0.02, 0.09, e);
    return [c[0], c[1], c[2], 0.2 + bevel * 0.8, g > 0.5 ? 0.12 + n1 * 0.05 : 0.9];
  }, 4);
}

export function paper({ lines = false, seed = 7 } = {}) {
  return set(`paper${lines}${seed}`, sz(0.5), (u, v) => {
    const n = fbm2(u * 40, v * 40, { octaves: 4, seed, period: 40 });
    const fib = perlin2(u * 180, v * 30, seed + 1, 180) * 0.5;
    let c = [246 + n * 8, 244 + n * 8, 236 + n * 8];
    if (lines) {
      const lv = (v * 22) % 1;
      if (lv < 0.05) c = [150, 180, 225];
      if (Math.abs(u - 0.12) < 0.004) c = [230, 120, 130];
    }
    return [c[0], c[1], c[2], 0.5 + n * 0.3 + fib * 0.2, 0.92];
  }, 1);
}

export function metal({ color = 0xb8bcc2, brushed = true, seed = 8 } = {}) {
  const C = hex(color);
  return set(`metal${color}${brushed}${seed}`, sz(0.5), (u, v) => {
    const n = brushed ? perlin2(u * 4, v * 300, seed, 4) : fbm2(u * 10, v * 10, { seed, period: 10 });
    const k = 0.92 + n * 0.08;
    return [C[0] * k, C[1] * k, C[2] * k, 0.5 + n * 0.1, 0.28 + n * 0.08];
  }, 0.6);
}

export function plastic({ color = 0xdddddd, seed = 9 } = {}) {
  const C = hex(color);
  return set(`plastic${color}${seed}`, 128, (u, v) => {
    const n = fbm2(u * 12, v * 12, { octaves: 3, seed, period: 12 });
    const k = 0.97 + n * 0.04;
    return [C[0] * k, C[1] * k, C[2] * k, 0.5 + n * 0.08, 0.35 + n * 0.1];
  }, 0.5);
}

// ---------------------------------------------------------------- nature
export function soil({ seed = 10 } = {}) {
  return set(`soil${seed}`, sz(1), (u, v) => {
    const n = fbm2(u * 12, v * 12, { octaves: 6, seed, period: 12 });
    const [w1] = worley2(u * 30, v * 30, seed, 30);
    const peb = smoothstep(0.35, 0.1, w1);
    let c = mix([74, 56, 40], [112, 88, 62], n * 0.5 + 0.5);
    c = mix(c, [140, 130, 115], peb * 0.6);
    return [c[0], c[1], c[2], n * 0.4 + peb * 0.6, 0.95 - peb * 0.2];
  }, 4);
}

export function lawn({ seed = 11 } = {}) {
  return set(`lawn${seed}`, sz(1), (u, v) => {
    const n = fbm2(u * 20, v * 20, { octaves: 5, seed, period: 20 });
    const d = fbm2(u * 4, v * 4, { octaves: 3, seed: seed + 3, period: 4 });
    const blades = perlin2(u * 200, v * 60, seed + 5, 200) * 0.5 + 0.5;
    let c = mix([46, 78, 26], [96, 126, 44], n * 0.5 + 0.5 + blades * 0.2);
    c = mix(c, [110, 92, 60], smoothstep(0.15, 0.45, d) * 0.55);
    return [c[0], c[1], c[2], blades * 0.6 + n * 0.4, 0.9];
  }, 3);
}

export function rock({ color = 0x8a857c, seed = 12 } = {}) {
  const C = hex(color);
  return set(`rock${color}${seed}`, sz(0.5), (u, v) => {
    const n = fbm2(u * 6, v * 6, { octaves: 6, seed, period: 6 });
    const [a, b] = worley2(u * 10, v * 10, seed, 10);
    const crack = smoothstep(0.0, 0.06, b - a);
    const speck = hash2(Math.floor(u * 300), Math.floor(v * 300), seed) > 0.97 ? 0.25 : 0;
    const k = 0.75 + n * 0.35 + speck;
    const c = C.map((x) => x * k * (0.7 + 0.3 * crack));
    return [c[0], c[1], c[2], n * 0.7 + crack * 0.3, 0.8];
  }, 5);
}

export function bark({ seed = 13 } = {}) {
  return set(`bark${seed}`, sz(0.5), (u, v) => {
    const [a, b] = worley2(u * 8, v * 2, seed, 8);
    const ridge = smoothstep(0.0, 0.25, b - a);
    const n = fbm2(u * 8, v * 30, { octaves: 4, seed, period: 8 });
    const c = mix([46, 34, 24], [104, 84, 62], ridge * 0.7 + n * 0.3);
    return [c[0], c[1], c[2], ridge * 0.8 + n * 0.2, 0.95];
  }, 6);
}

export function asphalt({ seed = 14 } = {}) {
  return set(`asphalt${seed}`, sz(1), (u, v) => {
    const n = fbm2(u * 30, v * 30, { octaves: 4, seed, period: 30 });
    const g = hash2(Math.floor(u * 600), Math.floor(v * 600), seed);
    const agg = g > 0.93 ? 0.35 : g > 0.8 ? 0.15 : 0;
    const k = 58 + n * 16 + agg * 90;
    return [k, k, k * 1.02, 0.4 + agg + n * 0.2, 0.85 - agg * 0.2];
  }, 4);
}

export function concrete({ seed = 15, color = 0xa7a39a } = {}) {
  const C = hex(color);
  return set(`concrete${seed}${color}`, sz(0.5), (u, v) => {
    const n = fbm2(u * 10, v * 10, { octaves: 6, seed, period: 10 });
    const pit = hash2(Math.floor(u * 400), Math.floor(v * 400), seed) > 0.985 ? -0.3 : 0;
    const k = 0.85 + n * 0.2 + pit;
    return [C[0] * k, C[1] * k, C[2] * k, 0.5 + n * 0.3 + pit, 0.9];
  }, 2);
}

export function brick({ seed = 16 } = {}) {
  return set(`brick${seed}`, sz(1), (u, v) => {
    const rows = 16, cols = 6;
    const r = Math.floor(v * rows);
    const off = (r % 2) * 0.5;
    const cu = u * cols + off;
    const c0 = Math.floor(cu);
    const fu = cu - c0, fv = v * rows - r;
    const e = Math.min(fu * 2.2, (1 - fu) * 2.2, fv, 1 - fv);
    const m = smoothstep(0.04, 0.09, e);
    const id = hash2(c0, r, seed);
    const n = fbm2(u * 20, v * 20, { octaves: 3, seed, period: 20 });
    let c = mix([150, 64, 44], [110, 46, 34], id * 0.8 + n * 0.3);
    c = mix([180, 174, 162], c, m);
    return [c[0], c[1], c[2], m * 0.8 + n * 0.2, 0.92];
  }, 3);
}

export function siding({ color = 0xdfe4e6, seed = 17 } = {}) {
  const C = hex(color);
  return set(`siding${color}${seed}`, sz(0.5), (u, v) => {
    const rows = 14, fv = (v * rows) % 1;
    const n = fbm2(u * 6, v * 30, { octaves: 3, seed, period: 6 });
    const k = 0.8 + fv * 0.2 + n * 0.05;
    return [C[0] * k, C[1] * k, C[2] * k, fv, 0.7];
  }, 3);
}

export function shingles({ seed = 18 } = {}) {
  return set(`shingles${seed}`, sz(0.5), (u, v) => {
    const rows = 12;
    const r = Math.floor(v * rows);
    const fu = u * 8 + (r % 2) * 0.5;
    const iu = Math.floor(fu);
    const id = hash2(iu, r, seed);
    const fv = v * rows - r;
    const e = Math.min(fu - iu, 1 - (fu - iu));
    const g = smoothstep(0.0, 0.05, e);
    const n = fbm2(u * 40, v * 40, { octaves: 3, seed, period: 40 });
    const k = (40 + id * 25 + n * 10) * (0.6 + 0.4 * g) * (0.7 + 0.3 * fv);
    return [k * 1.05, k, k * 0.98, fv * 0.6 + g * 0.4, 0.9];
  }, 4);
}

export function fur({ color = 0xd9a15a, dark = 0xa66a2e, seed = 19 } = {}) {
  const A = hex(color), B = hex(dark);
  return set(`fur${color}${dark}${seed}`, sz(0.5), (u, v) => {
    const s = perlin2(u * 6, v * 60, seed, 6) * 0.5 + perlin2(u * 12, v * 160, seed + 1, 12) * 0.5;
    const n = fbm2(u * 4, v * 4, { octaves: 3, seed: seed + 5, period: 4 });
    const c = mix(A, B, clamp(0.4 + s * 0.6 + n * 0.3, 0, 1));
    return [c[0], c[1], c[2], s * 0.5 + 0.5, 0.8];
  }, 3);
}

export function skin({ color = 0xe0ac8a, seed = 20 } = {}) {
  const C = hex(color);
  return set(`skin${color}${seed}`, 256, (u, v) => {
    const n = fbm2(u * 30, v * 30, { octaves: 4, seed, period: 30 });
    const k = 0.96 + n * 0.06;
    return [C[0] * k, C[1] * k * 0.99, C[2] * k * 0.98, 0.5 + n * 0.2, 0.55];
  }, 0.8);
}

export function chitin({ color = 0x2a1a12, seed = 21 } = {}) {
  const C = hex(color);
  return set(`chitin${color}${seed}`, 256, (u, v) => {
    const [a, b] = worley2(u * 14, v * 14, seed, 14);
    const cell = smoothstep(0.0, 0.08, b - a);
    const n = fbm2(u * 10, v * 10, { octaves: 3, seed, period: 10 });
    const k = 0.8 + cell * 0.25 + n * 0.1;
    return [C[0] * k, C[1] * k, C[2] * k, cell * 0.5 + n * 0.3, 0.3 + (1 - cell) * 0.3];
  }, 2);
}

// ---------------------------------------------------------------- alpha cutouts (drawn, not per-pixel)
export function leafTexture({ color = '#3f7a2c', seed = 22 } = {}) {
  const key = `leaf${color}${seed}`;
  if (cache.has(key)) return cache.get(key);
  const S = 256;
  const c = canvas(S), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.translate(S / 2, S);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(S * 0.55, -S * 0.25, S * 0.4, -S * 0.8, 0, -S * 0.98);
  ctx.bezierCurveTo(-S * 0.4, -S * 0.8, -S * 0.55, -S * 0.25, 0, 0);
  const g = ctx.createLinearGradient(-S / 2, 0, S / 2, 0);
  g.addColorStop(0, shade(color, -0.25)); g.addColorStop(0.5, color); g.addColorStop(1, shade(color, -0.15));
  ctx.fillStyle = g; ctx.fill();
  ctx.clip();
  // veins
  ctx.strokeStyle = shade(color, 0.3); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -S * 0.95); ctx.stroke();
  ctx.lineWidth = 1.3;
  for (let i = 1; i < 9; i++) {
    const y = -S * 0.1 * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(S * 0.15, y - S * 0.08, S * 0.35, y - S * 0.18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(-S * 0.15, y - S * 0.08, -S * 0.35, y - S * 0.18); ctx.stroke();
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`;
    ctx.fillRect((rnd() - 0.5) * S, -rnd() * S, 2 + rnd() * 4, 2 + rnd() * 4);
  }
  ctx.restore();
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

export function grassBladeTexture() {
  const key = 'grassblade';
  if (cache.has(key)) return cache.get(key);
  const W = 64, H = 256;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, '#23380f'); g.addColorStop(0.35, '#4d7a22'); g.addColorStop(0.85, '#7fa83a'); g.addColorStop(1, '#a9b85a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * W / 9;
    ctx.strokeStyle = `rgba(${i % 2 ? '20,40,5' : '160,200,90'},0.25)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(W / 2 + (x - W / 2) * 0.1, 0); ctx.stroke();
  }
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

// Soft round sprite for particles / dust motes / glows.
export function softDot(color = '#ffffff', key = 'dot') {
  const k = `dot${color}${key}`;
  if (cache.has(k)) return cache.get(k);
  const S = 64, c = canvas(S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, color); g.addColorStop(0.4, color.startsWith('#') ? hexA(color, 0.5) : color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, t);
  return t;
}

// Arbitrary canvas-drawn texture (posters, screens, labels).
export function drawn(key, w, h, draw, srgb = true) {
  if (key && cache.has(key)) return cache.get(key);
  const c = canvas(w, h);
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (key) cache.set(key, t);
  return t;
}

export function shade(hexStr, amt) {
  const n = parseInt(hexStr.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function hexA(hexStr, a) {
  const n = parseInt(hexStr.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Convenience: a MeshStandardMaterial / MeshPhysicalMaterial from a texture set.
export function pbr(texSet, extra = {}, physical = false) {
  const M = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new M({ ...texSet, ...extra });
  if (texSet.normalMap && !extra.normalScale) m.normalScale = new THREE.Vector2(1, 1);
  return m;
}
