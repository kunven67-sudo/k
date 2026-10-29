/* BACKPACK: get disk space back. Clean up junk, find what's big (search + filters), pack folders smaller,
   move Game System 3 out of OneDrive. Videos are protected: BACKPACK never deletes them. */
import { h, fmtBytes } from './dom.js';
import { icon } from './icons.js';
import { modal, confirm } from './modal.js';
import { Sound } from './sound.js';

const KINDS = [['all', 'Everything'], ['video', 'Videos'], ['game', 'Game files'], ['installer', 'Installers'], ['archive', 'Zips + disk images'], ['picture', 'Pictures'], ['music', 'Music'], ['other', 'Other']];

export function openBackpack(toast) {
  let tab = 'clean';
  let scan = null, scanDir = null, kind = 'all', query = '', scanning = false;
  const drives = h('div.bp-drives');
  const od = h('div');
  const tabs = h('div.chips.bp-tabs');
  const body = h('div.bp-body');
  const off = window.gs.on('storage:progress', function (p) { const s = body.querySelector('.bp-scanning'); if (s) s.textContent = 'Looking… ' + p.seen.toLocaleString() + ' files, ' + fmtBytes(p.total) + ' so far'; });

  async function loadDrives() {
    const list = await window.gs.invoke('storage:drives');
    drives.textContent = '';
    (list || []).forEach(function (d) {
      const used = d.size - d.free, pct = d.size ? Math.round(used / d.size * 100) : 0;
      drives.appendChild(h('div.bp-drive' + (pct >= 90 ? '.full' : ''),
        h('div.bp-dl', h('b', d.name + (d.label ? ' ' + d.label : '')), h('span', fmtBytes(d.free) + ' free of ' + fmtBytes(d.size))),
        h('div.bp-bar', h('i', { style: { width: pct + '%' } })), h('div.bp-pct', pct + '% full')));
    });
  }
  async function loadOneDrive() {
    const r = await window.gs.invoke('storage:gs3');
    od.textContent = '';
    if (!r || !r.inOneDrive) return;
    od.appendChild(h('div.bp-card',
      h('div', h('b', 'Game System 3 is inside OneDrive'), h('div.d', 'So OneDrive uploads every game, save and backup (' + fmtBytes(r.size) + '). Moving it to ' + r.safe + ' stops that. Your games and saves come with it. Game System 3 restarts to do it.')),
      h('button.btn.primary', { 'data-f': '', onclick: async function () {
        const ok = await confirm({ title: 'Move Game System 3 out of OneDrive?', text: 'Everything moves to ' + r.safe + '. It restarts and takes a few seconds. After that, you can delete the old copy from OneDrive online to free your OneDrive space too.', yes: 'Move it' });
        if (ok) window.gs.invoke('storage:move-gs3');
      } }, h('span', { html: icon('upload') }), 'Move it out')));
  }

  function renderTabs() {
    tabs.textContent = '';
    [['clean', 'Clean up'], ['big', 'What\'s big'], ['pack', 'Pack']].forEach(function (t) {
      tabs.appendChild(h('button.chip' + (tab === t[0] ? '.on' : ''), { 'data-f': '', dataset: { tab: t[0] }, onclick: function () { tab = t[0]; Sound.move(); renderTabs(); render(); } }, t[1]));
    });
  }

  /* ---------- clean up ---------- */
  async function renderClean() {
    body.textContent = '';
    body.appendChild(h('div.bp-scanning', 'Measuring the junk…'));
    const list = await window.gs.invoke('storage:junk');
    if (tab !== 'clean') return;
    body.textContent = '';
    const picked = new Set(list.filter(function (j) { return j.on && j.size > 0; }).map(function (j) { return j.key; }));
    const total = function () { return list.filter(function (j) { return picked.has(j.key); }).reduce(function (a, j) { return a + j.size; }, 0); };
    const go = h('button.btn.primary.bp-go', { 'data-f': '' });
    const label = function () { go.textContent = ''; go.append(h('span', { html: icon('trash') }), 'Clean ' + fmtBytes(total())); go.disabled = !total(); };
    list.forEach(function (j) {
      const sw = h('div.switch' + (picked.has(j.key) ? '.on' : ''));
      const row = h('div.set.bp-row', { 'data-f': '', dataset: { junk: j.key } }, h('div.txt', h('div.t', j.name), h('div.d', j.desc)), h('div.bp-size', j.size ? fmtBytes(j.size) : 'Nothing'), sw);
      row.addEventListener('click', function () {
        if (!j.size) return;
        Sound.move();
        if (picked.has(j.key)) picked.delete(j.key); else picked.add(j.key);
        sw.classList.toggle('on', picked.has(j.key));
        label();
      });
      body.appendChild(row);
    });
    go.addEventListener('click', async function () {
      if (!total()) return;
      Sound.press();
      go.disabled = true;
      go.textContent = 'Cleaning…';
      const r = await window.gs.invoke('storage:clean', Array.from(picked));
      if (toast) toast({ kind: 'good', icon: 'trash', title: 'Cleaned up', text: fmtBytes(r.freed) + ' of space is back.' });
      loadDrives();
      renderClean();
    });
    label();
    body.appendChild(h('div.bp-foot', h('div.d', 'Your videos, pictures, documents, games and saves are never touched here.'), go));
    m.refocus();
  }

  /* ---------- what's big ---------- */
  async function startScan(dir) {
    scanDir = dir || null;
    scan = null;
    scanning = true;
    renderBig();
    const r = await window.gs.invoke('storage:scan', scanDir);
    scanning = false;
    if (r) { scan = r; scanDir = r.dir; }
    if (tab === 'big') renderBig();
  }
  function renderBig() {
    body.textContent = '';
    const where = h('div.bp-where', h('span', { html: icon('folder') }), h('b', scanDir || 'Your user folder'),
      h('button.btn', { 'data-f': '', onclick: async function () { const d = await window.gs.invoke('storage:pickdir'); if (d) startScan(d); } }, 'Look somewhere else'));
    body.appendChild(where);
    if (scanning || !scan) { body.appendChild(h('div.bp-scanning', 'Looking…')); return; }
    const search = h('input.lib-search.bp-search', { type: 'text', placeholder: 'Search files', 'data-f': '', value: query, spellcheck: 'false' });
    search.addEventListener('input', function () { query = search.value.trim().toLowerCase(); renderFiles(); });
    const chips = h('div.chips.bp-kinds');
    KINDS.forEach(function (k) {
      const n = k[0] === 'all' ? scan.total : (scan.kinds[k[0]] || 0);
      if (k[0] !== 'all' && !n) return;
      chips.appendChild(h('button.chip' + (kind === k[0] ? '.on' : ''), { 'data-f': '', onclick: function () { kind = k[0]; Sound.move(); renderBig(); } }, k[1], h('span.n', fmtBytes(n))));
    });
    body.append(h('div.bp-tools', search), chips);
    const folders = h('div.bp-list');
    scan.folders.slice(0, 12).forEach(function (f) {
      folders.appendChild(h('div.bp-file', { 'data-f': '', onclick: function () { Sound.press(); startScan(f.dir); } },
        h('span.ic', { html: icon('folder') }), h('div.nm', f.name), h('div.bp-size', fmtBytes(f.size)), h('span.go', { html: icon('arrowRight') })));
    });
    body.append(h('div.cgroup', 'Biggest folders (tap to look inside)'), folders, h('div.cgroup', 'Biggest files'));
    const files = h('div.bp-list.files');
    body.appendChild(files);
    function renderFiles() {
      files.textContent = '';
      const list = scan.files.filter(function (f) { return (kind === 'all' || f.kind === kind) && (!query || f.name.toLowerCase().indexOf(query) >= 0); }).slice(0, 120);
      if (!list.length) files.appendChild(h('div.gp-empty', 'Nothing here.'));
      list.forEach(function (f) {
        const video = f.kind === 'video';
        const row = h('div.bp-file',
          h('span.ic', { html: icon(video ? 'camera' : f.kind === 'installer' ? 'download' : f.kind === 'archive' ? 'box' : f.kind === 'picture' ? 'image' : f.kind === 'music' ? 'music' : 'save') }),
          h('div.nm', f.name, h('span.p', f.file)),
          h('div.bp-size', fmtBytes(f.size)),
          h('button.btn', { 'data-f': '', title: 'Show in its folder', onclick: function () { window.gs.invoke('storage:show', f.file); } }, h('span', { html: icon('folderOpen') })),
          video ? h('div.bp-lock', { title: 'Your video: BACKPACK never deletes videos' }, h('span', { html: icon('shield') }), 'Protected')
            : h('button.btn.danger', { 'data-f': '', onclick: async function () {
              const ok = await confirm({ title: 'Delete ' + f.name + '?', text: 'It\'s deleted for good (not the Recycle Bin), so ' + fmtBytes(f.size) + ' comes back right away.', yes: 'Delete', danger: true });
              if (!ok) return;
              const r = await window.gs.invoke('storage:remove', f.file);
              if (r && r.ok) { scan.files = scan.files.filter(function (x) { return x !== f; }); scan.total -= f.size; renderFiles(); loadDrives(); if (toast) toast({ kind: 'good', text: 'Deleted ' + f.name + ' (' + fmtBytes(f.size) + ')' }); }
              else if (toast) toast({ kind: 'warn', text: 'Couldn\'t delete it (it\'s in use, or it\'s outside your user folder).' });
            } }, h('span', { html: icon('trash') })));
        files.appendChild(row);
      });
    }
    renderFiles();
    m.refocus();
  }

  /* ---------- pack ---------- */
  function renderPack() {
    body.textContent = '';
    body.append(
      h('div.bp-card', h('div', h('b', 'Pack a folder: more space, nothing deleted'), h('div.d', 'Windows squeezes the files smaller and unsqueezes them by itself when they\'re used, so everything still works the same. Best for games and apps (often 30 to 60% smaller). Videos, pictures and music are already squeezed, so they don\'t get smaller.'))),
      h('div.bp-actions',
        h('button.btn.primary', { 'data-f': '', 'data-default': '', onclick: function () { pack(null); } }, h('span', { html: icon('box') }), 'Pack Game System 3\'s games'),
        h('button.btn', { 'data-f': '', onclick: async function () { const d = await window.gs.invoke('storage:pickdir'); if (d) pack(d); } }, h('span', { html: icon('folder') }), 'Pick a folder to pack')),
      h('div.bp-result'));
    m.refocus();
  }
  async function pack(dir) {
    const res = body.querySelector('.bp-result');
    if (!dir) { const r = await window.gs.invoke('storage:gs3'); dir = r.root + (r.root.indexOf('\\') >= 0 ? '\\' : '/') + 'Games'; }
    res.textContent = 'Packing ' + dir + '… (big folders take a few minutes, you can keep using your PC)';
    const r = await window.gs.invoke('storage:pack', dir);
    if (!r || !r.ok) { res.textContent = r && r.why === 'windows' ? 'Packing works on Windows only.' : 'Couldn\'t pack that folder (Windows may need admin for folders like Program Files).'; return; }
    res.textContent = r.before ? 'Packed: ' + fmtBytes(r.before) + ' now takes ' + fmtBytes(r.after) + '. You got ' + fmtBytes(Math.max(0, r.before - r.after)) + ' back.' : 'Packed.';
    loadDrives();
  }

  function render() { if (tab === 'clean') renderClean(); else if (tab === 'big') { if (!scan && !scanning) startScan(scanDir); else renderBig(); } else renderPack(); }

  const m = modal({
    title: 'BACKPACK', lead: 'Get space back without losing what matters. Your videos are protected: BACKPACK never deletes them.',
    body: h('div.bp', drives, od, tabs, body), wide: true,
    onClose: function () { if (off) off(); }
  });
  m.box.classList.add('bp-box');
  loadDrives();
  loadOneDrive();
  renderTabs();
  render();
  return m;
}
