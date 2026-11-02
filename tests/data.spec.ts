import { expect, go, here, open, test, type Page } from './fixtures'
import { readDatabase, slugify } from './lib/world'
import { getRecord, putBack, type Row } from './lib/records'

/**
 * Keeping the GM's work safe: deleting a page (from its editor, after typing, or a new page never
 * saved) really deletes it, says what it unlinks, and Undo or More → Recently deleted brings it back
 * with the places inside it; and a backup made from a restored backup keeps every link (prep scenes,
 * the GM screen, quest rewards, the Lectern's journey and roll call, pictures in pin notes).
 *
 * Each test puts back what it changed (straight in the database), since tests in one worker share
 * the world.
 */

const toast = (page: Page) => page.locator('.undo-toast')

/** A page row as the app stores it. */
const pageRow = (worldId: string, name: string, extra: Record<string, unknown> = {}): Row => ({
  id: crypto.randomUUID(),
  worldId,
  type: 'location',
  name,
  summary: '',
  body: '',
  gmNotes: '',
  visibility: 'gm',
  tags: [],
  fields: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...extra,
})

/** Removes the test's pages for good, with their history (so Recently deleted doesn't list them later). */
async function forget(page: Page, ids: string[]) {
  await putBack(
    page,
    'entities',
    ids.map((id): [string, null] => [id, null]),
  )
  await page.evaluate(
    (ids) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('history', 'readwrite')
          const all = tx.objectStore('history').getAll()
          all.onsuccess = () => {
            for (const v of all.result as { id: string; entityId: string }[]) if (ids.includes(v.entityId)) tx.objectStore('history').delete(v.id)
          }
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    ids,
  )
}

test('deleting a page after typing in its editor deletes it, says what moves, and Restore puts it all back', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const hollow = pageRow(world.id, 'Data Test Hollow')
  const cellar = pageRow(world.id, 'Data Test Cellar', { parentId: hollow.id })
  await open(page, `${w}/locations`)
  await putBack(page, 'entities', [
    [hollow.id, hollow],
    [cellar.id, cellar],
  ])
  try {
    await open(page, `${w}/p/${slugify(String(hollow.name))}?edit=1`)
    await page.getByPlaceholder('One line shown in lists and on map pins').fill('Typed, then deleted')
    await page.locator('form').getByRole('button', { name: 'Delete' }).click()
    // The app's own confirm, saying what moves and where to get it back.
    const dialog = page.getByRole('dialog', { name: /Delete “Data Test Hollow”/ })
    await expect(dialog).toContainText('1 place inside it will move up a level')
    await expect(dialog).toContainText('More → Recently deleted')
    await dialog.getByRole('button', { name: 'Delete it' }).click()
    await expect.poll(() => here(page)).not.toContain('/p/')
    await expect(toast(page)).toContainText('“Data Test Hollow” deleted')
    // The editor closing must not write it straight back.
    await page.waitForTimeout(1500)
    await expect(page.getByText('Saved your changes')).toHaveCount(0)
    expect(await getRecord(page, 'entities', hollow.id)).toBeUndefined()
    expect((await getRecord(page, 'entities', cellar.id))?.parentId).toBeUndefined()

    // More → Recently deleted brings it back, with the place inside it.
    await go(page, `${w}/settings?tab=data&at=deleted`)
    await page.locator('li', { hasText: 'Data Test Hollow' }).getByRole('button', { name: 'Restore' }).click()
    await expect.poll(async () => (await getRecord(page, 'entities', hollow.id))?.name).toBe('Data Test Hollow')
    await expect.poll(async () => (await getRecord(page, 'entities', cellar.id))?.parentId).toBe(hollow.id)

    // Delete from the page's own menu, then Undo: back again, with the place inside it.
    await open(page, `${w}/p/${slugify(String(hollow.name))}`)
    const toggle = page.locator('.page-more-toggle')
    if (await toggle.isVisible()) await toggle.click()
    await page.locator('.page-more').getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete it' }).click()
    await expect.poll(() => here(page)).not.toContain('/p/')
    expect(await getRecord(page, 'entities', hollow.id)).toBeUndefined()
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await getRecord(page, 'entities', hollow.id))?.name).toBe('Data Test Hollow')
    await expect.poll(async () => (await getRecord(page, 'entities', cellar.id))?.parentId).toBe(hollow.id)
  } finally {
    await forget(page, [hollow.id, cellar.id])
  }
})

test('a new page that was never saved, typed in and deleted, leaves nothing behind', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const count = async () => (await readDatabase(page)).entities.length
  await open(page, `${w}/npcs`)
  const pages = await count()
  let made: string | undefined
  try {
    await page.getByRole('button', { name: /^\+ New NPC/ }).first().click()
    const blank = page.getByRole('menuitem', { name: 'Blank page' })
    if (await blank.isVisible()) await blank.click()
    await expect.poll(() => here(page)).toMatch(/\?edit=1&new=1$/)
    made = here(page).match(/\/p\/([^?]+)/)?.[1]
    await page.getByPlaceholder('Name this npc').fill('Data Test Never Saved')
    await page.locator('form').getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete it' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/npcs`)
    await page.waitForTimeout(1500)
    await expect(page.getByText('Saved your changes')).toHaveCount(0)
    expect(await count()).toBe(pages)
  } finally {
    const left = (await readDatabase(page)).entities.filter((e) => e.name === 'Data Test Never Saved' || e.id === made).map((e) => e.id)
    if (left.length) await forget(page, left)
  }
})

test('a backup of a restored backup keeps every link: prep scenes, GM screen, rewards, journey, roll call and pictures', async ({ page }) => {
  const W = crypto.randomUUID()
  const [place, npc, pc, sword, table, quest, camp, sess, sound, asset, map, pin] = Array.from({ length: 12 }, () => crypto.randomUUID())
  const now = Date.now()
  const ent = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ ...pageRow(W, name, extra), id })
  const dot = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  const backup = {
    format: 'campaign-codex-world',
    version: 1,
    exportedAt: new Date().toISOString(),
    world: { id: W, name: 'Data Test Import', description: '', system: 'System agnostic', createdAt: now, updatedAt: now, gmScreen: { pages: [npc], rolls: [] } },
    campaigns: [{ id: camp, worldId: W, name: 'Camp', description: '', system: '', status: 'active', createdAt: now }],
    entities: [
      ent(place, 'The Inn'),
      ent(npc, 'The Innkeeper', { type: 'npc' }),
      ent(pc, 'Hero', { type: 'pc', campaignId: camp }),
      ent(sword, 'Sword', { type: 'item' }),
      ent(table, 'Road encounters', { type: 'table', entries: ['wolves'] }),
      ent(quest, 'Find the sword', { type: 'quest', questStatus: 'open', rewards: [{ id: 'r1', text: 'a sword', itemId: sword }] }),
    ],
    maps: [{ id: map, worldId: W, name: 'Map', imageId: asset, width: 1, height: 1, visibility: 'gm', createdAt: now }],
    pins: [{ id: pin, worldId: W, mapId: map, label: 'Pin', kind: 'point', position: [0, 0], color: '#000', visibility: 'gm', note: `![dot](asset:${asset})` }],
    sounds: [{ id: sound, worldId: W, name: 'Rain', source: 'file', assetId: asset, loop: true, volume: 1, group: 'Ambience', createdAt: now }],
    boards: [],
    sessions: [
      {
        id: sess,
        worldId: W,
        campaignId: camp,
        number: 1,
        title: 'One',
        date: '',
        notes: '',
        recap: '',
        visibility: 'gm',
        entityIds: [],
        recordings: [],
        createdAt: now,
        prep: {
          strongStart: '',
          clues: [],
          encounters: [],
          scenes: [{ id: 'sc1', text: 'Arrive', done: false, placeId: place, presentIds: [npc], soundIds: [sound], revealIds: [npc], show: { kind: 'page', entityId: place } }],
        },
        lectern: {
          sceneText: '',
          presentIds: [],
          combat: { round: 0, combatants: [] },
          rolls: [],
          journey: { to: 'x', distance: 1, unit: 'mi', pace: 'normal', travelled: 0, encounterTableId: table, days: [] },
          rollCall: { id: 'rc', label: 'Perception', dice: 'd20', to: [pc], at: now, answers: [{ id: 'a1', entityId: pc, who: 'Hero', expr: 'd20', total: 12, detail: '12' }] },
        },
      },
    ],
    assets: [{ id: asset, worldId: W, name: 'dot.png', mime: 'image/png', size: 68, tags: [], visibility: 'gm', createdAt: now, data: dot }],
  }

  /** Checks an imported copy points at its own pages, sounds and pictures, never the originals' ids. */
  const check = async (worldId: string) => {
    const read = (table: string) =>
      page.evaluate(
        ({ table, worldId }) =>
          new Promise<Record<string, unknown>[]>((resolve, reject) => {
            const req = indexedDB.open('ttrpg-campaign-manager')
            req.onerror = () => reject(req.error)
            req.onsuccess = () => {
              const idb = req.result
              const all = idb.transaction(table, 'readonly').objectStore(table).getAll()
              all.onsuccess = () => {
                idb.close()
                resolve((all.result as Record<string, unknown>[]).filter((r) => (table === 'worlds' ? r.id : r.worldId) === worldId))
              }
            }
          }),
        { table, worldId },
      )
    const ents = (await read('entities')) as { id: string; name: string; rewards?: { itemId?: string }[] }[]
    const id = (name: string) => ents.find((e) => e.name === name)!.id
    const [w] = (await read('worlds')) as { gmScreen: { pages: string[] } }[]
    expect(w.gmScreen.pages).toEqual([id('The Innkeeper')])
    expect(ents.find((e) => e.name === 'Find the sword')!.rewards![0].itemId).toBe(id('Sword'))
    const sounds = (await read('sounds')) as { id: string }[]
    // Files in a zip backup are unpacked just after the world opens.
    await expect.poll(async () => ((await read('assets')) as { id: string }[]).length).toBe(1)
    const [s] = (await read('sessions')) as {
      prep: { scenes: { placeId: string; presentIds: string[]; soundIds: string[]; revealIds: string[]; show: { entityId: string } }[] }
      lectern: { journey: { encounterTableId: string }; rollCall: { to: string[]; answers: { entityId: string }[] } }
    }[]
    const sc = s.prep.scenes[0]
    expect(sc.placeId).toBe(id('The Inn'))
    expect(sc.presentIds).toEqual([id('The Innkeeper')])
    expect(sc.revealIds).toEqual([id('The Innkeeper')])
    expect(sc.show.entityId).toBe(id('The Inn'))
    expect(sc.soundIds).toEqual([sounds[0].id])
    expect(s.lectern.journey.encounterTableId).toBe(id('Road encounters'))
    expect(s.lectern.rollCall.to).toEqual([id('Hero')])
    expect(s.lectern.rollCall.answers[0].entityId).toBe(id('Hero'))
    const [p] = (await read('pins')) as { note: string }[]
    const [picture] = (await read('assets')) as { id: string }[]
    expect(p.note).toBe(`![dot](asset:${picture.id})`)
  }

  const worldIds = async () => new Set((await readDatabase(page)).worlds.map((x) => x.id))
  const made: string[] = []
  try {
    await open(page, '/')
    const had = await worldIds()
    // Restore the backup…
    await page.locator('input[type=file]').first().setInputFiles({ name: 'test.codex.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
    await expect.poll(async () => [...(await worldIds())].filter((x) => !had.has(x)).length).toBe(1)
    const first = [...(await worldIds())].find((x) => !had.has(x))!
    made.push(first)
    await check(first)

    // …back it up again, and restore that.
    await open(page, `/w/${first}/settings?tab=data`)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download backup/ }).first().click()])
    await expect(toast(page)).toContainText('Backup downloaded')
    await open(page, '/')
    const before = await worldIds()
    await page.locator('input[type=file]').first().setInputFiles(await download.path())
    await expect.poll(async () => [...(await worldIds())].filter((x) => !before.has(x)).length).toBe(1)
    const second = [...(await worldIds())].find((x) => !before.has(x))!
    made.push(second)
    await check(second)
  } finally {
    // The imported copies go again, every row of them.
    await page.evaluate(
      (ids) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('ttrpg-campaign-manager')
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const idb = req.result
            const tables = ['worlds', 'campaigns', 'entities', 'maps', 'pins', 'sessions', 'assets', 'boards', 'sounds', 'history']
            const tx = idb.transaction(tables, 'readwrite')
            for (const t of tables) {
              const all = tx.objectStore(t).getAll()
              all.onsuccess = () => {
                for (const r of all.result as { id: string; worldId?: string }[]) if (ids.includes(t === 'worlds' ? r.id : (r.worldId ?? ''))) tx.objectStore(t).delete(r.id)
              }
            }
            tx.oncomplete = () => {
              idb.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error)
          }
        }),
      made,
    )
  }
})
