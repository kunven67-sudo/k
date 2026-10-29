/* The home screen (Game System 3's own style).
   PS5-style: a row of games, newest played first. Click = pick it (it grows + glows, its art fills the
   background, its song fades in). PLAY starts it. Double-click also plays. */
import { h, fmtAgo, fmtPlay, fmtBytes, css } from './dom.js';
import { icon } from './icons.js';
import { St, homeGames, isRunning, onState, PHONE } from './state.js';
import { Sound } from './sound.js';
import { Music } from './music.js';
import { Bg } from './bg.js';
import { applyLogo } from './covermaker.js';

const MAX_ROW = 16;

export function makeHome(root, ctx) {
  let zone = 'row';        /* 'row' | 'actions' */
  let actIndex = 0;        /* 0 = play, 1 = more */
  const selByTab = { game: null, app: null };
  let items = [];          /* [{type:'game', g} | {type:'lib'} | {type:'add'}] */
  let selIndex = 0;
  let saveCache = new Map();
  let visible = false;

  const row = h('div.row');
  const track = h('div.row-track');
  row.appendChild(track);
  const hero = h('div.hero');
  const welcome = h('div.welcome');
  root.appendChild(row);
  root.appendChild(hero);
  root.appendChild(welcome);

  function build() {
    const list = homeGames().slice(0, MAX_ROW);
    items = list.map(function (g) { return { type: 'game', g: g }; });
    if (items.length) items.push({ type: 'lib' });
    const want = selByTab[St.tab];
    let idx = items.findIndex(function (it) { return it.type === 'game' && it.g.id === want; });
    if (idx < 0) idx = Math.min(selIndex, Math.max(0, items.length - 1));
    selIndex = Math.max(0, idx);
    render();
  }

  let tiles = [];
  const label = h('div.tile-label');
  const probe = h('div', { style: { position: 'absolute', visibility: 'hidden', width: 'var(--tile)', height: '1px' } });
  row.appendChild(probe);

  function tileFor(it, i) {
    let el;
    if (it.type === 'game') {
      const g = it.g;
      const art = h('div.art', { style: { backgroundImage: css(g.cover) } });
      if (!g.cover) art.appendChild(h('div.noart', g.name));
      el = h('div.tile', { dataset: { id: g.id } }, art);
      if (St.active === g.id) el.appendChild(h('div.badge.live', 'Playing'));
      else if (isRunning(g.id)) el.appendChild(h('div.badge', 'Quick Resume'));
      else if (St.missing.has(g.id)) el.appendChild(h('div.badge', 'Missing'));
    } else {
      el = h('div.tile.lib', h('div.art', { html: icon(document.body.dataset.skin === 'ps5' ? 'grid9' : 'grid') }));
    }
    el.addEventListener('click', function () {
      const idx = tiles.indexOf(el);
      if (idx < 0) return;
      zone = 'row';
      if (selIndex !== idx) select(idx, false);
      else applySel();
      if (it.type === 'lib') { Sound.press(); ctx.openLibrary(); }
    });
    el.addEventListener('dblclick', function () { if (it.type === 'game') ctx.play(it.g.id, el); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); if (it.type === 'game') ctx.options(it.g.id); });
    return el;
  }

  function render() {
    track.textContent = '';
    hero.textContent = '';
    welcome.textContent = '';
    tiles = [];
    if (!items.length) { renderWelcome(); Bg.set(null); Music.want(null); return; }
    row.hidden = false;
    tiles = items.map(tileFor);
    tiles.forEach(function (t) { track.appendChild(t); });
    applySel(true);
  }

  /* only classes change when you move, so the grow/shrink animates smoothly */
  function applySel(first) {
    if (!tiles.length) { render(); return; }
    tiles.forEach(function (t, i) {
      t.classList.toggle('sel', i === selIndex);
      t.classList.toggle('ring', i === selIndex && zone === 'row');
    });
    const it = items[selIndex];
    label.textContent = it.type === 'game' ? it.g.name : 'Game Library';
    label.style.animation = 'none';
    void label.offsetWidth;
    label.style.animation = '';
    track.insertBefore(label, tiles[selIndex].nextSibling);
    scrollRow(first);
    renderHero();
  }

  function scrollRow(instant) {
    const small = probe.getBoundingClientRect().width || 112;
    const gap = 14;
    const x = selIndex * (small + gap);
    if (instant) { track.style.transition = 'none'; void track.offsetWidth; }
    track.style.transform = 'translateX(' + (-x) + 'px)';
    if (instant) { void track.offsetWidth; track.style.transition = ''; }
  }

  function renderHero() {
    const it = items[selIndex];
    hero.textContent = '';
    if (!it) return;
    if (it.type === 'lib') {
      Bg.set(null);
      Music.want(null);
      const n = St.games.size;
      hero.appendChild(h('div.hero-kicker', 'Everything you have'));
      hero.appendChild(h('h1.hero-title', 'Game Library'));
      const open = h('button.play-btn' + (zone === 'actions' ? '.focus' : ''), { onclick: function () { Sound.press(); ctx.openLibrary(); } }, h('span', { html: icon('grid') }), 'Open');
      hero.appendChild(h('div.hero-actions', open));
      hero.appendChild(h('div.hero-info', h('span', h('b', String(n)), n === 1 ? ' game' : ' games and apps')));
      return;
    }
    const g = it.g;
    Bg.set(g.cover);
    Music.want(g.music);
    const running = isRunning(g.id);
    const playing = St.active === g.id;
    hero.appendChild(h('div.hero-kicker', g.kind === 'app' ? 'App' : (g.url ? 'Online game' : 'Game')));
    const title = h('h1.hero-title', g.name);
    if (document.body.dataset.skin === 'ps5') applyLogo(title, g);
    hero.appendChild(title);
    const play = h('button.play-btn.primary', { onclick: function () { ctx.play(g.id, track.querySelector('.tile.sel')); } },
      h('span', { html: icon(running ? 'resume' : 'play') }), playing ? 'Back to game' : running ? 'Resume' : 'Play');
    const more = h('button.round-btn', { title: 'Options', onclick: function () { Sound.open(); ctx.options(g.id); } }, h('span', { html: icon('more') }));
    if (zone === 'actions') (actIndex === 0 ? play : more).classList.add('focus');
    hero.appendChild(h('div.hero-actions', play, more));
    const info = h('div.hero-info');
    info.appendChild(h('span', g.lastPlayed ? 'Played ' + fmtAgo(g.lastPlayed).toLowerCase() : 'Never played'));
    if (g.playTime > 0) info.appendChild(h('span', h('b', fmtPlay(g.playTime)), ' played'));
    const sv = saveCache.get(g.id);
    const svEl = h('span');
    if (sv != null) svEl.textContent = sv > 0 ? 'Saved data ' + fmtBytes(sv) : 'No saved data yet';
    info.appendChild(svEl);
    if (St.missing.has(g.id)) info.appendChild(h('span', { style: { color: 'var(--warn)' } }, 'Its folder is missing'));
    hero.appendChild(info);
    if (sv == null) {
      window.gs.invoke('saves:info', g.id).then(function (r) {
        if (!r || typeof r.size !== 'number') return;
        saveCache.set(g.id, r.size);
        svEl.textContent = r.size > 0 ? 'Saved data ' + fmtBytes(r.size) : 'No saved data yet';
      });
    }
  }

  function renderWelcome() {
    row.hidden = true;
    const first = !!St.settings.firstRun;
    welcome.appendChild(h('div.hero-kicker', first ? 'Welcome' : St.tab === 'app' ? 'Apps' : 'Games'));
    welcome.appendChild(h('h1', first ? 'Welcome to Game System 3' : St.tab === 'app' ? 'No apps yet' : 'No games yet'));
    if (PHONE) {
      welcome.appendChild(h('p', 'Your games live on your PC. On the PC: Settings > System > Copy to my phone, then point this phone\'s camera at the code. Your games, saves and console sounds come over.'));
      const pb = h('button.play-btn.primary.focus', { onclick: function () { Sound.press(); ctx.phoneHelp(); } }, h('span', { html: icon('phone') }), 'Copy from my PC');
      welcome.appendChild(h('div.hero-actions', pb));
      Bg.set(null);
      return;
    }
    welcome.appendChild(h('p', first
      ? 'Bring everything over from Game System 2 in one go, or add games: drop .html files, .zip files or game folders anywhere on this screen.'
      : 'Drop .html files, .zip files or game folders anywhere on this screen, or put them in your Games folder and they show up by themselves.'));
    const b1 = h('button.play-btn.primary', { onclick: function () { Sound.press(); ctx.openGs2(); } }, h('span', { html: icon('download') }), 'Bring over Game System 2');
    const b2 = h('button.play-btn', { onclick: function () { Sound.press(); ctx.openAdd(); } }, h('span', { html: icon('plus') }), 'Add games');
    const acts = h('div.hero-actions', b1, b2);
    welcome.appendChild(acts);
    const btns = [b1, b2];
    btns[Math.min(actIndex, 1)].classList.add('focus');
    Bg.set(null);
  }

  function select(i, quiet) {
    if (i < 0 || i >= items.length || i === selIndex) return false;
    selIndex = i;
    const it = items[i];
    selByTab[St.tab] = it.type === 'game' ? it.g.id : null;
    if (!quiet) Sound.move();
    applySel();
    return true;
  }

  function key(action) {
    if (!items.length) {
      if (action === 'left' || action === 'right') { actIndex = action === 'left' ? 0 : 1; Sound.move(); render(); return true; }
      if (action === 'ok') { Sound.press(); (actIndex === 0 ? ctx.openGs2 : ctx.openAdd)(); return true; }
      if (action === 'up') return false;
      return true;
    }
    const it = items[selIndex];
    if (zone === 'row') {
      if (action === 'left') { if (!select(selIndex - 1)) return true; return true; }
      if (action === 'right') { select(selIndex + 1); return true; }
      if (action === 'down') { zone = 'actions'; actIndex = 0; Sound.move(); applySel(); return true; }
      if (action === 'up') return false; /* to the top bar */
      if (action === 'ok') {
        if (it.type === 'lib') { Sound.press(); ctx.openLibrary(); }
        else ctx.play(it.g.id, track.querySelector('.tile.sel'));
        return true;
      }
      if (action === 'options' && it.type === 'game') { Sound.open(); ctx.options(it.g.id); return true; }
      return true;
    }
    /* actions: Play / More */
    if (action === 'up') { zone = 'row'; Sound.move(); applySel(); return true; }
    if (action === 'left' || action === 'right') {
      if (it.type !== 'game') return true;
      const n = action === 'left' ? 0 : 1;
      if (n !== actIndex) { actIndex = n; Sound.move(); applySel(); }
      return true;
    }
    if (action === 'ok') {
      if (it.type === 'lib') { Sound.press(); ctx.openLibrary(); return true; }
      if (actIndex === 0) ctx.play(it.g.id, track.querySelector('.tile.sel'));
      else { Sound.open(); ctx.options(it.g.id); }
      return true;
    }
    if (action === 'back') { zone = 'row'; Sound.back(); applySel(); return true; }
    if (action === 'options' && it.type === 'game') { Sound.open(); ctx.options(it.g.id); return true; }
    return true;
  }

  row.addEventListener('wheel', function (e) {
    if (!items.length) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 8) return;
    select(selIndex + (d > 0 ? 1 : -1));
  }, { passive: true });
  window.addEventListener('resize', function () { if (visible && tiles.length) scrollRow(true); });

  onState(function (what) {
    if (what === 'lib') saveCache = new Map();
    if (visible && (what === 'lib' || what === 'running' || what === 'settings')) build();
  });

  return {
    show: function () { visible = true; root.hidden = false; if (zone === 'none') zone = 'row'; build(); },
    hide: function () { visible = false; root.hidden = true; },
    key: key,
    blurRow: function () { zone = 'none'; if (tiles.length) applySel(); else render(); },
    hasFocus: function () { return zone !== 'none'; },
    takeFocus: function () { zone = 'row'; if (tiles.length) applySel(); else render(); },
    selected: function () { const it = items[selIndex]; return it && it.type === 'game' ? it.g.id : null; },
    selectId: function (id) { selByTab[St.tab] = id; build(); },
    refreshSaves: function (id) { saveCache.delete(id); if (visible && tiles.length) renderHero(); }
  };
}
