// Animation: Rocketbox mocap clips on Rocketbox avatars (shared "Bip01" rig).
// - root motion is taken out of every clip (the physics capsule moves the body)
//   and turned into a speed, so feet never slide: playback rate follows real speed
// - idle / walk / run blend by speed, cycles kept in phase (no foot shuffling)
// - one-shot actions (wave, knock, sit down...) cross-fade in and out
// - faces: blinking, emotions (ARKit shapes), lip sync (visemes)
// - two-bone IK plants the feet on stairs and slopes
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const ROOT = 'Bip01';

// Makes a clip play in place; returns the root speed (m/s) it had.
export function extractRootMotion(clip) {
  const track = clip.tracks.find((t) => t.name === `${ROOT}.position`);
  if (!track) return 0;
  const v = track.values;
  const n = v.length / 3;
  const dx = v[(n - 1) * 3] - v[0];
  const dz = v[(n - 1) * 3 + 2] - v[2];
  const dist = Math.hypot(dx, dz);
  // keep the up/down bob, remove the steady travel (and any sideways drift)
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : 0;
    v[i * 3] -= v[0] + dx * f;
    v[i * 3 + 2] -= v[2] + dz * f;
  }
  return clip.duration > 0 ? dist / clip.duration : 0;
}

// Clips live one per file (assets/anims/<name>.glb) and load on demand.
export class AnimLibrary {
  constructor(baseUrl = 'assets/anims/') {
    this.baseUrl = baseUrl;
    this.clips = new Map();    // name -> { clip, speed }
    this.pending = new Map();  // name -> Promise
    this.missing = new Set();
    this.loader = new GLTFLoader();
  }

  add(clip) {
    // Rocketbox exports have end "nub" bones some avatars lack, and scale keys we never want
    clip.tracks = clip.tracks.filter((t) => !/Nub\.|Footsteps|\.scale$/.test(t.name));
    const speed = extractRootMotion(clip);
    clip.optimize();
    const rec = { clip, speed };
    this.clips.set(clip.name, rec);
    return rec;
  }

  // loads a file holding one or more clips
  async load(url) {
    const gltf = await this.loader.loadAsync(url);
    for (const clip of gltf.animations) this.add(clip);
    return this;
  }

  // makes sure these clips are loaded (unknown names are remembered as missing, not errors)
  async require(names) {
    await Promise.all(names.map((name) => {
      if (this.clips.has(name) || this.missing.has(name)) return null;
      if (!this.pending.has(name)) {
        this.pending.set(name, this.loader.loadAsync(`${this.baseUrl}${name}.glb`)
          .then((gltf) => {
            const clip = gltf.animations[0];
            if (!clip) throw new Error('no animation in file');
            clip.name = name;
            this.add(clip);
          })
          .catch((err) => { this.missing.add(name); console.warn(`[anim] ${name}: ${err.message}`); })
          .finally(() => this.pending.delete(name)));
      }
      return this.pending.get(name);
    }));
    return this;
  }

  get(name) {
    return this.clips.get(name) || null;
  }

  // first clip whose name matches any of the patterns (gender prefix handled by caller)
  find(...patterns) {
    for (const p of patterns) {
      for (const [name, c] of this.clips) if (p instanceof RegExp ? p.test(name) : name === p) return c;
    }
    return null;
  }
}

// ---------------------------------------------------------------- two-bone IK

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();

function worldPos(bone, out) {
  return out.setFromMatrixPosition(bone.matrixWorld);
}

// rotate `bone` (in world space) by quaternion q
function rotateWorld(bone, q) {
  bone.parent.getWorldQuaternion(_q2);
  const parentInv = _q2.clone().invert();
  const world = _q2.multiply(bone.quaternion);          // bone world quat
  world.premultiply(q);                                   // apply world rotation
  bone.quaternion.copy(parentInv.multiply(world));
  bone.updateMatrixWorld(true);
}

// Classic analytic two-bone IK (thigh-calf-foot). Moves the chain so the foot
// reaches `target`, keeping the knee bending the way it already bends.
// pole: optional world point the knee/elbow should point toward (needed when the
// limb starts out straight, e.g. arms hanging down, reaching for a ladder rung).
export function solveTwoBone(upper, lower, end, target, weight = 1, pole = null) {
  if (weight <= 0) return;
  upper.updateMatrixWorld(true);
  worldPos(upper, _a);
  worldPos(lower, _b);
  worldPos(end, _c);
  const lab = _a.distanceTo(_b);
  const lcb = _b.distanceTo(_c);
  const goal = _t.copy(_c).lerp(target, weight);
  const lat = THREE.MathUtils.clamp(_a.distanceTo(goal), 0.001, lab + lcb - 0.001);
  // current and wanted knee angles
  const ac_ab0 = Math.acos(THREE.MathUtils.clamp(_c.clone().sub(_a).normalize().dot(_b.clone().sub(_a).normalize()), -1, 1));
  const ba_bc0 = Math.acos(THREE.MathUtils.clamp(_a.clone().sub(_b).normalize().dot(_c.clone().sub(_b).normalize()), -1, 1));
  const ac_ab1 = Math.acos(THREE.MathUtils.clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const ba_bc1 = Math.acos(THREE.MathUtils.clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
  let axis0 = _c.clone().sub(_a).cross(_b.clone().sub(_a));
  if (pole) {
    // bend toward the pole: rotate the middle joint into the plane (root, goal, pole)
    const polePlane = goal.clone().sub(_a).cross(pole.clone().sub(_a));
    if (polePlane.lengthSq() > 1e-10) {
      const midNow = _b.clone().sub(_a);
      const n = polePlane.normalize();
      const along = goal.clone().sub(_a).normalize();
      const wantDir = n.clone().cross(along).normalize(); // points toward the pole side
      const cur = midNow.clone().sub(along.clone().multiplyScalar(midNow.dot(along)));
      if (cur.lengthSq() > 1e-10) {
        rotateWorld(upper, _q1.setFromUnitVectors(cur.normalize(), wantDir));
        worldPos(lower, _b); worldPos(end, _c);
      }
      axis0 = _c.clone().sub(_a).cross(_b.clone().sub(_a));
    }
  }
  if (axis0.lengthSq() < 1e-10) return; // limb perfectly straight and no pole: no bend direction to keep
  axis0.normalize();
  rotateWorld(upper, _q1.setFromAxisAngle(axis0, ac_ab1 - ac_ab0));
  rotateWorld(lower, _q1.setFromAxisAngle(axis0, ba_bc1 - ba_bc0));
  // then swing the whole chain to point at the goal
  worldPos(upper, _a);
  worldPos(end, _c);
  const from = _c.clone().sub(_a).normalize();
  const to = goal.clone().sub(_a).normalize();
  rotateWorld(upper, _q1.setFromUnitVectors(from, to));
}

// ---------------------------------------------------------------- character

const VISEMES = ['AA_VI_00_Sil', 'AA_VI_01_PP', 'AA_VI_02_FF', 'AA_VI_03_TH', 'AA_VI_04_DD', 'AA_VI_05_KK', 'AA_VI_06_CH', 'AA_VI_07_SS', 'AA_VI_08_nn', 'AA_VI_09_RR', 'AA_VI_10_aa', 'AA_VI_11_E', 'AA_VI_12_I', 'AA_VI_13_O', 'AA_VI_14_U'];

// emotion -> ARKit shape weights
export const EXPRESSIONS = {
  neutral: {},
  happy: { AK_44_MouthSmileLeft: 0.7, AK_45_MouthSmileRight: 0.7, AK_07_CheekSquintLeft: 0.35, AK_08_CheekSquintRight: 0.35 },
  sad: { AK_03_BrowInnerUp: 0.8, AK_30_MouthFrownLeft: 0.6, AK_31_MouthFrownRight: 0.6, AK_11_EyeLookDownLeft: 0.25, AK_12_EyeLookDownRight: 0.25 },
  angry: { AK_01_BrowDownLeft: 0.9, AK_02_BrowDownRight: 0.9, AK_50_NoseSneerLeft: 0.4, AK_51_NoseSneerRight: 0.4, AK_36_MouthPressLeft: 0.4, AK_37_MouthPressRight: 0.4 },
  scared: { AK_03_BrowInnerUp: 0.9, AK_21_EyeWideLeft: 0.8, AK_22_EyeWideRight: 0.8, AK_46_MouthStretchLeft: 0.5, AK_47_MouthStretchRight: 0.5, AK_25_JawOpen: 0.15 },
  terrified: { AK_03_BrowInnerUp: 1, AK_04_BrowOuterUpLeft: 0.7, AK_05_BrowOuterUpRight: 0.7, AK_21_EyeWideLeft: 1, AK_22_EyeWideRight: 1, AK_25_JawOpen: 0.45, AK_46_MouthStretchLeft: 0.7, AK_47_MouthStretchRight: 0.7 },
  surprised: { AK_04_BrowOuterUpLeft: 0.8, AK_05_BrowOuterUpRight: 0.8, AK_03_BrowInnerUp: 0.6, AK_21_EyeWideLeft: 0.6, AK_22_EyeWideRight: 0.6, AK_25_JawOpen: 0.3 },
  disgusted: { AK_50_NoseSneerLeft: 0.8, AK_51_NoseSneerRight: 0.8, AK_48_MouthUpperUpLeft: 0.5, AK_49_MouthUpperUpRight: 0.5, AK_01_BrowDownLeft: 0.4 },
  inLove: { AK_44_MouthSmileLeft: 0.45, AK_45_MouthSmileRight: 0.45, AK_03_BrowInnerUp: 0.3, AK_19_EyeSquintLeft: 0.25, AK_20_EyeSquintRight: 0.25 },
  pain: { AK_09_EyeBlinkLeft: 0.6, AK_10_EyeBlinkRight: 0.6, AK_01_BrowDownLeft: 0.7, AK_02_BrowDownRight: 0.7, AK_46_MouthStretchLeft: 0.8, AK_47_MouthStretchRight: 0.8, AK_25_JawOpen: 0.2 },
};

export const baseClips = (g) => [`${g}_idle_neutral_01`, `${g}_walk_neutral_01`, `${g}_run_neutral_01`, `${g}_crouch_idle`];

export class Character {
  constructor(template, lib, { gender = 'm' } = {}) {
    // each character gets its own skeleton; geometry and textures stay shared
    this.root = SkeletonUtils.clone(template);
    this.lib = lib;
    this.gender = gender;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.bones = {};
    this.faceMeshes = [];
    this.root.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // bounds don't follow the animated pose
        if (o.morphTargetDictionary) this.faceMeshes.push(o);
      }
    });
    this.loco = {};
    for (const [key, names] of Object.entries({
      idle: [`${gender}_idle_neutral_01`, /_idle_neutral_01$/],
      walk: [`${gender}_walk_neutral_01`, /_walk_neutral_01$/],
      run: [`${gender}_run_neutral_01`, /_run_neutral_01$/],
      crouch: [`${gender}_crouch_idle`, /_crouch_idle$/],
    })) {
      const c = lib.find(...names);
      if (!c) continue;
      const action = this.mixer.clipAction(c.clip);
      action.enabled = true;
      action.setEffectiveWeight(key === 'idle' ? 1 : 0);
      action.play();
      this.loco[key] = { action, speed: c.speed };
    }
    this.oneShot = null;
    this.speed = 0;       // current ground speed m/s (from physics)
    this.crouch = 0;
    this.expression = {}; // current blended face weights
    this.targetExpression = EXPRESSIONS.neutral;
    this.visemeWeights = new Float32Array(VISEMES.length);
    this.talkLevel = 0;   // 0..1 mouth openness when there's no viseme data
    this.blinkTimer = 2 + Math.random() * 3;
    this.blink = 0;
    this.footIK = true;
  }

  setEmotion(name, strength = 1) {
    const base = EXPRESSIONS[name] || EXPRESSIONS.neutral;
    this.targetExpression = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v * strength]));
  }

  // Plays a one-shot clip (e.g. "wave_01"), fading back to locomotion after.
  play(name, opts = {}) {
    const c = this.lib.get(`${this.gender}_${name}`) || this.lib.get(name);
    if (!c) {
      // not loaded yet: fetch it, then play (if nothing else was asked for meanwhile)
      const ticket = (this.playTicket = (this.playTicket || 0) + 1);
      // gendered clip first ("m_wave_01"); the plain name only if that doesn't exist
      this.lib.require([`${this.gender}_${name}`])
        .then(() => (this.lib.get(`${this.gender}_${name}`) ? null : this.lib.require([name])))
        .then(() => {
        if (ticket === this.playTicket && (this.lib.get(`${this.gender}_${name}`) || this.lib.get(name))) this.play(name, opts);
        else if (ticket === this.playTicket) opts.onDone?.();
      });
      return 'loading';
    }
    this.playTicket = (this.playTicket || 0) + 1;
    const { fade = 0.25, loop = false, onDone } = opts;
    this.stopOneShot(fade);
    const action = this.mixer.clipAction(c.clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.setEffectiveWeight(1);
    action.fadeIn(fade);
    action.play();
    this.oneShot = { action, fade, onDone, loop };
    return true;
  }

  stopOneShot(fade = 0.25) {
    if (!this.oneShot) return;
    this.oneShot.action.fadeOut(fade);
    this.oneShot = null;
  }

  // Blend idle/walk/run so the feet match the real speed.
  updateLocomotion(dt) {
    const { idle, walk, run, crouch } = this.loco;
    if (!idle || !walk || !run) return;
    const vw = walk.speed || 1.0;
    const vr = run.speed || 2.8;
    const s = this.speed;
    let wi, ww, wr;
    if (s <= 0.05) { wi = 1; ww = 0; wr = 0; }
    else if (s < vw) { const f = s / vw; wi = 1 - f; ww = f; wr = 0; }
    else if (s < vr) { const f = (s - vw) / (vr - vw); wi = 0; ww = 1 - f; wr = f; }
    else { wi = 0; ww = 0; wr = 1; }
    // keep walk and run cycles in step: both play at the blended cycle length,
    // scaled so stride length times cadence equals the real speed
    const dW = walk.action.getClip().duration;
    const dR = run.action.getClip().duration;
    const moving = ww + wr;
    if (moving > 0) {
      const cycle = (dW * ww + dR * wr) / moving;
      const clipSpeed = (vw * ww + vr * wr) / moving;
      const rate = THREE.MathUtils.clamp(s / Math.max(0.1, clipSpeed), 0.5, 1.6);
      walk.action.timeScale = (dW / cycle) * rate;
      run.action.timeScale = (dR / cycle) * rate;
      // start run in the same phase as walk
      if (wr > 0 && run.action.getEffectiveWeight() < 0.01) run.action.time = (walk.action.time / dW) * dR;
    }
    const c = crouch ? this.crouch : 0;
    const k = 1 - Math.exp(-dt * 10); // smooth weight changes
    const oneShot = this.oneShot ? this.oneShot.action.getEffectiveWeight() : 0;
    const scale = 1 - oneShot;
    const lerpW = (a, w) => a.action.setEffectiveWeight(THREE.MathUtils.lerp(a.action.getEffectiveWeight(), w * scale, k));
    lerpW(idle, wi * (1 - c));
    lerpW(walk, ww);
    lerpW(run, wr);
    if (crouch) lerpW(crouch, wi * c);
    if (this.oneShot && !this.oneShot.loop && !this.oneShot.action.isRunning()) {
      const done = this.oneShot.onDone;
      this.stopOneShot(this.oneShot.fade);
      done?.();
    }
  }

  updateFace(dt) {
    if (!this.faceMeshes.length) return;
    // natural blinking every 2-6 s (quick close, slower open)
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink += dt / 0.08;
      if (this.blink >= 2) { this.blink = 0; this.blinkTimer = 2 + Math.random() * 4; }
    }
    const blinkW = this.blink <= 0 ? 0 : this.blink < 1 ? this.blink : 2 - this.blink;
    const k = 1 - Math.exp(-dt * 6);
    const keys = new Set([...Object.keys(this.expression), ...Object.keys(this.targetExpression)]);
    for (const key of keys) {
      const cur = this.expression[key] || 0;
      this.expression[key] = cur + ((this.targetExpression[key] || 0) - cur) * k;
    }
    for (const mesh of this.faceMeshes) {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;
      for (const [key, w] of Object.entries(this.expression)) {
        const i = dict[key];
        if (i !== undefined) inf[i] = w;
      }
      for (const side of ['AK_09_EyeBlinkLeft', 'AK_10_EyeBlinkRight']) {
        const i = dict[side];
        if (i !== undefined) inf[i] = Math.max(this.expression[side] || 0, blinkW);
      }
      VISEMES.forEach((v, n) => {
        const i = dict[v];
        if (i !== undefined) inf[i] = this.visemeWeights[n];
      });
      const jaw = dict.AK_25_JawOpen;
      if (jaw !== undefined) inf[jaw] = Math.max(this.expression.AK_25_JawOpen || 0, this.talkLevel * 0.5);
    }
  }

  // Feet onto uneven ground (stairs, slopes, rocks). groundAt(x, yFrom, z) -> ground height or null.
  // The animation's own foot lift is kept; each foot is only shifted by how much
  // the ground under it differs from the flat plane the clip was recorded on.
  // The hips drop by the lower foot's amount so the leg can reach it.
  updateFootIK(groundAt) {
    if (!this.footIK || !groundAt) return;
    const weight = THREE.MathUtils.clamp(1 - (this.speed - 1.2) / 1.2, 0, 1); // fade out when running
    if (weight <= 0) return;
    this.root.updateMatrixWorld(true);
    const baseY = this.root.getWorldPosition(_a).y;
    const legs = [];
    for (const side of ['L', 'R']) {
      const thigh = this.bones[`Bip01_${side}_Thigh`];
      const calf = this.bones[`Bip01_${side}_Calf`];
      const foot = this.bones[`Bip01_${side}_Foot`];
      if (!thigh || !calf || !foot) continue;
      const p = foot.getWorldPosition(new THREE.Vector3());
      const g = groundAt(p.x, baseY + 0.6, p.z);
      const delta = g == null ? 0 : THREE.MathUtils.clamp(g - baseY, -0.45, 0.45);
      legs.push({ thigh, calf, foot, p, delta });
    }
    if (legs.length !== 2) return;
    const hips = this.bones.Bip01_Pelvis?.parent; // "Bip01" root bone
    const drop = Math.min(0, legs[0].delta, legs[1].delta) * weight;
    this.hipDrop = THREE.MathUtils.lerp(this.hipDrop || 0, drop, 0.3);
    if (hips && this.hipDrop < -0.001) {
      hips.position.y += this.hipDrop / (hips.parent ? hips.parent.getWorldScale(_b).y : 1);
      hips.updateMatrixWorld(true);
    }
    for (const leg of legs) {
      if (Math.abs(leg.delta) < 0.005) continue;
      leg.p.y += leg.delta;
      solveTwoBone(leg.thigh, leg.calf, leg.foot, leg.p, weight);
    }
  }

  update(dt, { groundAt } = {}) {
    this.updateLocomotion(dt);
    this.mixer.update(dt);
    this.updateFace(dt);
    if (groundAt) this.updateFootIK(groundAt);
  }
}

export async function loadAvatar(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (/opacity/i.test(m.name)) {
        // hair cards / eyelashes: cut-out + alpha-to-coverage for soft, sorted-free edges
        m.transparent = false;
        m.alphaTest = 0.35;
        m.alphaToCoverage = true;
        m.depthWrite = true;
        m.side = THREE.DoubleSide;
      }
    }
  });
  return gltf.scene;
}
