// Bundles the whole game (Three.js included) into a single self-contained play.html that works
// by double-clicking it - no web server needed. Run: npm install && npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [join(here, 'js/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: ['es2020'],
  alias: { three: join(here, 'js/vendor/three/build/three.module.js') },
  legalComments: 'none',
});

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(here, 'style.css'), 'utf8');
let html = readFileSync(join(here, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="style.css" \/>/, () => `<style>${css}</style>`);
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*<script type="module" src="js\/main.js"><\/script>/, () => `<script>${js}</script>`);
writeFileSync(join(here, 'play.html'), html);
console.log(`play.html written (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
