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
import { buildEldoradoInterior } from '../casino/index.js';

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
  // openDoors: the casino builder hangs the Eldorado's real doors in the shell's openings.
  const reno = await buildReno(engine, physics, { tier, eldorado: { openDoors: true } });
  group.add(reno.group);
  progress(0.55);
  const motel = await buildStarlite(engine, physics, { tier });
  group.add(motel.group);
  progress(0.75);
  const casino = await buildEldoradoInterior(engine, physics, { tier, scene });
  group.add(casino.group);
  progress(0.95);

  // Merged views. Motel zones come first so the room wins over the city's broad 4th St box.
  const zones = [...motel.zones, ...casino.zones, ...reno.zones];
  const interactables = [...motel.interactables, ...casino.interactables, ...reno.interactables];
  const spawn = { ...reno.spawn, ...motel.spawn, street: reno.spawn.motelFront };
  for (const [k, v] of Object.entries(casino.spawn)) spawn[`casino${k[0].toUpperCase()}${k.slice(1)}`] = v;

  // The casino's real-light pool trades places with the motel's night pool (same size per tier)
  // so the scene's light count — and every shader — stays the same wherever you are.
  const motelPool = [];
  motel.group.traverse((o) => o.isPointLight && o.parent?.name === 'night-lights' && motelPool.push(o));
  const rainMesh = reno.group.getObjectByName('rain');
  let cityHidden = false;

  const weather = { cloudCover: 0.16, rain: 0, fog: 0 };
  const viewer = new THREE.Vector3();

  return {
    scene,
    group,
    sky,
    reno,
    motel,
    casino,
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
      casino.update(dt, { camera: ctx.camera, viewer, player: ctx.player, sky, scene, clock });
      const inCasino = casino.state.near;
      casino.lightPool.setVisible(inCasino || !motelPool.length);
      for (const l of motelPool) l.visible = !inCasino;
      // No rain falls indoors.
      if (rainMesh && casino.state.inside > 0.5) rainMesh.visible = false;
      // Deep inside the casino (well away from every door) the city can't be seen: skip drawing it
      // (its light pool group stays, so the light count never changes).
      const cam = ctx.camera?.position || viewer;
      const hideCity = casino.state.insideNow && casino.nearestEntrance(cam) > 16;
      if (hideCity !== cityHidden) {
        cityHidden = hideCity;
        for (const c of reno.group.children) if (c.name !== 'night-lights') c.visible = !hideCity;
      }
      if (hideCity) for (const c of reno.group.children) if (c.name !== 'night-lights') c.visible = false;
    },
    dispose() {
      casino.dispose?.();
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
