// SHRINKWORKS: a real kitchen, real objects, glue, wires and parts. Build any gadget with your hands (Quest 3 VR in the
// browser, or mouse + keyboard), shrink yourself, rewind time... Built on the ANYFORGE engine.
import * as THREE from 'three';
import { renderer, scene, camera, rig, setSky, preloadSkies, setQuality, quality, isAuto, autoQualityTick, updateSun, resize,
  assignLights, qualitySettings, onQuality, fps, skyName, sun, setViewScale } from './core/render.js';
import { initPhysics, stepPhysics, setGravity, setTimeScale, timeScale, world, raycast, G, groups, simTime, snapTracked, toV, R, owners } from './core/physics.js';
import { onProgress, track } from './core/assets.js';
import { preloadTextures, setAnisotropy, PAINT, MATS, MAT_ORDER } from './core/mats.js';
import { initAudio, resumeAudio, play, loop, ambient, updateListener, setVolume } from './core/audio.js';
import { buildWorld, START, TOP, ISLAND, ROOM } from './world.js';
import { loadRealModels } from './parts/defs-shrink.js';
import { game, GRAVITY, U } from './game.js';
import { fxTime } from './fx/shaders.js';
import { makeFX } from './fx/particles.js';
import { DEFS, LIST, CATS } from './parts/defs.js';
import { worldPos, worldQuat, worldUp } from './parts/rt.js';
import { bodies, constructOf, destroyBody, serialize, deserialize, partWorld, bodyPose, rebuildPart, removePart, setFrozen,
  blueprintCenter, topo, wires, partsById, newBody, addPart, createJointChild, constructMass } from './build/core.js';
import { powerStep, setController, allActive } from './build/powered.js';
import { hideGhost } from './build/place.js';
import { handleContacts, detonate, updateExplosions, updateShards, shatter } from './build/damage.js';
import { player, initPlayer, movePlayer, updateCamera, sit, standUp, knock, teleportPlayer, respawn, playerCenter, setPlayerScale, playerTick,
  hurtPlayer, playerCapsule, playerHeight } from './player/player.js';
import * as pc from './input/pc.js';
import { T, TOOLS, setTool, pickPart, onToolChange, toolFrame, primary, secondary, wheel, rotate, undo, use, letGo, holdStep,
  turnHeld, drawWires, holdingThing, recordNew } from './tools/tools.js';
import * as menus from './ui/menus.js';
import { buildToolbar, markTool, setHints, aimLabel, toast, status, seatHud, hurtFlash } from './ui/hud.js';
import { makeThumbs, thumbs } from './ui/thumbs.js';
import { humanAPI, initHumans, personThumbMakers } from './people/humans.js';
import { EXAMPLES } from './examples.js';
import { initVR, vrFrame, vrSession, glueStep, clearDots, liftLimit } from './input/vr.js';

const VERSION = typeof __AF_VERSION__ !== 'undefined' ? __AF_VERSION__ : 'dev';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('shrinkworks.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('shrinkworks.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
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
  time: 0, gravity: -98.1, playerPos: new THREE.Vector3(), fx: null,
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
      p.body.rb.applyImpulseAtPoint({ x: dir.x * 400 * dt, y: dir.y * 400 * dt, z: dir.z * 400 * dt }, hit.point, true);
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
  skyTexture: () => scene.background,
  // size ray: does the beam hit you? (distance along the beam, or null)
  rayHitsPlayer(from, dir, max) {
    if (player.seat || player.dead > 0) return null;
    const c = playerCapsule();
    const seg = new THREE.Line3(c.a, c.b);
    // a beam that starts inside you (your own gadget pressed against you) is not aimed at you
    if (seg.closestPointToPoint(from, true, new THREE.Vector3()).distanceTo(from) < c.r) return null;
    const onRay = new THREE.Vector3(), onSeg = new THREE.Vector3();
    const d2 = new THREE.Ray(from, dir).distanceSqToSegment(c.a, c.b, onRay, onSeg);
    if (d2 > c.r * c.r) return null;
    // where the beam reaches you (works for a beam straight down onto you too)
    const t = Math.max(0.01, onSeg.sub(from).dot(dir) - c.r);
    return t <= max ? t : null;
  },
  scalePlayer(f) {
    const ok = setPlayerScale(player.scale * f);
    if (!ok && !game.noRoomT) { toast('No room to grow here'); game.noRoomT = 1.5; }
    if (Math.random() < 0.25) play('field', null, 0.25, f < 1 ? 1.4 : 0.8);
  },
  // size ray on a build: the whole build (every body tied to it) gets bigger / smaller around where the beam hits
  scaleBuild(part, f) {
    const set = constructOf(part.body);
    for (const b of set) for (const p of b.parts) {
      const big = Math.max(p.size.x, p.size.y, p.size.z) * f, small = Math.min(p.size.x, p.size.y, p.size.z) * f;
      if (big > 60 || small < 0.015) return;
    }
    const held = game.heldBodies ? game.heldBodies() : new Set();
    const wasHeld = [...set].some((b) => held.has(b));
    const data = serialize(set);
    const box = blueprintCenter(data), c = box.getCenter(new THREE.Vector3());
    const lin = part.body.rb.linvel();
    for (const b of set) destroyBody(b);
    const made = deserialize(data, { keepIds: true, xf: { origin: c, pos: c, quat: new THREE.Quaternion() }, scale: f });
    for (const b of made) b.rb.setLinvel(lin, true);
    if (wasHeld && game.vrRegrab) game.vrRegrab();
  },
  timeRequest(mode, p) { timeReq = timeReq === 'rewind' ? 'rewind' : mode; timeReqPart = p; }
};
let timeReq = null, timeReqPart = null;
game.partCtx = ctx;
game.meshCtx = ctx;
game.detonate = (p) => detonate(p);

/* ---------------- settings ---------------- */
Object.assign(game.settings, store.get('settings', {}));
function saveSettings() { store.set('settings', game.settings); }
function applySettings() {
  const s = game.settings;
  setGravity(GRAVITY[s.gravity] ?? -98.1);
  ctx.gravity = GRAVITY[s.gravity] ?? -98.1;
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
  const jobs = [preloadTextures(), preloadSkies(), initAudio(), loadRealModels()];
  $('loadtext').textContent = 'Loading the kitchen: real scans, materials and sounds';
  await Promise.all(jobs);
  buildWorld();
  await setSky('day');
  applySettings();
  flashLight = new THREE.SpotLight(0xfff2dd, 0, 45, 0.5, 0.45, 1.6);
  flashLight.castShadow = false;
  camera.add(flashLight, flashLight.target);
  flashLight.target.position.set(0, 0, -1);
  $('loadtext').textContent = 'Taking pictures of the parts';
  await new Promise((r) => setTimeout(r, 30));
  makeThumbs({});
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
  teleportPlayer(START);
  player.yaw = 0; player.pitch = -0.42;
  const hasAuto = !!store.get('auto', null);
  menus.open({
    id: 'title', logo: true, cls: 'title', noBack: true,
    sub: 'A real kitchen. Real objects, glue, wires, motors, batteries, a size ray, a time core. Build any gadget with your hands, then shrink yourself and use it.',
    items: () => [
      vrSession.supported ? { type: 'button', label: hasAuto ? 'Keep building in VR' : 'Play in VR', value: 'Quest 3', on: () => { start(hasAuto, true); } } : null,
      { type: 'button', label: hasAuto ? 'Keep building' : (vrSession.supported ? 'Play on this screen' : 'Start building'), on: () => start(hasAuto) },
      hasAuto ? { type: 'button', label: 'Fresh kitchen', value: 'starter parts on the island', on: () => start(false, vrSession.supported && game.lastVR) } : null,
      { type: 'button', label: 'Examples', on: openExamples },
      { type: 'button', label: 'Settings', on: openSettings },
      { type: 'button', label: 'Controls', on: openControls }
    ]
  });
  const ver = document.createElement('div');
  ver.className = 'version'; ver.id = 'ver'; ver.textContent = 'SHRINKWORKS ' + VERSION;
  if (!$('ver')) document.body.appendChild(ver);
}
function start(load, vr = false) {
  resumeAudio();
  menus.closeAll();
  started = true;
  $('hud').hidden = false;
  if ($('ver')) $('ver').remove();
  const a = load ? store.get('auto', null) : null;
  if (a) loadWorld(a); else starterKit();
  if (vr) { game.lastVR = true; vrSession.enter(); return; }
  pc.lockMouse();
  updateFocus();
  toast('Tab opens all the parts. 1-8 pick a tool. [ and ] shrink and grow you.', 5000);
}
// a fresh kitchen: real food and tools around, and the starter parts laid out on the island in front of you
function starterKit() {
  clearWorld();
  const put = (type, x, z, o = {}) => {
    const d = DEFS[type];
    if (!d) return null;
    const q = o.q || new THREE.Quaternion();
    const hy = o.lie ? Math.min(...d.size) / 2 : d.size[1] / 2;
    const b = newBody(new THREE.Vector3(x, (o.y ?? TOP) + hy + 0.03, z), q);
    const p = addPart(b, type, o.props ? { props: o.props } : {});
    if (d.joint) createJointChild(p);
    return p;
  };
  const lie = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const lieX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const I = ISLAND, front = I.z + I.d / 2 - 1.6;
  // the tools, right in front of you
  put('tool_glue', -3.2, front, { q: lie, lie: true });
  put('tool_wire', -1.6, front);
  put('tool_cutter', 0.2, front, { lie: true, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2) });
  put('tool_paint', 1.8, front, { q: lie, lie: true });
  put('battery_inf', 3.2, front);
  // a few parts to start a gadget with
  put('handle', -3.4, front - 2.4);
  put('size_ray', -1.9, front - 2.4, { q: lie, lie: true });
  put('battery_aa', -0.6, front - 2.4, { q: lieX, lie: true });
  put('button', 0.6, front - 2.4);
  put('motor', 2.0, front - 2.4);
  put('wheel', 3.5, front - 2.4);
  put('block', 5.2, front - 1.0, {});
  put('time_core', -5.6, front - 1.0);
  // real things around the kitchen
  put('real_wooden_cutting_board', 6.5, I.z - 1.2);
  put('real_croissant', 6.5, I.z - 1.2, { y: TOP + 0.25 });
  put('real_food_apple_01', -7.5, I.z - 2);
  put('real_lemon', -6.2, I.z - 2.6);
  put('real_magnifying_glass_01', -8.2, I.z + 1.6, { lie: true });
  put('real_wooden_bowl_01', -20, ROOM.z0 + 3.2);
  put('real_food_avocado_01', -20, ROOM.z0 + 3.2, { y: TOP + 0.6 });
  put('real_bananas', -24, ROOM.z0 + 3.4);
  put('real_brass_pan_01', 12.6, ROOM.z0 + 3.2, { y: TOP + 0.1 });
  put('real_jug_01', 19, ROOM.z0 + 3);
  put('real_drill_01', ROOM.x0 + 3.2, -12);
  put('real_measuring_tape_01', ROOM.x0 + 3.2, -8);
  put('real_screwdriver', ROOM.x0 + 3.4, -5, { lie: true });
  put('real_adjustable_wrench', ROOM.x0 + 3.2, -2.5, { lie: true });
  put('real_retro_multimeter', ROOM.x0 + 3.2, 2);
  put('real_lightbulb_01', ROOM.x0 + 3.0, 5.5);
  put('real_cardboard_box_01', 16, 14, { y: 0 });
  put('real_wooden_crate_01', 22, 18, { y: 0 });
}
// drop a blueprint onto whatever surface is in front of you (island, counter or floor)
function surfaceInFront(dist) {
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  if (game.inVR) { camera.getWorldDirection(f); f.y = 0; f.normalize(); }
  const head = camera.getWorldPosition(new THREE.Vector3());
  const at = new THREE.Vector3(head.x, 0, head.z).addScaledVector(f, dist);
  at.x = THREE.MathUtils.clamp(at.x, ROOM.x0 + 2, ROOM.x1 - 2); at.z = THREE.MathUtils.clamp(at.z, ROOM.z0 + 2, ROOM.z1 - 2);
  const hit = raycast(new THREE.Vector3(at.x, Math.max(head.y, TOP + 1), at.z), new THREE.Vector3(0, -1, 0), 60, { groups: groups(G.WORLD, G.WORLD) });
  at.y = hit ? hit.point.y : 0;
  return { at, f };
}
// a flat, open spot for a build of this size in front of you (it checks the whole footprint, not just the middle, so
// nothing spawns half inside the island or hanging off the counter edge)
function findSpot(size, big) {
  const head = camera.getWorldPosition(new THREE.Vector3());
  const look = new THREE.Vector3();
  if (game.inVR) camera.getWorldDirection(look); else look.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  look.y = 0; look.normalize();
  const baseYaw = Math.atan2(-look.x, -look.z);
  const half = Math.hypot(size.x, size.z) / 2;
  const near = Math.max(2.5 * player.scale, half + 2.2 * player.scale);
  let best = null;
  for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) for (const extra of [0, 3, 7, 12]) {
    const yaw = baseYaw + turn;
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const at = new THREE.Vector3(head.x, 0, head.z).addScaledVector(f, near + extra * Math.max(0.3, player.scale));
    if (at.x - half < ROOM.x0 + 0.5 || at.x + half > ROOM.x1 - 0.5 || at.z - half < ROOM.z0 + 0.5 || at.z + half > ROOM.z1 - 0.5) continue;
    let lo = Infinity, hi = -Infinity;
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) {
      const p = new THREE.Vector3(sx * size.x / 2, 0, sz * size.z / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(at);
      const hit = raycast(new THREE.Vector3(p.x, ROOM.h - 0.5, p.z), new THREE.Vector3(0, -1, 0), ROOM.h, { groups: groups(G.WORLD, G.WORLD | G.PARTS) });
      const y = hit ? hit.point.y : 0;
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    // flat beats bumpy, close beats far, straight ahead beats turned; big frozen things want the floor
    const score = (hi - lo) * 10 + extra * 0.3 + Math.abs(turn) * 2 + (big ? hi : 0);
    if (!best || score < best.score) best = { score, pos: new THREE.Vector3(at.x, hi, at.z), yaw };
  }
  if (!best) { const { at } = surfaceInFront(near); best = { pos: at, yaw: baseYaw }; }
  return best;
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
  return n + ' parts in the kitchen';
}
function confirmBox(title, sub, yes, fn) {
  menus.open({ id: 'confirm', title, sub, items: () => [{ type: 'row', buttons: [{ label: 'Cancel', on: () => menus.close() }, { label: yes, primary: true, on: () => { menus.close(); fn(); } }] }] });
}

let partsTab = 'Tools';
function openParts(tab) {
  if (tab) partsTab = tab;
  menus.open({
    id: 'parts', title: 'Parts', wide: true,
    items: () => {
      const items = [{ type: 'tabs', tabs: [...CATS.map((c) => [c, c]), ...(game.inVR ? [['More', 'More']] : [['Paint', 'Paint']])], get: () => partsTab, set: (v) => { partsTab = v; } }];
      if (partsTab === 'More') {
        items.push({ type: 'button', label: 'Examples', value: 'ready-made gadgets', on: openExamples });
        items.push({ type: 'button', label: 'Save and load', on: openSaves });
        items.push({ type: 'button', label: 'Settings', on: openSettings });
        items.push({ type: 'button', label: 'Controls', on: openControls });
        items.push({ type: 'button', label: 'Fresh kitchen', on: () => confirmBox('Start over?', 'Everything you built goes away and the starter parts come back.', 'Start over', () => { starterKit(); menus.closeAll(); resume(); }) });
        items.push({ type: 'button', label: 'Leave VR', on: () => { const s = renderer.xr.getSession(); if (s) s.end(); } });
        return items;
      }
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
          on: () => {
            if (game.inVR) { resume(); game.spawnInHand(d.id, game.menuHand); toast(d.name); return; }
            pickPart(d.id); resume(); toast(d.name + ': ' + d.desc, 4500);
          }
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
      { type: 'slider', label: 'Field of view', min: 55, max: 100, step: 1, get: () => s.fov, set: set('fov') },
      { type: 'heading', text: 'World' },
      { type: 'choice', label: 'Gravity', options: [['earth', 'Earth'], ['moon', 'Moon'], ['mars', 'Mars'], ['low', 'Low'], ['zero', 'None'], ['heavy', 'Heavy']], get: () => s.gravity, set: set('gravity') },
      { type: 'toggle', label: 'Things break in big crashes', get: () => s.breaking, set: set('breaking') },
      { type: 'toggle', label: 'You get hurt (falls, things hitting you)', get: () => s.damage, set: set('damage') },
      { type: 'choice', label: 'Snap to grid (PC Build tool)', options: [[0.125, 'Fine'], [0.25, 'Normal'], [0.5, 'Big'], [0, 'Off']], get: () => s.grid, set: set('grid') },
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
      { type: 'keys', rows: [['W A S D', 'Walk'], ['Shift', 'Run'], ['Space', 'Jump (tap twice to fly)'], ['Space / C', 'Fly up / down'], ['[ / ]', 'Shrink / grow you'], ['F', 'Flashlight'], ['T', 'Stop time / start time'], ['Y', 'Slow motion']] },
      { type: 'heading', text: 'Building' },
      { type: 'keys', rows: [['1 - 8', 'Tools: Build, Grab, Edit, Paint, Wire, Delete, Hand, Size'], ['Tab', 'All parts'], ['Click / Right click', 'Use the tool / its second action'], ['Mouse wheel', 'Part size (Build), side size (Edit), distance (Grab)'], ['R / Shift + R', 'Turn the part'], ['G', 'Grid snap on / off'], ['Z', 'Undo'], ['E', 'Use: sit, press, flip, take the remote']] },
      { type: 'heading', text: 'In a seat' },
      { type: 'keys', rows: [['W / S', 'Wheels forward / back, thrusters that push forward'], ['A / D', 'Turn'], ['Space / C', 'Up / down thrusters'], ['Arrows Up / Down', 'Tilt (with a Gyro)'], ['Q / E', 'Roll (with a Gyro)'], ['1 2 3 4', 'Pistons, motors, sci-fi parts, beams'], ['X', 'Explosives'], ['L', 'Lights'], ['H', 'Horn'], ['V', 'Inside / outside camera'], ['F', 'Get out']] },
      { type: 'heading', text: 'VR (Quest 3)' },
      { type: 'keys', rows: [['Grip', 'Grab anything. Let go: it drops (throw it like real)'], ['Trigger (holding)', 'Use it: glue, wire, cut, spray, fire your gadget'],
        ['Trigger (empty hand)', 'Jetpack'], ['A / X (holding)', 'It stays in the air when you let go'], ['B / Y (holding)', 'Its menu: size, color, settings, save, delete'],
        ['Y', 'Spawn parts (straight into your hand)'], ['B', 'Undo'], ['A', 'Sit / use what you touch or point at'], ['Left stick', 'Walk (click = run)'],
        ['Right stick', 'Left / right: turn. Down / up: shrink / grow you'], ['Right stick click', 'Back to normal size'], ['Poke', 'Press buttons and switches with your finger']] },
      { type: 'heading', text: 'Building' },
      { type: 'keys', rows: [['Glue', 'Squeeze a drop on a part, push another part onto it'], ['Wire spool', 'Touch a button / switch / sensor, then what it should run'],
        ['Pliers', 'Unglue a part or cut a wire'], ['Batteries', 'Motors, lights and rays need one glued on'], ['Grip Handle', 'Glue it on: hold the build like a gadget, trigger fires it']] }
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
    const sl = (label, k) => ({ type: 'slider', label, min: 0.05, max: 12, step: 0.05, get: () => s(k), set: (v) => resizeTo(k, v), fmt: (v) => (v * 10).toFixed(1).replace(/\.0$/, '') + ' cm' });
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
      d.real ? null : { type: 'choice', label: 'Material', options: MAT_ORDER.map((k) => [k, MATS[k].name]), get: () => p.mat, set: (v) => { p.mat = v; p.color = null; rebuildPart(p); p.body.metaDirty = true; } },
      d.noPaint ? null : { type: 'swatches', label: 'Paint', colors: PAINT, get: () => p.color || MATS[p.mat].color, set: (v) => { p.color = v; rebuildPart(p); } },
      { type: 'note', text: 'Weight of the whole build: ' + weightText(constructMass(constructOf(p.body))) + (game.inVR ? '. You can lift ' + weightText(liftLimit()) + ' at your size.' : '') },
      { type: 'heading', text: 'This build' },
      { type: 'toggle', label: 'Frozen in place', get: () => p.body.frozen, set: (v) => { for (const b of constructOf(p.body)) setFrozen(b, v); } },
      { type: 'row', buttons: [
        { label: 'Save as my gadget', on: () => saveBlueprint(p) },
        { label: 'Copy the build', on: () => { duplicateBuild(p); resume(); } },
        { label: 'Delete part', on: () => { removePart(p); menus.close(); } },
        { label: 'Delete build', on: () => { for (const b of [...constructOf(p.body)]) destroyBody(b); menus.close(); } },
        { label: 'Done', primary: true, on: () => resume() }
      ] }
    ]
  });
};

function weightText(m) {
  const kg = m / 1000; // game mass is per cubic unit (10 cm): 1000 of it = 1 kg
  return kg >= 1 ? kg.toFixed(1) + ' kg' : kg >= 0.001 ? Math.round(kg * 1000) + ' g' : (kg * 1e6).toFixed(0) + ' mg';
}
function duplicateBuild(p) {
  const data = serialize(constructOf(p.body));
  const box = blueprintCenter(data), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const off = new THREE.Vector3(sz.x + 0.6, 0.4, 0);
  const made = deserialize(data, { xf: { origin: c, pos: c.clone().add(off), quat: new THREE.Quaternion() } });
  recordNew(made);
  play('attach', c, 0.6);
}
/* ---------------- saving ---------------- */
function worldData() {
  return { v: 1, game: 'SHRINKWORKS', when: Date.now(), builds: serialize(new Set(bodies)), size: player.scale };
}
function clearWorld() {
  if (player.seat) standUp();
  player.remote = null; game.remoteOn = false;
  letGo();
  if (game.vrDropAll) game.vrDropAll();
  clearDots();
  for (const b of [...bodies]) destroyBody(b);
  game.fx.clearStains();
}
function loadWorld(d) {
  try {
    clearWorld();
    if (d.builds) deserialize(d.builds, { keepIds: true });
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
  a.download = 'my-kitchen-' + new Date().toISOString().slice(0, 10) + '.shrinkworks';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Saved to your Downloads');
}
function openFile() {
  const f = $('filein').files[0];
  if (!f) return;
  f.text().then((t) => {
    const d = JSON.parse(t);
    if ((d.game === 'SHRINKWORKS' || d.game === 'ANYFORGE') && d.builds) { loadWorld(d); resume(); toast('Opened ' + f.name); }
    else if (d.bodies) { spawnBlueprint(d); resume(); }
    else toast('That is not a SHRINKWORKS file');
  }).catch(() => toast('That file could not be read'));
  $('filein').value = '';
}
function saveBlueprint(p) {
  const mine = store.get('mybuilds', []);
  const data = serialize(constructOf(p.body));
  mine.unshift({ name: 'Gadget ' + (mine.length + 1) + ' (' + p.def.name + ')', when: Date.now(), data });
  if (!store.set('mybuilds', mine.slice(0, 30))) toast('Not enough room in the browser');
  else toast('Saved: Examples, My gadgets');
}
let exTab = 'examples';
function openExamples() {
  menus.open({
    id: 'examples', title: 'Examples', wide: true, sub: 'Ready-made gadgets made from the same parts you have. They appear in front of you: take them apart, change them, make them better.',
    items: () => {
      const mine = store.get('mybuilds', []);
      const items = [{ type: 'tabs', tabs: [['examples', 'Examples'], ['mine', 'My gadgets']], get: () => exTab, set: (v) => { exTab = v; } }];
      if (exTab === 'examples') {
        for (const ex of EXAMPLES) items.push({ type: 'button', label: ex.name, value: ex.desc, on: () => { if (!started) start(false); spawnBlueprint(ex.make()); resume(); } });
      } else if (!mine.length) items.push({ type: 'note', text: 'Nothing yet. Open any part\'s menu (VR: B / Y while holding it, PC: Edit tool) and press "Save as my gadget".' });
      else mine.forEach((m, i) => items.push({ type: 'button', label: m.name, value: new Date(m.when).toLocaleDateString(), on: () => { if (!started) start(false); spawnBlueprint(m.data); resume(); } }));
      return items;
    }
  });
}
function spawnBlueprint(data) {
  const box = blueprintCenter(data);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const { pos, yaw } = findSpot(size, data.frozen);
  pos.y += (c.y - box.min.y) + 0.05;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const made = deserialize(data, { xf: { origin: c, pos, quat: q } });
  if (data.frozen) for (const b of made) setFrozen(b, true);
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
  getOut, ctx,
  openParts: () => openParts(),
  openEditor: (p) => game.openEditor(p)
};
function titleOrPause() { if (started) openPause(); }

/* ---------------- each frame ---------------- */
const timer = new THREE.Timer();
const ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
let spaceTap = 0, flyToggleT = 0;
const loops = new Map();
const LOOP_OF = { thruster: 'loop_thrust', blackhole: 'loop_hole', forcefield: 'loop_beam', tractor: 'loop_beam', motor: 'loop_motor', wheel: 'loop_motor', size_ray: 'loop_beam', time_core: 'loop_hole' };
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

/* ---------------- time: rewind history, slow motion, stopped time ---------------- */
const hist = [];          // snapshots: { list: [body], data: Float32Array(13 per body) }
const HIST_MAX = 450;     // 15 seconds at 30 a second
let histTick = 0, userTime = 1, rewinding = false;
function recordHistory() {
  if (++histTick % 2) return;
  const list = [...bodies].filter((b) => !b.frozen);
  const data = new Float32Array(list.length * 13);
  list.forEach((b, i) => {
    const t = b.rb.translation(), r = b.rb.rotation(), v = b.rb.linvel(), w = b.rb.angvel(), o = i * 13;
    data[o] = t.x; data[o + 1] = t.y; data[o + 2] = t.z; data[o + 3] = r.x; data[o + 4] = r.y; data[o + 5] = r.z; data[o + 6] = r.w;
    data[o + 7] = v.x; data[o + 8] = v.y; data[o + 9] = v.z; data[o + 10] = w.x; data[o + 11] = w.y; data[o + 12] = w.z;
  });
  hist.push({ list, data });
  if (hist.length > HIST_MAX) hist.shift();
}
function rewindStep(skip) {
  const keep = new Set(game.heldBodies ? game.heldBodies() : []);
  if (timeReqPart && !timeReqPart.dead) for (const b of constructOf(timeReqPart.body)) keep.add(b);
  let snap = null;
  for (let i = 0; i < 2 && hist.length > 1; i++) snap = hist.pop();
  if (!snap) snap = hist[hist.length - 1];
  if (!snap) return;
  snap.list.forEach((b, i) => {
    if (!bodies.has(b) || keep.has(b) || b.frozen) return;
    const d = snap.data, o = i * 13;
    b.rb.setTranslation({ x: d[o], y: d[o + 1], z: d[o + 2] }, false);
    b.rb.setRotation({ x: d[o + 3], y: d[o + 4], z: d[o + 5], w: d[o + 6] }, false);
    b.rb.setLinvel({ x: d[o + 7], y: d[o + 8], z: d[o + 9] }, false);
    b.rb.setAngvel({ x: d[o + 10], y: d[o + 11], z: d[o + 12] }, false);
    game.snapBody(b);
  });
}

/* ---------------- tiny you gets hurt: things that hit you hit hard ---------------- */
const hitCool = new Map();
function hitsOnPlayer(sdt) {
  if (!game.settings.damage || player.seat || player.dead > 0) return;
  const s = player.scale, myMass = 75000 * s * s * s;
  const c = playerCenter();
  const now = simTime;
  const held = game.heldBodies ? game.heldBodies() : new Set();
  world.contactPairsWith(player.collider, (other) => {
    const o = owners.get(other.handle);
    if (!o || o.kind !== 'part') return;
    const b = o.ref.body;
    if (held.has(b)) return;
    const set = constructOf(b);
    const ratio = constructMass(set) / myMass;
    if (ratio < 0.15) return;
    const v = b.rb.velocityAtPoint({ x: c.x, y: c.y, z: c.z });
    const rel = Math.hypot(v.x, v.y - player.vel.y, v.z) / U; // real m/s
    if (rel > 1.6 && (hitCool.get(b) || 0) < now) {
      hitCool.set(b, now + 0.5);
      hurtPlayer(rel * Math.min(ratio, 10) * 3.2, 'hit');
      knock(new THREE.Vector3(v.x, Math.abs(v.y) * 0.3 + 2 * s, v.z).multiplyScalar(0.6 * Math.min(1, ratio)));
    } else if (ratio > 40 && b.rb.translation().y > c.y) hurtPlayer(sdt * 35, 'hit'); // something heavy sitting on you
  });
}

function frame(t, xrFrame) {
  game.frameN = (game.frameN || 0) + 1;
  timer.update(t);
  const dt = Math.min(timer.getDelta(), 0.1);
  fxTime.value += dt;
  ctx.time = simTime;
  autoQualityTick(dt);
  const inXR = renderer.xr.isPresenting;
  const playing = started && !menus.isOpen();
  game.input.shift = pc.down('ShiftLeft') || pc.down('ShiftRight');

  // time cores asked for something during the last steps
  const req = timeReq; timeReq = null;
  rewinding = req === 'rewind' && hist.length > 1;
  setTimeScale(req === 'stop' || rewinding ? 0 : req === 'slow' ? 0.25 : userTime);
  if (rewinding) rewindStep();
  game.timeMode = rewinding ? 'rewind' : req;

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
  if (!playing || player.seat || player.remote || inXR) hideGhost();
  document.getElementById('toolbar').hidden = !!(player.seat || player.remote);
  if (playing && !player.seat && !player.remote && !inXR) {
    toolFrame(ray, dt);
    aimLabel(T.tool === 'build' ? '' : (T.aim ? aimNameFor(T.aim) : ''));
  } else if (!inXR) aimLabel('');
  if (!playing || player.seat) { if (!inXR) document.getElementById('crosshair').classList.remove('on'); }

  // physics
  ctx.playerPos.copy(playerCenter());
  const control = (sdt) => {
    if (seatIn && (player.seat || player.remote)) {
      const ref = player.seat || player.remote;
      if (!ref.dead) setController(ref, { ...seatIn, edges: pendingEdges });
      pendingEdges = new Set();
    }
    if (inXR && game.vrHoldStep) game.vrHoldStep(sdt, ctx.gravity);
    else if (sdt > 0) holdStep(sdt);
    powerStep(sdt, ctx);
  };
  const steps = stepPhysics(dt, control, (sdt) => {
    handleContacts(simTime);
    updateExplosions(sdt, ctx);
    glueStep();
    hitsOnPlayer(sdt);
    recordHistory();
  });
  // time stopped / rewinding: you still move, your hands still hold, switches and cores still listen
  if (!steps) { control(0); glueStep(); }
  if (player.seat && player.seat.dead) getOut();
  if (player.remote && player.remote.dead) { player.remote = null; game.remoteOn = false; setHints(); }
  playerTick(dt);

  // move you (after physics so seats are where they are now)
  if (!inXR || player.seat) updateCamera(dt);

  // part animations, sounds, lights
  const wants = [];
  const active = allActive();
  const seen = new Set();
  for (const p of active) {
    if (p.dead) continue;
    if (p.def.frame) p.def.frame(p, dt, ctx);
    if (p.def.light && p.st.active) wants.push({ pos: partWorld(p, new THREE.Vector3()), color: new THREE.Color(p.props.glow), intensity: p.props.bright * 4, range: p.props.range });
    const ln = LOOP_OF[p.def.id];
    if (ln) {
      const lv = p.def.id === 'thruster' ? (p.st.thrust || 0) : p.def.id === 'wheel' ? Math.abs(p.st.level || 0) * 0.5 : (p.st.active ? (p.def.id === 'motor' ? 0.4 : 0.8) : 0);
      if (lv > 0.02) {
        seen.add(p);
        let h = loops.get(p);
        if (!h && loops.size < 10) { h = loop(ln); if (h) loops.set(p, h); }
        if (h) h.set(lv * (p.def.id === 'blackhole' ? 1 : 0.7), partWorld(p, new THREE.Vector3()), p.def.id === 'wheel' ? 0.6 + Math.abs(p.st.level) * 0.6 : p.def.id === 'size_ray' ? (p.props.mode === 'grow' ? 1.3 : 0.7) : p.def.id === 'time_core' ? (rewinding ? 0.6 : 1.4) : 1);
      }
    }
  }
  for (const [p, h] of loops) if (!seen.has(p)) { h.stop(); loops.delete(p); }
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.t -= dt;
    if (f.t <= 0) { flashes.splice(i, 1); continue; }
    wants.push({ pos: f.pos, color: new THREE.Color(1, 0.6, 0.25), intensity: f.power * 300 * f.t, range: 25 + f.power * 0.3 });
  }
  setViewScale(inXR ? rig.scale.x : 1);
  assignLights(wants);
  drawWires();
  updateShards(dt);
  game.fx.update(dt);
  updateSun(player.seat ? worldPos(player.seat, new THREE.Vector3()) : playerCenter(), player.scale);
  updateListener(camera);
  renderFeeds(active);

  // HUD
  game.hurt = Math.max(0, (game.hurt || 0) - dt * 1.2);
  if (!inXR && started) {
    hurtFlash(Math.max(game.hurt, player.dead > 0 ? 1 : 0));
    const st = [];
    const hm = playerHeight() / U;
    st.push(['', 'You: ' + (hm >= 1 ? hm.toFixed(2) + ' m' : hm >= 0.1 ? Math.round(hm * 100) + ' cm' : (hm * 100).toFixed(1) + ' cm') + '   Health ' + Math.round(player.hp)]);
    if (rewinding) st.push(['warn', 'Rewinding time']);
    else if (timeScale === 0) st.push(['warn', 'Time stopped' + (req ? '' : ' (T)')]);
    else if (timeScale < 1) st.push(['warn', 'Slow motion' + (req ? '' : ' (Y)')]);
    if (player.fly && !player.seat) st.push(['', 'Flying']);
    if (__AF_DEV__) st.push(['', fps.toFixed(0) + ' fps ' + quality()]);
    status(st);
    if (player.seat) {
      const v = toV(player.seat.body.rb.linvel()).length() / U;
      seatHud(`<big>${Math.round(v * 3.6)} km/h</big>`);
    } else seatHud('');
  }
  renderer.render(scene, camera);
  pc.endFrame();
}

/* ---------------- cameras + screens: live picture, rendered small and cheap ---------------- */
const feeds = new Map(); // channel -> { rt, cam }
let feedTurn = 0;
function renderFeeds(active) {
  const cams = {}, screens = {};
  for (const p of active) {
    if (p.dead || !p.st.active) continue;
    if (p.def.camera) cams[p.props.channel] = p;
    if (p.def.screen) (screens[p.props.channel] = screens[p.props.channel] || []).push(p);
  }
  for (const p of active) if (p.def.screen && p.mesh && p.mesh.userData.face) {
    const m = p.mesh.userData.face.material, on = p.st.active && cams[p.props.channel];
    if (!on && m.map) { m.map = null; m.color.set(0x050607); m.needsUpdate = true; }
  }
  const chans = Object.keys(screens).filter((c) => cams[c]);
  if (!chans.length) return;
  const c = chans[feedTurn++ % chans.length];
  let f = feeds.get(c);
  if (!f) { f = { rt: new THREE.WebGLRenderTarget(320, 200), cam: new THREE.PerspectiveCamera(68, 1.6, 0.02, 300) }; feeds.set(c, f); }
  const cp = cams[c];
  const k = cp.size.x / 0.5;
  worldPos(cp, f.cam.position, new THREE.Vector3(0, 0, -0.25 * k));
  worldQuat(cp, f.cam.quaternion);
  f.cam.near = 0.01 * k; f.cam.updateProjectionMatrix();
  f.cam.updateMatrixWorld();
  for (const s of screens[c]) {
    const m = s.mesh.userData.face.material;
    if (m.map !== f.rt.texture) { m.map = f.rt.texture; m.color.set(0xffffff); m.needsUpdate = true; }
    s.mesh.visible = false; // a screen does not film itself
  }
  const xrOn = renderer.xr.enabled, prev = renderer.getRenderTarget(), autoSh = renderer.shadowMap.autoUpdate;
  renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(f.rt);
  renderer.render(scene, f.cam);
  renderer.setRenderTarget(prev);
  renderer.xr.enabled = xrOn; renderer.shadowMap.autoUpdate = autoSh;
  for (const s of screens[c]) s.mesh.visible = true;
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
  if (h('KeyT')) { userTime = userTime === 0 ? 1 : 0; toast(userTime === 0 ? 'Time stopped' : 'Time going again'); }
  if (h('KeyY')) { userTime = userTime === 1 ? 0.25 : 1; toast(userTime < 1 && userTime > 0 ? 'Slow motion' : 'Normal speed'); }
  if (k('BracketLeft') || k('Minus')) setPlayerScale(player.scale * Math.exp(-1.1 * dt));
  if (k('BracketRight') || k('Equal')) { if (!setPlayerScale(player.scale * Math.exp(1.1 * dt)) && !game.noRoomT) { toast('No room to grow here'); game.noRoomT = 1.5; } }
  game.noRoomT = Math.max(0, (game.noRoomT || 0) - dt);
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
  if (player.dead > 0) { movePlayer(dt, { x: 0, z: 0 }); return; }
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

game.noPower = (p) => { const now = performance.now(); if (now - (game.noPowerT || 0) > 4000) { game.noPowerT = now; toast(p.def.name + ' has no power: glue a battery onto the build'); } };
if (__AF_DEV__ || window.__AF_TEST) window.__AF = { game, scene, camera, rig, renderer, player, bodies, T, menus, sun: () => import('./core/render.js'), EXAMPLES, spawnBlueprint: (d) => spawnBlueprint(d), setTimeScale, constructOf, partWorld, partsById, setPlayerScale, starterKit: () => starterKit(), DEFS, world, R: () => R, hist, teleportPlayer };
boot().catch((e) => {
  console.error(e);
  $('loadtext').textContent = 'Something went wrong while loading: ' + (e && e.message ? e.message : e);
});
