
// =====================================================================
// RENDER — the world, its animation, lighting and weather.
// =====================================================================
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
const KEY_SPR = spr(ICON_T.key.rows, { k: OUT, y: '#f2c13a' });
function snapCam() { if (!G.area) return; const [x, y] = camTarget(); G.cam.x = x; G.cam.y = y; }

// ---------- the hero ----------
// which way the hero looks: the attack direction while fighting, otherwise where they walk
function heroView(p) {
  let a;
  if (p.atkT > 0 || p.blocking || p.dashT > 0 || G.time - (p.lastAtkT || -9) < 0.3) a = p.aim;
  else if (p.dodgeT > 0) a = Math.atan2(p.dvy, p.dvx);
  else if (p.moving && Math.abs(p.vx) + Math.abs(p.vy) > 1) a = Math.atan2(p.vy, p.vx);
  else a = p.dirA == null ? Math.PI / 2 : p.dirA;
  p.dirA = a; const [dir, flip] = viewOf(a); p.dir = dir; if (dir === 'side') p.face = flip ? -1 : 1;
  return [dir, flip];
}
function heroAnim(p) {
  const w = weaponDef();
  if (p.dodgeT > 0) return ['roll', Math.floor((1 - p.dodgeT / 0.3) * 6) % 6];
  if (p.dashT > 0) return ['atk', 1];
  if (p.hurtT > 0.1) return ['hurt', 0];
  if (p.atkT > 0) { if (w.wc === 'melee') { const prog = 1 - p.atkT / 0.2; return ['atk', prog < 0.18 ? 0 : prog < 0.75 ? 1 : 2]; } return [w.wc === 'bow' ? 'bow' : 'cast', 0]; }
  if (p.castT > 0) return ['cast', 0];
  if (p.blocking) return ['block', 0];
  if (p.moving) return ['walk', Math.floor((p.walk / TAU) * 8 + 800) % 8];
  return ['idle', Math.floor(G.time * 2.4) % 4];
}
function drawWeapon(c, p, hx, hy, dir, flip) {
  const w = weaponDef(); if (!w.id) return; const icon = itemIcon(w.id), t = ICON_T[w.icon];
  let ang;
  if (w.wc === 'melee') {
    if (p.atkT > 0) { const prog = smooth(clamp(1 - p.atkT / 0.2, 0, 1)), arc = (w.arc * Math.PI) / 180; ang = p.aim + p.swing * (-arc / 2 + arc * prog); }
    else if (p.blocking) ang = p.aim + (Math.cos(p.aim) < 0 ? 1.2 : -1.2);
    else ang = dir === 'side' ? (flip ? -Math.PI + 1.05 : -1.05) : dir === 'down' ? 1.05 : -2.2;
  } else if (w.wc === 'staff' || w.wc === 'wand') ang = p.atkT > 0 || p.castT > 0 ? p.aim : dir === 'side' ? (flip ? -Math.PI + 1.35 : -1.35) : -1.45;
  else ang = p.atkT > 0 || G.time - (p.lastAtkT || -9) < 0.3 ? p.aim : dir === 'side' ? (flip ? Math.PI : 0) : dir === 'down' ? 1.2 : -1.9;
  c.save(); c.translate(Math.round(hx), Math.round(hy)); c.rotate(ang - t.a); c.drawImage(icon, -t.g[0], -t.g[1]); c.restore();
}
function heroArmorOpts() { const arm = armorDef(); return { armor: arm && arm.color, trim: arm && arm.trim, helm: arm && arm.def >= 22 && arm.id !== 'witch_robes' ? arm.color : null }; }
function drawPlayer(c) {
  const p = G.p; if (p.hidden) return;
  const L = heroLook(), ao = heroArmorOpts();
  if (G.dead) { c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(-Math.PI / 2); drawChar(c, 10, 6, L, Object.assign({ dir: 'side', anim: 'hurt', blink: true }, ao)); c.restore(); px(c, p.x - 9, p.y - 1, 18, 2, '#7a1a1e'); return; }
  if (p.lying) { drawChar(c, p.x, p.y + 6, L, { dir: 'down', anim: 'idle', f: Math.floor(G.time / 1.4) % 2, blink: true }); px(c, p.x - 7, p.y - 9, 15, 13, '#3e6cb8'); px(c, p.x - 7, p.y - 9, 15, 2, '#5a8ad0'); px(c, p.x - 7, p.y + 3, 15, 1, '#2c4e88'); return; }
  const [dir, flip] = heroView(p), [anim, f] = heroAnim(p), b = p.buffs, sh = shieldDef();
  const rolling = anim === 'roll';
  shadow(c, p.x, p.y, rolling ? 7 : 8);
  if (b.smoke > 0) c.globalAlpha = 0.35;
  if (b.warcry > 0) { c.fillStyle = 'rgba(216,69,74,.22)'; c.beginPath(); c.ellipse(p.x, p.y - 13, 13, 17, 0, 0, TAU); c.fill(); }
  const o = Object.assign({ dir, flip, anim, f, blink: (G.time % 4.2) < 0.13 && anim === 'idle' }, ao);
  if (p.hurtCd > 0.28 && p.hurtT > 0) o.tint = 'white'; else if (p.slowT > 0) o.tint = 'ice';
  // the hand position for this frame (needed before drawing when the weapon goes behind)
  const fr = charFrame(L, o), hxF = flip ? CHAR_W - 1 - fr.hand[0] : fr.hand[0], hx = Math.round(p.x) + hxF - CHAR_FX, hy = Math.round(p.y) + fr.hand[1] - CHAR_FY;
  const shIcon = sh ? itemIcon(gear('shield').id) : null;
  if (!rolling) {
    if (dir === 'up') drawWeapon(c, p, hx, hy, dir, flip);
    if (shIcon && !p.blocking && dir === 'side') c.drawImage(shIcon, Math.round(p.x + (flip ? 1 : -13)), Math.round(p.y - 20), 12, 12);
  }
  drawChar(c, p.x, p.y, L, o);
  if (!rolling) {
    if (shIcon && !p.blocking && dir === 'down') c.drawImage(shIcon, Math.round(p.x - 15), Math.round(p.y - 18), 12, 12);
    if (shIcon && !p.blocking && dir === 'up') c.drawImage(shIcon, Math.round(p.x + 3), Math.round(p.y - 18), 12, 12);
    if (dir !== 'up') drawWeapon(c, p, hx, hy, dir, flip);
    if (shIcon && p.blocking) { const bx = p.x + Math.cos(p.aim) * 10, by = p.y - 13 + Math.sin(p.aim) * 8; c.drawImage(shIcon, Math.round(bx - 8), Math.round(by - 8), 16, 16); if (G.time - p.blockStart < PS().parry) { c.globalAlpha = 0.5; c.drawImage(whiteOf(shIcon), Math.round(bx - 8), Math.round(by - 8), 16, 16); c.globalAlpha = b.smoke > 0 ? 0.35 : 1; } }
  }
  c.globalAlpha = 1;
  if (p.shieldHp > 0) { c.strokeStyle = 'rgba(85,168,239,.7)'; c.lineWidth = 1; c.beginPath(); c.ellipse(p.x, p.y - 13, 13 + Math.sin(G.time * 6), 17, 0, 0, TAU); c.stroke(); }
  if (b.eagle > 0 && chance(0.3)) G.parts.push({ x: p.x + rand(-6, 6), y: p.y - rand(4, 24), vx: 0, vy: -16, life: 0.4, max: 0.4, col: '#f2c13a', size: 1, grav: 0 });
  if (p.poisonT > 0 && chance(0.2)) G.parts.push({ x: p.x + rand(-5, 5), y: p.y - rand(4, 22), vx: 0, vy: -12, life: 0.5, max: 0.5, col: '#9be04a', size: 1, grav: 0 });
}
// ---------- monsters ----------
function wispDraw(c, x, y, t, col) {
  const f = Math.floor(t * 10) % 3;
  c.globalAlpha = 0.35; pcircCtx(c, x, y, 7 + f, col); c.globalAlpha = 1;
  pcircCtx(c, x, y, 4, '#ffffff'); pcircCtx(c, x, y, 3, col);
  px(c, x - 1, y - 6 - f, 2, 3, col);
}
function pcircCtx(c, cx, cy, r, col) { c.fillStyle = col; for (let y = Math.floor(cy - r); y <= cy + r; y++) { const dy = y - cy + 0.5, w = Math.sqrt(Math.max(0, r * r - dy * dy)); if (w > 0) c.fillRect(Math.round(cx - w), y, Math.round(w * 2), 1); } }
function monImage(m) {
  const d = m.d, fr = monFrames(m.unhooded ? 'lich_face' : m.type);
  if (d.art === 'human' || d.art === 'hero') return fr[m.strikeT > 0 ? 5 : m.wind > 0 && m.pending && m.pending !== 'lunge' ? 4 : m.moving ? Math.floor(m.walk * 0.7) % 4 : 0];
  if (d.art === 'bat') return fr[Math.floor(m.t * 12) % fr.length];
  if (fr.atk && (m.strikeT > 0 || m.act === 'lunging' || (m.wind > 0 && m.pending))) return fr.atk;
  if (d.art === 'slime') return m.moving ? fr[[1, 2, 3, 2][Math.floor(m.walk * 1.2) % 4]] : ((m.t + m.x * 0.1) % 3.5) < 0.14 ? fr[4] : fr[0];
  if (fr.length >= 5) return m.moving ? fr[1 + (Math.floor(m.walk * 1.2) % 4)] : fr[0];
  if (fr.length > 1) return fr[m.moving ? Math.floor(m.walk * 0.6) % 2 : 0];
  return fr[0];
}
function drawMon(c, m) {
  const d = m.d, sc = d.scale || 1, lift = monLift(m);
  if (d.art === 'wisp') { shadow(c, m.x, m.y, 4); wispDraw(c, Math.round(m.x), Math.round(m.y - lift - 4), m.t, d.glow); m._top = m.y - lift - 14; return; }
  if (d.art === 'human' || d.art === 'hero') { drawHumanMon(c, m, sc, lift); return; }
  let img = monImage(m);
  if (m.face < 0) img = flipped(img);
  if (m.flash > 0) img = whiteOf(img); else if (m.wind > 0 && Math.floor(G.time * 14) % 2) img = redOf(img); else if (m.slowT > 0) img = iceOf(img);
  const human = d.art === 'human' || d.art === 'hero';
  let w = img.width * sc, h = img.height * sc;
  if (d.art === 'slime' || d.art === 'frog') { const air = m.hopT > 0.55 && (m.hvx || m.hvy); const s = air ? 1.14 : 1 + Math.sin(m.t * 5) * 0.05; h *= s; w /= s; }
  else if (!d.fly && d.art !== 'crystal') { const br = 1 + Math.sin(m.t * 4 + m.x * 0.1) * 0.035; h *= br; w /= br; }
  if (m.flinch > 0) { w *= 1.16; h *= 0.84; }
  if (!d.ghost) shadow(c, m.x, m.y, Math.max(5, m.w * 0.7));
  let a = 1; if (d.alpha) a = d.alpha * (0.85 + Math.sin(m.t * 4) * 0.15); if (m.fadeOut) a *= clamp(1 - m.fadeOut / 1.5, 0, 1); if (m.scripted && m.type !== 'lich') a *= 0.85;
  c.globalAlpha = a;
  const lean = m.strikeT > 0 ? m.face * 2 : 0;
  const dx = human ? m.x - (HUM_FX * w) / HUM_W + lean : m.x - w / 2, dy = human ? m.y - (HUM_FY * h) / HUM_H - lift : m.y - h + 1 - lift;
  c.drawImage(img, Math.round(dx), Math.round(dy), Math.round(w), Math.round(h));
  c.globalAlpha = 1;
  if (d.crown && d.art === 'slime') { const cx = Math.round(m.x - 12), cy = Math.round(dy + h * 0.12 - 8); px(c, cx - 1, cy + 3, 26, 7, OUT); px(c, cx, cy + 4, 24, 5, '#f2c13a'); px(c, cx, cy + 8, 24, 1, '#b8862a'); for (const sx of [0, 9, 18]) { px(c, cx + sx - 1, cy - 1, 8, 5, OUT); px(c, cx + sx, cy, 6, 4, '#f2c13a'); px(c, cx + sx + 2, cy - 2, 2, 2, '#f2c13a'); } px(c, cx + 10, cy + 5, 4, 3, '#d8454a'); px(c, cx + 10, cy + 5, 1, 1, '#ffffff'); }
  if (m.burnT > 0 && chance(0.4)) G.parts.push({ x: m.x + rand(-5, 5), y: m.y - rand(2, monBodyH(m)), vx: 0, vy: -20, life: 0.4, max: 0.4, col: chance(0.5) ? '#ff7a2a' : '#ffd27a', size: 1, grav: 0 });
  if (m.wind > 0 && (m.pending === 'lunge' || (m.pending && m.pending.startsWith('charge')))) { c.strokeStyle = 'rgba(255,60,60,.5)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(m.x, m.y - 4); c.lineTo(G.p.x, G.p.y - 4); c.stroke(); c.setLineDash([]); }
  if (d.art === 'hero' || m.type === 'hollow_finn' || m.type === 'shade') if (chance(0.3)) G.parts.push({ x: m.x + rand(-6, 6), y: m.y - rand(0, 20), vx: 0, vy: -14, life: 0.5, max: 0.5, col: '#5a2a80', size: 1, grav: 0 });
  m._top = dy;
}
function monLook(m) {
  if (m._L && m._Lk === m.unhooded) return m._L; m._Lk = m.unhooded;
  const d = m.d;
  m._L = m.unhooded ? Object.assign({}, MON.lich.look, { hood: null, hair: '#e8e0d8', hairStyle: 1 }) : d.art === 'hero' ? Object.assign({}, heroLook(), { eyes: '#d8454a', weapon: 'sword' }) : d.look;
  return m._L;
}
function drawHumanMon(c, m, sc, lift) {
  const d = m.d, toP = Math.atan2(G.p.y - m.y, G.p.x - m.x);
  let a;
  if (m.wind > 0 || m.strikeT > 0 || (m.aggro && !m.scripted)) a = toP;
  else { const dx = m.x - (m._lx == null ? m.x : m._lx), dy = m.y - (m._ly == null ? m.y : m._ly); a = Math.abs(dx) + Math.abs(dy) > 0.05 ? Math.atan2(dy, dx) : m.dirA == null ? Math.PI / 2 : m.dirA; }
  if (m.scripted && m.face) a = m.face < 0 ? Math.PI : 0;
  m._lx = m.x; m._ly = m.y; m.dirA = a;
  const [dir, flip] = viewOf(a);
  let anim = 'idle', f = Math.floor((m.t + m.x * 0.01) * 2.2) % 4;
  if (m.strikeT > 0) { anim = 'atk'; f = m.strikeT > 0.08 ? 1 : 2; }
  else if (m.wind > 0 && m.pending && m.pending !== 'lunge') { anim = d.ai === 'caster' || d.ai === 'ranged' ? 'cast' : 'atk'; f = 0; }
  else if (m.flinch > 0) anim = 'hurt';
  else if (m.moving) { anim = 'walk'; f = Math.floor(m.walk * 1.25) % 8; }
  const o = { dir, flip, anim, f, blink: ((m.t + m.x * 0.13) % 3.7) < 0.12, scale: sc, armor: d.look && d.look.armor, trim: d.look && d.look.trim, helm: d.look && d.look.helm };
  if (m.flash > 0) o.tint = 'white'; else if (m.wind > 0 && Math.floor(G.time * 14) % 2) o.tint = 'red'; else if (m.slowT > 0) o.tint = 'ice'; else if (d.art === 'hero') o.tint = 'dark';
  if (!d.ghost) shadow(c, m.x, m.y, Math.max(6, m.w * 0.8));
  let al = 1; if (d.alpha) al = d.alpha * (0.85 + Math.sin(m.t * 4) * 0.15); if (m.fadeOut) al *= clamp(1 - m.fadeOut / 1.5, 0, 1); if (m.scripted && m.type !== 'lich') al *= 0.85;
  c.globalAlpha = al;
  const sq = m.flinch > 0 ? 1 : 0;
  drawChar(c, m.x + (m.strikeT > 0 ? Math.cos(a) * 2 : 0), m.y - lift + sq, monLook(m), o);
  c.globalAlpha = 1;
  if (m.burnT > 0 && chance(0.4)) G.parts.push({ x: m.x + rand(-5, 5), y: m.y - rand(2, monBodyH(m)), vx: 0, vy: -20, life: 0.4, max: 0.4, col: chance(0.5) ? '#ff7a2a' : '#ffd27a', size: 1, grav: 0 });
  if (m.wind > 0 && (m.pending === 'lunge' || (m.pending && m.pending.startsWith('charge')))) { c.strokeStyle = 'rgba(255,60,60,.5)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(m.x, m.y - 4); c.lineTo(G.p.x, G.p.y - 4); c.stroke(); c.setLineDash([]); }
  if (d.art === 'hero' || m.type === 'hollow_finn' || m.type === 'shade') if (chance(0.3)) G.parts.push({ x: m.x + rand(-6, 6), y: m.y - rand(0, 26 * sc), vx: 0, vy: -14, life: 0.5, max: 0.5, col: '#5a2a80', size: 1, grav: 0 });
  m._top = m.y - lift - 30 * sc;
}
function drawCorpse(c, k) {
  const d = k.d, t = k.t, sc = d.scale || 1;
  if (k.anim === 'poof') { if (t < 0.15) { c.globalAlpha = 1 - t / 0.15; if (d.art === 'wisp') wispDraw(c, k.x, k.y - 12, t, d.glow); c.globalAlpha = 1; } return; }
  let img = d.art === 'wisp' ? null : monFrames(k.type)[0]; if (!img) return; if (k.face < 0) img = flipped(img);
  const human = d.art === 'human' || d.art === 'hero', w = img.width * sc, h = img.height * sc;
  const ax = human ? k.x - (HUM_FX * w) / HUM_W : k.x - w / 2, ay = human ? k.y - (HUM_FY * h) / HUM_H : k.y - h + 1;
  const fade = (start, len) => clamp(1 - (t - start) / len, 0, 1);
  if (k.anim === 'melt') { const s = clamp(1 - t / 0.6, 0.15, 1); c.globalAlpha = fade(1, 0.6); c.fillStyle = d.blood || '#5cc46e'; c.beginPath(); c.ellipse(k.x, k.y, (w / 2) * (1.3 - s * 0.3), 3, 0, 0, TAU); c.fill(); c.drawImage(img, Math.round(k.x - (w * (2 - s)) / 2), Math.round(k.y - h * s + 1), Math.round(w * (2 - s)), Math.round(h * s)); }
  else if (k.anim === 'fade') { c.globalAlpha = fade(0, 1.2) * (d.alpha || 1); c.drawImage(img, Math.round(ax), Math.round(ay - t * 14 - k.lift), Math.round(w), Math.round(h)); }
  else if (k.anim === 'shatter') { if (t < 0.12) { c.globalAlpha = 1 - t / 0.12; c.drawImage(whiteOf(img), Math.round(ax), Math.round(ay), Math.round(w), Math.round(h)); } if (!k.burst) { k.burst = true; for (let i = 0; i < 16; i++) G.parts.push({ x: k.x + rand(-w / 3, w / 3), y: k.y - rand(0, h * 0.7), vx: rand(-60, 60), vy: rand(-90, -20), life: rand(0.5, 0.9), max: 0.9, col: d.blood || '#8a8c92', size: 2, grav: 260, floor: k.y + rand(-2, 4) }); } }
  else if (k.anim === 'bones') {
    if (t < 0.35) { c.save(); c.translate(Math.round(k.x), Math.round(k.y)); c.rotate((k.face < 0 ? -1 : 1) * (t / 0.35) * 0.6); c.drawImage(img, Math.round(ax - k.x), Math.round(ay - k.y + t * 16), Math.round(w), Math.round(h)); c.restore(); }
    else { c.globalAlpha = fade(3, 1); const n = Math.round(6 * sc); for (let i = 0; i < n; i++) { const bx = k.x + Math.sin(i * 2.3) * 7 * sc, by = k.y - 1 + Math.cos(i * 1.7) * 2; px(c, bx - 2, by, 4, 1, '#e8e0cc'); px(c, bx - 2, by - 1, 1, 2, '#e8e0cc'); } px(c, k.x - 3, k.y - 5, 5, 4, '#e8e0cc'); px(c, k.x - 2, k.y - 4, 1, 1, '#120a10'); px(c, k.x, k.y - 4, 1, 1, '#120a10'); }
  } else { // fall over
    const r = clamp(t / 0.3, 0, 1) * (Math.PI / 2) * (k.face < 0 ? -1 : 1);
    c.globalAlpha = fade(0.9, 0.7) * (d.alpha || 1); c.save(); c.translate(Math.round(k.x), Math.round(k.y)); c.rotate(r); c.drawImage(img, Math.round(ax - k.x), Math.round(ay - k.y), Math.round(w), Math.round(h)); c.restore();
  }
  c.globalAlpha = 1;
}
// ---------- people ----------
function drawNPC(c, n) {
  if (n.hidden) return;
  shadow(c, n.x, n.y, 8);
  let dir = 'down', flip = false;
  if (n.pose === 'hammer' || n.pose === 'work') { dir = 'side'; flip = n.face < 0; }
  else if (n.pose === 'wave') dir = 'down';
  else if (n.dirA != null) [dir, flip] = viewOf(n.dirA);
  let anim = 'idle', f = !n.moving && Math.sin(n.breatheT * 2.1) > 0.55 ? 1 : 0;
  if (n.pose) { anim = n.pose; f = n.poseT >= (n.pose === 'hammer' ? 0.55 : 0.5) ? 1 : 0; }
  else if (n.moving) { anim = 'walk'; f = Math.floor((n.walk / TAU) * 8 + 800) % 8; }
  drawChar(c, n.x, n.y, n.look, { dir, flip, anim, f, blink: n.blink > 0 });
  if (n.pose === 'hammer') { const up = n.poseT < 0.55, hx = n.x + (n.face < 0 ? -1 : 1) * (up ? 1 : 7), hy = n.y - (up ? 19 : 9); px(c, hx - 1, hy - (up ? 6 : 1), 2, up ? 7 : 2, '#5a3418'); px(c, hx + (n.face < 0 ? -4 : 1) * (up ? 0 : 1) - (up ? 2 : 0), hy - (up ? 9 : 3), 5, 4, '#6a6e78'); }
}
function drawFinn(c, f) {
  shadow(c, f.x, f.y, 8);
  const a = Math.atan2(G.p.y - f.y, G.p.x - f.x), [dir, flip] = viewOf(a);
  drawChar(c, f.x, f.y, f.look, { dir, flip, anim: 'idle', f: Math.sin(f.t * 2) > 0.5 ? 1 : 0, blink: (f.t % 3.3) < 0.12 && !f.look.eyeCol });
  if (f.chained) { c.strokeStyle = '#8a8c92'; c.beginPath(); c.moveTo(f.x - 12, f.y - 34); c.lineTo(f.x - 5, f.y - 12); c.moveTo(f.x + 12, f.y - 34); c.lineTo(f.x + 5, f.y - 12); c.stroke(); }
}
// ---------- trees and grass ----------
function drawTree(c, tr) {
  const img = TREES[tr.kind][tr.v];
  const sway = Math.round(Math.sin(G.time * (1.1 + Weather.wind) + tr.ph) * (0.6 + Weather.wind * 1.6));
  const x = tr.x - TREE_W / 2, y = tr.y - TREE_H + 1;
  c.drawImage(img, 0, TREE_SPLIT, TREE_W, TREE_H - TREE_SPLIT, x, y + TREE_SPLIT, TREE_W, TREE_H - TREE_SPLIT);
  c.drawImage(img, 0, 0, TREE_W, TREE_SPLIT, x + sway, y, TREE_W, TREE_SPLIT);
}
function drawTufts(c, A, ty0, ty1) {
  const frames = TUFTS[A.biome] || TUFTS.vale, p = G.p, wind = Weather.wind;
  for (let ty = ty0; ty <= ty1; ty++) for (const t of A.tufts[ty] || []) {
    let lean = Math.round(Math.sin(G.time * 1.7 + t.ph) * (0.6 + wind * 1.5));
    const d = Math.abs(p.x - t.x); if (d < 9 && Math.abs(p.y - t.y) < 6) lean = p.x < t.x ? 2 : -2;
    c.drawImage(frames[clamp(lean + 2, 0, 4)], Math.round(t.x - 3), Math.round(t.y - 4));
  }
}
// ---------- water, lava and friends ----------
function drawAnimTiles(c, A, tx0, ty0, tx1, ty1) {
  const map = A.map, t = G.time;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const tile = map.t[ty * map.w + tx], X = tx * 16, Y = ty * 16, h = hash2(tx, ty);
    switch (tile) {
      case T.WATER: case T.OCEAN: case T.SHALLOW: {
        const col = tile === T.SHALLOW ? '#9fd0f0' : '#5a8fd0';
        for (let i = 0; i < 2; i++) { const ph = (t * 0.35 + h + i * 0.5) % 1, wx = X + ((ph * 16 + i * 7) % 14), wy = Y + 4 + i * 6 + Math.round(Math.sin(t * 2 + tx + i) * 1); px(c, wx, wy, 3, 1, col); }
        if (h > 0.8 && Math.sin(t * 3 + h * 30) > 0.92) px(c, X + 6, Y + 6, 1, 1, '#ffffff');
        if (tile === T.OCEAN) { const left = tileAt(map, tx - 1, ty); if (left === T.SHALLOW || left === T.SAND) { const k = (Math.sin(t * 1.2 + ty * 0.7) + 1) / 2; px(c, X - Math.round(k * 10), Y, 2, 16, 'rgba(255,255,255,.75)'); px(c, X - Math.round(k * 10) + 2, Y + 3, 1, 10, 'rgba(255,255,255,.4)'); } }
        break;
      }
      case T.BOG: if (Math.sin(t * 1.4 + h * 40) > 0.85) { const r = (t * 2 + h * 7) % 1; c.strokeStyle = `rgba(150,180,90,${1 - r})`; c.beginPath(); c.ellipse(X + 8, Y + 8, 2 + r * 5, 1 + r * 2, 0, 0, TAU); c.stroke(); } break;
      case T.SPRING: { const r = (t * 0.6 + h) % 1; c.strokeStyle = `rgba(200,255,255,${0.7 - r * 0.7})`; c.beginPath(); c.ellipse(X + 8, Y + 8, 2 + r * 6, 1 + r * 3, 0, 0, TAU); c.stroke(); if (chance(0.02)) G.parts.push({ x: X + rand(2, 14), y: Y + rand(2, 14), vx: 0, vy: -18, life: 0.8, max: 0.8, col: '#bff8ff', size: 1, grav: 0 }); break; }
      case T.LAVA: { const ph = Math.sin(t * 3 + tx * 1.3 + ty); px(c, X + 4 + ((ph * 3) | 0), Y + 6, 5, 3, ph > 0 ? '#ffd27a' : '#ff8a2a'); break; }
      case T.ICE: if (Math.sin(t * 0.8 + h * 20) > 0.97) { px(c, X + 7, Y + 5, 1, 5, '#ffffff'); px(c, X + 5, Y + 7, 5, 1, '#ffffff'); } break;
    }
  }
}
function drawDeco(c, o) {
  const x = Math.round(o.x), y = Math.round(o.y);
  if (o.kind === 'shroom') { px(c, x, y - 1, 1, 3, '#efe4cc'); px(c, x - 2, y - 3, 5, 2, o.v ? '#d8454a' : '#9be04a'); px(c, x - 1, y - 3, 1, 1, '#ffffff'); }
  else if (o.kind === 'bones') { px(c, x - 3, y, 6, 1, '#cfc6b4'); px(c, x - 4, y - 1, 2, 3, '#cfc6b4'); px(c, x + 2, y - 1, 2, 3, '#cfc6b4'); if (o.v === 2) { px(c, x + 4, y - 3, 3, 3, '#cfc6b4'); px(c, x + 5, y - 2, 1, 1, '#140d1a'); } }
  else if (o.kind === 'web') { c.strokeStyle = 'rgba(239,228,204,.35)'; c.beginPath(); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; c.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6); c.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); } c.stroke(); }
  else if (o.kind === 'ash') { px(c, x - 2, y, 5, 2, '#1e1210'); if (Math.floor(G.time * 3 + o.x) % 3 === 0) px(c, x, y - 1, 1, 1, '#ff7a2a'); }
  else if (o.kind === 'icicle') { px(c, x - 1, y - 4, 3, 5, '#c8eeff'); px(c, x, y - 6, 1, 2, '#ffffff'); }
  else if (o.kind === 'barrel') c.drawImage(PROP.barrel, x - 5, y - 11);
  else if (o.kind === 'shard') { px(c, x - 1, y - 3, 2, 4, '#8a86a8'); px(c, x, y - 4, 1, 1, '#d8c4ff'); }
}
function drawPortal(c, pt) {
  const x = Math.round(pt.x), y = Math.round(pt.y);
  for (let i = 0; i < 4; i++) { c.strokeStyle = ['#5a2a80', '#b878ea', '#7ff8ff', '#ffffff'][i]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, 11 - i * 2.5 + Math.sin(G.time * 4 + i) * 1, (11 - i * 2.5) * 1.3, 0, 0, TAU); c.stroke(); }
  c.lineWidth = 1; if (chance(0.3)) G.parts.push({ x: x + rand(-8, 8), y: y + rand(-10, 10), vx: 0, vy: -16, life: 0.6, max: 0.6, col: '#b878ea', size: 1, grav: 0 });
}
function drawTorch(c, t) { const x = Math.round(t.x), y = Math.round(t.y), f = Math.floor(G.time * 10 + t.ph) % 3; px(c, x - 1, y, 2, 5, '#5a3418'); px(c, x - 2, y - 3 - (f % 2), 4, 4, '#ff7a2a'); px(c, x - 1, y - 2 - (f % 2), 2, 2, '#ffe08a'); }
function drawFlame(c, x, y, s = 1) { const f = Math.floor(G.time * 12) % 3; px(c, x - 3 * s, y - 4 * s - f, 6 * s, 5 * s + f, '#ff7a2a'); px(c, x - 2 * s, y - 6 * s - f, 4 * s, 4 * s, '#ffb03a'); px(c, x - 1 * s, y - 5 * s - (f % 2), 2 * s, 3 * s, '#fff3b0'); if (chance(0.3)) G.parts.push({ x: x + rand(-3, 3), y: y - 8, vx: rand(-4, 4), vy: -26, life: 0.5, max: 0.5, col: '#ffb03a', size: 1, grav: 0 }); }
function drawNoteOnGround(c, n) { const bob = Math.sin(G.time * 3 + n.x) * 1.5; c.globalAlpha = 0.35 + Math.sin(G.time * 4) * 0.15; pcircCtx(c, n.x, n.y - 3 + bob, 7, '#f2e6c8'); c.globalAlpha = 1; c.drawImage(PROP.note, Math.round(n.x - 5), Math.round(n.y - 8 + bob)); }
function drawProj(c, b) {
  const a = Math.atan2(b.vy, b.vx), x = Math.round(b.x), y = Math.round(b.y);
  if (b.kind === 'arrow' || b.kind === 'frost' || b.kind === 'bigarrow') { const L = b.kind === 'bigarrow' ? 12 : 6; c.strokeStyle = b.kind === 'frost' ? '#9fe8ff' : b.kind === 'bigarrow' ? '#ffd27a' : '#8a5a2b'; c.lineWidth = b.kind === 'bigarrow' ? 2 : 1; c.beginPath(); c.moveTo(x - Math.cos(a) * L, y - Math.sin(a) * L); c.lineTo(x, y); c.stroke(); c.lineWidth = 1; px(c, x - 1, y - 1, 2, 2, '#ffffff'); }
  else if (b.kind === 'knife') { c.strokeStyle = '#d7dde6'; c.beginPath(); c.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4); c.lineTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2); c.stroke(); }
  else if (b.kind === 'shot') { px(c, x - 1, y - 1, 3, 3, '#1a1a1a'); px(c, x, y, 1, 1, '#8a8c92'); }
  else if (b.kind === 'web') { c.strokeStyle = '#efe4cc'; c.beginPath(); c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); c.moveTo(x, y - 4); c.lineTo(x, y + 4); c.stroke(); }
  else if (b.kind === 'tongue') { const s = b.src; if (s && !s.dead) { c.strokeStyle = '#d8605a'; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x, s.y - 5); c.lineTo(x, y); c.stroke(); c.lineWidth = 1; } px(c, x - 2, y - 2, 4, 4, '#ff8a8a'); }
  else if (b.kind === 'slime') { px(c, x - 2, y - 2, 5, 5, '#2f7a3c'); px(c, x - 1, y - 2, 3, 3, '#5cc46e'); }
  else if (b.kind === 'sand') { px(c, x - 2, y - 1, 4, 3, '#c8a458'); px(c, x - 1, y - 1, 2, 1, '#fff3d2'); }
  else { const col = PROJ_COL[b.kind] || '#ffb03a', r = b.kind === 'bigfire' ? 5 : b.kind === 'pfire' ? 3 : 2; px(c, x - r - 1, y - r - 1, r * 2 + 3, r * 2 + 3, darken(col, 0.6)); px(c, x - r, y - r, r * 2 + 1, r * 2 + 1, col); px(c, x - 1, y - 1, 2, 2, '#ffffff'); }
}
// a crescent of light that sweeps the way the weapon swings, thick in the middle and fading at the tail
function drawSwoosh(c, f, t) {
  const prog = 1 - t, r = f.range * 0.92, a0 = f.ang - f.arc / 2, a1 = f.ang + f.arc / 2, d = f.swing || 1;
  const head = d > 0 ? lerp(a0, a1, Math.min(1, prog * 2.2)) : lerp(a1, a0, Math.min(1, prog * 2.2)), tail = f.arc * 0.85, steps = 14, seg = tail / steps + 0.02;
  for (let i = 0; i < steps; i++) {
    const k = i / steps, a = head - d * (tail * k); if (d > 0 ? a - seg < a0 - 0.05 : a + seg > a1 + 0.05) break;
    const th = (1 - k) * (5 + f.range * 0.14) * (0.45 + t * 0.55), ro = r + th * 0.5, ri = Math.max(1, r - th * 0.5);
    const s0 = d > 0 ? a - seg : a, s1 = d > 0 ? a : a + seg;
    c.globalAlpha = (1 - k) * Math.min(1, t * 1.7) * 0.92; c.fillStyle = k < 0.22 ? '#ffffff' : f.col;
    c.beginPath(); c.arc(f.x, f.y, ro, s0, s1, false); c.arc(f.x, f.y, ri, s1, s0, true); c.closePath(); c.fill();
  }
  c.globalAlpha = 1;
}
function drawFx(c) {
  for (const f of G.fx) {
    const t = f.life / f.max;
    if (f.kind === 'slash') drawSwoosh(c, f, t);
    else if (f.kind === 'hit') { const k = 1 - t, r = 3 + k * 9; c.globalAlpha = t; c.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const a = f.ang + i * (Math.PI / 2); c.beginPath(); c.moveTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r); c.lineTo(f.x + Math.cos(a + 0.5) * 2, f.y + Math.sin(a + 0.5) * 2); c.lineTo(f.x + Math.cos(a - 0.5) * 2, f.y + Math.sin(a - 0.5) * 2); c.fill(); } c.fillStyle = f.col || '#ffe08a'; c.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3); }
    else if (f.kind === 'ring') { c.globalAlpha = t; c.strokeStyle = f.col; c.lineWidth = 2; const r = lerp(f.r1, f.r0, t); c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.6, 0, 0, TAU); c.stroke(); }
    else if (f.kind === 'ripple') { c.globalAlpha = t * 0.8; c.strokeStyle = '#d8f0ff'; c.lineWidth = 1; const r = (1 - t) * 10 + 2; c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.45, 0, 0, TAU); c.stroke(); }
    else if (f.kind === 'spin') { c.globalAlpha = t; c.strokeStyle = '#ffffff'; c.lineWidth = 2; const a0 = (1 - t) * TAU * 1.5; c.beginPath(); c.arc(f.x, f.y, f.r * 0.8, a0, a0 + 2.4); c.stroke(); c.beginPath(); c.arc(f.x, f.y, f.r * 0.8, a0 + Math.PI, a0 + Math.PI + 2.4); c.stroke(); }
    else if (f.kind === 'bolt') { c.globalAlpha = t; c.strokeStyle = '#d8f0ff'; c.lineWidth = 2; c.beginPath(); f.pts.forEach(([x, y], i) => { if (!i) c.moveTo(x, y); else { const [px0, py0] = f.pts[i - 1]; c.lineTo((px0 + x) / 2 + rand(-5, 5), (py0 + y) / 2 + rand(-5, 5)); c.lineTo(x, y); } }); c.stroke(); c.strokeStyle = '#55a8ef'; c.lineWidth = 1; c.stroke(); }
    else if (f.kind === 'target') { c.globalAlpha = 0.6; c.strokeStyle = f.col; c.setLineDash([3, 3]); c.beginPath(); c.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, TAU); c.stroke(); c.setLineDash([]); }
    else if (f.kind === 'meteor') { const k = 1 - t, mx = f.x + (1 - k) * 60, my = f.y - (1 - k) * 160; c.globalAlpha = 0.5; c.fillStyle = '#000'; c.beginPath(); c.ellipse(f.x, f.y, f.r * k, f.r * k * 0.5, 0, 0, TAU); c.fill(); c.globalAlpha = 1; px(c, mx - 5, my - 5, 10, 10, '#a3242a'); px(c, mx - 4, my - 4, 8, 8, '#ff7a2a'); px(c, mx - 2, my - 2, 4, 4, '#ffe08a'); G.parts.push({ x: mx, y: my, vx: rand(-10, 10), vy: rand(-20, 0), life: 0.4, max: 0.4, col: '#ff7a2a', size: 2, grav: 0 }); }
  }
  c.globalAlpha = 1; c.lineWidth = 1;
}
// ---------- one frame ----------
function render() {
  ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  if (!G.area) return;
  const sx = G.shake > 0 ? rand(-G.shake, G.shake) : 0, sy = G.shake > 0 ? rand(-G.shake, G.shake) : 0;
  const cx = Math.round(G.cam.x + sx), cy = Math.round(G.cam.y + sy);
  const A = G.area, map = A.map, L = map.layer, p = G.p, night = G.save ? Clock.dark() : 0;
  ctx.save(); ctx.translate(-cx, -cy);
  const x0 = clamp(cx, 0, L.width), y0 = clamp(cy, 0, L.height), vw = Math.min(VIEW.w, L.width - x0), vh = Math.min(VIEW.h, L.height - y0);
  if (vw > 0 && vh > 0) ctx.drawImage(L, x0, y0, vw, vh, x0, y0, vw, vh);
  const tx0 = Math.max(0, Math.floor(cx / 16) - 1), ty0 = Math.max(0, Math.floor(cy / 16) - 1), tx1 = Math.min(map.w - 1, Math.ceil((cx + VIEW.w) / 16)), ty1 = Math.min(map.h - 1, Math.ceil((cy + VIEW.h) / 16) + 2);
  drawAnimTiles(ctx, A, tx0, ty0, tx1, ty1);
  for (const s of G.stains) { ctx.globalAlpha = clamp(1 - s.t / 25, 0, 0.8); px(ctx, s.x, s.y, s.s, 1, s.col); }
  ctx.globalAlpha = 1;
  if (A.tufts) drawTufts(ctx, A, ty0, ty1);
  for (const o of A.decos) drawDeco(ctx, o);
  for (const t of A.traps) { const X = t.tx * 16, Y = t.ty * 16; px(ctx, X + 2, Y + 2, 12, 12, 'rgba(0,0,0,.3)'); for (let i = 0; i < 4; i++) { const sx2 = X + 3 + (i % 2) * 6, sy2 = Y + 3 + ((i / 2) | 0) * 6; if (spikeUp(t)) { px(ctx, sx2 + 1, sy2 - 1, 2, 4, '#d7dde6'); px(ctx, sx2 + 1, sy2 - 2, 1, 1, '#ffffff'); } else px(ctx, sx2, sy2 + 1, 4, 2, '#3a3a40'); } }
  for (const t of G.traps2) { px(ctx, t.x - 4, t.y - 2, 8, 4, '#5a8ab0'); px(ctx, t.x - 1, t.y - 5, 2, 4, Math.floor(G.time * 4) % 2 ? '#c8eeff' : '#9fe8ff'); }
  for (const cl of G.clouds) { ctx.globalAlpha = 0.18 + Math.sin(G.time * 3) * 0.04; ctx.fillStyle = '#7be06a'; ctx.beginPath(); ctx.ellipse(cl.x, cl.y, cl.r, cl.r * 0.6, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  for (const t of A.torches) drawTorch(ctx, t);
  for (const pt of A.portals) drawPortal(ctx, pt);
  for (const n of A.notes || []) if (!n.got) drawNoteOnGround(ctx, n);
  for (const k of G.picks) {
    const bob = k.z > 0 ? 0 : Math.sin(G.time * 4 + k.x) * 1.2;
    if (k.kind === 'coin') { shadow(ctx, k.x, k.y, 3); ctx.drawImage(COIN_SPR, Math.round(k.x - 4), Math.round(k.y - 8 - k.z + bob)); }
    else if (k.kind === 'key') { shadow(ctx, k.x, k.y, 4); ctx.globalAlpha = 0.4; pcircCtx(ctx, k.x, k.y - 8 - k.z + bob, 8, '#f2c13a'); ctx.globalAlpha = 1; ctx.drawImage(KEY_SPR, Math.round(k.x - 6), Math.round(k.y - 14 - k.z + bob)); }
    else { shadow(ctx, k.x, k.y, 4); const it = ITEMS[k.id]; if (it.rarity !== 'common' && Math.floor(G.time * 4) % 2) px(ctx, k.x + 5, k.y - 14 - k.z + bob, 1, 1, RCOL[it.rarity]); ctx.drawImage(itemIcon(k.id), Math.round(k.x - 6), Math.round(k.y - 13 - k.z + bob)); }
  }
  // y-sorted world objects
  const list = [], vis = (x, y, r = 80) => x > cx - r && x < cx + VIEW.w + r && y > cy - r && y < cy + VIEW.h + r * 1.5;
  const act = G.save ? ST().act : 1;
  for (const pr of A.props) {
    if (!vis(pr.x + pr.w / 2, pr.y, 120)) continue;
    if (pr.kind === 'barricade' && act >= 2) continue;
    list.push([pr.y, () => {
      const bob = pr.bob ? Math.round(Math.sin(G.time * 1.2) * 1.5) : 0;
      if (pr.kind === 'entrance' && (pr.dungeon === 'mirror' ? !(G.save && ST().flags.mirrorOpen) : pr.dungeon === 'tomb' && act < 3)) ctx.globalAlpha = 1;
      ctx.drawImage(pr.img, Math.round(pr.x), Math.round(pr.y - pr.img.height + bob));
      if (pr.kind === 'entrance' && pr.dungeon === 'tomb' && act < 3) { px(ctx, pr.x + 17, pr.y - 20, 14, 20, '#3a3440'); for (let i = 0; i < 4; i++) px(ctx, pr.x + 18 + i * 3, pr.y - 19, 1, 18, '#55525e'); }
      if (pr.img.windows && night > 0.05) for (const w of pr.img.windows) { ctx.globalAlpha = night * 0.85; px(ctx, pr.x + w.x, pr.y - pr.img.height + w.y, w.w, w.h, '#ffd27a'); px(ctx, pr.x + w.x + 4, pr.y - pr.img.height + w.y, 2, w.h, '#5a3a1e'); ctx.globalAlpha = 1; }
      if (pr.fire) drawFlame(ctx, pr.x + 8, pr.y - 6);
      if (pr.bubbles && chance(0.1)) G.parts.push({ x: pr.x + 4 + rand(0, 6), y: pr.y - 10, vx: 0, vy: -14, life: 0.5, max: 0.5, col: '#9be04a', size: 1, grav: 0 });
      if (pr.kind === 'fountain' && chance(0.6)) G.parts.push({ x: pr.x + 16 + rand(-1, 1), y: pr.y - 28, vx: rand(-14, 14), vy: rand(-30, -10), life: 0.6, max: 0.6, col: '#bfe4ff', size: 1, grav: 120 });
    }]);
  }
  if (A.trees) for (let ty = ty0; ty <= Math.min(map.h - 1, ty1 + 2); ty++) for (const tr of A.trees[ty] || []) if (tr.x > cx - 20 && tr.x < cx + VIEW.w + 20) list.push([tr.y, () => drawTree(ctx, tr)]);
  for (const ch of A.chests) list.push([ch.y, () => { ctx.drawImage(CHEST_SPR[ch.kind][ch.open ? 'open' : 'closed'], Math.round(ch.x - 8), Math.round(ch.y - 14)); if (ch.locked) { px(ctx, ch.x - 3, ch.y - 9, 6, 5, '#44464b'); px(ctx, ch.x - 2, ch.y - 12, 4, 3, '#44464b'); px(ctx, ch.x - 1, ch.y - 11, 2, 2, '#07050a'); } }]);
  for (const d of A.doors || []) { if (d.kind === 'open') continue; const X = d.tx * 16, Y = d.ty * 16; list.push([Y + 16, () => { if (!d.open) ctx.drawImage(d.kind === 'key' ? PROP.keydoor : PROP.gate, X, Y + 16 - 22); else if (d.kind === 'gate') ctx.drawImage(PROP.gate, 0, 16, 16, 6, X, Y - 4, 16, 6); }]); }
  if (A.lever) list.push([A.lever.y, () => ctx.drawImage(A.lever.pulled ? PROP.lever1 : PROP.lever0, A.lever.x - 6, A.lever.y - 13)]);
  if (A.secret && !A.secret.open) { const s = A.secret; list.push([s.ty * 16 + 16, () => { ctx.drawImage(PROP.crack, s.tx * 16, s.ty * 16); if (s.revealed && Math.floor(G.time * 3) % 2) { ctx.strokeStyle = '#f2c13a'; ctx.strokeRect(s.tx * 16 + 0.5, s.ty * 16 + 0.5, 15, 15); } }]); }
  if (A.captive) { const cp = A.captive; list.push([cp.y, () => { ctx.globalAlpha = cp.freed ? clamp(cp.leaveT / 1.5, 0, 1) : 1; ctx.drawImage(PROP.captive, Math.round(cp.x - 16), Math.round(cp.y - 33)); ctx.globalAlpha = 1; }]); }
  if (A.finn) list.push([A.finn.y, () => drawFinn(ctx, A.finn)]);
  for (const k of G.corpses) list.push([k.y - 1, () => drawCorpse(ctx, k)]);
  for (const n of A.npcs) if (!n.hidden && vis(n.x, n.y)) list.push([n.y, () => drawNPC(ctx, n)]);
  for (const m of G.mons) if (vis(m.x, m.y)) list.push([m.y, () => drawMon(ctx, m)]);
  if (G.pet) list.push([G.pet.y, () => Pets.draw(ctx)]);
  if (G.on) list.push([p.lying ? p.y + 20 : p.y, () => drawPlayer(ctx)]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, fn] of list) fn();
  for (const b of G.projs) drawProj(ctx, b);
  drawFx(ctx);
  for (const q of G.parts) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); if (q.streak) { ctx.strokeStyle = q.col; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); ctx.stroke(); } else px(ctx, q.x, q.y, q.size, q.size, q.col); }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawLighting(cx, cy, night);
  drawWeather(cx, cy);
  drawLabels(cx, cy);
  drawOverlays();
}
// ---------- light and dark ----------
function hole(x, y, r, a) { if (x < -r || y < -r || x > VIEW.w + r || y > VIEW.h + r) return; const g = lightX.createRadialGradient(x, y, r * 0.3, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lightX.fillStyle = g; lightX.fillRect(x - r, y - r, r * 2, r * 2); }
function drawLighting(cx, cy, night) {
  const A = G.area, p = G.p;
  let dark = 0, col = '8,10,28';
  if (A.kind === 'dungeon') { dark = 1; }
  else if (A.kind === 'interior') { dark = 0.25 + night * 0.45; col = '20,10,4'; }
  else dark = night * 0.82;
  if (Story.red) dark = Math.max(dark, 0.4);
  const cast = A.kind === 'overworld' && G.save ? Clock.cast() : null;
  if (cast && cast[1] > 0.01) { ctx.fillStyle = `rgba(${cast[0]},${cast[1]})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (dark < 0.02) return;
  lightX.globalCompositeOperation = 'source-over'; lightX.clearRect(0, 0, VIEW.w, VIEW.h);
  lightX.fillStyle = A.kind === 'dungeon' ? A.def.theme.dark : `rgba(${col},${dark})`; lightX.fillRect(0, 0, VIEW.w, VIEW.h);
  lightX.globalCompositeOperation = 'destination-out';
  const L = (x, y, r, a) => hole(x - cx, y - cy, r, a);
  L(p.x, p.y - 10, A.kind === 'dungeon' ? 100 : 80, 1);
  if (A.kind === 'dungeon') {
    for (const t of A.torches) L(t.x, t.y, 48 + Math.sin(G.time * 9 + t.ph) * 3, 0.8);
    for (const pt of A.portals) L(pt.x, pt.y, 50, 0.9);
    if (G.bossMon && !G.bossMon.dead) L(G.bossMon.x, G.bossMon.y - 20, 70, 0.75);
    if (A.spring) L(A.spring.cx * 16, A.spring.cy * 16, 60, 0.7);
    const map = A.map, tx0 = Math.max(0, Math.floor(cx / 16)), ty0 = Math.max(0, Math.floor(cy / 16)), tx1 = Math.min(map.w - 1, Math.ceil((cx + VIEW.w) / 16)), ty1 = Math.min(map.h - 1, Math.ceil((cy + VIEW.h) / 16));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (map.t[ty * map.w + tx] === T.LAVA) L(tx * 16 + 8, ty * 16 + 8, 22, 0.5);
    for (const n of A.notes || []) if (!n.got) L(n.x, n.y, 18, 0.5);
  } else {
    for (const pr of A.props) {
      if (pr.lamp) L(pr.x + 4, pr.y - 24, 58 + Math.sin(G.time * 5 + pr.x) * 2, 0.9);
      if (pr.fire) L(pr.x + 8, pr.y - 8, 70 + Math.sin(G.time * 11) * 4, 0.95);
      if (pr.img.windows) for (const w of pr.img.windows) L(pr.x + w.x + w.w / 2, pr.y - pr.img.height + w.y + w.h, 26, 0.6);
      if (pr.kind === 'entrance') L(pr.x + pr.img.width / 2, pr.y - 8, 26, 0.5);
    }
    if (A.kind === 'overworld' && night > 0.5 && (A.biome === 'vale' || A.biome === 'swamp')) for (let i = 0; i < 14; i++) { const fx = ((Math.sin(i * 12.9 + G.time * 0.15) + 1) / 2) * VIEW.w, fy = ((Math.cos(i * 7.3 + G.time * 0.11) + 1) / 2) * VIEW.h; if (Math.sin(G.time * 2 + i) > 0) hole(fx, fy, 9, 0.8); }
  }
  for (const b of G.projs) if (['fire', 'pfire', 'soul', 'bigfire'].includes(b.kind)) L(b.x, b.y, 26, 0.7);
  for (const m of G.mons) if (m.d.glow) L(m.x, m.y - 12, 30, 0.7);
  if (G.pet && G.pet.id === 'sprite') L(G.pet.x, G.pet.y - 16, 70, 0.9);
  ctx.drawImage(lightC, 0, 0);
  if (A.kind === 'overworld' && night > 0.5 && (A.biome === 'vale' || A.biome === 'swamp')) for (let i = 0; i < 14; i++) { const fx = ((Math.sin(i * 12.9 + G.time * 0.15) + 1) / 2) * VIEW.w, fy = ((Math.cos(i * 7.3 + G.time * 0.11) + 1) / 2) * VIEW.h; if (Math.sin(G.time * 2 + i) > 0) px(ctx, fx, fy, 1, 1, '#e8ff8a'); }
}
function drawWeather(cx, cy) {
  const A = G.area; if (A.kind !== 'overworld') return;
  const k = Weather.kind, a = Weather.amt;
  if ((k === 'fog' || A.biome === 'swamp') && SET.weather) { const fa = (k === 'fog' ? 0.32 * a : 0) + (A.biome === 'swamp' ? 0.1 : 0); for (let i = 0; i < 3; i++) { const fx = ((G.time * (6 + i * 3) + i * 160) % (VIEW.w + 300)) - 150, g = ctx.createRadialGradient(fx, VIEW.h * (0.3 + i * 0.25), 10, fx, VIEW.h * (0.3 + i * 0.25), 200); g.addColorStop(0, `rgba(200,210,220,${fa})`); g.addColorStop(1, 'rgba(200,210,220,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h); } }
  if (k === 'sandstorm') { ctx.fillStyle = `rgba(200,160,90,${0.25 * a})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (k === 'blizzard') { ctx.fillStyle = `rgba(230,240,255,${0.18 * a})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (k === 'rain' || k === 'storm') { ctx.strokeStyle = 'rgba(170,200,240,.55)'; ctx.beginPath(); for (const d of Weather.drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2 * Weather.wind, d.y + 6 * d.s); } ctx.stroke(); if (chance(0.3 * a)) { const sx = rand(0, VIEW.w), sy = rand(0, VIEW.h); px(ctx, sx, sy, 2, 1, 'rgba(200,220,255,.6)'); } }
  else if (k === 'snow' || k === 'blizzard') { ctx.fillStyle = '#ffffff'; for (const d of Weather.drops) ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s > 1 ? 2 : 1, d.s > 1 ? 2 : 1); }
  else if (k === 'sandstorm') { ctx.fillStyle = '#e8c87a'; for (const d of Weather.drops) ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 1); }
  if (Weather.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Weather.flash * 0.5})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
}
function drawLabels(cx, cy) {
  const A = G.area, p = G.p; ctx.save(); ctx.translate(-cx, -cy);
  if (A.kind === 'overworld') {
    const lv = G.save ? S().level : 99, beat = G.save ? G.save.stats.bosses : {}, act = G.save ? ST().act : 1, mo = G.save && ST().flags.mirrorOpen;
    for (const e of A.entrances) {
      if (Math.abs(e.x - p.x) > VIEW.w || Math.abs(e.y - p.y) > VIEW.h) continue; const d = e.d;
      if (d.secret && !mo) continue;
      const ok = lv >= d.lvl && d.act <= act, done = beat[d.id];
      tinyText(ctx, d.name, e.x, e.y - 44, done ? '#9be04a' : '#f2e6c8');
      tinyText(ctx, d.act > act ? 'SEALED' : ok ? 'LV ' + d.lvl + (done ? ' CLEARED' : '') : 'NEEDS LV ' + d.lvl, e.x, e.y - 37, d.act > act ? '#b878ea' : ok ? '#f2c13a' : '#ff6a6a');
    }
    for (const n of A.npcs) {
      if (n.hidden) continue;
      const mk = G.save ? Quests.marker(n.id) : null, near = dist(n.x, n.y, p.x, p.y) < 90;
      if (mk) tinyText(ctx, mk, n.x, n.y - 42 + Math.sin(G.time * 4) * 1.5, mk === '?' ? '#7dff8a' : '#f2c13a', 2);
      if (near) tinyText(ctx, n.name, n.x, n.y - 33, n.shop ? '#f2c13a' : '#efe4cc');
      if (n.bubbleT > 0) tinyText(ctx, n.bubble, n.x, n.y - (mk ? 52 : 41), '#ffffff');
    }
  }
  for (const pt of A.portals) tinyText(ctx, 'EXIT', pt.x, pt.y - 18, '#d8b8ff');
  if (A.captive && !A.captive.freed) tinyText(ctx, 'HELP!', A.captive.x, A.captive.y - 37 + Math.sin(G.time * 5), '#ffffff');
  for (const m of G.mons) {
    if (A.kind === 'dungeon' && dist(m.x, m.y, p.x, p.y) > 150) continue;
    if (m.scripted && m.type === 'lich' && Story.active()) continue;
    const top = m._top == null ? m.y - 20 : m._top;
    if (!m.boss) { const bw = Math.max(14, Math.round(m.w * 1.4)), bx = Math.round(m.x - bw / 2), by = Math.round(top - 4); px(ctx, bx - 1, by - 1, bw + 2, 4, '#0a0610'); px(ctx, bx, by, Math.max(0, Math.round((bw * m.hp) / m.maxHp)), 2, m.poisonT > 0 ? '#9be04a' : m.burnT > 0 ? '#ff8a2a' : m.mini ? '#f2c13a' : '#e0404a'); }
    if (SET.names || m.boss || m.mini) tinyText(ctx, m.d.name, m.x, top - (m.boss ? 3 : 6), m.boss ? '#ffb1a8' : m.mini ? '#f2c13a' : '#efe4cc');
    if (m.wind > 0) tinyText(ctx, '!', m.x, top - 13, '#ff4040', 2);
    if (m.stun > 0) tinyText(ctx, '* *', m.x, top - 12, '#ffd23a');
  }
  for (const t of G.texts) { ctx.globalAlpha = clamp((t.life / t.max) * 1.6, 0, 1); tinyText(ctx, t.txt, t.x, t.y, t.col, t.big ? 2 : 1); }
  ctx.globalAlpha = 1; ctx.restore();
}
function drawOverlays() {
  const p = G.p;
  if (p && p.hurtT > 0) { ctx.fillStyle = `rgba(200,30,40,${p.hurtT * 0.9})`; ctx.fillRect(0, 0, VIEW.w, 3); ctx.fillRect(0, VIEW.h - 3, VIEW.w, 3); ctx.fillRect(0, 0, 3, VIEW.h); ctx.fillRect(VIEW.w - 3, 0, 3, VIEW.h); }
  if (p && p.blindT > 0) { ctx.fillStyle = `rgba(200,160,90,${Math.min(0.7, p.blindT * 0.5)})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (p && G.save && p.hp < PS().maxHp * 0.25 && !G.dead) { const a = 0.15 + Math.sin(G.time * 5) * 0.08; const g = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.3, VIEW.w / 2, VIEW.h / 2, VIEW.w * 0.7); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(120,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (Story.vision) { const a = 0.45 + Math.sin(Story.visionT * 2) * 0.08, g = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.2, VIEW.w / 2, VIEW.h / 2, VIEW.w * 0.6); g.addColorStop(0, 'rgba(60,20,90,.15)'); g.addColorStop(1, `rgba(30,5,50,${a + 0.3})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (Story.red) { ctx.fillStyle = 'rgba(150,10,20,.35)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h); pcircCtx(ctx, VIEW.w * 0.75, VIEW.h * 0.22, 18, '#c8202a'); pcircCtx(ctx, VIEW.w * 0.75 - 4, VIEW.h * 0.22 - 3, 4, '#e84a4a'); }
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.7})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
  if (Story.fade > 0.001) { ctx.fillStyle = `rgba(0,0,0,${Story.fade})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h); }
}
