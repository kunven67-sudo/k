import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadHumanData } from '../../js/human/data.js';
import { bodyShape, buildSkeleton, groupGeometry } from '../../js/human/body.js';
(async () => {
  try {
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(1280, 720); document.body.appendChild(r.domElement);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a3f46);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.5); sun.position.set(2, 4, 5); scene.add(sun);
  const t0 = performance.now();
  await loadHumanData();
  const t1 = performance.now();
  const people = [
    { gender: 1, age: 42, muscle: 0.55, weight: 0.55, race: { caucasian: 1, african: 0, asian: 0 }, skin: 0xe0b896 },
    { gender: 0, age: 38, muscle: 0.5, weight: 0.5, race: { asian: 1, african: 0, caucasian: 0 }, skin: 0xe8c39e },
    { gender: 1, age: 14, muscle: 0.5, weight: 0.45, race: { african: 1, asian: 0, caucasian: 0 }, skin: 0x8a5a3c },
    { gender: 0, age: 9, muscle: 0.5, weight: 0.5, race: { caucasian: 0.5, african: 0.2, asian: 0.3 }, skin: 0xd9a77e },
    { gender: 1, age: 75, muscle: 0.3, weight: 0.7, race: { caucasian: 0.6, african: 0.2, asian: 0.2 }, skin: 0xd8b090 },
  ];
  const heights = [1.8, 1.62, 1.6, 1.32, 1.72];
  const info = [];
  people.forEach((p, i) => {
    const shape = bodyShape(p);
    const sk = buildSkeleton(shape);
    const root = new THREE.Group(); root.position.x = (i - 2) * 0.8; root.scale.setScalar(heights[i] / 1.75); scene.add(root);
    root.add(sk.root);
    const mat = new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.55 });
    const g = groupGeometry(shape, 'body');
    const m = new THREE.SkinnedMesh(g, mat); root.add(m); m.frustumCulled = false;
    root.updateMatrixWorld(true); m.bind(sk.skeleton);
    const tg = groupGeometry(shape, 'tights', { offset: 0.004 });
    const tm = new THREE.SkinnedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.9 })); root.add(tm); tm.frustumCulled = false; tm.bind(sk.skeleton);
    // pose test: bend the left elbow + raise right arm a bit
    info.push({ i, natural: shape.naturalHeight.toFixed(2), bones: sk.skeleton.bones.length });
    if (i === 0) {
      const el = sk.byName['lowerarm01.L']; el.quaternion.setFromAxisAngle(el.userData.x, 0.8);
      const kn = sk.byName['lowerleg01.R']; kn.quaternion.setFromAxisAngle(kn.userData.x, 0.6);
    }
  });
  const cam = new THREE.PerspectiveCamera(30, 1280 / 720, 0.05, 50);
  const view = new URLSearchParams(location.search).get('view') || 'all';
  if (view === 'all') { cam.position.set(0, 1.0, 7.2); cam.lookAt(0, 0.85, 0); }
  else if (view === 'face') { cam.position.set(-1.6 + 0.12, 1.66, 0.75); cam.lookAt(-1.6, 1.63, 0); }
  else if (view === 'side') { cam.position.set(4, 1.0, 0.0); cam.lookAt(0, 0.85, 0); }
  r.render(scene, cam);
  window.__info = { load: (t1 - t0).toFixed(0), info };
  document.title = 'done';
  } catch (e) { window.__info = { error: e.message + '\n' + e.stack }; document.title = 'done'; }
})();
