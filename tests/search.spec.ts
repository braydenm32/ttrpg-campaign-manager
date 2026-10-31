import { expect, here, open, test, type Device, type Page } from './fixtures'
import type { World } from './lib/world'

/**
 * Search parity: the search box (Ctrl K / Cmd K, or the search button) finds everything it finds
 * today, and each result lands on the same address. The redesign must find at least all of this
 * (route map, section 4). On the laptop the box is opened with the keyboard; on the phone, with
 * the search button.
 */

/**
 * The "Go to" places search had before the areas (route map, section 4), now made from src/nav.ts.
 * Typing the old name still finds the place: [old name, what it's called now (GM), its address
 * inside the world, and for players what it's called and where it goes, or null if it's GM only].
 */
const PLACES: [string, string, string, [string, string] | null][] = [
  ['Home', 'Today', '', ['Now', '']],
  ['Maps', 'Maps', '/maps', ['Maps', '/maps']],
  ['Timeline', 'Timeline', '/timeline', ['Timeline', '/timeline']],
  ['Relationships', 'Relationships', '/web', ['Relationships', '/web']],
  ['Loose threads', 'Threads', '/threads', ['Leads', '?tab=leads']],
  ['Clocks', 'Clocks', '/clocks', ['Clocks', '/clocks']],
  ['Party loot', 'Party loot', '/loot', ['Party loot', '/loot']],
  ['Handouts', 'Handouts', '/handouts', ['Handouts', '/handouts']],
  ['Safety tools', 'Safety tools', '/safety', ['Table rules', '/safety']],
  ['Soundboard', 'Soundboard', '/sounds', null],
  ['The Archivist', 'The Archivist', '/archivist', null],
  ['Generators and random tables', 'Generators', '/generators', null],
  ['Corkboards', 'Corkboards', '/boards', null],
  ['Files', 'Files', '/assets', null],
  ['World settings', 'World settings', '/settings', null],
]

/** Places search couldn't find before the areas: [what you type, the result, its address inside the world]. GM only. */
const NEW_PLACES: [string, string, string | RegExp][] = [
  ['Lectern', 'The Lectern', /^\/s\/[^/]+\/lectern$/],
  ['Chronicle', 'Chronicle', '/chronicle'],
  ['Questions', 'Inbox', '/questions'],
  ['Scratchpad', 'Players’ scratchpad', '/scratchpad'],
  ['Campaigns', 'All sessions', /^\/c\/[^/]+$/],
  ['Templates', 'Templates', '/settings?at=templates'],
  ['Recently deleted', 'Recently deleted', '/settings?tab=data&at=deleted'],
  ['Random tables', 'Random tables', '/tables'],
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
  for (const [old, title, path] of PLACES)
    test(`“Go to” ${old}`, async ({ page, world, device }) => {
      const hit = await find(page, device, world, old, title, 'Go to')
      await hit.click()
      await expect.poll(() => here(page)).toBe(`/w/${world.slug}${path}`)
    })

  for (const [query, title, path] of NEW_PLACES)
    test(`“Go to” ${title} (new)`, async ({ page, world, device }) => {
      const hit = await find(page, device, world, query, title, 'Go to')
      await hit.click()
      const at = (url: string) => url.replace(`/w/${world.slug}`, '')
      if (typeof path === 'string') await expect.poll(() => at(here(page))).toBe(path)
      else await expect.poll(() => at(here(page))).toMatch(path)
    })

  test('finds a campaign by name', async ({ page, world, device }) => {
    const c = world.dump.campaigns[0]
    await (await find(page, device, world, c.name, c.name, 'Go to')).click()
    await expect.poll(() => here(page)).toBe(`/w/${world.slug}/c/${c.id}`)
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
  for (const [old, gmTitle, , players] of PLACES)
    test(`“Go to” ${old} ${players ? 'is offered' : 'is not offered'}`, async ({ page, world, device }) => {
      await open(page, `/w/${world.slug}`)
      const box = await openSearch(page, device)
      await box.fill(old)
      if (!players) {
        await expect(page.getByRole('dialog', { name: 'Search' }).locator('.search-results')).toBeVisible()
        await expect(result(page, gmTitle, 'Go to')).toHaveCount(0)
        await expect(result(page, old, 'Go to')).toHaveCount(0)
        return
      }
      await result(page, players[0], 'Go to').click()
      const path = players[1]
      await expect.poll(() => here(page)).toBe(`/w/${world.slug}${path}`)
    })

  for (const [query, title] of NEW_PLACES.filter(([q]) => !['Scratchpad', 'Campaigns'].includes(q)))
    test(`“Go to” ${title} is not offered`, async ({ page, world, device }) => {
      await open(page, `/w/${world.slug}`)
      const box = await openSearch(page, device)
      await box.fill(query)
      await expect(page.getByRole('dialog', { name: 'Search' }).locator('.search-results')).toBeVisible()
      await expect(result(page, title, 'Go to')).toHaveCount(0)
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
