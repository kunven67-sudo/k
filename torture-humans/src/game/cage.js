// The terrarium as a place tiny humans live. (The full tiny world - terrain,
// water, lava, resources, building - grows on top of this.)
import * as THREE from 'three';

export class Cage {
  // group: the terrarium; soil: local-space box of the walkable soil surface
  constructor(group, soil) {
    this.group = group;
    this.bounds = soil;
    this.residents = new Set();
  }

  get center() {
    return this.group.localToWorld(this.bounds.getCenter(new THREE.Vector3()));
  }

  // close enough (standing at the table) to reach in and drop someone
  canDropFrom(p) {
    const c = this.center;
    return Math.hypot(p.x - c.x, p.z - c.z) < 2.2 && Math.abs(p.y - c.y) < 1.8;
  }

  // where you land when you shrink yourself in: on the soil, on your side of the tank
  entryPoint(from) {
    const local = this.group.worldToLocal(from.clone());
    const b = this.bounds;
    const x = THREE.MathUtils.clamp(local.x, b.min.x + 0.15, b.max.x - 0.15);
    const z = THREE.MathUtils.clamp(local.z, b.min.z + 0.15, b.max.z - 0.15);
    return this.group.localToWorld(new THREE.Vector3(x, b.max.y + 0.001, z));
  }

  // where you stand when you grow back: on the lab floor, beside the table on that side
  exitPoint(from) {
    const local = this.group.worldToLocal(from.clone());
    const b = this.bounds;
    const side = local.z >= 0 ? 1 : -1;
    const x = THREE.MathUtils.clamp(local.x, b.min.x + 0.3, b.max.x - 0.3);
    const p = this.group.localToWorld(new THREE.Vector3(x, 0, (b.max.z + 0.75) * side));
    p.y = this.floorY ?? 0;
    return p;
  }

  // drop a human into the terrarium, near the side you're standing on
  drop(human, from) {
    const local = this.group.worldToLocal(from.clone());
    const b = this.bounds;
    const x = THREE.MathUtils.clamp(local.x * 0.5, b.min.x + 0.1, b.max.x - 0.1);
    const z = THREE.MathUtils.clamp(local.z * 0.5, b.min.z + 0.1, b.max.z - 0.1);
    const world = this.group.localToWorld(new THREE.Vector3(x, b.max.y, z));
    human.releaseInto(this, world);
    this.residents.add(human);
  }
}
