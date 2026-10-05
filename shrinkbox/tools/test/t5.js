import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { initHumans, HumanModel } from '../../js/human/model.js';
(async () => {
  try {
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(1280, 720); document.body.appendChild(r.domElement);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b3036);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
  const q = new URLSearchParams(location.search); const view = q.get('view') || 'full';
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); sun.position.set(2.5, 3, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -3; sun.shadow.camera.right = sun.shadow.camera.top = 3; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.003;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const t0 = performance.now();
  await initHumans();
  const t1 = performance.now();
  const looks = [
    { gender: 1, age: 42, skin: '#e3b796', hair: '#3a2a1e', hairStyle: 'short', eyes: '#3d6a8a', top: '#3f5f5a', topStyle: 'tee', pants: '#2c3e66', shoes: '#3b2a1e', seed: 11, h: 1.8 },
    { gender: 0, age: 38, skin: '#6b4430', hair: '#141010', hairStyle: 'curly', eyes: '#3a2416', top: '#7a4f7a', topStyle: 'longsleeve', pants: '#1f2a44', shoes: '#ddd', seed: 22, h: 1.66 },
    { gender: 0.5, age: 14, skin: '#c68a64', hair: '#2b1d14', hairStyle: 'short', eyes: '#4a3121', top: '#2f3b52', topStyle: 'hoodie', pants: '#3a3a3e', pantsStyle: 'sweats', shoes: '#e9e9e9', seed: 7, h: 1.62 },
    { gender: 0, age: 10, skin: '#e8b892', hair: '#a8743a', hairStyle: 'ponytail', eyes: '#3d6a8a', top: '#c9b06b', topStyle: 'tee', pants: '#4e6b8f', pantsStyle: 'shorts', shoes: '#c94040', seed: 33, h: 1.38 },
    { gender: 0, age: 30, skin: '#f3d2b8', hair: '#d9b26a', hairStyle: 'long', eyes: '#557a55', top: '#a63d3d', topStyle: 'tee', pants: '#2c3e66', shoes: '#ffffff', seed: 44, h: 1.65 },
  ];
  const states = (q.get('states') || 'idle,idle,idle,idle,idle').split(',');
  const models = looks.map((L, i) => {
    const m = new HumanModel(L);
    m.root.position.x = (i - 2) * 0.75; m.root.scale.setScalar(L.h / 1.75); scene.add(m.root);
    return m;
  });
  const t2 = performance.now();
  const camPos = new THREE.Vector3(0, 1.3, 3.0);
  for (let f = 0; f < 40; f++) models.forEach((m, i) => { m.lookAt = camPos; m.update(1 / 30, { state: states[i] || 'idle', speed: states[i] === 'run' ? 1.8 : 1, talking: i === 2 && q.get('talk') === '1', mood: q.get('mood') || 'neutral' }); });
  const cam = new THREE.PerspectiveCamera(30, 1280 / 720, 0.01, 50);
  const headOf = (i) => { const h = models[i].head; h.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(h.matrixWorld).add(new THREE.Vector3(0, 0.07, 0.02)); };
  if (view === 'full') { cam.position.set(0, 1.05, 7.0); cam.lookAt(0, 0.85, 0); }
  else if (view.startsWith('face')) { const i = +view.slice(4) || 0; const h = headOf(i); cam.position.copy(h).add(new THREE.Vector3(0.08, 0.0, 0.55)); cam.lookAt(h); }
  else if (view.startsWith('bust')) { const i = +view.slice(4) || 0; const h = headOf(i).add(new THREE.Vector3(0, -0.25, 0)); cam.position.copy(h).add(new THREE.Vector3(0.3, 0.1, 1.3)); cam.lookAt(h); }
  else if (view === 'back') { cam.position.set(0, 1.4, -4.5); cam.lookAt(0, 1.2, 0); }
  r.render(scene, cam);
  window.__info = { init: (t1 - t0).toFixed(0), build: (t2 - t1).toFixed(0), progs: r.info.programs.length, tris: r.info.render.triangles, calls: r.info.render.calls };
  document.title = 'done';
  } catch (e) { window.__info = { error: e.message + '\n' + e.stack }; document.title = 'done'; }
})();
