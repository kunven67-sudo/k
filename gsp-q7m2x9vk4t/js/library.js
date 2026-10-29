/* The Game Library: every game in a grid.
   - Click = pick it (white glow). PLAY at the top starts it. Double-click plays too.
   - Drag = just pick it up and move it. Drop it on another game = make a folder. Drop on a folder = put it in.
   - Sort buttons (remembered), search, hidden games at the bottom. */
import { h, css, fmtAgo, fmtPlay, fmtDate } from './dom.js';
import { icon, iconUrl } from './icons.js';
import { St, isRunning, onState, loadLibrary } from './state.js';
import { Sound } from './sound.js';
import { moveFocus, setFocus, focusables } from './input.js';
import { Bg } from './bg.js';
import { Music } from './music.js';
import { prompt, menu } from './modal.js';

const SORTS = [
  { k: 'recent', label: 'Recently played' },
  { k: 'played', label: 'Most played' },
  { k: 'az', label: 'A to Z' },
  { k: 'new', label: 'Newest' },
  { k: 'custom', label: 'My order' }
];

export function makeLibrary(root, ctx) {
  let query = '';
  let tag = null;     /* tapped tag: only games with it */
  let folder = null;  /* open folder id */
  let selKey = null;  /* 'g:<id>' or 'f:<fid>' */
  let cur = null;     /* focused element */
  let visible = false;
  let drag = null;

  const playBtn = h('button.play-btn.primary.lib-play', { 'data-f': '', onclick: function () { playSelected(); } }, h('span', { html: icon('play') }), 'Play');
  const search = h('input.lib-search', { type: 'text', placeholder: 'Search', 'data-f': '', spellcheck: 'false', style: { backgroundImage: iconUrl('search') } });
  const chips = h('div.chips');
  const head = h('div.lib-head', h('h2', 'Game Library'), chips, search, playBtn);
  const body = h('div.lib-body');
  root.appendChild(head);
  root.appendChild(body);

  search.addEventListener('input', function () { query = search.value.trim().toLowerCase(); renderBody(); });

  function renderChips() {
    chips.textContent = '';
    SORTS.forEach(function (s) {
      const c = h('button.chip' + (St.prefs.sort === s.k ? '.on' : ''), { 'data-f': '', dataset: { sort: s.k }, onclick: function () { setSort(s.k); } }, s.label);
      chips.appendChild(c);
    });
  }

  function setSort(k) {
    if (St.prefs.sort === k) return;
    St.prefs.sort = k;
    window.gs.invoke('lib:prefs', { sort: k });
    Sound.move();
    folder = null;
    renderChips();
    renderBody();
    const c = chips.querySelector('[data-sort="' + k + '"]');
    if (c) cur = setFocus(root, c);
  }

  /* ---------- what to show ---------- */
  function games() { return Array.from(St.games.values()); }
  function sorted(list) {
    const s = St.prefs.sort;
    const by = {
      recent: function (a, b) { return Math.max(b.lastPlayed, b.added) - Math.max(a.lastPlayed, a.added); },
      played: function (a, b) { return b.playTime - a.playTime || b.lastPlayed - a.lastPlayed; },
      az: function (a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }); },
      new: function (a, b) { return b.added - a.added; }
    }[s];
    return by ? list.slice().sort(by) : list;
  }
  function folderById(fid) { return St.layout.find(function (e) { return typeof e === 'object' && e.f === fid; }) || null; }

  /* entries: {key, g} or {key, folder} */
  function entries() {
    if (tag && !folder) {
      return sorted(games().filter(function (g) { return !g.hidden && (g.tags || []).indexOf(tag) >= 0 && (!query || g.name.toLowerCase().indexOf(query) >= 0); })).map(function (g) { return { key: 'g:' + g.id, g: g }; });
    }
    if (query) {
      return sorted(games().filter(function (g) { return g.name.toLowerCase().indexOf(query) >= 0; })).map(function (g) { return { key: 'g:' + g.id, g: g }; });
    }
    if (folder) {
      const f = folderById(folder);
      if (!f) { folder = null; return entries(); }
      return f.items.map(function (id) { return St.games.get(id); }).filter(function (g) { return g && !g.hidden; }).map(function (g) { return { key: 'g:' + g.id, g: g }; });
    }
    if (St.prefs.sort === 'custom') {
      const out = [];
      St.layout.forEach(function (e) {
        if (typeof e === 'string') { const g = St.games.get(e); if (g && !g.hidden) out.push({ key: 'g:' + g.id, g: g }); }
        else {
          const items = e.items.map(function (id) { return St.games.get(id); }).filter(function (g) { return g && !g.hidden; });
          if (items.length) out.push({ key: 'f:' + e.f, folder: e, items: items });
        }
      });
      return out;
    }
    return sorted(games().filter(function (g) { return !g.hidden; })).map(function (g) { return { key: 'g:' + g.id, g: g }; });
  }

  function subFor(g) {
    if (St.active === g.id) return 'Playing now';
    if (isRunning(g.id)) return 'Quick Resume';
    if (St.missing.has(g.id)) return 'Folder missing';
    const s = St.prefs.sort;
    if (s === 'played') return g.playTime ? fmtPlay(g.playTime) : 'Not played yet';
    if (s === 'new') return 'Added ' + fmtAgo(g.added).toLowerCase();
    if (g.kind === 'app') return 'App';
    return g.lastPlayed ? fmtAgo(g.lastPlayed) : 'Not played yet';
  }

  function cellFor(en) {
    let el;
    if (en.g) {
      const g = en.g;
      const art = h('div.art', { style: { backgroundImage: css(g.cover) } });
      if (!g.cover) art.appendChild(h('div.noart', g.name));
      el = h('div.gcell', { 'data-f': '', dataset: { key: en.key } }, art, h('div.name', g.name), h('div.sub', subFor(g)));
      if (isRunning(g.id)) art.appendChild(h('div.badge', St.active === g.id ? 'Playing' : 'Resume'));
    } else {
      const f = en.folder;
      const art = h('div.art');
      en.items.slice(0, 4).forEach(function (g) { art.appendChild(h('div.mini', { style: { backgroundImage: css(g.cover) } })); });
      for (let i = en.items.length; i < 4; i++) art.appendChild(h('div.mini', { style: { opacity: '.35' } }));
      art.appendChild(h('div.count', String(en.items.length)));
      el = h('div.gcell.folder', { 'data-f': '', dataset: { key: en.key } }, art, h('div.name', f.name), h('div.sub', en.items.length + (en.items.length === 1 ? ' game' : ' games')));
    }
    if (en.key === selKey) el.classList.add('sel');
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('click', function () { if (drag && drag.moved) return; pick(en.key, el); });
    el.addEventListener('dblclick', function () { activate(en.key, el); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); pick(en.key, el); options(en.key); });
    return el;
  }

  /* the auto tags (3D, FNF, Shooter...) with how many games have each; tap = only those, tap again = all */
  function tagRow() {
    const count = {};
    games().forEach(function (g) { if (!g.hidden) (g.tags || []).forEach(function (t) { count[t] = (count[t] || 0) + 1; }); });
    const list = Object.keys(count).sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b); });
    if (tag && !count[tag]) tag = null;
    if (!list.length) return null;
    const row = h('div.chips.tag-chips');
    list.forEach(function (t) {
      row.appendChild(h('button.chip' + (tag === t ? '.on' : ''), { 'data-f': '', dataset: { tag: t }, onclick: function () {
        tag = tag === t ? null : t;
        Sound.move();
        renderBody();
        const c = body.querySelector('[data-tag="' + t + '"]');
        if (c) cur = setFocus(root, c);
      } }, t, h('span.n', String(count[t]))));
    });
    return row;
  }

  function renderBody() {
    body.textContent = '';
    if (!folder) { const tr = tagRow(); if (tr) body.appendChild(tr); }
    const list = entries();
    if (folder) {
      const f = folderById(folder);
      const back = h('button.btn', { 'data-f': '', onclick: closeFolder }, h('span', { html: icon('back') }), 'Back');
      const ren = h('button.btn', { 'data-f': '', onclick: function () { renameFolder(folder); } }, h('span', { html: icon('edit') }), 'Rename');
      body.appendChild(h('div.folder-bar', back, h('h3', f ? f.name : 'Folder'), ren));
      body.appendChild(h('div.takeout', { hidden: true }, 'Drop here to take it out of the folder'));
    }
    if (!list.length) {
      body.appendChild(h('div.empty', h('b', query ? 'Nothing called "' + search.value + '"' : tag ? 'No ' + tag + ' games' : 'No games here yet'),
        query ? 'Try another word.' : 'Drop .html files, .zip files or game folders anywhere on this screen.'));
    }
    const grid = h('div.grid');
    list.forEach(function (en) { grid.appendChild(cellFor(en)); });
    body.appendChild(grid);

    /* hidden games */
    const hidden = games().filter(function (g) { return g.hidden; });
    if (!folder && !query && hidden.length) {
      const open = !!St.prefs.hiddenOpen;
      const tbtn = h('button', { 'data-f': '', onclick: function () {
        St.prefs.hiddenOpen = !open;
        window.gs.invoke('lib:prefs', { hiddenOpen: !open });
        Sound.move();
        renderBody();
      } }, h('span', { html: icon(open ? 'eye' : 'eyeOff') }), (open ? 'Hide' : 'Show') + ' hidden games (' + hidden.length + ')');
      body.appendChild(h('div.section-title', tbtn));
      if (open) {
        const hg = h('div.grid');
        sorted(hidden).forEach(function (g) {
          const c = cellFor({ key: 'g:' + g.id, g: g });
          c.dataset.hidden = '1';
          hg.appendChild(c);
        });
        body.appendChild(hg);
      }
    }
    updatePlay();
    if (cur && !root.contains(cur)) cur = null;
    const keep = selKey && body.querySelector('[data-key="' + selKey + '"]');
    if (keep && (!cur || !head.contains(cur))) cur = setFocus(root, keep);
  }

  function updatePlay() {
    const g = selKey && selKey.startsWith('g:') ? St.games.get(selKey.slice(2)) : null;
    playBtn.disabled = !g;
    playBtn.innerHTML = '';
    playBtn.appendChild(h('span', { html: icon(g && isRunning(g.id) ? 'resume' : 'play') }));
    playBtn.appendChild(document.createTextNode(g ? (isRunning(g.id) ? 'Resume' : 'Play') : 'Pick a game'));
    Bg.set(null);   /* like a real console's game library: its own background, not the game's art */
  }

  /* ---------- picking + playing ---------- */
  function pick(key, el) {
    if (selKey !== key) Sound.move();
    selKey = key;
    body.querySelectorAll('.gcell.sel').forEach(function (x) { x.classList.remove('sel'); });
    if (el) { el.classList.add('sel'); cur = setFocus(root, el); }
    updatePlay();
  }
  function activate(key, el) {
    if (key.startsWith('f:')) { Sound.press(); openFolder(key.slice(2)); return; }
    ctx.play(key.slice(2), el && el.querySelector('.art'));
  }
  function playSelected() {
    if (!selKey) return;
    const el = body.querySelector('[data-key="' + selKey + '"]');
    activate(selKey, el);
  }
  function options(key) {
    if (key.startsWith('g:')) { Sound.open(); ctx.options(key.slice(2)); return; }
    const fid = key.slice(2);
    menu(folderById(fid) ? folderById(fid).name : 'Folder', [
      { label: 'Open', icon: 'folderOpen', onClick: function () { openFolder(fid); } },
      { label: 'Rename', icon: 'edit', onClick: function () { renameFolder(fid); } },
      { label: 'Take everything out', icon: 'box', onClick: function () { ungroup(fid); } }
    ]);
  }
  function openFolder(fid) { folder = fid; selKey = null; cur = null; renderBody(); const first = body.querySelector('.gcell'); if (first) pick(first.dataset.key, first); }
  function closeFolder() {
    const was = folder;
    folder = null;
    Sound.back();
    selKey = 'f:' + was;
    renderBody();
  }

  /* ---------- layout changes ---------- */
  function cloneLayout() { return St.layout.map(function (e) { return typeof e === 'string' ? e : { f: e.f, name: e.name, items: e.items.slice() }; }); }
  async function saveLayout(layout) {
    St.layout = layout;
    await window.gs.invoke('lib:layout', layout);
    await loadLibrary();
  }
  function removeId(layout, id) {
    return layout.map(function (e) {
      if (typeof e === 'string') return e === id ? null : e;
      e.items = e.items.filter(function (x) { return x !== id; });
      return e;
    }).filter(Boolean);
  }
  async function renameFolder(fid) {
    const f = folderById(fid);
    if (!f) return;
    const name = await prompt({ title: 'Folder name', value: f.name, ok: 'Save' });
    if (!name) return;
    const l = cloneLayout();
    l.forEach(function (e) { if (typeof e === 'object' && e.f === fid) e.name = name.slice(0, 60); });
    await saveLayout(l);
  }
  async function ungroup(fid) {
    const l = cloneLayout();
    const i = l.findIndex(function (e) { return typeof e === 'object' && e.f === fid; });
    if (i < 0) return;
    const items = l[i].items;
    l.splice.apply(l, [i, 1].concat(items));
    if (folder === fid) folder = null;
    await saveLayout(l);
  }
  async function makeFolder(dragId, ontoKey) {
    let l = removeId(cloneLayout(), dragId);
    if (ontoKey.startsWith('f:')) {
      l.forEach(function (e) { if (typeof e === 'object' && e.f === ontoKey.slice(2)) e.items.push(dragId); });
      await saveLayout(l);
      ctx.toast({ kind: 'good', text: 'Put in ' + (folderById(ontoKey.slice(2)) || { name: 'the folder' }).name });
      return;
    }
    const onto = ontoKey.slice(2);
    const fid = Math.random().toString(36).slice(2, 8);
    const i = l.indexOf(onto);
    if (i < 0) return;
    l[i] = { f: fid, name: 'New folder', items: [onto, dragId] };
    await saveLayout(l);
    selKey = 'f:' + fid;
    renderBody();
    const name = await prompt({ title: 'Name the folder', value: 'New folder', ok: 'Save' });
    if (name) {
      const l2 = cloneLayout();
      l2.forEach(function (e) { if (typeof e === 'object' && e.f === fid) e.name = name.slice(0, 60); });
      await saveLayout(l2);
    }
  }
  /* the new order is whatever order the tiles are in on screen now */
  async function commitOrder() {
    const grid = body.querySelector('.grid');
    const keys = Array.from(grid ? grid.querySelectorAll('.gcell') : []).filter(function (c) { return !c.dataset.hidden; }).map(function (c) { return c.dataset.key; });
    let l = cloneLayout();
    if (folder) {
      l.forEach(function (e) {
        if (typeof e === 'object' && e.f === folder) {
          const vis = keys.map(function (k) { return k.slice(2); });
          const rest = e.items.filter(function (x) { return vis.indexOf(x) < 0; });
          e.items = vis.concat(rest);
        }
      });
    } else {
      const byKey = {};
      l.forEach(function (e) { byKey[typeof e === 'string' ? 'g:' + e : 'f:' + e.f] = e; });
      const used = new Set();
      const next = [];
      keys.forEach(function (k) { if (byKey[k]) { next.push(byKey[k]); used.add(k); } });
      l.forEach(function (e) { const k = typeof e === 'string' ? 'g:' + e : 'f:' + e.f; if (!used.has(k)) next.push(e); });
      l = next;
    }
    await saveLayout(l);
  }
  async function takeOut(id) {
    let l = cloneLayout();
    const fi = l.findIndex(function (e) { return typeof e === 'object' && e.f === folder; });
    l = removeId(l, id);
    const nf = l.findIndex(function (e) { return typeof e === 'object' && e.f === folder; });
    l.splice(nf >= 0 ? nf + 1 : Math.max(0, fi), 0, id);
    await saveLayout(l);
    ctx.toast({ kind: 'good', text: 'Took it out of the folder' });
  }

  /* ---------- dragging: hold and move, that's it ---------- */
  function onDown(e) {
    if (e.button !== 0 || query) return;
    const cell = e.currentTarget;
    if (cell.dataset.hidden) return;
    drag = { cell: cell, key: cell.dataset.key, x: e.clientX, y: e.clientY, moved: false, pid: e.pointerId };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }
  function startDrag() {
    if (St.prefs.sort !== 'custom' && !folder) {
      /* moving games only makes sense in your own order */
      St.prefs.sort = 'custom';
      window.gs.invoke('lib:prefs', { sort: 'custom' });
      renderChips();
      const key = drag.key;
      renderBody();
      const cell = body.querySelector('[data-key="' + key + '"]');
      if (!cell) { drag = null; return false; }
      drag.cell = cell;
      ctx.toast({ text: 'Switched to My order so you can move games around' });
    }
    drag.moved = true;
    const art = drag.cell.querySelector('.art').cloneNode(true);
    art.querySelectorAll('.badge').forEach(function (b) { b.remove(); });
    drag.ghost = h('div.drag-ghost', art);
    if (drag.cell.classList.contains('folder')) { drag.ghost.querySelector('.art').style.display = 'grid'; }
    document.body.appendChild(drag.ghost);
    drag.cell.classList.add('placeholder');
    const t = body.querySelector('.takeout');
    if (t && drag.key.startsWith('g:')) t.hidden = false;
    pick(drag.key, drag.cell);
    return true;
  }
  function flip(fn) {
    const cells = Array.from(body.querySelectorAll('.grid .gcell'));
    const before = new Map(cells.map(function (c) { return [c, c.getBoundingClientRect()]; }));
    fn();
    cells.forEach(function (c) {
      const a = before.get(c);
      const b = c.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 160, easing: 'cubic-bezier(.22,.8,.24,1)' });
    });
  }
  function onMove(e) {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return;
      if (startDrag() === false) return;
    }
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    /* scroll when near the edges */
    const br = body.getBoundingClientRect();
    drag.scroll = e.clientY < br.top + 60 ? -1 : e.clientY > br.bottom - 60 ? 1 : 0;
    if (drag.scroll && !drag.scrollT) {
      drag.scrollT = setInterval(function () { if (drag && drag.scroll) body.scrollTop += drag.scroll * 14; }, 16);
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const t = body.querySelector('.takeout');
    if (t) t.classList.toggle('hot', !!(under && t.contains(under)));
    const cell = under && under.closest('.gcell');
    const old = body.querySelector('.gcell.target');
    if (!cell || cell === drag.cell || cell.dataset.hidden) {
      if (old) old.classList.remove('target');
      clearTimeout(drag.dwell);
      drag.dwellOn = null;
      return;
    }
    const r = cell.querySelector('.art').getBoundingClientRect();
    const inX = (e.clientX - r.left) / r.width, inY = (e.clientY - r.top) / r.height;
    const canFolder = drag.key.startsWith('g:') && !folder;
    const middle = canFolder && inX > 0.24 && inX < 0.76 && inY > 0.15 && inY < 0.9;
    if (middle) {
      if (drag.dwellOn !== cell) {
        if (old) old.classList.remove('target');
        clearTimeout(drag.dwell);
        drag.dwellOn = cell;
        /* hold over it for a moment = folder (so just passing over doesn't make one) */
        drag.dwell = setTimeout(function () { if (drag && drag.dwellOn === cell) { cell.classList.add('target'); Sound.move(); } }, 380);
      }
      return;
    }
    if (old) old.classList.remove('target');
    clearTimeout(drag.dwell);
    drag.dwellOn = null;
    const after = inX >= 0.5;
    const ref = after ? cell.nextSibling : cell;
    if (ref === drag.cell || drag.cell.nextSibling === ref) return;
    flip(function () { cell.parentNode.insertBefore(drag.cell, ref); });
  }
  function cleanup() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    if (!drag) return;
    clearInterval(drag.scrollT);
    clearTimeout(drag.dwell);
    if (drag.ghost) drag.ghost.remove();
    if (drag.cell) drag.cell.classList.remove('placeholder');
  }
  async function onUp(e) {
    const d = drag;
    cleanup();
    if (!d || !d.moved) { drag = null; return; }
    setTimeout(function () { drag = null; }, 0);
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const t = body.querySelector('.takeout');
    const target = body.querySelector('.gcell.target');
    Sound.press();
    if (t && under && t.contains(under) && d.key.startsWith('g:')) { await takeOut(d.key.slice(2)); return; }
    if (target) { target.classList.remove('target'); await makeFolder(d.key.slice(2), target.dataset.key); return; }
    await commitOrder();
  }
  function onCancel() { cleanup(); drag = null; renderBody(); }

  /* ---------- keys ---------- */
  function key(action) {
    if (drag && drag.moved) { if (action === 'back') { onCancel(); return true; } return true; }
    if (!cur || !root.contains(cur)) cur = setFocus(root, body.querySelector('.gcell.sel') || body.querySelector('.gcell') || chips.firstChild);
    if (/^(up|down|left|right)$/.test(action)) {
      if (cur === search && (action === 'left' || action === 'right')) return true;
      const next = moveFocus(root, cur, action);
      if (!next) return action === 'up' ? false : true;
      cur = setFocus(root, next);
      Sound.move();
      if (next.classList.contains('gcell')) pick(next.dataset.key, next);
      return true;
    }
    if (action === 'ok') {
      if (cur.classList.contains('gcell')) activate(cur.dataset.key, cur);
      else if (cur === search) { const first = body.querySelector('.gcell'); if (first) { pick(first.dataset.key, first); } }
      else cur.click();
      return true;
    }
    if (action === 'options') { if (selKey) options(selKey); return true; }
    if (action === 'back') {
      if (cur === search && query) { search.value = ''; query = ''; renderBody(); return true; }
      if (folder) { closeFolder(); return true; }
      return false;
    }
    if (action === 'prev' || action === 'next') {
      const i = SORTS.findIndex(function (s) { return s.k === St.prefs.sort; });
      const n = SORTS[(i + (action === 'next' ? 1 : SORTS.length - 1)) % SORTS.length];
      setSort(n.k);
      return true;
    }
    return true;
  }

  onState(function (what) {
    if (!visible || (drag && drag.moved)) return;
    if (what === 'lib' || what === 'running') { renderChips(); renderBody(); }
  });

  return {
    show: function (opts) {
      visible = true;
      root.hidden = false;
      if (opts && opts.search) { query = ''; search.value = ''; }
      renderChips();
      renderBody();
      if (opts && opts.search) { cur = setFocus(root, search); }
      else {
        const first = body.querySelector('.gcell.sel') || body.querySelector('.gcell');
        if (first) pick(first.dataset.key, first); else cur = setFocus(root, chips.firstChild);
      }
    },
    hide: function () { visible = false; root.hidden = true; if (drag) onCancel(); },
    key: key,
    blur: function () { root.querySelectorAll('.focus').forEach(function (x) { x.classList.remove('focus'); }); cur = null; },
    takeFocus: function () { cur = setFocus(root, body.querySelector('.gcell.sel') || chips.firstChild); }
  };
}
