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
