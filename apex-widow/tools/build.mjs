import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
mkdirSync('dist', { recursive: true });
const r = await build({
  entryPoints: ['src/main.js'],
  bundle: true, format: 'iife', write: false,
  minify: true, legalComments: 'none', target: 'es2020',
});
const js = r.outputFiles[0].text;
const tpl = readFileSync('tools/template.html','utf8');
const html = tpl.replace('/*__BUNDLE__*/', () => js);
writeFileSync('dist/apex-widow.html', html);
console.log('dist/apex-widow.html', (html.length/1e6).toFixed(2)+'MB');
