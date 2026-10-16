// YOU. A mad scientist (or whatever the changer makes you). Any size from flea to giant.
// First person shows your big rubber-glove hand; third person shows your whole body.
import * as THREE from 'three';
import { Body, poseTargets, J } from '../life/body.js';
import { MeshSink } from '../life/render.js';
import { scientistLook } from '../life/looks.js';
import { TINY } from '../life/items.js';
import { act, actPressed, input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { clamp, lerp, angleDiff, damp, rand } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { CAGE } from '../world/cage.js';
import { roundedBox } from '../world/materials.js';
import { buildBug } from '../life/bugs.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export const FORMS = {
  scientist: { label: 'Mad scientist', desc: 'You. Gadgets, hands, everything.', gadgets: true },
  robot: { label: 'Robot', desc: 'Metal body. No hunger, strong punches, heavy.', gadgets: true, punch: 2, noNeeds: true },
  alien: { label: 'Alien', desc: 'Low-gravity jumps and a glowing head.', gadgets: true, jump: 2.2, grav: 0.45 },
  person: { label: 'Copy a person', desc: 'Look exactly like someone from the cage. Their friends will think you ARE them.', gadgets: true, disguise: true },
  stranger: { label: 'Random tiny person', desc: 'A brand-new face nobody knows. Go undercover.', gadgets: true, disguise: true },
  cat: { label: 'Cat', desc: 'Fast, jumps high, swipes with claws. No gadgets.', speed: 1.7, jump: 1.7, claws: true },
  mantis: { label: 'Praying mantis', desc: 'Slow and terrifying. Slices with raptor arms. No gadgets.', speed: 0.7, slice: true },
};

export class Player {
  constructor(game, camera) {
    this.game = game;
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 0, 2.6);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = -0.2;
    this.scale = 1; this.targetScale = 1;
    this.onGround = true;
    this.view = 'first';
    this.form = 'scientist';
    this.look = scientistLook();
    this.health = 100; this.needs = { hunger: 100, thirst: 100, energy: 100 };
    this.holding = null;      // {kind, ref}
    this.bottle = [];         // things in the glass bottle
    this.bottleLid = true;
    this.hotbar = ['hand', 'bottle', null, null, null, null, null, null, 'headband'];
    this.slot = 0;
    this.handPos = new THREE.Vector3();
    this.lastHitBy = null; this.lastHitT = -99;
    this.frozen = 0; this.knockT = 0;
    this.squeeze = 0;
    this.inspect = 0;
    this.disguise = null;
    this.possess = null;
    this.money = 0;
    this.camShake = 0;
    this.bob = 0;
    this.grip = 0; this.pinch = 0;
    this.punchT = 0;
    this.buildModel();
    this.buildViewmodel();
  }

  get height() { return 1.75 * this.scale * this.look.height; }
  get eyeH() { return this.height * 0.92; }
  get eye() { return _eye.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }
  get feetPos() { return this.pos; }
  get reach() { return this.height * (this.view === 'first' ? 0.55 : 0.75) + 0.05 * this.scale; }
  get inCage() { return this.game.cage.inside(this.pos.x, this.pos.z) && this.pos.y < this.game.cageTopY - 0.001 && this.pos.y > CAGE.bottom - 0.01; }
  get big() { return this.scale > 0.5; }
  get gEff() { return 9.8 * Math.sqrt(Math.max(this.scale, 1e-4)) * (FORMS[this.form].grav || 1); }
  get seesInvisible() { return false; }
  get tool() { return this.hotbar[this.slot]; }
  get weapon() { const h = this.holding; return h && h.kind === 'item' && h.ref.def.weapon && h.ref.size > this.height * 0.15 ? h.ref : null; }
  get bp() { const t = this.tool; return t && typeof t === 'object' && !t.potion ? t : null; }
  get potion() { const t = this.tool; return t && typeof t === 'object' && t.potion ? t : null; }

  // ------------------------------------------------------------- models
  buildModel() {
    if (this.sink) { this.body.dispose(); this.sink.dispose(); }
    if (this.creature) { this.game.scene.remove(this.creature); this.creature = null; }
    this.sink = new MeshSink(this.game.scene);
    this.body = new Body(this.look, this.sink, { pos: this.pos, yaw: this.yaw, scale: this.scale });
    this.body.groundFn = (x, z, y) => this.game.groundAt(x, z, y);
    this.anim = { phase: 0, speed: 0, action: null, at: 0, crouch: 0 };
    if (this.form === 'cat') this.creature = buildCat();
    if (this.form === 'mantis') { this.creature = buildBug('mantis'); this.creature.userData.unit = 0.08; }
    if (this.creature) this.game.scene.add(this.creature);
  }

  buildViewmodel() {
    const vm = new THREE.Group();
    const glove = new THREE.MeshStandardMaterial({ color: 0x2fa38a, roughness: 0.35, metalness: 0.05 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0xe9ecdf, roughness: 0.8 });
    this.handMat = glove;
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(roundedBox(0.085, 0.03, 0.1, 0.014), glove);
    hand.add(palm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 14), glove);
    cuff.rotation.x = Math.PI / 2; cuff.position.z = 0.09; hand.add(cuff);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.4, 14), sleeve);
    arm.rotation.x = Math.PI / 2; arm.position.z = 0.32; hand.add(arm);
    this.fingers = [];
    const fx = [-0.033, -0.011, 0.011, 0.033];
    for (let i = 0; i < 5; i++) {
      const thumb = i === 4;
      const base = new THREE.Group();
      base.position.set(thumb ? -0.048 : fx[i], 0, thumb ? 0.0 : -0.05);
      if (thumb) base.rotation.y = 0.9;
      const l1 = (thumb ? 0.035 : 0.04) * (i === 1 ? 1.1 : i === 3 ? 0.85 : 1);
      const s1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, l1, 4, 8), glove);
      s1.rotation.x = Math.PI / 2; s1.position.z = -l1 / 2;
      const knuckle = new THREE.Group(); knuckle.position.z = -l1;
      const s2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, l1 * 0.8, 4, 8), glove);
      s2.rotation.x = Math.PI / 2; s2.position.z = -l1 * 0.4;
      knuckle.add(s2);
      base.add(s1, knuckle);
      hand.add(base);
      this.fingers.push({ base, knuckle, thumb });
    }
    hand.position.set(0.16, -0.17, -0.32);
    hand.rotation.set(0.15, -0.12, 0);
    vm.add(hand);
    this.hand = hand;
    // the glass bottle
    const bottle = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.04, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 24, 1, true), glass);
    const bbot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), glass); bbot.rotation.x = -Math.PI / 2; bbot.position.y = -0.1;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.05, 24, 1, true), glass); neck.position.y = 0.125;
    this.lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0xb03a3a, roughness: 0.4 }));
    this.lidMesh.position.y = 0.16;
    bottle.add(bb, bbot, neck, this.lidMesh);
    for (const o of [bb, neck]) o.renderOrder = 6;
    bottle.position.set(0.02, 0.09, -0.04);
    this.bottleMesh = bottle;
    hand.add(bottle);
    this.vm = vm;
    this.camera.add(vm);
    this.gadgetMesh = null;
  }

  setGadgetMesh() {
    if (this.gadgetMesh) { this.gadgetMesh.parent && this.gadgetMesh.parent.remove(this.gadgetMesh); this.gadgetMesh = null; }
    const bp = this.bp;
    if (bp) {
      this.gadgetMesh = this.game.gadgets.model(bp);
      this.gadgetMesh.position.set(0, 0.035, 0.0);
      this.hand.add(this.gadgetMesh);
    } else if (this.potion) {
      // a little glass flask with the potion glowing inside
      const pot = this.potion;
      const g = new THREE.Group();
      const glass = new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0.05, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
      const liquid = new THREE.MeshStandardMaterial({ color: pot.color, emissive: pot.color, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.85 });
      const flask = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), glass); flask.position.y = 0.04;
      const liq = new THREE.Mesh(new THREE.SphereGeometry(0.031, 16, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), liquid); liq.position.y = 0.04;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.035, 12, 1, true), glass); neck.position.y = 0.088;
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.009, 0.014, 10), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.9 })); cork.position.y = 0.11;
      flask.renderOrder = 6; neck.renderOrder = 6;
      g.add(liq, flask, neck, cork);
      g.position.set(0.0, 0.02, -0.03);
      this.gadgetMesh = g;
      this.hand.add(g);
    }
    this.bottleMesh.visible = this.tool === 'bottle';
  }

  // ------------------------------------------------------------- size
  setScale(s) {
    const k = s / this.scale;
    this.scale = s;
    this.body.rescale(s);
    void k;
  }

  setTargetScale(s) { this.targetScale = clamp(s, 0.0012, 12); }

  maxScaleHere() {
    // can't grow through a ceiling (or the cage lid)
    const c = this.game.world.colliders.ceilingAt(this.pos.x, this.pos.z, this.pos.y + this.height * 0.5, this.height * 0.15);
    let maxH = isFinite(c) ? (c - this.pos.y) * 0.97 : 12 * 1.75;
    if (this.inCage && !this.game.cage.openAbove(this.pos.x, this.pos.z)) maxH = Math.min(maxH, (this.game.cageTopY - this.pos.y) * 0.95);
    return maxH / (1.75 * this.look.height);
  }

  // ------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game;
    if (this.possess) { this.updatePossess(dt); return; }
    // look
    const sens = 0.0022 * settings.sensitivity;
    if (input.locked && !g.ui.modalOpen) {
      this.yaw -= input.mouse.dx * sens;
      this.pitch -= input.mouse.dy * sens * (settings.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.5, 1.5);
    }
    // size watch: hold to shrink / grow, let go to stay
    const typing = input.typing;
    if (!typing && !g.ui.modalOpen) {
      if (act('shrink')) { this.targetScale = Math.max(0.0012, this.scale * Math.exp(-dt * 0.9)); this.watchGlow = 1; if (!this.shrinkSfx || g.time - this.shrinkSfx > 0.5) { sfx('shrink', { vol: 0.25, pitch: 1.2 }); this.shrinkSfx = g.time; } }
      if (act('grow')) {
        const max = this.maxScaleHere();
        if (this.scale * Math.exp(dt * 0.9) > max) { if (!this.growWarn || g.time - this.growWarn > 2) { g.toast(this.inCage ? 'The lid is in the way. Open it on the control panel to grow out.' : 'No room to grow here. Go outside to get bigger.'); this.growWarn = g.time; } }
        else { this.targetScale = Math.min(max, this.scale * Math.exp(dt * 0.9)); this.watchGlow = 1; if (!this.growSfx || g.time - this.growSfx > 0.5) { sfx('grow', { vol: 0.25 }); this.growSfx = g.time; } }
      }
    }
    if (Math.abs(this.targetScale - this.scale) > this.scale * 1e-4) this.setScale(this.targetScale);
    this.watchGlow = Math.max(0, (this.watchGlow || 0) - dt * 2);
    if (actPressed('view')) { this.view = this.view === 'first' ? 'third' : 'first'; }
    this.move(dt);
    this.handleTools(dt);
    this.updateHeld(dt);
    this.updateNeeds(dt);
    this.animateModel(dt);
    this.updateCamera(dt);
  }

  move(dt) {
    const g = this.game;
    const H = this.height;
    const form = FORMS[this.form];
    let fx = 0, fz = 0;
    if (!input.typing && !g.ui.modalOpen && this.frozen <= 0) {
      if (act('forward')) fz -= 1; if (act('back')) fz += 1; if (act('left')) fx -= 1; if (act('right')) fx += 1;
    }
    if (this.frozen > 0) this.frozen -= dt;
    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = fx * cos + fz * sin, wz = -fx * sin + fz * cos;
    const sprint = act('sprint') ? 1.9 : 1;
    const crouch = act('crouch') ? 0.45 : 1;
    if (this.speedBoost > 0) this.speedBoost -= dt;
    const sp = 1.6 * Math.pow(this.scale * this.look.height, 0.75) * sprint * crouch * (form.speed || 1) * (this.inWater() ? 0.5 : 1) * (this.speedBoost > 0 ? 1.8 : 1);
    const accel = 1 - Math.exp(-dt * (this.onGround ? 12 : 2.5));
    this.vel.x = lerp(this.vel.x, wx * sp, accel);
    this.vel.z = lerp(this.vel.z, wz * sp, accel);
    if (this.knockT > 0) this.knockT -= dt;
    // jump
    if (this.onGround && actPressed('jump') && this.frozen <= 0) {
      this.vel.y = Math.sqrt(2 * this.gEff * H * 0.32) * (form.jump || 1);
      this.onGround = false;
    }
    this.vel.y -= this.gEff * dt;
    // substeps: never move more than a fraction of your own size per step
    const dist = Math.hypot(this.vel.x, this.vel.y, this.vel.z) * dt;
    const n = Math.min(12, Math.max(1, Math.ceil(dist / (H * 0.15))));
    const sdt = dt / n;
    let landed = false, fallV = 0;
    for (let i = 0; i < n; i++) {
      this.pos.x += this.vel.x * sdt;
      this.pos.z += this.vel.z * sdt;
      this.collide();
      this.pos.y += this.vel.y * sdt;
      const gy = g.groundAt(this.pos.x, this.pos.z, this.pos.y + H * 0.3, null, H * 0.25);
      if (this.pos.y <= gy) {
        if (this.vel.y < 0) { fallV = Math.max(fallV, -this.vel.y); landed = true; }
        this.pos.y = gy; this.vel.y = 0; this.onGround = true;
      } else if (this.pos.y > gy + H * 0.06) this.onGround = false;
      else if (this.vel.y <= 0) { this.pos.y = gy; this.vel.y = 0; this.onGround = true; } // stick to ground going down slopes/steps
      // ceiling
      const ceil = g.world.colliders.ceilingAt(this.pos.x, this.pos.z, this.pos.y + H * 0.5, H * 0.12);
      if (this.pos.y + H > ceil) { this.pos.y = Math.max(this.pos.y - (this.pos.y + H - ceil), g.groundAt(this.pos.x, this.pos.z, this.pos.y + H * 0.3)); if (this.vel.y > 0) this.vel.y = 0; }
    }
    if (landed) {
      const rel = fallV / Math.sqrt(this.gEff * H);
      if (rel > 4.2 && this.form !== 'cat') this.takeHit((rel - 4.2) * 22, null, 'fall');
      if (rel > 1.5) sfx('thud', { vol: 0.3, pitch: 1 / Math.max(0.3, Math.sqrt(this.scale)) });
    }
    // fell out of the world
    if (this.pos.y < -20) this.respawn('lab');
    // footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > sp * 0.3) { this.bob += hs * dt / (H * 0.35); if (this.bob > Math.PI) { this.bob -= Math.PI; sfx('step', { vol: 0.25, pitch: clamp(1 / Math.sqrt(this.scale), 0.5, 3) }); } }
    this.anim.speed = hs / Math.max(1e-6, 1.6 * Math.pow(this.scale, 0.75));
    this.anim.phase += hs * dt / (0.75 * H) * Math.PI;
    this.anim.air = !this.onGround;
    this.anim.crouch = crouch < 1 ? 1 : 0;
  }

  inWater() { const c = this.game.cage; return this.inCage && c.isWater(this.pos.x, this.pos.z) && c.waterDepth(this.pos.x, this.pos.z) > this.height * 0.4 && !c.frozen; }

  collide() {
    const g = this.game;
    const H = this.height;
    const r = H * 0.16;
    if (g.cage.inside(this.pos.x, this.pos.z, -0.005) && this.pos.y < g.cageTopY && this.pos.y > CAGE.bottom - 0.01 && H < CAGE.top - CAGE.bottom) {
      g.cage.pushOut(this.pos, r, H);
      // people are solid too when you're their size
      for (const p of g.peopleNear(this.pos, H)) {
        if (!p.alive || p.busyBody || p.body.mode === 'rag') continue;
        const min = (p.height * 0.14 + r);
        const dx = this.pos.x - p.pos.x, dz = this.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < min && d > 1e-9 && p.height > H * 0.4) { this.pos.x = p.pos.x + dx / d * min; this.pos.z = p.pos.z + dz / d * min; }
      }
    } else g.world.colliders.resolve(this.pos, r, H * 0.95, H * 0.22);
  }

  // ------------------------------------------------------------- hands & tools
  handleTools(dt) {
    const g = this.game;
    if (g.ui.modalOpen || input.typing) return;
    // hotbar
    for (let i = 0; i < 9; i++) if (input.pressed.has('Digit' + (i + 1))) this.select(i);
    if (input.mouse.wheel) this.select((this.slot + (input.mouse.wheel > 0 ? 1 : 8)) % 9);
    const aim = this.aim();
    const tool = this.tool;
    const form = FORMS[this.form];
    this.punchT = Math.max(0, this.punchT - dt);
    // the R key flips gadget modes / bottle lid
    if (actPressed('flip')) {
      if (this.bp) g.toast(g.gadgets.cycle(this.bp)), this.setGadgetMesh();
      else if (tool === 'bottle') { this.bottleLid = !this.bottleLid; g.toast(this.bottleLid ? 'Lid on.' : 'Lid off.'); sfx('click'); }
      else if (this.potion) { g.drinkPotion(this.potion); return; }
    }
    // animals don't use gadgets
    if (!form.gadgets) {
      if (input.mouse.leftPressed) this.creatureAttack(aim);
      return;
    }
    // terrain brush from the control panel
    if (g.brush) {
      if (input.mouse.left) { const hit = g.pick(aim.origin, aim.dir, this.height * 20, { groundOnly: true }); if (hit && g.cage.inside(hit.point.x, hit.point.z)) g.applyBrush(hit.point, dt); }
      if (input.mouse.rightPressed || input.pressed.has('Escape')) { g.brush = null; g.toast('Brush put away.'); }
      return;
    }
    if (tool === 'hand') {
      // a weapon your size: click swings it, Q throws it
      if (input.mouse.leftPressed) { if (this.weapon) { this.melee(aim); this.lastGrabOK = true; } else if (this.holding) { this.drop(); this.lastGrabOK = true; } else this.grabAt(aim); }
    } else if (tool === 'bottle') {
      if (input.mouse.leftPressed) this.scoop(aim);
      if (actPressed('throw')) this.pour();
      if (act('squeeze')) this.shakeBottle(dt);
    } else if (tool === 'headband') {
      if (input.mouse.leftPressed) g.ui.headbandAt(aim);
    } else if (this.bp) {
      const bp = this.bp;
      if (bp.mod === 'hold' || bp.opts.tractor) { if (input.mouse.left) g.gadgets.fire(bp, aim, !input.mouse.leftPressed, dt); else if (g.gadgets.tractorTarget) g.gadgets.tractorTarget = null; }
      else if (input.mouse.leftPressed) { g.gadgets.fire(bp, aim, false); this.recoil = 1; }
    } else if (tool && tool.potion) {
      if (input.mouse.leftPressed) g.usePotion(tool, aim);
    }
    // while holding something in the hand
    if (this.holding) {
      if (actPressed('throw')) this.throwHeld();
      if (act('squeeze')) this.squeezeHeld(dt); else this.squeeze = Math.max(0, this.squeeze - dt * 2);
      if (actPressed('pullLimb')) this.pullLimb();
    }
    this.inspect = damp(this.inspect, input.mouse.right && (this.holding || tool === 'bottle') ? 1 : 0, 8, dt);
    // tiny you: punch people your size
    if (tool === 'hand' && !this.holding && input.mouse.leftPressed && !this.lastGrabOK) this.melee(aim);
    this.lastGrabOK = false;
  }

  select(i) {
    if (this.slot === i) return;
    if (this.holding && this.hotbar[i] !== 'hand') this.drop(true);
    this.slot = i;
    this.setGadgetMesh();
    sfx('click');
  }

  aim() {
    const c = this.camera;
    const origin = new THREE.Vector3(); c.getWorldPosition(origin);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(c.getWorldQuaternion(_q)).normalize();
    // in third person aim from the head, not the camera behind you
    if (this.view === 'third') { const e = this.eye.clone(); const t = this.game.pick(origin, dir, this.height * 60, { notPlayer: true }); const target = t ? t.point : origin.clone().addScaledVector(dir, this.height * 60); return { origin: e, dir: target.sub(e).normalize() }; }
    return { origin, dir };
  }

  muzzlePos() {
    // (userData gets JSON-copied when a model is cloned, so rebuild the vector)
    if (this.view === 'first' && this.gadgetMesh) { const u = this.gadgetMesh.userData.muzzle; return this.gadgetMesh.localToWorld(u ? new THREE.Vector3(u.x, u.y, u.z) : new THREE.Vector3()); }
    const h = this.body.P(J.rHa, new THREE.Vector3());
    return h;
  }

  // where held things sit (between the pinched fingers)
  handHoldPoint() {
    if (this.view === 'first') {
      const p = new THREE.Vector3(-0.045, 0.0, -0.105);
      const close = this.inspect;
      this.hand.updateWorldMatrix(true, false);
      const w = this.hand.localToWorld(p);
      if (close > 0.01) { const e = this.eye; const fwd = this.aim().dir; const near = e.clone().addScaledVector(fwd, this.height * 0.14); w.lerp(near, close); }
      return w;
    }
    const h = this.body.P(J.rHa, new THREE.Vector3());
    return h.add(_v.set(0, this.height * 0.03, 0));
  }

  // the spot on the ground under your hand (tiny people walk there when you say "come here")
  handGround() {
    const h = this.handPos;
    return new THREE.Vector3(h.x, this.game.groundAt(h.x, h.z, h.y), h.z);
  }

  // grab whatever is under the crosshair (people, bugs, items, small cars)
  grabAt(aim) {
    const g = this.game;
    const hit = g.pick(aim.origin, aim.dir, this.reach, { notPlayer: true, grabbable: true });
    this.lastGrabOK = false;
    if (!hit || hit.kind === 'ground' || hit.kind === 'wall' || hit.kind === 'building') return;
    if (this.grabTarget(hit)) { this.lastGrabOK = true; }
  }

  grabTarget(t) {
    const g = this.game;
    const r = t.ref;
    const size = g.gadgets.sizeOf(t);
    if (size > this.height * 0.35) { g.toast('Too big to pick up.'); return false; }
    if (t.kind === 'person' && r.kid) { g.toast(r.age === 'baby' ? 'You can\'t grab the baby.' : 'The kid wriggles away. You can\'t grab kids.'); r.fear = Math.min(100, r.fear + 20); return false; }
    if (t.kind === 'person' && (r.loc === 'jar' || r.loc === 'bottle')) return false;
    this.holding = { kind: t.kind, ref: r };
    this.pinch = 1;
    sfx('pick', { pitch: 1 + (1 - Math.min(1, size / this.height)) });
    if (t.kind === 'person') {
      r.held = true; r.loc = 'held'; r.task = null; r.stop();
      r.body.ragdoll(99);
      if (r.alive) {
        r.fear = Math.min(100, r.fear + 15);
        const lines = r.op > 50 ? ['Whoa! Hi!', 'Careful!', 'I trust you... I think.'] : r.op < -40 && r.has('brave') ? ['Put me DOWN!', 'Get your fingers off me!', 'I\'ll bite you!'] : ['AAAH! Put me down!', 'Please don\'t hurt me!', 'NO NO NO!', 'Where are you taking me?!'];
        r.say(rand.pick(lines), { kind: r.op > 50 ? 'chat' : 'scared', scream: r.op < 50 });
        g.witness('grab', r.pos, r);
      }
      g.ui.focusPerson = r;
    } else if (t.kind === 'item') { r.heldBy = 'player'; }
    else if (t.kind === 'bug') { r.held = true; r.release(); }
    else if (t.kind === 'car') { r.held = true; r.speed = 0; }
    return true;
  }

  // let go: things fall from where your hand is
  drop(quiet = false) {
    const g = this.game;
    const h = this.holding;
    if (!h) return;
    const at = this.handHoldPoint();
    const vel = this.handVel ? this.handVel.clone() : new THREE.Vector3();
    this.releaseHeld(at, vel);
    if (!quiet) sfx('drop');
    this.pinch = 0;
    void g;
  }

  releaseHeld(at, vel) {
    const g = this.game;
    const h = this.holding;
    this.holding = null;
    const r = h.ref;
    if (h.kind === 'person') {
      r.held = false;
      r.loc = g.cage.inside(at.x, at.z) ? 'cage' : 'world';
      r.body.unpin();
      r.body.ragT = 1.2;
      r.body.push(vel);
      r.pos.set(at.x, g.groundAt(at.x, at.z, at.y), at.z);
      r.vy = 0;
      if (r.objectForm) { r.pos.copy(at); r.objectForm.mesh.position.copy(at); }
    } else if (h.kind === 'item') {
      r.heldBy = null; r.heldByLast = 'player'; r.pos.copy(at); r.vel.copy(vel); r.rest = false;
      r.mesh.quaternion.identity(); r.mesh.rotation.set(0, r.yaw, 0);
      g.onItemDropped(r);
    } else if (h.kind === 'bug') { r.held = false; r.pos.copy(at); r.vy = vel.y; r.vel.copy(vel); }
    else if (h.kind === 'car') { r.held = false; r.pos.copy(at); r.dropped(vel); }
  }

  throwHeld() {
    const dir = this.aim().dir;
    const v = dir.clone().multiplyScalar(this.height * 3.2).add(_v.set(0, this.height * 0.8, 0));
    const at = this.handHoldPoint();
    sfx('wind', { vol: 0.4 });
    const h = this.holding;
    this.releaseHeld(at, v);
    if (h.kind === 'person' && h.ref.alive) { h.ref.say(rand.pick(['WAAAAAAH!', 'AAAAAAAAH!', 'NOOOOOO!']), { kind: 'scared', scream: true }); h.ref.remember('thrown', 'The giant THREW me', -15, 'player'); h.ref.hurtByPlayer(5); }
    this.pinch = 0;
  }

  squeezeHeld(dt) {
    const h = this.holding;
    if (!h || h.kind !== 'person') return;
    const p = h.ref;
    this.squeeze = Math.min(1.2, this.squeeze + dt * 0.5);
    this.grip = this.squeeze;
    if (!p.alive || p.kid) return;
    if (Math.random() < dt * 3) p.say(rand.pick(['I can\'t... breathe...', 'STOP! STOP!', 'AAAGH!', 'You\'re crushing me!', 'Please...']), { kind: 'scared', scream: true });
    p.body.face.open = 1;
    if (this.squeeze > 0.35) { p.hurt({ dmg: dt * 30 * this.squeeze, type: 'crush', from: 'player', point: p.center(_v.clone()) }); if (Math.random() < dt * 4) sfx('squish', { vol: 0.2, pitch: 2.4 }); }
    if (this.squeeze >= 1.2 && p.alive) { p.squish('player'); this.game.feed(`You squeezed ${p.name} to death`, 'bad', p); }
  }

  pullLimb() {
    const g = this.game;
    const h = this.holding;
    if (!h || h.kind !== 'person') return;
    const p = h.ref;
    if (p.kid) return;
    if (settings.gore !== 'max') { g.toast('Turn gore to MAX in settings for that.'); return; }
    const opts = ['lShoulder', 'rShoulder', 'lHip', 'rHip', 'lElbow', 'rElbow', 'lKnee', 'rKnee'].filter((j) => p.body.canCut(j));
    if (!opts.length) { if (p.body.canCut('neck')) opts.push('neck'); else return; }
    const j = rand.pick(opts);
    const ok = p.cutOff(j, { from: 'player', dir: this.aim().dir.clone().negate().add(_v.set(0, 0.5, 0)).normalize(), type: 'blade' });
    if (ok) { p.hurtByPlayer(30); sfx('slice'); g.feed(`You pulled off ${p.name}'s ${j.includes('Hip') || j.includes('Knee') ? 'leg' : j === 'neck' ? 'head' : 'arm'}`, 'bad', p); }
  }

  // ------------------------------------------------------------- bottle
  scoop(aim) {
    const g = this.game;
    if (this.bottleLid) { g.toast('Take the lid off first (R).'); return; }
    const hit = g.pick(aim.origin, aim.dir, this.reach * 1.2, { notPlayer: true, grabbable: true });
    if (!hit || hit.kind === 'ground' || hit.kind === 'wall' || hit.kind === 'building') { sfx('click'); return; }
    const size = g.gadgets.sizeOf(hit);
    if (size > this.height * 0.08) { g.toast('That won\'t fit in the bottle.'); return; }
    if (this.bottle.length >= 14) { g.toast('The bottle is full.'); return; }
    if (hit.kind === 'person' && hit.ref.kid && hit.ref.parents.length === 0) { g.toast('Kids can\'t be grabbed.'); return; }
    const r = hit.ref;
    if (hit.kind === 'person') { if (r.kid) { g.toast('Kids can\'t be grabbed.'); return; } r.loc = 'bottle'; r.held = false; r.task = null; r.stop(); r.body.ragdoll(0.5); if (r.alive) r.say(rand.pick(['Hey! HEY!', 'Let us out!', 'What is this?!']), { kind: 'scared' }); g.witness('grab', r.pos, r); }
    else if (hit.kind === 'item') r.heldBy = 'bottle';
    else if (hit.kind === 'bug') { r.held = true; r.release(); }
    else return;
    this.bottle.push({ kind: hit.kind, ref: r, off: new THREE.Vector3((rand() - 0.5) * 0.06, 0, (rand() - 0.5) * 0.06) });
    sfx('glass', { pitch: 1.5 });
  }

  pour() {
    const g = this.game;
    if (!this.bottle.length) { g.toast('The bottle is empty.'); return; }
    if (this.bottleLid) { g.toast('Take the lid off first (R).'); return; }
    const at = this.handHoldPoint();
    for (const b of this.bottle) {
      const p = at.clone().add(_v.set((rand() - 0.5) * this.height * 0.03, 0, (rand() - 0.5) * this.height * 0.03));
      const v = this.aim().dir.clone().multiplyScalar(this.height * 0.3);
      if (b.kind === 'person') { b.ref.loc = g.cage.inside(p.x, p.z) ? 'cage' : 'world'; b.ref.body.unpin(); b.ref.body.ragdoll(1); b.ref.body.teleport(p.x - b.ref.body.p[6], p.y - b.ref.body.p[7], p.z - b.ref.body.p[8]); b.ref.body.push(v); b.ref.pos.copy(p); }
      else if (b.kind === 'item') { b.ref.heldBy = null; b.ref.pos.copy(p); b.ref.vel.copy(v); b.ref.rest = false; g.onItemDropped(b.ref); }
      else if (b.kind === 'bug') { b.ref.held = false; b.ref.pos.copy(p); b.ref.vel.copy(v); }
    }
    this.bottle = [];
    sfx('glass', { pitch: 0.8 });
  }

  shakeBottle(dt) {
    if (!this.bottle.length) return;
    this.shake = (this.shake || 0) + dt;
    this.camShake = Math.max(this.camShake, 0.15);
    for (const b of this.bottle) {
      if (b.kind !== 'person') continue;
      const p = b.ref;
      p.body.ragdoll(1);
      p.body.push(_v.set((rand() - 0.5) * p.height * 6, rand() * p.height * 4, (rand() - 0.5) * p.height * 6));
      if (p.alive && !p.kid && Math.random() < dt * 2) { p.hurt({ dmg: 4, type: 'blunt', from: 'player', point: p.center(_v.clone()) }); p.say(rand.pick(['STOP SHAKING!', 'AAAH!', 'I\'m gonna throw up!']), { kind: 'scared', scream: true }); }
    }
    if (Math.random() < dt * 6) sfx('glass', { vol: 0.3, pitch: 1.5 + Math.random() });
  }

  // ------------------------------------------------------------- held things follow the hand
  updateHeld(dt) {
    const g = this.game;
    const hp = this.handHoldPoint();
    if (this.lastHold) { this.handVel = hp.clone().sub(this.lastHold).divideScalar(Math.max(dt, 1e-3)); }
    this.lastHold = hp.clone();
    this.handPos.copy(this.view === 'first' ? hp : this.body.P(J.rHa, _v2));
    const h = this.holding;
    if (h) {
      const r = h.ref;
      if (h.kind === 'person') {
        if (r.objectForm) { r.objectForm.mesh.position.copy(hp).add(_v.set(0, -r.height * 0.5, 0)); r.pos.copy(hp); }
        else {
          r.body.pin(J.pelvis, hp);
          r.pos.set(hp.x, hp.y - r.height * 0.55, hp.z);
          // they kick and wriggle (and sometimes bite your finger)
          if (r.alive && r.ko <= 0 && r.frozen <= 0) {
            if (Math.random() < dt * 8) r.body.impulse(r.body.P(rand.pick([J.lFt, J.rFt, J.lHa, J.rHa]), _v.clone()), _v2.set((rand() - 0.5), rand() * 0.5, (rand() - 0.5)).multiplyScalar(r.height * 4), r.height * 0.3);
            if ((r.op < -20 || r.has('brave') || r.has('hothead')) && Math.random() < dt * 0.25) { sfx('bite', { vol: 0.5 }); g.toast(`${r.name} bit your finger! (It doesn't hurt.)`); r.say(rand.pick(['*CHOMP*', 'Take that!', 'Let me go!']), { kind: 'angry' }); }
            // a strong or brave one can wriggle free if you're not squeezing
            if (this.squeeze < 0.1 && (r.has('strong') || r.has('brave')) && Math.random() < dt * 0.03) { g.toast(`${r.name} wriggled out of your hand!`); this.drop(true); return; }
          }
        }
      } else if (h.kind === 'item') { r.pos.copy(hp).add(_v.set(0, -r.radius * 0.4, 0)); r.mesh.position.copy(r.pos); }
      else if (h.kind === 'bug') { r.pos.copy(hp).add(_v.set(0, -r.size * 0.2, 0)); r.mesh.position.copy(r.pos); }
      else if (h.kind === 'car') { r.pos.copy(hp).add(_v.set(0, -r.length * 0.2, 0)); r.syncMesh(); }
    }
    // bottle contents ride along
    if (this.bottle.length) {
      this.bottleMesh.updateWorldMatrix(true, false);
      const S = this.view === 'first' ? 1 : 0;
      for (const b of this.bottle) {
        const local = new THREE.Vector3(b.off.x, -0.085, b.off.z);
        const w = S ? this.bottleMesh.localToWorld(local) : this.body.P(J.lHa, new THREE.Vector3());
        if (b.kind === 'person') {
          const p = b.ref;
          p.body.bounds = { x0: w.x - 0.04 * this.scale, x1: w.x + 0.04 * this.scale, z0: w.z - 0.04 * this.scale, z1: w.z + 0.04 * this.scale, y1: w.y + 0.17 * this.scale };
          p.body.groundFn = () => w.y;
          p.pos.copy(w);
          if (p.body.mode !== 'rag') p.body.ragdoll(0.3);
          p.body.simulate(dt, p.gEff, 20);
          p.body.groundFn = (x, z, y) => g.groundAt(x, z, y, p);
        } else if (b.kind === 'item') { b.ref.pos.copy(w); b.ref.mesh.position.copy(w); }
        else if (b.kind === 'bug') { b.ref.pos.copy(w); b.ref.mesh.position.copy(w); }
      }
    }
  }

  // ------------------------------------------------------------- fighting when you're small
  melee(aim) {
    const g = this.game;
    const hit = g.pick(aim.origin, aim.dir, this.height * 0.75, { notPlayer: true });
    this.punchAnim();
    if (!hit || (hit.kind !== 'person' && hit.kind !== 'bug')) return;
    const r = hit.ref;
    const w = this.weapon;
    const dmg = w ? w.def.weapon.dmg * (0.8 + rand() * 0.4) : 7 * (FORMS[this.form].punch || 1) * (0.8 + rand() * 0.4);
    const type = w ? w.def.weapon.type : 'blunt';
    if (hit.kind === 'person') {
      if (r.kid) { g.toast('You won\'t hit a kid.'); return; }
      r.hurt({ dmg, type, from: 'player', point: hit.point, dir: aim.dir.clone().setY(0.3).normalize() });
      if (!r.alive) g.feed(`You killed ${r.name}${w ? ' with a ' + w.def.label.toLowerCase() : ' with your bare hands'}`, 'bad', r);
    } else r.hurt(dmg, { name: 'you', pos: this.pos, alive: true }, type);
    sfx(type === 'blade' ? 'slice' : 'hit', { pitch: 1.3 });
  }

  creatureAttack(aim) {
    const g = this.game;
    const hit = g.pick(aim.origin, aim.dir, this.height * 1.2, { notPlayer: true });
    this.punchAnim();
    sfx('slice', { pitch: 0.8 });
    if (!hit || hit.kind !== 'person' && hit.kind !== 'bug') return;
    if (hit.kind === 'person') {
      if (hit.ref.kid) return;
      hit.ref.hurt({ dmg: this.form === 'mantis' ? 38 : 16, type: this.form === 'mantis' ? 'bite' : 'blade', from: 'player', point: hit.point, dir: aim.dir.clone() });
    } else hit.ref.hurt(20, null, 'blade');
  }

  punchAnim() { this.punchT = 0.25; }

  // ------------------------------------------------------------- getting hurt
  takeHit(dmg, from, type) {
    const g = this.game;
    if (this.form === 'robot') dmg *= 0.5;
    this.health -= dmg;
    this.camShake = Math.max(this.camShake, 0.3);
    g.ui.hurtFlash(dmg);
    if (from && from.name) { this.lastHitBy = from; this.lastHitT = g.time; }
    sfx('hit', { vol: 0.6, pitch: 0.8 });
    if (type === 'blade' || type === 'pierce' || type === 'shot') g.fx.blood(this.eye.clone().add(_v.set(0, -this.height * 0.3, 0)), null, this.height, 0.4, settings.gore !== 'none');
    if (this.health <= 0) this.die(from, type);
  }

  // the tiny people hitting your giant finger
  handHit(p, dmg) {
    const g = this.game;
    sfx('hit', { vol: 0.3, pitch: 2 });
    if (dmg > 15 && this.holding) { g.toast(`${p.name} stabbed your finger! You let go.`); this.drop(true); }
    else if (Math.random() < 0.3) g.toast(`${p.name} is attacking your hand!`);
    this.camShake = Math.max(this.camShake, 0.05);
  }

  knock(v) { this.vel.add(v.multiplyScalar(this.height * 3)); this.onGround = false; }

  die(from, type) {
    const g = this.game;
    const mode = settings.cageDeath;
    const where = this.inCage ? 'cage' : 'world';
    g.feed(from && from.name ? `${from.name} killed you!` : 'You died.', 'bad');
    if (from && from.name && from.remember) { from.remember('killedGiant', 'I killed the giant!', 50, 'player'); from.title = from.title || 'Giant Slayer'; }
    if (where === 'cage' && mode === 'keepgear') g.dropGearInCage(this.pos.clone());
    if (mode === 'permadeath') { g.gameOver(from); return; }
    this.respawn('lab');
  }

  respawn(where) {
    const g = this.game;
    this.drop(true);
    this.health = 100;
    this.setScale(1); this.targetScale = 1;
    this.pos.set(0, 0, 2.6); this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = -0.2;
    g.ui.fade(() => g.toast('You woke up in the lab.'));
    void where;
  }

  randomTeleport() { this.pos.add(_v.set((rand() - 0.5) * this.height * 6, this.height, (rand() - 0.5) * this.height * 6)); }

  swapWith(t) {
    const g = this.game;
    const size = g.gadgets.sizeOf(t);
    if (size > this.height * 4 || size < this.height / 4) { g.toast('Too different in size to swap.'); sfx('fizzle'); return; }
    const mine = this.pos.clone();
    const theirs = t.kind === 'person' ? t.ref.pos.clone() : t.ref.pos.clone();
    this.pos.copy(theirs).add(_v.set(0, this.height * 0.1, 0));
    g.moveEntity(t, mine);
    sfx('teleport');
  }

  // ------------------------------------------------------------- items to and from people
  offerItemTo(p) {
    const h = this.holding;
    return !!(h && h.kind === 'item' && h.ref.size < p.height * 1.5);
  }

  giveItemTo(p) {
    const g = this.game;
    const h = this.holding;
    if (!h || h.kind !== 'item') return;
    const it = h.ref;
    this.holding = null; it.heldBy = null;
    if (it.def.weapon || it.def.kind === 'tool') { if (p.holding) g.dropHeld(p); g.giveHeld(p, it); }
    else { it.pos.copy(p.pos); it.rest = false; g.onItemDropped(it); }
    p.op = clamp(p.op + 4, -100, 100);
    p.remember('gift', `The giant gave me a ${it.def.label.toLowerCase()}`, 6, 'player');
  }

  receiveFrom(p) {
    const g = this.game;
    const it = p.holding;
    if (!it) return;
    g.dropHeld(p);
    if (!this.holding && this.tool === 'hand') { this.holding = { kind: 'item', ref: it }; it.heldBy = 'player'; }
  }

  // ------------------------------------------------------------- needs (setting)
  updateNeeds(dt) {
    if (!settings.yourNeeds || FORMS[this.form].noNeeds) return;
    const n = this.needs;
    const day = 960;
    n.hunger = Math.max(0, n.hunger - dt * this.game.world.speed * 100 / (1.5 * day));
    n.thirst = Math.max(0, n.thirst - dt * this.game.world.speed * 100 / (1 * day));
    n.energy = Math.max(0, n.energy - dt * this.game.world.speed * 100 / (1.2 * day));
    if (n.hunger <= 0 || n.thirst <= 0) { this.health -= dt * 0.5; if (this.health <= 0) this.die(null, 'starve'); }
  }

  // ------------------------------------------------------------- model + camera
  animateModel(dt) {
    const third = this.view === 'third';
    const b = this.body;
    this.anim.at += dt;
    const st = this._st || (this._st = { pos: new THREE.Vector3() });
    st.pos.copy(this.pos); st.yaw = this.yaw + Math.PI; st.phase = this.anim.phase; st.speed = Math.min(2.2, this.anim.speed);
    st.action = this.punchT > 0 ? 'punch' : this.holding ? 'carry' : this.bp ? 'aim' : null;
    st.at = this.punchT > 0 ? 0.25 - this.punchT : this.anim.at;
    st.crouch = this.anim.crouch; st.air = this.anim.air; st.lying = false;
    poseTargets(b, st);
    b.ground = this.pos.y;
    b.simulate(Math.min(dt, 1 / 30), this.gEff, 24);
    b.lookYaw = 0; b.lookPitch = this.pitch;
    const showBody = third && !this.creature;
    if (showBody) b.render(this.game.time); else b.hideAll();
    if (this.creature) {
      this.creature.visible = third;
      const unit = this.creature.userData.unit || 1;
      this.creature.scale.setScalar(this.height / (unit * 0.45));
      this.creature.position.copy(this.pos);
      this.creature.rotation.y = this.yaw + Math.PI;
    }
    this.vm.visible = !third;
    // first person hand animation
    if (!third) {
      const pinchT = this.holding ? 1 : 0;
      this.pinch = damp(this.pinch, pinchT, 14, dt);
      const fist = this.punchT > 0 ? 1 : this.bp ? 0.85 : this.potion ? 0.6 : 0;
      this.fingers.forEach((f, i) => {
        const curl = f.thumb ? 0.2 + this.pinch * 0.6 : (i === 0 ? this.pinch * 1.1 : this.pinch * 0.4) + fist * 1.3 + this.grip * 0.4;
        f.base.rotation.x = -curl * 0.9;
        f.knuckle.rotation.x = -curl * 1.1;
        if (f.thumb) f.base.rotation.y = 0.9 - this.pinch * 0.5;
      });
      const sway = Math.sin(this.bob * 2) * 0.006 * Math.min(1, this.anim.speed);
      const rec = (this.recoil = Math.max(0, (this.recoil || 0) - dt * 6));
      const punch = this.punchT > 0 ? Math.sin((0.25 - this.punchT) / 0.25 * Math.PI) * 0.12 : 0;
      this.hand.position.set(0.16 + sway, -0.17 + Math.abs(sway) - this.inspect * 0.02, -0.32 + rec * 0.04 - punch);
      this.hand.rotation.set(0.15 + rec * 0.25 + this.inspect * 0.3, -0.12 - this.inspect * 0.4, this.tool === 'bottle' ? 0.2 : 0);
      this.vm.scale.setScalar(this.scale * this.look.height);
      if (this.gadgetMesh) for (const c of this.gadgetMesh.children) if (c.userData.core) for (const o of c.children) if (o.userData.spin) { o.rotation.y += dt * 2; o.rotation.x += dt * 0.6; }
      this.lidMesh.visible = this.bottleLid;
      this.handMat.color.setHex(this.form === 'robot' ? 0x8a9298 : this.form === 'alien' ? 0x6ad06a : this.disguise ? this.look.skin : 0x2fa38a);
    }
  }

  updateCamera(dt) {
    const c = this.camera;
    const H = this.height;
    c.near = clamp(H * 0.012, 0.00003, 0.08);
    c.far = clamp(H * 500, 30, 1500);
    c.updateProjectionMatrix();
    this.camShake = Math.max(0, this.camShake - dt * 2);
    const sh = this.camShake * H * 0.02;
    const eye = this.eye;
    const bob = this.view === 'first' && this.onGround ? Math.abs(Math.sin(this.bob)) * H * 0.012 * Math.min(1, this.anim.speed) : 0;
    if (this.view === 'first') {
      c.position.set(eye.x + (Math.random() - 0.5) * sh, eye.y + bob + (Math.random() - 0.5) * sh, eye.z);
      c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else {
      const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
      const head = eye.clone();
      let dist = H * 1.6;
      const hit = this.game.world.colliders.raycast(head, back, dist);
      if (hit) dist = Math.max(H * 0.2, hit.dist - H * 0.1);
      if (this.inCage) { const ch = this.game.cage.raycast(head, back, dist); if (ch !== null) dist = Math.max(H * 0.2, ch - H * 0.1); }
      c.position.copy(head).addScaledVector(back, dist).add(_v.set(Math.cos(this.yaw) * H * 0.25, H * 0.08, -Math.sin(this.yaw) * H * 0.25));
      c.lookAt(head.clone().addScaledVector(back, -H * 2));
    }
  }

  // ------------------------------------------------------------- changer
  changeForm(form, copyOf = null) {
    const g = this.game;
    this.drop(true);
    this.form = form;
    const base = g.customLook ? scientistLook(g.customLook) : scientistLook();
    this.disguise = null;
    if (form === 'scientist') this.look = base;
    else if (form === 'robot') this.look = { ...base, skin: 0x8a9298, hair: 'bald', hairColor: 0x333333, shirt: 0x4a5258, pants: 0x3a4248, gloves: 0x6a7278, coat: null, goggles: true, eyes: 0x60ffff, beard: false, pack: 0x2a3238 };
    else if (form === 'alien') this.look = { ...base, skin: 0x7ad07a, hair: 'bald', headScale: 1.4, eyeSize: 1.8, eyes: 0x000000, coat: 0xd8d8f0, goggles: false, beard: false, gloves: 0x7ad07a };
    else if (form === 'person' && copyOf) { this.look = { ...copyOf.look }; this.disguise = { name: copyOf.name, id: copyOf.id, person: copyOf }; }
    else if (form === 'stranger') { this.look = { ...g.randomLook(), }; this.disguise = { name: g.randomName(this.look.sex), id: null }; }
    else this.look = base;
    const keepScale = this.scale;
    this.buildModel();
    this.body.rescale(keepScale);
    g.fx.burst(this.eye.clone(), [0xd040ff, 0x63e6be], 30, this.height, 1.2, { glow: true });
    sfx('teleport', { pitch: 0.7 });
    g.toast(`You are now: ${FORMS[form].label}${this.disguise ? ' (' + this.disguise.name + ')' : ''}`);
    if (!FORMS[form].gadgets && this.slot > 1) this.select(0);
  }

  revealDisguise(p) {
    const g = this.game;
    if (!this.disguise) return;
    g.feed(`${p.name} found out you're the giant`, 'bad', p);
    for (const o of g.peopleNear(p.pos, p.height * 20)) if (o.alive && !o.kid) { o.fear = Math.min(100, o.fear + 30); o.remember('reveal', 'The giant was hiding among us', -10, 'player'); }
  }

  // ------------------------------------------------------------- possession (mind headband, body mode)
  updatePossess(dt) {
    const g = this.game;
    const p = this.possess;
    if (!p || !p.alive) { this.possess = null; g.toast('Possession ended.'); return; }
    if (input.locked && !g.ui.modalOpen) { this.yaw -= input.mouse.dx * 0.0022 * settings.sensitivity; this.pitch = clamp(this.pitch - input.mouse.dy * 0.0022 * settings.sensitivity, -1.2, 1.2); }
    let fx = 0, fz = 0;
    if (!input.typing && !g.ui.modalOpen) { if (act('forward')) fz -= 1; if (act('back')) fz += 1; if (act('left')) fx -= 1; if (act('right')) fx += 1; }
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const wx = fx * c + fz * s, wz = -fx * s + fz * c;
    p.task = null; p.order = null; p.asleep = false;
    if (wx || wz) { p.goal = p.pos.clone().add(_v.set(wx, 0, wz).multiplyScalar(p.height * 3)); p.path = null; p.run = act('sprint'); } else p.stop();
    if (input.mouse.leftPressed) {
      const aim = { origin: p.headPos(new THREE.Vector3()), dir: new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)) };
      const t = g.pick(aim.origin, aim.dir, p.height * 1.2, { exclude: p });
      p.anim.action = 'swing'; p.anim.at = 0;
      if (t && t.kind === 'person' && !t.ref.kid) {
        const w = p.holding && p.holding.def.weapon ? p.holding.def.weapon : { type: 'blunt', dmg: 8 };
        t.ref.hurt({ dmg: w.dmg, type: w.type, from: p, point: t.point, dir: aim.dir });
        if (!t.ref.alive) g.feed(`${p.name} (controlled by you) killed ${t.ref.name}`, 'bad', p);
      }
    }
    if (actPressed('interact') || input.pressed.has('Escape')) { this.possess = null; p.remember('mind', 'Someone was inside my head. I did things I didn\'t want to.', -30, 'player'); g.toast(`You left ${p.name}'s body.`); return; }
    // camera behind the possessed person
    const head = p.headPos(new THREE.Vector3());
    const back = new THREE.Vector3(Math.sin(this.yaw), 0.35, Math.cos(this.yaw)).normalize();
    this.camera.position.copy(head).addScaledVector(back, p.height * 1.6);
    this.camera.lookAt(head);
    this.camera.near = clamp(p.height * 0.01, 0.00003, 0.05);
    this.camera.far = clamp(p.height * 600, 10, 1500);
    this.camera.updateProjectionMatrix();
    this.vm.visible = false;
    this.body.hideAll();
    this.yawTarget = Math.atan2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    p.yaw += angleDiff(p.yaw, this.yawTarget) * Math.min(1, dt * 8);
  }

  save() { return { pos: this.pos.toArray(), yaw: this.yaw, pitch: this.pitch, scale: this.scale, form: this.form, health: this.health, needs: this.needs, view: this.view, slot: this.slot }; }
  load(d) {
    this.pos.fromArray(d.pos); this.yaw = d.yaw; this.pitch = d.pitch; this.view = d.view || 'first';
    this.health = d.health ?? 100; Object.assign(this.needs, d.needs || {});
    this.form = d.form && FORMS[d.form] && !FORMS[d.form].disguise ? d.form : 'scientist';
    this.changeFormQuiet();
    this.setScale(d.scale || 1); this.targetScale = this.scale;
    this.slot = d.slot || 0;
    this.setGadgetMesh();
  }
  changeFormQuiet() { const f = this.form; const g = this.game; const base = g.customLook ? scientistLook(g.customLook) : scientistLook(); this.look = f === 'scientist' ? base : this.look; this.buildModel(); }
}

const _eye = new THREE.Vector3();

function buildCat() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 });
  const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, fur); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  add(new THREE.SphereGeometry(0.1, 14, 10), 0, 0.17, 0, 0.8, 0.7, 1.6);
  add(new THREE.SphereGeometry(0.07, 14, 10), 0, 0.25, 0.17);
  for (const s of [-1, 1]) { add(new THREE.ConeGeometry(0.025, 0.05, 6), s * 0.035, 0.32, 0.17); add(new THREE.CylinderGeometry(0.015, 0.012, 0.13, 6), s * 0.04, 0.065, 0.1); add(new THREE.CylinderGeometry(0.015, 0.012, 0.13, 6), s * 0.04, 0.065, -0.1); }
  const tail = add(new THREE.CylinderGeometry(0.012, 0.008, 0.2, 6), 0, 0.25, -0.2); tail.rotation.x = -0.8;
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc0ff60, emissive: 0x405010 })); e.position.set(s * 0.025, 0.27, 0.23); g.add(e); }
  g.userData.unit = 0.18;
  return g;
}

export { TINY };
