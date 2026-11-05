/**
 * Walls and fences from map packs, built square by square (the Walls tool), and floor textures from
 * packs as ground (the Ground tool).
 *
 * A wall or fence set has a tile for each part of a wall: a straight run, a corner, a tee, a cross,
 * an end, a lone post, a doorway and a broken stretch. Each square of wall looks at the squares
 * round it and picks the part and the way it's turned that joins up with them, so the GM just
 * draws where the wall goes. As drawn in the pack, a straight runs left to right, a corner joins
 * top and right, a tee top, left and right, an end reaches up, and a doorway or broken stretch runs
 * top to bottom. Walls of different sets join each other too (a timber wall into a stone one).
 */
import type { InkStyle, Point } from '../mapArt/atlas'
import type { PackVersion } from '../db'
import type { Drawing } from '../mapDrawing'
import { fileKey, kitOf, lookOf, parsePackAsset, pictureFor, pictureOf, designsOf, versionsOf, type PackLook } from './art'

export type TilePart = 'straight' | 'corner' | 'tee' | 'cross' | 'end' | 'post' | 'doorway' | 'broken'
export type TileMark = 'door' | 'broken'

// the sides a tile joins: up, right, down, left
const N = 1
const E = 2
const S = 4
const Wd = 8
/** The sides each part joins as the pack draws it. */
const DRAWN: Record<Exclude<TilePart, 'doorway' | 'broken'>, number> = { post: 0, end: N, straight: E | Wd, corner: N | E, tee: N | E | Wd, cross: N | E | S | Wd }
/** A quarter turn clockwise: up becomes right, right becomes down… */
const turn = (m: number) => ((m << 1) | (m >> 3)) & 15

export const tileKey = (c: number, r: number) => `${c},${r}`
export const cellOf = (key: string): [number, number] => key.split(',').map(Number) as [number, number]
export const tileValue = (set: string, mark?: TileMark) => (mark ? `${set}|${mark}` : set)
export const tileSet = (value: string) => value.split('|')[0]
export const tileMark = (value: string) => (value.split('|')[1] as TileMark | undefined) || undefined

/** Which sides of a square have wall next to them. */
export function sidesOf(tiles: Record<string, string>, c: number, r: number) {
  return (tiles[tileKey(c, r - 1)] ? N : 0) | (tiles[tileKey(c + 1, r)] ? E : 0) | (tiles[tileKey(c, r + 1)] ? S : 0) | (tiles[tileKey(c - 1, r)] ? Wd : 0)
}

/**
 * The part a square of wall is drawn with, and how many quarter turns clockwise. A doorway or a
 * broken stretch only goes in a straight run (or at the end of one); anywhere else it's plain wall.
 */
export function tileFor(sides: number, mark?: TileMark): { part: TilePart; turns: number } {
  if (mark && (sides === (N | S) || sides === N || sides === S || sides === 0)) return { part: mark === 'door' ? 'doorway' : 'broken', turns: 0 }
  if (mark && (sides === (E | Wd) || sides === E || sides === Wd)) return { part: mark === 'door' ? 'doorway' : 'broken', turns: 1 }
  for (const [part, m] of Object.entries(DRAWN) as [TilePart, number][])
    for (let k = 0, x = m; k < 4; k++, x = turn(x)) if (x === sides) return { part, turns: k }
  return { part: 'post', turns: 0 }
}

/** Whether a mark can go on this square: doorways and broken stretches go in straight runs. */
export const markFits = (tiles: Record<string, string>, c: number, r: number) => {
  const s = sidesOf(tiles, c, r)
  return s === (N | S) || s === (E | Wd) || s === N || s === S || s === E || s === Wd || s === 0
}

/** Which picture (index into versions) to draw for a part, design and look. */
export function tilePicture(versions: PackVersion[], part: TilePart, design: number, look: PackLook): number {
  const idx = versions.flatMap((v, i) => (v.part === part ? [i] : []))
  if (!idx.length) return -1
  const sub = idx.map((i) => versions[i])
  return idx[pictureFor(sub, design % designsOf(sub), look, part === 'broken' ? 'broken' : undefined)]
}

/** A steady pick of design for each square, so a long wall isn't the same tile over and over. */
const hash = (c: number, r: number, seed: number) => {
  let h = (c * 73856093) ^ (r * 19349663) ^ (seed * 83492791)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return (h ^ (h >>> 15)) >>> 0
}

/** Draws the walls and fences built from tiles. A set whose pictures aren't here yet is a plain inked line. */
export function drawTiles(ctx: CanvasRenderingContext2D, d: Drawing, st: InkStyle) {
  const tiles = d.tiles
  if (!tiles) return
  const g = d.gridSize || 70
  const look = lookOf(d)
  const seed = d.seed ?? 1
  ctx.save()
  ctx.imageSmoothingQuality = 'high'
  for (const [key, value] of Object.entries(tiles)) {
    const [c, r] = cellOf(key)
    const sides = sidesOf(tiles, c, r)
    const { part, turns } = tileFor(sides, tileMark(value))
    const kit = kitOf(tileSet(value))
    const versions = kit ? versionsOf(kit.piece, kit.rev) : []
    const i = kit ? tilePicture(versions, part, hash(c, r, seed), look) : -1
    const pic = kit && i >= 0 ? pictureOf(fileKey(kit.piece.id, kit.rev, i, 'full')) : undefined
    const x = (c + 0.5) * g
    const y = (r + 0.5) * g
    if (!pic) {
      plainWall(ctx, x, y, g, sides, st)
      continue
    }
    ctx.save()
    ctx.translate(x, y)
    if (turns) ctx.rotate((turns * Math.PI) / 2)
    // a hair over a square, so neighbouring tiles meet without a seam
    const s = g + 0.6
    ctx.drawImage(pic, -s / 2, -s / 2, s, s)
    ctx.restore()
  }
  ctx.restore()
}

/** A square of wall whose pictures can't be had (offline): a thick inked line to each side it joins. */
function plainWall(ctx: CanvasRenderingContext2D, x: number, y: number, g: number, sides: number, st: InkStyle) {
  ctx.save()
  ctx.strokeStyle = st.ink
  ctx.lineWidth = g * 0.22
  ctx.lineCap = 'square'
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  const arms: Point[] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]
  arms.forEach(([dx, dy], k) => {
    if (!(sides & (1 << k))) return
    ctx.moveTo(x, y)
    ctx.lineTo(x + (dx * g) / 2, y + (dy * g) / 2)
  })
  if (!sides) ctx.rect(x - g * 0.11, y - g * 0.11, g * 0.22, g * 0.22)
  ctx.stroke()
  ctx.restore()
}

/** Whether a set stops sight in a virtual tabletop: walls and hedges do; other fences you see over. */
export function blocksSight(set: string) {
  const kit = kitOf(set)
  if (kit) return kit.piece.use === 'wall' || /hedge/i.test(`${kit.piece.label} ${kit.piece.id}`)
  const id = parsePackAsset(set)?.pieceId ?? ''
  return !id.startsWith('fence') || id.includes('hedge')
}

/**
 * The tiled walls for a virtual tabletop file, in map pixels: wall runs from the middle of one
 * square to the middle of the next, a door across each doorway, and a gap at each broken stretch.
 */
export function tileWalls(d: Drawing): { walls: Point[][]; doors: { at: Point; ends: [Point, Point]; rotation: number }[] } {
  const tiles = d.tiles
  const walls: Point[][] = []
  const doors: { at: Point; ends: [Point, Point]; rotation: number }[] = []
  if (!tiles) return { walls, doors }
  const g = d.gridSize || 70
  const mid = (c: number, r: number): Point => [(c + 0.5) * g, (r + 0.5) * g]
  for (const [key, value] of Object.entries(tiles)) {
    if (!blocksSight(tileSet(value))) continue
    const [c, r] = cellOf(key)
    const mark = tileMark(value)
    const placed = tileFor(sidesOf(tiles, c, r), mark)
    const open = placed.part === 'doorway' || placed.part === 'broken'
    if (placed.part === 'doorway') {
      const across = placed.turns ? 0 : Math.PI / 2
      const [x, y] = mid(c, r)
      const [ux, uy] = [Math.cos(across), Math.sin(across)]
      doors.push({ at: [x, y], ends: [[x - (ux * g) / 2, y - (uy * g) / 2], [x + (ux * g) / 2, y + (uy * g) / 2]], rotation: across })
    }
    // each join once: to the square on the right and the one below
    for (const [dc, dr] of [
      [1, 0],
      [0, 1],
    ]) {
      const other = tiles[tileKey(c + dc, r + dr)]
      if (!other || !blocksSight(tileSet(other))) continue
      const otherPlaced = tileFor(sidesOf(tiles, c + dc, r + dr), tileMark(other))
      const otherOpen = otherPlaced.part === 'doorway' || otherPlaced.part === 'broken'
      if (open && otherOpen) continue
      const edge: Point = [(c + 0.5 + dc / 2) * g, (r + 0.5 + dr / 2) * g]
      walls.push([open ? edge : mid(c, r), otherOpen ? edge : mid(c + dc, r + dr)])
    }
  }
  return { walls, doors }
}

/* ---------------- floor textures ---------------- */

const LAID_TEXTURE = /flag|cobble|marble|parquet|plank|brick|block|plate|tile|board|wood|paving/i

/** Whether a pack floor texture is a laid floor (crisp edges, stops at the walls) rather than natural ground. */
export function laidGround(name: string) {
  const kit = kitOf(name)
  return LAID_TEXTURE.test(kit ? `${kit.piece.label} ${kit.piece.id}` : name)
}

/** A floor texture's name to show. */
export const groundLabel = (name: string) => kitOf(name)?.piece.label ?? 'Pack floor'

const colours = new Map<string, string>()
const inked = new Map<string, HTMLCanvasElement>()

function texturePicture(name: string, look: PackLook) {
  const kit = kitOf(name)
  if (!kit) return undefined
  const versions = versionsOf(kit.piece, kit.rev)
  const i = pictureFor(versions, 0, look)
  const pic = pictureOf(fileKey(kit.piece.id, kit.rev, i, 'full'))
  return pic ? { pic, key: fileKey(kit.piece.id, kit.rev, i, 'full'), across: Math.max(0.25, kit.piece.cols || 2) } : undefined
}

/** Which of a drawing's pack floor textures have their pictures here: part of the key the painted ground is kept under. */
export function groundsReady(d: Drawing) {
  const look = lookOf(d)
  const names = new Set([d.groundBase ?? '', ...(d.ground ?? []).map((g) => g.ground)].filter((g) => g.startsWith('pack:')))
  return [...names].map((n) => (texturePicture(n, look) ? 1 : 0)).join('')
}

/** The main colour of a floor texture (for the swatch, and where the map needs one colour for it). */
export function packGroundColour(name: string): string {
  const t = texturePicture(name, { mode: 'colour', biome: 'temperate' })
  if (!t) return '#a39a86'
  const had = colours.get(t.key)
  if (had) return had
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(t.pic, 0, 0, 1, 1)
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data
  const hex = `#${[r, gr, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  colours.set(t.key, hex)
  return hex
}

/**
 * Paints a floor texture over the box, repeating, a square of it as big as the pack says (most are
 * two squares across) and lined up with the map so strokes of it match where they meet. On maps in
 * ink it's drained of colour and printed in the paper's browns. Returns false if its picture isn't here.
 */
export function paintPackGround(ctx: CanvasRenderingContext2D, name: string, box: [number, number, number, number], st: InkStyle, u: number): boolean {
  const t = texturePicture(name, { mode: st.mode, biome: st.tint.label.toLowerCase() })
  if (!t) return false
  const src = st.mode === 'colour' ? t.pic : inkCopy(t.key, t.pic, st.paper)
  const pattern = ctx.createPattern(src, 'repeat')
  if (!pattern) return false
  const k = (t.across * 70 * u) / src.width
  pattern.setTransform(new DOMMatrix().scale(k, k))
  const [x0, y0, x1, y1] = box
  ctx.save()
  ctx.fillStyle = pattern
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  ctx.restore()
  return true
}

function inkCopy(key: string, pic: ImageBitmap | HTMLCanvasElement, paper: string) {
  const id = `${key}|${paper}`
  const had = inked.get(id)
  if (had) return had
  const c = document.createElement('canvas')
  c.width = pic.width
  c.height = pic.height
  const g = c.getContext('2d')!
  g.drawImage(pic, 0, 0)
  g.globalCompositeOperation = 'saturation'
  g.fillStyle = '#808080'
  g.fillRect(0, 0, c.width, c.height)
  // lighter, so the ink over it still reads, then in the paper's colour
  g.globalCompositeOperation = 'screen'
  g.fillStyle = 'rgba(255,255,255,.45)'
  g.fillRect(0, 0, c.width, c.height)
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = paper
  g.fillRect(0, 0, c.width, c.height)
  if (inked.size > 60) inked.clear()
  inked.set(id, c)
  return c
}
