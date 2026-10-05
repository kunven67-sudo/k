import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadHumanData } from '../../js/human/data.js';
import { bodyShape, buildSkeleton, groupGeometry } from '../../js/human/body.js';
import { skinRegions } from '../../js/human/regions.js';
import { createSkinMaterial } from '../../js/human/skin.js';
(async () => {
  try {
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(1280, 720); document.body.appendChild(r.domElement);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b3036);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
  const view = new URLSearchParams(location.search).get('view') || 'face';
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
  sun.position.set(view === 'back' ? -1 : 2.5, 3, view === 'back' ? -4 : 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -1.5; sun.shadow.camera.right = sun.shadow.camera.top = 1.5; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.005;
  scene.add(sun);
  await loadHumanData();
  const t0 = performance.now();
  const reg = skinRegions();
  const t1 = performance.now();
  const people = [
    { p: { gender: 1, age: 42, muscle: 0.55, weight: 0.55, race: { caucasian: 1, african: 0, asian: 0 } }, tone: '#e3b796', hair: '#3a2a1e', freckles: 0.3 },
    { p: { gender: 0, age: 35, muscle: 0.5, weight: 0.5, race: { african: 1, asian: 0, caucasian: 0 } }, tone: '#6b4430', hair: '#141010', freckles: 0 },
  ];
  const meshes = [];
  people.forEach((c, i) => {
    const shape = bodyShape(c.p);
    const sk = buildSkeleton(shape);
    const root = new THREE.Group(); root.position.x = i * 0.5; scene.add(root); root.add(sk.root);
    const mat = createSkinMaterial({ tone: c.tone, hair: c.hair, freckles: c.freckles, age: 0.4, seed: i * 77 });
    const g = groupGeometry(shape, 'body');
    g.setAttribute('aSkinA', reg.aSkinA); g.setAttribute('aSkinB', reg.aSkinB); g.setAttribute('aNail', reg.aNail);
    const m = new THREE.SkinnedMesh(g, mat); root.add(m); m.frustumCulled = false; m.castShadow = m.receiveShadow = true;
    root.updateMatrixWorld(true); m.bind(sk.skeleton);
    // relax arms down
    for (const s of ['L', 'R']) { const b = sk.byName['upperarm01.' + s]; b.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), s === 'L' ? 0.75 : -0.75); }
    meshes.push({ root, sk, shape });
  });
  const cam = new THREE.PerspectiveCamera(30, 1280 / 720, 0.01, 50);
  const head = (i) => { const b = meshes[i].sk.byName['head']; b.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); };
  scene.updateMatrixWorld(true);
  if (view === 'face') { const h = head(0).add(new THREE.Vector3(0, 0.09, 0)); cam.position.copy(h).add(new THREE.Vector3(0.18, 0.02, 0.5)); cam.lookAt(h); }
  if (view === 'face2') { const h = head(1).add(new THREE.Vector3(0, 0.09, 0)); cam.position.copy(h).add(new THREE.Vector3(-0.15, 0.02, 0.5)); cam.lookAt(h); }
  if (view === 'close') { const h = head(0).add(new THREE.Vector3(0.0, 0.11, 0.09)); cam.position.copy(h).add(new THREE.Vector3(0.06, 0.0, 0.1)); cam.lookAt(h); }
  if (view === 'back') { const h = head(0).add(new THREE.Vector3(0, 0.09, 0)); cam.position.copy(h).add(new THREE.Vector3(0.45, 0.0, 0.35)); cam.lookAt(h); }
  if (view === 'hand') { const b = meshes[0].sk.byName['wrist.L']; b.updateWorldMatrix(true, false); const h = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); cam.position.copy(h).add(new THREE.Vector3(0.12, 0.05, 0.3)); cam.lookAt(h.add(new THREE.Vector3(0.0, -0.06, 0))); }
  if (view === 'full') { cam.position.set(0.25, 1.0, 4.5); cam.lookAt(0.25, 0.9, 0); }
  r.render(scene, cam);
  const gl = r.getContext(); const err = gl.getError();
  window.__info = { regions: (t1 - t0).toFixed(0), glErr: err, progs: r.info.programs.length };
  document.title = 'done';
  } catch (e) { window.__info = { error: e.message + '\n' + e.stack }; document.title = 'done'; }
})();
