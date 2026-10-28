import type { Drawing, Point, Shape } from './mapDrawing'
import { alongside, blob, face, label, line, piece, rng, rough, Room, scatter } from './example/maps/draw'

/** The Saltmere town map; the town's pins (in sample.ts) are placed in these map pixels. */
export const SALTMERE_W = 1200
export const SALTMERE_H = 800

/**
 * The sample world's region map, drawn in the classic style when the sample loads: the coast,
 * Saltmere, the road north to Greywatch Keep through the Ashspine, and the Whisperwood. Places sit
 * where the old flat map had them, so the pins (in sample.ts) still land on them.
 */
export const COAST_W = 1600
export const COAST_H = 1000

/** The Whisperwood, as the outline of its region pin (map pixels from the top left). */
export const WHISPERWOOD: Point[] = [[980, 330], [1180, 280], [1330, 380], [1290, 540], [1060, 560], [960, 450]]

const cubic = (a: Point, b: Point, c: Point, d: Point, n = 8): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n
    const u = 1 - t
    return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]] as Point
  })

const inside = (poly: Point[], x: number, y: number) => {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

export function shatteredCoast(): Drawing {
  const r = rng(312)
  const R = (a: number, b: number) => a + r() * (b - a)
  const shapes: Shape[] = []
  const add = (s: Shape) => shapes.push(s)
  let n = 0
  const id = (p: string) => `${p}-${n++}`
  const many = (asset: string, at: Point, size: number, variant = Math.floor(r() * 8)) => add(piece(id(asset), asset, at, Math.round(size * 10) / 10, 1 + Math.floor(r() * 1e9), variant, undefined, r() < 0.4))

  // the coast, traced from the old map, running off the top and bottom edges
  const coast: Point[] = [
    [430, -40],
    [430, 80],
    ...cubic([430, 80], [450, 160], [360, 220], [380, 300]),
    ...cubic([380, 300], [400, 380], [520, 400], [540, 470]),
    ...cubic([540, 470], [560, 540], [470, 560], [470, 640]),
    ...cubic([470, 640], [470, 720], [560, 740], [600, 820]),
    ...cubic([600, 820], [640, 900], [700, 930], [760, 1000]),
    [790, 1040],
  ]
  const land = [...rough(r, coast, 3, 0.3), [1640, 1040], [1640, -40]] as Point[]
  add({ id: 'mainland', kind: 'area', terrain: 'land', points: land, smooth: true })
  add({ id: 'isle', kind: 'area', terrain: 'land', points: rough(r, [...blob(r, 285, 745, 48, 40, 10), blob(r, 285, 745, 48, 40, 10)[0]], 2, 0.2), smooth: true })
  const onLand = (x: number, y: number) => inside(land, x - 26, y) && inside(land, x, y + 12)

  // the road north from Saltmere to the keep, and a river down out of the Ashspine
  const road = rough(r, [[566, 632], [640, 540], [700, 430], [760, 330], [812, 228]], 2, 0.12)
  add(line('road', 'road', road))
  const river = rough(r, [[1010, 190], [990, 260], [930, 330], [925, 420], [860, 500], [830, 590], [760, 660], [740, 760], [680, 820], [662, 884]], 3, 0.3)
  add(line('river', 'river', river))
  // the title and the compass need clear ground
  const open = (x: number, y: number) => !(x > 800 && x < 1420 && y > 720 && y < 815) && Math.hypot(x - 1460, y - 860) > 90
  const near = (pts: Point[], x: number, y: number, d: number) => pts.some(([px, py]) => Math.hypot(px - x, py - y) < d)

  // places
  // a scatter of islets and rocks off the broken coast
  for (const [x, y, rx] of [[360, 560, 14], [330, 610, 9], [520, 880, 12], [300, 130, 16], [610, 960, 10]] as const)
    add({ id: id('islet'), kind: 'area', terrain: 'land', points: blob(r, x, y, rx, rx * 0.7, 8), smooth: true })

  add(piece('saltmere', 'port', [552, 646], 38, 31201, 2))
  add(piece('greywatch-keep', 'castle', [816, 222], 36, 31202, 3))

  // the Ashspine, with a pass where the road goes through
  for (const [x, y] of scatter(70, () => [R(600, 1600), R(70, 200)], 26, (x, y) => onLand(x, y) && Math.abs(x - 812) > 46 && !near(river, x, y, 14) && y < 200 - (x - 600) * 0.02))
    many('mountain', [x, y], R(30, 48))
  for (const [x, y] of scatter(26, () => [R(560, 1600), R(190, 270)], 30, (x, y) => onLand(x, y) && Math.abs(x - 806) > 34 && !near(river, x, y, 14) && !near(road, x, y, 16)))
    many('hill', [x, y], R(13, 18))
  for (const [x, y] of scatter(40, () => [R(430, 620), R(0, 330)], 26, (x, y) => onLand(x, y) && !near(road, x, y, 18)))
    many(r() < 0.6 ? 'mountain-small' : 'hill', [x, y], R(14, 20))

  // the Whisperwood
  for (const [x, y] of scatter(600, () => [R(940, 1340), R(270, 570)], 8.5, (x, y) => inside(WHISPERWOOD, x, y) && !near(river, x, y, 12))) many('tree', [x, y], R(10, 14))
  // woods, fields and the odd farm elsewhere
  for (const [x, y] of scatter(14, () => [R(560, 1560), R(300, 960)], 100, (x, y) => onLand(x, y) && !inside(WHISPERWOOD, x + 40, y) && !near(road, x, y, 30) && !near(river, x, y, 26) && open(x, y) && open(x - 30, y) && open(x + 30, y)))
    many('forest-clump', [x, y], R(34, 44))
  for (const [x, y] of scatter(60, () => [R(520, 1580), R(280, 980)], 34, (x, y) => onLand(x, y) && !inside(WHISPERWOOD, x, y) && !near(road, x, y, 12) && !near(river, x, y, 10) && open(x, y) && Math.hypot(x - 552, y - 646) > 50))
    many(r() < 0.25 ? 'hill' : 'grass', [x, y], R(12, 16))
  for (const [x, y] of [[700, 640], [1380, 640], [880, 860]] as Point[]) many('village', [x, y], 18)
  many('tree', [270, 740], 12)
  many('tree', [296, 752], 11)

  // the sea
  for (const [x, y] of scatter(30, () => [R(30, 760), R(30, 980)], 70, (x, y) => !inside(land, x + 40, y) && !inside(land, x, y) && Math.hypot(x - 285, y - 745) > 90 && Math.hypot(x - 200, y - 460) > 140))
    many('waves', [x, y], R(18, 24))
  add(piece('ship', 'ship', [190, 250], 54, 31203, 4))
  add(piece('compass', 'compass-rose', [1460, 860], 120, 31204, 0))

  add(label('label-title', 'The Shattered Coast', [1110, 770], 32, 'region', [[840, 782], [1110, 762], [1380, 782]]))
  add(label('label-sea', 'The Grey Sea', [200, 460], 34, 'place'))
  add(label('label-wood', 'Whisperwood', [1150, 600], 24, 'place'))
  add(label('label-ashspine', 'the Ashspine Mountains', [1270, 232], 22, 'place'))
  add(label('label-saltmere', 'Saltmere', [554, 668], 20, 'place', undefined, true))
  add(label('label-keep', 'Greywatch Keep', [816, 244], 16, 'place', undefined, true))

  return {
    background: 'sea',
    grid: 'none',
    gridSize: 70,
    shapes,
    style: 'classic',
    scene: 'world',
    look: 'colour',
    biome: 'temperate',
    shadows: true,
    frame: true,
    seed: 312,
    land: [],
  }
}

/** For the preview tools: the same shape as an example map. */
export const SHATTERED_COAST = { width: COAST_W, height: COAST_H, drawing: shatteredCoast }

/**
 * Saltmere: a small fishing town on the shore of the tidal flats, its docks out over the water on
 * stilts. Kept simple; the buildings sit under the pins the old flat map had (see sample.ts).
 */
export function saltmere(): Drawing {
  const r = rng(318)
  const shapes: Shape[] = []
  const add = (s: Shape) => shapes.push(s)
  let n = 0
  const id = (p: string) => `${p}-${n++}`
  const seed = () => 1 + Math.floor(r() * 1e9)
  const room = new Room()
  const put = (asset: string, at: Point, size: number, variant = 0, turn = 0, gap = size * 0.4) => {
    add(piece(id(asset), asset, at, size, seed(), variant, turn))
    room.take(at[0], at[1], gap)
  }
  const street = (pts: Point[], width: number) => {
    add({ ...line(id('street'), 'street', pts, true), width } as Shape)
    room.takeLine(pts, width / 2 + 6)
  }
  // the sea fills the bottom left, below a shore running from the west edge down to the south
  const SHORE: Point[] = [[-40, 560], [120, 590], [260, 606], [420, 640], [560, 690], [660, 760], [720, 840]]
  const sea = (pts: Point[], size: number) => ({ id: id('sea'), mode: 'water' as const, size, points: pts })
  const land = [sea(SHORE.map(([x, y]) => [x - 40, y + 130] as Point), 260), sea([[-60, 820], [300, 860], [520, 900]], 260)]
  room.takeLine(SHORE, 30)
  for (let x = -20; x < 760; x += 40) for (let y = 560; y < 840; y += 40) if (y > shoreY(x)) room.take(x, y, 22)
  function shoreY(x: number) {
    for (let i = 1; i < SHORE.length; i++) if (x <= SHORE[i][0]) {
      const [a, b] = [SHORE[i - 1], SHORE[i]]
      return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
    }
    return 900
  }

  const MAIN: Point[] = [[-20, 432], [200, 412], [400, 404], [600, 390], [820, 352], [1040, 304], [1230, 276]]
  const NORTH: Point[] = [[600, -20], [592, 160], [580, 300], [560, 420], [530, 520], [500, 610]]
  const TEMPLE_LANE: Point[] = [[548, 470], [660, 520], [760, 572]]
  const HARBOUR_LANE: Point[] = [[420, 404], [330, 440], [280, 500], [300, 580]]
  street(MAIN, 26)
  street(NORTH, 20)
  street(TEMPLE_LANE, 14)
  street(HARBOUR_LANE, 14)

  // the places the pins point at
  put('ct-manor', [520, 360], 104, 5, 0) // the Salty Anchor
  put('ct-cathedral', [820, 604], 150, 3, face([820, 604], [760, 572])) // the Temple of the Tides
  put('ct-houses', [600, 560], 84, 3, face([600, 560], [540, 500])) // Anvil & Ember
  put('ct-guildhall', [232, 480], 92, 2, face([232, 480], [300, 480])) // the harbourmaster
  put('ct-market', [440, 560], 96, 3, face([440, 560], [440, 640])) // fish market on the quay
  // the stilt docks and the boats
  put('ct-pier', [380, 700], 120, 1, 180)
  put('ct-pier', [500, 726], 100, 0, 200)
  put('ct-pier', [260, 670], 96, 5, 170)
  put('ct-houses', [318, 690], 70, 0, 90)
  put('ct-boats', [590, 768], 64, 2, 0)
  put('ct-ship', [190, 740], 70, 5, 20)
  put('ct-boats', [120, 650], 60, 0, 10)

  // fields on the edge of town, then houses along the streets
  put('ct-fields', [1030, 120], 260, 1, 6, 150)
  put('ct-fields', [1080, 560], 240, 3, 352, 140)
  for (const [pts, side, from, to] of [[MAIN, 1, 60, 1300], [MAIN, -1, 120, 1300], [NORTH, 1, 40, 400], [NORTH, -1, 40, 400]] as [Point[], 1 | -1, number, number][])
    for (const { at, turn } of alongside(pts, side, 52, 108, from, to)) {
      const size = 104 + r() * 20
      if (at[0] > 30 && at[0] < 1170 && at[1] > 30 && room.free(at[0], at[1], 32)) put('ct-houses', at, size, [0, 1, 2, 6, 5][Math.floor(r() * 5)], turn, 46)
    }
  for (const p of scatter(10, () => [100 + r() * 1000, 120 + r() * 520], 100, (x, y) => y < shoreY(x) - 60 && room.free(x, y, 52)))
    put('ct-houses', p, 104, [3, 5, 4][Math.floor(r() * 3)], Math.round((r() - 0.5) * 30 + 360) % 360, 56)
  for (const p of scatter(16, () => [r() * 1200, r() * 800], 40, (x, y) => y < shoreY(x) - 30 && room.free(x, y, 16)))
    put(r() < 0.6 ? 'bm-tree' : 'bm-bush', p, 16 + r() * 10, Math.floor(r() * 8), 0, 14)

  add(label(id('label'), 'Saltmere', [940, 730], 40, 'title'))
  add(label(id('label'), 'Tidal Flats', [180, 780], 20, 'place'))
  add(label(id('label'), 'to Greywatch Keep', [1100, 262], 14, 'place', [[1000, 290], [1190, 248]]))
  put('compass-rose', [1120, 420], 80, 0, 0, 50)

  return {
    background: 'grass',
    grid: 'none',
    gridSize: 7,
    shapes,
    style: 'classic',
    scene: 'city',
    look: 'colour',
    biome: 'temperate',
    shadows: true,
    frame: true,
    seed: 318,
    groundBase: 'grass',
    ground: [],
    land,
  }
}

export const SALTMERE = { width: SALTMERE_W, height: SALTMERE_H, drawing: saltmere }
