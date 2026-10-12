// Engine test room: a 7 x 6 m room with a window, a table and small things to shrink around.
import * as THREE from 'three';
import { std } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { Prop } from '../props/prop.js';
import { CATALOG } from '../props/catalog.js';

export async function buildTestRoom(game) {
  const { scene, physics } = game;
  const W = 7, D = 6, Hc = 2.6, T = 0.15;
  const floorT = TX.withRepeat(TX.woodFloor(), W / 2, D / 2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, D), std({ ...floorT, roughness: 1 }, { indoor: true }));
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  scene.add(floor);
  physics.staticBox(0, -0.05, 0, W / 2, 0.05, D / 2);

  const wallT = TX.withRepeat(TX.plaster(), 3, 1.2);
  const wallMat = std({ ...wallT, roughness: 1 }, { indoor: true });
  const wall = (x, z, w, d, h = Hc, y = h / 2) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    physics.staticBox(x, y, z, w / 2, h / 2, d / 2);
  };
  // North wall with a window (1.6 x 1.2 m, sill at 0.9 m).
  wall(-W / 4 - 0.4, -D / 2, W / 2 - 0.8, T);
  wall(W / 4 + 0.4, -D / 2, W / 2 - 0.8, T);
  wall(0, -D / 2, 1.6, T, 0.9, 0.45);
  wall(0, -D / 2, 1.6, T, Hc - 2.1, 2.1 + (Hc - 2.1) / 2);
  wall(0, D / 2, W, T);
  wall(-W / 2, 0, T, D);
  wall(W / 2, 0, T, D);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), wallMat);
  ceil.position.y = Hc + T / 2;
  ceil.castShadow = ceil.receiveShadow = true;
  scene.add(ceil);
  physics.staticBox(0, Hc + T / 2, 0, W / 2, T / 2, D / 2);

  // Rug under the table.
  const rugT = TX.withRepeat(TX.carpet(0x7d6450), 4, 3);
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.01, 1.9), std({ ...rugT, roughness: 1 }, { indoor: true }));
  rug.position.set(0, 0.005, 0.3);
  rug.receiveShadow = true;
  scene.add(rug);
  physics.staticBox(0, 0.005, 0.3, 1.3, 0.005, 0.95);

  // Outside ground so the window shows something.
  const grassT = TX.withRepeat(TX.grass(), 40, 40);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std({ ...grassT, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.11;
  ground.receiveShadow = true;
  scene.add(ground);
  physics.staticBox(0, -0.61, 0, 100, 0.5, 100);

  const P = (id, x, y, z, ry = 0) => new Prop(game, CATALOG[id], { position: [x, y, z], rotationY: ry });
  P('table', 0, 0.01, 0.3);
  P('soda_can', 0.25, 0.751, 0.2);
  P('mug', -0.3, 0.751, 0.35, 0.8);
  P('cookie', 0.05, 0.751, 0.5);
  P('book', -0.5, 0.751, 0.1, 0.3);
  P('box', 2.2, 0.0, -1.5, 0.4);
  P('ball', -2.0, 0.0, 1.8);
  P('soda_can', 1.6, 0.0, 1.2);
  // A few crumbs on the table and under it (someone ate a cookie here, Rule 1).
  const crumbs = [[0.1, 0.751, 0.45], [0.13, 0.751, 0.47], [0.02, 0.751, 0.55], [0.3, 0.011, 0.6], [0.31, 0.011, 0.62], [-0.2, 0.011, 0.4]];
  for (const c of crumbs) P('crumb', ...c);

  return { spawn: { position: [0.4, 0.02, 1.6], yaw: 0.25 } };
}
