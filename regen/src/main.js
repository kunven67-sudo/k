// REGEN: you heal from anything. Spawn weapons, real animals, dinosaurs and monsters in an open field.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Audio } from './audio.js';
import { FX } from './fx.js';
import { Physics } from './physics.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { loadLayerTextures, LIMBS } from './body.js';
import { CreatureTypes, Creature } from './creatures.js';
import { ItemTypes, Item } from './items.js';
import { CREATURES, WEAPONS, PROPS, GROUPS } from './catalog.js';
import { CREDITS } from './credits.js';

const $ = s => document.querySelector(s);
const GS = window.GS3Console;
// ---------- settings (remembered on this PC)
const DEF = { quality: 'auto', blood: 'max', regen: 1, sens: 1, fov: 75, vol: 0.8, invert: false, view: 'first' };
let S = { ...DEF };
const TEST = /[?&]test/.test(location.search);
try { S = { ...DEF, ...JSON.parse(localStorage.getItem('regen.settings') || '{}') }; } catch (e) { /* private window */ }
if (TEST) { S.quality = 'low'; }
const save = () => { try { localStorage.setItem('regen.settings', JSON.stringify(S)); } catch (e) { /* ignore */ } };
const presets = GS && window.GameSystem && window.GameSystem.console && window.GameSystem.console.presets;
if (presets && presets.invertY === true) S.invert = true;

// ---------- renderer
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = !TEST; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(S.fov, innerWidth / innerHeight, 0.03, 700);
let renderScale = 1;
const QUAL = { low: [0.7, 1024], medium: [0.9, 1024], high: [1, 2048], ultra: [Math.min(2, devicePixelRatio), 4096] };
function applyQuality() {
  const q = S.quality === 'auto' ? autoQ : S.quality;
  renderScale = QUAL[q][0]; renderer.setPixelRatio(renderScale); renderer.setSize(innerWidth, innerHeight, false);
  if (W.sun && W.sun.shadow.mapSize.x !== QUAL[q][1]) { W.sun.shadow.mapSize.set(QUAL[q][1], QUAL[q][1]); if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; } }
}
let autoQ = 'medium';
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); applyQuality(); });

// ---------- loading
const manager = new THREE.LoadingManager();
manager.onProgress = (u, a, b) => { $('#loading .bar div').style.width = (a / Math.max(b, 1) * 100).toFixed(0) + '%'; };
const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
const audio = new Audio(); audio.setVolume(S.vol);
const physics = new Physics();
const fx = new FX(scene, audio);
const W = { scene, physics, fx, audio, creatures: [], items: [], player: null, sun: null, shake: v => { fx.shake = Math.max(fx.shake, v); } };
window.REGEN = W; // for tests
const ctypes = new CreatureTypes(loader), itypes = new ItemTypes(loader);

let slowT = 0, player, inv = [], cur = -1, mood = 'hunt', running = false, paused = true;
async function boot() {
  const env = await buildWorld(scene, renderer, loader, physics, S.quality === 'low' ? 'low' : 'high');
  W.sun = env.sun;
  const layers = loadLayerTextures();
  const [pg, ag] = await Promise.all([loader.loadAsync('assets/models/player.glb'), loader.loadAsync('assets/models/anims.glb')]);
  player = new Player(pg, ag, layers, { scene, camera, physics, fx, audio });
  W.player = player; player.view = S.view; player.body.regenRate = S.regen;
  player.group.position.set(0, 0, 0); player.radius = 0.35;
  player.onFall = v => { const n = v > 20 ? 2 : 1; for (const k of (Math.random() < 0.5 ? ['lLeg', 'rLeg'] : ['rLeg', 'lLeg']).slice(0, n)) player.body.sever(k, 'lower', new THREE.Vector3(0, -1, 0)); toast('Bad landing'); };
  player.body.onSever = k => {
    slowT = 0.5; hurtFlash = 1;
    // the hand that held it is gone: the weapon falls on the ground, pick it up again with E
    const it = k === 'rArm' ? player.weapon : k === 'lArm' ? player.shield : null;
    if (it) { const i = inv.indexOf(it); if (i >= 0) inv.splice(i, 1); it.drop(it.obj.position.clone(), player.vel.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2))); W.items.includes(it) || W.items.push(it); equip(-1); }
  };
  player.body.onRegrown = k => { trophy('regen1'); toast(LIMBS[k].name[0].toUpperCase() + LIMBS[k].name.slice(1) + ' grew back'); };
  fx.bloodAmount = S.blood === 'off' ? 0 : S.blood === 'some' ? 0.4 : 1;
  applyQuality();
  await audio.init().catch(() => {});
  // warm up the shaders so the first frames don't stutter
  player.placeCamera(camera); renderer.compile(scene, camera);
  // start with a katana in hand
  await giveWeapon('katana');
  ctypes.get('wolf'); // preload the first creature in the menu
  $('#loading .tip').textContent = 'Ready';
  const b = $('#start'); b.style.display = 'block'; b.onclick = start; b.focus();
  GS && GS.nav && GS.nav($('#loading'), {});
  W.ready = true;
}
function start() {
  $('#loading').style.display = 'none'; audio.resume(); running = true; paused = false; lock();
}
boot().catch(e => { $('#loading .tip').textContent = 'Could not load: ' + e.message; console.error(e); });

// ---------- trophies (inside Game System 3)
const TROPHIES = [
  { id: 'regen1', name: 'Grows Back', desc: 'Grow back a lost limb.', grade: 'bronze' },
  { id: 'nolimbs', name: 'Nothing Left', desc: 'Lose both arms and both legs at once.', grade: 'gold' },
  { id: 'trex', name: 'Bad Idea', desc: 'Spawn a Tyrannosaurus Rex.', grade: 'bronze' },
  { id: 'kill10', name: 'Food Chain', desc: 'Take down 10 creatures.', grade: 'silver' },
  { id: 'dragon', name: 'Dragon Slayer', desc: 'Take down a dragon.', grade: 'gold' },
];
const GSys = window.GameSystem;
if (GSys && GSys.trophies) GSys.trophies(TROPHIES);
const trophy = id => { if (GSys && GSys.unlock) GSys.unlock(id); };
let kills = 0;
W.onKill = c => { if (c.lastHitByPlayer) { kills++; if (kills >= 10) trophy('kill10'); if (c.type.key === 'dragon') trophy('dragon'); } };

// ---------- input
const keys = {}; let mdx = 0, mdy = 0, lmb = false, rmb = false, lmbClick = false;
const menuOpen = () => !$('#spawn').hidden || !$('#pause').hidden || !$('#settings').hidden || !$('#credits').hidden;
function lock() { if (!menuOpen() && running) { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } }
canvas.addEventListener('click', () => { audio.resume(); lock(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { paused = false; lockedAt = performance.now(); mdx = mdy = 0; return; }
  if (running && !menuOpen()) openPause();
});
let lockedAt = 0;
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas && performance.now() - lockedAt > 120 && Math.abs(e.movementX) < 400 && Math.abs(e.movementY) < 400) { mdx += e.movementX; mdy += e.movementY; } });
addEventListener('mousedown', e => { if (document.pointerLockElement !== canvas) return; if (e.button === 0) { lmb = true; lmbClick = true; } if (e.button === 2) rmb = true; });
addEventListener('mouseup', e => { if (e.button === 0) lmb = false; if (e.button === 2) rmb = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (document.pointerLockElement === canvas && inv.length) equip((cur + (e.deltaY > 0 ? 1 : -1) + inv.length) % inv.length); });
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!running) return;
  if (e.code === 'KeyQ' || e.code === 'Tab') { e.preventDefault(); if (!$('#spawn').hidden) closeMenus(); else if (!menuOpen()) openSpawn(); }
  if (menuOpen()) return;
  if (e.code === 'KeyV') { player.view = player.view === 'first' ? 'third' : 'first'; S.view = player.view; save(); }
  if (e.code === 'KeyE') pickUp();
  if (e.code === 'KeyG') dropCurrent();
  if (/^Digit[1-9]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (inv[i]) equip(i); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; lmb = rmb = false; });

// ---------- weapons in your hands
async function giveWeapon(key) {
  const t = await itypes.get(key); const it = new Item(t, W); it.pickUp(); it.hide();
  if (inv.length >= 9) dropCurrent();
  inv.push(it); W.items.push(it); equip(inv.length - 1); return it;
}
function equip(i) {
  cur = i; const it = i >= 0 ? inv[i] : null;
  for (const x of inv) if (x !== it) x.hide();
  player.weapon = it && it.def.kind !== 'shield' ? it : null;
  player.shield = it && it.def.kind === 'shield' ? it : null;
  player.swing = 0; player.throwT = 0;
  hudWeapon();
}
function dropCurrent() {
  const it = inv[cur]; if (!it) return;
  inv.splice(cur, 1);
  const p = player.eye(new THREE.Vector3()).addScaledVector(player.lookDir(new THREE.Vector3()), 0.6);
  it.drop(p, player.lookDir(new THREE.Vector3()).multiplyScalar(4).add(player.vel));
  equip(Math.min(cur, inv.length - 1));
}
function nearestPickup() {
  const e = player.eye(new THREE.Vector3()), d = player.lookDir(new THREE.Vector3());
  let best = null, bs = 0.55;
  for (const it of W.items) {
    if (!it.isWeapon || it.held || it.removed || it.live) continue;
    const to = it.obj.position.clone().sub(e); const dist = to.length(); if (dist > 3) continue;
    const s = to.normalize().dot(d); if (s > bs) { bs = s; best = it; }
  }
  return best;
}
function pickUp() {
  const it = nearestPickup(); if (!it) return;
  it.pickUp(); it.hide(); if (inv.length >= 9) dropCurrent(); inv.push(it); equip(inv.length - 1);
  audio.play('clang', { vol: 0.3 });
}

// ---------- spawning
function aimPoint(minD, maxD) {
  const o = camera.getWorldPosition(new THREE.Vector3()), d = camera.getWorldDirection(new THREE.Vector3());
  let dist = maxD;
  if (d.y < -0.01) dist = Math.min(maxD, -o.y / d.y);
  const p = o.clone().addScaledVector(d, dist); p.y = 0;
  const pp = player.pos, v = p.clone().sub(pp).setY(0); let l = v.length();
  if (l < minD) { const f = player.forward(new THREE.Vector3()); if (l < 0.01) v.copy(f); v.normalize(); p.copy(pp).addScaledVector(v, minD).setY(0); }
  return p;
}
async function spawn(key) {
  if (CREATURES[key]) {
    if (W.creatures.filter(c => !c.removed).length >= 40) return toast('Too many creatures (40 max)');
    const t = await ctypes.get(key); const def = t.def;
    const size = def.length || def.height || 2;
    const p = aimPoint(Math.max(4, size * 0.9), Math.max(14, size * 2.2));
    if (def.flying) p.y = 10;
    const c = new Creature(t, p, mood, W);
    c.yaw = Math.atan2(player.pos.x - p.x, player.pos.z - p.z); c.root.rotation.y = c.yaw;
    W.creatures.push(c);
    if (key === 'trex') trophy('trex');
    toast(def.name + (mood === 'hunt' ? ' (hunting you)' : mood === 'calm' ? ' (calm)' : ' (fights anything)'));
  } else if (WEAPONS[key]) {
    await giveWeapon(key); toast(WEAPONS[key].name + ' in your hands');
  } else if (PROPS[key]) {
    const t = await itypes.get(key); const it = new Item(t, W);
    const p = aimPoint(2.5, 12); p.y = it.size.y / 2 + 0.6; it.drop(p); W.items.push(it);
    it.obj.rotation.y = player.yaw;
  }
}

// ---------- fighting
const swingHits = new Set();
let fireCool = 0, hitFlash = 0;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
function combat(dt) {
  fireCool -= dt;
  const w = player.weapon, sh = player.shield;
  player.blocking = !!(sh && (rmb || lmb) && player.canUseLeft());
  player.aim = rmb && w && (w.def.kind === 'gun' || w.def.kind === 'rifle') ? 1 : 0;
  if (!w || !player.canUseRight()) { lmbClick = false; return; }
  const k = w.def.kind;
  if (k === 'blade' || k === 'blunt') {
    if (lmb && player.swing <= 0) { player.swing = w.def.swing; player.swingDir = -player.swingDir; swingHits.clear(); audio.play(['swish1', 'swish2', 'swish3'][Math.floor(Math.random() * 3)], { vol: 0.6 }); }
    if (player.swing > 0) {
      const s = 1 - player.swing / w.def.swing;
      if (s > 0.33 && s < 0.66) {
        w.blade(_a, _b);
        for (const c of W.creatures) {
          if (c.dead || c.removed || swingHits.has(c)) continue;
          for (let i = 0; i <= 5; i++) {
            _p.lerpVectors(_a, _b, i / 5);
            if (c.containsPoint(_p, 0.15)) {
              swingHits.add(c); c.lastHitByPlayer = true;
              const dir = player.lookDir(new THREE.Vector3());
              c.hurt(w.def.damage * (0.85 + Math.random() * 0.3), _p.clone(), dir, player);
              audio.play(k === 'blunt' ? 'break2' : (Math.random() < 0.5 ? 'flesh1' : 'flesh2'), { pos: _p, vol: 0.9 });
              hitFlash = 0.15; break;
            }
          }
        }
      }
      player.swing -= dt;
    }
  } else if (k === 'gun' || k === 'rifle') {
    if (lmbClick && fireCool <= 0) {
      fireCool = w.def.rate; shoot(w);
    }
  } else if (k === 'throw') {
    if (lmbClick && player.throwT <= 0) player.throwT = 0.0001;
    if (player.throwT > 0) {
      const before = player.throwT; player.throwT += dt;
      if (before < 0.32 && player.throwT >= 0.32) throwGrenade(w);
      if (player.throwT > 0.7) player.throwT = 0;
    }
  }
  lmbClick = false;
}
function shoot(w) {
  camera.getWorldPosition(_o); camera.getWorldDirection(_d);
  const spread = player.aim ? 0.002 : (w.def.kind === 'rifle' ? 0.02 : 0.012);
  _d.x += (Math.random() - 0.5) * spread; _d.y += (Math.random() - 0.5) * spread; _d.z += (Math.random() - 0.5) * spread; _d.normalize();
  const m = w.muzzle(new THREE.Vector3());
  fx.muzzle(m); audio.play(w.def.sound, { vol: 1 }); player.recoil += w.def.recoil;
  let best = 400, hit = null, kind = null;
  for (const c of W.creatures) { if (c.removed) continue; const t = c.ray(_o, _d, best); if (t >= 0 && t < best) { best = t; hit = c; kind = 'c'; } }
  for (const it of W.items) {
    if (it.held || it.removed || it.isWeapon || !it.body) continue;
    const b = new THREE.Box3().setFromObject(it.obj); const p = new THREE.Ray(_o, _d).intersectBox(b, new THREE.Vector3());
    if (p) { const t = p.distanceTo(_o); if (t < best) { best = t; hit = it; kind = 'i'; } }
  }
  if (!hit && _d.y < 0) { best = -_o.y / _d.y; kind = 'g'; }
  const point = _o.clone().addScaledVector(_d, best);
  if (kind === 'c') { hit.lastHitByPlayer = true; hit.hurt(w.def.damage * (0.9 + Math.random() * 0.2), point, _d.clone(), player); hitFlash = 0.15; }
  else if (kind === 'i') { if (hit.def.explode) explode(hit.obj.position.clone(), 9, 260, false, hit); else { physics.impulse(hit.body, _d.clone().multiplyScalar(w.def.damage * 0.4)); fx.dust(point); } }
  else if (kind === 'g') fx.dust(point);
}
async function throwGrenade(w) {
  const t = await itypes.get('grenade'); const g = new Item(t, W);
  const p = w.obj.position.clone(), v = player.lookDir(new THREE.Vector3()).multiplyScalar(15).add(new THREE.Vector3(0, 3.5, 0)).add(player.vel);
  g.drop(p, v); g.live = true; g.fuse = w.def.fuse; W.items.push(g);
  audio.play('swish2', { vol: 0.5 });
}
function explode(pos, R, dmg, byPlayer, item) {
  if (item) item.remove();
  fx.explosion(pos);
  for (let i = 0; i < 4; i++) fx.pool(pos.x + (Math.random() - 0.5) * 3, pos.z + (Math.random() - 0.5) * 3, 0.0);
  for (const c of W.creatures) {
    if (c.dead || c.removed) continue; const d = c.pos.distanceTo(pos) - c.radius;
    if (d < R) { if (byPlayer) c.lastHitByPlayer = true; c.hurt(dmg * (1 - Math.max(0, d) / R), c.pos.clone().setY(c.half.y), c.pos.clone().sub(pos).normalize(), byPlayer ? player : null); }
  }
  for (const b of physics.bodies) {
    if (b.static) continue; const d = b.obj.position.distanceTo(pos); if (d > R) continue;
    const it = b.item; if (it && it.def.explode && it !== item && !it.boom) { it.boom = true; setTimeout(() => explode(it.obj.position.clone(), 9, 260, byPlayer, it), 150 + Math.random() * 200); }
    physics.impulse(b, b.obj.position.clone().sub(pos).setY(0).normalize().add(new THREE.Vector3(0, 1.2, 0)).multiplyScalar((1 - d / R) * 30 * Math.sqrt(b.mass)));
  }
  // your own grenades never hurt you; barrels and other blasts do
  const pd = player.pos.distanceTo(pos);
  if (!byPlayer && pd < R) blastPlayer(pos, 1 - pd / R);
  else if (byPlayer && pd < R) W.shake(0.6);
}

// ---------- getting hurt
const LIMB_KEYS = ['lArm', 'rArm', 'lLeg', 'rLeg'];
let hurtFlash = 0;
function hurtPlayer(power, dir) {
  player.body.blood = Math.min(1, player.body.blood + 0.12 + power * 0.25);
  fx.blood(player.B.Spine2.getWorldPosition(new THREE.Vector3()), dir, 25, 3);
  audio.play(['pain1', 'pain2', 'pain3'][Math.floor(Math.random() * 3)], { vol: 0.9 });
  hurtFlash = 1; W.shake(0.3 + power * 0.5);
  player.vel.addScaledVector(dir.clone().setY(0).normalize(), 2 + power * 6); player.vel.y += power * 3; player.ground = false; player.stagger = 0.35;
}
function cutSomething(weights, upperChance, dir) {
  const opts = LIMB_KEYS.filter(k => player.body.limbs[k].state === 'ok' || (player.body.limbs[k].state !== 'ok' && player.body.limbs[k].level === 'lower'));
  if (!opts.length) return false;
  let sum = 0; for (const k of opts) sum += weights[k]; let r = Math.random() * sum, k = opts[0];
  for (const o of opts) { r -= weights[o]; if (r <= 0) { k = o; break; } }
  const st = player.body.limbs[k];
  const level = st.state !== 'ok' ? 'upper' : (Math.random() < upperChance ? 'upper' : 'lower');
  if (player.body.sever(k, level, dir.clone().add(new THREE.Vector3(0, 0.6, 0)))) {
    toast('Lost ' + (level === 'lower' ? (k.includes('Arm') ? 'lower ' : 'lower ') : '') + LIMBS[k].name);
    if (LIMB_KEYS.every(x => player.body.limbs[x].state === 'cut' && player.body.limbs[x].level === 'upper')) trophy('nolimbs');
    return true;
  }
  return false;
}
function damageFromCreature(c) {
  const A = c.def.attack, dir = player.pos.clone().sub(c.pos).setY(0).normalize();
  const size = c.def.length || c.def.height || 2;
  if (player.blocking && player.forward(new THREE.Vector3()).dot(dir) < -0.3 && size < 6) {
    audio.play('clang', { vol: 1 }); W.shake(0.2); player.vel.addScaledVector(dir, 2); return;
  }
  hurtPlayer(Math.min(1, size / 10 + A.damage / 100), dir);
  if (Math.random() < A.sever) {
    const low = size < 2.2 && !c.def.flying; // small animals go for legs, big ones grab anything
    const w = A.kind === 'ram' ? { lArm: 0.4, rArm: 0.4, lLeg: 1.2, rLeg: 1.2 } : low ? { lArm: 1, rArm: 1, lLeg: 1.4, rLeg: 1.4 } : { lArm: 1.3, rArm: 1.3, lLeg: 0.9, rLeg: 0.9 };
    cutSomething(w, size > 5 ? 0.75 : 0.4, dir);
    if (size > 9 && Math.random() < 0.4) cutSomething(w, 0.6, dir); // a T-rex bite can take two
  }
}
function blastPlayer(pos, k) {
  const dir = player.pos.clone().sub(pos).setY(0).normalize();
  hurtPlayer(Math.min(1, 0.5 + k), dir);
  const n = k > 0.7 ? 2 + Math.floor(Math.random() * 2) : k > 0.35 ? 1 : 0;
  for (let i = 0; i < n; i++) cutSomething({ lArm: 1, rArm: 1, lLeg: 1, rLeg: 1 }, 0.5, dir);
}
W.creatureHits = (c, target) => {
  if (target === player) return damageFromCreature(c);
  const p = target.pos.clone(); p.y = target.half.y;
  target.hurt(c.def.attack.damage, p, target.pos.clone().sub(c.pos).normalize(), c);
};

// ---------- menus
function openSpawn() { document.exitPointerLock && document.exitPointerLock(); $('#spawn').hidden = false; navOf($('#spawn')); }
function openPause() { $('#pause').hidden = false; paused = true; navOf($('#pause .gs3-panel'), { back: closeMenus }); }
function closeMenus() { for (const id of ['#spawn', '#pause', '#settings', '#credits']) $(id).hidden = true; if (nav) { nav.stop(); nav = null; } paused = false; lock(); }
let nav = null;
function navOf(el, o = {}) { if (nav) nav.stop(); nav = GS && GS.nav ? GS.nav(el, { back: o.back || closeMenus }) : null; }
let tab = 'weapons';
function buildSpawn() {
  const tabs = $('#spawn .tabs'); tabs.innerHTML = '';
  for (const [id, label] of GROUPS) { const b = document.createElement('button'); b.className = 'gs3-btn' + (id === tab ? ' primary' : ''); b.textContent = label; b.onclick = () => { tab = id; buildSpawn(); }; tabs.appendChild(b); }
  const grid = $('#spawn .grid'); grid.innerHTML = '';
  const list = tab === 'weapons' ? Object.entries(WEAPONS) : tab === 'props' ? Object.entries(PROPS) : Object.entries(CREATURES).filter(([, d]) => d.group === tab);
  for (const [key, d] of list) {
    const t = document.createElement('div'); t.className = 'tile gs3-item'; t.tabIndex = 0;
    t.innerHTML = `<img src="assets/thumbs/${key}.webp" alt=""><div>${d.name}</div>`;
    t.onclick = () => { spawn(key); closeMenus(); };
    grid.appendChild(t);
  }
}
buildSpawn();
for (const b of document.querySelectorAll('#moods button')) b.onclick = () => { mood = b.dataset.mood; for (const x of document.querySelectorAll('#moods button')) x.classList.toggle('primary', x === b); };
$('#clearC').onclick = () => { for (const c of W.creatures) c.remove(); W.creatures = []; };
$('#clearI').onclick = () => { for (const it of W.items) if (!it.held) it.remove(); W.items = W.items.filter(i => i.held); };
$('#newSuit').onclick = () => { player.body.newSuit(); toast('Fresh suit on'); };
$('#clearB').onclick = () => { player.body.clearPieces(); fx.poolMesh.count = 0; fx.poolIdx = 0; };
$('#pmenu').onclick = e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (act === 'resume') closeMenus();
  if (act === 'spawn') { $('#pause').hidden = true; openSpawn(); }
  if (act === 'settings') { $('#pause').hidden = true; $('#settings').hidden = false; showSettings(); navOf($('#settings .gs3-panel'), { back: backToPause }); }
  if (act === 'credits') { $('#pause').hidden = true; $('#credits').hidden = false; $('#credtext').textContent = CREDITS; navOf($('#credits .gs3-panel'), { back: backToPause }); }
  if (act === 'quit') { fetch('/quit').catch(() => {}); setTimeout(() => { window.close(); document.body.innerHTML = '<p style="font:20px sans-serif;padding:40px">REGEN closed. You can close this window.</p>'; }, 150); }
};
function backToPause() { $('#settings').hidden = true; $('#credits').hidden = true; openPause(); }
for (const b of document.querySelectorAll('[data-act="back"]')) b.onclick = backToPause;
const CYC = { quality: ['auto', 'low', 'medium', 'high', 'ultra'], blood: ['max', 'some', 'off'], regen: [1, 2, 0.5, 4], view: ['first', 'third'], invert: [false, true] };
const LABEL = v => v === true ? 'On' : v === false ? 'Off' : typeof v === 'number' ? (v === 1 ? 'Normal (3 sec)' : v + 'x') : v === 'first' ? 'First-person' : v === 'third' ? 'Third-person' : String(v)[0].toUpperCase() + String(v).slice(1);
function showSettings() {
  for (const el of document.querySelectorAll('#settings [data-set]')) el.querySelector('.gs3-value').textContent = LABEL(S[el.dataset.set]);
  $('#sens').value = S.sens; $('#fov').value = S.fov; $('#vol').value = S.vol;
}
$('#settings .gs3-menu').onclick = e => {
  const el = e.target.closest('[data-set]'); if (!el) return; const k = el.dataset.set, list = CYC[k];
  S[k] = list[(list.indexOf(S[k]) + 1) % list.length]; save(); applySettings(); showSettings();
};
for (const id of ['sens', 'fov', 'vol']) $('#' + id).oninput = e => { S[id] = +e.target.value; save(); applySettings(); };
function applySettings() {
  applyQuality(); camera.fov = S.fov; camera.updateProjectionMatrix(); audio.setVolume(S.vol);
  fx.bloodAmount = S.blood === 'off' ? 0 : S.blood === 'some' ? 0.4 : 1;
  if (player) { player.view = S.view; player.body.regenRate = S.regen; }
}

// ---------- HUD
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.style.opacity = 1; toastT = 2.5; }
function hudWeapon() {
  const it = inv[cur]; $('#weap .name').textContent = it ? it.def.name : 'Empty hands';
  $('#weap .slots').innerHTML = inv.map((x, i) => `<span class="${i === cur ? 'on' : ''}">${i + 1} ${x.def.name.split(' ').pop()}</span>`).join('');
}
function hud(dt) {
  const B = player.body; let txt = '', lines = [], minP = 1;
  for (const k of LIMB_KEYS) {
    const st = B.limbs[k]; const el = document.getElementById('p-' + k);
    el.setAttribute('class', 'part' + (st.state === 'cut' ? ' cut' : st.state === 'grow' ? ' grow' : ''));
    if (st.state === 'cut') { lines.push(LIMBS[k].name + ': gone'); minP = 0; }
    if (st.state === 'grow') { const p = st.t / 3; minP = Math.min(minP, p); lines.push(LIMBS[k].name + ': ' + (p < 0.33 ? 'bone' : p < 0.62 ? 'muscle' : 'skin') + ' ' + Math.round(p * 100) + '%'); }
  }
  if (lines.length) txt = 'REGENERATING ' + Math.round(minP * 100) + '%';
  $('#regentext').textContent = txt; $('#limbs').innerHTML = lines.join('<br>');
  const pu = nearestPickup(); const h = $('#hint'); if (pu) { h.style.display = 'block'; h.textContent = 'E  pick up ' + pu.def.name; } else h.style.display = 'none';
  hitFlash -= dt; $('#cross').className = hitFlash > 0 ? 'hit' : '';
  hurtFlash = Math.max(0, hurtFlash - dt * 1.5); $('#hurt').style.opacity = Math.max(hurtFlash, B.missingCount() * 0.12);
  toastT -= dt; if (toastT <= 0) $('#toast').style.opacity = 0;
  if (!player.canUseRight() && player.weapon) { $('#weap .name').textContent = player.weapon.def.name + ' (no right arm)'; } else if (player.weapon || player.shield || !inv.length) { const it = inv[cur]; $('#weap .name').textContent = it ? it.def.name : 'Empty hands'; }
}

// test hooks (used by the automated play test)
W.debug = { spawn, equip, giveWeapon, look: (x, y) => { mdx += x; mdy += y; }, press: () => { lmb = true; lmbClick = true; }, release: () => { lmb = false; }, aim: v => { rmb = v; }, cut: (k, l) => player.body.sever(k, l), get inv() { return inv; } };

// ---------- main loop
const clock = new THREE.Clock();
let fpsT = 0, fpsN = 0, lowT = 0, highT = 0;
function frame() {
  requestAnimationFrame(frame);
  if (!W.ready) return;
  const realDt = Math.min(0.05, clock.getDelta());
  let dt = realDt; if (slowT > 0) { slowT -= realDt; dt *= 0.28; } // slow motion when a limb comes off
  if (running && !paused) {
    const sens = 0.0022 * S.sens * (player.aim && player.weapon && player.weapon.def.zoom ? 0.4 : 1);
    const input = {
      dx: mdx * sens, dy: mdy * sens * (S.invert ? -1 : 1),
      fwd: (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), side: (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
      sprint: keys.ShiftLeft || keys.ShiftRight, walk: keys.ControlLeft || keys.KeyC, jump: keys.Space,
    };
    mdx = mdy = 0;
    player.update(dt, input, physics);
    combat(dt);
    for (const c of W.creatures) if (!c.removed) c.update(dt);
    W.creatures = W.creatures.filter(c => !c.removed);
    // nobody walks through anybody
    for (const c of W.creatures) {
      if (c.dead || c.def.flying) continue;
      const dx = player.pos.x - c.pos.x, dz = player.pos.z - c.pos.z, d = Math.hypot(dx, dz), m = c.radius + 0.35;
      if (d < m && d > 1e-4 && player.pos.y < c.half.y * 2) { player.pos.x += dx / d * (m - d); player.pos.z += dz / d * (m - d); }
      for (const o of W.creatures) { if (o === c || o.dead || o.def.flying) continue; const ex = o.pos.x - c.pos.x, ez = o.pos.z - c.pos.z, e = Math.hypot(ex, ez), n = c.radius + o.radius; if (e < n && e > 1e-4) { const k = (n - e) / e * 0.5; o.pos.x += ex * k; o.pos.z += ez * k; } }
    }
    for (const it of W.items) if (it.live && !it.removed) { it.fuse -= dt; if (it.fuse <= 0) { it.live = false; explode(it.obj.position.clone(), it.def.radius, it.def.damage, true, it); } }
    W.items = W.items.filter(i => !i.removed);
    physics.step(dt);
    fx.update(dt);
  }
  player.placeCamera(camera, fx.shake);
  const zoom = player.aim && player.weapon && player.weapon.def.zoom && player.view === 'first' ? player.weapon.def.zoom : player.aim ? 1.25 : 1;
  const fov = S.fov / zoom; if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * 0.3; camera.updateProjectionMatrix(); }
  W.sun.position.copy(player.pos).add(new THREE.Vector3(-60, 90, 40)); W.sun.target.position.copy(player.pos);
  audio.listen(camera);
  if (running) hud(dt);
  renderer.render(scene, camera);
  // frame rate + auto quality
  fpsN++; fpsT += dt;
  if (fpsT > 2) {
    const fps = fpsN / fpsT; $('#fps').textContent = fps.toFixed(0) + ' fps';
    if (S.quality === 'auto' && running && !paused) {
      const order = ['low', 'medium', 'high'], i = order.indexOf(autoQ);
      if (fps < 42) { lowT++; highT = 0; if (lowT >= 2 && i > 0) { autoQ = order[i - 1]; applyQuality(); lowT = 0; } }
      else if (fps > 58) { highT++; lowT = 0; if (highT >= 4 && i < order.length - 1) { autoQ = order[i + 1]; applyQuality(); highT = 0; } }
      else { lowT = highT = 0; }
    }
    fpsT = 0; fpsN = 0;
  }
}
frame();
// tell the PC launcher the game is still open
setInterval(() => { fetch('/alive').catch(() => {}); }, 10000);
