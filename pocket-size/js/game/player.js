// The player: tiny-person movement, third/first person camera, stamina, health, heat,
// carrying, mash-climbing, swimming (germ size) and interaction prompts.
import * as THREE from 'three';
import { CharacterRig } from './character.js';
import { makeBody } from '../core/physics.js';
import { input } from '../core/input.js';
import { ui } from '../core/ui.js';
import { sfx } from '../core/audio.js';
import { getSettings, difficultyMul } from '../core/settings.js';
import { G } from './state.js';
import { softDot } from '../core/textures.js';

const tmpV = new THREE.Vector3();
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Player {
  constructor() {
    this.rig = new CharacterRig();
    this.object = this.rig.root;
    this.body = makeBody(0.36, 1.8);
    this.maxHealth = 100;
    this.health = 100;
    this.stamina = 1;
    this.heat = 0;
    this.facing = 0;
    this.camYaw = 0;
    this.camPitch = 0.25;
    this.camDist = 4.2;
    this.camDistTarget = 4.2;
    this.camActual = 4.2;
    this.mode = 'walk';           // walk | climb | swim | locked | dead | external
    this.carry = null;
    this.climb = null;
    this.lastDamage = 99;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.stepDist = 0;
    this.hurtT = 0;
    this.invuln = 0;
    this.airTime = 0;
    this.fallStartY = 0;
    this.shake = 0;
    this.speedMul = 1;
    this.walkSpeed = 6.5;
    this.runSpeed = 13;
    this.jumpVel = 9.5;
    this.onDeath = null;
    this.interactTarget = null;
    this.holdT = 0;
    this.camTarget = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.headBob = 0;
    this.turnRate = 0;
    this.lastFacing = 0;
    this.attackCooldown = 0;
    this.firstPersonHidden = false;
    // Soft contact shadow under the feet - grounds the character everywhere.
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: softDot('#000000', 'blob'), transparent: true, opacity: 0.55, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 1;
  }

  spawn(pos, yaw = 0) {
    this.body.pos.copy(pos);
    this.body.vel.set(0, 0, 0);
    this.facing = yaw;
    this.camYaw = yaw;
    this.camPitch = 0.22;
    this.object.position.copy(pos);
    this.object.rotation.y = yaw;
    this.fallStartY = pos.y;
    this.mode = 'walk';
    this.carry = null;
    this.climb = null;
    this.camActual = this.camDist;
    this.camTarget.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
  }

  get pos() { return this.body.pos; }

  forward() { return new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)); }
  right() { return new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw)); }

  damage(amount, cause = 'fall', knock = null) {
    if (this.mode === 'dead' || this.invuln > 0 || G.flags.godMode) return;
    amount *= difficultyMul() * (G.inventory ? G.inventory.armorMul() : 1);
    this.health -= amount;
    G.stats.damageTaken += amount;
    this.lastDamage = 0;
    this.hurtT = 1;
    this.shake = Math.min(1.5, this.shake + amount / 25);
    this.invuln = 0.35;
    if (G.post) G.post.fx.damage = Math.min(1, G.post.fx.damage + amount / 40);
    sfx('hurt');
    if (knock) { this.body.vel.x += knock.x; this.body.vel.z += knock.z; this.body.vel.y += knock.y || 3; }
    if (navigator.getGamepads && getSettings().immersion5d) {
      for (const gp of navigator.getGamepads()) if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: 200, strongMagnitude: 0.8, weakMagnitude: 0.5 }).catch(() => {});
    }
    ui.health(this.health, this.maxHealth);
    if (this.health <= 0) this.die(cause);
  }

  heal(n) {
    this.health = Math.min(this.maxHealth, this.health + n);
    ui.health(this.health, this.maxHealth);
  }

  die(cause) {
    if (this.mode === 'dead') return;
    this.health = 0;
    ui.health(0, this.maxHealth);
    this.mode = 'dead';
    this.dropCarry();
    sfx('death');
    if (this.onDeath) this.onDeath(cause);
  }

  dropCarry() {
    if (!this.carry) return;
    const c = this.carry;
    this.carry = null;
    if (c.onDrop) c.onDrop(this);
  }

  startClimb(zone) {
    this.climb = { zone, progress: 0, rate: 0 };
    this.mode = 'climb';
    this.body.vel.set(0, 0, 0);
    this.facing = zone.facing;
    this.camYaw = zone.facing;
  }

  update(dt, level) {
    if (this.mode === 'external') { if (this.externalUpdate) this.externalUpdate(dt, level); return; }
    const s = getSettings();
    const b = this.body;
    const world = level.world;
    this.lastDamage += dt;
    this.hurtT = Math.max(0, this.hurtT - dt * 3);
    this.invuln = Math.max(0, this.invuln - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (G.post) G.post.fx.damage = Math.max(0, G.post.fx.damage - dt * 0.9);

    // ---- look
    const cine = G.director && G.director.active;
    const canLook = this.mode !== 'dead' && this.mode !== 'locked' && input.locked && !cine;
    if (canLook) {
      const l = input.look();
      this.camYaw -= l.x;
      this.camPitch = Math.max(-1.2, Math.min(1.35, this.camPitch + l.y));
      const w = input.wheel();
      if (w) this.camDistTarget = Math.max(1.6, Math.min(9, this.camDistTarget + w * 0.6));
    }
    if (input.wasPressed('KeyV')) {
      const { setSetting } = G.settingsApi;
      setSetting('cameraMode', s.cameraMode === 'first' ? 'third' : 'first');
    }

    let speed = 0;
    if (this.mode === 'walk') speed = this.updateWalk(dt, world, s);
    else if (this.mode === 'climb') this.updateClimb(dt, world);
    else if (this.mode === 'swim') speed = this.updateSwim(dt, world);
    else if (this.mode === 'dead' || this.mode === 'locked') {
      if (this.mode === 'locked' && this.scriptVel) {
        b.vel.x = this.scriptVel.x; b.vel.z = this.scriptVel.z;
        if (Math.abs(b.vel.x) + Math.abs(b.vel.z) > 0.01) this.facing = Math.atan2(b.vel.x, b.vel.z);
      } else { b.vel.x = damp(b.vel.x, 0, 8, dt); b.vel.z = damp(b.vel.z, 0, 8, dt); }
      if (this.mode === 'dead' || !this.lockFreeze) {
        b.vel.y = Math.max(-world.terminal, b.vel.y - world.gravity * dt);
        world.move(b, dt);
      }
      speed = Math.hypot(b.vel.x, b.vel.z);
    }

    // stamina regen
    if (!this.sprinting && this.mode !== 'climb') this.stamina = Math.min(1, this.stamina + dt * 0.28);
    ui.stamina(this.stamina);

    // passive regen
    if (this.lastDamage > 8 && this.health < this.maxHealth && this.mode !== 'dead') this.heal(dt * 1.5);

    // ---- visual body
    if (this.mode !== 'external') {
      this.object.position.copy(b.pos);
      const fd = angDiff(this.object.rotation.y, this.facing);
      this.object.rotation.y += fd * (1 - Math.exp(-12 * dt));
      this.turnRate = damp(this.turnRate, angDiff(this.lastFacing, this.object.rotation.y) / Math.max(dt, 1e-4), 8, dt);
      this.lastFacing = this.object.rotation.y;
      this.rig.update(dt, {
        speed, runSpeed: this.runSpeed, grounded: b.grounded || this.mode === 'climb', vy: b.vel.y,
        carry: !!this.carry && !this.carry.onBack, climb: this.mode === 'climb', climbRate: this.climb ? this.climb.rate : 0,
        swim: this.mode === 'swim', dead: this.mode === 'dead', crouch: this.crouching, turn: this.turnRate,
        lookPitch: this.camPitch, hurt: this.hurtT, sleep: this.sleeping,
      });
    }

    if (!cine) {
      this.updateInteraction(dt, level);
      this.updateCamera(dt, world, s);
    } else ui.prompt(null);
    this.updateBlob(level);
    if (level.onPlayerUpdate) level.onPlayerUpdate(dt, this);
  }

  updateWalk(dt, world, s) {
    const b = this.body;
    const ax = input.axis();
    const fwd = this.forward(), rgt = this.right();
    const wish = new THREE.Vector3().addScaledVector(fwd, ax.z).addScaledVector(rgt, ax.x);
    if (wish.lengthSq() > 1) wish.normalize();
    this.crouching = input.isDown('KeyC') || input.isDown('ControlLeft');
    const wantSprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const carrying = !!this.carry;
    this.sprinting = wantSprint && wish.lengthSq() > 0.01 && this.stamina > 0.02 && !this.crouching && !(carrying && !this.carry.canSprint);
    let maxSpeed = this.sprinting ? this.runSpeed : this.walkSpeed;
    if (this.crouching) maxSpeed *= 0.45;
    if (carrying) maxSpeed *= this.carry.speedMul ?? 0.75;
    maxSpeed *= this.speedMul;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - dt * 0.14);
    const accel = b.grounded ? 60 : 14;
    const tvx = wish.x * maxSpeed, tvz = wish.z * maxSpeed;
    b.vel.x = damp(b.vel.x, tvx, accel / Math.max(1, maxSpeed) * 1.3, dt);
    b.vel.z = damp(b.vel.z, tvz, accel / Math.max(1, maxSpeed) * 1.3, dt);
    if (wish.lengthSq() > 0.01) {
      this.facing = Math.atan2(wish.x, wish.z);
      if (s.cameraMode === 'first') this.facing = this.camYaw;
    }

    // jump with coyote time + input buffer
    this.coyote = b.grounded ? 0.12 : this.coyote - dt;
    this.jumpBuffer = input.wasPressed('Space') ? 0.15 : this.jumpBuffer - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0 && !(carrying && !this.carry.canJump) && this.stamina > 0.05) {
      b.vel.y = this.jumpVel * (this.crouching ? 0.8 : 1);
      this.coyote = 0; this.jumpBuffer = 0;
      this.stamina = Math.max(0, this.stamina - 0.07);
      sfx('jump', { vol: 0.6 });
    }
    b.vel.y = Math.max(-world.terminal, b.vel.y - world.gravity * dt);
    const wasGrounded = b.grounded;
    b.landSpeed = 0;
    world.move(b, dt);
    if (!b.grounded) { this.airTime += dt; if (wasGrounded) this.fallStartY = b.pos.y; }
    if (b.grounded && !wasGrounded) {
      const soft = b.groundShape && b.groundShape.soft;
      const ls = b.landSpeed;
      if (ls > 8) sfx('land', { soft, vol: Math.min(1, ls / 20) });
      const drop = this.fallStartY - b.pos.y;
      if (!soft && ls > 17 && drop > 25) {
        const dmg = (ls - 17) * 5 + Math.min(20, (drop - 25) * 0.25);
        this.damage(dmg, 'fall');
      }
      if (ls > 12) this.shake += Math.min(0.6, ls / 40);
      this.airTime = 0;
    }
    if (b.grounded) this.fallStartY = b.pos.y;
    if (b.pos.y < world.killY) this.die('fall');

    const hs = Math.hypot(b.vel.x, b.vel.z);
    if (b.grounded && hs > 0.5) {
      this.stepDist += hs * dt;
      const stride = this.sprinting ? 1.5 : 1.05;
      if (this.stepDist > stride) { this.stepDist = 0; sfx('step', { surface: b.surface, vol: this.crouching ? 0.4 : this.sprinting ? 1 : 0.75 }); }
    }
    world.updateTriggers(b, dt);
    return hs;
  }

  updateClimb(dt, world) {
    const c = this.climb;
    const z = c.zone;
    const b = this.body;
    // Mashing E pushes you up; stop and you slowly slide back down.
    const presses = input.pressCount('KeyE');
    if (presses) { c.progress += (z.perPress || 0.9) * presses; sfx('step', { surface: z.surface || 'fabric', vol: 0.8 }); this.stamina = Math.max(0, this.stamina - 0.004 * presses); }
    const rate = input.mashRate(700);
    c.rate = damp(c.rate, rate > 0 ? 1 : 0, 6, dt);
    if (rate < 1.5) c.progress = Math.max(0, c.progress - dt * (z.slide || 1.8));
    const h = z.topY - z.bottomY;
    const y = z.bottomY + Math.min(h, c.progress);
    const zz = z.zTop !== undefined ? z.z + (z.zTop - z.z) * Math.min(1, c.progress / h) : z.z;
    b.pos.set(z.x, y, zz);
    b.vel.set(0, 0, 0);
    ui.mash(c.progress / h, z.label || 'MASH E TO CLIMB');
    if (input.wasPressed('KeyQ') || input.wasPressed('Space') && c.progress < 0.5) {
      this.mode = 'walk'; this.climb = null; ui.mash(null);
      b.pos.set(z.x - Math.sin(z.facing) * 0.8, z.bottomY, z.z - Math.cos(z.facing) * 0.8);
      return;
    }
    if (c.progress >= h) {
      this.mode = 'walk'; this.climb = null; ui.mash(null);
      b.pos.copy(z.exit);
      b.vel.set(0, 0, 0);
      sfx('land', { soft: true });
      if (z.onTop) z.onTop();
    }
  }

  updateSwim(dt, world) {
    const b = this.body;
    const ax = input.axis();
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), -Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch));
    const rgt = this.right();
    const wish = new THREE.Vector3().addScaledVector(dir, ax.z).addScaledVector(rgt, ax.x);
    if (input.isDown('Space')) wish.y += 1;
    if (input.isDown('KeyC') || input.isDown('ControlLeft')) wish.y -= 1;
    if (wish.lengthSq() > 1) wish.normalize();
    const sprint = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && this.stamina > 0.02;
    this.sprinting = sprint && wish.lengthSq() > 0.01;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - dt * 0.12);
    const max = (sprint ? 11 : 6) * this.speedMul;
    b.vel.x = damp(b.vel.x, wish.x * max, 2.5, dt);
    b.vel.y = damp(b.vel.y, wish.y * max, 2.5, dt);
    b.vel.z = damp(b.vel.z, wish.z * max, 2.5, dt);
    if (wish.lengthSq() > 0.01) this.facing = Math.atan2(wish.x, wish.z);
    world.move(b, dt);
    if (world.bounds) {
      const r = world.bounds;
      const d = b.pos.length();
      if (d > r) b.pos.multiplyScalar(r / d);
    }
    world.updateTriggers(b, dt);
    return b.vel.length();
  }

  updateInteraction(dt, level) {
    if ((this.mode !== 'walk' && this.mode !== 'swim') || !level.interactables) { this.interactTarget = null; ui.prompt(null); return; }
    const p = this.body.pos;
    let best = null, bestD = Infinity;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    for (const it of level.interactables) {
      if (it.enabled === false || (it.can && !it.can())) continue;
      const ip = it.getPos ? it.getPos() : it.pos;
      const dx = ip.x - p.x, dy = ip.y - (p.y + 0.9), dz = ip.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > (it.radius || 2.5) || Math.abs(dy) > (it.height || 3)) continue;
      const facingBonus = d > 0.01 ? (dx * fwd.x + dz * fwd.z) / d : 1;
      const score = d - facingBonus * 0.6;
      if (score < bestD) { bestD = score; best = it; }
    }
    this.interactTarget = best;
    if (!best) { ui.prompt(null); this.holdT = 0; return; }
    const label = typeof best.label === 'function' ? best.label() : best.label;
    if (best.hold) {
      if (input.isDown('KeyE')) {
        this.holdT += dt;
        if (best.onHoldTick) best.onHoldTick(this.holdT / best.hold);
        ui.prompt(`<kbd>E</kbd> ${label} <span style="opacity:.7">${Math.round(Math.min(1, this.holdT / best.hold) * 100)}%</span>`);
        if (this.holdT >= best.hold) { this.holdT = 0; best.action(this); }
      } else {
        this.holdT = Math.max(0, this.holdT - dt * 2);
        ui.prompt(`Hold <kbd>E</kbd> ${label}`);
      }
    } else {
      ui.prompt(`<kbd>${best.key || 'E'}</kbd> ${label}`);
      if (input.wasPressed(best.keyCode || 'KeyE')) best.action(this);
    }
  }

  updateBlob(level) {
    const bl = this.blob;
    if (bl.parent !== level.scene) level.scene.add(bl);
    const p = this.body.pos;
    const g = this.mode === 'swim' ? -Infinity : level.world.surfaceBelow(p.x, p.y + 0.2, p.z);
    const h = p.y - g;
    bl.visible = Number.isFinite(g) && h < 6 && this.object.visible && this.object.scale.x < 2;
    if (!bl.visible) return;
    bl.position.set(p.x, g + 0.03, p.z);
    const k = Math.max(0, 1 - h / 6);
    bl.material.opacity = 0.5 * k;
    bl.scale.setScalar(1 + h * 0.15);
  }

  updateCamera(dt, world, s) {
    const cam = G.camera;
    const b = this.body;
    const first = s.cameraMode === 'first' && this.mode !== 'dead';
    const carryCam = this.carry && this.carry.camDist && !this.carry.onBack;
    this.camDist = damp(this.camDist, carryCam ? Math.max(this.camDistTarget, this.carry.camDist) : this.camDistTarget, 4, dt);
    const headY = (this.mode === 'swim' ? 0.9 : (this.crouching ? 1.05 : 1.55)) + (carryCam ? this.carry.camLift : 0);
    const target = tmpV.set(b.pos.x, b.pos.y + headY, b.pos.z);
    // smooth follow (critically damped feel) - tighter vertically when landing
    this.camTarget.x = damp(this.camTarget.x, target.x, 22, dt);
    this.camTarget.z = damp(this.camTarget.z, target.z, 22, dt);
    this.camTarget.y = damp(this.camTarget.y, target.y, b.grounded ? 14 : 30, dt);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * cp, -sp, Math.cos(this.camYaw) * cp);
    let pos;
    if (first) {
      pos = this.camTarget.clone().add(new THREE.Vector3(0, 0.12, 0)).addScaledVector(new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)), 0.2);
      this.object.visible = false;
    } else {
      this.object.visible = true;
      const shoulder = this.right().multiplyScalar(0.55 * Math.min(1, this.camDist / 3));
      const origin = this.camTarget.clone().add(shoulder);
      const back = dir.clone().negate();
      let want = this.camDist;
      const hit = world.raycast(origin, back, want + 0.3, (sh) => !sh.noCamera);
      if (hit < want + 0.3) want = Math.max(0.45, hit - 0.3);
      this.camActual = want < this.camActual ? want : damp(this.camActual, want, 5, dt);
      pos = origin.clone().addScaledVector(back, this.camActual);
      if (world.groundFn) { const g = world.groundFn(pos.x, pos.z); if (pos.y < g + 0.25) pos.y = g + 0.25; }
      if (this.camActual < 0.8) this.object.visible = this.camActual > 0.55;
    }
    // camera shake / handheld sway / head bob
    const motion = s.motionEffects;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const t = G.time;
    if (motion) {
      const sh = this.shake * (s.immersion5d ? 1.3 : 0.8);
      pos.x += (Math.sin(t * 37) + Math.sin(t * 23)) * 0.03 * sh;
      pos.y += (Math.sin(t * 41) + Math.sin(t * 29)) * 0.03 * sh;
      pos.y += Math.sin(t * 1.3) * 0.006;
      const hs = Math.hypot(b.vel.x, b.vel.z);
      if (b.grounded && hs > 1) { this.headBob += dt * hs * 1.8; pos.y += Math.sin(this.headBob) * 0.012 * Math.min(1, hs / 8) * (first ? 2.5 : 1); }
    }
    cam.position.copy(pos);
    const look = first ? pos.clone().add(dir) : this.camTarget.clone().add(this.right().multiplyScalar(0.55 * Math.min(1, this.camDist / 3))).addScaledVector(dir, 2);
    cam.lookAt(look);
    const hs = Math.hypot(b.vel.x, b.vel.z);
    const fovTarget = s.fov + (this.sprinting && hs > 8 ? 7 : 0);
    cam.fov = damp(cam.fov, fovTarget, 4, dt);
    cam.updateProjectionMatrix();
    // focus the lens on the player (macro depth of field)
    if (G.post) {
      G.post.focus = first ? 6 : Math.max(1, this.camActual + 0.3);
      G.post.aperture = first ? 0.35 : ((G.level && G.level.post && G.level.post.aperture) || 0.9);
    }
  }
}
