// Small helpers used everywhere.
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const TAU = Math.PI * 2;

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Seeded random so a world looks the same every time it loads.
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const r = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  r.range = (a, b) => a + r() * (b - a);
  r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}

export const rand = makeRng((Date.now() ^ 0x5bd1e995) >>> 0);

export function shuffle(arr, r = rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let uid = 1;
export const nextId = () => uid++;
export const bumpId = (n) => { if (n >= uid) uid = n + 1; };

// Value noise for terrain and textures.
export function makeNoise(seed = 7) {
  const r = makeRng(seed);
  const p = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  shuffle(perm, r);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const g = new Float32Array(256);
  for (let i = 0; i < 256; i++) g[i] = r() * 2 - 1;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = g[p[p[X] + Y]], b = g[p[p[X + 1] + Y]];
    const c = g[p[p[X] + Y + 1]], d = g[p[p[X + 1] + Y + 1]];
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  n2.fbm = (x, y, oct = 4) => {
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  };
  return n2;
}

export function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

export function fmtMoney(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e4) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toLocaleString('en-US');
}

export function fmtSize(m) {
  if (m >= 1) return m.toFixed(2) + ' m';
  if (m >= 0.01) return (m * 100).toFixed(1) + ' cm';
  return (m * 1000).toFixed(1) + ' mm';
}

export function sizeCompare(m) {
  if (m > 20) return 'building size';
  if (m > 4) return 'giant';
  if (m > 1.3) return 'normal size';
  if (m > 0.5) return 'kid size';
  if (m > 0.2) return 'cat size';
  if (m > 0.06) return 'mouse size';
  if (m > 0.02) return 'tiny person size';
  if (m > 0.008) return 'beetle size';
  if (m > 0.003) return 'ant size';
  return 'flea size';
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const tmpV = [...Array(12)].map(() => new THREE.Vector3());

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
  });
}
