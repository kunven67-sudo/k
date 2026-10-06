// Background city: everything behind the street frontage and out to the horizon.
//
// Inside the slice's bounds: mid-rise blocks downtown and small gable-roofed houses behind the
// motel strip (the real 4th St neighbourhood), visible between buildings and down side lots.
// Outside: a ring of low commercial / residential blocks with lit windows out to ~800 m and a few
// distant resort towers on the skyline, all merged into a handful of never-culled draw calls
// (fog does the rest). Nothing here is reachable, so there are no colliders except at the edges
// of the walkable area.

import * as THREE from 'three';
import { buildingMats } from '../shared/buildings.js';
import { towerFacadeMat } from '../shared/facade.js';
import { tinted } from '../shared/batch.js';
import { litFaceMat } from '../shared/letters.js';
import { BulbSet } from '../shared/signs.js';
import { RESERVED } from './layout.js';
import { Rng } from '../../core/rng.js';

const Y0 = 0.15;

export function buildFiller(ctx) {
  const rng = new Rng('filler');
  const BM = buildingMats();
  const office = towerFacadeMat({ wall: tinted(BM.stucco), cell: [3.2, 3.3], win: [1.5, 1.8], y0: Y0 + 3.4, y1: 999, style: 'office', glass: 0x56636c, frame: 0x4a4a46, seed: 81, litMul: 0.7 });
  const rooms = towerFacadeMat({ wall: tinted(BM.stucco), cell: [3.0, 3.0], win: [1.3, 1.5], y0: Y0 + 1.0, y1: 999, style: 'room', glass: 0x5d6a72, frame: 0xe0dacb, seed: 82, litMul: 0.8 });
  const brick = towerFacadeMat({ wall: tinted(BM.brick), cell: [3.0, 3.2], win: [1.3, 1.8], y0: Y0 + 3.6, y1: 999, style: 'room', glass: 0x5d6a72, frame: 0xd8d0c0, seed: 83 });
  const mats = [office, rooms, brick];
  const tints = [0xd8cdb8, 0xc9b9a0, 0xe0d8c8, 0xb8a890, 0xcfc4ae, 0xd9c2a8, 0xa89c88];

  const block = (x0, x1, z0, z1, h, chunk = 'landmark') => {
    const m = rng.pick(mats);
    ctx.batch.add(new THREE.BoxGeometry(x1 - x0, h, z1 - z0).translate((x0 + x1) / 2, Y0 + h / 2, (z0 + z1) / 2), m, { tint: m === brick ? 0xb8786a : rng.pick(tints), chunk, grime: 0.4, grimeBase: Y0 });
    ctx.batch.add(new THREE.BoxGeometry(x1 - x0 + 0.3, 0.3, z1 - z0 + 0.3).translate((x0 + x1) / 2, Y0 + h + 0.15, (z0 + z1) / 2), BM.metal, { tint: 0x8a8a84, chunk });
  };

  // ---- Inside the bounds -------------------------------------------------------------------
  const avoid = (x0, x1, z0, z1) => {
    const S = RESERVED.starlite;
    return x1 > S.x0 - 1 && x0 < S.x1 + 1 && z1 > S.z0 - 1 && z0 < S.z1 + 1;
  };
  // Houses behind the strip (north and south).
  for (const [x0, x1, z0, z1] of [[110, 298, -232, -64], [110, 298, 64, 120], [152, 298, 120, 122]]) {
    for (let x = x0 + 2; x < x1 - 10; x += rng.range(13, 17)) {
      for (let z = z0 + 2; z < z1 - 10; z += rng.range(15, 19)) {
        if (avoid(x, x + 10, z, z + 12)) continue;
        if (rng.chance(0.12)) continue; // empty lot
        house(ctx, x + rng.range(0, 2), z + rng.range(0, 3), rng);
      }
    }
  }
  // Downtown mid-rise fill.
  for (const [x0, x1, z0, z1, hMin, hMax] of [
    [-150, -72, 138, 182, 8, 26], [72, 298, 138, 182, 6, 18], [11, 90, -235, -130, 8, 30], [-150, -113, -108, -14, 10, 24], [94, 108, -232, -80, 6, 12], [94, 108, 80, 102, 6, 10],
  ]) {
    for (let x = x0 + 1; x < x1 - 6; x += rng.range(16, 26)) {
      for (let z = z0 + 1; z < z1 - 6; z += rng.range(16, 24)) {
        const w = Math.min(x1 - x - 1, rng.range(10, 20));
        const d = Math.min(z1 - z - 1, rng.range(10, 18));
        block(x, x + w, z, z + d, rng.range(hMin, hMax));
      }
    }
  }

  // ---- Outer ring ----------------------------------------------------------------------------
  const cx = 60;
  const cz = -20;
  for (let i = 0; i < 520; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(280, 820);
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (x > -170 && x < 320 && z > -255 && z < 200) continue;
    const w = rng.range(14, 40);
    const d = rng.range(14, 36);
    // Taller toward downtown (west/south-west), low sprawl elsewhere.
    const core = Math.exp(-(((x + 150) / 450) ** 2) - (((z - 150) / 500) ** 2));
    const h = rng.range(5, 14) + core * rng.range(0, 40);
    block(x, x + w, z, z + d, h);
  }
  // A few distant resort towers on the skyline (south-east, like the real Reno skyline).
  const crown = new BulbSet({ radius: 0.6, pattern: 'twinkle', intensity: 5, dayIntensity: 0 });
  for (const [x, z, w, d, h, col] of [[820, 1200, 40, 26, 110, 0xff5a7a], [1100, 600, 46, 30, 95, 0x7ad0ff], [-500, 1350, 34, 24, 80, 0xffd06a]]) {
    ctx.batch.add(new THREE.BoxGeometry(w, h, d).translate(x, h / 2, z), office, { tint: 0xd8d0c4, chunk: 'landmark' });
    ctx.batch.add(new THREE.BoxGeometry(w + 2, 5, d + 2).translate(x, h + 2.5, z), litFaceMat(col, { k: 2.2, dayColor: 0x9a9a96, pulse: false }), { chunk: 'landmark' });
    for (let k = 0; k < 24; k++) crown.add([x - w / 2 + (w * k) / 23, h + 5.4, z - d / 2 - 1], k, col);
  }
  ctx.extraMeshes.push(crown.build('skyline-crowns'));
}

let roofMat = null;
function house(ctx, x, z, rng) {
  const BM = buildingMats();
  const w = rng.range(8, 10);
  const d = rng.range(9, 12);
  const h = rng.range(2.8, 3.2);
  const tint = rng.pick([0xd9cbb0, 0xb9c6c0, 0xe0d2c0, 0xc8b49c, 0xa8b8c8, 0xd8c0b0]);
  const facadeM = houseMat();
  ctx.batch.add(new THREE.BoxGeometry(w, h, d).translate(x + w / 2, Y0 + h / 2, z + d / 2), facadeM, { tint, chunk: 'landmark', grime: 0.4, grimeBase: Y0 });
  const rise = rng.range(1.4, 2.2);
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.4, 0), new THREE.Vector2(w / 2 + 0.4, 0), new THREE.Vector2(0, rise)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false }).translate(x + w / 2, Y0 + h, z - 0.3);
  if (!roofMat) roofMat = BM.roof;
  ctx.batch.add(g, roofMat, { tint: rng.pick([0x5a4a3e, 0x4a4a4c, 0x6a4a3a, 0x3e3a36]), chunk: 'landmark', uv: 1.2 });
}

let hm = null;
function houseMat() {
  if (!hm) hm = towerFacadeMat({ wall: tinted(buildingMats().stucco), cell: [3.6, 3.2], win: [1.4, 1.1], y0: Y0 + 0.9, y1: Y0 + 2.4, style: 'room', glass: 0x5d6a72, frame: 0xf0ece0, seed: 84, litMul: 1.2 });
  return hm;
}
