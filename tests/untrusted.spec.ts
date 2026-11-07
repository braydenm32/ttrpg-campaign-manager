import { expect, test, type Page } from '@playwright/test'
import { fakeCloud, GM, putRows, type CloudState } from './lib/cloud'
import { PORT } from './lib/server'

/**
 * Data from outside this device can't run a script or lock the GM out of a world: a backup someone
 * else made, or rows another device (a co-GM's, say) put in the cloud. On a laptop. Each test makes
 * small worlds of its own, straight in the browser's database, so the example world isn't needed.
 */

/** A piece id crafted to break out of the map builder's markup (from the security audit). */
const evil = (n = 1) => `x" class="hit-area"/><image href="x:" onerror="alert(${n})"/><path d="`
/** What a piece id is allowed to look like once it has come in from outside. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/
const now = Date.now()
const worldRow = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, description: '', system: 'System agnostic', createdAt: now, updatedAt: now, ...extra })
const pageRow = (id: string, worldId: string, name: string) => ({
  id,
  worldId,
  type: 'location',
  name,
  summary: '',
  body: '',
  gmNotes: '',
  visibility: 'gm',
  tags: [],
  fields: [],
  createdAt: now,
  updatedAt: now,
})

/** A battle map whose line, label, stamp, rooms and ground stroke all have crafted ids. */
const battleDrawing = () => ({
  background: 'stone',
  grid: 'square',
  gridSize: 70,
  style: 'classic',
  scene: 'battle',
  look: 'colour',
  biome: 'temperate',
  shadows: true,
  frame: false,
  seed: 7,
  groundBase: 'grass',
  outside: 'rock',
  shapes: [
    { id: evil(1), kind: 'line', style: 'wall', points: [[100, 100], [400, 100]], smooth: false },
    { id: evil(2), kind: 'label', text: 'The trap', at: [700, 700], size: 30, color: '#000000', italic: false, font: 'place' },
    { id: evil(3), kind: 'stamp', stamp: 'chest', at: [900, 300], size: 40 },
  ],
  rooms: [
    { id: evil(4), mode: 'dig', shape: 'rect', points: [[200, 200], [600, 500]] },
    { id: evil(5), mode: 'dig', shape: 'corridor', points: [[600, 350], [1000, 350]], size: 70 },
    { id: evil(6), mode: 'dig', shape: 'round', points: [[1000, 600], [1300, 900]] },
  ],
  ground: [{ id: evil(7), ground: 'dirt', size: 50, points: [[300, 300], [350, 350]] }],
})
/** A side-on world map with a crafted id on a painted area and a land stroke. */
const regionDrawing = () => ({
  background: 'sea',
  grid: 'none',
  gridSize: 70,
  style: 'classic',
  look: 'parchment',
  biome: 'temperate',
  shadows: true,
  frame: true,
  seed: 9,
  shapes: [{ id: evil(8), kind: 'area', terrain: 'forest', points: [[200, 200], [500, 200], [500, 500], [200, 500]], smooth: false }],
  land: [{ id: evil(9), mode: 'land', size: 60, points: [[600, 600], [800, 700]] }],
})
const mapRow = (id: string, worldId: string, name: string, drawing: unknown) => ({ id, worldId, name, imageId: crypto.randomUUID(), width: 1400, height: 1050, visibility: 'gm', drawing, createdAt: now })

/** Every row of a table (files without their contents). */
function rows(page: Page, table: string) {
  return page.evaluate(
    (table) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const all = idb.transaction(table, 'readonly').objectStore(table).getAll()
          all.onsuccess = () => {
            idb.close()
            resolve((all.result as Record<string, unknown>[]).map(({ blob: _blob, ...r }) => r))
          }
          all.onerror = () => reject(all.error)
        }
      }),
    table,
  )
}

/** Opens the worlds page, and waits until the app has made its database. */
async function home(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Vael Ardith/ }).first()).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(async () => ((await indexedDB.databases()).find((d) => d.name === 'ttrpg-campaign-manager')?.version ?? 0) > 1)
}

/** The ids in the builder's click targets, and anything that isn't a plain click target. */
async function hitLayer(page: Page) {
  const svg = page.locator('svg.builder-canvas')
  await expect(svg).toBeVisible({ timeout: 30_000 })
  await expect(svg.locator('[data-id]').first()).toBeAttached()
  return svg.evaluate((el) => ({
    ids: [...el.querySelectorAll('[data-id]')].map((e) => e.getAttribute('data-id')!),
    injected: [...el.querySelectorAll('image, script, foreignObject, [onerror], [onload]')].map((e) => e.outerHTML),
  }))
}

test.beforeEach(async ({ context }) => {
  // Nothing leaves the machine (the pretend cloud, where a test uses one, answers for the cloud).
  await context.route((url) => url.host !== `localhost:${PORT}`, (route) => route.abort())
})

test('a map drawing with crafted piece ids never runs a script in the builder, and its pieces can still be picked', async ({ page }) => {
  test.setTimeout(120_000)
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.dismiss()
  })
  const W = crypto.randomUUID()
  const [battle, region] = [crypto.randomUUID(), crypto.randomUUID()]
  await home(page)
  // As if it had come in before the app checked (an old import, say): straight into the database.
  await putRows(page, 'worlds', [worldRow(W, 'Crafted Map Test')])
  await putRows(page, 'maps', [mapRow(battle, W, 'Trap dungeon', battleDrawing()), mapRow(region, W, 'Trap coast', regionDrawing())])

  await page.goto(`/w/${W}/maps/${battle}/draw`)
  let layer = await hitLayer(page)
  expect(layer.injected).toEqual([])
  // The ids are written out safely, not dropped: each click target still carries its piece's own id.
  expect(layer.ids.sort()).toEqual([1, 2, 3, 4, 5, 6, 7].map(evil).sort())

  // Picking the wall by its line still works, and lights it up.
  await page.keyboard.press('Escape')
  const at = await page.locator('svg.builder-canvas').evaluate((svg: SVGSVGElement) => {
    const pt = svg.createSVGPoint()
    pt.x = 250
    pt.y = 100
    const s = pt.matrixTransform(svg.getScreenCTM()!)
    return { x: s.x, y: s.y }
  })
  await page.mouse.click(at.x, at.y)
  await expect
    .poll(() => page.locator('svg.builder-canvas path.hit-line').evaluate((el) => getComputedStyle(el).stroke))
    .toBe('rgb(255, 211, 107)')

  await page.goto(`/w/${W}/maps/${region}/draw`)
  layer = await hitLayer(page)
  expect(layer.injected).toEqual([])
  expect(layer.ids.sort()).toEqual([8, 9].map(evil).sort())

  await page.waitForTimeout(1000)
  expect(dialogs).toEqual([])
})

test('a crafted backup comes in safe: piece ids are replaced, and a calendar with no months is dropped', async ({ page }) => {
  test.setTimeout(120_000)
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.dismiss()
  })
  const W = crypto.randomUUID()
  const map = crypto.randomUUID()
  const backup = {
    format: 'campaign-codex-world',
    version: 1,
    exportedAt: new Date().toISOString(),
    // The audit's calendar: today's date, but no months to read it with.
    world: worldRow(W, 'Free Dungeon Pack', { calendar: { today: { year: 1, month: 0, day: 1 } } }),
    campaigns: [],
    entities: [],
    maps: [mapRow(map, W, 'Trap dungeon', battleDrawing())],
    pins: [],
    sessions: [],
    assets: [],
  }
  await home(page)
  const had = new Set((await rows(page, 'worlds')).map((w) => w.id))
  await page.locator('input[type=file]').first().setInputFiles({ name: 'free-dungeon-pack.codex.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await page.waitForURL(/\/w\/[^/]+/)
  const made = (await rows(page, 'worlds')).find((w) => !had.has(w.id))!
  try {
    expect(made.calendar).toBeUndefined()
    // The world opens: its frame and the Desk, not "Something went wrong".
    await expect(page.locator('header.topbar')).toBeVisible()
    await expect(page.getByText('Something went wrong')).toHaveCount(0)

    const drawn = (await rows(page, 'maps')).find((m) => m.worldId === made.id)! as { id: string; drawing: { shapes: { id: string }[]; rooms: { id: string }[]; ground: { id: string }[] } }
    const ids = [...drawn.drawing.shapes, ...drawn.drawing.rooms, ...drawn.drawing.ground].map((x) => x.id)
    expect(ids).toHaveLength(7)
    for (const id of ids) expect(id).toMatch(SAFE_ID)
    expect(new Set(ids).size).toBe(7)

    await page.goto(`/w/${made.id}/maps/${drawn.id}/draw`)
    const layer = await hitLayer(page)
    expect(layer.injected).toEqual([])
    expect(layer.ids.sort()).toEqual([...ids].sort())
    await page.waitForTimeout(1000)
    expect(dialogs).toEqual([])
  } finally {
    await removeWorld(page, String(made.id))
  }
})

test('a world whose calendar is the wrong shape still opens, shows what it can of its date, and its calendar can be fixed', async ({ page }) => {
  const [monthless, odd] = [crypto.randomUUID(), crypto.randomUUID()]
  await home(page)
  // As if they had come in before the app checked: straight into the database. The audit's calendar
  // (today's date, but no months to read it with), and one with a gap in its months, no day names,
  // and an era and moons that aren't a word or a list.
  await putRows(page, 'worlds', [
    worldRow(monthless, 'Monthless Calendar Test', { calendar: { today: { year: 1, month: 0, day: 1 } } }),
    worldRow(odd, 'Odd Calendar Test', { calendar: { months: [{ name: 'Rain', days: 30 }, null], era: {}, moons: 'none', today: { year: 3, month: 0, day: 2 } } }),
  ])
  try {
    await page.goto(`/w/${monthless}`)
    await expect(page.locator('header.topbar')).toBeVisible()
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
    await expect(page.locator('header.topbar .world-date')).toHaveCount(0)

    await page.goto(`/w/${odd}`)
    await expect(page.locator('header.topbar .world-date')).toHaveText('2 Rain 3')
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
    await page.goto(`/w/${odd}/settings`)
    await expect(page.getByRole('heading', { name: /Calendar/ })).toBeVisible()
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
  } finally {
    await removeWorld(page, monthless)
    await removeWorld(page, odd)
  }
})

test('a world that crashes the app still leaves a way back to your worlds', async ({ page }) => {
  const W = crypto.randomUUID()
  await home(page)
  // A page whose links aren't a list: the world's frame (which looks through them) can't be built.
  await putRows(page, 'worlds', [worldRow(W, 'Broken Frame Test')])
  await putRows(page, 'entities', [{ ...pageRow(crypto.randomUUID(), W, 'Broken page'), relations: 7 }])
  try {
    await page.goto(`/w/${W}`)
    await expect(page.getByRole('heading', { name: /Something went wrong/ })).toBeVisible()
    const out = page.getByRole('link', { name: 'Go to your worlds' })
    await expect(out).toBeVisible()
    await out.click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: /Broken Frame Test/ })).toBeVisible()
  } finally {
    await removeWorld(page, W)
  }
})

test('a pull from the cloud skips rows that claim to be another row or another world’s, and cleans what it keeps', async ({ page, context }) => {
  test.setTimeout(120_000)
  const A = crypto.randomUUID()
  const B = crypto.randomUUID()
  const [ownPage, otherPage, good, stray, map, file] = Array.from({ length: 6 }, () => crypto.randomUUID())
  const state: CloudState = { worldId: A, world_members: [], player_questions: [], downtime_actions: [], character_claims: [], character_requests: [], writes: [] }
  await fakeCloud(context, state)
  const at = new Date().toISOString()
  const rec = (table: string, id: string, data: Record<string, unknown> | null) => ({ world_id: A, table_name: table, id, data, deleted: !data, updated_at: at })
  // What a co-GM of world A could put in A's cloud copy, aimed at world B on this device.
  const records = [
    // Claims to be one of B's pages: written as it is, it would land in B.
    rec('entities', stray, pageRow(otherPage, B, 'Planted in B')),
    // The right id, but B's own page: it would move into A.
    rec('entities', otherPage, pageRow(otherPage, A, 'Moved out of B')),
    // A world row of A that is really B (it would replace B and switch its sync off), and one for B itself.
    rec('worlds', A, worldRow(B, 'Replaced B')),
    rec('worlds', B, worldRow(B, 'Replaced B again')),
    // A deletion aimed at B's page.
    rec('entities', ownPage, null),
    // A file row that says it's another file.
    rec('assets', file, { id: crypto.randomUUID(), worldId: A, name: 'x.png', mime: 'image/png', size: 2, tags: [], visibility: 'gm', createdAt: now, updatedAt: now }),
    // An ordinary new page, which comes in as usual.
    rec('entities', good, pageRow(good, A, 'An ordinary page')),
    // A map whose pieces have crafted ids, which come in replaced.
    rec('maps', map, mapRow(map, A, 'Synced trap', battleDrawing())),
  ]
  await context.route(/\/rest\/v1\/records/, (route) => {
    const req = route.request()
    if (req.method() !== 'GET') return route.fallback()
    const q = new URL(req.url()).searchParams
    const eq = (k: string) => q.get(k)?.replace(/^eq\./, '')
    const out = records.filter((r) => (!eq('world_id') || r.world_id === eq('world_id')) && (!eq('table_name') || r.table_name === eq('table_name')))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) })
  })
  const warnings: string[] = []
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()))

  await home(page)
  await putRows(page, 'worlds', [worldRow(A, 'Synced World A', { cloud: { enabled: true, by: GM.id } }), worldRow(B, 'World B')])
  await putRows(page, 'entities', [pageRow(ownPage, B, 'B’s own page'), pageRow(otherPage, B, 'B’s other page')])
  try {
    // Opening the app starts a sync of world A.
    await page.goto(`/w/${A}`)
    await expect.poll(async () => (await rows(page, 'entities')).some((e) => e.id === good), { timeout: 30_000 }).toBe(true)

    const pages = await rows(page, 'entities')
    const byId = new Map(pages.map((e) => [e.id, e]))
    expect(byId.get(good)).toMatchObject({ worldId: A, name: 'An ordinary page' })
    expect(byId.get(ownPage)).toMatchObject({ worldId: B, name: 'B’s own page' })
    expect(byId.get(otherPage)).toMatchObject({ worldId: B, name: 'B’s other page' })
    expect(pages.filter((e) => e.name === 'Planted in B' || e.name === 'Moved out of B')).toEqual([])
    const worlds = new Map((await rows(page, 'worlds')).map((w) => [w.id, w]))
    expect(worlds.get(A)).toMatchObject({ name: 'Synced World A', cloud: { enabled: true } })
    expect(worlds.get(B)).toMatchObject({ name: 'World B' })
    expect((await rows(page, 'assets')).filter((a) => a.worldId === A)).toEqual([])

    const drawn = (await rows(page, 'maps')).find((m) => m.id === map) as { drawing: { shapes: { id: string }[]; rooms: { id: string }[]; ground: { id: string }[] } } | undefined
    expect(drawn).toBeTruthy()
    for (const x of [...drawn!.drawing.shapes, ...drawn!.drawing.rooms, ...drawn!.drawing.ground]) expect(x.id).toMatch(SAFE_ID)
    expect(warnings.filter((w) => /another world|isn’t the row|another row/i.test(w)).length).toBeGreaterThanOrEqual(6)
  } finally {
    await removeWorld(page, A)
    await removeWorld(page, B)
  }
})

/** Deletes a world and every row of it. */
function removeWorld(page: Page, worldId: string) {
  return page.evaluate(
    (worldId) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tables = ['worlds', 'campaigns', 'entities', 'maps', 'pins', 'sessions', 'assets', 'boards', 'sounds', 'history', 'syncMeta']
          const tx = idb.transaction(tables, 'readwrite')
          for (const t of tables) {
            const all = tx.objectStore(t).getAll()
            all.onsuccess = () => {
              for (const r of all.result as { id?: string; key?: string; worldId?: string }[])
                if ((t === 'worlds' ? r.id : r.worldId) === worldId) tx.objectStore(t).delete((t === 'syncMeta' ? r.key : r.id)!)
            }
          }
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    worldId,
  )
}
