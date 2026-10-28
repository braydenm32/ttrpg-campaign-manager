import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { db, newId, type Asset, type Board, type Campaign, type Entity, type Pin, type Session, type Sound, type World, type WorldMap } from './db'

/**
 * A whole world in one file, for backups and moving between devices. Version 2 is a .zip holding
 * world.json plus every uploaded file as it is (fast, and fine for hours of recordings). Version 1,
 * still read, was a single .json with files written out as text (base64), which large worlds outgrew.
 */
interface WorldBackup {
  format: 'campaign-codex-world'
  version: 1 | 2
  exportedAt: string
  world: World
  campaigns: Campaign[]
  entities: Entity[]
  maps: WorldMap[]
  pins: Pin[]
  sessions: Session[]
  /** v1: the file as base64 in data. v2: the file is in the zip at files/<id>. */
  assets: (Omit<Asset, 'blob'> & { data?: string })[]
  /** Added later; older backups don't have them. */
  boards?: Board[]
  sounds?: Sound[]
}

/** When this device last downloaded a backup of a world, and when a reminder was put off until (device-only). */
export const backupStore = {
  read: (worldId: string, what: 'last' | 'snooze') => {
    try {
      return Number(localStorage.getItem(`codex.backup.${what}.${worldId}`)) || 0
    } catch {
      return 0
    }
  },
  write: (worldId: string, what: 'last' | 'snooze', at: number) => {
    try {
      localStorage.setItem(`codex.backup.${what}.${worldId}`, String(at))
    } catch {
      // Storage blocked: the reminder just comes back next time.
    }
  },
}

export async function exportWorld(worldId: string) {
  const world = await db.worlds.get(worldId)
  if (!world) throw new Error('World not found')
  const campaigns = await db.campaigns.where({ worldId }).toArray()
  const maps = await db.maps.where({ worldId }).toArray()
  const { cloud: _cloud, shared: _shared, ...plainWorld } = world
  const assets = await db.assets.where({ worldId }).toArray()
  const backup: WorldBackup = {
    format: 'campaign-codex-world',
    version: 2,
    exportedAt: new Date().toISOString(),
    world: plainWorld,
    campaigns,
    entities: await db.entities.where({ worldId }).toArray(),
    maps,
    pins: await db.pins.where({ worldId }).toArray(),
    sessions: await db.sessions.where({ worldId }).toArray(),
    boards: await db.boards.where({ worldId }).toArray(),
    sounds: await db.sounds.where({ worldId }).toArray(),
    assets: assets.map(({ blob: _blob, ...a }) => a),
  }
  const zip: Zippable = { 'world.json': strToU8(JSON.stringify(backup)) }
  // Pictures and audio are already compressed, so they're stored as they are.
  for (const a of assets) zip[`files/${a.id}`] = [new Uint8Array(await a.blob.arrayBuffer()), { level: 0 }]
  const file = new Blob([zipSync(zip) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = `${world.name.replace(/[^\w-]+/g, '_')}-${backup.exportedAt.slice(0, 10)}.codex.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  backupStore.write(worldId, 'last', Date.now())
}

/** Imports a backup as a new copy of the world (fresh ids), so importing twice never overwrites anything. */
export async function importWorld(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  // A zip starts with "PK".
  const files = bytes[0] === 0x50 && bytes[1] === 0x4b ? unzipSync(bytes) : undefined
  let b: WorldBackup
  try {
    b = JSON.parse(files ? strFromU8(files['world.json'] ?? new Uint8Array()) : strFromU8(bytes)) as WorldBackup
  } catch {
    throw new Error('This file is not a Warded Atlas world backup.')
  }
  if (b.format !== 'campaign-codex-world') throw new Error('This file is not a Warded Atlas world backup.')
  const fileOf = (a: WorldBackup['assets'][number]) =>
    a.data !== undefined ? base64ToBlob(a.data, a.mime) : new Blob([(files?.[`files/${a.id}`] ?? new Uint8Array()) as Uint8Array<ArrayBuffer>], { type: a.mime })
  const ids = new Map<string, string>()
  const id = (old: string) => {
    if (!ids.has(old)) ids.set(old, newId())
    return ids.get(old)!
  }
  const opt = (old?: string) => (old ? id(old) : undefined)
  // Pictures in text point at files by id, and the files get new ids.
  const pics = <T extends string | undefined>(t: T): T => (t ? (t.replace(/asset:([0-9a-fA-F-]{36})/g, (m, old: string) => (ids.has(old) ? `asset:${ids.get(old)}` : m)) as T) : t)
  const worldId = id(b.world.id)
  const now = Date.now()

  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets, db.boards, db.sounds], async () => {
    const showing = b.world.showing
    await db.worlds.add({
      ...b.world,
      id: worldId,
      name: b.world.name,
      updatedAt: now,
      cloud: undefined,
      shared: undefined,
      coverId: opt(b.world.coverId),
      showing: showing ? { ...showing, assetId: opt(showing.assetId), entityId: opt(showing.entityId) } : undefined,
      handouts: b.world.handouts?.map((h) => ({ ...h, assetId: opt(h.assetId), entityId: opt(h.entityId) })),
    })
    await db.assets.bulkAdd(
      b.assets.map(({ data: _data, ...a }) => ({ ...a, id: id(a.id), worldId, blob: fileOf({ ...a, data: _data }) })),
    )
    await db.campaigns.bulkAdd(b.campaigns.map((c) => ({ ...c, id: id(c.id), worldId })))
    await db.entities.bulkAdd(
      b.entities.map((e) => ({
        ...e,
        id: id(e.id),
        worldId,
        body: pics(e.body),
        gmNotes: pics(e.gmNotes),
        playerBody: pics(e.playerBody),
        parentId: opt(e.parentId),
        imageId: opt(e.imageId),
        raisedIn: opt(e.raisedIn),
        campaignId: opt(e.campaignId),
        tiedOffIn: opt(e.tiedOffIn),
        heldBy: e.heldBy === 'party' ? 'party' : opt(e.heldBy),
        relations: e.relations?.map((r) => ({ ...r, to: id(r.to) })),
      })),
    )
    await db.maps.bulkAdd(
      b.maps.map((m) => ({
        ...m,
        id: id(m.id),
        worldId,
        imageId: id(m.imageId),
        playerImageId: opt(m.playerImageId),
        locationId: opt(m.locationId),
        fog: m.fog && { ...m.fog, imageId: opt(m.fog.imageId), renderedFrom: undefined },
      })),
    )
    await db.pins.bulkAdd(
      b.pins.map((p) => ({ ...p, id: id(p.id), worldId, mapId: id(p.mapId), entityId: opt(p.entityId), childMapId: opt(p.childMapId) })),
    )
    await db.sessions.bulkAdd(
      b.sessions.map((s) => ({
        ...s,
        id: id(s.id),
        worldId,
        campaignId: id(s.campaignId),
        notes: pics(s.notes),
        recap: pics(s.recap),
        entityIds: s.entityIds.map(id),
        recordings: s.recordings.map((r) => ({ ...r, assetId: id(r.assetId) })),
        ledger: s.ledger?.map((l) => ({ ...l, entityId: opt(l.entityId) })),
        // The Lectern points at pages: the scene, who's present and who's in the fight.
        lectern: s.lectern && {
          ...s.lectern,
          sceneId: opt(s.lectern.sceneId),
          presentIds: s.lectern.presentIds.map(id),
          combat: { ...s.lectern.combat, combatants: s.lectern.combat.combatants.map((c) => ({ ...c, entityId: opt(c.entityId) })) },
        },
        prep: s.prep && {
          ...s.prep,
          encounters: s.prep.encounters.map((enc) => ({ ...enc, foes: enc.foes.map((f) => ({ ...f, entityId: opt(f.entityId) })) })),
        },
      })),
    )
    await db.boards.bulkAdd(
      (b.boards ?? []).map((x) => {
        // Card ids are only used inside the board, so they keep theirs.
        return { ...x, id: id(x.id), worldId, cards: x.cards.map((c) => ({ ...c, entityId: opt(c.entityId) })) }
      }),
    )
    await db.sounds.bulkAdd((b.sounds ?? []).map((x) => ({ ...x, id: id(x.id), worldId, assetId: opt(x.assetId) })))
  })
  return worldId
}

function base64ToBlob(data: string, mime: string) {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
