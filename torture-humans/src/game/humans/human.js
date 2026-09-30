// A townsperson: Rocketbox body + mocap animation + crowd navigation + a brain.
// Movement comes from the navmesh crowd agent (steers around people and walls);
// the animation speed follows the agent's real velocity, so feet never slide.
import * as THREE from 'three';
import { Character } from '../engine/anim.js';

const IDLE_GESTURES = ['idle_look_around_01', 'idle_look_around_02', 'idle_scratch_head_01', 'idle_stretch_arms_01', 'idle_touch_face_01', 'idle_yawn_01', 'cell_phone_textmessage', 'idle_waiting_01'];

let nextId = 1;

export class Human {
  constructor({ template, lib, nav, physics, scene, gender = 'm', profile = {}, position, area = null }) {
    this.area = area; // optional limit for wandering: (point) => boolean
    this.id = nextId++;
    this.profile = {
      name: profile.name || `Person ${this.id}`,
      job: profile.job || 'none',
      personality: { bravery: 0.5, friendliness: 0.5, curiosity: 0.5, temper: 0.5, ...(profile.personality || {}) },
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
        // sometimes do a little something while standing around
        if (Math.random() < 0.6) this.character.play(IDLE_GESTURES[(Math.random() * IDLE_GESTURES.length) | 0]);
      }
      return;
    }
    if (this.state === 'idle' && this.timer <= 0) {
      const p = this.nav.randomPoint(this.area);
      if (p) this.goTo(p);
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
    this.agent?.updateParameters({ radius: Math.max(0.02, 0.3 * s), height: 1.8 * s, maxSpeed: 1.35 * s });
  }

  captureInto(jar) {
    this.captured = true;
    this.state = 'jar';
    this.nav.removeAgent(this.agent);
    this.agent = null;
    this.physics.removeCapsule(this.capsule);
    this.capsule = null;
    // stand on the jar's floor (jar is 1:1 scale; we are tiny inside it)
    jar.add(this.character.root);
    this.character.root.position.set(0, 0.004, 0);
    this.character.root.scale.setScalar(this.scale / (jar.scale.x || 1));
    this.character.speed = 0;
    this.character.play('idle_nervous_01', { loop: true });
  }

  // dropped into the terrarium: wander inside its bounds (the full tiny-world AI lives in cage.js)
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
    const root = this.character.root;
    const b = this.cage.bounds; // local-space box of the soil surface
    this.timer -= dt;
    if (!this.cageTarget && this.timer <= 0) {
      this.cageTarget = new THREE.Vector3(
        THREE.MathUtils.lerp(b.min.x + 0.03, b.max.x - 0.03, Math.random()), b.max.y,
        THREE.MathUtils.lerp(b.min.z + 0.03, b.max.z - 0.03, Math.random()),
      );
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
    root.position.y = b.max.y;
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
    const hit = this.physics.raycast({ x: p.x, y: p.y + 0.6, z: p.z }, { x: 0, y: -1, z: 0 }, 1.2, { exclude: this.capsule?.collider });
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
    if (this.state === 'jar') { this.updateFace(); this.character.update(dt); return; }
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
        const hit = this.physics.raycast({ x, y, z }, { x: 0, y: -1, z: 0 }, 1.2, { exclude: this.capsule.collider });
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
