import { expect, here, open, test } from './fixtures'
import { fakeCloud, putRows, type CloudState } from './lib/cloud'
import { PORT } from './lib/server'
import { getRecord, patchRecord, putBack, type Row } from './lib/records'

/**
 * One-shot mode, on a laptop: World settings makes the world a one-shot (its starting point is saved
 * on the device), the game changes things (a page, a page made in play, what's on players' screens,
 * a session played with a recap), and the Desk's "Reset for the next table" lists the changed pages,
 * keeps the one ticked as a fix, puts everything else back, writes the run on the GM-only "Past
 * runs" page and leaves what it replaced in Recently deleted. Puts back what it changed.
 */

const NEW_PAGE = 'test-one-shot-new-page'

/** `SHOTS_DIR=<folder>` saves screenshots of the one-shot screens. */
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` })
}

/** Deletes the records of a table whose fields match all of `match`. */
function deleteWhere(page: import('@playwright/test').Page, table: string, match: Record<string, string>) {
  return page.evaluate(
    ({ table, match }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(table, 'readwrite')
          const cursor = tx.objectStore(table).openCursor()
          cursor.onsuccess = () => {
            const c = cursor.result
            if (!c) return
            if (Object.entries(match).every(([k, v]) => (c.value as Record<string, unknown>)[k] === v)) c.delete()
            c.continue()
          }
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { table, match },
  )
}

test('a one-shot world resets for the next table, keeping a ticked fix and a record of the run', async ({ page, world, pageErrors }) => {
  test.setTimeout(180_000)
  const npc = world.page('Dannic Rook')
  const fixed = world.page(world.dump.entities.find((e) => e.type === 'location' && e.id !== npc.id)!.name)
  const session = world.session(1)
  await open(page, `/w/${world.slug}/settings?at=oneshot`)
  const worldBefore = await getRecord(page, 'worlds', world.id)
  const npcBefore = await getRecord(page, 'entities', npc.id)
  const fixedBefore = await getRecord(page, 'entities', fixed.id)
  const sessionBefore = await getRecord(page, 'sessions', session.id)
  let logId: string | undefined
  try {
    const section = page.locator('#settings-oneshot')
    await section.getByRole('button', { name: 'Make this a one-shot' }).click()
    await expect(section).toContainText('Starting point saved on this device', { timeout: 60_000 })
    await expect.poll(async () => !!(await getRecord(page, 'startingPoints', world.id)), { timeout: 60_000 }).toBe(true)
    await section.scrollIntoViewIfNeeded()
    await shot(page, 'oneshot-settings')

    // The game: a death, a fix to a place, a page made in play, a handout up, session 1 played.
    await patchRecord(page, 'entities', npc.id, { status: 'dead', body: `${npcBefore!.body}\n\nDied at the table.` })
    await patchRecord(page, 'entities', fixed.id, { summary: 'A typo fixed during play' })
    const made: Row = { ...npcBefore!, id: NEW_PAGE, name: 'Improvised Innkeeper', body: 'Made up on the spot.', visibility: 'players' }
    await putBack(page, 'entities', [[NEW_PAGE, made]])
    await patchRecord(page, 'worlds', world.id, { showing: { id: 'x', kind: 'text', title: 'A note', text: 'Shown to players', at: Date.now() } })
    await patchRecord(page, 'sessions', session.id, { startedAt: Date.now() - 3_600_000, playedAt: Date.now(), recap: 'The party sang the warding song at the gate.' })

    await open(page, `/w/${world.slug}`)
    const card = page.locator('.one-shot-desk')
    await expect(card).toBeVisible()
    await card.scrollIntoViewIfNeeded()
    await shot(page, 'oneshot-desk')
    await card.getByRole('button', { name: 'Reset for the next table' }).click()
    const dialog = page.getByRole('dialog', { name: 'Reset for the next table' })
    await expect(dialog).toContainText('pages changed since then', { timeout: 30_000 })
    await expect(dialog).toContainText('Dannic Rook')
    await expect(dialog).toContainText('Improvised Innkeeper')
    await expect(dialog).toContainText('1 session')
    await dialog.locator('li', { hasText: fixed.name }).getByRole('checkbox').check()
    await shot(page, 'oneshot-dialog')
    await dialog.getByRole('button', { name: 'Reset now' }).click()
    await expect(page.getByText(/Reset for the next table\. Run 1 is on the Past runs page\./)).toBeVisible({ timeout: 30_000 })

    // Back to the start: the death, the page made in play, the handout and the session.
    const npcAfter = (await getRecord(page, 'entities', npc.id))!
    expect(npcAfter.status ?? null).toBe(npcBefore!.status ?? null)
    expect(npcAfter.body).toBe(npcBefore!.body)
    expect(await getRecord(page, 'entities', NEW_PAGE)).toBeUndefined()
    const worldAfter = (await getRecord(page, 'worlds', world.id))!
    expect(worldAfter.showing ?? null).toBeNull()
    const sessionAfter = (await getRecord(page, 'sessions', session.id))!
    expect(sessionAfter.recap).toBe(sessionBefore!.recap)
    expect(sessionAfter.playedAt ?? null).toBe(sessionBefore!.playedAt ?? null)
    // The ticked fix stays, and is part of the starting point now.
    expect((await getRecord(page, 'entities', fixed.id))!.summary).toBe('A typo fixed during play')
    const sp = (await getRecord(page, 'startingPoints', world.id))! as unknown as { entities: Row[] }
    expect(sp.entities.find((e) => e.id === fixed.id)!.summary).toBe('A typo fixed during play')

    // The record of the run, GM only.
    const oneShot = (worldAfter.gmScreen as { oneShot?: { on: boolean; runs: number; logId: string } }).oneShot!
    expect(oneShot).toMatchObject({ on: true, runs: 1 })
    logId = oneShot.logId
    const log = (await getRecord(page, 'entities', logId))!
    expect(log.visibility).toBe('gm')
    expect(log.body).toContain('## Run 1')
    expect(log.body).toContain('The party sang the warding song at the gate.')

    // Undoable: the page made in play is in Recently deleted, the rest in one bin item.
    await open(page, `/w/${world.slug}/settings?tab=data&at=deleted`)
    await expect(page.locator('#settings-deleted')).toContainText('replaced by the one-shot reset')
    await expect(page.locator('#settings-deleted')).toContainText('Improvised Innkeeper')
    expect(pageErrors).toEqual([])
  } finally {
    await putBack(page, 'worlds', [[world.id, worldBefore]])
    await putBack(page, 'entities', [
      [npc.id, npcBefore],
      [fixed.id, fixedBefore],
      [NEW_PAGE, null],
      ...(logId ? ([[logId, null]] as [string, null][]) : []),
    ])
    await putBack(page, 'sessions', [[session.id, sessionBefore]])
    await putBack(page, 'startingPoints', [[world.id, null]])
    await deleteWhere(page, 'bin', { kind: 'reset', worldId: world.id })
    await deleteWhere(page, 'history', { entityId: NEW_PAGE })
  }
})

test('with players online, the reset removes the players, frees their characters and clears their group notes, keeping co-GMs (a pretend cloud)', async ({ browser }) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({ baseURL: `http://localhost:${PORT}`, serviceWorkers: 'block', viewport: { width: 1366, height: 860 } })
  await context.route((url) => url.host !== `localhost:${PORT}` && !url.host.endsWith('supabase.co'), (route) => route.abort())
  try {
    const state: CloudState = { worldId: '', world_members: [], player_questions: [], downtime_actions: [], character_claims: [], character_requests: [], writes: [] }
    await fakeCloud(context, state)
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: /New world/ }).click()
    await page.getByLabel('Name').fill('The Lantern Road')
    await page.getByRole('button', { name: 'Create world' }).click()
    await page.waitForURL(/\/w\/[^/]+/)
    const w = here(page).split('?')[0]
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
    const wid = (state.worldId = worldRow.id as string)
    await putRows(page, 'worlds', [{ ...worldRow, cloud: { enabled: true } }])
    const now = Date.now()
    const pc = { id: 'test-pregen', worldId: wid, type: 'pc', name: 'Nell Carter', summary: '', body: '', gmNotes: '', visibility: 'players', tags: [], fields: [], createdAt: now, updatedAt: now }
    await putRows(page, 'entities', [pc])
    state.world_members.push(
      { world_id: wid, user_id: 'player-1', display_name: 'Sam', role: 'player', created_at: '2026-11-20T00:00:00Z' },
      { world_id: wid, user_id: 'co-gm-1', display_name: 'Riley', role: 'gm', created_at: '2026-11-20T00:00:00Z' },
    )
    state.character_claims.push({ world_id: wid, entity_id: pc.id, user_id: 'player-1', player_notes: '', approved: true })
    state.player_questions.push({ world_id: wid, id: 'q1', entity_id: '', body: 'Can we rest?', created_at: '2026-11-20T00:00:00Z' })

    await open(page, `${w}/settings?at=oneshot`)
    await page.locator('#settings-oneshot').getByRole('button', { name: 'Make this a one-shot' }).click()
    await expect(page.locator('#settings-oneshot')).toContainText('Starting point saved on this device')
    await page.locator('#settings-oneshot').getByRole('button', { name: 'Reset for the next table' }).click()
    const dialog = page.getByRole('dialog', { name: 'Reset for the next table' })
    await expect(dialog).toContainText('Remove the player who joined (Sam)')
    await expect(dialog).not.toContainText('Riley')
    await dialog.getByRole('button', { name: 'Reset now' }).click()
    // The pretend cloud has no clear_group_notes answer beyond "done", so nothing is reported missing.
    await expect(page.getByText(/^Reset for the next table\. Run 1 is on the Past runs page\.$/)).toBeVisible({ timeout: 30_000 })

    expect(state.world_members.map((m) => m.display_name)).toEqual(['Riley'])
    expect(state.character_claims).toEqual([])
    expect(state.player_questions).toEqual([])
    expect(state.writes).toContain('RPC clear_group_notes')
    // The record says who played whom.
    const log = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const req = indexedDB.open('ttrpg-campaign-manager')
          req.onsuccess = () => {
            const get = req.result.transaction('entities').objectStore('entities').getAll()
            get.onsuccess = () => resolve((get.result as { name: string; body: string }[]).find((e) => e.name === 'Past runs')?.body ?? '')
          }
        }),
    )
    expect(log).toContain('Nell Carter (Sam)')
  } finally {
    await context.close()
  }
})
