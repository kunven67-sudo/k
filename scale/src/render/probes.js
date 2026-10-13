// Light probes: each room's real bounce light and reflections, photographed from the actual scene.
//
// Before, every room used the same generic "room" lighting for its soft fill light and reflections.
// Real rooms don't look like that: the light depends on where the windows are, what color the floor
// and walls are, where the lamps hang. So when the world loads, the game takes a 360-degree photo from
// the middle of each room (the sky shows through its windows, its lamps are on, its wood floor bounces
// warm light) and blurs it into lighting. The room you're in uses its own photo: a glossy floor then
// reflects that room's real windows, and white walls in a wood-floored room get a little warm.
import * as THREE from 'three';

export class Probes {
  constructor(game) {
    this.game = game;
    this.list = []; // { name, pos, box, env }
    this.active = null;
    this._pmrem = null;
  }

  // spots: [{ name, at: [x, y, z], box: [x0, y0, z0, x1, y1, z1] }]
  capture(spots, { size = 128 } = {}) {
    const g = this.game;
    const r = g.view.renderer;
    const scene = g.scene;
    this._pmrem ??= new THREE.PMREMGenerator(r);
    // What the probe's photo sees: the sky through the windows, the lamps, the rooms (lit by the
    // generic room light for this first bounce). Not you, and no sun shadows (they're set up for
    // your camera, not this one), so the sun is left out of the photo.
    const old = { bg: scene.background, env: scene.environment, envI: scene.environmentIntensity, sun: g.lighting.daylight, vis: g.player.object.visible, sm: r.shadowMap.needsUpdate };
    scene.background = g.sky.skyEnv;
    scene.backgroundIntensity = 1;
    scene.environment = g.sky.roomEnv;
    scene.environmentIntensity = 0.85;
    g.lighting.daylight = 0;
    g.lighting.update(g.player.height);
    g.player.object.visible = false;
    r.shadowMap.needsUpdate = false;
    for (const s of spots) {
      const rt = this._pmrem.fromScene(scene, 0.02, 0.05, 80, { size, position: new THREE.Vector3(...s.at) });
      this.list.push({ name: s.name, pos: new THREE.Vector3(...s.at), box: new THREE.Box3(new THREE.Vector3(s.box[0], s.box[1], s.box[2]), new THREE.Vector3(s.box[3], s.box[4], s.box[5])), env: rt.texture, rt });
    }
    scene.background = old.bg;
    scene.environment = old.env;
    scene.environmentIntensity = old.envI;
    g.lighting.daylight = old.sun;
    g.player.object.visible = old.vis;
    r.shadowMap.needsUpdate = old.sm;
  }

  // The probe for the room a point is in (or null outdoors).
  at(p) {
    for (const pr of this.list) if (pr.box.containsPoint(p)) return pr;
    return null;
  }

  update(camPos) {
    this.active = this.at(camPos);
    return this.active;
  }
}
