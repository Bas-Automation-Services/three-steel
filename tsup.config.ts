import { defineConfig } from 'tsup';

// Two entries; the adapter imports the core, so the shared code lands in one chunk.
export default defineConfig({
  entry: { index: 'src/index.ts', 'three/index': 'src/three/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: ['three'],
});
