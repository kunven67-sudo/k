/* Settings: a clean list of categories on the left + a search box that finds any setting. */
import { h, fmtDate } from './dom.js';
import { icon, iconUrl, iconSolid } from './icons.js';
import { St, setSetting, onState, PHONE } from './state.js';
import { Sound } from './sound.js';
import { moveFocus, setFocus } from './input.js';
import { confirm } from './modal.js';
import { pickStyle, pickButtons, pickStartup, pickGameStart, pickMusic, pickHolidays, pickBackground, currentNames } from './pickers.js';

const CATS = [
  { k: 'look', label: 'Look and sound', icon: 'image' },
  { k: 'system', label: 'System', icon: 'power' },
  { k: 'games', label: 'Games', icon: 'pad' },
  { k: 'booster', label: 'Game Booster', icon: 'zap' },
  { k: 'sound', label: 'Sound and music', icon: 'volume' },
  { k: 'access', label: 'Accessibility', icon: 'text' },
  { k: 'saved', label: 'Saved data and backups', icon: 'save' },
  { k: 'gs2', label: 'Game System 2', icon: 'download' },
  { k: 'crashes', label: 'Crashes', icon: 'warn' },
  { k: 'about', label: 'About', icon: 'info' }
];

export function makeSettings(root, ctx) {
  let cat = 'look';
  let q = '';
  let cur = null;
  let visible = false;

  const ITEMS = [
    { cat: 'look', type: 'pick', t: 'Home style', v: 'style', d: 'Game System 3, PS5, PS4, PS3, PSP, PS2, Xbox Series, Xbox One, Xbox 360, Switch, Wii, 3DS, Steam, Dreamcast.', label: 'Change', icon: 'image', kw: 'theme console playstation xbox nintendo look skin ps5 ps4 ps3 wii switch', run: pickStyle },
    { cat: 'look', type: 'pick', t: 'Background', v: 'background', label: 'Change', icon: 'image', kw: 'background wallpaper theme console game art', run: pickBackground },
    { cat: 'look', type: 'pick', t: 'Button sounds', v: 'buttons', label: 'Change', icon: 'volume', kw: 'click sound move select gamecube ps5 ps4 xbox switch', run: pickButtons },
    { cat: 'look', type: 'pick', t: 'When Game System 3 opens', v: 'startup', label: 'Change', icon: 'volume', kw: 'startup boot sound intro', run: pickStartup },
    { cat: 'look', type: 'pick', t: 'When a game starts', v: 'gameStart', label: 'Change', icon: 'play', kw: 'launch start sound', run: pickGameStart },
    { cat: 'look', type: 'pick', t: 'Menu music', v: 'music', label: 'Change', icon: 'music', d: 'Console music, or your own songs.', kw: 'music console background song wii shop ps5 ps4 gamecube own my songs mp3 upload', run: pickMusic },
    { cat: 'look', type: 'pick', t: 'Holidays', v: 'holidays', d: 'Free themes + music by themselves: Halloween all October, Christmas all December, birthdays.', label: 'Change', icon: 'sparkle', kw: 'holiday halloween christmas birthday theme new year', run: pickHolidays },
    { cat: 'look', key: 'homeMusic', type: 'switch', t: 'Game\'s own song on the home screen', d: 'Landing on a game fades in its own song (if it has one) over the menu music.', kw: 'music song game' },
    { cat: 'system', type: 'button', t: 'Updates', d: 'Download a new Game System 3 installer from our chat (to Downloads or the Desktop) and I offer to install it. Your games and saves are never touched.', label: 'Check now', icon: 'download', kw: 'update version new install', run: async function () {
      const u = await window.gs.invoke('app:update-ready');
      if (u && u.version) { St.update = u; ctx.installUpdate(); return; }
      /* not in Downloads: let them pick the installer from wherever they saved it */
      ctx.toast({ title: 'You have ' + ((St.info && St.info.version) || '') + '. No newer one on this PC.', text: 'New versions come in our chat: download it and it shows up here by itself (Downloads or Desktop). Saved it somewhere else?', timeout: 12000,
        button: { label: 'Pick it', onClick: async function () {
          const r = await window.gs.invoke('app:update-pick');
          if (!r) return;
          if (r.error === 'notNewer') ctx.toast({ kind: 'warn', text: 'That one is ' + r.version + '. You already have ' + r.now + '.' });
          else if (r.error) ctx.toast({ kind: 'warn', text: 'That isn\'t a Game System 3 installer.' });
          else { St.update = r; ctx.installUpdate(); }
        } } });
    } },
    { cat: 'system', key: 'startWithWindows', type: 'switch', t: 'Start with Windows', d: 'Game System 3 opens by itself when your PC starts.', kw: 'boot startup login auto open' },
    { cat: 'system', type: 'button', t: 'BACKPACK: free up space', d: 'Clean up junk, find what\'s big (search + filters), pack folders smaller, move Game System 3 out of OneDrive. Never deletes your videos.', label: 'Open', icon: 'box', kw: 'storage space disk full clean delete onedrive backpack junk cache', run: function () { ctx.backpack(); } },
    { cat: 'system', type: 'button', t: 'Copy to my phone', d: 'Scan a code with your phone\'s camera: your games, their saves, covers and console sounds go to Game System 3 on the phone (same Wi-Fi).', label: 'Open', icon: 'phone', kw: 'phone android mobile qr scan copy transfer move games saves', run: function () { ctx.phone(); } },
    { cat: 'system', type: 'button', t: 'Task manager', d: 'See what\'s running on your PC (CPU, memory) and end anything, even apps that hide in the taskbar corner like Discord.', label: 'Open', icon: 'monitor', kw: 'task manager close app end process discord cpu memory lag', run: function () { ctx.tasks(); } },
    { cat: 'system', type: 'button', t: 'Quit Game System 3', d: 'Closes it all the way (also the power button at the top right).', label: 'Quit', icon: 'power', kw: 'close exit quit power shut down', run: function () { window.gs.invoke('power:quit'); } },
    { cat: 'system', type: 'button', t: 'Full screen', d: 'Or press F11 anytime.', label: 'Switch', icon: 'expand', kw: 'fullscreen window f11', run: function () { window.gs.invoke('win:fullscreen'); } },
    { cat: 'system', type: 'button', t: 'Restart Game System 3', d: 'Saves everything first.', label: 'Restart', icon: 'restart', kw: 'reboot reload', run: function () { window.gs.invoke('power:restart'); } },
    { cat: 'games', key: 'quickResume', type: 'switch', t: 'Quick Resume', d: 'Up to 3 games you leave stay frozen in the background (no CPU, no sound) and come back at the exact moment you left. Off = leaving a game closes it.', kw: 'suspend freeze background resume' },
    { cat: 'games', key: 'autoAddFolder', type: 'switch', t: 'Add games from the Games folder by themselves', d: 'Anything you put in Documents\\Game System 3\\Games shows up in your library.', kw: 'folder watch auto add import' },
    { cat: 'games', type: 'button', t: 'Games folder', d: 'Where your games live.', label: 'Open', icon: 'folder', kw: 'location path files', run: function () { window.gs.invoke('shell:open', 'games'); } },
    { cat: 'games', type: 'button', t: 'Screenshots folder', d: 'Press F12 in any game to take one.', label: 'Open', icon: 'camera', kw: 'captures pictures screenshot', run: function () { window.gs.invoke('shell:open', 'captures'); } },
    { cat: 'games', key: 'uncappedFps', type: 'switch', t: 'No FPS cap', d: 'Games can run faster than your screen\'s refresh rate. Some simple games move too fast with this on. Takes effect after a restart.', kw: 'fps frame rate vsync performance lag', restart: true },
    { cat: 'booster', key: 'boosterOn', type: 'switch', t: 'Game Booster', d: 'When a game lags (under ~40 FPS for 5 seconds), or a heavy game is about to open on a busy PC, I ask if I should close the apps slowing it down. Never touches Windows itself.', kw: 'boost lag fps fast performance' },
    { cat: 'booster', key: 'lagCheck', type: 'switch', t: 'Lag check while playing', d: 'Watches the FPS of the game you\'re playing. Off = the Booster only asks before heavy games open.', kw: 'fps lag check' },
    { cat: 'sound', key: 'menuSounds', type: 'slider', t: 'Menu sounds', d: 'The soft tik when you move and the press sound.', min: 0, max: 100, step: 5, pct: true, kw: 'volume click ui' },
    { cat: 'sound', key: 'homeMusic', type: 'switch', t: 'Game music on the home screen', d: 'The picked game\'s own song fades in quietly after a second.', kw: 'music background song' },
    { cat: 'sound', key: 'homeMusicVolume', type: 'slider', t: 'Home music volume', min: 0, max: 100, step: 5, pct: true, kw: 'music volume' },
    { cat: 'sound', key: 'bootSound', type: 'switch', t: 'Startup sound', d: 'Plays with the Game System 3 logo.', kw: 'boot logo intro' },
    { cat: 'access', key: 'textSize', type: 'slider', t: 'Text size', min: 80, max: 150, step: 5, unit: '%', kw: 'font bigger smaller read' },
    { cat: 'access', key: 'boldText', type: 'switch', t: 'Bold text', kw: 'font weight thick' },
    { cat: 'access', key: 'reduceMotion', type: 'switch', t: 'Reduce motion', d: 'Turns off the zooms, slides and drifting background in the menus (games are not changed).', kw: 'animation flashing calm' },
    { cat: 'saved', key: 'autoBackup', type: 'switch', t: 'Automatic backups', d: 'Once a day, every game whose saves changed gets backed up to Documents\\Game System 3\\Backups\\Auto (last 5 kept).', kw: 'backup auto daily' },
    { cat: 'saved', type: 'button', t: 'Saved Data', d: 'See, back up, restore or delete each game\'s saves.', label: 'Open', icon: 'save', kw: 'saves progress', run: function () { ctx.openSaved(); } },
    { cat: 'saved', type: 'button', t: 'Backups folder', label: 'Open', icon: 'folder', kw: 'backup files', run: function () { window.gs.invoke('shell:open', 'backups'); } },
    { cat: 'gs2', type: 'button', t: 'Bring over Game System 2', d: 'Copies your games, covers, play time, folders and saves from a Game System 2 backup.', label: 'Start', icon: 'download', kw: 'import old move transfer gs2', run: function () { ctx.openGs2(); } }
  ];

  /* on the phone: only what works there, plus how to get games from the PC */
  if (PHONE) {
    const PC_ONLY = /^(Updates|Start with Windows|BACKPACK|Copy to my phone|Task manager|Quit Game System 3|Restart Game System 3|Quick Resume|Add games from the Games folder|Games folder|Screenshots folder|No FPS cap|Automatic backups|Backups folder)/;
    for (let i = ITEMS.length - 1; i >= 0; i--) if (PC_ONLY.test(ITEMS[i].t) || /^(booster|gs2|crashes)$/.test(ITEMS[i].cat)) ITEMS.splice(i, 1);
    ITEMS.unshift({ cat: 'system', type: 'button', t: 'Copy from my PC', d: 'Get your games, saves and console sounds from Game System 3 on your PC (same Wi-Fi).', label: 'How', icon: 'phone', kw: 'pc copy games transfer qr scan', run: function () { ctx.phoneHelp(); } });
  }
  const search = h('input.search-box', { type: 'text', placeholder: 'Search settings', 'data-f': '', spellcheck: 'false', style: { backgroundImage: iconUrl('search') } });
  const catBox = h('div');
  const side = h('div.side', h('h2', 'Settings'), search, catBox);
  const main = h('div.main-panel');
  root.appendChild(h('div.split', side, main));
  search.addEventListener('input', function () { q = search.value.trim().toLowerCase(); renderMain(); });

  function renderCats() {
    catBox.textContent = '';
    CATS.filter(function (c) { return !PHONE || !/^(booster|gs2|crashes)$/.test(c.k); }).forEach(function (c) {
      const b = h('button.side-item' + (c.k === cat && !q ? '.on' : ''), { 'data-f': '', dataset: { cat: c.k }, onclick: function () { setCat(c.k, b); } },
        h('span', { html: icon(c.icon) + iconSolid(c.icon) }), h('div.meta', h('div.t', c.label)));
      catBox.appendChild(b);
    });
  }
  function setCat(k, el) {
    if (q) { q = ''; search.value = ''; }
    if (cat !== k) Sound.move();
    cat = k;
    renderCats();
    renderMain();
    if (el) cur = setFocus(root, catBox.querySelector('[data-cat="' + k + '"]'));
  }

  function itemEl(it, showWhere) {
    const txt = h('div.txt', showWhere ? h('div.where', CATS.find(function (c) { return c.k === it.cat; }).label) : null, h('div.t', it.t), it.d ? h('div.d', it.d) : null);
    const row = h('div.set', { 'data-f': '' }, txt);
    const s = St.settings;
    if (it.type === 'switch') {
      const sw = h('div.switch' + (s[it.key] ? '.on' : ''));
      row.appendChild(sw);
      row.addEventListener('click', async function () {
        Sound.press();
        const v = !St.settings[it.key];
        sw.classList.toggle('on', v);
        await setSetting({ [it.key]: v });
        if (it.restart) ctx.toast({ text: 'Restart Game System 3 to use this.', button: { label: 'Restart', onClick: function () { window.gs.invoke('power:restart'); } }, timeout: 6000 });
      });
    } else if (it.type === 'slider') {
      const scale = it.pct ? 100 : 1;
      const input = h('input.slider', { type: 'range', min: it.min, max: it.max, step: it.step, value: Math.round((s[it.key] || 0) * scale) });
      const val = h('div.val', fmtVal(it, input.value));
      input.addEventListener('input', function () {
        val.textContent = fmtVal(it, input.value);
        setSetting({ [it.key]: Number(input.value) / scale });
        if (it.key === 'menuSounds') Sound.move();
      });
      row.appendChild(input);
      row.appendChild(val);
      row._range = input;
    } else if (it.type === 'pick') {
      const names = currentNames();
      row.classList.add('pick');
      /* a long value keeps its "(...)" part in its own span, so a console that shows values short on the right (PS5)
         can leave it out */
      const full = String(names[it.v] || ''), m = full.length > 34 && /^(.+?) (\(.+\))$/.exec(full);
      txt.appendChild(m ? h('div.d.cur', { title: full }, m[1], h('span.more', ' ' + m[2])) : h('div.d.cur', full));
      const b = h('button.btn', { tabindex: '-1' }, h('span', { html: icon(it.icon || 'arrowRight') }), it.label || 'Change');
      row.appendChild(b);
      row.addEventListener('click', async function () { Sound.press(); await it.run(ctx); renderMain(); });
    } else if (it.type === 'button') {
      row.classList.add('act');
      const b = h('button.btn', { tabindex: '-1' }, h('span', { html: icon(it.icon || 'arrowRight') }), it.label || 'Open');
      row.appendChild(b);
      row.addEventListener('click', function () { Sound.press(); it.run(); });
    }
    return row;
  }
  function fmtVal(it, v) { return v + (it.pct ? '%' : it.unit || ''); }

  async function renderMain() {
    main.textContent = '';
    if (q) {
      const words = q.split(/\s+/);
      const hits = ITEMS.filter(function (it) {
        const hay = (it.t + ' ' + (it.d || '') + ' ' + (it.kw || '')).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      });
      main.appendChild(h('h3', hits.length ? 'Found ' + hits.length : 'Nothing found'));
      main.appendChild(h('p.lead', hits.length ? 'For "' + search.value + '"' : 'Try another word, like "music" or "backup".'));
      hits.forEach(function (it) { main.appendChild(itemEl(it, true)); });
      return;
    }
    const c = CATS.find(function (x) { return x.k === cat; });
    main.appendChild(h('h3', c.label));
    if (cat === 'about') {
      const info = St.info || {};
      main.appendChild(h('p.lead', 'Game System 3, version ' + (info.version || '3.0.0') + '.'));
      [['Your games', info.games], ['Screenshots', info.captures], ['Backups', info.backups]].forEach(function (r) {
        main.appendChild(h('div.set', h('div.txt', h('div.t', r[0]), h('div.d', r[1] || ''))));
      });
      main.appendChild(h('p.lead', { style: { marginTop: '22px' } }, 'Keys: F1 = quick menu, F12 = screenshot, F11 = full screen. On a controller: the PS / Xbox button (or Start + Select together) = quick menu.'));
      return;
    }
    if (cat === 'booster') {
      ITEMS.filter(function (it) { return it.cat === 'booster'; }).forEach(function (it) { main.appendChild(itemEl(it, false)); });
      const memo = await window.gs.invoke('booster:memory');
      main.appendChild(h('div.cgroup', { style: { margin: '26px 0 8px' } }, 'Apps I remember'));
      const rows = [].concat(memo.always.map(function (k) { return [k, 'always']; }), memo.never.map(function (k) { return [k, 'never']; }));
      if (!rows.length) main.appendChild(h('p.lead', 'None yet. In the Booster popup, tap "Always" or "Never" next to an app.'));
      rows.forEach(function (r) {
        const b = h('button.btn', { tabindex: '-1' }, h('span', { html: icon('x') }), 'Forget');
        const row = h('div.set', { 'data-f': '' }, h('div.txt', h('div.t', r[0]), h('div.d', r[1] === 'always' ? 'Always close it when boosting' : 'Never close it')), b);
        row.addEventListener('click', async function () { Sound.press(); await window.gs.invoke('booster:remember', r[0], 'forget'); renderMain(); });
        main.appendChild(row);
      });
      return;
    }
    if (cat === 'crashes') {
      const list = await window.gs.invoke('games:crashes');
      main.appendChild(h('p.lead', list.length ? 'Games that stopped this time Game System 3 was open.' : 'No crashes. Nice.'));
      list.slice().reverse().forEach(function (c) {
        main.appendChild(h('div.set', h('div.txt', h('div.t', c.name), h('div.d', fmtDate(c.at) + ' · ' + (c.reason === 'oom' ? 'ran out of memory' : c.reason || 'crashed')))));
      });
      return;
    }
    ITEMS.filter(function (it) { return it.cat === cat; }).forEach(function (it) { main.appendChild(itemEl(it, false)); });
  }

  function key(action) {
    if (!cur || !root.contains(cur)) cur = setFocus(root, catBox.querySelector('.side-item.on') || search);
    if ((action === 'left' || action === 'right') && cur && cur._range) {
      const r = cur._range;
      r.value = Number(r.value) + (action === 'left' ? -1 : 1) * Number(r.step || 1);
      r.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (/^(up|down|left|right)$/.test(action)) {
      const next = moveFocus(root, cur, action);
      if (!next) return action === 'up' ? false : true;
      cur = setFocus(root, next);
      Sound.move();
      if (next.dataset.cat) setCat(next.dataset.cat, next);
      return true;
    }
    if (action === 'ok') { if (cur && cur !== search && !cur.dataset.cat) cur.click(); else if (cur && cur.dataset.cat) { const first = main.querySelector('[data-f]'); if (first) { cur = setFocus(root, first); Sound.move(); } } return true; }
    if (action === 'back') {
      if (cur && main.contains(cur)) { cur = setFocus(root, catBox.querySelector('.side-item.on') || search); Sound.back(); return true; }
      return false;
    }
    return true;
  }

  onState(function (w) { if (visible && w === 'settings') { /* keep sliders where they are while dragging */ } });

  return {
    show: function (opts) {
      visible = true;
      root.hidden = false;
      if (opts && opts.cat) cat = opts.cat;
      renderCats();
      renderMain();
      cur = setFocus(root, catBox.querySelector('.side-item.on'));
    },
    hide: function () { visible = false; root.hidden = true; },
    key: key,
    blur: function () { root.querySelectorAll('.focus').forEach(function (x) { x.classList.remove('focus'); }); cur = null; },
    takeFocus: function () { cur = setFocus(root, catBox.querySelector('.side-item.on') || search); }
  };
}
