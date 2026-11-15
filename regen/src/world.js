// The place: open grassland under a real sky (Poly Haven HDRI), real rocks, logs and ferns.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Body } from './physics.js';

export async function buildWorld(scene, renderer, loader, physics, quality) {
  const hdr = await new RGBELoader().loadAsync('assets/tex/sky.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(hdr).texture;
  scene.background = hdr; scene.backgroundIntensity = 1; scene.environmentIntensity = 0.9;
  scene.fog = new THREE.Fog(0xb9c3c9, 90, 260);

  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  sun.position.set(-60, 90, 40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 260;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x5a5232, 0.35));

  // ground: grass + rock photo texture, sampled at two sizes so it doesn't look tiled
  const TL = new THREE.TextureLoader();
  const tex = n => { const t = TL.load('assets/tex/ground_' + n + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  const diff = tex('diff'); diff.colorSpace = THREE.SRGBColorSpace;
  const gm = new THREE.MeshStandardMaterial({ map: diff, normalMap: tex('nor'), roughnessMap: tex('rough'), roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2) });
  const R = 6; for (const t of [gm.map, gm.normalMap, gm.roughnessMap]) t.repeat.set(420 / R, 420 / R);
  gm.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { vec4 far = texture2D(map, vMapUv * 0.137 + 0.31); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.65 + far.rgb * 0.8), 0.5); }`);
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), gm);
  ground.receiveShadow = true; scene.add(ground);

  // scatter real rocks, logs, ferns (same layout every time)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const spot = (min = 25) => { for (;;) { const a = rnd() * 6.283, d = min + rnd() * 150; return [Math.cos(a) * d, Math.sin(a) * d]; } };
  const [boulder, log, fern] = await Promise.all(['boulder', 'log', 'fern'].map(n => loader.loadAsync('assets/models/' + n + '.glb')));
  const statics = [];
  const place = (g, x, z, s, ry, heavy = true) => {
    const o = g.scene.clone(true); o.position.set(x, 0, z); o.scale.setScalar(s); o.rotation.y = ry;
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    scene.add(o); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o); o.position.y -= b.min.y + 0.04 * s; o.updateMatrixWorld(true);
    if (heavy) { const sz = b.getSize(new THREE.Vector3()); const body = physics.add(new Body(o, { mass: 99999, box: { hx: sz.x / 2, hy: sz.y / 2, hz: sz.z / 2 }, tumble: false })); body.sleep = 9; body.static = true; body.bottomNow = o.position.y; }
    statics.push(o); return o;
  };
  const nB = quality === 'low' ? 14 : 24, nL = quality === 'low' ? 6 : 12;
  for (let i = 0; i < nB; i++) { const [x, z] = spot(); place(boulder, x, z, 0.35 + rnd() * 0.9, rnd() * 6.28); }
  for (let i = 0; i < nL; i++) { const [x, z] = spot(18); place(log, x, z, 0.8 + rnd() * 0.5, rnd() * 6.28); }
  // ferns: instanced copies of the real fern scan
  const fernMeshes = []; fern.scene.traverse(m => { if (m.isMesh) fernMeshes.push(m); });
  const nF = quality === 'low' ? 60 : 150;
  for (const fm of fernMeshes) {
    const im = new THREE.InstancedMesh(fm.geometry, fm.material, nF); im.castShadow = false; im.receiveShadow = true;
    scene.add(im); fm.updateWorldMatrix(true, false);
    const local = fm.matrixWorld.clone();
    seed = 99; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < nF; i++) {
      const [x, z] = spot(8); const k = 0.8 + rnd() * 1.4;
      M.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28), s.set(k, k, k)).multiply(local);
      im.setMatrixAt(i, M);
    }
  }
  return { sun, ground };
}
