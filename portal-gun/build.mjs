// Bundles src/ (and the vendored three.js) into ONE self-contained index.html.
// Usage: npm install && npm run build
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--dev');

const result = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'eof',
  write: false,
  logLevel: 'warning',
});

// keep the bundle from closing the inline <script> tag early
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = await readFile(join(root, 'src/index.template.html'), 'utf8');
if (!template.includes('/*__GAME_SCRIPT__*/')) throw new Error('template is missing the script marker');
const html = template.replace('/*__GAME_SCRIPT__*/', () => js);
await writeFile(join(root, 'index.html'), html);
console.log(`index.html written (${(html.length / 1024).toFixed(0)} KB)`);
