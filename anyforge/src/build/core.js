// Builds = physics bodies made of welded parts. Parts stuck together share one body (rock solid). Joint parts
// (hinges, motors, pistons, springs, wheels) make a second body for their moving half, tied on with a physics joint.
// When a part breaks off, the body splits into the pieces that are still welded together.
import * as THREE from 'three';
import { R, world, owners, track, untrack, G, groups, toV, toQ, fromQ, hooks } from '../core/physics.js';
import { scene } from '../core/render.js';
import { MATS, partMaterial } from '../core/mats.js';
import { DEFS } from '../parts/defs.js';
import { game } from '../game.js';

export const bodies = new Set();
const byHandle = new Map(); // physics body handle -> build body
hooks.same = (h1, h2) => {
  const a = byHandle.get(h1), b = byHandle.get(h2);
  return !!(a && b && a !== b && constructOf(a).has(b));
};
export const partsById = new Map();
export const wires = new Set(); // { from: part, to: part, line }
let nextPart = 1, nextBody = 1;
export let topo = 0;            // goes up whenever builds change shape (joins, splits): caches check it
export function bumpTopo() { topo++; }

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

/* ---------------- bodies ---------------- */
export function newBody(pos, quat, id) {
  if (id && id >= nextBody) nextBody = id + 1;
  const b = { id: id || nextBody++, parts: new Set(), parentJoint: null, frozen: false, antigrav: false };
  b.rb = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(fromQ(quat))
    .setLinearDamping(0.02).setAngularDamping(0.06).setCanSleep(true));
  b.rb.userData = b;
  byHandle.set(b.rb.handle, b);
  b.group = new THREE.Group();
  b.group.name = 'body' + b.id;
  scene.add(b.group);
  b.tr = track(b.rb, b.group);
  bodies.add(b);
  topo++;
  return b;
}
export function destroyBody(b) {
  if (!bodies.has(b)) return;
  for (const p of [...b.parts]) removePart(p, { split: false, keepBody: true });
  for (let i = 0; i < b.rb.numColliders(); i++) owners.delete(b.rb.collider(i).handle);
  byHandle.delete(b.rb.handle);
  world.removeRigidBody(b.rb);
  untrack(b.tr);
  scene.remove(b.group);
  bodies.delete(b);
  topo++;
}
export function bodyPose(b) { return { pos: toV(b.rb.translation()), quat: toQ(b.rb.rotation()) }; }
export function setFrozen(b, on) {
  b.frozen = on;
  b.rb.setBodyType(on ? R.RigidBodyType.Fixed : R.RigidBodyType.Dynamic, true);
  if (!on) b.rb.wakeUp();
}

/* ---------------- parts ---------------- */
export function addPart(body, type, o = {}) {
  const def = DEFS[type];
  if (!def) throw new Error('Unknown part ' + type);
  if (o.id && o.id >= nextPart) nextPart = o.id + 1;
  const props = {};
  for (const pr of def.props) props[pr.k] = pr.def;
  Object.assign(props, o.props || {});
  const p = {
    id: o.id || nextPart++, type, def, body,
    pos: o.pos ? o.pos.clone() : new THREE.Vector3(), quat: o.quat ? o.quat.clone() : new THREE.Quaternion(),
    size: o.size ? o.size.clone() : new THREE.Vector3(...def.size), mat: o.mat || def.mat, color: o.color || def.color || null,
    props, links: new Set(), colliders: [], mesh: null, st: {}, wiresIn: new Set(), wiresOut: new Set(),
    child: null, rotor: null, joint: null, rotorBase: null, hp: 1
  };
  partsById.set(p.id, p);
  body.parts.add(p);
  buildMesh(p);
  buildColliders(p);
  if (!def.joint && def.init) def.init(p);
  topo++;
  return p;
}

export function buildMesh(p) {
  if (p.mesh) { p.body.group.remove(p.mesh); disposeMesh(p.mesh); }
  const m = p.def.mesh(p, game.meshCtx);
  m.position.copy(p.pos);
  m.quaternion.copy(p.quat);
  m.traverse((o) => { o.userData.part = p; });
  p.mesh = m;
  p.body.group.add(m);
}
function disposeMesh(m) {
  m.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material && o.material.userData && o.material.userData.own) o.material.dispose();
  });
}

export function shapeDesc(s) {
  switch (s.t) {
    case 'box': return R.ColliderDesc.cuboid(Math.max(0.01, s.h[0]), Math.max(0.01, s.h[1]), Math.max(0.01, s.h[2]));
    case 'cyl': return R.ColliderDesc.cylinder(Math.max(0.01, s.hh), Math.max(0.01, s.r));
    case 'ball': return R.ColliderDesc.ball(Math.max(0.01, s.r));
    case 'cone': return R.ColliderDesc.cone(Math.max(0.01, s.hh), Math.max(0.01, s.r));
    case 'capsule': return R.ColliderDesc.capsule(s.hh, s.r);
    case 'hull': return R.ColliderDesc.convexHull(s.pts) || R.ColliderDesc.ball(0.1);
  }
  return R.ColliderDesc.ball(0.1);
}
export function buildColliders(p) {
  for (const c of p.colliders) { owners.delete(c.handle); if (c.isValid()) world.removeCollider(c, false); }
  p.colliders = [];
  const m = MATS[p.mat] || MATS.steel;
  const density = p.def.density || m.density;
  for (const s of p.def.shapes(p)) {
    const d = shapeDesc(s);
    _v.set(...(s.p || [0, 0, 0])).applyQuaternion(p.quat).add(p.pos);
    _q.copy(p.quat);
    if (s.q) _q.multiply(s.q);
    const friction = s.friction ?? (p.def.frictionOf ? p.def.frictionOf(p) : m.friction);
    d.setTranslation(_v.x, _v.y, _v.z).setRotation(fromQ(_q)).setDensity(density)
      .setFriction(friction).setRestitution(s.bounce ?? m.bounce)
      .setCollisionGroups(groups(G.PARTS, 0xffff & ~G.GHOST))
      .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setActiveHooks(R.ActiveHooks.FILTER_CONTACT_PAIRS)
      .setContactForceEventThreshold(1e12);
    const c = world.createCollider(d, p.body.rb);
    owners.set(c.handle, { kind: 'part', ref: p });
    p.colliders.push(c);
  }
  p.body.metaDirty = true;
}
export function rebuildPart(p) {
  buildMesh(p);
  buildColliders(p);
  if (p.def.init) p.def.init(p);
  p.st.motorKey = null;
}

/* ---------------- joints ---------------- */
// where the two halves of a joint part meet, in its own body's space; the axis is the part's up
export function jointAnchor(P, out = new THREE.Vector3()) {
  return out.set(0, P.def.joint.at(P), 0).applyQuaternion(P.quat).add(P.pos);
}
export function jointAxis(P, out = new THREE.Vector3()) { return out.copy(Y).applyQuaternion(P.quat); }

// placing a joint part makes its moving half: a new body at the joint, turned exactly like the base body
export function createJointChild(P) {
  const A = P.body, j = P.def.joint;
  const a = jointAnchor(P);
  const { pos, quat } = bodyPose(A);
  const B = newBody(a.clone().applyQuaternion(quat).add(pos), quat);
  const rs = j.rotorSize(P);
  const rotor = addPart(B, j.rotor, {
    pos: jointAxis(P).multiplyScalar(j.rotorAt(P)), quat: P.quat, size: new THREE.Vector3(...rs), mat: P.mat, color: P.color
  });
  const lv = A.rb.linvel(), av = A.rb.angvel();
  B.rb.setLinvel(lv, false); B.rb.setAngvel(av, false);
  linkJoint(P, B, rotor);
  return B;
}
export function linkJoint(P, B, rotor) {
  P.child = B; P.rotor = rotor; rotor.rotorBase = P; B.parentJoint = P;
  makeJoint(P);
  if (P.def.init) P.def.init(P);
  if (rotor.def.frictionOf) buildColliders(rotor);
}
export function makeJoint(P) {
  if (P.joint) { if (P.joint.isValid()) world.removeImpulseJoint(P.joint, true); P.joint = null; }
  if (!P.child) return;
  const a = jointAnchor(P), ax = jointAxis(P);
  const z = { x: 0, y: 0, z: 0 }, a1 = { x: a.x, y: a.y, z: a.z }, axis = { x: ax.x, y: ax.y, z: ax.z };
  let jd;
  switch (P.def.joint.type) {
    case 'revolute': jd = R.JointData.revolute(a1, z, axis); break;
    case 'prismatic': case 'spring': jd = R.JointData.prismatic(a1, z, axis); break;
    case 'spherical': jd = R.JointData.spherical(a1, z); break;
  }
  P.joint = world.createImpulseJoint(jd, P.body.rb, P.child.rb, true);
  P.joint.setContactsEnabled(false);
  P.st.motorKey = null;
  topo++;
}
function breakJoint(P) {
  if (P.joint && P.joint.isValid()) world.removeImpulseJoint(P.joint, true);
  P.joint = null;
  if (P.child) P.child.parentJoint = null;
  if (P.rotor) P.rotor.rotorBase = null;
  P.child = null; P.rotor = null;
  topo++;
}

/* ---------------- removing and splitting ---------------- */
export function removePart(p, { split = true, keepBody = false } = {}) {
  const b = p.body;
  if (!b.parts.has(p)) return;
  if (p.def.cleanup) p.def.cleanup(p);
  // joint base: the moving half stays where it is as its own loose piece (without the top plate)
  if (p.child) {
    const child = p.child, rotor = p.rotor;
    breakJoint(p);
    if (rotor && child.parts.has(rotor)) removePart(rotor, { split: true });
  }
  if (p.rotorBase) breakJoint(p.rotorBase);
  for (const w of [...p.wiresIn, ...p.wiresOut]) unwire(w);
  for (const o of p.links) o.links.delete(p);
  p.links.clear();
  for (const c of p.colliders) { owners.delete(c.handle); if (c.isValid()) world.removeCollider(c, true); }
  p.colliders = [];
  if (p.mesh) { b.group.remove(p.mesh); disposeMesh(p.mesh); p.mesh = null; }
  b.parts.delete(p);
  partsById.delete(p.id);
  p.dead = true;
  b.metaDirty = true;
  topo++;
  if (!keepBody && b.parts.size === 0) destroyBody(b);
  else if (split) splitBody(b);
}

function components(b) {
  const seen = new Set(), out = [];
  for (const start of b.parts) {
    if (seen.has(start)) continue;
    const comp = [], stack = [start];
    seen.add(start);
    while (stack.length) {
      const p = stack.pop();
      comp.push(p);
      for (const o of p.links) if (!seen.has(o) && o.body === b) { seen.add(o); stack.push(o); }
    }
    out.push(comp);
  }
  return out;
}
// after something breaks off: whatever is no longer welded to the rest flies off as its own piece
export function splitBody(b) {
  if (!bodies.has(b)) return [];
  const comps = components(b);
  if (comps.length <= 1) return [];
  // keep the piece that holds this body's joint half (so the joint stays put), else the biggest
  let keep = comps.findIndex((c) => c.some((p) => p.rotorBase));
  if (keep < 0) { let best = -1; comps.forEach((c, i) => { if (c.length > best) { best = c.length; keep = i; } }); }
  const made = [];
  comps.forEach((c, i) => { if (i !== keep) made.push(moveParts(b, c)); });
  return made;
}
// move some parts of a body onto a fresh body that starts exactly where the old one is (so their places stay the same)
export function moveParts(from, list) {
  const { pos, quat } = bodyPose(from);
  const nb = newBody(pos, quat);
  nb.frozen = from.frozen;
  if (from.frozen) nb.rb.setBodyType(R.RigidBodyType.Fixed, false);
  for (const p of list) {
    from.parts.delete(p);
    nb.parts.add(p);
    p.body = nb;
    if (p.mesh) { from.group.remove(p.mesh); nb.group.add(p.mesh); }
    buildColliders(p);
  }
  // copy the motion at the new center of mass
  const com = nb.rb.worldCom();
  nb.rb.setLinvel(from.rb.velocityAtPoint(com), true);
  nb.rb.setAngvel(from.rb.angvel(), true);
  // joints whose base moved need to be tied to the new body
  for (const p of list) if (p.child) makeJoint(p);
  from.metaDirty = true;
  topo++;
  return nb;
}

// break a part off (big hits): it becomes its own flying piece, and the rest splits if needed
export function detachPart(p) {
  const b = p.body;
  if (b.parts.size <= 1) return b;
  for (const o of p.links) o.links.delete(p);
  p.links.clear();
  const nb = moveParts(b, [p]);
  splitBody(b);
  return nb;
}

/* ---------------- welding: which parts hold on to which ---------------- */
function localBox(p, out) {
  // the part's bounding box in its body's space (good enough: parts mostly sit square to their body)
  const hx = p.size.x / 2, hy = p.def.halfH(p), hz = p.size.z / 2;
  out.makeEmpty();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    out.expandByPoint(_v.set(sx * hx, sy * hy, sz * hz).applyQuaternion(p.quat).add(p.pos));
  }
  return out;
}
const _b1 = new THREE.Box3(), _b2 = new THREE.Box3();
export function weld(p, to) {
  if (to && to.body === p.body && to !== p) { p.links.add(to); to.links.add(p); }
  // also weld to anything else in the same body it touches
  localBox(p, _b1).expandByScalar(0.03);
  for (const o of p.body.parts) {
    if (o === p || p.links.has(o)) continue;
    if (_b1.intersectsBox(localBox(o, _b2))) { p.links.add(o); o.links.add(p); }
  }
}

/* ---------------- builds (all bodies tied together by joints) ---------------- */
const cCache = new Map();
let cVer = -1;
export function constructOf(b) {
  if (cVer !== topo) { cCache.clear(); cVer = topo; }
  let s = cCache.get(b);
  if (s) return s;
  s = new Set();
  const stack = [b];
  s.add(b);
  while (stack.length) {
    const x = stack.pop();
    const near = [];
    if (x.parentJoint && x.parentJoint.joint) near.push(x.parentJoint.body);
    for (const p of x.parts) if (p.child && p.joint) near.push(p.child);
    for (const n of near) if (n && !s.has(n) && bodies.has(n)) { s.add(n); stack.push(n); }
  }
  for (const x of s) cCache.set(x, s);
  return s;
}
export function constructParts(set) { const out = []; for (const b of set) for (const p of b.parts) out.push(p); return out; }
export function constructMass(set) { let m = 0; for (const b of set) m += b.rb.mass(); return m; }

// per-body numbers that depend on all its parts: how hard a hit has to be to break things, is it metal...
export function refreshMeta(b) {
  b.metaDirty = false;
  const set = constructOf(b);
  const mass = constructMass(set);
  b.cmass = mass;
  let metal = 0, n = 0, rad = 0;
  for (const p of b.parts) {
    const m = MATS[p.mat];
    if (m && m.sound === 'metal') metal++;
    n++;
    rad = Math.max(rad, p.pos.length() + Math.max(p.size.x, p.size.y, p.size.z) / 2);
    const strength = (m ? m.strength : 5) * (p.def.fragile ? 0.15 : 1);
    // weight of the whole build times how tough this part is: builds do not break just from standing
    p.breakAt = strength * Math.max(600, mass * 9.81) * 2.6;
    const soundAt = Math.max(150, b.rb.mass() * 9.81 * 2.2);
    for (const c of p.colliders) c.setContactForceEventThreshold(Math.min(p.breakAt, soundAt));
  }
  b.metal = n ? metal / n : 0;
  b.radius = rad;
}

/* ---------------- wires (signals from buttons, switches, sensors, timers, gates) ---------------- */
export function wire(from, to) {
  if (from === to) return null;
  for (const w of from.wiresOut) if (w.to === to) return w;
  const w = { from, to, line: null };
  from.wiresOut.add(w); to.wiresIn.add(w);
  wires.add(w);
  return w;
}
export function unwire(w) {
  w.from.wiresOut.delete(w); w.to.wiresIn.delete(w);
  wires.delete(w);
  if (w.line) { w.line.parent && w.line.parent.remove(w.line); w.line.geometry.dispose(); w.line = null; }
}

/* ---------------- saving builds (as blueprints: every joint back at its starting position) ---------------- */
const A3 = (v) => [+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)];
const A4 = (q) => [+q.x.toFixed(5), +q.y.toFixed(5), +q.z.toFixed(5), +q.w.toFixed(5)];
export function serialize(set) {
  const rest = new Map();
  const walk = (b, pos, quat) => {
    rest.set(b, { pos, quat });
    for (const p of b.parts) {
      if (p.child && p.joint && set.has(p.child) && !rest.has(p.child)) {
        walk(p.child, jointAnchor(p, new THREE.Vector3()).applyQuaternion(quat).add(pos), quat.clone());
      }
    }
  };
  for (const b of set) if (!b.parentJoint || !b.parentJoint.joint || !set.has(b.parentJoint.body)) { const ps = bodyPose(b); walk(b, ps.pos, ps.quat); }
  for (const b of set) if (!rest.has(b)) { const ps = bodyPose(b); walk(b, ps.pos, ps.quat); }
  const out = { v: 1, bodies: [], wires: [] };
  for (const b of set) {
    const r = rest.get(b);
    out.bodies.push({
      id: b.id, p: A3(r.pos), q: A4(r.quat), fz: b.frozen || undefined,
      parts: [...b.parts].map((p) => ({
        i: p.id, t: p.type, p: A3(p.pos), q: A4(p.quat), s: A3(p.size), m: p.mat, c: p.color || undefined,
        pr: Object.keys(p.props).length ? { ...p.props } : undefined,
        l: p.links.size ? [...p.links].map((o) => o.id) : undefined,
        j: p.child && p.joint && set.has(p.child) ? p.child.id : undefined,
        r: p.rotorBase && set.has(p.rotorBase.body) ? p.rotorBase.id : undefined
      }))
    });
  }
  for (const w of wires) if (set.has(w.from.body) || set.has(w.to.body)) out.wires.push([w.from.id, w.to.id]);
  return out;
}

// xf: optional { pos, quat, origin } moves the whole blueprint (origin -> pos, turned by quat). keepIds for undo.
export function deserialize(data, { xf = null, keepIds = false, scale = 1 } = {}) {
  const bmap = new Map(), pmap = new Map(), made = [];
  for (const bd of data.bodies) {
    let pos = new THREE.Vector3(...bd.p).multiplyScalar(1), quat = new THREE.Quaternion(...bd.q);
    if (xf) {
      pos.sub(xf.origin).multiplyScalar(scale).applyQuaternion(xf.quat).add(xf.pos);
      quat.premultiply(xf.quat);
    }
    const b = newBody(pos, quat, keepIds && !findBody(bd.id) ? bd.id : undefined);
    bmap.set(bd.id, b);
    made.push(b);
    for (const pd of bd.parts) {
      if (!DEFS[pd.t]) continue;
      const p = addPart(b, pd.t, {
        id: keepIds && !partsById.has(pd.i) ? pd.i : undefined,
        pos: new THREE.Vector3(...pd.p).multiplyScalar(scale), quat: new THREE.Quaternion(...pd.q),
        size: new THREE.Vector3(...pd.s).multiplyScalar(scale), mat: pd.m, color: pd.c, props: pd.pr
      });
      pmap.set(pd.i, p);
    }
    if (bd.fz) setFrozen(b, true);
  }
  for (const bd of data.bodies) for (const pd of bd.parts) {
    const p = pmap.get(pd.i);
    if (!p) continue;
    for (const id of pd.l || []) { const o = pmap.get(id); if (o && o.body === p.body) { p.links.add(o); o.links.add(p); } }
  }
  for (const bd of data.bodies) for (const pd of bd.parts) {
    const P = pmap.get(pd.i);
    if (!P || pd.j === undefined) continue;
    const B = bmap.get(pd.j);
    const rd = B && data.bodies.find((x) => x.id === pd.j).parts.find((x) => x.r === pd.i);
    const rotor = rd && pmap.get(rd.i);
    if (B && rotor) linkJoint(P, B, rotor);
  }
  for (const [a, b] of data.wires || []) {
    const pa = pmap.get(a) || (keepIds ? partsById.get(a) : null), pb = pmap.get(b) || (keepIds ? partsById.get(b) : null);
    if (pa && pb) wire(pa, pb);
  }
  for (const b of made) b.metaDirty = true;
  topo++;
  return made;
}
export function findBody(id) { for (const b of bodies) if (b.id === id) return b; return null; }
export function blueprintCenter(data) {
  const box = new THREE.Box3();
  for (const bd of data.bodies) {
    const bp = new THREE.Vector3(...bd.p), bq = new THREE.Quaternion(...bd.q);
    for (const pd of bd.parts) {
      const half = Math.max(...pd.s) / 2;
      const c = new THREE.Vector3(...pd.p).applyQuaternion(bq).add(bp);
      box.expandByPoint(c.clone().addScalar(half)).expandByPoint(c.clone().addScalar(-half));
    }
  }
  return box;
}
export function partWorld(p, out = new THREE.Vector3()) {
  const { pos, quat } = bodyPose(p.body);
  return out.copy(p.pos).applyQuaternion(quat).add(pos);
}
