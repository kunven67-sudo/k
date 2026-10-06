// Hair: a sculpted hair volume (SDF per style: offset scalp + curtains, buns, afro, mohawk…)
// meshed like the head (direction grid from PROJ), plus "locks" — tapered, slightly rounded
// strips traced along the style's flow that break the silhouette and the hairline the way
// strand groups do.
//
// Shading (createHairMaterial): the shell carries flow-aligned UVs (u = across the strands in
// clump units, v = along them), so the fragment shader can carve clumps (normal tilt + groove
// occlusion + per-clump tint), draw fine strands and stretch the specular along the flow via
// the physical material's anisotropy (tangent = flow). Locks/brows/lashes/beard cards use the
// same material in "card mode" (aCover >= 9.5): aHairUV = (strand coordinate, root->tip t),
// aCover - 10 = position across the card for the soft side fade.
// Long hair is weighted to spring bones (hair.B / hair.L / hair.R / hair.T) so it sways.

import * as THREE from 'three';
import { headSDF, smin, PROJ } from './headsdf.js';
import { Rng } from '../core/rng.js';
import { TileNoise } from '../gfx/noise.js';

const { sin, cos, atan2, hypot, abs, max, min, exp, PI } = Math;
const D2R = PI / 180;
const sstep = (a, b, x) => {
  const t = min(1, max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const NZ = new TileNoise(4242);

/**
 * Style table. t: shell thickness {top, side, back}; noise: bump amplitude; curtain: hanging
 * part {bottom (unit y), faceAz (deg, kept clear around the face), back (z shift), wave};
 * fringe: lowers the front hairline; recede: pushes it back; flow: 'down' | 'back' | 'part' |
 * 'messy' | 'up'; clump: clump width (unit m); locks: lock count multiplier; lift: how far locks
 * stand off; gloss.
 */
export const HAIR_STYLE_DEFS = {
  bald: null,
  buzz: null,
  crew: { t: [0.012, 0.006, 0.006], noise: 0.0015, flow: 'back', clump: 0.009, locks: 0.5, lift: 0.4, gloss: 0.45 },
  'side-part': { t: [0.022, 0.009, 0.008], noise: 0.002, flow: 'part', part: 0.03, clump: 0.012, locks: 0.8, lift: 0.5, gloss: 0.6 },
  messy: { t: [0.026, 0.012, 0.012], noise: 0.007, flow: 'messy', clump: 0.013, locks: 1.3, lift: 1.2, gloss: 0.35 },
  'slick-back': { t: [0.015, 0.007, 0.009], noise: 0.0008, flow: 'back', clump: 0.011, locks: 0.5, lift: 0.2, gloss: 1 },
  'curly-short': { t: [0.026, 0.017, 0.015], noise: 0.009, curl: 1, flow: 'messy', clump: 0.008, locks: 0.9, lift: 0.9, gloss: 0.25 },
  afro: { t: [0.04, 0.034, 0.03], afro: 1, noise: 0.01, curl: 1, flow: 'down', clump: 0.007, locks: 0.35, lift: 0.6, gloss: 0.15 },
  mohawk: { t: [0.0035, 0.002, 0.003], mohawk: 1, noise: 0.002, flow: 'up', clump: 0.008, locks: 1.2, lift: 0.7, gloss: 0.5 },
  bob: { t: [0.018, 0.013, 0.015], noise: 0.0015, curtain: { bottom: -0.115, faceAz: 50, back: 0.0, wave: 0 }, fringe: 0.035, flow: 'down', clump: 0.012, locks: 1.0, lift: 0.4, gloss: 0.7 },
  'long-straight': { t: [0.016, 0.012, 0.014], noise: 0.0015, curtain: { bottom: -0.36, faceAz: 52, back: 0.05, wave: 0 }, fringe: 0.006, flow: 'down', clump: 0.013, locks: 1.2, lift: 0.4, gloss: 0.8 },
  'long-wavy': { t: [0.02, 0.016, 0.018], noise: 0.003, curtain: { bottom: -0.33, faceAz: 50, back: 0.055, wave: 1 }, fringe: 0.004, flow: 'down', clump: 0.015, locks: 1.4, lift: 0.6, gloss: 0.6 },
  ponytail: { t: [0.012, 0.007, 0.008], noise: 0.001, flow: 'back', tail: 1, clump: 0.01, locks: 0.5, lift: 0.3, gloss: 0.8 },
  bun: { t: [0.012, 0.007, 0.008], noise: 0.001, flow: 'back', bun: 1, clump: 0.01, locks: 0.5, lift: 0.3, gloss: 0.7 },
  mullet: { t: [0.016, 0.008, 0.016], noise: 0.003, curtain: { bottom: -0.16, faceAz: 100, back: 0.02, wave: 0.5 }, flow: 'down', clump: 0.012, locks: 1.1, lift: 0.6, gloss: 0.5 },
  receding: { t: [0.01, 0.007, 0.007], noise: 0.0015, recede: 0.03, temples: 1, flow: 'back', clump: 0.009, locks: 0.4, lift: 0.4, gloss: 0.4 },
  'comb-over': { t: [0.007, 0.007, 0.007], noise: 0.001, recede: 0.04, temples: 1, flow: 'part', part: 0.07, clump: 0.01, locks: 0.4, lift: 0.3, gloss: 0.7 },
  shag: { t: [0.026, 0.018, 0.02], noise: 0.006, curtain: { bottom: -0.14, faceAz: 55, back: 0.02, wave: 0.6 }, fringe: 0.025, flow: 'messy', clump: 0.014, locks: 1.4, lift: 1.0, gloss: 0.4 },
};

/** Hairline height (unit y on the head) around the head; az = azimuth (0 = front). */
export function hairlineY(az, d) {
  const a = abs(az) / D2R;
  const k = [[0, 0.098], [28, 0.094], [52, 0.08], [64, 0.02], [72, -0.03], [78, -0.03], [84, 0.03], [104, 0.034], [125, -0.05], [180, -0.085]];
  let y = k[k.length - 1][1];
  for (let i = 0; i < k.length - 1; i++) {
    if (a >= k[i][0] && a <= k[i + 1][0]) {
      const t = (a - k[i][0]) / (k[i + 1][0] - k[i][0]);
      const s = t * t * (3 - 2 * t);
      y = k[i][1] + (k[i + 1][1] - k[i][1]) * s;
      break;
    }
  }
  if (d.fringe && a < 60) y -= d.fringe * (1 - sstep(30, 60, a));
  if (d.recede) y += d.recede * (1 - sstep(10, 70, a)) + (d.temples ? 0.02 * exp(-(((a - 42) / 12) ** 2)) : 0);
  return y;
}

/** Hair volume SDF (unit space) for style d. */
function hairSDF(L, d, head) {
  const [tTop, tSide, tBack] = d.t;
  const cur = d.curtain;
  const partX = d.part || 0;
  return (x, y, z) => {
    const h = head(x, y, z);
    if (d.mohawk) {
      // Shaved sides (thin shell) + a crest along the midline, tallest over the crown.
      const prof = sstep(0.11, 0.05, abs(z + 0.01)) * sstep(-0.06, 0.05, y);
      const crest = max(h - 0.052 * prof, abs(x) - 0.017 - 0.006 * prof);
      return smin(h - tTop, crest, 0.008);
    }
    // Thickness: thicker on top, a sweep of volume away from the part.
    const up = sstep(-0.02, 0.12, y);
    const back = sstep(0.02, -0.1, z);
    let t = tSide + (tTop - tSide) * up;
    t = t + (tBack - t) * back * (1 - up);
    // Thin out toward the hairline so the hair meets the skin instead of ending in a step.
    const hlY = hairlineY(atan2(x, z), d);
    t *= 0.08 + 0.92 * sstep(hlY - 0.004, hlY + 0.04, y);
    if (partX) t += 0.006 * sstep(partX - 0.01, partX - 0.06, x) * up;
    // Bumps scale with the local thickness so they never sink below the scalp.
    if (d.noise) {
      const n = NZ.fbm(x * 3 + 0.5, (y + z) * 3 + 0.5, { freq: d.curl ? 9 : 4, octaves: 2 }) - 0.5;
      t *= 1 + n * 2 * min(0.6, (d.noise / max(1e-3, tTop)) * 1.6);
    }
    let dd = h - t;
    if (d.afro) {
      // Big round mass above and behind the hairline (cut by a plane leaning back from it).
      const cut = (z - 0.06) * 0.8 - (y - 0.1) * 0.6;
      dd = smin(dd, max(hypot(x * 0.97, (y - 0.075) / 0.92, (z + 0.04) / 1.0) - 0.15, cut), 0.04);
    }
    if (d.bun) dd = smin(dd, hypot(x, (y - 0.08) * 1.15, z + 0.128) - 0.046, 0.022);
    if (cur) {
      // Curtain: elliptic column around the head, drifting back as it falls, waved.
      const fall = sstep(0.0, cur.bottom, y);
      const cz = -0.015 - cur.back * fall;
      const wav = cur.wave ? sin(y * 55 + atan2(x, z) * 3) * 0.006 * cur.wave * fall : 0;
      const rx = 0.13 + 0.01 * fall + wav;
      const rz = 0.136 + 0.008 * fall + wav;
      const q = hypot(x / rx, (z - cz) / rz);
      let dc = (q - 1) * min(rx, rz);
      dc = max(dc, y - 0.07, cur.bottom - y);
      // Keep the face clear: carve a wedge in front.
      const az = atan2(x, z);
      const clear = (abs(az) - cur.faceAz * D2R) * 0.12;
      if (y < 0.05) dc = max(dc, -clear);
      dd = smin(dd, dc, 0.025);
    }
    return dd;
  };
}

/** March from far outside toward PROJ; distance from PROJ to the outermost surface. */
function castOut(sdf, dx, dy, dz, t0 = 0.42) {
  let t = t0;
  let f = sdf(PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t);
  while (f <= 0 && t < 0.42) {
    t = min(0.42, t + 0.05);
    f = sdf(PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t);
  }
  let prev = t;
  for (let i = 0; i < 140 && f > 1e-5; i++) {
    prev = t;
    t -= max(f * 0.7, 3e-4);
    if (t <= 0.01) return 0.01;
    f = sdf(PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t);
  }
  let a = t;
  let b = prev;
  for (let i = 0; i < 10; i++) {
    const m = (a + b) * 0.5;
    if (sdf(PROJ[0] + dx * m, PROJ[1] + dy * m, PROJ[2] + dz * m) > 0) b = m;
    else a = m;
  }
  return (a + b) * 0.5;
}

/**
 * Flow-aligned coordinates (u across the strands in clump units, v along them, metres) for a
 * point on the hair. Strands run along iso-u lines toward +v.
 */
function flowUV(d, x, y, z) {
  const w = d.clump;
  switch (d.flow) {
    case 'back': { // front hairline -> nape, over the top (meridians through the z axis)
      const n = Math.round((2 * PI * 0.12) / w);
      return [(atan2(x, y + 0.05) / (2 * PI)) * n, -z];
    }
    case 'part': { // from the part line sideways and down
      const px = d.part || 0;
      return [z / w, abs(atan2(x - px, y + 0.03)) * 0.12];
    }
    case 'up':
      return [z / w, y];
    default: { // 'down' / 'messy': radial from the crown whorl (integer clumps around)
      const n = Math.round((2 * PI * 0.12) / w);
      const az = atan2(x, z + 0.02);
      return [(az / (2 * PI)) * n, atan2(hypot(x, z + 0.02), y - 0.03) * 0.12];
    }
  }
}

/** Surface gradient (normalised) of f at p. */
function grad(f, x, y, z, h = 5e-4) {
  const gx = f(x + h, y, z) - f(x - h, y, z);
  const gy = f(x, y + h, z) - f(x, y - h, z);
  const gz = f(x, y, z + h) - f(x, y, z - h);
  const l = hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}

/** Flow tangent at p (unit, tangent to the surface with normal n): direction of increasing v. */
function flowDir(d, p, n) {
  const h = 1e-3;
  const v0 = flowUV(d, p[0], p[1], p[2])[1];
  let fx = (flowUV(d, p[0] + h, p[1], p[2])[1] - v0) / h;
  let fy = (flowUV(d, p[0], p[1] + h, p[2])[1] - v0) / h;
  let fz = (flowUV(d, p[0], p[1], p[2] + h)[1] - v0) / h;
  if (d.flow === 'messy') {
    fx += NZ.perlin(p[0] * 18 + 3, p[2] * 18 + p[1] * 7, 256) * 1.1;
    fz += NZ.perlin(p[1] * 18 + 9, p[0] * 18, 256) * 1.1;
  }
  const dn = fx * n[0] + fy * n[1] + fz * n[2];
  fx -= dn * n[0];
  fy -= dn * n[1];
  fz -= dn * n[2];
  const l = hypot(fx, fy, fz);
  if (l < 1e-6) return [0, -1, 0];
  return [fx / l, fy / l, fz / l];
}

/** Spring-bone weights [hair.B, hair.L, hair.R, hair.T] for a hair point (lower = swings more). */
function swayWeights(x, y) {
  const low = sstep(0.0, -0.18, y);
  const sideW = sstep(0.03, 0.09, abs(x)) * low * 0.6;
  return [low * (1 - sideW) * 0.9, x > 0 ? sideW : 0, x < 0 ? sideW : 0, sstep(0.06, 0.14, y) * 0.5];
}

/**
 * Build hair geometry (unit space) for params p & layout L. Returns null for bald/buzz.
 * { pos, nrm, tan, uv, cover, wts [hair.B, hair.L, hair.R, hair.T], index, gloss, curl }
 */
export function buildHair(p, L, tier = 'high') {
  const base = HAIR_STYLE_DEFS[p.hairStyle];
  if (!base) return null;
  const rng = new Rng(p.seed * 17 + 3);
  const head = headSDF(L);
  const vol = 0.75 + 0.5 * p.hairVolume;
  const d = { ...base, t: base.t.map((v) => v * vol) };
  const sdf = hairSDF(L, d, head);
  const low = tier === 'low';
  const C = low ? 40 : 72;
  const R = low ? 26 : 48;
  const elTop = 89.6 * D2R;
  const elBot = d.curtain ? -78 * D2R : -40 * D2R;
  const out = { pos: [], nrm: [], tan: [], uv: [], cover: [], wts: [], index: [] };
  const push = (P, N, T, U, cv, W) => {
    out.pos.push(P[0], P[1], P[2]);
    out.nrm.push(N[0], N[1], N[2]);
    out.tan.push(T[0], T[1], T[2], 1);
    out.uv.push(U[0], U[1]);
    out.cover.push(cv);
    out.wts.push(W[0], W[1], W[2], W[3]);
    return out.pos.length / 3 - 1;
  };
  // Coverage: a linear field (so edges interpolate smoothly) measured at the scalp point under
  // each hair point against the hairline; curtains stay covered down to their bottom edge.
  const coverAt = (x, y, z, dx, dy, dz, tScalp) => {
    const az = atan2(dx, dz);
    const ys = PROJ[1] + dy * tScalp;
    let cv = (ys - hairlineY(az, d)) * 70 + 0.5;
    if (d.mohawk) cv = min(cv, (0.026 - abs(x)) * 140 + 0.5);
    if (d.curtain) {
      const onCurtain = head(x, y, z) > d.t[1] + 0.006;
      const faceClear = (abs(az) - d.curtain.faceAz * D2R) * 6 + 0.5;
      if (onCurtain && ys < hairlineY(az, d) + 0.02) cv = max(cv, min(faceClear, (y - d.curtain.bottom) * 40 + 0.2));
    }
    return max(-5, min(5, cv));
  };
  // ---- shell
  const vid = (r, c) => r * (C + 1) + c;
  let tPrevRow = new Float32Array(C + 1).fill(0.42);
  let tRow = new Float32Array(C + 1);
  for (let r = 0; r <= R; r++) {
    if (r > 0) [tPrevRow, tRow] = [tRow, tPrevRow];
    const el = elTop + (elBot - elTop) * (r / R) ** 1.15;
    for (let c = 0; c <= C; c++) {
      const az = -PI + (2 * PI * c) / C;
      const dx = cos(el) * sin(az);
      const dy = sin(el);
      const dz = cos(el) * cos(az);
      const t0 = min(0.42, max(c > 0 ? tRow[c - 1] : 0.42, r > 0 ? tPrevRow[c] : 0.42) + 0.06);
      const t = castOut(sdf, dx, dy, dz, t0);
      tRow[c] = t;
      const P = [PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t];
      const N = grad(sdf, P[0], P[1], P[2]);
      const cv = coverAt(P[0], P[1], P[2], dx, dy, dz, castOut(head, dx, dy, dz, t + 0.01));
      push(P, N, flowDir(d, P, N), flowUV(d, P[0], P[1], P[2]), cv, swayWeights(P[0], P[1]));
    }
  }
  // Seam-safe faces: skip quads that straddle a u wrap (crown-radial flow wraps at the back).
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const a = vid(r, c);
      const b = vid(r, c + 1);
      const e = vid(r + 1, c);
      const f = vid(r + 1, c + 1);
      if (out.cover[a] < -0.3 && out.cover[b] < -0.3 && out.cover[e] < -0.3 && out.cover[f] < -0.3) continue;
      out.index.push(a, e, b, b, e, f);
    }
  }
  const shellN = out.pos.length / 3;
  // ---- locks
  const nLocks = Math.round((low ? 26 : 120) * (d.locks || 1));
  const segs = low ? 3 : 6;
  const across = low ? 2 : 3;
  for (let k = 0; k < nLocks; k++) {
    let v0 = -1;
    for (let tries = 0; tries < 16 && v0 < 0; tries++) {
      const v = rng.int(0, shellN - 1);
      if (out.cover[v] > 1.3) v0 = v;
    }
    if (v0 < 0) continue;
    const longH = d.curtain ? -d.curtain.bottom : 0;
    const len = (d.curtain ? 0.05 + longH * 0.35 : d.flow === 'up' ? 0.05 : 0.03) * (0.6 + rng.next() * 0.8) * (d.curl ? 0.55 : 1);
    const width = d.clump * (0.9 + rng.next() * 0.8);
    const lift0 = 0.0006 + rng.next() * 0.0012 * d.lift;
    const liftTip = 0.002 * d.lift * rng.next();
    let px = out.pos[v0 * 3];
    let py = out.pos[v0 * 3 + 1];
    let pz = out.pos[v0 * 3 + 2];
    const tex = rng.next() * 7;
    const first = out.pos.length / 3;
    let free = false; // past the end of the surface: hang under gravity
    let fPrev = null;
    for (let sI = 0; sI <= segs; sI++) {
      const tt = sI / segs;
      let n;
      let f;
      if (!free) {
        const g = grad(sdf, px, py, pz);
        const f0 = sdf(px, py, pz);
        px -= g[0] * f0;
        py -= g[1] * f0;
        pz -= g[2] * f0;
        n = g;
        f = flowDir(d, [px, py, pz], n);
        // Curtain hair continues past the bottom edge instead of wrapping under it.
        if (d.curtain && py < d.curtain.bottom + 0.01 && f[1] > -0.5) free = true;
      }
      if (free) {
        n = fPrev ? fPrev.n : [0, 0, -1];
        f = [0, -1, 0];
      }
      if (d.curl) {
        const ang = sin((sI + 1) * 1.7 + k) * 0.9;
        const sd = [n[1] * f[2] - n[2] * f[1], n[2] * f[0] - n[0] * f[2], n[0] * f[1] - n[1] * f[0]];
        f = [f[0] * cos(ang) + sd[0] * sin(ang), f[1] * cos(ang) + sd[1] * sin(ang), f[2] * cos(ang) + sd[2] * sin(ang)];
      }
      const side = [f[1] * n[2] - f[2] * n[1], f[2] * n[0] - f[0] * n[2], f[0] * n[1] - f[1] * n[0]];
      const w = width * (1 - tt * tt * 0.75);
      const lift = lift0 + liftTip * tt * tt;
      const W = swayWeights(px, py);
      for (let a = 0; a < across; a++) {
        const s = a / (across - 1);
        const o = (s - 0.5) * w;
        const bulge = across > 2 ? (1 - (2 * s - 1) ** 2) * w * 0.18 : 0;
        const P = [px + n[0] * (lift + bulge) + side[0] * o, py + n[1] * (lift + bulge) + side[1] * o, pz + n[2] * (lift + bulge) + side[2] * o];
        // Rounded lock: side normals lean outwards.
        const tl = (s - 0.5) * 1.1;
        const N = [n[0] + side[0] * tl, n[1] + side[1] * tl, n[2] + side[2] * tl];
        const nl = hypot(N[0], N[1], N[2]) || 1;
        push(P, [N[0] / nl, N[1] / nl, N[2] / nl], f, [tex + s * 0.09, tt], 10 + s, W);
      }
      fPrev = { n };
      if (sI < segs) {
        const step = len / segs;
        px += f[0] * step;
        py += f[1] * step;
        pz += f[2] * step;
      }
    }
    for (let sI = 0; sI < segs; sI++) {
      for (let a = 0; a < across - 1; a++) {
        const i0 = first + sI * across + a;
        const i1 = i0 + across;
        out.index.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
      }
    }
  }
  // ---- ponytail: a bundle of rounded locks falling from the back of the head
  if (d.tail) addPonytail(out, push, low, rng);
  return {
    pos: Float32Array.from(out.pos),
    nrm: Float32Array.from(out.nrm),
    tan: Float32Array.from(out.tan),
    uv: Float32Array.from(out.uv),
    cover: Float32Array.from(out.cover),
    wts: Float32Array.from(out.wts),
    index: out.index,
    gloss: d.gloss ?? 0.5,
    curl: d.curl ? 1 : 0,
  };
}

function addPonytail(out, push, low, rng) {
  const strands = low ? 6 : 14;
  const segs = 9;
  for (let k = 0; k < strands; k++) {
    const a0 = (k / strands) * PI * 2 + rng.next() * 0.3;
    const first = out.pos.length / 3;
    const tex = rng.next() * 7;
    for (let sI = 0; sI <= segs; sI++) {
      const t = sI / segs;
      // Gathered at the tie, fanning slightly then tapering to the tips.
      const r = 0.012 + 0.012 * sin(min(1, t * 1.6) * PI * 0.5) * (1 - t * 0.6);
      const cx = sin(t * 3) * 0.004;
      const cy = 0.012 - t * 0.21;
      const cz = -0.132 - 0.035 * sin(t * PI * 0.5) - t * 0.012;
      const ox = cos(a0) * r;
      const oz = sin(a0) * r * 0.8;
      const w = 0.016 * (1 - t * 0.7);
      for (let s = 0; s <= 1; s++) {
        const sg = s * 2 - 1;
        push([cx + ox - sg * w * sin(a0) * 0.5, cy, cz + oz + sg * w * cos(a0) * 0.5], [cos(a0), 0, sin(a0)], [0, -1, 0], [tex + s * 0.09, t * 0.97], 10 + s, [min(1, 0.3 + t), 0, 0, 0]);
      }
    }
    for (let sI = 0; sI < segs; sI++) {
      const i0 = first + sI * 2;
      out.index.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
    }
  }
}

let strandTex = null;
/** Strand texture: R brightness (strands), G per-strand random, A alpha with ragged tips. */
export function hairStrandTexture() {
  if (strandTex) return strandTex;
  const W = 256;
  const H = 256;
  const data = new Uint8Array(W * H * 4);
  const rng = new Rng(99);
  const cols = [];
  for (let x = 0; x < W; x++) cols.push({ b: 0.55 + rng.next() * 0.45, len: 0.72 + rng.next() * 0.28, r: rng.next() });
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const c = cols[x];
      const c2 = cols[(x + 1) % W];
      const b = (c.b * 0.7 + c2.b * 0.3) * (0.88 + 0.12 * sin(v * 40 + c.r * 10));
      const tipA = 1 - sstep(c.len - 0.22, c.len, v);
      const o = (y * W + x) * 4;
      data[o] = b * 255;
      data[o + 1] = c.r * 255;
      data[o + 2] = 0;
      data[o + 3] = tipA * 255;
    }
  }
  strandTex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  strandTex.wrapS = THREE.RepeatWrapping;
  strandTex.wrapT = THREE.ClampToEdgeWrapping;
  strandTex.magFilter = THREE.LinearFilter;
  strandTex.minFilter = THREE.LinearMipmapLinearFilter;
  strandTex.generateMipmaps = true;
  strandTex.anisotropy = 8;
  strandTex.needsUpdate = true;
  return strandTex;
}

/** Hair material: clumped shell + strand cards, anisotropic highlight along the flow. */
export function createHairMaterial(color, { tierName = 'high', gloss = 0.5, curl = 0 } = {}) {
  const physical = tierName !== 'low';
  const M = physical
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.5 - gloss * 0.2, metalness: 0, anisotropy: 0.7, specularIntensity: 0.5, envMapIntensity: 0.45, side: THREE.DoubleSide, alphaTest: 0.4 })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.4 });
  M.name = 'hair';
  M.alphaToCoverage = true;
  const U = {
    uStrand: { value: hairStrandTexture() },
    uClip: { value: new THREE.Vector4(0, 0, 0, 0) },
    uClipR: { value: new THREE.Vector3(1, 1, 1) },
    uCurl: { value: curl },
  };
  M.userData.u = U;
  M.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCover;\nattribute vec2 aHairUV;\nattribute vec3 aTint;\nvarying float vCover;\nvarying vec2 vHairUV;\nvarying vec3 vTint;\nvarying vec3 vBindP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCover = aCover;\nvHairUV = aHairUV;\nvTint = aTint;\nvBindP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uStrand;
uniform vec4 uClip;
uniform vec3 uClipR;
uniform float uCurl;
varying float vCover;
varying vec2 vHairUV;
varying vec3 vTint;
varying vec3 vBindP;
float hClumpTilt = 0.0;
float hHash( float n ) { return fract( sin( n * 91.345 ) * 47453.5453 ); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  // Hat clip: hair inside the crown (above the band) is hidden.
  if ( uClip.w > 0.0 ) {
    vec3 q = vBindP - uClip.xyz;
    if ( q.y > 0.0 && ( q.x * q.x ) / ( uClipR.x * uClipR.x ) + ( q.z * q.z ) / ( uClipR.z * uClipR.z ) < 1.0 ) discard;
  }
  float a;
  if ( vCover > 11.5 ) {
    // Lashes: individual strands with gaps, tapering to the tips.
    vec4 st = texture2D( uStrand, vec2( vHairUV.x, vHairUV.y * 0.9 ) );
    a = st.a * smoothstep( 0.72, 0.86, st.r + 0.12 * ( 1.0 - vHairUV.y ) );
    diffuseColor.rgb *= vTint;
  } else if ( vCover > 9.5 ) {
    // Card: strands across, ragged tips along, soft sides.
    float s = vCover - 10.0;
    vec4 st = texture2D( uStrand, vec2( vHairUV.x, vHairUV.y * 0.98 ) );
    float sideF = smoothstep( 0.0, 0.3, s ) * smoothstep( 1.0, 0.7, s );
    a = st.a * clamp( sideF * 1.4 + ( st.r - 0.6 ), 0.0, 1.0 );
    diffuseColor.rgb *= ( 0.55 + 0.6 * st.r ) * vTint * mix( 0.78, 1.0, smoothstep( 0.0, 0.35, vHairUV.y ) );
    hClumpTilt = ( s - 0.5 ) * 0.6;
  } else {
    // Shell: clumps across the flow (wobbling along it), grooves, fine strands.
    float wob = sin( vHairUV.y * ( 38.0 + 60.0 * uCurl ) + floor( vHairUV.x ) * 1.7 ) * ( 0.12 + 0.25 * uCurl );
    float cx = vHairUV.x + wob;
    float id = floor( cx );
    float f = fract( cx );
    float rnd = hHash( id );
    hClumpTilt = ( f - 0.5 ) * 1.6;
    float groove = smoothstep( 0.0, 0.22, f ) * smoothstep( 1.0, 0.78, f );
    vec4 st = texture2D( uStrand, vec2( vHairUV.x * 0.13 + rnd, vHairUV.y * 1.7 ) );
    vec4 st2 = texture2D( uStrand, vec2( vHairUV.x * 0.071 + 0.37, vHairUV.y * 0.6 ) );
    diffuseColor.rgb *= ( 0.62 + 0.5 * st.r * st.r ) * ( 0.62 + 0.38 * groove ) * ( 0.9 + 0.2 * rnd ) * vTint;
    float cov = vCover;
    float fuzz = ( st.r - 0.55 ) * 0.9 + ( st2.r - 0.5 ) * 0.5;
    a = smoothstep( 0.1, 0.9, cov + fuzz * ( 1.0 - smoothstep( 0.9, 1.8, cov ) ) );
  }
  diffuseColor.a = a;
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef USE_TANGENT
  normal = normalize( normal + normalize( vBitangent ) * hClumpTilt * 0.45 );
#endif`);
  };
  M.customProgramCacheKey = () => `gamble-hair2-${physical ? 'p' : 's'}`;
  return M;
}
