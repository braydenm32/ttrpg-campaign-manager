import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import { PORT, type Device } from './lib/server'
import { addCustomType, readDatabase, World } from './lib/world'

export type { Device }
export type View = 'gm' | 'player'

/**
 * Shared set-up for every browser test.
 *
 * Each test worker opens one browser profile, loads the Vael Ardith example world from the worlds
 * shelf the way a person does (about ten seconds), and keeps it for all the tests it runs. Each test
 * then gets a fresh tab in that profile. Tests in one worker run one after another, so a test that
 * changes something (a new page from search, say) tidies up after itself.
 *
 * Nothing leaves the machine: requests to anything but the test server (the cloud, web fonts) are
 * refused, so the tests run the same offline, here and on GitHub.
 */

interface Fixtures {
  /** The example world: ids, names, slugs and the raw data. */
  world: World
  /** Uncaught errors in the page since the test started. */
  pageErrors: string[]
  /** Which view the tab opens worlds in. Set it with test.use({ view: 'player' }) or setView(). */
  view: View
}
interface WorkerFixtures {
  device: Device
  atlas: { context: BrowserContext; world: World }
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  device: ['laptop', { scope: 'worker', option: true }],
  atlas: [
    async ({ browser, device }, provide) => {
      const phone = device === 'phone'
      const context = await browser.newContext({
        baseURL: `http://localhost:${PORT}`,
        serviceWorkers: 'block',
        viewport: phone ? { width: 390, height: 844 } : { width: 1366, height: 860 },
        ...(phone
          ? {
              isMobile: true,
              hasTouch: true,
              deviceScaleFactor: 3,
              userAgent:
                'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
            }
          : {}),
      })
      await context.route((url) => url.host !== `localhost:${PORT}`, (route) => route.abort())
      // The print screen opens the print dialog by itself; there's no one to close it here.
      await context.addInitScript(() => {
        window.print = () => {}
      })
      const page = await context.newPage()
      await page.goto('/')
      await page.getByRole('button', { name: /Vael Ardith/ }).first().click()
      await page.waitForURL(/\/w\/[^/]+/, { timeout: 120_000 })
      // Its maps and pictures are drawn in the background; wait until they're all there.
      await page.waitForTimeout(500)
      await page.getByText(/this world’s (maps and pictures|pictures and maps)/).waitFor({ state: 'detached', timeout: 240_000 })
      // The note can come and go before this looks, so also wait for the list of what's left to draw
      // (src/example/load.ts keeps it on the device until the last map is in) to be gone.
      await page.waitForFunction(() => !Object.keys(localStorage).some((k) => k.startsWith('example.toDraw.')), undefined, { timeout: 240_000, polling: 500 })
      const first = new World(await readDatabase(page))
      await page.goto('/')
      await addCustomType(page, first.id)
      const world = new World(await readDatabase(page))
      await page.close()
      await provide({ context, world })
      await context.close()
    },
    { scope: 'worker', timeout: 300_000 },
  ],
  world: async ({ atlas }, provide) => provide(atlas.world),
  view: ['gm', { option: true }],
  page: async ({ atlas, view }, provide) => {
    const page = await atlas.context.newPage()
    await setView(page, atlas.world, view)
    await provide(page)
    await page.close()
  },
  pageErrors: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await provide(errors)
  },
})

/** Opens worlds in the GM view or the player view (the app remembers it per world on the device). */
export async function setView(page: Page, world: World, view: View) {
  await page.addInitScript(
    ({ key, view }) => {
      try {
        localStorage.setItem(key, view)
      } catch {
        /* about:blank */
      }
    },
    { key: `viewMode.${world.id}`, view },
  )
}

/** Waits until the screen has finished loading: no "Loading…", the address settled. */
export async function settle(page: Page) {
  await page.waitForLoadState('load')
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0, { timeout: 20_000 })
  let last = ''
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150)
    const now = page.url()
    if (now === last) break
    last = now
  }
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0, { timeout: 20_000 })
}

/** Opens an address and waits for the screen. */
export async function open(page: Page, url: string) {
  await page.goto(url)
  await settle(page)
}

/** Goes to an address inside the app without reloading it (much faster than page.goto). */
export async function go(page: Page, url: string) {
  await page.evaluate((u) => {
    window.history.pushState(null, '', u)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, url)
  await settle(page)
}

/** The path and query of the current address. */
export const here = (page: Page) => {
  const u = new URL(page.url())
  return decodeURIComponent(u.pathname) + u.search
}

export { expect }
export type { Page }
