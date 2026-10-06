// Quadric-error-metric mesh decimation (Garland & Heckbert) for the character templates.
//
// Surface Nets output is uniform: every square centimetre gets the same number of triangles.
// Templates are polygonized finely once and then decimated here, so the triangle budget ends up
// where it matters (fingers, lips, eyelid sockets, ears, joints) and flat areas (back, thighs)
// get big triangles. Runs once per template per tier (cached), never per human.
//
// Cost of collapsing edge (a, b) = quadric error at the optimal position, plus an edge-length
// term that keeps triangles roughly isotropic (long slivers deform badly when skinned), both
// scaled by a per-vertex importance so detailed regions survive longer.

const { sqrt, abs, min, max } = Math;

// ---- binary min-heap over parallel arrays (cost, a, b, stamp a, stamp b) ----------------------
class EdgeHeap {
  constructor(cap) {
    this.cost = new Float64Array(cap);
    this.data = new Int32Array(cap * 4);
    this.n = 0;
  }
  _grow() {
    const c = new Float64Array(this.cost.length * 2);
    c.set(this.cost);
    const d = new Int32Array(this.data.length * 2);
    d.set(this.data);
    this.cost = c;
    this.data = d;
  }
  _swap(i, j) {
    const c = this.cost;
    const d = this.data;
    const tc = c[i];
    c[i] = c[j];
    c[j] = tc;
    for (let k = 0; k < 4; k++) {
      const t = d[i * 4 + k];
      d[i * 4 + k] = d[j * 4 + k];
      d[j * 4 + k] = t;
    }
  }
  push(cost, a, b, sa, sb) {
    if (this.n >= this.cost.length) this._grow();
    let i = this.n++;
    this.cost[i] = cost;
    const d = this.data;
    d[i * 4] = a;
    d[i * 4 + 1] = b;
    d[i * 4 + 2] = sa;
    d[i * 4 + 3] = sb;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cost[p] <= this.cost[i]) break;
      this._swap(i, p);
      i = p;
    }
  }
  // Pops into out[0..3] = a, b, sa, sb; returns cost.
  pop(out) {
    const c = this.cost[0];
    const d = this.data;
    out[0] = d[0];
    out[1] = d[1];
    out[2] = d[2];
    out[3] = d[3];
    this.n--;
    if (this.n > 0) {
      this.cost[0] = this.cost[this.n];
      for (let k = 0; k < 4; k++) d[k] = d[this.n * 4 + k];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.n && this.cost[l] < this.cost[m]) m = l;
        if (r < this.n && this.cost[r] < this.cost[m]) m = r;
        if (m === i) break;
        this._swap(i, m);
        i = m;
      }
    }
    return c;
  }
}

/**
 * Decimate a closed (or open, boundaries are locked) triangle mesh.
 * @param {Float32Array} positions
 * @param {Uint32Array|number[]} indices
 * @param {object} opts
 *   targetTris    stop when this many triangles remain
 *   importance    optional Float32Array per vertex (1 = normal, >1 keeps more detail)
 *   lengthWeight  weight of the squared-edge-length regulariser (relative to quadric error)
 *   lock          optional Uint8Array per vertex: 1 = never move/remove
 * @returns {{positions: Float32Array, indices: Uint32Array, source: Int32Array}}
 *   source[i] = index of an original vertex that ended at new vertex i (for attribute lookups)
 */
export function decimate(positions, indices, { targetTris, importance = null, lengthWeight = 0.002, lock = null } = {}) {
  const nV = positions.length / 3;
  const nF = indices.length / 3;
  const P = new Float64Array(positions);
  const F = new Int32Array(indices);
  const fAlive = new Uint8Array(nF).fill(1);
  const vAlive = new Uint8Array(nV).fill(1);
  const stamp = new Int32Array(nV);
  const imp = importance || new Float32Array(nV).fill(1);
  const locked = lock ? new Uint8Array(lock) : new Uint8Array(nV);
  const Q = new Float64Array(nV * 10);
  const vf = new Array(nV);
  for (let v = 0; v < nV; v++) vf[v] = [];
  const fn = new Float64Array(nF * 3); // original face normals for flip tests

  for (let f = 0; f < nF; f++) {
    const a = F[f * 3];
    const b = F[f * 3 + 1];
    const c = F[f * 3 + 2];
    vf[a].push(f);
    vf[b].push(f);
    vf[c].push(f);
    const ux = P[b * 3] - P[a * 3];
    const uy = P[b * 3 + 1] - P[a * 3 + 1];
    const uz = P[b * 3 + 2] - P[a * 3 + 2];
    const wx = P[c * 3] - P[a * 3];
    const wy = P[c * 3 + 1] - P[a * 3 + 1];
    const wz = P[c * 3 + 2] - P[a * 3 + 2];
    let nx = uy * wz - uz * wy;
    let ny = uz * wx - ux * wz;
    let nz = ux * wy - uy * wx;
    const len = sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-20) continue;
    const area = len * 0.5;
    nx /= len;
    ny /= len;
    nz /= len;
    fn[f * 3] = nx;
    fn[f * 3 + 1] = ny;
    fn[f * 3 + 2] = nz;
    const d = -(nx * P[a * 3] + ny * P[a * 3 + 1] + nz * P[a * 3 + 2]);
    const k = [nx * nx, nx * ny, nx * nz, nx * d, ny * ny, ny * nz, ny * d, nz * nz, nz * d, d * d];
    for (const v of [a, b, c]) for (let i = 0; i < 10; i++) Q[v * 10 + i] += k[i] * area;
  }

  // Lock boundary vertices (edges used by a single face) so open meshes keep their outline.
  {
    const edgeCount = new Map();
    for (let f = 0; f < nF; f++) {
      for (let e = 0; e < 3; e++) {
        const a = F[f * 3 + e];
        const b = F[f * 3 + ((e + 1) % 3)];
        const key = a < b ? a * nV + b : b * nV + a;
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
      }
    }
    for (const [key, cnt] of edgeCount) {
      if (cnt !== 2) {
        locked[Math.floor(key / nV)] = 1;
        locked[key % nV] = 1;
      }
    }
  }

  const opt = new Float64Array(3);
  const q = new Float64Array(10);
  // Optimal collapse position for (a, b) → opt; returns the cost.
  const evalEdge = (a, b) => {
    for (let i = 0; i < 10; i++) q[i] = Q[a * 10 + i] + Q[b * 10 + i];
    const ax = P[a * 3];
    const ay = P[a * 3 + 1];
    const az = P[a * 3 + 2];
    const bx = P[b * 3];
    const by = P[b * 3 + 1];
    const bz = P[b * 3 + 2];
    const err = (x, y, z) =>
      q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9];
    let x;
    let y;
    let z;
    if (locked[a] && locked[b]) return Infinity;
    if (locked[a]) {
      x = ax;
      y = ay;
      z = az;
    } else if (locked[b]) {
      x = bx;
      y = by;
      z = bz;
    } else {
      // Solve A x = -b for the 3x3 symmetric A.
      const a00 = q[0];
      const a01 = q[1];
      const a02 = q[2];
      const a11 = q[4];
      const a12 = q[5];
      const a22 = q[7];
      const det = a00 * (a11 * a22 - a12 * a12) - a01 * (a01 * a22 - a12 * a02) + a02 * (a01 * a12 - a11 * a02);
      const scale = abs(a00) + abs(a11) + abs(a22);
      let ok = false;
      if (abs(det) > 1e-9 * scale * scale * scale) {
        const r0 = -q[3];
        const r1 = -q[6];
        const r2 = -q[8];
        const i00 = (a11 * a22 - a12 * a12) / det;
        const i01 = (a02 * a12 - a01 * a22) / det;
        const i02 = (a01 * a12 - a02 * a11) / det;
        const i11 = (a00 * a22 - a02 * a02) / det;
        const i12 = (a02 * a01 - a00 * a12) / det;
        const i22 = (a00 * a11 - a01 * a01) / det;
        x = i00 * r0 + i01 * r1 + i02 * r2;
        y = i01 * r0 + i11 * r1 + i12 * r2;
        z = i02 * r0 + i12 * r1 + i22 * r2;
        // Reject solutions far from the edge (near-degenerate quadrics).
        const mx = (ax + bx) * 0.5;
        const my = (ay + by) * 0.5;
        const mz = (az + bz) * 0.5;
        const el = sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
        ok = sqrt((x - mx) ** 2 + (y - my) ** 2 + (z - mz) ** 2) < el;
      }
      if (!ok) {
        const ea = err(ax, ay, az);
        const eb = err(bx, by, bz);
        const mx = (ax + bx) * 0.5;
        const my = (ay + by) * 0.5;
        const mz = (az + bz) * 0.5;
        const em = err(mx, my, mz);
        if (em <= ea && em <= eb) {
          x = mx;
          y = my;
          z = mz;
        } else if (ea <= eb) {
          x = ax;
          y = ay;
          z = az;
        } else {
          x = bx;
          y = by;
          z = bz;
        }
      }
    }
    opt[0] = x;
    opt[1] = y;
    opt[2] = z;
    const l2 = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
    const w = max(imp[a], imp[b]);
    return max(0, err(x, y, z)) * w + lengthWeight * l2 * l2 * w * w;
  };

  const heap = new EdgeHeap(nF * 2);
  const pushEdge = (a, b) => {
    const c = evalEdge(a, b);
    if (c < Infinity) heap.push(c, a, b, stamp[a], stamp[b]);
  };
  // Interior edges appear twice (opposite orientation); boundary edges have locked endpoints.
  for (let f = 0; f < nF; f++) {
    for (let e = 0; e < 3; e++) {
      const a = F[f * 3 + e];
      const b = F[f * 3 + ((e + 1) % 3)];
      if (a < b) pushEdge(a, b);
    }
  }

  const neighbors = (v, out) => {
    out.clear();
    for (const f of vf[v]) {
      if (!fAlive[f]) continue;
      for (let k = 0; k < 3; k++) {
        const u = F[f * 3 + k];
        if (u !== v) out.add(u);
      }
    }
    return out;
  };
  const nA = new Set();
  const nB = new Set();
  let tris = nF;
  const item = new Int32Array(4);
  let guard = 0;
  while (tris > targetTris && heap.n > 0 && guard++ < nF * 8) {
    heap.pop(item);
    const a = item[0];
    const b = item[1];
    if (!vAlive[a] || !vAlive[b] || stamp[a] !== item[2] || stamp[b] !== item[3]) continue;
    evalEdge(a, b); // refresh opt (cost unchanged since stamps match)
    const x = opt[0];
    const y = opt[1];
    const z = opt[2];
    // Link condition: common neighbours must be exactly the apexes of the shared faces.
    neighbors(a, nA);
    neighbors(b, nB);
    let common = 0;
    for (const u of nA) if (nB.has(u)) common++;
    let shared = 0;
    for (const f of vf[a]) {
      if (!fAlive[f]) continue;
      const i0 = F[f * 3];
      const i1 = F[f * 3 + 1];
      const i2 = F[f * 3 + 2];
      if (i0 === b || i1 === b || i2 === b) shared++;
    }
    if (common !== shared || shared === 0) continue;
    // Flip / degeneracy test on every face that will survive.
    let bad = false;
    for (let pass = 0; pass < 2 && !bad; pass++) {
      const fl = vf[pass ? b : a];
      for (let fi = 0; fi < fl.length; fi++) {
        const f = fl[fi];
        if (!fAlive[f]) continue;
        const i0 = F[f * 3];
        const i1 = F[f * 3 + 1];
        const i2 = F[f * 3 + 2];
        const hasA = i0 === a || i1 === a || i2 === a;
        const hasB = i0 === b || i1 === b || i2 === b;
        if (hasA && hasB) continue;
        const m0 = i0 === a || i0 === b;
        const m1 = i1 === a || i1 === b;
        const m2 = i2 === a || i2 === b;
        const p0x = m0 ? x : P[i0 * 3];
        const p0y = m0 ? y : P[i0 * 3 + 1];
        const p0z = m0 ? z : P[i0 * 3 + 2];
        const p1x = m1 ? x : P[i1 * 3];
        const p1y = m1 ? y : P[i1 * 3 + 1];
        const p1z = m1 ? z : P[i1 * 3 + 2];
        const p2x = m2 ? x : P[i2 * 3];
        const p2y = m2 ? y : P[i2 * 3 + 1];
        const p2z = m2 ? z : P[i2 * 3 + 2];
        const ux = p1x - p0x;
        const uy = p1y - p0y;
        const uz = p1z - p0z;
        const wx = p2x - p0x;
        const wy = p2y - p0y;
        const wz = p2z - p0z;
        const nx = uy * wz - uz * wy;
        const ny = uz * wx - ux * wz;
        const nz = ux * wy - uy * wx;
        const len = sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 1e-14) {
          bad = true;
          break;
        }
        const dot = (nx * fn[f * 3] + ny * fn[f * 3 + 1] + nz * fn[f * 3 + 2]) / len;
        if (dot < 0.35) {
          bad = true;
          break;
        }
        // Reject slivers: area relative to the longest edge².
        const e0 = ux * ux + uy * uy + uz * uz;
        const e1 = wx * wx + wy * wy + wz * wz;
        const e2 = (p2x - p1x) ** 2 + (p2y - p1y) ** 2 + (p2z - p1z) ** 2;
        if (len / max(e0, e1, e2) < 0.12) {
          bad = true;
          break;
        }
      }
    }
    if (bad) continue;
    // Collapse b → a.
    P[a * 3] = x;
    P[a * 3 + 1] = y;
    P[a * 3 + 2] = z;
    for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
    if (locked[b]) locked[a] = 1;
    imp[a] = max(imp[a], imp[b]);
    for (const f of vf[b]) {
      if (!fAlive[f]) continue;
      const i0 = F[f * 3];
      const i1 = F[f * 3 + 1];
      const i2 = F[f * 3 + 2];
      if (i0 === a || i1 === a || i2 === a) {
        fAlive[f] = 0;
        tris--;
        continue;
      }
      for (let k = 0; k < 3; k++) if (F[f * 3 + k] === b) F[f * 3 + k] = a;
    }
    const merged = [];
    for (const f of vf[a]) if (fAlive[f]) merged.push(f);
    for (const f of vf[b]) if (fAlive[f]) merged.push(f);
    vf[a] = merged;
    vf[b] = [];
    vAlive[b] = 0;
    stamp[a]++;
    // Refresh face normals of the moved fan for subsequent flip tests.
    for (const f of merged) {
      const i0 = F[f * 3];
      const i1 = F[f * 3 + 1];
      const i2 = F[f * 3 + 2];
      const ux = P[i1 * 3] - P[i0 * 3];
      const uy = P[i1 * 3 + 1] - P[i0 * 3 + 1];
      const uz = P[i1 * 3 + 2] - P[i0 * 3 + 2];
      const wx = P[i2 * 3] - P[i0 * 3];
      const wy = P[i2 * 3 + 1] - P[i0 * 3 + 1];
      const wz = P[i2 * 3 + 2] - P[i0 * 3 + 2];
      const nx = uy * wz - uz * wy;
      const ny = uz * wx - ux * wz;
      const nz = ux * wy - uy * wx;
      const len = sqrt(nx * nx + ny * ny + nz * nz) || 1;
      fn[f * 3] = nx / len;
      fn[f * 3 + 1] = ny / len;
      fn[f * 3 + 2] = nz / len;
    }
    neighbors(a, nA);
    for (const u of nA) pushEdge(min(a, u), max(a, u));
  }

  // Compact.
  const remap = new Int32Array(nV).fill(-1);
  const outIdx = [];
  for (let f = 0; f < nF; f++) {
    if (!fAlive[f]) continue;
    for (let k = 0; k < 3; k++) outIdx.push(F[f * 3 + k]);
  }
  let next = 0;
  const source = [];
  for (let i = 0; i < outIdx.length; i++) {
    const v = outIdx[i];
    if (remap[v] < 0) {
      remap[v] = next++;
      source.push(v);
    }
    outIdx[i] = remap[v];
  }
  const outPos = new Float32Array(next * 3);
  for (let i = 0; i < next; i++) {
    const v = source[i];
    outPos[i * 3] = P[v * 3];
    outPos[i * 3 + 1] = P[v * 3 + 1];
    outPos[i * 3 + 2] = P[v * 3 + 2];
  }
  return { positions: outPos, indices: new Uint32Array(outIdx), source: new Int32Array(source) };
}
