// Hair: a sculpted hair volume (SDF per style: offset scalp + curtains, buns, afro, mohawk…)
// meshed like the head (direction grid from PROJ), with a soft alpha hairline, plus strand
// clumps (ribbons) traced over it along the style's flow for a broken, strand-like silhouette.
// Shading: anisotropic highlights along the flow (tangent attribute), strand texture, root AO.
// Long hair is weighted to spring bones (hair.B / hair.L / hair.R) so it sways.

import * as THREE from 'three';
import { headSDF, smin, PROJ } from './headsdf.js';
import { Rng } from '../core/rng.js';
import { TileNoise } from '../gfx/noise.js';

const { sin, cos, atan2, hypot, abs, max, min, exp, PI, sqrt } = Math;
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
 * 'messy'; clumps: count multiplier; gloss.
 */
export const HAIR_STYLE_DEFS = {
  bald: null,
  buzz: null,
  crew: { t: [0.011, 0.006, 0.006], noise: 0.002, flow: 'back', clumps: 0.6, gloss: 0.4 },
  'side-part': { t: [0.022, 0.009, 0.008], noise: 0.002, flow: 'part', part: 0.03, clumps: 1, gloss: 0.6 },
  messy: { t: [0.026, 0.012, 0.012], noise: 0.009, flow: 'messy', clumps: 1.6, gloss: 0.35 },
  'slick-back': { t: [0.014, 0.007, 0.009], noise: 0.001, flow: 'back', clumps: 0.7, gloss: 1 },
  'curly-short': { t: [0.026, 0.016, 0.014], noise: 0.012, curl: 1, flow: 'messy', clumps: 1.2, gloss: 0.25 },
  afro: { t: [0.04, 0.034, 0.03], afro: 1, noise: 0.014, curl: 1, flow: 'messy', clumps: 0.8, gloss: 0.2 },
  mohawk: { t: [0.004, 0.002, 0.003], mohawk: 1, noise: 0.004, flow: 'up', clumps: 1.2, gloss: 0.5 },
  bob: { t: [0.018, 0.012, 0.014], noise: 0.002, curtain: { bottom: -0.115, faceAz: 50, back: 0.0, wave: 0 }, fringe: 0.035, flow: 'down', clumps: 1.1, gloss: 0.7 },
  'long-straight': { t: [0.016, 0.012, 0.014], noise: 0.002, curtain: { bottom: -0.36, faceAz: 52, back: 0.05, wave: 0 }, fringe: 0.006, flow: 'down', clumps: 1.3, gloss: 0.8 },
  'long-wavy': { t: [0.02, 0.016, 0.018], noise: 0.004, curtain: { bottom: -0.33, faceAz: 50, back: 0.055, wave: 1 }, fringe: 0.004, flow: 'down', clumps: 1.5, gloss: 0.6 },
  ponytail: { t: [0.012, 0.007, 0.008], noise: 0.001, flow: 'back', tail: 1, clumps: 0.6, gloss: 0.8 },
  bun: { t: [0.012, 0.007, 0.008], noise: 0.001, flow: 'back', bun: 1, clumps: 0.6, gloss: 0.7 },
  mullet: { t: [0.016, 0.008, 0.016], noise: 0.004, curtain: { bottom: -0.16, faceAz: 100, back: 0.02, wave: 0.5 }, flow: 'down', clumps: 1.2, gloss: 0.5 },
  receding: { t: [0.01, 0.007, 0.007], noise: 0.002, recede: 0.03, temples: 1, flow: 'back', clumps: 0.6, gloss: 0.4 },
  'comb-over': { t: [0.007, 0.007, 0.007], noise: 0.001, recede: 0.04, temples: 1, flow: 'part', part: 0.07, clumps: 0.5, gloss: 0.7 },
  shag: { t: [0.026, 0.018, 0.02], noise: 0.008, curtain: { bottom: -0.14, faceAz: 55, back: 0.02, wave: 0.6 }, fringe: 0.025, flow: 'messy', clumps: 1.6, gloss: 0.4 },
};

/** Hairline height (unit y on the head) around the head; az = azimuth (0 = front). */
function hairlineY(az, d) {
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
function hairSDF(L, d, head, rng) {
  const [tTop, tSide, tBack] = d.t;
  const cur = d.curtain;
  const partX = d.part || 0;
  return (x, y, z) => {
    const h = head(x, y, z);
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
      t *= 1 + n * 2 * Math.min(0.6, d.noise / Math.max(1e-3, tTop) * 1.6);
    }
    let dd = h - t;
    if (d.afro) {
      // Big round mass above and behind the hairline (cut by a plane leaning back from it).
      const cut = (z - 0.06) * 0.8 - (y - 0.1) * 0.6;
      dd = smin(dd, max(hypot(x * 0.97, (y - 0.075) / 0.92, (z + 0.04) / 1.0) - 0.148, cut), 0.04);
    }
    if (d.mohawk) {
      const ridge = hypot(x * 2.2, max(0, abs(z + 0.01) - 0.08)) + max(0, 0.06 - y) * 0.6 - 0.06 + 0.045;
      dd = smin(h - 0.003, ridge - 0.0 + (h - 0.0) * 0.3, 0.02);
    }
    if (d.bun) dd = smin(dd, hypot(x, y - 0.075, z + 0.125) - 0.048, 0.02);
    if (cur) {
      // Curtain: elliptic column around the head, drifting back as it falls, waved.
      const yy = min(0.06, max(cur.bottom, y));
      const fall = sstep(0.0, cur.bottom, y);
      const cz = -0.015 - cur.back * fall;
      const wav = cur.wave ? sin(y * 55 + atan2(x, z) * 3) * 0.006 * cur.wave * fall : 0;
      const rx = 0.118 + 0.01 * fall + wav;
      const rz = 0.128 + 0.008 * fall + wav;
      const q = hypot(x / rx, (z - cz) / rz);
      let dc = (q - 1) * min(rx, rz);
      dc = max(dc, y - 0.07, cur.bottom - y);
      // Keep the face clear: carve a wedge in front.
      const az = atan2(x, z);
      const clear = (abs(az) - cur.faceAz * D2R) * 0.12;
      dc = max(dc, -clear * (y < 0.05 ? 1 : 0));
      void yy;
      dd = smin(dd, dc, 0.025);
    }
    void rng;
    return dd;
  };
}

function castOut(sdf, dx, dy, dz) {
  let t = 0.42;
  let prev = t;
  let f = sdf(PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t);
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

/** Flow direction (unit space, tangent to the surface) at p with normal n. */
function flowAt(d, p, n, rng) {
  let fx;
  let fy;
  let fz;
  if (d.flow === 'back') {
    fx = 0;
    fy = -0.35;
    fz = -1;
  } else if (d.flow === 'up') {
    fx = 0;
    fy = 1;
    fz = -0.3;
  } else if (d.flow === 'part') {
    const sx = p[0] > (d.part || 0) ? 1 : -1;
    fx = sx;
    fy = -0.6;
    fz = -0.25;
  } else {
    fx = 0;
    fy = -1;
    fz = -0.15;
  }
  if (d.flow === 'messy') {
    fx += NZ.perlin(p[0] * 20 + 3, p[2] * 20 + p[1] * 7, 256) * 1.6;
    fz += NZ.perlin(p[1] * 20 + 9, p[0] * 20, 256) * 1.6;
  }
  // Project onto the tangent plane.
  const dn = fx * n[0] + fy * n[1] + fz * n[2];
  fx -= dn * n[0];
  fy -= dn * n[1];
  fz -= dn * n[2];
  const l = hypot(fx, fy, fz) || 1;
  void rng;
  return [fx / l, fy / l, fz / l];
}

/**
 * Build hair geometry (unit space) for params p & layout L. Returns null for bald/buzz.
 * { pos, nrm, tan, uv, cover, bone weights [hair.B, hair.L, hair.R, hair.T, head], index }
 */
export function buildHair(p, L, tier = 'high') {
  const d = HAIR_STYLE_DEFS[p.hairStyle];
  if (!d) return null;
  const rng = new Rng(p.seed * 17 + 3);
  const head = headSDF(L);
  const vol = 0.75 + 0.5 * p.hairVolume;
  const dd = { ...d, t: d.t.map((v) => v * vol) };
  const sdf = hairSDF(L, dd, head, rng);
  const C = tier === 'low' ? 40 : 64;
  const R = tier === 'low' ? 26 : 44;
  const elTop = 89.6 * D2R;
  const elBot = d.curtain ? -78 * D2R : -40 * D2R;
  const pos = [];
  const nrm = [];
  const tan = [];
  const uv = [];
  const cover = [];
  const wts = [];
  const idx = [];
  const h = 5e-4;
  const vid = (r, c) => r * (C + 1) + c;
  for (let r = 0; r <= R; r++) {
    const tr = r / R;
    const el = elTop + (elBot - elTop) * (tr ** 1.15);
    for (let c = 0; c <= C; c++) {
      const az = -PI + (2 * PI * c) / C;
      const dx = cos(el) * sin(az);
      const dy = sin(el);
      const dz = cos(el) * cos(az);
      const t = castOut(sdf, dx, dy, dz);
      const x = PROJ[0] + dx * t;
      const y = PROJ[1] + dy * t;
      const z = PROJ[2] + dz * t;
      let gx = sdf(x + h, y, z) - sdf(x - h, y, z);
      let gy = sdf(x, y + h, z) - sdf(x, y - h, z);
      let gz = sdf(x, y, z + h) - sdf(x, y, z - h);
      const gl = hypot(gx, gy, gz) || 1;
      gx /= gl;
      gy /= gl;
      gz /= gl;
      // Coverage: above the hairline, or on the curtain (which ends at its bottom).
      // Coverage as a linear field (interpolated per pixel, so edges stay smooth): measured at
      // the scalp point under this hair point, against the hairline.
      const hl = hairlineY(az, d);
      const ts = castOut(head, dx, dy, dz);
      const ys = PROJ[1] + dy * ts;
      let cv = (ys - hl) * 70 + 0.5;
      if (d.mohawk) cv = min(cv, (0.03 - abs(x)) * 120 + 0.5);
      if (d.curtain) {
        const onCurtain = head(x, y, z) > d.t[1] * vol + 0.006;
        const faceClear = (abs(az) - d.curtain.faceAz * D2R) * 6 + 0.5;
        if (onCurtain && ys < hl + 0.02) cv = max(cv, min(faceClear, (y - d.curtain.bottom) * 40 + 0.2));
      }
      cv = max(-5, min(5, cv));
      pos.push(x, y, z);
      nrm.push(gx, gy, gz);
      const f = flowAt(d, [x, y, z], [gx, gy, gz], rng);
      tan.push(f[0], f[1], f[2], 1);
      uv.push(c / C * 6, tr * 3);
      cover.push(cv);
      // Sway weights: lower = more spring.
      const low = sstep(0.0, -0.18, y);
      const sideW = sstep(0.03, 0.09, abs(x)) * low * 0.6;
      const backW = low * (1 - sideW);
      wts.push(backW * 0.9, x > 0 ? sideW : 0, x < 0 ? sideW : 0, sstep(0.06, 0.14, y) * 0.5);
    }
  }
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const a = vid(r, c);
      const b = vid(r, c + 1);
      const e = vid(r + 1, c);
      const f = vid(r + 1, c + 1);
      if (cover[a] < -0.3 && cover[b] < -0.3 && cover[e] < -0.3 && cover[f] < -0.3) continue;
      idx.push(a, e, b, b, e, f);
    }
  }
  // Clumps: ribbons traced along the flow just above the surface.
  const nClumps = Math.round((tier === 'low' ? 40 : 110) * (d.clumps || 1));
  const shellN = pos.length / 3;
  for (let k = 0; k < nClumps; k++) {
    // Random covered start vertex.
    let v0 = -1;
    for (let tries = 0; tries < 12 && v0 < 0; tries++) {
      const v = rng.int(0, shellN - 1);
      if (cover[v] > 1.2) v0 = v;
    }
    if (v0 < 0) continue;
    const len = (d.curtain ? 0.08 : 0.035) * (0.6 + rng.next() * 0.8) * (d.curl ? 0.6 : 1);
    const width = (d.curl ? 0.012 : 0.009) * (0.7 + rng.next() * 0.7);
    const segs = tier === 'low' ? 3 : 5;
    let px = pos[v0 * 3];
    let py = pos[v0 * 3 + 1];
    let pz = pos[v0 * 3 + 2];
    const lift = 0.0015 + rng.next() * (d.flow === 'messy' ? 0.006 : 0.0025);
    const base = pos.length / 3;
    for (let sI = 0; sI <= segs; sI++) {
      const gx0 = sdf(px + h, py, pz) - sdf(px - h, py, pz);
      const gy0 = sdf(px, py + h, pz) - sdf(px, py - h, pz);
      const gz0 = sdf(px, py, pz + h) - sdf(px, py, pz - h);
      const gl0 = hypot(gx0, gy0, gz0) || 1;
      const n = [gx0 / gl0, gy0 / gl0, gz0 / gl0];
      // Snap to the surface + lift (growing toward the tip for messy styles).
      const f0 = sdf(px, py, pz);
      px -= n[0] * f0;
      py -= n[1] * f0;
      pz -= n[2] * f0;
      const tt = sI / segs;
      const lft = lift * (1 + tt * (d.flow === 'messy' ? 2.5 : 1));
      const f = flowAt(d, [px, py, pz], n, rng);
      const side = [f[1] * n[2] - f[2] * n[1], f[2] * n[0] - f[0] * n[2], f[0] * n[1] - f[1] * n[0]];
      const w = width * (1 - tt * 0.85);
      for (const sgn of [-1, 1]) {
        pos.push(px + n[0] * lft + side[0] * w * sgn * 0.5, py + n[1] * lft + side[1] * w * sgn * 0.5, pz + n[2] * lft + side[2] * w * sgn * 0.5);
        nrm.push(n[0], n[1], n[2]);
        tan.push(f[0], f[1], f[2], 1);
        uv.push(sgn > 0 ? 0.2 + (k % 7) * 0.1 : (k % 7) * 0.1, tt * 0.6);
        cover.push(1 - tt * tt * 0.7 + 10.0); // >= 9.5 marks clump verts (tip alpha uses v)
        const low = sstep(0.0, -0.18, py);
        const sideW = sstep(0.03, 0.09, abs(px)) * low * 0.6;
        wts.push(low * (1 - sideW) * 0.9, px > 0 ? sideW : 0, px < 0 ? sideW : 0, sstep(0.06, 0.14, py) * 0.5);
      }
      if (sI < segs) {
        // Curl: rotate the step direction around the normal for curly hair.
        const step = len / segs;
        let fx = f[0];
        let fy = f[1];
        let fz = f[2];
        if (d.curl) {
          const ang = (sI + 1) * 1.4 + k;
          const cs = cos(ang);
          const sn = sin(ang);
          fx = f[0] * cs + side[0] * sn;
          fy = f[1] * cs + side[1] * sn;
          fz = f[2] * cs + side[2] * sn;
        }
        px += fx * step;
        py += fy * step;
        pz += fz * step;
      }
    }
    for (let sI = 0; sI < segs; sI++) {
      const a = base + sI * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  // Ponytail: a tapered tube of clumps from the back of the head.
  if (d.tail) {
    const base0 = [0, 0.01, -0.125];
    const strands = tier === 'low' ? 6 : 12;
    for (let k = 0; k < strands; k++) {
      const segs = 8;
      const a0 = (k / strands) * PI * 2;
      const base = pos.length / 3;
      for (let sI = 0; sI <= segs; sI++) {
        const t = sI / segs;
        const r = 0.018 * (1 - t * 0.7) + 0.004;
        const cx = base0[0] + sin(t * 3) * 0.004;
        const cy = base0[1] - t * 0.2;
        const cz = base0[2] - 0.03 * sin(t * PI * 0.5) - t * 0.02;
        const ox = cos(a0) * r;
        const oz = sin(a0) * r;
        for (const sgn of [-1, 1]) {
          const w = 0.012 * (1 - t * 0.6);
          pos.push(cx + ox + sgn * w * -sin(a0) * 0.5, cy, cz + oz + sgn * w * cos(a0) * 0.5);
          nrm.push(cos(a0), 0, sin(a0));
          tan.push(0, -1, 0, 1);
          uv.push(sgn > 0 ? 0.3 : 0.2, t * 0.95);
          cover.push(1 - t * t * 0.6 + 10.0);
          wts.push(min(1, 0.3 + t), 0, 0, 0);
        }
      }
      for (let sI = 0; sI < segs; sI++) {
        const a = base + sI * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  return {
    pos: Float32Array.from(pos),
    nrm: Float32Array.from(nrm),
    tan: Float32Array.from(tan),
    uv: Float32Array.from(uv),
    cover: Float32Array.from(cover),
    wts: Float32Array.from(wts),
    index: idx,
    gloss: d.gloss ?? 0.5,
    curl: d.curl ? 1 : 0,
  };
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
  for (let x = 0; x < W; x++) cols.push({ b: 0.55 + rng.next() * 0.45, len: 0.75 + rng.next() * 0.25, r: rng.next() });
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const c = cols[x];
      const c2 = cols[(x + 1) % W];
      const b = (c.b * 0.7 + c2.b * 0.3) * (0.85 + 0.15 * sin(v * 40 + c.r * 10));
      const tipA = 1 - sstep(c.len - 0.25, c.len, v);
      const o = (y * W + x) * 4;
      data[o] = b * 255;
      data[o + 1] = c.r * 255;
      data[o + 2] = 0;
      data[o + 3] = tipA * 255;
    }
  }
  strandTex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  strandTex.wrapS = strandTex.wrapT = THREE.RepeatWrapping;
  strandTex.magFilter = THREE.LinearFilter;
  strandTex.minFilter = THREE.LinearMipmapLinearFilter;
  strandTex.generateMipmaps = true;
  strandTex.anisotropy = 8;
  strandTex.needsUpdate = true;
  return strandTex;
}

/** Hair material: anisotropic sheen along the flow, strand albedo, root AO, alpha hairline. */
export function createHairMaterial(color, { tierName = 'high', gloss = 0.5 } = {}) {
  // Brows/beard share the hair colour (greyed per region via aTint from the cards).
  const physical = tierName !== 'low';
  const M = physical
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.68 - gloss * 0.2, metalness: 0, anisotropy: 0.4, sheen: 0.25, sheenRoughness: 0.5, sheenColor: color.clone().multiplyScalar(1.6), side: THREE.DoubleSide, alphaTest: 0.35 })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.35 });
  M.name = 'hair';
  M.alphaToCoverage = true;
  const U = { uStrand: { value: hairStrandTexture() }, uClip: { value: new THREE.Vector4(0, 0, 0, 0) }, uClipR: { value: new THREE.Vector3(1, 1, 1) } };
  M.userData.u = U;
  M.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCover;\nattribute vec2 aHairUV;\nattribute vec3 aTint;\nvarying float vCover;\nvarying vec2 vHairUV;\nvarying vec3 vTint;\nvarying vec3 vBindP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCover = aCover;\nvHairUV = aHairUV;\nvTint = aTint;\nvBindP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uStrand;\nuniform vec4 uClip;\nuniform vec3 uClipR;\nvarying float vCover;\nvarying vec2 vHairUV;\nvarying vec3 vTint;\nvarying vec3 vBindP;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  // Hat clip: hair inside the crown (above the band) is hidden.
  if ( uClip.w > 0.0 ) {
    vec3 q = vBindP - uClip.xyz;
    if ( q.y > 0.0 && ( q.x * q.x ) / ( uClipR.x * uClipR.x ) + ( q.z * q.z ) / ( uClipR.z * uClipR.z ) < 1.0 ) discard;
  }
  vec4 st = texture2D( uStrand, vHairUV * vec2( 1.0, 1.0 ) );
  vec4 st2 = texture2D( uStrand, vHairUV * vec2( 2.3, 0.7 ) + 0.37 );
  float clump = step( 9.5, vCover );
  float cov = clump > 0.5 ? vCover - 10.0 : clamp( vCover, 0.0, 1.0 );
  float bright = mix( st.r, st2.r, 0.4 );
  diffuseColor.rgb *= ( 0.4 + 0.75 * bright * bright ) * vTint;
  // Root darkening on the shell (hair close to the scalp is in shadow).
  diffuseColor.rgb *= mix( 1.0, 0.82, ( 1.0 - clump ) * 0.5 );
  float a = clump > 0.5 ? st.a * smoothstep( 0.0, 0.5, cov ) : smoothstep( 0.0, 1.0, cov * ( 0.6 + 0.8 * st2.r ) * 1.6 );
  diffuseColor.a = a;
}`);
  };
  M.customProgramCacheKey = () => `gamble-hair-${physical ? 'p' : 's'}`;
  return M;
}
