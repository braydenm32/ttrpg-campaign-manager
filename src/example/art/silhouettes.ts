/**
 * Portrait silhouettes: a solid ink bust in an oval cameo on parchment, one per character.
 * The base cut follows the page's Ancestry, the dress follows its Role, and everything else
 * (facing, hair, beard, hat, pipe, earring, scars) is dealt from a seed made of the page key, so
 * no two characters match and none of them changes between loads. Figures are drawn facing left
 * in a 400 x 300 frame and mirrored for those who face right. No interior detail: ink or paper.
 */
import type { ExPage } from '../types'
import { INK, PAPER, RULE, Rng, cut, disc, poly, quad, seedOf, shape, type Ctx, type Pt } from './ink'

type Ancestry = 'human' | 'elf' | 'dwarf' | 'halfling' | 'orc' | 'lithic' | 'vesh' | 'hollowborn' | 'raveler' | 'shellback'
type Role = 'plain' | 'soldier' | 'captain' | 'priest' | 'mage' | 'noble' | 'child' | 'undertaker' | 'crown'

interface Variant {
  rng: Rng
  role: Role
  /** Feminine read: longer hair, no beard, finer collar. */
  fem: boolean
  ghost: boolean
}

/** Transform from the default head's coordinates to this figure's head: scale about (200,150) then shift. */
interface Fit {
  s: number
  dx: number
  dy: number
}

const fit =
  (f: Fit) =>
  (p: Pt): Pt =>
    p[2] ? [200 + (p[0] - 200) * f.s + f.dx, 150 + (p[1] - 150) * f.s + f.dy, 1] : [200 + (p[0] - 200) * f.s + f.dx, 150 + (p[1] - 150) * f.s + f.dy]
const fitAll = (f: Fit, pts: Pt[]) => pts.map(fit(f))

// ---------- reading the page ----------

function fieldOf(page: ExPage | undefined, key: string): string {
  const f = page?.fields?.find((x) => x.key.toLowerCase() === key.toLowerCase())
  return (f?.value ?? '').toLowerCase()
}

function ancestryOf(page?: ExPage): Ancestry {
  const a = fieldOf(page, 'Ancestry') + ' ' + (page?.tags ?? []).join(' ').toLowerCase()
  if (/orc/.test(a)) return 'orc'
  if (/elf|elv/.test(a)) return 'elf'
  if (/dwarf|dwarv|returned/.test(a)) return 'dwarf'
  if (/halfling/.test(a)) return 'halfling'
  if (/lithic|stone/.test(a)) return 'lithic'
  if (/vesh|moth/.test(a)) return 'vesh'
  if (/hollowborn/.test(a)) return 'hollowborn'
  if (/raveler|crow/.test(a)) return 'raveler'
  if (/shellback|tortoise/.test(a)) return 'shellback'
  return 'human'
}

function roleOf(page: ExPage | undefined, text: string): Role {
  const r = fieldOf(page, 'Role') + ' ' + text
  if (/emperor|empress|\bking\b|\bqueen\b|regent|matriarch|mother of mothers/.test(r)) return 'crown'
  if (/captain|officer|lieutenant|commander|general|marshal/.test(r)) return 'captain'
  if (/priest|cleric|saint|chaplain|\bsister\b|\bbrother\b|envoy of the|missionary|acolyte/.test(r)) return 'priest'
  if (/mage|wizard|lamplighter|sorcer|witch|apprentice|scholar|remembrancer|lantern-keeper/.test(r)) return 'mage'
  if (/undertaker|gravedigger|sexton/.test(r)) return 'undertaker'
  if (/noble|chancellor|banker|merchant|madame|courtesan|\blord\b|\blady\b|reeve|councill?or|factor|house/.test(r)) return 'noble'
  if (/child|young|scout|\bboy\b|\bgirl\b|urchin|runner|drummer/.test(r)) return 'child'
  if (/soldier|sergeant|corporal|guard|veteran|recruit|fighter|blade|warrior|sapper|ranger|mercenary|trooper|private|spear|archer|boss|smuggler|rogue/.test(r)) return 'soldier'
  return 'plain'
}

function femOf(page: ExPage | undefined, rng: Rng): boolean {
  const head = ((page?.name ?? '') + ' ' + fieldOf(page, 'Role')).toLowerCase()
  if (/mother|sister|madame|grandmother|widow|\blady\b|daughter|queen|empress|priestess|courtesan|matriarch|mistress|\bmiss\b|\bmrs\b|\bdame\b|wife|maid/.test(head)) return true
  if (/brother|father|\blord\b|\bmaster\b|emperor|\bking\b|\bsir\b|husband|\bson\b/.test(head)) return false
  const body = ((page?.summary ?? '') + ' ' + (page?.body ?? '').slice(0, 1200) + ' ' + (page?.gmNotes ?? '').slice(0, 600)).toLowerCase()
  const m = body.match(/\b(she|her|hers|herself|he|him|his|himself)\b/)
  if (m) return /^(she|her|hers|herself)$/.test(m[1])
  return rng.chance(0.45)
}

// ---------- the default profile head ----------

interface HeadOpts {
  s?: number
  dx?: number
  dy?: number
  brow?: number
  nose?: number
  chin?: number
  jaw?: number
  skull?: number
  gaunt?: boolean
}

type Head = Record<string, Pt> & { fit: Fit }

/** A parametric profile head facing left; returns its named points and the fit used to place dress on it. */
function head(o: HeadOpts = {}): Head {
  const s = o.s ?? 1
  const dx = o.dx ?? 0
  const dy = o.dy ?? 0
  const brow = o.brow ?? 0
  const nose = o.nose ?? 0
  const chin = o.chin ?? 0
  const jaw = o.jaw ?? 0
  const skull = o.skull ?? 0
  const raw: Record<string, Pt> = {
    crown: [205, 68],
    foreTop: [182, 78],
    fore: [171 - brow * 0.4, 98],
    brow: [167 - brow, 114],
    eye: [170 - brow * 0.8, 121],
    bridge: [168 - brow * 0.3, 128],
    noseTip: [157 - nose, 141],
    noseBot: [168 - nose * 0.3, 147],
    lipTop: [170, 152],
    mouth: [168, 157],
    lipBot: [172 - chin * 0.3, 161],
    chinDip: [171 - chin * 0.6, 165],
    chin: [177 - chin, 174 + jaw * 0.3],
    underChin: [192 - chin * 0.5, 181 + jaw],
    throat: [206, 183 + jaw],
    nape: [238, 180 + jaw * 0.6],
    skullLow: [250 + skull, 155],
    skullBack: [252 + skull, 118],
    skullTop: [240 + skull * 0.6, 85],
  }
  if (o.gaunt) {
    raw.chin = [raw.chin[0] + 2, raw.chin[1]]
    raw.underChin = [raw.underChin[0] + 6, raw.underChin[1] - 4]
  }
  const f: Fit = { s, dx, dy }
  const out: Record<string, Pt> = {}
  for (const k in raw) out[k] = fit(f)(raw[k])
  return Object.assign(out, { fit: f })
}

const HEAD_ORDER = ['crown', 'foreTop', 'fore', 'brow', 'eye', 'bridge', 'noseTip', 'noseBot', 'lipTop', 'mouth', 'lipBot', 'chinDip', 'chin', 'underChin', 'throat', 'nape', 'skullLow', 'skullBack', 'skullTop']

function drawHead(ctx: Ctx, H: Head, rng: Rng): void {
  shape(
    ctx,
    HEAD_ORDER.map((k) => H[k]),
    rng,
  )
}

function neck(ctx: Ctx, rng: Rng, x0: number, x1: number, yTop: number, yBot: number): void {
  poly(
    ctx,
    [
      [x0, yTop],
      [x1, yTop - 4],
      [x1 + 6, yBot],
      [x0 - 4, yBot],
    ],
    rng,
  )
}

function torso(ctx: Ctx, rng: Rng, pts: Pt[]): void {
  shape(ctx, pts.concat([[pts[pts.length - 1][0], 330], [pts[0][0], 330]]), rng)
}

const TORSO: Pt[] = [[30, 300], [70, 262], [105, 228], [140, 212], [175, 204], [200, 200], [230, 202], [265, 210], [300, 226], [335, 258], [375, 300]]
const NARROW: Pt[] = [[60, 300], [100, 250], [135, 222], [170, 208], [200, 203], [230, 208], [265, 222], [300, 250], [340, 300]]
const ORC_TORSO: Pt[] = [[18, 300], [60, 246], [100, 215], [140, 203], [190, 198], [240, 200], [280, 208], [315, 225], [350, 258], [386, 300]]

/** A tapered ribbon along a centreline (hair tails, braids, smoke), stroked in short pieces so bends never knot. */
function ribbon(ctx: Ctx, rng: Rng, line: Pt[], w0: number, w1: number, ease = 1): void {
  const pts = openSplineLocal(line, 8)
  const n = pts.length
  const wAt = (t: number) => w0 + (w1 - w0) * Math.pow(t, ease)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ctx.fillStyle
  const stop = w1 === 0 ? Math.round((n - 1) * 0.72) : n - 1
  for (let i = 0; i < stop; i++) {
    const w = wAt((i + 0.5) / (n - 1))
    if (w < 0.4) continue
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(pts[i][0], pts[i][1])
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1])
    ctx.stroke()
  }
  ctx.restore()
  if (w1 === 0) {
    const a = pts[stop]
    const b = pts[n - 1]
    const w = wAt(stop / (n - 1))
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy) || 1
    const nx = -dy / L
    const ny = dx / L
    const m = pts[Math.round((stop + n - 1) / 2)]
    const wm = w * 0.5
    shape(ctx, [[a[0] + (nx * w) / 2, a[1] + (ny * w) / 2], [m[0] + (nx * wm) / 2, m[1] + (ny * wm) / 2], [b[0], b[1], 1], [m[0] - (nx * wm) / 2, m[1] - (ny * wm) / 2], [a[0] - (nx * w) / 2, a[1] - (ny * w) / 2]], rng)
  }
}

function openSplineLocal(line: Pt[], k: number): Pt[] {
  const out: Pt[] = []
  const n = line.length
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

/** A feather: a stem with small sharp barbs on both sides (antennae, plumes). */
function feather(ctx: Ctx, rng: Rng, line: Pt[], wMax: number, teeth: number, pow = 0.7): void {
  const n = line.length
  const prof = (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), pow)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = ctx.fillStyle
  for (let i = 0; i < n - 1; i++) {
    ctx.lineWidth = Math.max(0.6, wMax * prof((i + 0.5) / (n - 1)) * (1 - teeth))
    ctx.beginPath()
    ctx.moveTo(line[i][0], line[i][1])
    ctx.lineTo(line[i + 1][0], line[i + 1][1])
    ctx.stroke()
  }
  ctx.restore()
  for (let i = 1; i < n - 1; i += 2) {
    const a = line[i - 1]
    const b = line[i + 1]
    const p = line[i]
    const t = i / (n - 1)
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy) || 1
    const tx = dx / L
    const ty = dy / L
    const nx = -ty
    const ny = tx
    const w = wMax * prof(t)
    const hc = (w * (1 - teeth)) / 2 - 0.5
    const hf = w / 2
    const d = L * 0.55
    const k = L * 0.5
    for (const sgn of [1, -1]) {
      const apex: Pt = [p[0] + nx * hf * sgn + tx * k, p[1] + ny * hf * sgn + ty * k, 1]
      poly(ctx, [[p[0] + nx * hc * sgn - tx * d, p[1] + ny * hc * sgn - ty * d], apex, [p[0] + nx * hc * sgn + tx * d, p[1] + ny * hc * sgn + ty * d]], rng)
    }
  }
  const q = line[n - 2]
  const e = line[n - 1]
  poly(ctx, [[q[0], q[1]], [e[0] + (e[0] - q[0]) * 2, e[1] + (e[1] - q[1]) * 2, 1], [q[0], q[1]]], rng)
}

// ---------- dress: hair, beards, hats, collars, trinkets (in default-head coordinates) ----------

type Hair = 'crop' | 'swept' | 'long' | 'tail' | 'bun' | 'braid' | 'curls' | 'bald' | 'topknot' | 'none'
type Beard = 'none' | 'short' | 'long' | 'goatee' | 'moustache'
type Hat = 'none' | 'kettle' | 'captain' | 'cap' | 'brimmed' | 'coif' | 'hood' | 'mitre' | 'veil' | 'cowl' | 'coronet'

function hair(ctx: Ctx, rng: Rng, f: Fit, kind: Hair): void {
  const S = (pts: Pt[]) => shape(ctx, fitAll(f, pts), rng)
  const R = (line: Pt[], w0: number, w1: number, ease = 1) => ribbon(ctx, rng, fitAll(f, line), w0 * f.s, w1 * f.s, ease)
  const D = (x: number, y: number, r: number) => {
    const p = fit(f)([x, y])
    disc(ctx, p[0], p[1], r * f.s, rng)
  }
  const cap: Pt[] = [[174, 96], [178, 74], [196, 60], [222, 56], [246, 62], [260, 84], [262, 116], [256, 150], [240, 150], [244, 120], [236, 94], [212, 84], [190, 90]]
  switch (kind) {
    case 'crop':
      S(cap)
      break
    case 'swept':
      S([[170, 92], [176, 66], [198, 48], [226, 42], [254, 50], [270, 76], [272, 112], [266, 146], [256, 160], [240, 152], [246, 120], [238, 94], [212, 84], [190, 90]])
      break
    case 'long':
      S([[170, 92], [176, 66], [198, 48], [226, 42], [254, 50], [270, 76], [274, 120], [282, 170], [292, 220], [296, 262], [288, 300], [226, 300], [226, 240], [232, 200], [236, 160], [240, 150], [246, 120], [238, 94], [212, 84], [190, 90]])
      R([[266, 150], [282, 200], [292, 250], [296, 296]], 20, 6, 1.3)
      R([[240, 200], [238, 250], [232, 300]], 12, 4, 1.2)
      break
    case 'tail':
      S(cap)
      S([[236, 138], [266, 136], [288, 176], [300, 220], [300, 300], [232, 300]])
      R([[254, 142], [268, 166], [278, 198], [280, 232], [274, 262], [262, 282]], 22, 4, 1.2)
      break
    case 'bun':
      S(cap)
      D(268, 96, 20)
      D(282, 112, 10)
      break
    case 'braid': {
      S(cap)
      const line: Pt[] = [[256, 146], [268, 176], [272, 210], [268, 246], [262, 282]]
      R(line, 16, 7, 1)
      for (let i = 0; i < 5; i++) D(line[i][0] + (i % 2 ? 4 : -4), line[i][1] + 8, 9 - i)
      R([[262, 282], [268, 300]], 6, 0, 1)
      break
    }
    case 'curls':
      for (const c of [[244, 118, 14], [258, 136, 14], [260, 158, 13], [250, 178, 12], [236, 194, 10], [172, 116, 10], [250, 110, 10], [196, 66, 12], [222, 58, 12], [240, 76, 12], [180, 84, 10]]) D(c[0], c[1], c[2])
      break
    case 'bald':
      S([[236, 110], [252, 108], [262, 130], [264, 160], [256, 176], [240, 170]])
      break
    case 'topknot':
      D(226, 56, 15)
      R([[236, 50], [270, 44], [296, 60], [310, 92]], 12, 3, 1.2)
      break
    default:
      break
  }
}

function beard(ctx: Ctx, rng: Rng, f: Fit, kind: Beard): void {
  const S = (pts: Pt[]) => shape(ctx, fitAll(f, pts), rng)
  switch (kind) {
    case 'short':
      S([[168, 160], [160, 170], [160, 184], [176, 196], [200, 200], [226, 194], [240, 176], [220, 170], [200, 176], [184, 166]])
      break
    case 'long':
      S([[168, 160], [158, 174], [150, 200], [146, 236], [152, 268, 1], [170, 246], [182, 258, 1], [194, 232], [210, 210], [228, 194], [238, 176], [218, 170], [200, 176], [184, 166]])
      break
    case 'goatee':
      S([[170, 160], [164, 176], [160, 200], [162, 220, 1], [176, 200], [190, 186], [196, 176], [182, 166]])
      break
    case 'moustache':
      S([[172, 150], [160, 150], [146, 154], [136, 160, 1], [148, 160], [162, 158], [176, 158]])
      break
    default:
      break
  }
}

function hat(ctx: Ctx, rng: Rng, f: Fit, kind: Hat, plume: boolean): void {
  const S = (pts: Pt[]) => shape(ctx, fitAll(f, pts), rng)
  const P = (pts: Pt[]) => poly(ctx, fitAll(f, pts), rng)
  const R = (line: Pt[], w0: number, w1: number, ease = 1) => ribbon(ctx, rng, fitAll(f, line), w0 * f.s, w1 * f.s, ease)
  switch (kind) {
    case 'kettle':
      S([[146, 118, 1], [158, 104], [170, 80], [194, 62], [224, 56], [254, 64], [272, 84], [280, 104], [292, 118, 1], [270, 116], [240, 112], [200, 112], [170, 114]])
      break
    case 'captain':
      S([[146, 112, 1], [156, 90], [182, 62], [218, 50], [250, 54], [274, 76], [284, 108], [282, 150], [268, 172], [252, 168], [256, 120], [240, 106], [200, 106], [170, 112]])
      if (plume) feather(ctx, rng, fitAll(f, quad([232, 52], [272, 36], [326, 96], 52)), 32 * f.s, 0.34, 0.5)
      break
    case 'cap':
      S([[150, 108, 1], [164, 94], [186, 78], [214, 70], [246, 72], [266, 84], [274, 104], [270, 112], [240, 110], [200, 108], [170, 110]])
      P([[152, 108], [124, 118, 1], [174, 116]])
      if (plume) feather(ctx, rng, fitAll(f, quad([248, 80], [262, 40], [300, 20], 40)), 18 * f.s, 0.4, 0.6)
      break
    case 'brimmed':
      S([[112, 118], [150, 110], [200, 108], [250, 108], [300, 112], [318, 120, 1], [300, 124], [250, 120], [200, 122], [150, 124], [116, 126, 1]])
      S([[160, 114], [166, 76], [186, 60], [214, 54], [244, 58], [262, 74], [268, 114]])
      if (plume) feather(ctx, rng, fitAll(f, quad([252, 100], [296, 60], [330, 50], 40)), 18 * f.s, 0.4, 0.6)
      break
    case 'coif':
      S([[166, 100], [176, 74], [202, 62], [236, 62], [258, 80], [264, 116], [258, 150], [244, 160], [240, 120], [226, 98], [200, 94], [180, 100]])
      break
    case 'hood':
      S([[156, 104, 1], [166, 84], [190, 62], [218, 48], [244, 42], [266, 42], [290, 56, 1], [270, 62], [262, 78], [262, 100], [264, 130], [268, 170], [280, 210], [296, 236], [250, 240], [200, 236], [174, 200], [186, 170], [188, 128], [184, 112]])
      break
    case 'cowl':
      S([[154, 106, 1], [162, 84], [186, 62], [220, 50], [256, 54], [282, 74], [292, 108], [290, 150], [296, 190], [306, 222, 1], [290, 230], [302, 244, 1], [250, 244], [200, 236], [176, 206], [186, 174], [188, 130], [184, 114]])
      break
    case 'mitre':
      S([[160, 98, 1], [162, 76], [172, 54], [188, 40], [204, 32, 1], [220, 42], [236, 56], [250, 78], [258, 98, 1], [268, 104, 1], [268, 114, 1], [158, 116, 1], [156, 104, 1]])
      R([[258, 110], [268, 140], [276, 172], [280, 200, 1]], 11, 0, 2)
      R([[248, 112], [254, 142], [258, 174], [260, 196, 1]], 9, 0, 2)
      break
    case 'veil':
      S([[166, 98], [180, 68], [210, 54], [246, 56], [272, 76], [286, 112], [292, 160], [302, 210], [312, 244, 1], [250, 244], [238, 200], [240, 150], [244, 118], [230, 98], [196, 96]])
      break
    case 'coronet':
      P([[170, 100], [172, 84], [182, 94], [192, 72], [204, 90], [218, 68], [232, 88], [244, 70], [254, 90], [262, 86], [262, 104]])
      break
    default:
      break
  }
}

function collar(ctx: Ctx, rng: Rng, f: Fit, kind: 'cloak' | 'high' | 'lace' | 'scarf' | 'ruff' | 'none'): void {
  const S = (pts: Pt[]) => shape(ctx, fitAll(f, pts), rng)
  switch (kind) {
    case 'cloak':
      S([[146, 230], [160, 192], [176, 176], [192, 186], [206, 206], [190, 232]])
      S([[232, 176], [258, 166], [284, 180], [304, 210], [300, 240], [250, 230]])
      break
    case 'high':
      S([[172, 216], [180, 190], [184, 170, 1], [200, 184], [210, 216]])
      S([[228, 214], [240, 184], [250, 160, 1], [268, 186], [276, 216]])
      break
    case 'lace': {
      const col: Pt[] = [[244, 208], [268, 206]]
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI * (0.12 - (0.68 * i) / 16)
        const r = i % 2 ? 72 : 78
        col.push(i % 2 ? [248 + Math.cos(a) * r, 186 + Math.sin(a) * r, 1] : [248 + Math.cos(a) * r, 186 + Math.sin(a) * r])
      }
      col.push([228, 112], [244, 140], [250, 170], [250, 206])
      S(col)
      S([[172, 214], [178, 196], [186, 184, 1], [192, 196], [198, 186, 1], [204, 198], [210, 214]])
      break
    }
    case 'ruff':
      for (let i = 0; i <= 10; i++) {
        const t = i / 10
        const p = fit(f)([150 + t * 120, 200 - Math.sin(t * Math.PI) * 10])
        disc(ctx, p[0], p[1], (9 + (i % 2) * 3) * f.s, rng)
      }
      break
    case 'scarf': {
      const k = fit(f)([182, 212])
      disc(ctx, k[0], k[1], 11 * f.s, rng)
      ribbon(ctx, rng, fitAll(f, [[178, 214], [158, 226], [138, 232], [118, 230]]), 13 * f.s, 0, 1.4)
      break
    }
    default:
      break
  }
}

/** A tiny ring cut out of the ink at the ear lobe, as a paper-cut silhouette would show an earring. */
function earring(ctx: Ctx, rng: Rng, f: Fit, at: Pt = [238, 150]): void {
  const p = fit(f)(at)
  cut(ctx, () => disc(ctx, p[0], p[1] + 6 * f.s, 4.5 * f.s, rng))
  disc(ctx, p[0], p[1] + 6 * f.s, 2.2 * f.s, rng)
}

function pipe(ctx: Ctx, rng: Rng, f: Fit): void {
  ribbon(ctx, rng, fitAll(f, [[168, 158], [150, 168], [132, 180]]), 5 * f.s, 4 * f.s)
  const b = fit(f)([130, 182])
  shape(ctx, [[b[0] - 8 * f.s, b[1] - 8 * f.s], [b[0] + 6 * f.s, b[1] - 6 * f.s], [b[0] + 6 * f.s, b[1] + 8 * f.s], [b[0] - 6 * f.s, b[1] + 8 * f.s]], rng)
  const s0 = fit(f)([128, 168])
  ribbon(ctx, rng, [[s0[0], s0[1]], [s0[0] - 4, s0[1] - 14], [s0[0] + 6, s0[1] - 26], [s0[0] - 2, s0[1] - 40]], 3, 0, 1)
}

function scar(ctx: Ctx, rng: Rng, f: Fit): void {
  const where = rng.pick<Pt[]>([
    [[164, 112], [174, 100], [176, 114]],
    [[172, 178], [186, 170], [186, 184]],
    [[170, 92], [178, 80], [182, 96]],
  ])
  cut(ctx, () => poly(ctx, fitAll(f, where), rng))
}

// ---------- the base cuts ----------

type Base = (ctx: Ctx, v: Variant) => void

/** Which hat a role calls for on a human-shaped head, with a little chance for personal taste. */
function hatFor(v: Variant, fallback: Hat[]): Hat {
  switch (v.role) {
    case 'soldier':
      return 'kettle'
    case 'captain':
      return v.rng.chance(0.6) ? 'captain' : 'cap'
    case 'priest':
      return v.fem ? 'veil' : 'mitre'
    case 'mage':
      return 'hood'
    case 'undertaker':
      return 'cowl'
    case 'crown':
      return 'coronet'
    case 'noble':
      return v.rng.chance(0.25) ? (v.fem ? 'none' : 'brimmed') : 'none'
    default:
      return v.rng.pick(fallback)
  }
}

function hairFor(v: Variant, covered: boolean): Hair {
  const r = v.rng
  if (v.fem) return r.pick<Hair>(covered ? ['crop', 'long', 'tail', 'braid', 'long'] : ['long', 'tail', 'bun', 'braid', 'swept', 'curls', 'long'])
  return r.pick<Hair>(covered ? ['crop', 'crop', 'swept', 'tail', 'none'] : ['crop', 'swept', 'tail', 'bald', 'curls', 'crop', 'swept'])
}

function beardFor(v: Variant): Beard {
  if (v.fem) return 'none'
  return v.rng.pick<Beard>(['none', 'none', 'short', 'short', 'long', 'goatee', 'moustache'])
}

/** Humans, elves and halflings share one bust and differ in head, ears, hair and dress. */
function humanoid(ctx: Ctx, v: Variant, kind: 'human' | 'elf' | 'halfling'): void {
  const r = v.rng
  const small = v.role === 'child'
  const H = head({
    s: kind === 'halfling' ? (small ? 0.68 : 0.8) : small ? 0.72 : v.fem ? 0.95 : 1,
    dy: kind === 'halfling' ? (small ? 38 : 24) : small ? 34 : v.fem ? 6 : 0,
    brow: kind === 'elf' ? -2 : r.range(-1, 3),
    nose: kind === 'halfling' ? r.range(-3, -1) : kind === 'elf' ? r.range(0, 2) : r.range(-1, 3),
    chin: kind === 'halfling' ? -2 : r.range(-1, 2),
    jaw: v.fem ? 0 : r.range(0, 2),
    skull: kind === 'elf' ? 4 : r.range(-2, 3),
  })
  const f = H.fit
  drawHead(ctx, H, r)
  neck(ctx, r, H.throat[0] - 10, H.nape[0] + 2, H.throat[1] - 6, H.throat[1] + 32)
  const body = small ? [[66, 300], [106, 256], [142, 232], [174, 222], [200, 218], [226, 222], [258, 232], [292, 256], [334, 300]] : kind === 'halfling' ? [[66, 300], [106, 256], [142, 230], [174, 219], [200, 215], [226, 219], [258, 230], [292, 256], [334, 300]] : v.fem || kind === 'elf' || v.role === 'noble' ? NARROW : TORSO
  torso(ctx, r, body as Pt[])

  const hatKind = hatFor(v, kind === 'halfling' ? ['cap', 'none', 'none', 'coif'] : ['none', 'none', 'none', 'cap', 'brimmed', 'coif', 'hood'])
  const covered = hatKind !== 'none' && hatKind !== 'coronet'
  const hairKind: Hair = kind === 'halfling' && r.chance(0.6) ? 'curls' : v.role === 'noble' && v.fem ? 'bun' : hairFor(v, covered)
  hair(ctx, r, f, hairKind)
  if (v.role === 'noble' && v.fem) {
    const D = (x: number, y: number, rad: number) => {
      const p = fit(f)([x, y])
      disc(ctx, p[0], p[1], rad * f.s, r)
    }
    for (const c of [[232, 38, 11], [252, 52, 10], [264, 72, 9], [268, 96, 8], [190, 60, 9], [204, 46, 8], [258, 116, 10], [266, 136, 9]]) D(c[0], c[1], c[2])
    ribbon(ctx, r, fitAll(f, [[262, 150], [272, 170], [268, 190], [276, 210]]), 10 * f.s, 0, 1)
    poly(ctx, fitAll(f, [[236, 44], [246, 24], [244, 48]]), r)
  }
  beard(ctx, r, f, small ? 'none' : beardFor(v))
  hat(ctx, r, f, hatKind, r.chance(0.6))
  if (kind === 'elf') shape(ctx, fitAll(f, [[238, 126], [262, 118], [288, 106], [314, 92, 1], [296, 112], [272, 134], [254, 150], [240, 150]]), r)

  const col = v.role === 'noble' ? (v.fem ? 'lace' : r.pick(['ruff', 'high'] as const)) : v.role === 'crown' ? 'ruff' : kind === 'elf' ? 'high' : kind === 'halfling' ? (r.chance(0.7) ? 'scarf' : 'none') : v.role === 'soldier' || v.role === 'captain' ? 'cloak' : r.pick(['cloak', 'none', 'high', 'scarf'] as const)
  collar(ctx, r, f, col)
  if (v.role === 'soldier' && kind !== 'halfling') {
    ribbon(ctx, r, [[302, 300], [304, 200], [306, 126]], 6, 6)
    shape(ctx, [[306, 128], [296, 110], [306, 72, 1], [316, 110]], r)
  }
  if (v.role === 'mage' || (kind === 'elf' && r.chance(0.3))) {
    ribbon(ctx, r, [[330, 300], [324, 220], [318, 160], [312, 116]], 9, 7)
    shape(ctx, [[304, 118], [298, 100], [292, 80, 1], [306, 96], [316, 94], [326, 84, 1], [328, 102], [322, 118], [314, 124]], r)
    disc(ctx, 312, 104, 8, r)
  }
  if (!small && (kind === 'halfling' ? r.chance(0.5) : r.chance(0.12))) pipe(ctx, r, f)
  if ((v.fem || v.role === 'noble' || kind === 'elf') && r.chance(0.5) && hairKind !== 'long' && hairKind !== 'curls') earring(ctx, r, f, kind === 'elf' ? [250, 146] : [238, 150])
  if (!small && (v.role === 'soldier' || v.role === 'captain') && r.chance(0.5)) scar(ctx, r, f)
}

function dwarf(ctx: Ctx, v: Variant): void {
  const r = v.rng
  const f: Fit = { s: 1.05, dx: 4, dy: 10 }
  shape(ctx, [[210, 72], [176, 88], [160, 108], [164, 118], [160, 124], [138, 140, 1], [148, 152], [160, 158], [170, 172], [186, 184], [212, 190], [246, 184], [256, 150], [254, 112], [240, 86]], r)
  neck(ctx, r, 198, 250, 180, 225)
  shape(ctx, [[190, 300], [196, 250], [200, 212, 1], [300, 206, 1], [352, 210, 1], [372, 232, 1], [384, 300], [384, 330], [190, 330]], r)
  // hair or helm
  const hatKind = v.role === 'soldier' || v.role === 'captain' || (v.role === 'plain' && r.chance(0.4)) ? 'helm' : hatFor(v, ['none'])
  if (hatKind === 'helm') {
    shape(ctx, [[146, 110, 1], [156, 92], [176, 72], [204, 60], [236, 60], [262, 74], [278, 96], [286, 112, 1], [262, 112], [200, 110], [166, 112]], r)
    poly(ctx, [[150, 108], [160, 110], [154, 144], [145, 142]], r)
    poly(ctx, [[262, 112], [290, 114], [292, 134], [270, 132]], r)
    if (v.role === 'captain') feather(ctx, rng2(r), quad([230, 60], [268, 30], [320, 70], 48), 26, 0.36, 0.5)
  } else {
    hair(ctx, r, f, v.fem ? r.pick<Hair>(['braid', 'bun', 'long']) : r.pick<Hair>(['crop', 'bald', 'swept', 'tail']))
    if (hatKind !== 'none') hat(ctx, r, f, hatKind, false)
  }
  // beard: one mass hanging in front of the chest
  const b = v.fem ? r.pick(['short', 'none', 'braids'] as const) : r.pick(['braids', 'braids', 'spade', 'spade', 'single'] as const)
  if (b === 'braids') {
    shape(ctx, [[176, 150], [150, 166], [128, 186], [114, 210], [108, 236], [104, 258], [98, 290, 1], [114, 262], [124, 248], [134, 262], [136, 294, 1], [154, 278], [176, 272], [192, 264], [200, 250], [206, 234], [226, 222], [246, 206], [246, 182], [216, 172]], r)
    disc(ctx, 104, 270, 8, r)
    disc(ctx, 136, 276, 8, r)
  } else if (b === 'spade') {
    shape(ctx, [[176, 150], [150, 166], [130, 190], [118, 222], [116, 258], [124, 292, 1], [150, 284], [176, 272], [192, 264], [206, 234], [226, 222], [246, 206], [246, 182], [216, 172]], r)
  } else if (b === 'single') {
    shape(ctx, [[176, 150], [150, 166], [134, 190], [126, 220], [128, 250], [134, 270], [142, 288, 1], [160, 272], [176, 264], [192, 256], [206, 234], [226, 222], [246, 206], [246, 182], [216, 172]], r)
    disc(ctx, 134, 272, 10, r)
    ribbon(ctx, r, [[136, 280], [140, 300]], 8, 4)
  } else if (b === 'short') {
    shape(ctx, [[176, 150], [152, 168], [146, 190], [156, 206], [180, 212], [206, 206], [226, 196], [246, 186], [246, 182], [216, 172]], r)
  }
  if (r.chance(0.5)) earring(ctx, r, f, [244, 146])
  if (r.chance(0.25)) pipe(ctx, r, { s: 1, dx: -16, dy: 12 })
}

function rng2(r: Rng): Rng {
  return new Rng(Math.floor(r.next() * 4294967295))
}

function orcHead(ctx: Ctx, r: Rng, tusk: number): void {
  shape(ctx, [[214, 74], [190, 82], [172, 100], [158, 114], [163, 124], [160, 130], [150, 144], [156, 152], [160, 156], [158, 160], [150, 168], [152, 180], [160, 190], [184, 198], [214, 200], [250, 192], [262, 160], [262, 118], [246, 86]], r)
  poly(ctx, [[196, 192], [262, 184], [268, 226], [192, 226]], r)
  shape(ctx, [[146, 172], [142, 158], [138 - tusk * 3, 140 - tusk * 6, 1], [154, 160], [162, 170]], r)
  shape(ctx, [[160, 170], [158, 160], [155 - tusk * 2, 148 - tusk * 4, 1], [168, 160], [174, 168]], r)
}

function pauldron(ctx: Ctx, r: Rng): void {
  shape(ctx, [[240, 206], [264, 186], [300, 184], [330, 200], [342, 226], [338, 254], [300, 256], [240, 254]], r)
  shape(ctx, [[300, 252], [338, 250], [352, 266], [356, 300], [296, 300]], r)
}

function orc(ctx: Ctx, v: Variant): void {
  const r = v.rng
  const f: Fit = { s: 1.12, dx: 2, dy: 10 }
  orcHead(ctx, r, v.fem ? r.range(0, 1) : r.range(0.5, 2))
  torso(ctx, r, ORC_TORSO)
  shape(ctx, [[250, 122], [274, 102, 1], [264, 142]], r)
  const hatKind: Hat = v.role === 'soldier' ? 'captain' : hatFor(v, ['none', 'none', 'none', 'coif'])
  if (hatKind === 'none' || hatKind === 'coronet') hair(ctx, r, f, v.fem ? r.pick<Hair>(['topknot', 'braid', 'long', 'tail']) : r.pick<Hair>(['none', 'none', 'topknot', 'crop', 'braid']))
  hat(ctx, r, f, hatKind, v.role === 'captain')
  if (v.role === 'soldier' || v.role === 'captain' || r.chance(0.5)) pauldron(ctx, r)
  else collar(ctx, r, f, v.role === 'noble' ? 'ruff' : 'cloak')
  if (r.chance(0.5)) {
    cut(ctx, () => disc(ctx, 262, 128, 4, r))
  }
  if ((v.role === 'soldier' || v.role === 'captain') && r.chance(0.7)) {
    cut(ctx, () => {
      poly(ctx, [[146, 200], [168, 184], [170, 202]], r)
      if (r.chance(0.5)) poly(ctx, [[352, 216], [334, 214], [344, 234]], r)
    })
  }
  if (r.chance(0.15)) pipe(ctx, r, { s: 1.1, dx: -14, dy: 14 })
}

function lithic(ctx: Ctx, v: Variant): void {
  const r = v.rng
  const f: Fit = { s: 1.06, dx: 4, dy: 8 }
  poly(ctx, [[208, 66], [186, 74], [176, 90], [172, 106], [164, 114], [170, 122], [164, 132], [152, 142], [166, 148], [166, 160], [162, 172], [166, 186], [192, 192], [212, 192], [242, 186], [252, 160], [256, 130], [258, 112], [248, 88]], r)
  poly(ctx, [[196, 184], [246, 178], [252, 220], [192, 220]], r)
  poly(ctx, [[28, 300], [66, 258], [108, 224], [148, 210], [190, 203], [240, 204], [284, 213], [320, 236], [354, 268], [380, 300], [380, 330], [28, 330]], r)
  const hatKind = hatFor(v, ['none'])
  if (hatKind === 'none' || hatKind === 'coronet') {
    const shards: Pt[][] = [
      [[180, 86], [168, 44], [192, 74]],
      [[198, 70], [204, 34], [220, 66]],
      [[222, 68], [242, 38], [244, 76]],
      [[246, 82], [268, 56], [260, 100]],
      [[160, 108], [148, 90], [172, 98]],
    ]
    const n = r.int(3, 5)
    for (let i = 0; i < n; i++) {
      const s = shards[i]
      const g = r.range(0.8, 1.25)
      poly(ctx, [s[0], [s[1][0], s[0][1] + (s[1][1] - s[0][1]) * g], s[2]], r)
    }
  } else hat(ctx, r, f, hatKind, v.role === 'captain')
  poly(ctx, [[262, 212], [296, 194], [330, 206], [346, 232], [320, 236]], r)
  cut(ctx, () => {
    poly(ctx, [[262, 120], [246, 118], [260, 130]], r)
    poly(ctx, [[296, 216], [292, 236], [308, 228]], r)
    if (r.chance(0.6)) poly(ctx, [[158, 186], [170, 180], [172, 196]], r)
    if (r.chance(0.6)) poly(ctx, [[126, 208], [138, 228], [118, 226]], r)
    if (r.chance(0.5)) poly(ctx, [[200, 100], [206, 118], [196, 116]], r)
  })
}

function vesh(ctx: Ctx, v: Variant): void {
  const r = v.rng
  const wing = r.range(0.85, 1.1)
  const W = (pts: Pt[]) => shape(ctx, pts.map((p) => (p[2] ? [244 + (p[0] - 244) * wing, 240 + (p[1] - 240) * wing, 1] : [244 + (p[0] - 244) * wing, 240 + (p[1] - 240) * wing])), r)
  W([[244, 218], [248, 170], [256, 122], [272, 88], [292, 70], [308, 70], [322, 86], [334, 116], [344, 154], [348, 190], [344, 218], [330, 236], [300, 242], [244, 242]])
  W([[256, 224], [266, 186], [284, 156], [306, 142], [328, 150], [344, 178], [350, 206], [344, 230], [320, 240], [256, 240]])
  cut(ctx, () => {
    for (const q of [[330, 104], [341, 138], [347, 172], [349, 204]]) {
      const x = 244 + (q[0] - 244) * wing
      const y = 240 + (q[1] - 240) * wing
      poly(ctx, [[x + 10, y - 7], [x + 10, y + 7], [x - 4, y]], r)
    }
  })
  shape(ctx, [[206, 78], [182, 84], [168, 102], [164, 124], [170, 146], [186, 160], [206, 164], [228, 158], [244, 140], [248, 116], [238, 92]], r)
  poly(ctx, [[192, 154], [222, 152], [226, 186], [188, 186]], r)
  torso(ctx, r, [[70, 300], [104, 254], [140, 226], [172, 214], [200, 210], [226, 214], [250, 226], [266, 252], [276, 300]])
  const f: Fit = { s: 0.86, dx: 6, dy: -8 }
  const hatKind = hatFor(v, ['none', 'none', 'coif'])
  if (hatKind !== 'none') hat(ctx, r, f, hatKind, v.role === 'captain')
  for (let i = 0; i <= 18; i++) {
    const a = Math.PI * (0.03 + (0.94 * i) / 18)
    disc(ctx, 206 - Math.cos(a) * 44, 172 - Math.sin(a) * 12, 8 + (i % 2) * 2, r)
  }
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    disc(ctx, 190 - t * 76, 190 + t * 64 - Math.sin(t * Math.PI) * 4, 6 + (i % 3), r)
  }
  for (let i = 0; i <= 5; i++) {
    const t = i / 5
    disc(ctx, 226 + t * 26, 190 + t * 18, 6 + (i % 3), r)
  }
  const spread = r.range(0.8, 1.2)
  const droop = v.fem ? r.range(0.9, 1.3) : r.range(0.6, 1)
  feather(ctx, r, quad([182, 98], [140 - 10 * spread, 46 * droop], [100 - 20 * spread, 70 * droop], 64), 40 * spread, 0.6, 0.5)
  feather(ctx, r, quad([198, 86], [170, 34 * droop], [132 - 10 * spread, 46 * droop], 64), 36 * spread, 0.6, 0.5)
  if (r.chance(0.4)) earring(ctx, r, { s: 1, dx: 0, dy: 0 }, [236, 132])
}

function hollowborn(ctx: Ctx, v: Variant): void {
  const r = v.rng
  const H = head({ nose: 3, chin: 1, brow: -1, gaunt: true, skull: -4, dy: 14, s: v.role === 'child' ? 0.8 : 1 })
  H.noseTip = [153, 157]
  H.chin = [178, 190]
  H.underChin = [194, 192]
  H.throat = [206, 194]
  drawHead(ctx, H, r)
  neck(ctx, r, 198, 236, 188, 222)
  const hooded = v.role !== 'noble' && v.role !== 'soldier' && v.role !== 'captain' && r.chance(0.75)
  if (hooded) {
    shape(ctx, [[158, 116, 1], [168, 96], [190, 74], [222, 60], [258, 66], [284, 92], [296, 132], [294, 176], [298, 222], [324, 262], [354, 300], [330, 330], [60, 330], [60, 300], [92, 258], [126, 226], [152, 210], [170, 198], [186, 186], [188, 142], [184, 124]], r)
  } else {
    torso(ctx, r, NARROW)
    hair(ctx, r, H.fit, v.fem ? r.pick<Hair>(['long', 'braid', 'crop']) : r.pick<Hair>(['crop', 'bald', 'swept']))
    const hk = hatFor(v, ['none', 'coif', 'cap'])
    hat(ctx, r, H.fit, hk, v.role === 'captain')
    collar(ctx, r, H.fit, v.role === 'noble' ? 'lace' : 'cloak')
  }
  const tendril = (line: Pt[], w: number, root: number) => {
    disc(ctx, line[0][0], line[0][1], root, r)
    disc(ctx, (line[0][0] + line[1][0]) / 2, (line[0][1] + line[1][1]) / 2, root * 0.8, r)
    ribbon(ctx, r, line, w, 0, 1.2)
  }
  const drift = r.range(0.8, 1.2)
  const T = (line: Pt[]) => line.map((p): Pt => [p[0], 150 + (p[1] - 150) * drift])
  tendril(T([[238, 64], [254, 50], [272, 46], [288, 52], [296, 64], [292, 76]]), 11, 8)
  tendril(T([[288, 104], [310, 94], [330, 98], [344, 110], [352, 124]]), 10, 8)
  tendril(T([[294, 142], [314, 138], [332, 144], [350, 140], [356, 148]]), 9, 7)
  if (r.chance(0.7)) tendril(T([[296, 178], [316, 174], [336, 180], [352, 176]]), 7, 6)
  if (hooded) tendril(T([[198, 72], [194, 58], [200, 46]]), 6, 5)
  for (const q of [[306, 82, 2.2], [360, 130, 2], [346, 196, 1.8], [206, 38, 1.8]]) disc(ctx, q[0], 150 + (q[1] - 150) * drift, q[2], r)
}

function raveler(ctx: Ctx, v: Variant): void {
  const r = v.rng
  const beak = r.range(0.85, 1.2)
  shape(ctx, [[216, 78], [190, 86], [176, 104], [150, 116], [112 - (beak - 1) * 60, 138 + (beak - 1) * 10, 1], [150, 142], [176, 140], [186, 152], [200, 166], [236, 170], [252, 146], [256, 112], [242, 86]], r)
  shape(ctx, [[188, 148], [176, 164, 1], [186, 176], [172, 190, 1], [186, 202], [178, 216], [274, 216], [272, 194], [264, 172], [252, 158], [226, 164]], r)
  const hk = v.role === 'mage' || v.role === 'priest' || v.role === 'undertaker' ? 'cowl' : v.role === 'noble' || v.role === 'crown' ? 'cap' : 'none'
  if (hk === 'none' || r.chance(0.5)) {
    const spike = r.range(0.8, 1.3)
    shape(ctx, [[236, 92], [262 + 6 * spike, 78 - 8 * spike, 1], [252, 104], [274 + 6 * spike, 98, 1], [258, 122], [280 + 6 * spike, 122, 1], [258, 140], [280 + 6 * spike, 148, 1], [258, 162], [282 + 6 * spike, 174, 1], [262, 184], [284, 200, 1], [262, 206], [246, 176], [238, 150], [240, 110]], r)
  }
  shape(ctx, [[40, 300], [60, 256], [96, 220], [140, 200], [196, 190], [242, 194], [282, 206], [314, 232], [346, 300], [346, 330], [40, 330]], r)
  shape(ctx, [[120, 226], [138, 212], [160, 246], [140, 262], [124, 244], [96, 250, 1], [112, 258], [92, 276, 1], [116, 282], [102, 300], [160, 300], [162, 260]], r)
  shape(ctx, [[270, 212], [296, 220], [322, 248, 1], [304, 250], [330, 274, 1], [310, 280], [328, 300], [270, 300]], r)
  if (hk === 'cowl') {
    shape(ctx, [[176, 96, 1], [186, 76], [212, 60], [244, 58], [270, 72], [282, 100], [284, 140], [290, 180], [304, 214, 1], [288, 222], [300, 240, 1], [250, 240], [222, 196], [234, 168], [228, 130], [214, 104]], r)
  } else if (hk === 'cap') {
    shape(ctx, [[172, 100, 1], [186, 82], [214, 70], [246, 72], [266, 86], [270, 106], [244, 100], [212, 98], [186, 104]], r)
  }
  if (r.chance(0.4)) {
    // a bone bead or ring on a cord at the throat
    cut(ctx, () => disc(ctx, 214, 206, 5, r))
  }
  if (v.role === 'soldier') {
    ribbon(ctx, r, [[302, 300], [304, 200], [306, 126]], 6, 6)
    shape(ctx, [[306, 128], [296, 110], [306, 72, 1], [316, 110]], r)
  }
}

function shellback(ctx: Ctx, v: Variant): void {
  const r = v.rng
  const dome = r.range(0.92, 1.08)
  const sh: Pt[] = [[214, 300], [214, 212]]
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (1.0 + (1.0 * i) / 12)
    sh.push([305 + Math.cos(a) * 92, 216 + Math.sin(a) * 124 * dome])
  }
  sh.push([397, 300], [397, 330], [214, 330])
  shape(ctx, sh, r)
  torso(ctx, r, [[40, 300], [84, 250], [124, 220], [160, 208], [200, 204], [240, 204], [280, 212]])
  const collarUp = v.role === 'noble' || v.role === 'crown' || r.chance(0.6)
  if (collarUp) {
    shape(ctx, [[148, 238], [166, 180, 1], [200, 194], [206, 240]], r)
    shape(ctx, [[200, 230], [214, 184, 1], [240, 196], [244, 234]], r)
  } else {
    for (let i = 0; i <= 7; i++) disc(ctx, 150 + i * 14, 212 - Math.sin((i / 7) * Math.PI) * 10, 9 + (i % 2) * 2, r)
  }
  const reach = r.range(0.9, 1.1)
  const N = (p: Pt): Pt => [232 + (p[0] - 232) * reach, 200 + (p[1] - 200) * reach]
  const neckLine: Pt[] = [[232, 200], [216, 176], [196, 154], [176, 138], [156, 128]]
  ribbon(ctx, r, neckLine.map(N), 54, 30, 1)
  for (const [x, y, rad] of [[214, 204, 13], [198, 190, 12], [182, 174, 11], [166, 160, 10], [152, 148, 8]]) {
    const p = N([x, y])
    disc(ctx, p[0], p[1], rad, r)
  }
  const hp: Pt[] = [[172, 124], [160, 108], [140, 100], [116, 102], [98, 110], [84, 122], [74, 132, 1], [84, 136], [100, 140], [120, 144], [142, 146], [160, 144], [174, 136]]
  shape(ctx, hp.map(N), r)
  const hk = hatFor(v, ['none', 'none', 'cap', 'coif'])
  const hf: Fit = { s: 0.45, dx: N([128, 118])[0] - 200 - 10, dy: N([128, 118])[1] - 150 - 12 }
  if (hk === 'veil' || hk === 'hood' || hk === 'cowl') hat(ctx, r, hf, 'coif', false)
  else if (hk !== 'none') hat(ctx, r, hf, hk, v.role === 'captain')
  if (v.fem && r.chance(0.6)) {
    // a lace cap with a tail, as the old bankers' wives wear
    const p = N([150, 104])
    shape(ctx, [[p[0] - 14, p[1] + 4], [p[0] - 6, p[1] - 10], [p[0] + 14, p[1] - 12], [p[0] + 26, p[1] - 2], [p[0] + 30, p[1] + 14], [p[0] + 16, p[1] + 8]], r)
    ribbon(ctx, r, [[p[0] + 28, p[1] + 8], [p[0] + 40, p[1] + 26], [p[0] + 44, p[1] + 48]], 8, 0, 1.2)
  }
  cut(ctx, () => {
    const cuts = r.int(2, 4)
    for (let i = 0; i < cuts; i++) {
      const fr = 0.18 + (0.64 * i) / Math.max(1, cuts - 1)
      const a = Math.PI * (1 + fr)
      const x = 305 + Math.cos(a) * 92
      const y = 216 + Math.sin(a) * 124 * dome
      const nx = Math.cos(a)
      const ny = Math.sin(a) * 0.82
      poly(ctx, [[x + nx * 9 - ny * 3.5, y + ny * 9 + nx * 3.5], [x + nx * 9 + ny * 3.5, y + ny * 9 - nx * 3.5], [x - nx * 7, y - ny * 7]], r)
    }
    const m = N([70, 133])
    const m2 = N([100, 136])
    poly(ctx, [m, m2, [m2[0] - 2, m2[1] - 4]], r)
    if (r.chance(0.5)) {
      // a monocle on a ribbon
      const e = N([118, 118])
      disc(ctx, e[0], e[1], 6, r)
    }
  })
}

const BASES: Record<Ancestry, Base> = {
  human: (ctx, v) => humanoid(ctx, v, 'human'),
  elf: (ctx, v) => humanoid(ctx, v, 'elf'),
  halfling: (ctx, v) => humanoid(ctx, v, 'halfling'),
  dwarf,
  orc,
  lithic,
  vesh,
  hollowborn,
  raveler,
  shellback,
}

// ---------- the cameo ----------

/** The figure alone, on a transparent layer the size of the target canvas, and whether it is a ghost. */
function figureLayer(w: number, h: number, key: string, page?: ExPage): { layer: HTMLCanvasElement; ghost: boolean } | undefined {
  const rng = new Rng(seedOf(key))
  const ancestry = ancestryOf(page)
  const text = ((page?.summary ?? '') + ' ' + (page?.tags ?? []).join(' ')).toLowerCase()
  let role = roleOf(page, text)
  const ghost = page?.status === 'dead' || /ghost|spirit|shade|revenant|drowned|dead/.test(fieldOf(page, 'Role') + ' ' + (page?.tags ?? []).join(' '))
  if (role === 'child' && (ancestry === 'shellback' || ancestry === 'lithic')) role = 'plain'
  const fem = femOf(page, rng)
  const faceRight = rng.chance(0.5)
  const v: Variant = { rng, role, fem, ghost }
  const layer = document.createElement('canvas')
  layer.width = w
  layer.height = h
  const lc = layer.getContext('2d')
  if (!lc) return undefined
  lc.scale(w / 400, h / 300)
  if (faceRight) {
    lc.translate(400, 0)
    lc.scale(-1, 1)
  }
  lc.fillStyle = INK
  if (role === 'child' && ancestry !== 'human' && ancestry !== 'elf' && ancestry !== 'halfling' && ancestry !== 'hollowborn') {
    lc.translate(200, 300)
    lc.scale(0.8, 0.8)
    lc.translate(-200, -300)
  }
  BASES[ancestry](lc, v)
  return { layer, ghost }
}

/** Draws a figure layer onto a canvas; the dead come out as an outline with a faint wash inside. */
function placeFigure(ctx: Ctx, layer: HTMLCanvasElement, ghost: boolean): void {
  const w = layer.width
  const h = layer.height
  if (!ghost) {
    ctx.drawImage(layer, 0, 0)
    return
  }
  const ring = document.createElement('canvas')
  ring.width = w
  ring.height = h
  const rc = ring.getContext('2d')
  if (rc) {
    const d = Math.max(1.5, w / 260)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      rc.drawImage(layer, Math.cos(a) * d, Math.sin(a) * d)
    }
    rc.globalCompositeOperation = 'destination-out'
    rc.drawImage(layer, 0, 0)
    ctx.drawImage(ring, 0, 0)
  }
  ctx.globalAlpha = 0.16
  ctx.drawImage(layer, 0, 0)
  ctx.globalAlpha = 1
}

/** The bust alone, without the cameo: for a poster. The canvas is 4:3; the figure fills it. */
export function drawBust(ctx: Ctx, w: number, h: number, key: string, page?: ExPage): void {
  const fig = figureLayer(w, h, key, page)
  if (!fig) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  placeFigure(ctx, fig.layer, fig.ghost)
  ctx.restore()
}

/** Draws the silhouette for a page into a 4:3 canvas (640 x 480 by default). */
export function drawSilhouette(ctx: Ctx, w: number, h: number, key: string, page?: ExPage): void {
  const CX = 200
  const CY = 150
  const RX = 164
  const RY = 126
  const fig = figureLayer(w, h, key, page)
  if (!fig) return
  ctx.save()
  ctx.scale(w / 400, h / 300)

  // ground: paper oval with a faint stipple
  const g = new Rng(seedOf(key + '/ground'))
  ctx.fillStyle = PAPER
  ctx.beginPath()
  ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = INK
  ctx.globalAlpha = 0.06
  for (let i = 0; i < 120; i++) {
    const a = g.next() * Math.PI * 2
    const rr = Math.sqrt(g.next())
    ctx.beginPath()
    ctx.arc(CX + Math.cos(a) * rr * (RX - 6), CY + Math.sin(a) * rr * (RY - 6), 0.6 + g.next() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // the figure, clipped to the inner rule
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(CX, CY, RX - 7, RY - 7, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  placeFigure(ctx, fig.layer, fig.ghost)
  ctx.restore()

  // the double rule
  ctx.strokeStyle = RULE
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.ellipse(CX, CY, RX - 7, RY - 7, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}
