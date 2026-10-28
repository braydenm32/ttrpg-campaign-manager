/**
 * The world cover: Cinderford's grey stone and the Lantern Keep on its hill above the ford, one
 * lantern burning, ash plains beyond and the red moon low in the sky. An engraving on parchment;
 * the moon's muted red wash is the only colour. The lower left is kept quiet for text.
 */
import { INK, PAPER, RED_WASH, Rng, disc, hatch, parchment, pen, penCircle, penLine, shape, stipple, type Ctx, type Pt } from './ink'

type Region = () => void

const W = 1600
const H = 900
const HORIZON = 520
const MOON: [number, number, number] = [1190, 236, 92]

/** The sky: horizontal engraving lines, close and dark at the top, opening out towards the horizon, broken around the moon. */
function sky(ctx: Ctx, rng: Rng): void {
  const [mx, my, mr] = MOON
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, W, HORIZON)
  ctx.arc(mx, my, mr + 26, 0, Math.PI * 2, true)
  ctx.clip('evenodd')
  ctx.fillStyle = INK
  let y = 6
  let i = 0
  while (y < HORIZON) {
    const t = y / HORIZON
    const gap = 5 + t * t * 26
    const alpha = Math.max(0.08, 0.9 - t * 1.05)
    ctx.globalAlpha = alpha
    const line: Pt[] = []
    for (let x = -20; x <= W + 20; x += 80) line.push([x, y + Math.sin(x / 260 + i * 0.7) * (1.5 + t * 4) + rng.wob(0.8)])
    pen(ctx, line, 1.1 + (1 - t) * 0.9, rng, { smooth: 3, w0: 0.3, w1: 0.3, noise: 0.4 })
    // a second, broken line between, high in the sky, for a darker night
    if (t < 0.45 && i % 2 === 0) {
      ctx.globalAlpha = alpha * 0.5
      const x0 = rng.range(0, W * 0.5)
      const x1 = x0 + rng.range(200, 700)
      pen(ctx, [[x0, y + gap / 2], [(x0 + x1) / 2, y + gap / 2 + rng.wob(2)], [x1, y + gap / 2]], 0.8, rng, { w0: 0.2, w1: 0.2 })
    }
    y += gap
    i++
  }
  ctx.globalAlpha = 1
  ctx.restore()
  // a few stars left as pin-pricks of paper in the upper sky
  ctx.fillStyle = PAPER
  for (let k = 0; k < 40; k++) {
    const sx = rng.range(20, W - 20)
    const sy = rng.range(10, HORIZON * 0.5)
    if (Math.hypot(sx - mx, sy - my) < mr + 80) continue
    disc(ctx, sx, sy, 1 + rng.next() * 1.6, rng)
  }
  // the moon's halo: faint rings
  ctx.fillStyle = INK
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = 0.18 - k * 0.05
    penCircle(ctx, mx, my, mr + 40 + k * 26, 1, rng, { wobble: 1.5 })
  }
  ctx.globalAlpha = 1
}

/** The Ember: the red moon, washed in muted red and engraved with seas and a rim. */
function moon(ctx: Ctx, rng: Rng): void {
  const [mx, my, mr] = MOON
  const face: Region = () => ctx.arc(mx, my, mr, 0, Math.PI * 2)
  ctx.fillStyle = '#f2e6cc'
  ctx.beginPath()
  face()
  ctx.fill()
  ctx.fillStyle = RED_WASH
  ctx.beginPath()
  face()
  ctx.fill()
  ctx.fillStyle = INK
  // the seas: patches of denser hatching
  const seas: [number, number, number, number][] = [
    [mx - 30, my - 20, 34, 22],
    [mx + 18, my + 12, 40, 28],
    [mx - 10, my + 44, 26, 14],
    [mx + 40, my - 36, 18, 14],
  ]
  for (const [sx, sy, rx, ry] of seas) {
    hatch(ctx, () => ctx.ellipse(sx, sy, rx, ry, 0.3, 0, Math.PI * 2), rng, { angle: 0.1, gap: 3.2, w: 0.8, box: [sx - rx, sy - ry, rx * 2, ry * 2], alpha: 0.5 })
  }
  // the whole face, lightly, darker toward the lower-left limb
  hatch(ctx, face, rng, { angle: 0.05, gap: 4, w: 0.7, box: [mx - mr, my - mr, mr * 2, mr * 2], alpha: 0.35, fade: 'end' })
  hatch(ctx, face, rng, { angle: Math.PI / 3, gap: 5, w: 0.7, box: [mx - mr, my - mr, mr * 2, mr * 2], alpha: 0.3, fade: 'end' })
  penCircle(ctx, mx, my, mr, 2.6, rng, { wobble: 0.8 })
  // craters: small rings
  for (const [cx, cy, r] of [
    [mx + 48, my + 44, 7],
    [mx - 56, my + 30, 5],
    [mx + 10, my - 60, 4],
    [mx - 20, my + 10, 3],
  ]) {
    ctx.globalAlpha = 0.6
    penCircle(ctx, cx, cy, r, 1, rng)
    ctx.globalAlpha = 1
  }
}

/** The ash plains beyond the river: a flat horizon, drifts of ash, stipple fading into distance. */
function plains(ctx: Ctx, rng: Rng): void {
  ctx.fillStyle = INK
  // the horizon line
  ctx.globalAlpha = 0.7
  pen(ctx, [[0, HORIZON], [400, HORIZON + 2], [800, HORIZON - 2], [1200, HORIZON + 1], [W, HORIZON - 1]], 1.2, rng, { smooth: 2, w0: 0.5, w1: 0.5 })
  ctx.globalAlpha = 1
  // dunes: low curves with hatching on their lee sides
  for (let i = 0; i < 9; i++) {
    const y = HORIZON + 12 + i * 14 + i * i * 1.2
    const x0 = rng.range(-100, W * 0.6)
    const len = rng.range(260, 700)
    const line: Pt[] = []
    for (let k = 0; k <= 8; k++) line.push([x0 + (len * k) / 8, y - Math.sin((k / 8) * Math.PI) * (4 + i * 1.2)])
    ctx.globalAlpha = 0.4 + i * 0.05
    pen(ctx, line, 1.1, rng, { smooth: 3, w0: 0.2, w1: 0.2 })
    for (let k = 1; k < 8; k += 1) {
      const p = line[k]
      penLine(ctx, [p[0], p[1] + 1], [p[0] + 10 + i, p[1] + 5 + i * 0.8], 0.7, rng)
    }
    ctx.globalAlpha = 1
  }
  // stipple thickening toward the foreground, sparse on the left where text goes
  stipple(ctx, () => ctx.rect(0, HORIZON, W, H - HORIZON), rng, [0, HORIZON, W, H - HORIZON], 1.1, 0.8, (x, y) => {
    const d = (y - HORIZON) / (H - HORIZON)
    const left = x < 600 && y > 640 ? 0.25 : 1
    return Math.min(1, 0.15 + d * 0.9) * left
  })
  // a greywind: a drift of ash blowing across the far plain
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 6; i++) {
    const y = HORIZON + 30 + i * 9
    const x0 = 1250 + i * 30
    pen(ctx, [[x0, y], [x0 + 120, y - 6], [x0 + 260, y - 4], [x0 + 380, y - 10]], 0.9, rng, { smooth: 3, w0: 0.1, w1: 0.1 })
  }
  ctx.globalAlpha = 1
}

/** The river Cinder, bending in from the far left and running out under the right foreground. */
function river(ctx: Ctx, rng: Rng): void {
  // banks: the left bank sweeps from the horizon down to the lower right; the right bank hugs the town's foot
  const left: Pt[] = [[330, HORIZON + 2], [360, 600], [470, 700], [640, 790], [900, 870], [1080, H + 20]]
  const right: Pt[] = [[380, HORIZON + 2], [460, 580], [640, 650], [860, 700], [1150, 760], [1420, 830], [1600, 880], [1600, H + 20]]
  const at = (line: Pt[], t: number): Pt => {
    const seg = Math.min(line.length - 2, Math.floor(t * (line.length - 1)))
    const f = t * (line.length - 1) - seg
    const a = line[seg]
    const b = line[seg + 1]
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  }
  const region: Region = () => {
    left.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1])
    ctx.closePath()
  }
  ctx.fillStyle = '#e2d3b0'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  ctx.save()
  ctx.beginPath()
  region()
  ctx.clip()
  // water: close-set lines running with the current, darker along both banks and in the near reaches
  for (let i = 0; i < 160; i++) {
    const t = (i / 160) ** 1.35
    const l0 = at(left, t)
    const r0 = at(right, t)
    const l1 = at(left, Math.min(1, t + 0.02))
    const r1 = at(right, Math.min(1, t + 0.02))
    const dx = l1[0] - l0[0] + (r1[0] - r0[0])
    const dy = l1[1] - l0[1] + (r1[1] - r0[1])
    const L = Math.hypot(dx, dy) || 1
    const across = Math.hypot(r0[0] - l0[0], r0[1] - l0[1])
    const n = Math.max(2, Math.round(across / 14))
    for (let k = 0; k < n; k++) {
      const u = (k + rng.next()) / n
      const px = l0[0] + (r0[0] - l0[0]) * u
      const py = l0[1] + (r0[1] - l0[1]) * u
      const edge = Math.min(u, 1 - u)
      if (rng.next() > 0.35 + (1 - edge * 2) * 0.6) continue
      const len = (18 + rng.next() * 60) * (0.5 + t)
      ctx.globalAlpha = 0.22 + (1 - edge * 2) * 0.4 + t * 0.15
      pen(ctx, [[px, py], [px + (dx / L) * len * 0.5 + rng.wob(2), py + (dy / L) * len * 0.5 + rng.wob(2)], [px + (dx / L) * len, py + (dy / L) * len]], 0.7 + t * 1.1, rng, { w0: 0.15, w1: 0.15, smooth: 2 })
    }
  }
  // a darker band under each bank
  for (const [line, side] of [
    [left, 1],
    [right, -1],
  ] as const) {
    for (let i = 0; i < 90; i++) {
      const t = 0.08 + rng.next() * 0.92
      const p = at(line, t)
      const q = at(line, Math.min(1, t + 0.02))
      const dx = q[0] - p[0]
      const dy = q[1] - p[1]
      const L = Math.hypot(dx, dy) || 1
      const nx = (-dy / L) * side
      const ny = (dx / L) * side
      const off = 2 + rng.next() * 10 * (0.5 + t)
      const len = 10 + rng.next() * 30
      ctx.globalAlpha = 0.5
      pen(ctx, [[p[0] + nx * off, p[1] + ny * off], [p[0] + nx * off + (dx / L) * len, p[1] + ny * off + (dy / L) * len]], 0.8, rng, { w0: 0.1, w1: 0.1 })
    }
  }
  // the moon's reflection: a broken column of short dashes in the water under it
  const [mx] = MOON
  for (let k = 0; k < 22; k++) {
    const y = 700 + k * 9 + rng.wob(2)
    const w = 10 + rng.next() * 26 + k * 1.5
    const x = mx + 120 + rng.wob(14) + k * 6
    ctx.globalAlpha = 0.6
    penLine(ctx, [x - w / 2, y], [x + w / 2, y], 1.6, rng)
  }
  // the lantern's reflection: a thin bright streak
  ctx.fillStyle = PAPER
  ctx.globalAlpha = 0.85
  for (let k = 0; k < 10; k++) penLine(ctx, [1010 + k * 2 + rng.wob(3), 720 + k * 10], [1024 + k * 2 + rng.wob(3), 722 + k * 10], 2.4, rng)
  ctx.globalAlpha = 1
  ctx.fillStyle = INK
  ctx.restore()
  // banks
  pen(ctx, left, 1.8, rng, { smooth: 5, w0: 0.4, w1: 1.6, noise: 0.5 })
  pen(ctx, right, 1.6, rng, { smooth: 5, w0: 0.4, w1: 1.4, noise: 0.5 })
  // hatching under the near bank
  for (let i = 0; i < 40; i++) {
    const p = at(left, 0.35 + rng.next() * 0.65)
    ctx.globalAlpha = 0.5
    penLine(ctx, [p[0] - 4, p[1] - 2], [p[0] - 18 - rng.next() * 14, p[1] + 6 + rng.next() * 6], 0.9, rng)
    ctx.globalAlpha = 1
  }
  // the ford: a paved crossing with stones showing, from the road to the town gate
  const fy0 = 690
  const fx0 = 480
  const fx1 = 700
  for (let k = 0; k < 14; k++) {
    const t = k / 13
    const x = fx0 + (fx1 - fx0) * t
    const y = fy0 + t * -30 + Math.sin(t * Math.PI) * 6
    const stone: Pt[] = [[x - 8, y - 3], [x + 8, y - 4], [x + 9, y + 3], [x - 7, y + 4]]
    ctx.fillStyle = '#efe3c8'
    shape(ctx, stone, rng)
    ctx.fillStyle = INK
    pen(ctx, stone, 1, rng, { closed: true, smooth: 3, noise: 0.3 })
    ctx.globalAlpha = 0.6
    penLine(ctx, [x - 10, y + 6], [x + 12, y + 7], 0.9, rng)
    ctx.globalAlpha = 1
  }
  // ripples around the stones
  ctx.globalAlpha = 0.45
  for (let k = 0; k < 10; k++) pen(ctx, [[fx0 + k * 18, fy0 + 14 - k * 2], [fx0 + k * 18 + 10, fy0 + 12 - k * 2], [fx0 + k * 18 + 20, fy0 + 15 - k * 2]], 0.8, rng, { smooth: 2 })
  ctx.globalAlpha = 1
  // the road from the left, faint, leading to the ford
  ctx.globalAlpha = 0.45
  pen(ctx, [[0, 790], [160, 770], [320, 740], [470, 700]], 1.2, rng, { smooth: 4, w0: 0.2, w1: 0.8 })
  pen(ctx, [[0, 812], [170, 790], [330, 758], [472, 712]], 1, rng, { smooth: 4, w0: 0.2, w1: 0.8 })
  ctx.globalAlpha = 1
}

/** Lantern Hill: a long hill above the town with the Keep on top, contour-hatched down its flanks. */
function hill(ctx: Ctx, rng: Rng): void {
  const crest: Pt[] = [[640, 650], [720, 560], [820, 470], [920, 410], [1000, 384], [1060, 380], [1140, 396], [1230, 430], [1330, 480], [1440, 540], [1560, 600], [1600, 620]]
  const region: Region = () => {
    ctx.moveTo(600, 760)
    crest.forEach((p) => ctx.lineTo(p[0], p[1]))
    ctx.lineTo(1600, 760)
    ctx.closePath()
  }
  ctx.fillStyle = '#eadcbd'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  // contour strokes following the slopes, denser on the left (shadowed) flank
  ctx.save()
  ctx.beginPath()
  region()
  ctx.clip()
  for (let i = 0; i < 260; i++) {
    const t = rng.next()
    const seg = Math.min(crest.length - 2, Math.floor(t * (crest.length - 1)))
    const f = t * (crest.length - 1) - seg
    const a = crest[seg]
    const b = crest[seg + 1]
    const x = a[0] + (b[0] - a[0]) * f + rng.wob(20)
    const y0 = a[1] + (b[1] - a[1]) * f + rng.range(6, 240)
    if (y0 > 760) continue
    const slopeX = (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1])
    const slopeY = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1])
    const L = 14 + rng.next() * 40
    const shadow = x < 1040 ? 0.55 : 0.3
    ctx.globalAlpha = shadow * (1 - (y0 - 400) / 500)
    pen(ctx, [[x, y0], [x + slopeX * L * 0.5 + rng.wob(3), y0 + slopeY * L * 0.5 + 3], [x + slopeX * L, y0 + slopeY * L + 6]], 1, rng, { w0: 0.2, w1: 0.2, smooth: 2 })
  }
  // rocks and scrub
  for (let i = 0; i < 24; i++) {
    const x = rng.range(760, 1560)
    const y = rng.range(470, 720)
    ctx.globalAlpha = 0.6
    shape(ctx, [[x, y], [x + 6 + rng.next() * 6, y - 3 - rng.next() * 4], [x + 12 + rng.next() * 8, y + 1], [x + 6, y + 3]], rng)
  }
  ctx.globalAlpha = 1
  ctx.restore()
  pen(ctx, crest, 2, rng, { smooth: 4, w0: 0.6, w1: 0.6, noise: 0.5 })
}

/** A square tower with battlements and a hatched shadow side. */
function tower(ctx: Ctx, rng: Rng, x: number, base: number, w: number, h: number, crenels = 5): void {
  const top = base - h
  const r: Region = () => ctx.rect(x, top, w, h)
  ctx.fillStyle = '#e6d8b8'
  ctx.beginPath()
  r()
  ctx.fill()
  ctx.fillStyle = INK
  // the left face in shadow: vertical hatching, fading to the right
  hatch(ctx, () => ctx.rect(x, top, w * 0.55, h), rng, { angle: Math.PI / 2, gap: 3.2, w: 0.8, box: [x, top, w * 0.55, h], fade: 'end', alpha: 0.85 })
  // stone courses, broken
  for (let y = top + 10; y < base; y += 11) {
    const x0 = x + rng.range(0, w * 0.3)
    const x1 = x0 + rng.range(w * 0.2, w * 0.7)
    ctx.globalAlpha = 0.35
    penLine(ctx, [x0, y], [Math.min(x + w, x1), y], 0.7, rng)
    ctx.globalAlpha = 1
  }
  penLine(ctx, [x, top], [x, base], 1.8, rng)
  penLine(ctx, [x + w, top], [x + w, base], 1.4, rng)
  // battlements
  const cw = w / (crenels * 2 - 1)
  for (let i = 0; i < crenels; i++) {
    const cx = x + i * cw * 2
    const pts: Pt[] = [[cx, top, 1], [cx, top - cw * 1.1, 1], [cx + cw, top - cw * 1.1, 1], [cx + cw, top, 1]]
    ctx.fillStyle = '#e6d8b8'
    ctx.fillRect(cx, top - cw * 1.1, cw, cw * 1.1)
    ctx.fillStyle = INK
    for (let k = 0; k < 3; k++) penLine(ctx, pts[k], pts[k + 1], 1.4, rng)
    if (cx < x + w * 0.55) hatch(ctx, () => ctx.rect(cx, top - cw * 1.1, cw, cw * 1.1), rng, { angle: Math.PI / 2, gap: 3, w: 0.7, box: [cx, top - cw * 1.1, cw, cw * 1.1], alpha: 0.7 })
  }
  penLine(ctx, [x, top], [x + w, top], 1.2, rng)
  // arrow slits
  for (let k = 0; k < Math.max(1, Math.floor(h / 40)); k++) {
    const sy = top + 24 + k * 36
    if (sy > base - 14) break
    penLine(ctx, [x + w * 0.72, sy], [x + w * 0.72, sy + 12], 2.2, rng)
  }
}

/** The Lantern Keep on the hilltop, and its lantern in an iron cage, lit. */
function keep(ctx: Ctx, rng: Rng): void {
  // curtain wall along the crest
  const wallY = 400
  const wall: Pt[] = [[900, wallY + 10, 1], [1180, wallY, 1], [1180, wallY + 46, 1], [900, wallY + 56, 1]]
  ctx.fillStyle = '#e6d8b8'
  ctx.beginPath()
  wall.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = INK
  hatch(
    ctx,
    () => {
      wall.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
    },
    rng,
    { angle: Math.PI / 2, gap: 3.4, w: 0.7, box: [900, wallY, 280, 60], alpha: 0.45, fade: 'end' },
  )
  for (let i = 0; i < 4; i++) penLine(ctx, wall[i], wall[(i + 1) % 4], 1.2, rng)
  for (let i = 0; i < 16; i++) {
    const x = 902 + i * 17.5
    const y = wallY + 10 - (i / 16) * 10
    ctx.fillStyle = '#e6d8b8'
    ctx.fillRect(x, y - 7, 8, 7)
    ctx.fillStyle = INK
    penLine(ctx, [x, y], [x, y - 7], 1, rng)
    penLine(ctx, [x, y - 7], [x + 8, y - 7], 1, rng)
    penLine(ctx, [x + 8, y - 7], [x + 8, y], 1, rng)
  }
  // towers: a lesser one each end, the great keep in the middle
  tower(ctx, rng, 880, wallY + 56, 44, 110, 3)
  tower(ctx, rng, 1160, wallY + 46, 40, 96, 3)
  tower(ctx, rng, 990, wallY + 50, 90, 190, 5)
  // the keep's roof: a low pyramid behind the battlements, and the lantern cage on its peak
  const kx = 1035
  const roofY = wallY + 50 - 190 - 14
  shape(ctx, [[996, roofY + 6], [kx, roofY - 34, 1], [1074, roofY + 6]], rng)
  // the lantern: its glow first (paper), then the cage, then rays
  const lx = kx
  const ly = roofY - 56
  const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70)
  g.addColorStop(0, 'rgba(252, 248, 236, 1)')
  g.addColorStop(0.35, 'rgba(252, 248, 236, 0.75)')
  g.addColorStop(1, 'rgba(252, 248, 236, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(lx, ly, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = INK
  penLine(ctx, [lx, roofY - 34], [lx, ly + 14], 2.4, rng)
  const cage: Pt[] = [[lx - 9, ly - 12, 1], [lx + 9, ly - 12, 1], [lx + 7, ly + 12, 1], [lx - 7, ly + 12, 1]]
  for (let i = 0; i < 4; i++) penLine(ctx, cage[i], cage[(i + 1) % 4], 1.6, rng)
  penLine(ctx, [lx, ly - 12], [lx, ly + 12], 1, rng)
  shape(ctx, [[lx - 12, ly - 12], [lx, ly - 20], [lx + 12, ly - 12]], rng)
  // the flame
  shape(ctx, [[lx, ly - 9, 1], [lx + 4, ly - 2], [lx + 2, ly + 6], [lx - 3, ly + 6], [lx - 4, ly - 2]], rng)
  // rays
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + rng.wob(0.05)
    const r0 = 22 + rng.range(0, 10)
    const r1 = r0 + 16 + rng.range(0, 30) * (i % 2 ? 1.6 : 1)
    ctx.globalAlpha = 0.55
    penLine(ctx, [lx + Math.cos(a) * r0, ly + Math.sin(a) * r0], [lx + Math.cos(a) * r1, ly + Math.sin(a) * r1], 0.9, rng)
    ctx.globalAlpha = 1
  }
}

/** The town: grey stone houses stacked down the hill's western flank to the ford, a bell tower at the bridge. */
function town(ctx: Ctx, rng: Rng): void {
  interface House {
    x: number
    y: number
    w: number
    h: number
    roof: number
    gable: boolean
    chimney: boolean
  }
  const houses: House[] = []
  // the quay wall runs from the gate at (700, 690) along the water; rows of houses climb from it toward the keep
  const quay = (x: number) => 690 + (x - 700) * 0.073
  const rows: [number, number, number, number][] = [
    // [lift above the quay, first x, last x, scale]
    [186, 900, 1000, 0.5],
    [150, 850, 1010, 0.62],
    [112, 790, 1000, 0.78],
    [72, 740, 990, 0.95],
    [34, 690, 980, 1.15],
    [0, 660, 960, 1.35],
  ]
  for (const [lift, x0, x1, s] of rows) {
    let x = x0 + rng.range(0, 14)
    while (x < x1) {
      const w = (24 + rng.next() * 30) * s
      const h = (20 + rng.next() * 22) * s
      houses.push({ x, y: quay(x) - lift * s * 0.9, w, h, roof: (10 + rng.next() * 12) * s, gable: rng.chance(0.5), chimney: rng.chance(0.4) })
      x += w + rng.range(-4, 6)
    }
  }
  houses.sort((a, b) => a.y - b.y)
  for (const hs of houses) {
    const top = hs.y - hs.h
    // the roof first, so it covers the houses behind
    if (hs.gable) {
      const r: Region = () => {
        ctx.moveTo(hs.x - 3, top + 1)
        ctx.lineTo(hs.x + hs.w / 2, top - hs.roof)
        ctx.lineTo(hs.x + hs.w + 3, top + 1)
        ctx.closePath()
      }
      ctx.fillStyle = '#e3d4b2'
      ctx.beginPath()
      r()
      ctx.fill()
      ctx.fillStyle = INK
      hatch(ctx, r, rng, { angle: Math.PI / 2 + 0.5, gap: 2.6, w: 0.6, box: [hs.x - 3, top - hs.roof, hs.w + 6, hs.roof + 2], alpha: 0.7, fade: 'end' })
      penLine(ctx, [hs.x - 3, top + 1], [hs.x + hs.w / 2, top - hs.roof], 1.3, rng)
      penLine(ctx, [hs.x + hs.w / 2, top - hs.roof], [hs.x + hs.w + 3, top + 1], 1.1, rng)
    } else {
      const r: Region = () => {
        ctx.moveTo(hs.x - 3, top + 1)
        ctx.lineTo(hs.x + 4, top - hs.roof)
        ctx.lineTo(hs.x + hs.w - 4, top - hs.roof)
        ctx.lineTo(hs.x + hs.w + 3, top + 1)
        ctx.closePath()
      }
      ctx.fillStyle = '#e3d4b2'
      ctx.beginPath()
      r()
      ctx.fill()
      ctx.fillStyle = INK
      hatch(ctx, r, rng, { angle: 0.12, gap: 2.4, w: 0.6, box: [hs.x - 3, top - hs.roof, hs.w + 6, hs.roof + 2], alpha: 0.8 })
      penLine(ctx, [hs.x - 3, top + 1], [hs.x + 4, top - hs.roof], 1.1, rng)
      penLine(ctx, [hs.x + 4, top - hs.roof], [hs.x + hs.w - 4, top - hs.roof], 1.2, rng)
      penLine(ctx, [hs.x + hs.w - 4, top - hs.roof], [hs.x + hs.w + 3, top + 1], 1.1, rng)
    }
    // the walls
    ctx.fillStyle = '#e3d4b2'
    ctx.fillRect(hs.x, top, hs.w, hs.h)
    ctx.fillStyle = INK
    hatch(ctx, () => ctx.rect(hs.x, top, hs.w * 0.55, hs.h), rng, { angle: Math.PI / 2, gap: 2.8, w: 0.6, box: [hs.x, top, hs.w * 0.55, hs.h], fade: 'end', alpha: 0.75 })
    penLine(ctx, [hs.x, top], [hs.x, hs.y], 1.3, rng)
    penLine(ctx, [hs.x + hs.w, top], [hs.x + hs.w, hs.y], 0.9, rng)
    penLine(ctx, [hs.x, hs.y], [hs.x + hs.w, hs.y], 1, rng)
    penLine(ctx, [hs.x - 3, top + 1], [hs.x + hs.w + 3, top + 1], 0.9, rng)
    // windows, a door on the nearer rows, a chimney with a thread of smoke
    if (hs.h > 18) {
      const wy = top + hs.h * 0.3
      ctx.fillRect(hs.x + hs.w * 0.66, wy, 3, 5)
      if (hs.w > 34) ctx.fillRect(hs.x + hs.w * 0.34, wy, 3, 5)
      if (hs.h > 34 && hs.w > 40) {
        ctx.fillRect(hs.x + hs.w * 0.62, hs.y - 10, 5, 10)
      }
    }
    if (hs.chimney) {
      const cx = hs.x + hs.w * 0.72
      ctx.fillRect(cx, top - hs.roof - 5, 4, hs.roof + 3)
      ctx.globalAlpha = 0.5
      pen(ctx, [[cx + 2, top - hs.roof - 7], [cx - 2, top - hs.roof - 17], [cx + 4, top - hs.roof - 27]], 1, rng, { w0: 1, w1: 0.1 })
      ctx.globalAlpha = 1
    }
  }
  // the Treaty Bell tower at the ford, and the gatehouse
  tower(ctx, rng, 700, 692, 32, 100, 2)
  ctx.fillStyle = INK
  ctx.fillRect(710, 616, 12, 18)
  ctx.fillStyle = '#e3d4b2'
  ctx.fillRect(712, 618, 8, 9)
  ctx.fillStyle = INK
  disc(ctx, 716, 628, 2.6, rng)
  shape(ctx, [[694, 592], [716, 572, 1], [738, 592]], rng)
  // the gate arch where the ford meets the town
  ctx.fillStyle = '#e3d4b2'
  ctx.fillRect(734, 660, 36, 32)
  ctx.fillStyle = INK
  hatch(ctx, () => ctx.rect(734, 660, 36, 32), rng, { angle: Math.PI / 2, gap: 2.8, w: 0.6, box: [734, 660, 36, 32], alpha: 0.5, fade: 'end' })
  penLine(ctx, [734, 660], [770, 660], 1.2, rng)
  penLine(ctx, [770, 660], [770, 692], 1, rng)
  ctx.beginPath()
  ctx.arc(752, 692, 9, Math.PI, Math.PI * 2)
  ctx.fill()
  // the quay wall along the water, with its parapet
  const wallR: Region = () => {
    ctx.moveTo(700, 684)
    ctx.lineTo(1000, 706)
    ctx.lineTo(1000, 716)
    ctx.lineTo(700, 694)
    ctx.closePath()
  }
  ctx.fillStyle = '#e3d4b2'
  ctx.beginPath()
  wallR()
  ctx.fill()
  ctx.fillStyle = INK
  hatch(ctx, wallR, rng, { angle: 0.07, gap: 3, w: 0.6, box: [700, 684, 300, 32], alpha: 0.6 })
  penLine(ctx, [700, 684], [1000, 706], 1.4, rng)
  penLine(ctx, [700, 694], [1000, 716], 1, rng)
  for (let i = 0; i < 26; i++) {
    const x = 704 + i * 11.5
    const y = 684 + ((x - 700) / 300) * 22
    ctx.fillRect(x, y - 5, 5, 5)
  }
  // lamps along the quay: pin-pricks of light
  for (const x of [790, 880, 960]) {
    const y = 684 + ((x - 700) / 300) * 22 - 8
    ctx.fillStyle = PAPER
    disc(ctx, x, y, 3, rng)
    ctx.fillStyle = INK
    penCircle(ctx, x, y, 3, 0.8, rng)
    penLine(ctx, [x, y + 3], [x, y + 12], 1.2, rng)
  }
}

/** Near foreground on the right: the river's near bank, reeds, a stump of a milestone. */
function foreground(ctx: Ctx, rng: Rng): void {
  ctx.fillStyle = INK
  // reeds in the lower right corner
  for (let i = 0; i < 40; i++) {
    const x = 1180 + rng.next() * 400
    const y = 860 + rng.next() * 60
    const h = 40 + rng.next() * 90
    ctx.globalAlpha = 0.7
    pen(ctx, [[x, y], [x + rng.wob(6), y - h * 0.5], [x + rng.wob(14), y - h]], 1.6, rng, { w0: 1.6, w1: 0.1 })
    if (rng.chance(0.4)) shape(ctx, [[x + 2, y - h + 6], [x + 5, y - h - 8, 1], [x + 8, y - h + 8]], rng)
  }
  ctx.globalAlpha = 1
  // the milestone by the road, lower left, small and alone: a single quiet mark for the eye
  const mx = 300
  const my = 756
  shape(ctx, [[mx - 7, my, 1], [mx - 6, my - 26], [mx, my - 32], [mx + 7, my - 26], [mx + 8, my, 1]], rng)
  ctx.fillStyle = '#efe3c8'
  shape(ctx, [[mx - 4, my - 2], [mx - 3, my - 24], [mx + 1, my - 28], [mx + 5, my - 24], [mx + 5, my - 2]], rng)
  ctx.fillStyle = INK
  hatch(ctx, () => ctx.rect(mx - 4, my - 28, 5, 27), rng, { angle: Math.PI / 2, gap: 2, w: 0.5, box: [mx - 4, my - 28, 5, 27], alpha: 0.7 })
  penLine(ctx, [mx - 2, my - 20], [mx + 2, my - 20], 0.8, rng)
  penLine(ctx, [mx - 2, my - 14], [mx + 2, my - 14], 0.8, rng)
  // ash tufts along the road
  for (let i = 0; i < 14; i++) {
    const x = rng.range(20, 460)
    const y = rng.range(770, 880)
    ctx.globalAlpha = 0.35
    pen(ctx, [[x, y], [x + 3, y - 6], [x + 8, y - 10]], 0.9, rng, { w0: 0.8, w1: 0.1 })
    pen(ctx, [[x + 4, y], [x + 2, y - 8]], 0.8, rng, { w0: 0.8, w1: 0.1 })
    ctx.globalAlpha = 1
  }
}

/** Draws the cover, 1600 x 900. */
export function drawCover(ctx: Ctx, w: number, h: number): void {
  const rng = new Rng(20110914)
  ctx.save()
  ctx.scale(w / W, h / H)
  parchment(ctx, W, H, rng, { age: 0.35, vignette: 0.26 })
  sky(ctx, rng)
  moon(ctx, rng)
  plains(ctx, rng)
  hill(ctx, rng)
  keep(ctx, rng)
  town(ctx, rng)
  river(ctx, rng)
  foreground(ctx, rng)
  // a thin rule inside the edge, as a plate mark
  ctx.fillStyle = INK
  ctx.globalAlpha = 0.5
  penLine(ctx, [18, 18], [W - 18, 18], 1.4, rng)
  penLine(ctx, [W - 18, 18], [W - 18, H - 18], 1.4, rng)
  penLine(ctx, [W - 18, H - 18], [18, H - 18], 1.4, rng)
  penLine(ctx, [18, H - 18], [18, 18], 1.4, rng)
  ctx.globalAlpha = 1
  ctx.restore()
}
