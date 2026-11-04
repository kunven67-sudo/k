// Rapier physics: one world, fixed 60 Hz steps, smooth in-between drawing, and a map from colliders back to game things.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export let R = null;          // the RAPIER module
export let world = null;
export let events = null;
export const STEP = 1 / 60;
export const owners = new Map(); // collider handle -> { kind: 'part'|'human'|'hand'|'ground'|..., ref }
// pieces of the same build never push on each other (parts that overlap a little would jam hinges and wheels)
export const hooks = { same: null };
const physicsHooks = {
  filterContactPair(c1, c2, b1, b2) {
    if (hooks.same && hooks.same(b1, b2)) return null;
    return R.SolverFlags.COMPUTE_IMPULSE;
  },
  filterIntersectionPair() { return true; }
};

// collision groups (membership << 16 | filter)
export const G = { WORLD: 1, PARTS: 2, HUMAN: 4, HAND: 8, PLAYER: 16, DEBRIS: 32, GHOST: 64 };
export function groups(member, filter) { return (member << 16) | filter; }

export async function initPhysics() {
  await RAPIER.init();
  R = RAPIER;
  world = new R.World({ x: 0, y: -98.1, z: 0 });
  world.timestep = STEP;
  world.numSolverIterations = 8;
  events = new R.EventQueue(true);
  return world;
}

export function setGravity(y) { world.gravity = { x: 0, y, z: 0 }; wakeAll(); }
export function wakeAll() { world.forEachRigidBody((b) => { if (b.isDynamic()) b.wakeUp(); }); }

/* ---------- smooth drawing between physics steps ---------- */
// every tracked thing: { rb, obj (Object3D drawn at the body), p0,q0 (before last step), p1,q1 (after) }
const tracked = new Set();
export function track(rb, obj) {
  const t = rb.translation(), r = rb.rotation();
  const e = { rb, obj, p0: new THREE.Vector3(t.x, t.y, t.z), q0: new THREE.Quaternion(r.x, r.y, r.z, r.w) };
  e.p1 = e.p0.clone(); e.q1 = e.q0.clone();
  obj.position.copy(e.p1); obj.quaternion.copy(e.q1);
  tracked.add(e);
  return e;
}
export function untrack(e) { tracked.delete(e); }
export function snapTracked(e) {
  // after teleporting a body: do not smear it from the old place
  const t = e.rb.translation(), r = e.rb.rotation();
  e.p0.set(t.x, t.y, t.z); e.p1.copy(e.p0);
  e.q0.set(r.x, r.y, r.z, r.w); e.q1.copy(e.q0);
  e.obj.position.copy(e.p1); e.obj.quaternion.copy(e.q1);
}

let acc = 0;
export let timeScale = 1;   // 0 = time stopped, 0.25 = slow motion
export function setTimeScale(s) { timeScale = s; }
export let simTime = 0;

// fixedUpdate(dt) runs before every physics step (forces, motors, brains); afterStep() after it (breaking, sounds)
export function stepPhysics(frameDt, fixedUpdate, afterStep) {
  acc += Math.min(frameDt, 0.1) * timeScale;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    for (const e of tracked) { e.p0.copy(e.p1); e.q0.copy(e.q1); }
    fixedUpdate(STEP);
    world.step(events, physicsHooks);
    simTime += STEP;
    for (const e of tracked) {
      const t = e.rb.translation(), r = e.rb.rotation();
      e.p1.set(t.x, t.y, t.z); e.q1.set(r.x, r.y, r.z, r.w);
    }
    afterStep(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 4) acc = Math.min(acc, STEP); // too slow: drop time instead of spiraling
  const a = timeScale === 0 ? 1 : acc / STEP;
  for (const e of tracked) {
    e.obj.position.lerpVectors(e.p0, e.p1, a);
    e.obj.quaternion.slerpQuaternions(e.q0, e.q1, a);
  }
  return steps;
}

/* ---------- small helpers ---------- */
export const v3 = (x, y, z) => ({ x, y, z });
export const fromV = (v) => ({ x: v.x, y: v.y, z: v.z });
export const fromQ = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });
export function toV(o, out = new THREE.Vector3()) { return out.set(o.x, o.y, o.z); }
export function toQ(o, out = new THREE.Quaternion()) { return out.set(o.x, o.y, o.z, o.w); }

export function raycast(origin, dir, maxDist, opts = {}) {
  const ray = new R.Ray(fromV(origin), fromV(dir));
  const hit = world.castRayAndGetNormal(ray, maxDist, true, opts.flags, opts.groups, opts.excludeCollider, opts.excludeBody, opts.filter);
  if (!hit) return null;
  return {
    collider: hit.collider,
    owner: owners.get(hit.collider.handle),
    toi: hit.timeOfImpact,
    point: new THREE.Vector3(origin.x + dir.x * hit.timeOfImpact, origin.y + dir.y * hit.timeOfImpact, origin.z + dir.z * hit.timeOfImpact),
    normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z)
  };
}
