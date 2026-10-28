/**
 * Faction crests: heraldic shields and banners inked as an engraver would, with hatching standing
 * in for the tinctures (vertical for red, horizontal for blue, diagonals for green and purple,
 * cross-hatching for black, dots for gold, bare paper for silver).
 */
import { INK, PAPER_OLD, Rng, crossHatch, disc, hatch, parchment, pen, penCircle, penLine, penShape, seedOf, shape, stipple, type Ctx, type Pt } from './ink'

type Tincture = 'argent' | 'or' | 'gules' | 'azure' | 'sable' | 'vert' | 'purpure'
type Box = [number, number, number, number]
type Region = () => void

/** Lays a tincture over a region by hatching. */
function tincture(ctx: Ctx, region: Region, box: Box, t: Tincture, rng: Rng): void {
  ctx.fillStyle = INK
  switch (t) {
    case 'gules':
      hatch(ctx, region, rng, { angle: Math.PI / 2, gap: 7, w: 1.1, box })
      break
    case 'azure':
      hatch(ctx, region, rng, { angle: 0, gap: 7, w: 1.1, box })
      break
    case 'sable':
      crossHatch(ctx, region, rng, { angle: 0, gap: 5.5, w: 1.1, box })
      break
    case 'vert':
      hatch(ctx, region, rng, { angle: -Math.PI / 4, gap: 7, w: 1.1, box })
      break
    case 'purpure':
      hatch(ctx, region, rng, { angle: Math.PI / 4, gap: 7, w: 1.1, box })
      break
    case 'or':
      stipple(ctx, region, rng, box, 1.6, 1)
      break
    default:
      break
  }
}

/** The shield used by most crests, drawn with a double pen line; returns the region and box for charges. */
function shield(ctx: Ctx, rng: Rng, cx = 256, top = 86, w = 300, h = 360): { region: Region; box: Box } {
  const L = cx - w / 2
  const R = cx + w / 2
  const sh = top + h * 0.4
  const build = (inset: number) => () => {
    const l = L + inset
    const r = R - inset
    const t = top + inset
    const b = top + h - inset * 1.3
    ctx.moveTo(l, t)
    ctx.lineTo(r, t)
    ctx.lineTo(r, sh)
    ctx.bezierCurveTo(r, sh + h * 0.34, cx + w * 0.22, b - h * 0.1, cx, b)
    ctx.bezierCurveTo(cx - w * 0.22, b - h * 0.1, l, sh + h * 0.34, l, sh)
    ctx.closePath()
  }
  const region = build(0)
  // shadow under the right and lower edge
  ctx.fillStyle = INK
  ctx.save()
  ctx.translate(7, 9)
  hatch(ctx, region, rng, { angle: -Math.PI / 4, gap: 4.5, w: 1, box: [L, top, w, h], alpha: 0.5 })
  ctx.restore()
  ctx.fillStyle = PAPER_OLD
  ctx.beginPath()
  region()
  ctx.fill()
  // outline: a firm outer line and a finer inner one
  ctx.fillStyle = INK
  const outline = (inset: number, wd: number) => {
    const l = L + inset
    const r = R - inset
    const t = top + inset
    const b = top + h - inset * 1.3
    penLine(ctx, [l, t], [r, t], wd, rng)
    penLine(ctx, [r, t], [r, sh], wd, rng)
    pen(ctx, [[r, sh], [r - w * 0.03, sh + h * 0.22], [cx + w * 0.22, b - h * 0.12], [cx, b]], wd, rng, { smooth: 6, w0: wd * 0.9, w1: wd * 0.2 })
    pen(ctx, [[l, sh], [l + w * 0.03, sh + h * 0.22], [cx - w * 0.22, b - h * 0.12], [cx, b]], wd, rng, { smooth: 6, w0: wd * 0.9, w1: wd * 0.2 })
    penLine(ctx, [l, sh], [l, t], wd, rng)
  }
  outline(0, 3.2)
  outline(9, 1.2)
  return { region: build(10), box: [L, top, w, h] }
}

/** A hanging banner (gonfalon) with a swallow-tailed foot. */
function banner(ctx: Ctx, rng: Rng): { region: Region; box: Box } {
  const L = 118
  const R = 394
  const T = 96
  const B = 432
  const build = (inset: number) => () => {
    const l = L + inset
    const r = R - inset
    const t = T + inset
    const b = B - inset
    ctx.moveTo(l, t)
    ctx.lineTo(r, t)
    ctx.lineTo(r + 2, b - 60)
    ctx.lineTo(r - 40, b)
    ctx.lineTo((l + r) / 2, b - 50)
    ctx.lineTo(l + 40, b)
    ctx.lineTo(l - 2, b - 60)
    ctx.closePath()
  }
  const region = build(0)
  ctx.fillStyle = INK
  ctx.save()
  ctx.translate(7, 9)
  hatch(ctx, region, rng, { angle: -Math.PI / 4, gap: 4.5, w: 1, box: [L, T, R - L, B - T], alpha: 0.5 })
  ctx.restore()
  ctx.fillStyle = PAPER_OLD
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  const outline: Pt[] = [[L, T, 1], [R, T, 1], [R + 2, B - 60, 1], [R - 40, B, 1], [256, B - 50, 1], [L + 40, B, 1], [L - 2, B - 60, 1]]
  for (let i = 0; i < outline.length; i++) penLine(ctx, outline[i], outline[(i + 1) % outline.length], 3, rng)
  // the rod and its finials, cords to the top corners
  penLine(ctx, [84, 78], [428, 78], 4, rng)
  disc(ctx, 80, 78, 7, rng)
  disc(ctx, 432, 78, 7, rng)
  penLine(ctx, [L + 24, T], [L + 24, 78], 2, rng)
  penLine(ctx, [R - 24, T], [R - 24, 78], 2, rng)
  penLine(ctx, [256, T], [256, 78], 2, rng)
  return { region: build(8), box: [L, T, R - L, B - T] }
}

/** Shades the right/lower side of a charge with hatching that fades into the light. */
function shade(ctx: Ctx, region: Region, box: Box, rng: Rng, angle = Math.PI / 4, gap = 4): void {
  ctx.fillStyle = INK
  hatch(ctx, region, rng, { angle, gap, w: 0.9, box, fade: 'start' })
}

// ---------- charges ----------

function lanternCharge(ctx: Ctx, rng: Rng): void {
  // the lantern: iron cage, domed cap, ring, a flame
  const cx = 256
  const body: Region = () => {
    ctx.moveTo(cx - 54, 206)
    ctx.lineTo(cx + 54, 206)
    ctx.lineTo(cx + 46, 340)
    ctx.lineTo(cx - 46, 340)
    ctx.closePath()
  }
  ctx.fillStyle = '#f3ead4'
  ctx.beginPath()
  body()
  ctx.fill()
  ctx.fillStyle = INK
  shade(ctx, body, [cx - 54, 206, 108, 134], rng, Math.PI / 2, 5)
  const pts: Pt[] = [[cx - 54, 206, 1], [cx + 54, 206, 1], [cx + 46, 340, 1], [cx - 46, 340, 1]]
  for (let i = 0; i < 4; i++) penLine(ctx, pts[i], pts[(i + 1) % 4], 3, rng)
  for (const dx of [-22, 0, 22]) penLine(ctx, [cx + dx, 206], [cx + dx * 0.85, 340], 2.2, rng)
  // cap and ring
  shape(ctx, [[cx - 62, 206], [cx - 40, 172], [cx, 160], [cx + 40, 172], [cx + 62, 206]], rng)
  penCircle(ctx, cx, 150, 16, 3.5, rng)
  // base
  shape(ctx, [[cx - 54, 340], [cx + 54, 340], [cx + 60, 356], [cx - 60, 356]], rng)
  // the flame, left as paper with a wavy outline and a halo of fine rays
  ctx.fillStyle = '#f7f1e2'
  const flame: Pt[] = [[cx, 232], [cx + 16, 258], [cx + 20, 286], [cx + 10, 310], [cx, 318], [cx - 12, 308], [cx - 20, 284], [cx - 12, 256]]
  ctx.beginPath()
  flame.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = INK
  penShape(ctx, flame, 1.8, rng)
  pen(ctx, [[cx - 4, 300], [cx + 4, 280], [cx - 2, 258]], 1.4, rng)
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (i - 6.5) * 0.24
    const r0 = 54 + rng.range(0, 8)
    const r1 = r0 + 18 + rng.range(0, 18)
    ctx.globalAlpha = 0.6
    penLine(ctx, [cx + Math.cos(a) * r0, 278 + Math.sin(a) * r0], [cx + Math.cos(a) * r1, 278 + Math.sin(a) * r1], 1.1, rng)
    ctx.globalAlpha = 1
  }
}

function throneCharge(ctx: Ctx, rng: Rng): void {
  const cx = 256
  const back: Region = () => {
    ctx.moveTo(cx - 48, 200)
    ctx.lineTo(cx + 48, 200)
    ctx.lineTo(cx + 48, 300)
    ctx.lineTo(cx - 48, 300)
    ctx.closePath()
  }
  ctx.fillStyle = '#f3ead4'
  ctx.beginPath()
  back()
  ctx.fill()
  ctx.fillStyle = INK
  shade(ctx, back, [cx - 48, 200, 96, 100], rng, Math.PI / 2.4, 4.5)
  // high back with a pointed top and finials
  shape(ctx, [[cx - 48, 200, 1], [cx - 30, 186], [cx, 168, 1], [cx + 30, 186], [cx + 48, 200, 1], [cx + 48, 208, 1], [cx - 48, 208, 1]], rng)
  penLine(ctx, [cx - 48, 200], [cx - 48, 330], 3, rng)
  penLine(ctx, [cx + 48, 200], [cx + 48, 330], 3, rng)
  disc(ctx, cx - 48, 196, 7, rng)
  disc(ctx, cx + 48, 196, 7, rng)
  // seat and arms
  shape(ctx, [[cx - 70, 300], [cx + 70, 300], [cx + 70, 318], [cx - 70, 318]], rng)
  penLine(ctx, [cx - 70, 318], [cx - 70, 360], 4, rng)
  penLine(ctx, [cx + 70, 318], [cx + 70, 360], 4, rng)
  penLine(ctx, [cx - 48, 318], [cx - 48, 356], 2.5, rng)
  penLine(ctx, [cx + 48, 318], [cx + 48, 356], 2.5, rng)
  penLine(ctx, [cx - 70, 270], [cx - 50, 270], 3, rng)
  penLine(ctx, [cx + 50, 270], [cx + 70, 270], 3, rng)
  penLine(ctx, [cx - 70, 270], [cx - 70, 300], 3, rng)
  penLine(ctx, [cx + 70, 270], [cx + 70, 300], 3, rng)
  // a step
  penLine(ctx, [cx - 96, 364], [cx + 96, 364], 2.5, rng)
}

function closedEye(ctx: Ctx, rng: Rng, cx: number, cy: number, w: number, lashes = 5): void {
  pen(ctx, [[cx - w / 2, cy - 4], [cx - w / 4, cy + w * 0.16], [cx, cy + w * 0.2], [cx + w / 4, cy + w * 0.16], [cx + w / 2, cy - 4]], 3.4, rng, { smooth: 6, w0: 0.6, w1: 0.6 })
  for (let i = 0; i < lashes; i++) {
    const t = (i + 0.5) / lashes
    const x = cx - w / 2 + w * t
    const y = cy + Math.sin(Math.PI * t) * w * 0.2 - 2
    const a = Math.PI / 2 + (t - 0.5) * 1.1
    penLine(ctx, [x, y], [x + Math.cos(a) * w * 0.14, y + Math.sin(a) * w * 0.14], 1.6, rng)
  }
}

function openEye(ctx: Ctx, rng: Rng, cx: number, cy: number, w: number): Region {
  const h = w * 0.42
  const region: Region = () => {
    ctx.moveTo(cx - w / 2, cy)
    ctx.quadraticCurveTo(cx, cy - h * 1.3, cx + w / 2, cy)
    ctx.quadraticCurveTo(cx, cy + h * 1.3, cx - w / 2, cy)
    ctx.closePath()
  }
  ctx.fillStyle = '#f7f1e2'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  pen(ctx, [[cx - w / 2, cy], [cx - w / 4, cy - h * 0.8], [cx, cy - h], [cx + w / 4, cy - h * 0.8], [cx + w / 2, cy]], 3.2, rng, { smooth: 6, w0: 0.5, w1: 0.5 })
  pen(ctx, [[cx - w / 2, cy], [cx - w / 4, cy + h * 0.8], [cx, cy + h], [cx + w / 4, cy + h * 0.8], [cx + w / 2, cy]], 2.4, rng, { smooth: 6, w0: 0.5, w1: 0.5 })
  return region
}

function quillCharge(ctx: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number): void {
  // a feather quill lying from (x0,y0) nib to (x1,y1) tip
  const dx = x1 - x0
  const dy = y1 - y0
  const L = Math.hypot(dx, dy)
  const tx = dx / L
  const ty = dy / L
  const nx = -ty
  const ny = tx
  const vane: Pt[] = []
  for (let i = 0; i <= 10; i++) {
    const t = 0.3 + 0.7 * (i / 10)
    const wdt = Math.sin(((t - 0.3) / 0.7) * Math.PI) ** 0.6 * 26 + 2
    vane.push([x0 + tx * L * t + nx * wdt, y0 + ty * L * t + ny * wdt])
  }
  vane.push([x1 + tx * 8, y1 + ty * 8, 1])
  for (let i = 10; i >= 0; i--) {
    const t = 0.3 + 0.7 * (i / 10)
    const wdt = Math.sin(((t - 0.3) / 0.7) * Math.PI) ** 0.7 * 14 + 1
    vane.push([x0 + tx * L * t - nx * wdt, y0 + ty * L * t - ny * wdt])
  }
  ctx.fillStyle = '#f3ead4'
  ctx.beginPath()
  vane.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = INK
  penShape(ctx, vane, 1.6, rng, { smooth: 3 })
  pen(ctx, [[x0, y0], [x0 + tx * L * 0.5, y0 + ty * L * 0.5], [x1, y1]], 2.6, rng, { w0: 2.2, w1: 0.4 })
  for (let i = 1; i < 9; i++) {
    const t = 0.34 + 0.6 * (i / 9)
    const bx = x0 + tx * L * t
    const by = y0 + ty * L * t
    penLine(ctx, [bx, by], [bx + nx * 18 - tx * 6, by + ny * 18 - ty * 6], 0.9, rng)
  }
  // slit nib
  penLine(ctx, [x0, y0], [x0 + tx * 14, y0 + ty * 14], 1, rng)
}

function wavesCharge(ctx: Ctx, rng: Rng, region: Region, box: Box, rows: number, y0: number, y1: number): void {
  ctx.save()
  ctx.beginPath()
  region()
  ctx.clip()
  ctx.fillStyle = INK
  for (let i = 0; i < rows; i++) {
    const y = y0 + ((y1 - y0) * i) / (rows - 1)
    const line: Pt[] = []
    for (let x = box[0] - 20; x <= box[0] + box[2] + 20; x += 12) line.push([x, y + Math.sin(x / 19 + i * 0.9) * 7])
    pen(ctx, line, 3.4, rng, { smooth: 3, w0: 3, w1: 3, noise: 0.5 })
    const thin: Pt[] = line.map((p) => [p[0], p[1] + 9])
    pen(ctx, thin, 1.2, rng, { smooth: 3, w0: 1, w1: 1 })
  }
  ctx.restore()
}

function coinCharge(ctx: Ctx, rng: Rng, cx: number, cy: number, r: number): void {
  const region: Region = () => ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#f3ead4'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  stipple(ctx, region, rng, [cx - r, cy - r, r * 2, r * 2], 4, 1, (x, y) => Math.min(1, ((x - cx) / r + (y - cy) / r + 1.2) / 1.6))
  penCircle(ctx, cx, cy, r, 3, rng)
  penCircle(ctx, cx, cy, r * 0.8, 1.2, rng)
  // a stamped tortoise-shell: a hexagon with notches
  const hex: Pt[] = []
  for (let i = 0; i < 6; i++) hex.push([cx + Math.cos((i * Math.PI) / 3) * r * 0.42, cy + Math.sin((i * Math.PI) / 3) * r * 0.42])
  for (let i = 0; i < 6; i++) penLine(ctx, hex[i], hex[(i + 1) % 6], 1.6, rng)
  for (let i = 0; i < 6; i += 2) penLine(ctx, [cx, cy], hex[i], 1.2, rng)
}

function flameRegion(ctx: Ctx, cx: number, base: number, h: number, w: number): { region: Region; pts: Pt[] } {
  const pts: Pt[] = [
    [cx, base - h, 1],
    [cx + w * 0.22, base - h * 0.74],
    [cx + w * 0.3, base - h * 0.58, 1],
    [cx + w * 0.48, base - h * 0.38],
    [cx + w * 0.44, base - h * 0.12],
    [cx + w * 0.2, base],
    [cx - w * 0.22, base],
    [cx - w * 0.46, base - h * 0.14],
    [cx - w * 0.42, base - h * 0.4],
    [cx - w * 0.26, base - h * 0.5, 1],
    [cx - w * 0.3, base - h * 0.7],
    [cx - w * 0.12, base - h * 0.82],
  ]
  const region: Region = () => {
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  return { region, pts }
}

function womanInFlame(ctx: Ctx, rng: Rng, cx: number, base: number, h: number, w: number): void {
  const { region, pts } = flameRegion(ctx, cx, base, h, w)
  ctx.fillStyle = '#f7f1e2'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  // flame tone: hatching that follows the flame's lean, denser at the edges
  hatch(ctx, region, rng, { angle: Math.PI / 2 + 0.25, gap: 5, w: 0.9, box: [cx - w / 2, base - h, w, h], fade: 'start', alpha: 0.9 })
  hatch(ctx, region, rng, { angle: Math.PI / 2 - 0.3, gap: 6, w: 0.8, box: [cx - w / 2, base - h, w, h], fade: 'end', alpha: 0.7 })
  penShape(ctx, pts, 2.4, rng, { smooth: 5 })
  // inner tongues
  pen(ctx, [[cx - w * 0.1, base - h * 0.1], [cx - w * 0.16, base - h * 0.4], [cx - w * 0.02, base - h * 0.66]], 1.6, rng)
  pen(ctx, [[cx + w * 0.18, base - h * 0.12], [cx + w * 0.22, base - h * 0.38], [cx + w * 0.1, base - h * 0.56]], 1.4, rng)
  // the woman: a standing robed figure left in paper, arms open
  const fh = h * 0.72
  const fy = base - h * 0.06
  const fig: Pt[] = [
    [cx, fy - fh, 1],
    [cx + fh * 0.07, fy - fh * 0.94],
    [cx + fh * 0.08, fy - fh * 0.84],
    [cx + fh * 0.2, fy - fh * 0.76],
    [cx + fh * 0.34, fy - fh * 0.52, 1],
    [cx + fh * 0.2, fy - fh * 0.62],
    [cx + fh * 0.17, fy - fh * 0.3],
    [cx + fh * 0.2, fy, 1],
    [cx - fh * 0.2, fy, 1],
    [cx - fh * 0.17, fy - fh * 0.3],
    [cx - fh * 0.2, fy - fh * 0.62],
    [cx - fh * 0.34, fy - fh * 0.52, 1],
    [cx - fh * 0.2, fy - fh * 0.76],
    [cx - fh * 0.08, fy - fh * 0.84],
    [cx - fh * 0.07, fy - fh * 0.94],
  ]
  ctx.fillStyle = '#f7f1e2'
  ctx.beginPath()
  fig.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = INK
  penShape(ctx, fig, 1.8, rng, { smooth: 4 })
  // head and hair
  disc(ctx, cx, fy - fh * 0.9, fh * 0.07, rng)
  ctx.fillStyle = '#f7f1e2'
  disc(ctx, cx - fh * 0.012, fy - fh * 0.885, fh * 0.05, rng)
  ctx.fillStyle = INK
  // robe folds
  penLine(ctx, [cx - fh * 0.06, fy - fh * 0.6], [cx - fh * 0.1, fy - fh * 0.05], 1, rng)
  penLine(ctx, [cx + fh * 0.06, fy - fh * 0.6], [cx + fh * 0.1, fy - fh * 0.05], 1, rng)
  penLine(ctx, [cx, fy - fh * 0.64], [cx, fy - fh * 0.08], 0.9, rng)
}

function anvilCharge(ctx: Ctx, rng: Rng, cx: number, cy: number, s: number): void {
  const pts: Pt[] = [
    [cx - 0.62 * s, cy - 0.3 * s, 1],
    [cx + 0.42 * s, cy - 0.3 * s, 1],
    [cx + 0.7 * s, cy - 0.22 * s, 1],
    [cx + 0.4 * s, cy - 0.04 * s, 1],
    [cx + 0.2 * s, cy + 0.1 * s, 1],
    [cx + 0.26 * s, cy + 0.34 * s, 1],
    [cx + 0.4 * s, cy + 0.5 * s, 1],
    [cx - 0.4 * s, cy + 0.5 * s, 1],
    [cx - 0.26 * s, cy + 0.34 * s, 1],
    [cx - 0.2 * s, cy + 0.1 * s, 1],
    [cx - 0.48 * s, cy - 0.04 * s, 1],
    [cx - 0.62 * s, cy - 0.12 * s, 1],
  ]
  const region: Region = () => {
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  ctx.fillStyle = '#f3ead4'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  crossHatch(ctx, region, rng, { angle: 0.2, gap: 4.5, w: 1, box: [cx - 0.7 * s, cy - 0.3 * s, 1.4 * s, 0.8 * s], fade: 'start' })
  for (let i = 0; i < pts.length; i++) penLine(ctx, pts[i], pts[(i + 1) % pts.length], 2.4, rng)
  penLine(ctx, [cx - 0.62 * s, cy - 0.22 * s], [cx + 0.42 * s, cy - 0.22 * s], 1.2, rng)
}

function crownCharge(ctx: Ctx, rng: Rng, cx: number, cy: number, w: number, h: number): void {
  const pts: Pt[] = [[cx - w / 2, cy, 1], [cx - w / 2, cy - h * 0.5, 1], [cx - w * 0.28, cy - h * 0.25, 1], [cx - w * 0.16, cy - h, 1], [cx, cy - h * 0.4, 1], [cx + w * 0.16, cy - h, 1], [cx + w * 0.28, cy - h * 0.25, 1], [cx + w / 2, cy - h * 0.5, 1], [cx + w / 2, cy, 1]]
  const region: Region = () => {
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  ctx.fillStyle = '#f7f1e2'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  stipple(ctx, region, rng, [cx - w / 2, cy - h, w, h], 3, 0.9)
  for (let i = 0; i < pts.length - 1; i++) penLine(ctx, pts[i], pts[i + 1], 2.2, rng)
  penLine(ctx, [cx - w / 2, cy], [cx + w / 2, cy], 2.6, rng)
  penLine(ctx, [cx - w / 2, cy + 8], [cx + w / 2, cy + 8], 1.4, rng)
  for (const x of [-w * 0.16, w * 0.16]) disc(ctx, cx + x, cy - h - 3, 3.5, rng)
  disc(ctx, cx, cy - h * 0.4 - 4, 3, rng)
}

function standingStone(ctx: Ctx, rng: Rng, cx: number, base: number, h: number, w: number): void {
  const pts: Pt[] = [[cx - w * 0.42, base, 1], [cx - w * 0.5, base - h * 0.5], [cx - w * 0.36, base - h * 0.86], [cx - w * 0.1, base - h, 1], [cx + w * 0.3, base - h * 0.92], [cx + w * 0.46, base - h * 0.5], [cx + w * 0.4, base, 1]]
  const region: Region = () => {
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  ctx.fillStyle = '#f3ead4'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  hatch(ctx, region, rng, { angle: Math.PI / 2 + 0.15, gap: 4.5, w: 1, box: [cx - w / 2, base - h, w, h], fade: 'start' })
  hatch(ctx, region, rng, { angle: 0.1, gap: 9, w: 0.7, box: [cx - w / 2, base - h, w, h], alpha: 0.5 })
  penShape(ctx, pts, 2.6, rng, { smooth: 4 })
  // weathering cracks and a ward glyph: a nine-notched ring
  pen(ctx, [[cx - w * 0.2, base - h * 0.78], [cx - w * 0.08, base - h * 0.6], [cx - w * 0.14, base - h * 0.46]], 1.2, rng)
  penCircle(ctx, cx + w * 0.06, base - h * 0.42, w * 0.16, 1.8, rng)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    penLine(ctx, [cx + w * 0.06 + Math.cos(a) * w * 0.16, base - h * 0.42 + Math.sin(a) * w * 0.16], [cx + w * 0.06 + Math.cos(a) * w * 0.22, base - h * 0.42 + Math.sin(a) * w * 0.22], 1.4, rng)
  }
  // grass and ground
  for (let i = 0; i < 12; i++) {
    const x = cx - w * 0.9 + rng.next() * w * 1.8
    pen(ctx, [[x, base + 2], [x + rng.wob(6), base - 6 - rng.next() * 10]], 1, rng, { w0: 1, w1: 0.1 })
  }
  pen(ctx, [[cx - w, base + 2], [cx - w * 0.3, base + 5], [cx + w * 0.4, base + 1], [cx + w, base + 4]], 1.6, rng, { smooth: 4 })
}

function handCharge(ctx: Ctx, rng: Rng, cx: number, cy: number, s: number): void {
  // an open palm, fingers up, with lines of script tattooed across it
  const fingers: Pt[] = []
  const tips = [
    [-0.42, -0.5],
    [-0.16, -0.78],
    [0.1, -0.82],
    [0.36, -0.66],
  ]
  fingers.push([cx - 0.52 * s, cy - 0.1 * s])
  for (const [fx, fy] of tips) {
    fingers.push([cx + (fx - 0.1) * s, cy + (fy + 0.42) * s], [cx + (fx - 0.08) * s, cy + fy * s], [cx + fx * s, cy + (fy - 0.04) * s, 1], [cx + (fx + 0.08) * s, cy + fy * s], [cx + (fx + 0.1) * s, cy + (fy + 0.42) * s])
  }
  fingers.push([cx + 0.5 * s, cy - 0.1 * s], [cx + 0.78 * s, cy + 0.16 * s, 1], [cx + 0.6 * s, cy + 0.28 * s], [cx + 0.48 * s, cy + 0.5 * s], [cx + 0.4 * s, cy + 0.9 * s], [cx - 0.36 * s, cy + 0.9 * s], [cx - 0.48 * s, cy + 0.5 * s])
  const region: Region = () => {
    fingers.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  ctx.fillStyle = '#f7f1e2'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  hatch(ctx, region, rng, { angle: Math.PI / 3, gap: 5, w: 0.8, box: [cx - 0.6 * s, cy - 0.9 * s, 1.4 * s, 1.8 * s], fade: 'start', alpha: 0.6 })
  penShape(ctx, fingers, 2.2, rng, { smooth: 3 })
  // tattooed script: rows of tiny marks across the palm, a spiral at the heel
  ctx.save()
  ctx.beginPath()
  region()
  ctx.clip()
  for (let row = 0; row < 7; row++) {
    const y = cy - 0.02 * s + row * 0.1 * s
    let x = cx - 0.5 * s
    while (x < cx + 0.5 * s) {
      const len = 3 + rng.next() * 7
      penLine(ctx, [x, y + rng.wob(1)], [x + len, y + rng.wob(1.5)], 1.2, rng)
      if (rng.chance(0.4)) penLine(ctx, [x + len / 2, y - 4], [x + len / 2, y + 3], 0.9, rng)
      x += len + 3 + rng.next() * 4
    }
  }
  const sp: Pt[] = []
  for (let i = 0; i <= 40; i++) {
    const a = i * 0.45
    const r = 2 + i * 1.1
    sp.push([cx + 0.02 * s + Math.cos(a) * r, cy + 0.74 * s + Math.sin(a) * r * 0.8])
  }
  pen(ctx, sp, 1.2, rng, { smooth: 2, w0: 1, w1: 0.4 })
  ctx.restore()
}

function crowOnKey(ctx: Ctx, rng: Rng): void {
  const cx = 256
  // the key, lying across the field
  const ky = 330
  penLine(ctx, [cx - 60, ky], [cx + 96, ky], 7, rng)
  penCircle(ctx, cx - 86, ky, 28, 6, rng)
  penCircle(ctx, cx - 86, ky, 12, 2.2, rng)
  for (const [dx, h] of [
    [72, 22],
    [86, 16],
    [60, 14],
  ])
    penLine(ctx, [cx + dx, ky], [cx + dx, ky + h], 6, rng)
  // the crow: a solid sable bird, hunched, beak down-left
  const crow: Pt[] = [[cx - 10, 196, 1], [cx - 28, 184], [cx - 44, 190], [cx - 60, 206], [cx - 86, 214, 1], [cx - 58, 216], [cx - 44, 222], [cx - 48, 250], [cx - 34, 280], [cx - 14, 306], [cx - 18, 326, 1], [cx + 2, 310], [cx + 24, 322, 1], [cx + 18, 300], [cx + 50, 290], [cx + 100, 262, 1], [cx + 70, 268], [cx + 44, 262], [cx + 20, 240], [cx + 8, 210]]
  ctx.fillStyle = INK
  shape(ctx, crow, rng, 0.6)
  // feather edges and an eye in paper
  ctx.fillStyle = '#f3ead4'
  disc(ctx, cx - 36, 200, 3.5, rng)
  ctx.fillStyle = INK
  disc(ctx, cx - 36, 200, 1.6, rng)
  for (let i = 0; i < 5; i++) pen(ctx, [[cx + 30 + i * 12, 264 - i * 4], [cx + 44 + i * 12, 272 - i * 5]], 1.2, rng)
  // feet gripping the key
  pen(ctx, [[cx - 20, 324], [cx - 26, 334], [cx - 20, 338]], 2, rng)
  pen(ctx, [[cx + 6, 322], [cx + 2, 334], [cx + 10, 338]], 2, rng)
}

function glasserCharge(ctx: Ctx, rng: Rng): void {
  const cx = 256
  const cy = 262
  // a diamond pane of glass, cracked
  const pane: Pt[] = [[cx, cy - 96, 1], [cx + 76, cy, 1], [cx, cy + 96, 1], [cx - 76, cy, 1]]
  const region: Region = () => {
    pane.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  ctx.fillStyle = '#f7f1e2'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  hatch(ctx, region, rng, { angle: -Math.PI / 3.2, gap: 6, w: 0.8, box: [cx - 76, cy - 96, 152, 192], fade: 'end', alpha: 0.7 })
  for (let i = 0; i < 4; i++) penLine(ctx, pane[i], pane[(i + 1) % 4], 3, rng)
  // the crack: a jagged line from a strike point with radiating fractures
  const hit: Pt = [cx - 18, cy + 10]
  pen(ctx, [hit, [cx - 4, cy - 20], [cx + 10, cy - 36], [cx + 6, cy - 60], [cx + 18, cy - 76]], 1.8, rng, { smooth: 0, w0: 2, w1: 0.3 })
  pen(ctx, [hit, [cx + 14, cy + 18], [cx + 36, cy + 12], [cx + 52, cy + 26]], 1.6, rng, { smooth: 0, w0: 2, w1: 0.3 })
  pen(ctx, [hit, [cx - 30, cy + 34], [cx - 26, cy + 60], [cx - 12, cy + 78]], 1.6, rng, { smooth: 0, w0: 2, w1: 0.3 })
  pen(ctx, [hit, [cx - 40, cy - 6], [cx - 56, cy - 14]], 1.3, rng, { smooth: 0, w0: 1.6, w1: 0.2 })
  pen(ctx, [[cx - 4, cy - 20], [cx - 22, cy - 30]], 1, rng, { smooth: 0 })
  // the pick, behind, crossing diagonally
  pen(ctx, [[cx - 110, cy + 120], [cx + 70, cy - 110]], 5, rng, { w0: 4, w1: 3 })
  shape(ctx, [[cx + 40, cy - 126, 1], [cx + 80, cy - 104], [cx + 118, cy - 70, 1], [cx + 92, cy - 94], [cx + 70, cy - 98], [cx + 56, cy - 86, 1], [cx + 50, cy - 110]], rng)
}

function bargeCharge(ctx: Ctx, rng: Rng, region: Region, box: Box): void {
  const cx = 256
  // water in base
  const water: Region = () => {
    ctx.moveTo(box[0] - 10, 318)
    ctx.lineTo(box[0] + box[2] + 10, 318)
    ctx.lineTo(box[0] + box[2] + 10, box[1] + box[3] + 10)
    ctx.lineTo(box[0] - 10, box[1] + box[3] + 10)
    ctx.closePath()
  }
  ctx.save()
  ctx.beginPath()
  region()
  ctx.clip()
  wavesCharge(ctx, rng, water, box, 4, 330, 400)
  ctx.restore()
  // the barge: a long low hull, a cabin, a steering oar
  const hull: Pt[] = [[cx - 110, 290, 1], [cx + 116, 290, 1], [cx + 96, 324, 1], [cx - 96, 324, 1]]
  const hullR: Region = () => {
    hull.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  ctx.fillStyle = '#f3ead4'
  ctx.beginPath()
  hullR()
  ctx.fill()
  ctx.fillStyle = INK
  hatch(ctx, hullR, rng, { angle: 0, gap: 4.5, w: 1, box: [cx - 110, 290, 226, 34], fade: 'start' })
  for (let i = 0; i < 4; i++) penLine(ctx, hull[i], hull[(i + 1) % 4], 2.6, rng)
  const cabin: Pt[] = [[cx - 40, 290, 1], [cx - 34, 254, 1], [cx + 44, 254, 1], [cx + 50, 290, 1]]
  for (let i = 0; i < 3; i++) penLine(ctx, cabin[i], cabin[i + 1], 2.2, rng)
  penLine(ctx, [cx - 42, 254], [cx + 52, 254], 3, rng)
  penCircle(ctx, cx + 6, 272, 7, 1.6, rng)
  penLine(ctx, [cx - 90, 296], [cx - 130, 250], 3, rng)
  penLine(ctx, [cx + 100, 300], [cx + 124, 264], 2.2, rng)
  // smoke from a stovepipe
  penLine(ctx, [cx + 28, 254], [cx + 28, 236], 3, rng)
  pen(ctx, [[cx + 28, 232], [cx + 36, 222], [cx + 30, 210], [cx + 40, 198]], 1.4, rng, { w0: 1.4, w1: 0.2 })
  // the knot in chief: a figure-eight of rope
  const kx = cx
  const ky = 180
  const rope: Pt[] = []
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * Math.PI * 2
    rope.push([kx + Math.sin(t) * 64, ky + Math.sin(2 * t) * 28])
  }
  pen(ctx, rope, 7, rng, { closed: true, smooth: 2, noise: 0.1 })
  ctx.fillStyle = '#f3ead4'
  const inner: Pt[] = rope.map((p) => p)
  pen(ctx, inner, 2.6, rng, { closed: true, smooth: 2, noise: 0.1 })
  ctx.fillStyle = INK
  for (let i = 0; i < 60; i += 4) {
    const a = rope[i]
    const b = rope[i + 1]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy) || 1
    penLine(ctx, [a[0] - (dy / L) * 3.5, a[1] + (dx / L) * 3.5], [a[0] + (dy / L) * 3.5 + dx * 0.6, a[1] - (dx / L) * 3.5 + dy * 0.6], 1, rng)
  }
}

// ---------- the twelve ----------

type Crest = (ctx: Ctx, rng: Rng) => void

const CRESTS: Record<string, Crest> = {
  'f-ninth-lantern': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'gules', rng)
    // nine notches in the chief
    ctx.fillStyle = PAPER_OLD
    for (let i = 0; i < 9; i++) {
      const x = box[0] + 10 + ((box[2] - 20) * (i + 0.5)) / 9
      ctx.beginPath()
      ctx.arc(x, box[1] + 10, 11, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = INK
    for (let i = 0; i < 9; i++) {
      const x = box[0] + 10 + ((box[2] - 20) * (i + 0.5)) / 9
      penCircle(ctx, x, box[1] + 10, 11, 1.8, rng, { a0: 0.15, a1: Math.PI - 0.15 })
    }
    lanternCharge(ctx, rng)
  },
  'f-regency-council': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'azure', rng)
    throneCharge(ctx, rng)
  },
  'f-quiet-office': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'argent', rng)
    // a bordure of sable: cross-hatch the whole field, then clear the inner shield
    crossHatch(ctx, region, rng, { angle: 0.1, gap: 5, w: 1, box })
    const inner: Region = () => {
      ctx.moveTo(box[0] + 34, box[1] + 34)
      ctx.lineTo(box[0] + box[2] - 34, box[1] + 34)
      ctx.lineTo(box[0] + box[2] - 34, box[1] + box[3] * 0.4)
      ctx.bezierCurveTo(box[0] + box[2] - 34, box[1] + box[3] * 0.68, 256 + 52, box[1] + box[3] - 70, 256, box[1] + box[3] - 46)
      ctx.bezierCurveTo(256 - 52, box[1] + box[3] - 70, box[0] + 34, box[1] + box[3] * 0.68, box[0] + 34, box[1] + box[3] * 0.4)
      ctx.closePath()
    }
    ctx.fillStyle = PAPER_OLD
    ctx.beginPath()
    inner()
    ctx.fill()
    ctx.fillStyle = INK
    ctx.save()
    ctx.beginPath()
    inner()
    ctx.clip()
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.beginPath()
    inner()
    ctx.stroke()
    ctx.restore()
    ctx.fillStyle = INK
    closedEye(ctx, rng, 256, 214, 120, 7)
    quillCharge(ctx, rng, 180, 356, 340, 262)
  },
  'f-concord-houses': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    wavesCharge(ctx, rng, region, box, 7, 236, 420)
    coinCharge(ctx, rng, 256, 166, 52)
  },
  'f-church-saint': (ctx, rng) => {
    const { region, box } = banner(ctx, rng)
    tincture(ctx, region, box, 'purpure', rng)
    womanInFlame(ctx, rng, 256, 360, 236, 150)
  },
  'f-mothers': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'gules', rng)
    crownCharge(ctx, rng, 256, 206, 120, 52)
    anvilCharge(ctx, rng, 256, 300, 150)
  },
  'f-last-wardens': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'vert', rng)
    standingStone(ctx, rng, 256, 392, 250, 120)
  },
  'f-remembrancers': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'azure', rng)
    handCharge(ctx, rng, 258, 268, 150)
  },
  'f-rook-court': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'or', rng)
    crowOnKey(ctx, rng)
  },
  'f-sleepless': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'purpure', rng)
    const eye = openEye(ctx, rng, 256, 268, 200)
    void eye
    ctx.fillStyle = INK
    penCircle(ctx, 256, 268, 46, 3, rng)
    hatch(ctx, () => ctx.arc(256, 268, 44, 0, Math.PI * 2), rng, { angle: Math.PI / 2, gap: 4, w: 0.8, box: [210, 222, 92, 92], fade: 'start', alpha: 0.6 })
    closedEye(ctx, rng, 256, 262, 60, 5)
    // tears of wakefulness: three drops under the eye
    for (const dx of [-30, 0, 30]) shape(ctx, [[256 + dx, 330, 1], [256 + dx + 6, 342], [256 + dx, 350], [256 + dx - 6, 342]], rng)
  },
  'f-glassers': (ctx, rng) => {
    const { region, box } = shield(ctx, rng)
    tincture(ctx, region, box, 'or', rng)
    glasserCharge(ctx, rng)
  },
  'f-barge-clans': (ctx, rng) => {
    const { region, box } = banner(ctx, rng)
    tincture(ctx, region, box, 'argent', rng)
    bargeCharge(ctx, rng, region, box)
  },
}

/** The crest drawing for a faction key, or nothing. */
export function drawCrest(name: string): ((ctx: Ctx, w: number, h: number) => void) | undefined {
  const crest = CRESTS[name]
  if (!crest) return undefined
  return (ctx, w, h) => {
    const rng = new Rng(seedOf('crest:' + name))
    parchment(ctx, w, h, rng, { age: 0.4, vignette: 0.22 })
    ctx.fillStyle = INK
    crest(ctx, rng)
  }
}
