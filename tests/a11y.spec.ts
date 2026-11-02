import { expect, here, open, test, type Page } from './fixtures'

/**
 * Keyboard and screen-reader care (laptop and phone): each screen names itself in the browser tab,
 * a "Skip to content" link comes first, pop-ups keep the focus inside and give it back, the New
 * page menu closes the way a menu should, search says what it is doing, and Parchment's main
 * colours are readable. (Sideways scrolling at tablet width is in screens.spec.ts.)
 */

const searchButton = (page: Page) => page.getByRole('button', { name: 'Search', exact: true })
const inside = (page: Page, selector: string) => page.evaluate((s) => !!document.activeElement?.closest(s), selector)

test('each screen names itself in the browser tab', async ({ page, world }) => {
  await open(page, `/w/${world.slug}`)
  await expect(page).toHaveTitle('Desk · Vael Ardith')
  await open(page, `/w/${world.slug}/p/${world.pageSlug('Ford Street')}`)
  await expect(page).toHaveTitle('Ford Street · Atlas · Vael Ardith')
  await open(page, `/w/${world.slug}/clocks`)
  await expect(page).toHaveTitle('Clocks · Story · Vael Ardith')
})

test('a Skip to content link comes first and lands on the screen', async ({ page, world, device }) => {
  test.skip(device === 'phone', 'keyboard only')
  await open(page, `/w/${world.slug}/safety`)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeInViewport()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main-content')).toBeFocused()
})

test('after following a link inside the screen, the focus is on its heading', async ({ page, world, device }) => {
  test.skip(device === 'phone', 'keyboard only')
  await open(page, `/w/${world.slug}/npcs`)
  await page.locator('main a.card').first().click()
  await expect(page.locator('main h1').first()).toBeFocused()
})

test('search is a pop-up: Tab stays inside, Escape works anywhere and the focus goes back', async ({ page, world, device }) => {
  test.skip(device === 'phone', 'keyboard only')
  await open(page, `/w/${world.slug}`)
  const button = searchButton(page)
  await button.click()
  const dialog = page.getByRole('dialog', { name: 'Search' })
  await expect(dialog).toBeVisible()
  // The page behind is switched off.
  await expect(page.locator('.layout-body')).toHaveAttribute('inert', '')
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    expect(await inside(page, '[role="dialog"]'), `Tab ${i + 1} left the pop-up`).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await inside(page, '[role="dialog"]')).toBe(true)
  // Escape from the help button inside it, not just the search box.
  await dialog.getByRole('button', { name: /help|\?/i }).first().focus()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(button).toBeFocused()
  await expect(page.locator('.layout-body')).not.toHaveAttribute('inert', '')
})

test('search results are a list the arrow keys move through', async ({ page, world, device }) => {
  test.skip(device === 'phone', 'keyboard only')
  await open(page, `/w/${world.slug}`)
  await page.keyboard.press('Control+k')
  const box = page.getByRole('dialog', { name: 'Search' }).getByRole('textbox')
  await box.fill('Ford')
  const list = page.getByRole('listbox', { name: 'Results' })
  await expect(list).toBeVisible()
  await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
  await box.press('ArrowDown')
  await expect(list.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
  const active = await box.getAttribute('aria-activedescendant')
  await expect(page.locator(`#${active}`)).toHaveAttribute('aria-selected', 'true')
})

test('a pop-up with a field that takes the focus still hands it back to its button', async ({ page, world, device }) => {
  test.skip(device === 'phone', 'keyboard only')
  await open(page, `/w/${world.slug}/maps`)
  const draw = page.getByRole('button', { name: /Draw a (new )?map/i }).first()
  await draw.focus()
  await draw.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expect(await inside(page, '[role="dialog"]')).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(draw).toBeFocused()
})

test('the New page menu closes on Escape and when you click elsewhere', async ({ page, world }) => {
  await open(page, `/w/${world.slug}`)
  const button = page.getByRole('button', { name: 'New page', exact: true })
  await expect(button).toHaveAttribute('aria-haspopup', 'menu')
  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('menuitem').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(button).toBeFocused()
  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await page.locator('main h1').first().click({ position: { x: 4, y: 4 } })
  await expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('the Undo note has its live region on the page before any note appears', async ({ page, world }) => {
  await open(page, `/w/${world.slug}`)
  await expect(page.locator('.app-shell > [role="status"][aria-live="polite"]')).toHaveCount(1)
})

test('search finds clocks by name, and Markdown, Obsidian and Player view', async ({ page, world, device }) => {
  await open(page, `/w/${world.slug}`)
  const open_ = async (query: string) => {
    if (device === 'phone') await page.getByRole('button', { name: 'Search', exact: true }).click()
    else await page.keyboard.press('Control+k')
    const box = page.getByRole('dialog', { name: 'Search' }).getByRole('textbox')
    await box.fill(query)
    return page.getByRole('dialog', { name: 'Search' }).locator('.search-results')
  }
  let results = await open_('Debt called in')
  await expect(results.locator('strong', { hasText: /^\s*Debt called in\s*$/ }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  results = await open_('markdown')
  await expect(results.locator('strong', { hasText: /Backups|Import pages/ }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  results = await open_('obsidian')
  await expect(results.locator('strong', { hasText: /Backups|Import pages/ }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  results = await open_('player view')
  await results.locator('button', { has: page.locator('strong', { hasText: /^\s*Player view\s*$/ }) }).first().click()
  await expect(page.getByText(/Player view: you're seeing only|Player view as/)).toBeVisible()
})

test('Parchment: buttons, muted text and chips are readable (4.5 to 1)', async ({ page, world }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  await open(page, `/w/${world.slug}`)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  const ratios = await page.evaluate(() => {
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number)
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)]
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    const probe = document.createElement('div')
    document.body.append(probe)
    const get = (css: string) => {
      probe.style.color = css
      return parse(getComputedStyle(probe).color)
    }
    const out: Record<string, number> = {}
    out['cream on accent'] = ratio(get('var(--accent-ink)'), get('var(--accent)'))
    out['muted on page'] = ratio(get('var(--muted)'), get('var(--bg)'))
    out['muted on panel'] = ratio(get('var(--muted)'), get('var(--panel)'))
    out['focus ring on page'] = ratio(get('var(--accent)'), get('var(--bg)'))
    probe.remove()
    return out
  })
  for (const [what, r] of Object.entries(ratios)) expect(r, what).toBeGreaterThanOrEqual(what === 'focus ring on page' ? 3 : 4.5)
  expect(here(page)).toContain(world.slug)
})
