import type { Browser } from '@playwright/test'
import { expect, here, open, setView, test, type Device, type Page } from './fixtures'
import { fakeCloud, putRows, type CloudState } from './lib/cloud'
import { getRecord, putBack, type Row } from './lib/records'
import { PORT } from './lib/server'

/**
 * Everything under More, on a laptop and a phone: the More page lists only what the viewer can
 * open; World settings' tabs are steps in Back; each quick remove on these screens comes back with
 * Undo; showing or giving something to players says first what they'll see; and turning off a
 * link or sync says what stops working before it happens (with a pretend cloud, tests/lib/cloud.ts).
 * Each test puts back what it changed. SHOTS_DIR=<folder> saves screenshots of these screens.
 */

const toast = (page: Page) => page.locator('.undo-toast')
const undo = (page: Page) => toast(page).locator('.undo-button')

async function shot(page: Page, name: string) {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true })
}

/** The GM tools, by their names on the More page. */
const GM_TOOLS = ['Soundboard', 'Generators', 'Random tables', 'Corkboards', 'Files', 'The Archivist', 'Templates', 'World settings', 'Players and sharing', 'Backups', 'Recently deleted']

test.describe('the More page', () => {
  test('the GM’s lists their tools in three groups, with counts, and Print is a note, not a button', async ({ page, world, device }) => {
    await open(page, `/w/${world.slug}/more`)
    for (const g of ['At the table', 'Workshop', 'Keeping the world']) await expect(page.getByRole('heading', { name: g })).toBeVisible()
    for (const t of GM_TOOLS) await expect(page.locator('.more-item', { has: page.locator('b', { hasText: new RegExp(`^${t}$`) }) })).toHaveCount(1)
    // The players' scratchpad needs players: not offered in a world without sync.
    await expect(page.getByRole('link', { name: /scratchpad/i })).toHaveCount(0)
    // Counts where they help: the corkboard, and the files with their size.
    await expect(page.locator('.more-item[data-id="boards"] .more-count')).toHaveText('1')
    await expect(page.locator('.more-item[data-id="assets"] .more-count')).toHaveText(/^\d+ · [\d.]+ (KB|MB|GB)$/)
    await expect(page.getByRole('link', { name: /Print/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Print/ })).toHaveCount(0)
    await expect(page.locator('.more-note')).toContainText('Every page and session has a Print button')
    await shot(page, `more-gm-${device}`)
  })

  test('a player’s lists no GM tool', async ({ page, world, device }) => {
    await setView(page, world, 'player')
    await open(page, `/w/${world.slug}/more`)
    await expect(page.getByRole('heading', { name: 'The world' })).toBeVisible()
    await expect(page.locator('.more-item[data-id="everything"]')).toBeVisible()
    for (const t of GM_TOOLS) await expect(page.locator('.more-item', { has: page.locator('b', { hasText: new RegExp(`^${t}$`) }) })).toHaveCount(0)
    await expect(page.locator('.more-count:not(.more-item[data-id="handouts"] .more-count)')).toHaveCount(0)
    await shot(page, `more-player-${device}`)
  })
})

test('World settings: each tab is a step in Back, and More’s items open their own part', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  await open(page, `${w}/settings`)
  await shot(page, `settings-world-${device}`)
  const tab = (name: string) => page.getByRole('tab', { name })
  await tab('Players and sharing').click()
  await expect.poll(() => here(page)).toBe(`${w}/settings?tab=players`)
  // Before signing in, it says how invites work.
  await expect(page.locator('.how-sharing')).toContainText('Invite your players')
  await shot(page, `settings-players-${device}`)
  await tab('This device').click()
  await expect.poll(() => here(page)).toBe(`${w}/settings?tab=device`)
  await shot(page, `settings-device-${device}`)
  await tab('Data and backups').click()
  await expect.poll(() => here(page)).toBe(`${w}/settings?tab=data`)
  await expect(page.locator('#settings-backup')).toContainText(/No backup downloaded from this device yet|Last backup from this device/)
  await shot(page, `settings-data-${device}`)
  await page.goBack()
  await expect.poll(() => here(page)).toBe(`${w}/settings?tab=device`)
  await expect(tab('This device')).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await page.goBack()
  await expect.poll(() => here(page)).toBe(`${w}/settings`)
  await expect(tab('World')).toHaveAttribute('aria-selected', 'true')

  // Recently deleted on the More page opens the Data tab at the bin.
  await open(page, `${w}/more`)
  await page.locator('.more-item[data-id="deleted"]').click()
  await expect.poll(() => here(page)).toBe(`${w}/settings?tab=data&at=deleted`)
  await expect(page.getByRole('heading', { name: /Recently deleted/ })).toBeInViewport()
})

test.describe('Undo on the More area’s quick removes', () => {
  test.beforeEach(({ device }) => test.skip(device === 'phone', 'the same on a phone'))

  test('a safety line comes back', async ({ page, world }) => {
    const before = await (async () => (await open(page, `/w/${world.slug}/safety`), getRecord(page, 'worlds', world.id)))()
    try {
      await page.getByPlaceholder('e.g. Harm to children').fill('Spiders, close up')
      await page.getByPlaceholder('e.g. Harm to children').press('Enter')
      const line = page.locator('.safety-list li', { hasText: 'Spiders, close up' })
      await expect(line).toBeVisible()
      await line.getByRole('button', { name: 'Remove Spiders, close up' }).click()
      await expect(line).toHaveCount(0)
      await expect(toast(page)).toContainText('Line “Spiders, close up” removed')
      await undo(page).click()
      await expect(line).toBeVisible()
    } finally {
      await putBack(page, 'worlds', [[world.id, before]])
    }
  })

  test('a holiday, and a page type, come back', async ({ page, world }) => {
    const before = await (async () => (await open(page, `/w/${world.slug}/settings`), getRecord(page, 'worlds', world.id)))()
    try {
      const holidays = (before!.calendar as { holidays: { name: string }[] }).holidays
      const first = holidays[0].name
      await page.locator('summary', { hasText: 'Holidays' }).click()
      await page.getByRole('button', { name: `Remove ${first}`, exact: true }).click()
      await expect(page.locator('summary', { hasText: 'Holidays' })).toContainText(`(${holidays.length - 1})`)
      await expect(toast(page)).toContainText(`Holiday “${first}” removed`)
      await undo(page).click()
      await expect(page.locator('summary', { hasText: 'Holidays' })).toContainText(`(${holidays.length})`)
      expect(((await getRecord(page, 'worlds', world.id))!.calendar as { holidays: { name: string }[] }).holidays[0].name).toBe(first)

      await page.getByPlaceholder('Name, e.g. Ship').fill('Airship')
      await page.getByRole('button', { name: '+ Add type' }).click()
      const remove = page.getByRole('button', { name: 'Remove the type Airships' })
      await remove.click()
      await expect(remove).toHaveCount(0)
      await expect(toast(page)).toContainText('Page type “Airships” removed')
      await undo(page).click()
      await expect(remove).toBeVisible()
    } finally {
      await putBack(page, 'worlds', [[world.id, before]])
    }
  })

  test('a card taken off a corkboard, and a cut string, come back', async ({ page, world }) => {
    const id = world.dump.boards[0].id
    await open(page, `/w/${world.slug}/boards/${id}`)
    const before = await getRecord(page, 'boards', id)
    try {
      const cards = page.locator('.board-card')
      const strings = page.locator('.board-string')
      const n = await cards.count()
      const s = await strings.count()
      // Its tools show on hover.
      await cards.first().hover()
      await cards.first().getByRole('button', { name: 'Take off the board' }).click()
      await expect(cards).toHaveCount(n - 1)
      await expect(toast(page)).toContainText('taken off the board')
      await undo(page).click()
      await expect(cards).toHaveCount(n)
      await expect(strings).toHaveCount(s)

      await strings.first().locator('.hit').dispatchEvent('click')
      await page.getByRole('button', { name: 'Cut string' }).click()
      await expect(strings).toHaveCount(s - 1)
      await undo(page).click()
      await expect(strings).toHaveCount(s)
    } finally {
      await putBack(page, 'boards', [[id, before]])
    }
  })

  test('an AI key and the Syrinscape token come back', async ({ page, world }) => {
    await open(page, `/w/${world.slug}/settings?tab=device`)
    const key = page.getByPlaceholder('sk-ant-…')
    try {
      await key.fill('sk-ant-test-key')
      await key.locator('xpath=..').getByRole('button', { name: 'Remove' }).click()
      await expect(key).toHaveValue('')
      await expect(toast(page)).toContainText('the Archivist')
      await undo(page).click()
      await expect(key).toHaveValue('sk-ant-test-key')
    } finally {
      await key.fill('')
    }

    await open(page, `/w/${world.slug}/sounds`)
    await page.locator('summary', { hasText: 'Syrinscape' }).click()
    await page.getByPlaceholder('Syrinscape auth token').fill('test-token')
    await page.getByRole('button', { name: 'Save token' }).click()
    await page.getByRole('button', { name: 'Remove it' }).click()
    await expect(page.getByPlaceholder('Syrinscape auth token')).toBeVisible()
    await undo(page).click()
    await expect(page.getByText('Your Syrinscape token is saved on this device')).toBeVisible()
    await page.getByRole('button', { name: 'Remove it' }).click()
  })
})

test.describe('before players see something', () => {
  test('a handout is revealed and shown only after saying what players will see, and Undo hides it again', async ({ page, world, device }) => {
    await open(page, `/w/${world.slug}/handouts`)
    const first = page.locator('.handout-list li', { has: page.getByRole('button', { name: 'Reveal and show…' }) }).first()
    const name = (await first.locator('strong').first().textContent())!.trim()
    const card = page.locator('.handout-list li', { has: page.locator('strong', { hasText: name }) }).first()
    const handout = world.dump.entities.find((e) => e.name === name)!
    const before = await getRecord(page, 'worlds', world.id)
    const pageBefore = await getRecord(page, 'entities', handout.id)
    try {
      await card.getByRole('button', { name: 'Reveal and show…' }).click()
      const review = card.locator('.players-review')
      await expect(review).toContainText('Players will see')
      await expect(review).toContainText(`the page “${name}”`)
      await shot(page, `handouts-review-${device}`)
      // Not yet: nothing happened.
      await review.getByRole('button', { name: 'Not yet' }).click()
      expect((await getRecord(page, 'entities', handout.id))!.visibility).toBe('gm')

      await card.getByRole('button', { name: 'Reveal and show…' }).click()
      await card.locator('.players-review').getByRole('button', { name: 'Reveal and show' }).click()
      await expect.poll(async () => (await getRecord(page, 'entities', handout.id))!.visibility).toBe('players')
      await expect(toast(page)).toContainText(`“${name}” is revealed`)
      await toast(page).getByRole('button', { name: 'Hide it again' }).click()
      await expect.poll(async () => (await getRecord(page, 'entities', handout.id))!.visibility).toBe('gm')
      const after = await getRecord(page, 'worlds', world.id)
      expect(after!.handouts ?? []).toEqual(before!.handouts ?? [])
      expect(after!.showing ?? null).toEqual(before!.showing ?? null)
      await shot(page, `handouts-${device}`)
    } finally {
      await putBack(page, 'worlds', [[world.id, before]])
      await putBack(page, 'entities', [[handout.id, pageBefore]])
    }
  })

  test('Generators open on the world’s own tables; treasure is given after a review, and Undo takes it back', async ({ page, world, device }) => {
    await open(page, `/w/${world.slug}/generators`)
    const tables = await page.getByRole('heading', { name: /Your tables/ }).boundingBox()
    const roll = await page.getByRole('heading', { name: 'Roll something new' }).boundingBox()
    expect(tables!.y).toBeLessThan(roll!.y)
    await expect(page.locator('.table-roller')).toBeVisible()
    await shot(page, `generators-${device}`)
    test.skip(device === 'phone', 'the gift is the same on a phone')

    const before = await getRecord(page, 'worlds', world.id)
    const treasure = page.locator('.treasure-generator')
    const countTreasure = () =>
      page.evaluate(
        (wid) =>
          new Promise<number>((resolve) => {
            const req = indexedDB.open('ttrpg-campaign-manager')
            req.onsuccess = () => {
              const all = req.result.transaction('entities').objectStore('entities').getAll()
              all.onsuccess = () => resolve(all.result.filter((e: Row & { worldId: string; tags: string[] }) => e.worldId === wid && e.tags?.includes('treasure')).length)
            }
          }),
        world.id,
      )
    const had = await countTreasure()
    try {
      await treasure.getByRole('button', { name: 'Give to the party…' }).click()
      await expect(treasure.locator('.players-review')).toContainText('Players will see')
      await treasure.getByRole('button', { name: 'Give it to them' }).click()
      await expect(toast(page)).toContainText('players can see it now')
      await expect.poll(countTreasure).toBeGreaterThan(had)
      await undo(page).click()
      await expect.poll(countTreasure).toBe(had)
      await expect.poll(async () => (await getRecord(page, 'worlds', world.id))!.partyCoin).toEqual(before!.partyCoin)
    } finally {
      await putBack(page, 'worlds', [[world.id, before]])
    }
  })
})

test.describe('screenshots of the rest', () => {
  test.skip(!process.env.SHOTS_DIR, 'only when saving screenshots')
  for (const [name, path] of [
    ['safety', 'safety'],
    ['files', 'assets'],
    ['sounds', 'sounds'],
    ['boards', 'boards'],
    ['corkboard', 'boards/{board}'],
    ['archivist', 'archivist'],
  ])
    test(name, async ({ page, world, device }) => {
      await open(page, `/w/${world.slug}/${path.replace('{board}', world.dump.boards[0].id)}`)
      await shot(page, `${name}-${device}`)
    })
})

/** A fresh browser profile at the test's screen size, refusing anything but the test server. */
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

test('turning off a link or sync first says what stops working (a pretend cloud)', async ({ browser, device }) => {
  test.skip(device === 'phone', 'the same on a phone')
  test.setTimeout(120_000)
  const context = await freshContext(browser, device)
  try {
    const state: CloudState = {
      worldId: '',
      world_members: [],
      player_questions: [],
      downtime_actions: [],
      character_claims: [],
      character_requests: [],
      writes: [],
      links: { share_token: 'wiki-token', invite_token: 'invite-token' },
      gm_invites: [],
    }
    await fakeCloud(context, state)
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: /New world/ }).click()
    await page.getByLabel('Name').fill('The Lantern Road')
    await page.getByRole('button', { name: 'Create world' }).click()
    await page.waitForURL(/\/w\/[^/]+/)
    const worldRow = await page.evaluate(
      () =>
        new Promise<Record<string, unknown>>((resolve) => {
          const req = indexedDB.open('ttrpg-campaign-manager')
          req.onsuccess = () => {
            const get = req.result.transaction('worlds').objectStore('worlds').getAll()
            get.onsuccess = () => resolve(get.result[0])
          }
        }),
    )
    state.worldId = worldRow.id as string
    state.gm_invites!.push({ world_id: state.worldId, token: 'co-gm-token' })
    await putRows(page, 'worlds', [{ ...worldRow, cloud: { enabled: true } }])
    const w = here(page).split('?')[0]
    await open(page, `${w}/settings?tab=players`)
    await expect(page.getByText('Sync is on.')).toBeVisible()

    // Each asks first, saying what stops working; saying no changes nothing.
    const asked: string[] = []
    let answer = false
    page.on('dialog', (d) => {
      asked.push(d.message())
      void (answer ? d.accept() : d.dismiss())
    })
    for (const [button, words] of [
      ['Turn off link', 'can’t be undone'],
      ['Turn off invites', 'Players who already joined stay in'],
      ['Turn off co-GM link', 'can’t be undone'],
      ['Stop syncing on this device', 'stop reaching the cloud'],
    ]) {
      await page.getByRole('button', { name: button, exact: true }).click()
      await expect.poll(() => asked.at(-1) ?? '').toContain(words)
    }
    expect(asked).toHaveLength(4)
    expect(state.writes.filter((x) => x.startsWith('DELETE gm_invites'))).toEqual([])
    expect(state.links).toMatchObject({ share_token: 'wiki-token', invite_token: 'invite-token' })
    await expect(page.getByText('Sync is on.')).toBeVisible()

    // Yes turns the invite link off.
    answer = true
    await page.getByRole('button', { name: 'Turn off invites', exact: true }).click()
    await expect.poll(() => state.links!.invite_token).toBeNull()
    await expect(page.getByRole('button', { name: 'Create invite link' })).toBeVisible()
  } finally {
    await context.close()
  }
})
