// WorldState — living in Reno: the Starlite Motel, 4th St and downtown under the real sky.
//
//   engine.go('world', { newLife: true })   // the first morning (DESIGN §34)
//   engine.go('world', { continue: true })  // load the saved life and carry on where you were
// Dev: ?spawn=street|room|lot|office|wake, ?hour=19.5 (start time), ?room=23.
//
// Owns: the world (compose.js), the Player, the motel clerk, zones → audio rooms + ambience +
// bus 'zone:entered' / 'zone:left', the opening, sleeping, and the 'player' save slice.
// The life module (needs, money, rent) is optional: src/life/index.js → initLife({engine, world, player}).
import * as THREE from 'three';
import { PhysicsWorld } from '../core/physics.js';
import { input } from '../core/input.js';
import { bus } from '../core/events.js';
import { audio } from '../core/audio.js';
import { save } from '../core/save.js';
import { clock, zonedToUtc } from '../core/clock.js';
import { t } from '../core/i18n.js';
import { Rng } from '../core/rng.js';
import { createHuman, randomHumanParams } from '../character/index.js';
import { buildWorld } from '../world/compose.js';
import { Player } from '../player/index.js';
import { Clerk } from '../player/clerk.js';
import { Opening } from '../player/opening.js';
import { Sleep } from '../player/sleep.js';
import { Ambience } from '../player/ambience.js';
import { loadSound, music } from '../player/sound.js';
import { ROOM, Y0 } from '../world/motel/layout.js';
import '../player/strings.js';
import { openGameMenu, isGameMenuOpen } from '../ui/gamemenu.js';

save.registerSlice('player', {
  create: () => ({ position: null, yaw: 0, roomNumber: randomRoomNumber(), zone: null }),
});

/** Any door on the property except 9 (the weird guy) and 13 (haunted) — DESIGN §6. */
function randomRoomNumber() {
  const pool = [];
  for (let n = 1; n <= 30; n++) if (n !== 9 && n !== 13 && n !== 15 && n !== 16) pool.push(n);
  return pool[Math.floor(Math.random() * pool.length)];
}

const BED = {
  sit: { x: 205.25, y: Y0, z: -47.5 },
  yaw: Math.PI, // view convention: facing +Z, back to the bed
  lie: { x: 205.25, y: Y0 + 0.86, z: -48.5 },
  center: new THREE.Vector3(205.1, Y0 + 0.62, -48.6),
};

export class WorldState {
  constructor(engine) {
    this.engine = engine;
    this.ready = false;
  }

  async enter(params = {}) {
    const e = this.engine;
    const newLife = params.newLife === true || params.newLife === '1';
    const cont = params.continue === true || params.continue === '1';
    let loading = null;
    try {
      const L = await import('../ui/loading.js');
      loading = L.showLoading({ kind: newLife ? 'newspaper' : undefined });
      loading.setStatus?.(t('player.loading'));
    } catch {
      loading = null;
    }
    const progress = (p) => loading?.setProgress?.(p);
    loadSound();

    // ---- life ----
    let life = save.life;
    if (!life && cont) life = save.loadLife();
    if (!life && !newLife && save.hasLife()) life = save.loadLife();
    if (!life) life = save.newLife({ params: randomHumanParams(), dev: true });
    this.life = life;
    const ps = save.slice('player');
    if (!ps.roomNumber || ps.roomNumber === 9 || ps.roomNumber === 13) ps.roomNumber = randomRoomNumber();
    if (params.room) ps.roomNumber = +params.room;
    save.startAutosave?.();

    // Time: the first morning starts at 11:00 sharp; dev ?hour= overrides.
    if (newLife && !cont) {
      const p = clock.local;
      clock.setTime(zonedToUtc(p.year, p.month, p.day, 11, 0));
    }
    if (params.hour != null) {
      const p = clock.local;
      const h = +params.hour;
      clock.setTime(zonedToUtc(p.year, p.month, p.day, Math.floor(h), Math.round((h % 1) * 60)));
    }
    clock.paused = false;
    clock.speed = 1;

    // ---- world ----
    this.physics = new PhysicsWorld();
    e.physics = this.physics;
    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(62, innerWidth / Math.max(1, innerHeight), 0.05, 2400);
    this.camera = camera;
    this.world = await buildWorld(e, this.physics, { tier: e.tier, scene, onProgress: (p) => progress(p * 0.85) });
    const w = this.world;
    this.roomNumber = w.motel.setRoomNumber(ps.roomNumber);
    ps.roomNumber = this.roomNumber;

    // ---- player ----
    const charParams = life.character?.params || life.character || randomHumanParams();
    const human = createHuman(charParams, { tier: e.tier, hero: true });
    const spawnName = params.spawn || (newLife ? 'wakeFloor' : null);
    let spawn = spawnName ? this._spawn(spawnName) : null;
    if (!spawn && ps.position) spawn = { x: ps.position[0], y: ps.position[1], z: ps.position[2], yaw: ps.yaw };
    if (!spawn) spawn = this._spawn('room');
    this.player = new Player(e, w, { human, spawn, camera });
    scene.add(this.player.root);
    progress(0.92);

    // ---- clerk + extra interactables ----
    this.clerk = new Clerk({ spawn: w.spawn.clerk, desk: w.spawn.officeDesk, tier: e.tier, getPlayer: () => this.player });
    scene.add(this.clerk.root);
    this.sleep = new Sleep({
      engine: e,
      player: this.player,
      bed: BED,
      camPos: new THREE.Vector3(207.55, Y0 + 1.6, -45.8),
      camTarget: new THREE.Vector3(205.0, Y0 + 0.6, -48.7),
      interactables: w.interactables,
    });
    const bed = { id: 'bed', kind: 'bed', position: BED.center, radius: 0.85, reach: 2.2, describe: () => t('player.bed'), onInteract: () => this.sleep.begin() };
    this.extra = [this.clerk.window, bed];
    this.interactables = [...w.interactables, ...this.extra];
    this.player.interact.setList(this.interactables);

    // ---- opening ----
    if (newLife && spawnName === 'wakeFloor' && params.opening !== '0') {
      const door = w.interactables.find((i) => i.id === 'room-door');
      const doorPos = door?.object ? door.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.45, 1.3, 0)) : new THREE.Vector3(ROOM.x0 + 0.75, Y0 + 1.3, ROOM.zDoor);
      this.opening = new Opening({ engine: e, player: this.player, spawn: w.spawn.wakeFloor, doorPos, roomNumber: this.roomNumber });
    }

    // ---- sound ----
    this.ambience = new Ambience();
    this.zoneIds = new Set();
    this.zoneTimer = 0;
    this.saveTimer = 0;

    // ---- life module (optional; another agent builds it) ----
    try {
      const mod = await import('../life/index.js');
      this.lifeSys = (await mod.initLife?.({ engine: e, world: w, player: this.player, state: this })) || null;
    } catch (err) {
      if (!/Failed to fetch|Importing a module|not found|404/i.test(String(err?.message))) console.warn('[world] life module failed:', err);
      this.lifeSys = null;
    }

    this._offLock = bus.on('input:pointerlock', (locked) => {
      if (!locked && input.wantPointerLock && this.ready && !this._uiBusy()) this._openMenu();
    });

    this.bloom0 = e.bloomStrength;
    e.setView(scene, camera);
    input.setPointerLock(true);
    w.update(0, clock, { camera, viewer: this.player.position });
    this.player.update(0);
    this.ready = true;
    window.__world = this;
    progress(1);
    await loading?.close?.();
  }

  _spawn(name) {
    const s = this.world.spawn;
    const map = {
      wake: s.wakeFloor,
      wakeFloor: s.wakeFloor,
      room: { x: 205.6, y: Y0 + 0.02, z: -46.6, yaw: Math.PI * 0.85 },
      lot: s.roomDoorOutside ? { ...s.roomDoorOutside, yaw: Math.PI } : null,
      door: s.roomDoorOutside,
      office: s.officeDesk ? { ...s.officeDesk, yaw: 0 } : null,
      street: s.street,
    };
    return map[name] || s[name] || null;
  }

  fixedUpdate(step) {
    if (!this.ready) return;
    this.player.fixedUpdate(step);
  }

  update(dt) {
    if (!this.ready) return;
    const w = this.world;
    const pl = this.player;
    this._menuInput();
    for (const it of this.interactables) it.update?.(dt);
    this.opening?.update(dt);
    if (this.opening?.done) this.opening.tail(dt);
    this.sleep.update(dt);
    pl.update(dt);
    w.update(dt, clock, { camera: this.camera, viewer: pl.position });
    this.clerk.update(dt, this.camera.position);
    this.lifeSys?.update?.(dt);
    this._zones(dt);
    // Small rooms with bare tubes bloom into a white haze at the outdoor bloom strength: ease it
    // down indoors (the city's neon keeps its glow outside).
    const bloomWant = this.zone?.indoor ? 0.22 : this.bloom0;
    this.engine.bloomStrength += (bloomWant - this.engine.bloomStrength) * Math.min(1, dt * 2.5);
    this._save(dt);
  }

  // ---- in-game menu (Esc / ☰): the world keeps going, you just stand still --------------------

  /** Something else owns the keyboard/Escape right now (phone, pockets, a dialogue, a game seat…). */
  _uiBusy() {
    const pl = this.player;
    return !!(
      isGameMenuOpen() || pl.seatedAt || this.lifeSys?.phone?.isOpen || this.lifeSys?.pockets?.isOpen ||
      document.querySelector('.lf-dlg, .gx-overlay') || this.sleep?.busy || (this.opening && !this.opening.done)
    );
  }

  _menuInput() {
    // Escape is judged against last frame's state: the phone closes itself on the same keydown.
    if (input.pressed('menu') && !this._busyPrev) this._openMenu();
    this._busyPrev = this._uiBusy();
  }

  _openMenu() {
    if (isGameMenuOpen() || this._uiBusy()) return;
    const pl = this.player;
    const wasLocked = pl.locked;
    pl.locked = true;
    input.setPointerLock(false);
    openGameMenu(this.engine, {
      onClose: () => {
        pl.locked = wasLocked;
        input.setPointerLock(true);
      },
    });
  }

  _zones(dt) {
    this.zoneTimer -= dt;
    if (this.zoneTimer > 0) return;
    this.zoneTimer = 0.2;
    const p = this.player.position.clone();
    p.y += 1.0;
    const inside = this.world.zonesAt(p);
    const ids = new Set(inside.map((z) => z.id));
    for (const z of this.world.zones) {
      const was = this.zoneIds.has(z.id);
      const is = ids.has(z.id);
      if (is && !was) bus.emit('zone:entered', { zone: z });
      else if (was && !is) bus.emit('zone:left', { zone: z });
    }
    this.zoneIds = ids;
    const primary = inside[0] || null;
    if (primary?.id !== this.zone?.id) {
      this.zone = primary;
      try {
        audio.setRoom(primary?.audioRoom || 'street', 0.6);
      } catch {
        /* audio locked */
      }
    }
    const night = this.world.sky?.state?.night ?? 0;
    const tv = this.world.interactables.find((i) => i.id === 'tv');
    this.ambience.update({ zone: this.zone, night, tvOn: !!tv?.on, music: music() });
  }

  _save(dt) {
    this.saveTimer -= dt;
    if (this.saveTimer > 0 || this.sleep.busy || (this.opening && !this.opening.done)) return;
    this.saveTimer = 2;
    const ps = save.slice('player');
    if (!ps) return;
    const p = this.player.position;
    ps.position = [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
    ps.yaw = +this.player.cam.yaw.toFixed(3);
    ps.zone = this.zone?.id || null;
    ps.roomNumber = this.roomNumber;
    if (save.life) save.life.gameMs = clock.gameMs;
    save.markDirty();
  }

  onResize(wd, ht) {
    if (!this.camera) return;
    this.camera.aspect = wd / Math.max(1, ht);
    this.camera.updateProjectionMatrix();
  }

  exit() {
    const fx = this.engine.effects;
    fx.uBlur.value = 0;
    fx.uVignette.value = 0.2;
    if (this.bloom0 != null) this.engine.bloomStrength = this.bloom0;
    clock.speed = 1;
    this._offLock?.();
    input.setPointerLock(false);
    this._save(99);
    this.ambience?.dispose();
    this.lifeSys?.dispose?.();
    this.sleep?.dispose();
    this.clerk?.dispose();
    this.player?.dispose();
    this.world?.dispose();
    if (window.__world === this) window.__world = null;
  }
}

export { Rng };
