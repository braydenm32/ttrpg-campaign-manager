/**
 * Classic-style drawn maps: the hand-inked fantasy map look. The drawing is rendered to a canvas
 * from land brush strokes (turned into a ragged, ripple-lined coast), lines, library pieces and
 * curved labels, then saved as the map's picture, so pins, fog and the player view work as usual.
 */
import { Atlas, type InkStyle, type Point, type Rng, type Tint } from './atlas'
import { LAYERS, layerOf, type Drawing, type LayerId, type LabelFont, type Look, type Shape, type StampKind, type Terrain } from '../mapDrawing'

export const LOOKS: Record<Look, { label: string; mode: 'ink' | 'colour'; paper?: string; ink?: string }> = {
  parchment: { label: 'Ink on parchment', mode: 'ink', paper: '#ead9b0', ink: '#3a2814' },
  white: { label: 'Ink on white', mode: 'ink', paper: '#f6f2e8', ink: '#15110d' },
  colour: { label: 'Coloured', mode: 'colour' },
}

export const FONTS: Record<LabelFont, { label: string; family: string }> = {
  title: { label: 'Title', family: '"Uncial Antiqua", "IM Fell English", Georgia, serif' },
  region: { label: 'Region (spaced capitals)', family: '"IM Fell English SC", "IM Fell English", Georgia, serif' },
  place: { label: 'Place name (italic)', family: '"IM Fell English", Georgia, serif' },
}

/** The old simple-style symbols, drawn with the nearest library piece on a classic map. */
const STAMP_ASSET: Record<StampKind, string> = {
  city: 'city', town: 'town', village: 'village', castle: 'castle', tower: 'tower', ruins: 'ruins', temple: 'temple', inn: 'town',
  cave: 'city-dot', dungeon: 'city-dot', camp: 'village', ship: 'ship', tree: 'tree', peak: 'mountain', door: 'city-dot', chest: 'city-dot',
  stairs: 'city-dot', skull: 'city-dot', star: 'city-dot', compass: 'compass-rose',
}

const hashId = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Map size relative to the 1400 px the recipes were tuned at; widths and spacings scale with it. */
const scaleOf = (W: number, H: number) => Math.max(W, H) / 1400

export function styleFor(d: Drawing, W: number, H: number): InkStyle {
  const look = LOOKS[d.look ?? 'parchment']
  const st = Atlas.style(look.mode, d.biome ?? 'temperate', d.shadows !== false)
  if (look.paper) st.paper = look.paper
  if (look.ink) st.ink = look.ink
  st.line = Math.min(2.4, Math.max(1, scaleOf(W, H)))
  return st
}

/** Fonts must be loaded before canvas text uses them, or the first render falls back to Georgia. */
let fontsReady: Promise<unknown> | undefined
export function loadMapFonts() {
  fontsReady ??= Promise.race([
    Promise.all(['20px "IM Fell English"', 'italic 20px "IM Fell English"', '20px "IM Fell English SC"', '20px "Uncial Antiqua"'].map((f) => document.fonts.load(f))),
    new Promise((res) => setTimeout(res, 3000)),
  ]).catch(() => {})
  return fontsReady
}

/* ---------------- land: brush strokes → mask → ragged coastline ---------------- */

interface LandShape {
  loops: Point[][]
  path: Path2D
  isLand: (x: number, y: number) => boolean
}

function paintMask(d: Drawing, W: number, H: number, ms: number) {
  const mw = Math.max(2, Math.ceil(W * ms))
  const mh = Math.max(2, Math.ceil(H * ms))
  const c = document.createElement('canvas')
  c.width = mw
  c.height = mh
  const m = c.getContext('2d', { willReadFrequently: true })!
  m.scale(ms, ms)
  m.lineCap = 'round'
  m.lineJoin = 'round'
  m.fillStyle = m.strokeStyle = '#000'
  if (d.background !== 'sea') m.fillRect(-10, -10, W + 20, H + 20)
  const hidden = d.hidden?.includes('land')
  if (!hidden) {
    for (const s of d.shapes) {
      if (s.kind !== 'area') continue
      m.globalCompositeOperation = s.terrain === 'water' ? 'destination-out' : 'source-over'
      m.beginPath()
      s.points.forEach(([x, y], i) => (i ? m.lineTo(x, y) : m.moveTo(x, y)))
      m.closePath()
      m.fill()
    }
    for (const st of d.land ?? []) {
      m.globalCompositeOperation = st.mode === 'water' ? 'destination-out' : 'source-over'
      m.lineWidth = st.size
      m.beginPath()
      if (st.points.length === 1) {
        m.arc(st.points[0][0], st.points[0][1], st.size / 2, 0, Math.PI * 2)
        m.fill()
      } else {
        st.points.forEach(([x, y], i) => (i ? m.lineTo(x, y) : m.moveTo(x, y)))
        m.stroke()
      }
    }
  }
  const data = m.getImageData(0, 0, mw, mh).data
  return { mw, mh, data }
}

/** Marching squares over the mask; returns closed loops in map coordinates. */
function traceLoops(data: Uint8ClampedArray, mw: number, mh: number, ms: number): Point[][] {
  const P = 2
  const GW = mw + 2 * P
  const GH = mh + 2 * P
  const v = new Float32Array(GW * GH)
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      const x = Math.min(mw - 1, Math.max(0, gx - P))
      const y = Math.min(mh - 1, Math.max(0, gy - P))
      v[gy * GW + gx] = data[(y * mw + x) * 4 + 3] / 255
    }
  const T = 0.5
  const pts = new Map<number, Point>()
  const hId = (x: number, y: number) => (y * GW + x) * 2
  const vId = (x: number, y: number) => (y * GW + x) * 2 + 1
  const at = (id: number): Point => {
    let p = pts.get(id)
    if (p) return p
    const cell = id >> 1
    const x = cell % GW
    const y = (cell - x) / GW
    if (id & 1) {
      const a = v[y * GW + x]
      const b = v[(y + 1) * GW + x]
      const t = (T - a) / (b - a || 1)
      p = [x, y + t]
    } else {
      const a = v[y * GW + x]
      const b = v[y * GW + x + 1]
      const t = (T - a) / (b - a || 1)
      p = [x + t, y]
    }
    pts.set(id, p)
    return p
  }
  const segs: [number, number][] = []
  for (let cy = 0; cy < GH - 1; cy++)
    for (let cx = 0; cx < GW - 1; cx++) {
      const a = v[cy * GW + cx]
      const b = v[cy * GW + cx + 1]
      const c = v[(cy + 1) * GW + cx + 1]
      const dd = v[(cy + 1) * GW + cx]
      const k = (a >= T ? 8 : 0) | (b >= T ? 4 : 0) | (c >= T ? 2 : 0) | (dd >= T ? 1 : 0)
      if (k === 0 || k === 15) continue
      const top = hId(cx, cy)
      const bottom = hId(cx, cy + 1)
      const left = vId(cx, cy)
      const right = vId(cx + 1, cy)
      const centre = (a + b + c + dd) / 4 >= T
      switch (k) {
        case 1: case 14: segs.push([left, bottom]); break
        case 2: case 13: segs.push([bottom, right]); break
        case 3: case 12: segs.push([left, right]); break
        case 4: case 11: segs.push([top, right]); break
        case 6: case 9: segs.push([top, bottom]); break
        case 7: case 8: segs.push([left, top]); break
        case 5:
          if (centre) segs.push([left, top], [bottom, right])
          else segs.push([top, right], [left, bottom])
          break
        case 10:
          if (centre) segs.push([top, right], [left, bottom])
          else segs.push([left, top], [bottom, right])
          break
      }
    }
  const byEdge = new Map<number, number[]>()
  segs.forEach(([p, q], i) => {
    for (const e of [p, q]) {
      const l = byEdge.get(e)
      if (l) l.push(i)
      else byEdge.set(e, [i])
    }
  })
  const used = new Uint8Array(segs.length)
  const loops: Point[][] = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = 1
    const ids = [segs[i][0], segs[i][1]]
    let cur = segs[i][1]
    for (;;) {
      const next = (byEdge.get(cur) ?? []).find((j) => !used[j])
      if (next === undefined) break
      used[next] = 1
      cur = segs[next][0] === cur ? segs[next][1] : segs[next][0]
      if (cur === ids[0]) break
      ids.push(cur)
    }
    if (ids.length < 4) continue
    loops.push(ids.map((id) => {
      const [gx, gy] = at(id)
      return [(gx - P + 0.5) / ms, (gy - P + 0.5) / ms] as Point
    }))
  }
  return loops
}

function makeNoise(seed: number) {
  const h = (x: number, y: number) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const w = yf * yf * (3 - 2 * yf)
    const a = h(xi, yi)
    const b = h(xi + 1, yi)
    const c = h(xi, yi + 1)
    const e = h(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * w + (a - b - c + e) * u * w
  }
  return (x: number, y: number) => {
    let s = 0
    let amp = 1
    let f = 1
    let tot = 0
    for (let o = 0; o < 4; o++) {
      s += amp * (vn(x * f, y * f) * 2 - 1)
      tot += amp
      amp *= 0.5
      f *= 2.13
    }
    return s / tot
  }
}

/** Smooth the traced loop, resample it evenly and push it in and out with noise tied to position,
 * so the coast looks hand-drawn and an edit elsewhere doesn't redraw the whole coastline. */
function roughen(loop: Point[], k: number, noise: (x: number, y: number) => number): Point[] {
  let p = loop
  for (let it = 0; it < 2; it++) {
    const q: Point[] = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i]
      const b = p[(i + 1) % p.length]
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    p = q
  }
  const step = 3 * k
  const res: Point[] = []
  let carry = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    const d = Math.hypot(b[0] - a[0], b[1] - a[1])
    for (let t = carry; t < d; t += step) res.push([a[0] + ((b[0] - a[0]) * t) / d, a[1] + ((b[1] - a[1]) * t) / d])
    carry = d > 0 ? (((carry - d) % step) + step) % step : carry
  }
  if (res.length < 6) return res
  const amp = 7 * k
  const wl = 55 * k
  return res.map((pt, i) => {
    const a = res[(i - 1 + res.length) % res.length]
    const b = res[(i + 1) % res.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const off = noise(pt[0] / wl, pt[1] / wl) * amp
    return [pt[0] - (dy / len) * off, pt[1] + (dx / len) * off] as Point
  })
}

const loopArea = (l: Point[]) => {
  let a = 0
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) a += (l[j][0] + l[i][0]) * (l[j][1] - l[i][1])
  return Math.abs(a / 2)
}

function landShape(d: Drawing, W: number, H: number): LandShape {
  const ms = Math.min(1, 1000 / Math.max(W, H))
  const { mw, mh, data } = paintMask(d, W, H, ms)
  const k = scaleOf(W, H)
  const noise = makeNoise(d.seed ?? 1)
  const minArea = (6 * k) ** 2
  const loops = traceLoops(data, mw, mh, ms)
    .filter((l) => loopArea(l) > minArea)
    .map((l) => roughen(l, k, noise))
    .filter((l) => l.length > 5)
  const path = new Path2D()
  for (const l of loops) {
    l.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
    path.closePath()
  }
  const isLand = (x: number, y: number) => {
    const mx = Math.floor(x * ms)
    const my = Math.floor(y * ms)
    if (mx < 0 || my < 0 || mx >= mw || my >= mh) return d.background !== 'sea'
    return data[(my * mw + mx) * 4 + 3] > 127
  }
  return { loops, path, isLand }
}

/* ---------------- lines ---------------- */

/** Catmull-Rom through the points, sampled every few px, so freehand lines come out smooth. */
function smoothLine(points: Point[], smooth: boolean, step: number): Point[] {
  if (!smooth || points.length < 3) return points
  const out: Point[] = []
  const p = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let j = 0; j < n; j++) {
      const t = j / n
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(points[points.length - 1])
  return out
}

type Area = Extract<Shape, { kind: 'area' }>

/** The tint each simple-style region gets on a coloured classic map. */
const AREA_WASH: Partial<Record<Terrain, keyof Tint>> = {
  grass: 'grass', forest: 'forest', mountains: 'rock', hills: 'grass', swamp: 'grass', desert: 'sand', snow: 'snow', floor: 'rock', wood: 'roof',
}

/**
 * Areas from a map first drawn in the simple style. Plain land and water become coastline; rooms
 * keep an inked outline and regions like forest or desert get a wash (colour) or a dotted edge
 * (ink), so nothing vanishes when the style is switched.
 */
const marked = (s: Area) => !s.smooth || !!AREA_WASH[s.terrain]

function areaPath(s: Area, k: number) {
  const pts = smoothLine([...s.points, s.points[0]], s.smooth, 6 * k)
  const path = new Path2D()
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
  path.closePath()
  return { pts, path }
}

function drawArea(ctx: CanvasRenderingContext2D, s: Area, st: InkStyle, k: number) {
  const { pts, path } = areaPath(s, k)
  const wash = AREA_WASH[s.terrain]
  ctx.save()
  if (wash && st.mode === 'colour') {
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.45
    ctx.fillStyle = st.tint[wash]
    ctx.fill(path)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  if (!s.smooth) Atlas.inkStroke(ctx, pts, Atlas.rng(hashId(s.id)), { w: 1.6 * st.line, wob: 0.4, taper: 0, color: st.ink })
  else {
    ctx.setLineDash([2 * k, 4 * k])
    ctx.strokeStyle = st.ink
    ctx.globalAlpha = 0.7
    ctx.lineWidth = st.line
    ctx.stroke(path)
  }
  ctx.restore()
}

function drawLine(ctx: CanvasRenderingContext2D, s: Extract<Shape, { kind: 'line' }>, st: InkStyle, k: number) {
  const r = Atlas.rng(hashId(s.id))
  const pts = smoothLine(s.points, s.smooth, 6 * k)
  const T = Atlas.terrain
  switch (s.style) {
    case 'river':
      T.river(ctx, pts, r, st, { w0: 0.5, w1: 3 })
      break
    case 'road':
      T.road(ctx, pts, r, st, { gap: 5.5 * st.line, size: 1.05 })
      break
    case 'path': {
      ctx.save()
      ctx.setLineDash([4 * k, 5 * k])
      ctx.strokeStyle = st.ink
      ctx.lineWidth = 1.1 * st.line
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      Atlas.wobble(pts, r, 0.5, 8).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.stroke()
      ctx.restore()
      break
    }
    case 'border':
      T.border(ctx, pts, r, st)
      break
    case 'wall':
      Atlas.inkStroke(ctx, pts, r, { w: 5 * k, wob: 0.4, taper: 0.1, color: st.ink })
      break
    case 'ink':
      Atlas.inkStroke(ctx, pts, r, { w: 1.8 * st.line, wob: 0.5, taper: 0.6, color: st.ink })
      break
  }
}

/* ---------------- pieces and labels ---------------- */

export interface Piece {
  id: string
  asset: string
  at: Point
  size: number
  seed: number
  variant: number
  flip: boolean
}

const pieceOf = (s: Shape): Piece | undefined =>
  s.kind === 'asset'
    ? { id: s.id, asset: s.asset, at: s.at, size: s.size, seed: s.seed, variant: s.variant, flip: !!s.flip }
    : s.kind === 'stamp'
      ? { id: s.id, asset: STAMP_ASSET[s.stamp], at: s.at, size: s.size, seed: hashId(s.id), variant: hashId(s.id) % 8, flip: false }
      : undefined

/** Rough area a piece covers, [x, y, w, h], for clicking and selecting. */
export function pieceBox(p: Piece): [number, number, number, number] {
  const def = Atlas.assets[p.asset]
  const s = p.size
  if (def?.view === 'side') {
    const w = def.category === 'settlements' || def.category === 'landmarks' ? s * 1.6 : s
    return [p.at[0] - w / 2, p.at[1] - s, w, s * 1.05]
  }
  const h = p.asset === 'cartouche' ? s / 2 : p.asset === 'scale-bar' ? s / 3 : s
  return [p.at[0] - s / 2, p.at[1] - h / 2, s, h]
}

export function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, st: InkStyle) {
  const def = Atlas.assets[p.asset]
  if (!def) return
  ctx.save()
  if (p.flip) {
    ctx.translate(p.at[0], 0)
    ctx.scale(-1, 1)
    ctx.translate(-p.at[0], 0)
  }
  try {
    def.draw(ctx, p.at[0], p.at[1], p.size, Atlas.rng(p.seed), st, ((p.variant % 8) + 8) % 8)
  } catch (e) {
    console.warn('Map piece failed to draw', p.asset, e)
  }
  ctx.restore()
}

function labelFont(s: Extract<Shape, { kind: 'label' }>) {
  const f = s.font ?? 'place'
  const style = f === 'place' && s.italic !== false ? 'italic ' : ''
  return `${style}${Math.round(s.size)}px ${FONTS[f].family}`
}

function drawLabel(ctx: CanvasRenderingContext2D, s: Extract<Shape, { kind: 'label' }>, st: InkStyle, halo: string, k: number) {
  const font = labelFont(s)
  const region = s.font === 'region'
  const text = region ? s.text.toUpperCase() : s.text
  const spacing = region ? s.size * 0.45 : s.font === 'title' ? s.size * 0.04 : s.size * 0.05
  const opts = { font, color: st.ink, halo, spacing, haloWidth: Math.max(4, s.size * 0.22) * Math.min(1.5, k) }
  ctx.save()
  if (s.curve && s.curve.length >= 2) Atlas.terrain.curvedText(ctx, text, smoothLine(s.curve, true, 4 * k), opts)
  else if (spacing > 1) Atlas.terrain.curvedText(ctx, text, [[s.at[0] - 10, s.at[1]], [s.at[0] + 10, s.at[1]]], opts)
  else Atlas.terrain.text(ctx, text, s.at[0], s.at[1], opts)
  ctx.restore()
}

/** Rough label area for clicking, [x, y, w, h]. */
export function labelBox(ctx: CanvasRenderingContext2D, s: Extract<Shape, { kind: 'label' }>): [number, number, number, number] {
  const pts = s.curve && s.curve.length >= 2 ? s.curve : undefined
  if (pts) {
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    return [Math.min(...xs) - s.size / 2, Math.min(...ys) - s.size / 2, Math.max(...xs) - Math.min(...xs) + s.size, Math.max(...ys) - Math.min(...ys) + s.size]
  }
  ctx.font = labelFont(s)
  const region = s.font === 'region'
  const w = ctx.measureText(region ? s.text.toUpperCase() : s.text).width + (region ? s.text.length * s.size * 0.45 : 0)
  return [s.at[0] - w / 2, s.at[1] - s.size * 0.6, w, s.size * 1.2]
}

/* ---------------- the whole map ---------------- */

function drawGrid(ctx: CanvasRenderingContext2D, d: Drawing, W: number, H: number, st: InkStyle) {
  if (d.grid === 'none') return
  const g = d.gridSize
  ctx.save()
  ctx.strokeStyle = st.ink
  ctx.globalAlpha = 0.22
  ctx.lineWidth = 1 * st.line
  ctx.beginPath()
  if (d.grid === 'square') {
    for (let x = g; x < W; x += g) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
    }
    for (let y = g; y < H; y += g) {
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
    }
  } else {
    const r = g / 2
    const hw = r * 1.5
    const hh = r * Math.sqrt(3)
    for (let col = 0; col * hw < W + r; col++)
      for (let row = 0; row * hh < H + hh; row++) {
        const cx = col * hw
        const cy = row * hh + (col % 2 ? hh / 2 : 0)
        for (let i = 0; i <= 6; i++) {
          const a = (Math.PI / 3) * i
          const x = cx + r * Math.cos(a)
          const y = cy + r * Math.sin(a)
          if (i) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        }
      }
  }
  ctx.stroke()
  ctx.restore()
}

function agePaper(ctx: CanvasRenderingContext2D, W: number, H: number, look: Look, r: Rng, k: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  const n = Math.round((look === 'white' ? 10 : 50) * Math.max(1, k * k * 0.6))
  for (let i = 0; i < n; i++) {
    const x = Atlas.R(r, 0, W)
    const y = Atlas.R(r, 0, H)
    const rad = Atlas.R(r, 40, 220) * k
    const a = Atlas.R(r, 0.03, look === 'white' ? 0.05 : 0.12)
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, `rgba(160,120,70,${a})`)
    g.addColorStop(1, 'rgba(160,120,70,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  if (look !== 'white') {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75)
    g.addColorStop(0, 'rgba(120,80,30,0)')
    g.addColorStop(1, 'rgba(120,80,30,.32)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  ctx.restore()
}

function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, st: InkStyle, k: number) {
  const o = 14 * k
  const i = 21 * k
  ctx.save()
  ctx.strokeStyle = st.ink
  ctx.lineWidth = 2.6 * k
  ctx.strokeRect(o, o, W - 2 * o, H - 2 * o)
  ctx.lineWidth = 0.9 * k
  ctx.strokeRect(i, i, W - 2 * i, H - 2 * i)
  ctx.fillStyle = st.ink
  ctx.globalAlpha = 0.8
  const step = 18 * k
  const band = i - o
  for (let x = i; x < W - i - step / 2; x += step * 2) {
    ctx.fillRect(x, o, step, band)
    ctx.fillRect(x, H - i, step, band)
  }
  for (let y = i; y < H - i - step / 2; y += step * 2) {
    ctx.fillRect(o, y, band, step)
    ctx.fillRect(W - i, y, band, step)
  }
  ctx.restore()
}

let baseCache: { key: string; canvas: HTMLCanvasElement } | undefined
let landCache: (LandShape & { key: string }) | undefined

/** The land only changes when the brush strokes, old area shapes, start or seed change. */
function landFor(d: Drawing, W: number, H: number): LandShape & { key: string } {
  const areas = d.shapes.filter((s) => s.kind === 'area').map((s) => `${s.id}:${s.kind === 'area' ? s.terrain + s.points.length + s.points[0] : ''}`)
  const strokes = (d.land ?? []).map((s) => s.id)
  const key = `${W}x${H}|${d.background}|${d.seed}|${d.hidden?.includes('land') ? 'h' : ''}|${areas.join(',')}|${strokes.join(',')}`
  if (landCache?.key !== key) landCache = { ...landShape(d, W, H), key }
  return landCache
}

/** Whether a point is on land, so the scatter brush can keep trees ashore and ships at sea. */
export const landTest = (d: Drawing, W: number, H: number) => landFor(d, W, H).isLand

function drawBase(d: Drawing, W: number, H: number, scale: number, st: InkStyle, land: LandShape, landPaper: string, r: Rng) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(W * scale))
  canvas.height = Math.max(1, Math.round(H * scale))
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const k = scaleOf(W, H)
  const colour = st.mode === 'colour'
  const T = Atlas.terrain
  // sea, then land with its coast
  ctx.fillStyle = colour ? st.tint.water : st.paper
  ctx.fillRect(0, 0, W, H)
  if (colour) {
    for (let i = 0; i < 40 * k * k; i++) {
      const x = Atlas.R(r, 0, W)
      const y = Atlas.R(r, 0, H)
      const rad = Atlas.R(r, 40, 160) * k
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, 'rgba(40,80,70,.12)')
      g.addColorStop(1, 'rgba(40,80,70,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
  }
  if (land.loops.length) {
    // T.ripples draws through an offscreen canvas in device pixels, so it follows our scale.
    T.ripples(ctx, land.path, W, H, st, { rings: [6 * k, 12 * k, 19 * k], alpha: colour ? 0.35 : 0.5, lw: 0.9 * st.line })
    ctx.fillStyle = landPaper
    ctx.fill(land.path, 'evenodd')
    const coastLen = land.loops.reduce((n, l) => n + l.length, 0)
    T.coastStipple(ctx, land.loops, land.isLand, r, st, { n: Math.round(coastLen * 1.6), spread: 22 * k, size: 0.7 * st.line })
    for (const l of land.loops) Atlas.inkStroke(ctx, [...l, l[0]], r, { w: 2.2 * st.line, wob: 0.3, taper: 0.15, color: st.ink })
  } else if (d.background !== 'sea') {
    ctx.fillStyle = landPaper
    ctx.fillRect(0, 0, W, H)
  }

  return canvas
}

/**
 * Draw a classic map at full size. `scale` < 1 renders a smaller copy (same look) for quick previews.
 */
export function renderClassic(d: Drawing, W: number, H: number, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(W * scale))
  canvas.height = Math.max(1, Math.round(H * scale))
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const st = styleFor(d, W, H)
  const k = scaleOf(W, H)
  const look = d.look ?? 'parchment'
  const colour = st.mode === 'colour'
  const hidden = new Set<LayerId>(d.hidden ?? [])
  const r = Atlas.rng((d.seed ?? 1) * 7919 + 3)
  const landPaper = colour ? st.tint.land : st.paper
  const stLand = { ...st, paper: landPaper }

  // sea, then land with its coast: the slow part, so it's kept until the land or the look changes
  const land = landFor(d, W, H)
  const baseKey = `${land.key}|${look}|${d.biome}|${scale}|${canvas.width}x${canvas.height}`
  if (baseCache?.key !== baseKey) baseCache = { key: baseKey, canvas: drawBase(d, W, H, scale, st, land, landPaper, r) }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(baseCache.canvas, 0, 0)
  ctx.restore()

  const visible = (s: Shape) => !hidden.has(layerOf(s))
  for (const s of d.shapes) if (s.kind === 'area' && visible(s) && marked(s)) drawArea(ctx, s, st, k)

  // lines: rivers under roads and borders
  const lines = d.shapes.filter((s): s is Extract<Shape, { kind: 'line' }> => s.kind === 'line' && visible(s))
  for (const s of lines.filter((s) => s.style === 'river')) drawLine(ctx, s, st, k)
  for (const s of lines.filter((s) => s.style !== 'river')) drawLine(ctx, s, st, k)

  // pieces: lower ones in front
  const pieces = d.shapes.filter(visible).map(pieceOf).filter((p): p is Piece => !!p)
  pieces.sort((a, b) => a.at[1] - b.at[1]).forEach((p) => drawPiece(ctx, p, stLand))

  // colour washes over the land keep the ink lines
  if (colour && land.loops.length) {
    ctx.save()
    ctx.clip(land.path, 'evenodd')
    ctx.globalCompositeOperation = 'multiply'
    ctx.strokeStyle = 'rgba(190,120,90,.35)'
    ctx.lineWidth = 16 * k
    ctx.stroke(land.path)
    ctx.strokeStyle = 'rgba(190,120,90,.25)'
    ctx.lineWidth = 6 * k
    ctx.stroke(land.path)
    ctx.restore()
  }

  drawGrid(ctx, d, W, H, st)

  if (!hidden.has('labels')) for (const s of d.shapes) if (s.kind === 'label') drawLabel(ctx, s, st, landPaper, k)

  agePaper(ctx, W, H, look, Atlas.rng((d.seed ?? 1) + 99), k)
  if (d.frame !== false) drawFrame(ctx, W, H, st, k)
  return canvas
}

/** Save the picture: WebP where the browser can make it, JPEG otherwise (PNG would be huge). */
export async function classicBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const as = (type: string, q?: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q))
  const webp = await as('image/webp', 0.9)
  if (webp && webp.type === 'image/webp') return webp
  const jpg = await as('image/jpeg', 0.92)
  if (jpg) return jpg
  throw new Error('Could not save the map picture')
}

/**
 * Invisible click targets for the editor (the picture itself is a bitmap). Locked and hidden
 * layers get none, so they can't be picked, moved or erased.
 */
export function classicHitSvg(d: Drawing): string {
  const off = new Set<LayerId>([...(d.hidden ?? []), ...(d.locked ?? [])])
  const measure = document.createElement('canvas').getContext('2d')!
  const f = (n: number) => Math.round(n * 10) / 10
  const out: string[] = []
  // areas first, so pieces, lines and labels sit on top of them
  for (const s of d.shapes)
    if (s.kind === 'area' && !off.has('land') && marked(s))
      out.push(`<path data-id="${s.id}" class="hit-area" d="M${s.points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z" fill="transparent"/>`)
  for (const s of d.shapes) {
    if (s.kind === 'area' || off.has(layerOf(s))) continue
    if (s.kind === 'line') {
      const w = s.style === 'wall' ? 20 : 16
      out.push(`<path data-id="${s.id}" class="hit-line" d="M${s.points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}" fill="none" stroke="transparent" stroke-width="${w}" vector-effect="non-scaling-stroke"/>`)
      continue
    }
    const p = pieceOf(s)
    const box = p ? pieceBox(p) : s.kind === 'label' ? labelBox(measure, s) : undefined
    if (box) out.push(`<rect data-id="${s.id}" class="hit-box" x="${f(box[0])}" y="${f(box[1])}" width="${f(box[2])}" height="${f(box[3])}" fill="transparent"/>`)
  }
  return out.join('')
}

export { LAYERS }
