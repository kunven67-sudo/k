// The house, built at 1:1 real-world scale in centimetres - which makes it colossal for a player
// who is 1.8cm tall. Bedroom, living room, kitchen and bathroom, packed with decorations,
// hazards, creatures, light shafts and dust.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/examples/jsm/environments/RoomEnvironment.js';
import { World } from '../core/physics.js';
import * as TX from '../core/textures.js';
import { worldBox, addDetailNormal, setEnvIntensity, scaleUV } from '../core/materials.js';
import { getPreset } from '../core/settings.js';
import { mulberry32 } from '../core/noise.js';
import {
  houseMaterials, rbox, mesh, block, cylinder, bed, pillow, desk, deskLamp, bookshelf, rug, brick, plant,
  frame, paperAirplaneGeometry, coinMesh, phoneMesh,
} from './props.js';
import { Dog, Vacuum, Cockroach } from '../game/houseCreatures.js';

const H = 260, T = 12;
export const ROOMS = {
  bedroom: { x0: 0, x1: 420, z0: 0, z1: 400, name: 'Bedroom' },
  bathroom: { x0: 0, x1: 420, z0: 412, z1: 900, name: 'Bathroom' },
  living: { x0: 432, x1: 1040, z0: 0, z1: 540, name: 'Living Room' },
  kitchen: { x0: 432, x1: 1040, z0: 552, z1: 900, name: 'Kitchen' },
};

export function roomAt(x, z) {
  for (const [k, r] of Object.entries(ROOMS)) if (x >= r.x0 - 6 && x <= r.x1 + 6 && z >= r.z0 - 6 && z <= r.z1 + 6) return k;
  return null;
}

export function createHouse(renderer) {
  const preset = getPreset();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);
  const world = new World();
  world.gravity = 34; world.terminal = 22; world.killY = -50;
  const group = new THREE.Group();
  scene.add(group);
  const ctx = { group, world, scene };
  const M = houseMaterials();
  [M.floorWood, M.rugBed, M.rugLiving, M.tileKitchen, M.tileBath, M.duvet, M.sofa, M.woodLight, M.woodDark].forEach((m) => addDetailNormal(m, 7, 0.5));

  const level = {
    id: 'house', scene, world, group, M,
    interactables: [], creatures: [], updaters: [], coins: [], crumbs: [],
    music: 'wonder', ambience: [],
    spawns: {}, refs: {},
  };

  // ------------------------------------------------------------ floors & ceilings
  const floorPlane = (r, mat, tile, surface) => {
    const w = r.x1 - r.x0 + T, d = r.z1 - r.z0 + T;
    const g = scaleUV(new THREE.PlaneGeometry(w, d), w / tile, d / tile);
    const m = mesh(g, mat, (r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2, group, { rx: -Math.PI / 2, cast: false });
    m.receiveShadow = true;
    world.addBox((r.x0 + r.x1) / 2, -5, (r.z0 + r.z1) / 2, w / 2, 5, d / 2, { surface });
    const c = mesh(worldBox(w, T, d, 120), M.ceiling, (r.x0 + r.x1) / 2, H + T / 2, (r.z0 + r.z1) / 2, group, { cast: false });
    void c;
  };
  floorPlane(ROOMS.bedroom, M.floorWood, 90, 'wood');
  floorPlane(ROOMS.living, M.floorWood, 90, 'wood');
  floorPlane(ROOMS.kitchen, M.tileKitchen, 120, 'tile');
  floorPlane(ROOMS.bathroom, M.tileBath, 90, 'tile');
  // floor under the door gaps
  world.addBox(426, -5, 450, 8, 5, 460, { surface: 'wood' });
  world.addBox(736, -5, 546, 310, 5, 8, { surface: 'tile' });

  // ------------------------------------------------------------ walls
  const exterior = M.wallLiving;
  const trimM = M.trim;
  // Wall along X (thin in Z) or along Z (thin in X) with rectangular openings.
  function wall(axis, a0, a1, c0, c1, openings, matNeg, matPos) {
    const segs = [];
    const ops = [...openings].sort((p, q) => p.from - q.from);
    let cur = a0;
    for (const o of ops) {
      if (o.from > cur) segs.push([cur, o.from, 0, H]);
      if (o.bottom > 0) segs.push([o.from, o.to, 0, o.bottom]);
      if (o.top < H) segs.push([o.from, o.to, o.top, H]);
      cur = o.to;
    }
    if (cur < a1) segs.push([cur, a1, 0, H]);
    for (const [s0, s1, y0, y1] of segs) {
      const len = s1 - s0, th = c1 - c0, hh = y1 - y0;
      const mid = (s0 + s1) / 2, cmid = (c0 + c1) / 2;
      let geo, mats, x, z;
      if (axis === 'x') {
        geo = worldBox(len, hh, th, 100);
        mats = [trimM, trimM, trimM, trimM, matPos, matNeg];
        x = mid; z = cmid;
        world.addBox(x, (y0 + y1) / 2, z, len / 2, hh / 2, th / 2, { surface: 'wood' });
      } else {
        geo = worldBox(th, hh, len, 100);
        mats = [matPos, matNeg, trimM, trimM, trimM, trimM];
        x = cmid; z = mid;
        world.addBox(x, (y0 + y1) / 2, z, th / 2, hh / 2, len / 2, { surface: 'wood' });
      }
      const m = new THREE.Mesh(geo, mats);
      m.position.set(x, (y0 + y1) / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
    }
  }
  const winBed = { from: 250, to: 400, bottom: 100, top: 215 };
  const winL1 = { from: 520, to: 660, bottom: 90, top: 220 };
  const winL2 = { from: 780, to: 920, bottom: 90, top: 220 };
  wall('x', -T, 426, -T, 0, [winBed], exterior, M.wallBed);
  wall('x', 426, 1040 + T, -T, 0, [winL1, winL2], exterior, M.wallLiving);
  const winK = { from: 650, to: 800, bottom: 110, top: 200 };
  wall('x', -T, 426, 900, 900 + T, [], M.wallBath, exterior);
  wall('x', 426, 1040 + T, 900, 900 + T, [winK], M.wallKitchen, exterior);
  const winBath = { from: 640, to: 720, bottom: 150, top: 210 };
  wall('z', 0, 406, -T, 0, [], exterior, M.wallBed);
  wall('z', 406, 900, -T, 0, [winBath], exterior, M.wallBath);
  const frontDoor = { from: 180, to: 275, bottom: 0, top: 212 };
  wall('z', 0, 546, 1040, 1040 + T, [frontDoor], M.wallLiving, exterior);
  wall('z', 546, 900, 1040, 1040 + T, [], M.wallKitchen, exterior);
  const bedDoor = { from: 290, to: 380, bottom: 0, top: 205 };
  const bathDoor = { from: 440, to: 530, bottom: 0, top: 205 };
  wall('z', 0, 400, 420, 432, [bedDoor], M.wallBed, M.wallLiving);
  wall('z', 400, 546, 420, 432, [bathDoor], M.wallBath, M.wallLiving);
  wall('z', 546, 900, 420, 432, [], M.wallBath, M.wallKitchen);
  wall('x', 0, 420, 400, 412, [], M.wallBed, M.wallBath);
  const arch = { from: 620, to: 900, bottom: 0, top: 215 };
  wall('x', 432, 1040, 540, 552, [arch], M.wallLiving, M.wallKitchen);

  // Baseboards: 10cm tall, 1.5cm deep - waist-high ledges for a tiny person.
  const bbM = M.trim;
  function baseboard(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1) return;
    const alongX = Math.abs(z1 - z0) < 0.01;
    const w = alongX ? len : 1.5, d = alongX ? 1.5 : len;
    mesh(rbox(w, 10, d, 0.4), bbM, (x0 + x1) / 2, 5, (z0 + z1) / 2, group, { cast: false });
  }
  // bedroom
  baseboard(0, 0.75, 420, 0.75); baseboard(0, 399.25, 420, 399.25); baseboard(0.75, 0, 0.75, 400);
  baseboard(419.25, 0, 419.25, 290); baseboard(419.25, 380, 419.25, 400);
  // living
  baseboard(432, 0.75, 1040, 0.75); baseboard(1039.25, 0, 1039.25, 180); baseboard(1039.25, 275, 1039.25, 540);
  baseboard(432.75, 0, 432.75, 290); baseboard(432.75, 380, 432.75, 440); baseboard(432.75, 530, 432.75, 540);
  baseboard(432, 539.25, 620, 539.25); baseboard(900, 539.25, 1040, 539.25);
  // bathroom
  baseboard(0.75, 412, 0.75, 900); baseboard(0, 412.75, 420, 412.75); baseboard(0, 899.25, 420, 899.25); baseboard(419.25, 412, 419.25, 440); baseboard(419.25, 530, 419.25, 900);
  // kitchen
  baseboard(432, 552.75, 620, 552.75); baseboard(900, 552.75, 1040, 552.75); baseboard(432.75, 552, 432.75, 900); baseboard(1039.25, 552, 1039.25, 900);
  // baseboard colliders are thin enough to fold into the wall boxes, but add them for the ledge feel
  world.addAABB(0, 0, 0, 420, 10, 1.5); world.addAABB(432, 0, 0, 1040, 10, 1.5);

  // ------------------------------------------------------------ doors (with the famous 2.6cm gap)
  const GAP = 2.6;
  function door(axis, x, z, width, height, handleSide = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    const th = 4;
    const slabW = axis === 'z' ? th : width, slabD = axis === 'z' ? width : th;
    const slab = mesh(rbox(slabW, height - GAP, slabD, 0.6), M.door, 0, GAP + (height - GAP) / 2, 0, g);
    // raised panels
    for (const py of [60, 150]) {
      const pw = axis === 'z' ? th + 0.8 : width * 0.7, pd = axis === 'z' ? width * 0.7 : th + 0.8;
      mesh(rbox(pw, 70, pd, 1.2), M.door, 0, py, 0, g);
    }
    // lever handles both sides
    [-1, 1].forEach((s) => {
      const hx = axis === 'z' ? s * 4.5 : width * 0.4 * handleSide, hz = axis === 'z' ? width * 0.4 * handleSide : s * 4.5;
      mesh(new THREE.CylinderGeometry(3, 3, 1.5, 24), M.chrome, hx, 100, hz, g, { rz: axis === 'z' ? Math.PI / 2 : 0, rx: axis === 'z' ? 0 : Math.PI / 2 });
      const lever = mesh(rbox(axis === 'z' ? 2 : 12, 2, axis === 'z' ? 12 : 2, 0.9), M.chrome, hx + (axis === 'z' ? s * 2 : 0), 100, hz + (axis === 'z' ? 0 : s * 2), g);
      lever.position[axis === 'z' ? 'z' : 'x'] += -5 * handleSide;
    });
    world.addBox(x, GAP + (height - GAP) / 2, z, slabW / 2, (height - GAP) / 2, slabD / 2, { surface: 'wood' });
    // casing trim
    const cw = 7;
    if (axis === 'z') {
      [-1, 1].forEach((s) => {
        mesh(rbox(T + 2, cw, width + cw * 2, 0.5), M.trim, 0, height + cw / 2, 0, g);
        mesh(rbox(T + 2, height, cw, 0.5), M.trim, 0, height / 2, s * (width / 2 + cw / 2), g);
      });
    } else {
      [-1, 1].forEach((s) => {
        mesh(rbox(width + cw * 2, cw, T + 2, 0.5), M.trim, 0, height + cw / 2, 0, g);
        mesh(rbox(cw, height, T + 2, 0.5), M.trim, s * (width / 2 + cw / 2), height / 2, 0, g);
      });
    }
    // Light leaking through the gap: a thin emissive strip on the floor side.
    return { group: g, slab };
  }
  level.refs.bedDoor = door('z', 426, 335, 90, 205, 1);
  level.refs.bathDoor = door('z', 426, 485, 90, 205, -1);
  level.refs.frontDoor = door('z', 1046, 227.5, 95, 212, 1);
  // front-door mat
  const matTex = TX.drawn('doormat', 512, 320, (c, w, h) => {
    c.fillStyle = '#6b4a2e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${40 + Math.random() * 60},${25 + Math.random() * 40},10,0.5)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 5); }
    c.fillStyle = '#2d1c10'; c.font = 'bold 90px Georgia'; c.textAlign = 'center'; c.fillText('HELLO', w / 2, h / 2 + 30);
  });
  mesh(rbox(55, 1.2, 90, 0.5), new THREE.MeshStandardMaterial({ map: matTex, roughness: 1 }), 1005, 0.6, 227.5, group, { cast: false });
  world.addBox(1005, 0.6, 227.5, 27.5, 0.6, 45, { surface: 'carpet' });

  // ------------------------------------------------------------ windows + the bright world outside
  const outsideTex = TX.drawn('outsideDay', 1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8fc4ff'); g.addColorStop(0.55, '#dcefff'); g.addColorStop(0.62, '#9bbf73'); g.addColorStop(1, '#5d8a3f');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.filter = 'blur(6px)';
    for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(${40 + i * 3},${90 + i * 4},${40},0.9)`; c.beginPath(); c.arc(Math.random() * w, h * 0.55, 60 + Math.random() * 90, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h * 0.3, 80, 25, 0, 0, Math.PI * 2); c.fill(); }
    c.filter = 'none';
  });
  const outsideNight = TX.drawn('outsideNight', 1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#040814'); g.addColorStop(0.6, '#0e1a33'); g.addColorStop(0.65, '#050a08'); g.addColorStop(1, '#020403');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${Math.random()})`; c.fillRect(Math.random() * w, Math.random() * h * 0.55, 1.5, 1.5); }
    c.fillStyle = '#e8eef8'; c.beginPath(); c.arc(w * 0.7, h * 0.18, 26, 0, Math.PI * 2); c.fill();
  });
  const outsideMat = new THREE.MeshBasicMaterial({ map: outsideTex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: true });
  level.refs.outsideMat = outsideMat; level.refs.outsideTex = outsideTex; level.refs.outsideNight = outsideNight;
  function windowAt(axis, a0, a1, y0, y1, wallC, outDir, withCurtains = true) {
    const w = a1 - a0, h = y1 - y0, mid = (a0 + a1) / 2, ym = (y0 + y1) / 2;
    const g = new THREE.Group(); group.add(g);
    if (axis === 'x') g.position.set(mid, ym, wallC); else { g.position.set(wallC, ym, mid); g.rotation.y = Math.PI / 2; }
    // frame, mullions, sill
    const fw = 5;
    [[0, h / 2 - fw / 2, w, fw], [0, -h / 2 + fw / 2, w, fw], [-w / 2 + fw / 2, 0, fw, h], [w / 2 - fw / 2, 0, fw, h], [0, 0, 3, h], [0, 0, w, 3]].forEach(([x, y, ww, hh]) => {
      mesh(rbox(ww, hh, T + 1, 0.4), M.trim, x, y, 0, g);
    });
    mesh(rbox(w + 16, 3, T + 10, 0.8), M.trim, 0, -h / 2 - 1.5, outDir * -5, g);
    const glass = mesh(new THREE.PlaneGeometry(w, h), M.glass, 0, 0, 0, g, { cast: false });
    glass.renderOrder = 2;
    // outside backdrop
    const back = mesh(new THREE.PlaneGeometry(w * 6, h * 5), outsideMat, 0, 30, outDir * 260, g, { cast: false, receive: false, ry: outDir > 0 ? Math.PI : 0 });
    back.castShadow = false;
    if (withCurtains) {
      [-1, 1].forEach((s) => {
        const cg = new THREE.PlaneGeometry(w * 0.32, h + 50, 24, 12);
        const p = cg.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.45) * 3 + Math.sin(p.getX(i) * 0.17) * 2);
        cg.computeVertexNormals();
        mesh(cg, M.curtain, s * (w / 2 + w * 0.08), -10, outDir * -(T / 2 + 5), g);
      });
      mesh(new THREE.CylinderGeometry(1.2, 1.2, w * 1.6, 12), M.brass, 0, h / 2 + 20, outDir * -(T / 2 + 5), g, { rz: Math.PI / 2 });
    }
    return g;
  }
  windowAt('x', winBed.from, winBed.to, winBed.bottom, winBed.top, -T / 2, -1);
  windowAt('x', winL1.from, winL1.to, winL1.bottom, winL1.top, -T / 2, -1);
  windowAt('x', winL2.from, winL2.to, winL2.bottom, winL2.top, -T / 2, -1);
  windowAt('x', winK.from, winK.to, winK.bottom, winK.top, 900 + T / 2, 1, false);
  windowAt('z', winBath.from, winBath.to, winBath.bottom, winBath.top, -T / 2, -1, false);

  // ------------------------------------------------------------ lights
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();
  scene.environment = preset.envMap ? envTex : null;

  const hemi = new THREE.HemisphereLight(0xe3ecff, 0x6b5238, 0.75);
  scene.add(hemi);
  const sunDir = new THREE.Vector3(0.28, -0.72, 1).normalize();
  function makeSun(winCenter, spread) {
    const s = new THREE.SpotLight(0xfff0d6, 7, 0, Math.atan(spread / 1500) * 1.1, 0.25, 0);
    s.position.copy(winCenter).addScaledVector(sunDir, -1500);
    s.target.position.copy(winCenter).addScaledVector(sunDir, 200);
    s.castShadow = preset.shadows;
    s.shadow.mapSize.set(preset.shadowMap, preset.shadowMap);
    s.shadow.camera.near = 1200; s.shadow.camera.far = 2200;
    s.shadow.bias = -0.00008; s.shadow.normalBias = 0.02;
    s.shadow.radius = 3;
    scene.add(s, s.target);
    return s;
  }
  const sunBed = makeSun(new THREE.Vector3(325, 157, -6), 150);
  const sunLiving = makeSun(new THREE.Vector3(720, 155, -6), 280);
  level.refs.sunBed = sunBed; level.refs.sunLiving = sunLiving;

  const fill = new THREE.DirectionalLight(0xfff3e6, 0.55);
  fill.position.set(0, 300, 0);
  fill.castShadow = preset.shadows;
  fill.shadow.mapSize.set(Math.min(2048, preset.shadowMap), Math.min(2048, preset.shadowMap));
  const fr = 45;
  Object.assign(fill.shadow.camera, { left: -fr, right: fr, top: fr, bottom: -fr, near: 1, far: 600 });
  fill.shadow.bias = -0.0004; fill.shadow.normalBias = 0.05; fill.shadow.radius = 4;
  fill.shadow.camera.updateProjectionMatrix();
  scene.add(fill, fill.target);
  level.refs.fill = fill;

  const lampLiving = new THREE.PointLight(0xffb36b, 9000, 520, 2);
  lampLiving.position.set(880, 150, 40);
  scene.add(lampLiving);
  const kitchenLight = new THREE.PointLight(0xfff0dc, 6500, 700, 2);
  kitchenLight.position.set(730, 240, 720);
  scene.add(kitchenLight);
  const bathLight = new THREE.PointLight(0xf0f6ff, 8000, 600, 2);
  bathLight.position.set(210, 240, 650);
  scene.add(bathLight);
  const moon = new THREE.SpotLight(0x7f9cff, 0, 0, Math.atan(150 / 1500) * 1.1, 0.4, 0);
  moon.position.copy(sunBed.position); moon.target.position.copy(sunBed.target.position);
  scene.add(moon, moon.target);
  const phoneGlow = new THREE.PointLight(0x9ec4ff, 0, 180, 2);
  scene.add(phoneGlow);
  level.refs.lights = { hemi, lampLiving, kitchenLight, bathLight, moon, phoneGlow };

  // Volumetric-looking light shafts + dust motes drifting through them.
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.88, 0.66) }, uStrength: { value: 0.12 } },
    vertexShader: `varying vec3 vP; varying vec3 vW; void main(){ vP = position; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uStrength; varying vec3 vP; varying vec3 vW;
      void main(){
        float along = vP.z + 0.5;
        float edge = smoothstep(0.5, 0.3, abs(vP.x)) * smoothstep(0.5, 0.3, abs(vP.y));
        float n = 0.75 + 0.25 * sin(vW.x * 0.05 + uTime * 0.3) * sin(vW.z * 0.04 - uTime * 0.2);
        float a = edge * pow(1.0 - along, 1.3) * n * uStrength;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  });
  level.refs.beamMat = beamMat;
  const beams = [];
  function beam(winCenter, width, height, length = 360) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Mesh(geo, beamMat);
    const u = new THREE.Vector3(1, 0, 0).multiplyScalar(width);
    const v = new THREE.Vector3(0, 1, 0).multiplyScalar(height);
    const w = sunDir.clone().multiplyScalar(length);
    const basis = new THREE.Matrix4().makeBasis(u, v, w);
    basis.setPosition(winCenter.clone().addScaledVector(sunDir, length / 2 + 4));
    m.matrixAutoUpdate = false;
    m.matrix.copy(basis);
    m.frustumCulled = false;
    m.renderOrder = 5;
    group.add(m);
    beams.push(m);
    // dust motes
    const N = Math.round(420 * preset.particles);
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() - 0.5, b = Math.random() - 0.5, c = Math.random() * 0.8;
      const p = winCenter.clone().addScaledVector(u, a * 0.85).addScaledVector(v, b * 0.85).addScaledVector(sunDir, c * length + 6);
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; seed[i] = Math.random() * 100;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const pm = new THREE.ShaderMaterial({
      uniforms: { uTime: beamMat.uniforms.uTime, uTex: { value: TX.softDot('#fff6e0', 'mote') }, uStrength: { value: 1 } },
      vertexShader: `attribute float seed; uniform float uTime; varying float vA;
        void main(){ vec3 p = position; p.x += sin(uTime*0.13 + seed)*6.0; p.y += sin(uTime*0.09 + seed*1.7)*5.0; p.z += cos(uTime*0.11 + seed*0.7)*6.0;
          vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(90.0 / -mv.z, 1.0, 18.0); vA = 0.5 + 0.5*sin(uTime*1.3 + seed*3.0); }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uStrength; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(t.rgb * t.a * vA * 0.9 * uStrength, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(pg, pm);
    pts.frustumCulled = false;
    group.add(pts);
    beams.push(pts);
    return { m, pts, pm };
  }
  level.refs.beamBed = beam(new THREE.Vector3(325, 157, -2), 140, 110);
  level.refs.beamL1 = beam(new THREE.Vector3(590, 155, -2), 130, 125);
  level.refs.beamL2 = beam(new THREE.Vector3(850, 155, -2), 130, 125);
  level.refs.beams = beams;

  // ------------------------------------------------------------ BEDROOM
  const bedInfo = bed(ctx, M, 30, 0, 140, 210);
  level.refs.bedTop = bedInfo.topY;
  pillow(ctx, M, 100, 56, 32, 92, 44, 15, 0.05);
  level.refs.fallenPillow = pillow(ctx, M, 212, 0, 96, 64, 46, 19, 1.35, 0.06);
  const deskInfo = desk(ctx, M, 285, 0, 125, 62, 58);
  level.refs.deskTop = deskInfo.top;
  level.refs.deskLamp = deskLamp(ctx, M, 396, 58, 18);
  // The phone. Lying on the desk exactly where you left it.
  const phoneScreenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x000000, roughness: 0.08, metalness: 0.2 });
  const phone = phoneMesh(M, phoneScreenMat);
  phone.group.position.set(335, 58, 28); phone.group.rotation.y = 0.18;
  group.add(phone.group);
  world.addBox(335, 58.4, 28, 3.75, 0.4, 7.75, { yaw: 0.18, surface: 'glass' });
  level.refs.phone = phone; level.refs.phoneScreenMat = phoneScreenMat;
  // desk clutter
  const mugM = new THREE.MeshPhysicalMaterial({ color: 0xd9533b, roughness: 0.2, clearcoat: 1 });
  cylinder(ctx, 4, 9.5, mugM, 302, 58, 46, { seg: 32 });
  mesh(new THREE.TorusGeometry(2.6, 0.6, 10, 20), mugM, 306.3, 63, 46, group, { ry: Math.PI / 2 });
  cylinder(ctx, 3.8, 11, M.plasticBlack, 380, 58, 48, { seg: 24 });
  const pencilM = [M.plasticYellow, M.plasticRed, M.plasticBlue];
  for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(0.4, 0.4, 18, 6), pencilM[i % 3], 380 + Math.cos(i * 1.3) * 1.8, 67, 48 + Math.sin(i * 1.3) * 1.8, group, { rx: Math.sin(i) * 0.15, rz: Math.cos(i) * 0.15 });
  block(ctx, 15, 1.2, 21, M.plasticBlue, 360, 58, 47, { ry: -0.3, round: 0.3, surface: 'paper' });
  const note = TX.drawn('stickynote', 256, 256, (c, w, h) => { c.fillStyle = '#fff27a'; c.fillRect(0, 0, w, h); c.fillStyle = '#334'; c.font = '28px "Comic Sans MS", cursive'; c.fillText('charge phone!!', 18, 90); c.fillText('math hw due', 18, 150); c.fillText('feed biscuit', 18, 210); });
  mesh(new THREE.PlaneGeometry(7.6, 7.6), new THREE.MeshStandardMaterial({ map: note, roughness: 0.8 }), 357, 59.3, 44, group, { rx: -Math.PI / 2, rz: 0.2, cast: false });
  const cubeTex = TX.drawn('rubik', 256, 256, (c, w, h) => { const cols = ['#e33', '#fc2', '#2a4', '#27d', '#fff', '#f82']; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { c.fillStyle = '#111'; c.fillRect(i * w / 3, j * h / 3, w / 3, h / 3); c.fillStyle = cols[(i * 3 + j * 2) % 6]; c.fillRect(i * w / 3 + 6, j * h / 3 + 6, w / 3 - 12, h / 3 - 12); } });
  block(ctx, 5.7, 5.7, 5.7, new THREE.MeshPhysicalMaterial({ map: cubeTex, roughness: 0.3, clearcoat: 0.8 }), 300, 58, 14, { ry: 0.4, round: 0.4 });
  // headphones resting on the desk
  const hp = new THREE.Group(); hp.position.set(318, 60, 50); hp.rotation.set(Math.PI / 2 - 0.2, 0, 0.5); group.add(hp);
  mesh(new THREE.TorusGeometry(8, 0.8, 10, 32, Math.PI), M.plasticBlack, 0, 0, 0, hp);
  [-1, 1].forEach((s) => mesh(new THREE.CylinderGeometry(3.5, 3.5, 2.5, 24), M.plasticBlack, s * 8, 0, 0, hp, { rz: Math.PI / 2 }));
  // desk chair
  const chairX = 348, chairZ = 82;
  block(ctx, 42, 5, 40, M.woodDark, chairX, 42, chairZ, { round: 1.2 });
  block(ctx, 40, 6, 36, M.cushion, chairX, 47, chairZ, { round: 2.5, soft: true, surface: 'fabric' });
  [[-18, -16], [18, -16], [-18, 16], [18, 16]].forEach(([dx, dz]) => block(ctx, 3.5, 42, 3.5, M.woodDark, chairX + dx, 0, chairZ + dz, { round: 0.5 }));
  block(ctx, 40, 45, 3, M.woodDark, chairX, 47, chairZ + 19, { round: 1 });
  // rug
  rug(ctx, M.rugBed, 120, 215, 210, 140, 0.45);
  bookshelf(ctx, M, 250, 372, 150, 28, 180, 5);
  // dresser + things on it
  block(ctx, 48, 85, 110, M.woodLight, 24, 0, 290);
  for (let i = 0; i < 4; i++) { mesh(rbox(1.5, 17, 100, 0.6), M.woodLight, 48.5, 10 + i * 19.5, 290, group); mesh(new THREE.SphereGeometry(1.4, 12, 8), M.brass, 49.8, 18 + i * 19.5, 290, group); }
  const trophyM = new THREE.MeshStandardMaterial({ color: 0xe8b84a, metalness: 1, roughness: 0.2 });
  cylinder(ctx, 4, 3, M.woodDark, 20, 85, 262); mesh(new THREE.CylinderGeometry(4, 1, 12, 20), trophyM, 20, 94, 262, group);
  frame(ctx, M, 14, 18, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6ab7ff'); g.addColorStop(1, '#f7d58a'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#d9a15a'; c.beginPath(); c.ellipse(w * 0.5, h * 0.7, w * 0.3, h * 0.2, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(w * 0.62, h * 0.48, w * 0.14, 0, Math.PI * 2); c.fill(); c.fillStyle = '#222'; c.fillRect(w * 0.66, h * 0.45, 8, 8); }, 'biscuitphoto', 22, 97, 300, Math.PI / 2 - 0.3);
  const piggy = new THREE.MeshPhysicalMaterial({ color: 0xf2a0b0, roughness: 0.25, clearcoat: 1 });
  mesh(new THREE.SphereGeometry(6, 20, 14), piggy, 22, 91, 322, group).scale.set(0.8, 0.8, 1.1);
  // fairy lights along the headboard wall
  const fairy = new THREE.Group(); group.add(fairy);
  const bulbs = [];
  const fairyColors = [0xffc46b, 0xff8fb3, 0x8fd4ff, 0xb6ff8f];
  for (let i = 0; i < 26; i++) {
    const x = 30 + i * 9.5, y = 150 + Math.sin(i * 0.55) * 10;
    const b = mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshStandardMaterial({ color: fairyColors[i % 4], emissive: fairyColors[i % 4], emissiveIntensity: 2.5 }), x, y, 2.5, fairy, { cast: false });
    bulbs.push(b);
  }
  const wirePts = []; for (let i = 0; i < 26; i++) wirePts.push(new THREE.Vector3(30 + i * 9.5, 151 + Math.sin(i * 0.55) * 10, 2.2));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePts), 120, 0.15, 4), M.plasticGreen, 0, 0, 0, fairy, { cast: false });
  level.refs.fairy = bulbs;
  // posters
  const space = (c, w, h) => { c.fillStyle = '#060818'; c.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(255,255,255,${Math.random()})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } const g = c.createRadialGradient(w * 0.6, h * 0.4, 10, w * 0.6, h * 0.4, w * 0.3); g.addColorStop(0, '#ffb35c'); g.addColorStop(0.5, '#c1440e'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(w * 0.6, h * 0.4, w * 0.3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 54px Impact'; c.textAlign = 'center'; c.fillText('THINK BIG', w / 2, h * 0.88); };
  frame(ctx, M, 60, 85, space, 'posterSpace', 1.2, 150, 170, Math.PI / 2);
  const band = (c, w, h) => { c.fillStyle = '#f2e9d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#d93a2b'; c.beginPath(); c.arc(w / 2, h * 0.42, w * 0.32, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.font = 'bold 70px Impact'; c.textAlign = 'center'; c.fillText('THE', w / 2, h * 0.36); c.fillText('SMALLS', w / 2, h * 0.5); c.font = '30px Arial'; c.fillText('WORLD TOUR', w / 2, h * 0.86); };
  frame(ctx, M, 55, 80, band, 'posterBand', 418.8, 150, 150, -Math.PI / 2);
  const game = (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2b1055'); g.addColorStop(1, '#d53369'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe66d'; c.font = 'bold 64px Impact'; c.textAlign = 'center'; c.fillText('HYPER', w / 2, h * 0.2); c.fillText('RACER 9', w / 2, h * 0.32); c.fillStyle = '#111'; c.fillRect(w * 0.2, h * 0.55, w * 0.6, h * 0.15); c.fillStyle = '#4ef'; c.fillRect(w * 0.25, h * 0.5, w * 0.5, h * 0.08); };
  frame(ctx, M, 50, 70, game, 'posterGame', 200, 160, 398.8, Math.PI);
  // wall clock above bedroom door
  const clockTex = TX.drawn('clock', 256, 256, (c, w, h) => { c.fillStyle = '#fafaf5'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.fillRect(w / 2 + Math.sin(a) * 100 - 3, h / 2 - Math.cos(a) * 100 - 8, 6, 16); } });
  const clock = new THREE.Group(); clock.position.set(418.5, 225, 335); clock.rotation.y = -Math.PI / 2; group.add(clock);
  mesh(new THREE.CylinderGeometry(15, 15, 3, 40), M.plasticBlack, 0, 0, 0, clock, { rx: Math.PI / 2 });
  mesh(new THREE.CircleGeometry(13.5, 40), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.3 }), 0, 0, 1.6, clock);
  const hourH = mesh(new THREE.BoxGeometry(1, 8, 0.3), M.plasticBlack, 0, 0, 1.8, clock); hourH.geometry.translate(0, 4, 0);
  const minH = mesh(new THREE.BoxGeometry(0.7, 11, 0.3), M.plasticBlack, 0, 0, 1.9, clock); minH.geometry.translate(0, 5.5, 0);
  level.refs.clockHands = { hourH, minH };
  // floor clutter: LEGO bricks (climbable), toy car, sneakers, socks, laundry, basketball
  const legoMats = [M.plasticRed, M.plasticBlue, M.plasticYellow, M.plasticGreen, M.plasticWhite];
  const rnd = mulberry32(99);
  const legoSpots = [[240, 190], [250, 196], [262, 186], [230, 200], [300, 192], [150, 330], [158, 336], [360, 250], [95, 250], [255, 300]];
  legoSpots.forEach(([x, z], i) => brick(ctx, M, legoMats[i % legoMats.length], x, z, rnd() * Math.PI, 0.45 * (z > 215 && z < 355 && x > 120 && x < 330 ? 1 : 0)));
  brick(ctx, M, M.plasticRed, 250, 196, 0.3, 0.96 + 0.18, [2, 2]);
  // toy car
  const car = new THREE.Group(); car.position.set(185, 0, 300); car.rotation.y = 0.7; group.add(car);
  mesh(rbox(3.4, 1.4, 7.5, 0.5), M.plasticRed, 0, 1.4, 0, car); mesh(rbox(3, 1.2, 3.4, 0.5), M.glass, 0, 2.6, -0.5, car);
  [[-1.7, -2.4], [1.7, -2.4], [-1.7, 2.4], [1.7, 2.4]].forEach(([x, z]) => mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 16), M.rubber, x, 0.9, z, car, { rz: Math.PI / 2 }));
  world.addBox(185, 1.5, 300, 1.7, 1.5, 3.75, { yaw: 0.7, surface: 'plastic' });
  // sneakers near the door
  const shoeM = TX.pbr(TX.fabric({ color: 0xe8e8e8, weave: 80, seed: 40 }), { roughness: 1 });
  [[395, 250, 0.3], [380, 272, 0.1]].forEach(([x, z, r]) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = r; group.add(s);
    mesh(rbox(10, 3, 28, 1.2), M.plasticWhite, 0, 1.5, 0, s);
    mesh(rbox(9.4, 7, 22, 3.5, 3), shoeM, 0, 6, -2, s);
    mesh(rbox(8.6, 3, 8, 3, 3), shoeM, 0, 4.5, 10, s);
    mesh(rbox(9.8, 0.8, 2, 0.3), M.plasticRed, 0, 3.4, 0, s);
    world.addBox(x, 5, z, 5, 5, 14, { yaw: r, surface: 'fabric' });
  });
  // a sock on the floor (soft)
  const sockM = TX.pbr(TX.fabric({ color: 0x3a3a3a, color2: 0xe03a3a, pattern: 'stripe', weave: 90, seed: 41 }), { roughness: 1 });
  mesh(rbox(9, 2.4, 22, 1.2, 3), sockM, 110, 1.2, 175, group, { ry: 0.9 });
  world.addBox(110, 1.2, 175, 4.5, 1.2, 11, { yaw: 0.9, soft: true, surface: 'fabric' });
  // basketball
  const ballTex = TX.drawn('bball', 512, 256, (c, w, h) => { c.fillStyle = '#d9671f'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } c.strokeStyle = '#201008'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.moveTo(w / 4, 0); c.lineTo(w / 4, h); c.moveTo(w * 0.75, 0); c.lineTo(w * 0.75, h); c.stroke(); });
  const ball = mesh(new THREE.SphereGeometry(12, 40, 28), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.7 }), 360, 12, 180, group, { rz: 0.4 });
  void ball;
  world.addCylinder(360, 180, 10, 0, 22, { surface: 'plastic' });
  // laundry basket with clothes
  const basketM = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.9 });
  const basket = mesh(new THREE.CylinderGeometry(24, 20, 45, 32, 1, true), basketM, 70, 22.5, 360, group);
  basket.material.side = THREE.DoubleSide;
  mesh(rbox(40, 12, 36, 6, 3), M.duvet, 70, 44, 360, group);
  world.addCylinder(70, 360, 24, 0, 50);
  // ceiling light (off)
  cylinder(ctx, 22, 8, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x000000 }), 210, 252, 200, { collide: false });

  // ------------------------------------------------------------ LIVING ROOM
  // TV + stand against the dividing wall
  block(ctx, 45, 48, 160, M.woodDark, 455, 0, 160);
  for (let i = 0; i < 3; i++) mesh(rbox(1.2, 40, 48, 0.4), M.woodLight, 478, 24, 110 + i * 50, group);
  const tvScreen = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.3 });
  const tv = new THREE.Group(); tv.position.set(438, 115, 160); group.add(tv);
  mesh(rbox(5, 72, 125, 0.6), M.plasticBlack, 0, 0, 0, tv);
  mesh(new THREE.PlaneGeometry(121, 68), tvScreen, 2.6, 0, 0, tv, { ry: Math.PI / 2, cast: false });
  level.refs.tvScreen = tvScreen;
  // console + controller + remote on stand
  block(ctx, 26, 5, 20, M.plasticWhite, 460, 48, 110, { round: 1.5 });
  const pad = new THREE.Group(); pad.position.set(462, 49, 205); pad.rotation.y = 0.5; group.add(pad);
  mesh(rbox(15, 2.5, 10, 1.2, 3), M.plasticBlack, 0, 1.2, 0, pad);
  // sofa
  const sx0 = 760, sz0 = 70;
  const sofa = new THREE.Group(); group.add(sofa);
  const legM = M.woodDark;
  [[sx0 + 8, sz0 + 8], [sx0 + 82, sz0 + 8], [sx0 + 8, sz0 + 212], [sx0 + 82, sz0 + 212]].forEach(([x, z]) => { mesh(new THREE.CylinderGeometry(2, 1.4, 10, 12), legM, x, 5, z, sofa); world.addCylinder(x, z, 2, 0, 10); });
  mesh(rbox(90, 20, 220, 4, 3), M.sofa, sx0 + 45, 20, sz0 + 110, sofa);
  world.addBox(sx0 + 45, 20, sz0 + 110, 45, 10, 110, { surface: 'fabric', soft: true });
  mesh(rbox(24, 50, 220, 8, 4), M.sofa, sx0 + 78, 50, sz0 + 110, sofa);
  world.addBox(sx0 + 78, 50, sz0 + 110, 12, 25, 110, { surface: 'fabric', soft: true });
  [sz0 + 8, sz0 + 212].forEach((z) => { mesh(rbox(90, 32, 18, 7, 3), M.sofa, sx0 + 45, 46, z, sofa); world.addBox(sx0 + 45, 46, z, 45, 16, 9, { surface: 'fabric', soft: true }); });
  for (let i = 0; i < 2; i++) { mesh(rbox(64, 12, 96, 5, 4), M.sofa, sx0 + 36, 36, sz0 + 62 + i * 98, sofa); world.addBox(sx0 + 36, 36, sz0 + 62 + i * 98, 32, 6, 48, { surface: 'fabric', soft: true }); }
  pillow(ctx, M, sx0 + 62, 42, sz0 + 50, 45, 14, 40, -0.2, 0.7);
  mesh(rbox(40, 40, 12, 6, 4), M.cushion, sx0 + 64, 60, sz0 + 175, sofa, { ry: 1.4, rz: 0.4 });
  // coffee table + stuff
  const ct = { x0: 570, z0: 110, w: 110, d: 140, h: 42 };
  block(ctx, ct.w, 4, ct.d, M.woodLight, ct.x0 + ct.w / 2, ct.h - 4, ct.z0 + ct.d / 2, { round: 1 });
  [[4, 4], [ct.w - 4, 4], [4, ct.d - 4], [ct.w - 4, ct.d - 4]].forEach(([dx, dz]) => block(ctx, 5, ct.h - 4, 5, M.woodLight, ct.x0 + dx, 0, ct.z0 + dz, { round: 0.8 }));
  block(ctx, ct.w - 8, 2, ct.d - 8, M.woodLight, ct.x0 + ct.w / 2, 10, ct.z0 + ct.d / 2, { round: 0.5 });
  const mags = [0xd33, 0x39c, 0xeb3];
  mags.forEach((c, i) => block(ctx, 21, 0.6, 28, new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }), 600 + i * 2, 12 + i * 0.6, 150 + i * 3, { ry: i * 0.3 - 0.2, round: 0.1 }));
  const bowlM = new THREE.MeshPhysicalMaterial({ color: 0x9fd0e0, roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1 });
  mesh(new THREE.SphereGeometry(10, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bowlM, 640, 48, 190, group).scale.set(1, 0.6, 1);
  const candyC = [0xff3b3b, 0xffd23b, 0x3bb3ff, 0x5cff5c, 0xff7ae6];
  for (let i = 0; i < 12; i++) mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshPhysicalMaterial({ color: candyC[i % 5], roughness: 0.2, clearcoat: 1 }), 640 + Math.cos(i) * 5, 45 + (i % 3), 190 + Math.sin(i * 1.7) * 5, group);
  block(ctx, 5, 2, 17, M.plasticBlack, 610, 42, 225, { ry: 0.2, round: 0.8 });
  rug(ctx, M.rugLiving, 520, 60, 220, 260, 0.45);
  // PAPER AIRPLANE (the key item)
  const airplaneGeo = paperAirplaneGeometry(26, 15, 4.5);
  const airplane = new THREE.Mesh(airplaneGeo, M.paper);
  airplane.castShadow = true; airplane.receiveShadow = true;
  airplane.position.set(650, 5, 300); airplane.rotation.set(0, 2.3, 0);
  group.add(airplane);
  level.refs.airplane = airplane;
  // dog bed + Biscuit
  const dogBedG = new THREE.TorusGeometry(40, 13, 16, 48);
  mesh(dogBedG, M.dogBed, 955, 11, 440, group, { rx: -Math.PI / 2 });
  mesh(new THREE.CylinderGeometry(42, 42, 6, 48), M.dogBed, 955, 3, 440, group);
  world.addCylinder(955, 440, 53, 0, 6, { surface: 'fabric' });
  const dog = new Dog({ fur: preset.quality === 'low' ? 0 : preset.quality === 'medium' ? 5 : 9 });
  dog.placeOnBed(955, 440, -1.9);
  scene.add(dog.group);
  level.creatures.push(dog);
  level.refs.dog = dog;
  // dog toys
  const tennis = new THREE.MeshStandardMaterial({ color: 0xd4f03c, roughness: 0.95 });
  mesh(new THREE.SphereGeometry(3.3, 24, 16), tennis, 720, 3.3, 430, group);
  world.addCylinder(720, 430, 3, 0, 6.5, { surface: 'fabric' });
  const bone = new THREE.Group(); bone.position.set(880, 2, 380); bone.rotation.y = 0.6; group.add(bone);
  mesh(new THREE.CylinderGeometry(1.5, 1.5, 14, 12), M.plasticWhite, 0, 0, 0, bone, { rz: Math.PI / 2 });
  [-7, 7].forEach((x) => [-1.4, 1.4].forEach((z) => mesh(new THREE.SphereGeometry(2, 12, 8), M.plasticWhite, x, 0, z, bone)));
  // floor lamp
  cylinder(ctx, 14, 3, M.blackMetal, 880, 0, 40);
  mesh(new THREE.CylinderGeometry(1.2, 1.2, 150, 10), M.blackMetal, 880, 78, 40, group);
  const shadeL = mesh(new THREE.CylinderGeometry(16, 22, 26, 32, 1, true), M.lampShade, 880, 150, 40, group);
  shadeL.material = M.lampShade.clone(); shadeL.material.emissive = new THREE.Color(0xffa860); shadeL.material.emissiveIntensity = 0.6;
  world.addCylinder(880, 40, 1.5, 0, 150);
  // side table + plant, big corner plant, coat rack, guitar
  block(ctx, 40, 50, 40, M.woodDark, 880, 0, 330);
  plant(ctx, M, 880, 330, 0.5, 50);
  plant(ctx, M, 1000, 50, 1.2);
  plant(ctx, M, 470, 510, 0.9);
  const rack = new THREE.Group(); rack.position.set(1010, 0, 320); group.add(rack);
  mesh(new THREE.CylinderGeometry(1.5, 1.5, 180, 10), M.woodDark, 0, 90, 0, rack);
  mesh(new THREE.CylinderGeometry(18, 18, 2, 20), M.woodDark, 0, 1, 0, rack);
  mesh(rbox(30, 60, 12, 5, 3), TX.pbr(TX.fabric({ color: 0x2c3e2c, weave: 60, seed: 45 }), { roughness: 1 }), 0, 140, 6, rack, { rz: 0.1 });
  world.addCylinder(1010, 320, 18, 0, 2); world.addCylinder(1010, 320, 1.5, 0, 180);
  const guitar = new THREE.Group(); guitar.position.set(720, 0, 12); guitar.rotation.x = 0.18; group.add(guitar);
  const gM = new THREE.MeshPhysicalMaterial({ color: 0xa8612b, roughness: 0.3, clearcoat: 1 });
  mesh(new THREE.SphereGeometry(18, 24, 16), gM, 0, 22, 0, guitar).scale.set(1, 1.1, 0.25);
  mesh(new THREE.SphereGeometry(14, 24, 16), gM, 0, 48, 0, guitar).scale.set(1, 1, 0.25);
  mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.5, 24), M.plasticBlack, 0, 40, 4.2, guitar, { rx: Math.PI / 2 });
  mesh(rbox(5, 50, 2.5, 0.5), M.woodDark, 0, 85, 1, guitar);
  world.addBox(720, 30, 12, 18, 30, 6);
  // wall frames
  const land = (hue) => (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `hsl(${hue},60%,70%)`); g.addColorStop(0.6, `hsl(${hue + 30},50%,60%)`); g.addColorStop(1, `hsl(${hue + 80},40%,30%)`); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = `hsl(${hue + 120},30%,25%)`; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 20) c.lineTo(x, h * 0.6 + Math.sin(x * 0.02 + hue) * 40); c.lineTo(w, h); c.fill(); };
  frame(ctx, M, 80, 55, land(200), 'land1', 1038.8, 150, 420, -Math.PI / 2);
  frame(ctx, M, 45, 60, land(20), 'land2', 434, 175, 30, Math.PI / 2);
  frame(ctx, M, 60, 40, land(280), 'land3', 520, 170, 538.8, Math.PI);
  // family photo wall above sofa
  for (let i = 0; i < 3; i++) frame(ctx, M, 20, 26, land(40 + i * 90), 'fam' + i, 1038.8, 130 + (i % 2) * 20, 60 + i * 30, -Math.PI / 2);

  // ------------------------------------------------------------ KITCHEN
  const kz0 = 836;
  block(ctx, 600, 84, 60, M.cabinet, 740, 4, kz0 + 32, { round: 0.8 });
  block(ctx, 598, 4, 56, M.rubber, 740, 0, kz0 + 34, { round: 0, collide: false });
  block(ctx, 604, 4, 66, M.counter, 740, 88, kz0 + 31, { round: 0.8 });
  for (let i = 0; i < 10; i++) { mesh(rbox(58, 76, 1, 0.8), M.cabinet, 470 + i * 60, 46, kz0 + 1.5, group); mesh(rbox(1.2, 12, 1.5, 0.5), M.chrome, 492 + i * 60, 70, kz0 + 0.5, group); }
  block(ctx, 600, 70, 34, M.cabinet, 740, 150, 883, { round: 0.8 });
  // sink + faucet, stove, microwave, toaster, kettle, fruit bowl
  mesh(rbox(60, 1, 40, 0.5), M.chrome, 725, 92.2, 866, group);
  const fau = new THREE.Group(); fau.position.set(725, 92, 890); group.add(fau);
  mesh(new THREE.CylinderGeometry(1.5, 2, 30, 16), M.chrome, 0, 15, 0, fau);
  mesh(new THREE.TorusGeometry(8, 1.4, 10, 20, Math.PI), M.chrome, 0, 30, -8, fau, { ry: Math.PI / 2 });
  mesh(new THREE.BoxGeometry(60, 1, 56), M.blackMetal, 930, 92.3, 866, group);
  [[915, 852], [945, 852], [915, 880], [945, 880]].forEach(([x, z]) => mesh(new THREE.TorusGeometry(7, 0.8, 8, 24), M.blackMetal, x, 93, z, group, { rx: Math.PI / 2 }));
  block(ctx, 48, 28, 36, M.plasticBlack, 540, 92, 876, { round: 1.5 });
  block(ctx, 26, 18, 16, M.chrome, 610, 92, 880, { round: 3 });
  cylinder(ctx, 8, 20, M.chrome, 820, 92, 880, { rTop: 6 });
  const fruitC = [0xd8342a, 0xf2c227, 0x6fb03a, 0xf28a1a];
  for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(4 + (i % 2), 16, 12), new THREE.MeshPhysicalMaterial({ color: fruitC[i % 4], roughness: 0.35, clearcoat: 0.6 }), 660 + Math.cos(i * 1.2) * 7, 96 + (i > 3 ? 5 : 0), 868 + Math.sin(i * 1.2) * 7, group);
  // fridge (with the gap underneath where something lives)
  const fridge = new THREE.Group(); fridge.position.set(1000, 0, 650); group.add(fridge);
  mesh(rbox(76, 175, 80, 3, 3), M.fridge, 0, 3.5 + 87.5, 0, fridge);
  mesh(new THREE.BoxGeometry(1, 1, 78), M.rubber, -38.5, 120, 0, fridge);
  mesh(rbox(2, 40, 3, 1), M.chrome, -39, 140, -30, fridge); mesh(rbox(2, 50, 3, 1), M.chrome, -39, 80, -30, fridge);
  mesh(new THREE.BoxGeometry(74, 3.5, 78), new THREE.MeshStandardMaterial({ color: 0x050505 }), 0, 1.75, 0, fridge);
  world.addBox(1000, 3.5 + 87.5, 650, 38, 87.5, 40, { surface: 'glass' });
  // fridge magnets & drawing
  frame(ctx, M, 20, 26, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e44'; c.lineWidth = 8; c.beginPath(); c.arc(w / 2, h * 0.4, 70, 0, Math.PI * 2); c.stroke(); c.fillStyle = '#28f'; c.font = '48px "Comic Sans MS"'; c.textAlign = 'center'; c.fillText('BISCUIT', w / 2, h * 0.88); }, 'fridgeArt', 961, 130, 640, -Math.PI / 2);
  level.refs.fridge = fridge;
  // kitchen table + chairs
  const kt = { x: 700, z: 705 };
  block(ctx, 160, 4, 110, M.woodLight, kt.x, 72, kt.z, { round: 1.2 });
  [[-74, -49], [74, -49], [-74, 49], [74, 49]].forEach(([dx, dz]) => block(ctx, 6, 72, 6, M.woodLight, kt.x + dx, 0, kt.z + dz, { round: 1 }));
  [[-40, -75, 0], [40, -75, 0], [-40, 75, Math.PI], [40, 75, Math.PI]].forEach(([dx, dz, r]) => {
    const cx = kt.x + dx, cz = kt.z + dz;
    block(ctx, 40, 4, 40, M.woodDark, cx, 44, cz, { round: 1 });
    [[-17, -17], [17, -17], [-17, 17], [17, 17]].forEach(([a, b]) => block(ctx, 3, 44, 3, M.woodDark, cx + a, 0, cz + b, { round: 0.6 }));
    block(ctx, 40, 45, 3, M.woodDark, cx, 48, cz + (r ? 18.5 : -18.5), { round: 1 });
  });
  // dog bowls: food + water (the water bowl is an ocean at this size)
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.18 });
  const bowlG = new THREE.CylinderGeometry(11, 8, 5, 40, 1, true);
  [[870, 600], [905, 600]].forEach(([x, z], i) => {
    const b = mesh(bowlG, steel, x, 2.5, z, group); b.material = steel.clone(); b.material.side = THREE.DoubleSide;
    mesh(new THREE.TorusGeometry(11, 0.5, 8, 40), steel, x, 5, z, group, { rx: Math.PI / 2 });
    mesh(new THREE.CircleGeometry(8, 32), steel, x, 0.2, z, group, { rx: -Math.PI / 2 });
    // ring collider (walls of the bowl)
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; world.addBox(x + Math.cos(a) * 10.5, 2.6, z + Math.sin(a) * 10.5, 0.8, 2.6, 2.3, { yaw: -a, surface: 'glass' }); }
    if (i === 0) {
      const kib = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.8 });
      for (let k = 0; k < 40; k++) mesh(new THREE.SphereGeometry(1, 8, 6), kib, x + (Math.random() - 0.5) * 12, 1 + Math.random() * 3, z + (Math.random() - 0.5) * 12, group).scale.set(1, 0.6, 1);
    } else {
      const water = mesh(new THREE.CircleGeometry(10.3, 40), M.water, x, 4.2, z, group, { rx: -Math.PI / 2, cast: false });
      water.renderOrder = 3;
      level.refs.waterBowl = { x, z, r: 9.8, y: 4.2 };
    }
  });
  // kibble "stairs" spilled next to the water bowl
  const kibM = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.8 });
  [[889, 612, 1.0], [891, 616, 2.1], [893, 612, 3.2], [896, 609, 4.4]].forEach(([x, z, h]) => block(ctx, 2.6, h, 2.6, kibM, x, 0, z, { round: 0.8, surface: 'dirt' }));
  // mousetrap with cheese (don't)
  const trap = new THREE.Group(); trap.position.set(560, 0, 815); trap.rotation.y = 0.2; group.add(trap);
  mesh(rbox(10, 1, 4.5, 0.2), M.woodLight, 0, 0.5, 0, trap);
  const bar = mesh(new THREE.TorusGeometry(1.8, 0.12, 6, 20, Math.PI), M.metal, 1.5, 1.1, 0, trap, { ry: Math.PI / 2, rx: -Math.PI / 2 });
  mesh(new THREE.BoxGeometry(2.4, 0.2, 2.4), M.metal, -2.5, 1.1, 0, trap);
  const cheeseM = new THREE.MeshStandardMaterial({ color: 0xf5c542, roughness: 0.6 });
  mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 3), cheeseM, -2.5, 1.8, 0, trap, { rz: Math.PI / 2 });
  world.addBox(560, 0.5, 815, 5, 0.5, 2.25, { yaw: 0.2, surface: 'wood' });
  level.refs.trap = { group: trap, bar, x: 560, z: 815 };
  // trash can
  cylinder(ctx, 16, 58, M.chrome, 470, 0, 790, { rTop: 17 });
  // wall art + clock in kitchen
  frame(ctx, M, 40, 30, land(120), 'kitchenArt', 434, 170, 700, Math.PI / 2);

  // ------------------------------------------------------------ BATHROOM
  // bathtub along the west wall
  const tubM = M.porcelain;
  block(ctx, 76, 55, 320, tubM, 38, 0, 720, { round: 4 });
  mesh(rbox(66, 30, 300, 10, 4), new THREE.MeshPhysicalMaterial({ color: 0xe9eff2, roughness: 0.1, clearcoat: 1 }), 38, 40, 720, group);
  const duck = new THREE.Group(); duck.position.set(70, 55, 600); duck.rotation.y = -0.8; group.add(duck);
  mesh(new THREE.SphereGeometry(4, 20, 14), M.plasticYellow, 0, 3.2, 0, duck).scale.set(1, 0.8, 1.3);
  mesh(new THREE.SphereGeometry(2.6, 20, 14), M.plasticYellow, 0, 7, 2.5, duck);
  mesh(new THREE.ConeGeometry(1, 2.2, 12), new THREE.MeshStandardMaterial({ color: 0xff7a1a }), 0, 6.6, 5.3, duck, { rx: Math.PI / 2 });
  cylinder(ctx, 3, 18, M.plasticBlue, 20, 55, 870); cylinder(ctx, 3.4, 22, M.plasticWhite, 30, 55, 874);
  // toilet
  const toilet = new THREE.Group(); toilet.position.set(140, 0, 858); group.add(toilet);
  const baseG = new THREE.CylinderGeometry(13, 11, 36, 32);
  mesh(baseG, M.porcelain, 0, 18, 4, toilet);
  const bowlG2 = new THREE.CylinderGeometry(19, 14, 10, 40, 1, true);
  const bowlMesh = mesh(bowlG2, M.porcelain, 0, 34, 0, toilet); bowlMesh.material = M.porcelain.clone(); bowlMesh.material.side = THREE.DoubleSide;
  mesh(new THREE.TorusGeometry(16.5, 2.5, 12, 48), M.plasticWhite, 0, 40, 0, toilet, { rx: Math.PI / 2 });
  mesh(new THREE.CircleGeometry(15, 40), new THREE.MeshPhysicalMaterial({ color: 0x8fbccc, roughness: 0.05, transparent: true, opacity: 0.8, clearcoat: 1 }), 0, 26, 0, toilet, { rx: -Math.PI / 2 });
  mesh(rbox(48, 38, 18, 3), M.porcelain, 0, 59, 30, toilet);
  mesh(rbox(50, 3, 20, 1.2), M.porcelain, 0, 79, 30, toilet);
  mesh(rbox(36, 44, 3, 12, 3), M.plasticWhite, 0, 62, 20, toilet, { rx: -0.1 });
  mesh(new THREE.CylinderGeometry(1.5, 1.5, 4, 12), M.chrome, -18, 72, 21, toilet, { rz: Math.PI / 2 });
  world.addCylinder(140, 862, 12.5, 0, 30, { surface: 'glass' });
  // toilet seat ring colliders (you can stand on the rim)
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; world.addBox(140 + Math.cos(a) * 16.5, 40, 858 + Math.sin(a) * 16.5, 1.5, 2.4, 2.8, { yaw: -a, surface: 'plastic' }); }
  world.addBox(140, 59, 888, 24, 20, 9, { surface: 'glass' });
  level.refs.toilet = { x: 140, z: 858, rIn: 14, waterY: 26 };
  // toilet paper stand with an unrolled strip to the floor (the climb up)
  const tp = new THREE.Group(); tp.position.set(98, 0, 862); group.add(tp);
  mesh(new THREE.CylinderGeometry(9, 9, 1.5, 24), M.chrome, 0, 0.75, 0, tp);
  mesh(new THREE.CylinderGeometry(0.9, 0.9, 62, 12), M.chrome, 0, 31, 0, tp);
  const roll = mesh(new THREE.CylinderGeometry(6, 6, 10, 32), M.paperPlain, 0, 62, 0, tp, { rx: Math.PI / 2 });
  void roll;
  const strip = new THREE.PlaneGeometry(10, 62, 4, 24);
  const sp = strip.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.sin(sp.getY(i) * 0.15) * 0.8 + Math.max(0, -sp.getY(i) - 25) * 0.25);
  strip.computeVertexNormals();
  mesh(strip, M.paperPlain, -6.2, 31, 0, tp, { ry: -Math.PI / 2 });
  mesh(rbox(12, 0.3, 16, 0.1), M.paperPlain, -12, 0.15, 0, tp);
  world.addCylinder(98, 862, 9, 0, 1.5, { surface: 'glass' });
  world.addCylinder(98, 862, 1, 0, 56);
  world.addBox(98, 62, 862, 6, 6, 5, { surface: 'paper' });
  // vanity + mirror
  block(ctx, 120, 84, 50, M.woodWhite, 330, 0, 875, { round: 1 });
  block(ctx, 124, 4, 54, M.counter, 330, 84, 875, { round: 1 });
  mesh(new THREE.PlaneGeometry(100, 70), new THREE.MeshStandardMaterial({ color: 0xbfd0d8, metalness: 1, roughness: 0.02 }), 330, 150, 899, group, { ry: Math.PI });
  // bath mat, scale, hamper, towel
  const bathMatM = TX.pbr(TX.carpet({ color: 0x5aa0a8, seed: 50 }), { roughness: 1 });
  rug(ctx, bathMatM, 90, 700, 100, 60, 1.2);
  block(ctx, 30, 3, 30, M.plasticWhite, 330, 0, 700, { round: 1.2 });
  cylinder(ctx, 20, 55, new THREE.MeshStandardMaterial({ color: 0xa08868, roughness: 0.9 }), 60, 0, 470);
  const towel = mesh(rbox(60, 90, 4, 2, 3), TX.pbr(TX.fabric({ color: 0xe8b04a, weave: 60, seed: 51 }), { roughness: 1 }), 418, 140, 700, group, { ry: Math.PI / 2 });
  void towel;
  plant(ctx, M, 395, 600, 0.6);

  // ------------------------------------------------------------ collectibles
  const coinSpots = [[100, 0, 140], [312, 0, 345], [805, 0, 185], [500, 0, 40], [705, 0, 702], [948, 0, 760], [190, 0, 888], [380, 58, 10]];
  coinSpots.forEach(([x, y, z], i) => {
    const c = coinMesh(M, i % 3 === 1);
    c.position.set(x, y + 0.02, z);
    c.rotation.y = i;
    group.add(c);
    level.coins.push({ mesh: c, x, y, z, taken: false });
  });
  const crumbSpots = [[680, 648], [652, 790], [742, 792], [612, 700]];
  const cheerioM = new THREE.MeshStandardMaterial({ color: 0xd9a650, roughness: 0.85 });
  crumbSpots.forEach(([x, z]) => {
    const m = mesh(new THREE.TorusGeometry(0.55, 0.25, 12, 20), cheerioM, x, 0.26, z, group, { rx: Math.PI / 2 });
    level.crumbs.push({ mesh: m, x, z, eaten: false });
  });

  // ------------------------------------------------------------ creatures
  const vacuum = new Vacuum({ x0: 470, x1: 1000, z0: 330, z1: 800, cx: 735, cz: 560 });
  vacuum.place(1000, 0, 520);
  vacuum.yaw = -Math.PI / 2;
  scene.add(vacuum.group);
  level.creatures.push(vacuum);
  level.refs.vacuum = vacuum;
  const roach = new Cockroach();
  roach.place(1000, 0, 650);
  scene.add(roach.group);
  level.creatures.push(roach);
  level.refs.roach = roach;

  // ------------------------------------------------------------ helpers for AI & story
  const up = new THREE.Vector3(0, 1, 0);
  level.isCovered = (p) => world.raycast(new THREE.Vector3(p.x, p.y + 1.9, p.z), up, 14) < 14;
  level.lineOfSight = (a, b) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    d.normalize();
    return world.raycast(a, d, len, (s) => !s.soft || s.hy > 20) >= len - 2;
  };
  level.roomAt = roomAt;

  // Time of day: 'night' (doom-scrolling), 'morning' (shrunk).
  level.setTime = (t) => {
    const L = level.refs.lights;
    const night = t === 'night';
    level.time = t;
    sunBed.intensity = night ? 0 : 7; sunLiving.intensity = night ? 0 : 7;
    sunBed.visible = !night; sunLiving.visible = !night;
    L.moon.intensity = night ? 1.3 : 0;
    L.moon.castShadow = night && preset.shadows;
    L.hemi.intensity = night ? 0.05 : 0.75;
    L.hemi.color.set(night ? 0x5570b0 : 0xe3ecff);
    L.lampLiving.intensity = night ? 0 : 9000;
    L.kitchenLight.intensity = night ? 0 : 6500;
    L.bathLight.intensity = night ? 0 : 8000;
    fill.intensity = night ? 0.03 : 0.55;
    beamMat.uniforms.uStrength.value = night ? 0.05 : 0.12;
    beamMat.uniforms.uColor.value.set(night ? 0x6f8fff : 0xffe0a8);
    outsideMat.map = night ? outsideNight : outsideTex;
    outsideMat.color.setScalar(night ? 0.9 : 1.6);
    outsideMat.needsUpdate = true;
    scene.environment = preset.envMap ? envTex : null;
    group.traverse((o) => { if (o.isMesh && o.material && o.material.envMapIntensity !== undefined && !Array.isArray(o.material)) o.material.envMapIntensity = (o.material.userData.baseEnv ??= o.material.envMapIntensity) * (night ? 0.15 : 1); });
    scene.background.set(night ? 0x020308 : 0x0b0d12);
  };

  // Only the sun of the room the camera is in casts (expensive) shadows.
  level.updateLights = (camPos, focusPos) => {
    const room = roomAt(camPos.x, camPos.z) || 'bedroom';
    const bedroomish = room === 'bedroom' || room === 'bathroom';
    if (level.time !== 'night') {
      sunBed.visible = bedroomish; sunLiving.visible = !bedroomish;
      level.refs.beamBed.m.visible = level.refs.beamBed.pts.visible = bedroomish;
      [level.refs.beamL1, level.refs.beamL2].forEach((b) => { b.m.visible = b.pts.visible = !bedroomish; });
    }
    // fill-light shadow frustum follows the focus point with texel snapping (no shimmer)
    const f = focusPos || camPos;
    const snap = (2 * fr) / fill.shadow.mapSize.x;
    const fx = Math.round(f.x / snap) * snap, fz = Math.round(f.z / snap) * snap;
    fill.position.set(fx + 20, f.y + 250, fz + 30);
    fill.target.position.set(fx, f.y, fz);
  };

  level.update = (dt, t) => {
    beamMat.uniforms.uTime.value = t;
    // clock hands show the real time
    const now = new Date();
    level.refs.clockHands.minH.rotation.z = -(now.getMinutes() / 60) * Math.PI * 2;
    level.refs.clockHands.hourH.rotation.z = -((now.getHours() % 12) / 12 + now.getMinutes() / 720) * Math.PI * 2;
    // fairy lights twinkle
    level.refs.fairy.forEach((b, i) => { b.material.emissiveIntensity = b.userData.off ? 0 : 1.6 + Math.sin(t * 2 + i * 1.7) * 0.9; });
    // coins spin & glint
    level.coins.forEach((c) => { if (!c.taken) { c.mesh.rotation.y += dt * 1.5; c.mesh.position.y = c.y + 0.1 + Math.sin(t * 2 + c.x) * 0.05; } });
  };

  level.spawns = {
    wake: { pos: new THREE.Vector3(100, 71, 34), yaw: Math.PI * 0.5 },
    bedEdge: { pos: new THREE.Vector3(163, bedInfo.topY - 0.5, 96), yaw: Math.PI / 2 },
    pillow: { pos: new THREE.Vector3(212, 18.5, 96), yaw: Math.PI / 2 },
    bedTop: { pos: new THREE.Vector3(150, bedInfo.topY - 0.5, 150), yaw: Math.PI / 2 },
    deskPhone: { pos: new THREE.Vector3(352, 58, 30), yaw: -Math.PI / 2 },
    frontDoor: { pos: new THREE.Vector3(1015, 1.2, 227), yaw: -Math.PI / 2 },
    livingDoor: { pos: new THREE.Vector3(445, 0, 335), yaw: Math.PI / 2 },
  };

  setEnvIntensity(scene, 0.45);
  level.post = { bloom: 0.35, threshold: 0.9, aperture: 0.9, exposure: 1.0 };

  level.dispose = () => {
    level.creatures.forEach((c) => c.dispose && c.dispose());
  };
  return level;
}
