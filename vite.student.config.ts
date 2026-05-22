import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(rootDir, 'student-app-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(rootDir, 'student-app/src/main.tsx'),
      formats: ['iife'],
      name: 'StudentAppBundle',
      fileName: () => 'student-app.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'student-app.css';
          }
          return '[name][extname]';
        },
      },
    },
  },
});
