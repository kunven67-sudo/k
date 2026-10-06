// Face hair cards: eyebrows (layered tapered strips on the brow bones), eyelashes (fans along
// the upper/lower lid margins on the lid bones) and facial hair (a shell grown from the head
// surface with a per-style density mask: mustache, goatee, full, long, chin-strap…).
// Output uses the hair vertex format so it shares the hair mesh/material (one draw call).

import { headSDF, faceBonePositions, PROJ, eyeOpening } from './headsdf.js';
import { eyeDir, almondTable } from './eyelids.js';
import { Rng } from '../core/rng.js';

const { sin, cos, atan2, hypot, abs, max, min, exp, PI } = Math;
const D2R = PI / 180;
const sstep = (a, b, x) => {
  const t = min(1, max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Accumulator in hair format; bones = array of [name, weight] pairs per vertex. */
export class CardSet {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.tan = [];
    this.uv = [];
    this.cover = [];
    this.tint = [];
    this.bones = [];
    this.index = [];
  }
  get nv() {
    return this.pos.length / 3;
  }
  v(p, n, t, uv, cover, tint, bones) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.tan.push(t[0], t[1], t[2], 1);
    this.uv.push(uv[0], uv[1]);
    this.cover.push(cover);
    this.tint.push(tint[0], tint[1], tint[2]);
    this.bones.push(bones);
    return this.nv - 1;
  }
}

function gradient(sdf, x, y, z) {
  const h = 4e-4;
  const gx = sdf(x + h, y, z) - sdf(x - h, y, z);
  const gy = sdf(x, y + h, z) - sdf(x, y - h, z);
  const gz = sdf(x, y, z + h) - sdf(x, y, z - h);
  const l = hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}

function castFromProj(sdf, dx, dy, dz) {
  let t = 0.3;
  let prev = t;
  let f = sdf(PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t);
  for (let i = 0; i < 120 && f > 1e-5; i++) {
    prev = t;
    t -= max(f * 0.7, 2e-4);
    if (t < 0.005) return 0.005;
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

/** Surface point in front of (x, y) (march along -z). */
function frontPoint(sdf, x, y) {
  let z = 0.2;
  for (let i = 0; i < 100; i++) {
    const d = sdf(x, y, z);
    if (d < 1e-4) break;
    z -= max(d * 0.8, 1.5e-4);
  }
  return [x, y, z];
}

export function buildFaceCards(p, L, tier = 'high', colors = null) {
  const cs = new CardSet();
  const sdf = headSDF(L);
  const rng = new Rng(p.seed * 7 + 11);
  const FB = faceBonePositions(L);
  // Brow/beard colours are tints relative to the hair colour (one shared material).
  const ratio = (c) => (colors && c ? ['r', 'g', 'b'].map((k) => min(4, max(0.15, c[k] / max(0.01, colors.hair[k])))) : [1, 1, 1]);
  const browTint = ratio(colors && colors.brow);
  const beardTint = ratio(colors && colors.beard);
  addBrows(cs, p, L, sdf, tier, rng, browTint);
  // ---- eyelashes (upper: long, curled; lower: short)
  for (const e of L.eyes) {
    const S = e.side > 0 ? 'L' : 'R';
    const T = almondTable(L, e, 64);
    for (const upper of [true, false]) {
      const segs = tier === 'low' ? 8 : 16;
      const base = cs.nv;
      const len = (upper ? 0.0065 : 0.0032) * (0.85 + 0.3 * (p.eyeSize ?? 0.5));
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        // Margin angle psi: upper arc 15..165 deg, lower 195..345 deg.
        const psi = (upper ? 12 + t * 156 : 192 + t * 156) * D2R;
        const f = (psi / (PI * 2)) * T.n;
        const i0 = Math.floor(f) % T.n;
        const rb = T.rho[i0] + (T.rho[(i0 + 1) % T.n] - T.rho[i0]) * (f - Math.floor(f));
        const h = cos(psi) * rb;
        const v = T.vc + sin(psi) * rb;
        const d = eyeDir(e, h, v);
        const r0 = L.eyeR + L.lidT * 0.55;
        const root = [e.c[0] + d[0] * r0, e.c[1] + d[1] * r0, e.c[2] + d[2] * r0];
        // Lashes sweep outward from the margin and curl up (down for the lower lid).
        const out = [d[0], d[1] + (upper ? 1.1 : -0.7), d[2] + 0.35];
        const ol = hypot(out[0], out[1], out[2]);
        const edge = sstep(0, 0.2, t) * sstep(1, 0.75, t);
        const L2 = len * (0.35 + 0.65 * edge) * (upper ? 1 + 0.25 * t * (e.side > 0 ? 1 : 1) : 1);
        const tip = [root[0] + (out[0] / ol) * L2, root[1] + (out[1] / ol) * L2, root[2] + (out[2] / ol) * L2];
        const n = [d[0], d[1], d[2]];
        const bone = [[upper ? `lidU.${S}` : `lidD.${S}`, 1]];
        const dark = [0.3 * browTint[0], 0.3 * browTint[1], 0.3 * browTint[2]];
        // Card mode: strands along the lid (u), root -> tip (v); no side fade (cover 10.5).
        // Lash mode (cover 12): separate strands, ~45 per lid.
        cs.v(root, n, out, [t * 0.18 + (upper ? 0 : 0.5), 0.0], 12, dark, bone);
        cs.v(tip, n, out, [t * 0.18 + (upper ? 0 : 0.5), 0.97], 12, dark, bone);
      }
      for (let i = 0; i < segs; i++) {
        const a = base + i * 2;
        cs.index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  // ---- facial hair shell
  const style = p.facialHair;
  if (style && style !== 'none' && style !== 'stubble') addBeard(cs, p, L, sdf, FB, style, tier, rng, beardTint);
  return cs;
}

/** Beard density (0..1) at a unit-space point for a style. */
function beardMask(style, L, x, y, z) {
  const my = L.mouthY;
  const hw = L.mouthHalfW;
  const ax = abs(x);
  const lips = exp(-((x / (hw * 1.05)) ** 2 + ((y - my) / 0.011) ** 2) * 2.2);
  const mustache = sstep(my + 0.002, my + 0.007, y) * (1 - sstep(L.noseTipY - 0.02, L.noseTipY - 0.012, y)) * (1 - sstep(hw + 0.006, hw + 0.016, ax)) * sstep(0.04, 0.07, z);
  const chin = (1 - sstep(my - 0.012, my - 0.004, y)) * (1 - sstep(hw + 0.002, hw + 0.03, ax)) * sstep(0.0, 0.05, z);
  const jaw = (1 - sstep(-0.02, 0.0, y)) * sstep(-0.075, -0.05, z) * (1 - sstep(-0.18, -0.15, -y) * 0);
  const cheekLine = 1 - sstep(-0.035 - ax * 0.25, -0.02 - ax * 0.25, y); // below the cheekbones
  const sideburn = sstep(0.07, 0.085, ax) * (1 - sstep(-0.005, 0.01, y));
  let m = 0;
  switch (style) {
    case 'mustache': m = mustache; break;
    case 'horseshoe': m = max(mustache, (1 - sstep(hw + 0.002, hw + 0.012, abs(ax - hw - 0.006) + hw)) * sstep(-0.16, -0.12, y) * (1 - sstep(my + 0.0, my + 0.008, y)) * sstep(0.05, 0.07, z)); break;
    case 'goatee': m = max(mustache, chin); break;
    case 'soul-patch': m = (1 - sstep(0.004, 0.009, ax)) * sstep(my - 0.03, my - 0.022, y) * (1 - sstep(my - 0.014, my - 0.01, y)) * sstep(0.05, 0.07, z); break;
    case 'chin-strap': m = jaw * cheekLine * (1 - sstep(-0.13 - 0.0, -0.118, y) * sstep(0.0, 0.04, z) * 0) * sstep(-0.165, -0.15, y + (1 - ax * 8) * 0.0) * (sstep(0.045, 0.06, ax) + (1 - sstep(my - 0.03, my - 0.025, y))); break;
    case 'mutton-chops': m = jaw * cheekLine * sstep(0.03, 0.045, ax) + mustache; break;
    case 'full':
    case 'long':
    default: m = max(mustache, jaw * cheekLine);
  }
  m = max(m, style === 'mutton-chops' || style === 'full' || style === 'long' || style === 'chin-strap' ? sideburn : 0);
  return Math.min(1, m) * (1 - lips * (style === 'soul-patch' ? 0 : 0.95));
}

function addBeard(cs, p, L, sdf, FB, style, tier, rng, tint = [1, 1, 1]) {
  const C = tier === 'low' ? 26 : 44;
  const R = tier === 'low' ? 18 : 30;
  const azMax = 105 * D2R;
  const elTop = 5 * D2R;
  const elBot = -80 * D2R;
  const long = style === 'long' ? 1 : style === 'full' ? 0.35 : 0;
  const base = cs.nv;
  const ids = new Int32Array((C + 1) * (R + 1)).fill(-1);
  const vals = [];
  for (let r = 0; r <= R; r++) {
    for (let c = 0; c <= C; c++) {
      const az = -azMax + (2 * azMax * c) / C;
      const el = elTop + ((elBot - elTop) * r) / R;
      const dx = cos(el) * sin(az);
      const dy = sin(el);
      const dz = cos(el) * cos(az);
      const t = castFromProj(sdf, dx, dy, dz);
      const x = PROJ[0] + dx * t;
      const y = PROJ[1] + dy * t;
      const z = PROJ[2] + dz * t;
      const m = beardMask(style, L, x, y, z);
      vals.push({ x, y, z, m, az, el });
    }
  }
  const my = L.mouthY;
  for (let r = 0; r <= R; r++) {
    for (let c = 0; c <= C; c++) {
      const k = r * (C + 1) + c;
      const { x, y, z, m } = vals[k];
      // Only emit vertices whose neighbourhood has some beard.
      let near = m;
      for (const o of [-1, 1, -(C + 1), C + 1]) if (vals[k + o]) near = max(near, vals[k + o].m);
      if (near < 0.02) continue;
      const n = gradient(sdf, x, y, z);
      const thickness = 0.0035 + 0.006 * long * sstep(my, -0.16, y) + 0.003 * (style === 'full' ? 1 : 0);
      const drop = long * 0.06 * sstep(my - 0.01, -0.17, y) * sstep(0.02, 0.07, z);
      const q = [x + n[0] * thickness * m, y + n[1] * thickness * m - drop * m, z + n[2] * thickness * m + drop * 0.25 * m];
      // Skinning: below the mouth -> jaw, mustache -> upper lip, else head.
      const below = sstep(my + 0.004, my - 0.01, y);
      const bones = y > my ? [['lip.U', 0.5 * exp(-((x / 0.02) ** 2)) + 0.0], ['head', 1 - 0.5 * exp(-((x / 0.02) ** 2))]] : [['jaw', below], ['head', 1 - below]];
      // Shell mode: flow-aligned UVs (clumps around the jaw, strands falling down), coverage
      // pushed past 1 inside the mask so only the edge is fuzzy.
      const flow = [0, -1 + n[1] * n[1], -n[1] * n[2]];
      ids[k] = cs.v(q, n, flow, [(atan2(x, z) * 0.12) / 0.0055, -y * (1 + long)], m * 1.9 - 0.25, tint, bones);
    }
  }
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const a = ids[r * (C + 1) + c];
      const b = ids[r * (C + 1) + c + 1];
      const d = ids[(r + 1) * (C + 1) + c];
      const e = ids[(r + 1) * (C + 1) + c + 1];
      if (a < 0 || b < 0 || d < 0 || e < 0) continue;
      cs.index.push(a, d, b, b, d, e);
    }
  }
  void base;
  void eyeOpening;
  void atan2;
}

/**
 * Eyebrows as many short hair cards lying on the brow: medial hairs point up, the body sweeps
 * outward and the tail outward/down, two staggered layers — reads as a solid brow from afar and
 * as individual hairs up close. Card mode: u = strand texture coordinate, v = root -> tip.
 */
function addBrows(cs, p, L, sdf, tier, rng, tint) {
  const thick = 0.55 + 0.9 * p.browThickness;
  const arch = 0.003 + 0.007 * p.browArch;
  const layers = tier === 'low' ? 1 : 2;
  const count = tier === 'low' ? 11 : 24;
  const x0 = 0.013;
  const x1 = L.eyeSep + L.eyeR * 1.05;
  const pathY = (t) => L.browY + 0.002 + sin(t * PI * 0.85) * arch - t * 0.006;
  const snap = (q) => {
    const f = sdf(q[0], q[1], q[2]);
    const g = gradient(sdf, q[0], q[1], q[2]);
    return { p: [q[0] - g[0] * f, q[1] - g[1] * f, q[2] - g[2] * f], n: g };
  };
  for (const e of L.eyes) {
    const s = e.side;
    const S = s > 0 ? 'L' : 'R';
    for (let layer = 0; layer < layers; layer++) {
      for (let i = 0; i < count; i++) {
        const t = min(1, max(0, (i + 0.15 + rng.next() * 0.7) / count));
        const band = (0.0072 - 0.0042 * t) * thick;
        const x = s * (x0 + t * (x1 - x0));
        const y = pathY(t) - band * 0.5 + rng.next() * band * (layer ? 0.55 : 0.75);
        const ang = (82 - 62 * sstep(0.04, 0.32, t) - 26 * sstep(0.62, 1, t) + (rng.next() - 0.5) * 14) * D2R;
        const dir2 = [s * cos(ang), sin(ang)];
        const len = (0.0058 + 0.0038 * rng.next()) * (t < 0.15 ? 0.75 : 1) * Math.sqrt(thick) * (1 - 0.25 * t);
        const w = (0.0032 + 0.0016 * rng.next()) * (1 - 0.3 * t);
        const tex = rng.next() * 7;
        const wb = [[`brow.in.${S}`, 1 - t], [`brow.out.${S}`, t]];
        const rows = tier === 'low' ? 2 : 3;
        const base = cs.nv;
        const root = frontPoint(sdf, x, y);
        for (let r = 0; r < rows; r++) {
          const tt = r / (rows - 1);
          const q = snap([root[0] + dir2[0] * len * tt, root[1] + dir2[1] * len * tt, root[2] + 0.004]);
          const n = q.n;
          // In-surface direction and the card's side vector.
          let fx = dir2[0];
          let fy = dir2[1];
          let fz = 0;
          const dn = fx * n[0] + fy * n[1];
          fx -= dn * n[0];
          fy -= dn * n[1];
          fz -= dn * n[2];
          const fl = hypot(fx, fy, fz) || 1;
          const f = [fx / fl, fy / fl, fz / fl];
          const sd = [f[1] * n[2] - f[2] * n[1], f[2] * n[0] - f[0] * n[2], f[0] * n[1] - f[1] * n[0]];
          const lift = 0.0004 + layer * 0.0003 + tt * tt * 0.0005;
          const ww = w * (1 - 0.55 * tt);
          for (const k of [0, 1]) {
            const o = (k - 0.5) * ww;
            cs.v([q.p[0] + n[0] * lift + sd[0] * o, q.p[1] + n[1] * lift + sd[1] * o, q.p[2] + n[2] * lift + sd[2] * o], n, f, [tex + k * 0.03, tt * 0.97], 10 + k, tint, wb);
          }
        }
        for (let r = 0; r < rows - 1; r++) {
          const a = base + r * 2;
          cs.index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
    }
  }
}
