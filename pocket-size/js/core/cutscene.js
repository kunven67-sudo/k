// Async cutscene director: camera moves with easing, timed waits, voiced lines, all skippable
// by holding Space.
import * as THREE from 'three';
import { ui } from './ui.js';
import { input } from './input.js';

const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export class Director {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.skipped = false;
    this.tweens = [];
    this.skipHold = 0;
    this.lookAt = new THREE.Vector3();
    this.handheld = 0.4;
    this.time = 0;
    this.focusTarget = null;
  }

  async play(fn, { letterbox = true, skippable = true } = {}) {
    this.active = true;
    this.skipped = false;
    this.skippable = skippable;
    this.skipHold = 0;
    if (letterbox) ui.letterbox(true);
    ui.skipHint(skippable);
    try { await fn(this); }
    finally {
      this.active = false;
      this.tweens = [];
      ui.letterbox(false);
      ui.skipHint(false);
      ui.clearSubtitle();
    }
  }

  update(dt) {
    this.time += dt;
    if (!this.active) return;
    if (this.skippable && input.isDown('Space')) {
      this.skipHold += dt;
      if (this.skipHold > 0.7 && !this.skipped) { this.skipped = true; ui.clearSubtitle(); }
    } else this.skipHold = 0;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt / tw.dur;
      if (this.skipped) tw.t = 1;
      const k = tw.ease(Math.min(1, tw.t));
      tw.apply(k);
      if (tw.t >= 1) { this.tweens.splice(i, 1); tw.resolve(); }
    }
  }

  // Applies subtle handheld sway so static shots feel filmed.
  sway(pos) {
    const t = this.time;
    pos.x += Math.sin(t * 0.7) * 0.01 * this.handheld;
    pos.y += Math.sin(t * 0.9 + 1) * 0.008 * this.handheld;
    return pos;
  }

  tween(dur, apply, e = 'inOut') {
    return new Promise((resolve) => {
      if (this.skipped || dur <= 0) { apply(1); resolve(); return; }
      this.tweens.push({ t: 0, dur, apply, ease: ease[e] || ease.inOut, resolve });
    });
  }

  // Cut the camera instantly.
  cut(pos, look, fov) {
    this.camera.position.copy(pos);
    this.lookAt.copy(look);
    this.camera.lookAt(look);
    if (fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  // Move the camera (position + look target + optional fov) over `dur` seconds.
  move(pos, look, dur, { fov, e = 'inOut', path } = {}) {
    const p0 = this.camera.position.clone(), l0 = this.lookAt.clone(), f0 = this.camera.fov;
    const curve = path ? new THREE.CatmullRomCurve3([p0, ...path, pos]) : null;
    return this.tween(dur, (k) => {
      if (curve) this.camera.position.copy(curve.getPoint(k));
      else this.camera.position.lerpVectors(p0, pos, k);
      this.lookAt.lerpVectors(l0, look, k);
      this.sway(this.camera.position);
      this.camera.lookAt(this.lookAt);
      if (fov) { this.camera.fov = f0 + (fov - f0) * k; this.camera.updateProjectionMatrix(); }
    }, e);
  }

  // Orbit around a point.
  orbit(center, radius, height, a0, a1, dur, { e = 'sine', lookOffset = new THREE.Vector3() } = {}) {
    return this.tween(dur, (k) => {
      const a = a0 + (a1 - a0) * k;
      this.camera.position.set(center.x + Math.sin(a) * radius, center.y + height, center.z + Math.cos(a) * radius);
      this.lookAt.copy(center).add(lookOffset);
      this.camera.lookAt(this.lookAt);
    }, e);
  }

  wait(sec) {
    return new Promise((resolve) => {
      if (this.skipped) { resolve(); return; }
      let t = 0;
      this.tweens.push({ t: 0, dur: sec, apply: () => {}, ease: ease.linear, resolve });
      void t;
    });
  }

  async say(text, opts = {}) {
    if (this.skipped) return;
    await Promise.race([ui.say(text, opts), new Promise((r) => { const iv = setInterval(() => { if (this.skipped) { clearInterval(iv); r(); } }, 100); setTimeout(() => clearInterval(iv), 60000); })]);
  }
}

export { ease };
