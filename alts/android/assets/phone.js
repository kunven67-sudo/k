/* ALTS for phone 2.0: the shell around the PC app's page code (page.js + extras.js run right after).
   It answers their postMessage calls like the PC app does, and draws the phone UI in the PC look:
   the pill at the top, the ALTS sheet (accounts, usage, saved chats, settings) and the sticker box
   (favorites, memes, your pics, GIPHY search). The app side is MainActivity's AltsPhone bridge. */
(function () {
  if (location.hostname !== 'claude.ai' || window.__altsPhone) return;
  window.__altsPhone = true;
  var B = window.AltsPhone || null; // the app; absent in tests until the fake one is set
  // The app hands this script a key; every call carries it. Android shows AltsPhone to every frame,
  // including artifacts (anyone's HTML): without the key they get nothing. Then the global goes away.
  var KEY = String(window.__altsKey || '');
  try { delete window.__altsKey; } catch (e) { window.__altsKey = undefined; }
  var FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  var usage = null, count = null, savedChatId = '';

  // ---------- talking to the app ----------
  function call(name) {
    var args = [KEY].concat([].slice.call(arguments, 1));
    try { var b = window.AltsPhone || B; return b && b[name] ? b[name].apply(b, args) : null; } catch (e) { return null; }
  }
  function jcall(name) {
    var raw = call.apply(null, arguments);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  var rpcN = 0, rpcWait = {};
  window.__AltsRpc = {
    done: function (token, json) {
      var w = rpcWait[token];
      if (!w) return;
      delete rpcWait[token];
      var v = null;
      try { v = JSON.parse(json); } catch (e) { v = { error: 'bad answer' }; }
      w(v);
    }
  };
  function rpc(name, args) {
    return new Promise(function (res) {
      var token = 'r' + (++rpcN) + Date.now().toString(36);
      rpcWait[token] = res;
      var ok = false;
      try { var b = window.AltsPhone || B; if (b && b.rpc) { b.rpc(KEY, token, name, JSON.stringify(args || {})); ok = true; } } catch (e) {}
      if (!ok) { delete rpcWait[token]; res({ error: 'no app' }); }
      setTimeout(function () { if (rpcWait[token]) { delete rpcWait[token]; res({ error: 'took too long' }); } }, name === 'giphy' || name === 'giphyTake' || name === 'memeRefresh' ? 45000 : 120000);
    });
  }

  // page.js + extras.js think they're talking to the PC app:
  window.chrome = window.chrome || {};
  window.chrome.webview = { postMessage: function (s) { var m = null; try { m = JSON.parse(s); } catch (e) { return; } onMsg(m); } };

  // ---------- UI bones ----------
  var host = document.createElement('div');
  host.dataset.alts = '1';
  var root = host.attachShadow({ mode: 'open' });
  var css = document.createElement('style');
  css.textContent =
    ':host{all:initial}*{box-sizing:border-box;font-family:' + FONT + ';-webkit-tap-highlight-color:transparent}' +
    'button{font-family:inherit}input{font-family:inherit}' +
    '.pill{position:fixed;top:calc(6px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:2147483600;display:flex;align-items:center;gap:7px;padding:6px 13px;border-radius:999px;background:rgba(27,27,32,.94);color:#ececf1;font-size:12px;font-weight:650;box-shadow:0 4px 14px rgba(0,0,0,.35);border:1px solid #2a2a32;max-width:86vw;white-space:nowrap}' +
    '.pill .dot{width:8px;height:8px;border-radius:50%;background:#d97757;flex:0 0 8px}' +
    '.dim{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);opacity:0;transition:opacity .18s;pointer-events:none}.dim.on{opacity:1;pointer-events:auto}' +
    '.sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#1b1b20;color:#ececf1;border:1px solid #2a2a32;border-bottom:0;border-radius:18px 18px 0 0;padding:14px 16px calc(18px + env(safe-area-inset-bottom,0px));transform:translateY(105%);transition:transform .22s ease;box-shadow:0 -10px 34px rgba(0,0,0,.5);max-height:86vh;display:flex;flex-direction:column}' +
    '.sheet.on{transform:none}' +
    '.grip{width:36px;height:4px;border-radius:2px;background:#3a3a44;margin:0 auto 10px}' +
    '.hd{display:flex;align-items:baseline;gap:8px;margin-bottom:10px}.hd b{font-size:17px}.hd small{color:#9a9aa6;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.body{overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}' +
    '.accs{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;-webkit-overflow-scrolling:touch}' +
    '.acc{flex:0 0 auto;display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:999px;background:#24242b;border:1px solid #2a2a32;color:#ececf1;font-size:13.5px;font-weight:600}' +
    '.acc.on{background:#2e2e36;border-color:#5a5a66}.acc .d{width:9px;height:9px;border-radius:50%;flex:0 0 9px}' +
    '.u{margin:7px 0}.u b{display:flex;justify-content:space-between;font-size:13px;font-weight:600;gap:8px}.u b span{color:#9a9aa6;font-size:11.5px;font-weight:500;white-space:nowrap}' +
    '.bar{margin-top:5px;height:7px;border-radius:4px;background:#24242b;overflow:hidden}.bar i{display:block;height:100%;background:#d97757;border-radius:4px;transition:width .3s}.bar i.hot{background:#ef5b5b}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}' +
    '.gb{height:48px;border:1px solid #2a2a32;border-radius:12px;background:#24242b;color:#ececf1;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:7px;position:relative}' +
    '.gb:active{background:#2e2e36}.gb.main{background:#d97757;border-color:#d97757;color:#fff;grid-column:1/-1}' +
    '.gb .badge{position:absolute;top:-6px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#d97757;color:#fff;font:700 11px/18px ' + FONT + ';padding:0 5px}' +
    '.row{display:flex;gap:8px;align-items:center}' +
    '.in{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid #2a2a32;background:#222229;color:#ececf1;font-size:14px;outline:none}' +
    '.sm{padding:9px 13px;border-radius:10px;border:1px solid #3a3a44;background:#24242b;color:#ececf1;font-size:13px;font-weight:600;white-space:nowrap}.sm:active{background:#2e2e36}' +
    '.chips{display:flex;gap:6px;overflow-x:auto;padding:8px 0}.chip{flex:0 0 auto;padding:7px 12px;border-radius:999px;border:1px solid #2a2a32;background:transparent;color:#9a9aa6;font-size:12.5px;font-weight:650}.chip.on{background:#2e2e36;color:#fff;border-color:#5a5a66}' +
    '.sgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding-bottom:8px}' +
    '.st{position:relative;aspect-ratio:1;border-radius:10px;background:#24242b;overflow:hidden;border:1px solid #2a2a32}.st img{width:100%;height:100%;object-fit:contain}.st:active{background:#2f2f38}' +
    '.st .fav{position:absolute;top:2px;right:2px;width:26px;height:26px;border:0;border-radius:8px;background:rgba(20,20,24,.55);color:#8d8d98;font-size:14px;line-height:26px;text-align:center;padding:0}.st .fav.on{color:#f5c04f}' +
    '.list{border-top:1px solid #2a2a32;margin-top:8px}.item{display:flex;gap:10px;align-items:center;padding:11px 2px;border-bottom:1px solid #2a2a32}.item .tx{flex:1;min-width:0}.item .t1{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item .t2{font-size:11.5px;color:#9a9aa6;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.note{color:#9a9aa6;font-size:12.5px;line-height:1.5;margin:8px 0}' +
    '.toast{position:fixed;left:50%;bottom:calc(92px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483647;background:#2e2e33;color:#fff;padding:10px 16px;border-radius:12px;font-size:13.5px;opacity:0;transition:opacity .2s;max-width:86vw;text-align:center;pointer-events:none}.toast.on{opacity:1}' +
    '.menu{position:fixed;left:50%;bottom:0;transform:translate(-50%,105%);transition:transform .18s;z-index:2147483647;background:#24242b;border:1px solid #2a2a32;border-radius:14px 14px 0 0;padding:8px;width:100%;max-width:480px}' +
    '.menu.on{transform:translate(-50%,0)}.menu button{display:block;width:100%;border:0;background:transparent;color:#ececf1;font-size:15px;font-weight:600;padding:13px;border-radius:10px;text-align:center}.menu button:active{background:#2e2e36}.menu button.red{color:#ff8b8b}';
  root.append(css);
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  var pill = el('div', 'pill');
  var pillDot = el('span', 'dot'), pillText = el('span', '', 'ALTS');
  pill.append(pillDot, pillText);
  var dim = el('div', 'dim');
  var toastEl = el('div', 'toast');
  root.append(pill, dim, toastEl);
  function attach() { if (!document.documentElement) return; if (!host.isConnected) document.documentElement.appendChild(host); }
  attach();
  setInterval(attach, 1500);
  // (Everything here sits above the chat-box buttons; later in the page = on top, so the toast moves last.)
  function toast(t) { root.append(toastEl); toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, 2400); }

  // page.js's little box (save progress, Saved, Pins, Send later...) sits in the PC's bottom-right
  // corner. On a phone that covers the chat box and the keyboard: put it full width at the top.
  function phoneBox(n) {
    if (!n || n.nodeType !== 1 || n === host || !n.dataset || n.dataset.alts !== '1') return;
    var st = n.style;
    if (st.position !== 'fixed' || st.right !== '20px' || st.bottom !== '20px') return;
    n.dataset.altsBox = '1';
    st.left = '10px'; st.right = '10px'; st.width = 'auto'; st.bottom = 'auto';
    st.top = 'calc(46px + env(safe-area-inset-top, 0px))'; st.maxHeight = '72vh'; st.overflowY = 'auto';
  }
  new MutationObserver(function (rs) {
    rs.forEach(function (r) { Array.prototype.forEach.call(r.addedNodes, phoneBox); });
  }).observe(document.documentElement, { childList: true });

  // one sheet open at a time
  var sheets = [];
  function sheet() {
    // a leftover box from the page would sit over the sheet: it goes (anything still running makes a new one)
    Array.prototype.forEach.call(document.querySelectorAll('[data-alts-box]'), function (b) { b.remove(); });
    var s = el('div', 'sheet');
    s.append(el('div', 'grip'));
    root.append(s);
    sheets.push(s);
    requestAnimationFrame(function () { dim.classList.add('on'); s.classList.add('on'); });
    return s;
  }
  function closeSheets() {
    sheets.forEach(function (s) { s.classList.remove('on'); setTimeout(function () { s.remove(); }, 240); });
    sheets = [];
    dim.classList.remove('on');
    closeMenu();
  }
  dim.addEventListener('click', closeSheets);
  var menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.classList.remove('on'); var m = menuEl; setTimeout(function () { m.remove(); }, 200); menuEl = null; } }
  function menu(items) {
    closeMenu();
    menuEl = el('div', 'menu');
    items.concat([['Cancel', '', closeMenu]]).forEach(function (it) {
      var b = el('button', it[1], it[0]);
      b.addEventListener('click', function () { var fn = it[2]; closeMenu(); if (fn && fn !== closeMenu) fn(); });
      menuEl.append(b);
    });
    root.append(menuEl);
    requestAnimationFrame(function () { menuEl.classList.add('on'); });
  }
  function hold(elm, fn) { // press and hold
    var t = null;
    elm.addEventListener('touchstart', function () { t = setTimeout(fn, 550); }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (n) { elm.addEventListener(n, function () { clearTimeout(t); }, { passive: true }); });
    elm.addEventListener('contextmenu', function (e) { e.preventDefault(); fn(); });
  }
  var blobUrls = [];
  function blobUrl(b64, type) {
    try {
      var bin = atob(b64), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([u], { type: type || 'image/jpeg' }));
      blobUrls.push(url);
      if (blobUrls.length > 400) URL.revokeObjectURL(blobUrls.shift());
      return url;
    } catch (e) { return ''; }
  }
  function toFile(d) {
    var bin = atob(d.b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new File([u], d.name || 'sticker.png', { type: d.type || 'image/png' });
  }

  // ---------- usage ----------
  function pct(v) { return v == null || v < 0 ? null : Math.min(999, Math.round(v)); }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return 'resets ' + d.toLocaleString([], (d - Date.now() > 86400000) ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { hour: 'numeric', minute: '2-digit' });
  }
  function paintPill() {
    var info = jcall('info'), me = null;
    if (info) (info.list || []).forEach(function (a) { if (a.id === info.account) me = a; });
    pillDot.style.background = me && me.color ? me.color : '#d97757';
    var s = usage ? pct(usage.s) : null, w = usage ? pct(usage.w) : null;
    pillText.textContent = usage ? ('5h ' + (s == null ? '–' : s + '%') + ' · Week ' + (w == null ? '–' : w + '%')) : (me ? me.name : 'ALTS');
  }
  function bars(into, u, stale) {
    [['5-hour limit', u && u.s, u && u.sr], ['Weekly limit', u && u.w, u && u.wr]].forEach(function (x) {
      var p = pct(x[1]);
      var d = el('div', 'u');
      var b = el('b');
      b.append(el('span', '', ''), el('span', '', ''));
      b.firstChild.textContent = x[0] + ': ' + (p == null ? 'not known yet' : p + '%');
      b.firstChild.style.cssText = 'color:#ececf1;font-size:13px';
      var w = when(x[2]);
      b.lastChild.textContent = stale ? 'last seen' + (w ? ' · ' + w : '') : w;
      var bar = el('div', 'bar'), i = el('i', p != null && p >= 100 ? 'hot' : '');
      i.style.width = (p || 0) + '%';
      bar.append(i);
      d.append(b, bar);
      into.append(d);
    });
  }

  // ---------- the ALTS sheet ----------
  function openMain() {
    closeSheets();
    var info = jcall('info') || { list: [], account: '', profiles: false };
    var s = sheet();
    var hd = el('div', 'hd');
    var me = null;
    (info.list || []).forEach(function (a) { if (a.id === info.account) me = a; });
    hd.append(el('b', '', 'ALTS'), el('small', '', (me ? me.name : '') + (count ? ' · ' + count.msgs + ' messages · ' + count.words.toLocaleString() + ' words' : '')));
    var body = el('div', 'body');
    s.append(hd, body);

    // accounts, like the PC side list
    var accs = el('div', 'accs');
    (info.list || []).forEach(function (a) {
      var c = el('button', 'acc' + (a.id === info.account ? ' on' : ''));
      var d = el('span', 'd');
      d.style.background = a.color || '#d97757';
      c.append(d, el('span', '', a.name));
      c.addEventListener('click', function () {
        if (a.id === info.account) return;
        closeSheets();
        toast('Switching to ' + a.name + '...');
        call('switchAccount', a.id);
      });
      hold(c, function () {
        menu([
          ['Rename ' + a.name, '', function () {
            var n = prompt('New name for this account:', a.name);
            if (n && n.trim()) { call('renameAccount', a.id, n.trim()); openMain(); }
          }],
          a.id === 'default' ? null : ['Remove ' + a.name + ' (its login on this phone is wiped)', 'red', function () {
            if (confirm('Remove ' + a.name + ' from ALTS? Its login on this phone is wiped. The Claude account itself is not touched.')) {
              closeSheets();
              call('removeAccount', a.id);
            }
          }]
        ].filter(Boolean));
      });
      accs.append(c);
    });
    if (info.profiles) {
      var add = el('button', 'acc', '+ Add');
      add.addEventListener('click', function () {
        var n = prompt('Name for the new account (like "School"):', '');
        if (n == null) return;
        closeSheets();
        toast('Opening the new account: log in to Claude there');
        call('addAccount', n || '');
      });
      accs.append(add);
    } else if ((info.list || []).length <= 1) {
      // this phone's WebView can't split logins: say so instead of a broken + Add
    }
    if (info.oldApp) {
      var old = el('div', 'note');
      old.style.cssText = 'background:#24242b;border:1px solid #3a3a44;border-radius:12px;padding:10px 12px;margin:2px 0 10px;color:#ececf1';
      old.textContent = 'The old ALTS is still on your phone. Signed in here? Then remove the old one so you don\u2019t open it by mistake.';
      var ob = el('button', 'sm', 'Remove the old ALTS');
      ob.style.cssText = 'display:block;margin-top:8px;background:#d97757;border-color:#d97757;color:#fff';
      ob.addEventListener('click', function () { closeSheets(); call('removeOld'); });
      old.append(ob);
      body.append(old);
    }
    body.append(accs);
    if (!info.profiles) body.append(el('div', 'note', 'More accounts need a newer Android WebView (this phone’s can’t keep separate logins). Everything else works.'));

    // usage: me first, then the other accounts' last-known bars
    var ub = el('div');
    bars(ub, usage || (me && me.usage), false);
    body.append(ub);
    (info.list || []).forEach(function (a) {
      if (!a.usage || a.id === info.account) return;
      var t = el('div', 'note');
      t.style.margin = '10px 0 0';
      t.textContent = a.name;
      body.append(t);
      bars(body, a.usage, true);
    });

    // the buttons (same jobs as the PC list)
    var g = el('div', 'grid');
    function gb(label, cls, fn, badge) {
      var b = el('button', 'gb' + (cls ? ' ' + cls : ''), label);
      if (badge) b.append(el('span', 'badge', String(badge)));
      b.addEventListener('click', fn);
      g.append(b);
      return b;
    }
    var laterN = 0;
    try { laterN = (JSON.parse(localStorage.getItem('alts-later') || '[]') || []).length; } catch (e) {}
    gb('💾 Save this chat', 'main', function () { closeSheets(); try { window.__alts.save({ why: 'save' }); } catch (e) { toast('Not ready yet, try again'); } });
    gb('📂 Saved chats', '', openChats);
    gb('➡️ Continue on...', '', function () { pickContinue(info); });
    gb('😄 Stickers', '', openStickers);
    gb('⏰ Send later', '', function () { closeSheets(); try { window.__alts.laterList(); } catch (e) { toast('Not ready yet'); } }, laterN || null);
    gb('↻ Fresh chat', '', function () { closeSheets(); try { window.__altsFresh(); } catch (e) { toast('Not ready yet'); } });
    gb('⬆ Top', '', function () { closeSheets(); try { window.__alts.jump('top'); } catch (e) {} });
    gb('⬇ Bottom', '', function () { closeSheets(); try { window.__alts.jump('bottom'); } catch (e) {} });
    gb('⚙️ Settings', '', openSettings);
    body.append(g);
  }
  pill.addEventListener('click', function () { if (sheets.length) closeSheets(); else openMain(); });

  // ---------- Continue on another account ----------
  var continueTarget = null;
  function pickContinue(info) {
    var others = (info.list || []).filter(function (a) { return a.id !== info.account; });
    if (!others.length) { toast(info.profiles ? 'Add a second account first (+ Add).' : 'This phone’s WebView can’t hold a second login.'); return; }
    menu(others.map(function (a) {
      return ['Continue on ' + a.name, '', function () {
        closeSheets();
        continueTarget = a;
        toast('Saving this chat first...');
        try { window.__alts.save({ why: 'continue' }); } catch (e) { continueTarget = null; toast('Not ready yet, try again'); }
      }];
    }));
  }

  // ---------- saved chats ----------
  function openChats() {
    closeSheets();
    var s = sheet();
    var hd = el('div', 'hd');
    hd.append(el('b', '', 'Saved chats'));
    var row = el('div', 'row');
    var q = el('input', 'in');
    q.placeholder = 'Search every saved chat';
    var open = el('button', 'sm', 'Downloads');
    open.addEventListener('click', function () { call('openDownloads'); });
    row.append(q, open);
    var body = el('div', 'body'), list = el('div', 'list');
    body.append(list);
    s.append(hd, row, body);
    var t = null;
    function draw(items) {
      list.textContent = '';
      if (!items.length) { list.append(el('div', 'note', q.value ? 'Nothing has that in it.' : 'No saved chats yet. ALTS keeps every chat you save here, searchable, even offline.')); return; }
      var info = jcall('info') || { list: [] };
      items.forEach(function (c) {
        var it = el('div', 'item');
        var dot = el('span');
        var color = '#d97757';
        (info.list || []).forEach(function (a) { if (a.id === c.account) color = a.color || color; });
        dot.style.cssText = 'width:9px;height:9px;border-radius:50%;flex:0 0 9px;background:' + color;
        var tx = el('div', 'tx');
        var d = new Date(c.at || 0);
        tx.append(el('div', 't1', c.title || 'Chat'), el('div', 't2', (c.snippet ? '“...' + c.snippet + '...” · ' : '') + (c.words ? c.words.toLocaleString() + ' words · ' : '') + (isNaN(d) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }))));
        var b = el('button', 'sm', 'Open');
        b.addEventListener('click', function (e) { e.stopPropagation(); call('chatOpen', c.id); });
        it.append(dot, tx, b);
        it.addEventListener('click', function () { call('chatOpen', c.id); });
        hold(it, function () {
          menu([['Delete “' + (c.title || 'Chat') + '” from ALTS', 'red', function () { rpc('chatDelete', { id: c.id }).then(function () { search(); }); }]]);
        });
        list.append(it);
      });
    }
    function search() {
      rpc('chatSearch', { q: q.value.trim() }).then(function (r) { if (r && r.list) draw(r.list); });
    }
    q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(search, 250); });
    search();
  }

  // ---------- stickers ----------
  var stickData = null, stickTab = 'all', giphyList = null, giphyBusy = false;
  function openStickers() {
    closeSheets();
    var s = sheet();
    s.style.height = '86vh';
    var hd = el('div', 'hd');
    hd.append(el('b', '', 'Stickers'));
    var row = el('div', 'row');
    var q = el('input', 'in');
    q.placeholder = jcall('info') && jcall('info').giphy ? 'Search yours + GIPHY ("anime cry")' : 'Search your stickers';
    var addB = el('button', 'sm', '+ Your pics');
    row.append(q, addB);
    var chips = el('div', 'chips');
    var body = el('div', 'body'), grid = el('div', 'sgrid'), note = el('div', 'note');
    body.append(note, grid);
    s.append(hd, row, chips, body);
    var TABS = [['all', 'All'], ['fav', '⭐ Favorites'], ['meme', 'Memes'], ['mine', 'Yours'], ['giphy', 'GIPHY']];
    TABS.forEach(function (tb) {
      var c = el('button', 'chip' + (stickTab === tb[0] ? ' on' : ''), tb[1]);
      c.dataset.k = tb[0];
      c.addEventListener('click', function () { stickTab = tb[0]; Array.prototype.forEach.call(chips.children, function (x) { x.className = 'chip' + (x.dataset.k === stickTab ? ' on' : ''); }); draw(); });
      chips.append(c);
    });
    addB.addEventListener('click', function () {
      toast('Pick a picture');
      rpc('addPick', {}).then(function (r) {
        if (r && r.id) { stickData = null; toast('Added to Yours'); draw(); }
        else if (r && r.error && r.error !== 'nothing picked') toast('Couldn’t add it: ' + r.error);
      });
    });
    function sendSticker(id) {
      var d = jcall('stickerGet', id);
      if (!d || !d.b64) { toast('Couldn’t load that sticker.'); return; }
      closeSheets();
      toast('Putting the sticker in the chat...');
      try { window.__alts.stickerFile(d); } catch (e) { toast('The chat box isn’t ready.'); }
    }
    function tile(x, isGiphy) {
      var t = el('div', 'st');
      var img = el('img');
      img.loading = 'lazy';
      img.src = blobUrl(x.thumb, 'image/jpeg');
      img.alt = x.name || '';
      t.append(img);
      if (!isGiphy) {
        var f = el('button', 'fav' + (x.fav ? ' on' : ''), '★');
        f.addEventListener('click', function (e) {
          e.stopPropagation();
          x.fav = !x.fav;
          f.className = 'fav' + (x.fav ? ' on' : '');
          call('stickerFav', x.id, x.fav);
        });
        t.append(f);
        t.addEventListener('click', function () { sendSticker(x.id); });
        hold(t, function () {
          menu([
            [x.fav ? 'Unstar' : '⭐ Favorite', '', function () { x.fav = !x.fav; call('stickerFav', x.id, x.fav); draw(); }],
            x.kind === 'meme' ? null : ['Delete this sticker', 'red', function () { call('stickerDel', x.id); stickData = null; draw(); }]
          ].filter(Boolean));
        });
      } else {
        var k = el('button', 'fav', '⬇');
        k.title = 'Keep it in your stickers';
        k.addEventListener('click', function (e) {
          e.stopPropagation();
          toast('Keeping it...');
          rpc('giphyTake', { id: x.id, name: x.name, url: x.url, keep: true }).then(function (r) {
            if (r && r.b64) { stickData = null; toast('Kept: it’s in Yours now'); } else toast('Couldn’t get it.');
          });
        });
        t.append(k);
        t.addEventListener('click', function () {
          closeSheets();
          toast('Getting the sticker...');
          rpc('giphyTake', { id: x.id, name: x.name, url: x.url, keep: false }).then(function (r) {
            if (r && r.b64) { try { window.__alts.stickerFile(r); } catch (e) { toast('The chat box isn’t ready.'); } }
            else toast('Couldn’t get it: ' + (r && r.error || 'network'));
          });
        });
      }
      return t;
    }
    function draw() {
      if (!stickData) stickData = jcall('stickers') || { list: [] };
      grid.textContent = '';
      note.textContent = '';
      var needle = q.value.trim().toLowerCase();
      var list = (stickData.list || []).slice();
      list.sort(function (a, b) { return (b.fav - a.fav) || ((b.at || 0) - (a.at || 0)); });
      if (stickTab === 'fav') list = list.filter(function (x) { return x.fav; });
      else if (stickTab !== 'all') list = list.filter(function (x) { return x.kind === stickTab; });
      if (needle) list = list.filter(function (x) { return (x.name || '').toLowerCase().indexOf(needle) >= 0; });
      if (stickTab === 'giphy' && !list.length && !needle) note.textContent = 'GIPHY picks you “Keep” land here. Search above to find new ones.';
      if (stickTab === 'fav' && !list.length) note.textContent = 'Star any sticker and it floats to the top, here.';
      list.slice(0, 160).forEach(function (x) { grid.append(tile(x, false)); });
      // GIPHY results under your own, when there's a search
      if (needle && (jcall('info') || {}).giphy && stickTab !== 'mine' && stickTab !== 'meme') {
        var head = el('div', 'note', giphyBusy ? 'Searching GIPHY...' : 'GIPHY');
        head.style.gridColumn = '1/-1';
        grid.append(head);
        (giphyList || []).forEach(function (x) { grid.append(tile(x, true)); });
      } else if (needle && !(jcall('info') || {}).giphy && !list.length) {
        note.textContent = 'Nothing of yours matches. Want way more? Add a free GIPHY key in Settings and this search finds stickers for anything.';
      }
      if (!list.length && !needle && stickTab === 'all') note.textContent = 'The meme pack downloads itself (internet needed once). Pull this open again in a minute.';
    }
    var gT = null;
    q.addEventListener('input', function () {
      draw();
      clearTimeout(gT);
      var needle = q.value.trim();
      giphyList = null;
      if (!needle || !(jcall('info') || {}).giphy) return;
      gT = setTimeout(function () {
        giphyBusy = true;
        draw();
        rpc('giphy', { q: needle }).then(function (r) {
          giphyBusy = false;
          if (q.value.trim() !== needle) return;
          giphyList = (r && r.list) || [];
          if (r && r.error) toast('GIPHY: ' + r.error);
          draw();
        });
      }, 450);
    });
    draw();
  }
  window.__altsPhoneStickers = openStickers; // extras.js's smiley button opens this on the phone

  // ---------- settings ----------
  function openSettings() {
    closeSheets();
    var s = sheet();
    var hd = el('div', 'hd');
    hd.append(el('b', '', 'Settings'), el('small', '', 'ALTS for phone ' + ((jcall('info') || {}).version || '')));
    var body = el('div', 'body');
    s.append(hd, body);
    body.append(el('div', 'note', 'GIPHY key: makes sticker search find anything ("skull", "anime cry"). Free: on your phone go to developers.giphy.com → Create Account → Create an App → pick API → copy the key and paste it here.'));
    var row = el('div', 'row');
    var k = el('input', 'in');
    k.placeholder = (jcall('info') || {}).giphy ? 'A key is set (paste a new one to change it)' : 'Paste your GIPHY key';
    var save = el('button', 'sm', 'Save key');
    save.addEventListener('click', function () {
      if (!k.value.trim()) { toast('Paste the key first'); return; }
      call('setGiphyKey', k.value.trim());
      toast('Key saved. Sticker search now checks GIPHY too.');
      k.value = '';
      k.placeholder = 'A key is set (paste a new one to change it)';
    });
    row.append(k, save);
    body.append(row);
    var r2 = el('div', 'row');
    r2.style.marginTop = '12px';
    var fresh = el('button', 'sm', '↻ Get new memes now');
    fresh.addEventListener('click', function () {
      fresh.textContent = 'Getting them...';
      rpc('memeRefresh', {}).then(function (r) {
        fresh.textContent = '↻ Get new memes now';
        stickData = null;
        toast(r && r.added != null ? (r.added ? r.added + ' new memes' : 'Already fresh, nothing new') : 'Couldn’t reach imgflip: ' + (r && r.error || ''));
      });
    });
    r2.append(fresh);
    body.append(r2);
    body.append(el('div', 'note', 'Memes freshen themselves every 3 days. Stickers paste into the chat as pictures. Saved chats live inside ALTS (searchable) and in Download/ALTS.'));
  }

  // ---------- messages from page.js / extras.js ----------
  function limitedPing() {
    // when the limit is on and messages wait, the app pings at reset time, even if ALTS is closed
    try {
      var later = JSON.parse(localStorage.getItem('alts-later') || '[]') || [];
      var lim = usage && (usage.s >= 100 || usage.w >= 100);
      if (lim && later.length) {
        var iso = usage.w >= 100 ? usage.wr : usage.sr;
        var at = iso ? new Date(iso).getTime() : 0;
        if (at > Date.now()) call('schedulePing', at, 'Your limit is back! ' + later.length + ' saved message' + (later.length === 1 ? '' : 's') + ' ready to send.');
      } else {
        call('cancelPing');
      }
    } catch (e) {}
  }
  function onMsg(m) {
    if (!m || !m.t) return;
    if (m.t === 'usage') {
      usage = m;
      call('usage', JSON.stringify({ s: m.s, w: m.w, sr: m.sr, wr: m.wr }));
      paintPill();
      limitedPing();
    } else if (m.t === 'count') {
      count = m;
    } else if (m.t === 'save') {
      var why = m.why || 'save';
      var target = continueTarget;
      continueTarget = null;
      rpc('chatSave', { title: m.title, url: m.url, html: m.html, md: m.md, words: m.words, pics: m.pics, why: why, skipDownloads: why === 'continue' }).then(function (r) {
        savedChatId = r && r.id || savedChatId;
        try { window.__alts.saved({ ok: !!(r && r.ok), why: why, words: m.words || 0, pics: m.pics || 0, error: r && r.error }); } catch (e) {}
        if (why === 'continue' && target) {
          if (!(r && r.ok)) { toast('Couldn’t save the chat first.'); return; }
          toast('Opening ' + target.name + '...');
          call('continueTo', target.id, JSON.stringify({
            account: target.id,
            text: 'Continuing from a chat on my other account. The whole old chat is attached as a file: read it, then pick up exactly where it left off.',
            md: m.md || '',
            name: (m.title || 'Chat').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60).trim() + '.md',
            saved: 'Saved chats inside ALTS'
          }));
        }
      });
    } else if (m.t === 'save-failed') {
      if (m.why === 'continue') { continueTarget = null; toast('Couldn’t save this chat: ' + (m.error || '')); }
    } else if (m.t === 'open-saved') {
      if (savedChatId) call('chatOpen', savedChatId);
      else call('openDownloads');
    } else if (m.t === 'open-folder') {
      call('openDownloads');
    } else if (m.t === 'hello') {
      paintPill();
      var p = jcall('pendingContinue');
      if (p && p.md != null) {
        var tries = 0;
        (function go() {
          if (window.__alts && window.__alts.continueWith) window.__alts.continueWith(p);
          else if (++tries < 40) setTimeout(go, 300);
        })();
      }
    }
    // 'ping' from extras while the page is open: the chime in extras already happened
  }

  // extras.js's Fresh chat lives in a closure; reach it through the ⟳ side button it draws.
  window.__altsFresh = function () {
    var btns = document.querySelectorAll('[data-alts] button, button[data-alts]');
    for (var i = 0; i < btns.length; i++) {
      if ((btns[i].textContent || '').indexOf('↻') >= 0 && btns[i].title && /fresh chat/i.test(btns[i].title)) { btns[i].click(); return; }
    }
    toast('Fresh chat isn’t ready yet, try again in a second.');
  };

  paintPill();
})();
