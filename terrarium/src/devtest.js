import * as THREE from 'three';
import { InstancedSink } from './life/render.js';
import { Body, poseTargets } from './life/body.js';
import { makeLook } from './life/looks.js';
import { makeRng } from './core/util.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x203030);
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 100);
cam.position.set(0, 1.5, 3.2); cam.lookAt(0, 1.2, 0);
scene.add(new THREE.HemisphereLight(0xddeeff, 0x332211, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); sun.castShadow = true; scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x556655 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const sink = new InstancedSink(scene, 16);
const r = makeRng(Number(new URLSearchParams(location.search).get('seed') || 5));
const acts = ['idle', 'walk', 'chop', 'worship', 'cower', 'dance', 'wave', 'sit', 'run', 'sleep'];
const bodies = [];
for (let i = 0; i < 10; i++) {
  const look = makeLook({ age: i === 8 ? 'kid' : undefined }, r);
  const x = (i % 5 - 2) * 1.1, z = i < 5 ? 0 : -1.6;
  const b = new Body(look, sink, { pos: new THREE.Vector3(x, 0, z), yaw: 0 });
  b.groundFn = () => 0;
  bodies.push({ b, act: acts[i], x, z });
}
// cut test
const cutMode = new URLSearchParams(location.search).get('cut');
let t = 0;
function frame(dt) {
  t += dt;
  for (const o of bodies) {
    const st = { pos: new THREE.Vector3(o.x, 0, o.z), yaw: 0.3, phase: t * 6, speed: o.act === 'walk' ? 1 : o.act === 'run' ? 2 : 0, action: ['chop','worship','cower','dance','wave','sit'].includes(o.act) ? o.act : null, at: t, lying: o.act === 'sleep' };
    if (o.act === 'sleep') { st.action = 'sleep'; o.b.face.closed = 1; }
    o.b.face.smile = o.act === 'dance' ? 1 : o.act === 'cower' ? -0.8 : 0.2;
    o.b.face.scared = o.act === 'cower' ? 1 : 0; o.b.face.open = o.act === 'cower' ? 0.8 : 0;
    o.b.face.angry = o.act === 'chop' ? 1 : 0;
    poseTargets(o.b, st);
    o.b.simulate(dt, 9.8, 30);
    o.b.render(t);
  }
  sink.flush();
}
if (cutMode) {
  for (let i = 0; i < 60; i++) frame(1/60);
  const b = bodies[1].b; b.sever('lShoulder'); b.sever('rKnee');
  const b2 = bodies[2].b; b2.sever('neck'); b2.ragdoll(99); b2.dead = true;
  const b3 = bodies[3].b; b3.sever('waist');
  b3.push(new THREE.Vector3(0, 3, 0));
  bodies[4].b.ragdoll(99); bodies[4].b.push(new THREE.Vector3(1, 4, 0));
  for (let i = 0; i < 90; i++) frame(1/60);
} else for (let i = 0; i < 40; i++) frame(1/60);
renderer.render(scene, cam);
window.__done = true;
