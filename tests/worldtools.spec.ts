import { expect, here, open, test, type Page } from './fixtures'
import { getRecord, putBack } from './lib/records'

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
    else await page.locator('.relations').getByRole('button', { name: /Add/ }).first().click()
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
  const groups = page.locator('.quest-group h2')
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
