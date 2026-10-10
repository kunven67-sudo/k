// Procedural trees: real branching (trunk -> limbs -> branches -> twigs), leaf clusters
// at the tips, bark with deep furrows (oak) or smooth plates (maple) or white bark (birch).
// Fall colors come from the real date: maples go yellow -> orange -> red and drop,
// oaks turn russet-brown later and hang on to some leaves into winter.
// Near trees are full detail, middle ones simpler, far ones are pictures (impostors).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, lerp, clamp, smoothstep } from '../core/noise.js';
import { makeBarkTexture, makeLeafTexture } from './textures.js';
import { WORLD_SIZE, HALF, heightAt, waterAt } from './terrainGen.js';

const SPECIES = {
  oak: {
    height: [13, 19], trunkR: [0.34, 0.52], trunkFrac: 0.42, firstBranch: [3.0, 4.2],
    limbCount: [5, 7], limbAngle: [52, 74], childAngle: [35, 60], ratio: 0.62,
    upward: 0.05, gnarl: 0.55, leafCard: [1.5, 2.1], leafStep: 0.55,
    // fall: turns later, ends russet/brown, keeps some leaves
    turn: [282, 12], turnDays: 46, maxDrop: 0.72,
  },
  maple: {
    height: [15, 21], trunkR: [0.27, 0.4], trunkFrac: 0.82, firstBranch: [3.4, 5.0],
    limbCount: [6, 9], limbAngle: [30, 46], childAngle: [30, 48], ratio: 0.58,
    upward: 0.3, gnarl: 0.22, leafCard: [1.4, 1.9], leafStep: 0.5,
    turn: [266, 12], turnDays: 38, maxDrop: 1,
  },
  birch: {
    height: [11, 16], trunkR: [0.13, 0.2], trunkFrac: 0.9, firstBranch: [3.0, 4.2],
    limbCount: [7, 10], limbAngle: [26, 40], childAngle: [28, 44], ratio: 0.5,
    upward: 0.4, gnarl: 0.15, leafCard: [0.95, 1.3], leafStep: 0.42,
    turn: [268, 10], turnDays: 30, maxDrop: 1,
  },
};
const SPECIES_LIST = ['oak', 'maple', 'birch'];
const VARIANTS = { oak: 3, maple: 3, birch: 2 };

const LOD0 = 110, LOD1 = 430;

export class Trees {
  constructor({ gen, renderer, RAPIER, physicsWorld, clock }) {
    this.gen = gen;
    this.clock = clock;
    this.group = new THREE.Group();
    this.group.name = 'trees';
    this.time = 0;
    this.wind = 0.6;

    this.textures = {};
    this.materials = {};
    for (const sp of SPECIES_LIST) {
      const bark = makeBarkTexture(sp, gen.seed);
      const leaf = makeLeafTexture(sp, gen.seed);
      this.textures[sp] = { bark, leaf };
      this.materials[sp] = {
        bark: makeBarkMaterial(bark, this),
        leaf: makeLeafMaterial(leaf, sp, this),
        leafDepth: makeLeafDepthMaterial(leaf, this),
      };
    }

    // Build model variants
    this.models = [];
    let seed = gen.seed * 13 + 5;
    for (const sp of SPECIES_LIST) {
      for (let v = 0; v < VARIANTS[sp]; v++) this.models.push(buildTreeModel(sp, mulberry32(seed++)));
    }

    this.place();
    this.buildInstances(renderer);
    if (RAPIER && physicsWorld) this.buildColliders(RAPIER, physicsWorld);
    this.updateSeason(true);
    this.lastCam = new THREE.Vector3(1e9, 0, 0);
  }

  place() {
    const { maps, mapsRes, H, W, spawn, seed } = this.gen;
    const rand = mulberry32(seed ^ 0xabcdef);
    const spacing = 8.5;
    const cells = Math.floor(WORLD_SIZE / spacing);
    const list = [];
    for (let cz = 0; cz < cells; cz++) {
      for (let cx = 0; cx < cells; cx++) {
        const x = -HALF + (cx + 0.15 + rand() * 0.7) * spacing;
        const z = -HALF + (cz + 0.15 + rand() * 0.7) * spacing;
        const mx = clamp(Math.floor((x + HALF) / WORLD_SIZE * mapsRes), 0, mapsRes - 1);
        const mz = clamp(Math.floor((z + HALF) / WORLD_SIZE * mapsRes), 0, mapsRes - 1);
        const forest = maps[(mz * mapsRes + mx) * 4] / 255;
        const lone = 0.006; // lone trees out in the meadow
        if (rand() > forest * 0.92 + lone) { rand(); rand(); continue; }
        if (Math.hypot(x - spawn.x, z - spawn.z) < 22) continue;
        const y = heightAt(H, x, z);
        if (waterAt(W, x, z) > y - 0.5) continue;
        // steepness check
        const sl = Math.abs(heightAt(H, x + 2, z) - heightAt(H, x - 2, z)) + Math.abs(heightAt(H, x, z + 2) - heightAt(H, x, z - 2));
        if (sl > 2.6) continue;
        // species: oak and maple patches, birch near water + edges
        const moist = maps[(mz * mapsRes + mx) * 4 + 1] / 255;
        const patch = Math.sin(x * 0.009 + Math.cos(z * 0.006) * 2) * 0.5 + 0.5;
        const r = rand();
        let sp;
        if (r < 0.08 + moist * 0.25) sp = 'birch';
        else sp = r < 0.2 + patch * 0.6 ? 'oak' : 'maple';
        const variants = this.models.map((m, i) => i).filter((i) => this.models[i].species === sp);
        const model = variants[Math.floor(rand() * variants.length)];
        const young = rand() < 0.16;
        const scale = young ? 0.32 + rand() * 0.3 : 0.78 + rand() * 0.38;
        list.push({ x, y: y - 0.12 * scale, z, rot: rand() * Math.PI * 2, scale, model, jitter: rand() * 2 - 1 });
      }
    }
    this.list = list;
    // per-tree transform, kept as plain numbers
    this.mats = new Float32Array(list.length * 16);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      m.compose(p.set(t.x, t.y, t.z), q, s.setScalar(t.scale));
      m.toArray(this.mats, i * 16);
    });
  }

  buildInstances(renderer) {
    const counts = this.models.map(() => 0);
    for (const t of this.list) counts[t.model]++;
    this.inst = this.models.map((model, mi) => {
      const mats = this.materials[model.species];
      const total = counts[mi];
      const mk = (geo, mat, max, shadow) => {
        const g = geo.clone();
        g.setAttribute('aLeaf', new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, max) * 2), 2));
        const im = new THREE.InstancedMesh(g, mat, Math.max(1, max));
        im.count = 0;
        im.castShadow = shadow;
        im.receiveShadow = true;
        im.frustumCulled = false;
        this.group.add(im);
        return im;
      };
      const imp = makeImpostor(renderer, model, mats);
      const out = {
        bark0: mk(model.bark0, mats.bark, Math.min(total, 900), true),
        leaf0: mk(model.leaf0, mats.leaf, Math.min(total, 900), true),
        bark1: mk(model.bark1, mats.bark, Math.min(total, 8000), false),
        leaf1: mk(model.leaf1, mats.leaf, Math.min(total, 8000), false),
        imp: mk(imp.geometry, imp.material, total, false),
        impostor: imp,
      };
      out.leaf0.customDepthMaterial = mats.leafDepth;
      return out;
    });
  }

  buildColliders(RAPIER, world) {
    const v = new THREE.Vector3(), w = new THREE.Vector3(), m = new THREE.Matrix4();
    let n = 0;
    this.list.forEach((t, i) => {
      const model = this.models[t.model];
      m.fromArray(this.mats, i * 16);
      for (const cap of model.capsules) {
        v.copy(cap.a).applyMatrix4(m);
        w.copy(cap.b).applyMatrix4(m);
        const r = cap.r * t.scale;
        if (r < 0.05) continue;
        const len = v.distanceTo(w);
        const mid = v.clone().add(w).multiplyScalar(0.5);
        const dir = w.clone().sub(v).normalize();
        const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const desc = RAPIER.ColliderDesc.capsule(Math.max(0.01, len / 2), r)
          .setTranslation(mid.x, mid.y, mid.z)
          .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
          .setFriction(0.8);
        const c = world.createCollider(desc);
        c.userData = { surface: 'wood', kind: 'tree' };
        n++;
      }
    });
    this.colliderCount = n;
  }

  // Leaf colors + how many leaves have fallen, from the real date.
  updateSeason(force = false) {
    const doy = this.clock.dayOfYear() + this.clock.local().hours / 24;
    if (!force && Math.abs(doy - (this.lastDoy ?? -99)) < 0.25) return;
    this.lastDoy = doy;
    this.leafState = this.list.map((t) => leafState(this.models[t.model].species, doy, t.jitter));
    this.lastCam?.set(1e9, 0, 0); // force instance refresh
    for (const sp of SPECIES_LIST) {
      const avg = leafState(sp, doy, 0);
      this.materials[sp].leaf.userData.uniforms.uImpProg.value = avg[0];
    }
    this.impostorsDirty = true;
  }

  update(dt, camera, renderer) {
    this.time += dt;
    for (const sp of SPECIES_LIST) {
      for (const k of ['bark', 'leaf', 'leafDepth']) {
        const u = this.materials[sp][k].userData.uniforms;
        u.uTime.value = this.time;
        u.uWind.value = this.wind;
      }
    }
    this.updateSeason();
    if (this.impostorsDirty && renderer) {
      this.impostorsDirty = false;
      for (const inst of this.inst) inst.impostor.recapture(renderer);
    }
    const cp = camera.position;
    if (this.lastCam.distanceToSquared(cp) < 36) return;
    this.lastCam.copy(cp);
    const fill = this.inst.map(() => ({ b0: 0, b1: 0, i: 0 }));
    const far2 = 1700 * 1700, l0 = LOD0 * LOD0, l1 = LOD1 * LOD1;
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const dx = t.x - cp.x, dz = t.z - cp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > far2) continue;
      const inst = this.inst[t.model];
      const f = fill[t.model];
      const ls = this.leafState[i];
      if (d2 < l0 && f.b0 < inst.bark0.instanceMatrix.count) {
        writeInstance(inst.bark0, f.b0, this.mats, i, ls);
        writeInstance(inst.leaf0, f.b0, this.mats, i, ls);
        f.b0++;
      } else if (d2 < l1 && f.b1 < inst.bark1.instanceMatrix.count) {
        writeInstance(inst.bark1, f.b1, this.mats, i, ls);
        writeInstance(inst.leaf1, f.b1, this.mats, i, ls);
        f.b1++;
      } else {
        writeInstance(inst.imp, f.i, this.mats, i, ls);
        f.i++;
      }
    }
    this.inst.forEach((inst, k) => {
      const f = fill[k];
      for (const [im, c] of [[inst.bark0, f.b0], [inst.leaf0, f.b0], [inst.bark1, f.b1], [inst.leaf1, f.b1], [inst.imp, f.i]]) {
        im.count = c;
        im.instanceMatrix.needsUpdate = true;
        im.geometry.attributes.aLeaf.needsUpdate = true;
      }
    });
  }

  // nearest tree trunk (for sounds etc.)
  countNear(x, z, r) {
    let n = 0;
    const r2 = r * r;
    for (const t of this.list) if ((t.x - x) ** 2 + (t.z - z) ** 2 < r2) n++;
    return n;
  }
}

function writeInstance(im, slot, mats, i, ls) {
  im.instanceMatrix.array.set(mats.subarray(i * 16, i * 16 + 16), slot * 16);
  const a = im.geometry.attributes.aLeaf.array;
  a[slot * 2] = ls[0];
  a[slot * 2 + 1] = ls[1];
}

// [progress (-0.3 spring buds .. 0 summer green .. 1 fully turned), dropped fraction 0..1]
function leafState(species, doy, jitter) {
  const s = SPECIES[species];
  const start = s.turn[0] + jitter * s.turn[1];
  const leafOut = 105 + jitter * 6;     // mid-April buds
  const fullLeaf = leafOut + 28;
  if (doy < leafOut - 1 && doy > 30) return [1, s.maxDrop >= 1 ? 1 : 0.85];        // late winter, bare
  if (doy <= 30) return [1, s.maxDrop >= 1 ? 1 : 0.8];
  if (doy < fullLeaf) {
    const t = (doy - leafOut) / (fullLeaf - leafOut);
    return [-0.3 * (1 - t), 1 - smoothstep(0, 0.7, t)];
  }
  if (doy < start) return [0, 0];
  const p = clamp((doy - start) / s.turnDays, 0, 1);
  const drop = smoothstep(0.62, 1.0, p) * s.maxDrop + (doy > start + s.turnDays + 25 ? (s.maxDrop >= 1 ? 1 : 0.1) : 0);
  return [p, clamp(drop, 0, 1)];
}

// ---------------- Tree model generation ----------------

function buildTreeModel(species, rand) {
  const sp = SPECIES[species];
  const H = lerp(sp.height[0], sp.height[1], rand());
  const R0 = lerp(sp.trunkR[0], sp.trunkR[1], rand());
  const branches = [];
  const leaves = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();
  const firstBranch = lerp(sp.firstBranch[0], sp.firstBranch[1], rand());

  const grow = (origin, dir, length, r0, level, maxLevel) => {
    const segs = level === 0 ? 12 : level === 1 ? 8 : level === 2 ? 5 : 3;
    const pts = [origin.clone()];
    const radii = [];
    const d = dir.clone();
    let p = origin.clone();
    const bendSeed = rand() * 100;
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      // gnarl (wander), reach for light (up), and heavy branches sag a little
      tmp.set(Math.sin(bendSeed + s * 1.7), Math.sin(bendSeed * 0.7 + s * 2.3) * 0.4, Math.cos(bendSeed * 1.3 + s * 1.1));
      d.addScaledVector(tmp, sp.gnarl * 0.09 * (level + 0.6));
      if (level > 0) d.addScaledVector(up, sp.upward * 0.07);
      if (level >= 1) d.y -= 0.025 * level * t;
      d.normalize();
      p = p.clone().addScaledVector(d, length / segs);
      pts.push(p);
    }
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      let r = r0 * (1 - t * (level === 0 ? 0.62 : 0.78));
      if (level === 0) r *= 1 + 0.75 * Math.exp(-(t * length) / 0.55); // root flare
      radii.push(Math.max(r, 0.012));
    }
    const br = { pts, radii, level, length };
    branches.push(br);

    if (level < maxLevel) {
      const isTrunk = level === 0;
      const count = isTrunk ? Math.round(lerp(sp.limbCount[0], sp.limbCount[1], rand()))
        : level === 1 ? 4 + Math.floor(rand() * 3) : 3 + Math.floor(rand() * 2);
      const t0 = isTrunk ? clamp(firstBranch / length, 0.2, 0.85) : 0.22;
      for (let c = 0; c < count; c++) {
        const t = lerp(t0, 0.97, (c + 0.3 + rand() * 0.4) / count);
        const at = pointAt(br, t);
        const pdir = dirAt(br, t);
        const az = c * 2.39996 + rand() * 0.6; // golden angle spread
        const angle = (isTrunk ? lerp(sp.limbAngle[0], sp.limbAngle[1], rand()) : lerp(sp.childAngle[0], sp.childAngle[1], rand())) * Math.PI / 180;
        const ndir = rotateAway(pdir, angle, az);
        let len;
        if (isTrunk) {
          const remain = H - at.y;
          len = Math.max(2, remain * (species === 'oak' ? 0.95 : 0.62) * (1.05 - 0.55 * (t - t0)) * (0.8 + rand() * 0.35));
        } else len = length * sp.ratio * (1 - 0.35 * t) * (0.75 + rand() * 0.45);
        const rr = radiusAt(br, t) * (isTrunk ? 0.62 : 0.6);
        grow(at, ndir, len, rr, level + 1, maxLevel);
      }
    }
    // leaves on the outer branches
    if (level >= maxLevel - 1) {
      const startT = level === maxLevel ? 0.25 : 0.65;
      for (let t = startT; t <= 1.0001; t += sp.leafStep / Math.max(length, 0.5)) {
        const at = pointAt(br, Math.min(t, 1));
        leaves.push(at.add(new THREE.Vector3((rand() - 0.5) * 0.7, (rand() - 0.3) * 0.6, (rand() - 0.5) * 0.7)));
      }
    }
  };

  const trunkLen = H * sp.trunkFrac;
  const lean = new THREE.Vector3((rand() - 0.5) * 0.12, 1, (rand() - 0.5) * 0.12).normalize();
  grow(new THREE.Vector3(0, -0.3, 0), lean, trunkLen + 0.3, R0, 0, 3);

  // crown center -> leaf card normals point outward (gives the crown a round, lit shape)
  const center = new THREE.Vector3();
  for (const l of leaves) center.add(l);
  center.divideScalar(Math.max(leaves.length, 1));
  center.y -= H * 0.08;

  const bark0 = mergeGeometries(branches.map((b) => tube(b, b.level === 0 ? 12 : b.level === 1 ? 8 : b.level === 2 ? 5 : 4)));
  const bark1 = mergeGeometries(branches.filter((b) => b.level <= 1).map((b) => tube(b, b.level === 0 ? 7 : 4, 2)));
  const leaf0 = leafCards(leaves, center, sp.leafCard, rand, 1, 1);
  const leaf1 = leafCards(leaves.filter((_, i) => i % 4 === 0), center, sp.leafCard, rand, 1.85, 1);

  // Collision capsules: the trunk up to the first limb, plus any limb part low enough to walk into.
  const capsules = [];
  const trunk = branches[0];
  const fb = Math.min(firstBranch + 0.6, trunk.pts[trunk.pts.length - 1].y);
  capsules.push({ a: new THREE.Vector3(trunk.pts[0].x, 0.0, trunk.pts[0].z), b: pointAt(trunk, clamp(fb / trunk.length, 0, 1)), r: radiusAt(trunk, 1.0 / trunk.length) * 1.0 });
  // the wide root flare at the bottom
  capsules.push({ a: new THREE.Vector3(trunk.pts[0].x, 0.0, trunk.pts[0].z), b: pointAt(trunk, clamp(0.55 / trunk.length, 0, 1)), r: radiusAt(trunk, 0.3 / trunk.length) * 0.9 });
  for (const b of branches) {
    if (b.level !== 1) continue;
    for (let s = 0; s < b.pts.length - 1; s++) {
      const a = b.pts[s], c = b.pts[s + 1];
      if (Math.min(a.y, c.y) < 3.4 && b.radii[s] > 0.06) capsules.push({ a: a.clone(), b: c.clone(), r: b.radii[s] * 0.9 });
    }
  }
  let crownR = 0;
  for (const l of leaves) crownR = Math.max(crownR, Math.hypot(l.x, l.z));
  return { species, height: H, bark0, bark1, leaf0, leaf1, capsules, crownR: crownR + 1, trunkR: R0 };
}

function pointAt(br, t) {
  const f = t * (br.pts.length - 1);
  const i = Math.min(Math.floor(f), br.pts.length - 2);
  return br.pts[i].clone().lerp(br.pts[i + 1], f - i);
}
function dirAt(br, t) {
  const f = t * (br.pts.length - 1);
  const i = Math.min(Math.floor(f), br.pts.length - 2);
  return br.pts[i + 1].clone().sub(br.pts[i]).normalize();
}
function radiusAt(br, t) {
  const f = clamp(t, 0, 1) * (br.radii.length - 1);
  const i = Math.min(Math.floor(f), br.radii.length - 2);
  return lerp(br.radii[i], br.radii[i + 1], f - i);
}
function rotateAway(dir, angle, azimuth) {
  // a vector perpendicular to dir, spun around dir by azimuth
  const a = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const perp = new THREE.Vector3().crossVectors(dir, a).normalize();
  perp.applyAxisAngle(dir, azimuth);
  return dir.clone().multiplyScalar(Math.cos(angle)).addScaledVector(perp, Math.sin(angle)).normalize();
}

function tube(br, radial, step = 1) {
  const pts = br.pts.filter((_, i) => i % step === 0 || i === br.pts.length - 1);
  const radii = br.radii.filter((_, i) => i % step === 0 || i === br.radii.length - 1);
  const rings = pts.length;
  const pos = [], nrm = [], uv = [], idx = [];
  let prevN = null;
  let along = 0;
  const circ = 2 * Math.PI * radii[0];
  const uRepeat = Math.max(1, Math.round(circ / 0.8));
  for (let r = 0; r < rings; r++) {
    const p = pts[r];
    const t = r < rings - 1 ? pts[r + 1].clone().sub(p) : p.clone().sub(pts[r - 1]);
    if (r > 0) along += p.distanceTo(pts[r - 1]);
    t.normalize();
    // parallel-transport frame (no twisting)
    let n;
    if (!prevN) {
      const a = Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      n = new THREE.Vector3().crossVectors(t, a).normalize();
    } else {
      n = prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))).normalize();
    }
    prevN = n;
    const b = new THREE.Vector3().crossVectors(t, n);
    for (let k = 0; k <= radial; k++) {
      const ang = (k / radial) * Math.PI * 2;
      const dir = n.clone().multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
      const rad = radii[r] * (1 + (br.level === 0 && r < 2 ? 0.08 * Math.sin(ang * 5) : 0)); // root buttresses
      pos.push(p.x + dir.x * rad, p.y + dir.y * rad, p.z + dir.z * rad);
      nrm.push(dir.x, dir.y, dir.z);
      uv.push((k / radial) * uRepeat, along / 1.6);
    }
  }
  for (let r = 0; r < rings - 1; r++) {
    for (let k = 0; k < radial; k++) {
      const a = r * (radial + 1) + k, b = a + radial + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function leafCards(points, center, sizeRange, rand, sizeMul, keep) {
  const pos = [], nrm = [], uv = [], idx = [];
  const tmpU = new THREE.Vector3(), tmpV = new THREE.Vector3();
  let v = 0;
  for (const p of points) {
    if (rand() > keep) continue;
    const s = lerp(sizeRange[0], sizeRange[1], rand()) * sizeMul;
    const out = p.clone().sub(center);
    out.y *= 0.7;
    out.normalize();
    // card faces mostly outward, randomly twisted
    const facing = out.clone().add(new THREE.Vector3(rand() - 0.5, rand() - 0.3, rand() - 0.5).multiplyScalar(1.4)).normalize();
    const a = Math.abs(facing.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    tmpU.crossVectors(facing, a).normalize();
    tmpV.crossVectors(facing, tmpU).normalize();
    const spin = rand() * Math.PI * 2;
    const U = tmpU.clone().multiplyScalar(Math.cos(spin)).addScaledVector(tmpV, Math.sin(spin)).multiplyScalar(s / 2);
    const V = tmpV.clone().multiplyScalar(Math.cos(spin)).addScaledVector(tmpU, -Math.sin(spin)).multiplyScalar(s / 2);
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    for (const [cu, cv, tu, tv] of corners) {
      pos.push(p.x + U.x * cu + V.x * cv, p.y + U.y * cu + V.y * cv, p.z + U.z * cu + V.z * cv);
      // normals: outward from the crown, bent slightly per corner so light wraps around
      const nn = out.clone().addScaledVector(U, cu * 0.15).addScaledVector(V, cv * 0.15).normalize();
      nrm.push(nn.x, nn.y, nn.z);
      uv.push(tu, tv);
    }
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ---------------- Materials ----------------

const WIND_GLSL = `
  uniform float uTime;
  uniform float uWind;
  vec3 treeWind(vec3 p, mat4 im, float leafy) {
    vec3 base = im[3].xyz;
    float phase = base.x * 0.13 + base.z * 0.07;
    float h = max(p.y, 0.0);
    float bend = pow(h / 20.0, 2.0) * uWind * 0.6;
    vec3 worldWind = vec3(1.0, 0.0, 0.35);
    float sway = sin(uTime * 0.9 + phase) * 0.35 + sin(uTime * 2.1 + phase * 1.7) * 0.12 + 0.25;
    vec3 off = worldWind * bend * sway;
    off += leafy * uWind * 0.04 * vec3(sin(uTime * 6.0 + p.x * 3.1 + phase), sin(uTime * 7.3 + p.y * 2.3), cos(uTime * 5.5 + p.z * 2.7));
    // world offset -> this instance's local space
    mat3 r = mat3(im);
    float s2 = dot(r[0], r[0]);
    return p + (transpose(r) * off) / s2;
  }
`;

function makeBarkMaterial(tex, owner) {
  const mat = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap, roughness: 0.95, metalness: 0, normalScale: new THREE.Vector2(1.2, 1.2) });
  mat.userData.uniforms = { uTime: { value: 0 }, uWind: { value: 0.6 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + WIND_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed = treeWind(transformed, instanceMatrix, 0.0);\n#endif');
  };
  mat.customProgramCacheKey = () => 'riftlab-bark';
  return mat;
}

const PALETTES = {
  // stops from summer green (0) to fully turned (1); spring buds use the negative range
  maple: [[-0.3, [0.55, 0.62, 0.22]], [0, [0.16, 0.32, 0.07]], [0.3, [0.45, 0.5, 0.1]], [0.48, [0.86, 0.62, 0.08]], [0.64, [0.9, 0.36, 0.05]], [0.8, [0.66, 0.08, 0.04]], [1, [0.42, 0.16, 0.06]]],
  oak: [[-0.3, [0.5, 0.55, 0.2]], [0, [0.14, 0.27, 0.07]], [0.4, [0.3, 0.34, 0.1]], [0.65, [0.52, 0.3, 0.09]], [0.85, [0.5, 0.22, 0.08]], [1, [0.38, 0.24, 0.12]]],
  birch: [[-0.3, [0.62, 0.7, 0.25]], [0, [0.22, 0.4, 0.1]], [0.4, [0.55, 0.6, 0.12]], [0.65, [0.92, 0.78, 0.15]], [1, [0.62, 0.48, 0.15]]],
};

function paletteGLSL(species) {
  const stops = PALETTES[species];
  let s = 'vec3 leafPalette(float p) {\n';
  const lin = (c) => c.map((v) => Math.pow(v, 2.2).toFixed(4)).join(', ');
  s += `  vec3 c = vec3(${lin(stops[0][1])});\n`;
  for (let i = 1; i < stops.length; i++) {
    s += `  c = mix(c, vec3(${lin(stops[i][1])}), smoothstep(${stops[i - 1][0].toFixed(3)}, ${stops[i][0].toFixed(3)}, p));\n`;
  }
  return s + '  return c;\n}\n';
}

function makeLeafMaterial(tex, species, owner) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.72, metalness: 0, alphaToCoverage: true });
  mat.userData.uniforms = { uTime: { value: 0 }, uWind: { value: 0.6 }, uImpProg: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aLeaf;\nvarying vec2 vLeaf;\n' + WIND_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeaf = aLeaf;\n#ifdef USE_INSTANCING\ntransformed = treeWind(transformed, instanceMatrix, 1.0);\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLeaf;\n' + paletteGLSL(species))
      .replace('#include <map_fragment>', `
        vec4 lt = texture2D(map, vMapUv);
        if (lt.g < vLeaf.y * 0.999 && lt.a > 0.5) discard; // this leaf already fell
        float lp = clamp(vLeaf.x + (lt.g - 0.5) * 0.35, -0.3, 1.0);
        vec3 lc = leafPalette(lp);
        lc *= (0.5 + 0.62 * lt.r) * mix(0.78, 1.0, lt.b);
        diffuseColor.rgb *= lc;
        // far away the texture's smaller mip levels blur the alpha; boost it so leaves don't vanish
        vec2 tsz = vMapUv * 512.0;
        float mip = max(0.0, 0.5 * log2(max(dot(dFdx(tsz), dFdx(tsz)), dot(dFdy(tsz), dFdy(tsz)))));
        diffuseColor.a *= lt.a * (1.0 + mip * 0.32);
      `);
  };
  mat.customProgramCacheKey = () => 'riftlab-leaf-' + species;
  return mat;
}

function makeLeafDepthMaterial(tex, owner) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  mat.userData.uniforms = { uTime: { value: 0 }, uWind: { value: 0.6 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aLeaf;\nvarying vec2 vLeaf;\n' + WIND_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeaf = aLeaf;\n#ifdef USE_INSTANCING\ntransformed = treeWind(transformed, instanceMatrix, 1.0);\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLeaf;')
      .replace('#include <map_fragment>', `
        vec4 lt = texture2D(map, vMapUv);
        if (lt.g < vLeaf.y * 0.999) discard;
        vec2 tsz = vMapUv * 512.0;
        float mip = max(0.0, 0.5 * log2(max(dot(dFdx(tsz), dFdx(tsz)), dot(dFdy(tsz), dFdy(tsz)))));
        diffuseColor.a *= lt.a * (1.0 + mip * 0.32);
      `);
  };
  mat.customProgramCacheKey = () => 'riftlab-leafdepth';
  return mat;
}

// ---------------- Far trees: pictures of the real model ----------------

function makeImpostor(renderer, model, mats) {
  const W = 256, Hh = 512;
  const rt = new THREE.WebGLRenderTarget(W, Hh, { samples: 0 });
  rt.texture.generateMipmaps = true;
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  const width = model.crownR * 2.1;
  const height = model.height * 1.06;
  // two crossed quads
  const g1 = new THREE.PlaneGeometry(width, height);
  g1.translate(0, height / 2 - 0.3, 0);
  const g2 = g1.clone().rotateY(Math.PI / 2);
  const geo = mergeGeometries([g1, g2]);
  // normals point up-and-out so they light like a crown, not a flat board
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.5, 0.85, n.getZ(i) * 0.5);
  const material = new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, alphaToCoverage: true });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec2 tsz = vMapUv * vec2(256.0, 512.0);
      float mip = max(0.0, 0.5 * log2(max(dot(dFdx(tsz), dFdx(tsz)), dot(dFdy(tsz), dFdy(tsz)))));
      diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + mip * 0.35));`);
  };
  material.customProgramCacheKey = () => 'riftlab-impostor';
  const scene = new THREE.Scene();
  const bark = new THREE.Mesh(model.bark1, new THREE.MeshBasicMaterial({ map: mats.bark.map }));
  const leafMat = mats.leaf.clone();
  leafMat.onBeforeCompile = mats.leaf.onBeforeCompile;
  leafMat.userData = mats.leaf.userData;
  const leafGeo = model.leaf1.clone();
  const leafCount = leafGeo.attributes.position.count;
  const aLeaf = new Float32Array(leafCount * 2);
  leafGeo.setAttribute('aLeaf', new THREE.BufferAttribute(aLeaf, 2));
  const leaves = new THREE.Mesh(leafGeo, leafMat);
  scene.add(bark, leaves);
  // ambient of PI = the picture stores plain surface color; the game lights it like everything else
  scene.add(new THREE.AmbientLight(0xffffff, Math.PI));
  const cam = new THREE.OrthographicCamera(-width / 2, width / 2, height - 0.3, -0.3, 0.1, 100);
  cam.position.set(0, 0, 40);
  cam.lookAt(0, 0, 0);
  const recapture = (r) => {
    // use the species' average fall state for the picture
    const prog = mats.leaf.userData.uniforms.uImpProg.value;
    for (let i = 0; i < leafCount; i++) { aLeaf[i * 2] = prog; aLeaf[i * 2 + 1] = 0; }
    leafGeo.attributes.aLeaf.needsUpdate = true;
    const prevTarget = r.getRenderTarget();
    const prevTone = r.toneMapping, prevClear = r.getClearAlpha(), prevCol = r.getClearColor(new THREE.Color());
    r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(rt);
    r.setClearColor(0x445530, 0);
    r.clear();
    r.render(scene, cam);
    r.setRenderTarget(prevTarget);
    r.toneMapping = prevTone;
    r.setClearColor(prevCol, prevClear);
  };
  return { geometry: geo, material, recapture };
}
