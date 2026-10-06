/* Game System 2.0 — "Make it continue where I left off".
   Games that don't use the Save Kit restart at their own title screen. This builds a message
   (instructions + the game's code) to paste into an AI, and takes the AI's answer back in,
   keeping the old version so the upgrade can be undone. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;
  var MAX_SHARE = 400 * 1024;

  async function kitSnippet() {
    try { return (await (await fetch('kit/save-kit.js')).text()).trim(); }
    catch (e) { return '(could not load the Save Kit, are you offline?)'; }
  }

  /* The save + resume rules, shared with "Rules for AI games" */
  function saveRules(kitText, startNumber) {
    var n = startNumber || 1;
    return [
      n + '. SAVE & RESUME. Paste this Save Kit at the very top of the first <script>, exactly as written:',
      '',
      kitText,
      '',
      (n + 1) + '. Save EVERYTHING needed to continue exactly where the player was: which screen they are on (title screen, playing, a menu, a shop...), player position and camera, health, money, level, inventory, everything they built or changed in the world, time, and any other progress. Turn on auto-save with a function that returns all of it:',
      '     GameSystem.autoSave(() => ({ screen: currentScreen, /* position, camera, money, inventory, world, ... */ }));',
      '   Only save plain data (numbers, text, true/false, arrays, objects). No functions, images or DOM elements.',
      (n + 2) + '. When the game starts, load the save:',
      '     const saved = GameSystem.load();',
      '   If there is a save, SKIP the title screen and put the player straight back into the game exactly how it was (same screen, position, camera, everything). Only show the title screen when there is no save.',
      (n + 3) + '. When the player picks New Game or Restart, call GameSystem.clear() so the old save is gone.'
    ];
  }

  async function textFiles(g) {
    await D.ensureLocalFiles(g);
    var recs = await GS2DB.filesOf(g.id);
    var out = [];
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (!/\.(html?|m?js|css|json)$/i.test(r.p)) continue;
      out.push({ p: r.p, t: r.t, text: await r.b.text() });
    }
    out.sort(function (a, b) { return (a.p === g.entry ? -1 : 0) - (b.p === g.entry ? -1 : 0) || a.p.localeCompare(b.p); });
    return out;
  }

  async function buildMessage(g) {
    var kit = await kitSnippet();
    var codeFiles = (await textFiles(g)).filter(function (f) { return /\.(html?|m?js)$/i.test(f.p); });
    var many = codeFiles.length > 1;
    var lines = [
      'I have a web game called "' + g.name + '". It remembers some progress, but when I come back it always starts at its title screen instead of exactly where I was. Please upgrade it with the Game System 2.0 Save Kit. Follow these rules exactly:',
      ''
    ].concat(saveRules(kit, 1)).concat([
      '5. If the game already saves progress in its own way (like localStorage), keep that working too so none of my progress is lost.',
      '6. Don\'t change anything else about how the game looks or plays. Don\'t remove any features.',
      '7. Send back the COMPLETE ' + (many ? 'code of every file you changed, each one from its first line to its last, with its file name above it' : 'file from the first line to the last') + '. Never write "rest of the code stays the same". If it\'s too long for one message, stop at a clean spot and I\'ll say "continue".',
      ''
    ]);
    if (!many) {
      lines.push('Here is the game\'s code:', '', codeFiles[0] ? codeFiles[0].text : '');
    } else {
      lines.push('Here are the game\'s code files:', '');
      codeFiles.forEach(function (f) { lines.push('===== FILE: ' + f.p + ' =====', f.text, ''); });
    }
    return { text: lines.join('\n'), files: codeFiles };
  }

  async function open(id) {
    var g = D.get(id);
    if (!g) return;
    if (g.source === 'link') { UI.toast('Links can\'t be upgraded. The website decides how it saves.', { type: 'warn' }); return; }
    var msg;
    try { msg = await buildMessage(g); } catch (e) { UI.alert('Couldn\'t read the game', e.message || String(e)); return; }
    if (!msg.files.length) { UI.alert('Nothing to upgrade', 'This game has no code files.'); return; }
    var size = msg.text.length;
    var backup = await GS2DB.kvGet('upgradeBackup:' + id);
    var copied = h('span.small.muted');
    var m = UI.modal({
      title: 'Make it continue where you left off',
      icon: 'resume',
      wide: true,
      body: h('div',
        h('p', '"' + g.name + '" starts at its own title screen because its code doesn\'t use the Save Kit. Game System can\'t change that from the outside, but an AI can add it to the code in about a minute:'),
        h('ol.steps',
          h('li', h('b', 'Copy the message.'), ' It has the instructions and your game\'s code in it.', h('div.row', { style: { marginTop: '8px' } },
            h('button.btn.primary', { onclick: async function () {
              await U.copyText(msg.text);
              copied.textContent = 'Copied ' + U.fmtBytes(size) + '.';
              UI.toast('Copied! Now paste it into the AI.', { icon: 'clipboard' });
            } }, I('clipboard'), 'Copy the message'), copied)),
          h('li', 'Paste it into ChatGPT, Claude or any AI chat and send it.'),
          h('li', 'When the AI answers, copy ', h('b', 'all'), ' the code it gives you. If it stops halfway, tell it "continue".'),
          h('li', h('b', 'Paste the new code here.'), h('div.row', { style: { marginTop: '8px' } },
            h('button.btn', { onclick: function () { m.close(); pasteBack(id, msg.files); } }, I('code'), 'Paste the new code')))),
        size > MAX_SHARE ? h('p.small', { style: { color: 'var(--warn)' } }, I('warn'), ' This game is big (' + U.fmtBytes(size) + '). Some AI chats can\'t take that much in one message. If it gets cut off, try a different AI.') : null,
        h('p.small.muted', 'Your saves and everything you built stay. If the new code breaks something, you can undo the upgrade from the game\'s details.')),
      actions: [
        backup ? { label: 'Undo last upgrade', icon: 'undo', kind: 'ghost', onClick: function () { undo(id); } } : null,
        { label: 'Close', kind: 'ghost' }
      ]
    });
  }

  async function pasteBack(id, files) {
    var g = D.get(id);
    if (!g) return;
    var sel = null;
    if (files.length > 1) {
      sel = h('select.select', { style: { width: 'auto' }, 'aria-label': 'Which file' }, files.map(function (f) { return h('option', { value: f.p }, f.p); }));
      sel.value = g.entry;
    }
    var host = h('div', { style: { height: '46vh', minHeight: '240px', position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line2)' } });
    var banner = h('div');
    var status = h('div.small.muted', { style: { minHeight: '22px', marginTop: '8px' } }, 'Paste the whole code the AI gave you.');
    var ed = null;
    UI.modal({
      title: 'Paste the new code',
      icon: 'code',
      xwide: true,
      body: h('div',
        sel ? h('div.row', { style: { marginBottom: '10px' } }, h('span.small', 'This is the new version of'), sel) : null,
        h('div.row', { style: { marginBottom: '10px' } },
          h('button.btn.sm', { onclick: function () { glue(); } }, I('fileAdd'), 'Glue on more code')),
        banner, host, status),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Save upgrade', icon: 'save', kind: 'primary', onClick: function () { return save(); } }
      ]
    });
    ed = await Editor.mini(host, '', { placeholder: 'Paste the new code here…' });
    ed.onChange(U.debounce(check, 350));

    async function check() {
      var code = ed.getValue();
      if (/^\s*```/m.test(code)) {
        var cleaned = Editor.stripFences(code);
        if (cleaned !== code) { ed.setValue(cleaned); return; }
      }
      if (!code.trim()) { banner.replaceChildren(); status.textContent = 'Paste the whole code the AI gave you.'; return; }
      var path = sel ? sel.value : g.entry;
      var a = await Editor.analyze(code, path);
      ed.setProblems(a.problems);
      banner.replaceChildren(Editor.problemBanner(a, ed));
      var errs = a.problems.filter(function (p) { return p.severity === 'error'; }).length;
      var usesKit = /GameSystem\s*\.\s*(autoSave|save)\s*\(/.test(code);
      status.textContent = (errs ? errs + ' problem(s) found. Red lines show where. ' : 'No syntax errors found. ') +
        (usesKit ? 'It uses the Save Kit.' : 'Heads up: I don\'t see GameSystem.autoSave in this code yet.');
    }

    function glue() {
      var ta = h('textarea.input', { placeholder: 'Paste the next part the AI sent…', style: { minHeight: '220px' } });
      UI.modal({
        title: 'Glue on the rest',
        icon: 'fileAdd',
        wide: true,
        body: h('div', h('p', 'Paste the rest of the code the AI sent. I\'ll add it to the end and remove any repeated part.'), ta),
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Glue it on', kind: 'primary', onClick: function () {
          ed.setValue(Editor.glue(ed.getValue(), ta.value));
          ed.focusEnd();
        } }]
      });
      setTimeout(function () { ta.focus(); }, 60);
    }

    async function save() {
      var code = ed.getValue();
      if (!code.trim()) { UI.toast('Paste the new code first.', { type: 'warn' }); return false; }
      var path = sel ? sel.value : g.entry;
      var a = await Editor.analyze(code, path);
      if (a.cut) {
        var go = await UI.confirm('The code looks cut off', 'The AI\'s code seems to stop before the end, so the game will probably break. Save it anyway?', { ok: 'Save anyway', cancel: 'Go back' });
        if (!go) return false;
      }
      var old = await GS2DB.getFile(id, path);
      if (old) await GS2DB.kvSet('upgradeBackup:' + id, { p: path, b: old.b, t: old.t, time: Date.now() });
      var type = U.mimeOf(path);
      await GS2DB.putFile(id, path, new Blob([code], { type: type }), type);
      var recs = await GS2DB.filesOf(id);
      var cur = D.get(id);
      await D.updateGame(id, {
        size: recs.reduce(function (s, r) { return s + r.b.size; }, 0),
        fileCount: recs.length,
        source: cur.source === 'site' ? 'local' : cur.source,
        siteFiles: cur.source === 'site' ? undefined : cur.siteFiles
      }, { touch: true });
      Sound.good();
      UI.toast('Upgraded! Play it and it should continue where you left off from now on.', {
        type: 'good', timeout: 9000, sound: false,
        actions: [{ label: 'Play now', kind: 'primary', onClick: function () { Player.launch(id, { fresh: true }); } }]
      });
      return true;
    }
  }

  async function undo(id) {
    var bk = await GS2DB.kvGet('upgradeBackup:' + id);
    if (!bk) { UI.toast('There\'s no upgrade to undo.', { type: 'warn' }); return; }
    var g = D.get(id);
    var ok = await UI.confirm('Undo the upgrade?', 'This puts back the code "' + (g ? g.name : 'the game') + '" had before the last upgrade (' + U.timeAgo(bk.time) + '). Your saves stay.', { ok: 'Undo it', icon: 'undo' });
    if (!ok) return;
    await GS2DB.putFile(id, bk.p, bk.b, bk.t);
    await GS2DB.kvDel('upgradeBackup:' + id);
    await D.updateGame(id, {}, { touch: true });
    UI.toast('Upgrade undone.', { icon: 'undo' });
  }

  window.Upgrade = { open: open, undo: undo, saveRules: saveRules, kitSnippet: kitSnippet, buildMessage: buildMessage };
})();
