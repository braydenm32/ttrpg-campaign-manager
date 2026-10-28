/**
 * Rooms on battle maps: rectangles, round rooms, passages and caves are dug out of the rock (or
 * filled back in) in the order they were drawn. They're worked out together on a fine grid, so any
 * mix of them merges into one floor, and the walls are traced round the outside of the lot.
 * Outside the rooms is either solid rock (a dungeon: hatched like an old hand-drawn dungeon map) or
 * just the ground (buildings and ruins on an outdoor map).
 */
import { Atlas, type InkStyle, type Point } from './atlas'
import { makeNoise, traceLoops } from './geometry'
import { blur, mottle } from './ground'
import type { Drawing, Shape } from '../mapDrawing'

export interface RoomMap {
  key: string
  /** Mask pixels per map pixel, and the mask's size. */
  ms: number
  mw: number
  mh: number
  /** How much floor there is at each mask pixel, 0 (rock) to 1. */
  floor: Float32Array
  /** How far each mask pixel is from the floor, in map pixels (0 on the floor). */
  away: Float32Array
  /** The walls: loops round each stretch of floor, and round rock left standing inside one. */
  walls: Point[][]
  /** The floor, to fill or clip with (even-odd). */
  path: Path2D
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** A cave stroke as a mask: a fat brush line with its edge pushed in and out by noise. */
function caveMask(points: Point[], size: number, mw: number, mh: number, ms: number, g: number, seed: number) {
  const c = document.createElement('canvas')
  c.width = mw
  c.height = mh
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.scale(ms, ms)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size
  ctx.beginPath()
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  if (points.length === 1) ctx.lineTo(points[0][0] + 0.01, points[0][1])
  ctx.stroke()
  // only the box round the stroke needs working on
  const pad = size / 2 + g
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const x0 = Math.max(0, Math.floor((Math.min(...xs) - pad) * ms))
  const y0 = Math.max(0, Math.floor((Math.min(...ys) - pad) * ms))
  const x1 = Math.min(mw, Math.ceil((Math.max(...xs) + pad) * ms))
  const y1 = Math.min(mh, Math.ceil((Math.max(...ys) + pad) * ms))
  const bw = x1 - x0
  const bh = y1 - y0
  if (bw <= 0 || bh <= 0) return c
  const img = ctx.getImageData(x0, y0, bw, bh)
  const a = new Float32Array(bw * bh)
  for (let i = 0; i < a.length; i++) a[i] = img.data[i * 4 + 3] / 255
  const soft = blur(a, bw, bh, Math.max(0.3 * g, 0.2 * size) * ms * 0.5)
  const noise = makeNoise(seed)
  const wl = 0.8 * g
  for (let j = 0; j < bh; j++)
    for (let i = 0; i < bw; i++) {
      const x = (x0 + i + 0.5) / ms
      const y = (y0 + j + 0.5) / ms
      const v = soft[j * bw + i] + noise(x / wl, y / wl) * 0.32 + noise(x / (0.25 * g) + 17, y / (0.25 * g) + 17) * 0.08
      const k = (j * bw + i) * 4
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 0
      img.data[k + 3] = Math.round(smoothstep(0.42, 0.58, v) * 255)
    }
  ctx.putImageData(img, x0, y0)
  return c
}

/** Two-pass chamfer distance from the floor, in mask pixels. */
function distanceOut(floor: Float32Array, mw: number, mh: number) {
  const d = new Float32Array(mw * mh)
  for (let i = 0; i < d.length; i++) d[i] = floor[i] >= 0.5 ? 0 : 1e9
  const D = Math.SQRT2
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x
      let v = d[i]
      if (x > 0) v = Math.min(v, d[i - 1] + 1)
      if (y > 0) {
        v = Math.min(v, d[i - mw] + 1)
        if (x > 0) v = Math.min(v, d[i - mw - 1] + D)
        if (x < mw - 1) v = Math.min(v, d[i - mw + 1] + D)
      }
      d[i] = v
    }
  for (let y = mh - 1; y >= 0; y--)
    for (let x = mw - 1; x >= 0; x--) {
      const i = y * mw + x
      let v = d[i]
      if (x < mw - 1) v = Math.min(v, d[i + 1] + 1)
      if (y < mh - 1) {
        v = Math.min(v, d[i + mw] + 1)
        if (x < mw - 1) v = Math.min(v, d[i + mw + 1] + D)
        if (x > 0) v = Math.min(v, d[i + mw - 1] + D)
      }
      d[i] = v
    }
  return d
}

/** Ramer–Douglas–Peucker on a closed loop: split it at two far-apart points and simplify each half. */
function simplifyLoop(loop: Point[], tol: number): Point[] {
  if (loop.length < 8) return loop
  const far = (from: Point) => {
    let best = 0
    let bi = 0
    loop.forEach((p, i) => {
      const d = Math.hypot(p[0] - from[0], p[1] - from[1])
      if (d > best) [best, bi] = [d, i]
    })
    return bi
  }
  const a = far(loop[0])
  const b = far(loop[a])
  const [i0, i1] = a < b ? [a, b] : [b, a]
  const rdp = (pts: Point[]): Point[] => {
    if (pts.length < 3) return pts
    const [x1, y1] = pts[0]
    const [x2, y2] = pts[pts.length - 1]
    const dx = x2 - x1
    const dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    let max = 0
    let idx = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((pts[i][0] - x1) * dy - (pts[i][1] - y1) * dx) / len
      if (d > max) [max, idx] = [d, i]
    }
    if (max <= tol) return [pts[0], pts[pts.length - 1]]
    return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))]
  }
  const first = rdp(loop.slice(i0, i1 + 1))
  const second = rdp([...loop.slice(i1), ...loop.slice(0, i0 + 1)])
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}

/**
 * Tidy a traced wall: tracing cuts a little off each corner, so a short edge between two long ones
 * is replaced by the corner where those two meet. Runs of short edges (cave walls) are smoothed.
 */
function tidyLoop(loop: Point[], s: number): Point[] {
  const n = loop.length
  if (n < 4) return loop
  const len = (i: number) => {
    const a = loop[(i + n) % n]
    const b = loop[(i + 1) % n]
    return Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  const out: Point[] = []
  for (let i = 0; i < n; i++) {
    const short = len(i) < 1.6 * s
    if (short && len(i - 1) > 2.5 * s && len(i + 1) > 2.5 * s) {
      // corner: where the edges either side meet
      const [a, b, c, d] = [loop[(i - 1 + n) % n], loop[i], loop[(i + 1) % n], loop[(i + 2) % n]]
      const d1: Point = [b[0] - a[0], b[1] - a[1]]
      const d2: Point = [d[0] - c[0], d[1] - c[1]]
      const den = d1[0] * d2[1] - d1[1] * d2[0]
      if (Math.abs(den) > 1e-6) {
        const t = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / den
        const p: Point = [a[0] + d1[0] * t, a[1] + d1[1] * t]
        if (Math.hypot(p[0] - b[0], p[1] - b[1]) < 2 * s) {
          out.push(p)
          i++
          continue
        }
      }
    }
    const p = loop[i]
    if (len(i - 1) < 2.5 * s && len(i) < 2.5 * s) {
      const a = loop[(i - 1 + n) % n]
      const b = loop[(i + 1) % n]
      out.push([p[0] * 0.5 + (a[0] + b[0]) * 0.25, p[1] * 0.5 + (a[1] + b[1]) * 0.25])
    } else out.push(p)
  }
  return out
}

/** Work out the floor and the walls. Cheap enough to redo after every stroke. */
export function buildRooms(d: Drawing, W: number, H: number, key: string): RoomMap {
  const g = d.gridSize || 70
  const ss = Math.max(g / 10, Math.sqrt((W * H) / 400_000))
  const ms = 1 / ss
  const mw = Math.max(2, Math.ceil(W * ms))
  const mh = Math.max(2, Math.ceil(H * ms))
  const canvas = document.createElement('canvas')
  canvas.width = mw
  canvas.height = mh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.scale(ms, ms)
  let n = 0
  for (const s of d.rooms ?? []) {
    n++
    ctx.globalCompositeOperation = s.mode === 'fill' ? 'destination-out' : 'source-over'
    ctx.fillStyle = ctx.strokeStyle = '#000'
    const [[ax, ay], [bx, by]] = [s.points[0], s.points[s.points.length - 1]]
    ctx.beginPath()
    if (s.shape === 'rect') {
      ctx.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay))
      ctx.fill()
    } else if (s.shape === 'round') {
      ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2, Math.abs(by - ay) / 2, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (s.shape === 'corridor') {
      const w = s.size ?? g
      if (s.points.length === 1) ctx.rect(ax - w / 2, ay - w / 2, w, w)
      else {
        ctx.lineWidth = w
        ctx.lineCap = 'square'
        ctx.lineJoin = 'miter'
        ctx.miterLimit = 2
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.stroke()
      }
      if (s.points.length === 1) ctx.fill()
    } else {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(caveMask(s.points, s.size ?? 2 * g, mw, mh, ms, g, (d.seed ?? 1) * 13 + n), 0, 0)
      ctx.restore()
    }
  }
  const data = ctx.getImageData(0, 0, mw, mh).data
  const floor = new Float32Array(mw * mh)
  for (let i = 0; i < floor.length; i++) floor[i] = data[i * 4 + 3] / 255
  const walls = traceLoops(data, mw, mh, ms, 2)
    .map((l) => tidyLoop(simplifyLoop(l, 0.3 * ss), ss))
    .filter((l) => {
      let a = 0
      for (let i = 0, j = l.length - 1; i < l.length; j = i++) a += (l[j][0] + l[i][0]) * (l[j][1] - l[i][1])
      return Math.abs(a / 2) > (0.25 * g) ** 2
    })
  const path = new Path2D()
  for (const l of walls) {
    l.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
    path.closePath()
  }
  const away = distanceOut(floor, mw, mh)
  for (let i = 0; i < away.length; i++) away[i] *= ss
  return { key, ms, mw, mh, floor, away, walls, path }
}

/** Where a straight line through (ox, oy) heading (dx, dy) crosses a convex polygon, as distances along it. */
function chord(q: Point[], ox: number, oy: number, dx: number, dy: number): [number, number] | undefined {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < q.length; i++) {
    const [ax, ay] = q[i]
    const [bx, by] = q[(i + 1) % q.length]
    const ex = bx - ax
    const ey = by - ay
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-9) continue
    const t = ((ax - ox) * ey - (ay - oy) * ex) / den
    const s = ((ax - ox) * dy - (ay - oy) * dx) / den
    if (s < 0 || s > 1) continue
    lo = Math.min(lo, t)
    hi = Math.max(hi, t)
  }
  return hi > lo ? [lo, hi] : undefined
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const mix = (a: string, b: string, t: number) => {
  const [p, q] = [hex(a), hex(b)]
  return `#${p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}
export const rockColour = (st: InkStyle) => mix(st.tint.rock, '#3b352d', 0.5)

/**
 * The solid rock round a dungeon's rooms, as a full-size canvas to lay over the ground: blank paper
 * (ink) or dark stone (colour), with the clusters of short pen strokes old dungeon maps hatch along
 * the outside of the walls.
 */
export function drawRock(rm: RoomMap, d: Drawing, W: number, H: number, scale: number, st: InkStyle): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(W * scale))
  out.height = Math.max(1, Math.round(H * scale))
  const ctx = out.getContext('2d')!
  ctx.scale(scale, scale)
  const g = d.gridSize || 70
  const u = g / 70
  const colour = st.mode === 'colour'
  const rock = colour ? rockColour(st) : st.paper
  const notFloor = new Path2D()
  notFloor.rect(-2, -2, W + 4, H + 4)
  notFloor.addPath(rm.path)
  ctx.save()
  ctx.clip(notFloor, 'evenodd')
  ctx.fillStyle = rock
  ctx.fillRect(0, 0, W, H)
  if (colour) mottle(ctx, [0, 0, W, H], rock, u, (d.seed ?? 1) + 5)

  // hatching: a jittered lattice of little cells, each filled with a few parallel strokes at its own angle
  const r = Atlas.rng((d.seed ?? 1) * 101 + 7)
  const noise = makeNoise((d.seed ?? 1) + 23)
  const awayAt = (x: number, y: number) => {
    const mx = Math.min(rm.mw - 1, Math.max(0, Math.floor(x * rm.ms)))
    const my = Math.min(rm.mh - 1, Math.max(0, Math.floor(y * rm.ms)))
    return rm.away[my * rm.mw + mx]
  }
  const c = 0.3 * g
  const jit = (i: number, j: number): Point => {
    const h = Atlas.rng(((i + 7919) * 73856093) ^ ((j + 104729) * 19349663) ^ (d.seed ?? 1))
    return [(i + Atlas.R(h, -0.3, 0.3)) * c, (j + Atlas.R(h, -0.3, 0.3)) * c]
  }
  const gap = 0.068 * g
  ctx.beginPath()
  for (let j = -1; j * c < H + c; j++)
    for (let i = -1; i * c < W + c; i++) {
      const q = [jit(i, j), jit(i + 1, j), jit(i + 1, j + 1), jit(i, j + 1)]
      const cx = (q[0][0] + q[2][0]) / 2
      const cy = (q[0][1] + q[2][1]) / 2
      const band = (0.6 + 0.32 * noise(cx / (2.2 * g), cy / (2.2 * g))) * g
      const near = Math.min(...q.map(([x, y]) => awayAt(x, y)), awayAt(cx, cy))
      const far = Math.max(...q.map(([x, y]) => awayAt(x, y)))
      if (near > band || far <= 0) continue
      const ins = q.map(([x, y]) => [x + (cx - x) * 0.1, y + (cy - y) * 0.1] as Point)
      const a = Atlas.R(r, 0, Math.PI)
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      for (let t = -c; t <= c; t += gap * Atlas.R(r, 0.85, 1.15)) {
        const ox = cx - dy * t
        const oy = cy + dx * t
        const hit = chord(ins, ox, oy, dx, dy)
        if (!hit) continue
        const t0 = hit[0] + Atlas.R(r, 0, 0.12) * c
        const t1 = hit[1] - Atlas.R(r, 0, 0.12) * c
        if (t1 - t0 < 0.15 * c) continue
        ctx.moveTo(ox + dx * t0, oy + dy * t0)
        ctx.lineTo(ox + dx * t1, oy + dy * t1)
      }
    }
  ctx.lineCap = 'round'
  ctx.lineWidth = 0.9 * st.line * Math.max(0.8, u)
  ctx.strokeStyle = colour ? mix(rock, '#140f0a', 0.8) : st.ink
  ctx.globalAlpha = colour ? 0.85 : 0.9
  ctx.stroke()
  ctx.restore()
  return out
}

/**
 * Doors in the room library leave a gap in the wall they sit in, and gatehouses one in the town wall.
 * Returns the map with those gaps cut out, to clip walls to.
 */
export function doorGaps(d: Drawing, W: number, H: number, depth: number, which: 'doors' | 'gates' = 'doors'): Path2D | undefined {
  const cuts = (s: Shape) => s.kind === 'asset' && (which === 'gates' ? s.asset === 'ct-gatehouse' : Atlas.assets[s.asset]?.category === 'dg-doors')
  const doors = d.shapes.filter((s): s is Extract<Shape, { kind: 'asset' }> => cuts(s))
  if (!doors.length) return undefined
  const p = new Path2D()
  p.rect(-50, -50, W + 100, H + 100)
  for (const s of doors) {
    const a = ((s.turn ?? 0) * Math.PI) / 180
    const [cos, sin] = [Math.cos(a), Math.sin(a)]
    // a gatehouse's towers cover the cut ends of the town wall a little further in than a door's jambs
    const hw = s.size * (which === 'gates' ? 0.44 : 0.47)
    const hd = depth / 2
    const pts: Point[] = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ].map(([x, y]) => [s.at[0] + x * cos - y * sin, s.at[1] + x * sin + y * cos])
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)))
    p.closePath()
  }
  return p
}
