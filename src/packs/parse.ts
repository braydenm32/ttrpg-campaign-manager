/**
 * Turning a folder or ZIP of pictures into pack pieces. Each folder becomes a group; files named
 * tree-1, tree-2, tree-3 become the versions of one piece "Tree". The rest is guessed from the
 * names (and fixed by the GM afterwards): what kind of map a piece is for (a folder called town,
 * city, world or region), its size on the grid ("2x3" in the name) and whether it gives off light.
 * Every picture is kept at most 1024 px across, plus a small preview for the picker.
 */
import type { PackScene, PackVersion } from '../db'
import { PACK_ZIP, unzipBlobs } from '../zipSafe'
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

/** A pack's index (Asset_Index.csv), when the GM picked a pack that has one, and the folder it's in. */
export interface PackIndex {
  text: string
  root: string
}
const INDEX = /(^|\/)Asset_Index\.csv$/i
const hiddenFile = (name: string) => name.startsWith('__MACOSX/') || /(^|\/)\./.test(name)

/**
 * The pictures in what the GM picked: files, files from a folder, or ZIPs (opened a piece at a
 * time, so a ZIP of hundreds of MB isn't held in memory twice), plus the pack's index if it has one.
 */
export async function picturesIn(files: File[], onProgress?: (note: string) => void): Promise<{ pictures: PictureFile[]; index?: PackIndex }> {
  const out: PictureFile[] = []
  let index: PackIndex | undefined
  const found = async (path: string, blob: Blob) => {
    if (INDEX.test(path)) index = { text: await blob.text(), root: path.replace(/Asset_Index\.csv$/i, '') }
    else if (PICTURE.test(path) && !hiddenFile(path)) out.push({ path, blob })
  }
  for (const f of files) {
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    if (/\.zip$/i.test(f.name)) {
      onProgress?.(`Opening ${f.name}…`)
      for (const [name, blob] of await unzipped(f)) await found(name, blob)
    } else await found(path, f)
  }
  return { pictures: out, index }
}

/** The pictures and index files in a ZIP, read from the file a slice at a time (within the limits in zipSafe.ts). */
function unzipped(f: File): Promise<[string, Blob][]> {
  return unzipBlobs(
    f,
    (name) => !hiddenFile(name) && (PICTURE.test(name) || INDEX.test(name)),
    (name) => MIME[name.split('.').pop()!.toLowerCase()] ?? 'text/plain',
    PACK_ZIP,
  )
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
  /** From a pack index: what each file is (design, look, climate, condition), the view, and the conditions. */
  tags?: PictureTag[]
  view?: 'top' | 'side'
  states?: string[]
  /** A set of wall or fence tiles, or a floor texture, rather than a piece to place. */
  use?: 'wall' | 'fence' | 'ground'
}

export type PictureTag = Pick<PackVersion, 'd' | 'mode' | 'biome' | 'state' | 'part'>

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

/** Splits one line of a CSV file, keeping commas inside quotes. */
function csvLine(line: string) {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

/** "Battlemap/trees" → "Trees"; "Arcane/Alchemy" → "Arcane · Alchemy"; "Birds_Eye/ct-castle" → "Castle". */
function groupName(path: string) {
  const human = (x: string) => {
    const t = x.replace(/^ct-|^wa-/, '').replace(/[_-]+/g, ' ').trim()
    return t ? t[0].toUpperCase() + t.slice(1) : 'Pieces'
  }
  const parts = path.split('/').filter(Boolean)
  if (!parts.length) return 'Pieces'
  if (parts.length === 1) return human(parts[0])
  const broad = /^(battlemap|world|town|dungeon|birds_eye)$/i.test(parts[0])
  return broad ? human(parts[parts.length - 1]) : `${human(parts[0])} · ${human(parts[parts.length - 1])}`
}

/** What kind of map a piece from a pack index is for. */
function indexScene(view: string, group: string): PackScene {
  const top = group.split('/')[0].toLowerCase()
  if (view === 'side' || top === 'world') return 'world'
  if (view === 'bird' || top === 'town' || top === 'birds_eye' || top === 'settlement') return 'city'
  return 'battle'
}

/** Kinds in a pack index that aren't pieces to place (walls and fences, floor textures): left out for now. */
/** Index rows that aren't pieces to place: wall and fence tiles (one set for each wall), and floor textures. */
export const NOT_PIECES = new Set(['modular', 'texture'])
const TILE_PART = /-(straight|corner|tee|cross|end|post|doorway|broken)$/

/**
 * Pieces from a pack with an index (Asset_Index.csv: id, label, group, view, state, mode, biome,
 * variant, width, height, grid_px, file): one piece per id, its pictures tagged with their design,
 * look, climate and condition, so a map picks the right one. Pictures the index doesn't name (its
 * own previews and thumbnails) are left out. Also says what was left out and why.
 */
export function draftFromIndex(pictures: PictureFile[], index: PackIndex): { drafts: PieceDraft[]; leftOut: { kind: string; count: number }[]; missing: number } {
  const [head, ...lines] = index.text.split(/\r?\n/).filter((l) => l.trim())
  const cols = csvLine(head).map((c) => c.trim().toLowerCase())
  const at = (name: string) => cols.indexOf(name)
  const rows = lines.map(csvLine)
  const get = (r: string[], name: string) => (at(name) >= 0 ? (r[at(name)] ?? '').trim() : '')
  // the pictures by their path inside the pack's folder
  const byPath = new Map<string, PictureFile>()
  for (const p of pictures) {
    const rel = index.root && p.path.startsWith(index.root) ? p.path.slice(index.root.length) : p.path
    byPath.set(rel, p)
    // a folder chosen above or below the pack's own: match on the path without its first folder too
    byPath.set(rel.split('/').slice(1).join('/'), byPath.get(rel.split('/').slice(1).join('/')) ?? p)
  }
  const left = new Map<string, number>()
  let missing = 0
  const families = new Map<string, string[][]>()
  for (const r of rows) {
    const view = get(r, 'view')
    const id = get(r, 'id')
    if (!id) continue
    // wall-brick-straight, wall-brick-corner…: all one set, wall-brick
    const key = view === 'modular' ? id.replace(TILE_PART, '') : id
    if (view === 'modular' && key === id) {
      left.set('wall and fence tiles', (left.get('wall and fence tiles') ?? 0) + 1)
      continue
    }
    families.set(key, [...(families.get(key) ?? []), r])
  }
  const drafts: PieceDraft[] = []
  for (const [, rs] of families) {
    const r0 = rs[0]
    const view = get(r0, 'view')
    const tiles = view === 'modular'
    const partOf = (r: string[]) => (tiles ? (TILE_PART.exec(get(r, 'id'))?.[1] ?? '') : '')
    // designs are counted for each part of a wall on its own (it may have four broken tiles and one straight)
    const variantsOf = new Map<string, number[]>()
    for (const r of rs) variantsOf.set(partOf(r), [...(variantsOf.get(partOf(r)) ?? []), Number(get(r, 'variant')) || 1])
    for (const [k, v] of variantsOf) variantsOf.set(k, [...new Set(v)].sort((a, b) => a - b).slice(0, 8))
    const files: PictureFile[] = []
    const tags: PictureTag[] = []
    for (const r of rs) {
      const d = variantsOf.get(partOf(r))!.indexOf(Number(get(r, 'variant')) || 1)
      if (d < 0) continue
      const file = byPath.get(get(r, 'file'))
      if (!file) {
        missing++
        continue
      }
      const mode = get(r, 'mode')
      files.push(file)
      tags.push({
        d,
        mode: mode === 'ink' ? 'ink' : mode === 'colour' ? 'colour' : undefined,
        biome: get(r, 'biome') || undefined,
        state: get(r, 'state') || 'intact',
        ...(tiles ? { part: partOf(r) } : {}),
      })
    }
    if (!files.length) continue
    const grid = Number(get(r0, 'grid_px')) || 256
    // its size from the plain picture: the first design, intact, in colour
    const plain = rs.find((r) => get(r, 'state') === 'intact' && get(r, 'mode') === 'colour') ?? r0
    const quarter = (px: number) => Math.min(40, Math.max(0.25, Math.round((px / grid) * 4) / 4))
    const group = get(r0, 'group')
    if (NOT_PIECES.has(view)) {
      const use = view === 'texture' ? 'ground' : /fence/i.test(`${group} ${get(r0, 'id')}`) ? 'fence' : 'wall'
      const name = (get(r0, 'label') || tidyName(get(r0, 'id').replace(TILE_PART, ''))).replace(/\s+(straight|corner|tee|cross|end|post|doorway|broken)$/i, '')
      drafts.push({
        label: name[0].toUpperCase() + name.slice(1),
        group: use === 'ground' ? 'Floors & ground' : use === 'fence' ? 'Fences' : 'Walls',
        scene: 'battle',
        view: 'top',
        cols: tiles ? 1 : quarter(Number(get(r0, 'width')) || grid),
        rows: tiles ? 1 : quarter(Number(get(r0, 'height')) || grid),
        light: false,
        files,
        tags,
        use,
      })
      continue
    }
    const label = get(r0, 'label') || tidyName(get(r0, 'id'))
    drafts.push({
      label,
      group: groupName(group),
      scene: indexScene(view, group),
      view: view === 'side' ? 'side' : 'top',
      cols: quarter(Number(get(plain, 'width')) || grid),
      rows: quarter(Number(get(plain, 'height')) || grid),
      light: LIGHT.test(label) || LIGHT.test(group),
      files,
      tags,
      states: [...new Set(tags.map((t) => t.state ?? 'intact'))],
    })
  }
  drafts.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label))
  return { drafts, leftOut: [...left].map(([kind, count]) => ({ kind, count })), missing }
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
  const pictures = (await makePictures(d.files)).map((p, i) => ({ ...p, ...(d.tags?.[i] ?? {}) }))
  return {
    label: d.label,
    group: d.group,
    scene: d.scene,
    cols: d.cols,
    rows: d.rows,
    light: d.light,
    pictures,
    ...(d.view ? { view: d.view } : {}),
    ...(d.states && d.states.length > 1 ? { states: d.states } : {}),
    ...(d.use ? { use: d.use } : {}),
  }
}
