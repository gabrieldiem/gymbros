/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { VitePWA } from 'vite-plugin-pwa';

import { PRIVACY_PAGE, TERMS_PAGE } from './src/features/legal/legalContent';
import { renderStaticLegalPage } from './src/features/legal/staticLegalPage';

// In Docker the api is `http://api:8080`; natively it is localhost.
const apiProxy = process.env.VITE_API_PROXY ?? 'http://localhost:8080';

/** Emit privacy.html and terms.html, which nginx serves at /privacy and /terms. */
function staticLegalPages(): Plugin {
  return {
    name: 'gymbros-static-legal-pages',
    apply: 'build',
    generateBundle() {
      const pages = { 'privacy.html': PRIVACY_PAGE, 'terms.html': TERMS_PAGE };
      for (const [fileName, page] of Object.entries(pages)) {
        this.emitFile({ type: 'asset', fileName, source: renderStaticLegalPage(page) });
      }
    },
  };
}

/**
 * Serve the emoji data from this site at /emoji, for the picker. It would otherwise come from a
 * public CDN, which would learn who opens it.
 */
function emojiData(): Plugin {
  const FILES = ['en/data.json', 'en/messages.json', 'es/data.json', 'es/messages.json'];
  const read = (file: string) =>
    readFileSync(resolve(__dirname, 'node_modules/emojibase-data', file));
  return {
    name: 'gymbros-emoji-data',
    configureServer(server) {
      server.middlewares.use('/emoji', (request, response, next) => {
        const file = (request.url ?? '').split('?')[0]?.replace(/^\//, '') ?? '';
        if (!FILES.includes(file)) return next();
        response.setHeader('Content-Type', 'application/json');
        response.end(read(file));
      });
    },
    generateBundle() {
      for (const file of FILES) {
        this.emitFile({ type: 'asset', fileName: `emoji/${file}`, source: read(file) });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    staticLegalPages(),
    emojiData(),
    VitePWA({
      // A new version waits for the member: see src/pwa/registerServiceWorker.ts.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'GYMBROS',
        short_name: 'GYMBROS',
        description: 'Better than yesterday. Log workouts and climb ATUS Climb with your crew.',
        lang: 'en',
        start_url: '/climb',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0D0D0D',
        theme_color: '#0D0D0D',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell only: API calls always go to the network.
        // Fonts: only the latin subset (covers English and Spanish). The latin-ext and
        // vietnamese files stay in the font CSS and load on demand via unicode-range.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-[0-9]*.woff2'],
        // Offline, the app's own /privacy and /terms routes show this copy. The email artwork is
        // for mail apps, and the rich text editor only for admins, so phones don't fetch them.
        globIgnores: [
          'privacy.html',
          'terms.html',
          'og.png',
          'email/**',
          'assets/RichTextEditor-*',
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: apiProxy, changeOrigin: false, xfwd: true } },
    watch: { usePolling: process.env.VITE_USE_POLLING === 'true' },
  },
  build: { sourcemap: true },
  test: {
    env: { VITE_CONTACT_EMAIL: 'hello@example.test' },
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
