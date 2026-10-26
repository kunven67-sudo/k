// The terrarium as a place tiny humans live. (The full tiny world - terrain,
// water, lava, resources, building - grows on top of this.)
import * as THREE from 'three';
import { GROUP, groups } from './engine/physics.js';

export class Cage {
  // group: the terrarium; soil: local-space box of the walkable soil surface
  // tiny: the tiny world (heightAt/surfaceY in terrarium space), optional
  constructor(group, soil, tiny = null) {
    this.group = group;
    this.bounds = soil;
    this.tiny = tiny;
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
    return this.group.localToWorld(new THREE.Vector3(x, this.surfaceY(x, z) + 0.001, z));
  }

  // dry land (not in the pond or the lava)
  isWalkable(x, z) {
    const f = this.tiny?.features;
    if (!f) return true;
    return Math.hypot(x - f.pond.x, z - f.pond.z) > f.pond.r * 1.05 && Math.hypot(x - f.lava.x, z - f.lava.z) > f.lava.r * 1.15;
  }

  // surface heights of the pond water and the lava (terrarium space)
  get waterY() { const f = this.tiny?.features?.pond; return f ? this.bounds.max.y - f.depth * 0.45 : -Infinity; }
  get lavaY() { const f = this.tiny?.features?.lava; return f ? this.bounds.max.y - f.depth * 0.5 : -Infinity; }

  // how deep the pond water is at x,z (0 = dry)
  waterDepth(x, z) {
    const f = this.tiny?.features?.pond;
    if (!f || Math.hypot(x - f.x, z - f.z) > f.r * 1.1) return 0;
    return Math.max(0, this.waterY - this.surfaceY(x, z));
  }

  inLava(x, z) {
    const f = this.tiny?.features?.lava;
    if (!f || Math.hypot(x - f.x, z - f.z) > f.r * 1.05) return false;
    return this.surfaceY(x, z) < this.lavaY + 0.002;
  }

  // soil height in terrarium space (hills and pits of the tiny world)
  surfaceY(x, z) {
    return this.tiny ? this.tiny.surfaceY(x, z) : this.bounds.max.y;
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

  // Drop a human into the terrarium: where you aim if the aim lands inside it
  // (yes, including the pond or the lava), otherwise near the side you stand on.
  drop(human, from, aim = null) {
    const local = this.group.worldToLocal((aim || from).clone());
    const b = this.bounds;
    const inside = aim && Math.abs(local.x) < b.max.x && Math.abs(local.z) < b.max.z;
    const x = THREE.MathUtils.clamp(inside ? local.x : local.x * 0.5, b.min.x + 0.03, b.max.x - 0.03);
    const z = THREE.MathUtils.clamp(inside ? local.z : local.z * 0.5, b.min.z + 0.03, b.max.z - 0.03);
    const world = this.group.localToWorld(new THREE.Vector3(x, this.surfaceY(x, z), z));
    human.releaseInto(this, world);
    this.residents.add(human);
    this.colony?.admit(human);
  }

  // A ray into the tank that passes through the glass walls (you look in through
  // them, but they are solid for anything inside). Returns the hit, or null.
  raycast(physics, origin, dir, maxDist, opts = {}) {
    let from = origin.clone();
    let left = maxDist;
    for (let i = 0; i < 4 && left > 0; i++) {
      const hit = physics.raycast(from, dir, left, opts);
      if (!hit) return null;
      const l = this.group.worldToLocal(hit.point.clone());
      const onGlass = (Math.abs(l.x) > this.bounds.max.x + 0.02 || Math.abs(l.z) > this.bounds.max.z + 0.02) && l.y > this.bounds.max.y - 0.05
        && Math.abs(l.x) < this.bounds.max.x + 0.1 && Math.abs(l.z) < this.bounds.max.z + 0.1 && l.y < 1.3;
      if (!onGlass) return hit;
      // step through the pane and keep going
      from = hit.point.clone().addScaledVector(dir, 0.012);
      left -= hit.distance + 0.012;
    }
    return null;
  }

  // the point in the tank (terrarium space) you're aiming at, or null
  aimPoint(physics, camera, exclude) {
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const hit = this.raycast(physics, camera.position, dir, 4, { exclude, filterGroups: groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP) });
    if (!hit) return null;
    const l = this.group.worldToLocal(hit.point.clone());
    if (Math.abs(l.x) > this.bounds.max.x + 0.01 || Math.abs(l.z) > this.bounds.max.z + 0.01) return null;
    return { local: l, world: hit.point };
  }
}
