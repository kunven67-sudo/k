// Small runtime helpers parts use while the game runs (where a part is in the world, pushing on bodies).
import * as THREE from 'three';

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
export function bodyQuat(rb, out = new THREE.Quaternion()) { const r = rb.rotation(); return out.set(r.x, r.y, r.z, r.w); }
export function bodyPos(rb, out = new THREE.Vector3()) { const t = rb.translation(); return out.set(t.x, t.y, t.z); }
export function worldPos(p, out = new THREE.Vector3(), local = null) {
  bodyQuat(p.body.rb, _q);
  out.copy(local || p.pos);
  if (local) out.applyQuaternion(p.quat).add(p.pos);
  return out.applyQuaternion(_q).add(bodyPos(p.body.rb, _v));
}
export function worldQuat(p, out = new THREE.Quaternion()) { return bodyQuat(p.body.rb, out).multiply(p.quat); }
// the part's own up direction (+Y) in the world
export function worldUp(p, out = new THREE.Vector3()) { return out.set(0, 1, 0).applyQuaternion(worldQuat(p, _q)); }
export function worldDir(p, x, y, z, out = new THREE.Vector3()) { return out.set(x, y, z).applyQuaternion(worldQuat(p, _q)); }

export function push(rb, force, point, dt) {
  rb.applyImpulseAtPoint({ x: force.x * dt, y: force.y * dt, z: force.z * dt }, { x: point.x, y: point.y, z: point.z }, true);
}
export function pushCenter(rb, force, dt) { rb.applyImpulse({ x: force.x * dt, y: force.y * dt, z: force.z * dt }, true); }
export function twist(rb, torque, dt) { rb.applyTorqueImpulse({ x: torque.x * dt, y: torque.y * dt, z: torque.z * dt }, true); }
export function velAt(rb, point, out = new THREE.Vector3()) { const v = rb.velocityAtPoint({ x: point.x, y: point.y, z: point.z }); return out.set(v.x, v.y, v.z); }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
