// Bundle src/ + vendored three.js into one file: node tools/build.mjs [--dev]
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const threePlugin = {
  name: 'three-vendor',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: path.join(root, 'vendor/three/three.module.js') }));
    b.onResolve({ filter: /^@pixiv\/three-vrm$/ }, () => ({ path: path.join(root, 'vendor/three-vrm/three-vrm.module.js') }));
    b.onResolve({ filter: /^three\/addons\// }, a => ({ path: path.join(root, 'vendor/three/addons', a.path.slice('three/addons/'.length)) }));
  }
};
await build({
  entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'esm', target: ['chrome110'],
  outfile: path.join(root, 'game.js'), minify: !dev, sourcemap: dev ? 'inline' : false, plugins: [threePlugin], logLevel: 'info',
  legalComments: 'none'
});
