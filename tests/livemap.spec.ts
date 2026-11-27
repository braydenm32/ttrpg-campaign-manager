import { expect, open, test, type Page } from './fixtures'
import { offline } from './lib/playerCopy'
import { fakeRealtime } from './lib/realtime'
import { getRecord, patchRecord, putBack, type Row } from './lib/records'
import type { World } from './lib/world'

/**
 * Maps shown to players, and the players' screen (a TV):
 *  - "Show players" on a map puts up the players' copy of it (the fog painted on), never the GM's
 *    picture, and the players' screen draws only the pins players may see that aren't under the fog;
 *  - while it's up, fog cleared on the map goes out as a small piece cut from that copy (with the
 *    pins players may see), in the GM's room only, and a player's app lays it over the picture
 *    without the GM pressing Show again; a "map" said in the room every player can post in is ignored;
 *  - the players' screen shows the turn order as players' phones do (a fighter made from a GM-only
 *    page is "Enemy 1") and the timers the GM hasn't hidden, and nothing once they're over;
 *  - "Print" on a map offers the GM copy or the player copy, and the player copy is the fogged one.
 * The live rooms are pretend (lib/realtime.ts): nothing leaves the machine. Each test puts back what it changed.
 */

test.skip(({ device }) => device !== 'laptop', 'the same on a phone')

const MAP = 'The Ashenreach'

interface PinRow extends Row {
  mapId: string
  label: string
  visibility: string
  kind: string
  position?: [number, number]
  number?: number
}
interface MapRow extends Row {
  name: string
  width: number
  height: number
  imageId: string
  fog?: { on: boolean; imageId?: string; shapes: { id: string; mode: string; points: [number, number][] }[] }
}

/** The map's pins by what a player should see once only `box` (map units: [bottom, left, top, right]) is uncovered. */
function sortPins(world: World, mapId: string) {
  const pins = (world.dump.pins as unknown as PinRow[]).filter((p) => p.mapId === mapId && p.kind === 'point' && p.position && p.label)
  const secret = pins.find((p) => p.visibility === 'gm')
  if (!secret) throw new Error('The example map has no GM-only pin to test with')
  const [sy, sx] = secret.position!
  const box: [number, number, number, number] = [sy - 260, sx - 380, sy + 260, sx + 380]
  const inside = (p: PinRow) => p.position![0] > box[0] && p.position![0] < box[2] && p.position![1] > box[1] && p.position![1] < box[3]
  const shown = pins.filter((p) => p.visibility === 'players' && inside(p)).map((p) => p.label)
  const not = (labels: string[]) => [...new Set(labels)].filter((l) => !shown.includes(l))
  return {
    box,
    /** Uncovered and for players: drawn. */
    shown: [...new Set(shown)],
    /** For players, but still under the fog. */
    fogged: not(pins.filter((p) => p.visibility === 'players' && !inside(p)).map((p) => p.label)),
    /** GM only (one of them sits in the uncovered part). */
    gmOnly: not(pins.filter((p) => p.visibility === 'gm').map((p) => p.label)),
    numbered: pins.filter((p) => p.number),
  }
}

/** Turns the fog on with one box uncovered (written straight to the database: open the map after). */
async function fogWith(page: Page, mapId: string, box: [number, number, number, number], more: Record<string, unknown> = {}) {
  const [y0, x0, y1, x1] = box
  return (await patchRecord(page, 'maps', mapId, {
    fog: { on: true, shapes: [{ id: 'test-box', mode: 'reveal', points: [[y0, x0], [y0, x1], [y1, x1], [y1, x0]] }] },
    ...more,
  })) as MapRow
}

/** How light a picture is round a spot (fractions of it, from the top left): 0 black to 255 white. `from` is a stored picture's id, or an <img> on the page. */
function lightness(page: Page, from: { asset: string } | { img: string }, fx: number, fy: number) {
  return page.evaluate(
    async ({ from, fx, fy }) => {
      let source: CanvasImageSource & { width: number; height: number }
      if ('asset' in from) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          const req = indexedDB.open('ttrpg-campaign-manager')
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const get = req.result.transaction('assets', 'readonly').objectStore('assets').get(from.asset)
            get.onsuccess = () => {
              req.result.close()
              resolve(get.result.blob)
            }
            get.onerror = () => reject(get.error)
          }
        })
        source = await createImageBitmap(blob)
      } else {
        const el = document.querySelector<HTMLImageElement>(from.img)!
        await el.decode()
        source = await createImageBitmap(el)
      }
      const canvas = document.createElement('canvas')
      canvas.width = source.width
      canvas.height = source.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(source, 0, 0)
      const size = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.02))
      const x = Math.min(canvas.width - size, Math.max(0, Math.round(fx * canvas.width - size / 2)))
      const y = Math.min(canvas.height - size, Math.max(0, Math.round(fy * canvas.height - size / 2)))
      const d = ctx.getImageData(x, y, size, size).data
      let sum = 0
      for (let i = 0; i < d.length; i += 4) sum += Math.max(d[i], d[i + 1], d[i + 2])
      return sum / (d.length / 4)
    },
    { from, fx, fy },
  )
}

/** Fog is nearly black; the map's paper is not. */
const DARK = 45

/** Puts the world and the map back as they were, and removes the fogged copy the test had made. */
async function tidy(page: Page, world: World, wasWorld: Row, wasMap: MapRow) {
  // Away from the world first, so the app isn't still writing to it.
  await open(page, '/')
  const made = ((await getRecord(page, 'maps', wasMap.id)) as MapRow | undefined)?.fog?.imageId
  await putBack(page, 'maps', [[wasMap.id, wasMap]])
  await putBack(page, 'worlds', [[world.id, wasWorld]])
  if (made && made !== wasMap.fog?.imageId) await putBack(page, 'assets', [[made, null]])
}

test('Show players on a map puts up the players’ copy: the fog stays on it, and the players’ screen leaves out GM-only pins and pins under the fog', async ({ page, world }) => {
  const map = world.map(MAP) as unknown as MapRow
  const pins = sortPins(world, map.id)
  expect(pins.shown.length, 'a pin players should see').toBeGreaterThan(0)
  expect(pins.fogged.length, 'a pin under the fog').toBeGreaterThan(0)
  expect(pins.gmOnly.length, 'a GM-only pin').toBeGreaterThan(0)
  await open(page, '/')
  const wasWorld = (await getRecord(page, 'worlds', world.id))!
  const wasMap = await fogWith(page, map.id, pins.box)
  try {
    await open(page, `/w/${world.slug}/maps/${map.id}`)
    await page.locator('.map-tools').getByRole('button', { name: 'Show players' }).click()
    await expect(page.locator('.undo-toast')).toContainText(`“${MAP}” is on the players’ screens. It stays live`)
    await expect(page.locator('.map-live-chip')).toContainText('On players’ screens')
    await expect(page.getByText(`${MAP} (live map)`).first()).toBeVisible()

    // What's up is the fogged copy, not the GM's own picture.
    const now = (await getRecord(page, 'maps', map.id)) as MapRow
    const showing = (await getRecord(page, 'worlds', world.id))!.showing as { assetId: string; mapId: string; kind: string }
    expect(now.fog?.imageId).toBeTruthy()
    expect(showing).toMatchObject({ kind: 'image', mapId: map.id, assetId: now.fog!.imageId })
    expect(showing.assetId).not.toBe(now.imageId)
    // In that copy a covered spot is fog, and the uncovered box still shows the map.
    const [y0, x0, y1, x1] = pins.box
    const mid: [number, number] = [(x0 + x1) / 2 / map.width, 1 - (y0 + y1) / 2 / map.height]
    const far: [number, number] = [mid[0] < 0.5 ? 0.93 : 0.07, mid[1] < 0.5 ? 0.9 : 0.1]
    expect(await lightness(page, { asset: showing.assetId }, ...far)).toBeLessThan(DARK)
    expect(await lightness(page, { asset: now.imageId }, ...far)).toBeGreaterThan(DARK + 20)
    expect(await lightness(page, { asset: showing.assetId }, ...mid)).toBeGreaterThan(DARK + 20)

    // The players' screen: that picture, the pins players may see in the uncovered part, and no others.
    const tv = await page.context().newPage()
    try {
      await open(tv, `/screen/${world.slug}`)
      const live = tv.locator('.live-map')
      await expect(live.locator('.live-picture')).toBeVisible()
      await expect(live.locator('.leaflet-tooltip').first()).toBeAttached()
      const drawn = await live.innerHTML()
      for (const name of pins.shown) expect(drawn, `“${name}” is uncovered and for players`).toContain(name)
      const all = await tv.locator('.players-screen').innerHTML()
      for (const name of pins.fogged) expect(all, `“${name}” is under the fog`).not.toContain(name)
      for (const name of pins.gmOnly) expect(all, `“${name}” is GM only`).not.toContain(name)
      expect(await lightness(tv, { img: '.live-map img.live-picture' }, ...far)).toBeLessThan(DARK)
      // The whole map is in view, and it can't be dragged away.
      await expect(live).toHaveClass(/big/)
      await expect(live.locator('.leaflet-control-zoom')).toHaveCount(0)
    } finally {
      await tv.close()
    }

    // "Stop showing" takes it down, and Undo puts it back.
    await page.getByRole('button', { name: 'Stop showing' }).first().click()
    await expect(page.locator('.undo-toast')).toContainText('Players’ screens are clear.')
    await expect.poll(async () => (await getRecord(page, 'worlds', world.id))!.showing ?? null).toBeNull()
    await page.locator('.undo-toast .undo-button').click()
    await expect.poll(async () => ((await getRecord(page, 'worlds', world.id))!.showing as { mapId?: string } | undefined)?.mapId).toBe(map.id)
  } finally {
    await tidy(page, world, wasWorld, wasMap)
  }
})

const CLOUD = 'feedc0de-1111-4111-8111-111111111111'
const TAIL = '@mfeedc0de'
const COPY = 'member-livemap'

/** A joined player's copy of the world with the map up on screen: the fogged picture as it stands now, and none of the map's pins yet. */
async function makeJoinedCopy(page: Page, world: World, map: MapRow, showing: Row & { assetId: string }) {
  const { cloud: _c, showing: _s, handouts: _h, spread: _p, ...base } = world.world as Row
  const mine: Row = { ...showing, assetId: showing.assetId + TAIL, mapId: map.id + TAIL }
  const shared = { memberOf: CLOUD, fetchedAt: Date.now(), me: 'u-sam', members: [{ userId: 'u-sam', name: 'Sam', role: 'player' }], claims: [], notes: [], questions: [] }
  await putBack(page, 'worlds', [[COPY, { ...base, id: COPY, shared, showing: mine, handouts: [mine] } as Row]])
  const { fog: _f, ...plain } = map
  await putBack(page, 'maps', [[map.id + TAIL, { ...plain, id: map.id + TAIL, worldId: COPY, imageId: showing.assetId + TAIL } as Row]])
  // The picture itself (a file) is copied in the page.
  await page.evaluate(
    ({ from, to, worldId }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const tx = req.result.transaction('assets', 'readwrite')
          const store = tx.objectStore('assets')
          const get = store.get(from)
          get.onsuccess = () => store.put({ ...get.result, id: to, worldId })
          tx.oncomplete = () => {
            req.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { from: showing.assetId, to: showing.assetId + TAIL, worldId: COPY },
  )
  return async () => {
    await putBack(page, 'worlds', [[COPY, null]])
    await putBack(page, 'maps', [[map.id + TAIL, null]])
    await putBack(page, 'assets', [[showing.assetId + TAIL, null]])
  }
}

/** A spot on the GM's map (given in map units) as a place on the screen, if nothing but the map is under it there. */
function spotOnScreen(page: Page, map: MapRow, at: [number, number]) {
  return page.evaluate(
    ({ fx, fy }) => {
      const img = document.querySelector<HTMLElement>('.leaflet-container .leaflet-image-layer')!
      const r = img.getBoundingClientRect()
      const x = r.left + fx * r.width
      const y = r.top + fy * r.height
      const top = document.elementFromPoint(x, y)
      if (!top || !top.closest('.leaflet-container') || top.closest('.leaflet-marker-pane, .leaflet-tooltip-pane, .leaflet-control, .leaflet-popup-pane')) return null
      return { x, y }
    },
    { fx: at[1] / map.width, fy: 1 - at[0] / map.height },
  )
}

test('fog cleared while a map is shown reaches a player without a new Show: a piece of the players’ copy and the pins they may see, from the GM’s room only', async ({ page, world }) => {
  const map = world.map(MAP) as unknown as MapRow
  const pins = sortPins(world, map.id)
  const gm = await fakeRealtime(page)
  await open(page, '/')
  const wasWorld = await patchRecord(page, 'worlds', world.id, { cloud: { enabled: true } })
  const wasMap = await fogWith(page, map.id, pins.box)
  const player = await page.context().newPage()
  let removeCopy: (() => Promise<void>) | undefined
  try {
    await open(page, `/w/${world.slug}/maps/${map.id}`)
    await page.locator('.map-tools').getByRole('button', { name: 'Show players' }).click()
    await expect(page.locator('.map-live-chip')).toBeVisible()
    await expect.poll(() => [...gm.joined]).toContain(`realtime:table:${world.id}`)
    const shown = (await getRecord(page, 'worlds', world.id))!.showing as Row & { assetId: string }
    const copyId = ((await getRecord(page, 'maps', map.id)) as MapRow).fog!.imageId!
    expect(shown.assetId).toBe(copyId)

    // A player who joined has the map up, as it stands now.
    await offline(player)
    const rt = await fakeRealtime(player)
    await player.goto('/')
    removeCopy = await makeJoinedCopy(player, world, map, shown)
    await open(player, `/w/${COPY}`)
    const theirs = player.locator('.live-map').first()
    await expect(theirs.locator('.live-picture')).toBeVisible()
    await expect(theirs.locator('.live-patch')).toHaveCount(0)
    // Their app says which version of the picture it has, by the GM's own id for it.
    await expect.poll(() => rt.sent.filter((m) => m.event === 'map-ask').map((m) => `${m.topic} ${m.payload.asset}`), { timeout: 20_000 }).toContain(`realtime:members:${CLOUD} ${copyId}`)
    // On a phone they can move about in it.
    await expect(theirs).not.toHaveClass(/big/)
    await expect(player.getByText('Live: it changes as your GM uncovers the map.').first()).toBeVisible()

    // The GM uncovers a circle somewhere still covered (no Show pressed again).
    const [y0, x0, y1, x1] = pins.box
    // (Well clear of the uncovered box and of the map's edges, so the whole circle is new.)
    const within: [number, number][] = []
    for (let y = 160; y <= map.height - 160; y += 90)
      for (let x = 160; x <= map.width - 160; x += 90) if (y < y0 - 200 || y > y1 + 200 || x < x0 - 200 || x > x1 + 200) within.push([y, x])
    await page.getByRole('button', { name: /Fog/ }).first().click()
    await page.locator('.fog-bar').getByRole('button', { name: /Circle/ }).click()
    let at: { x: number; y: number } | null = null
    for (const c of within) {
      at = await spotOnScreen(page, map, c)
      const size = page.viewportSize()!
      if (at && at.x > 0 && at.y > 0 && at.x < size.width && at.y < size.height) break
      at = null
    }
    expect(at, 'a covered spot on the map to click').not.toBeNull()
    const before = gm.sent.length
    await page.mouse.click(at!.x, at!.y)
    await expect.poll(async () => ((await getRecord(page, 'maps', map.id)) as MapRow).fog!.shapes.length).toBeGreaterThan(1)
    const pieces = () => gm.sent.slice(before).filter((m) => m.event === 'map' && typeof m.payload.img === 'string')
    await expect.poll(() => pieces().length, { timeout: 20_000 }).toBeGreaterThan(0)
    const piece = pieces()[0]

    // It went out in the GM's room, for the players' copy, as a small piece of it.
    expect(piece.topic).toBe(`realtime:table:${world.id}`)
    expect(piece.payload.asset).toBe(copyId)
    expect(String(piece.payload.img)).toMatch(/^data:image\/jpeg;base64,/)
    const box = piece.payload.box as number[]
    expect((box[2] - box[0]) * (box[3] - box[1]), 'only the part that changed').toBeLessThan(0.5)
    // Cut from the players' copy, not the map: outside the circle, the corners of the piece are fog.
    const light = await page.evaluate(async (src) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const avg = (x: number, y: number, w: number, h: number) => {
        const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(2, Math.round(w)), Math.max(2, Math.round(h))).data
        let sum = 0
        for (let i = 0; i < d.length; i += 4) sum += Math.max(d[i], d[i + 1], d[i + 2])
        return sum / (d.length / 4)
      }
      const s = Math.min(c.width, c.height) * 0.06
      return { corners: [avg(0, 0, s, s), avg(c.width - s, 0, s, s), avg(0, c.height - s, s, s), avg(c.width - s, c.height - s, s, s)], middle: avg(c.width * 0.35, c.height * 0.35, c.width * 0.3, c.height * 0.3) }
    }, String(piece.payload.img))
    for (const corner of light.corners) expect(corner).toBeLessThan(DARK)
    expect(light.middle).toBeGreaterThan(DARK + 20)
    // The pins sent are the ones players may see in the uncovered parts: none GM only, none under the fog.
    const said = gm.sent.filter((m) => m.event === 'map')
    const sentPins = JSON.stringify(said.map((m) => m.payload.pins))
    for (const name of pins.shown) expect(sentPins, `“${name}” is uncovered and for players`).toContain(name)
    for (const name of pins.gmOnly) expect(sentPins, `“${name}” is GM only`).not.toContain(name)
    // A pin still under the fog isn't sent either (one inside the circle just uncovered is fair game).
    const circle = ((await getRecord(page, 'maps', map.id)) as MapRow).fog!.shapes.at(-1)!.points
    const ys = circle.map((q) => q[0])
    const xs = circle.map((q) => q[1])
    const inCircle = (q: [number, number]) => q[0] >= Math.min(...ys) && q[0] <= Math.max(...ys) && q[1] >= Math.min(...xs) && q[1] <= Math.max(...xs)
    const allPins = world.dump.pins as unknown as PinRow[]
    const stillFogged = pins.fogged.filter((label) => allPins.every((q) => q.mapId !== map.id || q.label !== label || !q.position || !inCircle(q.position)))
    expect(stillFogged.length, 'a pin still under the fog').toBeGreaterThan(0)
    for (const name of stillFogged) expect(sentPins, `“${name}” is still under the fog`).not.toContain(name)
    expect(Object.keys((piece.payload.pins as object[])[0]).sort().join(' ')).not.toMatch(/note|entityId|visibility/)
    // Nothing about the map goes to the room every player can post in.
    expect(gm.sent.filter((m) => m.event === 'map' && m.topic !== `realtime:table:${world.id}`)).toEqual([])
    // Show wasn't pressed again: it's the same showing.
    expect(((await getRecord(page, 'worlds', world.id))!.showing as Row).id).toBe(shown.id)

    // A "map" in the room every player can post in is somebody passing for the GM: nothing changes.
    rt.say(`members:${CLOUD}`, 'map', { ...piece.payload, pins: [{ id: 'forged', label: 'Forged pin', kind: 'point', position: [300, 300], color: '#ff0000' }] })
    await player.waitForTimeout(700)
    await expect(theirs.locator('.live-patch')).toHaveCount(0)
    expect(await theirs.innerHTML()).not.toContain('Forged pin')
    // From the GM's room: the piece is laid over their picture, with the pins.
    rt.say(`table:${CLOUD}`, 'map', piece.payload)
    await expect(theirs.locator('.live-patch')).toHaveCount(1)
    expect(await theirs.locator('.live-patch').getAttribute('src')).toBe(piece.payload.img)
    const drawn = await theirs.innerHTML()
    for (const name of pins.shown) expect(drawn).toContain(name)
    for (const name of pins.gmOnly) expect(drawn).not.toContain(name)
    // The same piece again adds nothing.
    rt.say(`table:${CLOUD}`, 'map', piece.payload)
    await player.waitForTimeout(400)
    await expect(theirs.locator('.live-patch')).toHaveCount(1)

    // Fog changed on another device (here: written straight to the database, as sync would, on a device
    // that isn't the one keeping the map live, which then opens the world): it neither remakes the
    // players' copy nor says anything to players, so two devices never send pieces of their own.
    await page.evaluate((id) => localStorage.removeItem(`atlas.liveMapHost.${id}`), map.id)
    const fogNow = ((await getRecord(page, 'maps', map.id)) as MapRow).fog!
    await patchRecord(page, 'maps', map.id, { fog: { ...fogNow, shapes: [...fogNow.shapes, { id: 'elsewhere', mode: 'reveal', points: [[10, 10], [10, 60], [60, 60], [60, 10]] }] } })
    const quiet = gm.sent.length
    await page.reload()
    await expect(page.locator('.map-live-chip')).toBeVisible()
    await page.waitForTimeout(3000)
    expect(gm.sent.slice(quiet).filter((m) => m.event === 'map')).toEqual([])
  } finally {
    await player.goto('/').catch(() => {})
    await removeCopy?.()
    await player.close()
    await tidy(page, world, wasWorld, wasMap)
  }
})

test('a GM-only map shown as “A map” goes out as its picture alone: no map id, no pins, no name', async ({ page, world }) => {
  const map = world.map(MAP) as unknown as MapRow
  const pins = sortPins(world, map.id)
  const gm = await fakeRealtime(page)
  await open(page, '/')
  const wasWorld = await patchRecord(page, 'worlds', world.id, { cloud: { enabled: true } })
  const wasMap = await fogWith(page, map.id, pins.box, { visibility: 'gm' })
  try {
    await open(page, `/w/${world.slug}/maps/${map.id}`)
    await page.locator('.map-tools').getByRole('button', { name: 'Show players' }).click()
    // Its own name would give it away: it goes out as "A map".
    const ask = page.getByRole('dialog', { name: 'Show this picture?' })
    await expect(ask.getByLabel('What players see it called')).toHaveValue('A map')
    await ask.getByRole('button', { name: 'Show players' }).click()
    await expect(page.locator('.map-live-chip')).toContainText('On players’ screens')
    const saved = (await getRecord(page, 'worlds', world.id))!
    const showing = saved.showing as Row & { assetId: string; live?: boolean; mapId?: string; title: string }
    const copyId = ((await getRecord(page, 'maps', map.id)) as MapRow).fog!.imageId!
    expect(showing).toMatchObject({ kind: 'image', live: true, title: 'A map', assetId: copyId })
    expect(showing.mapId).toBeUndefined()
    // Neither what's shown nor its handout holds the map's id or its name.
    expect(JSON.stringify([saved.showing, saved.handouts])).not.toContain(map.id)
    expect(JSON.stringify([saved.showing, saved.handouts])).not.toContain(MAP)
    // What's said live is about the picture only, with no pins, and never the map's id.
    await expect.poll(() => gm.sent.filter((m) => m.event === 'map').length, { timeout: 20_000 }).toBeGreaterThan(0)
    const said = gm.sent.filter((m) => m.event === 'map')
    for (const m of said) {
      expect(m.topic).toBe(`realtime:table:${world.id}`)
      expect(m.payload.pins).toEqual([])
      expect(JSON.stringify(m.payload)).not.toContain(map.id)
    }
    // The players' screen: the picture, no pins, not the map's name.
    const tv = await page.context().newPage()
    try {
      await open(tv, `/screen/${world.slug}`)
      const live = tv.locator('.live-map')
      await expect(live.locator('.live-picture')).toBeVisible()
      await expect(live.locator('.leaflet-tooltip')).toHaveCount(0)
      const all = await tv.locator('.players-screen').innerHTML()
      expect(all).not.toContain(MAP)
      for (const name of [...pins.shown, ...pins.gmOnly]) expect(all).not.toContain(name)
    } finally {
      await tv.close()
    }
  } finally {
    await tidy(page, world, wasWorld, wasMap)
  }
})

test('the players’ screen shows the turn order as players know it, and the timers the GM hasn’t hidden', async ({ page, world }) => {
  const sessions = world.dump.sessions as unknown as (Row & { number: number; playedAt?: number; lectern?: object })[]
  const session = [...sessions].sort((a, b) => b.number - a.number).find((s) => !s.playedAt) ?? sessions[0]
  const real = (e: { template?: boolean }) => e.template !== true
  const pc = world.dump.entities.find((e) => e.type === 'pc' && e.visibility === 'players' && real(e))!
  const secret = world.dump.entities.find((e) => e.type === 'npc' && e.visibility === 'gm' && real(e))!
  const known = world.dump.entities.find((e) => e.type === 'npc' && e.visibility === 'players' && real(e))!
  await open(page, '/')
  const was = (await getRecord(page, 'sessions', session.id))!
  const lectern = { sceneText: '', presentIds: [], rolls: [], ...(was.lectern as object | undefined) }
  const fight = {
    round: 2,
    activeId: 'c-secret',
    combatants: [
      { id: 'c-pc', name: pc.name, init: 18, side: 'pc', conditions: [], entityId: pc.id },
      { id: 'c-secret', name: secret.name, init: 15, side: 'foe', conditions: [], entityId: secret.id, hp: 20, maxHp: 30 },
      { id: 'c-known', name: known.name, init: 9, side: 'ally', conditions: [], entityId: known.id },
      { id: 'c-down', name: 'Fallen sellsword', init: 3, side: 'foe', conditions: [], defeated: true },
    ],
  }
  const timers = [
    { id: 't-shown', label: 'The tide comes in', endsAt: Date.now() + 5 * 60_000 },
    { id: 't-hidden', label: 'Assassin arrives', endsAt: Date.now() + 9 * 60_000, hidden: true },
  ]
  try {
    await patchRecord(page, 'sessions', session.id, { playedAt: undefined, lectern: { ...lectern, combat: fight, timers } })
    await open(page, `/screen/${world.slug}`)
    const panel = page.locator('.screen-table')
    await expect(panel.getByRole('heading', { name: /Turn order/ })).toContainText('Round 2')
    const order = panel.locator('.turn-order li')
    const named = (name: string) => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    await expect(order).toHaveText([named(pc.name), /Enemy 1/, named(known.name)])
    await expect(order.nth(1)).toHaveClass(/active/)
    await expect(panel.locator('.timer-list li')).toHaveText([/The tide comes in\s*[45]:\d\d/])
    // Nothing of what players don't know is on the page at all: the hidden foe's name, its hit points, the hidden timer, who is down.
    const html = await page.locator('.players-screen').innerHTML()
    for (const hiddenThing of [secret.name, 'Assassin arrives', 'Fallen sellsword', '20/30']) expect(html).not.toContain(hiddenThing)

    // While the GM runs another session live (with no fight in it), the screen follows that one, as players' phones do.
    const other = sessions.find((x) => x.id !== session.id)!
    const wasOther = (await getRecord(page, 'sessions', other.id))!
    try {
      await patchRecord(page, 'sessions', other.id, { playedAt: undefined, lectern: { sceneText: '', presentIds: [], rolls: [], combat: { round: 0, combatants: [] }, timers: [] } })
      await page.evaluate(({ w, s }) => sessionStorage.setItem(`codex.liveSession.${w}`, s), { w: world.id, s: other.id })
      await page.reload()
      await expect(page.locator('.players-screen')).toBeVisible()
      // (The panel takes a moment to look: give it one, so this isn't seen before it could appear.)
      await page.waitForTimeout(1500)
      await expect(panel).toHaveCount(0)
    } finally {
      await page.evaluate((w) => sessionStorage.removeItem(`codex.liveSession.${w}`), world.id)
      await putBack(page, 'sessions', [[other.id, wasOther]])
    }

    // The fight over and the timers gone: the panel leaves the screen.
    await patchRecord(page, 'sessions', session.id, { lectern: { ...lectern, combat: { round: 0, combatants: [] }, timers: [] } })
    await open(page, `/screen/${world.slug}`)
    await expect(page.locator('.players-screen')).toBeVisible()
    await expect(panel).toHaveCount(0)
  } finally {
    await putBack(page, 'sessions', [[session.id, was]])
  }
})

test('Print on a map offers the GM copy or the player copy, and the player copy keeps the fog and leaves out GM-only pins', async ({ page, world }) => {
  const map = world.map(MAP) as unknown as MapRow
  const pins = sortPins(world, map.id)
  await open(page, '/')
  const wasWorld = (await getRecord(page, 'worlds', world.id))!
  const wasMap = await fogWith(page, map.id, pins.box, { numbers: true })
  try {
    await open(page, `/w/${world.slug}/maps/${map.id}`)
    await page.locator('.map-tools').getByRole('button', { name: 'Print', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Print this map' })
    await expect(dialog.getByRole('link', { name: /GM copy/ })).toHaveAttribute('href', new RegExp(`/print/m/${map.id}$`))
    await dialog.getByRole('link', { name: /Player copy/ }).click()
    await page.waitForURL(new RegExp(`/print/m/${map.id}\\?copy=players$`))
    const sheet = page.locator('.print-map')
    await expect(sheet.getByRole('heading', { name: MAP })).toBeVisible()
    const picture = sheet.locator('.print-map-picture img')
    await expect(picture).toBeVisible()
    // The picture printed is the fogged copy (made now, since nothing had made it yet).
    const [y0, x0, y1, x1] = pins.box
    const mid: [number, number] = [(x0 + x1) / 2 / map.width, 1 - (y0 + y1) / 2 / map.height]
    const far: [number, number] = [mid[0] < 0.5 ? 0.93 : 0.07, mid[1] < 0.5 ? 0.9 : 0.1]
    expect(await lightness(page, { img: '.print-map-picture img' }, ...far)).toBeLessThan(DARK)
    expect(await lightness(page, { img: '.print-map-picture img' }, ...mid)).toBeGreaterThan(DARK + 20)
    // No GM-only pin and nothing under the fog in the key (or anywhere on the sheet).
    const text = await sheet.innerText()
    for (const name of [...pins.gmOnly, ...pins.fogged]) expect(text, `“${name}” isn’t for this copy`).not.toContain(name)
    const keyed = pins.numbered.filter((p) => pins.shown.includes(p.label))
    for (const p of keyed) await expect(sheet.locator('.print-map-key')).toContainText(p.label)
  } finally {
    await tidy(page, world, wasWorld, wasMap)
  }
})
