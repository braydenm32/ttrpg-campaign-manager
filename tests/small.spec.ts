import type { Browser } from '@playwright/test'
import { expect, go, here, open, setView, test, type Device, type Page } from './fixtures'
import { checkScreen } from './lib/checks'
import { fakeCloud } from './lib/cloud'
import { makePlayerCopy, offline } from './lib/playerCopy'
import { patchRecord, putBack } from './lib/records'
import { PORT } from './lib/server'

/**
 * The last eight screens, on a laptop and a phone: the invite and wiki links, the wiki's front
 * page, Print, the players' TV screen, the scratchpad, "Not found" and players' Questions. Joined
 * players and wiki readers get a pretend player copy of the example world (tests/lib/playerCopy.ts),
 * with nothing GM-only in it, the way the server sends one. Each test puts back what it changed.
 * SHOTS_DIR=<folder> saves screenshots of these screens.
 */

async function shot(page: Page, name: string) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true })
}

/** Nothing new wrong: no error, no sideways scroll, and (on a phone) nothing too small to tap. */
async function tidy(page: Page, device: Device, notFound = false) {
  const found = await checkScreen(page, { phone: device === 'phone', notFound, errors: [] })
  expect(found.problems).toEqual([])
  if (device === 'phone') expect(found.smallExamples).toEqual([])
}

async function freshContext(browser: Browser, device: Device) {
  const phone = device === 'phone'
  const context = await browser.newContext({
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'block',
    viewport: phone ? { width: 390, height: 844 } : { width: 1366, height: 860 },
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
  })
  await context.route((url) => url.host !== `localhost:${PORT}`, (route) => route.abort())
  return context
}

test.describe('Not found', () => {
  for (const view of ['gm', 'player'] as const)
    test(`an address that goes nowhere says so, with a way home (${view === 'gm' ? 'GM' : 'player'})`, async ({ page, world, device }) => {
      await setView(page, world, view)
      const w = `/w/${world.slug}`
      for (const address of [`${w}/no-such-section`, `${w}/no/such/place`]) {
        await open(page, address)
        await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
        await expect(page.getByText('There’s nothing at this address')).toBeVisible()
        await tidy(page, device, true)
      }
      await shot(page, `notfound-${view}-${device}`)
      await page.getByRole('link', { name: view === 'gm' ? 'Back to the Desk' : 'Back to the Common Room' }).click()
      await expect.poll(() => here(page)).toBe(w)
    })
})

test.describe('Print', () => {
  test('the controls are fingertip-sized, the paper has no links, and Back from a fresh tab opens the page', async ({ page, world, device }) => {
    const ford = world.page('Ford Street')
    await open(page, `/w/${world.id}/print/e/${ford.id}`)
    await expect(page.locator('.print-sheet h1')).toHaveText('Ford Street')
    // Page names in the text are words on paper, not links into the app.
    await expect(page.locator('.print-sheet a')).toHaveCount(0)
    await expect(page.locator('.print-sheet .wikilink').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'GM copy' })).toHaveAttribute('aria-pressed', 'true')
    await tidy(page, device)
    await shot(page, `print-page-gm-${device}`)
    await page.getByRole('button', { name: 'Player copy' }).click()
    await expect(page.locator('.print-note')).toContainText('secrets, GM notes and hidden pages are left out')
    await shot(page, `print-page-players-${device}`)
    // Opened straight from its address, there's no step to go back to: Back opens the page itself.
    await page.getByRole('button', { name: 'Back' }).click()
    await expect.poll(() => here(page)).toBe(`/w/${world.slug}/p/${world.pageSlug('Ford Street')}`)
  })

  test('a GM-only session’s player copy says why it’s empty, with the way back', async ({ page, world, device }) => {
    await open(page, `/w/${world.id}/print/s/${world.session(1).id}?copy=players`)
    await expect(page.getByText('This session is GM only, so a player copy would be empty')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the world' })).toBeVisible()
    await tidy(page, device, true)
    await shot(page, `print-session-players-${device}`)
  })
})

test('the players’ TV screen: a calm waiting screen, then what the GM shows, with no links to wander off by', async ({ page, world, device }) => {
  await open(page, `/screen/${world.slug}`)
  await expect(page.getByRole('heading', { name: world.world.name })).toBeVisible()
  await expect(page.getByText('What your GM shows the table appears here')).toBeVisible()
  await shot(page, `tv-idle-${device}`)
  const before = await patchRecord(page, 'worlds', world.id, {
    showing: { id: 'sh', kind: 'text', title: 'A letter sealed in red wax', text: 'Meet me on [[Ford Street]] at moonrise. Come alone.', at: Date.now() },
  })
  try {
    await open(page, `/screen/${world.slug}`)
    await expect(page.getByRole('heading', { name: 'A letter sealed in red wax' })).toBeVisible()
    await expect(page.locator('.players-screen').getByText('Ford Street')).toBeVisible()
    await expect(page.locator('.players-screen a')).toHaveCount(0)
    await tidy(page, device)
    await shot(page, `tv-showing-${device}`)
  } finally {
    await putBack(page, 'worlds', [[world.id, before!]])
  }
})

test('the scratchpad without players says what it is for, and the GM’s way to invite them', async ({ page, world, device }) => {
  await open(page, `/w/${world.slug}/scratchpad`)
  await expect(page.getByRole('heading', { name: 'Scratchpad' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Players and sharing' })).toHaveAttribute('href', /settings\?tab=players/)
  await tidy(page, device)
  await shot(page, `scratchpad-gm-${device}`)
})

test.describe('invite and wiki links', () => {
  test('an invite link signed out: one clear way to sign in', async ({ page, device }) => {
    await open(page, '/join/test-token')
    await expect(page.getByRole('button', { name: 'Sign in or create an account' })).toBeVisible()
    await tidy(page, device)
    await shot(page, `join-signed-out-${device}`)
    await open(page, '/join/test-token?as=gm')
    await expect(page.getByRole('heading', { name: /co-GM a world/ })).toBeVisible()
    await tidy(page, device)
  })

  test('an invite link signed in: say what to call you, then join', async ({ browser, device }) => {
    const context = await freshContext(browser, device)
    try {
      await fakeCloud(context, { worldId: '', world_members: [], player_questions: [], downtime_actions: [], character_claims: [], character_requests: [], writes: [] })
      const page = await context.newPage()
      await page.goto('/join/test-token')
      await expect(page.getByLabel('What should the table call you?')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Join the world' })).toBeVisible()
      await tidy(page, device)
      await shot(page, `join-signed-in-${device}`)
    } finally {
      await context.close()
    }
  })

  test('a wiki link that can’t be opened says so, with Try again and the way to your worlds', async ({ page, device }) => {
    await open(page, '/shared/test-token')
    await expect(page.getByRole('heading', { name: 'Couldn’t open this wiki' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to your worlds' })).toBeVisible()
    await tidy(page, device)
    await shot(page, `shared-error-${device}`)
  })
})

test.describe('a joined player and a wiki reader (pretend player copies)', () => {
  // Screenshots of the long wiki page (SHOTS_DIR) can take a while to save.
  test.describe.configure({ timeout: 120_000 })

  test('a joined player’s Questions: ask, then what they asked with the answers', async ({ page, world, device }) => {
    await offline(page)
    await page.goto('/')
    const copy = await makePlayerCopy(page, world, 'member')
    try {
      await open(page, `/w/${copy.id}/questions`)
      await expect(page.getByRole('heading', { name: /Questions for your GM/ })).toBeVisible()
      await expect(page.getByPlaceholder('What do you want to ask your GM?')).toBeVisible()
      await expect(page.getByRole('heading', { name: /Your questions/ })).toContainText('1 waiting for an answer')
      await expect(page.getByText('Not yet. Ask around the docks.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Take it back' })).toBeVisible()
      await tidy(page, device)
      await shot(page, `questions-player-${device}`)
      await open(page, `/w/${copy.id}/no/such/place`)
      await expect(page.getByRole('link', { name: 'Back to the Common Room' })).toBeVisible()
    } finally {
      await copy.remove()
    }
  })

  test('the scratchpad saves what a player typed when they leave without clicking away', async ({ page, world, device }) => {
    await offline(page)
    const sent: { body: string; shared: boolean }[] = []
    await page.route('**/rest/v1/rpc/save_player_note', async (route) => {
      sent.push(route.request().postDataJSON())
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
    })
    await page.goto('/')
    const copy = await makePlayerCopy(page, world, 'member')
    try {
      await open(page, `/w/${copy.id}/scratchpad`)
      await expect(page.getByRole('heading', { name: /Scratchpad/ })).toBeVisible()
      await tidy(page, device)
      await shot(page, `scratchpad-player-${device}`)
      await page.getByPlaceholder('Anything you want to remember…').fill('Ask the fence about the red wax.')
      // Off to another screen inside the app, the box still focused.
      await go(page, `/w/${copy.id}?tab=party`)
      await expect.poll(() => sent.length).toBe(1)
      expect(sent[0]).toMatchObject({ body: 'Ask the fence about the red wax.', shared: false })
    } finally {
      await copy.remove()
    }
  })

  test('the wiki’s front page and its “Not found”', async ({ page, world, device }) => {
    await offline(page)
    await page.goto('/')
    const copy = await makePlayerCopy(page, world, 'wiki')
    try {
      await open(page, `/w/${copy.id}`)
      await expect(page.getByText('Public wiki · read only')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Browse' })).toBeVisible()
      await tidy(page, device)
      await shot(page, `wiki-home-${device}`)
      await page.getByRole('searchbox', { name: 'Search this world' }).fill('Ford')
      await expect(page.locator('.wiki-home .entity-list').first().getByRole('link').first()).toBeVisible()
      await tidy(page, device)
      await open(page, `/w/${copy.id}/no-such-section`)
      await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible()
      await page.getByRole('link', { name: 'Back to the front page' }).click()
      await expect.poll(() => here(page)).toMatch(/^\/w\/[^/]+$/)
    } finally {
      await copy.remove()
    }
  })
})
