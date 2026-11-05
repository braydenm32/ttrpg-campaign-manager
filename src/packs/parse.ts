/**
 * Turning a folder or ZIP of pictures into pack pieces. Each folder becomes a group; files named
 * tree-1, tree-2, tree-3 become the versions of one piece "Tree". The rest is guessed from the
 * names (and fixed by the GM afterwards): what kind of map a piece is for (a folder called town,
 * city, world or region), its size on the grid ("2x3" in the name) and whether it gives off light.
 * Every picture is kept at most 1024 px across, plus a small preview for the picker.
 */
import { unzipSync } from 'fflate'
import type { PackScene } from '../db'
import type { NewPicture, NewPiece } from './store'

export interface PictureFile {
  /** Its path in the folder or ZIP, e.g. "Camp/tent-2.png". */
  path: string
  blob: Blob
}

const PICTURE = /\.(png|webp|jpe?g|gif|avif)$/i
const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', avif: 'image/avif' }
/** Biggest side of a stored picture, and of a preview. */
export const FULL_PX = 1024
export const THUMB_PX = 128

/** The pictures in what the GM picked: files, files from a folder, or ZIPs (opened). */
export async function picturesIn(files: File[]): Promise<PictureFile[]> {
  const out: PictureFile[] = []
  for (const f of files) {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    if (/\.zip$/i.test(f.name)) {
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()))
      for (const [name, data] of Object.entries(entries)) {
        if (!PICTURE.test(name) || name.startsWith('__MACOSX/') || /(^|\/)\./.test(name)) continue
        const ext = name.split('.').pop()!.toLowerCase()
        out.push({ path: name, blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: MIME[ext] ?? 'image/png' }) })
      }
    } else if (PICTURE.test(f.name)) out.push({ path, blob: f })
  }
  return out
}

/** "dark_oak-tree_03" → "Dark oak tree". */
export function tidyName(raw: string) {
  const s = raw.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : 'Piece'
}

const LIGHT = /torch|brazier|fire|candle|lantern|lamp|campfire|bonfire|sconce|hearth|forge|glow/i

/** What kind of map a folder's pieces are for, from its name. */
function sceneOf(folders: string[]): PackScene | undefined {
  const s = folders.join(' ').toLowerCase()
  if (/\b(world|region|continent|overland|atlas)\b/.test(s)) return 'world'
  if (/\b(town|city|cities|towns|village plan|settlement)\b/.test(s)) return 'city'
  if (/\b(battle|dungeon|encounter|interior|tactical)\b/.test(s)) return 'battle'
  return undefined
}

export interface PieceDraft {
  label: string
  group: string
  scene: PackScene
  cols: number
  rows: number
  light: boolean
  files: PictureFile[]
}

/** Groups pictures into pieces (versions by trailing number), with guesses for each. */
export function draftPieces(pictures: PictureFile[], fallbackScene: PackScene = 'battle'): PieceDraft[] {
  const byKey = new Map<string, PieceDraft & { order: number[] }>()
  for (const p of pictures) {
    const parts = p.path.split('/').filter(Boolean)
    const file = parts.pop()!.replace(PICTURE, '')
    // a ZIP often has one folder around everything: that's the pack, not a group
    const folders = parts.length > 1 ? parts.slice(1) : parts
    const group = folders.length ? tidyName(folders[folders.length - 1]) : 'Pieces'
    const size = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i.exec(file)
    let base = file.replace(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i, ' ')
    const num = /[\s_\-.(]*(\d{1,3})\)?\s*$/.exec(base)
    const order = num ? Number(num[1]) : 0
    if (num) base = base.slice(0, num.index)
    const label = tidyName(base)
    const k = `${group}/${label}`.toLowerCase()
    const had = byKey.get(k)
    if (had) {
      had.files.push(p)
      had.order.push(order)
      continue
    }
    byKey.set(k, {
      label,
      group,
      scene: sceneOf(parts) ?? fallbackScene,
      cols: size ? Math.min(40, Math.max(0.25, Number(size[1]))) : 1,
      rows: size ? Math.min(40, Math.max(0.25, Number(size[2]))) : 1,
      light: LIGHT.test(file) || LIGHT.test(group),
      files: [p],
      order: [order],
    })
  }
  return [...byKey.values()].map(({ order, files, ...d }) => ({
    ...d,
    // versions in number order, at most 8 (as many as the version picker shows)
    files: files
      .map((f, i) => [f, order[i]] as const)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 8)
      .map(([f]) => f),
  }))
}

async function bitmapOf(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob)
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  await img.decode()
  URL.revokeObjectURL(url)
  return img
}

const sizeOf = (b: ImageBitmap | HTMLImageElement) => ('naturalWidth' in b ? [b.naturalWidth, b.naturalHeight] : [b.width, b.height])

function toBlob(c: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality))
}

/** A picture scaled to fit `px`, as WebP where the browser can make it (PNG otherwise), see-through parts kept. */
async function encode(img: ImageBitmap | HTMLImageElement, px: number): Promise<{ blob: Blob; w: number; h: number; ext: string }> {
  const [w0, h0] = sizeOf(img)
  const k = Math.min(1, px / Math.max(w0, h0))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w0 * k))
  c.height = Math.max(1, Math.round(h0 * k))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, 0, 0, c.width, c.height)
  const webp = await toBlob(c, 'image/webp', 0.9)
  if (webp && webp.type === 'image/webp') return { blob: webp, w: c.width, h: c.height, ext: 'webp' }
  const png = await toBlob(c, 'image/png')
  if (!png) throw new Error('Could not read that picture')
  return { blob: png, w: c.width, h: c.height, ext: 'png' }
}

/** Makes the stored picture and the preview for each file. */
export async function makePictures(files: PictureFile[]): Promise<NewPicture[]> {
  const out: NewPicture[] = []
  for (const f of files) {
    const img = await bitmapOf(f.blob)
    const full = await encode(img, FULL_PX)
    const thumb = await encode(img, THUMB_PX)
    if ('close' in img) img.close()
    out.push({ full: full.blob, thumb: thumb.blob, w: full.w, h: full.h, ext: full.ext })
  }
  return out
}

/** A draft with its pictures made, ready for addPieces. */
export async function finishPiece(d: PieceDraft): Promise<NewPiece> {
  return { label: d.label, group: d.group, scene: d.scene, cols: d.cols, rows: d.rows, light: d.light, pictures: await makePictures(d.files) }
}
