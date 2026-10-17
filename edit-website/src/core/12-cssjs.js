// ---------- CSS / JS: write your own code for the page ----------

var userSheet = null;
function cssApply() {
  if (!userSheet) userSheet = docSheet('');
  try { userSheet.replaceSync(S.css || ''); } catch (e) { toast('CSS problem: ' + e.message, 'bad'); }
}

var CSS_SNIPPETS = [
  ['Red text', 'body, body * {\n  color: #ff2a6d !important;\n}'],
  ['Round everything', 'body * {\n  border-radius: 14px !important;\n}'],
  ['Hide pictures', 'img, video, picture {\n  display: none !important;\n}'],
  ['Hacker mode', 'html, body, body * {\n  background: #000 !important;\n  color: #3dffa2 !important;\n  font-family: Consolas, monospace !important;\n  border-color: #3dffa2 !important;\n}'],
  ['Rainbow links', 'a {\n  background: linear-gradient(90deg, #ff2a6d, #ffd60a, #3dffa2, #2de2ff, #8338ec);\n  -webkit-background-clip: text;\n  background-clip: text;\n  color: transparent !important;\n}'],
  ['Spin on hover', 'body *:hover {\n  rotate: 3deg;\n  transition: rotate .2s;\n}']
];
var JS_SNIPPETS = [
  ['Say hi', 'alert("hi from Edit Website")'],
  ['Count links', 'document.querySelectorAll("a").length + " links on this page"'],
  ['Every word = bruh', 'var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);\nvar n;\nwhile (n = w.nextNode()) {\n  if (n.nodeValue.trim()) n.nodeValue = n.nodeValue.replace(/[A-Za-z]+/g, "bruh");\n}'],
  ['Random colors', 'document.querySelectorAll("body *").forEach(function (el) {\n  el.style.color = "hsl(" + Math.random() * 360 + ",90%,60%)";\n});'],
  ['Page title', 'document.title = "I hacked this (not really)";\ndocument.title']
];

var jsEd = null, jsOut = null;
function renderCssJs() {
  var b = bodyEl;
  var cssEd = makeEditor('css', {
    short: true,
    placeholder: '/* Type CSS here. It changes the page as you type. */\nh1 { color: hotpink; }',
    oninput: debounce(function (v) { setState('css', v, 'Edit CSS', 'css'); }, 250)
  });
  cssEd.set(S.css || '');
  b.appendChild(sec('CSS (styles, applies live)',
    cssEd.wrap,
    h('div', { class: 'flex mt', style: { 'flex-wrap': 'wrap' } }, CSS_SNIPPETS.map(function (sn) {
      return btn(sn[0], function () { var v = (S.css ? S.css.replace(/\s*$/, '') + '\n\n' : '') + sn[1] + '\n'; cssEd.set(v); setState('css', v, 'CSS: ' + sn[0]); }, 'sm', 'Add this example');
    })),
    h('div', { class: 'note', text: 'Tip: add !important if the site\'s own style wins. Undo works here too.' })));

  jsEd = makeEditor('js', {
    short: true,
    placeholder: '// Type JavaScript and hit Run (Ctrl+Enter)\ndocument.body.style.rotate = "2deg"',
    oninput: debounce(function (v) { if (v !== S.js.code) setState('js', Object.assign({}, S.js, { code: v }), 'Edit JS', 'js'); }, 400),
    onrun: runJsBox
  });
  jsEd.set(S.js.code || '');
  jsOut = h('div', { class: 'out' });
  b.appendChild(sec('JavaScript (runs when you hit Run)',
    jsEd.wrap,
    h('div', { class: 'flex mt' },
      btn('Run', runJsBox, 'pri sm', 'Ctrl+Enter', 'play'),
      btn(S.js.auto ? 'Runs every visit: ON' : 'Runs every visit: OFF', function () {
        setState('js', Object.assign({}, S.js, { code: jsEd.get(), auto: !S.js.auto }), 'Toggle JS every visit'); renderTab();
      }, S.js.auto ? 'on sm' : 'sm', 'Run this code by itself every time this page opens'),
      btn('Clear output', function () { empty(jsOut); }, 'sm')),
    jsOut,
    h('div', { class: 'flex mt', style: { 'flex-wrap': 'wrap' } }, JS_SNIPPETS.map(function (sn) {
      return btn(sn[0], function () { jsEd.set(sn[1]); setState('js', Object.assign({}, S.js, { code: sn[1] }), 'JS example: ' + sn[0]); }, 'sm', 'Load this example');
    })),
    h('div', { class: 'note' + (KIND === 'extension' ? '' : ' warn'), text: KIND === 'extension'
      ? 'Running in the extension. On super strict sites, turn on "Allow User Scripts" for Edit Website in chrome://extensions so code can run there too.'
      : 'Some strict sites (YouTube, GitHub...) block code from bookmarks. The Edit Website extension can run it anywhere.' })));
}
function runJsBox() {
  if (!jsEd) return;
  var code = jsEd.get();
  if (code !== S.js.code) setState('js', Object.assign({}, S.js, { code: code }), 'Edit JS');
  var line = h('div', null, h('span', { class: 'k-p', text: '> ' }), short(code, 80));
  jsOut.appendChild(line);
  runCode(code, function (r) {
    (r.l || []).forEach(function (l) { jsOut.appendChild(h('div', { text: l })); });
    if (r.e) jsOut.appendChild(h('div', { class: 'e', text: r.e }));
    else jsOut.appendChild(h('div', { class: 'r', text: '\u2190 ' + (r.r == null ? 'done' : r.r) }));
    jsOut.scrollTop = jsOut.scrollHeight;
  });
}
