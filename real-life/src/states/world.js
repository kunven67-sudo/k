// WorldState: living your life in Maple Hollow.
//
//   engine.go('world', { lifeId })      // continue a saved life
//   engine.go('world', { dev: 1 })      // dev: random family, spawn in your bedroom
// Dev URL params: spawn=bed|front|street|park|plaza, hour=7.5, cam=x,y,z,yaw,pitch (fixed camera)

import * as THREE from 'three';
import { input } from '../core/input.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { bus } from '../core/events.js';
import { Rng } from '../core/rng.js';
import { World } from '../world/world.js';
import { Player } from '../player/player.js';
import { Hud } from '../ui/hud.js';
import { randomLook, childLook } from '../people/look.js';
import { FAMILY_LOT, CURB } from '../world/layout.js';

export class WorldState {
  constructor(engine) {
    this.engine = engine;
  }

  async enter(params = {}) {
    const e = this.engine;
    const life = save.life || devLife(params);
    this.life = life;
    if (params.hour) clock.reset(clock.dayIndex, +params.hour * 60);
    const world = new World(e);
    this.world = world;
    e.physics = world.physics;
    await world.build({ family: life.family.house, season: clock.season }, (p, msg) => e.setLoading?.(p, msg));
    const spawnName = params.spawn || 'bed';
    const sp = spawnPoint(world, spawnName);
    this.player = new Player(e, world, { look: life.character.look, age: clock.age || 8, spawn: sp.pos, yaw: sp.yaw, name: life.character.name });
    this.hud = new Hud(e.uiRoot);
    this.camOverride = params.cam ? params.cam.split(',').map(Number) : null;
    e.setView(world.scene, this.player.camera);
    input.setPointerLock?.(true);
    this._offs = [bus.on('door:locked', ({ door }) => this.hud.toast(`${door.name} is locked.`))];
  }

  fixedUpdate(step) {
    this.player?.fixedUpdate(step);
  }

  update(dt) {
    const p = this.player;
    if (!p) return;
    p.update(dt);
    if (this.camOverride) {
      const [x, y, z, yaw, pitch] = this.camOverride;
      p.camera.position.set(x, y, z);
      p.camera.quaternion.setFromEuler(new THREE.Euler(pitch || 0, yaw || 0, 0, 'YXZ'));
    }
    this.world.update(dt, { viewer: p.position, camera: p.camera });
    const f = p.focus;
    let hint = null;
    if (f) hint = typeof f.it.label === 'function' ? f.it.label(p) : f.it.label;
    this.hud.setHint(hint);
    this.hud.setClock(`${clock.weekdayName.slice(0, 3)} ${clock.timeText()}`);
    this.hud.update(dt);
  }

  exit() {
    for (const off of this._offs || []) off();
    this.hud?.dispose();
    this.player?.dispose();
    this.world?.dispose();
  }
}

function spawnPoint(world, name) {
  const h = world.home;
  if (name === 'front') return { pos: h.spawn.frontDoor.clone().setZ(h.spawn.frontDoor.z + 4).setY(CURB), yaw: 0 };
  if (name === 'street') return { pos: new THREE.Vector3(FAMILY_LOT.x0 + 2, CURB, 6.2), yaw: Math.PI };
  if (name === 'park') return { pos: new THREE.Vector3(-88, CURB, 0), yaw: Math.PI / 2 };
  if (name === 'plaza') return { pos: new THREE.Vector3(84, CURB, -20), yaw: -Math.PI / 2 };
  if (name === 'living') return { pos: h.spawn.living.clone(), yaw: 0 };
  return { pos: h.spawn.bed.clone(), yaw: Math.PI };
}

/** Dev life: a random family so ?state=world works without the menus. */
function devLife(params) {
  const rng = new Rng(+(params.seed || 42));
  const mom = randomLook(rng, { sex: 'f', age: 36 });
  const dad = randomLook(rng, { sex: 'm', age: 38 });
  const sex = params.sex || 'm';
  const look = childLook(rng, mom, dad, sex);
  clock.birthYear = new Date().getFullYear() - 8;
  if (!params.hour) clock.reset(8 * 16, 8 * 60);
  else clock.reset(8 * 16, +params.hour * 60);
  return {
    character: { name: 'Alex', look, sex },
    family: { mom: { look: mom, name: 'Karen' }, dad: { look: dad, name: 'Mike' }, house: { wealth: params.wealth || 'middle', seed: 7, kidSex: sex, sibling: params.sibling || 'none' } },
  };
}
