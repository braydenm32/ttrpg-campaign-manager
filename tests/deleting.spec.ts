import type { Browser } from '@playwright/test'
import { expect, go, here, open, test, type Device, type Page } from './fixtures'
import { fakeCloud, putRows, type CloudState } from './lib/cloud'
import { getRecord, putBack, type Row } from './lib/records'
import { PORT } from './lib/server'

/**
 * Deleting (the owner's answer to question 13): a map pin goes at once to Recently deleted, with
 * Undo; a session, campaign, map or file asks first in the app's own dialog (what goes with it, with
 * real counts, what is kept, and that Recently deleted keeps it for a month; Cancel has the focus
 * and leaves everything), then goes with an Undo note; a whole world and its cloud copy, which
 * nothing can bring back, ask in the same dialog with the world's name typed before the delete
 * button works (quote marks, dashes, spaces and capitals don't have to match, and a world with no
 * name asks for the word "delete"). No browser "OK / Cancel" box comes up on any of these: each
 * test fails if one does. Each test puts back what it changed.
 */

const toast = (page: Page) => page.locator('.undo-toast')

/** Fails the test if the browser's own confirm, alert or prompt comes up. */
function noBrowserBoxes(page: Page) {
  const boxes: string[] = []
  page.on('dialog', (d) => {
    boxes.push(d.message())
    void d.dismiss()
  })
  return () => expect(boxes, 'a browser dialog came up').toEqual([])
}

/** Every bin item (Recently deleted) whose label has `text` in it. */
async function binItems(page: Page, text: string) {
  return page.evaluate(
    (text) =>
      new Promise<Row[]>((resolve) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onsuccess = () => {
          const get = req.result.transaction('bin').objectStore('bin').getAll()
          get.onsuccess = () => {
            req.result.close()
            resolve((get.result as Row[]).filter((b) => String(b.label).includes(text)))
          }
        }
      }),
    text,
  )
}

const forgetBin = async (page: Page, text: string) => putBack(page, 'bin', (await binItems(page, text)).map((b) => [b.id, null]))

test('a map pin: Undo puts it back, and so does Recently deleted, on the same spot', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const map = world.map('The Glass Barrow')
  const pin: Row = { id: 'deleting-test-pin', worldId: world.id, mapId: map.id, label: 'Deleting Test Cairn', kind: 'point', position: [40, 60], color: '#c33', visibility: 'gm', note: 'A note kept with it' }
  const ok = noBrowserBoxes(page)
  await open(page, `${w}/maps/${map.id}`)
  await putBack(page, 'pins', [[pin.id, pin]])
  try {
    const remove = async () => {
      await open(page, `${w}/maps/${map.id}?pin=${pin.id}`)
      const panel = page.locator('.map-panel')
      // A pin opened from its address always shows its page first, with the editor one press further.
      // (Waiting for the button, not peeking at it: on a busy machine the panel can come after the map.)
      await panel.getByRole('button', { name: 'Edit pin' }).click()
      await panel.locator('.pin-editor').getByRole('button', { name: 'Delete' }).click()
      await expect(toast(page)).toContainText('Pin “Deleting Test Cairn” deleted. It’s in More → Recently deleted.')
      expect(await getRecord(page, 'pins', pin.id)).toBeUndefined()
    }
    await remove()
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => getRecord(page, 'pins', pin.id)).toEqual(pin)
    expect(await binItems(page, 'Deleting Test Cairn')).toEqual([])

    await remove()
    await go(page, `${w}/settings?tab=data&at=deleted`)
    const row = page.locator('li', { hasText: 'Deleting Test Cairn' })
    await expect(row).toContainText('on the map “The Glass Barrow”')
    await row.getByRole('button', { name: 'Restore' }).click()
    await expect.poll(() => getRecord(page, 'pins', pin.id)).toEqual(pin)
    await expect(row).toHaveCount(0)
    ok()
  } finally {
    await putBack(page, 'pins', [[pin.id, null]])
    await forgetBin(page, 'Deleting Test Cairn')
  }
})

test('a map asks first, then goes with Undo, and comes back with its pins', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const real = (await (async () => {
    await open(page, `${w}/maps`)
    return getRecord(page, 'maps', world.map('The Glass Barrow').id)
  })())!
  // A copy sharing the picture (so the picture stays), without the players' copy or fog of its own.
  const map: Row = { ...real, id: 'deleting-test-map', name: 'Deleting Test Map', playerImageId: undefined, fog: undefined, locationId: undefined, numbers: undefined }
  const pin: Row = { id: 'deleting-test-map-pin', worldId: world.id, mapId: map.id, label: 'On the test map', kind: 'point', position: [10, 10], color: '#c33', visibility: 'gm', note: '' }
  const ok = noBrowserBoxes(page)
  await putBack(page, 'maps', [[map.id, map]])
  await putBack(page, 'pins', [[pin.id, pin]])
  try {
    await open(page, `${w}/maps/${map.id}`)
    await page.getByRole('button', { name: 'Map settings' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete the map “Deleting Test Map”?' })
    // It says what goes, with counts, and that it can come back; Cancel has the focus and leaves everything.
    await page.getByRole('button', { name: 'Delete map' }).click()
    await expect(dialog).toContainText('The map (its picture stays, as something else uses it)')
    await expect(dialog).toContainText('1 pin')
    await expect(dialog).toContainText('It goes to Recently deleted (under More) for a month.')
    await expect(dialog.getByRole('textbox')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    expect(await getRecord(page, 'maps', map.id)).toBeTruthy()
    expect(await getRecord(page, 'pins', pin.id)).toEqual(pin)
    await page.getByRole('button', { name: 'Delete map' }).click()
    await dialog.getByRole('button', { name: 'Delete map' }).click()
    await expect(toast(page)).toContainText('Map “Deleting Test Map” deleted, with its pin. It’s in More → Recently deleted.')
    await expect.poll(() => here(page)).toMatch(/\/maps$/)
    expect(await getRecord(page, 'maps', map.id)).toBeUndefined()
    expect(await getRecord(page, 'pins', pin.id)).toBeUndefined()
    // The shared picture stays: the real map still has it.
    expect(await getRecord(page, 'assets', String(real.imageId))).toBeTruthy()
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await getRecord(page, 'maps', map.id))?.name).toBe('Deleting Test Map')
    await expect.poll(() => getRecord(page, 'pins', pin.id)).toEqual(pin)
    ok()
  } finally {
    await putBack(page, 'pins', [[pin.id, null]])
    await putBack(page, 'maps', [[map.id, null]])
    await forgetBin(page, 'Deleting Test Map')
  }
})

test('a session and a campaign ask first, then go with Undo, which brings back the sessions and their notes', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  await open(page, w)
  const realCampaign = (await getRecord(page, 'campaigns', world.dump.campaigns[0].id))!
  const realSession = (await getRecord(page, 'sessions', world.session(1).id))!
  const campaign: Row = { ...realCampaign, id: 'deleting-test-campaign', name: 'Deleting Test Campaign' }
  const session: Row = { ...realSession, id: 'deleting-test-session', campaignId: campaign.id, number: 1, title: 'Deleting Test Session', notes: 'Notes kept with it', recordings: [] }
  const ok = noBrowserBoxes(page)
  await putBack(page, 'campaigns', [[campaign.id, campaign]])
  await putBack(page, 'sessions', [[session.id, session]])
  try {
    await open(page, `${w}/s/${session.id}?tab=prep`)
    const sessionDialog = page.getByRole('dialog', { name: 'Delete session #1 “Deleting Test Session”?' })
    await page.getByRole('button', { name: 'Delete session' }).click()
    await expect(sessionDialog).toContainText('Its prep, your notes, the recap and the highlights')
    await expect(sessionDialog).toContainText('The campaign “Deleting Test Campaign” and its other sessions')
    await expect(sessionDialog).toContainText('It goes to Recently deleted (under More) for a month.')
    // No transcript is being made, so nothing is said about stopping one.
    await expect(sessionDialog).not.toContainText('transcript')
    await expect(sessionDialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(sessionDialog).toHaveCount(0)
    expect(await getRecord(page, 'sessions', session.id)).toBeTruthy()
    await page.getByRole('button', { name: 'Delete session' }).click()
    await sessionDialog.getByRole('button', { name: 'Delete session' }).click()
    await expect(toast(page)).toContainText('Session #1 “Deleting Test Session” deleted. It’s in More → Recently deleted.')
    expect(await getRecord(page, 'sessions', session.id)).toBeUndefined()
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await getRecord(page, 'sessions', session.id))?.notes).toBe('Notes kept with it')

    await open(page, `${w}/c/${campaign.id}`)
    await page.getByText('Campaign settings').click()
    const campaignDialog = page.getByRole('dialog', { name: 'Delete the campaign “Deleting Test Campaign”?' })
    await page.getByRole('button', { name: 'Delete campaign' }).click()
    await expect(campaignDialog).toContainText('1 session, with its prep, notes and recaps')
    await expect(campaignDialog).toContainText('Every page, map and file of the world')
    await expect(campaignDialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await campaignDialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(campaignDialog).toHaveCount(0)
    expect(await getRecord(page, 'campaigns', campaign.id)).toBeTruthy()
    expect(await getRecord(page, 'sessions', session.id)).toBeTruthy()
    await page.getByRole('button', { name: 'Delete campaign' }).click()
    await campaignDialog.getByRole('button', { name: 'Delete campaign' }).click()
    await expect(toast(page)).toContainText('Campaign “Deleting Test Campaign” deleted, with its session. The world’s pages, maps and files are kept.')
    expect(await getRecord(page, 'campaigns', campaign.id)).toBeUndefined()
    expect(await getRecord(page, 'sessions', session.id)).toBeUndefined()
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await getRecord(page, 'campaigns', campaign.id))?.name).toBe('Deleting Test Campaign')
    await expect.poll(async () => (await getRecord(page, 'sessions', session.id))?.notes).toBe('Notes kept with it')
    ok()
  } finally {
    await putBack(page, 'sessions', [[session.id, null]])
    await putBack(page, 'campaigns', [[campaign.id, null]])
    await forgetBin(page, 'Deleting Test')
  }
})

test('a file asks first, then goes with Undo, and comes back', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const ok = noBrowserBoxes(page)
  await open(page, `${w}/assets`)
  // A tiny picture, uploaded as the GM would.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'deleting-test.png', mimeType: 'image/png', buffer: png })
  const card = page.locator('.asset-card', { has: page.getByRole('button', { name: 'Delete deleting-test.png' }) })
  await expect(card).toBeVisible()
  try {
    const dialog = page.getByRole('dialog', { name: 'Delete the file “deleting-test.png”?' })
    await card.getByRole('button', { name: 'Delete deleting-test.png' }).click()
    await expect(dialog).toContainText('nothing in this world uses this file')
    await expect(dialog).toContainText('It goes to Recently deleted (under More) for a month.')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Delete deleting-test.png' }).click()
    await dialog.getByRole('button', { name: 'Delete file' }).click()
    await expect(toast(page)).toContainText('“deleting-test.png” deleted. It’s in More → Recently deleted.')
    await expect(card).toHaveCount(0)
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(card).toBeVisible()
    ok()
  } finally {
    const ids = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const req = indexedDB.open('ttrpg-campaign-manager')
          req.onsuccess = () => {
            const get = req.result.transaction('assets').objectStore('assets').getAll()
            get.onsuccess = () => {
              req.result.close()
              resolve((get.result as { id: string; name: string }[]).filter((a) => a.name === 'deleting-test.png').map((a) => a.id))
            }
          }
        }),
    )
    await putBack(page, 'assets', ids.map((id) => [id, null]))
    await forgetBin(page, 'deleting-test.png')
  }
})

test('deleting a world asks in the app’s dialog: Cancel and Escape keep it, its name must be typed, then it’s all gone', async ({ page, world }) => {
  test.setTimeout(90_000)
  await open(page, `/w/${world.slug}`)
  const real = (await getRecord(page, 'worlds', world.id))!
  const id = 'deleting-test-world'
  const copy: Row = { ...real, id, name: 'Deleting Test World', example: undefined, cloud: undefined, slug: undefined }
  const pageRow: Row = { ...(await getRecord(page, 'entities', world.page('Gerda Hollin').id))!, id: 'deleting-test-world-page', worldId: id, name: 'A page in it' }
  const campaign: Row = { ...(await getRecord(page, 'campaigns', world.dump.campaigns[0].id))!, id: 'deleting-test-world-campaign', worldId: id }
  const session: Row = { ...(await getRecord(page, 'sessions', world.session(1).id))!, id: 'deleting-test-world-session', worldId: id, campaignId: campaign.id, recordings: [] }
  const ok = noBrowserBoxes(page)
  await putBack(page, 'worlds', [[id, copy]])
  await putBack(page, 'entities', [[pageRow.id, pageRow]])
  await putBack(page, 'campaigns', [[campaign.id, campaign]])
  await putBack(page, 'sessions', [[session.id, session]])
  try {
    await open(page, `/w/${id}/settings?tab=data`)
    const button = page.getByRole('button', { name: 'Delete this world' })
    const dialog = page.getByRole('dialog', { name: 'Delete the world “Deleting Test World”?' })

    // It says what goes, with counts, and that nothing brings it back but a backup; the focus starts on Cancel.
    await button.click()
    await expect(dialog).toContainText('1 page')
    await expect(dialog).not.toContainText('map')
    await expect(dialog).toContainText('1 campaign and 1 session with their notes and recaps')
    await expect(dialog).toContainText('This can’t be undone')
    await expect(dialog.getByRole('button', { name: 'Download a backup first' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await button.click()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    expect(await getRecord(page, 'worlds', id)).toBeTruthy()

    // The button waits for the name (spaces and capitals don't matter).
    await button.click()
    const del = dialog.getByRole('button', { name: 'Delete world' })
    await expect(del).toBeDisabled()
    await dialog.getByRole('textbox').fill('Deleting Test')
    await expect(del).toBeDisabled()
    await dialog.getByRole('textbox').fill('deleting test world ')
    await del.click()
    await expect.poll(() => here(page)).toBe('/')
    for (const [table, row] of [['worlds', copy], ['entities', pageRow], ['campaigns', campaign], ['sessions', session]] as const)
      expect(await getRecord(page, table, row.id), `${table} left behind`).toBeUndefined()
    ok()
  } finally {
    await putBack(page, 'sessions', [[session.id, null]])
    await putBack(page, 'campaigns', [[campaign.id, null]])
    await putBack(page, 'entities', [[pageRow.id, null]])
    await putBack(page, 'worlds', [[id, null]])
  }
})

test('the name to type: curly or straight quotes and dashes both do, and a world with no name asks for the word “delete”', async ({ page, world }) => {
  test.setTimeout(90_000)
  await open(page, `/w/${world.slug}`)
  const real = (await getRecord(page, 'worlds', world.id))!
  const id = 'deleting-test-names'
  // As a phone would have typed it: a curly apostrophe, curly quotes and a long dash.
  const copy: Row = { ...real, id, name: 'Brayden’s “Test” World — two', example: undefined, cloud: undefined, slug: undefined }
  const ok = noBrowserBoxes(page)
  await putBack(page, 'worlds', [[id, copy]])
  try {
    await open(page, `/w/${id}/settings?tab=data`)
    const button = page.getByRole('button', { name: 'Delete this world' })
    const dialog = page.getByRole('dialog', { name: 'Delete the world “Brayden’s “Test” World — two”?' })
    await button.click()
    const del = dialog.getByRole('button', { name: 'Delete world' })
    await expect(del).toBeDisabled()
    // As a laptop types it: straight marks and a hyphen.
    await dialog.getByRole('textbox').fill(`brayden's "test" world - two`)
    await expect(del).toBeEnabled()
    await dialog.getByRole('textbox').fill(`brayden's "test" world - tw`)
    await expect(del).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(await getRecord(page, 'worlds', id)).toBeTruthy()

    // No name at all (only spaces): the button doesn't open by itself, it waits for the word "delete".
    await putBack(page, 'worlds', [[id, { ...copy, name: '  ' }]])
    await open(page, `/w/${id}/settings?tab=data`)
    const unnamed = page.getByRole('dialog', { name: 'Delete this unnamed world?' })
    await button.click()
    await expect(unnamed).toContainText('This world has no name. To delete it, type the word: delete')
    const delUnnamed = unnamed.getByRole('button', { name: 'Delete world' })
    await expect(delUnnamed).toBeDisabled()
    await unnamed.getByRole('textbox').fill('Delete')
    await delUnnamed.click()
    await expect.poll(() => here(page)).toBe('/')
    expect(await getRecord(page, 'worlds', id)).toBeUndefined()
    ok()
  } finally {
    await putBack(page, 'worlds', [[id, null]])
  }
})

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

test('deleting the cloud copy asks in the app’s dialog, says who loses what, and needs the name (a pretend cloud)', async ({ browser, device }) => {
  test.setTimeout(120_000)
  const context = await freshContext(browser, device)
  try {
    const state: CloudState = {
      worldId: '',
      world_members: [],
      player_questions: [],
      downtime_actions: [],
      character_claims: [],
      character_requests: [],
      writes: [],
      links: { share_token: 'wiki-token', invite_token: 'invite-token' },
      gm_invites: [],
    }
    await fakeCloud(context, state)
    const page = await context.newPage()
    const ok = noBrowserBoxes(page)
    await page.goto('/')
    await page.getByRole('button', { name: /New world/ }).click()
    await page.getByLabel('Name').fill('The Lantern Road')
    await page.getByRole('button', { name: 'Create world' }).click()
    await page.waitForURL(/\/w\/[^/]+/)
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
    state.worldId = worldRow.id as string
    state.world_members.push(
      { world_id: state.worldId, user_id: 'p1', display_name: 'Ash', role: 'player', created_at: '2026-01-01T00:00:00Z' },
      { world_id: state.worldId, user_id: 'p2', display_name: 'Bryn', role: 'player', created_at: '2026-01-01T00:00:00Z' },
    )
    await putRows(page, 'worlds', [{ ...worldRow, cloud: { enabled: true } }])
    const w = here(page).split('?')[0]
    await open(page, `${w}/settings?tab=players`)
    await expect(page.getByText('Sync is on.')).toBeVisible()

    const dialog = page.getByRole('dialog', { name: 'Delete the cloud copy of “The Lantern Road”?' })
    await page.getByRole('button', { name: 'Delete cloud copy' }).click()
    await expect(dialog).toContainText('Everyone who joined (2 players) is taken out of the world')
    await expect(dialog).toContainText('The players’ notes, group notes, questions')
    await expect(dialog).toContainText('This device’s copy of the world')
    await expect(dialog).toContainText('This can’t be undone')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    expect(state.writes.filter((x) => x === 'DELETE cloud_worlds')).toEqual([])

    // Deleting the world itself from here would take the cloud copy too, and says so.
    await open(page, `${w}/settings?tab=data`)
    await page.getByRole('button', { name: 'Delete this world' }).click()
    const worldDialog = page.getByRole('dialog', { name: 'Delete the world “The Lantern Road”?' })
    await expect(worldDialog).toContainText('Deleted from the cloud')
    await expect(worldDialog).toContainText('Everyone who joined (2 players)')
    await page.keyboard.press('Escape')
    await expect(worldDialog).toHaveCount(0)

    // With the name typed, the cloud copy goes.
    await open(page, `${w}/settings?tab=players`)
    await page.getByRole('button', { name: 'Delete cloud copy' }).click()
    await expect(dialog.getByRole('button', { name: 'Delete cloud copy' })).toBeDisabled()
    await dialog.getByRole('textbox').fill('The Lantern Road')
    await dialog.getByRole('button', { name: 'Delete cloud copy' }).click()
    await expect.poll(() => state.writes.filter((x) => x === 'DELETE cloud_worlds')).toHaveLength(1)
    ok()
  } finally {
    await context.close()
  }
})
