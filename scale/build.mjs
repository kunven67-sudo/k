// Bundles SCALE (Three.js and Rapier included) into one self-contained SCALE.html that runs
// by double-clicking it, no web server needed. Run: npm install && npm run build
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: ['es2020'],
  alias: {
    three: join(here, 'vendor/three/three.module.js'),
    rapier: join(here, 'vendor/rapier/rapier.mjs'),
  },
  plugins: [{
    name: 'three-addons',
    setup(b) {
      b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: join(here, 'vendor/three/addons', a.path.slice('three/addons/'.length)) }));
    },
  }],
  legalComments: 'none',
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(here, 'src/ui/style.css'), 'utf8');
let html = readFileSync(join(here, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="\.\/src\/ui\/style\.css">/, () => `<style>${css}</style>`);
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
html = html.replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, () => `<script>${js}</script>`);
writeFileSync(join(here, 'SCALE.html'), html);
console.log(`SCALE.html written (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
