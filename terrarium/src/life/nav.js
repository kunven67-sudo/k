// Grid path finding inside the cage (A*). Water costs more (swimming), trees/rocks/buildings block.
import { CAGE } from '../world/cage.js';

export class CageNav {
  constructor(cage) {
    this.cage = cage;
    this.nx = CAGE.nx; this.nz = CAGE.nz;
    this.cost = new Float32Array(this.nx * this.nz);
    this.dirtyT = 0;
    this.version = 0;
    this.rebuild();
  }

  cell(x, z) {
    return [Math.max(0, Math.min(this.nx - 1, Math.round((x - CAGE.x0) / CAGE.cell))), Math.max(0, Math.min(this.nz - 1, Math.round((z - CAGE.z0) / CAGE.cell)))];
  }
  pos(i, k) { return [CAGE.x0 + i * CAGE.cell, CAGE.z0 + k * CAGE.cell]; }

  rebuild() {
    const c = this.cage;
    for (let k = 0; k < this.nz; k++) for (let i = 0; i < this.nx; i++) {
      const [x, z] = this.pos(i, k);
      let v = 1;
      if (i === 0 || k === 0 || i === this.nx - 1 || k === this.nz - 1) v = 3;
      const depth = c.waterDepth(x, z);
      if (depth > 0.004) v += c.frozen ? 0.5 : 6;
      else if (depth > 0.0005) v += 1;
      const slope = Math.abs(c.hAt(i + 1, k) - c.hAt(i - 1, k)) + Math.abs(c.hAt(i, k + 1) - c.hAt(i, k - 1));
      if (slope > CAGE.cell * 1.2) v += (slope / CAGE.cell) * 2;
      if (c.lavaAt(x, z)) v = 999;
      this.cost[k * this.nx + i] = v;
    }
    for (const ob of c.obstacles) {
      if (ob.h < 0.01) continue;
      const r = ob.r + 0.004;
      const [i0, k0] = this.cell(ob.x - r, ob.z - r), [i1, k1] = this.cell(ob.x + r, ob.z + r);
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
        const [x, z] = this.pos(i, k);
        if (Math.hypot(x - ob.x, z - ob.z) < r) this.cost[k * this.nx + i] = ob.ref && ob.ref.door ? 2 : 999;
      }
    }
    this.version++;
  }

  // A* from (x0,z0) to (x1,z1). Returns array of [x,z] waypoints (excluding start) or null.
  find(x0, z0, x1, z1, maxIter = 6000) {
    const { nx, nz } = this;
    const [si, sk] = this.cell(x0, z0), [ti, tk] = this.cell(x1, z1);
    const start = sk * nx + si, goal = tk * nx + ti;
    if (start === goal) return [[x1, z1]];
    const N = nx * nz;
    const g = this.g || (this.g = new Float32Array(N));
    const came = this.came || (this.came = new Int32Array(N));
    const stamp = this.stamp || (this.stamp = new Uint32Array(N));
    const closed = this.closed || (this.closed = new Uint32Array(N));
    this.run = (this.run || 0) + 1;
    const run = this.run;
    const heap = [];
    const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
    const h = (n) => { const i = n % nx, k = (n / nx) | 0; const dx = Math.abs(i - ti), dz = Math.abs(k - tk); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    stamp[start] = run; g[start] = 0; came[start] = -1;
    push(start, h(start));
    let iter = 0, best = start, bestH = h(start);
    while (heap.length && iter++ < maxIter) {
      const cur = pop();
      if (closed[cur] === run) continue;
      closed[cur] = run;
      if (cur === goal) { best = goal; break; }
      const ci = cur % nx, ck = (cur / nx) | 0;
      const hc = h(cur);
      if (hc < bestH) { bestH = hc; best = cur; }
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
        if (!di && !dk) continue;
        const ni = ci + di, nk = ck + dk;
        if (ni < 0 || nk < 0 || ni >= nx || nk >= nz) continue;
        const n = nk * nx + ni;
        const c = this.cost[n];
        if (c >= 999 && n !== goal) continue;
        if (di && dk && (this.cost[ck * nx + ni] >= 999 || this.cost[nk * nx + ci] >= 999)) continue;
        const ng = g[cur] + c * (di && dk ? Math.SQRT2 : 1);
        if (stamp[n] !== run || ng < g[n]) {
          stamp[n] = run; g[n] = ng; came[n] = cur;
          push(n, ng + h(n));
        }
      }
    }
    // rebuild path to goal (or to the closest point we reached)
    const cells = [];
    let n = best;
    let guard = 0;
    while (n !== -1 && n !== start && guard++ < N) { cells.push(n); n = came[n]; }
    cells.reverse();
    if (!cells.length) return null;
    // smooth: keep corners only
    const pts = cells.map((c) => this.pos(c % nx, (c / nx) | 0));
    const out = [];
    let anchor = [x0, z0];
    for (let i = 0; i < pts.length; i++) {
      const next = pts[i + 1];
      if (!next || !this.clear(anchor[0], anchor[1], next[0], next[1])) { out.push(pts[i]); anchor = pts[i]; }
    }
    if (best === goal) out[out.length - 1] = [x1, z1];
    return out;
  }

  // straight walk possible without hitting a blocked or very costly cell?
  clear(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(d / (CAGE.cell * 0.5));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const [i, k] = this.cell(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (this.cost[k * this.nx + i] > 4) return false;
    }
    return true;
  }
}
