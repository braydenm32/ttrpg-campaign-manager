import type { Drawing, GroundStroke, Point, Shape } from '../../mapDrawing'
import type { ExMap } from '../types'
import { label, line, piece, rng, rough, scatter } from './draw'

/**
 * A battle map for the Rent's northern lip (session 6 and the finale): 20 × 14 squares of ash and
 * rock, the glass shelf along the edge, the chasm falling away to the east in ledges, the cracked
 * Ninth Stone leaning over it, and a broken wagon from some earlier expedition. GM only.
 */
const G = 70
const W = 20 * G
const H = 14 * G

/** The lip, north to south; the drop is to the east. */
const LIP: Point[] = [[1000, -20], [1012, 120], [968, 260], [984, 400], [944, 540], [972, 690], [1030, 830], [1060, 1000]]
const STONE: Point = [880, 250]
const WAGON: Point = [430, 650]

export const LIP_OF_THE_RENT: ExMap = {
  key: 'lip-of-the-rent',
  name: 'The Lip of the Rent',
  width: W,
  height: H,
  location: 'the-rent',
  drawing: lipOfTheRent,
  pins: [
    { page: 'ninth-stone', at: STONE, piece: 'ninth-stone' },
    { page: 'the-rent', at: [1180, 560] },
  ],
}

function lipOfTheRent(): Drawing {
  const r = rng(3031)
  const R = (a: number, b: number) => a + r() * (b - a)
  const shapes: Shape[] = []
  const add = (s: Shape) => shapes.push(s)
  let n = 0
  const id = (p: string) => `${p}-${n++}`
  const many = (asset: string, at: Point, size: number, turn = Math.round(R(0, 360)), variant = Math.floor(r() * 8)) =>
    add(piece(id(asset), asset, at, Math.round(size), 1 + Math.floor(r() * 1e9), variant, turn))
  const lip = rough(r, LIP, 3, 0.2)
  const shift = (pts: Point[], dx: number, dy = 0): Point[] => pts.map(([x, y]) => [x + dx, y + dy])

  // ---- ground: pale ash, rocky outcrops, the glass shelf along the edge, the dark beyond ----
  const ground: GroundStroke[] = []
  const paint = (g: GroundStroke['ground'], size: number, points: Point[]) => ground.push({ id: id('ground'), ground: g, size, points })
  for (let i = 0; i < 5; i++) {
    const [x, y] = [R(60, 760), R(40, 940)]
    paint(i % 2 ? 'dirt' : 'stone', R(80, 130), [[x, y], [x + R(-70, 70), y + R(-50, 50)]])
  }
  paint('dirt', 80, [[-40, 720], [160, 690], [330, 662], [WAGON[0], WAGON[1] + 10]])
  paint('stone', 150, shift(lip, -70))
  paint('mud', 240, shift(lip, 150))
  paint('mud', 300, shift(lip, 330))
  paint('stone', 60, shift(lip, 50))
  // the Lithic stair: a stepped way of grey stone going down the northern wall
  const stair: Point[] = [[lip[Math.round(lip.length * 0.22)][0] - 10, 330], [1040, 372], [1100, 340], [1150, 384]]
  paint('paving', 46, stair)

  // ---- the edge and the ledges below it, darker as they go down ----
  add(line('lip', 'cliff', lip))
  for (const [i, dx] of [64, 132, 186, 228].entries()) add(line(id('ledge'), 'cliff', rough(r, shift(LIP, dx, i * 10), 3, 0.25)))
  // steps cut into the stair
  for (let i = 1; i < 10; i++) {
    const t = i / 10
    const k = Math.min(stair.length - 2, Math.floor(t * (stair.length - 1)))
    const f = t * (stair.length - 1) - k
    const [x, y] = [stair[k][0] + (stair[k + 1][0] - stair[k][0]) * f, stair[k][1] + (stair[k + 1][1] - stair[k][1]) * f]
    const a = Math.atan2(stair[k + 1][1] - stair[k][1], stair[k + 1][0] - stair[k][0]) + Math.PI / 2
    add(line(id('step'), 'ink', [[x - Math.cos(a) * 18, y - Math.sin(a) * 18], [x + Math.cos(a) * 18, y + Math.sin(a) * 18]]))
  }

  // ---- cracks in the glass, running back from the edge ----
  for (let i = 0; i < 14; i++) {
    const k = Math.floor(R(0.04, 0.96) * (lip.length - 1))
    let [x, y] = lip[k]
    let dir = Math.PI + R(-0.6, 0.6)
    const crack: Point[] = [[x, y]]
    const len = R(90, 260)
    for (let j = 0; j < 7; j++) {
      dir += R(-0.4, 0.4)
      x += (Math.cos(dir) * len) / 7
      y += (Math.sin(dir) * len) / 7
      crack.push([Math.round(x), Math.round(y)])
    }
    add(line(id('crack'), 'ink', crack))
  }

  // ---- the Ninth Stone: a leaning monolith split from crown to root, its shards round its foot ----
  // two halves, split apart, the eastern one leaning out over the drop
  add(piece('ninth-stone', 'bm-rock', [STONE[0] - 46, STONE[1] - 10], 170, 90217, 3, 28))
  add(piece('ninth-stone-east', 'bm-rock', [STONE[0] + 62, STONE[1] + 22], 140, 90218, 6, 200))
  for (const [x, y] of scatter(16, () => [STONE[0] + R(-170, 120), STONE[1] + R(-150, 170)], 34, (x, y) => Math.hypot(x - STONE[0], y - STONE[1]) > 110 && x < 960)) many('bm-rock', [x, y], R(18, 32))

  // ---- the wagon: one wheel gone, tipped on its side, its load spilled in the ash ----
  many('bm-cart', WAGON, 220, -24, 5)
  many('bm-crate', [WAGON[0] + 120, WAGON[1] + 40], 46, 12)
  many('bm-crate', [WAGON[0] + 158, WAGON[1] + 8], 44, 51)
  many('bm-barrel', [WAGON[0] + 96, WAGON[1] + 96], 40, 0)
  many('bm-sacks', [WAGON[0] - 60, WAGON[1] + 92], 56, 30)
  many('bm-log', [WAGON[0] - 150, WAGON[1] - 60], 150, 72)

  // ---- rubble, glass shards and the odd dead tree out on the ash ----
  const clear = (x: number, y: number) => Math.hypot(x - WAGON[0], y - WAGON[1]) > 170 && Math.hypot(x - STONE[0], y - STONE[1]) > 150
  const edgeX = (y: number) => lip.reduce((best, p) => (Math.abs(p[1] - y) < Math.abs(best[1] - y) ? p : best))[0]
  for (const [x, y] of scatter(9, () => [R(40, 900), R(40, 940)], 150, (x, y) => clear(x, y) && x < edgeX(y) - 90)) many('bm-rocks', [x, y], R(90, 130))
  for (const [x, y] of scatter(40, () => [R(500, 1000), R(20, 960)], 40, (x, y) => clear(x, y) && x < edgeX(y) - 20 && x > edgeX(y) - 260)) many('bm-rock', [x, y], R(16, 30))
  for (const [x, y] of scatter(3, () => [R(60, 700), R(60, 920)], 300, (x, y) => clear(x, y))) many('bm-dead-tree', [x, y], R(130, 160))
  for (const [x, y] of scatter(4, () => [R(60, 760), R(60, 920)], 200, (x, y) => clear(x, y))) many('bm-stump', [x, y], R(40, 50))
  // a few boulders down on the ledges
  for (const [x, y] of scatter(6, () => [R(1020, 1250), R(30, 950)], 140, (x, y) => x > edgeX(y) + 70 && x < edgeX(y) + 170)) many('bm-rocks', [x, y], R(70, 100))

  // the deepest part: dark, hatched
  const hatch = (from: number, gap: number, slope: number) => {
    const deep = shift(LIP, from)
    const deepX = (y: number) => deep.reduce((best, p) => (Math.abs(p[1] - y) < Math.abs(best[1] - y) ? p : best))[0]
    for (let c = -800; c < W + H; c += gap) {
      const seg: Point[] = []
      for (let y = -10; y <= H + 10; y += 10) {
        const x = c - y * slope
        if (x > deepX(y) + 8 && x < W + 10) seg.push([Math.round(x), y])
      }
      if (seg.length > 1) add(line(id('dark'), 'ink', [seg[0], seg[seg.length - 1]]))
    }
  }
  hatch(196, 7, 0.4)

  add(label('label-rent', 'the Rent', [1280, 700], 34, 'place'))
  add(label('label-stone', 'the Ninth Stone', [STONE[0] - 60, STONE[1] - 112], 22, 'place'))

  return {
    background: 'grass',
    grid: 'square',
    gridSize: G,
    shapes,
    style: 'classic',
    scene: 'battle',
    look: 'colour',
    biome: 'winter',
    shadows: true,
    frame: false,
    seed: 3031,
    groundBase: 'sand',
    ground,
  }
}
