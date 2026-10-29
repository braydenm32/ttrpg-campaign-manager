import { strFromU8, strToU8, unzipSync, Zip, ZipDeflate, ZipPassThrough } from 'fflate'
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
  /** Set when the session recordings' audio was left out on purpose. The sessions, bookmarks and transcripts are all still here. */
  recordingsLeftOut?: { count: number; bytes: number }
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

/**
 * Downloads a backup of a world. The zip is built a piece at a time, so a world with hours of
 * recordings doesn't have to fit in memory two or three times over (which could crash a phone or
 * tablet). `onProgress` hears how many files are in so far. Recording audio is the bulk of a big
 * world, so it is only included when `recordings` is true (transcripts and bookmarks always are).
 */
export async function exportWorld(worldId: string, onProgress?: (done: number, total: number) => void, { recordings = false }: { recordings?: boolean } = {}) {
  const world = await db.worlds.get(worldId)
  if (!world) throw new Error('World not found')
  const campaigns = await db.campaigns.where({ worldId }).toArray()
  const maps = await db.maps.where({ worldId }).toArray()
  const { cloud: _cloud, shared: _shared, ...plainWorld } = world
  const sessions = await db.sessions.where({ worldId }).toArray()
  const recorded = await recordingAssetIds(worldId, sessions)
  const all = await db.assets.where({ worldId }).toArray()
  const left = recordings ? [] : all.filter((a) => recorded.has(a.id))
  const assets = recordings ? all : all.filter((a) => !recorded.has(a.id))
  const backup: WorldBackup = {
    format: 'campaign-codex-world',
    version: 2,
    exportedAt: new Date().toISOString(),
    world: plainWorld,
    campaigns,
    entities: await db.entities.where({ worldId }).toArray(),
    maps,
    pins: await db.pins.where({ worldId }).toArray(),
    sessions,
    boards: await db.boards.where({ worldId }).toArray(),
    sounds: await db.sounds.where({ worldId }).toArray(),
    assets: assets.map(({ blob: _blob, ...a }) => a),
    ...(left.length ? { recordingsLeftOut: { count: left.length, bytes: left.reduce((n, a) => n + a.size, 0) } } : {}),
  }

  // The zip comes out in pieces; every so often they're joined into one Blob, which the browser can
  // keep on disk rather than in memory.
  let parts: BlobPart[] = []
  let held = 0
  let fail: (err: Error) => void = () => {}
  let finish: () => void = () => {}
  const finished = new Promise<void>((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  const zip = new Zip((err, chunk, final) => {
    if (err) return fail(err)
    parts.push(chunk as Uint8Array<ArrayBuffer>)
    held += chunk.length
    if (held > 64 * 1024 * 1024) {
      parts = [new Blob(parts)]
      held = 0
    }
    if (final) finish()
  })
  const json = new ZipDeflate('world.json', { level: 6 })
  zip.add(json)
  json.push(strToU8(JSON.stringify(backup)), true)
  // Pictures and audio are already compressed, so they're stored as they are, read a slice at a time.
  const SLICE = 8 * 1024 * 1024
  for (const [i, a] of assets.entries()) {
    onProgress?.(i, assets.length)
    const entry = new ZipPassThrough(`files/${a.id}`)
    zip.add(entry)
    if (!a.blob.size) entry.push(new Uint8Array(), true)
    for (let at = 0; at < a.blob.size; at += SLICE)
      entry.push(new Uint8Array(await a.blob.slice(at, at + SLICE).arrayBuffer()), at + SLICE >= a.blob.size)
  }
  zip.end()
  await finished
  onProgress?.(assets.length, assets.length)
  const file = new Blob(parts, { type: 'application/zip' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(file)
  // Any letters (Zoë, Ægir, 龍) stay in the name; only characters file systems refuse are swapped.
  link.download = `${world.name.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^[._]+|_+$/g, '') || 'world'}-${backup.exportedAt.slice(0, 10)}.codex.zip`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 60_000)
  backupStore.write(worldId, 'last', Date.now())
}

/** The ids of the files that are session recordings (audio), which are by far the biggest. */
async function recordingAssetIds(worldId: string, sessions?: Session[]) {
  return new Set((sessions ?? (await db.sessions.where({ worldId }).toArray())).flatMap((s) => s.recordings.map((r) => r.assetId)))
}

/** How much space this world's session recordings take (for the backup's "include recordings" choice). */
export async function recordingsSize(worldId: string) {
  const ids = [...(await recordingAssetIds(worldId))]
  return (await db.assets.bulkGet(ids)).reduce((n, a) => n + (a?.size ?? 0), 0)
}

/** Imports a backup as a new copy of the world (fresh ids), so importing twice never overwrites anything. */
export async function importWorld(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  // A zip starts with "PK".
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  // One file at a time out of the zip, so a big backup isn't unpacked into memory all at once.
  const entry = (name: string) => unzipSync(bytes, { filter: (f) => f.name === name })[name] as Uint8Array<ArrayBuffer> | undefined
  let b: WorldBackup
  try {
    b = JSON.parse(isZip ? strFromU8(entry('world.json') ?? new Uint8Array()) : strFromU8(bytes)) as WorldBackup
  } catch {
    throw new Error(
      isZip ? 'This backup file is damaged or incomplete (it may not have finished downloading). Try another copy.' : 'This file is not a Warded Atlas world backup.',
    )
  }
  if (b.format !== 'campaign-codex-world') throw new Error('This file is not a Warded Atlas world backup.')
  const missing: string[] = []
  const blobs = new Map<string, Blob>()
  for (const a of b.assets) {
    if (a.data !== undefined) {
      blobs.set(a.id, base64ToBlob(a.data, a.mime))
      continue
    }
    let data: Uint8Array<ArrayBuffer> | undefined
    try {
      data = isZip ? entry(`files/${a.id}`) : undefined
    } catch {
      data = undefined
    }
    if (!data && a.size) missing.push(a.name)
    blobs.set(a.id, new Blob([data ?? new Uint8Array()], { type: a.mime }))
  }
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
      b.assets.map(({ data: _data, ...a }) => ({ ...a, id: id(a.id), worldId, blob: blobs.get(a.id)! })),
    )
    await db.campaigns.bulkAdd(b.campaigns.map((c) => ({ ...c, id: id(c.id), worldId })))
    await db.entities.bulkAdd(
      // Who each page was shown to belongs to the old world's players: a copy starts with nobody,
      // so someone who plays in both doesn't see pages the GM never chose to show them here.
      b.entities.map(({ revealedTo: _r, secretForYou: _s, ...e }) => ({
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
  if (missing.length)
    alert(
      `The world was imported, but ${missing.length === 1 ? 'one file was' : `${missing.length} files were`} missing from the backup and came in empty: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}. The backup may be damaged; if you have another copy, try that one too.`,
    )
  return worldId
}

function base64ToBlob(data: string, mime: string) {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
