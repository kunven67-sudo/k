// Build mode (a god tool on your phone) + placing newly spawned stuff.
// Build mode: aim at something -> soft glow. Click to pick it up, scroll to turn it,
// click to set it down (physics takes over). R freezes it in place, X deletes, Z undoes.
// Placing: a see-through "ghost" follows where you look until you click.

import * as THREE from 'three';
import { input } from '../core/input.js';
import { buildVisual, specBounds } from '../items/builder.js';
import { buildSpec, getItem } from '../items/catalog.js';

const DEG = Math.PI / 180;

const outlineMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(0x9fe8ff) }, uTime: { value: 0 } },
  vertexShader: `
    uniform float uTime;
    varying float vFres;
    void main() {
      vec3 p = position + normal * 0.012;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      vFres = 1.0 - abs(dot(n, normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uColor; uniform float uTime;
    varying float vFres;
    void main() { gl_FragColor = vec4(uColor * (0.6 + 0.4 * sin(uTime * 4.0)), 0.35 + 0.5 * vFres); }`,
  side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

const ghostMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.28, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.28, depthWrite: false });

function addOutline(item) {
  const list = [];
  for (const g of Object.values(item.groups)) {
    g.traverse((o) => {
      if (!o.isMesh || o.userData.outline) return;
      const m = new THREE.Mesh(o.geometry, outlineMat);
      m.userData.outline = true;
      m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale);
      m.renderOrder = 5;
      o.parent.add(m);
      list.push(m);
    });
  }
  return list;
}
function removeOutline(list) { for (const m of list || []) m.parent?.remove(m); }

export class BuildTools {
  constructor({ physics, camera, items, player, hands, onMessage }) {
    this.physics = physics;
    this.camera = camera;
    this.items = items;
    this.player = player;
    this.hands = hands;
    this.R = physics.RAPIER;
    this.active = false;
    this.aimItem = null;
    this.outline = null;
    this.carry = null;
    this.placing = null;
    this.undo = [];
    this.onMessage = onMessage || (() => {});
    this._dir = new THREE.Vector3();
  }

  setActive(on) {
    if (this.carry) this.drop();
    this.active = on;
    this.hands.enabled = !on && !this.placing;
    if (!on) this.setAim(null);
  }

  setAim(item) {
    if (item === this.aimItem) return;
    removeOutline(this.outline);
    this.outline = null;
    this.aimItem = item;
    if (item) this.outline = addOutline(item);
  }

  // where you're looking, ignoring one item (the one you're carrying)
  lookHit(maxDist, ignore) {
    const cam = this.camera.position, dir = this.camera.getWorldDirection(this._dir);
    const filter = ignore ? (col) => this.items.itemOfCollider(col) !== ignore : undefined;
    const ray = new this.R.Ray({ x: cam.x, y: cam.y, z: cam.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.physics.world.castRayAndGetNormal(ray, maxDist, true, undefined, undefined, this.player.collider, undefined, filter);
    if (!hit) return null;
    const p = new THREE.Vector3(cam.x + dir.x * hit.timeOfImpact, cam.y + dir.y * hit.timeOfImpact, cam.z + dir.z * hit.timeOfImpact);
    return { point: p, normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), collider: hit.collider, dist: hit.timeOfImpact };
  }

  // ---------- spawning: ghost preview ----------
  startPlacing(itemId, chosen, onConfirm) {
    this.cancelPlacing();
    const spec = buildSpec(getItem(itemId), chosen);
    const { groups } = buildVisual(spec);
    const ghost = new THREE.Group();
    for (const g of Object.values(groups)) ghost.add(g);
    ghost.traverse((o) => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; o.receiveShadow = false; } });
    this.camera.parent.add(ghost);
    this.placing = { itemId, chosen, ghost, bounds: specBounds(spec), yaw: 0, onConfirm, ok: true };
    this.hands.enabled = false;
  }

  cancelPlacing() {
    if (!this.placing) return;
    this.placing.ghost.parent?.remove(this.placing.ghost);
    this.placing = null;
    this.hands.enabled = !this.active;
  }

  // the pose the ghost/carried thing should have, sitting on whatever you're looking at
  restingPose(bounds, yaw, ignore) {
    const hit = this.lookHit(30, ignore);
    const dir = this.camera.getWorldDirection(this._dir);
    let p;
    if (hit) p = hit.point.clone();
    else {
      p = this.camera.position.clone().addScaledVector(dir, 6);
      p.y = this.player.world.height(p.x, p.z);
    }
    // keep a little gap in front of walls so it doesn't spawn inside them
    if (hit && hit.normal.y < 0.5) {
      const size = new THREE.Vector3(); bounds.getSize(size);
      p.addScaledVector(hit.normal, Math.max(size.x, size.z) / 2 + 0.02);
      p.y = this.player.world.height(p.x, p.z);
    }
    p.y += -bounds.min.y + 0.015;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw + yaw); // front faces you
    return { position: p, quaternion: q, hit };
  }

  // ---------- per frame ----------
  update(dt) {
    outlineMat.uniforms.uTime.value += dt;
    if (!input.locked) return;

    if (this.placing) {
      const pl = this.placing;
      if (input.wheel) pl.yaw += input.wheel * (input.action('sprint') ? 3 : 15) * DEG;
      const pose = this.restingPose(pl.bounds, pl.yaw);
      pl.ghost.position.copy(pose.position);
      pl.ghost.quaternion.copy(pose.quaternion);
      // too far or inside you?
      const d = pose.position.distanceTo(this.player.pos);
      pl.ok = d < 30 && d > 0.6;
      pl.ghost.traverse((o) => { if (o.isMesh) o.material = pl.ok ? ghostMat : ghostBad; });
      if (input.mousePressed(0) && pl.ok) {
        const it = pl.onConfirm(pose);
        if (it) this.undo.push({ type: 'spawn', item: it });
        this.cancelPlacing();
      } else if (input.mousePressed(2)) this.cancelPlacing();
      return;
    }

    if (!this.active) return;

    if (this.carry) {
      const c = this.carry;
      if (input.wheel) c.yaw += input.wheel * (input.action('sprint') ? 3 : 15) * DEG;
      const pose = this.restingPose(c.item.bounds, c.yaw, c.item);
      c.item.bodies.main.setNextKinematicTranslation({ x: pose.position.x, y: pose.position.y, z: pose.position.z });
      c.item.bodies.main.setNextKinematicRotation({ x: pose.quaternion.x, y: pose.quaternion.y, z: pose.quaternion.z, w: pose.quaternion.w });
      if (input.mousePressed(0)) this.drop(false);
      else if (input.pressed.has('KeyR')) this.drop(true);
      return;
    }

    const hit = this.lookHit(40);
    const item = hit ? this.items.itemOfCollider(hit.collider) : null;
    this.setAim(item);
    if (!item) return;
    if (input.mousePressed(0)) this.pick(item);
    else if (input.pressed.has('KeyR')) {
      this.undo.push({ type: 'freeze', item, prev: item.frozen });
      item.setFrozen(!item.frozen);
      this.onMessage(item.frozen ? 'Frozen in place' : 'Unfrozen');
    } else if (input.pressed.has('KeyX') || input.pressed.has('Delete') || input.pressed.has('Backspace')) {
      this.undo.push({ type: 'delete', data: item.serialize() });
      if (this.hands.held?.item === item) this.hands.release(false);
      this.setAim(null);
      this.items.remove(item);
      this.onMessage('Deleted (Z to undo)');
    }
  }

  undoLast() {
    const u = this.undo.pop();
    if (!u) { this.onMessage('Nothing to undo'); return; }
    if (u.type === 'spawn') { if (this.items.items.includes(u.item)) { if (this.aimItem === u.item) this.setAim(null); this.items.remove(u.item); } }
    else if (u.type === 'delete') this.items.restoreAll([u.data]);
    else if (u.type === 'move') { if (this.items.items.includes(u.item)) u.item.restore(u.before); }
    else if (u.type === 'freeze') { if (this.items.items.includes(u.item)) u.item.setFrozen(u.prev); }
    this.onMessage('Undone');
  }

  pick(item) {
    if (this.hands.held?.item === item) this.hands.release(false);
    const before = item.serialize();
    const r = item.bodies.main.rotation();
    const yawNow = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w), 'YXZ').y;
    item.bodies.main.setBodyType(this.R.RigidBodyType.KinematicPositionBased, true);
    this.carry = { item, before, yaw: yawNow - this.player.yaw };
  }

  drop(freeze = false) {
    const c = this.carry;
    if (!c) return;
    this.carry = null;
    const body = c.item.bodies.main;
    body.setBodyType(freeze ? this.R.RigidBodyType.Fixed : this.R.RigidBodyType.Dynamic, true);
    c.item.frozen = freeze;
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    c.item.wake();
    this.undo.push({ type: 'move', item: c.item, before: c.before });
    if (this.undo.length > 60) this.undo.shift();
  }
}
