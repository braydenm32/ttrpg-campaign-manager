/**
 * Classic-style drawn maps: the hand-inked fantasy map look. The drawing is rendered to a canvas
 * from land brush strokes (turned into a ragged, ripple-lined coast), lines, library pieces and
 * curved labels, then saved as the map's picture, so pins, fog and the player view work as usual.
 */
import { Atlas, type InkStyle, type Point, type Rng, type Tint } from './atlas'
import { hashId, loopArea, makeNoise, roughen, scaleOf, smoothLine, traceLoops } from './geometry'
import { buildGround, drawGround, freeGroundSheet, groundColour, type GroundMap } from './ground'
import { buildRooms, doorGaps, drawRock, type RoomMap } from './rooms'
import { drawUnit, fromAbove, gmOnly, LAYERS, layerOf, type Drawing, type GroundId, type LayerId, type LabelFont, type Look, type Shape, type StampKind, type Terrain } from '../mapDrawing'

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
    case 'dwall':
      // an inner wall drawn like the walls round rooms
      ctx.strokeStyle = st.ink
      ctx.lineWidth = Math.max(3, 8.4 * u)
      stroke(ctx, Atlas.wobble(pts, r, 0.3 * u, 9 * u))
      break
    default:
      Atlas.inkStroke(ctx, pts, r, { w: 1.8 * st.line, wob: 0.5, taper: 0.6, color: st.ink })
  }
  ctx.restore()
}

/**
 * The walls round a battle map's rooms. Underground they're a heavy pen line, with the room's floor a
 * little shadowed along them (colour); above ground they're stone walls. Doors leave gaps in them.
 */
function drawRoomWalls(ctx: CanvasRenderingContext2D, rm: RoomMap, d: Drawing, W: number, H: number, st: InkStyle, rock: boolean) {
  const g = d.gridSize || 70
  const u = g / 70
  const r = Atlas.rng((d.seed ?? 1) * 17 + 5)
  const loop = (l: Point[]): Point[] => [...l, l[0]]
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (rock && st.mode === 'colour' && st.shadows) {
    ctx.save()
    ctx.clip(rm.path, 'evenodd')
    ctx.translate(0.05 * g, 0.07 * g)
    ctx.strokeStyle = 'rgb(40,30,15)'
    for (const [w, a] of [[0.55, 0.06], [0.36, 0.07], [0.2, 0.09]]) {
      ctx.globalAlpha = a
      ctx.lineWidth = w * g
      for (const l of rm.walls) stroke(ctx, loop(l))
    }
    ctx.restore()
  }
  const gaps = doorGaps(d, W, H, rock ? 0.2 * g : 30 * u)
  if (gaps) ctx.clip(gaps, 'evenodd')
  if (rock) {
    ctx.strokeStyle = st.ink
    ctx.lineWidth = Math.max(3, 8.4 * u)
    for (const l of rm.walls) stroke(ctx, Atlas.wobble(loop(l), r, 0.3 * u, 9 * u))
  } else {
    const wall = { id: 'room', kind: 'line', style: 'wall', points: [], smooth: false } as const
    for (const l of rm.walls) drawBattleLine(ctx, { ...wall, points: [] }, loop(l), st, r, u)
  }
  ctx.restore()
}

type Line = Extract<Shape, { kind: 'line' }>

/** A street is 20 ft wide unless it says otherwise, a river on a town map 50 ft; a town wall is 10 ft thick and its towers 30 ft across. */
export const streetWidth = (s: Line, d: Drawing) => s.width ?? 4 * (d.gridSize || 70)
export const riverWidth = (s: Line, d: Drawing) => s.width ?? 10 * (d.gridSize || 70)
export const townWallHalf = (d: Drawing) => (d.gridSize || 70)
const towerSize = (d: Drawing) => 6 * (d.gridSize || 70)

/**
 * Streets: a band of beaten earth or cobbles between inked edges. All the edges go down before any
 * of the surfaces, so where streets meet or cross they open into one another.
 */
function drawStreets(ctx: CanvasRenderingContext2D, lines: Line[], d: Drawing, st: InkStyle, k: number) {
  if (!lines.length) return
  const colour = st.mode === 'colour'
  const ways = lines.map((s) => {
    const r = Atlas.rng(hashId(s.id))
    const w = streetWidth(s, d)
    return { r, w, pts: Atlas.wobble(smoothLine(s.points, s.smooth, 6 * k), r, Math.min(1.2, w * 0.03), Math.max(6, w * 0.6)) }
  })
  const surface = colour ? mixHex(groundColour('dirt', st.tint), groundColour('paving', st.tint), 0.45) : st.paper
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = st.ink
  for (const w of ways) {
    ctx.lineWidth = w.w + 2.4 * st.line
    stroke(ctx, w.pts)
  }
  ctx.strokeStyle = surface
  for (const w of ways) {
    ctx.lineWidth = w.w
    stroke(ctx, w.pts)
  }
  // worn into the middle in colour; a light stipple of cobbles in both looks
  if (colour) {
    ctx.strokeStyle = mixHex(surface, '#f4ead2', 0.25)
    ctx.globalAlpha = 0.5
    for (const w of ways) {
      ctx.lineWidth = w.w * 0.45
      stroke(ctx, w.pts)
    }
    ctx.globalAlpha = 1
  }
  ctx.fillStyle = colour ? mixHex(surface, '#3a2c1c', 0.45) : st.ink
  for (const w of ways) {
    ctx.globalAlpha = colour ? 0.35 : 0.4
    const dot = Math.max(0.5, 0.45 * st.line)
    for (const p of along(w.pts, Math.max(2, 9 / Math.max(1, w.w / 12)))) {
      const off = (w.r() - 0.5) * w.w * 0.8
      ctx.beginPath()
      ctx.arc(p.x - Math.sin(p.ang) * off, p.y + Math.cos(p.ang) * off, dot * (0.6 + w.r() * 0.6), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * Rivers on a town map: a band of water at its true width between inked banks, with a darker
 * channel down the middle in colour and broken ripple lines in both looks. Streets drawn over one
 * read as bridges.
 */
function drawTownRivers(ctx: CanvasRenderingContext2D, lines: Line[], d: Drawing, st: InkStyle, k: number, land?: Path2D) {
  if (!lines.length) return
  const colour = st.mode === 'colour'
  const water = colour ? groundColour('water', st.tint) : st.paper
  const ways = lines.map((s) => {
    const r = Atlas.rng(hashId(s.id))
    const w = riverWidth(s, d)
    return { r, w, pts: Atlas.wobble(smoothLine(s.points, s.smooth, 6 * k), r, Math.min(2, w * 0.03), Math.max(10, w * 0.8)) }
  })
  ctx.save()
  // a river ends where it meets the sea
  if (land) ctx.clip(land, 'evenodd')
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = st.ink
  for (const w of ways) {
    ctx.lineWidth = w.w + 2.6 * st.line
    stroke(ctx, w.pts)
  }
  ctx.strokeStyle = water
  for (const w of ways) {
    ctx.lineWidth = w.w
    stroke(ctx, w.pts)
  }
  if (colour) {
    ctx.strokeStyle = mixHex(water, '#1f3f55', 0.35)
    ctx.globalAlpha = 0.35
    for (const w of ways) {
      ctx.lineWidth = w.w * 0.45
      stroke(ctx, w.pts)
    }
    ctx.globalAlpha = 1
  }
  // ripples: broken strokes along the flow, closer together in ink where there's no colour to say water
  ctx.strokeStyle = colour ? mixHex(water, '#1f3f55', 0.6) : st.ink
  ctx.lineWidth = 0.7 * st.line
  for (const w of ways) {
    ctx.globalAlpha = colour ? 0.45 : 0.6
    for (const f of colour ? [-0.3, 0.3] : [-0.34, -0.12, 0.1, 0.32]) {
      ctx.setLineDash([w.w * (colour ? 0.5 : 0.3), w.w * (0.3 + w.r() * 0.3)])
      ctx.lineDashOffset = w.r() * w.w
      stroke(ctx, offsetLine(w.pts, f * w.w))
    }
  }
  ctx.restore()
}

/** Which side of a wall is outside the town: the side away from the ground it closes round. +1 is to the right of the way it was drawn. */
function outsideOf(pts: Point[]): 1 | -1 {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]]
    area += a[0] * b[1] - b[0] * a[1]
  }
  // drawn clockwise on screen (y down), the inside is to the right
  return area > 0 ? -1 : 1
}

/** Something standing up on a bird's-eye town map, drawn back to front: `at` is how far down the map it stands. */
export type Standing = { at: number; draw: () => void }
/** How far down the map a piece stands, for drawing back to front. Towers and gatehouses come just after the wall they sit on. */
const depthOf = (p: Piece) => p.at[1] + (p.asset === 'ct-wall-tower' || p.asset === 'ct-gatehouse' ? p.size * 0.3 : 0)
/** How tall a town wall stands on a bird's-eye map, in map pixels. */
export const townWallHeight = (d: Drawing) => 3.2 * townWallHalf(d)

/**
 * Town walls standing up: the ground shadow now, then each short length of wall (its face towards you, the wall walk on top
 * and the merlons along the outer edge) queued to be drawn in depth order with the houses, so a wall hides what's behind it
 * and is hidden by what's in front.
 */
function birdTownWalls(ctx: CanvasRenderingContext2D, walls: { pts: Point[]; closed: boolean; out: 1 | -1 }[], d: Drawing, st: InkStyle, stone: string, gates: Extract<Shape, { kind: 'asset' }>[], standing: Standing[], towers: { at: Point; r: number }[]) {
  const colour = st.mode === 'colour'
  const hw = townWallHalf(d)
  const Hw = townWallHeight(d)
  const step = 2.5 * hw
  const inGate = (x: number, y: number) =>
    gates.some((g) => {
      const a = ((g.turn ?? 0) * Math.PI) / 180
      const [dx, dy] = [x - g.at[0], y - g.at[1]]
      const lx = dx * Math.cos(a) + dy * Math.sin(a)
      const ly = -dx * Math.sin(a) + dy * Math.cos(a)
      return Math.abs(lx) < g.size * 0.44 && Math.abs(ly) < g.size * 0.3
    })
  const lift = ([x, y]: Point, z: number): Point => [x, y - z]
  const quad = (q: Point[]) => {
    ctx.beginPath()
    q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
  }
  const shadeCol = colour ? mixHex(stone, '#3a3128', 0.35) : st.paper
  const merlon = hw * 0.75
  for (const w of walls) {
    const pts = w.closed ? [...w.pts, w.pts[0]] : w.pts
    // a soft shadow on the ground, thrown to the right like the houses'
    if (st.shadows) {
      ctx.save()
      ctx.lineCap = 'butt'
      ctx.strokeStyle = colour ? 'rgba(40,30,15,.22)' : 'rgba(35,26,16,.14)'
      ctx.lineWidth = 2 * hw
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + Hw * 0.45, y + Hw * 0.14) : ctx.moveTo(x + Hw * 0.45, y + Hw * 0.14)))
      ctx.stroke()
      ctx.restore()
    }
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 0.5) continue
      const n = Math.max(1, Math.ceil(len / step))
      const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
      // to the right of the way the wall runs
      const [nx, ny] = [-uy, ux]
      for (let j = 0; j < n; j++) {
        const p0: Point = [a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]
        const p1: Point = [a[0] + ((b[0] - a[0]) * (j + 1)) / n, a[1] + ((b[1] - a[1]) * (j + 1)) / n]
        const mid: Point = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
        if (inGate(mid[0], mid[1])) continue
        // a hair longer than the step, so lengths meet without a seam
        const e = 0.6
        const q0: Point = [p0[0] - ux * e, p0[1] - uy * e]
        const q1: Point = [p1[0] + ux * e, p1[1] + uy * e]
        const R0: Point = [q0[0] + nx * hw, q0[1] + ny * hw]
        const R1: Point = [q1[0] + nx * hw, q1[1] + ny * hw]
        const L0: Point = [q0[0] - nx * hw, q0[1] - ny * hw]
        const L1: Point = [q1[0] - nx * hw, q1[1] - ny * hw]
        standing.push({
          at: mid[1],
          draw: () => {
            // a length inside a wall tower is hidden by it (the towers are only all known once the walls are laid out)
            if (towers.some((t) => Math.hypot(t.at[0] - mid[0], t.at[1] - mid[1]) < t.r)) return
            ctx.save()
            ctx.lineJoin = 'round'
            // the face that turns towards you (the one whose outward side points down the map)
            const [f0, f1, fn] = ny > 0 ? [R0, R1, [nx, ny]] : [L0, L1, [-nx, -ny]]
            const away = fn[0] * SIDE_LIGHT[0] + fn[1] * SIDE_LIGHT[1]
            quad([f0, f1, lift(f1, Hw), lift(f0, Hw)])
            ctx.fillStyle = away > 0.35 ? shadeCol : stone
            ctx.fill()
            if (!colour || away > 0.35) {
              // coursing, and vertical hatching on the shaded face
              ctx.save()
              ctx.clip()
              ctx.strokeStyle = st.ink
              ctx.lineWidth = 0.5 * st.line
              ctx.globalAlpha = away > 0.35 ? 0.55 : 0.3
              ctx.beginPath()
              const g = away > 0.35 ? 2.2 : 4
              for (let t = 0; t <= len / n + 1; t += g) {
                const x = f0[0] + ux * t
                const y = f0[1] + uy * t
                ctx.moveTo(x, y)
                ctx.lineTo(x, y - Hw)
              }
              ctx.stroke()
              ctx.restore()
            }
            ctx.strokeStyle = st.ink
            ctx.lineWidth = 1.1 * st.line
            ctx.beginPath()
            ctx.moveTo(...f0)
            ctx.lineTo(...f1)
            ctx.stroke()
            // the wall walk on top, the parapet on the outer edge
            const top = [lift(R0, Hw), lift(R1, Hw), lift(L1, Hw), lift(L0, Hw)]
            quad(top)
            ctx.fillStyle = colour ? mixHex(stone, '#ffffff', 0.12) : st.paper
            ctx.fill()
            ctx.lineWidth = 0.9 * st.line
            ctx.beginPath()
            ctx.moveTo(...top[0])
            ctx.lineTo(...top[1])
            ctx.moveTo(...top[3])
            ctx.lineTo(...top[2])
            ctx.stroke()
            const [o0, o1] = w.out > 0 ? [R0, R1] : [L0, L1]
            const segLen = Math.hypot(o1[0] - o0[0], o1[1] - o0[1])
            ctx.fillStyle = colour ? mixHex(stone, '#3a3128', 0.12) : st.paper
            for (let t = merlon * 0.3; t + merlon * 0.55 <= segLen; t += merlon * 1.35) {
              const m0: Point = [o0[0] + ux * t, o0[1] + uy * t]
              const m1: Point = [o0[0] + ux * (t + merlon * 0.75), o0[1] + uy * (t + merlon * 0.75)]
              const block = [lift(m0, Hw), lift(m1, Hw), lift(m1, Hw + merlon), lift(m0, Hw + merlon)]
              quad(block)
              ctx.fill()
              ctx.stroke()
            }
            // the side edges of the face
            ctx.lineWidth = 0.9 * st.line
            ctx.beginPath()
            ctx.moveTo(...f0)
            ctx.lineTo(...lift(f0, Hw))
            ctx.moveTo(...f1)
            ctx.lineTo(...lift(f1, Hw))
            ctx.globalAlpha = 0.5
            ctx.stroke()
            ctx.restore()
          },
        })
      }
    }
  }
}

/**
 * Town walls: a thick band of stone with a crenellated parapet on the outside and a walk along the
 * top, with towers at the corners and along long runs. Gatehouses leave a gap and stand in it.
 */
function drawTownWalls(ctx: CanvasRenderingContext2D, lines: Line[], d: Drawing, W: number, H: number, st: InkStyle, k: number, standing?: Standing[]) {
  if (!lines.length) return
  const colour = st.mode === 'colour'
  const hw = townWallHalf(d)
  const stone = colour ? mixHex(groundColour('stone', st.tint), '#efe7d6', 0.35) : st.paper
  const gaps = doorGaps(d, W, H, 3 * hw, 'gates')
  const gates = d.shapes.filter((s): s is Extract<Shape, { kind: 'asset' }> => s.kind === 'asset' && s.asset === 'ct-gatehouse')
  ctx.save()
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'
  if (gaps) ctx.clip(gaps, 'evenodd')
  const walls = lines.map((s) => {
    let pts = smoothLine(s.points, s.smooth, 6 * k)
    // a wall that comes back to where it started goes all the way round, with no join showing
    const closed = pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < hw * 2
    if (closed) pts = pts.slice(0, -1)
    return { s, pts, closed, out: outsideOf(pts), r: Atlas.rng(hashId(s.id)) }
  })
  const draw = (pts: Point[], closed: boolean) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    if (closed) ctx.closePath()
    ctx.stroke()
  }
  const offset = (pts: Point[], by: number, closed: boolean) => (closed ? offsetLine([pts[pts.length - 1], ...pts, pts[0]], by).slice(1, -1) : offsetLine(pts, by))
  // wall towers the walls give way to in bird's-eye: the ones put down by hand now, the ones along the walls as they're placed
  const towers = d.shapes.flatMap((s) => (s.kind === 'asset' && s.asset === 'ct-wall-tower' ? [{ at: s.at, r: s.size * 0.42 }] : []))
  if (standing) {
    ctx.restore()
    birdTownWalls(ctx, walls, d, st, stone, gates, standing, towers)
  }
  if (standing) {
    // the shadows went down with the walls; only the towers are left
  } else if (st.shadows)
    for (const w of walls) {
      ctx.strokeStyle = colour ? 'rgba(40,30,15,.25)' : 'rgba(35,26,16,.16)'
      ctx.lineWidth = 2 * hw
      draw(w.pts.map(([x, y]) => [x + 0.6 * hw, y + 0.8 * hw] as Point), w.closed)
    }
  for (const w of standing ? [] : walls) {
    ctx.strokeStyle = st.ink
    ctx.lineWidth = 2 * hw + 2.4 * st.line
    draw(w.pts, w.closed)
  }
  for (const w of standing ? [] : walls) {
    ctx.strokeStyle = stone
    ctx.lineWidth = 2 * hw
    draw(w.pts, w.closed)
    // the parapet: merlons along the outer edge, and the inner edge of the wall walk
    ctx.strokeStyle = colour ? mixHex(stone, '#3a3128', 0.55) : st.ink
    ctx.lineWidth = hw * 0.55
    ctx.setLineDash([hw * 0.7, hw * 0.55])
    draw(offset(w.pts, w.out * hw * 0.62, w.closed), w.closed)
    ctx.setLineDash([])
    ctx.strokeStyle = st.ink
    ctx.lineWidth = 0.8 * st.line
    ctx.globalAlpha = 0.7
    draw(offset(w.pts, -w.out * hw * 0.25, w.closed), w.closed)
    ctx.globalAlpha = 1
    // the shaded face: a few hatch strokes along the side away from the light
    if (!colour) {
      ctx.lineWidth = 0.6 * st.line
      ctx.globalAlpha = 0.55
      for (const p of along(w.closed ? [...w.pts, w.pts[0]] : w.pts, Math.max(2.2, 1.6 * st.line))) {
        const facing = -Math.sin(p.ang) * 0.62 + Math.cos(p.ang) * 0.78
        if (Math.abs(facing) < 0.2) continue
        const nx = -Math.sin(p.ang) * Math.sign(facing)
        const ny = Math.cos(p.ang) * Math.sign(facing)
        ctx.beginPath()
        ctx.moveTo(p.x + nx * hw * 0.55, p.y + ny * hw * 0.55)
        ctx.lineTo(p.x + nx * hw * 0.95, p.y + ny * hw * 0.95)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }
  if (!standing) ctx.restore()
  // towers at the corners and every 160 ft or so, turned to the wall, kept clear of the gatehouses
  const size = towerSize(d)
  const spacing = 32 * (d.gridSize || 70)
  for (const w of walls) {
    const variant = w.s.towers ?? 0
    if (variant < 0) continue
    const { closed } = w
    const pts = closed ? [...w.pts, w.pts[0]] : w.pts
    const spots: { at: Point; ang: number }[] = []
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[i - 1] ?? (closed ? pts[pts.length - 2] : undefined)
      const next = pts[i + 1] ?? (closed ? pts[1] : undefined)
      if (closed && i === pts.length - 1) continue
      if (!prev || !next) {
        // the ends of a wall that doesn't close
        const [a, b] = prev ? [prev, pts[i]] : [pts[i], next!]
        spots.push({ at: pts[i], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) })
        continue
      }
      const a0 = Math.atan2(pts[i][1] - prev[1], pts[i][0] - prev[0])
      const a1 = Math.atan2(next[1] - pts[i][1], next[0] - pts[i][0])
      let bend = Math.abs(a1 - a0)
      if (bend > Math.PI) bend = 2 * Math.PI - bend
      if (bend > 0.4) spots.push({ at: pts[i], ang: Math.atan2(Math.sin(a0) + Math.sin(a1), Math.cos(a0) + Math.cos(a1)) })
    }
    // along long straight runs
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.floor(len / spacing)
      for (let j = 1; j <= n; j++) {
        const t = j / (n + 1)
        spots.push({ at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) })
      }
    }
    const placed: Point[] = []
    for (const spot of spots) {
      if (gates.some((g) => Math.hypot(g.at[0] - spot.at[0], g.at[1] - spot.at[1]) < (g.size + size) * 0.55)) continue
      if (placed.some((q) => Math.hypot(q[0] - spot.at[0], q[1] - spot.at[1]) < size * 1.2)) continue
      placed.push(spot.at)
      // the tower's outward side (-y) faces out of the town
      const turn = ((spot.ang + (w.out > 0 ? Math.PI : 0)) * 180) / Math.PI
      const tower: Piece = { id: `${w.s.id}-t${placed.length}`, asset: 'ct-wall-tower', at: spot.at, size, seed: hashId(w.s.id) + placed.length, variant, flip: false, turn: ((turn % 360) + 360) % 360 }
      if (Atlas.assets['ct-wall-tower'] && standing) {
        towers.push({ at: tower.at, r: size * 0.42 })
        standing.push({ at: depthOf(tower), draw: () => drawPiece(ctx, tower, st) })
      }
      else if (Atlas.assets['ct-wall-tower']) drawPiece(ctx, tower, st)
      else {
        ctx.beginPath()
        ctx.arc(spot.at[0], spot.at[1], size * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = stone
        ctx.fill()
        ctx.strokeStyle = st.ink
        ctx.lineWidth = 1.6 * st.line
        ctx.stroke()
      }
    }
  }
}

function drawLine(ctx: CanvasRenderingContext2D, s: Extract<Shape, { kind: 'line' }>, st: InkStyle, k: number, battleUnit?: number) {
  const r = Atlas.rng(hashId(s.id))
  const pts = smoothLine(s.points, s.smooth, 6 * k)
  const T = Atlas.terrain
  if (battleUnit && ['fence', 'hedge', 'cliff', 'wall', 'dwall', 'ink'].includes(s.style)) return drawBattleLine(ctx, s, pts, st, r, battleUnit)
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
  if (Atlas.bird && def.category?.startsWith('bm-trees')) return drawStandingTree(ctx, p, st, variant)
  const a = turnOf(p)
  if (a) return drawTurned(ctx, p, st, a, variant)
  ctx.save()
  if (p.flip) {
    ctx.translate(p.at[0], 0)
    ctx.scale(-1, 1)
    ctx.translate(-p.at[0], 0)
  }
  if (Atlas.bird) birdFrame(0, !!p.flip)
  try {
    def.draw(ctx, p.at[0], p.at[1], p.size, Atlas.rng(p.seed), st, variant)
  } catch (e) {
    console.warn('Map piece failed to draw', p.asset, e)
  }
  ctx.restore()
}

/** Bird's-eye town maps: the light walls are shaded by, from the left and a little behind, in map terms. */
const SIDE_LIGHT: [number, number] = [0.95, 0.3]
/** Tell a town piece which way is up the screen and where the wall light comes from, in its own (turned, mirrored) frame. */
function birdFrame(a: number, flip: boolean) {
  const [c, s] = [Math.cos(a), Math.sin(a)]
  const [lx, ly] = [SIDE_LIGHT[0] * c + SIDE_LIGHT[1] * s, -SIDE_LIGHT[0] * s + SIDE_LIGHT[1] * c]
  Atlas.up = [flip ? s : -s, -c]
  Atlas.sideLight = [flip ? -lx : lx, ly]
}

/** A tree on a bird's-eye town map: its shadow on the ground, a trunk, and the crown seen from above, held up on the trunk. */
function drawStandingTree(ctx: CanvasRenderingContext2D, p: Piece, st: InkStyle, variant: number) {
  const def = Atlas.assets[p.asset]
  const h = p.size * 0.42 * (Atlas.bird ?? 1)
  const [x, y] = p.at
  if (st.shadows) {
    ctx.save()
    ctx.fillStyle = st.mode === 'colour' ? 'rgba(40,30,15,.22)' : 'rgba(35,26,16,.14)'
    ctx.beginPath()
    ctx.ellipse(x + h * 0.55, y + h * 0.12, p.size * 0.42, p.size * 0.24, 0.25, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.save()
  ctx.strokeStyle = st.ink
  ctx.lineCap = 'round'
  ctx.lineWidth = Math.max(1.2, p.size * 0.07)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - h)
  ctx.stroke()
  ctx.translate(x, y - h)
  const a = turnOf(p)
  if (a) ctx.rotate(a)
  if (p.flip) ctx.scale(-1, 1)
  try {
    def.draw(ctx, 0, 0, p.size, Atlas.rng(p.seed), { ...st, shadows: false }, variant)
  } catch (e) {
    console.warn('Map piece failed to draw', p.asset, e)
  }
  ctx.restore()
}

let hatchTile: { key: string; tile: HTMLCanvasElement } | undefined
/** The way shade and cast shadows fall on the map: down and to the right. */
const LIGHT: [number, number] = [0.62, 0.78]

/**
 * A turned piece. Its own cast shadow would turn with it and fall the wrong way, so the piece is
 * drawn without one on a little canvas of its own, and a shadow of its outline is laid down-right
 * under it, where the light says it belongs. Town pieces know how to shade themselves for any
 * light, so they are drawn straight onto the map, turned, with the light turned back the other way.
 */
function drawTurned(ctx: CanvasRenderingContext2D, p: Piece, st: InkStyle, a: number, variant: number) {
  const def = Atlas.assets[p.asset]
  if (def.category?.startsWith('ct-')) {
    const [c, s] = [Math.cos(a), Math.sin(a)]
    const [lx, ly] = [LIGHT[0] * c + LIGHT[1] * s, -LIGHT[0] * s + LIGHT[1] * c]
    ctx.save()
    ctx.translate(p.at[0], p.at[1])
    ctx.rotate(a)
    if (p.flip) ctx.scale(-1, 1)
    Atlas.light = [p.flip ? -lx : lx, ly]
    if (Atlas.bird) birdFrame(a, !!p.flip)
    try {
      def.draw(ctx, 0, 0, p.size, Atlas.rng(p.seed), st, variant)
    } catch (e) {
      console.warn('Map piece failed to draw', p.asset, e)
    } finally {
      Atlas.light = undefined
      ctx.restore()
    }
    return
  }
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
    def.draw(o, 0, 0, p.size, Atlas.rng(p.seed), { ...st, shadows: false }, variant)
  } catch (e) {
    console.warn('Map piece failed to draw', p.asset, e)
    return
  }
  const cx = m.a * p.at[0] + m.c * p.at[1] + m.e
  const cy = m.b * p.at[0] + m.d * p.at[1] + m.f
  const [x0, y0] = [cx - px / 2, cy - px / 2]
  const [dx, dy] = [p.size * 0.06 * k, p.size * 0.08 * k]
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (st.shadows && st.mode === 'colour') {
    // a wash: the canvas's own shadow of the piece's outline
    ctx.shadowColor = 'rgba(40,30,15,.25)'
    ctx.shadowOffsetX = dx
    ctx.shadowOffsetY = dy
  } else if (st.shadows) {
    // ink: close diagonal hatching instead of a wash
    const step = Math.max(3, Math.round(3.2 * st.line * k))
    const lw = Math.max(0.6, 0.55 * st.line * k)
    const key = `${step}|${lw}|${st.ink}`
    if (hatchTile?.key !== key) {
      const tile = document.createElement('canvas')
      tile.width = tile.height = step
      const t = tile.getContext('2d')!
      t.strokeStyle = st.ink
      t.globalAlpha = 0.5
      t.lineWidth = lw
      t.beginPath()
      t.moveTo(-1, step + 1)
      t.lineTo(step + 1, -1)
      t.stroke()
      hatchTile = { key, tile }
    }
    const sh = document.createElement('canvas')
    sh.width = sh.height = px
    const c = sh.getContext('2d')!
    c.drawImage(off, 0, 0)
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = c.createPattern(hatchTile.tile, 'repeat')!
    c.fillRect(0, 0, px, px)
    ctx.drawImage(sh, x0 + dx, y0 + dy)
  }
  ctx.drawImage(off, x0, y0)
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

/**
 * Keeps the last two of something slow to make, by key. A map with secrets is drawn twice in a row,
 * once for the GM and once for the players (without the secret rooms), and each keeps its own.
 */
function keep2<T extends { key: string }>(slots: T[], key: string, make: () => T): T {
  const i = slots.findIndex((x) => x.key === key)
  if (i === 0) return slots[0]
  const hit = i > 0 ? slots.splice(i, 1)[0] : make()
  slots.unshift(hit)
  slots.length = Math.min(slots.length, 2)
  return hit
}

const baseCache: { key: string; canvas: HTMLCanvasElement }[] = []
const roomCache: RoomMap[] = []
const rockCache: { key: string; canvas: HTMLCanvasElement }[] = []

/** A battle map's rooms only change when they're drawn, or the grid or seed change. Underground maps always have them (all rock to start with). */
function roomsFor(d: Drawing, W: number, H: number): RoomMap | undefined {
  if (!d.rooms?.length && d.outside !== 'rock') return undefined
  const key = `${W}x${H}|${d.gridSize}|${d.seed}|${(d.rooms ?? []).map((r) => r.id).join(',')}`
  return keep2(roomCache, key, () => buildRooms(d, W, H, key))
}

/** The walls round a battle map's rooms as drawn (none when the rooms are hidden), for exporting to virtual tabletops. */
export const roomWalls = (d: Drawing, W: number, H: number): Point[][] =>
  d.scene === 'battle' && !d.hidden?.includes('paths') ? (roomsFor(d, W, H)?.walls ?? []) : []

/** Whether a map point is inside the rooms, or undefined when the map has none. */
export const roomTest = (d: Drawing, W: number, H: number): ((x: number, y: number) => boolean) | undefined => {
  const rm = d.scene === 'battle' && d.rooms?.length ? roomsFor(d, W, H) : undefined
  if (!rm) return undefined
  return (x, y) => rm.floor[Math.min(rm.mh - 1, Math.max(0, Math.floor(y * rm.ms))) * rm.mw + Math.min(rm.mw - 1, Math.max(0, Math.floor(x * rm.ms)))] >= 0.5
}
/** Where pieces can stand: underground, only inside the rooms; above ground, anywhere. */
export const floorTest = (d: Drawing, W: number, H: number): ((x: number, y: number) => boolean) => {
  if (d.outside !== 'rock') return () => true
  return roomTest(d, W, H) ?? (() => false)
}
let landCache: (LandShape & { key: string }) | undefined

/** The land only changes when the brush strokes, old area shapes, start or seed change. */
function landFor(d: Drawing, W: number, H: number): LandShape & { key: string } {
  const areas = d.shapes.filter((s) => s.kind === 'area').map((s) => `${s.id}:${s.kind === 'area' ? s.terrain + s.points.length + s.points[0] : ''}`)
  const strokes = (d.land ?? []).map((s) => s.id)
  const key = `${W}x${H}|${d.background}|${d.seed}|${d.hidden?.includes('land') ? 'h' : ''}|${areas.join(',')}|${strokes.join(',')}`
  if (landCache?.key !== key) landCache = { ...landShape(d, W, H), key }
  return landCache
}

const groundCache: GroundMap[] = []

/** A battle map's ground only changes when its strokes, old area shapes, starting ground or seed change. */
function groundFor(d: Drawing, W: number, H: number): GroundMap {
  const areas = d.shapes.filter((s) => s.kind === 'area').map((s) => `${s.id}:${s.kind === 'area' ? s.terrain + s.points.length + s.points[0] : ''}`)
  const strokes = (d.ground ?? []).map((s) => s.id)
  // floors painted inside the rooms change when the rooms do
  const rooms = d.ground?.some((s) => s.inside) ? roomsFor(d, W, H) : undefined
  const key = `${W}x${H}|${d.groundBase}|${d.gridSize}|${d.seed}|${d.hidden?.includes('land') ? 'h' : ''}|${areas.join(',')}|${strokes.join(',')}|${rooms?.key ?? ''}`
  return keep2(groundCache, key, () => buildGround(d, W, H, key, rooms?.path))
}

/** Whether a point is on land, so the scatter brush can keep trees ashore and ships at sea. */
export const landTest = (d: Drawing, W: number, H: number): ((x: number, y: number) => boolean) => {
  if (fromAbove(d)) {
    const gm = groundFor(d, W, H)
    // a town's coast is painted like a world map's
    const coast = d.scene === 'city' ? landFor(d, W, H) : undefined
    return (x, y) => gm.at(x, y) !== 'water' && (!coast || coast.isLand(x, y))
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
 * A town's ground with its coast: the sea and its ripples as on a world map, and the painted ground
 * wherever there's land, with the coast inked over the top.
 */
function drawCityBase(gm: GroundMap, coast: LandShape, d: Drawing, W: number, H: number, scale: number, st: InkStyle, r: Rng) {
  const ground = drawGround(gm, d, W, H, scale, st, r)
  if (!coast.loops.length && d.background !== 'sea') return ground
  const canvas = document.createElement('canvas')
  canvas.width = ground.width
  canvas.height = ground.height
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const k = scaleOf(W, H)
  const colour = st.mode === 'colour'
  const T = Atlas.terrain
  ctx.fillStyle = colour ? st.tint.water : st.paper
  ctx.fillRect(0, 0, W, H)
  if (!coast.loops.length) return canvas
  T.ripples(ctx, coast.path, W, H, st, { rings: [6 * k, 12 * k, 19 * k], alpha: colour ? 0.35 : 0.5, lw: 0.9 * st.line })
  ctx.save()
  ctx.clip(coast.path, 'evenodd')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(ground, 0, 0)
  ctx.restore()
  const coastLen = coast.loops.reduce((n, l) => n + l.length, 0)
  T.coastStipple(ctx, coast.loops, coast.isLand, r, st, { n: Math.round(coastLen * 1.2), spread: 14 * k, size: 0.7 * st.line })
  for (const l of coast.loops) Atlas.inkStroke(ctx, [...l, l[0]], r, { w: 2.2 * st.line, wob: 0.3, taper: 0.15, color: st.ink })
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
  const city = d.scene === 'city'
  // battle maps, dungeons and town plans are seen from above; world maps from the side
  const top = fromAbove(d)
  const u = drawUnit(d)
  // the ground, or sea then land with its coast: the slow part, so it's kept until it or the look changes
  const land = top ? undefined : landFor(d, W, H)
  let shore: Path2D | undefined
  let base: HTMLCanvasElement
  if (land) {
    const baseKey = `${land.key}|${look}|${d.biome}|${scale}|${canvas.width}x${canvas.height}`
    base = keep2(baseCache, baseKey, () => ({ key: baseKey, canvas: drawBase(d, W, H, scale, st, land, landPaper, r) })).canvas
  } else {
    const gm = groundFor(d, W, H)
    const coast = city ? landFor(d, W, H) : undefined
    if (coast?.loops.length) shore = coast.path
    const baseKey = `${gm.key}|${coast?.key ?? ''}|${look}|${d.biome}|${scale}|${canvas.width}x${canvas.height}`
    base = keep2(baseCache, baseKey, () => ({ key: baseKey, canvas: coast ? drawCityBase(gm, coast, d, W, H, scale, st, r) : drawGround(gm, d, W, H, scale, st, r) })).canvas
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(base, 0, 0)
  ctx.restore()

  const visible = (s: Shape) => !hidden.has(layerOf(s))
  // rooms: underground, the rock round them and the grid on their floors, then their walls
  const rooms = battle && !hidden.has('paths') ? roomsFor(d, W, H) : undefined
  const rock = !!rooms && d.outside === 'rock'
  if (rooms && rock) {
    const rockKey = `${rooms.key}|${look}|${d.biome}|${scale}|${canvas.width}x${canvas.height}`
    const rockArt = keep2(rockCache, rockKey, () => ({ key: rockKey, canvas: drawRock(rooms, d, W, H, scale, st) })).canvas
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(rockArt, 0, 0)
    ctx.restore()
    ctx.save()
    ctx.clip(rooms.path, 'evenodd')
    drawGrid(ctx, d, W, H, st)
    ctx.restore()
  }
  if (rooms) drawRoomWalls(ctx, rooms, d, W, H, st, rock)
  // on maps seen from above old areas became ground, so only rooms keep an outline
  for (const s of d.shapes) if (s.kind === 'area' && visible(s) && (top ? !s.smooth : marked(s))) drawArea(ctx, s, st, k)

  // lines: rivers, then streets, then walls, fences, roads and borders, then town walls over them all
  const lines = d.shapes.filter((s): s is Line => s.kind === 'line' && visible(s))
  const bu = top ? u : undefined
  if (city) drawTownRivers(ctx, lines.filter((s) => s.style === 'river'), d, st, k, shore)
  else for (const s of lines.filter((s) => s.style === 'river')) drawLine(ctx, s, st, k, bu)
  drawStreets(ctx, lines.filter((s) => s.style === 'street'), d, st, k)
  // doors leave a gap in walls drawn as lines too
  const gaps = battle ? { dwall: doorGaps(d, W, H, 0.2 * u * 70), wall: doorGaps(d, W, H, 30 * u) } : undefined
  for (const s of lines.filter((s) => s.style !== 'river' && s.style !== 'street' && s.style !== 'townwall')) {
    const gap = s.style === 'dwall' || s.style === 'wall' ? gaps?.[s.style] : undefined
    if (!gap) drawLine(ctx, s, st, k, bu)
    else {
      ctx.save()
      ctx.clip(gap, 'evenodd')
      drawLine(ctx, s, st, k, bu)
      ctx.restore()
    }
  }

  // a bird's-eye town: walls, buildings and trees stand up, so they're drawn back to front
  const bird = city && !!d.birdsEye
  const standing: Standing[] | undefined = bird ? [] : undefined
  drawTownWalls(ctx, lines.filter((s) => s.style === 'townwall'), d, W, H, st, k, standing)

  // pieces: on world maps lower ones stand in front; seen from above, the one put down last is on top
  // (the GM's marks go on last, over everything)
  const all = d.shapes.filter(visible).map((s) => pieceOf(s, top)).filter((p): p is Piece => !!p)
  const marks = all.filter((p) => p.asset.startsWith('gm-'))
  const pieces = all.filter((p) => !p.asset.startsWith('gm-'))
  if (!top) pieces.sort((a, b) => a.at[1] - b.at[1])
  if (standing) {
    for (const p of pieces) standing.push({ at: depthOf(p), draw: () => drawPiece(ctx, p, stLand) })
    standing.sort((a, b) => a.at - b.at)
    Atlas.bird = 1
    Atlas.wallHeight = townWallHeight(d)
    try {
      standing.forEach((s) => s.draw())
    } finally {
      Atlas.bird = Atlas.up = Atlas.sideLight = Atlas.wallHeight = undefined
    }
  } else pieces.forEach((p) => drawPiece(ctx, p, stLand))

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

  if (!rock) drawGrid(ctx, d, W, H, st)

  if (!hidden.has('labels')) for (const s of d.shapes) if (s.kind === 'label') drawLabel(ctx, s, st, top && colour ? '#efe6cc' : landPaper, k)

  // battle maps in colour stay clean for the table and virtual tabletops; ink ones get the old paper
  if (!battle || !colour) agePaper(ctx, W, H, look, Atlas.rng((d.seed ?? 1) + 99), battle ? u : k)
  // what only the GM sees: secret rooms washed red, other GM-only things ringed in red, then the GM's marks
  drawSecretHints(ctx, d, W, H, st, k, battle && !hidden.has('paths') ? rooms : undefined, visible)
  marks.forEach((p) => drawPiece(ctx, p, stLand))
  if (d.frame !== false) drawFrame(ctx, W, H, st, k)
  return canvas
}

/** The red the GM's own marks and hints are in, like the notes in a published adventure. */
export const GM_RED = '#b0242a'

function drawSecretHints(ctx: CanvasRenderingContext2D, d: Drawing, W: number, H: number, st: InkStyle, k: number, rooms: RoomMap | undefined, visible: (s: Shape) => boolean) {
  const secretRooms = rooms && d.rooms?.some(gmOnly)
  const marked = d.shapes.filter((s) => visible(s) && gmOnly(s) && !(s.kind === 'asset' && s.asset.startsWith('gm-')))
  if (!secretRooms && !marked.length) return
  ctx.save()
  if (rooms && secretRooms) {
    // where the floor differs from the players' (rooms and passages only the GM knows about)
    const open = roomsFor({ ...d, rooms: d.rooms!.filter((r) => !gmOnly(r)) }, W, H)
    const diff = new Path2D(rooms.path)
    if (open) diff.addPath(open.path)
    ctx.fillStyle = GM_RED
    ctx.globalAlpha = 0.16
    ctx.fill(diff, 'evenodd')
    ctx.globalAlpha = 1
  }
  const dash = d.scene === 'battle' ? drawUnit(d) * 10 : k * 7
  ctx.strokeStyle = GM_RED
  ctx.lineWidth = Math.max(1.2, 1.6 * st.line)
  ctx.setLineDash([dash, dash * 0.6])
  for (const s of marked) {
    ctx.beginPath()
    if (s.kind === 'asset') {
      const p = pieceOf(s, fromAbove(d))
      if (!p) continue
      Atlas.poly(ctx, pieceOutline(p))
      ctx.closePath()
    } else if (s.kind === 'label') {
      const [x, y, w, h] = labelBox(ctx, s)
      ctx.rect(x - 4 * k, y - 4 * k, w + 8 * k, h + 8 * k)
    } else if (s.kind === 'line') smoothLine(s.points, s.smooth, 6 * k).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Draw a map once at any size, for exporting, without disturbing what the editor keeps between
 * redraws: a copy at twice the size would push the editor's out, and hold on to a huge canvas.
 */
export function renderClassicOnce(d: Drawing, W: number, H: number, scale = 1): HTMLCanvasElement {
  const keep = { base: [...baseCache], rock: [...rockCache] }
  try {
    return renderClassic(d, W, H, scale)
  } finally {
    baseCache.splice(0, baseCache.length, ...keep.base)
    rockCache.splice(0, rockCache.length, ...keep.rock)
    freeGroundSheet()
  }
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
