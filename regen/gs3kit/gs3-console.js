/* Game System 3 console kit: a game's menus look like the console picked in Game System 3 (PS5, Xbox, Switch, PS4)
   and switch the moment you pick another one. Outside Game System 3 (a browser, the phone) it uses Game System 3's
   own look. How to use it: README.md. Loads gs3-console.css (same folder) by itself. */
(function () {
  if (window.GS3Console) return;
  var LOOKS = { ps5: 'PS5', xbox: 'Xbox', switch: 'Nintendo Switch', ps4: 'PS4' };
  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/[^/?#]*([?#].*)?$/, '') : '';
  if (!document.querySelector('link[data-gs3-kit]')) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = base + 'gs3-console.css';
    l.setAttribute('data-gs3-kit', '');
    (document.head || document.documentElement).appendChild(l);
  }

  var listeners = [];
  var hintBoxes = [];
  var look = null;
  /* which look: ?look=ps5 in the address (for trying it out), else what Game System 3 says */
  function wanted(c) {
    var q = /[?&]look=([a-z0-9]+)/i.exec(location.search);
    if (q) return LOOKS[q[1]] ? q[1] : '';
    c = c || (window.GameSystem && window.GameSystem.console);
    return c && LOOKS[c.skin] ? c.skin : '';
  }
  function apply(c) {
    var next = wanted(c);
    if (next === look) return;
    look = next;
    if (look) document.documentElement.setAttribute('data-gs3-look', look);
    else document.documentElement.removeAttribute('data-gs3-look');
    hintBoxes.forEach(drawHints);
    listeners.forEach(function (f) { try { f(look); } catch (e) { /* game error */ } });
  }
  apply();
  document.addEventListener('DOMContentLoaded', function () { apply(); });
  window.addEventListener('gs3:console', function (e) { apply(e.detail); });
  /* Game System 3 also marks the page (<html data-gs3-console>): follow that too, it always gets through */
  if (window.MutationObserver) {
    new MutationObserver(function () { apply(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-gs3-console'] });
  }

  /* ---------- the press animation (what you press squishes and springs back, like on that console) ---------- */
  var FX = { '': [[1, .97, 1], 170], ps5: [[1, .955, 1], 210], ps4: [[1, .965, 1], 180], xbox: [[1, .94, 1], 140], switch: [[1, .92, 1.035, 1], 280] };
  function press(el) {
    if (!el || !el.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var fx = FX[look || ''];
    var k = (el.offsetWidth || 0) > 420 ? fx[0].map(function (v) { return 1 - (1 - v) * .35; }) : fx[0];
    el.animate(k.map(function (v) { return { transform: 'scale(' + v + ')' }; }), { duration: fx[1], easing: 'cubic-bezier(.3,.7,.3,1)' });
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest && e.target.closest('.gs3-item, .gs3-btn, .gs3-toggle');
    if (el) press(el);
  }, true);
  /* toggles flip themselves */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('.gs3-toggle');
    if (t && !t.hasAttribute('data-manual')) t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  });

  /* ---------- moving around a menu with the arrow keys or a controller ---------- */
  var SEL = '.gs3-item, .gs3-btn, .gs3-toggle, .gs3-slider, [data-gs3-nav]';
  var navs = [];
  function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled; }
  function nav(root, opts) {
    opts = opts || {};
    var cur = null;
    function items() { return Array.prototype.filter.call(root.querySelectorAll(SEL), visible); }
    function focus(el) {
      if (cur) cur.classList.remove('gs3-focus');
      cur = el || null;
      if (cur) { cur.classList.add('gs3-focus'); if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' }); }
      if (opts.onMove && el) opts.onMove(el);
    }
    function move(dir) {
      var list = items();
      if (!cur || list.indexOf(cur) < 0) { focus(list[0]); return; }
      if (cur.classList.contains('gs3-slider') && (dir === 'left' || dir === 'right')) {
        cur.value = Number(cur.value) + (dir === 'left' ? -1 : 1) * Number(cur.step || 1);
        cur.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      var a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2, best = null, bd = Infinity;
      list.forEach(function (el) {
        if (el === cur) return;
        var b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2, dx = bx - ax, dy = by - ay;
        var ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4;
        if (!ok) return;
        var d = (dir === 'up' || dir === 'down') ? Math.abs(dy) + Math.abs(dx) * 2 : Math.abs(dx) + Math.abs(dy) * 2;
        if (d < bd) { bd = d; best = el; }
      });
      if (best) focus(best);
    }
    function act(a) {
      if (a === 'ok') { if (cur) { press(cur); cur.click(); } return true; }
      if (a === 'back') { if (opts.back) opts.back(); return !!opts.back; }
      move(a);
      return true;
    }
    var api = { root: root, act: act, focus: focus, current: function () { return cur; }, stop: function () { var i = navs.indexOf(api); if (i >= 0) navs.splice(i, 1); if (cur) cur.classList.remove('gs3-focus'); } };
    root.addEventListener('mousemove', function (e) { var el = e.target.closest && e.target.closest(SEL); if (el && el !== cur && root.contains(el)) focus(el); });
    navs.push(api);
    focus(opts.first || items()[0]);
    pollPads();
    return api;
  }
  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', ' ': 'ok', Escape: 'back', Backspace: 'back' };
  document.addEventListener('keydown', function (e) {
    var n = navs[navs.length - 1];
    if (!n || !KEYS[e.key] || !document.contains(n.root) || n.root.closest('[hidden]')) return;
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text' && KEYS[e.key] !== 'back') return;
    if (n.act(KEYS[e.key])) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  /* controller: d-pad / left stick to move, A (Cross) = OK, B (Circle) = back */
  var polling = false, held = {};
  function pollPads() {
    if (polling || !navigator.getGamepads) return;
    polling = true;
    (function tick() {
      var n = navs[navs.length - 1];
      if (!n) { polling = false; return; }
      var pads = [];
      try { pads = navigator.getGamepads() || []; } catch (e) { /* blocked */ }
      var p = null;
      for (var i = 0; i < pads.length; i++) if (pads[i]) { p = pads[i]; break; }
      if (p && document.contains(n.root) && !n.root.closest('[hidden]')) {
        var b = function (i) { return p.buttons[i] && p.buttons[i].pressed; };
        var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        var now = { up: b(12) || ay < -.6, down: b(13) || ay > .6, left: b(14) || ax < -.6, right: b(15) || ax > .6, ok: b(0), back: b(1) };
        Object.keys(now).forEach(function (k) {
          var t = performance.now();
          if (now[k] && (!held[k] || (t - held[k] > 380 && /up|down|left|right/.test(k)))) { n.act(k); held[k] = held[k] ? t - 260 : t; }
          if (!now[k]) held[k] = 0;
        });
      }
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- button hints drawn as that console's own buttons ---------- */
  var PS = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 7l10 10M17 7 7 17"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="6"/></svg>',
    options: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5.5 19 17.5H5z"/></svg>'
  };
  function glyph(b) {
    if (look === 'ps5' || look === 'ps4') return PS[b] || '';
    if (look === 'xbox' || look === 'switch') return { ok: 'A', back: 'B', options: look === 'xbox' ? 'Y' : '+' }[b] || '';
    return { ok: 'Enter', back: 'Esc', options: 'Tab' }[b] || '';
  }
  function drawHints(box) {
    box.el.textContent = '';
    box.el.classList.add('gs3-hints');
    box.list.forEach(function (h) {
      var s = document.createElement('span');
      s.className = 'gs3-hint';
      s.setAttribute('data-b', h[0]);
      var k = document.createElement('span');
      k.className = 'gs3-key';
      k.setAttribute('data-b', h[0]);
      k.innerHTML = glyph(h[0]);
      s.appendChild(k);
      s.appendChild(document.createTextNode(h[1]));
      box.el.appendChild(s);
    });
  }
  function hints(el, list) {
    var box = hintBoxes.filter(function (b) { return b.el === el; })[0];
    if (!box) { box = { el: el, list: list }; hintBoxes.push(box); } else box.list = list;
    drawHints(box);
    return el;
  }

  /* ---------- for games that draw their menus themselves (canvas): the look's colors + font ---------- */
  function theme() {
    var cs = getComputedStyle(document.documentElement);
    var v = function (n) { return cs.getPropertyValue(n).trim(); };
    return { look: look || '', font: v('--k-font'), text: v('--k-text'), text2: v('--k-text2'), panel: v('--k-panel'), dim: v('--k-dim'),
      button: v('--k-btn'), buttonText: v('--k-btn-text'), focus: v('--k-focus-bg'), focusText: v('--k-focus-text'), accent: v('--k-accent'),
      radius: parseFloat(v('--k-btn-radius')) || 0, panelRadius: parseFloat(v('--k-panel-radius')) || 0 };
  }

  window.GS3Console = {
    look: function () { return look || ''; },
    name: function () { return LOOKS[look] || 'Game System 3'; },
    onChange: function (f) { if (typeof f === 'function') listeners.push(f); },
    theme: theme,
    nav: nav,
    hints: hints,
    press: press
  };
})();
