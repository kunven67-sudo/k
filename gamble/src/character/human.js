// Human: one procedural person — skeleton, skinned meshes, materials and the animation brain.
//
//   const h = createHuman(params, { tier })     // see index.js
//   scene.add(h.root); h.update(dt) every frame
//
// The root Object3D stands with its feet at y = 0 and faces +Z. Gameplay code moves/rotates the
// root (or its parent); the Human measures that motion and animates on top of it (stride length
// from speed, foot planting, leaning into turns), so any controller just works.
//
// Draw calls: skin (body+head+ears) · eyes · mouth · face cards (brows/lashes/beard) · hair ·
// clothes · accessories.

import * as THREE from 'three';
import { normalizeParams } from './schema.js';
import { buildRig } from './rig.js';
import { buildHumanGeometry, releaseGeometry, skinIndex } from './meshbuild.js';
import { skinColor, hairColor, paintFace, releaseFace, createSkinMaterial } from './skin.js';
import { eyeAtlas, createEyeMaterial, createMouthMaterial } from './eyes.js';
import { HEAD_UNIT } from './headsdf.js';
import { Animator } from './anim/animator.js';
import { buildGarment } from './clothes.js';
import { createClothMaterial } from './clothmat.js';
import { outfitGarments } from './outfit.js';
import { buildHair, createHairMaterial } from './hair.js';
import { buildFaceCards } from './facecards.js';
import { buildAccessories } from './accessories.js';
import { currentTier } from '../core/quality.js';

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

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
    const geoTier = hero && this.tierName !== 'low' ? 'ultra' : this.tierName;
    this.geo = buildHumanGeometry(p, this.rig, geoTier);
    const t2 = performance.now();

    // Materials.
    const faceSize = hero ? 1024 : this.tierName === 'low' ? 256 : 512;
    this.face = typeof document !== 'undefined' ? paintFace(p, this.geo.mapper, faceSize) : null;
    const t3 = performance.now();
    const L = this.geo.L;
    const eyeUV = L.eyes.map((e) => this.geo.mapper.uvOf(e.c[0], e.c[1] - 0.004, e.c[2] + L.eyeR));
    this.skinMat = createSkinMaterial({ tierName: this.tierName, skin: skinColor(p), hair: hairColor(p, 'beard'), face: this.face, eyeUV });
    const su = this.skinMat.userData.u;
    su.uBodyHair.value = p.bodyHair;
    su.uStubble.value = p.facialHair === 'none' ? p.stubble : Math.max(p.stubble, 0.55);
    su.uWrinkle.value = 0.6 + 0.6 * Math.min(1, p.wrinkles + Math.max(0, (p.age - 40) / 50));
    su.uDirt.value = p.dirtiness * 0.5;
    const hsc = this.rig.dims.headH / HEAD_UNIT;
    this.hsc = hsc;
    this.eyeMat = createEyeMaterial(eyeAtlas(p.eyeColor, p.heterochromia ? p.eyeColor2 : p.eyeColor, { size: hero ? 512 : 256, seed: p.seed, age: p.age }), this.tierName);
    this.eyeMat.userData.u.uEyeR.value = L.eyeR * hsc;
    this.mouthMat = createMouthMaterial(this.tierName);
    const hc = this.rig.dims.j.headCenter;
    this.mouthMat.userData.u.uFrontZ.value = hc.z + L.mouthZ * hsc;
    this.mouthMat.userData.u.uDepth.value = 0.05 * hsc;

    // Meshes (all bound to the same skeleton). The skin gets its own index so clothing can
    // hide covered body triangles without touching the shared cached geometry.
    const shadows = this.tier.shadows !== false;
    this.skinGeo = this.geo.skin.clone();
    this.skin = this._mesh(this.skinGeo, this.skinMat, shadows);
    this.eyes = this._mesh(this.geo.eyes, this.eyeMat, false);
    this.mouth = this._mesh(this.geo.mouth, this.mouthMat, false);
    this.skin.name = 'skin';

    this.garments = [];
    const t4 = performance.now();
    this.setOutfit({});
    const t5 = performance.now();
    this._buildHair();
    const t6 = performance.now();

    this.animator = new Animator(this);
    this.buildMs = performance.now() - t0;
    this.timing = { rig: t1 - t0, geometry: t2 - t1, paint: t3 - t2, mats: t4 - t3, outfit: t5 - t4, hair: t6 - t5, rest: performance.now() - t6, ...Object.fromEntries(Object.entries(this.geo.timing || {}).map(([k, v]) => [`g.${k}`, v])) };
  }

  _mesh(geometry, material, castShadow) {
    const m = new THREE.SkinnedMesh(geometry, material);
    m.bind(this.skeleton, new THREE.Matrix4());
    m.castShadow = castShadow;
    m.receiveShadow = true;
    m.frustumCulled = false; // skinned bounds are bind-pose; the root moves the whole person
    this.root.add(m);
    return m;
  }

  /** Hide body skin triangles whose cage tag satisfies `hidden(tag)` (used by clothing). */
  hideSkin(hidden) {
    this.skinGeo.setIndex(hidden ? skinIndex(this.geo, hidden) : this.geo.skin.index);
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

  /**
   * Dress the person. `outfit` uses the same keys as the params (top, topColor, print, bottom,
   * bottomColor, shoes, shoesColor, outer, outerColor, hat, hatColor, glasses, wear…); missing
   * keys keep the current values. Covered skin is hidden.
   */
  setOutfit(outfit = {}) {
    Object.assign(this.params, outfit);
    const p = this.params;
    for (const g of this.garments) {
      g.mesh.removeFromParent();
      g.mesh.material.dispose();
      g.release();
    }
    this.garments = [];
    const hidden = new Set();
    const shadows = this.tier.shadows !== false;
    for (const it of outfitGarments(p, this.rig.dims.j, this.rig.dims.s)) {
      const g = garmentGeometry(this.geo, this.rig, it);
      if (!g) continue;
      for (const t of g.hidden) hidden.add(t);
      const mat = createClothMaterial({ fabric: it.fabric, color: it.color, tierName: this.tierName, wear: p.wear, dirt: p.dirtiness, seed: p.seed + this.garments.length * 17, prints: it.prints, sole: it.sole });
      const mesh = this._mesh(g.geometry, mat, shadows);
      mesh.name = it.name;
      this.garments.push({ name: it.name, mesh, release: g.release });
    }
    this.hideSkin(hidden.size ? (t) => hidden.has(t) : null);
    this._buildAccessories();
  }

  /** Hats, glasses, bow tie, hearing aid: rigid meshes parented to bones. */
  _buildAccessories() {
    for (const a of this.accessories || []) {
      a.removeFromParent();
      a.geometry.dispose();
      a.material.dispose();
    }
    this.accessories = [];
    const { items, clip } = buildAccessories(this);
    const R = this.rig;
    for (const it of items) {
      if (it.cloth) {
        const n = it.geometry.attributes.position.count;
        const c = new Float32Array(n * 4);
        for (let v = 0; v < n; v++) {
          c[v * 4] = 1;
          c[v * 4 + 1] = 1.5;
        }
        it.geometry.setAttribute('aCloth', new THREE.BufferAttribute(c, 4));
      }
      const mesh = new THREE.Mesh(it.geometry, it.material);
      const bind = new THREE.Matrix4().compose(R.worldP[it.bone], R.worldQ[it.bone], new THREE.Vector3(1, 1, 1)).invert();
      bind.decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.castShadow = !it.noShadow && this.tier.shadows !== false;
      mesh.receiveShadow = true;
      this.bones[it.bone].add(mesh);
      this.accessories.push(mesh);
    }
    this.hatClip = clip;
    this._applyHatClip();
  }

  _applyHatClip() {
    if (!this.hair) return;
    const u = this.hair.material.userData.u;
    const c = this.hatClip;
    if (!c) {
      u.uClip.value.w = 0;
      return;
    }
    const hc = this.rig.dims.j.headCenter;
    const k = this.hsc;
    u.uClip.value.set(hc.x, hc.y + (c.below) * k, hc.z + c.cz * k, 1);
    u.uClipR.value.set(c.rx * k * 1.04, 1, c.rz * k * 1.04);
  }

  /** (Re)build hair + brows + lashes + facial hair (one mesh, one draw call). */
  _buildHair() {
    if (this.hair) {
      this.hair.removeFromParent();
      this.hair.geometry.dispose();
      this.hair.material.dispose();
      this.hair = null;
    }
    const p = this.params;
    // Buzz cuts and the hairline density come from the skin's scalp mask.
    this.skinMat.userData.u.uScalp.value = p.hairStyle === 'bald' ? 0 : p.hairStyle === 'buzz' ? 0.9 : 0.55;
    const hd = buildHair(p, this.geo.L, this.tierName);
    const fc = buildFaceCards(p, this.geo.L, this.tierName, { hair: hairColor(p, 'hair'), brow: hairColor(p, 'brow'), beard: hairColor(p, 'beard') });
    const nh = hd ? hd.pos.length / 3 : 0;
    const n = nh + fc.nv;
    const hc = this.rig.dims.j.headCenter;
    const k = this.hsc;
    const pos = new Float32Array(n * 3);
    const nrm = new Float32Array(n * 3);
    const tan = new Float32Array(n * 4);
    const uv = new Float32Array(n * 2);
    const cover = new Float32Array(n);
    const tint = new Float32Array(n * 3).fill(1);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const bi = this.rig.boneIndex;
    const head = bi.get('head');
    const setBones = (v, pairs) => {
      pairs = pairs.filter((q) => q[1] > 1e-4);
      let sum = 0;
      for (const q of pairs) sum += q[1];
      if (sum < 1) pairs.push(['head', 1 - sum]);
      pairs = pairs.sort((a2, b2) => b2[1] - a2[1]).slice(0, 4);
      const tot = pairs.reduce((a2, q) => a2 + q[1], 0) || 1;
      pairs.forEach((q, i) => {
        si[v * 4 + i] = bi.get(q[0]) ?? head;
        sw[v * 4 + i] = q[1] / tot;
      });
    };
    const put = (v, P, N, T, U, C) => {
      pos[v * 3] = hc.x + P[0] * k;
      pos[v * 3 + 1] = hc.y + P[1] * k;
      pos[v * 3 + 2] = hc.z + P[2] * k;
      nrm.set(N, v * 3);
      tan.set(T, v * 4);
      uv.set(U, v * 2);
      cover[v] = C;
    };
    const index = [];
    if (hd) {
      for (let v = 0; v < nh; v++) {
        put(v, hd.pos.subarray(v * 3, v * 3 + 3), hd.nrm.subarray(v * 3, v * 3 + 3), hd.tan.subarray(v * 4, v * 4 + 4), hd.uv.subarray(v * 2, v * 2 + 2), hd.cover[v]);
        setBones(v, [['hair.B', hd.wts[v * 4]], ['hair.L', hd.wts[v * 4 + 1]], ['hair.R', hd.wts[v * 4 + 2]], ['hair.T', hd.wts[v * 4 + 3]]]);
      }
      for (const i of hd.index) index.push(i);
    }
    for (let v = 0; v < fc.nv; v++) {
      const o = nh + v;
      put(o, fc.pos.slice(v * 3, v * 3 + 3), fc.nrm.slice(v * 3, v * 3 + 3), fc.tan.slice(v * 4, v * 4 + 4), fc.uv.slice(v * 2, v * 2 + 2), fc.cover[v]);
      tint.set(fc.tint.slice(v * 3, v * 3 + 3), o * 3);
      setBones(o, fc.bones[v].map((q) => q.slice()));
    }
    for (const i of fc.index) index.push(i + nh);
    if (!index.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
    g.setAttribute('aHairUV', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aCover', new THREE.BufferAttribute(cover, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setIndex(index);
    const mat = createHairMaterial(hairColor(p, 'hair'), { tierName: this.tierName, gloss: hd ? hd.gloss : 0.4, curl: hd ? hd.curl : 0 });
    this.hair = this._mesh(g, mat, this.tier.shadows !== false);
    this.hair.name = 'hair';
    this._applyHatClip();
  }

  setDirtiness(v) {
    this.skinMat.userData.u.uDirt.value = v * 0.5;
    for (const g of this.garments) g.mesh.material.userData.u.uDirt.value = v;
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
    for (const g of this.garments) {
      g.mesh.material.dispose();
      g.release();
    }
    this.skinGeo.dispose();
    releaseGeometry(this.geo);
    releaseFace(this.face);
    for (const m of [this.skinMat, this.eyeMat, this.mouthMat]) m.dispose();
    if (this.hair) {
      this.hair.geometry.dispose();
      this.hair.material.dispose();
    }
    for (const a of this.accessories || []) {
      a.geometry.dispose();
      a.material.dispose();
    }
    this.skeleton.dispose();
  }

  // ---- internals ------------------------------------------------------------------------------

  _updateEyeUniforms() {
    const u = this.eyeMat.userData.u;
    for (let k = 0; k < 2; k++) this.bones[k ? 'eye.R' : 'eye.L'].getWorldPosition(u.uEyeC.value[k]);
    this.bones.head.getWorldQuaternion(_q);
    u.uHeadUp.value.set(0, 1, 0).applyQuaternion(_q);
    u.uHeadFwd.value.set(0, 0, 1).applyQuaternion(_q);
    const L = this.geo.L;
    const lids = this.animator.face.lidState;
    u.uLidU.value.set(Math.sin(L.lidUpper - lids.upperL), Math.sin(L.lidUpper - lids.upperR));
    this.mouthMat.userData.u.uOpen.value = this.animator.face.mouthOpen;
    void _v;
  }
}

// Garment geometry cache (crowds in uniforms share their shirts).
const garmentCache = new Map();
function garmentGeometry(rec, rig, it) {
  const key = `${rec.key}|${it.name}|${it.extraOff}`;
  let c = garmentCache.get(key);
  if (!c) {
    const g = buildGarment(rec, rig, it.spec, { extraOff: it.extraOff, s: rig.dims.s });
    if (!g) return null;
    c = { ...g, refs: 0 };
    garmentCache.set(key, c);
  }
  c.refs++;
  return {
    geometry: c.geometry,
    hidden: c.hidden,
    release: () => {
      if (--c.refs <= 0) {
        garmentCache.delete(key);
        c.geometry.dispose();
      }
    },
  };
}
