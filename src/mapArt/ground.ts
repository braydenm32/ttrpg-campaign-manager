/**
 * Battle-map ground for classic-style maps: painted ground (grass, dirt, sand, rocky ground, mud,
 * snow, paving) that blends softly and unevenly where two kinds meet, and water with an inked bank,
 * ripples and darker deep water. Everything is drawn from brush strokes, so it can be repainted.
 */
import { Atlas, type InkStyle, type Point, type Rng, type Tint } from './atlas'
import { loopArea, makeNoise, roughen, traceLoops } from './geometry'
import { drawUnit, type Drawing, type GroundId, type Terrain } from '../mapDrawing'

/** Drawing order of the blended grounds; water is drawn on top with a crisp bank. */
const BLEND: GroundId[] = ['dirt', 'sand', 'grass', 'stone', 'mud', 'snow', 'paving', 'floor', 'boards']
/** Laid floors: crisp edges, and no pen line round them in ink (the joints already say where they stop). */
const LAID: GroundId[] = ['paving', 'floor', 'boards']

/** Areas from a map first drawn in the simple style become the nearest ground. */
const AREA_GROUND: Record<Terrain, GroundId> = {
  land: 'dirt', grass: 'grass', forest: 'grass', mountains: 'stone', hills: 'grass', swamp: 'mud', desert: 'sand', snow: 'snow', water: 'water', floor: 'paving', wood: 'dirt',
}

const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const f = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${f(r1, r2)}${f(g1, g2)}${f(b1, b2)}`
}

/** The watercolour each ground is painted in, for the coloured look. */
export function groundColour(g: GroundId, t: Tint): string {
  switch (g) {
    case 'grass': return t.grass
    case 'dirt': return mix(t.land, '#94744a', 0.5)
    case 'sand': return t.sand
    case 'stone': return mix(t.rock, '#bdb4a2', 0.25)
    case 'mud': return mix(t.land, '#6a5434', 0.5)
    case 'snow': return t.snow
    case 'paving': return mix(t.rock, '#d3cab8', 0.4)
    case 'floor': return mix(t.rock, '#d9d1c0', 0.5)
    case 'boards': return mix(t.sand, t.roof, 0.42)
    case 'water': return t.water
  }
}

/* ---------------- masks ---------------- */

/** Separable box blur, run twice (close to a gaussian). */
export function blur(a: Float32Array, w: number, h: number, r: number): Float32Array {
  r = Math.max(1, Math.round(r))
  let src: Float32Array = a
  let dst: Float32Array = new Float32Array(a.length)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w
      let sum = 0
      for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))]
      for (let x = 0; x < w; x++) {
        dst[row + x] = sum / (2 * r + 1)
        sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]
      }
    }
    ;[src, dst] = [dst, src]
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let y = -r; y <= r; y++) sum += src[Math.min(h - 1, Math.max(0, y)) * w + x]
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = sum / (2 * r + 1)
        sum += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x]
      }
    }
    ;[src, dst] = [dst, src]
  }
  return src
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** A rectangle of mask pixels, [x0, y0, x1, y1) with the far edges left out. */
type MBox = [number, number, number, number]

export interface GroundMap {
  key: string
  ms: number
  mw: number
  mh: number
  /** The ground the map started with; it fills everything nobody painted over. */
  base: GroundId
  /** How much of each blended ground there is at each mask pixel (they add up to 1 on land). */
  weight: Map<GroundId, Float32Array>
  /** The mask pixels each painted ground can reach (the base reaches everywhere). */
  boxes: Map<GroundId, MBox>
  /** Water: a crisp mask, how deep it is, and its traced bank. */
  water?: { mask: Float32Array; deep: Float32Array; loops: Point[][]; path: Path2D; box: MBox; deepAlpha?: HTMLCanvasElement }
  at: (x: number, y: number) => GroundId
  /** Filled in on first draw: each painted ground's share of what's under it, as a canvas alpha. */
  layers?: { g: GroundId; box: MBox; alpha: HTMLCanvasElement }[]
  /** Filled in on first ink draw: where each painted ground stops, as loops. */
  edges?: Map<GroundId, Point[][]>
}

let noiseCache: { key: string; field: Float32Array } | undefined
function noiseField(mw: number, mh: number, ms: number, seed: number, wl: number) {
  const key = `${mw}x${mh}|${ms}|${seed}|${wl}`
  if (noiseCache?.key === key) return noiseCache.field
  const noise = makeNoise(seed)
  const field = new Float32Array(mw * mh)
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) field[y * mw + x] = noise(x / ms / wl, y / ms / wl)
  noiseCache = { key, field }
  return field
}

/** How soft each ground's edge is: blur radius (ft-scaled px), and how wide and uneven the blend is. */
const EDGE = (g: GroundId) => (LAID.includes(g) ? { r: 3, half: 0.12, amp: 0.08 } : { r: 7, half: 0.2, amp: 0.3 })

/**
 * Work out where each ground is. Only the painted grounds get masks, and only around their strokes
 * (the base is whatever's left), so a stroke costs about as much as the area it touches.
 */
export function buildGround(d: Drawing, W: number, H: number, key: string, rooms?: Path2D): GroundMap {
  const u = drawUnit(d)
  const ms = Math.min(0.5, 900 / Math.max(W, H))
  const mw = Math.max(2, Math.ceil(W * ms))
  const mh = Math.max(2, Math.ceil(H * ms))
  const n = mw * mh
  const base = d.groundBase ?? 'grass'
  const clip = (b: MBox): MBox => [Math.max(0, b[0]), Math.max(0, b[1]), Math.min(mw, b[2]), Math.min(mh, b[3])]
  const grow = (b: MBox, m: number): MBox => clip([b[0] - m, b[1] - m, b[2] + m, b[3] + m])
  const cans = new Map<GroundId, CanvasRenderingContext2D>()
  const reach = new Map<GroundId, MBox>()
  const get = (g: GroundId) => {
    let c = cans.get(g)
    if (!c) {
      const el = document.createElement('canvas')
      el.width = mw
      el.height = mh
      c = el.getContext('2d', { willReadFrequently: true })!
      c.scale(ms, ms)
      c.lineCap = 'round'
      c.lineJoin = 'round'
      c.fillStyle = c.strokeStyle = '#000'
      cans.set(g, c)
    }
    return c
  }
  // each stroke claims its pixels for one ground and takes them from all the others; painting the
  // base ground just rubs the others out
  const paint = (g: GroundId, pts: Point[], pad: number, draw: (c: CanvasRenderingContext2D) => void) => {
    for (const [h, c] of cans)
      if (h !== g) {
        c.globalCompositeOperation = 'destination-out'
        draw(c)
      }
    if (g === base) return
    const c = get(g)
    c.globalCompositeOperation = 'source-over'
    draw(c)
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const b = clip([Math.floor((Math.min(...xs) - pad) * ms) - 1, Math.floor((Math.min(...ys) - pad) * ms) - 1, Math.ceil((Math.max(...xs) + pad) * ms) + 1, Math.ceil((Math.max(...ys) + pad) * ms) + 1])
    const was = reach.get(g)
    reach.set(g, was ? [Math.min(was[0], b[0]), Math.min(was[1], b[1]), Math.max(was[2], b[2]), Math.max(was[3], b[3])] : b)
  }
  if (!d.hidden?.includes('land')) {
    for (const s of d.shapes) {
      if (s.kind !== 'area' || !s.points.length) continue
      paint(AREA_GROUND[s.terrain], s.points, 0, (c) => {
        c.beginPath()
        s.points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
        c.closePath()
        c.fill()
      })
    }
    for (const st of d.ground ?? []) {
      if (!st.points.length) continue
      paint(st.ground, st.points, st.size / 2, (c) => {
        // a floor painted "inside the rooms" stops at the walls
        if (st.inside && rooms) {
          c.save()
          c.clip(rooms, 'evenodd')
        }
        c.beginPath()
        if (st.points.length === 1) {
          c.arc(st.points[0][0], st.points[0][1], st.size / 2, 0, Math.PI * 2)
          c.fill()
        } else {
          c.lineWidth = st.size
          st.points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
          c.stroke()
        }
        if (st.inside && rooms) c.restore()
      })
    }
  }
  const raw = new Map<GroundId, Float32Array>()
  for (const [g, c] of cans) {
    const b = reach.get(g)
    if (!b || b[2] <= b[0] || b[3] <= b[1]) continue
    const [x0, y0, x1, y1] = b
    const bw = x1 - x0
    const data = c.getImageData(x0, y0, bw, y1 - y0).data
    const a = new Float32Array(n)
    let any = false
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const v = data[((y - y0) * bw + x - x0) * 4 + 3] / 255
        if (v > 0.01) any = true
        a[y * mw + x] = v
      }
    if (any) raw.set(g, a)
  }
  /** Blur one ground's mask, working only in the part of the map it can reach. */
  const blurred = (g: GroundId, radius: number): [Float32Array, MBox] => {
    const r = Math.max(1, Math.round(radius))
    const box = grow(reach.get(g)!, 2 * r + 2)
    const [x0, y0, x1, y1] = box
    const bw = x1 - x0
    const bh = y1 - y0
    const a = raw.get(g)!
    const sub = new Float32Array(bw * bh)
    for (let y = 0; y < bh; y++) sub.set(a.subarray((y + y0) * mw + x0, (y + y0) * mw + x1), y * bw)
    const b = blur(sub, bw, bh, r)
    const out = new Float32Array(n)
    for (let y = 0; y < bh; y++) out.set(b.subarray(y * bw, (y + 1) * bw), (y + y0) * mw + x0)
    return [out, box]
  }

  // soft, uneven edges: blur each ground, nudge it with noise, sharpen, then share out to 1
  const noise = noiseField(mw, mh, ms, (d.seed ?? 1) + 17, 26 * u)
  const sharpen = (g: GroundId, a: Float32Array, box: MBox, from = (i: number) => a[i]) => {
    const { half, amp } = EDGE(g)
    const shift = BLEND.indexOf(g) * 977
    for (let y = box[1]; y < box[3]; y++)
      for (let i = y * mw + box[0], end = y * mw + box[2]; i < end; i++) a[i] = smoothstep(0.5 - half, 0.5 + half, from(i) + noise[(i + shift) % n] * amp)
  }
  const weight = new Map<GroundId, Float32Array>()
  const boxes = new Map<GroundId, MBox>()
  const soft = new Map<GroundId, Float32Array>()
  for (const g of raw.keys()) {
    const [b, box] = blurred(g, EDGE(g).r * u * ms)
    soft.set(g, b)
    boxes.set(g, box)
  }
  // the base is what's left over once everything painted is taken away
  const all = [...boxes.values()]
  const U: MBox = all.length ? [Math.min(...all.map((b) => b[0])), Math.min(...all.map((b) => b[1])), Math.max(...all.map((b) => b[2])), Math.max(...all.map((b) => b[3]))] : [0, 0, 0, 0]
  const softs = [...soft.values()]
  const baseW = new Float32Array(n).fill(1)
  sharpen(base, baseW, U, (i) => {
    let s = 1
    for (const a of softs) s -= a[i]
    return s
  })
  weight.set(base, baseW)
  for (const g of BLEND)
    if (g !== base && soft.has(g)) {
      const a = new Float32Array(soft.get(g)!)
      sharpen(g, a, boxes.get(g)!)
      weight.set(g, a)
    }
  const blended = [...weight.keys()]
  const ws = blended.map((g) => weight.get(g)!)
  const raws = blended.map((g) => raw.get(g))
  const others = [...raw.values()]
  for (let y = U[1]; y < U[3]; y++)
    for (let i = y * mw + U[0], end = y * mw + U[2]; i < end; i++) {
      let sum = 0
      for (const a of ws) sum += a[i]
      if (sum > 1e-3) {
        for (const a of ws) a[i] /= sum
        continue
      }
      // where everything blurred away (water, or a three-way corner), the strongest ground wins
      let bv = 1
      for (const a of others) bv -= a[i]
      let best = 0
      for (let k = 1; k < ws.length; k++)
        if (raws[k]![i] > bv) {
          bv = raws[k]![i]
          best = k
        }
      ws[best][i] = 1
    }

  let water: GroundMap['water']
  if (raw.has('water')) {
    const [wb, box] = blurred('water', 2 * u * ms)
    const mask = new Float32Array(n)
    for (let y = box[1]; y < box[3]; y++)
      for (let i = y * mw + box[0], end = y * mw + box[2]; i < end; i++) mask[i] = smoothstep(0.42, 0.58, wb[i] + noise[i] * 0.1)
    const [deep] = blurred('water', 32 * u * ms)
    for (let i = 0; i < n; i++) deep[i] = smoothstep(0.62, 0.95, deep[i]) * mask[i]
    const rgba = new Uint8ClampedArray(n * 4)
    for (let i = 0; i < n; i++) rgba[i * 4 + 3] = mask[i] * 255
    const bank = makeNoise((d.seed ?? 1) + 5)
    const loops = traceLoops(rgba, mw, mh, ms, Math.ceil(16 * u * ms) + 2)
      .filter((l) => loopArea(l) > (8 * u) ** 2)
      .map((l) => roughen(l, u, bank, { amp: 1.6, wavelength: 16 }))
      .filter((l) => l.length > 5)
    const path = new Path2D()
    for (const l of loops) {
      l.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
      path.closePath()
    }
    water = { mask, deep, loops, path, box }
  }

  const at = (x: number, y: number): GroundId => {
    const mx = Math.min(mw - 1, Math.max(0, Math.floor(x * ms)))
    const my = Math.min(mh - 1, Math.max(0, Math.floor(y * ms)))
    const i = my * mw + mx
    if (water && water.mask[i] > 0.5) return 'water'
    let best: GroundId = base
    let bv = -1
    for (const [g, a] of weight)
      if (a[i] > bv) {
        bv = a[i]
        best = g
      }
    return best
  }
  return { key, ms, mw, mh, base, weight, boxes, water, at }
}

/** A box-sized canvas whose alpha is the given values, to cut a texture down with destination-in. */
function alphaCanvas(a: Float32Array, mw: number, box: MBox) {
  const [x0, y0, x1, y1] = box
  const c = document.createElement('canvas')
  c.width = Math.max(1, x1 - x0)
  c.height = Math.max(1, y1 - y0)
  const img = new ImageData(c.width, c.height)
  for (let y = y0; y < y1; y++) for (let x = x0, k = (y - y0) * c.width * 4 + 3; x < x1; x++, k += 4) img.data[k] = a[y * mw + x] * 255
  c.getContext('2d')!.putImageData(img, 0, 0)
  return c
}

/**
 * The painted grounds in drawing order, each with the share of what's already under it that it
 * covers. Painting them one over another like that leaves every ground at exactly its weight.
 */
function layersOf(gm: GroundMap) {
  if (gm.layers) return gm.layers
  const { mw, base } = gm
  const cum = new Float32Array(gm.weight.get(base)!)
  gm.layers = []
  for (const g of BLEND) {
    const w = gm.weight.get(g)
    const box = gm.boxes.get(g)
    if (g === base || !w || !box) continue
    const share = new Float32Array(w.length)
    for (let y = box[1]; y < box[3]; y++)
      for (let i = y * mw + box[0], end = y * mw + box[2]; i < end; i++) {
        cum[i] += w[i]
        share[i] = cum[i] > 1e-4 ? w[i] / cum[i] : 0
      }
    gm.layers.push({ g, box, alpha: alphaCanvas(share, mw, box) })
  }
  return gm.layers
}

/* ---------------- textures ---------------- */

/** Uneven watercolour: the wash is a little darker in some places and lighter in others, drifting slowly. */
export function mottle(ctx: CanvasRenderingContext2D, box: Box, fill: string, u: number, seed: number) {
  const [x0, y0, x1, y1] = box
  const cell = 14 * u
  const w = Math.max(2, Math.ceil((x1 - x0) / cell) + 1)
  const h = Math.max(2, Math.ceil((y1 - y0) / cell) + 1)
  const n = makeNoise(seed)
  const [fr, fg, fb] = hex(fill)
  const img = new ImageData(w, h)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = x0 + i * cell
      const y = y0 + j * cell
      const v = n(x / (150 * u), y / (150 * u)) * 0.75 + n(x / (40 * u) + 9, y / (40 * u) + 9) * 0.25
      const t = Math.min(1, Math.abs(v) * 0.26)
      const [tr, tg, tb] = v < 0 ? [58, 46, 26] : [255, 246, 220]
      const k = (j * w + i) * 4
      img.data[k] = fr + (tr - fr) * t
      img.data[k + 1] = fg + (tg - fg) * t
      img.data[k + 2] = fb + (tb - fb) * t
      img.data[k + 3] = 255
    }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.putImageData(img, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(c, x0, y0, w * cell, h * cell)
  ctx.restore()
}

type Box = [number, number, number, number]
const { R } = Atlas

function tick(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number) {
  ctx.moveTo(x, y)
  ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
}

/**
 * Paint one kind of ground over the box: a wash of colour with soft mottling (coloured look), then
 * the pen marks that say what it is. `keep(x, y)` thins the marks out towards the edges.
 */
function texture(ctx: CanvasRenderingContext2D, g: GroundId, box: Box, st: InkStyle, r: Rng, u: number, keep: (x: number, y: number) => boolean) {
  const [x0, y0, x1, y1] = box
  const area = (x1 - x0) * (y1 - y0)
  const colour = st.mode === 'colour'
  const fill = colour ? groundColour(g, st.tint) : st.paper
  const lw = 0.75 * st.line
  ctx.save()
  ctx.fillStyle = fill
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
  if (colour) mottle(ctx, box, fill, u, BLEND.indexOf(g) + 3)
  const pen = colour ? mix(fill, '#24180c', g === 'snow' ? 0.35 : 0.6) : st.ink
  const markAlpha = colour ? 0.55 : 0.6
  // in ink there's no colour to tell grounds apart, so the marks do it: more of them
  const many = colour ? 1 : 2.2
  const dots = (count: number, size: [number, number], alpha: number, colourOf = pen) => {
    ctx.fillStyle = colourOf
    ctx.globalAlpha = alpha
    for (let i = 0; i < count; i++) {
      const x = R(r, x0, x1)
      const y = R(r, y0, y1)
      if (!keep(x, y)) continue
      ctx.beginPath()
      ctx.arc(x, y, R(r, size[0], size[1]) * u, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  ctx.strokeStyle = pen
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  switch (g) {
    case 'grass': {
      // tufts: a few blades fanning up from one root
      const n = Math.ceil((area / (40 * u) ** 2) * (colour ? 1 : 0.9))
      ctx.globalAlpha = markAlpha
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const x = R(r, x0, x1)
        const y = R(r, y0, y1)
        if (!keep(x, y)) continue
        const blades = 2 + Math.floor(r() * 4)
        const len = R(r, 4, 9) * u
        for (let b = 0; b < blades; b++) tick(ctx, x + R(r, -1.5, 1.5) * u, y, -Math.PI / 2 + R(r, -0.75, 0.75), len * R(r, 0.6, 1.1))
      }
      ctx.stroke()
      dots(Math.ceil(area / (30 * u) ** 2), [0.35, 0.7], colour ? 0.25 : 0.35)
      break
    }
    case 'dirt': {
      dots(Math.ceil((area / (10 * u) ** 2) * many), [0.35, 0.85], colour ? 0.3 : 0.5)
      // pebbles
      const n = Math.ceil((area / (60 * u) ** 2) * many)
      ctx.globalAlpha = markAlpha
      for (let i = 0; i < n; i++) {
        const x = R(r, x0, x1)
        const y = R(r, y0, y1)
        if (!keep(x, y)) continue
        const rad = R(r, 1.2, 3) * u
        ctx.beginPath()
        ctx.ellipse(x, y, rad, rad * R(r, 0.55, 0.9), R(r, 0, 3.14), 0, Math.PI * 2)
        if (colour) {
          ctx.fillStyle = mix(fill, '#fff1d0', 0.35)
          ctx.fill()
        }
        ctx.stroke()
      }
      break
    }
    case 'sand': {
      dots(Math.ceil((area / (7 * u) ** 2) * many), [0.25, 0.55], colour ? 0.25 : 0.45)
      // wind ripples: short shallow arcs
      const n = Math.ceil((area / (80 * u) ** 2) * (colour ? 1 : 1.5))
      ctx.globalAlpha = markAlpha * 0.7
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const x = R(r, x0, x1)
        const y = R(r, y0, y1)
        if (!keep(x, y)) continue
        const len = R(r, 10, 26) * u
        ctx.moveTo(x - len / 2, y)
        ctx.quadraticCurveTo(x, y - R(r, 1.5, 3.5) * u, x + len / 2, y + R(r, -1, 1) * u)
      }
      ctx.stroke()
      break
    }
    case 'stone': {
      dots(Math.ceil((area / (14 * u) ** 2) * many), [0.35, 0.8], colour ? 0.3 : 0.5)
      // cracks that fork, and loose stones with their shaded side hatched
      const n = Math.ceil((area / (75 * u) ** 2) * (colour ? 1 : 1.5))
      ctx.globalAlpha = markAlpha
      for (let i = 0; i < n; i++) {
        let x = R(r, x0, x1)
        let y = R(r, y0, y1)
        if (!keep(x, y)) continue
        let a = R(r, 0, Math.PI * 2)
        ctx.beginPath()
        ctx.moveTo(x, y)
        const steps = 3 + Math.floor(r() * 4)
        for (let s = 0; s < steps; s++) {
          a += R(r, -0.7, 0.7)
          x += Math.cos(a) * R(r, 4, 9) * u
          y += Math.sin(a) * R(r, 4, 9) * u
          ctx.lineTo(x, y)
          if (r() < 0.25) {
            const b = a + R(r, 0.6, 1.2) * (r() < 0.5 ? -1 : 1)
            ctx.lineTo(x + Math.cos(b) * 5 * u, y + Math.sin(b) * 5 * u)
            ctx.moveTo(x, y)
          }
        }
        ctx.stroke()
      }
      const m = Math.ceil((area / (48 * u) ** 2) * (colour ? 1 : 1.5))
      for (let i = 0; i < m; i++) {
        const x = R(r, x0, x1)
        const y = R(r, y0, y1)
        if (!keep(x, y)) continue
        const rad = R(r, 2.5, 7) * u
        const pts: Point[] = []
        const k = 5 + Math.floor(r() * 3)
        for (let j = 0; j < k; j++) {
          const t = (j / k) * Math.PI * 2
          pts.push([x + Math.cos(t) * rad * R(r, 0.7, 1.15), y + Math.sin(t) * rad * R(r, 0.6, 1)])
        }
        ctx.globalAlpha = 1
        Atlas.poly(ctx, pts)
        ctx.fillStyle = colour ? mix(fill, '#fff4dc', 0.3) : st.paper
        ctx.fill()
        ctx.globalAlpha = markAlpha
        ctx.stroke()
        ctx.beginPath()
        for (let h = -rad; h < rad; h += 1.6 * u) tick(ctx, x + h * 0.3 + rad * 0.2, y + rad * 0.15 + h * 0.2, 0.4, rad * 0.5)
        ctx.stroke()
      }
      break
    }
    case 'mud': {
      dots(Math.ceil((area / (8 * u) ** 2) * many * 1.3), [0.4, 1], colour ? 0.35 : 0.6)
      // puddles with a wet sheen, and streaks
      const n = Math.ceil(area / (120 * u) ** 2)
      for (let i = 0; i < n; i++) {
        const x = R(r, x0, x1)
        const y = R(r, y0, y1)
        if (!keep(x, y)) continue
        const rx = R(r, 6, 18) * u
        ctx.beginPath()
        ctx.ellipse(x, y, rx, rx * R(r, 0.35, 0.7), R(r, -0.4, 0.4), 0, Math.PI * 2)
        ctx.globalAlpha = colour ? 0.55 : 1
        ctx.fillStyle = colour ? mix(st.tint.water, fill, 0.45) : st.paper
        ctx.fill()
        ctx.globalAlpha = markAlpha
        ctx.stroke()
        ctx.beginPath()
        tick(ctx, x - rx * 0.4, y - rx * 0.12, 0.1, rx * 0.5)
        ctx.stroke()
      }
      ctx.globalAlpha = markAlpha * 0.6
      ctx.beginPath()
      const m = Math.ceil(area / (55 * u) ** 2)
      for (let i = 0; i < m; i++) {
        const x = R(r, x0, x1)
        const y = R(r, y0, y1)
        if (!keep(x, y)) continue
        tick(ctx, x, y, R(r, -0.3, 0.3), R(r, 5, 12) * u)
      }
      ctx.stroke()
      break
    }
    case 'snow': {
      // drifts: soft blue-grey curves, and very sparse dots
      ctx.strokeStyle = colour ? '#9aa9b4' : st.ink
      const n = Math.ceil(area / (75 * u) ** 2)
      ctx.globalAlpha = colour ? 0.5 : 0.4
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const x = R(r, x0, x1)
        const y = R(r, y0, y1)
        if (!keep(x, y)) continue
        const len = R(r, 12, 30) * u
        ctx.moveTo(x - len / 2, y)
        ctx.bezierCurveTo(x - len / 4, y - 3 * u, x + len / 4, y - 3 * u, x + len / 2, y + R(r, -1, 2) * u)
      }
      ctx.stroke()
      dots(Math.ceil(area / (40 * u) ** 2), [0.3, 0.6], colour ? 0.25 : 0.3, colour ? '#8494a0' : st.ink)
      break
    }
    case 'paving': {
      // flagstones: a jittered lattice shared by neighbours, each stone inset a little from its joints
      const c = 34 * u
      const cols = Math.ceil((x1 - x0) / c) + 2
      const rows = Math.ceil((y1 - y0) / c) + 2
      const gx = Math.floor(x0 / c) - 1
      const gy = Math.floor(y0 / c) - 1
      const jit = (i: number, j: number): Point => {
        const h = Atlas.rng(((i + 7919) * 73856093) ^ ((j + 104729) * 19349663))
        return [(i + R(h, -0.28, 0.28)) * c, (j + R(h, -0.28, 0.28)) * c]
      }
      for (let j = gy; j < gy + rows; j++)
        for (let i = gx; i < gx + cols; i++) {
          const q = [jit(i, j), jit(i + 1, j), jit(i + 1, j + 1), jit(i, j + 1)]
          const cx = (q[0][0] + q[2][0]) / 2
          const cy = (q[0][1] + q[2][1]) / 2
          if (!keep(cx, cy)) continue
          const ins = q.map(([x, y]) => [x + (cx - x) * 0.07, y + (cy - y) * 0.07] as Point)
          ctx.globalAlpha = 1
          Atlas.poly(ctx, ins)
          ctx.fillStyle = colour ? mix(fill, r() < 0.5 ? '#6f6656' : '#f4ecdc', R(r, 0, 0.3)) : st.paper
          ctx.fill()
          ctx.globalAlpha = colour ? 0.7 : 0.85
          ctx.strokeStyle = pen
          ctx.stroke()
          if (r() < (colour ? 0.25 : 0.4)) {
            ctx.globalAlpha = 0.45
            ctx.beginPath()
            for (let h = 0.2; h < 0.8; h += 0.18) tick(ctx, ins[1][0] + (ins[2][0] - ins[1][0]) * h - 2 * u, ins[1][1] + (ins[2][1] - ins[1][1]) * h, Math.PI * 0.85, c * 0.18)
            ctx.stroke()
          }
        }
      break
    }
    case 'floor': {
      // dressed stone worn smooth: a few hairline cracks and specks of grit, mostly bare
      ctx.globalAlpha = colour ? 0.45 : 0.4
      ctx.lineWidth = 0.6 * st.line
      ctx.beginPath()
      for (let i = 0, n = Math.ceil(area / (130 * u) ** 2); i < n; i++) {
        let x = R(r, x0, x1)
        let y = R(r, y0, y1)
        if (!keep(x, y)) continue
        let a = R(r, 0, Math.PI * 2)
        ctx.moveTo(x, y)
        for (let k = 0, m = 2 + Math.floor(r() * 3); k < m; k++) {
          a += R(r, -0.7, 0.7)
          x += Math.cos(a) * R(r, 5, 11) * u
          y += Math.sin(a) * R(r, 5, 11) * u
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      dots(Math.ceil(area / (26 * u) ** 2), [0.25, 0.55], colour ? 0.3 : 0.35)
      break
    }
    case 'boards': {
      // planks running left to right, each its own shade, with staggered butt joints, grain and nails
      const pw = 14 * u
      const gy = Math.floor(y0 / pw) - 1
      for (let j = gy; j * pw < y1 + pw; j++) {
        const h = Atlas.rng((j + 7919) * 2654435761)
        const top = j * pw
        let x = x0 - R(h, 0, 140) * u
        while (x < x1) {
          const len = R(h, 90, 190) * u
          if (keep(Math.max(x0, Math.min(x1, x + len / 2)), top + pw / 2) || keep(x + 4 * u, top + pw / 2)) {
            if (colour) {
              ctx.globalAlpha = 1
              ctx.fillStyle = mix(fill, h() < 0.5 ? '#5a3e22' : '#f0ddb8', R(h, 0, 0.22))
              ctx.fillRect(x, top, len, pw)
            }
            ctx.globalAlpha = colour ? 0.65 : 0.8
            ctx.beginPath()
            ctx.moveTo(x, top)
            ctx.lineTo(x + len, top)
            ctx.moveTo(x, top)
            ctx.lineTo(x, top + pw)
            ctx.stroke()
            ctx.globalAlpha = colour ? 0.3 : 0.35
            ctx.beginPath()
            for (let g = 0; g < 2; g++) {
              const gy2 = top + R(h, 0.25, 0.75) * pw
              const a = x + R(h, 4, len * 0.3)
              ctx.moveTo(a, gy2)
              ctx.lineTo(a + R(h, len * 0.3, len * 0.6), gy2 + R(h, -0.6, 0.6) * u)
            }
            ctx.stroke()
            ctx.globalAlpha = colour ? 0.55 : 0.6
            ctx.fillStyle = pen
            ctx.beginPath()
            for (const nx of [x + 3 * u, x + len - 3 * u])
              for (const ny of [top + pw * 0.3, top + pw * 0.7]) {
                ctx.moveTo(nx + 0.6 * u, ny)
                ctx.arc(nx, ny, 0.6 * u, 0, Math.PI * 2)
              }
            ctx.fill()
          }
          x += len
        }
      }
      break
    }
    case 'water':
      break
  }
  ctx.restore()
}

/** Where each painted ground gives way to what's around it, for the pen line drawn there in ink. */
function edgesOf(gm: GroundMap, g: GroundId, u: number): Point[][] {
  gm.edges ??= new Map()
  let loops = gm.edges.get(g)
  if (loops) return loops
  const w = gm.weight.get(g)!
  const rgba = new Uint8ClampedArray(w.length * 4)
  for (let i = 0; i < w.length; i++) rgba[i * 4 + 3] = w[i] * 255
  const wobble = makeNoise(BLEND.indexOf(g) + 61)
  loops = traceLoops(rgba, gm.mw, gm.mh, gm.ms, 3)
    .filter((l) => loopArea(l) > (12 * u) ** 2)
    .map((l) => roughen(l, u, wobble, { amp: 1.2, wavelength: 22 }))
  gm.edges.set(g, loops)
  return loops
}

/** A light, broken pen line around a loop: runs of line with gaps, each run tapering at its ends. */
function brokenEdge(ctx: CanvasRenderingContext2D, loop: Point[], r: Rng, st: InkStyle, u: number) {
  const pts = [...loop, loop[0]]
  let run: Point[] = []
  let on = r() < 0.75
  let left = (on ? R(r, 30, 90) : R(r, 8, 26)) * u
  const flush = () => {
    if (on && run.length > 1) Atlas.inkStroke(ctx, run, r, { w: 0.85 * st.line, wob: 0.35, taper: 0.45, color: st.ink })
    run = []
  }
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1]
    const [bx, by] = pts[i]
    let len = Math.hypot(bx - ax, by - ay)
    if (on && !run.length) run.push([ax, ay])
    while (len > left) {
      const t = left / len
      ax += (bx - ax) * t
      ay += (by - ay) * t
      len -= left
      if (on) run.push([ax, ay])
      flush()
      on = !on
      left = (on ? R(r, 30, 90) : R(r, 8, 26)) * u
      if (on) run.push([ax, ay])
    }
    left -= len
    if (on) run.push([bx, by])
  }
  flush()
}

let sheetCache: HTMLCanvasElement | undefined

/**
 * The whole ground of a battle map at `scale`: the base ground everywhere, each painted ground over
 * it, then water on top, then the banks. Returns a full-size canvas.
 */
export function drawGround(gm: GroundMap, d: Drawing, W: number, H: number, scale: number, st: InkStyle, r: Rng): HTMLCanvasElement {
  const u = drawUnit(d)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(W * scale))
  out.height = Math.max(1, Math.round(H * scale))
  const ctx = out.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (sheetCache?.width !== out.width || sheetCache.height !== out.height) {
    sheetCache = document.createElement('canvas')
    sheetCache.width = out.width
    sheetCache.height = out.height
  }
  const sheet = sheetCache
  const sc = sheet.getContext('2d')!
  const { mw, mh, ms } = gm
  const sample = (a: Float32Array) => (x: number, y: number) => {
    const mx = Math.min(mw - 1, Math.max(0, Math.floor(x * ms)))
    const my = Math.min(mh - 1, Math.max(0, Math.floor(y * ms)))
    return a[my * mw + mx]
  }
  const seed = (d.seed ?? 1) * 31
  // a box of mask pixels on the full canvas, in whole device pixels
  const device = (b: MBox) => {
    const k = scale / ms
    const x0 = Math.max(0, Math.floor(b[0] * k))
    const y0 = Math.max(0, Math.floor(b[1] * k))
    return [x0, y0, Math.min(out.width, Math.ceil(b[2] * k)) - x0, Math.min(out.height, Math.ceil(b[3] * k)) - y0] as const
  }
  /** Draw on the sheet inside the box only, cut it down by `alpha`, and lay it over the map. */
  const overlay = (box: MBox, alpha: HTMLCanvasElement, paint: () => void) => {
    const [dx, dy, dw, dh] = device(box)
    if (dw <= 0 || dh <= 0) return
    sc.save()
    sc.beginPath()
    sc.rect(dx, dy, dw, dh)
    sc.clip()
    sc.clearRect(dx, dy, dw, dh)
    sc.setTransform(scale, 0, 0, scale, 0, 0)
    sc.lineJoin = 'round'
    sc.lineCap = 'round'
    paint()
    sc.setTransform(1, 0, 0, 1, 0, 0)
    sc.globalCompositeOperation = 'destination-in'
    sc.imageSmoothingEnabled = true
    sc.drawImage(alpha, (box[0] * scale) / ms, (box[1] * scale) / ms, ((box[2] - box[0]) * scale) / ms, ((box[3] - box[1]) * scale) / ms)
    sc.restore()
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(sheet, dx, dy, dw, dh, dx, dy, dw, dh)
    ctx.restore()
  }
  const worldBox = (b: MBox, pad: number): Box => [b[0] / ms - pad, b[1] / ms - pad, b[2] / ms + pad, b[3] / ms + pad]

  const baseAt = sample(gm.weight.get(gm.base)!)
  texture(ctx, gm.base, [0, 0, W, H], st, Atlas.rng(seed + BLEND.indexOf(gm.base)), u, (x, y) => baseAt(x, y) > r() * 0.9)
  for (const L of layersOf(gm)) {
    const weightAt = sample(gm.weight.get(L.g)!)
    overlay(L.box, L.alpha, () => texture(sc, L.g, worldBox(L.box, 4), st, Atlas.rng(seed + BLEND.indexOf(L.g)), u, (x, y) => weightAt(x, y) > r() * 0.9))
  }

  // in ink there's no colour to show where a painted ground stops, so its edge gets a broken pen line
  if (st.mode !== 'colour') {
    ctx.save()
    ctx.globalAlpha = 0.7
    for (const L of layersOf(gm)) if (!LAID.includes(L.g)) for (const loop of edgesOf(gm, L.g, u)) brokenEdge(ctx, loop, r, st, u)
    ctx.restore()
  }

  const wt = gm.water
  if (wt && wt.loops.length) {
    const colour = st.mode === 'colour'
    ctx.save()
    ctx.clip(wt.path, 'evenodd')
    ctx.fillStyle = colour ? st.tint.water : st.paper
    ctx.fillRect(0, 0, W, H)
    // deep water: darker wash (colour) or close hatching (ink), fading in away from the bank
    wt.deepAlpha ??= alphaCanvas(wt.deep, mw, wt.box)
    const [x0, y0, x1, y1] = worldBox(wt.box, 2)
    overlay(wt.box, wt.deepAlpha, () => {
      if (colour) {
        sc.fillStyle = mix(st.tint.water, '#1f3f4a', 0.5)
        sc.globalAlpha = 0.75
        sc.fillRect(x0, y0, x1 - x0, y1 - y0)
        sc.globalAlpha = 1
        return
      }
      sc.strokeStyle = st.ink
      sc.globalAlpha = 0.55
      sc.lineWidth = 0.7 * st.line
      sc.beginPath()
      for (let y = y0; y < y1; y += 4.5 * u) {
        let x = x0
        while (x < x1) {
          const len = R(r, 14, 40) * u
          sc.moveTo(x, y + R(r, -0.6, 0.6))
          sc.lineTo(Math.min(x1, x + len), y + R(r, -0.6, 0.6))
          x += len + R(r, 3, 9) * u
        }
      }
      sc.stroke()
      sc.globalAlpha = 1
    })
    if (colour) {
      // shallows: a paler rim just inside the bank
      ctx.strokeStyle = mix(st.tint.water, '#f2ead0', 0.45)
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 9 * u
      ctx.stroke(wt.path)
      ctx.globalAlpha = 1
    }
    ctx.restore()
    // ripples, drawn on a canvas just big enough for the water
    const [dx, dy, dw, dh] = device(wt.box)
    if (dw > 0 && dh > 0) {
      const rip = document.createElement('canvas')
      rip.width = dw
      rip.height = dh
      const rc = rip.getContext('2d')!
      rc.setTransform(scale, 0, 0, scale, -dx, -dy)
      Atlas.terrain.ripples(rc, wt.path, W, H, colour ? { ...st, ink: mix(st.tint.water, '#18313a', 0.55) } : st, {
        rings: [4 * u, 8.5 * u, 14 * u],
        keep: 'inside',
        alpha: 1,
        lw: 0.8 * st.line,
      })
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = colour ? 0.5 : 0.45
      ctx.drawImage(rip, dx, dy)
      ctx.restore()
    }
    const isWater = sample(wt.mask)
    let perimeter = 0
    for (const l of wt.loops) for (let i = 0; i < l.length; i++) perimeter += Math.hypot(l[(i + 1) % l.length][0] - l[i][0], l[(i + 1) % l.length][1] - l[i][1])
    Atlas.terrain.coastStipple(ctx, wt.loops, (x, y) => isWater(x, y) < 0.5, r, st, { n: Math.round(perimeter * 0.5), spread: 9 * u, size: 0.6 * st.line })
    // the bank: a damp darker edge on the land side, then the ink line
    ctx.save()
    if (colour) {
      ctx.strokeStyle = 'rgba(60,45,25,.28)'
      ctx.lineWidth = 6 * u
      ctx.stroke(wt.path)
    }
    for (const l of wt.loops) Atlas.inkStroke(ctx, [...l, l[0]], r, { w: 1.7 * st.line, wob: 0.3, taper: 0.15, color: st.ink })
    ctx.restore()
  }
  return out
}
