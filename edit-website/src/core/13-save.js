// ---------- SAVE: auto-save, download the edited site, history ----------

function renderSave() {
  var b = bodyEl;
  var n = countChanges();
  b.appendChild(sec('Your changes',
    h('div', { class: 'card' },
      h('div', { class: 'selname', text: n + (n === 1 ? ' change on this page' : ' changes on this page') }),
      h('div', { class: 'dimtx', text: (location.hostname || 'local file') + (location.pathname.length > 1 ? short(location.pathname, 40) : '') })),
    row('Auto-save', btn(S.autosave ? 'ON' : 'OFF', function () {
      S.autosave = !S.autosave;
      if (S.autosave) saveNow();
      renderTab(); setStatus();
    }, S.autosave ? 'on sm' : 'sm', 'Saves every change by itself')),
    row('Comes back on', h('div', { class: 'grow' }, seg([['page', 'This page'], ['site', 'Whole site']], S.scope, function (v) {
      if (v === S.scope) return;
      var oldKey = curKey();
      S.scope = v;
      store.del(oldKey).then(saveNow);
      renderTab();
      toast(v === 'site' ? 'Your changes now come back on every page of ' + (location.hostname || 'this site') : 'Your changes now only come back on this exact page', 'ok', 3500);
    }))),
    h('div', { class: 'note', text: KIND === 'extension'
      ? 'Your changes come back by themselves every time you open this page. Only YOU see them.'
      : KIND === 'player' ? 'This is a downloaded page. Changes save in this browser.'
      : 'Your changes come back as soon as you click the Edit Website bookmark on this page. Only YOU see them.' })));

  b.appendChild(sec('Download',
    h('div', { class: 'grid g2' },
      btn('Download edited site', exportPage, 'pri', 'Save this page with all your changes as one .html file', 'download'),
      btn('Backup my changes', exportProject, '', 'Save a .json file with your changes (to load later or share)', 'save')),
    h('div', { class: 'grid g2 mt' },
      btn('Load a backup', importProject, '', 'Load a .json backup of changes onto this page', 'upload'),
      btn(S.scripts ? 'Site scripts: KEEP' : 'Site scripts: REMOVE', function () { S.scripts = !S.scripts; renderTab(); }, S.scripts ? 'on' : '', 'Removing the site\'s own scripts makes the download look right more often')),
    h('div', { class: 'note', text: 'The downloaded file opens offline and keeps your background, effects, added stuff and buttons. Press Alt+Shift+E inside it to keep editing.' })));

  var list = h('div', { class: 'list' });
  if (!hist.length) list.appendChild(h('div', { class: 'li dimtx', text: 'No changes yet this time' }));
  list.appendChild(h('div', { class: 'li click' + (hpos === 0 ? ' cur' : ''), onclick: function () { goToHistory(0); } }, h('span', { class: 'nm dimtx', text: 'Start (before this session)' })));
  hist.forEach(function (e, i) {
    list.appendChild(h('div', { class: 'li click' + (i + 1 === hpos ? ' cur' : '') + (i >= hpos ? ' fut' : ''), title: 'Go back to right after this change', onclick: function () { goToHistory(i + 1); } },
      h('span', { class: 'nm', text: (i + 1) + '. ' + e.label })));
  });
  b.appendChild(sec('History (click to jump back)', list));

  var saved = h('div', { class: 'list' }, h('div', { class: 'li dimtx', text: 'Loading\u2026' }));
  store.list().then(function (all) {
    empty(saved);
    all = (all || []).filter(Boolean).sort(function (a, b2) { return (b2.saved || 0) - (a.saved || 0); });
    if (!all.length) saved.appendChild(h('div', { class: 'li dimtx', text: 'Nothing saved yet' }));
    all.forEach(function (p) {
      var me = p.key === curKey();
      saved.appendChild(h('div', { class: 'li' + (me ? ' cur' : '') },
        h('span', { class: 'nm', title: p.url, text: (p.scope === 'site' ? '[whole site] ' : '') + short(p.title || p.url, 46) }),
        h('span', { class: 'dimtx', text: countChanges(p) + '' }),
        me ? null : btn('Open', function () { W.open(p.url, '_blank', 'noopener'); }, 'sm'),
        btn('', function () {
          confirmBox('Delete saved changes?', 'This forgets the saved changes for:\n' + (p.title || p.url), 'Delete', function () {
            store.del(p.key).then(function () { if (me) { ops = []; } renderTab(); });
          });
        }, 'sm bad', 'Forget these changes', 'trash')));
    });
  });
  b.appendChild(sec(KIND === 'extension' ? 'Saved pages (all sites)' : 'Saved pages on this site', saved));

  b.appendChild(sec('Start over',
    btn('Reset this page (delete ALL my changes)', function () {
      confirmBox('Reset this page?', 'All your changes on this page get deleted and the page reloads back to normal. You can\'t undo this.', 'Reset', function () {
        S.autosave = false;
        store.del(KEYS.page).then(function () { return store.del(KEYS.site); }).then(function () { location.reload(); });
      });
    }, 'bad', null, 'refresh')));
}

// ----- download the page as one .html file -----
function rulesText(sheet) {
  try { return Array.prototype.map.call(sheet.cssRules, function (r) { return r.cssText; }).join('\n'); } catch (e) { return ''; }
}
function safeJSON(o) {
  return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function exportPage() {
  stopEditText();
  if (P.editAll) editAll(false);
  edCommit();
  if (GR) gravityStop();
  try {
    var clone = HTML.cloneNode(true);
    $$('ew-root, ew-bg, [data-ew-internal]', clone).forEach(function (n) { n.remove(); });
    clone.removeAttribute('data-ew-alive');
    ['--ew-oy', '--ew-rx', '--ew-ry'].forEach(function (k) { clone.style.removeProperty(k); });
    if (!clone.getAttribute('style')) clone.removeAttribute('style');
    // styles that sites add with JavaScript don't show up in the HTML, copy them in
    var os = $$('style', HTML).filter(function (s) { return !isOurs(s); }), cs = $$('style', clone);
    os.forEach(function (st, i) {
      var txt = st.sheet ? rulesText(st.sheet) : '';
      if (cs[i] && txt && st.sheet.cssRules.length && (st.textContent || '').trim().length < 20) cs[i].textContent = txt;
    });
    var extra = '';
    try { Array.prototype.forEach.call(D.adoptedStyleSheets || [], function (sh) { if (!docSheets.has(sh)) extra += rulesText(sh) + '\n'; }); } catch (e) {}
    // undo the see-through background tweaks (the page redoes them when it opens)
    xray.forEach(function (rec, el) {
      var p = cssPath(el), c = p && clone.querySelector(p);
      if (!c) return;
      if (rec.c[0]) c.style.setProperty('background-color', rec.c[0], rec.c[1]); else c.style.removeProperty('background-color');
      if (rec.grad) { if (rec.i[0]) c.style.setProperty('background-image', rec.i[0], rec.i[1]); else c.style.removeProperty('background-image'); }
      if (!c.getAttribute('style')) c.removeAttribute('style');
    });
    // drawings on <canvas> become pictures
    var oc = $$('canvas', HTML).filter(function (c) { return !isOurs(c); }), cc = $$('canvas', clone);
    oc.forEach(function (c, i) {
      if (!cc[i]) return;
      try {
        var img = D.createElement('img');
        img.setAttribute('src', c.toDataURL());
        ['class', 'style', 'width', 'height', 'id'].forEach(function (a) { if (c.hasAttribute(a)) img.setAttribute(a, c.getAttribute(a)); });
        cc[i].replaceWith(img);
      } catch (e) {}
    });
    // typed-in form values
    var oi = $$('input,textarea', HTML).filter(function (x) { return !isOurs(x); }), ci = $$('input,textarea', clone);
    oi.forEach(function (x, i) {
      var y = ci[i]; if (!y) return;
      if (x.localName === 'textarea') y.textContent = x.value;
      else if (x.type === 'checkbox' || x.type === 'radio') { if (x.checked) y.setAttribute('checked', ''); else y.removeAttribute('checked'); }
      else if (x.type !== 'password' && x.type !== 'file') y.setAttribute('value', x.value);
    });
    $$('[data-ew-add="popup"]', clone).forEach(function (p) { p.style.removeProperty('display'); });
    if (!S.scripts) $$('script', clone).forEach(function (s) { s.remove(); });
    $$('link[rel="modulepreload"], link[as="script"]', clone).forEach(function (l) { l.remove(); });
    var head = clone.querySelector('head');
    if (!head) { head = D.createElement('head'); clone.insertBefore(head, clone.firstChild); }
    if (!clone.querySelector('base')) {
      var base = D.createElement('base');
      base.setAttribute('href', location.href.split('#')[0]);
      head.insertBefore(base, head.firstChild);
    }
    if (!clone.querySelector('meta[charset]')) {
      var mc = D.createElement('meta'); mc.setAttribute('charset', 'utf-8');
      head.insertBefore(mc, head.firstChild);
    }
    var html = '<!DOCTYPE html>\n' + clone.outerHTML;
    var actsObj = {};
    acts.forEach(function (v, k) { actsObj[k] = v; });
    var proj = { v: 1, bg: S.bg, fx: S.fx, fxo: S.fxo, css: S.css, js: S.js, acts: actsObj, ops: [] };
    var self = '(' + SELF.toString() + ')();';
    var tail = (extra.trim() ? '<style data-ew-site>' + extra.replace(/<\/style/gi, '<\\/style') + '</style>\n' : '') +
      '<script>window.__EW_ENV=' + safeJSON({ kind: 'player', project: proj }) + ';</script>\n' +
      '<script>' + self.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--') + '</script>\n';
    var at = html.toLowerCase().lastIndexOf('</body>');
    html = at >= 0 ? html.slice(0, at) + tail + html.slice(at) : html + tail;
    var name = 'edited-' + ((location.hostname || 'page').replace(/^www\./, '').replace(/[^a-z0-9.-]+/gi, '-')) + '.html';
    download(html, name, 'text/html');
    toast('Downloading ' + name, 'ok');
  } catch (e) {
    console.warn(e);
    toast('Download failed: ' + (e && e.message || e), 'bad', 5000);
  }
}
function exportProject() {
  var p = project();
  download(JSON.stringify(p, null, 1), 'edit-website-backup-' + ((location.hostname || 'page').replace(/[^a-z0-9.-]+/gi, '-')) + '.json', 'application/json');
}
function importProject() {
  chooseFile('.json,application/json', function (f) {
    readFile(f, 'text').then(function (t) {
      var p;
      try { p = JSON.parse(t); } catch (e) { toast('That file isn\'t an Edit Website backup', 'bad'); return; }
      if (!p || p.v !== 1) { toast('That file isn\'t an Edit Website backup', 'bad'); return; }
      confirmBox('Load this backup?', 'This page reloads and the changes from the backup get put on it.' + (p.url && p.url !== location.href.split('#')[0] ? '\n\nHeads up: the backup was made on a different page, some changes might not fit.' : ''), 'Load it', function () {
        p.key = curKey(); p.scope = S.scope; p.saved = now();
        S.autosave = false;
        store.set(curKey(), p).then(function () { location.reload(); }, function (e) { toast('Couldn\'t load: ' + (e && e.message || e), 'bad'); });
      });
    });
  });
}
