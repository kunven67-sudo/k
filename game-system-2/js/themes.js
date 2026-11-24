/* Game System 2.0 — themes.
   A theme changes the colors + glow, the moving background, the menu sounds, the letters and the
   title screen. Four come with Game System; you can make your own by describing it or from a picture. */
(function () {
  'use strict';

  /* vars: CSS variables. scene: moving background. font: letters. sound: click sounds. */
  var BUILTIN = {
    neon: {
      name: 'Neon synthwave', accent: '#00e5ff', accent2: '#ff2bd6', base: '#030409', scene: 'synth', font: 'neon', sound: 'neon',
      desc: 'Dark, neon cyan + pink, retro sun and grid'
    },
    hacker: {
      name: 'Hacker', accent: '#3dff7a', accent2: '#00ffc8', base: '#010603', scene: 'matrix', font: 'mono', sound: 'hacker',
      desc: 'Black and green, falling code, terminal letters',
      vars: { bg: '#010603', bg2: '#03100a', panel: 'rgba(4, 18, 9, 0.74)', 'panel-solid': '#04120a', 'panel-hi': 'rgba(8, 34, 16, 0.82)', line: 'rgba(80, 255, 140, 0.12)', line2: 'rgba(80, 255, 140, 0.24)', text: '#d8ffe4', muted: '#80c096', dim: '#4f7d5e', good: '#3dff7a' }
    },
    lava: {
      name: 'Lava', accent: '#ff5a1f', accent2: '#ffb020', base: '#0a0302', scene: 'embers', font: 'neon', sound: 'lava',
      desc: 'Dark red and orange, embers flying, like a volcano',
      vars: { bg: '#0a0302', bg2: '#160604', panel: 'rgba(30, 9, 5, 0.72)', 'panel-solid': '#1d0a06', 'panel-hi': 'rgba(48, 15, 8, 0.82)', line: 'rgba(255, 150, 100, 0.11)', line2: 'rgba(255, 150, 100, 0.22)', text: '#fff2ea', muted: '#d39d88', dim: '#91604d' }
    },
    ice: {
      name: 'Ice', accent: '#7fd8ff', accent2: '#c9eeff', base: '#0d2132', scene: 'snow', font: 'soft', sound: 'ice',
      desc: 'Light blue and white, frosty glass, calm',
      vars: { bg: '#0b1a28', bg2: '#102638', panel: 'rgba(205, 232, 255, 0.10)', 'panel-solid': '#132a3d', 'panel-hi': 'rgba(205, 232, 255, 0.16)', line: 'rgba(205, 232, 255, 0.15)', line2: 'rgba(205, 232, 255, 0.28)', text: '#f3fbff', muted: '#aac8de', dim: '#7090a8', good: '#7fffd4' }
    }
  };
  /* bonus themes unlock at higher levels */
  var BONUS = {
    gold: {
      name: 'Gold', level: 5, accent: '#ffcc33', accent2: '#ff8a00', base: '#0a0703', scene: 'synth', font: 'neon', sound: 'neon',
      desc: 'Shiny gold everything. Level 5 reward',
      vars: { bg: '#0a0703', bg2: '#140e05', panel: 'rgba(28, 20, 6, 0.74)', 'panel-solid': '#1b1406', 'panel-hi': 'rgba(44, 32, 10, 0.84)', line: 'rgba(255, 210, 120, 0.12)', line2: 'rgba(255, 210, 120, 0.24)', text: '#fff8e6', muted: '#d6bd8a', dim: '#8f7a52' }
    },
    galaxy: {
      name: 'Galaxy', level: 8, accent: '#b26bff', accent2: '#00e5ff', base: '#05030c', scene: 'stars', font: 'neon', sound: 'ice',
      desc: 'A spinning galaxy behind everything. Level 8 reward',
      vars: { bg: '#05030c', bg2: '#0b0718', panel: 'rgba(16, 10, 34, 0.72)', 'panel-solid': '#120b24', 'panel-hi': 'rgba(28, 18, 56, 0.82)', line: 'rgba(200, 170, 255, 0.12)', line2: 'rgba(200, 170, 255, 0.24)', text: '#f3eeff', muted: '#b3a6d6', dim: '#73689a' }
    },
    prism: {
      name: 'Prism', level: 12, accent: '#ff3df0', accent2: '#3dfff0', base: '#04040a', scene: 'waves', font: 'neon', sound: 'neon',
      desc: 'Rainbow waves. Level 12 reward',
      rainbow: true
    }
  };
  var FONTS = {
    neon: { font: "'Chakra Petch', system-ui, -apple-system, 'Segoe UI', sans-serif", display: "'Orbitron', 'Chakra Petch', system-ui, sans-serif" },
    mono: { font: "ui-monospace, 'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace", display: "ui-monospace, 'Cascadia Code', Consolas, 'Courier New', monospace" },
    soft: { font: "'Chakra Petch', system-ui, -apple-system, 'Segoe UI', sans-serif", display: "'Chakra Petch', system-ui, sans-serif" }
  };
  var SCENES = ['synth', 'matrix', 'embers', 'snow', 'stars', 'waves'];
  var VAR_KEYS = ['bg', 'bg2', 'panel', 'panel-solid', 'panel-hi', 'line', 'line2', 'text', 'muted', 'dim', 'good'];

  function customs() {
    var list = D.settings.customThemes;
    return Array.isArray(list) ? list.filter(function (t) { return t && t.id && /^#[0-9a-f]{6}$/i.test(t.accent || ''); }) : [];
  }
  function locked(th) { return !!(th.level && !(window.Trophies && Trophies.hasLevel(th.level))); }
  function get(id) {
    if (BUILTIN[id]) return Object.assign({ id: id }, BUILTIN[id]);
    if (BONUS[id]) { var b = Object.assign({ id: id, bonus: true }, BONUS[id]); b.locked = locked(b); return b; }
    var c = customs().find(function (t) { return t.id === id; });
    return c ? fromCustom(c) : Object.assign({ id: 'neon' }, BUILTIN.neon);
  }
  function current() {
    var th = get(D.settings.theme || 'neon');
    return th.locked ? get('neon') : th;
  }
  function list() {
    return Object.keys(BUILTIN).map(get).concat(Object.keys(BONUS).map(get), customs().map(fromCustom));
  }

  /* a theme you made only stores colors + background + letters; the rest is worked out here */
  function fromCustom(c) {
    var hsl = hexToHsl(c.accent);
    var baseHsl = hexToHsl(c.base || '#05060a');
    var light = baseHsl[2];
    function panelColor(a) { return 'hsla(' + Math.round(baseHsl[0]) + ', ' + Math.round(Math.min(60, baseHsl[1] + 10)) + '%, ' + Math.round(Math.min(20, light + 6)) + '%, ' + a + ')'; }
    return {
      id: c.id, custom: true, name: c.name || 'My theme', accent: c.accent, accent2: c.accent2 || c.accent, base: c.base || '#05060a',
      scene: SCENES.indexOf(c.scene) >= 0 ? c.scene : 'synth', font: FONTS[c.font] ? c.font : 'neon',
      sound: c.scene === 'matrix' ? 'hacker' : (c.scene === 'embers' ? 'lava' : (c.scene === 'snow' ? 'ice' : 'neon')),
      desc: c.desc || 'Made by you',
      vars: {
        bg: c.base || '#05060a',
        bg2: shade(c.base || '#05060a', 0.04),
        panel: panelColor(0.72),
        'panel-solid': 'hsl(' + Math.round(baseHsl[0]) + ', ' + Math.round(Math.min(60, baseHsl[1] + 10)) + '%, ' + Math.round(Math.min(18, light + 5)) + '%)',
        'panel-hi': panelColor(0.84),
        line: 'hsla(' + Math.round(hsl[0]) + ', 80%, 85%, 0.11)',
        line2: 'hsla(' + Math.round(hsl[0]) + ', 80%, 85%, 0.22)'
      }
    };
  }

  /* ---------------- put a theme on ---------------- */
  var lastId = null;
  function apply(id) {
    var th = id ? get(id) : current();
    if (th.locked) th = get('neon');
    var root = document.documentElement;
    VAR_KEYS.forEach(function (k) { root.style.removeProperty('--' + k); });
    if (th.vars) Object.keys(th.vars).forEach(function (k) { root.style.setProperty('--' + k, th.vars[k]); });
    var f = FONTS[th.font] || FONTS.neon;
    root.style.setProperty('--font', f.font);
    root.style.setProperty('--display', f.display);
    root.dataset.theme = th.custom ? 'custom' : th.id;
    root.dataset.font = th.font;
    root.classList.toggle('rainbow', !!th.rainbow);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', (th.vars && th.vars.bg) || '#05060a');
    BG.setScene(th.scene, th.base);
    Sound.setStyle(th.sound);
    if (lastId !== th.id) { lastId = th.id; Sound.setMusicStyle && Sound.setMusicStyle(th.sound); }
    return th;
  }

  /* ---------------- make your own ---------------- */
  var COLOR_WORDS = {
    red: '#ff2b3d', crimson: '#dc143c', blood: '#b3001b', orange: '#ff7a1a', amber: '#ffb020', yellow: '#ffe14d', gold: '#ffc83d', golden: '#ffc83d',
    lime: '#a6ff3d', green: '#3dff7a', emerald: '#2ee59d', mint: '#7dffc6', teal: '#00d1b2', cyan: '#00e5ff', aqua: '#3df5ff', turquoise: '#40e0d0',
    sky: '#5cc8ff', blue: '#2b7bff', navy: '#2340a8', cobalt: '#1f5cff', indigo: '#5b3dff', purple: '#a13dff', violet: '#8f4dff', lavender: '#c3a6ff',
    magenta: '#ff2bd6', pink: '#ff5cb0', rose: '#ff4d88', hot: '#ff2b6e', white: '#e8f2ff', silver: '#c8d2e0', grey: '#9aa3b5', gray: '#9aa3b5',
    black: '#2a2f3d', brown: '#b06a3b', bronze: '#cd7f32', copper: '#e07a4a', peach: '#ffb38a', coral: '#ff6f61', ice: '#9fe3ff', snow: '#e8f6ff',
    fire: '#ff5a1f', lava: '#ff4500', blood_red: '#b3001b', toxic: '#9dff00', neon: '#00e5ff', sunset: '#ff7a59', ocean: '#1fa2ff', forest: '#2ecc71',
    galaxy: '#a13dff', space: '#6c5cff', candy: '#ff6ec7', cherry: '#ff2e4c', grape: '#7d3cff', banana: '#ffe066', matrix: '#3dff7a'
  };
  var SCENE_WORDS = [
    [/galax|space|star|cosmic|universe|nebula|planet|astro|moon/i, 'stars'],
    [/matrix|hack|code|terminal|computer|cyber|digital|glitch/i, 'matrix'],
    [/fire|lava|volcan|ember|hell|flame|burn|magma|inferno|dragon/i, 'embers'],
    [/snow|ice|winter|frost|christmas|cold|frozen|arctic|blizzard/i, 'snow'],
    [/ocean|sea|water|wave|beach|surf|underwater|lake|river|rain/i, 'waves'],
    [/retro|synth|80s|outrun|vapor|arcade|neon|sunset|miami/i, 'synth']
  ];
  function nameFrom(desc) {
    var words = String(desc || '').replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 3);
    return words.length ? words.map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join(' ') : 'My theme';
  }
  /* the built-in brain: turns "purple galaxy with pink stars" into a theme (works offline) */
  function fromWords(desc) {
    var text = String(desc || '').toLowerCase();
    var found = [];
    text.replace(/[a-z_]+/g, function (w) { if (COLOR_WORDS[w] && found.indexOf(COLOR_WORDS[w]) < 0) found.push(COLOR_WORDS[w]); return w; });
    var scene = 'synth';
    for (var i = 0; i < SCENE_WORDS.length; i++) if (SCENE_WORDS[i][0].test(text)) { scene = SCENE_WORDS[i][1]; break; }
    var defaults = { stars: ['#a13dff', '#00e5ff'], matrix: ['#3dff7a', '#00ffc8'], embers: ['#ff5a1f', '#ffb020'], snow: ['#7fd8ff', '#e8f6ff'], waves: ['#1fa2ff', '#3dffe0'], synth: ['#ff2bd6', '#00e5ff'] };
    var a = found[0] || defaults[scene][0];
    var b = found[1] || (found[0] ? partner(found[0]) : defaults[scene][1]);
    if (/dark|black|night|shadow|evil|spooky|horror/i.test(text) && !found.length) { a = '#ff2b3d'; b = '#8f4dff'; }
    var font = /code|hack|terminal|retro computer|pixel|8.?bit/i.test(text) ? 'mono' : (/calm|soft|cute|chill|clean|peace|cozy|pastel/i.test(text) ? 'soft' : 'neon');
    return finish({ name: nameFrom(desc), accent: a, accent2: b, scene: scene, font: font, desc: String(desc || '').slice(0, 80) });
  }
  function finish(t) {
    var h = hexToHsl(t.accent);
    t.accent = brighten(t.accent);
    t.accent2 = brighten(t.accent2);
    if (!t.base || !/^#[0-9a-f]{6}$/i.test(t.base)) t.base = hslToHex(h[0], Math.min(55, h[1] * 0.6), t.scene === 'snow' || t.scene === 'waves' ? 11 : 3.5);
    var bh = hexToHsl(t.base);
    if (bh[2] > 16) t.base = hslToHex(bh[0], bh[1], 12);
    return t;
  }

  /* the free picture-and-words AI (Pollinations). Falls back to the built-in brain if it doesn't answer. */
  async function fromAI(desc) {
    var prompt = 'Design a color theme for a dark gaming app from this description: "' + String(desc).slice(0, 200) + '". ' +
      'Reply with ONLY a JSON object like {"name":"Short Name","accent":"#rrggbb","accent2":"#rrggbb","background":"#rrggbb","scene":"stars","font":"neon"}. ' +
      'accent and accent2 are bright glowing colors. background is very dark. scene is one of synth, matrix, embers, snow, stars, waves. font is one of neon, mono, soft.';
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    try {
      var r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?json=true&model=openai&seed=' + ((Math.random() * 1e6) | 0), { signal: ctl ? ctl.signal : undefined });
      if (!r.ok) throw new Error('busy');
      var txt = await r.text();
      var m = /\{[\s\S]*\}/.exec(txt);
      var j = JSON.parse(m ? m[0] : txt);
      var hex = /^#[0-9a-f]{6}$/i;
      if (!hex.test(j.accent || '')) throw new Error('bad answer');
      return finish({
        name: String(j.name || nameFrom(desc)).replace(/[<>]/g, '').slice(0, 24),
        accent: j.accent, accent2: hex.test(j.accent2 || '') ? j.accent2 : partner(j.accent),
        base: hex.test(j.background || '') ? j.background : null,
        scene: SCENES.indexOf(j.scene) >= 0 ? j.scene : fromWords(desc).scene,
        font: FONTS[j.font] ? j.font : 'neon',
        desc: String(desc).slice(0, 80), ai: true
      });
    } finally { clearTimeout(timer); }
  }

  /* from a picture: its two strongest colors + a dark background from its shadows */
  function fromPicture(blob, name) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var c = document.createElement('canvas');
        c.width = c.height = 48;
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0, 48, 48);
        var d = x.getImageData(0, 0, 48, 48).data;
        var weight = {};
        var dark = [0, 0, 0], darkN = 0;
        for (var i = 0; i < d.length; i += 4) {
          var hsl = rgbToHsl(d[i], d[i + 1], d[i + 2]);
          if (hsl[2] < 22) { dark[0] += d[i]; dark[1] += d[i + 1]; dark[2] += d[i + 2]; darkN++; }
          if (hsl[1] < 28 || hsl[2] < 18 || hsl[2] > 92) continue;
          var k = Math.floor(hsl[0] / 24) % 15;
          weight[k] = (weight[k] || 0) + 1 + hsl[1] / 50;
        }
        var cols = Object.keys(weight).map(function (k) { return { hue: Number(k) * 24 + 12, w: weight[k] }; })
          .sort(function (a, b) { return b.w - a.w; });
        var first = cols[0];
        var second = first ? cols.find(function (cc) { var dh = Math.abs(cc.hue - first.hue); return Math.min(dh, 360 - dh) > 40; }) : null;
        var a = first ? hslToHex(first.hue, 95, 62) : '#00e5ff';
        var b = second ? hslToHex(second.hue, 95, 64) : partner(a);
        var base = darkN ? rgbToHex(dark[0] / darkN, dark[1] / darkN, dark[2] / darkN) : null;
        var hue = first ? first.hue : 190;
        var scene = (hue < 40 || hue > 340) ? 'embers' : (hue < 70 ? 'synth' : (hue < 160 ? 'waves' : (hue < 215 ? 'snow' : (hue < 290 ? 'stars' : 'synth'))));
        resolve(finish({ name: name || 'From a picture', accent: a, accent2: b, base: base, scene: scene, font: 'neon', desc: 'Made from a picture' }));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That picture could not be opened.')); };
      img.src = url;
    });
  }

  function save(t) {
    var list = customs();
    var th = { id: 'c-' + Date.now().toString(36), name: String(t.name || 'My theme').slice(0, 24), accent: t.accent, accent2: t.accent2, base: t.base, scene: t.scene, font: t.font, desc: t.desc || '' };
    list.unshift(th);
    D.settings.customThemes = list.slice(0, 12);
    D.settings.theme = th.id;
    D.saveSettings();
    return th;
  }
  function remove(id) {
    D.settings.customThemes = customs().filter(function (t) { return t.id !== id; });
    if (D.settings.theme === id) D.settings.theme = 'neon';
    D.saveSettings();
  }

  /* ---------------- color helpers ---------------- */
  function hexToRgb(hex) { var n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(''); }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, s = 0, h = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }
  function hexToHsl(hex) { var c = hexToRgb(hex); return rgbToHsl(c[0], c[1], c[2]); }
  function hslToHex(h, s, l) { return U.hslToHex(h, s, l); }
  function brighten(hex) { var h = hexToHsl(hex); return hslToHex(h[0], Math.max(70, h[1]), Math.min(74, Math.max(55, h[2]))); }
  function partner(hex) { var h = hexToHsl(hex); return hslToHex((h[0] + 150) % 360, 90, 62); }
  function shade(hex, add) { var h = hexToHsl(hex); return hslToHex(h[0], h[1], Math.min(30, h[2] + add * 100)); }

  window.Themes = {
    BUILTIN: BUILTIN,
    list: list,
    get: get,
    current: current,
    apply: apply,
    fromWords: fromWords,
    fromAI: fromAI,
    fromPicture: fromPicture,
    fromCustom: fromCustom,
    save: save,
    remove: remove,
    SCENES: SCENES
  };
})();
