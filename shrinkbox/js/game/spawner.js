// The spawn menu's back end: makes things appear in front of you (real size or your size).
import * as THREE from 'three';
import { ITEMS, CATEGORIES, buildItem } from '../world/objects/items.js';
import { buildSodaCan } from '../world/objects/sodacan.js';
import { buildController } from '../world/objects/controller.js';
import { buildPhone } from '../world/objects/phone.js';
import { buildXbox } from '../world/objects/xbox.js';
import { sfx } from '../core/audio.js';
import { Person } from '../world/people.js';

export const SPECIAL = {
  soda: { cat: 'food', icon: '🥤', name: 'Soda (open)', build: (g, p, r) => buildSodaCan(g, p, { rot: [0, r, 0] }) },
  sodaClosed: { cat: 'food', icon: '🥫', name: 'Soda (sealed)', build: (g, p, r) => buildSodaCan(g, p, { open: false, fill: 0.95, rot: [0, r, 0] }) },
  controller: { cat: 'electronics', icon: '🕹️', name: 'Controller', build: (g, p, r) => buildController(g, p, r) },
  phone: { cat: 'electronics', icon: '📱', name: 'Phone', build: (g, p, r) => buildPhone(g, p, r) },
  xbox: { cat: 'electronics', icon: '🎮', name: 'Xbox', build: (g, p, r) => buildXbox(g, p, r) },
  tinyPerson: { cat: 'people', icon: '🧍', name: 'Tiny person (1.4 cm)', person: 0.014 },
  pocketPerson: { cat: 'people', icon: '🧍‍♀️', name: 'Pocket person (5 cm)', person: 0.05 },
};

export function catalog() {
  const list = [];
  for (const [id, d] of Object.entries(SPECIAL)) list.push({ id, ...d });
  for (const [id, d] of Object.entries(ITEMS)) if (!d.hidden) list.push({ id, cat: d.cat, icon: d.icon, name: d.name });
  return list;
}
export { CATEGORIES };
CATEGORIES.push(['people', '🧍 Tiny people']);

export class Spawner {
  constructor(game) { this.game = game; this.mySize = false; }

  spawn(id, pos, silent = false, rotY = 0) {
    const g = this.game;
    const t = SPECIAL[id] ? SPECIAL[id].build(g, pos, rotY) : buildItem(g, id, pos, rotY);
    t.spawned = true; t.spawnId = id;
    if (!silent) sfx.pop(0.25);
    return t;
  }

  spawnInFront(id) {
    const g = this.game, p = g.player, s = p.s;
    const cam = g.engine.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const hit = p.aim(3 * s);
    if (SPECIAL[id] && SPECIAL[id].person) {
      if (g.micro) { g.ui.toast('Grow back out of the germ world first'); return null; }
      const at = hit ? hit.point.clone() : p.feet.clone().addScaledVector(new THREE.Vector3(fwd.x, 0, fwd.z).normalize(), 0.6 * s);
      const pp = new Person(g, { pos: [at.x, at.y + 0.001, at.z], height: SPECIAL[id].person * (0.9 + Math.random() * 0.2), yaw: p.yaw + Math.PI });
      pp.spawned = true; g.people.push(pp);
      sfx.pop(0.25);
      return pp;
    }
    const at = hit ? hit.point.clone().addScaledVector(hit.normal, 0.02 * s) : cam.position.clone().addScaledVector(fwd, 1.2 * s);
    const t = this.spawn(id, [at.x, at.y + 2, at.z], false, p.yaw);
    if (this.mySize) t.setScale(s);
    // lift it so it sits on top of what you're looking at (not inside it)
    t.group.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(t.group);
    const c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
    const body = t.body.translation();
    const off = new THREE.Vector3(body.x - c.x, body.y - bb.min.y, body.z - c.z);
    // if it's big compared to you, put it a bit further away so it doesn't land on you
    const back = Math.max(0, Math.max(size.x, size.z) / 2 - (hit ? 0 : 0.5 * s));
    const pos = at.clone().addScaledVector(new THREE.Vector3(fwd.x, 0, fwd.z).normalize(), hit && hit.normal.y > 0.5 ? back : 0).add(off);
    pos.y = at.y + off.y + 0.002 * s;
    t.setPosition(pos.x, pos.y, pos.z);
    t.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    return t;
  }
}
