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
import { Speech } from './humans/speech.js';
import { Talk } from './humans/talk.js';
import { Police } from './police.js';
import { Family } from './family.js';
import { Interactables } from './world/interact.js';
import { Shops } from './shops.js';
import { Germs } from './germs.js';
import { Village, buildBurrow } from './village.js';
import { Pets } from './pets.js';
import { Audio } from './audio.js';
import { Footsteps } from './footsteps.js';
import { Resizer } from './gadgets/resize.js';
import { TownLife } from './humans/town-life.js';
import { Jobs } from './jobs.js';
import { TinyReality } from './tiny-reality.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { PauseMenu } from './ui/pause-menu.js';
import { Phone, saveGame, loadGame, hasSave } from './phone.js';
import { TOWN_LOOKS, isFemale, nameFor, jobOf } from './humans/looks.js';
import { buildToon } from './humans/toon.js';
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
const pick = (a) => a[(Math.random() * a.length) | 0];

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
  // people: made by the game (jiggly / cartoony / simple, fast) or the scanned realistic ones
  const charStyle = params.get('people') || settings.get('gameplay.characters') || 'jiggly';
  const skeletons = {};
  const skeletonFor = async (g) => (skeletons[g] ??= g === 'f'
    ? await loadAvatar('assets/avatars/Business_Female_01.glb').catch(() => null) || await loadAvatar('assets/avatars/Male_Adult_01.glb')
    : await loadAvatar('assets/avatars/Male_Adult_01.glb'));
  let toonCount = 0;
  const avatarFor = async (look, { job } = {}) => {
    if (charStyle === 'realistic') return loadAvatar(`assets/avatars/${look}.glb`);
    const g = isFemale(look) ? 'f' : 'm';
    return buildToon(await skeletonFor(g), { seed: `${look}#${toonCount++}`, gender: g, job: job ?? jobOf(look), style: charStyle });
  };
  const avatar = charStyle === 'realistic' ? await loadAvatar('assets/avatars/Male_Adult_01.glb') : await avatarFor('Male_Adult_01', { job: 'none' });
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
        const tpl = await avatarFor(look).catch(() => avatar);
        const start = nav.randomPoint(level.wanderArea) || level.spawn;
        humans.push(new Human({ template: tpl, lib, nav, physics, scene, gender, position: start, area: level.wanderArea, profile: { look, name: nameFor(look), job: jobOf(look) }, settings }));
      }
      // townspeople: different looks, each starts somewhere on the street
      const townCount = Number(params.get('townPeople') ?? level.town?.people ?? 0);
      const order = [...TOWN_LOOKS].sort(() => Math.random() - 0.5);
      for (let i = 0; i < townCount; i++) {
        const look = order[i % order.length];
        const gender = isFemale(look) ? 'f' : 'm';
        await lib.require(baseClips(gender));
        const tpl = await avatarFor(look).catch(() => null);
        if (!tpl) continue; // that look isn't in this build
        const start = nav.randomPoint(level.town.area) || null;
        if (!start) break;
        const h = new Human({ template: tpl, lib, nav, physics, scene, gender, position: start, area: level.town.area, settings, profile: { look, name: nameFor(look), job: jobOf(look) } });
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
  // what people say: speech bubbles over their heads
  const speech = new Speech({ camera });
  // sound (made in code): footsteps by size, voices, gadgets, the world around you
  const audio = new Audio({ settings, camera });
  speech.audio = audio;
  for (const h of humans) { h.speech = speech; h.player = player; }
  // the shrink ray works on things too
  const resizer = new Resizer({ physics, props: level.props, rebuildProps: level.rebuildProps, player });
  const hands = new Hands({ scene, camera, physics, player, input, humans, cage, colony, speech, audio, resizer });
  // T / Enter: type something to whoever you're looking at (or holding)
  const talk = new Talk({ input, camera, humans, speech, player, colony, canvas: input.target, places: level.town?.spots || [], getHeld: () => hands.items.find((i) => i.held)?.held ?? null });
  player.cage = cage;
  const squisher = new Squisher({ scene, player, humans, settings });
  const vitals = new Vitals(settings);
  const hazards = new Hazards({ player, cage, vitals, input, respawn: level.respawn || level.spawn });
  if (colony) { colony.player = player; colony.vitals = vitals; }
  player.vitals = vitals;
  // witnesses and the police: officers come when someone reports you
  const police = new Police({
    humans, player, physics, nav, speech, area: level.town?.area,
    toast: (t) => toast(t),
    spawnOfficer: async (at) => {
      const look = Math.random() < 0.5 ? 'Police_Male_01' : 'Police_Female_01';
      const gender = isFemale(look) ? 'f' : 'm';
      await lib.require(baseClips(gender));
      const tpl = await avatarFor(look, { job: 'police officer' }).catch(() => null)
        || await avatarFor('Police_Male_01', { job: 'police officer' }).catch(() => null);
      if (!tpl) return null;
      const h = new Human({ template: tpl, lib, nav, physics, scene, gender, position: at, area: level.town?.area, settings, profile: { look, name: `Officer ${nameFor(look).split(' ')[1]}`, job: 'police officer', personality: { bravery: 0.9 } } });
      h.townie = true;
      h.speech = speech;
      h.player = player;
      if (zone === 'lab') h.character.root.visible = false;
      humans.push(h);
      return h;
    },
    onArrest: () => {
      for (const it of hands.items) it.release?.();
      hazards.blackout('BUSTED! The police caught you and took you home.', level.home || level.spawn, { busted: true });
    },
  });
  const crime = (kind, pos, victim) => police.crime(kind, pos, victim);
  hands.ctx.crime = crime;
  squisher.onSquish = (h, p) => { audio.squish(p); crime('kill', p, h); };
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
      for (const h of humans) if (h.townie && !h.tiny && h.state !== 'away') h.character.root.visible = z !== 'lab';
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
  // townspeople's days: home, work, out, home again
  if (level.town?.spots && env && params.get('routines') !== '0') new TownLife({ humans, env, spots: level.town.spots, scene });
  // things you use with E (light switch, chores...)
  const interact = new Interactables({ camera, player, input });
  // Mom and Dad: routines, chores, allowance (and they take the watch if they catch you)
  let family = null;
  if (level.house && params.get('family') !== '0') {
    family = new Family({ player, env, speech, toast: (t) => toast(t), interact, scene, physics, home: level.house, police });
    const parentLook = async (looks) => { for (const l of looks) { const t = await avatarFor(l, { job: l.startsWith('F') || l.startsWith('B') ? 'nurse' : 'office worker' }).catch(() => null); if (t) return [l, t]; } return [null, null]; };
    for (const [role, looks] of [['mom', ['Female_Adult_05', 'Female_Adult_02', 'Business_Female_01']], ['dad', ['Male_Adult_07', 'Male_Adult_01', 'Male_Adult_04']]]) {
      const [look, tpl] = await parentLook(looks);
      if (!tpl) continue;
      const gender = role === 'mom' ? 'f' : 'm';
      await lib.require(baseClips(gender));
      const start = nav.closest(level.house.spots[role === 'mom' ? 'counter' : 'tv'].p) || level.house.spots.tv.p;
      const h = new Human({ template: tpl, lib, nav, physics, scene, gender, position: start, area: level.house.inHouse, settings, profile: { look, name: role === 'mom' ? 'Mom' : 'Dad', personality: { bravery: 0.7, temper: role === 'dad' ? 0.6 : 0.4, friendliness: 0.8 } } });
      h.speech = speech;
      h.player = player;
      humans.push(h);
      family.add(h, role);
    }
  }
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
  // the shops across the street (and your backpack)
  const shops = new Shops({ spots: level.town?.spots, interact, input, player, family, vitals, police, speech, humans, toast, canvas: input.target });
  // the wall village: tiny people living behind the mouse hole under your bed
  let village = null;
  if (level.village && params.get('village') !== '0') {
    village = new Village({ layout: level.village, player, camera, speech });
    const order = [...TOWN_LOOKS].sort(() => Math.random() - 0.5);
    let made = 0;
    for (const look of order) {
      if (made >= 5) break;
      // (tiny villagers wear their own clothes, not the uniform that came with the look)
      const job = pick(['matchbox builder', 'crumb farmer', 'thread spinner', 'water carrier', 'mayor of Wallton']);
      const tpl = await avatarFor(look, { job }).catch(() => null);
      if (!tpl) continue;
      const gender = isFemale(look) ? 'f' : 'm';
      await lib.require(baseClips(gender));
      const h = new Human({ template: tpl, lib, nav, physics, scene, gender, position: level.village.houses[made % 3], settings, profile: { look, name: nameFor(look), job } });
      h.speech = speech;
      h.player = player;
      humans.push(h);
      village.add(h);
      made++;
    }
  }
  // pets from the pet shop
  const pets = new Pets({ scene, player, nav, physics, interact, speech, shops, toast, home: level.house });
  shops.pets = pets;
  if (params.get('pet')) pets.adopt(params.get('pet'));
  // settings (not realistic): a second tiny village, under a fir in the park
  if (settings.get('tiny.moreTinyCities') && level.village && params.get('village') !== '0') {
    const burrow = new Village({ layout: buildBurrow(scene, new THREE.Vector3(-13, 3.281, -13.5 + 0.9)), player, camera, speech });
    let made = 0;
    for (const look of [...TOWN_LOOKS].sort(() => Math.random() - 0.5)) {
      if (made >= 4) break;
      const job = pick(['leaf weaver', 'seed collector', 'acorn carver']);
      const tpl = await avatarFor(look, { job }).catch(() => null);
      if (!tpl) continue;
      const gender = isFemale(look) ? 'f' : 'm';
      await lib.require(baseClips(gender));
      const h = new Human({ template: tpl, lib, nav, physics, scene, gender, position: burrow.layout.houses[made % 4], settings, profile: { look, name: nameFor(look), job } });
      h.speech = speech; h.player = player;
      humans.push(h);
      burrow.add(h);
      made++;
    }
  }
  // the germ world: what's on the floor when you're smaller than 2 cm
  const germs = new Germs({ scene, player, physics });
  // your bed: sleep until morning (or a nap in the daytime)
  if (level.house && env) {
    interact.add({
      at: new THREE.Vector3(3.6, 3.85, -3.9), radius: 2.2,
      label: () => (env.hour >= 20 || env.hour < 5 ? 'Sleep until morning' : 'Take a nap (1 hour)'),
      when: () => player.scale > 0.5 && player.scale < 2,
      use: () => {
        const night = env.hour >= 20 || env.hour < 5;
        hazards.blackout(night ? 'Zzz… you sleep through the night.' : 'Zzz… a quick nap.', player.feet.clone(), { revive: false });
        hazards.onMoved = () => {
          hazards.onMoved = null;
          const wake = night ? 7 : (env.hour + 1) % 24;
          if (night && env.hour >= 20) env.day = (env.day ?? 1) + 1;
          env.hour = wake;
          vitals.energy = Math.min(100, vitals.energy + (night ? 100 : 25));
          vitals.hunger = Math.max(5, vitals.hunger - (night ? 15 : 3));
          vitals.thirst = Math.max(5, vitals.thirst - (night ? 20 : 4));
        };
      },
    });
  }
  // your phone (P): messages, map, weather, bank, wanted
  const phone = new Phone({ input, player, env, family, police, humans, level, canvas: input.target });
  if (family) family.phone = phone;
  // odd jobs: parcels, lost rings, shifts at the till
  const jobs = new Jobs({ scene, interact, family, env, hazards, player, toast, phone, spots: level.town?.spots });
  // what being small really does to you (and the not-realistic extras from settings)
  // everyone's footsteps (people, tiny people, the rat, bugs)
  const footsteps = new Footsteps({ audio, humans, pets, bugs, camera, inHouse: level.house?.inHouse, inLab: level.inLab });
  const tiny = new TinyReality({ player, vitals, env, camera, canvas: renderer.renderer.domElement, audio, humans, pets, bugs, cage, colony, details: tinyDetails, family, hazards, settings, speech, interact, input, scene, toast, germs, getZone: () => zone });
  // F10: settings
  const settingsPanel = new SettingsPanel({ settings, input, canvas: input.target, toast });
  const game = { scene, camera, physics, input, renderer, player, settings, character, level, nav, humans, hands, cage, colony, vitals, hazards, env, bugs, speech, talk, police, family, interact, shops, germs, village, pets, audio, phone, jobs, tiny, settingsPanel, frame: 0 };
  // saving: F5 / F9, every 2 minutes, and when you close the game; picks up where you left off
  Object.defineProperty(game, 'zone', { get: () => zone });
  // Esc: the pause menu (and the start screen)
  const pauseMenu = new PauseMenu({ input, canvas: input.target, settingsPanel, save: () => saveGame(game), load: () => loadGame(game), toast, isBusy: () => !input.enabled, start: !params.has('paused') });
  game.pauseMenu = pauseMenu;
  settings.onChange((d, patch) => { if (patch.gameplay?.camera && patch.gameplay.camera !== player.mode) player.toggleCamera(); });
  game.save = () => saveGame(game);
  game.load = () => loadGame(game);
  if (hasSave() && !params.has('paused') && !params.has('fresh')) loadGame(game).then((ok) => ok && toast('Welcome back! (F5 saves, F9 loads)')).catch((e) => console.warn('[save]', e.message));
  addEventListener('beforeunload', () => { if (!params.has('paused')) saveGame(game); });
  let autosave = 120;
  hands.ctx.toast = toast;
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
    resizer.update(dt);
    squisher.update();
    hazards.update(dt);
    tiny.update(dt);
    settingsPanel.update();
    // the world around you (not you) runs slower when you're tiny: small animals see in slow motion
    const wdt = dt * tiny.timeScale;
    interact.update();
    family?.update(wdt);
    shops.update();
    germs.update(wdt);
    pets.update(wdt);
    audio.update(dt, { env, zone, player });
    footsteps.update(wdt);
    phone.update(dt);
    jobs.update(dt, camera);
    if (input.pressed('quickSave')) toast(saveGame(game) ? 'Game saved' : 'Could not save');
    if (input.pressed('quickLoad')) loadGame(game).then((ok) => toast(ok ? 'Game loaded' : 'No saved game yet'));
    if (!params.has('paused') && (autosave -= dt) <= 0) { autosave = 120; saveGame(game); }
    vitals.update(dt);
    nav.update(wdt);
    colony?.update(wdt);
    env?.update(wdt);
    tinyDetails?.update(wdt);
    if (zone !== 'outside') bugs?.update(wdt);
    for (const h of humans) h.update(wdt);
    talk.update(dt);
    police.update(wdt);
    speech.update(dt);
    level.update?.(wdt);
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
    if (!params.has('paused') && !pauseMenu.paused) step(dt);
    audio.tickMusic(pauseMenu.paused ? 'night' : police.wanted > 0 && police.unseen < 15 ? 'chase' : (env?.night ?? 0) > 0.6 ? 'night' : 'day');
    game_applyZone?.();
    updateSizeHud(dt);
    const hint = pauseMenu.paused || settingsPanel.isOpen ? null : player.interactHint || interact.hint || hands.hint;
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
