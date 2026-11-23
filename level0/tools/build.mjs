import { build } from 'esbuild';
await build({ entryPoints: { game: 'src/main.js', worker: 'src/worker.js' }, bundle: true, format: 'esm', minify: true, outdir: '.', target: 'es2020', logLevel: 'warning' });
