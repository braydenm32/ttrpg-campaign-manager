/**
 * Item sketches: pen studies of objects on parchment, the way a field journal would record a find.
 * Named items get their own drawing; a few kinds of thing (blades, coin, powder, books, bottles,
 * keys) are recognised from the key, and anything else gets no picture.
 */
import { INK, Rng, arcPts, crossHatch, disc, hatch, parchment, pen, penCircle, penLine, penShape, seedOf, shape, stipple, type Ctx, type Pt } from './ink'

type Region = () => void
type Box = [number, number, number, number]
type Item = (ctx: Ctx, rng: Rng) => void

const C = 256

function region(pts: Pt[], ctx: Ctx): Region {
  return () => {
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
}

function body(ctx: Ctx, rng: Rng, pts: Pt[], box: Box, o: { angle?: number; gap?: number; w?: number; smooth?: number; fade?: 'start' | 'end'; cross?: boolean; tone?: string } = {}): Region {
  const r = region(pts, ctx)
  ctx.fillStyle = o.tone ?? '#f3ead4'
  ctx.beginPath()
  r()
  ctx.fill()
  ctx.fillStyle = INK
  const h = { angle: o.angle ?? Math.PI / 4, gap: o.gap ?? 4.5, w: 0.9, box, fade: o.fade ?? ('start' as const) }
  if (o.cross) crossHatch(ctx, r, rng, h)
  else hatch(ctx, r, rng, h)
  penShape(ctx, pts, o.w ?? 2.4, rng, { smooth: o.smooth ?? 0 })
  return r
}

/** A soft cast shadow on the table under an object. */
function tableShadow(ctx: Ctx, rng: Rng, cx: number, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = INK
  hatch(ctx, () => ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2), rng, { angle: 0, gap: 4, w: 0.8, box: [cx - rx, cy - ry, rx * 2, ry * 2], alpha: 0.45, fade: 'end' })
}

/** Light rays: short fading pen strokes radiating from a point. */
function glow(ctx: Ctx, rng: Rng, cx: number, cy: number, r0: number, r1: number, n: number, alpha = 0.55): void {
  ctx.fillStyle = INK
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.wob(0.08)
    const s0 = r0 + rng.range(0, (r1 - r0) * 0.3)
    const s1 = r1 - rng.range(0, (r1 - r0) * 0.4)
    ctx.globalAlpha = alpha
    penLine(ctx, [cx + Math.cos(a) * s0, cy + Math.sin(a) * s0], [cx + Math.cos(a) * s1, cy + Math.sin(a) * s1], 1, rng)
    ctx.globalAlpha = 1
  }
}

const ITEMS: Record<string, Item> = {
  'item-lantern': (ctx, rng) => {
    // an iron-caged lantern with a flame that is not quite the right shape
    tableShadow(ctx, rng, C + 10, 440, 110, 16)
    const top = 150
    const bot = 390
    const w = 130
    // glass body, lightly toned, with the cage's bars over it
    const glass: Pt[] = [[C - w / 2, top, 1], [C + w / 2, top, 1], [C + w / 2 - 12, bot, 1], [C - w / 2 + 12, bot, 1]]
    body(ctx, rng, glass, [C - w / 2, top, w, bot - top], { angle: Math.PI / 2 + 0.05, gap: 6, w: 2.4, fade: 'start' })
    // the flame: left as paper with hatched halo cleared around it
    const fx = C
    const fy = 300
    ctx.fillStyle = '#faf6ea'
    ctx.beginPath()
    ctx.ellipse(fx, fy - 10, 40, 64, 0, 0, Math.PI * 2)
    ctx.fill()
    const flame: Pt[] = [[fx + 2, fy - 72, 1], [fx + 14, fy - 50], [fx + 22, fy - 26], [fx + 18, fy - 4], [fx + 6, fy + 10], [fx - 8, fy + 8], [fx - 20, fy - 8], [fx - 22, fy - 34], [fx - 10, fy - 48], [fx - 14, fy - 60, 1], [fx - 4, fy - 56]]
    ctx.fillStyle = INK
    penShape(ctx, flame, 1.8, rng, { smooth: 4 })
    pen(ctx, [[fx - 2, fy], [fx + 6, fy - 22], [fx, fy - 42]], 1.2, rng)
    // the flame has a second, fainter shape inside it, leaning the other way
    ctx.globalAlpha = 0.5
    pen(ctx, [[fx - 10, fy - 2], [fx - 14, fy - 30], [fx - 2, fy - 52]], 1, rng)
    ctx.globalAlpha = 1
    glow(ctx, rng, fx, fy - 20, 60, 100, 26, 0.35)
    // wick and oil cup
    penLine(ctx, [fx, fy + 10], [fx, fy + 24], 2, rng)
    shape(ctx, [[fx - 26, fy + 22], [fx + 26, fy + 22], [fx + 22, fy + 40], [fx - 22, fy + 40]], rng)
    // cage bars: iron, dark
    for (const dx of [-w / 2, -w / 6, w / 6, w / 2]) pen(ctx, [[C + dx, top], [C + dx * 0.82, bot]], 5, rng, { w0: 5, w1: 5, smooth: 0 })
    for (const y of [top + 70, top + 150]) {
      const k = (y - top) / (bot - top)
      penLine(ctx, [C - w / 2 + 12 * k, y], [C + w / 2 - 12 * k, y], 3.4, rng)
    }
    // cap, chimney and ring
    const cap: Pt[] = [[C - w / 2 - 12, top, 1], [C - 40, top - 40], [C, top - 54], [C + 40, top - 40], [C + w / 2 + 12, top, 1]]
    body(ctx, rng, cap, [C - w / 2 - 12, top - 54, w + 24, 54], { angle: 0.2, gap: 3.5, w: 2.6, smooth: 3, cross: true })
    for (let i = 0; i < 5; i++) penLine(ctx, [C - 40 + i * 20, top - 44 + Math.abs(i - 2) * 6], [C - 40 + i * 20, top - 30 + Math.abs(i - 2) * 4], 1.2, rng)
    penLine(ctx, [C - 22, top - 60], [C + 22, top - 60], 4, rng)
    penLine(ctx, [C - 16, top - 74], [C + 16, top - 74], 3, rng)
    penCircle(ctx, C, top - 96, 20, 4, rng)
    // base plate and feet
    const base: Pt[] = [[C - w / 2, bot, 1], [C + w / 2, bot, 1], [C + w / 2 + 8, bot + 22, 1], [C - w / 2 - 8, bot + 22, 1]]
    body(ctx, rng, base, [C - w / 2 - 8, bot, w + 16, 22], { angle: 0.2, gap: 3.5, w: 2.6, cross: true })
    for (const dx of [-w / 2 + 6, w / 2 - 6]) penLine(ctx, [C + dx, bot + 22], [C + dx, bot + 34], 4, rng)
    // a soot smear and a chip on the glass
    stipple(ctx, () => ctx.ellipse(C + 30, top + 40, 26, 30, 0, 0, Math.PI * 2), rng, [C, top + 10, 60, 60], 5, 0.9)
  },
  'item-oil-tin': (ctx, rng) => {
    // a squat tin of lamp oil, dented, its lid prised off and leaning on the rim, a spill beside it
    tableShadow(ctx, rng, C + 20, 406, 130, 18)
    const top = 230
    const bot = 390
    const w = 180
    const tin: Pt[] = [[C - w / 2, top, 1], [C - w / 2 - 2, top + 60], [C - w / 2 + 10, top + 90, 1], [C - w / 2 - 2, top + 120], [C - w / 2 + 2, bot, 1], [C + w / 2, bot, 1], [C + w / 2 + 2, top, 1]]
    body(ctx, rng, tin, [C - w / 2 - 4, top, w + 8, bot - top], { angle: Math.PI / 2 + 0.04, gap: 8, w: 2.6, fade: 'start' })
    // seams, bottom rim
    for (const y of [top + 24, bot - 22]) {
      penLine(ctx, [C - w / 2 - 2, y], [C + w / 2 + 2, y], 1.6, rng)
      ctx.globalAlpha = 0.5
      penLine(ctx, [C - w / 2 - 2, y + 5], [C + w / 2 + 2, y + 5], 0.8, rng)
      ctx.globalAlpha = 1
    }
    pen(ctx, arcPts(C, bot, w / 2, 0, Math.PI, 14, 14), 2.4, rng, { smooth: 2, w0: 0.6, w1: 0.6 })
    // the dent, a crease with hatching inside
    const dent: Pt[] = [[C - w / 2 - 2, top + 60, 1], [C - w / 2 + 34, top + 74], [C - w / 2 + 40, top + 100], [C - w / 2 + 10, top + 90, 1], [C - w / 2 - 2, top + 120]]
    hatch(ctx, region(dent, ctx), rng, { angle: -0.5, gap: 3, w: 0.8, box: [C - w / 2 - 4, top + 56, 48, 68], alpha: 0.9 })
    penShape(ctx, dent, 1.4, rng, { smooth: 3 })
    // the open mouth, dark inside, oil to a level
    const mouth: Region = () => ctx.ellipse(C, top, w / 2, 20, 0, 0, Math.PI * 2)
    ctx.fillStyle = INK
    crossHatch(ctx, mouth, rng, { angle: 0, gap: 3.5, w: 1, box: [C - w / 2, top - 20, w, 40], alpha: 0.9 })
    ctx.fillStyle = '#efe3c8'
    pen(ctx, arcPts(C, top + 2, w / 2 - 14, 0.2, Math.PI - 0.2, 12, 10), 2, rng, { smooth: 2, w0: 0.4, w1: 0.4 })
    ctx.fillStyle = INK
    penCircle(ctx, C, top, w / 2, 2.6, rng, { ry: 20 })
    penCircle(ctx, C, top, w / 2 - 10, 1.2, rng, { ry: 14 })
    // the lid, leaning against the far rim
    ctx.save()
    ctx.translate(C + 70, top - 44)
    ctx.rotate(-0.95)
    const lidR: Region = () => ctx.ellipse(0, 0, w / 2 - 6, 18, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#f3ead4'
    ctx.beginPath()
    lidR()
    ctx.fill()
    ctx.fillStyle = INK
    hatch(ctx, lidR, rng, { angle: 0.1, gap: 3.4, w: 0.8, box: [-w / 2, -20, w, 40], fade: 'start', alpha: 0.8 })
    penCircle(ctx, 0, 0, w / 2 - 6, 2.2, rng, { ry: 18 })
    penCircle(ctx, 0, 0, w / 2 - 20, 1, rng, { ry: 12 })
    penCircle(ctx, 20, 0, 9, 2, rng, { ry: 6 })
    ctx.restore()
    // a paper label, peeling, with illegible script
    const label: Pt[] = [[C - 54, top + 48, 1], [C + 60, top + 44, 1], [C + 56, top + 104], [C + 44, top + 96, 1], [C - 52, top + 106, 1]]
    ctx.fillStyle = '#faf6ea'
    ctx.beginPath()
    region(label, ctx)()
    ctx.fill()
    ctx.fillStyle = INK
    penShape(ctx, label, 1.4, rng)
    for (let i = 0; i < 3; i++) {
      const y = top + 64 + i * 13
      const line: Pt[] = []
      for (let x = C - 42; x < C + 44 - i * 14; x += 6) line.push([x, y + rng.wob(2)])
      pen(ctx, line, 1.3, rng, { smooth: 2, w0: 1, w1: 1, noise: 0.6 })
    }
    // the spill: oil with ash in it, pooling right of the tin
    const pool: Pt[] = [[C + 70, bot - 6], [C + 130, bot - 20], [C + 190, bot - 2], [C + 206, bot + 18], [C + 160, bot + 30], [C + 100, bot + 26], [C + 72, bot + 14]]
    hatch(ctx, region(pool, ctx), rng, { angle: 0, gap: 3.5, w: 0.9, box: [C + 70, bot - 20, 140, 50], alpha: 0.8, fade: 'start' })
    penShape(ctx, pool, 1.4, rng, { smooth: 4 })
    stipple(ctx, region(pool, ctx), rng, [C + 70, bot - 20, 140, 50], 14, 1)
    // ash grains sifted out onto the table
    for (let i = 0; i < 40; i++) disc(ctx, C + 50 + rng.next() * 170, bot + 30 + rng.next() * 30, 0.8 + rng.next() * 1.2, rng)
  },
  'item-door-key': (ctx, rng) => {
    // a long iron key: a bow shaped like a door arch, a worn shank, three wards
    ctx.save()
    ctx.translate(C, C)
    ctx.rotate(-0.55)
    ctx.translate(-C, -C)
    tableShadow(ctx, rng, C, C + 28, 200, 14)
    // shank
    const shank: Pt[] = [[C - 90, C - 11, 1], [C + 150, C - 9, 1], [C + 150, C + 9, 1], [C - 90, C + 11, 1]]
    body(ctx, rng, shank, [C - 90, C - 11, 240, 22], { angle: 0.1, gap: 3.6, w: 2.4, cross: true })
    // collar rings
    for (const x of [C - 70, C - 52]) penLine(ctx, [x, C - 15], [x, C + 15], 3.2, rng)
    // the bow: an arched door with a keyhole cut through it
    const bow: Pt[] = [[C - 90, C + 34, 1], [C - 150, C + 34, 1], [C - 150, C - 10], ...arcPts(C - 120, C - 10, 30, Math.PI, Math.PI * 2, 10).slice(1, 10), [C - 90, C - 10], [C - 90, C - 34 + 24, 1]]
    void bow
    const bowOuter: Pt[] = [[C - 170, C + 40, 1], [C - 170, C - 6], ...arcPts(C - 130, C - 6, 40, Math.PI, Math.PI * 2, 12).slice(1, 12), [C - 90, C - 6], [C - 90, C + 40, 1]]
    body(ctx, rng, bowOuter, [C - 170, C - 46, 80, 86], { angle: Math.PI / 2 + 0.1, gap: 4, w: 2.8, cross: true })
    // the door's planks and a keyhole, cut through
    ctx.fillStyle = '#efe3c8'
    ctx.beginPath()
    ctx.arc(C - 130, C + 2, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(C - 136, C + 6)
    ctx.lineTo(C - 124, C + 6)
    ctx.lineTo(C - 121, C + 28)
    ctx.lineTo(C - 139, C + 28)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = INK
    penCircle(ctx, C - 130, C + 2, 9, 1.6, rng)
    penLine(ctx, [C - 136, C + 8], [C - 139, C + 28], 1.4, rng)
    penLine(ctx, [C - 124, C + 8], [C - 121, C + 28], 1.4, rng)
    penLine(ctx, [C - 139, C + 28], [C - 121, C + 28], 1.4, rng)
    // wards: three teeth with notches, at the far end
    const wards: Pt[] = [[C + 90, C + 9, 1], [C + 90, C + 44, 1], [C + 104, C + 44, 1], [C + 104, C + 26, 1], [C + 114, C + 26, 1], [C + 114, C + 50, 1], [C + 132, C + 50, 1], [C + 132, C + 30, 1], [C + 140, C + 30, 1], [C + 140, C + 40, 1], [C + 150, C + 40, 1], [C + 150, C + 9, 1]]
    body(ctx, rng, wards, [C + 90, C + 9, 60, 42], { angle: 0.1, gap: 3.6, w: 2.2, cross: true })
    // wear on the shank: a bright edge left as paper
    ctx.fillStyle = '#faf6ea'
    ctx.beginPath()
    ctx.rect(C - 40, C - 8, 150, 3)
    ctx.fill()
    ctx.restore()
    // a tag on a cord, with the keeper's mark
    pen(ctx, [[C - 120, C - 98], [C - 160, C - 140], [C - 150, C - 190]], 1.6, rng)
    const tag: Pt[] = [[C - 180, C - 236, 1], [C - 120, C - 230, 1], [C - 124, C - 180, 1], [C - 184, C - 186, 1]]
    ctx.fillStyle = '#faf6ea'
    ctx.beginPath()
    region(tag, ctx)()
    ctx.fill()
    ctx.fillStyle = INK
    penShape(ctx, tag, 1.4, rng)
    disc(ctx, C - 150, C - 190, 3, rng)
    // the mark: a door, cracked
    penLine(ctx, [C - 166, C - 196], [C - 166, C - 222], 1.2, rng)
    penLine(ctx, [C - 138, C - 196], [C - 138, C - 222], 1.2, rng)
    pen(ctx, arcPts(C - 152, C - 222, 14, Math.PI, Math.PI * 2, 8), 1.2, rng, { w0: 1, w1: 1 })
    pen(ctx, [[C - 154, C - 232], [C - 150, C - 216], [C - 155, C - 200]], 1, rng, { smooth: 0 })
  },
  'item-shard': (ctx, rng) => {
    // a shard of the Ninth Stone: faceted, its broken edges lit from within
    tableShadow(ctx, rng, C + 16, 410, 120, 18)
    const outer: Pt[] = [[C - 20, 96, 1], [C + 64, 150, 1], [C + 106, 262, 1], [C + 70, 392, 1], [C - 36, 408, 1], [C - 110, 320, 1], [C - 92, 190, 1]]
    const r = body(ctx, rng, outer, [C - 110, 96, 216, 312], { angle: Math.PI / 3, gap: 5, w: 3, fade: 'start' })
    void r
    // facets: internal ridges from a central spine, each face hatched a different way
    const spine: Pt[] = [[C - 20, 96], [C - 6, 200], [C + 10, 300], [C - 36, 408]]
    const faces: { pts: Pt[]; angle: number; gap: number; fade?: 'start' | 'end'; alpha: number }[] = [
      { pts: [[C - 20, 96, 1], [C + 64, 150, 1], [C + 106, 262, 1], [C + 10, 300, 1], [C - 6, 200, 1]], angle: Math.PI / 2.5, gap: 5, fade: 'start', alpha: 0.55 },
      { pts: [[C + 106, 262, 1], [C + 70, 392, 1], [C - 36, 408, 1], [C + 10, 300, 1]], angle: -Math.PI / 5, gap: 4, fade: 'start', alpha: 0.9 },
      { pts: [[C - 20, 96, 1], [C - 6, 200, 1], [C - 92, 190, 1]], angle: Math.PI / 6, gap: 6, fade: 'end', alpha: 0.4 },
      { pts: [[C - 92, 190, 1], [C - 6, 200, 1], [C + 10, 300, 1], [C - 36, 408, 1], [C - 110, 320, 1]], angle: Math.PI / 2 - 0.3, gap: 7, fade: 'end', alpha: 0.35 },
    ]
    ctx.fillStyle = '#f1e7d0'
    ctx.beginPath()
    region(outer, ctx)()
    ctx.fill()
    ctx.fillStyle = INK
    for (const f of faces) hatch(ctx, region(f.pts, ctx), rng, { angle: f.angle, gap: f.gap, w: 0.9, box: [C - 110, 96, 216, 312], fade: f.fade, alpha: f.alpha })
    penShape(ctx, outer, 3, rng)
    for (let i = 0; i < spine.length - 1; i++) penLine(ctx, spine[i], spine[i + 1], 1.8, rng)
    penLine(ctx, [C - 6, 200], [C - 92, 190], 1.4, rng)
    penLine(ctx, [C + 10, 300], [C + 106, 262], 1.4, rng)
    // the glowing edge: the broken face along the left is left bright, with rays leaving it
    ctx.fillStyle = '#fbf8ee'
    pen(ctx, [[C - 92, 190], [C - 110, 320], [C - 36, 408]], 6, rng, { w0: 2, w1: 2, smooth: 0 })
    ctx.fillStyle = INK
    for (let i = 0; i < 18; i++) {
      const t = i / 17
      const x = C - 92 - 18 * Math.sin(Math.PI * t) * 1.4 + (t > 0.5 ? (t - 0.5) * 110 : 0)
      const y = 190 + t * 218
      const nx = t < 0.55 ? -1 : -0.5
      const ny = t < 0.55 ? 0.15 : 0.8
      const L = 18 + rng.next() * 36
      ctx.globalAlpha = 0.5
      penLine(ctx, [x + nx * 6, y + ny * 6], [x + nx * L, y + ny * L], 1, rng)
      ctx.globalAlpha = 1
    }
    // a fragment of Lithic glyph on the largest face
    const gx = C + 20
    const gy = 230
    penLine(ctx, [gx, gy - 24], [gx + 22, gy - 6], 1.6, rng)
    penLine(ctx, [gx + 22, gy - 6], [gx + 6, gy + 18], 1.6, rng)
    penLine(ctx, [gx - 10, gy], [gx + 22, gy - 6], 1.6, rng)
    penLine(ctx, [gx + 6, gy + 18], [gx + 30, gy + 26], 1.4, rng)
    disc(ctx, gx - 10, gy, 2.6, rng)
    // dust and chips around it on the table
    for (let i = 0; i < 30; i++) {
      const a = rng.next() * Math.PI * 2
      const d = 140 + rng.next() * 60
      const px = C + Math.cos(a) * d
      const py = 260 + Math.sin(a) * d * 0.7
      if (rng.chance(0.3)) shape(ctx, [[px, py], [px + 5, py - 3], [px + 7, py + 3]], rng)
      else disc(ctx, px, py, 0.8 + rng.next(), rng)
    }
  },
  'item-treaty': (ctx, rng) => {
    // the original treaty: a sealed scroll, ribbons and a heavy wax seal, two ends curling
    tableShadow(ctx, rng, C, 350, 190, 22)
    // the roll
    const roll: Pt[] = [[C - 170, 200, 1], [C + 170, 200, 1], [C + 170, 300, 1], [C - 170, 300, 1]]
    body(ctx, rng, roll, [C - 170, 200, 340, 100], { angle: 0, gap: 5, w: 2.2, fade: 'start', tone: '#f7f1e2' })
    // the ends: open spirals showing the rolled layers
    for (const s of [-1, 1]) {
      const ex = C + s * 170
      const er: Region = () => ctx.ellipse(ex, 250, 22, 50, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#f7f1e2'
      ctx.beginPath()
      er()
      ctx.fill()
      ctx.fillStyle = INK
      penCircle(ctx, ex, 250, 22, 2.4, rng, { ry: 50 })
      const sp: Pt[] = []
      for (let i = 0; i <= 30; i++) {
        const a = i * 0.4
        const rr = 1 + i * 0.6
        sp.push([ex + Math.cos(a) * rr, 250 + Math.sin(a) * rr * 2.1])
      }
      pen(ctx, sp, 1.2, rng, { smooth: 2, w0: 1.2, w1: 0.4 })
    }
    // a curl of the sheet lifting at the top edge with lines of text on it
    const sheet: Pt[] = [[C - 120, 200, 1], [C - 110, 150], [C - 60, 128], [C + 40, 126], [C + 110, 146], [C + 128, 200, 1]]
    ctx.fillStyle = '#faf6ea'
    ctx.beginPath()
    region(sheet, ctx)()
    ctx.fill()
    ctx.fillStyle = INK
    penShape(ctx, sheet, 1.8, rng, { smooth: 3 })
    for (let i = 0; i < 4; i++) {
      const y = 150 + i * 13
      const line: Pt[] = []
      for (let x = C - 90 + i * 2; x < C + 90 - (i === 3 ? 60 : 0); x += 5) line.push([x, y + rng.wob(1.5)])
      pen(ctx, line, 1.3, rng, { smooth: 2, w0: 1, w1: 1, noise: 0.7 })
    }
    // ribbons: two bands around the roll, hanging to the seal
    for (const x of [C - 10, C + 12]) {
      pen(ctx, [[x, 200], [x + 2, 250], [x, 300]], 7, rng, { w0: 7, w1: 7, smooth: 2 })
      ctx.fillStyle = '#f3ead4'
      pen(ctx, [[x, 204], [x + 2, 250], [x, 296]], 2.4, rng, { w0: 2.4, w1: 2.4, smooth: 2 })
      ctx.fillStyle = INK
    }
    pen(ctx, [[C, 300], [C - 14, 330], [C - 8, 360]], 6, rng, { w0: 6, w1: 5 })
    pen(ctx, [[C + 4, 300], [C + 20, 334], [C + 14, 362]], 6, rng, { w0: 6, w1: 5 })
    // the seal: a heavy disc of wax, cross-hatched dark, with nine lamps stamped in it
    const sx = C + 4
    const sy = 392
    const seal: Region = () => ctx.arc(sx, sy, 52, 0, Math.PI * 2)
    ctx.fillStyle = '#f1e7d0'
    ctx.beginPath()
    seal()
    ctx.fill()
    ctx.fillStyle = INK
    crossHatch(ctx, seal, rng, { angle: 0.3, gap: 4.5, w: 1, box: [sx - 52, sy - 52, 104, 104], fade: 'start', alpha: 0.75 })
    const wob: Pt[] = []
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const rr = 52 + rng.wob(4)
      wob.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr])
    }
    penShape(ctx, wob, 2.6, rng, { smooth: 4 })
    ctx.fillStyle = '#faf6ea'
    ctx.beginPath()
    ctx.arc(sx, sy, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = INK
    penCircle(ctx, sx, sy, 34, 1.8, rng)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      disc(ctx, sx + Math.cos(a) * 22, sy + Math.sin(a) * 22, 3, rng)
    }
    penLine(ctx, [sx, sy - 8], [sx, sy + 8], 2.6, rng)
    penLine(ctx, [sx - 6, sy + 8], [sx + 6, sy + 8], 1.8, rng)
    // signatures crowding the visible sheet edge: tiny scrawls
    for (let i = 0; i < 6; i++) {
      const x = C - 150 + i * 52
      const line: Pt[] = []
      for (let k = 0; k < 6; k++) line.push([x + k * 6, 282 + Math.sin(k * 1.7 + i) * 4])
      pen(ctx, line, 1.1, rng, { smooth: 2, w0: 0.6, w1: 0.4, noise: 0.5 })
    }
  },
}

// ---------- kinds of thing recognised from the key ----------

function dagger(ctx: Ctx, rng: Rng): void {
  ctx.save()
  ctx.translate(C, C)
  ctx.rotate(-0.7)
  ctx.translate(-C, -C)
  tableShadow(ctx, rng, C + 10, C + 34, 200, 14)
  // a broad single-edged blade with a fuller, a heavy cross guard, a bound grip and a round pommel
  const blade: Pt[] = [[C - 36, C - 22, 1], [C + 120, C - 20], [C + 196, C + 2, 1], [C + 120, C + 20], [C - 36, C + 22, 1]]
  const br = body(ctx, rng, blade, [C - 36, C - 22, 232, 44], { angle: 0.15, gap: 4, w: 2.8, smooth: 0, fade: 'end' })
  hatch(ctx, br, rng, { angle: Math.PI / 2 + 0.2, gap: 6, w: 0.8, box: [C - 36, C, 232, 22], alpha: 0.5, fade: 'start' })
  penLine(ctx, [C - 30, C - 8], [C + 130, C - 6], 1.6, rng)
  penLine(ctx, [C - 30, C + 8], [C + 130, C + 6], 1, rng)
  // nicks along the edge
  for (const x of [C + 40, C + 92, C + 150]) {
    ctx.fillStyle = '#efe3c8'
    shape(ctx, [[x - 4, C + 22], [x, C + 16], [x + 5, C + 22]], rng)
    ctx.fillStyle = INK
    pen(ctx, [[x - 4, C + 22], [x, C + 16], [x + 5, C + 22]], 1.2, rng, { smooth: 0, w0: 1, w1: 1 })
  }
  const guard: Pt[] = [[C - 36, C - 44, 1], [C - 20, C - 44, 1], [C - 22, C + 44, 1], [C - 38, C + 44, 1]]
  body(ctx, rng, guard, [C - 40, C - 44, 20, 88], { angle: 0.3, gap: 3, w: 2.4, cross: true })
  disc(ctx, C - 29, C - 44, 5, rng)
  disc(ctx, C - 30, C + 44, 5, rng)
  const grip: Pt[] = [[C - 38, C - 14, 1], [C - 130, C - 11, 1], [C - 130, C + 11, 1], [C - 38, C + 14, 1]]
  body(ctx, rng, grip, [C - 130, C - 14, 92, 28], { angle: Math.PI / 2.5, gap: 4, w: 2.2 })
  for (let i = 0; i < 8; i++) penLine(ctx, [C - 122 + i * 11, C - 12], [C - 118 + i * 11, C + 12], 1.4, rng)
  const pr: Region = () => ctx.arc(C - 144, C, 16, 0, Math.PI * 2)
  ctx.fillStyle = '#f3ead4'
  ctx.beginPath()
  pr()
  ctx.fill()
  ctx.fillStyle = INK
  crossHatch(ctx, pr, rng, { angle: 0.3, gap: 3.5, w: 0.8, box: [C - 160, C - 16, 32, 32], fade: 'start', alpha: 0.7 })
  penCircle(ctx, C - 144, C, 16, 2.6, rng)
  ctx.restore()
}

function coins(ctx: Ctx, rng: Rng): void {
  tableShadow(ctx, rng, C, C + 80, 150, 22)
  const stack: [number, number, number][] = [
    [C - 60, C + 40, 1],
    [C + 40, C + 60, 1.1],
    [C - 10, C - 10, 0.95],
    [C + 70, C - 20, 0.9],
    [C - 90, C - 30, 0.85],
  ]
  for (const [x, y, s] of stack) {
    const rr = 52 * s
    const er: Region = () => ctx.ellipse(x, y, rr, rr * 0.55, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#f7f1e2'
    ctx.beginPath()
    er()
    ctx.fill()
    ctx.fillStyle = INK
    stipple(ctx, er, rng, [x - rr, y - rr, rr * 2, rr * 2], 5, 0.9, (px, py) => Math.min(1, ((px - x) / rr + (py - y) / rr + 1) / 1.6))
    penCircle(ctx, x, y, rr, 2.4, rng, { ry: rr * 0.55 })
    penCircle(ctx, x, y, rr * 0.78, 1.1, rng, { ry: rr * 0.55 * 0.78 })
    const hex: Pt[] = []
    for (let i = 0; i < 6; i++) hex.push([x + Math.cos((i * Math.PI) / 3) * rr * 0.4, y + Math.sin((i * Math.PI) / 3) * rr * 0.22])
    for (let i = 0; i < 6; i++) penLine(ctx, hex[i], hex[(i + 1) % 6], 1.4, rng)
    // the edge, a sliver of milled rim
    pen(ctx, arcPts(x, y, rr, 0.1, Math.PI - 0.1, 12, rr * 0.55).map((p): Pt => [p[0], p[1] + 6]), 2.2, rng, { smooth: 2, w0: 0.4, w1: 0.4 })
  }
}

function keg(ctx: Ctx, rng: Rng): void {
  tableShadow(ctx, rng, C + 10, 420, 110, 18)
  const k: Pt[] = [[C - 80, 150, 1], [C - 100, 240], [C - 100, 320], [C - 80, 400, 1], [C + 80, 400, 1], [C + 100, 320], [C + 100, 240], [C + 80, 150, 1]]
  body(ctx, rng, k, [C - 100, 150, 200, 250], { angle: Math.PI / 2 + 0.05, gap: 5, w: 2.6, smooth: 3, fade: 'start' })
  for (const y of [180, 240, 320, 376]) {
    const half = y < 200 || y > 360 ? 86 : 100
    penLine(ctx, [C - half, y], [C + half, y], 4, rng)
    penLine(ctx, [C - half, y + 7], [C + half, y + 7], 1.4, rng)
  }
  for (const dx of [-50, -16, 20, 54]) penLine(ctx, [C + dx * 0.9, 150], [C + dx, 400], 1, rng)
  penCircle(ctx, C, 150, 80, 2.6, rng, { ry: 18 })
  // a fuse coiling out of the bung, and a stencilled mark
  disc(ctx, C + 10, 150, 8, rng)
  pen(ctx, [[C + 10, 146], [C + 30, 120], [C + 70, 118], [C + 100, 96], [C + 140, 100]], 2.6, rng, { w0: 2.6, w1: 1.2 })
  for (let i = 0; i < 8; i++) {
    const a = rng.next() * Math.PI * 2
    penLine(ctx, [C + 140, 100], [C + 140 + Math.cos(a) * 14, 100 + Math.sin(a) * 14], 1.4, rng)
  }
  penLine(ctx, [C - 30, 262], [C + 30, 262], 2.2, rng)
  penLine(ctx, [C - 30, 262], [C - 30, 300], 2.2, rng)
  penLine(ctx, [C - 30, 300], [C + 30, 300], 2.2, rng)
  for (let i = 0; i < 3; i++) penLine(ctx, [C - 20 + i * 20, 262], [C - 20 + i * 20, 300], 1.1, rng)
}

function book(ctx: Ctx, rng: Rng): void {
  tableShadow(ctx, rng, C + 10, 400, 180, 22)
  // a closed ledger seen from a corner: cover, spine, page block
  const cover: Pt[] = [[C - 150, 170, 1], [C + 110, 140, 1], [C + 150, 330, 1], [C - 110, 360, 1]]
  body(ctx, rng, cover, [C - 150, 140, 300, 220], { angle: Math.PI / 3, gap: 5, w: 2.6, fade: 'start' })
  const pages: Pt[] = [[C - 110, 360, 1], [C + 150, 330, 1], [C + 150, 350, 1], [C - 110, 380, 1]]
  ctx.fillStyle = '#faf6ea'
  ctx.beginPath()
  region(pages, ctx)()
  ctx.fill()
  ctx.fillStyle = INK
  penShape(ctx, pages, 2, rng)
  for (let i = 0; i < 9; i++) penLine(ctx, [C - 108, 364 + i * 1.8], [C + 148, 334 + i * 1.8], 0.6, rng)
  const spine: Pt[] = [[C - 150, 170, 1], [C - 110, 360, 1], [C - 110, 380, 1], [C - 150, 190, 1]]
  body(ctx, rng, spine, [C - 150, 170, 40, 210], { angle: 0.3, gap: 3.5, w: 2.2, cross: true })
  for (let i = 1; i < 4; i++) penLine(ctx, [C - 150 + i * 2, 180 + i * 40], [C - 110 + i * 2, 180 + i * 40 + 22 - 6], 2.6, rng)
  // a title plate and a clasp
  const plate: Pt[] = [[C - 60, 220, 1], [C + 50, 208, 1], [C + 58, 250, 1], [C - 52, 262, 1]]
  ctx.fillStyle = '#faf6ea'
  ctx.beginPath()
  region(plate, ctx)()
  ctx.fill()
  ctx.fillStyle = INK
  penShape(ctx, plate, 1.4, rng)
  for (let i = 0; i < 2; i++) {
    const line: Pt[] = []
    for (let x = C - 44; x < C + 36; x += 5) line.push([x, 234 + i * 12 - (x - C) * 0.1 + rng.wob(1.5)])
    pen(ctx, line, 1.2, rng, { smooth: 2, w0: 1, w1: 1, noise: 0.6 })
  }
  penLine(ctx, [C + 130, 236], [C + 160, 232], 5, rng)
  disc(ctx, C + 160, 232, 6, rng)
}

function bottle(ctx: Ctx, rng: Rng): void {
  tableShadow(ctx, rng, C + 10, 420, 70, 14)
  const b: Pt[] = [[C - 22, 120, 1], [C - 22, 200], [C - 64, 240], [C - 70, 400, 1], [C + 70, 400, 1], [C + 64, 240], [C + 22, 200], [C + 22, 120, 1]]
  body(ctx, rng, b, [C - 70, 120, 140, 280], { angle: Math.PI / 2 + 0.06, gap: 5, w: 2.6, smooth: 2, fade: 'start' })
  ctx.fillStyle = '#faf6ea'
  pen(ctx, [[C - 50, 260], [C - 54, 380]], 6, rng, { w0: 2, w1: 2 })
  ctx.fillStyle = INK
  // liquid level and sediment
  const lq: Region = () => {
    ctx.moveTo(C - 66, 300)
    ctx.lineTo(C + 66, 300)
    ctx.lineTo(C + 70, 400)
    ctx.lineTo(C - 70, 400)
    ctx.closePath()
  }
  hatch(ctx, lq, rng, { angle: 0, gap: 4, w: 0.9, box: [C - 70, 300, 140, 100], alpha: 0.7, fade: 'start' })
  pen(ctx, [[C - 66, 300], [C - 20, 296], [C + 20, 304], [C + 66, 300]], 1.6, rng, { w0: 1.4, w1: 1.4 })
  stipple(ctx, () => ctx.rect(C - 66, 370, 132, 30), rng, [C - 66, 370, 132, 30], 10, 1)
  // cork, wax drips, a label on a string
  const cork: Pt[] = [[C - 18, 122, 1], [C - 20, 90, 1], [C + 20, 90, 1], [C + 18, 122, 1]]
  body(ctx, rng, cork, [C - 20, 90, 40, 32], { angle: Math.PI / 2, gap: 4, w: 2 })
  for (const dx of [-26, 10, 24]) pen(ctx, [[C + dx, 124], [C + dx + 2, 140 + Math.abs(dx)]], 5, rng, { w0: 5, w1: 2 })
  pen(ctx, [[C + 22, 190], [C + 60, 210], [C + 100, 200]], 1.2, rng)
  const tag: Pt[] = [[C + 96, 180, 1], [C + 150, 176, 1], [C + 152, 216, 1], [C + 98, 220, 1]]
  ctx.fillStyle = '#faf6ea'
  ctx.beginPath()
  region(tag, ctx)()
  ctx.fill()
  ctx.fillStyle = INK
  penShape(ctx, tag, 1.4, rng)
  pen(ctx, [[C + 106, 196], [C + 120, 192], [C + 140, 198]], 1.2, rng, { w0: 1, w1: 1, noise: 0.6 })
}

const KINDS: [RegExp, Item][] = [
  [/sword|blade|knife|dagger|dirk|stiletto|cleaver|sabre|saber/, dagger],
  [/coin|purse|silver|gold|pay|wage|strongbox|chest/, coins],
  [/powder|bomb|charge|munition|grenade|keg|petard|fuse|firepot|flash/, keg],
  [/ledger|book|letter|journal|diary|codex|tome|contract|deed|charter|writ|form/, book],
  [/bottle|flask|potion|vial|phial|wine|spirit|tonic|draught|oil|ink/, bottle],
  [/key/, ITEMS['item-door-key']],
  [/lantern|lamp|candle|torch/, ITEMS['item-lantern']],
  [/shard|stone|glass|relic|crystal/, ITEMS['item-shard']],
  [/scroll|treaty|map|chart/, ITEMS['item-treaty']],
]

/** The sketch for an item key, or nothing for a thing it does not know how to draw. */
export function drawItem(name: string): ((ctx: Ctx, w: number, h: number) => void) | undefined {
  const item = ITEMS[name] ?? KINDS.find(([re]) => re.test(name.toLowerCase()))?.[1]
  if (!item) return undefined
  return (ctx, w, h) => {
    const rng = new Rng(seedOf('item:' + name))
    parchment(ctx, w, h, rng, { age: 0.45, vignette: 0.2 })
    ctx.fillStyle = INK
    item(ctx, rng)
  }
}
