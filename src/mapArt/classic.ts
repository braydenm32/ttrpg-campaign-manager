/**
 * Classic-style drawn maps: the hand-inked fantasy map look. The drawing is rendered to a canvas
 * from land brush strokes (turned into a ragged, ripple-lined coast), lines, library pieces and
 * curved labels, then saved as the map's picture, so pins, fog and the player view work as usual.
 */
import { Atlas, type InkStyle, type Point, type Rng, type Tint } from './atlas'
import { hashId, loopArea, makeNoise, roughen, scaleOf, smoothLine, traceLoops } from './geometry'
import { buildGround, drawGround, groundColour, type GroundMap } from './ground'
import { LAYERS, layerOf, type Drawing, type GroundId, type LayerId, type LabelFont, type Look, type Shape, type StampKind, type Terrain } from '../mapDrawing'

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

function landShape(d: Drawing, W: number, H: number): LandShape {
  const ms = Math.min(1, 1000 / Math.max(W, H))
  const { mw, mh, data } = paintMask(d, W, H, ms)
  const k = scaleOf(W, H)
  const noise = makeNoise(d.seed ?? 1)
  const minArea = (6 * k) ** 2
  // padded well past the coast's wiggle, so land running off the map edge closes out of sight
  const loops = traceLoops(data, mw, mh, ms, Math.ceil(24 * k * ms) + 2)
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

const mixHex = (a: string, b: string, t: number) => {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/** The line moved sideways by d (positive is to the right of the direction it was drawn in). */
function offsetLine(pts: Point[], d: number): Point[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [p[0] - ((b[1] - a[1]) / l) * d, p[1] + ((b[0] - a[0]) / l) * d]
  })
}

/** Evenly spaced points along a line, each with the direction of the line there. */
function along(pts: Point[], step: number): { x: number; y: number; ang: number }[] {
  const out: { x: number; y: number; ang: number }[] = []
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const d = Math.hypot(x1 - x0, y1 - y0)
    const ang = Math.atan2(y1 - y0, x1 - x0)
    let t = carry
    for (; t < d; t += step) out.push({ x: x0 + ((x1 - x0) * t) / d, y: y0 + ((y1 - y0) * t) / d, ang })
    carry = t - d
  }
  return out
}

const stroke = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.stroke()
}

/** Battle-map lines, seen from above. `u` is the size of a 5 ft square over 70 px. */
function drawBattleLine(ctx: CanvasRenderingContext2D, s: Extract<Shape, { kind: 'line' }>, pts: Point[], st: InkStyle, r: Rng, u: number) {
  const colour = st.mode === 'colour'
  const shadow = st.shadows ? (colour ? 'rgba(40,30,15,.25)' : 'rgba(35,26,16,.16)') : undefined
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (s.style) {
    case 'fence': {
      const wood = colour ? '#7a5634' : st.ink
      if (shadow) {
        ctx.strokeStyle = shadow
        ctx.lineWidth = 6 * u
        stroke(ctx, pts.map(([x, y]) => [x + 4 * u, y + 4 * u] as Point))
      }
      if (colour) {
        ctx.strokeStyle = wood
        ctx.lineWidth = 5 * u
        stroke(ctx, pts)
      }
      for (const off of [-2.6, 2.6]) Atlas.inkStroke(ctx, offsetLine(pts, off * u), r, { w: 1.3 * st.line, wob: 0.35, taper: 0.1, color: st.ink })
      for (const p of along(pts, 60 * u)) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.ang + Atlas.R(r, -0.15, 0.15))
        ctx.fillStyle = colour ? '#8a643e' : st.paper
        ctx.strokeStyle = st.ink
        ctx.lineWidth = 0.9 * st.line
        const h = 4.5 * u
        ctx.fillRect(-h, -h, 2 * h, 2 * h)
        ctx.strokeRect(-h, -h, 2 * h, 2 * h)
        ctx.beginPath()
        ctx.moveTo(-h * 0.4, -h * 0.4)
        ctx.lineTo(h * 0.4, h * 0.4)
        ctx.stroke()
        ctx.restore()
      }
      break
    }
    case 'hedge': {
      const hw = 20 * u
      const leaf = colour ? st.tint.forest : st.paper
      const dark = colour ? st.tint.forestDark : st.ink
      if (shadow) {
        ctx.strokeStyle = shadow
        ctx.lineWidth = 2 * hw
        stroke(ctx, pts.map(([x, y]) => [x + 7 * u, y + 7 * u] as Point))
      }
      // a bumpy outline: overlapping leaf clumps along both edges, inked, then the insides painted over
      const clumps: { x: number; y: number; rad: number }[] = []
      for (const side of [-1, 1])
        for (const p of along(offsetLine(pts, side * hw * 0.5), 10 * u)) clumps.push({ x: p.x + Atlas.R(r, -2, 2) * u, y: p.y + Atlas.R(r, -2, 2) * u, rad: Atlas.R(r, 8, 12) * u })
      ctx.strokeStyle = st.ink
      ctx.lineWidth = 2 * hw * 0.62 + 2 * st.line
      stroke(ctx, pts)
      ctx.fillStyle = st.ink
      for (const c of clumps) {
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.rad + 1.1 * st.line, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = leaf
      ctx.lineWidth = 2 * hw * 0.62
      stroke(ctx, pts)
      ctx.fillStyle = leaf
      for (const c of clumps) {
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.rad, 0, Math.PI * 2)
        ctx.fill()
      }
      // leafy marks inside, heavier on the shaded (lower right) side
      ctx.strokeStyle = dark
      ctx.lineWidth = 0.8 * st.line
      ctx.globalAlpha = colour ? 0.7 : 0.75
      ctx.beginPath()
      for (const c of clumps) {
        const a = Atlas.R(r, 0, Math.PI * 2)
        ctx.moveTo(c.x + Math.cos(a) * c.rad * 0.5, c.y + Math.sin(a) * c.rad * 0.5)
        ctx.arc(c.x, c.y, c.rad * 0.5, a, a + Atlas.R(r, 1, 2))
        if (r() < 0.5) {
          ctx.moveTo(c.x + c.rad * 0.2, c.y + c.rad * 0.65)
          ctx.arc(c.x + c.rad * 0.1, c.y + c.rad * 0.1, c.rad * 0.6, 0.4, 1.6)
        }
      }
      ctx.stroke()
      break
    }
    case 'cliff': {
      // the drop is to the right of the direction the line was drawn: hachures running down the face
      if (colour) {
        ctx.strokeStyle = 'rgba(90,80,64,.35)'
        ctx.lineWidth = 36 * u
        stroke(ctx, offsetLine(pts, 18 * u))
        ctx.strokeStyle = 'rgba(70,60,48,.3)'
        ctx.lineWidth = 12 * u
        stroke(ctx, offsetLine(pts, 7 * u))
      }
      const samples = along(pts, 4 * u)
      samples.forEach((p, i) => {
        const len = (14 + 18 * Math.abs(Math.sin(i * 0.23) * Math.cos(i * 0.07)) + Atlas.R(r, 0, 6)) * u
        const a = p.ang + Math.PI / 2 + Atlas.R(r, -0.12, 0.12)
        Atlas.inkStroke(
          ctx,
          [
            [p.x, p.y],
            [p.x + Math.cos(a) * len, p.y + Math.sin(a) * len],
          ],
          r,
          { w: (i % 3 ? 0.9 : 1.4) * st.line, wob: 0.3, taper: 0.9, color: st.ink },
        )
      })
      Atlas.inkStroke(ctx, pts, r, { w: 3 * st.line, wob: 0.6, taper: 0.1, color: st.ink })
      break
    }
    case 'wall': {
      // a dry-stone wall: two courses of rough stones between inked edges
      const hw = 13 * u
      if (shadow) {
        ctx.strokeStyle = shadow
        ctx.lineWidth = 2 * hw
        stroke(ctx, pts.map(([x, y]) => [x + 6 * u, y + 6 * u] as Point))
      }
      const stoneCol = colour ? groundColour('stone', st.tint) : st.paper
      ctx.strokeStyle = st.ink
      ctx.lineWidth = 2 * hw + 2.4 * st.line
      stroke(ctx, pts)
      ctx.strokeStyle = stoneCol
      ctx.lineWidth = 2 * hw
      stroke(ctx, pts)
      ctx.lineWidth = 0.9 * st.line
      for (const course of [-0.5, 0.5]) {
        let carry = 0
        for (const p of along(offsetLine(pts, course * hw), 2 * u)) {
          carry -= 2 * u
          if (carry > 0) continue
          const len = Atlas.R(r, 14, 24) * u
          carry = len
          const nx = -Math.sin(p.ang)
          const ny = Math.cos(p.ang)
          const tx = Math.cos(p.ang)
          const ty = Math.sin(p.ang)
          const hh = hw * 0.46
          const q: Point[] = [
            [p.x + nx * hh * Atlas.R(r, 0.8, 1) + tx * 1.5 * u, p.y + ny * hh * Atlas.R(r, 0.8, 1) + ty * 1.5 * u],
            [p.x + nx * hh * Atlas.R(r, 0.8, 1) + tx * (len - 1.5 * u), p.y + ny * hh * Atlas.R(r, 0.8, 1) + ty * (len - 1.5 * u)],
            [p.x - nx * hh * Atlas.R(r, 0.8, 1) + tx * (len - 1.5 * u), p.y - ny * hh * Atlas.R(r, 0.8, 1) + ty * (len - 1.5 * u)],
            [p.x - nx * hh * Atlas.R(r, 0.8, 1) + tx * 1.5 * u, p.y - ny * hh * Atlas.R(r, 0.8, 1) + ty * 1.5 * u],
          ]
          Atlas.poly(ctx, q)
          ctx.fillStyle = colour ? mixHex(stoneCol, r() < 0.5 ? '#6f6656' : '#f4ecdc', Atlas.R(r, 0, 0.3)) : st.paper
          ctx.fill()
          ctx.strokeStyle = st.ink
          ctx.globalAlpha = 0.85
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }
      break
    }
    default:
      Atlas.inkStroke(ctx, pts, r, { w: 1.8 * st.line, wob: 0.5, taper: 0.6, color: st.ink })
  }
  ctx.restore()
}

function drawLine(ctx: CanvasRenderingContext2D, s: Extract<Shape, { kind: 'line' }>, st: InkStyle, k: number, battleUnit?: number) {
  const r = Atlas.rng(hashId(s.id))
  const pts = smoothLine(s.points, s.smooth, 6 * k)
  const T = Atlas.terrain
  if (battleUnit && ['fence', 'hedge', 'cliff', 'wall', 'ink'].includes(s.style)) return drawBattleLine(ctx, s, pts, st, r, battleUnit)
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
    default:
      // fences, hedges and cliffs are drawn small on world maps
      drawBattleLine(ctx, s, pts, st, r, 0.5 * st.line)
  }
}

/* ---------------- pieces and labels ---------------- */

/** On battle maps the old symbols that have a top-down piece use it. */
const STAMP_BATTLE: Partial<Record<StampKind, string>> = { tree: 'bm-tree', camp: 'bm-tent', chest: 'bm-chest', ship: 'bm-rowboat', inn: 'bm-house', temple: 'bm-chapel', tower: 'bm-tower', ruins: 'bm-ruin' }

export interface Piece {
  id: string
  asset: string
  at: Point
  size: number
  seed: number
  variant: number
  flip: boolean
  /** Degrees clockwise. Only pieces seen from above (or map furniture) turn; side-on ones stay upright. */
  turn?: number
}

const pieceOf = (s: Shape, battle = false): Piece | undefined =>
  s.kind === 'asset'
    ? { id: s.id, asset: s.asset, at: s.at, size: s.size, seed: s.seed, variant: s.variant, flip: !!s.flip, turn: s.turn }
    : s.kind === 'stamp'
      ? {
          id: s.id,
          asset: (battle && STAMP_BATTLE[s.stamp] && Atlas.assets[STAMP_BATTLE[s.stamp]!] ? STAMP_BATTLE[s.stamp] : undefined) ?? STAMP_ASSET[s.stamp],
          at: s.at,
          size: s.size,
          seed: hashId(s.id),
          variant: hashId(s.id) % 8,
          flip: false,
        }
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

/** Whether a piece can be turned: side-on pieces (mountains, towns) always stand upright. */
export const canTurn = (asset: string) => !!Atlas.assets[asset] && Atlas.assets[asset].view !== 'side'

/** How far a piece is turned, in radians, or 0 when it isn't (or can't be). */
const turnOf = (p: Piece) => (p.turn && canTurn(p.asset) ? ((((p.turn % 360) + 360) % 360) * Math.PI) / 180 : 0)

/** The outline of the area a piece covers, as map points, turned with it. Used for clicking it as a pin. */
export function pieceOutline(p: Piece): Point[] {
  const [x, y, w, h] = pieceBox(p)
  const a = turnOf(p)
  const cx = x + w / 2
  const cy = y + h / 2
  // a little inside the box, so neighbouring linked pieces don't overlap much
  const k = Atlas.assets[p.asset]?.view === 'side' ? 1 : 0.85
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([dx, dy]) => [cx + (dx * Math.cos(a) - dy * Math.sin(a)) * k, cy + (dx * Math.sin(a) + dy * Math.cos(a)) * k] as Point)
}

export function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, st: InkStyle) {
  const def = Atlas.assets[p.asset]
  if (!def) return
  const variant = ((p.variant % 8) + 8) % 8
  const a = turnOf(p)
  if (a) return drawTurned(ctx, p, st, a, variant)
  ctx.save()
  if (p.flip) {
    ctx.translate(p.at[0], 0)
    ctx.scale(-1, 1)
    ctx.translate(-p.at[0], 0)
  }
  try {
    def.draw(ctx, p.at[0], p.at[1], p.size, Atlas.rng(p.seed), st, variant)
  } catch (e) {
    console.warn('Map piece failed to draw', p.asset, e)
  }
  ctx.restore()
}

/**
 * A turned piece. Its own cast shadow would turn with it and fall the wrong way, so the piece is
 * drawn without one on a little canvas of its own, and a shadow of its outline is laid down-right
 * under it, where the light says it belongs.
 */
function drawTurned(ctx: CanvasRenderingContext2D, p: Piece, st: InkStyle, a: number, variant: number) {
  const m = ctx.getTransform()
  const k = Math.hypot(m.a, m.b)
  const px = Math.max(2, Math.ceil(p.size * 1.8 * k))
  const off = document.createElement('canvas')
  off.width = off.height = px
  const o = off.getContext('2d')!
  o.setTransform(k, 0, 0, k, px / 2, px / 2)
  o.rotate(a)
  if (p.flip) o.scale(-1, 1)
  o.lineJoin = 'round'
  o.lineCap = 'round'
  try {
    Atlas.assets[p.asset].draw(o, 0, 0, p.size, Atlas.rng(p.seed), { ...st, shadows: false }, variant)
  } catch (e) {
    console.warn('Map piece failed to draw', p.asset, e)
    return
  }
  const cx = m.a * p.at[0] + m.c * p.at[1] + m.e
  const cy = m.b * p.at[0] + m.d * p.at[1] + m.f
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (st.shadows) {
    const sh = document.createElement('canvas')
    sh.width = sh.height = px
    const c = sh.getContext('2d')!
    c.drawImage(off, 0, 0)
    c.globalCompositeOperation = 'source-in'
    if (st.mode === 'colour') c.fillStyle = 'rgba(40,30,15,.25)'
    else {
      // ink: close diagonal hatching instead of a wash
      const tile = document.createElement('canvas')
      const step = Math.max(3, Math.round(3.2 * st.line * k))
      tile.width = tile.height = step
      const t = tile.getContext('2d')!
      t.strokeStyle = st.ink
      t.globalAlpha = 0.5
      t.lineWidth = Math.max(0.6, 0.55 * st.line * k)
      t.beginPath()
      t.moveTo(-1, step + 1)
      t.lineTo(step + 1, -1)
      t.stroke()
      c.fillStyle = c.createPattern(tile, 'repeat')!
    }
    c.fillRect(0, 0, px, px)
    ctx.drawImage(sh, cx - px / 2 + p.size * 0.06 * k, cy - px / 2 + p.size * 0.08 * k)
  }
  ctx.drawImage(off, cx - px / 2, cy - px / 2)
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

let groundCache: GroundMap | undefined

/** A battle map's ground only changes when its strokes, old area shapes, starting ground or seed change. */
function groundFor(d: Drawing, W: number, H: number): GroundMap {
  const areas = d.shapes.filter((s) => s.kind === 'area').map((s) => `${s.id}:${s.kind === 'area' ? s.terrain + s.points.length + s.points[0] : ''}`)
  const strokes = (d.ground ?? []).map((s) => s.id)
  const key = `${W}x${H}|${d.groundBase}|${d.gridSize}|${d.seed}|${d.hidden?.includes('land') ? 'h' : ''}|${areas.join(',')}|${strokes.join(',')}`
  if (groundCache?.key !== key) groundCache = buildGround(d, W, H, key)
  return groundCache
}

/** Whether a point is on land, so the scatter brush can keep trees ashore and ships at sea. */
export const landTest = (d: Drawing, W: number, H: number): ((x: number, y: number) => boolean) => {
  if (d.scene === 'battle') {
    const gm = groundFor(d, W, H)
    return (x, y) => gm.at(x, y) !== 'water'
  }
  return landFor(d, W, H).isLand
}

/** What a battle map's ground is at a point. */
export const groundAt = (d: Drawing, W: number, H: number): ((x: number, y: number) => GroundId) => groundFor(d, W, H).at

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

  const battle = d.scene === 'battle'
  const u = (d.gridSize || 70) / 70
  // the ground, or sea then land with its coast: the slow part, so it's kept until it or the look changes
  const land = battle ? undefined : landFor(d, W, H)
  if (land) {
    const baseKey = `${land.key}|${look}|${d.biome}|${scale}|${canvas.width}x${canvas.height}`
    if (baseCache?.key !== baseKey) baseCache = { key: baseKey, canvas: drawBase(d, W, H, scale, st, land, landPaper, r) }
  } else {
    const gm = groundFor(d, W, H)
    const baseKey = `${gm.key}|${look}|${d.biome}|${scale}|${canvas.width}x${canvas.height}`
    if (baseCache?.key !== baseKey) baseCache = { key: baseKey, canvas: drawGround(gm, d, W, H, scale, st, r) }
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(baseCache.canvas, 0, 0)
  ctx.restore()

  const visible = (s: Shape) => !hidden.has(layerOf(s))
  // on battle maps old areas became ground, so only rooms keep an outline
  for (const s of d.shapes) if (s.kind === 'area' && visible(s) && (battle ? !s.smooth : marked(s))) drawArea(ctx, s, st, k)

  // lines: rivers under roads and borders
  const lines = d.shapes.filter((s): s is Extract<Shape, { kind: 'line' }> => s.kind === 'line' && visible(s))
  const bu = battle ? u : undefined
  for (const s of lines.filter((s) => s.style === 'river')) drawLine(ctx, s, st, k, bu)
  for (const s of lines.filter((s) => s.style !== 'river')) drawLine(ctx, s, st, k, bu)

  // pieces: on world maps lower ones stand in front; seen from above, the one put down last is on top
  const pieces = d.shapes.filter(visible).map((s) => pieceOf(s, battle)).filter((p): p is Piece => !!p)
  if (!battle) pieces.sort((a, b) => a.at[1] - b.at[1])
  pieces.forEach((p) => drawPiece(ctx, p, stLand))

  // colour washes over the land keep the ink lines
  if (colour && land && land.loops.length) {
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

  if (!hidden.has('labels')) for (const s of d.shapes) if (s.kind === 'label') drawLabel(ctx, s, st, battle && colour ? '#efe6cc' : landPaper, k)

  // battle maps in colour stay clean for the table and virtual tabletops; ink ones get the old paper
  if (!battle || !colour) agePaper(ctx, W, H, look, Atlas.rng((d.seed ?? 1) + 99), battle ? u : k)
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
    const turn = p && turnOf(p) ? ` transform="rotate(${f(p.turn!)} ${f(box![0] + box![2] / 2)} ${f(box![1] + box![3] / 2)})"` : ''
    if (box) out.push(`<rect data-id="${s.id}" class="hit-box" x="${f(box[0])}" y="${f(box[1])}" width="${f(box[2])}" height="${f(box[3])}" fill="transparent"${turn}/>`)
  }
  return out.join('')
}

export { LAYERS }
