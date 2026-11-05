import { deflateSync } from 'node:zlib'
import { expect, open, test, type Page } from './fixtures'

/**
 * Map packs, on a laptop and with no internet (as every test runs): pictures uploaded on the Map
 * packs screen become pieces, the pack is switched on for the world, and a piece is placed on a
 * new battle map from "Your packs". Packs stay on the device when signed out, so none of this
 * needs the cloud. The pack and the map are removed afterwards.
 */

/** A small PNG of one colour with a see-through border, made here so the test needs no files. */
function png(w: number, h: number, [r, g, b]: [number, number, number]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer) => {
    let c = 0xffffffff
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, sum])
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(w, 0)
  head.writeUInt32BE(h, 4)
  head[8] = 8 // bits
  head[9] = 6 // RGBA
  const rows = []
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4)
    for (let x = 0; x < w; x++) {
      const edge = x < 4 || y < 4 || x >= w - 4 || y >= h - 4
      row.set([r, g, b, edge ? 0 : 255], 1 + x * 4)
    }
    rows.push(row)
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))])
}

/** What's in one of the app's tables, read in the page. */
function table<T>(page: Page, name: string) {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const all = idb.transaction(name, 'readonly').objectStore(name).getAll()
          all.onsuccess = () => {
            idb.close()
            resolve(all.result as T[])
          }
        }
      }),
    name,
  )
}

test('pictures uploaded as a pack can be placed on a map, and the map keeps them', async ({ page, world }) => {
  const packName = 'Test pack (camp)'
  const mapName = 'Test camp (packs)'
  try {
    await open(page, `/w/${world.slug}/packs`)
    await expect(page.getByRole('heading', { name: /Map packs/ })).toBeVisible()
    // tent-1 and tent-2 are two versions of one Tent; "2x1" makes the cart two squares wide
    await page.locator('input[type=file]').first().setInputFiles([
      { name: 'tent-1.png', mimeType: 'image/png', buffer: png(64, 64, [180, 120, 60]) },
      { name: 'tent-2.png', mimeType: 'image/png', buffer: png(64, 64, [120, 160, 60]) },
      { name: 'cart 2x1.png', mimeType: 'image/png', buffer: png(128, 64, [90, 70, 50]) },
    ])
    const check = page.locator('table.pack-check tbody tr')
    await expect(check).toHaveCount(2)
    await expect(page.getByText('2 pieces, 3 pictures')).toBeVisible()
    await expect(check.nth(0).getByLabel('Name')).toHaveValue('Tent')
    await expect(check.nth(1).getByLabel('Squares across')).toHaveValue('2')
    await page.getByLabel('Name of the new pack').fill(packName)
    await expect(page.getByLabel(/Switch the pack on for/)).toBeChecked()
    await page.getByRole('button', { name: 'Save the pack' }).click()
    const card = page.locator('.pack-card', { has: page.locator(`input[value="${packName}"]`) })
    await expect(card.locator('.pack-tile')).toHaveCount(2)
    await expect(card.locator('.pack-tile img').first()).toBeVisible()

    const pieces = await table<{ label: string; cols: number; versions: unknown[] }>(page, 'packPieces')
    expect(pieces.find((p) => p.label === 'Tent')?.versions).toHaveLength(2)
    expect(pieces.find((p) => p.label === 'Cart')?.cols).toBe(2)

    // switched on for the world, as ticked
    await open(page, `/w/${world.slug}/settings?at=packs`)
    await expect(page.locator('#settings-packs').getByLabel(packName)).toBeChecked()

    // a battle map, and the Tent from Your packs
    await open(page, `/w/${world.slug}/maps`)
    await page.getByRole('button', { name: /Draw a new map/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill(mapName)
    await dialog.getByRole('radio', { name: /Battle map or dungeon/ }).click()
    await dialog.getByRole('button', { name: 'Small', exact: true }).click()
    await dialog.getByRole('button', { name: 'Start drawing' }).click()
    await page.waitForURL(/\/draw$/)
    await page.locator('.builder-tools button', { hasText: 'Place' }).click()
    const panel = page.locator('.builder-panel')
    await panel.getByRole('tab', { name: 'Your packs' }).click()
    await panel.locator('.pack-tile', { hasText: 'Tent' }).click()
    await expect(panel.locator('.pack-tile.on', { hasText: 'Tent' })).toBeVisible()
    // two versions to choose from (and Any)
    await expect(panel.locator('.version-grid [role=radio]')).toHaveCount(3)
    const svg = page.locator('svg.builder-canvas')
    const at = await svg.evaluate((s: SVGSVGElement) => {
      const pt = s.createSVGPoint()
      pt.x = 700
      pt.y = 525
      const p = pt.matrixTransform(s.getScreenCTM()!)
      return { x: p.x, y: p.y }
    })
    await page.mouse.click(at.x, at.y)
    await expect(page.locator('.builder-bar')).toContainText('Saved', { timeout: 20_000 })
    const maps = await table<{ name: string; drawing?: { shapes: { asset?: string }[] } }>(page, 'maps')
    const shapes = maps.find((m) => m.name === mapName)?.drawing?.shapes ?? []
    expect(shapes.some((s) => s.asset?.startsWith('pack:'))).toBe(true)
  } finally {
    // the map and the pack go again, so other tests see the world as it was
    await page.evaluate(
      ({ mapName, packName }) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('ttrpg-campaign-manager')
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const idb = req.result
            const tx = idb.transaction(['maps', 'assets', 'packs', 'packPieces', 'packFiles', 'worlds'], 'readwrite')
            const maps = tx.objectStore('maps').getAll()
            maps.onsuccess = () => {
              for (const m of maps.result as { id: string; name: string; imageId: string }[])
                if (m.name === mapName) {
                  tx.objectStore('maps').delete(m.id)
                  tx.objectStore('assets').delete(m.imageId)
                }
            }
            const packs = tx.objectStore('packs').getAll()
            packs.onsuccess = () => {
              const ids = (packs.result as { id: string; name: string }[]).filter((p) => p.name === packName).map((p) => p.id)
              for (const id of ids) tx.objectStore('packs').delete(id)
              const pieces = tx.objectStore('packPieces').getAll()
              pieces.onsuccess = () => {
                for (const x of pieces.result as { id: string; packId: string }[]) if (ids.includes(x.packId)) tx.objectStore('packPieces').delete(x.id)
              }
              const worlds = tx.objectStore('worlds').getAll()
              worlds.onsuccess = () => {
                for (const w of worlds.result as { gmScreen?: { mapPacks?: string[] } }[])
                  if (w.gmScreen?.mapPacks?.some((id) => ids.includes(id))) tx.objectStore('worlds').put({ ...w, gmScreen: { ...w.gmScreen, mapPacks: w.gmScreen.mapPacks.filter((id) => !ids.includes(id)) } })
              }
            }
            tx.oncomplete = () => {
              idb.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error)
          }
        }),
      { mapName, packName },
    )
  }
})
