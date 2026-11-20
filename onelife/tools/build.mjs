// Bundle the game: node tools/build.mjs [--dev] [entry=src/main.js] [out=game.js]
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
await build({
  entryPoints: [path.join(root, args[0] || 'src/main.js')], bundle: true, format: 'esm', target: ['chrome110'],
  outfile: path.join(root, args[1] || 'game.js'), minify: !dev, sourcemap: dev ? 'inline' : false, logLevel: 'warning', legalComments: 'none',
});
console.log('built', args[1] || 'game.js');
