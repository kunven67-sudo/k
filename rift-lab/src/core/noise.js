// Seeded randomness + noise. Everything in a world comes from its seed,
// so the same seed always rebuilds the exact same world.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash -> [0,1). Stable per (x, y, seed).
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// 2D simplex noise (Gustavson), seeded permutation. Output roughly [-1, 1].
const GRAD2 = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1]);
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class Simplex {
  constructor(seed) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    this.permMod8 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod8[i] = this.perm[i] & 7;
    }
  }

  noise(xin, yin) {
    const perm = this.perm, pm = this.permMod8;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = pm[ii + perm[jj]] * 2; t0 *= t0; n += t0 * t0 * (GRAD2[g] * x0 + GRAD2[g + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = pm[ii + i1 + perm[jj + j1]] * 2; t1 *= t1; n += t1 * t1 * (GRAD2[g] * x1 + GRAD2[g + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = pm[ii + 1 + perm[jj + 1]] * 2; t2 *= t2; n += t2 * t2 * (GRAD2[g] * x2 + GRAD2[g + 1] * y2); }
    return 70 * n;
  }

  fbm(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise(x * freq + o * 17.3, y * freq - o * 9.1);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  // Sharp crests, like real eroded mountain ridges. Output [0, 1].
  ridged(x, y, octaves = 5, lacunarity = 2.1, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0, weight = 1;
    for (let o = 0; o < octaves; o++) {
      let n = 1 - Math.abs(this.noise(x * freq + o * 31.7, y * freq + o * 5.3));
      n *= n;
      n *= weight;
      weight = clamp(n * 1.6, 0, 1);
      sum += amp * n;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

// Tileable (periodic) value noise for seamless textures. period in lattice cells.
export function tileNoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % period) + period) % period;
  const a = hash2(m(xi), m(yi), seed), b = hash2(m(xi + 1), m(yi), seed);
  const c = hash2(m(xi), m(yi + 1), seed), d = hash2(m(xi + 1), m(yi + 1), seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

export function tileFbm(x, y, period, octaves, seed) {
  let amp = 1, sum = 0, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(x * f, y * f, period * f, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
