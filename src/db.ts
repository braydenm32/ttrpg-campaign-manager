import Dexie, { type EntityTable } from 'dexie'
import type { Drawing } from './mapDrawing'

/** Who can see a piece of content. GM-only content never appears in the player view. */
export type Visibility = 'gm' | 'players'

export const ENTITY_TYPES = [
  'location',
  'npc',
  'pc',
  'faction',
  'item',
  'event',
  'quest',
  'shop',
  'deity',
  'lore',
] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export const ENTITY_LABELS: Record<EntityType, { one: string; many: string; icon: string }> = {
  location: { one: 'Location', many: 'Locations', icon: '🏰' },
  npc: { one: 'NPC', many: 'NPCs', icon: '🧙' },
  pc: { one: 'Player Character', many: 'Player Characters', icon: '🛡️' },
  faction: { one: 'Faction', many: 'Factions', icon: '⚑' },
  item: { one: 'Item', many: 'Items', icon: '🗝️' },
  event: { one: 'Event', many: 'Events', icon: '📜' },
  quest: { one: 'Quest', many: 'Quests', icon: '🧭' },
  shop: { one: 'Shop / Tavern', many: 'Shops & Taverns', icon: '🍺' },
  deity: { one: 'Deity', many: 'Deities', icon: '✨' },
  lore: { one: 'Lore', many: 'Lore', icon: '📚' },
}

export const GAME_SYSTEMS = [
  'System agnostic',
  'D&D 5e (2014)',
  'D&D 5e (2024)',
  'Pathfinder 2e',
  'Pathfinder 1e',
  'Starfinder 2e',
  'Starfinder 1e',
  'Call of Cthulhu 7e',
  'Daggerheart',
  'Shadowdark',
  'Cyberpunk RED',
  'Vampire: The Masquerade 5e',
  'Blades in the Dark',
  'Other',
]

export interface World {
  id: string
  name: string
  description: string
  system: string
  createdAt: number
  updatedAt: number
  /** Device-only: cloud sync settings for this world. Never uploaded. */
  cloud?: { enabled: boolean; lastPulledAt?: string }
  /** Device-only: set when this world is a read-only copy opened from a player share link. */
  shared?: { token: string; fetchedAt: number }
}

export interface Campaign {
  id: string
  worldId: string
  name: string
  description: string
  system: string
  status: 'planning' | 'active' | 'paused' | 'finished'
  createdAt: number
}

export interface Entity {
  id: string
  worldId: string
  type: EntityType
  name: string
  /** One-line description shown in lists and map popups. */
  summary: string
  /** Markdown. Supports [[Entity Name]] links and :::gm ... ::: secret blocks. */
  body: string
  /** Always GM-only, regardless of visibility. */
  gmNotes: string
  visibility: Visibility
  tags: string[]
  /** For locations: the containing location (city inside a region, etc). */
  parentId?: string
  /** Free-form key/value fields (stats, prices, alignment...). Keeps the core system-agnostic. */
  fields: { key: string; value: string }[]
  imageId?: string
  /** Events: in-world date label and whether it happened before or during the campaign. */
  eventDate?: string
  eventEra?: 'pre' | 'campaign'
  /** Ordering key for the timeline (lower = earlier). */
  eventOrder?: number
  /** Quests: status. */
  questStatus?: 'open' | 'active' | 'done' | 'failed'
  createdAt: number
  updatedAt: number
}

export interface WorldMap {
  id: string
  worldId: string
  name: string
  imageId: string
  width: number
  height: number
  visibility: Visibility
  /** The location this map depicts, so a location page can open its map. */
  locationId?: string
  /** Set for maps made with the in-app map builder; the image is re-rendered from it on every edit. */
  drawing?: Drawing
  createdAt: number
}

export interface Pin {
  id: string
  worldId: string
  mapId: string
  label: string
  kind: 'point' | 'region'
  /** Point position, in image pixel coordinates [y, x]. */
  position?: [number, number]
  /** Region polygon, in image pixel coordinates. */
  points?: [number, number][]
  color: string
  visibility: Visibility
  entityId?: string
  /** Clicking "enter" on this pin opens another map (e.g. city map from a region pin). */
  childMapId?: string
  note: string
}

export interface Bookmark {
  id: string
  /** Seconds into the recording. */
  t: number
  text: string
}

export interface Session {
  id: string
  worldId: string
  campaignId: string
  number: number
  title: string
  date: string
  /** GM's running notes (Markdown). */
  notes: string
  /** Player-facing recap (Markdown). Shown in player view. */
  recap: string
  visibility: Visibility
  entityIds: string[]
  recordings: { assetId: string; startedAt: number; bookmarks: Bookmark[] }[]
  createdAt: number
}

export interface Asset {
  id: string
  worldId: string
  name: string
  mime: string
  size: number
  blob: Blob
  tags: string[]
  visibility: Visibility
  createdAt: number
  /** Bumped when the file itself changes (e.g. a drawn map is re-rendered), so sync re-uploads it. */
  updatedAt?: number
}

/** What was last synced for each row, so only real changes are uploaded. */
export interface SyncMeta {
  key: string
  worldId: string
  hash: string
  deleted?: boolean
  /** Upload failed (e.g. file too large); not retried until the row changes. */
  failed?: string
}

export const db = new Dexie('ttrpg-campaign-manager') as Dexie & {
  worlds: EntityTable<World, 'id'>
  campaigns: EntityTable<Campaign, 'id'>
  entities: EntityTable<Entity, 'id'>
  maps: EntityTable<WorldMap, 'id'>
  pins: EntityTable<Pin, 'id'>
  sessions: EntityTable<Session, 'id'>
  assets: EntityTable<Asset, 'id'>
  syncMeta: EntityTable<SyncMeta, 'key'>
}

db.version(1).stores({
  worlds: 'id, name, updatedAt',
  campaigns: 'id, worldId',
  entities: 'id, worldId, [worldId+type], name, parentId, *tags',
  maps: 'id, worldId, locationId',
  pins: 'id, mapId, entityId',
  sessions: 'id, campaignId, number',
  assets: 'id, worldId',
})

// v2: pins and sessions carry their worldId (needed for sync), plus the sync bookkeeping table.
db.version(2)
  .stores({
    pins: 'id, mapId, entityId, worldId',
    sessions: 'id, campaignId, number, worldId',
    syncMeta: 'key, worldId',
  })
  .upgrade(async (tx) => {
    const mapWorld = new Map((await tx.table('maps').toArray()).map((m: WorldMap) => [m.id, m.worldId]))
    const campaignWorld = new Map((await tx.table('campaigns').toArray()).map((c: Campaign) => [c.id, c.worldId]))
    await tx.table('pins').toCollection().modify((p: Pin) => {
      p.worldId = mapWorld.get(p.mapId) ?? ''
    })
    await tx.table('sessions').toCollection().modify((s: Session) => {
      s.worldId = campaignWorld.get(s.campaignId) ?? ''
    })
  })

export const newId = () => crypto.randomUUID()

export function blankEntity(worldId: string, type: EntityType, name = ''): Entity {
  const now = Date.now()
  return {
    id: newId(),
    worldId,
    type,
    name,
    summary: '',
    body: '',
    gmNotes: '',
    visibility: 'gm',
    tags: [],
    fields: [],
    createdAt: now,
    updatedAt: now,
    ...(type === 'event' ? { eventEra: 'pre' as const, eventOrder: now } : {}),
    ...(type === 'quest' ? { questStatus: 'open' as const } : {}),
  }
}

export async function deleteWorld(worldId: string) {
  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets, db.syncMeta], async () => {
    await db.sessions.where({ worldId }).delete()
    await db.pins.where({ worldId }).delete()
    await db.syncMeta.where({ worldId }).delete()
    await db.maps.where({ worldId }).delete()
    await db.campaigns.where({ worldId }).delete()
    await db.entities.where({ worldId }).delete()
    await db.assets.where({ worldId }).delete()
    await db.worlds.delete(worldId)
  })
}

export async function deleteEntity(id: string) {
  await db.transaction('rw', [db.entities, db.pins, db.maps], async () => {
    await db.pins.where({ entityId: id }).modify({ entityId: undefined })
    await db.maps.where({ locationId: id }).modify({ locationId: undefined })
    await db.entities.where({ parentId: id }).modify({ parentId: undefined })
    await db.entities.delete(id)
  })
}

export async function deleteMap(id: string) {
  await db.transaction('rw', [db.maps, db.pins], async () => {
    await db.pins.where({ mapId: id }).delete()
    await db.pins.filter((p) => p.childMapId === id).modify({ childMapId: undefined })
    await db.maps.delete(id)
  })
}
