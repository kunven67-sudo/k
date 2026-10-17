// The world you live in: physics, the real Ohio sky, Maple Hollow (town.js) with the family
// house, stores, lights, doors, interactables, weather + seasons.
//
//   const world = new World(engine)
//   await world.build({ family, season }, onProgress)
//   world.update(dt, { viewer })
//   world.roomAt(point) -> room | null   (rooms of the house + stores)
//   world.surfaceAt(point) -> 'grass' | 'carpet' | 'wood' | 'tile' | 'concrete' | 'asphalt' ...

import * as THREE from 'three';
import { PhysicsWorld } from '../core/physics.js';
import { clock } from '../core/clock.js';
import { createSky } from '../gfx/sky.js';
import { setMaxAnisotropy } from '../gfx/textures.js';
import { assets } from '../gfx/assets.js';
import { preloadPeople } from '../people/person.js';
import { Interactables } from './interact.js';
import { Lights } from './lights.js';
import { Doors } from './doors.js';
import { buildTown, townAssets } from './town.js';
import { vegetationTick } from '../gfx/vegetation.js';
import { WINDOW_MATS } from './house.js';
import { wallClock } from './decor.js';
import { audio } from '../core/audio.js';
import { CURB, MAPLE, ELM, CULDESAC, SIDEWALK, PLAZA } from './layout.js';

// Every model the town + house use (preloaded before building so the builder never waits).
const HOUSE_ASSETS = [
  ['home', 'Bed_Single'], ['home', 'Bed_King'], ['home', 'NightStand_1'], ['home', 'NightStand_2'], ['home', 'Drawer_1'], ['home', 'Drawer_2'], ['home', 'Drawer_4'],
  ['home', 'Carpet_Round'], ['home', 'Carpet_2'], ['home', 'Shelf_Small1'], ['home', 'Shelf_1'], ['home', 'Light_Ceiling5'], ['home', 'Light_Ceiling4'], ['home', 'Light_Ceiling3'],
  ['home', 'Light_CeilingSingle'], ['home', 'Light_Chandelier'], ['home', 'Light_Desk'], ['home', 'Light_Floor1'], ['home', 'Bathroom_Bathtub'], ['home', 'Bathroom_Toilet'],
  ['home', 'Bathroom_Sink'], ['home', 'Bathroom_Mirror1'], ['home', 'Bathroom_Towel'], ['home', 'Bathroom_ToiletPaper'], ['home', 'Bathroom_WashingMachine'], ['home', 'Bookshelf'],
  ['home', 'Couch_Small1'], ['home', 'Couch_Small2'], ['home', 'Couch_Medium1'], ['home', 'Couch_Large1'], ['home', 'Houseplant_8'], ['home', 'Fireplace'], ['home', 'Curtains_Double'],
  ['home', 'Kitchen_2Drawers'], ['home', 'Kitchen_3Drawers'], ['home', 'Kitchen_Cabinet1'], ['home', 'Kitchen_Cabinet2'], ['home', 'Kitchen_CabinetSmall'], ['home', 'Kitchen_Sink'],
  ['home', 'Kitchen_Oven'], ['home', 'Kitchen_Fridge'], ['home', 'Table_RoundLarge'], ['home', 'Chair_2'], ['home', 'Trashcan_Small1'], ['home', 'Trashcan_Green'],
  ['furniture', 'desk'], ['furniture', 'chairDesk'], ['furniture', 'lampRoundTable'], ['furniture', 'bear'], ['furniture', 'books'], ['furniture', 'televisionModern'],
  ['furniture', 'televisionVintage'], ['furniture', 'cabinetTelevision'], ['furniture', 'computerScreen'], ['furniture', 'computerKeyboard'], ['furniture', 'laptop'],
  ['furniture', 'cardboardBoxClosed'], ['furniture', 'tableCoffee'], ['furniture', 'rugDoormat'], ['furniture', 'kitchenMicrowave'], ['furniture', 'toaster'],
  ['furniture', 'kitchenCoffeeMachine'], ['furniture', 'radio'],
  // Lived-in clutter.
  ['furniture', 'pillow'], ['furniture', 'cardboardBoxOpen'], ['furniture', 'trashcan'], ['furniture', 'rugRounded'], ['furniture', 'rugRectangle'],
  ['furniture', 'speakerSmall'], ['furniture', 'coatRackStanding'],
  ['home', 'Trashcan_Small2'], ['home', 'Bathroom_ToiletPaperPile'], ['home', 'Houseplant_3'], ['home', 'Houseplant_4'], ['home', 'NightStand_3'],
  ['food', 'cup'], ['food', 'glass'], ['food', 'mug'], ['food', 'bowl'], ['food', 'apple'], ['food', 'orange'], ['food', 'banana'], ['food', 'plate-dinner'],
  ['food', 'plate'], ['food', 'cutting-board'], ['food', 'knife-block'], ['food', 'pan'],
];

const _warm = new THREE.Color();
const _floor = new THREE.Color();

export class World {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.physics = new PhysicsWorld();
    this.interact = new Interactables();
    this.lights = new Lights(this);
    this.doors = new Doors(this);
    this.weather = { cloudCover: 0.25, rain: 0, fog: 0 };
    this.rooms = [];
    this.season = null;
    this.ready = false;
    this._viewer = new THREE.Vector3();
  }

  async build({ family, season = clock.season }, onProgress = () => {}) {
    const e = this.engine;
    try {
      setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    } catch {
      /* no anisotropy */
    }
    onProgress(0.02, 'Waking up the sky');
    this.sky = createSky(this.scene, e.renderer, { tier: e.tier });
    onProgress(0.08, 'Loading people');
    await preloadPeople((p) => onProgress(0.08 + p * 0.3, 'Loading people'));
    onProgress(0.4, 'Loading furniture');
    await assets.preload([...HOUSE_ASSETS, ...townAssets()], (p) => onProgress(0.4 + p * 0.3, 'Loading the neighborhood'));
    onProgress(0.72, 'Building Maple Hollow');
    await new Promise((r) => setTimeout(r, 0));
    this.season = season;
    this.town = buildTown(this, { family, season, seed: 1234 });
    const home = this.town.home;
    this.home = home;
    this.rooms.push(...home.rooms);
    for (const d of home.doors) d.ref = this.doors.add(d);
    for (const r of home.rooms) if (r.lightAt) this.lights.addRoom(r, r.lightAt, { intensity: r.id === 'garage' ? 7 : 8 });
    // Daylight through each window, a metre into the room it belongs to.
    for (const w of home.windows) {
      for (const r of home.rooms) {
        const grown = r.box.clone().expandByScalar(0.35);
        if (!grown.containsPoint(w.center)) continue;
        const c = r.box.getCenter(new THREE.Vector3());
        const into = c.clone().sub(w.center).setY(0).normalize();
        const at = w.center.clone().addScaledVector(into, 1.1);
        at.y = Math.min(w.center.y + 0.2, r.box.max.y - 0.4);
        this.lights.addDaylight(at, { intensity: 3 + w.w * w.h * 1.6, range: 7 });
        break;
      }
    }
    this.shellWindows = this.town.houses.filter((h) => !h.family).map((h) => h.house.windows);
    // Light switches toggle their room's ceiling light.
    for (const sw of home.switches) {
      const room = sw.room;
      this.interact.add({
        kind: 'switch',
        priority: 0.3,
        box: new THREE.Box3().setFromCenterAndSize(sw.pos, new THREE.Vector3(0.16, 0.2, 0.16)),
        label: () => (room.lightOn ? 'Turn off the light' : 'Turn on the light'),
        use: () => {
          this.lights.setRoom(room, !room.lightOn);
          sw.toggle.rotation.x = room.lightOn ? -0.35 : 0.35;
          audio.play?.('light.switch', { position: sw.pos });
        },
      });
      sw.toggle.rotation.x = 0.35;
    }
    if (home.clockSpot) this.wallClock = wallClock(this, home.clockSpot.x, home.clockSpot.y, home.clockSpot.z, home.clockSpot.yaw, clock);
    onProgress(0.95, 'Almost there');
    this.ready = true;
  }

  /** The room (house or store) containing p, if any. */
  roomAt(p) {
    for (const r of this.rooms) if (r.box.containsPoint(p)) return r;
    return null;
  }

  isIndoors(p) {
    return !!this.roomAt(p);
  }

  surfaceAt(p) {
    const r = this.roomAt(p);
    if (r) return r.surface || 'carpet';
    // Roads, sidewalks, the plaza lot, grass.
    if (p.y < CURB - 0.05) return 'asphalt';
    if (Math.abs(p.z) < MAPLE.half && p.x > CULDESAC.x - CULDESAC.r && p.x < ELM.x) return 'asphalt';
    if (Math.abs(p.x - ELM.x) < ELM.half) return 'asphalt';
    if ((p.z > SIDEWALK.mapleS.z0 && p.z < SIDEWALK.mapleS.z1) || (p.z > SIDEWALK.mapleN.z0 && p.z < SIDEWALK.mapleN.z1)) return 'concrete';
    if ((p.x > SIDEWALK.elmW.x0 && p.x < SIDEWALK.elmW.x1) || (p.x > SIDEWALK.elmE.x0 && p.x < SIDEWALK.elmE.x1)) return 'concrete';
    if (p.x > PLAZA.x0 && p.x < PLAZA.x1 && p.z > PLAZA.z0 && p.z < PLAZA.z1) return 'asphalt';
    for (const r of this.paved || []) if (p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) return r.s === 'building' ? 'concrete' : r.s;
    return 'grass';
  }

  setSeason(season) {
    if (season === this.season) return;
    this.season = season;
    this.town?.plantTrees(season);
  }

  update(dt, { viewer, camera } = {}) {
    vegetationTick(performance.now() / 1000);
    if (!this.ready) return;
    if (viewer) this._viewer.copy(viewer);
    this.sky.update(clock, this.weather, this._viewer);
    const S = this.sky.state;
    const night = S.lightsOn;
    const cloudDim = 1 - this.weather.cloudCover * 0.45 - this.weather.rain * 0.3;
    this.lights.update(this._viewer, night, S.daylight * cloudDim);
    // Inside, light bounces off warm walls instead of coming from a blue sky dome. Stores are
    // lit by rows of cool-white panels, day and night.
    const inside = this.roomAt(this._viewer);
    if (inside?.lighting === 'store' && this.sky.hemi) {
      const h = this.sky.hemi;
      h.color.setRGB(1.0, 0.99, 0.97);
      h.groundColor.setRGB(0.7, 0.7, 0.7);
      h.intensity = 1.25;
      this._inK = 0;
    }
    this._inK = THREE.MathUtils.lerp(this._inK || 0, inside && inside.lighting !== 'store' ? 1 : 0, Math.min(1, dt * 4));
    if (this._inK > 0.01 && this.sky.hemi && inside?.lighting !== 'store') {
      const h = this.sky.hemi;
      const k = this._inK;
      _warm.setRGB(1.0, 0.94, 0.86);
      _floor.setRGB(0.62, 0.54, 0.46);
      h.color.lerp(_warm, k * 0.85);
      h.groundColor.lerp(_floor, k * 0.85);
      h.intensity = THREE.MathUtils.lerp(h.intensity, 0.35 + S.daylight * 0.75 * cloudDim, k);
    }
    // Ceilings catch the light bouncing up off the floor.
    if (this.home?.ceilingMat) {
      const lampOn = inside && inside.lightOn ? 0.22 : 0;
      this.home.ceilingMat.emissiveIntensity = (0.04 + S.daylight * 0.16 * cloudDim + lampOn) * this._inK;
    }
    this.wallClock?.update();
    this.town.stores?.update(dt, this._viewer, clock);
    this.doors.update(dt);
    // Streetlight bulbs + neighbours' windows glow at night.
    this.town.lampMat.emissiveIntensity = night ? 3 : 0;
    for (const m of this.town.lotPools || []) m.visible = night;
    const winMat = night ? WINDOW_MATS.night : WINDOW_MATS.day;
    for (const w of this.shellWindows) if (w.material !== winMat) w.material = winMat;
    if (clock.season !== this.season) this.setSeason(clock.season);
    // The flag waves.
    const flag = this.flag;
    if (flag) {
      const pos = flag.geometry.attributes.position;
      if (!flag.userData.base) flag.userData.base = Float32Array.from(pos.array);
      const b = flag.userData.base;
      const t = performance.now() / 1000;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i * 3];
        pos.setZ(i, Math.sin(x * 3 + t * 4) * 0.08 * (x + 0.95));
      }
      pos.needsUpdate = true;
    }
    void camera;
  }

  dispose() {
    // The engine disposes the physics world it was handed (engine.physics).
    this.sky?.dispose?.();
  }
}
