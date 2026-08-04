import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const localSupabaseCsp = {
  name: 'project-odysseus-local-supabase-csp',
  transformIndexHtml(html: string) {
    return html.replace(
      "connect-src 'self'",
      "connect-src 'self' http://127.0.0.1:54321 http://localhost:54321 ws://127.0.0.1:54321 ws://localhost:54321",
    );
  },
};

export default defineConfig(({ command }) => ({
  // The checked-in/production CSP permits only hosted Supabase. Vite's dev
  // server adds loopback Supabase origins so local Auth/RLS can be tested
  // without weakening the generated production documents.
  plugins: [react(), ...(command === 'serve' ? [localSupabaseCsp] : [])],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: path.resolve(rootDir, 'react-app-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(rootDir, 'src/app/main.tsx'),
      formats: ['es'],
      fileName: () => 'react-app-[hash].js',
    },
    rollupOptions: {
      preserveEntrySignatures: false,
      output: {
        entryFileNames: 'react-app-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'react-app-[hash].css';
          }
          return '[name][extname]';
        },
      },
    },
  },
}));
