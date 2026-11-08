/**
 * Map-pack pieces in world backups. A backup holds the pieces its maps are drawn with (just the
 * sets of pictures they use), so it opens complete on any device, signed in or not. Pieces keep
 * their ids; on import they're added as borrowed unless this device has them already.
 */
import { db, type MapPack, type PackFile, type PackPiece, type PackVersion, type WorldMap } from '../db'
import { fileKey, packPiecesIn, parsePackAsset, versionsOf } from './art'
import { fetchPackFile } from './store'
import { BUILTIN_PACK } from './builtin'

export interface PacksInBackup {
  packs: Pick<MapPack, 'id' | 'name' | 'owner'>[]
  pieces: Omit<PackPiece, 'pending'>[]
  /** The picture files in the zip, by key (packs/<key>). */
  files: string[]
}

/** The pieces and pictures a world's maps use, ready to go in a backup. */
export async function packFilesFor(maps: WorldMap[]) {
  const used = new Map<string, Set<number>>()
  for (const m of maps)
    for (const name of packPiecesIn(m.drawing).keys()) {
      const ref = parsePackAsset(name)
      if (ref) used.set(ref.pieceId, (used.get(ref.pieceId) ?? new Set()).add(ref.rev))
    }
  const pieces: PackPiece[] = []
  const files: PackFile[] = []
  for (const [id, revs] of used) {
    const piece = await db.packPieces.get(id)
    if (!piece) continue
    pieces.push(piece)
    for (const rev of revs)
      for (const [v] of versionsOf(piece, rev).entries())
        for (const kind of ['full', 'thumb'] as const) {
          const blob = await fetchPackFile(piece, rev, v, kind).catch(() => undefined)
          if (blob) files.push({ key: fileKey(id, rev, v, kind), pieceId: id, blob })
        }
  }
  const packIds = [...new Set(pieces.map((p) => p.packId))]
  const packs = (await db.packs.bulkGet(packIds)).flatMap((p) => (p ? [{ id: p.id, name: p.name, owner: p.owner }] : []))
  const meta: PacksInBackup = { packs, pieces: pieces.map(({ pending: _p, ...x }) => x), files: files.map((f) => f.key) }
  return { pieces, files, meta }
}

/** The kinds of picture a pack piece can be, and their types. */
const PICTURE_TYPES: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', avif: 'image/avif' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A pack or piece id is one plain word, as the app makes them (it goes into web addresses and file names). */
const SAFE_ID = /^[\w-][\w.-]{0,127}$/
const FILE_KEY = /^([^@/]+)@(\d+)\/(\d+)\/(full|thumb)$/

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
/** An account id, or nothing, so a backup can't file pictures under a made-up account or path. */
const ownerOf = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : undefined)
const versionsFrom = (v: unknown): PackVersion[] =>
  list<PackVersion>(v)
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({ ...x, ext: typeof x.ext === 'string' && PICTURE_TYPES[x.ext.toLowerCase()] ? x.ext.toLowerCase() : 'png' }))

/**
 * A piece as a backup describes it, keeping only what a piece can be: filed under an account id (or
 * none), and every picture one of the kinds above. A backup is a file anyone could have made, so
 * nothing in it is taken on trust, and it's never waiting to be sent to the cloud as this GM's own.
 */
function pieceFrom(x: Omit<PackPiece, 'pending'> & { pending?: unknown }): PackPiece | undefined {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !SAFE_ID.test(x.id) || typeof x.packId !== 'string' || !SAFE_ID.test(x.packId)) return undefined
  const { pending: _p, owner, versions, older, ...rest } = x
  const olderOk =
    older && typeof older === 'object'
      ? Object.fromEntries(Object.entries(older).flatMap(([rev, v]) => (/^\d+$/.test(rev) ? [[rev, versionsFrom(v)]] : [])))
      : undefined
  return {
    ...rest,
    rev: Number.isInteger(rest.rev) && rest.rev >= 0 ? rest.rev : 0,
    versions: versionsFrom(versions),
    ...(olderOk ? { older: olderOk } : {}),
    owner: ownerOf(owner),
  }
}

/** Puts a backup's pieces and pictures on this device, where it doesn't have them. */
export async function restorePacks(b: PacksInBackup, file: (key: string) => Uint8Array<ArrayBuffer> | undefined) {
  const now = Date.now()
  for (const p of list<PacksInBackup['packs'][number]>(b.packs)) {
    if (!p || typeof p.id !== 'string' || !SAFE_ID.test(p.id) || (await db.packs.get(p.id))) continue
    const name = typeof p.name === 'string' ? p.name : 'Map pack'
    await db.packs.put({ id: p.id, name, owner: ownerOf(p.owner), createdAt: now, updatedAt: now, ...(p.id === BUILTIN_PACK ? { builtin: true } : { borrowed: true }) })
  }
  const pieces = new Map<string, PackPiece>()
  for (const x of list<Omit<PackPiece, 'pending'>>(b.pieces)) {
    const piece = pieceFrom(x)
    if (!piece) continue
    pieces.set(piece.id, piece)
    if (!(await db.packPieces.get(piece.id))) await db.packPieces.put(piece)
  }
  for (const key of list<unknown>(b.files)) {
    const m = typeof key === 'string' ? FILE_KEY.exec(key) : null
    if (!m || !pieces.has(m[1]) || (await db.packFiles.get(m[0]))) continue
    const data = file(m[0])
    if (!data) continue
    const ext = versionsOf(pieces.get(m[1])!, Number(m[2]))[Number(m[3])]?.ext ?? 'png'
    await db.packFiles.put({ key: m[0], pieceId: m[1], blob: new Blob([data], { type: PICTURE_TYPES[ext] ?? 'image/png' }) })
  }
}
