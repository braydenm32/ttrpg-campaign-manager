import type { Drawing, GroundStroke, Point, RoomStroke, Shape } from '../../mapDrawing'
import type { ExMap } from '../types'
import { label, line, piece, rng } from './draw'

/**
 * The Glass Barrow under the ford at Cinderford, keyed 1 to 7 like the page. The old village
 * (culvert, street, bakery, chapel) is the top half; the cold stair drops a hundred feet to the
 * Lithic rooms drawn in the bottom half. 5 ft squares. GM only.
 */
const G = 70
const W = 24 * G
const H = 18 * G
/** A point in squares. */
const s = (x: number, y: number): Point => [x * G, y * G]

const AREAS: { n: number; name: string; at: Point }[] = [
  { n: 1, name: 'The Culvert', at: s(2.5, 5.2) },
  { n: 2, name: 'The Flooded Street', at: s(9.5, 5.3) },
  { n: 3, name: 'The Collapsed Bakery', at: s(10.5, 2) },
  { n: 4, name: 'The Glass Chapel', at: s(15.4, 3.2) },
  { n: 5, name: 'The Cold Stair', at: s(22.4, 4.2) },
  { n: 6, name: 'The Cold Room', at: s(11, 11.3) },
  { n: 7, name: 'The Red Seam', at: s(17.6, 14.4) },
]

export const GLASS_BARROW: ExMap = {
  key: 'glass-barrow',
  name: 'The Glass Barrow',
  width: W,
  height: H,
  location: 'glass-barrow',
  drawing: glassBarrow,
  pins: [
    ...AREAS.map((a) => ({ page: 'glass-barrow', at: [a.at[0], a.at[1] - 26] as [number, number], label: `${a.n}. ${a.name}`, note: `Area ${a.n} on the page.` })),
    { page: 'item-oil-tin', at: s(11.9, 14.1), note: 'In the ring round the Captain’s chair, area 6.' },
    { page: 'dannic-rook', at: s(4.2, 12.4), note: 'His gear is on the stair’s landing, half way down (area 5).' },
  ],
}

function glassBarrow(): Drawing {
  const r = rng(3005)
  const shapes: Shape[] = []
  const add = (sh: Shape) => shapes.push(sh)
  let n = 0
  const id = (p: string) => `${p}-${n++}`
  const put = (asset: string, at: Point, size: number, variant = 0, turn = 0) => add(piece(id(asset), asset, at, size, 1 + Math.floor(r() * 1e9), variant, turn))

  // ---- the rooms: the old village melted into glass above, older Lithic stone below ----
  const rooms: RoomStroke[] = []
  const dig = (shape: RoomStroke['shape'], points: Point[], size?: number) => rooms.push({ id: id('room'), mode: 'dig', shape, points, ...(size ? { size } : {}) })
  dig('corridor', [s(-1, 6), s(5, 6)], G) // 1: the culvert, five feet high
  dig('rect', [s(5, 4), s(14, 8)]) // 2: the street
  dig('cave', [s(5.4, 4.1), s(8, 3.8), s(11, 4.2), s(13.6, 3.9)], 0.9 * G) // its melted house-fronts
  dig('cave', [s(5.4, 7.9), s(8.5, 8.3), s(11.5, 7.8), s(13.6, 8.1)], 0.9 * G)
  dig('rect', [s(9, 0.8), s(13, 3.8)]) // 3: the bakery
  dig('corridor', [s(14, 6), s(15, 6)], 2 * G) // up the rubble to the chapel
  dig('rect', [s(15, 2), s(21, 10)]) // 4: the chapel
  dig('rect', [s(21, 4.5), s(23.4, 7.5)]) // behind the altar, where the floor dropped
  dig('corridor', [s(12, 8), s(12, 9.4), s(-1, 9.4)], 0.9 * G) // the smugglers' cut, under water
  // a hundred feet down
  dig('rect', [s(2, 12), s(5.5, 15.5)]) // 5: the foot of the cold stair
  dig('corridor', [s(5.5, 13.8), s(8.2, 13.8)], G)
  dig('round', [s(8, 10.8), s(14, 16.8)]) // 6: the cold room
  dig('cave', [s(13.8, 13.8), s(15.6, 15.4), s(17.8, 14.9), s(19.6, 16.2), s(21.4, 15.6)], 0.8 * G) // 7: the red seam
  dig('rect', [s(21, 14.6), s(22.6, 16.6)])

  // ---- floors: glass under silt, black water on the low side, frost below ----
  const ground: GroundStroke[] = []
  const paint = (g: GroundStroke['ground'], size: number, points: Point[]) => ground.push({ id: id('ground'), ground: g, size, points, inside: true })
  paint('water', 0.8 * G, [s(-1, 6), s(5, 6)])
  paint('water', 1.6 * G, [s(5, 7.6), s(9, 7.9), s(14, 7.5)])
  paint('water', 0.9 * G, [s(12, 8), s(12, 9.4), s(-1, 9.4)])
  paint('paving', 3 * G, [s(16.5, 4), s(19.5, 4), s(19.5, 8), s(16.5, 8)])
  paint('paving', 2.5 * G, [s(3.7, 13.7)])
  paint('snow', 5.4 * G, [s(11, 13.8)])
  paint('snow', 1.2 * G, [s(14, 14), s(15.6, 15.3)])
  paint('stone', 1.4 * G, [s(17.8, 14.9), s(19.6, 16.2), s(21.8, 15.6)])

  // ---- 1. the culvert: the brick arch out to the river ----
  put('dg-arch', s(0.3, 6), G, 2, 90)
  add(label(id('note'), 'from the ford (third pier)', s(2.6, 7.1), 15, 'place'))
  add(label(id('note'), '8 ft drop', s(6.3, 6.5), 13, 'place'))

  // ---- 2. the street: rubble at the far end, Dannic's things on the dry side ----
  for (const [x, y, v] of [[13.2, 5.2, 1], [13.7, 6.6, 4], [14.5, 5.6, 6]]) put('dg-rubble', s(x, y), 1.4 * G, v, Math.round(r() * 360))
  put('bm-sacks', s(8.2, 4.9), 0.6 * G, 2, 30)
  put('bm-crate', s(7.4, 4.6), 0.35 * G, 1, 20)
  put('dg-arch', s(12, 8.2), G, 0, 0)
  add(label(id('note'), "smugglers' cut to the Low Quay, 50 yds", s(5.5, 10.25), 15, 'place'))
  add(label(id('note'), 'deep water', s(9.6, 7.7), 14, 'place'))

  // ---- 3. the bakery: front fallen in, three ovens at the back, webs ----
  put('dg-door', s(11, 3.85), G, 5, 0)
  put('dg-rubble', s(11.8, 3.3), 1.3 * G, 2, 40)
  for (const x of [9.8, 11, 12.2]) put('dg-pillar-square', s(x, 1.25), 0.8 * G, 3, 0)
  add(label(id('note'), 'ovens', s(11, 0.55), 13, 'place'))
  add(label(id('note'), 'webs', s(10.1, 2.8), 14, 'place'))

  // ---- 4. the chapel: the pews full, the altar with Hathe's door cut in it ----
  put('dg-arch', s(15, 6), 2 * G, 6, 90)
  // pews of fused glass, either side of the aisle
  for (let row = 0; row < 3; row++) for (const y of [3.7, 8.3]) put('dg-altar', s(16.3 + row * 1.3, y), 2.1 * G, 0, 90)
  put('dg-altar', s(20.1, 6), 1.6 * G, 5, 90)
  put('dg-rubble', s(20.3, 9.2), G, 5, 120)
  add(label(id('note'), 'the congregation', s(17.9, 5.3), 15, 'place'))
  add(label(id('note'), 'D.R. 3 Ashfall', s(15.9, 9.4), 13, 'place'))

  // ---- 5. the cold stair, top and foot; the Lithic lintel; Dannic's gear on the landing ----
  put('dg-spiral', s(22.3, 6), 1.8 * G, 1, 0)
  add(label(id('note'), 'down 100 ft', s(22.3, 7.9), 14, 'place'))
  put('dg-spiral', s(3.4, 13.4), 1.8 * G, 1, 0)
  add(label(id('note'), 'up to the chapel', s(3.7, 15.9), 14, 'place'))
  put('bm-bedroll', s(4.8, 14.6), 0.9 * G, 2, 80)
  put('bm-crate', s(2.6, 15), 0.45 * G, 0, 20)
  add(label(id('note'), 'glyphs over the arch', s(6.9, 13.1), 13, 'place'))
  put('dg-arch', s(5.6, 13.8), G, 0, 90)

  // ---- 6. the cold room: the Captain in his chair, the stash in a ring round him ----
  put('dg-throne', s(11, 13.8), 1.1 * G, 0, 0)
  const ring: [string, number, number][] = [['bm-sacks', 0.6, 0], ['bm-sacks', 0.6, 0], ['bm-chest', 0.6, 0], ['bm-crate', 0.45, 0], ['bm-crate', 0.35, 0]]
  ring.forEach(([asset, size], i) => {
    const a = (i / ring.length) * Math.PI * 2 + 0.4
    put(asset, [11 * G + Math.cos(a) * 1.6 * G, 13.8 * G + Math.sin(a) * 1.6 * G], size * G, i, Math.round((a * 180) / Math.PI) + 90)
  })

  // ---- 7. the red seam: a crack running down and east to the Lithic door ----
  add(line(id('seam'), 'ink', [s(14.2, 14.1), s(15.6, 15.3), s(17.8, 14.9), s(19.6, 16.2), s(21.2, 15.7)]))
  put('dg-door', s(22.6, 15.6), 1.4 * G, 1, 270)
  add(label(id('note'), 'Lithic door', s(22.1, 17.1), 14, 'place'))
  add(label(id('note'), 'red light under the glass', s(18, 17.2), 13, 'place'))

  // ---- the key: big numbers like an old dungeon map ----
  for (const a of AREAS) add(label(`area-${a.n}`, String(a.n), a.at, 46, 'title'))
  add(label(id('title'), 'The Glass Barrow', s(19.6, 0.75), 30, 'title'))
  add(label(id('title'), 'a hundred feet below', s(8, 17.4), 15, 'place'))

  return {
    background: 'stone',
    grid: 'square',
    gridSize: G,
    shapes,
    style: 'classic',
    scene: 'battle',
    look: 'colour',
    biome: 'winter',
    shadows: true,
    frame: false,
    seed: 3005,
    groundBase: 'floor',
    ground,
    rooms,
    outside: 'rock',
  }
}
