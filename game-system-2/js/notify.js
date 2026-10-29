/* Game System 2.0 — the notification bell (backup reminders, new website games, updates…). */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;
  var KEY = 'gs2:notices';
  var list = U.lsGet(KEY, []);
  if (!Array.isArray(list)) list = [];
  var panel = null;

  function save() { U.lsSet(KEY, list.slice(0, 60)); paintBell(); }

  /* n: { key, icon, title, text, action: { label, run: 'backup' | 'go:<view>' | 'reload' | 'url:<…>' } } — same key replaces the old one */
  function add(n) {
    if (!n || !n.title) return;
    list = list.filter(function (x) { return !n.key || x.key !== n.key; });
    list.unshift({ key: n.key || ('n' + Date.now()), icon: n.icon || 'bell', title: String(n.title), text: String(n.text || ''), action: n.action || null, t: Date.now(), read: false });
    save();
    if (panel) renderPanel();
  }
  function remove(key) { list = list.filter(function (x) { return x.key !== key; }); save(); if (panel) renderPanel(); }
  function has(key) { return list.some(function (x) { return x.key === key; }); }
  function unread() { return list.filter(function (x) { return !x.read; }).length; }

  function paintBell() {
    var b = document.getElementById('btn-bell');
    if (!b) return;
    var n = unread();
    var dot = b.querySelector('.bell-dot');
    dot.hidden = !n;
    dot.textContent = n > 9 ? '9+' : String(n);
    b.setAttribute('aria-label', n ? 'Notifications (' + n + ' new)' : 'Notifications');
  }

  function run(action) {
    if (!action) return;
    var r = action.run || '';
    if (r === 'backup') Backup.exportAll();
    else if (r === 'reload') location.reload();
    else if (r.indexOf('go:') === 0) App.go(r.slice(3));
    else if (r.indexOf('trophies') === 0 && window.Trophies) window.Trophies.open();
  }

  function renderPanel() {
    if (!panel) return;
    var items = list.slice(0, 30);
    panel.replaceChildren(
      h('div.np-head', h('b', 'Notifications'), h('div.grow'),
        items.length ? h('button.btn.sm.ghost', { onclick: function () { list = []; save(); renderPanel(); } }, 'Clear all') : null),
      items.length ? h('div.np-list', items.map(function (n) {
        return h('div.np-item' + (n.read ? '' : '.new'),
          h('span.np-ico', I(UI.hasIcon(n.icon) ? n.icon : 'bell')),
          h('div.np-body', h('b', n.title), n.text ? h('span', n.text) : null, h('em', U.timeAgo(n.t)),
            n.action ? h('button.btn.sm', { onclick: function () { close(); run(n.action); } }, n.action.label || 'Open') : null),
          h('button.icon-btn.sm.np-x', { 'aria-label': 'Remove', title: 'Remove', onclick: function () { remove(n.key); } }, I('x')));
      })) : h('div.np-empty', I('bell'), h('span', 'Nothing new. You\'re all caught up!')));
  }
  function open() {
    if (panel) { close(); return; }
    var b = document.getElementById('btn-bell');
    panel = h('div.notice-panel', { role: 'dialog', 'aria-label': 'Notifications' });
    document.body.appendChild(panel);
    var r = b.getBoundingClientRect();
    panel.style.top = Math.round(r.bottom + 8) + 'px';
    panel.style.right = Math.max(8, Math.round(window.innerWidth - r.right - 8)) + 'px';
    renderPanel();
    Sound.open();
    /* opening the bell marks everything as seen */
    setTimeout(function () { list.forEach(function (x) { x.read = true; }); save(); }, 600);
    setTimeout(function () {
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', esc, true);
    }, 0);
  }
  function outside(e) { if (panel && !panel.contains(e.target) && !e.target.closest('#btn-bell')) close(); }
  function esc(e) { if (e.key === 'Escape' && panel) { e.preventDefault(); e.stopPropagation(); close(); } }
  function close() {
    if (!panel) return;
    panel.remove();
    panel = null;
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', esc, true);
    renderPanel();
  }

  /* things that make a notice by themselves */
  function checks() {
    var st = D.settings;
    var games = D.list();
    if (st.backupNag && games.length) {
      var age = st.lastBackup ? Date.now() - st.lastBackup : Infinity;
      var week = Math.floor(Date.now() / (7 * 86400000));
      if (age > 7 * 86400000 && !has('backup-' + week)) {
        list = list.filter(function (x) { return x.key.indexOf('backup-') !== 0; });
        add({ key: 'backup-' + week, icon: 'lifebuoy', title: st.lastBackup ? 'Time for a backup' : 'Make your first backup',
          text: st.lastBackup ? 'Your last backup was ' + U.timeAgo(st.lastBackup) + '.' : 'So you never lose your games and saves.',
          action: { label: 'Back up now', run: 'backup' } });
      }
    }
    if (st.lastBackup && Date.now() - st.lastBackup < 7 * 86400000) {
      list = list.filter(function (x) { return x.key.indexOf('backup-') !== 0; });
      save();
    }
  }

  function init() {
    var b = document.getElementById('btn-bell');
    if (b) b.addEventListener('click', open);
    paintBell();
    setTimeout(checks, 3000);
    D.on(function (type) { if (type === 'settings') paintBell(); });
  }

  window.Notify = { init: init, add: add, remove: remove, has: has, unread: unread, open: open, close: close, checks: checks };
})();
