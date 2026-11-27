import type { Browser, BrowserContext } from '@playwright/test'
import { expect, here, open, setView, test, type Device, type Page } from './fixtures'
import { fakeCloud, putRows, type CloudState } from './lib/cloud'
import { getRecord, patchRecord, putBack, type Row } from './lib/records'
import { PORT } from './lib/server'
import { readDatabase } from './lib/world'

/**
 * The night's flow, on a laptop and a phone:
 *
 * - "Start playing" is one box everywhere, with two ticks ("Go live to players" and "Record") that
 *   are remembered on the device; "Not started after all" takes back the start and the live link.
 * - Every "Wrap up" only opens the checklist; its first step ends the live session and clears
 *   players' screens, with Undo.
 * - What the party is given at the Lectern is in the players' Party loot at once, unless "Keep it
 *   secret" is ticked.
 * - A session has two notes boxes, Plan and What happened; notes from before the change show under
 *   Plan; and What happened never reaches a player.
 *
 * Going live needs players, so those tests make a small world of their own in a fresh browser
 * profile and talk to the pretend cloud (tests/lib/cloud.ts). The rest use the example world and
 * put back what they change. SHOTS_DIR=<folder> saves screenshots.
 */

const toast = (page: Page) => page.locator('.undo-toast')
const startBox = (page: Page) => page.getByRole('dialog', { name: /^Start playing #/ })
const TICKS = 'codex.startPlaying'

async function shot(page: Page, name: string) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` })
}

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

/** A new world made the way a person makes one; gives back its address and its record. */
async function newWorld(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: /New world/ }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create world' }).click()
  await page.waitForURL(/\/w\/[^/]+/)
  const w = here(page)
  const row = (await readDatabase(page)).worlds[0] as unknown as Row
  return { w, row }
}

const campaignRow = (wid: string) => ({ id: 'flow-campaign', worldId: wid, name: 'The Toll Road', description: '', system: '', status: 'active', createdAt: Date.now() })
const sessionRow = (wid: string, more: Record<string, unknown> = {}) => ({
  id: 'flow-s1',
  worldId: wid,
  campaignId: 'flow-campaign',
  number: 1,
  title: 'The Toll Bridge',
  date: '',
  notes: 'The toll keeper lies about the ford.',
  recap: '',
  visibility: 'gm',
  entityIds: [],
  recordings: [],
  createdAt: Date.now(),
  ...more,
})

test.describe('with players (the pretend cloud)', () => {
  test.describe.configure({ timeout: 120_000 })
  let context: BrowserContext
  test.afterEach(async () => context?.close())

  /** A world shared with players, with one session that has a plan (so it is "Preparing"). */
  async function sharedWorld(browser: Browser, device: Device) {
    context = await freshContext(browser, device)
    const state: CloudState = { worldId: '', world_members: [], player_questions: [], downtime_actions: [], character_claims: [], character_requests: [], writes: [] }
    await fakeCloud(context, state)
    const page = await context.newPage()
    const { w, row } = await newWorld(page, 'The Toll Road')
    state.worldId = row.id
    await putRows(page, 'worlds', [{ ...row, cloud: { enabled: true } }])
    await putRows(page, 'campaigns', [campaignRow(row.id)])
    await putRows(page, 'sessions', [sessionRow(row.id)])
    const liveNow = () => page.evaluate((k) => sessionStorage.getItem(k), `codex.liveSession.${row.id}`)
    const session = () => getRecord(page, 'sessions', 'flow-s1')
    const world = () => getRecord(page, 'worlds', row.id)
    return { page, w, wid: row.id, liveNow, session, world }
  }

  test('Start playing: the box’s ticks, live to players, “Not started after all”, and the ticks remembered', async ({ browser, device }) => {
    const { page, w, liveNow, session } = await sharedWorld(browser, device)
    await open(page, `${w}/s/flow-s1?tab=prep`)
    await page.locator('.session-strip').getByRole('button', { name: 'Start playing' }).click()
    const box = startBox(page)
    const live = box.getByRole('checkbox', { name: /Go live to players/ })
    const record = box.getByRole('checkbox', { name: /^Record/ })
    // To begin with: live to players, not recording. Nothing has happened yet.
    await expect(live).toBeChecked()
    await expect(record).not.toBeChecked()
    await expect(box).toContainText('Never your notes')
    await expect(box).toContainText('Nothing is recorded until you’ve asked everyone')
    expect((await session())?.startedAt ?? null).toBeNull()
    expect(await liveNow()).toBeNull()
    await shot(page, `start-box-cloud-${device}`)

    await box.getByRole('button', { name: 'Start playing' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/s/flow-s1/lectern`)
    await expect(toast(page)).toContainText('#1 The Toll Bridge is being played, live to players.')
    await expect.poll(liveNow).toBe('flow-s1')
    await expect(page.locator('.live-badge')).not.toHaveCount(0)
    const started = await session()
    expect(started?.startedAt).toBeTruthy()
    expect(started?.liveAt).toBeTruthy()
    await shot(page, `start-after-cloud-${device}`)

    // The note at the bottom takes back the start and the live link together.
    await toast(page).getByRole('button', { name: 'Not started after all' }).click()
    await expect.poll(async () => (await session())?.startedAt ?? null).toBeNull()
    await expect.poll(liveNow).toBeNull()
    await expect(page.locator('.live-badge')).toHaveCount(0)
    expect((await session())?.liveAt ?? null).toBeNull()

    // Started without going live this time: no live link, and the note doesn't claim one.
    await open(page, w)
    await page.locator('.desk-strip [data-next="play"]').click()
    await startBox(page).getByRole('checkbox', { name: /Go live to players/ }).uncheck()
    await startBox(page).getByRole('button', { name: 'Start playing' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/s/flow-s1/lectern`)
    await expect(toast(page)).toContainText('#1 The Toll Bridge is being played.')
    await expect(toast(page)).not.toContainText('live to players')
    expect(await liveNow()).toBeNull()
    await toast(page).getByRole('button', { name: 'Not started after all' }).click()
    await expect.poll(async () => (await session())?.startedAt ?? null).toBeNull()

    // The ticks are as they were left, on any "Start playing" of this device.
    await open(page, `${w}/s/flow-s1?tab=prep`)
    await page.locator('.session-strip').getByRole('button', { name: 'Start playing' }).click()
    await expect(startBox(page).getByRole('checkbox', { name: /Go live to players/ })).not.toBeChecked()
    await expect(startBox(page).getByRole('checkbox', { name: /^Record/ })).not.toBeChecked()
    expect(await page.evaluate((k) => localStorage.getItem(k), TICKS)).toBe('{"live":false,"record":false}')
    // Cancel changes nothing.
    await startBox(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(startBox(page)).toHaveCount(0)
    expect((await session())?.startedAt ?? null).toBeNull()
  })

  test('every “Wrap up” only opens the checklist; its first step ends the live session and clears players’ screens', async ({ browser, device }) => {
    const { page, w, wid, liveNow, world } = await sharedWorld(browser, device)
    await open(page, `${w}/s/flow-s1?tab=prep`)
    await page.locator('.session-strip').getByRole('button', { name: 'Start playing' }).click()
    await startBox(page).getByRole('button', { name: 'Start playing' }).click()
    await expect.poll(liveNow).toBe('flow-s1')

    // Something is up on players' screens, and the in-game time with it.
    const now = Date.now()
    const row = (await world())!
    const clock = { secs: 3600, at: now, rate: 1, running: false }
    await putRows(page, 'worlds', [
      {
        ...row,
        showing: { id: 'h-flow', kind: 'text', title: 'The pay notice', text: 'No pay today.', at: now },
        gameTime: clock,
        gmScreen: { pages: [], rolls: [], ...((row.gmScreen as object | undefined) ?? {}), gameClock: { ...clock, shown: true } },
      },
    ])
    const untouched = async () => {
      await expect(page.locator('#finish')).toBeVisible()
      await expect(toast(page)).toHaveCount(0)
      expect(await liveNow()).toBe('flow-s1')
      const now = (await getRecord(page, 'worlds', wid))!
      expect((now.showing as { title: string } | null)?.title).toBe('The pay notice')
      expect(now.gameTime).toBeTruthy()
    }

    // The Desk's.
    await open(page, w)
    await page.locator('.desk-strip [data-next="wrap"]').click()
    await expect.poll(() => here(page)).toBe(`${w}/s/flow-s1?end=1`)
    await untouched()

    // The Lectern's (at the foot of the page on a phone).
    await open(page, `${w}/s/flow-s1/lectern`)
    await page.getByRole('button', { name: 'Wrap up' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/s/flow-s1?end=1`)
    await untouched()

    // The Session tab.
    await open(page, `${w}/s/flow-s1?tab=prep`)
    await page.getByRole('navigation', { name: 'Session', exact: true }).getByRole('link', { name: 'Wrap up' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/s/flow-s1?tab=notes`)
    await untouched()

    // The first step says what players still have, and its button ends it all, with Undo.
    const first = page.locator('#finish .end-steps > li').first()
    await expect(first).not.toHaveClass(/done/)
    await expect(first).toContainText('End the live session')
    await expect(first).toContainText('The pay notice and the in-game time')
    await first.scrollIntoViewIfNeeded()
    await shot(page, `wrap-first-step-${device}`)
    await first.getByRole('button', { name: 'End the live session' }).click()
    await expect(toast(page)).toContainText('The live session has ended. Players’ screens are clear.')
    await expect.poll(liveNow).toBeNull()
    await expect.poll(async () => (await world())?.showing ?? null).toBeNull()
    await expect.poll(async () => (await world())?.gameTime ?? null).toBeNull()
    await expect(first).toHaveClass(/done/)
    await expect(first).toContainText('The live session has ended')
    await expect(page.locator('.live-badge')).toHaveCount(0)
    // "Mark as played" is still the last thing, and still to do.
    await expect(page.locator('#finish').getByRole('button', { name: 'Mark as played' })).toBeVisible()
    expect((await getRecord(page, 'sessions', 'flow-s1'))?.playedAt ?? null).toBeNull()
    await shot(page, `wrap-ended-${device}`)

    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(liveNow).toBe('flow-s1')
    await expect.poll(async () => ((await world())?.showing as { title: string } | null)?.title ?? null).toBe('The pay notice')
    await expect.poll(async () => !!(await world())?.gameTime).toBe(true)
    await expect(first).toContainText('End the live session')
  })
})

test('Start playing without players: no “Go live” tick, Record opens the consent note, and a started session shows “Continue”', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, w)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    // The Desk's main button opens the same box; this world isn't shared, and the box says so.
    await page.locator('.desk-strip [data-next="play"]').click()
    const box = startBox(page)
    await expect(box).toContainText('“Go live to players” isn’t offered: this world isn’t shared with players yet')
    await expect(box.getByRole('link', { name: 'Players and sharing' })).toBeVisible()
    await expect(box.getByRole('checkbox')).toHaveCount(1)
    const record = box.getByRole('checkbox', { name: /^Record/ })
    await expect(record).not.toBeChecked()
    await shot(page, `start-box-local-${device}`)

    // Record ticked: the Lectern opens at the recording panel with its "ask everyone" note. Nothing records yet.
    await record.check()
    await box.getByRole('button', { name: 'Start playing' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}/lectern?at=lectern-recording`)
    await expect(toast(page)).toContainText('Ask everyone before you press Start recording.')
    await expect(page.locator('#lectern-recording')).toContainText('Ask everyone at the table before you record')
    await expect(page.locator('#lectern-recording').getByRole('button', { name: /Start recording/ })).toBeVisible()
    await expect(page.locator('.record-chip')).toHaveAttribute('aria-label', 'Record this session')
    const started = await getRecord(page, 'sessions', s1.id)
    expect(started?.startedAt).toBeTruthy()
    expect(started?.recordings).toEqual(before?.recordings)
    await shot(page, `start-record-${device}`)

    // Under way: "Continue" on the Desk, on Prepare and in All sessions, and no box anywhere.
    await open(page, w)
    await expect(page.locator('.desk-strip').getByRole('link', { name: 'Continue', exact: true })).toHaveAttribute('href', new RegExp(`/s/${s1.id}/lectern$`))
    await expect(page.getByRole('button', { name: 'Start playing' })).toHaveCount(0)
    await open(page, `${w}/s/${s1.id}?tab=prep`)
    await page.locator('.session-strip').getByRole('link', { name: 'Continue', exact: true }).click()
    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}/lectern`)
    await expect(startBox(page)).toHaveCount(0)

    // Never live: the checklist's first step isn't this session's business and isn't counted.
    await open(page, `${w}/s/${s1.id}?end=1`)
    const first = page.locator('#finish .end-steps > li').first()
    await expect(first).toContainText('Not live to players this time')
    await expect(first.getByRole('button')).toHaveCount(0)
    await expect(page.locator('.wrap-progress')).not.toContainText('live')

    // Taken back from Session details; the Record tick is as it was left.
    await open(page, `${w}/s/${s1.id}?tab=prep`)
    await page.locator('#details').getByRole('button', { name: 'Not started after all' }).click()
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'preparing')
    await page.locator('.session-strip').getByRole('button', { name: 'Start playing' }).click()
    await expect(startBox(page).getByRole('checkbox', { name: /^Record/ })).toBeChecked()
    await startBox(page).getByRole('button', { name: 'Cancel' }).click()
  } finally {
    await page.evaluate((k) => localStorage.removeItem(k), TICKS)
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('loot given at the Lectern is in the player’s Party loot at once; “Keep it secret” keeps it out', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, w)
  const before = await getRecord(page, 'sessions', s1.id)
  const hidden = world.dump.entities.find((e) => e.visibility === 'gm' && !e.template && /^[A-Za-z]{5,}( [A-Za-z]+)*$/.test(e.name))!
  const made = async (name: string) => (await readDatabase(page)).entities.find((e) => e.name === name) as (Row & { visibility: string; heldBy?: string }) | undefined
  /** What a player reads on Party loot, in a tab of their own. */
  const playerLoot = async () => {
    const player = await page.context().newPage()
    await setView(player, world, 'player')
    await open(player, `${w}/loot`)
    await expect(player.getByRole('heading', { name: /Party loot/ })).toBeVisible()
    // The stash is read a moment after the heading; the locket is in it both times this looks.
    await expect(player.locator('main')).toContainText('Flowtest silver locket')
    const text = await player.locator('main').innerText()
    await shot(player, `loot-player-${device}`)
    await player.close()
    await page.evaluate((key) => localStorage.setItem(key, 'gm'), `viewMode.${world.id}`)
    return text
  }
  try {
    await patchRecord(page, 'sessions', s1.id, { startedAt: Date.now() - 1000 })
    await open(page, `${w}/s/${s1.id}/lectern?at=lectern-loot`)
    const panel = page.locator('#lectern-loot')
    const name = panel.getByLabel('Item the party found')
    const secret = panel.getByRole('checkbox', { name: /Keep it secret/ })
    await expect(secret).not.toBeChecked()
    await panel.scrollIntoViewIfNeeded()
    await shot(page, `loot-panel-${device}`)

    // Given: players can see it straight away, and the note says so.
    await name.fill('Flowtest silver locket')
    await panel.getByRole('button', { name: 'Give to the party' }).click()
    await expect(toast(page)).toContainText('“Flowtest silver locket” given to the party. Players can see it in Party loot now.')
    const locket = (await made('Flowtest silver locket'))!
    expect(locket.visibility).toBe('players')
    expect(locket.heldBy).toBe('party')
    expect(await playerLoot()).toContain('Flowtest silver locket')

    // Its GM notes and GM-only passage stay the GM's, on the item's own page too.
    await patchRecord(page, 'entities', locket.id, { gmNotes: 'ZZGMNOTE cursed', body: 'Flowseen by all.\n\n:::gm\nZZGMBLOCK it whispers\n:::' })
    const player = await page.context().newPage()
    await setView(player, world, 'player')
    await open(player, `${w}/p/${locket.id}`)
    await expect(player.locator('main')).toContainText('Flowseen by all.')
    await expect(player.locator('body')).not.toContainText('ZZGM')
    await player.close()
    await page.evaluate((key) => localStorage.setItem(key, 'gm'), `viewMode.${world.id}`)

    // "Keep it secret" holds that one back, and is unticked again for the next.
    await secret.check()
    await name.fill('Flowtest hidden ring')
    await panel.getByRole('button', { name: 'Give to the party' }).click()
    await expect(toast(page)).toContainText('“Flowtest hidden ring” given to the party, kept secret')
    await expect(secret).not.toBeChecked()
    expect((await made('Flowtest hidden ring'))!.visibility).toBe('gm')
    const loot = await playerLoot()
    expect(loot).toContain('Flowtest silver locket')
    expect(loot).not.toContain('Flowtest hidden ring')

    // Undo takes a gift back.
    await name.fill('Flowtest undone coin')
    await panel.getByRole('button', { name: 'Give to the party' }).click()
    await expect(toast(page)).toContainText('Flowtest undone coin')
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => !!(await made('Flowtest undone coin'))).toBe(false)

    // A name with a GM-only page's name in it is never shown without asking: the safe answer is the main button.
    const risky = `Flowtest key of ${hidden.name}`
    await name.fill(risky)
    await panel.getByRole('button', { name: 'Give to the party' }).click()
    const ask = page.getByRole('dialog', { name: `Give “${risky}” to the party?` })
    await expect(ask).toContainText(hidden.name)
    await expect(ask).toContainText('GM-only page')
    expect(await made(risky)).toBeUndefined()
    await shot(page, `loot-ask-${device}`)
    await ask.getByRole('button', { name: 'Keep it secret' }).click()
    await expect(toast(page)).toContainText('kept secret')
    expect((await made(risky))!.visibility).toBe('gm')
  } finally {
    const mine = (await readDatabase(page)).entities.filter((e) => e.name.startsWith('Flowtest '))
    await putBack(page, 'entities', mine.map((e) => [e.id, null] as [string, null]))
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('two notes boxes: Plan before the game, What happened at the table, and the checklist knows which is which', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, `${w}/s/${s1.id}?tab=prep`)
  const before = (await getRecord(page, 'sessions', s1.id))!
  const plan = String(before.notes)
  expect(plan.trim()).not.toBe('')
  try {
    // Prepare has the Plan, with what was written before the change.
    const planCard = page.locator('#gm-notes')
    await expect(planCard.getByRole('heading', { name: /^Plan/ })).toBeVisible()
    await expect(planCard.locator('.notes-view')).not.toBeEmpty()
    await shot(page, `notes-plan-${device}`)

    // At the table a quick note goes to What happened; the Plan is left as it was.
    await patchRecord(page, 'sessions', s1.id, { startedAt: Date.now() - 1000 })
    await open(page, `${w}/s/${s1.id}?end=1`)
    await expect(page.locator('#finish .end-steps')).toContainText('Write down what happened')
    await open(page, `${w}/s/${s1.id}/lectern?at=lectern-notes`)
    await page.getByLabel('Quick note').fill('Flownote the bridge fell')
    await page.getByLabel('Quick note').press('Enter')
    await expect.poll(async () => String((await getRecord(page, 'sessions', s1.id))?.happened ?? '')).toContain('Flownote the bridge fell')
    expect((await getRecord(page, 'sessions', s1.id))?.notes).toBe(plan)
    const panel = page.locator('#lectern-notes')
    await expect(panel).toContainText('What happened')
    await expect(panel).toContainText('Flownote the bridge fell')
    await expect(panel.locator('.lectern-plan-notes > summary')).toContainText('Plan')

    // Wrap up: What happened on top, the Plan under it, and the checklist counts only what happened.
    await open(page, `${w}/s/${s1.id}?end=1`)
    await expect(page.locator('#notes').getByRole('heading', { name: /^What happened/ })).toBeVisible()
    await expect(page.locator('#notes')).toContainText('Flownote the bridge fell')
    await expect(page.locator('#plan-notes').getByRole('heading', { name: /^Plan/ })).toBeVisible()
    await expect(page.locator('#plan-notes')).not.toContainText('Flownote')
    await expect(page.locator('#finish .end-steps')).toContainText('What happened is written down')
    await shot(page, `notes-wrap-${device}`)
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('“What happened” and the Plan never reach a player: not on the session, in print or in search', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, w)
  const before = (await getRecord(page, 'sessions', s1.id))!
  const search = async (p: Page, query: string) => {
    if (device === 'phone') await p.getByRole('button', { name: 'Search' }).click()
    else await p.keyboard.press('Control+k')
    const dialog = p.getByRole('dialog', { name: 'Search' })
    await dialog.getByRole('textbox').fill(query)
    await p.waitForTimeout(800)
    return dialog
  }
  try {
    // Played and revealed, with a recap for players and both GM boxes filled in.
    await patchRecord(page, 'sessions', s1.id, {
      startedAt: Date.now() - 2000,
      playedAt: Date.now() - 1000,
      visibility: 'players',
      recap: 'Flowrecap the company mustered.',
      happened: 'ZZHAPPENED the ambush at the ford was the reeve’s doing.',
      notes: `${String(before.notes)}\n\nZZPLANNED the reeve is the traitor.`,
    })
    // The GM finds both by searching, so the search below would catch a leak.
    await open(page, w)
    await expect((await search(page, 'ZZHAPPENED')).locator('.search-results')).toContainText(s1.title)
    await page.keyboard.press('Escape')
    await expect((await search(page, 'ZZPLANNED')).locator('.search-results')).toContainText(s1.title)

    const player = await page.context().newPage()
    await setView(player, world, 'player')
    await open(player, `${w}/s/${s1.id}`)
    await expect(player.locator('main')).toContainText('Flowrecap the company mustered.')
    await expect(player.locator('body')).not.toContainText('ZZHAPPENED')
    await expect(player.locator('body')).not.toContainText('ZZPLANNED')
    for (const query of ['ZZHAPPENED', 'ZZPLANNED', 'ambush at the ford']) {
      const dialog = await search(player, query)
      await expect(dialog).not.toContainText(s1.title)
      await expect(dialog).not.toContainText('reeve')
      await player.keyboard.press('Escape')
    }
    // The copy to hand out (print's own “Player copy”).
    await open(player, `${w}/print/s/${s1.id}?copy=players`)
    await expect(player.locator('body')).toContainText('Flowrecap the company mustered.')
    await expect(player.locator('body')).not.toContainText('ZZHAPPENED')
    await expect(player.locator('body')).not.toContainText('ZZPLANNED')
    await player.close()
  } finally {
    await page.evaluate((key) => localStorage.setItem(key, 'gm'), `viewMode.${world.id}`)
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test.describe('a world from before the two notes boxes', () => {
  test.describe.configure({ timeout: 120_000 })
  let context: BrowserContext
  test.afterEach(async () => context?.close())

  test('opens after the upgrade with its old notes under Plan and “What happened” empty', async ({ browser, device }) => {
    context = await freshContext(browser, device)
    const page = await context.newPage()
    const { w, row } = await newWorld(page, 'Old Notes')

    // Leave the app, then rebuild its database as the version before (Dexie 10, which the browser
    // calls 100) with the very same tables, and two sessions as they were kept then: one not played
    // yet, and one started in the old way (its notes at the start kept beside it).
    await page.goto('/terms.html')
    const olds = [
      sessionRow(row.id, { id: 'old-1', number: 1, title: 'Before the change', notes: 'Flowold notes written before the two boxes.' }),
      sessionRow(row.id, {
        id: 'old-2',
        number: 2,
        title: 'Started the old way',
        notes: 'Flowold plan for night two.\n\nFlowold typed at the table.',
        startedAt: Date.now() - 1000,
        playStart: { notes: 'Flowold plan for night two.', entityIds: [] },
      }),
    ]
    const was = await page.evaluate(
      ({ rows, campaign }) =>
        new Promise<number>((resolve, reject) => {
          const NAME = 'ttrpg-campaign-manager'
          type Kept = { name: string; keyPath: string | string[] | null; autoIncrement: boolean; indexes: { name: string; keyPath: string | string[]; unique: boolean; multiEntry: boolean }[]; rows: unknown[]; keys: IDBValidKey[] }
          const read = indexedDB.open(NAME)
          read.onerror = () => reject(read.error)
          read.onsuccess = () => {
            const idb = read.result
            const names = [...idb.objectStoreNames]
            const tx = idb.transaction(names, 'readonly')
            const kept: Kept[] = names.map((name) => {
              const s = tx.objectStore(name)
              const k: Kept = {
                name,
                keyPath: s.keyPath as Kept['keyPath'],
                autoIncrement: s.autoIncrement,
                indexes: [...s.indexNames].map((i) => ({ name: i, keyPath: s.index(i).keyPath as string | string[], unique: s.index(i).unique, multiEntry: s.index(i).multiEntry })),
                rows: [],
                keys: [],
              }
              s.getAll().onsuccess = (e) => (k.rows = (e.target as IDBRequest<unknown[]>).result)
              s.getAllKeys().onsuccess = (e) => (k.keys = (e.target as IDBRequest<IDBValidKey[]>).result)
              return k
            })
            tx.oncomplete = () => {
              idb.close()
              const gone = indexedDB.deleteDatabase(NAME)
              gone.onerror = () => reject(gone.error)
              gone.onsuccess = () => {
                const make = indexedDB.open(NAME, 100)
                make.onerror = () => reject(make.error)
                make.onupgradeneeded = () => {
                  for (const k of kept) {
                    const s = make.result.createObjectStore(k.name, k.keyPath === null ? { autoIncrement: k.autoIncrement } : { keyPath: k.keyPath, autoIncrement: k.autoIncrement })
                    for (const i of k.indexes) s.createIndex(i.name, i.keyPath, { unique: i.unique, multiEntry: i.multiEntry })
                  }
                }
                make.onsuccess = () => {
                  const old = make.result
                  const put = old.transaction(names, 'readwrite')
                  for (const k of kept) k.rows.forEach((r, n) => (k.keyPath === null ? put.objectStore(k.name).put(r, k.keys[n]) : put.objectStore(k.name).put(r)))
                  put.objectStore('campaigns').put(campaign)
                  for (const r of rows) put.objectStore('sessions').put(r)
                  put.oncomplete = () => {
                    const v = old.version
                    old.close()
                    resolve(v)
                  }
                  put.onerror = () => reject(put.error)
                }
              }
            }
          }
        }),
      { rows: olds, campaign: campaignRow(row.id) },
    )
    expect(was).toBe(100)

    // The app opens it and brings it up to date; nothing is moved or lost.
    await open(page, `${w}/s/old-1?tab=prep`)
    const version = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const req = indexedDB.open('ttrpg-campaign-manager')
          req.onsuccess = () => {
            const v = req.result.version
            req.result.close()
            resolve(v)
          }
        }),
    )
    expect(version).toBeGreaterThanOrEqual(110)
    const kept = await getRecord(page, 'sessions', 'old-1')
    expect(kept?.notes).toBe('Flowold notes written before the two boxes.')
    expect(kept?.happened ?? '').toBe('')
    await expect(page.locator('#gm-notes').getByRole('heading', { name: /^Plan/ })).toBeVisible()
    await expect(page.locator('#gm-notes')).toContainText('Flowold notes written before the two boxes.')

    await open(page, `${w}/s/old-1?tab=notes`)
    await expect(page.locator('#notes').getByRole('heading', { name: /^What happened/ })).toBeVisible()
    await expect(page.locator('#notes').getByRole('textbox', { name: 'What happened' })).toHaveValue('')
    await expect(page.locator('#notes')).not.toContainText('Flowold')
    await expect(page.locator('#plan-notes')).toContainText('Flowold notes written before the two boxes.')
    await shot(page, `notes-old-${device}`)

    // A session started before the change: what was typed after the start still counts as what happened.
    await open(page, `${w}/s/old-2?end=1`)
    await expect(page.locator('#finish .end-steps')).toContainText('What happened is written down')
    expect((await getRecord(page, 'sessions', 'old-2'))?.notes).toBe('Flowold plan for night two.\n\nFlowold typed at the table.')
  })
})
