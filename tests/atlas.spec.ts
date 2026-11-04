import { expect, here, open, setView, test, type Page } from './fixtures'
import { getRecord, putBack } from './lib/records'

/**
 * The Atlas and Story screens, on a laptop and a phone: a page says in one control who can see it,
 * reveals only after a short review and hides with Undo; the breadcrumb starts at the list (never
 * the world's name) and folds on a phone; players get none of the GM's bits of a page; map pins
 * carry their names and, on a phone, open in a sheet over the map; Threads keeps its search when
 * you come Back, and Timeline keeps List or Month in the address; a page's picture can be one
 * already in the world ("Use an existing image").
 *
 * Each test puts back what it changed (straight in the database), since tests in one worker share
 * the world.
 */

const toast = (page: Page) => page.locator('.undo-toast')

test('a page’s visibility control says who can see it, reveals after a review, and Undo hides it again', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const secret = world.dump.entities.find(
    (e) => e.type === 'npc' && e.visibility === 'gm' && !e.template && e.gmNotes.trim() && !(e as { revealedTo?: string[] }).revealedTo?.length,
  )!
  await open(page, `${w}/p/${world.pageSlugs.get(secret.id)}`)
  const before = await getRecord(page, 'entities', secret.id)
  try {
    const control = page.locator('.page-strip .vis-control')
    await expect(control).toHaveClass(/\bgm\b/)
    await expect(control).toContainText('GM only')

    // Revealing shows what players would get, and what stays with the GM, before anything changes.
    await control.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(`Reveal “${secret.name}” to players?`)
    await expect(dialog).toContainText('Players will see')
    await expect(dialog).toContainText('GM notes')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(control).toContainText('GM only')
    expect((await getRecord(page, 'entities', secret.id))?.visibility).toBe('gm')

    await control.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reveal to players' }).click()
    await expect(control).toContainText('Players can see this')
    await expect(control).toHaveClass(/\bplayers\b/)
    await expect(toast(page)).toContainText('revealed to players')
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(control).toContainText('GM only')
    await expect.poll(async () => (await getRecord(page, 'entities', secret.id))?.visibility).toBe('gm')

    // Hiding a page players can see asks once, then offers Undo.
    await control.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reveal to players' }).click()
    await expect(control).toContainText('Players can see this')
    await control.click()
    await expect(page.getByRole('dialog')).toContainText(`Make “${secret.name}” GM only again?`)
    await page.getByRole('dialog').getByRole('button', { name: 'Make it GM only' }).click()
    await expect(control).toContainText('GM only')
    await expect(toast(page)).toContainText('is GM only again')
    await expect.poll(async () => (await getRecord(page, 'entities', secret.id))?.visibility).toBe('gm')
  } finally {
    await putBack(page, 'entities', [[secret.id, before]])
  }
})

test('hiding a page also revealed to a player by name says they keep it, and can hide it from them too', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const secret = world.dump.entities.find(
    (e) => e.type === 'npc' && e.visibility === 'gm' && !e.template && !(e as { revealedTo?: string[] }).revealedTo?.length,
  )!
  await open(page, w)
  const before = await getRecord(page, 'entities', secret.id)
  await putBack(page, 'entities', [[secret.id, { ...before!, visibility: 'players', revealedTo: ['test-player'] }]])
  try {
    await open(page, `${w}/p/${world.pageSlugs.get(secret.id)}`)
    const control = page.locator('.page-strip .vis-control')
    await expect(control).toContainText('Players can see this')

    // The default keeps it with the player it was revealed to, and says so.
    await control.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(`Hide “${secret.name}” from players?`)
    await expect(dialog).toContainText('1 player can still see it')
    await dialog.getByRole('button', { name: 'Hide from everyone else' }).click()
    await expect(control).toContainText('Revealed to 1 player')
    await expect(toast(page)).toContainText('1 player can still see it')
    await expect.poll(async () => (await getRecord(page, 'entities', secret.id))?.revealedTo).toEqual(['test-player'])
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(control).toContainText('Players can see this')

    // "Hide from … too" clears it for them as well, and Undo gives it back to them.
    await control.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Hide from 1 player too' }).click()
    await expect(control).toContainText('GM only')
    await expect(toast(page)).toContainText('is GM only again')
    await expect.poll(async () => (await getRecord(page, 'entities', secret.id))?.revealedTo ?? null).toBe(null)
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(control).toContainText('Players can see this')
    await expect.poll(async () => (await getRecord(page, 'entities', secret.id))?.revealedTo).toEqual(['test-player'])
  } finally {
    await putBack(page, 'entities', [[secret.id, before]])
  }
})

test('the breadcrumb starts at the list, not the world, and folds the middle on a phone', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  // The Lantern Keep sits in Lantern Hill, in Cinderford, and further out still.
  await open(page, `${w}/p/${world.pageSlug('The Lantern Keep')}`)
  const crumbs = page.getByRole('navigation', { name: 'Where this page sits' })
  await expect(crumbs.getByRole('link').first()).toHaveText('Locations')
  await expect(crumbs.getByRole('link', { name: 'Lantern Hill' })).toBeVisible()
  await expect(crumbs).not.toContainText(world.world.name + ' ›')
  if (device === 'phone') {
    await expect(crumbs.getByRole('link', { name: 'Cinderford' })).toBeHidden()
    await expect(crumbs.locator('.crumb-dots')).toBeVisible()
    expect(await crumbs.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true)
  } else {
    await expect(crumbs.getByRole('link', { name: 'Cinderford' })).toBeVisible()
  }
})

test('players see a page without the GM’s control, notes, edit date or Edit button', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const shared = world.playerPages.find((e) => e.type === 'npc' && e.gmNotes.trim())!
  await setView(page, world, 'player')
  await open(page, `${w}/p/${world.pageSlugs.get(shared.id)}`)
  await expect(page.getByRole('heading', { name: shared.name, level: 1 })).toBeVisible()
  await expect(page.locator('.vis-control')).toHaveCount(0)
  await expect(page.locator('#page-gm-notes')).toHaveCount(0)
  await expect(page.locator('.seen-mark')).toHaveCount(0)
  await expect(page.locator('.page-strip')).not.toContainText('Edited')
  await expect(page.locator('.page-strip').getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(page.locator('.page-strip').getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(shared.gmNotes.trim().split('\n')[0].slice(0, 60))
})

test('map pins carry their names, and on a phone a pin opens in a sheet over the map', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  await open(page, `${w}/maps/${world.map('Cinderford').id}`)
  const names = page.locator('.leaflet-tooltip.pin-name')
  await expect(names.first()).toBeVisible()
  const toggle = page.getByRole('button', { name: 'Names' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  // Only where the party is keeps its name.
  await expect(page.locator('.leaflet-tooltip.pin-name:not(.here)')).toHaveCount(0)
  await toggle.click()
  await expect(names.first()).toBeVisible()

  if (device === 'phone') {
    const map = await page.locator('.leaflet-container').boundingBox()
    // The map starts near the top of the screen, not below a stack of buttons.
    expect(map!.y).toBeLessThan(260)
    // The pin in view nearest the middle of the map, tapped.
    const pin = await page.locator('.map-pin').evaluateAll((els) => {
      const mid = { x: innerWidth / 2, y: innerHeight / 2 }
      const boxes = els.map((el) => el.getBoundingClientRect()).filter((r) => r.left > 60 && r.right < innerWidth - 10 && r.top > 300 && r.bottom < innerHeight - 120)
      boxes.sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y))
      return boxes[0] && { x: boxes[0].x + boxes[0].width / 2, y: boxes[0].y + boxes[0].height / 2 }
    })
    expect(pin).toBeTruthy()
    await page.mouse.click(pin!.x, pin!.y)
    const sheet = page.locator('.map-panel.sheet')
    await expect(sheet).toBeVisible()
    const box = (await sheet.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(844 + 1)
    expect(box.y).toBeGreaterThan(200)
  }
})

test('Threads keeps its search when you come Back from a thread', async ({ page, world, device }) => {
  test.skip(device === 'phone', 'The address is the same on a phone.')
  const w = `/w/${world.slug}`
  await open(page, `${w}/threads`)
  // The card's name may start with how pressing it is (an icon); search by the words.
  const name = (await page.locator('.thread-name').first().innerText()).replace(/^[^\p{L}\p{N}]+/u, '').trim()
  const words = name.slice(0, 12).trim()
  const search = page.getByRole('searchbox', { name: 'Search threads' })
  await search.fill(words)
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(words)
  await page.locator('.thread-name', { hasText: name }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name)
  await page.goBack()
  await expect(search).toHaveValue(words)
  await expect(page.locator('.thread-name', { hasText: name }).first()).toBeVisible()
})

test('Timeline keeps List or Month in the address, and Back steps between them', async ({ page, world, device }) => {
  test.skip(device === 'phone', 'The address is the same on a phone.')
  const w = `/w/${world.slug}`
  await open(page, `${w}/timeline`)
  await page.locator('.segmented').getByRole('button', { name: 'Month' }).click()
  await expect.poll(() => here(page)).toBe(`${w}/timeline?view=month`)
  await expect(page.locator('.timeline-era')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.segmented').getByRole('button', { name: 'Month' })).toHaveClass(/\bon\b/)
  await page.goBack()
  await expect.poll(() => here(page)).toBe(`${w}/timeline`)
  await expect(page.locator('.timeline-era').first()).toBeVisible()
})

test('Places, People and Lore each switch between their two kinds, and headings follow the tabs', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  for (const [path, heading, kinds] of [
    ['locations', 'Places', ['Locations', 'Shops & Taverns']],
    ['npcs', 'People', ['NPCs', 'Player Characters']],
    ['lore', 'Lore', ['Lore', 'Deities']],
  ] as const) {
    await open(page, `${w}/${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
    for (const k of kinds) await expect(page.locator('.people-switch').getByRole('link', { name: k })).toBeVisible()
  }
  // The second kind opens its own list.
  await open(page, `${w}/locations`)
  await page.locator('.people-switch').getByRole('link', { name: 'Shops & Taverns' }).click()
  await expect(page.locator('.kicker').first()).toContainText('Shops & Taverns')
  // Threads has one name everywhere.
  await open(page, `${w}/threads`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Threads')
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Loose')
})

test('“Use an existing image” puts a picture already in the world on a page, without uploading it again', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const pictured = (e: (typeof world.dump.entities)[number]) => (e as { imageId?: string }).imageId
  // A person with a portrait, and another person to give the same portrait to.
  const all = world.dump.entities
  const people = all.filter((e) => e.type === 'npc' && !e.template && all.filter((o) => o.name === e.name).length === 1)
  // Its picture is named after it alone (no other page uses it, no other name contains it).
  const from = people.find(
    (e) => pictured(e) && !all.some((o) => o !== e && (pictured(o) === pictured(e) || o.name.toLowerCase().includes(e.name.toLowerCase()))),
  )!
  const to = people.find((e) => e !== from && pictured(e) !== pictured(from))!
  expect(from && to).toBeTruthy()
  await open(page, `${w}/p/${world.pageSlug(to.name)}?edit=1`)
  const before = await getRecord(page, 'entities', to.id)
  const filesBefore = await countFiles(page, world.id)
  try {
    await page.getByRole('button', { name: 'Use an existing image' }).click()
    const dialog = page.getByRole('dialog', { name: 'Use an existing image' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('searchbox', { name: 'Find a picture' }).fill(from.name)
    await dialog.getByRole('button', { name: from.name, exact: true }).first().click()
    await expect(dialog).toHaveCount(0)
    // Still in the editor (picking didn't save or leave), with the picture showing.
    await expect(page.locator('.label', { hasText: 'Image' }).locator('xpath=..').locator('img.portrait')).toBeVisible()
    await page.locator('.editor-bar').getByRole('button', { name: 'Save' }).click()
    await expect.poll(async () => ((await getRecord(page, 'entities', to.id)) as { imageId?: string } | undefined)?.imageId).toBe(pictured(from))
    // The picture isn't copied: the world has no new file.
    expect(await countFiles(page, world.id)).toBe(filesBefore)
  } finally {
    await putBack(page, 'entities', [[to.id, before]])
  }
})

/** How many files a world has, read straight from the database. */
function countFiles(page: Page, worldId: string) {
  return page.evaluate(
    (id) =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const r = idb.transaction('assets', 'readonly').objectStore('assets').index('worldId').count(id)
          r.onsuccess = () => {
            idb.close()
            resolve(r.result)
          }
          r.onerror = () => reject(r.error)
        }
      }),
    worldId,
  )
}
