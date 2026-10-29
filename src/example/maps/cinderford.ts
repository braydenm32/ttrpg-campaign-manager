import type { Drawing, GroundStroke, Point, Shape } from '../../mapDrawing'
import type { ExMap } from '../types'
import { alongside, arc, blob, face, inside, label, line, piece, rng, rough, Room, scatter } from './draw'

/**
 * Cinderford, from the place pages: the town on the west bank of the Cinder round the toll bridge,
 * Lantern Hill and its Keep above the Ford, Temple Row along the hill's foot, the Low Quay below the
 * bridge and the Smokes downwind to the south. East of the bridge the ash begins. 5 ft = 7 px.
 */
const W = 2400
const H = 1600

// the river comes in from the north and goes out to the south, bending a little west below the bridge
const RIVER: Point[] = [[1530, -40], [1512, 200], [1522, 450], [1505, 700], [1505, 950], [1480, 1200], [1425, 1420], [1370, 1650]]
const RIVER_W = 160
// the bridge and the square at its west end
const BRIDGE: Point = [1503, 702]
const SQUARE: Point = [1250, 712]
// the town wall round the Ford, the hill and Temple Row; the Smokes and the Quay are outside it
const WALL: Point[] = [[1398, 300], [1180, 196], [900, 150], [600, 190], [420, 330], [400, 560], [430, 780], [520, 990], [760, 1088], [1060, 1112], [1300, 1042], [1412, 962], [1404, 702], [1398, 300]]
const GATE_BRIDGE: Point = [1404, 702]
const GATE_WEST: Point = [424, 740]
const GATE_SOUTH: Point = [930, 1102]
// Lantern Hill
const HILL: Point = [850, 410]
const KEEP: Point = [850, 392]

// streets (20 ft is 28 px)
const MAIN: Point[] = [GATE_WEST, [560, 752], [720, 768], [900, 768], [1060, 748], [1170, 724], SQUARE, [1404, 704]]
const ASH_ROAD: Point[] = [[1596, 704], [1760, 700], [1980, 668], [2200, 640], [2430, 614]]
const WEST_ROAD: Point[] = [GATE_WEST, [300, 748], [150, 770], [-30, 790]]
const MISSION_TRACK: Point[] = [[1600, 712], [1720, 790], [1900, 900], [2140, 1050], [2430, 1220]]
const STEPS: Point[] = [[850, 530], [880, 590], [960, 640], [1070, 676], [1170, 712]]
const TEMPLE_ROW: Point[] = [[1070, 676], [960, 694], [820, 700], [700, 680], [600, 620], [540, 520], [532, 420], [548, 326]]
const SOUTH_ST: Point[] = [[1215, 760], [1150, 860], [1050, 980], [948, 1100]]
const RIVER_LANE: Point[] = [[1320, 690], [1340, 560], [1344, 420], [1330, 300]]
const CROSS_W: Point[] = [[720, 768], [700, 880], [740, 1040]]
const TANNERS: Point[] = [GATE_SOUTH, [950, 1200], [1040, 1290], [1180, 1340], [1312, 1350]]
const SMOKES_LANE: Point[] = [[950, 1200], [860, 1290], [760, 1400], [700, 1520]]
const QUAY_LANE: Point[] = [[1300, 1042], [1360, 1110], [1372, 1220], [1330, 1300]]

const PIER_LANDINGS: Point[] = [[1430, 1010], [1420, 1110]]

export const CINDERFORD: ExMap = {
  key: 'cinderford',
  name: 'Cinderford',
  width: W,
  height: H,
  players: true,
  location: 'cinderford',
  drawing: cinderford,
  pins: [
    { page: 'the-ford', at: [1250, 800] },
    { page: 'treaty-bell', at: SQUARE, piece: 'treaty-bell' },
    { page: 'tollamund-house', at: [1336, 612], piece: 'tollamund' },
    { page: 'assessors-office', at: [1290, 832], piece: 'assessor' },
    // Ford Street, west from the square along the main street to the West Gate
    { page: 'ford-street', at: [620, 758] },
    { page: 'the-reeves-house', at: [1196, 618], piece: 'reeve' },
    { page: 'bridle-and-yoke', at: [480, 712] },
    { page: 'ninefingers-forge', at: [510, 796] },
    { page: 'the-turncoat', at: [610, 800] },
    { page: 'quist-and-daughter', at: [668, 808] },
    { page: 'the-bakers-wife', at: [738, 802] },
    { page: 'the-salt-lake', at: [930, 816] },
    { page: 'the-hock', at: [1060, 716] },
    { page: 'harrows-simples', at: [1180, 836] },
    { page: 'lantern-hill', at: [700, 470] },
    { page: 'lantern-keep', at: KEEP, piece: 'keep' },
    { page: 'item-lantern', at: [990, 384], note: 'In its iron cage on the Keep’s outer wall, facing east.' },
    { page: 'last-candle', at: [1060, 600], piece: 'last-candle' },
    { page: 'temple-row', at: [650, 700] },
    { page: 'velvet-ledger', at: [820, 760], piece: 'velvet-ledger' },
    { page: 'doorkeepers-chapel', at: [600, 300], piece: 'doorkeeper' },
    { page: 'corporals-gibbet', at: [548, 304], piece: 'gibbet' },
    { page: 'the-smokes', at: [900, 1420] },
    { page: 'hesks-chandlery', at: [1080, 1236], piece: 'hesk' },
    { page: 'ninepenny', at: [830, 1222], piece: 'ninepenny' },
    { page: 'low-quay', at: [1372, 1160] },
    { page: 'grey-dumpling', at: [1478, 1172], piece: 'grey-dumpling' },
    { page: 'gutter-market', at: [1262, 1300], piece: 'gutter-market' },
    { page: 'cinder-ferry', at: [1420, 1418] },
    { page: 'glass-barrow', at: [BRIDGE[0] + 6, BRIDGE[1] + 34], map: 'glass-barrow', note: 'Under the ford: the way in is the hollow at the foot of the bridge’s third pier, at low water.' },
  ],
}

function cinderford(): Drawing {
  const r = rng(3014)
  const shapes: Shape[] = []
  const add = (s: Shape) => shapes.push(s)
  let n = 0
  const id = (p: string) => `${p}-${n++}`
  const seed = () => 1 + Math.floor(r() * 1e9)
  const room = new Room()
  const put = (key: string | undefined, asset: string, at: Point, size: number, variant = 0, turn = 0, gap = size * 0.42) => {
    add(piece(key ?? id(asset), asset, at, size, seed(), variant, turn))
    room.take(at[0], at[1], gap)
  }
  const fits = (at: Point, size: number) => room.free(at[0], at[1], size * 0.3)
  const L = (text: string, at: Point, size: number, font: 'title' | 'region' | 'place', curve?: Point[], upright = false) => add(label(id('label'), text, at, size, font, curve, upright))
  const street = (pts: Point[], width: number, smooth = true) => {
    add({ ...line(id('street'), 'street', pts, smooth), width } as Shape)
    room.takeLine(pts, width / 2 + 6)
  }

  // ---- the ground: ash and trodden earth, a glassy sheen on the east bank, paving in the square ----
  const ground: GroundStroke[] = []
  const paint = (g: GroundStroke['ground'], size: number, points: Point[]) => ground.push({ id: id('ground'), ground: g, size, points })
  paint('dirt', 120, [[790, 590], [910, 610]]) // the drill yard
  paint('paving', 150, [[1200, 712], [1290, 712]]) // the Ford square
  paint('paving', 70, [[850, 520], [850, 470]]) // before the Keep's gate
  paint('dirt', 110, [[900, 1180], [1100, 1300], [1250, 1340]]) // the Smokes: trodden and dusty
  paint('mud', 60, [[1390, 1000], [1385, 1140], [1352, 1260]]) // the Quay's strip of mud
  paint('boards', 34, [[1408, 990], [1404, 1110], [1388, 1230]]) // and its planking
  paint('stone', 120, [[1240, 1290], [1300, 1330]]) // Gutter Market: black glass that was once a street
  paint('stone', 54, [[1440, 760], [1560, 780]]) // the glassy shelf at low water, by the third pier

  // ---- Lantern Hill: inked rings round the slope, the Keep on top ----
  for (const [rx, ry, k] of [[300, 215, 0], [218, 162, 1]] as const) {
    const ring = blob(r, HILL[0], HILL[1] + 20 - k * 6, rx, ry, 16, 0.08)
    add(line(id('hill'), 'ink', [...ring, ring[0]], true))
  }
  room.take(HILL[0], HILL[1], 120)

  // ---- the river Cinder, and the toll bridge over it ----
  const river = rough(r, RIVER, 2, 0.04)
  add({ ...line('cinder', 'river', river, true), width: RIVER_W } as Shape)
  room.takeLine(river, RIVER_W / 2 + 8)

  // ---- streets ----
  street(MAIN, 28)
  street(ASH_ROAD, 26)
  street(WEST_ROAD, 24)
  street(MISSION_TRACK, 14)
  street(STEPS, 14)
  street(TEMPLE_ROW, 18)
  street(SOUTH_ST, 22)
  street(RIVER_LANE, 16)
  street(CROSS_W, 16)
  street(TANNERS, 18)
  street(SMOKES_LANE, 14)
  street(QUAY_LANE, 14)
  for (const p of PIER_LANDINGS) street([[1372, p[1]], [p[0] - 6, p[1]]], 12, false)

  // ---- the town wall, its gates and the bridge ----
  add({ ...line('wall', 'townwall', WALL, false), towers: 0 } as Shape)
  room.takeLine(WALL, 20)
  const seg = (a: Point, b: Point) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  put('company-gate', 'ct-gatehouse', GATE_BRIDGE, 80, 1, Math.round(seg(WALL[11], WALL[12]) + 180 + 360) % 360)
  put(undefined, 'ct-gatehouse', GATE_WEST, 72, 3, Math.round(seg(WALL[5], WALL[6]) + 180 + 360) % 360)
  put(undefined, 'ct-gatehouse', GATE_SOUTH, 72, 0, Math.round(seg(WALL[8], WALL[9]) + 180 + 360) % 360)
  put('toll-bridge', 'bm-bridge', BRIDGE, 232, 2, 0)

  // ---- Lantern Hill: the Keep, the drill yard, the lantern ----
  put('keep', 'ct-keep', KEEP, 250, 0, 0, 120)
  put('lantern', 'dg-brazier', [988, 392], 13, 2, 0, 8)
  put(undefined, 'bm-tree', [640, 380], 16, 0, 0, 10)
  for (const p of scatter(10, () => [HILL[0] - 280 + r() * 560, HILL[1] - 200 + r() * 380], 40, (x, y) => fits([x, y], 30) && Math.hypot((x - HILL[0]) / 290, (y - HILL[1] - 20) / 210) < 1))
    put(undefined, 'bm-dead-tree', p, 18 + r() * 6, 0, 0, 12)

  // ---- the Ford: the square, the bell, the Reeve's house, the counting-house in the old mill ----
  put('treaty-bell', 'bm-statue', SQUARE, 18, 2, 0, 14)
  put('reeve', 'ct-manor', [1196, 618], 118, 6, face([1196, 618], [1196, 712]))
  put('tollamund', 'ct-guildhall', [1336, 612], 96, 4, face([1336, 612], [1336, 700]))
  put('assessor', 'ct-houses', [1290, 826], 104, 6, face([1290, 826], [1290, 712]))
  put('last-candle', 'ct-manor', [1060, 600], 104, 5, face([1060, 600], [1070, 676]))

  // ---- Temple Row: a shrine to every god along the hill's foot ----
  put('velvet-ledger', 'ct-manor', [820, 760], 104, 3, face([820, 760], [820, 700]))
  put(undefined, 'ct-cathedral', [960, 742], 70, 6, face([960, 742], [960, 694]))
  put(undefined, 'ct-cathedral', [690, 730], 80, 3, face([690, 730], [700, 680]))
  put(undefined, 'ct-cathedral', [600, 690], 62, 6, face([600, 690], [620, 640]))
  put(undefined, 'ct-cathedral', [478, 560], 66, 5, face([478, 560], [540, 540]))
  put(undefined, 'ct-cathedral', [474, 430], 60, 4, face([474, 430], [532, 430]))
  put('doorkeeper', 'ct-cathedral', [600, 300], 76, 1, face([600, 300], [548, 326]))
  put('gibbet', 'bm-signpost', [548, 304], 16, 5, 0, 10)

  // ---- houses along the streets, inside the wall ----
  room.takeText(1236, 792, 170, 30) // the quarter's name
  // [line, side, how far from its middle, from, to]: houses about 50 ft deep, fronts on the street
  const rows: [Point[], 1 | -1, number, number, number][] = [
    [MAIN, 1, 0, 160, 900],
    [MAIN, -1, 0, 120, 640],
    [SOUTH_ST, 1, 0, 30, 440],
    [SOUTH_ST, -1, 0, 30, 440],
    [CROSS_W, 1, 0, 40, 320],
    [CROSS_W, -1, 0, 40, 320],
    [RIVER_LANE, -1, 0, 30, 420],
    [STEPS, 1, 0, 110, 340],
    [TEMPLE_ROW, -1, 0, 20, 520],
  ]
  // a row of houses is long along the street and shallow back from it: test and claim its ends as well as its middle
  const ends = (at: Point, turn: number, size: number): Point[] => {
    const [dx, dy] = [Math.cos((turn * Math.PI) / 180) * size * 0.34, Math.sin((turn * Math.PI) / 180) * size * 0.34]
    return [at, [at[0] + dx, at[1] + dy], [at[0] - dx, at[1] - dy]]
  }
  const houseFits = (at: Point, turn: number, size: number) => ends(at, turn, size).every(([x, y]) => room.free(x, y, 26))
  const house = (at: Point, turn: number, size: number, variant: number) => {
    add(piece(id('ct-houses'), 'ct-houses', at, size, seed(), variant, turn))
    for (const [x, y] of ends(at, turn, size)) room.take(x, y, 26)
  }
  const houses = (pts: Point[], side: 1 | -1, nudge: number, from: number, to: number, ok: (x: number, y: number) => boolean, kinds: number[]) => {
    const w = pts === MAIN ? 28 : 18
    for (const { at, turn } of alongside(pts, side, w / 2 + 36 + nudge, 112, from, to)) {
      const size = 128 + r() * 30
      if (ok(at[0], at[1]) && houseFits(at, turn, size)) house(at, turn, size, kinds[Math.floor(r() * kinds.length)])
    }
  }
  const inTown = (x: number, y: number) => inside(WALL, x, y)
  for (const [pts, side, nudge, from, to] of rows) houses(pts, side, nudge, from, to, inTown, [0, 1, 2, 6, 7, 0, 1, 6])
  // back lots: yards, a guildhall, a market
  put(undefined, 'ct-guildhall', [880, 900], 120, 3, face([880, 900], [880, 768]))
  for (const p of scatter(18, () => [480 + r() * 900, 220 + r() * 880], 110, (x, y) => inside(WALL, x, y) && room.free(x, y, 56) && Math.hypot((x - HILL[0]) / 300, (y - HILL[1] - 20) / 215) > 1))
    put(undefined, 'ct-houses', p, 120 + r() * 16, [3, 4, 5, 3][Math.floor(r() * 4)], Math.round((r() - 0.5) * 20 + 360) % 360, 58)

  // ---- the Low Quay: piers, barges, the floating market, Gutter Market, the ferry ----
  for (const [i, p] of PIER_LANDINGS.entries()) put(undefined, 'ct-pier', [p[0] + 34, p[1]], 76, [0, 2][i], 90)
  put('grey-dumpling', 'ct-ship', [1478, 1172], 74, 0, 90)
  put(undefined, 'ct-boats', [1488, 1040], 64, 6, 90)
  put(undefined, 'ct-boats', [1500, 960], 54, 2, 90)
  put(undefined, 'ct-boats', [1466, 1262], 54, 5, 70)
  put(undefined, 'ct-ship', [1530, 1100], 56, 5, 85)
  put('gutter-market', 'ct-market', [1262, 1300], 108, 7, face([1262, 1300], [1330, 1300]))
  add(line(id('ferry-rope'), 'ink', [[1336, 1430], [1515, 1392]]))
  put('ferry', 'bm-rowboat', [1420, 1418], 22, 3, 80, 12)

  // ---- the Smokes: tanneries, kilns, the doss-house, the chandler ----
  put('ninepenny', 'ct-guildhall', [830, 1222], 104, 4, face([830, 1222], [900, 1260]))
  put('hesk', 'ct-houses', [1080, 1236], 100, 6, face([1080, 1236], [1040, 1290]))
  for (const [i, p] of ([[1150, 1260], [1188, 1278], [1226, 1294]] as Point[]).entries()) put(undefined, 'bm-well', p, 22, 5, i * 40, 14)
  for (const p of [[1200, 1395], [1250, 1405], [1150, 1400]] as Point[]) put(undefined, 'bm-barrel', p, 10, Math.floor(r() * 8), 0, 8)
  const outTown = (x: number, y: number) => !inside(WALL, x, y)
  houses(TANNERS, 1, 0, 40, 460, outTown, [5, 7, 2, 0])
  houses(TANNERS, -1, 0, 120, 460, outTown, [5, 7, 2, 0])
  houses(SMOKES_LANE, 1, 0, 30, 380, outTown, [5, 7, 3])
  houses(SMOKES_LANE, -1, 0, 30, 380, outTown, [5, 7, 3])

  // ---- outside the walls: steadings on the west bank, ash and glass to the east ----
  put(undefined, 'ct-fields', [190, 330], 300, 2, 8)
  put(undefined, 'ct-fields', [200, 1180], 320, 6, 352)
  put(undefined, 'ct-fields', [480, 1360], 240, 7, 14)
  put(undefined, 'ct-houses', [300, 860], 90, 5, face([300, 860], [300, 760]))
  put('signpost-east', 'bm-signpost', [1640, 676], 16, 0, 0, 10)
  for (const p of scatter(46, () => [r() * 2400, r() * 1600], 70, (x, y) => fits([x, y], 26) && !inside(WALL, x, y) && x > 40 && x < 2360 && y > 40 && y < 1560))
    put(undefined, r() < 0.7 ? 'bm-dead-tree' : 'bm-stump', p, 16 + r() * 8, 0, Math.floor(r() * 360), 12)
  for (const p of scatter(24, () => [1660 + r() * 700, 80 + r() * 1440], 60, (x, y) => fits([x, y], 20)))
    put(undefined, 'bm-rocks', p, 14 + r() * 8, 0, Math.floor(r() * 360), 10)

  // ---- lettering ----
  L('Cinderford', [1960, 160], 50, 'title')
  L('THE FORD', [1236, 792], 20, 'region')
  L('LANTERN HILL', [850, 210], 20, 'region')
  L('THE SMOKES', [960, 1480], 22, 'region')
  L('THE LOW QUAY', [1322, 1150], 15, 'region', [[1322, 1030], [1316, 1270]])
  L('Temple Row', [650, 650], 16, 'place', arc(760, 664, 560, 560, 14))
  L('the Cinder', [1600, 300], 22, 'place', [[1600, 160], [1594, 440]])
  L('the Cinder', [1460, 1540], 18, 'place', [[1488, 1460], [1440, 1600]])
  L('the Ash Road, to the Treaty Stone and the Rent', [2080, 700], 15, 'place', arc(1820, 724, 2360, 664, -4))
  L('to the House of Unburnt Light', [2050, 1020], 14, 'place', [[1880, 932], [2220, 1136]])
  L('to Fallowden', [140, 820], 15, 'place')
  L('toll bridge', [BRIDGE[0], BRIDGE[1] - 52], 14, 'place')
  L('company gatehouse', [1404, 640], 12, 'place')
  L('the Treaty Bell', [SQUARE[0] - 40, SQUARE[1] + 34], 12, 'place')
  L("Reeve's house", [1196, 556], 12, 'place')
  L('Tollamund & Daughters', [1336, 556], 12, 'place')
  L('the Lantern Keep', [KEEP[0], KEEP[1] - 150], 15, 'place')
  L('the lantern', [1040, 380], 13, 'place')
  L('drill yard', [850, 640], 12, 'place')
  L('the Last Candle', [1060, 538], 12, 'place')
  L('the Velvet Ledger', [820, 820], 12, 'place')
  L("the Doorkeeper's Chapel", [640, 250], 12, 'place')
  L('the gibbet', [540, 352], 11, 'place')
  L('Gutter Market', [1210, 1372], 13, 'place')
  L('ferry', [1350, 1462], 12, 'place')
  L('the kilns', [1190, 1232], 12, 'place')
  L("Tanners' Lane", [1110, 1360], 12, 'place', arc(1020, 1320, 1220, 1376, 4))
  L('the Ninepenny', [830, 1162], 12, 'place')
  L("Hesk's", [1080, 1180], 12, 'place')
  L('glass shelf at low water', [1500, 812], 11, 'place')
  put(undefined, 'compass-rose', [2240, 1430], 120, 0, 0, 70)

  return {
    background: 'grass',
    grid: 'none',
    gridSize: 7,
    shapes,
    style: 'classic',
    scene: 'city',
    look: 'parchment',
    biome: 'winter',
    shadows: true,
    frame: true,
    seed: 3014,
    groundBase: 'snow', // ash, blown into drifts (and much quicker to draw than dirt)
    ground,
    land: [],
  }
}
