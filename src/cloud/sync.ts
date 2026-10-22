import Dexie from 'dexie'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { db, type Asset, type SyncMeta, type World } from '../db'
import { supabase } from './client'

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
 */

export const SYNCED_TABLES = ['worlds', 'campaigns', 'entities', 'maps', 'pins', 'sessions', 'assets'] as const
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
  for (const table of ['campaigns', 'entities', 'maps', 'pins', 'sessions'] as const) {
    const rows = await tableOf(table).where({ worldId }).toArray()
    for (const r of rows) out.push({ table, id: r.id as string, data: toData(table, r) })
  }
  for (const a of await db.assets.where({ worldId }).toArray())
    out.push({ table: 'assets', id: a.id, data: toData('assets', a as never), blob: a.blob })
  return out
}

const storagePath = (worldId: string, assetId: string) => `${worldId}/${assetId}`

// ---------- pull / push ----------

async function pullWorld(worldId: string) {
  const world = await db.worlds.get(worldId)
  let since = world?.cloud?.lastPulledAt ?? '1970-01-01T00:00:00Z'
  for (;;) {
    const { data, error } = await supabase
      .from('records')
      .select('table_name, id, data, deleted, updated_at')
      .eq('world_id', worldId)
      .gt('updated_at', since)
      .order('updated_at', { ascending: true })
      .limit(500)
    if (error) throw error
    if (!data.length) break
    for (const rec of data as { table_name: SyncedTable; id: string; data: Record<string, unknown> | null; deleted: boolean; updated_at: string }[]) {
      await applyRemote(worldId, rec.table_name, rec.id, rec.data, rec.deleted)
      since = rec.updated_at
    }
    if (data.length < 500) break
  }
  const latest = await db.worlds.get(worldId)
  if (latest && latest.cloud?.lastPulledAt !== since) await db.worlds.update(worldId, { cloud: { enabled: true, ...latest.cloud, lastPulledAt: since } })
}

async function applyRemote(worldId: string, table: SyncedTable, id: string, data: Record<string, unknown> | null, deleted: boolean) {
  const key = metaKey(table, id)
  const meta = await db.syncMeta.get(key)
  const local = await tableOf(table).get(id)
  const localHash = local ? fingerprint(toData(table, local)) : undefined
  const remoteHash = deleted || !data ? undefined : fingerprint(data)

  // Nothing new for this device.
  if (remoteHash && remoteHash === localHash) {
    await db.syncMeta.put({ key, worldId, hash: remoteHash })
    return
  }
  // Edited here since the last sync: keep this device's version; it will be pushed next.
  const dirty = local ? !meta || meta.deleted || meta.hash !== localHash : !!meta && !meta.deleted
  if (dirty) return

  if (deleted || !data) {
    if (local) await tableOf(table).delete(id)
    await db.syncMeta.put({ key, worldId, hash: '', deleted: true })
    return
  }
  if (table === 'assets') {
    const { data: file, error } = await supabase.storage.from('assets').download(storagePath(worldId, id))
    if (error || !file) return // file not uploaded yet; try again next pull
    await db.assets.put({ ...(data as unknown as Asset), blob: file })
  } else if (table === 'worlds') {
    await db.worlds.put({ ...(data as unknown as World), cloud: (local as unknown as World | undefined)?.cloud ?? { enabled: true } })
  } else {
    await tableOf(table).put(data)
  }
  await db.syncMeta.put({ key, worldId, hash: remoteHash! })
}

/** Uploads everything that changed on this device. Returns how many rows were sent. */
async function pushWorld(worldId: string): Promise<number> {
  const rows = await localRows(worldId)
  const metas = new Map((await db.syncMeta.where({ worldId }).toArray()).map((m) => [m.key, m]))
  const upserts: { world_id: string; table_name: string; id: string; data: unknown; deleted: boolean }[] = []
  const newMetas: SyncMeta[] = []
  const failures: string[] = []

  for (const r of rows) {
    const key = metaKey(r.table, r.id)
    const hash = fingerprint(r.data)
    const meta = metas.get(key)
    metas.delete(key)
    if (meta && !meta.deleted && meta.hash === hash) continue
    if (meta?.failed && meta.hash === hash) continue
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
    newMetas.push({ key, worldId, hash })
  }
  // Anything synced before but gone now was deleted on this device.
  for (const meta of metas.values()) {
    if (meta.deleted) continue
    const [table, ...rest] = meta.key.split(':')
    const id = rest.join(':')
    if (table === 'assets') await supabase.storage.from('assets').remove([storagePath(worldId, id)])
    upserts.push({ world_id: worldId, table_name: table, id, data: null, deleted: true })
    newMetas.push({ key: meta.key, worldId, hash: '', deleted: true })
  }
  // Parents before children doesn't matter (no foreign keys between records), so send in chunks.
  for (let i = 0; i < upserts.length; i += 200) {
    const { error } = await supabase.from('records').upsert(upserts.slice(i, i + 200), { onConflict: 'table_name,id' })
    if (error) throw error
  }
  await db.syncMeta.bulkPut(newMetas)
  // Keep the name shown in "your cloud" lists up to date.
  const worldRow = upserts.find((u) => u.table_name === 'worlds' && !u.deleted)
  if (worldRow) await supabase.from('cloud_worlds').update({ name: (worldRow.data as World).name }).eq('id', worldId)
  if (failures.length) setState({ message: `Some files couldn't upload (free plan limit is 50 MB per file): ${failures.join('; ')}` })
  return upserts.length
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
    for (const id of ids) {
      suppress++
      try {
        await pullWorld(id)
      } finally {
        suppress--
      }
      const sent = await pushWorld(id)
      if (sent) await notifyShareViewers(id)
    }
    setState({ status: 'idle', lastSync: Date.now() })
  } catch (err) {
    setState({ status: navigator.onLine ? 'error' : 'offline', message: (err as Error).message })
  } finally {
    running = false
    if (again) {
      again = false
      schedule(500)
    }
  }
}

export function schedule(delay = 1500) {
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `world_id=eq.${id}` }, () => schedule(800))
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

async function broadcastChanged(name: string) {
  const ch = supabase.channel(name)
  await new Promise<void>((resolve) => {
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'changed', payload: {} }).finally(() => resolve())
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve()
    })
  })
  supabase.removeChannel(ch)
}

/** Starts background syncing. Safe to call more than once. */
export function startSync() {
  if (!stopMutationListener) {
    // Any local change schedules a sync, except the writes sync itself makes while pulling.
    const onChange = () => {
      if (!suppress) schedule()
    }
    Dexie.on('storagemutated', onChange)
    stopMutationListener = () => Dexie.on('storagemutated').unsubscribe(onChange)
    window.addEventListener('online', () => schedule(200))
    window.addEventListener('offline', () => setState({ status: 'offline' }))
    poll = setInterval(() => schedule(0), 60_000)
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
  await db.worlds.update(worldId, { cloud: { enabled: true } })
  await syncNow()
}

export async function disableCloud(worldId: string) {
  await db.worlds.update(worldId, { cloud: undefined })
  await db.syncMeta.where({ worldId }).delete()
  const ch = channels.get(worldId)
  if (ch) {
    supabase.removeChannel(ch)
    channels.delete(worldId)
  }
}

/** Removes the cloud copy (and its share link) entirely. Local data on this device is kept. */
export async function deleteCloudCopy(worldId: string) {
  const { data: files } = await supabase.storage.from('assets').list(worldId, { limit: 1000 })
  if (files?.length) await supabase.storage.from('assets').remove(files.map((f) => `${worldId}/${f.name}`))
  const { error } = await supabase.from('cloud_worlds').delete().eq('id', worldId)
  if (error) throw error
  await disableCloud(worldId)
}

export interface CloudWorld {
  id: string
  name: string
  share_token: string | null
  updated_at: string
}

export async function listCloudWorlds(): Promise<CloudWorld[]> {
  // Only your own worlds: worlds you joined as a player are opened as read-only copies instead.
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('cloud_worlds')
    .select('id, name, share_token, updated_at')
    .eq('owner', auth.user.id)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as CloudWorld[]
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
