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
