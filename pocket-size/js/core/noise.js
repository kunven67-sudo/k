// Seeded randomness and noise used by procedural textures, terrain and scattering.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function hash3(x, y, z, seed = 0) {
  return hash2(x * 31 + z * 7919, y * 17 + z * 104729, seed);
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

function grad2(ix, iy, seed, dx, dy) {
  const h = hash2(ix, iy, seed) * Math.PI * 2;
  return Math.cos(h) * dx + Math.sin(h) * dy;
}

// Gradient noise in roughly [-1, 1]. With `period` > 0 the lattice wraps so a texture tiles.
export function perlin2(x, y, seed = 0, period = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  let ix0 = x0, iy0 = y0, ix1 = x0 + 1, iy1 = y0 + 1;
  if (period > 0) {
    ix0 = ((ix0 % period) + period) % period; iy0 = ((iy0 % period) + period) % period;
    ix1 = ((ix1 % period) + period) % period; iy1 = ((iy1 % period) + period) % period;
  }
  const u = fade(fx), v = fade(fy);
  const n00 = grad2(ix0, iy0, seed, fx, fy);
  const n10 = grad2(ix1, iy0, seed, fx - 1, fy);
  const n01 = grad2(ix0, iy1, seed, fx, fy - 1);
  const n11 = grad2(ix1, iy1, seed, fx - 1, fy - 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.414;
}

export function fbm2(x, y, { octaves = 5, lacunarity = 2, gain = 0.5, seed = 0, period = 0 } = {}) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin2(x * freq, y * freq, seed + i * 101, period > 0 ? period * freq : 0);
    norm += amp; amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

// Cheap 3D value noise for animation/terrain where tiling doesn't matter.
export function value3(x, y, z, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = fade(x - x0), fy = fade(y - y0), fz = fade(z - z0);
  const c = (i, j, k) => hash3(x0 + i, y0 + j, z0 + k, seed) * 2 - 1;
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), fx), x10 = lerp(c(0, 1, 0), c(1, 1, 0), fx);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), fx), x11 = lerp(c(0, 1, 1), c(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

export function fbm3(x, y, z, octaves = 4, seed = 0) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * value3(x * freq, y * freq, z * freq, seed + i * 57);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

// Worley / cellular noise (distance to nearest feature point), tileable with `period`.
export function worley2(x, y, seed = 0, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      let cx = xi + i, cy = yi + j;
      let hx = cx, hy = cy;
      if (period > 0) { hx = ((cx % period) + period) % period; hy = ((cy % period) + period) % period; }
      const px = cx + hash2(hx, hy, seed), py = cy + hash2(hx, hy, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  }
  return [d1, d2];
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export { lerp };
