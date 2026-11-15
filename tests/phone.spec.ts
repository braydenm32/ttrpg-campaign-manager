import { expect, here, open, setView, test, type Page } from './fixtures'

/**
 * Scrolling and moving around on a phone (src/phone.css, src/phoneFrame.ts): the top bar slides away
 * while you scroll down and comes back when you scroll up; the map builder takes the whole screen
 * (tools along the bottom, the tool's options in a sheet, the rest under ⋯); a map always fits the
 * screen; no box scrolls up and down inside the scrolling page; lists of pages are slim.
 */
test.beforeEach(({ device }) => test.skip(device !== 'phone', 'phone only'))

/** Scrolls the page by a few small steps, the way a finger does, and lets the bar catch up. */
async function scrollBy(page: Page, dy: number) {
  for (let i = 0; i < 4; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dy / 4)
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(400)
}

/** Boxes inside the screen that scroll up and down on their own (a scroll inside the scroll). */
const innerScrollers = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#main-content *')]
      .filter((el) => {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4
      })
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`),
  )

test('the top bar slides away while scrolling down a page and comes back on scrolling up', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  await open(page, `${w}/s/${world.session(1).id}?tab=prep`)
  const bar = page.locator('.topbar')
  await expect(bar).toBeInViewport()
  await scrollBy(page, 900)
  await expect(page.locator('body')).toHaveClass(/bar-tucked/)
  await expect.poll(async () => (await bar.boundingBox())!.y + (await bar.boundingBox())!.height).toBeLessThanOrEqual(1)
  // The jump buttons move up into its place; the bottom bar stays.
  await expect.poll(async () => (await page.locator('.jump-row.phone-only').boundingBox())!.y).toBeLessThan(10)
  await expect(page.getByRole('navigation', { name: 'Areas' })).toBeInViewport()
  await scrollBy(page, -80)
  await expect(page.locator('body')).not.toHaveClass(/bar-tucked/)
  await expect.poll(async () => (await bar.boundingBox())!.y).toBeGreaterThanOrEqual(0)
  // Another screen starts with the bar in sight.
  await scrollBy(page, 900)
  await expect(page.locator('body')).toHaveClass(/bar-tucked/)
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Atlas' }).click()
  await expect.poll(() => here(page)).toBe(`${w}/maps`)
  await expect(page.locator('body')).not.toHaveClass(/bar-tucked/)
})

test('the map builder takes the whole screen, with the tools at the bottom and the options in a sheet', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const map = world.map('Cinderford').id
  await open(page, `${w}/maps/${map}/draw`)
  await expect(page.locator('.topbar')).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Areas' })).toBeHidden()
  // Nothing to scroll: the map, its bar and its tools fit the screen.
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
  const tools = page.locator('.builder-tools > button')
  for (const tool of await tools.all()) await expect(tool).toBeInViewport({ ratio: 1 })
  const view = page.viewportSize()!
  expect((await page.locator('.builder-tools').boundingBox())!.y).toBeGreaterThan(view.height - 120)
  // The tool's options: one line until opened, then above the tools and scrolling inside themselves.
  const handle = page.locator('.sheet-handle')
  await page.getByRole('button', { name: 'Place', exact: true }).click()
  await expect(handle).toContainText('Place')
  await expect(handle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByPlaceholder(/Find a piece/)).toBeHidden()
  await handle.click()
  await expect(handle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByPlaceholder(/Find a piece/)).toBeVisible()
  const sheet = (await page.locator('.builder-panel').boundingBox())!
  expect(sheet.y + sheet.height).toBeLessThanOrEqual((await page.locator('.builder-tools').boundingBox())!.y + 1)
  await handle.click()
  await expect(handle).toHaveAttribute('aria-expanded', 'false')
  // ⋯ holds zoom, Fit, Export, Versions and the layers; picking one closes it.
  const menu = page.getByRole('button', { name: /^More: zoom/ })
  await menu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  for (const name of ['Zoom in', 'Zoom out', 'Fit', 'Export', 'Versions', 'Layers and map settings']) await expect(page.locator('.builder-menu').getByRole('button', { name })).toBeVisible()
  await page.locator('.builder-menu').getByRole('button', { name: 'Layers and map settings' }).click()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(handle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('heading', { name: /Layers/ })).toBeInViewport()
  // Done goes back to the map, with the world's bars back.
  await page.getByRole('link', { name: '← Done' }).click()
  await expect.poll(() => here(page)).toBe(`${w}/maps/${map}`)
  await expect(page.locator('.topbar')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Areas' })).toBeVisible()
})

test('a map fits the screen, even with the Player view bar showing', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const map = world.map('Cinderford').id
  for (const view of ['gm', 'player'] as const) {
    await setView(page, world, view)
    await open(page, `${w}/maps/${map}`)
    await expect(page.locator('.leaflet-container')).toBeVisible()
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
    const m = (await page.locator('.leaflet-container').boundingBox())!
    const bar = (await page.getByRole('navigation', { name: 'Areas' }).boundingBox())!
    expect(m.y + m.height).toBeLessThanOrEqual(bar.y + 1)
    // Its name and buttons share one line, under the top bar.
    await expect(page.getByRole('heading', { name: 'Cinderford', level: 1 })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Names' })).toBeInViewport()
  }
})

test('no box scrolls up and down inside the page', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  for (const url of [
    `${w}/s/${world.session(1).id}/lectern`,
    `${w}/p/${world.pageSlug('Cinderford')}?edit=1`,
    `${w}/settings`,
    `${w}/web`,
  ]) {
    await open(page, url)
    await page.waitForTimeout(500)
    expect(await innerScrollers(page), url).toEqual([])
  }
  // The relationship web lets a finger scroll the page past it.
  await expect(page.locator('.web-graph').first()).toHaveCSS('touch-action', 'pan-y')
  // The Lectern's notes show the newest lines, with the rest a tap away.
  await open(page, `${w}/s/${world.session(1).id}/lectern`)
  const all = page.getByRole('button', { name: 'Show all the notes' })
  if (await all.count()) {
    await all.click()
    await expect(page.getByRole('button', { name: 'Show only the newest' })).toBeVisible()
  }
})

test('lists of pages are slim cards: the name, two lines and any status', async ({ page, world }) => {
  await open(page, `/w/${world.slug}/npcs`)
  const cards = page.locator('.entity-cards > .card')
  expect(await cards.count()).toBeGreaterThan(20)
  for (const card of (await cards.all()).slice(0, 10)) {
    expect((await card.boundingBox())!.height).toBeLessThan(150)
    await expect(card.locator('.tag:not([class*="status-"])').first()).toBeHidden()
  }
})
