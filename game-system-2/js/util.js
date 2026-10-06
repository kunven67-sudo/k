/* Game System 2.0 — small helpers shared by the whole app. */
(function () {
  'use strict';

  /* h('div.card#x', {onclick, style:{}, dataset:{}}, ...children) → Element */
  function h(sel, props) {
    var m = /^([a-z0-9-]+)?((?:[.#][^.#]+)*)$/i.exec(sel) || [];
    var el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([^.#]+)/g, function (_, t, v) {
      if (t === '.') el.classList.add(v); else el.id = v;
    });
    var kids = Array.prototype.slice.call(arguments, 2);
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
      kids.unshift(props);
      props = null;
    }
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === 'style' && typeof v === 'object') {
          Object.keys(v).forEach(function (sk) {
            if (sk.indexOf('--') === 0) el.style.setProperty(sk, v[sk]); /* CSS variables need setProperty */
            else el.style[sk] = v[sk];
          });
        }
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k in el && k !== 'list' && k !== 'form' && typeof v !== 'string') el[k] = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, kids);
    return el;
  }
  function append(el, kids) {
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function uid(n) {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var out = '';
    var arr = new Uint8Array(n || 6);
    crypto.getRandomValues(arr);
    for (var i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
    return out;
  }

  function slug(s) {
    return String(s || 'game').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'game';
  }

  function fmtBytes(b) {
    if (!b) return '0 B';
    var u = ['B', 'KB', 'MB', 'GB'];
    var i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    var v = b / Math.pow(1024, i);
    return (v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)) + ' ' + u[i];
  }

  function fmtDuration(ms, long) {
    var s = Math.floor((ms || 0) / 1000);
    var hh = Math.floor(s / 3600);
    var mm = Math.floor((s % 3600) / 60);
    var ss = s % 60;
    if (long) {
      if (hh) return hh + 'h ' + mm + 'm';
      if (mm) return mm + 'm ' + ss + 's';
      return ss + 's';
    }
    if (hh) return hh + 'h ' + mm + 'm';
    if (mm) return mm + 'm';
    return s ? s + 's' : '0m';
  }

  function timeAgo(t) {
    if (!t) return 'never';
    var d = (Date.now() - t) / 1000;
    if (d < 45) return 'just now';
    if (d < 3600) return Math.round(d / 60) + ' min ago';
    if (d < 86400) return Math.round(d / 3600) + 'h ago';
    if (d < 86400 * 2) return 'yesterday';
    if (d < 86400 * 30) return Math.round(d / 86400) + ' days ago';
    return new Date(t).toLocaleDateString();
  }

  function dayKey(t) {
    var d = new Date(t || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function debounce(fn, ms) {
    var t = null;
    var f = function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
    f.flush = function () { if (t) { clearTimeout(t); t = null; fn(); } };
    return f;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* Bright neon-ish color from any string */
  function colorFor(s) {
    var hue = hashStr(String(s)) % 360;
    return hslToHex(hue, 90, 58);
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    var hex = function (x) { return Math.round(x * 255).toString(16).padStart(2, '0'); };
    return '#' + hex(f(0)) + hex(f(8)) + hex(f(4));
  }
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [0, 229, 255];
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  var EMOJI_RULES = [
    [/casino|gambl|slot|poker|blackjack|roulette|bet|lucky|jackpot/, '🎰'],
    [/clicker|idle|cookie/, '🍪'],
    [/cook|food|pizza|burger|restaurant|chef/, '🍔'],
    [/portal/, '🌀'],
    [/race|racing|car|drift|kart|drive/, '🏎️'],
    [/zombie|undead/, '🧟'],
    [/snake/, '🐍'],
    [/craft|mine|block|build|sandbox/, '⛏️'],
    [/gun|shoot|sniper|fps|war|battle|soldier|army/, '🔫'],
    [/space|galaxy|star|rocket|alien|asteroid/, '🚀'],
    [/soccer|football|fifa/, '⚽'],
    [/basket/, '🏀'],
    [/golf/, '⛳'],
    [/fish/, '🎣'],
    [/horror|scary|ghost|haunt/, '👻'],
    [/ninja|samurai|sword|knight/, '⚔️'],
    [/dragon/, '🐉'],

    [/farm/, '🚜'],
    [/city|tycoon|business|money|bank|stock/, '💰'],
    [/puzzle|tetris|block|match/, '🧩'],
    [/chess/, '♟️'],
    [/card/, '🃏'],
    [/music|piano|rhythm|beat|dance/, '🎵'],
    [/bird|flappy/, '🐦'],
    [/dino/, '🦖'],
    [/ball|pong|bounce/, '🏓'],
    [/plane|fly|flight|jet/, '✈️'],
    [/boat|ship|pirate|sea|ocean/, '🏴‍☠️'],
    [/tank/, '🪖'],
    [/shrink|tiny|small|micro/, '🔬'],
    [/bar|drink|beer/, '🍺'],
    [/sim|life|story|adventure|quest|rpg/, '🗺️'],
    [/paint|draw|art/, '🎨'],
    [/maze/, '🌀'],
    [/run|parkour|jump/, '🏃'],
    [/strategy|tower|defen/, '🏰']
  ];
  function guessEmoji(name) {
    var n = String(name || '').toLowerCase();
    for (var i = 0; i < EMOJI_RULES.length; i++) if (EMOJI_RULES[i][0].test(n)) return EMOJI_RULES[i][1];
    return '🎮';
  }

  function prettyName(s) {
    s = String(s || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
    return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) || 'Untitled Game';
  }

  function mimeOf(path) { return GS2Shared.mimeOf(path); }
  function isHtml(path) { return GS2Shared.isHtml(path); }
  function isTextPath(path) {
    return /\.(html?|js|mjs|cjs|css|json|txt|md|svg|xml|csv|glsl|vert|frag|shader|ts|jsx|tsx|webmanifest|gltf|obj|mtl|ini|cfg|yaml|yml)$/i.test(path || '');
  }
  function isImagePath(path) { return /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i.test(path || ''); }
  function isAudioPath(path) { return /\.(mp3|ogg|oga|wav|m4a|aac|opus|flac)$/i.test(path || ''); }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function lsGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  /* Average color of an image blob (for accent colors from covers) */
  function avgColor(blob) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = c.height = 24;
          var x = c.getContext('2d');
          x.drawImage(img, 0, 0, 24, 24);
          var d = x.getImageData(0, 0, 24, 24).data;
          var best = null, bestScore = -1;
          for (var i = 0; i < d.length; i += 4) {
            var r = d[i], g = d[i + 1], b = d[i + 2];
            var max = Math.max(r, g, b), min = Math.min(r, g, b);
            var score = (max - min) * (max / 255);
            if (score > bestScore) { bestScore = score; best = [r, g, b]; }
          }
          URL.revokeObjectURL(url);
          if (!best || bestScore < 40) return resolve(null);
          resolve('#' + best.map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''));
        } catch (e) { URL.revokeObjectURL(url); resolve(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* Shrink an image blob to a max size → PNG/JPEG blob (keeps covers small) */
  function resizeImage(blob, max) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * s));
        c.height = Math.max(1, Math.round(img.naturalHeight * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b || blob); }, 'image/jpeg', 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function dataUrlToBlob(dataUrl) {
    var m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl || '');
    if (!m) return null;
    var bytes;
    if (m[2]) {
      var bin = atob(m[3]);
      bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
    }
    return new Blob([bytes], { type: m[1] || 'application/octet-stream' });
  }

  window.U = {
    h: h, $: $, $$: $$, uid: uid, slug: slug, fmtBytes: fmtBytes, fmtDuration: fmtDuration, timeAgo: timeAgo,
    dayKey: dayKey, debounce: debounce, escapeHtml: escapeHtml, hashStr: hashStr, colorFor: colorFor,
    hslToHex: hslToHex, hexToRgb: hexToRgb, guessEmoji: guessEmoji, prettyName: prettyName, mimeOf: mimeOf,
    isHtml: isHtml, isTextPath: isTextPath, isImagePath: isImagePath, isAudioPath: isAudioPath,
    downloadBlob: downloadBlob, copyText: copyText, sleep: sleep, lsGet: lsGet, lsSet: lsSet,
    avgColor: avgColor, resizeImage: resizeImage, dataUrlToBlob: dataUrlToBlob
  };
})();
