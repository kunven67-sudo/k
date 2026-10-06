// One-shot actions (ARCHITECTURE §6): knock, reach, sit, stand, pat-pockets, phone-up,
// phone-down, drink, eat, stumble, wave, flip-off, shrug, facepalm, cheer, tap-table, wave-off,
// pull-lever, toss-chips, peek-cards, throw-dice, yawn, stretch, get-up-floor.
//
// Each action is a function of normalised time u (0..1) that layers rotation offsets, hand IK
// targets (root space), finger shapes, hip offsets and face controls on top of the base
// locomotion pose. Motions are written with anticipation (a small counter-move first), a fast
// main move and follow-through/settle, using the easing helpers below. `sit` leaves the person
// in a seated hold until `stand`; `get-up-floor` starts from the ground.
//
//   const h = human.play('wave', { side: 'R', speed: 1 });  // -> { name, done: Promise, stop() }

import * as THREE from 'three';
import { EXPRESSIONS } from './face.js';
import { clamp } from '../../core/util.js';

const ss = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Window: rises a->b, holds, falls c->d. */
const win = (u, a, b, c, d) => ss(a, b, u) * (1 - ss(c, d, u));
/** Overshooting ease (back-out) on [a, b]. */
const back = (a, b, u, k = 1.6) => {
  const t = clamp((u - a) / (b - a), 0, 1);
  const t1 = t - 1;
  return 1 + (k + 1) * t1 * t1 * t1 + k * t1 * t1;
};
const _v = new THREE.Vector3();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

/** Action table: dur (s), mask hint, blend in/out (s), fn(ctx, u). */
const ACTIONS = {
  knock: { dur: 1.5, fn(c, u) {
    const S = c.side;
    const up = win(u, 0.0, 0.18, 0.82, 1.0);
    const k = Math.max(0, Math.sin(u * Math.PI * 2 * 4.2)) * win(u, 0.25, 0.3, 0.7, 0.78);
    c.hand(S, c.pt('chestFront', 0.12 * c.sx(S), 0.12, 0.32 - k * 0.05), up, 'fist', c.orient([0, 0.2, 1], [-c.sx(S), 0, 0]));
    c.add('chest', -0.04 * up + 0.03 * k, 0, 0);
  } },
  reach: { dur: 1.6, fn(c, u) {
    const S = c.side;
    const w = win(u, 0.05, 0.38, 0.72, 1.0);
    const target = c.opts.target ? c.toRoot(c.opts.target) : c.pt('chestFront', 0.15 * c.sx(S), -0.1, 0.5);
    // Anticipation: slight pull back, then reach with a lean, close the fingers at the end.
    const lean = ss(0.1, 0.4, u) * (1 - ss(0.7, 1, u));
    c.add('spine', 0.18 * lean, 0, 0);
    c.add('chest', 0.12 * lean - 0.04 * win(u, 0, 0.08, 0.1, 0.2), 0.1 * lean * c.sx(S), 0);
    c.hand(S, target, w, u > 0.45 ? 'grip' : 'open');
  } },
  sit: { dur: 1.9, hold: 'seated', fn(c, u) {
    // Glance down, lean forward, lower with knees (IK keeps the feet planted), settle back.
    const h = c.opts.height ?? 0.46;
    const lower = back(0.22, 0.85, u, 0.4);
    const lean = win(u, 0.05, 0.35, 0.65, 1.0);
    const drop = c.hipY - (h + 0.07 * c.s);
    c.hips(0, -drop * lower, -0.13 * c.s * lower);
    c.add('spine', 0.35 * lean + 0.08 * lower, 0, 0);
    c.add('chest', 0.15 * lean, 0, 0);
    c.add('neck', 0.25 * win(u, 0, 0.15, 0.4, 0.7), 0, 0);
    for (const S of ['L', 'R']) c.hand(S, c.pt('thigh', 0.11 * c.sx(S), h - c.hipY + 0.13, 0.16), ss(0.5, 1.0, u) * 0.9, 'relaxed');
    c.addSym('thigh', 0, 0, 0.04 * lower);
  } },
  seated: { dur: Infinity, fn(c, u, t) {
    const h = c.opts.height ?? 0.46;
    const drop = c.hipY - (h + 0.07 * c.s);
    c.hips(0, -drop, -0.13 * c.s);
    const breath = Math.sin(t * 1.4) * 0.01;
    c.add('spine', 0.06 + breath, 0, 0);
    c.add('chest', -0.04 + breath, 0, 0);
    for (const S of ['L', 'R']) c.hand(S, c.pt('thigh', 0.11 * c.sx(S), h - c.hipY + 0.13, 0.16), 0.9, 'relaxed');
    c.addSym('thigh', 0, 0, 0.04);
  } },
  stand: { dur: 1.7, fromHold: 'seated', fn(c, u) {
    const h = c.opts.height ?? 0.46;
    const drop = c.hipY - (h + 0.07 * c.s);
    const rise = ss(0.3, 0.88, u);
    const lean = win(u, 0.0, 0.32, 0.55, 0.95);
    c.hips(0, -drop * (1 - rise), -0.13 * c.s * (1 - rise) + 0.05 * c.s * lean);
    c.add('spine', 0.45 * lean, 0, 0);
    c.add('chest', 0.2 * lean, 0, 0);
    // Push off the knees with the hands, slower with age.
    for (const S of ['L', 'R']) c.hand(S, c.pt('thigh', 0.1 * c.sx(S), h - c.hipY + 0.16 + 0.1 * rise, 0.22), win(u, 0.0, 0.2, 0.55, 0.8), 'flat');
    c.face({ effort: 0.6 * win(u, 0.2, 0.35, 0.6, 0.8) * c.age });
  } },
  'pat-pockets': { dur: 2.2, fn(c, u) {
    for (const S of ['L', 'R']) {
      const pats = Math.max(0, Math.sin((u * 6 + (S === 'L' ? 0.5 : 0)) * Math.PI));
      const which = u < 0.5 ? 'hipFront' : 'chestFront';
      const w = win(u, 0.0, 0.12, 0.85, 1.0);
      const y = which === 'hipFront' ? -0.02 : -0.05;
      c.hand(S, c.pt(which, 0.15 * c.sx(S), y, 0.12 + pats * 0.035), w, 'flat');
    }
    c.add('neck', 0.3 * win(u, 0.05, 0.2, 0.8, 1.0), 0, 0);
    c.face({ nervous: 0.5 * win(u, 0, 0.2, 0.8, 1) });
  } },
  'phone-up': { dur: 1.0, hold: 'phone', fn(c, u) {
    const w = back(0.0, 0.8, u, 0.8);
    c.hand('R', c.pt('chestFront', 0.04, 0.12, 0.28), w, 'phone', c.orient([0.1, 1, 0.15], [0, 0.25, -1]));
    c.add('neck', 0.3 * w, 0, 0);
    c.add('head', 0.15 * w, 0, 0);
  } },
  phone: { dur: Infinity, fn(c, u, t) {
    c.hand('R', c.pt('chestFront', 0.04, 0.12 + Math.sin(t * 0.9) * 0.004, 0.28), 1, 'phone', c.orient([0.1, 1, 0.15], [0, 0.25, -1]));
    c.add('neck', 0.3, 0, 0);
    c.add('head', 0.15, 0, 0);
  } },
  'phone-down': { dur: 0.9, fromHold: 'phone', fn(c, u) {
    const w = 1 - ss(0.1, 0.9, u);
    c.hand('R', c.pt('chestFront', 0.04, 0.12 - 0.3 * (1 - w), 0.28 * w + 0.1), w, 'phone', c.orient([0.1, 1, 0.15], [0, 0.25, -1]));
    c.add('neck', 0.3 * w, 0, 0);
  } },
  drink: { dur: 2.6, fn(c, u) {
    const S = c.side;
    const lift = win(u, 0.05, 0.35, 0.72, 0.98);
    const tip = win(u, 0.35, 0.48, 0.62, 0.72);
    c.hand(S, c.pt('mouth', 0.03 * c.sx(S), -0.06 + 0.02 * tip, 0.07), lift, 'cup', c.orient([-c.sx(S) * 0.5, 0.25 - 0.9 * tip, 1], [-c.sx(S), 0.2, 0]));
    c.add('head', -0.25 * tip, 0, 0);
    c.add('neck', -0.15 * tip, 0, 0);
    c.face({ pucker: 0.4 * tip });
  } },
  eat: { dur: 2.4, fn(c, u) {
    const S = c.side;
    const lift = win(u, 0.05, 0.3, 0.45, 0.65);
    const chew = win(u, 0.4, 0.5, 0.9, 1.0) * (0.5 + 0.5 * Math.sin(u * 40));
    c.hand(S, c.pt('mouth', 0.0, -0.01, 0.06), lift, 'pinch');
    c.add('head', 0.08 * lift, 0, 0);
    c.face({ jawOpen: 0.35 * win(u, 0.22, 0.3, 0.38, 0.45) + 0.18 * chew, lipsPress: 0.3 * chew });
  } },
  stumble: { dur: 1.6, fn(c, u) {
    const jolt = back(0.0, 0.25, u, 2) * (1 - ss(0.45, 1.0, u));
    c.hips(0, -0.06 * jolt, 0.12 * jolt);
    c.add('spine', 0.35 * jolt, 0, 0.1 * jolt);
    c.add('chest', 0.2 * jolt, 0, 0);
    c.add('head', -0.3 * jolt, 0.1 * jolt, 0);
    for (const S of ['L', 'R']) {
      c.add(`upperarm.${S}`, 0.6 * jolt, 0, 0.9 * jolt * c.sx(S));
      c.add(`forearm.${S}`, 0.5 * jolt, 0, 0);
    }
    c.lock(1 - 0.35 * jolt);
    c.face({ scared: 0.9 * jolt });
  } },
  wave: { dur: 2.4, fn(c, u) {
    const S = c.side;
    const up = back(0.0, 0.22, u, 1.2) * (1 - ss(0.8, 1.0, u));
    const wv = Math.sin(u * Math.PI * 2 * 3.2) * win(u, 0.2, 0.28, 0.74, 0.82);
    c.hand(S, c.pt('shoulder', 0.18 * c.sx(S) + 0.05 * wv * c.sx(S), 0.32, 0.12), up, 'open', c.orient([0.45 * wv * c.sx(S), 1, 0.1], [0, 0, 1]));
    c.add('chest', 0, 0, -0.05 * up * c.sx(S));
    c.face({ happy: 0.7 * up });
  } },
  'flip-off': { dur: 2.0, fn(c, u) {
    const S = c.side;
    const up = back(0.05, 0.28, u, 1.5) * (1 - ss(0.75, 1.0, u));
    c.hand(S, c.pt('chestFront', 0.12 * c.sx(S), 0.18, 0.35), up, 'flip', c.orient([0, 1, 0.2], [0, 0, -1]));
    c.add('chest', 0, 0.12 * up * c.sx(S), 0);
    c.face({ angry: 0.6 * up, smug: 0.3 * up });
  } },
  shrug: { dur: 1.6, fn(c, u) {
    const w = win(u, 0.05, 0.3, 0.62, 0.95);
    for (const S of ['L', 'R']) {
      c.add(`clavicle.${S}`, 0, 0, 0.32 * w * c.sx(S));
      c.hand(S, c.pt('hipFront', 0.3 * c.sx(S), 0.12, 0.18), w, 'open', c.orient([c.sx(S) * 0.6, 0, 1], [0, 1, 0]));
    }
    c.add('head', 0.05 * w, 0, 0.12 * w);
    c.face({ browInnerUp: 0.7 * w, browOuterUp: 0.6 * w, frown: 0.4 * w, lipsPress: 0.3 * w });
  } },
  facepalm: { dur: 2.4, fn(c, u) {
    const S = c.side;
    const w = back(0.05, 0.32, u, 0.6) * (1 - ss(0.8, 1.0, u));
    c.hand(S, c.pt('face', 0.0, 0.01, 0.03), w, 'flat', c.orient([0, 1, 0.1], [0, -0.1, -1]));
    c.add('head', 0.3 * w, 0, 0);
    c.add('neck', 0.15 * w, 0, 0);
    c.add('chest', 0.08 * w, 0, 0);
    c.face({ sad: 0.5 * w, squint: 0.8 * w });
  } },
  cheer: { dur: 2.2, fn(c, u) {
    const crouch = win(u, 0.0, 0.08, 0.1, 0.2);
    const up = back(0.12, 0.3, u, 1.4) * (1 - ss(0.8, 1.0, u));
    const pump = Math.sin(u * Math.PI * 2 * 3) * win(u, 0.3, 0.35, 0.7, 0.8);
    c.hips(0, -0.05 * crouch + 0.02 * up, 0);
    for (const S of ['L', 'R']) c.hand(S, c.pt('shoulder', 0.12 * c.sx(S), 0.42 + 0.04 * pump, 0.02), up, 'fist');
    c.add('head', -0.25 * up, 0, 0);
    c.add('chest', -0.12 * up, 0, 0);
    c.face({ joy: up });
  } },
  'tap-table': { dur: 2.0, fn(c, u) {
    const S = c.side;
    const w = win(u, 0.0, 0.15, 0.85, 1.0);
    const tap = Math.max(0, Math.sin(u * Math.PI * 2 * 5));
    const tableY = (c.opts.height ?? 0.76) - c.hipY;
    c.hand(S, c.pt('hipFront', 0.12 * c.sx(S), tableY - c.hipY * 0 + 0.03 + tap * 0.03, 0.38), w, 'point', c.orient([0, -0.35, 1], [0, -1, 0]));
    c.add('chest', 0.1 * w, 0, 0);
    c.face({ effort: 0.2 * w });
  } },
  'wave-off': { dur: 1.3, fn(c, u) {
    const S = c.side;
    const up = win(u, 0.0, 0.2, 0.6, 1.0);
    const flick = back(0.25, 0.5, u, 2) * (1 - ss(0.6, 1, u));
    c.hand(S, c.pt('chestFront', (0.05 + 0.18 * flick) * c.sx(S), 0.0, 0.25), up, 'open', c.orient([c.sx(S) * flick, 0.2, 1], [c.sx(S) * (0.3 + flick), -1 + flick, 0]));
    c.add('head', 0, -0.2 * up * c.sx(S), 0);
    c.face({ disgusted: 0.4 * up, smug: 0.3 * up });
  } },
  'pull-lever': { dur: 1.8, fn(c, u) {
    const S = c.side;
    const reach = win(u, 0.0, 0.25, 0.7, 0.95);
    const pull = back(0.3, 0.55, u, 0.5) * (1 - ss(0.7, 0.95, u));
    c.hand(S, c.pt('shoulder', 0.22 * c.sx(S), 0.18 - 0.38 * pull, 0.4 - 0.12 * pull), reach, 'grip');
    c.add('spine', 0.12 * pull, 0, 0);
    c.add('chest', 0.06 * reach, 0.12 * reach * c.sx(S), 0);
    c.face({ effort: 0.5 * pull });
  } },
  'toss-chips': { dur: 1.4, fn(c, u) {
    const S = c.side;
    const wind = win(u, 0.0, 0.2, 0.25, 0.4);
    const toss = back(0.3, 0.55, u, 1.2) * (1 - ss(0.65, 1.0, u));
    c.hand(S, c.pt('chestFront', 0.12 * c.sx(S), -0.08 + 0.05 * toss, 0.15 - 0.06 * wind + 0.3 * toss), win(u, 0, 0.12, 0.75, 1), toss > 0.6 ? 'open' : 'pinch');
    c.add('chest', 0.08 * toss, 0.1 * toss * c.sx(S), 0);
  } },
  'peek-cards': { dur: 2.4, fn(c, u) {
    const w = win(u, 0.0, 0.2, 0.8, 1.0);
    const lift = win(u, 0.3, 0.45, 0.6, 0.75);
    const tableY = (c.opts.height ?? 0.76) - c.hipY;
    c.hand('R', c.pt('hipFront', 0.04, tableY + 0.04 + 0.03 * lift, 0.36), w, 'pinch', c.orient([0, -0.3 + 0.4 * lift, 1], [0, -1, 0.3 * lift]));
    c.hand('L', c.pt('hipFront', -0.06, tableY + 0.04, 0.34), w, 'flat', c.orient([0, -0.3, 1], [0, -1, 0]));
    c.add('neck', 0.35 * w, 0, 0);
    c.add('head', 0.2 * w + 0.1 * lift, 0, 0);
    c.add('chest', 0.15 * w, 0, 0);
    c.face({ squint: 0.4 * lift, lipsPress: 0.3 * w });
  } },
  'throw-dice': { dur: 2.0, fn(c, u) {
    const S = c.side;
    const shake = Math.sin(u * Math.PI * 2 * 6) * win(u, 0.05, 0.12, 0.42, 0.5);
    const wind = win(u, 0.4, 0.5, 0.52, 0.58);
    const thr = back(0.55, 0.72, u, 1.4) * (1 - ss(0.78, 1.0, u));
    c.hand(S, c.pt('chestFront', 0.1 * c.sx(S), 0.05 + 0.04 * shake + 0.05 * wind - 0.12 * thr, 0.2 - 0.08 * wind + 0.35 * thr), win(u, 0, 0.1, 0.85, 1), thr > 0.5 ? 'open' : 'fist');
    c.add('chest', 0.15 * thr - 0.05 * wind, 0.15 * thr * c.sx(S), 0);
    c.add('spine', 0.1 * thr, 0, 0);
    c.face({ joy: 0.4 * thr, effort: 0.4 * wind });
  } },
  yawn: { dur: 3.4, fn(c, u) {
    const w = win(u, 0.05, 0.35, 0.6, 0.95);
    for (const S of ['L', 'R']) c.add(`upperarm.${S}`, -0.15 * w, 0, 0.3 * w * c.sx(S));
    c.add('chest', -0.12 * w, 0, 0);
    c.add('head', -0.2 * w, 0, 0);
    c.hand(c.side, c.pt('mouth', 0.0, -0.01, 0.05), win(u, 0.25, 0.4, 0.55, 0.7) * 0.9, 'flat', c.orient([-c.sx(c.side), 0.4, 0], [0, 0, -1]));
    c.face({ yawn: w });
  } },
  stretch: { dur: 3.0, fn(c, u) {
    const w = back(0.05, 0.4, u, 0.3) * (1 - ss(0.75, 1.0, u));
    for (const S of ['L', 'R']) c.hand(S, c.pt('shoulder', 0.05 * c.sx(S), 0.5, -0.02), w, 'open', c.orient([0, 1, 0], [0, 0.3, 1]));
    c.add('chest', -0.15 * w, 0, Math.sin(u * 6) * 0.05 * w);
    c.add('spine', -0.08 * w, 0, 0);
    c.hips(0, 0.01 * w, 0);
    c.face({ squint: 0.7 * w, jawOpen: 0.25 * win(u, 0.3, 0.45, 0.55, 0.7) });
  } },
  'get-up-floor': { dur: 3.2, fn(c, u) {
    // From sitting/kneeling on the floor: hand on the ground, push, rise.
    const down = 1 - ss(0.25, 0.9, u);
    const push = win(u, 0.1, 0.3, 0.55, 0.8);
    c.hips(0, -(c.hipY - 0.32 * c.s) * down, -0.15 * c.s * down);
    c.add('spine', 0.5 * down + 0.2 * push, 0, 0);
    c.add('chest', 0.25 * down, 0, 0);
    c.hand('R', c.pt('hipFront', 0.18, -c.hipY + 0.03, 0.28), push * 0.95, 'flat', c.orient([0, -0.2, 1], [0, -1, 0]));
    c.hand('L', c.pt('thigh', -0.1, -0.25 * down, 0.2), win(u, 0.2, 0.4, 0.75, 0.9), 'flat');
    c.face({ effort: 0.8 * push * (0.6 + 0.4 * c.age), hungover: 0.3 });
  } },
};

export const ACTION_NAMES = Object.keys(ACTIONS).filter((n) => ACTIONS[n].dur !== Infinity);

export class ActionPlayer {
  constructor(animator) {
    this.a = animator;
    this.active = [];
    this.hold = null; // { name, opts, w }
    const h = animator.h;
    const R = h.rig;
    const W = R.worldP;
    const d = R.dims;
    const L = d.L;
    const hc = d.j.headCenter;
    const k = d.headH / 0.32;
    this.lm = {
      shoulder: W['upperarm.L'].clone().setX(0),
      chestFront: W.chest.clone().add(new THREE.Vector3(0, 0.03 * d.s, 0.12 * d.s)),
      hipFront: W.hips.clone().add(new THREE.Vector3(0, 0, 0.12 * d.s)),
      thigh: W['thigh.L'].clone().setX(0),
      mouth: new THREE.Vector3(0, hc.y + L.mouthY * k, hc.z + L.mouthZ * k),
      face: new THREE.Vector3(0, hc.y + L.eyeY * k, hc.z + 0.12 * k),
    };
    this.hipY = W.hips.y;
    this.s = d.s;
    this.age = clamp((h.params.age - 45) / 40, 0, 1);
  }

  play(name, opts = {}) {
    const def = ACTIONS[name];
    if (!def) return null;
    if (def.fromHold && this.hold && this.hold.name !== def.fromHold) return null;
    const speed = (opts.speed ?? 1) * (name === 'stand' || name === 'sit' || name === 'get-up-floor' ? 1 - 0.3 * this.age : 1);
    let resolve;
    const done = new Promise((r) => (resolve = r));
    // Actions using the same hand replace each other.
    this.active = this.active.filter((a) => {
      if (a.name === name || (a.def.hold === undefined && !def.hold && a.opts.side === (opts.side || 'R'))) {
        a.resolve(false);
        return false;
      }
      return true;
    });
    const inst = { name, def, opts: { side: 'R', ...opts }, t: 0, dur: def.dur / speed, w: 0, resolve, stopping: false };
    if (def.fromHold) this.hold = null; // the hold hands over to this action
    this.active.push(inst);
    return { name, done, stop: () => (inst.stopping = true) };
  }

  update(dt, pose) {
    const face = this.a.face;
    const ctxFor = (inst, w) => this._ctx(inst, w, pose, face);
    // Held states (seated, phone) underneath actions.
    if (this.hold) {
      this.hold.w = Math.min(1, this.hold.w + dt / 0.25);
      this.hold.t += dt;
      ACTIONS[this.hold.name].fn(ctxFor(this.hold, this.hold.w), 0, this.hold.t);
    }
    for (const inst of this.active) {
      inst.t += dt;
      const u = clamp(inst.t / inst.dur, 0, 1);
      // Envelopes are inside the action curves; a short global fade keeps cuts clean.
      inst.w = inst.stopping ? Math.max(0, inst.w - dt / 0.25) : Math.min(1, inst.w + dt / 0.12);
      inst.def.fn(ctxFor(inst, inst.w), u, inst.t);
    }
    this.active = this.active.filter((inst) => {
      const finished = inst.t >= inst.dur || (inst.stopping && inst.w <= 0);
      if (finished) {
        if (inst.def.hold && !inst.stopping) this.hold = { name: inst.def.hold, opts: inst.opts, t: 0, w: 1 };
        inst.resolve(true);
      }
      return !finished;
    });
  }

  get seated() {
    return this.hold?.name === 'seated';
  }

  _ctx(inst, w, pose, face) {
    const lm = this.lm;
    const self = this;
    return {
      opts: inst.opts,
      side: inst.opts.side || 'R',
      s: this.s,
      hipY: this.hipY,
      age: this.age,
      sx: (S) => (S === 'L' ? 1 : -1),
      /** Landmark point (root space) + offsets (m, scaled; x already signed by the caller). */
      pt(name, dx = 0, dy = 0, dz = 0) {
        return _v.copy(lm[name]).add(new THREE.Vector3(dx * self.s, dy * self.s, dz * self.s)).clone();
      },
      toRoot(world) {
        const inv = self.a.h.root.matrixWorld.clone().invert();
        return world.clone().applyMatrix4(inv);
      },
      eul(x, y, z) {
        return new THREE.Quaternion().setFromEuler(_e.set(x, y, z));
      },
      /** Hand orientation (root space): fingers direction + palm normal. */
      orient(f, p) {
        const Y = new THREE.Vector3(...f).normalize();
        let Z = new THREE.Vector3(...p);
        Z.addScaledVector(Y, -Z.dot(Y)).normalize();
        const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
        Z = new THREE.Vector3().crossVectors(X, Y);
        return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
      },
      add(bone, x, y, z) {
        pose.add(bone, x * w, y * w, z * w);
      },
      addSym(bone, x, y, z) {
        pose.addSym(bone, x * w, y * w, z * w);
      },
      hips(x, y, z) {
        pose.hips.x += x * w;
        pose.hips.y += y * w;
        pose.hips.z += z * w;
      },
      lock(v) {
        pose.footLock = Math.min(pose.footLock, 1 + (v - 1) * w);
      },
      hand(S, pos, hw, shape = 'relaxed', rot = null) {
        const ph = pose.hand[S];
        const k = clamp(hw * w, 0, 1);
        if (k <= 0.001) return;
        if (ph.w <= 0) ph.pos.copy(pos);
        else ph.pos.lerp(pos, k / Math.max(1e-3, ph.w + k));
        ph.w = Math.max(ph.w, k);
        ph.shape = shape;
        ph.shapeW = Math.max(ph.shapeW, k);
        if (rot) ph.rot = rot.clone();
      },
      face(ctl) {
        for (const [key, v] of Object.entries(ctl)) {
          const ex = EXPRESSIONS[key];
          if (ex) {
            for (const [ck, cv] of Object.entries(ex)) addCtl(face.extra, ck, cv * v * w);
          } else addCtl(face.extra, key, v * w);
        }
      },
    };
  }
}

function addCtl(out, k, v) {
  out[k] = (out[k] || 0) + v;
}
void _q;
