/**
 * Map-pack pieces in world backups. A backup holds the pieces its maps are drawn with (just the
 * sets of pictures they use), so it opens complete on any device, signed in or not. Pieces keep
 * their ids; on import they're added as borrowed unless this device has them already.
 */
import { db, type MapPack, type PackFile, type PackPiece, type WorldMap } from '../db'
import { fileKey, packPiecesIn, parsePackAsset, versionsOf } from './art'
import { fetchPackFile } from './store'

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

/** Puts a backup's pieces and pictures on this device, where it doesn't have them. */
export async function restorePacks(b: PacksInBackup, file: (key: string) => Uint8Array<ArrayBuffer> | undefined) {
  const now = Date.now()
  for (const p of b.packs) if (!(await db.packs.get(p.id))) await db.packs.put({ ...p, createdAt: now, updatedAt: now, borrowed: true })
  for (const x of b.pieces) if (!(await db.packPieces.get(x.id))) await db.packPieces.put(x)
  for (const key of b.files) {
    if (await db.packFiles.get(key)) continue
    const data = file(key)
    if (!data) continue
    const pieceId = key.split('@')[0]
    const piece = b.pieces.find((p) => p.id === pieceId)
    const [rev, v] = key.split('@')[1].split('/').map(Number)
    const ext = piece ? (versionsOf(piece as PackPiece, rev)[v]?.ext ?? 'png') : 'png'
    await db.packFiles.put({ key, pieceId, blob: new Blob([data], { type: ext === 'webp' ? 'image/webp' : `image/${ext}` }) })
  }
}
