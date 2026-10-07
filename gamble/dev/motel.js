// Dev page: the Starlite Motel in isolation under the real sky, with a dev-only strip of E 4th St
// (road, sidewalks, dirt around) for context. Not linked from the game.
//
// Controls
//   mouse (click to lock) look · WASD move · Shift fast · Q / E down / up (fly)
//   F       toggle walk (Rapier capsule + third-person camera) / free-fly
//   [ / ]   hour -1 / +1      T run / freeze time      1..8 camera presets      H hide panel
//   G       interact with the nearest motel interactable (toggle door / light / TV …)
// URL params: ?hour=11&min=0&cam=wake&walk=1&room=23&panel=0&fp=1 (first-person in walk mode)
import * as THREE from 'three';
import { runState } from './harness.js';
import { createSky } from '../src/gfx/sky.js';
import { setMaxAnisotropy } from '../src/gfx/textures.js';
import { buildStarlite } from '../src/world/motel/index.js';
import { PhysicsWorld } from '../src/core/physics.js';
import { clock, zonedToUtc, localParts, RENO } from '../src/core/clock.js';
import { input } from '../src/core/input.js';
import { i18n, t } from '../src/core/i18n.js';
import { clamp, damp, el, injectStyle } from '../src/core/util.js';
import { mat } from '../src/gfx/materials.js';
import { StaticBatch, Colliders } from '../src/world/shared/batch.js';

i18n.register('devmotel', {
  en: {
    title: 'Starlite Motel', fly: 'Fly', walk: 'Walk', running: 'Time running', frozen: 'Time frozen', room: 'Room',
    help: 'Click to look · WASD move · Shift fast · Q/E down/up · F walk/fly · [ ] hour · T time · G interact · 1–8 views · H hide',
    loading: 'Checking in…',
  },
  es: {
    title: 'Starlite Motel', fly: 'Volar', walk: 'Caminar', running: 'Tiempo corriendo', frozen: 'Tiempo congelado', room: 'Cuarto',
    help: 'Clic para mirar · WASD mover · Shift rápido · Q/E bajar/subir · F caminar/volar · [ ] hora · T tiempo · G interactuar · 1–7 vistas · H ocultar',
    loading: 'Registrándose…',
  },
});

injectStyle('dev-motel', `
  .dm-panel { position:absolute; right:calc(14px + var(--safe-right, 0px)); top:calc(14px + var(--safe-top, 0px));
    min-width:220px; max-width:330px; padding:12px 14px 11px; border-radius:10px; color:#f3ead8;
    background:linear-gradient(160deg, rgba(28,18,22,.8), rgba(10,8,12,.74)); border:1px solid rgba(255,110,170,.35);
    box-shadow:0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06); font:500 12px/1.4 var(--font-ui);
    -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); pointer-events:none; }
  .dm-title { font:400 22px/1 var(--font-display); letter-spacing:.08em; color:#ff8fc0; }
  .dm-time { font:400 34px/1 var(--font-display); letter-spacing:.04em; margin:6px 0 2px; }
  .dm-tags { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0 6px; }
  .dm-tag { padding:2px 8px; border-radius:99px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); font-size:11px; }
  .dm-tag.on { background:rgba(255,110,170,.22); border-color:rgba(255,110,170,.6); color:#ffd3e6; }
  .dm-help { opacity:.6; font-size:10.5px; line-height:1.45; }
  .dm-load { position:absolute; inset:0; display:grid; place-items:center; color:#ff8fc0; font:400 28px var(--font-display);
    letter-spacing:.12em; background:#0b0a0c; }
`);

// name: [x, y, z, lookX, lookY, lookZ]
const PRESETS = {
  wake: [205.25, 0.5, -47.35, 204.8, 0.95, -45.3],
  door: [206.3, 1.6, -49.6, 205.4, 1.2, -45.3],
  room: [207.6, 1.75, -45.7, 204.6, 0.7, -50.6],
  bath: [206.2, 1.62, -51.85, 207.9, 1.45, -52.3],
  lot: [199.5, 1.7, -14.5, 214, 3.2, -44],
  sign: [200.5, 1.6, -9.0, 196, 7.6, -14],
  office: [187.2, 1.65, -14.4, 187.2, 1.3, -20.5],
  overview: [232, 26, 2, 205, 0, -33],
};
const PRESET_KEYS = ['wake', 'room', 'bath', 'lot', 'sign', 'office', 'overview', 'door'];

class MotelDev {
  constructor(engine) {
    this.engine = engine;
    this.mode = 'fly';
    this.yaw = 0;
    this.pitch = 0;
    this.camPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.weather = { cloudCover: 0.12, rain: 0, fog: 0 };
    this.timeRunning = false;
  }

  async enter(params) {
    const e = this.engine;
    setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    const loading = el('div', { class: 'dm-load', text: t('devmotel.loading') });
    e.uiRoot.appendChild(loading);
    const now = localParts(Date.now(), RENO.tz);
    const [y, m, d] = (params.date || `${now.year}-${now.month}-${now.day}`).split('-').map(Number);
    clock.setTime(zonedToUtc(y, m, d, +(params.hour ?? 11), +(params.min ?? 0)));
    this.timeRunning = params.run === '1';
    clock.paused = !this.timeRunning;
    this.firstPerson = params.fp === '1';

    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 2400);
    this.camera = camera;
    this.physics = new PhysicsWorld();
    e.physics = this.physics;
    this.sky = createSky(scene, e.renderer, { tier: e.tier });
    scene.add(this._context());
    this.motel = await buildStarlite(e, this.physics, { tier: e.tier });
    scene.add(this.motel.group);
    if (params.room) this.motel.setRoomNumber(+params.room);

    this._setPreset(params.cam || 'wake');
    e.setView(scene, camera);
    input.setPointerLock(true);
    this._keys = (ev) => this._onKey(ev);
    window.addEventListener('keydown', this._keys);
    this.panel = el('div', { class: 'dm-panel' });
    if (params.panel !== '0') e.uiRoot.appendChild(this.panel);
    loading.remove();
    if (params.walk === '1') {
      const s = this.motel.spawn[params.spawn || 'wakeFloor'];
      this.camPos.set(s.x, s.y + 1, s.z);
      this.yaw = s.yaw;
      this._toggleWalk();
    }
    this.sky.update(clock, this.weather, this.camPos);
    this.motel.update(0, clock, { camera, viewer: this.camPos, sky: this.sky, scene, indoorLighting: true });
    this.ready = true;
    window.__motel = {
      setHour: (h, mi = 0) => this._setHour(h, mi),
      preset: (n) => this._setPreset(n),
      look: (...a) => this._look(...a),
      walk: () => this._toggleWalk(),
      motel: this.motel,
      interact: (id, v) => this._interact(id, v),
      // Collision test without rendering: walk the capsule along `yaw` for `sec` simulated seconds.
      simWalk: (yaw, sec = 1, speed = 2.4) => {
        if (this.mode !== 'walk') this._toggleWalk();
        const c = this.char;
        const step = 1 / 60;
        for (let i = 0; i < sec * 60; i++) {
          const grounded = c.controller.computedGrounded?.();
          this.vel.set(-Math.sin(yaw) * speed, grounded ? -0.6 : this.vel.y - 9.81 * step, -Math.cos(yaw) * speed);
          c.controller.computeColliderMovement(c.collider, { x: this.vel.x * step, y: this.vel.y * step, z: this.vel.z * step });
          const m = c.controller.computedMovement();
          const p = c.body.translation();
          c.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
          for (const it of this.motel.interactables) it.update?.(step);
          this.physics.step();
        }
        const p = c.body.translation();
        return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
      },
      info: () => {
        const r = e.renderer.info.render;
        return { calls: r.calls, tris: r.triangles, geos: e.renderer.info.memory.geometries, tex: e.renderer.info.memory.textures, mode: this.mode, pos: this.camPos.toArray().map((v) => +v.toFixed(2)), colliders: this.motel.colliderCount };
      },
    };
  }

  // Dev-only context: E 4th St (road + sidewalks) and dirt lots around the parcel.
  _context() {
    const batch = new StaticBatch({ name: 'dev-context', chunkSize: 128 });
    const col = new Colliders(this.physics);
    const road = mat('asphalt', { seed: 3 });
    const walk = mat('sidewalk', { seed: 4 });
    const curb = mat('curb', { seed: 5 });
    const dirt = mat('dirt', { seed: 6 });
    const slab = (x0, z0, x1, z1, y0, y1, m) => {
      batch.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), m, { castShadow: false });
      col.aabb(x0, y0 - 0.3, z0, x1, y1, z1);
    };
    slab(120, -7, 300, 7, -0.3, 0, road);
    slab(120, -11, 300, -7.15, -0.3, 0.15, walk);
    slab(120, 7.15, 300, 11, -0.3, 0.15, walk);
    slab(120, -7.15, 300, -7, -0.3, 0.15, curb);
    slab(120, 7, 300, 7.15, -0.3, 0.15, curb);
    // Dirt all around the lot (never under it: the pool basin goes 2 m down).
    slab(120, -120, 180, -11, -0.3, 0.15, dirt);
    slab(230, -120, 300, -11, -0.3, 0.15, dirt);
    slab(180, -120, 230, -55, -0.3, 0.15, dirt);
    slab(120, 11, 300, 120, -0.3, 0.15, dirt);
    const { group } = batch.build();
    return group;
  }

  _look(x, y, z, lx, ly, lz) {
    this.camPos.set(x, y, z);
    this.yaw = Math.atan2(-(lx - x), -(lz - z));
    this.pitch = Math.atan2(ly - y, Math.hypot(lx - x, lz - z));
  }

  _setPreset(name) {
    this._look(...(PRESETS[name] || PRESETS.wake));
    if (this.mode === 'walk') this._toggleWalk();
  }

  _setHour(h, mi = 0) {
    const p = clock.local;
    clock.setTime(zonedToUtc(p.year, p.month, p.day, h, mi));
  }

  _interact(id, value) {
    const list = this.motel.interactables;
    let it = id ? list.find((i) => i.id === id) : null;
    if (!it) {
      // Nearest interactable to the camera / avatar.
      const p = this.mode === 'walk' && this.avatar ? this.avatar.position : this.camPos;
      let best = 2.2;
      for (const i of list) {
        if (!i.object) continue;
        const d = i.object.getWorldPosition(new THREE.Vector3()).distanceTo(p);
        if (d < best) {
          best = d;
          it = i;
        }
      }
    }
    if (!it) return null;
    it.toggle?.(value);
    return it.id;
  }

  _onKey(ev) {
    if (ev.repeat) return;
    switch (ev.code) {
      case 'BracketLeft': clock.setTime(clock.gameMs - 3600e3); break;
      case 'BracketRight': clock.setTime(clock.gameMs + 3600e3); break;
      case 'KeyF': this._toggleWalk(); break;
      case 'KeyG': this._interact(); break;
      case 'KeyT': this.timeRunning = !this.timeRunning; clock.paused = !this.timeRunning; break;
      case 'KeyH': this.panel.style.display = this.panel.style.display === 'none' ? '' : 'none'; break;
      default:
        if (/^Digit[1-8]$/.test(ev.code)) this._setPreset(PRESET_KEYS[+ev.code.slice(5) - 1]);
    }
  }

  _toggleWalk() {
    if (this.mode === 'fly') {
      const p = this.camPos;
      const hit = this.physics.raycast({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: -1, z: 0 }, 50);
      const gy = hit ? hit.point.y : 0.15;
      this.char = this.physics.createCharacter({ position: { x: p.x, y: gy + 0.95, z: p.z } });
      if (!this.avatar) {
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.11, 6, 16), mat('fabric', { color: 0x3a4a6b }));
        body.castShadow = true;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), mat('leather', { color: 0xb07a55, wear: 0 }));
        head.position.y = 0.95;
        head.castShadow = true;
        this.avatar = new THREE.Group();
        this.avatar.add(body, head);
      }
      this.scene.add(this.avatar);
      this.vel.set(0, 0, 0);
      this.camDist = this.firstPerson ? 0 : 2.6;
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
    const speed = input.down('sprint') ? 5.5 : 2.4;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(input.move.y).add(right.multiplyScalar(input.move.x)).multiplyScalar(speed);
    this.vel.x = damp(this.vel.x, wish.x, 0.09, step);
    this.vel.z = damp(this.vel.z, wish.z, 0.09, step);
    const grounded = c.controller.computedGrounded?.();
    this.vel.y = grounded && this.vel.y <= 0 ? -0.6 : this.vel.y - 9.81 * step;
    if (input.pressed('jump') && grounded) this.vel.y = 4.2;
    c.controller.computeColliderMovement(c.collider, { x: this.vel.x * step, y: this.vel.y * step, z: this.vel.z * step });
    const m = c.controller.computedMovement();
    const p = c.body.translation();
    c.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
  }

  update(dt, realDt) {
    if (!this.ready) return;
    const rdt = Math.min(realDt || dt, 0.1);
    this.yaw -= input.look.x * 0.0022;
    this.pitch = clamp(this.pitch - input.look.y * 0.0022, -1.45, 1.45);
    const cam = this.camera;
    if (this.mode === 'fly') {
      const speed = input.down('sprint') ? 18 : 4;
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
      const pivot = new THREE.Vector3(p.x, p.y + 0.72, p.z);
      if (this.firstPerson) {
        this.avatar.visible = false;
        cam.position.copy(pivot);
      } else {
        const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
        const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.35);
        const toi = this.physics.sphereCast(pivot, back, 0.15, 2.6, { exclude: this.char.collider });
        this.camDist = damp(this.camDist, toi != null ? Math.max(0.3, toi - 0.08) : 2.6, 0.05, rdt);
        cam.position.copy(pivot).addScaledVector(back, this.camDist).add(side);
      }
      cam.rotation.set(pitch, this.yaw, 0, 'YXZ');
      this.camPos.copy(cam.position);
    }
    const focus = this.mode === 'walk' && this.avatar ? this.avatar.position : this.camPos;
    this.sky.update(clock, this.weather, focus);
    this.motel.update(dt, clock, { camera: cam, viewer: focus, sky: this.sky, scene: this.scene, indoorLighting: true });
    this._tick = (this._tick || 0) + 1;
    if (this._tick % 10 === 1) this._renderPanel();
  }

  _renderPanel() {
    const tag = (txt, on) => el('span', { class: `dm-tag${on ? ' on' : ''}`, text: txt });
    this.panel.replaceChildren(
      el('div', { class: 'dm-title', text: t('devmotel.title') }),
      el('div', { class: 'dm-time', text: clock.format({ hour: 'numeric', minute: '2-digit' }) }),
      el('div', { class: 'dm-tags' }, [
        tag(this.mode === 'fly' ? t('devmotel.fly') : t('devmotel.walk'), true),
        tag(this.timeRunning ? t('devmotel.running') : t('devmotel.frozen'), this.timeRunning),
      ]),
      el('div', { class: 'dm-help', text: t('devmotel.help') })
    );
  }

  exit() {
    window.removeEventListener('keydown', this._keys);
    input.setPointerLock(false);
    this.motel?.dispose?.();
    this.sky?.dispose();
  }
}

runState(MotelDev);
