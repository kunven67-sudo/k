// Builds the front yard at real scale (cm): sky, rolling lawn, your house, the street and its
// cars, neighbours' houses, the oak tree, flower beds, the big bush, puddle and rocks.
import * as THREE from 'three';
import { Sky } from '../vendor/three/examples/jsm/objects/Sky.js';
import * as TX from '../core/textures.js';
import { addDetailNormal, addWind, worldBox, scaleUV } from '../core/materials.js';
import { fbm2, mulberry32, smoothstep } from '../core/noise.js';
import { rbox, mesh } from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const YARD = {
  road: { x0: 1665, x1: 2335, y: -12 },
  sidewalk: { x0: 1500, x1: 1665 },
  farSidewalk: { x0: 2335, x1: 2480 },
  driveway: { x0: 0, x1: 1500, z0: -1000, z1: -700 },
  walk: { x0: 210, x1: 1500, z0: -55, z1: 55 },
  porch: { x0: 0, x1: 140, z0: -160, z1: 160, y: 14 },
  bush: { x: 230, z: 262, r: 92, h: 118 },
  puddle: { x: 820, z: -330, r: 70 },
  anthill: { x: 650, z: 300 },
  tree: { x: 1020, z: 720 },
  coreRock: { x: 885, z: -262 },
  beds: [{ x0: 0, x1: 110, z0: -600, z1: -170 }, { x0: 0, x1: 110, z0: 170, z1: 600 }],
  bounds: { x0: 2, x1: 2480, z0: -1180, z1: 1180 },
};

export function groundHeight(x, z) {
  const R = YARD.road;
  if (x >= R.x0 && x <= R.x1) return R.y + Math.sin(z * 0.002) * 0.3;
  let h = fbm2(x * 0.012, z * 0.012, { octaves: 3, seed: 5 }) * 2.4 + fbm2(x * 0.05, z * 0.05, { octaves: 2, seed: 9 }) * 0.5;
  // lawn slopes gently down to the curb
  if (x > 1400) h *= Math.max(0, 1 - (x - 1400) / 100);
  if (x < 150) h *= Math.max(0, x / 150);
  const P = YARD.puddle;
  const dp = Math.hypot(x - P.x, z - P.z);
  if (dp < P.r + 30) h -= (1 - smoothstep(0, P.r + 30, dp)) * 5;
  return h;
}

export function onHardscape(x, z) {
  const Y = YARD;
  if (x >= Y.sidewalk.x0 && x <= Y.farSidewalk.x1) return true;
  if (x >= Y.driveway.x0 && x <= Y.driveway.x1 && z >= Y.driveway.z0 && z <= Y.driveway.z1) return true;
  if (x >= Y.walk.x0 && x <= Y.walk.x1 && z >= Y.walk.z0 && z <= Y.walk.z1) return true;
  if (x <= Y.porch.x1 + 70 && z >= Y.porch.z0 && z <= Y.porch.z1) return true;
  for (const b of Y.beds) if (x >= b.x0 && x <= b.x1 + 4 && z >= b.z0 && z <= b.z1) return true;
  return false;
}

export function grassExcluded(x, z) {
  if (x < 4 || onHardscape(x, z)) return true;
  const B = YARD.bush; if (Math.hypot(x - B.x, z - B.z) < B.r - 6) return true;
  const P = YARD.puddle; if (Math.hypot(x - P.x, z - P.z) < P.r - 4) return true;
  const A = YARD.anthill; if (Math.hypot(x - A.x, z - A.z) < 30) return true;
  const T = YARD.tree; if (Math.hypot(x - T.x, z - T.z) < 40) return true;
  if (x > 300 && x < 780 && z > -945 && z < -755) return false;
  if (x > 2480) return false;
  return false;
}

// ------------------------------------------------------------------ builders
export function carMesh(color = 0xb3261e, rnd = Math.random) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1418, metalness: 0.3, roughness: 0.02, clearcoat: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08 });
  const L = 460, W = 184, H0 = 22;
  mesh(rbox(L, 62, W, 22, 4), paint, 0, H0 + 31, 0, g);
  mesh(rbox(L * 0.55, 55, W * 0.92, 20, 4), paint, -20, H0 + 82, 0, g);
  mesh(rbox(L * 0.5, 44, W * 0.94, 14, 3), glass, -20, H0 + 84, 0, g);
  mesh(rbox(10, 16, W * 0.9, 5, 2), chrome, L / 2 - 2, H0 + 18, 0, g);
  mesh(rbox(10, 16, W * 0.9, 5, 2), chrome, -L / 2 + 2, H0 + 18, 0, g);
  const hl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d8, emissiveIntensity: 2 });
  const tl = new THREE.MeshStandardMaterial({ color: 0x660000, emissive: 0xff1a1a, emissiveIntensity: 1.2 });
  [-1, 1].forEach((s) => {
    mesh(rbox(4, 12, 36, 3, 2), hl, L / 2, H0 + 42, s * 60, g);
    mesh(rbox(4, 12, 36, 3, 2), tl, -L / 2, H0 + 42, s * 60, g);
    [[L * 0.32], [-L * 0.3]].forEach(([x]) => {
      const w = new THREE.Group(); w.position.set(x, 33, s * (W / 2 - 14)); g.add(w);
      mesh(new THREE.TorusGeometry(24, 10, 12, 28), rubber, 0, 0, 0, w);
      mesh(new THREE.CylinderGeometry(18, 18, 20, 20), rim, 0, 0, 0, w, { rx: Math.PI / 2 });
      g.userData.wheels = g.userData.wheels || [];
      g.userData.wheels.push(w);
    });
    mesh(rbox(6, 12, 20, 3, 2), paint, 60, H0 + 70, s * (W / 2 + 6), g);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function gableRoof(w, d, h, mat, overhang = 40) {
  // Prism roof along Z (ridge line along Z), width w along X.
  const W = w / 2 + overhang, D = d / 2 + overhang;
  const shape = new THREE.Shape();
  shape.moveTo(-W, 0); shape.lineTo(W, 0); shape.lineTo(0, h); shape.lineTo(-W, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: D * 2, bevelEnabled: false });
  geo.translate(0, 0, -D);
  scaleUV(geo, 1 / 150, 1 / 150);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function houseMesh({ x0, x1, z0, z1, h = 300, roofH = 230, color = 0xdfe4e6, roof = null, frontX = 'max', door = null, windows = [] }) {
  const g = new THREE.Group();
  const w = x1 - x0, d = z1 - z0;
  const siding = TX.pbr(TX.siding({ color, seed: color & 255 }), { roughness: 1 });
  const body = new THREE.Mesh(worldBox(w, h, d, 180), siding);
  body.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const r = gableRoof(w, d, roofH, roof || TX.pbr(TX.shingles(), { roughness: 1 }));
  r.position.set((x0 + x1) / 2, h, (z0 + z1) / 2);
  g.add(r);
  const fx = frontX === 'max' ? x1 : x0;
  const out = frontX === 'max' ? 1 : -1;
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2630, metalness: 0.2, roughness: 0.03, clearcoat: 1, envMapIntensity: 1.6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.5 });
  windows.forEach(([zc, y0, y1, ww]) => {
    const wg = new THREE.Group(); wg.position.set(fx + out * 1, (y0 + y1) / 2, zc); g.add(wg);
    mesh(new THREE.BoxGeometry(4, y1 - y0 + 10, ww + 10), trim, 0, 0, 0, wg);
    mesh(new THREE.BoxGeometry(4.5, y1 - y0, ww), glass, out * 0.3, 0, 0, wg);
    mesh(new THREE.BoxGeometry(5, 4, ww), trim, 0, 0, 0, wg);
    mesh(new THREE.BoxGeometry(5, y1 - y0, 4), trim, 0, 0, 0, wg);
    mesh(rbox(14, 5, ww + 20, 1), trim, out * 5, -(y1 - y0) / 2 - 4, 0, wg);
  });
  if (door) {
    const [zc, y0, dw, dh, col] = door;
    const dg = new THREE.Group(); dg.position.set(fx + out * 1.5, y0, zc); g.add(dg);
    mesh(rbox(5, dh - 2.6, dw, 0.6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), 0, 2.6 + (dh - 2.6) / 2, 0, dg);
    mesh(new THREE.BoxGeometry(8, 10, dw + 22), trim, 0, dh + 5, 0, dg);
    [-1, 1].forEach((s) => mesh(new THREE.BoxGeometry(8, dh, 10), trim, 0, dh / 2, s * (dw / 2 + 5), dg));
    mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 1, roughness: 0.3 }), out * 5, 100, dw * 0.38, dg);
  }
  return g;
}

function treeMesh(x, z, scale, leafMat, barkMat, rnd, detail = true) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const trunkH = 380 * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(16 * scale, 26 * scale, trunkH, 20, 6), barkMat);
  const tp = trunk.geometry.attributes.position;
  for (let i = 0; i < tp.count; i++) { const a = Math.atan2(tp.getZ(i), tp.getX(i)); const k = 1 + Math.sin(a * 5 + tp.getY(i) * 0.02) * 0.08; tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); }
  trunk.geometry.computeVertexNormals();
  trunk.position.y = trunkH / 2; trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);
  // flared roots
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd();
    const root = new THREE.Mesh(new THREE.ConeGeometry(9 * scale, 70 * scale, 8), barkMat);
    root.position.set(Math.cos(a) * 26 * scale, 6, Math.sin(a) * 26 * scale);
    root.rotation.set(0, 0, 0); root.lookAt(root.position.clone().multiplyScalar(3).setY(-40));
    root.rotateX(Math.PI / 2);
    root.castShadow = true; g.add(root);
  }
  // branches + leaf clusters
  const clusters = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.5;
    const len = (160 + rnd() * 120) * scale;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(4 * scale, 10 * scale, len, 8), barkMat);
    const dir = V(Math.cos(a), 0.9 + rnd() * 0.5, Math.sin(a)).normalize();
    b.position.copy(V(0, trunkH * (0.8 + rnd() * 0.15), 0).addScaledVector(dir, len / 2));
    b.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    b.castShadow = true; g.add(b);
    clusters.push(V(0, trunkH * 0.9, 0).addScaledVector(dir, len));
  }
  clusters.push(V(0, trunkH + 180 * scale, 0));
  const blobGeo = new THREE.IcosahedronGeometry(1, 2);
  const bp = blobGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) { const v = V(bp.getX(i), bp.getY(i), bp.getZ(i)); v.multiplyScalar(1 + (rnd() - 0.5) * 0.25); bp.setXYZ(i, v.x, v.y, v.z); }
  blobGeo.computeVertexNormals();
  const blobMat = new THREE.MeshStandardMaterial({ color: 0x3d6a26, roughness: 0.9 });
  clusters.forEach((c) => {
    const r = (110 + rnd() * 60) * scale;
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.position.copy(c); blob.scale.setScalar(r * 0.8); blob.castShadow = true; blob.receiveShadow = true;
    g.add(blob);
  });
  if (detail) {
    const N = 2600;
    const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 11), leafMat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V(1, 1, 1);
    for (let i = 0; i < N; i++) {
      const c = clusters[i % clusters.length];
      const dir = V(rnd() - 0.5, rnd() - 0.4, rnd() - 0.5).normalize();
      const p = c.clone().addScaledVector(dir, (110 + rnd() * 60) * scale * (0.8 + rnd() * 0.25));
      q.setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6));
      s.setScalar(scale * (0.8 + rnd() * 0.6) * 1.6);
      m.compose(p, q, s);
      leaves.setMatrixAt(i, m);
    }
    leaves.castShadow = true; leaves.receiveShadow = true;
    g.add(leaves);
  }
  return { group: g, clusters, trunkH };
}

// ------------------------------------------------------------------ main build
export function buildYard(level, preset, renderer) {
  const { scene, world } = level;
  const group = new THREE.Group(); scene.add(group);
  level.group = group;
  const rnd = mulberry32(2024);
  const refs = level.refs = {};

  // Sky + sun
  const dimSky = (sk) => { sk.material.fragmentShader = sk.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * 0.45, 1.0 );'); sk.material.needsUpdate = true; };
  const sky = new Sky();
  dimSky(sky);
  sky.scale.setScalar(20000);
  scene.add(sky);
  const su = sky.material.uniforms;
  su.turbidity.value = 3.5; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.85;
  const sunDir = V(0.62, 0.72, 0.3).normalize();
  su.sunPosition.value.copy(sunDir);
  refs.sky = sky; refs.sunDir = sunDir;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const sky2 = new Sky(); dimSky(sky2); sky2.scale.setScalar(1000); envScene.add(sky2);
  Object.keys(su).forEach((k) => { if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = su[k].value.clone ? su[k].value.clone() : su[k].value; });
  refs.env = pmrem.fromScene(envScene).texture;
  refs.envOvercast = (() => { sky2.material.uniforms.turbidity.value = 12; sky2.material.uniforms.rayleigh.value = 3.5; sky2.material.uniforms.sunPosition.value.set(0.3, 0.3, 0.2); return pmrem.fromScene(envScene).texture; })();
  pmrem.dispose();
  scene.environment = preset.envMap ? refs.env : null;
  scene.fog = new THREE.FogExp2(0xb8cfe4, 0.00016);

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.castShadow = preset.shadows;
  sun.shadow.mapSize.set(preset.shadowMap, preset.shadowMap);
  const sr = preset.shadowRadius;
  Object.assign(sun.shadow.camera, { left: -sr, right: sr, top: sr, bottom: -sr, near: 10, far: 4000 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.08; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  refs.sun = sun;
  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x5a6a3a, 0.85);
  scene.add(hemi);
  refs.hemi = hemi;

  // Terrain
  const TW = 3600, TSEG = preset.quality === 'low' ? 180 : 300;
  const tg = new THREE.PlaneGeometry(TW, TW, TSEG, TSEG);
  tg.rotateX(-Math.PI / 2);
  tg.translate(1200, 0, 0);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, groundHeight(tp.getX(i), tp.getZ(i)));
  tg.computeVertexNormals();
  scaleUV(tg, TW / 70, TW / 70);
  const lawnM = TX.pbr(TX.lawn(), { roughness: 1 });
  addDetailNormal(lawnM, 9, 0.7);
  const terrain = new THREE.Mesh(tg, lawnM);
  terrain.receiveShadow = true;
  group.add(terrain);
  world.groundFn = groundHeight;
  world.groundSurface = 'grass';

  // Road, curbs, sidewalks, driveway, walkway, porch
  const Y = YARD;
  const asphaltM = TX.pbr(TX.asphalt(), { roughness: 1 });
  const road = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(Y.road.x1 - Y.road.x0, 8000), (Y.road.x1 - Y.road.x0) / 160, 8000 / 160), asphaltM);
  road.rotation.x = -Math.PI / 2; road.position.set((Y.road.x0 + Y.road.x1) / 2, Y.road.y + 0.3, 0); road.receiveShadow = true; group.add(road);
  const lines = TX.drawn('roadlines', 64, 512, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#e8c23a'; c.fillRect(w / 2 - 6, 0, 12, h * 0.55); });
  lines.wrapT = THREE.RepeatWrapping; lines.repeat.set(1, 20);
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(24, 8000), new THREE.MeshStandardMaterial({ map: lines, transparent: true, roughness: 0.6 }));
  lm.rotation.x = -Math.PI / 2; lm.position.set(2000, Y.road.y + 0.45, 0); group.add(lm);
  const concreteM = TX.pbr(TX.concrete({ color: 0xb4b0a6 }), { roughness: 1 });
  addDetailNormal(concreteM, 8, 0.6);
  const slab = (x0, x1, z0, z1, y0, y1, mat = concreteM, surface = 'concrete') => {
    const m = new THREE.Mesh(worldBox(x1 - x0, y1 - y0, z1 - z0, 120), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = true; m.castShadow = y1 - y0 > 3;
    group.add(m);
    world.addAABB(x0, y0, z0, x1, y1, z1, { surface });
    return m;
  };
  slab(Y.sidewalk.x0, Y.sidewalk.x1 - 15, -4000, 4000, -3, 2.2);
  slab(Y.sidewalk.x1 - 15, Y.sidewalk.x1, -4000, 4000, -14, 2.2);
  slab(Y.farSidewalk.x0, Y.farSidewalk.x0 + 15, -4000, 4000, -14, 2.2);
  slab(Y.farSidewalk.x0 + 15, Y.farSidewalk.x1, -4000, 4000, -3, 2.2);
  slab(Y.driveway.x0, Y.driveway.x1, Y.driveway.z0, Y.driveway.z1, -3, 1.6);
  const paverM = TX.pbr(TX.brick({ seed: 33 }), { roughness: 1 });
  slab(Y.walk.x0, Y.walk.x1, Y.walk.z0, Y.walk.z1, -3, 1.2, paverM);
  slab(Y.porch.x0, Y.porch.x1, Y.porch.z0, Y.porch.z1, -3, Y.porch.y);
  slab(Y.porch.x1, Y.porch.x1 + 35, -110, 110, -3, 9.5);
  slab(Y.porch.x1 + 35, Y.porch.x1 + 70, -110, 110, -3, 4.8);
  // welcome mat outside the door
  const matTex = TX.drawn('mat2', 512, 256, (c, w, h) => { c.fillStyle = '#3a2a1c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8000; i++) { c.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 40},30,0.5)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 5); } c.fillStyle = '#c9a45c'; c.font = 'bold 70px Georgia'; c.textAlign = 'center'; c.fillText('WELCOME', w / 2, h / 2 + 25); });
  const wm = new THREE.Mesh(rbox(60, 1.4, 100, 0.5), new THREE.MeshStandardMaterial({ map: matTex, roughness: 1 }));
  wm.position.set(34, Y.porch.y + 0.7, 0); wm.receiveShadow = true; group.add(wm);
  world.addAABB(4, Y.porch.y, -50, 64, Y.porch.y + 1.4, 50, { surface: 'fabric' });

  // Flower beds (mulch) with edging stones
  const mulchM = TX.pbr(TX.soil({ seed: 14 }), { roughness: 1, color: 0x9a6a48 });
  Y.beds.forEach((b) => slab(b.x0, b.x1, b.z0, b.z1, -3, 3.5, mulchM, 'dirt'));

  // The player's house
  const house = houseMesh({
    x0: -1100, x1: 0, z0: -1000, z1: 600, h: 300, roofH: 240, color: 0xd8dee2, frontX: 'max',
    door: [0, Y.porch.y, 95, 212, 0x2f4a6a],
    windows: [[-300, 100, 220, 150], [320, 100, 220, 140], [470, 100, 220, 140]],
  });
  group.add(house);
  world.addAABB(-1100, 0, -1000, 0, 300, -47.5, { surface: 'wood' });
  world.addAABB(-1100, 0, 47.5, 0, 300, 600, { surface: 'wood' });
  world.addAABB(-1100, Y.porch.y + 2.6, -47.5, 0, 300, 47.5, { surface: 'wood' });
  world.addAABB(-1100, 0, -47.5, -30, Y.porch.y + 2.6, 47.5);
  // garage door
  const gd = new THREE.Mesh(worldBox(4, 210, 260, 60), TX.pbr(TX.siding({ color: 0xeeeeee, seed: 99 }), { roughness: 0.8 }));
  gd.position.set(1, 105, -850); group.add(gd);
  // porch light
  const pl = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 22, 12), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }));
  pl.position.set(4, 220, 80); group.add(pl);
  // potted plant on the porch
  const potM = new THREE.MeshStandardMaterial({ color: 0xa65a3a, roughness: 0.85 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(22, 16, 40, 24), potM); pot.position.set(40, Y.porch.y + 20, -120); pot.castShadow = true; group.add(pot);
  world.addCylinder(40, -120, 22, Y.porch.y, Y.porch.y + 40);

  // Neighbours across the street
  const nColors = [0xe8d8b8, 0xb8c8d8, 0xd8b8b0];
  [-1500, 0, 1500].forEach((z, i) => {
    const h = houseMesh({ x0: 2900, x1: 3800, z0: z - 520, z1: z + 520, h: 320, roofH: 260, color: nColors[i], frontX: 'min', door: [z + 100, 20, 95, 212, [0x7a2a2a, 0x2a5a3a, 0x2a2a2a][i]], windows: [[z - 250, 110, 230, 160], [z + 330, 110, 230, 140]] });
    group.add(h);
    slab(2480, 2900, z + 60, z + 150, -3, 1.2);
  });
  // far lawns (no grass instances there - just texture)

  // Fence along the property sides
  const fenceM = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.7 });
  const picket = new THREE.BoxGeometry(9, 110, 2.2);
  picket.translate(0, 55, 0);
  const pk = new THREE.InstancedMesh(picket, fenceM, 2 * 110);
  let k = 0;
  const pm = new THREE.Matrix4();
  [-1195, 1195].forEach((z) => { for (let x = 30; x < 1490; x += 14) { pm.makeTranslation(x, groundHeight(x, z) - 2, z); pk.setMatrixAt(k++, pm); } });
  pk.count = k; pk.castShadow = true; pk.receiveShadow = true; group.add(pk);
  [-1195, 1195].forEach((z) => {
    [40, 80].forEach((y) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(1480, 7, 3), fenceM); rail.position.set(760, y, z + Math.sign(z) * 2.5); rail.castShadow = true; group.add(rail); });
    world.addAABB(0, 0, z - 3, 1500, 120, z + 3);
  });

  // Parked car in the driveway (walk under it for shade!)
  const parked = carMesh(0x2a4a7a);
  parked.position.set(540, 1.6, -850);
  group.add(parked);
  world.addBox(540, 1.6 + 22 + 60, -850, 230, 62, 92, { surface: 'glass' });
  [[540 + 147, -850 - 78], [540 + 147, -850 + 78], [540 - 138, -850 - 78], [540 - 138, -850 + 78]].forEach(([x, z]) => world.addCylinder(x, z, 20, 0, 58));
  refs.parked = parked;

  // Oak tree + street trees
  const leafTex = TX.leafTexture({ color: '#3f7a2c', seed: 5 });
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7 });
  addWind(leafMat, 2, 400);
  const barkM = TX.pbr(TX.bark(), { roughness: 1 });
  const oak = treeMesh(Y.tree.x, Y.tree.z, 1.25, leafMat, barkM, rnd, preset.quality !== 'low');
  group.add(oak.group);
  world.addCylinder(Y.tree.x, Y.tree.z, 30, 0, 600, { surface: 'wood' });
  refs.oak = oak;
  [[2420, -2200], [2420, 1100], [2600, -500], [2600, 2400]].forEach(([x, z]) => group.add(treeMesh(x, z, 1 + rnd() * 0.3, leafMat, barkM, rnd, false).group));

  // Puddle + rocks + the rock hiding the source
  const P = Y.puddle;
  const waterM = new THREE.MeshPhysicalMaterial({ color: 0x4a6a70, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.78, clearcoat: 1, envMapIntensity: 1.8 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(P.r + 8, 64), waterM);
  water.rotation.x = -Math.PI / 2; water.position.set(P.x, -0.6, P.z); water.renderOrder = 2;
  const wp = water.geometry.attributes.position;
  for (let i = 0; i < wp.count; i++) { const a = Math.atan2(wp.getY(i), wp.getX(i)); const r = Math.hypot(wp.getX(i), wp.getY(i)); const k2 = 1 + Math.sin(a * 3) * 0.12 + Math.sin(a * 7 + 1) * 0.05; wp.setX(i, Math.cos(a) * r * k2); wp.setY(i, Math.sin(a) * r * k2); }
  group.add(water);
  refs.water = water; refs.waterY = -0.6;
  const rockM = TX.pbr(TX.rock({ color: 0x8e8a82, seed: 40 }), { roughness: 1 });
  const rockAt = (x, z, r, flat = 0.7, extraProps = {}) => {
    const geo = new THREE.IcosahedronGeometry(r, 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const n = fbm2(v.x * 0.08 + x, v.z * 0.08 + v.y * 0.05 + z, { octaves: 3, seed: 3 }); v.multiplyScalar(1 + n * 0.35); v.y *= flat; p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rockM);
    m.position.set(x, groundHeight(x, z) + r * flat * 0.35, z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    const col = world.addCylinder(x, z, r * 0.85, -5, m.position.y + r * flat * 0.8, { surface: 'concrete', ...extraProps });
    return { mesh: m, col, r };
  };
  refs.rocks = [];
  [[760, -410, 22], [905, -380, 14], [740, -250, 9], [700, -320, 6], [930, -330, 7], [960, -240, 30], [640, -220, 12]].forEach(([x, z, r]) => refs.rocks.push(rockAt(x, z, r)));
  const core = rockAt(Y.coreRock.x, Y.coreRock.z, 13, 0.75);
  refs.coreRock = core;
  // mysterious glow leaking from under the core rock
  const glow = new THREE.PointLight(0x9a7aff, 0, 40, 2);
  glow.position.set(Y.coreRock.x, 3, Y.coreRock.z);
  group.add(glow);
  refs.coreGlow = glow;

  // Anthill
  const A = Y.anthill;
  const mound = new THREE.Mesh(new THREE.ConeGeometry(28, 11, 32, 4), TX.pbr(TX.soil({ seed: 51 }), { roughness: 1, color: 0xb08a60 }));
  const mp = mound.geometry.attributes.position;
  for (let i = 0; i < mp.count; i++) { mp.setY(i, mp.getY(i) + (Math.random() - 0.5) * 0.8); }
  mound.geometry.computeVertexNormals();
  mound.position.set(A.x, groundHeight(A.x, A.z) + 5, A.z); mound.receiveShadow = true; mound.castShadow = true;
  group.add(mound);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(2.4, 16), new THREE.MeshBasicMaterial({ color: 0x050302 }));
  hole.rotation.x = -Math.PI / 2 + 0.2; hole.position.set(A.x, mound.position.y + 5.4, A.z); group.add(hole);
  for (let r = 0; r < 4; r++) world.addCylinder(A.x, A.z, 26 - r * 6.5, -2, groundHeight(A.x, A.z) + 2.5 + r * 2.6, { surface: 'dirt' });

  // Flowers: tulips + daisies in the beds, dandelions in the lawn
  const stemM = new THREE.MeshStandardMaterial({ color: 0x3f7a2a, roughness: 0.6 });
  const tulipCols = [0xe0283a, 0xf2c21c, 0xf07ab0, 0xffffff];
  refs.flowers = [];
  const flower = (x, z, kind) => {
    const g = new THREE.Group(); g.position.set(x, groundHeight(x, z) + 3.5, z); group.add(g);
    const h = kind === 'tulip' ? 38 + rnd() * 10 : kind === 'dandelion' ? 22 + rnd() * 10 : 28 + rnd() * 8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, h, 6), stemM); stem.position.y = h / 2; stem.castShadow = true; g.add(stem);
    if (kind === 'tulip') {
      const cup = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: tulipCols[Math.floor(rnd() * 4)], roughness: 0.5, side: THREE.DoubleSide }));
      cup.position.y = h + 1.5; cup.rotation.x = Math.PI; cup.scale.set(1, 1.5, 1); cup.castShadow = true; g.add(cup);
      const lf = new THREE.Mesh(new THREE.PlaneGeometry(3, 18), new THREE.MeshStandardMaterial({ color: 0x4a8a34, side: THREE.DoubleSide, roughness: 0.6 })); lf.position.set(1.5, 9, 0); lf.rotation.z = -0.3; g.add(lf);
    } else if (kind === 'daisy') {
      const petals = new THREE.Mesh(new THREE.CircleGeometry(2.6, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }));
      petals.position.y = h; petals.rotation.x = -Math.PI / 2 + 0.3; g.add(petals);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2c21c })); c.position.y = h + 0.2; g.add(c);
    } else {
      const puff = rnd() < 0.4;
      const head = new THREE.Mesh(new THREE.SphereGeometry(puff ? 3.2 : 2, 14, 10), new THREE.MeshStandardMaterial({ color: puff ? 0xf4f4f0 : 0xf5c01c, roughness: 0.9, transparent: puff, opacity: puff ? 0.85 : 1 }));
      head.position.y = h; head.scale.y = puff ? 1 : 0.6; head.castShadow = true; g.add(head);
    }
    world.addCylinder(x, z, 0.6, -3, g.position.y + h - 2);
    refs.flowers.push({ group: g, x, z, h, kind });
    return g;
  };
  Y.beds.forEach((b) => { for (let i = 0; i < 26; i++) flower(b.x0 + 12 + rnd() * (b.x1 - b.x0 - 24), b.z0 + 12 + rnd() * (b.z1 - b.z0 - 24), rnd() < 0.55 ? 'tulip' : 'daisy'); });
  for (let i = 0; i < 26; i++) { const x = 300 + rnd() * 1100, z = -1100 + rnd() * 2200; if (!grassExcluded(x, z)) flower(x, z, 'dandelion'); }
  // Rose bush in the left bed: thorny canes to harvest
  const roseM = new THREE.MeshStandardMaterial({ color: 0x3a5a22, roughness: 0.7 });
  const thornM = new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.4 });
  refs.roseCanes = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const base = V(55 + Math.cos(a) * 10, 3.5, -360 + Math.sin(a) * 10);
    const top = base.clone().add(V(Math.cos(a) * 30, 60 + rnd() * 40, Math.sin(a) * 30));
    const curve = new THREE.QuadraticBezierCurve3(base, base.clone().lerp(top, 0.5).add(V(0, 15, 0)), top);
    const cane = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.8, 6), roseM); cane.castShadow = true; group.add(cane);
    for (let t = 0.05; t < 0.5; t += 0.07) {
      const p = curve.getPoint(t);
      const th = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.8, 6), thornM); th.position.copy(p); th.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); group.add(th);
    }
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(4, 14, 10), new THREE.MeshStandardMaterial({ color: 0xc81a2a, roughness: 0.6 })); bloom.position.copy(top); group.add(bloom);
    refs.roseCanes.push(curve.getPoint(0.08));
  }

  // ------------------------------------------------------------------ THE BUSH
  const B = Y.bush;
  const bush = new THREE.Group(); bush.position.set(B.x, 0, B.z); group.add(bush);
  refs.bush = bush;
  const stemMat = TX.pbr(TX.bark({ seed: 70 }), { roughness: 1 });
  const stems = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    const r0 = rnd() * 10;
    const base = V(Math.cos(a) * r0, 0, Math.sin(a) * r0);
    const out = 50 + rnd() * 35;
    const top = V(Math.cos(a) * out, 70 + rnd() * 40, Math.sin(a) * out);
    const curve = new THREE.CatmullRomCurve3([base, V(Math.cos(a) * r0 * 1.3, 20, Math.sin(a) * r0 * 1.3), base.clone().lerp(top, 0.6).add(V(0, 12, 0)), top]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 1.8 + rnd() * 1.2, 8), stemMat);
    tube.castShadow = true; tube.receiveShadow = true; bush.add(tube);
    stems.push(curve);
    // collide with the lower parts of the stems
    for (let t = 0; t <= 0.3; t += 0.1) { const p = curve.getPoint(t); world.addCylinder(B.x + p.x, B.z + p.z, 2.6, -2, p.y + 8, { surface: 'wood' }); }
    // side twigs
    for (let j = 0; j < 4; j++) {
      const p = curve.getPoint(0.45 + j * 0.12);
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.7, 18, 5), stemMat);
      tw.position.copy(p); tw.rotation.set(rnd() * 2 - 1, rnd() * 6, rnd() * 2 - 1); tw.castShadow = true; bush.add(tw);
    }
  }
  refs.bushStems = stems;
  // Leaf canopy shell: dense outside, open underneath (you can walk in)
  const bushLeafTex = TX.leafTexture({ color: '#355f24', seed: 12 });
  const bushLeafM = new THREE.MeshStandardMaterial({ map: bushLeafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.65 });
  addWind(bushLeafM, 1.2, 60);
  const NL = Math.round(9000 * Math.min(1.2, preset.particles + 0.2));
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 9), bushLeafM, NL);
  const lm4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = V(1, 1, 1);
  const leafCol = new THREE.Color();
  for (let i = 0; i < NL; i++) {
    const th = rnd() * Math.PI * 2;
    const ph = Math.acos(1 - rnd() * 1.15);
    const shell = 0.82 + rnd() * 0.22;
    const p = V(Math.sin(ph) * Math.cos(th) * B.r * shell, 40 + Math.cos(ph) * (B.h - 40) * shell, Math.sin(ph) * Math.sin(th) * B.r * shell);
    if (p.y < 22) p.y = 22 + rnd() * 6;
    const n = p.clone().normalize();
    q.setFromUnitVectors(V(0, 0, 1), n);
    q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, rnd() * 6)));
    s3.setScalar(0.8 + rnd() * 0.5);
    lm4.compose(p, q, s3);
    leaves.setMatrixAt(i, lm4);
    leafCol.setHSL(0.26 + rnd() * 0.06, 0.45 + rnd() * 0.2, 0.3 + rnd() * 0.15);
    leaves.setColorAt(i, leafCol);
  }
  leaves.castShadow = true; leaves.receiveShadow = true;
  bush.add(leaves);
  refs.bushLeaves = leaves;
  // Leaf litter carpet under the bush
  const litterM = new THREE.MeshStandardMaterial({ map: TX.leafTexture({ color: '#7a5a2a', seed: 13 }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
  const NLit = 700;
  const litter = new THREE.InstancedMesh(new THREE.PlaneGeometry(8, 10), litterM, NLit);
  for (let i = 0; i < NLit; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (B.r - 4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    q.setFromEuler(new THREE.Euler(-Math.PI / 2 + (rnd() - 0.5) * 0.4, 0, rnd() * 6));
    s3.setScalar(0.7 + rnd() * 0.6);
    lm4.compose(V(x, groundHeight(B.x + x, B.z + z) + 0.15 + rnd() * 0.5, z), q, s3);
    litter.setMatrixAt(i, lm4);
  }
  litter.receiveShadow = true;
  bush.add(litter);
  // soil disc under the bush
  const soilDisc = new THREE.Mesh(new THREE.CircleGeometry(B.r + 4, 48), TX.pbr(TX.soil({ seed: 22 }), { roughness: 1 }));
  soilDisc.rotation.x = -Math.PI / 2; soilDisc.position.y = 0.12; soilDisc.receiveShadow = true; bush.add(soilDisc);
  // The hidden hollow at the back: root arch + leaf curtain
  const hollowC = V(B.x + 38, 0, B.z + 58);
  refs.hollow = hollowC;
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 0.3;
    const p0 = V(hollowC.x + Math.cos(a) * 22, 0, hollowC.z + Math.sin(a) * 22 - 20);
    const p1 = V(hollowC.x + Math.cos(a) * 14, 26, hollowC.z + Math.sin(a) * 14);
    const p2 = V(hollowC.x + Math.cos(a) * 26, 0, hollowC.z + Math.sin(a) * 26 + 16);
    const root = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 20, 3, 8), stemMat);
    root.castShadow = true; group.add(root);
  }
  const curtain = new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 9), bushLeafM, 260);
  for (let i = 0; i < 260; i++) {
    const a = -1 + rnd() * 2, y = rnd() * 28;
    q.setFromEuler(new THREE.Euler(rnd() - 0.5, a + Math.PI, rnd() * 6));
    lm4.compose(V(hollowC.x - 30 + Math.cos(a) * 3, y, hollowC.z - 10 + a * 22), q, V(1, 1, 1));
    curtain.setMatrixAt(i, lm4);
  }
  group.add(curtain);

  // ------------------------------------------------------------------ extra props
  // garden gnome
  const gnome = new THREE.Group(); gnome.position.set(560, groundHeight(560, -200), -200); gnome.rotation.y = -0.6; group.add(gnome);
  const gm = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, clearcoat: 0.6 });
  mesh(new THREE.CylinderGeometry(7, 9, 14, 20), gm(0x2a5aa0), 0, 7, 0, gnome);
  mesh(new THREE.SphereGeometry(5.5, 20, 14), gm(0xf2c8a8), 0, 18, 0, gnome);
  mesh(new THREE.ConeGeometry(5, 9, 16), gm(0xf2f2f2), 0, 15, 3.5, gnome, { rx: 2.4 });
  mesh(new THREE.ConeGeometry(6, 14, 20), gm(0xc81a2a), 0, 27, 0, gnome, { rz: 0.15 });
  world.addCylinder(560, -200, 9, 0, 32);
  // frisbee lying upside-down: a shelter dome
  const fris = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), new THREE.MeshPhysicalMaterial({ color: 0xff7a1a, roughness: 0.3, clearcoat: 1, side: THREE.DoubleSide }));
  fris.position.set(950, groundHeight(950, 150) - 9.5, 150); fris.castShadow = true; group.add(fris);
  refs.frisbee = V(950, 0, 150);
  // mailbox
  const mb = new THREE.Group(); mb.position.set(1580, 2, -160); group.add(mb);
  mesh(new THREE.BoxGeometry(9, 110, 9), new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.9 }), 0, 55, 0, mb);
  mesh(rbox(24, 24, 50, 10, 3), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 }), 0, 122, 0, mb);
  mesh(new THREE.BoxGeometry(1, 16, 5), new THREE.MeshStandardMaterial({ color: 0xc81a1a }), 12, 135, -10, mb);
  world.addAABB(1575, 0, -165, 1585, 110, -155);
  // soda can on the sidewalk (hollow, climbable-ish)
  const can = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 12.2, 32), new THREE.MeshStandardMaterial({ color: 0xc81a1a, metalness: 0.8, roughness: 0.3 }));
  can.rotation.z = Math.PI / 2; can.position.set(1560, 5.5, 240); can.castShadow = true; group.add(can);
  world.addBox(1560, 5.5, 240, 6.1, 3.3, 3.3);
  // garden hose coil by the house
  const hoseM = new THREE.MeshStandardMaterial({ color: 0x2a8a3a, roughness: 0.5 });
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(22 + i * 1.6, 1.3, 8, 40), hoseM); t.rotation.x = Math.PI / 2; t.position.set(40, 1.3 + i * 2.4, -680); t.castShadow = true; group.add(t); }
  world.addCylinder(40, -680, 30, 0, 12);

  return refs;
}
