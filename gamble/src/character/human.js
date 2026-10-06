// Human: one procedural person — skeleton, skinned meshes, materials and the animation brain.
//
//   const h = createHuman(params, { tier })     // see index.js
//   scene.add(h.root); h.update(dt) every frame
//
// The root Object3D stands with its feet at y = 0 and faces +Z. Gameplay code moves/rotates the
// root (or its parent); the Human measures that motion and animates on top of it (stride length
// from speed, foot planting, leaning into turns), so any controller just works.

import * as THREE from 'three';
import { normalizeParams } from './schema.js';
import { buildRig } from './rig.js';
import { assembleGeometry, releaseGeometry } from './assemble.js';
import { headTemplate } from './head.js';
import { skinColor, hairColor, paintFace, releaseFace, createSkinMaterial } from './skin.js';
import { eyeAtlas, createEyeMaterial, createMouthMaterial } from './eyes.js';
import { Animator } from './anim/animator.js';
import { currentTier } from '../core/quality.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Human {
  constructor(params = {}, { tier = null, hero = false } = {}) {
    const t0 = performance.now();
    this.params = normalizeParams(params);
    const p = this.params;
    const tierObj = tier ? (typeof tier === 'string' ? { name: tier } : tier) : currentTier();
    this.tier = tierObj;
    this.tierName = tierObj.name || 'high';
    this.hero = hero;

    // Skeleton.
    this.rig = buildRig(p);
    this.root = new THREE.Group();
    this.root.name = 'human';
    this.root.userData.human = this;
    this.bones = this.rig.byName;
    this.root.add(this.rig.bones[0]);
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(this.rig.bones);

    const t1 = performance.now();
    // Geometry (cached by shape).
    this.geo = assembleGeometry(p, this.rig, this.tierName);
    const t2 = performance.now();

    // Materials.
    const faceSize = hero ? (this.tierName === 'ultra' ? 1024 : 512) : this.tierName === 'low' ? 256 : 512;
    this.face = typeof document !== 'undefined' ? paintFace(p, headTemplate(this.tierName), faceSize) : null;
    const t3 = performance.now();
    this.skinMat = createSkinMaterial({ tierName: this.tierName, skin: skinColor(p), hair: hairColor(p, 'beard'), face: this.face, eyeUV: this.geo.skin.eyeUV });
    const su = this.skinMat.userData.u;
    su.uBodyHair.value = p.bodyHair;
    su.uStubble.value = p.facialHair === 'none' ? p.stubble : Math.max(p.stubble, 0.55);
    su.uWrinkle.value = 0.6 + 0.6 * Math.min(1, p.wrinkles + Math.max(0, (p.age - 40) / 50));
    this.eyeMat = createEyeMaterial(eyeAtlas(p.eyeColor, p.heterochromia ? p.eyeColor2 : p.eyeColor, { size: hero ? 512 : 256, seed: p.seed, age: p.age }), this.tierName);
    this.eyeMat.userData.u.uEyeR.value = this.rig.dims.L.eyeR * this.rig.dims.hsc;
    this.mouthMat = createMouthMaterial(this.tierName);
    this.mouthMat.userData.u.uFrontZ.value = this.geo.mouth.userData.frontZ;
    this.mouthMat.userData.u.uDepth.value = this.geo.mouth.userData.depth;

    // Meshes (all bound to the same skeleton).
    const shadows = !!this.tier.shadows;
    this.skin = this._mesh(this.geo.skin.geometry, this.skinMat, shadows);
    this.eyes = this._mesh(this.geo.eyes, this.eyeMat, false);
    this.mouth = this._mesh(this.geo.mouth, this.mouthMat, false);

    this.animator = new Animator(this);
    this.buildMs = performance.now() - t0;
    this.timing = { rig: t1 - t0, geometry: t2 - t1, paint: t3 - t2, rest: performance.now() - t3 };
  }

  _mesh(geometry, material, castShadow) {
    const m = new THREE.SkinnedMesh(geometry, material);
    m.bind(this.skeleton, new THREE.Matrix4());
    m.castShadow = castShadow;
    m.receiveShadow = true;
    this.root.add(m);
    return m;
  }

  // ---- public API (ARCHITECTURE §6) -----------------------------------------------------------

  update(dt) {
    this.animator.update(Math.min(dt, 1 / 15));
    this._updateEyeUniforms();
  }

  setLocomotion(o) {
    this.animator.setLocomotion(o);
  }

  play(name, opts) {
    return this.animator.play(name, opts);
  }

  setExpression(name, weight = 1) {
    this.animator.face.setExpression(name, weight);
  }

  lookAt(target) {
    this.animator.lookAt(target);
  }

  setViseme(name, weight = 1) {
    this.animator.face.setViseme(name, weight);
  }

  setFootIK(fn) {
    this.animator.setFootIK(fn);
  }

  setHandTarget(side, pos) {
    this.animator.setHandTarget(side, pos);
  }

  attach(boneName, object3d) {
    const name = { 'hand.L': 'hand.L', 'hand.R': 'hand.R', head: 'head', spine: 'chest' }[boneName] || boneName;
    const b = this.bones[name];
    if (!b) throw new Error(`attach: unknown bone ${boneName}`);
    b.add(object3d);
    return object3d;
  }

  setDirtiness(v) {
    this.skinMat.userData.u.uDirt.value = v;
  }

  setBruises({ eye = null, eyeL = null, eyeR = null, knuckles = null, knucklesL = null, knucklesR = null, cheek = null } = {}) {
    const u = this.skinMat.userData.u;
    if (eye != null) u.uBruiseEye.value.set(eye, eye);
    if (eyeL != null) u.uBruiseEye.value.x = eyeL;
    if (eyeR != null) u.uBruiseEye.value.y = eyeR;
    if (knuckles != null) u.uBruiseKnuckles.value.set(knuckles, knuckles);
    if (knucklesL != null) u.uBruiseKnuckles.value.x = knucklesL;
    if (knucklesR != null) u.uBruiseKnuckles.value.y = knucklesR;
    if (cheek != null) u.uBruiseCheek.value = cheek;
  }

  setSweat(v) {
    this.skinMat.userData.u.uSweat.value = v;
  }

  dispose() {
    this.root.removeFromParent();
    releaseGeometry(this.geo);
    releaseFace(this.face);
    for (const m of [this.skinMat, this.eyeMat, this.mouthMat]) m.dispose();
    this.skeleton.dispose();
  }

  // ---- internals ------------------------------------------------------------------------------

  _updateEyeUniforms() {
    const u = this.eyeMat.userData.u;
    const head = this.bones.head;
    const L = this.rig.dims.L;
    for (let k = 0; k < 2; k++) this.bones[k ? 'eye.R' : 'eye.L'].getWorldPosition(u.uEyeC.value[k]);
    head.getWorldQuaternion(_q);
    u.uHeadUp.value.set(0, 1, 0).applyQuaternion(_q);
    u.uHeadRight.value.set(1, 0, 0).applyQuaternion(_q);
    const lids = this.animator.face.lidState;
    u.uLidU.value.set(Math.sin(L.lidUpper - lids.upperL), Math.sin(L.lidUpper - lids.upperR));
    u.uLidD.value.set(Math.sin(-L.lidLower + lids.lowerL), Math.sin(-L.lidLower + lids.lowerR));
    this.mouthMat.userData.u.uOpen.value = this.animator.face.mouthOpen;
    void _v;
  }
}
