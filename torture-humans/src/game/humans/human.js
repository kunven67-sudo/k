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
    this.agent.updateParameters({ maxSpeed: run ? 3.2 : 1.35 });
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

  syncFromAgent(dt) {
    const p = this.agent.position();
    const v = this.agent.velocity();
    const root = this.character.root;
    // the navmesh floats a few cm above the real floor: stand on the real floor
    const hit = this.physics.raycast({ x: p.x, y: p.y + 0.6, z: p.z }, { x: 0, y: -1, z: 0 }, 1.2);
    root.position.set(p.x, hit ? hit.point.y : p.y, p.z);
    const speed = Math.hypot(v.x, v.z);
    if (speed > 0.15) {
      const want = Math.atan2(v.x, v.z); // Rocketbox faces +Z
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-dt * 8));
    }
    root.rotation.set(0, this.yaw, 0);
    this.character.speed = speed;
  }

  update(dt) {
    if (!this.alive) return;
    this.think(dt);
    this.syncFromAgent(dt);
    this.updateFace();
    this.character.update(dt, {
      groundAt: (x, y, z) => {
        const hit = this.physics.raycast({ x, y, z }, { x: 0, y: -1, z: 0 }, 1.2);
        return hit ? hit.point.y : null;
      },
    });
  }

  dispose(scene) {
    this.nav.removeAgent(this.agent);
    scene.remove(this.character.root);
    this.alive = false;
  }
}
