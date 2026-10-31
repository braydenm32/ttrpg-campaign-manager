import { expect, go, here, open, test, type Page } from './fixtures'
import { readDatabase } from './lib/world'

/**
 * The GM's Session area (Prepare → Play → Wrap up), on a laptop and a phone: a session moves
 * through its stages and the next one comes up on the Desk; changing the scene at the Lectern
 * replaces the read-aloud text and who's here; Undo brings back a removed scene; and nothing typed
 * in the page editor is lost by leaving, while a new page left untouched leaves nothing behind.
 *
 * Each test puts back what it changed (straight in the database), since tests in one worker share
 * the world.
 */

type Row = Record<string, unknown> & { id: string }

/** One record of the app's database, read in the page. */
function getRecord(page: Page, table: string, id: string) {
  return page.evaluate(
    ({ table, id }) =>
      new Promise<Row | undefined>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const get = idb.transaction(table, 'readonly').objectStore(table).get(id)
          get.onsuccess = () => {
            idb.close()
            resolve(get.result)
          }
          get.onerror = () => reject(get.error)
        }
      }),
    { table, id },
  )
}

/** Puts records back as they were, or (for null) deletes them. */
function putBack(page: Page, table: string, rows: [string, Row | null | undefined][]) {
  return page.evaluate(
    ({ table, rows }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(table, 'readwrite')
          const store = tx.objectStore(table)
          for (const [id, row] of rows) {
            if (row) store.put(row)
            else store.delete(id)
          }
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { table, rows },
  )
}

const toast = (page: Page) => page.locator('.undo-toast')

test('a session moves Prepare → Play → Wrap up, then the next one is up on the Desk', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const s2 = world.session(2)
  await open(page, `${w}/s/${s1.id}?tab=prep`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    const strip = page.locator('.session-strip')
    await expect(strip.locator('[data-stage]')).toHaveAttribute('data-stage', 'preparing')
    await strip.getByRole('button', { name: 'Start playing' }).click()

    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}/lectern`)
    await expect(page.getByRole('heading', { name: /The Lectern/ })).toBeVisible()
    await expect(page.locator('.lectern-strip [data-stage]')).toHaveAttribute('data-stage', 'playing')
    await page.locator('.lectern-strip').getByRole('button', { name: 'Wrap up' }).click()

    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}?end=1`)
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'playing')
    await page.getByRole('button', { name: 'Mark as played' }).first().click()
    await expect(toast(page)).toContainText('#1 marked played')
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'played')
    await expect(page.locator('#finish')).toContainText(`Next up: #2 ${s2.title}`)

    await open(page, w)
    const card = page.locator('.next-sessions')
    await expect(card).toContainText(`#2 ${s2.title}`)
    await expect(card.locator('[data-stage]').first()).not.toHaveAttribute('data-stage', 'played')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('changing the scene at the Lectern replaces the read-aloud text and who’s here, with Undo', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const before = await (async () => {
    await open(page, `${w}/s/${s1.id}/lectern`)
    return getRecord(page, 'sessions', s1.id)
  })()
  try {
    const scene = page.locator('#lectern-scene')
    const present = page.locator('#lectern-present')
    const text = scene.getByRole('textbox', { name: 'Read-aloud text' })
    await text.fill('The old room, read aloud.')
    await expect(present).toContainText('Ilse Marrow')

    const elsewhere = world.dump.entities.find((e) => e.type === 'location' && e.name !== 'Lantern Hill' && !e.template)!
    await scene.getByLabel('Where is the party?').selectOption(elsewhere.id)
    await expect(text).toHaveValue('')
    await expect(present).not.toContainText('Ilse Marrow')

    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(text).toHaveValue('The old room, read aloud.')
    await expect(present).toContainText('Ilse Marrow')

    // "Next scene" goes through the planned scenes in order.
    await scene.getByRole('button', { name: 'First scene' }).click()
    await expect(scene.locator('h2')).toContainText('Scene 1 of')
    await expect(text).toHaveValue('')
    await scene.getByRole('button', { name: 'Next scene' }).click()
    await expect(scene.locator('h2')).toContainText('Scene 2 of')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('Undo brings back a scene removed on Prepare, in its place', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, `${w}/s/${s1.id}?tab=prep`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    const first = page.getByRole('textbox', { name: 'Scene 1', exact: true })
    const was = await first.inputValue()
    expect(was).not.toBe('')
    await page.getByRole('button', { name: 'Remove scene 1', exact: true }).click()
    await expect(first).not.toHaveValue(was)
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(first).toHaveValue(was)
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('nothing typed in the page editor is lost by leaving, and an untouched new page leaves nothing', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const npc = world.page('Ilse Marrow')
  await open(page, `${w}/p/${world.pageSlug('Ilse Marrow')}?edit=1`)
  const original = await getRecord(page, 'entities', npc.id)
  const made: string[] = []
  try {
    // Typed, then away by a link or Back: saved, with Undo.
    await page.getByPlaceholder('One line shown in lists and on map pins').fill('Typed and never saved')
    await go(page, `${w}/maps`)
    await expect(toast(page)).toContainText('Saved your changes to “Ilse Marrow”')
    await expect.poll(async () => (await getRecord(page, 'entities', npc.id))?.summary).toBe('Typed and never saved')
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await getRecord(page, 'entities', npc.id))?.summary).toBe(original?.summary)

    // A new page is only added once there's something in it.
    const count = async () => (await readDatabase(page)).entities.length
    const pages = await count()
    const newNpc = async () => {
      await open(page, `${w}/npcs`)
      await page.getByRole('button', { name: /^\+ New NPC/ }).first().click()
      const blank = page.getByRole('button', { name: 'Blank page' })
      if (await blank.isVisible()) await blank.click()
      await expect.poll(() => here(page)).toMatch(/\?edit=1&new=1$/)
      return page.getByPlaceholder('Name this npc')
    }
    await expect(await newNpc()).toBeVisible()
    expect(await count()).toBe(pages)
    await go(page, `${w}/maps`)
    expect(await count()).toBe(pages)

    // Cancel takes it back too (and ?new=1 still works).
    await newNpc()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/npcs`)
    expect(await count()).toBe(pages)

    // Written in and left: kept.
    await (await newNpc()).fill('Session test NPC')
    const id = here(page).match(/\/p\/([^?]+)/)![1]
    made.push(id)
    await go(page, `${w}/maps`)
    await expect(toast(page)).toContainText('Saved your changes to “Session test NPC”')
    await expect.poll(count).toBe(pages + 1)
  } finally {
    await putBack(page, 'entities', [[npc.id, original], ...made.map((id): [string, null] => [id, null])])
  }
})
