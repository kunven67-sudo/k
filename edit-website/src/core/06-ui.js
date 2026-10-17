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
