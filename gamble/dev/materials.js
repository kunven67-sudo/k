// Dev page: swatch wall of every material kind under studio + sun lighting.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { mat } from '../src/gfx/materials.js';
import { bevelBox } from '../src/gfx/geom.js';
import { setMaxAnisotropy } from '../src/gfx/textures.js';

const KINDS = [
  ['asphalt'], ['sidewalk'], ['concrete'], ['curb', { color: 0xa8322a }], ['dirt'], ['gravel'], ['grass'],
  ['stucco'], ['brick'], ['painted-wood'], ['wallpaper'], ['drywall'], ['tile-bathroom'], ['linoleum'],
  ['wood-floor'], ['carpet-casino'], ['carpet-motel'], ['felt'], ['fabric'], ['leather'], ['chrome'],
  ['steel'], ['brass'], ['gold'], ['metal-painted'], ['plastic'], ['rubber'], ['car-paint'], ['glass'],
  ['neon'], ['paper'], ['cardboard'], ['wood'],
];

class MaterialsDev {
  constructor(engine) { this.engine = engine; }
  async enter() {
    const e = this.engine;
    setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1e);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
    sun.position.set(-3, 6, 8);
    scene.add(sun);
    const cols = 7;
    KINDS.forEach(([k, o], i) => {
      const m = bevelBox(1.2, 1.2, 0.3, mat(k, o || {}), { radius: 0.03 });
      m.position.set((i % cols - (cols - 1) / 2) * 1.45, 3.2 - Math.floor(i / cols) * 1.45, 0);
      m.rotation.y = 0.25;
      scene.add(m);
    });
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 0.3, 11.5);
    cam.lookAt(0, 0.3, 0);
    e.setView(scene, cam);
  }
  update() {}
  exit() {}
}
runState(MaterialsDev);
