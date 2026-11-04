// THE MASK - physics (cannon-es): the room is a closed box, stuff + thrown people are rigid bodies,
// your gloves are moving spheres that shove things.
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ROOM } from './room.js';

export { CANNON };
export const GROUP = { ROOM: 1, PROP: 2, PERSON: 4, HAND: 8 };
export const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0), allowSleep: true });
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 10;
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.12;
world.defaultContactMaterial.contactEquationStiffness = 1e7;
world.defaultContactMaterial.contactEquationRelaxation = 3;

const STEP = 1 / 60;
export const statics = []; // {min, max} boxes of furniture that never moves (for walking around them)

export function buildRoomShell() {
  const HW = ROOM.W / 2, HD = ROOM.D / 2;
  const plane = (pos, euler) => {
    const b = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), collisionFilterGroup: GROUP.ROOM });
    b.position.set(...pos); b.quaternion.setFromEuler(...euler); world.addBody(b); b.isRoom = true; return b;
  };
  plane([0, 0, 0], [-Math.PI / 2, 0, 0]);          // floor (normal up)
  plane([0, ROOM.H, 0], [Math.PI / 2, 0, 0]);      // ceiling (normal down)
  plane([-HW, 0, 0], [0, Math.PI / 2, 0]);         // left wall (normal +x)
  plane([HW, 0, 0], [0, -Math.PI / 2, 0]);         // right wall (normal -x)
  plane([0, 0, -HD], [0, 0, 0]);                   // back wall (normal +z)
  plane([0, 0, HD], [0, Math.PI, 0]);              // front wall (normal -z)
}
// furniture that stays put (clock, shelf on the wall, ...): an invisible box
export function addStaticBox(center, half, rotY = 0) {
  const b = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z)), collisionFilterGroup: GROUP.ROOM });
  b.position.set(center.x, center.y, center.z); b.quaternion.setFromEuler(0, rotY, 0); b.isRoom = true;
  world.addBody(b);
  const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
  const hx = half.x * c + half.z * s, hz = half.x * s + half.z * c;
  statics.push({ min: new THREE.Vector3(center.x - hx, center.y - half.y, center.z - hz), max: new THREE.Vector3(center.x + hx, center.y + half.y, center.z + hz) });
  return b;
}

let acc = 0;
export function step(dt) {
  world.step(STEP, Math.min(dt, 0.1), 3);
  acc += dt;
}

// cannon <-> three
export const toV3 = (c, out = new THREE.Vector3()) => out.set(c.x, c.y, c.z);
export const toQ = (c, out = new THREE.Quaternion()) => out.set(c.x, c.y, c.z, c.w);
const rr = new CANNON.RaycastResult();
const cf = new CANNON.Vec3(), ct = new CANNON.Vec3();
// closest hit along a ray (bodies only). returns { body, point, normal, dist } or null
export function raycast(from, dir, len, mask = GROUP.ROOM | GROUP.PROP) {
  cf.set(from.x, from.y, from.z); ct.set(from.x + dir.x * len, from.y + dir.y * len, from.z + dir.z * len);
  rr.reset();
  world.raycastClosest(cf, ct, { collisionFilterMask: mask, skipBackfaces: true }, rr);
  if (!rr.hasHit) return null;
  return { body: rr.body, point: toV3(rr.hitPointWorld), normal: toV3(rr.hitNormalWorld), dist: rr.distance };
}

// push a circle (x,z,r) out of the walls + static furniture. returns true if it moved
export function collideCircle(p, r, yLo = 0.05, yHi = 1.8) {
  const HW = ROOM.W / 2 - r, HD = ROOM.D / 2 - r;
  let moved = false;
  if (p.x < -HW) { p.x = -HW; moved = true; } if (p.x > HW) { p.x = HW; moved = true; }
  if (p.z < -HD) { p.z = -HD; moved = true; } if (p.z > HD) { p.z = HD; moved = true; }
  for (const s of statics) {
    if (s.max.y < yLo || s.min.y > yHi) continue;
    const cx = Math.max(s.min.x, Math.min(p.x, s.max.x)), cz = Math.max(s.min.z, Math.min(p.z, s.max.z));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
      else { // center inside the box: leave through the nearest side
        const opts = [[s.min.x - r - p.x, 0], [s.max.x + r - p.x, 0], [0, s.min.z - r - p.z], [0, s.max.z + r - p.z]];
        opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1])); p.x += opts[0][0]; p.z += opts[0][1];
      }
      moved = true;
    }
  }
  return moved;
}
