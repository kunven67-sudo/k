// Builds the whole game into ONE file: dist/apex-widow.html (code + every asset inlined as base64).
// --dev writes dist/dev.html + dist/bundle.js that load assets from ../assets/ (fast iteration + tests).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const dev = process.argv.includes('--dev');
fs.mkdirSync('dist', { recursive: true });
const result = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: 'es2022',
  minify: !dev, sourcemap: dev ? 'inline' : false, write: false, legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
  loader: { '.glsl': 'text', '.css': 'text' },
});
const code = result.outputFiles[0].text;
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
const used = walk('assets').map(f => path.relative('assets', f).split(path.sep).join('/')).filter(a => !a.startsWith('_raw/')).sort();
const shell = fs.readFileSync('src/shell.html', 'utf8');
if (dev) {
  fs.writeFileSync('dist/bundle.js', code);
  fs.writeFileSync('dist/dev.html', shell.replace('<!--ASSETS-->', '').replace('<!--CODE-->',
    `<script>window.__ASSET_BASE='../assets/';window.__DEV=true;</script>\n<script src="bundle.js"></script>`));
  console.log('dev bundle', (code.length / 1e6).toFixed(2), 'MB');
} else {
  const parts = []; let total = 0;
  for (const a of used) {
    const b64 = fs.readFileSync(path.join('assets', a)).toString('base64'); total += b64.length;
    parts.push(`<script type="text/plain" data-asset="${a}">${b64}</script>`);
  }
  const html = shell.replace('<!--ASSETS-->', () => parts.join('\n'))
    .replace('<!--CODE-->', () => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`);
  fs.writeFileSync('dist/apex-widow.html', html);
  console.log('built dist/apex-widow.html', (html.length / 1e6).toFixed(1), 'MB (assets', (total / 1e6).toFixed(1), 'MB, code', (code.length / 1e6).toFixed(2), 'MB)');
}
