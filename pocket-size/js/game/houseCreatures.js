// Biscuit the (enormous) golden retriever, the robot vacuum and the thing under the fridge.
import * as THREE from 'three';
import * as TX from '../core/textures.js';
import { Creature, damp, angDiff, hexapod, glossy } from './creature.js';
import { sfx, loop } from '../core/audio.js';
import { ui } from '../core/ui.js';
import { G } from './state.js';

function furShells(geo, baseMat, count, spacing, parent, transform) {
  // Shell-texturing: stacked, slightly inflated copies with an alpha-tested strand pattern.
  const tex = TX.drawn('furStrands', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = Math.random();
      ctx.fillStyle = `rgb(${v * 255},${v * 255},${v * 255})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  }, false);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  const shells = [];
  for (let i = 1; i <= count; i++) {
    const k = i / count;
    const m = new THREE.MeshStandardMaterial({
      color: baseMat.color.clone().multiplyScalar(0.85 + k * 0.3), alphaMap: tex, alphaTest: 0.15 + k * 0.75,
      roughness: 0.9, transparent: false, side: THREE.FrontSide,
    });
    const s = new THREE.Mesh(geo, m);
    transform(s);
    s.scale.multiplyScalar(1 + spacing * i);
    s.castShadow = false; s.receiveShadow = true;
    parent.add(s);
    shells.push(s);
  }
  return shells;
}

export class Dog extends Creature {
  constructor(opts = {}) {
    super({ name: 'Biscuit', hp: 9999, radius: 18, height: 60, speed: 17, damage: 999, deathCause: 'dog' });
    this.body.stepHeight = 8;
    this.state = 'sleep';
    this.alert = 0;
    this.pose = 0;         // 0 lying, 1 standing
    this.gait = 0;
    this.bedPos = new THREE.Vector3();
    this.lastSeen = null;
    this.snore = null;
    this.furQuality = opts.fur ?? 8;
    this.invulnerable = true;
    this.build();
  }

  build() {
    const fur = TX.fur({ color: 0xdca25c, dark: 0xb07434 });
    const mat = new THREE.MeshPhysicalMaterial({ ...fur, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffd79a), sheenRoughness: 0.45 });
    mat.map.repeat.set(3, 3); mat.normalMap.repeat.set(3, 3); mat.roughnessMap.repeat.set(3, 3);
    this.mat = mat;
    const dark = new THREE.MeshPhysicalMaterial({ color: 0x1a1210, roughness: 0.3, clearcoat: 1 });
    const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x1c0f08, roughness: 0.05, clearcoat: 1 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xc86a6a, roughness: 0.5 });
    const g = this.group;
    const rig = this.rig = {};
    rig.body = new THREE.Group(); g.add(rig.body);
    // Torso: chest + belly + rump
    const torsoG = new THREE.CapsuleGeometry(15, 42, 12, 24);
    const torso = new THREE.Mesh(torsoG, mat); torso.rotation.x = Math.PI / 2; torso.scale.set(1, 1, 1.05); torso.castShadow = true; torso.receiveShadow = true;
    rig.body.add(torso); rig.torso = torso;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(17, 24, 18), mat); chest.position.set(0, 2, 22); chest.castShadow = true; rig.body.add(chest);
    const rump = new THREE.Mesh(new THREE.SphereGeometry(15.5, 24, 18), mat); rump.position.set(0, 1, -22); rump.castShadow = true; rig.body.add(rump);
    if (this.furQuality > 0) {
      furShells(torsoG, mat, this.furQuality, 0.012, rig.body, (s) => { s.rotation.x = Math.PI / 2; });
      const cg = new THREE.SphereGeometry(17, 24, 18);
      furShells(cg, mat, Math.ceil(this.furQuality / 2), 0.015, rig.body, (s) => { s.position.set(0, 2, 22); });
    }
    // Neck + head
    rig.neck = new THREE.Group(); rig.neck.position.set(0, 10, 32); rig.body.add(rig.neck);
    const neckM = new THREE.Mesh(new THREE.CapsuleGeometry(10, 16, 8, 16), mat); neckM.position.set(0, 8, 4); neckM.rotation.x = 0.6; neckM.castShadow = true; rig.neck.add(neckM);
    rig.head = new THREE.Group(); rig.head.position.set(0, 18, 12); rig.neck.add(rig.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(11.5, 24, 18), mat); skull.scale.set(1, 0.95, 1.1); skull.castShadow = true; rig.head.add(skull);
    const snout = new THREE.Mesh(new THREE.CapsuleGeometry(6, 10, 8, 16), mat); snout.rotation.x = Math.PI / 2 - 0.1; snout.position.set(0, -3.5, 12); snout.castShadow = true; rig.head.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 10), dark); nose.scale.set(1.2, 0.85, 1); nose.position.set(0, -2.2, 20.5); rig.head.add(nose);
    rig.jaw = new THREE.Group(); rig.jaw.position.set(0, -7, 6); rig.head.add(rig.jaw);
    const jawM = new THREE.Mesh(new THREE.CapsuleGeometry(4.2, 9, 6, 12), mat); jawM.rotation.x = Math.PI / 2; jawM.position.set(0, 0, 7); rig.jaw.add(jawM);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8), pink); tongue.scale.set(1, 0.35, 1.8); tongue.position.set(0, 1.5, 8); rig.jaw.add(tongue);
    rig.eyes = [];
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(1.9, 14, 10), eyeM); e.position.set(5.2 * s, 3.2, 8.5); rig.head.add(e); rig.eyes.push(e);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(2.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); lid.position.copy(e.position); lid.rotation.x = -0.2; rig.head.add(lid);
      e.userData.lid = lid;
      const ear = new THREE.Group(); ear.position.set(9 * s, 6, -1); ear.rotation.z = 0.35 * s; rig.head.add(ear);
      const earM = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), mat); earM.scale.set(0.35, 1.25, 0.9); earM.position.set(1.5 * s, -8, 0); earM.castShadow = true; ear.add(earM);
      rig['ear' + (s > 0 ? 'R' : 'L')] = ear;
    });
    // Legs: [x, z, isFront]
    rig.legs = [];
    [[-9, 22, 1], [9, 22, 1], [-9, -22, 0], [9, -22, 0]].forEach(([x, z, front]) => {
      const hip = new THREE.Group(); hip.position.set(x, -4, z); rig.body.add(hip);
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(front ? 5.5 : 7, 14, 6, 12), mat); up.position.y = -9; up.castShadow = true; hip.add(up);
      const knee = new THREE.Group(); knee.position.y = -19; hip.add(knee);
      const low = new THREE.Mesh(new THREE.CapsuleGeometry(4, 14, 6, 12), mat); low.position.y = -8; low.castShadow = true; knee.add(low);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10), mat); paw.scale.set(1, 0.6, 1.3); paw.position.set(0, -17, 1.5); paw.castShadow = true; knee.add(paw);
      rig.legs.push({ hip, knee, front, side: Math.sign(x) });
    });
    // Tail: 4 segments
    rig.tail = [];
    let parent = rig.body;
    let pos = new THREE.Vector3(0, 6, -35);
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Group(); seg.position.copy(pos); parent.add(seg);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(3.5 - i * 0.5, 8, 6, 10), mat); m.position.set(0, 0, -5); m.rotation.x = Math.PI / 2; m.castShadow = true; seg.add(m);
      rig.tail.push(seg);
      parent = seg; pos = new THREE.Vector3(0, 0, -10);
    }
    // collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(10.5, 1.3, 8, 24), new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.6 }));
    collar.position.set(0, 7, 3); collar.rotation.x = 0.9; rig.neck.add(collar);
    const tag = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xffd45a, metalness: 1, roughness: 0.3 }));
    tag.position.set(0, -2, 13); tag.rotation.x = 1.3; rig.neck.add(tag);
    this.registerFlash();
  }

  placeOnBed(x, z, yaw) {
    this.place(x, 0, z);
    this.bedPos.set(x, 0, z);
    this.bedYaw = yaw;
    this.yaw = yaw;
    this.group.position.set(x, 0, z);
  }

  hear(amount, pos) {
    if (this.state !== 'sleep' && this.state !== 'settle') return;
    const d = this.distTo(pos);
    const falloff = Math.max(0, 1 - d / 320);
    this.alert += amount * falloff;
  }

  wake() {
    if (this.state !== 'sleep' && this.state !== 'settle') return;
    this.state = 'waking'; this.stateT = 0;
    if (this.snore) this.snore.setVolume(0, 0.3);
    sfx('growl', { pos: this.body.pos, ref: 80 });
    ui.toast('🐕 <b>Biscuit</b> woke up! <b>Hide under furniture or get out of sight!</b>', 4000);
    G.flags.dogWoke = true;
    G.music && G.music('danger');
  }

  update(dt, level, player) {
    if (G.aiPaused || !player) {
      if (this.state !== 'sleep' && G.mode !== 'dead') { /* frozen mid-action during cutscenes */ }
      this.physics(dt, level.world);
      this.animate(dt, player);
      this.sync(dt);
      if (this.snore) this.snore.setPos(this.headPos());
      if (!this.snore && level.audioReady) this.snore = loop('snore', { pos: this.body.pos, ref: 60, vol: 0.9 });
      return true;
    }
    const pp = player.body.pos;
    const t = G.time;
    const d = this.distTo(pp);
    this.stateT += dt;
    const covered = level.isCovered ? level.isCovered(pp) : false;
    const canSee = player.mode !== 'dead' && !covered && d < 520 && level.lineOfSight(this.headPos(), pp.clone().add(new THREE.Vector3(0, 1, 0)));
    if (!this.snore && level.audioReady) this.snore = loop('snore', { pos: this.body.pos, ref: 60, vol: 0.9 });
    if (this.snore) this.snore.setPos(this.headPos());

    switch (this.state) {
      case 'sleep': case 'settle': {
        this.pose = damp(this.pose, 0, 2, dt);
        this.alert = Math.max(0, this.alert - dt * 0.04);
        if (player.mode === 'walk' && !G.flags.dogPeace) {
          const moving = Math.hypot(player.body.vel.x, player.body.vel.z) > 1;
          if (d < 55) this.alert += dt * 0.45;
          if (moving && d < 170) this.alert += dt * (player.sprinting ? 0.32 : player.crouching ? 0.015 : 0.07) * (1 - d / 170);
        }
        if (this.snore) this.snore.setVolume(0.9, 1);
        if (this.alert >= 1) this.wake();
        break;
      }
      case 'waking':
        this.pose = damp(this.pose, 1, 3, dt);
        this.faceToward(dt, pp, 2);
        if (this.stateT > 1.8) { this.state = canSee ? 'chase' : 'search'; this.stateT = 0; this.lastSeen = pp.clone(); if (canSee) sfx('bark', { pos: this.body.pos, count: 3, ref: 120 }); }
        break;
      case 'chase': {
        this.pose = 1;
        if (canSee) { this.lastSeen = pp.clone(); this.lostT = 0; } else this.lostT = (this.lostT || 0) + dt;
        const tgt = this.lastSeen;
        const dist = this.steer(dt, tgt.x, tgt.z, this.speed, 2.0);
        const head = this.headPos();
        const hd = Math.hypot(head.x - pp.x, head.z - pp.z);
        if (canSee && hd < 14 && pp.y < 30) { this.state = 'bite'; this.stateT = 0; sfx('chomp', { pos: head, ref: 100 }); player.die('dog'); }
        if (this.lostT > 1.2 && dist < 20) { this.state = 'search'; this.stateT = 0; }
        if (Math.random() < dt * 0.4) sfx('bark', { pos: head, count: 1 + (Math.random() * 2 | 0), ref: 120 });
        break;
      }
      case 'bite':
        this.body.vel.x = damp(this.body.vel.x, 0, 8, dt); this.body.vel.z = damp(this.body.vel.z, 0, 8, dt);
        break;
      case 'search':
        this.pose = 1;
        if (canSee && d < 260) { this.state = 'chase'; this.stateT = 0; sfx('bark', { pos: this.body.pos, count: 2, ref: 120 }); break; }
        if (this.lastSeen) this.steer(dt, this.lastSeen.x + Math.sin(t * 1.3) * 30, this.lastSeen.z + Math.cos(t * 1.1) * 30, 5, 2.5);
        if (Math.random() < dt * 0.5) sfx('hiss', { pos: this.headPos(), vol: 0.3, ref: 40 }); // sniff
        if (this.stateT > 7) { this.state = 'return'; this.stateT = 0; }
        break;
      case 'return': {
        this.pose = 1;
        if (canSee && d < 200) { this.state = 'chase'; this.stateT = 0; break; }
        const dist = this.steer(dt, this.bedPos.x, this.bedPos.z, 7, 2.5);
        if (dist < 8) {
          this.state = 'settle'; this.stateT = 0; this.alert = 0.25;
          this.body.vel.set(0, 0, 0);
          G.music && G.music(G.level && G.level.music);
        }
        break;
      }
      default: break;
    }
    if (this.state === 'settle' || this.state === 'sleep') {
      this.yaw += angDiff(this.yaw, this.bedYaw) * (1 - Math.exp(-2 * dt));
      this.body.vel.x = damp(this.body.vel.x, 0, 5, dt); this.body.vel.z = damp(this.body.vel.z, 0, 5, dt);
      if (this.state === 'settle' && this.stateT > 3) this.state = 'sleep';
    }
    this.physics(dt, level.world);
    this.animate(dt, player);
    this.sync(dt);
    return true;
  }

  faceToward(dt, p, rate) {
    const want = Math.atan2(p.x - this.body.pos.x, p.z - this.body.pos.z);
    this.yaw += Math.max(-rate * dt, Math.min(rate * dt, angDiff(this.yaw, want)));
  }

  headPos() {
    const f = 48;
    return new THREE.Vector3(this.body.pos.x + Math.sin(this.yaw) * f, this.body.pos.y + (this.pose > 0.5 ? 58 : 18), this.body.pos.z + Math.cos(this.yaw) * f);
  }

  animate(dt, player) {
    const r = this.rig;
    const t = G.time;
    const p = this.pose;
    const speed = Math.hypot(this.body.vel.x, this.body.vel.z);
    this.gait += dt * (2 + speed * 0.55);
    const breathe = Math.sin(t * (p < 0.5 ? 1.4 : 3.2));
    // lying: body low, legs folded; standing: body up, legs straight
    r.body.position.y = 16 + p * 30 + (speed > 1 ? Math.abs(Math.sin(this.gait)) * 3 : 0);
    r.body.rotation.z = (1 - p) * 0.25;
    r.torso.scale.set(1 + breathe * 0.03, 1, 1.05 + breathe * 0.02);
    const run = Math.min(1, speed / 12);
    r.legs.forEach((L, i) => {
      const phase = this.gait + (L.front ? 0 : Math.PI * 0.9) + (L.side > 0 ? Math.PI * (run > 0.6 ? 0.15 : 1) : 0);
      const swing = speed > 1 ? Math.sin(phase) * (0.5 + run * 0.5) : 0;
      const lieHip = L.front ? -1.35 : 1.25;
      L.hip.rotation.x = damp(L.hip.rotation.x, (1 - p) * lieHip + p * swing, 10, dt);
      const kneeT = (1 - p) * (L.front ? 0.2 : -2.4) + p * (speed > 1 ? Math.max(0, Math.cos(phase)) * (L.front ? 0.9 : -0.9) : 0);
      L.knee.rotation.x = damp(L.knee.rotation.x, kneeT, 10, dt);
      L.hip.rotation.z = (1 - p) * L.side * 0.15;
    });
    // head: resting on paws when asleep, alert & tracking the player when awake
    const sleeping = this.state === 'sleep' || this.state === 'settle';
    let nx = sleeping ? 1.1 : -0.1 + Math.sin(this.gait) * 0.08 * run;
    let hy = 0;
    if (!sleeping && player) {
      const hp = this.headPos();
      const want = Math.atan2(player.body.pos.x - hp.x, player.body.pos.z - hp.z);
      hy = Math.max(-0.8, Math.min(0.8, angDiff(this.yaw, want)));
      nx += (player.body.pos.y < 10 ? 0.35 : 0);
    }
    r.neck.rotation.x = damp(r.neck.rotation.x, nx, 5, dt);
    r.neck.rotation.y = damp(r.neck.rotation.y, hy, 5, dt);
    const biting = this.state === 'bite' || (this.state === 'chase' && this.distTo(player.body.pos) < 60);
    r.jaw.rotation.x = damp(r.jaw.rotation.x, biting ? 0.6 + Math.sin(t * 20) * 0.2 : (sleeping ? 0.02 : 0.15 + breathe * 0.05), 12, dt);
    // eyes/lids
    r.eyes.forEach((e) => { e.userData.lid.scale.y = damp(e.userData.lid.scale.y, sleeping ? 1.0 : 0.2, 6, dt); e.userData.lid.rotation.x = sleeping ? 0.9 : -0.9; });
    // ears twitch while asleep
    const tw = sleeping && Math.sin(t * 0.7) > 0.97 ? Math.sin(t * 40) * 0.3 : 0;
    r.earL.rotation.x = tw; r.earR.rotation.x = -tw * 0.5;
    // tail: wags when awake (menacing), gentle thump when asleep
    r.tail.forEach((s, i) => {
      s.rotation.y = sleeping ? Math.sin(t * 0.8 + i) * 0.1 + 0.5 : Math.sin(t * 9 + i * 0.6) * 0.35;
      s.rotation.x = sleeping ? 0.15 : -0.35 + i * 0.12;
    });
  }
}

export class Vacuum extends Creature {
  constructor(bounds) {
    super({ name: 'SuckBot 3000', hp: 9999, radius: 17, height: 9, speed: 11, damage: 999, deathCause: 'vacuum' });
    this.body.stepHeight = 1;
    this.bounds = bounds;
    this.invulnerable = true;
    this.active = false;
    this.turnT = 0;
    this.targetYaw = 0;
    const body = new THREE.MeshPhysicalMaterial({ color: 0x1e1f22, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
    const silver = new THREE.MeshStandardMaterial({ color: 0x9ba0a8, metalness: 1, roughness: 0.3 });
    const g = this.group;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 7.5, 48), body); disc.position.y = 4.7; disc.castShadow = true; disc.receiveShadow = true; g.add(disc);
    const bumper = new THREE.Mesh(new THREE.CylinderGeometry(17.3, 17.3, 3, 48, 1, true, -Math.PI / 2, Math.PI), silver); bumper.position.y = 3.5; g.add(bumper);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.6, 32), silver); top.position.y = 8.6; g.add(top);
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshStandardMaterial({ color: 0x33ff66, emissive: 0x33ff66, emissiveIntensity: 3 }));
    this.led.position.set(0, 9, 8); g.add(this.led);
    this.brushes = [];
    [-1, 1].forEach((s) => {
      const b = new THREE.Group(); b.position.set(12 * s, 1, 11); g.add(b);
      for (let i = 0; i < 3; i++) { const bristle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 7), new THREE.MeshStandardMaterial({ color: 0x333333 })); bristle.rotation.y = (i * Math.PI * 2) / 3; bristle.position.z = 0; b.add(bristle); }
      this.brushes.push(b);
    });
    this.hum = null;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.hum = loop('vacuum', { pos: this.body.pos, ref: 40, vol: 0.8 });
    ui.toast('🤖 <b>SuckBot 3000</b>: "Starting scheduled cleaning." Stay out of its way.', 4500);
  }

  update(dt, level, player) {
    if (!this.active || G.aiPaused || !player) { this.sync(dt); return true; }
    this.turnT -= dt;
    if (this.body.hitWall || this.turnT < -8 || this.outOfBounds()) {
      if (this.turnT <= 0) {
        this.targetYaw = this.yaw + Math.PI * (0.6 + Math.random() * 0.8);
        if (this.outOfBounds()) this.targetYaw = Math.atan2(this.bounds.cx - this.body.pos.x, this.bounds.cz - this.body.pos.z);
        this.turnT = 1.2;
      }
    }
    if (this.turnT > 0) {
      this.yaw += angDiff(this.yaw, this.targetYaw) * (1 - Math.exp(-3 * dt));
      this.body.vel.x = damp(this.body.vel.x, 0, 6, dt); this.body.vel.z = damp(this.body.vel.z, 0, 6, dt);
    } else {
      this.body.vel.x = Math.sin(this.yaw) * this.speed; this.body.vel.z = Math.cos(this.yaw) * this.speed;
    }
    this.physics(dt, level.world);
    this.brushes.forEach((b, i) => { b.rotation.y += dt * 14 * (i ? 1 : -1); });
    this.led.material.emissiveIntensity = 2 + Math.sin(G.time * 4) * 1.5;
    if (this.hum) this.hum.setPos(this.body.pos);
    const pp = player.body.pos;
    if (player.mode !== 'dead' && this.distTo(pp) < 17.5 && pp.y < 9.5 && pp.y >= this.body.pos.y - 1) {
      player.die('vacuum');
      sfx('whoosh', { dur: 0.8 });
    }
    // Scare the player when close.
    if (this.distTo(pp) < 60 && Math.random() < dt * 0.3) player.shake += 0.15;
    this.sync(dt);
    return true;
  }

  outOfBounds() {
    const b = this.bounds, p = this.body.pos;
    return p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1;
  }

  dispose() { if (this.hum) this.hum.stop(); }
}

export class Cockroach extends Creature {
  constructor() {
    super({ name: 'Cockroach', hp: 45, radius: 1.5, height: 1.2, speed: 16, damage: 14, deathCause: 'roach' });
    this.aggroRange = 70;
    this.leashRange = 240;
    this.attackRange = 2.6;
    this.attackDelay = 0.9;
    this.knockback = 2;
    this.body.stepHeight = 0.6;
    const m = glossy(0x5a2c14, 0.3);
    const dark = glossy(0x2a130a, 0.4);
    const g = this.group;
    this.bodyG = new THREE.Group(); this.bodyG.position.y = 3.2; g.add(this.bodyG);
    const ab = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 16), m); ab.scale.set(1, 0.42, 1.8); ab.position.z = -4; ab.castShadow = true; this.bodyG.add(ab);
    const th = new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 14), m); th.scale.set(1.15, 0.45, 0.9); th.position.z = 3.2; th.castShadow = true; this.bodyG.add(th);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), dark); hd.scale.set(1.1, 0.7, 0.9); hd.position.set(0, -0.3, 6.3); this.bodyG.add(hd);
    // wings
    [-1, 1].forEach((s) => {
      const w = new THREE.Mesh(new THREE.SphereGeometry(3.4, 16, 10), glossy(0x7a3a18, 0.25)); w.scale.set(0.7, 0.12, 2.1); w.position.set(1.6 * s, 1.5, -3); w.rotation.y = -0.08 * s; this.bodyG.add(w);
    });
    // antennae
    this.antennae = [];
    [-1, 1].forEach((s) => {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.6 * s, 0, 7.5), new THREE.Vector3(3 * s, 1.5, 13), new THREE.Vector3(6 * s, 1, 18), new THREE.Vector3(9 * s, -0.5, 21)]);
      const a = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.12, 5), dark);
      this.bodyG.add(a); this.antennae.push(a);
    });
    this.legAnim = hexapod(this.bodyG, dark, { spread: 6, length: 4.2, y: -0.5, z0: -2, z1: 3.5, radius: 0.35 });
    // Modelled at 3x for detail, then scaled to a (still huge) 5cm roach.
    this.bodyG.scale.setScalar(0.34);
    this.bodyG.position.y = 3.2 * 0.34;
    this.registerFlash();
  }
  animate(dt) {
    const sp = Math.hypot(this.body.vel.x, this.body.vel.z);
    this.legAnim(dt, sp * 0.25);
    this.antennae.forEach((a, i) => { a.rotation.y = Math.sin(G.time * 6 + i * 2) * 0.2; a.rotation.x = Math.sin(G.time * 4 + i) * 0.1; });
    this.bodyG.rotation.z = Math.sin(G.time * 30) * 0.02 * Math.min(1, sp / 5);
  }
  brain(dt, level, player) {
    // Scurry erratically when chasing: real roaches zig-zag.
    super.brain(dt, level, player);
    if (this.state === 'chase') this.yaw += Math.sin(G.time * 7 + this.home.x) * dt * 2;
    if (this.state === 'wander') {
      // return under the fridge
      this.steer(dt, this.home.x, this.home.z, this.speed * 0.6, 6);
    }
  }
  onAttack() { sfx('hiss', { pos: this.body.pos, vol: 0.5 }); }
}
