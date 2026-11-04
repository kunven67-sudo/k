// THE MASK - start-up and the frame loop.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { G, on, emit, trophiesInit, mergeStatic, clamp } from './game.js';
import { S, loadSettings, saveSettings } from './settings.js';
import { buildRoom, setLoaderManager, ROOM } from './room.js';
import { buildMask } from './mask.js';
import { buildRoomShell, step, CANNON } from './physics.js';
import { props, setupRoomProps, initProps, Prop } from './props.js';
import { people } from './people.js';
import { loadChars, TYPES } from './chars.js';
import { gadgets, hitTest } from './gadgets.js';
import { blood } from './blood.js';
import { fx } from './fx.js';
import { audio } from './audio.js';
import { loop } from './loop.js';
import { Copy } from './copies.js';
import { createPlayer } from './player.js';
import { ui } from './ui.js';
import { initInput, input, initTouch, touch } from './input.js';
import { voice } from './voice.js';

const BASE = '';
G.noLock = new URLSearchParams(location.search).has('nolock'); G.noAutoPause = G.noLock;
// the one-file build puts every asset in window.__ASSETS (path -> data: URL)
const manager = new THREE.LoadingManager();
manager.setURLModifier((u) => {
  if (!window.__ASSETS) return u;
  const k = u.replace(/^\.\//, '').replace(/^.*?(assets\/)/, 'assets/');
  return window.__ASSETS[k] || u;
});
const loadEl = document.getElementById('loading');
const say = (s) => { if (loadEl) loadEl.querySelector('small').textContent = s; };

async function boot() {
  loadSettings();
  // ---- renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0a10); scene.fog = new THREE.Fog(0x120c12, 7, 18);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.02, 60);
  Object.assign(G, { renderer, scene, camera, props, people, gadgets, blood, fx, audio, loop, ui, hitTest });
  const fit = () => { if (G.xr) return; camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 92 : 72; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
  addEventListener('resize', fit); fit();

  // ---- the room + everything in it
  say('Building the room...');
  setLoaderManager(manager); initProps(BASE, manager);
  const room = await buildRoom(scene, BASE); G.room = room;
  buildRoomShell();
  const stand = setupRoomProps(room);
  // the mask, waiting on its stand
  const maskModel = mergeStatic(buildMask());
  stand.obj.updateMatrixWorld(true);
  const at = stand.model.localToWorld(new THREE.Vector3(0, 0.205, 0.035));
  const mask = new Prop({ id: 'mask', mass: 0.35 }, maskModel, { pos: at, quat: stand.obj.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0))), spawned: false });
  mask.special = 'mask'; props.list.push(mask); G.mask = mask;
  mask.glued = true; mask.body.type = CANNON.Body.KINEMATIC;
  mask.obj.updateMatrixWorld(true);
  mask.glue = new THREE.Matrix4().copy(stand.obj.matrixWorld).invert().multiply(mask.obj.matrixWorld);
  say('Waking up the people...');
  await loadChars(BASE, new GLTFLoader(manager));
  fx.init(scene, camera); blood.init(scene);
  const player = createPlayer(renderer, camera, scene); G.player = player;
  loop.init(); ui.init(document.body); ui.buildVR(scene);
  initInput(renderer.domElement);
  trophiesInit();
  quality.init(renderer, room);

  // ---- compile every shader now (a new copy or person must never freeze VR for a moment)
  say('Getting ready...');
  const tmpP = TYPES.map((t, i) => people.spawn(t, new THREE.Vector3(-2 + i, 0, 2.6), 0));
  const fake = { frames: new Float32Array(27 * 30).fill(0), events: [], dur: 1, eyeH: 1.6 };
  for (let i = 0; i < 30; i++) { fake.frames.set([0, 1.6, 2.5, 0, 0, 0, 1], i * 27); fake.frames.set([0, 0, 0, 1], i * 27 + 10); fake.frames.set([0, 0, 0, 1], i * 27 + 19); fake.frames[i * 27 + 26] = 1; }
  const tmpC = new Copy(fake, 0x3fd0c4); tmpC.update(0.016, 0.5);
  const tmpG = gadgets.list.length ? null : ['blaster', 'blackhole', 'freeze', 'size', 'float', 'clone'].map((id, i) => gadgets.spawn(id, new THREE.Vector3(-1 + i * 0.3, 0.2, 3)));
  blood.splat(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 1, 0), 0.01); fx.burst(new THREE.Vector3(0, 1, 3), 0xffffff, 2);
  fx.beam(new THREE.Vector3(0, 1, 3), new THREE.Vector3(0.1, 1, 3), 0xffffff); fx.ring(new THREE.Vector3(0, 1, 3), 0xffffff);
  people.update(0.016);
  try { renderer.compile(scene, camera); } catch (e) { /* older browsers */ }
  renderer.render(scene, camera);
  for (const p of tmpP) people.remove(p);
  tmpC.dispose(); if (tmpG) gadgets.clear(); blood.clear();

  // ---- sounds that come from the room
  on('lightning', (k) => setTimeout(() => audio.play('thunder', null, k), 500 + Math.random() * 1600));
  on('maskOn', () => { loop.start(); });
  addEventListener('visibilitychange', () => { if (document.hidden && G.started && !G.xr && !G.paused) ui.open(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.started && !G.xr && !G.paused && !G.touch && !G.noAutoPause) ui.open(); });
  addEventListener('keydown', (e) => {
    if (!G.started || G.xr) return;
    if (e.code === 'Tab') { e.preventDefault(); ui.isOpen() ? ui.close() : (ui.open('spawn'), ui.usedMenu = true); }
    else if (e.code === 'Escape' && ui.isOpen()) ui.close();
  });

  // ---- title screen
  if (loadEl) loadEl.remove();
  G.xrSupported = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false));
  const isPhone = matchMedia('(pointer: coarse)').matches && !G.xrSupported;
  camera.position.set(0, 1.6, 0); player.rig.position.set(0, 0, 1.45);
  ui.title({
    vr: G.xrSupported,
    onPlay: () => { if (isPhone) setupTouch(); startGame(); },
    onVR: () => enterVR()
  });
  if (new URLSearchParams(location.search).has('autostart')) { document.querySelector('#title').hidden = true; startGame(); }

  const clock = new THREE.Clock();
  let realT = 0, tickT = 0, tock = false, fpsAvg = 60;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta()); realT += dt;
    fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    if (G.xr) renderer.xr.updateCamera(camera);
    const live = G.started && !G.paused;
    if (live) { G.t += dt; G.dt = dt; }
    player.update(live ? dt : 0.0001);
    if (live) {
      step(dt);
      props.update(dt); people.update(dt); gadgets.update(dt); blood.update(dt);
      glueMask();
      loop.update(dt);
    }
    fx.update(dt);
    room.update(realT, dt, loop.clockDate, loop.frac);
    ui.update(dt, fpsAvg);
    audio.listen(camera);
    // the grandfather clock ticks (fast while time rewinds)
    tickT += dt * (loop.rewinding > 0 ? 8 : 1);
    if (tickT >= 1) { tickT -= 1; tock = !tock; audio.play(tock ? 'tock' : 'tick', CLOCK_POS, 0.35); }
    quality.update(dt, fpsAvg);
    renderer.render(scene, camera);
    input.endFrame();
    G.frame++;
  });
  window.__game = G; // for tests
}
const CLOCK_POS = new THREE.Vector3(-2.75, 1.8, -1.3);

function glueMask() {
  const m = G.mask; if (!m || !m.glued) return;
  const stand = props.list.find((p) => p.def.id === 'stand');
  if (m.held || m.removed || !stand || stand.body.velocity.length() > 0.6 || stand.held || stand.removed) {
    m.glued = false; if (!m.held && !m.removed) { m.body.type = CANNON.Body.DYNAMIC; m.body.updateMassProperties(); m.body.wakeUp(); }
    return;
  }
  stand.obj.updateMatrixWorld(true);
  const w = new THREE.Matrix4().multiplyMatrices(stand.obj.matrixWorld, m.glue), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  w.decompose(p, q, s); m.holdAt(p, q, null);
}

function startGame() {
  audio.init(); audio.startRain(); audio.applyVolumes(); audio.setSpatial(false);
  G.started = true; G.paused = false;
  const c = G.renderer.domElement;
  if (!G.touch && !G.noLock && c.requestPointerLock) { try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* click to look */ } }
}

async function enterVR() {
  let session;
  try { session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); }
  catch (e) { ui.toast('VR could not start: ' + (e.message || e)); document.querySelector('#title').hidden = false; return; }
  const r = G.renderer;
  r.xr.setFramebufferScaleFactor(quality.xrScale());
  await r.xr.setSession(session);
  try { r.xr.setFoveation(S.quality === 'ultra' ? 0.2 : 0.8); } catch (e) { /* not supported */ }
  G.xr = true; G.player.enterXR(); audio.setSpatial(true);
  audio.init(); audio.startRain(); audio.applyVolumes();
  G.started = true; G.paused = false;
  if (S.voice && !voice.on) voice.enable();
  session.addEventListener('end', () => {
    G.xr = false; G.player.exitXR(); audio.setSpatial(false); ui.toggleVRMenu(false);
    G.paused = true; ui.open('help');
  });
}

function setupTouch() {
  document.body.classList.add('touch');
  const fireQ = [], punchQ = [], grabQ = [];
  initTouch(document.body, [
    { id: 'menu', label: 'Menu', down: () => (ui.isOpen() ? ui.close() : ui.open('spawn')) },
    { id: 'rec', label: 'Rec', down: () => G.loop.pressRecord() },
    { id: 'gadget', label: 'Gadget', down: () => ui.cycleGadget(G.player.hands[1]) },
    { id: 'grab', label: 'Grab', down: () => grabQ.push(1) },
    { id: 'punch', label: 'Punch', down: () => punchQ.push(1) },
    { id: 'fire', label: 'Use', big: true, down: () => fireQ.push(1) }
  ]);
  G.touchFire = () => fireQ.splice(0).length > 0;
  G.touchPunch = () => punchQ.splice(0).length > 0;
  G.touchGrab = () => grabQ.splice(0).length > 0;
  G.touchHeld = (id) => !!touch.buttons[id];
}

/* ---------- graphics quality: Auto keeps the frame rate up (GT 1030 / Quest), Ultra = everything ---------- */
const LEVELS = ['low', 'medium', 'high', 'ultra'];
const quality = {
  cur: 2, t: 0,
  init(renderer, room) { this.r = renderer; this.room = room; G.quality = this; this.apply(); },
  level() { return S.quality === 'auto' ? LEVELS[this.cur] : S.quality; },
  levelName() { return { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' }[this.level()]; },
  apply() {
    const L = this.level(), moon = this.room.moon;
    const pr = { low: 0.7, medium: 0.85, high: 1, ultra: Math.min(2, devicePixelRatio || 1) }[L];
    if (!G.xr) this.r.setPixelRatio(Math.min(pr * (this.scale || 1), 2));
    const shadows = L !== 'low';
    if (moon.castShadow !== shadows) { moon.castShadow = shadows; G.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); }
    const size = { low: 512, medium: 1024, high: 2048, ultra: 4096 }[L];
    if (moon.shadow.mapSize.x !== size) { moon.shadow.mapSize.set(size, size); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } }
    blood.setMax({ low: 90, medium: 160, high: 240, ultra: 400 }[L]);
  },
  xrScale() { return { low: 0.75, medium: 0.9, high: 1, ultra: 1.25 }[this.level()]; },
  update(dt, fps) {
    if (S.quality !== 'auto' || !G.started) return;
    this.t += dt; if (this.t < 2) return;
    // Auto: change the resolution a little at a time (never the shadows, that would stutter)
    const target = G.xr ? 70 : 55;
    if (fps < target * 0.88) { this.scale = Math.max(0.55, (this.scale || 1) - 0.1); this.t = 0; if (!G.xr) this.apply(); else try { this.r.xr.setFoveation(1); } catch (e) { /* */ } }
    else if (fps > target * 1.04 && (this.scale || 1) < 1 && this.t > 6) { this.scale = Math.min(1, (this.scale || 1) + 0.05); this.t = 0; if (!G.xr) this.apply(); }
  }
};

boot().catch((e) => { console.error(e); say('Something went wrong: ' + e.message); });
