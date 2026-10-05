// HumanModel: one realistic person (MakeHuman CC0 body + our skin, eyes, hair, clothes and rig).
// Drop-in for the old primitive PersonModel / Avatar: has .root, .head, .mouth and animate().
import * as THREE from 'three';
import { loadHumanData } from './data.js';
import { MODEL_H, bodyShape, buildSkeleton, groupGeometry, topology } from './body.js';
import { skinRegions } from './regions.js';
import { createSkinMaterial } from './skin.js';
import { createEyeMaterial, createEye, createLashMaterial, pupilFor } from './eyes.js';
import { garmentGeometry, createFabricMaterial, visibleBodyIndex, GARMENTS } from './clothes.js';
import { withExpressions, NEXPR } from './expr.js';
import { HumanRig } from './rig.js';
import { buildHair } from './hair.js';
import { shoeGeometry, createShoeMaterial, SOLE_H } from './shoes.js';
import { rng } from '../core/noise.js';

export { MODEL_H };
export async function initHumans() { await loadHumanData(); skinRegions(); }

// a tiny bit of every face is unique: random nose, lips, eyes, jaw, cheekbones, ears, brows, head shape
const FACE_PAIRS = [
  ['nose-scale-horiz', 0.45], ['nose-scale-vert', 0.35], ['nose-scale-depth', 0.35], ['nose-hump', 0.4], ['nose-point-width', 0.4], ['nose-nostrils-width', 0.4], ['nose-base', 0.3, 'down', 'up'], ['nose-point', 0.3, 'down', 'up'],
  ['mouth-scale-horiz', 0.35], ['mouth-lowerlip-volume', 0.45], ['mouth-upperlip-volume', 0.45], ['mouth-cupidsbow', 0.35], ['mouth-angles', 0.25, 'down', 'up'],
  ['chin-prominent', 0.4], ['chin-width', 0.4], ['chin-height', 0.3], ['chin-bones', 0.3],
  ['forehead-scale-vert', 0.3], ['forehead-temple', 0.3],
  ['head-fat', 0.35], ['head-scale-horiz', 0.25], ['head-scale-vert', 0.2], ['head-angle', 0.3, 'in', 'out'],
  ['neck-scale-horiz', 0.25], ['eyebrows-angle', 0.3, 'down', 'up'], ['eyebrows-trans', 0.25, 'down', 'up'],
];
const FACE_SIDES = [['eye-scale', 0.3], ['eye-trans', 0.25, 'in', 'out'], ['eye-height2', 0.35], ['eye-bag', 0.3], ['eye-corner1', 0.3, 'down', 'up'], ['ear-scale', 0.35], ['ear-flap', 0.35], ['ear-lobe', 0.35], ['cheek-bones', 0.35], ['cheek-volume', 0.35]];
const SHAPES = { round: 'head-round', long: 'head-oval', square: 'head-square' };

function faceDetails(seed, faceShape) {
  const r = rng(seed); const d = {};
  const gauss = () => (r() + r() + r() - 1.5) * 1.15;
  const put = (base, sd, a = 'decr', b = 'incr', side = '') => {
    const v = THREE.MathUtils.clamp(gauss() * sd, -1, 1);
    if (Math.abs(v) < 0.02) return;
    d[`d/${side}${base}-${v > 0 ? b : a}`] = Math.abs(v);
  };
  for (const [n, sd, a, b] of FACE_PAIRS) put(n, sd, a, b);
  for (const [n, sd, a, b] of FACE_SIDES) {
    const v = THREE.MathUtils.clamp(gauss() * sd, -1, 1), asym = (r() - 0.5) * 0.08; // faces are never perfectly symmetric
    for (const [side, k] of [['l-', 1 + asym], ['r-', 1 - asym]]) if (Math.abs(v) > 0.02) d[`d/${side}${n}-${v > 0 ? (b || 'incr') : (a || 'decr')}`] = Math.abs(v) * k;
  }
  if (SHAPES[faceShape]) d['d/' + SHAPES[faceShape]] = 0.45;
  return d;
}

// ancestry mix from skin tone (people are mixes; tone alone doesn't decide it, so add randomness)
function raceFor(tone, r) {
  const c = new THREE.Color(tone); const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; // linear lum
  const af = THREE.MathUtils.clamp((0.22 - l) / 0.2, 0, 1), rest = 1 - af;
  const as = rest * (0.2 + r() * 0.6);
  return { african: af * 0.85 + 0.05, asian: as, caucasian: Math.max(0.05, rest - as) };
}

export class HumanModel {
  /**
   * look: { skin, hair, hairStyle, eyes, top, topStyle ('tee'|'shirt'|'hoodie'|'longsleeve'), pants,
   *         pantsStyle ('jeans'|'shorts'|'sweats'), shoes, socks, gender 0..1, age (yrs), build, muscle, weight,
   *         face ('round'|'long'|'square'), seed, freckles, detail ('full'|'basic') }
   */
  constructor(look = {}) {
    this.root = new THREE.Group();
    this.root.name = 'human';
    this.body = new THREE.Group(); this.root.add(this.body); // the old models moved this for sitting
    this.mouth = new THREE.Object3D(); // compat: scale.y > 1 means "talking"
    this.walk = 0; this.time = 0;
    this.mood = 'neutral'; this.lookAt = null; this.brightness = 0.6; this.flush = 0;
    this.build(look);
  }

  build(look) {
    this.dispose(true);
    const L = this.look = { ...look };
    const seed = L.seed ?? 7;
    const r = rng(seed * 13 + 1);
    const build = L.build ?? 1;
    const p = {
      gender: L.gender ?? 0.5,
      age: L.age ?? 30,
      muscle: L.muscle ?? THREE.MathUtils.clamp(0.5 + (build - 1) * 0.6, 0, 1),
      weight: L.weight ?? THREE.MathUtils.clamp(0.5 + (build - 1) * 1.1, 0, 1),
      race: L.race || raceFor(L.skin || '#c68a64', r),
      details: { ...faceDetails(seed, L.face), ...(L.details || {}) },
    };
    const shape = this.shape = bodyShape(p);
    const sk = this.sk = buildSkeleton(shape);
    const reg = skinRegions();
    this.dorsal = reg.dorsal;
    // the skeleton + every skinned part live in this group (raised by the shoe soles)
    const g = this.skelParent = new THREE.Group();
    const hs = L.height ?? 1; g.scale.setScalar(hs);
    this.body.add(g); g.add(sk.root);
    const full = L.detail !== 'basic';
    // ---- clothes ----
    const top = { shirt: 'tee', tee: 'tee', hoodie: 'hoodie', longsleeve: 'longsleeve' }[L.topStyle || 'tee'] || 'tee';
    const bottom = { jeans: 'jeans', shorts: 'shorts', sweats: 'sweats' }[L.pantsStyle || 'jeans'] || 'jeans';
    const garments = [
      { style: 'socks', color: L.socks || '#e8e8e8' },
      { style: bottom, color: L.pants || '#2b3a55' },
      { style: top, color: L.top || '#2f3b52' },
    ].map((x) => ({ ...x, geo: garmentGeometry(shape, x.style, x.style === top ? [bottom] : []) }));
    const shoes = L.shoes !== null && L.shoes !== 'none';
    const sole = shoes ? SOLE_H : 0;
    g.position.y = sole * hs;
    // ---- body ----
    this.faceW = new Float32Array(NEXPR);
    const skin = this.skinMat = createSkinMaterial({ tone: L.skin || '#c68a64', hair: L.hair || '#2b1d14', freckles: L.freckles ?? (r() < 0.2 ? 0.25 + r() * 0.5 : 0), age: THREE.MathUtils.clamp((p.age - 20) / 50, 0, 1), seed, stubble: L.hairStyle === 'buzz' ? 1 : L.hairStyle === 'bald' ? 0.12 : 0.85 });
    const exprU = [withExpressions(skin, this.faceW, shape.k)];
    const bg = groupGeometry(shape, 'body');
    bg.setAttribute('aSkinA', reg.aSkinA); bg.setAttribute('aSkinB', reg.aSkinB); bg.setAttribute('aNail', reg.aNail); bg.setAttribute('aBrow', reg.aBrow);
    bg.setAttribute('aExpr', exprAttr('body'));
    bg.setIndex(visibleBodyIndex(garments.map((x) => x.geo)));
    this.parts = [];
    const add = (geo, mat, shadow = true) => {
      const m = new THREE.SkinnedMesh(geo, mat); m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true;
      g.add(m); this.parts.push(m); return m;
    };
    this.bodyMesh = add(bg, skin);
    this.fabrics = [];
    for (const x of garments) { const fm = createFabricMaterial(GARMENTS[x.style].kind, x.color); this.fabrics.push(fm); add(x.geo, fm); }
    if (shoes) { const sm = createShoeMaterial(L.shoes || '#e9e9e9'); this.fabrics.push(sm); add(shoeGeometry(shape), sm); }
    if (full) {
      for (const n of ['lashL', 'lashR']) {
        const lm = createLashMaterial(topology(n), L.hair ? new THREE.Color(L.hair).multiplyScalar(0.45) : '#120c08');
        exprU.push(withExpressions(lm, this.faceW, shape.k));
        const geo = groupGeometry(shape, n); geo.setAttribute('aExpr', exprAttr(n)); add(geo, lm, false);
      }
      const enamel = new THREE.MeshPhysicalMaterial({ color: 0xeee6d6, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15, sheen: 0.2 });
      const tongue = new THREE.MeshPhysicalMaterial({ color: 0xb8605c, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      for (const [n, m] of [['teethUp', enamel], ['teethLo', enamel], ['tongue', tongue]]) {
        const mm = m.clone(); exprU.push(withExpressions(mm, this.faceW, shape.k));
        const geo = groupGeometry(shape, n); geo.setAttribute('aExpr', exprAttr(n)); add(geo, mm, false);
      }
    }
    this.exprU = exprU;
    this.root.updateMatrixWorld(true);
    for (const m of this.parts) m.bind(sk.skeleton);
    // ---- eyes ----
    const head = this.head = sk.byName.head;
    this.eyes = [];
    for (const eg of ['eyeL', 'eyeR']) {
      const src = [...new Set(topology(eg).src)];
      const c = new THREE.Vector3(); for (const v of src) c.add(_p(shape.pos, v)); c.multiplyScalar(1 / src.length);
      let R = 0; for (const v of src) R += c.distanceTo(_p(shape.pos, v)); R /= src.length;
      const em = createEyeMaterial({ iris: L.eyes || '#4a3121', seed: seed + (eg === 'eyeL' ? 1 : 2) });
      const eye = createEye(R * 0.97, em); eye.position.copy(c).sub(head.userData.head); head.add(eye);
      this.eyes.push(eye);
    }
    // ---- hair ----
    this.hair = buildHair(shape, sk, L.hairStyle || 'short', L.hair || '#2b1d14', seed);
    if (this.hair) head.add(this.hair);
    this.rig = new HumanRig(sk, this);
    this.updateScale();
  }

  // the skin/fabric shaders need to know how big a model unit is in the world (for bump detail)
  updateScale() {
    const s = new THREE.Vector3(); this.root.updateWorldMatrix(true, false); this.root.matrixWorld.decompose(_tmpV, _tmpQ, s);
    const k = s.x * (this.look.height ?? 1);
    this.skinMat.userData.u.uObjScale.value = k;
    for (const f of this.fabrics) if (f.userData.u?.uObjScaleF) f.userData.u.uObjScaleF.value = k;
    this._scale = k;
  }

  /** Full update. o: { state, speed, grounded, crouch, talking, mood, lookAt, brightness } */
  update(dt, o = {}) {
    this.time += dt;
    const f = this.rig.update(dt, { mood: this.mood, lookAt: this.lookAt, ...o });
    this.faceW.set(f);
    for (const [i, e] of this.eyes.entries()) {
      e.rotation.set(this.rig.eyePitch, this.rig.eyeYaw + (i === 0 ? -0.02 : 0.02), 0);
      const pu = e.material.userData.u.uPupil; pu.value += (pupilFor(o.brightness ?? this.brightness) - pu.value) * Math.min(1, dt * 2.5);
    }
    this.skinMat.userData.u.uFlush.value += ((o.mood === 'fear' || this.mood === 'fear' ? -0.6 : 0) + this.flush - this.skinMat.userData.u.uFlush.value) * Math.min(1, dt * 0.8);
    if ((this._scaleT = (this._scaleT || 0) - dt) <= 0) { this._scaleT = 0.5; this.updateScale(); }
  }

  // ---- compat with the old PersonModel / Avatar ----
  animate(dt, a, b, c) {
    if (typeof b === 'string') { // PersonModel.animate(dt, speed, state, t)
      const state = b === 'flee' ? 'run' : b;
      this.update(dt, { state, speed: state === 'run' ? 1.8 : a, talking: this.mouth.scale.y > 1.01 || this.talking });
    } else { // Avatar.animate(dt, horizontal speed (m/s at size 1), grounded, crouch)
      const sp = a / 1.4;
      this.update(dt, { state: sp > 0.1 ? (sp > 2.2 ? 'run' : 'walk') : 'idle', speed: sp > 2.2 ? 1.8 : sp, grounded: b, crouch: c, talking: this.talking });
    }
  }
  setLook(look) { this.build({ ...this.look, ...look }); }

  dispose(keepRoot) {
    if (!this.parts) return;
    for (const m of this.parts) { m.geometry.dispose(); m.material.dispose(); }
    this.eyes?.forEach((e) => e.material.dispose());
    if (this.hair) this.hair.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.body.clear(); this.parts = null;
    if (!keepRoot) this.root.removeFromParent();
  }
}

const _tmpV = new THREE.Vector3(), _tmpQ = new THREE.Quaternion();
function _p(pos, v) { return new THREE.Vector3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
const _exprAttrs = {};
import { exprAttribute } from './expr.js';
function exprAttr(n) { return _exprAttrs[n] || (_exprAttrs[n] = exprAttribute(n)); }
