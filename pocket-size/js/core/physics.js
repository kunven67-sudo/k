// Tiny-scale character physics: a vertical cylinder body sliding against yaw-rotated boxes,
// cylinders, ramps and an optional terrain height function. Also ray casting and trigger volumes.
import * as THREE from 'three';

const CELL = 40;

export class World {
  constructor() {
    this.boxes = [];
    this.cyls = [];
    this.ramps = [];
    this.dynamic = [];
    this.triggers = [];
    this.grid = new Map();
    this.groundFn = null;        // (x, z) => height | -Infinity
    this.groundSurface = 'dirt';
    this.killY = -500;
    this._stamp = 0;
    this.gravity = 34;
    this.terminal = 22;          // tiny things fall slowly: low terminal velocity
  }

  _insert(shape, minX, minZ, maxX, maxZ) {
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    shape._cells = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = x * 73856093 ^ z * 19349663;
      let arr = this.grid.get(k);
      if (!arr) { arr = []; this.grid.set(k, arr); }
      arr.push(shape);
      shape._cells.push(k);
    }
  }

  _query(x, z, r, out) {
    this._stamp++;
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    out.length = 0;
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const arr = this.grid.get(cx * 73856093 ^ cz * 19349663);
      if (!arr) continue;
      for (const s of arr) if (s._stamp !== this._stamp && !s.disabled) { s._stamp = this._stamp; out.push(s); }
    }
    for (const d of this.dynamic) if (!d.disabled) out.push(d);
    return out;
  }

  // Box from center + half extents, optionally rotated about Y by `yaw`.
  addBox(cx, cy, cz, hx, hy, hz, props = {}) {
    const yaw = props.yaw || 0;
    const b = { type: 'box', cx, cy, cz, hx, hy, hz, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw), ...props };
    const R = Math.hypot(hx, hz);
    if (props.dynamic) this.dynamic.push(b);
    else { this.boxes.push(b); this._insert(b, cx - R, cz - R, cx + R, cz + R); }
    return b;
  }

  // Box from min/max corners (axis aligned).
  addAABB(minX, minY, minZ, maxX, maxY, maxZ, props = {}) {
    return this.addBox((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2, (maxX - minX) / 2, (maxY - minY) / 2, (maxZ - minZ) / 2, props);
  }

  // Box that exactly matches a mesh's world-space bounding box (only valid for unrotated meshes).
  addFromObject(obj, props = {}) {
    const bb = new THREE.Box3().setFromObject(obj);
    return this.addAABB(bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z, props);
  }

  addCylinder(x, z, r, y0, y1, props = {}) {
    const c = { type: 'cyl', x, z, r, y0, y1, ...props };
    if (props.dynamic) this.dynamic.push(c);
    else { this.cyls.push(c); this._insert(c, x - r, z - r, x + r, z + r); }
    return c;
  }

  // Walkable slab whose top rises linearly along its local X from yLow to yHigh.
  addRamp(cx, cz, hx, hz, yaw, yLow, yHigh, thick = 1, props = {}) {
    const r = { type: 'ramp', cx, cz, hx, hz, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw), yLow, yHigh, thick, ...props };
    const R = Math.hypot(hx, hz);
    this.ramps.push(r);
    this._insert(r, cx - R, cz - R, cx + R, cz + R);
    return r;
  }

  remove(shape) {
    shape.disabled = true;
    const lists = [this.boxes, this.cyls, this.ramps, this.dynamic];
    for (const l of lists) { const i = l.indexOf(shape); if (i >= 0) l.splice(i, 1); }
    if (shape._cells) for (const k of shape._cells) {
      const arr = this.grid.get(k);
      if (arr) { const i = arr.indexOf(shape); if (i >= 0) arr.splice(i, 1); }
    }
  }

  addTrigger(minX, minY, minZ, maxX, maxY, maxZ, handlers = {}) {
    const t = { minX, minY, minZ, maxX, maxY, maxZ, inside: false, enabled: true, ...handlers };
    this.triggers.push(t);
    return t;
  }

  addSphereTrigger(x, y, z, r, handlers = {}) {
    const t = { sphere: true, x, y, z, r, inside: false, enabled: true, ...handlers };
    this.triggers.push(t);
    return t;
  }

  updateTriggers(body, dt) {
    const p = body.pos;
    const cy = p.y + body.height * 0.5;
    for (const t of this.triggers) {
      if (!t.enabled) continue;
      let inside;
      if (t.sphere) inside = Math.hypot(p.x - t.x, cy - t.y, p.z - t.z) < t.r;
      else inside = p.x > t.minX && p.x < t.maxX && p.z > t.minZ && p.z < t.maxZ && cy > t.minY && p.y < t.maxY;
      if (inside && !t.inside) { t.inside = true; if (t.onEnter) t.onEnter(t); }
      else if (!inside && t.inside) { t.inside = false; if (t.onExit) t.onExit(t); }
      if (inside && t.onStay) t.onStay(t, dt);
    }
  }

  ground(x, z) { return this.groundFn ? this.groundFn(x, z) : -Infinity; }

  // Moves a character body {pos, vel, radius, height, stepHeight} through the world.
  move(body, dt, opts = {}) {
    const speed = Math.hypot(body.vel.x, body.vel.y, body.vel.z);
    const steps = Math.min(10, Math.max(1, Math.ceil((speed * dt) / (body.radius * 0.6))));
    const h = dt / steps;
    const wasGrounded = body.grounded;
    body.grounded = false;
    body.hitWall = false;
    body.groundShape = null;
    const cand = body._cand || (body._cand = []);
    for (let s = 0; s < steps; s++) {
      const prevY = body.pos.y;
      body.pos.x += body.vel.x * h;
      body.pos.y += body.vel.y * h;
      body.pos.z += body.vel.z * h;
      this._query(body.pos.x, body.pos.z, body.radius + 2, cand);
      for (const sh of cand) {
        if (sh.noCollide || (opts.ignore && opts.ignore(sh))) continue;
        if (sh.type === 'box') this._resolveBox(body, sh, prevY, wasGrounded || body.grounded);
        else if (sh.type === 'cyl') this._resolveCyl(body, sh, prevY, wasGrounded || body.grounded);
        else if (sh.type === 'ramp') this._resolveRamp(body, sh, prevY);
      }
      if (this.groundFn) {
        const g = this.groundFn(body.pos.x, body.pos.z);
        if (body.pos.y <= g + 0.001) {
          body.pos.y = g;
          if (body.vel.y < 0) { body.landSpeed = -body.vel.y; body.vel.y = 0; }
          body.grounded = true;
          body.groundShape = null;
          body.surface = this.groundSurface;
        } else if ((wasGrounded || body.grounded) && body.vel.y <= 0 && body.pos.y - g < (body.stepHeight || 0.4) * 0.6 && !body.groundShape) {
          // stick to gentle downhill terrain instead of skipping off it
          body.pos.y = g; body.grounded = true; body.surface = this.groundSurface;
        }
      }
    }
    return body;
  }

  _resolveBox(b, box, prevY, grounded) {
    const top = box.cy + box.hy, bot = box.cy - box.hy;
    const py = b.pos.y;
    if (py >= top - 1e-4 || py + b.height <= bot) {
      // Not overlapping vertically - but maybe standing right on top.
      if (Math.abs(py - top) < 0.02 && b.vel.y <= 0) {
        if (this._footprint(b, box) < b.radius * 0.6) { b.grounded = true; b.groundShape = box; b.surface = box.surface || 'wood'; if (b.vel.y < 0) b.vel.y = 0; }
      }
      return;
    }
    const dx = b.pos.x - box.cx, dz = b.pos.z - box.cz;
    const lx = dx * box.cos - dz * box.sin;
    const lz = dx * box.sin + dz * box.cos;
    const qx = Math.max(-box.hx, Math.min(box.hx, lx));
    const qz = Math.max(-box.hz, Math.min(box.hz, lz));
    const ddx = lx - qx, ddz = lz - qz;
    const d2 = ddx * ddx + ddz * ddz;
    const r = b.radius;
    if (d2 >= r * r) return;
    // Landing on top (came from above) or stepping up a small ledge.
    const stepH = b.stepHeight || 0.4;
    const insideish = d2 < (r * 0.75) * (r * 0.75);
    if ((prevY >= top - 0.05 && b.vel.y <= 0.01) || (grounded && top - py <= stepH && top - py > 0 && insideish && !box.noStep)) {
      if (b.vel.y < 0) b.landSpeed = -b.vel.y;
      b.pos.y = top;
      if (b.vel.y < 0) b.vel.y = 0;
      b.grounded = true; b.groundShape = box; b.surface = box.surface || 'wood';
      return;
    }
    // Bumping head from below.
    if (prevY + b.height <= bot + 0.05 && b.vel.y > 0) {
      b.pos.y = bot - b.height; b.vel.y = 0;
      return;
    }
    let nx, nz, push;
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2);
      nx = ddx / d; nz = ddz / d; push = r - d;
    } else {
      const px = box.hx - Math.abs(lx), pz = box.hz - Math.abs(lz);
      if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + r; }
      else { nx = 0; nz = Math.sign(lz) || 1; push = pz + r; }
    }
    const wx = nx * box.cos + nz * box.sin;
    const wz = -nx * box.sin + nz * box.cos;
    b.pos.x += wx * push; b.pos.z += wz * push;
    const vn = b.vel.x * wx + b.vel.z * wz;
    if (vn < 0) { b.vel.x -= wx * vn; b.vel.z -= wz * vn; }
    b.hitWall = true;
    b.wallShape = box;
  }

  _footprint(b, box) {
    const dx = b.pos.x - box.cx, dz = b.pos.z - box.cz;
    const lx = dx * box.cos - dz * box.sin;
    const lz = dx * box.sin + dz * box.cos;
    const qx = Math.max(-box.hx, Math.min(box.hx, lx));
    const qz = Math.max(-box.hz, Math.min(box.hz, lz));
    return Math.hypot(lx - qx, lz - qz);
  }

  _resolveCyl(b, c, prevY, grounded) {
    const py = b.pos.y;
    if (py >= c.y1 - 1e-4 || py + b.height <= c.y0) return;
    const dx = b.pos.x - c.x, dz = b.pos.z - c.z;
    const d = Math.hypot(dx, dz);
    const R = c.r + b.radius;
    if (d >= R) return;
    if ((prevY >= c.y1 - 0.05 && b.vel.y <= 0.01) || (grounded && c.y1 - py <= (b.stepHeight || 0.4) && d < c.r)) {
      if (b.vel.y < 0) b.landSpeed = -b.vel.y;
      b.pos.y = c.y1; if (b.vel.y < 0) b.vel.y = 0;
      b.grounded = true; b.groundShape = c; b.surface = c.surface || 'wood';
      return;
    }
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
    const push = R - d;
    b.pos.x += nx * push; b.pos.z += nz * push;
    const vn = b.vel.x * nx + b.vel.z * nz;
    if (vn < 0) { b.vel.x -= nx * vn; b.vel.z -= nz * vn; }
    b.hitWall = true;
    b.wallShape = c;
  }

  rampHeight(r, x, z) {
    const dx = x - r.cx, dz = z - r.cz;
    const lx = dx * r.cos - dz * r.sin;
    const lz = dx * r.sin + dz * r.cos;
    if (Math.abs(lx) > r.hx || Math.abs(lz) > r.hz) return null;
    return r.yLow + ((lx + r.hx) / (2 * r.hx)) * (r.yHigh - r.yLow);
  }

  _resolveRamp(b, r, prevY) {
    const top = this.rampHeight(r, b.pos.x, b.pos.z);
    if (top === null) return;
    if (b.pos.y <= top + 0.05 && b.pos.y >= top - r.thick - 0.6 && b.vel.y <= 0.5) {
      if (b.vel.y < 0) b.landSpeed = -b.vel.y;
      b.pos.y = top;
      if (b.vel.y < 0) b.vel.y = 0;
      b.grounded = true; b.groundShape = r; b.surface = r.surface || 'wood';
    }
  }

  // Highest walkable surface below (x, y, z): used to drop pickups and spawn things.
  surfaceBelow(x, y, z) {
    let best = this.groundFn ? this.groundFn(x, z) : -Infinity;
    const cand = [];
    this._query(x, z, 0.5, cand);
    for (const s of cand) {
      let top = null;
      if (s.type === 'box') {
        const dx = x - s.cx, dz = z - s.cz;
        const lx = dx * s.cos - dz * s.sin, lz = dx * s.sin + dz * s.cos;
        if (Math.abs(lx) <= s.hx && Math.abs(lz) <= s.hz) top = s.cy + s.hy;
      } else if (s.type === 'cyl') {
        if (Math.hypot(x - s.x, z - s.z) <= s.r) top = s.y1;
      } else if (s.type === 'ramp') top = this.rampHeight(s, x, z);
      if (top !== null && top <= y + 0.01 && top > best) best = top;
    }
    return best;
  }

  // Ray vs every collider (+ terrain). Returns distance or Infinity.
  raycast(o, d, maxDist, filter) {
    let best = maxDist;
    const cand = [];
    // Collect cells along the ray.
    const steps = Math.ceil(maxDist / (CELL * 0.5));
    const seen = new Set();
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(maxDist, i * CELL * 0.5);
      this._query(o.x + d.x * t, o.z + d.z * t, CELL * 0.5, cand);
      for (const s of cand) {
        if (seen.has(s)) continue;
        seen.add(s);
        if (filter && !filter(s)) continue;
        if (s.noCollide && !s.blocksRay) continue;
        let hit = Infinity;
        if (s.type === 'box') hit = rayBox(o, d, s);
        else if (s.type === 'cyl') hit = rayCyl(o, d, s);
        if (hit < best) best = hit;
      }
    }
    if (this.groundFn) {
      const step = Math.max(0.5, maxDist / 60);
      for (let t = 0; t < best; t += step) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        if (y < this.groundFn(x, z)) { best = Math.max(0, t - step * 0.5); break; }
      }
    }
    return best;
  }
}

function rayBox(o, d, b) {
  const dx = o.x - b.cx, dz = o.z - b.cz;
  const ox = dx * b.cos - dz * b.sin, oz = dx * b.sin + dz * b.cos, oy = o.y - b.cy;
  const vx = d.x * b.cos - d.z * b.sin, vz = d.x * b.sin + d.z * b.cos, vy = d.y;
  let tmin = -Infinity, tmax = Infinity;
  const slab = (oo, vv, h) => {
    if (Math.abs(vv) < 1e-9) return oo >= -h && oo <= h;
    let t1 = (-h - oo) / vv, t2 = (h - oo) / vv;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    return tmin <= tmax;
  };
  if (!slab(ox, vx, b.hx) || !slab(oy, vy, b.hy) || !slab(oz, vz, b.hz)) return Infinity;
  if (tmax < 0) return Infinity;
  return tmin >= 0 ? tmin : Infinity; // origin inside: ignore (camera-inside-geometry case handled elsewhere)
}

function rayCyl(o, d, c) {
  const ox = o.x - c.x, oz = o.z - c.z;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return Infinity;
  const bq = 2 * (ox * d.x + oz * d.z);
  const cq = ox * ox + oz * oz - c.r * c.r;
  const disc = bq * bq - 4 * a * cq;
  if (disc < 0) return Infinity;
  const t = (-bq - Math.sqrt(disc)) / (2 * a);
  if (t < 0) return Infinity;
  const y = o.y + d.y * t;
  if (y < c.y0 || y > c.y1) return Infinity;
  return t;
}

export function makeBody(radius = 0.42, height = 1.8) {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius, height,
    grounded: false, stepHeight: 0.55, surface: 'wood', landSpeed: 0, groundShape: null,
  };
}
