// Dev test: a spider walking on a lab floor + up a block, lit like a lab, for looking at the model + gait.
// dist/dev.html?test=spider&species=widow&cam=hero&t=3
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Renderer } from '../core/render.js';
import { CollisionWorld, bakeColliders } from '../core/collide.js';
import { SPECIES } from '../spider/species.js';
import { buildSpider, chitinTick } from '../spider/body.js';
import { SpiderRig } from '../spider/rig.js';
import { texture, hasAsset } from '../core/assets.js';

export async function spiderLab(canvas, q) {
  const R = new Renderer(canvas);
  if (q.get('q')) R.setQuality(q.get('q'));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0d10);
  const pm = new THREE.PMREMGenerator(R.r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = +(q.get('env') || 0.35);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
  R.setView(scene, cam);
  const S = +(q.get('s') || 0.01); // spider size in metres
  // floor: lab tiles (if downloaded) else plain
  const fm = new THREE.MeshStandardMaterial({ color: 0xd8d6d2, roughness: 0.55 });
  if (hasAsset('tex/labfloor_col.webp')) {
    try {
      const rep = [4, 4];
      fm.map = await texture('tex/labfloor_col.webp', { repeat: rep });
      fm.normalMap = await texture('tex/labfloor_nrm.webp', { srgb: false, repeat: rep });
      const arm = await texture('tex/labfloor_arm.webp', { srgb: false, repeat: rep });
      fm.roughnessMap = arm; fm.aoMap = arm;
    } catch (e) { console.warn('no floor tex', e); }
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(S * 120, S * 120), fm);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const block = new THREE.Mesh(new THREE.BoxGeometry(S * 10, S * 6, S * 10), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 0.6 }));
  block.position.set(S * 14, S * 3, 0); block.castShadow = block.receiveShadow = true; scene.add(block);
  const world = new CollisionWorld();
  world.addStatic(bakeColliders([floor, block]));
  // lights: cool overhead lab light + warm rim
  const key = new THREE.DirectionalLight(0xf2f6ff, 2.6); key.position.set(S * 6, S * 14, S * 4); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); const sc = key.shadow.camera; sc.left = sc.bottom = -S * 8; sc.right = sc.top = S * 8; sc.near = S * 0.5; sc.far = S * 40;
  key.shadow.bias = -0.0002; key.shadow.normalBias = S * 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xffd2b0, 1.2); rim.position.set(-S * 8, S * 4, -S * 10); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x2a2420, 0.35));

  const sp = SPECIES[q.get('species') || 'widow'];
  const spider = buildSpider(sp, { quality: R.qName === 'low' ? 'low' : 'high' });
  spider.scale.setScalar(S);
  scene.add(spider);
  const probe = (o, d, far) => world.raycast(o, d, far);
  const rig = new SpiderRig(spider, sp, probe);
  const mode = q.get('walk') || 'circle';
  let t = 0;
  const camMode = q.get('cam') || 'hero';
  function step(dt) {
    t += dt;
    if (mode === 'circle') {
      const r = S * 4.5, w = 0.55;
      const a = t * w;
      spider.position.set(Math.cos(a) * r - S * 3, 0, Math.sin(a) * r);
      const fwd = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      spider.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), fwd.clone().negate(), new THREE.Vector3(0, 1, 0)));
    } else if (mode === 'still') {
      spider.position.set(0, 0, 0);
    }
    rig.update(dt);
    chitinTick(t);
    key.target.position.copy(spider.position); key.position.copy(spider.position).add(new THREE.Vector3(S * 6, S * 14, S * 4));
    const sp0 = spider.position;
    if (camMode === 'hero') { cam.position.set(sp0.x + S * 2.2, sp0.y + S * 1.1, sp0.z + S * 2.4); cam.lookAt(sp0.x, sp0.y + S * 0.25, sp0.z); }
    else if (camMode === 'side') { cam.position.set(sp0.x + S * 3.2, sp0.y + S * 0.35, sp0.z); cam.lookAt(sp0.x, sp0.y + S * 0.2, sp0.z); }
    else if (camMode === 'top') { cam.position.set(sp0.x + S * 0.01, sp0.y + S * 3.4, sp0.z); cam.lookAt(sp0.x, sp0.y, sp0.z); }
    else if (camMode === 'under') { cam.position.set(sp0.x + S * 0.6, sp0.y + S * 0.02, sp0.z - S * 0.3); cam.lookAt(sp0.x, sp0.y + S * 0.15, sp0.z); }
    else if (camMode === 'face') { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(spider.quaternion); cam.position.copy(sp0).addScaledVector(f, S * 1.0).add(new THREE.Vector3(0, S * 0.35, 0)).addScaledVector(new THREE.Vector3(-f.z, 0, f.x), S * 0.4); cam.lookAt(sp0.x + f.x * S * 0.3, sp0.y + S * 0.25, sp0.z + f.z * S * 0.3); }
    cam.near = S * 0.05; cam.far = S * 400; cam.updateProjectionMatrix();
    R.setDOF(+(q.get('dof') || 0.6), cam.position.distanceTo(sp0), S * 1.6);
  }
  // pre-simulate (screenshots)
  const pre = +(q.get('t') || 0);
  for (let i = 0; i < pre * 60; i++) step(1 / 60);
  let last = performance.now();
  function loop() {
    const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(q.get('freeze') ? 0 : dt);
    R.render(dt);
    requestAnimationFrame(loop);
  }
  window.__step = (dt) => { step(dt); R.render(dt); };
  window.__shotReady = false;
  step(1 / 60); R.render(1 / 60); R.render(1 / 60);
  window.__shotReady = true;
  window.__shotInfo = { gpu: R.gpu, q: R.qName, calls: R.r.info.render.calls, tris: R.r.info.render.triangles };
  if (!q.get('freeze')) loop();
}
