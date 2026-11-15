// Weapons + props you spawn: lying on the ground (physics), held in your hands, thrown, blown up.
import * as THREE from 'three';
import { Body } from './physics.js';
import { WEAPONS, PROPS } from './catalog.js';

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class ItemTypes {
  constructor(loader) { this.loader = loader; this.cache = {}; }
  async get(key) {
    if (!this.cache[key]) this.cache[key] = this.loader.loadAsync('assets/models/' + key + '.glb').then(g => {
      const def = WEAPONS[key] || PROPS[key];
      g.scene.traverse(o => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        if (def.hide && def.hide.some(h => o.name.includes(h))) o.visible = false;
      });
      if (key === 'pistol') g.scene.traverse(o => { if (o.isMesh) o.visible = /_a$/.test(o.name); });
      if (def.scale) g.scene.scale.setScalar(def.scale);
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3(); g.scene.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o); });
      return { key, def, scene: g.scene, box };
    });
    return this.cache[key];
  }
}

export class Item {
  constructor(t, world) {
    this.t = t; this.key = t.key; this.def = t.def; this.world = world;
    this.obj = new THREE.Group(); this.model = t.scene.clone(true); this.obj.add(this.model);
    const b = t.box, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    this.size = s; this.model.position.copy(c).negate(); // centered on the group
    this.isWeapon = !!WEAPONS[t.key]; this.held = false; this.body = null; this.fuse = 0;
    world.scene.add(this.obj);
  }
  drop(pos, vel = null) {
    this.held = false; this.obj.visible = true;
    if (this.obj.parent !== this.world.scene) this.world.scene.add(this.obj);
    this.obj.position.copy(pos);
    const s = this.size, mass = this.def.mass || 3;
    const box = !this.isWeapon ? { hx: s.x / 2, hy: s.y / 2, hz: s.z / 2 } : null;
    if (this.isWeapon && this.def.kind !== 'shield') this.obj.rotation.set(Math.PI / 2, Math.random() * 6, 0); // lie flat
    this.body = this.world.physics.add(new Body(this.obj, { radius: this.isWeapon ? Math.min(s.x, s.y, s.z) / 2 + 0.01 : Math.min(s.x, s.y, s.z) / 2, mass, box, bounce: 0.15, friction: 0.8, tumble: true }));
    this.body.item = this;
    if (vel) { this.body.vel.copy(vel); this.body.ang.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3); }
    if (this.isWeapon) this.body.bottom = Math.min(s.x, s.y, s.z) / 2;
  }
  pickUp() {
    if (this.body) { this.world.physics.remove(this.body); this.body = null; }
    this.held = true;
  }
  hide() { this.obj.visible = false; }
  // put the weapon in the hand: grip point, blade/barrel direction, edge/up direction (world)
  place(grip, dir, edge, fp, normal = null) {
    this.obj.visible = true;
    const k = this.def.kind, s = this.size;
    let X, Y, Z;
    if (k === 'gun' || k === 'rifle') { // model: +X barrel, +Y up
      X = dir.clone().normalize(); Y = edge.clone().normalize(); Z = new THREE.Vector3().crossVectors(X, Y).normalize(); Y.crossVectors(Z, X);
      _m.makeBasis(X, Y, Z); this.obj.quaternion.setFromRotationMatrix(_m);
      // grip sits behind the middle (pistol grip / rifle trigger area)
      const off = k === 'rifle' ? new THREE.Vector3(-s.x * 0.12, -s.y * 0.15, 0) : new THREE.Vector3(-s.x * 0.18, -s.y * 0.25, 0);
      this.obj.position.copy(grip).sub(off.applyQuaternion(this.obj.quaternion));
    } else if (k === 'shield') { // model: +Y up, +Z out the front
      Y = dir.clone().normalize(); Z = (normal || edge.clone().negate()).clone().normalize(); X = new THREE.Vector3().crossVectors(Y, Z).normalize(); Z.crossVectors(X, Y);
      _m.makeBasis(X, Y, Z); this.obj.quaternion.setFromRotationMatrix(_m);
      this.obj.position.copy(grip).addScaledVector(Z, 0.06);
    } else { // blades, hammers, grenade: +Y = head/tip, handle at -Y
      Y = dir.clone().normalize(); Z = edge.clone().normalize(); X = new THREE.Vector3().crossVectors(Y, Z).normalize(); Z.crossVectors(X, Y);
      _m.makeBasis(X, Y, Z); this.obj.quaternion.setFromRotationMatrix(_m);
      const g = (this.def.grip ?? 0.1);
      this.obj.position.copy(grip).addScaledVector(Y, s.y * (0.5 - g));
    }
  }
  // blade segment in world space (handle end -> tip)
  blade(a, b) {
    const Y = _v.set(0, 1, 0).applyQuaternion(this.obj.quaternion);
    a.copy(this.obj.position).addScaledVector(Y, -this.size.y * 0.2);
    b.copy(this.obj.position).addScaledVector(Y, this.size.y * 0.5 + 0.05);
  }
  muzzle(v) { return v.set(this.size.x * 0.5, this.size.y * 0.15, 0).applyQuaternion(this.obj.quaternion).add(this.obj.position); }
  remove() { if (this.body) this.world.physics.remove(this.body); this.world.scene.remove(this.obj); this.removed = true; }
}
