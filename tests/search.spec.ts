import { expect, here, open, test, type Device, type Page } from './fixtures'
import type { World } from './lib/world'

/**
 * Search parity: the search box (Ctrl K / Cmd K, or the search button) finds everything it finds
 * today, and each result lands on the same address. The redesign must find at least all of this
 * (route map, section 4). On the laptop the box is opened with the keyboard; on the phone, with
 * the search button.
 */

/** The "Go to" places (src/search.tsx PLACES): title, address inside the world, GM-only. */
const PLACES: [string, string, boolean][] = [
  ['Home', '', false],
  ['Maps', '/maps', false],
  ['Timeline', '/timeline', false],
  ['Relationships', '/web', false],
  ['Loose threads', '/threads', false],
  ['Clocks', '/clocks', false],
  ['Party loot', '/loot', false],
  ['Handouts', '/handouts', false],
  ['Safety tools', '/safety', false],
  ['Soundboard', '/sounds', true],
  ['The Archivist', '/archivist', true],
  ['Generators and random tables', '/generators', true],
  ['Corkboards', '/boards', true],
  ['Files', '/assets', true],
  ['World settings', '/settings', true],
]

async function openSearch(page: Page, device: Device) {
  if (device === 'phone') await page.getByRole('button', { name: 'Search' }).click()
  else await page.keyboard.press('Control+k')
  const box = page.getByRole('dialog', { name: 'Search' }).getByRole('textbox')
  await expect(box).toBeVisible()
  return box
}

/** The result whose title is exactly `title` (and, if given, whose note is `note`: "Go to", "Map"…). */
function result(page: Page, title: string | RegExp, note?: string) {
  const exact = typeof title === 'string' ? new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) : title
  let hit = page
    .getByRole('dialog', { name: 'Search' })
    .locator('.search-results button')
    .filter({ has: page.locator('strong', { hasText: exact }) })
  if (note) hit = hit.filter({ has: page.locator('span', { hasText: new RegExp(`^${note}$`) }) })
  return hit.first()
}

async function find(page: Page, device: Device, world: World, query: string, title: string | RegExp, note?: string) {
  await open(page, `/w/${world.slug}`)
  const box = await openSearch(page, device)
  await box.fill(query)
  const hit = result(page, title, note)
  await expect(hit, `searching “${query}” should find “${title}”`).toBeVisible()
  return hit
}

test.describe('GM view', () => {
  for (const [title, path] of PLACES)
    test(`“Go to” ${title}`, async ({ page, world, device }) => {
      const hit = await find(page, device, world, title, title, 'Go to')
      await hit.click()
      await expect.poll(() => here(page)).toBe(`/w/${world.slug}${path}`)
    })

  test('finds a page and opens it', async ({ page, world, device }) => {
    await (await find(page, device, world, 'Ford Street', 'Ford Street')).click()
    await expect.poll(() => here(page)).toBe(`/w/${world.slug}/p/${world.pageSlug('Ford Street')}`)
    await expect(page.locator('main h1').first()).toContainText('Ford Street')
  })

  test('finds a GM-only page (marked GM only)', async ({ page, world, device }) => {
    const hit = await find(page, device, world, 'The Sleeper Below', 'The Sleeper Below')
    await expect(hit.getByLabel('GM only')).toBeVisible()
  })

  test('finds a session by “#1”', async ({ page, world, device }) => {
    const s = world.session(1)
    await (await find(page, device, world, '#1', `#1 ${s.title}`)).click()
    await expect.poll(() => here(page)).toBe(`/w/${world.slug}/s/${s.id}`)
  })

  test('finds a map', async ({ page, world, device }) => {
    await (await find(page, device, world, 'Cinderford', 'Cinderford', 'Map')).click()
    await expect.poll(() => here(page)).toBe(`/w/${world.slug}/maps/${world.map('Cinderford').id}`)
  })

  test('“new npc” makes a new NPC page (and Cancel removes it again)', async ({ page, world, device }) => {
    await (await find(page, device, world, 'new npc', 'New NPC')).click()
    await expect.poll(() => here(page)).toMatch(new RegExp(`^/w/${world.slug}/p/[^/?]+\\?edit=1&new=1$`))
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect.poll(() => here(page)).toBe(`/w/${world.slug}/npcs`)
    await expect(page.getByText('New NPC', { exact: true })).toHaveCount(0)
  })

  test('Enter opens the top result; Escape closes', async ({ page, world, device }) => {
    await open(page, `/w/${world.slug}`)
    let box = await openSearch(page, device)
    await box.fill('Escape test')
    await box.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0)
    box = await openSearch(page, device)
    await box.fill('Tharos')
    await expect(result(page, 'Tharos')).toBeVisible()
    await box.press('Enter')
    await expect.poll(() => here(page)).toBe(`/w/${world.slug}/p/${world.pageSlug('Tharos')}`)
  })
})

test.describe('keyboard shortcuts', () => {
  for (const keys of ['Control+k', 'Meta+k'])
    test(`${keys.replace('Control', 'Ctrl').replace('Meta', 'Cmd').replace('+k', ' K')} opens search on any world screen`, async ({ page, world, device }) => {
      test.skip(device === 'phone', 'no keyboard on a phone')
      for (const path of ['', '/maps', `/p/${world.pageSlug('Ford Street')}`, '/settings']) {
        await open(page, `/w/${world.slug}${path}`)
        await page.keyboard.press(keys)
        await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('textbox')).toBeFocused()
        await page.keyboard.press('Escape')
      }
    })
})

test.describe('player view', () => {
  test.use({ view: 'player' })
  for (const [title, path, gmOnly] of PLACES)
    test(`“Go to” ${title} ${gmOnly ? 'is not offered' : 'is offered'}`, async ({ page, world, device }) => {
      await open(page, `/w/${world.slug}`)
      const box = await openSearch(page, device)
      await box.fill(title)
      const hit = result(page, title, 'Go to')
      if (gmOnly) {
        await expect(page.getByRole('dialog', { name: 'Search' }).locator('.search-results')).toBeVisible()
        await expect(hit).toHaveCount(0)
        return
      }
      await hit.click()
      await expect.poll(() => here(page)).toBe(`/w/${world.slug}${path}`)
    })

  test('finds a revealed page, not a GM-only one, and offers no “New …”', async ({ page, world, device }) => {
    await open(page, `/w/${world.slug}`)
    const box = await openSearch(page, device)
    await box.fill('Ford Street')
    await expect(result(page, 'Ford Street')).toBeVisible()
    await box.fill('The Sleeper Below')
    await expect(page.getByRole('dialog', { name: 'Search' }).locator('.search-results')).toBeVisible()
    await expect(result(page, 'The Sleeper Below')).toHaveCount(0)
    await box.fill('new npc')
    await expect(page.getByRole('dialog', { name: 'Search' }).locator('.search-results')).toBeVisible()
    await expect(result(page, 'New NPC')).toHaveCount(0)
  })
})
