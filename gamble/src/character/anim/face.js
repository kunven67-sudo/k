// Facial animation: expressions, visemes (lip sync), blinking, gaze and saccades.
//
// Everything is expressed as named *controls* (brow inner up, smile, jaw open, …). Expressions
// and visemes are weighted control sets; the final control vector drives the face bones built
// in rig.js (translations in head units for lips/corners/cheeks/brows/nose, rotations for the
// jaw, tongue, eyelids and eyeballs). Upper lids follow the eyes' pitch so the eyes never look
// "pasted on", and blinks happen at natural, varied intervals (more often when nervous).

import * as THREE from 'three';
import { clamp, damp, lerp } from '../../core/util.js';
import { Rng } from '../../core/rng.js';

export const EXPRESSIONS = {
  neutral: {},
  happy: { smile: 0.9, squint: 0.45, browOuterUp: 0.2, jawOpen: 0.1, mouthWide: 0.25, cheekUp: 0.6 },
  sad: { frown: 0.75, browInnerUp: 0.95, browOuterUp: -0.35, lidOpen: -0.25, lowerLipDown: 0.12, lipsPress: 0.2 },
  angry: { browDown: 1.0, squint: 0.4, lipsPress: 0.55, frown: 0.35, sneer: 0.3, lidOpen: 0.15, jawOpen: 0.02 },
  scared: { browInnerUp: 1.0, browOuterUp: 0.6, lidOpen: 0.9, mouthWide: 0.55, jawOpen: 0.22, frown: 0.35 },
  hungover: { lidOpen: -0.55, squint: 0.3, browDown: 0.25, browInnerUp: 0.45, frown: 0.3, jawOpen: 0.05 },
  disgusted: { sneer: 1.0, upperLipUp: 0.55, browDown: 0.6, squint: 0.5, frown: 0.45, 'smile.L': 0.15 },
  surprised: { browInnerUp: 1.0, browOuterUp: 1.0, lidOpen: 1.0, jawOpen: 0.42, funnel: 0.3 },
  smug: { 'smile.L': 0.75, 'smile.R': 0.12, lidOpen: -0.32, 'browOuterUp.L': 0.35, lipsPress: 0.25, 'squint.L': 0.3 },
  nervous: { browInnerUp: 0.6, smile: 0.22, lipsPress: 0.35, mouthWide: 0.25, lidOpen: 0.22 },
  // Extras used by actions (not part of the public contract list).
  pain: { browDown: 0.7, browInnerUp: 0.6, squint: 1.0, mouthWide: 0.6, jawOpen: 0.2, upperLipUp: 0.4 },
  yawn: { jawOpen: 1.0, squint: 0.8, browInnerUp: 0.4, funnel: 0.2 },
  effort: { squint: 0.7, lipsPress: 0.8, browDown: 0.5 },
  joy: { smile: 1.0, jawOpen: 0.45, squint: 0.6, browOuterUp: 0.4, browInnerUp: 0.3, cheekUp: 0.8, mouthWide: 0.3 },
};

export const VISEMES = {
  rest: {},
  A: { jawOpen: 0.62, mouthWide: 0.15 },
  E: { jawOpen: 0.28, mouthWide: 0.7, smile: 0.15 },
  I: { jawOpen: 0.18, mouthWide: 0.55 },
  O: { jawOpen: 0.48, funnel: 0.7, pucker: 0.25 },
  U: { jawOpen: 0.14, pucker: 0.9 },
  F: { jawOpen: 0.07, lowerLipIn: 1.0, upperLipUp: 0.25 },
  M: { lipsPress: 1.0 },
  L: { jawOpen: 0.3, tongueUp: 1.0, mouthWide: 0.15 },
  W: { pucker: 1.0, jawOpen: 0.08 },
};

const SIDED = ['browInnerUp', 'browOuterUp', 'browDown', 'squint', 'lidOpen', 'smile', 'frown', 'cheekUp', 'blink'];
const MOUTH = ['jawOpen', 'mouthWide', 'pucker', 'funnel', 'upperLipUp', 'lowerLipDown', 'lowerLipIn', 'lipsPress', 'smile', 'frown', 'tongueUp'];

export class Face {
  constructor(human) {
    this.h = human;
    this.L = human.rig.dims.L;
    this.k = human.rig.dims.hsc; // head units → metres
    this.rng = new Rng(human.params.seed * 13 + 5);
    this.expr = new Map(); // name → {w, target}
    this.vis = new Map();
    this.ctl = {}; // final controls
    this.blinkT = 1 + this.rng.next() * 3;
    this.blink = 0; // 0 open … 1 closed
    this.blinkPhase = -1;
    this.doubleBlink = false;
    this.gaze = new THREE.Vector2(); // current eye yaw/pitch (rad)
    this.gazeTarget = new THREE.Vector2();
    this.saccadeT = 0.5;
    this.lookTarget = null; // world point
    this.lidState = { upperL: 0, upperR: 0, lowerL: 0, lowerR: 0 };
    this.mouthOpen = 0;
    this.extra = {}; // per-frame additive controls from actions
    this.nervous = 0;
    this.sleepy = 0;
  }

  setExpression(name, w = 1) {
    if (!EXPRESSIONS[name]) return;
    if (name === 'neutral') {
      for (const e of this.expr.values()) e.target = 0;
      return;
    }
    const e = this.expr.get(name) || { w: 0, target: 0 };
    e.target = clamp(w, 0, 1);
    this.expr.set(name, e);
  }

  setViseme(name, w = 1) {
    if (!VISEMES[name]) return;
    if (name === 'rest') {
      for (const v of this.vis.values()) v.target = 0;
      return;
    }
    // Lip sync drives one viseme at a time; others fade out quickly.
    for (const [k, v] of this.vis) if (k !== name) v.target = 0;
    const v = this.vis.get(name) || { w: 0, target: 0 };
    v.target = clamp(w, 0, 1);
    this.vis.set(name, v);
  }

  _accum(out, set, w) {
    for (const [k, v] of Object.entries(set)) {
      if (SIDED.includes(k)) {
        out[`${k}.L`] = (out[`${k}.L`] || 0) + v * w;
        out[`${k}.R`] = (out[`${k}.R`] || 0) + v * w;
      } else out[k] = (out[k] || 0) + v * w;
    }
  }

  update(dt, headWorldQ) {
    const c = {};
    // Expressions (smoothly blended, several can mix).
    for (const [name, e] of this.expr) {
      e.w = damp(e.w, e.target, 0.09, dt);
      if (e.w > 0.002) this._accum(c, EXPRESSIONS[name], e.w);
    }
    // Visemes override the mouth part of expressions while talking.
    let vSum = 0;
    const vc = {};
    for (const [name, v] of this.vis) {
      v.w = damp(v.w, v.target, 0.035, dt);
      if (v.w > 0.002) {
        this._accum(vc, VISEMES[name], v.w);
        vSum += v.w;
      }
    }
    if (vSum > 0) {
      const k = Math.min(1, vSum);
      for (const m of MOUTH) {
        for (const key of [m, `${m}.L`, `${m}.R`]) {
          if (c[key] !== undefined || vc[key] !== undefined) c[key] = lerp(c[key] || 0, vc[key] || 0, k * 0.85);
        }
      }
    }
    this._accum(c, this.extra, 1);
    this.extra = {};
    // Blinking: random intervals, occasional double blinks, more when nervous/tired.
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.doubleBlink = this.rng.chance(0.15);
      this.blinkT = (2.2 + this.rng.next() * 4.5) * (1 - this.nervous * 0.6);
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt;
      const close = 0.07;
      const hold = 0.03;
      const open = 0.14;
      const t = this.blinkPhase;
      this.blink = t < close ? t / close : t < close + hold ? 1 : Math.max(0, 1 - (t - close - hold) / open);
      if (t > close + hold + open) {
        this.blinkPhase = this.doubleBlink ? -0.0 : -1;
        if (this.doubleBlink) {
          this.doubleBlink = false;
          this.blinkPhase = -1;
          this.blinkT = 0.12;
        }
      }
    } else this.blink = 0;
    const sleepy = clamp(this.sleepy + (c['lidOpen.L'] < 0 ? 0 : 0), 0, 1);
    // Gaze: saccades between small offsets around the look target / straight ahead.
    this.saccadeT -= dt;
    if (this.saccadeT <= 0) {
      this.saccadeT = (0.35 + this.rng.next() * 2.2) * (1 - this.nervous * 0.6);
      const amp = this.lookTarget ? 0.035 : 0.12;
      this.saccadeOffset = [this.rng.gaussian(0, amp), this.rng.gaussian(0, amp * 0.6)];
      // Big gaze shifts trigger a blink sometimes (like real people).
      if (!this.lookTarget && Math.abs(this.saccadeOffset[0]) > 0.15 && this.rng.chance(0.4) && this.blinkPhase < 0) this.blinkT = 0;
    }
    const so = this.saccadeOffset || [0, 0];
    let gy = so[0];
    let gp = so[1];
    if (this.lookTarget && headWorldQ) {
      // Eye-space direction to the target from between the eyes.
      const eyeMid = this.h.bones['eye.L'].getWorldPosition(_v).add(this.h.bones['eye.R'].getWorldPosition(_v2)).multiplyScalar(0.5);
      const d = _v2.subVectors(this.lookTarget, eyeMid).applyQuaternion(_qi.copy(headWorldQ).invert());
      gy += Math.atan2(d.x, d.z);
      gp += Math.atan2(-d.y, Math.hypot(d.x, d.z));
    }
    this.gazeTarget.set(clamp(gy, -0.6, 0.6), clamp(gp, -0.45, 0.5));
    // Saccades are fast (a few frames).
    this.gaze.x = damp(this.gaze.x, this.gazeTarget.x, 0.025, dt);
    this.gaze.y = damp(this.gaze.y, this.gazeTarget.y, 0.025, dt);
    this.ctl = c;
    this._apply(c, sleepy);
  }

  /** Write controls to the face bones (called after the rest pose has been restored). */
  _apply(c, sleepy) {
    const B = this.h.bones;
    const L = this.L;
    const k = this.k;
    const g = (n) => c[n] || 0;
    const T = (bone, x, y, z) => bone.position.add(_v.set(x * k, y * k, z * k));
    // Brows.
    for (const [s, sx] of [['L', 1], ['R', -1]]) {
      const inUp = g(`browInnerUp.${s}`);
      const outUp = g(`browOuterUp.${s}`);
      const down = g(`browDown.${s}`);
      T(B[`brow.in.${s}`], -sx * 0.0022 * down, 0.0062 * inUp - 0.0055 * down, 0.0012 * down);
      T(B[`brow.out.${s}`], 0, 0.0058 * outUp - 0.0028 * down, 0);
      // Cheeks (smile / squint push up).
      const smile = g(`smile.${s}`) + g('smile');
      const cheekUp = g(`cheekUp.${s}`) + g(`squint.${s}`) * 0.5 + smile * 0.5;
      T(B[`cheek.${s}`], sx * 0.002 * smile + sx * 0.006 * g('cheekPuff'), 0.0045 * cheekUp, 0.002 * cheekUp + 0.005 * g('cheekPuff'));
      // Mouth corners.
      const frown = g(`frown.${s}`) + g('frown');
      const wide = g('mouthWide');
      const pk = g('pucker') + g('funnel') * 0.6;
      T(B[`corner.${s}`],
        sx * (0.0045 * smile + 0.006 * wide - 0.0085 * pk + 0.001 * frown),
        0.0072 * smile - 0.0062 * frown - 0.0045 * g('jawOpen') + 0.0015 * g('sneer'),
        -0.0025 * smile - 0.002 * wide + 0.0045 * pk);
    }
    // Lips.
    const lipsPress = g('lipsPress');
    T(B['lip.U'], 0, 0.0042 * g('upperLipUp') + 0.0025 * g('funnel') - 0.0018 * lipsPress + 0.0025 * g('sneer'), 0.0055 * g('pucker') + 0.0045 * g('funnel') - 0.001 * lipsPress);
    T(B['lip.D'], 0, -0.0042 * g('lowerLipDown') - 0.0025 * g('funnel') + 0.002 * lipsPress + 0.0045 * g('lowerLipIn'), 0.0055 * g('pucker') + 0.0045 * g('funnel') - 0.005 * g('lowerLipIn'));
    T(B.nose, 0, 0.003 * g('sneer'), 0.0008 * g('sneer'));
    // Jaw (+X opens), tongue.
    const jaw = clamp(g('jawOpen') - lipsPress * 0.02, -0.02, 1.1);
    B.jaw.quaternion.multiply(_q.setFromEuler(_e.set(jaw * 0.34, g('jawSide') * 0.08, 0)));
    this.mouthOpen = clamp(jaw * 1.6 + g('funnel') * 0.3, 0, 1);
    B.tongue.quaternion.multiply(_q.setFromEuler(_e.set(-g('tongueUp') * 0.45, 0, 0)));
    T(B.tongue, 0, 0.004 * g('tongueUp'), 0.004 * g('tongueUp') + 0.012 * g('tongueOut'));
    // Eyes.
    for (const s of ['L', 'R']) B[`eye.${s}`].quaternion.multiply(_q.setFromEuler(_e.set(this.gaze.y, this.gaze.x, 0)));
    // Lids: open (wide) / squint / blink / follow the eye pitch.
    for (const [s, lidKey, lowKey] of [['L', 'upperL', 'lowerL'], ['R', 'upperR', 'lowerR']]) {
      const open = g(`lidOpen.${s}`) - sleepy * 0.6;
      const squint = g(`squint.${s}`);
      const blink = Math.max(this.blink, g(`blink.${s}`));
      const span = L.lidUpper + L.lidLower * 0.55; // rotation that closes the upper lid
      // +X rotation = lid moves down (closes).
      let up = -open * 0.2 + squint * 0.12 + this.gaze.y * 0.65;
      up = up + (span - up) * blink;
      let low = -squint * 0.2 + this.gaze.y * 0.25 - blink * 0.06 - open * 0.05;
      up = clamp(up, -0.35, span);
      this.lidState[lidKey] = up;
      this.lidState[lowKey] = -low;
      B[`lidU.${s}`].quaternion.multiply(_q.setFromEuler(_e.set(up, 0, 0)));
      B[`lidD.${s}`].quaternion.multiply(_q.setFromEuler(_e.set(low, 0, 0)));
    }
  }
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _e = new THREE.Euler();
