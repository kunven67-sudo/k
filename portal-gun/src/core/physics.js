import * as THREE from '../three.js';

export const GRAVITY = -19;
const STEP_UP = 0.42;
const STEP_DOWN = 0.38;

let nextId = 1;

/** Axis-aligned solid box. Walls, floors, furniture, everything. */
export class Collider {
  constructor(minX, minY, minZ, maxX, maxY, maxZ, opts = {}) {
    this.id = nextId++;
    this.min = new THREE.Vector3(Math.min(minX, maxX), Math.min(minY, maxY), Math.min(minZ, maxZ));
    this.max = new THREE.Vector3(Math.max(minX, maxX), Math.max(minY, maxY), Math.max(minZ, maxZ));
    this.enabled = true;
    // portals can stick to it
    this.portalable = opts.portalable !== false;
    // bullets / portal blobs stop on it (invisible boundaries let them through)
    this.shootable = opts.shootable !== false;
    // characters bump into it
    this.solid = opts.solid !== false;
    this.surface = opts.surface || 'wood';
    this.tag = opts.tag || null;
  }
}

export class PhysicsWorld {
  constructor(cell = 4) {
    this.cell = cell;
    this.colliders = [];
    this.grid = new Map();
    this.groundY = 0;
    this.groundSurface = 'grass';
    this._stamp = 0;
    this._marks = new Map();
  }

  _key(ix, iz) {
    return (ix + 4096) * 8192 + (iz + 4096);
  }

  add(c) {
    this.colliders.push(c);
    const s = this.cell;
    const x0 = Math.floor(c.min.x / s), x1 = Math.floor(c.max.x / s);
    const z0 = Math.floor(c.min.z / s), z1 = Math.floor(c.max.z / s);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this._key(ix, iz);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(c);
      }
    }
    return c;
  }

  box(minX, minY, minZ, maxX, maxY, maxZ, opts) {
    return this.add(new Collider(minX, minY, minZ, maxX, maxY, maxZ, opts));
  }

  /** box from a center + size, handy when the visual mesh is built the same way */
  boxAt(x, y, z, w, h, d, opts) {
    return this.box(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2, opts);
  }

  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const stamp = ++this._stamp;
    const s = this.cell;
    const x0 = Math.floor(minX / s), x1 = Math.floor(maxX / s);
    const z0 = Math.floor(minZ / s), z1 = Math.floor(maxZ / s);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(this._key(ix, iz));
        if (!list) continue;
        for (const c of list) {
          if (this._marks.get(c.id) === stamp) continue;
          this._marks.set(c.id, stamp);
          if (c.enabled) out.push(c);
        }
      }
    }
    return out;
  }

  /**
   * Moves a vertical cylinder (feet at body.pos) by body.vel * dt, sliding
   * along walls, climbing stairs and landing on floors.
   */
  move(body, dt) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this._step(body, h);
  }

  _step(body, dt) {
    const p = body.pos;
    const v = body.vel;
    const r = body.radius;
    const cands = (this._cands ||= []);

    p.x += v.x * dt;
    p.z += v.z * dt;
    const stepAllow = body.grounded ? STEP_UP : 0.08;
    for (let iter = 0; iter < 3; iter++) {
      this.query(p.x - r - 0.2, p.z - r - 0.2, p.x + r + 0.2, p.z + r + 0.2, cands);
      let moved = false;
      for (const c of cands) {
        if (!c.solid) continue;
        if (c.max.y <= p.y + stepAllow) continue;
        if (c.min.y >= p.y + body.height) continue;
        const cx = Math.max(c.min.x, Math.min(p.x, c.max.x));
        const cz = Math.max(c.min.z, Math.min(p.z, c.max.z));
        const dx = p.x - cx;
        const dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          const nx = dx / d, nz = dz / d;
          p.x += nx * (r - d);
          p.z += nz * (r - d);
          const vn = v.x * nx + v.z * nz;
          if (vn < 0) {
            v.x -= vn * nx;
            v.z -= vn * nz;
          }
        } else {
          const l = p.x - c.min.x, rr = c.max.x - p.x, b = p.z - c.min.z, f = c.max.z - p.z;
          const m = Math.min(l, rr, b, f);
          if (m === l) { p.x = c.min.x - r; v.x = Math.min(v.x, 0); }
          else if (m === rr) { p.x = c.max.x + r; v.x = Math.max(v.x, 0); }
          else if (m === b) { p.z = c.min.z - r; v.z = Math.min(v.z, 0); }
          else { p.z = c.max.z + r; v.z = Math.max(v.z, 0); }
        }
        moved = true;
      }
      if (!moved) break;
    }

    // vertical
    const prevY = p.y;
    p.y += v.y * dt;
    const fr = r * 0.75;
    this.query(p.x - fr, p.z - fr, p.x + fr, p.z + fr, cands);
    let support = this.groundY;
    let surface = this.groundSurface;
    let ceiling = Infinity;
    const allow = body.grounded ? STEP_UP : 0.06;
    for (const c of cands) {
      if (!c.solid) continue;
      // circle-vs-rect overlap of the footprint
      const cx = Math.max(c.min.x, Math.min(p.x, c.max.x));
      const cz = Math.max(c.min.z, Math.min(p.z, c.max.z));
      if ((p.x - cx) ** 2 + (p.z - cz) ** 2 > fr * fr) continue;
      if (c.max.y <= prevY + allow && c.max.y > support) {
        support = c.max.y;
        surface = c.surface;
      } else if (c.min.y >= prevY + 0.3 && c.min.y < ceiling) {
        ceiling = c.min.y;
      }
    }
    if (p.y + body.height > ceiling) {
      p.y = Math.max(support, ceiling - body.height);
      if (v.y > 0) v.y = 0;
    }
    if (p.y <= support) {
      p.y = support;
      if (v.y < 0) v.y = 0;
      body.grounded = true;
      body.surface = surface;
    } else if (body.grounded && v.y <= 0 && p.y - support < STEP_DOWN) {
      p.y = support;
      v.y = 0;
      body.grounded = true;
      body.surface = surface;
    } else {
      body.grounded = false;
    }
  }

  /** Is a point inside any solid collider? */
  pointBlocked(x, y, z, pad = 0) {
    const cands = this.query(x - pad, z - pad, x + pad, z + pad, (this._pc ||= []));
    for (const c of cands) {
      if (!c.solid) continue;
      if (x > c.min.x - pad && x < c.max.x + pad && y > c.min.y - pad && y < c.max.y + pad && z > c.min.z - pad && z < c.max.z + pad) return c;
    }
    return null;
  }

  /**
   * Ray against every collider (and the ground plane).
   * filter(c) -> false skips a collider. Returns { dist, point, normal, collider } or null.
   */
  raycast(origin, dir, maxDist = 200, filter = null) {
    let best = maxDist;
    let hitC = null;
    let nx = 0, ny = 0, nz = 0;
    if (dir.y < -1e-6) {
      const t = (this.groundY - origin.y) / dir.y;
      if (t >= 0 && t < best) {
        best = t;
        hitC = 'ground';
        nx = 0; ny = 1; nz = 0;
      }
    }
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const ix = 1 / dir.x, iy = 1 / dir.y, iz = 1 / dir.z;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if (filter && !filter(c)) continue;
      let t1 = (c.min.x - ox) * ix, t2 = (c.max.x - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      let axis = 0;
      t1 = (c.min.y - oy) * iy; t2 = (c.max.y - oy) * iy;
      let a = Math.min(t1, t2), b = Math.max(t1, t2);
      if (a > tmin) { tmin = a; axis = 1; }
      if (b < tmax) tmax = b;
      t1 = (c.min.z - oz) * iz; t2 = (c.max.z - oz) * iz;
      a = Math.min(t1, t2); b = Math.max(t1, t2);
      if (a > tmin) { tmin = a; axis = 2; }
      if (b < tmax) tmax = b;
      // written so NaN (ray exactly on a face plane) is rejected too
      if (!(tmin >= 0 && tmin <= tmax && tmin < best)) continue;
      best = tmin;
      hitC = c;
      nx = ny = nz = 0;
      if (axis === 0) nx = dir.x > 0 ? -1 : 1;
      else if (axis === 1) ny = dir.y > 0 ? -1 : 1;
      else nz = dir.z > 0 ? -1 : 1;
    }
    if (!hitC) return null;
    return {
      dist: best,
      point: new THREE.Vector3(ox + dir.x * best, oy + dir.y * best, oz + dir.z * best),
      normal: new THREE.Vector3(nx, ny, nz),
      collider: hitC === 'ground' ? null : hitC,
      ground: hitC === 'ground',
    };
  }

  /** Height of the floor under a point (looking down from y). */
  floorBelow(x, y, z, maxDrop = 50) {
    const hit = this.raycast(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0), maxDrop, (c) => c.solid);
    return hit ? hit.point.y : this.groundY;
  }

  /** Clear line between two points? */
  lineOfSight(a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return true;
    d.divideScalar(len);
    const hit = this.raycast(a, d, len, (c) => c.solid && c.shootable);
    return !hit || hit.dist >= len - 0.05;
  }
}

export function makeBody(radius = 0.32, height = 1.8) {
  return {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    radius,
    height,
    grounded: false,
    surface: 'wood',
  };
}
