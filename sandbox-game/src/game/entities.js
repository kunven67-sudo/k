// Physical objects in the world: spawning, syncing, damage, breaking, dents, joints, debris.
import * as THREE from 'three';
import { R, world, eventQueue, GROUPS, physicsState } from '../engine/physics.js';
import { MATERIALS, getMaterial } from '../gfx/materials.js';
import { boxPoints, cylPoints, ballPoints, cyl } from '../gfx/geom.js';
import { BY_ID, buildParts } from './catalog.js';
import { fracturePoints, chunkGeometry, centroid, sizeOf } from './fracture.js';
import { getSettings } from '../settings.js';
import { ctx } from './ctx.js';

let nextId = 1;
export const entities = new Map();
const byCollider = new Map(); // collider handle -> { e, part }
export const jointRecs = new Set();
let groundBody = null;

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const rnd = (a, b) => a + Math.random() * (b - a);

// Assembled furniture comes apart (nails/screws give) at this velocity change.
const JOIN_DV = { crate: 5, chair: 4, table: 5, pallet: 6, scaffold: 9, fridge: 9, tv: 8, pc: 9, vending: 14 };
const JOINT_TYPES = {
  weld:  { name: 'Weld',  tol: 0.06,  strength: 9000 },
  glue:  { name: 'Glue',  tol: 0.02,  strength: 900 },
  nails: { name: 'Nails', tol: 0.035, strength: 2200 },
  hinge: { name: 'Hinge', tol: 0.05,  strength: 3000 },
  stick: { name: 'Stuck', tol: 0.08,  strength: 6000 },
  rebar: { name: 'Rebar', tol: 0.05,  strength: 1400 },
};
export { JOINT_TYPES };

export function initEntities() {
  groundBody = world.createRigidBody(R.RigidBodyDesc.fixed());
}

function shapePoints(shape) {
  switch (shape.type) {
    case 'box': return boxPoints(shape.hx, shape.hy, shape.hz);
    case 'cyl': return cylPoints(shape.r, shape.hh, 14);
    case 'capsule': return cylPoints(shape.r, shape.hh + shape.r * 0.7, 14);
    case 'ball': return ballPoints(shape.r);
    case 'hull': return shape.points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
  }
  return boxPoints(0.1, 0.1, 0.1);
}

function colliderDesc(shape) {
  switch (shape.type) {
    case 'box': return R.ColliderDesc.cuboid(shape.hx, shape.hy, shape.hz);
    case 'cyl': return R.ColliderDesc.cylinder(shape.hh, shape.r);
    case 'capsule': return R.ColliderDesc.capsule(shape.hh, shape.r);
    case 'ball': return R.ColliderDesc.ball(shape.r);
    case 'hull': {
      const flat = [];
      for (const p of shape.points) p.isVector3 ? flat.push(p.x, p.y, p.z) : flat.push(p[0], p[1], p[2]);
      return R.ColliderDesc.convexHull(new Float32Array(flat));
    }
  }
}

function resolveMaterial(m) {
  if (m.material) return m.material;
  return getMaterial(m.mat, { color: m.paint, roughness: m.roughness, metalness: m.metalness, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity });
}

// Visual-only group for a catalog item (spawn ghost, thumbnails).
export function buildVisual(def, mat, size = 1) {
  const g = new THREE.Group();
  for (const p of buildParts(def, mat, size)) {
    const pg = new THREE.Group();
    pg.position.fromArray(p.pos);
    pg.rotation.fromArray(p.rot);
    for (const m of p.meshes) pg.add(new THREE.Mesh(m.geo, resolveMaterial(m)));
    g.add(pg);
  }
  return g;
}

export class Entity {
  constructor() {
    this.id = nextId++;
    this.parts = [];
    this.root = new THREE.Group();
    this.hp = 100;
    this.frozen = false;
    this.debris = false;
    this.born = performance.now();
    this.prevPos = new THREE.Vector3();
    this.prevQuat = new THREE.Quaternion();
    this.joints = new Set();
    this.explosive = null;
    this.fade = 0;
  }
  get alive() { return entities.has(this.id); }
  get mass() {
    let m = 0;
    for (const p of this.parts) m += p.collider.mass();
    return Math.max(m, 0.01);
  }
  get mainMat() { return this.parts[0]?.mat || 'wood'; }
  position(out = new THREE.Vector3()) { const t = this.body.translation(); return out.set(t.x, t.y, t.z); }
  quaternion(out = new THREE.Quaternion()) { const r = this.body.rotation(); return out.set(r.x, r.y, r.z, r.w); }
  // Radius of a sphere that roughly covers the object.
  get radius() {
    if (this._radius) return this._radius;
    const b = new THREE.Box3().setFromObject(this.root, true);
    this._radius = Math.max(0.05, b.getSize(_v).length() / 2);
    return this._radius;
  }
}

function addPart(e, p) {
  const m = MATERIALS[p.mat] || MATERIALS.wood;
  const desc = colliderDesc(p.shape);
  if (!desc) return;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler().fromArray(p.rot));
  desc.setTranslation(p.pos[0], p.pos[1], p.pos[2]).setRotation(q);
  if (p.mass) desc.setMass(p.mass); else desc.setDensity(m.density * (p.densityScale ?? 1));
  desc.setFriction(m.friction).setRestitution(m.restitution);
  desc.setCollisionGroups(e.debris ? GROUPS.debris : GROUPS.object);
  desc.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS);
  const collider = world.createCollider(desc, e.body);
  const pg = new THREE.Group();
  pg.position.fromArray(p.pos);
  pg.quaternion.copy(q);
  const meshes = [];
  for (const mm of p.meshes) {
    const mesh = new THREE.Mesh(mm.geo, resolveMaterial(mm));
    mesh.castShadow = !(m.opacity != null);
    mesh.receiveShadow = true;
    pg.add(mesh);
    meshes.push(mesh);
  }
  e.root.add(pg);
  const part = { ...p, collider, group: pg, meshList: meshes, hp: p.hp ?? 100 };
  e.parts.push(part);
  byCollider.set(collider.handle, { e, part });
  // only report impacts big enough to matter (saves the event queue a lot of work)
  const dvMin = Math.min(m.breakDV, m.dentDV ?? Infinity, 6);
  collider.setContactForceEventThreshold(Math.max(5, collider.mass() * dvMin * 25));
  return part;
}

// Spawn a catalog item or a custom set of parts.
export function spawn(defId, o = {}) {
  const def = defId ? BY_ID[defId] : null;
  const e = new Entity();
  e.def = def;
  e.defId = defId;
  e.debris = !!o.debris;
  e.matOverride = o.mat || null;
  e.size = o.size || 1;
  const pos = o.pos || new THREE.Vector3();
  const quat = o.quat || new THREE.Quaternion();
  const desc = (o.frozen ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic())
    .setTranslation(pos.x, pos.y, pos.z)
    .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    .setLinearDamping(0.02).setAngularDamping(0.08)
    .setCcdEnabled(!!o.ccd);
  e.body = world.createRigidBody(desc);
  e.frozen = !!o.frozen;
  const parts = o.parts || buildParts(def, o.mat, e.size);
  for (const p of parts) addPart(e, p);
  if (!e.parts.length) { world.removeRigidBody(e.body); return null; }
  if (o.vel) e.body.setLinvel(o.vel, true);
  if (o.angVel) e.body.setAngvel(o.angVel, true);
  e.origMat = e.mainMat;
  if (def?.explosive && !o.noExplosive) e.explosive = { ...def.explosive, armed: !!def.explosive.remote };
  if (e.mainMat === 'tnt' && !e.explosive) e.explosive = { kind: 'tnt', power: Math.min(100, e.mass), remote: true, armed: true };
  e.root.position.copy(pos);
  e.root.quaternion.copy(quat);
  e.prevPos.copy(pos);
  e.prevQuat.copy(quat);
  ctx.scene.add(e.root);
  entities.set(e.id, e);
  if (e.debris) debrisList.push(e);
  return e;
}

export function removeEntity(e, { silent = false } = {}) {
  if (!entities.has(e.id)) return;
  for (const j of [...e.joints]) removeJoint(j);
  for (const p of e.parts) byCollider.delete(p.collider.handle);
  world.removeRigidBody(e.body);
  ctx.scene.remove(e.root);
  e.root.traverse((o) => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); });
  entities.delete(e.id);
  if (!silent) ctx.onEntityRemoved?.(e);
}

export function entityFromCollider(handle) { return byCollider.get(handle)?.e || null; }
export function partFromCollider(handle) { return byCollider.get(handle) || null; }

// --------------------------------------------------------------------------- freezing
export function setFrozen(e, frozen) {
  e.frozen = frozen;
  e.body.setBodyType(frozen ? R.RigidBodyType.Fixed : R.RigidBodyType.Dynamic, true);
  if (!frozen) e.body.wakeUp();
}

// --------------------------------------------------------------------------- sync
export function recordPrev() {
  for (const e of entities.values()) {
    if (e.frozen || e.body.isSleeping()) continue;
    const t = e.body.translation(), r = e.body.rotation();
    e.prevPos.set(t.x, t.y, t.z);
    e.prevQuat.set(r.x, r.y, r.z, r.w);
  }
}

export function syncVisuals(alpha) {
  for (const e of entities.values()) {
    const t = e.body.translation(), r = e.body.rotation();
    _v.set(t.x, t.y, t.z);
    _q.set(r.x, r.y, r.z, r.w);
    if (e.frozen || e.body.isSleeping()) {
      e.root.position.copy(_v);
      e.root.quaternion.copy(_q);
      e.prevPos.copy(_v); e.prevQuat.copy(_q);
    } else {
      e.root.position.lerpVectors(e.prevPos, _v, alpha);
      e.root.quaternion.slerpQuaternions(e.prevQuat, _q, alpha);
    }
    if (e.fade > 0) e.root.scale.setScalar(Math.max(0.01, 1 - e.fade));
  }
}

// --------------------------------------------------------------------------- debris
const debrisList = [];
export function updateDebris(dt) {
  const limit = getSettings().debrisLimit;
  const now = performance.now();
  let alive = 0;
  for (let i = debrisList.length - 1; i >= 0; i--) {
    const e = debrisList[i];
    if (!e.alive) { debrisList.splice(i, 1); continue; }
    alive++;
  }
  let excess = alive - limit;
  for (const e of debrisList) {
    const old = now - e.born > (e.life ?? 40000);
    if ((excess > 0 || old) && e.fade === 0) { e.fade = 0.0001; excess--; }
    if (e.fade > 0) {
      e.fade += dt * 1.6;
      if (e.fade >= 1) removeEntity(e, { silent: true });
    }
    // fell out of the world
    if (e.alive && e.body.translation().y < -50) removeEntity(e, { silent: true });
  }
  for (const e of entities.values()) if (!e.debris && e.body.translation().y < -100) removeEntity(e);
}

// --------------------------------------------------------------------------- damage
// Called after every physics step: turns collision impulses into damage.
export function processImpacts(dt) {
  // Only read the events inside the drain callback: Rapier ignores exceptions thrown in there,
  // and touching the physics world from inside it can leave the world locked.
  const events = [];
  eventQueue.drainContactForceEvents((ev) => {
    const d = ev.maxForceDirection();
    events.push({ h1: ev.collider1(), h2: ev.collider2(), J: ev.totalForceMagnitude() * dt, d: { x: d.x, y: d.y, z: d.z } });
  });
  for (const ev of events) {
    hitFromContact(ev.h1, ev.h2, ev.J, ev.d, 1);
    hitFromContact(ev.h2, ev.h1, ev.J, ev.d, -1);
  }
}

function hitFromContact(h, other, J, dir, sign) {
  const rec = byCollider.get(h);
  if (!rec || !rec.e.alive) return;
  const { e, part } = rec;
  const dv = J / e.mass;
  if (dv < 1.2) return;
  let point = null;
  world.narrowPhase.contactPair(h, other, (man) => {
    if (!point && man.numSolverContacts() > 0) { const p = man.solverContactPoint(0); point = new THREE.Vector3(p.x, p.y, p.z); }
  });
  if (!point) { const t = part.collider.translation(); point = new THREE.Vector3(t.x, t.y, t.z); }
  const inDir = new THREE.Vector3(dir.x, dir.y, dir.z).multiplyScalar(sign);
  ctx.onImpact?.(e, part, dv, point, inDir);
  damagePart(e, part, dv, point, inDir, 'impact');
}

// Core damage rule. `dv` is a velocity change (m/s) for impacts, or an equivalent for blasts.
export function damagePart(e, part, dv, point, inDir, kind = 'impact') {
  if (!e.alive || !e.parts.includes(part)) return;
  const m = MATERIALS[part.mat] || MATERIALS.wood;
  if (e.explosive) {
    const tough = e.explosive.kind === 'tnt' || e.explosive.kind === 'c4' ? 30 : e.explosive.kind === 'propane' ? 14 : 18;
    if (dv > tough) { ctx.detonate?.(e, rnd(0.02, 0.12)); return; }
    if (e.explosive.rocket && kind !== 'impact' && dv > 5 && !e.rocketing) { ctx.startRocket?.(e); }
  }
  if (m.dentDV != null && dv > m.dentDV && point) dent(e, part, point, inDir, Math.min(1, (dv - m.dentDV) / (m.dentDV * 6)));
  // assembled furniture comes apart before the pieces themselves break
  const joinDV = JOIN_DV[e.defId];
  if (joinDV && e.parts.length > 1 && dv > joinDV) {
    const map = disassemble(e, point);
    const ne = map.get(part);
    if (ne && dv >= m.breakDV) breakPart(ne, ne.parts[0], point, dv / m.breakDV);
    return;
  }
  if (m.fracture === 'tear') {
    if (kind === 'blast' && dv > (m.tearBlast ?? 60)) breakPart(e, part, point, 1.2);
    return;
  }
  if (dv >= m.breakDV) { breakPart(e, part, point, dv / m.breakDV); return; }
  if (dv > m.breakDV * 0.45) {
    part.hp -= 100 * (dv / m.breakDV) ** 2 * 0.55;
    if (part.hp <= 0) breakPart(e, part, point, 1);
  }
}

// --------------------------------------------------------------------------- dents
const _inv = new THREE.Matrix4();
export function dent(e, part, worldPoint, inDir, strength) {
  const r = THREE.MathUtils.clamp(e.radius * 0.45, 0.03, 0.6);
  const depth = r * 0.35 * strength;
  if (depth < 0.002) return;
  for (const mesh of part.meshList) {
    mesh.updateWorldMatrix(true, false);
    _inv.copy(mesh.matrixWorld).invert();
    const lp = worldPoint.clone().applyMatrix4(_inv);
    const ld = inDir.clone().transformDirection(_inv).normalize();
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const moved = new Uint8Array(pos.count);
    let any = false;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i);
      const d = _v.distanceTo(lp);
      if (d >= r) continue;
      const f = (1 - d / r) ** 2 * depth;
      pos.setXYZ(i, _v.x + ld.x * f, _v.y + ld.y * f, _v.z + ld.z * f);
      moved[i] = 1; any = true;
    }
    if (!any) continue;
    pos.needsUpdate = true;
    // re-shade only the triangles that moved (crumpled metal reads as faceted)
    const nor = geo.attributes.normal;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    if (!geo.index) {
      for (let t = 0; t < pos.count; t += 3) {
        if (!(moved[t] || moved[t + 1] || moved[t + 2])) continue;
        a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
        const n = b.sub(a).cross(c.sub(a)).normalize();
        for (let k = 0; k < 3; k++) nor.setXYZ(t + k, n.x, n.y, n.z);
      }
      nor.needsUpdate = true;
    } else geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
}

// --------------------------------------------------------------------------- breaking
function partWorldMatrix(e, part) {
  e.root.updateWorldMatrix(true, true);
  const t = e.body.translation(), r = e.body.rotation();
  const bodyM = new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion(r.x, r.y, r.z, r.w), new THREE.Vector3(1, 1, 1));
  const partM = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(part.pos), part.group.quaternion, new THREE.Vector3(1, 1, 1));
  return bodyM.multiply(partM);
}

function velocityAt(e, worldPoint) {
  const lv = e.body.linvel(), av = e.body.angvel(), t = e.body.translation();
  const rr = new THREE.Vector3(worldPoint.x - t.x, worldPoint.y - t.y, worldPoint.z - t.z);
  return new THREE.Vector3(lv.x, lv.y, lv.z).add(new THREE.Vector3(av.x, av.y, av.z).cross(rr));
}

function removePart(e, part) {
  for (const j of [...e.joints]) {
    // joints anchored on this part go with it
    if (j.partA === part || j.partB === part) removeJoint(j);
  }
  byCollider.delete(part.collider.handle);
  world.removeCollider(part.collider, true);
  e.root.remove(part.group);
  e.parts.splice(e.parts.indexOf(part), 1);
  e._radius = 0;
  if (!e.parts.length) removeEntity(e, { silent: true });
}

// Detach one part into its own entity (keeps its meshes and motion).
export function detachPart(e, part, kick = null) {
  const M = partWorldMatrix(e, part);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
  M.decompose(pos, quat, new THREE.Vector3());
  const vel = velocityAt(e, pos);
  if (kick) vel.add(kick);
  const av = e.body.angvel();
  const angVel = { x: av.x, y: av.y, z: av.z };
  const meshes = part.meshList.map((mesh) => ({ geo: mesh.geometry, material: mesh.material }));
  const mass = part.mass ? part.collider.mass() : undefined;
  removePartKeepGeo(e, part); // may remove `e` entirely if this was its last part
  const ne = spawn(null, {
    pos, quat, vel, angVel,
    parts: [{ shape: part.shape, mat: part.mat, meshes, pos: [0, 0, 0], rot: [0, 0, 0], mass, hp: part.hp }],
  });
  if (ne) { ne.defId = 'part'; ne.label = e.def?.name; }
  return ne;
}

function removePartKeepGeo(e, part) {
  part.group.traverse((o) => { if (o.geometry) o.userData.sharedGeo = true; });
  removePart(e, part);
}

export function disassemble(e, point) {
  const parts = [...e.parts];
  const center = e.position();
  const map = new Map();
  for (const p of parts) {
    if (!e.alive) break;
    const M = partWorldMatrix(e, p);
    const pp = new THREE.Vector3().setFromMatrixPosition(M);
    const kick = pp.sub(point || center).normalize().multiplyScalar(rnd(0.3, 1.2));
    const ne = detachPart(e, p, kick);
    if (ne) map.set(p, ne);
  }
  return map;
}

// Shatter/split one part into physical chunks.
export function breakPart(e, part, worldPoint, energy = 1) {
  if (!e.alive || !e.parts.includes(part)) return;
  const m = MATERIALS[part.mat] || MATERIALS.wood;
  if (m.fracture === 'none') return;
  const M = partWorldMatrix(e, part);
  const invM = M.clone().invert();
  const pts = shapePoints(part.shape);
  const localHit = worldPoint ? worldPoint.clone().applyMatrix4(invM) : null;
  const chunks = fracturePoints(pts, m.fracture, localHit, energy);
  const outerMat = part.meshList[0]?.material || getMaterial(part.mat);
  const innerMat = getMaterial(part.mat, { inner: true });
  const partQuat = new THREE.Quaternion();
  M.decompose(new THREE.Vector3(), partQuat, new THREE.Vector3());
  const partCenter = new THREE.Vector3().setFromMatrixPosition(M);
  const totalMass = part.collider.mass();
  const totalVol = chunks.reduce((s, c) => { const z = sizeOf(c); return s + z.x * z.y * z.z; }, 0) || 1;
  const baseVel = velocityAt(e, partCenter);
  const wasFrozen = e.frozen;
  const size = sizeOf(pts).length();
  removePart(e, part);
  ctx.fx?.breakBurst(worldPoint || partCenter, part.mat, size * 0.5);
  ctx.onBreak?.(part.mat, worldPoint || partCenter, size);

  for (const c of chunks) {
    const cen = centroid(c);
    const local = c.map((p) => p.clone().sub(cen));
    let geo;
    try { geo = chunkGeometry(c, pts); } catch (_) { continue; }
    geo.translate(-cen.x, -cen.y, -cen.z);
    const wpos = cen.clone().applyMatrix4(M);
    const z = sizeOf(c);
    const vol = z.x * z.y * z.z;
    const outward = worldPoint ? wpos.clone().sub(worldPoint) : wpos.clone().sub(partCenter);
    const kick = outward.lengthSq() > 1e-6 ? outward.normalize().multiplyScalar(rnd(0.3, 1.5) * Math.min(energy, 3)) : new THREE.Vector3();
    const tiny = z.length() < 0.25;
    const ne = spawn(null, {
      pos: wpos, quat: partQuat.clone(), debris: tiny || m.fracture === 'cubes' || m.fracture === 'shards',
      vel: baseVel.clone().add(kick), ccd: z.length() < 0.15,
      parts: [{ shape: { type: 'hull', points: local }, mat: part.mat, meshes: [{ geo, material: [outerMat, innerMat] }], pos: [0, 0, 0], rot: [0, 0, 0], mass: Math.max(0.01, (totalMass * vol) / totalVol), hp: 60 }],
    });
    if (!ne) continue;
    ne.defId = 'chunk';
    if (ne.debris) ne.life = rnd(25000, 45000);
    if (wasFrozen && !worldPoint) { /* frozen glass falls once broken */ }
  }
  // Concrete keeps steel rebar inside: rods poke out of the chunks and hold some together.
  if (m.rebar && size > 0.9) spawnRebar(M, pts, part);
}

function spawnRebar(M, pts, part) {
  const sz = sizeOf(pts);
  const axis = sz.x >= sz.y && sz.x >= sz.z ? 'x' : sz.y >= sz.z ? 'y' : 'z';
  const len = sz[axis] * 0.9;
  const n = Math.min(4, Math.max(2, Math.round(len)));
  const rodMat = getMaterial('steel', { color: 0x6b4a36, roughness: 0.8, metalness: 0.7 });
  for (let i = 0; i < n; i++) {
    const off = new THREE.Vector3((Math.random() - 0.5) * sz.x * 0.6, (Math.random() - 0.5) * sz.y * 0.6, (Math.random() - 0.5) * sz.z * 0.6);
    off[axis] = 0;
    const rodLen = len * rnd(0.35, 0.7);
    const geo = cyl(0.007, 0.007, rodLen, 6);
    const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    const wpos = off.clone().add(new THREE.Vector3().setComponent(['x', 'y', 'z'].indexOf(axis), rnd(-0.2, 0.2) * len)).applyMatrix4(M);
    const q = new THREE.Quaternion();
    M.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3)))));
    const rod = spawn(null, { pos: wpos, quat: q, debris: true, parts: [{ shape: { type: 'cyl', r: 0.008, hh: rodLen / 2 }, mat: 'steel', meshes: [{ geo, material: rodMat }], pos: [0, 0, 0], rot: [0, 0, 0], mass: 0.6 * rodLen }] });
    if (!rod) continue;
    rod.defId = 'rebar';
    // bind the rod into the nearest chunk so chunks dangle off it
    const near = nearestEntity(wpos, 0.6, (o) => o.defId === 'chunk');
    if (near) addJoint('rebar', rod, wpos, near, wpos);
  }
}

export function nearestEntity(p, maxDist, filter) {
  let best = null, bd = maxDist;
  for (const e of entities.values()) {
    if (filter && !filter(e)) continue;
    const d = e.position(_v2).distanceTo(p);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// --------------------------------------------------------------------------- joints
function toLocal(e, worldPoint) {
  if (!e) return worldPoint.clone();
  const t = e.body.translation(), r = e.body.rotation();
  return worldPoint.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w).invert());
}
function toWorld(body, local) {
  const t = body.translation(), r = body.rotation();
  return local.clone().applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(t.x, t.y, t.z));
}

// Connect A to B (B = null means the world). Points are in world space.
export function addJoint(type, eA, pointA, eB, pointB, hingeAxis = null) {
  const bodyA = eA.body, bodyB = eB ? eB.body : groundBody;
  const la = toLocal(eA, pointA), lb = toLocal(eB, pointB);
  const created = [];
  if (type === 'hinge') {
    // two ball joints along the axis behave like a real hinge
    const axisW = (hingeAxis || new THREE.Vector3(0, 1, 0)).clone().normalize();
    for (const s of [-0.15, 0.15]) {
      const pa = pointA.clone().addScaledVector(axisW, s), pb = pointB.clone().addScaledVector(axisW, s);
      const data = R.JointData.spherical(toLocal(eA, pa), toLocal(eB, pb));
      created.push(world.createImpulseJoint(data, bodyA, bodyB, true));
    }
  } else {
    const qa = eA.quaternion(), qb = eB ? eB.quaternion() : new THREE.Quaternion();
    const frame2 = qb.clone().invert().multiply(qa);
    const data = R.JointData.fixed(la, { x: 0, y: 0, z: 0, w: 1 }, lb, { x: frame2.x, y: frame2.y, z: frame2.z, w: frame2.w });
    created.push(world.createImpulseJoint(data, bodyA, bodyB, true));
  }
  const rec = { type, joints: created, a: eA, b: eB, la, lb, strain: 0, ...JOINT_TYPES[type] };
  jointRecs.add(rec);
  eA.joints.add(rec);
  eB?.joints.add(rec);
  return rec;
}

export function removeJoint(rec) {
  if (!jointRecs.has(rec)) return;
  for (const j of rec.joints) if (world.getImpulseJoint(j.handle)) world.removeImpulseJoint(j, true);
  jointRecs.delete(rec);
  rec.a.joints.delete(rec);
  rec.b?.joints.delete(rec);
}

// Joints snap when they get stretched past what the connection can take.
export function updateJoints() {
  for (const rec of jointRecs) {
    if (!rec.a.alive || (rec.b && !rec.b.alive)) { removeJoint(rec); continue; }
    const wa = toWorld(rec.a.body, rec.la);
    const wb = rec.b ? toWorld(rec.b.body, rec.lb) : rec.lb;
    if (rec.type === 'hinge') continue; // hinge anchors are offset; checked through blasts instead
    if (wa.distanceTo(wb) > rec.tol) rec.strain++;
    else rec.strain = Math.max(0, rec.strain - 1);
    if (rec.strain > 4) {
      ctx.fx?.puff(wa, rec.type === 'weld' ? 0x555555 : 0x9a8a70, 0.15, 5);
      if (rec.type === 'weld' || rec.type === 'nails' || rec.type === 'rebar') ctx.fx?.impactSparks(wa, new THREE.Vector3(0, 1, 0), 6, 3);
      removeJoint(rec);
    }
  }
}

// Explosions rip joints apart when the shove is stronger than the joint.
export function stressJoints(e, impulse) {
  for (const rec of [...e.joints]) if (impulse > rec.strength) removeJoint(rec);
}

export function clearAll() {
  for (const e of [...entities.values()]) if (!e.permanent) removeEntity(e, { silent: true });
}

// Change what an object is made of (Material tool).
export function setEntityMaterial(e, matId) {
  const m = MATERIALS[matId];
  for (const part of e.parts) {
    const old = MATERIALS[part.mat];
    const ratio = m.density / old.density;
    part.mat = matId;
    const mass = part.collider.mass() * ratio;
    part.collider.setMass(Math.min(mass, 50000));
    part.collider.setFriction(m.friction);
    part.collider.setRestitution(m.restitution);
    const mat = getMaterial(matId);
    for (const mesh of part.meshList) {
      mesh.material = Array.isArray(mesh.material) ? [mat, getMaterial(matId, { inner: true })] : mat;
      mesh.castShadow = m.opacity == null;
    }
    part.hp = 100;
  }
  e.explosive = matId === 'tnt' ? { kind: 'tnt', power: Math.min(100, e.mass), remote: true, armed: true } : (e.def?.explosive && matId === e.origMat ? { ...e.def.explosive, armed: !!e.def.explosive.remote } : null);
}

// Apply an impulse (world-space N·s) at a world point.
export function applyImpulseAt(e, impulse, point) {
  if (e.frozen) return;
  e.body.applyImpulseAtPoint({ x: impulse.x, y: impulse.y, z: impulse.z }, { x: point.x, y: point.y, z: point.z }, true);
}
