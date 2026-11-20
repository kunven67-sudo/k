// ONE LIFE - piece 1: endless land, the shrink suit, the speed suit, one body.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { makeLand } from './land.js';
import { Terrain } from './terrain.js';
import { Scatter, variantsFrom, grainGeo, bacteriumGeo, coccusGeo, phageGeo } from './scatter.js';
import { Body, Avatar, fallDamage, PARTS } from './player.js';
import { Deep, REALMS, realmFor } from './deep.js';
import { Post } from './post.js';
import { Audio } from './audio.js';
import { SuitBench } from './suit.js';
import { UI, fmtSize, asBigAs, fmtSpeed } from './ui.js';

const C_LIGHT = 299792458, MACH = 343, PLANCK_K = 1.616e-35 / 1.8;
const $ = s => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem('onelife.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('onelife.' + k, JSON.stringify(v)); } catch (e) {} } };

const TEST = location.search.includes('test');
// ---------------- renderer ----------------
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.02, 2e7);
const post = new Post(renderer);
const audio = new Audio();
const ui = new UI();
const settings = Object.assign({ vol: 0.8, sens: 1, quality: 'auto' }, store.get('settings', {}));
audio.volume = settings.vol;

// ---------------- loading ----------------
const manager = new THREE.LoadingManager();
manager.onProgress = (u, a, b) => ui.loading(a / b);
const gl = new GLTFLoader(manager); gl.setMeshoptDecoder(MeshoptDecoder);
const tl = new THREE.TextureLoader(manager);
const loadG = n => gl.loadAsync('assets/models/' + n + '.glb');
const tex = (n, srgb = true) => { const t = tl.load('assets/tex/' + n + '.webp'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = TEST ? 1 : 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
const T = {
  grass: tex('aerial_grass_rock_diff'), grassN: tex('aerial_grass_rock_nor', false), dirt: tex('forest_ground_04_diff'), rock: tex('rocky_terrain_02_diff'), rockN: tex('rocky_terrain_02_nor', false),
  soil: tex('brown_mud_diff'), soilN: tex('brown_mud_nor', false), leaves: tex('brown_mud_leaves_01_diff'), sand: tex('coast_sand_01_diff'), mineral: tex('rock_boulder_cracked_diff'), mineralN: tex('rock_boulder_cracked_nor', false),
};
const names = ['boulder', 'rocks', 'stones', 'pebble', 'rock', 'grass', 'grassb', 'dandelion', 'fern', 'shrub', 'celandine', 'nettle', 'stump', 'log', 'bark', 'moss', 'suit'];
const [G, sky] = await Promise.all([Promise.all(names.map(loadG)).then(a => Object.fromEntries(names.map((n, i) => [n, a[i]]))), new RGBELoader(manager).loadAsync('assets/tex/sky.hdr')]);
sky.mapping = THREE.EquirectangularReflectionMapping;
scene.background = sky; scene.backgroundIntensity = 1;
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(sky).texture; pm.dispose(); }
scene.environmentIntensity = 0.9;
// find the sun in the real sky photo (brightest spot) and put the light there
const sunDir = (() => {
  const { data, width, height } = sky.image; let best = 0, bi = 0; const step = data.length / (width * height);
  for (let i = 0; i < width * height; i++) { const l = data[i * step] + data[i * step + 1] + data[i * step + 2]; if (l > best) { best = l; bi = i; } }
  const u = (bi % width) / width, v = Math.floor(bi / width) / height, ph = u * Math.PI * 2, th = v * Math.PI;
  return new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).normalize();
})();
const sun = new THREE.DirectionalLight(0xfff1dc, 3.2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a3b28, 0.35); scene.add(hemi);

// ---------------- the world ----------------
let seed = store.get('seed', 0) || Math.floor(Math.random() * 1e6);
let land = makeLand(seed);
const macro = new THREE.Group(); scene.add(macro);
let terrain = new Terrain(land, T, macro);
let scatter = buildScatter(land);
if (TEST) macro.traverse(o => { if (o.material?.map) o.material.map.anisotropy = 1; });
const deep = new Deep(scene);
const avatar = new Avatar(G.suit); scene.add(avatar.root);
const bench = new SuitBench(renderer, audio);
bench.scene.environment = scene.environment;

function buildScatter(land) {
  const S = new Scatter(land, macro);
  const V = n => variantsFrom(G[n], null, /grass|fern|celandine|nettle|dandelion|moss/.test(n));
  const rockMat = new THREE.MeshStandardMaterial({ map: T.mineral, normalMap: T.mineralN, roughness: 0.9, color: 0xd8cfc2 });
  const sandMat = new THREE.MeshStandardMaterial({ map: T.sand, normalMap: T.mineralN, roughness: 0.85, color: 0xf0e2c8 });
  const grainGeos = [1, 2, 3, 4, 5].map(i => grainGeo(i, 2));
  // big things (real scans)
  S.add({ id: 1, variants: [...V('boulder').map(v => ({ ...v, w: 2 })), ...V('rocks'), ...V('stump'), ...V('log')], cell: 24, prob: 0.42, sMin: 0.7, sMax: 1.6, rBH: 1e9, rMin: 0, rMax: 210, kMin: 1e-6, kMax: 10, collide: true, sink: 0.08, tilt: 0.15, shadow: true, cap: 120, where: (x, z, r) => land.cover(x, z)[0] > 0.2 || r() < 0.55 });
  // plants + rocks you trip over
  S.add({ id: 2, variants: [...V('fern'), ...V('dandelion'), ...V('nettle'), ...V('celandine'), ...V('rock').map(v => ({ ...v, w: 3 }))], cell: 3.2, prob: 0.6, sMin: 0.6, sMax: 1.4, rBH: 16, rMin: 1.5, rMax: 30, kMin: 3e-6, kMax: 10, collide: true, tilt: 0.1, shadow: false, cap: 120 });
  // grass: low clumps everywhere, taller grass close to you
  S.add({ id: 3, variants: V('grassb'), cell: 0.3, prob: 0.9, sMin: 1.3, sMax: 2.4, rBH: 11, rMin: 0.8, rMax: 20, kMin: 1e-5, kMax: 10, shadow: false, cap: 900, where: (x, z, r) => land.cover(x, z)[0] < 0.55 + r() * 0.2 });
  S.add({ id: 10, variants: V('grass'), cell: 0.55, prob: 0.8, sMin: 0.8, sMax: 1.5, rBH: 6, rMin: 0.6, rMax: 11, kMin: 1e-5, kMax: 10, shadow: false, cap: 260, where: (x, z, r) => land.cover(x, z)[0] < 0.4 });
  // when you're small: the meadow floor is a jungle of grass
  S.add({ id: 11, variants: [...V('grassb'), ...V('grass')], cell: 0.07, prob: 0.85, sMin: 0.8, sMax: 1.8, rBH: 60, rMin: 0.05, rMax: 0.6, kMin: 1e-5, kMax: 0.06, shadow: false, cap: 160, where: (x, z, r) => land.cover(x, z)[0] < 0.5 });
  // stones, bark, moss
  S.add({ id: 4, variants: [...V('pebble'), ...V('stones'), ...V('bark'), ...V('moss')], cell: 0.6, prob: 0.5, sMin: 0.35, sMax: 1.1, rBH: 4, rMin: 0.4, rMax: 8, kMin: 1e-6, kMax: 10, collide: true, shadow: false, cap: 200 });
  // gravel (2-12 mm): scanned stones near you, simple ones further away
  S.add({ id: 5, variants: grainGeos.map(g => ({ geo: g, mat: rockMat, size: new THREE.Vector3(1, 0.62, 1) })), cell: 0.02, prob: 0.5, unit: 0.008, sMin: 0.3, sMax: 1.5, rBH: 8, rMin: 0.02, rMax: 0.3, kMin: 1e-6, kMax: 0.04, collide: true, shadow: true, cap: 500, tilt: 3 });
  // sand grains (0.1 - 1 mm)
  S.add({ id: 6, variants: grainGeos.map(g => ({ geo: g, mat: sandMat, size: new THREE.Vector3(1, 0.62, 1) })), cell: 0.0012, prob: 0.6, unit: 0.0009, sMin: 0.25, sMax: 1.0, rBH: 10, rMin: 0.004, rMax: 0.03, kMin: 2e-7, kMax: 0.002, collide: true, shadow: true, cap: 700, tilt: 3 });
  // silt + clay (4 - 60 um)
  S.add({ id: 7, variants: grainGeos.map(g => ({ geo: g, mat: rockMat, size: new THREE.Vector3(1, 0.62, 1) })), cell: 5e-5, prob: 0.55, unit: 4.5e-5, sMin: 0.1, sMax: 1, rBH: 10, rMin: 2e-4, rMax: 0.002, kMin: 1e-8, kMax: 2e-4, collide: true, shadow: true, cap: 700, tilt: 3 });
  // bacteria (1 - 4 um): rods with flagella + round clusters
  const bm = new THREE.MeshStandardMaterial({ color: 0xb9c79a, roughness: 0.38, metalness: 0 });
  const bm2 = new THREE.MeshStandardMaterial({ color: 0xd8c39b, roughness: 0.4 });
  S.add({ id: 8, variants: [1, 2, 3, 4].map(i => ({ geo: bacteriumGeo(i, i % 2 === 0), mat: bm, size: new THREE.Vector3(3, 0.8, 0.8) })).concat([5, 6].map(i => ({ geo: coccusGeo(i), mat: bm2, size: new THREE.Vector3(2, 1, 2) }))), cell: 7e-6, prob: 0.45, unit: 1e-6, sMin: 0.7, sMax: 1.3, rBH: 14, rMin: 2e-5, rMax: 1.5e-4, kMin: 1e-8, kMax: 3e-5, collide: true, shadow: true, cap: 500, sink: 0.15 });
  // viruses (bacteriophages, ~0.2 um)
  const vm = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.3, metalness: 0.2 });
  S.add({ id: 9, variants: [{ geo: phageGeo(), mat: vm, size: new THREE.Vector3(1.7, 2, 1.7) }], cell: 5e-7, prob: 0.4, unit: 1e-7, sMin: 0.9, sMax: 1.15, rBH: 14, rMin: 1e-6, rMax: 1e-5, kMin: 1e-8, kMax: 2e-6, collide: true, shadow: true, cap: 1200 });
  return S;
}

// ---------------- game state ----------------
const S = {
  mode: 'menu', P: { x: 0, y: 0, z: 0 }, O: { x: 0, y: 0, z: 0 }, V: { x: 0, z: 0 }, vyBH: 0, onGround: true, peakY: 0,
  logK: 0, k: 1, mult: 1, speedOn: false, power: 100, heat: 0, coreTemp: 25, q: { x: 0, y: 0, z: 0 }, realm: -1,
  body: new Body(), yaw: 0, camYaw: 0, camPitch: 0.25, camDist: 4.6, facing: 0, seen: new Set(), stats: null, t: 0, msgT: 0,
  boomed: false, sizing: 0, fallBH: 0, jolt: 0,
};
const suit = bench.state; // what's inside your suit (changed in the suit bench)
bench.hooks = { hurt: (p, d, kind, c) => S.body.hurt(p, d, kind, c), heart: () => { S.body.heartStop = 6; } };
const BH = () => 1.8 * S.k;

function newLife(newSeed) {
  if (newSeed) { seed = Math.floor(Math.random() * 1e6); land = makeLand(seed); terrain.dispose(); terrain = new Terrain(land, T, macro); for (const C of scatter.classes) C.meshes.forEach(m => macro.remove(m)); scatter = buildScatter(land); }
  store.set('seed', seed);
  // start somewhere open and grassy
  let best = null;
  for (let i = 0; i < 60; i++) { const x = (i % 8) * 37 - 130, z = Math.floor(i / 8) * 41 - 140; const c = land.cover(x, z); const h = land.height(x, z, 1); const s = Math.abs(land.height(x + 2, z, 1) - h) + Math.abs(land.height(x, z + 2, 1) - h); const score = s + c[0] * 4; if (!best || score < best.s) best = { x, z, s: score }; }
  Object.assign(S, { P: { x: best.x, y: land.height(best.x, best.z, 0.1), z: best.z }, V: { x: 0, z: 0 }, vyBH: 0, onGround: true, logK: 0, k: 1, mult: 1, speedOn: false, power: 100, heat: 0, coreTemp: 25, realm: -1, boomed: false, sizing: 0, fallBH: 0 });
  S.peakY = S.P.y; S.body.reset(); S.seen.clear(); bench.reset();
  S.stats = { smallest: 1, fastest: 0, dist: 0, t0: performance.now() };
  rebase(); deep.group.visible = false; deep.lights.visible = false; macro.visible = true;
  ui.clearMessages();
}
function rebase() {
  S.O = { x: S.P.x, y: S.P.y, z: S.P.z };
  terrain.setOrigin(S.O); scatter.setOrigin(S.O);
}

// ---------------- input ----------------
const keys = new Set(); let mdx = 0, mdy = 0;
addEventListener('keydown', e => {
  if (e.target.matches?.('input,select')) return;
  const k = e.code; if (['Tab', 'Space', 'ControlLeft'].includes(k)) e.preventDefault();
  if (e.repeat) { keys.add(k); return; }
  keys.add(k);
  if (S.mode === 'play') {
    if (k === 'Escape') pause(true);
    else if (k === 'Tab') openBench();
    else if (k === 'KeyG') toggleSpeed();
  } else if (S.mode === 'mod') { if (k === 'Tab' || k === 'Escape') closeBench(); else bench.key(k); }
  else if (S.mode === 'pause' && k === 'Escape') pause(false);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { mdx += e.movementX; mdy += e.movementY; } });
canvas.addEventListener('click', () => { if (S.mode === 'play' && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });
addEventListener('wheel', e => { if (S.mode === 'play') S.camDist = Math.min(14, Math.max(2.2, S.camDist * (1 + e.deltaY * 0.001))); else if (S.mode === 'mod') bench.wheel(e.deltaY); }, { passive: true });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) S.hadLock = true; else if (S.mode === 'play' && S.hadLock) pause(true); });

function toggleSpeed() {
  if (!suit.speedWire || !suit.battery) { ui.message(!suit.battery ? 'The suit has no power. The battery is disconnected.' : 'Speed suit is dead: its coil wire is cut.'); return; }
  if (S.deep) { ui.message('The speed suit needs solid ground. You are floating.'); return; }
  S.speedOn = !S.speedOn; audio.click(); ui.message(S.speedOn ? 'Speed suit ON. Hold Shift and keep holding.' : 'Speed suit off.', 2);
}
function openBench() { S.mode = 'mod'; document.exitPointerLock?.(); bench.open(); ui.show('bench'); }
function closeBench() { bench.close(); S.mode = 'play'; ui.show('hud'); canvas.requestPointerLock?.(); }
function pause(on) { S.mode = on ? 'pause' : 'play'; ui.show(on ? 'pause' : 'hud'); if (on) document.exitPointerLock?.(); else canvas.requestPointerLock?.(); }
ui.on('begin', () => { audio.start(); newLife(false); S.mode = 'play'; ui.show('hud'); canvas.requestPointerLock?.(); ui.controlsHint(); });
ui.on('resume', () => pause(false));
ui.on('again', () => { newLife(true); S.mode = 'play'; ui.show('hud'); canvas.requestPointerLock?.(); });
ui.on('menu', () => { S.mode = 'menu'; ui.show('menu'); document.exitPointerLock?.(); });
ui.on('settings', v => { Object.assign(settings, v); store.set('settings', settings); audio.volume = settings.vol; quality.mode = settings.quality; applyQuality(); });
ui.on('quit', () => { fetch('/quit').catch(() => {}); setTimeout(() => window.close(), 200); });
ui.on('closeBench', () => closeBench());
ui.initSettings(settings);

// ---------------- helpers ----------------
function groundAt(x, z, k = S.k) {
  const t = land.height(x, z, 1.8 * k / 17);
  const s = scatter.topAt(x, z);
  return s.top > t ? { y: s.top, kind: s.kind, prop: true } : { y: t, kind: 'ground', prop: false };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function once(id, text, dur = 5) { if (S.seen.has(id)) return; S.seen.add(id); ui.message(text, dur); }

// ---------------- quality (keeps it smooth on its own) ----------------
const quality = { mode: TEST ? 'low' : settings.quality, level: 2, acc: 0, n: 0, cool: 0 };
const QL = [{ pr: 0.6, shadow: 1024, grass: 0.55 }, { pr: 0.8, shadow: 1024, grass: 0.8 }, { pr: 1, shadow: 2048, grass: 1 }, { pr: 1.25, shadow: 2048, grass: 1.15 }, { pr: 1.6, shadow: 4096, grass: 1.3 }];
function applyQuality() {
  const lvl = quality.mode === 'auto' ? quality.level : { low: 0, medium: 1, high: 2, ultra: 4 }[quality.mode] ?? 2; quality.cur = lvl;
  const q = QL[lvl]; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr));
  if (sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  const g = scatter.classes.find(c => c.id === 3); if (g) { g.rBH = 11 * q.grass; g.rMax = 20 * q.grass; g.last = null; }
  resize();
}
function autoQuality(dt) {
  if (quality.mode !== 'auto' || S.mode !== 'play') return;
  quality.acc += dt; quality.n++; quality.cool -= dt; if (quality.acc < 3) return;
  const fps = quality.n / quality.acc; quality.acc = 0; quality.n = 0; if (quality.cool > 0) return;
  if (fps < 40 && quality.level > 0) { quality.level--; quality.cool = 4; applyQuality(); }
  else if (fps > 58 && quality.level < 3) { quality.level++; quality.cool = 20; applyQuality(); }
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); const pr = renderer.getPixelRatio(); post.setSize(Math.floor(w * pr), Math.floor(h * pr)); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
applyQuality();

// ---------------- simulation ----------------
let stepAcc = 0;
function simulate(dt) {
  const body = S.body, legs = body.legs, alive = !body.dead;
  // ---- size ----
  const wantShrink = alive && keys.has('KeyQ'), wantGrow = alive && keys.has('KeyE');
  S.sizing = 0;
  if ((wantShrink || wantGrow) && suit.battery && suit.shrinkWire && S.power > 0) {
    const rate = 0.6 * (suit.oc ? 3 : 1) * (S.k < 1e-7 ? 1.6 : 1);
    const floorLog = suit.limiter ? -4 : -36.3;
    const before = S.logK;
    S.logK = Math.min(0, Math.max(floorLog, S.logK + (wantGrow ? rate : -rate) * dt));
    S.sizing = Math.abs(S.logK - before) > 0 ? 1 : 0;
    if (S.sizing) { S.power -= Math.abs(S.logK - before) * 1.4; S.coreTemp += Math.abs(S.logK - before) * (suit.oc ? 26 : 7); }
    if (wantShrink && suit.limiter && S.logK <= -4 + 1e-6) once('limiter', 'The suit won\'t go smaller than 0.2 mm - its LIMITER chip stops it. Press Tab to open the suit.', 7);
  } else if ((wantShrink || wantGrow) && alive) {
    once('nosize' + suit.battery + suit.shrinkWire, !suit.battery ? 'No power: the battery is disconnected.' : !suit.shrinkWire ? 'The shrink core wire is cut. You can\'t change size.' : 'Battery empty. Stand still to let it charge.', 3);
  }
  // unstable without the limiter: size jolts
  if (!suit.limiter && S.logK < -4) {
    S.jolt -= dt; if (S.jolt <= 0) { S.jolt = 2 + Math.random() * 5; S.logK = Math.max(-36.3, Math.min(0, S.logK + (Math.random() - 0.5) * 0.5)); body.hurt('torso', 1 + Math.random() * 2, 'blunt', 'Torn apart by an unstable shrink core'); ui.message('Size jolt - the core is unstable without the limiter.', 2); post.U.uGlitch.value = 1; }
  }
  S.k = Math.pow(10, S.logK);
  const k = S.k, bh = BH();
  // power, core heat
  if (!S.sizing && S.mult < 1.5) S.power = Math.min(100, S.power + dt * 3);
  S.coreTemp += (25 - S.coreTemp) * dt * 0.08;
  if (S.coreTemp > 90) { body.hurt('torso', (S.coreTemp - 90) * 0.04 * dt * 10, 'burn', 'Burned by the overclocked shrink core'); once('hot', 'The shrink core is burning hot against your chest.', 3); }
  S.stats.smallest = Math.min(S.stats.smallest, k);

  // ---- deep (smaller than a virus) or on the land ----
  const wasDeep = S.deep;
  S.deep = k < 1e-7;
  if (S.deep) {
    const ri = realmFor(k);
    if (ri !== S.realm) { S.realm = ri; S.q = { x: 0, y: 0, z: 0 }; const R = deep.enter(ri, seed, new THREE.Vector3(-Math.sin(S.camYaw), 0, -Math.cos(S.camYaw))); ui.message(R.name, 4); realmLines(ri); post.U.uFlash.value = 0.25; }
    if (!wasDeep) { macro.visible = false; deep.group.visible = true; deep.lights.visible = true; sun.visible = false; hemi.visible = false; S.speedOn = false; S.mult = 1; }
    const fwd = new THREE.Vector3(-Math.sin(S.camYaw) * Math.cos(S.camPitch), -Math.sin(S.camPitch), -Math.cos(S.camYaw) * Math.cos(S.camPitch));
    const right = new THREE.Vector3(Math.cos(S.camYaw), 0, -Math.sin(S.camYaw));
    const v = new THREE.Vector3();
    if (alive) { if (keys.has('KeyW')) v.add(fwd); if (keys.has('KeyS')) v.sub(fwd); if (keys.has('KeyD')) v.add(right); if (keys.has('KeyA')) v.sub(right); if (keys.has('Space')) v.y += 1; if (keys.has('ControlLeft') || keys.has('KeyC')) v.y -= 1; }
    if (v.lengthSq() > 0) v.normalize().multiplyScalar((keys.has('ShiftLeft') ? 4.5 : 1.6) * bh);
    // molecules bump into you all the time (Brownian motion)
    const jit = S.realm === 0 ? 0.9 : S.realm === 5 ? 0.4 : 0;
    S.q.x += (v.x + (Math.random() - 0.5) * jit * bh * 6) * dt; S.q.y += (v.y + (Math.random() - 0.5) * jit * bh * 6) * dt; S.q.z += (v.z + (Math.random() - 0.5) * jit * bh * 6) * dt;
    if (v.lengthSq() > 0) S.facing = Math.atan2(v.x, v.z);
    if (S.realm === 6) body.hurt(PARTS[Math.floor(Math.random() * 6)], dt * 9, 'blunt', 'Went smaller than reality - there was nothing left to be made of');
    S.speedBH = v.length() / bh; S.inAir = true; S.fallBH = 0;
    deep.update(dt, k, S.q);
    const R = REALMS[S.realm];
    deepBg.set(R.bg); scene.background = deepBg; deepFog.color.set(R.bg); deepFog.density = R.fog; scene.fog = deepFog;
  } else {
    if (wasDeep) { macro.visible = true; deep.group.visible = false; deep.lights.visible = false; sun.visible = true; hemi.visible = true; S.realm = -1; scene.background = sky; S.P.y = groundAt(S.P.x, S.P.z).y; S.vyBH = 0; S.onGround = true; rebase(); }
    landPhysics(dt, alive, legs);
  }
  body.update(dt);
  if (body.dead && S.mode === 'play') die();
  sizeLines();
}

function landPhysics(dt, alive, legs) {
  const body = S.body, k = S.k, bh = BH();
  // horizontal input (relative to camera)
  let ix = 0, iz = 0;
  if (alive) { if (keys.has('KeyW')) iz -= 1; if (keys.has('KeyS')) iz += 1; if (keys.has('KeyA')) ix -= 1; if (keys.has('KeyD')) ix += 1; }
  const il = Math.hypot(ix, iz);
  const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
  // speed suit: holding Shift keeps doubling your speed
  if (S.speedOn && shift && il > 0 && legs === 0 && S.power > 0 && suit.speedWire && suit.battery) {
    const rate = Math.LN2 * (suit.oc ? 1.6 : 1) * (suit.shield ? 1 : 1.3);
    S.mult *= Math.exp(rate * dt); S.mult = Math.min(S.mult, 2e12);
    S.power -= dt * (0.4 + Math.log10(S.mult) * 0.25) * (suit.oc ? 1.5 : 1);
    if (S.power <= 0) ui.message('Battery empty. The speed suit cuts out.', 3);
  } else S.mult = 1 + (S.mult - 1) * Math.exp(-dt * (S.mult > 50 ? 2.5 : 4));
  let target = (shift && legs === 0 ? 3.0 : 0.8) * (legs === 1 ? 0.45 : legs === 2 ? 0.15 : 1); // body heights per second
  if (S.mult > 1.01) target = 3.0 * S.mult;
  const vReal = target * bh; // m/s
  if (il > 0) {
    const a = Math.atan2(ix, iz) + S.camYaw;
    const tx = Math.sin(a) * vReal, tz = Math.cos(a) * vReal;
    const acc = S.onGround ? (S.mult > 2 ? 1 : 10) : 2;
    S.V.x += (tx - S.V.x) * Math.min(1, dt * acc); S.V.z += (tz - S.V.z) * Math.min(1, dt * acc);
    if (S.mult > 2) { S.V.x = tx; S.V.z = tz; }
    S.facing = a;
  } else { const f = Math.exp(-dt * (S.onGround ? 10 : 1)); S.V.x *= f; S.V.z *= f; }
  const speed = Math.hypot(S.V.x, S.V.z);
  const fast = S.speedOn && speed > 20; // the suit grips the ground
  const plow = speed > MACH; // the suit's field shoves rocks aside
  // move in small steps, stepping over small stuff, blocked by big stuff (hills never block you, rocks do)
  const nSub = plow ? 1 : Math.min(10, Math.max(1, Math.ceil(speed * dt / (0.4 * bh))));
  const sdt = dt / nSub, step = 0.45 * bh;
  let g1 = null;
  for (let i = 0; i < nSub; i++) {
    const nx = S.P.x + S.V.x * sdt, nz = S.P.z + S.V.z * sdt;
    g1 = plow ? { y: land.height(nx, nz, Math.max(bh / 17, speed * dt * 0.5)), kind: 'ground', prop: false } : groundAt(nx, nz);
    if (!plow && g1.prop && g1.y - S.P.y > step && (S.onGround || g1.y - S.P.y > 0)) {
      const sp = Math.hypot(S.V.x, S.V.z), hitBH = sp / bh;
      if (hitBH > 4) { const d = (hitBH - 4) * 7; const what = g1.kind === 'rock' ? 'a rock' : 'something'; body.hurt('torso', d, 'blunt', `Ran into ${what} at ${fmtSpeed(sp)}`); body.hurt('head', d * 0.6, 'blunt', `Ran into ${what} at ${fmtSpeed(sp)}`); audio.crack(); S.mult = 1; post.U.uFlash.value = 0.3; }
      const gx = groundAt(nx, S.P.z), gz = groundAt(S.P.x, nz);
      if (gx.y - S.P.y <= step) { S.P.x = nx; g1 = gx; S.V.z *= 0.3; } else if (gz.y - S.P.y <= step) { S.P.z = nz; g1 = gz; S.V.x *= 0.3; } else { S.V.x = S.V.z = 0; g1 = groundAt(S.P.x, S.P.z); break; }
    } else { S.P.x = nx; S.P.z = nz; }
    if (S.onGround && (fast || g1.y >= S.P.y - 0.12 * bh)) S.P.y = g1.y;
  }
  S.stats.dist += speed * dt; S.stats.fastest = Math.max(S.stats.fastest, speed);
  // vertical
  const g = g1.y;
  if (S.onGround) {
    if (alive && keys.has('Space') && legs === 0) { S.vyBH = suit.mass && k < 0.5 ? 4.4 : 2.15; S.onGround = false; S.peakY = S.P.y; }
    else if (!fast && g < S.P.y - 0.12 * bh) { S.onGround = false; S.vyBH = 0; S.peakY = S.P.y; }
    else { S.P.y = g; S.vyBH = 0; }
  }
  if (!S.onGround) {
    S.vyBH -= 5.4 * dt;
    // terminal speed: tiny things fall slowly (the air holds you up). Unless you kept your full mass.
    const cap = suit.mass ? 30 : 3 + 27 * Math.pow(smooth(0.05, 1, k), 2);
    if (S.vyBH < -cap) S.vyBH += (-cap - S.vyBH) * Math.min(1, dt * 6);
    S.P.y += S.vyBH * bh * dt; S.peakY = Math.max(S.peakY, S.P.y);
    S.fallBH = Math.max(0, -S.vyBH);
    if (S.P.y <= g) {
      const fell = (S.peakY - g) / bh;
      S.P.y = g; S.onGround = true; S.vyBH = 0; S.fallBH = 0;
      if (fell > 2.2) { const sev = fallDamage(body, fell, g1.kind === 'rock' ? 'rock' : null); audio.land(sev); if (sev > 2) audio.crack(); audio.hurt(); post.U.uFlash.value = Math.min(0.5, sev * 0.06); ui.message(`You fell ${fell.toFixed(1)} body heights.`, 3); }
      else if (fell > 0.6) audio.land(0.3);
    }
  }
  S.inAir = !S.onGround; S.speedBH = speed / bh;
  // footsteps
  if (S.onGround && speed > 0.2 * bh && S.mult < 3) { stepAcc += dt * S.speedBH * 0.9; if (stepAcc > 1) { stepAcc = 0; audio.step(k); } }
  // speed events (real numbers)
  const v = speed;
  if (v > MACH && !S.boomed) { S.boomed = true; audio.boom(); post.U.uFlash.value = 0.6; S.shake = 1; once('mach1', 'Sound barrier. That boom was you.', 4); }
  if (v < MACH * 0.9) S.boomed = false;
  if (v > 12.4) once('bolt', 'Faster than any human has ever run.', 3);
  if (v > MACH * 5) {
    once('mach5', 'Mach 5. The air in front of you is heating to hundreds of degrees.', 4);
    if (!suit.shield) { const r = (v / (MACH * 5) - 1) * 0.6 + 0.4; for (const p of ['torso', 'armL', 'armR', 'legL', 'legR', 'head']) body.hurt(p, r * dt * 6, 'burn', `Burned alive by air friction at ${fmtSpeed(v)} - no heat shield`); once('noshield', 'No heat shield. You are burning.', 3); }
  }
  if (v > 11200) once('escape', 'Escape velocity: 11.2 km/s. Fast enough to leave Earth.', 4);
  if (v > 0.1 * C_LIGHT) once('c10', '10% of light speed. Time is slowing down for you.', 4);
  if (v > 0.9 * C_LIGHT) once('c90', '90% of light speed. Light ahead turns blue. Everything bunches up in front of you.', 5);
  if (v > C_LIGHT) { once('c1', 'Faster than light. This is not supposed to be possible.', 5); }
  if (v > 2 * C_LIGHT) { once('c2', 'Reality can\'t keep up with you. Let go of Shift to come back.', 6); const over = Math.log10(v / C_LIGHT); body.hurt(PARTS[Math.floor(Math.random() * 6)], over * dt * 7, 'blunt', 'Outran reality'); }
  S.heat = Math.min(1, Math.max(0, (v / (MACH * 5) - 0.6) * 0.5)) * (v < C_LIGHT ? 1 : 0.3);
}

function sizeLines() {
  const k = S.k;
  if (k < 0.12) once('s1', 'Mouse sized. The grass is up to your chest.');
  if (k < 0.025) once('s2', 'The grass is a forest now.');
  if (k < 0.0045) once('s3', 'Ant sized. A pebble is a hill. A stair would be a mountain. Falls are counted in body heights now.', 6);
  if (k < 0.0012) once('s4', 'Sand grains look like boulders.');
  if (k < 9e-5) once('s5', 'Silt and clay. Every speck is a different rock.');
  if (k < 2.5e-5) once('s6', 'Bacteria. Billions of them live in one handful of soil.', 5);
  if (k < 1.2e-6) once('s7', 'You are smaller than a bacterium.');
  if (k < 3e-7) once('s8', 'Light waves are bigger than you now. Light can\'t show you anything. Electron vision on.', 6);
  if (k < 2.5e-7) once('s9', 'Viruses. These ones hunt bacteria.');
}
function realmLines(i) {
  const L = ['DNA - the code of every living thing. Water molecules everywhere, shoving you around.', 'You are inside the sand grain you were standing on: a quartz crystal. Blue = silicon, red = oxygen.', 'An atom is almost all empty space. The nucleus is 100,000 times smaller than the atom. The suit marks it.', 'Held together by the strongest force there is.', 'Particles pop in and out of existence here.', 'From here down, nobody knows what is real. Keep going and you hit the Planck length.', 'There is no smaller. You are past the edge of reality. Get out (E).'];
  setTimeout(() => ui.message(L[i], 6), 1800);
}
function die() {
  S.mode = 'dead'; document.exitPointerLock?.(); audio.hurt();
  const st = S.stats, mins = (performance.now() - st.t0) / 60000;
  setTimeout(() => ui.death(S.body.cause || 'Unknown', { lived: mins, smallest: fmtSize(1.8 * st.smallest), fastest: fmtSpeed(st.fastest), dist: st.dist }), 1600);
}

// ---------------- frame ----------------
const landFog = new THREE.FogExp2(0xbfcad6, 0.001), deepFog = new THREE.FogExp2(0, 0.01), deepBg = new THREE.Color(), streakBg = new THREE.Color(0x0b0d18);
const clock = new THREE.Clock(); let hudT = 0; const prof = { js: 0, gpu: 0 };
renderer.info.autoReset = false;
const tmpV = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05); S.t += dt; const tA = performance.now(); renderer.info.reset();
  if (S.mode === 'mod') { if (S.body.dead) { closeBench(); return; } bench.frame(dt); audio.update(dt, { speed: 0, fallBH: 0, k: S.k, deep: false, sizing: 0, realm: 0, health: S.body.health, dead: false, menu: true }); return; }
  if (S.mode === 'play' || S.mode === 'dead') simulate(dt);
  if (S.mode === 'menu') { S.camYaw += dt * 0.03; }
  // camera control
  if (S.mode === 'play') {
    S.camYaw -= mdx * 0.0023 * settings.sens; S.camPitch = Math.min(1.35, Math.max(-1.2, S.camPitch + mdy * 0.002 * settings.sens));
  }
  mdx = mdy = 0;
  const k = S.k;
  // world placement: you stay at the middle, the world moves and scales around you
  if (!S.deep) {
    const speed = Math.hypot(S.V.x, S.V.z);
    const rebaseDist = Math.min(3000, 2000 * BH());
    if (Math.hypot(S.P.x - S.O.x, S.P.z - S.O.z) > rebaseDist || Math.abs(S.P.y - S.O.y) > rebaseDist) rebase();
    const fast = speed > 300 ? speed * 0.05 : 0;
    const streak = speed > 60000;
    macro.visible = !streak;
    if (!streak) {
      terrain.update(S.P, k, speed > 2000 ? 1 : 2, fast);
      if (speed < 2000) scatter.update(S.P, k, 2); else scatter.classes.forEach(C => { if (C.n && C.id !== 1) { C.meshes.forEach(m => m.count = 0); C.n = 0; C.last = null; } });
    }
    macro.position.set((S.O.x - S.P.x) / k, (S.O.y - S.P.y) / k, (S.O.z - S.P.z) / k); macro.scale.setScalar(1 / k);
    const R = 0.0009 * k; // haze per render unit (real air) + a minimum so tiny worlds fade into the distance
    landFog.density = Math.max(R * 1.0, 1 / 900); scene.fog = landFog;
    scene.background = streak ? streakBg : sky;
  }
  // avatar
  avatar.root.rotation.y = lerpAngle(avatar.root.rotation.y, S.facing, 0.15);
  avatar.root.visible = S.mode !== 'menu';
  avatar.update(dt, { speedBH: S.speedBH || 0, inAir: S.inAir && (S.fallBH > 0.3 || S.deep), dead: S.body.dead, limp: S.body.legs > 0, fast: S.mult > 3, heat: S.heat, mode: S.sizing ? 'shrink' : S.mult > 1.5 ? 'speed' : 'normal', deep: S.deep });
  // camera (orbit behind you, kept above the ground)
  let dist = S.camDist, pitch = S.camPitch;
  if (S.mode === 'menu') { dist = 7; pitch = 0.12; }
  const tgt = tmpV.set(0, S.mode === 'menu' ? 1.6 : 1.35, 0);
  const cx = Math.sin(S.camYaw) * Math.cos(pitch) * dist, cz = Math.cos(S.camYaw) * Math.cos(pitch) * dist;
  let cy = tgt.y + Math.sin(pitch) * dist;
  if (!S.deep) { const gy = (groundAt(S.P.x + cx * k, S.P.z + cz * k).y - S.P.y) / k; if (cy < gy + 0.3) cy = gy + 0.3; }
  camera.position.set(cx, cy, cz);
  if (S.shake > 0) { S.shake -= dt * 1.5; camera.position.x += (Math.random() - 0.5) * S.shake * 0.3; camera.position.y += (Math.random() - 0.5) * S.shake * 0.3; }
  camera.lookAt(tgt);
  camera.near = 0.02; camera.updateProjectionMatrix();
  // sun + shadows follow you at your size
  sun.position.copy(sunDir).multiplyScalar(30); sun.target.position.set(0, 0, 0);
  // post effects
  const v = Math.hypot(S.V.x, S.V.z), U = post.U;
  U.uBeta.value = S.deep ? 0 : Math.min(0.995, v / C_LIGHT);
  U.uBreak.value = S.deep ? (S.realm === 6 ? 1.0 : S.realm === 5 ? Math.max(0, (-S.logK - 30) / 8) : 0) : v > C_LIGHT ? Math.min(2, Math.log10(v / C_LIGHT) * 0.8 + 0.25) : 0;
  U.uBlur.value = S.deep ? 0 : Math.min(0.55, Math.max(0, Math.log10(Math.max(v, 1)) - 3) * 0.3);
  U.uHeat.value = S.heat; U.uElectron.value = smooth(-6.4, -6.9, S.logK) * (1 - smooth(-9.2, -9.7, S.logK));
  const hp = S.body.health; U.uHurt.value = Math.min(1, Math.max(0, (60 - hp) / 50)); U.uDesat.value = Math.min(0.85, Math.max(0, (45 - hp) / 45));
  U.uFlash.value *= Math.exp(-dt * 3); U.uGlitch.value *= Math.exp(-dt * 4);
  U.uFade.value = S.mode === 'dead' ? Math.min(0.85, U.uFade.value + dt * 0.5) : Math.max(0, U.uFade.value - dt * 2);
  const tB = performance.now(); post.render(scene, camera, S.t); renderer.getContext().finish?.(); const tC = performance.now();
  prof.js = prof.js * 0.9 + (tB - tA) * 0.1; prof.gpu = prof.gpu * 0.9 + (tC - tB) * 0.1;
  // sound + screen text
  audio.update(dt, { speed: S.deep ? 0 : v, fallBH: S.fallBH || 0, k, deep: S.deep, sizing: S.sizing, realm: Math.max(0, S.realm), health: hp, dead: S.body.dead, menu: S.mode === 'menu' });
  hudT -= dt;
  if (hudT <= 0 && (S.mode === 'play' || S.mode === 'dead')) {
    hudT = 0.1;
    ui.hud({ size: fmtSize(1.8 * k), as: asBigAs(1.8 * k), speed: v, deep: S.deep, realm: S.realm >= 0 ? REALMS[S.realm].name : '', body: S.body, power: S.power, temp: S.coreTemp, speedOn: S.speedOn, suit, k, planck: k < PLANCK_K });
  }
  autoQuality(dt);
}
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

// start: menu over the real land
newLife(false);
ui.show('menu'); ui.loading(1);
for (let i = 0; i < 30; i++) terrain.update(S.P, 1, 6);
scatter.update(S.P, 1, 20);
window.__ol = { G, THREE, prof, S, suit, bench, scatter, terrain, land, keys, renderer, quality, newLife, deep, post, camera };
requestAnimationFrame(frame);
setInterval(() => fetch('/alive').catch(() => {}), 20000);
