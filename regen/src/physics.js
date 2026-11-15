// Small physics for loose things: cut-off limbs, dropped weapons, props, thrown grenades.
// Flat ground at y = 0. Bodies are spheres for each other and boxes (yaw only) for walkers.
import * as THREE from 'three';

const G = -9.81;
export class Body {
  constructor(obj, { radius = 0.1, mass = 1, bounce = 0.25, friction = 0.6, box = null, upright = false, tumble = true } = {}) {
    this.obj = obj; this.vel = new THREE.Vector3(); this.ang = new THREE.Vector3();
    this.radius = radius; this.mass = mass; this.bounce = bounce; this.friction = friction;
    this.box = box; // {hx, hy, hz} half sizes in meters (for props: walkers bump into these)
    this.bottom = radius; // center height above ground when resting
    this.upright = upright; this.tumble = tumble; this.sleep = 0; this.ground = false; this.onLand = null; this.dead = false;
  }
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _b = new THREE.Box3();

export class Physics {
  constructor() { this.bodies = []; }
  add(b) { this.bodies.push(b); this.settleHeight(b); return b; }
  remove(b) { b.dead = true; }
  wake(b) { b.sleep = 0; }
  settleHeight(b) {
    // how far the lowest point sits below the center, in the current rotation
    b.obj.updateMatrixWorld(true); _b.setFromObject(b.obj);
    b.bottom = Math.max(0.02, b.obj.position.y - _b.min.y);
  }
  impulse(b, v) { b.vel.addScaledVector(v, 1 / Math.max(0.2, b.mass)); b.sleep = 0; if (b.tumble) b.ang.set((Math.random() - 0.5) * v.length(), (Math.random() - 0.5) * v.length(), (Math.random() - 0.5) * v.length()).multiplyScalar(2 / Math.max(1, Math.sqrt(b.mass))); }
  step(dt) {
    const B = this.bodies;
    for (let i = B.length - 1; i >= 0; i--) if (B[i].dead) B.splice(i, 1);
    for (const b of B) {
      if (b.sleep > 1) continue;
      const p = b.obj.position;
      b.vel.y += G * dt;
      p.addScaledVector(b.vel, dt);
      if (b.tumble && b.ang.lengthSq() > 1e-4) {
        _q.setFromAxisAngle(_v.copy(b.ang).normalize(), b.ang.length() * dt); b.obj.quaternion.premultiply(_q);
      }
      const floor = b.box ? this.boxBottom(b) : b.bottom;
      if (p.y < floor) {
        p.y = floor;
        const hit = -b.vel.y;
        if (b.vel.y < 0) b.vel.y = hit > 1.5 ? hit * b.bounce : 0;
        b.vel.x *= Math.max(0, 1 - b.friction * 8 * dt); b.vel.z *= Math.max(0, 1 - b.friction * 8 * dt);
        b.ang.multiplyScalar(Math.max(0, 1 - 6 * dt));
        if (b.onLand && hit > 2) b.onLand(b, hit);
        if (!b.ground) { b.ground = true; }
        if (b.vel.lengthSq() < 0.02 && b.ang.lengthSq() < 0.05) {
          b.sleep += dt * 4;
          if (b.sleep > 1) { this.restPose(b); }
        }
      } else { b.ground = false; b.sleep = 0; }
    }
    // spheres push each other apart (cheap: only small counts move)
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
      const a = B[i], c = B[j]; if (a.sleep > 1 && c.sleep > 1) continue;
      const d = _v.subVectors(c.obj.position, a.obj.position), r = a.radius + c.radius, l2 = d.lengthSq();
      if (l2 > r * r || l2 < 1e-8) continue;
      const l = Math.sqrt(l2), push = (r - l), m = a.mass + c.mass;
      d.multiplyScalar(1 / l);
      a.obj.position.addScaledVector(d, -push * c.mass / m); c.obj.position.addScaledVector(d, push * a.mass / m);
      const vn = (c.vel.x - a.vel.x) * d.x + (c.vel.y - a.vel.y) * d.y + (c.vel.z - a.vel.z) * d.z;
      if (vn < 0) { a.vel.addScaledVector(d, vn * c.mass / m * 1.3); c.vel.addScaledVector(d, -vn * a.mass / m * 1.3); a.sleep = c.sleep = 0; }
    }
  }
  boxBottom(b) {
    return b.bottomNow ?? b.box.hy;
  }
  restPose(b) {
    if (!b.box) return;
    // snap a tumbled prop onto its nearest flat side, then measure how high it sits
    _e.setFromQuaternion(b.obj.quaternion, 'YXZ');
    const snap = a => Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
    _e.x = snap(_e.x); _e.z = snap(_e.z);
    b.obj.quaternion.setFromEuler(_e);
    b.obj.updateMatrixWorld(true); _b.setFromObject(b.obj);
    b.bottomNow = b.obj.position.y - _b.min.y; b.obj.position.y = b.bottomNow;
  }
  // keep a walker (circle in XZ at feet height y..y+h) out of props; returns true if pushed
  pushWalker(pos, radius, height = 1.8) {
    let hit = false;
    for (const b of this.bodies) {
      if (!b.box || b.mass < 20) continue;
      const p = b.obj.position;
      _b.setFromObject(b.obj);
      if (pos.y > _b.max.y - 0.35 || pos.y + height < _b.min.y) continue; // standing on top or under
      const cx = Math.max(_b.min.x, Math.min(pos.x, _b.max.x)), cz = Math.max(_b.min.z, Math.min(pos.z, _b.max.z));
      let dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 < 1e-6) { dx = pos.x - p.x; dz = pos.z - p.z; d2 = dx * dx + dz * dz || 1; }
      const d = Math.sqrt(d2), k = (radius - d) / d;
      pos.x += dx * k; pos.z += dz * k; hit = true;
    }
    return hit;
  }
  // highest prop top under a point (so you can stand on boxes and cars)
  floorAt(x, z, y) {
    let top = 0;
    for (const b of this.bodies) {
      if (!b.box || b.mass < 20) continue;
      _b.setFromObject(b.obj);
      if (x < _b.min.x || x > _b.max.x || z < _b.min.z || z > _b.max.z) continue;
      if (_b.max.y <= y + 0.45 && _b.max.y > top) top = _b.max.y;
    }
    return top;
  }
}
