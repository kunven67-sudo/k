// Boulders, rocks, fallen logs and stumps. Rocks are kept "convex-ish" so the physics
// shape (a convex hull of the same points) matches what you see. Logs are cylinders,
// physics cylinders. Nothing is random-for-no-reason: logs lie in the forest where
// trees fall, boulders sit where the ground is steep and rocky.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Simplex, mulberry32, clamp } from '../core/noise.js';
import { WORLD_SIZE, HALF, heightAt, waterAt } from './terrainGen.js';
import { makeBarkTexture } from './textures.js';

function rockGeometry(seed) {
  const n = new Simplex(seed);
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const sx = 0.8 + (seed % 7) * 0.08, sy = 0.45 + (seed % 5) * 0.08, sz = 0.75 + (seed % 3) * 0.12;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // low-frequency lumps keep it convex-ish; facets like real broken rock
    const d = 1 + 0.16 * n.fbm(v.x * 1.3 + seed, v.z * 1.3 + v.y, 3) + 0.05 * n.noise(v.x * 5, v.y * 5 + v.z);
    v.multiplyScalar(d);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.35; // flat-ish bottom sitting in the dirt
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function rockMaterial(textures) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tAlbedo = { value: textures.albedo };
    shader.uniforms.tNormal = { value: textures.normal };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRW;\nvarying vec3 vRN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vRW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
          vRN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vRW = (modelMatrix * vec4(position, 1.0)).xyz;
          vRN = normalize(mat3(modelMatrix) * normal);
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nprecision highp sampler2DArray;\nuniform sampler2DArray tAlbedo;\nuniform sampler2DArray tNormal;\nvarying vec3 vRW;\nvarying vec3 vRN;')
      .replace('#include <map_fragment>', `
        vec3 bw = pow(abs(normalize(vRN)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 rc = texture(tAlbedo, vec3(vRW.zy / 3.0, 3.0)).rgb * bw.x + texture(tAlbedo, vec3(vRW.xz / 3.0, 3.0)).rgb * bw.y + texture(tAlbedo, vec3(vRW.xy / 3.0, 3.0)).rgb * bw.z;
        // moss + damp on top, dirt splash at the bottom
        float up = clamp(normalize(vRN).y, 0.0, 1.0);
        rc = mix(rc, vec3(0.16, 0.2, 0.08), smoothstep(0.75, 0.98, up) * 0.45);
        diffuseColor.rgb *= rc * 1.05;
      `);
  };
  mat.customProgramCacheKey = () => 'riftlab-rock';
  return mat;
}

export class Rocks {
  constructor({ gen, RAPIER, physicsWorld, terrainTextures, trees }) {
    this.gen = gen;
    this.group = new THREE.Group();
    this.group.name = 'rocks+logs';
    const rand = mulberry32(gen.seed ^ 0x51ed);
    const { H, W, maps, mapsRes, spawn } = gen;
    const mapAt = (x, z, c) => {
      const mx = clamp(Math.floor((x + HALF) / WORLD_SIZE * mapsRes), 0, mapsRes - 1);
      const mz = clamp(Math.floor((z + HALF) / WORLD_SIZE * mapsRes), 0, mapsRes - 1);
      return maps[(mz * mapsRes + mx) * 4 + c] / 255;
    };

    // ---- Rocks ----
    const VARIANTS = 6;
    this.rockGeos = [];
    for (let i = 0; i < VARIANTS; i++) this.rockGeos.push(rockGeometry(gen.seed * 3 + i * 17));
    const rmat = rockMaterial(terrainTextures);
    const rocks = [];
    for (let t = 0; t < 5200; t++) {
      const x = (rand() - 0.5) * (WORLD_SIZE - 40), z = (rand() - 0.5) * (WORLD_SIZE - 40);
      const rock = mapAt(x, z, 2), forest = mapAt(x, z, 0);
      const chance = 0.06 + rock * 0.8 + forest * 0.08;
      if (rand() > chance) continue;
      if (Math.hypot(x - spawn.x, z - spawn.z) < 10) continue;
      const y = heightAt(H, x, z);
      const inWater = waterAt(W, x, z) > y;
      const big = rand() < 0.12 + rock * 0.35;
      const size = big ? 1.1 + rand() * 2.6 : 0.3 + rand() * 0.55;
      rocks.push({ x, y, z, size, v: Math.floor(rand() * VARIANTS), rot: rand() * Math.PI * 2, tilt: (rand() - 0.5) * 0.3, inWater });
    }
    const byVar = Array.from({ length: VARIANTS }, () => []);
    rocks.forEach((r) => byVar[r.v].push(r));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    byVar.forEach((list, vi) => {
      const im = new THREE.InstancedMesh(this.rockGeos[vi], rmat, list.length);
      list.forEach((r, k) => {
        q.setFromEuler(e.set(r.tilt, r.rot, r.tilt * 0.5));
        m.compose(p.set(r.x, r.y - r.size * 0.12, r.z), q, s.setScalar(r.size));
        im.setMatrixAt(k, m);
        r.matrix = m.clone();
      });
      im.castShadow = true;
      im.receiveShadow = true;
      this.group.add(im);
    });
    this.rocks = rocks;

    // ---- Fallen logs + stumps (in the forest, where trees really fall) ----
    const barkTex = makeBarkTexture('oak', gen.seed + 99);
    const barkMat = new THREE.MeshStandardMaterial({ map: barkTex.map, normalMap: barkTex.normalMap, roughness: 0.96 });
    const endMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 });
    const logs = [];
    for (let t = 0; t < 2600; t++) {
      const x = (rand() - 0.5) * (WORLD_SIZE - 80), z = (rand() - 0.5) * (WORLD_SIZE - 80);
      const forest = mapAt(x, z, 0);
      if (rand() > forest * 0.45) continue;
      const y = heightAt(H, x, z);
      if (waterAt(W, x, z) > y - 0.3) continue;
      const stump = rand() < 0.35;
      logs.push({ x, y, z, stump, r: stump ? 0.22 + rand() * 0.25 : 0.14 + rand() * 0.24, len: stump ? 0.35 + rand() * 0.6 : 2.5 + rand() * 6, rot: rand() * Math.PI * 2 });
    }
    const logGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true);
    logGeo.attributes.uv.array.forEach((_, i, arr) => { if (i % 2 === 0) arr[i] *= 3; });
    const capGeo = mergeGeometries([new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2).translate(0, 0.5, 0), new THREE.CircleGeometry(1, 14).rotateX(Math.PI / 2).translate(0, -0.5, 0)]);
    const logIM = new THREE.InstancedMesh(logGeo, barkMat, logs.length);
    const capIM = new THREE.InstancedMesh(capGeo, endMat, logs.length);
    logs.forEach((l, k) => {
      if (l.stump) {
        q.identity();
        m.compose(p.set(l.x, l.y + l.len / 2 - 0.1, l.z), q, s.set(l.r, l.len, l.r));
      } else {
        // lying along the slope, half sunk into the leaves
        const dx = Math.cos(l.rot), dz = Math.sin(l.rot);
        const y0 = heightAt(H, l.x - dx * l.len / 2, l.z - dz * l.len / 2), y1 = heightAt(H, l.x + dx * l.len / 2, l.z + dz * l.len / 2);
        const dir = new THREE.Vector3(dx * l.len, y1 - y0, dz * l.len).normalize();
        q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        m.compose(p.set(l.x, (y0 + y1) / 2 + l.r * 0.7, l.z), q, s.set(l.r, l.len, l.r));
      }
      logIM.setMatrixAt(k, m);
      capIM.setMatrixAt(k, m);
      l.matrix = m.clone();
    });
    for (const im of [logIM, capIM]) { im.castShadow = true; im.receiveShadow = true; this.group.add(im); }
    this.logs = logs;

    if (RAPIER && physicsWorld) this.buildColliders(RAPIER, physicsWorld);
  }

  buildColliders(RAPIER, world) {
    const hulls = this.rockGeos.map((g) => new Float32Array(g.attributes.position.array));
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const r of this.rocks) {
      if (r.size < 0.38) continue; // pebbles you just step over
      r.matrix.decompose(p, q, s);
      const src = hulls[r.v];
      const pts = new Float32Array(src.length);
      for (let i = 0; i < src.length; i++) pts[i] = src[i] * r.size;
      const desc = RAPIER.ColliderDesc.convexHull(pts);
      if (!desc) continue;
      desc.setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.9);
      const c = world.createCollider(desc);
      c.userData = { surface: 'rock' };
    }
    for (const l of this.logs) {
      l.matrix.decompose(p, q, s);
      const desc = RAPIER.ColliderDesc.cylinder(s.y / 2, s.x).setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.8);
      const c = world.createCollider(desc);
      c.userData = { surface: 'wood' };
    }
  }
}
