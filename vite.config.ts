import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  build: { assetsInlineLimit: 100_000_000, target: 'es2020', chunkSizeWarningLimit: 4000 },
});
