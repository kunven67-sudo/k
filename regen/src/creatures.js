// Creatures: real animated models + a small brain (wander, hunt, attack, flee, die).
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { CREATURES } from './catalog.js';
import { retargetClips, pinRoot } from './retarget.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const base = n => n.replace(/_\d+$/, '');

export class CreatureTypes {
  constructor(loader) { this.loader = loader; this.types = {}; this.loading = {}; }
  async get(key) {
    if (this.types[key]) return this.types[key];
    if (this.loading[key]) return this.loading[key];
    return (this.loading[key] = (async () => {
      const def = CREATURES[key];
      const g = await this.loader.loadAsync('assets/models/' + key + '.glb');
      let clips = g.animations.slice();
      if (def.borrow) {
        const src = await this.loader.loadAsync('assets/models/' + def.borrow + '.glb');
        const top = 'Pelvis';
        clips = clips.concat(retargetClips(src.animations, src.scene, g.scene, top, { keepPos: false }));
      }
      for (const c of clips) pinRoot(c, g.scene);
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.side = THREE.FrontSide; } } });
      // measure size in rest pose (first idle frame)
      const probe = skClone(g.scene); const inner = new THREE.Group(); inner.add(probe); probe.rotation.y = def.yaw || 0;
      const mx = new THREE.AnimationMixer(probe); const c0 = clips.find(c => c.name === (def.anim.idle || def.anim.walk || def.anim.run || def.anim.fly)) || clips[0];
      if (c0) { mx.clipAction(c0).play(); mx.update(0.3); }
      inner.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
      const scale = def.length ? def.length / size.z : def.height / size.y;
      const t = { key, def, gltf: g, clips, scale, box: box.clone(), size: size.clone().multiplyScalar(scale) };
      this.types[key] = t; return t;
    })());
  }
}

export class Creature {
  constructor(type, pos, mood, world) {
    const def = type.def; this.type = type; this.def = def; this.world = world; this.mood = mood;
    this.root = new THREE.Group(); this.root.position.copy(pos);
    this.model = skClone(type.gltf.scene); this.model.rotation.y = def.yaw || 0;
    this.inner = new THREE.Group(); this.inner.add(this.model); this.inner.scale.setScalar(type.scale);
    const bc = type.box.getCenter(new THREE.Vector3());
    this.inner.position.set(-bc.x * type.scale, -type.box.min.y * type.scale, -bc.z * type.scale);
    this.root.add(this.inner); world.scene.add(this.root);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clip = {}; for (const [role, name] of Object.entries(def.anim)) { const c = type.clips.find(c => c.name === name); if (c) this.clip[role] = c; }
    this.bones = {}; this.model.traverse(o => { if (o.isBone || o.type === 'Bone') this.bones[base(o.name)] = o; });
    this.gait = (def.gait || []).map(([h, k, f, ph]) => [this.bones[h], this.bones[k], this.bones[f], ph]).filter(l => l[0] && l[1]);
    this.hp = def.hp; this.yaw = Math.random() * 6.28; this.speed = 0; this.state = 'wander'; this.stateT = 0; this.cool = 1;
    this.target = null; this.aggro = null; this.heading = this.yaw; this.phase = 0; this.dead = false; this.deadT = 0;
    this.half = new THREE.Vector3(type.size.x / 2, type.size.y / 2, type.size.z / 2);
    this.radius = Math.max(0.3, Math.min(type.size.x, type.size.z) * 0.45);
    this.alt = def.flying ? 18 + Math.random() * 10 : 0; this.vy = 0; this.climb = 0;
    if (def.flying) this.root.position.y = Math.max(this.root.position.y, 6);
    this.cur = null; this.play(def.flying ? 'fly' : 'idle');
    this.soundT = 2 + Math.random() * 6; this.hitDone = false; this.roared = false;
    this.root.rotation.y = this.yaw;
  }
  get pos() { return this.root.position; }
  // pick a clip for a role, with fallbacks
  roleClip(role) {
    const c = this.clip;
    if (c[role]) return [c[role], 1];
    if (role === 'walk' && c.run) return [c.run, this.def.walkRate || 0.45];
    if (role === 'idle') { if (c.walk) return [c.walk, 0]; if (c.run) return [c.run, 0]; if (c.fly) return [c.fly, 1]; }
    if (role === 'run' && c.walk) return [c.walk, this.def.runRate || 1.8];
    if ((role === 'attack' || role === 'hurt' || role === 'die' || role === 'dead') && (c.idle || c.walk)) return [c.idle || c.walk, 1];
    if (role === 'walk' && c.idle) return [c.idle, 1];
    return [c.idle || c.walk || c.run || c.fly, 1];
  }
  play(role, { once = false, fade = 0.25, rate = 1 } = {}) {
    const [clip, r0] = this.roleClip(role); if (!clip) return;
    const a = this.mixer.clipAction(clip);
    if (this.cur === a && !once) { this.baseRate = r0 * rate; return; }
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.enabled = true; a.setEffectiveWeight(1);
    this.baseRate = r0 * rate; a.timeScale = this.baseRate;
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, fade, false); else a.play();
    a.play(); this.cur = a; this.role = role; this.realClip = clip === this.clip[role];
  }
  // ----- damage
  hurt(dmg, point, dir, from) {
    if (this.dead) return;
    this.hp -= dmg;
    const W = this.world;
    if (!this.def.bloodless) { W.fx.blood(point, dir, 18 + dmg * 0.3, 3); if (Math.random() < 0.5) W.fx.pool(point.x, point.z, 0.4); }
    else W.fx.dust(point);
    W.audio.play(Math.random() < 0.5 ? 'chit' : 'chit2', { pos: point, vol: 0.6, rate: 1.5 / Math.sqrt(this.def.length || 1.8) + 0.4 });
    if (from && from !== this) { this.aggro = from; if (this.mood === 'calm' && !this.def.timid) this.mood = 'hunt-aggro'; }
    if (this.hp <= 0) return this.die(dir);
    if (this.clip.hurt && Math.random() < 0.5 && this.state !== 'attack') { this.play('hurt', { once: true, fade: 0.1 }); this.state = 'hurt'; this.stateT = this.clip.hurt.duration * 0.8; }
    if (this.def.timid) { this.state = 'flee'; this.stateT = 6; }
  }
  die(dir) {
    this.dead = true; this.state = 'dead'; this.deadT = 0; this.world.onKill && this.world.onKill(this);
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    if (this.clip.die) this.play('die', { once: true, fade: 0.15 }); else if (this.cur) this.cur.timeScale = 0.2;
    this.world.audio.play(this.def.sounds[0], { pos: this.pos, vol: 0.7, rate: 0.8, far: 40 + (this.def.length || 2) * 6 });
  }
  // world-space ray test against the body box: returns distance or -1
  ray(origin, dir, max) {
    _m.copy(this.root.matrixWorld).invert();
    const o = _v.copy(origin).applyMatrix4(_m), d = _w.copy(dir).transformDirection(_m);
    const h = this.half, cy = h.y;
    const box = new THREE.Box3(new THREE.Vector3(-h.x * 0.8, cy - h.y * 0.85, -h.z * 0.85), new THREE.Vector3(h.x * 0.8, cy + h.y * 0.85, h.z * 0.85));
    const ray = new THREE.Ray(o, d); const p = ray.intersectBox(box, new THREE.Vector3());
    if (!p) return -1; const dist = p.applyMatrix4(this.root.matrixWorld).distanceTo(origin);
    return dist <= max ? dist : -1;
  }
  containsPoint(p, pad = 0) {
    _v.copy(p).applyMatrix4(_m.copy(this.root.matrixWorld).invert());
    const h = this.half;
    return Math.abs(_v.x) < h.x * 0.85 + pad && _v.y > -pad && _v.y < h.y * 2 + pad && Math.abs(_v.z) < h.z * 0.85 + pad;
  }
  dist2D(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }
  reach() { return this.def.attack.range + this.half.z * 0.5; }

  // ----- brain
  think(dt) {
    const W = this.world, def = this.def, P = W.player;
    this.stateT -= dt; this.cool -= dt;
    // who am I after?
    let tgt = null;
    const pd = this.dist2D(P.pos);
    if (this.aggro && !this.aggro.dead && (this.aggro === P || this.aggro.alive !== false)) tgt = this.aggro;
    if (!tgt) {
      if (this.mood === 'hunt' && pd < def.senses) tgt = P;
      if (this.mood === 'brawl') {
        let best = def.senses; for (const c of W.creatures) if (c !== this && !c.dead) { const d = this.dist2D(c.pos); if (d < best) { best = d; tgt = c; } }
        if (!tgt && pd < def.senses) tgt = P;
      }
    }
    if (this.aggro && this.aggro.dead) this.aggro = null;
    if (def.timid) { if (pd < 14 || this.state === 'flee') { if (this.state !== 'flee') { this.state = 'flee'; this.stateT = 6; } } tgt = null; }
    this.target = tgt;
    // first sight roar
    if (tgt && !this.roared && this.clip.roar && Math.random() < 0.6) { this.roared = true; this.state = 'roar'; this.stateT = Math.min(2.5, this.clip.roar.duration); this.play('roar', { once: true }); W.audio.play(def.sounds[0], { pos: this.pos, vol: 1, far: 40 + (def.length || 2) * 8 }); if (def.shake) W.shake(def.shake * Math.max(0, 1 - pd / 60)); }
    if (this.state === 'roar' || this.state === 'hurt') { this.speed = 0; if (this.stateT > 0) return; this.state = 'wander'; }
    if (this.state === 'attack') return this.attackTick(dt);
    if (def.flying) return this.flyThink(dt, tgt);
    let wantSpeed = 0, wantYaw = this.yaw, role = 'idle';
    if (this.state === 'flee') {
      const away = Math.atan2(this.pos.x - P.pos.x, this.pos.z - P.pos.z); wantYaw = away; wantSpeed = def.runSpeed * 0.8; role = 'run';
      if (this.stateT <= 0 && pd > 25) this.state = 'wander';
    } else if (tgt) {
      const tp = tgt.pos || tgt.group.position; const d = this.dist2D(tp);
      wantYaw = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
      const reach = this.reach() + (tgt.radius || 0.35);
      if (d <= reach && this.cool <= 0 && Math.abs(wrap(wantYaw - this.yaw)) < 0.6) return this.startAttack(tgt);
      if (d > reach * 0.9) { wantSpeed = d > 10 ? def.runSpeed : Math.max(def.speed, def.runSpeed * 0.6); role = 'run'; } else { wantSpeed = 0; role = 'idle'; }
    } else {
      // wander
      if (this.stateT <= 0) { this.stateT = 3 + Math.random() * 6; this.heading = this.yaw + (Math.random() - 0.5) * 2.5; this.rest = Math.random() < 0.35; }
      // stay in the world
      if (Math.hypot(this.pos.x, this.pos.z) > 160) this.heading = Math.atan2(-this.pos.x, -this.pos.z);
      wantYaw = this.heading; wantSpeed = this.rest ? 0 : def.speed; role = this.rest ? 'idle' : 'walk';
    }
    this.yaw += THREE.MathUtils.clamp(wrap(wantYaw - this.yaw), -def.turn * dt, def.turn * dt);
    this.speed += (wantSpeed - this.speed) * Math.min(1, dt * 3);
    if (this.speed < 0.15 && role !== 'idle') role = 'idle';
    this.play(role, { rate: role === 'walk' ? Math.max(0.5, this.speed / def.speed) : role === 'run' ? Math.max(0.6, this.speed / def.runSpeed) : 1 });
    if (this.cur && this.role === role) this.cur.timeScale = this.baseRate;
    // growl now and then
    this.soundT -= dt; if (this.soundT <= 0) { this.soundT = 5 + Math.random() * 10; if (tgt || Math.random() < 0.3) W.audio.play(def.sounds[Math.floor(Math.random() * def.sounds.length)], { pos: this.pos, vol: 0.7, far: 30 + (def.length || 2) * 5 }); }
  }
  startAttack(tgt) {
    const def = this.def; this.state = 'attack'; this.attTarget = tgt; this.hitDone = false; this.speed = 0;
    const dur = this.clip.attack ? Math.min(this.clip.attack.duration, (def.attack.clipSpan || [0, 99])[1]) : 0.7;
    this.attDur = dur; this.attT = 0;
    if (this.clip.attack) this.play('attack', { once: true, fade: 0.12 });
    if (Math.random() < 0.5) this.world.audio.play(def.sounds[Math.floor(Math.random() * def.sounds.length)], { pos: this.pos, vol: 0.8, rate: 1.1, far: 30 + (def.length || 2) * 5 });
  }
  attackTick(dt) {
    const def = this.def, A = def.attack, tgt = this.attTarget;
    this.attT += dt;
    const k = this.attT / this.attDur;
    // lunge forward for creatures without a real attack clip (or that pounce)
    if (A.lunge || !this.clip.attack) {
      const l = Math.sin(Math.min(1, k) * Math.PI);
      this.lunge = l; this.speed = (k < 0.5 ? 1 : -0.4) * l * def.runSpeed * 0.45;
    }
    if (!this.hitDone && k >= A.hitAt) {
      this.hitDone = true;
      const tp = tgt.pos || tgt.group.position;
      if (!tgt.dead && this.dist2D(tp) <= this.reach() + (tgt.radius || 0.35) + 0.6) this.world.creatureHits(this, tgt);
    }
    if (k >= 1) { this.state = 'chase'; this.cool = A.cooldown * (0.7 + Math.random() * 0.6); this.lunge = 0; }
  }
  flyThink(dt, tgt) {
    const def = this.def, W = this.world;
    let goal;
    this.climb -= dt;
    if (tgt && this.climb <= 0) {
      const tp = (tgt.pos || tgt.group.position);
      goal = _w.set(tp.x, tp.y + 1.0 + this.half.y * 0.3, tp.z);
      const d = goal.distanceTo(this.pos);
      if (d < this.reach() + 1 && this.cool <= 0) {
        W.creatureHits(this, tgt); this.cool = def.attack.cooldown; this.climb = 3.5;
        W.audio.play(def.sounds[0], { pos: this.pos, vol: 1, far: 80 });
      }
    } else {
      // circle
      this.orbit = (this.orbit || Math.random() * 6) + dt * (def.speed / 30);
      const c = tgt ? (tgt.pos || tgt.group.position) : (this.home ||= this.pos.clone());
      goal = _w.set(c.x + Math.cos(this.orbit) * 30, this.alt, c.z + Math.sin(this.orbit) * 30);
    }
    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z, dy = goal.y - this.pos.y;
    const wantYaw = Math.atan2(dx, dz);
    this.yaw += THREE.MathUtils.clamp(wrap(wantYaw - this.yaw), -def.turn * dt, def.turn * dt);
    this.speed += ((tgt && this.climb <= 0 ? def.runSpeed : def.speed) - this.speed) * Math.min(1, dt);
    this.vy += (THREE.MathUtils.clamp(dy, -8, 8) - this.vy) * Math.min(1, dt * 1.5);
    this.pitchT = THREE.MathUtils.clamp(-this.vy * 0.06, -0.5, 0.5);
    this.play('fly');
  }
  update(dt) {
    const def = this.def;
    if (this.dead) return this.deadTick(dt);
    this.think(dt);
    // move
    this.root.rotation.y = this.yaw;
    this.pos.x += Math.sin(this.yaw) * this.speed * dt; this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    if (def.flying) {
      this.pos.y = Math.max(1.5, this.pos.y + this.vy * dt);
      this.inner.rotation.x += ((this.pitchT || 0) - this.inner.rotation.x) * Math.min(1, dt * 2);
      this.inner.rotation.z = THREE.MathUtils.clamp(-(this.yawRate || 0) * 0.4, -0.5, 0.5);
    } else {
      this.world.physics.pushWalker(this.pos, this.radius * 0.7, this.half.y * 2);
      this.pos.y = 0;
    }
    this.mixer.update(dt);
    if (this.gait.length && !this.dead) this.legs(dt);
  }
  // legs moved by code for models with no walk clip
  legs(dt) {
    const def = this.def, sp = this.state === 'attack' ? Math.abs(this.speed) : this.speed;
    if (sp < 0.05) { this.gaitAmp = Math.max(0, (this.gaitAmp || 0) - dt * 3); } else this.gaitAmp = Math.min(1, (this.gaitAmp || 0) + dt * 3);
    if (this.gaitAmp <= 0) return this.plant();
    this.phase += dt * sp / def.gaitStride * Math.PI * 2;
    this.root.updateMatrixWorld(true);
    const right = _v.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); // creature's right in world
    const amp = def.gaitSwing * this.gaitAmp * Math.min(1.4, 0.6 + sp / def.runSpeed);
    const turn = (bone, ang) => {
      bone.parent.getWorldQuaternion(_q); const ax = _w.copy(right).applyQuaternion(_q.invert());
      _q2.setFromAxisAngle(ax.normalize(), ang); bone.quaternion.premultiply(_q2); bone.updateMatrixWorld(true);
    };
    for (let i = 0; i < this.gait.length; i++) {
      const [hip, knee, foot, ph] = this.gait[i];
      const a = this.phase + ph * Math.PI * 2, front = i < 2;
      turn(hip, Math.sin(a) * amp);
      const lift = Math.max(0, Math.cos(a));
      turn(knee, (front ? 1 : -1) * lift * amp * 1.4);
      if (foot) turn(foot, (front ? -1 : 1) * lift * amp * 0.8);
    }
    this.plant();
  }
  // stand on the feet (not on a hanging tail): lowest foot sits just above the ground
  plant() {
    this.root.updateMatrixWorld(true);
    let low = Infinity; for (const [, , foot] of this.gait) if (foot) low = Math.min(low, foot.getWorldPosition(_v).y);
    if (low === Infinity) return;
    const want = 0.06 * this.type.scale / this.type.scale * Math.max(1, this.half.y * 0.08);
    this.inner.position.y += (want - (low - this.pos.y)) * (this.planted ? 0.5 : 1); this.planted = true;
  }
  deadTick(dt) {
    this.deadT += dt;
    if (this.def.flying && this.pos.y > 0.1) { this.vy -= 9.81 * dt; this.pos.y = Math.max(0, this.pos.y + this.vy * dt); this.pos.x += Math.sin(this.yaw) * this.speed * dt; this.pos.z += Math.cos(this.yaw) * this.speed * dt; this.speed *= 0.98; if (this.pos.y <= 0) { this.world.fx.shake = Math.max(this.world.fx.shake, 0.4); } }
    if (!this.clip.die || this.def.flying) {
      // tip over onto a side
      const k = Math.min(1, this.deadT / 0.9);
      this.inner.rotation.z = this.fallDir * k * k * Math.PI / 2 * 0.95;
      this.inner.position.y = (-this.type.box.min.y * this.type.scale) * (1 - k) + this.half.x * 0.6 * k;
    } else if (this.clip.dead && this.cur && !this.cur.isRunning() && this.role === 'die') this.play('dead', { fade: 0.4 });
    this.mixer.update(dt);
    if (this.deadT > 90) { this.inner.position.y -= dt * 0.3; if (this.deadT > 96) this.remove(); }
  }
  remove() { this.removed = true; this.world.scene.remove(this.root); this.mixer.stopAllAction(); }
}
