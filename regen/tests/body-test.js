import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { RegenBody, loadLayerTextures } from '../src/body.js';
import { retargetClips } from '../src/retarget.js';
import { Physics } from '../src/physics.js';
const W = 480, H = 520, times = [0, 0.4, 1.0, 1.6, 2.2, 2.7];
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W * times.length, H); document.body.appendChild(r.domElement);
r.toneMapping = THREE.ACESFilmicToneMapping; r.setScissorTest(true);
const env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const LD = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); const g = await LD.loadAsync('assets/models/player.glb'); const an = await LD.loadAsync('assets/models/anims.glb'); g.animations = retargetClips(an.animations, an.scene, g.scene, 'mixamorig:Hips');
{ const bb = new THREE.Box3().setFromObject(g.scene); window.H0 = bb.getSize(new THREE.Vector3()).y; g.scene.scale.setScalar(1.8 / window.H0); g.scene.updateMatrixWorld(true); g.animations = retargetClips(an.animations, an.scene, g.scene, 'mixamorig:Hips'); }
const layers = loadLayerTextures(); await new Promise(res => setTimeout(res, 800));
const fake = { blood() {}, pool() {} }, audio = { play() {} };
for (let i = 0; i < times.length; i++) {
  const s = new THREE.Scene(); s.environment = env; s.background = new THREE.Color(0x8d969e);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(2, 4, 3); s.add(sun);
  const gl = { scene: clone(g.scene) }; s.add(gl.scene);
  const mx = new THREE.AnimationMixer(gl.scene); mx.clipAction(g.animations.find(a => a.name === 'Idle')).play(); mx.update(0.5);
  const b = new RegenBody(gl, layers, { physics: new Physics(), fx: fake, audio, scene: s });
  b.sever('lArm', 'upper'); b.sever('rLeg', 'lower'); b.blood = 0.5;
  b.update(1.0); // wait over
  b.update(0.0001); let t = 0; while (t < times[i]) { b.update(0.05); t += 0.05; }
  if (times[i] === 0) { b.limbs.lArm.state = 'cut'; b.limbs.lArm.wait = 9; b.limbs.rLeg.state = 'cut'; b.limbs.rLeg.wait = 9; b.uniforms.uSegT.value.fill(99); for (const s2 of [1,2,8]) b.uniforms.uSegT.value[s2] = -1; b.update(0.01); }
  gl.scene.updateMatrixWorld(true);
  if (i === 0) window.DBG = JSON.stringify({ meshes: b.meshes.map(m => { const h = {}; const a = m.geometry.attributes.aSeg.array; for (const x of a) h[x] = (h[x] || 0) + 1; return [m.name, m.skeleton.bones.length, h]; }), la: b.bones.LeftArm && b.bones.LeftArm.scale.x, names: Object.keys(b.bones).slice(0, 12), segT: b.uniforms.uSegT.value });
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50); cam.position.set(-1.2, 1.3, 2.6); cam.lookAt(0, 0.95, 0);
  r.setViewport(i * W, 0, W, H); r.setScissor(i * W, 0, W, H); r.render(s, cam);
}
window.DONE = 'h0=' + window.H0 + ' ' + window.DBG;
