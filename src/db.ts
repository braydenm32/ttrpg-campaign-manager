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
  'thread',
  'table',
  'custom',
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
  thread: { one: 'Loose thread', many: 'Loose threads', icon: '🧵' },
  table: { one: 'Random table', many: 'Random tables', icon: '🎲' },
  custom: { one: 'Page', many: 'Other pages', icon: '📄' },
}

/** Types offered when making or changing a page. Custom types are offered separately, from the world's own list. */
export const PICKER_TYPES = ENTITY_TYPES.filter((t) => t !== 'custom')

/** A page type the GM made up, like Ships or Spells. Its pages have type 'custom' and customType set to its id. */
export interface CustomType {
  id: string
  one: string
  many: string
  icon: string
}

/** The label and icon for a page's type, including the world's custom types. */
export function typeLabel(e: { type: EntityType; customType?: string }, world?: { customTypes?: CustomType[] } | null) {
  if (e.type === 'custom') {
    const c = world?.customTypes?.find((x) => x.id === e.customType)
    if (c) return c
  }
  return ENTITY_LABELS[e.type]
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

export type ThreadStatus = 'open' | 'active' | 'resolved' | 'dropped'
export const THREAD_STATUS: Record<ThreadStatus, { label: string; hint: string }> = {
  open: { label: 'Dangling', hint: 'Set up, but the players haven’t picked it up yet' },
  active: { label: 'In play', hint: 'The players are pulling on it' },
  resolved: { label: 'Tied off', hint: 'Paid off or answered' },
  dropped: { label: 'Dropped', hint: 'Abandoned or no longer relevant' },
}

export interface CharacterClaim {
  /** Local id of the player character. */
  entityId: string
  userId: string
  /** The player's own notes on their character. */
  notes: string
}

/** A player's note on a page (entityId '' is the world's scratchpad), private or shared with the group. */
export interface PlayerNote {
  /** Local id of the page, or '' for the scratchpad. */
  entityId: string
  shared: boolean
  body: string
  updatedBy?: string
  updatedAt?: string
}

/** A player's answer to "can you make this date?". */
export type Availability = 'yes' | 'maybe' | 'no'

export interface SharedInfo {
  token?: string
  memberOf?: string
  fetchedAt: number
  /** For joined worlds: who you are, who else is playing, and who plays which character. */
  me?: string
  members?: { userId: string; name: string; role: string }[]
  claims?: CharacterClaim[]
  /** For joined worlds: the group's notes and your own. */
  notes?: PlayerNote[]
  /** For joined worlds: everyone's answers to the GM's proposed session dates. */
  availability?: { optionId: string; userId: string; answer: Availability }[]
}

export interface World {
  id: string
  name: string
  description: string
  system: string
  createdAt: number
  updatedAt: number
  /** Page types the GM added, like Ships or Spells. */
  customTypes?: CustomType[]
  /** The party's money, e.g. [{ name: 'gp', amount: 120 }]. Shown on the party loot page. */
  partyCoin?: { name: string; amount: number }[]
  /** Device-only: cloud sync settings for this world. Never uploaded. */
  cloud?: { enabled: boolean; lastPulledAt?: string }
  /**
   * Device-only: set when this world is a read-only player copy, either opened from a share link
   * (token) or joined with an invite (memberOf, the GM's cloud world id).
   */
  shared?: SharedInfo
}

export interface Campaign {
  id: string
  worldId: string
  name: string
  description: string
  system: string
  status: 'planning' | 'active' | 'paused' | 'finished'
  /** Dates the GM has proposed for the next session; players say whether they can make each one. */
  schedule?: DateOption[]
  createdAt: number
}

export interface DateOption {
  id: string
  /** Local date and time, "2026-11-02T19:00". */
  at: string
  note?: string
}

export interface Entity {
  id: string
  worldId: string
  type: EntityType
  /** For type 'custom': the id of one of the world's custom types. */
  customType?: string
  /** A template: a starting point for new pages, never shown in lists or to players. */
  template?: boolean
  name: string
  /** One-line description shown in lists and map popups. */
  summary: string
  /** Markdown. Supports [[Entity Name]] links and :::gm ... ::: secret blocks. */
  body: string
  /** Always GM-only, regardless of visibility. */
  gmNotes: string
  visibility: Visibility
  /** GM-only pages can still be revealed to chosen players (their account ids). Needs cloud sync. */
  revealedTo?: string[]
  /** Player copies only: this page was revealed to you alone, not to the whole table. */
  secretForYou?: boolean
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
  /** Loose threads: where the thread stands, how pressing it is, and the sessions that raised and tied it off. */
  threadStatus?: ThreadStatus
  threadUrgency?: 'low' | 'normal' | 'high'
  raisedIn?: string
  tiedOffIn?: string
  /** Random tables: one entry per line. Entries can roll dice ({1d6}) or roll on another table ({Table name}). */
  entries?: string[]
  /** Items: who carries it (a character's page id, or 'party' for the shared stash), and how many. */
  heldBy?: string
  quantity?: number
  createdAt: number
  updatedAt: number
}

/** An earlier version of a page, kept on this device so a bad edit or delete can be undone. */
export interface PageVersion {
  id: string
  entityId: string
  worldId: string
  at: number
  /** Why it was kept: before an edit here, before a change from another device, or when deleted. */
  reason: 'edit' | 'synced' | 'deleted'
  entity: Entity
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

export interface TranscriptLine {
  /** Seconds into the recording. */
  start: number
  end: number
  text: string
  /** Speaker label from the transcription service ("A", "B"…); renamed via Transcript.speakers. */
  speaker?: string
}

export interface Transcript {
  /** "device": made on this device, free and private. "cloud": AssemblyAI, with speaker labels. */
  engine: 'device' | 'cloud'
  model?: string
  lines: TranscriptLine[]
  /** Names the GM gave to speaker labels, e.g. { A: 'Brayden (GM)' }. */
  speakers?: Record<string, string>
  /** Set while a transcript is still being made, so it can carry on after a reload. */
  pending?: { doneUntil?: number; jobId?: string; duration?: number }
  createdAt: number
}

export interface Recording {
  assetId: string
  startedAt: number
  bookmarks: Bookmark[]
  transcript?: Transcript
}

export interface RecapDraft {
  gm: string
  players: string
  /** "claude-api" when made in the app, "pasted" when pasted back from claude.ai. */
  source: 'claude-api' | 'pasted'
  createdAt: number
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
  recordings: Recording[]
  /** The last AI recap draft, kept until the GM uses or discards it. Always GM-only. */
  recapDraft?: RecapDraft
  /** The Lectern: live state while running this session at the table. Always GM-only. */
  lectern?: LecternState
  createdAt: number
}

export interface Combatant {
  id: string
  name: string
  /** Initiative result; null until rolled or typed in. */
  init: number | null
  hp?: number | null
  maxHp?: number | null
  ac?: string
  side: 'pc' | 'ally' | 'foe'
  conditions: string[]
  entityId?: string
}

export interface LecternState {
  /** The location the party is in right now. */
  sceneId?: string
  /** GM scene notes: read-aloud text, what's here, what happens next. */
  sceneText: string
  /** NPCs and others present in the scene. */
  presentIds: string[]
  combat: { round: number; activeId?: string; combatants: Combatant[] }
  rolls: { id: string; expr: string; total: number; detail: string; crit?: 'high' | 'low'; at: number }[]
}

export const blankLectern = (): LecternState => ({ sceneText: '', presentIds: [], combat: { round: 0, combatants: [] }, rolls: [] })

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
  history: EntityTable<PageVersion, 'id'>
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

// v3: page history (device-only, never synced).
db.version(3).stores({
  history: 'id, entityId, worldId, at',
})

export const newId = () => crypto.randomUUID()

/** Versions kept per page; older ones are dropped. */
const HISTORY_PER_PAGE = 40

/** Keeps a copy of a page as it was, so it can be restored later. */
export async function keepVersion(entity: Entity, reason: PageVersion['reason']) {
  await db.history.add({ id: newId(), entityId: entity.id, worldId: entity.worldId, at: Date.now(), reason, entity })
  const old = await db.history.where({ entityId: entity.id }).sortBy('at')
  if (old.length > HISTORY_PER_PAGE) await db.history.bulkDelete(old.slice(0, old.length - HISTORY_PER_PAGE).map((v) => v.id))
}

/** Saves a page, keeping the version it replaces. */
export async function saveEntity(next: Entity) {
  const before = await db.entities.get(next.id)
  if (before && JSON.stringify(before) !== JSON.stringify(next)) await keepVersion(before, 'edit')
  await db.entities.put(next)
}

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
    ...(type === 'thread' ? { threadStatus: 'open' as const, threadUrgency: 'normal' as const } : {}),
    ...(type === 'table' ? { entries: [] } : {}),
  }
}

/** A new page that starts as a copy of a template. */
export function fromTemplate(t: Entity, name = `New ${t.name}`): Entity {
  const now = Date.now()
  const { template: _t, revealedTo: _r, ...rest } = structuredClone(t)
  return { ...rest, id: newId(), name, visibility: 'gm', createdAt: now, updatedAt: now }
}

export async function deleteWorld(worldId: string) {
  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets, db.syncMeta, db.history], async () => {
    await db.history.where({ worldId }).delete()
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
  await db.transaction('rw', [db.entities, db.pins, db.maps, db.history], async () => {
    const e = await db.entities.get(id)
    if (e) await keepVersion(e, 'deleted')
    await db.entities.filter((x) => x.heldBy === id).modify({ heldBy: undefined })
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
