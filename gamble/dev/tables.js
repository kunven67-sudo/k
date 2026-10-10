// Dev page: casino table games (lane B).
//   tables.html?view=art          2D preview of the card atlases + chip texture
//   tables.html?view=props        cards and chips on a felt swatch (material check)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { runState } from './harness.js';
import { mat } from '../src/gfx/materials.js';
import { setMaxAnisotropy } from '../src/gfx/textures.js';
import { cardAtlasCanvases, CardMeshes, cardQuat, CARD_H } from '../src/casino/tables/kit/cards.js';
import { ChipMeshes, Pile, chipCanvas, kindOf, WHEEL_KIND } from '../src/casino/tables/kit/chips3d.js';

const q = Object.fromEntries(new URLSearchParams(location.search));

function artView() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#222;display:flex;flex-wrap:wrap;gap:8px;padding:8px;z-index:50';
  for (const c of [...cardAtlasCanvases(), chipCanvas()]) {
    c.style.cssText = 'width:min(48vw,1024px);height:auto;background:#fff';
    wrap.append(c);
  }
  document.body.append(wrap);
  window.__ready = true;
}

class PropsDev {
  constructor(engine) {
    this.engine = engine;
  }
  async enter() {
    const e = this.engine;
    setMaxAnisotropy(e.renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120d0b);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    const spot = new THREE.SpotLight(0xffe2b8, 7, 6, 0.7, 0.6, 2);
    spot.position.set(0.3, 2.2, 0.6);
    spot.target.position.set(0, 0.76, 0);
    spot.castShadow = e.tier.shadows;
    spot.shadow.mapSize.setScalar(1024);
    spot.shadow.bias = -0.0002;
    scene.add(spot, spot.target, new THREE.HemisphereLight(0x6a5a4a, 0x201810, 0.4));
    const felt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.9), mat('felt', { color: 0x125a3a }));
    felt.position.set(0, 0.74, 0);
    felt.receiveShadow = true;
    scene.add(felt);
    const deck = new CardMeshes({ capacity: 64 });
    scene.add(deck.mesh);
    const vals = [0, 13 + 12, 26 + 11, 39 + 10, 9, 13 + 4, 26 + 7, 39 + 0, 12, 13 + 0];
    vals.forEach((v, i) => {
      const x = -0.5 + (i % 5) * 0.075;
      const z = -0.12 + Math.floor(i / 5) * (CARD_H + 0.01);
      deck.spawn(v, new THREE.Vector3(x, 0.7604, z), cardQuat((Math.random() - 0.5) * 0.06, true));
    });
    deck.spawn(5, new THREE.Vector3(-0.05, 0.7604, -0.12), cardQuat(0.05, false));
    const chips = new ChipMeshes({ capacity: 300 });
    scene.add(chips.mesh);
    const denoms = [1, 2.5, 5, 25, 100, 500, 1000];
    denoms.forEach((d, i) => {
      const p = new Pile(chips, 0.12 + (i % 4) * 0.05, -0.1 + Math.floor(i / 4) * 0.06, 0.76, { neat: 2 });
      for (let k = 0; k < 4 + i * 2; k++) p.push(kindOf(d));
    });
    const tints = [0xd6732a, 0x3a8fd6, 0x8a5ac8];
    tints.forEach((t, i) => {
      const p = new Pile(chips, 0.12 + i * 0.05, 0.08, 0.76, { tint: new THREE.Color(t) });
      for (let k = 0; k < 6; k++) p.push(WHEEL_KIND);
    });
    // a loose chip lying flat
    chips.spawn(kindOf(25), new THREE.Vector3(0.36, 0.76, 0.12), 0.3);
    const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.02, 50);
    cam.position.set(q.cx ? +q.cx : -0.1, q.cy ? +q.cy : 1.12, q.cz ? +q.cz : 0.42);
    cam.lookAt(-0.1, 0.76, -0.04);
    this.cam = cam;
    e.setView(scene, cam);
  }
  update() {}
  onResize(w, h) {
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }
  exit() {}
}

if (q.view === 'art') artView();
else if (q.view === 'props') runState(PropsDev);
