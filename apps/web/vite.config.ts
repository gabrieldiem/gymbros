/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
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

export default defineConfig({
  plugins: [
    react(),
    staticLegalPages(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
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
        // Offline, the app's own /privacy and /terms routes show this copy.
        globIgnores: ['privacy.html', 'terms.html'],
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
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
