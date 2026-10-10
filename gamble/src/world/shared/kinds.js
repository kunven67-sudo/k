// Extra PBR material kinds for city building (registered into the shared gfx material library,
// ARCHITECTURE §6 — new kinds live in the module that needs them, never in materials.js).
//
// Kinds: board-concrete, cinderblock, roof-membrane, roof-gravel, corrugated, plywood, wood-pole,
// ballast, stone-veneer, tile-bulkhead, terrazzo, rust, tar-patch
// Plus helpers: offsetMat (polygon offset clone for coplanar overlays), paintMat (worn road paint),
// chainLinkMat (alpha-tested fence mesh).

import * as THREE from 'three';
import { registerKind, mat } from '../../gfx/materials.js';
import { hexToRgb, mix3 } from '../../gfx/textures.js';
import { TileNoise, hash2 } from '../../gfx/noise.js';
import { clamp, smoothstep, lerp } from '../../core/util.js';

const setRGB = (out, c) => {
  out.r = c[0];
  out.g = c[1];
  out.b = c[2];
};

function grime(N, u, v, amount) {
  if (amount <= 0) return 0;
  const big = N.fbm(u, v, { freq: 2, octaves: 4 }) * 0.5 + 0.5;
  const fine = N.fbm(u + 0.37, v + 0.11, { freq: 16, octaves: 3 }) * 0.5 + 0.5;
  return clamp(smoothstep(0.45, 0.9, big) * 0.8 + smoothstep(0.62, 0.95, fine) * 0.35, 0, 1) * amount;
}

// Board-formed concrete (retaining walls, parking garages, the trench): horizontal form lines,
// tie holes, efflorescence streaks.
registerKind('board-concrete', {
  tileMeters: 4,
  defaults: { color: null, wear: 0.5, dirt: 0.55 },
  normalStrength: 2.5,
  build(u, v, out, { N, o, color }) {
    const boards = 10;
    const bv = v * boards;
    const seam = 1 - smoothstep(0.0, 0.04, Math.min(bv % 1, 1 - (bv % 1)));
    const grain = N.perlin(u * 30, v * 160, 30) * 0.5 + 0.5;
    const boardTone = hash2(Math.floor(bv), 3, 7) * 0.05;
    let c = 0.56 + boardTone + grain * 0.03 + N.fbm(u, v, { freq: 4, octaves: 5 }) * 0.05;
    // Tie holes on a 4×2 grid.
    const tu = (u * 4) % 1 - 0.5;
    const tv = (v * 2) % 1 - 0.5;
    const tie = 1 - smoothstep(0.012, 0.02, Math.hypot(tu * 4, tv * 2) / 4);
    // Rain streaks + efflorescence running down.
    const streak = (N.perlin(u * 50, 0.3, 50) * 0.5 + 0.5) * smoothstep(0.2, 1, 1 - v);
    const efflo = smoothstep(0.75, 0.95, N.perlin(u * 22, v * 3, 22) * 0.5 + 0.5) * 0.12;
    c -= grime(N, u, v, o.dirt) * 0.2 + streak * o.dirt * 0.12 + seam * 0.12 + tie * 0.3;
    c += efflo;
    const tint = color ?? [1, 0.985, 0.95];
    setRGB(out, [c * tint[0], c * tint[1], c * tint[2]]);
    out.h = 0.5 - seam * 0.3 - tie * 0.5 + grain * 0.06;
    out.rough = 0.9;
    out.ao = 1 - tie * 0.6 - seam * 0.2;
  },
});

registerKind('cinderblock', {
  tileMeters: 1.6,
  defaults: { color: 0xb9b2a5, wear: 0.4, dirt: 0.5 },
  normalStrength: 2.5,
  build(u, v, out, { N, o, color }) {
    const rows = 8;
    const cols = 4;
    const row = Math.floor(v * rows);
    const ru = (u * cols + (row % 2) * 0.5) % cols;
    const fu = ru - Math.floor(ru);
    const fv = v * rows - row;
    const joint = 1 - smoothstep(0.015, 0.035, Math.min(fu, 1 - fu) * 2) * smoothstep(0.02, 0.06, Math.min(fv, 1 - fv));
    const pores = smoothstep(0.55, 0.8, N.perlin(u * 220, v * 220, 220) * 0.5 + 0.5);
    let c = color.map((x) => x * (0.92 + hash2(Math.floor(ru), row, 4) * 0.08 - pores * 0.08));
    c = mix3(c, [0.42, 0.4, 0.37], joint * 0.55);
    c = mix3(c, [0.24, 0.22, 0.2], grime(N, u, v, o.dirt) * 0.35);
    setRGB(out, c);
    out.h = 0.6 - joint * 0.45 - pores * 0.1;
    out.rough = 0.93;
    out.ao = 1 - joint * 0.4;
  },
});

registerKind('roof-membrane', {
  tileMeters: 6,
  defaults: { color: 0x8e8b86, wear: 0.5, dirt: 0.6 },
  build(u, v, out, { N, o, color }) {
    // Seams of rolled roofing every 1/6 tile, patched, ponding stains.
    const sv = (v * 6) % 1;
    const seam = 1 - smoothstep(0.0, 0.025, Math.min(sv, 1 - sv));
    const pond = smoothstep(0.62, 0.8, N.fbm(u, v, { freq: 2, octaves: 4 }) * 0.5 + 0.5);
    let c = color.map((x) => x * (0.9 + (N.perlin(u * 90, v * 90, 90) * 0.5 + 0.5) * 0.12));
    c = mix3(c, [0.3, 0.28, 0.25], pond * 0.45 * o.dirt + grime(N, u, v, o.dirt) * 0.3);
    c = mix3(c, [0.2, 0.2, 0.2], seam * 0.5);
    setRGB(out, c);
    out.h = 0.5 + seam * 0.2;
    out.rough = 0.85 - pond * 0.15;
  },
});

registerKind('roof-gravel', {
  tileMeters: 2,
  defaults: {},
  normalStrength: 3,
  build(u, v, out, { N }) {
    const w = N.worley(u, v, 70);
    const stone = 1 - smoothstep(0.3, 0.5, w.f1);
    const tone = 0.38 + hash2(w.id, 9, 2) * 0.3;
    const c = [tone, tone * 0.97, tone * 0.92].map((x) => x * (0.55 + stone * 0.45));
    setRGB(out, c);
    out.h = stone * 0.7;
    out.rough = 0.92;
    out.ao = 0.6 + stone * 0.4;
  },
});

registerKind('corrugated', {
  tileMeters: 2,
  defaults: { color: 0x9aa0a4, wear: 0.5, dirt: 0.5, rust: 0.4 },
  normalStrength: 4,
  build(u, v, out, { N, o, color }) {
    const wave = Math.sin(u * Math.PI * 2 * 26) * 0.5 + 0.5;
    const rust = smoothstep(0.55, 0.85, N.fbm(u, v, { freq: 4, octaves: 5 }) * 0.5 + 0.5 + smoothstep(0.6, 1, 1 - v) * 0.2) * o.rust;
    let c = color.map((x) => x * (0.85 + wave * 0.15));
    c = mix3(c, [0.45, 0.22, 0.1], rust * 0.85);
    c = mix3(c, [0.2, 0.18, 0.15], grime(N, u, v, o.dirt) * 0.3);
    setRGB(out, c);
    out.h = wave;
    out.metal = (1 - rust) * 0.7;
    out.rough = lerp(0.45, 0.9, rust);
  },
});

registerKind('plywood', {
  tileMeters: 2.4,
  defaults: { color: 0xa98a5e, wear: 0.5, dirt: 0.5 },
  build(u, v, out, { N, o, color }) {
    const sheetU = (u * 2) % 1;
    const sheetV = v % 1;
    const seam = 1 - smoothstep(0.0, 0.006, Math.min(sheetU, 1 - sheetU, sheetV, 1 - sheetV));
    const grain = N.perlin(u * 6, v * 70, 70) * 0.5 + 0.5;
    const knot = smoothstep(0.88, 0.95, N.perlin(u * 18, v * 18, 18) * 0.5 + 0.5);
    // Sun-greyed weathering from the top down, water stains at the bottom.
    const weather = smoothstep(0.2, 1.0, N.fbm(u, v, { freq: 3, octaves: 4 }) * 0.5 + 0.5) * o.wear;
    let c = color.map((x) => x * (0.82 + grain * 0.22 - knot * 0.25));
    c = mix3(c, [0.48, 0.46, 0.43], weather * 0.6);
    c = mix3(c, [0.25, 0.2, 0.15], grime(N, u, v, o.dirt) * 0.35 + smoothstep(0.7, 1, 1 - v) * 0.2 * o.dirt);
    c = mix3(c, [0.15, 0.12, 0.1], seam);
    setRGB(out, c);
    out.h = 0.5 + grain * 0.1 - seam * 0.4;
    out.rough = 0.9;
  },
});

// Creosote-soaked wooden utility pole (cylindrical UVs: u around, v along).
registerKind('wood-pole', {
  tileMeters: 1,
  defaults: { color: 0x5b4632, wear: 0.6, dirt: 0.4 },
  build(u, v, out, { N, o, color }) {
    const grain = N.perlin(u * 40, v * 3, 40) * 0.5 + 0.5;
    const crack = smoothstep(0.93, 0.99, N.ridged(u * 2, v * 0.3, { freq: 6, octaves: 3 }));
    const weather = smoothstep(0.3, 0.9, N.fbm(u, v, { freq: 3, octaves: 4 }) * 0.5 + 0.5) * o.wear;
    let c = color.map((x) => x * (0.78 + grain * 0.28));
    c = mix3(c, [0.42, 0.4, 0.36], weather * 0.45);
    c = mix3(c, [0.08, 0.06, 0.05], crack * 0.8);
    setRGB(out, c);
    out.h = grain * 0.4 - crack * 0.6;
    out.rough = 0.88;
    out.ao = 1 - crack * 0.5;
  },
});

registerKind('ballast', {
  tileMeters: 1.2,
  defaults: {},
  normalStrength: 5,
  build(u, v, out, { N }) {
    const w = N.worley(u, v, 40);
    const stone = 1 - smoothstep(0.2, 0.46, w.f1);
    const tone = 0.32 + hash2(w.id, 5, 1) * 0.28;
    const rustStain = smoothstep(0.55, 0.8, N.fbm(u, v, { freq: 3, octaves: 3 }) * 0.5 + 0.5) * 0.4;
    let c = [tone, tone * 0.96, tone * 0.92];
    c = mix3(c, [0.32, 0.2, 0.12], rustStain);
    setRGB(out, c.map((x) => x * (0.45 + stone * 0.55)));
    out.h = stone * 0.85;
    out.rough = 0.92;
    out.ao = 0.5 + stone * 0.5;
  },
});

registerKind('stone-veneer', {
  tileMeters: 2,
  defaults: { color: 0xb8a78c, wear: 0.3, dirt: 0.35 },
  normalStrength: 3.5,
  build(u, v, out, { N, o, color }) {
    const w = N.worley(u * 1.6, v, 9);
    const edge = smoothstep(0.02, 0.09, w.f2 - w.f1);
    const id = hash2(w.id, 2, 2);
    let c = color.map((x, i) => x * (0.75 + id * 0.35 + (i === 0 ? id * 0.05 : 0)));
    c = mix3(c, [0.33, 0.3, 0.27], (1 - edge) * 0.8);
    c = mix3(c, [0.2, 0.18, 0.15], grime(N, u, v, o.dirt) * 0.3);
    setRGB(out, c);
    out.h = edge * (0.6 + N.perlin(u * 60, v * 60, 60) * 0.15);
    out.rough = 0.85;
    out.ao = 0.55 + edge * 0.45;
  },
});

// Small square tile for storefront bulkheads and casino entrance columns.
registerKind('tile-bulkhead', {
  tileMeters: 0.6,
  defaults: { color: 0x2f4a3f, wear: 0.4, dirt: 0.4 },
  normalStrength: 2,
  build(u, v, out, { N, o, color }) {
    const n = 6;
    const tu = (u * n) % 1;
    const tv = (v * n) % 1;
    const e = Math.min(tu, 1 - tu, tv, 1 - tv);
    const grout = 1 - smoothstep(0.04, 0.07, e);
    const id = hash2(Math.floor(u * n), Math.floor(v * n), 8);
    const chip = smoothstep(0.86, 0.9, N.fbm(u, v, { freq: 6, octaves: 4 }) * 0.5 + 0.5) * o.wear;
    let c = color.map((x) => x * (0.86 + id * 0.18));
    c = mix3(c, [0.55, 0.53, 0.5], chip * 0.7);
    c = mix3(c, [0.4, 0.38, 0.34], grout);
    c = mix3(c, [0.15, 0.13, 0.1], grime(N, u, v, o.dirt) * 0.3);
    setRGB(out, c);
    out.h = (1 - grout) * 0.7 - chip * 0.2;
    out.rough = lerp(0.18, 0.8, Math.max(grout, chip));
  },
});

registerKind('terrazzo', {
  tileMeters: 2,
  defaults: { color: 0xcfc4b0, wear: 0.4, dirt: 0.4 },
  build(u, v, out, { N, o, color }) {
    const w = N.worley(u, v, 90);
    const chip = 1 - smoothstep(0.18, 0.3, w.f1);
    const id = hash2(w.id, 1, 3);
    const chipCol = id < 0.3 ? [0.55, 0.3, 0.22] : id < 0.6 ? [0.2, 0.2, 0.22] : [0.9, 0.88, 0.84];
    let c = mix3(color, chipCol, chip * 0.7);
    c = mix3(c, [0.3, 0.27, 0.23], grime(N, u, v, o.dirt) * 0.3);
    setRGB(out, c);
    out.h = 0.5;
    out.rough = 0.35 + grime(N, u, v, o.dirt) * 0.3;
  },
});

registerKind('rust', {
  tileMeters: 1,
  defaults: { color: 0x6b3a1e },
  normalStrength: 3,
  build(u, v, out, { N, color }) {
    const n = N.fbm(u, v, { freq: 8, octaves: 6 }) * 0.5 + 0.5;
    const flake = smoothstep(0.6, 0.75, N.perlin(u * 60, v * 60, 60) * 0.5 + 0.5);
    const c = mix3(color, [0.32, 0.17, 0.08], n * 0.6);
    setRGB(out, mix3(c, [0.55, 0.32, 0.15], flake * 0.4));
    out.h = n * 0.6 + flake * 0.2;
    out.rough = 0.92;
    out.metal = 0.15;
  },
});

// ---- Helper materials ---------------------------------------------------------------------------

const offsetCache = new Map();
// Clone with polygon offset so coplanar overlays (gutters, paint, patches) never z-fight.
export function offsetMat(material, factor = -2) {
  const key = `${material.uuid}|${factor}`;
  let m = offsetCache.get(key);
  if (!m) {
    m = material.clone();
    m.polygonOffset = true;
    m.polygonOffsetFactor = factor;
    m.polygonOffsetUnits = factor * 2;
    m.userData = { ...material.userData };
    m.name = `${material.name}+off`;
    offsetCache.set(key, m);
  }
  return m;
}

let paintTex = null;
function wornPaintTexture() {
  if (paintTex) return paintTex;
  const S = 256;
  const N = new TileNoise(515);
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      // Paint survives in patches: tyre-worn blotches + fine pitting from the aggregate.
      const big = N.fbm(u, v, { freq: 3, octaves: 4 }) * 0.5 + 0.5;
      const pits = N.perlin(u * 96, v * 96, 96) * 0.5 + 0.5;
      const a = clamp(smoothstep(0.28, 0.5, big) * smoothstep(0.25, 0.55, pits + big * 0.3), 0, 1);
      const i = (y * S + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(a * 255);
      data[i + 3] = 255;
    }
  }
  paintTex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  paintTex.wrapS = paintTex.wrapT = THREE.RepeatWrapping;
  paintTex.magFilter = THREE.LinearFilter;
  paintTex.minFilter = THREE.LinearMipmapLinearFilter;
  paintTex.generateMipmaps = true;
  paintTex.needsUpdate = true;
  return paintTex;
}

const paintCache = new Map();
// Worn road paint (crosswalks, lane lines, curb paint). Alpha comes from a tiling wear mask in
// world UVs, so every line wears differently.
export function paintMat(color = 0xe9e6dc, { wear = 0.5 } = {}) {
  const key = `${color}|${wear}`;
  let m = paintCache.get(key);
  if (!m) {
    const asph = mat('asphalt');
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.62,
      metalness: 0,
      normalMap: asph.normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      alphaMap: wornPaintTexture(),
      transparent: true,
      opacity: 1 - wear * 0.25,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    });
    m.name = 'road-paint';
    m.userData.tileMeters = 2.5;
    paintCache.set(key, m);
  }
  return m;
}

let chainTex = null;
// Galvanised chain-link: diamond wire mesh drawn into an alpha-tested texture.
export function chainLinkMat() {
  if (chainTex) return chainTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  // Diamond lattice: two families of 45° wires; step divides the tile so it wraps seamlessly.
  g.strokeStyle = 'rgba(205,208,210,1)';
  g.lineWidth = 4.5;
  g.lineCap = 'round';
  const n = 4;
  const step = S / n;
  for (let k = -n; k <= 2 * n; k++) {
    g.beginPath();
    g.moveTo(k * step, 0);
    g.lineTo(k * step + S, S);
    g.stroke();
    g.beginPath();
    g.moveTo(k * step, 0);
    g.lineTo(k * step - S, S);
    g.stroke();
  }
  // Knuckles where wires twist around each other read as small bright dots.
  g.fillStyle = 'rgba(230,232,234,1)';
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    g.beginPath();
    g.arc(i * step + ((j % 2) * step) / 2, (j * step) / 2, 3.2, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const steel = mat('steel');
  chainTex = new THREE.MeshStandardMaterial({
    map: tex,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    metalness: 0.75,
    roughness: 0.45,
    color: 0xb9bec2,
    envMapIntensity: 0.8,
    roughnessMap: steel.roughnessMap,
  });
  chainTex.name = 'chain-link';
  chainTex.userData.tileMeters = 0.42;
  return chainTex;
}

export { mat };
