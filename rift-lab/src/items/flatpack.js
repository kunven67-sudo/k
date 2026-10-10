// Flat-pack furniture arrives in a real cardboard box. Mouse only:
//  1. click the tape to cut it   2. drag the two flaps open
//  3. hold left-click on the parts inside to build it (time runs x60 while you work,
//     so a 45-minute loveseat takes about 45 seconds)
// Sometimes a screw is missing (like real life): one leg ends up a hair short and it wobbles.
// You're left with the flattened box afterwards.

import * as THREE from 'three';
import { getItem, buildSpec } from './catalog.js';
import { specBounds } from './builder.js';

const MISSING_SCREW_CHANCE = 0.12;

export function boxFor(itemId, chosen) {
  const it = getItem(itemId);
  const b = specBounds(buildSpec(it, chosen));
  const s = new THREE.Vector3(); b.getSize(s);
  const d = [s.x, s.y, s.z].sort((a, c) => c - a);
  return {
    L: Math.min(2.2, Math.max(0.45, d[0] * 1.02)),
    W: Math.min(0.85, Math.max(0.32, d[1] * 0.55)),
    H: Math.min(0.36, Math.max(0.09, d[2] * 0.33 + 0.05)),
    mass: (buildSpec(it, chosen).mass || 10) + 1.5,
    forId: itemId, forChosen: JSON.stringify(chosen || {}),
  };
}

export class FlatPack {
  constructor({ items, clock, audio, onMessage, onBuilt }) {
    this.items = items;
    this.clock = clock;
    this.audio = audio;
    this.onMessage = onMessage || (() => {});
    this.onBuilt = onBuilt || (() => {});
    this.working = null;
    this.savedFF = 1;
  }

  spawnBox(itemId, chosen, pose) {
    return this.items.spawn('flatbox', boxFor(itemId, chosen), pose);
  }

  flapsOpen(box) {
    const m = box.bodies.main.rotation();
    const qm = new THREE.Quaternion(m.x, m.y, m.z, m.w);
    return ['flapA', 'flapB'].every((n) => { const r = box.bodies[n].rotation(); return qm.angleTo(new THREE.Quaternion(r.x, r.y, r.z, r.w)) > 1.25; });
  }

  use(box, part) {
    if (box.itemId !== 'flatbox') return false;
    box.state ||= {};
    if (part.use === 'cutTape') {
      if (box.state.tapeCut) return true;
      box.state.tapeCut = true;
      cutTape(box);
      this.audio.burst?.({ dur: 0.45, freq: 2600, q: 0.7, gain: 0.12, attack: 0.01 });
      this.onMessage('You slice the tape. Now drag the flaps open.');
      return true;
    }
    if (part.use === 'assemble') {
      this.onMessage(this.flapsOpen(box) ? 'Hold left-click on the parts to build it.' : 'Open the box first: drag both flaps open.');
      return true;
    }
    return false;
  }

  // called every frame while you hold left-click on the box's contents
  hold(box, dt) {
    if (!box || box.itemId !== 'flatbox') { this.stop(); return; }
    if (!box.state?.tapeCut) { this.stop(); return; }
    if (!this.flapsOpen(box)) { this.stop(); return; }
    const def = getItem(box.chosen.forId);
    const need = def.assemblyMin || 30;
    if (this.working !== box) {
      this.working = box;
      this.savedFF = this.clock.fastForward;
      this.clock.fastForward = 60;
    }
    box.state.progress = (box.state.progress || 0) + (dt * this.clock.rate) / 60; // game minutes
    this.tick = (this.tick || 0) + dt;
    if (this.tick > 0.22) {
      this.tick = 0;
      // screwdriver ratchet, allen key clicks, the odd knock of a panel
      const r = Math.random();
      if (r < 0.6) for (let i = 0; i < 3; i++) this.audio.tone?.({ freq: 3200 + Math.random() * 600, dur: 0.012, gain: 0.04, type: 'square', delay: i * 0.05 });
      else this.audio.burst?.({ dur: 0.08, freq: 400, q: 2, gain: 0.12 });
    }
    if (box.state.progress >= need) this.finish(box, def);
    return Math.min(1, box.state.progress / need);
  }

  stop() {
    if (!this.working) return;
    this.working = null;
    this.clock.fastForward = this.savedFF;
  }

  finish(box, def) {
    this.stop();
    const t = box.bodies.main.translation(), r = box.bodies.main.rotation();
    const pose = { position: new THREE.Vector3(t.x, t.y, t.z), quaternion: new THREE.Quaternion(r.x, r.y, r.z, r.w) };
    const chosen = JSON.parse(box.chosen.forChosen || '{}');
    const missing = Math.random() < MISSING_SCREW_CHANCE;
    if (missing) chosen._wobble = Math.floor(Math.random() * 97);
    const { L, W } = box.chosen;
    this.items.remove(box);
    pose.position.y += 0.02;
    const built = this.items.spawn(def.id, chosen, pose);
    // leftover: the flattened box, set down next to it
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(pose.quaternion);
    const scrap = pose.position.clone().addScaledVector(side, (built.bounds.max.x - built.bounds.min.x) / 2 + 0.8);
    this.items.spawn('cardboard', { L: Math.min(1.8, L * 0.9), W: Math.min(1.2, W * 2), mass: 1.5 }, { position: scrap, quaternion: pose.quaternion.clone() });
    this.onMessage(missing ? `Built! ...but one screw was missing 😑 The ${def.name} wobbles a little.` : `Built the ${def.name}. Every screw was there.`);
    this.audio.land?.(4);
    this.onBuilt(built);
  }
}

export function cutTape(box) {
  box.state.tapeCut = true;
  for (const j of box.joints) j.joint.setLimits(j.name === 'flapA' ? 0 : -2.95, j.name === 'flapA' ? 2.95 : 0);
  for (const g of Object.values(box.groups)) g.traverse((o) => { if (o.isMesh && o.userData.part?.tape) o.visible = false; });
  box.wake();
}
