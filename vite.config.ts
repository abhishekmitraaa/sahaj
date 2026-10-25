import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'samples/*', 'tesseract/**/*'],
      manifest: {
        name: 'Sahaj — accessible study reader',
        short_name: 'Sahaj',
        description: 'Listen, read and follow lectures in a way that suits you. Works offline.',
        theme_color: '#1b2a4a',
        background_color: '#f6f8fb',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2,pdf,json,gz,mjs}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
