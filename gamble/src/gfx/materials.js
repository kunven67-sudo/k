// Material library: `mat(kind, opts)` returns a cached, fully textured PBR material.
// Kinds are realistic, worn and dirty by default (ARCHITECTURE §0). Options:
//   color  – base tint (hex) for kinds that take one (fabric, metal-painted, stucco, neon…)
//   wear   – 0..1 edge wear / chipping / scuffs (default per kind)
//   dirt   – 0..1 grime amount (default per kind)
//   seed   – variation seed (same kind + different seed = different-looking copy)
// Every material has `userData.tileMeters`: how many world meters one texture tile covers.
// Use `worldUV(geometry, tileMeters)` (gfx/geom.js) so textures keep real-world scale.
//
// Add new kinds with registerKind(name, { tileMeters, size, build(u, v, out, ctx), material(opts) }).

import * as THREE from 'three';
import { bakePBR, textureSize, hexToRgb, mix3 } from './textures.js';
import { TileNoise, hash2 } from './noise.js';
import { clamp, smoothstep, lerp } from '../core/util.js';

const kinds = new Map();
const matCache = new Map();
const noises = new Map();

function noise(seed) {
  let n = noises.get(seed);
  if (!n) {
    n = new TileNoise(seed);
    noises.set(seed, n);
  }
  return n;
}

export function registerKind(name, def) {
  kinds.set(name, def);
}

export function mat(kind, opts = {}) {
  const def = kinds.get(kind);
  if (!def) throw new Error(`Unknown material kind "${kind}"`);
  const o = { ...def.defaults, ...opts };
  const key = `${kind}|${JSON.stringify(o)}`;
  let m = matCache.get(key);
  if (m) return m;
  const seed = o.seed ?? 1;
  const ctx = { o, N: noise(seed + 17 * hashKind(kind)), seed, color: o.color != null ? hexToRgb(o.color) : null };
  let maps = null;
  if (def.build) {
    const size = textureSize(def.size ?? 512);
    maps = bakePBR(`${key}|${size}`, size, (u, v, out) => def.build(u, v, out, ctx), { normalStrength: def.normalStrength ?? 2 });
  }
  m = def.material ? def.material(o, maps, ctx) : standard(maps, def);
  m.name = kind;
  m.userData.tileMeters = o.tileMeters ?? def.tileMeters ?? 1;
  m.userData.kind = kind;
  matCache.set(key, m);
  return m;
}

function hashKind(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000;
}

function standard(maps, def, extra = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: maps?.map ?? null,
    normalMap: maps?.normalMap ?? null,
    roughnessMap: maps?.ormMap ?? null,
    metalnessMap: maps?.ormMap ?? null,
    aoMap: maps?.ormMap ?? null,
    aoMapIntensity: def.aoIntensity ?? 1,
    roughness: 1,
    metalness: 1,
    ...extra,
  });
  if (maps?.normalMap) m.normalScale.set(def.normalScale ?? 1, def.normalScale ?? 1);
  return m;
}

function physical(maps, def, extra = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    map: maps?.map ?? null,
    normalMap: maps?.normalMap ?? null,
    roughnessMap: maps?.ormMap ?? null,
    metalnessMap: maps?.ormMap ?? null,
    aoMap: maps?.ormMap ?? null,
    roughness: 1,
    metalness: 1,
    ...extra,
  });
  if (maps?.normalMap) m.normalScale.set(def.normalScale ?? 1, def.normalScale ?? 1);
  return m;
}

const setRGB = (out, c) => {
  out.r = c[0];
  out.g = c[1];
  out.b = c[2];
};

// Grime shared by most kinds: low-frequency blotches + fine speckle.
function grime(N, u, v, amount) {
  if (amount <= 0) return 0;
  const big = N.fbm(u, v, { freq: 2, octaves: 4 }) * 0.5 + 0.5;
  const fine = N.fbm(u + 0.37, v + 0.11, { freq: 16, octaves: 3 }) * 0.5 + 0.5;
  return clamp(smoothstep(0.45, 0.9, big) * 0.8 + smoothstep(0.62, 0.95, fine) * 0.35, 0, 1) * amount;
}

// ---- Ground & street ------------------------------------------------------------------------

registerKind('asphalt', {
  tileMeters: 4,
  defaults: { wear: 0.6, dirt: 0.5 },
  normalStrength: 3,
  build(u, v, out, { N, o }) {
    const base = 0.13 + N.fbm(u, v, { freq: 3, octaves: 4 }) * 0.025;
    const aggN = N.perlin(u * 180, v * 180, 180);
    const agg = smoothstep(0.35, 0.6, aggN);
    const tarPatch = smoothstep(0.55, 0.62, N.fbm(u + 0.5, v, { freq: 2, octaves: 3 }) * 0.5 + 0.5) * o.wear;
    const crackN = N.ridged(u + 0.21, v + 0.7, { freq: 3, octaves: 5, gain: 0.55 });
    const crack = smoothstep(0.965, 0.995, crackN) * o.wear;
    const oil = smoothstep(0.6, 0.85, N.fbm(u + 0.9, v + 0.3, { freq: 2, octaves: 4 }) * 0.5 + 0.5) * o.dirt;
    let c = base + agg * 0.07 - oil * 0.06 - crack * 0.08;
    c = lerp(c, 0.075, tarPatch * 0.85);
    const warm = 0.006 * N.perlin(u * 40, v * 40, 40);
    setRGB(out, [c + warm, c + warm * 0.5, c - warm * 0.2]);
    out.h = 0.5 + agg * 0.25 - crack * 0.6 - tarPatch * 0.05;
    out.rough = clamp(0.92 - agg * 0.12 - oil * 0.25 - tarPatch * 0.2, 0.4, 1);
    out.ao = 1 - crack * 0.6;
  },
});

registerKind('sidewalk', {
  tileMeters: 3,
  defaults: { wear: 0.5, dirt: 0.55 },
  build(u, v, out, { N, o }) {
    // Two slabs per tile in each direction with recessed joints.
    const su = (u * 2) % 1;
    const sv = (v * 2) % 1;
    const edge = Math.min(su, 1 - su, sv, 1 - sv);
    const joint = 1 - smoothstep(0.004, 0.012, edge);
    const slabId = hash2(Math.floor(u * 2), Math.floor(v * 2), 3);
    let c = 0.58 + (slabId - 0.5) * 0.06 + N.fbm(u, v, { freq: 6, octaves: 5 }) * 0.04;
    const pores = smoothstep(0.55, 0.75, N.perlin(u * 260, v * 260, 260) * 0.5 + 0.5);
    c -= pores * 0.05;
    const g = grime(N, u, v, o.dirt);
    c -= g * 0.18;
    // Old gum spots: dark round blobs.
    const w = N.worley(u, v, 24);
    const gum = (hash2(w.id, 9, 1) < 0.08 * o.dirt ? 1 : 0) * (1 - smoothstep(0.05, 0.09, w.f1));
    c = lerp(c, 0.22, gum * 0.8);
    const crack = smoothstep(0.975, 0.995, N.ridged(u + 0.4, v, { freq: 4, octaves: 5 })) * o.wear;
    c -= crack * 0.15 + joint * 0.18;
    setRGB(out, [c * 1.02, c, c * 0.96]);
    out.h = 0.5 - joint * 0.5 - crack * 0.4 + pores * -0.08 + gum * 0.1;
    out.rough = clamp(0.86 - gum * 0.4 + joint * 0.1, 0.3, 1);
    out.ao = 1 - joint * 0.5 - crack * 0.4;
  },
});

registerKind('concrete', {
  tileMeters: 3,
  defaults: { wear: 0.4, dirt: 0.4, color: null },
  build(u, v, out, { N, o, color }) {
    let c = 0.55 + N.fbm(u, v, { freq: 4, octaves: 6 }) * 0.06;
    const pores = smoothstep(0.6, 0.8, N.perlin(u * 300, v * 300, 300) * 0.5 + 0.5);
    c -= pores * 0.07 + grime(N, u, v, o.dirt) * 0.2;
    const tint = color ?? [1, 0.98, 0.94];
    setRGB(out, [c * tint[0] * 1.0, c * tint[1], c * tint[2]]);
    out.h = 0.5 - pores * 0.12;
    out.rough = 0.88;
  },
});

registerKind('curb', {
  tileMeters: 2,
  defaults: { wear: 0.6, dirt: 0.6, color: null },
  build(u, v, out, { N, o, color }) {
    let c = 0.6 + N.fbm(u, v, { freq: 6, octaves: 5 }) * 0.05;
    c -= grime(N, u, v, o.dirt) * 0.25;
    let col = [c, c * 0.99, c * 0.96];
    if (color) {
      // Painted curb (red zone / yellow): paint chipped by wear.
      const chip = smoothstep(0.7, 0.74, N.fbm(u + 3, v, { freq: 8, octaves: 4 }) * 0.5 + 0.5 + (o.wear - 0.5) * 0.12);
      col = mix3(color.map((x) => x * (0.85 + N.perlin(u * 30, v * 30, 30) * 0.1)), col, chip);
    }
    setRGB(out, col);
    out.h = 0.5 + N.perlin(u * 120, v * 120, 120) * 0.06;
    out.rough = 0.85;
  },
});

registerKind('dirt', {
  tileMeters: 3,
  defaults: { wear: 0.5, dirt: 0.5 },
  build(u, v, out, { N }) {
    const n = N.fbm(u, v, { freq: 4, octaves: 6 }) * 0.5 + 0.5;
    const pebbles = smoothstep(0.7, 0.8, N.worley(u, v, 40).f1 < 0.18 ? 1 : 0);
    const c = mix3([0.42, 0.34, 0.25], [0.55, 0.47, 0.36], n);
    setRGB(out, mix3(c, [0.5, 0.48, 0.44], pebbles * 0.6));
    out.h = n * 0.6 + pebbles * 0.3;
    out.rough = 0.95;
  },
});

registerKind('gravel', {
  tileMeters: 1.5,
  defaults: {},
  normalStrength: 4,
  build(u, v, out, { N }) {
    const w = N.worley(u, v, 48);
    const stone = 1 - smoothstep(0.25, 0.48, w.f1);
    const tone = 0.35 + hash2(w.id, 2, 5) * 0.35;
    setRGB(out, [tone * stone + 0.12 * (1 - stone), tone * 0.97 * stone + 0.1 * (1 - stone), tone * 0.92 * stone + 0.08 * (1 - stone)]);
    out.h = stone * 0.8;
    out.rough = 0.9 - stone * 0.15;
    out.ao = 0.55 + stone * 0.45;
  },
});

registerKind('grass', {
  tileMeters: 2,
  defaults: { dry: 0.4 },
  build(u, v, out, { N, o }) {
    const blades = N.perlin(u * 220, v * 60, 220) * 0.5 + 0.5;
    const patch = N.fbm(u, v, { freq: 3, octaves: 4 }) * 0.5 + 0.5;
    const dry = clamp(o.dry + (patch - 0.5) * 0.6, 0, 1);
    const c = mix3([0.18, 0.32, 0.1], [0.52, 0.47, 0.26], dry);
    setRGB(out, c.map((x) => x * (0.75 + blades * 0.45)));
    out.h = blades;
    out.rough = 0.95;
  },
});

// ---- Walls & building skins -----------------------------------------------------------------

registerKind('stucco', {
  tileMeters: 2.5,
  defaults: { color: 0xd9c8a9, wear: 0.4, dirt: 0.5 },
  normalStrength: 3,
  build(u, v, out, { N, o, color }) {
    const bump = N.fbm(u, v, { freq: 24, octaves: 4 }) * 0.5 + 0.5;
    const blotch = N.fbm(u, v, { freq: 3, octaves: 4 }) * 0.5 + 0.5;
    // Rain/dirt streaks run down (v), stronger at the bottom of each tile.
    const streak = (N.perlin(u * 40, 0.5, 40) * 0.5 + 0.5) * smoothstep(0.3, 1.0, 1 - v) * o.dirt;
    let c = color.map((x) => x * (0.9 + bump * 0.14 + (blotch - 0.5) * 0.08));
    c = mix3(c, [0.32, 0.28, 0.22], clamp(streak * 0.35 + grime(N, u, v, o.dirt) * 0.25, 0, 0.6));
    // Hairline cracks.
    const crack = smoothstep(0.982, 0.997, N.ridged(u, v + 0.3, { freq: 3, octaves: 5 })) * o.wear;
    c = c.map((x) => x * (1 - crack * 0.35));
    setRGB(out, c);
    out.h = bump * 0.7 - crack * 0.4;
    out.rough = 0.92;
    out.ao = 1 - crack * 0.4;
  },
});

registerKind('brick', {
  tileMeters: 1.6,
  defaults: { color: 0x8c3b2a, wear: 0.4, dirt: 0.45 },
  normalStrength: 3,
  build(u, v, out, { N, o, color }) {
    const rows = 20;
    const cols = 8;
    const row = Math.floor(v * rows);
    const ru = (u * cols + (row % 2) * 0.5) % cols;
    const col = Math.floor(ru);
    const fu = ru - col;
    const fv = v * rows - row;
    const mortarW = 0.06;
    const edge = Math.min(fu, 1 - fu) * 2.6 / cols * rows, ev = Math.min(fv, 1 - fv);
    const m = 1 - smoothstep(mortarW * 0.6, mortarW, Math.min(edge * 0.33, ev));
    const id = hash2(col, row, 11);
    const chip = smoothstep(0.7, 0.9, N.fbm(u * 2, v * 2, { freq: 8, octaves: 3 }) * 0.5 + 0.5) * o.wear;
    let c = color.map((x) => x * (0.75 + id * 0.45 + N.perlin(u * 90, v * 90, 90) * 0.06));
    c = mix3(c, [0.62, 0.6, 0.55], m);
    c = mix3(c, [0.25, 0.22, 0.2], grime(N, u, v, o.dirt) * 0.4);
    setRGB(out, c);
    out.h = (1 - m) * (0.8 - chip * 0.3) + N.perlin(u * 150, v * 150, 150) * 0.04;
    out.rough = 0.88 + m * 0.08;
    out.ao = 1 - m * 0.35;
  },
});

registerKind('painted-wood', {
  tileMeters: 2,
  defaults: { color: 0x6f8f86, wear: 0.5, dirt: 0.4 },
  build(u, v, out, { N, o, color }) {
    const plank = Math.floor(u * 8);
    const pu = u * 8 - plank;
    const gap = 1 - smoothstep(0.0, 0.03, Math.min(pu, 1 - pu));
    const grain = N.perlin(u * 30 + hash2(plank, 1, 3) * 7, v * 3, 30) * 0.5 + 0.5;
    const wood = mix3([0.45, 0.32, 0.2], [0.6, 0.45, 0.3], grain);
    const chipN = N.fbm(u, v, { freq: 10, octaves: 5 }) * 0.5 + 0.5;
    const chip = smoothstep(0.74 - o.wear * 0.1, 0.76 - o.wear * 0.1, chipN);
    let c = mix3(color.map((x) => x * (0.92 + grain * 0.1)), wood, chip);
    c = mix3(c, [0.2, 0.18, 0.15], gap * 0.8 + grime(N, u, v, o.dirt) * 0.2);
    setRGB(out, c);
    out.h = 0.6 - gap * 0.6 - chip * 0.12 + grain * 0.05;
    out.rough = lerp(0.55, 0.85, chip);
  },
});

registerKind('wallpaper', {
  tileMeters: 1.2,
  defaults: { color: 0xb9a37e, color2: 0x8f7752, pattern: 'damask', wear: 0.4, dirt: 0.5 },
  build(u, v, out, { N, o, color }) {
    const c2 = hexToRgb(o.color2);
    let p = 0;
    if (o.pattern === 'stripe') p = smoothstep(0.45, 0.5, Math.abs(((u * 10) % 1) - 0.5) * 2) ;
    else {
      // Damask-ish: mirrored lobes in a diamond lattice.
      const gx = (u * 4) % 1 - 0.5;
      const gy = (v * 3) % 1 - 0.5;
      const r = Math.hypot(gx * 1.3, gy);
      const a = Math.atan2(gy, Math.abs(gx));
      p = smoothstep(0.02, 0.0, Math.abs(r - 0.22 - 0.07 * Math.cos(a * 4))) + smoothstep(0.08, 0.05, Math.hypot(gx, gy + 0.18));
    }
    const fade = N.fbm(u, v, { freq: 2, octaves: 4 }) * 0.5 + 0.5;
    let c = mix3(color, c2, clamp(p, 0, 1) * 0.8);
    c = c.map((x) => x * (0.86 + fade * 0.16));
    // Water stain rings.
    const stain = smoothstep(0.78, 0.8, fade) * o.dirt;
    c = mix3(c, [0.55, 0.43, 0.27], stain * 0.5 + grime(N, u, v, o.dirt) * 0.2);
    setRGB(out, c);
    out.h = 0.5 + p * 0.06;
    out.rough = 0.8;
  },
});

registerKind('drywall', {
  tileMeters: 2.5,
  defaults: { color: 0xe6dfd2, wear: 0.4, dirt: 0.45 },
  build(u, v, out, { N, o, color }) {
    const orange = N.perlin(u * 140, v * 140, 140) * 0.5 + 0.5; // orange-peel texture
    let c = color.map((x) => x * (0.94 + orange * 0.06));
    const scuff = smoothstep(0.7, 0.85, N.fbm(u + 1, v, { freq: 6, octaves: 5 }) * 0.5 + 0.5) * smoothstep(0.7, 1, 1 - v) * o.wear;
    c = mix3(c, [0.35, 0.33, 0.3], scuff * 0.4 + grime(N, u, v, o.dirt) * 0.18);
    setRGB(out, c);
    out.h = orange * 0.3;
    out.rough = 0.88;
  },
});

registerKind('tile-bathroom', {
  tileMeters: 0.6,
  defaults: { color: 0xe9e4d8, wear: 0.4, dirt: 0.5, count: 6 },
  normalStrength: 2.5,
  build(u, v, out, { N, o, color }) {
    const n = o.count;
    const tu = (u * n) % 1;
    const tv = (v * n) % 1;
    const e = Math.min(tu, 1 - tu, tv, 1 - tv);
    const grout = 1 - smoothstep(0.03, 0.055, e);
    const id = hash2(Math.floor(u * n), Math.floor(v * n), 5);
    let c = color.map((x) => x * (0.95 + id * 0.06));
    const groutCol = mix3([0.78, 0.76, 0.7], [0.32, 0.29, 0.24], clamp(o.dirt + (N.fbm(u, v, { freq: 6, octaves: 3 }) * 0.3), 0, 1));
    c = mix3(c, groutCol, grout);
    const mildew = smoothstep(0.7, 0.9, N.fbm(u, v + 0.5, { freq: 4, octaves: 4 }) * 0.5 + 0.5) * o.dirt * grout;
    c = mix3(c, [0.15, 0.17, 0.12], mildew * 0.6);
    setRGB(out, c);
    out.h = (1 - grout) * 0.7 + smoothstep(0.03, 0.12, e) * 0.2;
    out.rough = lerp(0.12 + id * 0.08, 0.85, grout);
    out.ao = 1 - grout * 0.3;
  },
});

registerKind('linoleum', {
  tileMeters: 0.6,
  defaults: { color: 0xcfc6b0, color2: 0x8c8471, wear: 0.6, dirt: 0.5 },
  build(u, v, out, { N, o, color }) {
    const check = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
    let c = check ? color : hexToRgb(o.color2);
    const speck = N.perlin(u * 200, v * 200, 200) * 0.5 + 0.5;
    c = c.map((x) => x * (0.92 + speck * 0.1));
    const scuff = smoothstep(0.75, 0.9, N.fbm(u, v, { freq: 5, octaves: 5 }) * 0.5 + 0.5) * o.wear;
    c = mix3(c, [0.3, 0.28, 0.25], scuff * 0.35 + grime(N, u, v, o.dirt) * 0.2);
    setRGB(out, c);
    out.h = 0.5;
    out.rough = 0.35 + scuff * 0.4;
  },
});

registerKind('wood-floor', {
  tileMeters: 2,
  defaults: { color: 0x8a5a34, wear: 0.5, dirt: 0.3 },
  build(u, v, out, { N, o, color }) {
    const plank = Math.floor(v * 10);
    const pv = v * 10 - plank;
    const offset = hash2(plank, 7, 1);
    const len = (u + offset) % 0.5;
    const seam = 1 - smoothstep(0.0, 0.025, Math.min(pv, 1 - pv));
    const endSeam = 1 - smoothstep(0, 0.006, Math.min(len, 0.5 - len));
    const grain = N.perlin(u * 6 + offset * 9, v * 120, 120) * 0.5 + 0.5;
    const ring = Math.sin((grain * 12 + N.perlin(u * 3, v * 40, 40) * 4) * Math.PI) * 0.5 + 0.5;
    let c = color.map((x) => x * (0.8 + hash2(plank, 3, 9) * 0.35 + ring * 0.12));
    const scuff = smoothstep(0.7, 0.85, N.fbm(u, v, { freq: 6, octaves: 5 }) * 0.5 + 0.5) * o.wear;
    c = mix3(c, [0.62, 0.55, 0.45], scuff * 0.25);
    c = mix3(c, [0.12, 0.08, 0.05], Math.max(seam, endSeam) * 0.8);
    setRGB(out, c);
    out.h = 0.6 - Math.max(seam, endSeam) * 0.6 + ring * 0.05;
    out.rough = 0.35 + scuff * 0.35 + Math.max(seam, endSeam) * 0.3;
  },
});

// ---- Soft goods -----------------------------------------------------------------------------

registerKind('carpet-casino', {
  tileMeters: 2.4,
  size: 1024,
  defaults: { color: 0x5e0f1a, color2: 0xc79a3b, color3: 0x0f5a5e, dirt: 0.35 },
  normalStrength: 1.5,
  build(u, v, out, { N, o, color }) {
    const gold = hexToRgb(o.color2);
    const teal = hexToRgb(o.color3);
    // Ornate repeating medallions + swirling vines — classic casino carpet.
    const cu = (u * 3) % 1 - 0.5;
    const cv = (v * 3) % 1 - 0.5;
    const r = Math.hypot(cu, cv);
    const a = Math.atan2(cv, cu);
    const petals = Math.cos(a * 8) * 0.04;
    const ring1 = smoothstep(0.015, 0.0, Math.abs(r - 0.2 - petals));
    const ring2 = smoothstep(0.01, 0.0, Math.abs(r - 0.32 + petals * 0.6));
    const star = smoothstep(0.12 + Math.cos(a * 4) * 0.05, 0.1 + Math.cos(a * 4) * 0.05, r);
    const du = (u * 3 + 0.5) % 1 - 0.5;
    const dv = (v * 3 + 0.5) % 1 - 0.5;
    const diamond = smoothstep(0.02, 0.0, Math.abs(Math.abs(du) + Math.abs(dv) - 0.18));
    const vineN = N.perlin(u * 9, v * 9, 9);
    const vine = smoothstep(0.035, 0.0, Math.abs(vineN)) * (1 - smoothstep(0.25, 0.3, r));
    let c = color.map((x) => x * (0.9 + (N.fbm(u, v, { freq: 8, octaves: 3 }) * 0.5 + 0.5) * 0.15));
    c = mix3(c, teal, clamp(star * 0.9 + diamond * 0.8, 0, 1));
    c = mix3(c, gold, clamp(ring1 + ring2 + vine * 0.85, 0, 1));
    const fibers = N.perlin(u * 600, v * 600, 600) * 0.5 + 0.5;
    c = c.map((x) => x * (0.82 + fibers * 0.24));
    // Traffic wear + spilled-drink stains.
    const stain = smoothstep(0.74, 0.78, N.fbm(u + 0.33, v, { freq: 3, octaves: 4 }) * 0.5 + 0.5) * o.dirt;
    c = mix3(c, [0.18, 0.1, 0.06], stain * 0.45 + grime(N, u, v, o.dirt) * 0.15);
    setRGB(out, c);
    out.h = fibers * 0.5;
    out.rough = 0.97;
  },
});

registerKind('carpet-motel', {
  tileMeters: 1.5,
  defaults: { color: 0x5d5348, color2: 0x3e5a5c, dirt: 0.75, wear: 0.7 },
  build(u, v, out, { N, o, color }) {
    const c2 = hexToRgb(o.color2);
    const pattern = smoothstep(0.42, 0.5, Math.abs(Math.sin(u * Math.PI * 12) * Math.sin(v * Math.PI * 12)));
    const fibers = N.perlin(u * 400, v * 400, 400) * 0.5 + 0.5;
    let c = mix3(color, c2, pattern * 0.35).map((x) => x * (0.8 + fibers * 0.3));
    const wearPath = smoothstep(0.55, 0.8, N.fbm(u, v, { freq: 2, octaves: 3 }) * 0.5 + 0.5) * o.wear;
    c = mix3(c, [0.55, 0.5, 0.42], wearPath * 0.25);
    const w = N.worley(u + 0.2, v, 6);
    const stain = (hash2(w.id, 4, 2) < 0.35 * o.dirt ? 1 : 0) * (1 - smoothstep(0.25, 0.42, w.f1 + N.perlin(u * 30, v * 30, 30) * 0.08));
    c = mix3(c, [0.24, 0.17, 0.1], stain * 0.55 + grime(N, u, v, o.dirt) * 0.2);
    setRGB(out, c);
    out.h = fibers * 0.5 - wearPath * 0.1;
    out.rough = 0.98;
  },
});

registerKind('felt', {
  tileMeters: 1,
  defaults: { color: 0x0f5a3a, dirt: 0.15, wear: 0.2 },
  normalStrength: 1,
  build(u, v, out, { N, o, color }) {
    const fib = N.perlin(u * 500, v * 500, 500) * 0.5 + 0.5;
    const mot = N.fbm(u, v, { freq: 6, octaves: 4 }) * 0.5 + 0.5;
    let c = color.map((x) => x * (0.86 + fib * 0.12 + (mot - 0.5) * 0.08));
    const wear = smoothstep(0.65, 0.85, mot) * o.wear;
    c = c.map((x) => x * (1 + wear * 0.25));
    c = mix3(c, [0.1, 0.08, 0.05], grime(N, u, v, o.dirt) * 0.3);
    setRGB(out, c);
    out.h = fib * 0.3;
    out.rough = 0.95;
  },
  material(o, maps, ctx) {
    return physical(maps, this, { sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color().setRGB(...ctx.color.map((x) => Math.min(1, x * 1.6)), THREE.SRGBColorSpace) });
  },
});

registerKind('fabric', {
  tileMeters: 0.4,
  defaults: { color: 0x3a4a6b, dirt: 0.3, wear: 0.3, weave: 'plain' },
  build(u, v, out, { N, o, color }) {
    const n = 64;
    const wu = Math.sin(u * n * Math.PI * 2) * 0.5 + 0.5;
    const wv = Math.sin(v * n * Math.PI * 2) * 0.5 + 0.5;
    const over = (Math.floor(u * n) + Math.floor(v * n)) % 2;
    const weave = over ? wu : wv;
    const fuzz = N.perlin(u * 300, v * 300, 300) * 0.5 + 0.5;
    let c = color.map((x) => x * (0.82 + weave * 0.14 + fuzz * 0.08));
    const pill = smoothstep(0.75, 0.9, N.fbm(u, v, { freq: 8, octaves: 4 }) * 0.5 + 0.5) * o.wear;
    c = c.map((x) => x * (1 + pill * 0.15));
    c = mix3(c, [0.2, 0.17, 0.13], grime(N, u, v, o.dirt) * 0.35);
    setRGB(out, c);
    out.h = weave * 0.5 + fuzz * 0.15;
    out.rough = 0.92;
  },
  material(o, maps, ctx) {
    return physical(maps, this, { sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color().setRGB(...ctx.color.map((x) => Math.min(1, x * 1.4 + 0.1)), THREE.SRGBColorSpace) });
  },
});

registerKind('leather', {
  tileMeters: 0.6,
  defaults: { color: 0x4a2a1a, wear: 0.4, dirt: 0.3 },
  build(u, v, out, { N, o, color }) {
    const w = N.worley(u, v, 60);
    const grain = smoothstep(0.0, 0.3, w.f2 - w.f1);
    const crease = smoothstep(0.92, 0.99, N.ridged(u, v, { freq: 4, octaves: 4 })) * o.wear;
    let c = color.map((x) => x * (0.8 + grain * 0.25));
    c = mix3(c, color.map((x) => Math.min(1, x * 1.5 + 0.1)), crease * 0.4);
    c = mix3(c, [0.12, 0.1, 0.08], grime(N, u, v, o.dirt) * 0.25);
    setRGB(out, c);
    out.h = grain * 0.4 - crease * 0.3;
    out.rough = 0.5 + grain * 0.15 + crease * 0.2;
  },
});

// ---- Hard goods -----------------------------------------------------------------------------

function metalKind(baseColor, roughBase) {
  return {
    tileMeters: 1,
    defaults: { color: baseColor, wear: 0.3, dirt: 0.25 },
    build(u, v, out, { N, o, color }) {
      const brushed = N.perlin(u * 2, v * 400, 400) * 0.5 + 0.5;
      const smudge = smoothstep(0.55, 0.8, N.fbm(u, v, { freq: 5, octaves: 5 }) * 0.5 + 0.5);
      const scratch = smoothstep(0.985, 0.998, N.ridged(u, v, { freq: 6, octaves: 3 })) * o.wear;
      setRGB(out, color.map((x) => x * (0.92 + brushed * 0.08) * (1 - grime(N, u, v, o.dirt) * 0.4)));
      out.metal = 1;
      out.rough = clamp(roughBase + brushed * 0.06 + smudge * 0.18 * (o.dirt + 0.3) + scratch * 0.25, 0.04, 1);
      out.h = 0.5 - scratch * 0.2;
    },
    normalStrength: 0.6,
  };
}
registerKind('chrome', metalKind(0xe8e8ea, 0.06));
registerKind('steel', metalKind(0xb8bcc2, 0.32));
registerKind('brass', metalKind(0xd2a75a, 0.22));
registerKind('gold', metalKind(0xf0c46a, 0.16));
registerKind('aluminum', metalKind(0xc9cdd2, 0.38));

registerKind('metal-painted', {
  tileMeters: 1.5,
  defaults: { color: 0x2d4e7a, wear: 0.5, dirt: 0.4 },
  build(u, v, out, { N, o, color }) {
    const chipN = N.fbm(u, v, { freq: 8, octaves: 5 }) * 0.5 + 0.5;
    const chip = smoothstep(0.76 - o.wear * 0.1, 0.78 - o.wear * 0.1, chipN);
    const rust = smoothstep(0.5, 0.85, N.fbm(u + 2, v, { freq: 5, octaves: 5 }) * 0.5 + 0.5) * chip;
    let c = mix3(color, [0.55, 0.56, 0.57], chip);
    c = mix3(c, [0.42, 0.2, 0.08], rust * 0.85);
    c = mix3(c, [0.15, 0.13, 0.1], grime(N, u, v, o.dirt) * 0.3);
    setRGB(out, c);
    out.metal = chip * (1 - rust);
    out.rough = lerp(0.45, 0.85, rust) + chip * 0.05;
    out.h = 0.6 - chip * 0.15 + rust * 0.1;
  },
});

registerKind('plastic', {
  tileMeters: 1,
  defaults: { color: 0xe8e2d6, wear: 0.3, dirt: 0.3 },
  build(u, v, out, { N, o, color }) {
    const scratch = smoothstep(0.98, 0.997, N.ridged(u, v, { freq: 5, octaves: 3 })) * o.wear;
    const yellow = (N.fbm(u, v, { freq: 2, octaves: 3 }) * 0.5 + 0.5) * o.dirt * 0.3;
    let c = mix3(color, [color[0] * 0.95, color[1] * 0.88, color[2] * 0.7], yellow);
    c = mix3(c, [0.2, 0.18, 0.15], grime(N, u, v, o.dirt) * 0.25 + scratch * 0.2);
    setRGB(out, c);
    out.rough = 0.42 + scratch * 0.3 + (N.perlin(u * 80, v * 80, 80) * 0.5 + 0.5) * 0.08;
    out.h = 0.5 - scratch * 0.2;
  },
  normalStrength: 0.8,
});

registerKind('rubber', {
  tileMeters: 0.5,
  defaults: { color: 0x1b1b1d },
  build(u, v, out, { N, color }) {
    const n = N.perlin(u * 200, v * 200, 200) * 0.5 + 0.5;
    setRGB(out, color.map((x) => x * (0.9 + n * 0.2)));
    out.rough = 0.9;
    out.h = n * 0.2;
  },
});

registerKind('car-paint', {
  tileMeters: 2,
  size: 256,
  defaults: { color: 0x7a1f1f, wear: 0.3, dirt: 0.35 },
  build(u, v, out, { N, o, color }) {
    const fade = (N.fbm(u, v, { freq: 2, octaves: 3 }) * 0.5 + 0.5) * o.wear * 0.25;
    let c = mix3(color, color.map((x) => Math.min(1, x * 1.25 + 0.06)), fade);
    c = mix3(c, [0.36, 0.32, 0.27], grime(N, u, v, o.dirt) * 0.35 * smoothstep(0.4, 1, 1 - v));
    setRGB(out, c);
    out.metal = 0.35;
    out.rough = 0.32 + fade * 0.5 + grime(N, u, v, o.dirt) * 0.3;
  },
  material(o, maps) {
    return physical(maps, this, { clearcoat: 1 - o.wear * 0.7, clearcoatRoughness: 0.08 + o.wear * 0.3 });
  },
});

registerKind('glass', {
  defaults: { color: 0xdfe8ea, tint: 0.0, dirt: 0.2, frosted: false },
  material(o) {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(o.color),
      metalness: 0,
      roughness: o.frosted ? 0.45 : 0.04 + o.dirt * 0.08,
      transmission: 0.92,
      thickness: 0.01,
      ior: 1.5,
      transparent: true,
      opacity: 1,
      envMapIntensity: 1.2,
    });
  },
});

registerKind('mirror', {
  defaults: { color: 0xd8dde0 },
  material(o) {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(o.color), metalness: 1, roughness: 0.02 });
  },
});

registerKind('neon', {
  defaults: { color: 0xff3ea5, intensity: 6 },
  material(o) {
    const c = new THREE.Color(o.color);
    return new THREE.MeshStandardMaterial({
      color: c.clone().multiplyScalar(0.4),
      emissive: c,
      emissiveIntensity: o.intensity,
      roughness: 0.3,
      metalness: 0,
    });
  },
});

registerKind('emissive', {
  defaults: { color: 0xfff1d6, intensity: 2 },
  material(o) {
    return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(o.color), emissiveIntensity: o.intensity, roughness: 1 });
  },
});

registerKind('paper', {
  tileMeters: 0.3,
  defaults: { color: 0xf1ead9, dirt: 0.2 },
  build(u, v, out, { N, o, color }) {
    const fib = N.perlin(u * 300, v * 300, 300) * 0.5 + 0.5;
    setRGB(out, mix3(color.map((x) => x * (0.95 + fib * 0.05)), [0.7, 0.6, 0.45], grime(N, u, v, o.dirt) * 0.3));
    out.rough = 0.9;
    out.h = fib * 0.2;
  },
});

registerKind('cardboard', {
  tileMeters: 0.8,
  defaults: { color: 0xa47b4b, dirt: 0.3 },
  build(u, v, out, { N, o, color }) {
    const flute = Math.sin(u * Math.PI * 2 * 80) * 0.5 + 0.5;
    const fib = N.perlin(u * 200, v * 200, 200) * 0.5 + 0.5;
    setRGB(out, mix3(color.map((x) => x * (0.9 + fib * 0.1)), [0.3, 0.22, 0.15], grime(N, u, v, o.dirt) * 0.4));
    out.h = flute * 0.15 + fib * 0.1;
    out.rough = 0.92;
  },
});

registerKind('wood', {
  tileMeters: 1,
  defaults: { color: 0x7b5232, wear: 0.4, dirt: 0.25, varnish: 0.4 },
  build(u, v, out, { N, o, color }) {
    const g = N.perlin(u * 4, v * 60, 60);
    const ring = Math.sin((g * 6 + N.perlin(u * 2, v * 20, 20) * 3) * Math.PI) * 0.5 + 0.5;
    let c = color.map((x) => x * (0.78 + ring * 0.3));
    const scratch = smoothstep(0.98, 0.997, N.ridged(u, v, { freq: 6, octaves: 3 })) * o.wear;
    c = mix3(c, [0.8, 0.7, 0.55], scratch * 0.4);
    c = mix3(c, [0.12, 0.1, 0.08], grime(N, u, v, o.dirt) * 0.3);
    setRGB(out, c);
    out.h = ring * 0.15 - scratch * 0.2;
    out.rough = lerp(0.85, 0.3, o.varnish) + scratch * 0.2;
  },
});
