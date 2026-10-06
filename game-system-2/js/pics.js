/* Game System 2.0 — the picture maker for game covers.
   AI pictures (free Pollinations service, 18+ blocked), neon letter art, icon art, pattern art,
   your own picture, or an emoji. Everything except the AI picture is drawn right here on a canvas. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;
  var W = 960;
  var H = 600;

  var GAME_ICONS = ['gamepad', 'car', 'sword', 'rocket', 'skull', 'crown', 'ghost', 'target', 'dice', 'cards', 'slots', 'coin',
    'gem', 'castle', 'tree', 'planet', 'heart', 'bomb', 'ball', 'plane', 'fish', 'paw', 'spiral', 'brick', 'trophy', 'flame',
    'bolt', 'star', 'shield', 'music', 'globe', 'key', 'home', 'user', 'camera', 'palette', 'moon', 'sparkle', 'code'];

  var ICON_RULES = [
    [/casino|gambl|slot|jackpot|lucky|bet/, 'slots'], [/poker|blackjack|card/, 'cards'], [/dice|roll/, 'dice'],
    [/portal/, 'spiral'], [/race|racing|car|drift|kart|drive/, 'car'], [/zombie|horror|ghost|haunt|scary/, 'ghost'],
    [/skull|dead|death|kill/, 'skull'], [/sword|knight|ninja|samurai|fight|battle/, 'sword'], [/gun|shoot|sniper|fps|war|aim/, 'target'],
    [/space|rocket|galaxy|alien|asteroid/, 'rocket'], [/planet|world|universe/, 'planet'], [/king|queen|royal|empire/, 'crown'],
    [/castle|tower|defen|kingdom/, 'castle'], [/craft|mine|block|build|brick|sandbox/, 'brick'], [/forest|tree|farm|garden/, 'tree'],
    [/money|coin|rich|bank|tycoon|cash/, 'coin'], [/gem|diamond|crystal/, 'gem'], [/bomb|boom|explo/, 'bomb'],
    [/ball|soccer|football|basket|golf|pong/, 'ball'], [/plane|fly|flight|jet/, 'plane'], [/fish|ocean|sea/, 'fish'],
    [/dog|cat|pet|animal/, 'paw'], [/love|heart|date/, 'heart'], [/music|rhythm|beat|dance|piano/, 'music'],
    [/fire|flame|hot/, 'flame'], [/clicker|idle|cookie/, 'target']
  ];
  function guessIcon(name) {
    var n = String(name || '').toLowerCase();
    for (var i = 0; i < ICON_RULES.length; i++) if (ICON_RULES[i][0].test(n)) return ICON_RULES[i][1];
    return 'gamepad';
  }

  var SWATCHES = ['#00e5ff', '#ff2bd6', '#3dffa0', '#ffcc00', '#b26bff', '#ff6a00', '#ff3d6e', '#5c8dff'];

  /* ---------------- drawing helpers ---------------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function partner(hex) {
    var rgb = U.hexToRgb(hex).map(function (v) { return v / 255; });
    var max = Math.max.apply(null, rgb), min = Math.min.apply(null, rgb), d = max - min, hh = 0;
    if (d) {
      if (max === rgb[0]) hh = ((rgb[1] - rgb[2]) / d) % 6;
      else if (max === rgb[1]) hh = (rgb[2] - rgb[0]) / d + 2;
      else hh = (rgb[0] - rgb[1]) / d + 4;
    }
    return U.hslToHex((hh * 60 + 140 + 360) % 360, 90, 60);
  }
  function rgba(hex, a) { var c = U.hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function newCanvas() {
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  }

  function background(x, a, b) {
    x.fillStyle = '#06070d';
    x.fillRect(0, 0, W, H);
    var g1 = x.createRadialGradient(W * 0.28, H * 0.22, 0, W * 0.28, H * 0.22, W * 0.7);
    g1.addColorStop(0, rgba(a, 0.55));
    g1.addColorStop(1, rgba(a, 0));
    x.fillStyle = g1;
    x.fillRect(0, 0, W, H);
    var g2 = x.createRadialGradient(W * 0.85, H * 0.95, 0, W * 0.85, H * 0.95, W * 0.6);
    g2.addColorStop(0, rgba(b, 0.5));
    g2.addColorStop(1, rgba(b, 0));
    x.fillStyle = g2;
    x.fillRect(0, 0, W, H);
  }
  function floorGrid(x, a) {
    var hz = H * 0.72;
    x.save();
    x.strokeStyle = rgba(a, 0.35);
    x.lineWidth = 1.5;
    for (var i = -12; i <= 12; i++) {
      x.beginPath();
      x.moveTo(W / 2 + i * 22, hz);
      x.lineTo(W / 2 + i * 140, H);
      x.stroke();
    }
    for (var j = 0; j < 9; j++) {
      var y = hz + Math.pow(j / 8, 2) * (H - hz);
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(W, y);
      x.stroke();
    }
    var hl = x.createLinearGradient(0, hz - 30, 0, hz + 30);
    hl.addColorStop(0, rgba(a, 0));
    hl.addColorStop(0.5, rgba(a, 0.45));
    hl.addColorStop(1, rgba(a, 0));
    x.fillStyle = hl;
    x.fillRect(0, hz - 30, W, 60);
    x.restore();
  }
  function stripes(x) {
    x.save();
    x.strokeStyle = 'rgba(255,255,255,0.04)';
    x.lineWidth = 3;
    for (var i = -H; i < W; i += 26) {
      x.beginPath();
      x.moveTo(i, H);
      x.lineTo(i + H * 0.6, 0);
      x.stroke();
    }
    x.restore();
  }
  function vignette(x) {
    var g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }
  function nameText(x, name, a) {
    x.save();
    x.font = '900 ' + Math.round(H * 0.075) + 'px Orbitron, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    if ('letterSpacing' in x) x.letterSpacing = '6px';
    var text = String(name).toUpperCase();
    while (x.measureText(text).width > W * 0.9 && text.length > 4) text = text.slice(0, -2) + '…';
    x.shadowColor = a;
    x.shadowBlur = 24;
    x.fillStyle = '#ffffff';
    x.fillText(text, W / 2, H * 0.92);
    x.restore();
  }
  async function fontsReady() {
    if (!document.fonts || !document.fonts.load) return;
    try { await Promise.all([document.fonts.load('900 200px Orbitron'), document.fonts.load('900 40px Orbitron')]); } catch (e) { /* use fallback font */ }
  }

  /* ---------------- the three art styles ---------------- */
  async function letterArt(g, o) {
    await fontsReady();
    var c = newCanvas();
    var x = c.getContext('2d');
    var a = o.color, b = partner(a);
    background(x, a, b);
    stripes(x);
    floorGrid(x, a);
    var text = UI.initials(g.name);
    var size = Math.round(H * (text.length > 1 ? 0.42 : 0.55));
    x.save();
    x.font = '900 ' + size + 'px Orbitron, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    var cy = o.showName ? H * 0.44 : H * 0.5;
    var grad = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, a);
    grad.addColorStop(1, b);
    x.shadowColor = a;
    x.shadowBlur = 60;
    x.fillStyle = grad;
    x.fillText(text, W / 2, cy);
    x.shadowBlur = 20;
    x.fillText(text, W / 2, cy);
    x.shadowBlur = 0;
    x.lineWidth = 3;
    x.strokeStyle = 'rgba(255,255,255,0.65)';
    x.strokeText(text, W / 2, cy);
    x.restore();
    vignette(x);
    if (o.showName) nameText(x, g.name, a);
    return c;
  }

  function iconImage(name, color) {
    return new Promise(function (resolve, reject) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="480" height="480" fill="none" stroke="' + color +
        '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + UI.iconMarkup(name).replace(/currentColor/g, color) + '</svg>';
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  async function iconArt(g, o) {
    await fontsReady();
    var c = newCanvas();
    var x = c.getContext('2d');
    var a = o.color, b = partner(a);
    background(x, a, b);
    stripes(x);
    var cx = W / 2, cy = o.showName ? H * 0.43 : H * 0.5;
    x.save();
    for (var r = 1; r <= 3; r++) {
      x.beginPath();
      x.arc(cx, cy, H * (0.16 + r * 0.09), 0, Math.PI * 2);
      x.strokeStyle = rgba(r % 2 ? a : b, 0.28 - r * 0.05);
      x.lineWidth = 2;
      x.stroke();
    }
    var glow = x.createRadialGradient(cx, cy, 0, cx, cy, H * 0.4);
    glow.addColorStop(0, rgba(a, 0.35));
    glow.addColorStop(1, rgba(a, 0));
    x.fillStyle = glow;
    x.fillRect(0, 0, W, H);
    x.restore();
    var img = await iconImage(o.icon, '#ffffff');
    var s = H * 0.46;
    x.save();
    x.shadowColor = a;
    x.shadowBlur = 40;
    x.drawImage(img, cx - s / 2, cy - s / 2, s, s);
    x.shadowBlur = 14;
    x.drawImage(img, cx - s / 2, cy - s / 2, s, s);
    x.restore();
    vignette(x);
    if (o.showName) nameText(x, g.name, a);
    return c;
  }

  var PATTERNS = ['triangles', 'waves', 'hex', 'circles', 'grid', 'stars', 'stripes'];
  async function patternArt(g, o) {
    await fontsReady();
    var c = newCanvas();
    var x = c.getContext('2d');
    var a = o.color, b = partner(a);
    var r = rng(o.seed);
    var kind = o.pattern;
    x.fillStyle = '#06070d';
    x.fillRect(0, 0, W, H);
    function mix(t) {
      var ca = U.hexToRgb(a), cb = U.hexToRgb(b);
      return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(ca[i] + (cb[i] - ca[i]) * t); }).join(',') + ')';
    }
    if (kind === 'triangles') {
      var cols = 9, rows = 6, pts = [];
      for (var yy = 0; yy <= rows; yy++) {
        pts.push([]);
        for (var xx = 0; xx <= cols; xx++) {
          var jx = (xx > 0 && xx < cols) ? (r() - 0.5) * W / cols * 0.7 : 0;
          var jy = (yy > 0 && yy < rows) ? (r() - 0.5) * H / rows * 0.7 : 0;
          pts[yy].push([xx * W / cols + jx, yy * H / rows + jy]);
        }
      }
      for (var ty = 0; ty < rows; ty++) {
        for (var tx = 0; tx < cols; tx++) {
          var p1 = pts[ty][tx], p2 = pts[ty][tx + 1], p3 = pts[ty + 1][tx], p4 = pts[ty + 1][tx + 1];
          [[p1, p2, p3], [p2, p4, p3]].forEach(function (tri, k) {
            x.beginPath();
            x.moveTo(tri[0][0], tri[0][1]);
            x.lineTo(tri[1][0], tri[1][1]);
            x.lineTo(tri[2][0], tri[2][1]);
            x.closePath();
            var t = (tx + ty) / (cols + rows) + (r() - 0.5) * 0.25;
            x.globalAlpha = 0.25 + r() * 0.6 + k * 0.05;
            x.fillStyle = mix(Math.max(0, Math.min(1, t)));
            x.fill();
            x.globalAlpha = 0.5;
            x.strokeStyle = '#06070d';
            x.lineWidth = 2;
            x.stroke();
          });
        }
      }
      x.globalAlpha = 1;
    } else if (kind === 'waves') {
      background(x, a, b);
      for (var w = 0; w < 14; w++) {
        x.beginPath();
        var amp = 20 + r() * 50, freq = 0.004 + r() * 0.01, ph = r() * 10, base = H * (0.15 + w * 0.055);
        for (var px = 0; px <= W; px += 8) x.lineTo(px, base + Math.sin(px * freq + ph) * amp);
        x.strokeStyle = mix(w / 13);
        x.globalAlpha = 0.35 + r() * 0.5;
        x.lineWidth = 2 + r() * 6;
        x.stroke();
      }
      x.globalAlpha = 1;
    } else if (kind === 'hex') {
      background(x, a, b);
      var R = 44, hw = Math.sqrt(3) * R;
      for (var hy = -1; hy < H / (R * 1.5) + 1; hy++) {
        for (var hx = -1; hx < W / hw + 1; hx++) {
          var hcx = hx * hw + (hy % 2 ? hw / 2 : 0), hcy = hy * R * 1.5;
          x.beginPath();
          for (var s = 0; s < 6; s++) {
            var ang = Math.PI / 3 * s + Math.PI / 6;
            x.lineTo(hcx + R * 0.92 * Math.cos(ang), hcy + R * 0.92 * Math.sin(ang));
          }
          x.closePath();
          var on = r();
          if (on > 0.72) { x.fillStyle = mix(r()); x.globalAlpha = 0.35 + r() * 0.5; x.fill(); }
          x.globalAlpha = 0.35;
          x.strokeStyle = mix(hcx / W);
          x.lineWidth = 2;
          x.stroke();
        }
      }
      x.globalAlpha = 1;
    } else if (kind === 'circles') {
      background(x, a, b);
      for (var ci = 0; ci < 26; ci++) {
        x.beginPath();
        x.arc(r() * W, r() * H, 20 + r() * 160, 0, Math.PI * 2);
        if (r() > 0.5) { x.fillStyle = mix(r()); x.globalAlpha = 0.08 + r() * 0.25; x.fill(); }
        else { x.strokeStyle = mix(r()); x.globalAlpha = 0.3 + r() * 0.5; x.lineWidth = 2 + r() * 8; x.stroke(); }
      }
      x.globalAlpha = 1;
    } else if (kind === 'grid') {
      background(x, a, b);
      var hz = H * 0.62;
      var sun = x.createLinearGradient(0, hz - H * 0.42, 0, hz);
      sun.addColorStop(0, b);
      sun.addColorStop(1, a);
      x.save();
      x.beginPath();
      x.arc(W / 2, hz, H * 0.32, Math.PI, 0);
      x.fillStyle = sun;
      x.shadowColor = a;
      x.shadowBlur = 60;
      x.fill();
      x.restore();
      x.fillStyle = '#06070d';
      for (var sb = 0; sb < 6; sb++) x.fillRect(W / 2 - H * 0.33, hz - 10 - sb * 22, H * 0.66, 4 + sb * 1.5);
      x.fillRect(0, hz, W, H - hz);
      x.save();
      x.translate(0, hz - H * 0.72);
      floorGrid(x, a);
      x.restore();
    } else if (kind === 'stars') {
      background(x, a, b);
      for (var st = 0; st < 380; st++) {
        var sr = r() < 0.92 ? r() * 1.6 : 1.6 + r() * 2.5;
        x.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7) + ')';
        x.beginPath();
        x.arc(r() * W, r() * H, sr, 0, Math.PI * 2);
        x.fill();
      }
      for (var nb = 0; nb < 5; nb++) {
        var nx = r() * W, ny = r() * H, nr = 120 + r() * 220;
        var ng = x.createRadialGradient(nx, ny, 0, nx, ny, nr);
        ng.addColorStop(0, rgba(r() > 0.5 ? a : b, 0.28));
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = ng;
        x.fillRect(0, 0, W, H);
      }
    } else {
      background(x, a, b);
      x.save();
      x.translate(W / 2, H / 2);
      x.rotate(-0.5 + r());
      for (var sp = -W; sp < W; sp += 40 + r() * 60) {
        x.fillStyle = mix(r());
        x.globalAlpha = 0.15 + r() * 0.5;
        x.fillRect(sp, -W, 12 + r() * 50, W * 2);
      }
      x.restore();
      x.globalAlpha = 1;
    }
    vignette(x);
    if (o.showName) nameText(x, g.name, a);
    return c;
  }

  function canvasBlob(c) {
    return new Promise(function (resolve) { c.toBlob(function (b) { resolve(b); }, 'image/jpeg', 0.9); });
  }

  /* ---------------- AI pictures ---------------- */
  var STYLES = [
    { key: 'cover', label: 'Game cover art', prompt: 'epic video game cover art, dramatic lighting, dynamic composition, highly detailed, vibrant colors' },
    { key: 'pixel', label: 'Pixel art', prompt: '16-bit pixel art video game scene, retro, crisp pixels, vibrant palette' },
    { key: 'cartoon', label: '3D cartoon', prompt: '3D cartoon render, animated movie style, colorful, soft lighting, cute and polished' },
    { key: 'real', label: 'Realistic', prompt: 'photorealistic, cinematic, realistic lighting, highly detailed, sharp focus' }
  ];
  /* Words that would make an 18+ picture. Pollinations' own safe filter is on too. */
  var BLOCK = /\b(nude|nudes|nudity|naked|nsfw|sex|sexy|sexual|porn\w*|hentai|xxx|erotic\w*|lewd|boob\w*|breast\w*|nipple\w*|genital\w*|penis|vagina|butt\s*naked|topless|bottomless|lingerie|bikini|underwear|panties|thong|strip(per|ping|club)?|onlyfans|fetish\w*|bdsm|bondage|orgy|horny|seductive|sensual|playboy|milf|gore|gory|dismember\w*|decapitat\w*|beheading|torture|mutilat\w*|disembowel\w*)\b/i;
  var COOLDOWN = 16000;
  var lastAi = 0;

  function aiUrl(prompt, styleKey, seed) {
    var st = STYLES.find(function (s) { return s.key === styleKey; }) || STYLES[0];
    var full = st.prompt + ', ' + prompt.trim() + ', no text, no words, no letters, family friendly';
    return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(full) +
      '?width=' + W + '&height=' + H + '&seed=' + seed + '&nologo=true&safe=true&model=flux';
  }

  async function fetchImage(url) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, 100000);
    try {
      var r = await fetch(url, { signal: ctl.signal, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (r.status === 429) throw new Error('busy');
      if (!r.ok) throw new Error('status ' + r.status);
      var blob = await r.blob();
      if (!/^image\//.test(blob.type) || blob.size < 2000) throw new Error('not a picture');
      return blob;
    } finally {
      clearTimeout(t);
    }
  }

  /* ---------------- the picture maker window ---------------- */
  async function open(id, startTab) {
    var g = D.get(id);
    if (!g) return;
    var state = {
      tab: startTab || 'ai',
      color: /^#[0-9a-f]{6}$/i.test(g.color || '') ? g.color : U.colorFor(g.name),
      icon: guessIcon(g.name + ' ' + (g.desc || '')),
      pattern: PATTERNS[U.hashStr(g.name) % PATTERNS.length],
      seed: U.hashStr(g.name),
      showName: true,
      style: 'cover',
      result: null, /* {blob} or {canvas} */
      aiResult: null,
      uploadResult: null
    };
    var preview = h('div.pic-preview', h('div.pic-empty', 'Your picture shows up here'));
    var opts = h('div.pic-opts');
    var useBtn;
    var tabs = h('div.seg.pic-tabs');
    [['ai', 'sparkle', 'AI picture'], ['letter', 'text', 'Neon letters'], ['icon', 'star', 'Icon'], ['pattern', 'palette', 'Pattern'],
      ['upload', 'upload', 'My picture'], ['emoji', 'smile', 'Emoji']].forEach(function (t) {
      tabs.appendChild(h('button' + (t[0] === state.tab ? '.on' : ''), { 'data-tab': t[0], onclick: function () { setTab(t[0]); } }, I(t[1]), t[2]));
    });

    var m = UI.modal({
      title: 'Game picture',
      icon: 'image',
      xwide: true,
      body: h('div.pic-maker', tabs, h('div.pic-grid', preview, opts)),
      actions: [
        g.cover ? { label: 'Remove picture', icon: 'trash', kind: 'ghost', onClick: async function () { await D.updateGame(id, { cover: null }); UI.toast('Picture removed.', { sound: false }); } } : null,
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Use this picture', icon: 'check', kind: 'primary', id: 'pic-use', onClick: function () { return use(); } }
      ]
    });
    useBtn = m.el.querySelector('#pic-use');

    function setTab(t) {
      state.tab = t;
      if (t === 'ai') setResult(state.aiResult);
      else if (t === 'upload') setResult(state.uploadResult);
      render();
    }

    function setResult(res) {
      state.result = res;
      useBtn.disabled = !res;
      preview.replaceChildren();
      if (!res) { preview.appendChild(h('div.pic-empty', 'Your picture shows up here')); return; }
      if (res.canvas) preview.appendChild(res.canvas);
      else if (res.blob) {
        var u = URL.createObjectURL(res.blob);
        var img = h('img', { src: u, alt: 'Picture preview' });
        img.onload = function () { setTimeout(function () { URL.revokeObjectURL(u); }, 1000); };
        preview.appendChild(img);
      }
    }

    function swatches() {
      return h('div.swatches', SWATCHES.concat(SWATCHES.indexOf(state.color) < 0 ? [state.color] : []).map(function (c) {
        return h('button.swatch' + (c === state.color ? '.on' : ''), { title: c, 'aria-label': 'Color ' + c, style: { background: 'linear-gradient(135deg,' + c + ',' + partner(c) + ')' }, onclick: function () { state.color = c; render(); } });
      }));
    }
    function nameToggle() {
      return h('label.check-row.small',
        h('input', { type: 'checkbox', checked: state.showName, onchange: function (e) { state.showName = e.target.checked; render(); } }),
        'Show the game\'s name on the picture');
    }

    var renderSeq = 0;
    async function render() {
      var t = state.tab;
      var seq = ++renderSeq;
      /* a drawn picture is only shown (and usable) once it's finished, and only if it's still the newest one */
      function show(canvasPromise) {
        setResult(null);
        return canvasPromise.then(function (c) { if (seq === renderSeq) setResult({ canvas: c }); });
      }
      tabs.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
      if (t === 'letter') {
        opts.replaceChildren(h('p.muted', 'Big glowing letters from the game\'s name.'), h('div.label', 'Color'), swatches(), nameToggle());
        await show(letterArt(g, state));
      } else if (t === 'icon') {
        var grid = h('div.icon-grid', GAME_ICONS.map(function (n) {
          return h('button' + (n === state.icon ? '.on' : ''), { title: n, 'aria-label': n, onclick: function () { state.icon = n; render(); } }, I(n));
        }));
        opts.replaceChildren(h('div.label', 'Icon'), grid, h('div.label', 'Color'), swatches(), nameToggle());
        await show(iconArt(g, state));
      } else if (t === 'pattern') {
        var pseg = h('div.seg', PATTERNS.map(function (p) {
          return h('button' + (p === state.pattern ? '.on' : ''), { onclick: function () { state.pattern = p; render(); } }, p.charAt(0).toUpperCase() + p.slice(1));
        }));
        opts.replaceChildren(h('div.label', 'Pattern'), pseg,
          h('button.btn.sm', { style: { marginTop: '10px' }, onclick: function () { state.seed = (Math.random() * 1e9) | 0; render(); } }, I('reload'), 'Shuffle'),
          h('div.label', 'Color'), swatches(), nameToggle());
        await show(patternArt(g, state));
      } else if (t === 'upload') {
        opts.replaceChildren(h('p.muted', 'Use any picture from your PC or phone.'),
          h('button.btn.primary', { onclick: pickFile }, I('upload'), 'Pick a picture'),
          h('p.small.muted', { style: { marginTop: '14px' } }, 'Tip: while playing, the quick menu has "Use screenshot as cover" too.'));
        setResult(state.uploadResult);
      } else if (t === 'emoji') {
        opts.replaceChildren(h('p.muted', 'Use an emoji as the game\'s picture (on its glowing background).'),
          h('button.btn.primary', { onclick: async function () {
            var e = await UI.pickEmoji(g.emoji);
            if (!e) return;
            await D.updateGame(id, { emoji: e, art: 'emoji', cover: null });
            UI.toast('Emoji picture set.', { type: 'good', sound: false });
            m.close();
          } }, I('smile'), 'Pick an emoji'));
        setResult(null);
      } else {
        renderAi();
      }
    }

    function pickFile() {
      var input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      document.body.appendChild(input);
      input.addEventListener('change', function () {
        var f = input.files[0];
        input.remove();
        if (f) { state.uploadResult = { blob: f, upload: true }; setResult(state.uploadResult); }
      });
      input.click();
    }

    var aiPrompt = (g.name + (g.desc ? ', ' + g.desc : '')).slice(0, 300);
    function renderAi() {
      var input = h('textarea.input', { rows: 3, maxlength: 400, placeholder: 'What should the picture show? For example: a neon casino at night with slot machines' });
      input.value = aiPrompt;
      input.addEventListener('input', function () { aiPrompt = input.value; });
      var styleSeg = h('div.seg', STYLES.map(function (s) {
        return h('button' + (s.key === state.style ? '.on' : ''), { onclick: function () { state.style = s.key; renderAi(); } }, s.label);
      }));
      var genBtn = h('button.btn.primary', { onclick: generate }, I('sparkle'), 'Make picture');
      var note = h('div.small.muted.ai-note');
      opts.replaceChildren(h('div.label', 'Describe the picture'), input, h('div.label', 'Style'), styleSeg,
        h('div.row', { style: { marginTop: '12px' } }, genBtn), note,
        h('p.small.dim', { style: { marginTop: '12px' } }, 'Made by the free Pollinations picture AI. No 18+ pictures. What you type is sent to their website.'));
      tickCooldown(genBtn);

      async function generate() {
        var p = input.value.trim();
        if (p.length < 3) { UI.toast('Describe the picture first.', { type: 'warn' }); return; }
        if (BLOCK.test(p)) {
          note.textContent = 'That can\'t be made here (no 18+ stuff). Try describing something else.';
          note.style.color = 'var(--bad)';
          Sound.error();
          return;
        }
        var wait = COOLDOWN - (Date.now() - lastAi);
        if (wait > 0) { note.textContent = 'The free AI allows one picture every 15 seconds. Wait ' + Math.ceil(wait / 1000) + 's.'; return; }
        lastAi = Date.now();
        note.style.color = '';
        note.textContent = 'Making your picture… this can take up to a minute.';
        genBtn.disabled = true;
        preview.replaceChildren(h('div.pic-empty', h('div.spinner'), h('div', 'The AI is drawing…')));
        useBtn.disabled = true;
        state.seed = (Math.random() * 1e9) | 0;
        try {
          var blob = await fetchImage(aiUrl(p, state.style, state.seed));
          state.aiResult = { blob: blob, ai: true };
          setResult(state.aiResult);
          note.textContent = 'Like it? Hit "Use this picture". Don\'t like it? Make another one.';
          Sound.good();
        } catch (err) {
          setResult(state.aiResult);
          note.style.color = 'var(--warn)';
          note.textContent = err && err.message === 'busy'
            ? 'The picture AI is busy right now. Wait a bit and try again.'
            : 'The picture AI didn\'t answer (' + (err && err.name === 'AbortError' ? 'it took too long' : 'it might be down or blocked') + '). Try again in a minute, or use another style tab.';
        }
        genBtn.disabled = false;
        tickCooldown(genBtn);
      }
    }
    function tickCooldown(btn) {
      var left = COOLDOWN - (Date.now() - lastAi);
      if (left <= 0 || !m.isOpen()) { btn.disabled = false; return; }
      btn.disabled = true;
      setTimeout(function () { if (btn.isConnected) tickCooldown(btn); }, 500);
    }

    async function use() {
      var res = state.result;
      if (!res) return false;
      try {
        var blob = res.blob || await canvasBlob(res.canvas);
        await D.setCover(id, blob);
        if (!res.ai && !res.upload) await D.updateGame(id, { color: state.color });
        await D.updateGame(id, { art: 'picture' });
        Sound.good();
        UI.toast('New picture set!', { type: 'good', icon: 'image', sound: false });
        return true;
      } catch (e) {
        UI.toast('Couldn\'t use that picture: ' + (e.message || e), { type: 'bad' });
        return false;
      }
    }

    render();
  }

  window.Pics = { open: open, guessIcon: guessIcon, letterArt: letterArt, iconArt: iconArt, patternArt: patternArt, BLOCK: BLOCK, aiUrl: aiUrl };
})();
