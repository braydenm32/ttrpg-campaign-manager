/**
 * In-app map drawings. A drawing is brush strokes plus a list of shapes; it is painted in the
 * hand-inked style (src/mapArt/classic.ts) and the picture is stored as the map's image asset, so
 * drawn maps get pins, regions, player view and nested maps exactly like uploaded ones.
 */

export const TERRAINS = {
  land: { label: 'Land', fill: '#cdbb8b', edge: '#8a7650' },
  grass: { label: 'Grassland', fill: '#a9b56e', edge: '#6f7a3f' },
  forest: { label: 'Forest', fill: 'url(#p-forest)', edge: '#3f6131' },
  mountains: { label: 'Mountains', fill: 'url(#p-mountains)', edge: '#6b604d' },
  hills: { label: 'Hills', fill: 'url(#p-hills)', edge: '#8a7650' },
  swamp: { label: 'Swamp', fill: 'url(#p-swamp)', edge: '#4f5a33' },
  desert: { label: 'Desert', fill: 'url(#p-desert)', edge: '#b0904f' },
  snow: { label: 'Snow / ice', fill: '#e9eef2', edge: '#a6b4bf' },
  water: { label: 'Water', fill: 'url(#p-water)', edge: '#1f4a5c' },
  floor: { label: 'Stone floor', fill: 'url(#p-floor)', edge: '#1a1a1f' },
  wood: { label: 'Wood floor', fill: 'url(#p-wood)', edge: '#3d2a17' },
} as const
export type Terrain = keyof typeof TERRAINS

export const LINE_STYLES = {
  road: { label: 'Road', color: '#7a5a33', width: 5, dash: '14 10' },
  path: { label: 'Trail', color: '#7a5a33', width: 3, dash: '4 8' },
  river: { label: 'River', color: '#3f7f9e', width: 8, dash: '' },
  wall: { label: 'Wall', color: '#1a1a1f', width: 10, dash: '' },
  border: { label: 'Border', color: '#8b2f3c', width: 4, dash: '18 6 4 6' },
  ink: { label: 'Ink', color: '#3a2e1c', width: 3, dash: '' },
  fence: { label: 'Fence', color: '#6b4a2a', width: 4, dash: '3 7' },
  hedge: { label: 'Hedge', color: '#4f6a35', width: 16, dash: '' },
  cliff: { label: 'Cliff edge', color: '#5a5348', width: 7, dash: '' },
  dwall: { label: 'Inner wall', color: '#1a1a1f', width: 8, dash: '' },
  street: { label: 'Street', color: '#b59a6a', width: 12, dash: '' },
  townwall: { label: 'Town wall', color: '#6d6a64', width: 12, dash: '' },
} as const
export type LineStyle = keyof typeof LINE_STYLES

export const STAMPS = {
  city: 'City',
  town: 'Town',
  village: 'Village',
  castle: 'Castle',
  tower: 'Tower',
  ruins: 'Ruins',
  temple: 'Temple',
  inn: 'Inn',
  cave: 'Cave',
  dungeon: 'Dungeon',
  camp: 'Camp',
  ship: 'Ship',
  tree: 'Tree',
  peak: 'Mountain',
  door: 'Door',
  chest: 'Chest',
  stairs: 'Stairs',
  skull: 'Danger',
  star: 'Point of interest',
  compass: 'Compass',
} as const
export type StampKind = keyof typeof STAMPS

export type Point = [number, number]

/** Lettering for classic maps: a title, spaced capitals for regions, or italic place names. */
export type LabelFont = 'title' | 'region' | 'place'

export type Shape =
  | { id: string; kind: 'area'; terrain: Terrain; points: Point[]; smooth: boolean }
  | {
      id: string
      kind: 'line'
      style: LineStyle
      points: Point[]
      smooth: boolean
      /** Streets: how wide, in map pixels. */
      width?: number
      /** Town walls: which version of tower stands at the corners, or -1 for none. */
      towers?: number
    }
  | { id: string; kind: 'stamp'; stamp: StampKind; at: Point; size: number }
  | {
      id: string
      kind: 'label'
      text: string
      at: Point
      size: number
      color: string
      italic: boolean
      /** Classic maps: the text follows this curve instead of sitting straight at `at`. */
      curve?: Point[]
      font?: LabelFont
    }
  /** Classic maps: a piece from the hand-inked library (src/mapArt). `seed` makes each copy its own. */
  | { id: string; kind: 'asset'; asset: string; at: Point; size: number; seed: number; variant: number; flip?: boolean; turn?: number }

export const BACKGROUNDS = {
  sea: { label: 'Open sea (draw land on it)', fill: 'url(#p-sea)' },
  parchment: { label: 'Parchment', fill: '#e8dcb8' },
  grass: { label: 'Grassland', fill: '#a9b56e' },
  stone: { label: 'Dark stone (dungeons)', fill: '#24222a' },
} as const
export type Background = keyof typeof BACKGROUNDS

/**
 * 'classic' is the hand-inked fantasy map look. 'simple' was the original flat look; it is no longer
 * offered, and old simple drawings are turned into classic ones (see toClassic).
 */
export type MapStyle = 'simple' | 'classic'
export type Look = 'parchment' | 'white' | 'colour'
export type Biome = 'temperate' | 'autumn' | 'winter' | 'desert' | 'swamp' | 'tropical'
export type LayerId = 'land' | 'rivers' | 'paths' | 'objects' | 'labels'
/**
 * A world or region seen from the side (mountains, forests); a town or city seen from above, as a
 * town plan; or a battle map, dungeon or building seen from above on 5 ft squares.
 */
export type Scene = 'world' | 'city' | 'battle'

/** On town maps a 5 ft square is this many pixels (about 1.4 px to a foot), so a house is a few dozen pixels. */
export const CITY_GRID = 7

/** Maps seen from above: whether the map is a town plan, battle map or dungeon rather than a side-on world map. */
export const fromAbove = (d: Pick<Drawing, 'scene'>) => d.scene === 'battle' || d.scene === 'city'

/**
 * How big the ground's texture and the small line work (fences, hedges, stone walls) are drawn, over
 * their battle-map size. On battle maps that's the grid; town maps keep them at a size that still
 * reads as grass or a hedge, rather than shrinking them to their true size in feet.
 */
export const drawUnit = (d: Pick<Drawing, 'scene' | 'gridSize'>) => (d.scene === 'city' ? 0.4 : (d.gridSize || 70) / 70)

/** What the ground of a battle map is painted with. */
export const GROUNDS = {
  grass: 'Grass',
  dirt: 'Dirt',
  sand: 'Sand',
  stone: 'Rocky ground',
  mud: 'Mud',
  snow: 'Snow',
  paving: 'Paving stones',
  floor: 'Smooth floor',
  boards: 'Wooden boards',
  water: 'Water',
} as const
export type GroundId = keyof typeof GROUNDS

/** A soft-edged brush stroke of one kind of ground on a battle map; later strokes paint over earlier ones. */
export interface GroundStroke {
  id: string
  ground: GroundId
  size: number
  points: Point[]
  /** Only paints inside the rooms (a floor that stops at the walls). */
  inside?: boolean
}

/**
 * A room on a battle map: floor dug out of the rock (or filled back in), in the order drawn. Rooms
 * that overlap or touch merge, and the walls run round the outside of them all.
 * rect and round: two opposite corners (round is the oval inside them). corridor: the middle of a
 * passage `size` wide. cave: a rough-edged brush stroke `size` wide.
 */
export interface RoomStroke {
  id: string
  mode: 'dig' | 'fill'
  shape: 'rect' | 'round' | 'corridor' | 'cave'
  points: Point[]
  size?: number
}

/** A brush stroke that paints land, or carves water (sea, lakes) back out of it. */
export interface LandStroke {
  id: string
  mode: 'land' | 'water'
  size: number
  points: Point[]
}

export interface Drawing {
  background: Background
  grid: 'none' | 'square' | 'hex'
  gridSize: number
  shapes: Shape[]
  style?: MapStyle
  look?: Look
  biome?: Biome
  shadows?: boolean
  /** Ruled border around the edge (classic). On unless false. */
  frame?: boolean
  /** Shapes the ragged coast and the paper stains; change it for a different hand. */
  seed?: number
  land?: LandStroke[]
  scene?: Scene
  /** Battle and town maps: the ground everything starts on, and what's been painted over it. */
  groundBase?: GroundId
  ground?: GroundStroke[]
  /** Battle maps: rooms and passages, and whether what's outside them is solid rock (a dungeon) or the ground. */
  rooms?: RoomStroke[]
  outside?: 'rock' | 'ground'
  hidden?: LayerId[]
  locked?: LayerId[]
}

export const LAYERS: { id: LayerId; label: string }[] = [
  { id: 'land', label: 'Land & sea' },
  { id: 'rivers', label: 'Rivers' },
  { id: 'paths', label: 'Roads & borders' },
  { id: 'objects', label: 'Objects' },
  { id: 'labels', label: 'Labels' },
]

export const layerOf = (s: Shape): LayerId =>
  s.kind === 'area' ? 'land' : s.kind === 'line' ? (s.style === 'river' ? 'rivers' : 'paths') : s.kind === 'label' ? 'labels' : 'objects'

export const emptyDrawing = (background: Background, scene: Scene = 'world', groundBase: GroundId = 'grass'): Drawing => {
  const seed = 1 + Math.floor(Math.random() * 99999)
  const style = 'classic'
  if (scene === 'battle')
    return { background, grid: 'square', gridSize: 70, shapes: [], style, scene, look: 'colour', biome: 'temperate', shadows: true, frame: false, seed, groundBase, ground: [] }
  if (scene === 'city')
    return { background, grid: 'none', gridSize: CITY_GRID, shapes: [], style, scene, look: 'parchment', biome: 'temperate', shadows: true, frame: true, seed, groundBase, ground: [], land: [] }
  return { background, grid: 'none', gridSize: 70, shapes: [], style, look: 'parchment', biome: 'temperate', shadows: true, frame: true, seed, land: [] }
}

/**
 * An old flat-colour drawing as a hand-inked one. Its shapes all carry over: painted areas become
 * land or ground, symbols become pieces. A map with a grid was most likely a battle map.
 */
export function toClassic(d: Drawing): Drawing {
  if (d.style === 'classic') return d
  const scene: Scene = d.scene ?? (d.grid !== 'none' ? 'battle' : 'world')
  const groundBase: GroundId = d.background === 'stone' ? 'paving' : d.background === 'sea' ? 'water' : 'grass'
  return {
    look: scene === 'battle' ? 'colour' : 'parchment',
    biome: 'temperate',
    shadows: true,
    frame: scene !== 'battle',
    seed: 1 + Math.floor(Math.random() * 99999),
    groundBase,
    ...d,
    style: 'classic',
    scene,
  }
}

/** Smooth closed or open path through the points (Catmull-Rom converted to Béziers). */
export function pathFor(points: Point[], closed: boolean, smooth: boolean) {
  if (points.length < 2) return ''
  const f = (n: number) => Math.round(n * 10) / 10
  if (!smooth || points.length < 3) {
    return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}${closed ? ' Z' : ''}`
  }
  const p = (i: number) => (closed ? points[(i + points.length) % points.length] : points[Math.max(0, Math.min(points.length - 1, i))])
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  const n = closed ? points.length : points.length - 1
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + (closed ? ' Z' : '')
}

/** Ramer–Douglas–Peucker: drops points that barely change the shape, so freehand strokes stay light. */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points
  const dist = ([x, y]: Point, [x1, y1]: Point, [x2, y2]: Point) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
  }
  let max = 0
  let idx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = dist(points[i], points[0], points[points.length - 1])
    if (d > max) {
      max = d
      idx = i
    }
  }
  if (max <= tolerance) return [points[0], points[points.length - 1]]
  return [...simplify(points.slice(0, idx + 1), tolerance).slice(0, -1), ...simplify(points.slice(idx), tolerance)]
}
