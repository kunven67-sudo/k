// Motel-specific PBR material kinds, registered into the shared library (ARCHITECTURE §6).
//   'lot-asphalt'  sun-bleached 1980s parking lot: grey-brown oxidised asphalt, alligator cracking,
//                  shiny black crack-sealant "tar snakes", gravel ravelling, oil shadows.
//   'pool-plaster' marcite plaster of a long-dry pool: chalky white-blue, map cracks, stained
//                  waterline, leaf tannin blotches.
import { registerKind } from '../../gfx/materials.js';
import { clamp, smoothstep, lerp } from '../../core/util.js';

const setRGB = (out, r, g, b) => {
  out.r = r;
  out.g = g;
  out.b = b;
};

registerKind('lot-asphalt', {
  tileMeters: 6,
  defaults: { wear: 0.8, dirt: 0.6 },
  normalStrength: 3,
  build(u, v, out, { N, o }) {
    // Oxidised asphalt goes from black to a warm mid-grey after decades of Nevada sun.
    const base = 0.3 + N.fbm(u, v, { freq: 3, octaves: 4 }) * 0.05;
    const agg = smoothstep(0.3, 0.62, N.perlin(u * 220, v * 220, 220));
    const ravel = smoothstep(0.62, 0.8, N.fbm(u + 3.1, v + 1.7, { freq: 6, octaves: 3 }) * 0.5 + 0.5);
    // Alligator cracking: worley cell edges, only in the worn regions.
    const zone = smoothstep(0.45, 0.7, N.fbm(u + 0.6, v + 0.2, { freq: 2, octaves: 3 }) * 0.5 + 0.5) * o.wear;
    const w = N.worley(u, v, 14);
    const edge = 1 - smoothstep(0.0, 0.06, w.f2 - w.f1);
    const croc = edge * zone;
    // Long structural cracks, many of them sealed with glossy tar.
    const ridge = N.ridged(u + 0.21, v + 0.7, { freq: 2, octaves: 4, gain: 0.5 });
    const crack = smoothstep(0.984, 0.996, ridge);
    const sealed = smoothstep(0.976, 0.984, ridge) * (N.perlin(u * 3, v * 3, 3) > 0.15 ? 1 : 0);
    const oil = smoothstep(0.62, 0.86, N.fbm(u + 0.9, v + 0.3, { freq: 3, octaves: 4 }) * 0.5 + 0.5) * o.dirt;
    let c = base + agg * 0.09 - ravel * 0.05 - oil * 0.1;
    c = lerp(c, 0.1, sealed * 0.7);
    c -= croc * 0.05 + crack * 0.08;
    c = clamp(c, 0.03, 0.6);
    setRGB(out, c * 1.02, c * 0.99, c * 0.95);
    out.h = 0.5 + agg * 0.3 - ravel * 0.2 - croc * 0.25 - crack * 0.3 + sealed * 0.08;
    out.rough = clamp(0.94 - agg * 0.1 - sealed * 0.35 - oil * 0.2, 0.5, 1);
    out.ao = 1 - crack * 0.5 - croc * 0.3;
  },
});

registerKind('pool-plaster', {
  tileMeters: 3,
  defaults: { wear: 0.7, dirt: 0.6 },
  normalStrength: 2,
  build(u, v, out, { N, o }) {
    const n = N.fbm(u, v, { freq: 4, octaves: 5 }) * 0.5 + 0.5;
    // Map cracking (fine polygonal network) and a few bigger cracks.
    const w = N.worley(u, v, 9);
    const map = (1 - smoothstep(0.0, 0.035, w.f2 - w.f1)) * o.wear;
    const big = smoothstep(0.965, 0.99, N.ridged(u + 0.4, v + 0.9, { freq: 2, octaves: 4 }));
    const tannin = smoothstep(0.55, 0.85, N.fbm(u + 2.3, v + 0.4, { freq: 3, octaves: 4 }) * 0.5 + 0.5) * o.dirt;
    const chalk = smoothstep(0.5, 0.9, n);
    let r = 0.72 + chalk * 0.12;
    let g = 0.78 + chalk * 0.1;
    let b = 0.8 + chalk * 0.06;
    // Brown-green tannin stains where leaves rotted, grey where dirt settled.
    r = lerp(r, 0.46, tannin * 0.6);
    g = lerp(g, 0.42, tannin * 0.6);
    b = lerp(b, 0.3, tannin * 0.6);
    const d = map * 0.25 + big * 0.45;
    setRGB(out, r - d, g - d, b - d);
    out.h = 0.5 + n * 0.1 - map * 0.3 - big * 0.6;
    out.rough = 0.88;
    out.ao = 1 - big * 0.5;
  },
});
