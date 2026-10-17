import * as THREE from 'three';
import { Renderer } from './core/renderer.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Physics } from './core/physics.js';
import { Interact } from './core/interact.js';
import { buildHouse } from './world/house.js';
import { buildLighting } from './world/lighting.js';
import { roomAt } from './world/layout.js';
import { RoomEnv } from './world/envmap.js';
import { buildDesk } from './world/desk.js';
import { Player } from './player/player.js';

const $ = id => document.getElementById(id);

export class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.clockOverride = null;
  }

  progress(frac, text) {
    $('loadbar').firstElementChild.style.width = Math.round(frac * 100) + '%';
    if (text) $('loadtext').textContent = text;
  }

  now() {
    if (this.clockOverride) return this.clockOverride;
    const t = this.params.get('time');
    if (t) { const d = new Date(); const [h, m] = t.split(':').map(Number); d.setHours(h, m || 0, 0, 0); return d; }
    return new Date();
  }

  async boot() {
    this.progress(0.02, 'Starting the graphics card');
    const canvas = $('view');
    this.renderer = new Renderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 200);
    this.camera.position.set(2.7, 1.6, 3.5);
    this.scene.add(this.camera);
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.physics = new Physics();
    this.interact = new Interact(this.camera);
    const q = this.params.get('q');
    if (q) this.renderer.set(q);
    this.renderer.setup(this.scene, this.camera);

    this.progress(0.1, 'Building the house');
    this.house = await buildHouse(this);
    this.progress(0.3, 'Setting up your desk');
    this.desk = await buildDesk(this);
    this.progress(0.35, 'Making you');
    this.settings = { sens: 1, seatFov: 60, seatLow: 0.13 };
    this.bed = { pelvis: new THREE.Vector3(1.15, 0.62, 3.75), headDir: new THREE.Vector3(0, 0, 1) };
    this.player = new Player(this);
    await this.player.init();
    this.progress(0.4, 'Turning on the lights');
    this.lights = buildLighting(this, this.house);
    if (this.params.get('lights') !== '0') this.lights.setRoom('bedroom', this.params.get('lights') === '1');

    this.env = new RoomEnv(this.renderer.gl, this.scene);
    this.lights.update(this.now(), this.house);
    this.env.all();
    this.scene.environmentIntensity = 1.0;
    this.progress(1, 'Ready');
    this.last = performance.now();
    $('loading').classList.add('hidden');
    const st = this.params.get('state');
    if (st === 'sit') { this.player.state = 'sit'; }
    else if (st === 'bed') { this.player.state = 'bed'; }
    else if (st === 'walk') { const [x, z, yaw, pitch] = (this.params.get('at') || '3,3,1.57,0').split(',').map(Number); this.player.standAt(x, z, yaw); this.player.pitch = pitch || 0; }
    else this.player.state = 'none';
    this.devCamera();
    this.loop();
  }

  toast(text, ms = 2600) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  footstep(pos, fast) {
    const room = roomAt(pos.x, pos.z);
    const tile = room === 'kitchen' || room === 'bathroom';
    const n = 1 + Math.floor(Math.random() * 4);
    this.audio.play(tile ? `step_tile${n}.ogg` : `step_wood${n}.ogg`, { pos: pos.clone().setY(0.05), vol: fast ? 0.5 : 0.35, jitter: 0.06 });
  }

  devCamera() {
    const c = this.params.get('cam'), l = this.params.get('look');
    if (c) this.camera.position.set(...c.split(',').map(Number));
    if (l) this.camera.lookAt(new THREE.Vector3(...l.split(',').map(Number)));
    const f = this.params.get('fov');
    if (f) { this.camera.fov = +f; this.camera.updateProjectionMatrix(); }
  }

  loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.renderer.render();
    this.renderer.track(dt);
    this.frames = (this.frames || 0) + 1;
    if (this.frames === 3) window.__ready = true;
    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    this.lights.update(this.now(), this.house);
    for (const d of Object.values(this.house.doors)) d.update(dt);
    this.t = (this.t || 0) + dt;
    this.desk.update(dt, this.t, true);
    if (this.player.state !== 'none') this.player.update(dt, this.input);
    if (this.params.get('freecam')) { this.player.avatar.hideHead(false); this.devCamera(); }
    for (const w of Object.values(this.house.windows)) w.blinds?.update(dt);
    this.audio.update(this.camera);
    this.room = roomAt(this.camera.position.x, this.camera.position.z) || this.room || 'bedroom';
    this.scene.environment = this.env.update(this.room, this.envDirty);
    this.envDirty = false;
  }
}
