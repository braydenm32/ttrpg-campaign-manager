import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import type { Table } from 'dexie'
import { BIN_KEEP_FOR, db, newId, type Asset, type BinItem, type Board, type Campaign, type Session, type Sound, type WorldMap } from './db'

/**
 * The recently deleted bin: sessions, campaigns, files, maps, boards and sounds deleted on this
 * device are kept for a month, so a slip of the finger can be undone. (Pages have their own history.)
 * Deleting still reaches other devices through sync; restoring puts the rows back, and sync sends
 * them out again. Things deleted on another device land here too, so a co-GM's slip can be undone.
 */

type Rows = BinItem['rows']
type Relinks = NonNullable<BinItem['relinks']>

/** The pins or pages a relink touches. */
const linkTable = (l: Relinks[number]) => db[l.table] as unknown as Table<Record<string, unknown>, string>

const BIN_TABLES = [db.bin, db.campaigns, db.sessions, db.assets, db.boards, db.sounds, db.maps, db.pins, db.entities]

async function moveToBin(worldId: string, kind: BinItem['kind'], label: string, rows: Rows, relinks: Relinks = []) {
  await db.transaction('rw', BIN_TABLES, async () => {
    const links = relinks.filter((l) => l.ids.length)
    await db.bin.add({ id: newId(), worldId, at: Date.now(), kind, label, rows: rows.filter((r) => r.rows.length), ...(links.length ? { relinks: links } : {}) })
    for (const l of links) await linkTable(l).where(':id').anyOf(l.ids).modify({ [l.field]: undefined })
    for (const r of rows) await db[r.table].bulkDelete((r.rows as { id: string }[]).map((x) => x.id))
  })
}

const present = <T>(xs: (T | undefined)[]) => xs.filter((x): x is T => !!x)

export async function binSession(id: string) {
  const s = await db.sessions.get(id)
  if (!s) return
  const recordings = present(await db.assets.bulkGet(s.recordings.map((r) => r.assetId)))
  await moveToBin(s.worldId, 'session', `#${s.number} ${s.title}`.trim(), [
    { table: 'sessions', rows: [s] },
    { table: 'assets', rows: recordings },
  ])
}

export async function binCampaign(id: string) {
  const c = await db.campaigns.get(id)
  if (!c) return
  const sessions = await db.sessions.where({ campaignId: id }).toArray()
  const recordings = present(await db.assets.bulkGet(sessions.flatMap((s) => s.recordings.map((r) => r.assetId))))
  // Its characters would otherwise belong to a campaign that's gone, and drop out of every party.
  const pcs = await db.entities.where({ worldId: c.worldId }).filter((e) => e.campaignId === id).primaryKeys()
  await moveToBin(
    c.worldId,
    'campaign',
    c.name,
    [
      { table: 'campaigns', rows: [c] },
      { table: 'sessions', rows: sessions },
      { table: 'assets', rows: recordings },
    ],
    [{ table: 'entities', field: 'campaignId', value: id, ids: pcs }],
  )
}

export async function binFile(id: string) {
  const a = await db.assets.get(id)
  if (a) await moveToBin(a.worldId, 'file', a.name, [{ table: 'assets', rows: [a] }])
}

export async function binBoard(id: string) {
  const b = await db.boards.get(id)
  if (b) await moveToBin(b.worldId, 'board', b.name, [{ table: 'boards', rows: [b] }])
}

/** Removes a soundboard button, and its file when no other button uses it. */
export async function binSound(id: string) {
  const s = await db.sounds.get(id)
  if (!s) return
  const shared = s.assetId ? await db.sounds.where({ worldId: s.worldId }).filter((x) => x.id !== id && x.assetId === s.assetId).count() : 1
  const file = !shared && s.assetId ? await db.assets.get(s.assetId) : undefined
  await moveToBin(s.worldId, 'sound', s.name, [
    { table: 'sounds', rows: [s] },
    { table: 'assets', rows: present([file]) },
  ])
}

/** Deletes a map with its pins, its picture (unless something else uses it) and the players' copies (fogged, or without the secrets). */
export async function binMap(id: string) {
  const m = await db.maps.get(id)
  if (!m) return
  const pins = await db.pins.where({ mapId: id }).toArray()
  const usedElsewhere =
    (await db.maps.where({ worldId: m.worldId }).filter((x) => x.id !== id && x.imageId === m.imageId).count()) +
    (await db.entities.where({ worldId: m.worldId }).filter((e) => e.imageId === m.imageId).count())
  const files = present(await db.assets.bulkGet([usedElsewhere ? undefined : m.imageId, m.fog?.imageId, m.playerImageId].filter((x): x is string => !!x)))
  // Pins on other maps that led into this one stop leading anywhere; restoring it puts them back.
  const ways = await db.pins.where({ worldId: m.worldId }).filter((p) => p.childMapId === id && p.mapId !== id).primaryKeys()
  await moveToBin(
    m.worldId,
    'map',
    m.name,
    [
      { table: 'maps', rows: [m] },
      { table: 'pins', rows: pins },
      { table: 'assets', rows: files },
    ],
    [{ table: 'pins', field: 'childMapId', value: id, ids: ways }],
  )
}

type Removed = { table: BinItem['rows'][number]['table']; row: Record<string, unknown> }

/**
 * Keeps what a sync just removed because it was deleted on another device, as one bin item per
 * sync. Pins only count with their map; anything else (a session, a file) is kept on its own too.
 */
export async function binRemovedElsewhere(worldId: string, removed: Removed[]) {
  const maps = removed.filter((r) => r.table === 'maps').map((r) => r.row as unknown as WorldMap)
  const mapIds = new Set(maps.map((m) => m.id))
  const mapPictures = new Set(maps.flatMap((m) => [m.imageId, m.playerImageId, m.fog?.imageId]))
  // The players' copies of a map's picture are remade by the map, so on their own they aren't worth keeping.
  const remade = (a: Asset) => !mapPictures.has(a.id) && (a.tags.includes('fog') || (a.tags.includes('drawn') && a.tags.includes('players')))
  const kept = removed.filter((r) => (r.table === 'pins' ? mapIds.has(r.row.mapId as string) : r.table !== 'assets' || !remade(r.row as unknown as Asset)))
  if (!kept.some((r) => r.table !== 'pins')) return
  const name = (r: Removed) => {
    if (r.table === 'sessions') return `#${(r.row as unknown as Session).number} ${(r.row as unknown as Session).title}`.trim()
    return (r.row as unknown as Campaign | WorldMap | Board | Sound | Asset).name
  }
  const names = kept.filter((r) => r.table !== 'pins').map(name)
  const rows: Rows = []
  for (const r of kept) {
    const group = rows.find((x) => x.table === r.table)
    if (group) group.rows.push(r.row)
    else rows.push({ table: r.table, rows: [r.row] })
  }
  const label = `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}`
  await db.bin.add({ id: newId(), worldId, at: Date.now(), kind: 'elsewhere', label, rows })
}

export async function restoreFromBin(id: string) {
  const item = await db.bin.get(id)
  if (!item) return
  await db.transaction('rw', BIN_TABLES, async () => {
    for (const r of item.rows) await (db[r.table] as unknown as { bulkPut: (rows: unknown[]) => Promise<unknown> }).bulkPut(r.rows)
    // Only links still missing go back: a pin that has since been pointed somewhere else stays as it is.
    for (const l of item.relinks ?? [])
      await linkTable(l)
        .where(':id')
        .anyOf(l.ids)
        .filter((x) => !x[l.field])
        .modify({ [l.field]: l.value })
    await db.bin.delete(id)
  })
}

/** Removes something from the bin for good. */
export const deleteFromBin = (id: string) => db.bin.delete(id)

/** Empties this world's bin. */
export const emptyBin = (worldId: string) => db.bin.where({ worldId }).delete()

/** How much space the files in bin items take. */
export const binSize = (item: BinItem) =>
  item.rows.filter((r) => r.table === 'assets').reduce((n, r) => n + (r.rows as Asset[]).reduce((m, a) => m + (a.size || 0), 0), 0)

/** Things in this world's bin, newest first. Anything older than a month is cleared out. */
export function useBin(worldId: string) {
  useEffect(() => {
    db.bin.where('at').below(Date.now() - BIN_KEEP_FOR).delete()
  }, [])
  return useLiveQuery(() => db.bin.where({ worldId }).reverse().sortBy('at'), [worldId]) ?? []
}
