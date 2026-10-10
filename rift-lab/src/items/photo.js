// Product photos for the spawn app: each item is rendered in a little white photo studio
// (soft lights, floor shadow, reflections) like a real online store picture.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildVisual, specBounds } from './builder.js';
import { getItem, buildSpec } from './catalog.js';

const cache = new Map();
let studio = null;

function makeStudio(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f2ef);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 8;
  key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.6));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  const size = 384;
  const target = new THREE.WebGLRenderTarget(size, size, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  return { scene, camera, target, size, holder: new THREE.Group() };
}

export function productPhoto(renderer, itemId, chosen) {
  const key = itemId + JSON.stringify(chosen || {});
  if (cache.has(key)) return cache.get(key);
  if (!studio) { studio = makeStudio(renderer); studio.scene.add(studio.holder); }
  const item = getItem(itemId);
  const spec = buildSpec(item, chosen);
  const { groups } = buildVisual(spec);
  const holder = studio.holder;
  holder.clear();
  for (const g of Object.values(groups)) holder.add(g);
  const b = specBounds(spec);
  const size = new THREE.Vector3(); b.getSize(size);
  const center = new THREE.Vector3(); b.getCenter(center);
  const radius = Math.max(size.length() / 2, 0.15);
  // 3/4 view from the front-right, slightly above (like real store photos)
  const cam = studio.camera;
  const dist = radius / Math.sin((cam.fov * Math.PI / 180) / 2) * 1.02;
  const dir = new THREE.Vector3(0.75, 0.42, 1).normalize();
  cam.position.copy(center).addScaledVector(dir, dist);
  cam.near = dist / 50; cam.far = dist * 4;
  cam.lookAt(center);
  cam.updateProjectionMatrix();

  const prevTarget = renderer.getRenderTarget();
  const prevTone = renderer.toneMapping, prevExp = renderer.toneMappingExposure;
  const prevShadow = renderer.shadowMap.enabled;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.setRenderTarget(studio.target);
  renderer.render(studio.scene, cam);
  const px = new Uint8Array(studio.size * studio.size * 4);
  renderer.readRenderTargetPixels(studio.target, 0, 0, studio.size, studio.size, px);
  renderer.setRenderTarget(prevTarget);
  renderer.toneMapping = prevTone;
  renderer.toneMappingExposure = prevExp;
  renderer.shadowMap.enabled = prevShadow;

  const c = document.createElement('canvas');
  c.width = c.height = studio.size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(studio.size, studio.size);
  const row = studio.size * 4;
  for (let y = 0; y < studio.size; y++) img.data.set(px.subarray((studio.size - 1 - y) * row, (studio.size - y) * row), y * row);
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/jpeg', 0.86);
  holder.clear();
  cache.set(key, url);
  return url;
}
