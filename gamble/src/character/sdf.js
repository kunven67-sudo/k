// Signed-distance-field toolkit for the procedural humans.
//
// Bodies and garments are described as smooth unions of simple primitives (spheres, ellipsoids,
// round cones, round boxes) placed on the bind-pose skeleton. A smooth union melts shoulders into
// torsos and thighs into hips the way a sculptor would — no intersecting tubes, no visible seams.
// `polygonize()` turns a field into a mesh with naive Surface Nets on a narrow-band grid, then
// projects every vertex onto the true iso-surface and takes the analytic gradient as its normal,
// so even a coarse grid shades perfectly smooth.
//
// Every primitive also carries skinning metadata (bone keys along its axis); `primitiveWeights()`
// blends those with a soft-min over primitive distances, which gives smooth weights across joints
// (no candy-wrapper elbows, no hard shoulder seams).

const { sqrt, abs, max, min, exp } = Math;

// ---- primitives -------------------------------------------------------------------------------

/**
 * Primitive record. Fields:
 *  type: 'sphere' | 'ellipsoid' | 'cone' (round cone a→b, radii r1→r2) | 'box' (rounded box)
 *  k:    smooth-union radius used when merging this primitive into the field
 *  sub:  true → smooth subtraction instead of union
 *  bones: [[t, boneIndex], ...] bone keys along the primitive's axis param t (cones: 0 at a, 1 at b;
 *         other shapes: projection onto `axis` normalised by their radius, keys usually single)
 *  group: region tag ('torso', 'arm.L', 'leg.R', …) used by garment coverage and culling
 */
export function sphere(c, r, opts = {}) {
  return { type: 'sphere', cx: c[0], cy: c[1], cz: c[2], r, k: 0.02, ...opts };
}

// Ellipsoid with optional rotation (3x3 row-major matrix world→local).
export function ellipsoid(c, radii, opts = {}) {
  return { type: 'ellipsoid', cx: c[0], cy: c[1], cz: c[2], rx: radii[0], ry: radii[1], rz: radii[2], rot: null, k: 0.02, ...opts };
}

export function cone(a, b, r1, r2, opts = {}) {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return { type: 'cone', ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2], bax, bay, baz, l2, rr, a2, il2, r1, r2, k: 0.02, ...opts };
}

export function box(c, half, r, opts = {}) {
  return { type: 'box', cx: c[0], cy: c[1], cz: c[2], hx: half[0] - r, hy: half[1] - r, hz: half[2] - r, r, rot: null, k: 0.01, ...opts };
}

/**
 * Eye socket carved in the shape of the lid opening: the intersection of a sphere (radius Rs
 * around the eye centre) with an angular "almond" cone bounded by the upper/lower lid curves
 * (plus margins). `rot` = world→eye rows (z forward, y up, x toward the outer corner on the left
 * eye: the side flips az). Use with sub:true.
 */
export function almond(c, rot, side, Rs, lid, opts = {}) {
  return { type: 'almond', cx: c[0], cy: c[1], cz: c[2], rot, side, Rs, ...lid, k: 0.006, ...opts };
}

function almondUpper(p, az) {
  const u = Math.max(-1, Math.min(1, az / p.halfW));
  return p.up * Math.pow(1 - u * u, 0.55) * (1 - 0.12 * u);
}
function almondLower(p, az) {
  const u = Math.max(-1, Math.min(1, az / p.halfW));
  return -p.lo * Math.pow(1 - u * u, 0.8) * (1 + 0.16 * u);
}

// Rotation matrix (row-major, world→local) from orthonormal local axes expressed in world.
export function basisRot(xAxis, yAxis, zAxis) {
  return [xAxis[0], xAxis[1], xAxis[2], yAxis[0], yAxis[1], yAxis[2], zAxis[0], zAxis[1], zAxis[2]];
}

// Distance from (x,y,z) to a primitive. Also writes the axis parameter into `primT[0]` (cones).
const primT = new Float64Array(1);

export function primDist(p, x, y, z) {
  switch (p.type) {
    case 'sphere': {
      const dx = x - p.cx;
      const dy = y - p.cy;
      const dz = z - p.cz;
      primT[0] = 0;
      return sqrt(dx * dx + dy * dy + dz * dz) - p.r;
    }
    case 'ellipsoid': {
      let dx = x - p.cx;
      let dy = y - p.cy;
      let dz = z - p.cz;
      if (p.rot) {
        const m = p.rot;
        const lx = m[0] * dx + m[1] * dy + m[2] * dz;
        const ly = m[3] * dx + m[4] * dy + m[5] * dz;
        const lz = m[6] * dx + m[7] * dy + m[8] * dz;
        dx = lx;
        dy = ly;
        dz = lz;
      }
      // Inigo Quilez's bound for ellipsoids: good near the surface, conservative away from it.
      const ax = dx / p.rx;
      const ay = dy / p.ry;
      const az = dz / p.rz;
      const k0 = sqrt(ax * ax + ay * ay + az * az);
      const bx = ax / p.rx;
      const by = ay / p.ry;
      const bz = az / p.rz;
      const k1 = sqrt(bx * bx + by * by + bz * bz);
      primT[0] = p.taxis ? (dy / p.ry) * 0.5 + 0.5 : 0;
      if (k1 < 1e-9) return -min(p.rx, p.ry, p.rz);
      return (k0 * (k0 - 1)) / k1;
    }
    case 'cone': {
      // Exact round cone (iq). Also returns the clamped axis parameter for skin weights.
      const pax = x - p.ax;
      const pay = y - p.ay;
      const paz = z - p.az;
      const yv = pax * p.bax + pay * p.bay + paz * p.baz;
      primT[0] = yv * p.il2;
      const z2 = yv - p.l2;
      const qx = pax * p.l2 - p.bax * yv;
      const qy = pay * p.l2 - p.bay * yv;
      const qz = paz * p.l2 - p.baz * yv;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = yv * yv * p.l2;
      const zz2 = z2 * z2 * p.l2;
      const k = Math.sign(p.rr) * p.rr * p.rr * x2;
      if (Math.sign(z2) * p.a2 * zz2 > k) return sqrt(x2 + zz2) * p.il2 - p.r2;
      if (Math.sign(yv) * p.a2 * y2 < k) return sqrt(x2 + y2) * p.il2 - p.r1;
      return (sqrt(x2 * p.a2 * p.il2) + yv * p.rr) * p.il2 - p.r1;
    }
    case 'almond': {
      const dx = x - p.cx;
      const dy = y - p.cy;
      const dz = z - p.cz;
      const m = p.rot;
      const lx = m[0] * dx + m[1] * dy + m[2] * dz;
      const ly = m[3] * dx + m[4] * dy + m[5] * dz;
      const lz = m[6] * dx + m[7] * dy + m[8] * dz;
      const r = sqrt(lx * lx + ly * ly + lz * lz);
      primT[0] = 0;
      if (r < 1e-9) return -p.Rs;
      const az = Math.atan2(lx * p.side, lz);
      const el = Math.asin(Math.max(-1, Math.min(1, ly / r)));
      const elU = almondUpper(p, az) + p.mU;
      const elL = almondLower(p, az) - p.mL;
      const da = max(el - elU, elL - el, abs(az) - (p.halfW + p.mA));
      return max(r - p.Rs, da * max(r, p.Rs * 0.5));
    }
    case 'box': {
      let dx = x - p.cx;
      let dy = y - p.cy;
      let dz = z - p.cz;
      if (p.rot) {
        const m = p.rot;
        const lx = m[0] * dx + m[1] * dy + m[2] * dz;
        const ly = m[3] * dx + m[4] * dy + m[5] * dz;
        const lz = m[6] * dx + m[7] * dy + m[8] * dz;
        dx = lx;
        dy = ly;
        dz = lz;
      }
      primT[0] = p.taxis ? (dy / (p.hy + p.r)) * 0.5 + 0.5 : 0;
      const qx = abs(dx) - p.hx;
      const qy = abs(dy) - p.hy;
      const qz = abs(dz) - p.hz;
      const ox = max(qx, 0);
      const oy = max(qy, 0);
      const oz = max(qz, 0);
      return sqrt(ox * ox + oy * oy + oz * oz) + min(max(qx, max(qy, qz)), 0) - p.r;
    }
    default:
      return 1e9;
  }
}

export function lastPrimT() {
  return primT[0];
}

// Polynomial smooth min (C1). k = blend radius in meters.
export function smin(a, b, k) {
  if (k <= 0) return min(a, b);
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
}

export function smax(a, b, k) {
  return -smin(-a, -b, k);
}

/** Bounding sphere of a primitive (center xyz + radius), used for spatial culling. */
export function primBound(p) {
  switch (p.type) {
    case 'sphere':
      return [p.cx, p.cy, p.cz, p.r];
    case 'ellipsoid':
      return [p.cx, p.cy, p.cz, max(p.rx, p.ry, p.rz)];
    case 'cone': {
      const l = sqrt(p.l2) * 0.5;
      return [(p.ax + p.bx) * 0.5, (p.ay + p.by) * 0.5, (p.az + p.bz) * 0.5, l + max(p.r1, p.r2)];
    }
    case 'box':
      return [p.cx, p.cy, p.cz, sqrt(p.hx * p.hx + p.hy * p.hy + p.hz * p.hz) + p.r];
    case 'almond':
      return [p.cx, p.cy, p.cz, p.Rs];
    default:
      return [0, 0, 0, 1e9];
  }
}

function evalPrims(prims, n, kScale, x, y, z) {
  let d = 1e9;
  for (let i = 0; i < n; i++) {
    const p = prims[i];
    const di = primDist(p, x, y, z);
    if (p.sub) d = smax(d, -di, p.k * kScale);
    else d = smin(d, di, p.k * kScale);
  }
  return d;
}

/**
 * Build a field function from a primitive list. `extra(x,y,z,d)` may post-process the value
 * (garment thickness ramps, wrinkles…). kScale multiplies every blend radius (looser garments).
 *
 * The returned function has `.sub(cx, cy, cz, radius, reach)`: a field restricted to the
 * primitives that can influence the surface inside that sphere. It is exact wherever the true
 * field is below `reach` (i.e. near the surface), because a primitive further away than
 * reach + its blend radius contributes nothing to the smooth union there.
 */
export function makeField(prims, { kScale = 1, offset = 0, extra = null } = {}) {
  const n = prims.length;
  const bounds = prims.map(primBound);
  const make = (list) => {
    const m = list.length;
    const f = extra
      ? (x, y, z) => extra(x, y, z, evalPrims(list, m, kScale, x, y, z) - offset)
      : offset
        ? (x, y, z) => evalPrims(list, m, kScale, x, y, z) - offset
        : (x, y, z) => evalPrims(list, m, kScale, x, y, z);
    return f;
  };
  const field = make(prims);
  field.prims = prims;
  field.sub = (cx, cy, cz, radius, reach) => {
    const list = [];
    for (let i = 0; i < n; i++) {
      const b = bounds[i];
      const dist = sqrt((b[0] - cx) ** 2 + (b[1] - cy) ** 2 + (b[2] - cz) ** 2) - radius - b[3];
      if (dist <= reach + prims[i].k * kScale + abs(offset)) list.push(prims[i]);
    }
    if (list.length === n) return field;
    if (!list.length) {
      // Nothing nearby: return a conservative positive distance (outside everything).
      const far = reach * 4 + 1;
      return () => far;
    }
    return make(list);
  };
  return field;
}

// ---- skin weights -----------------------------------------------------------------------------

function boneKeysAt(keys, t, out, w) {
  if (keys.length === 1 || t <= keys[0][0]) {
    out.set(keys[0][1], (out.get(keys[0][1]) || 0) + w);
    return;
  }
  const last = keys[keys.length - 1];
  if (t >= last[0]) {
    out.set(last[1], (out.get(last[1]) || 0) + w);
    return;
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a[0] && t <= b[0]) {
      let s = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
      s = s * s * (3 - 2 * s);
      out.set(a[1], (out.get(a[1]) || 0) + w * (1 - s));
      out.set(b[1], (out.get(b[1]) || 0) + w * s);
      return;
    }
  }
}

/**
 * Bone weights at a point: soft-min over primitive distances, each primitive distributing its
 * share to bones along its axis keys. Returns up to 4 [boneIndex, weight] pairs (normalised)
 * plus the dominant primitive (for region queries).
 */
export function primitiveWeights(prims, x, y, z, tau = 0.018, filter = null) {
  let dmin = 1e9;
  const ds = new Float64Array(prims.length);
  const ts = new Float64Array(prims.length);
  let dom = -1;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i];
    if (p.sub || !p.bones || (filter && !filter(p))) {
      ds[i] = 1e9;
      continue;
    }
    ds[i] = primDist(p, x, y, z);
    ts[i] = primT[0];
    if (ds[i] < dmin) {
      dmin = ds[i];
      dom = i;
    }
  }
  const acc = new Map();
  for (let i = 0; i < prims.length; i++) {
    const rel = ds[i] - dmin;
    if (rel > tau * 5) continue;
    const w = exp(-rel / (prims[i].tau ?? tau));
    boneKeysAt(prims[i].bones, ts[i], acc, w);
  }
  const arr = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  let sum = 0;
  for (const e of arr) sum += e[1];
  for (const e of arr) e[1] /= sum || 1;
  return { weights: arr, dominant: dom, t: dom >= 0 ? ts[dom] : 0, dist: dmin };
}

// ---- polygonizer ------------------------------------------------------------------------------

/**
 * Naive Surface Nets over a narrow band.
 * @param field (x,y,z) => signed distance (a makeField() result enables per-block culling)
 * @param bounds {min:[x,y,z], max:[x,y,z]}
 * @param h voxel size (m)
 * @returns {positions: Float32Array, normals: Float32Array, indices: Uint32Array}
 */
export function polygonize(field, bounds, h, { project = 2 } = {}) {
  const ox = bounds.min[0] - h;
  const oy = bounds.min[1] - h;
  const oz = bounds.min[2] - h;
  const nx = Math.ceil((bounds.max[0] - bounds.min[0]) / h) + 3;
  const ny = Math.ceil((bounds.max[1] - bounds.min[1]) / h) + 3;
  const nz = Math.ceil((bounds.max[2] - bounds.min[2]) / h) + 3;
  const sxy = nx * ny;
  const vals = new Float32Array(nx * ny * nz);

  // Narrow band: evaluate a coarse lattice first, refine only blocks that can contain surface.
  const B = 4;
  const bx = Math.ceil((nx - 1) / B);
  const by = Math.ceil((ny - 1) / B);
  const bz = Math.ceil((nz - 1) / B);
  const cnx = bx + 1;
  const cny = by + 1;
  const coarse = new Float32Array(cnx * cny * (bz + 1));
  // Coarse lattice through culled fields of super-blocks (16 voxels) for speed.
  const SB = 16;
  const reach = B * h * 1.9 + h * 2; // block diagonal + slack (ellipsoid/smin values are only bounds)
  const canSub = typeof field.sub === 'function';
  for (let k = 0; k <= bz; k++) {
    for (let j = 0; j <= by; j++) {
      for (let i = 0; i <= bx; i++) {
        coarse[i + j * cnx + k * cnx * cny] = field(ox + Math.min(i * B, nx - 1) * h, oy + Math.min(j * B, ny - 1) * h, oz + Math.min(k * B, nz - 1) * h);
      }
    }
  }
  void SB;
  const blockR = B * h * 0.87;
  const blockField = new Map();
  for (let k = 0; k < bz; k++) {
    for (let j = 0; j < by; j++) {
      for (let i = 0; i < bx; i++) {
        let mn = 1e9;
        let sgn = 0;
        for (let c = 0; c < 8; c++) {
          const v = coarse[i + (c & 1) + (j + ((c >> 1) & 1)) * cnx + (k + (c >> 2)) * cnx * cny];
          if (abs(v) < mn) mn = abs(v);
          sgn += v;
        }
        const i0 = i * B;
        const j0 = j * B;
        const k0 = k * B;
        const i1 = Math.min(i0 + B, nx - 1);
        const j1 = Math.min(j0 + B, ny - 1);
        const k1 = Math.min(k0 + B, nz - 1);
        if (mn > reach) {
          const fill = sgn < 0 ? -mn : mn;
          for (let kk = k0; kk <= k1; kk++) for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) vals[ii + jj * nx + kk * sxy] = fill;
        } else {
          const cx = ox + (i0 + B * 0.5) * h;
          const cy = oy + (j0 + B * 0.5) * h;
          const cz = oz + (k0 + B * 0.5) * h;
          const f = canSub ? field.sub(cx, cy, cz, blockR, reach + h) : field;
          blockField.set(i + j * bx + k * bx * by, f);
          for (let kk = k0; kk <= k1; kk++) {
            const z = oz + kk * h;
            for (let jj = j0; jj <= j1; jj++) {
              const yy = oy + jj * h;
              for (let ii = i0; ii <= i1; ii++) vals[ii + jj * nx + kk * sxy] = f(ox + ii * h, yy, z);
            }
          }
        }
      }
    }
  }

  // One vertex per sign-changing cell.
  const cellIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cxy = (nx - 1) * (ny - 1);
  const pos = [];
  const vblock = [];
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = vals[i + (c & 1) + (j + ((c >> 1) & 1)) * nx + (k + (c >> 2)) * sxy];
          cv[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let cnt = 0;
        for (const [a, b] of EDGES) {
          const va = cv[a];
          const vb = cv[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t;
          cnt++;
        }
        cellIndex[i + j * (nx - 1) + k * cxy] = pos.length / 3;
        pos.push(ox + (i + sx / cnt) * h, oy + (j + sy / cnt) * h, oz + (k + sz / cnt) * h);
        vblock.push(Math.min(bx - 1, (i / B) | 0) + Math.min(by - 1, (j / B) | 0) * bx + Math.min(bz - 1, (k / B) | 0) * bx * by);
      }
    }
  }

  // Quads across every sign-changing lattice edge.
  const idx = [];
  const cell = (i, j, k) => cellIndex[i + j * (nx - 1) + k * cxy];
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const v0 = vals[i + j * nx + k * sxy];
        const in0 = v0 < 0;
        if (i < nx - 1) {
          const v1 = vals[i + 1 + j * nx + k * sxy];
          if (in0 !== v1 < 0) quad(idx, cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), in0);
        }
        if (j < ny - 1) {
          const v1 = vals[i + (j + 1) * nx + k * sxy];
          if (in0 !== v1 < 0) quad(idx, cell(i - 1, j, k - 1), cell(i - 1, j, k), cell(i, j, k), cell(i, j, k - 1), in0);
        }
        if (k < nz - 1) {
          const v1 = vals[i + j * nx + (k + 1) * sxy];
          if (in0 !== v1 < 0) quad(idx, cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), in0);
        }
      }
    }
  }

  const positions = new Float32Array(pos);
  const normals = new Float32Array(positions.length);
  const n = positions.length / 3;
  for (let v = 0; v < n; v++) {
    const f = blockField.get(vblock[v]) || field;
    projectVertex(f, positions, normals, v, h * 0.6, project, h * 0.05);
  }
  return { positions, normals, indices: new Uint32Array(idx) };
}

/**
 * Newton-project vertex v of `positions` onto the iso-surface of `f` (bounded steps), writing the
 * normalised gradient into `normals`. Returns the final |distance|.
 */
export function projectVertex(f, positions, normals, v, maxStep, iters = 2, e = 0.0005) {
  let x = positions[v * 3];
  let y = positions[v * 3 + 1];
  let z = positions[v * 3 + 2];
  let gx = 0;
  let gy = 1;
  let gz = 0;
  let d = 0;
  for (let it = 0; it <= iters; it++) {
    // Forward differences: 4 evaluations per step instead of 7.
    d = f(x, y, z);
    gx = f(x + e, y, z) - d;
    gy = f(x, y + e, z) - d;
    gz = f(x, y, z + e) - d;
    const gl = sqrt(gx * gx + gy * gy + gz * gz) || 1;
    gx /= gl;
    gy /= gl;
    gz /= gl;
    if (it === iters || abs(d) < e * 0.05) break;
    const step = Math.max(-maxStep, Math.min(maxStep, d));
    x -= gx * step;
    y -= gy * step;
    z -= gz * step;
  }
  positions[v * 3] = x;
  positions[v * 3 + 1] = y;
  positions[v * 3 + 2] = z;
  if (normals) {
    normals[v * 3] = gx;
    normals[v * 3 + 1] = gy;
    normals[v * 3 + 2] = gz;
  }
  return abs(d);
}

function quad(idx, a, b, c, d, flip) {
  if (a < 0 || b < 0 || c < 0 || d < 0) return;
  if (flip) idx.push(a, b, c, a, c, d);
  else idx.push(a, c, b, a, d, c);
}

/**
 * Keep only triangles accepted by `keepTri(i0,i1,i2)` and compact the vertex arrays.
 * `attrs` is a map name → {array, itemSize}; returns the same structure, re-indexed.
 */
export function filterMesh(indices, vertexCount, attrs, keepTri) {
  const used = new Int32Array(vertexCount).fill(-1);
  const out = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    if (!keepTri(a, b, c)) continue;
    out.push(a, b, c);
  }
  let next = 0;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (used[v] < 0) used[v] = next++;
    out[i] = used[v];
  }
  const res = {};
  for (const [name, { array, itemSize }] of Object.entries(attrs)) {
    const Ctor = array.constructor;
    const na = new Ctor(next * itemSize);
    for (let v = 0; v < vertexCount; v++) {
      const nv = used[v];
      if (nv < 0) continue;
      for (let c = 0; c < itemSize; c++) na[nv * itemSize + c] = array[v * itemSize + c];
    }
    res[name] = { array: na, itemSize };
  }
  return { indices: new Uint32Array(out), attrs: res, count: next, remap: used };
}
