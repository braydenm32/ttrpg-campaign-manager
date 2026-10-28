/**
 * The pen box shared by every drawing: a seeded random source, hand-drawn strokes, hatching,
 * stipple and parchment grounds. Everything is warm sepia ink on paper, drawn as a book
 * illustrator would: tapered lines, hatching for tone, no flat colour fills.
 */

export type Ctx = CanvasRenderingContext2D
/** A point; a third element of 1 marks a sharp corner where a spline passes through it. */
export type Pt = [number, number] | [number, number, 1]

export const INK = '#2a1b10'
export const INK_SOFT = '#5a4028'
export const INK_FAINT = '#8a7050'
export const PAPER = '#efe3c8'
export const PAPER_OLD = '#e4d2ac'
export const RULE = '#6b5536'
export const RED_WASH = 'rgba(150, 48, 38, 0.55)'

/** A small, fast, deterministic random source (LCG), so every drawing is the same on every device. */
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = seed >>> 0 || 1
  }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) >>> 0
    return this.s / 4294967296
  }
  /** A number in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1))
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]
  }
  /** A symmetric wobble in [-a, a]. */
  wob(a: number): number {
    return (this.next() - 0.5) * 2 * a
  }
}

/** FNV-1a hash of a string: a stable seed for a page key. */
export function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ---------- paths ----------

/** Closed Catmull-Rom spline through the points; a corner point (third element 1) gets a sharp tip. */
export function splinePath(ctx: Ctx, pts: Pt[]): void {
  const n = pts.length
  const P = (i: number) => pts[(i + n) % n]
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1)
    const p1 = P(i)
    const p2 = P(i + 1)
    const p3 = P(i + 2)
    const t = 1 / 6
    let c1x = p1[0] + (p2[0] - p0[0]) * t
    let c1y = p1[1] + (p2[1] - p0[1]) * t
    let c2x = p2[0] - (p3[0] - p1[0]) * t
    let c2y = p2[1] - (p3[1] - p1[1]) * t
    if (p1[2]) {
      c1x = p1[0]
      c1y = p1[1]
    }
    if (p2[2]) {
      c2x = p2[0]
      c2y = p2[1]
    }
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1])
  }
  ctx.closePath()
}

/** Resamples an open polyline through a Catmull-Rom spline, `k` steps per segment. */
export function openSpline(line: Pt[], k: number): Pt[] {
  const out: Pt[] = []
  const n = line.length
  if (n < 2) return line.slice()
  for (let i = 0; i < n - 1; i++) {
    const p0 = line[Math.max(0, i - 1)]
    const p1 = line[i]
    const p2 = line[i + 1]
    const p3 = line[Math.min(n - 1, i + 2)]
    for (let j = 0; j < k; j++) {
      const t = j / k
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push([line[n - 1][0], line[n - 1][1]])
  return out
}

/** Points along a quadratic curve. */
export function quad(p0: Pt, c: Pt, p1: Pt, k: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= k; i++) {
    const t = i / k
    const u = 1 - t
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]])
  }
  return out
}

/** Points along an arc. */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, k: number, ry = r): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= k; i++) {
    const a = a0 + ((a1 - a0) * i) / k
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * ry])
  }
  return out
}

function jitterPts(pts: Pt[], rng: Rng, amount: number): Pt[] {
  if (!amount) return pts
  return pts.map((p) => (p[2] ? [p[0] + rng.wob(amount), p[1] + rng.wob(amount), 1] : [p[0] + rng.wob(amount), p[1] + rng.wob(amount)]))
}

/** Fills a smooth closed shape through the points, nudged a little so it reads as hand-cut. */
export function shape(ctx: Ctx, pts: Pt[], rng: Rng, jitter = 0.35): void {
  ctx.beginPath()
  splinePath(ctx, jitterPts(pts, rng, jitter))
  ctx.fill()
}

/** Fills a straight-sided polygon. */
export function poly(ctx: Ctx, pts: Pt[], rng: Rng, jitter = 0.35): void {
  const j = jitterPts(pts, rng, jitter)
  ctx.beginPath()
  j.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
  ctx.closePath()
  ctx.fill()
}

/** A slightly irregular filled disc. */
export function disc(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  ctx.beginPath()
  ctx.ellipse(x, y, r, r * (0.96 + rng.next() * 0.08), rng.next() * 3, 0, Math.PI * 2)
  ctx.fill()
}

/** Cuts paper-coloured negative space out of what is already drawn. */
export function cut(ctx: Ctx, fn: () => void): void {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  fn()
  ctx.restore()
}

// ---------- pen strokes ----------

export interface PenOpts {
  /** Width at the start and end; the middle is `w`. Defaults to a tapered nib. */
  w0?: number
  w1?: number
  /** Catmull-Rom smoothing steps per segment (0 for straight segments). */
  smooth?: number
  /** Hand wobble on the control points. */
  jitter?: number
  /** Close the stroke back on itself. */
  closed?: boolean
  /** Width noise along the line, 0..1. */
  noise?: number
}

/**
 * A tapered pen line: a filled ribbon along the path, thin at the ends and full in the middle,
 * with a little noise so no two strokes are alike. Uses the current fillStyle as its ink.
 */
export function pen(ctx: Ctx, line: Pt[], w: number, rng: Rng, o: PenOpts = {}): void {
  if (line.length < 2) return
  const src = jitterPts(line, rng, o.jitter ?? 0.6)
  const pts = o.closed ? closedSpline(src, o.smooth ?? 4) : o.smooth === 0 ? src : openSpline(src, o.smooth ?? 4)
  const n = pts.length
  if (n < 2) return
  const w0 = o.w0 ?? w * 0.15
  const w1 = o.w1 ?? w * 0.15
  const noise = o.noise ?? 0.25
  const left: Pt[] = []
  const right: Pt[] = []
  let wobble = 0
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy) || 1
    const nx = -dy / L
    const ny = dx / L
    wobble = wobble * 0.7 + rng.wob(noise)
    let wi: number
    if (o.closed) wi = w * (1 + wobble * 0.5)
    else {
      const ease = Math.sin(Math.PI * t) ** 0.55
      const ends = w0 * (1 - t) + w1 * t
      wi = ends + (w - ends) * ease + w * wobble * 0.35 * ease
    }
    wi = Math.max(0.15, wi)
    left.push([pts[i][0] + (nx * wi) / 2, pts[i][1] + (ny * wi) / 2])
    right.push([pts[i][0] - (nx * wi) / 2, pts[i][1] - (ny * wi) / 2])
  }
  ctx.beginPath()
  ctx.moveTo(left[0][0], left[0][1])
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1])
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1])
  ctx.closePath()
  ctx.fill()
}

function closedSpline(pts: Pt[], k: number): Pt[] {
  const out: Pt[] = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    for (let j = 0; j < k; j++) {
      const t = j / k
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(out[0])
  return out
}

/** A straight pen line between two points. */
export function penLine(ctx: Ctx, a: Pt, b: Pt, w: number, rng: Rng, o: PenOpts = {}): void {
  const mid: Pt = [(a[0] + b[0]) / 2 + rng.wob(w * 0.4), (a[1] + b[1]) / 2 + rng.wob(w * 0.4)]
  pen(ctx, [a, mid, b], w, rng, { smooth: 4, jitter: 0.3, ...o })
}

/**
 * A hand-drawn circle (or ellipse) outline with a calligraphic nib: the line swells where the pen
 * pulls down and thins where it pushes across, like an engraved medallion rim.
 */
export function penCircle(ctx: Ctx, cx: number, cy: number, r: number, w: number, rng: Rng, o: { ry?: number; wobble?: number; thin?: number; a0?: number; a1?: number } = {}): void {
  const ry = o.ry ?? r
  const wobble = o.wobble ?? r * 0.012
  const thin = o.thin ?? 0.45
  const a0 = o.a0 ?? 0
  const a1 = o.a1 ?? Math.PI * 2
  const full = a1 - a0 >= Math.PI * 2 - 1e-6
  const steps = Math.max(24, Math.round((r + ry) * 0.5))
  const outer: Pt[] = []
  const inner: Pt[] = []
  let drift = 0
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps
    drift = drift * 0.8 + rng.wob(wobble)
    const nib = thin + (1 - thin) * Math.abs(Math.sin(a - 0.6))
    let wi = w * nib
    if (!full) wi *= Math.sin((Math.PI * i) / steps) ** 0.4 + 0.08
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    outer.push([cx + ca * (r + drift + wi / 2), cy + sa * (ry + drift + wi / 2)])
    inner.push([cx + ca * (r + drift - wi / 2), cy + sa * (ry + drift - wi / 2)])
  }
  ctx.beginPath()
  outer.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
  for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1])
  ctx.closePath()
  ctx.fill()
}

/** Outlines a closed shape with a pen line. */
export function penShape(ctx: Ctx, pts: Pt[], w: number, rng: Rng, o: PenOpts = {}): void {
  pen(ctx, pts, w, rng, { closed: true, smooth: 4, ...o })
}

/** Outlines a polygon with straight pen lines, each drawn separately so corners stay crisp. */
export function penPoly(ctx: Ctx, pts: Pt[], w: number, rng: Rng): void {
  for (let i = 0; i < pts.length; i++) penLine(ctx, pts[i], pts[(i + 1) % pts.length], w, rng)
}

// ---------- tone ----------

export interface HatchOpts {
  /** Angle of the lines in radians (0 = horizontal). */
  angle: number
  /** Distance between lines. */
  gap: number
  /** Line width. */
  w?: number
  /** Bounding box of the region (x, y, width, height). */
  box: [number, number, number, number]
  /** Fade the lines towards one side: 'none' | 'start' | 'end' (along the normal). */
  fade?: 'start' | 'end'
  alpha?: number
}

/**
 * Hatches a region: clips to `region` (a function that builds a path) and draws parallel pen
 * lines across it with a touch of wobble, as an engraver would lay tone.
 */
export function hatch(ctx: Ctx, region: () => void, rng: Rng, o: HatchOpts): void {
  const [bx, by, bw, bh] = o.box
  ctx.save()
  ctx.beginPath()
  region()
  ctx.clip()
  const cx = bx + bw / 2
  const cy = by + bh / 2
  const R = Math.hypot(bw, bh) / 2 + o.gap
  const ca = Math.cos(o.angle)
  const sa = Math.sin(o.angle)
  const nx = -sa
  const ny = ca
  const w = o.w ?? 1
  ctx.lineCap = 'round'
  ctx.strokeStyle = ctx.fillStyle
  const baseAlpha = ctx.globalAlpha * (o.alpha ?? 1)
  for (let d = -R; d <= R; d += o.gap) {
    const j = rng.wob(o.gap * 0.18)
    const px = cx + nx * (d + j)
    const py = cy + ny * (d + j)
    const t = (d + R) / (2 * R)
    let a = baseAlpha
    if (o.fade === 'start') a *= Math.min(1, t * 1.6)
    if (o.fade === 'end') a *= Math.min(1, (1 - t) * 1.6)
    if (a <= 0.02) continue
    ctx.globalAlpha = a
    ctx.lineWidth = w * (0.75 + rng.next() * 0.5)
    const bend = rng.wob(o.gap * 0.6)
    ctx.beginPath()
    ctx.moveTo(px - ca * R, py - sa * R)
    ctx.quadraticCurveTo(px + nx * bend, py + ny * bend, px + ca * R, py + sa * R)
    ctx.stroke()
  }
  ctx.restore()
}

/** Two hatch passes at right angles. */
export function crossHatch(ctx: Ctx, region: () => void, rng: Rng, o: HatchOpts): void {
  hatch(ctx, region, rng, o)
  hatch(ctx, region, rng, { ...o, angle: o.angle + Math.PI / 2 })
}

/** Scatters ink dots over a region; `density` is dots per 1000 square units. */
export function stipple(ctx: Ctx, region: () => void, rng: Rng, box: [number, number, number, number], density: number, r = 0.8, falloff?: (x: number, y: number) => number): void {
  const [bx, by, bw, bh] = box
  ctx.save()
  ctx.beginPath()
  region()
  ctx.clip()
  const n = Math.round((bw * bh * density) / 1000)
  for (let i = 0; i < n; i++) {
    const x = bx + rng.next() * bw
    const y = by + rng.next() * bh
    if (falloff && rng.next() > falloff(x, y)) continue
    ctx.beginPath()
    ctx.arc(x, y, r * (0.6 + rng.next() * 0.8), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ---------- paper ----------

/**
 * Lays a parchment ground: a warm paper tone, mottled with age, a few fibres and foxing specks,
 * darker at the edges. Cheap enough to run a hundred times.
 */
export function parchment(ctx: Ctx, w: number, h: number, rng: Rng, o: { tone?: string; age?: number; vignette?: number } = {}): void {
  const age = o.age ?? 0.5
  ctx.save()
  ctx.fillStyle = o.tone ?? PAPER
  ctx.fillRect(0, 0, w, h)
  // mottling: large soft blotches of slightly darker tone
  const blots = Math.round(18 + age * 30)
  for (let i = 0; i < blots; i++) {
    const x = rng.next() * w
    const y = rng.next() * h
    const r = (0.08 + rng.next() * 0.25) * Math.max(w, h)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const a = (0.025 + rng.next() * 0.05) * (0.6 + age)
    g.addColorStop(0, `rgba(120, 85, 40, ${a})`)
    g.addColorStop(1, 'rgba(120, 85, 40, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // fibres
  ctx.strokeStyle = 'rgba(90, 64, 30, 0.10)'
  ctx.lineWidth = 0.7
  const fibres = Math.round((w * h) / 9000)
  ctx.beginPath()
  for (let i = 0; i < fibres; i++) {
    const x = rng.next() * w
    const y = rng.next() * h
    const a = rng.next() * Math.PI
    const L = 3 + rng.next() * 10
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L)
  }
  ctx.stroke()
  // foxing specks
  const specks = Math.round(((w * h) / 4000) * (0.4 + age))
  for (let i = 0; i < specks; i++) {
    const x = rng.next() * w
    const y = rng.next() * h
    ctx.fillStyle = `rgba(100, 70, 30, ${0.05 + rng.next() * 0.12})`
    ctx.beginPath()
    ctx.arc(x, y, 0.4 + rng.next() * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  // vignette
  const v = o.vignette ?? 0.18
  if (v > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2)
    g.addColorStop(0, 'rgba(70, 45, 15, 0)')
    g.addColorStop(1, `rgba(70, 45, 15, ${v})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  ctx.restore()
}

/** A thin double rule around a rectangle, drawn by hand. */
export function ruleBox(ctx: Ctx, x: number, y: number, w: number, h: number, rng: Rng, gapIn = 6): void {
  const r: Pt[] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
  penPoly(ctx, r, 1.6, rng)
  const g = gapIn
  penPoly(
    ctx,
    [
      [x + g, y + g],
      [x + w - g, y + g],
      [x + w - g, y + h - g],
      [x + g, y + h - g],
    ],
    0.8,
    rng,
  )
}

/** Draws into a fresh canvas and returns the PNG. */
export function toPng(canvas: HTMLCanvasElement): Promise<Blob | undefined> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? undefined), 'image/png'))
}

/** Converts a hex colour to rgba with the given alpha. */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
