import { expect, here, open, test, type Page } from './fixtures'

/**
 * The world's frame (src/Sidebar.tsx, from src/nav.ts): the areas (the sidebar on a laptop, the bar
 * along the bottom on a phone) and the open area's tabs. Tabs are steps in Back, each area
 * remembers where you were in it, and on a phone the bottom bar goes where it says.
 */

/** The areas: the sidebar on a laptop, the bottom bar on a phone (whichever is showing). */
const areas = (page: Page) => page.getByRole('navigation', { name: 'Areas' })
/** The open area's tabs, across the top (on a phone, the row under the top bar). */
const tabs = (page: Page, area: string) => page.getByRole('navigation', { name: area, exact: true })

test.describe('GM view', () => {
  test('the bottom bar (phone) or the sidebar (laptop) goes to each area', async ({ page, world }) => {
    const w = `/w/${world.slug}`
    await open(page, `${w}/maps`)
    await areas(page).getByRole('link', { name: 'Story' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/threads`)
    await areas(page).getByRole('link', { name: 'More' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/more`)
    await areas(page).getByRole('link', { name: /^Desk/ }).click()
    await expect.poll(() => here(page)).toBe(w)
    await areas(page).getByRole('link', { name: 'Atlas' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/maps`)
    // Session opens the next session to play (its prep), the one being played, or a page to plan one.
    await areas(page).getByRole('link', { name: 'Session' }).click()
    await expect.poll(() => here(page)).toMatch(new RegExp(`^${w}/(s/[^/?]+(\\?tab=prep|/lectern)|session)$`))
    await expect(tabs(page, 'Session').getByRole('link', { name: 'All sessions' })).toBeVisible()
  })

  test('Back after a tab steps back to the tab before', async ({ page, world }) => {
    const w = `/w/${world.slug}`
    await open(page, `${w}/maps`)
    await tabs(page, 'Atlas').getByRole('link', { name: 'Places' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/locations`)
    await tabs(page, 'Atlas').getByRole('link', { name: 'People' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/npcs`)
    await page.goBack()
    await expect.poll(() => here(page)).toBe(`${w}/locations`)
    await expect(tabs(page, 'Atlas').getByRole('link', { name: 'Places' })).toHaveAttribute('aria-current', 'page')
    await page.goBack()
    await expect.poll(() => here(page)).toBe(`${w}/maps`)
    // The Session tabs too: Prepare, then Wrap up, then Back.
    const s = world.session(1).id
    await open(page, `${w}/s/${s}?tab=prep`)
    await tabs(page, 'Session').getByRole('link', { name: 'Wrap up' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/s/${s}?tab=notes`)
    await page.goBack()
    await expect.poll(() => here(page)).toBe(`${w}/s/${s}?tab=prep`)
    await expect(tabs(page, 'Session').getByRole('link', { name: 'Prepare' })).toHaveAttribute('aria-current', 'page')
  })

  test('each area remembers the page you were last on in it', async ({ page, world }) => {
    const w = `/w/${world.slug}`
    await open(page, `${w}/maps`)
    await tabs(page, 'Atlas').getByRole('link', { name: 'Places' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/locations`)
    await areas(page).getByRole('link', { name: 'Story' }).click()
    await tabs(page, 'Story').getByRole('link', { name: 'Clocks' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/clocks`)
    await areas(page).getByRole('link', { name: 'Atlas' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/locations`)
    await areas(page).getByRole('link', { name: 'Story' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/clocks`)
    // Pressing the area you're in goes to its start.
    await areas(page).getByRole('link', { name: 'Story' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/threads`)
  })

  test('the More page lists its three groups, and each item opens', async ({ page, world }) => {
    const w = `/w/${world.slug}`
    await open(page, `${w}/more`)
    for (const group of ['At the table', 'Workshop', 'Keeping the world']) await expect(page.getByRole('heading', { name: group })).toBeVisible()
    await page.getByRole('link', { name: /^Random tables/ }).click()
    await expect.poll(() => here(page)).toBe(`${w}/tables`)
    // An item lights its own name next to More in the top bar.
    await expect(tabs(page, 'More').getByRole('link', { name: 'Random tables' })).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('player view', () => {
  test.use({ view: 'player' })

  test('the bottom bar (phone) or the sidebar and tabs (laptop) go to each part of the Common Room and The World', async ({ page, world, device }) => {
    const w = `/w/${world.slug}`
    await open(page, w)
    // On a phone the Common Room's tabs are the bottom bar; on a laptop, the tabs across the top.
    const room = device === 'phone' ? areas(page) : tabs(page, 'Common Room')
    await room.getByRole('link', { name: 'Me', exact: true }).click()
    await expect.poll(() => here(page)).toBe(`${w}?tab=me`)
    await room.getByRole('link', { name: /^Party/ }).click()
    await expect.poll(() => here(page)).toBe(`${w}?tab=party`)
    await room.getByRole('link', { name: /^Leads/ }).click()
    await expect.poll(() => here(page)).toBe(`${w}?tab=leads`)
    await page.goBack()
    await expect.poll(() => here(page)).toBe(`${w}?tab=party`)
    await areas(page).getByRole('link', { name: /World/ }).click()
    await expect.poll(() => here(page)).toBe(`${w}/maps`)
    await tabs(page, 'The World').getByRole('link', { name: 'Timeline' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/timeline`)
    if (device === 'phone') {
      await areas(page).getByRole('link', { name: 'Now' }).click()
    } else {
      // The Common Room remembers the tab you left it on; pressing it again goes to its first tab.
      await areas(page).getByRole('link', { name: 'Common Room' }).click()
      await expect.poll(() => here(page)).toBe(`${w}?tab=party`)
      await areas(page).getByRole('link', { name: 'Common Room' }).click()
    }
    await expect.poll(() => here(page)).toBe(w)
  })

  test('on a phone, Notes sits inside Me', async ({ page, world, device }) => {
    test.skip(device !== 'phone', 'the phone’s bottom bar')
    const w = `/w/${world.slug}`
    await open(page, `${w}?tab=me`)
    await tabs(page, 'Common Room').getByRole('link', { name: 'Notes' }).click()
    await expect.poll(() => here(page)).toBe(`${w}?tab=notes`)
    await expect(areas(page).getByRole('link', { name: 'Me', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('the More page offers no GM tools', async ({ page, world }) => {
    await open(page, `/w/${world.slug}/more`)
    await expect(page.getByRole('heading', { name: 'The world' })).toBeVisible()
    for (const gm of ['Soundboard', 'Generators', 'Corkboards', 'Files', 'The Archivist', 'World settings', 'Templates', 'Recently deleted'])
      await expect(page.getByRole('link', { name: new RegExp(`^${gm}`) })).toHaveCount(0)
  })
})
