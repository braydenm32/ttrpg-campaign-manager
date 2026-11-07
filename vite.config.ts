import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'
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

/**
 * The security headers in public/_headers, which Cloudflare Pages sends with every file of the live
 * site, are sent by `npm run dev` and `vite preview` too. So the app, and the browser tests, run
 * under the same Content-Security-Policy as wardedatlas.com, and anything it would block shows up
 * here first. Under the desktop app (`npm run desktop`) the dev server sends the desktop app's
 * policy (src-tauri/tauri.conf.json) instead. The dev server adds one thing: a nonce, so the small
 * script it puts in the page for instant reloads may run (the built app has no scripts in its pages).
 */
function securityHeaders(): Plugin {
  const headers = (devNonce?: string) => {
    const out: [string, string][] = []
    let rule = ''
    for (const line of readFileSync(join(import.meta.dirname, 'public/_headers'), 'utf8').split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue
      if (!/^\s/.test(line)) rule = line.trim()
      else if (rule === '/*') out.push([line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1).trim()])
    }
    if (process.env.TAURI_ENV_PLATFORM) {
      const csp = JSON.parse(readFileSync(join(import.meta.dirname, 'src-tauri/tauri.conf.json'), 'utf8')).app.security.csp as Record<string, string | string[]>
      const policy = Object.entries(csp).map(([name, sources]) => [name, ...[sources].flat()].join(' ')).join('; ')
      for (const h of out) if (h[0] === 'Content-Security-Policy') h[1] = policy
    }
    if (devNonce) for (const h of out) if (h[0] === 'Content-Security-Policy') h[1] = h[1].replace(/script-src [^;]*/, (s) => `${s} 'nonce-${devNonce}'`)
    return out
  }
  const send =
    (devNonce?: string): Connect.NextHandleFunction =>
    (_req, res, next) => {
      for (const [name, value] of headers(devNonce)) res.setHeader(name, value)
      next()
    }
  const nonce = randomBytes(16).toString('base64')
  return {
    name: 'security-headers',
    // Vite then marks the dev server's own scripts with the nonce.
    config: (_, { command, isPreview }) => (command === 'serve' && !isPreview ? { html: { cspNonce: nonce } } : undefined),
    configureServer: (server) => void server.middlewares.use(send(nonce)),
    configurePreviewServer: (server) => void server.middlewares.use(send()),
  }
}

// Addresses like wardedatlas.com/w/eldoria/locations need files loaded from the site's root, so the base is "/".
// The old GitHub Pages copy lives in a folder, so its build passes --base ./ (see .github/workflows/web.yml).
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    checkExampleWorld(),
    securityHeaders(),
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
        id: '/',
        name: 'The Warded Atlas',
        short_name: 'Warded Atlas',
        description: 'GM-focused campaign and world manager for tabletop RPGs',
        start_url: '/',
        scope: '/',
        theme_color: '#16141a',
        background_color: '#16141a',
        display: 'standalone',
        icons: [
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Android crops icons to its own shape; this one leaves room for that instead of shrinking into a white circle.
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        // Long-press the home-screen icon: straight to the world used last (see src/install.tsx).
        shortcuts: [
          { name: 'Common Room', short_name: 'Common Room', description: 'Your table: next session, last time and your character', url: '/?open=room', icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] },
          { name: 'The Lectern', short_name: 'Lectern', description: 'The GM’s session in hand', url: '/?open=session', icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] },
        ],
        // Chrome's fuller install sheet shows these.
        screenshots: [
          { src: 'screenshot-room-phone.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'The Common Room on a player’s phone' },
          { src: 'screenshot-lectern-laptop.png', sizes: '1366x860', type: 'image/png', form_factor: 'wide', label: 'The Lectern on the GM’s laptop' },
        ],
      },
      // The legal pages are their own pages, not routes inside the app, so the offline cache must not swap them for the app.
      // The on-device transcription engine is big and needs the internet for its model anyway, so it isn't kept for offline.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // Pictures only for link previews and the install sheet aren't needed offline.
        globIgnores: ['**/whisper.worker-*.js', 'social.png', 'screenshot-*.png'],
        navigateFallbackDenylist: [/\.html$/],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
})
