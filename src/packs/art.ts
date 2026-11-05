/**
 * Pack pieces on maps. Each piece of the GM's own map packs becomes a piece in the map library
 * (Atlas.assets), named `pack:<piece id>@<rev>`, so placing, scattering, turning, exporting and
 * linking work just as they do for the drawn pieces. Its draw() paints the picture, which has to be
 * loaded first: ensurePackArt(drawing) fetches whatever a drawing needs (from this device, or else
 * from the cloud) before the map is drawn. A piece whose picture can't be had yet is drawn as a
 * dashed box with its name.
 */
import { Atlas, type InkStyle } from '../mapArt/atlas'
import { db, type PackPiece, type PackVersion } from '../db'
import type { Drawing } from '../mapDrawing'
import { fetchPackFile, fetchPieceMeta } from './store'

export const PACK_PREFIX = 'pack:'
export const isPackAsset = (name: string) => name.startsWith(PACK_PREFIX)
export const packAssetName = (pieceId: string, rev: number) => `${PACK_PREFIX}${pieceId}@${rev}`
export function parsePackAsset(name: string): { pieceId: string; rev: number } | undefined {
  const m = /^pack:([^@]+)@(\d+)$/.exec(name)
  return m ? { pieceId: m[1], rev: Number(m[2]) } : undefined
}
export const fileKey = (pieceId: string, rev: number, version: number, kind: 'full' | 'thumb') => `${pieceId}@${rev}/${version}/${kind}`

/** Decoded pictures, by file key. */
const pictures = new Map<string, ImageBitmap | HTMLCanvasElement>()
/** Tinted copies, by file key + look. */
const tinted = new Map<string, HTMLCanvasElement>()

/** The versions a rev of a piece has. */
export const versionsOf = (piece: PackPiece, rev = piece.rev): PackVersion[] => (rev === piece.rev ? piece.versions : (piece.older?.[rev] ?? piece.versions))

/** A pack piece's starting size on a map, in map pixels across. */
export function packPieceSize(piece: Pick<PackPiece, 'scene' | 'cols'>, gridSize: number, W: number, H: number) {
  const cols = Math.max(0.25, piece.cols || 1)
  if (piece.scene === 'world') return Math.round(cols * 30 * Math.max(1, Math.max(W, H) / 1400))
  return Math.round(cols * (gridSize || 70))
}

/** Puts a piece (one rev of it) in the map library, or refreshes it there. */
export function registerPackPiece(piece: PackPiece, rev = piece.rev) {
  const name = packAssetName(piece.id, rev)
  const versions = versionsOf(piece, rev)
  const n = Math.max(1, Math.min(8, versions.length))
  const side = piece.scene === 'world'
  Atlas.assets[name] = {
    label: piece.label || 'Piece',
    category: `${PACK_PREFIX}${piece.packId}`,
    kind: 'fixed',
    view: side ? 'side' : 'top',
    versions: n,
    light: !!piece.light,
    aspect: (variant) => {
      const v = versions[((variant % n) + n) % n]
      return v && v.w ? v.h / v.w : piece.rows / Math.max(0.25, piece.cols || 1)
    },
    sizeFor: (gridSize, W, H) => packPieceSize(piece, gridSize, W, H),
    draw(ctx, x, y, s, _r, st, variant) {
      const v = ((variant % n) + n) % n
      const ver = versions[v]
      const aspect = ver && ver.w ? ver.h / ver.w : 1
      // side-on (world maps): s is the height and (x, y) the middle of the base; from above: s is the width, (x, y) the centre
      const w = side ? s / aspect : s
      const h = side ? s : s * aspect
      const left = x - w / 2
      const top = side ? y - h : y - h / 2
      const key = fileKey(piece.id, rev, v, 'full')
      const pic = pictures.get(key) ?? pictures.get(fileKey(piece.id, rev, v, 'thumb'))
      if (!pic) return placeholder(ctx, left, top, w, h, piece.label, st)
      ctx.save()
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(Atlas.packTint ? tintOf(key, pic, st) : pic, left, top, w, h)
      ctx.restore()
    },
  }
  return name
}

/** A piece whose picture isn't here yet: a dashed box with its name, so the map still makes sense. */
function placeholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, st: InkStyle) {
  ctx.save()
  ctx.strokeStyle = st.ink
  ctx.globalAlpha = 0.6
  ctx.lineWidth = Math.max(1, w / 60)
  ctx.setLineDash([Math.max(3, w / 14), Math.max(2, w / 20)])
  ctx.strokeRect(x, y, w, h)
  ctx.setLineDash([])
  ctx.fillStyle = st.ink
  ctx.font = `${Math.max(8, Math.min(18, w / 7))}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + w / 2, y + h / 2, w * 0.9)
  ctx.restore()
}

/**
 * The picture taking on the map's look: in colour, a wash of the climate's land colour over it; on
 * parchment, drained of colour and inked in the paper's browns. Its see-through parts stay see-through.
 */
function tintOf(key: string, pic: ImageBitmap | HTMLCanvasElement, st: InkStyle) {
  const id = `${key}|${st.mode}|${st.tint.label}|${st.paper}`
  const done = tinted.get(id)
  if (done) return done
  const c = document.createElement('canvas')
  c.width = pic.width
  c.height = pic.height
  const g = c.getContext('2d')!
  g.drawImage(pic, 0, 0)
  if (st.mode === 'colour') {
    g.globalCompositeOperation = 'multiply'
    g.globalAlpha = 0.55
    g.fillStyle = st.tint.land
    g.fillRect(0, 0, c.width, c.height)
  } else {
    g.globalCompositeOperation = 'saturation'
    g.fillStyle = '#808080'
    g.fillRect(0, 0, c.width, c.height)
    g.globalCompositeOperation = 'multiply'
    g.fillStyle = st.paper
    g.fillRect(0, 0, c.width, c.height)
    g.globalAlpha = 0.35
    g.fillStyle = '#8a6a3a'
    g.fillRect(0, 0, c.width, c.height)
  }
  g.globalAlpha = 1
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(pic, 0, 0)
  if (tinted.size > 200) tinted.clear()
  tinted.set(id, c)
  return c
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLCanvasElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob)
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Loads one picture of a piece into memory: from this device, or else downloaded (and kept). */
export async function loadPicture(piece: PackPiece, rev: number, version: number, kind: 'full' | 'thumb'): Promise<boolean> {
  const key = fileKey(piece.id, rev, version, kind)
  if (pictures.has(key)) return true
  const blob = await fetchPackFile(piece, rev, version, kind)
  if (!blob) return false
  pictures.set(key, await decode(blob))
  return true
}

/** Whether a picture is in memory, ready to draw. */
export const hasPicture = (pieceId: string, rev: number, version: number, kind: 'full' | 'thumb' = 'full') => pictures.has(fileKey(pieceId, rev, version, kind))

/** Lets go of a piece's pictures in memory (its pictures changed). */
export function forgetPictures(pieceId: string) {
  for (const k of [...pictures.keys()]) if (k.startsWith(`${pieceId}@`)) pictures.delete(k)
  for (const k of [...tinted.keys()]) if (k.startsWith(`${pieceId}@`)) tinted.delete(k)
}

/** The pack pieces a drawing uses, with the versions of each. */
export function packPiecesIn(d: Drawing | undefined): Map<string, Set<number>> {
  const used = new Map<string, Set<number>>()
  for (const s of d?.shapes ?? []) {
    if (s.kind !== 'asset' || !isPackAsset(s.asset)) continue
    if (!used.has(s.asset)) used.set(s.asset, new Set())
    used.get(s.asset)!.add(s.variant)
  }
  return used
}

/**
 * Gets every pack piece a drawing uses ready to draw: in the library, with its pictures loaded.
 * Returns the names of the pieces whose pictures couldn't be had (offline, say); those draw as boxes.
 */
export async function ensurePackArt(d: Drawing | undefined): Promise<string[]> {
  const used = packPiecesIn(d)
  if (!used.size) return []
  const missing: string[] = []
  await Promise.all(
    [...used].map(async ([name, variants]) => {
      const ref = parsePackAsset(name)
      if (!ref) return
      const piece = (await db.packPieces.get(ref.pieceId)) ?? (await fetchPieceMeta(ref.pieceId).catch(() => undefined))
      if (!piece) {
        missing.push('a piece from a map pack')
        return
      }
      registerPackPiece(piece, ref.rev)
      const n = Math.max(1, Math.min(8, versionsOf(piece, ref.rev).length))
      const vs = new Set([...variants].map((v) => ((v % n) + n) % n))
      const got = await Promise.all([...vs].map((v) => loadPicture(piece, ref.rev, v, 'full').catch(() => false)))
      if (got.some((ok) => !ok)) missing.push(piece.label)
    }),
  )
  return missing
}

/** Registers every piece of these packs (their newest pictures) so the picker can offer them. */
export async function registerPacks(packIds: string[]) {
  if (!packIds.length) return [] as PackPiece[]
  const pieces = await db.packPieces.where('packId').anyOf(packIds).toArray()
  for (const p of pieces) registerPackPiece(p)
  return pieces
}
