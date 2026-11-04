// Builds SHRINKWORKS.
//   web build  -> anyforge/index.html + game.js (+ assets/ next to it)  : what GitHub Pages serves (Quest 3 link)
//   one file   -> <out>/ANYFORGE.html with every asset packed inside     : the file you double-click on the PC
// node tools/build.mjs [--dev] [--onefile <out dir>]
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const dev = process.argv.includes('--dev');
const oneIdx = process.argv.indexOf('--onefile');
const oneOut = oneIdx > 0 ? process.argv[oneIdx + 1] : null;
const root = path.resolve('.');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const VERSION = pkg.version || '1.0.0';

const res = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: ['chrome110'], minify: !dev, sourcemap: false,
  write: false, define: { __AF_VERSION__: JSON.stringify(VERSION), __AF_DEV__: String(dev) }, legalComments: 'none',
  logLevel: 'warning'
});
const js = res.outputFiles[0].text;

// the GS3 console kit, inlined (fonts as data URLs) so menus match the console picked in Game System 3
const kitDir = path.join(root, 'gs3kit');
let kitCss = fs.readFileSync(path.join(kitDir, 'gs3-console.css'), 'utf8')
  .replace(/url\('fonts\/([^']+)'\)/g, (m, f) => `url('data:font/woff2;base64,${fs.readFileSync(path.join(kitDir, 'fonts', f)).toString('base64')}')`);
const kitJs = fs.readFileSync(path.join(kitDir, 'gs3-console.js'), 'utf8');
const shell = fs.readFileSync('src/shell.html', 'utf8');
const css = fs.readFileSync('src/style.css', 'utf8');

function page(gameTag, assetsTag) {
  return shell
    .replace('/*KIT_CSS*/', () => kitCss)
    .replace('/*GAME_CSS*/', () => css)
    .replace('<!--KIT_JS-->', () => `<script>${kitJs}</script>`)
    .replace('<!--ASSETS-->', () => assetsTag)
    .replace('<!--GAME-->', () => gameTag)
    .replace(/__AF_VERSION__/g, VERSION);
}

fs.writeFileSync('game.js', js);
fs.writeFileSync('index.html', page('<script src="game.js"></script>', ''));
console.log('web build: index.html + game.js', (js.length / 1024 | 0) + ' KB');

if (oneOut) {
  const packed = {};
  const walk = (rel) => {
    for (const f of fs.readdirSync(path.join('assets', rel))) {
      const r = rel + '/' + f;
      if (fs.statSync(path.join('assets', r)).isDirectory()) walk(r); else packed[r] = fs.readFileSync(path.join('assets', r)).toString('base64');
    }
  };
  for (const d of ['tex', 'sky', 'models', 'sfx']) walk(d);
  const assetsTag = `<script>window.__AF_ASSETS=${JSON.stringify(packed)};</script>`;
  fs.mkdirSync(oneOut, { recursive: true });
  const out = path.join(oneOut, 'SHRINKWORKS.html');
  fs.writeFileSync(out, page(`<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`, assetsTag));
  console.log('one file:', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB');
}
