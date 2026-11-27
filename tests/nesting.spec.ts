import { expect, open, setView, test, type Page } from './fixtures'
import { getRecord, putBack, type Row } from './lib/records'

/**
 * Pages under pages of their own kind, on a laptop: a faction made "under" another sits under it in
 * its trail, its details and the Factions list (folded with the arrow), can't be put under its own
 * child, moves up a level when its parent is deleted and goes back with Undo. In the player view a
 * GM-only parent of a page players can see is never named: not on the page, nor in the list.
 *
 * Each test puts back what it changed.
 */

const toast = (page: Page) => page.locator('.undo-toast')

test('a faction under a faction: set, shown in the trail and the list, no loop, and Undo after deleting the parent puts it back', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const parent = world.dump.entities.find((e) => e.type === 'faction' && e.name === 'The Quiet Office')!
  await open(page, `${w}/p/${world.pageSlugs.get(parent.id)}`)
  const before = await getRecord(page, 'entities', parent.id)
  let childId = ''
  try {
    // "+ New faction under it" opens the editor with Part of already set.
    await page.getByRole('button', { name: 'New faction under it' }).click()
    await expect(page.getByLabel('Part of')).toHaveValue('The Quiet Office')
    await page.getByLabel('Name of this faction').fill('The Lantern Desk')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1, name: /The Lantern Desk/ })).toBeVisible()
    const findChild = () =>
      page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            const r = indexedDB.open('ttrpg-campaign-manager')
            r.onsuccess = () => {
              const q = r.result.transaction('entities').objectStore('entities').getAll()
              q.onsuccess = () => {
                r.result.close()
                resolve((q.result as { id: string; name: string }[]).find((e) => e.name === 'The Lantern Desk')?.id ?? '')
              }
            }
          }),
      )
    await expect.poll(findChild).not.toBe('')
    childId = await findChild()
    expect((await getRecord(page, 'entities', childId))?.parentId).toBe(parent.id)

    // The trail at the top and the details both name the faction it's part of, as links.
    const trail = page.getByRole('navigation', { name: 'Where this page sits' })
    await expect(trail.getByRole('link', { name: 'Factions' })).toBeVisible()
    await expect(trail.getByRole('link', { name: 'The Quiet Office' })).toBeVisible()
    await expect(page.locator('.facts')).toContainText('Part of')

    // The parent lists it under it.
    await trail.getByRole('link', { name: 'The Quiet Office' }).click()
    await expect(page.locator('.under-it')).toContainText('The Lantern Desk')

    // The Factions list shows it under its parent, and the arrow folds it away.
    await open(page, `${w}/factions`)
    const branch = page.locator('.tree li', { has: page.getByRole('link', { name: 'The Quiet Office', exact: true }) })
    await expect(branch.locator('ul').getByRole('link', { name: 'The Lantern Desk' })).toBeVisible()
    await page.getByRole('button', { name: 'Fold The Quiet Office' }).click()
    await expect(page.getByRole('link', { name: 'The Lantern Desk' })).toHaveCount(0)
    await expect(branch).toContainText('1 under it')
    await page.getByRole('button', { name: 'Open The Quiet Office' }).click()
    await expect(page.getByRole('link', { name: 'The Lantern Desk' })).toBeVisible()

    // Search still finds it by its own name.
    await page.keyboard.press('Control+k')
    await page.getByRole('dialog', { name: 'Search' }).getByRole('textbox').fill('Lantern Desk')
    await expect(page.getByRole('dialog', { name: 'Search' }).locator('.search-results')).toContainText('The Lantern Desk')
    await page.keyboard.press('Escape')

    // No loop: the parent's own "Part of" doesn't offer its child.
    await open(page, `${w}/p/${world.pageSlugs.get(parent.id)}?edit=1`)
    await page.getByLabel('Part of').fill('Lantern Desk')
    await expect(page.locator('.page-picker-list')).toContainText('Nothing matches.')
    await page.getByLabel('Part of').fill('')
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Deleting the parent moves it to the top of the list (nothing vanishes); Undo puts it back under.
    await open(page, `${w}/p/${world.pageSlugs.get(parent.id)}`)
    await page.locator('.page-strip, .page').getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('dialog')).toContainText('1 page under it will move up a level.')
    await page.getByRole('dialog').getByRole('button', { name: 'Delete it' }).click()
    await expect.poll(async () => (await getRecord(page, 'entities', childId))?.parentId).toBeUndefined()
    await expect(page.getByRole('link', { name: 'The Lantern Desk' })).toBeVisible()
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await getRecord(page, 'entities', childId))?.parentId).toBe(parent.id)
  } finally {
    await putBack(page, 'entities', [
      [parent.id, before],
      ...(childId ? [[childId, null] as [string, null]] : []),
    ])
  }
})

test('players never see the name of a GM-only page that a page they can see sits under', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const parent = world.dump.entities.find((e) => e.type === 'faction' && e.name === 'The Quiet Office' && e.visibility === 'gm')!
  expect(parent).toBeTruthy()
  await open(page, w)
  const base = (await getRecord(page, 'entities', parent.id))!
  const childId = 'test-nested-child-0000-000000000000'
  const child: Row = {
    ...base,
    id: childId,
    name: 'The Lantern Desk',
    summary: 'Clerks who copy letters.',
    body: 'They copy letters.',
    gmNotes: '',
    visibility: 'players',
    parentId: parent.id,
    relations: [],
    fields: [],
    tags: [],
    aliases: undefined,
    gmTags: undefined,
    imageId: undefined,
  }
  await putBack(page, 'entities', [[childId, child]])
  try {
    await setView(page, world, 'player')
    await open(page, `${w}/factions`)
    await expect(page.getByRole('link', { name: 'The Lantern Desk' })).toBeVisible()
    // Not named, not as an empty indented row, not as a count.
    await expect(page.locator('body')).not.toContainText('Quiet Office')
    expect(await page.content()).not.toContain('Quiet Office')
    await expect(page.locator('.tree ul')).toHaveCount(0)

    await page.getByRole('link', { name: 'The Lantern Desk' }).click()
    await expect(page.getByRole('heading', { level: 1, name: /The Lantern Desk/ })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Quiet Office')
    expect(await page.content()).not.toContain('Quiet Office')
    await expect(page.locator('.facts')).not.toContainText('Part of')
    // The trail is only the list.
    await expect(page.getByRole('navigation', { name: 'Where this page sits' }).getByRole('link')).toHaveCount(1)
  } finally {
    await setView(page, world, 'gm')
    await putBack(page, 'entities', [[childId, null]])
  }
})
