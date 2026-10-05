import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadHumanData } from '../../js/human/data.js';
import { bodyShape, buildSkeleton, groupGeometry, topology } from '../../js/human/body.js';
import { skinRegions } from '../../js/human/regions.js';
import { createSkinMaterial } from '../../js/human/skin.js';
import { createEyeMaterial, createEye, createLashMaterial } from '../../js/human/eyes.js';
import { garmentGeometry, createFabricMaterial, visibleBodyIndex, GARMENTS } from '../../js/human/clothes.js';
(async () => {
  try {
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(1280, 720); document.body.appendChild(r.domElement);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b3036);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
  const view = new URLSearchParams(location.search).get('view') || 'full';
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); sun.position.set(2.5, 3, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -3; sun.shadow.camera.right = sun.shadow.camera.top = 3; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.003;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  await loadHumanData();
  const reg = skinRegions();
  const people = [
    { p: { gender: 1, age: 42, muscle: 0.55, weight: 0.55, race: { caucasian: 1, african: 0, asian: 0 } }, h: 1.8, tone: '#e3b796', hair: '#3a2a1e', iris: '#3d6a8a', outfit: [['tee', '#3f5f5a'], ['jeans', '#2c3e66'], ['socks', '#eeeeee']] },
    { p: { gender: 0, age: 38, muscle: 0.5, weight: 0.5, race: { african: 1, asian: 0, caucasian: 0 } }, h: 1.66, tone: '#6b4430', hair: '#141010', iris: '#3a2416', outfit: [['longsleeve', '#7a4f7a'], ['jeans', '#1f2a44'], ['socks', '#333333']] },
    { p: { gender: 1, age: 14, muscle: 0.5, weight: 0.45, race: { asian: 0.5, caucasian: 0.5, african: 0 } }, h: 1.62, tone: '#d9a77e', hair: '#1a1410', iris: '#2c1c12', outfit: [['hoodie', '#2f3b52'], ['sweats', '#3a3a3e'], ['socks', '#ffffff']] },
    { p: { gender: 0, age: 9, muscle: 0.5, weight: 0.5, race: { caucasian: 0.3, african: 0.4, asian: 0.3 } }, h: 1.32, tone: '#a0663f', hair: '#2b1d14', iris: '#3a2416', outfit: [['tee', '#c9b06b'], ['shorts', '#4e6b8f'], ['socks', '#eeeeee']] },
  ];
  const times = [];
  people.forEach((c, i) => {
    const t0 = performance.now();
    const shape = bodyShape(c.p);
    const sk = buildSkeleton(shape);
    const root = new THREE.Group(); root.position.x = (i - 1.5) * 0.75; root.scale.setScalar(c.h / 1.75); scene.add(root); root.add(sk.root);
    const garments = c.outfit.map(([style, col]) => ({ g: garmentGeometry(shape, style), style, col }));
    const mat = createSkinMaterial({ tone: c.tone, hair: c.hair, age: c.p.age > 30 ? 0.5 : 0.1, seed: i * 77 });
    mat.userData.u.uObjScale.value = c.h / 1.75;
    const g = groupGeometry(shape, 'body');
    g.setAttribute('aSkinA', reg.aSkinA); g.setAttribute('aSkinB', reg.aSkinB); g.setAttribute('aNail', reg.aNail); g.setAttribute('aBrow', reg.aBrow);
    g.setIndex(visibleBodyIndex(garments.map((x) => x.g)));
    const m = new THREE.SkinnedMesh(g, mat); root.add(m); m.frustumCulled = false; m.castShadow = m.receiveShadow = true;
    const parts = [m];
    for (const gm of garments) { const fm = createFabricMaterial(GARMENTS[gm.style].kind, gm.col); fm.userData.u.uObjScaleF.value = c.h / 1.75; const cm = new THREE.SkinnedMesh(gm.g, fm); cm.frustumCulled = false; cm.castShadow = cm.receiveShadow = true; root.add(cm); parts.push(cm); }
    for (const n of ['lashL', 'lashR']) { const lm = new THREE.SkinnedMesh(groupGeometry(shape, n), createLashMaterial(topology(n))); lm.frustumCulled = false; root.add(lm); parts.push(lm); }
    root.updateMatrixWorld(true); for (const p of parts) p.bind(sk.skeleton);
    const head = sk.byName['head'];
    for (const eg of ['eyeL', 'eyeR']) {
      const src = [...new Set(topology(eg).src)];
      const ctr = new THREE.Vector3(); for (const v of src) ctr.add(new THREE.Vector3(shape.pos[v * 3], shape.pos[v * 3 + 1], shape.pos[v * 3 + 2])); ctr.multiplyScalar(1 / src.length);
      let R = 0; for (const v of src) R += ctr.distanceTo(new THREE.Vector3(shape.pos[v * 3], shape.pos[v * 3 + 1], shape.pos[v * 3 + 2])); R /= src.length;
      const eye = createEye(R * 0.97, createEyeMaterial({ iris: c.iris, seed: i * 13 + (eg === 'eyeL' ? 1 : 2) })); eye.position.copy(ctr).sub(head.userData.head); head.add(eye);
    }
    // relaxed arms
    for (const s of ['L', 'R']) { const b = sk.byName['upperarm01.' + s]; b.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), s === 'L' ? -0.95 : 0.95); const e = sk.byName['lowerarm01.' + s]; e.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.15); }
    times.push((performance.now() - t0).toFixed(0));
  });
  const cam = new THREE.PerspectiveCamera(30, 1280 / 720, 0.01, 50);
  if (view === 'full') { cam.position.set(0, 1.05, 6.2); cam.lookAt(0, 0.85, 0); }
  if (view === 'front') { cam.position.set(-0.4, 1.2, 2.4); cam.lookAt(-0.4, 1.0, 0); }
  if (view === 'back') { cam.position.set(0, 1.05, -6.2); cam.lookAt(0, 0.85, 0); }
  if (view === 'jeans') { cam.position.set(-1.0, 0.55, 1.0); cam.lookAt(-1.1, 0.5, 0); }
  r.render(scene, cam);
  window.__info = { times, progs: r.info.programs.length };
  document.title = 'done';
  } catch (e) { window.__info = { error: e.message + '\n' + e.stack }; document.title = 'done'; }
})();
