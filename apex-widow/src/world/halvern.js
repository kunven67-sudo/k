// NEW HALVERN: the VOSS tower (you start on floor 48) and the city around it share one world in metres.
// Floors are built on demand, the city streams detail around you, everything collides by size class.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CollisionWorld, DynBoxes } from '../core/collide.js';
import { Mats, SOLID } from './kit.js';
import { buildFloor, buildTowerCore, PLAYABLE, elev, floorH, HALF, FLOOR_NAMES, ROOF } from './tower.js';
import './floors.js';
import { buildFacade, TowerGlass, buildRoof, makeVossSign, makeHelipad, makeHelicopter } from './towerOutside.js';
import { Elevators } from './elevator.js';
import { LightPool } from './lights.js';
import { Sky } from './sky.js';
import { FACADE } from './facade.js';
import { placeLabels, makeNote, makeVial, Screen, makeBoard, BOARD_48 } from './props.js';
import { City } from './city.js';
import { Creatures } from '../life/creatures.js';
import { Humans } from '../life/humans.js';

const _v = new THREE.Vector3();

export class Halvern {
  constructor(game) {
    this.game = game; this.id = 'halvern'; this.name = 'New Halvern';
    this.unit = 1; this.gravity = new THREE.Vector3(0, -9.81, 0); this.killY = -80;
    this.scene = new THREE.Scene();
    this.collision = new CollisionWorld();
    this.dyn = new DynBoxes(); this.collision.analytic.push(this.dyn);
    this.view = { minFar: 0, maxFar: 30000 };
    this.floors = {};
    this.items = [];      // notes + vials you can pick up
    this.screens = [];
    this.coldZones = [];
    this.clock = 23.2;    // game hours (1 real minute = 1 game hour); a night in late October
    this.lockdown = 0;
  }

  async build() {
    const G = this.game, S = this.scene;
    const hud = G.hud;
    hud.loading('Building the VOSS tower', 0.15);
    this.mats = new Mats(G.renderer); await this.mats.load();
    this.sky = new Sky(12000); S.add(this.sky.mesh);
    this.hemi = new THREE.HemisphereLight(0x9fb4d8, 0x2a2420, 0.25); S.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x9fb4ff, 0.35); this.moon.position.set(300, 600, -400); S.add(this.moon); S.add(this.moon.target);
    // environment maps: a neutral office room for the interiors, the night sky outside
    const pm = new THREE.PMREMGenerator(G.renderer.r);
    this.envIn = pm.fromScene(new RoomEnvironment(), 0.03).texture;
    const skyScene = new THREE.Scene(); const sky2 = new Sky(100); skyScene.add(sky2.mesh); sky2.setTime(this.clock);
    this.envOut = pm.fromScene(skyScene, 0, 1, 1000).texture; this.pm = pm; this.skyScene = skyScene; this.sky2 = sky2;
    S.environment = this.envIn; S.environmentIntensity = 0.55;
    // tower core (stairs, shafts) + facade + roof
    hud.loading('Pouring the concrete', 0.25);
    const core = await buildTowerCore(this.mats, S);
    S.add(core.group); this.core = core;
    this.addSolids(core.batch, 'core');
    placeLabels(core.ctx.labels, core.group);
    this.coreLights = core.ctx.coreLights;
    this.facade = buildFacade(S);
    this.glass = new TowerGlass(S); this.collision.analytic.push(this.glass);
    const rctx = { lights: [], decals: [], signs: [] };
    hud.loading('Roof, helipad, the VOSS sign', 0.35);
    const roof = await buildRoof(this.mats, S, rctx); this.addSolids(roof.batch, 'roof');
    for (const d of rctx.decals) { const m = makeHelipad(d.s); m.position.set(d.x, d.y, d.z); S.add(m); }
    for (const sg of rctx.signs) { const m = makeVossSign(); m.position.set(sg.x, sg.y, sg.z); m.rotation.y = sg.rot; S.add(m); }
    this.heli = makeHelicopter(); this.heli.position.set(0, elev(ROOF) + 0.99, -13.5); this.heli.rotation.y = 0.4; S.add(this.heli);
    this.roofLights = rctx.lights;
    // elevators
    this.elev = new Elevators(this);
    await this.elev.build(S, this.mats, this.dyn);
    // the start floor right away, the others while the intro plays
    hud.loading('Floor 48: Specimen Lab', 0.5);
    await this.buildFloorN(48);
    // city
    hud.loading('New Halvern', 0.7);
    this.city = new City(this);
    await this.city.build();
    // lights
    this.pool = new LightPool(S, G.renderer.q.lights + 2, { shadowSize: G.renderer.q.shadow });
    this.refreshFixtures();
    this.creatures = new Creatures(this);
    this.humans = new Humans(this);
    await this.humans.load();
    for (const n of Object.keys(this.floors)) this.spawnFloorLife(+n);
    hud.loading('Done', 1);
  }

  addSolids(batch, tag) {
    const layers = [];
    for (const cls of ['STRUCT', 'FURN', 'PROP', 'SMALL']) {
      const g = batch.solidGeo(cls); if (!g) continue;
      const L = this.collision.addStatic(g, { maxSize: SOLID[cls], tag: tag + ':' + cls });
      if (L) layers.push(L);
    }
    return layers;
  }

  async buildFloorN(n) {
    if (this.floors[n]) return this.floors[n];
    const F = await buildFloor(n, this.mats, this.scene);
    this.scene.add(F.group);
    F.layers = this.addSolids(F.batch, 'f' + n);
    F.batch = null; // free the source geometry lists
    placeLabels(F.ctx.labels, F.group);
    this.glass.addFloor(n, F.ctx.panes);
    // props
    for (const nt of F.ctx.notes) { const m = makeNote(); m.position.set(nt.x, nt.y + 0.002, nt.z); m.rotation.y = Math.random() * 0.4 - 0.2; F.group.add(m); this.items.push({ kind: 'note', id: nt.id, mesh: m, pos: m.position.clone(), taken: false, floor: n }); }
    for (const v of F.ctx.vials) { const m = makeVial(v.kind); m.position.set(v.x, v.y, v.z); F.group.add(m); this.items.push({ kind: 'vial', vial: v.kind, mesh: m, pos: m.position.clone(), taken: false, floor: n }); }
    for (const sc of F.ctx.screens) { const s = new Screen(sc.kind, sc.w, sc.h); s.mesh.position.set(sc.x, sc.y, sc.z); s.mesh.rotation.y = sc.rot; F.group.add(s.mesh); this.screens.push(s); }
    for (const b of F.ctx.boards) { const m = makeBoard(b.w, b.h, b.lines || BOARD_48); m.position.set(b.x, b.y, b.z); m.rotation.y = b.rot || 0; F.group.add(m); }
    for (const z of F.ctx.zones) this.coldZones.push(z);
    this.floors[n] = F;
    if (this.pool) this.refreshFixtures();
    return F;
  }
  async buildRestOfTower() {
    for (const n of PLAYABLE) {
      if (this.floors[n]) continue;
      await this.buildFloorN(n);
      this.spawnFloorLife(n);
      await new Promise(r => setTimeout(r, 30));
    }
  }
  spawnFloorLife(n) {
    const F = this.floors[n]; if (!F || F.lifeSpawned) return; F.lifeSpawned = true;
    for (const sp of F.ctx.spawns) this.creatures.spawnGroup(sp);
    for (const h of F.ctx.humans) this.humans.spawn({ ...h, floor: n });
  }
  refreshFixtures() {
    const list = [...this.coreLights, ...this.roofLights];
    for (const k in this.floors) list.push(...this.floors[k].ctx.lights);
    for (const c of this.elev.cars) list.push(c.light);
    if (this.city) list.push(...this.city.fixtures);
    this.pool.setFixtures(list);
    // elevator car lights must keep following the cars (setFixtures copies points)
    this.carFix = this.pool.fixtures.slice(this.pool.fixtures.length - (this.city ? this.city.fixtures.length : 0) - this.elev.cars.length, this.pool.fixtures.length - (this.city ? this.city.fixtures.length : 0));
  }

  // which floor is this point on (null = outside the tower / in the core between floors)
  floorAt(p) {
    if (Math.abs(p.x) > HALF + 0.5 || Math.abs(p.z) > HALF + 0.5) return null;
    for (const n of [...PLAYABLE, ROOF]) { const y0 = elev(n); if (p.y >= y0 - 0.35 && p.y < y0 + (n === ROOF ? 30 : floorH(n) - 0.3)) return n; }
    return null;
  }
  inside(p) { return Math.abs(p.x) < HALF && Math.abs(p.z) < HALF && p.y > -2 && p.y < elev(ROOF) - 0.3; }

  enter(opts = {}) {
    const G = this.game, p = G.player;
    if (opts.start) {
      const st = this.floors[48].ctx.start;
      p.pos.copy(st.pos); p.up.copy(st.up); p.fwd.copy(st.fwd); p.mode = 'ground';
      this.buildRestOfTower();
    } else if (opts.lair) {
      p.pos.fromArray(opts.lair.pos); p.up.fromArray(opts.lair.up); p.mode = 'ground';
      this.buildRestOfTower();
    }
    G.cam.target.copy(p.pos);
  }

  update(dt, dtReal) {
    const G = this.game, p = G.player;
    this.clock = (this.clock + dtReal / 60) % 24;
    this.sky.setTime(this.clock); this.sky.u.uTime.value += dtReal;
    const day = this.sky.dayAmount;
    FACADE.night.value = 1 - day; FACADE.time.value += dtReal; FACADE.lockdown.value = this.lockdown > 0 ? 1 : 0;
    this.moon.intensity = 0.15 + day * 2.6; this.moon.color.setHex(day > 0.3 ? 0xfff2e0 : 0x9fb4ff);
    this.moon.position.copy(this.sky.u.uSun.value).multiplyScalar(day > 0.05 ? 800 : -800);
    this.hemi.intensity = 0.12 + day * 0.6;
    this.elev.update(dt);
    // anything inside a moving car rides with it (the air moves with the car too)
    if (p) {
      const car = this.elev.carAt(p.pos);
      if (car && car.dy) { p.pos.y += car.dy; if (p.rope) p.rope.anchor.y += car.dy; }
    }
    if (this.carFix) this.elev.cars.forEach((c, i) => this.carFix[i] && this.carFix[i].p.copy(c.light.p));
    // visibility: only the floors near the camera when you're inside the tower
    const cam = G.camera.position;
    const camIn = this.inside(cam) || (Math.abs(cam.x) < HALF + 1 && Math.abs(cam.z) < HALF + 1 && cam.y < elev(ROOF));
    for (const k in this.floors) {
      const F = this.floors[k], y0 = elev(+k);
      F.group.visible = !camIn || (cam.y > y0 - 6 && cam.y < y0 + floorH(+k) + 6);
    }
    this.facade.visible = !this.inside(cam) || true;
    // inside = office env, outside = sky env
    const inT = this.inside(cam);
    this.scene.environment = inT ? this.envIn : this.envOut;
    this.scene.environmentIntensity = inT ? 0.55 : 0.4 + day * 0.6;
    if (p) {
      const size = p.s;
      this.pool.update(dt, cam, p.pos, size);
    }
    for (const s of this.screens) s.update(dtReal, this.screenInfo());
    // spinning helicopter rotor only when it flies
    if (this.heli.userData.flying) { this.heli.userData.rotor.rotation.y += dt * 30; this.heli.userData.tail.rotation.x += dt * 50; }
    this.city.update(dt, dtReal);
    this.creatures.update(dt);
    this.humans.update(dt);
    // pickups
    if (p) for (const it of this.items) {
      if (it.taken) continue;
      if (it.mesh.visible && it.kind === 'vial') it.mesh.rotation.y += dt;
    }
  }
  screenInfo() {
    const p = this.game.player; if (!p) return {};
    const mm = p.sizeM * 1000;
    return { size: mm < 100 ? mm.toFixed(1) + ' mm' : (p.sizeM).toFixed(2) + ' m', mass: (p.mass * 1000).toFixed(p.mass < 0.01 ? 3 : 1) + ' g', status: this.game.story && this.game.story.flags.escaped ? 'SPECIMEN LOOSE' : 'CONTAINED', hr: this.game.story && this.game.story.flags.escaped ? 3.2 : 1.1 };
  }
  // nearest pickup the player can grab
  nearItem(pos, reach) {
    let best = null, bd = reach;
    for (const it of this.items) { if (it.taken) continue; const d = it.pos.distanceTo(pos); if (d < bd) { bd = d; best = it; } }
    return best;
  }
  take(it) { it.taken = true; it.mesh.visible = false; }
  exit() {}
  dispose() {
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.pool && this.pool.dispose();
  }
}
