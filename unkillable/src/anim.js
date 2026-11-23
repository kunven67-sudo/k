// UNKILLABLE - Episode 1 "Welcome to Dunmore". Every frame is drawn from time t (seconds), so the
// whole episode can be rendered frame by frame and the sound lines up with the same timeline.
export const W = 1280, H = 720, FPS = 24;

// ---------------- small helpers ----------------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
const easeOut = (k) => { k = clamp(k); return 1 - (1 - k) * (1 - k); };
const easeIn = (k) => { k = clamp(k); return k * k; };
const seg = (t, a, b) => clamp((t - a) / (b - a));
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
const TAU = Math.PI * 2;

// ---------------- colors ----------------
const C = {
  skin: '#a9b9a0', skinD: '#77896f', line: '#1f2620', eye: '#07080a', goo: '#7cff3a', gooD: '#3dbf16',
  night: '#0c1022', night2: '#1b2340', grass: '#1f3a25', grassD: '#142a1a', dawn1: '#f6a66b', dawn2: '#6b6fa8',
  road: '#2d2f36', sky: '#8fc3ea', skyD: '#5b93c7', ground: '#5d8c48', groundD: '#3f6a31',
};

// ---------------- drawing primitives ----------------
function line(c, pts, w, col, cap = 'round') {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.lineWidth = w; c.strokeStyle = col; c.lineCap = cap; c.lineJoin = 'round'; c.stroke();
}
function circle(c, x, y, r, fill, stroke, sw = 3) {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = sw; c.strokeStyle = stroke; c.stroke(); }
}
function ell(c, x, y, rx, ry, rot, fill, stroke, sw = 3) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = sw; c.strokeStyle = stroke; c.stroke(); }
}
function rrect(c, x, y, w, h, r, fill, stroke, sw = 3) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = sw; c.strokeStyle = stroke; c.stroke(); }
}
function poly(c, pts, fill, stroke, sw = 3) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = sw; c.strokeStyle = stroke; c.stroke(); }
}
function text(c, s, x, y, size, col, opts = {}) {
  c.font = `${opts.weight || 800} ${size}px ${opts.font || '"Inter Display", "DejaVu Sans", sans-serif'}`;
  c.textAlign = opts.align || 'center'; c.textBaseline = opts.base || 'middle';
  if (opts.spacing) c.letterSpacing = opts.spacing + 'px'; else c.letterSpacing = '0px';
  if (opts.stroke) { c.lineWidth = opts.stroke; c.strokeStyle = opts.strokeCol || '#000'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillStyle = col; c.fillText(s, x, y);
}
function vgrad(c, y0, y1, a, b) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function fillAll(c, f) { c.fillStyle = f; c.fillRect(-2000, -2000, W + 4000, H + 4000); }
function vignette(c, k = 0.55) {
  const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function stars(c, n, seed, alpha = 1, t = 0) {
  for (let i = 0; i < n; i++) {
    const x = hash(seed + i) * W, y = hash(seed + i * 7.3) * H * 0.7;
    const tw = 0.6 + 0.4 * Math.sin(t * 2 + i);
    circle(c, x, y, 0.6 + hash(i * 3.1) * 1.6, `rgba(255,255,240,${alpha * tw})`);
  }
}

// ---------------- the alien ----------------
// x,y = point between the feet on the ground; s = scale (1 = about 230 px tall)
export function vorx(c, x, y, s, o = {}) {
  const ph = o.walk || 0, mut = o.mut || 0, dir = o.flip ? -1 : 1;
  const stride = o.walk !== undefined ? 1 : 0;
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  if (o.rot) c.rotate(o.rot);
  if (o.alpha !== undefined) c.globalAlpha *= o.alpha;
  const bob = stride ? Math.abs(Math.sin(ph)) * -6 : Math.sin((o.t || 0) * 1.7) * 2;
  const crouch = o.crouch || 0;
  const hipY = -92 + crouch * 30 + bob;
  const ol = C.line;
  // shadow
  if (!o.noShadow) ell(c, 0, 2, 46, 8, 0, 'rgba(0,0,0,0.28)');
  // legs (digitigrade: hip -> knee forward -> ankle back -> toe)
  const leg = (side) => {
    const a = stride ? Math.sin(ph + side * Math.PI) : 0;
    const fx = a * 26, lift = stride ? Math.max(0, Math.cos(ph + side * Math.PI)) * 12 : 0;
    const hx = side * 6;
    const kx = hx + 16 + fx * 0.4, ky = hipY + 38 - crouch * 10;
    const ax = fx - 8, ay = -16 - lift;
    const tx = fx + 16, ty = -lift;
    line(c, [hx, hipY, kx, ky, ax, ay, tx, ty], 15, ol);
    line(c, [hx, hipY, kx, ky, ax, ay, tx, ty], 9, side > 0 ? C.skin : C.skinD);
  };
  leg(-1);
  // far arm
  const arm = (side, shade) => {
    const sw = stride ? Math.sin(ph + (side > 0 ? Math.PI : 0)) * 18 : 0;
    const up = side > 0 ? (o.armUp || 0) : (o.armUp2 || 0);
    const sx = 4, sy = hipY - 52;
    const len = 1 + mut * 0.35;
    let ex = sx + 14 + sw * 0.3, ey = sy + 46 * len;
    let hx2 = sx + 22 + sw, hy = sy + 92 * len;
    if (up) { ex = lerp(ex, sx + 34, up); ey = lerp(ey, sy - 8, up); hx2 = lerp(hx2, sx + 70 * len, up); hy = lerp(hy, sy - 40, up); }
    line(c, [sx, sy, ex, ey, hx2, hy], 12, ol);
    line(c, [sx, sy, ex, ey, hx2, hy], 7, shade);
    for (let f = -1; f <= 1; f++) {
      const ang = Math.atan2(hy - ey, hx2 - ex) + f * 0.35;
      const fl = 20 + mut * 10;
      line(c, [hx2, hy, hx2 + Math.cos(ang) * fl, hy + Math.sin(ang) * fl], 5, ol);
      line(c, [hx2, hy, hx2 + Math.cos(ang) * fl, hy + Math.sin(ang) * fl], 2.4, shade);
    }
  };
  arm(-1, C.skinD);
  // torso
  c.beginPath();
  c.moveTo(-10, hipY + 6);
  c.bezierCurveTo(-18, hipY - 30, -10, hipY - 62, 6, hipY - 66);
  c.bezierCurveTo(20, hipY - 60, 20, hipY - 24, 12, hipY + 6);
  c.closePath(); c.fillStyle = C.skin; c.fill(); c.lineWidth = 4; c.strokeStyle = ol; c.stroke();
  // ribs
  for (let i = 0; i < 3; i++) line(c, [-6, hipY - 22 - i * 10, 8, hipY - 26 - i * 10], 2, C.skinD);
  leg(1);
  // neck + head
  const hx = 14 + (o.lookX || 0) * 6, hy = hipY - 112 + (o.lookY || 0) * 4;
  line(c, [6, hipY - 62, 10, hipY - 80, hx - 4, hy + 34], 12, ol);
  line(c, [6, hipY - 62, 10, hipY - 80, hx - 4, hy + 34], 6, C.skin);
  c.save(); c.translate(hx, hy); c.rotate((o.tilt || 0) + 0.12);
  // head: tall egg
  c.beginPath(); c.ellipse(0, 0, 30 + mut * 4, 44 + mut * 6, 0, 0, TAU);
  c.fillStyle = C.skin; c.fill(); c.lineWidth = 4; c.strokeStyle = ol; c.stroke();
  ell(c, -8, -18, 10, 14, -0.3, 'rgba(255,255,255,0.18)');
  // eyes
  const blink = o.blink ? 0.12 : 1;
  const ey = (ex, eyy, rx, ry, r) => {
    ell(c, ex, eyy, rx, ry * blink, r, C.eye);
    if (blink > 0.5) circle(c, ex - rx * 0.3, eyy - ry * 0.35, rx * 0.22, 'rgba(255,255,255,0.85)');
  };
  ey(-11, 2, 9, 14, 0.35); ey(13, 2, 9, 14, -0.35); ey(1, -22, 5, 7, 0);
  if (mut > 0.25) ey(-16, -16, 3.5, 5, 0.3);
  if (mut > 0.5) ey(18, -16, 3.5, 5, -0.3);
  if (mut > 0.75) { ey(-4, -34, 3, 4, 0); ey(8, -33, 3, 4, 0); }
  // mouth: vertical slit
  const mo = o.mouth || 0;
  ell(c, 1, 27, 3 + mo * 5, 4 + mo * 10, 0, '#2a1a1a', ol, 2);
  if (mo > 0.3) for (let i = -1; i <= 1; i++) line(c, [1 + i * 3, 27 - 4 - mo * 7, 1 + i * 3, 27 - mo * 4], 1.5, '#e9f0e0');
  c.restore();
  arm(1, C.skin);
  if (o.hold) { c.save(); c.translate(48, hipY - 18); o.hold(c); c.restore(); }
  c.restore();
}

// ---------------- people ----------------
export function person(c, x, y, s, o = {}) {
  const type = o.type || 'farmer', ph = o.walk, dir = o.flip ? -1 : 1;
  const stride = ph !== undefined;
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  if (o.rot) c.rotate(o.rot);
  const ol = C.line;
  const outfit = { farmer: ['#3f6fb0', '#c8b48a'], chef: ['#f2f2f2', '#333'], soldier: ['#4f6136', '#3b4a29'], scientist: ['#f4f6f8', '#4a5568'], general: ['#3e4d2c', '#2c3620'], anchor: ['#2b3a67', '#2b3a67'], kid: ['#d64545', '#2d4f8f'] }[type];
  const bob = stride ? Math.abs(Math.sin(ph)) * -4 : 0;
  if (!o.noShadow) ell(c, 0, 2, 34, 7, 0, 'rgba(0,0,0,0.25)');
  const leg = (side) => {
    const a = stride ? Math.sin(ph + (side > 0 ? 0 : Math.PI)) * 18 : (o.sit ? 0 : 0);
    if (o.sit) { line(c, [side * 7, -60, 26, -60, 26, 0], 13, ol); line(c, [side * 7, -60, 26, -60, 26, 0], 8, outfit[1]); return; }
    line(c, [side * 8, -62 + bob, side * 8 + a, 0], 13, ol); line(c, [side * 8, -62 + bob, side * 8 + a, 0], 8, outfit[1]);
    rrect(c, side * 8 + a - 6, -6, 18, 8, 3, '#2a2220');
  };
  leg(-1); leg(1);
  // body
  rrect(c, -20, -118 + bob, 40, 62, 12, outfit[0], ol, 4);
  if (type === 'farmer') { line(c, [-10, -118 + bob, -10, -70 + bob], 4, '#2c4f86'); line(c, [10, -118 + bob, 10, -70 + bob], 4, '#2c4f86'); }
  if (type === 'scientist') { line(c, [0, -116 + bob, 0, -58 + bob], 2, '#bcc3cc'); rrect(c, 6, -104 + bob, 8, 12, 2, '#3b82f6'); }
  if (type === 'soldier' || type === 'general') { rrect(c, -20, -84 + bob, 40, 6, 2, '#2a2f22'); }
  if (type === 'general') { for (let i = 0; i < 3; i++) circle(c, -10 + i * 6, -104 + bob, 2.5, '#f2c94c'); }
  // arms
  const armA = o.aim ? -0.05 : (o.armsUp ? -2.6 : (stride ? Math.sin(ph) * 0.5 : 0.15));
  const armB = o.armsUp ? -2.4 : (stride ? -Math.sin(ph) * 0.5 : -0.15);
  const arm = (ang, side, len = 46) => {
    const sx = side * 18, sy = -110 + bob;
    const hx = sx + Math.sin(ang) * len * side * -1 + (o.aim ? 40 : 0), hy = sy + Math.cos(ang) * len - (o.aim ? 34 : 0);
    line(c, [sx, sy, hx, hy], 11, ol); line(c, [sx, sy, hx, hy], 6, outfit[0]);
    circle(c, hx, hy, 6, '#f0c8a0', ol, 2);
    return [hx, hy];
  };
  arm(armB, -1);
  const hand = arm(armA, 1);
  if (o.hold) { c.save(); c.translate(hand[0], hand[1]); o.hold(c); c.restore(); }
  // head
  const hy = -146 + bob;
  circle(c, 0, hy, 24, '#f0c8a0', ol, 4);
  const sc = o.scared || 0;
  circle(c, 8, hy - 3, 3 + sc * 3, '#fff'); circle(c, 8, hy - 3, 2, ol);
  if (sc > 0.3) { ell(c, 12, hy + 12, 4 + sc * 3, 5 + sc * 6, 0, '#3a1010'); line(c, [2, hy - 13, 13, hy - 15], 2, ol); }
  else if (o.smile) { c.beginPath(); c.arc(10, hy + 8, 7, 0.2, Math.PI - 0.6); c.lineWidth = 2.5; c.strokeStyle = ol; c.stroke(); }
  else line(c, [5, hy + 11, 16, hy + 10], 2.5, ol);
  if (o.sweat) ell(c, -14, hy - 6, 3, 5, 0, '#7cc8ff');
  // hats
  if (type === 'farmer') { ell(c, 0, hy - 16, 36, 7, 0, '#d9b45a', ol, 3); rrect(c, -16, hy - 36, 32, 20, 8, '#d9b45a', ol, 3); line(c, [-16, hy - 20, 16, hy - 20], 4, '#a5462a'); }
  if (type === 'chef') { rrect(c, -18, hy - 52, 36, 32, 10, '#fff', ol, 3); circle(c, -10, hy - 50, 12, '#fff', ol, 3); circle(c, 10, hy - 52, 13, '#fff', ol, 3); rrect(c, -18, hy - 38, 36, 18, 4, '#fff'); }
  if (type === 'soldier') { c.beginPath(); c.arc(0, hy - 6, 27, Math.PI, 0); c.fillStyle = '#4f6136'; c.fill(); c.lineWidth = 3; c.strokeStyle = ol; c.stroke(); }
  if (type === 'general') { rrect(c, -22, hy - 30, 44, 14, 4, '#3e4d2c', ol, 3); ell(c, 8, hy - 16, 22, 5, 0, '#2a2f22'); circle(c, 0, hy - 24, 4, '#f2c94c'); }
  if (type === 'scientist') { rrect(c, -4, hy - 10, 22, 10, 4, 'rgba(160,220,255,0.6)', ol, 2); c.beginPath(); c.arc(0, hy - 8, 25, Math.PI * 1.05, Math.PI * 1.95); c.lineWidth = 7; c.strokeStyle = '#6b5240'; c.stroke(); }
  if (type === 'anchor') { c.beginPath(); c.arc(0, hy - 6, 26, Math.PI * 1.0, Math.PI * 2); c.lineWidth = 10; c.strokeStyle = '#3a2a1f'; c.stroke(); }
  c.restore();
}

// ---------------- effects ----------------
function gooSplat(c, x, y, s, seed, k = 1) {
  c.save(); c.translate(x, y); c.scale(s, s * 0.5);
  c.fillStyle = C.gooD; c.beginPath(); c.ellipse(0, 0, 70 * k, 40 * k, 0, 0, TAU); c.fill();
  c.fillStyle = C.goo;
  for (let i = 0; i < 9; i++) {
    const a = hash(seed + i) * TAU, d = (30 + hash(seed + i * 2) * 60) * k;
    circle(c, Math.cos(a) * d, Math.sin(a) * d, (6 + hash(seed + i * 3) * 14) * k, C.goo);
  }
  c.beginPath(); c.ellipse(0, 0, 55 * k, 30 * k, 0, 0, TAU); c.fill();
  circle(c, -14 * k, -10 * k, 10 * k, 'rgba(255,255,255,0.45)');
  c.restore();
}
function gooBurst(c, x, y, p, seed, s = 1) {
  // flying droplets after an impact, p = 0..1
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI * (0.1 + 0.8 * hash(seed + i)), sp = (180 + hash(seed + i * 5) * 320) * s;
    const dx = Math.cos(a) * sp * p, dy = Math.sin(a) * sp * p + 500 * p * p * s;
    circle(c, x + dx, y + dy, (3 + hash(i) * 7) * s * (1 - p * 0.6), i % 3 ? C.goo : C.gooD);
  }
}
function respawnFx(c, x, y, p, s = 1) {
  // green flash column + rings; p = 0..1
  const a = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(x - 60 * s, 0, x + 60 * s, 0);
  g.addColorStop(0, 'rgba(124,255,58,0)'); g.addColorStop(0.5, `rgba(160,255,110,${0.8 * a})`); g.addColorStop(1, 'rgba(124,255,58,0)');
  c.fillStyle = g; c.fillRect(x - 60 * s, y - 900, 120 * s, 900);
  for (let i = 0; i < 3; i++) {
    const r = (40 + p * 260 + i * 40) * s;
    ell(c, x, y, r, r * 0.25, 0, null, `rgba(140,255,90,${a * (0.8 - i * 0.2)})`, 6 * s);
  }
  for (let i = 0; i < 24; i++) {
    const ang = hash(i * 9) * TAU, d = p * (80 + hash(i) * 200) * s;
    circle(c, x + Math.cos(ang) * d, y - 80 * s - Math.sin(ang) * d * 0.7 - p * 120 * s, 3 * s, `rgba(190,255,150,${a})`);
  }
  c.restore();
}
function flash(c, a, col = '255,255,255') { if (a <= 0) return; c.fillStyle = `rgba(${col},${clamp(a)})`; c.fillRect(0, 0, W, H); }
function shake(c, amt, t) { if (amt <= 0) return; c.translate(Math.sin(t * 91) * amt, Math.cos(t * 77) * amt); }
function bubbles(c, x, y, t, n, seed) {
  for (let i = 0; i < n; i++) {
    const tt = (t * 0.7 + hash(seed + i)) % 1;
    circle(c, x + Math.sin(t * 3 + i) * 12 + (hash(i * 4) - 0.5) * 40, y - tt * 300, 3 + hash(i) * 6, null, 'rgba(220,245,255,0.7)', 2);
  }
}
function smoke(c, x, y, t, n, seed, col = '120,120,130') {
  for (let i = 0; i < n; i++) {
    const tt = (t * 0.25 + hash(seed + i)) % 1;
    circle(c, x + Math.sin(t + i) * 20 + tt * 40, y - tt * 260, 18 + tt * 50, `rgba(${col},${0.35 * (1 - tt)})`);
  }
}
function muzzle(c, x, y, a, s = 1) {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  poly(c, [x, y - 10 * s, x + 50 * s, y, x, y + 10 * s, x + 14 * s, y], `rgba(255,220,120,${a})`);
  circle(c, x + 6 * s, y, 14 * s, `rgba(255,240,180,${a})`);
  c.restore();
}

// ---------------- props / backgrounds ----------------
function crater(c, x, y, s, glow, t) {
  ell(c, x, y, 120 * s, 26 * s, 0, '#2a2418');
  ell(c, x, y + 2 * s, 96 * s, 18 * s, 0, '#120f0a');
  if (glow > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const pulse = 0.7 + 0.3 * Math.sin(t * 3);
    const g = c.createRadialGradient(x, y, 4, x, y, 140 * s);
    g.addColorStop(0, `rgba(124,255,58,${0.7 * glow * pulse})`); g.addColorStop(1, 'rgba(124,255,58,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 160 * s, 60 * s, 0, 0, TAU); c.fill();
    c.restore();
  }
  for (let i = 0; i < 7; i++) { const a = Math.PI + i * 0.45; circle(c, x + Math.cos(a) * 118 * s, y + Math.sin(a) * 22 * s + 6 * s, (8 + hash(i) * 8) * s, '#3c3424', C.line, 2); }
}
function nightField(c, t, horizon = 470) {
  fillAll(c, vgrad(c, 0, horizon, C.night, C.night2));
  stars(c, 140, 3, 1, t);
  circle(c, 1040, 110, 46, '#f4f0d8'); circle(c, 1024, 100, 9, 'rgba(0,0,0,0.08)'); circle(c, 1056, 124, 6, 'rgba(0,0,0,0.08)');
  c.fillStyle = '#0e1a14';
  c.beginPath(); c.moveTo(0, horizon);
  for (let x = 0; x <= W; x += 40) c.lineTo(x, horizon - 30 - Math.sin(x * 0.01) * 22 - hash(x) * 10);
  c.lineTo(W, H); c.lineTo(0, H); c.fill();
  c.fillStyle = vgrad(c, horizon, H, '#16301e', '#0b1a10'); c.fillRect(0, horizon, W, H - horizon);
  for (let i = 0; i < 60; i++) { const x = hash(i * 3) * W, y = horizon + 10 + hash(i * 5) * (H - horizon); line(c, [x, y, x - 4, y - 14], 2, '#2a4a30'); line(c, [x, y, x + 5, y - 12], 2, '#2a4a30'); }
}
function daySky(c, horizon, warm = 0) {
  fillAll(c, vgrad(c, 0, horizon, warm ? '#f7b27a' : C.skyD, warm ? '#fde3b5' : C.sky));
  for (let i = 0; i < 5; i++) {
    const x = (hash(i * 9) * W + i * 60) % W, y = 60 + hash(i * 4) * 160;
    for (let j = 0; j < 4; j++) circle(c, x + j * 30, y + Math.sin(j) * 8, 26 + hash(i + j) * 14, 'rgba(255,255,255,0.85)');
  }
}
function groundBand(c, y, top = C.ground, bot = C.groundD) { c.fillStyle = vgrad(c, y, H, top, bot); c.fillRect(-1000, y, W + 3000, H - y + 200); }
function house(c, x, y, s, col, roof) {
  c.save(); c.translate(x, y); c.scale(s, s);
  rrect(c, -70, -110, 140, 110, 4, col, C.line, 4);
  poly(c, [-86, -110, 0, -175, 86, -110], roof, C.line, 4);
  rrect(c, -50, -80, 34, 30, 3, '#ffe9a8', C.line, 3); line(c, [-33, -80, -33, -50], 2, C.line);
  rrect(c, 16, -64, 30, 64, 3, '#7a4a2a', C.line, 3);
  c.restore();
}
function tree(c, x, y, s, col = '#2f6b33') {
  rrect(c, x - 8 * s, y - 70 * s, 16 * s, 70 * s, 4, '#6b4a2b', C.line, 3);
  circle(c, x, y - 100 * s, 46 * s, col, C.line, 4); circle(c, x - 30 * s, y - 80 * s, 30 * s, col, C.line, 4); circle(c, x + 30 * s, y - 78 * s, 32 * s, col, C.line, 4);
  circle(c, x, y - 92 * s, 40 * s, col);
}
function fence(c, y, x0, x1) {
  for (let x = x0; x < x1; x += 46) rrect(c, x, y - 60, 12, 60, 3, '#c9a578', C.line, 3);
  rrect(c, x0 - 10, y - 50, x1 - x0, 9, 2, '#c9a578', C.line, 3); rrect(c, x0 - 10, y - 28, x1 - x0, 9, 2, '#c9a578', C.line, 3);
}
function sign(c, x, y, lines, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  rrect(c, -6, -150, 12, 150, 3, '#8a8f99', C.line, 3);
  rrect(c, -110, -210, 220, 80, 8, '#2f7a4a', C.line, 4); rrect(c, -102, -202, 204, 64, 6, null, '#e8f2ea', 3);
  text(c, lines[0], 0, -180, 26, '#fff'); if (lines[1]) text(c, lines[1], 0, -152, 18, '#e8f2ea', { weight: 700 });
  c.restore();
}
function deathCounter(c, n, bump) {
  if (n <= 0) return;
  const s = 1 + bump * 0.35;
  c.save(); c.translate(W - 130, 64); c.scale(s, s);
  rrect(c, -104, -38, 208, 76, 14, 'rgba(10,14,10,0.78)', bump > 0.2 ? C.goo : 'rgba(124,255,58,0.6)', 3);
  text(c, 'DEATHS', -44, 0, 18, '#bff5a0', { weight: 800, spacing: 2 });
  text(c, String(n), 50, 2, 40, C.goo, { weight: 900 });
  c.restore();
}

// ---------------- scenes ----------------
// each scene: dur (s), mood (music), events [[time, sfx, {death:true}]], draw(c, t, ctx)
const S = [];
const add = (sc) => { S.push(sc); return sc; };

// 1. Cold open: meteor crash
add({ name: 'crash', dur: 72, mood: 'creepy', events: [[6, 'whoosh'], [12.4, 'boom'], [13, 'rumble'], [30, 'hiss'], [41, 'gurgle'], [52, 'chirp'], [62, 'chirp2']],
  draw(c, t) {
    const cam = ease(seg(t, 0, 10));
    c.save(); c.translate(0, lerp(-260, 0, cam));
    nightField(c, t);
    c.restore();
    c.save(); c.translate(0, lerp(-260, 0, cam));
    // meteor
    if (t > 4 && t < 12.5) {
      const p = seg(t, 4, 12.4);
      const mx = lerp(-100, 640, easeIn(p)), my = lerp(-80, 520, easeIn(p));
      for (let i = 0; i < 20; i++) circle(c, mx - i * 14, my - i * 11, 18 - i * 0.8, `rgba(${200 - i * 4},${255 - i * 8},120,${0.6 - i * 0.03})`);
      circle(c, mx, my, 16, '#eaffd0');
    }
    c.restore();
    if (t > 12.4) {
      crater(c, 640, 560, 1.2, clamp(1 - (t - 13) / 30) * 0.8 + 0.4, t);
      smoke(c, 640, 540, t, 10, 3);
      shake(c, clamp(1 - (t - 12.4) / 2) * 18, t);
      flash(c, 1 - (t - 12.4) / 1.2, '210,255,190');
    }
    // the hand, then the climb out
    if (t > 36 && t <= 58) {
      const p = seg(t, 36, 50);
      const y = lerp(640, 560, ease(p));
      c.save(); c.beginPath(); c.rect(0, 0, W, 560); c.clip();
      vorx(c, 640, y + 110 * (1 - ease(seg(t, 44, 56))), 1.05, { t, armUp: 1 - ease(seg(t, 48, 58)), mouth: t > 52 && t < 54 ? 0.8 : 0.1, blink: (t % 4) < 0.15, lookX: Math.sin(t * 0.7) });
      c.restore();
    }
    if (t > 58) {
      const p = seg(t, 58, 72);
      vorx(c, 640 + ease(p) * 180, 600, 1.05, { t, walk: t * 5, mouth: 0.1, lookX: 1 });
    }
    vignette(c, 0.7);
  } });

// 2. Title card
add({ name: 'title', dur: 16, mood: 'title', events: [[0.5, 'sting']],
  draw(c, t) {
    fillAll(c, '#06080a');
    const p = ease(seg(t, 0.4, 3));
    const glitch = t < 3 ? (hash(Math.floor(t * 24)) - 0.5) * 30 * (1 - p) : 0;
    c.save(); c.globalAlpha = p;
    text(c, 'UNKILLABLE', W / 2 + glitch, 320, 132, C.goo, { weight: 900, spacing: 6, stroke: 10, strokeCol: '#0b2a05' });
    if (t > 1 && t < 2.5) text(c, 'UNKILLABLE', W / 2 + 8, 324, 132, 'rgba(255,40,80,0.5)', { weight: 900, spacing: 6 });
    c.globalAlpha = ease(seg(t, 4, 6));
    text(c, 'EPISODE 1', W / 2, 440, 28, '#cfe9c2', { weight: 800, spacing: 10 });
    text(c, 'Welcome to Dunmore', W / 2, 486, 40, '#ffffff', { weight: 700 });
    c.restore();
    c.globalAlpha = 1 - ease(seg(t, 14, 16)); c.globalAlpha = 1;
    flash(c, ease(seg(t, 14, 16)), '0,0,0');
  } });

// helper scene: respawn at the crater (reused)
function respawnScene(name, dur, mut, opts = {}) {
  return { name, dur, mood: opts.mood || 'creepy', events: [[0.3, 'respawn'], ...(opts.events || [])],
    draw(c, t) {
      if (opts.day) { daySky(c, 470, opts.warm); groundBand(c, 470); tree(c, 180, 480, 1.1); tree(c, 1120, 470, 0.9); }
      else nightField(c, t);
      crater(c, 640, 560, 1.2, 0.9, t);
      const p = seg(t, 0.3, 2.6);
      const a = ease(seg(t, 0.4, 1.4));
      vorx(c, 640, 560, 1.05, { t, alpha: a, mut, mouth: t > 1.6 && t < 3 ? 0.9 : 0.15, lookX: Math.sin(t * 2), blink: (t % 3.3) < 0.12, tilt: Math.sin(t * 1.3) * 0.12, armUp: opts.lookHands ? ease(seg(t, 3, 4)) * 0.6 : 0 });
      respawnFx(c, 640, 560, p);
      if (opts.walkOff && t > dur - 6) vorx; // walking off handled by next scene
      vignette(c, 0.55);
    } };
}

// 3. The road + truck (death 1)
add({ name: 'road', dur: 58, mood: 'sneaky', events: [[38, 'horn'], [41.2, 'splat', { death: true }], [41.3, 'brake'], [44, 'truckaway']],
  draw(c, t) {
    const pan = ease(seg(t, 0, 20)) * 500;
    c.save(); c.translate(-pan, 0);
    daySky(c, 430, 1);
    circle(c, 900, 420, 80, '#ffd58a');
    groundBand(c, 430, '#6f9a4f', '#4e7a3a');
    for (let i = 0; i < 7; i++) tree(c, 100 + i * 260, 440 + (i % 2) * 10, 0.7 + hash(i) * 0.3, '#3c7a3f');
    sign(c, 1180, 560, ['DUNMORE', 'POP. 412']);
    c.fillStyle = C.road; c.fillRect(-200, 560, W + 1200, 110);
    for (let x = -200; x < W + 1000; x += 120) rrect(c, x, 610, 60, 8, 3, '#f2d36b');
    c.restore();
    // vorx walks then stops on the road
    let vx, vy = 610, walk;
    if (t < 26) { vx = lerp(220, 560, ease(seg(t, 0, 26))); vy = lerp(540, 610, ease(seg(t, 14, 26))); walk = t * 5; }
    else { vx = 560; walk = undefined; }
    const look = t > 30 && t < 41 ? 1 : 0;
    // truck
    const tp = seg(t, 33, 41.2);
    const trx = lerp(1700, 640, easeIn(tp));
    if (t < 41.2) {
      if (t > 30 && t < 41.2) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(trx - 160, 600, 5, trx - 160, 600, 260); g.addColorStop(0, `rgba(255,250,200,${0.25 + tp * 0.4})`); g.addColorStop(1, 'rgba(255,250,200,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); }
      vorx(c, vx, vy, 0.95, { t, walk, mouth: look ? 0.4 + tp * 0.6 : 0.1, lookX: look ? 1 : 0, flip: look, blink: (t % 3) < 0.12 });
    }
    // truck draw
    const tx = t < 41.2 ? trx : lerp(640, -900, easeIn(seg(t, 41.2, 47)));
    c.save(); c.translate(tx, 0);
    rrect(c, -150, 470, 120, 150, 14, '#c7432f', C.line, 5); rrect(c, -132, 488, 70, 56, 6, '#bfe6ff', C.line, 3);
    rrect(c, -30, 440, 360, 180, 8, '#e9e9ef', C.line, 5); text(c, 'BIG JIM', 150, 520, 44, '#c7432f');
    for (const wx of [-100, 120, 260]) { circle(c, wx, 624, 34, '#222', C.line, 4); circle(c, wx, 624, 12, '#999'); }
    circle(c, -150, 596, 10, '#fff7b0');
    c.restore();
    if (t >= 41.2) {
      gooSplat(c, 640, 640, 1.3, 11);
      gooBurst(c, 640, 600, seg(t, 41.2, 42.6), 5, 1.2);
      shake(c, clamp(1 - (t - 41.2) * 2) * 14, t);
      flash(c, 1 - (t - 41.2) * 3, '200,255,170');
    }
    vignette(c, 0.35);
  } });
add(respawnScene('respawn1', 26, 0.02, { day: true, warm: 1, lookHands: true, events: [[6, 'chirp']] }));

// 4. The lake (death 2)
add({ name: 'lake', dur: 70, mood: 'curious', events: [[30, 'splash'], [36, 'gurgle'], [44, 'bubbles'], [55, 'bubbles'], [58, 'silence', { death: true }]],
  draw(c, t) {
    const under = t > 33;
    if (!under) {
      daySky(c, 360);
      groundBand(c, 360, '#5f9150', '#41703a');
      c.fillStyle = vgrad(c, 430, H, '#3f86b5', '#1d4f7a'); c.beginPath(); c.ellipse(760, 600, 620, 200, 0, 0, TAU); c.fill();
      for (let i = 0; i < 8; i++) line(c, [400 + i * 80, 520 + (i % 3) * 30, 440 + i * 80, 520 + (i % 3) * 30], 3, 'rgba(255,255,255,0.4)');
      tree(c, 120, 420, 1.2); tree(c, 260, 400, 0.8);
      const vx = lerp(120, 300, ease(seg(t, 0, 12)));
      const lean = ease(seg(t, 16, 28));
      if (t < 30) {
        // reflection
        c.save(); c.globalAlpha = 0.35 * lean; c.translate(0, 1080); c.scale(1, -1); vorx(c, 420, 540, 0.9, { t, noShadow: true, mouth: 0.2 }); c.restore();
        vorx(c, t < 12 ? vx : lerp(300, 380, lean), 500, 0.9, { t, walk: t < 12 ? t * 5 : undefined, rot: lean * 0.5, lookY: lean, mouth: t > 22 && t < 25 ? 0.6 : 0.1, blink: (t % 2.8) < 0.12 });
      } else {
        const p = seg(t, 30, 33);
        vorx(c, lerp(420, 470, p), lerp(520, 640, easeIn(p)), 0.9, { t, rot: 0.5 + p * 2.2, mouth: 1 });
        for (let i = 0; i < 14; i++) { const a = -Math.PI * hash(i); circle(c, 470 + Math.cos(a) * 140 * p, 540 + Math.sin(a) * 120 * p + 200 * p * p, 6, '#cfefff'); }
      }
    } else {
      // underwater
      fillAll(c, vgrad(c, 0, H, '#2a6f97', '#06233d'));
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(160,220,255,0.06)'; c.beginPath(); c.moveTo(150 + i * 200 + Math.sin(t + i) * 30, 0); c.lineTo(230 + i * 200, 0); c.lineTo(300 + i * 200 + Math.sin(t * 0.7 + i) * 40, H); c.lineTo(120 + i * 200, H); c.fill(); }
      c.restore();
      for (let i = 0; i < 9; i++) { const x = 60 + i * 140; line(c, [x, H, x + Math.sin(t + i) * 30, H - 160 - hash(i) * 120], 10, '#1d5b3a'); }
      const sink = ease(seg(t, 33, 50));
      const vy = lerp(260, 640, sink);
      vorx(c, 640, vy, 0.95, { t, rot: Math.sin(t * 1.4) * 0.3, mouth: t < 50 ? 0.5 + 0.4 * Math.sin(t * 6) : 0, armUp: 0.5 + 0.5 * Math.sin(t * 3), armUp2: 0.5 + 0.5 * Math.cos(t * 3), noShadow: true, blink: t > 56 });
      if (t < 56) bubbles(c, 660, vy - 200, t, 10, 7);
      // fish that watch
      for (let i = 0; i < 3; i++) {
        const fx = 220 + i * 380 + Math.sin(t * 0.4 + i) * 40, fy = 200 + i * 90;
        ell(c, fx, fy, 40, 20, 0, ['#f2a541', '#e05d5d', '#9b7ad8'][i], C.line, 3);
        poly(c, [fx - 36, fy, fx - 66, fy - 18, fx - 66, fy + 18], ['#f2a541', '#e05d5d', '#9b7ad8'][i], C.line, 3);
        circle(c, fx + 20, fy - 4, 6, '#fff', C.line, 2); circle(c, fx + 20 + (640 - fx) * 0.004, fy - 4, 3, C.line);
      }
      c.fillStyle = `rgba(0,0,0,${ease(seg(t, 56, 64)) * 0.9})`; c.fillRect(0, 0, W, H);
    }
    vignette(c, 0.45);
  } });
add(respawnScene('respawn2', 22, 0.05, { day: true, events: [[5, 'cough'], [7, 'cough']] }));

// 5. The farmer (deaths 3, 4, 5)
function farmBG(c, t) {
  daySky(c, 430); groundBand(c, 430, '#79a65a', '#557f40');
  house(c, 930, 440, 1.6, '#c9573f', '#5a3a2a');
  rrect(c, 760, 380, 400, 22, 4, '#a07a52', C.line, 3);
  fence(c, 470, 40, 640);
  tree(c, 120, 440, 1.2);
}
add({ name: 'farm', dur: 104, mood: 'sneaky', events: [[24, 'chirp'], [27, 'scream'], [30, 'shotgun', { death: true }], [38, 'respawn'], [58, 'shotgun', { death: true }], [66, 'respawn'], [86, 'click'], [87.5, 'click'], [91, 'throw'], [92.6, 'bonk', { death: true }]],
  draw(c, t) {
    farmBG(c, t);
    // farmer on the porch
    const scared = (t > 24 && t < 33) || (t > 52 && t < 60) || t > 84 ? 1 : 0;
    const stand = t > 25;
    const aiming = (t > 27 && t < 32) || (t > 55 && t < 59) || (t > 85 && t < 90);
    const gun = (cc) => { rrect(cc, -6, -6, 70, 10, 3, '#5b3a20', C.line, 2); rrect(cc, 40, -8, 50, 7, 2, '#555', C.line, 2); };
    if (t < 90.5) person(c, 980, 420, 1.15, { type: 'farmer', sit: !stand, scared, aim: aiming, flip: true, hold: gun, sweat: t > 52 });
    else person(c, 980, 420, 1.15, { type: 'farmer', scared: 1, armsUp: true, flip: true });
    if (!stand) { rrect(c, 920, 330, 90, 90, 10, null, '#7a5232', 6); }
    muzzle(c, 900, 323, (t > 30 && t < 30.2) || (t > 58 && t < 58.2) ? 1 : 0, -1.2);
    // the alien tries to make friends
    const tryN = t < 36 ? 0 : t < 64 ? 1 : 2;
    const base = [0, 36, 64][tryN];
    const lt = t - base;
    const hit = [30, 58, 92.6][tryN];
    const flower = (cc) => {
      const fs = [0.7, 1, 1.9][tryN];
      line(cc, [0, 0, 6, -50 * fs], 4, '#2f7a3a');
      for (let i = 0; i < 6; i++) circle(cc, 6 + Math.cos(i) * 12 * fs, -54 * fs + Math.sin(i) * 12 * fs, 9 * fs, ['#f25c8a', '#f2c84b', '#8ad1ff'][tryN], C.line, 2);
      circle(cc, 6, -54 * fs, 7 * fs, '#ffe36b');
    };
    if (t < hit) {
      const vx = tryN === 0 ? lerp(-80, 640, ease(seg(lt, 0, 20))) : lerp(640, 700, ease(seg(lt, 2, 14)));
      if (tryN > 0 && lt < 2) respawnFx(c, 640, 560, lt / 2);
      vorx(c, vx, 560, 0.95, { t, walk: lt < 18 ? t * 5 : undefined, hold: flower, armUp: 0.4, mouth: 0.15 + (lt > 20 ? 0.3 : 0), blink: (t % 3) < 0.1, tilt: lt > 20 ? Math.sin(t * 4) * 0.08 : 0 });
    } else {
      const dt = t - hit;
      gooSplat(c, tryN === 0 ? 640 : 700, 572, 1.1, tryN * 7);
      gooBurst(c, tryN === 0 ? 640 : 700, 470, seg(dt, 0, 1.4), tryN + 3);
      if (tryN === 2) { rrect(c, 690, 540, 80, 10, 3, '#5b3a20', C.line, 2); }
      flash(c, 1 - dt * 3, '255,240,200');
      if (tryN === 2) { c.fillStyle = `rgba(0,0,0,${ease(seg(dt, 6, 11))})`; c.fillRect(0, 0, W, H); }
    }
    // thrown shotgun
    if (t > 91 && t < 92.6) { const p = seg(t, 91, 92.6); c.save(); c.translate(lerp(900, 720, p), lerp(320, 420, p) - Math.sin(p * Math.PI) * 120); c.rotate(p * 12); rrect(c, -40, -5, 90, 10, 3, '#5b3a20', C.line, 2); c.restore(); }
    vignette(c, 0.35);
  } });

// 6. The diner (deaths 6, 7, 8)
function dinerBG(c, t) {
  fillAll(c, '#2b2f3a');
  c.fillStyle = '#d9d2c3'; c.fillRect(0, 0, W, 470);
  for (let y = 0; y < 470; y += 40) for (let x = (y / 40) % 2 ? 20 : 0; x < W; x += 40) c.fillStyle = (x / 40 + y / 40) % 2 ? '#d9d2c3' : '#cfc7b6', c.fillRect(x, y, 40, 40);
  for (let x = 0; x < W; x += 60) { c.fillStyle = (x / 60) % 2 ? '#e8e8e8' : '#2a2a2a'; c.fillRect(x, 470, 60, 60); c.fillRect(x + 30, 530, 30, 0); }
  c.fillStyle = vgrad(c, 470, H, '#3a3d48', '#202330'); c.fillRect(0, 530, W, H);
  rrect(c, 0, 330, 520, 140, 6, '#b8bcc6', C.line, 4);
  rrect(c, 60, 300, 120, 34, 6, '#555', C.line, 3);
  rrect(c, 720, 280, 260, 190, 10, '#9aa0ab', C.line, 4); text(c, 'FRYER', 850, 310, 22, '#333');
  c.save(); c.beginPath(); c.rect(740, 330, 220, 120); c.clip(); c.fillStyle = '#e6b437'; c.fillRect(740, 330, 220, 120);
  for (let i = 0; i < 12; i++) circle(c, 750 + hash(i) * 200, 340 + ((t * 40 + hash(i * 3) * 100) % 110), 5, 'rgba(255,240,170,0.8)');
  c.restore();
  rrect(c, 1040, 120, 180, 350, 8, '#c6ccd6', C.line, 4); line(c, [1050, 300, 1210, 300], 3, C.line);
  for (let i = 0; i < 3; i++) { rrect(c, 60 + i * 150, 120, 110, 70, 6, '#7a5a3a', C.line, 3); }
  circle(c, 640, 70, 30, '#fff8d0'); c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(640, 70, 10, 640, 70, 500); g.addColorStop(0, 'rgba(255,240,190,0.25)'); g.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
}
add({ name: 'diner', dur: 92, mood: 'sneaky', events: [[16, 'sniff'], [22, 'chirp'], [25, 'gasp'], [27.5, 'stab', { death: true }], [34, 'respawn'], [44, 'crunch'], [47, 'crunch'], [50, 'choke'], [54, 'thud', { death: true }], [60, 'respawn'], [72, 'slip'], [74, 'sizzle', { death: true }]],
  draw(c, t) {
    dinerBG(c, t);
    const knife = (cc) => { rrect(cc, -4, -8, 18, 16, 3, '#3a2a1a', C.line, 2); poly(cc, [14, -6, 70, 0, 14, 6], '#e6e9ee', C.line, 2); };
    // chef
    const chefTurn = t > 24;
    const chefX = t < 27 ? 300 : lerp(300, 330, seg(t, 27, 27.5));
    person(c, chefX, 600, 1.2, { type: 'chef', flip: !chefTurn ? true : false, scared: t > 24 && t < 27 ? 1 : 0, hold: knife, smile: t > 30 && t < 34 });
    // scene 1: sneak + stab
    if (t < 27.5) {
      const vx = lerp(1300, 520, ease(seg(t, 0, 14)));
      vorx(c, vx, 610, 1, { t, walk: t < 14 ? t * 4 : undefined, flip: true, crouch: 0.4, lookY: t > 14 && t < 22 ? -1 : 0, mouth: t > 16 && t < 22 ? 0.3 + 0.2 * Math.sin(t * 9) : 0.1, blink: (t % 2.5) < 0.1 });
    } else if (t < 34) {
      gooSplat(c, 500, 620, 1, 21); gooBurst(c, 500, 520, seg(t, 27.5, 29), 9);
    }
    // scene 2: steals the raw chicken, chokes
    if (t >= 34 && t < 54) {
      const lt = t - 34;
      if (lt < 2) respawnFx(c, 1100, 640, lt / 2);
      const vx = lerp(1100, 160, ease(seg(lt, 2, 9)));
      const chicken = (cc) => { ell(cc, 10, -10, 26, 18, 0.3, '#f3d7b0', C.line, 2); line(cc, [30, -20, 46, -34], 6, '#f3d7b0'); };
      vorx(c, vx, 640, 1, { t, walk: lt < 9 ? t * 4 : undefined, hold: lt > 9 && lt < 16 ? chicken : null, armUp: lt > 9 && lt < 16 ? 0.5 : 0, mouth: lt > 9 && lt < 16 ? 0.4 + 0.5 * Math.abs(Math.sin(lt * 5)) : (lt > 16 ? 1 : 0.1), rot: lt > 19 ? -ease(seg(lt, 19, 20)) * 1.4 : Math.sin(lt * 10) * (lt > 16 ? 0.08 : 0), lookY: lt > 16 ? -1 : 0 });
    }
    if (t >= 54 && t < 60) gooSplat(c, 160, 650, 0.6, 33);
    // scene 3: slips into the fryer
    if (t >= 60) {
      const lt = t - 60;
      if (lt < 2) respawnFx(c, 1100, 640, lt / 2);
      if (t < 74) {
        const vx = lerp(1100, 780, ease(seg(lt, 2, 10)));
        const slip = ease(seg(lt, 12, 14));
        vorx(c, vx + slip * 60, 640 - slip * 260, 1, { t, walk: lt < 10 ? t * 4 : undefined, rot: slip * 2.5, mouth: lt > 11 ? 1 : 0.1, armUp: slip, armUp2: slip });
      } else {
        smoke(c, 850, 330, t, 8, 5, '200,200,180');
        for (let i = 0; i < 20; i++) circle(c, 760 + hash(i) * 180, 330 - ((t * 120 + hash(i * 7) * 60) % 80), 4, '#fff6c0');
        if (lt > 16) { const arm = ease(seg(lt, 18, 21)); vorx; line(c, [860, 330, 860, 330 - 90 * arm], 10, C.line); line(c, [860, 330, 860, 330 - 90 * arm], 6, '#b8853b'); }
      }
      // grease puddle
      ell(c, 840, 660, 90, 14, 0, 'rgba(230,200,90,0.6)');
    }
    vignette(c, 0.4);
  } });

// 7. Power line (death 9)
add({ name: 'power', dur: 48, mood: 'curious', events: [[8, 'hum'], [27, 'zap', { death: true }], [34, 'sparks']],
  draw(c, t) {
    daySky(c, 500, 1); groundBand(c, 500, '#6f9a4f', '#4e7a3a');
    for (const px of [200, 640, 1080]) { rrect(c, px - 10, 120, 20, 400, 4, '#6b4a2b', C.line, 3); rrect(c, px - 80, 140, 160, 14, 3, '#6b4a2b', C.line, 3); }
    for (const yy of [148, 170]) { c.beginPath(); c.moveTo(-50, yy); c.quadraticCurveTo(420, yy + 50, 640, yy); c.quadraticCurveTo(860, yy + 50, 1330, yy); c.lineWidth = 3; c.strokeStyle = '#222'; c.stroke(); }
    const climb = ease(seg(t, 6, 22));
    const zap = t > 27 && t < 31;
    if (t < 27 || zap) {
      const vy = lerp(520, 300, climb);
      c.save(); if (zap) shake(c, 6, t);
      if (zap && Math.floor(t * 18) % 2) {
        c.save(); c.translate(660, vy); c.scale(1, 1);
        ell(c, 0, -120, 60, 110, 0, '#e6ff5a');
        for (let i = 0; i < 6; i++) line(c, [-30, -60 - i * 14, 30, -60 - i * 14], 4, '#222');
        circle(c, 4, -190, 30, '#222'); circle(c, -6, -192, 7, '#e6ff5a'); circle(c, 12, -192, 7, '#e6ff5a');
        c.restore();
      } else vorx(c, 660, vy, 0.9, { t, armUp: t > 22 ? 1 : 0.5 + 0.5 * Math.sin(t * 6), armUp2: 0.5 + 0.5 * Math.cos(t * 6), mouth: zap ? 1 : 0.1, lookY: -1, noShadow: climb > 0.05 });
      c.restore();
      if (zap) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const pts = [640, 160]; for (let k = 1; k < 8; k++) pts.push(640 + (hash(Math.floor(t * 20) + i * 9 + k) - 0.5) * 120, 160 + k * 24); line(c, pts, 4, 'rgba(220,255,140,0.9)'); } c.restore(); flash(c, Math.floor(t * 18) % 2 ? 0.35 : 0, '230,255,160'); }
    } else {
      smoke(c, 660, 280, t, 8, 2);
      gooSplat(c, 660, 560, 0.9, 44);
      ell(c, 660, 556, 30, 8, 0, '#1a1a1a');
    }
    vignette(c, 0.4);
  } });

// 8. MONTAGE: 14 ways (deaths 10 to 23)
const gags = [
  { name: 'piano', sfx: 'pianocrash' }, { name: 'mower', sfx: 'mower' }, { name: 'tower', sfx: 'thud' }, { name: 'vending', sfx: 'crash' },
  { name: 'lightning', sfx: 'thunder' }, { name: 'bees', sfx: 'bees' }, { name: 'sign', sfx: 'crash' }, { name: 'train', sfx: 'train' },
  { name: 'freezer', sfx: 'freeze' }, { name: 'fireworks', sfx: 'firework' }, { name: 'rake', sfx: 'bonk' }, { name: 'well', sfx: 'fall' },
  { name: 'cows', sfx: 'stampede' }, { name: 'balloon', sfx: 'pop' },
];
const GAG = 10.8;
add({ name: 'montage', dur: GAG * gags.length + 4, mood: 'montage',
  events: gags.flatMap((g, i) => [[i * GAG + 0.2, 'respawnsoft'], [i * GAG + 6.8, g.sfx, { death: true }]]).concat([[GAG * gags.length + 0.5, 'respawn']]),
  draw(c, t) {
    const i = Math.min(gags.length - 1, Math.floor(t / GAG)), lt = t - i * GAG, g = gags[i].name, hit = 6.8, after = lt - hit;
    const bgs = ['#f2c14e', '#7fc8a9', '#f28f6b', '#a78bfa', '#4a5a8a', '#f4d35e', '#ee964b', '#9ad1d4', '#bde0fe', '#20263f', '#a3c46b', '#c3a27a', '#86b06a', '#f6a6c1'];
    fillAll(c, bgs[i]);
    // comic panel stripes
    c.save(); c.globalAlpha = 0.12; for (let k = -10; k < 30; k++) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(k * 80 + lt * 30, 0); c.lineTo(k * 80 + 40 + lt * 30, 0); c.lineTo(k * 80 - 200 + lt * 30, H); c.lineTo(k * 80 - 240 + lt * 30, H); c.fill(); } c.restore();
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 560, W, H - 560);
    const alive = lt < hit;
    const vx = 640, vy = 600;
    const vopt = { t, mouth: lt > hit - 1.5 ? 1 : 0.15, lookY: 0, blink: (lt % 2.2) < 0.1, mut: 0.08 + i * 0.012 };
    if (lt < 1.2) respawnFx(c, vx, vy, lt / 1.2);
    const fall = (k) => lerp(-300, vy - 60, easeIn(k));
    if (g === 'piano') {
      vopt.lookY = lt > 4 ? -1 : 0;
      if (alive) { vorx(c, vx, vy, 0.95, vopt); const y = fall(seg(lt, 4.4, hit)); ell(c, vx, vy, 80 * seg(lt, 3, hit), 12, 0, 'rgba(0,0,0,0.3)'); rrect(c, vx - 130, y - 120, 260, 140, 10, '#1b1b1f', C.line, 4); for (let k = 0; k < 9; k++) rrect(c, vx - 120 + k * 27, y - 10, 24, 30, 2, '#fff', C.line, 1); }
      else { rrect(c, vx - 160, vy - 80, 320, 90, 10, '#1b1b1f', C.line, 4); for (let k = 0; k < 6; k++) { const p = seg(after, 0, 1.2); rrect(c, vx - 100 + k * 40 + p * (k - 3) * 60, vy - 100 - Math.sin(p * Math.PI) * 120 * hash(k), 18, 30, 2, '#fff', C.line, 1); } }
    } else if (g === 'mower') {
      const mx = lerp(-200, vx + 30, seg(lt, 2, hit)) + (after > 0 ? after * 300 : 0);
      if (alive) vorx(c, vx, vy, 0.95, { ...vopt, flip: lt > 3 });
      else { for (let k = 0; k < 30; k++) circle(c, vx + (hash(k) - 0.3) * 400 * seg(after, 0, 1), vy - 40 - hash(k * 3) * 200 * Math.sin(seg(after, 0, 1) * Math.PI), 6, k % 2 ? C.goo : '#5aa13a'); }
      c.save(); c.translate(mx, vy); rrect(c, -60, -50, 120, 50, 10, '#d73a3a', C.line, 4); circle(c, -40, 0, 16, '#222', C.line, 3); circle(c, 40, 0, 16, '#222', C.line, 3); line(c, [-50, -50, -120, -130], 6, C.line); c.restore();
    } else if (g === 'tower') {
      c.save(); const climb = seg(lt, 0, hit - 2); c.translate(0, climb * 260);
      rrect(c, vx - 140, vy - 520, 280, 160, 60, '#9db4c0', C.line, 5); text(c, 'DUNMORE', vx, vy - 440, 34, '#fff'); for (const lx of [-100, 100]) line(c, [vx + lx, vy - 360, vx + lx * 1.4, vy + 300], 10, '#6b7c86');
      if (alive) vorx(c, vx + 60, vy - 520 + (lt > hit - 2 ? easeIn(seg(lt, hit - 2, hit)) * 520 : 0), 0.8, { ...vopt, rot: lt > hit - 2 ? 1 : 0 });
      c.restore();
      if (!alive) { gooSplat(c, vx, vy + 10, 1.2, 70); gooBurst(c, vx, vy - 40, seg(after, 0, 1.2), 7); }
    } else if (g === 'vending') {
      const tip = ease(seg(lt, 3.5, hit));
      if (alive) vorx(c, vx + 40, vy, 0.95, { ...vopt, armUp: lt < 3.5 ? 0.6 + 0.4 * Math.sin(lt * 14) : 0.2 });
      c.save(); c.translate(vx - 80, vy); c.rotate(alive ? -tip * 1.45 + (lt < 3.5 ? Math.sin(lt * 14) * 0.03 : 0) : -1.57); rrect(c, -10, -300, 150, 300, 10, '#2f6fd6', C.line, 5); rrect(c, 10, -280, 90, 200, 6, '#bfe0ff', C.line, 3); for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) rrect(c, 18 + j * 28, -270 + k * 46, 22, 36, 3, ['#e63946', '#f4a261', '#2a9d8f'][j]); c.restore();
      if (!alive) gooBurst(c, vx + 40, vy - 40, seg(after, 0, 1.2), 12);
    } else if (g === 'lightning') {
      c.fillStyle = 'rgba(0,0,20,0.4)'; c.fillRect(0, 0, W, H);
      for (let k = 0; k < 5; k++) circle(c, 200 + k * 220, 80 + hash(k) * 30, 70, '#3b4260');
      const rod = (cc) => line(cc, [0, 0, 0, -90], 5, '#c0c4cc');
      if (alive) vorx(c, vx, vy, 0.95, { ...vopt, hold: rod, armUp: 1, lookY: -1 });
      else { c.save(); c.translate(vx, vy); ell(c, 0, -120, 50, 100, 0, '#111'); circle(c, -10, -190, 6, '#fff'); circle(c, 12, -190, 6, '#fff'); c.restore(); smoke(c, vx, vy - 200, lt, 6, 3); }
      if (after > 0 && after < 0.5) { c.save(); c.globalCompositeOperation = 'lighter'; const pts = [vx + 40, 0]; for (let k = 1; k < 10; k++) pts.push(vx + 40 + (hash(k * 7) - 0.5) * 80, k * 50); line(c, pts, 8, '#fff7a0'); c.restore(); flash(c, 0.6 - after); }
    } else if (g === 'bees') {
      rrect(c, 980, 200, 14, 380, 4, '#6b4a2b'); ell(c, 990, 240, 50, 60, 0, '#e0a72f', C.line, 4);
      const poke = (cc) => line(cc, [0, 0, 120, -80], 5, '#6b4a2b');
      if (alive) vorx(c, vx + 120, vy, 0.95, { ...vopt, hold: poke, armUp: 0.6 });
      const swarm = seg(lt, 3.5, hit);
      for (let k = 0; k < 40; k++) { const bx = lerp(990, vx + 140, swarm) + Math.sin(lt * 9 + k) * (30 + k * 2), by = lerp(240, vy - 120, swarm) + Math.cos(lt * 11 + k * 1.7) * (20 + k * 1.5); if (lt > 3.5) { ell(c, bx, by, 6, 4, 0, '#f2c94c', C.line, 1.5); } }
      if (!alive) { c.save(); c.translate(vx + 120, vy); c.scale(1, 1); ell(c, 0, -100, 70, 100, 0, '#e8a0a0', C.line, 4); for (let k = 0; k < 12; k++) circle(c, (hash(k) - 0.5) * 100, -40 - hash(k * 2) * 140, 8, '#d46a6a'); c.restore(); }
    } else if (g === 'sign') {
      c.save(); const sw = alive ? Math.sin(lt * 3) * 0.05 + (lt > 4.5 ? seg(lt, 4.5, hit) * 1.4 : 0) : 1.5;
      c.translate(vx - 200, 140); c.rotate(sw); rrect(c, 0, 0, 380, 120, 10, '#ffde59', C.line, 5); text(c, 'EAT AT JOES', 190, 60, 40, '#c1121f'); c.restore();
      line(c, [vx - 200, 100, vx + 180, 100], 4, C.line);
      if (alive) vorx(c, vx, vy, 0.95, { ...vopt, lookY: lt > 3 ? -1 : 0 });
      else { rrect(c, vx - 200, vy - 100, 380, 100, 10, '#ffde59', C.line, 5); gooBurst(c, vx, vy - 60, seg(after, 0, 1.2), 3); }
    } else if (g === 'train') {
      c.fillStyle = '#6b5b4a'; c.fillRect(0, vy - 10, W, 30); for (let x = 0; x < W; x += 50) rrect(c, x, vy - 14, 30, 38, 3, '#4a3a2a');
      if (alive) vorx(c, vx, vy - 10, 0.95, { ...vopt, mouth: 0.3, hold: (cc) => { circle(cc, 0, -10, 10, '#f25c8a', C.line, 2); line(cc, [0, 0, 0, 30], 3, '#2f7a3a'); } });
      const tx = lerp(W + 400, -1600, seg(lt, 4.8, hit + 2.5));
      c.save(); c.translate(tx, vy - 10); rrect(c, 0, -200, 260, 200, 20, '#2b2d42', C.line, 5); circle(c, 40, -100, 26, '#fff8b0', C.line, 3); rrect(c, 260, -170, 900, 170, 10, '#8d0801', C.line, 5); c.restore();
      if (!alive) gooBurst(c, vx, vy - 80, seg(after, 0, 1.3), 21, 1.4);
    } else if (g === 'freezer') {
      rrect(c, vx - 160, vy - 330, 320, 340, 12, '#e8f1f5', C.line, 5);
      const open = ease(seg(lt, 1, 2.5)) * (1 - ease(seg(lt, 4.5, 5)));
      if (alive || after > -1) {
        if (open > 0.05 || !alive) {
          rrect(c, vx - 140, vy - 310, 280, 300, 8, '#bfe4f5');
          vorx(c, vx, vy - 20, 0.8, { ...vopt, noShadow: true, mouth: 0.1, lookX: -1 });
          if (!alive || lt > 5) { c.fillStyle = 'rgba(190,230,255,0.55)'; c.fillRect(vx - 140, vy - 310, 280, 300); for (let k = 0; k < 10; k++) line(c, [vx - 120 + k * 26, vy - 300, vx - 140 + k * 26, vy - 20], 2, 'rgba(255,255,255,0.6)'); }
        }
        if (lt < 1 || (lt > 5 && alive)) rrect(c, vx - 160, vy - 330, 320, 340, 12, '#dfe9ee', C.line, 5);
        if (!alive) { rrect(c, vx - 160, vy - 330, 320, 340, 12, 'rgba(0,0,0,0)', C.line, 5); }
      }
      if (lt < 1 || (lt > 1 && lt < 2.5)) vorx(c, vx + 220, vy, 0.95, { ...vopt, armUp: 0.6 });
    } else if (g === 'fireworks') {
      stars(c, 80, 9, 1, lt);
      const rocket = (cc) => { rrect(cc, -8, -60, 16, 60, 4, '#e63946', C.line, 2); poly(cc, [-8, -60, 0, -80, 8, -60], '#fff', C.line, 2); };
      const up = easeIn(seg(lt, 3.5, hit)) * 520;
      if (alive) vorx(c, vx, vy - up, 0.9, { ...vopt, hold: rocket, armUp: 1, noShadow: true, mouth: lt > 3.5 ? 1 : 0.2 });
      if (lt > 3.5 && alive) for (let k = 0; k < 10; k++) circle(c, vx + 50 + (hash(k) - 0.5) * 20, vy - up + 20 + k * 14, 10 - k * 0.8, `rgba(255,${180 + k * 6},80,${1 - k * 0.09})`);
      if (!alive) { c.save(); c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 40; k++) { const a = k / 40 * TAU, d = easeOut(seg(after, 0, 1.4)) * 260; circle(c, vx + Math.cos(a) * d, 100 + Math.sin(a) * d, 6, ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'][k % 5]); } c.restore(); text(c, 'BYE', vx, 100, 60 * seg(after, 0.6, 1.4), C.goo, { stroke: 6 }); }
    } else if (g === 'rake') {
      if (alive) vorx(c, lerp(200, vx, seg(lt, 0, hit - 0.4)), vy, 0.95, { ...vopt, walk: lt * 5 });
      const up = alive ? 0 : clamp(after * 6);
      c.save(); c.translate(vx + 40, vy); c.rotate(-up * 1.45); line(c, [0, 0, -220, 0], 8, '#8a5a2b'); rrect(c, -240, -16, 26, 32, 3, '#777', C.line, 3); c.restore();
      if (!alive) { vorx(c, vx, vy, 0.95, { ...vopt, rot: -clamp(after * 2) * 1.5, mouth: 1 }); for (let k = 0; k < 5; k++) { const a = lt * 4 + k * 1.25; text(c, '★', vx - 60 + Math.cos(a) * 50, vy - 300 + Math.sin(a) * 16, 28, '#ffe14d'); } }
    } else if (g === 'well') {
      rrect(c, vx - 110, vy - 120, 220, 120, 10, '#8a8a8a', C.line, 5); ell(c, vx, vy - 120, 110, 20, 0, '#111', C.line, 4); line(c, [vx - 100, vy - 120, vx - 100, vy - 260, vx + 100, vy - 260, vx + 100, vy - 120], 8, '#6b4a2b');
      if (alive) { const d = easeIn(seg(lt, 4.5, hit)) * 300; c.save(); if (d > 0) { c.beginPath(); c.rect(0, 0, W, vy - 120); c.clip(); } vorx(c, vx + (lt < 4 ? 160 - lt * 40 : 0), vy - 120 + d, 0.8, { ...vopt, lookY: lt > 3 ? 1 : 0, rot: d > 0 ? 3 : 0 }); c.restore(); }
      else { text(c, '...splat', vx, vy - 200 - after * 30, 40, '#fff', { stroke: 6 }); }
    } else if (g === 'cows') {
      if (alive) vorx(c, vx, vy, 0.95, { ...vopt, flip: true, lookX: 1 });
      for (let k = 0; k < 6; k++) {
        const cx = lerp(-300 - k * 160, W + 600, seg(lt, 3 + k * 0.15, hit + 2.5 + k * 0.15)), cy = vy - 20 + (k % 3) * 20 + Math.abs(Math.sin(lt * 10 + k)) * -12;
        c.save(); c.translate(cx, cy); ell(c, 0, -60, 90, 50, 0, '#fff', C.line, 4); circle(c, -20, -70, 16, '#222'); circle(c, 30, -50, 12, '#222'); ell(c, 95, -80, 34, 28, 0, '#fff', C.line, 4); ell(c, 115, -70, 16, 12, 0, '#f4a3b5', C.line, 2); for (const lx of [-60, -30, 30, 60]) line(c, [lx, -20, lx + Math.sin(lt * 14 + lx) * 10, 0], 9, C.line); c.restore();
      }
      if (!alive) gooSplat(c, vx, vy + 6, 1.4, 90, 1.2);
    } else if (g === 'balloon') {
      const lift = easeIn(seg(lt, 2.5, hit)) * 640;
      const bal = (cc) => { line(cc, [0, 0, 0, -120], 2, '#555'); ell(cc, 0, -170, 40, 50, 0, '#ff4d6d', C.line, 3); circle(cc, -12, -186, 10, 'rgba(255,255,255,0.5)'); };
      if (alive) vorx(c, vx, vy - lift, 0.9, { ...vopt, hold: bal, armUp: 1, noShadow: true, mouth: lt > 4 ? 1 : 0.3 });
      for (let k = 0; k < 3; k++) { const bx = 200 + k * 420 + Math.sin(lt + k) * 30; c.save(); c.translate(bx, 160 + Math.sin(lt * 2 + k) * 10); line(c, [-20, 0, 20, 0], 4, '#333'); line(c, [-20, 0, -40, -10], 3, '#333'); line(c, [20, 0, 40, -10], 3, '#333'); c.restore(); }
      if (!alive) { text(c, 'POP', vx, 120, 70 * clamp(after * 4), '#fff', { stroke: 8, strokeCol: '#ff4d6d' }); gooSplat(c, vx, vy + 6, 0.9, 99); }
    }
    if (!alive && after < 0.3) flash(c, 0.4 - after);
    // panel label
    text(c, `#${i + 10}`, 70, 680, 44, 'rgba(0,0,0,0.35)', { weight: 900 });
    // white panel border
    c.lineWidth = 16; c.strokeStyle = '#fff'; c.strokeRect(8, 8, W - 16, H - 16);
    if (t > GAG * gags.length) { fillAll(c, '#000'); }
  } });

// 9. News report
add({ name: 'news', dur: 50, mood: 'news', events: [[0.5, 'newsjingle'], [30, 'static']],
  draw(c, t) {
    fillAll(c, '#2a2420');
    // living room wall + tv
    c.fillStyle = '#6e5b4b'; c.fillRect(0, 0, W, 520); for (let x = 0; x < W; x += 70) line(c, [x, 0, x, 520], 3, 'rgba(0,0,0,0.12)');
    rrect(c, 260, 70, 760, 450, 22, '#1d1d22', C.line, 6);
    c.save(); c.beginPath(); c.roundRect(290, 100, 700, 390, 10); c.clip();
    fillAll(c, '#173b7a');
    rrect(c, 290, 100, 700, 390, 0, vgrad(c, 100, 490, '#1f4fa8', '#102a5a'));
    person(c, 470, 520, 1.25, { type: 'anchor', smile: false, noShadow: true });
    rrect(c, 300, 400, 680, 50, 0, '#c8102e'); text(c, 'BREAKING', 360, 425, 22, '#fff', { weight: 900 });
    rrect(c, 420, 400, 560, 50, 0, '#fff'); text(c, 'CREATURE SEEN DYING ALL OVER DUNMORE', 700, 425, 20, '#111', { weight: 800 });
    rrect(c, 300, 450, 680, 30, 0, '#111');
    c.save(); c.beginPath(); c.rect(300, 450, 680, 30); c.clip(); text(c, 'FARMER SAYS "IT KEPT COMING BACK"   •   DINER CLOSED UNTIL FURTHER NOTICE   •   BIG JIM TRUCKING ISSUES STATEMENT   •   ', 1000 - (t * 90) % 1400, 465, 16, '#ffd23f', { align: 'left', weight: 700 }); c.restore();
    // footage window
    rrect(c, 640, 140, 320, 220, 6, '#000', '#fff', 4);
    const clip = Math.floor(t / 6) % 4;
    c.save(); c.beginPath(); c.rect(644, 144, 312, 212); c.clip(); c.translate(640, 140); c.scale(0.25, 0.3);
    if (clip === 0) { daySky(c, 430, 1); c.fillStyle = C.road; c.fillRect(0, 560, W, 110); gooSplat(c, 640, 640, 1.3, 11); }
    if (clip === 1) { fillAll(c, '#1d4f7a'); bubbles(c, 640, 600, t, 10, 7); }
    if (clip === 2) { farmBG(c, t); gooSplat(c, 640, 572, 1.1, 7); }
    if (clip === 3) { fillAll(c, '#bde0fe'); vorx(c, 640, 600, 1, { t, mouth: 1 }); }
    c.restore();
    text(c, 'LIVE', 690, 160, 16, '#fff', { weight: 900 }); circle(c, 662, 160, 6, Math.floor(t * 2) % 2 ? '#ff3b3b' : '#7a1010');
    if (t > 30 && t < 31.2) { for (let k = 0; k < 400; k++) c.fillStyle = `rgba(255,255,255,${hash(k + t * 50)})`, c.fillRect(290 + hash(k * 3 + t) * 700, 100 + hash(k * 7 + t) * 390, 8, 3); }
    c.restore();
    // couch + family silhouettes
    rrect(c, 140, 560, 1000, 160, 40, '#7a2e2e', C.line, 5);
    for (let k = 0; k < 3; k++) { circle(c, 400 + k * 240, 560, 46, '#1a1414'); rrect(c, 360 + k * 240, 590, 80, 120, 20, '#1a1414'); }
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(80,120,255,0.08)'; c.fillRect(0, 0, W, H); c.restore();
    vignette(c, 0.6);
  } });

// 10. The army (deaths 24 to 60)
const armyDeaths = [];
for (let k = 0; k < 37; k++) armyDeaths.push(26 + k * (k < 6 ? 6 : k < 20 ? 2.6 : 1.2));
add({ name: 'army', dur: 136, mood: 'tense', events: [[2, 'trucks'], [16, 'radio'], [22, 'respawn']].concat(armyDeaths.map((x, k) => [x, k % 9 === 8 ? 'tank' : 'gunburst', { death: true }])).concat(armyDeaths.map((x) => [x + 0.5, 'respawnsoft'])).concat([[128, 'yawn']]),
  draw(c, t) {
    nightField(c, t, 430);
    // searchlights
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { const a = Math.sin(t * 0.4 + k * 2) * 0.4 - Math.PI / 2; c.fillStyle = 'rgba(255,255,220,0.07)'; c.beginPath(); c.moveTo(200 + k * 440, 470); c.lineTo(200 + k * 440 + Math.cos(a - 0.08) * 900, 470 + Math.sin(a - 0.08) * 900); c.lineTo(200 + k * 440 + Math.cos(a + 0.08) * 900, 470 + Math.sin(a + 0.08) * 900); c.fill(); }
    c.restore();
    const trucksIn = ease(seg(t, 0, 14));
    for (let k = 0; k < 2; k++) { c.save(); c.translate(lerp(-500, 120 + k * 760, trucksIn) + (k ? lerp(1700, 0, trucksIn) - lerp(-500, 0, trucksIn) : 0), 470); rrect(c, 0, -120, 360, 120, 10, '#4f6136', C.line, 5); rrect(c, 260, -160, 100, 70, 8, '#4f6136', C.line, 4); circle(c, 60, 0, 30, '#222', C.line, 3); circle(c, 300, 0, 30, '#222', C.line, 3); c.restore(); }
    crater(c, 640, 600, 1.2, 0.9, t);
    // tank arrives
    const tankIn = ease(seg(t, 60, 72));
    c.save(); c.translate(lerp(1600, 1040, tankIn), 520); rrect(c, -140, -70, 280, 70, 20, '#5a6b3c', C.line, 5); rrect(c, -80, -120, 140, 56, 16, '#5a6b3c', C.line, 4); rrect(c, -330, -104, 260, 18, 6, '#4a5a30', C.line, 3); for (let k = 0; k < 5; k++) circle(c, -110 + k * 55, 0, 18, '#333', C.line, 3); c.restore();
    // soldiers in a ring
    const fire = armyDeaths.some((x) => t >= x - 0.6 && t < x + 0.1);
    const tired = seg(t, 70, 130);
    const ring = [[180, 610, false], [340, 690, false], [940, 690, true], [1100, 610, true], [260, 520, false], [1020, 520, true]];
    ring.forEach(([x, y, fl], k) => {
      const asleep = t > 110 && k === 4;
      const gun = (cc) => { rrect(cc, -10, -6, 80, 11, 3, '#2a2f22', C.line, 2); };
      if (asleep) { person(c, x, y, 0.85, { type: 'soldier', flip: fl, rot: fl ? 1.4 : -1.4 }); text(c, 'z', x + 20, y - 160 - (t * 20) % 40, 26, '#fff'); }
      else person(c, x, y, 0.85, { type: 'soldier', flip: fl, aim: t > 22, hold: gun, sweat: tired > 0.3, scared: t > 22 && t < 30 ? 1 : 0 });
      if (fire && !asleep && Math.floor(t * 30 + k) % 2) muzzle(c, x + (fl ? -90 : 90), y - 140, 1, fl ? -0.8 : 0.8);
    });
    // the alien: popping up and dying again and again
    const last = armyDeaths.filter((x) => t >= x).pop() || -99;
    const next = armyDeaths.find((x) => x > t) || 999;
    const mut = 0.12 + seg(t, 22, 136) * 0.18;
    if (t > 22) {
      if (t - last < 0.5) { gooBurst(c, 640, 520, seg(t - last, 0, 0.5), Math.floor(last)); flash(c, 0.25 - (t - last) * 0.5, '255,230,160'); }
      else { const sinceSpawn = t - Math.max(22, last + 0.5); if (sinceSpawn < 0.6) respawnFx(c, 640, 600, sinceSpawn / 0.6); vorx(c, 640, 600, 1.0, { t, mut, mouth: next - t < 1 ? 0.9 : 0.15, lookX: Math.sin(t * 3), blink: (t % 2) < 0.1, armUp: t > 120 ? 0.7 : 0, tilt: t > 110 ? Math.sin(t * 2) * 0.2 : 0 }); }
    }
    if (t > 72 && armyDeaths.some((x, k) => k % 9 === 8 && t >= x && t < x + 0.3)) flash(c, 0.5, '255,200,120');
    gooSplat(c, 560, 640, 0.6, 3, clamp((t - 30) / 60)); gooSplat(c, 740, 650, 0.6, 8, clamp((t - 60) / 60)); gooSplat(c, 640, 680, 0.8, 13, clamp((t - 90) / 40));
    vignette(c, 0.6);
  } });

// 11. Capture -> transport to the lab
add({ name: 'capture', dur: 56, mood: 'creepy', events: [[4, 'helicopter'], [16, 'clank'], [30, 'steam'], [44, 'doors']],
  draw(c, t) {
    if (t < 28) {
      nightField(c, t, 430);
      crater(c, 640, 600, 1.2, 0.8, t);
      const down = ease(seg(t, 6, 16));
      vorx(c, 640, 600, 1, { t, mut: 0.3, lookY: -1, mouth: 0.4, blink: (t % 2.4) < 0.1 });
      // glass tube lowered by a helicopter
      c.save(); c.translate(640, lerp(-500, 0, down));
      line(c, [0, -600, 0, 330], 4, '#444');
      rrect(c, -110, 330, 220, 280, 30, 'rgba(180,230,255,0.25)', '#d9f2ff', 5); rrect(c, -120, 318, 240, 26, 8, '#8a939e', C.line, 4);
      c.restore();
      const hy = -60 + Math.sin(t * 2) * 6;
      c.save(); c.translate(640, hy + lerp(-200, 0, ease(seg(t, 0, 5)))); ell(c, 0, 60, 140, 50, 0, '#2b2d36', C.line, 5); line(c, [-260 + Math.sin(t * 40) * 40, 0, 260 - Math.sin(t * 40) * 40, 0], 6, '#555'); c.restore();
      if (t > 16 && t < 17) shake(c, 8, t);
      if (t > 22) { c.fillStyle = `rgba(0,0,0,${ease(seg(t, 24, 28))})`; c.fillRect(0, 0, W, H); }
    } else {
      // lab hallway, the tube rolls in
      fillAll(c, vgrad(c, 0, H, '#dfe6ec', '#9aa7b3'));
      for (let k = 0; k < 6; k++) { rrect(c, 80 + k * 220, 40, 120, 16, 4, '#ffffff'); }
      c.fillStyle = '#7d8a96'; c.fillRect(0, 560, W, 160);
      for (let x = 0; x < W; x += 160) line(c, [x, 560, x - 80, H], 2, 'rgba(0,0,0,0.15)');
      rrect(c, 1000, 180, 220, 380, 6, '#5b6b7a', C.line, 5); text(c, 'LAB 7', 1110, 230, 30, '#fff');
      const slide = ease(seg(t, 44, 50)); rrect(c, 1010 - slide * 100, 260, 100, 300, 2, '#4a5866'); rrect(c, 1110 + slide * 100, 260, 100, 300, 2, '#4a5866');
      const x = lerp(-200, 900, ease(seg(t, 30, 52)));
      c.save(); c.translate(x, 0);
      rrect(c, -130, 600, 260, 30, 8, '#8a939e', C.line, 4); circle(c, -90, 640, 14, '#333'); circle(c, 90, 640, 14, '#333');
      vorx(c, 0, 600, 0.95, { t, mut: 0.3, noShadow: true, lookX: 1, mouth: 0.1, blink: (t % 2.6) < 0.1 });
      rrect(c, -110, 300, 220, 300, 30, 'rgba(180,230,255,0.25)', '#d9f2ff', 5);
      c.restore();
      person(c, x - 260 + 900 * 0, 600, 1.05, { type: 'scientist', walk: t * 5, flip: false });
      person(c, lerp(-450, 650, ease(seg(t, 30, 52))), 600, 1.05, { type: 'scientist', walk: t * 5 });
      c.fillStyle = `rgba(0,0,0,${1 - ease(seg(t, 28, 31))})`; c.fillRect(0, 0, W, H);
    }
    vignette(c, 0.45);
  } });

// 12. The lab tests (deaths 61 to 98)
const labTests = ['freeze', 'laser', 'acid', 'crusher', 'spin', 'vacuum', 'heat', 'sound'];
const labDeaths = [];
for (let k = 0; k < 38; k++) labDeaths.push(14 + k * (k < 8 ? 9 : 2.55));
add({ name: 'lab', dur: 176, mood: 'lab', events: [[2, 'beep']].concat(labDeaths.map((x, k) => [x, ['freeze', 'laser', 'acid', 'crush', 'spin', 'vacuum', 'fire', 'screech'][k % 8], { death: true }])).concat(labDeaths.map((x) => [x + 1.2, 'respawnsoft'])).concat([[150, 'alarmsoft'], [160, 'beep']]),
  draw(c, t) {
    fillAll(c, vgrad(c, 0, H, '#1d2733', '#0e141b'));
    // monitors
    for (let k = 0; k < 4; k++) {
      const mx = 60 + k * 300;
      rrect(c, mx, 40, 260, 160, 8, '#0a1014', '#3d4b59', 4);
      if (k === 3) {
        // the crater signal: gets bigger with every death
        const n = labDeaths.filter((x) => t >= x).length + 60;
        text(c, 'CRATER SIGNAL', mx + 130, 62, 14, '#7cff3a', { weight: 800 });
        c.beginPath(); for (let x = 0; x < 240; x += 3) { const amp = 6 + n * 0.55; c.lineTo(mx + 10 + x, 130 + Math.sin(x * 0.09 + t * 4) * amp * (0.5 + 0.5 * Math.sin(x * 0.02 + t))); } c.lineWidth = 2.5; c.strokeStyle = n > 90 ? '#ff4d4d' : C.goo; c.stroke();
      } else {
        for (let i = 0; i < 6; i++) rrect(c, mx + 14, 60 + i * 20, 40 + hash(i + k * 10 + Math.floor(t)) * 190, 10, 3, k === 1 ? '#3aa0ff' : '#5ad1a0');
      }
    }
    // the chamber
    rrect(c, 420, 230, 440, 380, 30, 'rgba(160,220,255,0.12)', '#9fd3ff', 6);
    rrect(c, 400, 590, 480, 40, 10, '#4a5866', C.line, 4); rrect(c, 400, 210, 480, 40, 10, '#4a5866', C.line, 4);
    const last = labDeaths.filter((x) => t >= x).pop() ?? -99;
    const k = labDeaths.indexOf(last);
    const test = labTests[(k < 0 ? 0 : k) % 8];
    const next = labDeaths.find((x) => x > t) ?? 999;
    const mut = 0.3 + seg(t, 0, 176) * 0.65;
    const dying = t - last < 1.2;
    if (!dying) {
      const since = t - Math.max(0, last + 1.2);
      if (last > 0 && since < 0.6) respawnFx(c, 640, 590, since / 0.6, 0.8);
      vorx(c, 640, 590, 0.95, { t, mut, mouth: next - t < 1 ? 1 : 0.15, lookX: Math.sin(t * 1.3) * 0.6, blink: (t % 3) < 0.1, armUp: t > 150 ? 0.4 : 0 });
    } else {
      const d = (t - last) / 1.2;
      if (test === 'freeze') { vorx(c, 640, 590, 0.95, { t, mut, mouth: 1 }); c.fillStyle = 'rgba(200,240,255,0.6)'; c.fillRect(424, 234, 432, 372); }
      if (test === 'laser') { vorx(c, 640, 590, 0.95, { t, mut, mouth: 1, alpha: 1 - d }); line(c, [420, 400, 860, 400 + Math.sin(d * 9) * 60], 8, '#ff2d55'); }
      if (test === 'acid') { c.fillStyle = 'rgba(160,255,80,0.55)'; c.fillRect(424, 606 - d * 370, 432, d * 370); vorx(c, 640, 590, 0.95, { t, mut, mouth: 1, alpha: 1 - d * 0.8 }); }
      if (test === 'crusher') { rrect(c, 424, 234, 432, 340 * d, 4, '#5c6773', C.line, 4); }
      if (test === 'spin') { c.save(); c.translate(640, 480); c.rotate(d * 30); vorx(c, 0, 110, 0.95, { t, mut, mouth: 1, noShadow: true }); c.restore(); }
      if (test === 'vacuum') { vorx(c, 640, 590, 0.95 + d * 0.6, { t, mut, mouth: 1 }); }
      if (test === 'heat') { vorx(c, 640, 590, 0.95, { t, mut, mouth: 1, alpha: 1 - d }); smoke(c, 640, 560, t, 8, 4, '200,80,40'); c.fillStyle = 'rgba(255,90,30,0.3)'; c.fillRect(424, 234, 432, 372); }
      if (test === 'sound') { vorx(c, 640, 590, 0.95, { t, mut, mouth: 1, rot: Math.sin(t * 60) * 0.1 }); for (let r = 0; r < 4; r++) ell(c, 640, 420, 60 + r * 60 + d * 80, 40 + r * 40, 0, null, 'rgba(255,255,255,0.5)', 4); }
      if (d > 0.6) gooBurst(c, 640, 470, (d - 0.6) / 0.4, k, 0.8);
    }
    // scientists with clipboards
    const clip = (cc) => { rrect(cc, -4, -18, 30, 38, 3, '#c9a578', C.line, 2); rrect(cc, 0, -12, 22, 28, 2, '#fff'); };
    person(c, 220, 640, 1.1, { type: 'scientist', hold: clip, smile: t < 60, scared: t > 150 ? 0.6 : 0, sweat: t > 120 });
    person(c, 1060, 640, 1.1, { type: 'scientist', flip: true, hold: clip, scared: t > 160 ? 1 : 0 });
    // the chart on the wall
    const n = labDeaths.filter((x) => t >= x).length + 60;
    rrect(c, 960, 260, 220, 140, 6, '#f4f1e8', C.line, 3);
    c.beginPath(); for (let i = 0; i <= 20; i++) c.lineTo(980 + i * 9, 380 - Math.min(110, (n - 60) * 3 * (i / 20))); c.lineWidth = 3; c.strokeStyle = '#c1121f'; c.stroke();
    text(c, 'MUTATION', 1070, 278, 14, '#333');
    if (t > 150) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,40,40,${0.12 + 0.08 * Math.sin(t * 6)})`; c.fillRect(0, 0, W, H); c.restore(); }
    vignette(c, 0.55);
  } });

// 13. Night in the lab: he writes on the glass
add({ name: 'night', dur: 58, mood: 'quiet', events: [[10, 'squeak'], [14, 'squeak'], [19, 'squeak'], [24, 'squeak'], [40, 'heartbeat'], [50, 'chirp2']],
  draw(c, t) {
    fillAll(c, vgrad(c, 0, H, '#0b1016', '#05080b'));
    rrect(c, 360, 120, 560, 500, 30, 'rgba(120,200,255,0.06)', 'rgba(140,210,255,0.6)', 5);
    c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(640, 300, 10, 640, 300, 420); g.addColorStop(0, 'rgba(124,255,58,0.18)'); g.addColorStop(1, 'rgba(124,255,58,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    const close = ease(seg(t, 0, 20));
    vorx(c, 640, 640 - close * 60, 1.4 + close * 0.6, { t, mut: 0.95, armUp: t > 8 && t < 30 ? 0.9 : 0, mouth: 0.1, blink: (t % 5) < 0.1, lookY: t > 34 ? 0 : 0, tilt: Math.sin(t * 0.5) * 0.05 });
    // fogged writing: "100"
    const wr = seg(t, 10, 28);
    c.save(); c.globalAlpha = 0.85; c.lineWidth = 12; c.strokeStyle = 'rgba(200,255,190,0.7)'; c.lineCap = 'round';
    const strokes = [[470, 200, 470, 320], [530, 200, 600, 200, 600, 320, 530, 320, 530, 200], [650, 200, 720, 200, 720, 320, 650, 320, 650, 200]];
    strokes.forEach((s, k) => { const kk = clamp(wr * 3 - k); if (kk <= 0) return; c.beginPath(); c.moveTo(s[0], s[1]); const n = s.length / 2 - 1; const upto = kk * n; for (let i = 1; i <= Math.ceil(upto); i++) { const f = Math.min(1, upto - (i - 1)); c.lineTo(lerp(s[i * 2 - 2], s[i * 2], f), lerp(s[i * 2 - 1], s[i * 2 + 1], f)); } c.stroke(); });
    c.restore();
    // a scientist peeks through the door
    if (t > 34) { c.save(); c.globalAlpha = ease(seg(t, 34, 38)); rrect(c, 60, 200, 160, 420, 4, '#1a2028', '#3d4b59', 4); person(c, 140, 600, 1.05, { type: 'scientist', scared: 1, noShadow: true }); c.restore(); }
    vignette(c, 0.8);
  } });

// 14. The big one: death 99 + 100. Then nothing.
add({ name: 'final', dur: 74, mood: 'build', events: [[2, 'alarm'], [12, 'powerup'], [26, 'bigboom', { death: true }], [33, 'respawn'], [40, 'powerup'], [48, 'bigboom', { death: true }], [49, 'silence'], [57, 'cheer'], [60, 'party']],
  draw(c, t) {
    fillAll(c, vgrad(c, 0, H, '#1a1f2a', '#0a0d12'));
    // giant machine
    rrect(c, 300, 60, 680, 120, 20, '#3d4652', C.line, 6); text(c, 'OMEGA CHAMBER', 640, 120, 40, '#ff4d4d', { weight: 900 });
    rrect(c, 380, 200, 520, 420, 30, 'rgba(255,80,80,0.08)', '#ff8080', 6);
    const charge1 = seg(t, 12, 26), charge2 = seg(t, 40, 48);
    for (let k = 0; k < 8; k++) { const on = (k / 8 < (t < 33 ? charge1 : charge2)); rrect(c, 330 + k * 80, 640, 60, 24, 5, on ? '#ff3b3b' : '#3b1a1a', C.line, 2); }
    const general = (x) => person(c, x, 660, 1.1, { type: 'general', flip: true, aim: false, smile: t > 52 });
    general(1100);
    person(c, 180, 660, 1.1, { type: 'scientist', scared: t > 20 && t < 50 ? 1 : 0, armsUp: t > 57, smile: t > 57 });
    if (t > 52) person(c, 320, 660, 1.05, { type: 'scientist', armsUp: Math.sin(t * 6) > 0, smile: true });
    const alive1 = t < 26 || (t > 33 && t < 48);
    if (alive1) {
      if (t > 33 && t < 34.5) respawnFx(c, 640, 600, (t - 33) / 1.5, 0.9);
      vorx(c, 640, 600, 1.05, { t, mut: 1, mouth: (t > 22 && t < 26) || (t > 46) ? 0.9 : 0.15, lookX: Math.sin(t) * 0.5, blink: (t % 3) < 0.1, tilt: (t > 40 ? 0.15 : 0) });
      if ((t > 12 && t < 26) || (t > 40 && t < 48)) { c.save(); c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 6; k++) { const pts = [640 + (k - 3) * 60, 200]; for (let j = 1; j < 6; j++) pts.push(640 + (hash(k * 9 + j + Math.floor(t * 12)) - 0.5) * 300, 200 + j * 70); line(c, pts, 3, 'rgba(255,120,120,0.8)'); } c.restore(); }
    }
    if ((t >= 26 && t < 30) || (t >= 48 && t < 51)) {
      const d = t >= 48 ? t - 48 : t - 26;
      c.save(); c.globalCompositeOperation = 'lighter'; circle(c, 640, 420, 40 + d * 600, `rgba(255,${200 - d * 40},150,${1 - d / 3})`); c.restore();
      shake(c, (1 - d / 3) * 20, t); flash(c, 1 - d, '255,240,220');
    }
    // after 100: empty chamber, a little dust
    if (t > 51) { for (let k = 0; k < 30; k++) circle(c, 520 + hash(k) * 240, 600 - ((t - 51) * 10 * hash(k * 3)) % 300, 2, 'rgba(200,200,200,0.6)'); }
    // confetti party
    if (t > 57) { for (let k = 0; k < 120; k++) { const x = hash(k) * W + Math.sin(t * 2 + k) * 20, y = ((t - 57) * (120 + hash(k * 7) * 140) + hash(k * 3) * 300) % (H + 40) - 40; rrect(c, x, y, 10, 6, 1, ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'][k % 5]); } }
    if (t > 51 && t < 57) { fillAll(c, `rgba(0,0,0,${0.3})`); }
    vignette(c, 0.6);
  } });

// 15. The twist: one hundred craters
add({ name: 'twist', dur: 98, mood: 'ending', events: [[3, 'rumble'], [14, 'hum'], [30, 'boom'], [44, 'respawn'], [52, 'respawnchorus'], [72, 'heartbeat'], [86, 'chirp2'], [92, 'sting']],
  draw(c, t) {
    if (t < 30) {
      // back at the field: the crater wakes up, cracks spread
      nightField(c, t, 430);
      const g = seg(t, 2, 28);
      crater(c, 640, 600, 1.2, 0.3 + g * 1.5, t);
      shake(c, g * 4, t);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 12; k++) {
        const a = Math.PI + (k / 11) * Math.PI * 1 + 0.1, len = g * (200 + hash(k) * 500);
        const pts = [640, 600]; for (let j = 1; j <= 6; j++) pts.push(640 + Math.cos(a) * len * j / 6 * 1.6 + (hash(k + j) - 0.5) * 30, 600 + Math.sin(a) * len * j / 6 * -0.25 + j * 4);
        line(c, pts, 4, `rgba(124,255,58,${0.6 * g})`);
      }
      c.restore();
      flash(c, (t - 28) / 2, '124,255,58');
    } else if (t < 58) {
      // the whole world: green dots light up one by one
      const lt = t - 30;
      fillAll(c, '#03060c');
      stars(c, 200, 5, 0.7, t);
      const zoom = 1 + ease(seg(lt, 0, 28)) * 0.2;
      c.save(); c.translate(W / 2, H / 2 + 40); c.scale(zoom, zoom);
      circle(c, 0, 0, 300, '#0e2a4a', '#3a7bd5', 6);
      // simple continents
      c.fillStyle = '#1f5a3a';
      for (const [x, y, rx, ry] of [[-120, -80, 90, 60], [-60, 60, 60, 100], [100, -60, 120, 70], [140, 90, 70, 60], [20, 200, 80, 30]]) { c.beginPath(); c.ellipse(x, y, rx, ry, 0.4, 0, TAU); c.fill(); }
      const n = Math.floor(ease(seg(lt, 6, 24)) * 100);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < n; k++) { const a = hash(k * 13) * TAU, r = Math.sqrt(hash(k * 7)) * 270; circle(c, Math.cos(a) * r, Math.sin(a) * r * 0.95, 6 + 3 * Math.sin(t * 5 + k), C.goo); circle(c, Math.cos(a) * r, Math.sin(a) * r * 0.95, 16, 'rgba(124,255,58,0.2)'); }
      c.restore();
      c.restore();
      text(c, n + ' / 100', W / 2, 670, 34, C.goo, { weight: 900, spacing: 4 });
    } else if (t < 80) {
      // they all climb out, a row of them
      const lt = t - 58;
      nightField(c, t, 430);
      for (let k = 0; k < 9; k++) {
        const x = 80 + k * 140, d = 0.55 + (k % 3) * 0.12, y = 520 + (k % 3) * 60;
        crater(c, x, y, d * 0.7, 1, t + k);
        const up = ease(seg(lt, 2 + k * 0.6, 6 + k * 0.6));
        c.save(); c.beginPath(); c.rect(0, 0, W, y); c.clip();
        vorx(c, x, y + (1 - up) * 240 * d, d, { t: t + k, mut: (k * 0.11) % 1, mouth: 0.1, blink: ((t + k) % 3) < 0.1, lookX: Math.sin(t + k) });
        c.restore();
      }
      vignette(c, 0.7);
    } else {
      // the lab: dust gathers back together. One eye opens.
      const lt = t - 80;
      fillAll(c, vgrad(c, 0, H, '#0b1016', '#05080b'));
      rrect(c, 380, 200, 520, 420, 30, 'rgba(255,80,80,0.05)', 'rgba(255,128,128,0.5)', 6);
      const gather = ease(seg(lt, 0, 8));
      for (let k = 0; k < 140; k++) {
        const a = hash(k) * TAU, r = (1 - gather) * (100 + hash(k * 3) * 300);
        circle(c, 640 + Math.cos(a) * r, 470 + Math.sin(a) * r * 0.6, 2.5, `rgba(124,255,58,${0.4 + gather * 0.6})`);
      }
      if (lt > 7) {
        const z = 1 + ease(seg(lt, 7, 16)) * 1.6;
        c.save(); c.translate(640, 470); c.scale(z, z); c.translate(-640, -470);
        vorx(c, 640, 600, 1.05, { t, mut: 1, alpha: ease(seg(lt, 7, 9)), blink: lt < 11, mouth: lt > 13 ? 0.35 : 0.05 });
        c.restore();
      }
      vignette(c, 0.85);
      if (lt > 16) fillAll(c, `rgba(0,0,0,${ease(seg(lt, 16, 18))})`);
    }
  } });

// 16. To be continued + credits
add({ name: 'credits', dur: 60, mood: 'credits', events: [],
  draw(c, t) {
    fillAll(c, '#05070a');
    if (t < 12) {
      c.globalAlpha = ease(seg(t, 0.5, 2.5)) * (1 - ease(seg(t, 10, 12)));
      text(c, 'UNKILLABLE', W / 2, 300, 96, C.goo, { weight: 900, spacing: 6, stroke: 8, strokeCol: '#0b2a05' });
      text(c, 'WILL RETURN IN EPISODE 2', W / 2, 410, 30, '#ffffff', { weight: 800, spacing: 6 });
      c.globalAlpha = 1;
      return;
    }
    const lines = ['UNKILLABLE', '', 'Episode 1: Welcome to Dunmore', '', 'Starring', 'The Visitor', '', 'Dunmore Residents', 'The Farmer', 'The Chef', 'Big Jim (voice of the horn)', '', 'The Army', 'Six Very Tired Soldiers', 'One Tank', '', 'Lab 7', 'Two Scientists', 'The General', '', 'Deaths this episode: 100', 'Deaths that stuck: 0', '', 'Next: Episode 2', '', '', 'No aliens were harmed for good.'];
    const y0 = H + 40 - (t - 12) * 48;
    lines.forEach((l, i) => text(c, l, W / 2, y0 + i * 58, i === 0 ? 54 : (l === 'Starring' || l === 'Dunmore Residents' || l === 'The Army' || l === 'Lab 7') ? 22 : 30, i === 0 ? C.goo : (l.startsWith('Deaths') ? '#bff5a0' : '#e8ecef'), { weight: i === 0 ? 900 : 700, spacing: i === 0 ? 4 : 1 }));
    vorx(c, 1120, 700, 0.6, { t, mut: 1, walk: t * 4, lookX: -1 });
    if (t > 56) fillAll(c, `rgba(0,0,0,${ease(seg(t, 56, 60))})`);
  } });

// ---------------- timeline ----------------
export const SCENES = S;
let acc = 0;
for (const sc of S) { sc.start = acc; acc += sc.dur; }
export const DURATION = acc;
export const EVENTS = S.flatMap((sc) => sc.events.map(([t, sfx, o]) => ({ t: sc.start + t, sfx, death: !!(o && o.death), mood: sc.mood })));
export const DEATHS = EVENTS.filter((e) => e.death).map((e) => e.t).sort((a, b) => a - b);
export const MOODS = S.map((sc) => ({ start: sc.start, end: sc.start + sc.dur, mood: sc.mood, name: sc.name }));

export function drawFrame(c, t) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  let sc = S[S.length - 1];
  for (const s of S) if (t >= s.start && t < s.start + s.dur) { sc = s; break; }
  const lt = t - sc.start;
  c.save(); sc.draw(c, lt); c.restore();
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  // death counter (not on the title, news, night, twist or credits)
  const show = !['title', 'news', 'night', 'twist', 'credits', 'crash', 'capture'].includes(sc.name);
  if (show) {
    const n = DEATHS.filter((d) => d <= t).length;
    const last = DEATHS.filter((d) => d <= t).pop() ?? -99;
    deathCounter(c, n, clamp(1 - (t - last) * 3));
  }
  // short fade between scenes
  const fadeIn = clamp(lt / 0.5), fadeOut = clamp((sc.dur - lt) / 0.5);
  const f = Math.min(fadeIn, fadeOut);
  if (f < 1) { c.fillStyle = `rgba(0,0,0,${1 - f})`; c.fillRect(0, 0, W, H); }
}
