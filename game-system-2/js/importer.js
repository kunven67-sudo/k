/* Game System 2.0 — adding games.
   Handles: .html files, .zip files, whole folders (also the old Game System's Netlify folder),
   pasted code, links, and Game System backups. Figures out which files belong to which game. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;

  /* ---------------- collecting files ---------------- */
  function fromFileList(list) {
    return Array.prototype.map.call(list, function (f) {
      return { path: GS2Zip.cleanPath(f.webkitRelativePath || f.name), file: f };
    });
  }

  /* Drag & drop: walk folders. Must grab the entries synchronously inside the drop event. */
  function entriesFromDataTransfer(dt) {
    var roots = [];
    var loose = [];
    if (dt.items && dt.items.length) {
      for (var i = 0; i < dt.items.length; i++) {
        var it = dt.items[i];
        if (it.kind !== 'file') continue;
        var en = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
        if (en) roots.push(en);
        else { var f = it.getAsFile(); if (f) loose.push(f); }
      }
    } else if (dt.files) {
      loose = Array.prototype.slice.call(dt.files);
    }
    return { roots: roots, loose: loose };
  }

  function readAllEntries(dirEntry) {
    return new Promise(function (resolve, reject) {
      var reader = dirEntry.createReader();
      var out = [];
      (function more() {
        reader.readEntries(function (batch) {
          if (!batch.length) return resolve(out);
          out = out.concat(Array.prototype.slice.call(batch));
          more();
        }, reject);
      })();
    });
  }
  function entryFile(en) { return new Promise(function (res, rej) { en.file(res, rej); }); }

  async function walk(roots, loose) {
    var out = [];
    async function visit(en, prefix) {
      var p = prefix ? prefix + '/' + en.name : en.name;
      if (en.isFile) {
        out.push({ path: GS2Zip.cleanPath(p), file: await entryFile(en) });
      } else if (en.isDirectory) {
        if (/^(\.git|node_modules|__MACOSX)$/i.test(en.name)) return;
        var kids = await readAllEntries(en);
        for (var i = 0; i < kids.length; i++) await visit(kids[i], p);
      }
    }
    for (var i = 0; i < roots.length; i++) await visit(roots[i], '');
    loose.forEach(function (f) { out.push({ path: GS2Zip.cleanPath(f.name), file: f }); });
    return out;
  }

  /* Unzip any .zip files: "stuff/game.zip" becomes the folder "stuff/game/" */
  async function expandZips(entries, progress) {
    var out = [];
    var onlyOne = entries.length === 1;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (/\.zip$/i.test(e.path)) {
        if (progress) progress('Unzipping ' + e.path + '…');
        var inner = await GS2Zip.readZip(e.file);
        var base = onlyOne ? '' : e.path.replace(/\.zip$/i, '') + '/';
        inner.forEach(function (z) { out.push({ path: GS2Zip.cleanPath(base + z.path), file: z.blob, fromZip: e.path }); });
      } else {
        out.push(e);
      }
    }
    return out.filter(function (e) { return e.path && !GS2Zip.JUNK.test(e.path) && !/(^|\/)\.git\//.test(e.path); });
  }

  function stripCommonRoot(entries) {
    var names = [];
    for (;;) {
      if (!entries.length) break;
      var first = entries[0].path.split('/');
      if (first.length < 2) break;
      var root = first[0] + '/';
      if (!entries.every(function (e) { return e.path.indexOf(root) === 0 && e.path.length > root.length; })) break;
      names.push(first[0]);
      entries.forEach(function (e) { e.path = e.path.slice(root.length); });
    }
    return names;
  }

  /* ---------------- figuring out games ---------------- */
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
  function baseName(p) { return p.slice(p.lastIndexOf('/') + 1); }
  function resolve(fromDir, ref) {
    ref = ref.split('#')[0].split('?')[0];
    try { ref = decodeURIComponent(ref); } catch (e) { /* keep */ }
    if (ref.charAt(0) === '/') return GS2Zip.cleanPath(ref);
    return GS2Zip.cleanPath((fromDir ? fromDir + '/' : '') + ref);
  }

  async function textOf(entry) {
    if (entry._text != null) return entry._text;
    if (entry.file.size > 8 * 1024 * 1024) { entry._text = ''; return ''; }
    entry._text = await entry.file.text();
    return entry._text;
  }

  var GENERIC_TITLES = /^(document|untitled|index|game|my game|new game|html|page|home|test|web game|title)$/i;

  function titleOf(text) {
    var m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text || '');
    if (!m) return '';
    var t = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    var ta = document.createElement('textarea');
    ta.innerHTML = t;
    t = ta.value.trim();
    if (!t || GENERIC_TITLES.test(t) || t.length > 70) return '';
    return t;
  }

  /* All the file paths that a text file mentions which really exist in the upload */
  function refsIn(text, fromDir, index) {
    var found = {};
    var re = /(?:["'`(]|url\(\s*)([^"'`()<>\s{}]{1,240}?\.[a-z0-9]{1,6})(?:[?#][^"'`()<>\s]*)?(?=["'`)\s])/gi;
    var m;
    while ((m = re.exec(text))) {
      var s = m[1];
      if (/^(data:|blob:|https?:|\/\/|#|mailto:|javascript:)/i.test(s)) continue;
      var p = resolve(fromDir, s);
      var real = index.get(p.toLowerCase());
      if (real) found[real] = true;
    }
    return Object.keys(found);
  }

  async function collectRefs(start, byPath, index) {
    var seen = {};
    var queue = [start];
    seen[start] = true;
    var depth = 0;
    while (queue.length && depth < 4) {
      var next = [];
      for (var i = 0; i < queue.length; i++) {
        var p = queue[i];
        if (!/\.(html?|css|js|mjs|json|svg)$/i.test(p)) continue;
        var e = byPath.get(p);
        if (!e) continue;
        var refs = refsIn(await textOf(e), dirOf(p), index);
        refs.forEach(function (r) {
          /* other pages are other games (or the old menu), not part of this one */
          if (/\.html?$/i.test(r)) return;
          if (!seen[r]) { seen[r] = true; next.push(r); }
        });
      }
      queue = next;
      depth++;
    }
    /* include whole asset folders the game uses (catches files built from code like "img/" + name) */
    var dirs = {};
    Object.keys(seen).forEach(function (p) { var d = dirOf(p); if (d && d !== dirOf(start)) dirs[d] = true; });
    byPath.forEach(function (e, p) {
      if (seen[p] || /\.html?$/i.test(p)) return;
      if (dirs[dirOf(p)]) seen[p] = true;
    });
    return Object.keys(seen);
  }

  /* Names (and pictures) that an old launcher page gives its games */
  function launcherLabels(text, index) {
    var out = new Map();
    function add(path, label, img) {
      var real = index.get(resolve('', path).toLowerCase());
      if (!real || !/\.html?$/i.test(real)) {
        /* folder links like "snake/" → snake/index.html */
        var alt = index.get((resolve('', path) + '/index.html').toLowerCase()) || index.get((resolve('', path) + 'index.html').toLowerCase());
        real = alt || null;
      }
      if (!real) return;
      label = String(label || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      var ta = document.createElement('textarea');
      ta.innerHTML = label;
      label = ta.value.trim();
      if (label.length > 60) label = label.slice(0, 60).trim();
      var cur = out.get(real) || {};
      if (label && !cur.label && !/^(play|open|go|start|launch|click here|▶)$/i.test(label)) cur.label = label;
      if (img && !cur.img) cur.img = index.get(resolve('', img).toLowerCase()) || null;
      out.set(real, cur);
    }
    var m;
    var aRe = /<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = aRe.exec(text))) {
      var img = /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(m[2]);
      add(m[1], m[2], img && img[1]);
    }
    var clickRe = /<(button|div|li|span|article|section|td|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    while ((m = clickRe.exec(text))) {
      var attrs = m[2];
      if (!/\bon\w+\s*=/i.test(attrs) && !/\bdata-[\w-]+\s*=/i.test(attrs)) continue;
      var target = /([\w./%-]+\.html?)\b/i.exec(attrs);
      if (target) add(target[1], m[3]);
    }
    var objRe = /\{[^{}]{0,600}\}/g;
    while ((m = objRe.exec(text))) {
      var block = m[0];
      var file = /["'`]([^"'`\s]+\.html?)["'`]/i.exec(block);
      if (!file) continue;
      var name = /\b(?:name|title|label|text)\s*:\s*["'`]([^"'`]{1,60})["'`]/i.exec(block);
      var pic = /\b(?:img|image|icon|thumb|thumbnail|cover|pic)\s*:\s*["'`]([^"'`\s]+)["'`]/i.exec(block);
      add(file[1], name && name[1], pic && pic[1]);
    }
    return out;
  }

  /* "🐍 Snake Game" → { emoji: '🐍', text: 'Snake Game' } */
  function splitEmoji(s) {
    var m = /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator})*)\s*(.*)$/u.exec(s);
    if (m && m[2].trim()) return { emoji: m[1], text: m[2].trim() };
    var m2 = /^(.*?)\s*((?:\p{Extended_Pictographic})(?:\uFE0F|\u200D|\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*$/u.exec(s);
    if (m2 && m2[1].trim()) return { emoji: m2[2], text: m2[1].trim() };
    return { emoji: null, text: s };
  }

  var COVER_NAMES = /^(cover|thumbnail|thumb|icon|logo|preview|screenshot|banner|poster)\.(png|jpe?g|webp|gif)$/i;

  /* entries: [{path, file}] → [{name, entry, files:[{path, file}], ...}] */
  async function detect(entries, hints) {
    hints = hints || {};
    var rootNames = stripCommonRoot(entries);
    var zipName = hints.zipName ? U.prettyName(hints.zipName) : '';
    var rootName = rootNames.length ? U.prettyName(rootNames[rootNames.length - 1]) : zipName;
    var byPath = new Map();
    var index = new Map();
    entries.forEach(function (e) { byPath.set(e.path, e); index.set(e.path.toLowerCase(), e.path); });
    var htmls = entries.filter(function (e) { return /\.html?$/i.test(e.path); });
    if (!htmls.length) return { games: [], note: 'No .html file in there, bro. A web game needs at least one .html file.' };

    var games = [];
    var launcher = null;

    if (htmls.length === 1) {
      var only = htmls[0];
      var tx = await textOf(only);
      games.push({ entry: only.path, files: entries.slice(), title: titleOf(tx), hint: rootName || U.prettyName(baseName(only.path)) });
    } else {
      var idxDirs = htmls.filter(function (e) { return /(^|\/)index\.html?$/i.test(e.path); })
        .map(function (e) { return dirOf(e.path); })
        .filter(function (d) { return d !== ''; })
        .sort(function (a, b) { return a.split('/').length - b.split('/').length || a.localeCompare(b); });
      var roots = [];
      idxDirs.forEach(function (d) {
        if (!roots.some(function (r) { return d.indexOf(r + '/') === 0; })) roots.push(d);
      });
      for (var i = 0; i < roots.length; i++) {
        var R = roots[i] + '/';
        var files = entries.filter(function (e) { return e.path.indexOf(R) === 0; })
          .map(function (e) { return { path: e.path.slice(R.length), file: e.file }; });
        var entry = files.find(function (f) { return /^index\.html?$/i.test(f.path); }).path;
        var idxEntry = byPath.get(R + entry);
        games.push({ entry: entry, files: files, title: titleOf(await textOf(idxEntry)), hint: U.prettyName(baseName(roots[i])), origPath: R + entry });
      }
      var loose = htmls.filter(function (e) { return !roots.some(function (r) { return e.path.indexOf(r + '/') === 0; }); });
      var rootIndex = loose.find(function (e) { return /^index\.html?$/i.test(e.path); });
      var others = loose.filter(function (e) { return e !== rootIndex; });
      for (var j = 0; j < others.length; j++) {
        var o = others[j];
        var paths = await collectRefs(o.path, byPath, index);
        var d = dirOf(o.path);
        var rebase = d && paths.every(function (p) { return p.indexOf(d + '/') === 0; }) ? d + '/' : '';
        games.push({
          entry: o.path.slice(rebase.length),
          files: paths.map(function (p) { return { path: p.slice(rebase.length), file: byPath.get(p).file }; }),
          title: titleOf(await textOf(o)),
          hint: U.prettyName(baseName(o.path)),
          origPath: o.path
        });
      }
      if (rootIndex) {
        var ltext = await textOf(rootIndex);
        var labels = launcherLabels(ltext, index);
        games.forEach(function (g) {
          var lab = labels.get(g.origPath);
          if (lab) { g.label = lab.label; if (lab.img) g.coverPath = lab.img; }
        });
        var lpaths = await collectRefs(rootIndex.path, byPath, index);
        lpaths = lpaths.filter(function (p) { return !/\.html?$/i.test(p) || p === rootIndex.path; });
        launcher = {
          entry: rootIndex.path,
          files: lpaths.map(function (p) { return { path: p, file: byPath.get(p).file }; }),
          title: titleOf(ltext),
          hint: (rootName || 'Old Game System') + ' (old menu page)',
          launcher: true
        };
        games.push(launcher);
      }
    }

    /* cover pictures + final names */
    games.forEach(function (g) {
      if (!g.coverPath) {
        var c = g.files.find(function (f) { return COVER_NAMES.test(f.path); });
        if (c) g.coverFile = c.file;
      } else {
        var be = byPath.get(g.coverPath);
        if (be) g.coverFile = be.file;
      }
      var nm = (g.launcher ? g.hint : (g.label || g.title || g.hint || rootName || 'Untitled Game')).slice(0, 80);
      var em = splitEmoji(nm);
      g.name = em.text || nm;
      g.emoji = em.emoji || U.guessEmoji(g.name + ' ' + (g.title || ''));
      g.size = g.files.reduce(function (s, f) { return s + (f.file ? f.file.size : 0); }, 0);
      g.checked = !g.launcher;
      var existing = D.findByName(g.name);
      g.existingId = existing ? existing.id : null;
      g.mode = existing ? 'update' : 'new';
    });
    return { games: games, rootName: rootName, legacy: !!launcher };
  }

  /* ---------------- main entry points ---------------- */
  var busy = null;
  function busyModal(text) {
    var label = h('div.muted', text || 'Working…');
    var m = UI.modal({ title: 'Hold up…', body: h('div.row', h('div.spinner'), label), dismissible: false });
    return { set: function (t) { label.textContent = t; }, close: function () { m.close(); } };
  }

  async function handleEntries(entries, opts) {
    opts = opts || {};
    if (!entries || !entries.length) return;
    busy = busyModal('Looking at your files…');
    try {
      var zipName = entries.length === 1 && /\.zip$/i.test(entries[0].path) ? baseName(entries[0].path).replace(/\.zip$/i, '') : '';
      var all = await expandZips(entries, busy.set);
      /* a Game System backup? */
      var bk = all.find(function (e) { return /(^|\/)gs2-backup\.json$/i.test(e.path); });
      if (bk) {
        busy.close();
        return Backup.restoreFromEntries(all);
      }
      /* a save file? */
      if (all.length === 1 && /\.json$/i.test(all[0].path)) {
        var txt = await all[0].file.text();
        var parsed = null;
        try { parsed = JSON.parse(txt); } catch (e) { /* not json */ }
        if (parsed && parsed.gs2saves === 1) {
          busy.close();
          return Views.importSaveFile(parsed);
        }
      }
      /* pictures dropped on their own → set as cover of the selected game */
      if (all.every(function (e) { return U.isImagePath(e.path); }) && all.length === 1 && D.ui.sel && D.get(D.ui.sel)) {
        busy.close();
        var g = D.get(D.ui.sel);
        if (await UI.confirm('Set as cover?', 'Use this picture as the cover for "' + g.name + '"?', { ok: 'Yes, set cover' })) {
          await D.setCover(g.id, all[0].file);
          UI.toast('Cover updated', { type: 'good', icon: 'image' });
        }
        return;
      }
      busy.set('Finding games…');
      var res = await detect(all, { zipName: zipName });
      busy.close();
      if (!res.games.length) {
        UI.alert('No games found', res.note || 'Couldn\'t find a game in there.');
        return;
      }
      review(res, opts);
    } catch (err) {
      if (busy) busy.close();
      console.error(err);
      UI.alert('That didn\'t work', h('div', h('p', err.message || String(err)), h('p.muted.small', 'Try adding the files a different way (for example unzip it and add the folder).')));
    }
  }

  function review(res, opts) {
    var games = res.games;
    var startFolder = typeof opts.targetFolder === 'string' ? opts.targetFolder : (res.legacy ? 'Old games' : '');
    var folderInput = h('input.input', { placeholder: 'No folder', list: 'gs2-folders' });
    folderInput.value = startFolder;
    var dl = h('datalist#gs2-folders', D.folders().map(function (f) { return h('option', { value: f.name }); }));
    var list = h('div.review-list');
    var count = h('span');
    var importBtn;

    function refreshCount() {
      var n = games.filter(function (g) { return g.checked; }).length;
      count.textContent = n;
      if (importBtn) importBtn.disabled = n === 0;
    }

    function row(g) {
      var cb = h('input', { type: 'checkbox', checked: g.checked, 'aria-label': 'Import this game' });
      var artBox = h('div.ri-art', UI.art({ name: g.name, emoji: g.emoji, color: U.colorFor(g.name) }, { noName: true }));
      var name = h('input.input', { value: g.name, maxlength: 80, 'aria-label': 'Game name' });
      name.value = g.name;
      var modeSel = null;
      if (g.existingId) {
        modeSel = h('select.select', { style: { width: 'auto' }, onchange: function () { g.mode = modeSel.value; } },
          h('option', { value: 'update' }, 'Update existing (keeps saves)'),
          h('option', { value: 'new' }, 'Add as a new game'));
        modeSel.value = g.mode;
      }
      var el = h('div.review-item' + (g.checked ? '' : '.off'),
        cb, artBox,
        h('div.ri-main', name,
          h('div.ri-sub', I('file'), ' ' + g.entry + ' · ' + g.files.length + ' file' + (g.files.length === 1 ? '' : 's') + ' · ' + U.fmtBytes(g.size), g.coverFile ? [' · ', I('image'), ' cover found'] : null),
          g.launcher ? h('div.ri-warn', I('info'), ' This looks like your OLD game menu page, not a game. Leave it unchecked unless you want it.') : null,
          g.existingId ? h('div.ri-warn', I('warn'), ' You already have a game called "' + D.get(g.existingId).name + '"') : null),
        modeSel ? h('div.row', modeSel) : h('div'));
      cb.addEventListener('change', function () { g.checked = cb.checked; el.classList.toggle('off', !g.checked); refreshCount(); });
      name.addEventListener('input', function () {
        g.name = name.value;
        artBox.replaceChildren(UI.art({ name: g.name, color: U.colorFor(g.name) }, { noName: true }));
      });
      return el;
    }
    games.forEach(function (g) { list.appendChild(row(g)); });

    var intro = res.legacy
      ? h('p', 'Found your old Game System folder! I found ', h('b', String(games.length - 1)), ' game' + (games.length - 1 === 1 ? '' : 's') + '. Check the names and hit import.')
      : h('p', 'Found ', h('b', String(games.length)), ' game' + (games.length === 1 ? '' : 's') + '. Fix the names if you want, then import.');

    var m = UI.modal({
      title: 'Import games',
      icon: 'download',
      wide: true,
      body: h('div', intro,
        h('div.field', h('label', 'Put them in folder (optional)'), folderInput, dl),
        list),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        games.length > 1 ? { label: 'It\'s all ONE game', icon: 'link', kind: 'ghost', onClick: function () { mergeAsOne(); return false; } } : null,
        { label: 'Import', kind: 'primary', id: 'btn-do-import', onClick: function () { return doImport(games, folderInput.value.trim(), m); } }
      ]
    });
    importBtn = m.el.querySelector('#btn-do-import');
    importBtn.replaceChildren('Import ', count);
    refreshCount();

    /* rebuild from the original upload, with everything as one game */
    function mergeAsOne() {
      m.close();
      oneGame(res);
    }
  }

  /* Re-detect everything as one game (entry = top index.html or first html) */
  function oneGame(res) {
    var all = res._all;
    if (!all) return;
    var htmls = all.filter(function (e) { return /\.html?$/i.test(e.path); });
    var entry = (htmls.find(function (e) { return /^index\.html?$/i.test(e.path); }) || htmls[0]).path;
    var name = res.rootName || U.prettyName(baseName(entry));
    review({
      games: [{
        entry: entry, files: all.slice(), name: name, emoji: U.guessEmoji(name), checked: true,
        size: all.reduce(function (s, f) { return s + f.file.size; }, 0),
        existingId: D.findByName(name) ? D.findByName(name).id : null, mode: D.findByName(name) ? 'update' : 'new'
      }],
      rootName: res.rootName
    }, {});
  }

  async function doImport(games, folder, m) {
    var chosen = games.filter(function (g) { return g.checked && g.name.trim(); });
    if (!chosen.length) return false;
    var done = 0;
    var firstId = null;
    var prog = h('div.progress', h('i'));
    m.body.appendChild(h('div', { style: { marginTop: '14px' } }, prog));
    for (var i = 0; i < chosen.length; i++) {
      var g = chosen[i];
      var files = g.files.map(function (f) { return { p: f.path, b: f.file, t: U.mimeOf(f.path) }; });
      var id;
      if (g.mode === 'update' && g.existingId && D.get(g.existingId)) {
        await D.replaceFiles(g.existingId, files, g.entry);
        await D.updateGame(g.existingId, { name: g.name.trim(), emoji: g.emoji });
        id = g.existingId;
      } else {
        var rec = await D.addGame({ name: g.name.trim(), emoji: g.emoji, entry: g.entry, folder: folder }, files);
        id = rec.id;
      }
      if (g.coverFile) { try { await D.setCover(id, g.coverFile); } catch (e) { /* bad picture */ } }
      if (!firstId) firstId = id;
      done++;
      prog.firstChild.style.width = Math.round(done / chosen.length * 100) + '%';
    }
    if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch (e) { /* ignore */ } }
    Sound.good();
    UI.toast(done === 1 ? '"' + chosen[0].name + '" is ready to play!' : done + ' games imported! Let\'s gooo', { type: 'good' });
    if (firstId) { D.ui.sel = firstId; D.saveUI(); }
    App.go('home');
    return true;
  }

  /* ---------------- paste code ---------------- */

  function wrapIfScriptOnly(code, name) {
    if (/<\s*(html|body|head|script|div|canvas|style|!doctype)\b/i.test(code)) return code;
    return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' +
      U.escapeHtml(name || 'Game') + '</title>\n<style>html,body{margin:0;height:100%;background:#000;color:#fff;overflow:hidden}</style>\n</head>\n<body>\n<script>\n' +
      code + '\n</script>\n</body>\n</html>\n';
  }

  async function pasteDialog(prefill) {
    var nameIn = h('input.input', { placeholder: 'Name your game', maxlength: 80 });
    var emoji = '🎮';
    var host = h('div', { style: { height: '46vh', minHeight: '260px', position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line2)' } });
    var status = h('div.small.muted', { style: { minHeight: '22px', marginTop: '8px' } }, 'Paste the code the AI gave you (the whole thing).');
    var banner = h('div');
    var editor = null;
    var nameTouched = false;

    UI.modal({
      title: 'Paste game code',
      icon: 'code',
      xwide: true,
      body: h('div',
        h('div.row', { style: { marginBottom: '12px' } }, h('div.grow', nameIn),
          h('button.btn.sm', { onclick: function () { appendDialog(); }, title: 'The AI got cut off and sent the rest in another message? Glue it on here.' }, I('fileAdd'), 'Glue on more code')),
        banner, host, status),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Add game', kind: '', onClick: function () { return save(false); } },
        { label: 'Add & play', icon: 'play', kind: 'primary', onClick: function () { return save(true); } }
      ]
    });
    nameIn.addEventListener('input', function () { nameTouched = true; });

    editor = await Editor.mini(host, prefill || '', { placeholder: 'Paste your game code here…' });
    editor.onChange(U.debounce(check, 350));
    check();

    async function check() {
      var code = editor.getValue();
      if (/^\s*```/m.test(code)) {
        var cleaned = Editor.stripFences(code);
        if (cleaned !== code) {
          editor.setValue(cleaned);
          UI.toast('Removed the ``` marks from the AI chat (they\'re not code).', { icon: 'check', sound: false });
          return;
        }
      }
      if (!nameTouched) {
        var t = titleOf(code);
        if (t) { nameIn.value = t; emoji = U.guessEmoji(t); }
      }
      if (!code.trim()) { banner.replaceChildren(); status.textContent = 'Paste the code the AI gave you (the whole thing).'; return; }
      var isMarkup = /<\s*(html|body|head|script|div|canvas|style|!doctype)\b/i.test(code);
      var a = await Editor.analyze(code, isMarkup ? 'index.html' : 'game.js');
      editor.setProblems(a.problems);
      banner.replaceChildren(Editor.problemBanner(a, editor));
      var lines = code.split('\n').length;
      status.textContent = a.problems.filter(function (p) { return p.severity === 'error'; }).length
        ? a.problems.filter(function (p) { return p.severity === 'error'; }).length + ' problem(s) found. Red lines show where.'
        : lines + ' lines. No syntax errors found.';
    }

    async function appendDialog() {
      var ta = h('textarea.input', { placeholder: 'Paste the next part the AI sent…', style: { minHeight: '240px' } });
      UI.modal({
        title: 'Glue on the rest',
        icon: 'fileAdd',
        wide: true,
        body: h('div', h('p', 'When the AI stops halfway, ask it to "continue exactly where you stopped", then paste that part here. I\'ll glue it on the end and remove any overlap.'), ta),
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Glue it on', kind: 'primary', onClick: function () {
          editor.setValue(Editor.glue(editor.getValue(), ta.value));
          editor.focusEnd();
          UI.toast('Glued on! Checking it again…', { icon: 'fileAdd', sound: false });
        } }]
      });
      setTimeout(function () { ta.focus(); }, 60);
    }

    async function save(play) {
      var code = editor.getValue();
      if (!code.trim()) { UI.toast('Paste some code first, bro', { type: 'warn' }); return false; }
      var name = nameIn.value.trim() || titleOf(code) || 'My Game';
      var html = wrapIfScriptOnly(code, name);
      var existing = D.findByName(name);
      var id;
      var files = [{ p: 'index.html', b: new Blob([html], { type: 'text/html' }), t: 'text/html' }];
      if (existing && await UI.confirm('Update "' + existing.name + '"?', 'You already have a game with this name. Update it with this new code? (Your saves stay.)', { ok: 'Update it', cancel: 'Add as new' })) {
        await D.replaceFiles(existing.id, files, 'index.html');
        id = existing.id;
      } else {
        id = (await D.addGame({ name: name, emoji: emoji === '🎮' ? U.guessEmoji(name) : emoji, entry: 'index.html' }, files)).id;
      }
      D.ui.sel = id;
      D.saveUI();
      UI.toast('"' + name + '" added!', { type: 'good' });
      App.go('home');
      if (play) setTimeout(function () { Player.launch(id); }, 250);
      return true;
    }
  }

  /* ---------------- link ---------------- */
  function linkDialog() {
    var name = h('input.input', { placeholder: 'Game name' });
    var url = h('input.input', { placeholder: 'https://…', type: 'url' });
    UI.modal({
      title: 'Add a game link',
      icon: 'link',
      body: h('div',
        h('p.muted.small', 'Some websites don\'t allow being shown inside other sites. If it shows an error, use "Open in new tab" from the quick menu.'),
        h('div.field', h('label', 'Name'), name),
        h('div.field', h('label', 'Link'), url)),
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Add', kind: 'primary', onClick: async function () {
        var u = url.value.trim();
        if (!/^https?:\/\//i.test(u)) { UI.toast('The link needs to start with https://', { type: 'warn' }); return false; }
        var n = name.value.trim() || (function () { try { return U.prettyName(new URL(u).hostname.replace(/^www\./, '').split('.')[0]); } catch (e) { return 'Web Game'; } })();
        var g = await D.addGame({ name: n, source: 'link', url: u, entry: '' }, []);
        D.ui.sel = g.id;
        D.saveUI();
        App.go('home');
        UI.toast('Link added', { type: 'good', icon: 'link' });
      } }]
    });
  }

  /* ---------------- the big "Add games" dialog ---------------- */
  function pickFiles(opts) {
    var input = h('input', { type: 'file', multiple: true, accept: opts && opts.accept || '.html,.htm,.zip,.js,.css,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp3,.ogg,.wav,.woff,.woff2,.glb,.gltf,.wasm,*/*', style: { display: 'none' } });
    if (opts && opts.folder) { input.webkitdirectory = true; input.setAttribute('webkitdirectory', ''); }
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var list = fromFileList(input.files);
      input.remove();
      if (opts && opts.onPick) opts.onPick(list);
      else handleEntries(list, opts || {});
    });
    input.click();
  }

  function addDialog() {
    var dz = h('div.dropzone', { tabindex: 0, onclick: function () { m.close(); pickFiles(); }, onkeydown: function (e) { if (e.key === 'Enter') { m.close(); pickFiles(); } } },
      h('div.dz-icon', I('inbox')), h('div.dz-title', 'Drop games here'), h('div.dz-sub', '.html · .zip · whole folders · Game System backups'));
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
    var m = UI.modal({
      title: 'Add games',
      icon: 'plus',
      wide: true,
      body: h('div', dz,
        h('div.act-grid', { style: { marginTop: '16px' } },
          h('button.btn', { onclick: function () { m.close(); pickFiles(); } }, I('file'), 'Pick files'),
          h('button.btn', { onclick: function () { m.close(); pickFiles({ folder: true }); } }, I('folder'), 'Pick a folder'),
          h('button.btn', { onclick: function () { m.close(); pasteDialog(); } }, I('code'), 'Paste code'),
          h('button.btn', { onclick: function () { m.close(); linkDialog(); } }, I('link'), 'Add a link'),
          h('button.btn', { onclick: function () { m.close(); importOldFolder(); } }, I('library'), 'Import my old games'),
          h('button.btn', { onclick: function () { m.close(); Views.aiRules(); } }, I('sparkle'), 'Rules for AI games')),
        h('p.small.muted', { style: { marginTop: '14px', marginBottom: 0 } }, 'Tip: if a game has pictures or sounds in other files, add the whole folder or a .zip so nothing is missing.'))
    });
  }

  function importOldFolder() {
    UI.modal({
      title: 'Import your old games',
      icon: 'library',
      body: h('div',
        h('p', 'Pick the folder you used to drag onto Netlify for your old Game System. I\'ll find every game inside it.'),
        h('p.muted.small', 'Lost that folder? On Netlify open your site → Deploys → click your last deploy → "Download deploy" (or similar). Unzip it and pick that folder.'),
        h('p.muted.small', 'Nothing gets deleted. Your old folder stays exactly how it is.')),
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Pick the folder', icon: 'folder', kind: 'primary', onClick: function () { pickFiles({ folder: true, legacy: true }); } }]
    });
  }

  /* ---------------- global drag & drop ---------------- */
  function setupDrop() {
    var overlay = document.getElementById('drop-overlay');
    var depth = 0;
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
    window.addEventListener('dragenter', function (e) {
      if (!hasFiles(e) || !document.getElementById('player').hidden) return;
      depth++;
      overlay.hidden = false;
    });
    window.addEventListener('dragleave', function (e) {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) overlay.hidden = true;
    });
    window.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      overlay.hidden = true;
      if (!document.getElementById('player').hidden) return;
      var got = entriesFromDataTransfer(e.dataTransfer);
      var m = UI.topModal();
      if (m && m.el.querySelector('.dropzone')) m.close();
      if (Editor.isOpen() && Editor.wantsDrop(e)) { walk(got.roots, got.loose).then(Editor.addDroppedFiles); return; }
      walk(got.roots, got.loose).then(function (list) { handleEntries(list, {}); }).catch(function (err) {
        UI.alert('Couldn\'t read those files', err.message || String(err));
      });
    });
  }

  /* keep the original entries around so "it's all ONE game" can rebuild */
  var _detect = detect;
  detect = async function (entries, hints) {
    var copy = entries.map(function (e) { return { path: e.path, file: e.file }; });
    var res = await _detect(entries, hints);
    stripCommonRoot(copy);
    res._all = copy;
    return res;
  };

  window.Importer = {
    handleEntries: handleEntries,
    detect: detect,
    addDialog: addDialog,
    pasteDialog: pasteDialog,
    linkDialog: linkDialog,
    pickFiles: pickFiles,
    importOldFolder: importOldFolder,
    setupDrop: setupDrop,
    fromFileList: fromFileList,
    titleOf: titleOf,
    wrapIfScriptOnly: wrapIfScriptOnly
  };
})();
