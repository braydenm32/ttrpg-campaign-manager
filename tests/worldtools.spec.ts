import { expect, here, open, test, type Page } from './fixtures'
import { getRecord, putBack } from './lib/records'
import type { World } from './lib/world'

/**
 * Tools for building the world, on a laptop: finding a page by typing (a relationship's "Who?" and
 * the editor's "Inside"), search by words in any order with each page's type, Quests grouped by
 * where they stand, a map pin's page peek, shop stock with prices, and a map's numbered key, pin
 * categories and saved versions. Each test puts back what it changed (straight in the database),
 * since tests in one worker share the world.
 */

const toast = (page: Page) => page.locator('.undo-toast')

test('a relationship’s “Who?” and the editor’s “Inside” find a page by typing', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const gerda = world.page('Gerda Hollin')
  await open(page, `${w}/p/${world.pageSlug('Gerda Hollin')}`)
  const before = await getRecord(page, 'entities', gerda.id)
  try {
    const add = page.getByRole('button', { name: 'Add a relationship' })
    if (await add.count()) await add.click()
    else await page.locator('.relations').getByRole('button', { name: '+ Link' }).click()
    const who = page.getByRole('combobox', { name: 'Who' })
    await who.click()
    // An empty box offers pages straight away (the ones changed most recently first), never all of them at once.
    expect(await page.locator('.page-picker-list li button').count()).toBeLessThanOrEqual(13)
    await who.fill('fennick bott')
    await page.locator('.page-picker-list button', { hasText: 'Fennick Bottlebrook' }).click()
    await expect(who).toHaveValue('Fennick Bottlebrook')
    await page.locator('.add-relation').getByRole('button', { name: 'Add' }).click()
    await expect(page.locator('.relations')).toContainText('Fennick Bottlebrook')
  } finally {
    await putBack(page, 'entities', [[gerda.id, before]])
  }

  // The editor's "Inside" for a place.
  const ford = world.page('The Ford')
  await open(page, `${w}/p/${world.pageSlug('The Ford')}?edit=1`)
  const inside = page.getByRole('combobox', { name: 'Inside' })
  await expect(inside).toBeVisible()
  await inside.click()
  await inside.fill('cinderf')
  await expect(page.locator('.page-picker-list button', { hasText: 'Cinderford' }).first()).toBeVisible()
  await inside.press('Escape')
  expect(await getRecord(page, 'entities', ford.id)).toBeTruthy()
  await expect.poll(() => here(page)).toContain('/p/')
})

test('Quests are grouped Active, Open, Done', async ({ page, world }) => {
  await open(page, `/w/${world.slug}/quests`)
  const groups = page.locator('.quest-group > h2')
  const titles = (await groups.allTextContents()).map((t) => t.split(' ')[0])
  expect(titles.length).toBeGreaterThan(0)
  const order = ['Active', 'Open', 'Done']
  expect(titles).toEqual(order.filter((o) => titles.includes(o)))
  for (const q of world.dump.entities.filter((e) => e.type === 'quest' && !e.template && (e as { questStatus?: string }).questStatus === 'active'))
    await expect(page.getByRole('region', { name: 'Active quests' })).toContainText(q.name)
})

test('search finds every word in any order, and says what kind of page each result is', async ({ page, world }) => {
  await open(page, `/w/${world.slug}`)
  await page.keyboard.press('Control+k')
  const box = page.getByRole('dialog', { name: 'Search' }).getByRole('textbox')
  await box.fill('mercy fort')
  const hit = page.locator('.search-results li', { has: page.locator('strong', { hasText: /^\s*Fort Mercy\s*$/ }) }).first()
  await expect(hit).toBeVisible()
  await expect(hit.locator('.hit-kind')).toHaveText('Location')
  // Words that aren't all on one page find nothing.
  await box.fill('mercy zzqx')
  await expect(page.locator('.search-results')).toContainText('Nothing matches')
})

/** The Glass Barrow (a drawn dungeon) and a pin of it that's linked to a page players can see. */
function barrowPin(world: World) {
  const map = world.map('The Glass Barrow')
  const pins = world.dump.pins.filter((p) => p.mapId === map.id)
  return { map, pins, pin: pins.find((p) => p.visibility === 'players' && (p as { entityId?: string }).entityId) ?? pins[0] }
}

/** Every row of a table that matches, read straight from the database. */
function rowsOf<T>(page: Page, table: string, match: (row: T) => boolean) {
  return page
    .evaluate(async (table) => {
      const req = indexedDB.open('ttrpg-campaign-manager')
      const idb: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)))
      const all: unknown[] = await new Promise((r) => {
        const g = idb.transaction(table).objectStore(table).getAll()
        g.onsuccess = () => r(g.result)
      })
      idb.close()
      return all
    }, table)
    .then((all) => (all as T[]).filter(match))
}

test('a map pin opens on its page peek for the GM, with Edit pin a tap further', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const { map, pin } = barrowPin(world)
  await open(page, `${w}/maps/${map.id}?pin=${pin.id}`)
  const panel = page.locator('.map-panel')
  await expect(panel.getByRole('link', { name: 'Open page' })).toBeVisible()
  await expect(panel.locator('.pin-editor')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Edit pin' }).click()
  await expect(panel.locator('.pin-editor')).toBeVisible()
  await expect(panel.getByRole('link', { name: /^Open “/ })).toBeVisible()
  await panel.getByRole('button', { name: 'Done' }).click()
  await expect(panel.getByRole('button', { name: 'Edit pin' })).toBeVisible()
})

test('pin categories: a legend above the map filters the pins, and the address remembers it', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const { map, pins } = barrowPin(world)
  await open(page, `${w}/maps/${map.id}`)
  const before = await Promise.all(pins.slice(0, 2).map((p) => getRecord(page, 'pins', p.id)))
  try {
    await putBack(page, 'pins', [
      [pins[0].id, { ...before[0]!, category: 'Danger' }],
      [pins[1].id, { ...before[1]!, category: 'Treasure' }],
    ])
    await open(page, `${w}/maps/${map.id}`)
    const legend = page.getByRole('navigation', { name: 'Show pins of these kinds' })
    await expect(legend.getByRole('button', { name: /Danger/ })).toBeVisible()
    const all = await page.locator('.map-pin').count()
    await legend.getByRole('button', { name: /Danger/ }).click()
    await expect.poll(() => here(page)).toContain('only=Danger')
    await expect(page.locator('.map-pin')).toHaveCount(1)
    await page.reload()
    await expect(page.locator('.map-pin')).toHaveCount(1)
    await legend.getByRole('button', { name: 'All' }).click()
    await expect(page.locator('.map-pin')).toHaveCount(all)
  } finally {
    await putBack(page, 'pins', [
      [pins[0].id, before[0]],
      [pins[1].id, before[1]],
    ])
  }
})

test('Show numbers: pins get numbers and a key, and the players’ copy leaves out GM-only pins', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const { map, pins } = barrowPin(world)
  await open(page, `${w}/maps/${map.id}`)
  const mapBefore = await getRecord(page, 'maps', map.id)
  const pinsBefore = await Promise.all(pins.map((p) => getRecord(page, 'pins', p.id)))
  const secret = pins[pins.length - 1]
  try {
    // The example's barrow is GM only: show it (and all its pins but one) to players for this test.
    await putBack(page, 'maps', [[map.id, { ...mapBefore!, visibility: 'players' }]])
    await putBack(
      page,
      'pins',
      pins.map((p, i) => [p.id, { ...pinsBefore[i]!, visibility: p.id === secret.id ? 'gm' : 'players' }]),
    )
    await open(page, `${w}/maps/${map.id}`)
    await page.getByRole('button', { name: /Map settings/ }).click()
    // The box follows the saved map, a moment after the click.
    await page.getByLabel(/Show numbers/).click()
    await expect(page.getByLabel(/Show numbers/)).toBeChecked()
    await page.locator('.map-panel').getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'Key' }).click()
    await expect(page.locator('.map-key-list li')).toHaveCount(pins.length)
    await expect(page.locator('.map-pin .pin-no').first()).toBeVisible()
    // The players' copy on paper: the GM-only pin is not in the key.
    await open(page, `${w}/print/m/${map.id}?copy=players`)
    await expect(page.locator('.print-map-key li')).toHaveCount(pins.length - 1)
    await expect(page.locator('.print-map-key')).not.toContainText(secret.label)
  } finally {
    await putBack(page, 'maps', [[map.id, mapBefore]])
    await putBack(
      page,
      'pins',
      pins.map((p, i) => [p.id, pinsBefore[i]]),
    )
  }
})

test('“Pin on a map…” from a page places a pin for it where you click', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const gerda = world.page('Gerda Hollin')
  const { map } = barrowPin(world)
  await open(page, `${w}/p/${world.pageSlug('Gerda Hollin')}`)
  const more = page.locator('.page-more-toggle')
  if (await more.isVisible()) await more.click()
  await page.getByRole('button', { name: 'Pin on a map…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /The Glass Barrow/ }).click()
  await expect.poll(() => here(page)).toContain(`place=${gerda.id}`)
  await expect(page.getByText('Click the map where “Gerda Hollin” is.')).toBeVisible()
  const box = (await page.locator('.leaflet-container').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(toast(page)).toContainText('Gerda Hollin')
  const made = await rowsOf<{ id: string; mapId: string; label: string; entityId?: string }>(page, 'pins', (p) => p.mapId === map.id && p.label === 'Gerda Hollin')
  expect(made).toHaveLength(1)
  expect(made[0].entityId).toBe(gerda.id)
  await putBack(page, 'pins', [[made[0].id, null]])
})

test('a scene can name a pin, and the pin offers to start it', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const { map, pin } = barrowPin(world)
  await open(page, w)
  // Every session gets the scene, so whichever is in hand has it.
  const befores = await Promise.all(world.dump.sessions.map((s) => getRecord(page, 'sessions', s.id)))
  try {
    await putBack(
      page,
      'sessions',
      befores.map((b) => {
        const prep = (b!.prep as { scenes?: unknown[] } | undefined) ?? { strongStart: '', scenes: [], clues: [], encounters: [] }
        return [b!.id, { ...b!, prep: { ...prep, scenes: [...(prep.scenes ?? []), { id: `test-scene-${b!.id}`, text: 'Ambush in the culvert', done: false, pinId: pin.id }] } }]
      }),
    )
    await open(page, `${w}/maps/${map.id}?pin=${pin.id}`)
    const scene = page.locator('.pin-scene')
    await expect(scene).toContainText('Ambush in the culvert')
    await expect(scene.getByRole('button', { name: 'Start' })).toBeVisible()
  } finally {
    await putBack(
      page,
      'sessions',
      befores.map((b) => [b!.id, b]),
    )
  }
})

test('saved map versions: name one, and restore it', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const { map } = barrowPin(world)
  await open(page, `${w}/maps/${map.id}/draw`)
  try {
    await page.getByRole('button', { name: /Versions/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Saved versions' })
    await dialog.getByLabel('Name this version').fill('Before the test')
    await dialog.getByRole('button', { name: 'Name this version' }).click()
    await expect(dialog.locator('.map-version-list li')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Restore' }).click()
    await expect(toast(page)).toContainText('Restored')
    // Restoring kept the drawing as it was, too.
    await page.getByRole('button', { name: /Versions/ }).click()
    await expect(dialog.locator('.map-version-list li')).toHaveCount(2)
  } finally {
    const kept = await rowsOf<{ id: string; mapId: string }>(page, 'mapVersions', (v) => v.mapId === map.id)
    await putBack(
      page,
      'mapVersions',
      kept.map((v) => [v.id, null]),
    )
  }
})

test('a shop’s Stock lists its items with prices, and “Sold to the party” moves one and takes the coin (Undo puts both back)', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const shop = world.page("Harrow's Simples")
  const item = world.page('The Cut Oil Tin')
  await open(page, w)
  const itemBefore = await getRecord(page, 'entities', item.id)
  const worldBefore = await getRecord(page, 'worlds', world.id)
  try {
    await putBack(page, 'entities', [[item.id, { ...itemBefore!, heldBy: shop.id, fields: [...(itemBefore!.fields as unknown[]), { key: 'Price', value: '5 copper' }] }]])
    await open(page, `${w}/p/${world.pageSlug(shop.name)}`)
    const stock = page.locator('.stock')
    await expect(stock.getByRole('heading', { name: /Stock/ })).toBeVisible()
    await expect(stock.getByRole('link', { name: 'The Cut Oil Tin' })).toBeVisible()
    await expect(stock.getByLabel('Price of The Cut Oil Tin')).toHaveValue('5 copper')
    await stock.getByRole('button', { name: 'Sold to the party' }).click()
    await expect(toast(page)).toContainText('sold to the party for 5 copper')
    await expect.poll(async () => (await getRecord(page, 'entities', item.id))?.heldBy).toBe('party')
    const purse = async () => ((await getRecord(page, 'worlds', world.id))?.partyCoin as { name: string; amount: number }[]).find((c) => /copper/i.test(c.name))?.amount
    await expect.poll(purse).toBe(9)
    await toast(page).locator('.undo-button').click()
    await expect.poll(async () => (await getRecord(page, 'entities', item.id))?.heldBy).toBe(shop.id)
    await expect.poll(purse).toBe(14)
  } finally {
    await putBack(page, 'entities', [[item.id, itemBefore]])
    await putBack(page, 'worlds', [[world.id, worldBefore]])
  }
})

test('Files: the example’s pictures have real names, each file says what uses it, and “Not used anywhere” filters', async ({ page, world }) => {
  await open(page, `/w/${world.slug}/assets`)
  const names = await page.getByLabel('File name').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
  expect(names.length).toBeGreaterThan(0)
  expect(names.filter((n) => /^[a-z]+:[a-z0-9-]+$/.test(n))).toEqual([])
  await expect(page.locator('.asset-card').first()).toContainText(/Used by|Not used anywhere/)
  const all = await page.locator('.asset-card').count()
  await page.getByLabel(/Not used anywhere/).check()
  expect(await page.locator('.asset-card').count()).toBeLessThan(all)
})

test('the relationship web opens showing all of it, and Fit changes nothing', async ({ page, world }) => {
  await open(page, `/w/${world.slug}/web`)
  const graph = page.locator('svg.web-graph').first()
  await expect(graph).toBeVisible()
  const opened = await graph.getAttribute('viewBox')
  await page.getByRole('button', { name: 'Fit' }).click()
  expect(await graph.getAttribute('viewBox')).toBe(opened)
  // Names stay at least about 11 px tall on screen.
  const tall = await graph.locator('.web-node text').first().evaluate((el) => el.getBoundingClientRect().height)
  expect(tall).toBeGreaterThan(10)
})

test('on a phone, the timeline’s place filter shows “Everywhere” in full', async ({ page, world }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, `/w/${world.slug}/timeline`)
  const where = page.getByLabel('Where')
  await expect(where).toBeVisible()
  const fits = await where.evaluate((el) => {
    const s = el as HTMLSelectElement
    const probe = document.createElement('span')
    probe.style.font = getComputedStyle(s).font
    probe.textContent = 'Everywhere'
    document.body.append(probe)
    const need = probe.getBoundingClientRect().width
    probe.remove()
    return s.clientWidth >= need
  })
  expect(fits).toBe(true)
})

test('World settings say how much room the app takes on this device', async ({ page, world }) => {
  await open(page, `/w/${world.slug}/settings?tab=device`)
  await expect(page.locator('.device-storage')).toContainText(/This device:/)
  await open(page, `/w/${world.slug}/settings?tab=data`)
  await expect(page.locator('.device-storage')).toContainText(/This device:/)
})
