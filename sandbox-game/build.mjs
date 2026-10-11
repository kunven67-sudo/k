// Bundles src/ into a single self-contained HTML file you can double-click to play.
// Usage: node build.mjs [--watch]
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const OUT = join(root, 'RealLifeSandbox.html');
const watch = process.argv.includes('--watch');

// Every file under assets/ (textures, sounds) gets inlined as a data URI so the game
// works from file:// without a web server. The game reads them through `virtual:assets`.
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

function collectAssets(dir) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) Object.assign(out, collectAssets(p));
    else if (MIME[extname(name).toLowerCase()]) {
      const key = relative(join(root, 'assets'), p).split('\\').join('/');
      out[key] = `data:${MIME[extname(name).toLowerCase()]};base64,${readFileSync(p).toString('base64')}`;
    }
  }
  return out;
}

const assetsPlugin = {
  name: 'assets',
  setup(b) {
    b.onResolve({ filter: /^virtual:assets$/ }, () => ({ path: 'assets', namespace: 'virtual' }));
    b.onLoad({ filter: /.*/, namespace: 'virtual' }, () => ({
      contents: `export default ${JSON.stringify(collectAssets(join(root, 'assets')))};`,
      loader: 'js',
      watchDirs: [join(root, 'assets')],
    }));
  },
};

const writeHtmlPlugin = {
  name: 'write-html',
  setup(b) {
    b.onEnd((result) => {
      if (result.errors.length) return;
      const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
      const css = readFileSync(join(root, 'src/ui/style.css'), 'utf8');
      const html = readFileSync(join(root, 'src/index.html'), 'utf8')
        .replace('/*__CSS__*/', () => css)
        .replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
      writeFileSync(OUT, html);
      console.log(`built ${relative(root, OUT)} (${(html.length / 1048576).toFixed(2)} MB)`);
    });
  },
};

const ctx = await esbuild.context({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  write: false,
  outfile: join(root, 'out.js'),
  plugins: [assetsPlugin, writeHtmlPlugin],
  logLevel: 'warning',
});

if (watch) {
  await ctx.watch();
  console.log('watching...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
