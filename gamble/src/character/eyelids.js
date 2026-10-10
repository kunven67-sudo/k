// Eyelid patches: one small mesh per eye with concentric rings around the almond opening, so
// lids have clean edge loops (crisp margin, smooth blink) regardless of the head grid density.
//
// Ring 0 = lid margin, tucked into the eyeball (the depth buffer draws the lash line), ring 1 =
// top of the margin (lid thickness), outer rings = rays from the eye centre onto the head SDF.
// The patch overlaps the head grid; grid triangles it covers are dropped (see coversGrid). Both
// meshes take their normals from the same SDF, so the overlap is invisible.

import { eyeOpening, PROJ } from './headsdf.js';

const { sin, cos, atan2, hypot, abs, max, min, PI } = Math;
const sstep = (a, b, x) => {
  const t = min(1, max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Radial offsets (radians, in eye-angle space) of the rings beyond the almond boundary.
export const LID_RINGS = [0, 0.045, 0.1, 0.17, 0.26, 0.37, 0.5, 0.64];
const LID_W_UP = [1, 1, 0.97, 0.85, 0.6, 0.32, 0.1, 0];
const LID_W_DN = [1, 1, 0.92, 0.7, 0.4, 0.16, 0.03, 0];

/** Unit-space direction from eye e for eye angles (h toward temple, v up). */
export function eyeDir(e, h, v) {
  const ch = h * e.side;
  const lx = sin(ch) * cos(v);
  const ly = sin(v);
  const lz = cos(ch) * cos(v);
  const cy = cos(e.yaw);
  const sy = sin(e.yaw);
  return [lx * cy + lz * sy, ly, -lx * sy + lz * cy];
}

/** Almond boundary table: for each around-angle psi, the boundary distance from the centre. */
export function almondTable(L, e, n = 96) {
  const vc = (L.lidUpper - L.lidLower) * 0.5;
  const rho = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const psi = (i / n) * PI * 2;
    const ch = cos(psi);
    const sh = sin(psi);
    let a = 0;
    let b = 1.6;
    for (let k = 0; k < 24; k++) {
      const m = (a + b) * 0.5;
      if (eyeOpening(L, e, ch * m, vc + sh * m) > 0) a = m;
      else b = m;
    }
    rho[i] = (a + b) * 0.5;
  }
  return { vc, rho, n };
}

function boundaryAt(T, psi) {
  let f = (psi / (PI * 2)) * T.n;
  f = ((f % T.n) + T.n) % T.n;
  const i = Math.floor(f);
  const t = f - i;
  return T.rho[i] * (1 - t) + T.rho[(i + 1) % T.n] * t;
}

/** Ring offset scale: rings spread less toward the corners (which wrap around the eyeball). */
const ringScale = (psi) => {
  const c = cos(psi);
  return c < 0 ? 1 - 0.72 * -c : 1 - 0.45 * c; // inner corner (toward the nose) stays tight
};

/**
 * Build the lid patch for eye e. `sdf` is the head field. Returns unit-space arrays plus the
 * ring/segment layout (weights are filled by the caller with face weights + lid overrides).
 */
export function buildLidPatch(L, e, sdf, segs = 48, castRay = null) {
  const T = almondTable(L, e);
  const K = LID_RINGS.length;
  const nv = K * segs;
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const lidW = new Float32Array(nv); // >0 upper lid weight, <0 lower lid weight
  const ringOf = new Int32Array(nv);
  const c = e.c;
  for (let j = 0; j < segs; j++) {
    const psi = (j / segs) * PI * 2;
    const rb = boundaryAt(T, psi);
    const sc = ringScale(psi);
    for (let k = 0; k < K; k++) {
      const rr = rb + LID_RINGS[k] * sc;
      const h = cos(psi) * rr;
      const v = T.vc + sin(psi) * rr;
      const d = eyeDir(e, h, v);
      let t;
      if (k === 0) t = L.eyeR - 0.0005;
      else if (k === 1) t = L.eyeR + L.lidT * 0.8;
      else {
        // Outer rings: march INWARD from outside along the eye-centre ray and take the first
        // (outermost) surface. Marching outward from the eyeball would stop in hidden air
        // pockets of the socket and fold the patch over itself.
        t = 0.075;
        let f = sdf(c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t);
        let prev = t;
        for (let it = 0; it < 160 && f > 1e-5; it++) {
          prev = t;
          t -= max(f * 0.7, 1.5e-4);
          if (t < L.eyeR) break;
          f = sdf(c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t);
        }
        let a = max(t, L.eyeR);
        let b = prev;
        for (let it = 0; it < 14; it++) {
          const m = (a + b) * 0.5;
          if (sdf(c[0] + d[0] * m, c[1] + d[1] * m, c[2] + d[2] * m) < 0) a = m;
          else b = m;
        }
        // The outermost ring tucks just under the head grid it overlaps.
        t = (a + b) * 0.5 - (k === K - 1 ? 0.00035 : 0.00005);
        void castRay;
      }
      const v3 = (k * segs + j) * 3;
      pos[v3] = c[0] + d[0] * t;
      pos[v3 + 1] = c[1] + d[1] * t;
      pos[v3 + 2] = c[2] + d[2] * t;
      const up = sin(psi) >= 0;
      const corner = sstep(0.0, 0.55, abs(sin(psi)));
      lidW[k * segs + j] = (up ? LID_W_UP[k] : -LID_W_DN[k]) * (0.35 + 0.65 * corner);
      ringOf[k * segs + j] = k;
    }
  }
  // Normals: SDF gradient (ring 0/1 use the margin's own direction blend).
  const hh = 3e-4;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    let gx;
    let gy;
    let gz;
    if (ringOf[v] === 0) {
      // Margin: normal points out of the eyeball.
      gx = x - c[0];
      gy = y - c[1];
      gz = z - c[2];
    } else if (ringOf[v] === 1) {
      // Margin top: half radial, half the field normal one ring out.
      const o = (2 * segs + (v % segs)) * 3;
      const rx = x - c[0];
      const ry = y - c[1];
      const rz = z - c[2];
      const rl = hypot(rx, ry, rz) || 1;
      const px = pos[o];
      const py = pos[o + 1];
      const pz = pos[o + 2];
      const fx = sdf(px + hh, py, pz) - sdf(px - hh, py, pz);
      const fy = sdf(px, py + hh, pz) - sdf(px, py - hh, pz);
      const fz = sdf(px, py, pz + hh) - sdf(px, py, pz - hh);
      const fl = hypot(fx, fy, fz) || 1;
      gx = rx / rl + fx / fl;
      gy = ry / rl + fy / fl;
      gz = rz / rl + fz / fl;
    } else {
      gx = sdf(x + hh, y, z) - sdf(x - hh, y, z);
      gy = sdf(x, y + hh, z) - sdf(x, y - hh, z);
      gz = sdf(x, y, z + hh) - sdf(x, y, z - hh);
    }
    const l = hypot(gx, gy, gz) || 1;
    nrm[v * 3] = gx / l;
    nrm[v * 3 + 1] = gy / l;
    nrm[v * 3 + 2] = gz / l;
  }
  const index = [];
  for (let k = 0; k < K - 1; k++) {
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % segs;
      const a = k * segs + j;
      const b = k * segs + j2;
      const d = (k + 1) * segs + j;
      const f = (k + 1) * segs + j2;
      index.push(a, b, d, b, f, d);
    }
  }
  // Orient outward (compare a mid-ring triangle with its SDF normal).
  {
    const i = (3 * segs + 2) * 6;
    const [a, b, d] = [index[i], index[i + 1], index[i + 2]];
    const ux = pos[b * 3] - pos[a * 3];
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[d * 3] - pos[a * 3];
    const vy = pos[d * 3 + 1] - pos[a * 3 + 1];
    const vz = pos[d * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * nrm[a * 3] + ny * nrm[a * 3 + 1] + nz * nrm[a * 3 + 2] < 0) {
      for (let t = 0; t < index.length; t += 3) {
        const tmp = index[t + 1];
        index[t + 1] = index[t + 2];
        index[t + 2] = tmp;
      }
    }
  }
  return { pos, nrm, index, nv, lidW, ringOf, table: T, segs, K };
}

/**
 * Coverage test for head-grid vertices: true if the direction from PROJ to the point falls
 * inside the patch's second-to-last ring (as seen from PROJ). Grid triangles made only of
 * covered points are dropped.
 */
export function makeCoverTest(patches) {
  const polys = patches.map((pp) => {
    const k = pp.K - 2;
    const pts = [];
    for (let j = 0; j < pp.segs; j++) {
      const v = k * pp.segs + j;
      const qx = pp.pos[v * 3] - PROJ[0];
      const qy = pp.pos[v * 3 + 1] - PROJ[1];
      const qz = pp.pos[v * 3 + 2] - PROJ[2];
      pts.push([atan2(qx, qz), atan2(qy, hypot(qx, qz))]);
    }
    let minA = 9;
    let maxA = -9;
    let minE = 9;
    let maxE = -9;
    for (const [a, e] of pts) {
      minA = min(minA, a);
      maxA = max(maxA, a);
      minE = min(minE, e);
      maxE = max(maxE, e);
    }
    return { pts, minA, maxA, minE, maxE };
  });
  return (x, y, z) => {
    const qx = x - PROJ[0];
    const qy = y - PROJ[1];
    const qz = z - PROJ[2];
    if (qz <= 0) return false;
    const a = atan2(qx, qz);
    const e = atan2(qy, hypot(qx, qz));
    for (const P of polys) {
      if (a < P.minA || a > P.maxA || e < P.minE || e > P.maxE) continue;
      let inside = false;
      const n = P.pts.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [ai, ei] = P.pts[i];
        const [aj, ej] = P.pts[j];
        if (ei > e !== ej > e && a < ((aj - ai) * (e - ei)) / (ej - ei) + ai) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  };
}
