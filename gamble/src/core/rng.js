// Seeded PRNG (mulberry32) + helpers. Gameplay randomness that must be reproducible
// (world generation, NPC personalities) uses a seeded Rng. Casino games use the
// cryptographically-strong `fairRandom()` so outcomes cannot be predicted from the seed.

export class Rng {
  constructor(seed = 1) {
    this.seed(seed);
  }

  seed(seed) {
    if (typeof seed === 'string') seed = hashString(seed);
    this._s = seed >>> 0 || 0x9e3779b9;
  }

  next() {
    let t = (this._s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p) {
    return this.next() < p;
  }

  // Normal distribution (Box–Muller).
  gaussian(mean = 0, sd = 1) {
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  weighted(entries) {
    // entries: [[value, weight], ...]
    const total = entries.reduce((s, e) => s + e[1], 0);
    let r = this.next() * total;
    for (const [value, w] of entries) {
      if ((r -= w) <= 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Unbiased random float in [0,1) from the platform CSPRNG — used for every gambling outcome.
export function fairRandom() {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  // 53 bits of randomness.
  return (buf[0] * 2 ** 21 + (buf[1] >>> 11)) / 2 ** 53;
}

export function fairInt(minInclusive, maxInclusive) {
  const range = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(fairRandom() * range);
}

export function fairShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(fairRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const globalRng = new Rng(Date.now() >>> 0);
