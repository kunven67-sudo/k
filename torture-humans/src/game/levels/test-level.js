// Test yard for movement, collisions, camera and physics: stairs, a ramp, a low
// table to crouch under, walls to walk into, and crates you can push around.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function noiseTexture(size, base, variation, { repeat = 1, scale = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const col = new THREE.Color(base);
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = (i / size) | 0;
    const n = (Math.sin(x * 0.11 * scale) * Math.cos(y * 0.13 * scale) + Math.random() * 2 - 1) * variation;
    img.data[i * 4] = Math.max(0, Math.min(255, col.r * 255 * (1 + n)));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, col.g * 255 * (1 + n)));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, col.b * 255 * (1 + n)));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function buildTestLevel({ scene, physics, renderer }) {
  const sunDirection = new THREE.Vector3(-0.5, -0.8, -0.35).normalize();
  const sky = new Sky();
  sky.scale.setScalar(4000);
  const u = sky.material.uniforms;
  u.turbidity.value = 4;
  u.rayleigh.value = 1.2;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(sunDirection).negate();
  scene.add(sky);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  scene.add(new THREE.HemisphereLight(0xbcd7ff, 0x5a4a3a, 0.6));
  scene.fog = new THREE.Fog(0xb8c6d6, 60, 600);

  const statics = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ map: noiseTexture(256, 0x8a8a86, 0.08, { repeat: 20 }), roughness: 0.9 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9c2b4, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ map: noiseTexture(128, 0x7a5332, 0.15, { repeat: 1, scale: 4 }), roughness: 0.7 });

  const add = (geo, mat, x, y, z, parent = statics) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ground
  const ground = add(new THREE.PlaneGeometry(120, 120), concrete, 0, 0, 0);
  ground.rotation.x = -Math.PI / 2;
  // stairs: 12 steps, 17 cm rise, 28 cm run (real building code sizes)
  for (let i = 0; i < 12; i++) add(new THREE.BoxGeometry(2, 0.17 * (i + 1), 0.28), concrete, 4, (0.17 * (i + 1)) / 2, -3 - i * 0.28);
  add(new THREE.BoxGeometry(2, 2.04, 3), concrete, 4, 1.02, -3 - 12 * 0.28 - 1.36); // landing
  // ramp (20 degrees)
  const ramp = add(new THREE.BoxGeometry(2.5, 0.2, 6), concrete, -4, 1, -5);
  ramp.rotation.x = THREE.MathUtils.degToRad(20);
  // walls
  add(new THREE.BoxGeometry(10, 3, 0.2), wallMat, 0, 1.5, 6);
  add(new THREE.BoxGeometry(0.2, 3, 8), wallMat, -8, 1.5, 2);
  // low table: 75 cm tall, crouch to get under
  const table = new THREE.Group();
  add(new THREE.BoxGeometry(2, 0.06, 1), woodMat, 0, 0.75, 0, table);
  for (const [x, z] of [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]]) add(new THREE.BoxGeometry(0.06, 0.72, 0.06), woodMat, x, 0.36, z, table);
  table.position.set(0, 0, -6);
  statics.add(table);
  scene.add(statics);
  physics.addStaticMesh(statics);

  // pushable crates
  const crates = [];
  for (let i = 0; i < 6; i++) {
    const s = 0.4 + (i % 3) * 0.15;
    const crate = add(new THREE.BoxGeometry(s, s, s), woodMat, -2 + (i % 3) * 0.9, s / 2 + Math.floor(i / 3) * 0.8, 2, scene);
    physics.addDynamic(crate, { mass: 8 * s * s * s * 20, friction: 0.7 });
    crates.push(crate);
  }

  return {
    spawn: new THREE.Vector3(0, 0, 3),
    sunDirection,
    sunIntensity: 3,
    crates,
  };
}
