/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In Docker the api is `http://api:8080`; natively it is localhost.
const apiProxy = process.env.VITE_API_PROXY ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
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
