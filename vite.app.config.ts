import { defineConfig, loadEnv } from 'vite';
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

function localRuntimeConfig(formspreeEndpoint: string) {
  return {
    name: 'project-odysseus-local-runtime-config',
    transformIndexHtml(html: string) {
      const endpoint = /^https:\/\/formspree\.io\/f\/[A-Za-z0-9_-]+$/.test(formspreeEndpoint)
        ? formspreeEndpoint
        : '';
      return html.replace(
        '</head>',
        `    <script>window.__PO_FORMSPREE_ENDPOINT__ = ${JSON.stringify(endpoint)};</script>\n  </head>`,
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, rootDir, '');

  return {
  // The checked-in/production CSP permits only hosted Supabase. Vite's dev
  // server adds loopback Supabase origins so local Auth/RLS can be tested
  // without weakening the generated production documents.
  plugins: [
    react(),
    ...(command === 'serve' ? [localSupabaseCsp, localRuntimeConfig(env.FORMSPREE_ENDPOINT || '')] : []),
  ],
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
        // Keep shared third-party code out of the initial application entry.
        // The route modules are already lazy; without explicit vendor chunks,
        // Rollup promotes their shared dependencies into the entry and makes
        // every first visit pay for all role dashboards.
        manualChunks(id) {
          const normalizedId = id.replace(/\\\\/g, '/');
          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }
          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'lucide-icons';
          }
          return undefined;
        },
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
  };
});
