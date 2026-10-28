/**
 * Handouts: documents the players can be handed, drawn as aged paper with a little text set in
 * the app's book faces. Only a title and a few lines appear here; the full text lives on the page.
 */
import { INK, INK_SOFT, PAPER, Rng, crossHatch, disc, hatch, parchment, pen, penCircle, penLine, penShape, seedOf, shape, stipple, type Ctx, type Pt } from './ink'
import { drawBust } from './silhouettes'

type Region = () => void
type Box = [number, number, number, number]
type Handout = (ctx: Ctx, rng: Rng, serif: boolean) => void

const DISPLAY = "'Cinzel', Georgia, 'Times New Roman', serif"
const BOOK = "'EB Garamond', Garamond, Georgia, 'Times New Roman', serif"

/** Waits (briefly) for the app's fonts; drawing goes ahead with the fallbacks if they do not come. */
async function fontsReady(): Promise<boolean> {
  try {
    if (!('fonts' in document)) return false
    const want = [`600 40px ${DISPLAY}`, `400 24px ${BOOK}`, `italic 400 24px ${BOOK}`]
    const loaded = Promise.all(want.map((f) => document.fonts.load(f)))
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
    const result = await Promise.race([loaded, timeout])
    return result !== null && document.fonts.check(want[0]) && document.fonts.check(want[1])
  } catch {
    return false
  }
}

interface TextOpts {
  font?: 'display' | 'book'
  size?: number
  weight?: number | string
  italic?: boolean
  align?: CanvasTextAlign
  alpha?: number
  color?: string
  /** Letter spacing in px (set through the canvas property where supported). */
  tracking?: number
  rotate?: number
}

function text(ctx: Ctx, s: string, x: number, y: number, o: TextOpts = {}): void {
  ctx.save()
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 24}px ${o.font === 'display' ? DISPLAY : BOOK}`
  ctx.textAlign = o.align ?? 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = o.color ?? INK
  ctx.globalAlpha = o.alpha ?? 1
  if (o.tracking && 'letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${o.tracking}px`
  if (o.rotate) {
    ctx.translate(x, y)
    ctx.rotate(o.rotate)
    ctx.fillText(s, 0, 0)
  } else ctx.fillText(s, x, y)
  ctx.restore()
}

/** A line of handwriting nobody can quite read: looping pen strokes with the rhythm of script. */
function scrawl(ctx: Ctx, rng: Rng, x: number, y: number, w: number, o: { size?: number; w?: number; slant?: number; alpha?: number } = {}): void {
  const size = o.size ?? 10
  const slant = o.slant ?? 0.35
  let cx = x
  ctx.globalAlpha = o.alpha ?? 0.9
  while (cx < x + w) {
    const word = 3 + rng.int(0, 5)
    const line: Pt[] = []
    for (let i = 0; i < word * 3; i++) {
      const t = i / 3
      const up = i % 3 === 1 ? -size * (rng.chance(0.3) ? 1.8 : 0.9) : i % 3 === 2 ? size * (rng.chance(0.25) ? 0.9 : 0.2) : 0
      line.push([cx + t * size * 0.9 + up * slant * 0.5 + rng.wob(1), y + up + rng.wob(1.2)])
    }
    pen(ctx, line, o.w ?? 1.5, rng, { smooth: 4, w0: 0.4, w1: 0.3, noise: 0.5 })
    if (rng.chance(0.3)) {
      const dx = cx + rng.range(0, word * size * 0.8)
      penLine(ctx, [dx - 3, y - size * 1.3], [dx + 4, y - size * 1.5], 1, rng)
    }
    cx += word * size * 0.9 + size * 0.8
  }
  ctx.globalAlpha = 1
}

/** A sheet of paper laid on the table at a slight angle, with a shadow. Returns nothing; the caller draws on it unrotated. */
function sheet(ctx: Ctx, rng: Rng, box: Box, o: { rot?: number; torn?: ('top' | 'bottom' | 'left' | 'right')[]; tone?: string; age?: number; shadow?: number } = {}): Region {
  const [x, y, w, h] = box
  const torn = new Set(o.torn ?? [])
  const edge = (a: Pt, b: Pt, side: 'top' | 'bottom' | 'left' | 'right'): Pt[] => {
    if (!torn.has(side)) return [a]
    const out: Pt[] = []
    const n = 26
    for (let i = 0; i < n; i++) {
      const t = i / n
      const nx = side === 'top' ? 0 : side === 'bottom' ? 0 : side === 'left' ? 1 : -1
      const ny = side === 'top' ? 1 : side === 'bottom' ? -1 : 0
      const d = rng.next() * 14 + (rng.chance(0.15) ? 18 : 0)
      out.push([a[0] + (b[0] - a[0]) * t + nx * d, a[1] + (b[1] - a[1]) * t + ny * d, 1])
    }
    return out
  }
  const pts: Pt[] = [...edge([x, y], [x + w, y], 'top'), ...edge([x + w, y], [x + w, y + h], 'right'), ...edge([x + w, y + h], [x, y + h], 'bottom'), ...edge([x, y + h], [x, y], 'left')]
  const region: Region = () => {
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
    ctx.closePath()
  }
  ctx.save()
  if (o.rot) {
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate(o.rot)
    ctx.translate(-x - w / 2, -y - h / 2)
  }
  // shadow
  ctx.fillStyle = `rgba(40, 25, 10, ${o.shadow ?? 0.22})`
  ctx.save()
  ctx.translate(6, 9)
  ctx.beginPath()
  region()
  ctx.fill()
  ctx.restore()
  // the paper itself, with its own parchment texture clipped to the sheet
  ctx.save()
  ctx.beginPath()
  region()
  ctx.clip()
  parchment(ctx, 900, 1200, rng, { tone: o.tone ?? PAPER, age: o.age ?? 0.5, vignette: 0.1 })
  ctx.restore()
  ctx.fillStyle = INK
  ctx.globalAlpha = 0.5
  penShape(ctx, pts, 1, rng, { smooth: 0, jitter: 0.2 })
  ctx.globalAlpha = 1
  ctx.restore()
  return region
}

/** A rubber stamp: a word in a rounded box, inked unevenly, at an angle. */
function stamp(ctx: Ctx, rng: Rng, x: number, y: number, word: string, o: { rot?: number; round?: boolean; size?: number; alpha?: number } = {}): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(o.rot ?? -0.18)
  const size = o.size ?? 26
  ctx.font = `600 ${size}px ${DISPLAY}`
  const w = ctx.measureText(word).width + size * 1.2
  const h = size * 1.9
  ctx.globalAlpha = o.alpha ?? 0.7
  ctx.fillStyle = INK_SOFT
  if (o.round) {
    penCircle(ctx, 0, 0, w / 2 + 6, 3.4, rng, { ry: w / 2 + 6, wobble: 1.2 })
    penCircle(ctx, 0, 0, w / 2 - 6, 1.4, rng, { ry: w / 2 - 6, wobble: 1 })
  } else {
    const pts: Pt[] = [[-w / 2, -h / 2, 1], [w / 2, -h / 2, 1], [w / 2, h / 2, 1], [-w / 2, h / 2, 1]]
    for (let i = 0; i < 4; i++) penLine(ctx, pts[i], pts[(i + 1) % 4], 3.4, rng)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(word, 0, 2)
  // broken ink: lift speckles of paper out of the stamp
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 160; i++) {
    ctx.beginPath()
    ctx.arc(rng.range(-w / 2 - 8, w / 2 + 8), rng.range(-h / 2 - 8, h / 2 + 8), 0.8 + rng.next() * 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function hrule(ctx: Ctx, rng: Rng, x0: number, x1: number, y: number, w = 1.2, alpha = 0.8): void {
  ctx.globalAlpha = alpha
  penLine(ctx, [x0, y], [x1, y], w, rng)
  ctx.globalAlpha = 1
}

/** A small inked lantern mark, the company's sign. */
function lanternMark(ctx: Ctx, rng: Rng, x: number, y: number, s: number): void {
  const pts: Pt[] = [[x - 0.5 * s, y - 0.5 * s, 1], [x + 0.5 * s, y - 0.5 * s, 1], [x + 0.42 * s, y + 0.6 * s, 1], [x - 0.42 * s, y + 0.6 * s, 1]]
  for (let i = 0; i < 4; i++) penLine(ctx, pts[i], pts[(i + 1) % 4], 2.2, rng)
  shape(ctx, [[x - 0.6 * s, y - 0.5 * s], [x, y - 0.9 * s], [x + 0.6 * s, y - 0.5 * s]], rng)
  penCircle(ctx, x, y - 1.05 * s, 0.14 * s, 2, rng)
  shape(ctx, [[x, y - 0.3 * s, 1], [x + 0.14 * s, y], [x + 0.08 * s, y + 0.3 * s], [x - 0.1 * s, y + 0.3 * s], [x - 0.16 * s, y]], rng)
  penLine(ctx, [x - 0.5 * s, y + 0.6 * s], [x + 0.5 * s, y + 0.6 * s], 3, rng)
}

const HANDOUTS: Record<string, Handout> = {
  'h-pay-notice': (ctx, rng) => {
    sheet(ctx, rng, [70, 60, 760, 1080], { rot: -0.012, age: 0.6 })
    lanternMark(ctx, rng, 450, 150, 50)
    text(ctx, 'THE REGENCY OF ARDITH', 450, 240, { font: 'display', size: 38, weight: 600, align: 'center', tracking: 4 })
    text(ctx, 'Office of Martial Disbursement, Caer Ardith', 450, 284, { font: 'display', size: 22, weight: 500, align: 'center', tracking: 2 })
    text(ctx, 'Ledger of the Ninth Year of the Treaty, Third Quarter', 450, 322, { size: 22, italic: true, align: 'center', alpha: 0.85 })
    text(ctx, 'NOTICE OF QUARTERLY REMITTANCE', 450, 372, { font: 'display', size: 26, weight: 600, align: 'center', tracking: 3 })
    hrule(ctx, rng, 130, 770, 394, 1.8)
    hrule(ctx, rng, 130, 770, 400, 0.8)
    // the remittance table, as the notice sets it out
    const top = 440
    const lines: [string, string][] = [
      ['Wages of the Ranks (one hundred and thirty-eight souls)', '0 silver'],
      ['Wages of Officers (four)', '0 silver'],
      ['Allowance for Fodder, Lamp-oil and Sundries', '0 silver'],
      ['Arrears of Previous Quarters, Brought Forward', 'deferred'],
    ]
    lines.forEach(([label, value], i) => {
      const y = top + 50 + i * 78
      hrule(ctx, rng, 130, 770, y + 24, 0.7, 0.5)
      text(ctx, label, 140, y, { size: 21 })
      text(ctx, value, 760, y, { size: 24, align: 'right', italic: value === 'deferred', weight: value === 'deferred' ? 400 : 600 })
    })
    const rows = lines.length
    const ty = top + 50 + rows * 78 + 30
    hrule(ctx, rng, 130, 770, ty - 36, 1.8)
    text(ctx, 'Total Remitted', 140, ty + 10, { size: 26, weight: 600 })
    text(ctx, '0 silver', 740, ty + 10, { size: 30, align: 'right', weight: 600 })
    // the captain's own, angrier hand, in the margin beside it
    text(ctx, 'RECEIPT FOR WHAT', 300, ty + 64, { size: 30, italic: true, rotate: -0.08, alpha: 0.9 })
    // signatures and a thumbprint
    text(ctx, 'Signed for the Office,', 140, ty + 120, { size: 22, italic: true, alpha: 0.85 })
    scrawl(ctx, rng, 360, ty + 120, 200, { size: 14, w: 2, slant: 0.5 })
    text(ctx, 'E. Haverleigh, Disbursing Clerk (Third Grade)', 140, ty + 154, { size: 20, italic: true, alpha: 0.85 })
    text(ctx, 'Under seal of the Regent-Chancellor', 140, ty + 186, { size: 20, italic: true, alpha: 0.85 })
    const px = 690
    const py = ty + 150
    ctx.fillStyle = INK
    stipple(ctx, () => ctx.ellipse(px, py, 26, 34, 0.3, 0, Math.PI * 2), rng, [px - 30, py - 40, 60, 80], 60, 0.9, (x, y) => {
      const d = Math.hypot((x - px) / 26, (y - py) / 34)
      return d > 1 ? 0 : 0.35 + 0.65 * (Math.sin(d * 18) * 0.5 + 0.5)
    })
    // a splash of lamp oil
    ctx.globalAlpha = 0.12
    disc(ctx, 230, 1040, 40, rng)
    disc(ctx, 262, 1066, 22, rng)
    ctx.globalAlpha = 1
  },
  'h-tax-notice': (ctx, rng) => {
    // three forms, each a little off the last: the bottom two show their edges and a line or two
    sheet(ctx, rng, [120, 170, 680, 940], { rot: 0.07, age: 0.5, tone: '#ece0c2' })
    text(ctx, 'COPY THE THIRD (BLUE)', 760, 240, { font: 'display', size: 18, align: 'right', alpha: 0.7, rotate: 0.07 })
    sheet(ctx, rng, [100, 130, 680, 940], { rot: -0.045, age: 0.45, tone: '#eee3c8' })
    text(ctx, 'COPY THE SECOND (BUFF)', 160, 1060, { font: 'display', size: 18, alpha: 0.7, rotate: -0.045 })
    sheet(ctx, rng, [110, 100, 680, 940], { rot: 0.012, age: 0.4 })
    ctx.save()
    ctx.translate(450, 570)
    ctx.rotate(0.012)
    ctx.translate(-450, -570)
    text(ctx, 'THE REGENCY OF ARDITH', 450, 190, { font: 'display', size: 34, weight: 600, align: 'center', tracking: 3 })
    text(ctx, 'Office of the Assessor for the March of Cinders', 450, 228, { size: 22, italic: true, align: 'center', alpha: 0.9 })
    text(ctx, 'NOTICE OF ASSESSMENT', 450, 282, { font: 'display', size: 32, weight: 600, align: 'center', tracking: 4 })
    text(ctx, 'AND DEMAND', 450, 322, { font: 'display', size: 32, weight: 600, align: 'center', tracking: 4 })
    text(ctx, 'Fourth Assistant Under-Collector, P. Quillon, presiding', 450, 354, { size: 20, italic: true, align: 'center', alpha: 0.85 })
    hrule(ctx, rng, 160, 740, 376, 1.6)
    const fields: [string, string][] = [
      ['Hearth Levy', '418 silver'],
      ['Garrison Tithe', '209 silver'],
      ['Tax on Lamps and Lights (Burning)', '3,285 silver'],
      ['Fee for the Assessment of Fees', '12 silver'],
      ['Fee for the Preparation of this Notice', '3 silver'],
      ['Total Demanded', '3,927 silver'],
    ]
    fields.forEach(([f, v], i) => {
      const y = 440 + i * 72
      const last = i === fields.length - 1
      text(ctx, f, 170, y, { size: 18, tracking: 0.5, weight: last ? 600 : 400 })
      const bx: Pt[] = [[480, y - 26, 1], [740, y - 26, 1], [740, y + 14, 1], [480, y + 14, 1]]
      ctx.globalAlpha = 0.75
      for (let k = 0; k < 4; k++) penLine(ctx, bx[k], bx[(k + 1) % 4], 1.1, rng)
      ctx.globalAlpha = 1
      text(ctx, v, 490, y + 2, { size: 22, italic: !last, weight: last ? 600 : 400 })
    })
    text(ctx, 'Payment is due within thirty days.', 170, 890, { size: 19, italic: true, alpha: 0.85 })
    text(ctx, 'P. Quillon, F.A.U.C.', 170, 930, { size: 18, alpha: 0.85 })
    scrawl(ctx, rng, 340, 928, 140, { size: 10, w: 1.4 })
    text(ctx, '(and witnessed, A. Mote, Clerk)', 170, 964, { size: 18, alpha: 0.85 })
    scrawl(ctx, rng, 450, 962, 120, { size: 10, w: 1.4 })
    ctx.restore()
    stamp(ctx, rng, 640, 880, 'DEMAND', { rot: -0.3, round: true, size: 22, alpha: 0.55 })
    stamp(ctx, rng, 300, 640, 'ASSESSMENT', { rot: 0.14, size: 28, alpha: 0.5 })
    stamp(ctx, rng, 560, 1010, 'IN TRIPLICATE', { rot: -0.1, size: 20, alpha: 0.6 })
  },
  'h-wanted': (ctx, rng, serif) => {
    void serif
    sheet(ctx, rng, [80, 70, 740, 1060], { rot: 0.008, age: 0.7, torn: ['bottom'] })
    // nail holes
    for (const [x, y] of [
      [120, 110],
      [780, 112],
    ]) {
      ctx.fillStyle = INK
      disc(ctx, x, y, 5, rng)
      ctx.fillStyle = '#f7f1e2'
      disc(ctx, x - 1, y - 1, 2.2, rng)
      ctx.fillStyle = INK
      crossHatch(ctx, () => ctx.arc(x, y + 2, 12, 0, Math.PI * 2), rng, { angle: 0.2, gap: 3, w: 0.6, box: [x - 12, y - 12, 24, 24], alpha: 0.35 })
    }
    text(ctx, 'WANTED', 450, 220, { font: 'display', size: 96, weight: 600, align: 'center', tracking: 10 })
    hrule(ctx, rng, 140, 760, 246, 2.4)
    hrule(ctx, rng, 140, 760, 254, 1)
    // the bust in a ruled box
    const bx = 230
    const by = 290
    const bw = 440
    const bh = 330
    ctx.fillStyle = '#f3ead4'
    ctx.fillRect(bx, by, bw, bh)
    ctx.save()
    ctx.beginPath()
    ctx.rect(bx, by, bw, bh)
    ctx.clip()
    const bust = document.createElement('canvas')
    bust.width = bw
    bust.height = bh
    const bc = bust.getContext('2d')
    if (bc) {
      drawBust(bc, bw, bh, 'dannic-rook', { key: 'dannic-rook', type: 'npc', name: 'Dannic Rook', fields: [{ key: 'Ancestry', value: 'Human' }, { key: 'Role', value: 'Soldier, deserter' }], summary: 'He deserted.' })
      ctx.drawImage(bust, bx, by)
    }
    ctx.restore()
    ctx.fillStyle = INK
    const frame: Pt[] = [[bx, by, 1], [bx + bw, by, 1], [bx + bw, by + bh, 1], [bx, by + bh, 1]]
    for (let i = 0; i < 4; i++) penLine(ctx, frame[i], frame[(i + 1) % 4], 2.2, rng)
    text(ctx, 'DANNIC ROOK', 450, 690, { font: 'display', size: 52, weight: 600, align: 'center', tracking: 4 })
    text(ctx, 'for DESERTION and THEFT of COMPANY STORES', 450, 734, { font: 'display', size: 22, weight: 500, align: 'center', tracking: 3 })
    text(ctx, 'late of the Company of the Ninth Lantern, Second File', 450, 772, { size: 22, italic: true, align: 'center' })
    text(ctx, 'Left the Keep without leave the night of the 7th Ashfall, taking', 450, 812, { size: 21, align: 'center' })
    text(ctx, 'two tins of lamp-oil and one company blanket (grey).', 450, 840, { size: 21, align: 'center' })
    text(ctx, 'Last seen on the Low Quay, Cinderford, the 12th Ashfall.', 450, 868, { size: 21, align: 'center' })
    text(ctx, 'REWARD · TEN SILVER', 450, 916, { font: 'display', size: 30, weight: 600, align: 'center', tracking: 5 })
    text(ctx, 'for his return, alive, to the Assessor’s Office, Ford Street.', 450, 950, { size: 21, italic: true, align: 'center' })
    hrule(ctx, rng, 200, 700, 974, 1.2, 0.6)
    text(ctx, 'Given under the hand of the Assessor’s Office · 13 Ashfall 3011 AW · By order. A.M.', 450, 1002, { size: 17, align: 'center', alpha: 0.85 })
    // two different hands have written underneath in charcoal
    ctx.fillStyle = INK
    ctx.globalAlpha = 0.6
    text(ctx, '10 silver?? the Regency’s got 10 silver??', 430, 1052, { size: 27, italic: true, align: 'center', rotate: -0.04, alpha: 0.55 })
    text(ctx, 'owes me 4', 600, 1092, { size: 25, italic: true, align: 'center', rotate: 0.05, alpha: 0.5 })
    ctx.globalAlpha = 1
  },
  'h-letter': (ctx, rng) => {
    sheet(ctx, rng, [110, 90, 680, 1020], { rot: -0.02, age: 0.25, tone: '#f4ead6', shadow: 0.18 })
    // fold creases
    ctx.save()
    ctx.translate(450, 600)
    ctx.rotate(-0.02)
    ctx.translate(-450, -600)
    for (const y of [430, 770]) {
      ctx.globalAlpha = 0.18
      penLine(ctx, [116, y], [784, y + 4], 2, rng)
      ctx.globalAlpha = 0.08
      hatch(ctx, () => ctx.rect(116, y - 12, 668, 24), rng, { angle: 0, gap: 3, w: 0.8, box: [116, y - 12, 668, 24] })
      ctx.globalAlpha = 1
    }
    // a perfume stain, faint
    ctx.globalAlpha = 0.07
    ctx.fillStyle = INK
    disc(ctx, 620, 300, 110, rng)
    ctx.globalAlpha = 0.05
    disc(ctx, 560, 360, 70, rng)
    ctx.globalAlpha = 1
    text(ctx, 'To the five who keep the Lantern’s watch,', 170, 220, { size: 30, italic: true })
    // the body: flowing lines, slanted, with only a few words surfacing
    const lines = 16
    for (let i = 0; i < lines; i++) {
      const y = 290 + i * 42
      if (i === 5) {
        scrawl(ctx, rng, 170, y, 200, { size: 12, w: 1.6, slant: 0.5 })
        text(ctx, 'the Lantern', 400, y, { size: 30, italic: true, alpha: 0.85 })
        scrawl(ctx, rng, 560, y, 180, { size: 12, w: 1.6, slant: 0.5 })
      } else if (i === 9) {
        scrawl(ctx, rng, 170, y, 120, { size: 12, w: 1.6, slant: 0.5 })
        text(ctx, 'Come as you are', 320, y, { size: 30, italic: true, alpha: 0.85 })
        scrawl(ctx, rng, 540, y, 200, { size: 12, w: 1.6, slant: 0.5 })
      } else if (i === 13) {
        scrawl(ctx, rng, 170, y, 250, { size: 12, w: 1.6, slant: 0.5 })
        text(ctx, 'the hour after the bell', 450, y, { size: 30, italic: true, alpha: 0.85 })
      } else {
        scrawl(ctx, rng, 170, y, 560 + rng.range(-120, 10), { size: 12, w: 1.6, slant: 0.5 })
      }
    }
    text(ctx, 'With warmth, and in her light,', 420, 1000, { size: 30, italic: true, alpha: 0.9 })
    text(ctx, 'Seraphine Ashe', 740, 1050, { size: 36, italic: true, align: 'right' })
    ctx.restore()
    // the seal: a blot of wax pressed with a flame, inked dark
    const sx = 690
    const sy = 160
    const blot: Pt[] = []
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      const rr = 52 + rng.wob(7)
      blot.push([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.92])
    }
    const br: Region = () => {
      blot.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
    }
    ctx.fillStyle = '#efe3c8'
    ctx.beginPath()
    br()
    ctx.fill()
    ctx.fillStyle = INK
    crossHatch(ctx, br, rng, { angle: 0.3, gap: 3.6, w: 1, box: [sx - 60, sy - 60, 120, 120], alpha: 0.85, fade: 'start' })
    penShape(ctx, blot, 2.4, rng, { smooth: 4 })
    ctx.fillStyle = '#faf6ea'
    shape(ctx, [[sx, sy - 34, 1], [sx + 12, sy - 14], [sx + 18, sy + 6], [sx + 10, sy + 24], [sx - 2, sy + 30], [sx - 14, sy + 20], [sx - 18, sy], [sx - 8, sy - 14], [sx - 10, sy - 24, 1]], rng)
    ctx.fillStyle = INK
    penLine(ctx, [sx - 2, sy + 26], [sx + 4, sy - 6], 1.2, rng)
    // a dusting where the wax cracked
    stipple(ctx, br, rng, [sx - 60, sy - 60, 120, 120], 10, 1)
  },
  'h-map-scrap': (ctx, rng) => {
    const region = sheet(ctx, rng, [60, 150, 780, 900], { rot: 0.03, age: 0.75, torn: ['top', 'right', 'bottom'], tone: '#e9dcbd' })
    ctx.save()
    ctx.translate(450, 600)
    ctx.rotate(0.03)
    ctx.translate(-450, -600)
    ctx.save()
    ctx.beginPath()
    region()
    ctx.clip()
    ctx.fillStyle = INK
    // the ash plain: stipple thickening toward the Rent
    const rentLine: Pt[] = [[80, 760], [200, 700], [300, 600], [380, 520], [470, 440], [560, 400], [700, 330], [860, 280]]
    stipple(ctx, () => ctx.rect(60, 150, 780, 900), rng, [60, 150, 780, 900], 1.4, 0.8, (x, y) => {
      let best = 1e9
      for (const p of rentLine) best = Math.min(best, Math.hypot(x - p[0], y - p[1]))
      return Math.min(1, 0.2 + 140 / (best + 40))
    })
    // the Rent: two jagged lips with hatching between, darker in the middle
    const lipA: Pt[] = rentLine.map((p): Pt => [p[0] + rng.wob(6), p[1] - 22 - rng.next() * 14, 1])
    const lipB: Pt[] = rentLine.map((p): Pt => [p[0] + rng.wob(6), p[1] + 22 + rng.next() * 14, 1])
    const chasm: Region = () => {
      lipA.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      for (let i = lipB.length - 1; i >= 0; i--) ctx.lineTo(lipB[i][0], lipB[i][1])
      ctx.closePath()
    }
    hatch(ctx, chasm, rng, { angle: Math.PI / 2 + 0.5, gap: 4, w: 1, box: [60, 250, 820, 540], alpha: 0.9 })
    hatch(ctx, chasm, rng, { angle: -0.6, gap: 7, w: 0.8, box: [60, 250, 820, 540], alpha: 0.5 })
    pen(ctx, lipA, 2.6, rng, { smooth: 0, w0: 1, w1: 1, noise: 0.6 })
    pen(ctx, lipB, 2.2, rng, { smooth: 0, w0: 1, w1: 1, noise: 0.6 })
    for (let i = 1; i < rentLine.length - 1; i++) {
      const p = rentLine[i]
      for (let k = 0; k < 4; k++) {
        const s = k % 2 ? 1 : -1
        pen(ctx, [[p[0] + k * 10, p[1] + s * 30], [p[0] + k * 10 + rng.wob(10), p[1] + s * (44 + rng.next() * 16)]], 1, rng, { w0: 1, w1: 0.2 })
      }
    }
    // the ninth stone: a leaning block at the northern lip, circled
    const nx = 690
    const ny = 290
    shape(ctx, [[nx - 10, ny + 20, 1], [nx - 6, ny - 30, 1], [nx + 12, ny - 36, 1], [nx + 18, ny + 18, 1]], rng)
    pen(ctx, [[nx - 6, ny - 30], [nx + 20, ny - 20]], 1.2, rng)
    text(ctx, 'THE STONE', nx + 30, ny - 10, { size: 22, italic: true })
    // fort mercy, stillwater, a track with an X
    const fort: Pt[] = [[150, 330, 1], [200, 330, 1], [200, 370, 1], [150, 370, 1]]
    for (let i = 0; i < 4; i++) penLine(ctx, fort[i], fort[(i + 1) % 4], 1.8, rng)
    for (let k = 0; k < 4; k++) penLine(ctx, [150 + k * 14, 330], [150 + k * 14, 322], 1.6, rng)
    text(ctx, 'Halfway Ledge: camp here', 212, 356, { size: 22, italic: true })
    for (let i = 0; i < 3; i++) shape(ctx, [[260 + i * 24, 860 + (i % 2) * 8], [268 + i * 24, 846 + (i % 2) * 8], [276 + i * 24, 860 + (i % 2) * 8]], rng)
    text(ctx, 'Ninth Lantern’s Bones', 340, 866, { size: 21, italic: true })
    // dotted track from the fort to a dig site
    const track: Pt[] = [[200, 360], [280, 420], [360, 470], [420, 520], [480, 560], [540, 548]]
    for (let i = 0; i < 40; i++) {
      const t = i / 40
      const seg = Math.min(track.length - 2, Math.floor(t * (track.length - 1)))
      const u = t * (track.length - 1) - seg
      const a = track[seg]
      const b = track[seg + 1]
      disc(ctx, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 2, rng)
    }
    penLine(ctx, [530, 536], [554, 562], 3, rng)
    penLine(ctx, [554, 536], [530, 562], 3, rng)
    text(ctx, 'The Cold Seam: no Brakk', 560, 590, { size: 22, italic: true })
    text(ctx, 'Rope Steps', 300, 455, { size: 19, italic: true, rotate: 0.5, alpha: 0.8 })
    // the glyph, copied carefully and circled twice
    const gx = 620
    const gy = 760
    penLine(ctx, [gx - 30, gy - 30], [gx + 10, gy - 40], 2.6, rng)
    penLine(ctx, [gx + 10, gy - 40], [gx + 30, gy], 2.6, rng)
    penLine(ctx, [gx + 30, gy], [gx - 10, gy + 36], 2.6, rng)
    penLine(ctx, [gx - 30, gy - 30], [gx - 10, gy + 36], 2.6, rng)
    penLine(ctx, [gx - 20, gy], [gx + 20, gy - 12], 2, rng)
    disc(ctx, gx + 10, gy - 40, 4, rng)
    penCircle(ctx, gx, gy, 64, 2.4, rng, { wobble: 3 })
    penCircle(ctx, gx + 4, gy - 2, 70, 1.6, rng, { wobble: 4 })
    text(ctx, 'The Choir', gx - 40, gy + 110, { size: 22, italic: true })
    text(ctx, 'NOT ours', gx + 70, gy - 70, { size: 26, italic: true })
    // compass rose, a plain one
    const cx = 160
    const cy = 740
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2
      shape(ctx, [[cx, cy], [cx + Math.cos(a - 0.2) * 14, cy + Math.sin(a - 0.2) * 14], [cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, 1], [cx + Math.cos(a + 0.2) * 14, cy + Math.sin(a + 0.2) * 14]], rng)
    }
    penCircle(ctx, cx, cy, 20, 1.4, rng)
    text(ctx, 'N', cx, cy - 52, { font: 'display', size: 20, align: 'center' })
    text(ctx, 'the Rent', 430, 480, { size: 26, italic: true, rotate: -0.62, alpha: 0.9 })
    ctx.restore()
    ctx.restore()
    // a greasy thumb
    ctx.fillStyle = INK
    ctx.globalAlpha = 0.1
    disc(ctx, 760, 900, 30, rng)
    ctx.globalAlpha = 1
  },
  'h-rubbing': (ctx, rng) => {
    sheet(ctx, rng, [70, 60, 760, 1080], { rot: -0.015, age: 0.3, tone: '#efe6d2' })
    // the charcoal goes on its own layer, so the glyphs can be lifted out of it down to the paper
    const layer = document.createElement('canvas')
    layer.width = 900
    layer.height = 1200
    const lc = layer.getContext('2d')
    if (!lc) return
    lc.lineCap = 'round'
    const field: Box = [130, 150, 640, 900]
    for (let i = 0; i < 3200; i++) {
      const x = field[0] + rng.next() * field[2]
      const y = field[1] + rng.next() * field[3]
      const L = 16 + rng.next() * 50
      const d = Math.hypot((x - 450) / 330, (y - 600) / 470)
      const a = Math.max(0, 0.3 - d * 0.22) * (0.5 + rng.next())
      if (a <= 0.01) continue
      lc.strokeStyle = `rgba(38, 30, 24, ${a})`
      lc.lineWidth = 5 + rng.next() * 12
      lc.beginPath()
      lc.moveTo(x, y)
      lc.lineTo(x + L, y + rng.wob(3))
      lc.stroke()
    }
    // grain of the stone: fine horizontal streaks
    lc.strokeStyle = 'rgba(38, 30, 24, 0.12)'
    lc.lineWidth = 1
    for (let i = 0; i < 400; i++) {
      const x = field[0] + rng.next() * field[2]
      const y = field[1] + rng.next() * field[3]
      lc.beginPath()
      lc.moveTo(x, y)
      lc.lineTo(x + 20 + rng.next() * 60, y + rng.wob(2))
      lc.stroke()
    }
    // the glyphs: cut into the stone, so the paper shows through where the charcoal could not reach
    lc.globalCompositeOperation = 'destination-out'
    lc.fillStyle = '#000'
    const glyph = (gx: number, gy: number, s: number, fade: number) => {
      const strokes = 3 + rng.int(0, 3)
      const nodes: Pt[] = []
      for (let i = 0; i < strokes + 1; i++) nodes.push([gx + rng.int(-2, 2) * s * 0.5, gy + rng.int(-3, 3) * s * 0.5])
      lc.globalAlpha = fade
      for (let i = 0; i < strokes; i++) pen(lc, [nodes[i], nodes[i + 1]], s * 0.3, rng, { smooth: 0, w0: s * 0.26, w1: s * 0.26, noise: 0.3 })
      if (rng.chance(0.5)) disc(lc, nodes[0][0], nodes[0][1], s * 0.22, rng)
      // where the paper dipped into the cut, a softer edge
      lc.globalAlpha = fade * 0.35
      for (let i = 0; i < strokes; i++) pen(lc, [nodes[i], nodes[i + 1]], s * 0.5, rng, { smooth: 0, w0: s * 0.4, w1: s * 0.4, noise: 0.5 })
    }
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const gx = 250 + col * 200
        const gy = 300 + row * 150
        const d = Math.hypot((gx - 450) / 300, (gy - 600) / 420)
        const fade = Math.max(0.1, Math.min(1, 1.3 - d * 1.1)) * (rng.chance(0.2) ? 0.3 : 1)
        glyph(gx, gy, 60, fade)
      }
    }
    // a crack across the stone, which the rubbing picked up as a pale seam
    lc.globalAlpha = 0.85
    pen(lc, [[150, 520], [300, 560], [430, 640], [560, 660], [700, 740], [780, 760]], 5, rng, { smooth: 3, w0: 1, w1: 1, noise: 0.8 })
    lc.globalAlpha = 1
    ctx.save()
    ctx.translate(450, 600)
    ctx.rotate(-0.015)
    ctx.translate(-450, -600)
    ctx.drawImage(layer, 0, 0)
    ctx.restore()
    // the scholar's note in the margin
    text(ctx, 'The name on the first line has been chiselled out. Not weathered. Chiselled.', 130, 1090, { size: 19, italic: true, alpha: 0.85, rotate: -0.015 })
    text(ctx, 'Someone wanted it forgotten more than they wanted the warning read.', 130, 1118, { size: 19, italic: true, alpha: 0.85, rotate: -0.015 })
  },
}

/** The handout drawing for a key, or nothing. */
export function drawHandout(name: string): ((ctx: Ctx, w: number, h: number) => Promise<void>) | undefined {
  const handout = HANDOUTS[name]
  if (!handout) return undefined
  return async (ctx, w, h) => {
    const serif = await fontsReady()
    const rng = new Rng(seedOf('handout:' + name))
    // the table under the paper
    ctx.fillStyle = '#c9b48c'
    ctx.fillRect(0, 0, w, h)
    const g = new Rng(seedOf(name + '/table'))
    ctx.strokeStyle = 'rgba(70, 48, 20, 0.12)'
    for (let i = 0; i < 70; i++) {
      ctx.lineWidth = 1 + g.next() * 3
      const y = g.next() * h
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(w * 0.3, y + g.wob(12), w * 0.7, y + g.wob(12), w, y + g.wob(8))
      ctx.stroke()
    }
    ctx.fillStyle = INK
    handout(ctx, rng, serif)
  }
}
