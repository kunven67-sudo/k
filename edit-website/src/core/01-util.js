// ---------- small helpers ----------

function $(sel, root) { try { return (root || D).querySelector(sel); } catch (e) { return null; } }
function $$(sel, root) { try { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); } catch (e) { return []; } }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick1(arr) { return arr[(Math.random() * arr.length) | 0]; }
function uid() { return 'e' + Math.random().toString(36).slice(2, 9); }
function now() { return Date.now(); }
function copy(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function debounce(fn, ms) {
  var t;
  return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
}
function short(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }

// Inline styles go through the CSSOM (el.style), which strict sites can't block.
function css(el, o, imp) {
  for (var k in o) {
    if (o[k] == null || o[k] === '') el.style.removeProperty(k);
    else el.style.setProperty(k, String(o[k]), imp ? 'important' : '');
  }
  return el;
}

// Build DOM without innerHTML (sites like YouTube forbid innerHTML strings).
function h(tag, props) {
  var el = D.createElement(tag);
  if (props) for (var k in props) {
    var v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') css(el, v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
  return el;
}
function append(el, c) {
  if (c == null || c === false) return el;
  if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) append(el, c[i]); return el; }
  el.appendChild(typeof c === 'object' ? c : D.createTextNode(String(c)));
  return el;
}
function cleanStyle(el) { if (el && el.getAttribute && el.getAttribute('style') === '') el.removeAttribute('style'); }
function empty(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

var ICONS = {
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  min: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  pick: 'M5 3l6.5 17 2.6-7.4L21.5 10z',
  move: 'M12 3v18M3 12h18M12 3L9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  text: 'M5 6h14M12 6v13M9 19h6',
  play: 'M7 5l12 7-12 7z',
  plus: 'M12 5v14M5 12h14',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.5-4.5',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 8.5a1 1 0 1 0 0 .1',
  wand: 'M5 19L15 9M14 4v2M19 9h2M18 4l-1.5 1.5M10 4l.8 1.6M19 14l-1.6-.8',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  check: 'M5 12l5 5 9-10'
};
function icon(name, size) {
  var NS = 'http://www.w3.org/2000/svg';
  var s = D.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size || 15); s.setAttribute('height', size || 15);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  var p = D.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name] || '');
  s.appendChild(p);
  return s;
}

// Colors
function parseColor(str) {
  var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(str || '');
  if (!m) {
    var hx = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str || '');
    if (!hx) return null;
    var x = hx[1].length === 3 ? hx[1].replace(/./g, '$&$&') : hx[1];
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), 1];
  }
  var a = m[4] == null ? 1 : m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [+m[1], +m[2], +m[3], a];
}
function toHex(str, fallback) {
  var c = parseColor(str);
  if (!c || c[3] === 0) return fallback || '#000000';
  return '#' + c.slice(0, 3).map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
}
function hexA(hex, a) { var c = parseColor(hex) || [255, 255, 255]; return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

// Is this node part of the editor (not the website)?
function isOurs(n) {
  for (; n; n = n.parentNode || n.host) {
    if (n === host || n === bgLayer) return true;
    if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-ew-internal')) return true;
  }
  return false;
}

// Short readable name for an element: "div.card", "button#buy"
function elName(el) {
  if (!el || el.nodeType !== 1) return '?';
  var s = el.localName;
  if (el.id) s += '#' + el.id;
  else if (el.classList && el.classList.length) s += '.' + el.classList[0];
  return short(s, 34);
}

// A CSS selector that finds this same element again after a reload.
function cssPath(el) {
  if (!el || el.nodeType !== 1) return null;
  if (el === HTML) return 'html';
  if (el === D.body) return 'body';
  if (el === D.head) return 'head';
  var parts = [];
  for (var n = el; n && n.nodeType === 1 && n !== HTML; n = n.parentElement) {
    if (n.hasAttribute('data-ew-add')) { parts.unshift('[data-ew-id="' + n.getAttribute('data-ew-id') + '"]'); break; }
    if (n.id && /^[A-Za-z][\w-]*$/.test(n.id) && !/\d{4,}/.test(n.id) && D.querySelectorAll('#' + n.id).length === 1) { parts.unshift('#' + n.id); break; }
    if (n === D.body) { parts.unshift('body'); break; }
    var name = n.localName, idx = 1, same = 0;
    for (var s = n.parentElement ? n.parentElement.firstElementChild : null; s; s = s.nextElementSibling) {
      if (s.localName === name) { same++; if (s === n) idx = same; }
    }
    var tag = /^[a-z][a-z0-9-]*$/i.test(name) ? name : CSS.escape(name);
    parts.unshift(same > 1 ? tag + ':nth-of-type(' + idx + ')' : tag);
  }
  return parts.join(' > ');
}

// Shared animation loop. Anything that moves registers a tick here.
var ticks = new Set(), rafId = 0, lastT = 0;
function tickAdd(f) { ticks.add(f); if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(loop); } }
function tickDel(f) { ticks.delete(f); }
function loop(t) {
  var dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  ticks.forEach(function (f) {
    try { f(dt, t / 1000); } catch (e) { console.warn('[Edit Website]', e); ticks.delete(f); }
  });
  rafId = ticks.size ? requestAnimationFrame(loop) : 0;
}

// Files the user picks
function readFile(file, as) {
  return new Promise(function (res, rej) {
    var r = new FileReader();
    r.onload = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
    if (as === 'text') r.readAsText(file); else r.readAsDataURL(file);
  });
}
function dataToBlob(url) {
  var i = url.indexOf(','), meta = url.slice(5, i), b64 = /;base64/.test(meta);
  var raw = b64 ? atob(url.slice(i + 1)) : decodeURIComponent(url.slice(i + 1));
  var arr = new Uint8Array(raw.length);
  for (var k = 0; k < raw.length; k++) arr[k] = raw.charCodeAt(k);
  return new Blob([arr], { type: meta.split(';')[0] });
}
// Pictures get shrunk so they save fast (GIFs stay as-is so they keep moving).
function readImage(file, max) {
  max = max || 1920;
  if (/gif$/i.test(file.type) && file.size < 4e6) return readFile(file);
  return createImageBitmap(file).then(function (bmp) {
    var sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    var c = D.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    var png = /png|svg|webp/i.test(file.type) && c.width * c.height < 1.2e6;
    return c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88);
  }).catch(function () { return readFile(file); });
}
function chooseFile(accept, cb) {
  var inp = D.createElement('input');
  inp.type = 'file'; inp.accept = accept || '';
  inp.addEventListener('change', function () { if (inp.files && inp.files[0]) cb(inp.files[0]); });
  inp.click();
}

function download(text, name, type) {
  var url = null;
  try { url = URL.createObjectURL(new Blob([text], { type: type })); } catch (e) {}
  var a = D.createElement('a');
  a.href = url || 'data:' + type + ';charset=utf-8,' + encodeURIComponent(text);
  a.download = name;
  a.setAttribute('data-ew-internal', '');
  a.style.setProperty('display', 'none', 'important');
  HTML.appendChild(a);
  a.click();
  setTimeout(function () { a.remove(); if (url) URL.revokeObjectURL(url); }, 5000);
}
