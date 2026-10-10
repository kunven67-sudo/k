// The Starlite Motel, 4th St, Reno — the player's home (DESIGN §6, §34, §35).
//
//   const motel = await buildStarlite(engine, physics, { tier });
//   scene.add(motel.group);
//   motel.setRoomNumber(life.home.room);          // never 9 or 13
//   each frame: motel.update(dt, clock, { camera, viewer, sky, weather })
//
// Returns { group, spawn: { wakeFloor, roomDoorOutside, officeDesk, clerk }, zones, interactables,
//           setRoomNumber(n), update(dt, clock, o), dispose() }.
//
// Pieces: lot.js (asphalt, stalls, cars, dumpster), wings.js (rooms L-building, walkway, stair),
// office.js (office + interior), sign.js (pole sign), pool.js (empty pool), room.js (the player's
// room interior, bathroom, interactables, lights). Static geometry is merged through one StaticBatch
// (a handful of draw calls); everything that moves or toggles is its own small mesh.
import * as THREE from 'three';
import './strings.js';
import { StaticBatch, Colliders } from '../shared/batch.js';
import { NightLights } from '../shared/nightlights.js';
import { signsUpdate } from '../shared/signs.js';
import { addDecal } from '../../gfx/decals.js';
import { sunPosition } from '../../core/clock.js';
import { Rng } from '../../core/rng.js';
import { clamp, smoothstep } from '../../core/util.js';
import { Y0, LOT, OFFICE, BACK, EAST, ROOM, WALK_W } from './layout.js';
import { buildLot } from './lot.js';
import { buildWings } from './wings.js';
import { numberAtlas } from './mats.js';

// Optional pieces are imported lazily so a missing/failed piece never takes the whole motel down.
const PIECES = ['office', 'sign', 'pool', 'room'];

export async function buildStarlite(engine, physics, { tier } = {}) {
  tier = tier || engine?.tier || { name: 'medium', shadows: true, drawDistance: 220 };
  const group = new THREE.Group();
  group.name = 'starlite';
  const batch = new StaticBatch({ chunkSize: 64, name: 'starlite-static' });
  const colliders = new Colliders(physics);
  const ctx = {
    engine, physics, tier, batch, colliders, group,
    extraMeshes: [], updaters: [], zones: [], interactables: [], lights: [],
    decals: [], decalGround: [], decalWalls: [], rng: new Rng('starlite'),
    spawn: {},
  };

  buildLot(ctx);
  const wings = buildWings(ctx);
  for (const name of PIECES) {
    let mod = null;
    try {
      mod = await import(`./${name}.js`);
    } catch (e) {
      console.warn(`[starlite] piece "${name}" unavailable:`, e.message);
      continue;
    }
    await mod[`build${name[0].toUpperCase()}${name.slice(1)}`](ctx);
  }

  const built = batch.build();
  group.add(built.group);
  // Interior chunks are shown by proximity (see update), never by the generic distance cull.
  const interiors = [];
  for (const c of built.chunks) {
    if (c.key === 'room' || c.key === 'office') {
      c.landmark = true;
      interiors.push({ c, radius: c.key === 'room' ? 16 : 40, extra: c.key === 'room' ? ctx.room?.group : null });
    }
  }
  for (const m of ctx.extraMeshes) group.add(m);
  group.updateMatrixWorld(true);
  placeDecals(ctx);
  // Dynamic props need their final world transforms before their Rapier bodies are created.
  for (const fn of ctx.after || []) fn();

  // ---- Room numbers: the atlas holds one cell per door slot -------------------------------------
  const slots = wings.slots;
  const atlas = numberAtlas();
  const numbers = slots.map((s) => s.num);
  const playerIdx = slots.findIndex((s) => s.player);
  const defaultPlayerNum = numbers[playerIdx];
  atlas.draw(numbers);
  function setRoomNumber(n) {
    n = Math.max(1, Math.round(+n || defaultPlayerNum));
    if (n === 9 || n === 13) n += 1; // 9 is the weird guy, 13 is haunted (DESIGN §6)
    // Reset to the default numbering, then swap so n is unique.
    slots.forEach((s, i) => (numbers[i] = s.num));
    const other = numbers.indexOf(n);
    if (other >= 0 && other !== playerIdx) numbers[other] = defaultPlayerNum;
    numbers[playerIdx] = n;
    atlas.draw(numbers);
    ctx.room?.setNumber?.(n);
    return n;
  }

  // ---- Night lights (pools on the ground + a few real point lights near the viewer) -------------
  const night = new NightLights(group, ctx.lights, { tier });

  // ---- Zones ----
  const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  const zones = [
    { id: 'motel-room', box: box(ROOM.x0, Y0 - 0.2, ROOM.zBath, ROOM.x1, Y0 + ROOM.ceil + 0.2, ROOM.zDoor - 0.3), audioRoom: 'motel', venue: 'starlite', indoor: true },
    { id: 'motel-bathroom', box: box(ROOM.x0, Y0 - 0.2, BACK.z0 + 0.3, ROOM.x1, Y0 + ROOM.ceil + 0.2, ROOM.zBath), audioRoom: 'bathroom', venue: 'starlite', indoor: true },
    { id: 'motel-office', box: box(OFFICE.x0 + 0.3, Y0 - 0.2, OFFICE.z0 + 0.3, OFFICE.x1 - 0.3, Y0 + OFFICE.h, OFFICE.z1 - 0.3), audioRoom: 'motel', venue: 'starlite', indoor: true },
    { id: 'motel-lot', box: box(LOT.x0, -2.5, LOT.z0, LOT.x1, 14, LOT.z1), audioRoom: 'outdoor', venue: 'starlite', indoor: false },
  ];

  // ---- Spawns ----
  const spawn = {
    wakeFloor: { x: 204.95, y: Y0 + 0.13, z: -47.2, yaw: Math.PI }, // between the bed and the door, facing it
    roomDoorOutside: { x: ROOM.x0 + 0.75, y: Y0 + 0.12, z: ROOM.zDoor + 0.9, yaw: 0 },
    officeDesk: { x: OFFICE.x0 + 4.2, y: Y0 + 0.02, z: -17.2, yaw: Math.PI },
    clerk: { x: OFFICE.x0 + 4.2, y: Y0 + 0.02, z: -19.8, yaw: 0 },
    ...ctx.spawn,
  };

  // ---- Runtime ----
  const viewer = new THREE.Vector3();
  ctx.viewer = viewer;
  const state = { night: 0, time: 0, indoor: 0 };
  return {
    group,
    spawn,
    zones,
    interactables: ctx.interactables,
    lights: ctx.lights,
    state,
    colliderCount: colliders.count,
    slots,
    setRoomNumber,
    update(dt, clock, o = {}) {
      state.time += dt;
      if (o.viewer) viewer.copy(o.viewer);
      else if (o.camera) viewer.copy(o.camera.position);
      let nf;
      if (o.night != null) nf = o.night;
      else if (o.sky?.state) nf = o.sky.state.night;
      else {
        const el = (sunPosition(clock.gameMs).elevation * 180) / Math.PI;
        nf = 1 - smoothstep(-8, 2, el);
      }
      state.night = clamp(nf, 0, 1);
      // signsUpdate is idempotent per frame (it sets shared uniforms); calling it here keeps the
      // motel self-sufficient when built without the city.
      if (!o.citySigns) signsUpdate(state.night, state.time, 0);
      night.update(dt, { night: state.night, wet: 0, viewer, time: state.time });
      batch.cull(viewer, tier.drawDistance ?? 220);
      for (const it of interiors) {
        const vis = it.c.center.distanceTo(viewer) < it.radius;
        if (vis !== it.c.visible) {
          it.c.visible = vis;
          for (const m of it.c.meshes) m.visible = vis;
          if (it.extra) it.extra.visible = vis;
        }
      }
      for (const u of ctx.updaters) u(dt, clock, o, viewer, state);
      // Indoors the sky's hemisphere/environment light would flood every corner equally; when the
      // caller opts in, dim them while the viewer is inside the room or office (eased).
      let target = 0;
      for (const z of zones) if (z.indoor && z.box.containsPoint(viewer)) target = 1;
      state.indoor += (target - state.indoor) * Math.min(1, dt * 3 || 1);
      if (o.indoorLighting && o.sky?.hemi && state.indoor > 0.001) {
        o.sky.hemi.intensity *= 1 - 0.7 * state.indoor;
        if (o.scene) o.scene.environmentIntensity *= 1 - 0.65 * state.indoor;
        // The sun's coarse shadow map leaks along wall/ceiling joints in a 2.5 m room; indoors the
        // room fakes its own sunbeam through the curtain gap instead (room.js spill quads).
        if (o.sky.sunLight) o.sky.sunLight.intensity *= 1 - 0.85 * state.indoor;
      }
    },
    dispose() {
      night.dispose();
      batch.dispose();
      for (const d of ctx.disposers || []) d();
    },
  };
}

function placeDecals(ctx) {
  const { group } = ctx;
  const rng = new Rng('starlite-decals');
  const up = new THREE.Vector3(0, 1, 0);
  for (const d of ctx.decals) {
    addDecal(d.target || group, d.kind, { position: d.position, normal: d.normal || up, size: d.size ?? 1, rotation: d.rotation ?? rng.range(0, Math.PI * 2), seed: rng.next(), opacity: d.opacity ?? rng.range(0.55, 1) });
  }
  for (const L of ctx.decalGround) {
    for (let i = 0; i < L.n; i++) {
      const kind = rng.pick(L.kinds);
      const size = kind === 'skid' ? [rng.range(3, 5), 1.2] : rng.range(0.8, 2.2);
      addDecal(group, kind, { position: new THREE.Vector3(rng.range(L.x0 + 0.5, L.x1 - 0.5), (L.y ?? Y0) + 0.003, rng.range(L.z0 + 0.5, L.z1 - 0.5)), normal: up, size, rotation: rng.range(0, Math.PI * 2), seed: rng.next(), opacity: rng.range(0.5, 0.95) });
    }
  }
  for (const W of ctx.decalWalls) {
    for (let i = 0; i < W.n; i++) {
      const kind = rng.pick(W.kinds);
      const size = kind === 'graffiti' ? rng.range(1.2, 2.0) : rng.range(0.9, 1.8);
      const x = rng.range(W.x0 + size / 2, W.x1 - size / 2);
      const y = kind === 'streak' ? W.y1 - size * 0.45 : rng.range(W.y0 + size / 2, Math.max(W.y0 + size / 2, W.y1 - size / 2));
      const p = new THREE.Vector3(x, y, 0.006).applyMatrix4(W.frame.matrix);
      addDecal(group, kind, { position: p, normal: W.frame.normal, size, rotation: kind === 'streak' ? Math.PI : rng.range(-0.2, 0.2), seed: rng.next(), opacity: rng.range(0.35, 0.8) });
    }
  }
}

export { Y0, LOT, BACK, EAST, ROOM, WALK_W };
