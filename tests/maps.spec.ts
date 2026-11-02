import { expect, open, test, type Page } from './fixtures'
import type { World } from './lib/world'

/**
 * The map builder and the map's fog, on a laptop. Each test draws a small dungeon of its own and
 * deletes it afterwards (straight in the database), since tests in one worker share the world.
 *
 * Map points are the drawing's own pixels (a Small dungeon is 1400 × 1050, 70 to a 5 ft square).
 * SHOTS_DIR=<folder> saves screenshots of the builder.
 */

type Point = [number, number]
interface Drawn {
  id: string
  imageId: string
  playerImageId?: string
  fog?: { on: boolean; imageId?: string; shapes: { id: string; mode: string; points: Point[] }[] }
  drawing: {
    outside?: string
    rooms?: { id: string; mode: string; shape: string; gm?: boolean; points: Point[] }[]
    ground?: { id: string }[]
    shapes: { id: string; kind: string; asset?: string; at?: Point; turn?: number; size?: number; text?: string }[]
  }
}

/** The map called name, with its drawing, read in the page. */
function mapNamed(page: Page, name: string) {
  return page.evaluate(
    (name) =>
      new Promise<Drawn | undefined>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const all = idb.transaction('maps', 'readonly').objectStore('maps').getAll()
          all.onsuccess = () => {
            idb.close()
            resolve((all.result as (Drawn & { name: string })[]).find((m) => m.name === name))
          }
        }
      }),
    name,
  )
}

/** Deletes the map called name, its pictures and its pins. */
async function removeMap(page: Page, name: string) {
  const m = await mapNamed(page, name)
  if (!m) return
  await page.evaluate(
    ({ id, assets }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(['maps', 'assets', 'pins'], 'readwrite')
          tx.objectStore('maps').delete(id)
          for (const a of assets) tx.objectStore('assets').delete(a)
          const pins = tx.objectStore('pins').getAll()
          pins.onsuccess = () => {
            for (const p of pins.result as { id: string; mapId: string }[]) if (p.mapId === id) tx.objectStore('pins').delete(p.id)
          }
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { id: m.id, assets: [m.imageId, m.playerImageId, m.fog?.imageId].filter(Boolean) as string[] },
  )
}

/** Starts a Small dungeon dug out of solid rock, and waits for the builder. */
async function newDungeon(page: Page, world: World, name: string) {
  await open(page, `/w/${world.slug}/maps`)
  await page.getByRole('button', { name: /Draw a new map/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByRole('radio', { name: /Dungeon, building or battle map/ }).click()
  await dialog.getByRole('button', { name: 'Small', exact: true }).click()
  await dialog.getByRole('button', { name: 'Start drawing' }).click()
  await page.waitForURL(/\/draw$/)
  await expect(page.locator('svg.builder-canvas')).toBeVisible()
}

/** Where a map point is on the screen, in the builder. */
function onScreen(page: Page, [x, y]: Point) {
  return page.locator('svg.builder-canvas').evaluate((svg: SVGSVGElement, [x, y]) => {
    const pt = svg.createSVGPoint()
    pt.x = x
    pt.y = y
    const s = pt.matrixTransform(svg.getScreenCTM()!)
    return { x: s.x, y: s.y }
  }, [x, y] as Point)
}
async function clickMap(page: Page, p: Point) {
  const s = await onScreen(page, p)
  await page.mouse.click(s.x, s.y)
}
async function dragMap(page: Page, from: Point, to: Point) {
  const a = await onScreen(page, from)
  const b = await onScreen(page, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 10 })
  await page.mouse.up()
}
const tool = (page: Page, name: string) => page.locator('.builder-tools button', { hasText: name })
const panel = (page: Page) => page.locator('.builder-panel')
const shot = async (page: Page, name: string) => {
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` })
}
async function saved(page: Page) {
  await expect(page.locator('.builder-bar')).toContainText('Saved', { timeout: 20_000 })
}

test('a door clicked in a passage goes across it, and the fog Room tool stops at it', async ({ page, world }) => {
  const name = 'Test Crypt (door)'
  try {
    await newDungeon(page, world, name)
    // A fresh dungeon is all rock, so it starts on the Rooms tool.
    await expect(page.locator('.builder-tools button.on')).toContainText('Rooms')

    // Ground painted only on the rock changes nothing, so it's ignored (with a word why).
    await tool(page, 'Ground').click()
    await dragMap(page, [400, 800], [900, 820])
    await expect(page.locator('.undo-toast')).toContainText('solid rock')
    await expect(page.getByRole('button', { name: /Undo/ })).toBeDisabled()

    // Two rooms with a 5 ft passage between them (its middle is at y = 315, its walls at 280 and 350).
    await tool(page, 'Rooms').click()
    await dragMap(page, [140, 140], [490, 490])
    await dragMap(page, [910, 140], [1260, 490])
    await panel(page).getByRole('button', { name: /Passage/ }).click()
    await dragMap(page, [455, 315], [945, 315])

    // A door clicked a little off the passage's middle.
    await tool(page, 'Place').click()
    await panel(page).getByLabel('Find a piece').fill('door')
    await panel(page).locator('.stamp-grid button[title="Door"]').first().click()
    // Before the click, a faint outline shows where it will land.
    const at = await onScreen(page, [690, 335])
    await page.mouse.move(at.x - 5, at.y)
    await page.mouse.move(at.x, at.y)
    await expect(page.locator('.snap-ghost')).toBeVisible()
    await clickMap(page, [690, 335])
    // A piece clicked in the dark margin off the map's edge is ignored.
    const box = await page.locator('svg.builder-canvas').evaluate((svg: SVGSVGElement) => svg.viewBox.baseVal)
    const outside: Point | undefined = box.x < -30 ? [box.x / 2, 500] : box.y < -30 ? [700, box.y / 2] : undefined
    if (outside) await clickMap(page, outside)
    await saved(page)
    await shot(page, 'maps-door-in-passage')

    const m = (await mapNamed(page, name))!
    expect(m.drawing.rooms).toHaveLength(3)
    const doors = m.drawing.shapes.filter((s) => s.asset === 'dg-door')
    expect(doors).toHaveLength(1)
    // Across the passage: on the grid line at x = 700, on the passage's middle, turned a quarter.
    expect(doors[0].at).toEqual([700, 315])
    expect([90, 270]).toContain(doors[0].turn)
    expect(m.drawing.shapes).toHaveLength(1)

    // On the map, the fog's Room tool uncovers the first room and the passage up to the door, not the room beyond it.
    await page.getByRole('link', { name: /Done/ }).click()
    await page.waitForURL(/\/maps\/[^/]+$/)
    await page.getByRole('button', { name: /Fog/ }).first().click()
    const fogOn = page.getByLabel('Players see only what you uncover')
    await fogOn.click()
    await expect(fogOn).toBeChecked()
    await page.locator('.fog-bar').getByRole('button', { name: /Room/ }).click()
    const pic = await page.locator('.leaflet-image-layer').first().boundingBox()
    await page.mouse.click(pic!.x + (300 / 1400) * pic!.width, pic!.y + (300 / 1050) * pic!.height)
    await expect.poll(async () => (await mapNamed(page, name))?.fog?.shapes.length ?? 0).toBeGreaterThan(0)
    const fog = (await mapNamed(page, name))!.fog!
    // fog points are [up from the bottom, across]
    const xs = fog.shapes.filter((s) => s.mode === 'reveal').flatMap((s) => s.points.map((p) => p[1]))
    expect(Math.min(...xs)).toBeLessThan(200)
    expect(Math.max(...xs)).toBeGreaterThan(600)
    expect(Math.max(...xs)).toBeLessThan(780)

    // Undo takes the uncovered room back and Redo puts it back again.
    const shapes = fog.shapes.length
    const bar = page.locator('.fog-bar')
    await bar.getByRole('button', { name: /Undo/ }).click()
    await expect.poll(async () => (await mapNamed(page, name))?.fog?.shapes.length).toBe(shapes - 1)
    await bar.getByRole('button', { name: /Redo/ }).click()
    await expect.poll(async () => (await mapNamed(page, name))?.fog?.shapes.length).toBe(shapes)
    // Cover all can be undone too.
    await bar.getByRole('button', { name: 'Cover all', exact: true }).click()
    await expect.poll(async () => (await mapNamed(page, name))?.fog?.shapes.length).toBe(0)
    await page.locator('.undo-toast').getByRole('button', { name: /Undo/ }).click()
    await expect.poll(async () => (await mapNamed(page, name))?.fog?.shapes.length).toBe(shapes)
  } finally {
    await removeMap(page, name)
  }
})

test('rooms can be picked, changed and erased, Ctrl+Z works after a slider, and Undo outlasts Done', async ({ page, world }) => {
  const name = 'Test Vault (select)'
  try {
    await newDungeon(page, world, name)
    await dragMap(page, [140, 140], [490, 490])
    await dragMap(page, [700, 140], [1050, 490])
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.rooms?.length).toBe(2)

    // Each tool has a key, and Esc goes back to Select.
    await page.keyboard.press('e')
    await expect(page.locator('.builder-tools button.on')).toContainText('Erase')
    await page.keyboard.press('Escape')
    await expect(page.locator('.builder-tools button.on')).toContainText('Select')

    // Select a room by its edge: it can be made secret, filled in, or deleted.
    await clickMap(page, [140, 315])
    await expect(panel(page).locator('h2')).toHaveText('Room')
    await shot(page, 'maps-room-selected')
    await panel(page).getByLabel(/Secret/).check()
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.rooms?.[0].gm).toBe(true)
    await panel(page).getByRole('button', { name: 'Fill in' }).click()
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.rooms?.[0].mode).toBe('fill')
    await panel(page).getByRole('button', { name: 'Delete' }).click()
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.rooms?.length).toBe(1)

    // Erase takes a room by its edge too, and Ctrl+Z brings it back.
    await tool(page, 'Erase').click()
    await clickMap(page, [700, 315])
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.rooms?.length).toBe(0)
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.rooms?.length).toBe(1)

    // Ctrl+Z still works while a slider has the focus, right after using it.
    await tool(page, 'Place').click()
    await clickMap(page, [875, 315])
    await tool(page, 'Select').click()
    await clickMap(page, [875, 315])
    await saved(page)
    const size = (await mapNamed(page, name))!.drawing.shapes[0].size!
    const slider = panel(page).locator('input[type=range]').first()
    await slider.focus()
    for (let i = 0; i < 5; i++) await slider.press('ArrowRight')
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.shapes[0].size).toBe(size + 5)
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.shapes[0].size).toBe(size)
    await page.keyboard.press('Control+y')
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.shapes[0].size).toBe(size + 5)
    await saved(page)

    // Done, then back to drawing: Undo still takes back the last change.
    const draw = page.url()
    await page.getByRole('link', { name: /Done/ }).click()
    await page.waitForURL(/\/maps\/[^/]+$/)
    await open(page, draw)
    const undo = page.getByRole('button', { name: /Undo/ })
    await expect(undo).toBeEnabled()
    await undo.click()
    await expect.poll(async () => (await mapNamed(page, name))?.drawing.shapes[0]?.size).toBe(size)
  } finally {
    await removeMap(page, name)
  }
})
