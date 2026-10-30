import { compare } from './lib/baseline'
import { checkScreen } from './lib/checks'
import { expectations, ROUTES } from './routes'
import { expect, open, test, type View } from './fixtures'

/**
 * Every screen, on a laptop and on a phone, in the GM view and (where players can go) the player
 * view: it must open without an uncaught error, without "Something went wrong", without "not
 * found" (unless that's the point of the sample), and without the page scrolling sideways. On the
 * phone, buttons and links must be at least 44×44 px. Problems today's app already has are listed
 * in tests/baseline.json; only new ones fail (see tests/lib/baseline.ts).
 */

for (const route of ROUTES)
  for (const sample of route.samples)
    for (const view of ['gm', 'player'] as View[]) {
      const want = expectations(route, sample)[view]
      if (want === 'skip') continue
      const title = `${route.path}${sample.label ? ` (${sample.label})` : ''}, ${view === 'gm' ? 'GM' : 'player'} view`
      test.describe(() => {
        test.use({ view })
        test(title, async ({ page, world, pageErrors, device }, info) => {
          const url = world.resolve(sample.url)
          info.annotations.push({ type: 'address', description: url })
          await open(page, url)
          // The world's own screens must show the world, not bounce somewhere else.
          if (route.path.startsWith('/w/') && !route.path.includes('/print/')) await expect(page.locator('.topbar')).toBeVisible()
          const found = await checkScreen(page, { phone: device === 'phone', notFound: want === 'not-found', errors: pageErrors })
          const key = `${device} ${view} ${route.path}${sample.label ? ` (${sample.label})` : ''}`
          const fresh = compare(key, found, info)
          expect(fresh, `New problems on ${url} (${key}). If they're expected, update the baseline: npm test -- -u`).toEqual([])
        })
      })
    }
