// Tileable procedural noise for texture generation. All functions take a `period` so the result
// wraps seamlessly — every generated texture tiles without visible seams.

import { Rng } from '../core/rng.js';

export class TileNoise {
  constructor(seed = 1) {
    const rng = new Rng(seed);
    this.perm = new Uint16Array(512);
    const p = [];
    for (let i = 0; i < 256; i++) p.push(i);
    rng.shuffle(p);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    this.grad = new Float32Array(256 * 2);
    for (let i = 0; i < 256; i++) {
      const a = rng.next() * Math.PI * 2;
      this.grad[i * 2] = Math.cos(a);
      this.grad[i * 2 + 1] = Math.sin(a);
    }
  }

  _g(ix, iy, period) {
    const x = ((ix % period) + period) % period;
    const y = ((iy % period) + period) % period;
    const h = this.perm[(this.perm[x & 255] + y) & 511] & 255;
    return h;
  }

  // Periodic gradient (Perlin) noise in [-1, 1]. x, y in lattice units; wraps every `period`.
  perlin(x, y, period = 256) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const dot = (ix, iy, dx, dy) => {
      const h = this._g(ix, iy, period);
      return this.grad[h * 2] * dx + this.grad[h * 2 + 1] * dy;
    };
    const n00 = dot(x0, y0, fx, fy);
    const n10 = dot(x0 + 1, y0, fx - 1, fy);
    const n01 = dot(x0, y0 + 1, fx, fy - 1);
    const n11 = dot(x0 + 1, y0 + 1, fx - 1, fy - 1);
    const nx0 = n00 + (n10 - n00) * u;
    const nx1 = n01 + (n11 - n01) * u;
    return (nx0 + (nx1 - nx0) * v) * 1.414;
  }

  // Fractal Brownian motion over a unit square [0,1)² tiled at base frequency `freq` (integer).
  fbm(u, v, { freq = 4, octaves = 5, gain = 0.5, lacunarity = 2 } = {}) {
    let amp = 1;
    let f = freq;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.perlin(u * f, v * f, f);
      norm += amp;
      amp *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  }

  ridged(u, v, opts = {}) {
    const n = this.fbm(u, v, opts);
    return 1 - Math.abs(n);
  }

  // Tileable Worley/cellular noise: returns { f1, f2, id } distances in cell units.
  worley(u, v, cells = 8) {
    const x = u * cells;
    const y = v * cells;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let f1 = 9;
    let f2 = 9;
    let id = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = xi + ox;
        const cy = yi + oy;
        const h = this._g(cx, cy, cells);
        const h2 = this.perm[(h + 77) & 511];
        const px = cx + (h / 255) * 0.9 + 0.05;
        const py = cy + (h2 / 255) * 0.9 + 0.05;
        const d = Math.hypot(px - x, py - y);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = h;
        } else if (d < f2) f2 = d;
      }
    }
    return { f1, f2, id };
  }
}

export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
