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
