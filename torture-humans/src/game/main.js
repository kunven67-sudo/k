// Game entry: boots the engine and runs the main loop.
import * as THREE from 'three';
import { Settings } from './engine/settings.js';
import { Input } from './engine/input.js';
import { initPhysics, Physics } from './engine/physics.js';
import { Renderer } from './engine/renderer.js';
import { AnimLibrary, Character, loadAvatar, baseClips } from './engine/anim.js';
import { Player } from './player.js';
import { initNavigation, Navigation } from './engine/navigation.js';
import { Human } from './humans/human.js';
import { TOWN_LOOKS, isFemale } from './humans/looks.js';
import { Hands } from './gadgets/hands.js';
import { Cage } from './cage.js';
import { Colony } from './colony/colony.js';
import { Squisher } from './squish.js';
import { bakeEnvironment } from './engine/probe.js';
import { hdri } from './engine/assets.js';
import { Environment } from './world/environment.js';
import { addTinyDetails } from './cageworld-details.js';
import { Bugs } from './bugs.js';
import { BASE_H, fmtLen, sizeName, comparison } from './size.js';
import { Vitals } from './vitals.js';
import { Hazards } from './hazards.js';
import { buildTestLevel } from './levels/test-level.js';
import { buildLab } from './levels/lab.js';

const params = new URLSearchParams(location.search);
let game_applyZone = null;

// Desktop build: the game files come as a separate pack, downloaded once.
async function ensureAssets() {
  const th = window.th;
  if (!th?.assets) return;
  const box = document.getElementById('loading');
  const bar = box?.querySelector('.bar > div');
  const label = box?.querySelector('.label');
  const off = th.assets.onProgress((p) => {
    if (!box) return;
    box.hidden = false;
    const pct = Math.round(p.progress * 100);
    label.textContent = p.stage === 'download' ? `Downloading game files… ${pct}%` : `Unpacking… ${pct}%`;
    bar.style.width = `${pct}%`;
  });
  for (;;) {
    const r = await th.assets.ensure();
    if (r.ok) break;
    if (box) {
      box.hidden = false;
      label.textContent = `Couldn't download the game files (${r.error}). Retrying in 10 seconds…`;
    }
    await new Promise((res) => setTimeout(res, 10000));
  }
  off();
  if (box) box.hidden = true;
}

export async function boot() {
  await ensureAssets();
  const canvas = document.getElementById('game');
  const settings = new Settings();
  await initPhysics();
  const physics = new Physics();
  const input = new Input(canvas, settings);
  const renderer = new Renderer(canvas, settings);
  renderer.autoTune();
  // test hook: ?gfx={"bloom":false} overrides graphics settings
  if (params.get('gfx')) settings.set({ graphics: JSON.parse(params.get('gfx')) });
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.02, 700);
  const scene = new THREE.Scene();

  const levels = { lab: buildLab, test: buildTestLevel };
  const level = await (levels[params.get('level')] || buildLab)({ scene, physics, renderer: renderer.renderer, settings });

  const lib = new AnimLibrary('assets/anims/');
  await lib.require(baseClips('m'));
  const avatar = await loadAvatar('assets/avatars/Male_Adult_01.glb');
  const character = new Character(avatar, lib, { gender: 'm' });
  const player = new Player({ physics, input, settings, camera, character, scene, position: level.spawn });
  if (params.get('cam')) player.mode = params.get('cam');
  if (level.ladder) player.setLadder(level.ladder, level.ladderTopFloorY);

  // walkable map + people
  await initNavigation();
  const nav = new Navigation();
  const humans = [];
  if (level.navRoots) {
    try {
      nav.build(level.navRoots);
      const count = Number(params.get('humans') ?? level.defaultVisitors ?? 0);
      const looks = ['Business_Female_01', 'Police_Male_01', 'Chef_Female_01', 'Male_Adult_04'];
      for (let i = 0; i < count; i++) {
        const look = looks[i % looks.length];
        const gender = /Female/.test(look) ? 'f' : 'm';
        await lib.require(baseClips(gender));
        const tpl = await loadAvatar(`assets/avatars/${look}.glb`).catch(() => avatar);
        const start = nav.randomPoint(level.wanderArea) || level.spawn;
        humans.push(new Human({ template: tpl, lib, nav, physics, scene, gender, position: start, area: level.wanderArea, profile: { name: look }, settings }));
      }
      // townspeople: different looks, each starts somewhere on the street
      const townCount = Number(params.get('townPeople') ?? level.town?.people ?? 0);
      const order = [...TOWN_LOOKS].sort(() => Math.random() - 0.5);
      for (let i = 0; i < townCount; i++) {
        const look = order[i % order.length];
        const gender = isFemale(look) ? 'f' : 'm';
        await lib.require(baseClips(gender));
        const tpl = await loadAvatar(`assets/avatars/${look}.glb`).catch(() => null);
        if (!tpl) continue; // that look isn't in this build
        const start = nav.randomPoint(level.town.area) || null;
        if (!start) break;
        const h = new Human({ template: tpl, lib, nav, physics, scene, gender, position: start, area: level.town.area, settings, profile: { look, name: look.replace(/_0?(\d+)$/, ' $1').replace(/_/g, ' ') } });
        h.spots = level.town.spots;
        h.townie = true;
        humans.push(h);
      }
    } catch (err) {
      console.warn('[nav]', err.message);
    }
  }

  const cage = level.terrarium ? new Cage(level.terrarium, new THREE.Box3(new THREE.Vector3(-1.45, 0.13, -0.9), new THREE.Vector3(1.45, 0.13, 0.9)), level.tiny) : null;
  // the tiny people's life in the terrarium (their own navmesh, needs, building)
  let colony = null;
  if (cage?.tiny) {
    colony = new Colony({ cage, physics, settings });
    try {
      await colony.init();
      cage.colony = colony;
    } catch (err) {
      console.warn('[colony]', err.message);
      colony = null;
    }
  }
  const hands = new Hands({ scene, camera, physics, player, input, humans, cage, colony });
  player.cage = cage;
  const squisher = new Squisher({ scene, player, humans, settings });
  const vitals = new Vitals(settings);
  const hazards = new Hazards({ player, cage, vitals, input, respawn: level.respawn || level.spawn });
  if (colony) { colony.player = player; colony.vitals = vitals; }
  player.vitals = vitals;
  if (params.get('item') === 'jar') hands.select(1);
  if (params.get('item') === 'supplies') hands.select(2);

  renderer.sunIntensity = level.sunIntensity;
  renderer.setScene(scene, camera, { sunDirection: level.sunDirection });
  // Inside vs outside: the basement has no sky or sun (only its own lamps and a
  // reflection snapshot of the room); outside you get the sky, the sun and haze.
  let labEnv = null;
  let sky = null;
  let zone = null;
  const sunLights = () => renderer.csm?.lights || [];
  const fog = level.fog ? new THREE.Fog(level.fog.color, level.fog.near, level.fog.far) : null;
  if (fog) scene.fog = fog;
  const applyZone = (force = false) => {
    const z = level.inLab?.(camera.position) ? 'lab' : level.zones?.inHouse(camera.position) ? 'house' : 'outside';
    if (z === zone && !force) return;
    zone = z;
    const lab = z === 'lab' || !level.sunDirection;
    // hide what you can't see from here: the town from the basement, the basement from outside
    if (level.zones) {
      for (const o of level.zones.town) o.visible = z !== 'lab';
      for (const h of humans) if (h.townie && !h.tiny) h.character.root.visible = z !== 'lab';
      for (const o of level.zones.lab) o.visible = z !== 'outside';
    }
    for (const l of sunLights()) {
      l.intensity = lab ? 0 : renderer.sunIntensity ?? 3;
      l.shadow.autoUpdate = !lab; // no sun shadows to draw underground
      l.shadow.needsUpdate = true;
    }
    scene.background = lab ? null : sky?.background ?? new THREE.Color(0x9fb6cc);
    scene.environment = lab ? labEnv : sky?.environment ?? labEnv;
    scene.environmentIntensity = lab ? level.probeIntensity ?? 0.7 : 0.9;
    if (fog) { fog.near = lab ? 1e4 : level.fog.near; fog.far = lab ? 2e4 : level.fog.far; }
  };
  game_applyZone = applyZone;
  // time of day, weather, lamps at night, rain, breath in the cold, basement dust
  const env = level.sunDirection ? new Environment({ scene, renderer, settings, camera, level, humans, zone: () => zone || 'lab' }) : null;
  // the little things in the terrarium: dew, mushrooms, moss, leaves, fogged glass, embers, footprints...
  const tinyDetails = cage?.tiny ? addTinyDetails({ tiny: cage.tiny, cage, settings, glass: { w: 3.0, h: 1.2, d: 1.9 }, getHour: () => env?.hour ?? 9, player, camera }) : null;
  if (colony) colony.details = tinyDetails;
  // bugs in the terrarium: ants, beetles, a spider
  const bugs = cage?.tiny ? new Bugs({ cage, settings }) : null;
  if (level.sky) hdri(renderer.renderer, level.sky).then((s) => { sky = s; applyZone(true); }).catch(() => {});
  settings.onChange((d, patch) => { if (patch.graphics) applyZone(true); });
  // indoor reflections: snapshot the room once textures have streamed in, and again a bit later
  if (level.probe) {
    const bake = () => {
      for (const l of sunLights()) l.intensity = 0; // the snapshot is of the basement: no sun
      labEnv = bakeEnvironment(renderer.renderer, scene, level.probe, { intensity: level.probeIntensity ?? 0.7, assign: false, previous: labEnv });
      applyZone(true);
    };
    bake();
    setTimeout(bake, 2500);
    setTimeout(bake, 8000);
  }
  addEventListener('resize', () => renderer.resize());
  canvas.addEventListener('click', () => input.lockPointer());

  const fpsEl = document.getElementById('fps');
  // the size watch readout: how tall you are, what you're about the size of, how things look to you
  const sizeEl = document.getElementById('size');
  let sizeTip = '', sizeTipT = 0, lastScale = 1;
  const updateSizeHud = (dt) => {
    if (!sizeEl) return;
    const s = player.scale;
    const show = Math.abs(Math.log(s)) > 0.02 || player.sizeChanging;
    sizeEl.hidden = !show;
    if (!show) return;
    sizeTipT -= dt;
    if (sizeTipT <= 0 || Math.abs(Math.log(s / lastScale)) > 0.7) { sizeTip = comparison(s); sizeTipT = 7; lastScale = s; }
    const H = BASE_H * s;
    const html = `<b>${fmtLen(H)}</b> · about the size of ${sizeName(H)}<small>${sizeTip}</small>`;
    if (sizeEl.innerHTML !== html) sizeEl.innerHTML = html;
  };
  const toastEl = document.getElementById('toast');
  let toastTimer = 0;
  const toast = (text) => {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2500);
  };
  const hintEl = document.getElementById('hint');
  // controls help: shown when you start (not in tests), H toggles it
  const controlsEl = document.getElementById('controls');
  if (controlsEl && !params.has('paused')) controlsEl.hidden = false;
  addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA/.test(e.target?.tagName || '');
    if (e.code === 'KeyH' && controlsEl && !typing) controlsEl.hidden = !controlsEl.hidden;
    // F2: graphics preset, F3: FPS counter
    if (e.code === 'F2' && !typing) {
      e.preventDefault();
      const order = ['low', 'medium', 'high', 'ultra'];
      const next = order[(order.indexOf(settings.get('graphics.preset')) + 1) % order.length];
      settings.set({ graphics: { preset: next } });
      toast(`Graphics: ${next[0].toUpperCase()}${next.slice(1)} (F2 to change)`);
    }
    if (e.code === 'F3' && !typing) {
      e.preventDefault();
      settings.set('graphics.showFps', !settings.get('graphics.showFps'));
    }
  });
  let last = performance.now();
  const game = { scene, camera, physics, input, renderer, player, settings, character, level, nav, humans, hands, cage, colony, vitals, hazards, env, bugs, frame: 0 };
  window.game = game; // for tests and debugging

  // test hook: drive the player without a real keyboard
  game.simulate = (seconds, { keys = [], look = [0, 0] } = {}) => {
    for (const k of keys) { input.down.add(k); input.pressedCodes.add(k); }
    const n = Math.max(1, Math.round(seconds * 60));
    for (let i = 0; i < n; i++) step(1 / 60, look.map((v) => v / n));
    for (const k of keys) input.down.delete(k);
  };

  function step(dt, look) {
    input.beginFrame();
    if (look) { input.mouseDX += look[0] / 0.0022; input.mouseDY += look[1] / 0.0022; }
    physics.update(dt, (fixed) => player.fixedUpdate(fixed));
    player.update(dt, physics.alpha);
    hands.update(dt);
    squisher.update();
    hazards.update(dt);
    vitals.update(dt);
    nav.update(dt);
    colony?.update(dt);
    env?.update(dt);
    tinyDetails?.update(dt);
    if (zone !== 'outside') bugs?.update(dt);
    for (const h of humans) h.update(dt);
    level.update?.(dt);
    input.endFrame();
    game.frame++;
  }

  function loop() {
    requestAnimationFrame(loop);
    // one clock for everything: the frame timestamp the browser passes can lag
    // behind performance.now() (seen: 28 s behind), which made time run backwards
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!params.has('paused')) step(dt);
    game_applyZone?.();
    updateSizeHud(dt);
    const hint = player.interactHint || hands.hint;
    if (hintEl && hintEl.textContent !== (hint || '')) { hintEl.textContent = hint || ''; hintEl.hidden = !hint; }
    if (renderer.render(now) && fpsEl) {
      fpsEl.hidden = !settings.get('graphics.showFps');
      fpsEl.textContent = `${renderer.fps} FPS`;
    }
  }
  requestAnimationFrame(loop);
  game.ready = true;
  return game;
}

boot().catch((err) => {
  console.error(err);
  const box = document.getElementById('error');
  if (box) { box.hidden = false; box.textContent = `Something broke while loading: ${err.message}`; }
});
