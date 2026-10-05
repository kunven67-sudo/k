// Seeded random numbers. Everything in the galaxy is generated from seeds,
// so the same galaxy comes back every time you load a save.

export function hash32(a, b = 0, c = 0) {
  let h = (a | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = (h + Math.imul(b | 0, 0xc2b2ae35)) | 0;
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  h = (h + Math.imul(c | 0, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

export class RNG {
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }

  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }

  // log-uniform between a and b (both > 0)
  logRange(a, b) { return Math.exp(this.range(Math.log(a), Math.log(b))); }

  normal() {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // power law dN/dx ~ x^-alpha between lo and hi
  powerLaw(lo, hi, alpha) {
    const u = this.next();
    if (Math.abs(alpha - 1) < 1e-6) return lo * Math.pow(hi / lo, u);
    const k = 1 - alpha;
    const a = Math.pow(lo, k), b = Math.pow(hi, k);
    return Math.pow(a + (b - a) * u, 1 / k);
  }

  unitVector(out = { x: 0, y: 0, z: 0 }) {
    const z = this.range(-1, 1);
    const t = this.range(0, Math.PI * 2);
    const r = Math.sqrt(1 - z * z);
    out.x = r * Math.cos(t);
    out.y = z;
    out.z = r * Math.sin(t);
    return out;
  }

  fork(salt) { return new RNG(hash32(this.s, salt)); }
}

// Small 3D value noise for CPU-side generation (galaxy density etc.)
export function valueNoise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const h = (i, j, k) => hash32(xi + i + seed * 1013, yi + j, zi + k) / 4294967296;
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(
    lerp(lerp(h(0, 0, 0), h(1, 0, 0), u), lerp(h(0, 1, 0), h(1, 1, 0), u), v),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), u), lerp(h(0, 1, 1), h(1, 1, 1), u), v),
    w
  );
}

export function fbm3(x, y, z, octaves = 4, seed = 0) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise3(x * f, y * f, z * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}
