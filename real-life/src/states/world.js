// WorldState: living your life in Maple Hollow.
//
//   engine.go('world')                  // the current life (save.life) — menus load/create it
//   ?state=world                        // dev: no life loaded -> a random family, you're 8
// Dev URL params: spawn=bed|front|street|park|plaza|living, hour=7.5, wealth=poor|working|middle|rich|veryrich,
//                 sibling=none|older|younger, sex=m|f, cash=20, cam=x,y,z,yaw,pitch (fixed camera)

import * as THREE from 'three';
import { input } from '../core/input.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { bus } from '../core/events.js';
import { Rng } from '../core/rng.js';
import { World } from '../world/world.js';
import { Player } from '../player/player.js';
import { Hud } from '../ui/hud.js';
import { closeTopPanel, panelOpen } from '../ui/panel.js';
import { randomLook, childLook } from '../people/look.js';
import { FAMILY_LOT, CURB } from '../world/layout.js';
import { Life } from '../life/index.js';
import { me } from '../life/me.js';
import { People } from '../people/index.js';
import { Chores } from '../life/chores.js';
import { Talk } from '../talk/index.js';
import { Rules } from '../life/rules.js';
import { LemonadeStand } from '../life/lemonade.js';
import { School } from '../life/school.js';
import { Phone } from '../ui/phone.js';
import { Radio } from '../life/radio.js';
import { openPause } from '../ui/pause.js';

const STATES_HAVE_MENU = true;

export class WorldState {
  constructor(engine) {
    this.engine = engine;
  }

  async enter(params = {}) {
    const e = this.engine;
    if (!save.life) devLife(params);
    const life = save.life;
    this.lifeData = life;
    if (params.hour) clock.reset(clock.dayIndex, +params.hour * 60);
    const world = new World(e);
    this.world = world;
    e.physics = world.physics;
    await world.build({ family: life.family.house, season: clock.season }, (p, msg) => e.setLoading?.(p, msg));
    const sp = spawnPoint(world, params.spawn || life.slices.player?.spawn || 'bed');
    this.player = new Player(e, world, { look: life.character.look, age: Math.max(1, clock.age), spawn: sp.pos, yaw: sp.yaw, name: life.character.name });
    this.hud = new Hud(e.uiRoot);
    this.life = new Life({ engine: e, world, player: this.player, hud: this.hud });
    this.people = new People({ world, player: this.player, hud: this.hud, life: this.life });
    this.life.people = this.people;
    this.life.chores = new Chores(this.life);
    this.life.rules = new Rules(this.life);
    this.life.lemonade = new LemonadeStand(this.life);
    this.life.school = new School(this.life);
    this.talk = new Talk({ world, player: this.player, hud: this.hud, life: this.life, people: this.people });
    this.phone = new Phone({ engine: e, world, player: this.player, hud: this.hud, life: this.life, people: this.people, talk: this.talk });
    this.life.phone = this.phone;
    this.radio = new Radio(this.life);
    this.camOverride = params.cam ? params.cam.split(',').map(Number) : null;
    e.setView(world.scene, this.player.camera);
    input.setPointerLock?.(true);
    this._offs = [
      bus.on('door:locked', ({ door }) => this.hud.toast(`${door.name} is locked.`)),
      bus.on('me:cash', ({ amount, why }) => amount > 0 && why && why !== 'piggy' && this.hud.toast(`+$${amount.toFixed(2)}`)),
    ];
  }

  update(dt) {
    const p = this.player;
    if (!p) return;
    if (input.pressed('menu')) {
      if (panelOpen()) closeTopPanel();
      else if (this.phone.isOpen) this.phone.close();
      else openPause({ engine: this.engine, onQuit: () => this.engine.go(STATES_HAVE_MENU ? 'menu' : 'world') });
    }
    if (input.pressed('phone') && !panelOpen()) this.phone.toggle();
    this.phone.update(dt);
    this.radio.update(dt);
    this.life.update(dt);
    p.update(dt);
    this.people.update(dt);
    this.talk.update(dt);
    this.life.rules.update(dt);
    this.life.lemonade.update(dt);
    if (this.camOverride) {
      const [x, y, z, yaw, pitch] = this.camOverride;
      p.camera.position.set(x, y, z);
      p.camera.quaternion.setFromEuler(new THREE.Euler(pitch || 0, yaw || 0, 0, 'YXZ'));
    }
    this.world.update(dt, { viewer: p.position, camera: p.camera });
    const f = p.focus;
    let hint = null;
    if (f) hint = typeof f.it.label === 'function' ? f.it.label(p) : f.it.label;
    this.hud.setHint(hint, 'E', hint && f.it.useAlt ? f.it.alt : null);
    this.hud.setClock(`${clock.weekdayName.slice(0, 3)} ${clock.timeText()}  ·  $${me.cash.toFixed(2)}`);
    this.hud.update(dt);
  }

  exit() {
    for (const off of this._offs || []) off();
    this.radio?.dispose();
    this.phone?.dispose();
    this.talk?.dispose();
    this.life?.chores?.dispose();
    this.life?.rules?.dispose();
    this.life?.lemonade?.dispose();
    this.life?.school?.dispose();
    this.people?.dispose();
    this.life?.dispose();
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
  if (name === 'plaza') return { pos: new THREE.Vector3(110, CURB, -58), yaw: -Math.PI / 2 };
  if (name === 'living') return { pos: h.spawn.living.clone(), yaw: 0 };
  return { pos: h.spawn.bed.clone(), yaw: Math.PI };
}

/** Dev life: a random family so ?state=world works without the menus (a real save slot). */
function devLife(params) {
  const rng = new Rng(+(params.seed || 42));
  const mom = randomLook(rng, { sex: 'f', age: 36 });
  const dad = randomLook(rng, { sex: 'm', age: 38 });
  const sex = params.sex || 'm';
  const look = childLook(rng, mom, dad, sex);
  const wealth = params.wealth || 'middle';
  save.newLife({
    character: { name: sex === 'f' ? 'Emma' : 'Alex', look, sex },
    family: { mom: { look: mom, name: 'Karen' }, dad: { look: dad, name: 'Mike' }, house: { wealth, seed: 7, kidSex: sex, sibling: params.sibling || 'none' } },
    birth: { year: new Date().getFullYear() - 8, season: 0, weekdayOffset: 6 },
  });
  save.life.opening = 'done';
  clock.reset(8 * 4, (params.hour ? +params.hour : 8) * 60);
  me.data.piggy = { poor: 4, working: 12, middle: 25, rich: 60, veryrich: 120 }[wealth] ?? 25;
  me.data.cash = params.cash ? +params.cash : 0;
}
