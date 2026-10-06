// The engine: owns the shared services, the module list and the frame loop.
// Modules are plain objects with optional hooks (see ARCHITECTURE.md → Engine and modules).
import { EventBus } from './bus.js';

const HOOKS = ['prePhysics', 'postPhysics', 'update', 'render'];

export class Engine {
  constructor() {
    this.bus = new EventBus();
    this.modules = [];
    this.hooks = Object.fromEntries(HOOKS.map((h) => [h, []]));
    this.running = false;
    this.frameCount = 0;
    this.fps = 60;
    this.fixedDt = 1 / 60;
    this.maxSubsteps = 4;
    this.acc = 0;
    this.lastT = 0;
    this.debug = false;
  }

  log(...args) {
    if (this.debug) console.log('[physbox]', ...args);
  }

  // add a module; hooks are collected in registration order
  register(mod) {
    if (!mod) return mod;
    this.modules.push(mod);
    for (const h of HOOKS) if (typeof mod[h] === 'function') this.hooks[h].push(mod);
    return mod;
  }

  async initModules() {
    for (const mod of this.modules) {
      if (typeof mod.init === 'function') await mod.init(this);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.frame(t);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }

  frame(tNow) {
    let dt = (tNow - this.lastT) / 1000;
    this.lastT = tNow;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    this.fps += (1 / dt - this.fps) * 0.05;
    this.frameCount++;
    try {
      this.input?.beginFrame?.(dt);
      this.time?.advance?.(dt);
      for (const m of this.hooks.update) m.update(dt);
      this.stepPhysics(dt);
      this.camera?.update?.(dt);
      for (const m of this.hooks.render) m.render(dt);
      this.renderer?.draw?.(dt);
      this.input?.endFrame?.();
    } catch (err) {
      this.fail(err);
    }
  }

  // fixed-step physics; slow motion shrinks the step so it stays smooth
  stepPhysics(dt) {
    const time = this.time;
    const physics = this.physics;
    if (!physics || !physics.world) return;
    if (time && (time.frozen || time.warp > 1)) {
      this.acc = 0;
      return;
    }
    const scale = time ? time.physicsScale : 1;
    const step = this.fixedDt * Math.max(0.02, Math.min(1, scale));
    // real seconds of simulation needed this frame
    this.acc += dt * scale;
    let n = 0;
    while (this.acc >= step && n < this.maxSubsteps) {
      for (const m of this.hooks.prePhysics) m.prePhysics(step);
      physics.step(step);
      for (const m of this.hooks.postPhysics) m.postPhysics(step);
      this.acc -= step;
      n++;
    }
    // drop time we can't catch up on rather than spiralling
    if (this.acc > step * this.maxSubsteps) this.acc = 0;
    this.physicsSteps = n;
  }

  fail(err) {
    console.error(err);
    this.stop();
    this.bus.emit('fatal', err);
    const el = document.getElementById('fatal');
    if (el) {
      el.hidden = false;
      const msg = el.querySelector('.fatal-msg');
      if (msg) msg.textContent = `${err && err.message ? err.message : err}\n\n${(err && err.stack) || ''}`.slice(0, 3000);
    }
  }

  serializeModules() {
    const out = {};
    for (const m of this.modules) {
      if (m.name && typeof m.serialize === 'function') {
        try {
          out[m.name] = m.serialize();
        } catch (err) {
          console.error(`[engine] ${m.name}.serialize failed`, err);
        }
      }
    }
    return out;
  }

  deserializeModules(obj = {}) {
    for (const m of this.modules) {
      if (m.name && typeof m.deserialize === 'function' && obj[m.name] !== undefined) {
        try {
          m.deserialize(obj[m.name]);
        } catch (err) {
          console.error(`[engine] ${m.name}.deserialize failed`, err);
        }
      }
    }
  }
}
