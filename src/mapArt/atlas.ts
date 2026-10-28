/**
 * The hand-inked asset library used by classic-style drawn maps. The recipes themselves are plain
 * Canvas 2D scripts in ./lib (they register onto window.Atlas); this file loads them in order and
 * gives the rest of the app typed access.
 */
import './lib/common.js'
import './lib/terrain.js'
import './lib/mountains.js'
import './lib/vegetation.js'
import './lib/settlements.js'
import './lib/furniture.js'
import './lib/bm-nature.js'
import './lib/bm-props.js'
import './lib/bm-buildings.js'
import './lib/dg-doors.js'
import './lib/dg-features.js'
import './lib/dg-furnishings.js'
import './lib/ct-houses.js'
import './lib/ct-castle.js'
import './lib/ct-harbour.js'
import './lib/gm-marks.js'

export type Point = [number, number]
export type Rng = () => number

export interface Tint {
  label: string
  land: string
  grass: string
  forest: string
  forestDark: string
  rock: string
  snow: string
  water: string
  roof: string
  sand: string
}

/** How a recipe should draw: ink only, or ink plus soft watercolour washes. */
export interface InkStyle {
  mode: 'ink' | 'colour'
  shadows: boolean
  /** Line weight multiplier. */
  line: number
  ink: string
  paper: string
  tint: Tint
}

export interface AssetDef {
  label: string
  category: string
  /** Recipes draw a fresh variation from the seed every time; fixed pieces have 8 hand-made versions. */
  kind: 'recipe' | 'fixed'
  /** side: (x, y) is the middle of the base and s the height; top and furniture: (x, y) is the centre, s the width. */
  view: 'side' | 'top' | 'furniture'
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: Rng, st: InkStyle, variant: number): void
}

type Opts = Record<string, unknown>
interface TerrainApi {
  ripples(ctx: CanvasRenderingContext2D, path: Path2D, w: number, h: number, st: InkStyle, opts?: Opts): void
  coastStipple(ctx: CanvasRenderingContext2D, polys: Point[][], isLand: (x: number, y: number) => boolean, r: Rng, st: InkStyle, opts?: Opts): void
  river(ctx: CanvasRenderingContext2D, line: Point[], r: Rng, st: InkStyle, opts?: Opts): void
  road(ctx: CanvasRenderingContext2D, line: Point[], r: Rng, st: InkStyle, opts?: Opts): void
  border(ctx: CanvasRenderingContext2D, line: Point[], r: Rng, st: InkStyle): void
  curvedText(ctx: CanvasRenderingContext2D, text: string, line: Point[], opts: Opts): void
  text(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: Opts): void
}

export interface AtlasApi {
  assets: Record<string, AssetDef>
  BIOMES: Record<string, Tint>
  rng(seed: number): Rng
  R(r: Rng, a: number, b: number): number
  style(mode: 'ink' | 'colour', biome?: string, shadows?: boolean): InkStyle
  wobble(pts: Point[], r: Rng, amp?: number, step?: number): Point[]
  inkStroke(ctx: CanvasRenderingContext2D, pts: Point[], r: Rng, opts?: { w?: number; wob?: number; taper?: number; color?: string }): void
  poly(ctx: CanvasRenderingContext2D, pts: Point[]): void
  terrain: TerrainApi
  /** Set while a turned town piece draws: where the light comes from, in the piece's own turned frame. */
  light?: [number, number]
}

export const Atlas = (window as unknown as { Atlas: AtlasApi }).Atlas

/** The groups the stamp picker shows, in order. */
export const ASSET_GROUPS: { label: string; categories: string[] }[] = [
  { label: 'Mountains & hills', categories: ['mountains', 'hills'] },
  { label: 'Forests & plants', categories: ['vegetation'] },
  { label: 'Towns & landmarks', categories: ['settlements', 'landmarks', 'symbols'] },
  { label: 'Sea & map furniture', categories: ['furniture', 'sea'] },
  { label: 'GM only: secrets', categories: ['gm-marks'] },
]

/** The groups the stamp picker shows on battle maps (pieces seen from above). */
export const BATTLE_GROUPS: { label: string; categories: string[] }[] = [
  { label: 'Trees & plants', categories: ['bm-trees', 'bm-plants'] },
  { label: 'Rocks & water', categories: ['bm-rocks', 'bm-water'] },
  { label: 'Camp', categories: ['bm-camp'] },
  { label: 'Buildings', categories: ['bm-buildings'] },
  { label: 'Village', categories: ['bm-village'] },
  { label: 'Things', categories: ['bm-objects'] },
  { label: 'Doors', categories: ['dg-doors'] },
  { label: 'Dungeon', categories: ['dg-features'] },
  { label: 'Dungeon furnishings', categories: ['dg-furnishings'] },
  { label: 'GM only: secrets', categories: ['gm-marks'] },
]

/** The groups the stamp picker shows on town and city maps: town pieces first, then the battle-map pieces (drawn smaller). */
export const CITY_GROUPS: { label: string; categories: string[] }[] = [
  { label: 'Town houses', categories: ['ct-houses'] },
  { label: 'Castles, churches & walls', categories: ['ct-castle'] },
  { label: 'Harbour & farmland', categories: ['ct-harbour'] },
  ...BATTLE_GROUPS.filter((g) => !g.categories.some((c) => c.startsWith('dg-'))),
]

export const assetNamesIn = (categories: string[]) => Object.keys(Atlas.assets).filter((n) => categories.includes(Atlas.assets[n].category))
