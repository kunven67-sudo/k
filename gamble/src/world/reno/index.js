// Downtown Reno slice: 4th St motel strip → N Virginia St → the Reno Arch, Eldorado exterior,
// Silver Legacy / Circus Circus, the National Bowling Stadium, the train trench, and the city
// around it. See layout.js for the coordinate contract shared with the motel & casino builders.
//
//   const reno = await buildReno(engine, physics, { tier, eldorado: { clearGlass, openDoors } });
//   scene.add(reno.group);
//   reno.spawn.virginiaAt4th / underArch / motelFront / eldoradoEntrance  → {x, y, z, yaw}
//   reno.zones          → [{ id, box: Box3, audioRoom, venue, indoor, trigger? }]
//   reno.interactables  → [{ id, kind, position, describe(), onInteract(player) }]
//   reno.lights         → registered light sources (for other systems, e.g. NPC visibility)
//   reno.update(dt, clock, { weather, camera, viewer, sky })   every frame
//   reno.state          → { night, wet } (what the world is currently showing)
//   reno.dispose()
//
// buildReno is async only because sign textures wait for the vendored web fonts to load.
// Performance: static geometry is merged per (64 m chunk × material) and culled by
// tier.drawDistance; landmarks (arch, towers, dome, skyline) are never culled; lights near the
// viewer are real, everything else is emissive + instanced ground pools / wet reflections.

import * as THREE from 'three';
import { StaticBatch, Colliders } from '../shared/batch.js';
import { Props } from '../shared/props.js';
import { signalUpdate } from '../shared/props.js';
import { signsUpdate, resetSigns } from '../shared/signs.js';
import { setVehicleDetail } from '../shared/vehicles.js';
import { updateFacades } from '../shared/facade.js';
import { NightLights } from '../shared/nightlights.js';
import { WET, Rain, wetBatch } from '../shared/wet.js';
import { fontsReady } from '../shared/text3d.js';
import { addDecal } from '../../gfx/decals.js';
import { audio } from '../../core/audio.js';
import { Rng } from '../../core/rng.js';
import { clamp, damp, smoothstep } from '../../core/util.js';
import { sunPosition } from '../../core/clock.js';
import { t } from '../../core/i18n.js';
import './strings.js';
import { buildGround } from './ground.js';
import { SPAWN, ARCH_Z, TRENCH, ROADS, roadRect } from './layout.js';
import { buildArch } from './arch.js';
import { buildEldorado } from './eldorado.js';
import { buildLegacy } from './legacy.js';
import { buildDowntown } from './downtown.js';
import { buildStrip, STRIP_LOTS } from './strip.js';
import { buildStreets } from './streets.js';
import { buildFiller } from './filler.js';

const WET_KINDS = ['asphalt', 'sidewalk', 'curb', 'concrete', 'road-paint', 'dirt', 'gravel', 'terrazzo', 'decals', 'carpet-casino', 'tile-bulkhead', 'board-concrete', 'ballast'];

export async function buildReno(engine, physics, { tier, month, eldorado = {} } = {}) {
  tier = tier || engine.tier;
  await fontsReady([
    '400 64px "Bebas Neue"', '400 64px "Inter"', '600 64px "Inter"', '700 64px "Playfair Display"',
    'italic 400 64px "Playfair Display"', '400 64px "Rye"', '400 64px "Monoton"', '400 64px "Special Elite"',
  ]);
  resetSigns(tier);
  setVehicleDetail(tier?.name === 'low' ? 0 : 1);
  const group = new THREE.Group();
  group.name = 'reno';
  // 64 m chunks: tried 128 m on tier low — only -20% draw calls for +65% triangles, not worth it.
  const batch = new StaticBatch({ chunkSize: 64, name: 'reno-static' });
  const colliders = new Colliders(physics);
  const ctx = {
    engine, physics, tier, batch, colliders, group,
    extraMeshes: [], updaters: [], zones: [], interactables: [], lights: [],
    decalGround: [], decalWalls: [], rng: new Rng('reno'),
  };
  const mon = month ?? new Date().getMonth() + 1;

  buildGround(ctx, { surfaces: STRIP_LOTS });
  ctx.stripProps = new Props(ctx);
  buildStrip(ctx);
  buildDowntown(ctx);
  const eldo = buildEldorado(ctx, eldorado);
  buildLegacy(ctx);
  const arch = buildArch(ctx);
  buildStreets(ctx, { month: mon });
  buildFiller(ctx);

  const built = batch.build();
  group.add(built.group);
  for (const m of ctx.extraMeshes) group.add(m);
  // Small stand-alone meshes (signs, bulb strings, blades) are hidden past the tier draw distance
  // like the static chunks; big ones (tower crowns, skyline signs) stay as landmarks.
  const smallMeshes = [];
  group.updateMatrixWorld(true);
  for (const m of ctx.extraMeshes) {
    const s = new THREE.Box3().setFromObject(m).getBoundingSphere(new THREE.Sphere());
    if (Number.isFinite(s.radius) && s.radius < 12) smallMeshes.push({ m, c: s.center, r: s.radius });
  }

  placeDecals(ctx);
  wetBatch(group, (m) => WET_KINDS.some((k) => m.name.startsWith(k)) && { puddles: m.name.startsWith('asphalt') || m.name.startsWith('decals') || m.name.startsWith('road-paint') ? 1 : 0.6, porous: m.name.startsWith('asphalt') ? 0.5 : 0.7 });

  const night = new NightLights(group, ctx.lights, { tier });
  const rain = new Rain(group, { tier });

  // ---- Zones ----
  const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  const zones = [
    { id: 'virginia-st', box: box(-11, -1, -140, 11, 30, 152), audioRoom: 'street', venue: 'downtown', indoor: false },
    { id: 'reno-arch', box: box(-11, -1, ARCH_Z - 8, 11, 30, ARCH_Z + 8), audioRoom: 'street', venue: 'downtown', indoor: false },
    { id: '4th-st-downtown', box: box(-40, -1, -11, 90, 30, 11), audioRoom: 'street', venue: 'downtown', indoor: false },
    { id: '4th-st-strip', box: box(90, -1, -11, 262, 30, 11), audioRoom: 'street', venue: '4th-st', indoor: false },
    { id: 'commercial-row', box: box(-62, -1, 104, 62, 30, 124), audioRoom: 'street', venue: 'downtown', indoor: false },
    { id: 'lake-st', box: box(90, -1, -75, 110, 30, 75), audioRoom: 'street', venue: '4th-st', indoor: false },
    { id: 'train-trench', box: box(-150, -TRENCH.depth - 1, TRENCH.z0, 300, 0, TRENCH.z1), audioRoom: 'outdoor', venue: 'trench', indoor: false },
    { id: 'vacant-lot', box: box(110, -1, 11, 149, 10, 58), audioRoom: 'outdoor', venue: '4th-st', indoor: false },
    { id: 'lucky-spur-lot', box: box(147, -1, -58, 179, 10, -11), audioRoom: 'outdoor', venue: '4th-st', indoor: false },
    { id: 'desert-rose-lot', box: box(150, -1, 11, 185, 10, 42), audioRoom: 'outdoor', venue: '4th-st', indoor: false },
    { id: 'silver-dollar-lot', box: box(216, -1, 11, 262, 10, 60), audioRoom: 'outdoor', venue: '4th-st', indoor: false },
    { id: 'eldorado-canopy', box: box(-12, -1, 40.5, -7, 6, 59.5), audioRoom: 'street', venue: 'eldorado', indoor: false },
    eldo.zone,
  ];

  // ---- Interactables (owners for the player's interaction raycasts) ----
  const interactables = [
    {
      id: 'eldorado-doors', kind: 'door', position: new THREE.Vector3(-12.3, 1.3, 50),
      describe: () => t('reno.eldo.entrance'),
      // The casino builder hooks the real door; until then the doors report where they lead.
      onInteract: () => ({ venue: 'eldorado', to: eldo.entrance }),
    },
    { id: 'bus-stop-4th', kind: 'bus-stop', position: new THREE.Vector3(166, 1.0, 9.6), describe: () => 'RTC', onInteract: () => ({ routes: ['11', '18'] }) },
  ];

  const spawn = {
    ...SPAWN,
    eldoradoEntrance: eldo.entrance,
  };

  // ---- Runtime ----
  const viewer = new THREE.Vector3();
  const state = { night: 0, wet: 0 };
  let time = 0;
  const buzz = new NeonBuzz(ctx.lights);
  return {
    group,
    spawn,
    zones,
    interactables,
    lights: ctx.lights,
    arch,
    state,
    colliderCount: colliders.count,
    update(dt, clock, o = {}) {
      time += dt;
      if (o.viewer) viewer.copy(o.viewer);
      else if (o.camera) viewer.copy(o.camera.position);
      const w = o.weather || {};
      // Night factor: from the sky if given, else from the real sun elevation.
      let nf;
      if (o.sky?.state) nf = o.sky.state.night;
      else {
        const el = (sunPosition(clock.gameMs).elevation * 180) / Math.PI;
        nf = 1 - smoothstep(-8, 2, el);
      }
      // Dark rain clouds switch the lights on early.
      nf = Math.max(nf, clamp((w.rain ?? 0) * 0.55 + (w.cloudCover ?? 0) * 0.1 - 0.1, 0, 0.6));
      state.night = nf;
      // Streets get wet quickly in rain and dry slowly afterwards; puddles grow over time.
      const rainAmt = w.rain ?? 0;
      state.wet = damp(state.wet, rainAmt > 0.05 ? Math.min(1, 0.55 + rainAmt * 0.6) : 0, rainAmt > 0.05 ? 6 : 90, dt);
      WET.uWet.value = state.wet;
      WET.uPuddle.value = damp(WET.uPuddle.value, rainAmt, 40, dt);
      WET.uTime.value = time;
      signsUpdate(nf, time, state.wet);
      updateFacades(nf, time, clock.hourFloat ?? 12);
      signalUpdate(time);
      night.update(dt, { night: nf, wet: Math.max(state.wet, w.wetOverride ?? 0), viewer, time });
      if (o.camera) rain.update(dt, o.camera, rainAmt, o.sky?.hemi ? o.sky.hemi.color.clone().multiplyScalar(0.55 + nf * 0.3) : null);
      batch.cull(viewer, tier.drawDistance);
      for (const o of smallMeshes) o.m.visible = o.c.distanceTo(viewer) - o.r < tier.drawDistance;
      buzz.update(dt, viewer, nf);
      for (const u of ctx.updaters) u(dt, clock, o, viewer);
    },
    dispose() {
      buzz.dispose();
      night.dispose();
      rain.dispose();
      batch.dispose();
      group.traverse((m) => {
        if (m.isInstancedMesh) m.geometry.dispose();
      });
    },
  };
}

// ---- Decals ------------------------------------------------------------------------------------

function placeDecals(ctx) {
  const { group } = ctx;
  const rng = new Rng('decals');
  const up = new THREE.Vector3(0, 1, 0);
  const add = (kind, x, y, z, size, o = {}) => addDecal(group, kind, { position: new THREE.Vector3(x, y, z), normal: o.normal || up, size, rotation: o.rotation ?? rng.range(0, Math.PI * 2), seed: rng.next(), opacity: o.opacity ?? rng.range(0.55, 1) });
  const inReserved = (x, z) => x > 180 && x < 230 && z > -55 && z < -11;
  // Sidewalks: gum everywhere downtown, grime, cracks (more on the strip), dried puddle stains.
  const walks = [];
  for (const r of ROADS) {
    const R = roadRect(r);
    const [a0, a1] = r.play;
    if (r.axis === 'x') {
      walks.push([Math.max(R.x0, a0), Math.min(R.x1, a1), R.z1 + 0.3, R.z1 + 3.8, r.id], [Math.max(R.x0, a0), Math.min(R.x1, a1), R.z0 - 3.8, R.z0 - 0.3, r.id]);
    } else {
      walks.push([R.x1 + 0.3, R.x1 + 3.8, Math.max(R.z0, a0), Math.min(R.z1, a1), r.id], [R.x0 - 3.8, R.x0 - 0.3, Math.max(R.z0, a0), Math.min(R.z1, a1), r.id]);
    }
  }
  for (const [x0, x1, z0, z1, id] of walks) {
    const area = (x1 - x0) * (z1 - z0);
    const strip = id === '4th' && x0 > 80;
    const n = (k) => Math.round(area * k);
    for (let i = 0; i < n(id === 'virginia' ? 0.05 : 0.025); i++) {
      const x = rng.range(x0, x1);
      const z = rng.range(z0, z1);
      if (inReserved(x, z) || (z > TRENCH.z0 - 0.5 && z < TRENCH.z1 + 0.5)) continue;
      add('gum', x, 0.152, z, rng.range(0.6, 1.2), { opacity: rng.range(0.5, 0.9) });
    }
    for (let i = 0; i < n(strip ? 0.03 : 0.012); i++) add('grime', rng.range(x0, x1), 0.152, rng.range(z0, z1), rng.range(1.0, 2.6), { opacity: rng.range(0.3, 0.7) });
    for (let i = 0; i < n(strip ? 0.018 : 0.006); i++) add('crack', rng.range(x0, x1), 0.153, rng.range(z0, z1), rng.range(1.2, 2.4));
    for (let i = 0; i < n(0.004); i++) add('puddle', rng.range(x0, x1), 0.153, rng.range(z0, z1), rng.range(1.2, 2.4), { opacity: rng.range(0.4, 0.8) });
    if (strip) for (let i = 0; i < n(0.004); i++) add('burn', rng.range(x0, x1), 0.153, rng.range(z0, z1), rng.range(0.3, 0.5));
  }
  // Roads: oil drips in lane centres + parking lanes, skids at intersections, patches of grime.
  for (let i = 0; i < 240; i++) {
    const onVirginia = rng.chance(0.4);
    const x = onVirginia ? rng.pick([-5.2, -1.8, 1.8, 5.2]) + rng.range(-0.3, 0.3) : rng.range(-40, 262);
    const z = onVirginia ? rng.range(-140, 152) : rng.pick([-5.85, -2.3, 2.3, 5.85]) + rng.range(-0.3, 0.3);
    if (z > TRENCH.z0 - 1 && z < TRENCH.z1 + 1) continue;
    add('oil', x, 0.002, z, rng.range(0.6, 1.5), { opacity: rng.range(0.5, 0.95) });
  }
  for (const [x, z, r] of [[-3, -18, 0.1], [4, 22, 3.1], [-20, 2.5, 1.6], [24, -2.4, 1.5], [96, -3, 1.5], [3.5, 96, 3.2]]) add('skid', x, 0.002, z, [5.5, 1.6], { rotation: r + Math.PI / 2, opacity: 0.6 });
  for (let i = 0; i < 70; i++) add('grime', rng.range(-40, 262), 0.002, rng.pick([-1, 1]) * rng.range(4.8, 6.8), rng.range(1.5, 3.5), { opacity: rng.range(0.25, 0.5) });
  // Pigeon droppings under the arch beam and along the trench fence.
  for (let i = 0; i < 10; i++) add('droppings', rng.range(-9, 9), 0.152 * (rng.chance(0.5) ? 1 : 0) + 0.002, ARCH_Z + rng.range(-1, 1), rng.range(0.5, 0.9));
  for (let i = 0; i < 18; i++) add('droppings', rng.range(-60, 60), 0.153, TRENCH.z0 - rng.range(0.6, 1.8), rng.range(0.4, 0.8));
  // Lots registered by builders.
  for (const L of ctx.decalGround) {
    for (let i = 0; i < L.n; i++) add(rng.pick(L.kinds), rng.range(L.x0 + 1, L.x1 - 1), (L.y ?? 0.15) + 0.003, rng.range(L.z0 + 1, L.z1 - 1), rng.range(0.8, 2.2));
  }
  // Walls registered by builders: graffiti, posters, streaks, grime.
  for (const W of ctx.decalWalls) {
    for (let i = 0; i < W.n; i++) {
      const kind = rng.pick(W.kinds);
      const size = kind === 'graffiti' ? rng.range(1.4, 2.4) : kind === 'poster' ? rng.range(0.6, 0.85) : rng.range(1.2, 2.2);
      const x = rng.range(W.x0 + size / 2, W.x1 - size / 2);
      const y = kind === 'graffiti' ? rng.range(W.y0 + size * 0.3, Math.max(W.y0 + size * 0.3, W.y1 - size * 0.35)) : kind === 'streak' ? W.y1 - size * 0.4 : rng.range(W.y0 + size / 2, W.y1 - size / 2);
      const p = new THREE.Vector3(x, y, W.z ?? 0.05).applyMatrix4(W.frame.matrix);
      addDecal(group, kind, { position: p, normal: W.frame.normal, size: kind === 'poster' ? [size, size] : size, rotation: kind === 'graffiti' ? rng.range(-0.08, 0.08) : kind === 'streak' ? Math.PI : rng.range(-0.06, 0.06), seed: rng.next(), opacity: rng.range(0.65, 1) });
    }
  }
}

// ---- Neon buzz -------------------------------------------------------------------------------

// A few positional 'neon.buzz' loops follow the nearest lit neon signs at night. Only runs once
// audio is unlocked and the sound exists (the audio module defines it), so nothing warns early.
class NeonBuzz {
  constructor(lights) {
    this.sources = lights.filter((l) => l.kind === 'neon' && l.pos.y < 14);
    this.handles = [];
    this.t = 0;
  }

  update(dt, viewer, night) {
    this.t += dt;
    if (this.t < 0.5) return;
    this.t = 0;
    const ok = audio.unlocked && audio.generators?.has?.('neon.buzz') && night > 0.2;
    if (!ok) {
      if (this.handles.length) this.dispose();
      return;
    }
    const near = this.sources
      .map((s) => ({ s, d: s.pos.distanceTo(viewer) }))
      .filter((x) => x.d < 14)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    // Reuse handles: retarget to the nearest sources.
    while (this.handles.length < near.length) {
      const h = audio.play('neon.buzz', { loop: true, gain: 0, position: near[this.handles.length].s.pos, refDistance: 1.5, rolloff: 1.6, maxDistance: 18, bus: 'ambience', reverb: 0.2, rate: 0.95 + Math.random() * 0.1 });
      if (!h) break;
      this.handles.push(h);
    }
    this.handles.forEach((h, i) => {
      const n = near[i];
      if (!n) {
        h.setGain?.(0, 0.3);
        return;
      }
      h.setPosition?.(n.s.pos);
      h.setGain?.(0.22 * night, 0.3);
    });
  }

  dispose() {
    for (const h of this.handles) h.stop?.(0.2);
    this.handles.length = 0;
  }
}
