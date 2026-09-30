import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
  server: { port: 5178, strictPort: true },
});
