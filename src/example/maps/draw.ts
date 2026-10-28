import type { LabelFont, LineStyle, Point, Shape } from '../../mapDrawing'

/** Small helpers for writing map drawings by hand. */

/** A flat list x, y, x, y, … as points. */
export const pts = (flat: readonly number[]): Point[] => {
  const out: Point[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
  return out
}

export const line = (id: string, style: LineStyle, points: Point[], smooth = false): Shape => ({ id, kind: 'line', style, points, smooth })

export const piece = (id: string, asset: string, at: Point, size: number, seed: number, variant = 0, turn?: number, flip?: boolean): Shape => ({
  id,
  kind: 'asset',
  asset,
  at,
  size,
  seed,
  variant,
  ...(turn ? { turn } : {}),
  ...(flip ? { flip } : {}),
})

/** Map lettering. Place names are italic unless `upright` (towns). */
export const label = (id: string, text: string, at: Point, size: number, font: LabelFont, curve?: Point[], upright = false): Shape => ({
  id,
  kind: 'label',
  text,
  at,
  size,
  color: '#3a2814',
  italic: font === 'place' && !upright,
  font,
  ...(curve ? { curve } : {}),
})

/** A gentle arc from (x0, y0) to (x1, y1); a negative sag bows it upward. */
export function arc(x0: number, y0: number, x1: number, y1: number, sag = 0, n = 8): Point[] {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1
  const cx = (x0 + x1) / 2 + (-(y1 - y0) / d) * sag * 2
  const cy = (y0 + y1) / 2 + ((x1 - x0) / d) * sag * 2
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const [a, b, c] = [(1 - t) * (1 - t), 2 * (1 - t) * t, t * t]
    return [Math.round((a * x0 + b * cx + c * x1) * 10) / 10, Math.round((a * y0 + b * cy + c * y1) * 10) / 10] as Point
  })
}

/** A small seeded random number source, so scattered pieces land in the same places every time. */
export function rng(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const segDist = (x: number, y: number, [x1, y1]: Point, [x2, y2]: Point) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const l = dx * dx + dy * dy
  const t = l ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l)) : 0
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/** Keeps track of what's been placed, so scattered pieces leave room for towns, roads and lettering. */
export class Room {
  private spots: [number, number, number][] = []
  private paths: { pts: Point[]; r: number }[] = []
  take(x: number, y: number, r: number) {
    this.spots.push([x, y, r])
  }
  takeLine(points: Point[], r: number) {
    this.paths.push({ pts: points, r })
  }
  /** Room for a box of text centred at (x, y). */
  takeText(x: number, y: number, w: number, h: number) {
    for (let i = 0; i <= Math.ceil(w / h); i++) this.take(x - w / 2 + (i * w) / Math.ceil(w / h || 1), y, h / 2 + 2)
  }
  free(x: number, y: number, r: number) {
    if (this.spots.some(([sx, sy, sr]) => Math.hypot(sx - x, sy - y) < sr + r)) return false
    return this.paths.every(({ pts, r: pr }) => pts.every((p, i) => i === 0 || segDist(x, y, pts[i - 1], p) >= pr + r))
  }
}

/** Points scattered over an area with at least `gap` between them; `ok` says where they may go. */
export function scatter(n: number, pick: () => Point, gap: number, ok: (x: number, y: number) => boolean, tries = 30): Point[] {
  const out: Point[] = []
  for (let i = 0; i < n * tries && out.length < n; i++) {
    const [x, y] = pick()
    if (!ok(x, y)) continue
    if (out.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < gap)) continue
    out.push([Math.round(x), Math.round(y)])
  }
  return out
}

/** A rough closed blob (lakes, islands) around (cx, cy). */
export function blob(rand: () => number, cx: number, cy: number, rx: number, ry: number, n = 14, ang = 0): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.3
    const k = 0.78 + rand() * 0.34
    const [px, py] = [Math.cos(a) * rx * k, Math.sin(a) * ry * k]
    return [Math.round(cx + px * Math.cos(ang) - py * Math.sin(ang)), Math.round(cy + px * Math.sin(ang) + py * Math.cos(ang))] as Point
  })
}

/** Midpoint displacement: a line made ragged, the same way every time for the same random source. */
export function rough(rand: () => number, points: Point[], depth = 3, amount = 0.25): Point[] {
  let p = points
  for (let d = 0; d < depth; d++) {
    const q: Point[] = [p[0]]
    for (let i = 1; i < p.length; i++) {
      const [a, b] = [p[i - 1], p[i]]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const off = (rand() - 0.5) * len * amount
      q.push([(a[0] + b[0]) / 2 - ((b[1] - a[1]) / (len || 1)) * off, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / (len || 1)) * off], b)
    }
    p = q
  }
  return p.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])
}

/** Town maps: the turn that sets a building's front (its bottom edge) toward a point on the street. */
export const face = (at: Point, toward: Point) => Math.round((Math.atan2(-(toward[0] - at[0]), toward[1] - at[1]) * 180) / Math.PI + 360) % 360

/** Whether (x, y) is inside a closed outline. */
export function inside(poly: Point[], x: number, y: number) {
  let r = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r
  }
  return r
}

/**
 * Spots every `step` along a line, `off` to one side (side 1 is to the right going along it, -1 the
 * left), each with the turn that faces it back onto the line.
 */
export function alongside(points: Point[], side: 1 | -1, off: number, step: number, from = 0, to = Infinity): { at: Point; turn: number }[] {
  const out: { at: Point; turn: number }[] = []
  let walked = 0
  let next = from
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (!len) continue
    const [tx, ty] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    const [nx, ny] = [-ty * side, tx * side]
    while (next <= walked + len && next <= to) {
      const t = next - walked
      const at: Point = [Math.round(a[0] + tx * t + nx * off), Math.round(a[1] + ty * t + ny * off)]
      out.push({ at, turn: face(at, [a[0] + tx * t, a[1] + ty * t]) })
      next += step
    }
    walked += len
  }
  return out
}
