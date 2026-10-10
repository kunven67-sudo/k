// Real-world materials for spawnable stuff, painted in code: wood grain per species,
// fabric weave, leather grain, marble veins, brushed metal, glass, ceramic, cardboard.
// Textures are in real meters (UVs are set per part), so a 2 m sofa shows 2 m of fabric.

import * as THREE from 'three';
import { tileFbm, mulberry32, clamp, lerp } from '../core/noise.js';

const S = 512;
const texCache = new Map();
const matCache = new Map();

function canvasTex(draw, { srgb = true, w = S, h = S, repeat = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.repeat.set(repeat, repeat);
  return t;
}

function heightToNormal(hgt, w, h, strength) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = hgt[y * w + ((x - 1 + w) % w)], r = hgt[y * w + ((x + 1) % w)];
    const u = hgt[((y - 1 + h) % h) * w + x], d = hgt[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz);
    const o = (y * w + x) * 4;
    out[o] = (nx / len * 0.5 + 0.5) * 255; out[o + 1] = (ny / len * 0.5 + 0.5) * 255; out[o + 2] = (nz / len) * 255; out[o + 3] = 255;
  }
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function cached(key, make) {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key);
}

const hex = (c) => [(c >> 16 & 255), (c >> 8 & 255), (c & 255)];

// ---------- wood ----------
// U runs along the grain. One texture tile = 1.2 m of board.
export const WOODS = {
  oak: { light: 0xb8925f, dark: 0x8a6438, ring: 0.9, ray: true },
  walnut: { light: 0x6b4a33, dark: 0x3e2a1c, ring: 0.7 },
  pine: { light: 0xd8b67e, dark: 0xb4834a, ring: 1.4, knots: true },
  maple: { light: 0xe0c49a, dark: 0xc9a476, ring: 0.5 },
  cherry: { light: 0xa5603a, dark: 0x7a3d22, ring: 0.6 },
  whiteoak: { light: 0xcdb48c, dark: 0xa48a62, ring: 0.8, ray: true },
  ebony: { light: 0x3a2f2a, dark: 0x1c1613, ring: 0.5 },
  reclaimed: { light: 0x9c8466, dark: 0x5e4a36, ring: 1.1, knots: true, worn: true },
};

function woodTextures(species) {
  return cached('wood:' + species, () => {
    const spec = WOODS[species];
    const rand = mulberry32(species.length * 997);
    const hgt = new Float32Array(S * S);
    const L = hex(spec.light), D = hex(spec.dark);
    const map = canvasTex((ctx) => {
      const img = ctx.createImageData(S, S);
      const knots = [];
      if (spec.knots) for (let k = 0; k < 3; k++) knots.push([rand() * S, rand() * S, 6 + rand() * 10]);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        // grain: stretched along x (U), wavy rings along y
        // straight-ish grain with gentle waves (flat-sawn boards), not plywood swirls
        let gy = y + 7 * tileFbm(x / 170, y / 90, 3, 3, 7) + 2.2 * tileFbm(x / 40, y / 20, 12.8, 2, 9);
        for (const [kx, ky, kr] of knots) {
          const dx = ((x - kx + S * 1.5) % S) - S / 2, dy = ((y - ky + S * 1.5) % S) - S / 2;
          const d = Math.hypot(dx * 0.35, dy);
          gy += (kr * 3) / (1 + d * 0.15) * Math.sign(dy);
        }
        const ringPhase = gy / (S / (34 * spec.ring));
        let ring = 0.5 + 0.5 * Math.sin(ringPhase * Math.PI * 2);
        ring = Math.pow(ring, 2.5);
        const fine = tileFbm(x / 256, y / 2, 2, 2, 3) * 0.5 + 0.5; // tight fibers
        let t = clamp(ring * 0.65 + fine * 0.35, 0, 1);
        if (spec.ray && tileFbm(x / 8, y / 3, 64, 1, 5) > 0.55) t = Math.min(1, t + 0.25); // oak ray flecks
        for (const [kx, ky, kr] of knots) {
          const dx = ((x - kx + S * 1.5) % S) - S / 2, dy = ((y - ky + S * 1.5) % S) - S / 2;
          const d = Math.hypot(dx * 0.8, dy);
          if (d < kr) t = lerp(1, t, d / kr) * 1.05;
        }
        let r = lerp(L[0], D[0], t), g = lerp(L[1], D[1], t), b = lerp(L[2], D[2], t);
        if (spec.worn) { const n = tileFbm(x / 40, y / 40, 12, 3, 13) * 0.5 + 0.5; r *= 0.85 + n * 0.25; g *= 0.85 + n * 0.25; b *= 0.85 + n * 0.25; }
        const o = (y * S + x) * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
        hgt[y * S + x] = 1 - t * 0.6;
      }
      ctx.putImageData(img, 0, 0);
    });
    return { map, normalMap: heightToNormal(hgt, S, S, 1.6) };
  });
}

// ---------- fabric ----------
function fabricTextures(kind) {
  return cached('fabric:' + kind, () => {
    const hgt = new Float32Array(S * S);
    const map = canvasTex((ctx) => {
      const img = ctx.createImageData(S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let v;
        if (kind === 'velvet') v = 0.5 + 0.12 * tileFbm(x / 24, y / 24, 21, 3, 4);
        else if (kind === 'linen') {
          const wx = Math.sin(x * Math.PI / 2) * 0.5 + 0.5, wy = Math.sin(y * Math.PI / 2) * 0.5 + 0.5;
          v = 0.55 + 0.25 * ((x >> 1) + (y >> 1) & 1 ? wx : wy) + 0.12 * tileFbm(x / 6, y / 64, 85, 2, 8);
        } else { // woven upholstery
          const cell = 4;
          const over = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1);
          const fx = (x % cell) / cell, fy = (y % cell) / cell;
          v = over ? 0.55 + 0.35 * Math.sin(fx * Math.PI) : 0.55 + 0.35 * Math.sin(fy * Math.PI);
          v += 0.1 * tileFbm(x / 20, y / 20, 25, 2, 6);
        }
        const o = (y * S + x) * 4;
        const c = clamp(0.78 + (v - 0.6) * 0.5, 0, 1) * 255;
        img.data[o] = c; img.data[o + 1] = c; img.data[o + 2] = c; img.data[o + 3] = 255;
        hgt[y * S + x] = v;
      }
      ctx.putImageData(img, 0, 0);
    });
    return { map, normalMap: heightToNormal(hgt, S, S, kind === 'velvet' ? 0.5 : 2.2) };
  });
}

function leatherTextures() {
  return cached('leather', () => {
    const hgt = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // pebbled grain: cells (abs noise) + fine wrinkles
      const cells = 1 - Math.abs(tileFbm(x / 9, y / 9, 57, 2, 11));
      hgt[y * S + x] = cells * 0.8 + 0.2 * (tileFbm(x / 3, y / 3, 170, 1, 12) * 0.5 + 0.5);
    }
    const map = canvasTex((ctx) => {
      const img = ctx.createImageData(S, S);
      for (let k = 0; k < S * S; k++) {
        const v = 210 + hgt[k] * 45;
        img.data[k * 4] = v; img.data[k * 4 + 1] = v; img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
    return { map, normalMap: heightToNormal(hgt, S, S, 2.5) };
  });
}

function marbleTextures(kind) {
  return cached('marble:' + kind, () => {
    const base = kind === 'black' ? [24, 24, 26] : kind === 'green' ? [40, 70, 55] : [236, 234, 230];
    const vein = kind === 'black' ? [210, 205, 195] : kind === 'green' ? [220, 230, 220] : [120, 118, 122];
    const map = canvasTex((ctx) => {
      const img = ctx.createImageData(S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n = tileFbm(x / 90, y / 90, 5.7, 5, 21);
        const v1 = Math.pow(1 - Math.abs(Math.sin((x * 0.006 + y * 0.004 + n * 3.2) * Math.PI)), 18);
        const v2 = Math.pow(1 - Math.abs(Math.sin((x * 0.011 - y * 0.009 + n * 5) * Math.PI)), 40) * 0.6;
        const cloud = tileFbm(x / 60, y / 60, 8.5, 4, 22) * 0.06;
        const t = clamp(v1 + v2, 0, 1);
        const o = (y * S + x) * 4;
        for (let c = 0; c < 3; c++) img.data[o + c] = clamp(lerp(base[c], vein[c], t) * (1 + cloud), 0, 255);
        img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
    return { map };
  });
}

function brushedTextures() {
  return cached('brushed', () => {
    const hgt = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hgt[y * S + x] = tileFbm(x / 256, y / 0.8, 2, 2, 31) * 0.5 + 0.5;
    const rough = canvasTex((ctx) => {
      const img = ctx.createImageData(S, S);
      for (let k = 0; k < S * S; k++) { const v = 90 + hgt[k] * 70; img.data[k * 4] = v; img.data[k * 4 + 1] = v; img.data[k * 4 + 2] = v; img.data[k * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    }, { srgb: false });
    return { roughnessMap: rough, normalMap: heightToNormal(hgt, S, S, 0.6) };
  });
}

function boardTextures(kind) {
  // particle board edges + cheap printed "wood" laminate (flat-pack)
  return cached('board:' + kind, () => {
    const rand = mulberry32(55);
    const map = canvasTex((ctx) => {
      ctx.fillStyle = kind === 'chip' ? '#b59a72' : '#f2efe8';
      ctx.fillRect(0, 0, S, S);
      if (kind === 'chip') {
        for (let i = 0; i < 9000; i++) {
          const s = 1 + rand() * 5;
          const c = 120 + rand() * 90;
          ctx.fillStyle = `rgb(${c},${c * 0.82},${c * 0.6})`;
          ctx.fillRect(rand() * S, rand() * S, s * (0.5 + rand()), s * 0.6);
        }
      } else {
        for (let i = 0; i < 400; i++) { const c = 236 + rand() * 10; ctx.fillStyle = `rgba(${c},${c},${c - 4},0.5)`; ctx.fillRect(rand() * S, rand() * S, 2, 2); }
      }
    });
    return { map };
  });
}

function cardboardTextures() {
  return cached('cardboard', () => {
    const rand = mulberry32(77);
    const hgt = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hgt[y * S + x] = 0.5 + 0.5 * Math.sin(y * Math.PI / 6) * 0.3 + tileFbm(x / 30, y / 30, 17, 2, 41) * 0.1;
    const map = canvasTex((ctx) => {
      const img = ctx.createImageData(S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n = tileFbm(x / 40, y / 40, 12.8, 3, 42) * 10;
        const o = (y * S + x) * 4;
        img.data[o] = 186 + n; img.data[o + 1] = 146 + n; img.data[o + 2] = 98 + n * 0.7; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // printed logo + arrows + tape
      ctx.fillStyle = 'rgba(40,40,40,0.75)';
      ctx.font = 'bold 54px Inter, sans-serif';
      ctx.fillText('NORDBO', 150, 270);
      ctx.font = '22px Inter, sans-serif';
      ctx.fillText('THIS SIDE UP ↑↑', 170, 310);
      ctx.fillStyle = 'rgba(200,170,110,0.55)';
      ctx.fillRect(0, 236, S, 24);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(90,60,30,${rand() * 0.08})`; ctx.fillRect(rand() * S, rand() * S, rand() * 80, 2); }
    });
    return { map, normalMap: heightToNormal(hgt, S, S, 1.2) };
  });
}

// ---------- palettes for options ----------
export const FABRIC_COLORS = {
  'Stone gray': 0x8d8b88, 'Charcoal': 0x3c3d40, 'Oatmeal': 0xcbbfa8, 'Navy': 0x27324a, 'Forest green': 0x34503c,
  'Mustard': 0xc49a35, 'Terracotta': 0xb0603f, 'Cream': 0xe6dfcf, 'Blush': 0xd3a39a, 'Black': 0x1d1d1f,
};
export const LEATHER_COLORS = { 'Cognac': 0x8a4f2a, 'Espresso': 0x3b261b, 'Black': 0x151414, 'Saddle tan': 0xa9703f, 'Oxblood': 0x5a1d1c, 'Ivory': 0xe7dfcf };
export const METAL_FINISHES = { 'Black steel': 'black', 'Brushed steel': 'steel', 'Brass': 'brass', 'Chrome': 'chrome', 'Gold': 'gold' };
export const PAINT_COLORS = { 'White': 0xf1f0ec, 'Black': 0x202022, 'Sage': 0x9aa58d, 'Navy': 0x2b3550, 'Natural': null };

// ---------- the material factory ----------
// key examples: 'wood:oak', 'fabric:woven:Stone gray', 'leather:Cognac', 'metal:brass', 'glass:clear',
// 'marble:white', 'ceramic', 'board:white', 'board:chip', 'paint:Sage', 'cardboard', 'foam', 'rubber'
export function material(key) {
  if (matCache.has(key)) return matCache.get(key);
  const [kind, a, b] = key.split(':');
  let m;
  switch (kind) {
    case 'wood': {
      const t = woodTextures(a || 'oak');
      m = new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: b === 'gloss' ? 0.25 : 0.55, clearcoat: b === 'gloss' ? 0.6 : 0.15, clearcoatRoughness: 0.4 });
      m.userData.tile = 1.2;
      break;
    }
    case 'fabric': {
      const t = fabricTextures(a || 'woven');
      const col = FABRIC_COLORS[b] ?? 0x8d8b88;
      m = new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, color: col, roughness: a === 'velvet' ? 0.75 : 0.92, sheen: a === 'velvet' ? 1 : 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.35) });
      m.userData.tile = a === 'linen' ? 0.15 : 0.12;
      break;
    }
    case 'leather': {
      const t = leatherTextures();
      m = new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), color: LEATHER_COLORS[a] ?? 0x8a4f2a, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.5 });
      m.userData.tile = 0.25;
      break;
    }
    case 'metal': {
      const t = brushedTextures();
      const finishes = {
        black: { color: 0x1d1e20, metalness: 0.6, roughness: 0.55 },
        steel: { color: 0xb9bcc0, metalness: 1, roughness: 0.35 },
        brass: { color: 0xc8a560, metalness: 1, roughness: 0.3 },
        chrome: { color: 0xeeeeee, metalness: 1, roughness: 0.06 },
        gold: { color: 0xe3bf62, metalness: 1, roughness: 0.18 },
        iron: { color: 0x3a3a3a, metalness: 0.8, roughness: 0.7 },
      };
      const f = finishes[a] || finishes.steel;
      m = new THREE.MeshStandardMaterial({ ...f, normalMap: a === 'chrome' ? null : t.normalMap, roughnessMap: a === 'chrome' || a === 'black' ? null : t.roughnessMap });
      m.userData.tile = 0.5;
      break;
    }
    case 'glass':
      m = new THREE.MeshPhysicalMaterial({ color: a === 'smoked' ? 0x444a4f : 0xe8f2f0, roughness: a === 'frosted' ? 0.45 : 0.03, metalness: 0, transparent: true, opacity: a === 'frosted' ? 0.6 : 0.22, ior: 1.52, specularIntensity: 1, envMapIntensity: 1.4, depthWrite: false });
      m.userData.glass = true;
      break;
    case 'mirror':
      m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.0, envMapIntensity: 1.3 });
      break;
    case 'marble': {
      const t = marbleTextures(a || 'white');
      m = new THREE.MeshPhysicalMaterial({ map: t.map, roughness: 0.12, clearcoat: 0.7, clearcoatRoughness: 0.08 });
      m.userData.tile = 1.0;
      break;
    }
    case 'ceramic':
      m = new THREE.MeshPhysicalMaterial({ color: a ? Number(a) : 0xf6f6f3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
      break;
    case 'board': {
      const t = boardTextures(a || 'white');
      m = new THREE.MeshStandardMaterial({ map: t.map, roughness: a === 'chip' ? 0.9 : 0.45, color: a === 'oakprint' ? 0xc8a77a : 0xffffff });
      m.userData.tile = 0.6;
      break;
    }
    case 'paint':
      m = new THREE.MeshStandardMaterial({ color: PAINT_COLORS[a] ?? 0xf1f0ec, roughness: 0.5 });
      break;
    case 'cardboard': {
      const t = cardboardTextures();
      m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.95 });
      m.userData.tile = 1.0;
      break;
    }
    case 'foam': m = new THREE.MeshStandardMaterial({ color: 0xe9e3cf, roughness: 1 }); break;
    case 'rubber': m = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85 }); break;
    case 'plastic': m = new THREE.MeshPhysicalMaterial({ color: a ? Number(a) : 0x222222, roughness: 0.4, clearcoat: 0.3 }); break;
    case 'bulb': m = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0x000000, roughness: 0.2 }); m.userData.bulb = true; break;
    case 'shade': m = new THREE.MeshStandardMaterial({ color: a ? Number(a) : 0xf2ead8, roughness: 0.95, side: THREE.DoubleSide, emissive: 0x000000 }); m.userData.shade = true; break;
    default: m = new THREE.MeshStandardMaterial({ color: 0xff00ff });
  }
  m.userData.key = key;
  matCache.set(key, m);
  return m;
}

// Real-world densities (kg/m³) + how each surface feels/sounds/breaks.
export const PHYSICAL = {
  wood: { density: 650, friction: 0.5, sound: 'wood', breaks: 'splinter', strength: 1 },
  board: { density: 700, friction: 0.45, sound: 'wood', breaks: 'crumble', strength: 0.45 },
  fabric: { density: 120, friction: 0.75, sound: 'soft', breaks: 'tear', strength: 3 },
  leather: { density: 160, friction: 0.7, sound: 'soft', breaks: 'tear', strength: 3 },
  foam: { density: 60, friction: 0.8, sound: 'soft', breaks: null, strength: 9 },
  metal: { density: 2400, friction: 0.4, sound: 'metal', breaks: 'dent', strength: 4 },
  glass: { density: 2500, friction: 0.3, sound: 'glass', breaks: 'shatter', strength: 0.25 },
  mirror: { density: 2500, friction: 0.3, sound: 'glass', breaks: 'shatter', strength: 0.25 },
  marble: { density: 2700, friction: 0.45, sound: 'stone', breaks: 'crack', strength: 1.4 },
  ceramic: { density: 2300, friction: 0.4, sound: 'ceramic', breaks: 'shatter', strength: 0.7 },
  paint: { density: 650, friction: 0.5, sound: 'wood', breaks: 'splinter', strength: 1 },
  cardboard: { density: 120, friction: 0.6, sound: 'cardboard', breaks: 'tear', strength: 0.5 },
  rubber: { density: 1100, friction: 0.95, sound: 'soft', breaks: null, strength: 9 },
  plastic: { density: 950, friction: 0.5, sound: 'plastic', breaks: 'crack', strength: 0.8 },
  bulb: { density: 500, friction: 0.3, sound: 'glass', breaks: 'shatter', strength: 0.2 },
  shade: { density: 200, friction: 0.6, sound: 'soft', breaks: 'tear', strength: 2 },
};

export function physicalOf(key) { return PHYSICAL[key.split(':')[0]] || PHYSICAL.wood; }
