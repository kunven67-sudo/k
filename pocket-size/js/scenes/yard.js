// The front yard: the sun burns, the bush is full of bugs, cars thunder past, and you learn to
// survive - gather, craft, cut grass, build - until you find what shrank you.
import * as THREE from 'three';
import { World } from '../core/physics.js';
import * as TX from '../core/textures.js';
import { getPreset, difficultyMul } from '../core/settings.js';
import { ui } from '../core/ui.js';
import { sfx, loop, playMusic, setReverb } from '../core/audio.js';
import { mulberry32 } from '../core/noise.js';
import { G, saveGame } from '../game/state.js';
import { unlock } from '../game/achievements.js';
import { item } from '../game/items.js';
import { buildYard, carMesh, groundHeight, grassExcluded, YARD } from './yardBuild.js';
import { Grass } from './grass.js';
import { Ant, Mosquito, Beetle, Mite, Flea, Tick, Spider, Spiderling, BroodMother, makeWeb } from '../game/bugs.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const gy = (x, z) => groundHeight(x, z);

export async function createYard(story) {
  const preset = getPreset();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc4e8);
  const world = new World();
  world.gravity = 34; world.terminal = 22; world.killY = -200;
  const level = {
    id: 'yard', scene, world, interactables: [], creatures: [], pickups: [], structures: [], spawners: [],
    webs: [], music: 'outdoor', spawns: {},
  };
  const refs = buildYard(level, preset, G.renderer);
  const B = YARD.bush;
  const rnd = mulberry32(777);
  await new Promise((r) => requestAnimationFrame(r));
  ui.loading(0.6, 'Planting every single blade of grass...');

  const grass = new Grass(scene, { groundFn: gy, exclude: grassExcluded, density: preset.grassDensity });
  level.grass = grass;

  // ------------------------------------------------------------------ pickups
  const pickupMeshes = {
    pebble: () => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + rnd() * 0.2, 1), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.08, 0.45 + rnd() * 0.2), roughness: 0.85 })); m.scale.y = 0.7; return m; },
    fiber: () => { const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: 0xc8b070, roughness: 1 }); for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.4, 4), mat); s.rotation.set(Math.PI / 2 - 0.15, rnd() * 6, (rnd() - 0.5) * 0.4); s.position.y = 0.1 + i * 0.03; g.add(s); } return g; },
    twig: () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 3.6 + rnd() * 2, 6), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 })); m.rotation.set(Math.PI / 2, rnd() * 6, 0); m.position.y = 0.15; const g = new THREE.Group(); g.add(m); return g; },
    leaf: () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6), new THREE.MeshStandardMaterial({ map: TX.leafTexture({ color: '#9a6a2a', seed: 31 }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 })); m.rotation.set(-Math.PI / 2 + 0.1, 0, rnd() * 6); m.position.y = 0.2; const g = new THREE.Group(); g.add(m); return g; },
    clover: () => { const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: 0x3e8a2e, roughness: 0.6, side: THREE.DoubleSide }); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 5), mat); st.position.y = 1.5; g.add(st); for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12), mat); l.position.set(Math.cos(i * 2.1) * 0.7, 3, Math.sin(i * 2.1) * 0.7); l.rotation.x = -Math.PI / 2 + 0.3; g.add(l); } return g; },
    dew: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 2.5 })); m.scale.y = 0.8; m.position.y = 0.35; const g = new THREE.Group(); g.add(m); return g; },
    berry: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0x3a1a6a, roughness: 0.25, clearcoat: 1 })); m.position.y = 0.5; const g = new THREE.Group(); g.add(m); return g; },
    mushroom: () => { const g = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 10), new THREE.MeshStandardMaterial({ color: 0xefe6d0, roughness: 0.8 })); st.position.y = 1; g.add(st); const cap = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb8643a, roughness: 0.7 })); cap.position.y = 1.8; cap.scale.y = 0.6; g.add(cap); return g; },
    acorn: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a5a32, roughness: 0.9, side: THREE.DoubleSide })); m.rotation.x = Math.PI; m.position.y = 0.5; const g = new THREE.Group(); g.add(m); return g; },
    crumb: () => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: 0xd8a860, roughness: 0.9 })); m.position.y = 0.3; const g = new THREE.Group(); g.add(m); return g; },
    sap: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xd88a1a, roughness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1 })); m.scale.y = 0.6; m.position.y = 0.3; const g = new THREE.Group(); g.add(m); return g; },
  };
  const itemFor = { pebble: 'pebble', fiber: 'fiber', twig: 'twig', leaf: 'leaf', clover: 'clover', dew: 'dew', berry: 'berry', mushroom: 'mushroom', acorn: 'acorn', crumb: 'crumb', sap: 'sap' };
  function addPickup(kind, x, z, y = null) {
    const g = pickupMeshes[kind]();
    const yy = y ?? world.surfaceBelow(x, 30, z);
    g.position.set(x, Number.isFinite(yy) ? yy : gy(x, z), z);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    const p = { kind, mesh: g, pos: g.position, taken: false, respawn: 0 };
    level.pickups.push(p);
    level.interactables.push({
      getPos: () => p.pos, radius: 2.2, height: 3, label: () => `Pick up ${item(itemFor[kind]).name}`,
      can: () => !p.taken,
      action: (pl) => {
        p.taken = true; g.visible = false; p.respawn = 150 + rnd() * 90;
        const n = kind === 'fiber' ? 2 : 1;
        G.inventory.add(itemFor[kind], n);
        pl.rig.trigger('pickup', 0.5);
      },
    });
    return p;
  }
  const scatter = (kind, n, fn) => { for (let i = 0; i < n; i++) { const [x, z] = fn(i); if (x !== null) addPickup(kind, x, z); } };
  // Plenty of starter materials close to the house and walkway
  scatter('pebble', 55, (i) => (i < 25 ? [150 + rnd() * 300, (rnd() - 0.5) * 300] : [150 + rnd() * 1300, (rnd() - 0.5) * 2200]));
  scatter('pebble', 14, () => { const a = rnd() * 6.28, r = 35 + rnd() * 70; return [YARD.puddle.x + Math.cos(a) * r, YARD.puddle.z + Math.sin(a) * r]; });
  scatter('fiber', 55, (i) => (i < 25 ? [150 + rnd() * 320, -260 + rnd() * 520] : [150 + rnd() * 1300, (rnd() - 0.5) * 2200]));
  scatter('twig', 26, (i) => (i < 12 ? [B.x + (rnd() - 0.5) * 150, B.z + (rnd() - 0.5) * 150] : [YARD.tree.x + (rnd() - 0.5) * 400, YARD.tree.z + (rnd() - 0.5) * 400]));
  scatter('leaf', 30, () => [YARD.tree.x + (rnd() - 0.5) * 600, YARD.tree.z + (rnd() - 0.5) * 600]);
  scatter('clover', 18, () => [500 + rnd() * 120, 520 + rnd() * 120]);
  scatter('dew', 26, () => [200 + rnd() * 1200, (rnd() - 0.5) * 2000]);
  scatter('berry', 9, () => { const a = rnd() * 6.28, r = rnd() * 70; return [B.x + Math.cos(a) * r, B.z + Math.sin(a) * r]; });
  scatter('mushroom', 12, (i) => (i < 6 ? [YARD.tree.x + (rnd() - 0.5) * 200, YARD.tree.z + (rnd() - 0.5) * 200] : [B.x + (rnd() - 0.5) * 120, B.z + (rnd() - 0.5) * 120]));
  scatter('acorn', 10, () => [YARD.tree.x + (rnd() - 0.5) * 300, YARD.tree.z + (rnd() - 0.5) * 300]);
  scatter('crumb', 8, () => [1520 + rnd() * 120, (rnd() - 0.5) * 1200]);
  scatter('sap', 6, (i) => { const a = rnd() * 6.28; return i < 4 ? [YARD.tree.x + Math.cos(a) * 34, YARD.tree.z + Math.sin(a) * 34] : [B.x + Math.cos(a) * 8, B.z + Math.sin(a) * 8]; });
  // make sure there is a guaranteed starter kit right off the porch
  [[180, 60], [190, 75], [205, 58]].forEach(([x, z]) => addPickup('pebble', x, z));
  [[182, -60], [196, -75], [210, -55]].forEach(([x, z]) => addPickup('fiber', x, z));

  // ------------------------------------------------------------------ webs in the bush
  const webSpots = [[B.x - 30, 14, B.z + 30, V(1, 0, 0.2)], [B.x + 40, 18, B.z - 35, V(0.3, 0, 1)], [B.x - 50, 10, B.z - 20, V(1, 0, -0.5)]];
  webSpots.forEach(([x, y, z, n]) => {
    const w = makeWeb(V(x, y, z), 11, n.normalize());
    scene.add(w);
    level.webs.push({ mesh: w, pos: V(x, y, z), r: 11, cut: false });
  });

  // ------------------------------------------------------------------ creatures
  const spawn = (factory, x, z, opts = {}) => {
    const c = factory();
    c.place(x, gy(x, z) + (c.flying ? 3 : 0.5), z);
    if (opts.home) c.home.copy(opts.home);
    scene.add(c.group);
    level.creatures.push(c);
    return c;
  };
  const spawner = (factory, x, z, respawn = 100) => { const s = { factory, x, z, respawn, t: 0, c: null }; s.c = spawn(factory, x, z); level.spawners.push(s); return s; };
  // bush residents
  level.bushBugs = [];
  [[-20, 10], [15, -25], [30, 20], [-35, -10]].forEach(([dx, dz]) => level.bushBugs.push(spawner(() => new Ant(), B.x + dx, B.z + dz).c));
  level.bushBugs.push(spawner(() => new Mosquito(), B.x + 10, B.z + 5).c);
  level.bushBugs.push(spawner(() => new Mosquito(), B.x - 25, B.z + 35).c);
  level.bushBugs.push(spawner(() => new Spider(1), B.x - 30, B.z + 26, 180).c);
  level.bushBugs.push(spawner(() => new Spider(0.8), B.x + 38, B.z - 30, 180).c);
  for (let i = 0; i < 5; i++) spawner(() => new Spiderling(), B.x - 20 + rnd() * 15, B.z + 20 + rnd() * 15, 60);
  level.bushBugs.push(spawner(() => new Beetle(false), B.x + 5, B.z - 45, 160).c);
  for (let i = 0; i < 6; i++) spawner(() => new Mite(), B.x + 45 + rnd() * 10, B.z + 10 + rnd() * 10, 60);
  const fleaSpot = V(B.x - 62, 0, B.z + 40), tickSpot = V(B.x + 55, 0, B.z - 50);
  for (let i = 0; i < 4; i++) spawner(() => new Flea(), fleaSpot.x + rnd() * 6, fleaSpot.z + rnd() * 6, 90);
  for (let i = 0; i < 3; i++) spawner(() => new Tick(), tickSpot.x + rnd() * 6, tickSpot.z + rnd() * 6, 90);
  const brood = new BroodMother();
  brood.place(refs.hollow.x, gy(refs.hollow.x, refs.hollow.z) + 1, refs.hollow.z);
  brood.yaw = -Math.PI * 0.7;
  brood.onReveal = () => {
    unlock('broodmother');
    playMusic('danger');
    sfx('boss');
    G.player.shake = 1.5;
    ui.toast('👁️ <b>THE BROOD MOTHER</b> — you were not supposed to find her.', 5000);
    ui.say('...oh no. Oh no no no. That is the BIGGEST spider I have ever seen.', { speaker: 'You', pitch: 1.2 });
  };
  brood.onKilledByPlayer = () => { unlock('broodslayer'); playMusic('outdoor'); ui.toast('👑 The Brood Mother has fallen!'); };
  scene.add(brood.group); level.creatures.push(brood);
  // lawn wildlife
  const A = YARD.anthill;
  for (let i = 0; i < 6; i++) spawner(() => new Ant(), A.x + (rnd() - 0.5) * 60, A.z + (rnd() - 0.5) * 60);
  spawner(() => new Beetle(true), 700, -40, 160);
  spawner(() => new Beetle(false), 1150, 420, 160);
  spawner(() => new Mosquito(), YARD.puddle.x + 20, YARD.puddle.z, 90);
  spawner(() => new Mosquito(), YARD.puddle.x - 30, YARD.puddle.z + 30, 90);
  spawner(() => new Ant(), 1100, -500);
  spawner(() => new Ant(), 400, -500);

  // ------------------------------------------------------------------ cars on the street
  const carColors = [0xb3261e, 0xe8e8e8, 0x1a1a1a, 0x2a5aa0, 0x6a7a3a, 0xd8a020];
  const cars = [];
  for (let i = 0; i < 4; i++) {
    const m = carMesh(carColors[i % carColors.length]);
    m.visible = false;
    scene.add(m);
    cars.push({ m, active: false, t: 3 + i * 5 + rnd() * 6, z: 0, dir: 1, lane: 0, speed: 900, sound: null });
  }
  level.cars = cars;
  function launchCar(c, towardPlayer = false) {
    c.active = true;
    c.dir = rnd() < 0.5 ? 1 : -1;
    c.lane = c.dir > 0 ? 2170 : 1830;
    c.z = -c.dir * 3600;
    c.speed = 800 + rnd() * 500;
    if (towardPlayer) c.z = G.player.body.pos.z - c.dir * 1800;
    c.m.position.set(c.lane, YARD.road.y + 0.3, c.z);
    c.m.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    c.m.visible = true;
    c.sound = loop('traffic', { pos: c.m.position, ref: 250, rolloff: 1.4, vol: 1.2 });
  }
  level.launchCar = launchCar;

  // ------------------------------------------------------------------ interactables: the source
  level.coreHits = 0;
  const mote = new THREE.Group();
  mote.visible = false;
  const moteCore = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe0d0ff }));
  mote.add(moteCore);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.softDot('#b89aff', 'halo'), color: 0xc8b0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(7); mote.add(halo);
  mote.position.set(YARD.coreRock.x, gy(YARD.coreRock.x, YARD.coreRock.z) + 2, YARD.coreRock.z);
  scene.add(mote);
  level.mote = mote;
  level.interactables.push({
    getPos: () => mote.position, radius: 5, height: 5, label: 'Touch the glowing speck',
    can: () => G.flags.coreFound && mote.visible,
    action: () => level.touchCore(),
  });
  level.interactables.push({
    pos: V(4, YARD.porch.y + 1, 0), radius: 10, height: 4, label: 'Go back inside',
    action: () => ui.say('Not going back in there. Biscuit is definitely awake by now.', { speaker: 'You' }),
  });

  // ------------------------------------------------------------------ building
  const plankTex = TX.drawn('plankTex', 128, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#6f8a3a'); g.addColorStop(0.5, '#9ab04e'); g.addColorStop(1, '#6f8a3a'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(40,60,10,0.4)'; for (let x = 6; x < w; x += 9) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } });
  const plankM = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.8 });
  const twigM = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.9 });
  const leafBuildM = new THREE.MeshStandardMaterial({ map: TX.leafTexture({ color: '#6a8a2a', seed: 44 }), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  function structureMesh(id) {
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    switch (id) {
      case 'wall': for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(1.15, 5, 0.5), plankM, -2.9 + i * 1.16, 2.5, 0, 0, 0, (i % 2 - 0.5) * 0.03); add(new THREE.BoxGeometry(7, 0.3, 0.7), twigM, 0, 4.2, 0.1); add(new THREE.BoxGeometry(7, 0.3, 0.7), twigM, 0, 1.2, 0.1); break;
      case 'floor': for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(1.2, 0.4, 6), plankM, -2.4 + i * 1.2, 0.2, 0); break;
      case 'campfire': {
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; add(new THREE.DodecahedronGeometry(0.45, 0), stoneM, Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4); }
        for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.12, 0.15, 2.2, 6), twigM, 0, 0.5, 0, 0.9, i * 0.8, 0);
        const fire = add(new THREE.ConeGeometry(0.6, 1.8, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }), 0, 1.2, 0);
        fire.castShadow = false;
        const inner = add(new THREE.ConeGeometry(0.35, 1.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }), 0, 1, 0);
        inner.castShadow = false;
        const l = new THREE.PointLight(0xff8a30, 60, 30, 2); l.position.y = 1.5; g.add(l);
        g.userData.fire = [fire, inner, l];
        break;
      }
      case 'workbench': add(new THREE.BoxGeometry(4.2, 0.35, 2.4), plankM, 0, 1.6, 0); [[-1.8, -1], [1.8, -1], [-1.8, 1], [1.8, 1]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 6), twigM, x, 0.8, z)); add(new THREE.DodecahedronGeometry(0.35, 0), stoneM, 1.2, 1.95, 0.3); add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5), twigM, -1, 1.85, 0.2, 0, 0, Math.PI / 2); break;
      case 'lean_to': { const roof = add(new THREE.PlaneGeometry(7, 6), leafBuildM, 0, 2.6, 0, -Math.PI / 2 + 0.75); void roof; add(new THREE.CylinderGeometry(0.15, 0.18, 4.4, 6), twigM, -3.2, 2.2, -1.9); add(new THREE.CylinderGeometry(0.15, 0.18, 4.4, 6), twigM, 3.2, 2.2, -1.9); add(new THREE.BoxGeometry(7, 0.2, 0.2), twigM, 0, 4.4, -1.9); break; }
      case 'ladder': [-0.8, 0.8].forEach((x) => add(new THREE.BoxGeometry(0.25, 12, 0.25), twigM, x, 6, 0)); for (let y = 0.8; y < 12; y += 1.1) add(new THREE.BoxGeometry(1.6, 0.15, 0.3), plankM, 0, y, 0); break;
      case 'dew_collector': { [[-1, -1], [1, -1], [0, 1.2]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.1, 0.12, 2.4, 5), twigM, x, 1.2, z)); add(new THREE.ConeGeometry(1.8, 1.4, 12, 1, true), leafBuildM, 0, 2.4, 0, Math.PI); const bowl = add(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.6, roughness: 0 }), 0, 1.5, 0); g.userData.bowl = bowl; break; }
      default: add(new THREE.BoxGeometry(2, 2, 2), plankM, 0, 1, 0);
    }
    return g;
  }
  level.structureGhost = (id) => {
    const g = structureMesh(id);
    g.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshBasicMaterial({ color: 0x7aff9a, transparent: true, opacity: 0.35, depthWrite: false }); o.castShadow = false; } if (o.isLight) o.intensity = 0; });
    return g;
  };
  level.placeStructure = (id, pos, yaw, fromSave = false) => {
    const g = structureMesh(id);
    g.position.copy(pos); g.rotation.y = yaw;
    scene.add(g);
    const s = { id, pos: pos.clone(), yaw, mesh: g, colliders: [], t: 0, dew: 0 };
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const local = (x, z) => V(pos.x + x * c + z * sn, 0, pos.z - x * sn + z * c);
    if (id === 'wall') s.colliders.push(world.addBox(pos.x, pos.y + 2.5, pos.z, 3.5, 2.5, 0.35, { yaw, surface: 'wood' }));
    if (id === 'floor') s.colliders.push(world.addBox(pos.x, pos.y + 0.2, pos.z, 3, 0.2, 3, { yaw, surface: 'wood' }));
    if (id === 'workbench') s.colliders.push(world.addBox(pos.x, pos.y + 0.9, pos.z, 2.1, 0.9, 1.2, { yaw, surface: 'wood' }));
    if (id === 'ladder') {
      const top = local(0, 1.4); top.y = pos.y + 12.4;
      const zone = { x: pos.x, z: pos.z, bottomY: pos.y, topY: pos.y + 12, facing: yaw, exit: top, label: 'MASH E TO CLIMB', perPress: 1, slide: 1.5 };
      level.interactables.push({ getPos: () => V(pos.x, pos.y + 1, pos.z), radius: 2.5, label: 'Climb the ladder (mash E)', action: (p) => p.startClimb(zone) });
    }
    if (id === 'lean_to') {
      level.shelter = pos.clone();
      level.spawns.shelter = { pos: pos.clone().add(V(0, 0.5, 0)), yaw };
      if (!fromSave) { story.checkpoint('yard', 'shelter'); ui.toast('⛺ Respawn point set at your shelter.'); }
    }
    if (id === 'dew_collector') {
      level.interactables.push({ getPos: () => pos, radius: 3, label: 'Collect dew', can: () => s.dew > 0, action: () => { G.inventory.add('dew', s.dew); s.dew = 0; } });
    }
    level.structures.push(s);
    if (!fromSave) {
      G.flags.structures = G.flags.structures || [];
      G.flags.structures.push({ id, p: pos.toArray().map((v) => +v.toFixed(2)), yaw: +yaw.toFixed(3) });
      saveGame();
    }
    if (id === 'workbench' && !fromSave) level.onBuilt && level.onBuilt('workbench');
    return s;
  };
  level.nearStructure = (id, p, r) => level.structures.some((s) => s.id === id && s.pos.distanceTo(p) < r);
  (G.flags.structures || []).forEach((s) => level.placeStructure(s.id, V(...s.p), s.yaw, true));
  (G.flags.cuts || []).forEach(([x, z, r]) => grass.cut(x, z, r));

  // ------------------------------------------------------------------ harvesting
  level.harvest = (point, tool, dmg) => {
    const P = G.player;
    if (tool === 'axe') {
      for (const w of level.webs) {
        if (!w.cut && w.pos.distanceTo(point) < w.r * 0.9) {
          w.cut = true; w.mesh.visible = false; G.inventory.add('silk', 2); sfx('crunch', { pos: w.pos }); return true;
        }
      }
      for (const cane of refs.roseCanes) {
        if (cane.distanceTo(point) < 6 && !(cane.cd > G.time)) { cane.cd = G.time + 45; G.inventory.add('thorn', 1); sfx('chop', { pos: cane }); P.damage(2, 'bugs'); ui.toast('🥀 Ouch. Thorny.'); return true; }
      }
      for (const f of refs.flowers) {
        if (!f.cut && Math.hypot(f.x - point.x, f.z - point.z) < 2.4) {
          f.cut = true; sfx('chop', { pos: point });
          G.inventory.add(f.kind === 'dandelion' ? 'sap' : 'fiber', 1);
          const g = f.group; let t = 0;
          const fall = () => { t += 0.016; g.rotation.z = Math.min(Math.PI / 2, t * t * 3); if (t < 1.2) requestAnimationFrame(fall); else g.visible = false; };
          fall();
          return true;
        }
      }
      if (grass.hasGrass(point.x, point.z) && point.y < gy(point.x, point.z) + 10) {
        grass.cut(point.x, point.z, 2.4);
        G.flags.cuts = G.flags.cuts || []; G.flags.cuts.push([+point.x.toFixed(1), +point.z.toFixed(1), 2.4]);
        if (G.flags.cuts.length > 300) G.flags.cuts.shift();
        sfx('chop', { pos: point }); sfx('crunch', { pos: point, vol: 0.6 });
        G.inventory.add('grass_plank', 1, true);
        if (Math.random() < 0.6) G.inventory.add('fiber', 1, true);
        ui.toast('🌾 +1 Grass Plank', 1200);
        G.stats.grass++;
        if (G.stats.grass >= 25) unlock('lumberjack');
        fallingBlade(point);
        return true;
      }
    }
    if (tool === 'pickaxe') {
      const cr = refs.coreRock;
      if (!G.flags.coreFound && cr.mesh.position.distanceTo(point) < cr.r + 3) {
        level.coreHits++;
        sfx('mine', { pos: point }); P.shake += 0.2;
        cr.mesh.scale.multiplyScalar(0.94);
        refs.coreGlow.intensity = 200 + level.coreHits * 150;
        if (level.coreHits >= 6) level.revealCore();
        return true;
      }
      for (const r of refs.rocks) {
        if (r.mesh.position.distanceTo(point) < r.r + 3 && !(r.cd > G.time)) {
          r.cd = G.time + 1.2;
          sfx('mine', { pos: point });
          G.inventory.add('stone', 1, true);
          if (Math.random() < 0.5) G.inventory.add('pebble', 1, true);
          if (Math.random() < 0.15) G.inventory.add('quartz', 1);
          ui.toast('🪨 +1 Stone Chunk', 1200);
          return true;
        }
      }
    }
    return false;
  };
  const bladeM = new THREE.MeshStandardMaterial({ color: 0x5a8a2a, side: THREE.DoubleSide, roughness: 0.7 });
  function fallingBlade(p) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 9, 1, 4).translate(0, 4.5, 0), bladeM);
    g.position.copy(p); g.position.y = gy(p.x, p.z) + 0.6;
    g.rotation.y = Math.random() * 6;
    scene.add(g);
    let t = 0;
    const tick = () => { t += 0.016; g.rotation.z = Math.min(Math.PI / 2 - 0.05, t * t * 2.5); if (t > 2.2) g.material.opacity = 0; if (t < 2.5) requestAnimationFrame(tick); else scene.remove(g); };
    tick();
  }

  // ------------------------------------------------------------------ spawns
  level.spawns.door = { pos: V(18, YARD.porch.y + 1.6, 0), yaw: Math.PI / 2 };
  level.spawns.survival = { pos: V(B.x + B.r + 30, gy(B.x + B.r + 30, B.z - 40) + 0.5, B.z - 40), yaw: Math.PI / 2 };
  level.spawns.core = { pos: V(YARD.coreRock.x - 20, gy(YARD.coreRock.x - 20, YARD.coreRock.z + 15) + 0.5, YARD.coreRock.z + 15), yaw: Math.PI / 2 };

  // ------------------------------------------------------------------ helpers
  const up = V(0, 1, 0);
  level.lineOfSight = (a, b) => { const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); d.normalize(); return world.raycast(a, d, len) >= len - 1; };
  level.isCovered = (p) => world.raycast(V(p.x, p.y + 1.9, p.z), up, 10) < 10;
  level.inBush = (p) => Math.hypot(p.x - B.x, p.z - B.z) < B.r - 4 && p.y < B.h;
  const raySphere = (o, d, c, r) => { const oc = o.clone().sub(c); const b = oc.dot(d); const cc = oc.lengthSq() - r * r; const h = b * b - cc; return h >= 0 && -b + Math.sqrt(h) > 0; };
  level.inShade = (p) => {
    const o = V(p.x, p.y + 1.2, p.z);
    const d = refs.sunDir;
    if (level.inBush(p)) return true;
    if (G.inventory.selected() && G.inventory.selected().id === 'parasol') return true;
    if (raySphere(o, d, V(B.x, 62, B.z), B.r * 0.95)) return true;
    for (const c of refs.oak.clusters) if (raySphere(o, d, c.clone().add(V(YARD.tree.x, 0, YARD.tree.z)), 170)) return true;
    for (const s of level.structures) if (s.id === 'lean_to' && s.pos.distanceTo(p) < 4) return true;
    if (Math.hypot(p.x - refs.frisbee.x, p.z - refs.frisbee.z) < 12) return true;
    return world.raycast(o, d, 2500) < 2500;
  };

  // lighting follows the camera focus (texel-snapped sun shadow frustum)
  level.updateLights = (camPos, focus) => {
    const f = focus || camPos;
    const sun = refs.sun;
    const sr = preset.shadowRadius;
    const snap = (2 * sr) / sun.shadow.mapSize.x;
    const fx = Math.round(f.x / snap) * snap, fz = Math.round(f.z / snap) * snap;
    sun.target.position.set(fx, f.y, fz);
    sun.position.set(fx, f.y, fz).addScaledVector(refs.sunDir, 1500);
    grass.update(f);
  };

  // ------------------------------------------------------------------ per-frame world update
  level.update = (dt, t) => {
    // water shimmer & core glow
    if (refs.water.material) refs.water.material.roughness = 0.02 + Math.sin(t * 0.7) * 0.01;
    if (!G.flags.coreFound) refs.coreGlow.intensity = G.flags.bushFled ? 60 + Math.sin(t * 2.5) * 40 : 0;
    if (mote.visible) { mote.position.y = gy(mote.position.x, mote.position.z) + 2 + Math.sin(t * 2) * 0.4; halo.material.rotation += dt; halo.scale.setScalar(6 + Math.sin(t * 5) * 1); }
    // pickups respawn
    for (const p of level.pickups) if (p.taken) { p.respawn -= dt; if (p.respawn <= 0) { p.taken = false; p.mesh.visible = true; } }
    // creature respawns
    for (const s of level.spawners) {
      if (s.c && s.c.dead) { s.t += dt; if (s.t > s.respawn && (!G.player || Math.hypot(G.player.body.pos.x - s.x, G.player.body.pos.z - s.z) > 40)) { s.t = 0; s.c = spawn(s.factory, s.x, s.z); } }
    }
    // structures
    for (const s of level.structures) {
      if (s.id === 'campfire') {
        const [fire, inner, l] = s.mesh.userData.fire;
        const f = 1 + Math.sin(t * 13 + s.pos.x) * 0.12 + Math.sin(t * 7.3) * 0.08;
        fire.scale.set(f, f * 1.1, f); inner.scale.set(1 / f, f, 1 / f); l.intensity = 50 + f * 25;
        if (G.player && G.player.body.pos.distanceTo(s.pos) < 6 && G.player.health < G.player.maxHealth && G.player.mode === 'walk') G.player.heal(dt * 3);
      }
      if (s.id === 'dew_collector') { s.t += dt; if (s.t > 60) { s.t = 0; s.dew = Math.min(3, s.dew + 1); } s.mesh.userData.bowl.visible = s.dew > 0; }
    }
    // cars
    for (const c of cars) {
      if (!c.active) { c.t -= dt; if (c.t <= 0) launchCar(c); continue; }
      c.z += c.dir * c.speed * dt;
      c.m.position.z = c.z;
      (c.m.userData.wheels || []).forEach((w) => { w.rotation.z -= (c.speed / 33) * dt * c.dir; });
      if (c.sound) c.sound.setPos(c.m.position);
      const P = G.player;
      if (P && P.mode !== 'dead' && G.level === level) {
        const pp = P.body.pos;
        if (Math.abs(pp.x - c.lane) < 95 && Math.abs(pp.z - c.z) < 235 && pp.y < YARD.road.y + 140) P.die('car');
        const near = Math.hypot(pp.x - c.lane, pp.z - c.z);
        if (near < 400) P.shake = Math.max(P.shake, (1 - near / 400) * 0.8);
      }
      if (Math.abs(c.z) > 3700) { c.active = false; c.m.visible = false; c.t = 4 + rnd() * 12; if (c.sound) { c.sound.stop(); c.sound = null; } }
    }
  };

  // ------------------------------------------------------------------ story / gameplay loop
  level.heat = 0;
  let heatTick = 0, shade = false;
  level.story = (dt) => {
    const P = G.player;
    if (!P || G.mode !== 'play' || P.mode === 'dead') return;
    const p = P.body.pos;
    // puddle: slow wading, drowning when deep
    const W = YARD.puddle;
    const inWater = Math.hypot(p.x - W.x, p.z - W.z) < W.r && p.y < refs.waterY - 0.2;
    P.speedMul = inWater ? 0.45 : 1;
    if (inWater && p.y < refs.waterY - 1.5) {
      level.drownT = (level.drownT || 0) + dt;
      if (level.drownT > 0.3 && !level.drownWarned) { level.drownWarned = true; ui.toast('💧 <b>You\'re sinking!</b> Get out of the water!'); sfx('splash'); }
      if (level.drownT > 4) P.die('drown');
    } else { level.drownT = 0; level.drownWarned = false; }
    // sun & heat
    heatTick -= dt;
    if (heatTick <= 0) { heatTick = 0.2; shade = level.inShade(p); }
    const hot = !G.flags.overcast && !shade;
    level.heat = Math.max(0, Math.min(1.2, level.heat + (hot ? dt * 0.09 * difficultyMul() : -dt * 0.35)));
    ui.heat(level.heat, !G.flags.overcast);
    ui.sunWarning(hot && level.heat > 0.25);
    G.post.fx.heat = Math.min(1, level.heat) * 0.85;
    if (level.heat >= 1) { level.burnT = (level.burnT || 0) + dt; if (level.burnT > 0.5) { level.burnT = 0; P.damage(1.3, 'sun'); sfx('sizzle'); } }
    // sticky webs slow you down
    let sticky = false;
    for (const w of level.webs) if (!w.cut && w.pos.distanceTo(p.clone().add(V(0, 1, 0))) < w.r * 0.7) sticky = true;
    if (sticky) { P.speedMul *= 0.3; if (!level.webWarned) { level.webWarned = true; ui.toast('🕸️ Stuck in a web! Cut it with an axe.'); } }
    // bush events (and it's dim and gloomy under the leaves)
    const inBush = level.inBush(p);
    const hemiT = inBush ? 0.28 : (G.flags.overcast ? 1.1 : 0.85);
    refs.hemi.intensity += (hemiT - refs.hemi.intensity) * (1 - Math.exp(-2 * dt));
    if (inBush && !G.flags.bushSeen) { level.bushT = (level.bushT || 0) + dt; if (level.bushT > 1.2) level.bushReveal(); }
    if (G.flags.bushSeen && !G.flags.bushFled && Math.hypot(p.x - B.x, p.z - B.z) > B.r + 10) level.overcast();
    // hidden critters
    if (!G.flags.foundFleas && p.distanceTo(fleaSpot) < 12) { G.flags.foundFleas = true; ui.toast('🔎 You found where the <b>fleas</b> hide.'); }
    if (!G.flags.foundTicks && p.distanceTo(tickSpot) < 12) { G.flags.foundTicks = true; ui.toast('🔎 You found the <b>ticks</b>\' hiding spot.'); }
    if (G.flags.foundFleas && G.flags.foundTicks) unlock('fleatick');
    if (G.flags.bushFled) level.checkObjectives();
    if (P.body.pos.x > 2300 && !G.flags.crossedRoad) { G.flags.crossedRoad = true; ui.toast('🚗 You crossed the street. Legend. Now get back before a car comes.'); }
  };

  // Objective chain for the survival chapter.
  const has = (id) => G.inventory.count(id) > 0;
  const weapon = () => ['spear', 'club', 'thorn_sword', 'rapier', 'hammer', 'bow'].some(has);
  const stages = [
    { text: 'Gather 3 Pebbles and 3 Plant Fibers from the ground (E to pick up)', done: () => G.inventory.count('pebble') >= 3 && G.inventory.count('fiber') >= 3 || has('axe') || G.flags.craftedAxe },
    { text: 'Open crafting with Tab and craft a Pebble Axe', done: () => has('axe') || G.flags.craftedAxe },
    { text: 'Select the axe (1-8) and cut grass with left click — collect 5 Grass Planks', done: () => G.inventory.count('grass_plank') >= 5 || G.flags.stage3 },
    { text: 'Craft a Pebble Pickaxe', done: () => has('pickaxe') || G.flags.stage4 },
    { text: 'Craft a weapon — a Grass Spear, Pebble Club or Thorn Sword (thorns: cut the rose bush)', done: () => weapon() || G.flags.stage5 },
    { text: 'Craft a Workbench and place it (Build tab, select it, press B)', done: () => level.structures.some((s) => s.id === 'workbench') || G.flags.stage6 },
    { text: 'The phone\'s log said the source is "under the rock by the puddle". Break it with your pickaxe', done: () => G.flags.coreFound },
    { text: 'Touch the glowing speck', done: () => false },
  ];
  level.checkObjectives = () => {
    let i = 0;
    while (i < stages.length - 1 && stages[i].done()) i++;
    if (i >= 3) G.flags.stage3 = true;
    if (i >= 4) G.flags.stage4 = true;
    if (i >= 5) G.flags.stage5 = true;
    if (i >= 6) G.flags.stage6 = true;
    if (level.stage !== i) {
      level.stage = i;
      story.objective(stages[i].text);
      if (i === 6) ui.say('Okay. The rock by the puddle. Let\'s see what\'s under there.', { speaker: 'You' });
    }
  };
  level.onCraft = () => { if (G.flags.bushFled) level.checkObjectives(); };
  level.onBuilt = () => { if (G.flags.bushFled) level.checkObjectives(); };

  // ------------------------------------------------------------------ cutscenes
  level.bushReveal = async () => {
    G.flags.bushSeen = true;
    const P = G.player, d = G.director;
    P.mode = 'locked';
    G.mode = 'cutscene';
    const bugs = level.bushBugs.filter((c) => c && !c.dead);
    await d.play(async (c) => {
      G.post.dofOverride = true;
      await c.say('Phew... shade. Okay. That\'s better.', { speaker: 'You' });
      for (const bug of bugs.slice(0, 4)) {
        const bp = bug.body.pos.clone().add(V(0, bug.body.height * 0.6, 0));
        const from = bp.clone().add(V(4 + bug.body.radius * 3, 2 + bug.body.height, 5 + bug.body.radius * 3));
        c.cut(from, bp, 45);
        G.post.focus = from.distanceTo(bp); G.post.aperture = 1.1;
        c.move(from.clone().lerp(bp, 0.25), bp, 2.2);
        sfx(bug.name === 'Mosquito' ? 'buzz' : bug.isSpider ? 'hiss' : 'crunch', { vol: 0.8 });
        await c.wait(2);
      }
      c.cut(P.body.pos.clone().add(V(-2, 1.8, 2.4)), P.body.pos.clone().add(V(0, 1.5, 0)), 50);
      G.post.focus = 3;
      await c.say('A mosquito the size of a car. Ants. A SPIDER.', { speaker: 'You', pitch: 1.15, rate: 1.1 });
      await c.say('Nope. Nope. NOPE!', { speaker: 'You', pitch: 1.3, rate: 1.25 });
    });
    G.post.dofOverride = null;
    P.mode = 'walk';
    story.beginPlay();
    playMusic('danger');
    story.objective('GET OUT OF THE BUSH!');
    bugs.forEach((b) => { b.aggro = true; });
  };

  level.overcast = async () => {
    G.flags.bushFled = true;
    unlock('bushnope');
    const P = G.player, d = G.director;
    P.mode = 'locked';
    G.mode = 'cutscene';
    level.heat = 0; ui.heat(0, false); ui.sunWarning(false); G.post.fx.heat = 0;
    playMusic('wonder');
    await d.play(async (c) => {
      G.post.dofOverride = true;
      const p = P.body.pos.clone();
      c.cut(p.clone().add(V(3, 1.2, 3)), p.clone().add(V(0, 1.6, 0)), 55);
      G.post.focus = 4;
      await c.say('I made it out... I think they stopped following.', { speaker: 'You' });
      c.cut(p.clone().add(V(0, 2, 0)), p.clone().add(refs.sunDir.clone().multiplyScalar(100)), 60);
      G.post.focus = 200; G.post.aperture = 0.3;
      level.setOvercast(true, 5);
      await c.wait(2.5);
      await c.say('The sun just went behind the clouds. Finally, I can move around out here.', { speaker: 'You' });
      // panorama: the street, the cars, the gigantic houses
      level.cars.forEach((car) => { if (!car.active) { launchCar(car, true); } });
      c.cut(p.clone().add(V(-10, 8, 0)), V(2000, 60, p.z), 60);
      G.post.focus = 1500; G.post.aperture = 0.2;
      c.move(V(p.x + 200, 120, p.z - 150), V(2000, 60, p.z), 8, { path: [p.clone().add(V(40, 40, -30))] });
      await c.wait(2);
      await c.say('Cars. The street. Everything is enormous.', { speaker: 'You' });
      c.move(V(700, 260, 700), V(-200, 200, 0), 7);
      await c.say('My house looks like a mountain. Every house does.', { speaker: 'You' });
      c.cut(p.clone().add(V(2.5, 1.5, -2)), p.clone().add(V(0, 1.4, 0)), 55);
      G.post.focus = 3.5; G.post.aperture = 0.9;
      await c.say('If I\'m going to survive out here, I need tools. Pebbles, grass fibre... I can MAKE stuff.', { speaker: 'You' });
    });
    G.post.dofOverride = null;
    P.mode = 'walk';
    story.current = 'survival';
    story.beginPlay();
    ui.chapterCard('CHAPTER 5', 'SMALL WORLD SURVIVAL');
    ui.toast('🎒 <b>Crafting unlocked!</b> Press <b>Tab</b> to open your backpack and crafting.', 6000);
    playMusic('outdoor');
    story.checkpoint('yard', 'survival');
    level.stage = -1;
    level.checkObjectives();
  };

  level.setOvercast = (on, dur = 0.01) => {
    const s = refs.sky.material.uniforms;
    const from = { t: s.turbidity.value, r: s.rayleigh.value, i: refs.sun.intensity, h: refs.hemi.intensity };
    const to = on ? { t: 11, r: 3.2, i: 0.8, h: 1.1 } : { t: 3.5, r: 1.6, i: 2.6, h: 0.85 };
    const fogFrom = scene.fog.color.clone(), fogTo = new THREE.Color(on ? 0xa8b2bc : 0xb8cfe4);
    let k = 0;
    const tick = () => {
      k = Math.min(1, k + 0.016 / dur);
      const e = k * k * (3 - 2 * k);
      s.turbidity.value = from.t + (to.t - from.t) * e; s.rayleigh.value = from.r + (to.r - from.r) * e;
      refs.sun.intensity = from.i + (to.i - from.i) * e; refs.hemi.intensity = from.h + (to.h - from.h) * e;
      scene.fog.color.copy(fogFrom).lerp(fogTo, e);
      if (k < 1) requestAnimationFrame(tick);
      else if (preset.envMap) scene.environment = on ? refs.envOvercast : refs.env;
    };
    tick();
    G.flags.overcast = on;
  };

  level.revealCore = async () => {
    G.flags.coreFound = true;
    const P = G.player, d = G.director;
    sfx('explosion', { vol: 0.4 });
    P.shake = 1.2;
    const cr = refs.coreRock;
    let t = 0;
    const crumble = () => { t += 0.016; cr.mesh.scale.multiplyScalar(0.9); cr.mesh.position.y -= 0.05; if (t < 0.7) requestAnimationFrame(crumble); else { cr.mesh.visible = false; world.remove(cr.col); } };
    crumble();
    mote.visible = true;
    refs.coreGlow.intensity = 900;
    P.mode = 'locked';
    G.mode = 'cutscene';
    playMusic('micro');
    await d.play(async (c) => {
      const m = mote.position.clone();
      c.cut(m.clone().add(V(6, 3, 6)), m, 45);
      G.post.dofOverride = true; G.post.focus = 8; G.post.aperture = 1.2;
      c.move(m.clone().add(V(3, 1.5, 3)), m, 5);
      await c.say('There. Under the rock. A tiny glowing speck... it\'s humming.', { speaker: 'You' });
      await c.say('This is it. This is what shrank me. It\'s pulling everything smaller around it...', { speaker: 'You' });
      await c.say('If I touch it, I might get even smaller. But it\'s the only lead I\'ve got.', { speaker: 'You' });
    });
    G.post.dofOverride = null;
    P.mode = 'walk';
    story.beginPlay();
    story.checkpoint('yard', 'core');
    level.checkObjectives();
  };

  level.touchCore = async () => {
    const P = G.player, d = G.director;
    P.mode = 'locked';
    G.mode = 'cutscene';
    sfx('shrink');
    await d.play(async (c) => {
      const m = mote.position.clone();
      c.cut(P.body.pos.clone().add(V(-3, 2, 3)), m, 50);
      G.post.dofOverride = true;
      P.rig.trigger('pickup', 1);
      await c.wait(0.8);
      c.tween(4, (k) => { G.post.fx.aberration = 0.0015 + k * 0.03; G.post.fx.glitch = k * 0.5; G.camera.fov = 50 + k * 60; G.camera.updateProjectionMatrix(); halo.scale.setScalar(6 + k * 200); }, 'in');
      c.move(m.clone().add(V(0.5, 0.5, 0.5)), m, 4, { e: 'in' });
      await c.say('Everything is getting BIGGER again! No — I\'m getting SMALLER!', { speaker: 'You', pitch: 1.3, rate: 1.2 });
      await ui.fade(1, 700);
    }, { skippable: false });
    G.post.fx.aberration = 0.0015; G.post.fx.glitch = 0;
    G.post.dofOverride = null;
    unlock('germ');
    Object.values(level.cars).forEach((c) => { if (c.sound) { c.sound.stop(); c.sound = null; } c.active = false; c.m.visible = false; });
    level.stopAmbience();
    await story.goGerm();
  };

  // ------------------------------------------------------------------ arrival & respawn
  level.ambience = [];
  level.startAmbience = () => {
    level.stopAmbience();
    level.ambience.push(loop('birds', { vol: 0.5 }), loop('wind', { vol: 0.35 }));
    setReverb(0.12);
  };
  level.stopAmbience = () => { level.ambience.forEach((a) => a.stop()); level.ambience = []; };

  level.arrive = async (entry, spawnId) => {
    G.post.fx.pixelate = 0; G.post.fx.scanlines = 0;
    level.startAmbience();
    if (entry === 'outside' && !G.flags.bushFled) {
      level.setOvercast(false);
      story.placePlayer('door');
      story.checkpoint('yard', 'door');
      G.flags.outside = true;
      unlock('outside');
      const P = G.player, d = G.director;
      P.mode = 'locked'; G.mode = 'cutscene';
      await ui.fade(0, 1200);
      playMusic('outdoor');
      await d.play(async (c) => {
        const p = P.body.pos.clone();
        c.cut(p.clone().add(V(2, 1.2, 0)), p.clone().add(V(0, 1.5, 0)), 55);
        G.post.dofOverride = true; G.post.focus = 2.5;
        await c.wait(1);
        c.move(p.clone().add(V(-6, 3.5, 3)), p.clone().add(V(40, 10, 0)), 6);
        await c.say('I\'m OUTSIDE! Whoa... the grass is like a jungle.', { speaker: 'You', pitch: 1.1 });
        c.cut(p.clone().add(V(0, 2, 0)), p.clone().add(refs.sunDir.clone().multiplyScalar(80)), 70);
        G.post.focus = 200; G.post.fx.heat = 0.6;
        await c.wait(1.2);
        await c.say('Ow... ow OW! The sun is BURNING me! It\'s like a magnifying glass!', { speaker: 'You', pitch: 1.25, rate: 1.15 });
        c.cut(p.clone().add(V(-4, 3, -4)), V(B.x, 30, B.z), 55);
        G.post.focus = 280; G.post.aperture = 0.4;
        await c.say('The bush! I have to get into the shade!', { speaker: 'You', pitch: 1.15 });
      });
      G.post.dofOverride = null;
      P.mode = 'walk';
      level.heat = 0.35;
      story.beginPlay();
      ui.chapterCard('CHAPTER 4', 'THE GREAT OUTDOORS');
      story.objective('Get out of the sunlight — run to the big bush!');
      return;
    }
    if (entry === 'respawn' && !G.flags.bushFled) {
      level.setOvercast(false);
      story.placePlayer(spawnId && level.spawns[spawnId] ? spawnId : 'door');
      level.heat = 0.2;
      playMusic('outdoor');
      story.beginPlay();
      await ui.fade(0, 900);
      story.objective(G.flags.bushSeen ? 'GET OUT OF THE BUSH!' : 'Get out of the sunlight — run to the big bush!');
      return;
    }
    // survival / return / continue
    level.setOvercast(true);
    const sp = spawnId || (entry === 'return' ? 'core' : (G.checkpoint && G.checkpoint.level === 'yard' ? G.checkpoint.spawn : 'survival'));
    story.placePlayer(level.spawns[sp] ? sp : 'survival');
    if (!G.flags.bushFled) G.flags.bushFled = true;
    G.flags.bushSeen = true;
    playMusic('outdoor');
    story.checkpoint('yard', level.spawns[sp] ? sp : 'survival');
    story.beginPlay();
    await ui.fade(0, 900);
    if (entry === 'survival') { ui.chapterCard('CHAPTER 5', 'SMALL WORLD SURVIVAL'); ui.toast('🎒 Press <b>Tab</b> for backpack & crafting.', 5000); }
    level.stage = -1;
    level.checkObjectives();
  };

  level.respawn = (spawnId) => {
    level.heat = 0;
    story.placePlayer(level.spawns[spawnId] ? spawnId : (G.flags.bushFled ? 'survival' : 'door'));
    if (!G.flags.bushFled) level.heat = 0.2;
    if (G.flags.bushFled) { level.stage = -1; level.checkObjectives(); }
    playMusic('outdoor');
  };

  level.post = { bloom: 0.22, threshold: 1.15, aperture: 0.55, exposure: 1.0 };
  level.onEnter = () => { level.audioReady = true; };
  level.onExit = () => { level.stopAmbience(); cars.forEach((c) => { if (c.sound) { c.sound.stop(); c.sound = null; } }); ui.heat(0, false); ui.sunWarning(false); G.post.fx.heat = 0; ui.boss(null); };
  return level;
}
