import { db, type Asset, type Campaign, type Entity, type Pin, type Session, type SharedInfo, type World, type WorldMap } from '../db'
import { appLink, supabase, SUPABASE_URL } from './client'
import { stableStringify } from './sync'

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

export const shareUrl = (token: string) => appLink(`/shared/${token}`)

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
  return storePlayerCopy(data as SharedPayload, sharedWorldId(token), `@${token.slice(0, 8)}`, { token }, (ids) => downloadFiles({ token }, ids))
}

/**
 * Downloads a world's player-safe files. The server is asked once for links to all of them (one
 * check of what players may see), then each comes straight from storage. One request per file
 * is the fallback if that fails.
 */
export async function downloadFiles(from: { token: string } | { world: string }, ids: string[], access?: string): Promise<Map<string, Blob>> {
  const files = new Map<string, Blob>()
  if (!ids.length) return files
  const endpoint = `${SUPABASE_URL}/functions/v1/shared-asset`
  const headers: Record<string, string> = access ? { Authorization: `Bearer ${access}` } : {}
  let urls: Record<string, string> | undefined
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...from, ids }) })
    if (res.ok) urls = ((await res.json()) as { urls?: Record<string, string> }).urls
  } catch {
    // Older server or a blip: fetch one at a time below.
  }
  const query = 'token' in from ? `token=${encodeURIComponent(from.token)}` : `world=${encodeURIComponent(from.world)}`
  await Promise.all(
    ids.map(async (id) => {
      const one = () => fetch(`${endpoint}?${query}&id=${encodeURIComponent(id)}`, { headers })
      try {
        // A link that didn't come back or doesn't work falls back to asking for the file itself.
        let res = urls?.[id] ? await fetch(urls[id]).catch(() => undefined) : undefined
        if (!res?.ok) res = await one()
        if (res.ok) files.set(id, await res.blob())
      } catch {
        // Skipped files are tried again on the next refresh.
      }
    }),
  )
  return files
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
  download: (assetIds: string[]) => Promise<Map<string, Blob>>,
) {
  const id = (x: string) => x + suffix
  const opt = (x?: string | null) => (x ? id(x) : undefined)

  // Nothing changed for players (the GM only edited their own notes, say): keep the copy as it is,
  // so pictures and pages on screen don't reload.
  const { updatedAt: _u, ...content } = p as SharedPayload & { updatedAt?: string }
  const hash = await digest(stableStringify({ content, info }))
  const before = await db.worlds.get(worldId)
  if (before?.shared?.hash === hash && (await db.assets.where({ worldId }).count()) === p.assets.length) {
    await db.worlds.update(worldId, { shared: { ...before.shared, fetchedAt: Date.now() } })
    return worldId
  }

  // Download only files that are new or changed since the last refresh.
  const existing = new Map((await db.assets.where({ worldId }).toArray()).map((a) => [a.id, a]))
  const unchanged = (a: Omit<Asset, 'blob'>) => {
    const have = existing.get(id(a.id))
    return have && have.size === a.size && have.updatedAt === a.updatedAt ? have : undefined
  }
  const fresh = await download(p.assets.filter((a) => !unchanged(a)).map((a) => a.id))
  const assets: Asset[] = p.assets.flatMap((a) => {
    const have = unchanged(a)
    const blob = have?.blob ?? fresh.get(a.id)
    return blob ? [{ ...a, id: id(a.id), worldId, blob } as Asset] : []
  })
  const now = Date.now()
  const claims = info.claims?.map((c) => ({ ...c, entityId: id(c.entityId) }))
  const notes = info.notes?.map((n) => ({ ...n, entityId: n.entityId ? id(n.entityId) : '' }))
  const questions = info.questions?.map((q) => ({ ...q, entityId: q.entityId ? id(q.entityId) : '' }))

  // What's new since the last refresh: pages and sessions revealed, and questions answered. The
  // first time a world arrives everything is new, so nothing is flagged.
  let news = before?.shared?.news
  if (before) {
    const hadPages = new Set(await db.entities.where({ worldId }).primaryKeys())
    const hadSessions = new Set(await db.sessions.where({ worldId }).primaryKeys())
    const wasAnswered = new Set((before.shared?.questions ?? []).filter((q) => q.answer).map((q) => q.id))
    const pageIds = p.entities.map((e) => id(e.id))
    const sessionIds = p.sessions.map((s) => id(s.id))
    const questionIds = (questions ?? []).map((q) => q.id)
    const keep = (old: string[] | undefined, now: string[], fresh: string[]) => [...new Set([...(old ?? []).filter((x) => now.includes(x)), ...fresh])]
    news = {
      entityIds: keep(news?.entityIds, pageIds, pageIds.filter((x) => !hadPages.has(x))),
      sessionIds: keep(news?.sessionIds, sessionIds, sessionIds.filter((x) => !hadSessions.has(x))),
      questionIds: keep(news?.questionIds, questionIds, (questions ?? []).filter((q) => q.answer && !wasAnswered.has(q.id)).map((q) => q.id)),
    }
    if (!news.entityIds.length && !news.sessionIds.length && !news.questionIds.length) news = undefined
  }

  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets], async () => {
    for (const t of [db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets] as const) await t.where({ worldId }).delete()
    const showing = p.world?.showing
    await db.worlds.put({
      ...(p.world ?? { name: 'Shared world', description: '', system: '', createdAt: now }),
      showing: showing ? { ...showing, assetId: opt(showing.assetId), entityId: opt(showing.entityId) } : null,
      handouts: p.world?.handouts?.map((h) => ({ ...h, assetId: opt(h.assetId), entityId: opt(h.entityId) })),
      id: worldId,
      updatedAt: now,
      cloud: undefined,
      shared: { ...info, claims, notes, questions, news, fetchedAt: now, hash: assets.length === p.assets.length ? hash : undefined },
    } as World)
    await db.assets.bulkPut(assets)
    await db.campaigns.bulkPut(p.campaigns.map((c) => ({ ...c, id: id(c.id), worldId })))
    await db.entities.bulkPut(
      p.entities.map((e) => ({ ...e, id: id(e.id), worldId, parentId: opt(e.parentId), imageId: opt(e.imageId), raisedIn: opt(e.raisedIn), campaignId: opt(e.campaignId), tiedOffIn: opt(e.tiedOffIn), heldBy: e.heldBy === 'party' ? 'party' : opt(e.heldBy), relations: e.relations?.map((r) => ({ ...r, to: id(r.to) })), gmNotes: '' })),
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

/** A short fingerprint of a long text. */
async function digest(text: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return btoa(String.fromCharCode(...bytes))
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

/** Live channels are private to the world: only its GM and players (or holders of a wiki link) can use them. */
export const liveChannel = (name: string) => supabase.channel(name, { config: { private: true } })

/** Players refresh at most this often while the GM is busy editing; the first change still arrives at once. */
const REFRESH_GAP = 30_000

/**
 * Keeps a read-only copy fresh while it's open: a refresh when the GM syncs, plus a slow poll.
 * A burst of changes becomes one refresh now and one more at the end, so nothing is missed and
 * players don't re-download the world every few seconds while the GM types.
 */
export function watchPlayerCopy(info: SharedInfo, onError?: (e: Error) => void) {
  let busy = false
  let pending = false
  let last = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = async () => {
    if (!navigator.onLine) return
    if (busy) {
      pending = true
      return
    }
    busy = true
    last = Date.now()
    try {
      await refreshPlayerCopy(info)
    } catch (e) {
      onError?.(e as Error)
    } finally {
      busy = false
      if (pending) {
        pending = false
        refresh()
      }
    }
  }
  // A tab nobody is looking at doesn't download anything; it catches up when it's opened again.
  let missed = false
  const refresh = () => {
    if (document.hidden) {
      missed = true
      return
    }
    if (timer) return
    const wait = Math.max(0, last + REFRESH_GAP - Date.now())
    timer = setTimeout(() => {
      timer = undefined
      run()
    }, wait)
  }
  const name = info.token ? `share:${info.token}` : `members:${info.memberOf}`
  const ch = liveChannel(name).on('broadcast', { event: 'changed' }, refresh).subscribe()
  openChannels.set(name, ch)
  // The GM's broadcast is the main signal; this slow check only covers a missed one, and skips hidden tabs.
  const poll = setInterval(() => !document.hidden && refresh(), 5 * 60_000)
  const onVisible = () => {
    if (document.hidden || !(missed || Date.now() - last > 5 * 60_000)) return
    missed = false
    refresh()
  }
  window.addEventListener('online', refresh)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearTimeout(timer)
    openChannels.delete(name)
    supabase.removeChannel(ch)
    clearInterval(poll)
    window.removeEventListener('online', refresh)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
