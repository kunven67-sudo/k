// Weighted picks with luck + golden spins. Pure logic (no three.js) so it can be tested in node.

export function makeRng(seed) {
  // mulberry32, seeded from crypto when no seed
  let s = seed >>> 0 || (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// slices: [{label, w, ...}] ; tiered = slices are ordered weak->strong ; luck -1..1.2
export function luckWeights(slices, tiered, luck) {
  const n = slices.length;
  return slices.map((s, i) => {
    let w = Math.max(0, s.w);
    if (tiered && luck && n > 1) w *= Math.exp(luck * 1.6 * (i / (n - 1) - 0.5));
    return w;
  });
}

export function pick(rng, weights) {
  let total = 0;
  for (const w of weights) total += w;
  if (!(total > 0)) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

// Golden wheel = only the top quarter of a tiered wheel (at least 3 slices)
export function goldenSlices(slices) {
  const k = Math.max(3, Math.ceil(slices.length / 4));
  return slices.slice(slices.length - k);
}

export function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
