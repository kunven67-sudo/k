// Renders a little picture of each spawnable item with the real renderer (for the spawn menu + hotbar).
import * as THREE from 'three';
import { buildVisual } from '../game/entities.js';
import { ctx } from '../game/ctx.js';

const cache = new Map();
const W = 200, H = 160;
let stage = null;

function getStage() {
  if (stage) return stage;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x5a5048, 1.4));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 100);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  stage = { scene, cam, canvas, g: canvas.getContext('2d') };
  return stage;
}

export function thumbFor(def) {
  if (!def || def.tool) return null;
  return cache.get(def.id) || null;
}

// Must be called when the game is not mid-render (e.g. right when the spawn menu opens).
export function renderThumbs(defs) {
  const todo = defs.filter((d) => !d.tool && !cache.has(d.id));
  if (!todo.length) return;
  const { renderer } = ctx;
  const s = getStage();
  s.scene.environment = ctx.scene.environment;
  const pr = renderer.getPixelRatio();
  const size = renderer.getSize(new THREE.Vector2());
  const prevTone = renderer.toneMappingExposure;
  renderer.toneMappingExposure = 0.9;
  renderer.setScissorTest(true);
  for (const def of todo) {
    const obj = buildVisual(def, null, 1);
    s.scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj, true);
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const dist = r / Math.sin(THREE.MathUtils.degToRad(15)) * 0.95;
    s.cam.position.copy(c).add(new THREE.Vector3(0.75, 0.55, 1).normalize().multiplyScalar(dist));
    s.cam.near = dist / 50; s.cam.far = dist * 4;
    s.cam.updateProjectionMatrix();
    s.cam.lookAt(c);
    renderer.setViewport(0, 0, W / pr, H / pr);
    renderer.setScissor(0, 0, W / pr, H / pr);
    renderer.setClearColor(0x23262a, 1);
    renderer.clear();
    renderer.render(s.scene, s.cam);
    s.g.clearRect(0, 0, W, H);
    // WebGL's origin is bottom-left
    s.g.drawImage(renderer.domElement, 0, renderer.domElement.height - H, W, H, 0, 0, W, H);
    cache.set(def.id, s.canvas.toDataURL('image/png'));
    s.scene.remove(obj);
    obj.traverse((o) => o.geometry?.dispose());
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, size.x, size.y);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMappingExposure = prevTone;
}
