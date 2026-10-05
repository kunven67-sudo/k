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
    this.mode = 'chase';
    this.lyaw = 0;
    this.lpitch = 0;
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  look(dx, dy, sens, invert) {
    if (this.mode === 'low' || this.mode === 'surface') {
      this.lyaw -= dx * 0.0022 * sens;
      this.lpitch = clamp(this.lpitch - dy * 0.0022 * sens * (invert ? -1 : 1), -1.5, 1.5);
      return;
    }
    this.yaw -= dx * 0.0022 * sens;
    this.pitch -= dy * 0.0022 * sens * (invert ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.5, 1.5);
  }

  zoomBy(steps) {
    if (this.mode === 'low') { this.alt = clamp((this.alt || 0.03) * Math.pow(1.15, steps), 0.004, 0.4); return; }
    if (this.mode === 'surface') return;
    this.zoom = clamp(this.zoom * Math.pow(1.15, steps), this.mode === 'orbit' ? 1.3 : 2.4, this.mode === 'orbit' ? 2e5 : 600);
  }

  // chase: behind you; orbit: free camera that can pull far back;
  // low: skimming your atmosphere; surface: standing on the ground looking up
  setMode(mode, body, sunDir = null) {
    if (this.mode === mode) return;
    if (!this.mode || this.mode === 'chase' || this.mode === 'orbit') this.saved = { yaw: this.yaw, pitch: this.pitch, zoom: this.zoom };
    this.mode = mode;
    if (mode === 'low') {
      this.lyaw = 0; this.lpitch = -0.32; this.alt = clamp(220 / Math.max(body.radius, 1), 0.006, 0.12); this.orbitAng = 0;
      // start over the day side, heading toward the terminator
      if (sunDir) {
        const l = Math.hypot(sunDir.x, sunDir.y, sunDir.z) || 1;
        let best = -2;
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
          const d = (Math.cos(a) * sunDir.x + Math.sin(a) * Math.sin(0.5) * sunDir.y + Math.sin(a) * Math.cos(0.5) * sunDir.z) / l;
          if (d > best) { best = d; this.orbitAng = a; }
        }
        this.orbitAng += 0.9;
      }
    }
    else if (mode === 'surface') {
      this.lyaw = 0; this.lpitch = 0.28;
      // stand somewhere in the morning, facing the sky
      this.surfLat = 0.55;
      this.surfLon = 0;
      if (sunDir) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(body.tilt || 0, body.rot || 0, 0, 'XYZ')).invert();
        const d = new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z).normalize().applyQuaternion(q);
        this.surfLat = clamp(Math.asin(clamp(d.y, -1, 1)) * 0.5 + 0.2, -1.1, 1.1);
        this.surfLon = Math.atan2(d.x, d.z) - 0.7;
      }
    }
    else if (this.saved) { this.yaw = this.saved.yaw; this.pitch = this.saved.pitch; this.zoom = clamp(this.saved.zoom, mode === 'orbit' ? 1.3 : 2.4, mode === 'orbit' ? 2e5 : 600); }
    this.snapS = true;
  }

  get near() {
    return this.mode === 'surface' ? 1e-7 : this.mode === 'low' ? 1e-5 : 1e-3;
  }

  // target: the player body; visualR: its drawn radius (km)
  update(target, visualR, dt, opts = {}) {
    if (this.mode === 'low' || this.mode === 'surface') { this.updateClose(target, visualR, dt, opts); return; }
    // render scale eases toward your size so growth feels smooth
    const k = 1 - Math.exp(-dt * 1.8);
    this.S = this.S <= 0 || !isFinite(this.S) ? visualR : this.S * Math.exp(Math.log(visualR / this.S) * k);
    if (opts.snap || this.snapS) { this.S = visualR; this.snapS = false; }
    this.ground = null;
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
    const lift = this.mode === 'orbit' ? 0 : this.dist * 0.16;
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

  // the two close-up views ride along with your world
  updateClose(target, visualR, dt, opts) {
    this.S = visualR;
    this.kick = 0;
    this.fov = this.mode === 'surface' ? 70 : 62;
    const R = visualR;
    const b = target;
    // body rotation (same as the renderer's mesh: Euler XYZ tilt, rot)
    this._e2 = this._e2 || new THREE.Euler();
    this._q2 = this._q2 || new THREE.Quaternion();
    this._v = this._v || new THREE.Vector3();
    this._t = this._t || new THREE.Vector3();
    const up = this._v, fw = this._t;
    if (this.mode === 'surface') {
      this._e2.set(b.tilt || 0, b.rot || 0, 0, 'XYZ');
      this._q2.setFromEuler(this._e2);
      const la = this.surfLat ?? 0.55, lo = this.surfLon ?? 0;
      up.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)).applyQuaternion(this._q2).normalize();
      // look toward the local north at first
      fw.set(0, 1, 0).applyQuaternion(this._q2);
      fw.addScaledVector(up, -fw.dot(up)).normalize();
      this.dist = R * Math.max(0.0004, 0.002 / Math.max(R, 1e-3));
    } else {
      // a slow, cinematic orbit (real low orbits take about 90 minutes)
      this.orbitAng = (this.orbitAng || 0) + dt * ((2 * Math.PI) / 150);
      const inc = 0.5;
      const a = this.orbitAng;
      up.set(Math.cos(a), Math.sin(a) * Math.sin(inc), Math.sin(a) * Math.cos(inc)).normalize();
      fw.set(-Math.sin(a), Math.cos(a) * Math.sin(inc), Math.cos(a) * Math.cos(inc)).normalize();
      this.dist = R * (this.alt || 0.03);
    }
    // base orientation: forward along the ground, up away from the centre
    const right = new THREE.Vector3().crossVectors(fw, up).normalize();
    const m = new THREE.Matrix4().makeBasis(right, up, fw.clone().negate());
    const base = new THREE.Quaternion().setFromRotationMatrix(m);
    const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.lpitch, this.lyaw, 0, 'YXZ'));
    this.quat.copy(base).multiply(look);
    this.forward.set(0, 0, -1).applyQuaternion(this.quat);
    this.right.set(1, 0, 0).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    const h = this.dist;
    let sx = 0, sy = 0, sz = 0;
    if (this.shake > 0) {
      const s = this.shake * h * 0.02;
      sx = (Math.random() - 0.5) * s; sy = (Math.random() - 0.5) * s; sz = (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    this.pos.x = b.x + up.x * (R + h) + sx;
    this.pos.y = b.y + up.y * (R + h) + sy;
    this.pos.z = b.z + up.z * (R + h) + sz;
    this.ground = { x: up.x, y: up.y, z: up.z };
    void opts;
  }

  addShake(a) {
    this.shake = Math.min(1.5, this.shake + a);
  }
}
