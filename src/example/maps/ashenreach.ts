import type { Drawing, LabelFont, Point, Shape } from '../../mapDrawing'
import type { ExMap } from '../types'
import { arc, blob, label, line, piece, Room, rng, rough, scatter } from './draw'

/**
 * The Ashenreach and the March of Cinders, about 18 px to the mile along the Ash Road (a little
 * stretched round Cinderford so the places near town have room). Distances follow the place pages:
 * the Treaty Stone 3 mi east, the mission 1 mi, the Orchard 2 mi north-east, Stillwater 15 mi
 * north-east, Fort Mercy 22 mi, the Rent's western end 38 mi, the Rent itself 31 mi long, north-east.
 */
const W = 1600
const H = 1100

// where things are
const TOWN: Point = [178, 652]
const FORD: Point = [222, 646]
const KEEP: Point = [140, 612]
const HILL: Point = [116, 630]
const MISSION: Point = [276, 690]
const STONE: Point = [334, 634]
const ORCHARD: Point = [300, 556]
const RISE: Point = [132, 752]
const MILL: Point = [420, 630]
const FORT: Point = [614, 632]
const STILLWATER: Point = [398, 470]
const RENT_W: Point = [905, 662]
const RENT_E: Point = [1288, 266]
const NINTH: Point = [1300, 262]

const RIVER: Point[] = [[350, -10], [338, 70], [320, 150], [300, 240], [284, 330], [264, 420], [248, 500], [236, 570], [222, 640], [206, 700], [180, 760], [140, 810], [90, 846], [30, 872], [-12, 884]]
const ASH_ROAD: Point[] = [[FORD[0], 650], [334, 650], [470, 652], [614, 656], [760, 660], [RENT_W[0] - 6, 664]]
const WEST_ROAD: Point[] = [[FORD[0], 650], [TOWN[0], 646], [110, 648], [50, 654], [-10, 660]]

export const ASHENREACH: ExMap = {
  key: 'ashenreach',
  name: 'The Ashenreach',
  width: W,
  height: H,
  players: true,
  location: 'ashenreach',
  drawing: ashenreach,
  pins: [
    { page: 'cinderford', at: TOWN, piece: 'cinderford', map: 'cinderford' },
    { page: 'lantern-keep', at: KEEP, piece: 'lantern-keep' },
    { page: 'lantern-hill', at: HILL, piece: 'lantern-hill' },
    { page: 'the-ford', at: FORD },
    { page: 'glass-barrow', at: [FORD[0] - 6, FORD[1] + 46], note: 'Under the ford: the way in is the hollow at the foot of the bridge’s third pier.' },
    { page: 'house-unburnt-light', at: MISSION, piece: 'mission' },
    { page: 'treaty-stone', at: STONE, piece: 'treaty-stone' },
    { page: 'weeping-orchard', at: [ORCHARD[0], ORCHARD[1] - 8] },
    { page: 'corvel-rise', at: RISE, piece: 'corvel-rise' },
    { page: 'stillwater', at: STILLWATER, piece: 'stillwater' },
    { page: 'fort-mercy', at: FORT, piece: 'fort-mercy' },
    { page: 'cold-seam', at: [FORT[0] + 34, FORT[1] + 6], note: 'Behind the Lithic panel in the fort’s cellar; it runs down and east toward the Rent.' },
    { page: 'ash-road', at: [700, 660] },
    { page: 'the-rent', at: [1186, 520] },
    { page: 'ninth-stone', at: NINTH, piece: 'ninth-stone' },
    { page: 'march-of-cinders', at: [215, 356] },
  ],
}

function ashenreach(): Drawing {
  const r = rng(3011)
  const R = (a: number, b: number) => a + r() * (b - a)
  const shapes: Shape[] = []
  const add = (s: Shape) => shapes.push(s)
  let n = 0
  const id = (p: string) => `${p}-${n++}`
  const room = new Room()
  const P = (name: string, asset: string, at: Point, size: number, variant = 0, roomR = size * 0.6) => {
    add(piece(name, asset, at, size, 1 + Math.floor(r() * 1e9), variant))
    room.take(at[0], at[1] - size * 0.3, roomR)
  }
  const many = (asset: string, at: Point, size: number, variant = Math.floor(r() * 8)) => add(piece(id(asset), asset, at, Math.round(size * 10) / 10, 1 + Math.floor(r() * 1e9), variant, undefined, r() < 0.4))
  const labels: Shape[] = []
  const L = (text: string, at: Point, size: number, font: LabelFont, curve?: Point[], upright = false) => {
    labels.push(label(id('label'), text, at, size, font, curve, upright))
    if (!curve) room.takeText(at[0], at[1], text.length * size * (font === 'region' ? 0.95 : 0.48), size * 1.1)
    else curve.forEach(([x, y]) => room.take(x, y, size * 0.8))
  }

  // ---- water: the grey lakes north of the Rent, Stillwater's the biggest ----
  const LAKES: [number, number, number, number, number][] = [
    [452, 432, 62, 30, 0.15], [590, 372, 44, 22, -0.3], [722, 330, 62, 26, 0.1], [866, 296, 40, 20, -0.2], [992, 352, 70, 30, 0.25], [1112, 300, 34, 18, 0],
  ]
  for (const [x, y, rx, ry, a] of LAKES) {
    add({ id: id('lake'), kind: 'area', terrain: 'water', points: blob(r, x, y, rx, ry, 16, a), smooth: true })
    room.take(x, y, Math.max(rx, ry) + 12)
  }

  // ---- the river Cinder, down from the foothills, through the ford and away west ----
  const river = rough(r, RIVER, 3, 0.18)
  add(line('cinder', 'river', river))
  room.takeLine(river, 10)

  // ---- roads and tracks ----
  const ash = rough(r, ASH_ROAD, 2, 0.03)
  add(line('ash-road', 'road', ash))
  add(line('west-road', 'road', rough(r, WEST_ROAD, 2, 0.08)))
  const lane: Point[] = [[FORD[0] + 4, 640], [262, 600], [ORCHARD[0] - 8, ORCHARD[1] + 14]]
  add(line('orchard-lane', 'path', lane))
  const creek: Point[] = [[ORCHARD[0] + 10, ORCHARD[1] - 12], [330, 520], [362, 496], [STILLWATER[0] - 4, STILLWATER[1] + 6]]
  add(line('stillwater-track', 'path', rough(r, creek, 2, 0.15)))
  add(line('rise-track', 'path', [[TOWN[0] - 8, 680], [150, 712], [RISE[0] + 4, RISE[1] - 24]]))
  add(line('mission-track', 'path', [[258, 652], [MISSION[0] - 4, MISSION[1] - 14]]))
  for (const l of [ash, WEST_ROAD, lane, creek]) room.takeLine(l, 9)

  // ---- the Rent: a black core, a shaded far wall, a broken near lip, cracks running out into the ash ----
  {
    const [ax, ay] = [RENT_E[0] - RENT_W[0], RENT_E[1] - RENT_W[1]]
    const len = Math.hypot(ax, ay)
    const [ux, uy] = [ax / len, ay / len]
    const [nx, ny] = [-uy, ux] // the south-east side
    const bends = [0, 18, -10, 22, -16, 8, 0]
    const base = bends.map((b, i) => {
      const t = i / (bends.length - 1)
      return [RENT_W[0] + ux * len * t + nx * b, RENT_W[1] + uy * len * t + ny * b] as Point
    })
    const spine = rough(r, base, 3, 0.22)
    const last = spine.length - 1
    const half = (t: number) => 3 + 21 * Math.pow(Math.sin(Math.PI * t), 0.65)
    const edge = (s: number) =>
      spine.map(([x, y], i) => {
        const w = half(i / last) * (0.75 + r() * 0.5)
        return [Math.round((x + nx * w * s) * 10) / 10, Math.round((y + ny * w * s) * 10) / 10] as Point
      })
    const nw = edge(-1)
    const se = edge(1)
    // the core: a few heavy strokes side by side where it is wide
    const inner = (k: number) => spine.map(([x, y], i) => [x + nx * half(i / last) * k, y + ny * half(i / last) * k] as Point)
    add(line('rent-core', 'wall', spine.slice(2, -2)))
    for (const k of [-0.42, 0.42]) add(line(id('rent-core'), 'wall', inner(k).slice(Math.round(last * 0.12), Math.round(last * 0.88))))
    for (const k of [-0.22, 0.22]) add(line(id('rent-core'), 'wall', inner(k).slice(Math.round(last * 0.06), Math.round(last * 0.94))))
    // the far (south-east) wall in shadow, hachured down into the dark
    add(line('rent-far-wall', 'cliff', [...se].reverse()))
    // the near lip, broken
    for (let i = 0; i < last; ) {
      const j = Math.min(last, i + 3 + Math.floor(r() * 5))
      add(line(id('rent-lip'), 'ink', nw.slice(i, j + 1)))
      i = j + 1 + Math.floor(r() * 2)
    }
    // cracks out into the ash, longer near the middle, some forking
    for (let i = 0; i < 18; i++) {
      const t = 0.06 + (i / 17) * 0.88 + R(-0.02, 0.02)
      const s = i % 2 ? 1 : -1
      const k = Math.round(t * last)
      const start = (s > 0 ? se : nw)[k]
      const out = (R(40, 110) * Math.sin(Math.PI * t) + 16) * (s < 0 ? 0.8 : 1)
      let dir = Math.atan2(ny * s, nx * s) + R(-0.7, 0.7)
      const crack: Point[] = [start]
      let [x, y] = start
      const steps = 7
      for (let j = 0; j < steps; j++) {
        dir += R(-0.45, 0.45)
        x += (Math.cos(dir) * out) / steps
        y += (Math.sin(dir) * out) / steps
        crack.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10])
      }
      add(line(id('rent-crack'), 'ink', crack))
      if (r() < 0.6) {
        const m = crack[2 + Math.floor(r() * 3)]
        const a = dir + (r() < 0.5 ? 1 : -1) * R(0.6, 1.1)
        add(line(id('rent-crack'), 'ink', [m, [m[0] + Math.cos(a) * out * 0.18, m[1] + Math.sin(a) * out * 0.18], [m[0] + Math.cos(a + 0.3) * out * 0.34, m[1] + Math.sin(a + 0.3) * out * 0.34]]))
      }
    }
    for (let i = 0; i <= last; i += 3) room.take(spine[i][0], spine[i][1], 70)
  }

  // ---- places ----
  P('lantern-hill', 'hill', HILL, 24, 2, 18)
  P('lantern-keep', 'castle', [KEEP[0], KEEP[1] - 4], 30, 4, 22)
  P('cinderford', 'town', TOWN, 34, 2, 28)
  P('mission', 'temple', MISSION, 22, 0, 16)
  many('tree', [MISSION[0] + 16, MISSION[1] - 2], 11)
  many('tree', [MISSION[0] - 15, MISSION[1] + 1], 10)
  P('treaty-stone', 'standing-stones', STONE, 18, 3, 14)
  P('burned-mill', 'ruins', MILL, 18, 4, 14)
  P('corvel-rise', 'hill', RISE, 30, 5, 22)
  many('hill', [RISE[0] + 26, RISE[1] + 4], 18)
  many('dead-tree', [RISE[0] - 6, RISE[1] - 20], 15, 2)
  many('dead-tree', [RISE[0] + 6, RISE[1] - 22], 13, 5)
  many('dead-tree', [RISE[0] + 2, RISE[1] - 17], 12, 1)
  // the Weeping Orchard: petrified pear trees still standing in their rows
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) many('dead-tree', [ORCHARD[0] - 15 + col * 10 + row * 3, ORCHARD[1] - 8 + row * 9], 10, (row * 4 + col) % 8)
  room.take(ORCHARD[0], ORCHARD[1], 26)
  // Fort Mercy on its rise, the Glassers' camp round its skirts
  many('hill', [FORT[0] - 20, FORT[1] - 6], 16)
  many('hill', [FORT[0] + 22, FORT[1] - 4], 14)
  P('fort-mercy', 'castle', FORT, 34, 6, 30)
  many('village', [FORT[0] + 30, FORT[1] + 18], 14, 5)
  P('stillwater', 'village', STILLWATER, 18, 3, 16)
  P('ninth-stone', 'standing-stones', NINTH, 46, 7, 30)

  // ---- lettering (placed before the scatter, so the scatter leaves it room) ----
  L('The Ashenreach', [220, 1006], 30, 'title')
  L('and the March of Cinders', [220, 1040], 14, 'place')
  L('Cinderford', [TOWN[0] + 2, TOWN[1] + 18], 18, 'place', undefined, true)
  L('the Lantern Keep', [KEEP[0] - 10, KEEP[1] - 40], 12, 'place', undefined, true)
  L('Fort Mercy', [FORT[0], FORT[1] + 18], 15, 'place', undefined, true)
  L('Stillwater', [STILLWATER[0] - 2, STILLWATER[1] + 16], 14, 'place', undefined, true)
  L('the House of Unburnt Light', [MISSION[0] + 20, MISSION[1] + 16], 11, 'place')
  L('the Treaty Stone', [STONE[0] + 6, STONE[1] - 30], 12, 'place')
  L('the Weeping Orchard', [ORCHARD[0] + 2, ORCHARD[1] - 26], 12, 'place')
  L('Corvel Rise', [RISE[0] + 8, RISE[1] + 16], 13, 'place')
  L('the Burned Mill', [MILL[0], MILL[1] - 26], 11, 'place')
  L('the Ninth Stone', [NINTH[0] + 76, NINTH[1] - 4], 14, 'place')
  L('THE MARCH OF CINDERS', [215, 372], 16, 'region', arc(45, 372, 385, 380, -6))
  L('THE ASHENREACH', [680, 540], 26, 'region', arc(470, 548, 880, 548, -8))
  L('the Rent', [1186, 534], 20, 'place', [[1126, 592], [1186, 534], [1246, 474]])
  L('the Cinder', [296, 246], 15, 'place', [[312, 190], [303, 240], [295, 292]])
  L('the Ash Road', [800, 680], 13, 'place', [[745, 680], [800, 682], [855, 684]])
  L('the Grey Lakes', [790, 260], 17, 'place')
  L('the Glasslands', [800, 880], 20, 'place')
  L('the Glasslands', [1400, 560], 18, 'place')
  L('the eastern downs', [1452, 790], 14, 'place')
  L('the Grimmark', [940, 182], 18, 'place')
  L('to Fallowden', [52, 672], 12, 'place')

  // ---- map furniture ----
  P('cartouche', 'cartouche', [220, 1015], 330, 1, 0)
  room.take(220, 1015, 165)
  P('compass', 'compass-rose', [1490, 960], 110, 1, 0)
  room.take(1490, 960, 60)
  P('scale', 'scale-bar', [1160, 1040], 314, 1, 0)
  room.takeText(1160, 1030, 340, 60)

  // ---- the Grimmark foothills along the top ----
  for (const [x, y] of scatter(140, () => [R(0, W), R(40, 150)], 22, (x, y) => room.free(x, y, 8) && y < 90 + 50 * Math.sin(x / 260) ** 2))
    many('mountain', [x, y], R(28, 46) * (1 - x / (W * 2.2)))
  for (const [x, y] of scatter(70, () => [R(0, W), R(130, 220)], 24, (x, y) => room.free(x, y, 8) && y < 185 + 30 * Math.sin(x / 190)))
    many(r() < 0.5 ? 'hill' : 'mountain-small', [x, y], R(13, 19))
  for (const [x, y] of scatter(90, () => [R(380, 1300), R(150, 215)], 9, (x, y) => room.free(x, y, 4)))
    many('pine', [x, y], R(10, 14))

  // ---- the eastern downs ----
  for (const [x, y] of scatter(40, () => [R(1330, 1580), R(620, 860)], 26, (x, y) => room.free(x, y, 10))) many('downs', [x, y], R(13, 18))

  // ---- west of the river there is still thin grass, and the steadings cling to the bank ----
  const west = (x: number, y: number) => x < 205 - (y - 640) * 0.12 && y > 240 && y < 900
  for (const [x, y] of scatter(6, () => [R(40, 200), R(280, 880)], 70, (x, y) => west(x, y) && room.free(x, y, 16))) many('village', [x, y], R(11, 14))
  for (const [x, y] of scatter(14, () => [R(20, 220), R(260, 900)], 34, (x, y) => west(x, y) && room.free(x, y, 10))) many('tree', [x, y], R(10, 13))
  for (const [x, y] of scatter(8, () => [R(20, 220), R(260, 900)], 40, (x, y) => west(x, y) && room.free(x, y, 10))) many('hill', [x, y], R(12, 15))

  // ---- the plain: burned trees, a few hardy bushes, and greywinds ----
  const glass = (x: number, y: number) => (y > 720 && x > 420) || (x > 1240 && y > 330 && y < 760) || (Math.abs(x - 449) < 20 && Math.abs(y - 652) < 30)
  for (const [x, y] of scatter(90, () => [R(300, 1560), R(230, 860)], 30, (x, y) => room.free(x, y, 8) && !glass(x, y))) many('dead-tree', [x, y], R(10, 14))
  for (const [x, y] of scatter(70, () => [R(10, 330), R(230, 900)], 16, (x, y) => room.free(x, y, 6) && x < 250 + (y - 230) * 0.05)) many('grass', [x, y], R(7, 10))
  for (const [x, y] of scatter(12, () => [R(420, 1500), R(240, 900)], 120, (x, y) => room.free(x, y, 30))) many('cloud', [x, y], R(60, 90), 4)

  // ---- the glasslands: knots and sheets of fused black glass, and villages melted where they stood ----
  for (const [x, y] of scatter(260, () => [R(400, 1600), R(320, 1090)], 15, (x, y) => glass(x, y) && room.free(x, y, 6))) many('wood-stipple', [x, y], R(10, 22))
  for (const [x, y] of scatter(9, () => [R(450, 1550), R(340, 1060)], 90, (x, y) => glass(x, y) && room.free(x, y, 14))) many('ruins', [x, y], R(14, 18))

  shapes.push(...labels)
  return {
    background: 'parchment',
    grid: 'none',
    gridSize: 70,
    shapes,
    style: 'classic',
    scene: 'world',
    look: 'colour',
    biome: 'winter',
    shadows: true,
    frame: true,
    seed: 3011,
    land: [],
  }
}
