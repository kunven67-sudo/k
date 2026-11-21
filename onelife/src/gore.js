// Blood that flies, drips and stains the ground, and limbs that come off (the suit piece goes with them).
// Everything lives in real meters in the world, so it stays where it fell and scales with you.
import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class Gore {
  constructor(macro) {
    this.macro = macro;
    const drop = new THREE.MeshStandardMaterial({ color: 0x6a0306, roughness: 0.15, metalness: 0.0, emissive: 0x120000 });
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), drop, 260); this.drops.count = 0; this.drops.frustumCulled = false; macro.add(this.drops);
    const stain = new THREE.MeshStandardMaterial({ color: 0x3e0204, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -2, transparent: true, opacity: 0.92 });
    const sg = new THREE.CircleGeometry(0.5, 14); sg.rotateX(-Math.PI / 2);
    this.stains = new THREE.InstancedMesh(sg, stain, 160); this.stains.count = 0; this.stains.frustumCulled = false; this.stains.receiveShadow = true; macro.add(this.stains);
    this.D = []; this.Sx = []; this.pieces = [];
  }
  // n drops from world point p, flying along dir (meters), size = your body height
  spray(p, dir, n, you, force = 1) {
    for (let i = 0; i < n; i++) {
      if (this.D.length >= 260) this.D.shift();
      const v = new THREE.Vector3(dir.x + (Math.random() - 0.5) * 0.8, dir.y + Math.random() * 0.6, dir.z + (Math.random() - 0.5) * 0.8).normalize().multiplyScalar(you * (0.6 + Math.random() * 1.6) * force);
      this.D.push({ p: p.clone(), v, r: you * (0.0015 + Math.random() * 0.004) });
    }
  }
  stain(x, y, z, r) { if (this.Sx.length >= 160) this.Sx.shift(); this.Sx.push({ x, y, z, r, a: Math.random() * 6.28 }); }
  // a limb comes off: copy of your body in its current pose, showing only that limb, falls and lands
  sever(avatar, boneNames, world, k, O) {
    const src = avatar.model; src.updateWorldMatrix(true, true);
    const c = skClone(src); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); const map = {}; c.traverse(o => { if (o.isBone) map[o.name] = o; });
    src.traverse(o => { if (o.isBone && map[o.name]) { map[o.name].position.copy(o.position); map[o.name].quaternion.copy(o.quaternion); map[o.name].scale.copy(o.scale); } });
    const mid = src.getObjectByName(boneNames[Math.min(1, boneNames.length - 1)]) || src.getObjectByName(boneNames[0]);
    const center = mid.getWorldPosition(new THREE.Vector3()); // render space (you at the middle)
    c.traverse(o => { if (o.isSkinnedMesh) { o.material = avatar.pieceMaterial(boneNames); o.frustumCulled = false; o.castShadow = true; } });
    // put the copy exactly where your body is, pivot around the cut limb
    const holder = new THREE.Group(); src.matrixWorld.decompose(holder.position, holder.quaternion, holder.scale); holder.position.sub(center); holder.add(c);
    const pivot = new THREE.Group(); pivot.add(holder); pivot.scale.setScalar(k);
    const wp = new THREE.Vector3(world.x + center.x * k, world.y + center.y * k, world.z + center.z * k);
    this.macro.add(pivot);
    const axis = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    this.pieces.push({ pivot, wp, v: new THREE.Vector3((Math.random() - 0.5) * 1.8 * k, 1.2 * k, (Math.random() - 0.5) * 1.8 * k), axis, rot: 0, rest: false, k, bleedT: 6, you: 1.8 * k });
    if (this.pieces.length > 8) { const old = this.pieces.shift(); this.macro.remove(old.pivot); }
    return wp;
  }
  clear() { this.D.length = 0; this.Sx.length = 0; for (const p of this.pieces) this.macro.remove(p.pivot); this.pieces.length = 0; }
  update(dt, O, ground) {
    // drops: fly, fall, land as stains
    let n = 0;
    for (let i = this.D.length - 1; i >= 0; i--) {
      const d = this.D[i]; d.v.y -= 9.8 * dt * Math.min(1, d.r * 400); // tiny drops are slowed by air
      d.p.addScaledVector(d.v, dt);
      const g = ground(d.p.x, d.p.z);
      if (d.p.y <= g) { this.stain(d.p.x, g + d.r * 0.05, d.p.z, d.r * (4 + Math.random() * 6)); this.D.splice(i, 1); continue; }
      _m.compose(_p.set(d.p.x - O.x, d.p.y - O.y, d.p.z - O.z), _q.identity(), _s.setScalar(d.r * 2)); this.drops.setMatrixAt(n++, _m);
    }
    this.drops.count = n; this.drops.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const s of this.Sx) { _m.compose(_p.set(s.x - O.x, s.y - O.y, s.z - O.z), _q.setFromAxisAngle(UP, s.a), _s.set(s.r * 2, 1, s.r * 1.6)); this.stains.setMatrixAt(n++, _m); }
    this.stains.count = n; this.stains.instanceMatrix.needsUpdate = true;
    // limbs: fall, tumble, land flat, keep bleeding a little
    for (const P of this.pieces) {
      if (!P.rest) {
        P.v.y -= 9.8 * dt * Math.min(1, P.k * 3 + 0.05); P.wp.addScaledVector(P.v, dt); P.rot = Math.min(Math.PI / 2, P.rot + dt * 4);
        const g = ground(P.wp.x, P.wp.z) + P.you * 0.04;
        if (P.wp.y <= g) { P.wp.y = g; P.rest = true; P.rot = Math.PI / 2; this.spray(P.wp, new THREE.Vector3(0, 0.3, 0), 5, P.you, 0.5); }
      }
      if (P.bleedT > 0) { P.bleedT -= dt; if (Math.random() < dt * 3) this.spray(P.wp, new THREE.Vector3(0, 0.1, 0), 1, P.you, 0.2); }
      P.pivot.position.set(P.wp.x - O.x, P.wp.y - O.y, P.wp.z - O.z); P.pivot.quaternion.setFromAxisAngle(P.axis, P.rot);
    }
  }
}
