// The dim casino around the menu's slot machine: patterned carpet fading into darkness, rows
// of other machines as silhouettes with glowing screens, out-of-focus lights, a ceiling of
// warm downlights. Built cheap: merged geometry, instanced cabinets, one Points bokeh.

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { worldUV } from '../../gfx/geom.js';
import { canvasTexture } from '../../gfx/textures.js';
import { createBokeh } from '../three/bokeh.js';

function screenTexture() {
  // Far-away attract screens: a soft glow with three bright reel windows. Grayscale — each
  // instance is tinted its own color.
  return canvasTexture('ui-menu-bgscreen', 128, 96, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.7);
    bg.addColorStop(0, '#9a9a9a');
    bg.addColorStop(1, '#1a1a1a');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.filter = 'blur(2px)';
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) g.fillRect(14 + i * 36, 30, 28, 36);
    g.filter = 'none';
  });
}

export function buildRoom(scene, { tier }) {
  const group = new THREE.Group();
  scene.add(group);
  scene.fog = new THREE.FogExp2(0x070407, 0.055);

  // Carpet.
  const carpet = mat('carpet-casino', { dirt: 0.45 });
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  floorGeo.rotateX(-Math.PI / 2);
  worldUV(floorGeo, carpet.userData.tileMeters * 0.8);
  const floor = new THREE.Mesh(floorGeo, carpet);
  floor.receiveShadow = true;
  group.add(floor);

  // Background machines: instanced dark cabinets + instanced glowing screens (2 draw calls).
  const rows = [
    { z: -7, x0: -9, n: 9, rot: 0 },
    { z: -11.5, x0: -12, n: 11, rot: 0 },
    { z: -3.5, x0: -11, n: 3, rot: Math.PI / 2.3, side: -1 },
    { z: -3.5, x0: 7.5, n: 3, rot: -Math.PI / 2.3, side: 1 },
  ];
  const slots = [];
  for (const r of rows) {
    for (let i = 0; i < r.n; i++) {
      if (r.side) slots.push({ x: r.x0 + r.side * i * 0.4, z: r.z - i * 1.25, rot: r.rot });
      else slots.push({ x: r.x0 + i * 2.15, z: r.z, rot: r.rot });
    }
  }
  const cabGeo = new THREE.BoxGeometry(1.0, 2.1, 0.9);
  cabGeo.translate(0, 1.05, 0);
  const cabMat = mat('metal-painted', { color: 0x1a1114, wear: 0.5, dirt: 0.5 });
  const cabs = new THREE.InstancedMesh(cabGeo, cabMat, slots.length);
  const scrGeo = new THREE.PlaneGeometry(0.72, 0.5);
  const scrMat = new THREE.MeshBasicMaterial({ map: screenTexture(), color: new THREE.Color(1.3, 1.3, 1.3) });
  const screens = new THREE.InstancedMesh(scrGeo, scrMat, slots.length * 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  slots.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    m.compose(new THREE.Vector3(s.x, 0, s.z), q, one);
    cabs.setMatrixAt(i, m);
    // Upper attract screen and lower reel glass.
    for (let k = 0; k < 2; k++) {
      const local = new THREE.Vector3(0, k ? 1.15 : 1.75, 0.452).applyQuaternion(q);
      m.compose(new THREE.Vector3(s.x, 0, s.z).add(local), q, k ? new THREE.Vector3(1, 0.7, 1) : one);
      screens.setMatrixAt(i * 2 + k, m);
      screens.setColorAt(i * 2 + k, new THREE.Color().setHSL(((i * 0.37 + k * 0.5) % 1), 0.6, k ? 0.35 : 0.55));
    }
  });
  group.add(cabs, screens);

  // Ceiling downlight pools on the carpet (fake: additive soft discs, no real lights).
  const poolTex = canvasTexture('ui-menu-pool', 128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,214,160,0.55)');
    gr.addColorStop(1, 'rgba(255,214,160,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const poolGeo = new THREE.PlaneGeometry(4, 4);
  poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, 7);
  [[-6, -4], [6, -4], [-3, -9], [3.5, -9.5], [0, -14], [-9, -9], [9, -10]].forEach(([x, z], i) => {
    m.makeTranslation(x, 0.01, z);
    pools.setMatrixAt(i, m);
  });
  group.add(pools);

  const bokeh = createBokeh({ count: Math.round(110 * tier.particlesScale) + 30, y: 3.5, spreadY: 7, spreadX: 34, z: [-9, -26], size: [0.8, 2.4], opacity: 0.42 });
  group.add(bokeh);

  return {
    group,
    update(t, h) {
      bokeh.update(t, h);
    },
    dispose() {
      for (const x of [scrMat, poolMat, bokeh.material, cabGeo, scrGeo, poolGeo, floorGeo]) x.dispose();
    },
  };
}
