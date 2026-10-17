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
