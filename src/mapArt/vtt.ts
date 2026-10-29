/**
 * Universal VTT files (.dd2vtt, the format Dungeondraft made): the map picture plus its walls, doors
 * and lights, measured in grid squares, for Foundry (Universal Battlemap Importer), Roll20
 * (UniversalVTTImporter), Fantasy Grounds and others.
 *
 * Walls are the rooms' walls and any wall, inner wall or hedge lines, with a gap left at each door.
 * Doors become doors; bars you can see through (a portcullis, an iron gate) become windows, which
 * stop you but not your sight. Pillars and buildings block sight, and torches, braziers and
 * campfires give light.
 */
import { Atlas, type Point } from './atlas'
import { canTurn, roomWalls, styleFor } from './classic'
import { loopArea, smoothLine, traceLoops } from './geometry'
import type { Drawing, Shape } from '../mapDrawing'

type Asset = Extract<Shape, { kind: 'asset' }>

/** What a door piece leaves in the wall: a door, bars you can see through, or just a gap. */
type Opening = 'door' | 'window' | 'gap'
export const OPENINGS: Record<string, (variant: number) => Opening> = {
  // 5 is broken, hanging off one hinge
  'dg-door': (v) => (v === 5 ? 'gap' : 'door'),
  'dg-double-door': () => 'door',
  // 1 is raised and 5 is broken bars; 7 is a wooden palisade gate
  'dg-portcullis': (v) => (v === 1 || v === 5 ? 'gap' : v === 7 ? 'door' : 'window'),
  // 4 is a curtain: it hides what's beyond, so it's a door you can push aside
  'dg-arch': (v) => (v === 4 ? 'door' : 'gap'),
  // only on the GM's copy: the players' copy has plain wall there
  'gm-secret-door': () => 'door',
}

/** Lights, by piece and version: how far they reach in squares, and their colour (AARRGGBB). */
const LIGHTS: Record<string, (variant: number) => { range: number; color: string } | undefined> = {
  // 1 is unlit and 4 burned out; 3 is a few candles; 7 is a cold magic flame
  'dg-torch': (v) => (v === 1 || v === 4 ? undefined : { range: v === 3 ? 3 : 6, color: v === 7 ? 'ffa9d8ff' : 'ffffc477' }),
  // 7 is cold and kicked over
  'dg-brazier': (v) => (v === 7 ? undefined : { range: 6, color: 'ffffb35c' }),
  'bm-campfire': () => ({ range: 6, color: 'ffffa94d' }),
}

/** Pieces you can't see past: their outline is traced from how they're drawn. */
const SOLID = new Set(['dg-pillar', 'dg-pillar-square', 'bm-cottage', 'bm-house', 'bm-barn', 'bm-tower', 'bm-chapel', 'bm-tent', 'bm-tent-large'])

/** Lines that block sight on a battle map. */
const WALL_LINES = new Set(['wall', 'dwall', 'hedge'])

export interface Portal {
  at: Point
  /** The two ends of the opening. */
  ends: [Point, Point]
  /** Radians. */
  rotation: number
  /** A door (true) or a window (false). */
  closed: boolean
  /** Not set in any wall. */
  freestanding: boolean
}

/** Everything a virtual tabletop needs besides the picture, in map pixels. */
export interface VttParts {
  walls: Point[][]
  /** Outlines of the pieces that block sight, and how many pieces they're from. */
  objects: Point[][]
  solid: number
  portals: Portal[]
  lights: { at: Point; range: number; color: string }[]
}

const ang = (s: Asset) => (((s.turn ?? 0) % 360) * Math.PI) / 180
const variantOf = (s: Asset) => ((s.variant % 8) + 8) % 8
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** A door's opening as a box: its middle, the way across it (u) and through it (n), and how far each way. */
interface Hole {
  c: Point
  u: Point
  n: Point
  hw: number
  hd: number
}

/** The part of the segment a→b that lies inside a hole, as [t0, t1], or undefined. */
function inside(h: Hole, a: Point, b: Point): [number, number] | undefined {
  let lo = 0
  let hi = 1
  for (const [axis, half] of [
    [h.u, h.hw],
    [h.n, h.hd],
  ] as const) {
    const p = (a[0] - h.c[0]) * axis[0] + (a[1] - h.c[1]) * axis[1]
    const q = (b[0] - a[0]) * axis[0] + (b[1] - a[1]) * axis[1]
    if (Math.abs(q) < 1e-9) {
      if (Math.abs(p) > half) return undefined
      continue
    }
    let t0 = (-half - p) / q
    let t1 = (half - p) / q
    if (t0 > t1) [t0, t1] = [t1, t0]
    lo = Math.max(lo, t0)
    hi = Math.min(hi, t1)
    if (lo >= hi) return undefined
  }
  return [lo, hi]
}

/** A wall with the holes cut out of it, as the runs of wall left over. */
function cut(pts: Point[], closed: boolean, holes: Hole[], used: Set<Hole>): Point[][] {
  const n = closed ? pts.length : pts.length - 1
  const out: Point[][] = []
  let cur: Point[] = []
  const flush = () => {
    if (cur.length > 1) out.push(cur)
    cur = []
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const cuts: [number, number][] = []
    for (const h of holes) {
      const c = inside(h, a, b)
      if (c) {
        cuts.push(c)
        used.add(h)
      }
    }
    cuts.sort((x, y) => x[0] - y[0])
    if (!cur.length) cur.push(a)
    let t = 0
    for (const [t0, t1] of cuts) {
      if (t1 <= t) continue
      if (t0 > t) cur.push(lerp(a, b, t0))
      flush()
      t = Math.max(t, t1)
      if (t < 1) cur.push(lerp(a, b, t))
    }
    if (t < 1) cur.push(b)
  }
  flush()
  // a loop that wasn't cut where it starts carries on into its first run
  if (closed && out.length > 1 && out[0][0] === pts[0] && out[out.length - 1].at(-1) === pts[0]) out[0] = [...out.pop()!, ...out[0].slice(1)]
  return out
}

/** The outline of a piece as drawn: the shape it covers, traced from a small drawing of it. */
function silhouette(s: Asset, d: Drawing, W: number, H: number): Point[][] {
  const def = Atlas.assets[s.asset]
  if (!def) return []
  const px = 96
  const ms = px / (s.size * 1.8)
  const c = document.createElement('canvas')
  c.width = c.height = px
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.setTransform(ms, 0, 0, ms, px / 2, px / 2)
  if (canTurn(s.asset)) ctx.rotate(ang(s))
  if (s.flip) ctx.scale(-1, 1)
  try {
    def.draw(ctx, 0, 0, s.size, Atlas.rng(s.seed), { ...styleFor(d, W, H), shadows: false }, variantOf(s))
  } catch {
    return []
  }
  const data = ctx.getImageData(0, 0, px, px).data
  const off = px / 2 / ms
  const loops = traceLoops(data, px, px, ms, 2).filter((l) => l.length > 2)
  // bits and pieces lying about (a bucket by a house, a chip off a pillar) don't block anything
  const biggest = Math.max(0, ...loops.map((l) => Math.abs(loopArea(l))))
  return loops
    .filter((l) => Math.abs(loopArea(l)) > biggest * 0.04)
    .map((l) => simplify(l, s.size * 0.03).map(([x, y]) => [s.at[0] + x - off, s.at[1] + y - off] as Point))
    .filter((l) => l.length > 2)
}

/** Drop points that hardly bend the line (Ramer–Douglas–Peucker). */
function simplify(pts: Point[], tol: number): Point[] {
  if (pts.length < 3) return pts
  const [a, b] = [pts[0], pts[pts.length - 1]]
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const len = Math.hypot(dx, dy) || 1
  let max = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const dist = len > 1e-6 ? Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / len : Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1])
    if (dist > max) [max, idx] = [dist, i]
  }
  if (max <= tol) return [a, b]
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)]
}

export const length = (l: Point[]) => l.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0)

/** Work out the walls, doors, solid pieces and lights of a battle map, in map pixels. */
export function vttParts(d: Drawing, W: number, H: number): VttParts {
  const g = d.gridSize || 70
  const hidden = new Set(d.hidden ?? [])
  const pieces = hidden.has('objects') ? [] : d.shapes.filter((s): s is Asset => s.kind === 'asset')
  const holes: Hole[] = []
  const portals: (Portal & { hole: Hole })[] = []
  for (const s of pieces) {
    const kind = OPENINGS[s.asset]?.(variantOf(s))
    if (!kind) continue
    const a = ang(s)
    const u: Point = [Math.cos(a), Math.sin(a)]
    const hw = s.size * 0.47
    const hole: Hole = { c: s.at, u, n: [-u[1], u[0]], hw, hd: Math.max(0.3 * g, s.size * 0.15) }
    holes.push(hole)
    if (kind !== 'gap')
      portals.push({
        at: s.at,
        ends: [
          [s.at[0] - u[0] * hw, s.at[1] - u[1] * hw],
          [s.at[0] + u[0] * hw, s.at[1] + u[1] * hw],
        ],
        rotation: a,
        closed: kind === 'door',
        freestanding: true,
        hole,
      })
  }

  const used = new Set<Hole>()
  const walls: Point[][] = []
  for (const loop of roomWalls(d, W, H)) walls.push(...cut(loop, true, holes, used))
  if (!hidden.has('paths'))
    for (const s of d.shapes)
      if (s.kind === 'line' && WALL_LINES.has(s.style) && s.points.length > 1) {
        const pts = simplify(smoothLine(s.points, s.smooth && s.style === 'hedge', 0.2 * g), 0.04 * g)
        walls.push(...cut(pts, false, holes, used))
      }

  const solid = pieces.filter((s) => SOLID.has(s.asset))
  const lights = pieces.flatMap((s) => {
    const l = LIGHTS[s.asset]?.(variantOf(s))
    return l ? [{ at: s.at, ...l }] : []
  })
  return {
    walls: walls.filter((w) => length(w) > 0.05 * g),
    objects: solid.flatMap((s) => silhouette(s, d, W, H)),
    solid: solid.length,
    portals: portals.map(({ hole, ...p }) => ({ ...p, freestanding: !used.has(hole) })),
    lights,
  }
}

/** The .dd2vtt file: the parts in grid squares, with the picture (a PNG) inside it. */
export async function vttFile(d: Drawing, W: number, H: number, png: Blob, pixelsPerSquare: number): Promise<Blob> {
  const g = d.gridSize || 70
  const parts = vttParts(d, W, H)
  const [mw, mh] = [W / g, H / g]
  // squares, kept on the map and rounded enough to keep the file small
  const sq = ([x, y]: Point) => ({ x: +Math.min(mw, Math.max(0, x / g)).toFixed(4), y: +Math.min(mh, Math.max(0, y / g)).toFixed(4) })
  const file = {
    format: 0.3,
    resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: mw, y: mh }, pixels_per_grid: pixelsPerSquare },
    line_of_sight: parts.walls.map((w) => w.map(sq)),
    objects_line_of_sight: parts.objects.map((o) => [...o, o[0]].map(sq)),
    portals: parts.portals.map((p) => ({
      position: sq(p.at),
      bounds: p.ends.map(sq),
      rotation: +p.rotation.toFixed(6),
      closed: p.closed,
      freestanding: p.freestanding,
    })),
    environment: { baked_lighting: false, ambient_light: 'ffffffff' },
    lights: parts.lights.map((l) => ({ position: sq(l.at), range: l.range, intensity: 1, color: l.color, shadows: true })),
    image: await base64(png),
  }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

function base64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}
