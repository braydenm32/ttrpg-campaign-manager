import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { MAPS } from './src/example/maps/index.ts'
import { describeProblems, parseExampleFiles } from './src/example/parse.ts'

/**
 * Checks the example world's Markdown files (worlds/vael-ardith) before every build, so a mistake
 * stops the build, and the live site keeps its last good version, instead of breaking the example.
 * While running the app locally (npm run dev) it prints the same report each time a file is saved.
 */
function checkExampleWorld(): Plugin {
  const folder = 'worlds/vael-ardith'
  const check = () => {
    const root = join(import.meta.dirname, folder)
    const files = Object.fromEntries(
      readdirSync(root, { recursive: true })
        .map((p) => String(p).replaceAll('\\', '/'))
        .filter((p) => p.endsWith('.md'))
        .map((p) => [p, readFileSync(join(root, p), 'utf8')]),
    )
    const { problems } = parseExampleFiles(files, MAPS)
    return { problems, report: describeProblems(problems, `${folder}/`) }
  }
  return {
    name: 'check-example-world',
    buildStart() {
      const { problems, report } = check()
      if (problems.some((p) => p.level === 'error')) this.error(`The example world has mistakes to fix:\n${report}`)
      if (problems.length) this.warn(`The example world has warnings worth a look:\n${report}`)
    },
    configureServer(server) {
      const show = () => {
        const { problems, report } = check()
        server.config.logger.info(problems.length ? `\nExample world:\n${report}\n` : 'Example world: ✓ all good', { timestamp: true })
      }
      server.watcher.on('change', (file) => {
        if (file.replaceAll('\\', '/').includes(`/${folder}/`)) show()
      })
    },
  }
}

// Addresses like wardedatlas.com/w/eldoria/locations need files loaded from the site's root, so the base is "/".
// The old GitHub Pages copy lives in a folder, so its build passes --base ./ (see .github/workflows/web.yml).
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    checkExampleWorld(),
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
