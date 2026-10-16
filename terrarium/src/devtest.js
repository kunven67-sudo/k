// Dev page: a lineup of people to check how they look (not part of the game build).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Body, poseTargets } from './life/body.js';
import { HumanMesh } from './life/human.js';
import { makeLook, scientistLook } from './life/looks.js';
import { makeRng } from './core/util.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a3234);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 100);
HumanMesh.camera = cam;
scene.add(new THREE.HemisphereLight(0xddeeff, 0x443322, 0.45));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.8); sun.position.set(-3, 4, 3);
const fill = new THREE.DirectionalLight(0xbcd4ff, 0.5); fill.position.set(4, 1, 2); scene.add(fill); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -4; sun.shadow.camera.right = 4; sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x6a6f68, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const r = makeRng(Number(q.get('seed') || 5));
const mode = q.get('mode') || 'line';
const acts = (q.get('acts') || 'idle,walk,idle,wave,idle,run').split(',');
const bodies = [];
const n = mode === 'face' ? 1 : Number(q.get('n') || 6);
for (let i = 0; i < n; i++) {
  const look = q.get('sci') && i === 0 ? scientistLook() : makeLook({ age: q.get('kid') && i === 2 ? 'kid' : undefined, sex: i % 2 ? 'f' : 'm' }, r);
  const x = (i - (n - 1) / 2) * 0.75;
  const b = new Body(look, scene, { pos: new THREE.Vector3(x, 0, 0), yaw: 0, hi: mode === 'face' || q.get('hi') === '1' });
  b.groundFn = () => 0;
  bodies.push({ b, act: acts[i % acts.length], x });
}
let t = 0;
function frame(dt) {
  t += dt;
  for (const o of bodies) {
    const sp = o.act === 'walk' ? 1 : o.act === 'run' ? 2 : 0;
    const st = { pos: new THREE.Vector3(o.x, 0, 0), yaw: Number(q.get('yaw') || 0), phase: t * (sp ? 6 : 0), speed: sp, action: ['wave', 'cower', 'dance', 'sit', 'chop'].includes(o.act) ? o.act : null, at: t };
    const F = o.b.face;
    F.smile = q.get('smile') ? Number(q.get('smile')) : o.act === 'wave' ? 0.8 : 0.1;
    F.open = Number(q.get('open') || 0);
    F.angry = Number(q.get('angry') || 0); F.sad = Number(q.get('sad') || 0); F.scared = Number(q.get('scared') || 0);
    F.lookX = Number(q.get('lx') || 0); F.lookY = Number(q.get('ly') || 0);
    poseTargets(o.b, st);
    o.b.simulate(dt, 9.8, 30);
    o.b.render(t);
  }
}
if (q.get('cut')) {
  for (let i = 0; i < 60; i++) frame(1 / 60);
  bodies[1 % n].b.sever('lShoulder'); bodies[1 % n].b.sever('rKnee');
  if (n > 2) { bodies[2].b.sever('neck'); bodies[2].b.ragdoll(99); bodies[2].b.dead = true; }
  if (n > 3) { bodies[3].b.sever('waist'); bodies[3].b.push(new THREE.Vector3(0, 3, 0)); }
  for (let i = 0; i < 90; i++) frame(1 / 60);
} else for (let i = 0; i < 50; i++) frame(1 / 60);
if (mode === 'face') { const hp = bodies[0].b.P(0, new THREE.Vector3()); const a = Number(q.get('ang') || 0.25); cam.position.set(hp.x + Math.sin(a) * 0.62, hp.y + 0.02, hp.z + Math.cos(a) * 0.62); cam.lookAt(hp.x, hp.y - 0.01, hp.z); cam.fov = 24; cam.updateProjectionMatrix(); }
else { cam.position.set(0, 1.25, 5.2); cam.lookAt(0, 0.95, 0); }
renderer.render(scene, cam);
window.__info = { tris: renderer.info.render.triangles, calls: renderer.info.render.calls };
window.__done = true;
