/**
 * Which pack pieces a world's maps use, and swapping in a piece's new pictures. Maps keep the
 * pictures they were drawn with (a piece's rev) until the GM says "Use the new pictures" in World
 * settings › Map pieces; then the maps are pointed at the newest rev and their pictures redrawn.
 */
import { db, newId, type PackPiece, type World, type WorldMap } from '../db'
import { classicBlob, loadMapFonts, playersCopy, renderClassic } from '../mapArt/classic'
import { hasSecrets, type Drawing } from '../mapDrawing'
import { keepBeforeChange } from '../mapVersions'
import { ensurePackArt, packAssetName, packPiecesIn, parsePackAsset } from './art'
import { fetchPieceMeta } from './store'

export interface PieceUse {
  piece: PackPiece
  /** The revs (sets of pictures) the world's maps use. */
  revs: number[]
  maps: WorldMap[]
}

/** Every pack piece a world's drawn maps use. */
export async function packUseIn(worldId: string): Promise<PieceUse[]> {
  const maps = (await db.maps.where({ worldId }).toArray()).filter((m) => m.drawing)
  const byPiece = new Map<string, { revs: Set<number>; maps: Set<WorldMap> }>()
  for (const m of maps) {
    for (const name of packPiecesIn(m.drawing).keys()) {
      const ref = parsePackAsset(name)
      if (!ref) continue
      const u = byPiece.get(ref.pieceId) ?? { revs: new Set(), maps: new Set() }
      u.revs.add(ref.rev)
      u.maps.add(m)
      byPiece.set(ref.pieceId, u)
    }
  }
  const out: PieceUse[] = []
  for (const [id, u] of byPiece) {
    const piece = (await db.packPieces.get(id)) ?? (await fetchPieceMeta(id).catch(() => undefined))
    if (piece) out.push({ piece, revs: [...u.revs].sort((a, b) => a - b), maps: [...u.maps] })
  }
  return out.sort((a, b) => a.piece.label.localeCompare(b.piece.label))
}

/** Pieces with newer pictures than the maps use, that the GM hasn't chosen to keep as they are. */
export const newerPictures = (uses: PieceUse[], world: World) => uses.filter((u) => u.revs.some((r) => r < u.piece.rev) && world.gmScreen?.packKept?.[u.piece.id] !== u.piece.rev)

/** Leaves a world's maps with a piece's old pictures, and stops asking about this set of new ones. */
export async function keepOldPictures(world: World, pieceId: string, rev: number) {
  const gmScreen = { pages: [], rolls: [], ...(world.gmScreen ?? {}) }
  await db.worlds.update(world.id, { gmScreen: { ...gmScreen, packKept: { ...(gmScreen.packKept ?? {}), [pieceId]: rev } }, updatedAt: Date.now() })
}

/**
 * Points every map in the world that uses this piece at its newest pictures and redraws them.
 * Returns how many maps couldn't be redrawn (the new pictures couldn't be downloaded).
 */
export async function swapInNewPictures(world: World, piece: PackPiece): Promise<number> {
  const uses = (await packUseIn(world.id)).find((u) => u.piece.id === piece.id)
  if (!uses) return 0
  const newest = packAssetName(piece.id, piece.rev)
  let failed = 0
  await loadMapFonts()
  for (const map of uses.maps) {
    const d = map.drawing!
    const next: Drawing = {
      ...d,
      shapes: d.shapes.map((s) => (s.kind === 'asset' && parsePackAsset(s.asset)?.pieceId === piece.id ? { ...s, asset: newest } : s)),
    }
    if ((await ensurePackArt(next)).length) {
      failed++
      continue
    }
    await keepBeforeChange(map, d)
    await redrawMap(map, next)
  }
  return failed
}

/** Saves a drawing on its map with fresh pictures (the GM's, and the players' copy if it has secrets). */
async function redrawMap(map: WorldMap, d: Drawing) {
  const W = map.width
  const H = map.height
  const blob = await classicBlob(renderClassic(d, W, H))
  const forThem = hasSecrets(d) ? await classicBlob(renderClassic(playersCopy(d, W, H), W, H)) : undefined
  const now = Date.now()
  await db.transaction('rw', [db.maps, db.assets], async () => {
    let playerImageId = (await db.maps.get(map.id))?.playerImageId
    if (forThem && playerImageId && (await db.assets.get(playerImageId))) {
      await db.assets.update(playerImageId, { blob: forThem, size: forThem.size, mime: forThem.type, updatedAt: now })
    } else if (forThem) {
      playerImageId = newId()
      await db.assets.add({
        id: playerImageId,
        worldId: map.worldId,
        name: `${map.name} (players’ copy).${forThem.type === 'image/webp' ? 'webp' : 'jpg'}`,
        mime: forThem.type,
        size: forThem.size,
        blob: forThem,
        tags: ['map', 'drawn', 'players'],
        visibility: 'gm',
        createdAt: now,
        updatedAt: now,
      })
    } else if (playerImageId) {
      await db.assets.delete(playerImageId)
      playerImageId = undefined
    }
    await db.maps.update(map.id, { drawing: d, playerImageId })
    await db.assets.update(map.imageId, { blob, size: blob.size, mime: blob.type, updatedAt: now })
  })
}
