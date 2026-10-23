import { db, type Asset, type Campaign, type Entity, type Pin, type Session, type SharedInfo, type World, type WorldMap } from '../db'
import { appUrl, supabase, SUPABASE_URL } from './client'

/**
 * Player share links. The GM turns on a link for a synced world; anyone with the link gets a
 * read-only copy of the player-safe parts, filtered on the server by public.shared_world().
 * The copy lives in this device's database like any other world, so it works offline and
 * refreshes itself when the GM changes something.
 */

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const shareUrl = (token: string) => `${appUrl()}#/shared/${token}`

export async function getShareToken(worldId: string): Promise<string | null> {
  const { data, error } = await supabase.from('cloud_worlds').select('share_token').eq('id', worldId).maybeSingle()
  if (error) throw error
  return (data?.share_token as string | null) ?? null
}

/** Creates a new link, replacing any old one (old links stop working). */
export async function createShareLink(worldId: string) {
  const token = newToken()
  const { error } = await supabase.from('cloud_worlds').update({ share_token: token }).eq('id', worldId)
  if (error) throw error
  return token
}

export async function revokeShareLink(worldId: string) {
  const { error } = await supabase.from('cloud_worlds').update({ share_token: null }).eq('id', worldId)
  if (error) throw error
}

export interface SharedPayload {
  worldId: string
  world: World
  campaigns: Campaign[]
  entities: Entity[]
  maps: WorldMap[]
  pins: Pin[]
  sessions: Session[]
  assets: Omit<Asset, 'blob'>[]
}

/** Local id of the read-only copy, kept separate from the GM's own world if both are on one device. */
export const sharedWorldId = (token: string) => `shared-${token}`

/** Fetches the shared world and stores (or refreshes) the read-only copy. Returns the local world id. */
export async function loadSharedWorld(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('shared_world', { token })
  if (error) throw error
  if (!data) throw new Error('This share link has been turned off or replaced. Ask your GM for a new one.')
  const fetchAsset = (assetId: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/shared-asset?token=${encodeURIComponent(token)}&id=${encodeURIComponent(assetId)}`)
  return storePlayerCopy(data as SharedPayload, sharedWorldId(token), `@${token.slice(0, 8)}`, { token }, fetchAsset)
}

/**
 * Stores a player-safe world on this device as a read-only copy. Ids get a suffix so the copy
 * never collides with the GM's own world when both are on one device.
 */
export async function storePlayerCopy(
  p: SharedPayload,
  worldId: string,
  suffix: string,
  info: Omit<SharedInfo, 'fetchedAt'>,
  fetchAsset: (assetId: string) => Promise<Response>,
) {
  const id = (x: string) => x + suffix
  const opt = (x?: string | null) => (x ? id(x) : undefined)

  // Download only files that are new or changed since the last refresh.
  const existing = new Map((await db.assets.where({ worldId }).toArray()).map((a) => [a.id, a]))
  const assets: Asset[] = []
  for (const a of p.assets) {
    const localId = id(a.id)
    const have = existing.get(localId)
    if (have && have.size === a.size && have.updatedAt === a.updatedAt) {
      assets.push({ ...have, ...a, id: localId, worldId })
      continue
    }
    const res = await fetchAsset(a.id)
    if (!res.ok) continue
    assets.push({ ...a, id: localId, worldId, blob: await res.blob() } as Asset)
  }
  const now = Date.now()
  const claims = info.claims?.map((c) => ({ ...c, entityId: id(c.entityId) }))
  const notes = info.notes?.map((n) => ({ ...n, entityId: n.entityId ? id(n.entityId) : '' }))
  const questions = info.questions?.map((q) => ({ ...q, entityId: q.entityId ? id(q.entityId) : '' }))

  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets], async () => {
    for (const t of [db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets] as const) await t.where({ worldId }).delete()
    await db.worlds.put({
      ...(p.world ?? { name: 'Shared world', description: '', system: '', createdAt: now }),
      id: worldId,
      updatedAt: now,
      cloud: undefined,
      shared: { ...info, claims, notes, questions, fetchedAt: now },
    } as World)
    await db.assets.bulkPut(assets)
    await db.campaigns.bulkPut(p.campaigns.map((c) => ({ ...c, id: id(c.id), worldId })))
    await db.entities.bulkPut(
      p.entities.map((e) => ({ ...e, id: id(e.id), worldId, parentId: opt(e.parentId), imageId: opt(e.imageId), raisedIn: opt(e.raisedIn), tiedOffIn: opt(e.tiedOffIn), heldBy: e.heldBy === 'party' ? 'party' : opt(e.heldBy), gmNotes: '' })),
    )
    await db.maps.bulkPut(p.maps.map((m) => ({ ...m, id: id(m.id), worldId, imageId: id(m.imageId), locationId: opt(m.locationId), drawing: undefined })))
    await db.pins.bulkPut(
      p.pins.map((pin) => ({ ...pin, id: id(pin.id), worldId, mapId: id(pin.mapId), entityId: opt(pin.entityId), childMapId: opt(pin.childMapId) })),
    )
    await db.sessions.bulkPut(
      p.sessions.map((s) => ({ ...s, id: id(s.id), worldId, campaignId: id(s.campaignId), entityIds: s.entityIds.map(id), notes: '', recordings: [], lectern: undefined })),
    )
  })
  return worldId
}

/** Re-fetches a read-only copy from wherever it came from. */
export async function refreshPlayerCopy(info: SharedInfo) {
  if (info.token) return loadSharedWorld(info.token)
  if (info.memberOf) {
    const { loadMemberWorld } = await import('./players')
    return loadMemberWorld(info.memberOf)
  }
}

const openChannels = new Map<string, ReturnType<typeof supabase.channel>>()

/** Tells everyone else watching a joined world that something changed (a player saved a group note). */
export function tellOtherPlayers(cloudId: string) {
  openChannels.get(`members:${cloudId}`)?.send({ type: 'broadcast', event: 'changed', payload: {} })
}

/** Keeps a read-only copy fresh while it's open: instant refresh when the GM syncs, plus a slow poll. */
export function watchPlayerCopy(info: SharedInfo, onError?: (e: Error) => void) {
  let busy = false
  const refresh = async () => {
    if (busy || !navigator.onLine) return
    busy = true
    try {
      await refreshPlayerCopy(info)
    } catch (e) {
      onError?.(e as Error)
    } finally {
      busy = false
    }
  }
  const name = info.token ? `share:${info.token}` : `members:${info.memberOf}`
  const ch = supabase.channel(name).on('broadcast', { event: 'changed' }, refresh).subscribe()
  openChannels.set(name, ch)
  // The GM's broadcast is the main signal; this slow check only covers a missed one, and skips hidden tabs.
  const poll = setInterval(() => !document.hidden && refresh(), 5 * 60_000)
  const onVisible = () => !document.hidden && refresh()
  window.addEventListener('online', refresh)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    openChannels.delete(name)
    supabase.removeChannel(ch)
    clearInterval(poll)
    window.removeEventListener('online', refresh)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
