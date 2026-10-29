/* Pickers for Settings > Look and sound: home style (with pictures), button sounds, startup sound,
   game start sound, menu music. Landing on a sound plays it so you can hear it before picking. */
import { h, css } from './dom.js';
import { icon } from './icons.js';
import { modal } from './modal.js';
import { Sound } from './sound.js';
import { Music } from './music.js';
import { St, setSetting } from './state.js';
import { ownSongs, refreshOwn } from './ownmusic.js';
import { HOLIDAYS, currentHoliday } from './holidays.js';
import { STYLES, STARTUP_SOUNDS, GAMESTART_SOUNDS, MUSIC, BUTTON_SOUNDS, buttonPack, styleById, nameOf } from './styles.js';

export function pickStyle() {
  return new Promise(function (resolve) {
    const grid = h('div.style-grid');
    let m = null;
    STYLES.forEach(function (s) {
      const card = h('button.style-card' + (St.settings.homeStyle === s.id ? '.on' : ''), { 'data-f': '', 'data-default': St.settings.homeStyle === s.id ? '' : null },
        h('div.style-pic', { style: { backgroundImage: css('img/styles/' + s.id + '.jpg') } }),
        h('div.style-name', s.name), h('div.style-fam', s.family));
      card.addEventListener('click', async function () {
        m.close();
        await setSetting({ homeStyle: s.id });
        /* a taste of the new style: its startup sound */
        const st = styleById(s.id);
        const snd = (St.settings.startupSound || 'style') === 'style' ? st.boot : St.settings.startupSound;
        if (snd === 'gs3') Sound.boot(); else if (snd && snd !== 'none') Sound.playLong(snd, 0.8);
        resolve(s.id);
      });
      grid.appendChild(card);
    });
    m = modal({ title: 'Home style', lead: 'Everything switches to that console\'s look: the home screen, Library, Settings, pop-ups, the quick menu over games, fonts, button sounds, startup sound and menu music. Settings can still change the sounds and music.', body: grid, wide: true, onClose: function () { resolve(null); } });
  });
}

/* a list of sounds; landing on one plays it */
function soundList(title, lead, options, current, play, stop) {
  return new Promise(function (resolve) {
    const list = h('div.menu-list');
    let m = null;
    let timer = null;
    let picked = null;
    options.forEach(function (o) {
      const row = h('button.menu-item' + (o.id === current ? '.on' : ''), { 'data-f': '', 'data-default': o.id === current ? '' : null, dataset: { id: o.id } },
        h('span', { html: icon(o.id === current ? 'check' : o.icon || ((o.id === 'none' || o.id === 'off') ? 'mute' : 'volume')) }), o.name, o.desc ? h('span.d', o.desc) : null);
      row.addEventListener('click', function () { picked = o.id; m.close(); });
      row.addEventListener('focusin', function () { queue(o.id); });
      list.appendChild(row);
    });
    function queue(id) {
      clearTimeout(timer);
      timer = setTimeout(function () { play(id); }, 280);
    }
    /* hearing follows the white highlight (keys, controller or mouse) */
    const obs = new MutationObserver(function () {
      const f = list.querySelector('.menu-item.focus');
      if (f && f.dataset.id !== obs.last) { obs.last = f.dataset.id; queue(f.dataset.id); }
    });
    obs.observe(list, { subtree: true, attributes: true, attributeFilter: ['class'] });
    m = modal({
      title: title, lead: lead, body: list,
      onClose: function () { clearTimeout(timer); obs.disconnect(); stop(); resolve(picked); }
    });
  });
}

export async function pickButtons() {
  const st = styleById(St.settings.homeStyle);
  const opts = [{ id: 'style', name: 'Same as the home style', desc: nameOf(BUTTON_SOUNDS, st.pack) }].concat(BUTTON_SOUNDS);
  const cur = St.settings.buttonSounds || 'style';
  let demo = null;
  const id = await soundList('Button sounds', 'The clicks when you move around and pick things.', opts, cur,
    /* a taste: two moves, then select */
    function (x) {
      clearTimeout(demo);
      Sound.usePack(buttonPack(x === 'style' ? st.pack : x));
      Sound.move();
      demo = setTimeout(function () { Sound.move(); demo = setTimeout(function () { Sound.press(); }, 260); }, 170);
    },
    function () { clearTimeout(demo); });
  if (id) await setSetting({ buttonSounds: id });
  /* not picked (or the same one): back to what's set */
  Sound.usePack(buttonPack((St.settings.buttonSounds || 'style') === 'style' ? st.pack : St.settings.buttonSounds));
}

export async function pickStartup() {
  const st = styleById(St.settings.homeStyle);
  const opts = [{ id: 'style', name: 'Same as the home style', desc: nameOf(STARTUP_SOUNDS, st.boot) }].concat(STARTUP_SOUNDS);
  const id = await soundList('When Game System 3 opens', 'The sound with the startup screen.', opts, St.settings.startupSound || 'style',
    function (x) { const s = x === 'style' ? st.boot : x; if (s === 'gs3') { Sound.stopLong(100); Sound.boot(); } else if (s !== 'none') Sound.playLong(s, 0.8); else Sound.stopLong(200); },
    function () { Sound.stopLong(500); });
  if (id) await setSetting({ startupSound: id });
}

export async function pickGameStart() {
  const st = styleById(St.settings.homeStyle);
  const opts = [{ id: 'style', name: 'Same as the home style', desc: nameOf(GAMESTART_SOUNDS, st.gameStart) }].concat(GAMESTART_SOUNDS);
  const id = await soundList('When a game starts', 'The sound when you press Play.', opts, St.settings.gameStartSound || 'style',
    function (x) { Sound.stopLong(80); Sound.launch(x === 'style' ? st.gameStart : x); },
    function () { Sound.stopLong(500); });
  if (id) await setSetting({ gameStartSound: id });
}

export async function pickMusic(ctx) {
  const st = styleById(St.settings.homeStyle);
  const mine = await refreshOwn();
  const opts = [{ id: 'style', name: 'Same as the home style', desc: st.music ? nameOf(MUSIC, st.music) : 'No console music' }, { id: 'off', name: 'No console music' }].concat(MUSIC);
  if (mine.length > 1) opts.push({ id: 'own:*', name: 'My songs (shuffled)', desc: mine.length + ' songs', icon: 'music' });
  mine.forEach(function (m) { opts.push({ id: 'own:' + m.name, name: m.title, desc: 'My song', icon: 'music' }); });
  opts.push({ id: '__add', name: 'Add your own songs…', desc: 'MP3, M4A, WAV, OGG, FLAC', icon: 'plus' });
  if (mine.length) opts.push({ id: '__folder', name: 'Open my Music folder', desc: 'Delete songs there', icon: 'folderOpen' });
  const id = await soundList('Menu music', 'Plays quietly on the home screen. A game\'s own song still takes over when you land on that game (if that\'s on).', opts, St.settings.menuMusic || 'style',
    function (x) { if (x.indexOf('__') === 0) { Music.preview(null); return; } const t = x === 'style' ? st.music : x === 'off' ? null : x; Music.preview(t); },
    function () { Music.endPreview(); });
  if (id === '__folder') { window.gs.invoke('shell:open', 'music'); return; }
  if (id === '__add') {
    const added = await window.gs.invoke('music:add');
    if (!added || !added.length) return;
    await refreshOwn();
    /* one song: play it. More: play all of yours shuffled */
    await setSetting({ menuMusic: added.length === 1 ? 'own:' + added[0] : 'own:*' });
    if (ctx && ctx.toast) ctx.toast({ kind: 'good', icon: 'music', text: added.length === 1 ? 'Added your song. It\'s playing on the home screen now.' : 'Added ' + added.length + ' songs. They play shuffled on the home screen.' });
    return;
  }
  if (id) await setSetting({ menuMusic: id });
}

function ownTitle(name) {
  const m = ownSongs().find(function (x) { return x.name === name; });
  return m ? m.title : name.replace(/\.[a-z0-9]+$/i, '');
}

/* the home background: game art when you're on a game (PS5), or always the console's own (Xbox) */
const BG_NAMES = { game: 'Game art on games, console background on the rest', console: 'Always the console\'s background' };
export async function pickBackground() {
  const st = styleById(St.settings.homeStyle);
  const opts = [
    { id: 'style', name: 'Like the real ' + st.name, desc: BG_NAMES[st.bg || 'game'], icon: 'image' },
    { id: 'game', name: 'Game art', desc: BG_NAMES.game, icon: 'image' },
    { id: 'console', name: 'Console background only', desc: 'Never the game\'s art', icon: 'image' }
  ];
  const id = await soundList('Background', 'What\'s behind the home screen.', opts, St.settings.homeBackground || 'style', function () {}, function () {});
  if (id) await setSetting({ homeBackground: id });
}

/* one off switch per holiday (a list of switches that stays open) */
export function pickHolidays() {
  return new Promise(function (resolve) {
    const list = h('div');
    HOLIDAYS.forEach(function (hd) {
      const when = hd.from[0] === hd.to[0] && hd.from[1] === hd.to[1] ? monthDay(hd.from) : monthDay(hd.from) + ' to ' + monthDay(hd.to);
      const sw = h('div.switch' + ((St.settings.holidaysOff || []).indexOf(hd.id) < 0 ? '.on' : ''));
      const row = h('div.set', { 'data-f': '', dataset: { holiday: hd.id }, style: { cursor: 'pointer' } }, h('div.txt', h('div.t', hd.name), h('div.d', when)), sw);
      row.addEventListener('click', async function () {
        const off = St.settings.holidaysOff || [];
        const on = off.indexOf(hd.id) >= 0;
        Sound.press();
        sw.classList.toggle('on', on);
        await setSetting({ holidaysOff: on ? off.filter(function (x) { return x !== hd.id; }) : off.concat([hd.id]) });
      });
      list.appendChild(row);
    });
    modal({ title: 'Holidays', lead: 'Themes + music you just get. They start early, like real games.', body: list, onClose: function () { resolve(); } });
  });
}
function monthDay(md) { return new Date(2026, md[0] - 1, md[1]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

export function currentNames() {
  const st = styleById(St.settings.homeStyle);
  const su = St.settings.startupSound || 'style', gs = St.settings.gameStartSound || 'style', mm = St.settings.menuMusic || 'style';
  const bs = St.settings.buttonSounds || 'style';
  const hol = currentHoliday(St.info && St.info.now ? new Date(St.info.now) : new Date(), St.settings.holidaysOff);
  const offN = (St.settings.holidaysOff || []).length;
  const hb = St.settings.homeBackground || 'style';
  return {
    background: hb === 'style' ? 'Like the real ' + st.name + ' (' + BG_NAMES[st.bg || 'game'].toLowerCase() + ')' : hb === 'game' ? 'Game art' : 'Console background only',
    holidays: (hol ? 'Now: ' + hol.name : 'None right now') + (offN ? '  ·  ' + offN + ' switched off' : ''),
    style: st.name,
    buttons: bs === 'style' ? 'Same as the style (' + nameOf(BUTTON_SOUNDS, st.pack) + ')' : nameOf(BUTTON_SOUNDS, bs),
    startup: su === 'style' ? 'Same as the style (' + nameOf(STARTUP_SOUNDS, st.boot) + ')' : nameOf(STARTUP_SOUNDS, su),
    gameStart: gs === 'style' ? 'Same as the style (' + nameOf(GAMESTART_SOUNDS, st.gameStart) + ')' : nameOf(GAMESTART_SOUNDS, gs),
    music: mm === 'style' ? 'Same as the style (' + (st.music ? nameOf(MUSIC, st.music) : 'none') + ')' : mm === 'off' ? 'No console music' : mm === 'own:*' ? 'My songs (shuffled)' : mm.indexOf('own:') === 0 ? ownTitle(mm.slice(4)) : nameOf(MUSIC, mm)
  };
}
