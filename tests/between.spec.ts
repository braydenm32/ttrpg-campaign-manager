import { expect, go, open, setView, test, type Page } from './fixtures'
import { getRecord, patchRecord, putBack } from './lib/records'
import { PORT } from './lib/server'
import type { World } from './lib/world'

/**
 * The first ten minutes and the time between sessions: the welcome on an empty shelf, Duplicate, roll
 * buttons in a page's text, recently opened pages in search, a page that reveals itself on a date,
 * who was there on the Lectern, and Add to calendar by a booked date.
 *
 * Each test puts back what it changed (straight in the database), since tests in one worker share
 * the world.
 */

/** How many pages the app's database holds. */
const countPages = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const c = req.result.transaction('entities', 'readonly').objectStore('entities').count()
          c.onsuccess = () => {
            req.result.close()
            resolve(c.result)
          }
        }
      }),
  )

const gmPage = (world: World) =>
  world.dump.entities.find((e) => e.visibility === 'gm' && !e.template && e.type === 'npc')!

test('an empty shelf welcomes a new GM with the picture and two ways in', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: `http://localhost:${PORT}`, serviceWorkers: 'block', viewport: { width: 1366, height: 860 } })
  await context.route((url) => url.host !== `localhost:${PORT}`, (route) => route.abort())
  const page = await context.newPage()
  try {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Run your world from one place/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open the example (instant)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start my world' })).toBeVisible()
    const img = page.locator('img[src$="welcome.webp"]')
    await expect(img).toBeVisible()
    expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
    // Link previews (Discord, WhatsApp, iMessage) get a title, a line and a picture.
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /social\.png$/)
  } finally {
    await context.close()
  }
})

test('Duplicate opens a GM-only copy with (copy) in its name, and Cancel leaves nothing behind', async ({ page, world }) => {
  const e = gmPage(world)
  const w = `/w/${world.slug}`
  await open(page, `${w}/p/${world.pageSlug(e.name)}`)
  const count = await countPages(page)
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.locator('.title-input')).toHaveValue(`${e.name} (copy)`)
  await page.getByRole('button', { name: 'Cancel' }).first().click()
  await expect.poll(() => countPages(page)).toBe(count)
})

test('roll:1d6 in a page is a button that rolls, for the GM and in the player view', async ({ page, world }) => {
  const p = world.playerPages[0]
  const before = await (async () => {
    await open(page, `/w/${world.slug}`)
    return patchRecord(page, 'entities', p.id, { body: `${p.body}\n\nThe toll is roll:1d6 silver.` })
  })()
  try {
    await open(page, `/w/${world.slug}/p/${world.pageSlug(p.name)}`)
    const roll = page.locator('.inline-roll-wrap').first()
    await expect(roll).toBeVisible()
    await roll.getByRole('button').click()
    await expect(roll.locator('output')).toHaveText(/[1-6]/)
    await setView(page, world, 'player')
    await open(page, `/w/${world.slug}/p/${world.pageSlug(p.name)}`)
    await expect(page.locator('button.inline-roll').first()).toBeVisible()
  } finally {
    await putBack(page, 'entities', [[p.id, before]])
  }
})

test('pages opened lately come first in search before typing', async ({ page, world, device }) => {
  const p = world.playerPages[1]
  await open(page, `/w/${world.slug}/p/${world.pageSlug(p.name)}`)
  await go(page, `/w/${world.slug}`)
  if (device === 'phone') await page.getByRole('button', { name: 'Search' }).click()
  else await page.keyboard.press('Control+k')
  const list = page.getByRole('dialog', { name: 'Search' }).getByRole('listbox', { name: 'Recently opened' })
  await expect(list).toBeVisible()
  await expect(list).toContainText(p.name)
})

test('a page with a reveal date shows when it appears, and turns “Players can see this” once the date has come', async ({ page, world }) => {
  const e = gmPage(world)
  await open(page, `/w/${world.slug}`)
  const before = await getRecord(page, 'entities', e.id)
  const at = new Date(Date.now() + 3 * 86_400_000)
  try {
    await patchRecord(page, 'entities', e.id, { revealAt: at.getTime() })
    await open(page, `/w/${world.slug}/p/${world.pageSlug(e.name)}`)
    await expect(page.locator('.reveal-on-chip')).toContainText('Appears for players on')
    // In the player view it isn't there yet.
    await setView(page, world, 'player')
    await open(page, `/w/${world.slug}/p/${world.pageSlug(e.name)}`)
    await expect(page.getByRole('heading', { level: 1, name: e.name })).toHaveCount(0)
    // The date passes: opening the world reveals it.
    await patchRecord(page, 'entities', e.id, { revealAt: Date.now() - 60_000 })
    await setView(page, world, 'gm')
    await open(page, `/w/${world.slug}`)
    await expect.poll(async () => (await getRecord(page, 'entities', e.id))?.visibility).toBe('players')
    expect((await getRecord(page, 'entities', e.id))?.revealAt).toBeUndefined()
  } finally {
    await putBack(page, 'entities', [[e.id, before]])
  }
})

test('who was there is ticked on the Lectern and kept on the session', async ({ page, world }) => {
  const s1 = world.session(1)
  await open(page, `/w/${world.slug}`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    await open(page, `/w/${world.slug}/s/${s1.id}/lectern`)
    const who = page.locator('.who-was-there').first()
    await expect(who).toBeVisible()
    const first = who.getByRole('checkbox').first()
    await expect(first).toBeChecked()
    const ticked = await who.getByRole('checkbox').count()
    await first.uncheck()
    await expect(first).not.toBeChecked()
    // From then on the session keeps its own list: everyone but the one unticked.
    await expect.poll(async () => ((await getRecord(page, 'sessions', s1.id))?.present as string[] | undefined)?.length).toBe(ticked - 1)
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

async function bookIn(page: Page, campaignId: string, days: number) {
  const at = new Date(Date.now() + days * 86_400_000)
  at.setHours(19, 0, 0, 0)
  return patchRecord(page, 'campaigns', campaignId, { booked: { id: 'between-test', at: at.toISOString().slice(0, 16), utc: at.toISOString() } })
}

test.describe('players', () => {
  test.use({ view: 'player' })

  test('a booked game night can go in a calendar, from Now', async ({ page, world }) => {
    const campaign = world.dump.campaigns[0]
    await open(page, `/w/${world.slug}`)
    const before = await bookIn(page, campaign.id, 3)
    try {
      await open(page, `/w/${world.slug}`)
      const add = page.getByRole('region', { name: 'Next session and last time' }).getByRole('button', { name: 'Add to calendar' })
      await expect(add).toBeVisible()
      await add.click()
      await expect(page.getByRole('menuitem', { name: 'Google Calendar' })).toHaveAttribute('href', /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/)
      const download = page.waitForEvent('download')
      await page.getByRole('menuitem', { name: /Calendar file/ }).click()
      const file = await download
      expect(file.suggestedFilename()).toMatch(/\.ics$/)
    } finally {
      await putBack(page, 'campaigns', [[campaign.id, before]])
    }
  })
})
