/* Saved Data (PS5-style): every game's own saves, how big, when they changed, back up / restore / delete. */
import { h, css, fmtBytes, fmtAgo, fmtDate } from './dom.js';
import { icon, iconUrl } from './icons.js';
import { St, onState } from './state.js';
import { Sound } from './sound.js';
import { moveFocus, setFocus } from './input.js';
import { confirm, modal } from './modal.js';

export function makeSaved(root, ctx) {
  let sizes = new Map();
  let selId = null;
  let cur = null;
  let visible = false;
  let q = '';

  const search = h('input.search-box', { type: 'text', placeholder: 'Find a game', 'data-f': '', spellcheck: 'false', style: { backgroundImage: iconUrl('search') } });
  const listBox = h('div');
  const side = h('div.side', h('h2', 'Saved Data'), search, listBox);
  const main = h('div.main-panel');
  root.appendChild(h('div.split', side, main));
  search.addEventListener('input', function () { q = search.value.trim().toLowerCase(); renderList(); });

  async function load() {
    const all = await window.gs.invoke('saves:all');
    sizes = new Map((all || []).map(function (x) { return [x.id, x.size]; }));
    renderList();
    renderMain();
  }

  function games() {
    return Array.from(St.games.values())
      .filter(function (g) { return !q || g.name.toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (sizes.get(b.id) || 0) - (sizes.get(a.id) || 0) || a.name.localeCompare(b.name); });
  }

  function renderList() {
    listBox.textContent = '';
    const list = games();
    if (!selId && list.length) selId = list[0].id;
    list.forEach(function (g) {
      const size = sizes.get(g.id) || 0;
      const b = h('button.side-item' + (g.id === selId ? '.on' : ''), { 'data-f': '', dataset: { id: g.id }, onclick: function () { choose(g.id, b); } },
        h('div.thumb', { style: { backgroundImage: css(g.cover) } }),
        h('div.meta', h('div.t', g.name), h('div.s', size ? fmtBytes(size) : 'No saves')));
      listBox.appendChild(b);
    });
    if (!list.length) listBox.appendChild(h('div.dim', { style: { padding: '12px' } }, 'No games yet.'));
  }

  function choose(id, el) {
    if (selId !== id) Sound.move();
    selId = id;
    listBox.querySelectorAll('.side-item').forEach(function (x) { x.classList.toggle('on', x.dataset.id === id); });
    if (el) cur = setFocus(root, el);
    renderMain();
  }

  async function renderMain() {
    main.textContent = '';
    const g = St.games.get(selId);
    if (!g) { main.appendChild(h('p.lead', 'Pick a game on the left.')); return; }
    const pic = h('div.pic', { style: { backgroundImage: css(g.cover) } });
    const title = h('div', h('h3', g.name), h('p.lead', 'Everything this game saves lives in its own save space on your PC, so it never gets lost or mixed up with other games.'));
    main.appendChild(h('div.save-hero', pic, title));
    const facts = h('div.facts');
    main.appendChild(facts);
    const btns = h('div.btns');
    main.appendChild(btns);
    const listEl = h('div.list');
    main.appendChild(listEl);
    const info = await window.gs.invoke('saves:info', g.id);
    if (selId !== g.id) return;
    const fact = function (k, v) { facts.appendChild(h('div.fact', h('div.k', k), h('div.v', v))); };
    fact('Size', info.size ? fmtBytes(info.size) : 'Empty');
    fact('Last saved', info.changed ? fmtAgo(info.changed) : 'Never');
    fact('Last played', g.lastPlayed ? fmtAgo(g.lastPlayed) : 'Never');
    fact('Backups', String(info.backups.length));
    const backup = h('button.btn.primary', { 'data-f': '', disabled: !info.size, onclick: async function () {
      Sound.press();
      backup.disabled = true;
      const f = await window.gs.invoke('saves:backup', g.id);
      if (f && typeof f === 'string') ctx.toast({ kind: 'good', icon: 'save', title: 'Backed up', text: g.name });
      else ctx.toast({ kind: 'warn', text: 'There was nothing to back up yet.' });
      renderMain();
    } }, h('span', { html: icon('save') }), 'Back up now');
    const del = h('button.btn.danger', { 'data-f': '', disabled: !info.size, onclick: async function () {
      const ok = await confirm({ title: 'Delete the saved data of ' + g.name + '?', text: 'Its progress starts over. Backups you made stay in the Backups folder, so you can bring it back.', yes: 'Delete', danger: true });
      if (!ok) return;
      await window.gs.invoke('saves:backup', g.id).catch(function () {});
      await window.gs.invoke('saves:remove', g.id);
      ctx.toast({ kind: 'good', text: 'Deleted. A last backup was made just in case.' });
      ctx.savesChanged(g.id);
      load();
    } }, h('span', { html: icon('trash') }), 'Delete');
    const folder = h('button.btn', { 'data-f': '', onclick: function () { window.gs.invoke('shell:open', 'backups'); } }, h('span', { html: icon('folder') }), 'Backups folder');
    btns.appendChild(backup);
    btns.appendChild(del);
    btns.appendChild(folder);
    if (info.backups.length) {
      listEl.appendChild(h('div.cgroup', 'Backups'));
      info.backups.slice(0, 12).forEach(function (b) {
        const restore = h('button.btn', { 'data-f': '', onclick: async function () {
          const ok = await confirm({
            title: 'Go back to this save?',
            text: g.name + ' goes back to how it was on ' + fmtDate(b.at) + '. Game System 3 restarts to do it (your other Quick Resume games are saved first).',
            yes: 'Restore and restart'
          });
          if (!ok) return;
          await window.gs.invoke('saves:backup', g.id).catch(function () {});
          await window.gs.invoke('saves:restore', g.id, b.file);
          window.gs.invoke('power:restart');
        } }, h('span', { html: icon('history') }), 'Restore');
        listEl.appendChild(h('div.list-row', h('div.grow', h('div', fmtDate(b.at)), h('div.s', (b.auto ? 'Automatic' : 'Made by you') + ' · ' + fmtBytes(b.size))), restore));
      });
    }
  }

  function key(action) {
    if (!cur || !root.contains(cur)) cur = setFocus(root, listBox.querySelector('.side-item.on') || search);
    if (/^(up|down|left|right)$/.test(action)) {
      const next = moveFocus(root, cur, action);
      if (!next) return action === 'up' ? false : true;
      cur = setFocus(root, next);
      Sound.move();
      if (next.classList.contains('side-item')) choose(next.dataset.id, next);
      return true;
    }
    if (action === 'ok') { if (cur && cur !== search) cur.click(); return true; }
    if (action === 'back') return false;
    return true;
  }

  onState(function (w) { if (visible && w === 'lib') load(); });

  return {
    show: function (id) {
      visible = true;
      root.hidden = false;
      if (id) selId = id;
      load().then(function () {
        const el = listBox.querySelector('.side-item.on');
        if (el) { cur = setFocus(root, el); el.scrollIntoView({ block: 'center' }); }
      });
    },
    hide: function () { visible = false; root.hidden = true; },
    key: key,
    blur: function () { root.querySelectorAll('.focus').forEach(function (x) { x.classList.remove('focus'); }); cur = null; },
    takeFocus: function () { cur = setFocus(root, listBox.querySelector('.side-item.on') || search); }
  };
}
