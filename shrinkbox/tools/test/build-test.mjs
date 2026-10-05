// Builds a standalone test page for the human system: node tools/test/build-test.mjs <entry.js> <out.html>
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
const [entry, out] = process.argv.slice(2);
const r = await build({ entryPoints: [entry], bundle: true, format: 'iife', write: false, loader: { '.bin': 'binary' }, target: ['es2020'] });
writeFileSync(out, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#222;overflow:hidden}</style><body><script>${r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
console.log('ok', out);
