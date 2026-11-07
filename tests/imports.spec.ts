import { writeFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { expect, open, setView, test, type Page } from './fixtures'
import { getRecord, putBack } from './lib/records'

/**
 * Files coming into the app, on a laptop: a ZIP made to freeze or fill the app (a world backup,
 * Import pages, a map pack) is refused at once with a plain message; a secret in an imported note
 * stays hidden from players once its page is revealed; pages without ids of their own all come in;
 * an import that runs out of room adds nothing and says so; the Files page says when the device is
 * full and carries on with the rest; a backup can't file map-pack pictures under a made-up account
 * or as another kind of file; and a character sheet's portrait is only fetched from the sites sheets
 * come from. Each test puts back what it changed.
 */

// ---------- ZIPs, written by hand so a test can make one say what it likes ----------

const u16 = (n: number) => Buffer.from([n & 0xff, (n >>> 8) & 0xff])
const u32 = (n: number) => {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0)
  return b
}
const u64 = (n: number) => {
  const b = Buffer.alloc(8)
  b.writeBigUInt64LE(BigInt(n))
  return b
}
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff
  for (const x of buf) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** One file in a ZIP: its bytes, or (deflated) `packed` plus the `size` it claims to unpack to. */
interface Entry {
  name: string
  data?: Buffer
  packed?: Buffer
  size?: number
}

function zip(entries: Entry[]) {
  const parts: Buffer[] = []
  const list: Buffer[] = []
  let at = 0
  for (const e of entries) {
    const name = Buffer.from(e.name)
    const method = e.packed ? 8 : 0
    const packed = e.packed ?? e.data ?? Buffer.alloc(0)
    const size = e.size ?? e.data?.length ?? packed.length
    const crc = crc32(e.data ?? Buffer.alloc(0))
    const head = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(method), u16(0), u16(0), u32(crc), u32(packed.length), u32(size), u16(name.length), u16(0), name])
    list.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(method), u16(0), u16(0), u32(crc), u32(packed.length), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(at), name]))
    parts.push(head, packed)
    at += head.length + packed.length
  }
  const cd = Buffer.concat(list)
  return Buffer.concat([...parts, cd, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(at), u16(0)])
}

/** A ZIP64 file whose sizes are all 0xFFFFFFFF, with no ZIP64 field saying what they are: it froze the tab before. */
function zip64WithoutSizes(file: string) {
  const name = Buffer.from(file)
  const local = Buffer.concat([u32(0x04034b50), u16(45), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0xffffffff), u32(0xffffffff), u16(name.length), u16(0), name, Buffer.alloc(16)])
  const cd = Buffer.concat([u32(0x02014b50), u16(45), u16(45), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0xffffffff), u32(0xffffffff), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), name])
  const z64At = local.length + cd.length
  const z64 = Buffer.concat([u32(0x06064b50), u64(44), u16(45), u16(45), u32(0), u32(0), u64(1), u64(1), u64(cd.length), u64(local.length)])
  const locator = Buffer.concat([u32(0x07064b50), u32(0), u64(z64At), u32(1)])
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(0xffff), u16(0xffff), u32(0xffffffff), u32(0xffffffff), u16(0)])
  return Buffer.concat([local, cd, z64, locator, end])
}

/** Says a few bytes, but unpacks to 64 MB (a zip bomb that lies about itself). */
const lyingBomb = (file: string): Entry => ({ name: file, packed: deflateRawSync(Buffer.alloc(64 * 1024 * 1024)), size: 1000 })
/** Says it unpacks to 2 GB. */
const hugeBomb = (file: string): Entry => ({ name: file, packed: deflateRawSync(Buffer.from('{}')), size: 0x7fffffff })

const TOO_BIG = 'This file is too big or damaged to open.'
/** A 1×1 PNG. */
const DOT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

// ---------- reading and tidying the database ----------

interface Stored {
  id: string
  worldId?: string
  name?: string
}

/** A table's rows, without pictures. */
function rows<T = Stored>(page: Page, table: string) {
  return page.evaluate(
    (table) =>
      new Promise<T[]>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const all = idb.transaction(table, 'readonly').objectStore(table).getAll()
          all.onsuccess = () => {
            idb.close()
            resolve(all.result.map((r: Record<string, unknown>) => ({ ...r, blob: r.blob instanceof Blob ? { type: r.blob.type, size: r.blob.size } : undefined })) as T[])
          }
          all.onerror = () => reject(all.error)
        }
      }),
    table,
  )
}

/** Deletes rows for good, by id (or key). */
async function forget(page: Page, table: string, ids: string[]) {
  if (ids.length) await putBack(page, table, ids.map((id): [string, null] => [id, null]))
}

/** Makes the device "full" for files of these names: saving one fails the way a full browser does. */
function fillUpFor(page: Page, names: string[]) {
  return page.evaluate((names) => {
    for (const method of ['add', 'put'] as const) {
      const real = IDBObjectStore.prototype[method]
      IDBObjectStore.prototype[method] = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        if (value && typeof value === 'object' && names.includes((value as { name?: string }).name ?? '')) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
        return real.call(this, value, key)
      }
    }
  }, names)
}

const importArea = (page: Page) => page.locator('#settings-import')
/** The file box of one of Import pages' sources (Obsidian, Kanka, World Anvil). */
const source = (page: Page, label: string) => importArea(page).locator('.row', { hasText: label }).locator('input[type=file]').first()

// ---------- the tests ----------

test('a ZIP made to freeze or fill the app is refused at once, with a plain message', async ({ page, world }) => {
  const worlds = async () => (await rows(page, 'worlds')).length
  await open(page, '/')
  const before = await worlds()
  // A world backup: ZIP64 sizes left out, a file unpacking to more than it says, and one saying 2 GB.
  for (const backup of [zip64WithoutSizes('world.json'), zip([lyingBomb('world.json')]), zip([hugeBomb('world.json')])]) {
    const said = page.waitForEvent('dialog')
    const t0 = Date.now()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'world.zip', mimeType: 'application/zip', buffer: backup })
    const dialog = await said
    expect(dialog.message()).toBe('Import failed: This backup file is damaged or incomplete (it may not have finished downloading), or too big to open. Try another copy.')
    await dialog.dismiss()
    expect(Date.now() - t0).toBeLessThan(5000)
  }
  expect(await worlds()).toBe(before)

  // Import pages, from an Obsidian vault in a ZIP.
  await open(page, `/w/${world.slug}/settings?tab=data`)
  for (const vault of [zip64WithoutSizes('Notes/Wren.md'), zip([{ name: 'Notes/Wren.md', data: Buffer.from('A guide.') }, lyingBomb('Notes/huge.md')]), zip([hugeBomb('Notes/huge.md')])]) {
    await source(page, 'Obsidian').setInputFiles({ name: 'vault.zip', mimeType: 'application/zip', buffer: vault })
    await expect(importArea(page).locator('.error')).toHaveText(TOO_BIG)
  }

  // A map pack: read a piece at a time, so it's what really unpacks that counts.
  await open(page, `/w/${world.slug}/packs`)
  for (const pack of [zip([{ name: 'Pack/tile.png', packed: deflateRawSync(Buffer.from('x')), size: 1024 * 1024 * 1024 }]), zip([lyingBomb('Pack/tile.png')])]) {
    await page.locator('input[type=file]').first().setInputFiles({ name: 'tiles.zip', mimeType: 'application/zip', buffer: pack })
    await expect(page.getByText(`Couldn’t open that: ${TOO_BIG}`)).toBeVisible()
  }
})

test('a secret in an imported note stays hidden from players once its page is revealed', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const name = 'Import Test Duke'
  // Windows line endings, a ":::" line inside a secret comment, and a comment never closed.
  const note = [
    'The duke rules the river towns.',
    '%%GM: the duke leads the cult of Ysmer',
    ':::',
    'Real name: Varek Thornquill%%',
    'He hosts a feast each spring.',
    '%%Never closed: the feast is a trap for Halvane',
  ].join('\r\n')
  await open(page, `${w}/settings?tab=data`)
  await source(page, 'Obsidian').setInputFiles({ name: `${name}.md`, mimeType: 'text/markdown', buffer: Buffer.from(note) })
  await importArea(page).getByRole('button', { name: /^Import 1 page/ }).click()
  await expect(importArea(page)).toContainText('Added 1 page')
  const made = (await rows(page, 'entities')).find((e) => e.worldId === world.id && e.name === name)!
  try {
    // Revealed, as the GM might do later.
    await putBack(page, 'entities', [[made.id, { ...(await getRecord(page, 'entities', made.id))!, visibility: 'players' }]])
    await setView(page, world, 'player')
    await open(page, `${w}/p/import-test-duke`)
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    await expect(page.locator('main')).toContainText('The duke rules the river towns.')
    await expect(page.locator('main')).toContainText('He hosts a feast each spring.')
    for (const secret of ['Ysmer', 'Thornquill', 'Halvane']) await expect(page.locator('body')).not.toContainText(secret)
  } finally {
    await forget(page, 'entities', [made.id])
  }
})

test('pages without ids of their own all come in, from World Anvil and Kanka', async ({ page, world }) => {
  const articles = [
    { title: 'Import Test Mill', content: 'A [b]mill[/b] on the river.' },
    { title: 'Import Test Ferry', content: 'A ferry.' },
    // Two with the same id, as a hand-made file might have.
    { title: 'Import Test Toll', content: 'A toll bridge.', id: 'same' },
    { title: 'Import Test Bell', content: 'A bell tower.', id: 'same' },
  ]
  const characters = [
    { name: 'Import Test Lamplighter', entry: '<p>Lights the lamps.</p>' },
    { name: 'Import Test Ferryman', entry: '<p>Rows the ferry.</p>' },
  ]
  const ours = async () => (await rows(page, 'entities')).filter((e) => e.worldId === world.id && e.name?.startsWith('Import Test '))
  try {
    await open(page, `/w/${world.slug}/settings?tab=data`)
    await source(page, 'World Anvil').setInputFiles({ name: 'articles.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(articles)) })
    await importArea(page).getByRole('button', { name: 'Import 4 pages' }).click()
    await expect(importArea(page)).toContainText('Added 4 pages')
    await source(page, 'Kanka').setInputFiles({ name: 'characters.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(characters)) })
    await importArea(page).getByRole('button', { name: 'Import 2 pages' }).click()
    await expect(importArea(page)).toContainText('Added 2 pages')
    const made = await ours()
    expect(made.map((e) => e.name).sort()).toEqual([...articles.map((a) => a.title), ...characters.map((c) => c.name)].sort())
    expect(new Set(made.map((e) => e.id)).size).toBe(6)
  } finally {
    await forget(page, 'entities', (await ours()).map((e) => e.id))
  }
})

test('an import that runs out of room adds nothing, and says so plainly', async ({ page, world }) => {
  const ours = async () => ({
    pages: (await rows(page, 'entities')).filter((e) => e.worldId === world.id && e.name?.startsWith('Import Test ')),
    files: (await rows(page, 'assets')).filter((a) => a.worldId === world.id && ['first.png', 'full.png'].includes(a.name ?? '')),
  })
  try {
    await open(page, `/w/${world.slug}/settings?tab=data`)
    await fillUpFor(page, ['full.png'])
    // Two notes with a picture each; the device "fills up" at the second picture.
    await source(page, 'Obsidian').setInputFiles([
      { name: 'Import Test Quay.md', mimeType: 'text/markdown', buffer: Buffer.from('The quay. ![[first.png]]') },
      { name: 'Import Test Weir.md', mimeType: 'text/markdown', buffer: Buffer.from('The weir. ![[full.png]]') },
      { name: 'first.png', mimeType: 'image/png', buffer: DOT },
      { name: 'full.png', mimeType: 'image/png', buffer: DOT },
    ])
    await importArea(page).getByRole('button', { name: 'Import 2 pages' }).click()
    await expect(importArea(page).locator('.error')).toHaveText(
      'Not enough room on this device for these pages and their pictures, so nothing was added. Free some space (old recordings, big files, or Recently deleted in More), then try again.',
    )
    // Not the first page, nor its picture: nothing half done.
    expect(await ours()).toEqual({ pages: [], files: [] })
  } finally {
    const left = await ours()
    await forget(page, 'entities', left.pages.map((e) => e.id))
    await forget(page, 'assets', left.files.map((a) => a.id))
  }
})

test('the Files page says when the device is full, carries on with the rest, and asks before a very big file', async ({ page, world }, testInfo) => {
  const names = ['import-test-1.png', 'full.png', 'import-test-2.png', 'import-test-big.bin']
  const ours = async () => (await rows(page, 'assets')).filter((a) => a.worldId === world.id && names.includes(a.name ?? ''))
  try {
    await open(page, `/w/${world.slug}/assets`)
    await fillUpFor(page, ['full.png'])
    const upload = page.locator('label', { hasText: 'Upload files' }).locator('input[type=file]')
    await upload.setInputFiles([
      { name: 'import-test-1.png', mimeType: 'image/png', buffer: DOT },
      { name: 'full.png', mimeType: 'image/png', buffer: DOT },
      { name: 'import-test-2.png', mimeType: 'image/png', buffer: DOT },
    ])
    await expect(page.getByRole('alert')).toHaveText(
      'Not enough room on this device for “full.png”. Free some space (old recordings, big files, or Recently deleted in More), then upload it again.',
    )
    await expect.poll(async () => (await ours()).map((a) => a.name).sort()).toEqual(['import-test-1.png', 'import-test-2.png'])
    // Pictures in the grid load as they scroll into view.
    await expect(page.locator('.asset-card img').first()).toHaveAttribute('loading', 'lazy')

    // Over 50 MB, the GM is asked first; saying no leaves it out.
    const big = testInfo.outputPath('import-test-big.bin')
    writeFileSync(big, Buffer.alloc(51 * 1024 * 1024))
    // (The question comes up while the file box is still handing over the file, so it's answered here.)
    const asked: string[] = []
    page.once('dialog', (d) => {
      asked.push(d.message())
      void d.dismiss()
    })
    await upload.setInputFiles(big)
    await expect.poll(() => asked.length).toBe(1)
    expect(asked[0]).toContain('“import-test-big.bin” is 51.0 MB.')
    expect(asked[0]).toContain('Upload it anyway?')
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect((await ours()).map((a) => a.name)).not.toContain('import-test-big.bin')
  } finally {
    await forget(page, 'assets', (await ours()).map((a) => a.id))
  }
})

test('a backup can’t file map-pack pictures under a made-up account, or as another kind of file', async ({ page }) => {
  const W = crypto.randomUUID()
  const [packId, pieceId] = [crypto.randomUUID(), crypto.randomUUID()]
  const now = Date.now()
  const backup = {
    format: 'campaign-codex-world',
    version: 1,
    exportedAt: new Date().toISOString(),
    world: { id: W, name: 'Import Test Packs', description: '', system: 'System agnostic', createdAt: now, updatedAt: now },
    campaigns: [],
    entities: [],
    maps: [],
    pins: [],
    sessions: [],
    assets: [],
    boards: [],
    sounds: [],
    packs: {
      packs: [{ id: packId, name: 'Someone’s pack', owner: '../another-account', pending: true }],
      pieces: [
        {
          ...{ id: pieceId, packId, label: 'Tree', group: 'Trees', scene: 'battle', cols: 1, rows: 1, rev: 1, updatedAt: now },
          versions: [{ w: 1, h: 1, ext: 'svg+xml', bytes: 68 }],
          owner: 'not-an-account/../../x',
          pending: true,
        },
        { id: '../escape', packId, label: 'Escape', group: 'Trees', scene: 'battle', cols: 1, rows: 1, rev: 1, updatedAt: now, versions: [{ w: 1, h: 1, ext: 'png', bytes: 68 }] },
      ],
      files: [`${pieceId}@1/0/full`, '../escape@1/0/full', 'not a key'],
    },
  }
  const file = zip([
    { name: 'world.json', data: Buffer.from(JSON.stringify(backup)) },
    { name: `packs/${pieceId}@1/0/full`, data: DOT },
    { name: 'packs/../escape@1/0/full', data: DOT },
  ])
  const made: string[] = []
  try {
    await open(page, '/')
    const had = new Set((await rows(page, 'worlds')).map((w) => w.id))
    await page.locator('input[type=file]').first().setInputFiles({ name: 'packs.zip', mimeType: 'application/zip', buffer: file })
    await expect.poll(async () => (await rows(page, 'worlds')).filter((w) => !had.has(w.id)).length).toBe(1)
    made.push((await rows(page, 'worlds')).find((w) => !had.has(w.id))!.id)

    await expect.poll(async () => (await rows<{ key: string }>(page, 'packFiles')).filter((f) => f.key.startsWith(pieceId)).length).toBe(1)
    const pack = (await rows<Record<string, unknown>>(page, 'packs')).find((p) => p.id === packId)!
    expect(pack.owner).toBeUndefined()
    expect(pack.pending).toBeUndefined()
    expect(pack.borrowed).toBe(true)
    const pieces = await rows<Record<string, unknown> & { versions: { ext: string }[] }>(page, 'packPieces')
    const piece = pieces.find((p) => p.id === pieceId)!
    expect(piece.owner).toBeUndefined()
    expect(piece.pending).toBeUndefined()
    expect(piece.versions[0].ext).toBe('png')
    expect(pieces.find((p) => p.id === '../escape')).toBeUndefined()
    const files = await rows<{ key: string; blob: { type: string } }>(page, 'packFiles')
    expect(files.filter((f) => f.key.startsWith(pieceId)).map((f) => f.blob.type)).toEqual(['image/png'])
    expect(files.find((f) => f.key.includes('escape'))).toBeUndefined()
  } finally {
    await forget(page, 'packFiles', [`${pieceId}@1/0/full`])
    await forget(page, 'packPieces', [pieceId])
    await forget(page, 'packs', [packId])
    await forget(page, 'worlds', made)
  }
})

test('a character sheet’s portrait is only fetched from the sites sheets come from', async ({ page, world }) => {
  const requested: string[] = []
  page.on('request', (r) => requested.push(r.url()))
  const asked: string[] = []
  page.on('dialog', (d) => {
    asked.push(d.message())
    void d.dismiss()
  })
  const sheets: [string, string][] = [
    ['Import Test Tracked', 'https://tracker.example/pixel.png'],
    ['Import Test Router', 'http://192.168.1.10/portrait.png'],
    ['Import Test Printer', 'https://printer.local/portrait.png'],
    ['Import Test Beyond', 'https://www.dndbeyond.com/avatars/1/portrait.png'],
  ]
  const ours = async () => (await rows<Stored & { imageId?: string }>(page, 'entities')).filter((e) => e.worldId === world.id && e.name?.startsWith('Import Test '))
  try {
    for (const [name, img] of sheets) {
      await open(page, `/w/${world.slug}/settings?tab=data`)
      await page.getByRole('button', { name: 'Import character sheet' }).click()
      const actor = { name, img, type: 'character', system: {}, items: [] }
      await page.locator('.sheet-way input[type=file]').setInputFiles({ name: 'actor.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(actor)) })
      await page.getByRole('button', { name: 'Add the character' }).click()
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    }
    // Another website is never asked about or fetched from (the site's security policy would block it anyway).
    expect(asked).toHaveLength(0)
    expect(requested.some((u) => u.includes('tracker.example'))).toBe(false)
    // Never this computer's network, and never asked about.
    expect(requested.some((u) => u.includes('192.168.1.10') || u.includes('printer.local'))).toBe(false)
    // D&D Beyond is fetched without asking (the test refuses every request off this machine, so no picture comes).
    expect(requested.some((u) => u.startsWith('https://www.dndbeyond.com/avatars/'))).toBe(true)
    const made = await ours()
    expect(made.map((e) => e.name).sort()).toEqual(sheets.map(([n]) => n).sort())
    expect(made.every((e) => !e.imageId)).toBe(true)
  } finally {
    await forget(page, 'entities', (await ours()).map((e) => e.id))
  }
})
