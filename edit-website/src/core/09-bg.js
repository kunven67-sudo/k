// ---------- BACKGROUND: put anything behind the website ----------
//
// A layer sits behind the whole page (z-index below everything). Then the
// page's own background is made see-through so the layer shows: html/body
// get cleared, and big solid boxes covering the screen get faded ("x-ray").

var bgLayer = null, bgSheet = null, bgAnimStop = null, bgOverride = null;
var xray = new Map(), xrayTimer = 0;

var GRAD_PRESETS = [
  ['Sunset', ['#ff512f', '#dd2476', '#4a1a6b'], 135], ['Ocean', ['#00c6ff', '#0072ff', '#0b1d51'], 160],
  ['Neon', ['#3dffa2', '#2de2ff', '#8338ec'], 120], ['Galaxy', ['#0f0c29', '#302b63', '#24243e'], 180],
  ['Fire', ['#f12711', '#f5af19', '#ff2a6d'], 45], ['Mint', ['#d4fc79', '#96e6a1', '#2bc0e4'], 135],
  ['Midnight', ['#000000', '#0b132b', '#1c2541'], 180], ['Candy', ['#ff9a9e', '#fad0c4', '#a18cd1'], 120],
  ['Toxic', ['#a8ff00', '#00ff87', '#004d2c'], 200], ['Blood', ['#2b0000', '#8e0e00', '#1f1c18'], 160],
  ['Ice', ['#e0f7ff', '#89d4ff', '#2c6cb0'], 170], ['Vapor', ['#ff71ce', '#01cdfe', '#b967ff'], 90]
];
var ANIMS = [
  ['stars', 'Warp stars', 'Flying through space'], ['matrix', 'Matrix', 'Green code rain'], ['network', 'Network', 'Dots that connect (follows your mouse)'],
  ['waves', 'Waves', 'Smooth glowing waves'], ['galaxy', 'Galaxy', 'A spinning galaxy'], ['fire', 'Fire', 'Flames from the bottom'],
  ['aurora', 'Aurora', 'Northern lights'], ['synth', 'Synthwave', 'Retro sun + neon grid'], ['lava', 'Lava lamp', 'Big glowing blobs'],
  ['glitch', 'Glitch', 'Broken TV static'], ['bubbles', 'Bubbles', 'Bubbles floating up'], ['flow', 'Color flow', 'Colors slowly melting']
];

function bgDefaults() {
  return {
    mode: 'none', color: '#0b0f19',
    grad: { type: 'linear', angle: 135, c: ['#ff512f', '#dd2476', '#4a1a6b'], move: false },
    img: { src: '', fit: 'cover' }, vid: { src: '', fit: 'cover' },
    anim: { name: 'stars', c1: '#2de2ff', c2: '#ff4fa3', speed: 1, amount: 1 },
    dim: 0, blur: 0, see: 85
  };
}
function curBg() { return S.bg || bgDefaults(); }
// "Glow behind text": on by default for busy backgrounds so dark text stays readable
function haloOn(b) { return b.halo != null ? b.halo : /^(anim|image|video)$/.test(b.mode); }
function setBg(patch, label, merge) {
  var b = Object.assign(copy(curBg()), patch);
  setState('bg', b, label, merge);
  if (ui && curTab === 'bg' && !merge) renderTab();
}

function gradCSS(g) {
  var cs = g.c.filter(Boolean);
  if (cs.length < 2) cs = cs.concat(cs);
  if (g.type === 'radial') return 'radial-gradient(circle at 50% 40%, ' + cs.join(', ') + ')';
  if (g.type === 'conic') return 'conic-gradient(from ' + g.angle + 'deg at 50% 50%, ' + cs.join(', ') + ', ' + cs[0] + ')';
  return 'linear-gradient(' + g.angle + 'deg, ' + cs.join(', ') + ')';
}

function bgApply() {
  var b = bgOverride || S.bg;
  if (bgAnimStop) { bgAnimStop(); bgAnimStop = null; }
  if (!b || b.mode === 'none') {
    if (bgLayer) bgLayer.remove();
    if (bgSheet) bgSheet.replaceSync('');
    xrayClear();
    clearInterval(xrayTimer); xrayTimer = 0;
    return;
  }
  if (!bgLayer) {
    bgLayer = D.createElement('ew-bg');
    bgLayer.setAttribute('data-ew-internal', '');
    css(bgLayer, { display: 'block', position: 'fixed', inset: '0', 'z-index': '-2147483647', 'pointer-events': 'none', overflow: 'hidden', background: '#000' }, true);
  }
  if (!bgLayer.isConnected) HTML.appendChild(bgLayer);
  empty(bgLayer);
  var fill = D.createElement('div'), media = null;
  css(fill, { position: 'absolute', inset: '0' }, true);
  var blur = b.blur || 0;
  if (b.mode === 'color') css(fill, { background: b.color }, true);
  else if (b.mode === 'gradient') {
    css(fill, { 'background-image': gradCSS(b.grad), 'background-size': b.grad.move ? '300% 300%' : '100% 100%' }, true);
    if (b.grad.move) css(fill, { animation: 'ew-grad 14s ease-in-out infinite' }, true);
  } else if (b.mode === 'image' && b.img.src) media = makePicture(b.img.src, b.img.fit);
  else if (b.mode === 'video' && b.vid.src) media = makeVideo(b.vid.src, b.vid.fit);
  else if (b.mode === 'anim') {
    var cv = D.createElement('canvas');
    css(cv, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' }, true);
    media = cv;
    bgAnimStop = startAnim(cv, b.anim);
  }
  bgLayer.appendChild(fill);
  if (media) {
    css(media, { position: 'absolute', inset: '0' }, true);
    if (blur) css(media, { filter: 'blur(' + blur + 'px)', transform: 'scale(1.08)' }, true);
    bgLayer.appendChild(media);
  } else if (blur && b.mode !== 'color') css(fill, { filter: 'blur(' + blur + 'px)', transform: 'scale(1.08)' }, true);
  if (b.dim) {
    var dim = D.createElement('div');
    css(dim, { position: 'absolute', inset: '0', background: 'rgba(0,0,0,' + (b.dim / 100) + ')' }, true);
    bgLayer.appendChild(dim);
  }
  if (!bgSheet) bgSheet = docSheet('');
  var rules = 'html,html body{background:transparent !important;background-color:transparent !important;background-image:none !important}';
  if (haloOn(b)) rules += '\nhtml body :not(svg):not(svg *){text-shadow:0 0 2px rgba(255,255,255,.9),0 0 9px rgba(255,255,255,.6)}';
  bgSheet.replaceSync(rules);
  xrayClear();
  xrayScan();
  if (!xrayTimer) xrayTimer = setInterval(xrayScan, 1500);
}

// Fade big solid boxes that would hide the background.
function xrayScan() {
  var b = bgOverride || S.bg;
  if (!b || b.mode === 'none' || !D.body) return;
  var see = (b.see == null ? 85 : b.see) / 100, vw = innerWidth, vh = innerHeight, seen = new Set();
  for (var gx = 0; gx < 6; gx++) for (var gy = 0; gy < 5; gy++) {
    var list = D.elementsFromPoint((gx + 0.5) * vw / 6, (gy + 0.5) * vh / 5);
    for (var k = 0; k < list.length; k++) {
      var el = list[k];
      if (seen.has(el) || el === HTML || el === D.body || isOurs(el)) continue;
      seen.add(el);
      var r = el.getBoundingClientRect();
      if (r.width < vw * 0.45 || r.height < vh * 0.28) continue;
      xrayEl(el, see);
    }
  }
}
function xrayEl(el, see) {
  var rec = xray.get(el);
  if (!rec) {
    var cs = getComputedStyle(el), c = parseColor(cs.backgroundColor) || [0, 0, 0, 0];
    var gimg = /gradient/.test(cs.backgroundImage);
    if (c[3] === 0 && !gimg) return;
    rec = {
      c: [el.style.getPropertyValue('background-color'), el.style.getPropertyPriority('background-color')],
      i: [el.style.getPropertyValue('background-image'), el.style.getPropertyPriority('background-image')],
      rgba: c, grad: gimg
    };
    xray.set(el, rec);
  }
  var a = rec.rgba[3] * (1 - see);
  el.style.setProperty('background-color', 'rgba(' + rec.rgba[0] + ',' + rec.rgba[1] + ',' + rec.rgba[2] + ',' + a.toFixed(3) + ')', 'important');
  if (rec.grad && see >= 0.5) el.style.setProperty('background-image', 'none', 'important');
}
function xrayClear() {
  xray.forEach(function (rec, el) {
    if (rec.c[0]) el.style.setProperty('background-color', rec.c[0], rec.c[1]); else el.style.removeProperty('background-color');
    if (rec.grad) { if (rec.i[0]) el.style.setProperty('background-image', rec.i[0], rec.i[1]); else el.style.removeProperty('background-image'); }
    cleanStyle(el);
  });
  xray.clear();
}

// Picture element that still works on sites that block data: pictures.
function makePicture(src, fit) {
  var box = D.createElement('div');
  css(box, { position: 'absolute', inset: '0', overflow: 'hidden' }, true);
  function asImg() {
    if (fit === 'tile') { css(box, { 'background-image': 'url("' + src + '")', 'background-repeat': 'repeat', 'background-size': 'auto' }, true); return; }
    var img = D.createElement('img');
    img.alt = '';
    css(img, { width: '100%', height: '100%', 'object-fit': fit === 'contain' ? 'contain' : fit === 'stretch' ? 'fill' : 'cover', display: 'block', 'max-width': 'none' }, true);
    img.src = src;
    box.appendChild(img);
  }
  function asCanvas() {
    if (!/^data:/.test(src)) return;
    createImageBitmap(dataToBlob(src)).then(function (bmp) {
      empty(box);
      var cv = D.createElement('canvas');
      css(cv, { width: '100%', height: '100%', display: 'block' }, true);
      box.appendChild(cv);
      function draw() {
        if (!cv.isConnected && box.isConnected) return;
        var w = cv.width = innerWidth, hh = cv.height = innerHeight, c = cv.getContext('2d');
        if (fit === 'tile') { c.fillStyle = c.createPattern(bmp, 'repeat'); c.fillRect(0, 0, w, hh); return; }
        if (fit === 'stretch') { c.drawImage(bmp, 0, 0, w, hh); return; }
        var sc = fit === 'contain' ? Math.min(w / bmp.width, hh / bmp.height) : Math.max(w / bmp.width, hh / bmp.height);
        c.drawImage(bmp, (w - bmp.width * sc) / 2, (hh - bmp.height * sc) / 2, bmp.width * sc, bmp.height * sc);
      }
      draw();
      W.addEventListener('resize', debounce(draw, 200));
    }).catch(function () {});
  }
  var probe = new Image();
  probe.onload = asImg;
  probe.onerror = asCanvas;
  probe.src = src;
  return box;
}
function makeVideo(src, fit) {
  var v = D.createElement('video');
  v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  css(v, { width: '100%', height: '100%', 'object-fit': fit === 'contain' ? 'contain' : 'cover', display: 'block' }, true);
  v.addEventListener('error', function () { toast('This site blocks custom videos. Pictures and animated backgrounds still work here.', 'bad', 5000); }, { once: true });
  v.src = src;
  var p = v.play(); if (p && p.catch) p.catch(function () {});
  return v;
}

// ----- animated backgrounds (one canvas, drawn every frame) -----
function startAnim(cv, o) {
  var env = { c: cv.getContext('2d'), w: 1, h: 1, am: o.amount || 1, c1: o.c1 || '#2de2ff', c2: o.c2 || '#ff4fa3', mouse: { x: -999, y: -999 } };
  var sp = o.speed || 1, t = 0;
  function onMouse(e) { env.mouse.x = e.clientX; env.mouse.y = e.clientY; }
  W.addEventListener('pointermove', onMouse, { passive: true });
  var A = (ANIM_IMPL[o.name] || ANIM_IMPL.stars)(function () { return env; });
  function size() {
    env.w = cv.width = Math.max(1, Math.round(innerWidth));
    env.h = cv.height = Math.max(1, Math.round(innerHeight));
    if (A.init) A.init();
  }
  function tick(dt) {
    if (cv.width !== Math.round(innerWidth) || cv.height !== Math.round(innerHeight)) size();
    t += dt * sp;
    A.frame(dt * sp, t);
  }
  size();
  tickAdd(tick);
  return function () { tickDel(tick); W.removeEventListener('pointermove', onMouse); };
}

function rgbOf(hex) { return parseColor(hex) || [255, 255, 255, 1]; }
function mixA(a, b, t, al) { var x = rgbOf(a), y = rgbOf(b); return 'rgba(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ',' + al + ')'; }
function glowSprite(color, size) {
  var s = D.createElement('canvas'); s.width = s.height = size;
  var g = s.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, hexA(color, 1)); gr.addColorStop(0.35, hexA(color, 0.45)); gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return s;
}

var ANIM_IMPL = {
  stars: function (E) {
    var stars = [];
    return {
      init: function () { var e = E(), n = Math.round(420 * e.am); stars = []; for (var i = 0; i < n; i++) stars.push(newStar(true)); },
      frame: function (dt) {
        var e = E(), c = e.c, cx = e.w / 2, cy = e.h / 2, f = Math.max(e.w, e.h) * 0.5;
        c.fillStyle = 'rgba(2,4,12,0.45)'; c.fillRect(0, 0, e.w, e.h);
        c.lineCap = 'round';
        for (var i = 0; i < stars.length; i++) {
          var s = stars[i], pz = s.z;
          s.z -= dt * 0.35;
          if (s.z <= 0.02) { stars[i] = newStar(false); continue; }
          var x0 = cx + s.x / pz * f, y0 = cy + s.y / pz * f, x1 = cx + s.x / s.z * f, y1 = cy + s.y / s.z * f;
          if (x1 < -50 || x1 > e.w + 50 || y1 < -50 || y1 > e.h + 50) { stars[i] = newStar(false); continue; }
          var b = 1 - s.z;
          c.strokeStyle = s.tint ? hexA(e.c1, b) : 'rgba(255,255,255,' + b + ')';
          c.lineWidth = Math.max(0.6, b * 2.6);
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        }
      }
    };
    function newStar(any) { return { x: rnd(-1, 1), y: rnd(-1, 1), z: any ? rnd(0.05, 1) : 1, tint: Math.random() < 0.3 }; }
  },
  matrix: function (E) {
    var drops = [], acc = 0, size = 16;
    var chars = '\u30a2\u30a4\u30a6\u30a8\u30aa\u30ab\u30ad\u30af\u30b1\u30b3\u30b5\u30b7\u30b9\u30bb\u30bd\u30bf\u30c1\u30c4\u30c6\u30c8\u30ca\u30cb\u30cc\u30cd\u30ce\u30cf\u30d2\u30d5\u30d8\u30db\u30de\u30df\u30e0\u30e1\u30e2\u30e4\u30e6\u30e8\u30e9\u30ea\u30eb\u30ec\u30ed\u30ef\u30f3' + '0123456789ABCDEF$#@%&*';
    return {
      init: function () { var e = E(); drops = []; for (var i = 0; i < Math.ceil(e.w / size); i++) drops.push(rnd(-e.h / size, 0)); e.c.fillStyle = '#000'; e.c.fillRect(0, 0, e.w, e.h); },
      frame: function (dt) {
        var e = E(), c = e.c;
        acc += dt;
        if (acc < 0.045) return;
        acc = 0;
        c.fillStyle = 'rgba(0,0,0,0.085)'; c.fillRect(0, 0, e.w, e.h);
        c.font = '600 ' + size + 'px monospace';
        for (var i = 0; i < drops.length; i++) {
          if (Math.random() > 0.55 * e.am + 0.25) continue;
          var ch = chars[(Math.random() * chars.length) | 0], x = i * size, y = drops[i] * size;
          c.fillStyle = '#d8ffe9'; c.fillText(ch, x, y);
          c.fillStyle = e.c1 === '#2de2ff' ? '#22ff77' : e.c1;
          c.fillText(chars[(Math.random() * chars.length) | 0], x, y - size);
          drops[i]++;
          if (y > e.h && Math.random() > 0.975) drops[i] = 0;
        }
      }
    };
  },
  network: function (E) {
    var pts = [];
    return {
      init: function () { var e = E(), n = Math.round(Math.min(160, e.w * e.h / 14000) * e.am); pts = []; for (var i = 0; i < n; i++) pts.push({ x: rnd(0, e.w), y: rnd(0, e.h), vx: rnd(-25, 25), vy: rnd(-25, 25) }); },
      frame: function (dt) {
        var e = E(), c = e.c, D2 = 135 * 135;
        c.fillStyle = '#05070d'; c.fillRect(0, 0, e.w, e.h);
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < 0 || p.x > e.w) p.vx *= -1;
          if (p.y < 0 || p.y > e.h) p.vy *= -1;
        }
        c.lineWidth = 1;
        for (i = 0; i < pts.length; i++) {
          var a = pts[i];
          for (var j = i + 1; j < pts.length; j++) {
            var b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
            if (d < D2) { c.strokeStyle = hexA(e.c1, (1 - d / D2) * 0.55); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
          }
          var mx = a.x - e.mouse.x, my = a.y - e.mouse.y, md = mx * mx + my * my;
          if (md < 180 * 180) { c.strokeStyle = hexA(e.c2, (1 - md / 32400) * 0.8); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(e.mouse.x, e.mouse.y); c.stroke(); }
        }
        c.fillStyle = '#ffffff';
        for (i = 0; i < pts.length; i++) { c.beginPath(); c.arc(pts[i].x, pts[i].y, 1.8, 0, 6.283); c.fill(); }
      }
    };
  },
  waves: function (E) {
    return {
      frame: function (dt, t) {
        var e = E(), c = e.c, g = c.createLinearGradient(0, 0, 0, e.h);
        g.addColorStop(0, '#04060f'); g.addColorStop(1, '#0b1030');
        c.fillStyle = g; c.fillRect(0, 0, e.w, e.h);
        c.globalCompositeOperation = 'lighter';
        var layers = Math.round(5 * Math.min(2, e.am));
        for (var L = 0; L < layers; L++) {
          var k = L / Math.max(1, layers - 1), base = e.h * (0.45 + k * 0.4), amp = 30 + 40 * (1 - k);
          c.beginPath(); c.moveTo(0, e.h);
          for (var x = 0; x <= e.w + 20; x += 20) {
            var y = base + Math.sin(x * 0.006 + t * (0.8 + L * 0.25) + L) * amp + Math.sin(x * 0.013 - t * 0.6 + L * 2) * amp * 0.4;
            c.lineTo(x, y);
          }
          c.lineTo(e.w, e.h); c.closePath();
          c.fillStyle = mixA(e.c1, e.c2, k, 0.22);
          c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }
    };
  },
  galaxy: function (E) {
    var parts = [], spr1, spr2;
    return {
      init: function () {
        var e = E(), n = Math.round(2600 * e.am), arms = 4;
        parts = [];
        for (var i = 0; i < n; i++) {
          var r = Math.pow(Math.random(), 0.6), arm = i % arms;
          parts.push({ r: r, a: arm * Math.PI * 2 / arms + r * 5.5 + rnd(-0.35, 0.35) * (1 - r * 0.5), s: rnd(0.6, 1.8), k: Math.random() });
        }
        spr1 = glowSprite(e.c1, 24); spr2 = glowSprite(e.c2, 24);
      },
      frame: function (dt) {
        var e = E(), c = e.c, cx = e.w / 2, cy = e.h / 2, R = Math.min(e.w, e.h) * 0.48;
        c.fillStyle = 'rgba(1,2,8,0.55)'; c.fillRect(0, 0, e.w, e.h);
        c.globalCompositeOperation = 'lighter';
        var core = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.35);
        core.addColorStop(0, 'rgba(255,240,220,0.5)'); core.addColorStop(1, 'rgba(255,200,150,0)');
        c.fillStyle = core; c.fillRect(cx - R, cy - R, R * 2, R * 2);
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.a += dt * 0.25 / (p.r + 0.25);
          var x = cx + Math.cos(p.a) * p.r * R, y = cy + Math.sin(p.a) * p.r * R * 0.62;
          if (p.k < 0.08) c.drawImage(p.k < 0.04 ? spr1 : spr2, x - 6, y - 6, 12, 12);
          else { c.fillStyle = p.k < 0.5 ? 'rgba(255,255,255,0.7)' : hexA(p.k < 0.75 ? e.c1 : e.c2, 0.6); c.fillRect(x, y, p.s, p.s); }
        }
        c.globalCompositeOperation = 'source-over';
      }
    };
  },
  fire: function (E) {
    var ps = [], sprY, sprA, sprB;
    return {
      init: function () { var e = E(); ps = []; sprY = glowSprite('#ffe08a', 64); sprA = glowSprite(e.c1 === '#2de2ff' ? '#ff7a18' : e.c1, 64); sprB = glowSprite(e.c2 === '#ff4fa3' ? '#e5383b' : e.c2, 64); },
      frame: function (dt) {
        var e = E(), c = e.c;
        c.fillStyle = 'rgba(8,2,0,0.35)'; c.fillRect(0, 0, e.w, e.h);
        var spawn = Math.round(e.w / 14 * e.am * dt * 6);
        for (var s = 0; s < spawn && ps.length < 900; s++) ps.push({ x: rnd(0, e.w), y: e.h + 10, vx: rnd(-20, 20), vy: rnd(-260, -120), life: 0, max: rnd(0.8, 2.2), r: rnd(18, 46) });
        c.globalCompositeOperation = 'lighter';
        for (var i = ps.length - 1; i >= 0; i--) {
          var p = ps[i];
          p.life += dt;
          if (p.life > p.max) { ps.splice(i, 1); continue; }
          p.x += (p.vx + Math.sin(p.life * 6 + p.x) * 30) * dt; p.y += p.vy * dt;
          var k = p.life / p.max, r = p.r * (1 - k * 0.7);
          c.globalAlpha = 1 - k;
          c.drawImage(k < 0.3 ? sprY : k < 0.65 ? sprA : sprB, p.x - r, p.y - r, r * 2, r * 2);
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
    };
  },
  aurora: function (E) {
    var stars = [];
    return {
      init: function () { var e = E(); stars = []; for (var i = 0; i < 160; i++) stars.push([rnd(0, e.w), rnd(0, e.h * 0.8), rnd(0.3, 1.4)]); },
      frame: function (dt, t) {
        var e = E(), c = e.c, g = c.createLinearGradient(0, 0, 0, e.h);
        g.addColorStop(0, '#01030a'); g.addColorStop(1, '#06141f');
        c.fillStyle = g; c.fillRect(0, 0, e.w, e.h);
        c.fillStyle = 'rgba(255,255,255,0.7)';
        for (var i = 0; i < stars.length; i++) c.fillRect(stars[i][0], stars[i][1], stars[i][2], stars[i][2]);
        c.globalCompositeOperation = 'lighter';
        var bands = Math.round(4 * Math.min(2, e.am));
        for (var b = 0; b < bands; b++) {
          var col = b % 2 ? e.c2 : e.c1, y0 = e.h * (0.22 + b * 0.09);
          for (var pass = 0; pass < 3; pass++) {
            c.beginPath();
            for (var x = -40; x <= e.w + 40; x += 24) {
              var y = y0 + Math.sin(x * 0.004 + t * 0.35 + b * 1.7) * 60 + Math.sin(x * 0.011 - t * 0.5 + b) * 22;
              if (x === -40) c.moveTo(x, y); else c.lineTo(x, y);
            }
            c.strokeStyle = hexA(col, 0.05 + pass * 0.02);
            c.lineWidth = 120 - pass * 40;
            c.stroke();
          }
        }
        c.globalCompositeOperation = 'source-over';
      }
    };
  },
  synth: function (E) {
    return {
      frame: function (dt, t) {
        var e = E(), c = e.c, hz = e.h * 0.58;
        var sky = c.createLinearGradient(0, 0, 0, hz);
        sky.addColorStop(0, '#0b0221'); sky.addColorStop(0.6, '#2b0a45'); sky.addColorStop(1, '#6a1b5f');
        c.fillStyle = sky; c.fillRect(0, 0, e.w, hz);
        var R = Math.min(e.w, e.h) * 0.2, sx = e.w / 2, sy = hz - R * 0.35;
        var sun = c.createLinearGradient(0, sy - R, 0, sy + R);
        sun.addColorStop(0, '#ffe66d'); sun.addColorStop(0.5, e.c2); sun.addColorStop(1, '#8a2be2');
        c.save(); c.beginPath(); c.arc(sx, sy, R, 0, 6.283); c.clip();
        c.fillStyle = sun; c.fillRect(sx - R, sy - R, R * 2, R * 2);
        c.fillStyle = '#2b0a45';
        for (var k = 0; k < 7; k++) { var by = sy + R * (0.05 + k * 0.14), bh = 2 + k * 2.2; c.fillRect(sx - R, by, R * 2, bh); }
        c.restore();
        c.fillStyle = '#12021f';
        c.beginPath(); c.moveTo(0, hz);
        for (var x = 0; x <= e.w; x += e.w / 16) c.lineTo(x, hz - (Math.abs(Math.sin(x * 0.013) * Math.cos(x * 0.004)) * e.h * 0.12) - 4);
        c.lineTo(e.w, hz); c.fill();
        c.fillStyle = '#07010f'; c.fillRect(0, hz, e.w, e.h - hz);
        c.strokeStyle = e.c1; c.lineWidth = 1.5; c.shadowColor = e.c1; c.shadowBlur = 8;
        var off = (t * 0.6) % 1;
        for (var i = 0; i < 18; i++) {
          var z = (i + off) / 18, y = hz + Math.pow(z, 2.2) * (e.h - hz);
          c.globalAlpha = Math.min(1, z * 2); c.beginPath(); c.moveTo(0, y); c.lineTo(e.w, y); c.stroke();
        }
        c.globalAlpha = 1;
        for (var v = -14; v <= 14; v++) { c.beginPath(); c.moveTo(e.w / 2 + v * 8, hz); c.lineTo(e.w / 2 + v * e.w * 0.12, e.h); c.stroke(); }
        c.shadowBlur = 0;
      }
    };
  },
  lava: function (E) {
    var blobs = [];
    return {
      init: function () { var e = E(); blobs = []; for (var i = 0; i < Math.round(8 * Math.min(2, e.am)); i++) blobs.push({ x: rnd(0.1, 0.9), p: rnd(0, 6.28), s: rnd(0.12, 0.3), r: rnd(0.12, 0.24), k: i % 2 }); },
      frame: function (dt, t) {
        var e = E(), c = e.c;
        c.fillStyle = '#0b0410'; c.fillRect(0, 0, e.w, e.h);
        c.globalCompositeOperation = 'lighter';
        for (var i = 0; i < blobs.length; i++) {
          var b = blobs[i], x = (b.x + Math.sin(t * 0.13 + b.p) * 0.12) * e.w, y = (0.5 + Math.sin(t * b.s + b.p) * 0.42) * e.h, r = b.r * Math.min(e.w, e.h) * (1 + Math.sin(t * 0.5 + i) * 0.15);
          var g = c.createRadialGradient(x, y, 0, x, y, r);
          var col = b.k ? e.c2 : e.c1;
          g.addColorStop(0, hexA(col, 0.85)); g.addColorStop(0.55, hexA(col, 0.35)); g.addColorStop(1, hexA(col, 0));
          c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
        }
        c.globalCompositeOperation = 'source-over';
      }
    };
  },
  glitch: function (E) {
    var noise = D.createElement('canvas'), nc, img, acc = 0;
    noise.width = 160; noise.height = 90;
    nc = noise.getContext('2d'); img = nc.createImageData(160, 90);
    return {
      frame: function (dt, t) {
        var e = E(), c = e.c;
        acc += dt;
        if (acc < 0.05) return;
        acc = 0;
        var d = img.data;
        for (var i = 0; i < d.length; i += 4) { var v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        nc.putImageData(img, 0, 0);
        c.imageSmoothingEnabled = false;
        c.fillStyle = '#050507'; c.fillRect(0, 0, e.w, e.h);
        c.globalAlpha = 0.16 * Math.min(2, e.am); c.drawImage(noise, 0, 0, e.w, e.h); c.globalAlpha = 1;
        var bars = 3 + ((Math.random() * 6) | 0);
        for (var b = 0; b < bars; b++) {
          var y = rnd(0, e.h), hh = rnd(4, 40);
          c.fillStyle = hexA(Math.random() < 0.5 ? e.c1 : e.c2, rnd(0.08, 0.35));
          c.fillRect(rnd(-40, 40), y, e.w, hh);
        }
        c.fillStyle = 'rgba(0,0,0,0.25)';
        for (var s = 0; s < e.h; s += 3) c.fillRect(0, s, e.w, 1);
      }
    };
  },
  bubbles: function (E) {
    var bs = [];
    return {
      init: function () { var e = E(); bs = []; for (var i = 0; i < Math.round(60 * e.am); i++) bs.push(nb(e, true)); },
      frame: function (dt, t) {
        var e = E(), c = e.c, g = c.createLinearGradient(0, 0, 0, e.h);
        g.addColorStop(0, '#031a2b'); g.addColorStop(1, '#062f45');
        c.fillStyle = g; c.fillRect(0, 0, e.w, e.h);
        for (var i = 0; i < bs.length; i++) {
          var b = bs[i];
          b.y -= b.v * dt; b.x += Math.sin(t * 1.3 + b.p) * 18 * dt;
          if (b.y < -b.r) bs[i] = b = nb(e, false);
          c.beginPath(); c.arc(b.x, b.y, b.r, 0, 6.283);
          c.fillStyle = hexA(b.k ? e.c1 : e.c2, 0.08); c.fill();
          c.strokeStyle = hexA(b.k ? e.c1 : e.c2, 0.55); c.lineWidth = 1.5; c.stroke();
          c.beginPath(); c.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, 6.283); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
        }
      }
    };
    function nb(e, any) { var r = rnd(6, 38); return { x: rnd(0, e.w), y: any ? rnd(0, e.h) : e.h + r, r: r, v: rnd(25, 90), p: rnd(0, 6), k: Math.random() < 0.5 }; }
  },
  flow: function (E) {
    return {
      frame: function (dt, t) {
        var e = E(), c = e.c, a = t * 12;
        var g = c.createLinearGradient(0, 0, e.w, e.h);
        g.addColorStop(0, 'hsl(' + (a % 360) + ',80%,45%)');
        g.addColorStop(0.5, 'hsl(' + ((a + 90) % 360) + ',80%,40%)');
        g.addColorStop(1, 'hsl(' + ((a + 200) % 360) + ',80%,35%)');
        c.fillStyle = g; c.fillRect(0, 0, e.w, e.h);
      }
    };
  }
};

// ======================= the BACKGROUND tab =======================
function renderBg() {
  var b = curBg(), body = bodyEl;
  body.appendChild(sec('Background',
    h('div', { class: 'grid' },
      [['none', 'Site\'s own'], ['color', 'Color'], ['gradient', 'Gradient'], ['image', 'Picture / GIF'], ['video', 'Video'], ['anim', 'Animated']].map(function (m) {
        return btn(m[1], function () {
          if (m[0] === 'image' && !b.img.src) return chooseBgPicture();
          if (m[0] === 'video' && !b.vid.src) return chooseBgVideo();
          setBg({ mode: m[0] }, 'Background: ' + m[1]);
        }, b.mode === m[0] ? 'on' : '');
      }))));

  if (b.mode === 'color') {
    body.appendChild(sec('Color', row('Pick a color', colorIn(b.color, function (v) { setBg({ color: v }, 'Background color', 'bgcolor'); })),
      swatches(SWATCHES, function (v) { setBg({ color: v }, 'Background color'); })));
  }
  if (b.mode === 'gradient') {
    var g = b.grad;
    var colorRow = h('div', { class: 'flex' });
    g.c.forEach(function (col, i) {
      colorRow.appendChild(colorIn(col, function (v) { var ng = copy(g); ng.c[i] = v; setBg({ grad: ng }, 'Gradient color', 'gc' + i); }));
    });
    if (g.c.length < 5) colorRow.appendChild(btn('', function () { var ng = copy(g); ng.c.push(ng.c[ng.c.length - 1]); setBg({ grad: ng }, 'Add gradient color'); }, 'sm', 'Add a color', 'plus'));
    if (g.c.length > 2) colorRow.appendChild(btn('', function () { var ng = copy(g); ng.c.pop(); setBg({ grad: ng }, 'Remove gradient color'); }, 'sm', 'Remove a color', 'min'));
    body.appendChild(sec('Gradient',
      row('Style', h('div', { class: 'grow' }, seg([['linear', 'Straight'], ['radial', 'Circle'], ['conic', 'Spin']], g.type, function (v) { var ng = copy(g); ng.type = v; setBg({ grad: ng }, 'Gradient style'); }))),
      row('Colors', colorRow),
      row('Angle', slider(0, 360, 1, g.angle, function (v) { return v + '\u00b0'; }, function (v) { var ng = copy(curBg().grad); ng.angle = v; setBg({ grad: ng }, 'Gradient angle', 'gangle'); })),
      row('Moving', btn(g.move ? 'Moving: ON' : 'Moving: OFF', function () { var ng = copy(g); ng.move = !ng.move; setBg({ grad: ng }, 'Gradient moving'); }, g.move ? 'on sm' : 'sm')),
      h('div', { class: 'grid g4 mt' }, GRAD_PRESETS.map(function (p) {
        var bt = btn(p[0], function () { setBg({ grad: { type: 'linear', angle: p[2], c: p[1].slice(), move: g.move } }, 'Gradient: ' + p[0]); }, 'sm');
        css(bt, { 'background-image': 'linear-gradient(' + p[2] + 'deg,' + p[1].join(',') + ')', color: '#fff', 'text-shadow': '0 1px 2px #000', 'border-color': 'rgba(255,255,255,.15)' });
        return bt;
      }))));
  }
  if (b.mode === 'image') {
    body.appendChild(sec('Picture',
      h('div', { class: 'grid g2' }, btn('Upload picture / GIF', chooseBgPicture, 'pri', null, 'upload'), linkInput('Paste a picture link + Enter', function (v) { setBg({ mode: 'image', img: { src: v, fit: b.img.fit } }, 'Background picture'); })),
      row('Fit', h('div', { class: 'grow' }, seg([['cover', 'Fill'], ['contain', 'Fit'], ['tile', 'Tile'], ['stretch', 'Stretch']], b.img.fit, function (v) { setBg({ img: { src: b.img.src, fit: v } }, 'Picture fit'); })))));
  }
  if (b.mode === 'video') {
    body.appendChild(sec('Video',
      h('div', { class: 'grid g2' }, btn('Upload video', chooseBgVideo, 'pri', null, 'upload'), linkInput('Paste a video link (.mp4) + Enter', function (v) { setBg({ mode: 'video', vid: { src: v, fit: b.vid.fit } }, 'Background video'); })),
      row('Fit', h('div', { class: 'grow' }, seg([['cover', 'Fill'], ['contain', 'Fit']], b.vid.fit, function (v) { setBg({ vid: { src: b.vid.src, fit: v } }, 'Video fit'); }))),
      h('div', { class: 'note', text: 'Videos play muted and loop forever.' })));
  }
  if (b.mode === 'anim') {
    var a = b.anim;
    body.appendChild(sec('Animated',
      h('div', { class: 'grid' }, ANIMS.map(function (an) {
        return h('button', { class: 'btn tile' + (a.name === an[0] ? ' on' : ''), onclick: function () { var na = copy(a); na.name = an[0]; setBg({ anim: na }, 'Animated: ' + an[1]); } }, h('b', { text: an[1] }), h('small', { text: an[2] }));
      })),
      row('Color 1', colorIn(a.c1, function (v) { var na = copy(curBg().anim); na.c1 = v; setBg({ anim: na }, 'Animation color', 'ac1'); })),
      row('Color 2', colorIn(a.c2, function (v) { var na = copy(curBg().anim); na.c2 = v; setBg({ anim: na }, 'Animation color', 'ac2'); })),
      row('Speed', slider(0.2, 3, 0.1, a.speed, function (v) { return v.toFixed(1) + 'x'; }, function (v) { var na = copy(curBg().anim); na.speed = v; setBg({ anim: na }, 'Animation speed', 'asp'); })),
      row('Amount', slider(0.3, 2.5, 0.1, a.amount, function (v) { return v.toFixed(1) + 'x'; }, function (v) { var na = copy(curBg().anim); na.amount = v; setBg({ anim: na }, 'Animation amount', 'aam'); }))));
  }
  if (b.mode !== 'none') {
    body.appendChild(sec('Make it readable',
      row('Darken', slider(0, 90, 1, b.dim || 0, function (v) { return v + '%'; }, function (v) { setBg({ dim: v }, 'Darken background', 'dim'); })),
      row('Blur', slider(0, 30, 1, b.blur || 0, function (v) { return v + 'px'; }, function (v) { setBg({ blur: v }, 'Blur background', 'blur'); })),
      row('See-through', slider(0, 100, 1, b.see == null ? 85 : b.see, function (v) { return v + '%'; }, function (v) { setBg({ see: v }, 'See-through boxes', 'see'); })),
      row('Text glow', btn(haloOn(b) ? 'Glow behind text: ON' : 'Glow behind text: OFF', function () { setBg({ halo: !haloOn(b) }, 'Glow behind text'); }, haloOn(b) ? 'on sm' : 'sm', 'A soft light glow behind words so dark text is readable on dark backgrounds')),
      h('div', { class: 'note', text: 'See-through = how much the site\'s own big boxes fade so your background shows. Lower it if text gets hard to read.' })));
  } else {
    body.appendChild(h('div', { class: 'help', text: 'Pick a type above to put your own background behind the whole website. The site\'s own colors fade away so yours shows through.' }));
  }
}
function linkInput(ph, onEnter) {
  var i = h('input', { class: 'in', placeholder: ph });
  i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && i.value.trim()) onEnter(i.value.trim()); });
  return i;
}
function chooseBgPicture() {
  chooseFile('image/*', function (f) {
    toast('Loading picture\u2026');
    readImage(f, 2400).then(function (src) { setBg({ mode: 'image', img: { src: src, fit: curBg().img.fit || 'cover' }, dim: curBg().dim || 20 }, 'Background picture'); });
  });
}
function chooseBgVideo() {
  chooseFile('video/*', function (f) {
    if (f.size > 60e6) {
      toast('That video is over 60 MB, it works now but won\'t be saved. Try a shorter clip to keep it.', 'bad', 6000);
      setBg({ mode: 'video', vid: { src: URL.createObjectURL(f), fit: 'cover' }, dim: curBg().dim || 25 }, 'Background video');
      return;
    }
    toast('Loading video\u2026');
    readFile(f).then(function (src) { setBg({ mode: 'video', vid: { src: src, fit: curBg().vid.fit || 'cover' }, dim: curBg().dim || 25 }, 'Background video'); });
  });
}
