import * as THREE from 'three';
import { World } from './world/world.js';
import { quality, setQualityLevel } from './core/quality.js';
const q = new URLSearchParams(location.search);
setQualityLevel('high');
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const world = new World(scene);
world.cage.generate(q.get('theme') || 'mixed', 3);
world.time = +(q.get('t') || 11);
const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.002, 1000);
const view = q.get('view') || 'lab';
const views = {
  lab: [[3.5, 2.4, 4.8], [0, 0.9, -0.5]],
  cage: [[0.5, 1.25, 0.6], [0, 0.9, -0.6]],
  tiny: [[0.1, 0.875, -0.2], [-0.3, 0.9, -0.9]],
  street: [[2, 5.2, 16], [-6, 4, 0]],
  house: [[5, 5.0, 4.5], [-4, 4.2, 0]],
  work: [[-2, 1.7, -3.2], [-2.5, 1.0, -5.8]],
};
const [p, t] = views[view];
cam.position.set(...p); cam.lookAt(...t);
const zone = world.zoneAt(cam.position);
world.setVisibility(zone, cam.position);
for (let i = 0; i < 5; i++) world.update(0.016, { playerPos: cam.position, time: i * 0.016 });
renderer.render(scene, cam);
document.title = 'zone=' + zone + ' calls=' + renderer.info.render.calls + ' tris=' + renderer.info.render.triangles;
console.log(document.title);
