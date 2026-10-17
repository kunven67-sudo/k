import * as THREE from 'three';

// Anything you can use with E / left click. Objects register with a label and an action;
// each frame we raycast from the middle of the screen to find what you're looking at.
export class Interact {
  constructor(camera) {
    this.camera = camera;
    this.items = [];
    this.targets = [];
    this.ray = new THREE.Raycaster();
    this.ray.far = 2.4;
    this.current = null;
    this.blockers = [];
  }

  add(obj, o) {
    const it = { obj, range: 2.2, enabled: () => true, ...o };
    obj.traverse(c => { c.userData.interact = it; });
    this.items.push(it);
    this.targets.push(obj);
    return it;
  }

  // Meshes that should block the ray (walls, big furniture) without being usable.
  block(obj) { this.blockers.push(obj); }

  update() {
    this.ray.setFromCamera(_c, this.camera);
    const hits = this.ray.intersectObjects([...this.targets, ...this.blockers], true);
    let found = null;
    for (const h of hits) {
      const it = h.object.userData.interact;
      if (!h.object.visible) continue;
      if (!it) break; // a wall or something solid is in the way
      if (h.distance > it.range || !it.enabled()) { if (it.solid !== false) break; else continue; }
      found = it; this.point = h.point; break;
    }
    this.current = found;
    return found;
  }
}
const _c = new THREE.Vector2(0, 0);
