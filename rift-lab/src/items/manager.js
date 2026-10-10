// Everything you spawn lives here: its 3D model, its physics bodies, the joints that make
// drawers slide + doors swing, freezing, and saving/loading.

import * as THREE from 'three';
import { getItem, buildSpec, defaultOptions } from './catalog.js';
import { buildVisual, buildColliders, specBounds } from './builder.js';
import { cutTape } from './flatpack.js';

let nextUid = 1;

export class SpawnedItem {
  constructor(mgr, itemId, chosen, transform, saved) {
    const R = mgr.R, world = mgr.physics.world;
    this.mgr = mgr;
    this.uid = saved?.uid ?? nextUid++;
    nextUid = Math.max(nextUid, this.uid + 1);
    this.def = getItem(itemId);
    this.itemId = itemId;
    this.chosen = { ...defaultOptions(this.def), ...(chosen || {}) };
    this.spec = buildSpec(this.def, this.chosen);
    this.state = saved?.state ? JSON.parse(JSON.stringify(saved.state)) : {};
    // a missing screw: one leg is a few millimeters short, so it really rocks
    if (this.chosen._wobble != null) {
      const legs = this.spec.parts.map((p, i) => [p, i]).filter(([p]) => (p.s === 'box' || p.s === 'cyl' || p.s === 'cone') && p.p && Math.abs(p.p[1] - (p.s === 'box' ? p.size[1] : p.h) / 2) < 0.01);
      if (legs.length) {
        const [leg, i] = legs[this.chosen._wobble % legs.length];
        const nl = { ...leg, p: [leg.p[0], leg.p[1] + 0.003, leg.p[2]] };
        if (nl.s === 'box') nl.size = [leg.size[0], leg.size[1] - 0.006, leg.size[2]]; else nl.h = leg.h - 0.006;
        this.spec.parts[i] = nl;
      }
    }
    // parts that broke off before (saved) stay gone
    for (const i of this.state.broken || []) if (this.spec.parts[i]) this.spec.parts[i] = { ...this.spec.parts[i], vis: false, col: false };
    this.bounds = specBounds(this.spec);
    this.frozen = false;
    const { groups, lights } = buildVisual(this.spec);
    // lamps need their own bulb/shade materials so one can glow while another is off
    for (const g of Object.values(groups)) g.traverse((o) => {
      if (o.isMesh && (o.material.userData?.bulb || o.material.userData?.shade)) { o.material = o.material.clone(); o.material.userData.own = true; }
    });
    this.groups = groups;
    this.lights = lights;
    this.root = new THREE.Group();
    this.root.name = `item:${itemId}`;
    for (const g of Object.values(groups)) { g.userData.item = this; this.root.add(g); }
    mgr.scene.add(this.root);

    const pos = transform.position, q = transform.quaternion;
    const cols = buildColliders(R, this.spec);
    this.bodies = {};
    this.colliders = [];
    for (const name of Object.keys(groups)) {
      const bdesc = R.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.05).setAngularDamping(0.15)
        .setCcdEnabled(true);
      const body = world.createRigidBody(bdesc);
      body.userData = { item: this, bodyName: name };
      for (const c of cols[name] || []) {
        const col = world.createCollider(c.desc, body);
        col.userData = { item: this, bodyName: name, surface: c.phys.sound, part: c.part };
        this.colliders.push(col);
        mgr.byHandle.set(col.handle, this);
        mgr.onCollider?.(col, c.part, this);
      }
      this.bodies[name] = body;
    }
    // exact real weight: scale every collider so the whole item weighs what the spec says
    if (this.spec.mass) {
      let total = 0;
      for (const b of Object.values(this.bodies)) { b.recomputeMassPropertiesFromColliders(); total += b.mass(); }
      const k = total > 0 ? this.spec.mass / total : 1;
      if (Math.abs(k - 1) > 0.01) {
        for (const c of this.colliders) c.setDensity(c.density() * k);
        for (const b of Object.values(this.bodies)) b.recomputeMassPropertiesFromColliders();
      }
    }
    // joints: drawers slide, doors + lids swing (with a little friction so they don't flap around)
    this.joints = [];
    const main = this.bodies.main;
    for (const [name, b] of Object.entries(this.spec.bodies)) {
      if (name === 'main' || !b.joint || !this.bodies[name]) continue;
      const a = { x: b.anchor[0], y: b.anchor[1], z: b.anchor[2] };
      const axis = { x: b.axis[0], y: b.axis[1], z: b.axis[2] };
      const data = b.joint === 'prismatic' ? R.JointData.prismatic(a, a, axis) : R.JointData.revolute(a, a, axis);
      const j = world.createImpulseJoint(data, main, this.bodies[name], true);
      j.setContactsEnabled(false);
      if (b.limits) j.setLimits(b.limits[0], b.limits[1]);
      try { j.configureMotorVelocity(0, b.joint === 'prismatic' ? 3.0 : 1.5); } catch { /* older builds */ }
      this.joints.push({ name, joint: j, type: b.joint });
    }
    if (saved) this.restore(saved);
    if (this.itemId === 'flatbox' && this.state.tapeCut) cutTape(this);
    if (this.state.bulbBroken) for (const L of this.lights) L.mesh.visible = false;
    this.sync();
  }

  get mass() { let m = 0; for (const b of Object.values(this.bodies)) m += b.mass(); return m; }

  get position() { const t = this.bodies.main.translation(); return new THREE.Vector3(t.x, t.y, t.z); }

  sync() {
    for (const [name, body] of Object.entries(this.bodies)) {
      const g = this.groups[name];
      const t = body.translation(), r = body.rotation();
      g.position.set(t.x, t.y, t.z);
      g.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  setFrozen(f) {
    this.frozen = f;
    const R = this.mgr.R;
    // the main body locks in place; drawers + doors still work on frozen furniture
    this.bodies.main.setBodyType(f ? R.RigidBodyType.Fixed : R.RigidBodyType.Dynamic, true);
    if (!f) this.wake();
  }

  wake() { for (const b of Object.values(this.bodies)) b.wakeUp(); }

  // move the whole thing (all bodies keep their offsets)
  teleport(pos, quat) {
    const main = this.bodies.main;
    const t0 = main.translation(), r0 = main.rotation();
    const q0 = new THREE.Quaternion(r0.x, r0.y, r0.z, r0.w);
    const dq = quat.clone().multiply(q0.clone().invert());
    for (const body of Object.values(this.bodies)) {
      const t = body.translation(), r = body.rotation();
      const rel = new THREE.Vector3(t.x - t0.x, t.y - t0.y, t.z - t0.z).applyQuaternion(dq);
      const nq = dq.clone().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w));
      body.setTranslation({ x: pos.x + rel.x, y: pos.y + rel.y, z: pos.z + rel.z }, true);
      body.setRotation({ x: nq.x, y: nq.y, z: nq.z, w: nq.w }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.sync();
  }

  serialize() {
    const bodies = {};
    for (const [name, b] of Object.entries(this.bodies)) {
      const t = b.translation(), r = b.rotation();
      bodies[name] = { t: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] };
    }
    const state = { ...this.state };
    delete state.powered; delete state.load; delete state.solarW;
    return { uid: this.uid, id: this.itemId, chosen: this.chosen, frozen: this.frozen, bodies, state };
  }

  restore(s) {
    for (const [name, b] of Object.entries(s.bodies || {})) {
      const body = this.bodies[name];
      if (!body) continue;
      body.setTranslation({ x: b.t[0], y: b.t[1], z: b.t[2] }, true);
      body.setRotation({ x: b.q[0], y: b.q[1], z: b.q[2], w: b.q[3] }, true);
    }
    if (s.frozen) this.setFrozen(true);
  }

  dispose() {
    const world = this.mgr.physics.world;
    for (const j of this.joints) world.removeImpulseJoint(j.joint, true);
    for (const c of this.colliders) this.mgr.byHandle.delete(c.handle);
    for (const b of Object.values(this.bodies)) world.removeRigidBody(b);
    this.mgr.scene.remove(this.root);
  }
}

export class ItemManager {
  constructor({ physics, scene }) {
    this.physics = physics;
    this.R = physics.RAPIER;
    this.scene = scene;
    this.items = [];
    this.byHandle = new Map();
  }

  spawn(itemId, chosen, transform, saved) {
    const it = new SpawnedItem(this, itemId, chosen, transform, saved);
    this.items.push(it);
    return it;
  }

  remove(it) {
    it.dispose();
    this.items = this.items.filter((x) => x !== it);
  }

  itemOfCollider(col) { return col ? this.byHandle.get(col.handle) || null : null; }

  update() { for (const it of this.items) it.sync(); }

  serialize() { return this.items.map((it) => it.serialize()); }

  restoreAll(list) {
    for (const s of list || []) {
      if (!getItem(s.id)) continue;
      const b = s.bodies?.main;
      const transform = b ? { position: new THREE.Vector3(...b.t), quaternion: new THREE.Quaternion(...b.q) } : { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
      this.spawn(s.id, s.chosen, transform, s);
    }
  }

  clear() { for (const it of [...this.items]) this.remove(it); }
}
