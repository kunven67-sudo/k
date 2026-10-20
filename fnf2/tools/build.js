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
const out = path.resolve(opt('out', path.join(ROOT, 'build', 'fnf2.html')));
// private FNF asset pack made by tools/pack_assets.py (git-ignored, never published)
const assetsFile = opt('assets', path.join(ROOT, 'build', 'assets.js'));
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

// the pack comes in pieces (tools/pack_assets.py): one <script> each, so no single script text gets too big for the browser.
// --split: the pieces go into files next to the game (fnf2-data/1.js ...: each under 100 MB, so the build fits on
// GitHub); a phone that only has the game file reads them out of the zip once (99-main.js noAssets)
const split = args.includes('--split');
const chunks = (!args.includes('--no-assets') && fs.existsSync(assetsFile)) ? fs.readFileSync(assetsFile, 'utf8').split('/*FNF-CHUNK*/') : [];
let assetTag = '';
if (split && chunks.length) {
  const dir = path.join(path.dirname(out), 'fnf2-data');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const parts = chunks.slice(1), n = parts.length;
  parts.forEach((part, i) => fs.writeFileSync(path.join(dir, (i + 1) + '.js'),
    '/*FNF-DATA ' + JSON.stringify({ n: i + 1, of: n }) + '*/\n/* PRIVATE BUILD: Friday Night Funkin\' assets (c) The Funkin\' Crew Inc. Not for public distribution. */\n' +
    part + '\nwindow.__FNF_DATA_OK = (window.__FNF_DATA_OK || 0) + 1;\n'));
  assetTag = '<script>window.__FNF_ASSETS = window.__FNF_ASSETS || {}; window.__FNF_DATA_N = ' + n + ';</script>\n' +
    parts.map((_, i) => '<script src="fnf2-data/' + (i + 1) + '.js"></script>\n').join('');
} else assetTag = chunks.map(part => '<script class="fnf-assets">\n' + part.replace(/<\/script/gi, '<\\/script') + '\n</script>\n').join('');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>FNF 2 (private copy)</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden;
    touch-action: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
  body { display: flex; align-items: center; justify-content: center; }
  canvas { display: block; background: #000; image-rendering: auto; outline: none; }
  #boot { position: fixed; right: 24px; bottom: 18px; color: #fff; font: bold 22px monospace; letter-spacing: 1px; z-index: 5; pointer-events: none; }
</style>
</head>
<body>
<canvas id="game" width="1280" height="720" tabindex="0"></canvas>
<div id="boot">Loading...</div>
<script>
${fontJs}</script>
${assetTag}${scripts}</body>
</html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(0) + ' KB', files.length + ' modules: ' + files.join(' '));
