// ANYFORGE: stick parts together and make anything. PC (mouse + keyboard) and Quest 3 (VR in the browser).
import * as THREE from 'three';
import { renderer, scene, camera, rig, setSky, preloadSkies, setQuality, quality, isAuto, autoQualityTick, updateSun, resize,
  assignLights, qualitySettings, onQuality, fps, skyName, sun } from './core/render.js';
import { initPhysics, stepPhysics, setGravity, setTimeScale, timeScale, world, raycast, G, groups, simTime, snapTracked, toV, R } from './core/physics.js';
import { onProgress, track } from './core/assets.js';
import { preloadTextures, setAnisotropy, PAINT, MATS, MAT_ORDER } from './core/mats.js';
import { initAudio, resumeAudio, play, loop, ambient, updateListener, setVolume } from './core/audio.js';
import { buildWorld, PAD } from './world.js';
import { game, GRAVITY } from './game.js';
import { fxTime } from './fx/shaders.js';
import { makeFX } from './fx/particles.js';
import { DEFS, LIST, CATS } from './parts/defs.js';
import { worldPos, worldQuat, worldUp } from './parts/rt.js';
import { bodies, constructOf, destroyBody, serialize, deserialize, partWorld, bodyPose, rebuildPart, removePart, setFrozen,
  blueprintCenter, topo, wires } from './build/core.js';
import { powerStep, setController, allActive } from './build/powered.js';
import { hideGhost } from './build/place.js';
import { handleContacts, detonate, updateExplosions, updateShards, shatter } from './build/damage.js';
import { player, initPlayer, movePlayer, updateCamera, sit, standUp, knock, teleportPlayer, respawn, playerCenter } from './player/player.js';
import * as pc from './input/pc.js';
import { T, TOOLS, setTool, pickPart, onToolChange, toolFrame, primary, secondary, wheel, rotate, undo, use, letGo, holdStep,
  turnHeld, drawWires, holdingThing, recordNew } from './tools/tools.js';
import * as menus from './ui/menus.js';
import { buildToolbar, markTool, setHints, aimLabel, toast, status, seatHud, hurtFlash } from './ui/hud.js';
import { makeThumbs, thumbs } from './ui/thumbs.js';
import { humanAPI, initHumans, personThumbMakers } from './people/humans.js';
import { EXAMPLES } from './examples.js';
import { initVR, vrFrame, vrSession } from './input/vr.js';

const VERSION = typeof __AF_VERSION__ !== 'undefined' ? __AF_VERSION__ : 'dev';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('anyforge.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('anyforge.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};

/* ---------------- shared hooks ---------------- */
game.toast = toast;
game.sound = (n, p, v, r) => play(n, p, v, r);
game.snapBody = (b) => snapTracked(b.tr);
game.humans = humanAPI;
game.useRay = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
game.input = { shift: false };
let flashLight = null;
let started = false;

/* ---------------- the context parts get while running ---------------- */
const RAY_G = groups(G.WORLD, G.WORLD | G.PARTS | G.HUMAN);
const flashes = [];
const ctx = {
  time: 0, gravity: -9.81, playerPos: new THREE.Vector3(), fx: null,
  ray(from, dir, max, excludeBody) { return raycast(from, dir, max, { groups: RAY_G, excludeBody: excludeBody ? excludeBody.rb : undefined }); },
  bodiesNear(pos, r, self) {
    const out = [];
    const mine = self ? constructOf(self.body) : null;
    for (const b of bodies) {
      if (b.frozen || (mine && mine.has(b))) continue;
      const c = b.rb.worldCom();
      const dx = c.x - pos.x, dy = c.y - pos.y, dz = c.z - pos.z;
      const rad = b.radius || 0.5;
      if (dx * dx + dy * dy + dz * dz > (r + rad) * (r + rad)) continue;
      out.push({ rb: b.rb, body: b, radius: rad, metal: b.metal || 0 });
    }
    return out;
  },
  humansNear: (pos, r) => humanAPI.near(pos, r),
  nearestHuman: (pos, r) => humanAPI.nearest(pos, r),
  sameBuild: (a, b) => constructOf(a.body).has(b.body),
  swallow(o, at) {
    const set = constructOf(o.body);
    game.fx.sparks(toV(o.rb.worldCom()), 10, 4, 0xffd9a0);
    if (o.body.parts.size > 3 && set.size === 1) {
      // big builds get eaten one piece at a time
      let near = null, nd = 1e9;
      for (const p of o.body.parts) { const d = partWorld(p, new THREE.Vector3()).distanceTo(at); if (d < nd) { nd = d; near = p; } }
      if (near) removePart(near);
    } else destroyBody(o.body);
    play('zap', at, 0.35, 0.5);
  },
  swallowHuman(h, at) { humanAPI.remove(h, true); play('zap', at, 0.5, 0.4); },
  pullPlayer(dir, acc, dt, eat) {
    if (player.seat) return;
    knock(dir.clone().multiplyScalar(acc * dt));
    if (eat) { respawn(); toast('The black hole spat you out back at the start'); play('portal', null, 0.8); }
  },
  pushPlayer(dir, acc, dt) { if (!player.seat) knock(dir.clone().multiplyScalar(acc * dt * 3)); },
  playerInside: (p) => !!player.seat && constructOf(player.seat.body).has(p.body),
  laserHit(hit, dir, dt, src) {
    const o = hit.owner;
    if (!o) return;
    if (o.kind === 'part') {
      const p = o.ref;
      if (p.dead) return;
      const m = MATS[p.mat];
      if ((m && m.fragile) || p.def.fragile) { shatter(p, hit.point); return; }
      if (p.def.explosive) { detonate(p); return; }
      p.body.rb.applyImpulseAtPoint({ x: dir.x * 40 * dt, y: dir.y * 40 * dt, z: dir.z * 40 * dt }, hit.point, true);
      if (Math.random() < 0.3) game.fx.sparks(hit.point, 2, 2, 0xff6040);
    } else if (o.kind === 'human') o.ref.laser && o.ref.laser(hit.point, dir, dt);
  },
  detonate: (p) => detonate(p),
  sound: (n, p, v) => play(n, p, v),
  teleportPlayer(Tf) {
    if (player.seat) return;
    const p = Tf.point(player.pos.clone().setY(player.pos.y + 0.9)); p.y -= 0.9;
    teleportPlayer(p);
    const v = Tf.dir(player.push.clone()); player.push.copy(v);
    const look = Tf.dir(new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)));
    player.yaw = Math.atan2(-look.x, -look.z);
    play('portal', null, 0.8);
  },
  flash(at, power) { flashes.push({ pos: at.clone(), t: 0.35, power }); },
  shake(v) { player.shake = Math.max(player.shake, v); },
  blastHumans: (at, r, push) => humanAPI.blast(at, r, push),
  blastPlayer(at, r, push) {
    const c = playerCenter();
    const d = c.distanceTo(at);
    if (d > r * 1.2) return;
    const f = 1 - d / (r * 1.2);
    if (player.seat) { game.hurt = Math.max(game.hurt, f); return; }
    const dir = c.sub(at).normalize(); dir.y = Math.abs(dir.y) + 0.5;
    knock(dir.normalize().multiplyScalar(push * f * 1.4));
    game.hurt = Math.max(game.hurt, f);
  },
  skyTexture: () => scene.background
};
game.partCtx = ctx;
game.meshCtx = ctx;
game.detonate = (p) => detonate(p);

/* ---------------- settings ---------------- */
Object.assign(game.settings, store.get('settings', {}));
function saveSettings() { store.set('settings', game.settings); }
function applySettings() {
  const s = game.settings;
  setGravity(GRAVITY[s.gravity] ?? -9.81);
  ctx.gravity = GRAVITY[s.gravity] ?? -9.81;
  setVolume(s.volume);
  camera.fov = s.fov; camera.updateProjectionMatrix();
  if (s.quality === 'auto') setQuality(isAuto() ? quality() : 'medium', true); else setQuality(s.quality, false);
  if (game.fx) game.fx.gore = s.gore;
  setHints();
}
onQuality((q) => setAnisotropy(q.aniso));

/* ---------------- boot ---------------- */
async function boot() {
  $('stage').appendChild(renderer.domElement);
  resize();
  addEventListener('resize', resize);
  onProgress((f) => { $('loadbar').style.width = Math.round(f * 100) + '%'; });
  setQuality('medium', true);
  await initPhysics();
  initPlayer();
  pc.initPC(renderer.domElement);
  game.fx = makeFX();
  ctx.fx = game.fx;
  const jobs = [preloadTextures(), preloadSkies(), initAudio(), initHumans()];
  $('loadtext').textContent = 'Loading real materials, skies and sounds';
  await Promise.all(jobs);
  buildWorld();
  await setSky(game.settings.sky || 'day');
  applySettings();
  flashLight = new THREE.SpotLight(0xfff2dd, 0, 45, 0.5, 0.45, 1.6);
  flashLight.castShadow = false;
  camera.add(flashLight, flashLight.target);
  flashLight.target.position.set(0, 0, -1);
  $('loadtext').textContent = 'Taking pictures of the parts';
  await new Promise((r) => setTimeout(r, 30));
  makeThumbs(personThumbMakers());
  buildToolbar();
  setHints();
  onToolChange(() => markTool());
  initVR(vrHooks);
  renderer.setAnimationLoop(frame);
  menus.onMenuChange(() => updateFocus());
  pc.onLock((locked) => { if (!locked && started && !menus.isOpen() && !game.inVR) openPause(); updateFocus(); });
  renderer.domElement.addEventListener('click', () => { if (started && !menus.isOpen() && !game.inVR) pc.lockMouse(); });
  $('clickcatch').addEventListener('click', () => { resumeAudio(); pc.lockMouse(); });
  $('filein').addEventListener('change', openFile);
  addEventListener('beforeunload', () => { if (started) autosave(); });
  setInterval(() => { if (started) autosave(); }, 60000);
  $('loading').classList.add('done');
  setTimeout(() => { $('loading').hidden = true; }, 600);
  titleScreen();
}

/* ---------------- menus ---------------- */
function titleScreen() {
  started = false;
  $('hud').hidden = true;
  player.pos.set(0, 0, 8);
  player.yaw = 0;
  const hasAuto = !!store.get('auto', null);
  menus.open({
    id: 'title', logo: true, cls: 'title', noBack: true,
    sub: 'Stick parts together and make anything. Cars, rockets, robots, black holes.',
    items: () => [
      { type: 'button', label: hasAuto ? 'Keep building' : 'Start building', on: () => start(hasAuto) },
      hasAuto ? { type: 'button', label: 'New empty world', on: () => start(false) } : null,
      vrSession.supported ? { type: 'button', label: 'Play in VR', value: 'Quest 3', on: () => { start(hasAuto, true); } } : null,
      { type: 'button', label: 'Examples', on: openExamples },
      { type: 'button', label: 'Settings', on: openSettings },
      { type: 'button', label: 'Controls', on: openControls }
    ]
  });
  const ver = document.createElement('div');
  ver.className = 'version'; ver.id = 'ver'; ver.textContent = 'ANYFORGE ' + VERSION;
  if (!$('ver')) document.body.appendChild(ver);
}
function start(load, vr = false) {
  resumeAudio();
  menus.closeAll();
  started = true;
  $('hud').hidden = false;
  if ($('ver')) $('ver').remove();
  if (load) { const a = store.get('auto', null); if (a) loadWorld(a); }
  if (vr) { vrSession.enter(); return; }
  pc.lockMouse();
  updateFocus();
  toast('Tab opens all the parts. 1-8 pick a tool.', 4000);
}
function openPause() {
  if (menus.isOpen()) return;
  menus.open({
    id: 'pause', title: 'Paused', sub: worldSummary(),
    items: () => [
      { type: 'button', label: 'Resume', on: resume },
      { type: 'button', label: 'Parts', on: () => openParts() },
      { type: 'button', label: 'Examples', on: openExamples },
      { type: 'button', label: 'Save and load', on: openSaves },
      { type: 'button', label: 'Settings', on: openSettings },
      { type: 'button', label: 'Controls', on: openControls },
      { type: 'button', label: 'Clear the world', on: () => confirmBox('Clear the world?', 'Every build and person goes away. Undo cannot bring it back (your autosave is replaced next minute).', 'Clear', () => { clearWorld(); menus.closeAll(); resume(); }) },
      { type: 'button', label: 'Quit to title', on: () => { autosave(); clearWorld(); menus.closeAll(); titleScreen(); } }
    ]
  });
}
function resume() { menus.closeAll(); if (!game.inVR) pc.lockMouse(); }
function worldSummary() {
  let n = 0; for (const b of bodies) n += b.parts.size;
  return n + ' parts, ' + humanAPI.list.length + ' people';
}
function confirmBox(title, sub, yes, fn) {
  menus.open({ id: 'confirm', title, sub, items: () => [{ type: 'row', buttons: [{ label: 'Cancel', on: () => menus.close() }, { label: yes, primary: true, on: () => { menus.close(); fn(); } }] }] });
}

let partsTab = 'Blocks';
function openParts(tab) {
  if (tab) partsTab = tab;
  menus.open({
    id: 'parts', title: 'Parts', wide: true,
    items: () => {
      const items = [{ type: 'tabs', tabs: [...CATS.map((c) => [c, c]), ['Paint', 'Paint']], get: () => partsTab, set: (v) => { partsTab = v; } }];
      if (partsTab === 'Paint') {
        items.push({ type: 'note', text: 'Pick a material and a color, then use the Paint tool (4) on any part. Shift + click paints a whole build.' });
        items.push({ type: 'choice', label: 'Material', options: MAT_ORDER.map((k) => [k, MATS[k].name]), get: () => T.paintMat, set: (v) => { T.paintMat = v; T.paintColor = MATS[v].color; } });
        items.push({ type: 'swatches', label: 'Color', colors: PAINT, get: () => T.paintColor, set: (v) => { T.paintColor = v; } });
        items.push({ type: 'row', buttons: [{ label: 'Use the Paint tool', primary: true, on: () => { setTool('paint'); resume(); } }] });
        return items;
      }
      items.push({
        type: 'grid', tiles: LIST.filter((d) => d.cat === partsTab).map((d) => ({
          img: thumbs[d.id], label: d.name, sub: d.desc.split('.')[0] + '.', tip: d.desc, sel: T.def === d,
          on: () => { pickPart(d.id); resume(); toast(d.name + ': ' + d.desc, 4500); }
        }))
      });
      return items;
    }
  });
}

function openSettings() {
  const s = game.settings;
  const set = (k) => (v) => { s[k] = v; saveSettings(); applySettings(); };
  menus.open({
    id: 'settings', title: 'Settings',
    items: () => [
      { type: 'heading', text: 'Graphics' },
      { type: 'choice', label: 'Quality', options: [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], get: () => s.quality, set: set('quality') },
      { type: 'choice', label: 'Sky', options: [['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']], get: () => s.sky, set: (v) => { s.sky = v; saveSettings(); setSky(v); } },
      { type: 'slider', label: 'Field of view', min: 55, max: 100, step: 1, get: () => s.fov, set: set('fov') },
      { type: 'heading', text: 'World' },
      { type: 'choice', label: 'Gravity', options: [['earth', 'Earth'], ['moon', 'Moon'], ['mars', 'Mars'], ['low', 'Low'], ['zero', 'None'], ['heavy', 'Heavy']], get: () => s.gravity, set: set('gravity') },
      { type: 'toggle', label: 'Things break in big crashes', get: () => s.breaking, set: set('breaking') },
      { type: 'choice', label: 'Blood', options: [['off', 'Off'], ['some', 'Some'], ['max', 'Max']], get: () => s.gore, set: set('gore') },
      { type: 'choice', label: 'Snap to grid', options: [[0.125, 'Fine'], [0.25, 'Normal'], [0.5, 'Big'], [0, 'Off']], get: () => s.grid, set: set('grid') },
      { type: 'heading', text: 'Controls' },
      { type: 'slider', label: 'Mouse speed', min: 0.2, max: 3, step: 0.1, get: () => s.sensitivity, set: set('sensitivity'), fmt: (v) => v.toFixed(1) },
      { type: 'toggle', label: 'Invert mouse up / down', get: () => s.invertY, set: set('invertY') },
      { type: 'toggle', label: 'Show control hints', get: () => s.hints, set: set('hints') },
      { type: 'heading', text: 'VR' },
      { type: 'toggle', label: 'Snap turning (off = smooth)', get: () => s.snapTurn, set: set('snapTurn') },
      { type: 'slider', label: 'Walk speed', min: 1, max: 6, step: 0.5, get: () => s.vrSmoothSpeed, set: set('vrSmoothSpeed') },
      { type: 'heading', text: 'Sound' },
      { type: 'slider', label: 'Volume', min: 0, max: 1, step: 0.05, get: () => s.volume, set: set('volume'), fmt: (v) => Math.round(v * 100) + '%' }
    ]
  });
}
function openControls() {
  menus.open({
    id: 'controls', title: 'Controls',
    items: () => [
      { type: 'heading', text: 'Moving' },
      { type: 'keys', rows: [['W A S D', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump (tap twice to fly)'], ['Space / C', 'Fly up / down'], ['F', 'Flashlight'], ['T', 'Stop time / start time'], ['Y', 'Slow motion']] },
      { type: 'heading', text: 'Building' },
      { type: 'keys', rows: [['1 - 8', 'Tools: Build, Grab, Edit, Paint, Wire, Delete, Hand, Size'], ['Tab', 'All parts'], ['Click / Right click', 'Use the tool / its second action'], ['Mouse wheel', 'Part size (Build), side size (Edit), distance (Grab)'], ['R / Shift + R', 'Turn the part'], ['G', 'Grid snap on / off'], ['Z', 'Undo'], ['E', 'Use: sit, press, flip, take the remote']] },
      { type: 'heading', text: 'In a seat' },
      { type: 'keys', rows: [['W / S', 'Wheels forward / back, thrusters that push forward'], ['A / D', 'Turn'], ['Space / C', 'Up / down thrusters'], ['Arrows Up / Down', 'Tilt (with a Gyro)'], ['Q / E', 'Roll (with a Gyro)'], ['1 2 3 4', 'Pistons, motors, sci-fi parts, beams'], ['X', 'Explosives'], ['L', 'Lights'], ['H', 'Horn'], ['V', 'Inside / outside camera'], ['F', 'Get out']] },
      { type: 'heading', text: 'VR (Quest 3)' },
      { type: 'keys', rows: [['Left stick', 'Walk'], ['Right stick', 'Turn, fly up / down'], ['Grip', 'Grab with that hand'], ['Right trigger', 'Use the tool'], ['A', 'Turn the part'], ['B', 'Undo'], ['X', 'Fly on / off'], ['Y', 'Menu'], ['Punch', 'Just swing your fist']] }
    ]
  });
}

/* ---------------- part / person editor ---------------- */
game.openEditor = (target, kind) => {
  if (kind === 'human') { menus.open(humanAPI.editor(target, { open: menus.open, close: menus.close, refresh: menus.refresh })); return; }
  let p = target.rotorBase || target;
  const d = p.def;
  const s = (k) => p.size[k];
  const resizeTo = (k, v) => {
    if (d.resize === 'uniform' || d.resize === 'uniform-ish') { const r = v / p.size.x; p.size.multiplyScalar(r); }
    else if (d.resize === 'round' && (k === 'x' || k === 'z')) { p.size.x = v; p.size.z = v; }
    else p.size[k] = v;
    rebuildPart(p); p.body.metaDirty = true;
  };
  const sizeItems = [];
  if (d.resize && !d.joint) {
    const sl = (label, k) => ({ type: 'slider', label, min: 0.125, max: 16, step: 0.125, get: () => s(k), set: (v) => resizeTo(k, v), fmt: (v) => v.toFixed(3).replace(/\.?0+$/, '') + ' m' });
    if (d.resize === 'xyz') sizeItems.push(sl('Width', 'x'), sl('Height', 'y'), sl('Length', 'z'));
    else if (d.resize === 'round') sizeItems.push(sl('Width', 'x'), sl('Height', 'y'));
    else sizeItems.push(sl('Size', 'x'));
  }
  const propItems = d.props.map((pr) => {
    const after = () => { if (pr.rebuild) rebuildPart(p); if (d.init) d.init(p); p.st.motorKey = null; };
    if (pr.type === 'slider') return { type: 'slider', label: pr.label, min: pr.min, max: pr.max, step: pr.step, get: () => p.props[pr.k], set: (v) => { p.props[pr.k] = v; after(); } };
    if (pr.type === 'toggle') return { type: 'toggle', label: pr.label, get: () => !!p.props[pr.k], set: (v) => { p.props[pr.k] = v; after(); } };
    if (pr.type === 'choice') return { type: 'choice', label: pr.label, options: pr.options, get: () => p.props[pr.k], set: (v) => { p.props[pr.k] = v; after(); } };
    if (pr.type === 'swatch') return { type: 'swatches', label: pr.label, colors: ['#ffd9a0', '#ffffff', '#ff4a3a', '#ffb020', '#5dff7a', '#38d6ff', '#4a6bff', '#ff4fd8', '#e8e8e8', '#3b3836'], get: () => p.props[pr.k], set: (v) => { p.props[pr.k] = v; after(); } };
    return null;
  });
  menus.open({
    id: 'edit', title: d.name, sub: d.desc,
    items: () => [
      ...propItems,
      sizeItems.length ? { type: 'heading', text: 'Size' } : null, ...sizeItems,
      d.joint ? { type: 'note', text: 'Joint parts keep the size you placed them with. Pick a size with the mouse wheel before you place one.' } : null,
      { type: 'heading', text: 'Look' },
      { type: 'choice', label: 'Material', options: MAT_ORDER.map((k) => [k, MATS[k].name]), get: () => p.mat, set: (v) => { p.mat = v; p.color = null; rebuildPart(p); p.body.metaDirty = true; } },
      { type: 'swatches', label: 'Paint', colors: PAINT, get: () => p.color || MATS[p.mat].color, set: (v) => { p.color = v; rebuildPart(p); } },
      { type: 'heading', text: 'This build' },
      { type: 'toggle', label: 'Frozen in place', get: () => p.body.frozen, set: (v) => { for (const b of constructOf(p.body)) setFrozen(b, v); } },
      { type: 'row', buttons: [
        { label: 'Save as my build', on: () => saveBlueprint(p) },
        { label: 'Delete part', on: () => { removePart(p); menus.close(); } },
        { label: 'Done', primary: true, on: () => resume() }
      ] }
    ]
  });
};

/* ---------------- saving ---------------- */
function worldData() {
  return { v: 1, game: 'ANYFORGE', when: Date.now(), builds: serialize(new Set(bodies)), people: humanAPI.serialize(), sky: game.settings.sky };
}
function clearWorld() {
  if (player.seat) standUp();
  player.remote = null; game.remoteOn = false;
  letGo();
  for (const b of [...bodies]) destroyBody(b);
  humanAPI.clear();
  game.fx.clearStains();
}
function loadWorld(d) {
  try {
    clearWorld();
    if (d.builds) deserialize(d.builds, { keepIds: true });
    if (d.people) humanAPI.deserialize(d.people);
  } catch (e) { console.error(e); toast('That save could not be loaded'); }
}
function autosave() { store.set('auto', worldData()); }
function openSaves() {
  const slots = store.get('slots', {});
  const name = (i) => slots[i] ? new Date(slots[i].when).toLocaleString() + ' · ' + countParts(slots[i]) + ' parts' : 'Empty';
  menus.open({
    id: 'saves', title: 'Save and load', sub: 'Saves stay in this browser. Save to a file to keep them anywhere (or to move them to your Quest).',
    items: () => [
      ...[1, 2, 3, 4, 5, 6].map((i) => ({ type: 'button', label: 'Slot ' + i, value: name(i), on: () => slotMenu(i) })),
      { type: 'row', buttons: [{ label: 'Save to a file', on: downloadWorld }, { label: 'Open a file', on: () => $('filein').click() }] }
    ]
  });
  function slotMenu(i) {
    menus.open({
      id: 'slot', title: 'Slot ' + i, sub: name(i),
      items: () => [{ type: 'row', buttons: [
        { label: 'Save here', primary: true, on: () => { slots[i] = worldData(); if (!store.set('slots', slots)) toast('Not enough room in the browser: save to a file'); else toast('Saved in slot ' + i); menus.close(); menus.replace(menus.top()); } },
        slots[i] ? { label: 'Load', on: () => { loadWorld(slots[i]); resume(); toast('Loaded slot ' + i); } } : null,
        slots[i] ? { label: 'Delete', on: () => { delete slots[i]; store.set('slots', slots); menus.close(); } } : null
      ].filter(Boolean) }]
    });
  }
}
function countParts(d) { let n = 0; for (const b of (d.builds && d.builds.bodies) || []) n += b.parts.length; return n; }
function downloadWorld() {
  const blob = new Blob([JSON.stringify(worldData())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-world-' + new Date().toISOString().slice(0, 10) + '.anyforge';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Saved to your Downloads');
}
function openFile() {
  const f = $('filein').files[0];
  if (!f) return;
  f.text().then((t) => {
    const d = JSON.parse(t);
    if (d.game === 'ANYFORGE' && d.builds) { loadWorld(d); resume(); toast('Opened ' + f.name); }
    else if (d.bodies) { spawnBlueprint(d); resume(); }
    else toast('That is not an ANYFORGE file');
  }).catch(() => toast('That file could not be read'));
  $('filein').value = '';
}
function saveBlueprint(p) {
  const mine = store.get('mybuilds', []);
  const data = serialize(constructOf(p.body));
  mine.unshift({ name: p.def.name + ' build ' + (mine.length + 1), when: Date.now(), data });
  if (!store.set('mybuilds', mine.slice(0, 30))) toast('Not enough room in the browser');
  else toast('Saved to My builds (Examples menu)');
}
let exTab = 'examples';
function openExamples() {
  menus.open({
    id: 'examples', title: 'Examples', wide: true, sub: 'Ready-made builds. They appear in front of you: take them apart, change them, make them better.',
    items: () => {
      const mine = store.get('mybuilds', []);
      const items = [{ type: 'tabs', tabs: [['examples', 'Examples'], ['mine', 'My builds']], get: () => exTab, set: (v) => { exTab = v; } }];
      if (exTab === 'examples') {
        for (const ex of EXAMPLES) items.push({ type: 'button', label: ex.name, value: ex.desc, on: () => { if (!started) start(false); spawnBlueprint(ex.make()); resume(); } });
      } else if (!mine.length) items.push({ type: 'note', text: 'Nothing yet. Open any part with the Edit tool (3) and press "Save as my build".' });
      else mine.forEach((m, i) => items.push({ type: 'button', label: m.name, value: new Date(m.when).toLocaleDateString(), on: () => { if (!started) start(false); spawnBlueprint(m.data); resume(); } }));
      return items;
    }
  });
}
function spawnBlueprint(data) {
  const box = blueprintCenter(data);
  const c = box.getCenter(new THREE.Vector3());
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const dist = Math.max(4, box.getSize(new THREE.Vector3()).length() * 0.7 + 2);
  const pos = player.pos.clone().addScaledVector(f, dist);
  pos.y = (c.y - box.min.y) + 0.02 + Math.max(0, player.pos.y > 1 ? 0 : 0);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
  const made = deserialize(data, { xf: { origin: c, pos, quat: q } });
  recordNew(made);
  play('attach', pos, 0.7);
}

/* ---------------- seats + remote ---------------- */
game.sitIn = (seat) => {
  if (seat.st.rider) { toast('Someone is sitting there'); return; }
  if (holdingThing()) letGo();
  sit(seat);
  game.seated = true;
  setHints();
};
game.takeRemote = (p) => {
  if (player.remote === p) { player.remote = null; p.st.driving = false; game.remoteOn = false; setHints(); return; }
  player.remote = p; p.st.driving = true; game.remoteOn = true;
  player.orbitYaw = player.yaw + Math.PI;
  setHints();
};
function getOut() { standUp(); game.seated = false; setHints(); }

/* ---------------- punching (Hand tool on PC) ---------------- */
game.punch = (ray, hit) => {
  play('swing', null, 0.5);
  if (!hit || !hit.owner) return;
  if (hit.owner.kind === 'human') { humanAPI.punch(hit.owner.ref, hit.point, ray.dir, 7, hit.collider); return; }
  if (hit.owner.kind === 'part') {
    const rb = hit.owner.ref.body.rb;
    const m = Math.min(rb.mass(), 300);
    rb.applyImpulseAtPoint({ x: ray.dir.x * m * 3, y: ray.dir.y * m * 3 + m, z: ray.dir.z * m * 3 }, hit.point, true);
    play('punch', hit.point, 0.6);
  }
};

/* ---------------- VR hooks ---------------- */
const vrHooks = {
  menuToggle: () => { if (menus.isOpen()) resume(); else openPause(); },
  start: () => { game.inVR = true; menus.closeAll(); started = true; $('hud').hidden = true; },
  end: () => { game.inVR = false; player.seat && getOut(); $('hud').hidden = false; titleOrPause(); },
  getOut, ctx
};
function titleOrPause() { if (started) openPause(); }

/* ---------------- each frame ---------------- */
const timer = new THREE.Timer();
const ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
let spaceTap = 0, flyToggleT = 0;
const loops = new Map();
const LOOP_OF = { thruster: 'loop_thrust', blackhole: 'loop_hole', forcefield: 'loop_beam', tractor: 'loop_beam', motor: 'loop_motor', wheel: 'loop_motor' };
let wind = null;

function seatInput() {
  const k = pc.down;
  const held = new Set(), edges = new Set();
  const map = { Digit1: 'k1', Digit2: 'k2', Digit3: 'k3', Digit4: 'k4', KeyX: 'x', KeyL: 'l', KeyH: 'h' };
  for (const code in map) { if (k(code)) held.add(map[code]); if (pc.hit(code)) edges.add(map[code]); }
  return {
    drive: (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), steer: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0),
    lift: (k('Space') ? 1 : 0) - (k('KeyC') || k('ControlLeft') ? 1 : 0), pitch: (k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0),
    roll: (k('KeyE') ? 1 : 0) - (k('KeyQ') ? 1 : 0), held, edges
  };
}
let pendingEdges = new Set();

function frame(t, xrFrame) {
  timer.update(t);
  const dt = Math.min(timer.getDelta(), 0.1);
  fxTime.value += dt;
  ctx.time = simTime;
  autoQualityTick(dt);
  const inXR = renderer.xr.isPresenting;
  const playing = started && !menus.isOpen();
  game.input.shift = pc.down('ShiftLeft') || pc.down('ShiftRight');

  let seatIn = null;
  if (inXR) {
    seatIn = vrFrame(dt, xrFrame, { ray, playing });
  } else if (started) {
    if (playing && pc.mouse.locked) pcControls(dt);
    if (player.seat || player.remote) seatIn = playing && pc.mouse.locked ? seatInput() : { drive: 0, steer: 0, lift: 0, pitch: 0, roll: 0, held: new Set(), edges: new Set() };
    camera.updateMatrixWorld();
    ray.origin.setFromMatrixPosition(camera.matrixWorld);
    camera.getWorldDirection(ray.dir);
  }
  game.useRay.origin.copy(ray.origin); game.useRay.dir.copy(ray.dir);
  if (seatIn) for (const e of seatIn.edges) pendingEdges.add(e);

  // tools (not while sitting)
  if (!playing || player.seat || player.remote) hideGhost();
  document.getElementById('toolbar').hidden = !!(player.seat || player.remote);
  if (playing && !player.seat && !(player.remote && !inXR)) {
    toolFrame(ray, dt);
    if (!inXR) aimLabel(T.tool === 'build' ? '' : (T.aim ? aimNameFor(T.aim) : ''));
  } else if (!inXR) aimLabel('');
  if (!playing || player.seat) { if (!inXR) document.getElementById('crosshair').classList.remove('on'); }

  // physics
  ctx.playerPos.copy(playerCenter());
  stepPhysics(dt, (sdt) => {
    if (seatIn && (player.seat || player.remote)) {
      const ref = player.seat || player.remote;
      if (!ref.dead) setController(ref, { ...seatIn, edges: pendingEdges });
      pendingEdges = new Set();
    }
    holdStep(sdt);
    powerStep(sdt, ctx);
    humanAPI.fixed(sdt, ctx);
  }, (sdt) => {
    handleContacts(simTime);
    updateExplosions(sdt, ctx);
  });
  if (player.seat && player.seat.dead) getOut();
  if (player.remote && player.remote.dead) { player.remote = null; game.remoteOn = false; setHints(); }

  // move you (after physics so seats are where they are now)
  if (!inXR) updateCamera(dt);

  // part animations, sounds, lights
  const wants = [];
  const active = allActive();
  const seen = new Set();
  for (const p of active) {
    if (p.dead) continue;
    if (p.def.frame) p.def.frame(p, dt, ctx);
    if (p.def.light && p.st.active) wants.push({ pos: partWorld(p, new THREE.Vector3()), color: new THREE.Color(p.props.glow), intensity: p.props.bright * 0.4, range: p.props.range });
    const ln = LOOP_OF[p.def.id];
    if (ln) {
      const lv = p.def.id === 'thruster' ? (p.st.thrust || 0) : p.def.id === 'wheel' ? Math.abs(p.st.level || 0) * 0.5 : (p.st.active ? (p.def.id === 'motor' ? 0.4 : 0.8) : 0);
      if (lv > 0.02) {
        seen.add(p);
        let h = loops.get(p);
        if (!h && loops.size < 10) { h = loop(ln); if (h) loops.set(p, h); }
        if (h) h.set(lv * (p.def.id === 'blackhole' ? 1 : 0.7), partWorld(p, new THREE.Vector3()), p.def.id === 'wheel' ? 0.6 + Math.abs(p.st.level) * 0.6 : 1);
      }
    }
  }
  for (const [p, h] of loops) if (!seen.has(p)) { h.stop(); loops.delete(p); }
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.t -= dt;
    if (f.t <= 0) { flashes.splice(i, 1); continue; }
    wants.push({ pos: f.pos, color: new THREE.Color(1, 0.6, 0.25), intensity: f.power * 30 * f.t, range: 25 + f.power * 0.3 });
  }
  assignLights(wants);
  drawWires();
  humanAPI.frame(dt, ctx);
  updateShards(dt);
  game.fx.update(dt);
  updateSun(player.seat ? worldPos(player.seat, new THREE.Vector3()) : player.pos);
  updateListener(camera);
  if (!wind) wind = ambient('loop_wind');
  if (wind) {
    const sp = player.seat ? toV(player.seat.body.rb.linvel()).length() : Math.hypot(player.push.x, player.push.z) + (player.fly ? 6 : 0);
    wind.set(started ? 0.12 + Math.min(0.6, sp / 60) : 0.05, 500 + Math.min(3000, sp * 60));
  }

  // HUD
  game.hurt = Math.max(0, (game.hurt || 0) - dt * 1.2);
  if (!inXR && started) {
    hurtFlash(game.hurt);
    const st = [];
    if (timeScale === 0) st.push(['warn', 'Time stopped (T)']);
    else if (timeScale < 1) st.push(['warn', 'Slow motion (Y)']);
    if (player.fly && !player.seat) st.push(['', 'Flying']);
    if (game.settings.grid === 0 && T.tool === 'build') st.push(['', 'Grid snap off (G)']);
    if (__AF_DEV__) st.push(['', fps.toFixed(0) + ' fps ' + quality()]);
    status(st);
    if (player.seat) {
      const v = toV(player.seat.body.rb.linvel()).length();
      seatHud(`<big>${Math.round(v * 3.6)} km/h</big>${Math.round(worldPos(player.seat, new THREE.Vector3()).y)} m up`);
    } else seatHud('');
  }
  renderer.render(scene, camera);
  pc.endFrame();
}
function aimNameFor(hit) {
  const o = hit.owner;
  if (!o) return '';
  if (o.kind === 'part') {
    const p = o.ref.rotorBase || o.ref;
    let s = p.def.name;
    if (p.def.seat) s += p.st.rider ? '' : '   E to sit';
    else if (p.def.remote) s += '   E to drive it';
    else if (p.def.use) s += '   E to use';
    if (p.body.frozen) s += '   (frozen)';
    return s;
  }
  if (o.kind === 'human') return o.ref.label();
  return '';
}

function pcControls(dt) {
  const s = game.settings;
  const k = pc.down, h = pc.hit;
  // look around (hold R while grabbing to turn the thing instead)
  const sens = 0.0022 * s.sensitivity;
  if (holdingThing() && k('KeyR')) turnHeld(pc.mouse.dx, pc.mouse.dy);
  else if (player.thirdPerson && player.seat || (player.remote)) {
    player.orbitYaw -= pc.mouse.dx * sens; player.orbitPitch = THREE.MathUtils.clamp(player.orbitPitch + pc.mouse.dy * sens * (s.invertY ? -1 : 1), -0.2, 1.4);
  } else {
    player.yaw -= pc.mouse.dx * sens;
    player.pitch = THREE.MathUtils.clamp(player.pitch - pc.mouse.dy * sens * (s.invertY ? -1 : 1), -1.55, 1.55);
  }
  if (h('Escape')) { /* the browser lets the mouse go: the pause menu opens from that */ }
  if (h('KeyT')) { setTimeScale(timeScale === 0 ? 1 : 0); toast(timeScale === 0 ? 'Time stopped' : 'Time going again'); }
  if (h('KeyY')) { setTimeScale(timeScale === 1 ? 0.25 : 1); toast(timeScale < 1 && timeScale > 0 ? 'Slow motion' : 'Normal speed'); }
  if (player.seat) {
    if (h('KeyF')) getOut();
    if (h('KeyV')) { player.thirdPerson = !player.thirdPerson; player.orbitYaw = player.yaw; }
    return;
  }
  if (player.remote) {
    if (h('KeyE')) game.takeRemote(player.remote);
    movePlayer(dt, { x: 0, z: 0 });
    return;
  }
  for (const t of TOOLS) if (h(t.key)) setTool(t.id);
  if (h('Tab')) openParts(T.tool === 'paint' ? 'Paint' : undefined);
  if (h('KeyG')) { s.grid = s.grid ? 0 : 0.25; saveSettings(); toast(s.grid ? 'Grid snap on' : 'Grid snap off'); }
  if (h('KeyZ')) undo();
  if (h('KeyR') && !holdingThing()) rotate(k('ShiftLeft') || k('ShiftRight'));
  if (h('KeyE')) use();
  if (h('KeyF')) { flashLight.intensity = flashLight.intensity ? 0 : 60; play('button', null, 0.4); }
  if (h('Space')) {
    const now = performance.now();
    if (now - spaceTap < 300) { player.fly = !player.fly; player.vel.y = 0; toast(player.fly ? 'Flying (tap Space twice to land)' : 'Walking'); }
    spaceTap = now;
  }
  if (pc.mouse.wheel) wheel(pc.mouse.wheel);
  if (pc.mouse.leftDown) primary(ray);
  if (pc.mouse.leftUp && holdingThing()) letGo();
  if (pc.mouse.rightDown) secondary(ray);
  movePlayer(dt, {
    x: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), z: (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0),
    jump: k('Space'), up: k('Space'), down: k('KeyC') || k('ControlLeft'), sprint: k('ShiftLeft') || k('ShiftRight')
  });
  document.getElementById('crosshair').classList.toggle('on', !!(T.aim && T.aim.owner && T.aim.owner.kind !== 'ground'));
}
function updateFocus() {
  const showCatch = started && !game.inVR && !menus.isOpen() && !pc.mouse.locked;
  $('clickcatch').hidden = !showCatch;
  game.paused = menus.isOpen();
}

if (__AF_DEV__ || window.__AF_TEST) window.__AF = { game, scene, camera, rig, renderer, player, bodies, T, menus, sun: () => import('./core/render.js'), EXAMPLES, spawnBlueprint: (d) => spawnBlueprint(d), humans: humanAPI, setTimeScale, constructOf, partWorld };
boot().catch((e) => {
  console.error(e);
  $('loadtext').textContent = 'Something went wrong while loading: ' + (e && e.message ? e.message : e);
});
