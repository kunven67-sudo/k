// Hinged doors: a real leaf that swings 95 degrees on its hinge. Closed = solid collider,
// open = collider off. Doors can be locked (you need the key or to be inside to unlock).
//
//   const doors = new Doors(world)
//   doors.add({ name, cx, cz, w, h, y, rotY, hingeLeft, exterior, lockable })
//   doors.toggle(door, who)   // returns 'opened' | 'closed' | 'locked'
//   doors.update(dt)

import * as THREE from 'three';
import { mat } from '../gfx/materials.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/events.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Doors {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.leafMat = {
      interior: mat('paint', { color: 0xf3efe6 }),
      front: mat('painted-wood', { color: 0x6b2d2a, wear: 0.15, dirt: 0.15 }),
      garage: mat('siding', { color: 0xeeeae2, dirt: 0.15 }),
    };
    this.knobMat = mat('brass', { wear: 0.2 });
    this.trimMat = mat('paint', { color: 0xf6f3ec });
  }

  add(d) {
    const door = { open: 0, target: 0, locked: false, ...d };
    door.style = d.style || (d.exterior ? 'front' : 'interior');
    const t = door.exterior ? 0.05 : 0.04;
    // Pivot sits on the hinge edge; the leaf extends along the pivot's local +x (or -x).
    const pivot = new THREE.Group();
    const dir = new THREE.Vector3(Math.cos(door.rotY), 0, -Math.sin(door.rotY));
    const side = door.hingeLeft ? -1 : 1;
    pivot.position.set(door.cx + dir.x * side * (door.w / 2), door.y, door.cz + dir.z * side * (door.w / 2));
    pivot.rotation.y = door.rotY;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(door.w, door.h, t), this.leafMat[door.style]);
    leaf.position.set(-side * (door.w / 2), door.h / 2, 0);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    pivot.add(leaf);
    // Panels (a little relief so it doesn't look like a flat slab).
    const panelMat = this.leafMat[door.style];
    for (const py of [0.55, 1.45]) {
      for (const sz of [1, -1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(door.w * 0.62, py > 1 ? 0.75 : 0.62, 0.012), panelMat);
        p.position.set(-side * (door.w / 2), py, sz * (t / 2 + 0.004));
        pivot.add(p);
      }
    }
    for (const sz of [1, -1]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), this.knobMat);
      knob.position.set(-side * (door.w - 0.08), 1.0, sz * (t / 2 + 0.035));
      pivot.add(knob);
    }
    this.world.scene.add(pivot);
    // Casing trim around the opening, on both faces of the wall.
    const wallT = door.wallT ?? (door.exterior ? 0.2 : 0.12);
    const casing = new THREE.Group();
    casing.position.set(door.cx, door.y, door.cz);
    casing.rotation.y = door.rotY;
    for (const sz of [1, -1]) {
      const z = sz * (wallT / 2 + 0.008);
      for (const [x, y, w, h] of [[-(door.w / 2 + 0.06), door.h / 2 + 0.03, 0.08, door.h + 0.06], [door.w / 2 + 0.06, door.h / 2 + 0.03, 0.08, door.h + 0.06], [0, door.h + 0.07, door.w + 0.2, 0.08]]) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.016), this.trimMat);
        c.position.set(x, y, z);
        c.castShadow = false;
        c.receiveShadow = true;
        casing.add(c);
      }
    }
    this.world.scene.add(casing);
    door.pivot = pivot;
    door.leaf = leaf;
    door.side = side;
    // Collider for the closed leaf.
    const q = new THREE.Quaternion().setFromAxisAngle(UP, door.rotY);
    door.collider = this.world.physics.addStaticBox({ x: door.cx, y: door.y + door.h / 2, z: door.cz }, { x: door.w, y: door.h, z: 0.08 }, q);
    door.box = new THREE.Box3();
    this._updateBox(door);
    this.list.push(door);
    // Interaction is handled through the world's interactables.
    this.world.interact.add({
      kind: 'door',
      door,
      getBox: () => door.box,
      label: () => (door.locked && door.open < 0.5 ? `${door.name} (locked)` : door.open > 0.5 ? `Close ${door.name.toLowerCase()}` : `Open ${door.name.toLowerCase()}`),
      use: (who) => this.toggle(door, who),
    });
    return door;
  }

  _updateBox(door) {
    door.leaf.updateWorldMatrix(true, false);
    door.box.setFromObject(door.leaf).expandByScalar(0.03);
  }

  /** Open/close. Locked doors only open for someone allowed to unlock them. */
  toggle(door, who = null) {
    if (door.target < 0.5) {
      if (door.locked) {
        if (who?.canUnlock?.(door)) {
          door.locked = false;
          audio.play?.('door.unlock', { position: door.pivot.position });
        } else {
          audio.play?.('door.knock', { position: door.pivot.position, gain: 0.4 });
          bus.emit('door:locked', { door, who });
          return 'locked';
        }
      }
      door.target = 1;
      audio.play?.(door.exterior ? 'door.open' : 'door.creak', { position: door.pivot.position });
      door.collider.setEnabled(false);
      bus.emit('door:opened', { door, who });
      return 'opened';
    }
    door.target = 0;
    door._closing = true;
    bus.emit('door:closed', { door, who });
    return 'closed';
  }

  setOpen(door, open, instant = false) {
    door.target = open ? 1 : 0;
    if (instant) door.open = door.target;
    door.collider.setEnabled(!open);
    if (instant) this._apply(door);
  }

  _apply(door) {
    const swing = door.open * 1.66; // 95 degrees, into the room
    door.pivot.rotation.y = door.rotY + door.side * swing;
    this._updateBox(door);
  }

  update(dt) {
    for (const d of this.list) {
      if (Math.abs(d.open - d.target) < 0.001) continue;
      const speed = d.target > d.open ? 2.4 : 2.9;
      d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), speed * dt);
      this._apply(d);
      if (d._closing && d.open <= 0.001) {
        d._closing = false;
        d.collider.setEnabled(true);
        audio.play?.(d.exterior ? 'door.close' : 'door.close', { position: d.pivot.position, gain: d.exterior ? 1 : 0.7 });
      }
    }
  }

  /** Doors near a point (for NPC pathing: they open doors they walk through). */
  near(p, r = 1.2) {
    return this.list.filter((d) => Math.hypot(d.cx - p.x, d.cz - p.z) < r);
  }
}
