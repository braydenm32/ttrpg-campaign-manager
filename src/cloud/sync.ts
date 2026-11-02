import Dexie from 'dexie'
import { loadInBackground } from '../worldLoading'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { db, keepVersion, newId, type Asset, type Entity, type SyncMeta, type World } from '../db'
import { sendOnce } from './live'
import { binRemovedElsewhere } from '../bin'
import { onToastChange, undoShowing } from '../undo'
import { supabase, cloudErrorMessage } from './client'

/**
 * Cloud sync for worlds the GM has opted in.
 *
 * Each local row is stored in the cloud `records` table as JSON. A device remembers a fingerprint
 * of every row it last synced (`syncMeta`), so it only uploads rows that really changed and can tell
 * a local edit from a remote one. Rules:
 *  - Pull first, then push.
 *  - If a row changed on this device and in the cloud, this device's edit wins (it gets pushed).
 *  - Deletes are uploaded as tombstones so other devices remove the row too.
 *  - Files (assets) go to Supabase Storage at <world id>/<asset id>.
 * Other devices hear about changes instantly via Realtime, with a slow poll as a safety net.
 *
 * Cost: a sync only downloads rows changed since the last one, and only uploads rows whose
 * fingerprint changed, so a quiet world costs almost nothing. The safety-net poll runs every few
 * minutes and skips hidden tabs; edits wait for a short pause in typing before syncing.
 */

/** How long after the last local edit to sync (typing keeps pushing it back). */
const EDIT_DELAY = 3000
/** The safety-net check, in case a Realtime message was missed. Paused while the app is hidden. */
const POLL_EVERY = 5 * 60_000

export const SYNCED_TABLES = ['worlds', 'campaigns', 'entities', 'maps', 'pins', 'sessions', 'assets', 'boards', 'sounds', 'reputation'] as const
type SyncedTable = (typeof SYNCED_TABLES)[number]

interface Row {
  table: SyncedTable
  id: string
  data: Record<string, unknown>
  blob?: Blob
}

export type SyncState = { status: 'off' | 'idle' | 'syncing' | 'offline' | 'error'; lastSync?: number; message?: string }

// ---------- status store (read by React with useSyncExternalStore) ----------

let state: SyncState = { status: 'off' }
const listeners = new Set<() => void>()
const setState = (s: Partial<SyncState>) => {
  state = { ...state, ...s }
  listeners.forEach((l) => l())
}
export const syncStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

// ---------- helpers ----------

/** JSON with sorted keys, so the same data always gives the same fingerprint (the cloud reorders keys). */
export function stableStringify(v: unknown): string {
  if (v === undefined) return 'null'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`
}
const fingerprint = (data: unknown) => stableStringify(data)
const metaKey = (table: string, id: string) => `${table}:${id}`

/**
 * Text with a "nothing" character in it (it comes along when copying from some PDFs) is refused by
 * the cloud, and one such row would stop the whole world syncing, so those characters are dropped.
 * Returns the same object when there's nothing to drop.
 */
function withoutNul<T>(v: T): T {
  if (typeof v === 'string') return (v.includes('\0') ? v.replaceAll('\0', '') : v) as T
  if (!v || typeof v !== 'object' || v instanceof Blob) return v
  if (Array.isArray(v)) {
    const out = v.map(withoutNul)
    return (out.some((x, i) => x !== v[i]) ? out : v) as T
  }
  let out: Record<string, unknown> | undefined
  for (const [k, x] of Object.entries(v)) {
    const y = withoutNul(x)
    if (y !== x) (out ??= { ...(v as Record<string, unknown>) })[k] = y
  }
  return (out ?? v) as T
}

/** The parts of a row that are uploaded: device-only fields and file contents are left out. */
function toData(table: SyncedTable, row: Record<string, unknown>): Record<string, unknown> {
  if (table === 'worlds') {
    const { cloud: _c, shared: _s, ...rest } = row as unknown as World
    return withoutNul(rest as unknown as Record<string, unknown>)
  }
  if (table === 'assets') {
    const { blob: _b, ...rest } = row as unknown as Asset
    return withoutNul(rest as unknown as Record<string, unknown>)
  }
  return withoutNul(row)
}

const tableOf = (t: SyncedTable) => db[t] as unknown as Dexie.Table<Record<string, unknown>, string>

async function localRows(worldId: string): Promise<Row[]> {
  const out: Row[] = []
  const world = await db.worlds.get(worldId)
  if (world) out.push({ table: 'worlds', id: world.id, data: toData('worlds', world as never) })
  for (const table of ['campaigns', 'entities', 'maps', 'pins', 'sessions', 'boards', 'sounds', 'reputation'] as const) {
    const rows = await tableOf(table).where({ worldId }).toArray()
    for (const r of rows) out.push({ table, id: r.id as string, data: toData(table, r) })
  }
  for (const a of await db.assets.where({ worldId }).toArray())
    out.push({ table: 'assets', id: a.id, data: toData('assets', a as never), blob: a.blob })
  return out
}

const storagePath = (worldId: string, assetId: string) => `${worldId}/${assetId}`

/** Rows this device just uploaded (when, and what), so their Realtime echoes don't trigger another sync. */
const justPushed = new Map<string, { at: number; sig: string }>()
/** What a row's upload looked like, to tell its echo from another device's change to the same row. */
const signature = (data: unknown, deleted: boolean) => (deleted ? 'deleted' : fingerprint(data))

// ---------- pull / push ----------

/** Each pull re-reads the last minute too: a save that began before the last pull but finished after it would otherwise be missed. */
const OVERLAP_MS = 60_000
/** Raised to make every device read its synced worlds from the start once. v2: earlier pulls could skip rows. */
const PULL_VERSION = 2
/**
 * Files that failed to download, and how often; a file is retried on later pulls a few times, then
 * left until the app next opens (it's remembered in syncMeta as DOWNLOAD_FAILED, and counted in the
 * sync message so it isn't silently missing).
 */
const downloadTries = new Map<string, number>()
export const DOWNLOAD_FAILED = 'download'

/** Things deleted on another device that a pull removed here, so they can go in the bin. */
type Removed = Parameters<typeof binRemovedElsewhere>[1]
const BINNED = new Set<string>(['campaigns', 'sessions', 'assets', 'boards', 'sounds', 'maps', 'pins'])

type Pulled = { table_name: SyncedTable; id: string; data: Record<string, unknown> | null; deleted: boolean; updated_at: string }

/** Files being fetched in the background after a world was downloaded: pulls leave them alone. */
const fetchingLater = new Set<string>()

/**
 * Pulls a world's changes. With `later`, files this device has no copy of yet aren't downloaded
 * here but collected in it, so the world can open first (see downloadCloudWorld).
 */
async function pullWorld(worldId: string, later?: Pulled[]) {
  const removed: Removed = []
  const world = await db.worlds.get(worldId)
  const last = (world?.cloud?.pullVersion ?? 1) >= PULL_VERSION ? world?.cloud?.lastPulledAt : undefined
  // The cloud gives times to the microsecond, which some browsers can't read: keep milliseconds.
  const lastMs = last ? Date.parse(last.replace(/(\.\d{3})\d+/, '$1')) : NaN
  const since = Number.isNaN(lastMs) ? '1970-01-01T00:00:00Z' : new Date(lastMs - OVERLAP_MS).toISOString()
  let newest = last ?? since
  let retryFrom: string | undefined
  // Rows saved together share a time, so pages are ordered by time, then kind and id, and each page
  // carries on from the exact row the last one ended at.
  let after: { at: string; table: string; id: string } | undefined
  for (;;) {
    let query = supabase.from('records').select('table_name, id, data, deleted, updated_at').eq('world_id', worldId).gte('updated_at', since)
    if (after) {
      const at = `"${after.at}"`
      query = query.or(
        `updated_at.gt.${at},and(updated_at.eq.${at},table_name.gt."${after.table}"),and(updated_at.eq.${at},table_name.eq."${after.table}",id.gt."${after.id}")`,
      )
    }
    const { data, error } = await query.order('updated_at').order('table_name').order('id').limit(500)
    if (error) throw error
    if (!data.length) break
    for (const rec of data as Pulled[]) {
      const key = metaKey(rec.table_name, rec.id)
      // A file left for later (or already on its way) holds the pull back to it, so it isn't skipped for good.
      const leave = rec.table_name === 'assets' && !!rec.data && !rec.deleted && (fetchingLater.has(key) || (!!later && !(await db.assets.get(rec.id))))
      if (leave && !fetchingLater.has(key)) later?.push(rec)
      const ok = leave || (await applyRemote(worldId, rec.table_name, rec.id, rec.data, rec.deleted, removed))
      if (leave && (!retryFrom || rec.updated_at < retryFrom)) retryFrom = rec.updated_at
      if (!ok) {
        const tries = (downloadTries.get(key) ?? 0) + 1
        downloadTries.set(key, tries)
        if (tries < 5) {
          if (!retryFrom || rec.updated_at < retryFrom) retryFrom = rec.updated_at
        }
        // Given up for now. With no copy here at all, remember it, so it's counted and tried again next time.
        else if (!(await tableOf(rec.table_name).get(rec.id))) await db.syncMeta.put({ key, worldId, hash: '', deleted: true, failed: DOWNLOAD_FAILED })
      }
      after = { at: rec.updated_at, table: rec.table_name, id: rec.id }
      if (rec.updated_at > newest) newest = rec.updated_at
    }
    if (data.length < 500) break
  }
  if (removed.length) await binRemovedElsewhere(worldId, removed)
  // A file that couldn't be fetched holds the next pull back to it, so it's tried again.
  const pulledTo = retryFrom ?? newest
  const latest = await db.worlds.get(worldId)
  // Only while still syncing: if the GM stopped syncing (or deleted the cloud copy) meanwhile, it stays off.
  if (latest?.cloud?.enabled && (latest.cloud.lastPulledAt !== pulledTo || latest.cloud.pullVersion !== PULL_VERSION))
    await db.worlds.update(worldId, { cloud: { ...latest.cloud, lastPulledAt: pulledTo, pullVersion: PULL_VERSION } })
}

/** Files this device gave up downloading: tried once more each time the app opens (and syncs this world). */
const retriedMissing = new Set<string>()
async function retryMissing(worldId: string) {
  if (retriedMissing.has(worldId)) return
  retriedMissing.add(worldId)
  const keys = (await db.syncMeta.where({ worldId }).filter((m) => m.failed === DOWNLOAD_FAILED).toArray()).map((m) => m.key)
  const ids = keys.filter((k) => k.startsWith('assets:')).map((k) => k.slice('assets:'.length))
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('records').select('table_name, id, data, deleted').eq('world_id', worldId).eq('table_name', 'assets').in('id', ids.slice(i, i + 100))
    if (error) throw error
    for (const rec of data as { id: string; data: Record<string, unknown> | null; deleted: boolean }[]) {
      downloadTries.delete(metaKey('assets', rec.id))
      await applyRemote(worldId, 'assets', rec.id, rec.data, rec.deleted)
    }
  }
}

const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b)

type Item = Record<string, unknown> & { id: string }
/** A list whose entries all have their own (different) ids, so it can be merged entry by entry. */
const idList = (v: unknown): v is Item[] =>
  Array.isArray(v) && v.every((x) => !!x && typeof x === 'object' && typeof (x as Item).id === 'string') && new Set(v.map((x) => (x as Item).id)).size === v.length

/**
 * Merges a list changed on both devices entry by entry (by id): an entry added on either side is
 * kept, one deleted on one side and untouched on the other goes, and an entry changed on both
 * sides keeps this device's version (a clash). One side's deletion never wins over the other's edit.
 * The order follows whichever side reordered it (this device's, when both did).
 */
export function mergeList(base: Item[], mine: Item[], theirs: Item[]) {
  const B = new Map(base.map((x) => [x.id, x]))
  const M = new Map(mine.map((x) => [x.id, x]))
  const T = new Map(theirs.map((x) => [x.id, x]))
  let clash = false
  const pick = (id: string) => {
    const b = B.get(id)
    const m = M.get(id)
    const t = T.get(id)
    if (same(m, b)) return t
    if (same(t, b) || same(m, t)) return m
    // Changed on both sides. A deletion on one side gives way to the other side's edit.
    if (!m || !t) return m ?? t
    clash = true
    return m
  }
  // Start from the side that reordered, then slot the other side's new entries in after the entry they followed there.
  const order = (xs: Item[], keep: Map<string, Item>) => xs.filter((x) => B.has(x.id) && keep.has(x.id)).map((x) => x.id)
  const moved = (xs: Item[], map: Map<string, Item>) => !same(order(xs, map), order(base, map))
  const [lead, other] = moved(mine, M) || !moved(theirs, T) ? [mine, theirs] : [theirs, mine]
  const ids = lead.map((x) => x.id)
  other.forEach((x, i) => {
    if (ids.includes(x.id)) return
    const after = i ? ids.indexOf(other[i - 1].id) : -1
    ids.splice(after + 1, 0, x.id)
  })
  const list = ids.flatMap((id) => {
    const v = pick(id)
    return v ? [v] : []
  })
  return { list, clash }
}

/**
 * Parts of a row that are merged piece by piece rather than whole when both devices changed them:
 * a session's prep (its opening, scenes, clues and encounters) and a corkboard's cards and strings.
 */
const BY_PIECE: Partial<Record<SyncedTable, string[]>> = { sessions: ['prep'], boards: ['cards', 'strings'] }

/** Merges one part changed on both devices, where it can be: lists entry by entry, the prep sheet part by part. */
function mergePart(base: unknown, mine: unknown, theirs: unknown): { value: unknown; clash: boolean } {
  if (same(mine, base)) return { value: theirs, clash: false }
  if (same(theirs, base) || same(mine, theirs)) return { value: mine, clash: false }
  if (idList(base) && idList(mine) && idList(theirs)) {
    const { list, clash } = mergeList(base, mine, theirs)
    return { value: list, clash }
  }
  const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  if (plain(base) && plain(mine) && plain(theirs)) {
    const out: Record<string, unknown> = {}
    let clash = false
    for (const k of new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)])) {
      const m = mergePart(base[k], mine[k], theirs[k])
      clash ||= m.clash
      if (m.value !== undefined) out[k] = m.value
    }
    return { value: out, clash }
  }
  return { value: mine, clash: true }
}

/**
 * Merges a row changed both here and on another device since they last agreed (base): each part
 * (field) takes this device's value if it changed here, and the other device's otherwise. Where
 * both changed the same part, a session's prep and a board's cards are merged entry by entry;
 * anything else keeps this device's value. Returns the merged row, whether both sides changed the
 * same part in a way that couldn't be merged, and which parts those were.
 */
export function mergeRows(base: Record<string, unknown>, mine: Record<string, unknown>, theirs: Record<string, unknown>, table?: SyncedTable) {
  const merged: Record<string, unknown> = { ...theirs }
  const clashed: string[] = []
  for (const k of new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)])) {
    if (same(mine[k], base[k])) continue
    let value = mine[k]
    // Both sides always move "updatedAt", so that alone isn't a clash.
    if (k !== 'updatedAt' && !same(theirs[k], base[k]) && !same(theirs[k], mine[k])) {
      if (table && BY_PIECE[table]?.includes(k)) {
        const m = mergePart(base[k], mine[k], theirs[k])
        value = m.value
        if (m.clash) clashed.push(k)
      } else clashed.push(k)
    }
    if (value === undefined) delete merged[k]
    else merged[k] = value
  }
  return { merged, clash: clashed.length > 0, clashed }
}

/** Parts that change all the time while playing (dice, turn order): a clash there isn't worth keeping. */
const PASSING = new Set(['lectern', 'updatedAt'])
/** Parts of a session, board or world in plain words, for the sync note. */
const PART_NAMES: Record<string, string> = {
  notes: 'notes',
  prep: 'prep',
  recap: 'recap',
  cards: 'cards',
  strings: 'strings',
  highlights: 'highlights',
  gmScreen: 'GM screen',
  calendar: 'calendar',
}
/** Clashes this sync kept the other version of, per world, for the sync note. */
const keptTheirs = new Map<string, string[]>()

/**
 * Both devices changed the same part of a session, board or the world's settings: this device's
 * version is kept (and sent), and the other device's version of those parts goes in Recently
 * deleted, as "changed on another device", so the GM can look at it and bring it back.
 */
async function keepTheirs(worldId: string, table: SyncedTable, theirs: Record<string, unknown>, clashed: string[]) {
  const parts = clashed.filter((k) => !PASSING.has(k))
  if (!parts.length || (table !== 'sessions' && table !== 'boards' && table !== 'worlds')) return
  const name =
    table === 'sessions'
      ? `#${theirs.number ?? ''} ${theirs.title ?? ''}`.trim()
      : table === 'worlds'
        ? `${theirs.name ?? 'The world'}’s settings`
        : String(theirs.name ?? 'A corkboard')
  const label = `${name} (${parts.map((k) => PART_NAMES[k] ?? k).join(', ')})`
  await db.bin.add({ id: newId(), worldId, at: Date.now(), kind: 'conflict', label, rows: [{ table, rows: [theirs] }], fields: parts })
  keptTheirs.set(worldId, [...(keptTheirs.get(worldId) ?? []), label])
}

/**
 * Applies one row from the cloud. Returns false when its file couldn't be downloaded (try again later).
 * Rows it removes because they were deleted elsewhere are added to `removed`, for the bin.
 */
async function applyRemote(
  worldId: string,
  table: SyncedTable,
  id: string,
  data: Record<string, unknown> | null,
  deleted: boolean,
  removed?: Removed,
): Promise<boolean> {
  // A kind of row this version of the app doesn't know about: skip it rather than fail the whole sync.
  if (!SYNCED_TABLES.includes(table)) return true
  const key = metaKey(table, id)
  const meta = await db.syncMeta.get(key)
  const local = await tableOf(table).get(id)
  const localHash = local ? fingerprint(toData(table, local)) : undefined
  const remoteHash = deleted || !data ? undefined : fingerprint(data)

  // A file this device couldn't download has since been deleted: it's no longer missing.
  if (meta?.failed === DOWNLOAD_FAILED && !remoteHash) {
    await db.syncMeta.put({ key, worldId, hash: '', deleted: true })
    return true
  }

  // Nothing new for this device.
  if (remoteHash && remoteHash === localHash) {
    if (meta?.hash !== remoteHash || !meta.base) await db.syncMeta.put({ key, worldId, hash: remoteHash, base: data! })
    return true
  }
  // Already seen (pulls overlap a little): nothing to do.
  if (meta && (remoteHash ? meta.hash === remoteHash : meta.deleted)) return true
  // Edited here since the last sync.
  const dirty = local ? !meta || meta.deleted || meta.hash !== localHash : !!meta && !meta.deleted
  if (dirty) {
    // Changed on both devices: keep both sets of changes where they touch different parts. Files
    // aren't merged (this device's copy wins, as before). The merged row is pushed next.
    if (local && data && remoteHash && meta?.base && table !== 'assets') {
      const { merged, clash, clashed } = mergeRows(meta.base, toData(table, local), data, table)
      // Where both changed the same part this device's edit wins; keep the other version to go back to
      // (a page's in its History, anything else in Recently deleted).
      if (clash && table === 'entities') await keepVersion({ ...(data as unknown as Entity) }, 'conflict')
      else if (clash) await keepTheirs(worldId, table, data, clashed)
      if (table === 'worlds') await db.worlds.put({ ...(merged as unknown as World), cloud: (local as unknown as World).cloud, shared: (local as unknown as World).shared })
      else await tableOf(table).put(merged)
      await db.syncMeta.put({ key, worldId, hash: remoteHash, base: data })
    }
    // Deleted here but changed on another device: this device's delete wins, but keep their version
    // of a page in its history, so "Recently deleted" brings back the newer one.
    if (!local && data && table === 'entities') await keepVersion({ ...(data as unknown as Entity) }, 'deleted')
    return true
  }
  // Keep this device's copy of a page before another device's change replaces it.
  if (table === 'entities' && local) await keepVersion(local as unknown as Entity, deleted || !data ? 'deleted' : 'synced')

  if (deleted || !data) {
    if (local) {
      if (BINNED.has(table)) removed?.push({ table: table as Removed[number]['table'], row: local })
      await tableOf(table).delete(id)
    }
    await db.syncMeta.put({ key, worldId, hash: '', deleted: true })
    return true
  }
  if (table === 'assets') {
    // Only the details changed (a new name or tags): keep the file already here instead of downloading it again.
    const have = local as unknown as Asset | undefined
    if (have?.blob && have.size === data.size && have.updatedAt === data.updatedAt) {
      await db.assets.put({ ...(data as unknown as Asset), blob: have.blob })
    } else {
      const { data: file, error } = await supabase.storage.from('assets').download(storagePath(worldId, id))
      if (error || !file) return false
      await db.assets.put({ ...(data as unknown as Asset), blob: file })
    }
  } else if (table === 'worlds') {
    // Never switches sync back on: a world row only arrives for a world that's syncing (or being downloaded).
    await db.worlds.put({ ...(data as unknown as World), cloud: (local as unknown as World | undefined)?.cloud })
  } else {
    await tableOf(table).put(data)
  }
  await db.syncMeta.put({ key, worldId, hash: remoteHash!, base: data })
  return true
}

/**
 * The part of a row that can reach players (roughly what `player_view` sends), or undefined when
 * they get none of it. Comparing it before and after a push tells whether players need to refresh:
 * GM-only pages, notes, prep and the Lectern change often and shouldn't make every player reload.
 */
function playerPart(table: string, data: Record<string, unknown> | null | undefined): unknown {
  if (!data) return undefined
  const without = (...keys: string[]) => Object.fromEntries(Object.entries(data).filter(([k]) => !keys.includes(k)))
  switch (table) {
    case 'worlds':
      return without('updatedAt')
    case 'campaigns':
      return data.visibility === 'gm' ? undefined : data
    case 'entities':
      if (data.visibility !== 'players' && !(data.revealedTo as unknown[] | undefined)?.length) return undefined
      return without('gmNotes', 'gmTags', 'aliases', 'updatedAt')
    case 'maps':
      return data.visibility === 'players' ? without('drawing', 'updatedAt') : undefined
    case 'pins':
      return data.visibility === 'players' ? data : undefined
    case 'reputation': {
      // Keep in step with what player_view sends of it (20261103000003_reputation.sql).
      const known = (list: unknown) => ((list as { known?: boolean }[] | undefined) ?? []).filter((x) => x.known)
      return { of: data.of, reach: data.reach, lean: data.lean, levels: data.levels, notes: known(data.notes), history: known(data.history) }
    }
    case 'sessions': {
      if (data.visibility !== 'players') return undefined
      // Keep in step with the session fields player_view sends (supabase/migrations): change both together.
      const { campaignId, number, title, date, worldDate, recap, entityIds, highlights } = data
      return { campaignId, number, title, date, worldDate, recap, entityIds, highlights }
    }
    default:
      return undefined
  }
}
const playersCare = (table: string, before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) =>
  stableStringify(playerPart(table, before)) !== stableStringify(playerPart(table, after))

/** Pictures players can receive: ones marked for players, plus those used by something they can see (map pictures are redrawn in place). */
function picturesForPlayers(rows: Row[]) {
  const ids = new Set<string>()
  const add = (id: unknown) => typeof id === 'string' && ids.add(id)
  const inText = (text: unknown) => typeof text === 'string' && [...text.matchAll(/asset:([0-9a-fA-F-]{36})/g)].forEach((m) => ids.add(m[1]))
  for (const { table, id, data: d } of rows) {
    if (table === 'assets' && d.visibility === 'players') ids.add(id)
    if (table === 'worlds') {
      add(d.coverId)
      add((d.showing as { assetId?: string } | null)?.assetId)
      ;((d.handouts as { assetId?: string }[] | undefined) ?? []).forEach((h) => add(h.assetId))
    }
    if (table === 'maps' && d.visibility === 'players') {
      add(d.imageId)
      add(d.playerImageId)
      add((d.fog as { imageId?: string } | undefined)?.imageId)
    }
    if (table === 'entities' && playerPart(table, d)) {
      add(d.imageId)
      inText(d.body)
      inText(d.playerBody)
    }
    if (table === 'sessions' && d.visibility === 'players') inText(d.recap)
    if (table === 'pins' && d.visibility === 'players') inText(d.note)
  }
  return ids
}

type Upsert = { world_id: string; table_name: string; id: string; data: unknown; deleted: boolean }
/** One row to send, with what to remember once it's in the cloud. */
interface Send {
  upsert: Upsert
  meta: SyncMeta
  /** What to call it in a message, e.g. a page's name. */
  label: string
}
interface FileSend extends Send {
  blob: Blob
  /** A map picture players get as it is now: sent before the map rows (see pushWorld). */
  first: boolean
}

/** The map pictures players get once these rows are in the cloud (the players' copy or fogged one where there is one). */
function mapFacesForPlayers(rows: Row[]) {
  const ids = new Set<string>()
  for (const { table, data: d } of rows) {
    if (table !== 'maps' || d.visibility !== 'players') continue
    const fog = d.fog as { on?: boolean; imageId?: string } | undefined
    const id = fog?.on ? fog.imageId : (d.playerImageId as string | undefined) || (d.imageId as string | undefined)
    if (id) ids.add(id)
  }
  return ids
}

const labelOf = (table: string, data: Record<string, unknown> | undefined, id: string) =>
  (typeof data?.name === 'string' && data.name) || (typeof data?.title === 'string' && data.title) || `${table.replace(/s$/, '')} ${id.slice(0, 8)}`

/** Thrown when the GM stops syncing a world while it's being sent, so the rest isn't sent. */
class Stopped extends Error {}
async function stillSyncing(worldId: string) {
  if (closing.has(worldId) || !(await db.worlds.get(worldId))?.cloud?.enabled) throw new Stopped()
}

/** Whether a page reaches players it didn't before: revealed to everyone, or to someone new by name. */
function newlyRevealed(before: Record<string, unknown> | undefined, after: Record<string, unknown>) {
  if (after.visibility === 'players' && before?.visibility !== 'players') return true
  const had = new Set((before?.revealedTo as string[] | undefined) ?? [])
  return ((after.revealedTo as string[] | undefined) ?? []).some((id) => !had.has(id))
}

/** Set while a reveal is held back: syncs again as soon as no Undo note is on screen. */
let stopWaitingForUndo: (() => void) | undefined
function syncWhenUndoGone() {
  if (stopWaitingForUndo) return
  stopWaitingForUndo = onToastChange(() => {
    if (undoShowing()) return
    stopWaitingForUndo?.()
    stopWaitingForUndo = undefined
    schedule(200)
  })
}

/** Works out what changed on this device since the last sync. */
async function planPush(worldId: string) {
  // Sync's own notes first, then the rows: if another tab changes a row in between, the row just
  // looks edited here and is sent again, rather than an old copy going over a newer one.
  const metas = new Map((await db.syncMeta.where({ worldId }).toArray()).map((m) => [m.key, m]))
  const rows = await localRows(worldId)
  const records: Send[] = []
  const files: FileSend[] = []
  /** Files that couldn't upload before and haven't changed since. */
  const failed: string[] = []
  let forPlayers = false
  let pictures: Set<string> | undefined
  const pictureForPlayers = (id: string) => (pictures ??= picturesForPlayers(rows)).has(id)
  const faces = mapFacesForPlayers(rows)
  // Session recordings are big, so new ones stay on the device that made them (their transcripts
  // sync with the session). Ones uploaded before this rule keep syncing as they were.
  const recordings = new Set((await db.sessions.where({ worldId }).toArray()).flatMap((x) => x.recordings.map((r) => r.assetId)))
  // A page just revealed waits while an Undo note is up, so Undo takes it back before any player
  // gets it; it goes once the note has gone. A page put on players' screens goes at once: the table is waiting.
  const holding = undoShowing()
  const onScreen = holding ? (await db.worlds.get(worldId))?.showing?.entityId : undefined

  for (const r of rows) {
    const key = metaKey(r.table, r.id)
    const hash = fingerprint(r.data)
    // A file that arrived from the cloud between the two reads above (see fetchLater) has its note by now.
    const meta = metas.get(key) ?? (r.table === 'assets' ? await db.syncMeta.get(key) : undefined)
    metas.delete(key)
    if (meta && !meta.deleted && meta.hash === hash) continue
    if (holding && r.table === 'entities' && r.id !== onScreen && newlyRevealed(meta && !meta.deleted ? meta.base : undefined, r.data)) {
      syncWhenUndoGone()
      continue
    }
    if (meta?.failed && meta.hash === hash) {
      failed.push(`${labelOf(r.table, r.data, r.id)} (${meta.failed})`)
      continue
    }
    if (r.table === 'assets' && recordings.has(r.id) && (!meta || meta.deleted || meta.failed)) continue
    const send: Send = {
      upsert: { world_id: worldId, table_name: r.table, id: r.id, data: r.data, deleted: false },
      meta: { key, worldId, hash, base: r.data },
      label: labelOf(r.table, r.data, r.id),
    }
    // A row synced before this device kept its last version can't be compared, so count it.
    if (!forPlayers)
      forPlayers =
        r.table === 'assets'
          ? pictureForPlayers(r.id) || meta?.base?.visibility === 'players'
          : meta && !meta.deleted && !meta.base
            ? true
            : playersCare(r.table, meta?.deleted ? undefined : meta?.base, r.data)
    // The file itself goes up only when it's new or changed: renaming or tagging it just sends its details.
    const base = meta && !meta.deleted && !meta.failed ? meta.base : undefined
    if (r.table === 'assets' && r.blob && (!base || base.size !== r.data.size || base.updatedAt !== r.data.updatedAt))
      files.push({ ...send, blob: r.blob, first: faces.has(r.id) })
    else records.push(send)
  }
  // Anything synced before but gone now was deleted on this device.
  let missing = 0
  for (const meta of metas.values()) {
    if (meta.failed === DOWNLOAD_FAILED) missing++
    if (meta.deleted) continue
    const [table, ...rest] = meta.key.split(':')
    const id = rest.join(':')
    records.push({
      upsert: { world_id: worldId, table_name: table, id, data: null, deleted: true },
      meta: { key: meta.key, worldId, hash: '', deleted: true },
      label: labelOf(table, meta.base, id),
    })
    if (!forPlayers) forPlayers = !meta.base || (table === 'assets' ? meta.base.visibility === 'players' : playersCare(table, meta.base, undefined))
  }
  return { records, files, failed, missing, forPlayers }
}

/** Remembers rows just sent, so their Realtime echoes are recognised. */
function pushed(upserts: Upsert[]) {
  const now = Date.now()
  for (const [k, t] of justPushed) if (now - t.at > 15_000) justPushed.delete(k)
  for (const u of upserts) justPushed.set(metaKey(u.table_name, u.id), { at: now, sig: signature(u.data, u.deleted) })
}

/** A file upload error in plain words. */
const uploadProblem = (message: string) =>
  /maximum allowed size|too large|payload|413/i.test(message) ? 'too big: the free plan allows 50 MB per file' : cloudErrorMessage(new Error(message))

/**
 * Uploads files, each followed straight away by its row, and remembers each one as soon as it's in
 * (so a sync that fails part way doesn't upload them all again). Returns the files that couldn't upload.
 */
async function sendFiles(worldId: string, files: FileSend[]) {
  const failures: string[] = []
  for (const f of files) {
    await stillSyncing(worldId)
    const { error } = await supabase.storage
      .from('assets')
      .upload(storagePath(worldId, f.upsert.id), f.blob, { upsert: true, contentType: (f.upsert.data as Asset).mime || 'application/octet-stream' })
    if (error) {
      const why = uploadProblem(error.message)
      failures.push(`${f.label} (${why})`)
      await db.syncMeta.put({ key: f.meta.key, worldId, hash: f.meta.hash, failed: why })
      continue
    }
    const { error: rowError } = await supabase.from('records').upsert(f.upsert, { onConflict: 'table_name,id' })
    if (rowError) throw new Error(`“${f.label}” couldn’t be saved to the cloud: ${cloudErrorMessage(rowError)}`)
    await db.syncMeta.put(f.meta)
    pushed([f.upsert])
  }
  return failures
}

/** Sends rows in chunks, remembering each chunk once it's in. A chunk the cloud refuses is sent a row at a time, to name the row at fault. */
async function sendRecords(worldId: string, records: Send[]) {
  for (let i = 0; i < records.length; i += 200) {
    await stillSyncing(worldId)
    const chunk = records.slice(i, i + 200)
    const gone = chunk.filter((r) => r.upsert.table_name === 'assets' && r.upsert.deleted).map((r) => storagePath(worldId, r.upsert.id))
    if (gone.length) await supabase.storage.from('assets').remove(gone)
    const { error } = await supabase.from('records').upsert(
      chunk.map((r) => r.upsert),
      { onConflict: 'table_name,id' },
    )
    if (error) {
      if (chunk.length === 1) throw new Error(`“${chunk[0].label}” couldn’t be saved to the cloud: ${cloudErrorMessage(error)}`)
      for (const r of chunk) await sendRecords(worldId, [r])
      continue
    }
    await db.syncMeta.bulkPut(chunk.map((r) => r.meta))
    pushed(chunk.map((r) => r.upsert))
  }
}

/**
 * Kinds of row the cloud only takes once a newer server update is in (the reputation table, from
 * 20261103000003_reputation.sql). Until then the cloud refuses them: they stay on this device and are
 * tried again on the next sync, and the rest of the world syncs as usual.
 */
const NEWER = new Set(['reputation'])
async function sendNewer(worldId: string, records: Send[]) {
  if (!records.length) return
  try {
    await sendRecords(worldId, records)
  } catch (e) {
    if (e instanceof Stopped || !/records_table_name_check|violates check constraint/i.test(String((e as Error)?.message))) throw e
  }
}

/**
 * Uploads everything that changed on this device. Says how many rows were sent, whether any of them
 * can reach players, and which files are missing from the cloud or from this device.
 *
 * Order matters: map pictures players get go up first, then the rows, then other files. Rows go
 * before big files so another device's edit made during a long upload isn't overwritten by an older
 * copy, and a map's picture never changes in place while the cloud still tells players it's theirs
 * (adding the first secret to a shown map, say).
 */
async function pushWorld(worldId: string): Promise<{ sent: number; forPlayers: boolean; failed: string[]; missing: number }> {
  let plan = await planPush(worldId)
  const forPlayers = plan.forPlayers
  const started = Date.now()
  const firsts = plan.files.filter((f) => f.first)
  const failures = await sendFiles(worldId, firsts)
  let sent = firsts.length
  if (firsts.length && Date.now() - started > 2000) {
    // That took a while: catch up with changes made elsewhere meanwhile, so they're merged rather than sent over.
    await quietly(() => pullWorld(worldId))
    plan = await planPush(worldId)
    const more = plan.files.filter((f) => f.first)
    failures.push(...(await sendFiles(worldId, more)))
    sent += more.length
  }
  await sendRecords(worldId, plan.records.filter((r) => !NEWER.has(r.upsert.table_name)))
  await sendNewer(worldId, plan.records.filter((r) => NEWER.has(r.upsert.table_name)))
  const later = plan.files.filter((f) => !f.first)
  failures.push(...(await sendFiles(worldId, later)))
  sent += plan.records.length + later.length
  // Keep the name shown in "your cloud" lists up to date.
  const worldRow = plan.records.find((r) => r.upsert.table_name === 'worlds' && !r.upsert.deleted)
  if (worldRow) await supabase.from('cloud_worlds').update({ name: (worldRow.upsert.data as World).name }).eq('id', worldId)
  return { sent, forPlayers: forPlayers || plan.forPlayers, failed: [...new Set([...plan.failed, ...failures])], missing: plan.missing }
}

// ---------- engine ----------

/** The sync in progress, if any: one at a time, and a world download waits its turn too. */
let running: Promise<void> | undefined
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
let poll: ReturnType<typeof setInterval> | undefined
const channels = new Map<string, RealtimeChannel>()
let stopMutationListener: (() => void) | undefined
let suppress = 0
/** Worlds being switched off or deleted from the cloud right now: left out of syncing meanwhile. */
const closing = new Set<string>()
/** Worlds whose cloud copy has been seen to exist since the app opened. */
const confirmed = new Set<string>()
/** After a failed sync it's tried again after these waits, then left to the next edit or check. */
const RETRY_AFTER = [5_000, 30_000, 120_000]
let retries = 0

/** Waits until no sync (or world download) is running. */
async function idle() {
  while (running) await running.catch(() => {})
}

/** Runs fn with sync's own writes not counted as edits. */
async function quietly<T>(fn: () => Promise<T>) {
  suppress++
  try {
    return await fn()
  } finally {
    suppress--
  }
}

/** One tab at a time (a second tab, or the installed app beside a browser tab, waits its turn), where the browser can say. */
function oneTabAtATime<T>(fn: () => Promise<T>): Promise<T> {
  return typeof navigator !== 'undefined' && navigator.locks ? (navigator.locks.request('atlas-sync', fn) as Promise<T>) : fn()
}

/**
 * Whether this world syncs for the account signed in now. A world remembers which account turned
 * sync on for it on this device: someone else signing in here (a player borrowing the laptop, the
 * GM's second account) never syncs it, and so never marks its cloud copy as gone.
 */
const syncsFor = (w: World, userId: string) => !!w.cloud?.enabled && !w.shared && (!w.cloud.by || w.cloud.by === userId)

async function syncedWorldIds(userId: string) {
  return (await db.worlds.toArray()).filter((w) => syncsFor(w, userId) && !w.cloud!.gone && !closing.has(w.id)).map((w) => w.id)
}

/** The account the last sync ran for, and the "cloud copy is gone" worlds checked again since it signed in. */
let syncedFor: string | undefined
const recheckedGone = new Set<string>()

/**
 * Worlds whose cloud copy looked gone are looked for again once each time someone signs in (or the
 * account changes): one that's there after all (it was only out of sight to another account, or
 * the GM was invited back) syncs again, without the GM having to do anything.
 */
async function recheckGone(userId: string) {
  for (const w of await db.worlds.toArray()) {
    if (!syncsFor(w, userId) || !w.cloud!.gone || recheckedGone.has(w.id)) continue
    recheckedGone.add(w.id)
    const { data, error } = await supabase.from('cloud_worlds').select('id').eq('id', w.id).maybeSingle()
    if (error || !data) continue
    const now = await db.worlds.get(w.id)
    if (now?.cloud?.enabled) await db.worlds.update(w.id, { cloud: { ...now.cloud, gone: undefined, by: userId } })
    confirmed.add(w.id)
  }
}

/**
 * Whether this world's cloud copy is still there (checked once after the app opens, and again after
 * a problem). When it was deleted on another device, or this GM was removed from it, sync stops for
 * the world and its settings ask what to do, instead of saying "Synced" and then failing on every edit.
 */
async function cloudCopyThere(worldId: string, userId: string) {
  if (confirmed.has(worldId)) return true
  const { data, error } = await supabase.from('cloud_worlds').select('id').eq('id', worldId).maybeSingle()
  if (error) throw error
  if (data) {
    confirmed.add(worldId)
    // A world that synced before worlds remembered their account: it's this one's.
    const w = await db.worlds.get(worldId)
    if (w?.cloud?.enabled && !w.cloud.by) await db.worlds.update(worldId, { cloud: { ...w.cloud, by: userId } })
    return true
  }
  const w = await db.worlds.get(worldId)
  if (w?.cloud?.enabled) await db.worlds.update(worldId, { cloud: { ...w.cloud, gone: true } })
  return false
}

/** Runs one full sync of every opted-in world. Calls made while one is running are merged into one more run. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = oneTabAtATime(syncAll).finally(() => {
    running = undefined
    if (again) {
      again = false
      schedule(500)
    }
  })
  return running
}

async function syncAll() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    syncedFor = undefined
    return setState({ status: 'off' })
  }
  if (!navigator.onLine) return setState({ status: 'offline' })
  const userId = data.session.user.id
  // Signed in again, or as someone else: what was seen of the cloud before doesn't count.
  if (userId !== syncedFor) {
    syncedFor = userId
    confirmed.clear()
    recheckedGone.clear()
  }
  setState({ status: 'syncing' })
  try {
    await recheckGone(userId)
    const ids = await syncedWorldIds(userId)
    await subscribeRealtime(ids)
    // One world failing doesn't stop the others.
    const problems: string[] = []
    const notes: string[] = []
    for (const id of ids) {
      const name = (await db.worlds.get(id))?.name ?? 'A world'
      try {
        if (!(await cloudCopyThere(id, userId))) continue
        await quietly(async () => {
          await pullWorld(id)
          await retryMissing(id)
        })
        const { forPlayers, failed, missing } = await pushWorld(id)
        // Players only refresh when something they can see changed. Telling them doesn't hold up the next world.
        if (forPlayers) void notifyShareViewers(id).catch(() => {})
        if (failed.length) notes.push(`“${name}”: some files couldn’t upload, so other devices and players don’t get them: ${failed.join('; ')}.`)
        const clashes = keptTheirs.get(id)
        keptTheirs.delete(id)
        if (clashes?.length)
          notes.push(
            `“${name}”: ${clashes.join('; ')} ${clashes.length === 1 ? 'was' : 'were'} changed here and on another device at the same time. This device’s version was kept; the other is in More → Recently deleted, marked “changed on another device”, if you want it back.`,
          )
        if (missing) notes.push(`“${name}”: ${missing === 1 ? 'one file' : `${missing} files`} couldn’t be downloaded to this device; ${missing === 1 ? 'it’s' : 'they’re'} tried again next time the app opens.`)
      } catch (err) {
        if (err instanceof Stopped) continue
        confirmed.delete(id)
        problems.push(`“${name}”: ${cloudErrorMessage(err)}`)
      }
    }
    const gone = (await db.worlds.toArray()).filter((w) => syncsFor(w, userId) && w.cloud!.gone)
    for (const w of gone) notes.push(`“${w.name}”: its cloud copy is gone (deleted on another device, or you’re no longer its GM). Open its Cloud settings to decide what to do.`)
    if (problems.length) throw new Error(problems.join(' '))
    retries = 0
    // Problems that don't stop syncing stay on show until they're sorted, rather than "Synced" hiding them.
    setState({ status: 'idle', lastSync: Date.now(), message: notes.length ? notes.join(' ') : undefined })
  } catch (err) {
    const online = navigator.onLine
    setState({ status: online ? 'error' : 'offline', message: cloudErrorMessage(err) })
    // A hiccup (the server waking up, say) is tried again soon, a few times, before waiting for the next edit or check.
    if (online && retries < RETRY_AFTER.length) schedule(RETRY_AFTER[retries++])
  }
}

export function schedule(delay = EDIT_DELAY) {
  clearTimeout(timer)
  timer = setTimeout(syncNow, delay)
}

async function subscribeRealtime(worldIds: string[]) {
  for (const [id, ch] of channels)
    if (!worldIds.includes(id)) {
      supabase.removeChannel(ch)
      channels.delete(id)
    }
  for (const id of worldIds) {
    if (channels.has(id)) continue
    const ch = supabase
      .channel(`records:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `world_id=eq.${id}` }, (payload) => {
        // Our own uploads come straight back; only changes from another device or a co-GM need a pull.
        // The echo is recognised by what it holds, so a co-GM's quick edit to the same row still comes through.
        const row = payload.new as { table_name?: string; id?: string; data?: unknown; deleted?: boolean } | undefined
        const mine = row?.table_name && justPushed.get(metaKey(row.table_name, row.id ?? ''))
        if (mine && Date.now() - mine.at < 15_000 && mine.sig === signature(row.data ?? null, !!row.deleted)) return
        schedule(800)
      })
      .subscribe()
    channels.set(id, ch)
  }
}

/** Tells anyone viewing this world's share link, and any players who joined it, to refresh. */
async function notifyShareViewers(worldId: string) {
  const { data } = await supabase.from('cloud_worlds').select('share_token').eq('id', worldId).maybeSingle()
  const token = data?.share_token as string | undefined
  const names = [`members:${worldId}`, ...(token ? [`share:${token}`] : [])]
  await Promise.all(names.map(broadcastChanged))
}

/** Tells the players who joined a world to refresh their copy (after the GM answers a question, say). */
export const tellPlayers = (worldId: string) => broadcastChanged(`members:${worldId}`)

async function broadcastChanged(name: string) {
  // Never wait more than a few seconds: a lost connection must not hold up syncing.
  await sendOnce(name, 'changed')
}

/** Starts background syncing. Safe to call more than once. */
export function startSync() {
  if (!stopMutationListener) {
    // Any local change to a synced table schedules a sync, except the writes sync itself makes while
    // pulling. (Device-only tables, like a recording being saved as it goes, don't.)
    const onChange = (parts: Record<string, unknown>) => {
      if (suppress) return
      const tables = Object.keys(parts ?? {}).map((k) => k.split('/')[3])
      if (!tables.length || tables.some((t) => !t || (SYNCED_TABLES as readonly string[]).includes(t))) schedule()
    }
    Dexie.on('storagemutated', onChange)
    stopMutationListener = () => Dexie.on('storagemutated').unsubscribe(onChange)
    window.addEventListener('online', () => schedule(200))
    window.addEventListener('offline', () => setState({ status: 'offline' }))
    poll = setInterval(() => !document.hidden && schedule(0), POLL_EVERY)
    // Catch up straight away when the app comes back to the front.
    document.addEventListener('visibilitychange', () => !document.hidden && schedule(200))
  }
  schedule(200)
}

export function stopSync() {
  stopMutationListener?.()
  stopMutationListener = undefined
  clearInterval(poll)
  clearTimeout(timer)
  for (const ch of channels.values()) supabase.removeChannel(ch)
  channels.clear()
  setState({ status: 'off' })
}

// ---------- opting worlds in and out ----------

/**
 * Turns sync on (or back on) for a world on this device. The owner (or someone making its first
 * cloud copy) creates or renames the cloud copy; a co-GM turning sync back on leaves the owner's
 * copy as it is (only its owner may change it) and just starts syncing again.
 */
export async function enableCloud(worldId: string) {
  const world = await db.worlds.get(worldId)
  if (!world) throw new Error('World not found')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Sign in first, then turn sync on.')
  const { data: row, error: readError } = await supabase.from('cloud_worlds').select('id, owner').eq('id', worldId).maybeSingle()
  if (readError) throw readError
  if (!row) {
    const { error } = await supabase.from('cloud_worlds').insert({ id: worldId, name: world.name })
    if (error)
      throw new Error(
        error.code === '23505' || /duplicate|row-level security/i.test(error.message)
          ? 'This world’s cloud copy belongs to another account, and you’re not one of its GMs. Ask its owner to invite you as a co-GM, then try again.'
          : cloudErrorMessage(error),
      )
  } else if (row.owner === auth.user.id) {
    const { error } = await supabase.from('cloud_worlds').update({ name: world.name }).eq('id', worldId)
    if (error) throw error
  }
  // A brand-new (or emptied) cloud copy gets everything, not just what changed since the last sync.
  const { count } = await supabase.from('records').select('id', { count: 'exact', head: true }).eq('world_id', worldId)
  if (!count) await db.syncMeta.where({ worldId }).delete()
  await db.worlds.update(worldId, { cloud: { enabled: true, by: auth.user.id } })
  confirmed.add(worldId)
  await syncNow()
}

/**
 * Whether turning sync on would send this device's copy over a cloud copy it has never synced with
 * (or has forgotten): then every row here looks like an edit, and would replace newer changes made on
 * other devices. Worth a warning first.
 */
export async function wouldOverwriteCloud(worldId: string) {
  const { count, error } = await supabase.from('records').select('id', { count: 'exact', head: true }).eq('world_id', worldId)
  if (error || !count) return false
  return (await db.syncMeta.where({ worldId }).count()) === 0
}

/**
 * Stops syncing this world on this device. What was last synced is remembered, so turning it back
 * on picks up deletes and changes made elsewhere instead of pushing every old row back up. A sync
 * already running stops sending this world, and is waited for, so it can't switch syncing back on.
 */
export async function disableCloud(worldId: string, forget = false) {
  closing.add(worldId)
  try {
    await db.worlds.update(worldId, { cloud: undefined })
    await idle()
    if (forget) await db.syncMeta.where({ worldId }).delete()
    const ch = channels.get(worldId)
    if (ch) {
      supabase.removeChannel(ch)
      channels.delete(worldId)
    }
  } finally {
    closing.delete(worldId)
    confirmed.delete(worldId)
  }
}

/** Removes the cloud copy (and its share link) entirely. Local data on this device is kept. */
export async function deleteCloudCopy(worldId: string) {
  // No sync sends this world while its files are being removed (it would leave files behind).
  closing.add(worldId)
  try {
    await idle()
    // Files are listed a thousand at a time; keep going until none are left (or nothing more can be removed).
    for (let round = 0; round < 100; round++) {
      const { data: files, error } = await supabase.storage.from('assets').list(worldId, { limit: 1000 })
      if (error) throw error
      if (!files?.length) break
      const { error: removeError } = await supabase.storage.from('assets').remove(files.map((f) => `${worldId}/${f.name}`))
      if (removeError) throw removeError
    }
    const { error } = await supabase.from('cloud_worlds').delete().eq('id', worldId)
    if (error) throw error
    await disableCloud(worldId, true)
  } finally {
    closing.delete(worldId)
  }
}

/**
 * Deletes the signed-in person's account: the cloud copy and files of every world they own, then
 * the account itself (which also removes their memberships, claimed characters, notes and
 * questions in other people's worlds). Worlds saved on this device are kept.
 */
export async function deleteMyAccount() {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')
  const { data: owned, error } = await supabase.from('cloud_worlds').select('id').eq('owner', auth.user.id)
  if (error) throw error
  for (const w of owned ?? []) await deleteCloudCopy(w.id)
  const { error: deleteError } = await supabase.rpc('delete_my_account')
  if (deleteError) throw deleteError
  await supabase.auth.signOut({ scope: 'local' })
}

export interface CloudWorld {
  id: string
  name: string
  share_token: string | null
  updated_at: string
}

export async function listCloudWorlds(): Promise<CloudWorld[]> {
  // Worlds you own or are a co-GM of: worlds you joined as a player are opened as read-only copies instead.
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const [own, gm] = await Promise.all([
    supabase.from('cloud_worlds').select('id, name, share_token, updated_at').eq('owner', auth.user.id),
    supabase.from('world_members').select('world_id, cloud_worlds(id, name, share_token, updated_at)').eq('user_id', auth.user.id).eq('role', 'gm'),
  ])
  if (own.error) throw own.error
  const coGm = ((gm.data ?? []) as unknown as { cloud_worlds: CloudWorld | null }[]).flatMap((r) => (r.cloud_worlds ? [r.cloud_worlds] : []))
  return [...(own.data as CloudWorld[]), ...coGm].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

/** Brings a cloud world onto this device (e.g. a second computer or a tablet). */
export async function downloadCloudWorld(cw: CloudWorld) {
  // Counts as a sync, so a sync started meanwhile waits for it instead of downloading every file a second time.
  await idle()
  // The pages come first, so the world opens; its files follow in the background.
  const later: Pulled[] = []
  const by = (await supabase.auth.getSession()).data.session?.user.id
  const job = oneTabAtATime(async () => {
    if (!(await db.worlds.get(cw.id))) {
      const now = Date.now()
      // Placeholder until the real world row arrives in the first pull. Marking it as already synced
      // lets the cloud version replace it instead of being treated as a local edit.
      const placeholder: World = { id: cw.id, name: cw.name, description: '', system: 'System agnostic', createdAt: now, updatedAt: now, cloud: { enabled: true, by } }
      await db.worlds.add(placeholder)
      await db.syncMeta.put({ key: metaKey('worlds', cw.id), worldId: cw.id, hash: fingerprint(toData('worlds', placeholder as never)) })
    } else {
      await db.worlds.update(cw.id, { cloud: { enabled: true, by } })
    }
    confirmed.add(cw.id)
    await quietly(() => pullWorld(cw.id, later))
    for (const rec of later) fetchingLater.add(metaKey('assets', rec.id))
  })
  running = job.finally(() => {
    running = undefined
  })
  await running
  void fetchLater(cw.id, later)
  schedule(200)
}

/** Downloads a newly arrived world's files, pictures first and recordings last, while it's open. */
async function fetchLater(worldId: string, files: Pulled[]) {
  const rank = (r: Pulled) => (/^(audio|video)\//.test(String(r.data?.mime ?? '')) ? 1 : 0)
  try {
    await loadInBackground(worldId, 'downloading', [...files].sort((a, b) => rank(a) - rank(b)), async (rec) => {
      const key = metaKey('assets', rec.id)
      try {
        const { data: file, error } = await supabase.storage.from('assets').download(storagePath(worldId, rec.id))
        // One that fails is fetched again by the next sync.
        if (error || !file || !rec.data) return
        // The file and its sync record are saved together, so a sync running meanwhile never takes
        // it for a new upload; only these writes are kept from counting as edits.
        const kept = await quietly(() =>
          db.transaction('rw', [db.worlds, db.assets, db.syncMeta], async () => {
            if (!(await db.worlds.get(worldId))) return false
            // Already here, or deleted on another device while it waited.
            if ((await db.assets.get(rec.id)) || (await db.syncMeta.get(key))?.deleted) return true
            await db.assets.put({ ...(rec.data as unknown as Asset), blob: file })
            await db.syncMeta.put({ key, worldId, hash: fingerprint(rec.data!), base: rec.data! })
            return true
          }),
        )
        // The world was deleted meanwhile.
        if (!kept) return false
      } catch {
        // Fetched again by the next sync.
      } finally {
        fetchingLater.delete(key)
      }
    })
  } finally {
    for (const rec of files) fetchingLater.delete(metaKey('assets', rec.id))
    schedule(200)
  }
}
