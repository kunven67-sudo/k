// ---------- starting up ----------

function open() {
  buildUI();
  panel.classList.add('show');
  pill.classList.remove('show');
  if (S.open) return;
  S.open = true;
  renderTab();
}
function close() {
  if (!ui) return;
  pick(false);
  stopEditText();
  if (P.editAll) editAll(false);
  edCommit();
  select(null);
  place(hlBox, null);
  panel.classList.remove('show');
  pill.classList.remove('show');
  S.open = false;
  if (S.autosave && (hist.length || ops.length)) saveNow();
}
function minimize() {
  close();
  pill.classList.add('show');
}
function toggle() { if (S.open) close(); else open(); }

function isTyping(e) {
  var t = e.composedPath ? e.composedPath()[0] : e.target;
  // from outside, everything in our (closed) editor looks like the host element
  if (t === host && root) t = root.activeElement || t;
  if (!t || t.nodeType !== 1) return false;
  return /^(input|textarea|select)$/i.test(t.localName) || t.isContentEditable;
}
function onKey(e) {
  var k = e.key;
  if (k === 'Escape' && modalOpen()) { e.preventDefault(); modalClose(); return; }
  if (e.altKey && e.shiftKey && (k === 'E' || k === 'e' || e.code === 'KeyE') && KIND !== 'extension') { e.preventDefault(); toggle(); return; }
  if (!S.open) {
    if (k === 'Escape' && GR) gravityStop();
    return;
  }
  if (k === 'Escape') {
    if (P.on) { pick(false); P.mode = 'select'; if (curTab === 'pick') renderTab(); e.preventDefault(); return; }
    if (GR) { gravityStop(); return; }
    if (P.editing) { stopEditText(); return; }
    if (P.sel) { select(null); return; }
    return;
  }
  if (isTyping(e)) return;
  var mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && (k === 'z' || k === 'Z')) { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && !e.altKey && (k === 'y' || k === 'Y')) { e.preventDefault(); e.stopPropagation(); redo(); return; }
  if (P.sel && (k === 'Delete' || k === 'Backspace') && !mod) { e.preventDefault(); e.stopPropagation(); deleteEl(P.sel); return; }
  if (P.sel && /^Arrow/.test(k) && !mod) {
    e.preventDefault(); e.stopPropagation();
    var st = e.shiftKey ? 10 : 1;
    nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0);
  }
}

function listenExtension() {
  try {
    chrome.runtime.onMessage.addListener(function (m, s, reply) {
      if (m && m.ew === 'toggle') { W.__EW.toggle(); reply({ ok: true }); }
      else if (m && m.ew === 'ping') reply({ ok: true });
    });
  } catch (e) {}
}

function loadSaved(cb) {
  store.get(KEYS.page).then(function (p) { return p || store.get(KEYS.site); }).then(function (p) {
    if (!p) { if (cb) cb(0); return; }
    applyProject(p, function (got, missed) {
      if (cb) cb(got || countChanges(p), missed);
    });
  }, function () { if (cb) cb(0); });
}

function boot() {
  HTML.setAttribute('data-ew-alive', KIND);
  W.__EW = { alive: true, kind: KIND, version: VERSION, toggle: toggle, open: open, close: close };
  D.addEventListener('ew-toggle', function () { toggle(); });
  D.addEventListener('click', onRuntimeClick, true);
  W.addEventListener('keydown', onKey, true);
  W.addEventListener('pointerdown', function () { if (AC && AC.state === 'suspended') AC.resume(); }, true);
  if (KIND === 'extension') listenExtension();
  makeKeys();
  setInterval(keepSheets, 2000);

  if (KIND === 'player') {
    // a downloaded page: put the effects back, then anything edited since
    buildHost();
    applyProject(ENV.project);
    loadSaved();
    return;
  }
  if (KIND === 'extension') {
    // changes come back by themselves; the editor opens from the toolbar button
    loadSaved();
    return;
  }
  // bookmark: open right away, then bring back saved changes
  open();
  loadSaved(function (n, missed) {
    if (n) toast('Brought back your ' + n + (n === 1 ? ' change' : ' changes') + (missed ? ' (' + missed + ' couldn\'t find their spot)' : ''), 'ok', 3500);
  });
}

boot();
