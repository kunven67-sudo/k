// Real Life Sandbox: entry point. Boots physics + renderer, runs the menu / game loop.
import * as THREE from 'three';
import * as PHYS from './engine/physics.js';
import { initPhysics, stepPhysics, physicsState, world } from './engine/physics.js';
import { input } from './engine/input.js';
import { getSettings, getPreset, onSettingsChange } from './settings.js';
import { Environment } from './world/environment.js';
import { buildArena } from './world/arena.js';
import { Effects } from './fx/effects.js';
import { ctx } from './game/ctx.js';
import { initEntities, resetBreakBudget, spawn, recordPrev, syncVisuals, processImpacts, updateDebris, updateJoints, clearAll, entities, removeEntity, entityFromCollider } from './game/entities.js';
import { initExplosions, updateExplosives, explode } from './game/explosions.js';
import { Player } from './game/player.js';
import { initTools, updateToolsFrame, updateToolsStep, resetTools, say } from './game/tools.js';
import { CATALOG } from './game/catalog.js';
import { showHud, updateHud, hint, refreshHotbar } from './ui/hud.js';
import { initSpawnMenu, openSpawnMenu, closeSpawnMenu, spawnMenuOpen } from './ui/spawnMenu.js';
import { initMenus, show, loadingTip } from './ui/menus.js';
import { renderThumbs } from './ui/thumbs.js';
import { audio } from './audio/index.js';
import { R, G, groups } from './engine/physics.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

let renderer, scene, camera, env, fx, player, arena;
let mode = 'loading'; // loading | menu | playing | paused | spawn
let last = performance.now();
let windows = [];

async function progress(p, msg) {
  $('loading-fill').style.width = `${Math.round(p * 100)}%`;
  if (msg) $('loading-tip').textContent = msg;
  await nextFrame();
}

async function boot() {
  $('loading-tip').textContent = loadingTip();
  await progress(0.05);
  await initPhysics();
  await progress(0.2);

  const preset = getPreset();
  renderer = new THREE.WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = getSettings().shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('game').appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(getSettings().fov, innerWidth / innerHeight, 0.05, 6000);
  scene.add(camera);
  Object.assign(ctx, { renderer, scene, camera });
  resize();
  addEventListener('resize', resize);

  env = new Environment(renderer, scene);
  await progress(0.35);
  fx = new Effects(scene, camera);
  ctx.fx = fx;
  initEntities();
  initExplosions();
  arena = buildArena(scene);
  ctx.arena = arena;
  await progress(0.55);
  player = new Player(camera);
  ctx.player = player;
  initTools();
  input.attach(renderer.domElement);
  input.lockHandlers.add(onLockChange);
  initSpawnMenu(() => closeSpawn());
  initMenus({
    play: startGame, resume: resume, clear: () => { resetWorld(); resume(); }, quit: toMenu,
  });
  onSettingsChange(onSetting);
  hookGameEvents();
  await progress(0.65, 'Recording sounds...');
  await audio.init();
  ctx.audio = audio;
  await progress(0.7, loadingTip());

  // precompile shaders with every material in view so the first explosion doesn't stutter
  buildDemo();
  renderThumbs(CATALOG);
  refreshHotbar();
  camera.position.set(20, 6, 20);
  camera.lookAt(0, 1, 0);
  renderer.compile(scene, camera);
  await progress(1);

  show('loading', false);
  show('main-menu', true);
  mode = 'menu';
  // handy for debugging from the browser console
  window.__rls = { ctx, spawn, explode, entities, physicsState, startGame, PHYS, pause() { mode = 'paused'; }, get mode() { return mode; }, set mode(m) { mode = m; } };
  requestAnimationFrame(loop);
}

function resize() {
  const s = getSettings();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * s.renderScale);
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
}

function onSetting(key) {
  if (key === 'renderScale' || key === 'fov' || key === 'quality') resize();
  if (key === 'quality') env.applyQuality();
  if (key === 'shadows') {
    renderer.shadowMap.enabled = getSettings().shadows;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
}

// --------------------------------------------------------------------------- world setup
function makeWindows() {
  for (const w of windows) if (w.alive) removeEntity(w, { silent: true });
  windows = arena.windows.map((wd) => {
    const geo = new THREE.BoxGeometry(wd.w, wd.h, 0.008);
    const e = spawn(null, {
      pos: wd.pos, frozen: true,
      parts: [{ shape: { type: 'box', hx: wd.w / 2, hy: wd.h / 2, hz: 0.005 }, mat: 'glass', pos: [0, 0, 0], rot: [0, 0, 0], meshes: [{ geo, mat: 'glass' }] }],
    });
    e.defId = 'window'; e.label = 'Window'; e.permanent = true;
    return e;
  });
}

function placeFurniture() {
  for (const f of arena.furniture) spawn(f.id, { pos: f.pos, quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.yaw) });
}

function resetWorld() {
  resetTools();
  clearAll();
  makeWindows();
  placeFurniture();
}

// Background scene for the main menu: a stack of stuff that gets blown up on a loop.
let demoTimer = 0, demoPhase = 0;
function buildDemo() {
  clearAll();
  const q = new THREE.Quaternion();
  const put = (id, x, y, z, yaw = 0) => spawn(id, { pos: new THREE.Vector3(x, y, z), quat: q.clone().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw) });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) put('crate', -1.25 + i * 0.82, 0.4 + j * 0.8, -0.4 + (j % 2) * 0.05, 0);
  put('cblock', 3.2, 0.4, 0.5);
  put('cblock', 3.2, 1.2, 0.5);
  put('drum', -3, 0.44, 1.2);
  put('drumEmpty', -3.7, 0.44, 0.3);
  put('propane', -2.4, 0.3, -1.4);
  put('glasswall', 0.2, 1.25, 2.2);
  put('barrier', 2.5, 0.405, -2.6, 0.2);
  put('pallet', -0.5, 0.08, -2.4);
  put('tv', 0.4, 2.0, -0.4);
  demoTimer = 0;
  demoPhase = 0;
}
function updateDemo(dt) {
  demoTimer += dt;
  if (demoPhase === 0 && demoTimer > 3.5) {
    demoPhase = 1;
    explode(new THREE.Vector3(0.3, 0.3, 0.9), 1.0, { shrapnel: 20 });
  }
  if (demoPhase === 1 && demoTimer > 12) buildDemo();
}

// --------------------------------------------------------------------------- game flow
function startGame() {
  audio.ac?.resume();
  show('main-menu', false);
  resetWorld();
  player.teleport(arena.spawn.pos, arena.spawn.yaw);
  if (player.flying) player.toggleFly();
  physicsState.targetTimeScale = 1;
  enterFullscreen();
  input.enabled = true;
  input.lock();
  mode = 'playing';
  showHud(true);
  hint('spawn', 'Press B to open the spawn menu');
  setTimeout(() => hint('keys', 'Keys 1-9 switch tools. 4 = Rocket Launcher, 3 = Grenade'), 9000);
  setTimeout(() => hint('fly', 'V toggles fly mode. Hold Space in the air for the jetpack'), 22000);
}

function enterFullscreen() {
  // Fullscreen + keyboard lock stops browser shortcuts like Ctrl+W (crouch + forward) from closing the tab.
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
    navigator.keyboard?.lock?.(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyT', 'KeyF', 'KeyN', 'Tab', 'Space', 'ControlLeft']).catch(() => {});
  }).catch(() => {});
}

function resume() {
  show('pause', false);
  input.enabled = true;
  input.lock();
  mode = 'playing';
}

function toMenu() {
  audio.stopAllRadios();
  show('pause', false);
  showHud(false);
  input.enabled = false;
  resetTools();
  buildDemo();
  show('main-menu', true);
  mode = 'menu';
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function onLockChange(locked) {
  if (locked) return;
  if (mode === 'playing') {
    mode = 'paused';
    show('pause', true);
  }
}

function openSpawn() {
  mode = 'spawn';
  openSpawnMenu();
  input.unlock();
}
function closeSpawn() {
  closeSpawnMenu();
  mode = 'playing';
  input.lock();
}

function hookGameEvents() {
  ctx.onSpawn = () => hint('undo', 'Z undoes your last spawn · G toggles grid snap');
  ctx.onExplosion = (pos, power, fuel) => { audio.explosion(pos, power, fuel); hint('slowmo', 'Press T for slow motion'); };
  ctx.onPlayerBlast = (d, radius) => { if (d < radius * 0.55) audio.earRinging(Math.min(1, 1.2 - d / (radius * 0.55))); };
  ctx.onImpact = (e, part, dv, point) => {
    // Only real hits make noise: resting/stacked objects produce small contact impulses every step,
    // which used to turn into nonstop rattling.
    const now = performance.now();
    if (dv < 2.2 || now - (e.lastSnd || 0) < 260) return;
    const p = e.position();
    const moved = p.distanceTo(e.prevPos) / (1 / 60);
    if (moved < 0.8 && dv < 6) return;
    e.lastSnd = now;
    audio.impact(part.mat, point || p, Math.min(1, (dv - 1.5) / 7));
  };
  ctx.onBreak = (mat, pos, size) => audio.breakSound(mat, pos, size);
  ctx.onLand = (impact) => { if (impact > 2.5) audio.play('land', { vol: Math.min(1, impact / 9) }); };
  ctx.onClick = () => audio.play('click', { vol: 0.5 });
  ctx.onRpgFire = () => audio.play('rpg', { vol: 1.3 });

}

// --------------------------------------------------------------------------- sound upkeep
let lastBob = 0;
const activeLoops = new Set();
function updateAudio(realDt) {
  if (!audio.ready) return;
  audio.updateRadios();
  const playing = mode === 'playing' || mode === 'spawn';
  // footsteps on each step of the head-bob cycle
  if (playing && player.grounded && !player.flying) {
    const stepIdx = Math.floor(player.bob / Math.PI);
    if (stepIdx !== lastBob && Math.hypot(player.vel.x, player.vel.z) > 0.6) {
      const f = player.feet;
      const hit = world.castRay(new R.Ray({ x: f.x, y: f.y + 0.1, z: f.z }, { x: 0, y: -1, z: 0 }), 0.5, true, undefined, groups(0xffff, G.STATIC | G.OBJECT), player.collider);
      let surf = 'stepConcrete';
      if (hit) {
        const e = entityFromCollider(hit.collider.handle);
        const m = e ? e.mainMat : hit.collider.friction() < 0.5 ? 'steel' : 'concrete';
        surf = m === 'steel' || m === 'aluminum' ? 'stepMetal' : m === 'wood' || m === 'plywood' ? 'stepWood' : 'stepConcrete';
      }
      const run = Math.hypot(player.vel.x, player.vel.z) / 6.6;
      audio.play(surf, { vol: player.crouching ? 0.12 : 0.22 + run * 0.25, rate: 0.9 + Math.random() * 0.2 });
    }
    lastBob = stepIdx;
  }
  audio.loop('jetpack', 'jet', playing && player.jetting ? 0.45 : 0, null, 1);
  // fuses hiss, C4 timers beep (faster near the end), venting propane screams
  const seen = new Set();
  for (const e of entities.values()) {
    const ex = e.explosive;
    if (!ex) continue;
    if (ex.fuseLit && ex.countdown != null) { audio.loop('fuse' + e.id, 'hiss', 0.35, e.root.position, 1.4); seen.add('fuse' + e.id); }
    if (ex.timer && ex.countdown != null) {
      e._beep = (e._beep ?? 0) - realDt;
      if (e._beep <= 0) { audio.play('beep', { pos: e.root.position.clone(), vol: 0.5, ref: 2 }); e._beep = ex.countdown > 3 ? 1 : ex.countdown > 1 ? 0.4 : 0.15; }
    }
    if (e.rocketing) { audio.loop('vent' + e.id, 'hiss', 1.0, e.root.position, 0.7); seen.add('vent' + e.id); }
  }
  for (const id of activeLoops) if (!seen.has(id)) audio.loop(id, 'hiss', 0);
  activeLoops.clear();
  for (const id of seen) activeLoops.add(id);
}

// --------------------------------------------------------------------------- loop
function loop(now) {
  requestAnimationFrame(loop);
  const realDt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (mode === 'playing') {
    player.look();
    if (input.hit('spawnMenu')) openSpawn();
    if (input.hit('slowmo')) { physicsState.targetTimeScale = physicsState.targetTimeScale < 1 ? 1 : 0.2; say(physicsState.targetTimeScale < 1 ? 'Slow motion' : 'Normal speed'); }
    if (input.hit('fly')) say(player.toggleFly() ? 'Fly mode ON (Space up, Ctrl down)' : 'Fly mode OFF');
    if (input.hit('crouchToggle')) player.crouchToggled = !player.crouchToggled;
    updateToolsFrame(realDt);
  } else if (mode === 'spawn') {
    if (input.hit('spawnMenu') || input.rawHit('Escape')) closeSpawn();
  }

  const running = mode !== 'paused';
  if (running) {
    stepPhysics(realDt, (dt) => {
      resetBreakBudget();
      recordPrev();
      if (mode === 'playing' || mode === 'spawn') { player.step(dt, realDt); updateToolsStep(dt); }
    }, (dt) => {
      processImpacts(dt);
      updateExplosives(dt);
      updateJoints();
    });
  }
  syncVisuals(running ? physicsState.alpha : 1);
  if (running) updateDebris(realDt);
  fx.update(running ? realDt * physicsState.timeScale : 0, realDt);

  if (mode === 'menu') {
    updateDemo(realDt);
    const t = now / 1000 * 0.06;
    camera.position.set(Math.cos(t) * 11, 3.2 + Math.sin(t * 0.7) * 0.8, Math.sin(t) * 11);
    // aim a bit left of the stack so it shows on the right, clear of the menu buttons
    const toC = new THREE.Vector3(0, 1.2, 0).sub(camera.position).normalize();
    const right = toC.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    camera.lookAt(new THREE.Vector3(0, 1.2, 0).addScaledVector(right, -4.5));
  } else if (mode !== 'loading') {
    player.updateCamera(realDt, physicsState.alpha);
  }
  env.follow(camera.position);
  audio.setListener(camera);
  updateAudio(realDt);
  if (mode === 'playing' || mode === 'spawn') updateHud(realDt, player);
  renderer.domElement.style.filter = fx.blur > 0.02 ? `blur(${(fx.blur * 3).toFixed(1)}px) saturate(${(1 - fx.blur * 0.6).toFixed(2)})` : '';
  renderer.render(scene, camera);
  input.endFrame();
}

boot().catch((err) => {
  console.error(err);
  $('loading-tip').textContent = 'Failed to start: ' + (err?.message || err);
});
