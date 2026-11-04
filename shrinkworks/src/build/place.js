// Where a new part goes when you point at a spot: flat against the surface, lined up with the build's grid.
import * as THREE from 'three';
import { R, world, G, groups, fromV, fromQ } from '../core/physics.js';
import { bodyPose, shapeDesc } from './core.js';
import { ghostOK, ghostBad } from '../core/mats.js';
import { scene } from '../core/render.js';
import { DEFS } from '../parts/defs.js';

const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4();

function halfAlong(p, u) {
  // half the size of part p along direction u (in its body's space)
  const ax = X.clone().applyQuaternion(p.quat), ay = Y.clone().applyQuaternion(p.quat), az = Z.clone().applyQuaternion(p.quat);
  return Math.abs(u.dot(ax)) * p.size.x / 2 + Math.abs(u.dot(ay)) * p.def.halfH(p) + Math.abs(u.dot(az)) * p.size.z / 2;
}
function boxy(p, nL) {
  // flat faces only: snapping on a ball or a pipe's round side would float the part off the surface
  if (!p) return true;
  if (['ball', 'cylinder', 'pipe', 'cone', 'balloon', 'ball_head', 'tire'].includes(p.def.id)) {
    const ay = Y.clone().applyQuaternion(p.quat);
    return p.def.id !== 'ball' && p.def.id !== 'ball_head' && Math.abs(nL.dot(ay)) > 0.98;
  }
  for (const a of [X, Y, Z]) if (Math.abs(nL.dot(a.clone().applyQuaternion(p.quat))) > 0.98) return true;
  return false;
}

// hit: physics ray hit; def; size (Vector3); spin (radians, added on top); grid (m, 0 = off); look: camera forward
export function computePlacement(hit, def, size, spin, grid, look) {
  const target = hit.owner && hit.owner.kind === 'part' ? hit.owner.ref : null;
  const body = target ? target.body : null;
  let bp = new THREE.Vector3(), bq = new THREE.Quaternion();
  if (body) ({ pos: bp, quat: bq } = bodyPose(body));
  const inv = bq.clone().invert();
  const nL = hit.normal.clone().applyQuaternion(inv).normalize();
  const ptL = hit.point.clone().sub(bp).applyQuaternion(inv);
  // the part's up goes along the surface; its sideways axis lines up with the build (or the world)
  let ref = X.clone();
  let best = 2;
  for (const a of [X, Z, Y]) { const d = Math.abs(a.dot(nL)); if (d < best - 0.01) { best = d; ref = a.clone(); } }
  const t1 = ref.sub(nL.clone().multiplyScalar(ref.dot(nL))).normalize();
  const t2 = new THREE.Vector3().crossVectors(t1, nL).normalize();
  const q0 = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(t1, nL, t2));
  // face it the way you are looking (in 90 degree steps), plus your own turns
  let face = 0;
  if (look) {
    const lL = look.clone().applyQuaternion(inv);
    const lt = lL.sub(nL.clone().multiplyScalar(lL.dot(nL)));
    if (lt.lengthSq() > 1e-4) {
      const back = new THREE.Vector3(0, 0, -1).applyQuaternion(q0);
      face = Math.atan2(new THREE.Vector3().crossVectors(back, lt).dot(nL), back.dot(lt));
      face = Math.round(face / (Math.PI / 2)) * (Math.PI / 2);
    }
  }
  const quat = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, face + spin));
  const stub = { def, size, props: {}, quat };
  const h = def.halfH(stub);
  const pos = ptL.clone().addScaledVector(nL, h);
  if (grid > 0 && boxy(target, nL)) {
    for (const [u, ext] of [[X.clone().applyQuaternion(quat), size.x / 2], [Z.clone().applyQuaternion(quat), size.z / 2]]) {
      const coord = pos.dot(u);
      let base = 0;
      if (target) base = target.pos.dot(u) - halfAlong(target, u);
      const edge = coord - ext;
      const snapped = base + Math.round((edge - base) / grid) * grid;
      pos.addScaledVector(u, snapped + ext - coord);
    }
  }
  const wpos = pos.clone().applyQuaternion(bq).add(bp), wquat = bq.clone().multiply(quat);
  return { body, target, pos, quat, wpos, wquat, normal: hit.normal.clone(), valid: true };
}

// is there room? (shrunk a little so touching is fine, overlapping is not)
export function roomFor(pl, def, size) {
  const stub = { def, size, props: {}, quat: new THREE.Quaternion(), pos: new THREE.Vector3() };
  let ok = true;
  for (const s of def.shapes ? def.shapes(stub) : []) {
    const shrink = (v) => Math.max(0.01, v - 0.04);
    let shape;
    if (s.t === 'box') shape = new R.Cuboid(shrink(s.h[0]), shrink(s.h[1]), shrink(s.h[2]));
    else if (s.t === 'cyl') shape = new R.Cylinder(shrink(s.hh), shrink(s.r));
    else if (s.t === 'ball') shape = new R.Ball(shrink(s.r));
    else if (s.t === 'cone') shape = new R.Cone(shrink(s.hh), shrink(s.r));
    else continue;
    const off = new THREE.Vector3(...(s.p || [0, 0, 0])).applyQuaternion(pl.wquat).add(pl.wpos);
    const q = pl.wquat.clone(); if (s.q) q.multiply(s.q);
    // query as 'world' so parts, you and people all count, but the ground itself does not
    world.intersectionsWithShape(fromV(off), fromQ(q), shape, () => { ok = false; return false; },
      undefined, groups(G.WORLD, G.PARTS | G.PLAYER | G.HUMAN));
    if (!ok) break;
  }
  return ok;
}

/* ---------------- the see-through preview ---------------- */
export const ghost = { obj: null, key: '' };
export function setGhost(def, size, props, mat, color) {
  const key = def.id + size.toArray().join() + JSON.stringify(props) + mat + color;
  if (ghost.key === key && ghost.obj) return ghost.obj;
  if (ghost.obj) scene.remove(ghost.obj);
  ghost.key = key;
  let o;
  if (def.person) {
    o = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.2, 4, 12), ghostOK);
    o.geometry.translate(0, 0.88, 0);
  } else {
    const stub = { def, size: size.clone(), props: { ...Object.fromEntries(def.props.map((p) => [p.k, p.def])), ...props }, mat, color, st: {}, pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    o = def.mesh(stub, null);
    if (def.joint) {
      const R2 = DEFS[def.joint.rotor];
      const rs = def.joint.rotorSize(stub);
      const rstub = { def: R2, size: new THREE.Vector3(...rs), props: {}, mat, color, st: {} };
      const rm = R2.mesh(rstub, null);
      rm.position.y = def.joint.at(stub) + def.joint.rotorAt(stub);
      o.add(rm);
    }
  }
  o.traverse((c) => {
    if (c.isMesh) { c.material = ghostOK; c.castShadow = false; c.receiveShadow = false; c.renderOrder = 9; }
  });
  o.userData.ghost = true;
  ghost.obj = o;
  scene.add(o);
  return o;
}
export function showGhost(pl, ok) {
  const o = ghost.obj;
  if (!o) return;
  o.visible = !!pl;
  if (!pl) return;
  o.position.copy(pl.wpos);
  o.quaternion.copy(pl.wquat);
  const m = ok ? ghostOK : ghostBad;
  o.traverse((c) => { if (c.isMesh) c.material = m; });
}
export function hideGhost() { if (ghost.obj) ghost.obj.visible = false; }
