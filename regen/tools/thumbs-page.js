// Renders a picture of every spawnable thing for the spawn menu (run by tools/thumbs.cjs)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { CREATURES, WEAPONS, PROPS } from '../src/catalog.js';
import { CreatureTypes, Creature } from '../src/creatures.js';
import { ItemTypes } from '../src/items.js';
const W = 320, H = 240;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H); document.body.appendChild(r.domElement);
r.toneMapping = THREE.ACESFilmicToneMapping;
const hdr = await new RGBELoader().loadAsync('assets/tex/sky.hdr'); hdr.mapping = THREE.EquirectangularReflectionMapping;
const env = new THREE.PMREMGenerator(r).fromEquirectangular(hdr).texture;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const ct = new CreatureTypes(loader), it = new ItemTypes(loader);
const out = {};
const grad = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#7f94a8'); gr.addColorStop(1, '#3c4650'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
async function shoot(key) {
  const s = new THREE.Scene(); s.environment = env; s.background = grad;
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); s.add(sun);
  let obj;
  if (CREATURES[key]) {
    const t = await ct.get(key);
    const fake = { scene: s, fx: {}, audio: { play() {} }, physics: { pushWalker() {} }, creatures: [], player: { pos: new THREE.Vector3(999, 0, 999) } };
    const c = new Creature(t, new THREE.Vector3(), 'calm', fake); c.yaw = 0.9; c.root.rotation.y = c.yaw; c.mixer.update(0.6);
    if (t.def.flying) c.root.position.y = 0;
    obj = c.root;
  } else {
    const t = await it.get(key); obj = t.scene.clone(true);
    const b0 = new THREE.Box3().setFromObject(obj), sz = b0.getSize(new THREE.Vector3());
    if (WEAPONS[key] && sz.y > sz.x && WEAPONS[key].kind !== 'shield') obj.rotation.z = -0.9; // show blades diagonally
    if (WEAPONS[key] && (WEAPONS[key].kind === 'gun' || WEAPONS[key].kind === 'rifle')) obj.rotation.y = -0.35;
    s.add(obj);
  }
  s.updateMatrixWorld(true);
  const box = new THREE.Box3(); obj.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o); });
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 1e4);
  const d = Math.max(sz.x * 0.75, sz.y, sz.z * 0.75) * 2.3;
  const dir = WEAPONS[key] ? new THREE.Vector3(0, 0.15, 1) : new THREE.Vector3(0.75, 0.38, 1);
  cam.position.copy(c).addScaledVector(dir.normalize(), d); cam.lookAt(c);
  r.render(s, cam);
  out[key] = r.domElement.toDataURL('image/webp', 0.86);
}
for (const k of [...Object.keys(WEAPONS), ...Object.keys(PROPS), ...Object.keys(CREATURES)]) await shoot(k);
window.THUMBS = out;
