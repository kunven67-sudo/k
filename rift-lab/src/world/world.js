// The Empty World: untouched nature (land, lake + river, forest, meadow, rocks, sky).

import * as THREE from 'three';
import { generateTerrain, waterAt, WORLD_SIZE, HALF } from './terrainGen.js';
import { makeTerrainTextures } from './textures.js';
import { Terrain } from './terrain.js';
import { Water } from './water.js';
import { SkySystem } from './sky.js';
import { Trees } from './trees.js';
import { Grass } from './grass.js';
import { Rocks } from './rocks.js';
import { clamp } from '../core/noise.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export class EmptyWorld {
  static async create({ seed, renderer, scene, physics, clock, onProgress = () => {} }) {
    const w = new EmptyWorld();
    w.seed = seed;
    w.scene = scene;
    w.clock = clock;
    w.root = new THREE.Group();
    w.root.name = 'empty-world';
    scene.add(w.root);
    const R = physics?.RAPIER, pw = physics?.world;

    onProgress(0.02, 'Shaping the land');
    await nextFrame();
    w.gen = generateTerrain(seed, (p) => onProgress(0.02 + p * 0.4, 'Shaping the land'));
    onProgress(0.45, 'Painting the ground');
    await nextFrame();
    w.textures = makeTerrainTextures(seed);
    onProgress(0.55, 'Laying the land');
    await nextFrame();
    w.terrain = new Terrain({ gen: w.gen, RAPIER: R, physicsWorld: pw, textures: w.textures });
    w.root.add(w.terrain.group);
    onProgress(0.62, 'Filling the lake + river');
    await nextFrame();
    w.water = new Water({ gen: w.gen });
    w.root.add(w.water.mesh);
    onProgress(0.68, 'Growing the forest');
    await nextFrame();
    w.trees = new Trees({ gen: w.gen, renderer, RAPIER: R, physicsWorld: pw, clock });
    w.root.add(w.trees.group);
    onProgress(0.86, 'Rocks + fallen logs');
    await nextFrame();
    w.rocks = new Rocks({ gen: w.gen, RAPIER: R, physicsWorld: pw, terrainTextures: w.textures, trees: w.trees });
    w.root.add(w.rocks.group);
    onProgress(0.92, 'Grass');
    await nextFrame();
    w.grass = new Grass({ gen: w.gen });
    w.root.add(w.grass.group);
    onProgress(0.96, 'Sky');
    await nextFrame();
    w.sky = new SkySystem({ renderer, scene, clock });
    w.wind = 0.55;
    onProgress(1, 'Ready');
    return w;
  }

  height(x, z) { return this.terrain.height(x, z); }
  waterAt(x, z) { return waterAt(this.gen.W, x, z); }

  // What kind of ground is at x,z (for footsteps): grass, leaves, dirt, rock, mud
  surfaceAt(x, z) {
    const { maps, mapsRes } = this.gen;
    const mx = clamp(Math.floor((x + HALF) / WORLD_SIZE * mapsRes), 0, mapsRes - 1);
    const mz = clamp(Math.floor((z + HALF) / WORLD_SIZE * mapsRes), 0, mapsRes - 1);
    const o = (mz * mapsRes + mx) * 4;
    const forest = maps[o] / 255, moist = maps[o + 1] / 255, rock = maps[o + 2] / 255;
    const n = this.terrain.normal(x, z);
    if (rock > 0.5 || n.y < 0.75) return 'rock';
    if (moist > 0.9 || this.height(x, z) < this.gen.lake.level + 0.8) return 'mud';
    if (forest > 0.45) return 'leaves';
    return 'grass';
  }

  seasonValue() {
    // 0 = lush spring/summer .. 1 = late fall
    const doy = this.clock.dayOfYear();
    if (doy < 150) return 0.25;
    if (doy < 240) return 0.1;
    if (doy < 330) return 0.35 + (doy - 240) / 90 * 0.65;
    return 0.8;
  }

  update(dt, camera, renderer, playerFeet) {
    this.sky.update(dt, camera);
    this.terrain.update(camera);
    this.water.update(dt, this.sky);
    this.trees.wind = this.wind;
    this.trees.update(dt, camera, renderer);
    this.grass.update(dt, camera, playerFeet, this.seasonValue(), this.wind);
    this.terrain.material.userData.uniforms.uSeason.value = this.seasonValue();
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    this.scene.remove(this.sky.group, this.sky.clouds, this.sky.sunLight, this.sky.sunLight.target, this.sky.moonLight, this.sky.moonLight.target, this.sky.hemi);
    this.sky.envTarget?.dispose();
    this.sky.pmrem.dispose();
  }
}
