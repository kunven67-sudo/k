/* A game's menu (the ••• button, right-click, or Options on a controller), its game page, and the cover picker. */
import { h, css, fmtPlay, fmtAgo, fmtBytes } from './dom.js';
import { icon } from './icons.js';
import { menu, modal, prompt, confirm } from './modal.js';
import { Sound } from './sound.js';
import { St, isRunning, loadLibrary, PHONE } from './state.js';
import { editCover, addLogo, applyLogo } from './covermaker.js';

export function makeOptions(ctx) {
  function open(id) {
    const g = St.games.get(id);
    if (!g) return;
    const running = isRunning(id);
    menu(g.name, [
      { label: running ? 'Resume' : 'Play', icon: running ? 'resume' : 'play', onClick: function () { ctx.play(id); } },
      { label: 'Game page', icon: 'info', desc: 'Time played, screenshots, saves', onClick: function () { page(id); } },
      running ? { label: 'Close game', icon: 'x', desc: 'Takes it out of Quick Resume', onClick: async function () { await window.gs.invoke('games:close', id); ctx.toast({ text: 'Closed ' + g.name }); } } : null,
      { label: 'Change cover', icon: 'image', desc: 'Crop it + the game\'s name as a logo', onClick: function () { coverPicker(id); } },
      g.cover ? { label: 'Name on cover', icon: 'text', desc: g.logo && g.logo.on ? 'On' : 'Off', onClick: function () { nameOnCover(id); } } : null,
      { label: 'Booster', icon: 'zap', desc: { ask: 'Ask when it lags', always: 'Always boost', never: 'Never' }[g.boost || 'ask'], onClick: function () { boostPref(id); } },
      { label: 'Saved data', icon: 'save', onClick: function () { ctx.openSaved(id); } },
      { label: 'Rename', icon: 'edit', onClick: async function () {
        const name = await prompt({ title: 'Rename', value: g.name, ok: 'Save' });
        if (name && name !== g.name) { await window.gs.invoke('lib:rename', id, name); await loadLibrary(); }
      } },
      { label: g.hidden ? 'Show in library' : 'Hide', icon: g.hidden ? 'eye' : 'eyeOff', desc: g.hidden ? '' : 'Moves it to Hidden games', onClick: async function () {
        await window.gs.invoke('lib:hide', id, !g.hidden);
        await loadLibrary();
        ctx.toast({ text: g.hidden ? g.name + ' is back in your library' : g.name + ' is hidden. It\'s at the bottom of the Library.' });
      } },
      g.dir ? { label: 'Open game folder', icon: 'folderOpen', onClick: function () { window.gs.invoke('lib:folder', id); } } : null,
      { label: 'Change its files', icon: 'upload', desc: 'New version or fixed files. Saves, cover + play time stay', onClick: function () { changeFiles(id); } },
      St.missing.has(id) ? { label: 'Find its folder', icon: 'search', desc: 'It was moved or deleted', onClick: async function () { await window.gs.invoke('lib:relink', id); await loadLibrary(); } } : null,
      g.oldVersions ? { label: 'Go back to the old version', icon: 'history', desc: 'From before the last update', onClick: async function () {
        const ok = await confirm({ title: 'Go back to the old version of ' + g.name + '?', text: 'Your saves stay. You can switch back again for 7 days.', yes: 'Go back' });
        if (!ok) return;
        const r = await window.gs.invoke('lib:goback', id);
        await loadLibrary();
        ctx.toast(r && r.ok ? { kind: 'good', text: 'Went back to the old version' } : { kind: 'warn', text: 'The old version is gone already.' });
      } } : null,
      { label: 'Remove', icon: 'trash', danger: true, onClick: function () { remove(id); } }
    ].filter(function (it) { return !PHONE || !it || !/^(Change cover|Name on cover|Booster|Open game folder|Change its files|Find its folder|Go back to the old version)$/.test(it.label); }));
  }

  /* the game page: big art, Play, how much you played, its saves and screenshots, everything for it in one place */
  function page(id) {
    const g = St.games.get(id);
    if (!g) return;
    const running = isRunning(id);
    let m = null;
    const go = function (fn) { return function () { Sound.press(); m.close(); fn(); }; };
    const stat = function (label, val) { const v = h('div.v', val); return { el: h('div.gp-stat', h('div.l', label), v), v: v }; };
    const saved = stat('Saved data', '…');
    const stats = h('div.gp-stats',
      stat('Time played', g.playTime > 0 ? fmtPlay(g.playTime) : 'Not yet').el,
      stat('Last played', g.lastPlayed ? fmtAgo(g.lastPlayed) : 'Never').el,
      stat('Times played', String(g.launches || 0)).el,
      saved.el);
    window.gs.invoke('saves:info', id).then(function (r) { saved.v.textContent = r && r.size ? fmtBytes(r.size) : 'None yet'; });
    const shots = h('div.gp-shots', h('div.gp-empty', 'Loading…'));
    const body = h('div.gp',
      h('div.gp-hero',
        h('div.gp-bg', { style: { backgroundImage: css(g.coverClean || g.cover) } }),
        h('div.gp-cover', { style: { backgroundImage: css(g.cover) } }, g.cover ? null : h('div.cnoart', g.name)),
        h('div.gp-main',
          /^(ps5|xbox)$/.test(document.body.dataset.skin) ? applyLogo(h('h1', g.name), g) : h('h1', g.name),
          h('div.gp-sub', [running ? (St.active === id ? 'Playing now' : 'In Quick Resume') : null, g.added ? 'Added ' + fmtAgo(g.added).toLowerCase() : null].filter(Boolean).join('  ·  ')),
          tagRow(g, function () { m.close(); page(id); }),
          h('div.gp-actions',
            h('button.btn.primary', { 'data-f': '', 'data-default': '', onclick: go(function () { ctx.play(id); }) }, h('span', { html: icon(running ? 'resume' : 'play') }), running ? 'Resume' : 'Play'),
            PHONE ? null : h('button.btn', { 'data-f': '', onclick: go(function () { coverPicker(id); }) }, h('span', { html: icon('image') }), 'Change cover'),
            h('button.btn', { 'data-f': '', onclick: go(function () { ctx.openSaved(id); }) }, h('span', { html: icon('save') }), 'Saved data'),
            h('button.btn', { 'data-f': '', 'aria-label': 'More', onclick: go(function () { open(id); }) }, h('span', { html: icon('more') }))))),
      stats,
      h('div.cgroup', 'Screenshots'),
      shots);
    m = modal({ body: body, wide: true });
    m.box.classList.add('gp-box');
    window.gs.invoke('shot:list', id).then(function (list) {
      shots.textContent = '';
      if (!list || !list.length) { shots.appendChild(h('div.gp-empty', 'No screenshots yet. Press F12 while playing to take one.')); return; }
      list.forEach(function (sh) {
        shots.appendChild(h('button.choice', { 'data-f': '', style: { backgroundImage: css(sh.url) }, onclick: function () { Sound.press(); viewShot(sh); } }));
      });
    });
  }
  /* tags: tap one to take it off (wrong tag), + Tag to add one. Your changes stay even when it re-tags. */
  function tagRow(g, reopen) {
    const row = h('div.gp-tags');
    (g.tags || []).forEach(function (t) {
      row.appendChild(h('button.gp-tag', { 'data-f': '', title: 'Take this tag off', onclick: async function () {
        Sound.back();
        await window.gs.invoke('lib:tag', g.id, t, false);
        await loadLibrary();
        ctx.toast({ text: 'Took ' + t + ' off ' + g.name });
        reopen();
      } }, t, h('span', { html: icon('x') })));
    });
    row.appendChild(h('button.gp-tag.add', { 'data-f': '', onclick: async function () {
      Sound.press();
      const all = await window.gs.invoke('lib:tagnames');
      menu('Add a tag to ' + g.name, all.filter(function (t) { return (g.tags || []).indexOf(t) < 0; }).map(function (t) {
        return { label: t, icon: 'plus', onClick: async function () { await window.gs.invoke('lib:tag', g.id, t, true); await loadLibrary(); reopen(); } };
      }));
    } }, h('span', { html: icon('plus') }), 'Tag'));
    return row;
  }

  function viewShot(sh) {
    modal({
      body: h('img.gp-big', { src: sh.url, alt: '' }), wide: true,
      actions: [
        { label: 'Show in folder', icon: 'folderOpen', onClick: function () { window.gs.invoke('shot:show', sh.file); } },
        { label: 'Close', kind: 'primary', default: true }
      ]
    });
  }

  /* swap a game's files (a fresh download, a fixed version): everything else about it stays */
  function changeFiles(id) {
    const g = St.games.get(id);
    if (!g) return;
    const go = async function (kind) {
      const r = await window.gs.invoke('lib:replace', id, kind);
      if (!r) return;
      await loadLibrary();
      ctx.toast(r.ok ? { kind: 'good', text: 'New files for ' + g.name + '. Saves, cover and play time stayed. The old files are kept 7 days (Go back to the old version).' } : { kind: 'warn', text: r.error || 'That didn\'t work.' });
    };
    menu('Change ' + g.name + '\'s files', [
      { label: 'Pick a folder', icon: 'folder', desc: 'The game\'s folder (like an extracted download)', onClick: function () { go('folder'); } },
      { label: 'Pick a .zip or .html', icon: 'upload', desc: 'A downloaded zip works, no need to extract', onClick: function () { go('file'); } }
    ]);
  }

  /* the per-game off switch for the name logo */
  async function nameOnCover(id) {
    const g = St.games.get(id);
    if (!g) return;
    const on = !(g.logo && g.logo.on);
    if (on) await addLogo(g, g.logo, true);
    else await window.gs.invoke('covers:logo-off', id);
    await loadLibrary();
    ctx.toast({ text: on ? 'The name is on ' + g.name + '\'s cover' : 'The name is off ' + g.name + '\'s cover' });
  }

  function boostPref(id) {
    const g = St.games.get(id);
    const set = async function (v) { await window.gs.invoke('booster:pref', id, v); await loadLibrary(); ctx.toast({ text: 'Booster for ' + g.name + ': ' + { ask: 'ask when it lags', always: 'always boost', never: 'never' }[v] }); };
    menu('Booster for ' + g.name, [
      { label: 'Ask when it lags', icon: 'info', desc: (g.boost || 'ask') === 'ask' ? 'Now' : '', onClick: function () { set('ask'); } },
      { label: 'Always boost', icon: 'zap', desc: g.boost === 'always' ? 'Now' : 'Closes the apps you picked + max power', onClick: function () { set('always'); } },
      { label: 'Never', icon: 'x', desc: g.boost === 'never' ? 'Now' : '', onClick: function () { set('never'); } }
    ]);
  }

  async function remove(id) {
    const g = St.games.get(id);
    if (!g) return;
    let alsoSaves = false;
    const ok = await new Promise(function (resolve) {
      let val = false;
      const box = h('div.set', { 'data-f': '', style: { cursor: 'pointer' } },
        h('div.txt', h('div.t', 'Also delete its saved data'), h('div.d', 'Off = the saves stay, so if you add the game again later it continues where you left off.')),
        h('div.switch'));
      box.addEventListener('click', function () { alsoSaves = !alsoSaves; box.querySelector('.switch').classList.toggle('on', alsoSaves); Sound.move(); });
      modal({
        title: 'Remove ' + g.name + '?',
        lead: g.dir ? 'Its files go to the Recycle Bin.' : 'It goes out of your library.',
        body: box,
        onClose: function () { resolve(val); },
        actions: [{ label: 'Cancel', default: true }, { label: 'Remove', kind: 'danger', icon: 'trash', onClick: function () { val = true; } }]
      });
    });
    if (!ok) return;
    await window.gs.invoke('lib:remove', id, alsoSaves);
    await loadLibrary();
    ctx.toast({ text: 'Removed ' + g.name });
  }

  /* pick a cover: shots from playing it for a few seconds, the game's own pictures, or a file */
  function coverPicker(id) {
    const g = St.games.get(id);
    if (!g) return;
    const body = h('div');
    const mk = function (url, lbl, onPick) {
      const c = h('button.choice', { 'data-f': '', style: { backgroundImage: css(url) }, onclick: function () { Sound.press(); onPick(); } }, lbl ? h('span.lbl', lbl) : null);
      return c;
    };
    let m = null;
    /* any picture opens the cover maker (crop + name); saving it makes it the cover */
    const edit = async function (url) {
      m.close();
      const ok = await editCover(g, url);
      await loadLibrary();
      if (ok) ctx.toast({ kind: 'good', text: 'New cover for ' + g.name });
      else if (ok === null) ctx.toast({ kind: 'warn', text: 'That picture didn\'t work.' });
    };
    const top = h('div.choices');
    /* "Now" = edit the cover you have (the clean picture, so the name isn't drawn twice) */
    if (g.cover) { const now = mk(g.cover, 'Now', function () { edit(g.coverClean || g.cover); }); now.classList.add('on'); top.appendChild(now); }
    const fileBtn = h('button.choice.file', { 'data-f': '', onclick: async function () {
      Sound.press();
      const r = await window.gs.invoke('covers:pickfile');
      if (r && r.url) edit(r.url);
    } }, h('div', h('span', { html: icon('upload') }), 'Pick a picture'));
    top.appendChild(fileBtn);
    body.appendChild(top);
    const shotsTitle = h('div.cgroup', 'Cool moments from the game');
    const shots = h('div.choices', h('div.choice.loading', h('div', h('div.spinner', { style: { margin: '0 auto 10px', width: '26px', height: '26px' } }), 'Playing it for a few seconds to grab cool moments…')));
    const picsTitle = h('div.cgroup', 'The game\'s own pictures');
    const pics = h('div.choices');
    body.appendChild(shotsTitle);
    body.appendChild(shots);
    body.appendChild(picsTitle);
    body.appendChild(pics);
    picsTitle.hidden = true;
    m = modal({ title: 'Cover for ' + g.name, lead: 'Tap one, then crop it and pick how the name looks.', body: body, wide: true });
    window.gs.invoke('covers:options', id).then(function (r) {
      shots.textContent = '';
      (r.shots || []).forEach(function (s) { shots.appendChild(mk(s.url, null, function () { edit(s.url); })); });
      if (!(r.shots || []).length) shots.appendChild(h('div.choice.loading', 'Couldn\'t grab good moments from this one.'));
      (r.pictures || []).forEach(function (p) { pics.appendChild(mk(p.url, null, function () { edit(p.url); })); });
      picsTitle.hidden = !(r.pictures || []).length;
      m.refocus();
    });
  }

  return { open: open, page: page, coverPicker: coverPicker, remove: remove };
}
