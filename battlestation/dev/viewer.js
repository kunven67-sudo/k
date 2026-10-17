import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const p = new URLSearchParams(location.search);
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(innerWidth, innerHeight); document.body.appendChild(r.domElement);
r.toneMapping = THREE.AgXToneMapping;
const s = new THREE.Scene(); s.background = new THREE.Color(0x808080);
s.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment()).texture;
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 100);
s.add(new THREE.GridHelper(10, 100, 0x333333, 0x666666));
new GLTFLoader().load('../assets/models/' + p.get('m') + '.glb', g => {
  s.add(g.scene);
  const b = new THREE.Box3().setFromObject(g.scene), c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3()).length();
  cam.position.copy(c).add(new THREE.Vector3(0.5, 0.45, 1).multiplyScalar(z * 0.9)); cam.lookAt(c);
  r.render(s, cam); window.__ready = true;
});
