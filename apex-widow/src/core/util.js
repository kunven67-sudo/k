import * as THREE from 'three';
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// frame-rate independent smoothing: k = how fast (1/s)
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const dampV = (v, target, k, dt) => v.lerp(target, 1 - Math.exp(-k * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

// seeded RNG (mulberry32) for repeatable worlds
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

// value noise helpers (CPU)
export function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

// nice size text: 4 mm, 12 cm, 3.4 m, 120 km, 0.4 AU, 12 ly, 3.2 Mly, 41 Gly
export function sizeText(m) {
  const AU = 1.496e11, LY = 9.4607e15;
  if (m < 0.01) return (m * 1000).toFixed(1) + ' mm';
  if (m < 1) return (m * 100).toFixed(m < 0.1 ? 1 : 0) + ' cm';
  if (m < 1000) return m.toFixed(m < 10 ? 1 : 0) + ' m';
  if (m < 1e8) return (m / 1000).toFixed(m < 1e4 ? 1 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' km';
  if (m < 0.05 * LY) return (m / AU).toFixed(m < 10 * AU ? 2 : 0) + ' AU';
  if (m < 1e6 * LY) return (m / LY).toFixed(m < 10 * LY ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' light years';
  if (m < 1e9 * LY) return (m / LY / 1e6).toFixed(1) + ' million light years';
  return (m / LY / 1e9).toFixed(1) + ' billion light years';
}

// "as big as a ___" (real things, smallest first)
const AS_BIG = [
  [0.002, 'a grain of rice'], [0.006, 'a fruit fly'], [0.012, 'a fingernail'], [0.025, 'a coin'], [0.05, 'a golf ball'],
  [0.09, 'a mouse'], [0.15, 'a phone'], [0.25, 'a rat'], [0.45, 'a cat'], [0.8, 'a big dog'], [1.8, 'a person'],
  [4.5, 'a car'], [12, 'a bus'], [25, 'a house'], [60, 'a whale'], [150, 'a city block'], [450, 'a skyscraper'],
  [1500, 'a mountain'], [8000, 'Mount Everest'], [50e3, 'a city'], [400e3, 'a country'], [3.4e6, 'the Moon'],
  [12.7e6, 'the Earth'], [140e6, 'Jupiter'], [1.4e9, 'the Sun'], [3e11, "Earth's orbit"], [9e12, 'the solar system'],
  [9.5e15, 'a light year'], [4e16, 'the trip to the next star'], [1e20, 'a star cluster'], [9.5e20, 'the Milky Way'],
  [2.4e22, 'the Local Group'], [1e24, 'a supercluster'], [8.8e26, 'the observable universe'], [1e30, 'a whole universe'],
];
export function asBig(m) { let t = AS_BIG[0][1]; for (const [s, n] of AS_BIG) if (m >= s * 0.8) t = n; return t; }

export const tmpV = () => new THREE.Vector3();
