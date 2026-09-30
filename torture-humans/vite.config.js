import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: './',
  // dev: assets are served from public/assets; build: they ship as a separate .pak
  // (copying them into dist would put ~1 GB inside the .exe again)
  publicDir: command === 'build' ? false : 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'code', // 'assets/' is the game's models and textures
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    assetsInlineLimit: 0,
  },
  server: { port: 5178, strictPort: true },
}));
