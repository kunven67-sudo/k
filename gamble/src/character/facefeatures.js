// Small face parts built in head unit space: eyeballs (with a cornea bulge and planar iris UVs),
// mouth interior (dark mouth bag, upper/lower teeth with gums, tongue) and ears (two-sided
// shell with helix rim, antihelix ridge, concha and lobe). Each part lists its skinning bone(s);
// meshbuild.js places them on the skeleton.

const { sin, cos, PI, max, min, abs, exp, hypot } = Math;

/** Raw mesh accumulator: positions, normals (optional), uvs, colors, bone names per vertex. */
export class Part {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.bone = [];
    this.bone2 = [];
    this.w2 = [];
    this.idx = [];
  }
  get nv() {
    return this.pos.length / 3;
  }
  v(p, n, uv, col, bone, bone2 = null, w2 = 0) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n ? n[0] : 0, n ? n[1] : 0, n ? n[2] : 0);
    this.uv.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
    this.col.push(col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1);
    this.bone.push(bone);
    this.bone2.push(bone2);
    this.w2.push(w2);
    return this.nv - 1;
  }
  tri(a, b, c) {
    this.idx.push(a, b, c);
  }
}

/** UV sphere helper: f(theta, phi) -> {p, n, uv, col, bone} for each vertex. */
function sphereGrid(part, nu, nv, fn, flip = false) {
  const base = part.nv;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const v = fn(i / nu, j / nv);
      part.v(v.p, v.n, v.uv, v.col, v.bone, v.bone2, v.w2);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 1;
      const d = c + 1;
      if (flip) {
        part.tri(a, b, c);
        part.tri(b, d, c);
      } else {
        part.tri(a, c, b);
        part.tri(b, c, d);
      }
    }
  }
}

/** Both eyeballs. UV: left eye in u 0..0.5, right eye in 0.5..1 (atlas from eyes.js). */
export function buildEyes(L, seg = 24) {
  const part = new Part();
  for (const e of L.eyes) {
    const r = L.eyeR;
    const off = e.side > 0 ? 0 : 0.5;
    const bone = e.side > 0 ? 'eye.L' : 'eye.R';
    sphereGrid(part, seg, Math.round(seg * 0.75), (u, v) => {
      // Pole at +Z (front). theta from the front pole, phi around.
      const th = v * PI;
      const ph = u * PI * 2;
      const st = sin(th);
      let x = st * cos(ph);
      let y = st * sin(ph);
      let z = cos(th);
      // Cornea bulge over the iris.
      const bulge = 0.075 * max(0, (z - 0.82) / 0.18) ** 1.6;
      const rr = r * (1 + bulge);
      const p = [e.c[0] + x * rr, e.c[1] + y * rr, e.c[2] + z * rr];
      // Planar UV of the front hemisphere (radius 0.5 = equator).
      const pu = 0.5 + x * 0.5 * (e.side > 0 ? -1 : -1);
      const pv = 0.5 + y * 0.5;
      return { p, n: [x, y, z], uv: [off + pu * 0.5, pv], bone };
    });
  }
  return part;
}

/** Mouth interior: bag, teeth (upper on head, lower on jaw), tongue. Vertex colours. */
export function buildMouth(L, seg = 18) {
  const part = new Part();
  const my = L.mouthY;
  const mz = L.mouthZ;
  const hw = L.mouthHalfW;
  // Bag: inward-facing dark ellipsoid; upper half follows the head, lower half the jaw.
  const bc = [0, my - 0.004, mz - 0.034];
  const br = [hw * 1.05, 0.021, 0.027];
  sphereGrid(part, seg, Math.round(seg * 0.7), (u, v) => {
    const th = v * PI;
    const ph = u * PI * 2;
    const x = sin(th) * cos(ph);
    const y = sin(th) * sin(ph);
    const z = cos(th);
    const lower = y < 0;
    const dark = 0.16 + 0.12 * max(0, z);
    return {
      p: [bc[0] + x * br[0], bc[1] + y * br[1], bc[2] + z * br[2]],
      n: [-x, -y, -z],
      col: [dark * 1.25, dark * 0.42, dark * 0.42],
      bone: lower ? 'jaw' : 'head',
      bone2: lower ? 'head' : 'jaw',
      w2: 0.5 * exp(-((y * 4) ** 2)),
    };
  }, true);
  // Teeth along an arch: centre incisors wide, molars further back.
  const arch = (t, upper) => {
    const a = t * 1.25;
    const R = hw * 0.95;
    return [sin(a) * R, my + (upper ? 0.0045 : -0.0045), mz - 0.008 - (1 - cos(a)) * R * 1.1];
  };
  for (const upper of [true, false]) {
    const n = 12;
    for (let k = 0; k < n; k++) {
      const t = ((k + 0.5) / n) * 2 - 1;
      const c = arch(t, upper);
      const a = t * 1.25;
      const w = (abs(t) < 0.3 ? 0.0034 : 0.0029) * (upper ? 1.05 : 0.95);
      const h = upper ? 0.0075 - abs(t) * 0.002 : 0.0065 - abs(t) * 0.0015;
      const d = 0.0035 + abs(t) * 0.002;
      const shade = 0.93 - abs(t) * 0.3;
      const tooth = [0.96 * shade, 0.93 * shade, 0.84 * shade];
      const gum = [0.62, 0.3, 0.3];
      const bone = upper ? 'head' : 'jaw';
      // Rounded tooth: a small lathe around the vertical axis, tip toward the bite line.
      const base = part.nv;
      // Low tier (seg < 14): hexagonal 2-row teeth (24 x 24 tris) instead of 24 x 64.
      const ring = seg < 14 ? 6 : 8;
      const rows = seg < 14 ? 2 : 4;
      for (let rI = 0; rI <= rows; rI++) {
        const f = rI / rows; // 0 = gum, 1 = biting edge
        const yy = (upper ? 1 : -1) * h * (1 - f);
        const sc = 1 - 0.25 * f * f;
        for (let s = 0; s <= ring; s++) {
          const ph = (s / ring) * PI * 2;
          const lx = cos(ph) * w * sc;
          const lz = sin(ph) * d * sc;
          const x = c[0] + lx * cos(a) + lz * sin(a);
          const z = c[2] - lx * sin(a) + lz * cos(a);
          part.v([x, c[1] + yy, z], [cos(ph) * cos(a) + sin(ph) * sin(a), 0, -cos(ph) * sin(a) + sin(ph) * cos(a)], null, f < 0.2 ? gum : tooth, bone);
        }
      }
      for (let rI = 0; rI < rows; rI++) {
        for (let s = 0; s < ring; s++) {
          const a0 = base + rI * (ring + 1) + s;
          const b0 = a0 + 1;
          const c0 = a0 + ring + 1;
          const d0 = c0 + 1;
          if (upper) {
            part.tri(a0, b0, c0);
            part.tri(b0, d0, c0);
          } else {
            part.tri(a0, c0, b0);
            part.tri(b0, c0, d0);
          }
        }
      }
    }
  }
  // Tongue: flattened ellipsoid on the jaw floor.
  const tc = [0, my - 0.011, mz - 0.03];
  sphereGrid(part, 14, 8, (u, v) => {
    const th = v * PI;
    const ph = u * PI * 2;
    const x = sin(th) * cos(ph);
    const y = sin(th) * sin(ph);
    const z = cos(th);
    const p = [tc[0] + x * hw * 0.78, tc[1] + y * 0.0058 + (z > 0 ? -z * 0.002 : 0), tc[2] + z * 0.026];
    return { p, n: [x, y * 2, z], col: [0.62, 0.24, 0.26], bone: 'tongue' };
  });
  return part;
}

/** Two ears in head unit space; `rootX(y, z)` gives the skull surface x at that point. */
export function buildEars(L, rootX, segU = 20, segR = 6) {
  const part = new Part();
  const sz = L.earSize;
  const H = 0.046 * sz; // half height
  const Wf = 0.026 * sz; // half width
  for (const side of [1, -1]) {
    const cy = -0.022;
    const cz = -0.012;
    const cx = rootX(cy, cz) * side;
    const flare = Math.tan(L.earOut);
    const out = (fwd, h) => side * (h + max(0, -fwd + Wf * 0.4) * flare * 0.85);
    const outline = (th) => {
      // Rounder on top, narrower lobe at the bottom, attached front edge straighter.
      const s = sin(th);
      const c = cos(th);
      const ru = H * (s > 0 ? 1 : 0.92);
      const rf = Wf * (s > 0 ? 1.0 : 0.72 + 0.28 * (1 + s)) * (c > 0 ? 0.82 : 1);
      return [c * rf, s * ru];
    };
    const height = (rho, th) => {
      const rim = exp(-(((rho - 0.9) / 0.09) ** 2)) * 0.0062;
      const anti = exp(-(((rho - 0.6) / 0.1) ** 2)) * 0.0032 * (sin(th) > -0.6 ? 1 : 0.2);
      const concha = -exp(-((rho / 0.38) ** 2)) * 0.0045;
      const lobe = sin(th) < -0.5 ? 0.0015 : 0;
      return 0.004 + rim + anti + concha + lobe;
    };
    const base = part.nv;
    const ringN = segU;
    // Front sheet (rings rho = 1/segR..1), then back sheet.
    for (const back of [false, true]) {
      for (let r = 0; r <= segR; r++) {
        const rho = r / segR;
        for (let i = 0; i < ringN; i++) {
          const th = (i / ringN) * PI * 2;
          const [f, u] = outline(th);
          const fw = f * rho;
          const up = u * rho;
          const hh = back ? -0.002 + 0.002 * rho : height(max(rho, 0.02), th);
          const x = cx + out(fw, hh);
          const y = cy + up;
          const z = cz + fw;
          part.v([x, y, z], null, null, [1, 1, 1], 'head');
        }
      }
    }
    const sheet = ringN * (segR + 1);
    for (const back of [false, true]) {
      const o = base + (back ? sheet : 0);
      for (let r = 0; r < segR; r++) {
        for (let i = 0; i < ringN; i++) {
          const i2 = (i + 1) % ringN;
          const a = o + r * ringN + i;
          const b = o + r * ringN + i2;
          const c = o + (r + 1) * ringN + i;
          const d = o + (r + 1) * ringN + i2;
          const flip = (side > 0) !== back;
          if (flip) {
            part.tri(a, c, b);
            part.tri(b, c, d);
          } else {
            part.tri(a, b, c);
            part.tri(b, d, c);
          }
        }
      }
    }
    // Rim: join the outer rings of both sheets.
    for (let i = 0; i < ringN; i++) {
      const i2 = (i + 1) % ringN;
      const a = base + segR * ringN + i;
      const b = base + segR * ringN + i2;
      const c = base + sheet + segR * ringN + i;
      const d = base + sheet + segR * ringN + i2;
      if (side > 0) {
        part.tri(a, c, b);
        part.tri(b, c, d);
      } else {
        part.tri(a, b, c);
        part.tri(b, d, c);
      }
    }
  }
  return part;
}

/** Area-weighted vertex normals for parts that did not provide them. */
export function computePartNormals(part, from = 0) {
  const P = part.pos;
  const N = new Float32Array(P.length);
  const I = part.idx;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    if (I[t] < from) continue;
    const ux = P[b] - P[a];
    const uy = P[b + 1] - P[a + 1];
    const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a];
    const vy = P[c + 1] - P[a + 1];
    const vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      N[k] += nx;
      N[k + 1] += ny;
      N[k + 2] += nz;
    }
  }
  for (let v = from; v < part.nv; v++) {
    const l = hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1;
    part.nrm[v * 3] = N[v * 3] / l;
    part.nrm[v * 3 + 1] = N[v * 3 + 1] / l;
    part.nrm[v * 3 + 2] = N[v * 3 + 2] / l;
  }
  void min;
}
