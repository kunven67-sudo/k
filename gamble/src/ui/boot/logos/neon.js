// Logo A: hand-bent neon script "Gamble" on a dark brick wall. Tubes strike one letter at a
// time (flicker + buzz); the 'b' has a cracked electrode — its loop stutters and drops out.
// Each letter is a Catmull-Rom tube through hand-placed points (x-height = 1 unit).

import * as THREE from 'three';
import { mat } from '../../../gfx/materials.js';
import { worldUV } from '../../../gfx/geom.js';
import { settings } from '../../../core/settings.js';
import { Stage, fitDistance } from '../../three/stage.js';
import { uiSound, vary } from '../../sfx.js';

// Strokes per letter (shared endpoints keep the script continuous).
const LETTERS = [
  { id: 'G', pts: [[1.75, 2.35], [1.45, 2.8], [0.8, 2.95], [0.15, 2.55], [-0.15, 1.6], [0.05, 0.6], [0.6, 0.0], [1.3, 0.05], [1.75, 0.6], [1.84, 1.18], [1.32, 1.22]] },
  { id: 'a', pts: [[2.74, 0.96], [2.25, 1.02], [1.98, 0.62], [2.05, 0.12], [2.45, 0.03], [2.72, 0.5], [2.78, 1.0], [2.74, 0.42], [2.86, 0.02], [3.1, 0.08]] },
  { id: 'm', pts: [[3.1, 0.08], [3.28, 0.65], [3.32, 0.98], [3.36, 0.45], [3.36, 0.0], [3.5, 0.78], [3.78, 1.0], [3.98, 0.72], [3.98, 0.0], [4.1, 0.78], [4.4, 1.0], [4.6, 0.7], [4.62, 0.12], [4.86, 0.02]] },
  { id: 'b1', pts: [[4.86, 0.02], [5.12, 0.55], [5.36, 1.55], [5.46, 2.4], [5.32, 2.78], [5.06, 2.52], [5.0, 1.6], [5.04, 0.6]] },
  { id: 'b2', pts: [[5.04, 0.6], [5.18, 0.06], [5.6, 0.08], [5.86, 0.52], [5.72, 0.95], [5.36, 0.84], [5.72, 0.74], [6.06, 0.72]] },
  { id: 'l', pts: [[6.06, 0.72], [6.32, 1.25], [6.52, 2.2], [6.5, 2.76], [6.3, 2.62], [6.2, 1.8], [6.25, 0.6], [6.42, 0.04], [6.78, 0.14]] },
  { id: 'e', pts: [[6.78, 0.14], [7.06, 0.46], [7.38, 0.72], [7.3, 1.0], [7.0, 0.96], [6.86, 0.5], [7.02, 0.04], [7.4, 0.0], [7.8, 0.36]] },
];

const HOT = new THREE.Color(6.5, 0.35, 2.2); // HDR pink core (blooms above threshold)
const COLD = new THREE.Color(0.11, 0.035, 0.06); // unlit glass with phosphor coating

export async function runLogo(engine, root, skip, host) {
  const stage = new Stage(engine, { fov: 32, background: 0x050304, envIntensity: 0.25 });
  host.stage = stage;
  const { scene, camera } = stage;
  const calm = settings.get('reduceFlashing');

  // Wall: old dark brick, lit only by the sign.
  const wallMat = mat('brick', { color: 0x3a201c, dirt: 0.9, wear: 0.7 });
  const wallGeo = new THREE.PlaneGeometry(30, 16);
  worldUV(wallGeo, wallMat.userData.tileMeters * 3.2);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.z = -0.35;
  scene.add(wall);
  scene.add(new THREE.AmbientLight(0x241418, 0.6));
  const glow = new THREE.PointLight(0xff3d8b, 0, 16, 1.4);
  glow.position.set(0, 0.2, 1.4);
  scene.add(glow);

  // Tubes. Centered: script spans x ≈ -0.15..7.8, y ≈ 0..3.
  const sign = new THREE.Group();
  sign.position.set(-3.85, -1.35, 0);
  scene.add(sign);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a1418, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.35 });
  const letters = LETTERS.map((L) => {
    const curve = new THREE.CatmullRomCurve3(L.pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
    const segs = Math.max(24, L.pts.length * 14);
    const coreGeo = new THREE.TubeGeometry(curve, segs, 0.055, 8, false);
    const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: COLD.clone() }));
    // Outer glass sleeve catches the room light and gives the tube thickness when unlit.
    const sleeve = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 0.085, 8, false), glassMat);
    // Soft halo so the sign still glows on tiers without bloom.
    const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 0.16, 6, false), new THREE.MeshBasicMaterial({ color: 0xff3d8b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    sign.add(core, sleeve, halo);
    return { id: L.id, core, halo, level: 0, target: 0, on: false, struck: -1, broken: L.id === 'b1' };
  });
  // Standoffs (little brackets holding the tubes off the wall), merged into one mesh.
  const bracketGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6);
  bracketGeo.rotateX(Math.PI / 2);
  const bracketMat = mat('steel', { wear: 0.6, dirt: 0.6 });
  const brackets = new THREE.InstancedMesh(bracketGeo, bracketMat, LETTERS.length * 2);
  const m4 = new THREE.Matrix4();
  LETTERS.forEach((L, i) => {
    for (let k = 0; k < 2; k++) {
      const [x, y] = L.pts[Math.floor((L.pts.length - 1) * (0.3 + k * 0.4))];
      m4.makeTranslation(x, y, -0.17);
      brackets.setMatrixAt(i * 2 + k, m4);
    }
  });
  sign.add(brackets);

  camera.position.set(0.6, -0.3, 11.5);
  camera.lookAt(0, 0.1, 0);

  let buzz = null;
  const t0 = stage.time || 0;
  stage.onUpdate((dt, time) => {
    const tt = time - t0;
    let sum = 0;
    for (const L of letters) {
      // Striking: a few hard flickers before the gas catches.
      let v = L.target;
      if (L.on && tt - L.struck < 0.45 && !calm) v = Math.random() < 0.55 ? 1 : 0.08;
      if (L.broken && L.on) {
        // Cracked electrode: mostly dead, with stuttering bursts.
        const n = Math.sin(time * 13.1) * Math.sin(time * 7.3 + 1) + Math.sin(time * 31.7) * 0.3;
        v = n > 0.35 ? (calm ? 0.6 : Math.random() < 0.7 ? 0.9 : 0.2) : 0.04;
      }
      L.level += (v - L.level) * Math.min(1, dt * 40);
      L.core.material.color.copy(COLD).lerp(HOT, L.level);
      L.halo.material.opacity = L.level * 0.16;
      sum += L.level;
    }
    glow.intensity = (sum / letters.length) * 38;
    camera.position.z = Math.max(11.5, fitDistance(camera, 4.9, 2.2));
    camera.position.x = (0.6 + Math.sin(time * 0.3) * 0.25) * Math.min(1, camera.aspect);
    camera.lookAt(0, 0.1, 0);
  });

  // Strike sequence.
  await stage.wait(500, skip);
  for (const L of letters) {
    if (skip.requested) break;
    L.on = true;
    L.target = 1;
    L.struck = stage.time - t0;
    uiSound('logo.neon-on', { rate: vary(0.12), bus: 'sfx' });
    if (!buzz) buzz = uiSound('neon.buzz', { loop: true, gain: 0.5, bus: 'sfx' });
    await stage.wait(L.id === 'b2' ? 120 : 280, skip);
  }
  if (!skip.requested) uiSound('neon.flicker', { bus: 'sfx', gain: 0.6 });
  await stage.wait(2600, skip);
  await engine.fade(true, skip.requested ? 250 : 700);
  buzz?.stop?.(0.2);
  stage.dispose();
  for (const L of letters) {
    L.core.material.dispose();
    L.halo.material.dispose();
  }
  glassMat.dispose();
}
