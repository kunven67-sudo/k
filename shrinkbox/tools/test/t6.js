import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { initHumans } from '../../js/human/model.js';
import { ViewModel, LOOK_DEFAULT } from '../../js/player/avatar.js';
(async () => {
  try {
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(960, 540); document.body.appendChild(r.domElement);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a8f96);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.5); sun.position.set(1, 3, 2); scene.add(sun);
  await initHumans();
  const q = new URLSearchParams(location.search);
  const cam = new THREE.PerspectiveCamera(75, 960 / 540, 0.02, 50); scene.add(cam);
  const vm = new ViewModel({ ...LOOK_DEFAULT, topStyle: q.get('top') || 'hoodie' });
  cam.add(vm.root);
  if (q.get('tool') === '1') { const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.16), new THREE.MeshStandardMaterial({ color: 0xff8800 })); t.position.z = -0.06; vm.toolHold.add(t); }
  vm.drawWatch('1.75 m', '1:07 AM');
  for (let i = 0; i < 60; i++) vm.update(1 / 30, q.get('watch') === '1', i * 0.1, i / 30);
  r.render(scene, cam);
  window.__info = { ok: 1 };
  document.title = 'done';
  } catch (e) { window.__info = { error: e.message + '\n' + e.stack }; document.title = 'done'; }
})();
