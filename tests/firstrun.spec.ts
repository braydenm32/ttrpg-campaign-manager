import type { Browser } from '@playwright/test'
import { expect, here, open, setView, test, type Device, type Page } from './fixtures'
import { getRecord, patchRecord, putBack } from './lib/records'
import { PORT } from './lib/server'

/**
 * The first run and the things that follow the campaign, on a laptop and a phone: the front page's
 * big button opens Vael Ardith at its Start here tour (the small sample is the second choice);
 * Getting started stays after the first campaign and goes when hidden or when all seven steps are
 * done (More brings it back, or says they're done), and never starts by itself in the example; Look
 * it up follows the game of the campaign on the Desk; a paused campaign is off the Desk, the Session
 * area and the players' next session until Carry on, except while a session of it is being played;
 * Planning turns Active by itself; and the date in the top bar opens Date and time, with nothing
 * GM-only for a player.
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

/** Forgets what Getting started remembers about a world on this device (tests in one worker share the profile). */
const forgetFirstSteps = (page: Page, worldId: string) =>
  page.evaluate((id) => ['hidden', 'started', 'skipped', 'imported'].forEach((k) => localStorage.removeItem(`gettingStarted.${k}.${id}`)), worldId)

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
    // "Start from an export…" lands here with the importer open and in view, not somewhere below the fold.
    await open(page, `${w}?import=1`)
    await expect(page.locator('#getting-started-import')).toBeInViewport()
    await open(page, w)
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
    // It comes into view, wherever it sits on the Desk.
    await expect(start).toBeInViewport()
  } finally {
    await context.close()
  }
})

test('the example world doesn’t show Getting started on its Desk, however often it’s opened', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  await open(page, w)
  await forgetFirstSteps(page, world.id)
  try {
    // While a world's pages are still being read it looks empty: that must not count as "new".
    for (let visit = 0; visit < 3; visit++) {
      await open(page, w)
      await expect(page.locator('.desk-strip')).toBeVisible()
      await expect(page.locator('.recently-opened, .needs-you').first()).toBeVisible()
      await expect(page.locator('.getting-started')).toHaveCount(0)
      await open(page, `${w}/more`)
    }
    expect(await page.evaluate((id) => localStorage.getItem(`gettingStarted.started.${id}`), world.id)).toBeNull()
  } finally {
    await forgetFirstSteps(page, world.id)
  }
})

test('Getting started, brought back in a world that is under way: hand-made pages don’t tick “Bring them in”, and it goes when all seven are done', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  await open(page, w)
  await forgetFirstSteps(page, world.id)
  try {
    const start = page.locator('.getting-started')
    await open(page, `${w}?start=1`)
    await expect(start).toBeVisible()
    await expect(start).toBeInViewport()
    // The example has a campaign, people and places, maps, revealed pages and is the example itself: five done.
    await expect(start).toContainText('5 of 7 done')
    const bringIn = start.locator('[data-step="import"]')
    // Its pages were never imported, so that step is still open, and says so honestly.
    await expect(bringIn).toHaveAttribute('data-done', 'no')
    await bringIn.getByRole('button', { name: 'Skip' }).click()
    await expect(bringIn).toHaveAttribute('data-done', 'yes')
    // The importer is still one press away after the step is ticked.
    await expect(bringIn.getByRole('button', { name: 'Import notes' })).toBeVisible()
    await start.locator('[data-step="invite"]').getByRole('button', { name: 'Skip' }).click()
    // All seven ticked: the card goes by itself, and stays gone.
    await expect(start).toHaveCount(0)
    await open(page, w)
    await expect(page.locator('.needs-you')).toBeVisible()
    await expect(start).toHaveCount(0)
    // Asked for again, there's nothing to show, and it says so.
    await open(page, `${w}?start=1`)
    await expect(toast(page)).toContainText('All seven first steps are done')
    await expect(start).toHaveCount(0)
  } finally {
    await forgetFirstSteps(page, world.id)
  }
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

test('a session being played keeps a paused campaign on the Desk, and starting one carries the campaign on', async ({ page, world }) => {
  const campaign = world.dump.campaigns[0]
  const s1 = world.session(1)
  const w = `/w/${world.slug}`
  await open(page, w)
  const before = await getRecord(page, 'campaigns', campaign.id)
  const beforeS1 = await getRecord(page, 'sessions', s1.id)
  const status = async () => (await getRecord(page, 'campaigns', campaign.id))?.status
  try {
    // Paused while #1 is still being played: it stays in sight until it's wrapped up.
    await patchRecord(page, 'campaigns', campaign.id, { status: 'paused' })
    await patchRecord(page, 'sessions', s1.id, { startedAt: Date.now() })
    await open(page, w)
    await expect(page.locator(`.desk-strip[data-session="${s1.id}"] .primary`)).toHaveAttribute('data-next', 'wrap')
    // Paused with nothing being played, then "Start playing" from the session itself: the campaign is Active again.
    await putBack(page, 'sessions', [[s1.id, beforeS1]])
    await open(page, `${w}/s/${s1.id}?tab=prep`)
    await page.locator('.session-strip').getByRole('button', { name: 'Start playing' }).click()
    await page.getByRole('dialog', { name: /^Start playing #/ }).getByRole('button', { name: 'Start playing' }).click()
    await expect.poll(status).toBe('active')
    // Taking the start back puts the campaign back as it was.
    await toast(page).getByRole('button', { name: 'Not started after all' }).click()
    await expect.poll(status).toBe('paused')
  } finally {
    await putBack(page, 'sessions', [[s1.id, beforeS1]])
    await putBack(page, 'campaigns', [[campaign.id, before]])
  }
})

test('a campaign in Planning turns Active when a session is marked played, and Undo puts it back', async ({ page, world }) => {
  const campaign = world.dump.campaigns[0]
  const s1 = world.session(1)
  const s2 = world.session(2)
  const w = `/w/${world.slug}`
  await open(page, w)
  const before = await getRecord(page, 'campaigns', campaign.id)
  const beforeWorld = await getRecord(page, 'worlds', world.id)
  const beforeS1 = await getRecord(page, 'sessions', s1.id)
  const beforeS2 = await getRecord(page, 'sessions', s2.id)
  const status = async () => (await getRecord(page, 'campaigns', campaign.id))?.status
  try {
    await patchRecord(page, 'campaigns', campaign.id, { status: 'planning' })
    await patchRecord(page, 'sessions', s1.id, { startedAt: Date.now() })
    await open(page, `${w}/s/${s1.id}?end=1`)
    await page.getByRole('button', { name: 'Mark as played' }).first().click()
    await expect(toast(page)).toContainText('#1 marked played')
    await expect.poll(status).toBe('active')
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(status).toBe('planning')
  } finally {
    await putBack(page, 'sessions', [
      [s1.id, beforeS1],
      [s2.id, beforeS2],
    ])
    await putBack(page, 'campaigns', [[campaign.id, before]])
    await putBack(page, 'worlds', [[world.id, beforeWorld]])
  }
})

test('players: a paused campaign has no next session and asks for no dates', async ({ page, world }) => {
  const campaign = world.dump.campaigns[0]
  const w = `/w/${world.slug}`
  await open(page, w)
  const before = await getRecord(page, 'campaigns', campaign.id)
  const soon = new Date(Date.now() + 3 * 86_400_000)
  const at = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}T19:00`
  await setView(page, world, 'player')
  try {
    // Booked and with a date poll open, then paused: players see neither.
    await patchRecord(page, 'campaigns', campaign.id, { status: 'paused', booked: { id: 'test-booked', at }, schedule: [{ id: 'test-date', at }] })
    await open(page, w)
    await expect(page.locator('.room-answers')).toContainText('Not set yet')
    await expect(page.locator('.room-when')).toHaveCount(0)
    // Carried on: the booked date is back.
    await patchRecord(page, 'campaigns', campaign.id, { status: 'active' })
    await open(page, w)
    await expect(page.locator('.room-answers')).toBeVisible()
    await expect(page.locator('.room-answers')).not.toContainText('Not set yet')
  } finally {
    await putBack(page, 'campaigns', [[campaign.id, before]])
    await setView(page, world, 'gm')
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
  // "This month" follows the date: moved on a month, the grid shows the new month (Undo puts both back).
  const beforeWorld = await getRecord(page, 'worlds', world.id)
  try {
    const month = page.locator('.date-month .month-grid-wrap strong').first()
    const was = (await month.innerText()).trim()
    await expect(page.locator('.date-month .month-day.today')).toHaveCount(1)
    await page.getByRole('button', { name: '+1 month' }).click()
    await expect(month).not.toHaveText(was)
    await expect(page.locator('.date-month .month-day.today')).toHaveCount(1)
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(month).toHaveText(was)
  } finally {
    await putBack(page, 'worlds', [[world.id, beforeWorld]])
  }
  // The GM's month has the sessions on their days.
  await open(page, `${w}/date`)
  await expect(page.locator('.date-month .month-item.session').first()).toBeVisible()
  // The old home of the time of day says where it went.
  await open(page, `${w}/clocks`)
  await page.locator('.clocks-moved').getByRole('link', { name: 'Date and time' }).click()
  await expect(page).toHaveURL(new RegExp(`${w}/date$`))

  // A player: the date and weather, no controls, no clock unless shown, and only events they can see.
  const hidden = world.dump.entities.filter((e) => e.type === 'event' && e.visibility === 'gm').map((e) => e.name)
  const hiddenSessions = world.dump.sessions.filter((x) => x.visibility !== 'players').map((x) => x.number)
  const shownSessions = world.dump.sessions.filter((x) => x.visibility === 'players').length
  await setView(page, world, 'player')
  try {
    await open(page, `${w}/date`)
    await expect(page.getByRole('heading', { name: 'Date and time', level: 1 })).toBeVisible()
    await expect(page.locator('.date-today .world-today')).toBeVisible()
    await expect(page.getByRole('button', { name: '+1 day' })).toHaveCount(0)
    await expect(page.locator('.game-clock')).toHaveCount(0)
    // The GM isn't showing the in-game time, so players get no clock at all.
    await expect(page.locator('.game-time-bar')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Set up the calendar' })).toHaveCount(0)
    // Sessions the GM hasn't shown to players aren't on the month either.
    const chips = (await page.locator('.date-month .month-item.session').allInnerTexts()).map((t) => Number(t.replace(/\D/g, '')))
    for (const n of hiddenSessions) expect(chips).not.toContain(n)
    expect(chips.length).toBeLessThanOrEqual(shownSessions)
    const text = await page.locator('main').innerText()
    for (const name of hidden) expect(text).not.toContain(name)
    await expect(page.locator('header.topbar a.world-date')).toHaveAttribute('href', new RegExp(`${w}/date$`))
  } finally {
    await setView(page, world, 'gm')
  }
})
