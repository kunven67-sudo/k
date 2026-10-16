// Static collision: boxes you can stand on / bump into, plus height fields (the cage ground).
// Works at any size: a 3 cm person and a 20 m giant use the same shapes.
import * as THREE from 'three';

const CELL = 1.5;

export class Colliders {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
    this.fields = [];
  }

  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

  add(minX, minY, minZ, maxX, maxY, maxZ, opts = {}) {
    const b = { min: [minX, minY, minZ], max: [maxX, maxY, maxZ], on: true, solid: opts.solid !== false, walk: opts.walk !== false, tag: opts.tag || '', zone: opts.zone || '', mat: opts.mat || 'hard' };
    this.boxes.push(b);
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL), z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = this.key(ix, iz);
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(b);
    }
    return b;
  }

  // box around a mesh-like footprint (center + size)
  addCentered(cx, cy, cz, sx, sy, sz, opts) { return this.add(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, opts); }

  addField(f) { this.fields.push(f); return f; }

  near(x, z, r = 0) {
    const out = [];
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    const seen = new Set();
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const arr = this.grid.get(this.key(ix, iz));
      if (!arr) continue;
      for (const b of arr) if (b.on && !seen.has(b)) { seen.add(b); out.push(b); }
    }
    return out;
  }

  fieldAt(x, z) {
    for (const f of this.fields) if (f.on !== false && x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) return f;
    return null;
  }

  // Highest walkable surface at (x,z) that is not above yTop.
  groundAt(x, z, yTop, r = 0) {
    let best = -Infinity, hit = null;
    const f = this.fieldAt(x, z);
    if (f) {
      const h = f.height(x, z);
      if (h <= yTop && h > best) { best = h; hit = f; }
    }
    for (const b of this.near(x, z, r)) {
      if (!b.walk) continue;
      if (x < b.min[0] - r || x > b.max[0] + r || z < b.min[2] - r || z > b.max[2] + r) continue;
      if (r > 0 && (x < b.min[0] || x > b.max[0] || z < b.min[2] || z > b.max[2])) {
        // only counts if mostly over the box
        const ox = Math.max(0, b.min[0] - x, x - b.max[0]), oz = Math.max(0, b.min[2] - z, z - b.max[2]);
        if (Math.hypot(ox, oz) > r * 0.6) continue;
      }
      const top = b.max[1];
      if (top <= yTop && top > best) { best = top; hit = b; }
    }
    return { y: best, hit };
  }

  // Push a vertical cylinder out of solid boxes. pos = feet. Returns true if it touched something.
  resolve(pos, radius, height, step) {
    let touched = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.near(pos.x, pos.z, radius + 0.01)) {
        if (!b.solid) continue;
        if (b.max[1] <= pos.y + step || b.min[1] >= pos.y + height) continue;
        const cx = Math.max(b.min[0], Math.min(pos.x, b.max[0]));
        const cz = Math.max(b.min[2], Math.min(pos.z, b.max[2]));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        touched = true;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // center inside the box: push out the shortest way
          const pl = pos.x - b.min[0], pr = b.max[0] - pos.x, pb = pos.z - b.min[2], pf = b.max[2] - pos.z;
          const m = Math.min(pl, pr, pb, pf);
          if (m === pl) pos.x = b.min[0] - radius; else if (m === pr) pos.x = b.max[0] + radius;
          else if (m === pb) pos.z = b.min[2] - radius; else pos.z = b.max[2] + radius;
        }
      }
    }
    return touched;
  }

  // Lowest ceiling above y at (x,z) (so you bonk your head)
  ceilingAt(x, z, y, r = 0) {
    let best = Infinity;
    for (const b of this.near(x, z, r)) {
      if (!b.solid) continue;
      if (x < b.min[0] - r || x > b.max[0] + r || z < b.min[2] - r || z > b.max[2] + r) continue;
      if (b.min[1] >= y && b.min[1] < best) best = b.min[1];
    }
    return best;
  }

  // Ray vs boxes + fields. Returns {dist, point, normal, box} or null.
  raycast(origin, dir, maxDist, onlySolid = true, skip = null) {
    let best = maxDist, bestBox = null, bestN = null;
    const inv = [1 / dir.x, 1 / dir.y, 1 / dir.z];
    const o = [origin.x, origin.y, origin.z];
    const seen = new Set();
    // walk grid cells along the ray (coarse): sample every half cell
    const steps = Math.ceil(maxDist / (CELL * 0.5)) + 1;
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(maxDist, s * CELL * 0.5);
      if (t > best + CELL) break;
      const px = o[0] + dir.x * t, pz = o[2] + dir.z * t;
      for (const b of this.near(px, pz, CELL * 0.5)) {
        if (seen.has(b) || (onlySolid && !b.solid && !b.walk) || (skip && skip(b))) continue;
        seen.add(b);
        let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 1;
        for (let a = 0; a < 3; a++) {
          let t1 = (b.min[a] - o[a]) * inv[a], t2 = (b.max[a] - o[a]) * inv[a];
          let sg = -1;
          if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sg = 1; }
          if (t1 > tmin) { tmin = t1; axis = a; sign = sg; }
          if (t2 < tmax) tmax = t2;
        }
        if (tmax >= Math.max(0, tmin) && tmin >= 0 && tmin < best) {
          best = tmin; bestBox = b;
          bestN = [0, 0, 0]; bestN[axis] = sign;
        }
      }
    }
    for (const f of this.fields) {
      if (f.on === false) continue;
      const h = f.raycast(origin, dir, best);
      if (h !== null && h < best) { best = h; bestBox = f; bestN = [0, 1, 0]; }
    }
    if (!bestBox) return null;
    return { dist: best, point: new THREE.Vector3(o[0] + dir.x * best, o[1] + dir.y * best, o[2] + dir.z * best), normal: new THREE.Vector3(...bestN), box: bestBox };
  }
}
