// World composition: the sky, the downtown Reno slice and the Starlite Motel in one scene.
//
//   const world = await buildWorld(engine, physics, { tier, onProgress });
//   scene.add(world.group);             // (the sky adds itself to the scene passed in)
//   world.update(dt, clock, { camera, viewer, weather })   every frame
//
// Returns { scene, group, sky, reno, motel, zones, interactables, spawn, weather, update, dispose }.
//
// Call order follows the motel builder's integration notes: sky first (it owns the lights the
// other builders read), then the city, then the motel. Each frame the sky updates first, then the
// city (which sets the shared sign uniforms), then the motel with citySigns:true so it does not
// overwrite them, and indoorLighting:true so the sky's fill is dimmed inside the room / office.
import * as THREE from 'three';
import { createSky } from '../gfx/sky.js';
import { setMaxAnisotropy } from '../gfx/textures.js';
import { buildReno } from './reno/index.js';
import { buildStarlite } from './motel/index.js';

export async function buildWorld(engine, physics, { tier, scene, onProgress } = {}) {
  tier = tier || engine.tier;
  scene = scene || new THREE.Scene();
  const progress = (p) => onProgress?.(p);
  try {
    setMaxAnisotropy(engine.renderer.capabilities.getMaxAnisotropy());
  } catch {
    /* renderer without anisotropy support */
  }

  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);

  progress(0.05);
  const sky = createSky(scene, engine.renderer, { tier });
  progress(0.15);
  const reno = await buildReno(engine, physics, { tier });
  group.add(reno.group);
  progress(0.6);
  const motel = await buildStarlite(engine, physics, { tier });
  group.add(motel.group);
  progress(0.95);

  // Merged views. Motel zones come first so the room wins over the city's broad 4th St box.
  const zones = [...motel.zones, ...reno.zones];
  const interactables = [...motel.interactables, ...reno.interactables];
  const spawn = { ...reno.spawn, ...motel.spawn, street: reno.spawn.motelFront };

  const weather = { cloudCover: 0.16, rain: 0, fog: 0 };
  const viewer = new THREE.Vector3();

  return {
    scene,
    group,
    sky,
    reno,
    motel,
    zones,
    interactables,
    spawn,
    weather,
    /** Zones containing p, most specific (smallest volume) first. */
    zonesAt(p) {
      const out = [];
      for (const z of zones) if (z.box.containsPoint(p)) out.push(z);
      out.sort((a, b) => vol(a.box) - vol(b.box));
      return out;
    },
    update(dt, clock, ctx = {}) {
      if (ctx.viewer) viewer.copy(ctx.viewer);
      else if (ctx.camera) viewer.copy(ctx.camera.position);
      const w = ctx.weather || weather;
      sky.update(clock, w, viewer);
      reno.update(dt, clock, { weather: w, camera: ctx.camera, viewer, sky });
      motel.update(dt, clock, { camera: ctx.camera, viewer, sky, scene, weather: w, indoorLighting: true, citySigns: true });
    },
    dispose() {
      motel.dispose?.();
      reno.dispose?.();
      sky.dispose?.();
      group.removeFromParent();
    },
  };
}

const _s = new THREE.Vector3();
function vol(b) {
  b.getSize(_s);
  return _s.x * _s.y * _s.z;
}
