
// ---------- tiny 3x5 pixel font for in-world labels (cached per string + colour) ----------
const GLYPH = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '1000111011101011000110001', N: '1000111001101011001110001',
  O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '1000110001101011101110001', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111',
  7: '111001010010010', 8: '111101111101111', 9: '111101111001110', ' ': '000000000000000', '!': '010010010000010', '+': '000010111010000', '-': '000000111000000',
  '.': '000000000000010', ':': '000010000010000', '/': '001001010100100', "'": '010010000000000', '?': '110001010000010', '*': '101010101000000',
};
const _tt = new Map();
function tinyCanvas(str, col) {
  const key = str + '|' + col; let c = _tt.get(key); if (c) return c;
  if (_tt.size > 500) _tt.clear();
  const s = String(str).toUpperCase(), gl = [...s].map((ch) => GLYPH[ch] || GLYPH['?']);
  const w = gl.reduce((a, g) => a + g.length / 5 + 1, 0) + 1; const [cv, x] = mkCanvas(w, 7);
  for (const pass of [0, 1]) {
    x.fillStyle = pass ? col : '#0a0610'; let ox = 1;
    for (const g of gl) { const gw = g.length / 5; for (let k = 0; k < g.length; k++) if (g[k] === '1') { const gx = ox + (k % gw), gy = 1 + ((k / gw) | 0); if (pass) x.fillRect(gx, gy, 1, 1); else x.fillRect(gx - 1, gy - 1, 3, 3); } ox += gw + 1; }
  }
  _tt.set(key, cv); return cv;
}
function tinyText(ctx, str, x, y, col = '#ffffff', scale = 1, align = 'center') {
  const c = tinyCanvas(str, col), w = c.width * scale;
  ctx.drawImage(c, Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x), Math.round(y - 6 * scale), w, c.height * scale);
}

// ---------- view & camera ----------
const canvas = $('#game'), ctx = canvas.getContext('2d');
const VIEW = { w: 480, h: 270, z: 3 };
const [lightC, lightX] = mkCanvas(480, 270);
function resize() {
  const cw = window.innerWidth, ch = window.innerHeight;
  let z = Math.max(2, Math.floor(Math.min(cw / 360, ch / 230)));
  z = clamp(z + SET.zoom, 1, 9);
  VIEW.z = z; VIEW.w = Math.ceil(cw / z); VIEW.h = Math.ceil(ch / z);
  canvas.width = VIEW.w; canvas.height = VIEW.h; canvas.style.width = VIEW.w * z + 'px'; canvas.style.height = VIEW.h * z + 'px';
  lightC.width = VIEW.w; lightC.height = VIEW.h;
  ctx.imageSmoothingEnabled = false; lightX.imageSmoothingEnabled = false;
}
function camTarget() {
  const m = G.area.map, mw = m.w * 16, mh = m.h * 16;
  let x = G.p.x - VIEW.w / 2, y = G.p.y - 10 - VIEW.h / 2;
  x = mw <= VIEW.w ? (mw - VIEW.w) / 2 : clamp(x, 0, mw - VIEW.w);
  y = mh <= VIEW.h ? (mh - VIEW.h) / 2 : clamp(y, 0, mh - VIEW.h);
  return [x, y];
}
function snapCam() { if (!G.area) return; const [x, y] = camTarget(); G.cam.x = x; G.cam.y = y; }

// ---------- per-frame world update ----------
const spikeUp = (t) => (G.time + t.ph) % 2.4 < 0.9;
let FOUNTAIN = null;
function los(x0, y0, x1, y1) {
  const m = G.area.map, d = dist(x0, y0, x1, y1), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n); if (solidAt(m, Math.floor(x / 16), Math.floor(y / 16))) return false; }
  return true;
}
function nearestMon(range) { let best = null, bd = range; for (const m of G.mons) { if (m.dead) continue; const d = dist(m.x, m.y, G.p.x, G.p.y); if (d < bd && los(G.p.x, G.p.y - 8, m.x, m.y - 8)) { bd = d; best = m; } } return best; }
function updatePlayer(dt) {
  const p = G.p; if (G.dead) return;
  p.atkCd -= dt; p.atkT = Math.max(0, p.atkT - dt); p.dodgeCd -= dt; p.hurtCd -= dt; p.hurtT = Math.max(0, p.hurtT - dt);
  p.blockLock -= dt; p.staDelay -= dt; p.webT -= dt; p.burnCd -= dt;
  let mx = 0, my = 0;
  if (Input.down('a') || Input.down('arrowleft')) mx -= 1; if (Input.down('d') || Input.down('arrowright')) mx += 1;
  if (Input.down('w') || Input.down('arrowup')) my -= 1; if (Input.down('s') || Input.down('arrowdown')) my += 1;
  if (Input.stick.on) { mx = Input.stick.x; my = Input.stick.y; }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  // aim: mouse, or nearest enemy on touch screens
  if (Input.touchMode) { const t = nearestMon(150); if (t) { const [cx, cy] = monCenter(t); p.aim = Math.atan2(cy - (p.y - 10), cx - p.x); } else if (ml > 0.2) p.aim = Math.atan2(my, mx); }
  else p.aim = Math.atan2(Input.my + G.cam.y - (p.y - 10), Input.mx + G.cam.x - p.x);
  p.face = Math.cos(p.aim) < 0 ? -1 : 1;
  // block (F) needs a shield
  const sh = shieldDef(), want = Input.down('f') || Input.tBlock;
  if (want && !sh && !p.noShieldMsg) { p.noShieldMsg = true; UI.toast('You need a shield to block! Brom sells them at the forge.', 'bad'); Sfx.play('error'); }
  if (!want) p.noShieldMsg = false;
  const blk = !!(want && sh && p.blockLock <= 0 && p.dodgeT <= 0), tap = Input.take('blockTap');
  if (blk && (!p.blocking || tap)) p.blockStart = G.time;
  p.blocking = blk;
  // dodge roll (C)
  if (Input.take('dodge')) {
    if (p.dodgeT <= 0 && p.dodgeCd <= 0 && p.sta >= 20) {
      const dl = Math.hypot(mx, my); p.dvx = dl > 0.1 ? mx / dl : Math.cos(p.aim); p.dvy = dl > 0.1 ? my / dl : Math.sin(p.aim);
      p.dodgeT = 0.3; p.dodgeCd = 0.55; p.sta -= 20; p.staDelay = 0.5; p.blocking = false; Sfx.play('dodge'); burst(p.x, p.y, 8, '#b8a888', 40);
    } else if (p.sta < 20 && p.dodgeT <= 0) addText(p.x, p.y - 26, 'TOO TIRED', '#e9d35a');
  }
  let spd = 80; if (p.blocking) spd *= 0.45; if (p.atkT > 0 && weaponDef().wc === 'melee') spd *= 0.75; if (p.webT > 0) spd *= 0.4;
  if (p.dodgeT > 0) { p.dodgeT -= dt; moveEntity(p, p.dvx * 215 * dt, p.dvy * 215 * dt, false); p.moving = true; p.walk += dt * 16; if (chance(0.5)) G.parts.push({ x: p.x + rand(-3, 3), y: p.y, vx: 0, vy: -10, life: 0.3, max: 0.3, col: '#b8a888', size: 1, grav: 0 }); }
  else if (ml > 0.05) { moveEntity(p, mx * spd * dt, my * spd * dt, false); p.moving = true; p.walk += dt * 10 * (spd / 80); }
  else p.moving = false;
  if (p.kbx || p.kby) { moveEntity(p, p.kbx * dt, p.kby * dt, false); const k = Math.pow(0.002, dt); p.kbx *= k; p.kby *= k; if (Math.abs(p.kbx) + Math.abs(p.kby) < 4) p.kbx = p.kby = 0; }
  if (!p.blocking && p.dodgeT <= 0 && p.staDelay <= 0) p.sta = Math.min(p.maxSta, p.sta + 34 * dt);
  if ((Input.mouseDown || Input.tAtk) && p.atkCd <= 0 && p.dodgeT <= 0 && !p.blocking) playerAttack();
  // hazards
  const map = G.area.map, tier = G.area.def ? G.area.def.tier : 1;
  if (tileAt(map, Math.floor(p.x / 16), Math.floor(p.y / 16)) === T.LAVA && p.dodgeT <= 0 && p.burnCd <= 0) { p.burnCd = 0.5; hurtPlayer(6 + tier * 3, p.x, p.y, { hazard: true }); burst(p.x, p.y - 4, 6, '#ff7a2a', 40); }
  for (const t of G.area.traps) { t.cd -= dt; if (t.cd <= 0 && spikeUp(t) && p.dodgeT <= 0 && Math.abs(p.x - t.x) < 9 && Math.abs(p.y - 2 - t.y) < 9) { t.cd = 0.9; hurtPlayer(8 + tier * 4, p.x, p.y, { hazard: true }); } }
  // healing fountain + slow regen out of combat
  if (G.area.kind === 'overworld' && FOUNTAIN && dist(p.x, p.y, FOUNTAIN.x, FOUNTAIN.y) < 38) {
    const mx2 = maxHpFor(S().level); if (p.hp < mx2) { p.hp = Math.min(mx2, p.hp + 20 * dt); if (chance(dt * 8)) G.parts.push({ x: p.x + rand(-6, 6), y: p.y - rand(0, 16), vx: 0, vy: -20, life: 0.6, max: 0.6, col: '#7dff8a', size: 1, grav: 0 }); UI.hudDirty(); }
  } else if (p.hurtCd < -5 && p.hp < maxHpFor(S().level)) { p.hp = Math.min(maxHpFor(S().level), p.hp + 1.5 * dt); }
  // light up the dungeon map as you explore
  if (map.explored) { const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16); for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 7; x <= tx + 7; x++) if (x >= 0 && y >= 0 && x < map.w && y < map.h) map.explored[y * map.w + x] = 1; }
}
function updateNPCs(dt) {
  for (const n of G.area.npcs) {
    n.wait -= dt;
    if (n.wait <= 0 && n.wander > 0) { n.wait = rand(2, 6); for (let k = 0; k < 8; k++) { const tx = n.home[0] + rand(-n.wander, n.wander), ty = n.home[1] + rand(-n.wander * 0.6, n.wander * 0.6); if (!blockedBox({ w: 8, h: 6 }, tx, ty, false) && inTownPx(tx, ty)) { n.tx = tx; n.ty = ty; break; } } }
    const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
    if (d > 2) { const e = { x: n.x, y: n.y, w: 8, h: 6 }; if (moveEntity(e, (dx / d) * 28 * dt, (dy / d) * 28 * dt, false) && d < 40) { n.tx = n.x; n.ty = n.y; } n.x = e.x; n.y = e.y; n.moving = true; n.walk += dt * 8; n.face = dx < 0 ? -1 : 1; }
    else { n.moving = false; const pd = dist(n.x, n.y, G.p.x, G.p.y); if (pd < 60) n.face = G.p.x < n.x ? -1 : 1; }
  }
}
function separateMons() {
  const L = G.mons;
  for (let i = 0; i < L.length; i++) { const a = L[i]; if (a.dead || a.d.ghost) continue;
    for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (b.dead || b.d.ghost) continue; const dx = b.x - a.x, dy = b.y - a.y, r = (a.w + b.w) / 2; if (Math.abs(dx) > r || Math.abs(dy) > r) continue; const d = Math.hypot(dx, dy) || 0.1; if (d < r) { const push = (r - d) / 2, ux = dx / d, uy = dy / d; if (!a.boss) moveEntity(a, -ux * push, -uy * push, true); if (!b.boss) moveEntity(b, ux * push, uy * push, true); } } }
}
function updateWorld(dt) {
  G.time += dt; G.save.stats.playTime += dt;
  for (let i = G.later.length - 1; i >= 0; i--) if (G.time >= G.later[i].t) { const f = G.later[i].fn; G.later.splice(i, 1); f(); }
  updatePlayer(dt);
  updateFlow();
  for (const m of G.mons) if (!m.dead) updateMon(m, dt);
  separateMons();
  G.mons = G.mons.filter((m) => !m.dead);
  updateProjs(dt); updatePicks(dt); updateNPCs(dt);
  if (G.area.kind === 'overworld') { G.zoneT -= dt; if (G.zoneT <= 0) { G.zoneT = 4; for (const z of G.area.zones) { const n = G.mons.filter((m) => m.zone === z).length; if (n < z.max) zoneSpawn(z, false); } } }
  for (const q of G.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; q.vx *= 0.96; q.vy *= 0.96; }
  G.parts = G.parts.filter((q) => q.life > 0);
  for (const t of G.texts) { t.life -= dt; t.y -= 18 * dt; }
  G.texts = G.texts.filter((t) => t.life > 0);
  for (const f of G.fx) f.life -= dt;
  G.fx = G.fx.filter((f) => f.life > 0);
  if (G.area.kind === 'overworld') for (const pr of G.area.props) if (pr.smoke && chance(dt * 3)) G.parts.push({ x: pr.x + pr.w - 12 + rand(-2, 2), y: pr.y - pr.h + 2, vx: rand(-4, 4), vy: -14, life: 1.6, max: 1.6, col: '#8f897c', size: 2, grav: 0 });
  G.shake = Math.max(0, G.shake - dt * 18);
  const [tx, ty] = camTarget(), k = 1 - Math.pow(0.0001, dt); G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
  G.autosaveT += dt; if (G.autosaveT > 45) { G.autosaveT = 0; saveGame(true); }
}

// ---------- drawing ----------
function drawWeapon(c, p) {
  const w = weaponDef(); if (!w.id) return; const icon = itemIcon(w.id), t = ICON_T[w.icon];
  const hx = p.x + p.face * 5, hy = p.y - 7;
  let ang = p.aim;
  if (w.wc === 'melee') { if (p.atkT > 0) { const prog = 1 - p.atkT / 0.2, arc = (w.arc * Math.PI) / 180; ang = p.aim + p.swing * (-arc / 2 + arc * prog); } else ang = p.aim - p.face * 0.9; }
  else if (w.wc === 'staff') ang = p.aim - p.face * 0.5;
  c.save(); c.translate(Math.round(hx), Math.round(hy)); c.rotate(ang - t.a); c.drawImage(icon, -t.g[0], -t.g[1]); c.restore();
}
function drawPlayer(c) {
  const p = G.p; if (G.dead) { px(c, p.x - 7, p.y - 4, 14, 4, '#7a1a1e'); return; }
  if (p.hurtCd > 0.2 && Math.floor(G.time * 30) % 2) return;
  shadow(c, p.x, p.y, 6);
  const arm = armorDef(), sh = shieldDef(), behind = Math.sin(p.aim) < -0.25;
  if (p.dodgeT > 0) c.globalAlpha = 0.65;
  if (behind) drawWeapon(c, p);
  if (sh && !p.blocking) c.drawImage(itemIcon(sh.id), Math.round(p.x - p.face * 6 - 6), Math.round(p.y - 16), 12, 12);
  drawHuman(c, p.x, p.y, HERO_LOOK, { face: p.face, moving: p.moving, walk: p.walk, armor: arm && arm.color, trim: arm && arm.trim, helm: arm && arm.def >= 22 ? arm.color : null });
  if (!behind) drawWeapon(c, p);
  if (sh && p.blocking) { const bx = p.x + Math.cos(p.aim) * 9, by = p.y - 10 + Math.sin(p.aim) * 7; c.drawImage(itemIcon(sh.id), Math.round(bx - 8), Math.round(by - 8), 16, 16); if (G.time - p.blockStart < (sh.parry || 0.2)) { c.globalAlpha = 0.5; c.drawImage(whiteOf(itemIcon(sh.id)), Math.round(bx - 8), Math.round(by - 8), 16, 16); } }
  c.globalAlpha = 1;
}
function drawMon(c, m) {
  const d = m.d, sc = d.scale || 1, fr = monFrames(m.type), lift = monLift(m);
  let img;
  if (d.art === 'human') img = fr[m.moving ? Math.floor(m.walk * 0.7) % 4 : 0];
  else if (d.art === 'bat') img = fr[Math.floor(m.t * 10) % 2];
  else if (fr.length > 1) img = fr[m.moving ? Math.floor(m.walk * 0.6) % 2 : 0];
  else img = fr[0];
  if (m.face < 0) img = flipped(img);
  if (m.flash > 0) img = whiteOf(img); else if (m.wind > 0 && Math.floor(G.time * 14) % 2) img = redOf(img);
  let w = img.width * sc, h = img.height * sc;
  if (d.art === 'slime') { const air = m.hopT > 0.55 && (m.hvx || m.hvy); const s = air ? 1.12 : 1 + Math.sin(m.t * 5) * 0.05; h *= s; w /= s; }
  if (!d.ghost) shadow(c, m.x, m.y, Math.max(5, m.w * 0.7));
  if (d.alpha) c.globalAlpha = d.alpha * (0.85 + Math.sin(m.t * 4) * 0.15);
  const dx = d.art === 'human' ? m.x - (w * 10) / 20 : m.x - w / 2, dy = d.art === 'human' ? m.y - (h * 25) / 26 - lift : m.y - h + 1 - lift;
  c.drawImage(img, Math.round(dx), Math.round(dy), Math.round(w), Math.round(h));
  c.globalAlpha = 1;
  if (d.crown) { const cx = Math.round(m.x - 8), cy = Math.round(dy - 2); px(c, cx, cy + 2, 16, 4, '#f2c13a'); px(c, cx, cy, 2, 2, '#f2c13a'); px(c, cx + 7, cy - 1, 2, 3, '#f2c13a'); px(c, cx + 14, cy, 2, 2, '#f2c13a'); px(c, cx + 7, cy + 3, 2, 2, '#d8454a'); }
  if (m.wind > 0 && (m.pending === 'lunge' || (m.pending && m.pending.startsWith('charge')))) { c.strokeStyle = 'rgba(255,60,60,.5)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(m.x, m.y - 4); c.lineTo(G.p.x, G.p.y - 4); c.stroke(); c.setLineDash([]); }
  m._top = dy;
}
function drawNPC(c, n) { shadow(c, n.x, n.y, 6); drawHuman(c, n.x, n.y, n.look, { face: n.face, moving: n.moving, walk: n.walk }); }
function drawProj(c, b) {
  const a = Math.atan2(b.vy, b.vx), x = Math.round(b.x), y = Math.round(b.y);
  if (b.kind === 'arrow' || b.kind === 'frost') { c.strokeStyle = b.kind === 'frost' ? '#9fe8ff' : '#8a5a2b'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6); c.lineTo(x, y); c.stroke(); px(c, x - 1, y - 1, 2, 2, b.kind === 'frost' ? '#ffffff' : '#d7dde6'); }
  else if (b.kind === 'web') { c.strokeStyle = '#efe4cc'; c.beginPath(); c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); c.moveTo(x, y - 4); c.lineTo(x, y + 4); c.stroke(); }
  else if (b.kind === 'slime') { px(c, x - 2, y - 2, 5, 5, '#2f7a3c'); px(c, x - 1, y - 2, 3, 3, '#5cc46e'); }
  else { const outer = b.kind === 'soul' ? '#3a8aa0' : '#d8452a', mid = b.kind === 'soul' ? '#7ff8ff' : '#ff9a3a', core = b.kind === 'soul' ? '#e0ffff' : '#ffe08a'; const r = b.kind === 'pfire' ? 3 : 2; px(c, x - r - 1, y - r - 1, r * 2 + 3, r * 2 + 3, outer); px(c, x - r, y - r, r * 2 + 1, r * 2 + 1, mid); px(c, x - 1, y - 1, 2, 2, core); }
}
function drawDeco(c, o) {
  const x = Math.round(o.x), y = Math.round(o.y);
  if (o.kind === 'shroom') { px(c, x, y - 1, 1, 3, '#efe4cc'); px(c, x - 2, y - 3, 5, 2, o.v ? '#d8454a' : '#9be04a'); px(c, x - 1, y - 3, 1, 1, '#ffffff'); }
  else if (o.kind === 'bones') { px(c, x - 3, y, 6, 1, '#cfc6b4'); px(c, x - 4, y - 1, 2, 3, '#cfc6b4'); px(c, x + 2, y - 1, 2, 3, '#cfc6b4'); if (o.v === 2) { px(c, x + 4, y - 3, 3, 3, '#cfc6b4'); px(c, x + 5, y - 2, 1, 1, '#140d1a'); } }
  else if (o.kind === 'web') { c.strokeStyle = 'rgba(239,228,204,.35)'; c.beginPath(); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; c.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6); c.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); } c.stroke(); }
  else if (o.kind === 'ash') { px(c, x - 2, y, 5, 2, '#1e1210'); if (Math.floor(G.time * 3 + o.x) % 3 === 0) px(c, x, y - 1, 1, 1, '#ff7a2a'); }
}
function drawPortal(c, pt) {
  const x = Math.round(pt.x), y = Math.round(pt.y);
  for (let i = 0; i < 4; i++) { c.strokeStyle = ['#5a2a80', '#b878ea', '#7ff8ff', '#ffffff'][i]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, 11 - i * 2.5 + Math.sin(G.time * 4 + i) * 1, (11 - i * 2.5) * 1.3, 0, 0, TAU); c.stroke(); }
  if (chance(0.3)) G.parts.push({ x: x + rand(-8, 8), y: y + rand(-10, 10), vx: 0, vy: -16, life: 0.6, max: 0.6, col: '#b878ea', size: 1, grav: 0 });
}
function drawTorch(c, t) {
  const x = Math.round(t.x), y = Math.round(t.y), f = Math.floor(G.time * 10 + t.ph) % 3;
  px(c, x - 1, y, 2, 5, '#5a3418'); px(c, x - 2, y - 3 - f % 2, 4, 4, '#ff7a2a'); px(c, x - 1, y - 2 - f % 2, 2, 2, '#ffe08a');
}
function render() {
  ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  if (!G.area) return;
  const sx = G.shake > 0 ? rand(-G.shake, G.shake) : 0, sy = G.shake > 0 ? rand(-G.shake, G.shake) : 0;
  const cx = Math.round(G.cam.x + sx), cy = Math.round(G.cam.y + sy);
  const A = G.area, map = A.map, L = map.layer;
  ctx.save(); ctx.translate(-cx, -cy);
  const x0 = clamp(cx, 0, L.width), y0 = clamp(cy, 0, L.height), vw = Math.min(VIEW.w, L.width - x0), vh = Math.min(VIEW.h, L.height - y0);
  if (vw > 0 && vh > 0) ctx.drawImage(L, x0, y0, vw, vh, x0, y0, vw, vh);
  // animated water & lava
  const tx0 = Math.max(0, Math.floor(cx / 16)), ty0 = Math.max(0, Math.floor(cy / 16)), tx1 = Math.min(map.w - 1, Math.ceil((cx + VIEW.w) / 16)), ty1 = Math.min(map.h - 1, Math.ceil((cy + VIEW.h) / 16));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = map.t[ty * map.w + tx];
    if (t === T.WATER) { const ph = (G.time * 0.8 + hash2(tx, ty)) % 1; if (ph < 0.5) px(ctx, tx * 16 + 2 + ((ph * 20) | 0), ty * 16 + 5 + ((hash2(ty, tx) * 6) | 0), 3, 1, '#9fd0f0'); }
    else if (t === T.LAVA) { const ph = Math.sin(G.time * 3 + tx * 1.3 + ty); px(ctx, tx * 16 + 4 + ((ph * 3) | 0), ty * 16 + 6, 5, 3, ph > 0 ? '#ffd27a' : '#ff8a2a'); }
  }
  for (const o of A.decos) drawDeco(ctx, o);
  for (const t of A.traps) { const X = t.tx * 16, Y = t.ty * 16; px(ctx, X + 2, Y + 2, 12, 12, 'rgba(0,0,0,.3)'); for (let i = 0; i < 4; i++) { const sx2 = X + 3 + (i % 2) * 6, sy2 = Y + 3 + ((i / 2) | 0) * 6; if (spikeUp(t)) { px(ctx, sx2 + 1, sy2 - 1, 2, 4, '#d7dde6'); px(ctx, sx2 + 1, sy2 - 2, 1, 1, '#ffffff'); } else px(ctx, sx2, sy2 + 1, 4, 2, '#3a3a40'); } }
  for (const t of A.torches) drawTorch(ctx, t);
  for (const pt of A.portals) drawPortal(ctx, pt);
  for (const k of G.picks) {
    const bob = k.z > 0 ? 0 : Math.sin(G.time * 4 + k.x) * 1.2;
    if (k.kind === 'coin') { shadow(ctx, k.x, k.y, 3); ctx.drawImage(COIN_SPR, Math.round(k.x - 4), Math.round(k.y - 8 - k.z + bob)); }
    else { shadow(ctx, k.x, k.y, 4); const it = ITEMS[k.id]; if (it.rarity !== 'common' && Math.floor(G.time * 4) % 2) px(ctx, k.x + 5, k.y - 14 - k.z + bob, 1, 1, RCOL[it.rarity]); ctx.drawImage(itemIcon(k.id), Math.round(k.x - 6), Math.round(k.y - 13 - k.z + bob)); }
  }
  // y-sorted world objects
  const list = [];
  for (const pr of A.props) list.push([pr.y, () => ctx.drawImage(pr.img, pr.x, pr.y - pr.img.height)]);
  for (const ch of A.chests) list.push([ch.y, () => { ctx.drawImage(CHEST_SPR[ch.kind][ch.open ? 'open' : 'closed'], Math.round(ch.x - 8), Math.round(ch.y - 14)); if (ch.locked) { px(ctx, ch.x - 3, ch.y - 9, 6, 5, '#44464b'); px(ctx, ch.x - 2, ch.y - 12, 4, 3, '#44464b'); px(ctx, ch.x - 1, ch.y - 11, 2, 2, '#07050a'); } }]);
  for (const n of A.npcs) list.push([n.y, () => drawNPC(ctx, n)]);
  for (const m of G.mons) list.push([m.y, () => drawMon(ctx, m)]);
  if (G.on) list.push([G.p.y, () => drawPlayer(ctx)]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, fn] of list) fn();
  for (const b of G.projs) drawProj(ctx, b);
  for (const f of G.fx) {
    const t = f.life / f.max;
    if (f.kind === 'slash') { ctx.globalAlpha = t; ctx.strokeStyle = f.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.range * (1.05 - t * 0.25), f.ang - f.arc / 2, f.ang + f.arc / 2); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1; }
    else if (f.kind === 'ring') { ctx.globalAlpha = t; ctx.strokeStyle = f.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y, lerp(f.r1, f.r0, t), lerp(f.r1, f.r0, t) * 0.6, 0, 0, TAU); ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1; }
  }
  for (const q of G.parts) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); px(ctx, q.x, q.y, q.size, q.size, q.col); }
  ctx.globalAlpha = 1;
  ctx.restore();
  // dungeon darkness with torch light
  if (A.kind === 'dungeon') {
    lightX.globalCompositeOperation = 'source-over'; lightX.clearRect(0, 0, VIEW.w, VIEW.h); lightX.fillStyle = A.def.theme.dark; lightX.fillRect(0, 0, VIEW.w, VIEW.h);
    lightX.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { if (x < -r || y < -r || x > VIEW.w + r || y > VIEW.h + r) return; const g = lightX.createRadialGradient(x, y, r * 0.3, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lightX.fillStyle = g; lightX.fillRect(x - r, y - r, r * 2, r * 2); };
    hole(G.p.x - cx, G.p.y - 10 - cy, 100, 1);
    for (const t of A.torches) hole(t.x - cx, t.y - cy, 48 + Math.sin(G.time * 9 + t.ph) * 3, 0.8);
    for (const pt of A.portals) hole(pt.x - cx, pt.y - cy, 50, 0.9);
    if (G.bossMon && !G.bossMon.dead) hole(G.bossMon.x - cx, G.bossMon.y - 20 - cy, 70, 0.75);
    for (const b of G.projs) if (b.kind === 'fire' || b.kind === 'pfire' || b.kind === 'soul') hole(b.x - cx, b.y - cy, 26, 0.7);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (map.t[ty * map.w + tx] === T.LAVA) hole(tx * 16 + 8 - cx, ty * 16 + 8 - cy, 22, 0.5);
    ctx.drawImage(lightC, 0, 0);
  }
  // labels (drawn above the darkness so names stay readable)
  ctx.save(); ctx.translate(-cx, -cy);
  const p = G.p;
  if (A.kind === 'overworld') {
    const lv = G.save ? S().level : 99, beat = G.save ? G.save.stats.bosses : {};
    for (const e of A.entrances) { if (Math.abs(e.x - p.x) > VIEW.w || Math.abs(e.y - p.y) > VIEW.h) continue; const ok = lv >= e.d.lvl, done = beat[e.d.id]; tinyText(ctx, e.d.name, e.x, e.y - 44, done ? '#9be04a' : '#f2e6c8'); tinyText(ctx, ok ? 'LV ' + e.d.lvl + (done ? ' CLEARED' : '') : 'NEEDS LV ' + e.d.lvl, e.x, e.y - 37, ok ? '#f2c13a' : '#ff6a6a'); }
    for (const n of A.npcs) if (dist(n.x, n.y, p.x, p.y) < 90) tinyText(ctx, n.name, n.x, n.y - 24, n.shop ? '#f2c13a' : '#efe4cc');
  }
  for (const pt of A.portals) tinyText(ctx, 'EXIT', pt.x, pt.y - 18, '#d8b8ff');
  for (const m of G.mons) {
    if (A.kind === 'dungeon' && dist(m.x, m.y, p.x, p.y) > 150) continue;
    const top = (m._top == null ? m.y - 20 : m._top);
    if (!m.boss) { const bw = Math.max(14, Math.round(m.w * 1.4)), bx = Math.round(m.x - bw / 2), by = Math.round(top - 4); px(ctx, bx - 1, by - 1, bw + 2, 4, '#0a0610'); px(ctx, bx, by, Math.max(0, Math.round((bw * m.hp) / m.maxHp)), 2, m.poisonT > 0 ? '#9be04a' : '#e0404a'); }
    if (SET.names || m.boss) tinyText(ctx, m.d.name, m.x, top - (m.boss ? 3 : 6), m.boss ? '#ffb1a8' : '#efe4cc');
    if (m.wind > 0) tinyText(ctx, '!', m.x, top - 13, '#ff4040', 2);
    if (m.stun > 0) tinyText(ctx, '* *', m.x, top - 12, '#ffd23a');
  }
  for (const t of G.texts) { ctx.globalAlpha = clamp(t.life / t.max * 1.6, 0, 1); tinyText(ctx, t.txt, t.x, t.y, t.col, t.big ? 2 : 1); }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (G.p.hurtT > 0) { ctx.fillStyle = `rgba(200,30,40,${G.p.hurtT * 0.9})`; ctx.fillRect(0, 0, VIEW.w, 3); ctx.fillRect(0, VIEW.h - 3, VIEW.w, 3); ctx.fillRect(0, 0, 3, VIEW.h); ctx.fillRect(VIEW.w - 3, 0, 3, VIEW.h); }
}

// ---------- minimap & world map ----------
const TILE_COL = { [T.GRASS]: '#3f7a3a', [T.DGRASS]: '#376d34', [T.FLOWERS]: '#4a8a3a', [T.PATH]: '#a8865a', [T.WATER]: '#2f5f9a', [T.TREE]: '#1f4a22', [T.PLAZA]: '#a8a294', [T.SAND]: '#d6c08a', [T.BRIDGE]: '#8a5a2b', [T.ROCK]: '#6a6c72', [T.VOID]: '#07050a' };
let MINI_BASE = null;
function bakeMiniBase() {
  const m = WORLD.map; const [c, x] = mkCanvas(m.w, m.h);
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) { x.fillStyle = m.block[ty * m.w + tx] ? '#c8a06a' : TILE_COL[m.t[ty * m.w + tx]] || '#000'; x.fillRect(tx, ty, 1, 1); }
  MINI_BASE = c;
}
const miniC = $('#mini'), miniX = miniC.getContext('2d'); miniX.imageSmoothingEnabled = false;
function drawMini() {
  const A = G.area; if (!A) return; const p = G.p, W = 60, H = 40, s = 2;
  miniX.fillStyle = '#07050a'; miniX.fillRect(0, 0, 120, 80);
  const ptx = p.x / 16, pty = p.y / 16; const ox = Math.round(ptx - W / 2), oy = Math.round(pty - H / 2);
  if (A.kind === 'overworld') {
    miniX.drawImage(MINI_BASE, ox, oy, W, H, 0, 0, W * s, H * s);
    for (const e of A.entrances) { const ok = S().level >= e.d.lvl; const x = (e.tx - ox) * s, y = (e.ty - 1 - oy) * s; miniX.fillStyle = '#07050a'; miniX.fillRect(x - 3, y - 3, 7, 7); miniX.fillStyle = G.save.stats.bosses[e.d.id] ? '#9be04a' : ok ? '#f2c13a' : '#d8454a'; miniX.fillRect(x - 2, y - 2, 5, 5); }
  } else {
    const m = A.map;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const tx = ox + x, ty = oy + y; if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || !m.explored[ty * m.w + tx]) continue; const t = m.t[ty * m.w + tx]; miniX.fillStyle = t === T.FLOOR ? '#5a5268' : t === T.LAVA ? '#d8452a' : '#221c2c'; miniX.fillRect(x * s, y * s, s, s); }
    for (const c of A.chests) if (!c.open && m.explored[c.ty * m.w + c.tx]) { miniX.fillStyle = c.kind === 'gold' ? '#ffe08a' : '#c8922a'; miniX.fillRect((c.tx - ox) * s - 1, (c.ty - oy) * s - 1, 4, 4); }
    for (const pt of A.portals) { miniX.fillStyle = '#b878ea'; miniX.fillRect((pt.x / 16 - ox) * s - 2, (pt.y / 16 - oy) * s - 2, 5, 5); }
    if (G.bossMon) { miniX.fillStyle = '#ff4040'; miniX.fillRect((G.bossMon.x / 16 - ox) * s - 2, (G.bossMon.y / 16 - oy) * s - 2, 5, 5); }
  }
  if (Math.floor(G.time * 3) % 2 === 0) { miniX.fillStyle = '#ffffff'; miniX.fillRect(Math.round((ptx - ox) * s) - 2, Math.round((pty - oy) * s) - 2, 4, 4); }
}
