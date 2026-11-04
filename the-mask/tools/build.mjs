// THE MASK - build.
//   node tools/build.mjs                -> play/ (web folder: GitHub Pages / Quest browser link)
//   node tools/build.mjs --onefile <f>  -> also one self-contained .html (PC / Game System 3 / phone), works offline
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const G = (p) => path.join(root, 'game', p), OUT = path.join(root, 'play');
const args = process.argv.slice(2), oneIdx = args.indexOf('--onefile'), onefile = oneIdx >= 0 ? path.resolve(args[oneIdx + 1]) : null;

const res = await esbuild.build({
  entryPoints: [G('src/main.js')], bundle: true, format: 'esm', minify: true, target: 'es2020', write: false,
  legalComments: 'none', logLevel: 'warning'
});
const js = res.outputFiles[0].text;

function copyDir(a, b) { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'game.js'), js);
copyDir(G('assets'), path.join(OUT, 'assets'));
copyDir(G('gs3kit'), path.join(OUT, 'gs3kit'));
fs.copyFileSync(G('style.css'), path.join(OUT, 'style.css'));
const page = fs.readFileSync(G('index.html'), 'utf8').replace(/<!--DEV-->[\s\S]*?<!--\/DEV-->/, '<script type="module" src="game.js"></script>');
fs.writeFileSync(path.join(OUT, 'index.html'), page);
console.log('play/  game.js', (js.length / 1024).toFixed(0) + ' KB');

if (onefile) {
  const mime = { '.png': 'image/png', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
  const assets = {};
  (function walk(dir, rel) {
    for (const f of fs.readdirSync(dir)) {
      const s = path.join(dir, f), r = rel + '/' + f;
      if (fs.statSync(s).isDirectory()) walk(s, r);
      else assets[r] = 'data:' + (mime[path.extname(f)] || 'application/octet-stream') + ';base64,' + fs.readFileSync(s).toString('base64');
    }
  })(G('assets'), 'assets');
  const font = (f) => 'data:font/woff2;base64,' + fs.readFileSync(G('gs3kit/fonts/' + f)).toString('base64');
  const kitCss = fs.readFileSync(G('gs3kit/gs3-console.css'), 'utf8').replace(/url\('fonts\/([^']+)'\)/g, (m, f) => `url('${font(f)}')`);
  const kitJs = fs.readFileSync(G('gs3kit/gs3-console.js'), 'utf8');
  const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>THE MASK</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#0b0a10">
<link rel="stylesheet" data-gs3-kit href="data:text/css,">
<style>${kitCss}</style>
<style>${fs.readFileSync(G('style.css'), 'utf8')}</style>
<script>${safe(kitJs)}</script>
</head>
<body>
<div id="loading">THE MASK<small>Loading...</small></div>
<script>window.__ASSETS = ${JSON.stringify(assets)};</script>
<script type="module">${safe(js)}</script>
</body>
</html>`;
  fs.writeFileSync(onefile, html);
  console.log(path.basename(onefile), (html.length / 1048576).toFixed(1) + ' MB');
}
