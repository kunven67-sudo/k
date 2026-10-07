// A small 3D "stage" for front-end screens (boot splash, logos, menu): its own scene + camera,
// a procedural room environment for reflections, and a disposal list so leaving a screen frees
// GPU memory. Materials from gfx/materials.js mat() are shared/cached and are never disposed.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let envCache = null; // one PMREM env map for every UI screen (cheap to keep, costly to rebuild)

export function roomEnv(renderer) {
  if (envCache) return envCache;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  envCache = pmrem.fromScene(room, 0.03).texture;
  room.traverse((o) => o.geometry?.dispose?.());
  pmrem.dispose();
  return envCache;
}

export class Stage {
  constructor(engine, { fov = 40, near = 0.05, far = 200, background = 0x050304, envIntensity = 0.6 } = {}) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.scene.environment = roomEnv(engine.renderer);
    this.scene.environmentIntensity = envIntensity;
    this.camera = new THREE.PerspectiveCamera(fov, engine.width / engine.height || 1, near, far);
    this.tier = engine.tier;
    this._disposables = [];
    this._updaters = new Set();
    engine.setView(this.scene, this.camera);
  }

  /** Track something with .dispose() to free when the stage is torn down. Returns it. */
  own(x) {
    this._disposables.push(x);
    return x;
  }

  /** Register fn(dt, time) to run every frame until it returns false or is removed. */
  onUpdate(fn) {
    this._updaters.add(fn);
    return () => this._updaters.delete(fn);
  }

  /** Like wait(), but in stage time (so sequencing stays in sync with animation on slow frames). */
  wait(ms, skip) {
    const end = (this.time || 0) + ms / 1000;
    return new Promise((res) => {
      const tick = () => {
        if (skip?.requested || (this.time || 0) >= end || this._dead) res();
        else requestAnimationFrame(tick);
      };
      tick();
    });
  }

  update(dt) {
    this.time = (this.time || 0) + dt;
    for (const fn of [...this._updaters]) if (fn(dt, this.time) === false) this._updaters.delete(fn);
  }

  /** Remove a group from the scene and free its geometries / owned textures. */
  clearGroup(group) {
    group.removeFromParent();
    group.traverse((o) => {
      o.geometry?.dispose?.();
    });
  }

  dispose() {
    this._dead = true;
    this._updaters.clear();
    this.scene.traverse((o) => o.geometry?.dispose?.());
    for (const d of this._disposables) d?.dispose?.();
    this._disposables.length = 0;
  }
}

// Easing + spring helpers used by the animated screens.
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
export const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Critically-ish damped spring: state {x, v}; returns new x. */
export function spring(s, target, dt, k = 120, d = 14) {
  s.v += (k * (target - s.x) - d * s.v) * dt;
  s.x += s.v * dt;
  return s.x;
}

/** Promise that resolves after `ms`, or early when `skip.requested` becomes true. */
export function wait(ms, skip) {
  return new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      if (skip?.requested || performance.now() - t0 >= ms) res();
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Make sure the vendored display faces are ready before drawing them into canvas textures. */
export function loadFonts() {
  if (!document.fonts?.load) return Promise.resolve();
  const faces = ['700 64px "Playfair Display"', 'italic 400 40px "Playfair Display"', '400 40px "Playfair Display"', '400 40px "Bebas Neue"', '400 40px "Rye"', '400 40px "Monoton"', '600 40px "Inter"', '400 40px "Special Elite"'];
  return Promise.race([Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))), new Promise((r) => setTimeout(r, 1500))]);
}

/** Camera distance so a box of half-size (hw, hh) fits the view at the current aspect. */
export function fitDistance(camera, hw, hh) {
  const tv = Math.tan((camera.fov * Math.PI) / 360);
  return Math.max(hh / tv, hw / (tv * camera.aspect));
}
