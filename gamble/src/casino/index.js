// The Eldorado casino floor (lane A): everything inside the shell that src/world/reno/eldorado.js
// leaves empty — architecture, lighting, the fountain, foyer + security, the cage, bar,
// restrooms / elevators / escalator, the table pit and slot banks (factories from lanes B / C),
// the staff and players, and the floor's sound.
//
//   const casino = await buildEldoradoInterior(engine, physics, { tier, scene, rng });
//   world.group.add(casino.group);
//   casino.update(dt, { camera, viewer, player, sky, scene, clock })   every frame
//
// Returns { group, zones, interactables, stations, spawn: { entrance, foyer, cage, pit, slots, … },
//           lightPool, isInside(p), update, dispose }.
//
// Performance (phones): statics merge into ONE StaticBatch chunk (one draw call per material);
// chandelier crystals, candle bulbs, door leaves, eye domes and glow quads are instanced; a fixed
// pool of real lights follows the viewer; the whole interior is hidden when you're outside and not
// near a door, and far stations are culled + frozen by distance.
import * as THREE from 'three';
import './strings.js';
import { StaticBatch, Colliders } from '../world/shared/batch.js';
import { Rng } from '../core/rng.js';
import { clamp, damp } from '../core/util.js';
import { createBlackjackTable, createRouletteTable } from './tables/index.js';
import { createSlotBank } from './slots/index.js';
import { casinoMats } from './interior/mats.js';
import { LightPool, Spots, GlowSet, interiorEnvironment } from './interior/lights.js';
import { buildRoom } from './interior/room.js';
import { Chandeliers, eyeDomes, casinoSigns } from './interior/fixtures.js';
import { DoorSet } from './interior/doors.js';
import { buildFountain } from './interior/fountain.js';
import { CasinoSound, patchZoneAmbience } from './interior/sounds.js';
import { toast } from '../ui/kit.js';
import {
  FLOOR_Y, SHELL, DOORS, CHAMFER, TABLES, SLOT_BANKS, SPAWNS, ZONES, insideShell,
} from './layout.js';

const CHANDELIERS = [
  [-19.6, 47.6, 1.05], [-19.6, 52.4, 1.05], // foyer
  [-48.4, 71.6, 0.85], [-43.6, 71.6, 0.85], [-48.4, 76.4, 0.85], [-43.6, 76.4, 0.85], // pit
  [-34.0, 90.8, 0.9], [-24.4, 90.8, 0.9], // bar
  [-72.4, 52.4, 0.95], // cage
  [-67.6, 52.4, 0.9], [-24.4, 47.6, 0.9], [-43.6, 23.6, 1.1], // aisles, car display
];
const NPCS_PER_TABLE = { low: 1, medium: 2, high: 3, ultra: 3 };
const CULL = { low: 28, medium: 38, high: 55, ultra: 80 };

export async function buildEldoradoInterior(engine, physics, { tier, scene, rng } = {}) {
  tier = tier || engine?.tier || { name: 'medium' };
  rng = rng || new Rng('eldorado-floor');
  const group = new THREE.Group();
  group.name = 'eldorado-interior';
  const M = casinoMats();
  const batch = new StaticBatch({ chunkSize: 1000, name: 'eldorado-static' });
  const colliders = new Colliders(physics);
  const spots = new Spots();
  const glows = new GlowSet();
  const pool = new LightPool(group, { tier });
  const baked = [];
  const C = {
    engine, physics, tier, scene, rng, group, batch, colliders, M, spots, glows, pool,
    signs: casinoSigns(),
    chandeliers: CHANDELIERS.map(([x, z]) => [x, z]),
    eyes: [],
    interactables: [],
    updaters: [],
    disposers: [],
    lastPlayer: null,
    toast: (text) => {
      try {
        toast(engine.uiRoot || document.getElementById('ui-root'), text, 2600);
      } catch {
        /* no DOM (tests) */
      }
    },
    add: (geo, mat, o = {}) => batch.add(geo, mat, { chunk: 'casino', ...o }),
    addBaked: (geo, mat, mul, occ, o = {}) => baked.push({ geo, mat, mul, occ, o }),
  };

  // ---- architecture ----
  const room = buildRoom(C);
  const chand = new Chandeliers(C);
  for (const [x, z, s] of CHANDELIERS) chand.add(x, z, s);
  const fountain = buildFountain(C);

  // ---- doors (Virginia St ×3 pairs, 4th St ×2 pairs, chamfer corner ×2 pairs) ----
  const doors = new DoorSet({ physics, mats: M });
  const inwardE = new THREE.Vector3(-1, 0, 0);
  DOORS.virginia.forEach((d, i) => doors.addOpening({ id: `eldo-door-v${i}`, p0: new THREE.Vector3(-12.2, 0, d.z0), p1: new THREE.Vector3(-12.2, 0, d.z1), inward: inwardE, y0: 0.15, pairs: 1 }));
  doors.addOpening({ id: 'eldo-door-4th', p0: new THREE.Vector3(DOORS.fourth.x0, 0, 12.2), p1: new THREE.Vector3(DOORS.fourth.x1, 0, 12.2), inward: new THREE.Vector3(0, 0, 1), y0: 0.15, pairs: 2 });
  {
    const sq = Math.SQRT1_2;
    const at = (x) => new THREE.Vector3(-12 - x * sq - 0.2 * sq, 0, 17 - x * sq + 0.2 * sq);
    doors.addOpening({ id: 'eldo-door-corner', p0: at(DOORS.chamfer.from), p1: at(DOORS.chamfer.to), inward: new THREE.Vector3(-sq, 0, sq), y0: 0.15, pairs: 2 });
  }
  for (const s of doors.statics) C.add(s.geo, s.mat);

  // ---- stations: the table pit and the slot banks (lanes B / C factories) ----
  const stations = [];
  const banks = [];
  const npcsPer = NPCS_PER_TABLE[tier.name] ?? 2;
  for (const T of TABLES) {
    const opts = { engine, physics, tier, casino: 'eldorado', id: T.id, position: new THREE.Vector3(T.x, FLOOR_Y, T.z), yaw: T.yaw, limits: T.limits, rng: new Rng(`eldorado-${T.id}`), npcs: npcsPer };
    let st = null;
    try {
      st = T.kind === 'roulette' ? createRouletteTable(opts) : createBlackjackTable(opts);
    } catch (e) {
      console.warn(`[casino] table ${T.id} failed:`, e);
    }
    if (!st) continue;
    group.add(st.group);
    st.refreshWorld?.();
    stations.push(st);
    C.interactables.push(...(st.interactables || []));
  }
  for (const B of SLOT_BANKS) {
    const opts = { engine, physics, tier, casino: 'eldorado', id: B.id, theme: B.theme, count: B.count, arrangement: B.arrangement, position: new THREE.Vector3(B.x, FLOOR_Y, B.z), yaw: B.yaw, rng: new Rng(`eldorado-${B.id}`), denom: B.denom };
    let bank = null;
    try {
      bank = createSlotBank(opts);
    } catch (e) {
      console.warn(`[casino] slot bank ${B.id} failed:`, e);
    }
    if (!bank) continue;
    group.add(bank.group);
    for (const m of bank.machines || []) m.refreshWorld?.();
    bank.center = new THREE.Vector3(B.x, FLOOR_Y + 1, B.z);
    bank.spec = B;
    banks.push(bank);
    C.interactables.push(...(bank.interactables || []));
    // Machines light the carpet in front of them with their screen colours.
    spots.add(B.x, B.z, 2.6, 0.22, { 'classic-fruit': 0xffc070, 'wild-west': 0xffa860, space: 0x80b0ff, dragon: 0xff7060 }[B.theme] ?? 0xffd0a0);
  }
  for (const T of TABLES) spots.add(T.x, T.z, 2.4, 0.38, 0xffe0b0);

  // ---- bake the floor now that every light footprint is known, then build the batch ----
  for (const b of baked) {
    spots.bake(b.geo, b.mul, b.occ);
    C.add(b.geo, b.mat, b.o);
  }
  const built = batch.build();
  group.add(built.group);
  for (const mesh of built.group.children) mesh.frustumCulled = true;
  chand.build(group);
  eyeDomes(C, C.eyes);
  doors.build(group);
  glows.build(group);
  C.interactables.push(...doors.interactables);

  // ---- zones / spawns ----
  const zones = ZONES.map((z) => ({
    id: z.id,
    box: new THREE.Box3(new THREE.Vector3(z.box[0], z.box[1], z.box[2]), new THREE.Vector3(z.box[3], z.box[4], z.box[5])),
    audioRoom: 'casino',
    venue: 'eldorado',
    indoor: true,
    ambience: 'self',
  }));
  const spawn = {};
  for (const [k, v] of Object.entries(SPAWNS)) spawn[k] = { ...v };

  // ---- sound ----
  patchZoneAmbience();
  const sound = new CasinoSound({ banks, tables: stations.map((st) => ({ p: st.group.getWorldPosition(new THREE.Vector3()) })), doors });
  C.disposers.push(() => sound.dispose());

  // ---- runtime ----
  let envRT = null;
  try {
    envRT = interiorEnvironment(engine.renderer);
  } catch (e) {
    console.warn('[casino] interior environment failed', e);
  }
  const state = { inside: 0, time: 0, near: false };
  const viewer = new THREE.Vector3();
  const lastPlayer = new THREE.Vector3();
  const playerVel = new THREE.Vector3();
  let hadPlayer = false;
  const cullDist = CULL[tier.name] ?? 38;
  const entrances = [new THREE.Vector3(-12.2, 1.5, 50), new THREE.Vector3(-45, 1.5, 12.2), new THREE.Vector3(-14.6, 1.5, 14.6)];
  const isInside = (p) => p.y < 7 && p.y > -1 && insideShell(p.x, p.z, -0.05);

  function update(dt, ctx = {}) {
    state.time += dt;
    if (ctx.viewer) viewer.copy(ctx.viewer);
    else if (ctx.camera) viewer.copy(ctx.camera.position);
    const camPos = ctx.camera?.position || viewer;
    const inside = isInside(camPos) || isInside(viewer);
    state.inside = damp(state.inside, inside ? 1 : 0, 0.25, dt);
    state.insideNow = inside;
    // Outside and away from the doors: nothing in here can be seen.
    let nearDoor = Infinity;
    for (const e of entrances) nearDoor = Math.min(nearDoor, e.distanceTo(camPos));
    const show = inside || nearDoor < 34;
    if (group.visible !== show) group.visible = show;
    state.near = show;

    // Player velocity (for walk-through doors).
    const pl = ctx.player;
    if (pl?.position) C.lastPlayer = pl.position;
    if (pl?.position) {
      if (hadPlayer && dt > 0) playerVel.copy(pl.position).sub(lastPlayer).divideScalar(dt);
      lastPlayer.copy(pl.position);
      hadPlayer = true;
      doors.update(dt, { position: pl.position, velocity: playerVel });
    } else doors.update(dt, null);
    if (!show) {
      sound.update(dt, { inside: 0, viewer, doorNear: nearDoor });
      return;
    }

    pool.update(dt, viewer, ctx.camera, clamp(state.inside * 1.4, 0, 1) * 0.85 + 0.15);
    // Inside: warm interior fill instead of the sky's, interior reflections, no sun.
    const k = state.inside;
    const sky = ctx.sky;
    if (sky && k > 0.001) {
      if (sky.hemi) {
        sky.hemi.color.lerp(_warmSky, k);
        sky.hemi.groundColor.lerp(_warmGround, k);
        sky.hemi.intensity = sky.hemi.intensity * (1 - k) + 0.32 * k;
      }
      if (sky.sunLight) sky.sunLight.intensity *= 1 - k;
    }
    // Deep inside, the sun's shadow map has nothing to do: stop re-rendering it (toggling
    // castShadow would recompile every shader; autoUpdate doesn't).
    if (sky?.sunLight?.shadow) sky.sunLight.shadow.autoUpdate = !(inside && nearDoor > 16);
    const sc = ctx.scene || scene;
    if (sc && envRT) {
      if (k > 0.5) {
        if (sc.environment !== envRT.texture) {
          state.skyEnv = sc.environment;
          sc.environment = envRT.texture;
        }
        sc.environmentIntensity = 0.6;
      } else if (sc.environment === envRT.texture) {
        sc.environment = sky?.envRT?.texture || state.skyEnv || null;
      }
    }

    // Stations: update near ones, hide + freeze far ones.
    const sctx = { camera: ctx.camera, player: pl, clock: ctx.clock };
    for (const st of stations) {
      st.group.getWorldPosition(_p);
      const d = _p.distanceTo(viewer);
      const vis = d < cullDist + 6 || st.active;
      if (st.group.visible !== vis) st.group.visible = vis;
      if (vis) st.update(dt, sctx);
    }
    for (const b of banks) {
      const d = b.center.distanceTo(viewer);
      const vis = d < cullDist || (b.machines || []).some((m) => m.active);
      if (b.group.visible !== vis) b.group.visible = vis;
      if (vis) b.update?.(dt, sctx);
    }
    for (const u of C.updaters) u(dt, ctx, state);
    sound.update(dt, { inside: state.inside, viewer, npcCount: C.npcCount || 0, doorNear: nearDoor });
  }

  return {
    group,
    zones,
    interactables: C.interactables,
    stations,
    banks,
    doors,
    spawn,
    lightPool: pool,
    state,
    coffers: room.coffers,
    fountain,
    nearestEntrance: (p) => Math.min(...entrances.map((e) => e.distanceTo(p))),
    colliderCount: colliders.count,
    isInside,
    update,
    dispose() {
      for (const st of stations) st.dispose?.();
      for (const b of banks) b.dispose?.();
      for (const d of C.disposers) d();
      batch.dispose();
      envRT?.dispose();
      group.removeFromParent();
    },
  };
}

const _p = new THREE.Vector3();
const _warmSky = new THREE.Color(0xffe2bc);
const _warmGround = new THREE.Color(0x8a5a3c);

export { SHELL, CHAMFER, FLOOR_Y };
