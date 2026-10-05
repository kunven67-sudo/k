// What you hold and use: shrink ray, catching jar (more gadgets plug in here).
// The item is placed relative to the camera (so aiming is exact), and the right
// arm is solved with IK to the item's grip, so your real hand holds it in both
// first and third person.
import * as THREE from 'three';
import { solveTwoBone } from '../engine/anim.js';
import { shrinkRayModel, jarModel, beakerModel } from './models.js';
import { pieceMesh } from '../colony/items.js';
import { GROUP, groups } from '../engine/physics.js';

const CHARGE_TIME = 1.2;   // s to full charge
const RANGE = 40;          // m
const TINY = 0.05;         // shrunk people are 1/20 size (about 9 cm)
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
// item axes expressed in hand space: item X -> hand -Y, item Y -> hand +Z, item Z -> hand -X
const GRIP = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0),
));
const GRIP_INV = GRIP.clone().invert();
const PALM = new THREE.Vector3(0.075, 0.03, 0.0); // grip center seen from the wrist: out along the palm, a bit in front of it

const smooth = (t) => t * t * (3 - 2 * t);

class Item {
  constructor(name, model, { hold = new THREE.Vector3(0.2, -0.2, -0.45) } = {}) {
    this.name = name;
    this.model = model;
    this.hold = hold; // camera-space position of the grip
  }
  update() {}
}

class ShrinkRay extends Item {
  constructor(ctx) {
    super('Shrink ray', shrinkRayModel(), { hold: new THREE.Vector3(0.17, -0.17, -0.42) });
    this.gripPoint = new THREE.Vector3(0, -0.03, 0.012);      // middle of the handle
    this.ctx = ctx;
    this.charge = 0;
    this.charging = false;
    this.cooldown = 0;
    this.beam = this.makeBeam();
    ctx.scene.add(this.beam);
  }

  makeBeam() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 12, 1, true), mat);
    const glowMat = mat.clone();
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 16, 1, true), glowMat);
    const beam = new THREE.Group();
    beam.add(core, glow);
    beam.visible = false;
    beam.userData = { mats: [mat, glowMat], life: 0 };
    return beam;
  }

  onDown() {
    if (this.cooldown <= 0) this.charging = true;
  }

  // right click: the grow beam (a tiny person you aim at goes back to normal size)
  onAlt() {
    if (this.cooldown > 0) return;
    const { camera, physics, player } = this.ctx;
    this.cooldown = 0.6;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const hit = physics.raycast(camera.position, dir, RANGE, { exclude: player.body.collider });
    const from = this.model.localToWorld(this.model.userData.muzzle.clone());
    const to = hit ? hit.point : camera.position.clone().addScaledVector(dir, RANGE);
    const b = this.beam;
    b.visible = true;
    b.userData.life = 0.28;
    b.position.copy(from).lerp(to, 0.5);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    b.scale.set(1, from.distanceTo(to), 1);
    for (const m of b.userData.mats) m.color.set(0xffb347); // warm orange: growing
    b.userData.grow = true;
    this.ctx.audio?.zap(true);
    const target = hit?.owner;
    if (target?.grow && target.tiny) target.grow(1);
  }

  onUp() {
    if (!this.charging) return;
    this.charging = false;
    if (this.charge > 0.35) this.fire(this.charge);
    this.charge = 0;
  }

  fire(power) {
    const { camera, physics, player } = this.ctx;
    this.cooldown = 0.6;
    const from = this.model.localToWorld(this.model.userData.muzzle.clone());
    const dir = camera.getWorldDirection(new THREE.Vector3());
    // aim from the eye (what you see is what you hit), draw the beam from the muzzle
    const hit = physics.raycast(camera.position, dir, RANGE, { exclude: player.body.collider });
    const to = hit ? hit.point : camera.position.clone().addScaledVector(dir, RANGE);
    const b = this.beam;
    b.visible = true;
    b.userData.life = 0.28;
    const len = from.distanceTo(to);
    b.position.copy(from).lerp(to, 0.5);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    b.scale.set(0.6 + power, len, 0.6 + power);
    for (const m of b.userData.mats) m.color.set(0x7fd6ff);
    this.model.userData.light.intensity = 25;
    this.ctx.audio?.zap(false);
    const target = hit?.owner;
    if (target?.shrink && !target.tiny && !target.dead) {
      target.shrink(TINY, { power });
      this.ctx.crime?.('shrink', target.position.clone(), target);
    }
    this.ctx.events?.emit?.('shrink-ray-fired', { hit: !!target });
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.charging) this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
    this.ctx.audio?.chargeHum(this.charging ? this.charge : 0);
    const u = this.model.userData;
    const hum = this.charging ? this.charge : 0;
    u.coreMat.emissiveIntensity = 0.4 + hum * 9 + Math.sin(performance.now() / 40) * hum * 0.8;
    u.lensMat.emissiveIntensity = 0.3 + hum * 5;
    u.light.intensity = Math.max(hum * 4, u.light.intensity * Math.exp(-dt * 12));
    for (const [i, c] of u.coils.entries()) c.rotation.z += dt * hum * (6 + i * 3);
    const b = this.beam;
    if (b.userData.life > 0) {
      b.userData.life -= dt;
      const k = Math.max(0, b.userData.life / 0.28);
      b.userData.mats[0].opacity = k;
      b.userData.mats[1].opacity = k * 0.35;
      if (b.userData.life <= 0) b.visible = false;
    }
  }
}

class Jar extends Item {
  constructor(ctx) {
    super('Jar', jarModel(), { hold: new THREE.Vector3(0.16, -0.22, -0.4) });
    this.gripPoint = new THREE.Vector3(0, 0.085, 0);          // hold it around the middle
    this.palm = new THREE.Vector3(0.06, 0.07, 0);              // palm against the side of a 13 cm jar
    this.ctx = ctx;
    this.swoop = null;      // catching animation state
    this.inside = null;     // the tiny human caught in it
  }

  onDown() {
    if (this.swoop) return;
    const { camera, physics, player } = this.ctx;
    if (this.inside) {
      // near the terrarium: drop them in
      const cage = this.ctx.cage;
      if (cage && cage.canDropFrom(camera.position)) {
        const h = this.inside;
        this.inside = null;
        // where in the tank are you pointing? (through the glass; people don't block the aim)
        const aim = cage.aimPoint(physics, camera, player.body.collider);
        cage.drop(h, camera.position, aim?.world || null);
        return;
      }
      return;
    }
    // where on the ground are we aiming (max 1.8 m away)
    const dir = camera.getWorldDirection(new THREE.Vector3());
    // aim at the floor/table under them: people (even tiny ones) don't block the aim
    const floorOnly = groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP);
    const opts = { exclude: player.body.collider, filterGroups: floorOnly };
    const reach = 1.8 * player.scale + 1.5;
    // looking into the terrarium: the ray goes through its glass to the soil
    const cage = this.ctx.cage;
    const hit = cage && player.scale > 0.5 && cage.canDropFrom(camera.position) ? cage.raycast(physics, camera.position, dir, reach, opts) : physics.raycast(camera.position, dir, reach, opts);
    if (!hit || hit.normal.y < 0.6) return;
    this.swoop = { t: 0, target: hit.point.clone(), start: this.model.position.clone() };
  }

  update(dt) {
    if (!this.swoop) return;
    // a fast swoop down: 0.28 s down (opening first), a short hold, then back up
    const s = this.swoop;
    s.t += dt;
    const down = 0.28;
    if (s.t >= down && !s.checked) {
      s.checked = true;
      const { r } = this.model.userData;
      // anyone tiny under the opening gets caught
      let best = null;
      for (const h of this.ctx.humans) {
        if (!h.tiny || h.captured) continue;
        const d = Math.hypot(h.position.x - s.target.x, h.position.z - s.target.z);
        if (d < r * 0.95 && Math.abs(h.position.y - s.target.y) < 0.2 && (!best || d < best.d)) best = { h, d };
      }
      if (best) {
        if (best.h.state !== 'caged') this.ctx.crime?.('kidnap', best.h.position.clone(), best.h);
        this.inside = best.h;
        this.ctx.audio?.clink(s.target);
        best.h.captureInto(this.model, { watcher: this.ctx.camera });
      }
      s.result = best ? 'caught' : 'missed';
      if (!best) this.lastMiss = { target: s.target.clone(), near: this.ctx.humans.filter((h) => h.tiny).map((h) => ({ d: Math.hypot(h.position.x - s.target.x, h.position.z - s.target.z), dy: h.position.y - s.target.y, state: h.state })) };
    }
    if (s.t >= down + 0.35) this.swoop = null;
  }

  // world transform of the jar while swooping (overrides the normal hold pose)
  swoopPose() {
    const s = this.swoop;
    if (!s) return null;
    const down = 0.28;
    const k = s.t < down ? smooth(s.t / down) : s.t < down + 0.15 ? 1 : 1 - smooth((s.t - down - 0.15) / 0.2);
    return { k, target: s.target };
  }
}

// Supplies for the tiny people: a beaker of building poles, stones, bread crumbs,
// or a tiny axe / pickaxe. Click near the terrarium to pour it where you aim;
// R changes what's in the beaker.
const SUPPLIES = [
  { kind: 'wood', label: 'wooden poles', count: 6 },
  { kind: 'stone', label: 'building stones', count: 10 },
  { kind: 'food', label: 'bread crumbs', count: 6 },
  { kind: 'seeds', label: 'seeds (they plant them)', count: 6 },
  { kind: 'axe', label: 'a tiny axe', count: 1 },
  { kind: 'pickaxe', label: 'a tiny pickaxe', count: 1 },
];

class Supplies extends Item {
  constructor(ctx) {
    super('Supplies', beakerModel(), { hold: new THREE.Vector3(0.16, -0.2, -0.4) });
    this.gripPoint = new THREE.Vector3(0, 0.05, 0);
    this.palm = new THREE.Vector3(0.055, 0.055, 0);
    this.curl = { amount: 0.5, thumb: 0.4 };
    this.ctx = ctx;
    this.index = 0;
    this.pour = null;
    this.fill();
  }

  get supply() { return SUPPLIES[this.index]; }

  get hint() {
    const cage = this.ctx.cage;
    const near = cage?.canDropFrom(this.ctx.camera.position);
    return `Supplies: ${this.supply.label} — ${near ? 'click to pour it where you aim' : 'go to the terrarium to pour'} · R: change`;
  }

  // what you see in the beaker
  fill() {
    const c = this.model.userData.contents;
    for (const o of [...c.children]) c.remove(o);
    const { kind, count } = this.supply;
    for (let i = 0; i < count; i++) {
      const p = pieceMesh(kind, (i * 0.37) % 1);
      const a = (i / count) * Math.PI * 2;
      if (kind === 'wood') {
        // poles stand in the beaker like skewers in a cup, leaning on the rim
        p.rotation.set(0, a, Math.PI / 2 - 0.2);
        p.position.set(Math.cos(a) * 0.012, 0.05, Math.sin(a) * 0.012);
      } else if (kind === 'axe' || kind === 'pickaxe') {
        p.rotation.set(0, 0.6, Math.PI / 2);
        p.position.set(0, 0.002, 0);
      } else {
        const r = kind === 'stone' ? 0.018 : 0.012;
        p.position.set(Math.cos(a * 1.7) * r * ((i % 3) / 3 + 0.3), 0.004 + Math.floor(i / 6) * 0.007, Math.sin(a * 1.7) * r * ((i % 3) / 3 + 0.3));
        p.rotation.set(i, i * 2, 0);
      }
      c.add(p);
    }
  }

  cycle() {
    if (this.pour) return;
    this.index = (this.index + 1) % SUPPLIES.length;
    this.fill();
  }

  onDown() {
    const { cage, colony, camera, physics, player } = this.ctx;
    if (this.pour || !cage || !colony?.ready || !cage.canDropFrom(camera.position)) return;
    const aim = cage.aimPoint(physics, camera, player.body.collider);
    if (!aim) return;
    this.pour = { t: 0, at: aim.local, done: false };
  }

  update(dt) {
    if (this.ctx.input.pressed('reload')) this.cycle();
    const p = this.pour;
    if (!p) return;
    p.t += dt;
    if (!p.done && p.t > 0.3) {
      p.done = true;
      const { kind, count } = this.supply;
      this.ctx.colony.drop(kind, p.at, count);
      this.model.userData.contents.visible = false;
    }
    if (p.t > 1.1) {
      this.pour = null;
      this.model.userData.contents.visible = true; // refilled from the lab's supply
    }
  }

  // tilt forward to pour, then back
  tilt() {
    const p = this.pour;
    if (!p) return 0;
    if (p.t < 0.3) return smooth(p.t / 0.3) * 1.9;
    if (p.t < 0.6) return 1.9;
    return (1 - smooth(Math.min(1, (p.t - 0.6) / 0.4))) * 1.9;
  }
}

// Your empty hand: pick up anyone small enough (tiny people, or normal people
// when you're a giant), hold them on your palm, put them down or throw them.
const PALM_UP = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2));
class Hand extends Item {
  constructor(ctx) {
    super('Hand', new THREE.Group(), { hold: new THREE.Vector3(0.07, -0.14, -0.34) });
    this.gripPoint = new THREE.Vector3(0, 0, 0);
    this.palm = new THREE.Vector3(0.07, 0.0, 0.0); // the palm's middle, seen from the wrist
    this.ctx = ctx;
    this.held = null;
    this.target = null;   // who you'd grab if you clicked now
    this.lastQ = new THREE.Quaternion();
    this.talkT = 4;
  }

  get curl() { return this.held ? { amount: 0.3, thumb: 0.2 } : { amount: 0.12, thumb: 0.1 }; }

  // small enough to hold: a fifth of your size or less
  canHold(h) {
    return h && h.grabbed && !h.dead && h.alive && !h.captured && h.state !== 'flying' && h.scale <= 0.22 * this.ctx.player.scale;
  }

  reach() { return 1.8 * this.ctx.player.scale + 1.5; }

  // what's under the crosshair: a person you could pick up (forgiving: near the spot you aim at)
  findTarget() {
    const { camera, physics, player, cage, humans } = this.ctx;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const opts = { exclude: player.body.collider, filterGroups: groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP | GROUP.TINY | GROUP.NPC) };
    const nearCage = cage && player.scale > 0.5 && player.scale < 3 && cage.canDropFrom(camera.position);
    const hit = nearCage ? cage.raycast(physics, camera.position, dir, this.reach(), opts) : physics.raycast(camera.position, dir, this.reach(), opts);
    if (!hit) return null;
    if (this.canHold(hit.owner)) return hit.owner;
    let best = null, bd = Infinity;
    for (const h of humans) {
      if (!this.canHold(h)) continue;
      const p = h.character.root.getWorldPosition(_v);
      const d = Math.hypot(p.x - hit.point.x, p.z - hit.point.z);
      const tol = Math.max(0.03 * player.scale, 0.45 * h.scale);
      if (d < tol && Math.abs(p.y - hit.point.y) < Math.max(0.1, h.scale) && d < bd) { best = h; bd = d; }
    }
    return best;
  }

  get hint() {
    if (this.charging) return `Throw power ${'█'.repeat(Math.round(this.charge * 5))}${'░'.repeat(10 - Math.round(this.charge * 5))}`;
    if (this.held) return `Holding ${this.held.profile.name} — click: put down where you aim · hold right-click: throw`;
    if (this.target) return `Click to pick up ${this.target.profile.name}`;
    return 'Hand: click someone small to pick them up (grow with X to pick up normal people)';
  }

  onDown() {
    const { camera, physics, player, cage, scene, speech } = this.ctx;
    if (!this.held) {
      const h = this.findTarget();
      if (!h) return;
      const wasFree = h.state !== 'caged';
      const at = h.character.root.getWorldPosition(new THREE.Vector3());
      h.grabbed();
      this.held = h;
      if (wasFree) this.ctx.crime?.('grab', at, h);
      this.talkT = 5 + Math.random() * 4;
      speech?.react(h, 'pickedUp', { shout: true });
      return;
    }
    const h = this.held;
    // into the terrarium if you're at it and aiming inside
    if (cage && player.scale > 0.5 && player.scale < 3 && cage.canDropFrom(camera.position) && h.scale < 0.2) {
      const aim = cage.aimPoint(physics, camera, player.body.collider);
      if (aim) {
        this.held = null;
        h.captured = false;
        cage.drop(h, camera.position, aim.world);
        speech?.react(h, 'putDown');
        return;
      }
    }
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const hit = physics.raycast(camera.position, dir, this.reach(), { exclude: player.body.collider, filterGroups: groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP) });
    if (!hit || hit.normal.y < 0.6) { this.ctx.toast?.('Aim at the ground (or a table) to put them down'); return; }
    this.held = null;
    h.placeAt(hit.point.clone(), scene);
    speech?.react(h, 'putDown');
  }

  // right-click: hold to wind up, let go to throw
  onAlt() {
    if (this.held) { this.charging = true; this.charge = 0; }
  }

  throwNow() {
    const h = this.held;
    this.charging = false;
    if (!h) return;
    const { camera, player, scene, speech } = this.ctx;
    this.held = null;
    const s = player.scale;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const power = 1 + Math.min(2, this.charge || 0) ; // hold right-click longer: throw harder
    this.charge = 0;
    const vel = dir.multiplyScalar(7 * power * Math.sqrt(s)).add(new THREE.Vector3(0, 1.5 * Math.sqrt(s), 0));
    h.onLand = (who, harm, hit) => {
      if (harm <= 1.4) setTimeout(() => speech?.react(who, 'landed'), 600);
      else this.ctx.crime?.('kill', hit.point.clone(), who);
    };
    h.throwFrom(h.character.root.getWorldPosition(new THREE.Vector3()), vel, scene);
    speech?.react(h, 'thrown', { shout: true, secs: 2 });
    this.ctx.crime?.('throw', h.character.root.getWorldPosition(new THREE.Vector3()), h);
  }

  // set them down gently right below your hand (switching items, getting small)
  release() {
    const h = this.held;
    if (!h) return;
    this.held = null;
    const { physics, scene } = this.ctx;
    const p = h.character.root.getWorldPosition(new THREE.Vector3());
    const hit = physics.raycast(p, { x: 0, y: -1, z: 0 }, 60, { filterGroups: groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP) });
    if (hit) h.placeAt(hit.point.clone(), scene);
    else h.throwFrom(p, new THREE.Vector3(), scene);
  }

  update(dt) {
    const { player, camera, speech } = this.ctx;
    if (this.held && (this.held.dead || this.held.state !== 'held' || this.held.scale > 0.3 * player.scale)) {
      // grew too big to hold (you shrank), or something else happened to them
      if (this.held.state === 'held') this.release(); else this.held = null;
    }
    if (this.charging) {
      this.charge = Math.min(2, this.charge + dt * 1.5);
      if (!this.ctx.input.isDown('secondary')) this.throwNow();
    }
    this.target = this.held ? null : this.findTarget();
    const h = this.held;
    if (!h) return;
    // shaking them around: how fast the view turns
    const turn = 2 * Math.acos(Math.min(1, Math.abs(this.lastQ.dot(camera.quaternion)))) / Math.max(dt, 1e-3);
    this.lastQ.copy(camera.quaternion);
    h.shaken = turn > 5 ? Math.min(2, h.shaken + dt * 2) : Math.max(0, h.shaken - dt);
    if (h.shaken > 0.5) speech?.react(h, 'shaken', { cooldown: 2.5, shout: true, secs: 2 });
    this.talkT -= dt;
    if (this.talkT <= 0) { speech?.react(h, 'held', { cooldown: 2 }); this.talkT = 6 + Math.random() * 6; }
  }

  // after the arm is posed: the held person stands on the palm, facing you
  afterArm() {
    const h = this.held;
    if (!h) return;
    const { camera, player } = this.ctx;
    const s = player.scale;
    const root = h.character.root;
    const p = this.model.localToWorld(new THREE.Vector3(0, 0, 0));
    p.y += 0.012 * s;
    if (root.parent !== this.ctx.scene) this.ctx.scene.attach(root);
    root.position.copy(p);
    root.scale.setScalar(h.scale);
    h.yaw = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    root.rotation.set(0, h.yaw, 0);
  }
}

export class Hands {
  constructor(ctx) {
    this.ctx = ctx;
    this.items = [new ShrinkRay(ctx), new Jar(ctx), new Supplies(ctx), new Hand(ctx)];
    this.lookTimer = 0;
    this.lookHint = null;
    this.index = 0;
    for (const it of this.items) { it.model.visible = false; ctx.scene.add(it.model); }
    this.current.model.visible = true;
  }

  get current() {
    return this.items[this.index];
  }

  select(i) {
    if (i === this.index || !this.items[i]) return;
    this.current.onUp?.();
    this.current.release?.();
    this.current.model.visible = false;
    this.index = i;
    this.current.model.visible = true;
  }

  update(dt) {
    const { input, camera, player } = this.ctx;
    if (player.ladder?.active) { this.current.model.visible = false; return; } // both hands on the ladder
    this.current.model.visible = true;
    for (let i = 0; i < this.items.length; i++) if (input.pressed(`item${i + 1}`)) this.select(i);
    if (input.pressed('nextItem')) this.select((this.index + 1) % this.items.length);
    if (input.pressed('prevItem')) this.select((this.index + this.items.length - 1) % this.items.length);
    // tiny (inside the terrarium): your fists instead of the gadgets
    if (player.scale < 0.5 && this.ctx.colony) {
      if (input.pressed('primary')) this.ctx.colony.punch(camera);
    } else {
      if (input.pressed('primary')) this.current.onDown?.();
      if (input.released('primary')) this.current.onUp?.();
      if (input.pressed('secondary')) this.current.onAlt?.();
    }

    const item = this.current;
    item.update(dt);
    // hold pose: camera space, scaled with you when you're tiny
    const s = player.scale;
    const pose = item.swoopPose?.();
    // where the item is held: first person = fixed spot in view; third person =
    // in front of your own chest, pointing where you aim (the camera is behind you)
    let holdWorld;
    let aimQ = camera.quaternion;
    if (player.mode === 'first') {
      holdWorld = camera.localToWorld(item.hold.clone().multiplyScalar(s));
    } else {
      aimQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
      const chest = player.character.bones.Bip01_Spine2?.getWorldPosition(new THREE.Vector3()) ?? player.feet.clone().setY(player.feet.y + 1.35 * s);
      holdWorld = chest.add(new THREE.Vector3(0.14, 0.02, -0.38).multiplyScalar(s).applyQuaternion(aimQ));
    }
    item.model.scale.setScalar(s);
    if (pose) {
      // jar: flip upside down and slam over the target spot
      const over = pose.target.clone();
      item.model.position.copy(holdWorld).lerp(over, pose.k);
      const up = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * pose.k, this.ctx.player.yaw, 0, 'YXZ'));
      item.model.quaternion.copy(up);
      if (pose.k > 0.5) item.model.position.y = over.y + item.model.userData.h * s;
    } else {
      item.model.position.copy(holdWorld);
      item.model.quaternion.copy(aimQ);
      if (item instanceof Jar) item.model.quaternion.multiply(_q.setFromEuler(new THREE.Euler(-0.15, 0, 0)));
      if (item instanceof Supplies) item.model.quaternion.multiply(_q.setFromEuler(new THREE.Euler(-0.1 - item.tilt(), 0, 0)));
      if (item instanceof Hand) item.model.quaternion.multiply(PALM_UP);
    }
    item.model.updateMatrixWorld(true);
    this.solveArm();
    item.afterArm?.(dt);
    this.updateLook(dt);
  }

  // Looking at a tiny person in the terrarium: who they are and how they're doing.
  updateLook(dt) {
    this.lookTimer -= dt;
    if (this.lookTimer > 0) return;
    this.lookTimer = 0.2;
    this.lookHint = null;
    const { cage, colony, camera, physics, player } = this.ctx;
    if (!cage || !colony) return;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const opts = { exclude: player.body.collider, filterGroups: groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP | GROUP.TINY) };
    const hit = player.scale > 0.5 && cage.canDropFrom(camera.position) ? cage.raycast(physics, camera.position, dir, 4, opts) : physics.raycast(camera.position, dir, 3 * player.scale, opts);
    if (hit?.owner) this.lookHint = colony.describe(hit.owner);
  }

  // text for the hint line: what the item in hand does, or who you're looking at
  get hint() {
    return this.lookHint || this.current.hint || null;
  }

  // Right hand onto the item's grip, with the hand turned the way a real hand holds it.
  // Rocketbox hand bone: +X along the fingers, +Z from pinky to index, palm faces +Y.
  // Holding a pistol: pinky->index runs up the handle (item +Y), the palm presses on the
  // handle's right side (palm normal = item -X), so the fingers point forward (item -Z).
  solveArm() {
    const ch = this.ctx.player.character;
    const B = ch.bones;
    const upper = B.Bip01_R_UpperArm;
    const lower = B.Bip01_R_Forearm;
    const hand = B.Bip01_R_Hand;
    if (!upper || !lower || !hand) return;
    const item = this.current;
    const s = this.ctx.player.scale;
    ch.root.updateMatrixWorld(true);
    const qItem = item.model.getWorldQuaternion(new THREE.Quaternion());
    const qHand = qItem.clone().multiply(GRIP_INV);
    const grip = item.model.localToWorld((item.gripPoint || new THREE.Vector3()).clone());
    // wrist = grip point minus the palm offset (in hand space, meters)
    const palm = (item.palm || PALM).clone().multiplyScalar(s).applyQuaternion(qHand);
    const wrist = grip.clone().sub(palm);
    const shoulder = upper.getWorldPosition(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(qItem);
    const pole = shoulder.clone().addScaledVector(right, 0.4).add(new THREE.Vector3(0, -0.6, 0));
    solveTwoBone(upper, lower, hand, wrist, 1, pole);
    // turn the hand itself
    const parentQ = hand.parent.getWorldQuaternion(new THREE.Quaternion());
    hand.quaternion.copy(parentQ.invert().multiply(qHand));
    hand.updateMatrixWorld(true);
    // fingers around the grip: tight on the pistol grip, open wider for the fat jar
    const it = this.current;
    const curl = it.curl || (it instanceof Jar ? { amount: 0.55, thumb: 0.4 } : { amount: 0.95, thumb: 0.8 });
    ch.grip('R', curl.amount, { thumb: curl.thumb });
    // the index finger rests on the trigger, and pulls it while charging
    if (it instanceof ShrinkRay) {
      const idx = B.Bip01_R_Finger1;
      if (idx) idx.rotation.z -= 0.55 - (it.charging ? 0.25 : 0);
    }
  }
}
