import Dexie from 'dexie'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { db, keepVersion, type Asset, type Entity, type SyncMeta, type World } from '../db'
import { sendOnce } from './live'
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

export const SYNCED_TABLES = ['worlds', 'campaigns', 'entities', 'maps', 'pins', 'sessions', 'assets', 'boards', 'sounds'] as const
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

/** The parts of a row that are uploaded: device-only fields and file contents are left out. */
function toData(table: SyncedTable, row: Record<string, unknown>): Record<string, unknown> {
  if (table === 'worlds') {
    const { cloud: _c, shared: _s, ...rest } = row as unknown as World
    return rest as unknown as Record<string, unknown>
  }
  if (table === 'assets') {
    const { blob: _b, ...rest } = row as unknown as Asset
    return rest as unknown as Record<string, unknown>
  }
  return row
}

const tableOf = (t: SyncedTable) => db[t] as unknown as Dexie.Table<Record<string, unknown>, string>

async function localRows(worldId: string): Promise<Row[]> {
  const out: Row[] = []
  const world = await db.worlds.get(worldId)
  if (world) out.push({ table: 'worlds', id: world.id, data: toData('worlds', world as never) })
  for (const table of ['campaigns', 'entities', 'maps', 'pins', 'sessions', 'boards', 'sounds'] as const) {
    const rows = await tableOf(table).where({ worldId }).toArray()
    for (const r of rows) out.push({ table, id: r.id as string, data: toData(table, r) })
  }
  for (const a of await db.assets.where({ worldId }).toArray())
    out.push({ table: 'assets', id: a.id, data: toData('assets', a as never), blob: a.blob })
  return out
}

const storagePath = (worldId: string, assetId: string) => `${worldId}/${assetId}`

/** Rows this device just uploaded, so their Realtime echoes don't trigger another sync. */
const justPushed = new Map<string, number>()

// ---------- pull / push ----------

/** Each pull re-reads the last minute too: a save that began before the last pull but finished after it would otherwise be missed. */
const OVERLAP_MS = 60_000
/** Raised to make every device read its synced worlds from the start once. v2: earlier pulls could skip rows. */
const PULL_VERSION = 2
/** Files that failed to download, and how often; a file is retried on later pulls a few times, then left. */
const downloadTries = new Map<string, number>()

async function pullWorld(worldId: string) {
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
    for (const rec of data as { table_name: SyncedTable; id: string; data: Record<string, unknown> | null; deleted: boolean; updated_at: string }[]) {
      const ok = await applyRemote(worldId, rec.table_name, rec.id, rec.data, rec.deleted)
      if (!ok) {
        const key = metaKey(rec.table_name, rec.id)
        const tries = (downloadTries.get(key) ?? 0) + 1
        downloadTries.set(key, tries)
        if (tries < 5 && (!retryFrom || rec.updated_at < retryFrom)) retryFrom = rec.updated_at
      }
      after = { at: rec.updated_at, table: rec.table_name, id: rec.id }
      if (rec.updated_at > newest) newest = rec.updated_at
    }
    if (data.length < 500) break
  }
  // A file that couldn't be fetched holds the next pull back to it, so it's tried again.
  const pulledTo = retryFrom ?? newest
  const latest = await db.worlds.get(worldId)
  if (latest && (latest.cloud?.lastPulledAt !== pulledTo || latest.cloud?.pullVersion !== PULL_VERSION))
    await db.worlds.update(worldId, { cloud: { enabled: true, ...latest.cloud, lastPulledAt: pulledTo, pullVersion: PULL_VERSION } })
}

/**
 * Merges a row changed both here and on another device since they last agreed (base): each part
 * (field) takes this device's value if it changed here, and the other device's otherwise.
 * Returns the merged row, and whether both sides changed the same part.
 */
export function mergeRows(base: Record<string, unknown>, mine: Record<string, unknown>, theirs: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...theirs }
  let clash = false
  for (const k of new Set([...Object.keys(base), ...Object.keys(mine), ...Object.keys(theirs)])) {
    const mineChanged = stableStringify(mine[k]) !== stableStringify(base[k])
    if (!mineChanged) continue
    // Both sides always move "updatedAt", so that alone isn't a clash.
    if (k !== 'updatedAt' && stableStringify(theirs[k]) !== stableStringify(base[k]) && stableStringify(theirs[k]) !== stableStringify(mine[k])) clash = true
    if (mine[k] === undefined) delete merged[k]
    else merged[k] = mine[k]
  }
  return { merged, clash }
}

/** Applies one row from the cloud. Returns false when its file couldn't be downloaded (try again later). */
async function applyRemote(worldId: string, table: SyncedTable, id: string, data: Record<string, unknown> | null, deleted: boolean): Promise<boolean> {
  // A kind of row this version of the app doesn't know about: skip it rather than fail the whole sync.
  if (!SYNCED_TABLES.includes(table)) return true
  const key = metaKey(table, id)
  const meta = await db.syncMeta.get(key)
  const local = await tableOf(table).get(id)
  const localHash = local ? fingerprint(toData(table, local)) : undefined
  const remoteHash = deleted || !data ? undefined : fingerprint(data)

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
      const { merged, clash } = mergeRows(meta.base, toData(table, local), data)
      // Where both changed the same part this device's edit wins; keep the other version of a page to go back to.
      if (clash && table === 'entities') await keepVersion({ ...(data as unknown as Entity) }, 'conflict')
      if (table === 'worlds') await db.worlds.put({ ...(merged as unknown as World), cloud: (local as unknown as World).cloud, shared: (local as unknown as World).shared })
      else await tableOf(table).put(merged)
      await db.syncMeta.put({ key, worldId, hash: remoteHash, base: data })
    }
    return true
  }
  // Keep this device's copy of a page before another device's change replaces it.
  if (table === 'entities' && local) await keepVersion(local as unknown as Entity, deleted || !data ? 'deleted' : 'synced')

  if (deleted || !data) {
    if (local) await tableOf(table).delete(id)
    await db.syncMeta.put({ key, worldId, hash: '', deleted: true })
    return true
  }
  if (table === 'assets') {
    const { data: file, error } = await supabase.storage.from('assets').download(storagePath(worldId, id))
    if (error || !file) return false
    await db.assets.put({ ...(data as unknown as Asset), blob: file })
  } else if (table === 'worlds') {
    await db.worlds.put({ ...(data as unknown as World), cloud: (local as unknown as World | undefined)?.cloud ?? { enabled: true } })
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
    case 'sessions': {
      if (data.visibility !== 'players') return undefined
      const { campaignId, number, title, date, worldDate, recap, entityIds } = data
      return { campaignId, number, title, date, worldDate, recap, entityIds }
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

/** Uploads everything that changed on this device. Says how many rows were sent, and whether any of them can reach players. */
async function pushWorld(worldId: string): Promise<{ sent: number; forPlayers: boolean }> {
  const rows = await localRows(worldId)
  const metas = new Map((await db.syncMeta.where({ worldId }).toArray()).map((m) => [m.key, m]))
  const upserts: { world_id: string; table_name: string; id: string; data: unknown; deleted: boolean }[] = []
  const newMetas: SyncMeta[] = []
  const failures: string[] = []
  let forPlayers = false
  let pictures: Set<string> | undefined
  const pictureForPlayers = (id: string) => (pictures ??= picturesForPlayers(rows)).has(id)
  // Session recordings are big, so new ones stay on the device that made them (their transcripts
  // sync with the session). Ones uploaded before this rule keep syncing as they were.
  const recordings = new Set((await db.sessions.where({ worldId }).toArray()).flatMap((x) => x.recordings.map((r) => r.assetId)))

  for (const r of rows) {
    const key = metaKey(r.table, r.id)
    const hash = fingerprint(r.data)
    const meta = metas.get(key)
    metas.delete(key)
    if (meta && !meta.deleted && meta.hash === hash) continue
    if (meta?.failed && meta.hash === hash) continue
    if (r.table === 'assets' && recordings.has(r.id) && (!meta || meta.deleted || meta.failed)) continue
    if (r.table === 'assets' && r.blob) {
      const { error } = await supabase.storage
        .from('assets')
        .upload(storagePath(worldId, r.id), r.blob, { upsert: true, contentType: (r.data.mime as string) || 'application/octet-stream' })
      if (error) {
        failures.push(`${r.data.name as string}: ${error.message}`)
        newMetas.push({ key, worldId, hash, failed: error.message })
        continue
      }
    }
    upserts.push({ world_id: worldId, table_name: r.table, id: r.id, data: r.data, deleted: false })
    newMetas.push({ key, worldId, hash, base: r.data })
    // A row synced before this device kept its last version can't be compared, so count it.
    if (!forPlayers)
      forPlayers =
        r.table === 'assets'
          ? pictureForPlayers(r.id) || meta?.base?.visibility === 'players'
          : meta && !meta.deleted && !meta.base
            ? true
            : playersCare(r.table, meta?.deleted ? undefined : meta?.base, r.data)
  }
  // Anything synced before but gone now was deleted on this device.
  for (const meta of metas.values()) {
    if (meta.deleted) continue
    const [table, ...rest] = meta.key.split(':')
    const id = rest.join(':')
    if (table === 'assets') await supabase.storage.from('assets').remove([storagePath(worldId, id)])
    upserts.push({ world_id: worldId, table_name: table, id, data: null, deleted: true })
    newMetas.push({ key: meta.key, worldId, hash: '', deleted: true })
    if (!forPlayers) forPlayers = !meta.base || (table === 'assets' ? meta.base.visibility === 'players' : playersCare(table, meta.base, undefined))
  }
  // Parents before children doesn't matter (no foreign keys between records), so send in chunks.
  for (let i = 0; i < upserts.length; i += 200) {
    const { error } = await supabase.from('records').upsert(upserts.slice(i, i + 200), { onConflict: 'table_name,id' })
    if (error) throw error
  }
  await db.syncMeta.bulkPut(newMetas)
  const now = Date.now()
  for (const [k, t] of justPushed) if (now - t > 15_000) justPushed.delete(k)
  for (const u of upserts) justPushed.set(metaKey(u.table_name, u.id), now)
  // Keep the name shown in "your cloud" lists up to date.
  const worldRow = upserts.find((u) => u.table_name === 'worlds' && !u.deleted)
  if (worldRow) await supabase.from('cloud_worlds').update({ name: (worldRow.data as World).name }).eq('id', worldId)
  if (failures.length) setState({ message: `Some files couldn't upload (free plan limit is 50 MB per file): ${failures.join('; ')}` })
  return { sent: upserts.length, forPlayers }
}

// ---------- engine ----------

let running = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
let poll: ReturnType<typeof setInterval> | undefined
const channels = new Map<string, RealtimeChannel>()
let stopMutationListener: (() => void) | undefined
let suppress = 0

async function syncedWorldIds() {
  return (await db.worlds.toArray()).filter((w) => w.cloud?.enabled && !w.shared).map((w) => w.id)
}

/** Runs one full sync of every opted-in world. Calls made while one is running are merged into one more run. */
export async function syncNow() {
  if (running) {
    again = true
    return
  }
  const { data } = await supabase.auth.getSession()
  if (!data.session) return setState({ status: 'off' })
  if (!navigator.onLine) return setState({ status: 'offline' })
  running = true
  setState({ status: 'syncing' })
  try {
    const ids = await syncedWorldIds()
    await subscribeRealtime(ids)
    // One world failing (say, its cloud copy was deleted elsewhere) doesn't stop the others.
    const problems: string[] = []
    for (const id of ids) {
      try {
        suppress++
        try {
          await pullWorld(id)
        } finally {
          suppress--
        }
        // Players only refresh when something they can see changed.
        const { forPlayers } = await pushWorld(id)
        if (forPlayers) await notifyShareViewers(id)
      } catch (err) {
        const name = (await db.worlds.get(id))?.name ?? 'A world'
        problems.push(`${name}: ${(err as Error).message}`)
      }
    }
    if (problems.length) throw new Error(problems.join('; '))
    setState({ status: 'idle', lastSync: Date.now(), message: undefined })
  } catch (err) {
    setState({ status: navigator.onLine ? 'error' : 'offline', message: cloudErrorMessage(err) })
  } finally {
    running = false
    if (again) {
      again = false
      schedule(500)
    }
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
        const row = payload.new as { table_name?: string; id?: string } | undefined
        const at = row?.table_name && justPushed.get(metaKey(row.table_name, row.id ?? ''))
        if (at && Date.now() - at < 15_000) return
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

export async function enableCloud(worldId: string) {
  const world = await db.worlds.get(worldId)
  if (!world) throw new Error('World not found')
  const { error } = await supabase.from('cloud_worlds').upsert({ id: worldId, name: world.name }, { onConflict: 'id' })
  if (error) throw error
  // A brand-new (or emptied) cloud copy gets everything, not just what changed since the last sync.
  const { count } = await supabase.from('records').select('id', { count: 'exact', head: true }).eq('world_id', worldId)
  if (!count) await db.syncMeta.where({ worldId }).delete()
  await db.worlds.update(worldId, { cloud: { enabled: true } })
  await syncNow()
}

/**
 * Stops syncing this world on this device. What was last synced is remembered, so turning it back
 * on picks up deletes and changes made elsewhere instead of pushing every old row back up.
 */
export async function disableCloud(worldId: string, forget = false) {
  await db.worlds.update(worldId, { cloud: undefined })
  if (forget) await db.syncMeta.where({ worldId }).delete()
  const ch = channels.get(worldId)
  if (ch) {
    supabase.removeChannel(ch)
    channels.delete(worldId)
  }
}

/** Removes the cloud copy (and its share link) entirely. Local data on this device is kept. */
export async function deleteCloudCopy(worldId: string) {
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
  if (!(await db.worlds.get(cw.id))) {
    const now = Date.now()
    // Placeholder until the real world row arrives in the first pull. Marking it as already synced
    // lets the cloud version replace it instead of being treated as a local edit.
    const placeholder: World = { id: cw.id, name: cw.name, description: '', system: 'System agnostic', createdAt: now, updatedAt: now, cloud: { enabled: true } }
    await db.worlds.add(placeholder)
    await db.syncMeta.put({ key: metaKey('worlds', cw.id), worldId: cw.id, hash: fingerprint(toData('worlds', placeholder as never)) })
  } else {
    await db.worlds.update(cw.id, { cloud: { enabled: true } })
  }
  suppress++
  try {
    await pullWorld(cw.id)
  } finally {
    suppress--
  }
  schedule(200)
}
