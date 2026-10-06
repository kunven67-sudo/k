// Dev page: downtown Reno slice (4th St, N Virginia St, the Arch, Eldorado exterior) under the
// real sky. Not linked from the game.
//
// Controls
//   mouse (click to lock) look · WASD move · Shift fast · Q / E down / up (fly)
//   F       toggle walk mode (Rapier character capsule + third-person camera) / fly mode
//   [ / ]   hour -1 / +1          ; / '   day -1 / +1          T   run / freeze time
//   R       toggle rain           1..6    camera presets       H   hide this panel
// URL params: ?hour=21&min=30&date=2026-10-05&cam=arch&rain=1&run=1&walk=1&panel=0

import * as THREE from 'three';
import { runState } from './harness.js';
import { createSky } from '../src/gfx/sky.js';
import { setMaxAnisotropy } from '../src/gfx/textures.js';
import { buildReno } from '../src/world/reno/index.js';
import { PhysicsWorld } from '../src/core/physics.js';
import { clock, zonedToUtc, localParts, RENO } from '../src/core/clock.js';
import { input } from '../src/core/input.js';
import { i18n, t } from '../src/core/i18n.js';
import { clamp, damp, el, injectStyle } from '../src/core/util.js';
import { mat } from '../src/gfx/materials.js';

i18n.register('devcity', {
  en: {
    title: 'Downtown Reno',
    fly: 'Fly',
    walk: 'Walk',
    rain: 'Rain',
    dry: 'Dry',
    running: 'Time running',
    frozen: 'Time frozen',
    help: 'Click to look · WASD move · Shift fast · Q/E down/up · F walk/fly · [ ] hour · ; \' day · T time · R rain · 1–6 views · H hide',
    loading: 'Laying asphalt…',
  },
  es: {
    title: 'Centro de Reno',
    fly: 'Volar',
    walk: 'Caminar',
    rain: 'Lluvia',
    dry: 'Seco',
    running: 'Tiempo corriendo',
    frozen: 'Tiempo congelado',
    help: 'Clic para mirar · WASD mover · Shift rápido · Q/E bajar/subir · F caminar/volar · [ ] hora · ; \' día · T tiempo · R lluvia · 1–6 vistas · H ocultar',
    loading: 'Echando asfalto…',
  },
});

injectStyle('dev-city', `
  .dc-panel { position:absolute; right:calc(14px + var(--safe-right, 0px)); top:calc(14px + var(--safe-top, 0px));
    min-width:230px; max-width:340px; padding:12px 14px 11px; border-radius:10px; color:#f3ead8;
    background:linear-gradient(160deg, rgba(20,16,14,.78), rgba(8,7,9,.72)); border:1px solid rgba(216,178,90,.35);
    box-shadow:0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06); font:500 12px/1.4 var(--font-ui);
    -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); pointer-events:none; }
  .dc-title { font:400 22px/1 var(--font-display); letter-spacing:.06em; color:#e8c46a; }
  .dc-time { font:400 34px/1 var(--font-display); letter-spacing:.04em; margin:6px 0 2px; }
  .dc-date { opacity:.75; font-size:11px; letter-spacing:.04em; text-transform:uppercase; }
  .dc-tags { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0 6px; }
  .dc-tag { padding:2px 8px; border-radius:99px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); font-size:11px; }
  .dc-tag.on { background:rgba(216,178,90,.25); border-color:rgba(216,178,90,.6); color:#ffe3a3; }
  .dc-help { opacity:.6; font-size:10.5px; line-height:1.45; }
  .dc-load { position:absolute; inset:0; display:grid; place-items:center; color:#e8c46a; font:400 28px var(--font-display);
    letter-spacing:.1em; background:#0b0a0c; }
`);

const PRESETS = {
  // name: [x, y, z, lookX, lookY, lookZ]
  virginia: [3.5, 1.7, -32, 0.5, 7.5, 108],
  arch: [4.2, 1.55, 90, -0.5, 10.5, 108],
  strip: [128, 1.65, 9.6, 250, 3.2, -4],
  eldo: [7.5, 1.7, 38, -13, 4.5, 50],
  walk: [9.2, 1.8, 30, 9.2, 1.6, 60],
  overview: [80, 70, 160, -10, 0, 20],
};
const PRESET_KEYS = ['virginia', 'arch', 'strip', 'eldo', 'walk', 'overview'];

class CityDev {
  constructor(engine) {
    this.engine = engine;
    this.mode = 'fly';
    this.yaw = 0;
    this.pitch = 0;
    this.camPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.weather = { cloudCover: 0.18, rain: 0, fog: 0 };
    this.timeRunning = false;
  }

  async enter(params) {
    const e = this.engine;
    setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    const loading = el('div', { class: 'dc-load', text: t('devcity.loading') });
    e.uiRoot.appendChild(loading);

    // Time: frozen by default so views are repeatable.
    const now = localParts(Date.now(), RENO.tz);
    const [y, m, d] = (params.date || `${now.year}-${now.month}-${now.day}`).split('-').map(Number);
    clock.setTime(zonedToUtc(y, m, d, +(params.hour ?? 12), +(params.min ?? 0)));
    this.timeRunning = params.run === '1';
    clock.paused = !this.timeRunning;
    if (params.rain === '1') this._setRain(true);

    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(62, 1, 0.08, 2400);
    this.camera = camera;
    this.physics = new PhysicsWorld();
    e.physics = this.physics;

    this.sky = createSky(scene, e.renderer, { tier: e.tier });
    this.world = await buildReno(e, this.physics, { tier: e.tier });
    scene.add(this.world.group);

    this._setPreset(params.cam || 'virginia');
    e.setView(scene, camera);
    input.setPointerLock(true);

    this._keys = (ev) => this._onKey(ev);
    window.addEventListener('keydown', this._keys);
    this.panel = el('div', { class: 'dc-panel' });
    if (params.panel !== '0') e.uiRoot.appendChild(this.panel);
    loading.remove();
    if (params.walk === '1') this._toggleWalk();
    // Prime sky + world once so the first frame is lit correctly.
    this.sky.update(clock, this.weather, this.camPos);
    this.world.update(0, clock, { weather: this.weather, camera, viewer: this.camPos });

    this.ready = true;
    window.__city = {
      setHour: (h, mi = 0) => this._setHour(h, mi),
      preset: (n) => this._setPreset(n),
      rain: (on) => this._setRain(on),
      walk: () => this._toggleWalk(),
      world: this.world,
      sky: this.sky,
      look: (x, y2, z, lx, ly, lz) => this._look(x, y2, z, lx, ly, lz),
      info: () => {
        const r = e.renderer.info.render;
        return { calls: r.calls, tris: r.triangles, geos: e.renderer.info.memory.geometries, tex: e.renderer.info.memory.textures, mode: this.mode, pos: this.camPos.toArray().map((v) => +v.toFixed(2)) };
      },
    };
  }

  _look(x, y, z, lx, ly, lz) {
    this.camPos.set(x, y, z);
    const dx = lx - x;
    const dy = ly - y;
    const dz = lz - z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  _setPreset(name) {
    const p = PRESETS[name] || PRESETS.virginia;
    this._look(...p);
    if (this.mode === 'walk') this._toggleWalk();
  }

  _setHour(h, mi = 0) {
    const p = clock.local;
    clock.setTime(zonedToUtc(p.year, p.month, p.day, h, mi));
  }

  _setRain(on) {
    this.weather.rain = on ? 1 : 0;
    this.weather.cloudCover = on ? 0.95 : 0.18;
  }

  _onKey(ev) {
    if (ev.repeat) return;
    switch (ev.code) {
      case 'BracketLeft': clock.setTime(clock.gameMs - 3600e3); break;
      case 'BracketRight': clock.setTime(clock.gameMs + 3600e3); break;
      case 'Semicolon': clock.setTime(clock.gameMs - 86400e3); break;
      case 'Quote': clock.setTime(clock.gameMs + 86400e3); break;
      case 'KeyR': this._setRain(this.weather.rain < 0.5); break;
      case 'KeyF': this._toggleWalk(); break;
      case 'KeyT': this.timeRunning = !this.timeRunning; clock.paused = !this.timeRunning; break;
      case 'KeyH': this.panel.style.display = this.panel.style.display === 'none' ? '' : 'none'; break;
      default:
        if (/^Digit[1-6]$/.test(ev.code)) this._setPreset(PRESET_KEYS[+ev.code.slice(5) - 1]);
    }
  }

  _toggleWalk() {
    if (this.mode === 'fly') {
      // Drop a capsule onto whatever is below the camera.
      const p = this.camPos;
      const hit = this.physics.raycast({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0, y: -1, z: 0 }, 200);
      const gy = hit ? hit.point.y : 0;
      this.char = this.physics.createCharacter({ position: { x: p.x, y: gy + 1.0, z: p.z } });
      if (!this.avatar) {
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.11, 6, 16), mat('fabric', { color: 0x3a4a6b }));
        body.castShadow = true;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), mat('leather', { color: 0xb07a55, wear: 0 }));
        head.position.y = 0.95;
        head.castShadow = true;
        this.avatar = new THREE.Group();
        this.avatar.add(body, head);
      }
      this.scene.add(this.avatar);
      this.vel.set(0, 0, 0);
      this.camDist = 3.4;
      this.mode = 'walk';
    } else {
      if (this.char) {
        this.physics.world.removeRigidBody(this.char.body);
        this.physics.world.removeCharacterController(this.char.controller);
        this.char = null;
      }
      this.avatar?.removeFromParent();
      this.mode = 'fly';
    }
  }

  fixedUpdate(step) {
    if (this.mode !== 'walk' || !this.char) return;
    const c = this.char;
    const speed = input.down('sprint') ? 6.2 : 2.7;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(input.move.y).add(right.multiplyScalar(input.move.x)).multiplyScalar(speed);
    this.vel.x = damp(this.vel.x, wish.x, 0.09, step);
    this.vel.z = damp(this.vel.z, wish.z, 0.09, step);
    const grounded = c.controller.computedGrounded?.();
    this.vel.y = grounded && this.vel.y <= 0 ? -0.6 : this.vel.y - 9.81 * step;
    if (input.pressed('jump') && grounded) this.vel.y = 4.4;
    c.controller.computeColliderMovement(c.collider, { x: this.vel.x * step, y: this.vel.y * step, z: this.vel.z * step });
    const m = c.controller.computedMovement();
    const p = c.body.translation();
    c.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
  }

  update(dt, realDt) {
    if (!this.ready) return; // the engine ticks states while enter() is still building
    const rdt = Math.min(realDt || dt, 0.1);
    this.yaw -= input.look.x * 0.0022;
    this.pitch = clamp(this.pitch - input.look.y * 0.0022, -1.45, 1.45);
    const cam = this.camera;
    if (this.mode === 'fly') {
      const speed = input.down('sprint') ? 40 : 9;
      const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      this.camPos.addScaledVector(f, input.move.y * speed * rdt).addScaledVector(r, input.move.x * speed * rdt);
      if (input.keysDown.has('KeyE')) this.camPos.y += speed * rdt;
      if (input.keysDown.has('KeyQ')) this.camPos.y -= speed * rdt;
      cam.position.copy(this.camPos);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    } else if (this.char) {
      const p = this.char.body.translation();
      this.avatar.position.set(p.x, p.y, p.z);
      const v2 = Math.hypot(this.vel.x, this.vel.z);
      if (v2 > 0.2) this.avatar.rotation.y = Math.atan2(this.vel.x, this.vel.z);
      const pitch = clamp(this.pitch, -0.9, 0.7);
      const pivot = new THREE.Vector3(p.x, p.y + 0.62, p.z);
      const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
      const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.45);
      // Pull the camera in when something is between it and the character.
      const toi = this.physics.sphereCast(pivot, back, 0.2, this.camDist, { exclude: this.char.collider });
      this.camDist = damp(this.camDist, toi != null ? Math.max(0.6, toi - 0.1) : 3.4, 0.05, rdt);
      cam.position.copy(pivot).addScaledVector(back, this.camDist).add(side);
      cam.rotation.set(pitch, this.yaw, 0, 'YXZ');
      this.camPos.copy(cam.position);
    }
    const focus = this.mode === 'walk' && this.avatar ? this.avatar.position : this.camPos;
    this.sky.update(clock, this.weather, focus);
    this.world.update(dt, clock, { weather: this.weather, camera: cam, viewer: focus, sky: this.sky });
    this._panelTick = (this._panelTick || 0) + 1;
    if (this._panelTick % 10 === 1) this._renderPanel();
  }

  _renderPanel() {
    const time = clock.format({ hour: 'numeric', minute: '2-digit' });
    const date = clock.format({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const tag = (txt, on) => el('span', { class: `dc-tag${on ? ' on' : ''}`, text: txt });
    this.panel.replaceChildren(
      el('div', { class: 'dc-title', text: t('devcity.title') }),
      el('div', { class: 'dc-time', text: time }),
      el('div', { class: 'dc-date', text: date }),
      el('div', { class: 'dc-tags' }, [
        tag(this.mode === 'fly' ? t('devcity.fly') : t('devcity.walk'), true),
        tag(this.weather.rain > 0.5 ? t('devcity.rain') : t('devcity.dry'), this.weather.rain > 0.5),
        tag(this.timeRunning ? t('devcity.running') : t('devcity.frozen'), this.timeRunning),
      ]),
      el('div', { class: 'dc-help', text: t('devcity.help') })
    );
  }

  exit() {
    window.removeEventListener('keydown', this._keys);
    input.setPointerLock(false);
    this.world?.dispose?.();
    this.sky?.dispose();
  }
}

runState(CityDev);
