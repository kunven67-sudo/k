// The game: owns the scene, physics, player, world and the main loop.
import * as THREE from 'three';
import { Physics } from './core/physics.js';
import { input } from './core/input.js';
import { bus } from './core/events.js';
import { View } from './render/view.js';
import { Lighting } from './render/lighting.js';
import { SkyDome } from './render/skydome.js';
import { Player } from './player/player.js';
import { currentTier } from './core/quality.js';
import { installDetail, updateDetail } from './render/detail.js';
import { Scatter } from './render/scatter.js';
import { Spawner } from './props/spawn.js';
import { Thumbs } from './ui/thumbs.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.tier = currentTier();
    installDetail(this.tier.name !== 'low');
    this.view = new View(canvas, this.tier);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 2000);
    this.physics = new Physics();
    this.props = new Set();
    this.updatables = new Set(); // things with update(dt)
    this.time = 0;
    this.frame = 0;
    this.paused = false;
    this.spawn = { position: [0, 0, 0], yaw: 0 };
    this.lighting = new Lighting(this.scene, this.camera, this.tier);
    this.sky = new SkyDome(this.view.renderer, this.scene, this.lighting);
    this.view.setView(this.scene, this.camera, this.sky.scene);
    this.scatter = new Scatter(this);
    this.spawner = new Spawner(this);
    this.thumbs = new Thumbs(this);
    this.ui = {}; // hud, menu, phone, touch (made in main.js)
    this.fps = 60;
    this.outdoor = 1; // 0 = deep indoors, 1 = open sky (drives exposure, like eyes adjusting)
    this.exposure = 1;
    this._last = performance.now();
  }

  async loadWorld(buildWorld, opts = {}) {
    const info = await buildWorld(this);
    this.spawn = info.spawn;
    const sp = { ...info.spawn, ...opts };
    this.player = new Player(this, { position: sp.position, yaw: sp.yaw, scale: sp.scale ?? 1 });
    this.player.pitch = sp.pitch ?? this.player.pitch;
    // Start with your eyes already adjusted to where you are (no fade from "outdoors" at spawn).
    // One physics step first: new colliders only answer ray queries after the world has stepped.
    this.physics.world.step();
    this.player.updateCamera(this.camera, 0);
    this.camera.updateMatrixWorld();
    this._updateExposure(0, true);
    bus.emit('world:loaded', this);
  }

  _updateExposure(dt, snap = false) {
    if (this.frame % 6 === 0 || snap) {
      const o = this.camera.position;
      const dirs = [[0, 1, 0], [0.5, 0.85, 0], [-0.5, 0.85, 0], [0, 0.85, 0.5], [0, 0.85, -0.5], [0.7, 0.3, 0.6], [-0.7, 0.3, -0.6]];
      let open = 0;
      for (const d of dirs) {
        const l = Math.hypot(d[0], d[1], d[2]);
        const hit = this.physics.raycast(o, { x: d[0] / l, y: d[1] / l, z: d[2] / l }, 60, {
          predicate: (c) => !this.physics.ownerOf(c),
        });
        if (!hit) open++;
      }
      this.outdoorTarget = open / dirs.length;
    }
    this.outdoor += ((this.outdoorTarget ?? 1) - this.outdoor) * (snap ? 1 : 1 - Math.exp(-1.5 * dt));
    this.sky.setIndoor(1 - this.outdoor);
    // Indoors the eye opens up (higher exposure); outside in daylight it closes down.
    const target = 1.0 - this.outdoor * 0.35;
    this.exposure += (target - this.exposure) * (snap ? 1 : 1 - Math.exp(-1.2 * dt));
    this.view.renderer.toneMappingExposure = this.exposure;
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.tick();
    };
    requestAnimationFrame(loop);
  }

  tick(forcedDt, render = true) {
    const now = performance.now();
    const dt = forcedDt ?? Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    this.fps = this.fps * 0.95 + (1 / Math.max(1e-3, dt)) * 0.05;
    if (!this.paused && this.player) {
      this.time += dt;
      this.player.latchInput();
      this.physics.update(dt, (step) => {
        this.player.fixedUpdate(step);
        this.player.hands.fixedUpdate(step);
      });
      this.player.update(dt, this.physics.alpha);
      for (const u of this.updatables) u.update(dt, this);
      this.player.updateCamera(this.camera, dt);
      this.camera.updateMatrixWorld();
      this.player.hands.updateLook(this.camera);
      this.player.hands.update(dt);
      this.sky.update(dt, this.camera);
      this._updateExposure(dt);
      this.lighting.update(this.player.height);
      updateDetail(this.camera);
      this.scatter.update();
      if (this.frame % 120 === 0) for (const p of this.props) p.checkBounds();
    }
    bus.emit('frame', dt);
    if (render) {
      this.thumbs.render(this.view.renderer); // product photos for the phone, drawn before the frame
      this.view.render();
    }
    input.endFrame();
    this.frame++;
  }
}
