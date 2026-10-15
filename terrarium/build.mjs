// Bundles the whole game (Three.js included) into ONE self-contained TERRARIUM.html
// that works by double-clicking it. Run: npm install && npm run build   (npm run dev = rebuild on save)
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const dev = watch || process.argv.includes('--dev');

function writeHtml(js) {
  js = js.replace(/<\/script/gi, '<\\/script');
  const css = readFileSync(join(here, 'src/style.css'), 'utf8');
  let html = readFileSync(join(here, 'index.html'), 'utf8');
  html = html.replace('<link rel="stylesheet" href="src/style.css">', () => `<style>${css}</style>`);
  html = html.replace('<script type="module" src="dist/main.js"></script>', () => `<script>${js}</script>`);
  writeFileSync(join(here, 'TERRARIUM.html'), html);
  console.log(`TERRARIUM.html written (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
}

const opts = {
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  write: false,
  target: ['es2020'],
  legalComments: 'none',
  plugins: [{
    name: 'html',
    setup(b) { b.onEnd((r) => { if (!r.errors.length) writeHtml(r.outputFiles[0].text); }); },
  }],
};

if (watch) { const ctx = await context(opts); await ctx.watch(); console.log('watching...'); }
else await build(opts);
