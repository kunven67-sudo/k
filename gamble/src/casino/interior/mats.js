// Material palette for the Eldorado floor: warm cream, gold, marble, dark wood, patterned
// carpet (Italian-Renaissance glamour). New kinds are registered here (never in gfx/materials.js):
//   marble   polished veined stone tiles (Crema / Rosso / Nero by colour), grout lines optional
//   bronze   statuary bronze with verdigris in the hollows
//   plaster  smooth painted plaster for ceilings and mouldings
// plus cheap glass and always-on emissive helpers (the casino never turns its lights off, so
// nothing here follows the city's day/night uniforms).
import * as THREE from 'three';
import { mat, registerKind } from '../../gfx/materials.js';
import { hexToRgb, mix3 } from '../../gfx/textures.js';
import { hash2 } from '../../gfx/noise.js';
import { clamp, smoothstep, lerp } from '../../core/util.js';

const setRGB = (out, c) => {
  out.r = c[0];
  out.g = c[1];
  out.b = c[2];
};

registerKind('marble', {
  tileMeters: 1.2,
  defaults: { color: 0xe9dcc2, color2: 0xa88e66, tiles: 2, veins: 1, wear: 0.2, dirt: 0.2 },
  normalStrength: 1.2,
  build(u, v, out, { N, o, color }) {
    const vein = hexToRgb(o.color2);
    const n = o.tiles || 0;
    let grout = 0;
    let id = 0.5;
    if (n) {
      const tu = u * n;
      const tv = v * n;
      const fu = tu % 1;
      const fv = tv % 1;
      const e = Math.min(fu, 1 - fu, fv, 1 - fv);
      grout = 1 - smoothstep(0.003, 0.009, e);
      id = hash2(Math.floor(tu), Math.floor(tv), 13);
    }
    // Each tile is cut from a different part of the slab: offset the vein field per tile.
    const ou = u + id * 0.37;
    const ov = v + id * 0.71;
    const warp = N.fbm(ou, ov, { freq: 2, octaves: 4 }) * 0.6;
    const f1 = N.fbm(ou + warp, ov - warp * 0.5, { freq: 2, octaves: 6 });
    const f2 = N.fbm(ov + 0.21, ou + warp, { freq: 4, octaves: 5 });
    const main = 1 - smoothstep(0.0, 0.035, Math.abs(f1));
    const fine = (1 - smoothstep(0.0, 0.018, Math.abs(f2))) * 0.55;
    const cloud = N.fbm(ou * 1.3, ov * 1.3, { freq: 3, octaves: 5 }) * 0.5 + 0.5;
    let c = color.map((x) => x * (0.9 + cloud * 0.12 + (id - 0.5) * 0.05));
    c = mix3(c, vein, clamp((main * 0.85 + fine) * o.veins, 0, 1));
    // Foot traffic dulls the polish and greys the grout.
    const scuff = smoothstep(0.55, 0.9, N.fbm(u + 3.1, v, { freq: 6, octaves: 4 }) * 0.5 + 0.5) * o.wear;
    c = mix3(c, [0.42, 0.38, 0.33], grout * 0.85);
    c = mix3(c, [0.36, 0.3, 0.24], grout * o.dirt * 0.6);
    setRGB(out, c);
    out.h = 0.6 - grout * 0.5;
    out.rough = clamp(0.1 + cloud * 0.05 + scuff * 0.22 + grout * 0.6, 0.06, 1);
    out.ao = 1 - grout * 0.35;
  },
});

registerKind('bronze', {
  tileMeters: 0.8,
  defaults: { color: 0x9a6a3a, patina: 0.5, wear: 0.4, dirt: 0.3 },
  normalStrength: 0.9,
  build(u, v, out, { N, o, color }) {
    const f = N.fbm(u, v, { freq: 4, octaves: 5 }) * 0.5 + 0.5;
    const pat = smoothstep(0.5, 0.75, f) * o.patina;
    const polish = smoothstep(0.65, 0.9, N.fbm(u + 1.7, v, { freq: 3, octaves: 4 }) * 0.5 + 0.5) * o.wear;
    let c = color.map((x) => x * (0.75 + f * 0.3));
    c = mix3(c, [0.26, 0.45, 0.36], pat * 0.8);
    c = mix3(c, [0.95, 0.72, 0.42], polish * 0.5);
    setRGB(out, c);
    out.metal = 1 - pat * 0.8;
    out.rough = clamp(0.32 + pat * 0.4 - polish * 0.18 + (N.perlin(u * 90, v * 90, 90) * 0.5 + 0.5) * 0.08, 0.08, 1);
    out.h = f * 0.4;
  },
});

registerKind('plaster', {
  tileMeters: 3,
  size: 256,
  defaults: { color: 0xf0e4c8, dirt: 0.15 },
  normalStrength: 0.6,
  build(u, v, out, { N, o, color }) {
    const t = N.fbm(u, v, { freq: 6, octaves: 5 }) * 0.5 + 0.5;
    const stain = smoothstep(0.7, 0.9, N.fbm(u + 0.5, v + 0.2, { freq: 2, octaves: 4 }) * 0.5 + 0.5) * o.dirt;
    let c = color.map((x) => x * (0.95 + t * 0.06));
    c = mix3(c, [0.62, 0.52, 0.38], stain * 0.25);
    setRGB(out, c);
    out.h = t * 0.2;
    out.rough = 0.88;
  },
});

let PAL = null;

/** The casino palette (cached). Every entry is a shared PBR material. */
export function casinoMats() {
  if (PAL) return PAL;
  PAL = {
    carpet: mat('carpet-casino', { color: 0x420a14, color2: 0xc79a3e, color3: 0x1d4a52, dirt: 0.3, seed: 301, tileMeters: 1.45 }),
    marble: mat('marble', { color: 0xeadfc6, color2: 0xa98d63, tiles: 2, seed: 302 }),
    marbleSlab: mat('marble', { color: 0xefe5cf, color2: 0xc4ae88, tiles: 0, veins: 0.55, seed: 303, tileMeters: 0.9 }),
    marbleRed: mat('marble', { color: 0x7a2a22, color2: 0xd6b48a, tiles: 0, seed: 304 }),
    marbleDark: mat('marble', { color: 0x1d1a18, color2: 0xcfc5b4, tiles: 0, seed: 305 }),
    marbleGreen: mat('marble', { color: 0x1f4a3a, color2: 0xd8e2c8, tiles: 0, seed: 306 }),
    wallpaper: mat('wallpaper', { color: 0xe5d1a4, color2: 0xbf9a55, pattern: 'damask', dirt: 0.22, wear: 0.2, seed: 307 }),
    wallRed: mat('wallpaper', { color: 0x6b1a1e, color2: 0xa8763c, pattern: 'damask', dirt: 0.25, wear: 0.2, seed: 308 }),
    plaster: mat('plaster', { color: 0xf0e2c2, seed: 309 }),
    plasterWarm: mat('plaster', { color: 0xe6cfa0, seed: 310 }),
    wood: mat('wood', { color: 0x4a2814, varnish: 0.85, wear: 0.25, dirt: 0.15, seed: 311 }),
    woodLight: mat('wood', { color: 0x8a5a32, varnish: 0.7, wear: 0.3, dirt: 0.2, seed: 312 }),
    gold: mat('gold', { wear: 0.2, dirt: 0.25, seed: 313 }),
    brass: mat('brass', { wear: 0.35, dirt: 0.3, seed: 314 }),
    chrome: mat('chrome', { wear: 0.2, dirt: 0.2, seed: 315 }),
    steel: mat('steel', { wear: 0.4, dirt: 0.35, seed: 316 }),
    bronze: mat('bronze', { seed: 317 }),
    felt: mat('felt', { color: 0x0f4a33, seed: 318 }),
    feltBlue: mat('felt', { color: 0x163a5c, seed: 319 }),
    leather: mat('leather', { color: 0x3a1410, wear: 0.3, seed: 320 }),
    leatherBlack: mat('leather', { color: 0x161212, wear: 0.3, seed: 321 }),
    fabric: mat('fabric', { color: 0x5a1220, weave: 'plain', dirt: 0.25, seed: 322 }),
    cover: mat('fabric', { color: 0x1c1a20, weave: 'plain', dirt: 0.3, wear: 0.4, seed: 323 }),
    black: mat('metal-painted', { color: 0x141214, wear: 0.15, dirt: 0.2, seed: 324 }),
    cream: mat('metal-painted', { color: 0xe8dcc0, wear: 0.15, dirt: 0.25, seed: 325 }),
    darkRed: mat('metal-painted', { color: 0x5a1218, wear: 0.2, dirt: 0.2, seed: 326 }),
    rubber: mat('rubber', { color: 0x141414 }),
    paper: mat('paper', { color: 0xf1ead9, dirt: 0.15 }),
    flower: mat('plastic', { color: 0xffffff, wear: 0.05, dirt: 0.08, seed: 331 }),
    mirror: Object.assign(new THREE.MeshStandardMaterial({ color: 0xcfd2cf, metalness: 1, roughness: 0.04, envMapIntensity: 1.3 }), { name: 'casino-mirror' }),
    // Cheap reflective glass: no transmission pass (phones), env reflections only.
    glass: Object.assign(new THREE.MeshStandardMaterial({ color: 0xd8e4e2, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.8, side: THREE.DoubleSide }), { name: 'casino-glass' }),
    glassTint: Object.assign(new THREE.MeshStandardMaterial({ color: 0x9c8a6a, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide }), { name: 'casino-glass-tint' }),
    bronzeFrame: mat('bronze', { color: 0x6b4a2a, patina: 0.06, wear: 0.55, seed: 330 }),
    glassDoor: Object.assign(new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.24, depthWrite: false, envMapIntensity: 2.0, side: THREE.DoubleSide }), { name: 'casino-glass-door' }),
    smoked: Object.assign(new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.06, metalness: 0.4, envMapIntensity: 1.5 }), { name: 'smoked-dome' }),
  };
  PAL.lamp = glow(0xffd9a0, 4.2);
  PAL.lampSoft = glow(0xffe2b8, 2.2);
  PAL.lampCove = glow(0xffc77a, 3.2);
  PAL.lampWhite = glow(0xfff4e0, 5.5);
  PAL.candle = glow(0xffcf8a, 7.5);
  return PAL;
}

const glowCache = new Map();
/** Always-on emissive lamp/LED face (HDR so bloom catches it). */
export function glow(color, k = 3) {
  const key = `${color}|${k}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: 0x1a1612, emissive: new THREE.Color(color), emissiveIntensity: k, roughness: 0.4, metalness: 0 });
    m.name = `casino-glow-${k}`;
    glowCache.set(key, m);
  }
  return m;
}

const signCache = new Map();
/**
 * Canvas-drawn sign face, always lit (`lit` = emissive multiplier, 0 = unlit print).
 * draw(g, w, h) paints in canvas pixels. Max 1024 on the long side.
 */
export function signMat(key, w, h, draw, { lit = 0, rough = 0.5, metal = 0, transparent = false } = {}) {
  const ck = `${key}|${lit}`;
  if (signCache.has(ck)) return signCache.get(ck);
  const c = document.createElement('canvas');
  c.width = Math.min(1024, w);
  c.height = Math.min(1024, h);
  const g = c.getContext('2d');
  draw(g, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal, transparent, alphaTest: transparent ? 0.4 : 0 });
  if (lit) {
    m.emissiveMap = tex;
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveIntensity = lit;
  }
  m.name = `casino-sign:${key}`;
  signCache.set(ck, m);
  return m;
}

/** Fit a single line of text into maxW by shrinking the font size. Returns the size used. */
export function fitFont(g, text, maxW, size, tpl) {
  let s = size;
  g.font = tpl(s);
  while (s > 8 && g.measureText(text).width > maxW) {
    s -= 2;
    g.font = tpl(s);
  }
  return s;
}

/** Gold-leaf text fill (vertical gradient) for carved / gilded lettering. */
export function goldFill(g, y0, y1) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, '#fff1c2');
  gr.addColorStop(0.35, '#e7c26a');
  gr.addColorStop(0.55, '#b08636');
  gr.addColorStop(0.8, '#f0d48a');
  gr.addColorStop(1, '#8a6224');
  return gr;
}

export { lerp, smoothstep };
