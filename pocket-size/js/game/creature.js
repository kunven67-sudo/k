// Base class + shared building blocks for every creature (dog, bugs, viruses, microbes).
import * as THREE from 'three';
import { makeBody } from '../core/physics.js';
import { sfx } from '../core/audio.js';
import { G } from './state.js';

export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Creature {
  constructor({ name = 'creature', hp = 20, radius = 1, height = 1, speed = 5, damage = 10, deathCause = 'bugs', flying = false, xp = 1 } = {}) {
    this.name = name;
    this.maxHp = hp; this.hp = hp;
    this.group = new THREE.Group();
    this.body = makeBody(radius, height);
    this.body.stepHeight = Math.max(0.5, height * 0.4);
    this.speed = speed;
    this.dmg = damage;
    this.deathCause = deathCause;
    this.flying = flying;
    this.dead = false;
    this.yaw = Math.random() * Math.PI * 2;
    this.attackCd = 0;
    this.hitFlash = 0;
    this.state = 'idle';
    this.stateT = 0;
    this.home = new THREE.Vector3();
    this.target = null;
    this.loot = [];
    this.xp = xp;
    this.aggroRange = 30;
    this.leashRange = 90;
    this.attackRange = radius + 1.2;
    this.wanderT = 0;
    this.flashMats = [];
    this.isBoss = false;
    this.removeOnDeath = true;
    this.deathT = 0;
  }

  place(x, y, z) {
    this.body.pos.set(x, y, z);
    this.home.set(x, y, z);
    this.group.position.set(x, y, z);
    return this;
  }

  // Collect materials whose emissive we flash red on hit.
  registerFlash(root = this.group) {
    root.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive && !this.flashMats.includes(o.material)) {
        o.material = o.material.clone();
        o.material.userData.baseEmissive = o.material.emissive.clone();
        this.flashMats.push(o.material);
      }
    });
  }

  hit(dmg, from) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.hitFlash = 1;
    if (from) {
      const dx = this.body.pos.x - from.x, dz = this.body.pos.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      const k = this.knockback ?? 6;
      this.body.vel.x += (dx / d) * k; this.body.vel.z += (dz / d) * k;
      if (!this.flying) this.body.vel.y += k * 0.4;
    }
    this.onHurt && this.onHurt(dmg);
    if (this.hp <= 0) { this.die(); return true; }
    this.aggro = true;
    return false;
  }

  // Eaten or vacuumed up: gone, but not counted as your kill.
  vanish(into) {
    if (this.dead) return;
    this.dead = true; this.state = 'dead'; this.deathT = 0; this.vanishInto = into;
    if (this.buzz) { this.buzz.stop(); this.buzz = null; }
    if (this.whine) { this.whine.stop(); this.whine = null; }
  }

  die() {
    this.dead = true;
    this.state = 'dead';
    sfx('squish', { pos: this.body.pos });
    G.stats.kills++;
    this.onDeath && this.onDeath();
  }

  distTo(p) { return Math.hypot(p.x - this.body.pos.x, p.z - this.body.pos.z); }
  dist3(p) { return this.body.pos.distanceTo(p); }

  // Walk/fly toward a point with a limited turn rate. Returns distance.
  steer(dt, tx, tz, speed, turnRate = 6, ty = null) {
    const dx = tx - this.body.pos.x, dz = tz - this.body.pos.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    this.yaw += Math.max(-turnRate * dt, Math.min(turnRate * dt, angDiff(this.yaw, want)));
    const s = d > 0.3 ? speed : 0;
    this.body.vel.x = damp(this.body.vel.x, Math.sin(this.yaw) * s, 6, dt);
    this.body.vel.z = damp(this.body.vel.z, Math.cos(this.yaw) * s, 6, dt);
    if (this.flying && ty !== null) this.body.vel.y = damp(this.body.vel.y, Math.max(-speed, Math.min(speed, (ty - this.body.pos.y) * 2)), 4, dt);
    return d;
  }

  physics(dt, world) {
    if (!this.flying) this.body.vel.y = Math.max(-world.terminal, this.body.vel.y - world.gravity * dt);
    else { this.body.vel.y *= Math.exp(-2 * dt); }
    world.move(this.body, dt);
    if (this.flying && world.groundFn) {
      const g = world.groundFn(this.body.pos.x, this.body.pos.z);
      if (this.body.pos.y < g + 0.5) this.body.pos.y = g + 0.5;
    }
  }

  sync(dt) {
    this.group.position.copy(this.body.pos);
    this.group.rotation.y = this.yaw;
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
      for (const m of this.flashMats) m.emissive.copy(m.userData.baseEmissive).lerp(new THREE.Color(0xff2a1a), this.hitFlash * 0.8);
    }
  }

  // Default brawler AI: wander near home, chase the player when close, bite on contact.
  brain(dt, level, player) {
    const pp = player.body.pos;
    const d = this.distTo(pp);
    const dy = Math.abs(pp.y - this.body.pos.y);
    const playerOk = player.mode !== 'dead' && !G.flags.invisible;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.stateT += dt;
    if (this.state === 'idle' || this.state === 'wander') {
      if (!this.passive && playerOk && (d < this.aggroRange || this.aggro) && dy < 12) { this.state = 'chase'; this.stateT = 0; this.onAggro && this.onAggro(); }
      else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 4; this.wanderTo = new THREE.Vector3(this.home.x + (Math.random() - 0.5) * 30, this.home.y, this.home.z + (Math.random() - 0.5) * 30); }
        if (this.wanderTo) this.steer(dt, this.wanderTo.x, this.wanderTo.z, this.speed * 0.35, 3, this.flying ? this.home.y + Math.sin(G.time + this.home.x) * 2 : null);
      }
    } else if (this.state === 'chase') {
      const fromHome = this.distTo(this.home);
      if (!playerOk || (fromHome > this.leashRange && d > 10)) { this.state = 'wander'; this.aggro = false; return; }
      this.steer(dt, pp.x, pp.z, this.speed, 5, this.flying ? pp.y + 1.2 : null);
      if (d < this.attackRange && dy < 3 && this.attackCd <= 0) {
        this.attackCd = this.attackDelay ?? 1.1;
        this.onAttack && this.onAttack();
        const dir = new THREE.Vector3(pp.x - this.body.pos.x, 0, pp.z - this.body.pos.z).normalize();
        player.damage(this.dmg, this.deathCause, { x: dir.x * 5, y: 3, z: dir.z * 5 });
      }
    }
  }

  update(dt, level, player) {
    if (this.dead && this.vanishInto) {
      this.deathT += dt;
      this.group.position.lerp(this.vanishInto(), 1 - Math.exp(-12 * dt));
      this.group.scale.multiplyScalar(Math.exp(-dt * 7));
      return this.deathT < 0.6;
    }
    if (this.dead) {
      this.deathT += dt;
      this.group.rotation.z = damp(this.group.rotation.z, Math.PI, 6, dt);
      this.group.position.y = damp(this.group.position.y, this.body.pos.y + 0.3, 6, dt);
      if (this.deathT > 1.5) this.group.scale.multiplyScalar(Math.exp(-dt * 3));
      return this.deathT < 3;
    }
    if (!G.aiPaused && player) this.brain(dt, level, player);
    else { this.body.vel.x *= 0.9; this.body.vel.z *= 0.9; }
    this.physics(dt, level.world);
    // Bugs are a few pixels across from far away: skip drawing and animating them there.
    let visible = true;
    if (this.isBug && G.camera) {
      const far = this.cullDist ?? 120 + 150 * this.body.radius;
      visible = G.camera.position.distanceToSquared(this.body.pos) < far * far;
      this.group.visible = visible;
    }
    if (visible && this.animate) this.animate(dt);
    this.sync(dt);
    return true;
  }
}
