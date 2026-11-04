// THE MASK - people you can spawn: knights, barbarians, mages, rogues (KayKit, CC0). They wander around, get hurt,
// bleed (no gore), fight back or run, get thrown around like rag dolls, and get back up if they're still alive.
import * as THREE from 'three';
import { G, rand, pick, clamp, damp, emit, unlock } from './game.js';
import { world, CANNON, GROUP, toV3, toQ, collideCircle } from './physics.js';
import { makeBody, TYPES } from './chars.js';
import { ROOM } from './room.js';
import { audio } from './audio.js';
import { tint } from './props.js';

const SCALE = 0.75;          // KayKit units -> meters (about 1.7 m tall, cartoon proportions)
const COM = 0.6;             // body center height (m) at size 1
const BRAVE = { knight: true, barbarian: true, mage: false, rogue: false };
const ATTACK = { knight: '1H_Melee_Attack_Chop', barbarian: '1H_Melee_Attack_Slice_Diagonal', mage: 'Unarmed_Melee_Attack_Punch_A', rogue: 'Unarmed_Melee_Attack_Kick' };
const up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
let nextId = 1;

export class Person {
  constructor(type, pos, yaw = 0) {
    this.kind = 'person'; this.uid = nextId++; this.type = type;
    this.b = makeBody(type);
    this.root = new THREE.Group(); this.root.name = 'person-' + type; this.root.userData.ent = this;
    this.b.root.scale.setScalar(SCALE); this.root.add(this.b.root);
    // own material so freezing one person doesn't tint everyone
    this.b.mesh.material = this.b.mesh.material.clone();
    this.root.position.copy(pos); this.yaw = yaw; this.root.rotation.y = yaw;
    this.size = 1; this.hp = 100; this.alive = true; this.removed = false;
    this.state = 'idle'; this.timer = rand(0.5, 3); this.goal = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.brave = BRAVE[type]; this.angry = 0; this.scared = 0; this.frozen = 0; this.floating = false; this.held = null;
    this.down = 0; this.still = 0; this.knock = new THREE.Vector3(); this.hitCool = 0; this.lastHitBy = null;
    this.body = new CANNON.Body({ mass: 60, type: CANNON.Body.KINEMATIC, linearDamping: 0.08, angularDamping: 0.3, allowSleep: false,
      collisionFilterGroup: GROUP.PERSON, collisionFilterMask: GROUP.ROOM | GROUP.PROP | GROUP.HAND });
    this.setShape(1);
    this.body.ent = this;
    this.body.addEventListener('collide', (e) => {
      if (this.state !== 'tumble') return;
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 3) {
        if (G.t - (this.lastBump || 0) > 0.12) { this.lastBump = G.t; audio.play('thud', this.pos, clamp(v / 8, 0.3, 1)); }
        if (v > 6.5) this.hurt((v - 6) * 9, null, null, 'impact');
      }
    });
    this.b.play('Idle');
    this.attach();
  }
  get pos() { return this.root.position; }
  get radius() { return 0.45 * this.size; }
  setShape(s) {
    const b = this.body; while (b.shapes.length) b.removeShape(b.shapes[0]);
    b.addShape(new CANNON.Sphere(0.27 * s), new CANNON.Vec3(0, 0, 0));
    b.addShape(new CANNON.Sphere(0.36 * s), new CANNON.Vec3(0, 0.66 * s, 0));
    b.addShape(new CANNON.Sphere(0.18 * s), new CANNON.Vec3(0, -0.4 * s, 0));
    b.mass = 60 * s * s * s; b.updateMassProperties();
  }
  attach() { if (!this.root.parent) G.scene.add(this.root); if (!this.body.world) world.addBody(this.body); this.removed = false; G.entities.add(this); }
  detach() { if (this.root.parent) this.root.parent.remove(this.root); if (this.body.world) world.removeBody(this.body); this.removed = true; G.entities.delete(this); }

  // hit spheres from the real bones, so they follow the body in any pose (standing, lying, flying)
  spheres() {
    const s = this.size;
    this.root.updateMatrixWorld(true);
    const head = this.b.bones.head.localToWorld(_v.set(0, 0.42, 0.04)).clone();
    const chest = this.b.bones.chest.getWorldPosition(new THREE.Vector3()).lerp(this.b.bones.hips.getWorldPosition(_v2), 0.4);
    return [{ c: head, r: 0.37 * s, head: true }, { c: chest, r: 0.3 * s, head: false }];
  }
  center() { return this.b.bones.chest.getWorldPosition(new THREE.Vector3()); }

  /* ---------- getting hurt ---------- */
  hurt(dmg, dir, point, kind = 'hit', from = null) {
    if (this.removed) return;
    if (from) this.lastHitBy = from;
    if (point && G.blood) G.blood.spray(point, dir || up, clamp(dmg / 12, 2, 14), kind === 'punch' ? 0.6 : 1);
    if (!this.alive) { if (dir && this.state !== 'tumble' && dmg > 25) this.tumble(dir.clone().multiplyScalar(3)); return; }
    this.hp -= dmg;
    if (this.hp <= 0) { this.die(dir); return; }
    if (this.frozen) return;
    if (this.brave) { this.angry = 14; } else { this.scared = 7; }
    if (this.state === 'tumble' || this.state === 'held' || this.state === 'down') return;
    if (dir && (dmg >= 32 || kind === 'blast')) { this.tumble(dir.clone().multiplyScalar(2.2 + dmg / 18).add(_v.set(0, 1.5, 0))); return; }
    if (dir) this.knock.copy(dir).setY(0).normalize().multiplyScalar(clamp(dmg / 9, 0.6, 3));
    this.setState('hurt');
    this.b.play(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', { loop: false, restart: true, fade: 0.06 });
    this.timer = 0.55;
  }
  die(dir) {
    this.alive = false; this.hp = 0; emit('personDied', this);
    if (this.state === 'tumble' || this.state === 'held' || this.frozen) return; // lands dead
    if (dir && Math.random() < 0.35) { this.tumble(dir.clone().multiplyScalar(3).add(_v.set(0, 1.2, 0))); return; }
    this.setState('dead');
    this.b.play(Math.random() < 0.5 ? 'Death_A' : 'Death_B', { loop: false, restart: true, fade: 0.1 });
    this.poolAt = G.t + 1.2;
  }

  /* ---------- rag doll-ish: the whole body becomes one physics body ---------- */
  tumble(vel, spin = true) {
    if (this.frozen || this.removed) return;
    if (this.held) return;
    const b = this.body;
    if (this.state !== 'tumble') {
      this.setState('tumble');
      const c = this.root.localToWorld(_v.set(0, COM, 0));
      b.position.set(c.x, c.y, c.z); b.quaternion.set(this.root.quaternion.x, this.root.quaternion.y, this.root.quaternion.z, this.root.quaternion.w);
      b.type = CANNON.Body.DYNAMIC; b.updateMassProperties(); b.velocity.setZero(); b.angularVelocity.setZero();
      b.collisionFilterMask = GROUP.ROOM | GROUP.PROP | GROUP.PERSON | GROUP.HAND;
      this.b.play('Jump_Idle', { fade: 0.1 });
    }
    if (vel) { b.velocity.set(vel.x, vel.y, vel.z); if (spin) b.angularVelocity.set(rand(-3, 3), rand(-2, 2), rand(-3, 3)); }
    b.wakeUp(); this.still = 0;
  }
  push(dir, k) { // explosions, black hole, punches on a flying body
    if (this.frozen || this.removed || this.held) return;
    if (this.state !== 'tumble') this.tumble(null);
    this.body.applyImpulse(new CANNON.Vec3(dir.x * k, dir.y * k, dir.z * k));
  }
  standFromBody() {
    // body lies still: put the root back upright where the body is, then lie / get up
    const b = this.body; b.type = CANNON.Body.KINEMATIC; b.velocity.setZero(); b.angularVelocity.setZero();
    b.collisionFilterMask = GROUP.ROOM | GROUP.PROP | GROUP.HAND;
    const fwd = _v.set(0, 0, 1).applyQuaternion(toQ(b.quaternion, _q)); fwd.y = 0;
    this.yaw = fwd.lengthSq() > 1e-4 ? Math.atan2(fwd.x, fwd.z) : this.yaw;
    this.root.position.set(b.position.x, 0, b.position.z);
    collideCircle(this.root.position, 0.3);
    this.root.quaternion.setFromAxisAngle(up, this.yaw);
    if (this.alive) { this.setState('down'); this.b.play('Lie_Idle', { fade: 0.25 }); this.timer = rand(0.8, 1.6); }
    else { this.setState('dead'); this.b.play(Math.random() < 0.5 ? 'Death_A_Pose' : 'Death_B_Pose', { fade: 0.25 }); this.poolAt = G.t + 0.3; }
  }

  /* ---------- gadgets ---------- */
  freeze(sec = 8) {
    if (!this.frozen) {
      this.saved = { v: this.body.velocity.clone(), w: this.body.angularVelocity.clone() };
      if (this.state === 'tumble') { this.body.type = CANNON.Body.KINEMATIC; this.body.velocity.setZero(); this.body.angularVelocity.setZero(); if (this.root.position.y > 0.6) unlock('freeze'); }
    }
    this.frozen = sec; tint(this.root, 0x9fd8ff, 0.4);
  }
  unfreeze() {
    if (!this.frozen) return; this.frozen = 0; tint(this.root, 0, 0);
    if (this.state === 'tumble') { this.body.type = CANNON.Body.DYNAMIC; this.body.updateMassProperties(); if (this.saved) { this.body.velocity.copy(this.saved.v); this.body.angularVelocity.copy(this.saved.w); } this.body.wakeUp(); }
    audio.play('unfreeze', this.pos, 0.6);
  }
  setSize(s) { this.size = s; this.root.scale.setScalar(s); this.setShape(s); }
  setFloat(on) {
    this.floating = on;
    if (on) { this.tumble(new THREE.Vector3(0, 1.2, 0)); this.body.linearDamping = 0.5; this.body.angularDamping = 0.6; unlock('float'); }
    else { this.body.linearDamping = 0.08; this.body.angularDamping = 0.3; this.body.wakeUp(); }
  }
  grab(hand) {
    if (this.frozen) this.unfreeze();
    this.held = hand; this.setState('held');
    this.body.type = CANNON.Body.KINEMATIC; this.body.velocity.setZero(); this.body.angularVelocity.setZero();
    this.body.collisionFilterMask = GROUP.ROOM | GROUP.PROP;
    this.b.play('Jump_Idle', { fade: 0.1 });
    if (this.brave && this.alive) this.angry = 14; else this.scared = 8;
  }
  holdAt(pos, quat, vel) { // pos/quat = where the body center goes
    this.body.position.set(pos.x, pos.y, pos.z); this.body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    if (vel) this.body.velocity.set(vel.x, vel.y, vel.z);
    this.bodyToRoot();
  }
  release(vel, ang) {
    this.held = null; this.state = 'idle';
    this.tumble(vel, false);
    if (ang) this.body.angularVelocity.set(ang.x, ang.y, ang.z);
    if (vel && vel.length() > 4) unlock('throw');
  }
  bodyToRoot() {
    const b = this.body;
    toQ(b.interpolatedQuaternion && b.type === CANNON.Body.DYNAMIC ? b.interpolatedQuaternion : b.quaternion, this.root.quaternion);
    const p = b.type === CANNON.Body.DYNAMIC ? b.interpolatedPosition : b.position;
    this.root.position.set(p.x, p.y, p.z).add(_v.set(0, -COM * this.size, 0).applyQuaternion(this.root.quaternion));
  }
  setState(s) { this.state = s; }

  /* ---------- brain ---------- */
  update(dt) {
    if (this.removed) return;
    this.hitCool = Math.max(0, this.hitCool - dt);
    if (this.frozen) {
      this.frozen -= dt;
      if (this.frozen <= 0) { this.frozen = 0.0001; this.unfreeze(); }
      if (this.state === 'tumble') this.bodyToRoot();
      return; // time stopped: no animation, no thinking
    }
    this.b.mixer.update(dt);
    const p = this.root.position, s = this.size;
    this.angry = Math.max(0, this.angry - dt); this.scared = Math.max(0, this.scared - dt);
    const player = G.player ? G.player.headPos : null;
    let speed = 0, face = null;

    switch (this.state) {
      case 'idle':
        this.timer -= dt;
        if (this.alive && this.angry > 0 && player) { this.setState('fight'); break; }
        if (this.alive && this.scared > 0) { this.setState('flee'); break; }
        this.b.play('Idle');
        if (this.timer <= 0) { this.newGoal(); this.setState('walk'); }
        break;
      case 'walk': {
        this.b.play('Walking_A', { speed: 1 / Math.sqrt(s) });
        speed = 1.0 * s; _v.subVectors(this.goal, p).setY(0);
        if (_v.length() < 0.3 || (this.timer -= dt) < -8) { this.setState('idle'); this.timer = rand(1.5, 5); }
        face = _v;
        if (this.angry > 0) this.setState('fight'); else if (this.scared > 0) this.setState('flee');
        break;
      }
      case 'flee': {
        this.b.play('Running_A', { speed: 1 / Math.sqrt(s) });
        speed = 3.0 * s;
        if (player) { _v.subVectors(p, player).setY(0); if (_v.lengthSq() < 0.01) _v.set(1, 0, 0); }
        // run along walls instead of into them
        const ahead = _v2.copy(p).addScaledVector(_v.clone().normalize(), 1.0);
        if (Math.abs(ahead.x) > ROOM.W / 2 - 0.5 || Math.abs(ahead.z) > ROOM.D / 2 - 0.5) _v.set(-_v.z, 0, _v.x);
        face = _v;
        if (this.scared <= 0) { this.setState('idle'); this.timer = rand(1, 3); }
        break;
      }
      case 'fight': {
        if (!player || this.angry <= 0) { this.setState('idle'); this.timer = 2; break; }
        _v.subVectors(player, p).setY(0); const d = _v.length(); face = _v;
        if (d > 1.05 * Math.max(1, s)) { this.b.play('Running_A', { speed: 1 / Math.sqrt(s) }); speed = 2.6 * s; }
        else { this.setState('attack'); this.b.play(ATTACK[this.type], { loop: false, restart: true, fade: 0.08 }); this.timer = 0; this.struck = false; audio.play('swing', p, 0.5); }
        break;
      }
      case 'attack': {
        this.timer += dt;
        if (player) { face = _v.subVectors(player, p).setY(0); }
        if (!this.struck && this.timer > 0.42) {
          this.struck = true;
          if (player && _v.subVectors(player, p).setY(0).length() < 1.35 * Math.max(1, s)) emit('playerHit', this, _v.normalize());
        }
        if (this.timer > 1.0) this.setState('fight');
        break;
      }
      case 'hurt':
        this.timer -= dt; this.knock.multiplyScalar(Math.exp(-6 * dt)); p.addScaledVector(this.knock, dt);
        if (this.timer <= 0) this.setState(this.angry > 0 ? 'fight' : this.scared > 0 ? 'flee' : 'idle');
        break;
      case 'tumble': {
        const b = this.body;
        if (this.floating) { /* forces come from gadgets.js every physics step */ }
        this.bodyToRoot();
        const v = b.velocity.length() + b.angularVelocity.length() * 0.3;
        if (!this.floating && v < 0.35 && b.position.y < 0.75 * s) this.still += dt; else this.still = 0;
        if (this.still > 0.45) this.standFromBody();
        break;
      }
      case 'down':
        this.timer -= dt;
        if (this.timer <= 0 && this.alive) { this.setState('getup'); this.b.play('Lie_StandUp', { loop: false, restart: true, fade: 0.2 }); this.timer = 2.2; }
        break;
      case 'getup':
        this.timer -= dt; if (this.timer <= 0) { this.setState(this.angry > 0 ? 'fight' : this.scared > 0 ? 'flee' : 'idle'); this.timer = 1; }
        break;
      case 'dead':
        if (this.poolAt && G.t > this.poolAt) { this.poolAt = 0; if (G.blood) G.blood.pool(this.center(), 0.5 * s); }
        break;
      case 'held':
        break;
    }

    if (speed > 0 || this.state === 'hurt') {
      if (face && face.lengthSq() > 1e-4) {
        const want = Math.atan2(face.x, face.z); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * Math.min(1, dt * 8);
        if (speed > 0) { const f = _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); p.addScaledVector(f, speed * dt * Math.max(0, Math.cos(d))); }
      }
      // keep out of walls, furniture and each other
      collideCircle(p, 0.3 * s);
      for (const o of G.people.list) {
        if (o === this || o.removed || o.state === 'tumble') continue;
        _v.subVectors(p, o.pos).setY(0); const d = _v.length(), min = 0.55 * (s + o.size) / 2;
        if (d < min && d > 1e-4) p.addScaledVector(_v, (min - d) / d * 0.5);
      }
      // and out of your way
      if (player) { _v.subVectors(p, player).setY(0); const d = _v.length(), min = 0.45 * s + 0.25; if (d < min && d > 1e-4) p.addScaledVector(_v, (min - d) / d); }
      this.root.quaternion.setFromAxisAngle(up, this.yaw);
    } else if (face && face.lengthSq() > 1e-4 && this.state === 'attack') {
      this.yaw = damp(this.yaw, Math.atan2(face.x, face.z), 10, dt); this.root.quaternion.setFromAxisAngle(up, this.yaw);
    }
    if (this.state !== 'tumble' && this.state !== 'held') {
      p.y = 0;
      // the kinematic body walks along (so people shove chairs out of the way)
      const b = this.body, c = this.root.localToWorld(_v.set(0, COM, 0));
      b.velocity.set((c.x - b.position.x) / Math.max(dt, 1e-3), 0, (c.z - b.position.z) / Math.max(dt, 1e-3));
      b.position.set(c.x, c.y, c.z); b.quaternion.set(this.root.quaternion.x, this.root.quaternion.y, this.root.quaternion.z, this.root.quaternion.w);
      if (this.state === 'dead' || this.state === 'down') { b.position.y = 0.2; b.velocity.setZero(); }
    }
  }
  newGoal() {
    for (let i = 0; i < 10; i++) {
      this.goal.set(rand(-ROOM.W / 2 + 0.6, ROOM.W / 2 - 0.6), 0, rand(-ROOM.D / 2 + 0.6, ROOM.D / 2 - 0.6));
      const t = this.goal.clone(); if (!collideCircle(t, 0.35)) break;
    }
    this.timer = 0;
  }
  snapshot() {
    return { present: !this.removed, p: this.root.position.clone(), yaw: this.yaw, hp: this.hp, alive: this.alive, size: this.size };
  }
  restore(s) {
    if (this.held) return;
    if (this.frozen) { this.frozen = 0; tint(this.root, 0, 0); }
    if (!s.present) { this.detach(); return; }
    this.attach(); this.root.visible = true; this.eating = 0;
    this.hp = s.hp; this.alive = s.alive; this.angry = 0; this.scared = 0; this.floating = false;
    if (this.size !== s.size) this.setSize(s.size);
    this.body.type = CANNON.Body.KINEMATIC; this.body.velocity.setZero(); this.body.angularVelocity.setZero();
    this.body.linearDamping = 0.08; this.body.angularDamping = 0.3;
    this.body.collisionFilterMask = GROUP.ROOM | GROUP.PROP | GROUP.HAND;
    this.root.position.copy(s.p); this.yaw = s.yaw; this.root.quaternion.setFromAxisAngle(up, s.yaw);
    if (this.alive) { this.setState('idle'); this.timer = rand(0.5, 2); this.b.play('Idle', { fade: 0 }); }
    else { this.setState('dead'); this.b.play('Death_A_Pose', { fade: 0 }); }
  }
}

export const people = {
  list: [],
  spawn(type, pos, yaw) {
    if (type === 'random') type = pick(TYPES);
    const p = new Person(type, pos, yaw);
    this.list.push(p);
    return p;
  },
  remove(p) { p.detach(); this.list = this.list.filter((x) => x !== p); },
  clear() { for (const p of this.list.slice()) if (!p.held) this.remove(p); },
  update(dt) { for (const p of this.list) p.update(dt); },
  clone(p) {
    const q = p.pos.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)));
    collideCircle(q, 0.35);
    const c = this.spawn(p.type, q, p.yaw + Math.PI);
    if (p.size !== 1) c.setSize(p.size);
    if (!p.alive) { c.alive = false; c.hp = 0; c.setState('dead'); c.b.play('Death_A_Pose', { fade: 0 }); }
    return c;
  }
};
