// ---------- EFFECTS: one-click stuff that messes with the whole page ----------

// [id, name, short description, group, kind]
// kind: p = particles, f = color filter, c = page CSS, m = mouse, x = text trick
var FX_LIST = [
  ['snow', 'Snow', 'Flakes falling', 'Weather', 'p'], ['rain', 'Rain', 'Streaks + splashes', 'Weather', 'p'],
  ['confetti', 'Confetti', 'Party paper', 'Weather', 'p'], ['bubbles', 'Bubbles', 'Float up + pop', 'Weather', 'p'],
  ['fireflies', 'Fireflies', 'Glowing bugs', 'Weather', 'p'], ['leaves', 'Leaves', 'Autumn leaves', 'Weather', 'p'],
  ['hearts', 'Hearts', 'Floating hearts', 'Weather', 'p'], ['stars', 'Shooting stars', 'Across the screen', 'Weather', 'p'],
  ['rainbow', 'Rainbow', 'Colors cycle forever', 'Colors', 'f'], ['dark', 'Flip colors', 'Light sites go dark', 'Colors', 'f'],
  ['gray', 'Black + white', 'Old TV', 'Colors', 'f'], ['sepia', 'Old photo', 'Vintage brown', 'Colors', 'f'],
  ['night', 'Night vision', 'Green goggles', 'Colors', 'f'], ['thermal', 'Heat vision', 'Predator mode', 'Colors', 'f'],
  ['blur', 'Blurry', 'Need glasses', 'Colors', 'f'], ['saturate', 'Super colors', 'Turned way up', 'Colors', 'f'],
  ['neon', 'Neon text', 'All text glows', 'Colors', 'c'],
  ['upside', 'Upside down', 'Flip the page', 'Motion', 'c'], ['mirror', 'Mirror', 'Everything backwards', 'Motion', 'c'],
  ['spin', 'Spin', 'Page spins around', 'Motion', 'c'], ['wobble', 'Wobble', 'Sways like jelly', 'Motion', 'c'],
  ['shake', 'Earthquake', 'Nonstop shaking', 'Motion', 'c'], ['dance', 'Dance party', 'Stuff bounces + music', 'Motion', 'c'],
  ['drunk', 'Dizzy', 'Swaying + blurry', 'Motion', 'c'], ['tilt', '3D tilt', 'Tilts toward your mouse', 'Motion', 'c'],
  ['comic', 'Comic Sans', 'Every font = Comic Sans', 'Text', 'c'], ['backwards', 'Backwards', 'Text right to left', 'Text', 'c'],
  ['glitchtext', 'Glitch titles', 'Headings glitch out', 'Text', 'c'], ['giant', 'Giant mode', 'Everything bigger', 'Text', 'c'],
  ['tiny', 'Tiny mode', 'Everything smaller', 'Text', 'c'], ['scramble', 'Scramble', 'Letters get mixed up', 'Text', 'x'],
  ['spinpics', 'Spinning pics', 'Pictures spin', 'Pictures', 'c'], ['flippics', 'Flipped pics', 'Pictures upside down', 'Pictures', 'c'],
  ['bigpics', 'Zoom pics', 'Pictures grow on hover', 'Pictures', 'c'], ['hidepics', 'No pictures', 'Hide every picture', 'Pictures', 'c'],
  ['trail', 'Sparkle trail', 'Mouse leaves sparkles', 'Mouse', 'm'], ['bigcursor', 'Giant cursor', 'Huge mouse pointer', 'Mouse', 'm'],
  ['clickboom', 'Click fireworks', 'Clicks explode', 'Mouse', 'm'], ['clicksound', 'Click sounds', 'Clicks make noise', 'Mouse', 'm']
];
var fxTemp = {};
function fxOn() {
  var on = {};
  for (var k in S.fx) if (S.fx[k]) on[k] = true;
  for (k in fxTemp) if (fxTemp[k]) on[k] = !on[k];
  return on;
}
function toggleFx(id) {
  var f = copy(S.fx);
  if (f[id]) delete f[id]; else f[id] = 1;
  if (id === 'giant' && f.giant) delete f.tiny;
  if (id === 'tiny' && f.tiny) delete f.giant;
  var info = FX_LIST.filter(function (x) { return x[0] === id; })[0];
  setState('fx', f, (f[id] ? 'Effect on: ' : 'Effect off: ') + (info ? info[1] : id));
  if (ui && curTab === 'fx') renderTab();
}

var fxSheet = null, scrambled = null, cursorPos = { x: -100, y: -100 };
function fxApply() {
  var on = fxOn(), o = S.fxo, sp = o.speed || 1, col = o.color || '#3dffa2';
  if (Object.keys(on).length) buildHost();
  if (!fxSheet) fxSheet = docSheet('');
  var rules = [], anim = [];
  var moving = on.upside || on.mirror || on.spin || on.wobble || on.shake || on.drunk || on.tilt;
  if (moving) { rules.push('html body{transform-origin:50% var(--ew-oy,50vh) !important}'); updateOrigin(); }
  if (on.upside) rules.push('html body{rotate:180deg}');
  if (on.mirror) rules.push('html body{scale:-1 1}');
  if (on.spin) anim.push('ew-spin ' + (8 / sp).toFixed(2) + 's linear infinite');
  else if (on.wobble) anim.push('ew-wobble ' + (2.4 / sp).toFixed(2) + 's ease-in-out infinite');
  else if (on.drunk) anim.push('ew-drunk ' + (5 / sp).toFixed(2) + 's ease-in-out infinite');
  if (on.shake) anim.push('ew-shake ' + (0.45 / sp).toFixed(2) + 's linear infinite');
  if (anim.length) rules.push('html body{animation:' + anim.join(',') + ' !important}');
  if (on.tilt) rules.push('html body{transform:perspective(1400px) rotateX(var(--ew-rx,0deg)) rotateY(var(--ew-ry,0deg)) !important}');
  if (on.neon) rules.push('html body *{text-shadow:0 0 4px ' + col + ',0 0 12px ' + col + ',0 0 24px ' + col + ' !important}');
  if (on.comic) rules.push('html body,html body *{font-family:"Comic Sans MS","Comic Sans","Chalkboard SE","Comic Neue",cursive !important}');
  if (on.backwards) rules.push('html body *{unicode-bidi:bidi-override !important;direction:rtl !important}');
  if (on.glitchtext) rules.push('html body :is(h1,h2,h3,h4){animation:ew-glitch ' + (1.3 / sp).toFixed(2) + 's steps(1) infinite !important}');
  if (on.giant) rules.push('html body{zoom:1.35}');
  else if (on.tiny) rules.push('html body{zoom:0.7}');
  if (on.spinpics) rules.push('html body :is(img,svg,video,picture){animation:ew-spin ' + (3 / sp).toFixed(2) + 's linear infinite !important}');
  if (on.flippics) rules.push('html body :is(img,video,picture){rotate:180deg !important}');
  if (on.bigpics) rules.push('html body img{transition:scale .25s ease !important}html body img:hover{scale:1.7 !important;position:relative;z-index:2147483000}');
  if (on.hidepics) rules.push('html body :is(img,picture,video,svg){visibility:hidden !important}');
  if (on.dance) rules.push('html body :is(img,h1,h2,h3,button,svg,video){animation:ew-bop ' + (0.5 / sp).toFixed(2) + 's ease-in-out infinite !important}html body :is(h1,h2,h3,button):nth-of-type(2n),html body img:nth-of-type(3n){animation-name:ew-sway !important}');
  if (on.bigcursor) rules.push('html,html *{cursor:none !important}');
  fxSheet.replaceSync(rules.join('\n'));

  if (fxLayer) {
    var f = [];
    if (on.dark) f.push('invert(1) hue-rotate(180deg)');
    if (on.gray) f.push('grayscale(1) contrast(1.15)');
    if (on.sepia) f.push('sepia(.85) contrast(1.05) brightness(.95)');
    if (on.night) f.push('grayscale(1) brightness(1.2) sepia(1) hue-rotate(70deg) saturate(5)');
    if (on.thermal) f.push('grayscale(1) invert(1) sepia(1) saturate(8) hue-rotate(-50deg)');
    if (on.blur) f.push('blur(3px)');
    if (on.drunk) f.push('blur(1.2px)');
    if (on.saturate) f.push('saturate(2.6) contrast(1.1)');
    var fs = f.join(' ');
    css(fxLayer, { display: fs ? 'block' : 'none', 'backdrop-filter': fs || 'none', '-webkit-backdrop-filter': fs || 'none' });
    css(fxLayer2, { display: on.rainbow ? 'block' : 'none', 'animation-duration': (6 / sp).toFixed(2) + 's' });
  }

  // particles
  WEATHER_IDS.forEach(function (id) { if (on[id]) wxStart(id); else wxStop(id); });
  // mouse stuff
  var needMouse = on.trail || on.bigcursor || on.tilt;
  W[needMouse ? 'addEventListener' : 'removeEventListener']('pointermove', fxMouse, { passive: true });
  W[moving ? 'addEventListener' : 'removeEventListener']('scroll', updateOrigin, { passive: true });
  W[on.clickboom || on.clicksound ? 'addEventListener' : 'removeEventListener']('pointerdown', fxClick, true);
  if (on.bigcursor || on.trail) tickAdd(cursorTick); else tickDel(cursorTick);
  if (!on.tilt) { HTML.style.removeProperty('--ew-rx'); HTML.style.removeProperty('--ew-ry'); }
  if (on.scramble) scrambleOn(); else scrambleOff();
  if (on.dance) music(true); else music(false);
  fxCanvasCheck();
}
function updateOrigin() {
  HTML.style.setProperty('--ew-oy', Math.round(scrollY + innerHeight / 2) + 'px');
}
function fxMouse(e) {
  cursorPos.x = e.clientX; cursorPos.y = e.clientY;
  var on = fxOn();
  if (on.trail) for (var i = 0; i < 2; i++) sparks.push({ x: e.clientX, y: e.clientY, vx: rnd(-40, 40), vy: rnd(-60, 20), g: 120, life: 0, max: rnd(0.4, 0.8), s: rnd(2, 4.5), c: pick1([S.fxo.color, '#ffffff', '#ffd60a', '#2de2ff']), star: true });
  if (on.tilt) {
    HTML.style.setProperty('--ew-rx', ((0.5 - e.clientY / innerHeight) * 14).toFixed(2) + 'deg');
    HTML.style.setProperty('--ew-ry', ((e.clientX / innerWidth - 0.5) * 18).toFixed(2) + 'deg');
  }
  if (on.trail) fxCanvasCheck();
}
function fxClick(e) {
  if (isOurs(e.target)) return;
  var on = fxOn();
  if (on.clickboom) burst(e.clientX, e.clientY, 50);
  if (on.clicksound) playSound(pick1(['pop', 'click', 'coin', 'laser', 'jump', 'ding']));
}

// ----- particle overlay -----
var sparks = [], wx = {}, WEATHER_IDS = ['snow', 'rain', 'confetti', 'bubbles', 'fireflies', 'leaves', 'hearts', 'stars'];
var CONF_COLORS = ['#ff2a6d', '#ffd60a', '#3dffa2', '#2de2ff', '#8338ec', '#ff7a18', '#ffffff'];
function fxCtx() {
  buildHost();
  if (fxCanvas.width !== innerWidth || fxCanvas.height !== innerHeight) { fxCanvas.width = innerWidth; fxCanvas.height = innerHeight; }
  return fxCanvas.getContext('2d');
}
function wxStart(id) { if (!wx[id]) { wx[id] = { list: [], acc: 0 }; fxCanvasCheck(); } }
function wxStop(id) { delete wx[id]; }
function fxCanvasCheck() {
  var busy = sparks.length || Object.keys(wx).length || fxOn().bigcursor;
  if (busy) { buildHost(); fxCanvas.style.display = 'block'; tickAdd(fxTick); }
}
function burst(x, y, n, colors, spread) {
  n = Math.round(n || 60);
  for (var i = 0; i < n; i++) {
    var a = rnd(0, 6.283), v = rnd(120, 520) * (spread ? 0.6 + spread / 300 : 1);
    sparks.push({ x: x + rnd(-1, 1) * (spread || 4) * 0.3, y: y + rnd(-1, 1) * (spread || 4) * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 700, life: 0, max: rnd(0.7, 1.5), s: rnd(3, 7), c: pick1(colors || CONF_COLORS), rot: rnd(0, 6), vr: rnd(-12, 12) });
  }
  fxCanvasCheck();
}
function wxSpawnCount(id, w, hh) {
  var area = w * hh / (1280 * 720), am = S.fxo.amount || 1;
  return Math.round(({ snow: 160, rain: 260, confetti: 140, bubbles: 40, fireflies: 50, leaves: 45, hearts: 30, stars: 3 })[id] * area * am);
}
function wxMake(id, w, hh, any) {
  var y0 = any ? rnd(-hh, 0) : rnd(-60, -10);
  switch (id) {
    case 'snow': return { x: rnd(0, w), y: y0, r: rnd(1.2, 3.8), vy: rnd(35, 90), ph: rnd(0, 6.3), sw: rnd(12, 40) };
    case 'rain': return { x: rnd(-100, w), y: y0, l: rnd(12, 26), vy: rnd(700, 1000) };
    case 'confetti': return { x: rnd(0, w), y: y0, w: rnd(6, 11), h: rnd(3, 6), vy: rnd(70, 140), ph: rnd(0, 6.3), r: rnd(0, 6), vr: rnd(-6, 6), c: pick1(CONF_COLORS) };
    case 'bubbles': return { x: rnd(0, w), y: any ? rnd(0, hh) : hh + rnd(10, 60), r: rnd(6, 24), vy: rnd(40, 110), ph: rnd(0, 6.3) };
    case 'fireflies': return { x: rnd(0, w), y: rnd(0, hh), vx: rnd(-20, 20), vy: rnd(-20, 20), ph: rnd(0, 6.3) };
    case 'leaves': return { x: rnd(0, w), y: y0, s: rnd(8, 16), vy: rnd(40, 90), ph: rnd(0, 6.3), r: rnd(0, 6), vr: rnd(-3, 3), c: pick1(['#d35400', '#e67e22', '#c0392b', '#f1c40f', '#a04000']) };
    case 'hearts': return { x: rnd(0, w), y: any ? rnd(0, hh) : hh + 30, s: rnd(8, 20), vy: rnd(30, 70), ph: rnd(0, 6.3), c: pick1(['#ff2a6d', '#ff4fa3', '#ff8fab', '#e5383b']) };
    case 'stars': return { x: rnd(-200, w * 0.7), y: rnd(-100, hh * 0.4), vx: rnd(600, 1000), vy: rnd(200, 420), life: 0 };
  }
  return { x: 0, y: 0 };
}
function heartPath(c, x, y, s) {
  c.moveTo(x, y + s * 0.3);
  c.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s);
  c.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
}
var fxTime = 0;
function fxTick(dt) {
  var c = fxCtx(), w = fxCanvas.width, hh = fxCanvas.height, sp = S.fxo.speed || 1;
  fxTime += dt;
  c.clearRect(0, 0, w, hh);
  for (var id in wx) {
    var st = wx[id], L = st.list, want = wxSpawnCount(id, w, hh);
    if (id === 'stars') { st.acc += dt; if (st.acc > 1.2 / sp && L.length < want) { st.acc = 0; L.push(wxMake(id, w, hh)); } }
    else while (L.length < want) L.push(wxMake(id, w, hh, true));
    if (L.length > want) L.length = want;
    var d = dt * sp;
    c.save();
    if (id === 'snow') {
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath();
      L.forEach(function (p, i) {
        p.y += p.vy * d; p.x += Math.sin(fxTime * 1.3 + p.ph) * p.sw * d;
        if (p.y > hh + 5) L[i] = p = wxMake(id, w, hh);
        c.moveTo(p.x + p.r, p.y); c.arc(p.x, p.y, p.r, 0, 6.283);
      });
      c.fill();
    } else if (id === 'rain') {
      c.strokeStyle = 'rgba(170,200,255,0.55)'; c.lineWidth = 1.2; c.beginPath();
      L.forEach(function (p, i) {
        p.y += p.vy * d; p.x += p.vy * 0.18 * d;
        if (p.y > hh) { if (Math.random() < 0.3) sparks.push({ x: p.x, y: hh - 2, vx: rnd(-60, 60), vy: rnd(-120, -40), g: 600, life: 0, max: 0.3, s: 1.5, c: '#aac8ff' }); L[i] = p = wxMake(id, w, hh); }
        c.moveTo(p.x, p.y); c.lineTo(p.x - p.l * 0.18, p.y - p.l);
      });
      c.stroke();
    } else if (id === 'confetti') {
      L.forEach(function (p, i) {
        p.y += p.vy * d; p.x += Math.sin(fxTime * 2 + p.ph) * 40 * d; p.r += p.vr * d;
        if (p.y > hh + 10) L[i] = p = wxMake(id, w, hh);
        c.setTransform(Math.cos(p.r), Math.sin(p.r) * 0.6, -Math.sin(p.r), Math.cos(p.r), p.x, p.y);
        c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(fxTime * 4 + p.ph)) + 0.5);
      });
      c.setTransform(1, 0, 0, 1, 0, 0);
    } else if (id === 'bubbles') {
      L.forEach(function (p, i) {
        p.y -= p.vy * d; p.x += Math.sin(fxTime * 1.5 + p.ph) * 20 * d;
        if (p.y < -p.r) { burst(p.x, p.y + p.r, 6, ['#bfe9ff']); L[i] = p = wxMake(id, w, hh); }
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283);
        c.fillStyle = 'rgba(180,230,255,0.08)'; c.fill();
        c.strokeStyle = 'rgba(200,240,255,0.6)'; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); c.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.2, 0, 6.283); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
      });
    } else if (id === 'fireflies') {
      c.globalCompositeOperation = 'lighter';
      L.forEach(function (p) {
        p.vx += rnd(-60, 60) * d; p.vy += rnd(-60, 60) * d;
        p.vx *= 0.98; p.vy *= 0.98;
        p.x = (p.x + p.vx * d + w) % w; p.y = (p.y + p.vy * d + hh) % hh;
        var a = 0.35 + 0.65 * Math.max(0, Math.sin(fxTime * 2 + p.ph));
        var g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 14);
        g.addColorStop(0, 'rgba(230,255,120,' + a + ')'); g.addColorStop(1, 'rgba(160,255,60,0)');
        c.fillStyle = g; c.fillRect(p.x - 14, p.y - 14, 28, 28);
      });
    } else if (id === 'leaves') {
      L.forEach(function (p, i) {
        p.y += p.vy * d; p.x += Math.sin(fxTime * 1.1 + p.ph) * 50 * d; p.r += p.vr * d;
        if (p.y > hh + 20) L[i] = p = wxMake(id, w, hh);
        c.setTransform(Math.cos(p.r), Math.sin(p.r), -Math.sin(p.r), Math.cos(p.r), p.x, p.y);
        c.fillStyle = p.c; c.beginPath();
        c.moveTo(0, -p.s); c.quadraticCurveTo(p.s * 0.7, 0, 0, p.s); c.quadraticCurveTo(-p.s * 0.7, 0, 0, -p.s); c.fill();
        c.strokeStyle = 'rgba(60,20,0,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -p.s); c.lineTo(0, p.s * 1.2); c.stroke();
      });
      c.setTransform(1, 0, 0, 1, 0, 0);
    } else if (id === 'hearts') {
      L.forEach(function (p, i) {
        p.y -= p.vy * d; p.x += Math.sin(fxTime * 1.2 + p.ph) * 25 * d;
        if (p.y < -30) L[i] = p = wxMake(id, w, hh);
        c.globalAlpha = Math.min(1, p.y / hh + 0.2);
        c.fillStyle = p.c; c.beginPath(); heartPath(c, p.x, p.y, p.s); c.fill();
      });
    } else if (id === 'stars') {
      c.lineCap = 'round';
      for (var si = L.length - 1; si >= 0; si--) {
        var p = L[si];
        p.x += p.vx * d; p.y += p.vy * d; p.life += d;
        if (p.x > w + 200 || p.y > hh + 200) { L.splice(si, 1); continue; }
        var g2 = c.createLinearGradient(p.x, p.y, p.x - p.vx * 0.18, p.y - p.vy * 0.18);
        g2.addColorStop(0, 'rgba(255,255,255,0.95)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
        c.strokeStyle = g2; c.lineWidth = 2.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.18, p.y - p.vy * 0.18); c.stroke();
      }
    }
    c.restore();
  }
  // sparks (explosions, trails, splashes)
  if (sparks.length) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.life += dt;
      if (s.life > s.max) { sparks.splice(i, 1); continue; }
      s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.985;
      var k = 1 - s.life / s.max;
      c.globalAlpha = k;
      c.fillStyle = s.c;
      if (s.star) { c.beginPath(); for (var q = 0; q < 8; q++) { var rr = q % 2 ? s.s * 0.4 : s.s, an = q * Math.PI / 4; c.lineTo(s.x + Math.cos(an) * rr, s.y + Math.sin(an) * rr); } c.fill(); }
      else if (s.rot != null) { s.rot += s.vr * dt; c.setTransform(Math.cos(s.rot), Math.sin(s.rot), -Math.sin(s.rot), Math.cos(s.rot), s.x, s.y); c.fillRect(-s.s / 2, -s.s / 4, s.s, s.s / 2); c.setTransform(1, 0, 0, 1, 0, 0); }
      else c.fillRect(s.x, s.y, s.s, s.s);
    }
    if (sparks.length > 3000) sparks.splice(0, sparks.length - 3000);
    c.restore();
  }
  if (fxOn().bigcursor) drawBigCursor(c);
  if (!sparks.length && !Object.keys(wx).length && !fxOn().bigcursor) {
    c.clearRect(0, 0, w, hh);
    fxCanvas.style.display = 'none';
    tickDel(fxTick);
  }
}
function cursorTick() { fxCanvasCheck(); }
function drawBigCursor(c) {
  var x = cursorPos.x, y = cursorPos.y, s = 3.2;
  c.save();
  c.setTransform(s, 0, 0, s, x, y);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 17); c.lineTo(4.2, 13); c.lineTo(7, 19.5); c.lineTo(9.6, 18.4); c.lineTo(6.9, 12.2); c.lineTo(12.5, 12.2); c.closePath();
  c.fillStyle = '#fff'; c.fill();
  c.lineWidth = 1.2 / s * 2.2; c.strokeStyle = '#000'; c.stroke();
  c.restore();
}

// ----- scramble letters -----
function scrambleOn() {
  if (scrambled || !D.body) return;
  scrambled = new Map();
  var tw = D.createTreeWalker(D.body, NodeFilter.SHOW_TEXT), n, count = 0;
  while ((n = tw.nextNode()) && count < 20000) {
    var p = n.parentElement;
    if (!p || isOurs(p) || /^(script|style|textarea|noscript|code|pre)$/.test(p.localName) || p.isContentEditable) continue;
    if (!/[a-z]{4}/i.test(n.nodeValue)) continue;
    scrambled.set(n, n.nodeValue);
    n.nodeValue = n.nodeValue.replace(/[A-Za-z]{4,}/g, function (wd) {
      var mid = wd.slice(1, -1).split('');
      for (var i = mid.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = mid[i]; mid[i] = mid[j]; mid[j] = t; }
      return wd[0] + mid.join('') + wd[wd.length - 1];
    });
    count++;
  }
}
function scrambleOff() {
  if (!scrambled) return;
  scrambled.forEach(function (v, n) { if (n.isConnected) n.nodeValue = v; });
  scrambled = null;
}

// ----- Gravity: everything falls down (and you can throw it around) -----
var GR = null;
function gravity() {
  if (GR) { gravityStop(); return; }
  if (!D.body) return;
  var vw = innerWidth, vh = innerHeight, chosen = new Set(), bodies = [];
  var all = D.body.querySelectorAll('img,svg,video,canvas,button,input,select,textarea,a,h1,h2,h3,h4,h5,h6,p,li,label,td,th,iframe,[role=button],ytd-thumbnail,span');
  for (var i = 0; i < all.length && bodies.length < 180; i++) {
    var el = all[i];
    if (isOurs(el)) continue;
    var skip = false;
    for (var a = el.parentElement; a; a = a.parentElement) if (chosen.has(a)) { skip = true; break; }
    if (skip) continue;
    var r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    if (r.width < 6 || r.height < 6 || r.width > vw * 0.85 || r.height > vh * 0.7) continue;
    if (el.localName === 'span' && el.children.length) continue;
    chosen.add(el);
    bodies.push({
      el: el, x: 0, y: 0, vx: rnd(-60, 60), vy: rnd(-200, 0), a: 0, va: rnd(-60, 60),
      l: r.left, t: r.top, w: r.width, h: r.height,
      prev: ['translate', 'rotate', 'transition', 'will-change'].map(function (k) { return [k, el.style.getPropertyValue(k), el.style.getPropertyPriority(k)]; })
    });
  }
  if (!bodies.length) { toast('Nothing to drop here'); return; }
  GR = { bodies: bodies, drag: null, ovf: [HTML.style.getPropertyValue('overflow'), HTML.style.getPropertyPriority('overflow')] };
  HTML.style.setProperty('overflow', 'hidden', 'important');
  bodies.forEach(function (b) { b.el.style.setProperty('transition', 'none', 'important'); b.el.style.setProperty('will-change', 'translate, rotate', 'important'); });
  W.addEventListener('pointerdown', grDown, true);
  W.addEventListener('pointermove', grMove, true);
  W.addEventListener('pointerup', grUp, true);
  W.addEventListener('click', grClick, true);
  tickAdd(grTick);
  if (ui && curTab === 'fx') renderTab();
  toast('Gravity ON. Grab stuff and throw it! Press Esc or "Stop gravity" to put it all back.', 'ok', 4500);
}
function gravityStop() {
  if (!GR) return;
  tickDel(grTick);
  GR.bodies.forEach(function (b) {
    b.prev.forEach(function (p) { if (p[1]) b.el.style.setProperty(p[0], p[1], p[2]); else b.el.style.removeProperty(p[0]); });
    cleanStyle(b.el);
  });
  if (GR.ovf[0]) HTML.style.setProperty('overflow', GR.ovf[0], GR.ovf[1]); else HTML.style.removeProperty('overflow');
  W.removeEventListener('pointerdown', grDown, true);
  W.removeEventListener('pointermove', grMove, true);
  W.removeEventListener('pointerup', grUp, true);
  setTimeout(function () { W.removeEventListener('click', grClick, true); }, 50);
  GR = null;
  if (ui && curTab === 'fx') renderTab();
}
function grTick(dt) {
  var vw = innerWidth, vh = innerHeight, bs = GR.bodies;
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    if (GR.drag && GR.drag.b === b) continue;
    b.vy += 2200 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
    var bottom = b.t + b.y + b.h;
    if (bottom > vh) { b.y = vh - b.h - b.t; b.vy *= -0.3; b.vx *= 0.85; b.va *= 0.7; if (Math.abs(b.vy) < 40) b.vy = 0; }
    if (b.l + b.x < 0) { b.x = -b.l; b.vx = Math.abs(b.vx) * 0.5; }
    if (b.l + b.x + b.w > vw) { b.x = vw - b.w - b.l; b.vx = -Math.abs(b.vx) * 0.5; }
    if (b.t + b.y < -400) { b.y = -400 - b.t; b.vy = 0; }
  }
  // simple stacking: push overlapping things apart
  for (i = 0; i < bs.length; i++) {
    var A = bs[i], ax = A.l + A.x, ay = A.t + A.y;
    for (var j = i + 1; j < bs.length; j++) {
      var B = bs[j], bx = B.l + B.x, by = B.t + B.y;
      var ox = Math.min(ax + A.w, bx + B.w) - Math.max(ax, bx), oy = Math.min(ay + A.h, by + B.h) - Math.max(ay, by);
      if (ox <= 0 || oy <= 0) continue;
      if (oy < ox) {
        var top = ay < by ? A : B;
        if (GR.drag && GR.drag.b === top) continue;
        top.y -= oy; if (top.vy > 0) top.vy = 0; top.va *= 0.9;
        if (top === A) ay -= oy;
      } else {
        var lft = ax < bx ? A : B, rgt = lft === A ? B : A, half = ox / 2;
        lft.x -= half; rgt.x += half;
      }
    }
  }
  for (i = 0; i < bs.length; i++) {
    var e = bs[i];
    e.el.style.setProperty('translate', e.x.toFixed(1) + 'px ' + e.y.toFixed(1) + 'px', 'important');
    e.el.style.setProperty('rotate', (e.a % 360).toFixed(1) + 'deg', 'important');
  }
}
function grFind(t) {
  for (var i = 0; i < GR.bodies.length; i++) if (GR.bodies[i].el === t || GR.bodies[i].el.contains(t)) return GR.bodies[i];
  return null;
}
function grDown(e) {
  if (isOurs(e.target)) return;
  var b = grFind(e.target);
  if (!b) return;
  swallow(e);
  GR.drag = { b: b, ox: e.clientX - (b.l + b.x), oy: e.clientY - (b.t + b.y), lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: false };
}
function grMove(e) {
  var d = GR && GR.drag;
  if (!d) return;
  var t = performance.now(), dtm = Math.max(1, t - d.lt) / 1000;
  d.b.vx = (e.clientX - d.lx) / dtm; d.b.vy = (e.clientY - d.ly) / dtm;
  d.lx = e.clientX; d.ly = e.clientY; d.lt = t; d.moved = true;
  d.b.x = e.clientX - d.ox - d.b.l; d.b.y = e.clientY - d.oy - d.b.t;
  d.b.el.style.setProperty('translate', d.b.x + 'px ' + d.b.y + 'px', 'important');
}
function grUp(e) {
  var d = GR && GR.drag;
  if (!d) return;
  d.b.vx = clamp(d.b.vx, -2500, 2500); d.b.vy = clamp(d.b.vy, -2500, 2500); d.b.va = d.b.vx * 0.2;
  GR.drag = null;
  swallow(e);
}
function grClick(e) { if (!isOurs(e.target)) swallow(e); }

// ----- one-shot page tricks -----
function shakeOnce() {
  if (!D.body || !D.body.animate) return;
  D.body.animate([{ translate: '0 0' }, { translate: '-12px 6px' }, { translate: '10px -8px' }, { translate: '-8px -6px' }, { translate: '12px 8px' }, { translate: '-6px 4px' }, { translate: '0 0' }], { duration: 600, easing: 'linear' });
}
function barrelRoll(el) {
  el = el || D.body;
  if (!el || !el.animate) return;
  el.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)' });
}
function confettiRain(ms) {
  burst(innerWidth / 2, innerHeight / 3, 120);
  if (S.fx.confetti || fxTemp.confetti) return;
  fxTemp.confetti = true; fxApply();
  setTimeout(function () { delete fxTemp.confetti; fxApply(); }, ms || 3500);
}
function fireworksShow() {
  var n = 0;
  var t = setInterval(function () {
    burst(rnd(innerWidth * 0.15, innerWidth * 0.85), rnd(innerHeight * 0.15, innerHeight * 0.5), 90, pick1([['#ff2a6d', '#ffd60a'], ['#2de2ff', '#ffffff'], ['#3dffa2', '#ffd60a'], ['#8338ec', '#ff4fa3']]));
    playSound('boom', null, 0.35);
    if (++n >= 9) clearInterval(t);
  }, 420);
}

// ----- sounds (made with code, so no site can block them) -----
var AC = null;
function ac() {
  try { if (!AC) AC = new (W.AudioContext || W.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; }
  return AC;
}
function tone(type, f0, f1, dur, vol, delay, a) {
  a = a || ac(); if (!a) return;
  var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, f0, f1, delay, type) {
  var a = ac(); if (!a) return;
  var t = a.currentTime + (delay || 0), n = Math.round(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination);
  s.start(t); s.stop(t + dur);
}
var SOUND_LIST = [['airhorn', 'Air horn'], ['boom', 'Explosion'], ['pop', 'Pop'], ['click', 'Click'], ['coin', 'Coin'], ['laser', 'Laser'],
  ['ding', 'Ding'], ['buzzer', 'Wrong buzzer'], ['siren', 'Siren'], ['jump', 'Jump'], ['drum', 'Drum'], ['win', 'Win jingle'],
  ['lose', 'Sad trombone'], ['fart', 'Fart'], ['bruh', 'Bruh (voice)']];
var soundCache = new Map();
function playSound(name, data, vol) {
  vol = vol || 1;
  if (data) {
    var a = ac(); if (!a) return;
    var key = data.length + ':' + data.slice(-48);
    var go = function (buf) { var s = a.createBufferSource(), g = a.createGain(); g.gain.value = vol; s.buffer = buf; s.connect(g).connect(a.destination); s.start(); };
    if (soundCache.has(key)) return go(soundCache.get(key));
    dataToBlob(data).arrayBuffer().then(function (ab) { return a.decodeAudioData(ab); }).then(function (buf) { soundCache.set(key, buf); go(buf); }).catch(function () {});
    return;
  }
  switch (name) {
    case 'pop': tone('sine', 700, 160, 0.12, 0.5 * vol); break;
    case 'click': tone('square', 1800, 1100, 0.03, 0.12 * vol); break;
    case 'boom': noise(1.3, 0.9 * vol, 1400, 50); tone('sine', 110, 28, 0.9, 0.9 * vol); break;
    case 'coin': tone('square', 988, 988, 0.08, 0.16 * vol); tone('square', 1319, 1319, 0.35, 0.16 * vol, 0.08); break;
    case 'laser': tone('sawtooth', 1700, 110, 0.32, 0.2 * vol); break;
    case 'ding': tone('sine', 1319, 1319, 1.3, 0.35 * vol); tone('sine', 2637, 2637, 0.9, 0.12 * vol); break;
    case 'buzzer': tone('square', 110, 100, 0.7, 0.22 * vol); tone('sawtooth', 116, 104, 0.7, 0.12 * vol); break;
    case 'jump': tone('square', 280, 900, 0.18, 0.15 * vol); break;
    case 'drum': tone('sine', 160, 40, 0.35, 0.9 * vol); noise(0.06, 0.4 * vol, 4000, 1500, 0, 'highpass'); break;
    case 'win': [523, 659, 784, 1047].forEach(function (f, i) { tone('square', f, f, i === 3 ? 0.5 : 0.13, 0.13 * vol, i * 0.11); }); break;
    case 'lose': [392, 370, 349, 330].forEach(function (f, i) { tone('sawtooth', f, i === 3 ? f * 0.94 : f, i === 3 ? 1.1 : 0.32, 0.14 * vol, i * 0.36); }); break;
    case 'siren': (function () { var a2 = ac(); if (!a2) return; var t = a2.currentTime, o = a2.createOscillator(), g = a2.createGain(), l = a2.createOscillator(), lg = a2.createGain(); o.type = 'sawtooth'; o.frequency.value = 850; l.frequency.value = 1.6; lg.gain.value = 260; l.connect(lg).connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.05); g.gain.setValueAtTime(0.16 * vol, t + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 2); o.connect(g).connect(a2.destination); o.start(t); l.start(t); o.stop(t + 2.05); l.stop(t + 2.05); })(); break;
    case 'fart': (function () { var a3 = ac(); if (!a3) return; var t = a3.currentTime, o = a3.createOscillator(), f = a3.createBiquadFilter(), g = a3.createGain(), l = a3.createOscillator(), lg = a3.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(70, t + 0.7); l.frequency.value = 22; lg.gain.value = 30; l.connect(lg).connect(o.frequency); f.type = 'lowpass'; f.frequency.value = 420; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75); o.connect(f).connect(g).connect(a3.destination); o.start(t); l.start(t); o.stop(t + 0.8); l.stop(t + 0.8); })(); break;
    case 'bruh': say('bruh', 0.35, 0.75); break;
    default: // air horn
      [0, 0.28, 0.56].forEach(function (d, k) {
        var len = k === 2 ? 0.9 : 0.22;
        [466, 470, 233, 699].forEach(function (f) { tone('sawtooth', f, f * 0.98, len, 0.07 * vol, d); });
      });
  }
}
function say(text, pitch, rate) {
  try {
    var u = new SpeechSynthesisUtterance(String(text).slice(0, 300));
    u.pitch = pitch == null ? 1 : pitch; u.rate = rate == null ? 1 : rate;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}

// Dance party music: a little beat made from code
var musicT = 0, musicStep = 0, musicNext = 0;
function music(on) {
  if (!on) { clearInterval(musicT); musicT = 0; return; }
  if (musicT) return;
  var a = ac(); if (!a) return;
  musicStep = 0; musicNext = a.currentTime + 0.1;
  var bass = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49];
  musicT = setInterval(function () {
    var a2 = ac(); if (!a2) return;
    var stepLen = 0.25 / (S.fxo.speed || 1);
    while (musicNext < a2.currentTime + 0.15) {
      var d = musicNext - a2.currentTime, s = musicStep % 16;
      if (s % 4 === 0) { tone('sine', 150, 42, 0.3, 0.5, d); }
      if (s % 8 === 4) noise(0.18, 0.25, 6000, 1200, d, 'bandpass');
      if (s % 2 === 1) noise(0.04, 0.08, 9000, 7000, d, 'highpass');
      if (s % 2 === 0) tone('sawtooth', bass[(musicStep / 2 | 0) % 8], bass[(musicStep / 2 | 0) % 8], 0.2, 0.09, d);
      musicNext += stepLen; musicStep++;
    }
  }, 40);
}

// ======================= the EFFECTS tab =======================
function renderFx() {
  var b = bodyEl, on = fxOn(), groups = [];
  FX_LIST.forEach(function (f) { if (groups.indexOf(f[3]) < 0) groups.push(f[3]); });
  b.appendChild(sec('Big moments',
    h('div', { class: 'grid' },
      h('button', { class: 'btn tile' + (GR ? ' on' : ''), onclick: gravity }, h('b', { text: GR ? 'Stop gravity' : 'Gravity' }), h('small', { text: GR ? 'Put it all back' : 'Everything falls. Throw it!' })),
      h('button', { class: 'btn tile', onclick: fireworksShow }, h('b', { text: 'Fireworks' }), h('small', { text: 'A quick show' })),
      h('button', { class: 'btn tile', onclick: function () { barrelRoll(D.body); } }, h('b', { text: 'Barrel roll' }), h('small', { text: 'Page does a flip' })),
      h('button', { class: 'btn tile', onclick: shakeOnce }, h('b', { text: 'Shake it' }), h('small', { text: 'One big shake' })),
      h('button', { class: 'btn tile', onclick: function () { confettiRain(4000); playSound('win'); } }, h('b', { text: 'Celebrate' }), h('small', { text: 'Confetti + jingle' })),
      h('button', { class: 'btn tile' + (P.on && P.mode === 'explode' ? ' on' : ''), onclick: function () { P.mode = 'explode'; pick(true); toast('Click anything to blow it up. Esc to stop.', 'ok'); renderTab(); } }, h('b', { text: 'Blow stuff up' }), h('small', { text: 'Click things to explode' })))));
  groups.forEach(function (g) {
    b.appendChild(sec(g, h('div', { class: 'grid' }, FX_LIST.filter(function (f) { return f[3] === g; }).map(function (f) {
      return h('button', { class: 'btn tile' + (on[f[0]] ? ' on' : ''), title: f[2], onclick: function () { toggleFx(f[0]); } }, h('b', { text: f[1] }), h('small', { text: f[2] }));
    }))));
  });
  var o = S.fxo;
  b.appendChild(sec('Effect settings',
    row('Amount', slider(0.2, 3, 0.1, o.amount, function (v) { return v.toFixed(1) + 'x'; }, function (v) { setState('fxo', Object.assign({}, S.fxo, { amount: v }), 'Effect amount', 'fxa'); })),
    row('Speed', slider(0.25, 3, 0.05, o.speed, function (v) { return v.toFixed(2) + 'x'; }, function (v) { setState('fxo', Object.assign({}, S.fxo, { speed: v }), 'Effect speed', 'fxs'); })),
    row('Glow color', colorIn(o.color, function (v) { setState('fxo', Object.assign({}, S.fxo, { color: v }), 'Effect color', 'fxc'); })),
    btn('Turn every effect off', function () { setState('fx', {}, 'All effects off'); renderTab(); }, 'bad sm mt')));
}
