/* Game System 2.0 — timers and alarms.
   They live here (not inside the Timer app), so they keep counting when the app is closed, and when one
   goes off it pops up over everything, games too, with a sound. The game keeps going until you hit OK. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;
  var KEY = 'gs2:timers';

  /* timers: { id, label, dur (ms), end (timestamp while running), left (ms while paused), state: run | pause | done }
     alarms: { id, label, time 'HH:MM', days [0-6] (empty = once), on, last 'YYYY-MM-DD HH:MM' } */
  var S = U.lsGet(KEY, null);
  if (!S || typeof S !== 'object') S = {};
  S.timers = Array.isArray(S.timers) ? S.timers.filter(okTimer) : [];
  S.alarms = Array.isArray(S.alarms) ? S.alarms.filter(okAlarm) : [];
  function okTimer(t) { return t && typeof t.id === 'string' && t.dur > 0; }
  function okAlarm(a) { return a && typeof a.id === 'string' && /^\d{2}:\d{2}$/.test(a.time || ''); }
  function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var saveSoon = U.debounce(save, 200);
  function save() { U.lsSet(KEY, { timers: S.timers, alarms: S.alarms }); }
  function changed() {
    saveSoon();
    if (window.Win && Win.broadcast) Win.broadcast('gs2timers');
    if (window.D) D.emit('timers');
  }

  function left(t) {
    if (t.state === 'run') return Math.max(0, t.end - Date.now());
    if (t.state === 'pause') return Math.max(0, t.left);
    return 0;
  }
  function pub(t) { return { id: t.id, label: t.label, dur: t.dur, state: t.state, left: left(t), end: t.state === 'run' ? t.end : null }; }

  /* ---------------- timers ---------------- */
  function add(o) {
    o = o || {};
    var ms = Math.round(Number(o.ms) || 0);
    if (!(ms >= 1000) || ms > 100 * 3600000) throw new Error('Pick a time between 1 second and 100 hours.');
    var t = { id: uid(), label: String(o.label || '').trim().slice(0, 40), dur: ms, end: Date.now() + ms, left: ms, state: 'run' };
    S.timers.unshift(t);
    if (S.timers.length > 30) S.timers.length = 30;
    changed();
    return pub(t);
  }
  function find(id) { return S.timers.find(function (t) { return t.id === id; }) || null; }
  function pause(id) { var t = find(id); if (t && t.state === 'run') { t.left = left(t); t.state = 'pause'; changed(); } return t ? pub(t) : null; }
  function resume(id) { var t = find(id); if (t && t.state === 'pause') { t.end = Date.now() + t.left; t.state = 'run'; changed(); } return t ? pub(t) : null; }
  function restart(id) { var t = find(id); if (t) { t.end = Date.now() + t.dur; t.left = t.dur; t.state = 'run'; changed(); } return t ? pub(t) : null; }
  function addTime(id, ms) {
    var t = find(id);
    if (!t) return null;
    if (t.state === 'run') t.end += ms;
    else if (t.state === 'pause') t.left += ms;
    else { t.end = Date.now() + ms; t.left = ms; t.state = 'run'; }
    t.dur = Math.max(t.dur, left(t));
    changed();
    return pub(t);
  }
  function remove(id) { S.timers = S.timers.filter(function (t) { return t.id !== id; }); stopRing('timer:' + id); changed(); return true; }

  /* ---------------- alarms ---------------- */
  function addAlarm(o) {
    o = o || {};
    if (!/^\d{2}:\d{2}$/.test(o.time || '')) throw new Error('Pick a time.');
    var a = { id: uid(), label: String(o.label || '').trim().slice(0, 40), time: o.time, days: cleanDays(o.days), on: true, last: '' };
    S.alarms.push(a);
    sortAlarms();
    changed();
    return Object.assign({}, a);
  }
  function cleanDays(d) { return Array.isArray(d) ? d.map(Number).filter(function (n, i, arr) { return n >= 0 && n <= 6 && arr.indexOf(n) === i; }).sort() : []; }
  function sortAlarms() { S.alarms.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; }); }
  function editAlarm(id, patch) {
    var a = S.alarms.find(function (x) { return x.id === id; });
    if (!a) return null;
    patch = patch || {};
    if (patch.time != null) { if (!/^\d{2}:\d{2}$/.test(patch.time)) throw new Error('Pick a time.'); a.time = patch.time; a.last = ''; }
    if (patch.label != null) a.label = String(patch.label).trim().slice(0, 40);
    if (patch.days != null) a.days = cleanDays(patch.days);
    if (patch.on != null) { a.on = !!patch.on; if (a.on) a.last = stamp(new Date()); }
    sortAlarms();
    changed();
    return Object.assign({}, a);
  }
  function removeAlarm(id) { S.alarms = S.alarms.filter(function (a) { return a.id !== id; }); stopRing('alarm:' + id); changed(); return true; }
  function stamp(d) { return U.dayKey(d.getTime()) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  /* when an alarm rings next (for "in 7 h 12 min") */
  function nextRing(a) {
    var now = new Date();
    for (var i = 0; i < 8; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Number(a.time.slice(0, 2)), Number(a.time.slice(3, 5)), 0, 0);
      if (d <= now) continue;
      if (!a.days.length || a.days.indexOf(d.getDay()) >= 0) return d.getTime();
    }
    return null;
  }

  /* ---------------- going off ---------------- */
  var rings = [];   /* { key, title, sub, kind, id, el } */
  var beepT = 0;
  function tick() {
    var now = Date.now();
    S.timers.forEach(function (t) {
      if (t.state === 'run' && t.end <= now) {
        t.state = 'done';
        t.left = 0;
        changed();
        /* ended a while ago (Game System was closed)? just show it, no beeping */
        var late = now - t.end > 60000;
        ring({ key: 'timer:' + t.id, kind: 'timer', id: t.id, title: t.label || 'Time\'s up!', quiet: late, sub: late ? 'Timer ended ' + U.timeAgo(t.end) : 'Timer · ' + fmtDur(t.dur) });
      }
    });
    var d = new Date();
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var st = stamp(d);
    S.alarms.forEach(function (a) {
      if (!a.on || a.time !== hm || a.last === st) return;
      if (a.days.length && a.days.indexOf(d.getDay()) < 0) return;
      a.last = st;
      if (!a.days.length) a.on = false;   /* "once" alarms switch off after ringing */
      changed();
      ring({ key: 'alarm:' + a.id, kind: 'alarm', id: a.id, title: a.label || 'Alarm', sub: 'Alarm · ' + nice(a.time) });
    });
  }

  function ring(r) {
    if (rings.some(function (x) { return x.key === r.key; })) return;
    rings.push(r);
    paintRings();
    if (!r.quiet) startBeeps();
    /* Game System is in the background? a system notification (if you allowed them) */
    if (document.visibilityState === 'hidden' && window.Notification && Notification.permission === 'granted') {
      try { new Notification(r.title, { body: r.sub, tag: r.key, icon: 'icons/icon-192.png', requireInteraction: true }); } catch (e) { /* ignore */ }
    }
  }
  function stopRing(key) {
    var before = rings.length;
    rings = rings.filter(function (r) { if (r.key === key) { if (r.el) r.el.remove(); return false; } return true; });
    if (rings.length !== before) { paintRings(); if (!rings.length) stopBeeps(); }
  }
  function paintRings() {
    var root = UI.overlayRoot();
    rings.forEach(function (r, i) {
      if (!r.el) {
        r.el = h('div.ring-pop', { role: 'alertdialog', 'aria-label': r.title },
          h('span.rg-ico', I(r.kind === 'alarm' ? 'bell' : 'clock')),
          h('div.rg-body', h('b', r.title), h('span', r.sub)),
          h('div.rg-acts',
            h('button.btn.sm', { onclick: function () { snooze(r); } }, r.kind === 'alarm' ? 'Snooze 5 min' : '+1 min'),
            h('button.btn.sm.primary', { onclick: function () { stopRing(r.key); Sound.select(); } }, 'OK')));
      }
      if (r.el.parentNode !== root) root.appendChild(r.el);
      r.el.style.setProperty('--i', i);
    });
    var first = rings[rings.length - 1];
    if (first && first.el && !(window.Player && Player.isPlaying())) setTimeout(function () { var b = first.el.querySelector('.btn.primary'); if (b) b.focus(); }, 30);
  }
  function snooze(r) {
    stopRing(r.key);
    if (r.kind === 'timer') { addTime(r.id, 60000); return; }
    /* snooze an alarm: a quiet 5-minute timer with the alarm's name */
    add({ ms: 5 * 60000, label: (r.title || 'Alarm') + ' (snoozed)' });
  }
  function startBeeps() {
    if (beepT) return;
    var n = 0;
    function beep() {
      Sound.alarm(n++);
      /* stop by itself after 2 minutes so it doesn't beep all night */
      if (n > 120) stopBeeps();
    }
    beep();
    beepT = setInterval(beep, 1000);
  }
  function stopBeeps() { clearInterval(beepT); beepT = 0; }
  /* the Esc key or controller B on the menu = OK on the newest one */
  function dismissTop() { var r = rings[rings.length - 1]; if (!r) return false; stopRing(r.key); return true; }

  function fmtDur(ms) {
    var s = Math.round(ms / 1000), hh = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    var parts = [];
    if (hh) parts.push(hh + ' h');
    if (m) parts.push(m + ' min');
    if (ss && !hh) parts.push(ss + ' s');
    return parts.join(' ') || '0 s';
  }
  function nice(hm) {
    var d = new Date(2000, 0, 1, Number(hm.slice(0, 2)), Number(hm.slice(3, 5)));
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  /* ---------------- for the Timer app (and VEX later) ---------------- */
  function forApp(appId, op, arg) {
    var app = D.get(appId);
    if (!app || !app.builtin) return Promise.reject(new Error('Only Game System apps can use timers.'));
    arg = arg || {};
    try {
      switch (op) {
        case 'list': return Promise.resolve({ timers: S.timers.map(pub), alarms: S.alarms.map(function (a) { return Object.assign({ next: a.on ? nextRing(a) : null }, a); }), ringing: rings.map(function (r) { return r.key; }), now: Date.now() });
        case 'add': return Promise.resolve(add(arg));
        case 'pause': return Promise.resolve(pause(String(arg.id)));
        case 'resume': return Promise.resolve(resume(String(arg.id)));
        case 'restart': return Promise.resolve(restart(String(arg.id)));
        case 'addTime': return Promise.resolve(addTime(String(arg.id), Math.max(-3600000, Math.min(3600000, Number(arg.ms) || 0))));
        case 'remove': return Promise.resolve(remove(String(arg.id)));
        case 'addAlarm': return Promise.resolve(addAlarm(arg));
        case 'editAlarm': return Promise.resolve(editAlarm(String(arg.id), arg.patch));
        case 'removeAlarm': return Promise.resolve(removeAlarm(String(arg.id)));
        case 'stopRing': stopRing(String(arg.key)); return Promise.resolve(true);
        case 'notify':
          if (!window.Notification) return Promise.resolve('unsupported');
          if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
          return Notification.requestPermission();
        case 'notifyState': return Promise.resolve(window.Notification ? Notification.permission : 'unsupported');
        default: return Promise.reject(new Error('Unknown request: ' + op));
      }
    } catch (e) { return Promise.reject(e); }
  }

  var tickT = 0;
  function init() {
    if (tickT) return;
    tick();
    tickT = setInterval(tick, 500);
    /* catch up right away when you come back to the tab */
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') tick(); });
    document.addEventListener('fullscreenchange', paintRings);
  }

  window.Timers = {
    init: init,
    add: add, pause: pause, resume: resume, restart: restart, addTime: addTime, remove: remove,
    addAlarm: addAlarm, editAlarm: editAlarm, removeAlarm: removeAlarm,
    list: function () { return S.timers.map(pub); },
    alarms: function () { return S.alarms.map(function (a) { return Object.assign({}, a); }); },
    ringing: function () { return rings.length; },
    dismissTop: dismissTop,
    forApp: forApp,
    fmtDur: fmtDur
  };
})();
