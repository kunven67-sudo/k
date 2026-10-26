// Builds SUBDUB into this folder (index.html + subdub.js + worker files). Run: node tools/build.mjs [--dev]
import * as esbuild from 'esbuild';
import fs from 'fs'; import path from 'path'; import url from 'url';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const out = path.join(root, process.argv.find(a => a.startsWith('--out='))?.slice(6) || '.');
const common = { bundle: true, format: 'esm', platform: 'browser', target: ['chrome120', 'edge120'], minify: !dev, sourcemap: dev ? 'inline' : false, logLevel: 'warning', legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' } };
const workers = ['listen', 'asr', 'tts', 'sep', 'eyes'];
await Promise.all([
  esbuild.build({ ...common, entryPoints: [path.join(root, 'src/main.js')], outfile: path.join(out, 'subdub.js') }),
  ...workers.map(w => esbuild.build({ ...common, entryPoints: [path.join(root, `src/workers/${w}.worker.js`)], outfile: path.join(out, `w-${w}.js`) })),
  ...(fs.existsSync(path.join(root, 'tests/harness.js')) ? [esbuild.build({ ...common, minify: false, entryPoints: [path.join(root, 'tests/harness.js')], outfile: path.join(root, 'test-out/harness.js') })] : []),
]);
// a link inside a library error message looks like an API key to GitHub's secret scanner: shorten it
for (const f of fs.readdirSync(out).filter(f => /^(subdub|w-).*\.js$/.test(f))) {
  const p = path.join(out, f), s = fs.readFileSync(p, 'utf8'), t = s.replace(/https:\/\/gist\.github\.com\/hollance\/[0-9a-f]{32}/g, 'the Whisper docs')
    // 32-letter class names next to the word "Mistral" look like Mistral API keys (we never load those models)
    .replace(/\b(Mistral)([A-Za-z0-9]{25})\b/g, '$1_$2');
  if (t !== s) fs.writeFileSync(p, t);
}
fs.copyFileSync(path.join(root, 'src/engine/tap.worklet.js'), path.join(out, 'tap.worklet.js'));
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png']) {
  const src = path.join(root, 'src', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, f));
}
const sizes = fs.readdirSync(out).filter(f => /^(subdub|w-).*\.js$/.test(f)).map(f => `${f} ${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)}K`);
console.log('built:', sizes.join(', '));
