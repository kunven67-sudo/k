(function EW() {
'use strict';
// ===== 00-boot.js =====
/* Edit Website - the editor itself.
   tools/build.mjs glues every file in src/core/ (in name order) into ONE
   function: (function EW(){ ...all files... })();  so they share one scope.
   The same code runs as the bookmark button, inside the Chrome extension,
   and inside pages you download from the editor ("player" mode). */

var W = window, D = document, HTML = D.documentElement;
var ENV = W.__EW_ENV || {};
var KIND = ENV.kind || (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id ? 'extension' : 'bookmarklet');
var VERSION = '1.0.0';
var SELF = EW; // the wrapper function; downloaded pages get a copy of it

// Clicking the bookmark again just opens/closes the editor.
if (W.__EW && W.__EW.alive) { W.__EW.toggle(); return; }

// Another copy already owns this page from a different JS world (the
// extension, or the editor built into a downloaded page). Don't make a
// second editor, just pass open/close over to it.
if (HTML.getAttribute('data-ew-alive')) {
  W.__EW = { alive: true, remote: true, toggle: function () { D.dispatchEvent(new CustomEvent('ew-toggle')); } };
  if (KIND === 'extension') listenExtension();
  else W.__EW.toggle();
  return;
}

// ===== 01-util.js =====
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

// ===== 02-safe.js =====
// ---------- working on strict websites ----------
// Sites like YouTube, Google and GitHub use "Trusted Types" + CSP, which
// throw an error if you set innerHTML with a normal string. Everything that
// turns code text into page elements goes through setHTML(), which tries the
// normal way, then a Trusted Types policy, then our own little HTML parser.

var SVGNS = 'http://www.w3.org/2000/svg';
var ttPolicy;
function tt() {
  if (ttPolicy !== undefined) return ttPolicy;
  ttPolicy = null;
  try {
    if (W.trustedTypes && W.trustedTypes.createPolicy) {
      ttPolicy = W.trustedTypes.createPolicy('edit-website-' + uid(), {
        createHTML: function (s) { return s; },
        createScript: function (s) { return s; },
        createScriptURL: function (s) { return s; }
      });
    }
  } catch (e) { ttPolicy = null; }
  return ttPolicy;
}

function isSvg(el) { return el && el.namespaceURI === SVGNS && el.localName !== 'foreignObject'; }

var htmlBlocked = false; // remember once a site blocks innerHTML (each try logs an error)
function setHTML(el, html) {
  var ok = false;
  if (!htmlBlocked) {
    try { el.innerHTML = html; ok = true; } catch (e) { htmlBlocked = true; }
  }
  if (!ok) {
    var p = tt();
    if (p) try { el.innerHTML = p.createHTML(html); ok = true; } catch (e) {}
  }
  if (!ok) {
    empty(el);
    el.appendChild(parseHTML(html, isSvg(el)));
  }
  fixInlineStyles(el);
}

// Turn code text into nodes, parsed the way they would be inside `parent`
// (so <tr>, <li>, <option> etc. come out right).
function htmlToNodes(html, parent) {
  var box;
  if (parent && isSvg(parent)) box = D.createElementNS(SVGNS, 'g');
  else {
    var tag = parent && parent.nodeType === 1 ? parent.localName : 'div';
    if (/^(html|head)$/.test(tag) || !/^[a-z][a-z0-9-]*$/.test(tag)) tag = 'div';
    try { box = D.createElement(tag); } catch (e) { box = D.createElement('div'); }
  }
  setHTML(box, html);
  return Array.prototype.slice.call(box.childNodes);
}

// Strict sites drop style="" attributes from parsed code; re-apply them
// through the CSSOM, which is always allowed.
function fixInlineStyles(root) {
  var list = root.querySelectorAll ? root.querySelectorAll('[style]') : [];
  for (var i = 0; i < list.length; i++) {
    var s = list[i].getAttribute('style');
    if (s && list[i].style.cssText !== s) list[i].style.cssText = s;
  }
}

function safeAttr(el, n, v) {
  var ln = n.toLowerCase();
  if (ln === 'style') { el.style.cssText = v; return; }
  try { el.setAttribute(n, v); return; } catch (e) {}
  var p = tt();
  if (!p) return;
  try {
    if (/^on/.test(ln)) el.setAttribute(n, p.createScript(v));
    else if (ln === 'src' && el.localName === 'script') el.setAttribute(n, p.createScriptURL(v));
    else el.setAttribute(n, p.createHTML(v));
  } catch (e) {}
}

// ----- tiny HTML parser (only used when a site blocks every other way) -----
var VOID_RE = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr|param|keygen)$/;
var RAW_RE = /^(script|style|textarea|title|xmp|noscript|iframe|noembed|noframes)$/;
var PCLOSE_RE = /^(address|article|aside|blockquote|details|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|main|menu|nav|ol|p|pre|section|table|ul)$/;
var ENT = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9', reg: '\u00ae',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c',
  rdquo: '\u201d', bull: '\u2022', middot: '\u00b7', times: '\u00d7', trade: '\u2122', laquo: '\u00ab',
  raquo: '\u00bb', deg: '\u00b0', euro: '\u20ac', pound: '\u00a3', cent: '\u00a2', yen: '\u00a5', larr: '\u2190',
  rarr: '\u2192', uarr: '\u2191', darr: '\u2193', hearts: '\u2665', check: '\u2713', zwj: '\u200d', shy: '\u00ad'
};
function decodeEnt(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+\d*);/g, function (m, e) {
    if (e[0] === '#') {
      var c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(c); } catch (x) { return m; }
    }
    var v = ENT[e] || ENT[e.toLowerCase()];
    return v != null ? v : m;
  });
}
function isSpace(c) { return c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f'; }

function parseHTML(src, svgCtx) {
  var frag = D.createDocumentFragment();
  var stack = [{ n: frag, svg: !!svgCtx, tag: '' }];
  var i = 0, L = src.length, lower = src.toLowerCase();
  function top() { return stack[stack.length - 1]; }
  function text(t) { if (t) top().n.appendChild(D.createTextNode(decodeEnt(t))); }
  function closeTo(tag) {
    for (var s = stack.length - 1; s > 0; s--) if (stack[s].tag === tag) { stack.length = s; return true; }
    return false;
  }
  while (i < L) {
    var lt = src.indexOf('<', i);
    if (lt < 0) { text(src.slice(i)); break; }
    if (lt > i) text(src.slice(i, lt));
    i = lt;
    if (src.startsWith('<!--', i)) {
      var ce = src.indexOf('-->', i + 4); if (ce < 0) ce = L;
      top().n.appendChild(D.createComment(src.slice(i + 4, ce)));
      i = ce + 3; continue;
    }
    var c1 = src[i + 1];
    if (c1 === '!' || c1 === '?') { var de = src.indexOf('>', i); i = de < 0 ? L : de + 1; continue; }
    var closing = c1 === '/';
    var j = i + (closing ? 2 : 1), k = j;
    while (k < L && /[A-Za-z0-9:._-]/.test(src[k])) k++;
    if (k === j || !/[A-Za-z]/.test(src[j])) { text('<'); i++; continue; }
    var tag = src.slice(j, k), tl = tag.toLowerCase();
    var attrs = [], selfClose = false;
    i = k;
    while (i < L) {
      while (i < L && isSpace(src[i])) i++;
      if (i >= L) break;
      if (src[i] === '>') { i++; break; }
      if (src[i] === '/') { if (src[i + 1] === '>') { selfClose = true; i += 2; break; } i++; continue; }
      var a = i;
      while (i < L && !isSpace(src[i]) && src[i] !== '=' && src[i] !== '>' && !(src[i] === '/' && src[i + 1] === '>')) i++;
      var an = src.slice(a, i);
      if (!an) { i++; continue; }
      while (i < L && isSpace(src[i])) i++;
      var av = '';
      if (src[i] === '=') {
        i++;
        while (i < L && isSpace(src[i])) i++;
        var q = src[i];
        if (q === '"' || q === "'") {
          var qe = src.indexOf(q, i + 1); if (qe < 0) qe = L;
          av = src.slice(i + 1, qe); i = qe + 1;
        } else {
          var b = i;
          while (i < L && !isSpace(src[i]) && src[i] !== '>') i++;
          av = src.slice(b, i);
        }
      }
      attrs.push([an, decodeEnt(av)]);
    }
    if (closing) { closeTo(tl); continue; }
    var cur = top().tag;
    if (cur === 'p' && PCLOSE_RE.test(tl)) closeTo('p');
    else if ((tl === 'li' && cur === 'li') || (tl === 'option' && cur === 'option') ||
             ((tl === 'td' || tl === 'th') && (cur === 'td' || cur === 'th')) || (tl === 'tr' && cur === 'tr') ||
             ((tl === 'dt' || tl === 'dd') && (cur === 'dt' || cur === 'dd'))) stack.pop();
    var svg = top().svg || tl === 'svg';
    var el;
    try { el = svg ? D.createElementNS(SVGNS, tag) : D.createElement(tl); } catch (e) { el = D.createElement('span'); }
    for (var ai = 0; ai < attrs.length; ai++) safeAttr(el, attrs[ai][0], attrs[ai][1]);
    if (!svg && RAW_RE.test(tl)) {
      var end = lower.indexOf('</' + tl, i); if (end < 0) end = L;
      var body = src.slice(i, end);
      var ge = src.indexOf('>', end); i = ge < 0 ? L : ge + 1;
      if (tl === 'script') continue; // code pasted as text never runs, same as innerHTML
      el.textContent = tl === 'style' ? body : decodeEnt(body);
      top().n.appendChild(el);
      continue;
    }
    top().n.appendChild(el);
    if (!selfClose && !(!svg && VOID_RE.test(tl))) stack.push({ n: el, svg: svg && tl !== 'foreignobject', tag: tl });
  }
  return frag;
}

// ----- running your own JavaScript -----
function fmtArgs(args) {
  return Array.prototype.map.call(args, function (x) {
    if (typeof x === 'string') return x;
    try { return JSON.stringify(x); } catch (e) { return String(x); }
  }).join(' ');
}
function showVal(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (v && v.nodeType === 1) return '<' + elName(v) + '>';
  try { var j = JSON.stringify(v); if (j !== undefined) return short(j, 400); } catch (e) {}
  return String(v);
}
var BLOCKED_JS = 'This website blocks running your own code from a bookmark. Use the Edit Website Chrome extension (with "Allow User Scripts" turned on) to run code here.';

function runCode(code, cb) {
  cb = cb || function () {};
  if (KIND === 'extension') {
    try {
      chrome.runtime.sendMessage({ ew: 'runjs', code: code }, function (res) {
        if (chrome.runtime.lastError) cb({ e: chrome.runtime.lastError.message, l: [] });
        else cb(res || { e: 'No answer from the extension', l: [] });
      });
    } catch (e) { cb({ e: String(e && e.message || e), l: [] }); }
    return;
  }
  var logs = [], orig = W.console.log, res;
  W.console.log = function () { logs.push(fmtArgs(arguments)); return orig.apply(this, arguments); };
  try {
    res = { r: showVal((0, eval)(code)) };
  } catch (e) {
    var msg = String(e && e.message || e);
    if (/trusted/i.test(msg) && tt()) {
      try { res = { r: showVal((0, eval)(tt().createScript(code))) }; }
      catch (e2) { res = { e: String(e2 && e2.message || e2) }; }
    } else res = { e: msg };
  } finally { W.console.log = orig; }
  if (res.e && /unsafe-eval|Content Security Policy|EvalError|TrustedScript/i.test(res.e)) res.e += '\n\n' + BLOCKED_JS;
  res.l = logs;
  cb(res);
}

// ===== 03-store.js =====
// ---------- saving ----------
// Extension: chrome.storage (big, survives clearing the site's data).
// Bookmark / downloaded page: the site's own IndexedDB (falls back to localStorage).

var store = (function () {
  if (KIND === 'extension') {
    var cs = function () { return chrome.storage.local; };
    return {
      get: function (k) {
        return new Promise(function (res) {
          try { cs().get(k, function (o) { res(o && o[k] || null); }); } catch (e) { res(null); }
        });
      },
      set: function (k, v) {
        return new Promise(function (res, rej) {
          var o = {}; o[k] = v;
          try { cs().set(o, function () { var er = chrome.runtime.lastError; er ? rej(er) : res(); }); } catch (e) { rej(e); }
        });
      },
      del: function (k) {
        return new Promise(function (res) { try { cs().remove(k, function () { res(); }); } catch (e) { res(); } });
      },
      list: function () {
        return new Promise(function (res) {
          try {
            cs().get(null, function (all) {
              res(Object.keys(all || {}).filter(function (k) { return k.indexOf('ew:') === 0; }).map(function (k) { return all[k]; }));
            });
          } catch (e) { res([]); }
        });
      }
    };
  }

  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open('edit-website', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('p'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
        r.onblocked = function () { rej(new Error('blocked')); };
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('p', mode), r = fn(t.objectStore('p'));
        t.oncomplete = function () { res(r ? r.result : undefined); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  var ls = {
    get: function (k) { try { return Promise.resolve(JSON.parse(localStorage.getItem(k) || 'null')); } catch (e) { return Promise.resolve(null); } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return Promise.resolve(); } catch (e) { return Promise.reject(e); } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} return Promise.resolve(); },
    list: function () {
      var out = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf('ew:') === 0) out.push(JSON.parse(localStorage.getItem(k))); } } catch (e) {}
      return Promise.resolve(out);
    }
  };
  return {
    get: function (k) { return tx('readonly', function (s) { return s.get(k); }).then(function (v) { return v || ls.get(k); }, function () { return ls.get(k); }); },
    set: function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }).catch(function () { return ls.set(k, v); }); },
    del: function (k) { return tx('readwrite', function (s) { return s.delete(k); }).catch(function () {}).then(function () { return ls.del(k); }); },
    list: function () {
      return tx('readonly', function (s) { return s.getAll(); }).catch(function () { return []; }).then(function (a) {
        return ls.list().then(function (b) { return (a || []).concat(b); });
      });
    }
  };
})();

// ===== 04-css.js =====
// ---------- how the editor looks ----------
// Lives inside a closed shadow root, so the website's CSS can't touch it
// and ours can't leak onto the website.

var UI_CSS = [
':host{all:initial}',
'*,*::before,*::after{box-sizing:border-box}',
':host{--bg:rgba(9,13,18,.95);--bg2:#0f161f;--bg3:#151f2b;--line:#1d2938;--line2:#283849;--tx:#d4e0ec;--dim:#7c8ea3;--neon:#3dffa2;--cy:#2de2ff;--pk:#ff4fa3;--warn:#ffb547;--bad:#ff5470;',
'--mono:"Cascadia Code","JetBrains Mono","Fira Code",Consolas,"SF Mono",Menlo,monospace;--ui:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif}',

/* page overlays */
'.fxl{position:fixed;inset:0;pointer-events:none;display:none;z-index:1}',
'.fxr{animation:ewhue 6s linear infinite}',
'@keyframes ewhue{from{-webkit-backdrop-filter:hue-rotate(0deg);backdrop-filter:hue-rotate(0deg)}to{-webkit-backdrop-filter:hue-rotate(360deg);backdrop-filter:hue-rotate(360deg)}}',
'.fxc{position:fixed;left:0;top:0;pointer-events:none;z-index:2;display:none}',
'.hl,.selb{position:fixed;pointer-events:none;display:none;z-index:3;border-radius:2px}',
'.hl{border:1.5px solid var(--cy);background:rgba(45,226,255,.08)}',
'.selb{border:1.5px solid var(--neon);box-shadow:0 0 0 1px rgba(0,0,0,.55),0 0 16px rgba(61,255,162,.35)}',
'.hl.del{border-color:var(--bad);background:rgba(255,84,112,.14)}',
'.lbl{position:absolute;left:18px;bottom:100%;margin-bottom:3px;font:600 10.5px/1 var(--mono);padding:5px 7px;border-radius:4px;white-space:nowrap;color:#04110a;background:var(--cy);letter-spacing:.02em}',
'.selb .lbl{background:var(--neon)}',
'.hl.del .lbl{background:var(--bad);color:#fff}',
'.lbl.below{bottom:auto;top:100%;margin:3px 0 0}',
'.grip{position:absolute;pointer-events:auto;display:grid;place-items:center;color:#032015;background:var(--neon);box-shadow:0 2px 10px rgba(0,0,0,.55)}',
'.grip.mv{left:-12px;top:-12px;width:24px;height:24px;border-radius:7px;cursor:move}',
'.selb.edge .grip.mv{left:2px;top:2px}',
'.hl .lbl{left:-1.5px}',
'.grip.sz{right:-7px;bottom:-7px;width:14px;height:14px;border-radius:4px;cursor:nwse-resize}',
'.grip:hover{background:#fff}',

/* panel */
'.panel{position:fixed;top:16px;right:16px;width:400px;max-width:calc(100vw - 16px);height:min(780px,calc(100vh - 32px));display:none;flex-direction:column;pointer-events:auto;z-index:5;',
'color:var(--tx);font:13px/1.4 var(--ui);background:var(--bg);border:1px solid rgba(61,255,162,.26);border-radius:12px;overflow:hidden;cursor:default;',
'box-shadow:0 0 0 1px rgba(0,0,0,.6),0 22px 70px rgba(0,0,0,.6),0 0 28px rgba(61,255,162,.08);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);text-align:left;letter-spacing:0;text-transform:none;font-weight:400}',
'.panel.show{display:flex}',
'.hd{display:flex;align-items:center;gap:6px;height:44px;padding:0 8px 0 12px;flex:none;cursor:move;user-select:none;border-bottom:1px solid var(--line);',
'background:linear-gradient(180deg,rgba(61,255,162,.06),transparent),repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 3px)}',
'.mark{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;color:var(--neon);border:1px solid rgba(61,255,162,.45);background:rgba(61,255,162,.07);box-shadow:0 0 12px rgba(61,255,162,.18) inset}',
'.ttl{font:700 12.5px/1 var(--mono);letter-spacing:.2em;color:#eafff5;white-space:nowrap;animation:ewg 6s infinite;text-shadow:-1px 0 rgba(255,79,163,.3),1px 0 rgba(45,226,255,.3)}',
'@keyframes ewg{0%,90%,100%{transform:none}91%{transform:translateX(1px) skewX(-10deg);text-shadow:-3px 0 rgba(255,79,163,.9),3px 0 rgba(45,226,255,.9)}93%{transform:translateX(-2px)}95%{transform:none;text-shadow:2px 0 rgba(255,79,163,.9),-2px 0 rgba(45,226,255,.9)}}',
'.ver{font:10px/1 var(--mono);color:var(--dim);margin-left:2px}',
'.sp{flex:1}',
'.ib{width:30px;height:30px;display:grid;place-items:center;border:1px solid transparent;border-radius:7px;background:none;color:var(--dim);cursor:pointer;padding:0}',
'.ib:hover{color:#fff;background:var(--bg3);border-color:var(--line2)}',
'.ib:disabled{opacity:.3;cursor:default;background:none;border-color:transparent}',
'.tabs{display:flex;flex:none;border-bottom:1px solid var(--line);background:rgba(0,0,0,.18)}',
'.tab{flex:1 1 auto;min-width:0;padding:10px 5px 9px;border:0;border-bottom:2px solid transparent;background:none;color:var(--dim);font:600 10.5px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;cursor:pointer;white-space:nowrap}',
'.tab:hover{color:var(--tx)}',
'.tab.on{color:var(--neon);border-bottom-color:var(--neon);background:linear-gradient(0deg,rgba(61,255,162,.09),transparent)}',
'.body{flex:1;overflow:auto;padding:12px 12px 16px;overscroll-behavior:contain}',
'.body::-webkit-scrollbar,.tree::-webkit-scrollbar,.ed textarea::-webkit-scrollbar,.list::-webkit-scrollbar{width:10px;height:10px}',
'.body::-webkit-scrollbar-thumb,.tree::-webkit-scrollbar-thumb,.ed textarea::-webkit-scrollbar-thumb,.list::-webkit-scrollbar-thumb{background:#243244;border-radius:6px;border:2px solid transparent;background-clip:padding-box}',
'.ft{display:flex;align-items:center;gap:8px;height:30px;padding:0 12px;flex:none;border-top:1px solid var(--line);font:11px/1 var(--mono);color:var(--dim);white-space:nowrap;overflow:hidden}',
'.dot{width:7px;height:7px;border-radius:50%;background:var(--neon);box-shadow:0 0 8px var(--neon);flex:none}',
'.dot.busy{background:var(--warn);box-shadow:0 0 8px var(--warn)}',
'.ft .st{overflow:hidden;text-overflow:ellipsis}',
'.rz{position:absolute;left:0;bottom:0;width:16px;height:16px;cursor:nesw-resize;z-index:2}',
'.rz::after{content:"";position:absolute;left:4px;bottom:4px;width:7px;height:7px;border-left:2px solid var(--line2);border-bottom:2px solid var(--line2)}',

/* building blocks */
'.sec{margin:0 0 16px}',
'.sec>h4{display:flex;align-items:center;gap:8px;margin:0 0 8px;font:700 10.5px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}',
'.sec>h4::after{content:"";flex:1;height:1px;background:var(--line)}',
'.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 10px;border:1px solid var(--line2);border-radius:7px;background:var(--bg3);color:var(--tx);font:500 12.5px/1.2 var(--ui);cursor:pointer;text-align:center;transition:border-color .12s,color .12s,background .12s}',
'.btn:hover{border-color:var(--cy);color:#fff}',
'.btn:disabled{opacity:.4;cursor:default;border-color:var(--line2);color:var(--tx)}',
'.btn.on{border-color:var(--neon);color:var(--neon);background:rgba(61,255,162,.08);box-shadow:0 0 14px rgba(61,255,162,.12)}',
'.btn.pri{border-color:rgba(61,255,162,.55);color:var(--neon);background:linear-gradient(180deg,rgba(61,255,162,.16),rgba(61,255,162,.06))}',
'.btn.pri:hover{color:#fff;border-color:var(--neon)}',
'.btn.bad:hover{border-color:var(--bad);color:var(--bad)}',
'.btn.big{width:100%;padding:12px;font-size:13.5px;font-weight:600}',
'.btn.sm{padding:5px 8px;font-size:11.5px}',
'.btn.live{animation:ewpulse 1.4s ease-in-out infinite}',
'@keyframes ewpulse{0%,100%{box-shadow:0 0 0 0 rgba(45,226,255,.35)}50%{box-shadow:0 0 0 6px rgba(45,226,255,0)}}',
'.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
'.g2{grid-template-columns:repeat(2,minmax(0,1fr))}',
'.g4{grid-template-columns:repeat(4,minmax(0,1fr))}',
'.tile{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:3px;padding:9px 9px 8px;min-height:52px;text-align:left}',
'.tile b{font-weight:600;font-size:12.5px}',
'.tile small{font-size:10.5px;color:var(--dim);line-height:1.25}',
'.tile.on small{color:rgba(61,255,162,.75)}',
'.row{display:flex;align-items:center;gap:8px;margin:7px 0}',
'.row>label{flex:0 0 96px;color:var(--dim);font-size:12px}',
'.row>.grow{flex:1;min-width:0}',
'.val{font:11px/1 var(--mono);color:var(--dim);min-width:38px;text-align:right}',
'input[type=range]{flex:1;min-width:0;accent-color:var(--neon);height:18px;margin:0;background:none}',
'input[type=color]{width:36px;height:28px;padding:2px;border:1px solid var(--line2);border-radius:7px;background:var(--bg2);cursor:pointer;flex:none}',
'input[type=color]::-webkit-color-swatch-wrapper{padding:0}',
'input[type=color]::-webkit-color-swatch{border:0;border-radius:4px}',
'.in{width:100%;min-width:0;padding:7px 9px;border:1px solid var(--line2);border-radius:7px;background:#0a1017;color:var(--tx);font:12.5px/1.3 var(--ui);outline:none}',
'.in:focus{border-color:var(--cy);box-shadow:0 0 0 3px rgba(45,226,255,.12)}',
'textarea.in{resize:vertical;min-height:64px;font-family:var(--mono);font-size:12px}',
'select.in{cursor:pointer}',
'select.in option{background:#0f161f;color:var(--tx)}',
'.seg{display:flex;flex-wrap:wrap;gap:4px}',
'.seg .btn{flex:1 1 auto}',
'.help{padding:11px 12px;border:1px dashed var(--line2);border-radius:9px;color:var(--dim);font-size:12px;line-height:1.55;background:rgba(255,255,255,.015)}',
'.help b{color:var(--tx);font-weight:600}',
'.help ol{margin:4px 0 0;padding-left:18px}',
'.kbd{font:11px/1 var(--mono);padding:2px 5px;border:1px solid var(--line2);border-bottom-width:2px;border-radius:4px;color:var(--tx);background:var(--bg2)}',
'.note{font-size:11.5px;color:var(--dim);margin:6px 0 0;line-height:1.45}',
'.warn{color:var(--warn)}',
'.card{border:1px solid var(--line2);border-radius:10px;background:var(--bg2);padding:10px;margin-bottom:12px}',
'.crumbs{display:flex;flex-wrap:wrap;gap:2px;font:11px/1.6 var(--mono);color:var(--dim);margin-bottom:6px}',
'.crumbs span{cursor:pointer;padding:0 3px;border-radius:3px}',
'.crumbs span:hover{color:var(--cy);background:rgba(45,226,255,.08)}',
'.crumbs span.me{color:var(--neon)}',
'.selname{font:600 13px/1.3 var(--mono);color:var(--neon);word-break:break-all}',
'.dimtx{color:var(--dim);font-size:11.5px}',
'.sw{display:flex;flex-wrap:wrap;gap:4px}',
'.sw button{width:21px;height:21px;border-radius:5px;border:1px solid rgba(255,255,255,.15);cursor:pointer;padding:0}',
'.sw button:hover{transform:scale(1.12);border-color:#fff}',
'.act{border:1px solid var(--line2);border-radius:8px;padding:8px;margin-bottom:6px;background:var(--bg3)}',
'.act .top{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600}',
'.act .top span{flex:1}',
'.act .row{margin:6px 0 0}',
'.list{max-height:220px;overflow:auto;border:1px solid var(--line2);border-radius:8px;background:#0a1017}',
'.li{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--line);font-size:12px}',
'.li:last-child{border-bottom:0}',
'.li .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.li.cur{background:rgba(61,255,162,.08)}',
'.li.fut{opacity:.45}',
'.li.click{cursor:pointer}',
'.li.click:hover{background:rgba(45,226,255,.07)}',
'.out{margin-top:8px;max-height:160px;overflow:auto;padding:8px 10px;border:1px solid var(--line2);border-radius:8px;background:#070b10;font:11.5px/1.5 var(--mono);white-space:pre-wrap;word-break:break-word;color:#b9c7d6}',
'.out .e{color:var(--bad)}',
'.out .r{color:var(--neon)}',
'.out:empty{display:none}',
'.flex{display:flex;gap:6px;align-items:center}',
'.flex>.grow{flex:1;min-width:0}',
'.mt{margin-top:8px}',

/* code tree + editor */
'.tree{height:clamp(150px,34vh,420px);overflow:auto;padding:6px 0;border:1px solid var(--line2);border-radius:9px;background:#070b10;font:11.5px/1.65 var(--mono)}',
'.tr{display:flex;align-items:flex-start;white-space:nowrap;padding-right:10px;cursor:pointer}',
'.tr:hover{background:rgba(45,226,255,.07)}',
'.tr.sel{background:rgba(61,255,162,.13);box-shadow:inset 2px 0 var(--neon)}',
'.tw{flex:none;width:14px;text-align:center;color:var(--dim);user-select:none}',
'.tw:hover{color:#fff}',
'.tx{color:#97a8bb}',
'.more{color:var(--cy);padding-left:22px;cursor:pointer}',
'.ed{position:relative;height:clamp(170px,30vh,460px);border:1px solid var(--line2);border-radius:9px;background:#070b10;overflow:hidden}',
'.ed.tall{height:clamp(200px,42vh,560px)}',
'.ed.short{height:clamp(110px,20vh,260px)}',
'.ed pre,.ed textarea{margin:0;padding:10px 12px;border:0;font:12px/1.6 var(--mono);letter-spacing:0;tab-size:2;white-space:pre-wrap;word-break:break-all;overflow-wrap:anywhere;scrollbar-gutter:stable}',
'.ed pre{position:absolute;inset:0;overflow:hidden;pointer-events:none;color:#cad6e2}',
'.ed textarea{position:relative;display:block;width:100%;height:100%;resize:none;outline:none;background:transparent;color:transparent;caret-color:var(--neon);overflow:auto}',
'.ed textarea::selection{background:rgba(45,226,255,.28)}',
'.ed.plain pre{display:none}',
'.ed.plain textarea{color:#cad6e2}',
'.k-t{color:#5ccfe6}.k-a{color:#ffd580}.k-s{color:#bae67e}.k-p{color:#677a90}.k-c{color:#5c6b7d;font-style:italic}',
'.k-n{color:#f29e74}.k-k{color:#ff7ab2}.k-f{color:#73d0ff}.k-x{color:#d4e0ec}.k-pr{color:#5ccfe6}.k-sel{color:#ffd580}.k-at{color:#ff7ab2}',

/* pill, toast, modals */
'.pill{position:fixed;right:18px;bottom:18px;height:38px;padding:0 14px 0 8px;display:none;align-items:center;gap:8px;pointer-events:auto;z-index:5;cursor:pointer;',
'border-radius:19px;border:1px solid rgba(61,255,162,.5);background:rgba(9,13,18,.95);color:var(--neon);font:700 11px/1 var(--mono);letter-spacing:.16em;box-shadow:0 10px 30px rgba(0,0,0,.5),0 0 18px rgba(61,255,162,.15)}',
'.pill.show{display:flex}',
'.pill:hover{color:#fff}',
'.toast{position:absolute;left:12px;right:12px;bottom:40px;padding:9px 12px;border-radius:9px;border:1px solid var(--line2);background:#0c131b;color:var(--tx);font-size:12.5px;',
'box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;transform:translateY(6px);transition:opacity .18s,transform .18s;pointer-events:none;z-index:3}',
'.toast.show{opacity:1;transform:none}',
'.toast.bad{border-color:rgba(255,84,112,.6);color:#ffc2cc}',
'.toast.ok{border-color:rgba(61,255,162,.5)}',
'.mw{position:fixed;inset:0;display:none;place-items:center;pointer-events:auto;z-index:7;background:rgba(0,0,0,.45);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}',
'.mw.show{display:grid}',
'.mbox{min-width:280px;max-width:min(460px,calc(100vw - 32px));max-height:80vh;overflow:auto;padding:22px 22px 18px;border-radius:14px;border:1px solid var(--line2);background:#0c121a;',
'color:var(--tx);font:15px/1.5 var(--ui);box-shadow:0 30px 80px rgba(0,0,0,.6);white-space:pre-wrap;word-break:break-word;animation:ewpop .18s ease-out}',
'@keyframes ewpop{from{transform:scale(.94);opacity:0}to{transform:none;opacity:1}}',
'.mbox h3{margin:0 0 8px;font:700 13px/1.2 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--neon)}',
'.mbox .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;white-space:normal}'
].join('\n');

// Keyframes + helpers the website itself needs (effects, added stuff).
var BASE_CSS = [
'@keyframes ew-spin{from{rotate:0deg}to{rotate:360deg}}',
'@keyframes ew-wobble{0%,100%{rotate:-2.5deg}50%{rotate:2.5deg}}',
'@keyframes ew-drunk{0%,100%{rotate:-1.4deg;translate:-6px 0}25%{rotate:1deg;translate:4px 3px}50%{rotate:1.8deg;translate:8px -2px}75%{rotate:-1deg;translate:-3px 2px}}',
'@keyframes ew-shake{0%,100%{translate:0 0}10%{translate:-7px 3px}20%{translate:6px -4px}30%{translate:-5px -3px}40%{translate:7px 4px}50%{translate:-6px 2px}60%{translate:5px -5px}70%{translate:-7px -2px}80%{translate:4px 5px}90%{translate:-3px -4px}}',
'@keyframes ew-glitch{0%{text-shadow:2px 0 #ff2a6d,-2px 0 #05d9e8;translate:0 0}20%{text-shadow:-3px 0 #ff2a6d,3px 0 #05d9e8;translate:2px 0}40%{text-shadow:3px 1px #ff2a6d,-3px -1px #05d9e8;translate:-2px 1px}60%{text-shadow:none;translate:0 0}80%{text-shadow:-2px 0 #ff2a6d,2px 0 #05d9e8;translate:1px -1px}}',
'@keyframes ew-bop{0%,100%{translate:0 0}50%{translate:0 -10px}}',
'@keyframes ew-sway{0%,100%{rotate:-6deg}50%{rotate:6deg}}',
'@keyframes ew-marq{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}',
'@keyframes ew-grad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}',
'@keyframes ew-pulse{0%,100%{scale:1}50%{scale:1.07}}'
].join('\n');

// ===== 05-state.js =====
// ---------- what you changed (undo / redo / save / bring back) ----------
//
// Two kinds of changes:
//  * "state": background, effects, CSS box, JS box. Saved as plain settings.
//  * "ops": changes to page elements (text, delete, move, colors, code...).
//    Saved as a list and replayed in order when you come back to the page.

var S = {
  bg: null,
  fx: {},
  fxo: { amount: 1, speed: 1, color: '#3dffa2' },
  css: '',
  js: { code: '', auto: false },
  scope: 'page',
  autosave: true,
  scripts: false
};
var ops = [];
var hist = [], hpos = 0;
var acts = new Map();         // data-ew-id -> { list: [...], block, run }
var KEYS = null;              // storage keys, fixed when the editor starts

function makeKeys() {
  var l = W.location;
  var page = l.protocol === 'file:' || l.origin === 'null' ? l.href.split('#')[0] : l.origin + l.pathname + l.search;
  var site = l.protocol === 'file:' || l.origin === 'null' ? page : l.origin;
  KEYS = { page: 'ew:' + page, site: 'ew:site:' + site };
}
function curKey() { return S.scope === 'site' ? KEYS.site : KEYS.page; }

// ----- element ops -----
// Each one changes the page and returns a function that puts it back.
var OPS = {
  text: function (op, el) {
    var prev = el.textContent;
    el.textContent = op.v;
    return function () { el.textContent = prev; };
  },
  html: function (op, el) {
    var prev = Array.prototype.slice.call(el.childNodes);
    setHTML(el, op.v);
    return function () { empty(el); prev.forEach(function (n) { el.appendChild(n); }); };
  },
  outer: function (op, el) {
    var parent = el.parentNode, fresh = htmlToNodes(op.v, parent);
    fresh.forEach(function (n) { parent.insertBefore(n, el); });
    el.remove();
    return function () {
      var at = fresh[0] && fresh[0].parentNode ? fresh[0] : null;
      if (at) at.parentNode.insertBefore(el, at); else parent.appendChild(el);
      fresh.forEach(function (n) { n.remove(); });
    };
  },
  del: function (op, el) {
    var parent = el.parentNode, next = el.nextSibling;
    el.remove();
    return function () { parent.insertBefore(el, next && next.parentNode === parent ? next : null); };
  },
  style: function (op, el) {
    var prev = {};
    for (var k in op.p) {
      prev[k] = [el.style.getPropertyValue(k), el.style.getPropertyPriority(k)];
      if (op.p[k] == null || op.p[k] === '') el.style.removeProperty(k);
      else el.style.setProperty(k, op.p[k], 'important');
    }
    return function () {
      for (var k in prev) {
        if (prev[k][0]) el.style.setProperty(k, prev[k][0], prev[k][1]); else el.style.removeProperty(k);
      }
      cleanStyle(el);
    };
  },
  attr: function (op, el) {
    var had = el.hasAttribute(op.n), prev = el.getAttribute(op.n);
    if (op.v == null) el.removeAttribute(op.n); else safeAttr(el, op.n, op.v);
    return function () { if (had) safeAttr(el, op.n, prev); else el.removeAttribute(op.n); };
  },
  dup: function (op, el) {
    var c = el.cloneNode(true);
    if (c.removeAttribute) { c.removeAttribute('id'); }
    el.parentNode.insertBefore(c, el.nextSibling);
    return function () { c.remove(); };
  },
  img: function (op, el) { return swapPicture(el, op.v); },
  add: function (op) {
    var el = buildAdded(op.spec);
    (D.body || HTML).appendChild(el);
    if (op.spec.a) acts.set(op.spec.id, copy(op.spec.a));
    runawayRefresh();
    return function () { el.remove(); acts.delete(op.spec.id); runawayRefresh(); };
  },
  act: function (op, el) {
    var had = el.getAttribute('data-ew-id'), prev = had ? acts.get(had) : null;
    el.setAttribute('data-ew-id', op.id);
    var a = op.a || {};
    if ((a.list && a.list.length) || a.block || a.run) acts.set(op.id, copy(a)); else acts.delete(op.id);
    runawayRefresh();
    return function () {
      acts.delete(op.id);
      if (had) { el.setAttribute('data-ew-id', had); if (prev) acts.set(had, prev); }
      else if (!el.hasAttribute('data-ew-add')) el.removeAttribute('data-ew-id');
      runawayRefresh();
    };
  },
  replace: function (op) { return replaceWords(op.f, op.r); },
  imgall: function (op) { return replaceAllPictures(op.v); }
};
function applyOp(op, el) {
  try { return OPS[op.t] ? OPS[op.t](op, el) || null : null; }
  catch (e) { console.warn('[Edit Website] change failed', op.t, e); return null; }
}

// Make an element change and remember it.
// o.el: the element (skips looking it up)   o.merge: key to glue slider drags into one undo step
// o.undo: the change is ALREADY on the page (dragging, typing); just record it with this undo
function change(op, label, o) {
  o = o || {};
  var el = op.s ? (o.el || $(op.s)) : null;
  if (op.s && !el) { toast('Couldn\'t find that thing on the page anymore', 'bad'); return false; }
  var top = hist[hpos - 1];
  if (o.merge && top && top.merge === o.merge && hpos === hist.length && top.op && ops[ops.length - 1] === top.op && now() - top.time < 3000) {
    if (!o.undo) applyOp(op, el);
    ops[ops.length - 1] = op; top.op = op; top.time = now();
    afterChange();
    return true;
  }
  var undoFn = o.undo || applyOp(op, el);
  if (!undoFn) { toast('That change didn\'t work on this page', 'bad'); return false; }
  hist.length = hpos;
  hist.push({ label: label, op: op, undo: undoFn, merge: o.merge, time: now() });
  hpos++;
  ops.push(op);
  afterChange();
  return true;
}

// Change background / effects / CSS / JS settings and remember it.
function setState(key, val, label, merge) {
  var top = hist[hpos - 1];
  if (merge && top && top.key === key && top.merge === merge && hpos === hist.length && now() - top.time < 3000) {
    S[key] = val; top.next = copy(val); top.time = now();
    applyState(key); afterChange();
    return;
  }
  var prev = copy(S[key]);
  S[key] = val;
  applyState(key);
  hist.length = hpos;
  hist.push({ label: label, key: key, prev: prev, next: copy(val), merge: merge, time: now() });
  hpos++;
  afterChange();
}
function applyState(key) {
  if (key === 'bg') bgApply();
  else if (key === 'fx' || key === 'fxo') fxApply();
  else if (key === 'css') cssApply();
}

function undo() {
  if (!hpos) { toast('Nothing to undo'); return; }
  var e = hist[--hpos];
  if (e.key) { S[e.key] = copy(e.prev); applyState(e.key); }
  else {
    try { e.undo(); } catch (x) { console.warn(x); }
    var i = ops.lastIndexOf(e.op); if (i >= 0) ops.splice(i, 1);
  }
  afterChange();
  toast('Undo: ' + e.label);
}
function redo() {
  if (hpos >= hist.length) { toast('Nothing to redo'); return; }
  var e = hist[hpos++];
  if (e.key) { S[e.key] = copy(e.next); applyState(e.key); }
  else {
    var u = applyOp(e.op, e.op.s ? $(e.op.s) : null);
    if (u) { e.undo = u; ops.push(e.op); }
    else { hist.splice(hpos - 1, 1); hpos--; toast('Couldn\'t redo that one', 'bad'); afterChange(); return; }
  }
  afterChange();
  toast('Redo: ' + e.label);
}
function goToHistory(n) {
  while (hpos > n) undo();
  while (hpos < n && hpos < hist.length) redo();
}

function afterChange() {
  scheduleSave();
  if (ui) { refreshTop(); if (curTab === 'save') renderTab(); }
  if (P.sel && !P.sel.isConnected) select(null);
}

// ----- saving + bringing changes back -----
var saveT = 0, saving = false;
function project() {
  return {
    v: 1, key: curKey(), url: location.href.split('#')[0], title: D.title, scope: S.scope, saved: now(),
    ops: ops, bg: S.bg, fx: S.fx, fxo: S.fxo, css: S.css, js: S.js
  };
}
function countChanges(p) {
  p = p || project();
  var n = (p.ops || []).length + (p.bg && p.bg.mode !== 'none' ? 1 : 0) + Object.keys(p.fx || {}).length + (p.css ? 1 : 0) + (p.js && p.js.code && p.js.auto ? 1 : 0);
  return n;
}
function scheduleSave() {
  if (!S.autosave) { setStatus(); return; }
  clearTimeout(saveT);
  saving = true; setStatus();
  saveT = setTimeout(saveNow, 700);
}
function saveNow() {
  clearTimeout(saveT);
  var p = project(), k = p.key;
  var job = countChanges(p) ? store.set(k, p) : store.del(k);
  return job.then(function () { saving = false; setStatus(); }, function (e) {
    saving = false; setStatus();
    toast('Couldn\'t save: ' + (e && e.message || e) + '. A picture or video might be too big.', 'bad', 6000);
  });
}

// Put a saved project back on the page.
var restoring = false;
function applyProject(p, done) {
  if (!p) { if (done) done(0); return; }
  if (p.scope) S.scope = p.scope;
  if (p.fxo) S.fxo = Object.assign({}, S.fxo, p.fxo);
  if (p.bg) { S.bg = p.bg; bgApply(); }
  if (p.fx && Object.keys(p.fx).length) { S.fx = Object.assign({}, p.fx); fxApply(); }
  if (p.css) { S.css = p.css; cssApply(); }
  if (p.js) { S.js = Object.assign({ code: '', auto: false }, p.js); if (S.js.auto && S.js.code) runCode(S.js.code); }
  if (p.acts) for (var id in p.acts) acts.set(id, p.acts[id]);
  replay(p.ops || [], done);
  runawayRefresh();
}

// Replay saved element changes. Sites often build their content after
// loading, so wait (up to ~10s) for each element to show up.
function replay(list, done) {
  var i = 0, deadline = now() + 10000, missed = 0, tm = 0;
  restoring = list.length > 0;
  function step() {
    while (i < list.length) {
      var op = list[i], el = null;
      if (op.s) {
        el = $(op.s);
        if (!el) {
          if (now() < deadline) return;
          missed++; ops.push(op); i++; continue; // keep it saved, maybe it shows up next time
        }
      }
      applyOp(op, el);
      ops.push(op);
      i++;
    }
    clearInterval(tm);
    restoring = false;
    if (ui) { refreshTop(); renderTab(); }
    if (done) done(list.length - missed, missed);
  }
  tm = setInterval(step, 300);
  step();
}

// ===== 06-ui.js =====
// ---------- the floating editor window ----------

var host = null, root = null, ui = false;
var panel, pill, bodyEl, tabsEl, statusEl, dotEl, toastEl, undoBtn, redoBtn;
var hlBox, hlLbl, selBox, selLbl, fxLayer, fxLayer2, fxCanvas, modalWrap;
var curTab = 'pick';
var TABS = [['pick', 'Pick'], ['code', 'Code'], ['bg', 'Background'], ['fx', 'Effects'], ['add', 'Add'], ['cssjs', 'CSS/JS'], ['save', 'Save']];
var docSheets = new Set();

// Stylesheets on the website itself. adoptedStyleSheets can't be blocked by
// a site's security rules, unlike <style> tags.
function docSheet(text) {
  var sh;
  try {
    sh = new CSSStyleSheet();
    sh.replaceSync(text || '');
    D.adoptedStyleSheets = Array.prototype.slice.call(D.adoptedStyleSheets || []).concat([sh]);
  } catch (e) {
    var st = D.createElement('style');
    st.setAttribute('data-ew-internal', '');
    st.textContent = text || '';
    (D.head || HTML).appendChild(st);
    sh = { replaceSync: function (t) { st.textContent = t; }, el: st };
  }
  docSheets.add(sh);
  return sh;
}
function keepSheets() {
  try {
    var cur = Array.prototype.slice.call(D.adoptedStyleSheets || []), missing = [];
    docSheets.forEach(function (sh) { if (!sh.el && cur.indexOf(sh) < 0) missing.push(sh); });
    if (missing.length) D.adoptedStyleSheets = cur.concat(missing);
  } catch (e) {}
}
var baseSheet = null;
function ensureBase() { if (!baseSheet) baseSheet = docSheet(BASE_CSS); }

// Overlays shared by the editor and downloaded pages.
function buildHost() {
  if (host) { if (!host.isConnected) HTML.appendChild(host); return; }
  ensureBase();
  host = D.createElement('ew-root');
  host.setAttribute('data-ew-internal', '');
  css(host, { all: 'initial', position: 'fixed', inset: '0', 'z-index': '2147483647', 'pointer-events': 'none', display: 'block', contain: 'layout style' }, true);
  // (test pages mark <html data-ew-test> so automated tests can reach inside)
  root = host.attachShadow({ mode: HTML.hasAttribute('data-ew-test') ? 'open' : 'closed' });
  try {
    var sh = new CSSStyleSheet(); sh.replaceSync(UI_CSS); root.adoptedStyleSheets = [sh];
  } catch (e) { root.appendChild(h('style', { text: UI_CSS })); }
  fxLayer = h('div', { class: 'fxl' });
  fxLayer2 = h('div', { class: 'fxl fxr' });
  fxCanvas = h('canvas', { class: 'fxc' });
  hlLbl = h('span', { class: 'lbl' });
  hlBox = h('div', { class: 'hl' }, hlLbl);
  selLbl = h('span', { class: 'lbl' });
  selBox = h('div', { class: 'selb' }, selLbl,
    h('div', { class: 'grip mv', title: 'Drag to move it', onpointerdown: function (e) { gripDown(e, 'move'); } }, icon('move', 14)),
    h('div', { class: 'grip sz', title: 'Drag to resize it', onpointerdown: function (e) { gripDown(e, 'size'); } }));
  modalWrap = h('div', { class: 'mw' });
  root.append(fxLayer, fxLayer2, fxCanvas, hlBox, selBox, modalWrap);
  HTML.appendChild(host);
  // Keep keyboard + wheel events inside the editor from reaching the site
  // (otherwise typing "k" in our code box pauses YouTube, etc).
  ['keydown', 'keyup', 'keypress', 'input', 'wheel'].forEach(function (t) {
    host.addEventListener(t, function (e) { if (t !== 'wheel' || isInPanel(e)) e.stopPropagation(); });
  });
  setInterval(function () { if (host && !host.isConnected) HTML.appendChild(host); }, 2000);
}
function isInPanel(e) {
  var p = e.composedPath ? e.composedPath() : [];
  return p.indexOf(panel) >= 0;
}

function buildUI() {
  if (ui) return;
  buildHost();
  undoBtn = h('button', { class: 'ib', title: 'Undo (Ctrl+Z)', onclick: undo }, icon('undo'));
  redoBtn = h('button', { class: 'ib', title: 'Redo (Ctrl+Y)', onclick: redo }, icon('redo'));
  var hd = h('div', { class: 'hd' },
    h('div', { class: 'mark' }, icon('code', 14)),
    h('div', { class: 'ttl', text: 'EDIT WEBSITE' }),
    h('span', { class: 'ver', text: 'v' + VERSION }),
    h('div', { class: 'sp' }),
    undoBtn, redoBtn,
    h('button', { class: 'ib', title: 'Shrink to a little button', onclick: minimize }, icon('min')),
    h('button', { class: 'ib', title: 'Close the editor (your changes stay)', onclick: close }, icon('close')));
  tabsEl = h('div', { class: 'tabs' });
  TABS.forEach(function (t) {
    tabsEl.appendChild(h('button', { class: 'tab', 'data-t': t[0], text: t[1], onclick: function () { showTab(t[0]); } }));
  });
  bodyEl = h('div', { class: 'body' });
  dotEl = h('span', { class: 'dot' });
  statusEl = h('span', { class: 'st' });
  toastEl = h('div', { class: 'toast' });
  var rz = h('div', { class: 'rz', title: 'Drag to resize the editor' });
  panel = h('div', { class: 'panel' }, hd, tabsEl, bodyEl, h('div', { class: 'ft' }, dotEl, statusEl), toastEl, rz);
  pill = h('div', { class: 'pill', title: 'Open Edit Website', onclick: function () { open(); } }, h('div', { class: 'mark' }, icon('code', 14)), 'EDIT');
  root.append(panel, pill);
  dragPanel(hd);
  resizePanel(rz);
  ui = true;
  showTab(curTab);
  refreshTop();
}

function dragPanel(handle) {
  handle.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || (e.target.closest && e.target.closest('button'))) return;
    var r = panel.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    handle.setPointerCapture(e.pointerId);
    function mv(ev) {
      var x = clamp(r.left + ev.clientX - sx, 8 - r.width + 80, innerWidth - 80);
      var y = clamp(r.top + ev.clientY - sy, 0, innerHeight - 44);
      css(panel, { left: x + 'px', top: y + 'px', right: 'auto' });
    }
    function up() { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); }
    handle.addEventListener('pointermove', mv);
    handle.addEventListener('pointerup', up);
  });
}
function resizePanel(grip) {
  grip.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var r = panel.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    grip.setPointerCapture(e.pointerId);
    css(panel, { left: r.left + 'px', top: r.top + 'px', right: 'auto' });
    function mv(ev) {
      var w = clamp(r.width - (ev.clientX - sx), 330, Math.min(900, innerWidth - 16));
      var hh = clamp(r.height + (ev.clientY - sy), 300, innerHeight - r.top - 8);
      css(panel, { width: w + 'px', height: hh + 'px', left: (r.right - w) + 'px' });
    }
    function up() { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); }
    grip.addEventListener('pointermove', mv);
    grip.addEventListener('pointerup', up);
  });
}

function showTab(t) {
  curTab = t;
  Array.prototype.forEach.call(tabsEl.children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
  renderTab();
  bodyEl.scrollTop = 0;
}
function renderTab() {
  if (!ui) return;
  var keep = bodyEl.scrollTop;
  empty(bodyEl);
  ({ pick: renderPick, code: renderCode, bg: renderBg, fx: renderFx, add: renderAdd, cssjs: renderCssJs, save: renderSave })[curTab]();
  bodyEl.scrollTop = keep;
}

function refreshTop() {
  if (!ui) return;
  undoBtn.disabled = hpos === 0;
  redoBtn.disabled = hpos >= hist.length;
  undoBtn.title = hpos ? 'Undo: ' + hist[hpos - 1].label + ' (Ctrl+Z)' : 'Nothing to undo';
  redoBtn.title = hpos < hist.length ? 'Redo: ' + hist[hpos].label + ' (Ctrl+Y)' : 'Nothing to redo';
  setStatus();
}
function setStatus() {
  if (!ui) return;
  var n = countChanges(), where = location.hostname || 'this file';
  var txt = n + (n === 1 ? ' change' : ' changes') + ' \u00b7 ' + where;
  if (restoring) txt = 'Bringing back your changes\u2026';
  else if (!S.autosave) txt += ' \u00b7 auto-save OFF';
  else if (saving) txt += ' \u00b7 saving\u2026';
  else if (n) txt += ' \u00b7 saved';
  statusEl.textContent = txt;
  dotEl.classList.toggle('busy', saving || restoring || !S.autosave);
}

var toastT = 0;
function toast(msg, kind, ms) {
  if (!ui) { if (kind === 'bad') console.warn('[Edit Website]', msg); return; }
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastT);
  toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2600);
}

// Popup box (used by "show a popup" actions and confirms)
function modal(title, message, buttons) {
  buildHost();
  empty(modalWrap);
  var acts = h('div', { class: 'acts' });
  var box = h('div', { class: 'mbox', role: 'dialog' }, title ? h('h3', { text: title }) : null, message, acts);
  function shut() { modalWrap.classList.remove('show'); empty(modalWrap); }
  (buttons || [['OK', null, 'pri']]).forEach(function (b) {
    acts.appendChild(h('button', { class: 'btn ' + (b[2] || ''), text: b[0], onclick: function () { shut(); if (b[1]) b[1](); } }));
  });
  modalWrap.appendChild(box);
  modalWrap.onclick = function (e) { if (e.target === modalWrap) shut(); };
  modalWrap.classList.add('show');
  var first = acts.querySelector('.pri') || acts.firstChild;
  if (first) setTimeout(function () { first.focus(); }, 30);
  return shut;
}
function confirmBox(title, message, yesLabel, yes) {
  modal(title, message, [['Cancel', null, ''], [yesLabel, yes, 'pri']]);
}
function modalOpen() { return modalWrap && modalWrap.classList.contains('show'); }
function modalClose() { if (modalWrap) { modalWrap.classList.remove('show'); empty(modalWrap); } }

// ----- little UI builders for the tabs -----
function sec(title) {
  var s = h('div', { class: 'sec' }, title ? h('h4', { text: title }) : null);
  for (var i = 1; i < arguments.length; i++) append(s, arguments[i]);
  return s;
}
function btn(label, onclick, cls, title, ic) {
  return h('button', { class: 'btn ' + (cls || ''), title: title || null, onclick: onclick }, ic ? icon(ic) : null, label);
}
function row(label) {
  var r = h('div', { class: 'row' }, h('label', { text: label }));
  for (var i = 1; i < arguments.length; i++) append(r, arguments[i]);
  return r;
}
function slider(min, max, step, val, fmt, oninput) {
  var out = h('span', { class: 'val', text: fmt(val) });
  var r = h('input', { type: 'range', min: min, max: max, step: step, value: val });
  r.addEventListener('input', function () { var v = parseFloat(r.value); out.textContent = fmt(v); oninput(v); });
  return [r, out];
}
function colorIn(val, oninput) {
  var c = h('input', { type: 'color', value: val });
  c.addEventListener('input', function () { oninput(c.value); });
  return c;
}
function textIn(val, placeholder, oninput, ms) {
  var i = h('input', { class: 'in', type: 'text', value: val || '', placeholder: placeholder || '' });
  var f = ms ? debounce(function () { oninput(i.value); }, ms) : function () { oninput(i.value); };
  i.addEventListener('input', f);
  return i;
}
function selectIn(options, val, onchange) {
  var s = h('select', { class: 'in' });
  options.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
  s.value = val;
  s.addEventListener('change', function () { onchange(s.value); });
  return s;
}
function seg(options, val, onpick) {
  var s = h('div', { class: 'seg' });
  options.forEach(function (o) {
    s.appendChild(h('button', { class: 'btn sm' + (o[0] === val ? ' on' : ''), text: o[1], title: o[2] || null, onclick: function () { onpick(o[0]); } }));
  });
  return s;
}
function swatches(colors, onpick) {
  var s = h('div', { class: 'sw' });
  colors.forEach(function (c) {
    var b = h('button', { title: c, onclick: function () { onpick(c); } });
    css(b, { background: c });
    s.appendChild(b);
  });
  return s;
}
var SWATCHES = ['#000000', '#0b0f19', '#ffffff', '#ff2a6d', '#ff7a18', '#ffd60a', '#3dffa2', '#2de2ff', '#3a86ff', '#8338ec', '#ff4fa3', '#7c5c3b'];

// ===== 07-pick.js =====
// ---------- PICK: point at anything, then change it ----------

var P = { on: false, mode: 'select', sel: null, hover: null, cb: null, editing: null, editOrig: null, editAll: false };

function realTarget(e) {
  var t = e.target;
  if (!t || t.nodeType !== 1 || isOurs(t)) return null;
  return t;
}
function swallow(e) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }

function pick(on, cb) {
  if (on === P.on && !cb) return;
  P.on = on;
  P.cb = on ? cb || null : null;
  var add = on ? 'addEventListener' : 'removeEventListener';
  W[add]('pointermove', pickMove, true);
  W[add]('mouseover', pickMove, true);
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick', 'touchstart', 'touchend', 'submit'].forEach(function (t) { W[add](t, pickSwallow, true); });
  W[add]('click', pickClick, true);
  if (!on) { P.hover = null; place(hlBox, null); }
  if (ui && curTab === 'pick') renderTab();
}
function pickMove(e) {
  var t = realTarget(e);
  P.hover = t;
  place(hlBox, t, hlLbl);
  if (hlBox) hlBox.classList.toggle('del', P.mode !== 'select' && !P.cb);
}
function pickSwallow(e) { if (realTarget(e)) swallow(e); }
function pickClick(e) {
  var t = realTarget(e);
  if (!t) return;
  swallow(e);
  if (P.cb) { var cb = P.cb; pick(false); cb(t); return; }
  if (P.mode === 'delete') { deleteEl(t); return; }
  if (P.mode === 'explode') { explodeEl(t); return; }
  pick(false);
  select(t);
}

// Position the cyan hover box / green selection box over an element.
function place(box, el, lbl) {
  if (!box) return;
  if (!el || !el.isConnected) { box.style.display = 'none'; return; }
  var r = el.getBoundingClientRect();
  css(box, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: Math.max(2, r.width) + 'px', height: Math.max(2, r.height) + 'px' });
  if (lbl) {
    lbl.textContent = elName(el) + '  ' + Math.round(r.width) + '\u00d7' + Math.round(r.height);
    lbl.classList.toggle('below', r.top < 26);
  }
  if (box === selBox) box.classList.toggle('edge', r.top < 14 || r.left < 14);
}

function select(el, from) {
  if (P.editing && P.editing !== el) stopEditText();
  P.sel = el || null;
  if (P.sel) tickAdd(selTick); else { tickDel(selTick); place(selBox, null); }
  if (P.sel) selTick();
  if (!ui) return;
  if (curTab === 'pick') renderTab();
  else if (curTab === 'code') { if (from !== 'tree') treeReveal(P.sel); if (from !== 'editor') edLoad(P.sel); }
}
function selTick() {
  if (!P.sel) return;
  if (!P.sel.isConnected) { select(null); return; }
  place(selBox, P.sel, selLbl);
}

// ----- moving / resizing with the green grips -----
function parsePair(v) {
  var m = String(v || '').match(/-?[\d.]+/g) || [];
  return [parseFloat(m[0]) || 0, parseFloat(m[1]) || 0];
}
function gripDown(e, kind) {
  var el = P.sel;
  if (!el || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  var grip = e.currentTarget, sx = e.clientX, sy = e.clientY;
  var props = kind === 'move' ? ['translate'] : ['width', 'height', 'box-sizing', 'display', 'max-width', 'max-height'];
  var before = {};
  props.forEach(function (k) { before[k] = [el.style.getPropertyValue(k), el.style.getPropertyPriority(k)]; });
  var start = parsePair(el.style.getPropertyValue('translate'));
  var r = el.getBoundingClientRect(), inline = getComputedStyle(el).display === 'inline';
  grip.setPointerCapture(e.pointerId);
  function mv(ev) {
    var dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (kind === 'move') el.style.setProperty('translate', Math.round(start[0] + dx) + 'px ' + Math.round(start[1] + dy) + 'px', 'important');
    else {
      if (inline) el.style.setProperty('display', 'inline-block', 'important');
      el.style.setProperty('box-sizing', 'border-box', 'important');
      el.style.setProperty('max-width', 'none', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('width', Math.max(6, Math.round(r.width + dx)) + 'px', 'important');
      el.style.setProperty('height', Math.max(6, Math.round(r.height + dy)) + 'px', 'important');
    }
    selTick();
  }
  function up() {
    grip.removeEventListener('pointermove', mv);
    grip.removeEventListener('pointerup', up);
    grip.removeEventListener('pointercancel', up);
    var p = {}, changed = false;
    props.forEach(function (k) {
      p[k] = el.style.getPropertyValue(k);
      if (p[k] !== before[k][0]) changed = true;
    });
    if (!changed) return;
    change({ t: 'style', s: cssPath(el), p: p }, (kind === 'move' ? 'Move ' : 'Resize ') + elName(el), {
      el: el,
      undo: function () { props.forEach(function (k) { if (before[k][0]) el.style.setProperty(k, before[k][0], before[k][1]); else el.style.removeProperty(k); }); }
    });
    if (curTab === 'pick') renderTab();
  }
  grip.addEventListener('pointermove', mv);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
}
function nudge(dx, dy) {
  var el = P.sel; if (!el) return;
  var t = parsePair(el.style.getPropertyValue('translate'));
  styleOp(el, { translate: (t[0] + dx) + 'px ' + (t[1] + dy) + 'px' }, 'Nudge ' + elName(el), 'nudge');
}

// One style change on one element (sliders glue into one undo step).
function styleOp(el, p, label, mergeKey) {
  var sel = cssPath(el);
  return change({ t: 'style', s: sel, p: p }, label, { el: el, merge: mergeKey ? mergeKey + '|' + sel + '|' + Object.keys(p).join(',') : null });
}

// ----- deleting, exploding, copying -----
function deleteEl(el) {
  if (!el || el === HTML || el === D.body || el === D.head) { toast('Can\'t delete the whole page'); return; }
  var name = elName(el);
  if (P.sel && (P.sel === el || el.contains(P.sel))) select(null);
  change({ t: 'del', s: cssPath(el) }, 'Delete ' + name, { el: el });
  place(hlBox, null);
}
function explodeEl(el) {
  if (!el || el === HTML || el === D.body) return;
  var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  var cols = [toHex(cs.color, '#ffffff'), toHex(cs.backgroundColor, S.fxo.color), '#ffd60a', '#ff7a18', '#ff2a6d'];
  burst(r.left + r.width / 2, r.top + r.height / 2, Math.min(160, 40 + Math.sqrt(r.width * r.height) / 3), cols, Math.max(r.width, r.height) / 2);
  playSound('boom');
  deleteEl(el);
}

// ----- editing text right on the page -----
function startEditText(el) {
  if (!el) return;
  stopEditText();
  P.editing = el;
  P.editOrig = Array.prototype.slice.call(el.childNodes).map(function (n) { return n.cloneNode(true); });
  P.editHTML = el.innerHTML;
  P.editCE = el.getAttribute('contenteditable');
  el.setAttribute('contenteditable', 'true');
  el.focus();
  try { var rg = D.createRange(); rg.selectNodeContents(el); rg.collapse(false); var s = W.getSelection(); s.removeAllRanges(); s.addRange(rg); } catch (e) {}
  if (curTab === 'pick') renderTab();
}
function stopEditText() {
  var el = P.editing;
  if (!el) return;
  P.editing = null;
  if (P.editCE == null) el.removeAttribute('contenteditable'); else el.setAttribute('contenteditable', P.editCE);
  if (el.innerHTML !== P.editHTML) {
    var orig = P.editOrig;
    change({ t: 'html', s: cssPath(el), v: el.innerHTML }, 'Edit text in ' + elName(el), {
      el: el,
      undo: function () { empty(el); orig.forEach(function (n) { el.appendChild(n); }); }
    });
  }
  if (ui && curTab === 'pick') renderTab();
}

// "Edit any text" mode: the whole page becomes typeable.
var editAllMap = new Map();
function editAll(on) {
  if (!D.body || on === P.editAll) return;
  P.editAll = on;
  if (on) {
    P.bodyCE = D.body.getAttribute('contenteditable');
    D.body.setAttribute('contenteditable', 'true');
    D.addEventListener('beforeinput', editAllBefore, true);
    D.addEventListener('input', editAllCommitSoon, true);
    toast('Click any text on the page and type. Turn this off when you\'re done.', 'ok', 4000);
  } else {
    editAllCommit();
    D.removeEventListener('beforeinput', editAllBefore, true);
    D.removeEventListener('input', editAllCommitSoon, true);
    if (P.bodyCE == null) D.body.removeAttribute('contenteditable'); else D.body.setAttribute('contenteditable', P.bodyCE);
  }
  if (ui && curTab === 'pick') renderTab();
}
function blockOf(node) {
  var el = node && node.nodeType === 1 ? node : node && node.parentElement;
  var first = el;
  while (el && el !== D.body) {
    var d = getComputedStyle(el).display;
    if (d !== 'inline' && d !== 'contents') return el;
    el = el.parentElement;
  }
  return first && first !== D.body ? first : null;
}
function editAllBefore() {
  var s = W.getSelection();
  var b = s && s.anchorNode ? blockOf(s.anchorNode) : null;
  if (b && !isOurs(b) && !editAllMap.has(b)) {
    editAllMap.set(b, { html: b.innerHTML, nodes: Array.prototype.slice.call(b.childNodes).map(function (n) { return n.cloneNode(true); }) });
  }
}
var editAllCommitSoon = debounce(function () { editAllCommit(); }, 1500);
function editAllCommit() {
  editAllMap.forEach(function (orig, el) {
    if (!el.isConnected || el.innerHTML === orig.html) return;
    change({ t: 'html', s: cssPath(el), v: el.innerHTML }, 'Edit text in ' + elName(el), {
      el: el, undo: function () { empty(el); orig.nodes.forEach(function (n) { el.appendChild(n); }); }
    });
  });
  editAllMap.clear();
}

// ----- swapping a picture -----
function swapPicture(el, src) {
  var r0 = el.getBoundingClientRect();
  if (el.localName === 'img') {
    var prev = { src: el.getAttribute('src'), srcset: el.getAttribute('srcset'), sizes: el.getAttribute('sizes') };
    var sources = el.parentElement && el.parentElement.localName === 'picture'
      ? $$('source', el.parentElement).map(function (s) { return [s, s.getAttribute('srcset')]; }) : [];
    sources.forEach(function (p) { p[0].removeAttribute('srcset'); });
    el.removeAttribute('srcset'); el.removeAttribute('sizes');
    el.setAttribute('src', src);
    var undoFb = pictureFallback(el, src, r0);
    return function () {
      undoFb();
      ['src', 'srcset', 'sizes'].forEach(function (k) { if (prev[k] != null) el.setAttribute(k, prev[k]); else el.removeAttribute(k); });
      sources.forEach(function (p) { if (p[1] != null) p[0].setAttribute('srcset', p[1]); });
    };
  }
  return OPS.style({ p: { 'background-image': 'url("' + src + '")', 'background-size': 'cover', 'background-position': 'center' } }, el);
}
// Strict sites can block data: pictures. If that happens, paint the picture
// onto a canvas instead (canvases can't be blocked).
function pictureFallback(img, src, r0) {
  var cv = null, dead = false;
  function onErr() {
    if (dead || !/^data:/.test(src)) return;
    createImageBitmap(dataToBlob(src)).then(function (bmp) {
      if (dead) return;
      var w = Math.round(r0.width) || 200, hh = Math.round(r0.height) || 150;
      cv = D.createElement('canvas');
      cv.setAttribute('data-ew-internal', '');
      cv.width = w; cv.height = hh;
      var sc = Math.max(w / bmp.width, hh / bmp.height);
      cv.getContext('2d').drawImage(bmp, (w - bmp.width * sc) / 2, (hh - bmp.height * sc) / 2, bmp.width * sc, bmp.height * sc);
      css(cv, { width: w + 'px', height: hh + 'px', display: 'inline-block', 'vertical-align': 'middle' });
      img.style.setProperty('display', 'none', 'important');
      img.parentNode.insertBefore(cv, img.nextSibling);
    }).catch(function () {});
  }
  img.addEventListener('error', onErr, { once: true });
  return function () {
    dead = true;
    img.removeEventListener('error', onErr);
    if (cv) { cv.remove(); img.style.removeProperty('display'); }
  };
}

// ======================= the PICK tab =======================
var FONTS = [['', 'Site\'s own'], ['Arial, sans-serif', 'Arial'], ['"Segoe UI", system-ui, sans-serif', 'Segoe UI'], ['Georgia, serif', 'Georgia'],
  ['"Times New Roman", serif', 'Times New Roman'], ['Impact, "Arial Black", sans-serif', 'Impact'], ['"Comic Sans MS", "Comic Neue", cursive', 'Comic Sans'],
  ['"Courier New", monospace', 'Courier New'], ['Consolas, "Cascadia Code", monospace', 'Consolas'], ['"Trebuchet MS", sans-serif', 'Trebuchet'],
  ['Verdana, sans-serif', 'Verdana'], ['"Brush Script MT", cursive', 'Brush Script'], ['fantasy', 'Fantasy']];

function renderPick() {
  var b = bodyEl;
  var pickLabel = P.on ? (P.cb ? 'Click the thing you want\u2026' : P.mode === 'select' ? 'Picking\u2026 click anything (Esc to stop)' : P.mode === 'delete' ? 'Click things to DELETE them (Esc to stop)' : 'Click things to BLOW THEM UP (Esc to stop)') : 'Pick something on the page';
  var pb = btn(pickLabel, function () { pick(!P.on); }, 'big pri' + (P.on ? ' live' : ''), 'Then click anything on the website', 'pick');
  b.appendChild(sec(null, pb,
    h('div', { class: 'row' }, h('label', { text: 'Clicking does' }),
      h('div', { class: 'grow' }, seg([['select', 'Select', 'Pick a thing to change it'], ['delete', 'Delete', 'Every click deletes'], ['explode', 'Explode', 'Every click blows it up']], P.mode, function (m) {
        P.mode = m; if (m !== 'select') pick(true); renderTab();
      }))),
    h('div', { class: 'row' }, h('label', { text: 'Type anywhere' }),
      h('div', { class: 'grow' }, btn(P.editAll ? 'Edit any text: ON' : 'Edit any text: OFF', function () { editAll(!P.editAll); }, P.editAll ? 'on' : '', 'Make every word on the page typeable', 'text')))));

  var el = P.sel;
  if (!el || !el.isConnected) {
    b.appendChild(sec('Start here', h('div', { class: 'help' },
      h('ol', null,
        h('li', null, 'Hit ', h('b', { text: 'Pick something' }), ', then click anything on the website.'),
        h('li', null, 'Change it with the buttons that show up here: text, colors, size, pictures, what it does when clicked.'),
        h('li', null, 'Drag the ', h('b', { text: 'green square' }), ' to move it, the little corner to resize it.'),
        h('li', null, 'Everything saves by itself and comes back next time.')),
      h('div', { class: 'mt' }, h('span', { class: 'kbd', text: 'Ctrl+Z' }), ' undo  ', h('span', { class: 'kbd', text: 'Ctrl+Y' }), ' redo  ',
        h('span', { class: 'kbd', text: 'Del' }), ' delete  ', h('span', { class: 'kbd', text: 'Arrows' }), ' nudge  ', h('span', { class: 'kbd', text: 'Esc' }), ' stop'))));
    return;
  }

  // what's selected + where it lives
  var crumbs = h('div', { class: 'crumbs' }), chain = [];
  for (var n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
  chain.slice(-5).forEach(function (c, i, arr) {
    crumbs.appendChild(h('span', { class: c === el ? 'me' : '', text: elName(c), title: 'Select this', onclick: function () { select(c); } }));
    if (i < arr.length - 1) crumbs.appendChild(D.createTextNode('\u203a'));
  });
  var r = el.getBoundingClientRect();
  var editing = P.editing === el;
  b.appendChild(h('div', { class: 'card' }, crumbs,
    h('div', { class: 'selname', text: '<' + elName(el) + '>' }),
    h('div', { class: 'dimtx', text: Math.round(r.width) + ' \u00d7 ' + Math.round(r.height) + ' px' + (el.hasAttribute('data-ew-add') ? ' \u00b7 added by you' : '') }),
    h('div', { class: 'grid mt' },
      btn(editing ? 'Done typing' : 'Edit text', function () { editing ? stopEditText() : startEditText(el); }, editing ? 'on' : '', 'Type right on the page', 'text'),
      btn('Delete', function () { deleteEl(el); }, 'bad', 'Remove it (Del key)', 'trash'),
      btn('Copy', function () { change({ t: 'dup', s: cssPath(el) }, 'Copy ' + elName(el), { el: el }); }, '', 'Make a copy right after it', 'copy'),
      btn(el.style.getPropertyValue('visibility') === 'hidden' ? 'Show' : 'Hide', function () {
        styleOp(el, { visibility: el.style.getPropertyValue('visibility') === 'hidden' ? '' : 'hidden' }, 'Hide/show ' + elName(el)); renderTab();
      }, '', 'Make it invisible but keep its space', 'eye'),
      btn('Parent', function () { if (el.parentElement && el.parentElement !== HTML) select(el.parentElement); }, '', 'Select the box around it', 'up'),
      btn('Code', function () { showTab('code'); select(el); }, '', 'See and change its code', 'code'))));

  // quick text
  var tag = el.localName;
  if (tag === 'input' || tag === 'textarea') {
    b.appendChild(sec('Text', row('Placeholder', h('div', { class: 'grow' }, textIn(el.getAttribute('placeholder'), 'Hint text', function (v) {
      change({ t: 'attr', s: cssPath(el), n: 'placeholder', v: v }, 'Change hint text', { el: el, merge: 'ph|' + cssPath(el) });
    }, 250)))));
  } else if (!el.firstElementChild && el.textContent.length < 600 && !/^(img|video|canvas|svg|iframe|br|hr|select)$/.test(tag)) {
    b.appendChild(sec('Text', row('Words', h('div', { class: 'grow' }, textIn(el.textContent, 'Type new text', function (v) {
      change({ t: 'text', s: cssPath(el), v: v }, 'Change text of ' + elName(el), { el: el, merge: 'tx|' + cssPath(el) });
    }, 200)))));
  }
  if (tag === 'a') {
    b.appendChild(sec('Link', row('Goes to', h('div', { class: 'grow' }, textIn(el.getAttribute('href'), 'https://\u2026', function (v) {
      if (/^\s*javascript:/i.test(v)) return;
      change({ t: 'attr', s: cssPath(el), n: 'href', v: v }, 'Change link', { el: el, merge: 'href|' + cssPath(el) });
    }, 300)))));
  }

  // picture
  var picHint = tag === 'img' ? 'Swap this picture for your own' : 'Put a picture behind it';
  b.appendChild(sec('Picture',
    h('div', { class: 'grid g2' },
      btn(tag === 'img' ? 'Upload picture' : 'Picture behind it', function () {
        chooseFile('image/*', function (f) {
          readImage(f, 1600).then(function (src) { change({ t: 'img', s: cssPath(el), v: src }, 'Change picture', { el: el }); renderTab(); });
        });
      }, '', picHint, 'image'),
      h('div', { class: 'flex' }, (function () {
        var i = h('input', { class: 'in grow', placeholder: 'or paste a picture link' });
        i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && i.value.trim()) change({ t: 'img', s: cssPath(el), v: i.value.trim() }, 'Change picture', { el: el }); });
        return i;
      })()))));

  // looks
  var cs = getComputedStyle(el), sel = cssPath(el);
  var curScale = parseFloat(el.style.getPropertyValue('scale')) || 1;
  var curRot = parseFloat(el.style.getPropertyValue('rotate')) || 0;
  b.appendChild(sec('Colors',
    row('Text color', colorIn(toHex(cs.color, '#ffffff'), function (v) { styleOp(el, { color: v }, 'Text color', 'c'); }),
      h('div', { class: 'grow' }, swatches(SWATCHES.slice(0, 8), function (v) { styleOp(el, { color: v }, 'Text color'); renderTab(); }))),
    row('Background', colorIn(toHex(cs.backgroundColor, '#1a1a2e'), function (v) { styleOp(el, { 'background-color': v, 'background-image': 'none' }, 'Background color', 'bgc'); }),
      btn('Clear', function () { styleOp(el, { 'background-color': 'transparent', 'background-image': 'none' }, 'Clear background'); renderTab(); }, 'sm', 'See-through background'),
      btn('Rainbow', function () { styleOp(el, { 'background-image': 'linear-gradient(90deg,#ff2a6d,#ff7a18,#ffd60a,#3dffa2,#2de2ff,#8338ec)', 'background-color': 'transparent' }, 'Rainbow background'); }, 'sm')),
    row('Border', colorIn(toHex(cs.borderTopColor, '#3dffa2'), function (v) {
      var w = parseFloat(cs.borderTopWidth) || 2;
      styleOp(el, { border: w + 'px solid ' + v }, 'Border color', 'bd');
    }), slider(0, 20, 1, parseFloat(cs.borderTopWidth) || 0, function (v) { return v + 'px'; }, function (v) {
      styleOp(el, { border: v + 'px solid ' + toHex(getComputedStyle(el).borderTopColor, '#3dffa2') }, 'Border size', 'bw');
    }))));

  b.appendChild(sec('Size + shape',
    row('Text size', slider(6, 140, 1, Math.round(parseFloat(cs.fontSize)) || 16, function (v) { return v + 'px'; }, function (v) { styleOp(el, { 'font-size': v + 'px' }, 'Text size', 'fs'); })),
    row('Zoom', slider(10, 400, 5, Math.round(curScale * 100), function (v) { return v + '%'; }, function (v) { styleOp(el, { scale: String(v / 100) }, 'Zoom', 'sc'); })),
    row('Spin', slider(-180, 180, 1, curRot, function (v) { return v + '\u00b0'; }, function (v) { styleOp(el, { rotate: v + 'deg' }, 'Spin', 'rot'); })),
    row('Round corners', slider(0, 120, 1, Math.round(parseFloat(cs.borderTopLeftRadius)) || 0, function (v) { return v + 'px'; }, function (v) { styleOp(el, { 'border-radius': v + 'px', overflow: v ? 'hidden' : '' }, 'Round corners', 'br'); })),
    row('See-through', slider(0, 100, 1, Math.round((1 - (parseFloat(cs.opacity) || 1)) * 100), function (v) { return v + '%'; }, function (v) { styleOp(el, { opacity: String(1 - v / 100) }, 'See-through', 'op'); }))));

  var bold = parseInt(cs.fontWeight, 10) >= 600, ital = cs.fontStyle === 'italic', und = /underline/.test(cs.textDecorationLine || cs.textDecoration);
  var glow = el.style.getPropertyValue('text-shadow') !== '', shadow = el.style.getPropertyValue('box-shadow') !== '';
  b.appendChild(sec('Style',
    h('div', { class: 'grid' },
      btn('Bold', function () { styleOp(el, { 'font-weight': bold ? '400' : '800' }, 'Bold'); renderTab(); }, bold ? 'on' : ''),
      btn('Italic', function () { styleOp(el, { 'font-style': ital ? 'normal' : 'italic' }, 'Italic'); renderTab(); }, ital ? 'on' : ''),
      btn('Underline', function () { styleOp(el, { 'text-decoration': und ? 'none' : 'underline' }, 'Underline'); renderTab(); }, und ? 'on' : ''),
      btn('Glow', function () { styleOp(el, { 'text-shadow': glow ? '' : '0 0 6px currentColor, 0 0 18px currentColor' }, 'Glow'); renderTab(); }, glow ? 'on' : ''),
      btn('Shadow', function () { styleOp(el, { 'box-shadow': shadow ? '' : '0 12px 34px rgba(0,0,0,.45)' }, 'Shadow'); renderTab(); }, shadow ? 'on' : ''),
      btn('Center', function () { styleOp(el, { 'text-align': 'center' }, 'Center text'); }, '')),
    row('Font', h('div', { class: 'grow' }, selectIn(FONTS, el.style.getPropertyValue('font-family') || '', function (v) { styleOp(el, { 'font-family': v }, 'Font'); })))));

  b.appendChild(renderActions(el));

  b.appendChild(sec('Reset', btn('Undo every style change on this thing', function () {
    var props = ['color', 'background-color', 'background-image', 'border', 'font-size', 'scale', 'rotate', 'border-radius', 'overflow', 'opacity',
      'font-weight', 'font-style', 'text-decoration', 'text-shadow', 'box-shadow', 'text-align', 'font-family', 'translate', 'width', 'height', 'visibility'];
    var p = {}; props.forEach(function (k) { if (el.style.getPropertyValue(k)) p[k] = ''; });
    if (Object.keys(p).length) { styleOp(el, p, 'Reset styles of ' + elName(el)); renderTab(); }
  }, 'bad sm')));
  void sel;
}

// ----- "Do stuff when clicked" editor -----
var ACTIONS = [
  ['popup', 'Show a popup message', 'text', 'Hey! You clicked me.'],
  ['sound', 'Play a sound', 'sound', 'airhorn'],
  ['say', 'Say something out loud', 'text', 'Hello there'],
  ['link', 'Go to a link', 'url', 'https://'],
  ['burst', 'Confetti blast where you click', null],
  ['confetti', 'Make it rain confetti', null],
  ['shake', 'Shake the whole page', null],
  ['spin', 'This thing does a barrel roll', null],
  ['bg', 'Change the page background', 'color', '#ff2a6d'],
  ['fx', 'Turn an effect on/off', 'fx', 'rainbow'],
  ['hide', 'Hide / show something', 'target', ''],
  ['text', 'Change this text to', 'text', 'You clicked!'],
  ['count', 'Count the clicks', 'text', 'Clicks:'],
  ['js', 'Run my own JavaScript', 'code', 'alert("hi")']
];
function actInfo(k) { for (var i = 0; i < ACTIONS.length; i++) if (ACTIONS[i][0] === k) return ACTIONS[i]; return null; }

function renderActions(el) {
  var id = el.getAttribute('data-ew-id');
  var cur = copy(id && acts.get(id)) || { list: [] };
  cur.list = cur.list || [];
  var sel = cssPath(el);
  function save(label, merge) {
    var nid = el.getAttribute('data-ew-id') || uid();
    change({ t: 'act', s: sel, id: nid, a: copy(cur) }, label, { el: el, merge: merge ? 'act|' + sel + '|' + merge : null });
  }
  var box = sec('Do stuff when clicked');
  if (!cur.list.length) box.appendChild(h('div', { class: 'note', text: 'Make this thing DO something when someone clicks it. Works on site stuff and on stuff you added.' }));
  cur.list.forEach(function (a, i) {
    var info = actInfo(a.k) || [a.k, a.k, null];
    var card = h('div', { class: 'act' }, h('div', { class: 'top' }, h('span', { text: (i + 1) + '. ' + info[1] }),
      btn('Try', function () { doActions([a], el, { clientX: innerWidth / 2, clientY: innerHeight / 2 }); }, 'sm', 'Test it now', 'play'),
      btn('', function () { cur.list.splice(i, 1); save('Remove click action'); renderTab(); }, 'sm bad', 'Remove', 'close')));
    var kind = info[2];
    if (kind === 'text' || kind === 'url') card.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, textIn(a.text, kind === 'url' ? 'https://\u2026' : 'Type here', function (v) { a.text = v; save('Edit click action', 'f' + i); }, 300))));
    if (kind === 'url') card.appendChild(h('div', { class: 'row' }, btn(a.tab ? 'Opens in a new tab' : 'Opens in this tab', function () { a.tab = !a.tab; save('Edit click action'); renderTab(); }, 'sm')));
    if (kind === 'color') card.appendChild(h('div', { class: 'row' }, colorIn(a.color || '#ff2a6d', function (v) { a.color = v; save('Edit click action', 'c' + i); })));
    if (kind === 'sound') {
      card.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, selectIn(SOUND_LIST.concat([['custom', 'My own sound file\u2026']]), a.data ? 'custom' : a.name, function (v) {
        if (v === 'custom') {
          chooseFile('audio/*', function (f) {
            if (f.size > 6e6) { toast('That sound is too big (max 6 MB)', 'bad'); return; }
            readFile(f).then(function (d) { a.data = d; a.name = 'custom'; save('Set click sound'); renderTab(); });
          });
        } else { a.name = v; delete a.data; save('Set click sound'); playSound(v); }
      }))));
    }
    if (kind === 'fx') card.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, selectIn(FX_LIST.filter(function (f) { return f[4] !== 'x'; }).map(function (f) { return [f[0], f[1]]; }), a.name, function (v) { a.name = v; save('Edit click action'); }))));
    if (kind === 'target') card.appendChild(h('div', { class: 'row' }, btn(a.sel ? 'Target: ' + short(a.sel, 30) : 'Pick what to hide/show', function () {
      toast('Now click the thing that should hide/show', 'ok');
      pick(true, function (t) { a.sel = cssPath(t); save('Pick hide target'); renderTab(); });
    }, 'sm', null, 'pick'), a.sel ? btn('This thing', function () { a.sel = ''; save('Edit click action'); renderTab(); }, 'sm') : null));
    if (kind === 'code') {
      var ta = h('textarea', { class: 'in', spellcheck: 'false' });
      ta.value = a.code || '';
      ta.addEventListener('input', debounce(function () { a.code = ta.value; save('Edit click code', 'js' + i); }, 400));
      card.appendChild(h('div', { class: 'row' }, ta));
      if (KIND !== 'extension') card.appendChild(h('div', { class: 'note', text: 'Some strict sites block this from a bookmark. The extension can run it anywhere.' }));
    }
    box.appendChild(card);
  });
  var adder = selectIn([['', '+ Add something to do\u2026']].concat(ACTIONS.map(function (a) { return [a[0], a[1]]; })), '', function (k) {
    if (!k) return;
    var info = actInfo(k), a = { k: k };
    if (info[2] === 'text' || info[2] === 'url') a.text = info[3];
    if (info[2] === 'sound') a.name = info[3];
    if (info[2] === 'color') a.color = info[3];
    if (info[2] === 'fx') a.name = info[3];
    if (info[2] === 'code') a.code = info[3];
    cur.list.push(a);
    save('Add click action: ' + info[1]);
    renderTab();
  });
  box.appendChild(adder);
  box.appendChild(h('div', { class: 'grid g2 mt' },
    btn(cur.block ? 'Site\'s own click: OFF' : 'Site\'s own click: ON', function () { cur.block = !cur.block; save('Toggle site click'); renderTab(); }, cur.block ? 'on' : '', 'Stop the website\'s normal click (links, buttons) from happening'),
    btn(cur.run ? 'Runs away: ON' : 'Runs away from mouse', function () { cur.run = !cur.run; save('Toggle run away'); renderTab(); }, cur.run ? 'on' : '', 'It jumps away when the mouse gets close (impossible to click lol)')));
  return box;
}

// ===== 08-code.js =====
// ---------- CODE: the website's code as a tree + a code box you can type in ----------

var C = { tree: null, map: new WeakMap(), open: new WeakSet(), ed: null, el: null, inner: false, sess: null, live: true, results: [], ri: 0, q: '' };

// ----- syntax colors -----
function tokHTML(s, out) {
  out = out || [];
  var i = 0, n = s.length;
  while (i < n) {
    if (s.startsWith('<!--', i)) { var ce = s.indexOf('-->', i + 4); ce = ce < 0 ? n : ce + 3; out.push(['c', s.slice(i, ce)]); i = ce; continue; }
    if (s[i] === '<' && /[A-Za-z\/!]/.test(s[i + 1] || '')) {
      var j = i + 1;
      if (s[j] === '/' || s[j] === '!') j++;
      var k = j;
      while (k < n && /[\w:.-]/.test(s[k])) k++;
      var tag = s.slice(j, k).toLowerCase();
      out.push(['p', s.slice(i, j)]); out.push(['t', s.slice(j, k)]);
      i = k;
      var afterEq = false;
      while (i < n && s[i] !== '>') {
        var c = s[i];
        if (/\s/.test(c)) { var w = i; while (w < n && /\s/.test(s[w])) w++; out.push(['', s.slice(i, w)]); i = w; continue; }
        if (c === '"' || c === "'") { var q = s.indexOf(c, i + 1); q = q < 0 ? n : q + 1; out.push(['s', s.slice(i, q)]); i = q; afterEq = false; continue; }
        if (c === '=') { out.push(['p', c]); i++; afterEq = true; continue; }
        if (c === '/') { out.push(['p', c]); i++; continue; }
        var a = i;
        while (i < n && !/[\s=>"'\/]/.test(s[i])) i++;
        if (i === a) i++;
        out.push([afterEq ? 's' : 'a', s.slice(a, i)]);
        afterEq = false;
      }
      if (i < n) { out.push(['p', '>']); i++; }
      if ((tag === 'script' || tag === 'style') && s[j - 1] !== '/') {
        var end = s.toLowerCase().indexOf('</' + tag, i);
        if (end < 0) end = n;
        var inner = s.slice(i, end);
        if (inner) (tag === 'style' ? tokCSS : tokJS)(inner, out);
        i = end;
      }
      continue;
    }
    var nx = s.indexOf('<', i + 1);
    if (nx < 0) nx = n;
    out.push(['x', s.slice(i, nx)]);
    i = nx;
  }
  return out;
}
function tokCSS(s, out) {
  out = out || [];
  var i = 0, n = s.length, depth = 0, inVal = false;
  while (i < n) {
    var c = s[i];
    if (c === '/' && s[i + 1] === '*') { var e = s.indexOf('*/', i + 2); e = e < 0 ? n : e + 2; out.push(['c', s.slice(i, e)]); i = e; continue; }
    if (c === '"' || c === "'") { var q = s.indexOf(c, i + 1); q = q < 0 ? n : q + 1; out.push(['s', s.slice(i, q)]); i = q; continue; }
    if (c === '{') { depth++; inVal = false; out.push(['p', c]); i++; continue; }
    if (c === '}') { depth = Math.max(0, depth - 1); inVal = false; out.push(['p', c]); i++; continue; }
    if (c === ';') { inVal = false; out.push(['p', c]); i++; continue; }
    if (c === ':' && depth > 0 && !inVal) { inVal = true; out.push(['p', c]); i++; continue; }
    if (c === '@') { var a = i + 1; while (a < n && /[\w-]/.test(s[a])) a++; out.push(['at', s.slice(i, a)]); i = a; continue; }
    if (inVal && /[\d.#-]/.test(c)) {
      var m = /^(#[0-9a-fA-F]{3,8}|-?\d*\.?\d+(?:[a-z%]+)?)/.exec(s.slice(i, i + 40));
      if (m) { out.push(['n', m[0]]); i += m[0].length; continue; }
    }
    var b = i;
    while (i < n && !/[\s{}:;"'\/@]/.test(s[i])) i++;
    if (i === b) { out.push(['', s[i]]); i++; continue; }
    var word = s.slice(b, i);
    out.push([depth === 0 ? 'sel' : inVal ? (word === '!important' ? 'k' : 'x') : 'pr', word]);
  }
  return out;
}
var JS_KW = /^(var|let|const|function|return|if|else|for|while|do|break|continue|new|this|typeof|instanceof|in|of|class|extends|super|try|catch|finally|throw|switch|case|default|await|async|yield|import|export|from|true|false|null|undefined|void|delete)$/;
function tokJS(s, out) {
  out = out || [];
  var i = 0, n = s.length;
  while (i < n) {
    var c = s[i];
    if (c === '/' && s[i + 1] === '/') { var e = s.indexOf('\n', i); e = e < 0 ? n : e; out.push(['c', s.slice(i, e)]); i = e; continue; }
    if (c === '/' && s[i + 1] === '*') { var e2 = s.indexOf('*/', i + 2); e2 = e2 < 0 ? n : e2 + 2; out.push(['c', s.slice(i, e2)]); i = e2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      var j = i + 1;
      while (j < n && s[j] !== c) { if (s[j] === '\\') j++; j++; }
      out.push(['s', s.slice(i, j + 1)]); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) { var m = /^\d[\d._xXa-fA-FeE]*/.exec(s.slice(i, i + 30)); out.push(['n', m[0]]); i += m[0].length; continue; }
    if (/[A-Za-z_$]/.test(c)) {
      var b = i; while (i < n && /[\w$]/.test(s[i])) i++;
      var w = s.slice(b, i);
      out.push([JS_KW.test(w) ? 'k' : s[i] === '(' ? 'f' : 'x', w]); continue;
    }
    var b2 = i; while (i < n && !/[\w$"'`\/]/.test(s[i])) i++;
    if (i === b2) i++;
    out.push(['p', s.slice(b2, i)]);
  }
  return out;
}
var TOK_CLASS = { t: 'k-t', a: 'k-a', s: 'k-s', p: 'k-p', c: 'k-c', n: 'k-n', k: 'k-k', f: 'k-f', x: 'k-x', pr: 'k-pr', sel: 'k-sel', at: 'k-at' };
function paintTokens(pre, toks) {
  var frag = D.createDocumentFragment();
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i];
    if (!t[1]) continue;
    if (!t[0]) frag.appendChild(D.createTextNode(t[1]));
    else { var sp = D.createElement('span'); sp.className = TOK_CLASS[t[0]] || ''; sp.textContent = t[1]; frag.appendChild(sp); }
  }
  frag.appendChild(D.createTextNode('\n'));
  empty(pre).appendChild(frag);
}

// A code box: colored text behind a see-through textarea.
var HL_LIMIT = 150000;
function makeEditor(lang, opts) {
  opts = opts || {};
  var pre = h('pre', { 'aria-hidden': 'true' });
  var ta = h('textarea', { spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', wrap: 'soft', placeholder: opts.placeholder || '' });
  var wrap = h('div', { class: 'ed' + (opts.tall ? ' tall' : opts.short ? ' short' : '') }, pre, ta);
  var tok = lang === 'css' ? tokCSS : lang === 'js' ? tokJS : tokHTML;
  var raf = 0;
  function paint() {
    raf = 0;
    var v = ta.value;
    var plain = v.length > HL_LIMIT;
    wrap.classList.toggle('plain', plain);
    if (!plain) paintTokens(pre, tok(v));
    sync();
  }
  function sync() { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; }
  ta.addEventListener('input', function () { if (!raf) raf = requestAnimationFrame(paint); if (opts.oninput) opts.oninput(ta.value); });
  ta.addEventListener('scroll', sync);
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      var a = ta.selectionStart, b = ta.selectionEnd;
      ta.setRangeText('  ', a, b, 'end');
      ta.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (opts.onrun) opts.onrun(ta.value);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // keep the indent of the line above
      var st = ta.selectionStart, line = ta.value.lastIndexOf('\n', st - 1) + 1;
      var ind = /^[ \t]*/.exec(ta.value.slice(line, st))[0];
      if (ind) { e.preventDefault(); ta.setRangeText('\n' + ind, st, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
    }
  });
  return {
    wrap: wrap, ta: ta,
    get: function () { return ta.value; },
    set: function (v) { ta.value = v == null ? '' : v; paint(); ta.scrollTop = 0; }
  };
}

// ----- making squished one-line code readable -----
var BLOCKY = /^(html|head|body|div|section|article|aside|header|footer|nav|main|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|form|fieldset|p|h[1-6]|blockquote|figure|figcaption|meta|link|script|style|title|noscript|template|select|option|dl|dt|dd|details|summary|iframe|video|audio|canvas|picture|source|hr|br|svg|button|input|textarea|label|img|ytd-[\w-]+|yt-[\w-]+)$/i;
function prettyHTML(src) {
  var out = '', depth = 0, i = 0, n = src.length, lower = src.toLowerCase();
  function nl() { out = out.replace(/[ \t]+$/, ''); out += '\n' + '  '.repeat(Math.max(0, depth)); }
  while (i < n) {
    if (src.startsWith('<!--', i)) { var ce = src.indexOf('-->', i); ce = ce < 0 ? n : ce + 3; nl(); out += src.slice(i, ce); i = ce; continue; }
    if (src[i] === '<' && /[A-Za-z\/]/.test(src[i + 1] || '')) {
      var closing = src[i + 1] === '/', j = i + (closing ? 2 : 1), k = j;
      while (k < n && /[\w:.-]/.test(src[k])) k++;
      var tag = src.slice(j, k).toLowerCase(), e = k, q = null;
      for (; e < n; e++) { var c = src[e]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; }
      var full = src.slice(i, e + 1), block = BLOCKY.test(tag);
      if (closing) { if (block) { depth--; nl(); } out += full; }
      else {
        if (block) nl();
        out += full;
        var selfc = /\/>$/.test(full) || /^(meta|link|br|hr|img|input|source|wbr|area|col|embed|track|base)$/.test(tag);
        if (/^(script|style|pre|textarea)$/.test(tag)) {
          var end = lower.indexOf('</' + tag, e + 1); if (end < 0) end = n;
          out += src.slice(e + 1, end); i = end; continue;
        }
        if (block && !selfc) depth++;
      }
      i = e + 1;
      continue;
    }
    var nx = src.indexOf('<', i + 1); if (nx < 0) nx = n;
    var t = src.slice(i, nx);
    if (t.trim()) out += /^\s*\n/.test(t) ? t.replace(/^\s+/, '') : t;
    i = nx;
  }
  return out.replace(/^\n/, '');
}
function looksSquished(s) { return s.length > 240 && s.length < HL_LIMIT && (s.match(/\n/g) || []).length < s.length / 500; }

// ----- the tree -----
function treeRow(node, depth) {
  var wrapEl = h('div');
  var r = h('div', { class: 'tr' });
  r.style.paddingLeft = (6 + depth * 12) + 'px';
  wrapEl.appendChild(r);
  if (node.nodeType === 3) { r.appendChild(h('span', { class: 'tw' })); r.appendChild(h('span', { class: 'tx', text: '"' + short(node.nodeValue, 90) + '"' })); return wrapEl; }
  if (node.nodeType === 8) { r.appendChild(h('span', { class: 'tw' })); r.appendChild(h('span', { class: 'k-c', text: '<!--' + short(node.nodeValue, 70) + '-->' })); return wrapEl; }
  var el = node;
  C.map.set(el, wrapEl);
  var kids = treeKids(el);
  var simpleText = !el.firstElementChild && kids.length === 1 && kids[0].nodeType === 3 && kids[0].nodeValue.length <= 80;
  var tw = h('span', { class: 'tw', text: kids.length && !simpleText ? (C.open.has(el) ? '\u25be' : '\u25b8') : '' });
  r.appendChild(tw);
  var tag = h('span');
  var toks = [['p', '<'], ['t', el.localName]];
  var at = el.attributes;
  for (var i = 0; i < at.length && i < 6; i++) {
    if (at[i].name === 'data-ew-internal') continue;
    toks.push(['', ' '], ['a', at[i].name]);
    if (at[i].value !== '') toks.push(['p', '="'], ['s', short(at[i].value, 48)], ['p', '"']);
  }
  if (at.length > 6) toks.push(['p', ' \u2026']);
  toks.push(['p', '>']);
  if (simpleText) toks.push(['x', short(kids[0].nodeValue, 80)], ['p', '</'], ['t', el.localName], ['p', '>']);
  else if (kids.length && !C.open.has(el)) toks.push(['p', '\u2026</'], ['t', el.localName], ['p', '>']);
  toks.forEach(function (t) { tag.appendChild(t[0] ? h('span', { class: TOK_CLASS[t[0]], text: t[1] }) : D.createTextNode(t[1])); });
  r.appendChild(tag);
  if (el === P.sel) r.classList.add('sel');
  var kidsBox = h('div');
  wrapEl.appendChild(kidsBox);
  function fill() {
    empty(kidsBox);
    var list = treeKids(el), lim = 300;
    list.slice(0, lim).forEach(function (k) { kidsBox.appendChild(treeRow(k, depth + 1)); });
    if (list.length > lim) {
      var more = h('div', { class: 'more', text: '+ ' + (list.length - lim) + ' more\u2026' });
      more.style.paddingLeft = (22 + depth * 12) + 'px';
      more.onclick = function () { more.remove(); list.slice(lim).forEach(function (k) { kidsBox.appendChild(treeRow(k, depth + 1)); }); };
      kidsBox.appendChild(more);
    }
  }
  if (C.open.has(el) && !simpleText) fill();
  wrapEl._fill = fill;
  wrapEl._toggle = function (force) {
    var on = force != null ? force : !C.open.has(el);
    if (on) C.open.add(el); else C.open.delete(el);
    var fresh = treeRow(el, depth);
    wrapEl.replaceWith(fresh);
    return fresh;
  };
  tw.addEventListener('click', function (e) { e.stopPropagation(); wrapEl._toggle(); });
  r.addEventListener('click', function () { select(el, 'tree'); markTree(el); if (!inView(el)) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  r.addEventListener('dblclick', function () { if (kids.length && !simpleText) wrapEl._toggle(); });
  r.addEventListener('mouseenter', function () { place(hlBox, el, hlLbl); });
  r.addEventListener('mouseleave', function () { place(hlBox, null); });
  return wrapEl;
}
function treeKids(el) {
  var out = [];
  for (var n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1) { if (!isOurs(n)) out.push(n); }
    else if (n.nodeType === 3) { if (n.nodeValue.trim()) out.push(n); }
    else if (n.nodeType === 8) out.push(n);
  }
  return out;
}
function inView(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }
function markTree(el) {
  if (!C.tree) return;
  $$('.tr.sel', C.tree).forEach(function (r) { r.classList.remove('sel'); });
  var w = el && C.map.get(el);
  if (w && w.isConnected) w.firstChild.classList.add('sel');
}
function treeBuild() {
  if (!C.tree) return;
  C.map = new WeakMap();
  empty(C.tree);
  if (!C.open.has(HTML)) { C.open.add(HTML); if (D.body) C.open.add(D.body); }
  C.tree.appendChild(treeRow(HTML, 0));
}
// Open the tree down to an element and scroll to it.
function treeReveal(el) {
  if (!C.tree || !el || !el.isConnected) return;
  var chain = [];
  for (var n = el.parentElement; n; n = n.parentElement) chain.unshift(n);
  var need = chain.some(function (a) { return !C.open.has(a); }) || !C.map.get(el);
  if (need) { chain.forEach(function (a) { C.open.add(a); }); treeBuild(); }
  var w = C.map.get(el);
  markTree(el);
  if (w && w.isConnected) {
    var tr = C.tree.getBoundingClientRect(), rr = w.firstChild.getBoundingClientRect();
    if (rr.top < tr.top || rr.bottom > tr.bottom) C.tree.scrollTop += rr.top - tr.top - tr.height / 3;
  }
}

// ----- search -----
function codeSearch(q) {
  q = (q || '').trim();
  C.q = q; C.results = []; C.ri = 0;
  if (!q) return;
  var list = [];
  if (/^[#.\[]|^[a-z][\w-]*([#.\[:]|$)/i.test(q) && q.indexOf(' ') < 0 || /[>~+]/.test(q)) list = $$(q).filter(function (e) { return !isOurs(e); });
  if (!list.length) {
    var lq = q.toLowerCase(), seen = new Set();
    var tw = D.createTreeWalker(D.body || HTML, NodeFilter.SHOW_TEXT);
    for (var n; (n = tw.nextNode()) && list.length < 500;) {
      var p = n.parentElement;
      if (!p || seen.has(p) || isOurs(p) || /^(script|style|noscript)$/.test(p.localName)) continue;
      if (n.nodeValue.toLowerCase().indexOf(lq) >= 0) { seen.add(p); list.push(p); }
    }
    if (!list.length) {
      $$('*', D.body || HTML).forEach(function (e) {
        if (list.length >= 500 || isOurs(e)) return;
        for (var i = 0; i < e.attributes.length; i++) if (e.attributes[i].value.toLowerCase().indexOf(lq) >= 0) { list.push(e); break; }
      });
    }
  }
  C.results = list;
}
function codeJump(d) {
  if (!C.results.length) return;
  C.ri = (C.ri + d + C.results.length) % C.results.length;
  var el = C.results[C.ri];
  select(el);
  if (!inView(el)) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ----- editing code -----
function edLoad(el) {
  if (!C.ed) return;
  edCommit();
  C.el = el && el.isConnected ? el : null;
  if (C.el === HTML) C.el = D.body;
  C.inner = C.el === D.body || C.el === D.head;
  var code = !C.el ? '' : C.inner ? C.el.innerHTML : C.el.outerHTML;
  if (looksSquished(code)) code = prettyHTML(code);
  C.loaded = code;
  C.ed.set(code);
  if (C.lbl) C.lbl.textContent = C.el ? (C.inner ? 'Inside <' + C.el.localName + '>' : '<' + elName(C.el) + '>') : 'Pick something (or click a line in the tree)';
}
// Apply what's in the code box to the page.
function edApply(commitNow) {
  var el = C.el;
  if (!C.ed || !el) { if (commitNow) toast('Pick something first'); return; }
  var code = C.ed.get();
  if (!C.sess && code === C.loaded) return;
  try {
    if (C.inner) {
      if (!C.sess) C.sess = { el: el, nodes: Array.prototype.slice.call(el.childNodes), sel: cssPath(el) };
      setHTML(el, code);
    } else {
      var s = C.sess;
      if (!s) {
        if (!el.parentNode) return;
        var mark = D.createTextNode('');
        el.parentNode.insertBefore(mark, el.nextSibling);
        s = C.sess = { orig: el, nodes: [el], mark: mark, sel: cssPath(el) };
      }
      var parent = s.mark.parentNode;
      if (!parent) { C.sess = null; return; }
      var fresh = htmlToNodes(code, parent);
      fresh.forEach(function (n) { parent.insertBefore(n, s.mark); });
      s.nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      s.nodes = fresh;
      var firstEl = null;
      for (var i = 0; i < fresh.length; i++) if (fresh[i].nodeType === 1) { firstEl = fresh[i]; break; }
      C.el = firstEl;
      P.sel = firstEl;
      if (firstEl) tickAdd(selTick); else place(selBox, null);
    }
  } catch (e) { toast('That code didn\'t work: ' + (e && e.message || e), 'bad'); return; }
  if (commitNow) edCommit();
}
var edApplySoon = debounce(function () { if (C.live) edApply(false); }, 450);
var edCommitSoon = debounce(function () { edCommit(); }, 1600);
// Turn the current edit session into one undo step.
function edCommit() {
  var s = C.sess;
  if (!s) return;
  C.sess = null;
  var code = C.ed ? C.ed.get() : '';
  C.loaded = code;
  if (C.inner) {
    var el = s.el;
    change({ t: 'html', s: s.sel, v: code }, 'Edit code inside <' + el.localName + '>', {
      el: el, undo: function () { empty(el); s.nodes.forEach(function (n) { el.appendChild(n); }); }
    });
  } else {
    if (s.mark.parentNode) s.mark.parentNode.removeChild(s.mark);
    var fresh = s.nodes, orig = s.orig;
    change({ t: 'outer', s: s.sel, v: code }, 'Edit code of <' + elName(orig) + '>', {
      el: orig,
      undo: function () {
        var at = null;
        for (var i = 0; i < fresh.length; i++) if (fresh[i].parentNode) { at = fresh[i]; break; }
        if (at) at.parentNode.insertBefore(orig, at);
        fresh.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      }
    });
  }
  if (C.tree) treeBuild();
  if (C.el) treeReveal(C.el);
}

function renderCode() {
  var b = bodyEl;
  var info = h('span', { class: 'dimtx' });
  var qIn = h('input', { class: 'in grow', placeholder: 'Find: words, tag, .class, #id', value: C.q });
  function doFind() {
    codeSearch(qIn.value);
    info.textContent = C.q ? (C.results.length ? C.results.length + ' found' : 'nothing found') : '';
    if (C.results.length) { C.ri = -1; codeJump(1); }
  }
  qIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (C.results.length && qIn.value.trim() === C.q) codeJump(e.shiftKey ? -1 : 1); else doFind(); } });
  b.appendChild(sec('Find in the code', h('div', { class: 'flex' }, qIn,
    btn('', doFind, 'sm', 'Find (Enter)', 'search'),
    btn('', function () { codeJump(-1); }, 'sm', 'Previous', 'up'),
    btn('', function () { codeJump(1); }, 'sm', 'Next', 'down')), info));

  C.tree = h('div', { class: 'tree' });
  b.appendChild(sec('The page\'s code', C.tree, h('div', { class: 'flex mt' },
    btn('Pick on page', function () { pick(true); }, 'sm', 'Click something on the page to find its code', 'pick'),
    btn('Refresh', function () { treeBuild(); if (P.sel) treeReveal(P.sel); }, 'sm', 'Reload the tree (if the site changed)', 'refresh')),
    h('div', { class: 'note', text: 'Click a line to select it on the page. Click the little arrow to open it.' })));
  treeBuild();

  C.lbl = h('span', { class: 'selname' });
  C.ed = makeEditor('html', {
    tall: true,
    oninput: function () { if (C.live && !C.inner) { edApplySoon(); edCommitSoon(); } },
    onrun: function () { edApply(true); toast('Applied', 'ok'); }
  });
  var liveBtn = btn(C.live ? 'Live: ON' : 'Live: OFF', function () { C.live = !C.live; liveBtn.lastChild.textContent = C.live ? 'Live: ON' : 'Live: OFF'; liveBtn.classList.toggle('on', C.live); }, C.live ? 'on sm' : 'sm', 'Live = the page changes while you type');
  b.appendChild(sec('Change the code', C.lbl,
    h('div', { class: 'note', text: 'Type to change it. Live mode updates the page as you type (for the whole page, hit Apply). Ctrl+Enter applies.' }),
    h('div', { class: 'mt' }, C.ed.wrap),
    h('div', { class: 'flex mt' },
      btn('Apply', function () { edApply(true); toast('Applied', 'ok'); }, 'pri sm', 'Ctrl+Enter', 'check'),
      liveBtn,
      btn('Tidy', function () { C.ed.set(prettyHTML(C.ed.get())); }, 'sm', 'Spread the code out so it\'s easy to read'),
      btn('Reload', function () { C.sess = null; edLoad(C.el || P.sel); }, 'sm', 'Throw away what you typed (that isn\'t applied)'),
      btn('Whole page', function () { select(D.body, 'editor'); edLoad(D.body); }, 'sm', 'Edit everything inside <body>'))));
  edLoad(P.sel);
  if (P.sel) treeReveal(P.sel);
}

// ===== 09-bg.js =====
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

// ===== 10-fx.js =====
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

// ===== 11-add.js =====
// ---------- ADD: put your own stuff on the website + make things do stuff ----------

var ADD_KINDS = [
  ['text', 'Text', 'Big bold words'], ['button', 'Button', 'A clickable button'], ['picture', 'Picture', 'From your PC'],
  ['video', 'Video', 'From your PC'], ['popup', 'Popup', 'Shows when the page opens'], ['note', 'Sticky note', 'Yellow note'],
  ['link', 'Link', 'Goes to a website'], ['shape', 'Shape', 'Box or circle'], ['marquee', 'Scrolling text', 'News ticker banner'],
  ['sound', 'Sound button', 'Plays a sound'], ['counter', 'Click counter', 'Counts every click'], ['banner', 'Banner', 'Bar across the top']
];
var addFixed = false;

function buildAdded(spec) {
  var el, k = spec.k;
  var base = { position: spec.fixed ? 'fixed' : 'absolute', left: spec.x + 'px', top: spec.y + 'px', 'z-index': '2147483000', margin: '0', 'box-sizing': 'border-box', 'font-family': '"Segoe UI", system-ui, Arial, sans-serif', 'line-height': '1.3', 'text-align': 'left', 'max-width': 'none', float: 'none' };
  if (k === 'text') {
    el = D.createElement('div'); el.textContent = spec.text;
    css(el, Object.assign(base, { 'font-size': '42px', 'font-weight': '900', color: '#ffffff', 'text-shadow': '0 3px 0 #000, 0 0 20px rgba(0,0,0,.6)', 'white-space': 'pre-wrap', padding: '4px 8px' }), true);
  } else if (k === 'button' || k === 'sound' || k === 'counter') {
    el = D.createElement('button'); el.type = 'button'; el.textContent = spec.text;
    css(el, Object.assign(base, { 'font-size': '18px', 'font-weight': '800', color: '#04140c', background: 'linear-gradient(180deg,#5dffb4,#22d483)', border: '0', 'border-radius': '12px', padding: '14px 26px', cursor: 'pointer', 'box-shadow': '0 6px 0 #0f8a52, 0 12px 28px rgba(0,0,0,.35)', 'letter-spacing': '.02em' }), true);
    if (k === 'sound') css(el, { background: 'linear-gradient(180deg,#ff7aa8,#ff2a6d)', color: '#fff', 'box-shadow': '0 6px 0 #a3123f, 0 12px 28px rgba(0,0,0,.35)' }, true);
  } else if (k === 'picture') {
    el = D.createElement('img'); el.alt = '';
    el.src = spec.src;
    css(el, Object.assign(base, { width: (spec.w || 320) + 'px', height: 'auto', 'border-radius': '10px', 'box-shadow': '0 12px 34px rgba(0,0,0,.4)', display: 'block' }), true);
    pictureFallback(el, spec.src, { width: spec.w || 320, height: spec.h || 240 });
  } else if (k === 'video') {
    el = D.createElement('video'); el.controls = true; el.loop = true; el.playsInline = true;
    el.src = spec.src;
    css(el, Object.assign(base, { width: '420px', height: 'auto', 'border-radius': '10px', background: '#000', 'box-shadow': '0 12px 34px rgba(0,0,0,.4)', display: 'block' }), true);
  } else if (k === 'popup') {
    el = D.createElement('div');
    var msg = D.createElement('div'); msg.textContent = spec.text;
    css(msg, { 'font-size': '20px', 'font-weight': '700', 'white-space': 'pre-wrap', 'margin-bottom': '18px' }, true);
    var ok = D.createElement('button'); ok.type = 'button'; ok.textContent = 'OK'; ok.setAttribute('data-ew-close', '');
    css(ok, { font: '800 15px "Segoe UI", system-ui, sans-serif', color: '#04140c', background: '#3dffa2', border: '0', 'border-radius': '9px', padding: '10px 28px', cursor: 'pointer' }, true);
    el.append(msg, ok);
    css(el, Object.assign(base, { position: 'fixed', left: '50%', top: '42%', transform: 'translate(-50%, -50%)', 'min-width': '300px', 'max-width': '520px', padding: '26px 28px 22px', background: '#101820', color: '#fff', 'border-radius': '16px', border: '1px solid rgba(255,255,255,.12)', 'box-shadow': '0 30px 90px rgba(0,0,0,.6), 0 0 0 100vmax rgba(0,0,0,.45)', 'text-align': 'center' }), true);
  } else if (k === 'note') {
    el = D.createElement('div'); el.textContent = spec.text;
    css(el, Object.assign(base, { width: '220px', 'min-height': '180px', padding: '18px 16px', background: '#ffe066', color: '#3a2f00', 'font-size': '18px', 'font-family': '"Comic Sans MS", "Segoe Print", cursive', 'box-shadow': '0 14px 28px rgba(0,0,0,.3)', rotate: '-2deg', 'white-space': 'pre-wrap' }), true);
  } else if (k === 'link') {
    el = D.createElement('a'); el.textContent = spec.text; el.href = spec.href || 'https://example.com'; el.target = '_blank'; el.rel = 'noopener';
    css(el, Object.assign(base, { 'font-size': '22px', 'font-weight': '700', color: '#2de2ff', 'text-decoration': 'underline', 'text-shadow': '0 2px 8px rgba(0,0,0,.6)' }), true);
  } else if (k === 'shape') {
    el = D.createElement('div');
    css(el, Object.assign(base, { width: '160px', height: '160px', background: 'linear-gradient(135deg,#ff2a6d,#8338ec)', 'border-radius': spec.round ? '50%' : '16px', 'box-shadow': '0 14px 30px rgba(0,0,0,.35)' }), true);
  } else if (k === 'marquee' || k === 'banner') {
    el = D.createElement('div');
    var inner = D.createElement('span'); inner.textContent = spec.text;
    el.appendChild(inner);
    css(el, Object.assign(base, { position: 'fixed', left: '0', top: spec.y + 'px', width: '100%', overflow: 'hidden', 'white-space': 'nowrap', background: k === 'banner' ? 'linear-gradient(90deg,#ff2a6d,#8338ec)' : '#000', color: k === 'banner' ? '#fff' : '#ffd60a', 'font-size': '20px', 'font-weight': '800', padding: '10px 0', 'border-top': '2px solid currentColor', 'border-bottom': '2px solid currentColor', 'text-align': k === 'banner' ? 'center' : 'left' }), true);
    if (k === 'marquee') css(inner, { display: 'inline-block', 'padding-left': '20px', animation: 'ew-marq 14s linear infinite' }, true);
  } else {
    el = D.createElement('div'); el.textContent = spec.text || '';
  }
  el.setAttribute('data-ew-id', spec.id);
  el.setAttribute('data-ew-add', k);
  return el;
}

function addThing(k, extra) {
  var vw = innerWidth, vh = innerHeight;
  var off = { x: 0, y: 0 };
  if (D.body && getComputedStyle(D.body).position !== 'static') { var br = D.body.getBoundingClientRect(); off = { x: br.left + scrollX, y: br.top + scrollY }; }
  var cx = Math.round(vw / 2 - 120 + rnd(-60, 60)), cy = Math.round(vh / 2 - 40 + rnd(-50, 50));
  var spec = Object.assign({ id: uid(), k: k, fixed: addFixed, x: addFixed ? cx : cx + scrollX - off.x, y: addFixed ? cy : cy + scrollY - off.y }, extra || {});
  var texts = { text: 'Your text here', button: 'Click me', popup: 'Welcome to my version of this website!', note: 'Remember:\nthis site is mine now', link: 'Click this link', marquee: 'BREAKING NEWS: this website just got edited  \u2022  more at 11  \u2022  ', banner: 'This website is under new management', sound: 'Press for sound', counter: 'Clicks: 0' };
  if (spec.text == null) spec.text = texts[k] || '';
  if (k === 'marquee' || k === 'banner') { spec.fixed = true; spec.y = k === 'banner' ? 0 : Math.round(vh - 60); }
  if (k === 'popup') spec.fixed = true;
  if (k === 'sound') spec.a = { list: [{ k: 'sound', name: 'airhorn' }] };
  if (k === 'counter') spec.a = { list: [{ k: 'count', text: 'Clicks:' }] };
  var ok = change({ t: 'add', spec: spec }, 'Add ' + k);
  if (!ok) return;
  var el = $('[data-ew-id="' + spec.id + '"]');
  if (el) {
    if (el.animate) el.animate([{ scale: '0.6', opacity: 0 }, { scale: '1', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    showTab('pick');
    select(el);
    toast('Added! Drag the green square to move it, change it below.', 'ok', 3500);
  }
}
function addPicture() {
  chooseFile('image/*', function (f) {
    readImage(f, 1400).then(function (src) {
      var probe = new Image();
      probe.onload = function () { var w = Math.min(360, probe.naturalWidth || 320); addThing('picture', { src: src, w: w, h: Math.round(w * (probe.naturalHeight / probe.naturalWidth || 0.75)) }); };
      probe.onerror = function () { addThing('picture', { src: src, w: 320, h: 240 }); };
      probe.src = src;
    });
  });
}
function addVideo() {
  chooseFile('video/*', function (f) {
    if (f.size > 40e6) { toast('Video over 40 MB: it shows now but won\'t be saved.', 'bad', 5000); addThing('video', { src: URL.createObjectURL(f) }); return; }
    readFile(f).then(function (src) { addThing('video', { src: src }); });
  });
}

// ----- what happens when you click stuff (runs in downloaded pages too) -----
var clickCounts = new WeakMap();
function onRuntimeClick(e) {
  if (P.on || GR) return;
  var path = e.composedPath ? e.composedPath() : [e.target];
  for (var i = 0; i < path.length; i++) {
    var n = path[i];
    if (!n || n.nodeType !== 1 || n === host) continue;
    if (n.hasAttribute('data-ew-close')) {
      var pop = n.closest('[data-ew-add]');
      if (pop) pop.style.setProperty('display', 'none', 'important');
      e.preventDefault();
      return;
    }
    var id = n.getAttribute('data-ew-id'), a = id ? acts.get(id) : null;
    if (a) {
      if (a.block) { e.preventDefault(); e.stopPropagation(); }
      doActions(a.list || [], n, e);
      return;
    }
  }
}
function doActions(list, el, e) {
  list.forEach(function (a) {
    try {
      switch (a.k) {
        case 'popup': modal(null, a.text || 'Hi!'); break;
        case 'sound': playSound(a.name, a.data); break;
        case 'say': say(a.text || 'Hello'); break;
        case 'link':
          if (a.text && /^(https?:|mailto:|\/|#)/i.test(a.text.trim())) { if (a.tab) W.open(a.text.trim(), '_blank', 'noopener'); else location.href = a.text.trim(); }
          break;
        case 'burst': burst(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, 80); break;
        case 'confetti': confettiRain(3500); break;
        case 'shake': shakeOnce(); break;
        case 'spin': barrelRoll(el); break;
        case 'bg': bgOverride = { mode: 'color', color: a.color || '#ff2a6d', dim: 0, blur: 0, see: (S.bg && S.bg.see) || 85 }; bgApply(); break;
        case 'fx': fxTemp[a.name] = !fxTemp[a.name]; fxApply(); break;
        case 'hide':
          var t = a.sel ? $(a.sel) : el;
          if (t) { if (t.style.getPropertyValue('display') === 'none') t.style.removeProperty('display'); else t.style.setProperty('display', 'none', 'important'); }
          break;
        case 'text': el.textContent = a.text || ''; break;
        case 'count':
          var c = (clickCounts.get(el) || 0) + 1;
          clickCounts.set(el, c);
          el.textContent = (a.text || 'Clicks:') + ' ' + c;
          break;
        case 'js': runCode(a.code || '', function (r) { if (r.e) { console.warn('[Edit Website]', r.e); toast(r.e, 'bad', 5000); } }); break;
      }
    } catch (x) { console.warn('[Edit Website]', x); }
  });
}

// Things that run away from the mouse
var runners = [];
function runawayRefresh() {
  runners = [];
  acts.forEach(function (a, id) { if (a.run) { var el = $('[data-ew-id="' + id + '"]'); if (el) runners.push(el); } });
  W[runners.length ? 'addEventListener' : 'removeEventListener']('pointermove', runawayMove, { passive: true });
}
var runOff = new WeakMap();
function runawayMove(e) {
  if (P.on) return;
  for (var i = 0; i < runners.length; i++) {
    var el = runners[i];
    if (!el.isConnected) continue;
    var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = cx - e.clientX, dy = cy - e.clientY, dist = Math.hypot(dx, dy), reach = Math.max(r.width, r.height) / 2 + 50;
    if (dist > reach) continue;
    var o = runOff.get(el) || { x: 0, y: 0, base: parsePair(el.style.getPropertyValue('translate')) };
    var len = dist || 1, jump = 90 + Math.random() * 90;
    o.x += dx / len * jump + rnd(-40, 40); o.y += dy / len * jump + rnd(-40, 40);
    var nx = cx + dx / len * jump, ny = cy + dy / len * jump;
    if (nx < 40 || nx > innerWidth - 40) o.x -= dx / len * jump * 2.2;
    if (ny < 40 || ny > innerHeight - 40) o.y -= dy / len * jump * 2.2;
    runOff.set(el, o);
    el.style.setProperty('transition', 'translate .18s ease-out', 'important');
    el.style.setProperty('translate', (o.base[0] + o.x) + 'px ' + (o.base[1] + o.y) + 'px', 'important');
  }
}

// ----- whole-page changes -----
function replaceWords(find, rep) {
  if (!find) return function () {};
  var re;
  try { re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); } catch (e) { return null; }
  var changed = new Map();
  function fixCase(m) {
    if (m === m.toUpperCase() && m !== m.toLowerCase()) return rep.toUpperCase();
    if (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase()) return rep.charAt(0).toUpperCase() + rep.slice(1);
    return rep;
  }
  function walk(rootEl) {
    if (!rootEl) return;
    var tw = D.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT), n;
    while ((n = tw.nextNode())) {
      var p = n.parentElement;
      if (!p || isOurs(p) || /^(script|style|noscript|textarea)$/.test(p.localName)) continue;
      re.lastIndex = 0;
      if (!re.test(n.nodeValue)) continue;
      if (!changed.has(n)) changed.set(n, n.nodeValue);
      re.lastIndex = 0;
      n.nodeValue = n.nodeValue.replace(re, fixCase);
    }
  }
  walk(D.body);
  if (D.title) { re.lastIndex = 0; var oldTitle = D.title; if (re.test(oldTitle)) { re.lastIndex = 0; D.title = oldTitle.replace(re, fixCase); } }
  // keep changing words the site loads later (infinite scroll etc)
  var busy = false, mo = new MutationObserver(function (list) {
    if (busy) return;
    busy = true;
    list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) walk(n); else if (n.nodeType === 3 && n.parentNode) walk(n.parentNode); }); });
    busy = false;
  });
  if (D.body) mo.observe(D.body, { childList: true, subtree: true });
  return function () {
    mo.disconnect();
    changed.forEach(function (v, n) { if (n.isConnected) n.nodeValue = v; });
    if (oldTitle) D.title = oldTitle;
  };
}
function replaceAllPictures(src) {
  var undos = new Map();
  function doImg(img) {
    if (undos.has(img) || isOurs(img) || img.hasAttribute('data-ew-add')) return;
    undos.set(img, swapPicture(img, src));
  }
  $$('img').forEach(doImg);
  var mo = new MutationObserver(function (list) {
    list.forEach(function (m) {
      if (m.type === 'attributes') {
        var img = m.target;
        if (undos.has(img) && img.getAttribute('src') !== src) { img.removeAttribute('srcset'); img.setAttribute('src', src); }
        return;
      }
      m.addedNodes.forEach(function (n) { if (n.nodeType !== 1) return; if (n.localName === 'img') doImg(n); else if (n.querySelectorAll) $$('img', n).forEach(doImg); });
    });
  });
  if (D.body) mo.observe(D.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
  return function () { mo.disconnect(); undos.forEach(function (u) { try { u(); } catch (e) {} }); };
}

// ======================= the ADD tab =======================
function renderAdd() {
  var b = bodyEl;
  b.appendChild(sec('Add to the page',
    h('div', { class: 'grid' }, ADD_KINDS.map(function (k) {
      return h('button', { class: 'btn tile', onclick: function () {
        if (k[0] === 'picture') addPicture();
        else if (k[0] === 'video') addVideo();
        else if (k[0] === 'shape') addThing('shape', { round: Math.random() < 0.5 });
        else addThing(k[0]);
      } }, h('b', { text: k[1] }), h('small', { text: k[2] }));
    })),
    row('New stuff', h('div', { class: 'grow' }, seg([['scroll', 'Scrolls with page', 'Moves with the page like normal stuff'], ['fixed', 'Stuck to screen', 'Stays in the same spot on your screen when you scroll']], addFixed ? 'fixed' : 'scroll', function (v) { addFixed = v === 'fixed'; renderAdd2(); }))),
    h('div', { class: 'note', text: 'New stuff shows up in the middle of your screen and gets selected, so you can change its text, colors, size, and what it does when clicked.' })));

  var mine = $$('[data-ew-add]').filter(function (e) { return !isOurs(e); });
  var list = h('div', { class: 'list' });
  if (!mine.length) list.appendChild(h('div', { class: 'li dimtx', text: 'Nothing added yet' }));
  mine.forEach(function (el) {
    var name = (ADD_KINDS.filter(function (k) { return k[0] === el.getAttribute('data-ew-add'); })[0] || ['', 'Thing'])[1];
    var hidden = el.style.getPropertyValue('display') === 'none';
    list.appendChild(h('div', { class: 'li' },
      h('span', { class: 'nm', text: name + (el.textContent ? ': ' + short(el.textContent, 30) : '') }),
      btn('Select', function () { showTab('pick'); select(el); if (!inView(el)) el.scrollIntoView({ block: 'center' }); }, 'sm'),
      btn(hidden ? 'Show' : 'Hide', function () { if (hidden) el.style.removeProperty('display'); else el.style.setProperty('display', 'none', 'important'); renderAdd2(); }, 'sm'),
      btn('', function () { deleteEl(el); renderAdd2(); }, 'sm bad', 'Delete', 'trash')));
  });
  b.appendChild(sec('Your added stuff', list));

  var f = h('input', { class: 'in', placeholder: 'Find this word' }), r = h('input', { class: 'in', placeholder: 'Change it to' });
  b.appendChild(sec('Change every word',
    h('div', { class: 'grid g2' }, f, r),
    h('div', { class: 'flex mt' }, btn('Replace everywhere', function () {
      var fv = f.value.trim();
      if (!fv) { toast('Type a word to find first'); return; }
      change({ t: 'replace', f: fv, r: r.value }, 'Replace "' + short(fv, 16) + '"');
      toast('Done! It also changes new stuff the site loads.', 'ok');
    }, 'pri sm', null, 'wand'), h('span', { class: 'dimtx', text: 'e.g. "YouTube" \u2192 "MyTube"' }))));

  b.appendChild(sec('Change every picture',
    btn('Replace ALL pictures with mine', function () {
      chooseFile('image/*', function (file) { readImage(file, 900).then(function (src) { change({ t: 'imgall', v: src }, 'Replace every picture'); toast('Every picture is yours now lol', 'ok'); }); });
    }, '', 'Every picture on the page becomes your picture', 'image')));
}
function renderAdd2() { if (curTab === 'add') renderTab(); }

// ===== 12-cssjs.js =====
// ---------- CSS / JS: write your own code for the page ----------

var userSheet = null;
function cssApply() {
  if (!userSheet) userSheet = docSheet('');
  try { userSheet.replaceSync(S.css || ''); } catch (e) { toast('CSS problem: ' + e.message, 'bad'); }
}

var CSS_SNIPPETS = [
  ['Red text', 'body, body * {\n  color: #ff2a6d !important;\n}'],
  ['Round everything', 'body * {\n  border-radius: 14px !important;\n}'],
  ['Hide pictures', 'img, video, picture {\n  display: none !important;\n}'],
  ['Hacker mode', 'html, body, body * {\n  background: #000 !important;\n  color: #3dffa2 !important;\n  font-family: Consolas, monospace !important;\n  border-color: #3dffa2 !important;\n}'],
  ['Rainbow links', 'a {\n  background: linear-gradient(90deg, #ff2a6d, #ffd60a, #3dffa2, #2de2ff, #8338ec);\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent !important;\n}'],
  ['Spin on hover', 'body *:hover {\n  rotate: 3deg;\n  transition: rotate .2s;\n}']
];
var JS_SNIPPETS = [
  ['Say hi', 'alert("hi from Edit Website")'],
  ['Count links', 'document.querySelectorAll("a").length + " links on this page"'],
  ['Every word = bruh', 'var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);\nvar n;\nwhile (n = w.nextNode()) {\n  if (n.nodeValue.trim()) n.nodeValue = n.nodeValue.replace(/[A-Za-z]+/g, "bruh");\n}'],
  ['Random colors', 'document.querySelectorAll("body *").forEach(function (el) {\n  el.style.color = "hsl(" + Math.random() * 360 + ",90%,60%)";\n});'],
  ['Page title', 'document.title = "I hacked this (not really)";\ndocument.title']
];

var jsEd = null, jsOut = null;
function renderCssJs() {
  var b = bodyEl;
  var cssEd = makeEditor('css', {
    short: true,
    placeholder: '/* Type CSS here. It changes the page as you type. */\nh1 { color: hotpink; }',
    oninput: debounce(function (v) { setState('css', v, 'Edit CSS', 'css'); }, 250)
  });
  cssEd.set(S.css || '');
  b.appendChild(sec('CSS (styles, applies live)',
    cssEd.wrap,
    h('div', { class: 'flex mt', style: { 'flex-wrap': 'wrap' } }, CSS_SNIPPETS.map(function (sn) {
      return btn(sn[0], function () { var v = (S.css ? S.css.replace(/\s*$/, '') + '\n\n' : '') + sn[1] + '\n'; cssEd.set(v); setState('css', v, 'CSS: ' + sn[0]); }, 'sm', 'Add this example');
    })),
    h('div', { class: 'note', text: 'Tip: add !important if the site\'s own style wins. Undo works here too.' })));

  jsEd = makeEditor('js', {
    short: true,
    placeholder: '// Type JavaScript and hit Run (Ctrl+Enter)\ndocument.body.style.rotate = "2deg"',
    oninput: debounce(function (v) { if (v !== S.js.code) setState('js', Object.assign({}, S.js, { code: v }), 'Edit JS', 'js'); }, 400),
    onrun: runJsBox
  });
  jsEd.set(S.js.code || '');
  jsOut = h('div', { class: 'out' });
  b.appendChild(sec('JavaScript (runs when you hit Run)',
    jsEd.wrap,
    h('div', { class: 'flex mt' },
      btn('Run', runJsBox, 'pri sm', 'Ctrl+Enter', 'play'),
      btn(S.js.auto ? 'Runs every visit: ON' : 'Runs every visit: OFF', function () {
        setState('js', Object.assign({}, S.js, { code: jsEd.get(), auto: !S.js.auto }), 'Toggle JS every visit'); renderTab();
      }, S.js.auto ? 'on sm' : 'sm', 'Run this code by itself every time this page opens'),
      btn('Clear output', function () { empty(jsOut); }, 'sm')),
    jsOut,
    h('div', { class: 'flex mt', style: { 'flex-wrap': 'wrap' } }, JS_SNIPPETS.map(function (sn) {
      return btn(sn[0], function () { jsEd.set(sn[1]); setState('js', Object.assign({}, S.js, { code: sn[1] }), 'JS example: ' + sn[0]); }, 'sm', 'Load this example');
    })),
    h('div', { class: 'note' + (KIND === 'extension' ? '' : ' warn'), text: KIND === 'extension'
      ? 'Running in the extension. On super strict sites, turn on "Allow User Scripts" for Edit Website in chrome://extensions so code can run there too.'
      : 'Some strict sites (YouTube, GitHub...) block code from bookmarks. The Edit Website extension can run it anywhere.' })));
}
function runJsBox() {
  if (!jsEd) return;
  var code = jsEd.get();
  if (code !== S.js.code) setState('js', Object.assign({}, S.js, { code: code }), 'Edit JS');
  var line = h('div', null, h('span', { class: 'k-p', text: '> ' }), short(code, 80));
  jsOut.appendChild(line);
  runCode(code, function (r) {
    (r.l || []).forEach(function (l) { jsOut.appendChild(h('div', { text: l })); });
    if (r.e) jsOut.appendChild(h('div', { class: 'e', text: r.e }));
    else jsOut.appendChild(h('div', { class: 'r', text: '\u2190 ' + (r.r == null ? 'done' : r.r) }));
    jsOut.scrollTop = jsOut.scrollHeight;
  });
}

// ===== 13-save.js =====
// ---------- SAVE: auto-save, download the edited site, history ----------

function renderSave() {
  var b = bodyEl;
  var n = countChanges();
  b.appendChild(sec('Your changes',
    h('div', { class: 'card' },
      h('div', { class: 'selname', text: n + (n === 1 ? ' change on this page' : ' changes on this page') }),
      h('div', { class: 'dimtx', text: (location.hostname || 'local file') + (location.pathname.length > 1 ? short(location.pathname, 40) : '') })),
    row('Auto-save', btn(S.autosave ? 'ON' : 'OFF', function () {
      S.autosave = !S.autosave;
      if (S.autosave) saveNow();
      renderTab(); setStatus();
    }, S.autosave ? 'on sm' : 'sm', 'Saves every change by itself')),
    row('Comes back on', h('div', { class: 'grow' }, seg([['page', 'This page'], ['site', 'Whole site']], S.scope, function (v) {
      if (v === S.scope) return;
      var oldKey = curKey();
      S.scope = v;
      store.del(oldKey).then(saveNow);
      renderTab();
      toast(v === 'site' ? 'Your changes now come back on every page of ' + (location.hostname || 'this site') : 'Your changes now only come back on this exact page', 'ok', 3500);
    }))),
    h('div', { class: 'note', text: KIND === 'extension'
      ? 'Your changes come back by themselves every time you open this page. Only YOU see them.'
      : KIND === 'player' ? 'This is a downloaded page. Changes save in this browser.'
      : 'Your changes come back as soon as you click the Edit Website bookmark on this page. Only YOU see them.' })));

  b.appendChild(sec('Download',
    h('div', { class: 'grid g2' },
      btn('Download edited site', exportPage, 'pri', 'Save this page with all your changes as one .html file', 'download'),
      btn('Backup my changes', exportProject, '', 'Save a .json file with your changes (to load later or share)', 'save')),
    h('div', { class: 'grid g2 mt' },
      btn('Load a backup', importProject, '', 'Load a .json backup of changes onto this page', 'upload'),
      btn(S.scripts ? 'Site scripts: KEEP' : 'Site scripts: REMOVE', function () { S.scripts = !S.scripts; renderTab(); }, S.scripts ? 'on' : '', 'Removing the site\'s own scripts makes the download look right more often')),
    h('div', { class: 'note', text: 'The downloaded file opens offline and keeps your background, effects, added stuff and buttons. Press Alt+Shift+E inside it to keep editing.' })));

  var list = h('div', { class: 'list' });
  if (!hist.length) list.appendChild(h('div', { class: 'li dimtx', text: 'No changes yet this time' }));
  list.appendChild(h('div', { class: 'li click' + (hpos === 0 ? ' cur' : ''), onclick: function () { goToHistory(0); } }, h('span', { class: 'nm dimtx', text: 'Start (before this session)' })));
  hist.forEach(function (e, i) {
    list.appendChild(h('div', { class: 'li click' + (i + 1 === hpos ? ' cur' : '') + (i >= hpos ? ' fut' : ''), title: 'Go back to right after this change', onclick: function () { goToHistory(i + 1); } },
      h('span', { class: 'nm', text: (i + 1) + '. ' + e.label })));
  });
  b.appendChild(sec('History (click to jump back)', list));

  var saved = h('div', { class: 'list' }, h('div', { class: 'li dimtx', text: 'Loading\u2026' }));
  store.list().then(function (all) {
    empty(saved);
    all = (all || []).filter(Boolean).sort(function (a, b2) { return (b2.saved || 0) - (a.saved || 0); });
    if (!all.length) saved.appendChild(h('div', { class: 'li dimtx', text: 'Nothing saved yet' }));
    all.forEach(function (p) {
      var me = p.key === curKey();
      saved.appendChild(h('div', { class: 'li' + (me ? ' cur' : '') },
        h('span', { class: 'nm', title: p.url, text: (p.scope === 'site' ? '[whole site] ' : '') + short(p.title || p.url, 46) }),
        h('span', { class: 'dimtx', text: countChanges(p) + '' }),
        me ? null : btn('Open', function () { W.open(p.url, '_blank', 'noopener'); }, 'sm'),
        btn('', function () {
          confirmBox('Delete saved changes?', 'This forgets the saved changes for:\n' + (p.title || p.url), 'Delete', function () {
            store.del(p.key).then(function () { if (me) { ops = []; } renderTab(); });
          });
        }, 'sm bad', 'Forget these changes', 'trash')));
    });
  });
  b.appendChild(sec(KIND === 'extension' ? 'Saved pages (all sites)' : 'Saved pages on this site', saved));

  b.appendChild(sec('Start over',
    btn('Reset this page (delete ALL my changes)', function () {
      confirmBox('Reset this page?', 'All your changes on this page get deleted and the page reloads back to normal. You can\'t undo this.', 'Reset', function () {
        S.autosave = false;
        store.del(KEYS.page).then(function () { return store.del(KEYS.site); }).then(function () { location.reload(); });
      });
    }, 'bad', null, 'refresh')));
}

// ----- download the page as one .html file -----
function rulesText(sheet) {
  try { return Array.prototype.map.call(sheet.cssRules, function (r) { return r.cssText; }).join('\n'); } catch (e) { return ''; }
}
function safeJSON(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function exportPage() {
  stopEditText();
  if (P.editAll) editAll(false);
  edCommit();
  if (GR) gravityStop();
  try {
    var clone = HTML.cloneNode(true);
    $$('ew-root, ew-bg, [data-ew-internal]', clone).forEach(function (n) { n.remove(); });
    clone.removeAttribute('data-ew-alive');
    ['--ew-oy', '--ew-rx', '--ew-ry'].forEach(function (k) { clone.style.removeProperty(k); });
    if (!clone.getAttribute('style')) clone.removeAttribute('style');
    // styles that sites add with JavaScript don't show up in the HTML, copy them in
    var os = $$('style', HTML).filter(function (s) { return !isOurs(s); }), cs = $$('style', clone);
    os.forEach(function (st, i) {
      var txt = st.sheet ? rulesText(st.sheet) : '';
      if (cs[i] && txt && st.sheet.cssRules.length && (st.textContent || '').trim().length < 20) cs[i].textContent = txt;
    });
    var extra = '';
    try { Array.prototype.forEach.call(D.adoptedStyleSheets || [], function (sh) { if (!docSheets.has(sh)) extra += rulesText(sh) + '\n'; }); } catch (e) {}
    // undo the see-through background tweaks (the page redoes them when it opens)
    xray.forEach(function (rec, el) {
      var p = cssPath(el), c = p && clone.querySelector(p);
      if (!c) return;
      if (rec.c[0]) c.style.setProperty('background-color', rec.c[0], rec.c[1]); else c.style.removeProperty('background-color');
      if (rec.grad) { if (rec.i[0]) c.style.setProperty('background-image', rec.i[0], rec.i[1]); else c.style.removeProperty('background-image'); }
      if (!c.getAttribute('style')) c.removeAttribute('style');
    });
    // drawings on <canvas> become pictures
    var oc = $$('canvas', HTML).filter(function (c) { return !isOurs(c); }), cc = $$('canvas', clone);
    oc.forEach(function (c, i) {
      if (!cc[i]) return;
      try {
        var img = D.createElement('img');
        img.setAttribute('src', c.toDataURL());
        ['class', 'style', 'width', 'height', 'id'].forEach(function (a) { if (c.hasAttribute(a)) img.setAttribute(a, c.getAttribute(a)); });
        cc[i].replaceWith(img);
      } catch (e) {}
    });
    // typed-in form values
    var oi = $$('input,textarea', HTML).filter(function (x) { return !isOurs(x); }), ci = $$('input,textarea', clone);
    oi.forEach(function (x, i) {
      var y = ci[i]; if (!y) return;
      if (x.localName === 'textarea') y.textContent = x.value;
      else if (x.type === 'checkbox' || x.type === 'radio') { if (x.checked) y.setAttribute('checked', ''); else y.removeAttribute('checked'); }
      else if (x.type !== 'password' && x.type !== 'file') y.setAttribute('value', x.value);
    });
    $$('[data-ew-add="popup"]', clone).forEach(function (p) { p.style.removeProperty('display'); });
    if (!S.scripts) $$('script', clone).forEach(function (s) { s.remove(); });
    $$('link[rel="modulepreload"], link[as="script"]', clone).forEach(function (l) { l.remove(); });
    var head = clone.querySelector('head');
    if (!head) { head = D.createElement('head'); clone.insertBefore(head, clone.firstChild); }
    if (!clone.querySelector('base')) {
      var base = D.createElement('base');
      base.setAttribute('href', location.href.split('#')[0]);
      head.insertBefore(base, head.firstChild);
    }
    if (!clone.querySelector('meta[charset]')) {
      var mc = D.createElement('meta'); mc.setAttribute('charset', 'utf-8');
      head.insertBefore(mc, head.firstChild);
    }
    var html = '<!DOCTYPE html>\n' + clone.outerHTML;
    var actsObj = {};
    acts.forEach(function (v, k) { actsObj[k] = v; });
    var proj = { v: 1, bg: S.bg, fx: S.fx, fxo: S.fxo, css: S.css, js: S.js, acts: actsObj, ops: [] };
    var self = '(' + SELF.toString() + ')();';
    var tail = (extra.trim() ? '<style data-ew-site>' + extra.replace(/<\/style/gi, '<\\/style') + '</style>\n' : '') +
      '<script>window.__EW_ENV=' + safeJSON({ kind: 'player', project: proj }) + ';</script>\n' +
      '<script>' + self.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--') + '</script>\n';
    var at = html.toLowerCase().lastIndexOf('</body>');
    html = at >= 0 ? html.slice(0, at) + tail + html.slice(at) : html + tail;
    var name = 'edited-' + ((location.hostname || 'page').replace(/^www\./, '').replace(/[^a-z0-9.-]+/gi, '-')) + '.html';
    download(html, name, 'text/html');
    toast('Downloading ' + name, 'ok');
  } catch (e) {
    console.warn(e);
    toast('Download failed: ' + (e && e.message || e), 'bad', 5000);
  }
}
function exportProject() {
  var p = project();
  download(JSON.stringify(p, null, 1), 'edit-website-backup-' + ((location.hostname || 'page').replace(/[^a-z0-9.-]+/gi, '-')) + '.json', 'application/json');
}
function importProject() {
  chooseFile('.json,application/json', function (f) {
    readFile(f, 'text').then(function (t) {
      var p;
      try { p = JSON.parse(t); } catch (e) { toast('That file isn\'t an Edit Website backup', 'bad'); return; }
      if (!p || p.v !== 1) { toast('That file isn\'t an Edit Website backup', 'bad'); return; }
      confirmBox('Load this backup?', 'This page reloads and the changes from the backup get put on it.' + (p.url && p.url !== location.href.split('#')[0] ? '\n\nHeads up: the backup was made on a different page, some changes might not fit.' : ''), 'Load it', function () {
        p.key = curKey(); p.scope = S.scope; p.saved = now();
        S.autosave = false;
        store.set(curKey(), p).then(function () { location.reload(); }, function (e) { toast('Couldn\'t load: ' + (e && e.message || e), 'bad'); });
      });
    });
  });
}

// ===== 14-main.js =====
// ---------- starting up ----------

function open() {
  buildUI();
  panel.classList.add('show');
  pill.classList.remove('show');
  if (S.open) return;
  S.open = true;
  renderTab();
}
function close() {
  if (!ui) return;
  pick(false);
  stopEditText();
  if (P.editAll) editAll(false);
  edCommit();
  select(null);
  place(hlBox, null);
  panel.classList.remove('show');
  pill.classList.remove('show');
  S.open = false;
  if (S.autosave && (hist.length || ops.length)) saveNow();
}
function minimize() {
  close();
  pill.classList.add('show');
}
function toggle() { if (S.open) close(); else open(); }

function isTyping(e) {
  var t = e.composedPath ? e.composedPath()[0] : e.target;
  // from outside, everything in our (closed) editor looks like the host element
  if (t === host && root) t = root.activeElement || t;
  if (!t || t.nodeType !== 1) return false;
  return /^(input|textarea|select)$/i.test(t.localName) || t.isContentEditable;
}
function onKey(e) {
  var k = e.key;
  if (k === 'Escape' && modalOpen()) { e.preventDefault(); modalClose(); return; }
  if (e.altKey && e.shiftKey && (k === 'E' || k === 'e' || e.code === 'KeyE') && KIND !== 'extension') { e.preventDefault(); toggle(); return; }
  if (!S.open) {
    if (k === 'Escape' && GR) gravityStop();
    return;
  }
  if (k === 'Escape') {
    if (P.on) { pick(false); P.mode = 'select'; if (curTab === 'pick') renderTab(); e.preventDefault(); return; }
    if (GR) { gravityStop(); return; }
    if (P.editing) { stopEditText(); return; }
    if (P.sel) { select(null); return; }
    return;
  }
  if (isTyping(e)) return;
  var mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && (k === 'z' || k === 'Z')) { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && !e.altKey && (k === 'y' || k === 'Y')) { e.preventDefault(); e.stopPropagation(); redo(); return; }
  if (P.sel && (k === 'Delete' || k === 'Backspace') && !mod) { e.preventDefault(); e.stopPropagation(); deleteEl(P.sel); return; }
  if (P.sel && /^Arrow/.test(k) && !mod) {
    e.preventDefault(); e.stopPropagation();
    var st = e.shiftKey ? 10 : 1;
    nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0);
  }
}

function listenExtension() {
  try {
    chrome.runtime.onMessage.addListener(function (m, s, reply) {
      if (m && m.ew === 'toggle') { W.__EW.toggle(); reply({ ok: true }); }
      else if (m && m.ew === 'ping') reply({ ok: true });
    });
  } catch (e) {}
}

function loadSaved(cb) {
  store.get(KEYS.page).then(function (p) { return p || store.get(KEYS.site); }).then(function (p) {
    if (!p) { if (cb) cb(0); return; }
    applyProject(p, function (got, missed) {
      if (cb) cb(got || countChanges(p), missed);
    });
  }, function () { if (cb) cb(0); });
}

function boot() {
  HTML.setAttribute('data-ew-alive', KIND);
  W.__EW = { alive: true, kind: KIND, version: VERSION, toggle: toggle, open: open, close: close };
  D.addEventListener('ew-toggle', function () { toggle(); });
  D.addEventListener('click', onRuntimeClick, true);
  W.addEventListener('keydown', onKey, true);
  W.addEventListener('pointerdown', function () { if (AC && AC.state === 'suspended') AC.resume(); }, true);
  if (KIND === 'extension') listenExtension();
  makeKeys();
  setInterval(keepSheets, 2000);

  if (KIND === 'player') {
    // a downloaded page: put the effects back, then anything edited since
    buildHost();
    applyProject(ENV.project);
    loadSaved();
    return;
  }
  if (KIND === 'extension') {
    // changes come back by themselves; the editor opens from the toolbar button
    loadSaved();
    return;
  }
  // bookmark: open right away, then bring back saved changes
  open();
  loadSaved(function (n, missed) {
    if (n) toast('Brought back your ' + n + (n === 1 ? ' change' : ' changes') + (missed ? ' (' + missed + ' couldn\'t find their spot)' : ''), 'ok', 3500);
  });
}

boot();

})();
