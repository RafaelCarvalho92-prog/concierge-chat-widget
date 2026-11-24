/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Demo site (landing page + playground). base './' keeps every URL relative.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        playground: resolve(__dirname, 'playground.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
