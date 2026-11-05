// You: a capsule that walks on the ground and on builds, can fly, sits in seats, and gets thrown by explosions.
import * as THREE from 'three';
import { R, world, owners, G, groups } from '../core/physics.js';
import { rig, camera, renderer } from '../core/render.js';
import { worldPos, worldQuat } from '../parts/rt.js';
import { constructOf, bodies } from '../build/core.js';
import { LIMIT } from '../world.js';
import { game, GRAVITY } from '../game.js';

const HALF = 0.6, RAD = 0.3; // capsule: 1.8 m tall
export const player = {
  pos: new THREE.Vector3(0, 0, 8), vel: new THREE.Vector3(), push: new THREE.Vector3(),
  yaw: 0, pitch: -0.12, fly: false, grounded: false, seat: null, remote: null, thirdPerson: false,
  orbitYaw: 0, orbitPitch: 0.35, eye: 1.62, hurt: 0, shake: 0, body: null, collider: null, cc: null, stepT: 0
};

export function initPlayer() {
  player.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(player.pos.x, player.pos.y + HALF + RAD, player.pos.z));
  player.collider = world.createCollider(R.ColliderDesc.capsule(HALF, RAD).setCollisionGroups(groups(G.PLAYER, G.WORLD | G.PARTS | G.HUMAN)), player.body);
  owners.set(player.collider.handle, { kind: 'player' });
  const cc = world.createCharacterController(0.03);
  cc.setUp({ x: 0, y: 1, z: 0 });
  cc.enableAutostep(0.45, 0.2, false);
  cc.enableSnapToGround(0.35);
  cc.setMaxSlopeClimbAngle(50 * Math.PI / 180);
  cc.setMinSlopeSlideAngle(60 * Math.PI / 180);
  cc.setApplyImpulsesToDynamicBodies(true);
  cc.setCharacterMass(80);
  player.cc = cc;
}

// move = { x: right, z: forward, up, down, jump, sprint }
const _d = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
export function movePlayer(dt, move, headYaw = player.yaw) {
  if (player.seat) return;
  const g = GRAVITY[game.settings.gravity];
  _f.set(-Math.sin(headYaw), 0, -Math.cos(headYaw));
  _r.set(-_f.z, 0, _f.x);
  const speed = player.fly ? (move.sprint ? 32 : 11) : (move.sprint ? 8.5 : 4.6);
  _d.set(0, 0, 0).addScaledVector(_f, move.z).addScaledVector(_r, move.x);
  if (_d.lengthSq() > 1) _d.normalize();
  _d.multiplyScalar(speed);
  if (player.fly) {
    player.vel.y = ((move.up ? 1 : 0) - (move.down ? 1 : 0)) * speed * 0.8;
  } else {
    player.vel.y += g * dt;
    if (player.grounded && move.jump) { player.vel.y = g > -3 ? 3.2 : 5.2; game.sound('step', player.pos, 0.4); }
    if (g === 0 && move.up) player.vel.y = 3;
    if (g === 0 && move.down) player.vel.y = -3;
  }
  // knockback / black hole pulls fade out (fast on the ground, slow in the air)
  player.push.multiplyScalar(Math.max(0, 1 - dt * (player.grounded ? 6 : 0.8)));
  const mv = { x: (_d.x + player.push.x) * dt, y: (player.vel.y + player.push.y) * dt, z: (_d.z + player.push.z) * dt };
  player.cc.computeColliderMovement(player.collider, mv, R.QueryFilterFlags.EXCLUDE_SENSORS, groups(G.PLAYER, G.WORLD | G.PARTS | G.HUMAN));
  const c = player.cc.computedMovement();
  const wasGrounded = player.grounded;
  player.grounded = player.cc.computedGrounded();
  if (player.fly) player.grounded = false;
  player.pos.x += c.x; player.pos.y += c.y; player.pos.z += c.z;
  if (player.grounded && player.vel.y < 0) { player.vel.y = 0; if (!wasGrounded) game.sound('step', player.pos, 0.5); }
  if (c.y < mv.y - 0.001 && player.vel.y > 0) player.vel.y = 0; // bonked your head
  if (player.push.y > 0 && c.y < mv.y * 0.5) player.push.y = 0;
  // keep you in the world
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -LIMIT, LIMIT);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -LIMIT, LIMIT);
  if (player.pos.y < -30) respawn();
  if (player.pos.y > 3000) player.pos.y = 3000;
  player.body.setNextKinematicTranslation({ x: player.pos.x, y: player.pos.y + HALF + RAD, z: player.pos.z });
  // footsteps
  if (player.grounded && _d.lengthSq() > 1) {
    player.stepT -= dt * Math.sqrt(_d.lengthSq()) / 4.6;
    if (player.stepT <= 0) { player.stepT = 0.42; game.sound('step', player.pos, 0.22); }
  }
}
export function respawn() {
  player.pos.set(0, 0.1, 8); player.vel.set(0, 0, 0); player.push.set(0, 0, 0);
  player.body.setTranslation({ x: 0, y: 0.1 + HALF + RAD, z: 8 }, true);
}
export function teleportPlayer(p) {
  player.pos.copy(p); player.vel.set(0, 0, 0);
  player.body.setTranslation({ x: p.x, y: p.y + HALF + RAD, z: p.z }, true);
}
export function knock(v) { player.push.add(v); if (v.y > 2) player.grounded = false; }
export function playerCenter(out = new THREE.Vector3()) { return out.copy(player.pos).setY(player.pos.y + 0.9); }
export function playerHead(out = new THREE.Vector3()) { return camera.getWorldPosition(out); }

/* ---------------- seats ---------------- */
export function sit(seat) {
  if (seat.st.rider) return false;
  player.seat = seat;
  seat.st.rider = 'you';
  player.collider.setEnabled(false);
  player.thirdPerson = false;
  player.pitch = -0.05; player.yaw = 0;
  game.sound('soft', worldPos(seat), 0.5);
  return true;
}
export function standUp() {
  const s = player.seat;
  if (!s) return;
  player.seat = null;
  s.st.rider = null;
  // step out to the side of the seat, a little up so you never land inside the build
  const q = worldQuat(s);
  const p = worldPos(s).add(new THREE.Vector3(1.1, 0.4, 0).applyQuaternion(q));
  p.y = Math.max(p.y, 0.05);
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  player.yaw = e.y;
  player.collider.setEnabled(true);
  teleportPlayer(p);
}
// where your eyes are when you sit: above the seat cushion, looking the way the seat faces
const _sq = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _o = new THREE.Vector3();
export function seatView(out) {
  const s = player.seat;
  worldPos(s, out.pos, _o.set(0, -s.size.y / 2 + 0.95, 0.05));
  worldQuat(s, _sq);
  out.quat.copy(_sq);
  return out;
}

export function updateCamera(dt) {
  const xr = renderer.xr.isPresenting;
  player.shake = Math.max(0, player.shake - dt * 1.6);
  if (player.seat) {
    const v = seatView({ pos: rig.position, quat: rig.quaternion });
    if (xr) {
      // in VR: only turn with the build around the up axis unless it flips over, so it does not make you sick
      _e.setFromQuaternion(v.quat, 'YXZ');
      if (game.settings.vrComfort !== false) rig.quaternion.setFromEuler(_e.set(0, _e.y, 0, 'YXZ'));
      // put your real head exactly on the seat's eye point, wherever you are standing in your room
      rig.position.sub(_o.copy(camera.position).applyQuaternion(rig.quaternion));
      return;
    }
    if (player.thirdPerson) return orbitCamera(constructOf(player.seat.body));
    camera.position.set(0, 0, 0);
    camera.quaternion.setFromEuler(_e.set(player.pitch, player.yaw, 0, 'YXZ'));
    return;
  }
  if (player.remote) { if (!xr) return orbitCamera(constructOf(player.remote.body)); }
  rig.quaternion.identity();
  if (xr) {
    rig.position.copy(player.pos);
    rig.position.y += game.settings.vrHeight || 0;
    return;
  }
  rig.position.copy(player.pos);
  camera.position.set(0, player.eye, 0);
  camera.quaternion.setFromEuler(_e.set(player.pitch, player.yaw, 0, 'YXZ'));
  if (player.shake > 0) {
    const s = player.shake * player.shake * 0.25;
    camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
    camera.rotation.z += (Math.random() - 0.5) * s * 0.3;
  }
}
const _box = new THREE.Box3(), _c = new THREE.Vector3();
function orbitCamera(set) {
  _box.makeEmpty();
  for (const b of set) _box.expandByPoint(_c.copy(b.group.position));
  _box.getCenter(_c);
  let r = 0;
  for (const b of set) r = Math.max(r, b.group.position.distanceTo(_c) + (b.radius || 1));
  const dist = Math.max(5, r * 2.4);
  rig.quaternion.identity();
  const cp = Math.cos(player.orbitPitch);
  rig.position.set(_c.x + Math.sin(player.orbitYaw) * cp * dist, _c.y + Math.sin(player.orbitPitch) * dist, _c.z + Math.cos(player.orbitYaw) * cp * dist);
  rig.position.y = Math.max(rig.position.y, 0.5);
  camera.position.set(0, 0, 0);
  camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(rig.position, _c, new THREE.Vector3(0, 1, 0)));
}
