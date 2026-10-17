// Things you can use: doors, fridges, beds, TVs, people, items... Each interactable has a box
// (or getBox()) for aiming and a label/use pair. The player aims with the crosshair; walls in
// between block it (checked by the caller with a physics ray).
//
//   world.interact.add({ kind, box | getBox(), label(who) -> string|null, use(who), alt?, altLabel? })
//   world.interact.pick(origin, dir, maxDist) -> { it, dist, point } | null

import * as THREE from 'three';

const _ray = new THREE.Ray();
const _p = new THREE.Vector3();

export class Interactables {
  constructor() {
    this.list = [];
  }

  add(it) {
    it.enabled = it.enabled ?? true;
    this.list.push(it);
    return it;
  }

  remove(it) {
    const i = this.list.indexOf(it);
    if (i >= 0) this.list.splice(i, 1);
  }

  /** Nearest interactable whose box the ray hits within maxDist. */
  pick(origin, dir, maxDist = 2.2, filter = null) {
    _ray.set(origin, dir);
    let best = null;
    for (const it of this.list) {
      if (!it.enabled) continue;
      if (filter && !filter(it)) continue;
      const box = it.getBox ? it.getBox() : it.box;
      if (!box) continue;
      // Cheap reject: centre too far.
      const hit = _ray.intersectBox(box, _p);
      if (!hit) continue;
      const d = hit.distanceTo(origin);
      if (d > maxDist) continue;
      // Prefer small things over big ones when both are hit at nearly the same distance
      // (a can on a table beats the table).
      const score = d + (it.priority ? -it.priority : 0);
      if (!best || score < best.score) best = { it, dist: d, point: hit.clone(), score };
    }
    return best;
  }

  near(point, r) {
    return this.list.filter((it) => {
      const box = it.getBox ? it.getBox() : it.box;
      return box && box.distanceToPoint(point) < r;
    });
  }
}

/** Helper: a box around a centre point. */
export function boxAt(center, sx, sy, sz) {
  return new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(sx, sy, sz));
}
