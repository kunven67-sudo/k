// Small math helpers shared everywhere.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
// Frame-rate independent exponential smoothing toward a target.
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const TAU = Math.PI * 2;
export const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

// Deterministic integer hash -> [0,1). Same inputs always give the same output (Rule 1: no runtime dice).
export function hash3(x, y, z = 0, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 2147483647 + (seed | 0) * 144665;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Seeded generator for world creation (people, furniture placement). Never used for runtime decisions.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

// Human-readable length: 1.75 m, 3.2 cm, 2.1 mm, 40 um.
export function formatLength(m) {
  const a = Math.abs(m);
  if (a >= 1000) return `${(m / 1000).toFixed(a >= 10000 ? 0 : 1)} km`;
  if (a >= 1) return `${m.toFixed(2)} m`;
  if (a >= 0.01) return `${(m * 100).toFixed(1)} cm`;
  if (a >= 0.001) return `${(m * 1000).toFixed(1)} mm`;
  if (a >= 1e-6) return `${(m * 1e6).toFixed(0)} µm`;
  return `${(m * 1e9).toFixed(0)} nm`;
}

// What you're the size of (real things, section 1 of the master list).
const SIZE_NAMES = [
  [17, 'a 5-story building'], [8, 'a house'], [3.5, 'an elephant'], [2.2, 'a basketball player'],
  [1.4, 'a person'], [0.8, 'a big dog'], [0.4, 'a cat'], [0.18, 'a rat'], [0.08, 'a mouse'],
  [0.035, 'a hamster’s head'], [0.018, 'a grape'], [0.009, 'a bee'], [0.004, 'an ant'],
  [0.0018, 'a flea'], [0.0006, 'a grain of sand'], [0.0002, 'a dust mite'], [0, 'a speck of dust'],
];
export function sizeName(m) {
  for (const [min, name] of SIZE_NAMES) if (m >= min) return name;
  return SIZE_NAMES[SIZE_NAMES.length - 1][1];
}
