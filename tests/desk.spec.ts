import type { Browser, BrowserContext } from '@playwright/test'
import { expect, here, open, test, type Device, type Page } from './fixtures'
import { fakeCloud, putRows, type CloudState } from './lib/cloud'
import { getRecord, patchRecord, putBack } from './lib/records'
import { PORT } from './lib/server'

/**
 * The GM's Desk (Today and Inbox) and the worlds shelf, on a laptop and a phone: the strip's main
 * button matches the stage of the session in hand; "Needs you" lists the Inbox's items with the
 * same number as the badges; the Inbox answers in place, with Undo on what reaches a player; the
 * pictures-and-maps note is a small chip in the top bar; and the shelf has one New world button.
 *
 * The Inbox needs players, so one test makes a small world of its own in a fresh browser profile
 * and talks to a pretend cloud (tests/lib/cloud.ts). SHOTS_DIR=<folder> saves screenshots of it.
 */

const strip = (page: Page) => page.locator('.desk-strip')
const needs = (page: Page) => page.locator('.needs-you')
const toast = (page: Page) => page.locator('.undo-toast')

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

async function shot(page: Page, name: string) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true })
}

test('the strip’s main button follows the stage of the session in hand', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const before = await (async () => {
    await open(page, w)
    return getRecord(page, 'sessions', s1.id)
  })()
  try {
    // The example's first session has a plan: Preparing, and the main button starts playing.
    await expect(strip(page).locator('[data-stage]')).toHaveAttribute('data-stage', 'preparing')
    await expect(strip(page).locator('.primary')).toHaveAttribute('data-next', 'play')
    await expect(strip(page).locator('.primary')).toContainText('Start playing')
    await expect(strip(page).getByRole('link', { name: 'Continue prep' })).toBeVisible()

    // Started at the table: Playing, and the main button wraps it up.
    await patchRecord(page, 'sessions', s1.id, { startedAt: Date.now() })
    await open(page, w)
    await expect(strip(page).locator('[data-stage]')).toHaveAttribute('data-stage', 'playing')
    await expect(strip(page).locator('.primary')).toHaveAttribute('data-next', 'wrap')
    await strip(page).locator('.primary').click()
    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}?end=1`)

    // Nothing written yet: Planned, and the main button starts the prep; "Needs you" says so too.
    await putBack(page, 'sessions', [[s1.id, { ...before!, notes: '', prep: undefined, startedAt: undefined }]])
    await open(page, w)
    await expect(strip(page).locator('[data-stage]')).toHaveAttribute('data-stage', 'planned')
    await expect(strip(page).locator('.primary')).toHaveAttribute('data-next', 'prep')
    await expect(needs(page)).toContainText('Nothing planned for #1 yet')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('Needs you: one action each, the same count as the badge, and a date set in place', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, w)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    const section = needs(page)
    await expect(section.getByRole('heading', { name: /Needs you before #1/ })).toBeVisible()
    // Without players nothing comes from them: no inbox lines and no badge, and it says why.
    await expect(section).toHaveAttribute('data-inbox-total', '0')
    await expect(section.locator('[data-inbox-item]')).toHaveCount(0)
    await expect(page.locator('.areas .area .count, .bottom-bar i')).toHaveCount(0)
    await expect(section).toContainText('Nobody invited yet')
    // Pressing threads are listed here, and only here on the Desk.
    const pressing = world.dump.entities.filter((e) => {
      const t = e as typeof e & { threadUrgency?: string; threadStatus?: string }
      return t.type === 'thread' && t.threadUrgency === 'high' && ['open', 'active'].includes(t.threadStatus ?? 'open')
    })
    for (const t of pressing) await expect(section.getByText(t.name)).toHaveCount(1)
    for (const row of await section.locator('.need').all()) expect(await row.locator('.need-action').count()).toBeLessThanOrEqual(1)

    // "No date" gets one in place, with Undo.
    await section.getByRole('button', { name: 'Set a date' }).click()
    const day = new Date(Date.now() + 7 * 86_400_000)
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    await section.getByLabel('Date of #1').fill(iso)
    await expect(toast(page)).toContainText('#1 is on')
    await expect(section).not.toContainText('has no date yet')
    await expect(strip(page)).not.toContainText('no date set')
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(section).toContainText('has no date yet')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('the Desk is short, keeps the date in one fold, and every old card has a home', async ({ page, world, device }) => {
  await open(page, `/w/${world.slug}`)
  // The date's buttons are folded under the date, not spread across the cover.
  await expect(page.locator('.world-cover .world-today-fold')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '+1 day' })).toBeHidden()
  await page.locator('.world-cover .world-today-fold > summary').click()
  await expect(page.getByRole('button', { name: '+1 day' })).toBeVisible()
  // The old Dashboard's cards: the numbers lead to the threads, quests and sessions; Campaign is in Coming up.
  for (const name of [/open threads?/, /open quests?/, /sessions? to play/, /pages?$/, /maps?$/]) await expect(page.locator('.desk-statline').getByRole('link', { name })).toBeVisible()
  await expect(page.locator('.coming-up').getByRole('button', { name: 'Campaign' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New page' })).toBeVisible()
  if (device === 'laptop') expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(1500)
})

test('the shelf has one New world button, and your worlds apart from the examples', async ({ page }) => {
  await open(page, '/')
  await expect(page.getByRole('button', { name: /New world/ })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: /Your worlds/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Examples to explore' })).toBeVisible()
  // The example the tests opened sits with the examples, not with your own worlds.
  await expect(page.locator('.shelf.examples').getByRole('button', { name: /Vael Ardith/ })).toBeVisible()
  await expect(page.locator('.shelf:not(.examples)').getByRole('button', { name: /Vael Ardith/ })).toHaveCount(0)
  // What the app does is still there underneath.
  await expect(page.getByRole('heading', { name: 'What the Warded Atlas does' })).toBeVisible()
})

test('pictures still arriving show as a small chip in the top bar', async ({ browser, device }) => {
  test.setTimeout(120_000)
  const context = await freshContext(browser, device)
  try {
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: /Vael Ardith/ }).first().click()
    await page.waitForURL(/\/w\/[^/]+/, { timeout: 90_000 })
    const chip = page.locator('.topbar .loading-chip')
    await expect(chip).toBeVisible({ timeout: 30_000 })
    const box = (await chip.boundingBox())!
    expect(box.height).toBeLessThanOrEqual(48)
    expect(box.width).toBeLessThan(device === 'phone' ? 60 : 260)
    // The long note is gone from the page itself; pressing the chip says it in full.
    await expect(page.locator('main .player-banner', { hasText: 'maps and pictures' })).toHaveCount(0)
    await chip.getByRole('button').click()
    await expect(chip.locator('.loading-chip-note')).toContainText('Look around meanwhile')
  } finally {
    await context.close()
  }
})

test.describe('with players (a pretend cloud)', () => {
  test.describe.configure({ timeout: 120_000 })
  let context: BrowserContext
  test.afterEach(async () => context?.close())

  test('Needs you, the badges and the Inbox agree; answers happen in place, with Undo', async ({ browser, device }) => {
    context = await freshContext(browser, device)
    const state: CloudState = { worldId: '', world_members: [], player_questions: [], downtime_actions: [], character_claims: [], character_requests: [], writes: [] }
    await fakeCloud(context, state)
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: /New world/ }).click()
    await page.getByLabel('Name').fill('The Lantern Road')
    await page.getByRole('button', { name: 'Create world' }).click()
    await page.waitForURL(/\/w\/[^/]+/)

    // A world with sync on, one player character, two players and one of each thing they can send.
    const worldRow = await page.evaluate(
      () =>
        new Promise<Record<string, unknown>>((resolve) => {
          const req = indexedDB.open('ttrpg-campaign-manager')
          req.onsuccess = () => {
            const get = req.result.transaction('worlds').objectStore('worlds').getAll()
            get.onsuccess = () => resolve(get.result[0])
          }
        }),
    )
    const wid = worldRow.id as string
    state.worldId = wid
    const now = Date.now()
    const pc = { id: 'pc-varra', worldId: wid, type: 'pc', name: 'Varra Nine-Knuckles', summary: '', body: '', gmNotes: '', visibility: 'players', tags: [], fields: [{ key: 'AC', value: '16' }, { key: 'HP', value: '12' }], createdAt: now, updatedAt: now }
    await putRows(page, 'entities', [pc])
    await putRows(page, 'worlds', [{ ...worldRow, cloud: { enabled: true } }])
    const sam = '00000000-0000-4000-8000-000000000001'
    const alex = '00000000-0000-4000-8000-000000000002'
    state.world_members.push(
      { world_id: wid, user_id: sam, display_name: 'Sam', role: 'player', created_at: '2026-10-01T10:00:00Z' },
      { world_id: wid, user_id: alex, display_name: 'Alex', role: 'player', created_at: '2026-10-01T10:00:00Z' },
    )
    state.player_questions.push({ id: 'q1', world_id: wid, entity_id: '', user_id: sam, body: 'Can my character read the old temple script?', answer: null, answered_at: null, created_at: '2026-10-20T19:00:00Z' })
    state.downtime_actions.push({ id: 'd1', world_id: wid, user_id: alex, character: 'Varra', body: 'Varra spends the week at the forge, mending her shield.', answer: null, answered_at: null, created_at: '2026-10-21T19:00:00Z' })
    state.character_claims.push({ world_id: wid, entity_id: pc.id, user_id: alex, player_notes: '', approved: false, claimed_at: '2026-10-22T19:00:00Z' })
    state.character_requests.push({ id: 'r1', world_id: wid, user_id: sam, sheet: { name: 'Ilka Fen', summary: 'A river guide who owes the wrong people', fields: [], playerBody: '' }, status: 'pending', gm_note: '', created_at: '2026-10-23T19:00:00Z' })

    const w = here(page)
    await open(page, w)
    const badge = device === 'phone' ? page.locator('.bottom-bar a', { hasText: 'Desk' }).locator('i') : page.locator('.areas .area', { hasText: 'Desk' }).locator('.count')
    const tabCount = page.locator('.area-tabs a', { hasText: 'Inbox' }).locator('.count')
    await expect(badge).toHaveText('4')
    await expect(tabCount).toHaveText('4')
    await expect(needs(page)).toHaveAttribute('data-inbox-total', '4')
    await expect(needs(page).locator('[data-inbox-item]')).toHaveCount(4)
    // Listed on the Desk already, so no banner on top of it.
    await expect(page.locator('.claim-requests')).toHaveCount(0)
    await shot(page, `today-with-players-${device}`)

    // The Inbox: the same four, oldest first, each answered in place.
    await page.locator('.area-tabs a', { hasText: 'Inbox' }).click()
    const items = page.locator('.inbox-list .inbox-item')
    await expect(items).toHaveCount(4)
    expect(await items.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))).toEqual(['question', 'downtime', 'claim', 'character'])
    await shot(page, `inbox-with-players-${device}`)

    await items.first().getByRole('textbox').fill('A little: enough to know it’s a warning.')
    await items.first().getByRole('button', { name: 'Send answer' }).click()
    await expect(items).toHaveCount(3)
    expect(state.writes).toContain('PATCH player_questions')
    await expect(tabCount).toHaveText('3')
    await expect(badge).toHaveText('3')
    await expect(page.locator('.inbox-answered > summary')).toHaveText('Answered (1)')

    // Turning down a claim waits out its Undo: nothing reaches the server until the note goes.
    const claim = page.locator('.inbox-item[data-kind="claim"]')
    await claim.getByRole('button', { name: 'Decline' }).click()
    await expect(claim).toHaveCount(0)
    await expect(tabCount).toHaveText('2')
    await expect(toast(page)).toContainText('Turned down Alex’s request to play Varra Nine-Knuckles')
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(claim).toHaveCount(1)
    await expect(tabCount).toHaveText('3')
    expect(state.writes).not.toContain('RPC release_character')

    // Deleting downtime: gone at once, and on the server once the note is closed.
    await page.locator('.inbox-item[data-kind="downtime"]').getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('.inbox-item[data-kind="downtime"]')).toHaveCount(0)
    await toast(page).getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => state.writes).toContain('DELETE downtime_actions')
    await expect(tabCount).toHaveText('2')

    // Approve from the Desk itself, the same count everywhere after.
    await page.locator(device === 'phone' ? '.bottom-bar' : '.areas').getByRole('link', { name: /Desk/ }).click()
    await needs(page).getByRole('button', { name: 'Approve' }).click()
    await expect(toast(page)).toContainText('Alex now plays Varra Nine-Knuckles')
    await toast(page).getByRole('button', { name: 'Close' }).click()
    await expect.poll(() => state.writes).toContain('PATCH character_claims')
    await expect(needs(page).locator('[data-inbox-item]')).toHaveCount(1)
    await expect(badge).toHaveText('1')
    await expect(tabCount).toHaveText('1')
  })

  test('without players the Inbox explains what arrives there', async ({ browser, device }) => {
    context = await freshContext(browser, device)
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: /New world/ }).click()
    await page.getByLabel('Name').fill('Quiet World')
    await page.getByRole('button', { name: 'Create world' }).click()
    await page.waitForURL(/\/w\/[^/]+/)
    await open(page, `${here(page)}/questions`)
    const empty = page.locator('.inbox-empty')
    await expect(empty).toContainText('Your players write to you here')
    await expect(empty).toContainText('turn on cloud sync')
    await expect(empty.getByRole('link', { name: 'Players and sharing' })).toBeVisible()
    await shot(page, `inbox-empty-${device}`)
    // A brand-new world gets first steps on Today, which can be put away.
    await page.locator('.area-tabs a', { hasText: 'Today' }).click()
    const start = page.locator('.getting-started')
    await expect(start).toBeVisible()
    await shot(page, `today-new-world-${device}`)
    await start.getByRole('button', { name: 'Hide' }).click()
    await expect(start).toHaveCount(0)
  })
})
