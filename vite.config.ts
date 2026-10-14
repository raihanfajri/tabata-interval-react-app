/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// `--mode android` builds the web files for the Capacitor APK (`npm run
// build:android`) into dist-android/.
export default defineConfig(({ mode }) => ({
  build: mode === 'android' ? { outDir: 'dist-android' } : {},
  plugins: [
    react(),
    // Installable, offline-capable PWA (Android-first). The service worker
    // precaches the built app shell; icons are generated from favicon.svg.
    VitePWA({
      // The APK serves its files from inside the app, so a service worker adds
      // nothing offline and could keep serving the old version after an update.
      disable: mode === 'android',
      registerType: 'autoUpdate',
      pwaAssets: {
        image: 'public/favicon.svg',
        preset: 'minimal-2023',
      },
      manifest: {
        name: 'Interval App',
        short_name: 'Interval',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#16171d',
        theme_color: '#16171d',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
}))
