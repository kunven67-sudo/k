/* Adding games (pick files / folder / paste a link / the Games folder), "Update it?",
   and bringing everything over from Game System 2. */
import { h, fmtDate } from './dom.js';
import { icon } from './icons.js';
import { modal, prompt } from './modal.js';
import { Sound } from './sound.js';
import { loadLibrary, St, setSetting } from './state.js';

let toast = function () {};
export function initAdd(t) { toast = t; }

/* after anything was added: say what happened, ask "Update it?" for games you already have */
export async function handleResults(results, opts) {
  results = results || [];
  const added = [];
  for (const r of results) {
    if (r.type === 'added') added.push(r);
    else if (r.type === 'gs2') { openGs2(r.file); }
    else if (r.type === 'same') {
      const choice = await askUpdate(r);
      const res = await window.gs.invoke('import:resolve', r.token, choice);
      if (res && res.type === 'updated') toast({ kind: 'good', title: 'Updated', text: r.name + ' (saves, play time and cover kept)' });
      else if (res && res.type === 'added') added.push(res);
    } else if (r.type === 'error') {
      toast({ kind: 'warn', title: 'Couldn\'t add ' + r.name, text: r.error, timeout: 6000 });
    }
  }
  await loadLibrary();
  if (added.length === 1) toast({ kind: 'good', title: 'Added', text: added[0].name + (added[0].online ? ' (plays online)' : '') });
  else if (added.length > 1) toast({ kind: 'good', title: 'Added ' + added.length + ' games', text: added.slice(0, 3).map(function (a) { return a.name; }).join(', ') + (added.length > 3 ? '…' : '') });
  if (added.length && St.settings.firstRun) setSetting({ firstRun: false });
  if (added.length && opts && opts.onAdded) opts.onAdded(added);
  return added;
}

function askUpdate(r) {
  return new Promise(function (resolve) {
    let val = 'skip';
    modal({
      title: 'Update ' + r.name + '?',
      lead: 'You already have a game called ' + r.name + '. Updating keeps its saves, play time, trophies and cover. The old version is kept for 7 days so you can go back.',
      onClose: function () { resolve(val); },
      actions: [
        { label: 'Skip', onClick: function () { val = 'skip'; } },
        { label: 'Add as a new game', onClick: function () { val = 'new'; } },
        { label: 'Update it', kind: 'primary', default: true, icon: 'upload', onClick: function () { val = 'update'; } }
      ]
    });
  });
}

export function openAdd() {
  let m = null;
  const opt = function (ic, t, d, fn) {
    return h('button.big-opt', { 'data-f': '', onclick: function () { Sound.press(); m.close(); fn(); } },
      h('span', { html: icon(ic) }), h('div', h('div.t', t), h('div.d', d)));
  };
  const grid = h('div.big-options',
    opt('upload', 'Pick game files', '.html or .zip files. You can pick a bunch at once.', async function () {
      handleResults(await window.gs.invoke('import:pick', false));
    }),
    opt('folder', 'Pick a game folder', 'A folder with the game inside (index.html and its stuff).', async function () {
      handleResults(await window.gs.invoke('import:pick', true));
    }),
    opt('link', 'Paste a link', 'A GitHub repo, a .zip or .html download link, or a website game.', async function () {
      const url = await prompt({ title: 'Paste a link', placeholder: 'https://…', ok: 'Add' });
      if (!url) return;
      toast({ text: 'Getting it…' });
      handleResults(await window.gs.invoke('import:link', url));
    }),
    opt('folderOpen', 'Open the Games folder', 'Anything you put in here shows up by itself.', function () {
      window.gs.invoke('shell:open', 'games');
    }));
  m = modal({
    title: 'Add games',
    lead: 'Or just drop .html files, .zip files or game folders anywhere on Game System 3.',
    body: h('div', grid, h('div', { style: { marginTop: '14px' } },
      h('button.big-opt', { 'data-f': '', style: { width: '100%' }, onclick: function () { Sound.press(); m.close(); openGs2(); } },
        h('span', { html: icon('download') }), h('div', h('div.t', 'Bring over Game System 2'), h('div.d', 'All your games, covers, play time, folders and saves in one go.'))))),
    wide: true
  });
}

/* ---------- Game System 2 -> Game System 3 ---------- */
export async function openGs2(file) {
  if (!file) file = await window.gs.invoke('gs2:find');
  if (!file) return gs2NoFile();
  let peek = null;
  try { peek = await window.gs.invoke('gs2:peek', file); } catch (e) { peek = null; }
  if (!peek || peek.ok === false) {
    toast({ kind: 'warn', text: 'That file isn\'t a Game System 2 backup.' });
    return gs2NoFile();
  }
  const what = [];
  if (peek.games) what.push(peek.games + (peek.games === 1 ? ' game' : ' games'));
  if (peek.apps) what.push(peek.apps + (peek.apps === 1 ? ' app' : ' apps'));
  const lead = 'Found your Game System 2 backup' + (peek.created ? ' from ' + fmtDate(peek.created) : '') + ': ' + (what.join(' and ') || 'no games') + '.' +
    (peek.already ? ' ' + peek.already + ' of them are already here and will be skipped.' : '') +
    ' Their covers, play time, folders and saves come too.';
  modal({
    title: 'Bring over Game System 2',
    lead: lead,
    actions: [
      { label: 'Pick another file', onClick: function () { pickGs2(); } },
      { label: 'Bring them over', kind: 'primary', default: true, icon: 'download', onClick: function () { runGs2(file); } }
    ]
  });
}

async function pickGs2() {
  const f = await window.gs.invoke('gs2:pick');
  if (f) openGs2(f);
}

function gs2NoFile() {
  modal({
    title: 'Bring over Game System 2',
    lead: 'I need your Game System 2 backup file. Open Game System 2, go to Settings and make a backup, it lands in your Downloads and I pick it up from there by myself.',
    actions: [
      { label: 'Pick the backup file', onClick: function () { pickGs2(); } },
      { label: 'Open Game System 2', kind: 'primary', default: true, icon: 'arrowRight', onClick: function () { window.gs.invoke('gs2:open'); waitForBackup(); } }
    ]
  });
}

/* waits for the backup to show up in Downloads */
function waitForBackup() {
  const started = Date.now();
  let m = null;
  const timer = setInterval(async function () {
    const f = await window.gs.invoke('gs2:find');
    if (f) {
      clearInterval(timer);
      if (m) m.close();
      openGs2(f);
    } else if (Date.now() - started > 10 * 60 * 1000) {
      clearInterval(timer);
      if (m) m.close();
    }
  }, 2000);
  m = modal({
    title: 'Waiting for your backup…',
    lead: 'In Game System 2: Settings → Back up. As soon as the file lands in your Downloads, I bring everything over.',
    body: h('div', { style: { display: 'grid', placeItems: 'center', padding: '10px 0' } }, h('div.spinner')),
    onClose: function () { clearInterval(timer); },
    actions: [{ label: 'Cancel' }, { label: 'Pick the file myself', onClick: function () { clearInterval(timer); pickGs2(); } }]
  });
}

function runGs2(file) {
  const label = h('div.muted', 'Starting…');
  const bar = h('div.progress', h('i'));
  const m = modal({ title: 'Bringing over Game System 2', body: h('div', label, bar), dismissible: false });
  const off = window.gs.on('gs2:progress', function (p) {
    label.textContent = p.text;
    if (p.frac != null) bar.firstChild.style.width = Math.round(p.frac * 100) + '%';
  });
  window.gs.invoke('gs2:run', file).then(async function (r) {
    off();
    m.close();
    await loadLibrary();
    if (!r || r.ok === false) {
      Sound.error();
      modal({ title: 'That didn\'t work', lead: (r && r.error) || 'Something went wrong reading the backup.', actions: [{ label: 'OK', kind: 'primary' }] });
      return;
    }
    if (St.settings.firstRun) setSetting({ firstRun: false });
    Sound.good();
    const li = function (ic, cls, html) { return h('li', h('span.' + cls, { html: icon(ic) }), h('span', { html: html })); };
    const list = h('ul.result-list',
      li('check', 'ok-ic', '<b>' + r.added + '</b> brought over'),
      r.saves ? li('save', 'ok-ic', '<b>' + r.saves + '</b> with their saves') : null,
      r.media ? li('camera', 'ok-ic', '<b>' + r.media + '</b> screenshots and clips (in Captures → From Game System 2)') : null,
      r.skipped ? li('info', 'dim', r.skipped + ' were already here') : null,
      r.failed && r.failed.length ? li('warn', 'warn-ic', 'Couldn\'t bring: ' + r.failed.map(escapeHtml).join(', ')) : null);
    modal({ title: 'Welcome home', lead: 'Your Game System 2 stuff is here now.', body: list, actions: [{ label: 'Let\'s go', kind: 'primary', default: true }] });
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* ---------- drop anywhere ---------- */
export function wireDrop() {
  const zone = document.getElementById('dropzone');
  let depth = 0;
  const hasFiles = function (e) { return e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0; };
  window.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; zone.hidden = false; zone.querySelector('.dz-icon').innerHTML = icon('download'); });
  window.addEventListener('dragover', function (e) { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', function (e) { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) zone.hidden = true; });
  window.addEventListener('drop', async function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    zone.hidden = true;
    const paths = Array.from(e.dataTransfer.files).map(function (f) { return window.gs.pathOf(f); }).filter(Boolean);
    if (!paths.length) return;
    Sound.press();
    toast({ text: paths.length === 1 ? 'Adding…' : 'Adding ' + paths.length + ' things…' });
    handleResults(await window.gs.invoke('import:paths', paths));
  });
}
