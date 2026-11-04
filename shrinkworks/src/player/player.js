// You: a capsule that walks on the floor, counters and builds, flies with a jetpack, shrinks and grows, sits in seats,
// gets thrown by explosions and gets hurt (tiny you gets hurt too: a falling crumb hits like a rock).
import * as THREE from 'three';
import { R, world, owners, G, groups } from '../core/physics.js';
import { rig, camera, renderer } from '../core/render.js';
import { worldPos, worldQuat } from '../parts/rt.js';
import { constructOf, bodies } from '../build/core.js';
import { LIMIT, ROOM, START } from '../world.js';
import { game, GRAVITY, U } from '../game.js';

// normal size: 1.75 m tall (17.5 units)
const HALF0 = 6.25, RAD0 = 2.5;
export const SIZE_MIN = 0.01, SIZE_MAX = 2.5;
export const player = {
  pos: START.clone(), vel: new THREE.Vector3(), push: new THREE.Vector3(),
  yaw: 0, pitch: -0.35, fly: false, grounded: false, seat: null, remote: null, thirdPerson: false,
  orbitYaw: 0, orbitPitch: 0.35, eye: 16.2, hurt: 0, shake: 0, body: null, collider: null, cc: null, stepT: 0,
  scale: 1, hp: 100, hpT: 0, dead: 0, jet: 0, fallFrom: 0
};
export const playerHeight = () => (HALF0 + RAD0) * 2 * player.scale;
const pg = () => groups(G.PLAYER, G.WORLD | G.PARTS | G.HUMAN);

function makeCollider() {
  if (player.collider) { owners.delete(player.collider.handle); world.removeCollider(player.collider, false); }
  const s = player.scale;
  player.collider = world.createCollider(R.ColliderDesc.capsule(HALF0 * s, RAD0 * s).setCollisionGroups(pg()), player.body);
  owners.set(player.collider.handle, { kind: 'player' });
  const cc = player.cc;
  if (cc) {
    cc.setOffset(Math.max(0.004, 0.12 * s));
    cc.enableAutostep(2.4 * s, 1.2 * s, false);
    cc.enableSnapToGround(2.5 * s);
    cc.setCharacterMass(75000 * s * s * s);
  }
  player.body.setTranslation({ x: player.pos.x, y: player.pos.y + (HALF0 + RAD0) * s, z: player.pos.z }, true);
}
export function initPlayer() {
  player.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(player.pos.x, player.pos.y + HALF0 + RAD0, player.pos.z));
  const cc = world.createCharacterController(0.12);
  cc.setUp({ x: 0, y: 1, z: 0 });
  cc.setMaxSlopeClimbAngle(50 * Math.PI / 180);
  cc.setMinSlopeSlideAngle(60 * Math.PI / 180);
  cc.setApplyImpulsesToDynamicBodies(true);
  player.cc = cc;
  makeCollider();
}

// shrink or grow (1 = normal). Returns false when there is no room to grow where you stand.
export function setPlayerScale(s, force = false) {
  s = THREE.MathUtils.clamp(s, SIZE_MIN, SIZE_MAX);
  if (Math.abs(s - player.scale) < 1e-5) return true;
  if (s > player.scale && !force) {
    // growing inside a cupboard or under the counter would get you stuck: check the bigger you fits first
    let blocked = false;
    const c = { x: player.pos.x, y: player.pos.y + (HALF0 + RAD0) * s + 0.02 * s, z: player.pos.z };
    world.intersectionsWithShape(c, { x: 0, y: 0, z: 0, w: 1 }, new R.Capsule(HALF0 * s * 0.98, RAD0 * s * 0.92), (col) => {
      const o = owners.get(col.handle);
      if (o && (o.kind === 'ground' || (o.kind === 'part' && o.ref.body.frozen))) { blocked = true; return false; }
      return true;
    }, undefined, groups(G.PLAYER, G.WORLD | G.PARTS), player.collider);
    if (blocked) return false;
  }
  player.scale = s;
  player.eye = 16.2 * s;
  makeCollider();
  game.onScale && game.onScale(s);
  return true;
}

// move = { x: right, z: forward, up, down, jump, sprint, jet (0..1 jetpack), dx, dz (real steps you took in your room, VR) }
const _d = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
export function movePlayer(dt, move, headYaw = player.yaw) {
  if (player.seat) return;
  const g = GRAVITY[game.settings.gravity];
  const s = player.scale;
  _f.set(-Math.sin(headYaw), 0, -Math.cos(headYaw));
  _r.set(-_f.z, 0, _f.x);
  // real people walk ~1.4 m/s; small you is slow (that's what the jetpack is for)
  const walk = 14 * Math.pow(s, 0.8), speed = player.fly ? walk * 2.2 : (move.sprint ? walk * 2.3 : walk);
  _d.set(0, 0, 0).addScaledVector(_f, move.z).addScaledVector(_r, move.x);
  if (_d.lengthSq() > 1) _d.normalize();
  _d.multiplyScalar(speed);
  const jet = move.jet || 0;
  player.jet = jet;
  if (player.fly) {
    player.vel.y = ((move.up ? 1 : 0) - (move.down ? 1 : 0)) * speed * 0.8;
  } else if (jet > 0) {
    // jetpack: pushes you up harder than gravity pulls; more push = faster climb, capped so you stay in control
    const maxUp = 28 * Math.pow(s, 0.5);
    player.vel.y = Math.min(maxUp, player.vel.y + (-g * 1.6 * jet) * dt + g * dt);
    _d.multiplyScalar(1.6);
  } else {
    player.vel.y += g * dt;
    if (player.grounded && move.jump) { player.vel.y = (g > -30 ? 14 : 26) * Math.pow(s, 0.5); game.sound('step', player.pos, 0.4); }
    if (g === 0 && move.up) player.vel.y = 20 * s;
    if (g === 0 && move.down) player.vel.y = -20 * s;
  }
  // knockback / black hole pulls fade out (fast on the ground, slow in the air)
  player.push.multiplyScalar(Math.max(0, 1 - dt * (player.grounded ? 6 : 0.8)));
  const mv = { x: (_d.x + player.push.x) * dt + (move.dx || 0), y: (player.vel.y + player.push.y) * dt, z: (_d.z + player.push.z) * dt + (move.dz || 0) };
  // going up (jetpack, jump, launched): no snapping back down to the floor
  if (mv.y > 0.0005 * s) player.cc.disableSnapToGround(); else player.cc.enableSnapToGround(2.5 * s);
  player.cc.computeColliderMovement(player.collider, mv, R.QueryFilterFlags.EXCLUDE_SENSORS, pg());
  const c = player.cc.computedMovement();
  const wasGrounded = player.grounded;
  player.grounded = player.cc.computedGrounded();
  if (player.fly) player.grounded = false;
  player.pos.x += c.x; player.pos.y += c.y; player.pos.z += c.z;
  if (player.grounded && player.vel.y < 0) {
    // landing: a hard landing hurts at any size (real damage, like a real fall)
    const impact = -player.vel.y / U;
    if (!wasGrounded && impact > 6.5) hurtPlayer((impact - 6.5) * 13, 'fall');
    player.vel.y = 0;
    if (!wasGrounded) game.sound('step', player.pos, Math.min(1, 0.3 + impact * 0.1), s < 0.2 ? 1.6 : 1);
  }
  if (player.vel.y > 0 && mv.y > 0 && c.y < mv.y * 0.4) player.vel.y = 0; // bonked your head
  if (player.push.y > 0 && c.y < mv.y * 0.5) player.push.y = 0;
  // keep you in the kitchen
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, ROOM.x0 + 1, ROOM.x1 - 1);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, ROOM.z0 + 1, ROOM.z1 - 1);
  if (player.pos.y < -5) respawn();
  if (player.pos.y > ROOM.h) player.pos.y = ROOM.h - playerHeight();
  player.body.setNextKinematicTranslation({ x: player.pos.x, y: player.pos.y + (HALF0 + RAD0) * s, z: player.pos.z });
  // footsteps
  if (player.grounded && _d.lengthSq() > 1e-4) {
    player.stepT -= dt * Math.sqrt(_d.lengthSq()) / walk;
    if (player.stepT <= 0) { player.stepT = 0.42; game.sound('step', player.pos, 0.22 * Math.min(1, s * 2 + 0.2), s < 0.2 ? 1.7 : 1); }
  }
  return c;
}
export function respawn() {
  player.vel.set(0, 0, 0); player.push.set(0, 0, 0);
  setPlayerScale(1, true);
  teleportPlayer(START);
}
export function teleportPlayer(p) {
  player.pos.copy(p); player.vel.set(0, 0, 0);
  player.teleported = true; // VR: move your play space with you instead of pulling you back under your real head
  player.body.setTranslation({ x: p.x, y: p.y + (HALF0 + RAD0) * player.scale, z: p.z }, true);
}
export function knock(v) { player.push.add(v); if (v.y > 2) player.grounded = false; }
export function playerCenter(out = new THREE.Vector3()) { return out.copy(player.pos).setY(player.pos.y + (HALF0 + RAD0) * player.scale); }
export function playerHead(out = new THREE.Vector3()) { return camera.getWorldPosition(out); }
// the capsule (for rays that can hit you): bottom point, top point, radius
export function playerCapsule() {
  const s = player.scale;
  return { a: new THREE.Vector3(player.pos.x, player.pos.y + RAD0 * s, player.pos.z), b: new THREE.Vector3(player.pos.x, player.pos.y + (HALF0 * 2 + RAD0) * s, player.pos.z), r: RAD0 * s };
}

/* ---------------- getting hurt ---------------- */
export function hurtPlayer(amount, why) {
  if (!game.settings.damage || player.dead > 0 || amount <= 0) return;
  player.hp -= amount;
  player.hpT = 3;
  game.hurt = Math.max(game.hurt || 0, Math.min(1, 0.35 + amount / 60));
  player.shake = Math.max(player.shake, Math.min(1, amount / 50));
  game.sound('punch', null, Math.min(1, 0.3 + amount / 60));
  if (game.onHurt) game.onHurt(amount);
  if (player.hp <= 0) {
    player.hp = 0;
    player.dead = 2.2;
    game.toast(why === 'fall' ? 'That fall knocked you out' : why === 'hit' ? 'You got squashed' : 'You got knocked out');
  }
}
export function playerTick(dt) {
  if (player.dead > 0) {
    player.dead -= dt;
    if (player.dead <= 0) { player.hp = 100; respawn(); game.toast('Back at normal size, at the island'); }
    return;
  }
  player.hpT -= dt;
  if (player.hpT <= 0 && player.hp < 100) player.hp = Math.min(100, player.hp + dt * 12);
}

/* ---------------- seats ---------------- */
export function sit(seat) {
  if (seat.st.rider) return false;
  player.seat = seat;
  seat.st.rider = 'you';
  player.sizeBeforeSeat = player.scale;
  setPlayerScale(0.1 * seat.size.y / (seat.def.size[1] || 1), true);
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
  const p = worldPos(s).add(new THREE.Vector3(s.size.x * 1.1, 0.4 * s.size.y, 0).applyQuaternion(q));
  p.y = Math.max(p.y, 0.02);
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  player.yaw = e.y;
  player.collider.setEnabled(true);
  teleportPlayer(p);
  if (player.sizeBeforeSeat) { setPlayerScale(player.sizeBeforeSeat, true); player.sizeBeforeSeat = null; }
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
      rig.position.sub(_o.copy(camera.position).multiplyScalar(rig.scale.x).applyQuaternion(rig.quaternion));
      return;
    }
    if (player.thirdPerson) return orbitCamera(constructOf(player.seat.body));
    camera.position.set(0, 0, 0);
    camera.quaternion.setFromEuler(_e.set(player.pitch, player.yaw, 0, 'YXZ'));
    return;
  }
  if (player.remote) { if (!xr) return orbitCamera(constructOf(player.remote.body)); }
  rig.quaternion.identity();
  if (xr) return; // VR: the VR code puts the rig under your real head every frame
  rig.position.copy(player.pos);
  rig.scale.setScalar(1);
  camera.position.set(0, player.eye, 0);
  camera.near = Math.max(0.0015, 0.5 * player.scale); camera.updateProjectionMatrix();
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
  const dist = Math.max(3, r * 2.4);
  rig.quaternion.identity();
  const cp = Math.cos(player.orbitPitch);
  rig.position.set(_c.x + Math.sin(player.orbitYaw) * cp * dist, _c.y + Math.sin(player.orbitPitch) * dist, _c.z + Math.cos(player.orbitYaw) * cp * dist);
  rig.position.y = Math.max(rig.position.y, 0.5);
  camera.position.set(0, 0, 0);
  camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(rig.position, _c, new THREE.Vector3(0, 1, 0)));
}
