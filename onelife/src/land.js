// The endless land: height at any point, at any size (from hills down to the surface of a sand grain).
import { makeNoise } from './noise.js';

export function makeLand(seed) {
  const A = makeNoise(seed), B = makeNoise(seed + 101), C = makeNoise(seed + 977);
  // big shape of the land (meters)
  function base(x, z) {
    let h = 0, a = 24, f = 1 / 560;
    for (let o = 0; o < 5; o++) { h += A.n2(x * f + o * 13.1, z * f - o * 7.7) * a; a *= 0.46; f *= 2.07; }
    const ridge = 1 - Math.abs(B.n2(x / 950 + 31.3, z / 950 - 17.9));
    const rocky = Math.max(0, B.n2(x / 1700 - 5.1, z / 1700 + 2.2) + 0.15);
    h += Math.pow(Math.max(0, ridge - 0.5) / 0.5, 2.2) * 34 * rocky;
    return h;
  }
  // small bumps, from 6 m down to `minWave` (the finer you look, the more of them)
  function detail(x, z, minWave) {
    let h = 0, w = 6, amp = 0.2, o = 0;
    while (w > minWave && o < 34) { h += C.n2(x / w + o * 3.71, z / w - o * 9.13) * amp; w *= 0.5; amp *= 0.47; o++; }
    return h;
  }
  const height = (x, z, minWave = 0.5) => base(x, z) + detail(x, z, minWave);
  // how rocky / how much bare dirt (0..1) - for ground textures + where rocks show up
  function cover(x, z) {
    const r = 1 - Math.abs(B.n2(x / 950 + 31.3, z / 950 - 17.9));
    const rocky = Math.max(0, B.n2(x / 1700 - 5.1, z / 1700 + 2.2) + 0.15);
    const rock = Math.min(1, Math.max(0, (r - 0.62) * 3.2) * Math.min(1, rocky * 2.2));
    const dirt = Math.min(1, Math.max(0, A.n2(x / 140 + 77, z / 140 - 41) * 1.6 - 0.35 + C.n2(x / 23, z / 23) * 0.35));
    return [rock, dirt];
  }
  return { height, base, detail, cover };
}
