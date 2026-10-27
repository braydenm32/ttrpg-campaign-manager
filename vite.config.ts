import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the same build works on GitHub Pages (served from /<repo>/) and inside the Tauri desktop app.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // The speech engine's own copy of its 26 MB runtime is never loaded: transformers.js fetches the
    // runtime from jsDelivr at run time. Leaving it out keeps every file under Cloudflare Pages' 25 MB limit.
    {
      name: 'drop-unused-onnx-wasm',
      generateBundle(_, bundle) {
        for (const name of Object.keys(bundle)) if (/ort-wasm-simd-threaded.*\.wasm$/.test(name)) delete bundle[name]
      },
    },
    // Makes the web version installable and usable offline. Registered from main.tsx (skipped inside the desktop app).
    VitePWA({
      injectRegister: null,
      // A new version waits for the GM to reload (see src/appUpdate.tsx), so it never interrupts a session.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'The Warded Atlas',
        short_name: 'Warded Atlas',
        description: 'GM-focused campaign and world manager for tabletop RPGs',
        theme_color: '#16141a',
        background_color: '#16141a',
        display: 'standalone',
        icons: [
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      // The legal pages are their own pages, not routes inside the app, so the offline cache must not swap them for the app.
      // The on-device transcription engine is big and needs the internet for its model anyway, so it isn't kept for offline.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/whisper.worker-*.js'],
        navigateFallbackDenylist: [/\.html$/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
})
