import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db, newId, type BinItem } from './db'

/**
 * The recently deleted bin: sessions, campaigns, files, maps, boards and sounds deleted on this
 * device are kept for a month, so a slip of the finger can be undone. (Pages have their own history.)
 * Deleting still reaches other devices through sync; restoring puts the rows back, and sync sends
 * them out again.
 */

const KEEP_FOR = 30 * 24 * 60 * 60_000

type Rows = BinItem['rows']

async function moveToBin(worldId: string, kind: BinItem['kind'], label: string, rows: Rows) {
  await db.transaction('rw', [db.bin, db.campaigns, db.sessions, db.assets, db.boards, db.sounds, db.maps, db.pins], async () => {
    await db.bin.add({ id: newId(), worldId, at: Date.now(), kind, label, rows: rows.filter((r) => r.rows.length) })
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
  await moveToBin(c.worldId, 'campaign', c.name, [
    { table: 'campaigns', rows: [c] },
    { table: 'sessions', rows: sessions },
    { table: 'assets', rows: recordings },
  ])
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

/** Deletes a map with its pins, its picture (unless something else uses it) and the players' fogged copy. */
export async function binMap(id: string) {
  const m = await db.maps.get(id)
  if (!m) return
  const pins = await db.pins.where({ mapId: id }).toArray()
  const usedElsewhere =
    (await db.maps.where({ worldId: m.worldId }).filter((x) => x.id !== id && x.imageId === m.imageId).count()) +
    (await db.entities.where({ worldId: m.worldId }).filter((e) => e.imageId === m.imageId).count())
  const files = present(await db.assets.bulkGet([usedElsewhere ? undefined : m.imageId, m.fog?.imageId].filter((x): x is string => !!x)))
  await db.pins.filter((p) => p.childMapId === id).modify({ childMapId: undefined })
  await moveToBin(m.worldId, 'map', m.name, [
    { table: 'maps', rows: [m] },
    { table: 'pins', rows: pins },
    { table: 'assets', rows: files },
  ])
}

export async function restoreFromBin(id: string) {
  const item = await db.bin.get(id)
  if (!item) return
  await db.transaction('rw', [db.bin, db.campaigns, db.sessions, db.assets, db.boards, db.sounds, db.maps, db.pins], async () => {
    for (const r of item.rows) await (db[r.table] as unknown as { bulkPut: (rows: unknown[]) => Promise<unknown> }).bulkPut(r.rows)
    await db.bin.delete(id)
  })
}

/** Things in this world's bin, newest first. Anything older than a month is cleared out. */
export function useBin(worldId: string) {
  useEffect(() => {
    db.bin.where('at').below(Date.now() - KEEP_FOR).delete()
  }, [])
  return useLiveQuery(() => db.bin.where({ worldId }).reverse().sortBy('at'), [worldId]) ?? []
}
