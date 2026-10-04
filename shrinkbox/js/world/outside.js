// What you see out the windows: your house sits at the edge of a west-coast town.
// Front (south): the street, neighbors' houses, palm + oak trees, the city skyline far away.
// Side/back (east/north): fields and hills. Sky follows the real time (sun, dusk, stars).
import * as THREE from 'three';
import { rng } from '../core/noise.js';
import { surface } from '../core/textures.js';
import { Thing, panel } from './thing.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Merge every plain mesh in a group into one mesh per material (hundreds of draw calls -> a few)
function mergeStatic(grp) {
  grp.updateMatrixWorld(true);
  const byMat = new Map(), remove = [];
  grp.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ng.deleteAttribute(k);
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    if (!byMat.has(o.material)) byMat.set(o.material, { list: [], shadow: false });
    const e = byMat.get(o.material); e.list.push(ng); e.shadow = e.shadow || o.castShadow;
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  for (const [m, e] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(e.list, false), m);
    mesh.castShadow = e.shadow; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    grp.add(mesh);
  }
}

const GROUND = -3.05; // ground level (your room is upstairs)

export function buildOutsideColliders(game, houses) {
  const t = new Thing({ name: 'outside', surface: 'carpet', tags: ['noShrink'] });
  // the ground (with a hole where the house + basement are)
  panel(t, { axis: 'y', at: GROUND - 0.5, rect: [-1000, -1000, 1000, 1000], thick: 1, m: 'concrete', holes: [[-8.4, -4.6, 8.5, 1.92]], o: { visual: false } });
  for (const h of houses) t.box(h.size, h.pos, 'wall', { visual: false, rot: [0, h.rot, 0] });
  t.build(game.engine.scene);
  t.material = 'carpet';
  return t;
}

export function buildOutside(game) {
  const scene = game.engine.scene;
  const solidHouses = [];
  const R = rng(42);
  const grp = new THREE.Group(); grp.name = 'outside'; scene.add(grp);
  const std = (c, r = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });

  // ground: grass + fields
  const grassTex = surface('carpet', { color: 0x4d7a32, size: 256 });
  const gm = std(0x6a8f45, 1, { map: grassTex.map.clone() }); gm.map.repeat.set(200, 200); gm.map.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), gm); ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true; ground.userData.keep = true; grp.add(ground);
  // our yard: lawn, path, driveway; our house walls (the outside of the house)
  const houseMat = std(0xb9b2a3, 0.85, { side: THREE.DoubleSide });
  const house = new THREE.Mesh(new THREE.BoxGeometry(12.3, 6.1, 9.3), houseMat); house.position.set(-2.5, GROUND + 3.05 - 0.01, -1.6);
  house.geometry.translate(0, 0, 0); house.material.side = THREE.BackSide; // only seen from outside... BackSide trick avoids covering the room
  void house;
  const roofMat = std(0x4a3b36, 0.8);
  // gable roof over the house (ridge east-west) + a lower roof on the garage
  const roof = new THREE.Group(); roof.userData.keep = true;
  const span = 6.52 + 0.6, rise = 2.2, slope = Math.hypot(span / 2, rise);
  for (const side of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(11.3, 0.12, slope), roofMat);
    pl.position.set(-3.14, 2.7 + rise / 2, -1.34 + side * span / 4); pl.rotation.x = side * Math.atan2(rise, span / 2); pl.castShadow = true; roof.add(pl);
  }
  const gableShape = new THREE.Shape(); gableShape.moveTo(-span / 2 + 0.3, 0); gableShape.lineTo(span / 2 - 0.3, 0); gableShape.lineTo(0, rise - 0.1); gableShape.lineTo(-span / 2 + 0.3, 0);
  for (const x of [-8.4, 2.12]) { const gm2 = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), houseMat); gm2.material.side = THREE.DoubleSide; gm2.rotation.y = Math.PI / 2; gm2.position.set(x, 2.7, -1.34); roof.add(gm2); }
  const gr = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.12, 6.9), roofMat); gr.position.set(5.31, 0.6, -1.34); gr.rotation.z = -0.08; gr.castShadow = true; roof.add(gr);
  grp.add(roof);
  game.roofMesh = roof;
  // street
  const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 9), std(0x2d2f33, 0.95)); road.rotation.x = -Math.PI / 2; road.position.set(0, GROUND + 0.01, 16); grp.add(road);
  const side = std(0xb8b4aa, 0.9);
  for (const z of [10.5, 21.5]) { const s = new THREE.Mesh(new THREE.BoxGeometry(600, 0.15, 2), side); s.position.set(0, GROUND + 0.075, z); s.receiveShadow = true; grp.add(s); }
  const lines = new THREE.InstancedMesh(new THREE.PlaneGeometry(3, 0.15), std(0xe8d36a, 0.6), 80);
  for (let i = 0; i < 80; i++) { const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(-300 + i * 7.5, GROUND + 0.02, 16); lines.setMatrixAt(i, m); }
  grp.add(lines);
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(4, 7.5), std(0x8f8b84, 0.95)); drive.rotation.x = -Math.PI / 2; drive.position.set(5.5, GROUND + 0.012, 6.5); grp.add(drive);

  // neighbors' houses across the street + along our side
  const wallCols = [0xd9cfbd, 0xc4d1d6, 0xe6dccb, 0xb7c4a8, 0xe0c9b2, 0xcfd3d8, 0xf0e8d8];
  const roofCols = [0x5a4038, 0x3e4552, 0x6b5a4a, 0x2f3338];
  const winMat = std(0x28323f, 0.15, { metalness: 0.4, emissive: 0xffd69a, emissiveIntensity: 0 });
  game.outsideWindows = winMat;
  const addHouse = (x, z, facing) => {
    const w = 9 + R() * 4, d = 8 + R() * 3, h = R() < 0.5 ? 3 : 5.8;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(wallCols[(R() * wallCols.length) | 0], 0.85)); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.2, 4), std(roofCols[(R() * roofCols.length) | 0], 0.8)); rf.rotation.y = Math.PI / 4; rf.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); rf.position.y = h + 1.1; rf.castShadow = true; g.add(rf);
    for (let i = 0; i < 4; i++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.3), winMat); win.position.set(-w / 2 + 1.5 + i * (w - 3) / 3, h > 4 ? 4.2 : 1.6, d / 2 + 0.01); g.add(win); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.1), std(0x5b3a25, 0.6)); door.position.set(0.5, 1.05, d / 2 + 0.01); g.add(door);
    const garage = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.3), std(0xe8e6e0, 0.6)); garage.position.set(w / 2 - 2, 1.15, d / 2 + 0.01); g.add(garage);
    g.position.set(x, GROUND, z); g.rotation.y = facing; grp.add(g);
    solidHouses.push({ size: [w, h + 1.5, d], pos: [x, GROUND + (h + 1.5) / 2, z], rot: facing });
  };
  for (let i = -6; i <= 6; i++) addHouse(i * 15 + (R() - 0.5) * 3, 30, Math.PI);
  for (const i of [-3, -2, -1, 1, 2]) addHouse(-2.5 + i * 16, -1.6, 0);
  // parked cars
  const carCols = [0xb0b6bd, 0x1e2a44, 0x8a1c1c, 0xf2f2f2, 0x222222];
  for (let i = 0; i < 7; i++) {
    const car = new THREE.Group(), m = std(carCols[i % carCols.length], 0.3, { metalness: 0.6 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.75, 1.8), m); b.position.y = 0.6; b.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.6), std(0x1a2028, 0.1, { metalness: 0.5 })); cab.position.set(-0.2, 1.25, 0);
    car.add(b, cab);
    for (const [x, z] of [[1.4, 0.85], [-1.4, 0.85], [1.4, -0.85], [-1.4, -0.85]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 16), std(0x111111, 0.9)); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.33, z); car.add(wh); }
    car.position.set(-60 + i * 19 + R() * 4, GROUND, i % 2 ? 13 : 19); grp.add(car);
  }
  // trees: oaks + palms (west coast)
  const trunkM = std(0x5a4330, 0.95), leafM = std(0x3f6b2c, 0.9), palmM = std(0x5f8a35, 0.8);
  const tree = (x, z, palm) => {
    const t = new THREE.Group();
    if (palm) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 9, 8), std(0x8a7558, 0.95)); tr.position.y = 4.5; t.add(tr);
      for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 4), palmM); f.position.set(Math.cos(i) * 1.2, 8.6, Math.sin(i) * 1.2); f.rotation.set(Math.sin(i) * 1.3, 0, -Math.cos(i) * 1.3); t.add(f); }
    } else {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 3.5, 8), trunkM); tr.position.y = 1.75; tr.castShadow = true; t.add(tr);
      for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 + R(), 1), leafM); c.position.set((R() - 0.5) * 2.5, 4.3 + R() * 1.5, (R() - 0.5) * 2.5); c.castShadow = true; t.add(c); }
    }
    t.position.set(x, GROUND, z); grp.add(t);
  };
  for (let i = -8; i <= 8; i++) tree(i * 13 + 6, 23.5, i % 3 === 0);
  tree(4, 9, false); tree(-9, 8, true);
  // fields + hills to the east and north
  const field = std(0x9a8f4a, 1);
  for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), i % 2 ? field : std(0x7d8f3e, 1)); f.rotation.x = -Math.PI / 2; f.position.set(40 + (i % 3) * 62, GROUND + 0.02, -30 + Math.floor(i / 3) * 42); grp.add(f); }
  for (let i = 0; i < 9; i++) { const hl = new THREE.Mesh(new THREE.SphereGeometry(60 + R() * 60, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x6f7d45, 1)); hl.scale.y = 0.3; hl.position.set(250 + R() * 200, GROUND - 2, -300 + i * 70); grp.add(hl); }
  for (let i = 0; i < 30; i++) tree(30 + R() * 160, -60 + R() * 120, false);
  // city skyline far to the south-west (lights up at night)
  const cityMat = std(0x7d8794, 0.6, { emissive: 0xffd9a0, emissiveIntensity: 0, emissiveMap: cityWindows() });
  game.cityMat = cityMat;
  for (let i = 0; i < 60; i++) {
    const h = 20 + R() * R() * 140, w = 14 + R() * 20;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), cityMat);
    b.position.set(-700 + R() * 600, GROUND + h / 2, 600 + R() * 250); grp.add(b);
  }
  // sky dome + stars
  const skyGeo = new THREE.SphereGeometry(1500, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x4a7ac0) }, horizon: { value: new THREE.Color(0xc8dcef) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff3d0) }, night: { value: 0 } },
    vertexShader: `varying vec3 vDir;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vDir;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        #include <logdepthbuf_fragment>
        float y = max(vDir.y, 0.0);
        vec3 c = mix(horizon, top, pow(y, 0.55));
        float s = max(dot(vDir, normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.25) * (1.0 - night);
        vec3 q = floor(vDir * 420.0);
        float star = step(0.9975, h(q)) * night * smoothstep(0.0, 0.2, vDir.y);
        c += vec3(star);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // (sky is added after merging so it can follow the camera)
  grp.position.set(0, 0, 0);
  mergeStatic(grp);
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.frustumCulled = false; scene.add(sky);
  game.skyDome = sky;
  buildOutsideColliders(game, solidHouses);
  return grp;
}

function cityWindows() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if (Math.random() < 0.45) { x.fillStyle = `rgba(255,${200 + Math.random() * 55 | 0},150,${0.5 + Math.random() * 0.5})`; x.fillRect(i * 8 + 2, j * 8 + 2, 4, 4); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 6); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// called every frame with daylight 0..1
export function updateOutside(game, day) {
  const sky = game.skyDome; if (!sky) return;
  const u = sky.material.uniforms;
  const night = 1 - day;
  u.night.value = night;
  u.sunDir.value.copy(game.engine.sunDirection());
  u.top.value.setRGB(0.03 + day * 0.27, 0.05 + day * 0.43, 0.12 + day * 0.63);
  const dusk = Math.sin(Math.min(1, day) * Math.PI) * (day < 1 ? 1 : 0);
  u.horizon.value.setRGB(0.06 + day * 0.72 + dusk * 0.4, 0.08 + day * 0.78 + dusk * 0.1, 0.15 + day * 0.78 - dusk * 0.2);
  game.cityMat.emissiveIntensity = night * 1.2;
  game.outsideWindows.emissiveIntensity = night * 0.8;
  sky.position.copy(game.engine.camera.position);
}
