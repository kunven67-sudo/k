// A townsperson: Rocketbox body + mocap animation + crowd navigation + a brain.
// Movement comes from the navmesh crowd agent (steers around people and walls);
// the animation speed follows the agent's real velocity, so feet never slide.
import * as THREE from 'three';
import { Character } from '../engine/anim.js';
import { GROUP, groups } from '../engine/physics.js';
import { Life } from './life.js';

// feet find the floor: only the world and furniture count (not people, not you)
const FLOOR = groups(GROUP.NPC, GROUP.WORLD | GROUP.PROP);

const IDLE_GESTURES = ['idle_look_around_01', 'idle_look_around_02', 'idle_scratch_head_01', 'idle_stretch_arms_01', 'idle_touch_face_01', 'idle_yawn_01', 'cell_phone_textmessage', 'idle_waiting_01'];

let nextId = 1;

export class Human {
  constructor({ template, lib, nav, physics, scene, gender = 'm', profile = {}, position, area = null, settings = null }) {
    this.area = area; // optional limit for wandering: (point) => boolean
    this.id = nextId++;
    this.profile = {
      name: profile.name || `Person ${this.id}`,
      job: profile.job || 'none',
      // everyone is different: some are brave, some hot-headed, some shy
      personality: { bravery: Math.random(), friendliness: Math.random(), curiosity: Math.random(), temper: Math.random(), ...(profile.personality || {}) },
    };
    this.character = new Character(template, lib, { gender });
    this.nav = nav;
    this.physics = physics;
    scene.add(this.character.root);
    this.agent = nav.addAgent(position, { maxSpeed: 1.35 + (Math.random() - 0.5) * 0.25 });
    this.capsule = physics.addKinematicCapsule(this, { radius: 0.26, height: 1.75, position });
    this.scale = 1;
    this.yaw = Math.random() * Math.PI * 2;
    this.emotion = { fear: 0, joy: 0.2, anger: 0, sadness: 0 };
    this.state = 'idle';
    this.timer = 1 + Math.random() * 3;
    this.target = null;
    this.alive = true;
    this.character.root.userData.human = this;
    this.life = new Life(this.character, settings);
    this.syncFromAgent(1);
  }

  get position() {
    return this.character.root.position;
  }

  goTo(p, { run = false } = {}) {
    const q = this.nav.closest(p);
    if (!q) return false;
    this.agent.updateParameters({ maxSpeed: (run ? 3.2 : 1.35) * this.scale });
    this.agent.requestMoveTarget(q);
    this.target = new THREE.Vector3(q.x, q.y, q.z);
    this.state = 'walking';
    this.character.stopOneShot();
    return true;
  }

  // the dominant feeling shows on the face
  updateFace() {
    const e = this.emotion;
    const top = Object.entries(e).sort((a, b) => b[1] - a[1])[0];
    const map = { fear: e.fear > 0.75 ? 'terrified' : 'scared', joy: 'happy', anger: 'angry', sadness: 'sad' };
    if (top[1] < 0.25) this.character.setEmotion('neutral');
    else this.character.setEmotion(map[top[0]], Math.min(1, top[1]));
  }

  think(dt) {
    this.timer -= dt;
    if (this.state === 'walking') {
      const pos = this.agent.position();
      if (this.target && Math.hypot(pos.x - this.target.x, pos.z - this.target.z) < 0.35) {
        this.agent.resetMoveTarget();
        this.state = 'idle';
        this.timer = 2 + Math.random() * 5;
        const spot = this.spot;
        this.spot = null;
        if (spot) {
          // at a place: face it and do what people do there
          if (spot.face) this.faceYaw = Math.atan2(spot.face.x, spot.face.z);
          const acts = {
            shop: ['idle_waiting_01', 'idle_look_around_01', 'gestic_thoughtful_01', 'idle_touch_face_01'],
            door: ['knock_door', 'idle_waiting_02', 'try_door_outwards'],
            phone: ['cell_phone_textmessage', 'cell_phone_talk_01', 'cell_phone_listen_01'],
            look: ['idle_look_around_02', 'idle_stretch_arms_01', 'idle_neutral_02'],
          }[spot.act] || IDLE_GESTURES;
          this.character.play(acts[(Math.random() * acts.length) | 0]);
          this.timer = 4 + Math.random() * 8;
        } else if (Math.random() < 0.6) {
          // sometimes do a little something while standing around
          this.character.play(IDLE_GESTURES[(Math.random() * IDLE_GESTURES.length) | 0]);
        }
      }
      return;
    }
    if (this.state === 'idle') {
      if (this.faceYaw !== undefined) {
        let d = this.faceYaw - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-dt * 4));
      }
      if (this.timer > 0) return;
      this.faceYaw = undefined;
      // most of the time somewhere with a reason (a shop, a door, a bench), sometimes just a stroll
      const spot = this.spots?.length && Math.random() < 0.65 ? this.spots[(Math.random() * this.spots.length) | 0] : null;
      const p = spot ? spot.p : this.nav.randomPoint(this.area);
      if (p && this.goTo(p)) this.spot = spot;
      else this.timer = 2;
    }
  }

  // ---- shrinking, jar, cage

  shrink(to = 0.05, { power = 1 } = {}) {
    if (this.shrinking || this.tiny) return;
    this.shrinking = { from: this.scale, to, t: 0, d: 1.6 - power * 0.4 };
    this.emotion.fear = 1;
    this.character.stopOneShot(0.1);
    this.agent.resetMoveTarget();
  }

  applyScale(s) {
    this.scale = s;
    this.character.root.scale.setScalar(s);
    this.physics.resizeCapsule(this.capsule, 1.75 * s, 0.26 * s);
    this.physics.setCapsuleGroup(this.capsule, s < 0.5 ? GROUP.TINY : GROUP.NPC);
    this.agent?.updateParameters({ radius: Math.max(0.02, 0.3 * s), height: 1.8 * s, maxSpeed: 1.35 * s });
  }

  captureInto(jar, { watcher = null } = {}) {
    // scooped out of the terrarium: they leave the colony (dropping what they carry)
    if (this.state === 'caged') this.cage?.colony?.leave(this);
    this.cage?.residents?.delete(this);
    this.watcher = watcher; // the camera: they turn to face you and bang on the glass on your side
    this.jarTimer = 0.8;
    this.captured = true;
    this.state = 'jar';
    if (this.agent) this.nav.removeAgent(this.agent);
    this.agent = null;
    if (this.capsule) this.physics.removeCapsule(this.capsule);
    this.capsule = null;
    this.character.root.rotation.set(0, this.yaw, 0);
    // stand on the jar's floor (jar is 1:1 scale; we are tiny inside it)
    jar.add(this.character.root);
    this.character.root.position.set(0, 0.004, 0);
    this.character.root.scale.setScalar(this.scale / (jar.scale.x || 1));
    this.character.speed = 0;
    this.character.play('idle_nervous_01', { loop: true });
  }

  // Trapped in a jar: face whoever holds it, bang on the glass, wave for help, yell.
  updateJar(dt) {
    const root = this.character.root;
    const jar = root.parent;
    this.emotion.fear = Math.min(1, this.emotion.fear + dt * 0.05);
    this.emotion.anger = Math.min(0.8, this.emotion.anger + dt * 0.03);
    if (this.watcher && jar) {
      // turn toward the camera (in the jar's space) and stand at the glass on that side
      const local = jar.worldToLocal(this.watcher.getWorldPosition(new THREE.Vector3()));
      const want = Math.atan2(local.x, local.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * 4));
      root.rotation.set(0, this.yaw, 0);
      const r = (jar.userData.r || 0.065) * 0.62;
      const dir = new THREE.Vector3(local.x, 0, local.z).normalize().multiplyScalar(r);
      root.position.lerp(new THREE.Vector3(dir.x, 0.004, dir.z), 1 - Math.exp(-dt * 2));
    }
    this.jarTimer -= dt;
    if (this.jarTimer <= 0) {
      const acts = ['knock_door', 'knock_door', 'wave_01', 'gestic_talk_angry_01', 'gestic_talk_nervous_01', 'idle_nervous_02'];
      const act = acts[(Math.random() * acts.length) | 0];
      this.character.play(act, { onDone: () => this.character.play('idle_nervous_01', { loop: true }) });
      this.jarTimer = 2.5 + Math.random() * 3;
    }
    this.updateFace();
    this.character.update(dt);
  }

  // Stepped on. gore: 'none' = knocked out cold, 'some' = flattened + blood, 'full' = more of it.
  squish(gore = 'some', { scene } = {}) {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    if (this.agent) { this.nav.removeAgent(this.agent); this.agent = null; }
    if (this.capsule) { this.physics.removeCapsule(this.capsule); this.capsule = null; }
    const root = this.character.root;
    this.character.stopOneShot(0);
    this.character.setEmotion(gore === 'none' ? 'neutral' : 'pain', 1);
    this.character.update(0.016);
    if (gore === 'none') {
      root.rotation.x = -Math.PI / 2; // lying flat, out cold
      root.position.y += 0.01 * this.scale;
    } else {
      root.scale.set(this.scale * 1.25, this.scale * 0.1, this.scale * 1.25); // flattened
    }
    this.onDeath?.(this, gore);
  }

  // Fell in the lava: gone in a moment, a charred shape and smoke left behind.
  burn() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.character.setEmotion('pain', 1);
    this.character.update(0.016);
    this.character.root.traverse((o) => {
      if (!o.isMesh) return;
      // charred: own copies of the materials (others wearing the same body stay normal)
      const charred = [].concat(o.material).map((m) => {
        const c = m.clone();
        c.color?.multiplyScalar(0.08);
        if (c.emissive) { c.emissive.set(0xff3a0a); c.emissiveIntensity = 0.6; }
        return c;
      });
      o.material = Array.isArray(o.material) ? charred : charred[0];
    });
    this.burning = 1.5; // glow fades out
    this.cage?.tiny?.smoke?.(this.character.root.position);
    this.onDeath?.(this, 'lava');
  }

  // Fell over dead (starved, dehydrated): slump onto the back and lie still.
  // groundY: the ground under them, in their parent's space.
  collapse(groundY) {
    this.fall = { t: 0, groundY };
  }

  // dropped into the terrarium: their life there is run by the colony (colony/colony.js)
  releaseInto(cage, point) {
    this.captured = false;
    this.state = 'caged';
    this.cage = cage;
    cage.group.attach(this.character.root);
    this.character.root.scale.setScalar(this.scale / cage.group.getWorldScale(new THREE.Vector3()).x);
    const local = cage.group.worldToLocal(point.clone());
    this.character.root.position.copy(local);
    this.character.stopOneShot(0.2);
    this.cageTarget = null;
    this.timer = 0.5;
  }

  updateCaged(dt) {
    if (this.cage.colony) { this.cage.colony.updateResident(this, dt); return; }
    const root = this.character.root;
    const b = this.cage.bounds; // local-space box of the soil surface
    this.timer -= dt;
    if (!this.cageTarget && this.timer <= 0) {
      for (let i = 0; i < 20 && !this.cageTarget; i++) {
        const x = THREE.MathUtils.lerp(b.min.x + 0.03, b.max.x - 0.03, Math.random());
        const z = THREE.MathUtils.lerp(b.min.z + 0.03, b.max.z - 0.03, Math.random());
        if (this.cage.isWalkable(x, z)) this.cageTarget = new THREE.Vector3(x, 0, z);
      }
      if (!this.cageTarget) this.timer = 1;
    }
    let speed = 0;
    if (this.cageTarget) {
      const to = this.cageTarget.clone().sub(root.position);
      to.y = 0;
      const d = to.length();
      const run = this.emotion.fear > 0.6;
      speed = (run ? 3.0 : 1.3) * this.scale;
      if (d < 0.01) { this.cageTarget = null; this.timer = 1 + Math.random() * 4; speed = 0; }
      else {
        root.position.addScaledVector(to.normalize(), Math.min(d, speed * dt));
        const want = Math.atan2(to.x, to.z);
        let dy = want - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * (1 - Math.exp(-dt * 8));
        root.rotation.set(0, this.yaw, 0);
      }
    }
    root.position.y = this.cage.surfaceY(root.position.x, root.position.z);
    if (this.cage.inLava(root.position.x, root.position.z)) { this.burn(); return; }
    if (this.cage.waterDepth(root.position.x, root.position.z) > 0.004) {
      this.emotion.fear = Math.min(1, this.emotion.fear + dt * 0.2);
      this.cage.tiny?.ripple?.(root.position, dt, this.id);
    }
    this.emotion.fear = Math.max(0.3, this.emotion.fear - dt * 0.02);
    this.character.speed = speed / this.scale;
    this.updateFace();
    this.character.update(dt);
  }

  syncFromAgent(dt) {
    const p = this.agent.position();
    const v = this.agent.velocity();
    const root = this.character.root;
    // the navmesh floats a few cm above the real floor: stand on the real floor
    const hit = this.physics.raycast({ x: p.x, y: p.y + 0.6, z: p.z }, { x: 0, y: -1, z: 0 }, 1.2, { exclude: this.capsule?.collider, filterGroups: FLOOR });
    root.position.set(p.x, hit ? hit.point.y : p.y, p.z);
    if (this.capsule) this.physics.placeCapsule(this.capsule, root.position);
    const speed = Math.hypot(v.x, v.z);
    if (speed > 0.15) {
      const want = Math.atan2(v.x, v.z); // Rocketbox faces +Z
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * 8));
    }
    root.rotation.set(0, this.yaw, 0);
    // clips are recorded at full size: a tiny person covering 5 cm/s is walking briskly
    this.character.speed = speed / this.scale;
    this.character.footIK = this.scale > 0.5;
  }

  update(dt) {
    if (!this.alive) return;
    this.updateMain(dt);
    // breathing, eye darts, face micro-movement, jiggle, flushing/paling/sweat (after the animation)
    if (this.state !== 'dead' && this.life) {
      const e = this.emotion;
      this.life.fear = e.fear; this.life.anger = e.anger; this.life.sad = e.sadness;
      this.life.update(dt);
    }
  }

  updateMain(dt) {
    if (this.state === 'dead') {
      if (this.fall && this.fall.t < 1) {
        const f = this.fall;
        f.t = Math.min(1, f.t + dt / 0.9);
        const e = f.t * f.t; // falls slowly at first, then hits the ground
        const root = this.character.root;
        root.rotation.set((-Math.PI / 2) * e, this.yaw, 0, 'YXZ');
        root.position.y = f.groundY + 0.1 * this.scale * e; // lying on the back, not in the ground
        this.character.update(dt);
        if (f.t >= 1) this.character.mixer.timeScale = 0;
      }
      if (this.burning > 0) {
        this.burning -= dt;
        const k = Math.max(0, this.burning / 1.5);
        this.character.root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.emissive) m.emissiveIntensity = 0.6 * k; });
      }
      return;
    }
    if (this.state === 'jar') { this.updateJar(dt); return; }
    if (this.state === 'caged') { this.updateCaged(dt); return; }
    if (this.shrinking) {
      const k = this.shrinking;
      k.t += dt;
      const u = Math.min(1, k.t / k.d);
      // shrink fast at first, then settle (like it's being squeezed down)
      const e = 1 - Math.pow(1 - u, 3);
      this.applyScale(THREE.MathUtils.lerp(k.from, k.to, e));
      if (u >= 1) {
        this.shrinking = null;
        this.tiny = true;
        // run away from whoever did it
        const away = this.nav.randomPoint((p) => Math.hypot(p.x - this.position.x, p.z - this.position.z) < 4 && Math.abs(p.y - this.position.y) < 0.5);
        if (away) this.goTo(away, { run: true });
      }
    }
    this.think(dt);
    this.syncFromAgent(dt);
    this.updateFace();
    this.character.update(dt, {
      groundAt: (x, y, z) => {
        const hit = this.physics.raycast({ x, y, z }, { x: 0, y: -1, z: 0 }, 1.2, { exclude: this.capsule?.collider, filterGroups: FLOOR });
        return hit ? hit.point.y : null;
      },
    });
  }

  dispose(scene) {
    if (this.capsule) this.physics.removeCapsule(this.capsule);
    if (this.agent) this.nav.removeAgent(this.agent);
    scene.remove(this.character.root);
    this.alive = false;
  }
}
