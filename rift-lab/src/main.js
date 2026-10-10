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
import { ItemManager } from './items/manager.js';
import { getItem } from './items/catalog.js';
import { Hands } from './player/hands.js';
import { BuildTools } from './player/build.js';
import { Phone3D } from './player/phone3d.js';
import { PhoneUI } from './ui/phone.js';
import { PowerGrid } from './items/power.js';
import { FlatPack } from './items/flatpack.js';
import { Breaking } from './items/breaking.js';
import { astronomy } from './core/time.js';

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

// Phone flashlight: a real LED, about 120 candela, lights ~10 m ahead and casts shadows.
const flashlight = new THREE.SpotLight(0xfff2dc, 0, 30, 0.6, 0.6, 2);
flashlight.position.set(0.1, -0.1, 0);
flashlight.target.position.set(0.03, -0.06, -6);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(1024, 1024);
flashlight.shadow.camera.near = 0.1;
flashlight.shadow.bias = -0.0005;
camera.add(flashlight, flashlight.target);

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

const START_MONEY = { 0: 0, 1000: 1000, 10000: 10000, 100000: 100000, rich: 12000000 };

const phoneUI = new PhoneUI(document.getElementById('ui'), {
  renderer,
  clock: () => game.clock,
  sky: () => game.world.sky,
  weather: () => weatherNow(),
  payMode: () => game.info?.spawnMode === 'pay',
  money: () => game.money,
  transactions: () => game.transactions,
  spawn: (id, chosen, price) => beginSpawn(id, chosen, price),
  buildActive: () => !!game.build?.active,
  setBuild: (on) => setBuild(on),
  flashlight: () => !!game.flashOn,
  setFlashlight: (on) => setFlashlight(on),
  setFastForward: (m) => { game.clock.fastForward = m; ui.speed(m); },
  openSettings: () => { closePhone(false); pause(true); },
  sound: () => audio.ui('click'),
  toast: (t) => ui.toast(t),
});
game.phoneUI = phoneUI;

function openPhone() {
  if (game.phoneOpen || game.state !== 'play' || !game.phone) return;
  game.phoneOpen = true;
  game.build.cancelPlacing();
  game.phone.setUp(true);
  phoneUI.show(true);
  input.unlock();
  ui.clickToPlay(false);
  audio.ui('open');
  ui.tip('phone', 'Tap the screen with your mouse. <kbd>Tab</kbd> or <kbd>Esc</kbd> puts the phone away. You can still walk while you look at it.', 7);
}

function closePhone(relock = true) {
  if (!game.phoneOpen) return;
  game.phoneOpen = false;
  game.phone.setUp(false);
  phoneUI.show(false);
  if (relock && game.state === 'play') { input.lock(); setTimeout(() => { if (!input.locked && game.state === 'play' && !game.phoneOpen) ui.clickToPlay(true); }, 300); }
}

function setFlashlight(on) {
  game.flashOn = on;
  flashlight.intensity = on ? 120 : 0;
  game.phone?.setFlash(on);
  audio.ui('click');
}

function setBuild(on) {
  game.build.setActive(on);
  ui.buildBanner(on);
  if (on) ui.tip('build', 'Build mode: aim at something you spawned. <b>Click</b> to pick it up, <b>scroll</b> to turn it, <b>click</b> to set it down. <kbd>R</kbd> freeze · <kbd>X</kbd> delete · <kbd>Z</kbd> undo · <kbd>B</kbd> exit.', 9);
}

function beginSpawn(id, chosen, price) {
  closePhone(true);
  setBuild(false);
  const item = getItem(id);
  game.build.startPlacing(id, chosen, (pose) => {
    if (game.info.spawnMode === 'pay') {
      if (game.money < price) { ui.toast(`Not enough money (${'$' + Math.round(game.money).toLocaleString()}).`); return null; }
      game.money -= price;
      game.transactions.push({ what: item.name, amount: price, at: game.clock.ms });
    }
    // flat-pack furniture arrives in its box; everything else comes built
    const it = item.flatpack ? game.flat.spawnBox(id, chosen, pose) : game.items.spawn(id, chosen, pose);
    audio.land(3);
    if (item.flatpack) ui.tip('flatpack', 'Flat-pack: it came in a box. <b>Click the tape</b> to cut it, <b>drag the flaps</b> open, then <b>hold left-click</b> on the parts to build it (time speeds up while you work).', 10);
    if (item.power) ui.tip('power', 'This needs electricity: spawn a generator (Power tab) or a SunStack + solar panel within its cord length (~1.8 m). Click it to switch on.', 9);
    if (id === 'generator-torque') ui.tip('generator', 'Generators ship empty. Grab a gas can and hold it by the fuel cap to pour, then <b>click the pull-cord</b> to start it.', 9);
    ui.tip('grab', 'Hold <b>left-click</b> to grab things. Heavy stuff only drags (real strength). Swing + let go to toss, hold <b>right-click</b> to wind up a throw.', 9);
    return it;
  });
  ui.tip('place', 'Point where it should go. <b>Scroll</b> turns it, <b>click</b> places it, <b>right-click</b> cancels.', 7);
}

// Simple real-world weather for the Empty World (37.6° N): seasonal + daily temperature curve.
let sunCache = { day: -1 };
function weatherNow() {
  const c = game.clock, w = game.world;
  const l = c.local();
  const doy = c.dayOfYear();
  const mean = 14.5 - 7.5 * Math.cos(2 * Math.PI * (doy - 15) / 365);
  const cloud = w.sky.cloudCover;
  const amp = 7 * (1 - cloud * 0.6);
  const tempC = mean + amp * Math.cos(2 * Math.PI * (l.hours - 15) / 24);
  if (sunCache.day !== doy) {
    const midnight = c.ms - l.hours * 3600000;
    let rise = null, set = null, prev = null;
    for (let m = 0; m <= 24 * 60; m += 4) {
      const t = midnight + m * 60000;
      const alt = Math.asin(astronomy(t, c.latitude, c.longitude).sun.y) * 180 / Math.PI + 0.833;
      if (prev !== null) { if (prev < 0 && alt >= 0) rise = t; if (prev >= 0 && alt < 0) set = t; }
      prev = alt;
    }
    const fmt = (t) => { if (!t) return '—'; const d = new Date(t - c.tzOffsetMin * 60000); const hh = d.getUTCHours(), mm = String(d.getUTCMinutes()).padStart(2, '0'); return `${hh % 12 || 12}:${mm} ${hh < 12 ? 'AM' : 'PM'}`; };
    sunCache = { day: doy, sunrise: fmt(rise), sunset: fmt(set) };
  }
  const night = w.sky.state.night > 0.5;
  const desc = cloud > 0.75 ? 'Cloudy' : cloud > 0.4 ? (night ? 'Partly cloudy night' : 'Partly cloudy') : (night ? 'Clear night' : 'Sunny');
  return { tempC, clouds: cloud, windMs: w.wind * 7, desc, sunrise: sunCache.sunrise, sunset: sunCache.sunset };
}

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
    game.items = new ItemManager({ physics: game.physics, scene });
    const say = (t) => ui.toast(t, 4);
    game.breaking = new Breaking({ physics: game.physics, items: game.items, scene, world: game.world, audio, onMessage: say });
    game.power = new PowerGrid({ items: game.items, scene, clock: game.clock, sky: game.world.sky, world: game.world, audio, camera, onMessage: say });
    game.flat = new FlatPack({ items: game.items, clock: game.clock, audio, onMessage: say });
    game.hands = new Hands({ physics: game.physics, camera, items: game.items, player: game.player });
    game.player.carry = () => game.hands.carryMass;
    game.build = new BuildTools({ physics: game.physics, camera, items: game.items, player: game.player, hands: game.hands, onMessage: (t) => ui.toast(t, 2) });
    game.phone = new Phone3D(camera);
    game.money = saveData?.money ?? START_MONEY[info.startMoney ?? 10000] ?? 10000;
    game.transactions = saveData?.transactions ?? [];
    if (saveData?.items) game.items.restoreAll(saveData.items);
    if (saveData?.debris) game.breaking.restore(saveData.debris);
    if (saveData?.flashOn) setFlashlight(true);
  }
}

function disposeWorld() {
  if (game.phoneOpen) closePhone(false);
  phoneUI.show(false);
  phoneUI.stack = [];
  if (game.phone) { camera.remove(game.phone.root); game.phone = null; }
  if (game.build) { game.build.cancelPlacing(); game.build.setActive(false); ui.buildBanner(false); game.build = null; }
  if (game.hands) { game.hands.dispose(); game.hands = null; }
  if (game.flat) { game.flat.stop(); game.flat = null; }
  if (game.power) { game.power.dispose(); game.power = null; }
  if (game.breaking) { game.breaking.dispose(); game.breaking = null; }
  if (game.items) { game.items.clear(); game.items = null; }
  setFlashlight(false);
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
    deathMode: opts.deathMode, gore: opts.gore, disasters: opts.disasters, battery: opts.battery, startMoney: opts.startMoney,
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
    ui.tip('phonekey', 'Press <kbd>Tab</kbd> to take out your phone: spawn furniture, build mode, flashlight, weather. <kbd>L</kbd> = flashlight.', 9);
  }
}

function pause(openSettings = false) {
  if (game.state !== 'play') return;
  if (game.phoneOpen) closePhone(false);
  game.build?.cancelPlacing();
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
  if (openSettings) { const st = ui.settingsSheet({ onBack: () => { audio.ui(); st.remove(); } }); el.append(st); }
}

function resume() {
  game.state = 'play';
  ui.playOverlay();
  ui.buildBanner(!!game.build?.active);
  input.lock();
}

function saveGame(silent) {
  if (!game.player || !game.info) return;
  const p = game.player;
  saves.save(game.info, {
    info: game.info,
    clockMs: game.clock.ms,
    player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch, health: p.health, stamina: p.stamina, limp: p.limp, brokenLeg: p.brokenLeg },
    items: game.items ? game.items.serialize() : [],
    debris: game.breaking ? game.breaking.serialize() : [],
    money: game.money, transactions: game.transactions, flashOn: !!game.flashOn,
  });
  if (!silent) game.autosaveT = 60;
}

canvas.addEventListener('click', () => {
  if (game.state !== 'play') return;
  if (game.phoneOpen) { closePhone(true); return; } // clicking the world puts the phone away
  if (!input.locked) { audio.start(); input.lock(); }
});
document.addEventListener('pointerlockchange', () => {
  if (game.state === 'play') {
    if (input.locked) ui.clickToPlay(false);
    else if (!game.phoneOpen) pause();
  }
});
window.addEventListener('keydown', (e) => {
  if (game.state !== 'play') return;
  if (e.code === 'Tab') { e.preventDefault(); if (game.phoneOpen) closePhone(true); else openPhone(); }
  else if (e.code === 'Escape' && game.phoneOpen) closePhone(true);
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
      if (!game.phoneOpen && input.locked) {
        if (input.actionPressed('build')) setBuild(!game.build.active);
        if (input.actionPressed('undo') && game.build.active) game.build.undoLast();
        if (input.actionPressed('flashlight')) setFlashlight(!game.flashOn);
      }
      game.hands.update(dt);
      game.build.update(dt);
      game.clock.advance(dt);
      const alpha = game.physics.update(dt);
      p.updateCamera(dt, alpha);
      game.items.update();
      game.breaking.update(dt);
      game.breaking.sync();
      game.power.update(dt, game.hands);
      if (game.flat.working && !input.mouse(0)) { game.flat.stop(); ui.progress(null); }
      game.phone.update(dt, p.moveMode && p.moveMode !== 'idle');
      if (game.phone.root.visible && game.phoneOpen) {
        phoneUI.setTransform(game.phone.screenTransform(innerWidth, innerHeight));
        game.phoneTick = (game.phoneTick || 0) + dt;
        if (game.phoneTick > 1) { game.phoneTick = 0; phoneUI.refreshTop(); }
      }
      handleHandEvents();
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

function handleHandEvents() {
  const hd = game.hands;
  if (ui.dot) ui.dot.className = 'dot' + (hd.held ? ' holding' : hd.aim?.movable && !game.build.active ? ' grab' : '') + (hd.charge > 0 ? ' charge' : '');
  for (const e of hd.events) {
    if (e.type === 'grab') {
      if (audio.started) audio.burst({ dur: 0.06, freq: 900, q: 1, gain: 0.08 });
      if (e.mass * 9.81 > 430) ui.tip('heavy', `That's about ${Math.round(e.mass)} kg: too heavy to lift alone. You can drag it, or use build mode.`, 6);
    } else if (e.type === 'throw' && audio.started) audio.burst({ dur: 0.18, freq: 500, q: 0.6, gain: 0.08, attack: 0.05 });
    else if (e.type === 'use') {
      // mouse only: clicking a switch, a pull-cord, a breaker, tape on a box...
      if (!game.flat.use(e.item, e.part)) game.power.use(e.item, e.part);
    } else if (e.type === 'assembleHold') {
      const prog = game.flat.hold(e.item, e.dt);
      ui.progress(prog == null ? null : prog);
    } else if (e.type === 'assembleStop') { game.flat.stop(); ui.progress(null); }
  }
  hd.events.length = 0;
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
