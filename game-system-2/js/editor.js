/* Game System 2.0 — code editor.
   - CodeMirror editor with a neon theme, file list, tabs, live preview
   - finds syntax errors before you even run the game (Acorn parser)
   - spots AI code that got cut off / has "rest of code here" holes, and glues continuations on
   - unsaved changes survive a closed browser (drafts) */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;

  /* ---------------- lazy loading ---------------- */
  var loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { loaded[src] = null; reject(new Error('Could not load ' + src + ' (are you offline?)')); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  function loadCss(href) {
    if (loaded[href]) return loaded[href];
    loaded[href] = new Promise(function (resolve) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = resolve;
      l.onerror = resolve;
      document.head.insertBefore(l, document.head.querySelector('link[href="css/app.css"]'));
    });
    return loaded[href];
  }
  function loadCM() { return Promise.all([loadCss('vendor/codemirror.css'), loadScript('vendor/codemirror.min.js')]); }
  function loadAcorn() { return loadScript('vendor/acorn.min.js'); }

  /* ---------------- code analysis ---------------- */
  function lineIndex(text) {
    var starts = [0];
    for (var i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
    return function (pos) {
      var lo = 0, hi = starts.length - 1;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
      return { line: lo + 1, col: pos - starts[lo] };
    };
  }

  function friendly(msg) {
    var m = String(msg).replace(/\s*\(\d+:\d+\)\s*$/, '');
    var map = [
      [/^Unterminated string constant/, 'A piece of text (string) is never closed. A quote mark \' or " is missing'],
      [/^Unterminated template/, 'A `template string` is never closed (missing a ` backtick)'],
      [/^Unterminated comment/, 'A /* comment */ is never closed'],
      [/^Unterminated regular expression/, 'A regular expression /.../ is never closed'],
      [/^Unexpected token/, 'Something unexpected is here. Maybe a missing ) } ] , or ;'],
      [/^Unexpected character/, 'There\'s a weird character here that isn\'t allowed in code'],
      [/^Identifier '(.+)' has already been declared/, 'The name "$1" is declared twice (let/const used twice for the same name)'],
      [/^'return' outside of function/, '"return" is used outside of a function'],
      [/^Unexpected keyword '(.+)'/, 'The word "$1" can\'t be used here'],
      [/^Assigning to rvalue/, 'You can\'t assign a value here (left side of = is wrong)'],
      [/^Cannot use keyword 'await' outside an async function/, '"await" can only be used inside an async function']
    ];
    for (var i = 0; i < map.length; i++) {
      var mm = map[i][0].exec(m);
      if (mm) return map[i][1].replace('$1', mm[1] || '') + '  (' + m + ')';
    }
    return m;
  }

  var PLACEHOLDER = /(?:\/\/|\/\*|<!--|#)\s*(?:\.{2,}|…)?\s*(?:the\s+)?(?:rest of (?:the )?(?:code|game|file|script|functions?)|(?:code|everything) (?:remains|stays|is) (?:the )?(?:same|unchanged)|same as (?:before|above)|existing code|previous code|keep (?:the )?(?:rest|existing)|add (?:the )?(?:rest|remaining)|remaining (?:code|functions)|unchanged)\b/i;
  var PLACEHOLDER2 = /^\s*(?:\/\/|\/\*|<!--)\s*(?:\.{3}|…)\s*(?:\*\/|-->)?\s*$/;

  function stripFences(text) {
    if (text.indexOf('```') < 0) return text;
    var m = /```[a-zA-Z0-9_-]*[^\n]*\n([\s\S]*?)(?:\n```|$)/.exec(text);
    return m ? m[1] : text.replace(/^\s*```.*$/gm, '');
  }

  function parseJs(code, isModule) {
    var opts = { ecmaVersion: 'latest', sourceType: isModule ? 'module' : 'script', allowHashBang: true, locations: true, allowReturnOutsideFunction: false };
    try {
      acorn.parse(code, opts);
      return null;
    } catch (e) {
      if (!isModule && /'import' and 'export' may appear only|Cannot use 'import\.meta'/.test(e.message)) {
        try { acorn.parse(code, Object.assign({}, opts, { sourceType: 'module' })); return null; } catch (e2) { return e2; }
      }
      return e;
    }
  }

  /* Returns {problems:[{line,col,msg,severity,kind}], cut:{line,reason}|null} */
  async function analyze(text, path) {
    try { await loadAcorn(); } catch (e) { return { problems: [], cut: null }; }
    return analyzeSync(text, path);
  }
  function analyzeSync(text, path) {
    var problems = [];
    var cut = null;
    if (!text || !text.trim() || !window.acorn) return { problems: problems, cut: cut };
    var at = lineIndex(text);
    var lines = text.split('\n');

    lines.forEach(function (l, i) {
      if (/^\s*```/.test(l)) problems.push({ line: i + 1, col: 0, msg: 'This ``` line comes from the AI chat. It isn\'t code, so delete it', severity: 'error', kind: 'fence' });
      else if (l.length < 400 && (PLACEHOLDER.test(l) || PLACEHOLDER2.test(l))) {
        problems.push({ line: i + 1, col: 0, msg: 'The AI skipped code here ("' + l.trim().slice(0, 70) + '"). The game will be missing that part', severity: 'warn', kind: 'placeholder' });
      }
    });

    var trimmed = text.replace(/\s+$/, '');
    if (/\.html?$/i.test(path || '')) {
      var re = /<script\b([^>]*)>([\s\S]*?)(<\/script\s*>|$)/gi;
      var m;
      while ((m = re.exec(text))) {
        var attrs = m[1] || '';
        var body = m[2];
        var closed = !!m[3];
        var startIdx = m.index + m[0].indexOf('>') + 1;
        if (!closed) {
          cut = cut || { line: lines.length, reason: 'A <script> is never closed. The code was probably cut off at the end' };
        }
        if (m[0].length === 0) { re.lastIndex++; continue; }
        var tm = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs);
        var type = tm ? tm[1].toLowerCase() : '';
        var isModule = type === 'module';
        var isJs = !type || isModule || /^(text|application)\/(javascript|ecmascript|x-javascript)$/.test(type);
        if (!isJs || !body.trim()) continue;
        var err = parseJs(body, isModule);
        if (err && err.loc) {
          var p = at(startIdx + err.pos);
          problems.push({ line: p.line, col: p.col, msg: friendly(err.message), severity: 'error', kind: 'syntax', raw: err.message });
          var bodyEnd = body.replace(/\s+$/, '').length;
          if (err.pos >= bodyEnd - 1 && /Unexpected token|Unterminated|Unexpected end/i.test(err.message)) {
            cut = cut || { line: p.line, reason: 'The code ends in the middle of something (like a missing } at the very end). The AI probably got cut off' };
          }
        }
        if (!closed) break;
      }
      if (!cut && /<html\b/i.test(text) && !/<\/html\s*>$/i.test(trimmed) && !/<\/body\s*>$/i.test(trimmed) && !/>$/.test(trimmed)) {
        cut = { line: lines.length, reason: 'The file stops suddenly (no </html> at the end). The AI probably got cut off' };
      }
    } else if (/\.(m?js|cjs)$/i.test(path || '')) {
      var e2 = parseJs(text, /^\s*(import|export)\s/m.test(text));
      if (e2 && e2.loc) {
        problems.push({ line: e2.loc.line, col: e2.loc.column, msg: friendly(e2.message), severity: 'error', kind: 'syntax', raw: e2.message });
        if (e2.pos >= trimmed.length - 1) cut = { line: e2.loc.line, reason: 'The code ends in the middle of something. The AI probably got cut off' };
      }
    } else if (/\.json$/i.test(path || '')) {
      try { JSON.parse(text); } catch (e3) {
        var pm = /position (\d+)/.exec(e3.message);
        var pp = pm ? at(Number(pm[1])) : { line: 1, col: 0 };
        problems.push({ line: pp.line, col: pp.col, msg: 'JSON error: ' + e3.message, severity: 'error', kind: 'syntax' });
      }
    }
    problems.sort(function (a, b) { return a.line - b.line; });
    return { problems: problems, cut: cut };
  }

  /* Glue a continuation onto code that got cut off, removing the overlap */
  function glue(a, b) {
    b = stripFences(b);
    if (!a.trim()) return b;
    if (!b.trim()) return a;
    var aLines = a.replace(/\s+$/, '').split('\n');
    var bLines = b.replace(/^\s*\n/, '').split('\n');
    var max = Math.min(80, aLines.length, bLines.length);
    for (var n = max; n >= 1; n--) {
      var tail = aLines.slice(-n).map(function (s) { return s.trim(); }).join('\n');
      var head = bLines.slice(0, n).map(function (s) { return s.trim(); }).join('\n');
      if (tail === head && tail.replace(/[\s{}();]/g, '').length >= 6) {
        return aLines.concat(bLines.slice(n)).join('\n');
      }
    }
    var last = aLines[aLines.length - 1];
    var lastT = last.trim();
    var firstB = bLines[0].trim();
    if (lastT.length >= 3 && firstB.indexOf(lastT) === 0) {
      aLines[aLines.length - 1] = bLines[0];
      return aLines.concat(bLines.slice(1)).join('\n');
    }
    if (!lastT || /[;{}>)\]]$/.test(lastT) || /\n\s*$/.test(a)) return a.replace(/\s+$/, '') + '\n' + bLines.join('\n');
    return a.replace(/[ \t]+$/, '') + bLines.join('\n');
  }

  function lastLines(text, n) {
    return text.replace(/\s+$/, '').split('\n').filter(function (l) { return l.trim(); }).slice(-n).join('\n');
  }

  function problemBanner(a, ed) {
    var frag = document.createDocumentFragment();
    if (a.cut) {
      frag.appendChild(h('div.cut-banner',
        h('span', I('scissors'), ' ', h('b', 'The AI\'s code got cut off'), ' around line ' + a.cut.line + '. ' + a.cut.reason + '.'),
        h('div.grow'),
        h('button.btn.sm', { onclick: function () {
          var msg = 'Your code got cut off. Continue EXACTLY where you stopped. Don\'t repeat anything before this part:\n\n' + lastLines(ed.getValue(), 3);
          U.copyText(msg).then(function () { UI.toast('Copied! Paste it to the AI, then glue its answer on with "Glue on more code".', { icon: 'clipboard' }); });
        } }, I('clipboard'), 'Copy "continue" message')));
    }
    var ph = a.problems.filter(function (p) { return p.kind === 'placeholder'; });
    if (ph.length) {
      frag.appendChild(h('div.cut-banner',
        h('span', I('warn'), ' ', h('b', 'The AI skipped some code'), ' (line ' + ph.map(function (p) { return p.line; }).slice(0, 4).join(', ') + '). Those parts of the game will be missing.'),
        h('div.grow'),
        h('button.btn.sm', { onclick: function () {
          U.copyText('Please send me the COMPLETE file from start to finish. Don\'t skip anything and don\'t write "rest of the code stays the same". I need every single line.')
            .then(function () { UI.toast('Copied! Paste it to the AI.', { icon: 'clipboard' }); });
        } }, I('clipboard'), 'Copy "send full code" message'),
        h('button.btn.sm.ghost', { onclick: function () { ed.jump(ph[0].line, 0); } }, 'Show me')));
    }
    var fence = a.problems.filter(function (p) { return p.kind === 'fence'; });
    if (fence.length) {
      frag.appendChild(h('div.cut-banner',
        h('span', I('warn'), ' There are ``` lines from the AI chat in here. Those break the game.'),
        h('div.grow'),
        h('button.btn.sm', { onclick: function () { ed.setValue(ed.getValue().split('\n').filter(function (l) { return !/^\s*```/.test(l); }).join('\n')); } }, 'Remove them')));
    }
    return frag;
  }

  /* ---------------- CodeMirror helpers ---------------- */
  function modeFor(path) {
    if (/\.html?$/i.test(path)) return 'htmlmixed';
    if (/\.(m?js|cjs)$/i.test(path)) return 'javascript';
    if (/\.css$/i.test(path)) return 'css';
    if (/\.(json|webmanifest|gltf)$/i.test(path)) return { name: 'javascript', json: true };
    if (/\.(svg|xml)$/i.test(path)) return 'xml';
    return 'text/plain';
  }

  function cmOptions(extra) {
    return Object.assign({
      theme: 'gs2',
      lineNumbers: true,
      lineWrapping: false,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      matchBrackets: true,
      autoCloseBrackets: true,
      autoCloseTags: true,
      matchTags: { bothTags: true },
      styleActiveLine: true,
      gutters: ['CodeMirror-lint-markers', 'CodeMirror-linenumbers'],
      extraKeys: {
        'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
        'Ctrl-F': 'findPersistent', 'Cmd-F': 'findPersistent',
        'Ctrl-G': 'jumpToLine',
        Tab: function (cm) { if (cm.somethingSelected()) cm.indentSelection('add'); else cm.replaceSelection('  ', 'end'); },
        'Shift-Tab': function (cm) { cm.indentSelection('subtract'); }
      }
    }, extra || {});
  }

  function markProblems(cm, problems, state) {
    (state.marks || []).forEach(function (m) { m.clear(); });
    (state.lines || []).forEach(function (l) { cm.removeLineClass(l, 'background', 'cm-errline'); });
    cm.clearGutter('CodeMirror-lint-markers');
    state.marks = [];
    state.lines = [];
    problems.forEach(function (p) {
      var line = Math.max(0, Math.min(cm.lineCount() - 1, p.line - 1));
      var len = cm.getLine(line).length;
      var from = { line: line, ch: Math.min(p.col || 0, len) };
      var to = { line: line, ch: Math.min((p.col || 0) + 1, len) };
      if (from.ch === to.ch) {
        from = { line: line, ch: Math.max(0, len - 1) };
        to = { line: line, ch: len };
      }
      if (p.severity === 'error') {
        state.marks.push(cm.markText(from, to, { className: 'CodeMirror-lint-mark-error', title: p.msg }));
        state.lines.push(cm.addLineClass(line, 'background', 'cm-errline'));
      }
      var g = document.createElement('div');
      g.className = 'CodeMirror-lint-marker-' + (p.severity === 'error' ? 'error' : 'warning');
      g.title = p.msg;
      cm.setGutterMarker(line, 'CodeMirror-lint-markers', g);
    });
  }

  /* small editor used by the "paste code" dialog */
  async function mini(host, value, opts) {
    opts = opts || {};
    var cm = null;
    var ta = null;
    var state = {};
    try {
      await loadCM();
      cm = CodeMirror(host, cmOptions({ value: value || '', mode: 'htmlmixed', placeholder: opts.placeholder }));
      cm.getWrapperElement().style.position = 'absolute';
      cm.getWrapperElement().style.inset = '0';
      cm.getWrapperElement().style.height = '100%';
      setTimeout(function () { cm.refresh(); cm.focus(); }, 60);
    } catch (e) {
      ta = h('textarea.input', { style: { position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 0 }, placeholder: opts.placeholder || '' });
      ta.value = value || '';
      host.appendChild(ta);
    }
    var api = {
      cm: cm,
      getValue: function () { return cm ? cm.getValue() : ta.value; },
      setValue: function (v) { if (cm) cm.setValue(v); else { ta.value = v; ta.dispatchEvent(new Event('input')); } },
      onChange: function (fn) { if (cm) cm.on('change', fn); else ta.addEventListener('input', fn); },
      setProblems: function (p) { if (cm) markProblems(cm, p, state); },
      focusEnd: function () { if (cm) { cm.focus(); cm.setCursor(cm.lineCount(), 0); } else ta.focus(); },
      jump: function (line) { if (cm) { cm.focus(); cm.setCursor({ line: line - 1, ch: 0 }); cm.scrollIntoView({ line: line - 1, ch: 0 }, 120); } }
    };
    return api;
  }

  /* ---------------- the full editor view ---------------- */
  var E = null;
  var MAX_EDIT = 4 * 1024 * 1024;

  function draftKey(id, p) { return 'gs2:draft:' + id + ':' + p; }

  function persistState() {
    if (!E) return;
    var cursors = {};
    E.files.forEach(function (f, p) { if (f.doc) { var c = f.doc.getCursor(); cursors[p] = { line: c.line, ch: c.ch }; } });
    D.ui.editor = { id: E.id, tabs: E.tabs.slice(), active: E.active, preview: E.preview, cursors: cursors };
    D.saveUISoon();
  }

  async function open(id, opts) {
    opts = opts || {};
    var g = D.get(id);
    if (!g) return;
    if (g.source === 'link') { UI.toast('Links don\'t have code to edit.', { type: 'warn' }); return; }
    if (E && E.id !== id) {
      if (!(await closeEditor())) return;
    }
    if (!E) {
      try { await Promise.all([loadCM(), loadAcorn()]); } catch (err) {
        UI.alert('Editor couldn\'t load', err.message);
        return;
      }
      if (g.source === 'site') {
        try { await D.ensureLocalFiles(g); } catch (err) { UI.alert('Couldn\'t download the game files', err.message); return; }
      }
      var recs = await GS2DB.filesOf(id);
      E = { id: id, files: new Map(), tabs: [], active: null, preview: false, cm: null, state: {}, logs: null, unsink: null };
      recs.sort(function (a, b) { return a.p.localeCompare(b.p); }).forEach(function (r) {
        E.files.set(r.p, { p: r.p, b: r.b, t: r.t, text: null, doc: null, dirty: false, isText: U.isTextPath(r.p) || GS2Shared.isTextMime(r.t) });
      });
      E.logs = new Player.LogStore(function () { if (E && E.renderProblems) E.renderProblems(); });
      var saved = D.ui.editor && D.ui.editor.id === id ? D.ui.editor : null;
      if (saved) {
        E.preview = !!saved.preview;
        E.savedCursors = saved.cursors || {};
        (saved.tabs || []).forEach(function (p) { if (E.files.has(p) && E.tabs.indexOf(p) < 0) E.tabs.push(p); });
      }
      buildView();
      var restored = 0;
      for (var [p, f] of E.files) {
        if (!f.isText) continue;
        var draft = null;
        try { draft = localStorage.getItem(draftKey(id, p)); } catch (e) { /* ignore */ }
        if (draft != null) {
          await ensureDoc(f);
          if (draft !== f.doc.getValue()) { f.doc.setValue(draft); f.dirty = true; restored++; if (E.tabs.indexOf(p) < 0) E.tabs.push(p); }
          else { try { localStorage.removeItem(draftKey(id, p)); } catch (e) { /* ignore */ } }
        }
      }
      var first = (saved && saved.active && E.files.has(saved.active)) ? saved.active : (E.files.has(g.entry) ? g.entry : (E.files.keys().next().value || null));
      if (first) await activate(first);
      if (restored) UI.toast('Brought back your unsaved changes in ' + restored + ' file' + (restored === 1 ? '' : 's') + '.', { icon: 'reload' });
      if (E.preview) startPreview();
      renderFiles();
    }
    document.querySelector('.tab-editor').hidden = false;
    App.go('editor', { noSound: !!opts.quiet });
    if (opts.file && E.files.has(opts.file)) {
      await activate(opts.file);
      if (opts.line) jump(opts.line, opts.col || 0);
    } else if (opts.file) {
      var low = opts.file.toLowerCase();
      var hit = Array.from(E.files.keys()).find(function (k) { return k.toLowerCase() === low; });
      if (hit) { await activate(hit); if (opts.line) jump(opts.line, opts.col || 0); }
      else UI.toast('"' + opts.file + '" is not one of this game\'s files.', { type: 'warn' });
    }
    setTimeout(function () { if (E && E.cm) E.cm.refresh(); }, 80);
    persistState();
  }

  async function ensureDoc(f) {
    if (f.doc) return f.doc;
    if (f.text == null) f.text = f.b.size > MAX_EDIT ? null : await f.b.text();
    f.doc = CodeMirror.Doc(f.text == null ? '' : f.text, modeFor(f.p));
    return f.doc;
  }


  function buildView() {
    var g = D.get(E.id);
    var view = document.getElementById('view-editor');
    var title = h('div.ed-title', g.name);
    var status = h('div.small.muted.ed-status');
    var previewBtn = h('button.btn.sm' + (E.preview ? '.on' : ''), { onclick: togglePreview, title: 'Live preview next to the code' }, UI.icon('eye'), 'Preview');
    var top = h('div.ed-top',
      h('button.btn.sm.ghost', { onclick: function () { App.go('home'); }, title: 'Back to menu' }, UI.icon('back'), 'Back'),
      title,
      h('div.sep'),
      h('button.btn.sm.primary', { onclick: function () { saveAll(); }, title: 'Save (Ctrl+S)' }, UI.icon('save'), 'Save'),
      h('button.btn.sm', { onclick: async function () { if (await saveAll()) Player.launch(E.id); }, title: 'Save and play (Ctrl+Enter)' }, UI.icon('play'), 'Play'),
      previewBtn,
      h('div.sep'),
      h('button.icon-btn.sm', { title: 'Find (Ctrl+F)', onclick: function () { if (E.cm) E.cm.execCommand('findPersistent'); } }, UI.icon('search')),
      h('button.icon-btn.sm', { title: 'Undo (Ctrl+Z)', 'aria-label': 'Undo', onclick: function () { if (E.cm) E.cm.undo(); } }, I('undo')),
      h('button.icon-btn.sm', { title: 'Redo (Ctrl+Y)', 'aria-label': 'Redo', onclick: function () { if (E.cm) E.cm.redo(); } }, I('redo')),
      h('button.btn.sm', { onclick: copyForAI, title: 'Copy the errors so you can paste them to an AI' }, I('clipboard'), 'Copy errors for AI'),
      h('button.btn.sm', { onclick: glueDialog, title: 'The AI sent the rest of the code in another message? Glue it on here.' }, I('fileAdd'), 'Glue on more code'),
      h('div.grow'),
      status,
      h('button.icon-btn.sm', { title: 'Close editor', onclick: function () { closeEditor().then(function (ok) { if (ok) App.go('home'); }); } }, UI.icon('x')));
    E.previewBtn = previewBtn;
    E.status = status;

    var files = h('div.ed-files');
    var tabs = h('div.ed-tabs');
    var banner = h('div.ed-banner');
    var host = h('div.ed-host');
    var probList = h('div.con-list');
    var probTab = 'code';
    var probCount = h('span.small.muted');
    var seg = h('div.seg',
      h('button.on', { onclick: function (e) { probTab = 'code'; segOn(e.target); renderProblems(); } }, 'Code problems'),
      h('button', { onclick: function (e) { probTab = 'console'; segOn(e.target); renderProblems(); } }, 'Game console'));
    function segOn(b) { seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); }
    var problems = h('div.ed-problems',
      h('div.con-head', h('span.ttl', 'PROBLEMS'), probCount, seg, h('div.grow'),
        h('button.btn.sm.ghost', { title: 'Show/hide problems', 'aria-label': 'Show or hide problems', onclick: function () { problems.classList.toggle('collapsed'); if (E.cm) E.cm.refresh(); } }, I('menu'))),
      probList);
    var center = h('div.ed-center', tabs, h('div', { style: { display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: 0 } }, banner, host), problems);
    var pv = h('div.ed-preview',
      h('div.pv-head', I('eye'), h('span', 'LIVE PREVIEW'), h('div.grow'),
        h('button.btn.sm.ghost', { onclick: function () { reloadPreview(); }, title: 'Reload preview' }, UI.icon('reload'))),
      h('div', { style: { position: 'relative', minHeight: 0 } }));
    var main = h('div.ed-main' + (E.preview ? '.with-preview' : ''), files, center, E.preview ? pv : null);
    var root = h('div.ed', top, main);
    view.replaceChildren(root);
    E.root = root;
    E.main = main;
    E.pv = pv;
    E.filesEl = files;
    E.tabsEl = tabs;
    E.banner = banner;
    E.host = host;

    E.cm = CodeMirror(host, cmOptions({ value: '', mode: 'htmlmixed' }));
    E.cm.on('change', function () {
      var f = E.files.get(E.active);
      if (!f) return;
      if (!f.dirty) { f.dirty = true; renderTabs(); renderFiles(); }
      scheduleDraft(f);
      scheduleCheck();
      updateStatus();
    });
    E.cm.on('cursorActivity', function () { updateStatus(); persistStateSoon(); });
    E.cm.setOption('extraKeys', Object.assign({}, E.cm.getOption('extraKeys'), {
      'Ctrl-S': function () { saveAll(); }, 'Cmd-S': function () { saveAll(); },
      'Ctrl-Enter': function () { saveAll().then(function (ok) { if (ok) Player.launch(E.id); }); }
    }));

    function renderProblems() {
      if (!E) return;
      if (probTab === 'console') {
        Player.renderConsole(probList, E.logs, { onJump: function (file, line, col) { open(E.id, { file: file, line: line, col: col }); } });
      } else {
        probList.replaceChildren();
        var a = E.analysis || { problems: [] };
        if (!a.problems.length) probList.appendChild(h('div.con-empty', 'No problems found in ' + (E.active || 'this file') + '.'));
        a.problems.forEach(function (p) {
          probList.appendChild(h('div.con-row.' + (p.severity === 'error' ? 'error' : 'warn'),
            h('span.lv', I(p.severity === 'error' ? 'alert' : 'warn')), h('span.tx', p.msg),
            h('span.where', { onclick: function () { jump(p.line, p.col); } }, E.active + ':' + p.line)));
        });
      }
      var errs = (E.analysis ? E.analysis.problems.length : 0);
      probCount.textContent = errs ? errs + ' in this file' + (E.logs.errors ? ' · ' + E.logs.errors + ' from the game' : '') : (E.logs.errors ? E.logs.errors + ' from the game' : '');
    }
    E.renderProblems = renderProblems;

    files.addEventListener('dragover', function (e) { e.preventDefault(); });
  }

  var persistStateSoon = U.debounce(persistState, 600);

  function updateStatus() {
    if (!E || !E.cm || !E.status) return;
    var c = E.cm.getCursor();
    var dirty = Array.from(E.files.values()).filter(function (f) { return f.dirty; }).length;
    E.status.textContent = (dirty ? '● ' + dirty + ' unsaved · ' : '') + 'Ln ' + (c.line + 1) + ', Col ' + (c.ch + 1);
  }

  var scheduleCheck = U.debounce(function () { check(); }, 450);
  function check() {
    if (!E || !E.active) return;
    var f = E.files.get(E.active);
    if (!f || !f.doc) { E.analysis = { problems: [], cut: null }; E.banner.replaceChildren(); E.renderProblems(); return; }
    var a = analyzeSync(f.doc.getValue(), f.p);
    E.analysis = a;
    markProblems(E.cm, a.problems, E.state);
    E.banner.replaceChildren(problemBanner(a, {
      getValue: function () { return E.cm.getValue(); },
      setValue: function (v) { E.cm.setValue(v); },
      jump: jump
    }));
    E.renderProblems();
  }

  var draftTimers = {};
  function scheduleDraft(f) {
    clearTimeout(draftTimers[f.p]);
    draftTimers[f.p] = setTimeout(function () {
      if (!E || !f.doc) return;
      var v = f.doc.getValue();
      if (v.length < 2500000) { try { localStorage.setItem(draftKey(E.id, f.p), v); } catch (e) { /* full */ } }
    }, 1200);
  }

  function iconFor(p) {
    if (/\.html?$/i.test(p)) return I('code', 'ft-html');
    if (/\.(m?js)$/i.test(p)) return I('js', 'ft-js');
    if (/\.css$/i.test(p)) return I('css', 'ft-css');
    if (U.isImagePath(p)) return I('image', 'ft-img');
    if (U.isAudioPath(p)) return I('music', 'ft-audio');
    if (/\.json$/i.test(p)) return I('braces', 'ft-json');
    return I('file');
  }

  function renderFiles() {
    if (!E) return;
    var g = D.get(E.id);
    var list = E.filesEl;
    list.replaceChildren(h('div.fhead', h('span', 'FILES'),
      h('button.icon-btn.sm', { title: 'New file', onclick: newFile }, UI.icon('plus')),
      h('button.icon-btn.sm', { title: 'Add files from your PC', onclick: uploadFiles }, UI.icon('upload'))));
    Array.from(E.files.keys()).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (p) {
      var f = E.files.get(p);
      var b = h('button.ed-file' + (p === E.active ? '.on' : ''), {
        title: p,
        onclick: function () { activate(p); },
        oncontextmenu: function (e) { e.preventDefault(); fileMenu(p, e.clientX, e.clientY); }
      }, iconFor(p), h('span', p), f.dirty ? h('i.dot') : (p === g.entry ? h('span.entry', 'MAIN') : null));
      list.appendChild(b);
    });
    list.appendChild(h('div.small.dim', { style: { padding: '10px 6px' } }, 'Right-click a file for more options.'));
  }

  function renderTabs() {
    if (!E) return;
    E.tabsEl.replaceChildren();
    E.tabs.forEach(function (p) {
      var f = E.files.get(p);
      if (!f) return;
      E.tabsEl.appendChild(h('button.ed-tab' + (p === E.active ? '.on' : ''), { onclick: function () { activate(p); }, title: p },
        iconFor(p), h('span', p.split('/').pop()),
        f.dirty ? h('i.dirty') : null,
        h('span.x', { title: 'Close tab', onclick: function (e) { e.stopPropagation(); closeTab(p); } }, '×')));
    });
  }

  async function activate(p) {
    if (!E) return;
    var f = E.files.get(p);
    if (!f) return;
    if (E.tabs.indexOf(p) < 0) E.tabs.push(p);
    E.active = p;
    var cmWrap = E.cm.getWrapperElement();
    var old = E.host.querySelector('.ed-viewer');
    if (old) old.remove();
    if (f.isText && f.b.size <= MAX_EDIT) {
      await ensureDoc(f);
      if (E.active !== p) return;
      cmWrap.style.display = '';
      if (E.cm.getDoc() !== f.doc) E.cm.swapDoc(f.doc);
      var cur = E.savedCursors && E.savedCursors[p];
      if (cur) { delete E.savedCursors[p]; f.doc.setCursor(cur); E.cm.scrollIntoView(cur, 150); }
      setTimeout(function () { if (E && E.cm) { E.cm.refresh(); E.cm.focus(); } }, 20);
    } else {
      cmWrap.style.display = 'none';
      var viewer = h('div.ed-viewer');
      var url = URL.createObjectURL(f.b);
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      if (U.isImagePath(p)) viewer.appendChild(h('div', { style: { textAlign: 'center' } }, h('img', { src: url, alt: p }), h('p.muted.small', p + ' · ' + U.fmtBytes(f.b.size))));
      else if (U.isAudioPath(p)) viewer.appendChild(h('div', { style: { textAlign: 'center' } }, h('div.ed-big-ico', I('music')), h('audio', { src: url, controls: true }), h('p.muted.small', p + ' · ' + U.fmtBytes(f.b.size))));
      else viewer.appendChild(h('div', { style: { textAlign: 'center' } }, h('div.ed-big-ico', I('box')),
        h('p', p), h('p.muted.small', U.fmtBytes(f.b.size) + (f.isText ? ' · too big to edit here' : ' · not a text file')),
        h('button.btn.sm', { onclick: function () { U.downloadBlob(f.b, p.split('/').pop()); } }, UI.icon('download'), 'Download')));
      E.host.appendChild(viewer);
    }
    renderTabs();
    renderFiles();
    check();
    updateStatus();
    persistState();
  }

  async function closeTab(p) {
    var f = E.files.get(p);
    if (f && f.dirty) {
      var ok = await UI.confirm('Close without saving?', '"' + p + '" has changes that aren\'t saved. They\'ll stay as a draft until you save or discard them.', { ok: 'Close tab' });
      if (!ok) return;
    }
    var i = E.tabs.indexOf(p);
    if (i >= 0) E.tabs.splice(i, 1);
    if (E.active === p) {
      var next = E.tabs[Math.min(i, E.tabs.length - 1)];
      if (next) activate(next);
      else { E.active = null; E.cm.swapDoc(CodeMirror.Doc('', 'text/plain')); renderTabs(); renderFiles(); check(); }
    } else renderTabs();
    persistState();
  }

  function jump(line, col) {
    if (!E || !E.cm) return;
    var pos = { line: Math.max(0, line - 1), ch: Math.max(0, col || 0) };
    E.cm.focus();
    E.cm.setCursor(pos);
    E.cm.scrollIntoView(pos, Math.round(E.cm.getScrollInfo().clientHeight / 2.5));
    var lh = E.cm.addLineClass(pos.line, 'background', 'cm-errline');
    setTimeout(function () { if (E && E.cm) E.cm.removeLineClass(lh, 'background', 'cm-errline'); check(); }, 1400);
  }

  async function saveAll() {
    if (!E) return false;
    var g = D.get(E.id);
    var dirty = Array.from(E.files.values()).filter(function (f) { return f.dirty && f.doc; });
    if (!dirty.length) { UI.toast('Nothing to save. All good.', { sound: false }); return true; }
    try {
      for (var i = 0; i < dirty.length; i++) {
        var f = dirty[i];
        var text = f.doc.getValue();
        var type = f.t || U.mimeOf(f.p);
        f.b = new Blob([text], { type: type });
        f.text = text;
        await GS2DB.putFile(E.id, f.p, f.b, type);
        f.dirty = false;
        try { localStorage.removeItem(draftKey(E.id, f.p)); } catch (e) { /* ignore */ }
      }
      var size = 0;
      E.files.forEach(function (f) { size += f.b.size; });
      await D.updateGame(E.id, { size: size, fileCount: E.files.size, source: g.source === 'site' ? 'local' : g.source, siteFiles: g.source === 'site' ? undefined : g.siteFiles }, { touch: true });
      renderTabs();
      renderFiles();
      updateStatus();
      Sound.select();
      var errs = E.analysis ? E.analysis.problems.filter(function (p) { return p.severity === 'error'; }).length : 0;
      UI.toast(errs ? 'Saved, but there ' + (errs === 1 ? 'is 1 problem' : 'are ' + errs + ' problems') + ' in this file.' : 'Saved!', { type: errs ? 'warn' : 'good', sound: false });
      if (E.preview) reloadPreview();
      return true;
    } catch (err) {
      UI.alert('Save failed', err.message || String(err));
      return false;
    }
  }

  async function closeEditor() {
    if (!E) return true;
    var dirty = Array.from(E.files.values()).filter(function (f) { return f.dirty; });
    if (dirty.length) {
      var choice = await new Promise(function (resolve) {
        var done = false;
        UI.modal({
          title: 'Unsaved changes',
          body: h('p', 'You have unsaved changes in ' + dirty.map(function (f) { return f.p; }).join(', ') + '. Save them?'),
          actions: [
            { label: 'Cancel', kind: 'ghost', onClick: function () { done = true; resolve('cancel'); } },
            { label: 'Throw away', kind: 'danger', onClick: function () { done = true; resolve('discard'); } },
            { label: 'Save', kind: 'primary', onClick: function () { done = true; resolve('save'); } }
          ],
          onClose: function () { if (!done) resolve('cancel'); }
        });
      });
      if (choice === 'cancel') return false;
      if (choice === 'save' && !(await saveAll())) return false;
      if (choice === 'discard') dirty.forEach(function (f) { try { localStorage.removeItem(draftKey(E.id, f.p)); } catch (e) { /* ignore */ } });
    }
    stopPreview();
    E = null;
    D.ui.editor = null;
    D.saveUI();
    document.querySelector('.tab-editor').hidden = true;
    document.getElementById('view-editor').replaceChildren();
    return true;
  }

  /* ---------------- files ---------------- */
  function cleanName(n) { return GS2Zip.cleanPath(String(n || '').trim()); }

  async function newFile() {
    var name = await UI.prompt('New file', 'File name (like script.js, style.css or levels/level2.json)', '', { ok: 'Create' });
    name = cleanName(name);
    if (!name) return;
    if (E.files.has(name)) { UI.toast('A file with that name already exists', { type: 'warn' }); return; }
    var t = U.mimeOf(name);
    var b = new Blob([''], { type: t });
    await GS2DB.putFile(E.id, name, b, t);
    E.files.set(name, { p: name, b: b, t: t, text: '', doc: null, dirty: false, isText: true });
    await activate(name);
  }

  function uploadFiles() {
    Importer.pickFiles({ onPick: function (list) { addFiles(list); } });
  }

  async function addFiles(list) {
    if (!E || !list || !list.length) return;
    var added = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var p = cleanName(it.path);
      if (!p) continue;
      if (E.files.has(p)) {
        var ok = await UI.confirm('Replace file?', '"' + p + '" already exists in this game. Replace it?', { ok: 'Replace' });
        if (!ok) continue;
      }
      var t = U.mimeOf(p);
      await GS2DB.putFile(E.id, p, it.file, t);
      E.files.set(p, { p: p, b: it.file, t: t, text: null, doc: null, dirty: false, isText: U.isTextPath(p) });
      try { localStorage.removeItem(draftKey(E.id, p)); } catch (e) { /* ignore */ }
      added++;
    }
    if (added) {
      var size = 0;
      E.files.forEach(function (f) { size += f.b.size; });
      await D.updateGame(E.id, { size: size, fileCount: E.files.size }, { touch: true });
      renderFiles();
      UI.toast('Added ' + added + ' file' + (added === 1 ? '' : 's') + ' to the game.', { type: 'good' });
      if (E.preview) reloadPreview();
    }
  }

  function fileMenu(p, x, y) {
    var g = D.get(E.id);
    UI.contextMenu(x, y, [
      { icon: 'file', label: 'Open', onClick: function () { activate(p); } },
      U.isHtml(p) && p !== g.entry ? { icon: 'star', label: 'Make this the main file', onClick: async function () { await D.updateGame(E.id, { entry: p }); renderFiles(); UI.toast('"' + p + '" is now the main file.'); } } : null,
      { icon: 'tag', label: 'Rename', onClick: function () { renameFile(p); } },
      { icon: 'copy', label: 'Copy whole file', onClick: async function () { var f = E.files.get(p); var txt = f.doc ? f.doc.getValue() : await f.b.text(); await U.copyText(txt); UI.toast('Copied ' + p, { icon: 'clipboard' }); } },
      { icon: 'download', label: 'Download', onClick: function () { var f = E.files.get(p); U.downloadBlob(f.doc ? new Blob([f.doc.getValue()]) : f.b, p.split('/').pop()); } },
      'sep',
      { icon: 'trash', label: 'Delete', danger: true, onClick: function () { deleteFile(p); } }
    ]);
  }

  async function renameFile(p) {
    var name = cleanName(await UI.prompt('Rename file', 'New name', p, { ok: 'Rename' }));
    if (!name || name === p) return;
    if (E.files.has(name)) { UI.toast('A file with that name already exists', { type: 'warn' }); return; }
    var f = E.files.get(p);
    var b = f.doc ? new Blob([f.doc.getValue()], { type: U.mimeOf(name) }) : f.b;
    await GS2DB.putFile(E.id, name, b, U.mimeOf(name));
    await GS2DB.deleteFile(E.id, p);
    E.files.delete(p);
    f.p = name;
    f.b = b;
    f.t = U.mimeOf(name);
    f.dirty = false;
    if (f.doc) f.doc = CodeMirror.Doc(f.doc.getValue(), modeFor(name));
    E.files.set(name, f);
    try { localStorage.removeItem(draftKey(E.id, p)); } catch (e) { /* ignore */ }
    E.tabs = E.tabs.map(function (t) { return t === p ? name : t; });
    var g = D.get(E.id);
    if (g.entry === p) await D.updateGame(E.id, { entry: name });
    if (E.active === p) { E.active = null; await activate(name); } else { renderTabs(); renderFiles(); }
  }

  async function deleteFile(p) {
    var g = D.get(E.id);
    if (p === g.entry) { UI.toast('That\'s the main file of the game. Make another file the main one first.', { type: 'warn' }); return; }
    if (!(await UI.confirm('Delete file?', 'Delete "' + p + '" from this game? Can\'t undo!', { ok: 'Delete', danger: true }))) return;
    await GS2DB.deleteFile(E.id, p);
    E.files.delete(p);
    try { localStorage.removeItem(draftKey(E.id, p)); } catch (e) { /* ignore */ }
    var i = E.tabs.indexOf(p);
    if (i >= 0) E.tabs.splice(i, 1);
    if (E.active === p) { E.active = null; var next = E.tabs[0] || g.entry; if (next && E.files.has(next)) await activate(next); }
    renderTabs();
    renderFiles();
    var size = 0;
    E.files.forEach(function (f) { size += f.b.size; });
    await D.updateGame(E.id, { size: size, fileCount: E.files.size }, { touch: true });
  }

  function glueDialog() {
    if (!E || !E.active) return;
    var ta = h('textarea.input', { placeholder: 'Paste the next part the AI sent…', style: { minHeight: '240px' } });
    UI.modal({
      title: 'Glue on more code',
      icon: 'fileAdd',
      wide: true,
      body: h('div', h('p', 'Paste the rest of the code the AI sent. I\'ll add it to the end of ', h('b', E.active), ' and remove any part that\'s repeated.'), ta),
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Glue it on', kind: 'primary', onClick: function () {
        var merged = glue(E.cm.getValue(), ta.value);
        E.cm.setValue(merged);
        E.cm.focus();
        E.cm.setCursor(E.cm.lineCount(), 0);
        check();
        UI.toast('Glued on! Check for red lines, then Save.', { icon: 'fileAdd' });
      } }]
    });
    setTimeout(function () { ta.focus(); }, 60);
  }

  async function copyForAI() {
    if (!E) return;
    var g = D.get(E.id);
    var parts = [];
    var a = E.analysis;
    if (a && a.problems.length) {
      parts.push('My game file "' + E.active + '" has these problems:');
      a.problems.forEach(function (p, i) {
        var line = E.cm.getLine(p.line - 1);
        parts.push((i + 1) + '. Line ' + p.line + ': ' + (p.raw || p.msg) + (line ? '\n   that line is: ' + line.trim().slice(0, 200) : ''));
      });
      if (a.cut) parts.push('The file also seems to be cut off at the end.');
    }
    var rt = await Player.aiReport(g, E.logs.rows);
    if (rt) parts.push(rt);
    if (!parts.length) { UI.toast('No errors to copy. Run the game (Preview or Play) to catch more.', { icon: 'check' }); return; }
    if (!rt) parts.push('', 'Please fix these and send me the COMPLETE fixed file.');
    await U.copyText(parts.join('\n'));
    UI.toast('Copied! Paste it to the AI.', { icon: 'clipboard' });
  }

  /* ---------------- live preview ---------------- */
  function togglePreview() {
    if (!E) return;
    E.preview = !E.preview;
    E.previewBtn.classList.toggle('on', E.preview);
    if (E.preview) startPreview(); else stopPreview();
    persistState();
  }
  async function startPreview() {
    if (!E) return;
    E.main.classList.add('with-preview');
    if (!E.pv.isConnected) E.main.appendChild(E.pv);
    if (!E.unsink) {
      E.unsink = Player.addSink(E.id, {
        log: function (level, text, meta) { if (E) E.logs.add(level, text, meta); },
        saved: function () {}
      });
    }
    reloadPreview();
    setTimeout(function () { if (E && E.cm) E.cm.refresh(); }, 50);
  }
  function stopPreview() {
    if (!E) return;
    if (E.unsink) { E.unsink(); E.unsink = null; }
    var fr = E.pv.querySelector('iframe');
    if (fr) { Player.blankFrame(fr); fr.remove(); }
    E.pv.remove();
    E.main.classList.remove('with-preview');
    setTimeout(function () { if (E && E.cm) E.cm.refresh(); }, 50);
  }
  async function reloadPreview() {
    if (!E || !E.preview) return;
    E.logs.clear();
    var holder = E.pv.lastChild;
    var old = holder.querySelector('iframe');
    if (old) { Player.blankFrame(old); old.remove(); }
    var g = D.get(E.id);
    var src = await Player.srcFor(g);
    var fr = h('iframe', { title: 'Preview', allow: 'autoplay; fullscreen; gamepad', style: { position: 'absolute', inset: 0 } });
    Player.setFrameSrc(fr, src);
    holder.appendChild(fr);
  }

  window.Editor = {
    open: open,
    close: closeEditor,
    isOpen: function () { return !!E; },
    currentId: function () { return E ? E.id : null; },
    hasUnsaved: function () { return !!E && Array.from(E.files.values()).some(function (f) { return f.dirty; }); },
    wantsDrop: function () { return !!E && D.ui.view === 'editor'; },
    addDroppedFiles: function (list) {
      if (!E) return;
      UI.confirm('Add files to this game?', 'Add ' + list.length + ' file' + (list.length === 1 ? '' : 's') + ' to "' + D.get(E.id).name + '"?', { ok: 'Add them' })
        .then(function (ok) { if (ok) addFiles(list); });
    },
    refresh: function () { if (E && E.cm) E.cm.refresh(); },
    save: saveAll,
    analyze: analyze,
    analyzeSync: analyzeSync,
    problemBanner: problemBanner,
    glue: glue,
    stripFences: stripFences,
    mini: mini,
    loadCM: loadCM
  };
})();
