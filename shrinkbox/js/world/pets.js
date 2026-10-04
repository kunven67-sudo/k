// Pets you buy on your phone. Each acts like the real animal:
//  🐱 cat   - naps, grooms, follows you... and HUNTS tiny-you (stalk, butt-wiggle, pounce)
//  🐶 dog   - follows you, sniffs tiny-you, licks (you get slimy), barks at knocks
//  🐹 hamster - in a wire cage you can squeeze into; runs on its wheel at NIGHT (nocturnal)
//  🐟 goldfish - in a real glass tank; tiny swimmers look like food to it
//  🦎 gecko - terrarium with a heat lamp; hunts tiny moving things (it eats insects)
//  🐜 ant farm - real ants walking their tunnels between two sheets of glass
// Stand on a pet when you're tiny and it carries you around (you can't steer it).
import * as THREE from 'three';
import { R, world, groups, G } from '../core/physics.js';
import { Mover } from '../player/mover.js';
import { Thing, panel, grille, tubeWall } from './thing.js';
import { colorMat, defMat } from '../core/materials.js';
import { sfx, loop, vol3d } from '../core/audio.js';

const M = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

function quadruped(o) {
  // a simple but believable four-legged animal; o = { L, H, color, belly, ear, tail, snout }
  const g = new THREE.Group(), fur = M(o.color, 0.95), belly = M(o.belly ?? o.color, 0.95);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(o.H * 0.28, o.L * 0.55, 6, 14), fur); body.rotation.x = Math.PI / 2; body.position.y = o.H * 0.62; g.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(o.H * 0.27, 14, 10), belly); chest.position.set(0, o.H * 0.58, o.L * 0.28); g.add(chest);
  const head = new THREE.Group(); head.position.set(0, o.H * 0.92, o.L * 0.48); g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(o.H * 0.24, 16, 12), fur));
  const snout = new THREE.Mesh(new THREE.SphereGeometry(o.H * (o.snout ?? 0.12), 12, 8), belly); snout.scale.z = o.snoutLen ?? 1.2; snout.position.set(0, -o.H * 0.06, o.H * 0.2); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(o.H * 0.035, 8, 6), M(0x2a1a1a, 0.4)); nose.position.set(0, -o.H * 0.03, o.H * (0.2 + 0.12 * (o.snoutLen ?? 1.2))); head.add(nose);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(o.H * 0.04, 10, 8), new THREE.MeshStandardMaterial({ color: o.eye ?? 0x8fbf3a, roughness: 0.1, emissive: o.eye ?? 0x8fbf3a, emissiveIntensity: 0.15 }));
    eye.position.set(sx * o.H * 0.1, o.H * 0.05, o.H * 0.19); head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(o.H * 0.022, 8, 6), M(0x050505, 0.1)); pupil.scale.x = o.slit ? 0.35 : 1; pupil.position.set(sx * o.H * 0.1, o.H * 0.05, o.H * 0.225); head.add(pupil);
    const ear = o.floppy ? new THREE.Mesh(new THREE.CapsuleGeometry(o.H * 0.07, o.H * 0.22, 4, 8), fur) : new THREE.Mesh(new THREE.ConeGeometry(o.H * 0.09, o.H * 0.2, 8), fur);
    if (o.floppy) { ear.position.set(sx * o.H * 0.22, -o.H * 0.08, 0); ear.rotation.z = sx * 0.2; } else { ear.position.set(sx * o.H * 0.13, o.H * 0.22, -o.H * 0.02); ear.rotation.z = -sx * 0.25; }
    head.add(ear);
  }
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const hip = new THREE.Group(); hip.position.set(sx * o.H * 0.18, o.H * 0.58, sz * o.L * 0.32); g.add(hip);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(o.H * 0.07, o.H * 0.06, o.H * 0.32, 8).translate(0, -o.H * 0.16, 0), fur); hip.add(up);
    const knee = new THREE.Group(); knee.position.y = -o.H * 0.32; hip.add(knee);
    const low = new THREE.Mesh(new THREE.CylinderGeometry(o.H * 0.05, o.H * 0.045, o.H * 0.28, 8).translate(0, -o.H * 0.14, 0), fur); knee.add(low);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(o.H * 0.06, 8, 6), belly); paw.scale.set(1, 0.6, 1.3); paw.position.set(0, -o.H * 0.28, o.H * 0.02); knee.add(paw);
    legs.push({ hip, knee, phase: (sx * sz > 0 ? 0 : Math.PI) });
  }
  const tail = [];
  let parent = g, base = new THREE.Vector3(0, o.H * 0.7, -o.L * 0.55);
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group(); seg.position.copy(i ? new THREE.Vector3(0, 0, -o.tail / 6) : base); parent.add(seg);
    seg.add(new THREE.Mesh(new THREE.CylinderGeometry(o.H * 0.045 * (1 - i * 0.1), o.H * 0.05 * (1 - i * 0.1), o.tail / 6, 8).rotateX(Math.PI / 2).translate(0, 0, -o.tail / 12), fur));
    tail.push(seg); parent = seg;
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { g, head, legs, tail, body };
}

class Animal {
  constructor(game, kind, pos, opts) {
    this.game = game; this.kind = kind; this.o = opts;
    this.feet = new THREE.Vector3(...pos); this.yaw = Math.random() * 6.28; this.vel = new THREE.Vector3();
    this.m = quadruped(opts); game.engine.scene.add(this.m.g);
    this.state = 'idle'; this.t = 0; this.stateT = 0; this.walk = 0; this.grounded = false;
    const h = opts.H, r = opts.L * 0.35;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos[0], pos[1] + h * 0.55, pos[2]));
    // the back of the animal is solid - tiny-you can stand on it and ride
    this.collider = world.createCollider(R.ColliderDesc.capsule(opts.L * 0.3, h * 0.3).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))).setCollisionGroups(groups(G.CREATURE, G.PLAYER | G.PROP)), this.body);
    this.collider.animal = this;
    this.probe = world.createCollider(R.ColliderDesc.ball(0.01).setSensor(true), this.body);
    this.mover = new Mover(this.probe, groups(G.CREATURE, G.WORLD | G.PROP));
    this.r = r;
  }
  goTo(target, speed, dt) {
    const d = target.clone().sub(this.feet); d.y = 0;
    const len = d.length();
    if (len < this.o.L * 0.4) return true;
    const want = Math.atan2(d.x, d.z); this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 4);
    this.speed = speed;
    return false;
  }
  move(dt) {
    const v = this.speed || 0;
    this.vel.x = Math.sin(this.yaw) * v; this.vel.z = Math.cos(this.yaw) * v;
    this.vel.y = this.grounded ? 0 : this.vel.y - 9.81 * dt;
    const res = this.mover.move(this.feet, this.vel.clone().multiplyScalar(dt), { r: this.r, h: this.o.H, grounded: this.grounded, snap: this.grounded, stepH: this.o.H * 0.4, maxSlopeCos: 0.6 });
    this.grounded = res.grounded;
    if (this.feet.y < -8) this.feet.set(-0.5, 0.05, 0.5);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
    this.body.setNextKinematicTranslation({ x: this.feet.x, y: this.feet.y + this.o.H * (this.state === 'sleep' ? 0.25 : 0.55), z: this.feet.z });
    this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    this.m.g.position.copy(this.feet); this.m.g.rotation.y = this.yaw;
    // legs + tail
    this.walk += dt * v / this.o.H * 4;
    const sw = Math.min(1, v / (this.o.H * 1.5));
    for (const l of this.m.legs) { l.hip.rotation.x = Math.sin(this.walk + l.phase) * 0.6 * sw; l.knee.rotation.x = Math.max(0, Math.sin(this.walk + l.phase + 1)) * 0.6 * sw; }
    this.m.tail.forEach((s, i) => { s.rotation.y = Math.sin(this.game.time * (this.state === 'stalk' ? 9 : 2) + i * 0.6) * (this.state === 'stalk' ? 0.25 : 0.12); s.rotation.x = -0.25 + (this.kind === 'dog' && v > 0 ? Math.sin(this.game.time * 14) * 0.2 : 0); });
    this.m.body.position.y = this.o.H * 0.62 * (this.state === 'sleep' ? 0.45 : this.state === 'stalk' ? 0.75 : 1);
  }
}

export class Cat extends Animal {
  constructor(game, pos) { super(game, 'cat', pos, { L: 0.46, H: 0.26, color: 0x8a6a4a, belly: 0xe8dcc8, tail: 0.3, snout: 0.09, snoutLen: 1, slit: true }); this.name = 'your cat'; }
  update(dt) {
    const g = this.game, p = g.player; this.t += dt; this.stateT -= dt; this.speed = 0;
    if (g.elsewhere) { this.move(dt); return; }
    const pf = p.feet, d = pf.distanceTo(this.feet), tiny = p.height < 0.04;
    if (tiny && d < 4 && Math.abs(pf.y - this.feet.y) < 1.2 && this.state !== 'sleep') {
      // the hunting sequence real cats do
      if (this.state !== 'stalk' && this.state !== 'pounce') { this.state = 'stalk'; this.stateT = 2 + Math.random() * 2; if (!this._tip) { this._tip = 1; g.ui.toast('🐱 Your cat spotted something tiny... YOU. RUN!', 4); } }
      if (this.state === 'stalk') { this.goTo(pf, 0.15, dt); if (this.stateT <= 0 && d < 1.0) { this.state = 'pounce'; this.stateT = 0.5; sfx.thud(0.3, 1.5); } }
      if (this.state === 'pounce') {
        this.goTo(pf, 3.2, dt);
        if (d < 0.18 && g.time > (this._hitCd || 0)) { this._hitCd = g.time + 1.5; p.hurt(18, 'cat'); p.vel.add(new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).multiplyScalar(2 * p.s)); p.shake = 1; }
        if (this.stateT <= 0) { this.state = 'stalk'; this.stateT = 1.5 + Math.random() * 2; }
      }
    } else {
      if (this.state === 'stalk' || this.state === 'pounce') this.state = 'idle';
      const h = new Date().getHours();
      if (this.stateT <= 0) {
        this.stateT = 4 + Math.random() * 10;
        const r = Math.random();
        this.state = (h > 11 && h < 16 && r < 0.5) || r < 0.2 ? 'sleep' : r < 0.6 ? 'wander' : p.height > 1 && d < 6 ? 'follow' : 'idle';
        this.target = this.feet.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
      }
      if (this.state === 'wander' && this.target) this.goTo(this.target, 0.4, dt);
      if (this.state === 'follow' && d > 1.2) this.goTo(pf, 0.7, dt);
    }
    this.move(dt);
    if (!this.purr) this.purr = loop('rumble');
    this.purr.set(this.petT > 0 ? vol3d(d, 0.4, p.s) * 0.6 : 0, 1.5);
    this.petT = Math.max(0, (this.petT || 0) - dt);
  }
}
export class Dog extends Animal {
  constructor(game, pos) { super(game, 'dog', pos, { L: 0.62, H: 0.4, color: 0x8a5a2f, belly: 0xf0e8dc, tail: 0.25, snout: 0.13, snoutLen: 1.8, floppy: true, eye: 0x3b2414 }); this.name = 'your dog'; }
  update(dt) {
    const g = this.game, p = g.player; this.t += dt; this.stateT -= dt; this.speed = 0;
    if (g.elsewhere) { this.move(dt); return; }
    const pf = p.feet, d = pf.distanceTo(this.feet), tiny = p.height < 0.1;
    if (tiny && d < 3 && Math.abs(pf.y - this.feet.y) < 0.8) {
      this.state = 'sniff';
      if (this.goTo(pf, 0.4, dt) || d < 0.35) {
        this.speed = 0;
        if (g.time > (this._lick || 0)) { this._lick = g.time + 3; p.sticky = Math.min(0.8, p.sticky + 0.4); p.vel.add(new THREE.Vector3(Math.sin(this.yaw), 0.3, Math.cos(this.yaw)).multiplyScalar(1.5 * p.s)); sfx.splash(0.2); if (!this._tip) { this._tip = 1; g.ui.toast('🐶 SLURP! Your dog licked you. You\'re covered in dog slime.', 4); } }
      }
    } else {
      if (this.stateT <= 0) { this.stateT = 3 + Math.random() * 8; this.state = p.height > 1 && Math.random() < 0.6 ? 'follow' : Math.random() < 0.4 ? 'sleep' : 'wander'; this.target = this.feet.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4)); }
      if (this.state === 'follow' && d > 1.3) this.goTo(pf, 1.2, dt);
      if (this.state === 'wander' && this.target) this.goTo(this.target, 0.6, dt);
    }
    if (g.economy && g.economy._lastKnock !== this._heard && g.economy._lastKnock) { this._heard = g.economy._lastKnock; for (let i = 0; i < 3; i++) setTimeout(() => sfx.thud(0.6, 3), i * 300); }
    this.move(dt);
  }
}

// ---------- habitats ----------
function hamsterCage(game, pos) {
  const c = new Thing({ name: 'Hamster cage', pos, surface: 'plastic' });
  const W2 = 0.6, D = 0.4, H = 0.35, wire = colorMat(0xe0e0e0, 0.3, 0.8);
  c.box([W2, 0.08, D], [0, 0.04, 0], colorMat(0x3a8fd6, 0.4)); // plastic base tray
  c.box([W2 - 0.02, 0.02, D - 0.02], [0, 0.07, 0], colorMat(0xe8d9b0, 1)); // wood-shaving bedding
  // wire walls: real gaps (~1.2 cm) between bars
  for (const [axis, at, rect] of [['z', D / 2, [-W2 / 2, 0.08, W2 / 2, H]], ['z', -D / 2, [-W2 / 2, 0.08, W2 / 2, H]], ['x', W2 / 2, [-D / 2, 0.08, D / 2, H]], ['x', -W2 / 2, [-D / 2, 0.08, D / 2, H]]]) grille(c, { axis, at, rect, bar: 0.002, gap: 0.011, thick: 0.002, m: wire, cross: false });
  grille(c, { axis: 'y', at: H, rect: [-W2 / 2, -D / 2, W2 / 2, D / 2], bar: 0.002, gap: 0.011, thick: 0.002, m: wire });
  c.box([0.12, 0.08, 0.1], [-0.18, 0.12, -0.1], colorMat(0xf2a33a, 0.5)); // little house
  c.cyl(0.02, 0.12, [0.25, 0.22, 0.17], colorMat(0xd0f0ff, 0.1)); // water bottle
  c.build(game.engine.scene);
  // the wheel: a real ring you can run inside when tiny
  const wheel = new Thing({ name: 'Hamster wheel', type: 'kinematic', pos: [pos[0] + 0.12, pos[1] + 0.2, pos[2]], surface: 'plastic' });
  tubeWall(wheel, { r: 0.1, h: 0.06, thick: 0.004, y: 0, seg: 28, m: colorMat(0xd62f7c, 0.4) });
  wheel.build(game.engine.scene);
  wheel.group.rotation.x = Math.PI / 2;
  return { cage: c, wheel };
}
class Hamster {
  constructor(game, pos) {
    this.game = game; this.kind = 'hamster';
    this.hab = hamsterCage(game, pos);
    this.base = new THREE.Vector3(...pos);
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), M(0xd9a46a, 1)); b.scale.set(1, 0.8, 1.3); b.position.y = 0.035; g.add(b);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), M(0xf6ead8, 1)); belly.position.set(0, 0.025, 0.02); g.add(belly);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), M(0x050505, 0.1)); e.position.set(sx * 0.018, 0.05, 0.045); g.add(e); const ear = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), M(0xe8a0a0, 0.8)); ear.position.set(sx * 0.02, 0.065, 0.02); g.add(ear); }
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    game.engine.scene.add(g); this.g = g;
    this.pos = this.base.clone().add(new THREE.Vector3(-0.1, 0.08, 0.05)); this.t = 0;
  }
  update(dt) {
    const h = new Date().getHours(), night = h >= 20 || h < 6;
    this.t += dt;
    const w = this.hab.wheel;
    if (night) {
      // running on the wheel (realistic: hamsters run several km a night)
      this.g.position.set(this.base.x + 0.12, this.base.y + 0.1 + 0.005 * Math.abs(Math.sin(this.t * 20)), this.base.z);
      w.spin = (w.spin || 0) + dt * 6;
    } else {
      this.g.position.set(this.base.x - 0.18, this.base.y + 0.08, this.base.z - 0.02); // asleep in its house
      w.spin = (w.spin || 0) * 0.98;
    }
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, w.spin)));
    w.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }
}
class Goldfish {
  constructor(game, pos) {
    this.game = game; this.kind = 'fish'; this.base = new THREE.Vector3(...pos);
    const tank = new Thing({ name: 'Fish tank', pos, surface: 'glass' });
    const W2 = 0.5, D = 0.26, H = 0.3, T = 0.005, glass = defMat('tankGlass', () => new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, roughness: 0.02, transmission: 0.9, thickness: 0.005, transparent: true, opacity: 0.3 }));
    tank.box([W2, T * 2, D], [0, T, 0], colorMat(0x111111, 0.5));
    tank.box([W2, H, T], [0, H / 2, D / 2], glass); tank.box([W2, H, T], [0, H / 2, -D / 2], glass); tank.box([T, H, D], [W2 / 2, H / 2, 0], glass); tank.box([T, H, D], [-W2 / 2, H / 2, 0], glass);
    tank.box([W2 - 0.01, 0.03, D - 0.01], [0, 0.025, 0], colorMat(0x6a8fb0, 1)); // gravel
    for (let i = 0; i < 4; i++) tank.box([0.008, 0.12 + i * 0.03, 0.02], [-0.15 + i * 0.03, 0.1, -0.06], colorMat(0x2f8a3a, 0.7), { collide: false, rot: [0, i, 0.1 * i] });
    tank.build(game.engine.scene);
    const water = new THREE.Mesh(new THREE.BoxGeometry(W2 - 0.012, 0.24, D - 0.012), defMat('tankWater', () => new THREE.MeshPhysicalMaterial({ color: 0x9fd0e8, roughness: 0.05, transmission: 0.7, thickness: 0.2, transparent: true, opacity: 0.35, depthWrite: false })));
    water.position.set(pos[0], pos[1] + 0.155, pos[2]); game.engine.scene.add(water);
    this.waterBox = new THREE.Box3(new THREE.Vector3(pos[0] - W2 / 2, pos[1] + 0.04, pos[2] - D / 2), new THREE.Vector3(pos[0] + W2 / 2, pos[1] + 0.275, pos[2] + D / 2));
    const f = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), M(0xf28a1a, 0.4)); b.scale.set(0.7, 1, 1.6); f.add(b);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.035, 8), M(0xf5a54a, 0.4)); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.04; f.add(tail); this.tail = tail;
    game.engine.scene.add(f); this.f = f; this.t = Math.random() * 10;
  }
  update(dt) {
    const g = this.game, p = g.player; this.t += dt;
    const c = this.waterBox.getCenter(new THREE.Vector3()), s = this.waterBox.getSize(new THREE.Vector3());
    let target = new THREE.Vector3(c.x + Math.sin(this.t * 0.4) * s.x * 0.38, c.y + Math.sin(this.t * 0.7) * s.y * 0.3, c.z + Math.cos(this.t * 0.3) * s.z * 0.3);
    const inTank = !g.elsewhere && this.waterBox.containsPoint(p.feet);
    if (inTank) {
      p.inLiquid = { swimMul: p.height < 0.01 ? 0.3 : 0.6, drag: 3, sink: 0.1, name: 'water' };
      if (p.height < 0.012) { target = p.center(new THREE.Vector3()); if (!this._tip) { this._tip = 1; g.ui.toast('🐟 The goldfish thinks you\'re food!', 3); } if (this.f.position.distanceTo(target) < 0.025 && g.time > (this._cd || 0)) { this._cd = g.time + 1.2; p.hurt(20, 'goldfish'); } }
    }
    const d = target.clone().sub(this.f.position);
    if (d.length() > 0.001) { this.f.position.addScaledVector(d.normalize(), Math.min(d.length(), dt * (inTank ? 0.12 : 0.05))); this.f.lookAt(this.f.position.clone().add(d)); }
    this.tail.rotation.y = Math.sin(this.t * 12) * 0.5;
  }
}
class Gecko {
  constructor(game, pos) {
    this.game = game; this.kind = 'lizard'; this.base = new THREE.Vector3(...pos);
    const tr = new Thing({ name: 'Terrarium', pos, surface: 'glass' });
    const W2 = 0.6, D = 0.4, H = 0.4, T = 0.005, glass = defMat('tankGlass');
    tr.box([W2, 0.01, D], [0, 0.005, 0], colorMat(0x222222, 0.6)); tr.box([W2 - 0.01, 0.03, D - 0.01], [0, 0.025, 0], colorMat(0xd9b77a, 1));
    tr.box([W2, H, T], [0, H / 2, D / 2], glass); tr.box([W2, H, T], [0, H / 2, -D / 2], glass); tr.box([T, H, D], [W2 / 2, H / 2, 0], glass); tr.box([T, H, D], [-W2 / 2, H / 2, 0], glass);
    grille(tr, { axis: 'y', at: H, rect: [-W2 / 2, -D / 2, W2 / 2, D / 2], bar: 0.001, gap: 0.002, thick: 0.001, m: colorMat(0x333333, 0.5) }); // mesh lid
    tr.box([0.15, 0.06, 0.12], [-0.15, 0.07, 0.05], colorMat(0x7a6a5a, 0.95)); // rock
    tr.cyl(0.06, 0.08, [0.2, H + 0.04, 0], colorMat(0x222222, 0.5)); // heat lamp
    tr.build(game.engine.scene);
    this.lampPos = new THREE.Vector3(pos[0] + 0.2, pos[1] + H, pos[2]);
    game.lightPool.add({ kind: 'point', color: 0xffa860, intensity: 0.6, distance: 0.6, decay: 2, pos: this.lampPos.clone().setY(this.lampPos.y - 0.05) });
    const g = new THREE.Group(), skin = M(0xe8c45a, 0.6), spots = M(0x3a2a1a, 0.6);
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 10), skin); b.rotation.x = Math.PI / 2; b.position.y = 0.02; g.add(b);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), skin); head.scale.set(1, 0.7, 1.3); head.position.set(0, 0.025, 0.065); g.add(head);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.1, 8), skin); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.02, -0.1); g.add(tail);
    for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), spots); sp.position.set((i % 2 - 0.5) * 0.015, 0.037, -0.03 + i * 0.012); g.add(sp); }
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), skin); l.rotation.z = sx * 1.2; l.position.set(sx * 0.022, 0.012, sz * 0.03); g.add(l); }
    game.engine.scene.add(g); this.g = g; this.t = 0; this.pos = this.base.clone().add(new THREE.Vector3(0, 0.04, 0)); this.yaw = 0;
  }
  update(dt) {
    const g = this.game, p = g.player; this.t += dt;
    const inside = !g.elsewhere && Math.abs(p.feet.x - this.base.x) < 0.3 && Math.abs(p.feet.z - this.base.z) < 0.2 && p.feet.y > this.base.y && p.feet.y < this.base.y + 0.4;
    let target = this.lampPos.clone().setY(this.base.y + 0.04); // basking under the heat lamp
    if (inside && p.height < 0.02 && p.vel.lengthSq() > (0.1 * p.s) ** 2) { target = p.feet.clone(); if (!this._tip) { this._tip = 1; g.ui.toast('🦎 Geckos hunt anything small that MOVES. Freeze!', 3); } }
    const d = target.clone().sub(this.pos); d.y = 0;
    if (d.length() > 0.02) { this.yaw = Math.atan2(d.x, d.z); this.pos.addScaledVector(d.normalize(), dt * (inside ? 0.25 : 0.03)); }
    if (inside && p.height < 0.02 && this.pos.distanceTo(p.feet) < 0.04 && g.time > (this._cd || 0)) { this._cd = g.time + 2; p.hurt(25, 'gecko'); }
    this.g.position.copy(this.pos); this.g.rotation.y = this.yaw;
  }
}
class AntFarm {
  constructor(game, pos) {
    this.game = game; this.kind = 'antfarm';
    const f = new Thing({ name: 'Ant farm', pos, surface: 'glass' });
    const W2 = 0.3, H = 0.22, gap = 0.008;
    f.box([W2 + 0.02, 0.02, 0.05], [0, 0.01, 0], colorMat(0x2a7a3a, 0.5));
    f.box([W2, H, 0.003], [0, 0.02 + H / 2, gap / 2 + 0.0015], defMat('tankGlass')); f.box([W2, H, 0.003], [0, 0.02 + H / 2, -gap / 2 - 0.0015], defMat('tankGlass'));
    f.box([0.01, H, gap + 0.006], [W2 / 2, 0.02 + H / 2, 0], colorMat(0x2a7a3a, 0.5)); f.box([0.01, H, gap + 0.006], [-W2 / 2, 0.02 + H / 2, 0], colorMat(0x2a7a3a, 0.5));
    // sand with real tunnels dug through it (holes in the sand you can walk along when tiny)
    const tunnels = [[-0.12, 0.05, -0.02, 0.065], [-0.03, 0.065, -0.015, 0.16], [-0.02, 0.14, 0.11, 0.155], [0.06, 0.08, 0.075, 0.15], [0.02, 0.08, 0.13, 0.095], [-0.12, 0.065, -0.105, 0.17], [-0.105, 0.17, 0.0, 0.185]];
    panel(f, { axis: 'z', at: 0, rect: [-W2 / 2 + 0.005, 0.02, W2 / 2 - 0.005, 0.02 + H * 0.85], holes: tunnels, thick: gap, m: colorMat(0xc9a66b, 1) });
    f.build(game.engine.scene);
    this.paths = tunnels.map(([x0, y0, x1, y1]) => [new THREE.Vector3(pos[0] + x0, pos[1] + y0 + 0.002, pos[2]), new THREE.Vector3(pos[0] + x1, pos[1] + (x1 - x0 > y1 - y0 ? y0 : y1) + 0.002, pos[2])]);
    this.ants = [];
    const antM = M(0x1a0d06, 0.4);
    for (let i = 0; i < 14; i++) {
      const a = new THREE.Group();
      for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.0007 + (k === 2 ? 0.0004 : 0), 6, 4), antM); s.position.z = (k - 1) * 0.0012; a.add(s); }
      game.engine.scene.add(a); this.ants.push({ a, path: i % this.paths.length, t: Math.random(), dir: Math.random() < 0.5 ? 1 : -1 });
    }
  }
  update(dt) {
    for (const ant of this.ants) {
      ant.t += dt * 0.08 * ant.dir;
      if (ant.t > 1 || ant.t < 0) { ant.dir *= -1; ant.t = Math.max(0, Math.min(1, ant.t)); if (Math.random() < 0.3) ant.path = Math.floor(Math.random() * this.paths.length); }
      const [a, b] = this.paths[ant.path];
      ant.a.position.lerpVectors(a, b, ant.t); ant.a.lookAt(ant.dir > 0 ? b : a);
    }
  }
}

export class Pets {
  constructor(game) { this.game = game; this.list = []; }
  adopt(kind, at) {
    const g = this.game;
    const pos = [at.x, at.y + 0.02, at.z];
    const habitatSpot = (dx) => [-1.2 + dx, 0.0, 1.25]; // free floor space in your room by the window
    let pet;
    if (kind === 'cat') pet = new Cat(g, pos);
    else if (kind === 'dog') pet = new Dog(g, pos);
    else if (kind === 'hamster') pet = new Hamster(g, habitatSpot(0));
    else if (kind === 'fish') pet = new Goldfish(g, habitatSpot(0.6));
    else if (kind === 'lizard') pet = new Gecko(g, habitatSpot(-0.5));
    else if (kind === 'antfarm') pet = new AntFarm(g, [-1.5, 0.755, 0.0]);
    if (!pet) return null;
    pet.kind = kind; this.list.push(pet);
    if (pet instanceof Cat || pet instanceof Dog) g.interactables.push({ name: `Pet ${pet.name}`, pos: pet.feet, radius: 0.35, use: () => { pet.petT = 4; g.ui.toast(kind === 'cat' ? '🐱 Purrrr... ❤️' : '🐶 *happy tail wagging* ❤️', 2); } });
    return pet;
  }
  update(dt) { for (const p of this.list) p.update(dt); }
}
void sfx;
