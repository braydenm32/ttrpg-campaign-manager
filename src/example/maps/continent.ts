import type { Drawing, LabelFont, Point, Shape } from '../../mapDrawing'
import type { ExMap } from '../types'
import { BORDERS, LAND, PIECES, RENT, RIVERS, ROADS, TOWNS } from './continent-data'
import { arc, label, line, piece, pts } from './draw'

/** The page each named place on the map opens. */
const PLACE_PAGES: Record<string, string> = {
  'Caer Ardith': 'caer-ardith',
  Sevenhaven: 'sevenhaven',
  Marrowport: 'marrowport',
  Gilt: 'gilt',
  Cowl: 'cowl',
  Harrowquay: 'harrowquay',
  Keel: 'keel',
  Vessary: 'vessary',
  Hollowhall: 'hollowhall',
  Skarn: 'skarn',
  Hask: 'hask',
  Coldwater: 'coldwater',
  Ilmareth: 'ilmareth',
  Ardmere: 'ardmere',
  Fallowden: 'fallowden',
  Halcyra: 'halcyra',
  Qerath: 'qerath',
  Cinderford: 'cinderford',
}
const townId = (name: string) => `town-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`

const rentEnd = (): Point => [RENT.spine[RENT.spine.length - 2], RENT.spine[RENT.spine.length - 1]]

/** The Nine Great Wards, where lore-wards puts them: under the capital, north of Ardmere, south of Fallowden, in the Saelwood, at Sevenhaven, near Qerath, in the Standing Fields, above Hollowhall, and the Ninth leaning over the Rent's north-eastern end. */
const WARDS: Point[] = [[746, 600], [800, 372], [846, 552], [380, 500], [838, 832], [1238, 572], [1050, 640], [688, 284], [rentEnd()[0] + 8, rentEnd()[1] - 2]]

function continent(): Drawing {
  const shapes: Shape[] = []
  const add = (s: Shape) => shapes.push(s)
  let n = 0
  const id = (p: string) => `${p}-${n++}`

  // land: the mainland and islands, as coast outlines
  LAND.forEach((l) => add({ id: id('land'), kind: 'area', terrain: 'land', points: pts(l), smooth: true }))

  RIVERS.forEach((l) => add(line(id('river'), 'river', pts(l))))
  ROADS.forEach((l) => add(line(id('road'), 'road', pts(l))))
  BORDERS.forEach((l) => add(line(id('border'), 'border', pts(l))))

  // the Rent: a black core, a shaded far wall, a broken near lip and cracks running out into the ash
  const spine = pts(RENT.spine)
  const cut = Math.round(spine.length * 0.14)
  add(line('rent-core', 'wall', spine.slice(cut, spine.length - cut)))
  add(line('rent-near', 'ink', pts(RENT.left)))
  add(line('rent-far', 'ink', pts(RENT.right)))
  // (the cracks that would run across the Cinder are left out)
  RENT.cracks.filter((l) => pts(l).every(([, y]) => y < 470)).forEach((l) => add(line(id('rent-crack'), 'ink', pts(l))))
  RENT.hachures.forEach((l, i) => i % 2 === 0 && add(line(id('rent-shade'), 'ink', pts(l))))

  // the named places
  for (const [name, p] of Object.entries(TOWNS)) add(piece(townId(name), p.asset, p.at, p.size, p.seed, p.variant))
  // mountains, forests, ruins, waves and the map furniture
  for (const [asset, a] of Object.entries(PIECES))
    for (let i = 0; i < a.length; i += 5) add(piece(id(asset), asset, [a[i], a[i + 1]], a[i + 2], a[i + 3], a[i + 4]))
  WARDS.forEach((at, i) => add(piece(`ward-${i}`, 'standing-stones', at, 20, 7001 + i * 13, 7)))
  // where play begins: a ringed mark beside Cinderford
  add(piece('start-mark', 'city-dot', [884, 478], 13, 5, 1))

  // off-map arrows to the other continents
  const arrow = (from: Point, to: Point) => {
    const d = Math.hypot(to[0] - from[0], to[1] - from[1])
    const [ux, uy] = [(to[0] - from[0]) / d, (to[1] - from[1]) / d]
    add(line(id('arrow'), 'ink', [from, [from[0] + ux * d * 0.5, from[1] + uy * d * 0.5], to]))
    add(line(id('arrow'), 'ink', [[to[0] - ux * 11 - uy * 6, to[1] - uy * 11 + ux * 6], to, [to[0] - ux * 11 + uy * 6, to[1] - uy * 11 - ux * 6]]))
  }
  arrow([240, 928], [120, 1000])
  arrow([1450, 790], [1570, 790])

  // the key, under the scale
  add(piece('key-ward', 'standing-stones', [1300, 1082], 16, 7100, 7))
  add(piece('key-start', 'city-dot', [1300, 1100], 12, 5, 1))

  // lettering: nations in spaced capitals, water and land features in italic, towns upright
  const L = (text: string, at: Point, size: number, font: LabelFont, curve?: Point[], upright = false) => add(label(id('label'), text, at, size, font, curve, upright))
  L('Vael Ardith', [200, 1115], 30, 'title')
  L('the continent of the Nine Wards', [200, 1145], 13, 'place')
  const nation = (text: string, x0: number, y0: number, x1: number, y1: number, sag: number, size: number) => L(text, [(x0 + x1) / 2, (y0 + y1) / 2], size, 'region', arc(x0, y0, x1, y1, sag))
  nation('The Grimmark Holds', 626, 176, 1046, 176, -10, 24)
  nation('Sael', 436, 466, 530, 548, 4, 24)
  nation('The Regency', 535, 652, 755, 652, -6, 19)
  nation('of Ardith', 560, 682, 730, 682, -4, 19)
  nation('The Sevenhaven Concord', 570, 1040, 1030, 1040, 10, 18)
  nation('Iskaveth', 1148, 476, 1332, 476, -8, 22)
  nation('The Ashenreach', 880, 362, 1072, 362, -6, 14)
  const feature = (text: string, size: number, curve: Point[]) => L(text, curve[Math.floor(curve.length / 2)], size, 'place', curve)
  feature('the Grimmark', 15, [[1130, 352], [1220, 346], [1310, 354]])
  feature('the Saelwood', 15, [[400, 790], [450, 780], [500, 790]])
  feature("the Saint's Spine", 14, [[1172, 690], [1166, 740], [1186, 790]])
  feature('the Ardis', 13, [[820, 300], [826, 345], [820, 390]])
  feature('the Cinder', 12, [[948, 508], [992, 504], [1036, 498]])
  feature('the March of Cinders', 13, [[880, 548], [930, 536], [980, 548]])
  feature('the Ness of Thurm', 14, [[140, 662], [194, 682], [249, 704]])
  feature('The Hollow Sea', 22, [[150, 250], [157, 370], [150, 490]])
  feature('The Glass Sea', 22, [[1484, 330], [1476, 500], [1484, 670]])
  feature('The Grey Reach', 21, [[640, 76], [800, 68], [960, 76]])
  feature('The Southern Deep', 21, [[640, 1202], [800, 1210], [960, 1202]])
  L('the Rent', [1046, 452], 14, 'place')
  L('here the charts fail', [110, 548], 11, 'place')
  for (const [text, x, y, size] of [['Marrow Bay', 506, 902, 13], ['Bight of Cowl', 662, 926, 13], ['Bay of Tolls', 852, 886, 16], ['Gilt Water', 1068, 910, 12], ['Harrow Bay', 1196, 918, 13], ['Bay of Bells', 1288, 982, 12], ['Pale Sound', 1356, 1002, 12]] as const)
    L(text, [x, y], size, 'place')
  L('to Qal Merrow', [218, 904], 13, 'place')
  L('to Ostrakai', [1510, 770], 13, 'place')
  for (const [name, p] of Object.entries(TOWNS)) {
    const big = name === 'Caer Ardith' || name === 'Sevenhaven' || name === 'Cinderford'
    const dy = p.asset === 'temple' ? 14 : p.asset === 'tower' ? 10 : 12
    L(name, [p.at[0], p.at[1] + dy], big ? 16 : 13, 'place', undefined, true)
  }
  L('one of the Nine Great Wards', [1381, 1073], 12, 'place')
  L('play begins here', [1354, 1100], 12, 'place')

  return {
    background: 'sea',
    grid: 'none',
    gridSize: 70,
    shapes,
    style: 'classic',
    scene: 'world',
    look: 'parchment',
    biome: 'temperate',
    shadows: true,
    frame: true,
    seed: 7,
    land: [],
  }
}

/** The continent of Vael Ardith, as approved in the mock-up: six nations, the Ness, and the nine wards. */
export const CONTINENT: ExMap = {
  key: 'continent',
  name: 'Vael Ardith',
  width: 1600,
  height: 1250,
  players: true,
  location: 'vael-ardith',
  drawing: continent,
  pins: [
    // the nations, at their names
    { page: 'grimmark', at: [836, 160] },
    { page: 'sael', at: [470, 490] },
    { page: 'regency', at: [645, 630] },
    { page: 'concord', at: [800, 1022] },
    { page: 'iskaveth', at: [1196, 462] },
    { page: 'ashenreach', at: [976, 344], map: 'ashenreach' },
    { page: 'march-of-cinders', at: [958, 546] },
    { page: 'ness', at: [180, 600] },
    { page: 'the-rent', at: [1000, 425] },
    { page: 'qal-merrow', at: [150, 980] },
    { page: 'ostrakai', at: [1555, 790] },
    // towns and castles: the pieces themselves are the pins
    ...Object.entries(PLACE_PAGES).map(([name, page]) => ({ page, at: TOWNS[name].at, piece: townId(name) })),
    // the wards; the ninth is the cracked one at the Rent
    ...WARDS.map((_, i) => ({ page: i === 8 ? 'ninth-stone' : 'lore-wards', at: WARDS[i], piece: `ward-${i}` })),
  ],
}
