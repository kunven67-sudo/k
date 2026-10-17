
// ---------- you ----------
let player = { pos: new THREE.Vector3(4, 0, 4), alive: false };
const stats = { str: 0, spd: 0, strXp: 0, spdXp: 0, kills: 0, sword: 'arming', deaths: 0 };
try { Object.assign(stats, JSON.parse(localStorage.getItem('ironblood.stats') || '{}')); } catch (e) {}
function saveStats() { try { localStorage.setItem('ironblood.stats', JSON.stringify(stats)); } catch (e) {} }
const SPAWN = { x: SQUARE.x + 2, z: SQUARE.z + 9 };
let bandages = 6, bandaging = 0;
// talking / shopping (uiOpen) and kissing scenes (cutscene) take the controls away
let uiOpen = false, cutscene = false, sceneCam = null, lovedT = 0;

function createPlayer() {
  const f = new Fighter({ player: true, tier: 3, metal: 0x70747c, rough: 0.27, cloth: 0x24242b, leather: 0x2a221c, body: 0x2a2a2e, sword: SWORDS.find(s => s.id === stats.sword) || SWORDS[0], name: 'You' });
  f.pos.set(SPAWN.x, groundH(SPAWN.x, SPAWN.z), SPAWN.z);
  f.facing = -Math.PI / 2; // toward the fields
  f.voicePitch = 0.82;
  f.onKill = (o, how) => {
    stats.kills++;
    ui.message(how === 'beheaded' ? 'BEHEADED' : how === 'cut open' ? 'CUT OPEN' : how === 'skull split' ? 'SKULL SPLIT' : 'KILLED', 1.4);
    const un = SWORDS.find(s => s.unlock === stats.kills);
    if (un) setTimeout(() => ui.message('NEW SWORD: ' + un.name.toUpperCase() + '  (press X)', 3), 1500);
    saveStats();
  };
  f.onLand = () => {
    if (f.attack && f.attack.kind === 'slam') { shake(0.5); gore.sparks(f.pos.clone().setY(f.pos.y + 0.05), null, 10); }
  };
  return f;
}
function unlockedSwords() { return SWORDS.filter(s => stats.kills >= s.unlock || vsave.owned.includes(s.id)); }

// permanent growth: it's you that gets stronger, not the sword
function gainXp(raw) {
  stats.strXp += raw * 0.07; stats.spdXp += 1.2;
  const need = (l) => 40 + l * 35;
  if (stats.strXp >= need(stats.str)) { stats.strXp -= need(stats.str); stats.str++; ui.message('STRENGTH ' + stats.str, 1.6); sfx.ui(520); }
  if (stats.spdXp >= need(stats.spd) * 0.6) { stats.spdXp -= need(stats.spd) * 0.6; stats.spd++; ui.message('SWORD SPEED ' + stats.spd, 1.6); sfx.ui(700); }
  saveStats();
}

// ---------- input ----------
const keys = {};
const mouse = { l: false, r: false, lDown: 0, hist: [] };
let yaw = 0, pitch = 0.28, camDist = 3.6, playing = false, paused = false, lockTarget = null;
let slowmo = 1, slowmoT = 0, hitStopT = 0, shakeAmt = 0;
let finisherCam = 0;
function shake(a) { shakeAmt = Math.min(1.2, shakeAmt + a); }
function hitStop(t) { hitStopT = Math.max(hitStopT, t); }

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (!playing || paused || !player.alive || uiOpen || cutscene || passedOut) return;
  if (e.repeat) return;
  if (e.code === 'KeyE') { const t = interactTarget(); if (t && t.kind === 'talk') openTalk(t.o); else if (t && t.kind === 'loot') lootBody(t.o); }
  if (e.code === 'KeyH') useHealItem();
  if (e.code === 'Space' && player.grounded && player.canAct() && player.stamina > 8) { player.vy = 5.6; player.grounded = false; player.useStamina(8); }
  if (e.code === 'KeyC') tryDodge();
  if (e.code === 'KeyQ') toggleLock();
  if (e.code === 'KeyF') tryFinisher();
  if (e.code === 'KeyB') tryBandage();
  if (e.code === 'KeyX') cycleSword();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; if (player.blocking) player.blocking = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (!playing || paused || uiOpen || cutscene) return;
  if (document.pointerLockElement !== renderer.domElement) return;
  const s = 0.0024 * settings.sens / 100;
  if (finisherCam <= 0) { yaw -= e.movementX * s; pitch = Math.min(1.2, Math.max(-0.35, pitch + e.movementY * s * 0.9)); }
  mouse.hist.push({ dx: e.movementX, dy: e.movementY, t: performance.now() });
  if (mouse.hist.length > 40) mouse.hist.shift();
});
addEventListener('wheel', (e) => { if (playing && !paused && !uiOpen) camDist = Math.min(7, Math.max(2.2, camDist + Math.sign(e.deltaY) * 0.4)); }, { passive: true });
addEventListener('mousedown', (e) => {
  if (!playing || paused || uiOpen || cutscene || passedOut) return;
  if (document.pointerLockElement !== renderer.domElement) { requestLock(); return; }
  audioInit();
  if (!player.alive) return;
  if (e.button === 0) { mouse.l = true; mouse.lDown = performance.now(); attackPressed(swingDir()); }
  if (e.button === 1) { e.preventDefault(); attackPressed('S'); }
  if (e.button === 2) { mouse.r = true; if (player.canAct() && !player.attack && player.hasSword) { player.blocking = true; player.blockStart = now(); } }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) { mouse.l = false; if (player.attack && player.attack.hold) player.attack.hold = false; }
  if (e.button === 2) { mouse.r = false; player.blocking = false; }
});
// which way you moved the mouse just before clicking picks the swing
let lastAuto = 'L';
function swingDir() {
  const t = performance.now();
  let dx = 0, dy = 0;
  for (const h of mouse.hist) if (t - h.t < 160) { dx += h.dx; dy += h.dy; }
  if (Math.hypot(dx, dy) < 12) { lastAuto = lastAuto === 'R' ? 'L' : 'R'; return lastAuto; }
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'R' : 'L';
  return dy < 0 ? 'U' : 'D';
}
function attackPressed(dir) {
  const f = player;
  if (bandaging > 0) return;
  let kind = 'light';
  if (!f.grounded) { kind = 'slam'; dir = 'U'; }
  else if (f.speed > 4.5) kind = 'run';
  if (f.startAttack(dir, kind)) {
    if (kind === 'run') { const fx = Math.sin(f.facing), fz = Math.cos(f.facing); f.vel.x += fx * 3; f.vel.z += fz * 3; }
    if (kind === 'slam') f.vy = Math.min(f.vy, -2);
  }
}
function tryDodge() {
  const f = player;
  if (!f.canAct() || f.attack || f.stamina < 20 || !f.grounded) return;
  f.useStamina(24);
  const w = moveWish();
  if (w.lengthSq() < 0.01) w.set(-Math.sin(f.facing), 0, -Math.cos(f.facing));
  f.dodgeDir = w.clone().normalize();
  f.dodge = 0.45; f.blocking = false;
  sfx.swing(f.pos, 2.5, 0.6); sfx.step(f.pos, 'dirt', true, 1.5);
}
function toggleLock() {
  if (lockTarget) { lockTarget = null; return; }
  let best = null, bd = 1e9;
  const cf = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (const o of fighters) {
    if (o.isPlayer || !o.alive || o.inside || !(o.team === 'knight' || o.angryAtYou)) continue;
    const d = o.pos.distanceTo(player.pos);
    if (d > 20) continue;
    const dir = o.pos.clone().sub(player.pos).setY(0).normalize();
    const score = d * (1.6 - dir.dot(cf));
    if (score < bd) { bd = score; best = o; }
  }
  lockTarget = best;
}
function tryFinisher() {
  const f = player;
  if (!f.canAct() || f.attack || !f.hasSword) return;
  let best = null, bd = 3;
  for (const o of fighters) {
    if (o.isPlayer || !o.alive || o.inside || !(o.team === 'knight' || o.angryAtYou)) continue;
    const d = o.pos.distanceTo(f.pos);
    const weak = o.stagger > 0 || o.hp < o.maxHp * 0.3 || o.down || !o.hasSword;
    if (d < bd && weak) { bd = d; best = o; }
  }
  if (!best) { ui.sub('Finishers work on staggered, nearly dead or downed enemies', 2); return; }
  const dir = best.pos.clone().sub(f.pos).setY(0).normalize();
  f.facing = Math.atan2(dir.x, dir.z); f.root.rotation.y = f.facing;
  // pull the victim into place in front of you
  best.pos.copy(f.pos).addScaledVector(dir, 1.25); best.pos.y = groundH(best.pos.x, best.pos.z);
  if (!best.down) { best.facing = Math.atan2(-dir.x, -dir.z); best.root.rotation.y = best.facing; best.stagger = 3; best.attack = null; best.blocking = false; }
  const kinds = settings.gore >= 2 ? ['behead', 'gut', 'behead'] : ['behead'];
  const type = best.down ? 'stabdown' : kinds[Math.floor(Math.random() * kinds.length)];
  f.attack = { dir: type === 'gut' ? 'R' : type === 'stabdown' ? 'U' : 'L', kind: 'finisher', t: 0, dur: 1.15, hit: new Set([best]), swung: false, power: 3, fin: { target: best, type, done: false } };
  slowmo = 0.3; slowmoT = 1.5; finisherCam = 1.6;
  sfx.voice(f.pos, 'shout', f.voicePitch);
}
function updateFinisher(f) {
  const a = f.attack;
  if (!a || a.kind !== 'finisher' || a.fin.done) return;
  if (a.t / a.dur < 0.45) return;
  a.fin.done = true;
  const o = a.fin.target;
  if (!o.alive) return;
  const dir = o.pos.clone().sub(f.pos).setY(0).normalize();
  const neckP = o.b.Neck.getWorldPosition(new THREE.Vector3());
  const bellyP = o.b.Spine.getWorldPosition(new THREE.Vector3());
  if (a.fin.type === 'behead') o.takeHit('neck', 9999, { pierce: 1, cut: 2, point: neckP, dir: new THREE.Vector3(-dir.z, 0.3, dir.x), from: f, power: 3, part: 'neck' });
  else if (a.fin.type === 'gut') o.takeHit('belly', 9999, { pierce: 1, cut: 2, point: bellyP, dir, from: f, power: 3, part: 'belly' });
  else o.takeHit('chest', 9999, { pierce: 1, stab: true, point: o.b.Spine2.getWorldPosition(new THREE.Vector3()), dir: new THREE.Vector3(0, -1, 0), from: f, power: 3, part: 'chest' });
  shake(0.8); gainXp(80);
}
function tryBandage() {
  const f = player;
  if (bandaging > 0 || !f.canAct() || f.attack) return;
  if (bandages <= 0) { ui.sub('No bandages left. Respawning refills them.', 2); return; }
  if (f.bleed <= 0.01 && f.hp >= f.maxHp) { ui.sub('You are not hurt', 1.2); return; }
  bandaging = 2.5; f.blocking = false;
}
function cycleSword() {
  const list = unlockedSwords();
  if (list.length < 2) { ui.sub('Kill ' + (SWORDS[1].unlock - stats.kills) + ' more to unlock the next sword', 2); return; }
  if (player.attack || !player.hasSword) return;
  const i = list.findIndex(s => s.id === player.sword.id);
  const next = list[(i + 1) % list.length];
  player.setSword(next); stats.sword = next.id; saveStats();
  sfx.armorHit(player.pos);
  ui.weaponCard();
}
function moveWish() {
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const w = new THREE.Vector3();
  if (keys.KeyW || keys.ArrowUp) w.add(fwd);
  if (keys.KeyS || keys.ArrowDown) w.sub(fwd);
  if (keys.KeyD || keys.ArrowRight) w.add(right);
  if (keys.KeyA || keys.ArrowLeft) w.sub(right);
  if (w.lengthSq() > 0) w.normalize();
  return w;
}
function requestLock() {
  const r = renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock();
  if (r && r.catch) r.catch(() => {});
}

let healHeartbeat = 0;
function updatePlayer(dt) {
  const f = player;
  tickVitals(f, dt);
  if (!f.alive) { f.updateFall(dt); return; }
  if (lockTarget && (!lockTarget.alive || lockTarget.pos.distanceTo(f.pos) > 25)) lockTarget = null;
  const w = playing && !paused && !uiOpen && !cutscene && !passedOut ? moveWish() : new THREE.Vector3();
  // ale makes you weave about
  if (drunk > 0.3 && w.lengthSq() > 0) { const a = Math.sin(elapsed * 1.3) * Math.min(0.9, (drunk - 0.3) * 1.2); w.set(w.x * Math.cos(a) - w.z * Math.sin(a), 0, w.x * Math.sin(a) + w.z * Math.cos(a)); }
  if (lovedT > 0) { lovedT -= dt; if (f.staminaDelay <= 0) f.stamina = Math.min(100, f.stamina + dt * 9); }
  const wantsSprint = (keys.ShiftLeft || keys.ShiftRight) && w.lengthSq() > 0 && f.stamina > 1 && !f.blocking && bandaging <= 0;
  let speed = 0;
  if (w.lengthSq() > 0) speed = wantsSprint ? 6.4 : 1.9;
  if (wantsSprint) f.useStamina(dt * 11);
  if (f.blocking) speed = Math.min(speed, 1.3);
  if (f.attack && f.attack.kind !== 'run' && f.attack.kind !== 'slam') speed *= 0.35;
  if (bandaging > 0) speed = Math.min(speed, 1.0);
  speed *= f.legMult;
  if (!f.canAct() && f.dodge <= 0) speed *= 0.25;
  // face where you move, or the locked target, or where you swing
  let face = f.facing;
  if (lockTarget) { const d = lockTarget.pos.clone().sub(f.pos); face = Math.atan2(d.x, d.z); }
  else if (f.attack || f.blocking) face = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  else if (w.lengthSq() > 0) face = Math.atan2(w.x, w.z);
  stepFighter(f, dt, w, speed, face, f.attack ? 6 : 11);
  // heavy attack: keep holding to wind up more
  const a = f.attack;
  if (a && a.kind === 'light' && mouse.l && a.t > a.dur * 0.18 && a.t < a.dur * 0.3 && f.stamina > 10) {
    a.kind = 'heavy'; a.hold = true; a.power = 1.6; a.dur *= 1.35; f.useStamina(10 * Math.sqrt(f.sword.weight));
  }
  updateFinisher(f);
  if (bandaging > 0) {
    bandaging -= dt;
    if (bandaging <= 0) { bandages--; f.bleed = 0; f.hp = Math.min(f.maxHp, f.hp + 14); for (const k in f.parts) if (!f.parts[k].gone) f.parts[k].hp = Math.min(f.parts[k].max, f.parts[k].hp + f.parts[k].max * 0.15); ui.sub('Bleeding stopped', 1.5); sfx.ui(400); }
  }
  // wash blood off in the pond
  if (f.pos.y < WATER_Y - 0.1) f.blood = Math.max(0, f.blood - dt * 0.15);
  if (f.hp < 30) { healHeartbeat -= dt; if (healHeartbeat <= 0) { sfx.heartbeat(); healHeartbeat = 0.5 + f.hp / 30 * 0.6; } }
  if (f.hp <= 0 && f.alive) f.die(null, 'killed');
}
function playerDied() {
  stats.deaths++;
  onPlayerDeathVillage();
  if (settings.hard) { stats.str = 0; stats.spd = 0; stats.strXp = 0; stats.spdXp = 0; stats.kills = 0; stats.sword = 'arming'; }
  saveStats();
}
function respawnPlayer() {
  const old = player;
  removeFighter(old);
  player = createPlayer();
  bandages = 6; bandaging = 0; lockTarget = null;
  // nearby enemies forget you for a moment
  for (const o of fighters) if (o.ai) { o.ai.alert = false; o.ai.shouted = false; }
}

// ---------- camera ----------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camInit = false;
function updateCamera(dt) {
  const f = player;
  if (lockTarget && finisherCam <= 0) {
    const d = lockTarget.pos.clone().sub(f.pos);
    const want = Math.atan2(-d.x, -d.z);
    yaw = angleLerp(yaw, want, Math.min(1, dt * 6));
    pitch += (0.22 - pitch) * Math.min(1, dt * 3);
  }
  const head = new THREE.Vector3(f.pos.x, f.pos.y + (f.down && !f.alive ? 0.4 : 1.55), f.pos.z);
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const cp = Math.cos(pitch);
  let want = new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(camDist).add(head).addScaledVector(right, 0.45);
  let look = head.clone().addScaledVector(right, 0.45);
  if (sceneCam) { want = sceneCam.pos.clone(); look = sceneCam.look.clone(); }
  else if (finisherCam > 0 && f.attack && f.attack.fin) {
    // cinematic side view of the finisher
    const o = f.attack.fin.target;
    const mid = f.pos.clone().lerp(o.pos, 0.5).setY(f.pos.y + 1.3);
    const side = new THREE.Vector3(Math.cos(f.facing), 0, -Math.sin(f.facing));
    want = mid.clone().addScaledVector(side, 2.3).add(new THREE.Vector3(0, 0.25, 0)).addScaledVector(new THREE.Vector3(Math.sin(f.facing), 0, Math.cos(f.facing)), -0.6);
    look = mid;
  }
  const gh = groundH(want.x, want.z) + 0.3;
  if (want.y < gh) want.y = gh;
  // don't let the camera go inside walls: slide it in toward you
  for (let i = 0; i < 6; i++) { const b = solidAt(want.x, want.z, 0.25); if (!b || want.y > b.h1 + 0.2) break; want.lerp(head, 0.3); }
  if (!camInit) { camPos.copy(want); camLook.copy(look); camInit = true; }
  const k = Math.min(1, (finisherCam > 0 || sceneCam ? 4 : 16) * dt);
  camPos.lerp(want, k); camLook.lerp(look, k);
  camera.position.copy(camPos);
  if (shakeAmt > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.12;
    camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.12;
    shakeAmt *= Math.pow(0.02, dt);
  }
  camera.lookAt(camLook);
  const fov = 55 + (f.speed > 4.5 ? 7 : 0);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 5);
  camera.updateProjectionMatrix();
}
