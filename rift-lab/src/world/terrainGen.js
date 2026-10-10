// Builds the Empty World's land from a seed, like real geology:
// rolling hills, a ring of mountains at the edges, a lake in the lowest basin,
// and a river that starts up in the mountains and carves its way downhill into it.
// Pure data: heights, water levels, forest density, and the river path.

import { Simplex, mulberry32, clamp, lerp, smoothstep } from '../core/noise.js';

export const WORLD_SIZE = 2048;        // meters, square
export const CELL = 2;                 // meters between height samples
export const N = WORLD_SIZE / CELL + 1; // vertices per side (1025)
export const HALF = WORLD_SIZE / 2;

// Grid index helpers. World x,z range is [-HALF, HALF].
export const gx = (x) => (x + HALF) / CELL;
export const wx = (i) => i * CELL - HALF;

export function generateTerrain(seed, onProgress = () => {}) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const nBase = new Simplex(seed);
  const nWarp = new Simplex(seed + 1);
  const nMount = new Simplex(seed + 2);
  const nDetail = new Simplex(seed + 3);
  const nShape = new Simplex(seed + 4);

  const H = new Float32Array(N * N);

  // ---- 1. Base land + edge mountains ----
  const baseHeight = (x, z) => {
    const qx = x + 70 * nWarp.fbm(x * 0.0012, z * 0.0012, 3);
    const qz = z + 70 * nWarp.fbm(x * 0.0012 + 40, z * 0.0012 - 40, 3);
    let h = 24 * nBase.fbm(qx * 0.0021, qz * 0.0021, 6, 2, 0.48);
    h += 18 * nBase.noise(qx * 0.0006 + 11, qz * 0.0006 - 7);
    h += 0.7 * nDetail.fbm(x * 0.035, z * 0.035, 3);
    // distance to the nearest edge (0 at the edge)
    const d = Math.min(HALF - Math.abs(x), HALF - Math.abs(z));
    const m = smoothstep(300, 30, d);
    if (m > 0) {
      // worn-down ridges (not spikes): broad shapes, sharper only at the crests
      const broad = nMount.fbm(x * 0.0016 + 3, z * 0.0016 - 5, 4) * 0.5 + 0.5;
      const ridge = nMount.ridged(x * 0.0026, z * 0.0026, 5, 2.0, 0.45);
      h += m * m * (130 + 95 * broad + 85 * ridge * ridge);
      h += 80 * smoothstep(70, 0, d) * (0.7 + 0.3 * broad); // steep final wall
    }
    return h;
  };

  for (let j = 0; j < N; j++) {
    const z = wx(j);
    for (let i = 0; i < N; i++) H[j * N + i] = baseHeight(wx(i), z);
    if ((j & 63) === 0) onProgress(0.05 + 0.35 * (j / N));
  }

  const sampleH = (x, z) => {
    const fi = clamp(gx(x), 0, N - 1.001), fj = clamp(gx(z), 0, N - 1.001);
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    const a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };

  // ---- 2. Lake: in the lowest basin of the inner land ----
  let best = { x: 0, z: 0, h: Infinity };
  for (let z = -520; z <= 520; z += 16) {
    for (let x = -520; x <= 520; x += 16) {
      const h = sampleH(x, z) + 0.004 * Math.hypot(x, z); // slight pull toward the middle
      if (h < best.h) best = { x, z, h };
    }
  }
  const lake = { x: best.x, z: best.z, radius: 95 + rand() * 45, level: 0, depth: 6 + rand() * 3 };
  // Water level = basin floor a bit above the lowest point so it fills like a real lake.
  let ringMin = Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    ringMin = Math.min(ringMin, sampleH(lake.x + Math.cos(a) * lake.radius, lake.z + Math.sin(a) * lake.radius));
  }
  lake.level = Math.min(ringMin, best.h + 4) - 0.6;

  const lakeShape = (x, z) => {
    // irregular shoreline: radius wobbles with noise
    const wob = 1 + 0.28 * nShape.fbm(x * 0.008, z * 0.008, 3);
    return Math.hypot(x - lake.x, z - lake.z) / (lake.radius * wob);
  };

  for (let j = 0; j < N; j++) {
    const z = wx(j);
    if (Math.abs(z - lake.z) > lake.radius * 2.2) continue;
    for (let i = 0; i < N; i++) {
      const x = wx(i);
      if (Math.abs(x - lake.x) > lake.radius * 2.2) continue;
      const r = lakeShape(x, z);
      if (r > 1.9) continue;
      const k = j * N + i;
      let target;
      if (r < 1) target = lake.level - lake.depth * (1 - r * r) * (0.75 + 0.25 * nDetail.noise(x * 0.02, z * 0.02)) - 0.25;
      else target = lake.level - 0.25 + (r - 1) * lake.radius * 0.07;
      const t = smoothstep(1.0, 1.9, r);
      H[k] = Math.min(H[k], lerp(target, H[k], t));
    }
  }
  onProgress(0.45);

  // ---- 3. River: from a mountain spring, downhill into the lake ----
  const river = carveRiver(H, sampleH, lake, rand, nShape);
  onProgress(0.7);

  // ---- 4. Water surface heights (lake + river) ----
  const W = new Float32Array(N * N).fill(-1e9);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const x = wx(i), z = wx(j);
      if (Math.abs(x - lake.x) < lake.radius * 2 && Math.abs(z - lake.z) < lake.radius * 2 && lakeShape(x, z) < 1.6) {
        if (H[k] < lake.level) W[k] = lake.level;
      }
    }
  }
  stampRiverWater(W, H, river);

  // ---- 5. Moisture + forest density + rockiness ----
  const RES = 512; // map texel = 4 m
  const maps = new Uint8Array(RES * RES * 4); // R forest, G moisture, B rock, A meadow flowers
  const nForest = new Simplex(seed + 5);
  const nForest2 = new Simplex(seed + 6);
  const distWater = waterDistanceField(W, RES);
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      const px = (x + 0.5) / RES * WORLD_SIZE - HALF;
      const pz = (y + 0.5) / RES * WORLD_SIZE - HALF;
      const h = sampleH(px, pz);
      const sx = sampleH(px + 4, pz) - sampleH(px - 4, pz);
      const sz = sampleH(px, pz + 4) - sampleH(px, pz - 4);
      const slope = Math.hypot(sx, sz) / 8; // rise over run
      const dw = distWater[y * RES + x];
      const moisture = clamp(1 - dw / 120, 0, 1);
      let forest = nForest.fbm(px * 0.0032, pz * 0.0032, 4) * 0.9 + nForest2.noise(px * 0.012, pz * 0.012) * 0.25 + 0.12;
      forest = smoothstep(-0.05, 0.3, forest);
      forest *= smoothstep(0.85, 0.45, slope);              // not on cliffs
      forest *= smoothstep(260, 170, h);                    // tree line
      forest *= smoothstep(6, 18, dw);                      // banks stay open
      const rock = clamp(smoothstep(0.55, 1.0, slope) + smoothstep(170, 240, h), 0, 1);
      const flowers = smoothstep(0.1, 0.5, nForest2.fbm(px * 0.02, pz * 0.02, 2)) * (1 - forest) * (1 - rock);
      const o = (y * RES + x) * 4;
      maps[o] = forest * 255;
      maps[o + 1] = moisture * 255;
      maps[o + 2] = rock * 255;
      maps[o + 3] = flowers * 255;
    }
  }
  onProgress(0.85);

  // ---- 6. Spawn point: open meadow with a view of the lake ----
  const spawn = findSpawn(sampleH, maps, RES, lake, rand);

  return { seed, H, W, maps, mapsRes: RES, lake, river, spawn, sampleH, baseHeight };
}

// Exact height on the same triangles the physics engine uses (see terrain.js).
export function heightAt(H, x, z) {
  const fi = clamp(gx(x), 0, N - 1.0001), fj = clamp(gx(z), 0, N - 1.0001);
  const i = Math.floor(fi), j = Math.floor(fj);
  const u = fi - i, v = fj - j;
  const a = H[j * N + i];           // (i, j)
  const b = H[(j + 1) * N + i];     // (i, j+1)
  const c = H[j * N + i + 1];       // (i+1, j)
  const d = H[(j + 1) * N + i + 1]; // (i+1, j+1)
  if (u + v <= 1) return a + (c - a) * u + (b - a) * v;
  return d + (b - d) * (1 - u) + (c - d) * (1 - v);
}

export function waterAt(W, x, z) {
  const i = Math.round(clamp(gx(x), 0, N - 1)), j = Math.round(clamp(gx(z), 0, N - 1));
  return W[j * N + i];
}

// ------------------------------------------------------------------

function carveRiver(H, sampleH, lake, rand, nShape) {
  // Spring: up in the edge mountains, on the far side from the lake.
  const awayAngle = Math.atan2(-lake.z, -lake.x) + (rand() - 0.5) * 1.2;
  const springR = HALF - 230;
  const src = { x: Math.cos(awayAngle) * springR, z: Math.sin(awayAngle) * springR };
  // If the lake is near the middle, any direction works; keep the spring inside the map.
  src.x = clamp(src.x, -HALF + 220, HALF - 220);
  src.z = clamp(src.z, -HALF + 220, HALF - 220);

  // A* on a coarse grid: prefers going downhill and through low ground (like water does).
  const G = 128, C = WORLD_SIZE / G;
  const cell = (x) => clamp(Math.floor((x + HALF) / C), 0, G - 1);
  const ch = new Float32Array(G * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) ch[j * G + i] = sampleH(i * C - HALF + C / 2, j * C - HALF + C / 2);
  const start = cell(src.z) * G + cell(src.x);
  const goal = cell(lake.z) * G + cell(lake.x);
  const gScore = new Float32Array(G * G).fill(Infinity);
  const came = new Int32Array(G * G).fill(-1);
  const open = new MinHeap();
  gScore[start] = 0;
  open.push(start, 0);
  const gxz = (k) => [k % G, Math.floor(k / G)];
  const [goX, goZ] = gxz(goal);
  while (open.size) {
    const cur = open.pop();
    if (cur === goal) break;
    const [cx, cz] = gxz(cur);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 1 || nz < 1 || nx >= G - 1 || nz >= G - 1) continue;
      const nk = nz * G + nx;
      const rise = ch[nk] - ch[cur];
      const dist = Math.hypot(dx, dz);
      const cost = dist * (1 + Math.max(0, rise) * 3.5 + ch[nk] * 0.004) + Math.max(0, -rise) * 0.02;
      const g2 = gScore[cur] + cost;
      if (g2 < gScore[nk]) {
        gScore[nk] = g2;
        came[nk] = cur;
        open.push(nk, g2 + Math.hypot(nx - goX, nz - goZ) * 0.9);
      }
    }
  }
  let pts = [];
  for (let k = goal; k !== -1; k = came[k]) {
    const [i, j] = gxz(k);
    pts.push({ x: i * C - HALF + C / 2, z: j * C - HALF + C / 2 });
    if (k === start) break;
  }
  pts.reverse();
  pts[0] = { x: src.x, z: src.z };
  // Stop where it reaches the lake shore (water takes over there).
  // Smooth (Chaikin) and add natural meanders.
  for (let it = 0; it < 4; it++) pts = chaikin(pts);
  pts = resample(pts, 4);
  for (let k = 1; k < pts.length - 1; k++) {
    const p = pts[k];
    const tx = pts[k + 1].x - pts[k - 1].x, tz = pts[k + 1].z - pts[k - 1].z;
    const tl = Math.hypot(tx, tz) || 1;
    const m = 14 * nShape.noise(k * 0.035, 3.7);
    p.x += (-tz / tl) * m;
    p.z += (tx / tl) * m;
  }
  pts = resample(chaikin(chaikin(pts)), 3);

  // Width + depth grow downstream; the bed never goes uphill.
  const total = pts.length;
  let bed = Infinity;
  for (let k = 0; k < total; k++) {
    const p = pts[k];
    const t = k / (total - 1);
    p.width = lerp(2.5, 13, Math.pow(t, 0.7));
    p.depth = lerp(0.35, 1.7, t);
    const ground = Math.min(sampleH(p.x, p.z), sampleH(p.x + 2, p.z), sampleH(p.x - 2, p.z), sampleH(p.x, p.z + 2), sampleH(p.x, p.z - 2));
    const target = Math.min(ground - p.depth - 0.15, bed - 0.004 * 3);
    bed = Math.max(target, lake.level - lake.depth); // don't dig below the lake bottom
    p.bed = bed;
    p.surface = bed + p.depth;
  }
  // Last stretch meets the lake level smoothly.
  for (let k = 0; k < total; k++) {
    const p = pts[k];
    if (p.surface < lake.level) { p.surface = lake.level; p.bed = Math.min(p.bed, lake.level - p.depth); }
  }

  // Carve the channel + banks into the heightmap.
  const grid = new SegmentGrid(pts, 24);
  const reach = 13 / 2 + 16;
  for (let j = 0; j < N; j++) {
    const z = wx(j);
    for (let i = 0; i < N; i++) {
      const x = wx(i);
      const hit = grid.nearest(x, z, reach);
      if (!hit) continue;
      const p = hit.point;
      const half = p.width / 2;
      const d = hit.dist;
      let target;
      if (d < half) target = p.bed + p.depth * Math.pow(d / half, 2) - 0.05;
      else target = p.surface + 0.1 + (d - half) * 0.22;
      const k = j * N + i;
      if (target < H[k]) {
        const t = smoothstep(half + 14, half + 2, d);
        H[k] = lerp(H[k], target, Math.max(t, d < half + 1 ? 1 : 0));
      }
    }
  }
  return { points: pts, grid };
}

function stampRiverWater(W, H, river) {
  for (let j = 0; j < N; j++) {
    const z = wx(j);
    for (let i = 0; i < N; i++) {
      const x = wx(i);
      const hit = river.grid.nearest(x, z, 10);
      if (!hit) continue;
      const p = hit.point;
      const k = j * N + i;
      if (hit.dist < p.width / 2 + 1.5 && H[k] < p.surface) W[k] = Math.max(W[k], p.surface);
    }
  }
}

function waterDistanceField(W, RES) {
  // Coarse distance (in meters) from each map texel to the nearest water.
  const out = new Float32Array(RES * RES).fill(1e6);
  const step = WORLD_SIZE / RES;
  const queue = [];
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const i = Math.round(((x + 0.5) * step) / CELL), j = Math.round(((y + 0.5) * step) / CELL);
    if (W[Math.min(j, N - 1) * N + Math.min(i, N - 1)] > -1e8) { out[y * RES + x] = 0; queue.push(y * RES + x); }
  }
  // Breadth-first spread (8-neighbour chamfer)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
      const k = y * RES + x;
      let v = out[k];
      if (x > 0) v = Math.min(v, out[k - 1] + step);
      if (y > 0) v = Math.min(v, out[k - RES] + step);
      if (x > 0 && y > 0) v = Math.min(v, out[k - RES - 1] + step * 1.414);
      if (x < RES - 1 && y > 0) v = Math.min(v, out[k - RES + 1] + step * 1.414);
      out[k] = v;
    }
    for (let y = RES - 1; y >= 0; y--) for (let x = RES - 1; x >= 0; x--) {
      const k = y * RES + x;
      let v = out[k];
      if (x < RES - 1) v = Math.min(v, out[k + 1] + step);
      if (y < RES - 1) v = Math.min(v, out[k + RES] + step);
      if (x < RES - 1 && y < RES - 1) v = Math.min(v, out[k + RES + 1] + step * 1.414);
      if (x > 0 && y < RES - 1) v = Math.min(v, out[k + RES - 1] + step * 1.414);
      out[k] = v;
    }
  }
  return out;
}

function findSpawn(sampleH, maps, RES, lake, rand) {
  let best = null;
  for (let tries = 0; tries < 400; tries++) {
    const a = rand() * Math.PI * 2;
    const r = lake.radius * (1.6 + rand() * 1.4);
    const x = lake.x + Math.cos(a) * r, z = lake.z + Math.sin(a) * r;
    if (Math.abs(x) > HALF - 400 || Math.abs(z) > HALF - 400) continue;
    const mx = clamp(Math.floor((x + HALF) / WORLD_SIZE * RES), 0, RES - 1);
    const mz = clamp(Math.floor((z + HALF) / WORLD_SIZE * RES), 0, RES - 1);
    const o = (mz * RES + mx) * 4;
    const forest = maps[o] / 255, rock = maps[o + 2] / 255;
    const h = sampleH(x, z);
    const slope = Math.abs(sampleH(x + 3, z) - sampleH(x - 3, z)) + Math.abs(sampleH(x, z + 3) - sampleH(x, z - 3));
    if (h < lake.level + 1.5) continue;
    const score = (1 - forest) * 2 + (1 - rock) - slope * 0.5 + (h - lake.level) * 0.03;
    if (!best || score > best.score) best = { x, z, score, yaw: Math.atan2(-(lake.x - x), -(lake.z - z)) };
  }
  return best || { x: 0, z: 0, yaw: 0 };
}

function chaikin(pts) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
    out.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function resample(pts, spacing) {
  const out = [{ ...pts[0] }];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    let t = spacing - carry;
    while (t <= len) {
      out.push({ x: a.x + (b.x - a.x) * (t / len), z: a.z + (b.z - a.z) * (t / len) });
      t += spacing;
    }
    carry = len - (t - spacing);
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

// Spatial hash of polyline segments for fast "nearest point on the river" queries.
export class SegmentGrid {
  constructor(points, cellSize) {
    this.points = points;
    this.cs = cellSize;
    this.map = new Map();
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k], b = points[k + 1];
      const minx = Math.floor((Math.min(a.x, b.x) - 20) / cellSize), maxx = Math.floor((Math.max(a.x, b.x) + 20) / cellSize);
      const minz = Math.floor((Math.min(a.z, b.z) - 20) / cellSize), maxz = Math.floor((Math.max(a.z, b.z) + 20) / cellSize);
      for (let cz = minz; cz <= maxz; cz++) for (let cx = minx; cx <= maxx; cx++) {
        const key = cx * 73856093 ^ cz * 19349663;
        let arr = this.map.get(key);
        if (!arr) this.map.set(key, (arr = []));
        arr.push(k);
      }
    }
  }

  nearest(x, z, maxDist) {
    const key = Math.floor(x / this.cs) * 73856093 ^ Math.floor(z / this.cs) * 19349663;
    const arr = this.map.get(key);
    if (!arr) return null;
    let best = null, bestD = maxDist;
    for (const k of arr) {
      const a = this.points[k], b = this.points[k + 1];
      const vx = b.x - a.x, vz = b.z - a.z;
      const l2 = vx * vx + vz * vz || 1;
      const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / l2, 0, 1);
      const px = a.x + vx * t, pz = a.z + vz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < bestD) {
        bestD = d;
        const lerpPt = (key2) => lerp(a[key2], b[key2], t);
        best = { dist: d, index: k + t, point: { width: lerpPt('width'), depth: lerpPt('depth'), bed: lerpPt('bed'), surface: lerpPt('surface') }, dir: { x: vx, z: vz } };
      }
    }
    return best;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [k[par], k[i]] = [k[i], k[par]]; [p[par], p[i]] = [p[i], p[par]];
      i = par;
    }
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return top;
  }
}
