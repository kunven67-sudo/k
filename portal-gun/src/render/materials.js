import * as THREE from '../three.js';

// Two-and-a-half tone cartoon shading: dark side, soft middle band, fully lit.
let gradient = null;
export function toonGradient() {
  if (!gradient) {
    const data = new Uint8Array([0, 0, 178, 255]);
    gradient = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const toonCache = new Map();
/** Shared cartoon material for a flat color. */
export function toon(color, opts = null) {
  const key = opts ? `${color}|${JSON.stringify(opts)}` : String(color);
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...(opts || {}) });
    toonCache.set(key, m);
  }
  return m;
}

/** A fresh (unshared) toon material, for things that animate their color. */
export function toonUnique(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
}

const glowCache = new Map();
/** Unlit, over-bright material that blooms (portal green, screens, lamps). */
export function glow(color, intensity = 2, opts = null) {
  const key = `${color}|${intensity}|${opts ? JSON.stringify(opts) : ''}`;
  let m = glowCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, fog: false, ...(opts || {}) });
    m.color.multiplyScalar(intensity);
    glowCache.set(key, m);
  }
  return m;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(canvas, { srgb = true, repeat = null, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  if (nearest) t.magFilter = THREE.NearestFilter;
  return t;
}

/** Draws once into a new canvas and returns a texture. */
export function paintTexture(w, h, draw, opts) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  return canvasTexture(c, opts);
}

const texMatCache = new Map();
/** Toon material with a painted texture (cached by key). */
export function toonTex(key, w, h, draw, opts = {}) {
  let m = texMatCache.get(key);
  if (!m) {
    const map = paintTexture(w, h, draw, { repeat: opts.repeat });
    m = new THREE.MeshToonMaterial({ map, gradientMap: toonGradient(), color: opts.color ?? 0xffffff, side: opts.side ?? THREE.FrontSide });
    texMatCache.set(key, m);
  }
  return m;
}

export const COLORS = {
  ink: 0x14161a,
  portal: 0x8ff04a,
  portalDeep: 0x2fb52f,
  portalCore: 0xe8ffc4,
};
