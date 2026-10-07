/* Game System 2.0 — trophies, points and your level.
   Playing trophies, collector trophies and secret ones. Each trophy gives points; points give you a
   level (and levels unlock bonus themes and badge frames). Unlocking shows a popup with a sound. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;
  var KEY = 'gs2:trophies';

  /* kind: play | collect | secret. goal + counter: progress bar. */
  var LIST = [
    /* playing */
    { id: 'first-play', kind: 'play', icon: 'play', name: 'Game on', desc: 'Play your first game', pts: 10 },
    { id: 'play-10', kind: 'play', icon: 'gamepad', name: 'Regular', desc: 'Launch games 10 times', pts: 10, goal: 10, counter: 'launches' },
    { id: 'play-100', kind: 'play', icon: 'flame', name: 'Can\'t stop', desc: 'Launch games 100 times', pts: 50, goal: 100, counter: 'launches' },
    { id: 'time-1h', kind: 'play', icon: 'clock', name: 'Warming up', desc: 'Play for 1 hour in total', pts: 10, goal: 60, counter: 'minutes' },
    { id: 'time-10h', kind: 'play', icon: 'clock', name: 'Dedicated', desc: 'Play for 10 hours in total', pts: 25, goal: 600, counter: 'minutes' },
    { id: 'time-50h', kind: 'play', icon: 'clock', name: 'Respect', desc: 'Play for 50 hours in total', pts: 50, goal: 3000, counter: 'minutes' },
    { id: 'time-100h', kind: 'play', icon: 'crown', name: 'Living legend', desc: 'Play for 100 hours in total', pts: 100, goal: 6000, counter: 'minutes' },
    { id: 'session-1h', kind: 'play', icon: 'bolt', name: 'Marathon', desc: 'Play one game for an hour straight', pts: 25 },
    { id: 'streak-3', kind: 'play', icon: 'flame', name: 'On a roll', desc: 'Play 3 days in a row', pts: 10, goal: 3, counter: 'streak' },
    { id: 'streak-7', kind: 'play', icon: 'flame', name: 'Week warrior', desc: 'Play 7 days in a row', pts: 25, goal: 7, counter: 'streak' },
    { id: 'streak-30', kind: 'play', icon: 'flame', name: 'Unstoppable', desc: 'Play 30 days in a row', pts: 100, goal: 30, counter: 'streak' },
    { id: 'variety-5', kind: 'play', icon: 'planet', name: 'Explorer', desc: 'Play 5 different games', pts: 10, goal: 5, counter: 'played' },
    { id: 'variety-20', kind: 'play', icon: 'rocket', name: 'Game hopper', desc: 'Play 20 different games', pts: 25, goal: 20, counter: 'played' },
    { id: 'continue', kind: 'play', icon: 'resume', name: 'Right where I left off', desc: 'Continue a game from where you saved', pts: 10 },
    /* collecting */
    { id: 'add-1', kind: 'collect', icon: 'plus', name: 'Collector', desc: 'Add your first game', pts: 10, goal: 1, counter: 'games' },
    { id: 'add-10', kind: 'collect', icon: 'library', name: 'Shelf filler', desc: 'Have 10 games', pts: 10, goal: 10, counter: 'games' },
    { id: 'add-25', kind: 'collect', icon: 'library', name: 'Library card', desc: 'Have 25 games', pts: 25, goal: 25, counter: 'games' },
    { id: 'add-50', kind: 'collect', icon: 'box', name: 'Hoarder', desc: 'Have 50 games', pts: 50, goal: 50, counter: 'games' },
    { id: 'folder-1', kind: 'collect', icon: 'folder', name: 'Organizer', desc: 'Make a folder', pts: 10 },
    { id: 'folder-5', kind: 'collect', icon: 'folder', name: 'Neat freak', desc: 'Have 5 folders', pts: 25, goal: 5, counter: 'folders' },
    { id: 'moved', kind: 'collect', icon: 'move', name: 'Interior designer', desc: 'Move something to a new spot', pts: 10 },
    { id: 'picture-1', kind: 'collect', icon: 'image', name: 'Artist', desc: 'Give a game a new picture', pts: 10 },
    { id: 'picture-ai', kind: 'collect', icon: 'sparkle', name: 'AI artist', desc: 'Make a picture with the AI', pts: 10 },
    { id: 'picture-draw', kind: 'collect', icon: 'brush', name: 'Picasso', desc: 'Use your own drawing as a picture', pts: 25 },
    { id: 'app-1', kind: 'collect', icon: 'apps', name: 'App time', desc: 'Open an app', pts: 10 },
    { id: 'app-all', kind: 'collect', icon: 'apps', name: 'App explorer', desc: 'Use Music, Notes, Calculator and Drawing', pts: 25, goal: 4, counter: 'builtins' },
    { id: 'multitask', kind: 'collect', icon: 'win', name: 'Multitasker', desc: 'Have 3 apps open at once', pts: 25 },
    { id: 'theme-1', kind: 'collect', icon: 'palette', name: 'Fresh look', desc: 'Change your theme', pts: 10 },
    { id: 'theme-make', kind: 'collect', icon: 'palette', name: 'Designer', desc: 'Make your own theme', pts: 25 },
    { id: 'theme-all', kind: 'collect', icon: 'palette', name: 'Theme hopper', desc: 'Try all 4 main themes', pts: 25, goal: 4, counter: 'themes' },
    { id: 'backup-1', kind: 'collect', icon: 'lifebuoy', name: 'Safe and sound', desc: 'Make a backup', pts: 10 },
    { id: 'upgrade-1', kind: 'collect', icon: 'resume', name: 'Fixer', desc: 'Make a game continue where you left off', pts: 25 },
    { id: 'avatar', kind: 'collect', icon: 'user', name: 'That\'s me', desc: 'Set a profile picture', pts: 10 },
    { id: 'screenshot-1', kind: 'collect', icon: 'camera', name: 'Photographer', desc: 'Take a screenshot in a game', pts: 10 },
    { id: 'record-1', kind: 'collect', icon: 'camera', name: 'Streamer', desc: 'Record a video of a game', pts: 25 },
    { id: 'vex-1', kind: 'collect', icon: 'sparkle', name: 'Hey VEX', desc: 'Talk to VEX', pts: 10 },
    { id: 'trophy-20', kind: 'collect', icon: 'trophy', name: 'Trophy hunter', desc: 'Unlock 20 trophies', pts: 50, goal: 20, counter: 'got' },
    /* secret */
    { id: 'night-owl', kind: 'secret', icon: 'moon', name: 'Night owl', desc: 'Play between 3 and 4 in the morning', pts: 25 },
    { id: 'early-bird', kind: 'secret', icon: 'sparkle', name: 'Early bird', desc: 'Play between 5 and 6 in the morning', pts: 25 },
    { id: 'new-year', kind: 'secret', icon: 'sparkle', name: 'Happy New Year', desc: 'Play on New Year\'s Day', pts: 50 },
    { id: 'konami', kind: 'secret', icon: 'gamepad', name: 'Old school', desc: 'Enter the secret code on the menu (↑ ↑ ↓ ↓ ← → ← → B A)', pts: 50 },
    { id: 'nope', kind: 'secret', icon: 'exit', name: 'Nope', desc: 'Quit a game less than 3 seconds after opening it', pts: 10 },
    { id: 'regret', kind: 'secret', icon: 'undo', name: 'Changed my mind', desc: 'Delete a game and add it back', pts: 25 },
    { id: 'logo-spam', kind: 'secret', icon: 'bolt', name: 'Button masher', desc: 'Click the Game System logo 10 times really fast', pts: 10 },
    { id: 'name-vex', kind: 'secret', icon: 'smile', name: 'Identity crisis', desc: 'Change your name to VEX', pts: 10 },
    { id: 'vex-secret', kind: 'secret', icon: 'key', name: 'Secret keeper', desc: 'Ask VEX to tell you a secret', pts: 25 }
  ];
  var BY_ID = {};
  LIST.forEach(function (t) { BY_ID[t.id] = t; });

  /* points needed for each level */
  var LEVELS = [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650, 770, 900, 1040, 1200];
  var TITLES = [[1, 'Rookie'], [3, 'Gamer'], [5, 'Pro'], [8, 'Elite'], [11, 'Legend'], [14, 'Mythic']];
  /* what levels unlock */
  var REWARDS = [
    { level: 3, icon: 'user', text: 'Bronze badge frame' },
    { level: 5, icon: 'palette', text: 'Gold theme', theme: 'gold' },
    { level: 6, icon: 'user', text: 'Silver badge frame' },
    { level: 7, icon: 'sparkle', text: 'Plasma color for VEX' },
    { level: 8, icon: 'palette', text: 'Galaxy theme', theme: 'galaxy' },
    { level: 10, icon: 'user', text: 'Gold badge frame' },
    { level: 11, icon: 'sparkle', text: 'Gold color for VEX' },
    { level: 12, icon: 'palette', text: 'Prism theme', theme: 'prism' },
    { level: 14, icon: 'user', text: 'Diamond badge frame' }
  ];

  var st = U.lsGet(KEY, null);
  if (!st || typeof st !== 'object') st = {};
  st.got = st.got || {};
  st.n = st.n || {};
  function save() { U.lsSet(KEY, st); }

  /* ---------------- points + level ---------------- */
  function points() { return Object.keys(st.got).reduce(function (s, id) { return s + (BY_ID[id] ? BY_ID[id].pts : 0); }, 0); }
  function levelFor(p) {
    var lv = 1;
    for (var i = 0; i < LEVELS.length; i++) if (p >= LEVELS[i]) lv = i + 1;
    if (p >= LEVELS[LEVELS.length - 1]) lv = LEVELS.length + Math.floor((p - LEVELS[LEVELS.length - 1]) / 200);
    return lv;
  }
  function needFor(lv) { return lv <= LEVELS.length ? LEVELS[lv - 1] : LEVELS[LEVELS.length - 1] + (lv - LEVELS.length) * 200; }
  function info() {
    var p = points();
    var lv = levelFor(p);
    var cur = needFor(lv), next = needFor(lv + 1);
    var title = TITLES[0][1];
    TITLES.forEach(function (t) { if (lv >= t[0]) title = t[1]; });
    return { points: p, level: lv, title: title, cur: cur, next: next, progress: Math.min(1, (p - cur) / Math.max(1, next - cur)), got: Object.keys(st.got).length, total: LIST.length };
  }
  function tier(lv) { lv = lv || info().level; return lv >= 14 ? 'diamond' : lv >= 10 ? 'gold' : lv >= 6 ? 'silver' : lv >= 3 ? 'bronze' : 'none'; }
  function hasLevel(lv) { return info().level >= lv; }

  /* ---------------- counting ---------------- */
  function counter(name) {
    if (name === 'games') return D.list('game').length;
    if (name === 'folders') return D.folders().length;
    if (name === 'played') return D.list('game').filter(function (g) { return g.lastPlayed; }).length;
    if (name === 'launches') return D.list('game').reduce(function (s, g) { return s + (g.launches || 0); }, 0);
    if (name === 'minutes') return Math.floor(D.list().reduce(function (s, g) { return s + (g.playTime || 0) + (D.pendingPlay[g.id] || 0); }, 0) / 60000);
    if (name === 'streak') return streak();
    if (name === 'got') return Object.keys(st.got).length;
    if (name === 'builtins') return Object.keys(st.n.builtins || {}).length;
    if (name === 'themes') return Object.keys(st.n.themes || {}).length;
    return Number(st.n[name]) || 0;
  }
  function streak() {
    var n = 0;
    for (var i = 0; i < 400; i++) {
      var d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      var rec = D.days[U.dayKey(d.getTime())] || {};
      var ms = Object.keys(rec).reduce(function (s, k) { return s + rec[k]; }, 0);
      if (i === 0) Object.keys(D.pendingPlay).forEach(function (k) { ms += D.pendingPlay[k]; });
      if (ms > 60000) n++;
      else if (i > 0) break;
    }
    return n;
  }
  function progress(t) {
    if (!t.goal) return st.got[t.id] ? 1 : 0;
    return Math.min(1, counter(t.counter) / t.goal);
  }

  /* ---------------- unlocking ---------------- */
  var queue = [];
  function unlock(id) {
    var t = BY_ID[id];
    if (!t || st.got[id]) return false;
    var before = info().level;
    st.got[id] = Date.now();
    save();
    queue.push(t);
    var after = info().level;
    if (after > before) queue.push({ levelUp: after });
    pump();
    if (id !== 'trophy-20') checkCounters();
    if (window.D) D.emit('trophies');
    return true;
  }
  /* trophies that unlock by counting (games, play time, streak…) */
  var ready = false;
  function checkCounters() {
    if (!ready) return;
    LIST.forEach(function (t) { if (t.goal && !st.got[t.id] && counter(t.counter) >= t.goal) unlock(t.id); });
  }
  var checkSoon = U.debounce(checkCounters, 800);

  /* something happened in Game System */
  function event(name, data) {
    data = data || {};
    var now = new Date();
    switch (name) {
      case 'launch': {
        unlock('first-play');
        if (data.resumed) unlock('continue');
        var hr = now.getHours();
        if (hr === 3) unlock('night-owl');
        if (hr === 5) unlock('early-bird');
        if (now.getMonth() === 0 && now.getDate() === 1) unlock('new-year');
        break;
      }
      case 'session':
        if (typeof data.ms === 'number' && data.ms >= 0 && data.ms < 3000) unlock('nope');
        if ((data.active || 0) >= 3600000) unlock('session-1h');
        break;
      case 'deleted': {
        var del = st.n.deleted || {};
        del[String(data.name || '').toLowerCase()] = Date.now();
        Object.keys(del).forEach(function (k) { if (Date.now() - del[k] > 7 * 86400000) delete del[k]; });
        st.n.deleted = del;
        save();
        break;
      }
      case 'added': {
        var dl = st.n.deleted || {};
        var key = String(data.name || '').toLowerCase();
        if (dl[key] && Date.now() - dl[key] < 86400000) unlock('regret');
        break;
      }
      case 'folder': unlock('folder-1'); break;
      case 'moved': unlock('moved'); break;
      case 'picture':
        unlock('picture-1');
        if (data.ai) unlock('picture-ai');
        if (data.drawing) unlock('picture-draw');
        break;
      case 'app': {
        unlock('app-1');
        if (/^gs2-(music|notes|calculator|drawing)$/.test(data.id || '')) {
          st.n.builtins = st.n.builtins || {};
          st.n.builtins[data.id] = 1;
          save();
        }
        if ((data.open || 0) >= 3) unlock('multitask');
        break;
      }
      case 'theme':
        if (data.id && data.id !== 'neon') unlock('theme-1');
        if (/^(neon|hacker|lava|ice)$/.test(data.id || '')) { st.n.themes = st.n.themes || {}; st.n.themes[data.id] = 1; save(); }
        break;
      case 'theme-make': unlock('theme-make'); break;
      case 'backup': unlock('backup-1'); break;
      case 'upgrade': unlock('upgrade-1'); break;
      case 'avatar': unlock('avatar'); break;
      case 'screenshot': unlock('screenshot-1'); break;
      case 'record': unlock('record-1'); break;
      case 'vex': unlock('vex-1'); break;
      case 'vex-secret': unlock('vex-secret'); break;
      case 'konami': unlock('konami'); break;
      case 'logo': unlock('logo-spam'); break;
      case 'name': if (String(data.name || '').trim().toLowerCase() === 'vex') unlock('name-vex'); break;
    }
    checkSoon();
  }

  /* ---------------- the popup ---------------- */
  var showing = false, waitApp = false;
  function pump() {
    if (showing || !queue.length) return;
    /* wait until you're past the title screen */
    var app = document.getElementById('app');
    if (app && app.hidden) { if (!waitApp) { waitApp = true; setTimeout(function () { waitApp = false; pump(); }, 1000); } return; }
    var item = queue.shift();
    showing = true;
    var inGame = window.Player && Player.isPlaying();
    var pop;
    if (item.catchUp) {
      var ci = info();
      pop = h('div.trophy-pop.level-pop' + (inGame ? '.mini' : ''), { role: 'status' },
        h('span.tp-ico', I('trophy')),
        h('div.tp-body', h('em', 'TROPHIES'), h('b', 'You already earned ' + item.catchUp + ' ' + (item.catchUp === 1 ? 'trophy' : 'trophies') + '!'),
          h('span', 'Level ' + ci.level + ' · ' + ci.title + '. Tap to see them.')));
      Sound.trophy();
    } else if (item.levelUp) {
      var rw = REWARDS.filter(function (r) { return r.level === item.levelUp; });
      pop = h('div.trophy-pop.level-pop' + (inGame ? '.mini' : ''), { role: 'status' },
        h('span.tp-ico', I('crown')),
        h('div.tp-body', h('em', 'LEVEL UP'), h('b', 'Level ' + item.levelUp + ' · ' + info().title),
          rw.length ? h('span', 'Unlocked: ' + rw.map(function (r) { return r.text; }).join(', ')) : h('span', 'Keep going!')));
      Sound.good();
    } else {
      pop = h('div.trophy-pop' + (inGame ? '.mini' : '') + (item.kind === 'secret' ? '.secret' : ''), { role: 'status' },
        h('span.tp-ico', I(item.icon)),
        h('div.tp-body', h('em', item.kind === 'secret' ? 'SECRET TROPHY' : 'TROPHY UNLOCKED'), h('b', item.name), h('span', item.desc)),
        h('span.tp-pts', '+' + item.pts));
      Sound.trophy();
    }
    pop.addEventListener('click', function () { if (!(window.Player && Player.isPlaying())) open(); });
    UI.overlayRoot().appendChild(pop);
    requestAnimationFrame(function () { pop.classList.add('show'); });
    setTimeout(function () {
      pop.classList.remove('show');
      setTimeout(function () { pop.remove(); showing = false; pump(); }, 400);
    }, queue.length > 1 ? 2200 : inGame ? 3200 : 4200);
  }

  /* ---------------- trophy room (in Stats) ---------------- */
  function open() { App.go('stats'); setTimeout(function () { var el = document.getElementById('trophy-room'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); }

  var roomFilter = 'all';
  function room() {
    var inf = info();
    var grid = h('div.tr-grid');
    function fill() {
      grid.replaceChildren();
      LIST.filter(function (t) {
        if (roomFilter === 'got') return !!st.got[t.id];
        if (roomFilter === 'locked') return !st.got[t.id];
        if (roomFilter === 'secret') return t.kind === 'secret';
        return true;
      }).sort(function (a, b) { return (!!st.got[b.id] - !!st.got[a.id]) || (progress(b) - progress(a)); }).forEach(function (t) {
        var got = st.got[t.id];
        var hidden = t.kind === 'secret' && !got;
        var pr = progress(t);
        grid.appendChild(h('div.tr-card' + (got ? '.got' : '') + (hidden ? '.hidden' : ''),
          h('span.tr-ico', I(hidden ? 'key' : t.icon)),
          h('div.tr-body',
            h('b', hidden ? '???' : t.name),
            h('span', hidden ? 'Secret trophy. Keep exploring…' : t.desc),
            got ? h('em', I('check'), ' ' + new Date(got).toLocaleDateString()) :
              (t.goal && !hidden ? h('span.tr-bar', h('span.tr-track', h('i', { style: { width: Math.round(pr * 100) + '%' } })), h('small', Math.min(t.goal, counter(t.counter)) + ' / ' + t.goal)) : null)),
          h('span.tr-pts', t.pts)));
      });
    }
    var chips = h('div.chips', [['all', 'All'], ['got', 'Unlocked'], ['locked', 'Locked'], ['secret', 'Secret']].map(function (f) {
      return h('button.chip' + (roomFilter === f[0] ? '.on' : ''), { onclick: function () { roomFilter = f[0]; chips.querySelectorAll('.chip').forEach(function (c, i) { c.classList.toggle('on', i === ['all', 'got', 'locked', 'secret'].indexOf(f[0])); }); fill(); } }, f[1]);
    }));
    fill();
    return h('div.panel.trophy-room', { id: 'trophy-room' },
      h('div.tr-top',
        profileBadge(64),
        h('div.tr-level',
          h('b', 'Level ' + inf.level + ' · ' + inf.title),
          h('span.lv-bar', h('i', { style: { width: Math.round(inf.progress * 100) + '%' } })),
          h('span.muted', inf.points + ' points · ' + (inf.next - inf.points) + ' more to level ' + (inf.level + 1) + ' · ' + inf.got + ' of ' + inf.total + ' trophies')),
        h('button.btn.sm', { onclick: rewardsDialog }, I('trophy'), 'Level rewards')),
      chips, grid);
  }
  function rewardsDialog() {
    var lv = info().level;
    UI.modal({
      title: 'Level rewards',
      icon: 'crown',
      body: h('div.rw-list', REWARDS.map(function (r) {
        var got = lv >= r.level;
        return h('div.rw' + (got ? '.got' : ''), h('span.rw-lv', 'Lv ' + r.level), I(got ? r.icon : 'lock'), h('span', r.text));
      })),
      actions: [{ label: 'Nice', kind: 'primary' }]
    });
  }

  /* your picture with a badge frame for your level */
  function profileBadge(size) {
    var inf = info();
    var face = D.avatarUrl ? h('img', { src: D.avatarUrl, alt: '' }) : h('span.pb-letter', ((D.settings.name || 'bro').trim().charAt(0) || 'B').toUpperCase());
    var el = h('span.pbadge.tier-' + tier(inf.level), { title: 'Level ' + inf.level, style: { '--sz': (size || 40) + 'px' } }, face, h('span.pb-lv', String(inf.level)));
    return el;
  }

  /* ---------------- your profile: picture, name, level ---------------- */
  var profileM = null;
  function profileDialog() {
    if (profileM && profileM.isOpen()) return;
    var inf = info();
    var badgeBox = h('div.pf-badge', profileBadge(104));
    function repaint() { badgeBox.replaceChildren(profileBadge(104)); removeBtn.hidden = !D.avatarUrl; }

    var nameIn = h('input.input', { maxlength: 24, 'aria-label': 'Your name', placeholder: 'bro' });
    nameIn.value = D.settings.name || '';
    nameIn.addEventListener('change', function () {
      D.settings.name = nameIn.value.trim() || 'bro';
      D.saveSettings();
      App.applySettings();
      event('name', { name: D.settings.name });
      repaint();
    });

    var fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true });
    fileIn.addEventListener('change', async function () {
      var f = fileIn.files && fileIn.files[0];
      fileIn.value = '';
      if (!f) return;
      try { await D.setAvatar(f); repaint(); Sound.good(); UI.toast('New profile picture!', { type: 'good', icon: 'user', sound: false }); }
      catch (e) { UI.toast(e.message || 'That picture could not be opened.', { type: 'bad' }); }
    });

    /* the AI avatar maker (hidden until you tap "AI avatar") */
    var aiStyle = 'cartoon';
    var aiIn = h('input.input', { maxlength: 120, placeholder: 'Like: a robot with headphones, a cool fox gamer…', 'aria-label': 'Describe your avatar' });
    var aiNote = h('p.muted.pf-note', 'Describe it and the free picture AI draws it. (18+ stuff is blocked.)');
    var aiPrev = h('div.pf-ai-prev');
    var aiResult = null;
    var useAi = h('button.btn.primary.sm', { hidden: true, onclick: async function () {
      if (!aiResult) return;
      try { await D.setAvatar(aiResult); event('picture', { ai: true }); repaint(); Sound.good(); UI.toast('New profile picture!', { type: 'good', icon: 'user', sound: false }); aiBox.hidden = true; }
      catch (e) { UI.toast(e.message || 'Could not use that picture.', { type: 'bad' }); }
    } }, I('check'), 'Use this');
    var makeBtn = h('button.btn.sm', { onclick: makeAi }, I('sparkle'), 'Make it');
    var styleSeg = h('div.seg.pf-styles', [['cartoon', '3D cartoon'], ['pixel', 'Pixel'], ['neon', 'Neon'], ['comic', 'Comic']].map(function (o) {
      return h('button' + (o[0] === aiStyle ? '.on' : ''), { onclick: function () { aiStyle = o[0]; styleSeg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === this); }, this); Sound.select(); } }, o[1]);
    }));
    aiIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); makeAi(); } });
    var aiBox = h('div.pf-ai', { hidden: true }, aiIn, styleSeg, h('div.pf-ai-row', aiPrev, h('div.pf-ai-side', aiNote, h('div.row', makeBtn, useAi))));
    var aiUrl = null;
    async function makeAi() {
      if (makeBtn.disabled) return;
      aiNote.style.color = '';
      makeBtn.disabled = true;
      aiPrev.replaceChildren(h('div.spinner'));
      aiNote.textContent = 'The AI is drawing… this can take up to a minute.';
      try {
        var blob = await Pics.avatarAi(aiIn.value, aiStyle);
        if (!profileM || !profileM.isOpen()) return;
        aiResult = blob;
        if (aiUrl) URL.revokeObjectURL(aiUrl);
        aiUrl = URL.createObjectURL(blob);
        aiPrev.replaceChildren(h('img', { src: aiUrl, alt: 'Your AI avatar' }));
        aiNote.textContent = 'Like it? Hit "Use this". If not, make another one.';
        useAi.hidden = false;
        Sound.good();
      } catch (e) {
        var msg = e && e.message;
        aiPrev.replaceChildren(aiResult && aiUrl ? h('img', { src: aiUrl, alt: '' }) : I('user'));
        aiNote.style.color = 'var(--warn)';
        aiNote.textContent = msg === 'empty' ? 'Type what your avatar should look like first.'
          : msg === 'blocked' ? 'Nope, that one is not allowed. Try something else.'
          : msg === 'wait' ? 'Slow down a bit! Try again in ' + e.wait + ' seconds.'
          : msg === 'busy' ? 'The picture AI is busy right now. Wait a bit and try again.'
          : 'The picture AI didn\'t answer (it might be down or blocked). Try again in a minute.';
      }
      makeBtn.disabled = false;
    }

    var drawOk = !!D.get('gs2-drawing');
    var removeBtn = h('button.btn.sm.ghost', { hidden: !D.avatarUrl, onclick: async function () { await D.setAvatar(null); repaint(); Sound.back(); } }, I('trash'), 'Remove');
    var picRow = h('div.pf-pics',
      h('button.btn.sm', { onclick: function () { fileIn.click(); } }, I('upload'), 'Upload'),
      h('button.btn.sm', { onclick: function () { aiBox.hidden = !aiBox.hidden; if (!aiBox.hidden) aiIn.focus(); } }, I('sparkle'), 'AI avatar'),
      drawOk ? h('button.btn.sm', { onclick: function () {
        profileM.close();
        Win.open('gs2-drawing');
        UI.toast('Draw your picture, then hit "Use as picture" and pick "My profile picture".', { icon: 'brush', timeout: 7000 });
      } }, I('brush'), 'Draw one') : null,
      removeBtn, fileIn);

    var tierName = tier(inf.level);
    var next = REWARDS.find(function (r) { return r.level > inf.level; });
    profileM = UI.modal({
      title: 'Your profile',
      icon: 'user',
      wide: true,
      className: 'profile-modal',
      body: h('div.pf',
        h('div.pf-top', badgeBox,
          h('div.pf-info',
            h('label.pf-label', 'Your name'), nameIn,
            h('b.pf-lv', 'Level ' + inf.level + ' · ' + inf.title + (tierName !== 'none' ? ' · ' + tierName.charAt(0).toUpperCase() + tierName.slice(1) + ' frame' : '')),
            h('span.lv-bar', h('i', { style: { width: Math.round(inf.progress * 100) + '%' } })),
            h('span.muted', inf.points + ' points · ' + (inf.next - inf.points) + ' more to level ' + (inf.level + 1)),
            next ? h('span.pf-next', I('lock'), 'Level ' + next.level + ' unlocks: ' + next.text) : null)),
        h('h4', I('image'), 'Profile picture'), picRow, aiBox,
        h('div.pf-tro',
          h('span', I('trophy'), h('b', inf.got + ' of ' + inf.total), ' trophies'),
          h('div.grow'),
          h('button.btn.sm', { onclick: rewardsDialog }, I('crown'), 'Level rewards'),
          h('button.btn.sm.primary', { onclick: function () { profileM.close(); open(); } }, I('trophy'), 'Trophy room'))),
      actions: [{ label: 'Done', kind: 'ghost' }],
      onClose: function () { if (aiUrl) setTimeout(function () { URL.revokeObjectURL(aiUrl); }, 1000); }
    });
  }

  /* the Home row: your level + the trophies you're closest to */
  function homeCards() {
    var inf = info();
    var cards = [h('button.tr-home-lv', { onclick: profileDialog, 'aria-label': 'Your profile, level ' + inf.level },
      profileBadge(54),
      h('span.trh-body', h('b', 'Level ' + inf.level + ' · ' + inf.title),
        h('span.lv-bar', h('i', { style: { width: Math.round(inf.progress * 100) + '%' } })),
        h('small', inf.points + ' / ' + inf.next + ' points')))];
    LIST.filter(function (t) { return !st.got[t.id] && t.kind !== 'secret'; })
      .sort(function (a, b) { return progress(b) - progress(a) || a.pts - b.pts; })
      .slice(0, 6).forEach(function (t) {
        var pr = progress(t);
        cards.push(h('button.tr-mini', { onclick: open, title: t.desc },
          h('span.tr-ico', I(t.icon)),
          h('span.trm-body', h('b', t.name), h('small', t.desc),
            t.goal ? h('span.tr-bar', h('span.tr-track', h('i', { style: { width: Math.round(pr * 100) + '%' } })), h('small', Math.min(t.goal, counter(t.counter)) + '/' + t.goal)) : null),
          h('span.tr-pts', '+' + t.pts)));
      });
    return cards;
  }

  function init() {
    /* first time: trophies you already earned (games you have, time you played) unlock quietly,
       with one popup that says how many — not 15 popups in a row */
    ready = true;
    if (!st.started) {
      var before = Object.keys(st.got).length;
      LIST.forEach(function (t) { if (t.goal && !st.got[t.id] && counter(t.counter) >= t.goal) st.got[t.id] = Date.now(); });
      if (Object.keys(st.got).length >= 20 && !st.got['trophy-20']) st.got['trophy-20'] = Date.now();
      st.started = Date.now();
      save();
      var n = Object.keys(st.got).length - before;
      if (n > 0) setTimeout(function () { queue.push({ catchUp: n }); pump(); }, 2500);
    }
    checkCounters();
    D.on(function (type) { if (type === 'games' || type === 'stats') checkSoon(); });
  }

  window.Trophies = {
    LIST: LIST,
    REWARDS: REWARDS,
    init: init,
    event: event,
    unlock: unlock,
    info: info,
    tier: tier,
    hasLevel: hasLevel,
    has: function (id) { return !!st.got[id]; },
    progress: progress,
    room: room,
    open: open,
    profileBadge: profileBadge,
    profile: profileDialog,
    homeCards: homeCards,
    exportData: function () { return st; },
    importData: function (data) {
      if (!data || typeof data !== 'object') return;
      var got = Object.assign({}, data.got || {}, st.got);
      st = { got: got, n: Object.assign({}, data.n || {}, st.n), started: st.started || data.started || Date.now() };
      save();
      checkSoon();
      if (window.D) D.emit('trophies');
    }
  };
})();
