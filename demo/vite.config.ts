import { defineConfig } from 'vite';

// Relative base so the build works under any path (GitHub Pages serves it at /three-steel/).
export default defineConfig({
  base: './',
  // three.js alone is ~600 kB minified.
  build: { outDir: '../demo-dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
