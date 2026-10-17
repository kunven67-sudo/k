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
