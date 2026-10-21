import { db, newId, type Asset, type Campaign, type Entity, type Pin, type Session, type World, type WorldMap } from './db'

/** A whole world in one JSON file, including uploaded files (base64). Used for backups and moving between devices. */
interface WorldBackup {
  format: 'campaign-codex-world'
  version: 1
  exportedAt: string
  world: World
  campaigns: Campaign[]
  entities: Entity[]
  maps: WorldMap[]
  pins: Pin[]
  sessions: Session[]
  assets: (Omit<Asset, 'blob'> & { data: string })[]
}

export async function exportWorld(worldId: string) {
  const world = await db.worlds.get(worldId)
  if (!world) throw new Error('World not found')
  const campaigns = await db.campaigns.where({ worldId }).toArray()
  const maps = await db.maps.where({ worldId }).toArray()
  const backup: WorldBackup = {
    format: 'campaign-codex-world',
    version: 1,
    exportedAt: new Date().toISOString(),
    world,
    campaigns,
    entities: await db.entities.where({ worldId }).toArray(),
    maps,
    pins: await db.pins.where('mapId').anyOf(maps.map((m) => m.id)).toArray(),
    sessions: await db.sessions.where('campaignId').anyOf(campaigns.map((c) => c.id)).toArray(),
    assets: await Promise.all(
      (await db.assets.where({ worldId }).toArray()).map(async ({ blob, ...a }) => ({ ...a, data: await blobToBase64(blob) })),
    ),
  }
  const file = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = `${world.name.replace(/[^\w-]+/g, '_')}-${backup.exportedAt.slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Imports a backup as a new copy of the world (fresh ids), so importing twice never overwrites anything. */
export async function importWorld(file: File): Promise<string> {
  const b = JSON.parse(await file.text()) as WorldBackup
  if (b.format !== 'campaign-codex-world') throw new Error('This file is not a Campaign Codex world backup.')
  const ids = new Map<string, string>()
  const id = (old: string) => {
    if (!ids.has(old)) ids.set(old, newId())
    return ids.get(old)!
  }
  const opt = (old?: string) => (old ? id(old) : undefined)
  const worldId = id(b.world.id)
  const now = Date.now()

  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets], async () => {
    await db.worlds.add({ ...b.world, id: worldId, name: b.world.name, updatedAt: now })
    await db.assets.bulkAdd(
      b.assets.map(({ data, ...a }) => ({ ...a, id: id(a.id), worldId, blob: base64ToBlob(data, a.mime) })),
    )
    await db.campaigns.bulkAdd(b.campaigns.map((c) => ({ ...c, id: id(c.id), worldId })))
    await db.entities.bulkAdd(
      b.entities.map((e) => ({ ...e, id: id(e.id), worldId, parentId: opt(e.parentId), imageId: opt(e.imageId) })),
    )
    await db.maps.bulkAdd(
      b.maps.map((m) => ({ ...m, id: id(m.id), worldId, imageId: id(m.imageId), locationId: opt(m.locationId) })),
    )
    await db.pins.bulkAdd(
      b.pins.map((p) => ({ ...p, id: id(p.id), mapId: id(p.mapId), entityId: opt(p.entityId), childMapId: opt(p.childMapId) })),
    )
    await db.sessions.bulkAdd(
      b.sessions.map((s) => ({
        ...s,
        id: id(s.id),
        campaignId: id(s.campaignId),
        entityIds: s.entityIds.map(id),
        recordings: s.recordings.map((r) => ({ ...r, assetId: id(r.assetId) })),
      })),
    )
  })
  return worldId
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function base64ToBlob(data: string, mime: string) {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
