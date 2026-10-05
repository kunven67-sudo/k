// The shrink ray on things (not people): furniture, trash cans, cars, trees...
// shrink to a toy or grow to a monster. A resized object keeps its feet on the
// floor, gets its own collider (so you can climb your giant trash can), and
// pushes you up on top if it grows into you.
import * as THREE from 'three';

const ease = (u) => 1 - Math.pow(1 - u, 3);

export class Resizer {
  constructor({ physics, props, rebuildProps, player }) {
    Object.assign(this, { physics, props, rebuildProps, player });
    this.anims = [];
    this.ray = new THREE.Raycaster();
  }

  // the object you're aiming at (a whole thing, not one of its parts), or null
  objectAt(origin, dir, maxDist) {
    if (!this.props) return null;
    this.ray.set(origin, dir);
    this.ray.far = maxDist;
    const hits = this.ray.intersectObjects(this.props.children, true);
    for (const h of hits) {
      if (h.object.userData.noCollide && !h.object.visible) continue;
      let o = h.object;
      while (o.parent && o.parent !== this.props) o = o.parent;
      if (o.parent === this.props) return { obj: o, point: h.point, distance: h.distance };
    }
    return null;
  }

  // factor < 1 shrinks, > 1 grows; size stays between 5% and 400% of the original
  zap(obj, factor) {
    const ud = obj.userData;
    ud.baseScale ??= obj.scale.clone();
    ud.k ??= 1;
    const to = THREE.MathUtils.clamp(ud.k * factor, 0.05, 4);
    if (Math.abs(to - ud.k) < 1e-3) return false;
    if (!ud.ownCollider) { ud.ownCollider = true; this.rebuildProps?.(); this.rebuildOwn(obj); }
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const anchor = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
    this.anims = this.anims.filter((a) => a.obj !== obj);
    this.anims.push({ obj, from: ud.k, to, t: 0, anchor });
    return true;
  }

  setK(obj, k, anchor) {
    const ud = obj.userData;
    ud.k = k;
    obj.scale.copy(ud.baseScale).multiplyScalar(k);
    obj.updateMatrixWorld(true);
    // keep it standing where it stood (bottom center fixed)
    const box = new THREE.Box3().setFromObject(obj);
    obj.position.x += anchor.x - (box.min.x + box.max.x) / 2;
    obj.position.y += anchor.y - box.min.y;
    obj.position.z += anchor.z - (box.min.z + box.max.z) / 2;
    obj.updateMatrixWorld(true);
  }

  rebuildOwn(obj) {
    const ud = obj.userData;
    if (ud.body) this.physics.world.removeRigidBody(ud.body);
    const res = this.physics.addStaticMesh(obj, { filter: (o) => !o.userData.noCollide });
    ud.body = res?.body ?? null;
    if (res) this.physics.owners.set(res.collider.handle, { isProp: true, obj });
  }

  update(dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t = Math.min(1, a.t + dt / 0.9);
      this.setK(a.obj, THREE.MathUtils.lerp(a.from, a.to, ease(a.t)), a.anchor);
      if (a.t < 1) continue;
      this.anims.splice(i, 1);
      this.rebuildOwn(a.obj);
      // grew into you: you end up standing on top of it
      const p = this.player;
      if (p && !this.physics.fitsCapsule(p.body, p.body.height, 0.28 * p.scale)) {
        const f = p.feet;
        const box = new THREE.Box3().setFromObject(a.obj);
        const hit = this.physics.raycast(new THREE.Vector3(f.x, box.max.y + 0.2, f.z), { x: 0, y: -1, z: 0 }, box.max.y - box.min.y + 0.3, { exclude: p.body.collider });
        if (hit) p.placeFeet(hit.point);
      }
    }
  }
}
