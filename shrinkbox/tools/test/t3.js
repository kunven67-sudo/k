import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadHumanData } from '../../js/human/data.js';
import { bodyShape, buildSkeleton, groupGeometry, topology } from '../../js/human/body.js';
import { skinRegions } from '../../js/human/regions.js';
import { createSkinMaterial } from '../../js/human/skin.js';
import { createEyeMaterial, createEye, createLashMaterial } from '../../js/human/eyes.js';
(async () => {
  try {
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(1280, 720); document.body.appendChild(r.domElement);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2b3036);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.4;
  const view = new URLSearchParams(location.search).get('view') || 'face';
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0); sun.position.set(2.5, 3, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -1.5; sun.shadow.camera.right = sun.shadow.camera.top = 1.5; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.003;
  scene.add(sun);
  await loadHumanData();
  const reg = skinRegions();
  const people = [
    { p: { gender: 1, age: 42, muscle: 0.55, weight: 0.55, race: { caucasian: 1, african: 0, asian: 0 } }, tone: '#e3b796', hair: '#3a2a1e', iris: '#3d6a8a', freckles: 0.3 },
    { p: { gender: 0, age: 35, muscle: 0.5, weight: 0.5, race: { african: 1, asian: 0, caucasian: 0 } }, tone: '#6b4430', hair: '#141010', iris: '#3a2416', freckles: 0 },
    { p: { gender: 0, age: 13, muscle: 0.5, weight: 0.45, race: { asian: 1, african: 0, caucasian: 0 } }, tone: '#e6c19f', hair: '#1a1410', iris: '#2c1c12', freckles: 0 },
  ];
  const meshes = [];
  people.forEach((c, i) => {
    const shape = bodyShape(c.p);
    const sk = buildSkeleton(shape);
    const root = new THREE.Group(); root.position.x = i * 0.6; scene.add(root); root.add(sk.root);
    const mat = createSkinMaterial({ tone: c.tone, hair: c.hair, freckles: c.freckles, age: 0.4, seed: i * 77 });
    const g = groupGeometry(shape, 'body');
    g.setAttribute('aSkinA', reg.aSkinA); g.setAttribute('aSkinB', reg.aSkinB); g.setAttribute('aNail', reg.aNail); g.setAttribute('aBrow', reg.aBrow);
    const m = new THREE.SkinnedMesh(g, mat); root.add(m); m.frustumCulled = false; m.castShadow = m.receiveShadow = true;
    const cloth = new THREE.SkinnedMesh(groupGeometry(shape, 'tights', { offset: 0.003 }), new THREE.MeshStandardMaterial({ color: 0x40506a, roughness: 0.9 })); root.add(cloth); cloth.frustumCulled = false;
    const lashMat = createLashMaterial(topology('lashL'));
    const lashes = ['lashL', 'lashR'].map((n) => { const lm = new THREE.SkinnedMesh(groupGeometry(shape, n), n === 'lashL' ? lashMat : createLashMaterial(topology('lashR'))); lm.frustumCulled = false; root.add(lm); return lm; });
    root.updateMatrixWorld(true); m.bind(sk.skeleton); cloth.bind(sk.skeleton); lashes.forEach((l) => l.bind(sk.skeleton));
    // eyes
    const head = sk.byName['head'];
    for (const eg of ['eyeL', 'eyeR']) {
      const src = [...new Set(topology(eg).src)];
      const ctr = new THREE.Vector3(); for (const v of src) ctr.add(new THREE.Vector3(shape.pos[v * 3], shape.pos[v * 3 + 1], shape.pos[v * 3 + 2])); ctr.multiplyScalar(1 / src.length);
      let R = 0; for (const v of src) R += ctr.distanceTo(new THREE.Vector3(shape.pos[v * 3], shape.pos[v * 3 + 1], shape.pos[v * 3 + 2])); R /= src.length;
      const eye = createEye(R * 0.97, createEyeMaterial({ iris: c.iris, seed: i * 13 + (eg === 'eyeL' ? 1 : 2) }));
      eye.position.copy(ctr).sub(head.userData.head); head.add(eye);
      if (view === 'gaze') eye.rotation.set(-0.1, eg === 'eyeL' ? 0.35 : 0.35, 0);
    }
    for (const s of ['L', 'R']) { const b = sk.byName['upperarm01.' + s]; b.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), s === 'L' ? -1.0 : 1.0); }
    meshes.push({ root, sk, shape });
  });
  const cam = new THREE.PerspectiveCamera(30, 1280 / 720, 0.005, 50);
  scene.updateMatrixWorld(true);
  const headPos = (i) => { const b = meshes[i].sk.byName['head']; return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).add(new THREE.Vector3(0, 0.08, 0.05)); };
  const at = (i, off, look = headPos(i)) => { cam.position.copy(headPos(i)).add(off); cam.lookAt(look); };
  if (view === 'face') at(0, new THREE.Vector3(0.12, 0.0, 0.42));
  if (view === 'face2') at(1, new THREE.Vector3(-0.1, 0.0, 0.42));
  if (view === 'face3') at(2, new THREE.Vector3(0.05, 0.0, 0.42));
  if (view === 'gaze') at(0, new THREE.Vector3(0.0, 0.0, 0.42));
  if (view === 'eye' || view === 'eye2') { const e = meshes[view === 'eye' ? 0 : 2].sk.byName['head'].children.filter((c) => c.isMesh)[0]; const h = new THREE.Vector3().setFromMatrixPosition(e.matrixWorld); cam.position.copy(h).add(new THREE.Vector3(0.025, 0.012, 0.13)); cam.lookAt(h); }
  if (view === 'full') { cam.position.set(0.6, 1.0, 5); cam.lookAt(0.6, 0.9, 0); }
  r.render(scene, cam);
  window.__info = { progs: r.info.programs.length };
  document.title = 'done';
  } catch (e) { window.__info = { error: e.message + '\n' + e.stack }; document.title = 'done'; }
})();
