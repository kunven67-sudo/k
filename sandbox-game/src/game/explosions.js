// Explosions, chain reactions, fuses/timers, propane-tank rockets and blast physics.
import * as THREE from 'three';
import { R, world, QUERY_SOLID, QUERY_ALL, physicsState } from '../engine/physics.js';
import { entities, removeEntity, damagePart, applyImpulseAt, stressJoints, entityFromCollider } from './entities.js';
import { MATERIALS } from '../gfx/materials.js';
import { ctx } from './ctx.js';

const pending = []; // { e, at }
const rockets = new Set(); // propane tanks venting
const rnd = (a, b) => a + Math.random() * (b - a);

export function initExplosions() {
  ctx.detonate = (e, delay = 0) => {
    if (!e.alive || e.detonating) return;
    e.detonating = true;
    pending.push({ e, at: physicsState.simTime + delay });
  };
  ctx.startRocket = startRocket;
}

function groundBelow(pos) {
  const hit = world.castRayAndGetNormal(new R.Ray({ x: pos.x, y: pos.y + 0.2, z: pos.z }, { x: 0, y: -1, z: 0 }), 8, true, undefined, QUERY_SOLID);
  if (!hit) return null;
  const c = hit.collider;
  const isStatic = c && c.parent() && c.parent().isFixed();
  return { y: pos.y + 0.2 - hit.timeOfImpact, normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), isStatic, dist: hit.timeOfImpact - 0.2 };
}

export function detonateNow(e) {
  if (!e.alive) return;
  const pos = e.position();
  const ex = e.explosive || { kind: 'tnt', power: 1 };
  ctx.audio?.loop('fuse' + e.id, 'hiss', 0);
  ctx.audio?.loop('vent' + e.id, 'hiss', 0);
  removeEntity(e, { silent: true });
  explode(pos, ex.power, { fuel: ex.kind === 'fuel' || ex.kind === 'propane', source: e, shrapnel: ex.shrapnel || (ex.kind === 'c4' || ex.kind === 'tnt' ? 20 : 0) });
}

// The blast. `power` = kg of TNT equivalent.
export function explode(pos, power, { fuel = false, shrapnel = 0, source = null } = {}) {
  const k = Math.cbrt(power);
  const radius = 7 * k;
  const ground = groundBelow(pos);
  ctx.fx.explosion(pos, power, { fuel, groundY: ground ? ground.y : null });
  if (ground && ground.isStatic && ground.dist < 1.2 * k) ctx.fx.scorch(new THREE.Vector3(pos.x, ground.y, pos.z), ground.normal, 3.2 * k * (fuel ? 1.4 : 1));
  ctx.onExplosion?.(pos, power, fuel);

  // Push + damage everything in range, with line-of-sight so walls shield what is behind them.
  const toDamage = [];
  for (const e of entities.values()) {
    if (e === source) continue;
    const c = e.position();
    const dist = c.distanceTo(pos);
    const reach = radius + e.radius;
    if (dist > reach) continue;
    const dir = c.clone().sub(pos);
    const d = Math.max(0.3, dist - e.radius * 0.5);
    let shield = 1;
    if (d > 0.8) {
      const ray = new R.Ray(pos, dir.clone().normalize());
      const hit = world.castRay(ray, dist, true, undefined, QUERY_SOLID, undefined, undefined, (col) => entityFromCollider(col.handle) !== e);
      if (hit) shield = 0.25;
    }
    const falloff = Math.max(0, 1 - d / reach);
    // blast impulse scales with the object's exposed area (bigger objects catch more of the wave)
    const area = Math.min(12, Math.PI * e.radius * e.radius);
    let J = 420 * k * k * area * falloff * falloff / (0.25 + d * 0.25) * shield;
    J = Math.min(J, e.mass * 60); // cap at 60 m/s of launch
    const n = dir.lengthSq() > 1e-6 ? dir.normalize() : new THREE.Vector3(0, 1, 0);
    n.y += 0.35; n.normalize(); // ground reflection lifts things
    const hitPoint = c.clone().addScaledVector(n, -e.radius * 0.4);
    if (!e.frozen) {
      applyImpulseAt(e, n.clone().multiplyScalar(J), hitPoint);
      e.body.applyTorqueImpulse({ x: rnd(-1, 1) * J * 0.05, y: rnd(-1, 1) * J * 0.05, z: rnd(-1, 1) * J * 0.05 }, true);
    }
    stressJoints(e, J);
    toDamage.push({ e, dvEq: (power * 900 * falloff * falloff * shield) / Math.max(1, Math.sqrt(e.mass)) / (0.5 + d), hitPoint, n });
  }
  for (const { e, dvEq, hitPoint, n } of toDamage) {
    if (!e.alive) continue;
    // chain reactions: explosives in the blast go off a moment later
    if (e.explosive && dvEq > (e.explosive.kind === 'propane' ? 6 : 3)) {
      if (e.explosive.rocket && Math.random() < 0.45 && dvEq < 40 && !e.rocketing) startRocket(e);
      else ctx.detonate(e, rnd(0.05, 0.22));
      continue;
    }
    for (const part of [...e.parts]) {
      const m = MATERIALS[part.mat];
      damagePart(e, part, dvEq * m.blast, hitPoint, n, 'blast');
      if (!e.alive) break;
    }
  }

  // shrapnel: fast fragments that hit/ding whatever they reach
  if (shrapnel > 0) {
    for (let i = 0; i < shrapnel; i++) {
      const d = new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize();
      const hit = world.castRayAndGetNormal(new R.Ray(pos, d), 25, true, undefined, QUERY_ALL);
      if (!hit) continue;
      const hp = pos.clone().addScaledVector(d, hit.timeOfImpact);
      const e = entityFromCollider(hit.collider.handle);
      if (Math.random() < 0.35) ctx.fx.impactSparks(hp, new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), 3, 4);
      if (e && e.alive) {
        applyImpulseAt(e, d.clone().multiplyScalar(6), hp);
        const part = e.parts.find((p) => p.collider.handle === hit.collider.handle) || e.parts[0];
        damagePart(e, part, 40 / Math.sqrt(e.mass), hp, d, 'shrapnel');
      }
    }
  }

  ctx.player?.blast(pos, power, radius);
}

function startRocket(e) {
  if (!e.alive || e.rocketing) return;
  e.rocketing = true;
  e.explosive = { ...(e.explosive || { kind: 'propane', power: 1.2 }) };
  rockets.add({ e, t: 0, dur: rnd(1.2, 3.0), axis: new THREE.Vector3(rnd(-0.2, 0.2), 1, rnd(-0.2, 0.2)).normalize() });
}

// Called every physics step.
export function updateExplosives(dt) {
  const now = physicsState.simTime;
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].at <= now) { const { e } = pending[i]; pending.splice(i, 1); detonateNow(e); }
  }
  for (const r of [...rockets]) {
    const e = r.e;
    if (!e.alive) { rockets.delete(r); continue; }
    r.t += dt;
    // thrust along the tank's axis (valve end), spinning it wildly
    const q = e.quaternion();
    const axis = r.axis.clone().applyQuaternion(q);
    const thrust = 900 * e.explosive.power;
    e.body.applyImpulse({ x: axis.x * thrust * dt, y: axis.y * thrust * dt, z: axis.z * thrust * dt }, true);
    e.body.applyTorqueImpulse({ x: rnd(-1, 1) * 8 * dt, y: rnd(-1, 1) * 14 * dt, z: rnd(-1, 1) * 8 * dt }, true);
    const nozzle = e.position().addScaledVector(axis, -e.radius);
    for (let k = 0; k < 2; k++) {
      ctx.fx.fire.emit({ pos: nozzle, vel: axis.clone().multiplyScalar(-rnd(6, 12)).add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1))), life: rnd(0.08, 0.2), size: 0.12, size1: 0.45, color: new THREE.Color(1, 0.6, 0.25).multiplyScalar(4), alpha: 0.9, alpha1: 0, drag: 2 });
      ctx.fx.smoke.emit({ pos: nozzle, vel: axis.clone().multiplyScalar(-rnd(2, 5)), life: rnd(1.5, 3), size: 0.2, size1: 1.2, color: 0xcfcfcf, alpha: 0.35, alpha1: 0, drag: 1.5, gravity: 0.3 });
    }
    ctx.onRocketTick?.(e);
    if (r.t > r.dur) { rockets.delete(r); detonateNow(e); }
  }
  // lit fuses and C4 timers
  for (const e of entities.values()) {
    const ex = e.explosive;
    if (!ex || ex.countdown == null) continue;
    ex.countdown -= dt;
    if (ex.fuseLit) {
      const tip = e.position().add(new THREE.Vector3(0.18, 0.05, 0).applyQuaternion(e.quaternion()));
      ctx.fx.sparks.emit({ pos: tip, vel: new THREE.Vector3(rnd(-1, 1), rnd(0, 2), rnd(-1, 1)), life: 0.25, size: 0.008, color: new THREE.Color(1, 0.7, 0.3).multiplyScalar(5), alpha: 1, alpha1: 0, gravity: -9.81 });
    }
    if (ex.countdown <= 0) { ex.countdown = null; ctx.detonate(e, 0); }
  }
}

export function lightFuse(e) {
  if (!e.explosive || e.explosive.countdown != null) return false;
  if (e.explosive.fuse) { e.explosive.fuseLit = true; e.explosive.countdown = 4; return 'fuse'; }
  if (e.explosive.timer) { e.explosive.countdown = 10; return 'timer'; }
  return false;
}

export function detonateAllRemote(fromPos) {
  const list = [...entities.values()].filter((e) => e.explosive?.armed && e.explosive.remote);
  list.sort((a, b) => a.position().distanceTo(fromPos) - b.position().distanceTo(fromPos));
  list.forEach((e, i) => ctx.detonate(e, 0.03 + i * 0.015));
  return list.length;
}
