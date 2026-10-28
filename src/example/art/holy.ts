/**
 * Holy symbols: inked medallions, one per god. A double rim with a ring of beads, the sign of the
 * god in pen and hatching inside, on parchment.
 */
import { INK, PAPER_OLD, Rng, arcPts, crossHatch, disc, hatch, parchment, pen, penCircle, penLine, penShape, seedOf, shape, stipple, type Ctx, type Pt } from './ink'

type Region = () => void
type Box = [number, number, number, number]

const C = 256
const R_OUT = 222

/** The medallion rim: outer and inner rings with beads between, and a faintly stippled field. */
function medallion(ctx: Ctx, rng: Rng, beads = 48): void {
  ctx.fillStyle = PAPER_OLD
  ctx.beginPath()
  ctx.arc(C, C, R_OUT, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = INK
  // a shadow of hatching under the lower right rim
  hatch(ctx, () => ctx.arc(C + 6, C + 8, R_OUT, 0, Math.PI * 2), rng, { angle: -Math.PI / 4, gap: 4.5, w: 1, box: [C - R_OUT, C - R_OUT, R_OUT * 2 + 10, R_OUT * 2 + 10], alpha: 0.45, fade: 'start' })
  ctx.fillStyle = PAPER_OLD
  ctx.beginPath()
  ctx.arc(C, C, R_OUT, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = INK
  // field tone: stipple that thickens towards the rim
  stipple(ctx, () => ctx.arc(C, C, R_OUT - 24, 0, Math.PI * 2), rng, [C - R_OUT, C - R_OUT, R_OUT * 2, R_OUT * 2], 1.8, 0.8, (x, y) => {
    const d = Math.hypot(x - C, y - C) / (R_OUT - 24)
    return Math.max(0.04, d ** 3)
  })
  penCircle(ctx, C, C, R_OUT, 4.5, rng)
  penCircle(ctx, C, C, R_OUT - 22, 2, rng)
  for (let i = 0; i < beads; i++) {
    const a = (i / beads) * Math.PI * 2
    disc(ctx, C + Math.cos(a) * (R_OUT - 11), C + Math.sin(a) * (R_OUT - 11), 3.2, rng)
  }
}

/** Fills a region with paper, shades its lower right with hatching and outlines it. */
function solid(ctx: Ctx, rng: Rng, pts: Pt[], box: Box, o: { angle?: number; gap?: number; w?: number; smooth?: number; fade?: 'start' | 'end'; light?: boolean } = {}): Region {
  const region: Region = () => {
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  ctx.fillStyle = o.light ? '#f7f1e2' : '#f1e7d0'
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.fillStyle = INK
  hatch(ctx, region, rng, { angle: o.angle ?? Math.PI / 4, gap: o.gap ?? 4.5, w: 0.9, box, fade: o.fade ?? 'start' })
  penShape(ctx, pts, o.w ?? 2.4, rng, { smooth: o.smooth ?? 0 })
  return region
}

const lobePt = (x: number, y: number, sharp: boolean): Pt => (sharp ? [x, y, 1] : [x, y])

// ---------- the twelve ----------

type Holy = (ctx: Ctx, rng: Rng) => void

const HOLY: Record<string, Holy> = {
  'god-aurelan': (ctx, rng) => {
    // the crowned sun: a disc with alternating straight and wavy rays, a crown upon it
    const r = 62
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.PI / 16
      const r1 = i % 2 ? 150 : 128
      const x0 = C + Math.cos(a) * (r + 10)
      const y0 = C + Math.sin(a) * (r + 10)
      if (i % 2) {
        pen(ctx, [[x0, y0], [C + Math.cos(a) * r1, C + Math.sin(a) * r1]], 7, rng, { w0: 7, w1: 0.2, smooth: 0 })
      } else {
        const wave: Pt[] = []
        for (let k = 0; k <= 8; k++) {
          const t = k / 8
          const rr = r + 10 + (r1 - r - 10) * t
          const off = Math.sin(t * Math.PI * 2.5) * 7
          wave.push([C + Math.cos(a) * rr - Math.sin(a) * off, C + Math.sin(a) * rr + Math.cos(a) * off])
        }
        pen(ctx, wave, 5, rng, { w0: 5, w1: 0.2, smooth: 3 })
      }
    }
    const face: Region = () => ctx.arc(C, C, r, 0, Math.PI * 2)
    ctx.fillStyle = '#f7f1e2'
    ctx.beginPath()
    face()
    ctx.fill()
    ctx.fillStyle = INK
    hatch(ctx, face, rng, { angle: Math.PI / 4, gap: 4.5, w: 0.9, box: [C - r, C - r, r * 2, r * 2], fade: 'start' })
    penCircle(ctx, C, C, r, 3.2, rng)
    // the crown, set on the upper rim
    const cw = 92
    const ch = 44
    const cy = C - r + 6
    const crown: Pt[] = [[C - cw / 2, cy, 1], [C - cw / 2, cy - ch * 0.5, 1], [C - cw * 0.26, cy - ch * 0.25, 1], [C - cw * 0.15, cy - ch, 1], [C, cy - ch * 0.4, 1], [C + cw * 0.15, cy - ch, 1], [C + cw * 0.26, cy - ch * 0.25, 1], [C + cw / 2, cy - ch * 0.5, 1], [C + cw / 2, cy, 1]]
    ctx.fillStyle = '#f7f1e2'
    ctx.beginPath()
    crown.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = INK
    for (let i = 0; i < crown.length - 1; i++) penLine(ctx, crown[i], crown[i + 1], 2.2, rng)
    penLine(ctx, crown[0], crown[crown.length - 1], 2.6, rng)
    for (const p of [crown[3], crown[5]]) disc(ctx, p[0], p[1] - 3, 3, rng)
    disc(ctx, C, cy - ch * 0.4 - 3, 2.6, rng)
  },
  'god-maelis': (ctx, rng) => {
    // the hearth: an arch of stones with a fire within, two ears of wheat crossed beneath
    const hy = C + 40
    const outer: Pt[] = [[C - 96, hy, 1], [C - 96, C - 36], ...arcPts(C, C - 36, 96, Math.PI, Math.PI * 2, 12).slice(1, 12), [C + 96, C - 36], [C + 96, hy, 1], [C + 66, hy, 1], [C + 66, C - 30], ...arcPts(C, C - 30, 66, 0, -Math.PI, 12).slice(1, 12).reverse(), [C - 66, C - 30], [C - 66, hy, 1]]
    const archR: Region = () => {
      outer.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
    }
    ctx.fillStyle = '#f1e7d0'
    ctx.beginPath()
    archR()
    ctx.fill()
    ctx.fillStyle = INK
    hatch(ctx, archR, rng, { angle: Math.PI / 2.3, gap: 4.5, w: 0.9, box: [C - 96, C - 132, 192, 172], fade: 'start' })
    penShape(ctx, outer, 2.4, rng, { smooth: 2 })
    // stone joints
    for (let i = 1; i < 9; i++) {
      const a = Math.PI + (Math.PI * i) / 9
      penLine(ctx, [C + Math.cos(a) * 68, C - 32 + Math.sin(a) * 68], [C + Math.cos(a) * 94, C - 36 + Math.sin(a) * 94], 1.4, rng)
    }
    for (const y of [C - 10, C + 16]) {
      penLine(ctx, [C - 94, y], [C - 68, y], 1.4, rng)
      penLine(ctx, [C + 68, y], [C + 94, y], 1.4, rng)
    }
    // hearthstone and fire
    penLine(ctx, [C - 110, hy], [C + 110, hy], 3.4, rng)
    penLine(ctx, [C - 100, hy + 10], [C + 100, hy + 10], 1.4, rng)
    const flames: [number, number, number][] = [
      [C - 30, 60, 26],
      [C + 4, 92, 34],
      [C + 34, 66, 26],
    ]
    for (const [fx, fh, fw] of flames) {
      const f: Pt[] = [[fx, hy - 4 - fh, 1], [fx + fw * 0.3, hy - 4 - fh * 0.6], [fx + fw * 0.46, hy - 4 - fh * 0.2], [fx + fw * 0.3, hy - 4], [fx - fw * 0.3, hy - 4], [fx - fw * 0.5, hy - 4 - fh * 0.3], [fx - fw * 0.26, hy - 4 - fh * 0.62]]
      ctx.fillStyle = '#f7f1e2'
      ctx.beginPath()
      f.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = INK
      penShape(ctx, f, 1.8, rng, { smooth: 4 })
      pen(ctx, [[fx, hy - 8], [fx + 4, hy - 4 - fh * 0.5], [fx - 2, hy - 4 - fh * 0.75]], 1.1, rng)
    }
    // logs
    penLine(ctx, [C - 44, hy - 2], [C + 48, hy - 14], 3, rng)
    penLine(ctx, [C - 46, hy - 14], [C + 44, hy - 2], 3, rng)
    // wheat: two ears crossed under the hearth
    const ear = (x0: number, y0: number, x1: number, y1: number) => {
      pen(ctx, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 + 4], [x1, y1]], 2.2, rng, { w0: 2, w1: 0.6 })
      const dx = x1 - x0
      const dy = y1 - y0
      const L = Math.hypot(dx, dy)
      const tx = dx / L
      const ty = dy / L
      for (let i = 0; i < 7; i++) {
        const t = 0.45 + i * 0.08
        const px = x0 + dx * t
        const py = y0 + dy * t
        for (const s of [1, -1]) {
          const nx = -ty * s
          const ny = tx * s
          shape(ctx, [[px, py], [px + nx * 9 + tx * 4, py + ny * 9 + ty * 4], [px + nx * 6 + tx * 16, py + ny * 6 + ty * 16, 1], [px + tx * 8, py + ty * 8]], rng)
        }
      }
      penLine(ctx, [x1, y1], [x1 + tx * 16, y1 + ty * 16], 1, rng)
    }
    ear(C - 70, hy + 86, C + 60, hy + 22)
    ear(C + 70, hy + 86, C - 60, hy + 22)
  },
  'god-corvex': (ctx, rng) => {
    // the balanced scales over an open ledger
    const beamY = C - 60
    penLine(ctx, [C - 100, beamY], [C + 100, beamY], 4, rng)
    penLine(ctx, [C, beamY - 30], [C, C + 10], 4, rng)
    shape(ctx, [[C - 14, beamY - 30], [C, beamY - 44, 1], [C + 14, beamY - 30], [C, beamY - 22]], rng)
    for (const s of [-1, 1]) {
      const px = C + s * 96
      const py = beamY + 70
      penLine(ctx, [px, beamY], [px - 26, py], 1.3, rng)
      penLine(ctx, [px, beamY], [px + 26, py], 1.3, rng)
      penLine(ctx, [px, beamY], [px, py - 4], 1.1, rng)
      const pan: Pt[] = [[px - 34, py, 1], ...arcPts(px, py, 34, 0.1, Math.PI - 0.1, 8).slice(1, 8).reverse().map((p): Pt => [p[0], py + (p[1] - py) * 0.5]), [px + 34, py, 1]]
      solid(ctx, rng, pan, [px - 34, py, 68, 18], { smooth: 3, w: 2.2, angle: 0.3, gap: 3.5 })
      disc(ctx, px, beamY, 4, rng)
    }
    // the ledger, open, with ruled columns
    const by = C + 56
    const left: Pt[] = [[C - 6, by, 1], [C - 110, by - 14, 1], [C - 118, by + 84, 1], [C - 6, by + 98, 1]]
    const right: Pt[] = [[C + 6, by, 1], [C + 110, by - 14, 1], [C + 118, by + 84, 1], [C + 6, by + 98, 1]]
    solid(ctx, rng, left, [C - 118, by - 14, 112, 112], { angle: Math.PI / 2.2, gap: 6, fade: 'end', light: true })
    solid(ctx, rng, right, [C + 6, by - 14, 112, 112], { angle: Math.PI / 2.2, gap: 6, fade: 'start', light: true })
    for (let i = 1; i < 6; i++) {
      const t = i / 6
      penLine(ctx, [C - 100, by - 8 + t * 86], [C - 14, by + 6 + t * 86], 0.9, rng)
      penLine(ctx, [C + 14, by + 6 + t * 86], [C + 100, by - 8 + t * 86], 0.9, rng)
    }
    penLine(ctx, [C - 44, by - 4], [C - 48, by + 88], 0.9, rng)
    penLine(ctx, [C + 44, by - 4], [C + 48, by + 88], 0.9, rng)
    penLine(ctx, [C, by - 6], [C, by + 100], 2.4, rng)
  },
  'god-sefra': (ctx, rng) => {
    // the seven tides: seven waves rising to a crest, within a ring of spray
    for (let i = 0; i < 7; i++) {
      const y = C - 84 + i * 30
      const amp = 8 + i * 1.2
      const line: Pt[] = []
      const half = 120 + i * 6
      for (let x = C - half; x <= C + half; x += 10) line.push([x, y + Math.sin(x / 17 + i * 1.1) * amp])
      pen(ctx, line, 4.4 - i * 0.2, rng, { smooth: 3, w0: 0.4, w1: 0.4, noise: 0.4 })
      // a curling crest on each wave
      const cx = C - half + 30 + i * 28
      const cy = y + Math.sin(cx / 17 + i * 1.1) * amp
      const curl: Pt[] = []
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI * 1.1 - (k / 10) * Math.PI * 1.5
        const r = 12 - k * 0.6
        curl.push([cx + 12 + Math.cos(a) * r, cy - 6 + Math.sin(a) * r])
      }
      pen(ctx, curl, 2.4, rng, { smooth: 2, w0: 2, w1: 0.2 })
    }
    for (let i = 0; i < 70; i++) {
      const a = rng.next() * Math.PI * 2
      const r = 150 + rng.next() * 36
      disc(ctx, C + Math.cos(a) * r, C + Math.sin(a) * r, 1 + rng.next() * 1.6, rng)
    }
  },
  'god-grum': (ctx, rng) => {
    // the old iron: a war hammer held in a mailed fist, haft across the field
    const haft: Pt[] = [[C - 130, C + 120], [C + 60, C - 70]]
    pen(ctx, haft, 10, rng, { w0: 9, w1: 9, smooth: 0 })
    for (let i = 0; i < 5; i++) {
      const t = 0.08 + i * 0.07
      const x = C - 130 + 190 * t
      const y = C + 120 - 190 * t
      penLine(ctx, [x - 6, y - 6], [x + 6, y + 6], 1.2, rng)
    }
    const head: Pt[] = [[C + 18, C - 110, 1], [C + 128, C - 70, 1], [C + 136, C - 50, 1], [C + 110, C - 8, 1], [C + 60, C - 2, 1], [C + 10, C - 58, 1]]
    const hr = solid(ctx, rng, head, [C + 10, C - 110, 130, 110], { angle: 0.3, gap: 4, w: 3 })
    crossHatch(ctx, hr, rng, { angle: 0.3, gap: 7, w: 0.8, box: [C + 10, C - 110, 130, 110], fade: 'start', alpha: 0.6 })
    penLine(ctx, [C + 40, C - 96], [C + 118, C - 60], 1.2, rng)
    penLine(ctx, [C + 28, C - 76], [C + 110, C - 38], 1.2, rng)
    // the fist, closed round the haft: four fingers as a row of rounded knuckles, the thumb lying across them
    ctx.save()
    ctx.translate(C - 60, C + 50)
    ctx.rotate(-Math.PI / 4)
    const fist: Pt[] = [[-44, -30], [-30, -44, 1], [-12, -40], [4, -44, 1], [20, -38], [34, -40, 1], [46, -28], [50, -6], [44, 22], [30, 40], [0, 48], [-30, 42], [-48, 20], [-52, -8]]
    const fr: Region = () => {
      fist.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
    }
    ctx.fillStyle = '#f7f1e2'
    ctx.beginPath()
    fr()
    ctx.fill()
    ctx.fillStyle = INK
    hatch(ctx, fr, rng, { angle: Math.PI / 2 + 0.3, gap: 4, w: 0.8, box: [-60, -50, 120, 110], fade: 'start', alpha: 0.75 })
    penShape(ctx, fist, 2.6, rng, { smooth: 3 })
    // finger lines, curling round the haft
    for (const fx of [-24, -2, 20]) pen(ctx, [[fx, -36], [fx - 4, -10], [fx + 2, 14]], 1.4, rng, { w0: 0.4, w1: 0.4 })
    // the thumb across the front
    const thumb: Pt[] = [[-52, -6], [-40, 4], [-16, 10], [12, 12], [30, 4, 1], [26, 20], [4, 26], [-24, 24], [-46, 16]]
    ctx.fillStyle = '#f7f1e2'
    shape(ctx, thumb, rng)
    ctx.fillStyle = INK
    penShape(ctx, thumb, 1.8, rng, { smooth: 3 })
    // a mail cuff at the wrist
    const cuff: Pt[] = [[-30, 40, 1], [30, 40, 1], [36, 70, 1], [-38, 70, 1]]
    solid(ctx, rng, cuff, [-40, 40, 80, 32], { angle: 0.4, gap: 3, w: 2 })
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) disc(ctx, -30 + k * 10 + (r % 2) * 5, 48 + r * 8, 2, rng)
    ctx.restore()
  },
  'god-isaurana': (ctx, rng) => {
    // the veiled: a crescent behind a face hidden to the eyes by a veil
    const crescent: Region = () => {
      ctx.arc(C + 20, C - 10, 150, 0, Math.PI * 2)
      ctx.arc(C + 60, C - 30, 140, 0, Math.PI * 2, true)
    }
    ctx.fillStyle = '#f1e7d0'
    ctx.beginPath()
    crescent()
    ctx.fill('evenodd')
    ctx.fillStyle = INK
    ctx.save()
    ctx.beginPath()
    crescent()
    ctx.clip('evenodd')
    hatch(ctx, () => ctx.rect(0, 0, 512, 512), rng, { angle: Math.PI / 2.6, gap: 4.5, w: 0.9, box: [C - 140, C - 170, 320, 320], fade: 'start' })
    ctx.restore()
    penCircle(ctx, C + 20, C - 10, 150, 3, rng, { a0: Math.PI * 0.55, a1: Math.PI * 1.75 })
    penCircle(ctx, C + 60, C - 30, 140, 2, rng, { a0: Math.PI * 0.6, a1: Math.PI * 1.68 })
    // the face: an oval, eyes as two closed curves, the veil a hatched cloth from the bridge down
    const fx = C - 10
    const fy = C + 10
    const faceR: Region = () => ctx.ellipse(fx, fy, 62, 84, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#f7f1e2'
    ctx.beginPath()
    faceR()
    ctx.fill()
    ctx.fillStyle = INK
    penCircle(ctx, fx, fy, 62, 2.4, rng, { ry: 84 })
    for (const s of [-1, 1]) pen(ctx, [[fx + s * 40, fy - 20], [fx + s * 26, fy - 12], [fx + s * 12, fy - 20]], 2, rng, { w0: 0.4, w1: 0.4 })
    const veil: Pt[] = [[fx - 70, fy - 2, 1], [fx + 70, fy - 2, 1], [fx + 84, fy + 70], [fx + 60, fy + 118, 1], [fx, fy + 100], [fx - 60, fy + 118, 1], [fx - 84, fy + 70]]
    const vr: Region = () => {
      veil.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
    }
    hatch(ctx, vr, rng, { angle: Math.PI / 2 + 0.08, gap: 5, w: 0.8, box: [fx - 84, fy - 2, 168, 122], alpha: 0.8 })
    hatch(ctx, vr, rng, { angle: 0.2, gap: 11, w: 0.6, box: [fx - 84, fy - 2, 168, 122], alpha: 0.5 })
    penShape(ctx, veil, 1.8, rng, { smooth: 3 })
    penLine(ctx, [fx - 74, fy - 2], [fx + 74, fy - 2], 2.4, rng)
    // a star in the crescent's horn
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI
      penLine(ctx, [C - 92 + Math.cos(a) * 12, C - 118 + Math.sin(a) * 12], [C - 92 - Math.cos(a) * 12, C - 118 - Math.sin(a) * 12], 1.6, rng)
    }
  },
  'god-orvanne': (ctx, rng) => {
    // the green wild: a stag's antlers rising from a wreath of oak leaves
    const antler = (s: number) => {
      const beam: Pt[] = [[C + s * 14, C + 30], [C + s * 30, C - 20], [C + s * 60, C - 70], [C + s * 110, C - 112], [C + s * 150, C - 128]]
      pen(ctx, beam, 7, rng, { smooth: 5, w0: 7, w1: 0.6 })
      const tines: [Pt, Pt][] = [
        [[C + s * 26, C - 14], [C + s * 4, C - 56]],
        [[C + s * 48, C - 52], [C + s * 34, C - 100]],
        [[C + s * 78, C - 90], [C + s * 70, C - 140]],
        [[C + s * 112, C - 112], [C + s * 118, C - 160]],
      ]
      for (const [a, b] of tines) pen(ctx, [a, [(a[0] + b[0]) / 2 + s * 4, (a[1] + b[1]) / 2], b], 4.5, rng, { smooth: 4, w0: 4.5, w1: 0.4 })
    }
    antler(-1)
    antler(1)
    // the skull plate between the beams
    shape(ctx, [[C - 16, C + 24], [C + 16, C + 24], [C + 22, C + 46], [C, C + 64, 1], [C - 22, C + 46]], rng)
    // oak leaves in a half wreath below
    const leaf = (x: number, y: number, a: number, L: number, flip: number) => {
      const pts: Pt[] = []
      const lobes = 4
      for (let i = 0; i <= lobes * 2; i++) {
        const t = i / (lobes * 2)
        const r = (i % 2 ? L * 0.26 : L * 0.14) * Math.sin(Math.PI * Math.min(1, t + 0.1))
        const px = t * L
        const py = -r * flip
        pts.push(lobePt(x + Math.cos(a) * px - Math.sin(a) * py, y + Math.sin(a) * px + Math.cos(a) * py, i % 2 === 1))
      }
      for (let i = lobes * 2 - 1; i > 0; i--) {
        const t = i / (lobes * 2)
        const r = (i % 2 ? L * 0.26 : L * 0.14) * Math.sin(Math.PI * Math.min(1, t + 0.1))
        const px = t * L
        const py = r * flip
        pts.push(lobePt(x + Math.cos(a) * px - Math.sin(a) * py, y + Math.sin(a) * px + Math.cos(a) * py, i % 2 === 1))
      }
      const region: Region = () => {
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
        ctx.closePath()
      }
      ctx.fillStyle = '#f3ead4'
      ctx.beginPath()
      region()
      ctx.fill()
      ctx.fillStyle = INK
      hatch(ctx, region, rng, { angle: a + 0.9, gap: 3.5, w: 0.7, box: [x - L, y - L, L * 2, L * 2], fade: 'start', alpha: 0.7 })
      penShape(ctx, pts, 1.5, rng, { smooth: 3 })
      penLine(ctx, [x, y], [x + Math.cos(a) * L * 0.9, y + Math.sin(a) * L * 0.9], 1.1, rng)
    }
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 0.15 + (i / 4) * Math.PI * 0.7
      const x = C + Math.cos(a) * 118
      const y = C + 40 + Math.sin(a) * 118
      leaf(x, y, a - Math.PI / 2 + (i < 2 ? -0.6 : i > 2 ? 0.6 : 0), 58, i % 2 ? 1 : -1)
    }
    pen(ctx, arcPts(C, C + 40, 118, Math.PI * 0.12, Math.PI * 0.88, 20), 3, rng, { smooth: 2, w0: 0.4, w1: 0.4 })
    for (let i = 0; i < 3; i++) disc(ctx, C - 40 + i * 40, C + 164 - Math.abs(i - 1) * 6, 5, rng)
  },
  'god-tharos': (ctx, rng) => {
    // the stone-under: a mountain of three peaks over a single squared stone
    const mtn: Pt[] = [[C - 160, C + 40, 1], [C - 100, C - 40, 1], [C - 70, C - 10, 1], [C - 10, C - 120, 1], [C + 30, C - 50, 1], [C + 60, C - 80, 1], [C + 160, C + 40, 1]]
    const mr = solid(ctx, rng, mtn, [C - 160, C - 120, 320, 160], { angle: Math.PI / 3.2, gap: 5, w: 2.8 })
    hatch(ctx, mr, rng, { angle: -Math.PI / 3, gap: 9, w: 0.7, box: [C - 160, C - 120, 320, 160], fade: 'end', alpha: 0.5 })
    // snow line left as paper
    ctx.fillStyle = '#f7f1e2'
    shape(ctx, [[C - 10, C - 118], [C + 14, C - 84], [C + 2, C - 78], [C - 10, C - 88], [C - 22, C - 76], [C - 34, C - 84]], rng)
    ctx.fillStyle = INK
    penLine(ctx, [C - 10, C - 118], [C - 36, C - 82], 1.4, rng)
    penLine(ctx, [C - 10, C - 118], [C + 14, C - 84], 1.4, rng)
    // the ground line and the stone beneath
    penLine(ctx, [C - 176, C + 42], [C + 176, C + 42], 3.4, rng)
    const stone: Pt[] = [[C - 56, C + 70, 1], [C + 56, C + 70, 1], [C + 62, C + 150, 1], [C - 62, C + 150, 1]]
    const sr = solid(ctx, rng, stone, [C - 62, C + 70, 124, 80], { angle: Math.PI / 2 + 0.1, gap: 4.5, w: 2.6 })
    void sr
    // a nine-point mark cut into the stone
    penCircle(ctx, C, C + 110, 22, 1.8, rng)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 - Math.PI / 2
      disc(ctx, C + Math.cos(a) * 22, C + 110 + Math.sin(a) * 22, 2.6, rng)
    }
    // the roots of the mountain reach the stone
    for (const dx of [-30, 0, 30]) pen(ctx, [[C + dx, C + 42], [C + dx * 0.8 + rng.wob(4), C + 56], [C + dx * 0.5, C + 70]], 1.6, rng, { w0: 0.2, w1: 1.6 })
  },
  'god-hathe': (ctx, rng) => {
    // the keeper of doors: a door in its arch, cracked open, light showing through the crack
    const dx = C
    const top = C - 130
    const bot = C + 130
    const w = 150
    const arch: Pt[] = [[dx - w / 2, bot, 1], [dx - w / 2, top + 60], ...arcPts(dx, top + 60, w / 2, Math.PI, Math.PI * 2, 12).slice(1, 12), [dx + w / 2, top + 60], [dx + w / 2, bot, 1]]
    const frame: Pt[] = [[dx - w / 2 - 22, bot + 10, 1], [dx - w / 2 - 22, top + 60], ...arcPts(dx, top + 60, w / 2 + 22, Math.PI, Math.PI * 2, 12).slice(1, 12), [dx + w / 2 + 22, top + 60], [dx + w / 2 + 22, bot + 10, 1]]
    const fr: Region = () => {
      frame.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
    }
    ctx.fillStyle = '#f1e7d0'
    ctx.beginPath()
    fr()
    ctx.fill()
    ctx.fillStyle = INK
    crossHatch(ctx, fr, rng, { angle: 0.1, gap: 6, w: 0.8, box: [dx - w / 2 - 22, top - 20, w + 44, bot - top + 40], alpha: 0.5 })
    penShape(ctx, frame, 2.4, rng, { smooth: 2 })
    const dr = solid(ctx, rng, arch, [dx - w / 2, top - 20, w, bot - top + 20], { angle: Math.PI / 2 + 0.04, gap: 4.5, w: 2.6, smooth: 2, fade: 'start' })
    void dr
    // planks and iron bands
    for (const px of [-w / 6, w / 6]) penLine(ctx, [dx + px, top + 10 + Math.abs(px) * 0.2], [dx + px, bot], 1.1, rng)
    for (const y of [top + 90, bot - 40]) penLine(ctx, [dx - w / 2, y], [dx + w / 2, y], 3, rng)
    // the crack: light spills through a jagged gap
    const crack: Pt[] = [[dx + 8, top + 4, 1], [dx + 22, top + 60, 1], [dx + 10, top + 120, 1], [dx + 28, top + 190, 1], [dx + 14, bot, 1], [dx - 2, bot, 1], [dx + 10, top + 190, 1], [dx - 6, top + 120, 1], [dx + 8, top + 60, 1], [dx - 4, top + 10, 1]]
    ctx.fillStyle = '#faf6ea'
    ctx.beginPath()
    crack.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = INK
    for (let i = 0; i < crack.length / 2 - 1; i++) penLine(ctx, crack[i], crack[i + 1], 1.6, rng)
    for (let i = crack.length / 2; i < crack.length - 1; i++) penLine(ctx, crack[i], crack[i + 1], 1.6, rng)
    for (let i = 0; i < 9; i++) {
      const y = top + 30 + i * 28
      const L = 14 + rng.next() * 22
      ctx.globalAlpha = 0.55
      penLine(ctx, [dx + 30, y], [dx + 30 + L, y + rng.wob(4)], 0.9, rng)
      ctx.globalAlpha = 1
    }
    penCircle(ctx, dx - 34, C + 10, 11, 2.6, rng)
    disc(ctx, dx - 34, C - 2, 3, rng)
  },
  'god-sleeper': (ctx, rng) => {
    // the sleeper below: a closed eye under an arch of nine stones
    const stones = 9
    for (let i = 0; i < stones; i++) {
      const a0 = Math.PI + (Math.PI * i) / stones
      const a1 = Math.PI + (Math.PI * (i + 1)) / stones
      const r0 = 118
      const r1 = 164
      const g = 0.03
      const pts: Pt[] = [
        [C + Math.cos(a0 + g) * r0, C + 20 + Math.sin(a0 + g) * r0, 1],
        [C + Math.cos(a0 + g) * r1, C + 20 + Math.sin(a0 + g) * r1, 1],
        [C + Math.cos(a1 - g) * r1, C + 20 + Math.sin(a1 - g) * r1, 1],
        [C + Math.cos(a1 - g) * r0, C + 20 + Math.sin(a1 - g) * r0, 1],
      ]
      solid(ctx, rng, pts, [C - 170, C - 150, 340, 180], { angle: (a0 + a1) / 2 + Math.PI / 2, gap: 4.5, w: 2.2 })
    }
    penLine(ctx, [C - 176, C + 22], [C - 112, C + 22], 3, rng)
    penLine(ctx, [C + 112, C + 22], [C + 176, C + 22], 3, rng)
    // the eye, closed, long lashes
    pen(ctx, [[C - 90, C + 56], [C - 45, C + 84], [C, C + 92], [C + 45, C + 84], [C + 90, C + 56]], 4.4, rng, { smooth: 6, w0: 0.6, w1: 0.6 })
    pen(ctx, [[C - 70, C + 60], [C - 35, C + 76], [C, C + 80], [C + 35, C + 76], [C + 70, C + 60]], 1.4, rng, { smooth: 6, w0: 0.3, w1: 0.3 })
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9
      const x = C - 90 + 180 * t
      const y = C + 56 + Math.sin(Math.PI * t) * 36
      const a = Math.PI / 2 + (t - 0.5) * 1.4
      pen(ctx, [[x, y], [x + Math.cos(a) * 22, y + Math.sin(a) * 22]], 2, rng, { w0: 2, w1: 0.2, smooth: 0 })
    }
    // dream-lines rising under the arch
    for (let i = 0; i < 3; i++) {
      const x = C - 50 + i * 50
      pen(ctx, [[x, C + 10], [x + 8, C - 10], [x - 6, C - 34], [x + 6, C - 56]], 1.2, rng, { w0: 1.4, w1: 0.2 })
    }
    // the ground: stippled earth below the eye
    stipple(ctx, () => ctx.rect(C - 170, C + 120, 340, 60), rng, [C - 170, C + 120, 340, 60], 6, 0.9, (_x, y) => 1 - (y - (C + 120)) / 70)
  },
  'god-saint': (ctx, rng) => {
    // the unburnt saint: a figure standing in flame, unharmed
    const base = C + 150
    const h = 290
    const w = 190
    const flame: Pt[] = [[C, base - h, 1], [C + w * 0.22, base - h * 0.74], [C + w * 0.3, base - h * 0.58, 1], [C + w * 0.48, base - h * 0.38], [C + w * 0.44, base - h * 0.12], [C + w * 0.2, base], [C - w * 0.22, base], [C - w * 0.46, base - h * 0.14], [C - w * 0.42, base - h * 0.4], [C - w * 0.26, base - h * 0.5, 1], [C - w * 0.3, base - h * 0.7], [C - w * 0.12, base - h * 0.82]]
    const fr: Region = () => {
      flame.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
    }
    ctx.fillStyle = '#f7f1e2'
    ctx.beginPath()
    fr()
    ctx.fill()
    ctx.fillStyle = INK
    hatch(ctx, fr, rng, { angle: Math.PI / 2 + 0.22, gap: 5, w: 0.9, box: [C - w / 2, base - h, w, h], fade: 'start', alpha: 0.9 })
    hatch(ctx, fr, rng, { angle: Math.PI / 2 - 0.3, gap: 6.5, w: 0.8, box: [C - w / 2, base - h, w, h], fade: 'end', alpha: 0.6 })
    penShape(ctx, flame, 2.6, rng, { smooth: 5 })
    pen(ctx, [[C - w * 0.1, base - h * 0.1], [C - w * 0.16, base - h * 0.4], [C - w * 0.02, base - h * 0.66]], 1.6, rng)
    pen(ctx, [[C + w * 0.18, base - h * 0.12], [C + w * 0.22, base - h * 0.38], [C + w * 0.1, base - h * 0.56]], 1.4, rng)
    const fh = h * 0.7
    const fy = base - h * 0.06
    const fig: Pt[] = [[C, fy - fh, 1], [C + fh * 0.07, fy - fh * 0.94], [C + fh * 0.08, fy - fh * 0.84], [C + fh * 0.2, fy - fh * 0.76], [C + fh * 0.34, fy - fh * 0.52, 1], [C + fh * 0.2, fy - fh * 0.62], [C + fh * 0.17, fy - fh * 0.3], [C + fh * 0.2, fy, 1], [C - fh * 0.2, fy, 1], [C - fh * 0.17, fy - fh * 0.3], [C - fh * 0.2, fy - fh * 0.62], [C - fh * 0.34, fy - fh * 0.52, 1], [C - fh * 0.2, fy - fh * 0.76], [C - fh * 0.08, fy - fh * 0.84], [C - fh * 0.07, fy - fh * 0.94]]
    ctx.fillStyle = '#faf6ea'
    ctx.beginPath()
    fig.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = INK
    penShape(ctx, fig, 1.8, rng, { smooth: 4 })
    disc(ctx, C, fy - fh * 0.9, fh * 0.07, rng)
    ctx.fillStyle = '#faf6ea'
    disc(ctx, C - fh * 0.012, fy - fh * 0.885, fh * 0.05, rng)
    ctx.fillStyle = INK
    penLine(ctx, [C - fh * 0.06, fy - fh * 0.6], [C - fh * 0.1, fy - fh * 0.05], 1, rng)
    penLine(ctx, [C + fh * 0.06, fy - fh * 0.6], [C + fh * 0.1, fy - fh * 0.05], 1, rng)
    penLine(ctx, [C, fy - fh * 0.64], [C, fy - fh * 0.08], 0.9, rng)
    // a halo of fine rays behind the head
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.globalAlpha = 0.6
      penLine(ctx, [C + Math.cos(a) * fh * 0.1, fy - fh * 0.9 + Math.sin(a) * fh * 0.1], [C + Math.cos(a) * fh * 0.17, fy - fh * 0.9 + Math.sin(a) * fh * 0.17], 1, rng)
      ctx.globalAlpha = 1
    }
  },
  'god-corporal': (ctx, rng) => {
    // the hanged corporal: a knotted noose hanging from the rim, a corporal's chevrons within the loop
    penLine(ctx, [C, C - 200], [C, C - 120], 4, rng)
    // the knot: coils wrapped around the rope
    for (let i = 0; i < 7; i++) {
      const y = C - 122 + i * 9
      pen(ctx, [[C - 12, y], [C, y + 3], [C + 12, y]], 5, rng, { w0: 4, w1: 4, smooth: 3 })
    }
    // the loop: a rope ring with twist marks
    const loop: Pt[] = []
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2 - Math.PI / 2
      loop.push([C + 8 + Math.cos(a) * 92, C + 30 + Math.sin(a) * 110])
    }
    pen(ctx, loop, 8, rng, { closed: true, smooth: 2, noise: 0.08 })
    for (let i = 0; i < 48; i += 3) {
      const a = loop[i]
      const b = loop[i + 1]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const L = Math.hypot(dx, dy) || 1
      ctx.fillStyle = '#f1e7d0'
      penLine(ctx, [a[0] - (dy / L) * 3, a[1] + (dx / L) * 3], [a[0] + (dy / L) * 3 + dx * 1.2, a[1] - (dx / L) * 3 + dy * 1.2], 1.2, rng)
      ctx.fillStyle = INK
    }
    // two chevrons, point up, inside the loop
    for (let i = 0; i < 2; i++) {
      const y = C + 10 + i * 46
      const pts: Pt[] = [[C - 52, y + 36, 1], [C + 8, y, 1], [C + 68, y + 36, 1], [C + 68, y + 54, 1], [C + 8, y + 18, 1], [C - 52, y + 54, 1]]
      solid(ctx, rng, pts, [C - 52, y, 120, 54], { angle: 0.4, gap: 3.5, w: 2.2, light: true })
    }
  },
}

/** The holy symbol drawing for a deity key, or nothing. */
export function drawHoly(name: string): ((ctx: Ctx, w: number, h: number) => void) | undefined {
  const holy = HOLY[name]
  if (!holy) return undefined
  return (ctx, w, h) => {
    const rng = new Rng(seedOf('holy:' + name))
    parchment(ctx, w, h, rng, { age: 0.4, vignette: 0.22 })
    medallion(ctx, rng)
    ctx.fillStyle = INK
    holy(ctx, rng)
  }
}
