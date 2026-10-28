import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Empty, VisibilityToggle } from '../components'
import { blankEntity, db, ENTITY_LABELS, newId, type Entity, type Pin, type WorldMap } from '../db'
import { useVisibleEntities, useWorld } from '../hooks'
import { renderPlayerFog } from '../fog'
import {
  CITY_GRID,
  fromAbove,
  GROUNDS,
  LAYERS,
  LINE_STYLES,
  pathFor,
  simplify,
  STAMPS,
  TERRAINS,
  toClassic,
  type Biome,
  type Drawing,
  type GroundId,
  type LabelFont,
  type LayerId,
  type LineStyle,
  type Look,
  type Point,
  type RoomStroke,
  type Scene,
  type Shape,
  type StampKind,
  type Terrain,
} from '../mapDrawing'
import { ASSET_GROUPS, Atlas, assetNamesIn, BATTLE_GROUPS, CITY_GROUPS } from '../mapArt/atlas'
import { canTurn, classicBlob, classicHitSvg, drawPiece, floorTest, FONTS, landTest, loadMapFonts, LOOKS, pieceOutline, renderClassic, riverWidth, roomTest, streetWidth, styleFor, townWallHalf } from '../mapArt/classic'
import { groundColour } from '../mapArt/ground'
import { useViewMode } from '../viewMode'
import { worldPath } from '../paths'

type Tool = 'select' | 'hand' | 'land' | 'coast' | 'room' | 'line' | 'stamp' | 'label' | 'erase'

interface ToolDef {
  id: Tool
  icon: string
  label: string
  hint: string
}

const WORLD_TOOLS: ToolDef[] = [
  { id: 'select', icon: '🖐', label: 'Select', hint: 'Click a piece, line or label to edit it, drag to move it' },
  { id: 'hand', icon: '✋', label: 'Pan', hint: 'Drag to move around. Scroll to zoom' },
  { id: 'land', icon: '🖌', label: 'Land', hint: 'Drag to paint land; switch to Water to carve out seas, bays and lakes. The coast draws itself' },
  { id: 'line', icon: '〰', label: 'Line', hint: 'Drag to draw rivers, roads, trails and borders' },
  { id: 'stamp', icon: '⛰', label: 'Place', hint: 'Click to place a piece. Click and hold, then drag, to scatter lots of them' },
  { id: 'label', icon: '🔤', label: 'Label', hint: 'Click to place text, or drag to write it along a curve' },
  { id: 'erase', icon: '🧽', label: 'Erase', hint: 'Click a piece, line or label to delete it, or drag across several' },
]

const BATTLE_TOOLS: ToolDef[] = [
  { id: 'select', icon: '🖐', label: 'Select', hint: 'Click a piece, line or label to edit it, drag to move it' },
  { id: 'hand', icon: '✋', label: 'Pan', hint: 'Drag to move around. Scroll to zoom' },
  { id: 'land', icon: '🖌', label: 'Ground', hint: 'Drag to paint grass, dirt, sand, stone, mud, snow, floors or water. Where two kinds meet they blend softly' },
  { id: 'room', icon: '🧱', label: 'Rooms', hint: 'Drag to dig out a room, passage or cave. Rooms that touch join up, and the walls draw themselves' },
  { id: 'line', icon: '〰', label: 'Line', hint: 'Drag to draw fences, hedges, stone walls and cliff edges' },
  { id: 'stamp', icon: '🌳', label: 'Place', hint: 'Click to place a piece. Click and hold, then drag, to scatter lots of them' },
  { id: 'label', icon: '🔤', label: 'Label', hint: 'Click to place text, or drag to write it along a curve' },
  { id: 'erase', icon: '🧽', label: 'Erase', hint: 'Click a piece, line or label to delete it, or drag across several' },
]

const CITY_TOOLS: ToolDef[] = [
  { id: 'select', icon: '🖐', label: 'Select', hint: 'Click a piece, line or label to edit it, drag to move it' },
  { id: 'hand', icon: '✋', label: 'Pan', hint: 'Drag to move around. Scroll to zoom' },
  { id: 'land', icon: '🖌', label: 'Ground', hint: 'Drag to paint grass, dirt, sand, paving stones, mud, snow or water: squares, gardens, ponds and canals' },
  { id: 'coast', icon: '🌊', label: 'Coast', hint: 'Drag to paint land; switch to Sea to carve out the sea, a harbour or a lake. The coast draws itself' },
  { id: 'line', icon: '〰', label: 'Line', hint: 'Drag to draw streets, town walls, stone walls, fences, hedges and rivers' },
  { id: 'stamp', icon: '🏠', label: 'Place', hint: 'Click to place a piece. Click and hold, then drag, to scatter lots of them' },
  { id: 'label', icon: '🔤', label: 'Label', hint: 'Click to place text, or drag to write it along a curve' },
  { id: 'erase', icon: '🧽', label: 'Erase', hint: 'Click a piece, line or label to delete it, or drag across several' },
]

/** Which kinds of line each kind of map offers. */
const WORLD_LINES: LineStyle[] = ['river', 'road', 'path', 'border', 'wall', 'ink']
const CITY_LINES: LineStyle[] = ['street', 'townwall', 'wall', 'fence', 'hedge', 'river', 'path', 'ink']
const BATTLE_LINES: LineStyle[] = ['fence', 'hedge', 'wall', 'dwall', 'cliff', 'ink']
/** Lines drawn as straight runs between the points: walls have corners. */
const STRAIGHT: LineStyle[] = ['wall', 'townwall']
/** How wide streets can be, in feet. */
/** The widths town-map streets and rivers come in, in feet, and what the ends of the range are. */
const LINE_FT = { street: [10, 15, 20, 30, 40], river: [15, 30, 50, 80, 120] }
const FT_NOTE: Record<string, string> = { 'street 10': ' (a lane)', 'street 40': ' (a high street)', 'river 15': ' (a stream)', 'river 120': ' (a great river)' }
type Way = keyof typeof LINE_FT
/** Lines drawn at a width the GM picks: streets, and rivers on town maps. */
const wayOf = (style: LineStyle, d: Pick<Drawing, 'scene'>): Way | undefined => (style === 'street' ? 'street' : style === 'river' && d.scene === 'city' ? 'river' : undefined)

/** The Ground brush: what it paints, how wide, and whether it stops at the walls of rooms. */
type GroundBrush = { ground: GroundId; size: number; inside: boolean }
/** The Ground brush's sizes go up in 5 ft squares on battle maps, and in 25 ft on town maps (where a square is tiny). */
const groundStep = (d: Drawing) => (d.gridSize || 70) * (d.scene === 'city' ? 5 : 1)
/** New lines: how wide a street is, in feet, and which tower stands at a town wall's corners (-1 for none). */
type LineOpts = { ft: Record<Way, number>; towers: number }
/** Laid floors stop at the walls unless you say otherwise; natural ground goes everywhere. */
const FLOORS: GroundId[] = ['paving', 'floor', 'boards']
/** The grounds a map offers: town maps are outdoors, so no floors or boards. */
const groundsFor = (city: boolean) => (Object.keys(GROUNDS) as GroundId[]).filter((g) => !city || (g !== 'floor' && g !== 'boards'))
/** How the Rooms tool digs: its shape, digging out or filling in, passage width and cave brush size (px), and grid snapping. */
type RoomBrush = { shape: RoomStroke['shape']; mode: RoomStroke['mode']; width: number; cave: number; snap: boolean }
const ROOM_SHAPES: { id: RoomStroke['shape']; icon: string; label: string; hint: string }[] = [
  { id: 'rect', icon: '▭', label: 'Room', hint: 'Drag from corner to corner' },
  { id: 'round', icon: '◯', label: 'Round room', hint: 'Drag from corner to corner; the room is the oval inside' },
  { id: 'corridor', icon: '═', label: 'Passage', hint: 'Drag along the way it goes; it straightens itself out' },
  { id: 'cave', icon: '☁', label: 'Cave', hint: 'Drag freely; the walls come out rough, like rock' },
]

/** Starting sizes for battle-map pieces, at 70 px to a 5 ft square (scaled to the map's grid). */
const BATTLE_SIZE: Record<string, number> = {
  'bm-tree': 170, 'bm-pine': 130, 'bm-dead-tree': 140, 'bm-bush': 60, 'bm-grass': 34, 'bm-flowers': 44, 'bm-reeds': 50, 'bm-fern': 44, 'bm-mushrooms': 30,
  'bm-stump': 44, 'bm-log': 190, 'bm-rock': 70, 'bm-rocks': 100, 'bm-lilypads': 60,
  'bm-tent': 150, 'bm-campfire': 70, 'bm-bedroll': 80, 'bm-cart': 210, 'bm-crate': 46, 'bm-barrel': 38, 'bm-sacks': 56, 'bm-woodpile': 90, 'bm-chest': 46,
  'bm-well': 95, 'bm-haystack': 110, 'bm-stall': 170, 'bm-table': 120, 'bm-gravestone': 36, 'bm-statue': 80, 'bm-signpost': 64, 'bm-rowboat': 160,
  'bm-cottage': 320, 'bm-house': 330, 'bm-barn': 430, 'bm-tower': 230, 'bm-chapel': 400, 'bm-ruin': 380, 'bm-bridge': 300, 'bm-tent-large': 290,
  'dg-door': 70, 'dg-double-door': 140, 'dg-portcullis': 70, 'dg-arch': 70, 'dg-trapdoor': 70, 'dg-grate': 60,
  'dg-stairs': 140, 'dg-spiral': 140, 'dg-pillar': 50, 'dg-pillar-square': 50, 'dg-pit': 140, 'dg-rubble': 100, 'dg-bones': 70,
  'dg-brazier': 50, 'dg-torch': 50, 'dg-altar': 140, 'dg-sarcophagus': 140, 'dg-coffin': 120, 'dg-bookshelf': 140, 'dg-bed': 140,
  'dg-throne': 90, 'dg-cage': 120, 'dg-rug': 200, 'dg-weapon-rack': 140, 'dg-cauldron': 70, 'dg-magic-circle': 280,
}

/** Starting sizes for town pieces, at 7 px to a 5 ft square (scaled to the map's grid). */
const CITY_SIZE: Record<string, number> = {
  'ct-houses': 140, 'ct-manor': 180, 'ct-guildhall': 150, 'ct-market': 150, 'ct-keep': 350, 'ct-cathedral': 300, 'ct-gatehouse': 75, 'ct-wall-tower': 42,
  'ct-pier': 160, 'ct-ship': 110, 'ct-fields': 400, 'ct-boats': 90,
}

/** Starting sizes for library pieces, at a 1400 px map (scaled to the map's size). */
const PIECE_SIZE: Record<string, number> = {
  mountain: 36, 'mountain-soft': 30, 'mountain-small': 18, hill: 14, downs: 14, volcano: 60,
  tree: 13, pine: 15, 'tree-tiny': 9, 'forest-clump': 46, 'wood-stipple': 46, grass: 9, marsh: 16, palm: 18, scrub: 12, 'dead-tree': 15,
  'city-dot': 9, 'compass-rose': 120, cartouche: 320, 'scale-bar': 160, ship: 50, 'sea-serpent': 56, cloud: 100, waves: 22, whirlpool: 30,
}
const pieceSize = (asset: string, W: number, H: number, gridSize = 70) => {
  if (asset.startsWith('ct-')) return Math.round(((CITY_SIZE[asset] ?? 120) * (gridSize || CITY_GRID)) / CITY_GRID)
  if (/^(bm|dg)-/.test(asset)) return Math.round(((BATTLE_SIZE[asset] ?? 80) * (gridSize || 70)) / 70)
  const def = Atlas.assets[asset]
  const base = PIECE_SIZE[asset] ?? (def?.category === 'settlements' ? 34 : def?.category === 'landmarks' ? 30 : 30)
  return Math.round(base * Math.max(1, Math.max(W, H) / 1400))
}
/** Natural things get flipped at random, so a range of mountains doesn't all lean the same way. */
const flips = (asset: string) => ['mountains', 'hills', 'vegetation', 'bm-trees', 'bm-plants', 'bm-rocks'].includes(Atlas.assets[asset]?.category ?? '')
/** Natural pieces are drawn fresh from a seed; versions 1 to 8 are fixed seeds, so they can be previewed and picked. */
const versionSeed = (v: number) => 1000 + v * 7919
const randomSeed = () => 1 + Math.floor(Math.random() * 2 ** 30)
/**
 * What the Place tool puts down: a piece, its size and version, how it's turned, and any other
 * pieces mixed in with it (the brush then picks one of them at random each time).
 */
/** How a piece is turned: as drawn or by so many degrees, every which way, or (town maps) lined up with the nearest street. */
type Turn = number | 'random' | 'street'
type PieceChoice = { asset: string; size: number; variant: number | 'random'; turn: Turn; mix: string[] }
/** On town maps, buildings and fields line up with the streets and keep off them. */
const LINES_UP = ['ct-houses', 'ct-castle', 'ct-fields', 'bm-buildings']
const linesUp = (asset: string) => (LINES_UP.includes(Atlas.assets[asset]?.category ?? '') || LINES_UP.includes(asset)) && !WALL_PIECES.includes(asset)
/** Camp gear and loose things look best turned every which way; town buildings face the street; everything else starts as drawn. */
const defaultTurn = (asset: string, d: Pick<Drawing, 'scene'>): Turn =>
  d.scene === 'city' && linesUp(asset)
    ? 'street'
    : ['bm-camp', 'bm-objects'].includes(Atlas.assets[asset]?.category ?? '') || ['dg-rubble', 'dg-bones'].includes(asset)
      ? 'random'
      : 0
/** Doors start as a plain closed door; open, broken and barred ones are a pick away. */
const choose = (asset: string, W: number, H: number, d: Pick<Drawing, 'scene' | 'gridSize'>): PieceChoice => ({
  asset, size: pieceSize(asset, W, H, d.gridSize), variant: Atlas.assets[asset]?.category === 'dg-doors' ? 0 : 'random', turn: defaultTurn(asset, d), mix: [],
})

/** Other words people search the piece library with. */
const KEYWORDS: Record<string, string> = {
  'bm-pine': 'tree conifer fir', 'bm-bush': 'shrub', 'bm-dead-tree': 'dead', 'bm-log': 'tree', 'bm-rock': 'stone', 'bm-rocks': 'stones boulders',
  'bm-lilypads': 'pond lake', 'bm-reeds': 'pond marsh swamp', 'bm-campfire': 'fire', 'bm-bedroll': 'bed sleeping', 'bm-woodpile': 'logs firewood',
  'bm-cart': 'wagon', 'bm-sacks': 'bags grain', 'bm-chest': 'treasure loot', 'bm-table': 'tavern chairs', 'bm-rowboat': 'boat ship',
  'bm-haystack': 'hay farm', 'bm-well': 'water', 'bm-stall': 'market shop', 'bm-gravestone': 'grave tomb cemetery', 'bm-statue': 'fountain monument',
  'bm-signpost': 'sign road', 'bm-cottage': 'house hut', 'bm-house': 'home building', 'bm-barn': 'farm', 'bm-tower': 'castle keep',
  'bm-chapel': 'church temple shrine', 'bm-ruin': 'ruins', 'bm-tent-large': 'tent marquee', 'bm-tent': 'camp',
  'dg-door': 'doorway plank wooden entrance', 'dg-double-door': 'doors gate grand entrance', 'dg-portcullis': 'gate bars iron grille', 'dg-arch': 'archway doorway opening curtain',
  'dg-trapdoor': 'hatch trap floor ladder', 'dg-grate': 'drain sewer grille', 'dg-stairs': 'steps staircase up down descend ladder', 'dg-spiral': 'stairs steps winding staircase tower',
  'dg-pillar': 'column post support colonnade', 'dg-pillar-square': 'column pier buttress post', 'dg-pit': 'hole trap chasm shaft well', 'dg-rubble': 'rocks stones collapse debris masonry',
  'dg-bones': 'skeleton skull remains corpse', 'dg-altar': 'shrine temple sacrifice offering', 'dg-sarcophagus': 'tomb crypt grave effigy',
  'dg-coffin': 'casket burial crypt undead', 'dg-bookshelf': 'library books scrolls study', 'dg-bed': 'cot bunk sleep barracks',
  'dg-throne': 'seat chair king dais', 'dg-cage': 'prison cell bars jail', 'dg-rug': 'carpet mat fur hide',
  'dg-weapon-rack': 'armoury armory arms swords shields', 'dg-cauldron': 'pot witch brew kitchen', 'dg-magic-circle': 'ritual summoning pentagram runes sigil', 'dg-brazier': 'fire coals firepit flame light', 'dg-torch': 'fire light sconce lantern candle flame',
  'ct-houses': 'house home row terrace street block town', 'ct-manor': 'mansion noble estate villa house', 'ct-guildhall': 'hall inn tavern town hall warehouse mill',
  'ct-market': 'square plaza fair stalls shops fountain', 'ct-keep': 'castle fort fortress citadel palace', 'ct-cathedral': 'church temple abbey monastery chapel shrine',
  'ct-gatehouse': 'gate wall entrance', 'ct-wall-tower': 'tower turret wall bastion', 'ct-pier': 'dock jetty quay wharf harbour harbor',
  'ct-ship': 'boat galleon caravel cog galley longship', 'ct-fields': 'farm farmland crops orchard vineyard', 'ct-boats': 'rowboat fishing boats',
  pine: 'tree', palm: 'tree', 'dead-tree': 'tree', 'forest-clump': 'trees woods', 'wood-stipple': 'trees woods', ship: 'boat', city: 'town',
  port: 'harbour harbor town', village: 'town', castle: 'fort keep', 'city-dot': 'town', 'compass-rose': 'north', cartouche: 'title',
}

/** How close the scatter brush packs pieces, as a share of their size. */
const THICKNESS = [
  { label: 'Sparse', gap: 1.5 },
  { label: 'Light', gap: 1.1 },
  { label: 'Medium', gap: 0.8 },
  { label: 'Thick', gap: 0.6 },
  { label: 'Packed', gap: 0.42 },
]
/** The piece the Place tool starts with on each kind of map. */
const firstPiece = (d: Drawing) => (d.scene === 'battle' ? (d.outside === 'rock' ? 'dg-pillar' : 'bm-tree') : d.scene === 'city' ? 'ct-houses' : 'mountain')
/** Town walls are the only lines gatehouses and wall towers snap to. */
const WALL_PIECES = ['ct-gatehouse', 'ct-wall-tower']

/** Scattered natural things and towns stay on land; ships, serpents and waves stay at sea. */
const ASHORE = ['mountains', 'hills', 'vegetation', 'settlements', 'landmarks', 'symbols']

export default function MapBuilder() {
  const { worldId } = useWorld()
  const { mapId = '' } = useParams()
  const { isGM } = useViewMode()
  const map = useLiveQuery(() => db.maps.get(mapId), [mapId])
  if (map === undefined) return null
  if (!isGM || map === null || map.worldId !== worldId || !map.drawing) return <Empty>This map can't be drawn on.</Empty>
  return <Builder key={map.id} map={map as WorldMap & { drawing: Drawing }} />
}

function Builder({ map }: { map: WorldMap & { drawing: Drawing } }) {
  const { worldId } = useWorld()
  const W = map.width
  const H = map.height
  // an old flat-colour drawing is redrawn by hand the first time it's opened (and saved that way)
  const [drawing, setDrawing] = useState<Drawing>(() => toClassic(map.drawing))
  const battle = drawing.scene === 'battle'
  const city = drawing.scene === 'city'
  const top = fromAbove(drawing)
  const TOOLS = battle ? BATTLE_TOOLS : city ? CITY_TOOLS : WORLD_TOOLS
  const [past, setPast] = useState<Drawing[]>([])
  const [future, setFuture] = useState<Drawing[]>([])
  const [tool, setTool] = useState<Tool>('land')
  const [lineStyle, setLineStyle] = useState<LineStyle>(battle ? 'fence' : city ? 'street' : 'river')
  const [lineOpts, setLineOpts] = useState<LineOpts>({ ft: { street: 20, river: 50 }, towers: 0 })
  const [brush, setBrush] = useState<{ mode: 'land' | 'water'; size: number }>(() => ({ mode: 'land', size: Math.round(Math.max(W, H) / 16) }))
  const [piece, setPieceState] = useState<PieceChoice>(() => choose(firstPiece(drawing), W, H, drawing))
  const [recent, setRecent] = useState<string[]>(() => [piece.asset])
  // the pieces picked lately, for the "Recently used" row
  const setPiece = (next: PieceChoice) => {
    setPieceState(next)
    setRecent((r) => [...new Set([next.asset, ...next.mix, ...r])].slice(0, 8))
  }
  const [groundBrush, setGroundBrush] = useState<GroundBrush>(() => ({ ground: 'dirt', size: Math.round(groundStep(drawing) * 2), inside: false }))
  const [roomBrush, setRoomBrush] = useState<RoomBrush>(() => ({ shape: 'rect', mode: 'dig', width: drawing.gridSize || 70, cave: 2 * (drawing.gridSize || 70), snap: true }))
  const [roomDraft, setRoomDraft] = useState<RoomStroke>()
  const [spray, setSpray] = useState(() => ({ spread: Math.round(Math.max(W, H) / 18), thickness: 3 }))
  const [labelText, setLabelText] = useState('')
  const [labelSize, setLabelSize] = useState(() => Math.round(Math.max(W, H) / 40))
  const [labelFont, setLabelFont] = useState<LabelFont>(top ? 'place' : 'region')
  const [selectedId, setSelectedId] = useState<string>()
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H })
  const [draft, setDraft] = useState<Point[]>([])
  const [saved, setSaved] = useState(true)
  const [canvas, setCanvas] = useState({ w: W, h: H })
  const svgRef = useRef<SVGSVGElement>(null)
  const artRef = useRef<HTMLCanvasElement>(null)
  const gesture = useRef<
    | { kind: 'pan'; client: Point; view: typeof view }
    | { kind: 'draw'; points: Point[] }
    | { kind: 'room'; points: Point[] }
    | { kind: 'move'; id: string; start: Point; before: Drawing }
    | { kind: 'scatter'; before: Drawing; placed: Shape[]; start: Point; at: Point; t0: number; moved: boolean; fits: (asset: string, p: Point) => boolean }
    | { kind: 'erase'; before: Drawing; ids: Set<string> }
  >(undefined)
  const scatterTimer = useRef<number>(undefined)
  const ringRef = useRef<SVGCircleElement>(null)
  const spaceDown = useRef(false)

  const commit = useCallback(
    (next: Drawing, before: Drawing = drawing) => {
      setPast((p) => [...p.slice(-80), before])
      setFuture([])
      setDrawing(next)
    },
    [drawing],
  )
  const undo = useCallback(() => {
    if (!past.length) return
    setFuture((f) => [drawing, ...f])
    setDrawing(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
  }, [past, drawing])
  const redo = useCallback(() => {
    if (!future.length) return
    setPast((p) => [...p, drawing])
    setDrawing(future[0])
    setFuture((f) => f.slice(1))
  }, [future, drawing])
  const updateShape = (id: string, patch: Partial<Shape>) =>
    commit({ ...drawing, shapes: drawing.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as Shape) : s)) })
  const removeShape = useCallback(
    (id: string) => {
      commit({ ...drawing, shapes: drawing.shapes.filter((s) => s.id !== id) })
      setSelectedId(undefined)
    },
    [commit, drawing],
  )

  // A fogged map's players' picture is remade once you're done drawing (not on every stroke).
  useEffect(() => () => void renderPlayerFog(map.id).catch(() => {}), [map.id])
  useEffect(() => () => window.clearInterval(scatterTimer.current), [])

  // Classic maps are painted on a canvas under the editor. It's redrawn shortly after each change,
  // and at a steady pace while changes keep coming (the scatter brush), always with the latest drawing.
  const lastArt = useRef<{ drawing: Drawing; canvas: HTMLCanvasElement }>(undefined)
  const nextArt = useRef<Drawing>(undefined)
  const artTimer = useRef<number>(undefined)
  useEffect(() => {
    nextArt.current = drawing
    if (artTimer.current !== undefined) return
    artTimer.current = window.setTimeout(async () => {
      await loadMapFonts()
      artTimer.current = undefined
      const d = nextArt.current
      const el = artRef.current
      if (!d || !el) return
      const t0 = performance.now()
      const art = renderClassic(d, W, H)
      if (import.meta.env.DEV) console.debug(`map drawn in ${Math.round(performance.now() - t0)} ms`)
      lastArt.current = { drawing: d, canvas: art }
      el.width = art.width
      el.height = art.height
      el.getContext('2d')!.drawImage(art, 0, 0)
    }, 40)
  }, [drawing, W, H])
  useEffect(
    () => () => {
      window.clearTimeout(artTimer.current)
      artTimer.current = undefined
    },
    [],
  )

  // Pieces linked to a page are pins on the map (so players see them by the usual rules). Their
  // outlines follow the pieces; a removed piece takes its pin with it, and Undo brings both back.
  const piecePins = useLiveQuery(() => db.pins.where({ mapId: map.id }).filter((p) => !!p.pieceId).toArray(), [map.id]) ?? []
  const removedPins = useRef(new Map<string, Pin>())
  const outlineOf = useCallback(
    (s: Extract<Shape, { kind: 'asset' }>): [number, number][] =>
      pieceOutline({ id: s.id, asset: s.asset, at: s.at, size: s.size, seed: s.seed, variant: s.variant, flip: !!s.flip, turn: s.turn }).map(([x, y]) => [
        Math.round((H - y) * 10) / 10,
        Math.round(x * 10) / 10,
      ]),
    [H],
  )
  const syncPiecePins = useCallback(
    async (d: Drawing) => {
      const pieces = new Map(d.shapes.filter((s): s is Extract<Shape, { kind: 'asset' }> => s.kind === 'asset').map((s) => [s.id, s]))
      const pins = await db.pins.where({ mapId: map.id }).filter((p) => !!p.pieceId).toArray()
      const live = new Set<string>()
      for (const pin of pins) {
        const s = pieces.get(pin.pieceId!)
        if (!s) {
          removedPins.current.set(pin.pieceId!, pin)
          await db.pins.delete(pin.id)
          continue
        }
        live.add(pin.pieceId!)
        const points = outlineOf(s)
        if (JSON.stringify(points) !== JSON.stringify(pin.points)) await db.pins.update(pin.id, { points })
      }
      for (const [id, pin] of removedPins.current) {
        const s = pieces.get(id)
        if (!s || live.has(id)) continue
        await db.pins.put({ ...pin, points: outlineOf(s) })
        removedPins.current.delete(id)
      }
    },
    [map.id, outlineOf],
  )

  // Autosave: the drawing is kept on the map, and the rendered picture replaces the map image.
  // A change still waiting to be saved is saved on the way out too (pressing Done straight away).
  const lastSaved = useRef(map.drawing)
  const unsaved = useRef<Drawing>(undefined)
  const save = useCallback(
    async (d: Drawing) => {
      await loadMapFonts()
      const art = lastArt.current?.drawing === d ? lastArt.current.canvas : renderClassic(d, W, H)
      const blob = await classicBlob(art)
      await db.transaction('rw', [db.maps, db.assets], async () => {
        await db.maps.update(map.id, { drawing: d })
        await db.assets.update(map.imageId, { blob, size: blob.size, mime: blob.type, updatedAt: Date.now() })
      })
      lastSaved.current = d
      await syncPiecePins(d)
    },
    [map.id, map.imageId, W, H, syncPiecePins],
  )
  useEffect(() => {
    if (drawing === lastSaved.current) return
    setSaved(false)
    unsaved.current = drawing
    const t = setTimeout(async () => {
      unsaved.current = undefined
      await save(drawing)
      setSaved(true)
    }, 800)
    return () => clearTimeout(t)
  }, [drawing, save])
  useEffect(
    () => () => {
      const d = unsaved.current
      unsaved.current = undefined
      if (d) void save(d).then(() => renderPlayerFog(map.id).catch(() => {}))
    },
    [save, map.id],
  )

  useEffect(() => {
    if (saved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saved])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select')
      if (e.code === 'Space' && !typing) spaceDown.current = true
      if (typing) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        removeShape(selectedId)
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && selectedId) {
        // R turns the selected piece a little clockwise, Shift+R the other way
        const s = drawing.shapes.find((x) => x.id === selectedId)
        if (s?.kind === 'asset' && canTurn(s.asset)) {
          const turn = ((((s.turn ?? 0) + (e.shiftKey ? -15 : 15)) % 360) + 360) % 360
          commit({ ...drawing, shapes: drawing.shapes.map((x) => (x.id === s.id ? { ...s, turn } : x)) })
        }
      } else if (e.key === 'Escape') {
        setSelectedId(undefined)
        setDraft([])
        setRoomDraft(undefined)
        gesture.current = undefined
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [undo, redo, removeShape, selectedId, drawing, commit])

  const toMap = (e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return [p.x, p.y]
  }
  // The view always matches the canvas's shape, so one screen pixel is the same distance both ways.
  const upp = view.w / canvas.w
  const unitsPerPixel = () => upp
  const fitView = useCallback(
    (cw: number, ch: number) => {
      const k = Math.max(W / cw, H / ch)
      setView({ x: (W - cw * k) / 2, y: (H - ch * k) / 2, w: cw * k, h: ch * k })
    },
    [W, H],
  )
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    let first = true
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (!width || !height) return
      setCanvas({ w: width, h: height })
      if (first) fitView(width, height)
      else setView((v) => ({ ...v, h: v.w * (height / width) }))
      first = false
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitView])
  const shapeAt = (target: EventTarget) => (target as Element).closest?.('[data-id]')?.getAttribute('data-id') ?? undefined
  const locked = (layer: LayerId) => !!drawing.locked?.includes(layer) || !!drawing.hidden?.includes(layer)

  /** The streets, rivers and town walls, as straight runs: what town buildings line up with and keep clear of. */
  const ways = useMemo(
    () =>
      city
        ? drawing.shapes.flatMap((s) =>
            s.kind === 'line' && (s.style === 'street' || s.style === 'townwall' || s.style === 'river')
              ? s.points.slice(1).map((b, i) => ({
                  a: s.points[i],
                  b,
                  half: s.style === 'street' ? streetWidth(s, drawing) / 2 : s.style === 'river' ? riverWidth(s, drawing) / 2 : townWallHalf(drawing),
                }))
              : [],
          )
        : [],
    [city, drawing],
  )
  /** The nearest point on any street or wall, how far off it is, and how wide that way is. */
  const nearestWay = (p: Point) => {
    let best: { at: Point; dist: number; half: number } | undefined
    for (const { a, b, half } of ways) {
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
      const at: Point = [a[0] + dx * t, a[1] + dy * t]
      const dist = Math.hypot(p[0] - at[0], p[1] - at[1]) - half
      if (!best || dist < best.dist) best = { at, dist, half }
    }
    return best
  }
  /** The turn that sets a building square to the nearest street, its front (the bottom as drawn) towards it, if one is near. */
  const facingStreet = (at: Point, size: number) => {
    const w = nearestWay(at)
    if (!w || w.dist > size * 1.5) return undefined
    const [vx, vy] = [w.at[0] - at[0], w.at[1] - at[1]]
    if (!vx && !vy) return undefined
    return Math.round(((((Math.atan2(-vx, vy) * 180) / Math.PI) % 360) + 360) % 360)
  }

  /** One of the pieces in the current choice, at its own starting size scaled like the chosen one. */
  const pickPiece = () => {
    const pool = [piece.asset, ...piece.mix]
    const asset = pool[Math.floor(Math.random() * pool.length)]
    const size = asset === piece.asset ? piece.size : Math.round((pieceSize(asset, W, H, drawing.gridSize) * piece.size) / pieceSize(piece.asset, W, H, drawing.gridSize))
    return { asset, size }
  }
  const makePiece = (at: Point, { asset, size } = pickPiece()): Shape => {
    // a version picked in the panel belongs to the chosen piece; mixed-in pieces are always a surprise
    const pinned = piece.variant !== 'random' && asset === piece.asset
    const variant = pinned ? (piece.variant as number) : Math.floor(Math.random() * 8)
    const turn = !canTurn(asset)
      ? 0
      : piece.turn === 'random'
        ? Math.floor(Math.random() * 360)
        : piece.turn === 'street'
          ? (facingStreet(at, size) ?? 90 * Math.floor(Math.random() * 4))
          : piece.turn
    return {
      id: newId(),
      kind: 'asset',
      asset,
      at,
      size,
      seed: pinned && Atlas.assets[asset]?.kind === 'recipe' ? versionSeed(variant) : randomSeed(),
      variant,
      ...(flips(asset) && Math.random() < 0.5 ? { flip: true } : {}),
      ...(turn ? { turn } : {}),
    }
  }

  /** Where the scatter brush may put each piece: trees ashore, boats on the water, and so on. */
  const scatterFits = (): ((asset: string, p: Point) => boolean) => {
    const isLand = landTest(drawing, W, H)
    const indoors = floorTest(drawing, W, H)
    const rule = (asset: string): ((p: Point) => boolean) => {
      const cat = Atlas.assets[asset]?.category ?? ''
      if (top) {
        if (asset === 'bm-bridge' || asset === 'ct-pier') return () => true
        const onWater = cat === 'bm-water' || ['bm-rowboat', 'ct-ship', 'ct-boats'].includes(asset)
        // town buildings keep off the streets and walls; underground, scattered things stay on the floor
        const clear = city && linesUp(asset) ? (p: Point) => (nearestWay(p)?.dist ?? Infinity) > pieceSize(asset, W, H, drawing.gridSize) * 0.4 : () => true
        return ([x, y]) => isLand(x, y) !== onWater && indoors(x, y) && clear([x, y])
      }
      const sea = cat === 'sea' && asset !== 'cloud'
      if (!sea && !ASHORE.includes(cat)) return () => true
      return ([x, y]) => isLand(x, y) !== sea
    }
    const rules = new Map<string, (p: Point) => boolean>()
    return (asset, p) => {
      let f = rules.get(asset)
      if (!f) rules.set(asset, (f = rule(asset)))
      return f(p)
    }
  }
  // Click and hold with Place: pieces keep landing under the brush, spaced so they don't pile up.
  const scatterTick = () => {
    const g = gesture.current
    if (g?.kind !== 'scatter' || (!g.moved && performance.now() - g.t0 < 300)) return
    const gap = THICKNESS[spray.thickness].gap
    const others = [...g.before.shapes, ...g.placed].filter((s): s is Extract<Shape, { kind: 'asset' }> => s.kind === 'asset')
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2
      const d = spray.spread * Math.sqrt(Math.random())
      const at: Point = [g.at[0] + Math.cos(a) * d, g.at[1] + Math.sin(a) * d]
      const pick = pickPiece()
      if (at[0] < 0 || at[1] < 0 || at[0] > W || at[1] > H || !g.fits(pick.asset, at)) continue
      const size = Math.round(pick.size * (0.82 + Math.random() * 0.36))
      // side-on pieces may sit closer one behind another than side by side
      const side = Atlas.assets[pick.asset]?.view === 'side'
      // town buildings may touch but not stand on one another
      const g2 = city && linesUp(pick.asset) ? Math.max(gap, 0.92) : gap
      const clear = others.every((o) => Math.hypot(o.at[0] - at[0], (o.at[1] - at[1]) * (side ? 1.8 : 1)) >= ((o.size + size) / 2) * g2)
      if (!clear) continue
      g.placed.push(makePiece(at, { asset: pick.asset, size }))
      setDrawing({ ...g.before, shapes: [...g.before.shapes, ...g.placed] })
      return
    }
  }
  const showRing = (p?: Point) => {
    const ring = ringRef.current
    if (!ring) return
    ring.style.display = p ? 'inline' : 'none'
    if (p) {
      ring.setAttribute('cx', String(p[0]))
      ring.setAttribute('cy', String(p[1]))
    }
  }
  const eraseAt = (g: { before: Drawing; ids: Set<string> }, id?: string) => {
    if (!id || g.ids.has(id)) return
    g.ids.add(id)
    setDrawing({ ...g.before, shapes: g.before.shapes.filter((s) => !g.ids.has(s.id)) })
  }

  const addLabel = (at: Point, curve?: Point[]) => {
    const text = labelText.trim() || prompt('Label text')?.trim()
    if (!text) return
    const id = newId()
    commit({
      ...drawing,
      shapes: [
        ...drawing.shapes,
        {
          id,
          kind: 'label',
          text,
          at,
          size: labelSize,
          color: '#3a2e1c',
          italic: labelFont === 'place',
          font: labelFont,
          ...(curve ? { curve } : {}),
        },
      ],
    })
    setLabelText('')
  }

  // Rooms snap to the squares: corners to where grid lines cross, passages along the middle of their squares.
  const gs = drawing.gridSize || 70
  const snapping = roomBrush.snap && drawing.grid === 'square'
  const corner = (p: Point): Point => (snapping ? [Math.round(p[0] / gs) * gs, Math.round(p[1] / gs) * gs] : p)
  const along = (p: Point, w: number): Point => {
    if (!snapping) return p
    const off = Math.round(w / gs) % 2 ? gs / 2 : 0
    return [Math.round((p[0] - off) / gs) * gs + off, Math.round((p[1] - off) / gs) * gs + off]
  }
  /** The room a drag makes, or nothing if it's too small to be one. */
  const roomOf = (pts: Point[]): RoomStroke | undefined => {
    const base = { id: newId(), mode: roomBrush.mode }
    const { shape } = roomBrush
    if (shape === 'rect' || shape === 'round') {
      const a = corner(pts[0])
      const b = corner(pts[pts.length - 1])
      if (Math.abs(b[0] - a[0]) < gs / 4 || Math.abs(b[1] - a[1]) < gs / 4) return undefined
      return { ...base, shape, points: [a, b] }
    }
    if (shape === 'cave') return { ...base, shape, points: simplify(pts, 0.12 * gs), size: roomBrush.cave }
    // passages: straightened, then snapped; repeated and in-line points dropped
    const w = roomBrush.width
    const snapped = simplify(pts, snapping ? 0.6 * gs : 0.15 * gs).map((p) => along(p, w))
    const path: Point[] = []
    for (const p of snapped) if (!path.length || Math.hypot(p[0] - path[path.length - 1][0], p[1] - path[path.length - 1][1]) > 1) path.push(p)
    for (let i = path.length - 2; i > 0; i--) {
      const [a, b, c] = [path[i - 1], path[i], path[i + 1]]
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
      const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])
      if (Math.abs(cross) < 1 && dot > 0) path.splice(i, 1)
    }
    return { ...base, shape, points: path, size: w }
  }
  /** A door sits on the nearest grid line that has a room wall on it, or failing that the nearest line. */
  const snapDoor = (p: Point, size: number): { at: Point; turn: number } => {
    if (drawing.grid !== 'square') return { at: p, turn: 0 }
    const off = Math.max(1, Math.round(size / gs)) % 2 ? gs / 2 : 0
    const across: { at: Point; turn: number } = { at: [Math.round((p[0] - off) / gs) * gs + off, Math.round(p[1] / gs) * gs], turn: 0 }
    const down: { at: Point; turn: number } = { at: [Math.round(p[0] / gs) * gs, Math.round((p[1] - off) / gs) * gs + off], turn: 90 }
    const inRoom = roomTest(drawing, W, H)
    if (inRoom) {
      const h = gs / 2
      const wallAcross = inRoom(across.at[0], across.at[1] - h) !== inRoom(across.at[0], across.at[1] + h)
      const wallDown = inRoom(down.at[0] - h, down.at[1]) !== inRoom(down.at[0] + h, down.at[1])
      if (wallAcross !== wallDown) return wallAcross ? across : down
    }
    return Math.abs(p[1] - across.at[1]) <= Math.abs(p[0] - down.at[0]) ? across : down
  }
  /**
   * A gatehouse or wall tower sits on the nearest town wall, if one is close: turned to run along it,
   * with its outer side facing out of the town.
   */
  const snapToWall = (p: Point): { at: Point; turn: number } | undefined => {
    let best: { at: Point; ang: number; dist: number; wall: Point[] } | undefined
    for (const s of drawing.shapes) {
      if (s.kind !== 'line' || s.style !== 'townwall') continue
      for (let i = 1; i < s.points.length; i++) {
        const [a, b] = [s.points[i - 1], s.points[i]]
        const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
        const len2 = dx * dx + dy * dy || 1
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
        const at: Point = [a[0] + dx * t, a[1] + dy * t]
        const dist = Math.hypot(p[0] - at[0], p[1] - at[1])
        if (!best || dist < best.dist) best = { at, ang: Math.atan2(dy, dx), dist, wall: s.points }
      }
    }
    if (!best || best.dist > Math.max(6 * townWallHalf(drawing), piece.size)) return undefined
    // outside is the side away from what the wall closes round (it's drawn clockwise if the area is positive)
    let area = 0
    best.wall.forEach((a, i) => {
      const b = best!.wall[(i + 1) % best!.wall.length]
      area += a[0] * b[1] - b[0] * a[1]
    })
    const turn = ((best.ang + (area > 0 ? 0 : Math.PI)) * 180) / Math.PI
    return { at: best.at, turn: Math.round(((turn % 360) + 360) % 360) }
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toMap(e)
    const hit = shapeAt(e.target)
    if (tool === 'hand' || e.button === 1 || spaceDown.current) {
      gesture.current = { kind: 'pan', client: [e.clientX, e.clientY], view }
    } else if (tool === 'line' || tool === 'land' || tool === 'coast' || tool === 'label') {
      if ((tool === 'land' || tool === 'coast') && locked('land')) return
      if (tool === 'line' && locked(lineStyle === 'river' ? 'rivers' : 'paths')) return
      if (tool === 'label' && locked('labels')) return
      gesture.current = { kind: 'draw', points: [p] }
      setDraft([p])
    } else if (tool === 'room') {
      if (locked('paths')) return
      gesture.current = { kind: 'room', points: [p] }
      setRoomDraft(roomOf([p, p]))
    } else if (tool === 'stamp') {
      if (locked('objects') || !Atlas.assets[piece.asset]) return
      const wall = city && WALL_PIECES.includes(piece.asset) && !piece.mix.length ? snapToWall(p) : undefined
      if (wall) {
        // a gatehouse or tower goes in one at a time, onto the town wall
        const { turn: _, ...rest } = makePiece(p, { asset: piece.asset, size: piece.size }) as Extract<Shape, { kind: 'asset' }>
        const turn = (wall.turn + (typeof piece.turn === 'number' ? piece.turn : 0)) % 360
        commit({ ...drawing, shapes: [...drawing.shapes, { ...rest, at: wall.at, ...(turn ? { turn } : {}) }] })
        return
      }
      if (battle && Atlas.assets[piece.asset].category === 'dg-doors' && !piece.mix.length) {
        // a door goes in one at a time, into the wall
        const door = makePiece(p, { asset: piece.asset, size: piece.size }) as Extract<Shape, { kind: 'asset' }>
        const snap = snapDoor(p, piece.size)
        let turn = (snap.turn + (typeof piece.turn === 'number' ? piece.turn : 0)) % 360
        // doors open into the room, never into solid rock
        const inRoom = roomTest(drawing, W, H)
        const a = (turn * Math.PI) / 180
        const [dx, dy] = [-Math.sin(a) * gs * 0.4, Math.cos(a) * gs * 0.4]
        if (inRoom && !inRoom(snap.at[0] + dx, snap.at[1] + dy) && inRoom(snap.at[0] - dx, snap.at[1] - dy)) turn = (turn + 180) % 360
        const { turn: _, ...rest } = door
        commit({ ...drawing, shapes: [...drawing.shapes, { ...rest, at: snap.at, ...(turn ? { turn } : {}) }] })
        return
      }
      const first = makePiece(p)
      gesture.current = { kind: 'scatter', before: drawing, placed: [first], start: p, at: p, t0: performance.now(), moved: false, fits: scatterFits() }
      setDrawing({ ...drawing, shapes: [...drawing.shapes, first] })
      window.clearInterval(scatterTimer.current)
      scatterTimer.current = window.setInterval(scatterTick, 45)
    } else if (tool === 'erase') {
      // drag across several things to erase them all in one go
      const g = { kind: 'erase' as const, before: drawing, ids: new Set<string>() }
      gesture.current = g
      eraseAt(g, hit)
    } else if (tool === 'select') {
      setSelectedId(hit)
      if (hit) gesture.current = { kind: 'move', id: hit, start: p, before: drawing }
      if (!hit) gesture.current = { kind: 'pan', client: [e.clientX, e.clientY], view }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (tool === 'stamp' && (!g || g.kind === 'scatter')) showRing(toMap(e))
    if (!g) return
    if (g.kind === 'erase') {
      eraseAt(g, shapeAt(document.elementFromPoint(e.clientX, e.clientY) ?? e.target))
      return
    }
    if (g.kind === 'scatter') {
      g.at = toMap(e)
      if (Math.hypot(g.at[0] - g.start[0], g.at[1] - g.start[1]) > 6 * unitsPerPixel()) g.moved = true
      return
    }
    if (g.kind === 'pan') {
      const k = g.view.w / canvas.w
      setView({ ...g.view, x: g.view.x - (e.clientX - g.client[0]) * k, y: g.view.y - (e.clientY - g.client[1]) * k })
      return
    }
    const p = toMap(e)
    if (g.kind === 'draw') {
      const last = g.points[g.points.length - 1]
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 3 * unitsPerPixel()) return
      g.points.push(p)
      setDraft([...g.points])
    } else if (g.kind === 'room') {
      const last = g.points[g.points.length - 1]
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 3 * unitsPerPixel()) return
      g.points.push(p)
      setRoomDraft(roomOf(roomBrush.shape === 'rect' || roomBrush.shape === 'round' ? [g.points[0], p] : g.points))
    } else if (g.kind === 'move') {
      const dx = p[0] - g.start[0]
      const dy = p[1] - g.start[1]
      const shift = ([x, y]: Point): Point => [x + dx, y + dy]
      setDrawing({
        ...g.before,
        shapes: g.before.shapes.map((s) => {
          if (s.id !== g.id) return s
          if (s.kind === 'area' || s.kind === 'line') return { ...s, points: s.points.map(shift) }
          if (s.kind === 'label' && s.curve) return { ...s, at: shift(s.at), curve: s.curve.map(shift) }
          return { ...s, at: shift(s.at) }
        }),
      })
    }
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = undefined
    window.clearInterval(scatterTimer.current)
    if (!g) return
    if (g.kind === 'scatter') {
      commit({ ...g.before, shapes: [...g.before.shapes, ...g.placed] }, g.before)
      return
    }
    if (g.kind === 'erase') {
      if (g.ids.size) {
        commit({ ...g.before, shapes: g.before.shapes.filter((s) => !g.ids.has(s.id)) }, g.before)
        if (selectedId && g.ids.has(selectedId)) setSelectedId(undefined)
      }
      return
    }
    if (g.kind === 'room') {
      setRoomDraft(undefined)
      const room = roomOf(roomBrush.shape === 'rect' || roomBrush.shape === 'round' ? [g.points[0], g.points[g.points.length - 1]] : g.points)
      if (room) commit({ ...drawing, rooms: [...(drawing.rooms ?? []), room] })
      return
    }
    if (g.kind === 'draw') {
      // walls are straight runs between corners, so a wobbly hand is evened out more
      const straight = tool === 'line' && STRAIGHT.includes(lineStyle)
      const pts = simplify(g.points, (straight ? 6 : 1.5) * unitsPerPixel())
      // a town wall that ends near where it began closes the loop
      if (straight && lineStyle === 'townwall' && pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < Math.max(4 * townWallHalf(drawing), 24 * unitsPerPixel()))
        pts[pts.length - 1] = pts[0]
      setDraft([])
      if (tool === 'land' && top) {
        const inside = groundBrush.inside && !!drawing.rooms?.length
        const stroke = { id: newId(), ground: groundBrush.ground, size: groundBrush.size, points: pts.length > 1 ? pts : [g.points[0]], ...(inside ? { inside } : {}) }
        commit({ ...drawing, ground: [...(drawing.ground ?? []), stroke] })
      } else if (tool === 'land' || tool === 'coast') {
        const stroke = { id: newId(), mode: brush.mode, size: brush.size, points: pts.length > 1 ? pts : [g.points[0]] }
        commit({ ...drawing, land: [...(drawing.land ?? []), stroke] })
      }
      if (tool === 'label') {
        let len = 0
        for (let i = 1; i < g.points.length; i++) len += Math.hypot(g.points[i][0] - g.points[i - 1][0], g.points[i][1] - g.points[i - 1][1])
        if (len < 12 * unitsPerPixel()) addLabel(g.points[0])
        else addLabel(g.points[Math.floor(g.points.length / 2)], simplify(g.points, 3 * unitsPerPixel()))
      }
      if (tool === 'line' && pts.length >= 2) {
        const way = wayOf(lineStyle, drawing)
        const extra = way ? { width: Math.round((lineOpts.ft[way] / 5) * gs) } : lineStyle === 'townwall' && lineOpts.towers ? { towers: lineOpts.towers } : {}
        commit({ ...drawing, shapes: [...drawing.shapes, { id: newId(), kind: 'line', style: lineStyle, points: pts, smooth: !STRAIGHT.includes(lineStyle), ...extra }] })
      }
    } else if (g.kind === 'move') {
      if (drawing !== g.before) commit(drawing, g.before)
    }
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const [mx, my] = toMap(e)
    const k = Math.exp(e.deltaY * 0.0015)
    const w = Math.min(W * 3, Math.max(W / 20, view.w * k))
    const ratio = w / view.w
    setView({ x: mx - (mx - view.x) * ratio, y: my - (my - view.y) * ratio, w, h: view.h * ratio })
  }

  const fit = () => fitView(canvas.w, canvas.h)
  const html = useMemo(() => classicHitSvg(drawing), [drawing])
  const selected = drawing.shapes.find((s) => s.id === selectedId)
  const draftPath = draft.length > 1 ? pathFor(draft, false, tool !== 'line' || !STRAIGHT.includes(lineStyle)) : ''
  const sc = canvas.w / view.w
  const toggleLayer = (key: 'hidden' | 'locked', id: LayerId) => {
    const list = drawing[key] ?? []
    commit({ ...drawing, [key]: list.includes(id) ? list.filter((l) => l !== id) : [...list, id] })
  }
  const selectionStyle = selectedId
    ? `[data-id="${selectedId}"] { stroke: #ffd36b; stroke-opacity: .5; } rect[data-id="${selectedId}"] { stroke-opacity: 1; stroke-width: ${2 * upp}; stroke-dasharray: ${6 * upp} ${4 * upp}; fill: rgba(255,211,107,.08); }`
    : ''

  return (
    <div className="map-page builder">
      <div className="map-toolbar">
        <Link to={`${worldPath(worldId)}/maps/${map.id}`}>← Done</Link>
        <strong>{map.name}</strong>
        <span className="muted small">{saved ? 'Saved' : 'Saving…'}</span>
        <div className="row">
          <button onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">
            ↷ Redo
          </button>
          <button onClick={fit}>⤢ Fit</button>
        </div>
      </div>
      <div className="map-body">
        <div className="builder-tools">
          {TOOLS.map((t) => (
            <button key={t.id} className={tool === t.id ? 'on' : ''} title={t.hint} onClick={() => setTool(t.id)}>
              <span className="tool-icon">{t.icon}</span>
              <span className="tool-label">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="builder-stage">
          <canvas
            ref={artRef}
            className="builder-art"
            aria-hidden
            style={{ width: W * sc, height: H * sc, transform: `translate(${-view.x * sc}px, ${-view.y * sc}px)` }}
          />
          <svg
            ref={svgRef}
            className={`builder-canvas tool-${tool}`}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            preserveAspectRatio="none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => showRing()}
            onWheel={onWheel}
          >
            <g dangerouslySetInnerHTML={{ __html: html }} />
            {selectionStyle && <style>{selectionStyle}</style>}
            <rect width={W} height={H} fill="none" stroke="#000" strokeOpacity={0.4} strokeWidth={2 * upp} pointerEvents="none" />
            {tool === 'stamp' && (
              <circle ref={ringRef} className="scatter-ring" r={spray.spread} fill="none" stroke="#e0b354" strokeOpacity={0.7} strokeWidth={1.5 * upp} strokeDasharray={`${5 * upp} ${4 * upp}`} pointerEvents="none" />
            )}
            {roomDraft && <RoomPreview room={roomDraft} upp={upp} />}
            {draftPath &&
              (tool === 'coast' ? (
                <path
                  d={draftPath}
                  fill="none"
                  stroke={brush.mode === 'water' ? 'rgba(80,140,190,.45)' : 'rgba(224,179,84,.45)'}
                  strokeWidth={brush.size}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ) : tool === 'line' && wayOf(lineStyle, drawing) ? (
                <path d={draftPath} fill="none" stroke={lineStyle === 'river' ? '#6fa3c4' : '#e0b354'} strokeOpacity={0.45} strokeWidth={(lineOpts.ft[wayOf(lineStyle, drawing)!] / 5) * gs} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
              ) : tool === 'land' ? (
                <path
                  d={draftPath}
                  fill="none"
                  stroke={top ? groundColour(groundBrush.ground, Atlas.BIOMES[drawing.biome ?? 'temperate']) : brush.mode === 'water' ? 'rgba(80,140,190,.45)' : 'rgba(224,179,84,.45)'}
                  strokeOpacity={top ? 0.6 : undefined}
                  strokeWidth={top ? groundBrush.size : brush.size}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ) : (
                <path
                  d={draftPath}
                  fill="none"
                  stroke="#e0b354"
                  strokeWidth={2 * upp}
                  strokeDasharray={`${6 * upp} ${4 * upp}`}
                  pointerEvents="none"
                />
              ))}
          </svg>
        </div>
        <aside className="map-panel builder-panel">
          <div className="small muted">
            Map builder <Help topic="mapBuilder" />
          </div>
          {selected ? (
            <ShapeProps
              shape={selected}
              drawing={drawing}
              pin={piecePins.find((p) => p.pieceId === selected.id)}
              onLink={(entity) => {
                if (selected.kind !== 'asset') return
                void db.pins.add({
                  id: newId(),
                  worldId,
                  mapId: map.id,
                  label: entity.name,
                  kind: 'region',
                  points: outlineOf(selected),
                  color: '#e0b354',
                  visibility: 'gm',
                  entityId: entity.id,
                  note: '',
                  pieceId: selected.id,
                })
              }}
              onChange={(patch) => updateShape(selected.id, patch)}
              onDelete={() => removeShape(selected.id)}
              onClose={() => setSelectedId(undefined)}
            />
          ) : (
            <ToolOptions
              tool={tool}
              tools={TOOLS}
              drawing={drawing}
              W={W}
              H={H}
              {...{ lineStyle, setLineStyle, lineOpts, setLineOpts, labelText, setLabelText, labelSize, setLabelSize }}
              {...{ brush, setBrush, piece, setPiece, recent, spray, setSpray, labelFont, setLabelFont, groundBrush, setGroundBrush, roomBrush, setRoomBrush }}
              setOutside={(outside) => commit({ ...drawing, outside })}
            />
          )}
          <section className="map-layers">
            <h3>
              Layers <Help topic="mapLayers" />
            </h3>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Show</th>
                  <th>Lock</th>
                </tr>
              </thead>
              <tbody>
                {(battle
                  ? LAYERS.filter((l) => l.id !== 'rivers').map((l) => ({ ...l, label: l.id === 'land' ? 'Ground & water' : l.id === 'paths' ? 'Rooms, walls & fences' : l.label }))
                  : city
                    ? LAYERS.map((l) => ({ ...l, label: l.id === 'land' ? 'Ground, coast & water' : l.id === 'paths' ? 'Streets, walls & fences' : l.label }))
                    : LAYERS
                ).map((l) => (
                  <tr key={l.id}>
                    <td>{l.label}</td>
                    <td>
                      <input type="checkbox" aria-label={`Show ${l.label}`} checked={!drawing.hidden?.includes(l.id)} onChange={() => toggleLayer('hidden', l.id)} />
                    </td>
                    <td>
                      <input type="checkbox" aria-label={`Lock ${l.label}`} checked={!!drawing.locked?.includes(l.id)} onChange={() => toggleLayer('locked', l.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <details className="map-settings" open>
            <summary>Map settings</summary>
            <div className="form">
              <label>
                <span>
                  Kind of map <Help topic="mapScene" />
                </span>
                <select
                  value={drawing.scene ?? 'world'}
                  onChange={(e) => {
                    const scene = e.target.value as Scene
                    commit(
                      scene === 'battle'
                        ? { groundBase: 'grass', ...drawing, scene, grid: 'square', gridSize: 70, frame: false }
                        : scene === 'city'
                          ? { groundBase: 'grass', ...drawing, scene, grid: 'none', gridSize: CITY_GRID, frame: true }
                          : { ...drawing, scene, gridSize: drawing.scene === 'city' ? 70 : drawing.gridSize },
                    )
                    setTool('land')
                    setLineStyle(scene === 'battle' ? 'fence' : scene === 'city' ? 'street' : 'river')
                    setPiece(choose(firstPiece({ ...drawing, scene }), W, H, { scene, gridSize: scene === 'battle' ? 70 : scene === 'city' ? CITY_GRID : drawing.gridSize }))
                  }}
                >
                  <option value="world">World or region (seen from the side)</option>
                  <option value="city">Town or city (seen from above)</option>
                  <option value="battle">Battle map, dungeon or building (5 ft squares)</option>
                </select>
              </label>
              <label>
                Look
                <select value={drawing.look ?? 'parchment'} onChange={(e) => commit({ ...drawing, look: e.target.value as Look })}>
                  {Object.entries(LOOKS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Biome (tints the coloured look)
                <select value={drawing.biome ?? 'temperate'} onChange={(e) => commit({ ...drawing, biome: e.target.value as Biome })}>
                  {Object.entries(Atlas.BIOMES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              {top && (
                <label>
                  Ground to start on
                  <select value={drawing.groundBase ?? 'grass'} onChange={(e) => commit({ ...drawing, groundBase: e.target.value as GroundId })}>
                    {groundsFor(city).map((g) => (
                      <option key={g} value={g}>
                        {GROUNDS[g]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!battle && (
                <label>
                  Start from
                  <select value={drawing.background === 'sea' ? 'sea' : 'land'} onChange={(e) => commit({ ...drawing, background: e.target.value === 'sea' ? 'sea' : 'parchment' })}>
                    <option value="sea">Open sea (paint the land)</option>
                    <option value="land">All land (carve out the water)</option>
                  </select>
                </label>
              )}
              <label className="check">
                <input type="checkbox" checked={drawing.shadows !== false} onChange={(e) => commit({ ...drawing, shadows: e.target.checked })} /> {top ? 'Shadows under pieces' : 'Shading under pieces'}
              </label>
              <label className="check">
                <input type="checkbox" checked={drawing.frame !== false} onChange={(e) => commit({ ...drawing, frame: e.target.checked })} /> Border around the map
              </label>
              <button type="button" onClick={() => commit({ ...drawing, seed: 1 + Math.floor(Math.random() * 99999) })}>
                {battle ? 'Redraw the uneven edges' : "Redraw the coastline's wiggles"}
              </button>
              {!city && (
                <label>
                  Grid
                  <select value={drawing.grid} onChange={(e) => commit({ ...drawing, grid: e.target.value as Drawing['grid'] })}>
                    <option value="none">None</option>
                    <option value="square">Squares</option>
                    <option value="hex">Hexes</option>
                  </select>
                </label>
              )}
              {!city && drawing.grid !== 'none' && (
                <label>
                  Grid size: {drawing.gridSize}px
                  <input
                    type="range"
                    min={20}
                    max={200}
                    step={5}
                    value={drawing.gridSize}
                    onChange={(e) => commit({ ...drawing, gridSize: Number(e.target.value) })}
                  />
                </label>
              )}
              <p className="muted small">
                {W} × {H} px{city ? `, about ${Math.round((W / drawing.gridSize) * 5)} × ${Math.round((H / drawing.gridSize) * 5)} ft` : ''}. Pins and regions are added on the map itself, after you press Done.
              </p>
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}

function ToolOptions(p: {
  tool: Tool
  tools: ToolDef[]
  drawing: Drawing
  W: number
  H: number
  lineStyle: LineStyle
  setLineStyle: (s: LineStyle) => void
  lineOpts: LineOpts
  setLineOpts: (o: LineOpts) => void
  labelText: string
  setLabelText: (s: string) => void
  labelSize: number
  setLabelSize: (n: number) => void
  brush: { mode: 'land' | 'water'; size: number }
  setBrush: (b: { mode: 'land' | 'water'; size: number }) => void
  piece: PieceChoice
  setPiece: (b: PieceChoice) => void
  recent: string[]
  spray: { spread: number; thickness: number }
  setSpray: (s: { spread: number; thickness: number }) => void
  labelFont: LabelFont
  setLabelFont: (f: LabelFont) => void
  groundBrush: GroundBrush
  setGroundBrush: (b: GroundBrush) => void
  roomBrush: RoomBrush
  setRoomBrush: (b: RoomBrush) => void
  setOutside: (o: 'rock' | 'ground') => void
}) {
  const battle = p.drawing.scene === 'battle'
  const city = p.drawing.scene === 'city'
  const top = fromAbove(p.drawing)
  const tint = Atlas.BIOMES[p.drawing.biome ?? 'temperate']
  const grid = p.drawing.gridSize || 70
  const step = groundStep(p.drawing)
  const def = p.tools.find((t) => t.id === p.tool)
  const big = Math.max(p.W, p.H)
  // floors are for rooms; a town's ground is the open ground
  const grounds = groundsFor(city)
  const lines = battle ? BATTLE_LINES : city ? CITY_LINES : WORLD_LINES
  const way = wayOf(p.lineStyle, p.drawing)
  return (
    <div className="form">
      <h2>
        {def?.label}
        {p.tool === 'land' && <Help topic={top ? 'groundBrush' : 'landBrush'} />}
        {p.tool === 'coast' && <Help topic="coastBrush" />}
        {p.tool === 'room' && <Help topic="rooms" />}
        {p.tool === 'line' && city && <Help topic="cityLines" />}
        {p.tool === 'stamp' && <Help topic="mapPieces" />}
        {p.tool === 'label' && <Help topic="curvedLabels" />}
      </h2>
      <p className="muted small">{def?.hint}. Hold Space and drag to pan from any tool.</p>
      {p.tool === 'land' && top && (
        <>
          <div className="swatch-grid">
            {grounds.map((g) => (
              <button key={g} className={p.groundBrush.ground === g ? 'on' : ''} onClick={() => p.setGroundBrush({ ...p.groundBrush, ground: g, inside: FLOORS.includes(g) })}>
                <span className="chip" style={{ width: 16, height: 16, background: groundColour(g, tint) }} /> {GROUNDS[g]}
              </button>
            ))}
          </div>
          <label>
            Brush size: {p.groundBrush.size}px ({Math.round((p.groundBrush.size / grid) * 5)} ft)
            <input type="range" min={Math.round(step / 4)} max={step * 8} value={p.groundBrush.size} onChange={(e) => p.setGroundBrush({ ...p.groundBrush, size: Number(e.target.value) })} />
          </label>
          {!!p.drawing.rooms?.length && (
            <label className="check">
              <input type="checkbox" checked={p.groundBrush.inside} onChange={(e) => p.setGroundBrush({ ...p.groundBrush, inside: e.target.checked })} /> Keep inside the rooms
            </label>
          )}
        </>
      )}
      {p.tool === 'room' && (
        <>
          <div className="swatch-grid">
            {ROOM_SHAPES.map((r) => (
              <button key={r.id} className={p.roomBrush.shape === r.id ? 'on' : ''} title={r.hint} onClick={() => p.setRoomBrush({ ...p.roomBrush, shape: r.id })}>
                <span aria-hidden>{r.icon}</span> {r.label}
              </button>
            ))}
          </div>
          <div className="row">
            <button className={p.roomBrush.mode === 'dig' ? 'primary' : ''} onClick={() => p.setRoomBrush({ ...p.roomBrush, mode: 'dig' })}>
              Dig out
            </button>
            <button className={p.roomBrush.mode === 'fill' ? 'primary' : ''} onClick={() => p.setRoomBrush({ ...p.roomBrush, mode: 'fill' })}>
              Fill in
            </button>
          </div>
          {p.roomBrush.shape === 'corridor' && (
            <label>
              Passage width
              <select value={p.roomBrush.width} onChange={(e) => p.setRoomBrush({ ...p.roomBrush, width: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n * grid}>
                    {n * 5} ft
                  </option>
                ))}
              </select>
            </label>
          )}
          {p.roomBrush.shape === 'cave' && (
            <label>
              Brush size: {Math.round((p.roomBrush.cave / grid) * 5)} ft
              <input type="range" min={grid} max={grid * 8} step={grid / 2} value={p.roomBrush.cave} onChange={(e) => p.setRoomBrush({ ...p.roomBrush, cave: Number(e.target.value) })} />
            </label>
          )}
          {p.drawing.grid === 'square' && p.roomBrush.shape !== 'cave' && (
            <label className="check">
              <input type="checkbox" checked={p.roomBrush.snap} onChange={(e) => p.setRoomBrush({ ...p.roomBrush, snap: e.target.checked })} /> Snap to the squares
            </label>
          )}
          <label>
            <span>
              Outside the rooms <Help topic="roomOutside" />
            </span>
            <select value={p.drawing.outside ?? 'ground'} onChange={(e) => p.setOutside(e.target.value as 'rock' | 'ground')}>
              <option value="rock">Solid rock (a dungeon)</option>
              <option value="ground">The ground (buildings, ruins)</option>
            </select>
          </label>
          <p className="muted small">Doors are in the Place tool: click a wall or a passage's end and the door fits itself to the grid line.</p>
        </>
      )}
      {(p.tool === 'coast' || (p.tool === 'land' && !top)) && (
        <>
          <div className="row">
            <button className={p.brush.mode === 'land' ? 'primary' : ''} onClick={() => p.setBrush({ ...p.brush, mode: 'land' })}>
              Land
            </button>
            <button className={p.brush.mode === 'water' ? 'primary' : ''} onClick={() => p.setBrush({ ...p.brush, mode: 'water' })}>
              {city ? 'Sea' : 'Water'}
            </button>
          </div>
          <label>
            Brush size: {p.brush.size}px
            <input type="range" min={Math.round(big / 200)} max={Math.round(big / 4)} value={p.brush.size} onChange={(e) => p.setBrush({ ...p.brush, size: Number(e.target.value) })} />
          </label>
        </>
      )}
      {p.tool === 'line' && (
        <>
          <div className="swatch-grid">
            {lines.map((s) => (
              <button key={s} className={p.lineStyle === s ? 'on' : ''} onClick={() => p.setLineStyle(s)}>
                <svg width="34" height="12" aria-hidden>
                  <path d="M2 6 H32" stroke={LINE_STYLES[s].color} strokeWidth={Math.min(6, LINE_STYLES[s].width)} strokeDasharray={LINE_STYLES[s].dash ? '6 4' : undefined} />
                </svg>
                {top && s === 'wall' ? 'Stone wall' : LINE_STYLES[s].label}
              </button>
            ))}
          </div>
          {way && (
            <label>
              {way === 'street' ? 'Street' : 'River'} width
              <select value={p.lineOpts.ft[way]} onChange={(e) => p.setLineOpts({ ...p.lineOpts, ft: { ...p.lineOpts.ft, [way]: Number(e.target.value) } })}>
                {LINE_FT[way].map((ft) => (
                  <option key={ft} value={ft}>
                    {ft} ft{FT_NOTE[`${way} ${ft}`] ?? ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {p.lineStyle === 'townwall' && <TowerPicker drawing={p.drawing} value={p.lineOpts.towers} onPick={(towers) => p.setLineOpts({ ...p.lineOpts, towers })} />}
        </>
      )}
      {p.tool === 'stamp' && (
        <>
          <PiecePicker drawing={p.drawing} W={p.W} H={p.H} piece={p.piece} setPiece={p.setPiece} recent={p.recent} />
          {city && WALL_PIECES.includes(p.piece.asset) && <p className="muted small">Click on a town wall and it fits itself into the wall, facing out of town.</p>}
          <h3>
            Scatter brush <Help topic="scatterBrush" />
          </h3>
          <label>
            Brush spread: {p.spray.spread}px
            <input type="range" min={Math.round(big / 100)} max={Math.round(big / 5)} value={p.spray.spread} onChange={(e) => p.setSpray({ ...p.spray, spread: Number(e.target.value) })} />
          </label>
          <label>
            How thick: {THICKNESS[p.spray.thickness].label}
            <input type="range" min={0} max={THICKNESS.length - 1} value={p.spray.thickness} onChange={(e) => p.setSpray({ ...p.spray, thickness: Number(e.target.value) })} />
          </label>
        </>
      )}
      {p.tool === 'label' && (
        <>
          <label>
            Text
            <input value={p.labelText} onChange={(e) => p.setLabelText(e.target.value)} placeholder="Type, then click or drag on the map" />
          </label>
          <label>
            Lettering
            <select value={p.labelFont} onChange={(e) => p.setLabelFont(e.target.value as LabelFont)}>
              {(Object.keys(FONTS) as LabelFont[]).map((f) => (
                <option key={f} value={f}>
                  {FONTS[f].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Size: {p.labelSize}px
            <input type="range" min={12} max={160} value={p.labelSize} onChange={(e) => p.setLabelSize(Number(e.target.value))} />
          </label>
        </>
      )}
    </div>
  )
}

/** The towers a town wall gets at its corners: one of the wall tower's versions, or none. */
function TowerPicker({ drawing, value, onPick }: { drawing: Drawing; value: number; onPick: (v: number) => void }) {
  if (!Atlas.assets['ct-wall-tower']) return null
  return (
    <div className="label">
      <span>Towers at the corners: {value < 0 ? 'none' : `version ${value + 1}`}</span>
      <div className="version-grid" role="radiogroup" aria-label="Towers">
        <button type="button" role="radio" aria-checked={value < 0} className={value < 0 ? 'on' : ''} title="No towers" onClick={() => onPick(-1)}>
          <span className="version-any" aria-hidden>
            ∅
          </span>
          <span>None</span>
        </button>
        {Array.from({ length: 8 }, (_, i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} className={value === i ? 'on' : ''} title={`Version ${i + 1}`} onClick={() => onPick(i)}>
            <PieceThumb asset="ct-wall-tower" look={drawing.look} biome={drawing.biome} variant={i} px={40} />
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Turning a piece when it's placed: at random, as drawn, or a set angle. */
const TURNS: Turn[] = ['random', 0, 45, 90, 135, 180, 225, 270, 315]

/**
 * The library: search it, or browse it by group, with a little drawing of each piece in the map's
 * own look. With "Mix several pieces" on, clicking pieces adds them to the brush or takes them out.
 */
function PiecePicker({ drawing, W, H, piece, setPiece, recent }: { drawing: Drawing; W: number; H: number; piece: PieceChoice; setPiece: (b: PieceChoice) => void; recent: string[] }) {
  const def = Atlas.assets[piece.asset]
  const big = Math.max(W, H)
  const battle = drawing.scene === 'battle'
  const city = drawing.scene === 'city'
  const dungeon = (g: { categories: string[] }) => g.categories.some((c) => c.startsWith('dg-'))
  // underground, the dungeon pieces come first; towns have their own, then the battle-map pieces drawn small
  const groups = city ? CITY_GROUPS : !battle ? ASSET_GROUPS : drawing.outside === 'rock' ? [...BATTLE_GROUPS.filter(dungeon), ...BATTLE_GROUPS.filter((g) => !dungeon(g))] : BATTLE_GROUPS
  const [query, setQuery] = useState('')
  const [mixing, setMixing] = useState(piece.mix.length > 0)
  const pool = [piece.asset, ...piece.mix]
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
  const matches = words.length
    ? groups.flatMap((g) =>
        assetNamesIn(g.categories).filter((n) => {
          const hay = `${Atlas.assets[n].label} ${n.replace(/^(bm|dg|ct)-/, '').replace(/-/g, ' ')} ${KEYWORDS[n] ?? ''} ${g.label}`.toLowerCase()
          return words.every((w) => hay.includes(w))
        }),
      )
    : []
  const pick = (n: string) => {
    if (!mixing) return setPiece(choose(n, W, H, drawing))
    if (n === piece.asset) {
      // taking out the main piece hands its place to the next one in the mix
      if (piece.mix.length) setPiece({ ...choose(piece.mix[0], W, H, drawing), turn: piece.turn, mix: piece.mix.slice(1) })
    } else setPiece({ ...piece, variant: 'random', mix: piece.mix.includes(n) ? piece.mix.filter((m) => m !== n) : [...piece.mix, n] })
  }
  const grid = (names: string[]) => (
    <div className="stamp-grid">
      {names.map((n) => (
        <button key={n} className={pool.includes(n) ? 'on' : ''} title={Atlas.assets[n].label} aria-pressed={pool.includes(n)} onClick={() => pick(n)}>
          <PieceThumb asset={n} look={drawing.look} biome={drawing.biome} />
          <span>{Atlas.assets[n].label}</span>
        </button>
      ))}
    </div>
  )
  const shown = recent.filter((n) => Atlas.assets[n] && groups.some((g) => g.categories.includes(Atlas.assets[n].category)))
  return (
    <>
      <input type="search" className="piece-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={battle ? 'Find a piece: tree, door, altar…' : city ? 'Find a piece: houses, castle, ship…' : 'Find a piece: mountain, ship, town…'} aria-label="Find a piece" />
      {words.length ? (
        matches.length ? (
          grid(matches)
        ) : (
          <p className="muted small">Nothing called that. Try another word, or clear the search to browse.</p>
        )
      ) : (
        <>
          {shown.length > 1 && (
            <div className="label">
              <span>Recently used</span>
              {grid(shown)}
            </div>
          )}
          {groups.filter((g) => assetNamesIn(g.categories).length).map((g) => (
            <details key={g.label} className="piece-group" open={g.categories.includes(def?.category ?? '') || undefined}>
              <summary>{g.label}</summary>
              {grid(assetNamesIn(g.categories))}
            </details>
          ))}
        </>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={mixing}
          onChange={(e) => {
            setMixing(e.target.checked)
            if (!e.target.checked && piece.mix.length) setPiece({ ...piece, mix: [] })
          }}
        />{' '}
        Mix several pieces <Help topic="pieceMix" />
      </label>
      {mixing && (
        <p className="muted small">
          {pool.length > 1 ? `Mixing ${pool.map((n) => Atlas.assets[n]?.label ?? n).join(', ')}.` : `${def?.label ?? 'This piece'} so far.`} Click pieces above to add them or take them out; each
          click or scatter picks one at random.
        </p>
      )}
      <label>
        Size: {piece.size}px{pool.length > 1 ? ' (the others scale with it)' : ''}
        <input type="range" min={Math.max(4, Math.round(big / 300))} max={Math.round(big / 3)} value={piece.size} onChange={(e) => setPiece({ ...piece, size: Number(e.target.value) })} />
      </label>
      {pool.some(canTurn) && (
        <label>
          <span>
            Turn <Help topic="pieceTurn" />
          </span>
          <select value={String(piece.turn)} onChange={(e) => setPiece({ ...piece, turn: e.target.value === 'random' || e.target.value === 'street' ? e.target.value : Number(e.target.value) })}>
            {(drawing.scene === 'city' ? (['street', ...TURNS] as Turn[]) : TURNS).map((t) => (
              <option key={t} value={String(t)}>
                {t === 'street' ? 'Square to the nearest street' : t === 'random' ? 'Each one at random' : t === 0 ? 'As drawn' : `${t}°`}
              </option>
            ))}
          </select>
        </label>
      )}
      {def && pool.length === 1 && (
        <div className="label">
          <span>Version: {piece.variant === 'random' ? 'a different one each time' : piece.variant + 1}</span>
          <VersionPicker asset={piece.asset} drawing={drawing} value={piece.variant} any onPick={(v) => setPiece({ ...piece, variant: v })} />
        </div>
      )}
    </>
  )
}

/** The 8 versions of a piece, drawn small so you can see each before choosing; "Any" mixes them. */
function VersionPicker({ asset, drawing, value, any, onPick }: { asset: string; drawing: Drawing; value?: number | 'random'; any?: boolean; onPick: (v: number | 'random') => void }) {
  const recipe = Atlas.assets[asset]?.kind === 'recipe'
  return (
    <div className="version-grid" role="radiogroup" aria-label="Version">
      {any && (
        <button type="button" role="radio" aria-checked={value === 'random'} className={value === 'random' ? 'on' : ''} title="A different one each time" onClick={() => onPick('random')}>
          <span className="version-any" aria-hidden>
            🎲
          </span>
          <span>Any</span>
        </button>
      )}
      {Array.from({ length: 8 }, (_, i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} className={value === i ? 'on' : ''} title={`Version ${i + 1}`} onClick={() => onPick(i)}>
          <PieceThumb asset={asset} look={drawing.look} biome={drawing.biome} variant={i} seed={recipe ? versionSeed(i) : 7} px={40} />
          <span>{i + 1}</span>
        </button>
      ))}
    </div>
  )
}

function PieceThumb({ asset, look, biome, variant = 0, seed = 7, px = 48 }: { asset: string; look?: Look; biome?: Biome; variant?: number; seed?: number; px?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = px * dpr
    c.height = px * dpr
    const ctx = c.getContext('2d')!
    ctx.scale((dpr * px) / 48, (dpr * px) / 48)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const st = styleFor({ background: 'sea', grid: 'none', gridSize: 70, shapes: [], look, biome }, 1400, 1400)
    if (st.mode === 'colour') st.paper = st.tint.land
    ctx.fillStyle = st.paper
    ctx.fillRect(0, 0, 48, 48)
    const def = Atlas.assets[asset]
    const side = def?.view === 'side'
    const wide = asset === 'cartouche' || asset === 'scale-bar' || def?.category === 'settlements' || def?.category === 'landmarks'
    drawPiece(ctx, { id: asset, asset, at: [24, side ? 42 : 24], size: side ? (wide ? 26 : 34) : 40, seed, variant, flip: false }, st)
  }, [asset, look, biome, variant, seed, px])
  return <canvas ref={ref} style={{ width: px, height: px, borderRadius: 4 }} aria-hidden />
}

function ShapeProps({ shape, drawing, pin, onLink, onChange, onDelete, onClose }: {
  shape: Shape
  drawing: Drawing
  /** The pin a linked piece works as, if it's linked to a page. */
  pin?: Pin
  onLink: (entity: Entity) => void
  onChange: (p: Partial<Shape>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const title =
    shape.kind === 'area' ? 'Area' : shape.kind === 'line' ? 'Line' : shape.kind === 'stamp' ? STAMPS[shape.stamp] : shape.kind === 'asset' ? (Atlas.assets[shape.asset]?.label ?? 'Piece') : 'Label'
  const way = shape.kind === 'line' ? wayOf(shape.style, drawing) : undefined
  const wayFt = shape.kind === 'line' && way ? Math.round(((way === 'street' ? streetWidth : riverWidth)(shape, drawing) / (drawing.gridSize || 70)) * 5) : 0
  return (
    <div className="form">
      <header>
        <h2>{title}</h2>
        <button className="ghost" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {shape.kind === 'area' && (
        <>
          <label>
            Terrain
            <select value={shape.terrain} onChange={(e) => onChange({ terrain: e.target.value as Terrain })}>
              {Object.entries(TERRAINS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={shape.smooth} onChange={(e) => onChange({ smooth: e.target.checked })} /> Smooth edges
          </label>
        </>
      )}
      {shape.kind === 'line' && (
        <>
          <label>
            Style
            <select value={shape.style} onChange={(e) => onChange({ style: e.target.value as LineStyle, smooth: !STRAIGHT.includes(e.target.value as LineStyle) })}>
              {[...new Set([...(drawing.scene === 'battle' ? BATTLE_LINES : drawing.scene === 'city' ? CITY_LINES : WORLD_LINES), shape.style])].map((k) => (
                <option key={k} value={k}>
                  {LINE_STYLES[k].label}
                </option>
              ))}
            </select>
          </label>
          {way && (
            <label>
              {way === 'street' ? 'Street' : 'River'} width
              <select value={wayFt} onChange={(e) => onChange({ width: Math.round((Number(e.target.value) / 5) * (drawing.gridSize || 70)) })}>
                {[...new Set([...LINE_FT[way], wayFt])].sort((a, b) => a - b).map((ft) => (
                  <option key={ft} value={ft}>
                    {ft} ft
                  </option>
                ))}
              </select>
            </label>
          )}
          {shape.style === 'townwall' && <TowerPicker drawing={drawing} value={shape.towers ?? 0} onPick={(towers) => onChange({ towers })} />}
        </>
      )}
      {shape.kind === 'stamp' && (
        <>
          <label>
            Symbol
            <select value={shape.stamp} onChange={(e) => onChange({ stamp: e.target.value as StampKind })}>
              {Object.entries(STAMPS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Size: {shape.size}px
            <input type="range" min={20} max={300} value={shape.size} onChange={(e) => onChange({ size: Number(e.target.value) })} />
          </label>
        </>
      )}
      {shape.kind === 'asset' && (
        <>
          <label>
            Size: {shape.size}px
            <input type="range" min={4} max={Math.max(400, shape.size)} value={shape.size} onChange={(e) => onChange({ size: Number(e.target.value) })} />
          </label>
          <div className="label">
            <span>Version</span>
            <VersionPicker
              asset={shape.asset}
              drawing={drawing}
              value={Atlas.assets[shape.asset]?.kind === 'recipe' ? Array.from({ length: 8 }, (_, i) => i).find((i) => versionSeed(i) === shape.seed) : shape.variant}
              onPick={(v) => v !== 'random' && onChange(Atlas.assets[shape.asset]?.kind === 'recipe' ? { variant: v, seed: versionSeed(v) } : { variant: v })}
            />
          </div>
          {Atlas.assets[shape.asset]?.kind === 'recipe' && (
            <button type="button" onClick={() => onChange({ seed: randomSeed() })}>
              Draw it differently
            </button>
          )}
          <label className="check">
            <input type="checkbox" checked={!!shape.flip} onChange={(e) => onChange({ flip: e.target.checked })} /> Mirror it
          </label>
          {canTurn(shape.asset) && (
            <label>
              <span>
                Turn: {shape.turn ?? 0}° <Help topic="pieceTurn" />
              </span>
              <div className="row">
                <input type="range" min={0} max={355} step={5} value={shape.turn ?? 0} onChange={(e) => onChange({ turn: Number(e.target.value) })} />
                <button type="button" title="Turn a quarter clockwise" onClick={() => onChange({ turn: ((shape.turn ?? 0) + 90) % 360 })}>
                  ↻ 90°
                </button>
              </div>
            </label>
          )}
          <PieceLink shape={shape} pin={pin} onLink={onLink} />
        </>
      )}
      {shape.kind === 'label' && (
        <>
          <label>
            Text
            <input value={shape.text} onChange={(e) => onChange({ text: e.target.value })} />
          </label>
          <label>
            Size: {shape.size}px
            <input type="range" min={12} max={160} value={shape.size} onChange={(e) => onChange({ size: Number(e.target.value) })} />
          </label>
          <label>
            Lettering
            <select value={shape.font ?? 'place'} onChange={(e) => onChange({ font: e.target.value as LabelFont })}>
              {(Object.keys(FONTS) as LabelFont[]).map((f) => (
                <option key={f} value={f}>
                  {FONTS[f].label}
                </option>
              ))}
            </select>
          </label>
          {shape.curve && (
            <button type="button" onClick={() => onChange({ curve: undefined })}>
              Straighten it
            </button>
          )}
        </>
      )}
      <p className="muted small">
        Drag it on the map to move it. Press Delete to remove it{shape.kind === 'asset' && canTurn(shape.asset) ? ', or R to turn it (Shift+R turns it back)' : ''}.
      </p>
      <button className="danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  )
}

/**
 * Link a piece to a page and it works like a pin on the map: click the cottage, read about the
 * cottage. The link is a real pin, so who can see it follows the same rules as any other pin.
 */
function PieceLink({ shape, pin, onLink }: { shape: Extract<Shape, { kind: 'asset' }>; pin?: Pin; onLink: (entity: Entity) => void }) {
  const { worldId } = useWorld()
  const entities = useVisibleEntities(worldId)
  const linked = pin?.entityId ? entities.find((e) => e.id === pin.entityId) : undefined
  const label = Atlas.assets[shape.asset]?.label ?? 'Piece'
  return (
    <section className="piece-link">
      <h3>
        Link to a page <Help topic="linkedPieces" />
      </h3>
      {pin ? (
        <>
          <label>
            Linked page
            <select value={pin.entityId ?? ''} onChange={(e) => db.pins.update(pin.id, { entityId: e.target.value || undefined, label: entities.find((x) => x.id === e.target.value)?.name ?? pin.label })}>
              <option value="">(none)</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {ENTITY_LABELS[e.type].icon} {e.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name on the map
            <input value={pin.label} onChange={(e) => db.pins.update(pin.id, { label: e.target.value })} />
          </label>
          <div className="row spread">
            <VisibilityToggle value={pin.visibility} onChange={(v) => db.pins.update(pin.id, { visibility: v })} />
            <button type="button" onClick={() => db.pins.delete(pin.id)}>
              Unlink
            </button>
          </div>
          <p className="muted small">
            {pin.visibility === 'gm' ? 'Only you can click it for now.' : linked?.visibility === 'gm' ? 'Players can click it, but they won’t see the page until you reveal that too.' : 'Players can click it to open the page.'} A note and
            “opens map” are on the map itself, after you press Done.
          </p>
        </>
      ) : (
        <>
          <label>
            Linked page
            <select
              value=""
              onChange={(e) => {
                const entity = entities.find((x) => x.id === e.target.value)
                if (entity) onLink(entity)
              }}
            >
              <option value="">(none)</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {ENTITY_LABELS[e.type].icon} {e.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={async () => {
              const name = prompt(`Name the new page for this ${label.toLowerCase()}`, label)?.trim()
              if (!name) return
              const entity = blankEntity(worldId, 'location', name)
              await db.entities.add(entity)
              onLink(entity)
            }}
          >
            + New place page for it
          </button>
        </>
      )}
    </section>
  )
}

/** The outline of a room while it's being dragged out: gold to dig, red to fill in. */
function RoomPreview({ room, upp }: { room: RoomStroke; upp: number }) {
  const colour = room.mode === 'dig' ? '#e0b354' : '#d0604a'
  const fill = room.mode === 'dig' ? 'rgba(224,179,84,.25)' : 'rgba(208,96,74,.25)'
  const dash = `${6 * upp} ${4 * upp}`
  const [[ax, ay], [bx, by]] = [room.points[0], room.points[room.points.length - 1]]
  if (room.shape === 'rect')
    return <rect x={Math.min(ax, bx)} y={Math.min(ay, by)} width={Math.abs(bx - ax)} height={Math.abs(by - ay)} fill={fill} stroke={colour} strokeWidth={2 * upp} strokeDasharray={dash} pointerEvents="none" />
  if (room.shape === 'round')
    return <ellipse cx={(ax + bx) / 2} cy={(ay + by) / 2} rx={Math.abs(bx - ax) / 2} ry={Math.abs(by - ay) / 2} fill={fill} stroke={colour} strokeWidth={2 * upp} strokeDasharray={dash} pointerEvents="none" />
  const d = room.points.length > 1 ? `M${room.points.map(([x, y]) => `${x} ${y}`).join(' L')}` : `M${ax} ${ay} l0.01 0`
  return (
    <path
      d={d}
      fill="none"
      stroke={colour}
      strokeOpacity={0.45}
      strokeWidth={room.size}
      strokeLinecap={room.shape === 'corridor' ? 'square' : 'round'}
      strokeLinejoin={room.shape === 'corridor' ? 'miter' : 'round'}
      pointerEvents="none"
    />
  )
}
