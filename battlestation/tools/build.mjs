// Builds the whole game into ONE file: dist/battlestation.html (code + every asset inlined).
// Also writes dist/bundle.js for the dev page (dev.html), which loads assets from assets/.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const devOnly = process.argv.includes('--dev');
fs.mkdirSync('dist', { recursive: true });

const result = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: 'es2022',
  minify: !devOnly, sourcemap: devOnly ? 'inline' : false, write: false, legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning', loader: { '.ps1': 'text' },
});
const code = result.outputFiles[0].text;
fs.writeFileSync('dist/bundle.js', code);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
const assets = walk('assets').map(f => path.relative('assets', f).split(path.sep).join('/')).sort();
fs.writeFileSync('dist/assets.json', JSON.stringify(assets));
const shell = fs.readFileSync('src/shell.html', 'utf8');
fs.writeFileSync('dist/dev.html', shell.replace('<!--ASSETS-->', '').replace('<!--CODE-->',
  `<script>window.__ASSET_LIST=${JSON.stringify(assets)};window.__ASSET_BASE='../assets/';window.__DEV=true;</script>\n<script src="bundle.js"></script>`));
if (devOnly) { console.log('dev bundle', (code.length / 1e6).toFixed(2), 'MB'); process.exit(0); }

const parts = [];
let total = 0;
for (const a of assets) {
  const b64 = fs.readFileSync(path.join('assets', a)).toString('base64');
  total += b64.length;
  parts.push(`<script type="text/plain" data-asset="${a}">${b64}</script>`);
}
const html = shell
  .replace('<!--ASSETS-->', () => parts.join('\n'))
  .replace('<!--CODE-->', () => `<script>window.__ASSET_LIST=${JSON.stringify(assets)};</script>\n<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`);
fs.writeFileSync('dist/battlestation.html', html);
console.log('built dist/battlestation.html', (html.length / 1e6).toFixed(1), 'MB (assets', (total / 1e6).toFixed(1), 'MB base64, code', (code.length / 1e6).toFixed(2), 'MB)');
