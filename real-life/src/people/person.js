// Person: a real-proportioned body (Quaternius Ultimate Modular Men/Women, CC0) + its animation
// brain. Used for the player's own body, family, neighbours, store workers...
// Gameplay moves `person.root` (feet on the ground, facing +Z); the person animates on top.
//
//   await preloadPeople()                       // once, before making people
//   const p = new Person(look, age, { name })
//   scene.add(p.root)
//   p.setMotion({ speed, grounded })            // m/s along the facing direction
//   p.pose = 'stand' | 'sit' | 'lie' | 'crawl' | 'carry' | 'sleep'
//   p.mood = 'happy' | 'neutral' | 'sad' | 'angry' | 'scared' | 'sleepy' | 'sick'
//   p.talk(seconds)                             // talking gestures
//   p.play('wave' | 'nod' | 'shake' | 'shrug' | 'pickup' | 'interact' | 'punch' | 'kick' | 'hit' | 'cry' | 'jump' | 'eat' | 'drink' ...)
//   p.lookAt(worldPoint | null)
//   p.hold(object3D | null)                     // in the right hand
//   p.setAge(age)                               // kid/teen/adult/old proportions
//   p.update(dt)
//
// Bodies are mixed from parts (head / body / legs / feet) of different outfits, and every
// material is recoloured from the person's look (skin tone, hair, clothes) so no two people
// in town look the same.

import * as THREE from 'three';
import { assets } from '../gfx/assets.js';
import { bodyAt, skinColor } from './look.js';
import { clamp, damp } from '../core/util.js';

export const OUTFITS = {
  m: ['casual-2', 'casual-hoodie', 'beach', 'farmer', 'punk', 'suit', 'worker', 'adventurer', 'swat'],
  f: ['casual', 'formal', 'suit', 'worker', 'punk', 'adventurer', 'soldier'],
};
const PARTS = ['head', 'body', 'legs', 'feet'];
function partOf(nodeName) {
  const n = (nodeName || '').toLowerCase();
  if (n.endsWith('_head')) return 'head';
  if (n.endsWith('_body')) return 'body';
  if (n.endsWith('_legs') || n.endsWith('_pants')) return 'legs';
  if (n.endsWith('_feet')) return 'feet';
  if (n === 'backpack') return 'body';
  return null; // pistols etc: never shown
}

const SKIN_MATS = new Set(['Skin']);
const SKIN_DARK_MATS = new Set(['Skin_Darker']);
const HAIR_MATS = new Set(['Hair', 'Hair_Brown', 'Hair_Blond', 'Hair_White', 'Moustache']);
const BROW_MATS = new Set(['Eyebrows']);
const KEEP_MATS = new Set(['Eye', 'Brown', 'Earrings', 'Gold', 'Metal', 'Metal_Dark', 'Visor', 'Tie']);

let animSets = null; // sex -> { clipName: clip }
let ready = false;

/** Load every body + both animation sets (~7 MB, once). */
export async function preloadPeople(onProgress) {
  if (ready) return;
  const list = [['humans', 'anims-m'], ['humans', 'anims-f']];
  for (const sex of ['m', 'f']) for (const o of OUTFITS[sex]) list.push(['humans', `${sex}-${o}`]);
  await assets.preload(list, onProgress);
  animSets = {};
  for (const sex of ['m', 'f']) {
    animSets[sex] = {};
    for (const c of assets.clips('humans', `anims-${sex}`)) animSets[sex][c.name] = c;
  }
  ready = true;
}

export function peopleReady() {
  return ready;
}

/** Which outfit parts a look uses (deterministic from the look). */
export function partsFor(look, age) {
  const sex = look.sex === 'f' ? 'f' : 'm';
  const list = OUTFITS[sex];
  const o = look.outfit || {};
  const pick = (v, fallback) => (list.includes(v) ? v : fallback);
  let head = pick(o.head, headForHair(look));
  // Kids and teens never get work helmets, moustaches or beards.
  if (age < 18 && ['worker', 'adventurer', 'swat', 'soldier'].includes(head)) head = sex === 'm' ? 'casual-2' : 'casual';
  return {
    head,
    body: pick(o.body, sex === 'm' ? 'casual-hoodie' : 'casual'),
    legs: pick(o.legs, sex === 'm' ? 'casual-2' : 'casual'),
    feet: pick(o.feet, sex === 'm' ? 'casual-2' : 'casual'),
  };
}

function headForHair(look) {
  const s = look.hairStyle;
  if (look.sex === 'f') {
    if (['bun', 'ponytail', 'braids'].includes(s)) return 'formal';
    if (s === 'short' || s === 'bob') return 'suit';
    if (s === 'afro' || s === 'curly') return 'punk';
    return 'casual';
  }
  if (s === 'bald' || s === 'buzz') return 'suit';
  if (s === 'long' || s === 'messy') return 'beach';
  if (s === 'spiky') return 'punk';
  if (s === 'curly' || s === 'afro') return 'casual-hoodie';
  return 'casual-2';
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _qm = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qd = new THREE.Quaternion();

// Model height (bind pose, feet to top of head) before scaling, measured once per sex.
const MODEL_H = { m: 1.8, f: 1.7 };
const measured = { m: false, f: false };

export class Person {
  constructor(look, age, { name = '', tier = null } = {}) {
    if (!ready) throw new Error('preloadPeople() first');
    this.look = look;
    this.age = age;
    this.name = name;
    this.tier = tier;
    this.sex = look.sex === 'f' ? 'f' : 'm';
    this.root = new THREE.Group();
    this.root.name = name || 'person';
    this.root.userData.person = this;
    this.speed = 0;
    this.grounded = true;
    this.pose = 'stand';
    this.mood = 'neutral';
    this.held = null;
    this.hideHead = false;
    this.t = Math.random() * 10;
    this._talk = 0;
    this._act = null; // procedural one-shot { name, t, dur }
    this._look = null;
    this._lookW = 0;
    this._poseW = {};
    this._headYaw = 0;
    this._headPitch = 0;
    this._build();
  }

  // ---------------------------------------------------------------------------------------------
  // Building the body

  _build() {
    if (this.model) this._disposeModel();
    const sex = this.sex;
    const parts = partsFor(this.look, this.age);
    this.parts = parts;
    // The skeleton comes from the body outfit; other parts are re-bound to it by bone name.
    const base = assets.model('humans', `${sex}-${parts.body}`, { scale: 1 });
    const bones = {};
    base.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
    });
    this.bones = bones;
    const keep = new Map(); // part -> [meshes]
    const drop = [];
    base.traverse((o) => {
      if (!o.isMesh) return;
      const owner = partNode(o);
      const part = owner ? partOf(owner.name) : null;
      if (!part || parts[part] !== parts.body) drop.push(o);
      else push(keep, part, o);
    });
    for (const o of drop) o.removeFromParent();
    const attachTo = (keep.get('body') || [])[0]?.parent || base.children[0];
    for (const part of PARTS) {
      if (parts[part] === parts.body) continue;
      const src = assets.model('humans', `${sex}-${parts[part]}`, { scale: 1 });
      const found = [];
      src.traverse((o) => {
        if (o.isSkinnedMesh && partOf(partNode(o)?.name) === part) found.push(o);
      });
      for (const mesh of found) {
        const sk = new THREE.Skeleton(mesh.skeleton.bones.map((b) => bones[b.name] || b), mesh.skeleton.boneInverses);
        const bindMatrix = mesh.bindMatrix.clone();
        mesh.removeFromParent();
        attachTo.add(mesh);
        mesh.bind(sk, bindMatrix);
        push(keep, part, mesh);
      }
    }
    this.meshes = keep;
    this.model = base;
    this.root.add(base);
    this._recolor();
    this.mixer = new THREE.AnimationMixer(base);
    this.clips = animSets[sex];
    this.actions = {};
    this._loco = null;
    this._locoAction = null;
    this._oneShot = null;
    this._rest = {};
    for (const [n, b] of Object.entries(bones)) this._rest[n] = b.quaternion.clone();
    // The rig's feet are IK targets, not children of the shins. Remember where each foot sits
    // relative to its shin so posing/shrinking the legs can carry the feet along (FK feet).
    base.updateMatrixWorld(true);
    this._footRel = {};
    for (const side of ['L', 'R']) {
      const shin = bones[`LowerLeg${side}`];
      const foot = bones[`Foot${side}`];
      if (shin && foot) this._footRel[side] = new THREE.Matrix4().copy(shin.matrixWorld).invert().multiply(foot.matrixWorld);
    }
    if (!measured[sex] && bones.Head) {
      base.updateMatrixWorld(true);
      MODEL_H[sex] = bones.Head.getWorldPosition(_v).y + 0.25; // head bone sits at the jaw
      measured[sex] = true;
    }
    this._applyAge();
    this._setLoco('Idle', 0);
    if (this.held) this.hold(this.held);
    this.setHeadVisible(!this.hideHead);
  }

  _recolor() {
    const L = this.look;
    const skin = new THREE.Color(skinColor(L));
    const hair = new THREE.Color(L.hair || '#3a2719');
    const brows = hair.clone().multiplyScalar(0.6);
    const outfit = L.outfit || {};
    for (const [part, list] of this.meshes) {
      // The largest clothing material of each part takes the outfit colour.
      let main = null;
      let mainCount = 0;
      for (const m of list) {
        const name = m.material.name;
        if (SKIN_MATS.has(name) || HAIR_MATS.has(name) || KEEP_MATS.has(name) || BROW_MATS.has(name) || SKIN_DARK_MATS.has(name)) continue;
        const c = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
        if (c > mainCount) {
          mainCount = c;
          main = m;
        }
      }
      for (const m of list) {
        const mat = m.material.clone();
        const name = mat.name;
        mat.metalness = Math.min(mat.metalness ?? 0, 0.05);
        mat.roughness = Math.max(mat.roughness ?? 1, 0.62);
        if (SKIN_MATS.has(name)) mat.color.copy(skin);
        else if (SKIN_DARK_MATS.has(name)) mat.color.copy(skin).multiplyScalar(0.82);
        else if (HAIR_MATS.has(name)) mat.color.copy(name === 'Hair_Blond' ? hair.clone().lerp(new THREE.Color('#e9d7a8'), 0.15) : hair);
        else if (BROW_MATS.has(name)) mat.color.copy(brows);
        else if (m === main) {
          const hex = part === 'body' ? outfit.topColor : part === 'legs' ? outfit.bottomColor : part === 'feet' ? outfit.shoeColor : null;
          if (hex) mat.color.set(hex);
        }
        m.material = mat;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
    }
  }

  setLook(look) {
    this.look = look;
    this.sex = look.sex === 'f' ? 'f' : 'm';
    this._build();
  }

  setAge(age) {
    const before = partsFor(this.look, this.age);
    this.age = age;
    const after = partsFor(this.look, age);
    if (PARTS.some((p) => before[p] !== after[p])) this._build();
    else this._applyAge();
  }

  /** Height + kid proportions (bigger head, shorter legs) from age and genes. */
  _applyAge() {
    const dims = bodyAt(this.look, this.age);
    this.dims = dims;
    this.stage = dims.stage;
    this.height = dims.height;
    const a = this.age;
    const head = a < 1 ? 1.5 : a < 3 ? 1.4 : a < 6 ? 1.28 : a < 10 ? 1.19 : a < 14 ? 1.1 : a < 17 ? 1.04 : 1;
    const legs = a < 1 ? 0.72 : a < 3 ? 0.78 : a < 6 ? 0.86 : a < 10 ? 0.92 : a < 14 ? 0.96 : 1;
    const arms = a < 3 ? 0.84 : a < 8 ? 0.93 : 1;
    const wide = 0.93 + clamp(dims.build, 0, 1) * 0.16 + (a < 3 ? 0.08 : 0);
    this._shape = { head, legs, arms, wide };
    const H = MODEL_H[this.sex];
    const legShare = 0.47;
    const headShare = 0.13;
    const shapedH = H * (1 - legShare - headShare + legShare * legs + headShare * head);
    this._scale = dims.height / shapedH;
    this.model.scale.setScalar(this._scale);
    this._applyShape();
  }

  _applyShape() {
    const b = this.bones;
    const S = this._shape;
    if (!b.Head) return;
    b.Head.scale.setScalar(S.head);
    for (const side of ['L', 'R']) {
      b[`UpperLeg${side}`]?.scale.setScalar(S.legs);
      b[`UpperArm${side}`]?.scale.setScalar(S.arms);
    }
    b.Abdomen?.scale.set(S.wide, 1, S.wide);
    const back = 1 / Math.sqrt(S.wide);
    b.Chest?.scale.set(back, 1, back);
  }

  setHeadVisible(v) {
    this.hideHead = !v;
    for (const m of this.meshes.get('head') || []) m.visible = v;
  }

  // ---------------------------------------------------------------------------------------------
  // Animation control

  _clip(name) {
    if (!this.actions[name]) {
      const clip = this.clips[name];
      if (!clip) return null;
      this.actions[name] = this.mixer.clipAction(clip);
    }
    return this.actions[name];
  }

  _setLoco(name, fade = 0.25) {
    if (this._loco === name) return;
    const next = this._clip(name);
    if (!next) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (this._locoAction && fade > 0) this._locoAction.crossFadeTo(next, fade, false);
    else if (this._locoAction) this._locoAction.stop();
    this._loco = name;
    this._locoAction = next;
  }

  setMotion({ speed = 0, grounded = true } = {}) {
    this.speed = speed;
    this.grounded = grounded;
  }

  talk(seconds = 1.5) {
    this._talk = Math.max(this._talk, seconds);
  }

  /** One-shot actions. Clip-based ones use the rig's animations; the rest are procedural. */
  play(name, { duration } = {}) {
    const CLIP = { wave: 'Wave', interact: 'Interact', pickup: 'Interact', punch: 'Punch_Right', punchL: 'Punch_Left', kick: 'Kick_Right', hit: 'HitRecieve', hit2: 'HitRecieve_2', die: 'Death', roll: 'Roll' };
    const clipName = CLIP[name];
    const a = clipName ? this._clip(clipName) : null;
    if (a) {
      if (this._oneShot && this._oneShot !== a) this._oneShot.fadeOut(0.15);
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = name === 'die';
      a.setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.15).play();
      this._oneShot = a;
      this._oneShotName = name;
      this._oneShotEnd = (duration ?? a.getClip().duration) - 0.2;
      this._oneShotT = 0;
      return;
    }
    const DUR = { nod: 1.0, shake: 1.1, shrug: 1.2, cry: 3.0, jump: 0.6, eat: 1.6, drink: 1.6, laugh: 1.6, point: 1.4, facepalm: 1.6, cheer: 1.4, clap: 1.6 };
    this._act = { name, t: 0, dur: duration ?? DUR[name] ?? 1 };
  }

  get busy() {
    return !!(this._act || this._oneShot);
  }

  lookAt(point) {
    this._look = point ? (this._look || new THREE.Vector3()).copy(point) : null;
  }

  hold(obj) {
    if (this.held && this.held !== obj) this.held.removeFromParent();
    this.held = obj;
    if (!obj) return;
    const hand = this.bones['WristR'];
    if (!hand) return;
    hand.add(obj);
    // Undo the body scale so the item keeps its real size.
    const s = 1 / (this._scale * (this._shape?.arms || 1));
    obj.scale.setScalar(s * (obj.userData.baseScale || 1));
    obj.position.set(0, 0.1, 0.02);
  }

  // ---------------------------------------------------------------------------------------------
  // Per frame

  update(dt) {
    this.t += dt;
    const sizeK = this.height / 1.75;
    const sp = this.speed;
    const seated = this.pose === 'lie' || this.pose === 'sleep' || this.pose === 'sit';
    if (!seated && this.pose !== 'crawl' && sp > 2.6 * sizeK) {
      this._setLoco('Run');
      this._locoAction.timeScale = clamp(sp / (4.2 * sizeK), 0.7, 1.5);
    } else if (!seated && sp > 0.15) {
      this._setLoco('Walk');
      this._locoAction.timeScale = clamp(sp / (1.35 * sizeK), 0.5, 1.6);
    } else {
      this._setLoco(this.mood === 'sad' || this.mood === 'sleepy' || this.mood === 'sick' || seated ? 'Idle_Neutral' : 'Idle');
      if (this._locoAction) this._locoAction.timeScale = 1;
    }
    // A one-shot (wave, punch...) takes over the body; `weight` multiplies with any running crossfade.
    if (this._locoAction) this._locoAction.weight = this._oneShot ? 1 - 0.95 * this._oneShot.getEffectiveWeight() : 1;
    if (this._oneShot) {
      this._oneShotT += dt;
      if (this._oneShotT >= this._oneShotEnd && !this._oneShot.clampWhenFinished) {
        this._oneShot.fadeOut(0.2);
        this._oneShot = null;
      }
    }
    // Bones the clips don't animate would otherwise collect the procedural offsets every frame.
    for (const n in this._rest) this.bones[n].quaternion.copy(this._rest[n]);
    this.mixer.update(dt);
    this._applyShape();
    this._procedural(dt);
  }

  /** Bone rotations layered on top of the clip: poses, mood, talking, head look, small actions. */
  _procedural(dt) {
    const b = this.bones;
    for (const p of ['sit', 'lie', 'crawl', 'carry', 'sleep']) {
      this._poseW[p] = damp(this._poseW[p] || 0, this.pose === p ? 1 : 0, 0.12, dt);
    }
    const W = this._poseW;
    this.model.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    if (W.sit > 0.01) this._poseSit(W.sit);
    if (W.crawl > 0.01) this._poseCrawl(W.crawl);
    if (W.carry > 0.01) this._poseCarry(W.carry);
    const lieW = Math.max(W.lie, W.sleep);
    if (lieW > 0.01) this._poseLie(lieW);

    const slump = { sad: 0.18, sleepy: 0.14, sick: 0.1, scared: 0.08 }[this.mood] || 0;
    if (slump) {
      rot(b.Neck, slump * 1.4, 0, 0);
      rot(b.Chest, slump * 0.6, 0, 0);
    }
    if (this.mood === 'angry') rot(b.Chest, -0.05, 0, 0);

    const act = this._act;
    if (act) {
      act.t += dt;
      const k = clamp(act.t / act.dur, 0, 1);
      const env = clamp(Math.min(act.t / 0.3, (act.dur - act.t) / 0.35), 0, 1); // ease in, hold, ease out
      switch (act.name) {
        case 'nod':
          rot(b.Head, Math.sin(k * Math.PI * 4) * 0.22 * env, 0, 0);
          break;
        case 'shake':
          rot(b.Head, 0, Math.sin(k * Math.PI * 5) * 0.35 * env, 0);
          break;
        case 'shrug':
          this._bend(b.ShoulderL, 0, 0, 0.25 * env);
          this._bend(b.ShoulderR, 0, 0, -0.25 * env);
          rot(b.Head, 0, 0, 0.12 * env);
          break;
        case 'cry':
          rot(b.Neck, 0.45 * env, 0, 0);
          this._handToFace('L', env);
          this._handToFace('R', env);
          rot(b.Chest, 0.04 * Math.sin(this.t * 14) * env, 0, 0);
          break;
        case 'laugh':
          rot(b.Chest, -0.12 * env + 0.04 * Math.sin(this.t * 18) * env, 0, 0);
          rot(b.Head, -0.18 * env, 0, 0);
          break;
        case 'facepalm':
          this._handToFace('R', env);
          rot(b.Neck, 0.25 * env, 0, 0);
          break;
        case 'eat':
        case 'drink':
          this._handToFace('R', env * (0.75 + 0.25 * Math.sin(k * Math.PI * 3)));
          rot(b.Head, act.name === 'drink' ? -0.3 * env : 0.05 * env, 0, 0);
          break;
        case 'point':
          this._bend(b.UpperArmR, -1.45 * env, 0, -0.2 * env);
          break;
        case 'cheer':
        case 'clap':
          this._bend(b.UpperArmL, -2.6 * env, 0, 0.3 * env);
          this._bend(b.UpperArmR, -2.6 * env, 0, -0.3 * env);
          break;
        case 'jump':
          this.model.position.y += Math.sin(Math.PI * k) * 0.25;
          break;
      }
      if (act.t >= act.dur) this._act = null;
    }

    if (this._talk > 0) {
      this._talk -= dt;
      const tt = this.t;
      rot(b.Head, Math.sin(tt * 6.3) * 0.05 + Math.sin(tt * 2.1) * 0.04, Math.sin(tt * 1.7) * 0.08, 0);
      if (this.pose === 'stand' && this.speed < 0.2 && !act && !this._oneShot) {
        const g = 0.5 + 0.5 * Math.sin(tt * 2.4);
        this._bend(b.LowerArmR, -0.7 * g, 0, 0);
        this._bend(b.LowerArmL, -0.45 * (1 - g), 0, 0);
      }
    }

    // Head look-at (neck + head share the turn, limited like a real neck).
    let yaw = 0;
    let pitch = 0;
    this._lookW = damp(this._lookW, this._look ? 1 : 0, 0.18, dt);
    if (this._look && b.Head) {
      this.root.updateMatrixWorld(true);
      b.Head.getWorldPosition(_v);
      _v2.copy(this._look).sub(_v);
      _m.copy(this.root.matrixWorld).invert();
      _v2.transformDirection(_m);
      yaw = clamp(Math.atan2(_v2.x, _v2.z), -1.2, 1.2);
      pitch = clamp(-Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z)), -0.6, 0.6);
    }
    this._headYaw = damp(this._headYaw, yaw * this._lookW, 0.1, dt);
    this._headPitch = damp(this._headPitch, pitch * this._lookW, 0.1, dt);
    if (Math.abs(this._headYaw) + Math.abs(this._headPitch) > 0.001) {
      rot(b.Neck, this._headPitch * 0.4, this._headYaw * 0.4, 0);
      rot(b.Head, this._headPitch * 0.6, this._headYaw * 0.6, 0);
    }
    this._feetFollow();
  }

  _poseSit(w) {
    const b = this.bones;
    for (const side of ['L', 'R']) {
      this._bend(b[`UpperLeg${side}`], POSE.sitThigh * w, 0, 0);
      this._bend(b[`LowerLeg${side}`], POSE.sitShin * w, 0, 0);
      this._bend(b[`Foot${side}`], -0.2 * w, 0, 0);
    }
    const k = this.height / 1.75;
    this.model.position.y -= w * POSE.sitDrop * k;
    this.model.position.z -= w * POSE.sitBack * k;
  }

  _poseCrawl(w) {
    const b = this.bones;
    const h = this.height;
    const a = 1.3 * w;
    const hip = 0.53 * h;
    const ph = this.t * (this.speed > 0.05 ? 7 : 0) * (1.75 / Math.max(0.5, h));
    this.model.rotation.x = a;
    this.model.position.y += w * (POSE.crawlHip * h - hip * Math.cos(a)) + (1 - w) * 0;
    this.model.position.z -= w * hip * Math.sin(a) * 0.55;
    for (const [side, sign] of [['L', 1], ['R', -1]]) {
      const swing = Math.sin(ph) * 0.35 * sign;
      this._bend(b[`UpperArm${side}`], (POSE.crawlArm + swing) * w, 0, 0);
      this._bend(b[`UpperLeg${side}`], (POSE.crawlThigh - swing) * w, 0, 0);
      this._bend(b[`LowerLeg${side}`], POSE.crawlShin * w, 0, 0);
    }
    rot(b.Neck, -0.6 * w, 0, 0);
    rot(b.Head, -0.4 * w, 0, 0);
  }

  _poseCarry(w) {
    const b = this.bones;
    this._bend(b.UpperArmL, -0.75 * w, 0, -0.15 * w);
    this._bend(b.UpperArmR, -0.75 * w, 0, 0.15 * w);
    this._bend(b.LowerArmL, -0.9 * w, 0, 0);
    this._bend(b.LowerArmR, -0.9 * w, 0, 0);
  }

  _poseLie(w) {
    // Lie on the back; beds/couches put the root at the mattress, feet at the root, head towards -Z.
    this.model.rotation.x = -w * Math.PI / 2;
    this.model.position.y += w * 0.1 * (this.height / 1.75);
    const b = this.bones;
    this._bend(b.UpperArmL, 0, 0, -0.15 * w);
    this._bend(b.UpperArmR, 0, 0, 0.15 * w);
  }

  _handToFace(side, w) {
    const b = this.bones;
    const s = side === 'L' ? -1 : 1;
    this._bend(b[`UpperArm${side}`], -0.75 * w, 0, 0.45 * s * w);
    this._bend(b[`LowerArm${side}`], -2.0 * w, 0, 0);
  }

  /** Put each foot at the end of its shin (see _footRel). */
  _feetFollow() {
    for (const side of ['L', 'R']) {
      const rel = this._footRel[side];
      const foot = this.bones[`Foot${side}`];
      if (!rel || !foot) continue;
      const shin = this.bones[`LowerLeg${side}`];
      shin.updateWorldMatrix(true, false);
      _m.multiplyMatrices(shin.matrixWorld, rel);
      foot.parent.updateWorldMatrix(true, false);
      _m2.copy(foot.parent.matrixWorld).invert().multiply(_m);
      _m2.decompose(_v, _q2, _v2);
      foot.position.copy(_v);
      foot.quaternion.copy(_q2);
    }
  }

  /** Rotate a bone by an euler (x, y, z) given in body space (x = sideways axis, z = forward). */
  _bend(bone, x, y, z) {
    if (!bone || (x === 0 && y === 0 && z === 0)) return;
    _q.setFromEuler(_e.set(x, y, z));
    this.model.getWorldQuaternion(_qm);
    bone.parent.getWorldQuaternion(_qp);
    // world-space rotation, then expressed in the bone's parent space
    _qd.copy(_qm).multiply(_q).multiply(_q2.copy(_qm).invert());
    _q2.copy(_qp).invert().multiply(_qd).multiply(_qp);
    bone.quaternion.premultiply(_q2);
  }

  eyePosition(out = new THREE.Vector3()) {
    const h = this.bones.Head;
    if (!h) return out.set(0, this.height * 0.93, 0).applyMatrix4(this.root.matrixWorld);
    h.getWorldPosition(out);
    return out.add(_v.set(0, 0.1 * (this.height / 1.75), 0));
  }

  _disposeModel() {
    this.mixer?.stopAllAction();
    this.model.traverse((o) => {
      if (o.isMesh) o.material.dispose();
    });
    this.model.removeFromParent();
    this.actions = {};
  }

  dispose() {
    this._disposeModel();
    this.root.removeFromParent();
  }
}

// Pose tuning (radians / metres for a 1.75 m adult). Tuned against the rig in the dev lab.
export const POSE = {
  sitThigh: -1.45,
  sitShin: 1.45,
  sitDrop: 0.42,
  sitBack: 0.02,
  crawlArm: -1.3,
  crawlThigh: -1.25,
  crawlShin: 1.0,
  crawlHip: 0.27,
};

function push(map, k, v) {
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(v);
}

/** The named part node above a mesh (glTF primitives become child meshes of a group). */
function partNode(mesh) {
  let o = mesh;
  while (o) {
    if (partOf(o.name) || /pistol/i.test(o.name || '')) return o;
    o = o.parent;
  }
  return null;
}

/** Rotate a bone by a local euler offset on top of its current (animated) pose. */
function rot(bone, x, y, z) {
  if (!bone) return;
  _q.setFromEuler(_e.set(x, y, z));
  bone.quaternion.multiply(_q);
}
