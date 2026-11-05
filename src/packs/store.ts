/**
 * The GM's map packs on this device and in the cloud. Packs are local-first like everything else:
 * made and used here straight away, and sent up (rows in map_packs / map_pack_pieces, pictures in
 * the private "map-packs" bucket) when the GM is signed in. Pictures are stored online once, however
 * many worlds use them; a device downloads a piece's full picture the first time it's needed and keeps it.
 * Before the cloud has the tables (supabase/migrations/20261105000000_map_packs.sql) every cloud
 * call quietly fails and packs simply stay on this device.
 */
import { supabase } from '../cloud/client'
import { db, newId, type MapPack, type PackFile, type PackPiece, type PackScene, type PackVersion, type World } from '../db'

const BUCKET = 'map-packs'

/** The signed-in account, if any. */
export async function packUser(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id
  } catch {
    return undefined
  }
}

const key = (pieceId: string, rev: number, version: number, kind: 'full' | 'thumb') => `${pieceId}@${rev}/${version}/${kind}`
const pathOf = (owner: string, pieceId: string, rev: number, version: number, kind: 'full' | 'thumb', ext: string) => `${owner}/${pieceId}/${rev}-${version}-${kind}.${ext}`

/** Live list for screens: the packs on this device that aren't deleted, newest first. */
export const listPacks = async () => (await db.packs.toArray()).filter((p) => !p.deleted).sort((a, b) => b.createdAt - a.createdAt)

/** Makes a new, empty pack. */
export async function createPack(name: string, owner?: string): Promise<MapPack> {
  const now = Date.now()
  const pack: MapPack = { id: newId(), name: name.trim() || 'My pack', createdAt: now, updatedAt: now, pending: true, ...(owner ? { owner } : {}) }
  await db.packs.add(pack)
  return pack
}

export async function renamePack(id: string, name: string) {
  await db.packs.update(id, { name: name.trim() || 'My pack', updatedAt: Date.now(), pending: true })
  void pushPacks()
}

/**
 * Takes a pack off the list. Its pieces stay (hidden), so maps drawn with them never break, and
 * nothing is deleted online for the same reason.
 */
export async function removePack(id: string) {
  await db.transaction('rw', [db.packs, db.packPieces], async () => {
    await db.packs.update(id, { deleted: true, updatedAt: Date.now(), pending: true })
    await db.packPieces.where({ packId: id }).modify({ hidden: true, pending: true, updatedAt: Date.now() })
  })
  void pushPacks()
}

export interface NewPicture {
  full: Blob
  thumb: Blob
  w: number
  h: number
  ext: string
}

export interface NewPiece {
  label: string
  group: string
  scene: PackScene
  cols: number
  rows: number
  light: boolean
  pictures: NewPicture[]
}

/** Adds pieces (with their pictures) to a pack on this device, then sends them up if signed in. */
export async function addPieces(packId: string, pieces: NewPiece[]) {
  const now = Date.now()
  const rows: PackPiece[] = []
  const files: PackFile[] = []
  for (const p of pieces) {
    const id = newId()
    rows.push({
      id,
      packId,
      label: p.label,
      group: p.group,
      scene: p.scene,
      cols: p.cols,
      rows: p.rows,
      ...(p.light ? { light: true } : {}),
      versions: p.pictures.map((x) => ({ w: x.w, h: x.h, ext: x.ext, bytes: x.full.size + x.thumb.size })),
      rev: 1,
      updatedAt: now,
      pending: true,
    })
    p.pictures.forEach((x, v) => {
      files.push({ key: key(id, 1, v, 'full'), pieceId: id, blob: x.full, unsent: true })
      files.push({ key: key(id, 1, v, 'thumb'), pieceId: id, blob: x.thumb, unsent: true })
    })
  }
  await db.transaction('rw', [db.packs, db.packPieces, db.packFiles], async () => {
    await db.packPieces.bulkPut(rows)
    await db.packFiles.bulkPut(files)
    await db.packs.update(packId, { updatedAt: now, pending: true })
  })
  void pushPacks()
  return rows
}

/** Changes a piece's name, group, size or light (not its pictures). */
export async function updatePiece(id: string, patch: Partial<Pick<PackPiece, 'label' | 'group' | 'scene' | 'cols' | 'rows' | 'light' | 'hidden'>>) {
  await db.packPieces.update(id, { ...patch, updatedAt: Date.now(), pending: true })
  void pushPacks()
}

/**
 * New pictures for a piece. Its rev goes up; maps drawn with the old pictures keep them until the
 * GM chooses to swap (World settings › Map pieces), so the old files are kept too.
 */
export async function replacePictures(id: string, pictures: NewPicture[]) {
  const piece = await db.packPieces.get(id)
  if (!piece || !pictures.length) return
  const rev = piece.rev + 1
  const files: PackFile[] = []
  pictures.forEach((x, v) => {
    files.push({ key: key(id, rev, v, 'full'), pieceId: id, blob: x.full, unsent: true })
    files.push({ key: key(id, rev, v, 'thumb'), pieceId: id, blob: x.thumb, unsent: true })
  })
  const versions: PackVersion[] = pictures.map((x) => ({ w: x.w, h: x.h, ext: x.ext, bytes: x.full.size + x.thumb.size }))
  await db.transaction('rw', [db.packPieces, db.packFiles], async () => {
    await db.packFiles.bulkPut(files)
    await db.packPieces.update(id, { rev, versions, older: { ...(piece.older ?? {}), [piece.rev]: piece.versions }, updatedAt: Date.now(), pending: true })
  })
  void pushPacks()
}

// ---------- the cloud ----------

let pushing: Promise<void> | undefined

/**
 * Sends everything made or changed on this device to the cloud, when signed in. Packs made while
 * signed out become the signed-in account's. Failures leave things marked to try again next time.
 */
export function pushPacks(): Promise<void> {
  pushing ??= (async () => {
    try {
      const me = await packUser()
      if (!me) return
      const packs = (await db.packs.toArray()).filter((p) => p.pending && !p.borrowed && (!p.owner || p.owner === me))
      for (const p of packs) {
        const { error } = await supabase.from('map_packs').upsert({ id: p.id, owner: me, name: p.name, deleted: !!p.deleted, updated_at: new Date(p.updatedAt).toISOString() })
        if (error) throw error
        await db.packs.update(p.id, { owner: me, pending: false })
      }
      const mine = new Set((await db.packs.toArray()).filter((p) => !p.borrowed && p.owner === me).map((p) => p.id))
      const pieces = (await db.packPieces.toArray()).filter((x) => x.pending && mine.has(x.packId))
      for (const x of pieces) {
        // the pictures first, so a piece is never online without them
        const files = await db.packFiles.where({ pieceId: x.id }).filter((f) => !!f.unsent).toArray()
        for (const f of files) {
          const [, rest] = f.key.split('@')
          const [rev, version, kind] = rest.split('/')
          const vers = Number(rev) === x.rev ? x.versions : (x.older?.[Number(rev)] ?? x.versions)
          const ext = vers[Number(version)]?.ext ?? 'png'
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(pathOf(me, x.id, Number(rev), Number(version), kind as 'full' | 'thumb', ext), f.blob, { upsert: true, contentType: f.blob.type || `image/${ext}` })
          if (error) throw error
          await db.packFiles.update(f.key, { unsent: false })
        }
        const { id, packId, rev, updatedAt, pending: _p, owner: _o, ...data } = x
        const { error } = await supabase.from('map_pack_pieces').upsert({ id, pack_id: packId, owner: me, rev, data, updated_at: new Date(updatedAt).toISOString() })
        if (error) throw error
        await db.packPieces.update(id, { owner: me, pending: false })
      }
    } catch (e) {
      console.info('Map packs stay on this device for now', e)
    } finally {
      pushing = undefined
    }
  })()
  return pushing
}

type PieceRow = { id: string; pack_id: string; owner: string; rev: number; data: Omit<PackPiece, 'id' | 'packId' | 'rev' | 'updatedAt' | 'owner'>; updated_at: string }
const fromRow = (r: PieceRow): PackPiece => ({ ...r.data, id: r.id, packId: r.pack_id, owner: r.owner, rev: r.rev, updatedAt: Date.parse(r.updated_at) || Date.now() })

/**
 * Brings the signed-in GM's packs from the cloud onto this device (just the lists and sizes; the
 * pictures come when they're needed). Anything changed here and not yet sent is left alone.
 */
export async function pullPacks(): Promise<boolean> {
  const me = await packUser()
  if (!me) return false
  await pushPacks()
  const { data: packs, error } = await supabase.from('map_packs').select('id, owner, name, deleted, created_at, updated_at').eq('owner', me)
  if (error || !packs) return false
  const { data: pieces, error: e2 } = packs.length ? await supabase.from('map_pack_pieces').select('id, pack_id, owner, rev, data, updated_at').in('pack_id', packs.map((p) => p.id)) : { data: [], error: null }
  if (e2 || !pieces) return false
  await db.transaction('rw', [db.packs, db.packPieces], async () => {
    for (const p of packs) {
      const here = await db.packs.get(p.id)
      if (here?.pending) continue
      await db.packs.put({ id: p.id, owner: p.owner, name: p.name, deleted: p.deleted || undefined, createdAt: Date.parse(p.created_at), updatedAt: Date.parse(p.updated_at) })
    }
    for (const r of pieces as PieceRow[]) {
      const here = await db.packPieces.get(r.id)
      if (here?.pending) continue
      await db.packPieces.put(fromRow(r))
    }
  })
  return true
}

/**
 * The details of one piece this device doesn't have yet: another GM's piece on a shared world's
 * map, say. Kept as "borrowed" so it isn't listed as the GM's own.
 */
export async function fetchPieceMeta(pieceId: string): Promise<PackPiece | undefined> {
  const { data, error } = await supabase.from('map_pack_pieces').select('id, pack_id, owner, rev, data, updated_at').eq('id', pieceId).maybeSingle()
  if (error || !data) return undefined
  const piece = fromRow(data as PieceRow)
  if (!(await db.packs.get(piece.packId))) {
    const { data: pack } = await supabase.from('map_packs').select('id, owner, name, created_at, updated_at').eq('id', piece.packId).maybeSingle()
    const now = Date.now()
    await db.packs.put({ id: piece.packId, name: pack?.name ?? 'Another GM’s pack', owner: pack?.owner ?? piece.owner, createdAt: now, updatedAt: now, borrowed: true })
  }
  await db.packPieces.put(piece)
  return piece
}

/**
 * The packs a world has on that this device doesn't have: a co-GM's packs on a shared world. Kept
 * as "borrowed", so they show in the map builder but never on this GM's own Map packs screen.
 */
export async function pullWorldPacks(ids: string[]) {
  const missing = []
  for (const id of ids) {
    const here = await db.packs.get(id)
    if (!here || here.borrowed) missing.push(id)
  }
  if (!missing.length || !(await packUser())) return
  try {
    const { data: packs } = await supabase.from('map_packs').select('id, owner, name, deleted, created_at, updated_at').in('id', missing)
    if (!packs?.length) return
    const { data: pieces } = await supabase.from('map_pack_pieces').select('id, pack_id, owner, rev, data, updated_at').in('pack_id', packs.map((p) => p.id))
    await db.transaction('rw', [db.packs, db.packPieces], async () => {
      for (const p of packs) await db.packs.put({ id: p.id, owner: p.owner, name: p.name, deleted: p.deleted || undefined, createdAt: Date.parse(p.created_at), updatedAt: Date.parse(p.updated_at), borrowed: true })
      for (const r of (pieces ?? []) as PieceRow[]) await db.packPieces.put(fromRow(r))
    })
  } catch {
    // offline, or before the cloud has packs
  }
}

/** One picture of a piece: from this device, or else downloaded from the cloud and kept here. */
export async function fetchPackFile(piece: PackPiece, rev: number, version: number, kind: 'full' | 'thumb'): Promise<Blob | undefined> {
  const k = key(piece.id, rev, version, kind)
  const here = await db.packFiles.get(k)
  if (here) return here.blob
  if (!piece.owner) return undefined
  const ext = (rev === piece.rev ? piece.versions : (piece.older?.[rev] ?? piece.versions))[version]?.ext ?? 'png'
  const { data, error } = await supabase.storage.from(BUCKET).download(pathOf(piece.owner, piece.id, rev, version, kind, ext))
  if (error || !data) return undefined
  await db.packFiles.put({ key: k, pieceId: piece.id, blob: data })
  return data
}

/** Whether a piece's newest full pictures are all on this device. */
export async function isOnDevice(piece: PackPiece) {
  const keys = piece.versions.map((_, v) => key(piece.id, piece.rev, v, 'full'))
  return (await db.packFiles.bulkGet(keys)).every(Boolean)
}

/** Downloads the previews of these pieces (all versions), for the picker. */
export async function fetchThumbs(pieces: PackPiece[]) {
  await Promise.all(pieces.flatMap((p) => p.versions.map((_, v) => fetchPackFile(p, p.rev, v, 'thumb').catch(() => undefined))))
}

/** Downloads every full picture of a pack, for playing with no internet. Reports how many are done. */
export async function keepPackOnDevice(packId: string, onProgress?: (done: number, total: number) => void) {
  const pieces = (await db.packPieces.where({ packId }).toArray()).filter((p) => !p.hidden)
  const jobs = pieces.flatMap((p) => p.versions.map((_, v) => () => fetchPackFile(p, p.rev, v, 'full')))
  let done = 0
  let failed = 0
  for (const job of jobs) {
    if (!(await job().catch(() => undefined))) failed++
    onProgress?.(++done, jobs.length)
  }
  return { total: jobs.length, failed }
}

/** Bytes of pictures from a pack kept on this device. */
export async function bytesOnDevice(packId: string) {
  const ids = (await db.packPieces.where({ packId }).toArray()).map((p) => p.id)
  if (!ids.length) return 0
  const files = await db.packFiles.where('pieceId').anyOf(ids).toArray()
  return files.reduce((n, f) => n + f.blob.size, 0)
}

/** Which of this world's map packs are switched on. */
export const worldPacks = (w: World | undefined) => w?.gmScreen?.mapPacks ?? []

/**
 * Switches a pack on or off for a world. On a synced world the cloud is told too, so the world's
 * co-GMs can read the pack's pieces (and draw its maps); they can't change them.
 */
export async function setWorldPack(world: World, packId: string, on: boolean) {
  const now = new Set(worldPacks(world))
  if (on) now.add(packId)
  else now.delete(packId)
  const gmScreen = { pages: [], rolls: [], ...(world.gmScreen ?? {}), mapPacks: [...now] }
  await db.worlds.update(world.id, { gmScreen, updatedAt: Date.now() })
  if (world.cloud?.enabled) void tellCloud(world.id, packId, on)
}

async function tellCloud(worldId: string, packId: string, on: boolean) {
  try {
    await pushPacks()
    if (on) await supabase.from('world_packs').upsert({ world_id: worldId, pack_id: packId }, { ignoreDuplicates: true })
    else await supabase.from('world_packs').delete().eq('world_id', worldId).eq('pack_id', packId)
  } catch {
    // before the cloud has packs: only co-GMs miss out, and only until it's switched on again
  }
}

/** On a synced world, makes sure the cloud knows its packs (a pack switched on before sync was). */
export async function shareWorldPacks(world: World) {
  if (!world.cloud?.enabled) return
  for (const id of worldPacks(world)) {
    const pack = await db.packs.get(id)
    if (pack && !pack.borrowed) await tellCloud(world.id, id, true)
  }
}

/** Removes every pack picture the signed-in GM has online (for deleting their account). */
export async function deleteMyPackFiles() {
  const me = await packUser()
  if (!me) return
  const { data: folders } = await supabase.storage.from(BUCKET).list(me, { limit: 1000 })
  for (const f of folders ?? []) {
    const { data: files } = await supabase.storage.from(BUCKET).list(`${me}/${f.name}`, { limit: 1000 })
    if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((x) => `${me}/${f.name}/${x.name}`))
  }
}
