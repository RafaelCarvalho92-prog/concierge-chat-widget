import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The embeddable widget: a single self-executing file with zero dependencies.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2019',
    lib: {
      entry: resolve(__dirname, 'src/embed.ts'),
      name: 'Concierge',
      formats: ['iife'],
      fileName: () => 'concierge.js',
    },
    minify: 'esbuild',
    sourcemap: false,
  },
});
