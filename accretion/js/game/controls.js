// Keyboard + mouse input and the chase camera.
import * as THREE from 'three';
import { clamp } from '../core/phys.js';

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.dragging = false;
    this.enabled = false;

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked) {
        try {
          const r = canvas.requestPointerLock?.();
          if (r && r.catch) r.catch(() => {});
        } catch { /* pointer lock refused: fall back to dragging */ }
      }
      this.dragging = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.dragging) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) / 100, 3);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
}

export class ChaseCamera {
  constructor() {
    this.yaw = 0.6;
    this.pitch = -0.18;
    this.zoom = 6;
    this.S = 1;
    this.pos = { x: 0, y: 0, z: 0 };
    this.quat = new THREE.Quaternion();
    this.fov = 60;
    this.dist = 6;
    this.shake = 0;
    this.kick = 0;
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.orbit = 0;
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  look(dx, dy, sens, invert) {
    this.yaw -= dx * 0.0022 * sens;
    this.pitch -= dy * 0.0022 * sens * (invert ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.5, 1.5);
  }

  zoomBy(steps) {
    this.zoom = clamp(this.zoom * Math.pow(1.15, steps), 2.4, 600);
  }

  // target: the player body; visualR: its drawn radius (km)
  update(target, visualR, dt, opts = {}) {
    // render scale eases toward your size so growth feels smooth
    const k = 1 - Math.exp(-dt * 1.8);
    this.S = this.S <= 0 || !isFinite(this.S) ? visualR : this.S * Math.exp(Math.log(visualR / this.S) * k);
    if (opts.snap) this.S = visualR;
    this.kick += ((opts.boost ? 1 : 0) - this.kick) * Math.min(1, dt * 3);
    this.fov = 60 + this.kick * 9 + (opts.warp > 1 ? Math.min(14, Math.log10(opts.warp) * 4) : 0);
    this.dist = this.zoom * this.S * (1 + this.kick * 0.12);
    this._e.set(this.pitch, this.yaw, 0, 'YXZ');
    this.quat.setFromEuler(this._e);
    this.forward.set(0, 0, -1).applyQuaternion(this.quat);
    this.right.set(1, 0, 0).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    // sit behind and a little above, so you are just below the centre of the screen
    const back = this.dist;
    const lift = this.dist * 0.16;
    let sx = 0, sy = 0, sz = 0;
    if (this.shake > 0) {
      const s = this.shake * this.S * 0.25;
      sx = (Math.random() - 0.5) * s; sy = (Math.random() - 0.5) * s; sz = (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    this.pos.x = target.x - this.forward.x * back + this.up.x * lift + sx;
    this.pos.y = target.y - this.forward.y * back + this.up.y * lift + sy;
    this.pos.z = target.z - this.forward.z * back + this.up.z * lift + sz;
  }

  addShake(a) {
    this.shake = Math.min(1.5, this.shake + a);
  }
}
