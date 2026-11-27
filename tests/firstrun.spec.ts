import type { Browser } from '@playwright/test'
import { expect, here, open, setView, test, type Device, type Page } from './fixtures'
import { getRecord, patchRecord, putBack } from './lib/records'
import { PORT } from './lib/server'

/**
 * The first run and the things that follow the campaign, on a laptop and a phone: the front page's
 * big button opens Vael Ardith at its Start here tour (the small sample is the second choice);
 * Getting started stays after the first campaign and goes when hidden (More brings it back); Look
 * it up follows the game of the campaign on the Desk; a paused campaign is off the Desk until Carry
 * on; and the date in the top bar opens Date and time, with nothing GM-only for a player.
 */

/** A fresh browser profile at the test's screen size, refusing anything but the test server. */
async function freshContext(browser: Browser, device: Device) {
  const phone = device === 'phone'
  const context = await browser.newContext({
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'block',
    viewport: phone ? { width: 390, height: 844 } : { width: 1366, height: 860 },
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
  })
  await context.route((url) => url.host !== `localhost:${PORT}`, (route) => route.abort())
  return context
}

const toast = (page: Page) => page.locator('.undo-toast')

test('the big button on an empty shelf opens Vael Ardith at its Start here tour; the small sample is the second choice', async ({ browser, device }) => {
  test.setTimeout(150_000)
  const context = await freshContext(browser, device)
  try {
    const page = await context.newPage()
    await page.goto('/')
    const big = page.locator('.welcome-actions .primary')
    await expect(big).toContainText('Open the example, Vael Ardith')
    await expect(page.locator('.welcome-sample').getByRole('button', { name: /small sample, The Shattered Coast/ })).toBeVisible()
    // On the shelf too, Vael Ardith comes first and the Shattered Coast says it is the small sample.
    const books = page.locator('.shelf.examples .book-example')
    await expect(books.first()).toContainText('Vael Ardith')
    await expect(books.nth(1)).toContainText('The small sample')
    await big.click()
    await page.waitForURL(/\/w\/[^/]+\/p\/[^/]+/, { timeout: 120_000 })
    await expect(page.getByRole('heading', { name: 'Start Here', level: 1 })).toBeVisible()
    // Its maps and pictures carry on arriving, counted in the top bar.
    await expect(page.locator('.topbar .loading-chip')).toBeVisible({ timeout: 30_000 })
    // Back on the shelf, the example is there once: its book opens the copy already on this device.
    await page.goto('/')
    await expect(page.locator('.welcome')).toHaveCount(0)
    await expect(page.locator('.shelf.examples').getByRole('button', { name: /Vael Ardith/ })).toHaveCount(1)
    const count = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const r = indexedDB.open('ttrpg-campaign-manager')
          r.onsuccess = () => {
            const q = r.result.transaction('worlds').objectStore('worlds').getAll()
            q.onsuccess = () => (r.result.close(), resolve(q.result.filter((w: { example?: number }) => w.example).length))
          }
        }),
    )
    expect(count).toBe(1)
  } finally {
    await context.close()
  }
})

test('Getting started stays after the first campaign, goes when hidden, and More brings it back', async ({ browser, device }) => {
  test.setTimeout(90_000)
  const context = await freshContext(browser, device)
  try {
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: /New world/ }).click()
    await page.getByLabel('Name').fill('First Steps World')
    await page.getByRole('button', { name: 'Create world' }).click()
    await page.waitForURL(/\/w\/[^/]+/)
    const w = here(page).split('?')[0]
    const start = page.locator('.getting-started')
    await expect(start).toBeVisible()
    await expect(start).toContainText('0 of 7 done')
    await start.getByRole('button', { name: 'Make a campaign' }).click()
    await page.getByRole('dialog').getByLabel('Name').fill('The Long Road')
    await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
    await page.waitForURL(/\/c\//)
    await open(page, w)
    // Still there, with the campaign ticked.
    await expect(start).toBeVisible()
    await expect(start.locator('[data-step="campaign"]')).toHaveAttribute('data-done', 'yes')
    await expect(start).toContainText('1 of 7 done')
    // An optional step can be skipped.
    await start.locator('[data-step="invite"]').getByRole('button', { name: 'Skip' }).click()
    await expect(start.locator('[data-step="invite"]')).toHaveAttribute('data-done', 'yes')
    await start.getByRole('button', { name: 'Hide' }).click()
    await expect(start).toHaveCount(0)
    await open(page, w)
    await expect(start).toHaveCount(0)
    // More › Getting started brings it back.
    await open(page, `${w}/more`)
    await page.locator('main').getByRole('link', { name: /Getting started/ }).click()
    await expect(start).toBeVisible()
    await expect(page).not.toHaveURL(/start=1/)
  } finally {
    await context.close()
  }
})

test('the example world doesn’t show Getting started on its Desk', async ({ page, world }) => {
  await open(page, `/w/${world.slug}`)
  await expect(page.locator('.desk-strip')).toBeVisible()
  await expect(page.locator('.getting-started')).toHaveCount(0)
})

test('Look it up follows the game of the campaign on the Desk', async ({ page, world }) => {
  const campaignId = world.dump.campaigns[0].id
  await open(page, `/w/${world.slug}/lookup`)
  const before = await patchRecord(page, 'campaigns', campaignId, { system: 'Daggerheart' })
  try {
    await open(page, `/w/${world.slug}/lookup`)
    await expect(page.getByRole('combobox', { name: 'Game' })).toHaveValue('Daggerheart')
    // Another game for a while, then back to the campaign's.
    await page.getByRole('combobox', { name: 'Game' }).selectOption('Pathfinder 2e')
    await page.getByRole('button', { name: 'Back to Daggerheart' }).click()
    await expect(page.getByRole('combobox', { name: 'Game' })).toHaveValue('Daggerheart')
  } finally {
    await putBack(page, 'campaigns', [[campaignId, before]])
  }
})

test('a paused campaign is off the Desk and the Session area, and Carry on brings it back', async ({ page, world }) => {
  const campaign = world.dump.campaigns[0]
  const w = `/w/${world.slug}`
  await open(page, w)
  const before = await getRecord(page, 'campaigns', campaign.id)
  try {
    await expect(page.locator('.desk-strip .primary')).toHaveAttribute('data-next', /play|prep|wrap/)
    await open(page, `${w}/c/${campaign.id}`)
    await page.locator('.campaign-settings summary').click()
    await page.getByRole('combobox', { name: 'Status' }).selectOption('paused')
    await expect(toast(page)).toContainText('is paused')
    await open(page, w)
    await expect(page.locator('.desk-strip')).toContainText('No campaign being run')
    await expect(page.locator('.paused-campaigns')).toContainText(campaign.name)
    await open(page, `${w}/session`)
    await expect(page.locator('main')).toContainText('paused or finished')
    await open(page, w)
    await page.locator('.paused-campaigns').getByRole('button', { name: 'Carry on' }).click()
    await expect(toast(page)).toContainText('back on the Desk')
    await expect(page.locator('.desk-strip .primary')).toHaveAttribute('data-next', /play|prep|wrap/)
    await expect(page.locator('.paused-campaigns')).toHaveCount(0)
  } finally {
    await putBack(page, 'campaigns', [[campaign.id, before]])
  }
})

test('the date in the top bar opens Date and time; a player sees no GM-only events there', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  await open(page, w)
  // On a phone the date is a calendar button in the top bar.
  await page.locator('header.topbar a.world-date').click()
  await expect(page).toHaveURL(new RegExp(`${w}/date$`))
  await expect(page.getByRole('heading', { name: 'Date and time', level: 1 })).toBeVisible()
  await expect(page.locator('.date-today .world-today')).toBeVisible()
  await expect(page.getByRole('button', { name: '+1 day' })).toBeVisible()
  await expect(page.locator('.game-clock').getByRole('heading', { name: /In-game time/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Set up the calendar' })).toBeVisible()
  // The old home of the time of day says where it went.
  await open(page, `${w}/clocks`)
  await page.locator('.clocks-moved').getByRole('link', { name: 'Date and time' }).click()
  await expect(page).toHaveURL(new RegExp(`${w}/date$`))

  // A player: the date and weather, no controls, no clock unless shown, and only events they can see.
  const hidden = world.dump.entities.filter((e) => e.type === 'event' && e.visibility === 'gm').map((e) => e.name)
  await setView(page, world, 'player')
  try {
    await open(page, `${w}/date`)
    await expect(page.getByRole('heading', { name: 'Date and time', level: 1 })).toBeVisible()
    await expect(page.locator('.date-today .world-today')).toBeVisible()
    await expect(page.getByRole('button', { name: '+1 day' })).toHaveCount(0)
    await expect(page.locator('.game-clock')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Set up the calendar' })).toHaveCount(0)
    const text = await page.locator('main').innerText()
    for (const name of hidden) expect(text).not.toContain(name)
    await expect(page.locator('header.topbar a.world-date')).toHaveAttribute('href', new RegExp(`${w}/date$`))
  } finally {
    await setView(page, world, 'gm')
  }
})
