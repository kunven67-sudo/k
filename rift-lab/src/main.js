// Rift Lab: boot, menus, world loading, and the main loop.

import * as THREE from 'three';
import { settings, onSettingChange } from './core/settings.js';
import { input } from './core/input.js';
import { hashString } from './core/noise.js';
import { GameClock } from './core/time.js';
import { initPhysics, Physics } from './core/physics.js';
import { EmptyWorld } from './world/world.js';
import { Player } from './player/player.js';
import { audio } from './audio/audio.js';
import { UI, randomSeed } from './ui/ui.js';
import { saves } from './core/saves.js';

const canvas = document.getElementById('view');
const ui = new UI(document.getElementById('ui'), document.getElementById('fx'));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
} catch (e) {
  document.getElementById('ui').innerHTML = '<div class="center-screen"><div class="panel" style="padding:24px;max-width:460px">Rift Lab needs WebGL2. Try the latest Chrome, Edge or Firefox, and make sure hardware acceleration is on.</div></div>';
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.65;
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 14000);
scene.add(camera);
input.attach(canvas);

function resize() {
  const scale = settings.renderScale * Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(scale);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
onSettingChange((k) => {
  if (k === 'renderScale' || k === 'fov' || k === '*') resize();
  if (k === 'shadows' || k === '*') { renderer.shadowMap.enabled = settings.shadows; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  if ((k === 'grassDensity' || k === '*') && game.world) game.world.grass.applyDensity();
});

// ---------------- game state ----------------
const game = {
  state: 'boot', // boot | menu | loading | play | paused | dead
  world: null, physics: null, player: null, clock: null, info: null,
  menuSeed: null, autosaveT: 60, lastTime: performance.now(), menuT: 0,
};
window.__riftlab = game; // handy for testing in the browser console
game.input = input;
game.renderer = renderer;
game.scene = scene;

let RAPIER = null;

async function boot() {
  const bar = ui.loading('Starting up');
  RAPIER = await initPhysics();
  bar.set(0.1, 'Building the menu world');
  // The menu shows a real world live behind it, at your real time of day.
  const last = saves.list()[0];
  game.menuSeed = last ? last.seed : 'riftlab';
  await loadWorld({ seed: game.menuSeed, dayLength: 'real', startMs: Date.now() }, { menu: true, bar });
  showMainMenu();
}

async function loadWorld(info, { menu = false, bar = null, saveData = null } = {}) {
  disposeWorld();
  const b = bar || ui.loading('Generating your world');
  game.state = 'loading';
  game.info = info;
  game.clock = new GameClock({ startMs: saveData?.clockMs ?? info.startMs ?? Date.now(), dayLength: info.dayLength || 'real' });
  game.physics = menu ? null : new Physics(RAPIER);
  game.world = await EmptyWorld.create({
    seed: hashString(String(info.seed)), renderer, scene, physics: game.physics, clock: game.clock,
    onProgress: (p, t) => b.set(menu ? 0.1 + p * 0.9 : p, t),
  });
  // compile shaders now so the first frames don't stutter
  camera.position.set(game.world.gen.spawn.x, game.world.height(game.world.gen.spawn.x, game.world.gen.spawn.z) + 2, game.world.gen.spawn.z);
  renderer.compile(scene, camera);
  if (!menu) {
    game.player = new Player({ physics: game.physics, camera, world: game.world, audio, godMode: !!info.godMode });
    if (saveData?.player) {
      const p = saveData.player;
      game.player.body.setTranslation({ x: p.x, y: p.y + 0.9, z: p.z }, true);
      game.player.pos.set(p.x, p.y, p.z);
      game.player.prevPos.copy(game.player.pos);
      game.player.yaw = p.yaw; game.player.pitch = p.pitch;
      Object.assign(game.player, { health: p.health ?? 100, stamina: p.stamina ?? 100, limp: p.limp ?? 0, brokenLeg: p.brokenLeg ?? 0 });
    }
  }
}

function disposeWorld() {
  if (game.player) { game.player.dispose(); game.player = null; }
  if (game.world) { game.world.dispose(); game.world = null; }
  if (game.physics) { game.physics.free(); game.physics = null; }
}

// ---------------- menus ----------------
function showMainMenu() {
  input.unlock();
  game.state = 'menu';
  const last = saves.list()[0];
  const el = ui.mainMenu({
    hasSave: !!last,
    saveName: last ? `${last.name} · ${last.mapName}` : '',
    onContinue: () => { audio.start(); audio.ui(); continueWorld(last.id); },
    onNew: () => { audio.start(); audio.ui(); openSheet(() => ui.newWorldSheet({ defaultSeed: game.menuSeed === 'riftlab' ? randomSeed() : randomSeed(), onBack: closeSheet, onCreate: createWorld })); },
    onLoad: () => { audio.start(); audio.ui(); openSheet(() => ui.loadSheet({ saves: () => saves.list(), onLoad: (id) => continueWorld(id), onDelete: (id) => saves.remove(id), onBack: closeSheet })); },
    onSettings: () => { audio.start(); audio.ui(); openSheet(() => { const s = ui.settingsSheet({ onBack: closeSheet }); el.append(s); return s; }); },
    status: `${game.clock.formatTime()} · ${game.clock.formatDate()}`,
  });
  let sheet = null;
  function openSheet(make) { closeSheet(); sheet = make(); }
  function closeSheet() { audio.ui(); sheet?.remove(); sheet = null; }
}

async function createWorld(opts) {
  const startMs = opts.start === 'pick' && opts.startAt ? new Date(opts.startAt).getTime() : Date.now();
  const info = {
    id: `w${Date.now().toString(36)}`, name: opts.name.trim() || 'My World', seed: String(opts.seed || randomSeed()).trim(),
    map: 'empty', mapName: 'Empty World · Meadow + forest', dayLength: opts.dayLength, startMs,
    spawnMode: opts.spawnMode, arrival: opts.arrival, kit: opts.kit, godMode: opts.godMode,
    deathMode: opts.deathMode, gore: opts.gore, disasters: opts.disasters, battery: opts.battery,
  };
  await loadWorld(info);
  saveGame(true);
  startPlay(true);
}

async function continueWorld(id) {
  const data = saves.load(id);
  if (!data) { ui.toast('That save could not be read.'); return; }
  await loadWorld(data.info, { saveData: data });
  startPlay(false);
}

function startPlay(fresh) {
  game.state = 'play';
  ui.playOverlay();
  ui.clickToPlay(true);
  ui.fx.fade.style.opacity = '1';
  requestAnimationFrame(() => { ui.fx.fade.style.opacity = '0'; });
  if (fresh) {
    ui.tip('move', 'Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, look with the mouse. Sprint with <kbd>Shift</kbd>, but you get tired.', 8);
    ui.tip('watch', 'Hold <kbd>T</kbd> to look at your watch: real time, date and moon phase.', 7);
    ui.tip('nohud', 'No HUD: you <b>feel</b> it. Heavy breathing = tired, red edges = hurt. (HUD is in Settings.)', 8);
    ui.tip('crouch', '<kbd>Ctrl</kbd> crouch · <kbd>Q</kbd>/<kbd>E</kbd> lean · <kbd>Caps</kbd> jog · <kbd>F</kbd> fast-forward time', 8);
  }
}

function pause() {
  if (game.state !== 'play') return;
  game.state = 'paused';
  saveGame();
  ui.clickToPlay(false);
  ui.watch(false);
  const el = ui.pauseMenu({
    worldName: `${game.info.name} · ${game.clock.formatTime()}`,
    onResume: () => { audio.ui(); resume(); },
    onSave: () => { audio.ui(); saveGame(); ui.toast('Saved.'); },
    onSettings: () => { audio.ui(); const s = ui.settingsSheet({ onBack: () => { audio.ui(); s.remove(); } }); el.append(s); },
    onQuit: async () => { audio.ui(); saveGame(); await loadWorld({ seed: game.info.seed, dayLength: 'real', startMs: Date.now() }, { menu: true }); game.menuSeed = game.info?.seed; showMainMenu(); },
  });
}

function resume() {
  game.state = 'play';
  ui.playOverlay();
  input.lock();
}

function saveGame(silent) {
  if (!game.player || !game.info) return;
  const p = game.player;
  saves.save(game.info, {
    info: game.info,
    clockMs: game.clock.ms,
    player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch, health: p.health, stamina: p.stamina, limp: p.limp, brokenLeg: p.brokenLeg },
  });
  if (!silent) game.autosaveT = 60;
}

canvas.addEventListener('click', () => {
  if (game.state === 'play' && !input.locked) { audio.start(); input.lock(); }
});
document.addEventListener('pointerlockchange', () => {
  if (game.state === 'play') {
    if (input.locked) ui.clickToPlay(false);
    else pause();
  }
});

// ---------------- the loop ----------------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - game.lastTime) / 1000, 0.1);
  game.lastTime = now;
  const w = game.world;
  if (!w) { input.endFrame(); return; }

  if (game.state === 'play' || game.state === 'paused' || game.state === 'dead') {
    const p = game.player;
    if (game.state === 'play') {
      if (input.locked) p.handleLook();
      p.pollInput();
      if (input.actionPressed('fastForward')) {
        const steps = [1, 10, 100, 1000];
        game.clock.fastForward = steps[(steps.indexOf(game.clock.fastForward) + 1) % steps.length];
        ui.speed(game.clock.fastForward);
      }
      game.clock.advance(dt);
      const alpha = game.physics.update(dt);
      p.updateCamera(dt, alpha);
      handlePlayerEvents(p);
      ui.watch(input.action('watch'), game.clock, w.sky);
      ui.hud(settings.hud, p);
      ui.feel(p, dt);
      game.autosaveT -= dt;
      if (game.autosaveT <= 0) { game.autosaveT = 60; saveGame(true); }
    }
  } else if (game.state === 'menu') {
    game.clock.advance(dt);
    menuCamera(dt);
  }

  w.update(dt, camera, renderer, game.player?.pos);
  if (game.state === 'menu' || game.state === 'play') updateAudio(dt);
  renderer.render(scene, camera);
  input.endFrame();
}

function handlePlayerEvents(p) {
  for (const e of p.events) {
    if (e.type === 'step') audio.footstep(e.surface, e.mode, e.wading);
    else if (e.type === 'climb') { audio.land(2 + e.rise * 2); ui.tip('climb', 'You can climb over logs, rocks and fences: walk up to them and press <kbd>Space</kbd>.', 6); }
    else if (e.type === 'land') audio.land(e.speed);
    else if (e.type === 'splash') audio.splash(e.speed);
    else if (e.type === 'hurt') { audio.hurt(); ui.hurtFlash = Math.min(1, (ui.hurtFlash || 0) + e.amount / 30); }
    else if (e.type === 'injury') ui.toast(`Ouch. That's a ${e.what}. It will take weeks to heal.`, 5);
    else if (e.type === 'death') onDeath(e.cause);
  }
  p.events.length = 0;
  if (p.stamina < 30) ui.tip('tired', 'You are out of breath. Walk for a bit and your stamina comes back.', 6);
  if (p.swimming) ui.tip('swim', 'Swimming: <kbd>Space</kbd> up, <kbd>Ctrl</kbd> dive. Hold your breath too long and you drown.', 7);
}

function onDeath(cause) {
  game.state = 'dead';
  input.unlock();
  ui.deathScreen({
    cause, deathMode: game.info.deathMode,
    onRespawn: () => {
      const p = game.player, sp = game.world.gen.spawn;
      const y = game.world.height(sp.x, sp.z);
      p.body.setTranslation({ x: sp.x, y: y + 1, z: sp.z }, true);
      p.pos.set(sp.x, y + 0.1, sp.z); p.prevPos.copy(p.pos);
      Object.assign(p, { dead: false, health: 60, stamina: 50, breath: 45 });
      p.vel.set(0, 0, 0);
      saveGame();
      startPlay(false);
    },
    onQuit: async () => {
      if (game.info.deathMode === 'perma') saves.remove(game.info.id);
      else saveGame();
      await loadWorld({ seed: game.info.seed, dayLength: 'real', startMs: Date.now() }, { menu: true });
      showMainMenu();
    },
  });
}

function menuCamera(dt) {
  game.menuT += dt;
  const { lake } = game.world.gen;
  const a = game.menuT * 0.02 + 0.6;
  const r = lake.radius * 2.4;
  const x = lake.x + Math.cos(a) * r, z = lake.z + Math.sin(a) * r;
  const ground = Math.max(game.world.height(x, z), lake.level);
  camera.position.set(x, ground + 28 + Math.sin(game.menuT * 0.05) * 6, z);
  camera.lookAt(lake.x - Math.cos(a) * lake.radius * 0.6, lake.level + 6, lake.z - Math.sin(a) * lake.radius * 0.6);
}

function updateAudio(dt) {
  const w = game.world, p = game.player;
  const pos = p ? p.pos : camera.position;
  const river = w.gen.river.grid.nearest(pos.x, pos.z, 80);
  audio.update(dt, {
    wind: w.wind,
    treeDensity: Math.min(1, w.trees.countNear(pos.x, pos.z, 25) / 14),
    altitude: Math.max(0, pos.y - w.gen.lake.level),
    riverDist: river ? river.dist : 999,
    lakeDist: Math.max(0, Math.hypot(pos.x - w.gen.lake.x, pos.z - w.gen.lake.z) - w.gen.lake.radius),
    underwater: p?.underwater || false,
    night: w.sky.state.night,
    hours: game.clock.local().hours,
    season: w.seasonValue(),
    stamina: p ? p.stamina : 100,
  });
}

requestAnimationFrame(frame);
boot().catch((e) => {
  console.error(e);
  ui.show(Object.assign(document.createElement('div'), { className: 'center-screen', innerHTML: `<div class="panel" style="padding:24px;max-width:520px">Something broke while starting: <br><code>${String(e.message || e)}</code></div>` }));
});
