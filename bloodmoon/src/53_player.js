// =====================================================================
// PLAYER — moving (walk, sprint, crouch, jump, swim, ride), the camera
// (first person, V for third person), and your arms and weapons on screen.
// =====================================================================
const KEYS = {}, MOUSE = { l: false, r: false, dx: 0, dy: 0, locked: false };
const P_EYE = 1.65, P_R = 0.35;
const sk = (id) => (G.save ? G.save.player.skills[id] || 0 : 0);
const hasMut = (m) => !!(G.save && G.save.player.muts.includes(m));
function pStats() {
  const P = G.save.player, arm = ITEMS[P.eq.armor];
  return {
    maxHp: Math.round((100 + (P.level - 1) * 12) * (1 + 0.08 * sk('blood')) * (hasMut('troll') ? 1.15 : 1)),
    maxStam: Math.round((100 + (P.level - 1) * 3) * (hasMut('wyvern') ? 1.25 : 1)),
    maxMana: 60 + (P.level - 1) * 4 + sk('well') * 15,
    def: (arm ? arm.def : 0) + (hasMut('troll') ? 6 : 0),
    warm: arm ? arm.warm || 0 : 0,
  };
}
function makePlayer(save) {
  const P = save.player, pos = P.pos;
  const p = { x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, yaw: pos.yaw || 0, pitch: 0, onGround: true, crouch: false, sprint: false, swim: false, mounted: null, horseSpeed: 0,
    hp: P.hp, stam: 100, mana: P.mana == null ? 60 : P.mana, atk: null, combo: 0, comboT: 0, queued: false, block: false, blockT: 9, dodgeT: 0, iframe: 0, draw: -1, drawing: false, castT: 0, cd: { fire: 0, lightning: 0, ice: 0 },
    hurtT: 0, dead: false, deadT: 0, bob: 0, footT: 0, peakY: pos.y, burn: 0, poison: 0, stagger: 0, drinkT: 0, landT: 0, tp: false, regenT: 0, lastHit: 0 };
  const st = pStats(); p.maxHp = st.maxHp; p.maxStam = st.maxStam; p.maxMana = st.maxMana; p.hp = clamp(p.hp == null ? p.maxHp : p.hp, 1, p.maxHp); p.stam = p.maxStam; p.mana = clamp(p.mana, 0, p.maxMana);
  p.y = floorAt(p.x, p.z, p.y + 1); p.peakY = p.y;
  return p;
}
function refreshStats() { const p = G.p; if (!p) return; const st = pStats(); p.maxHp = st.maxHp; p.maxStam = st.maxStam; p.maxMana = st.maxMana; p.hp = Math.min(p.hp, p.maxHp); p.mana = Math.min(p.mana, p.maxMana); Body.rebuild(); VM.rebuild(); }
function shakeCam(a) { if (SET.shake) G.shake = Math.max(G.shake, a); }
const fwdOf = (yaw) => [Math.sin(yaw), Math.cos(yaw)];
const busy = () => { const p = G.p; return !p || p.dead || p.atk || p.drawing || p.drinkT > 0 || p.stagger > 0 || p.castT > 0.15; };
// ---------- per-frame player update ----------
const _camF = new THREE.Vector3();
function updatePlayer(dt) {
  const p = G.p, S = G.save.player; if (!p) return;
  if (p.dead) { p.deadT += dt; return; }
  const inMenu = UI.blocking();
  // look
  const sens = 0.0011 + SET.sens * 0.00004;
  if (!inMenu) { p.yaw -= MOUSE.dx * sens; p.pitch = clamp(p.pitch - MOUSE.dy * sens * (SET.invertY ? -1 : 1), -1.45, 1.45); }
  MOUSE.dx = MOUSE.dy = 0;
  // timers
  p.blockT += dt; p.dodgeT = Math.max(0, p.dodgeT - dt); p.iframe = Math.max(0, p.iframe - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.stagger = Math.max(0, p.stagger - dt); p.castT = Math.max(0, p.castT - dt); p.comboT -= dt; if (p.comboT <= 0) p.combo = 0;
  p.drinkT = Math.max(0, p.drinkT - dt); p.landT = Math.max(0, p.landT - dt); for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
  if (p.burn > 0) { p.burn -= dt; if (chance(0.6)) Gore.ember(p.x, p.y + rand(0.3, 1.5), p.z); p.burnAcc = (p.burnAcc || 0) + dt; if (p.burnAcc > 0.5) { p.burnAcc = 0; hurtPlayer(4, null, { dot: true }); } }
  if (p.poison > 0) { p.poison -= dt; p.poisAcc = (p.poisAcc || 0) + dt; if (p.poisAcc > 1) { p.poisAcc = 0; hurtPlayer(2.5, null, { dot: true }); } }
  // regen
  const sv = G.save.surv, tired = sv.fatigue > 85, starving = sv.hunger <= 0, cold = sv.warmth < 25;
  const stamMax = p.maxStam * (tired ? 0.7 : 1);
  if (!p.sprinting && !p.atk && !p.block && p.dodgeT <= 0) p.stam = Math.min(stamMax, p.stam + dt * (22 + (hasMut('wyvern') ? 8 : 0)) * (starving || cold ? 0.5 : 1) * (p.stamBoost > 0 ? 1.8 : 1));
  if (p.stamBoost > 0) p.stamBoost -= dt;
  p.mana = Math.min(p.maxMana, p.mana + dt * (2.6 + sk('well') * 0.6));
  if (hasMut('wolf') && Clock.isNight()) p.hp = Math.min(p.maxHp, p.hp + 2 * dt);
  if (G.time - p.lastHit > 8 && !starving && !cold) p.hp = Math.min(p.maxHp, p.hp + dt * 0.6);
  // block and bow
  const wantBlock = !inMenu && (KEYS.KeyF || TOUCH.block) && !p.atk && !p.drawing && !p.swim && p.stagger <= 0;
  if (wantBlock && !p.block) { p.blockT = 0; }
  p.block = wantBlock && p.stam > 0;
  updateBow(dt, inMenu);
  updateAttack(dt, inMenu);
  if (p.mounted) rideHorse(dt, inMenu); else moveOnFoot(dt, inMenu);
  // fall out of the world? put them back on the ground
  if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) { const pos = G.save.player.pos; p.x = pos.x; p.z = pos.z; p.y = floorAt(p.x, p.z) + 1; p.vx = p.vy = p.vz = 0; }
  if (G.area === 'outside') { p.x = clamp(p.x, -HALF + 8, HALF - 8); p.z = clamp(p.z, -HALF + 8, HALF - 8); }
}
function moveInput() {
  let f = 0, s = 0; if (KEYS.KeyW || KEYS.ArrowUp) f += 1; if (KEYS.KeyS || KEYS.ArrowDown) f -= 1; if (KEYS.KeyD || KEYS.ArrowRight) s += 1; if (KEYS.KeyA || KEYS.ArrowLeft) s -= 1;
  f += TOUCH.my; s += TOUCH.mx; const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; } return [f, s];
}
function moveOnFoot(dt, inMenu) {
  const p = G.p; let [f, s] = inMenu || p.stagger > 0 ? [0, 0] : moveInput();
  const [fx, fz] = fwdOf(p.yaw), rx = -fz, rz = fx; // right
  const gy = floorAt(p.x, p.z, p.y), wl = G.area === 'outside' ? waterLevelAt(p.x, p.z) : -Infinity, depth = wl - gy;
  const wasSwim = p.swim; p.swim = depth > 1.35 && p.y < wl - 0.9;
  if (p.swim && !wasSwim) { Sfx.play('splash'); Gore.splash(p.x, wl, p.z, 20); p.crouch = false; }
  const wantSprint = (KEYS.ShiftLeft || KEYS.ShiftRight || TOUCH.sprint) && f > 0.2 && !p.block && !p.drawing && p.stam > 1 && !p.crouch;
  let speed = p.swim ? (hasMut('drowner') ? 4.6 : 2.6) : p.crouch ? 2.2 : wantSprint ? 7.4 : 4.3;
  if (p.drawing) speed *= 0.55; if (p.block) speed *= 0.6; if (p.atk) speed *= p.atk.kind === 'heavy' ? 0.3 : 0.55; if (p.drinkT > 0) speed *= 0.6; if (G.save.surv.fatigue > 85) speed *= 0.9;
  if (!p.swim && depth > 0.5) speed *= 0.7; // wading
  p.sprinting = wantSprint && (f || s) && p.onGround; if (p.sprinting) p.stam = Math.max(0, p.stam - dt * 16);
  if (p.swim && !hasMut('drowner') && (f || s)) { p.stam = Math.max(0, p.stam - dt * 6); if (p.stam <= 0) { p.drownAcc = (p.drownAcc || 0) + dt; if (p.drownAcc > 1) { p.drownAcc = 0; hurtPlayer(6, null, { dot: true }); } } }
  let wx = (fx * f + rx * s) * speed, wz = (fz * f + rz * s) * speed;
  if (p.dodgeT > 0) { wx = p.dodgeX; wz = p.dodgeZ; }
  const k = p.onGround || p.swim ? 14 : 2.5; p.vx = damp(p.vx, wx, k, dt); p.vz = damp(p.vz, wz, k, dt);
  // move and collide
  const ox = p.x, oz = p.z, oy = p.y; p.x += p.vx * dt; p.z += p.vz * dt; collideCircle(p, P_R, p.y + 0.3, 1.4);
  let ny = floorAt(p.x, p.z, p.y);
  if (p.onGround && !p.swim && ny - oy > 0.6 + Math.hypot(p.x - ox, p.z - oz) * 1.25) { p.x = ox; p.z = oz; ny = floorAt(p.x, p.z, p.y); } // too steep or a ledge
  // vertical
  if (p.swim) { p.vy = 0; p.y = damp(p.y, wl - 1.25 + Math.sin(G.time * 2) * 0.05, 6, dt); p.onGround = false; p.peakY = p.y; if (f || s) { p.swimT = (p.swimT || 0) - dt; if (p.swimT <= 0) { p.swimT = 0.8; Sfx.play('swim'); } } }
  else {
    p.vy -= 22 * dt; p.y += p.vy * dt;
    if (p.y <= ny + 0.001 || (p.onGround && p.vy <= 0 && p.y - ny < 0.45)) {
      if (!p.onGround) { const fall = p.peakY - ny; p.landT = 0.25; Sfx.play('land', { vol: clamp(fall / 4, 0.3, 1) }); if (fall > 6.5 && !G.cine) { hurtPlayer((fall - 6.5) * 10, null, { fall: true }); shakeCam(0.4); } }
      p.y = ny; p.vy = 0; p.onGround = true; p.peakY = p.y;
    } else { if (p.onGround && p.vy <= 0) p.vy = Math.min(p.vy, -2); p.onGround = false; p.peakY = Math.max(p.peakY, p.y); }
  }
  // footsteps
  const hs = Math.hypot(p.vx, p.vz);
  if (p.onGround && hs > 0.6) { p.bob += dt * hs * 1.9; p.footT -= dt * hs; if (p.footT <= 0) { p.footT = p.sprinting ? 2.4 : 1.9; Sfx.step(surfAt(p.x, p.z, depth), { vol: p.crouch ? 0.35 : p.sprinting ? 1 : 0.7 }); } }
}
function surfAt(x, z, depth) { if (depth > 0.05) return 'water'; if (G.area !== 'outside') return G.area === 'shrine' ? 'rock' : 'wood'; if (deckAt(x, z, G.p ? G.p.y : 1e9) > heightAt(x, z) + 0.2) return 'wood'; return SURF_STEP[surfaceAt(x, z)] || 'dirt'; }
function playerJump() { const p = G.p; if (!p || p.dead || UI.blocking()) return; if (p.mounted) { if (p.mounted.jumpT > 0 || !p.mounted.onGround) return; p.mounted.vy = 6; p.mounted.onGround = false; p.mounted.jumpT = 0.8; Sfx.play('neigh', { vol: 0.4 }); return; } if (!p.onGround || p.swim || p.stam < 8 || p.stagger > 0) return; p.vy = 7.4; p.onGround = false; p.stam -= 8; Sfx.play('jump'); p.crouch = false; }
function playerDodge() {
  const p = G.p; if (!p || p.dead || p.mounted || p.swim || !p.onGround || p.dodgeT > 0 || p.stam < 15 || p.stagger > 0 || UI.blocking()) return;
  if (p.atk && p.atk.t < p.atk.dur * 0.5) return; p.atk = null;
  let [f, s] = moveInput(); if (!f && !s) f = -1; const [fx, fz] = fwdOf(p.yaw), l = Math.hypot(f, s);
  p.dodgeX = ((fx * f - fz * s) / l) * 10; p.dodgeZ = ((fz * f + fx * s) / l) * 10; p.dodgeT = 0.3; p.iframe = 0.3; p.stam -= 15; p.dodgeSide = s; Sfx.play('dodge'); p.drawing = false; p.draw = -1;
}
// ---------- your horse ----------
function rideHorse(dt, inMenu) {
  const p = G.p, h = p.mounted; let [f, s] = inMenu ? [0, 0] : moveInput();
  const gallop = (KEYS.ShiftLeft || KEYS.ShiftRight || TOUCH.sprint) && f > 0.2 && h.stam > 1, rider = 1 + sk('rider') * 0.1;
  const want = f > 0 ? (gallop ? 15 : 8) * rider : f < 0 ? -2.2 : 0;
  p.horseSpeed = damp(p.horseSpeed, want, want > p.horseSpeed ? 1.4 : 2.6, dt);
  h.stam = clamp((h.stam == null ? 100 : h.stam) + (gallop ? -9 * (1 - sk('rider') * 0.15) : 12) * dt, 0, 100);
  // the horse turns toward where you look, and with A/D
  h.yaw += clamp(angDiff(h.yaw, p.yaw), -1.8 * dt, 1.8 * dt) * (Math.abs(p.horseSpeed) > 0.5 ? 1 : 0) - s * 1.6 * dt;
  if (Math.abs(p.horseSpeed) < 0.5 && s) h.yaw -= s * 0.4 * dt;
  const [fx, fz] = fwdOf(h.yaw), ox = h.x, oz = h.z;
  h.x += fx * p.horseSpeed * dt; h.z += fz * p.horseSpeed * dt; const hit = collideCircle(h, 0.8, h.y + 0.5, 1.6);
  if (hit && p.horseSpeed > 9) { p.horseSpeed *= 0.4; Sfx.play('neigh', { x: h.x, y: h.y, z: h.z, vol: 0.6 }); shakeCam(0.3); }
  const gy = floorAt(h.x, h.z, h.y), depth = G.area === 'outside' ? waterDepthAt(h.x, h.z) : 0;
  if (depth > 1.5 || (gy - h.y > 0.8 + Math.hypot(h.x - ox, h.z - oz) * 1.1 && h.onGround !== false)) { h.x = ox; h.z = oz; p.horseSpeed *= 0.5; }
  if (h.vy || h.onGround === false) { h.vy -= 20 * dt; h.y += h.vy * dt; const g2 = floorAt(h.x, h.z, h.y); if (h.y <= g2) { h.y = g2; h.vy = 0; h.onGround = true; Sfx.step('dirt', { vol: 1 }); } } else h.y = damp(h.y, floorAt(h.x, h.z, h.y + 0.5), 14, dt);
  h.jumpT = Math.max(0, (h.jumpT || 0) - dt);
  h.x = clamp(h.x, -HALF + 8, HALF - 8); h.z = clamp(h.z, -HALF + 8, HALF - 8);
  // hooves
  const sp = Math.abs(p.horseSpeed); if (sp > 0.6 && h.onGround !== false) { h.footT = (h.footT || 0) - dt * sp; if (h.footT <= 0) { h.footT = sp > 10 ? 2.2 : 1.6; const srf = surfAt(h.x, h.z, depth); Sfx.step(srf === 'water' ? 'water' : srf === 'wood' ? 'wood' : 'stone', { vol: 0.8 }); Sfx.step(srf, { vol: 0.6 }); if (sp > 10 && chance(0.3)) Gore.dust(h.x - fx, h.y, h.z - fz, 2); } }
  if (h.stam < 5 && gallop && chance(dt)) Sfx.play('snort', { x: h.x, y: h.y + 1.6, z: h.z });
  const sc = h.rig.root.scale.x, st = h.rig.seat, cs = Math.cos(h.yaw), sn = Math.sin(h.yaw); p.x = h.x + (st.x * cs + st.z * sn) * sc; p.y = h.y + st.y * sc - 0.95; p.z = h.z + (-st.x * sn + st.z * cs) * sc; p.vx = fx * p.horseSpeed; p.vz = fz * p.horseSpeed; p.onGround = true; p.peakY = p.y;
  p.bob += dt * sp * 0.9;
  if (depth > 0.3 && sp > 2 && chance(dt * 6)) Gore.splash(h.x, waterLevelAt(h.x, h.z), h.z, 6, 0.6);
}
function mountHorse(h) { const p = G.p; if (!h || p.mounted || p.atk || p.drawing) return; p.mounted = h; h.called = false; h.grazing = false; p.horseSpeed = 0; p.crouch = false; p.swim = false; h.rig.root.updateMatrixWorld(true); p.yaw = h.yaw; Sfx.play('snort', { vol: 0.8 }); Body.ride(true); }
function dismount() {
  const p = G.p, h = p.mounted; if (!h) return; if (Math.abs(p.horseSpeed) > 6) { UI.toast('Slow down first.'); return; }
  p.mounted = null; p.horseSpeed = 0; const side = h.yaw + Math.PI / 2; p.x = h.x + Math.sin(side) * 1.2; p.z = h.z + Math.cos(side) * 1.2; collideCircle(p, P_R, h.y, 1.6); p.y = floorAt(p.x, p.z, h.y + 1.5); p.vy = 0; p.onGround = true; p.peakY = p.y; Body.ride(false); h.stateT = 3;
}
function whistle() {
  const p = G.p, h = G.horse; if (!p || p.dead || !h) return; Sfx.play('whistle'); if (p.mounted || G.area !== 'outside') return;
  later(0.6, () => { if (!G.horse) return; h.called = true; h.calledT = 0; Sfx.play('neigh', { x: h.x, y: h.y + 1.5, z: h.z, range: 200 }); if (Math.hypot(h.x - p.x, h.z - p.z) > 150) { const a = rand(0, TAU); h.x = p.x + Math.sin(a) * 70; h.z = p.z + Math.cos(a) * 70; h.y = floorAt(h.x, h.z); } });
}
// ---------- the camera ----------
const CAM = { third: false, dist: 3.2, fovK: 0, roll: 0, sway: [0, 0], dip: 0, cine: null };
const _cq = new THREE.Vector3(), _ct = new THREE.Vector3();
function updateCamera(dt) {
  const p = G.p; if (!p) return;
  if (CAM.cine) { CAM.cine(dt); return; }
  const eye = p.mounted ? 1.85 : p.crouch ? 1.12 : p.swim ? 1.5 : P_EYE;
  let bobY = 0, bobX = 0; const hs = Math.hypot(p.vx, p.vz);
  if ((p.onGround || p.mounted) && hs > 0.5) { const a = p.mounted ? 0.05 : clamp(hs / 7, 0, 1) * 0.06; bobY = Math.abs(Math.sin(p.bob * 1.6)) * a; bobX = Math.sin(p.bob * 0.8) * a * 0.6; }
  CAM.dip = damp(CAM.dip, p.landT > 0 ? -0.12 : 0, 12, dt);
  let shake = 0; if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt * 1.8); shake = G.shake * 0.08; }
  const roll = (p.dodgeT > 0 ? -(p.dodgeSide || 0) * 0.08 : 0) + (p.mounted ? -angDiff(p.mounted.yaw, p.yaw) * 0.02 : 0);
  CAM.roll = damp(CAM.roll, roll, 10, dt);
  let hx = p.x, hy = p.y + eye + bobY + CAM.dip, hz = p.z;
  if (p.dead) { const k = smooth(clamp(p.deadT / 1.2, 0, 1)); hy = lerp(hy, floorAt(p.x, p.z, p.y) + 0.25, k); CAM.roll = k * 0.9; }
  camera.rotation.set(p.pitch + rand(-1, 1) * shake, p.yaw + Math.PI + rand(-1, 1) * shake, CAM.roll, 'YXZ');
  const third = CAM.third || p.dead;
  if (third) {
    const d = (p.mounted ? 5.2 : CAM.dist) * (p.dead ? 1.3 : 1); _camF.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const [rx, rz] = [-Math.cos(p.yaw), Math.sin(p.yaw)], side = p.mounted ? 0 : 0.55;
    let cx = hx - _camF.x * d + rx * side, cy = hy + 0.25 - _camF.y * d, cz = hz - _camF.z * d + rz * side;
    // pull in so the camera doesn't sink into the ground or a wall
    for (let i = 0; i < 6; i++) { const t = (i + 1) / 6, x = lerp(hx, cx, t), z = lerp(hz, cz, t), y = lerp(hy, cy, t), e = { x, z }; if (y < floorAt(x, z, y + 1) + 0.3 || collideCircle(e, 0.2, y - 0.2, 0.4)) { const tt = Math.max(0.15, (i - 0.5) / 6); cx = lerp(hx, cx, tt); cy = lerp(hy, cy, tt); cz = lerp(hz, cz, tt); break; } }
    cy = Math.max(cy, floorAt(cx, cz, cy + 1) + 0.3);
    camera.position.set(cx, cy, cz);
  } else camera.position.set(hx + Math.cos(p.yaw) * bobX * -1, hy, hz + Math.sin(p.yaw) * bobX);
  // bow zoom and sprint stretch
  const fovT = SET.fov - (p.drawing ? p.draw * 14 : 0) + (p.sprinting ? 6 : 0) + (p.mounted && Math.abs(p.horseSpeed) > 10 ? 8 : 0) + (G.slowmo < 1 ? -8 : 0);
  camera.fov = damp(camera.fov, fovT, 8, dt); camera.updateProjectionMatrix();
  Body.update(dt, third); VM.update(dt, !third);
}
// ---------- your body in third person (and its shadow in first person) ----------
const Body = {
  rig: null, sword: null, shield: null, bow: null, anim: { speed: 0, phase: 0, attack: -1, t: 0 }, riding: false,
  rebuild() {
    if (this.rig) scene.remove(this.rig.root); if (!G.save) return; const P = G.save.player;
    this.rig = buildHuman(lookWithArmor(P), { pants: 0x2a2420 }); scene.add(this.rig.root);
    this.sword = buildSword(P.eq.sword); this.sword.rotation.x = Math.PI / 2; this.sword.position.set(0, -0.06, 0.02); this.rig.handR.add(this.sword);
    if (P.eq.shield) { this.shield = buildShield(P.eq.shield); this.shield.position.set(-0.08, -0.05, 0.08); this.shield.rotation.y = -Math.PI / 2; this.rig.handL.add(this.shield); } else this.shield = null;
    if (P.eq.bow) { this.bow = buildBow(P.eq.bow); this.bow.position.set(0, 0.2, -0.22); this.bow.rotation.set(0, Math.PI / 2, 0.3); this.rig.spine.add(this.bow); } else this.bow = null;
    this.rig.root.traverse((m) => { if (m.isMesh) { m.userData.player = true; m.castShadow = true; m.userData.fp = m.material; } });
    this.fp = null; this.ride(!!(G.p && G.p.mounted));
  },
  ride(on) { this.riding = on; },
  update(dt, visible) {
    const p = G.p, r = this.rig; if (!r) return;
    r.root.visible = G.area === 'outside' || visible; this.setFirstPerson(!visible); // in first person the body only casts a shadow
    const yaw = p.mounted ? p.mounted.yaw : p.yaw;
    r.root.position.set(p.x, p.y - (p.swim ? 0.25 : 0) + (p.crouch ? -0.35 : 0), p.z); r.root.rotation.set(0, yaw, 0);
    const A = this.anim; A.t = G.time; A.speed = p.mounted ? 0 : Math.hypot(p.vx, p.vz); A.phase += dt * A.speed * 1.6 + (p.swim ? dt * 3 : 0); A.air = !p.onGround && !p.swim && !p.mounted;
    A.attack = p.atk ? p.atk.t / p.atk.dur : -1; A.atkKind = 'slash'; A.block = p.block; A.draw = p.drawing ? p.draw : -1; A.cast = p.castT > 0 ? p.castT / 0.4 : 0; A.dead = p.dead ? p.deadT * 1.5 : 0; A.look = 0;
    animate(r, A, dt);
    if (this.bow) { if (p.drawing) { if (this.bow.parent !== r.handL) { r.handL.add(this.bow); this.bow.position.set(0, -0.08, 0.04); this.bow.rotation.set(Math.PI / 2, 0, 0); } } else if (this.bow.parent !== r.spine) { r.spine.add(this.bow); this.bow.position.set(0, 0.2, -0.22); this.bow.rotation.set(0, Math.PI / 2, 0.3); } }
    if (p.mounted) { // sitting in the saddle
      r.thighL.rotation.set(-1.35, 0, 0.35); r.thighR.rotation.set(-1.35, 0, -0.35); r.shinL.rotation.x = 1.25; r.shinR.rotation.x = 1.25; r.spine.rotation.x = 0.05 + Math.sin(p.bob * 2) * 0.03; r.hips.position.y = 0.98;
      if (!p.atk && !p.drawing && p.castT <= 0) { r.shoulderL.rotation.set(-0.7, 0, 0.1); r.shoulderR.rotation.set(-0.7, 0, -0.1); r.elbowL.rotation.x = -0.6; r.elbowR.rotation.x = -0.6; }
    }
    if (p.crouch && !p.mounted) { r.thighL.rotation.x -= 0.9; r.thighR.rotation.x -= 0.9; r.shinL.rotation.x += 1.2; r.shinR.rotation.x += 1.2; r.spine.rotation.x += 0.3; }
  },
  fp: null,
  setFirstPerson(on) {
    if (this.fp === on) return; this.fp = on;
    // first person: hide the body from the camera but keep its shadow (shadow-only material trick: colorWrite off)
    this.rig.root.traverse((m) => { if (!m.isMesh) return; if (on) { if (!m.userData.shadowMat) { m.userData.shadowMat = m.material.clone(); m.userData.shadowMat.colorWrite = false; m.userData.shadowMat.depthWrite = false; } m.material = m.userData.shadowMat; } else if (m.userData.fp) m.material = m.userData.fp; });
  },
};
function lookWithArmor(P) { const L = lookOf(P.look), a = ITEMS[P.eq.armor]; if (a && a.id !== 'traveler' && a.col != null) L.coat = a.col; return L; }
function lookOf(L) { // save look (option indexes) -> model look
  const O = LOOK_OPTS; L = L || LOOK_PRESETS.rookie;
  return { body: L.body, skin: O.skin[L.skin] || O.skin[1], face: L.face, hair: L.hair, hairCol: O.hairCol[L.hairCol] || O.hairCol[0], beard: L.beard, scar: L.scar, eyes: O.eyes[L.eyes] || O.eyes[0], coat: O.coat[L.coat] || O.coat[0], shirt: O.shirt[L.shirt] || O.shirt[0] };
}
// ---------- first-person arms ----------
// poses for the sword hand: [x, y, z, rotX, rotY, rotZ] in front of the camera
const VPOSE = {
  rest: [0.27, -0.3, -0.5, -0.45, 0.25, -0.3],
  w0: [0.5, -0.02, -0.42, 0.25, 0.35, -1.3], h0: [-0.38, -0.34, -0.55, -1.1, -0.3, 1.55],
  w1: [-0.3, 0.0, -0.45, 0.25, -0.35, 1.3], h1: [0.48, -0.36, -0.55, -1.1, 0.3, -1.55],
  w2: [0.16, 0.24, -0.3, 0.95, 0, -0.15], h2: [0.02, -0.56, -0.62, -2.0, 0, 0],
  block: [0.3, -0.25, -0.48, -0.2, 0.6, -0.9], ride: [0.3, -0.36, -0.5, -0.8, 0.25, -0.4],
};
const VM = {
  root: null, hand: null, sword: null, off: null, shield: null, bow: null, arrow: null, spell: null, poseNow: VPOSE.rest.slice(), drop: 0,
  rebuild() {
    if (this.root) vmScene.remove(this.root); if (!G.save) return; const P = G.save.player, L = lookWithArmor(P);
    const coat = new THREE.MeshStandardMaterial({ color: L.coat, roughness: 0.9 }), skin = new THREE.MeshStandardMaterial({ color: L.skin, roughness: 0.6 }), glove = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.8 });
    this.root = new THREE.Group(); vmScene.add(this.root);
    const arm = (side) => {
      const hand = new THREE.Group(); this.root.add(hand);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.1), glove); hand.add(fist);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.55, 8), coat); fore.position.set(side * 0.06, -0.12, 0.26); fore.rotation.x = Math.PI / 2 - 0.45; fore.rotation.z = side * -0.2; hand.add(fore);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.8 })); cuff.position.set(side * 0.01, -0.02, 0.05); cuff.rotation.x = Math.PI / 2 - 0.45; hand.add(cuff);
      return hand;
    };
    this.hand = arm(1); this.off = arm(-1);
    this.sword = buildSword(P.eq.sword); this.sword.position.set(0, 0, 0); this.hand.add(this.sword);
    this.shield = P.eq.shield ? buildShield(P.eq.shield) : null; if (this.shield) { this.shield.position.set(0.02, 0.02, -0.06); this.off.add(this.shield); }
    this.bow = P.eq.bow ? buildBow(P.eq.bow) : null; if (this.bow) { this.bow.rotation.set(0, Math.PI, 0.18); this.bow.position.set(0, 0.0, -0.02); this.off.add(this.bow); this.bow.visible = false; this.arrow = buildArrow(P.eq.arrow || 'arrow'); this.bow.add(this.arrow); }
    this.spell = new THREE.Sprite(MAT.glow.clone()); this.spell.scale.setScalar(0.25); this.spell.position.set(0, 0.08, -0.06); this.off.add(this.spell); this.spell.visible = false;
    this.root.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; } });
  },
  update(dt, visible) {
    if (!this.root) return; this.root.visible = visible && !G.p.dead; if (!this.root.visible) return;
    const p = G.p; let pose = p.mounted ? VPOSE.ride : VPOSE.rest;
    if (p.atk) {
      const a = p.atk, t = a.t / a.dur, v = a.kind === 'heavy' ? 2 : a.step, W = VPOSE['w' + v], H = VPOSE['h' + v], wa = a.kind === 'heavy' ? 0.45 : 0.3, hb = a.kind === 'heavy' ? 0.62 : 0.55;
      const rest = p.mounted ? VPOSE.ride : VPOSE.rest;
      if (t < wa) pose = mixPose(rest, W, 1 - (1 - t / wa) ** 2); else if (t < hb) pose = mixPose(W, H, ((t - wa) / (hb - wa)) ** 1.6); else pose = mixPose(H, rest, smooth((t - hb) / (1 - hb)));
    } else if (p.block) pose = VPOSE.block;
    const k = p.atk ? 40 : 14; for (let i = 0; i < 6; i++) this.poseNow[i] = damp(this.poseNow[i], pose[i], k, dt);
    // drop the sword away while drawing the bow or drinking
    this.drop = damp(this.drop, p.drawing || p.drinkT > 0 ? 1 : 0, 12, dt);
    const hs = Math.hypot(p.vx, p.vz), bx = Math.sin(p.bob * 0.8) * 0.012 * clamp(hs / 4, 0, 1.5), by = -Math.abs(Math.sin(p.bob * 0.8)) * 0.014 * clamp(hs / 4, 0, 1.5) + Math.sin(G.time * 1.6) * 0.004;
    const P = this.poseNow; this.hand.position.set(P[0] + bx, P[1] + by - this.drop * 0.5, P[2]); this.hand.rotation.set(P[3], P[4], P[5]);
    // the off hand: shield, bow or a spell
    let o = [-0.42, -0.5, -0.55, 0, 0.45, 0];
    if (p.block && this.shield) o = [-0.1, -0.2, -0.4, 0.05, 0.15, 0];
    else if (p.block) o = [-0.22, -0.18, -0.42, 0.3, 0.3, 0.6];
    if (p.drawing && this.bow) o = [-0.1 - p.draw * 0.04, -0.12, -0.55, 0, 0.05, 0.12];
    if (p.castT > 0) o = [-0.2, -0.2, -0.48 - p.castT * 0.2, 0.3, 0, 0];
    if (p.drinkT > 0) o = [-0.08, -0.08 + Math.sin(p.drinkT * 6) * 0.02, -0.3, 1.2, 0, 0];
    const O = (this.offNow = this.offNow || o.slice()); for (let i = 0; i < 6; i++) O[i] = damp(O[i], o[i], 16, dt);
    this.off.position.set(O[0] - bx, O[1] + by, O[2]); this.off.rotation.set(O[3], O[4], O[5]);
    if (this.shield) this.shield.visible = !p.drawing && p.castT <= 0 && p.drinkT <= 0;
    if (this.bow) { this.bow.visible = p.drawing; if (p.drawing) { const pull = p.draw * 0.42, s = this.bow.userData.string.geometry.attributes.position; s.setZ(1, -pull); s.needsUpdate = true; this.arrow.position.set(0, 0, 0.36 - pull); this.arrow.visible = invCount(G.save.player.eq.arrow) > 0; } }
    this.spell.visible = p.castT > 0; if (this.spell.visible) { this.spell.material.color.setHex(SPELLS[p.lastSpell] ? SPELLS[p.lastSpell].col : 0xffffff); this.spell.scale.setScalar(0.2 + p.castT); }
  },
};
function mixPose(a, b, t) { const o = []; for (let i = 0; i < 6; i++) o.push(lerp(a[i], b[i], t)); return o; }
