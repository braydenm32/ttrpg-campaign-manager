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

/** Colours a world can take for its cover and book: deep, matte cloth colours that keep gold and text readable. */
export const WORLD_COLORS: { name: string; value: string }[] = [
  { name: 'Ink', value: '#2a2633' },
  { name: 'Oxblood', value: '#5e2622' },
  { name: 'Verdigris', value: '#24403c' },
  { name: 'Midnight', value: '#2b3350' },
  { name: 'Moss', value: '#34402a' },
  { name: 'Umber', value: '#4a3424' },
  { name: 'Plum', value: '#43283f' },
  { name: 'Slate', value: '#33393f' },
]

/** A world's colour: its own choice, or one picked from its id so a new shelf isn't all one colour. */
export function worldColor(w: { id: string; color?: string }) {
  if (w.color) return w.color
  let h = 0
  for (const ch of w.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return WORLD_COLORS[h % WORLD_COLORS.length].value
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
  /** False while the claim waits for the GM to approve it (older servers leave it out: approved). */
  approved?: boolean
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

/** A player's question to the GM, about a page (or entityId '' for anything else). */
export interface PlayerQuestion {
  id: string
  entityId: string
  /** Who asked (only in the GM's inbox). */
  userId?: string
  body: string
  answer?: string | null
  answeredAt?: string | null
  createdAt: string
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
  /** For joined worlds: your own questions to the GM, and the answers. */
  questions?: PlayerQuestion[]
  /** What arrived since the player last said "got it": newly revealed pages and sessions, and answers to their questions. */
  news?: { entityIds: string[]; sessionIds: string[]; questionIds: string[] }
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
  /** A picture (asset id) for the top of Home and the world's book on the shelf. Players see it too. */
  coverId?: string
  /** The world's own colour, one of WORLD_COLORS, for its cover and book. */
  color?: string
  /** The party's money, e.g. [{ name: 'gp', amount: 120 }]. Shown on the party loot page. */
  partyCoin?: { name: string; amount: number }[]
  /** The world's own calendar (months, weekdays, moons) and today's date in the world. */
  calendar?: WorldCalendar
  /** What the GM is showing every player right now (a handout, a page or some text). */
  showing?: Showing | null
  /** Everything the GM has shown, newest first, so players can read a handout again later. */
  handouts?: Showing[]
  /** The table's safety tools: lines (never in the game) and veils (happens off screen). Everyone sees these. */
  safety?: Safety
  /** Device-only: cloud sync settings for this world. Never uploaded. */
  cloud?: { enabled: boolean; lastPulledAt?: string; pullVersion?: number }
  /**
   * Device-only: set when this world is a read-only player copy, either opened from a share link
   * (token) or joined with an invite (memberOf, the GM's cloud world id).
   */
  shared?: SharedInfo
}

/** A date on the world's calendar. month is the position in the calendar's list (from 0), day starts at 1. */
export interface CalDate {
  year: number
  month: number
  day: number
}

export interface WorldCalendar {
  /** Which ready-made calendar this started from, if any. */
  preset?: string
  months: { name: string; days: number }[]
  /** Day names, in order. Empty for calendars without named days (dates then show without one). */
  weekdays: string[]
  /** Written after the year, like "DR" or "AR". */
  era: string
  /** Moons and how many days each takes to go round; offset shifts which day is full. */
  moons: { name: string; cycle: number; offset: number }[]
  /** Which weekday the first day of year 0 falls on, so weekdays line up with a published calendar. */
  weekdayOffset?: number
  /** Today in the world. The GM moves it on as time passes in the game. */
  today?: CalDate
}

/** Something the GM puts on every player's screen. */
export interface Showing {
  id: string
  kind: 'image' | 'page' | 'text'
  title: string
  assetId?: string
  entityId?: string
  text?: string
  at: number
}

export interface Safety {
  /** Lines: things that never happen in the game. */
  lines: string[]
  /** Veils: things that can happen, but off screen ("fade to black"). */
  veils: string[]
  /** Anything else the table agreed, like the X-card or "open door". */
  notes: string
  /** Whether players get the anonymous X-card button. */
  xcard?: boolean
}

export interface Campaign {
  id: string
  worldId: string
  name: string
  description: string
  system: string
  status: 'planning' | 'active' | 'paused' | 'finished'
  /** 'gm' keeps the campaign and its sessions from players (one you're still planning). Unset means players. */
  visibility?: Visibility
  /** Dates the GM has proposed for the next session; players say whether they can make each one. */
  schedule?: DateOption[]
  /** The date the GM booked for the next session, so players can see it. */
  booked?: DateOption
  createdAt: number
}

export interface DateOption {
  id: string
  /** The GM's local date and time, "2026-11-02T19:00". */
  at: string
  /** The same moment as a full timestamp, so players in other time zones see it in their own time. */
  utc?: string
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
  /** Free-form key/value fields (stats, prices, alignment...). Keeps the core system-agnostic. gm: never shown to players. */
  fields: { key: string; value: string; gm?: boolean }[]
  /** Other names the page goes by; [[links]] to any of them find it. GM-only. */
  aliases?: string[]
  /** Tags for the GM alone (players get only the ordinary tags). */
  gmTags?: string[]
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
  /** How this page relates to others: family, allies, enemies, who serves whom. */
  relations?: Relation[]
  /** Progress clocks, like a villain's plan filling up a slice at a time. */
  clocks?: Clock[]
  /** Events: the date on the world's calendar, when there is one. */
  eventWhen?: CalDate
  /** Player characters: written by the player who plays them. Never holds secrets. */
  playerBody?: string
  /** Characters: alive, dead, missing or captured (unset means alive or not worth saying). */
  status?: LifeStatus | null
  /** Whether players may see the status. Unticked, it stays GM-only even on a revealed page. */
  statusKnown?: boolean
  /** Player characters: the campaign they play in, when a world has several groups. Unset means any. */
  campaignId?: string
  createdAt: number
  updatedAt: number
}

export interface Relation {
  id: string
  /** The other page. */
  to: string
  /** "parent of", "ally of", "serves"… read as: this page <kind> the other page. */
  kind: string
  note?: string
  /** Whether players may see this link. Unticked, it stays GM-only even on a revealed page. */
  known?: boolean
}

export interface Clock {
  id: string
  name: string
  segments: number
  filled: number
  /** Whether players may see this clock. */
  known?: boolean
}

export type LifeStatus = 'alive' | 'dead' | 'missing' | 'captured'
export const LIFE_STATUS: Record<LifeStatus, { label: string; icon: string }> = {
  alive: { label: 'Alive', icon: '💚' },
  dead: { label: 'Dead', icon: '💀' },
  missing: { label: 'Missing', icon: '❓' },
  captured: { label: 'Captured', icon: '⛓️' },
}
/** Page types that can have a status. */
export const HAS_STATUS: EntityType[] = ['npc', 'pc']

/** An earlier version of a page, kept on this device so a bad edit or delete can be undone. */
export interface PageVersion {
  id: string
  entityId: string
  worldId: string
  at: number
  /** Why it was kept: before an edit here, before a change from another device, or when deleted. */
  reason: 'edit' | 'synced' | 'deleted' | 'conflict'
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
  /** Fog of war: players see only the areas the GM has uncovered. */
  fog?: MapFog
  createdAt: number
}

/** An area uncovered (or covered again) on a map, in image coordinates [y, x] like pins. Later shapes win. */
export interface FogShape {
  id: string
  mode: 'reveal' | 'hide'
  points: [number, number][]
}

export interface MapFog {
  on: boolean
  shapes: FogShape[]
  /** The picture players get: the map with the fog painted on, so hidden parts never leave the GM's device. */
  imageId?: string
  /** What that picture was made from (map image version and shapes), to know when to remake it. */
  renderedFrom?: string
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
  /** The GM's plan for this session. Always GM-only. */
  prep?: SessionPrep
  /** The in-world date when this session starts. */
  worldDate?: CalDate
  createdAt: number
}

export interface CheckItem {
  id: string
  text: string
  done: boolean
}

/** The session prep sheet: how it opens, likely scenes, clues to drop and fights ready to run. */
export interface SessionPrep {
  strongStart: string
  scenes: CheckItem[]
  /** Secrets and clues the players might find this session; ticked once they do. */
  clues: CheckItem[]
  encounters: Encounter[]
}

export const blankPrep = (): SessionPrep => ({ strongStart: '', scenes: [], clues: [], encounters: [] })

/** A fight planned ahead, loaded into the Lectern's initiative tracker in one click. */
export interface Encounter {
  id: string
  name: string
  notes: string
  foes: EncounterFoe[]
}

export interface EncounterFoe {
  id: string
  name: string
  count: number
  hp?: number | null
  ac?: string
  side: Combatant['side']
  /** The NPC page this foe comes from, if any. */
  entityId?: string
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

/** A corkboard: pages and notes pinned up, with string between them. GM-only. */
export interface Board {
  id: string
  worldId: string
  name: string
  cards: BoardCard[]
  strings: BoardString[]
  createdAt: number
  updatedAt: number
}

export interface BoardCard {
  id: string
  x: number
  y: number
  /** A page on the board; otherwise a note card with text. */
  entityId?: string
  text?: string
  color?: string
}

export interface BoardString {
  id: string
  from: string
  to: string
  label?: string
}

/** A soundboard button: an uploaded file, or a Syrinscape mood or element. GM-only. */
export interface Sound {
  id: string
  worldId: string
  name: string
  source: 'file' | 'syrinscape'
  assetId?: string
  syrinscape?: { kind: 'mood' | 'element'; id: string }
  loop: boolean
  /** 0 to 1. */
  volume: number
  /** Buttons with the same group sit together, e.g. Ambience, Music, Effects. */
  group: string
  createdAt: number
}

/**
 * A few seconds of a recording in progress, kept on this device only. The pieces are joined into one
 * file when the GM presses Stop; if the app closed first, the session page offers to recover them.
 */
export interface RecordingChunk {
  id?: number
  recordingId: string
  sessionId: string
  worldId: string
  startedAt: number
  /** Order within the recording. */
  seq: number
  mime: string
  blob: Blob
  /** Bookmarks so far (each piece carries the latest list). */
  bookmarks: Bookmark[]
}

/** Something deleted on this device (not a page: those live in history), kept a while so it can be restored. */
export interface BinItem {
  id: string
  worldId: string
  at: number
  kind: 'session' | 'campaign' | 'file' | 'board' | 'sound' | 'map'
  /** What to call it in the list, e.g. the session's title. */
  label: string
  /** The rows that were removed, by table, so restoring puts every one back. */
  rows: { table: 'campaigns' | 'sessions' | 'assets' | 'boards' | 'sounds' | 'maps' | 'pins'; rows: unknown[] }[]
}

/** What was last synced for each row, so only real changes are uploaded. */
export interface SyncMeta {
  key: string
  worldId: string
  hash: string
  deleted?: boolean
  /** Upload failed (e.g. file too large); not retried until the row changes. */
  failed?: string
  /** The row as last synced (without files), so edits made here and elsewhere can be merged. */
  base?: Record<string, unknown>
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
  boards: EntityTable<Board, 'id'>
  sounds: EntityTable<Sound, 'id'>
  bin: EntityTable<BinItem, 'id'>
  recordingChunks: EntityTable<RecordingChunk, 'id'>
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

// v4: corkboards and soundboard buttons (both synced, both GM-only).
db.version(4).stores({
  boards: 'id, worldId',
  sounds: 'id, worldId',
})

// v5: the recently deleted bin for sessions, campaigns, files, maps, boards and sounds (device-only, never synced).
db.version(5).stores({
  bin: 'id, worldId, at',
})

// v6: recordings are saved a few seconds at a time while they run, so a crash loses almost nothing.
db.version(6).stores({
  recordingChunks: '++id, recordingId, sessionId',
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
  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets, db.syncMeta, db.history, db.boards, db.sounds, db.bin, db.recordingChunks], async () => {
    await db.history.where({ worldId }).delete()
    await db.bin.where({ worldId }).delete()
    await db.recordingChunks.filter((c) => c.worldId === worldId).delete()
    await db.boards.where({ worldId }).delete()
    await db.sounds.where({ worldId }).delete()
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
