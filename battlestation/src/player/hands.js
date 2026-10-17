import * as THREE from 'three';
import { FINGER } from '../world/keyboard.js';

// Drives your arms, hands and every finger from your REAL keyboard + mouse while you sit at the PC.
// Left hand lives on the keyboard (home row for typing, WASD for gaming). Right hand lives on the
// mouse and hops over to the keyboard when you press a right-hand key, then goes back to the mouse.
const NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const GAME_FINGER = {
  KeyW: 'L2', KeyS: 'L2', KeyA: 'L3', KeyD: 'L1', KeyQ: 'L3', KeyE: 'L1', KeyR: 'L1', KeyF: 'L1', KeyG: 'L1', KeyT: 'L1',
  KeyZ: 'L3', KeyX: 'L2', KeyC: 'L1', KeyV: 'L1', ShiftLeft: 'L4', ControlLeft: 'L4', Tab: 'L4', CapsLock: 'L4', Space: 'L0',
  Digit1: 'L3', Digit2: 'L2', Digit3: 'L1', Digit4: 'L1', Digit5: 'L1', Escape: 'L4', Backquote: 'L4',
};
const HOME = {
  type: { L: { pinky: 'KeyA', ring: 'KeyS', middle: 'KeyD', index: 'KeyF', thumb: 'Space' } },
  game: { L: { pinky: 'ShiftLeft', ring: 'KeyA', middle: 'KeyW', index: 'KeyD', thumb: 'Space' } },
  R: { index: 'KeyJ', middle: 'KeyK', ring: 'KeyL', pinky: 'Semicolon', thumb: 'Space' },
};

export class Hands {
  constructor(avatar, desk) {
    this.av = avatar;
    this.desk = desk;
    this.kb = desk.keyboard;
    this.mouse = desk.mouse;
    this.held = new Map(); // code -> { hand, finger, t, up }
    this.leftMode = 'type';
    this.recentLeft = [];
    this.right = { onKb: 0, target: 0, lastKey: -9, lastMouse: 0 };
    this.t = 0;
    this.click = { 0: 0, 2: 0 };
    this.scrollT = 0;
    this.guess = {};
    this.wrist = { l: null, r: null };
    this.cursor = { x: 800, y: 450 };
    this.vdesk = { w: 2880, h: 900 };
  }

  fingerFor(code) {
    if (this.leftMode === 'game' && GAME_FINGER[code]) return GAME_FINGER[code];
    let f = FINGER[code];
    if (code === 'Space') f = this.right.onKb > 0.5 && this.leftMode === 'type' ? 'R0' : 'L0';
    return f;
  }

  keyDown(code, repeat) {
    if (repeat) return;
    const f = this.fingerFor(code);
    if (!f) return;
    const hand = f[0] === 'L' ? 'l' : 'r';
    const finger = NAMES[+f[1]];
    this.held.set(code, { hand, finger, t: this.t, up: null });
    this.kb.press(code, true);
    if (hand === 'r') { this.right.target = 1; this.right.lastKey = this.t; }
    else {
      this.recentLeft.push(code);
      if (this.recentLeft.length > 6) this.recentLeft.shift();
      const gamey = this.recentLeft.filter(c => /^Key[WASD]$|ShiftLeft|Space|ControlLeft/.test(c)).length;
      const typey = this.recentLeft.filter(c => /^Key[B-CE-RT-VX-Z]$/.test(c)).length;
      if (gamey >= 4) this.leftMode = 'game'; else if (typey >= 2) this.leftMode = 'type';
    }
  }

  keyUp(code) {
    const h = this.held.get(code);
    if (h) h.up = this.t;
    this.kb.press(code, false);
  }

  mouseMove(dx, dy, cursor) {
    if (cursor) { this.cursor.x = cursor.x; this.cursor.y = cursor.y; }
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      this.right.lastMouse = this.t;
      // right hand goes back to the mouse when you grab it (unless a right key is still held)
      if (![...this.held.values()].some(h => h.hand === 'r' && !h.up)) this.right.target = 0;
    }
  }

  mouseButton(b, down) { this.mouse.click(b, down); if (b === 0 || b === 2) this.click[b] = down ? 1 : 0; this.right.target = 0; }
  wheel(steps) { this.mouse.scroll(steps); this.scrollT = this.t; this.right.target = 0; }

  // world position of a key top (slightly into the cap when pressed)
  key(code) { return this.kb.keyWorld(code); }

  update(dt, yaw) {
    this.t += dt;
    const av = this.av;
    for (const [code, h] of this.held) if (h.up !== null && this.t - h.up > 0.09) this.held.delete(code);
    if (this.right.target > 0.5 && this.t - this.right.lastKey > 2.2) this.right.target = 0;
    this.right.onKb += (this.right.target - this.right.onKb) * Math.min(1, dt * 9);

    // move the physical mouse on the pad to match the cursor
    const m = this.desk.mouse;
    const home = this.desk.mouseHome;
    const nx = this.cursor.x / this.vdesk.w - 0.3, ny = this.cursor.y / this.vdesk.h - 0.5;
    const tx = home.x + nx * 0.2, tz = home.z + ny * 0.09;
    m.group.position.x += (tx - m.group.position.x) * Math.min(1, dt * 30);
    m.group.position.z += (tz - m.group.position.z) * Math.min(1, dt * 30);
    m.group.rotation.y = -nx * 0.12;
    m.group.updateMatrixWorld(true);

    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
    const up = new THREE.Vector3(0, 1, 0);

    // ---------- left hand: keyboard ----------
    const homeL = HOME[this.leftMode].L;
    const lp = this.handPose('l', homeL, fwd, right, up);
    this.placeHand('l', lp, fwd, right, up, dt);

    // ---------- right hand: blend mouse <-> keyboard ----------
    const kbPose = this.handPose('r', HOME.R, fwd, right, up);
    const msPose = this.mousePose(fwd, right, up);
    const w = this.right.onKb;
    const blend = {
      wrist: msPose.wrist.clone().lerp(kbPose.wrist, w),
      fwd: msPose.fwd.clone().lerp(kbPose.fwd, w).normalize(),
      back: msPose.back.clone().lerp(kbPose.back, w).normalize(),
      tips: {},
    };
    for (const f of NAMES) blend.tips[f] = msPose.tips[f].clone().lerp(kbPose.tips[f], w);
    // lift the hand a bit while it travels between mouse and keyboard
    blend.wrist.y += Math.sin(w * Math.PI) * 0.035;
    this.placeHand('r', blend, fwd, right, up, dt);
  }

  // Where the wrist + each fingertip should be for a hand on the keyboard
  handPose(side, home, fwd, right, up) {
    const s = side === 'l' ? -1 : 1;
    const tips = {};
    const homePos = {};
    for (const f of NAMES) {
      const code = home[f];
      const p = this.key(code).clone();
      if (f === 'thumb') p.addScaledVector(right, side === 'l' ? -0.045 : 0.045).addScaledVector(fwd, -0.004);
      homePos[f] = p;
      tips[f] = p.clone().add(new THREE.Vector3(0, 0.002, 0));
    }
    // fingers currently pressing keys on this hand
    const shift = new THREE.Vector3();
    let n = 0;
    for (const [code, h] of this.held) {
      if (h.hand !== side) continue;
      const kp = this.key(code);
      if (!kp) continue;
      const age = this.t - h.t;
      const pressing = h.up === null || this.t - h.up < 0.05;
      const target = kp.clone();
      if (!pressing) target.y += 0.008;
      // a quick little lift before the strike
      if (age < 0.03) target.y += 0.006 * (1 - age / 0.03);
      if (h.finger === 'thumb' && code === 'Space') target.addScaledVector(right, side === 'l' ? -0.045 : 0.045);
      tips[h.finger] = target;
      shift.add(kp.clone().sub(homePos[h.finger]));
      n++;
    }
    if (n) shift.multiplyScalar(0.75 / n);
    shift.y = 0;
    // wrist sits behind the home row, a bit above the keys
    const center = homePos.index.clone().lerp(homePos.ring, 0.5);
    // real typing: wrist ~15 cm behind the fingertips, a little above the keys, so fingers curl down
    const wrist = center.clone().addScaledVector(fwd, -0.168).addScaledVector(right, s * 0.015).add(new THREE.Vector3(0, 0.022, 0)).add(shift);
    for (const f of NAMES) if (![...this.held.values()].some(h => h.hand === side && h.finger === f)) tips[f].add(shift);
    const handFwd = center.clone().add(shift).sub(wrist).setY(0).normalize().add(new THREE.Vector3(0, 0.05, 0)).normalize();
    // pinky side rolls down a bit, thumb side up (how hands really sit on a keyboard)
    const back = up.clone().addScaledVector(right, s * 0.2).normalize();
    return { wrist, fwd: handFwd, back, tips };
  }

  mousePose(fwd, right, up) {
    const m = this.mouse;
    const g = m.group;
    const L = (v) => g.localToWorld(v.clone());
    const press = this.click;
    const tips = {
      index: L(m.anchor.index).add(new THREE.Vector3(0, -0.002 * press[0], 0)),
      middle: L(m.anchor.middle).add(new THREE.Vector3(0, -0.002 * press[2], 0)),
      ring: L(new THREE.Vector3(0.031, 0.019, 0.0)),
      pinky: L(new THREE.Vector3(0.032, 0.01, 0.025)),
      thumb: L(new THREE.Vector3(-0.033, 0.017, 0.012)),
    };
    // scrolling: middle finger rolls the wheel
    const sc = this.t - this.scrollT;
    if (sc < 0.35) {
      const k = Math.sin(Math.min(1, sc / 0.35) * Math.PI);
      tips.middle = L(m.anchor.wheel).add(new THREE.Vector3(0, 0.002, 0.004 * Math.sin(this.t * 40))).lerp(tips.middle, 1 - k);
    }
    const wrist = L(new THREE.Vector3(0.006, 0.026, 0.118));
    const mf = new THREE.Vector3(0, 0, -1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()));
    // wrist rests low on the pad, the hand rises over the mouse hump
    const handFwd = mf.clone().add(new THREE.Vector3(0, 0.14, 0)).normalize();
    const back = up.clone().addScaledVector(right, 0.28).normalize();
    return { wrist, fwd: handFwd, back, tips };
  }

  debugDots(side, tips) {
    if (!this.dots) this.dots = {};
    for (const f of NAMES) {
      const k = side + f;
      if (!this.dots[k]) {
        this.dots[k] = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshBasicMaterial({ color: f === 'index' ? 0xff0000 : f === 'thumb' ? 0x00ff00 : 0xffff00, depthTest: false }));
        this.dots[k].renderOrder = 99;
        this.av.root.parent.add(this.dots[k]);
        const t = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshBasicMaterial({ color: 0x00ffff, depthTest: false }));
        t.renderOrder = 99; this.av.root.parent.add(t); this.dots[k + 'tip'] = t;
      }
      this.dots[k].position.copy(tips[f]);
    }
  }

  placeHand(side, pose, fwd, right, up, dt) {
    const av = this.av;
    // smooth the wrist so the hand moves like a real one (fast, but not teleporting)
    if (!this.wrist[side]) this.wrist[side] = pose.wrist.clone();
    this.wrist[side].lerp(pose.wrist, Math.min(1, dt * 22));
    const s = side === 'l' ? -1 : 1;
    const pole = right.clone().multiplyScalar(s * 0.75).add(new THREE.Vector3(0, -0.55, 0)).addScaledVector(fwd, -0.2);
    av.armIK(side, this.wrist[side], pole);
    av.orientHand(side, pose.fwd, pose.back);
    if (window.__game?.params.get('dbg')) this.debugDots(side, pose.tips);
    for (const f of NAMES) {
      const key = side + f;
      const r = av.solveFinger(side, f, pose.tips[f], this.guess[key]);
      this.guess[key] = r.p;
      (this.err || (this.err = {}))[key] = r.err;
      if (this.dots?.[key + 'tip']) this.dots[key + 'tip'].position.copy(av.tipFor(side, f, r.p.s, r.p.c1, r.p.c2));
    }
  }
}
