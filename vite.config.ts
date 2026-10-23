import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the same build works on GitHub Pages (served from /<repo>/) and inside the Tauri desktop app.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Makes the web version installable and usable offline. Registered from main.tsx (skipped inside the desktop app).
    VitePWA({
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Campaign Codex',
        short_name: 'Codex',
        description: 'GM-focused campaign and world manager for tabletop RPGs',
        theme_color: '#15131a',
        background_color: '#15131a',
        display: 'standalone',
        icons: [
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      // The legal pages are their own pages, not routes inside the app, so the offline cache must not swap them for the app.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallbackDenylist: [/\.html$/], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
  server: { port: 5173, strictPort: true },
})
