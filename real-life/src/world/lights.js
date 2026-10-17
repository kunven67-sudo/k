// Room + street lights with a fixed pool of real point lights.
//
// three.js recompiles every shader when the number of lights changes, which stutters. So the
// scene always has POOL point lights; each frame they're handed to the nearest lights that are
// switched on (rooms in the house you're in, a few street lamps). Far lights still "exist" (the
// window glows from the street at night via emissive panes) but cost nothing.
//
//   world.lights.addRoom(room, position, { color, intensity, range })
//   world.lights.setRoom(room, on)
//   world.lights.addLamp(position, { color, intensity, range, auto: 'night' })

import * as THREE from 'three';

const POOL = 6;

export class Lights {
  constructor(world) {
    this.world = world;
    this.sources = []; // { pos, color, intensity, range, on, room?, auto? }
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 2);
      l.castShadow = false;
      world.scene.add(l);
      this.pool.push(l);
    }
    this._tmp = new THREE.Vector3();
    this.night = false;
  }

  addRoom(room, pos, { color = 0xffe2b8, intensity = 9, range = 7 } = {}) {
    const s = { pos: pos.clone(), color: new THREE.Color(color), intensity, range, on: false, room };
    room.light = s;
    this.sources.push(s);
    return s;
  }

  setRoom(room, on) {
    if (room.light) room.light.on = on;
    room.lightOn = on;
  }

  addLamp(pos, { color = 0xffc98a, intensity = 14, range = 14, auto = 'night' } = {}) {
    const s = { pos: pos.clone(), color: new THREE.Color(color), intensity, range, on: false, auto };
    this.sources.push(s);
    return s;
  }

  /** Soft daylight coming in through a window (only while the sun is up). */
  addDaylight(pos, { color = 0xfff1e0, intensity = 5, range = 6.5 } = {}) {
    const s = { pos: pos.clone(), color: new THREE.Color(color), intensity, range, on: false, auto: 'day', base: intensity };
    this.sources.push(s);
    return s;
  }

  update(viewer, isNight, daylight = 1) {
    this.night = isNight;
    for (const s of this.sources) {
      if (s.auto === 'night') s.on = isNight;
      else if (s.auto === 'day') {
        s.on = daylight > 0.05;
        s.intensity = s.base * daylight;
      }
    }
    const on = this.sources.filter((s) => s.on);
    for (const s of on) s._d = s.pos.distanceToSquared(viewer);
    on.sort((a, b) => a._d - b._d);
    for (let i = 0; i < POOL; i++) {
      const l = this.pool[i];
      const s = on[i];
      if (!s || s._d > 40 * 40) {
        l.intensity = 0;
        continue;
      }
      l.position.copy(s.pos);
      l.color.copy(s.color);
      l.distance = s.range;
      // Fade the furthest assigned light so swapping sources never pops.
      const fade = i === POOL - 1 ? 0.5 : 1;
      l.intensity = s.intensity * fade;
    }
  }
}
