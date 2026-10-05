// Downtown Reno slice: 4th St motel strip → N Virginia St → the Reno Arch, Eldorado exterior,
// Silver Legacy / Circus Circus massing, train trench. See layout.js for the coordinate contract.
//
//   const reno = await buildReno(engine, physics, { tier });
//   scene.add(reno.group);
//   reno.spawn.virginiaAt4th / underArch / motelFront   → {x, y, z, yaw}
//   reno.zones          → [{ id, box:{min,max}, audioRoom, venue, indoor }]
//   reno.interactables  → [{ id, kind, position, collider?, onInteract? }]
//   reno.update(dt, clock, { weather, camera, viewer })   every frame
//   reno.dispose()
//
// buildReno is async only because sign textures wait for the vendored web fonts to load.

import * as THREE from 'three';
import { StaticBatch, Colliders } from '../shared/batch.js';
import { buildGround } from './ground.js';
import { SPAWN } from './layout.js';

export async function buildReno(engine, physics, { tier } = {}) {
  tier = tier || engine.tier;
  const group = new THREE.Group();
  group.name = 'reno';
  const batch = new StaticBatch({ chunkSize: 64, name: 'reno-static' });
  const colliders = new Colliders(physics);
  const ctx = { engine, physics, tier, batch, colliders, extraMeshes: [], updaters: [], zones: [], interactables: [] };

  buildGround(ctx, { surfaces: [] });

  const built = batch.build();
  group.add(built.group);
  for (const m of ctx.extraMeshes) group.add(m);

  const viewer = new THREE.Vector3();
  return {
    group,
    spawn: SPAWN,
    zones: ctx.zones,
    interactables: ctx.interactables,
    update(dt, clock, o = {}) {
      if (o.viewer) viewer.copy(o.viewer);
      else if (o.camera) viewer.copy(o.camera.position);
      batch.cull(viewer, tier.drawDistance);
      for (const u of ctx.updaters) u(dt, clock, o, viewer);
    },
    dispose() {
      batch.dispose();
      group.traverse((o) => {
        if (o.isInstancedMesh) o.geometry.dispose();
      });
    },
  };
}
