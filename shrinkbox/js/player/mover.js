// Our own character mover. Rapier's character controller and shape-casts lose accuracy when
// you're millimetres tall next to big (rotated) objects - you'd fall through thin plates.
// RAY casts stay exact at every size, so the body is probed with a fan of rays:
//  - walls: rays at knee / waist / head height, centre + both sides, along the move
//  - floor: rays down from under your feet (also handles steps + snapping to the ground)
//  - ceiling: rays up from your head
// All distances (skin, step height) scale with your size.
import * as THREE from 'three';
import { R, world } from '../core/physics.js';

const ID = { x: 0, y: 0, z: 0, w: 1 };
const _o = { x: 0, y: 0, z: 0 }, _dir = { x: 0, y: 0, z: 0 };
const LAT = [-0.85, -0.45, 0, 0.45, 0.85];
const FOOT = [[0, 0], [0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75], [0.53, 0.53], [-0.53, 0.53], [0.53, -0.53], [-0.53, -0.53]];

export class Mover {
  constructor(collider, filterGroups, w = world) {
    this.w = w;
    this.self = collider;
    this.groups = filterGroups;
    this.flags = R.QueryFilterFlags.EXCLUDE_SENSORS;
    this.hits = [];
    this.ray = new R.Ray(_o, _dir);
  }

  cast(ox, oy, oz, dx, dy, dz, len) {
    this.ray.origin = { x: ox, y: oy, z: oz };
    this.ray.dir = { x: dx, y: dy, z: dz };
    const h = this.w.castRayAndGetNormal(this.ray, len, false, this.flags, this.groups, this.self);
    if (!h) return null;
    // ignore hits from INSIDE a shape (the normal points the same way we're going)
    if (h.normal.x * dx + h.normal.y * dy + h.normal.z * dz > 0.05) return null;
    return h;
  }

  /**
   * feet: Vector3 (bottom centre of the body) - modified in place
   * move: Vector3 desired displacement for this step
   * o: { r, h, grounded, snap, stepH, maxSlopeCos }
   */
  move(feet, move, o) {
    const { r, h } = o;
    const skin = r * 0.04;
    this.hits.length = 0;
    const out = { grounded: false, groundCollider: null, groundNormal: null, hitCeiling: false };

    // ---------- horizontal ----------
    let dx = move.x, dz = move.z;
    const heights = [Math.min(o.stepH + skin, h * 0.45), h * 0.62, h * 0.9];
    for (let iter = 0; iter < 3; iter++) {
      const L = Math.hypot(dx, dz);
      if (L < r * 1e-4) break;
      const ux = dx / L, uz = dz / L, px = -uz, pz = ux;
      let best = L, bn = null, bc = null;
      for (const hy of heights) for (const k of LAT) {
        const edge = r * Math.sqrt(1 - k * k);
        const hit = this.cast(feet.x + px * k * r, feet.y + hy, feet.z + pz * k * r, ux, 0, uz, L + edge + skin);
        if (!hit) continue;
        const allowed = hit.timeOfImpact - edge - skin;
        if (allowed < best) { best = Math.max(0, allowed); bn = hit.normal; bc = hit.collider; }
      }
      feet.x += ux * best; feet.z += uz * best;
      if (!bn) break;
      this.hits.push({ collider: bc, normal: new THREE.Vector3(bn.x, bn.y, bn.z) });
      // slide along the wall: remove the part of the remaining motion that goes into it
      let nx = bn.x, nz = bn.z; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      let rx = ux * (L - best), rz = uz * (L - best);
      const into = rx * nx + rz * nz;
      if (into < 0) { rx -= nx * into; rz -= nz * into; }
      dx = rx; dz = rz;
    }

    // ---------- vertical ----------
    let dy = move.y;
    if (dy > 0) {
      let allowed = dy;
      for (const [a, b] of FOOT) {
        const hit = this.cast(feet.x + a * r, feet.y + h - skin, feet.z + b * r, 0, 1, 0, dy + skin * 2);
        if (hit) { const al = Math.max(0, hit.timeOfImpact - skin); if (al < allowed) { allowed = al; out.hitCeiling = true; this.hits.push({ collider: hit.collider, normal: new THREE.Vector3(0, -1, 0) }); } }
      }
      feet.y += allowed;
    }
    // ground: rays start a step-height above the feet, so low bumps/steps are walked up onto
    const startUp = o.grounded ? o.stepH : Math.max(skin * 2, Math.min(o.stepH, -Math.min(0, dy) + skin * 2) * 0.5 + skin);
    const reach = startUp + Math.max(0, -dy) + (o.snap ? o.stepH * 0.6 : skin * 2);
    let groundY = -Infinity, gHit = null;
    for (const [a, b] of FOOT) {
      const hit = this.cast(feet.x + a * r * 0.9, feet.y + startUp, feet.z + b * r * 0.9, 0, -1, 0, reach);
      if (!hit || hit.normal.y < o.maxSlopeCos) continue;
      const y = feet.y + startUp - hit.timeOfImpact;
      if (y > groundY) { groundY = y; gHit = hit; }
    }
    const targetY = feet.y + Math.min(0, dy);
    if (gHit && groundY >= targetY - skin) {
      // landing on / walking up onto the ground (make sure the head fits when stepping up)
      if (groundY > feet.y + skin && !this.headClear(feet, r, h, groundY - feet.y, skin)) {
        feet.y = Math.max(targetY, feet.y);
      } else feet.y = groundY;
      out.grounded = true;
    } else if (gHit && o.snap && groundY >= targetY - o.stepH * 0.6) {
      feet.y = groundY; out.grounded = true; // stick to the ground going down slopes/stairs
    } else {
      feet.y = targetY;
    }
    if (out.grounded) {
      out.groundCollider = gHit.collider;
      out.groundNormal = new THREE.Vector3(gHit.normal.x, gHit.normal.y, gHit.normal.z);
      this.hits.push({ collider: gHit.collider, normal: out.groundNormal });
    }
    return out;
  }

  headClear(feet, r, h, rise, skin) {
    for (const [a, b] of FOOT.slice(0, 5)) if (this.cast(feet.x + a * r * 0.8, feet.y + h - skin, feet.z + b * r * 0.8, 0, 1, 0, rise + skin)) return false;
    return true;
  }

  // does a body at pos (centre) overlap anything solid? (used before growing)
  overlaps(pos, half, r, ignoreDynamic = true) {
    const shape = new R.Cylinder(half * 0.97, r * 0.97);
    let hit = false;
    this.w.intersectionsWithShape(pos, ID, shape, (c) => {
      const b = c.parent();
      if (ignoreDynamic && b && b.isDynamic()) return true;
      hit = c; return false;
    }, this.flags, this.groups, this.self);
    return hit;
  }
}
