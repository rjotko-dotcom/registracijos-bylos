// Single-file demo build: everything (JS, CSS, sprites, audio) inlined into
// one HTML file so the app can be shared as a standalone page. PWA/service
// worker is disabled here — use vite.config.ts for the real build.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), VitePWA({ disable: true }), viteSingleFile()],
  build: {
    outDir: 'dist-demo',
    assetsInlineLimit: 100_000_000,
  },
});
