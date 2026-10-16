#!/usr/bin/env node
// Builds fnf2/fnf2.html: one self-contained file (fonts embedded as base64,
// every src/*.js module in its own <script> so one broken module can't kill the rest).
//   node tools/build.js                       -> fnf2/fnf2.html (all modules)
//   node tools/build.js --out /tmp/x.html     -> custom output path
//   node tools/build.js --only 00,01,30,98,99 -> only modules whose file name starts with these prefixes
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const out = path.resolve(opt('out', path.join(ROOT, 'fnf2.html')));
const only = opt('only', null);
const minify = args.includes('--min');

const fontDir = path.join(ROOT, 'assets', 'fonts');
const fonts = {
  FNFAlpha: 'SpicyRice-Regular.ttf',
  FNFVcr: 'VT323-Regular.ttf',
  FNFBody: 'Chewy-Regular.ttf',
};
let fontJs = 'window.__FNF_FONTS = {\n';
for (const k in fonts) {
  const b64 = fs.readFileSync(path.join(fontDir, fonts[k])).toString('base64');
  fontJs += '  ' + k + ': "' + b64 + '",\n';
}
fontJs += '};\n';

let files = fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).sort();
if (only) {
  const pre = only.split(',').map(s => s.trim()).filter(Boolean);
  files = files.filter(f => pre.some(p => f.startsWith(p)));
}
let scripts = '';
for (const f of files) {
  let code = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
  if (code.includes('</script')) code = code.replace(/<\/script/gi, '<\\/script');
  const isCore = f.startsWith('00');
  scripts += '<script>\n/* ==== ' + f + ' ==== */\n' +
    (isCore ? code : '(function(){try{\n' + code + '\n}catch(e){if(window.G&&G.reportError)G.reportError(e,"load ' + f + '");else console.error(e);}})();') +
    '\n</script>\n';
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>FNF 2</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden;
    touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
  body { display: flex; align-items: center; justify-content: center; }
  canvas { display: block; background: #000; image-rendering: auto; outline: none; }
</style>
</head>
<body>
<canvas id="game" width="1280" height="720" tabindex="0"></canvas>
<script>
${fontJs}</script>
${scripts}</body>
</html>
`;
fs.writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(0) + ' KB', files.length + ' modules: ' + files.join(' '));
