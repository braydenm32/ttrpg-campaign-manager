import { db, type Asset, type Campaign, type Entity, type Pin, type Session, type SharedInfo, type World, type WorldMap } from '../db'
import { worldLoading } from '../worldLoading'
import { appLink, supabase, SUPABASE_URL } from './client'
import { joinRoom, sendOnce } from './live'
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
  // Those are fetched after the pages are saved, so the world opens straight away (see fetchFiles).
  // A newer refresh takes over from one still fetching.
  const gen = (generation.get(worldId) ?? 0) + 1
  generation.set(worldId, gen)
  worldLoading.clear(worldId)
  const toFetch = p.assets.filter((a) => !unchanged(a))
  const assets: Asset[] = p.assets.flatMap((a) => {
    const have = unchanged(a)
    return have ? [{ ...a, id: id(a.id), worldId, blob: have.blob } as Asset] : []
  })
  const now = Date.now()
  const claims = info.claims?.map((c) => ({ ...c, entityId: id(c.entityId) }))
  const notes = info.notes?.map((n) => ({ ...n, entityId: n.entityId ? id(n.entityId) : '' }))
  const questions = info.questions?.map((q) => ({ ...q, entityId: q.entityId ? id(q.entityId) : '' }))

  // What's new since the last refresh: pages and sessions revealed, and questions answered. The
  // first time a world arrives everything is new, so nothing is flagged.
  let news = before?.shared?.news
  if (before) {
    const oldPages = new Map((await db.entities.where({ worldId }).toArray()).map((e) => [e.id, e]))
    const oldSessions = new Map((await db.sessions.where({ worldId }).toArray()).map((s) => [s.id, s]))
    const hadPages = new Set(oldPages.keys())
    const hadSessions = new Set(oldSessions.keys())
    const wasAnswered = new Set((before.shared?.questions ?? []).filter((q) => q.answer).map((q) => q.id))
    const pageIds = p.entities.map((e) => id(e.id))
    const sessionIds = p.sessions.map((s) => id(s.id))
    const questionIds = (questions ?? []).map((q) => q.id)
    const keep = (old: string[] | undefined, now: string[], fresh: string[]) => [...new Set([...(old ?? []).filter((x) => now.includes(x)), ...fresh])]
    // Pages they already had: what's different now (new writing, a status, a clock that moved…).
    const changed: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(news?.changed ?? {})) if (pageIds.includes(k)) changed[k] = v
    for (const e of p.entities) {
      const was = oldPages.get(id(e.id))
      if (!was) continue
      const what = whatChanged(was, { ...e, heldBy: e.heldBy === 'party' ? 'party' : opt(e.heldBy), imageId: opt(e.imageId) })
      if (what.length) changed[id(e.id)] = [...new Set([...(changed[id(e.id)] ?? []), ...what])]
    }
    const recaps = p.sessions.filter((s) => {
      const was = oldSessions.get(id(s.id))
      return was && s.recap.trim() && was.recap !== s.recap
    })
    const hadHandouts = new Set((before.handouts ?? []).map((h) => h.id))
    const handoutIds = (p.world?.handouts ?? []).map((h) => h.id)
    news = {
      entityIds: keep(news?.entityIds, pageIds, pageIds.filter((x) => !hadPages.has(x))),
      sessionIds: keep(news?.sessionIds, sessionIds, sessionIds.filter((x) => !hadSessions.has(x))),
      questionIds: keep(news?.questionIds, questionIds, (questions ?? []).filter((q) => q.answer && !wasAnswered.has(q.id)).map((q) => q.id)),
      changed,
      recapIds: keep(news?.recapIds, sessionIds, recaps.map((s) => id(s.id))),
      handoutIds: keep(news?.handoutIds, handoutIds, handoutIds.filter((x) => !hadHandouts.has(x))),
    }
    // A page that's new anyway doesn't also need "changed".
    for (const x of news.entityIds) delete changed[x]
    if (!news.entityIds.length && !news.sessionIds.length && !news.questionIds.length && !Object.keys(changed).length && !news.recapIds!.length && !news.handoutIds!.length)
      news = undefined
  }

  // Files are the big part: only ones that are new, changed or gone are written, so a small edit
  // by the GM doesn't rewrite every picture on a phone (and pictures on screen don't reload).
  // A file that changed keeps its old copy until the new one arrives.
  const keepIds = new Set(p.assets.map((a) => id(a.id)))
  const sameFile = (a: Asset) => {
    const have = existing.get(a.id)
    if (!have || have.blob !== a.blob) return false
    const { blob: _h, ...was } = have
    const { blob: _a, ...now } = a
    return stableStringify(was) === stableStringify(now)
  }
  const changedAssets = assets.filter((a) => !sameFile(a))
  const goneAssets = [...existing.keys()].filter((x) => !keepIds.has(x))

  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets], async () => {
    for (const t of [db.campaigns, db.entities, db.maps, db.pins, db.sessions] as const) await t.where({ worldId }).delete()
    await db.assets.bulkDelete(goneAssets)
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
    await db.assets.bulkPut(changedAssets)
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
  if (toFetch.length) void fetchFiles(worldId, gen, toFetch, id, download, hash)
  return worldId
}

/** How many times each player's copy has been stored, so only the newest one goes on fetching its files. */
const generation = new Map<string, number>()

/**
 * Downloads a player's copy's new or changed files a few at a time, saving each batch as it comes,
 * while the world is already open. Files that don't arrive are fetched again on the next refresh.
 */
async function fetchFiles(
  worldId: string,
  gen: number,
  files: Omit<Asset, 'blob'>[],
  id: (x: string) => string,
  download: (ids: string[]) => Promise<Map<string, Blob>>,
  hash: string,
) {
  const current = () => generation.get(worldId) === gen
  // A refresh or two of one or two files isn't worth a note on screen.
  const say = files.length > 2
  let done = 0
  let all = true
  try {
    for (let i = 0; i < files.length; i += 6) {
      if (!current()) return
      if (say) worldLoading.set({ worldId, what: 'downloading', done, total: files.length })
      const batch = files.slice(i, i + 6)
      const blobs = await download(batch.map((a) => a.id))
      // A newer refresh works out for itself what's still missing; a deleted world needs nothing.
      if (!current() || !(await db.worlds.get(worldId))) return
      const got = batch.flatMap((a) => (blobs.has(a.id) ? [{ ...a, id: id(a.id), worldId, blob: blobs.get(a.id)! } as Asset] : []))
      if (got.length < batch.length) all = false
      await db.assets.bulkPut(got)
      done += batch.length
    }
    // Everything arrived: the next refresh with nothing new can skip straight past.
    if (all && current() && (await db.worlds.get(worldId))?.shared) await db.worlds.update(worldId, { 'shared.hash': hash })
  } catch {
    // Offline or a blip: the next refresh fetches what's missing.
  } finally {
    if (say && current()) worldLoading.clear(worldId)
  }
}

/** What a player would notice changed on a page since their last copy, in a few words each. */
function whatChanged(was: Entity, now: Entity): string[] {
  const out: string[] = []
  if (was.name !== now.name) out.push('renamed')
  if (was.body !== now.body || (was.playerBody ?? '') !== (now.playerBody ?? '') || was.summary !== now.summary) out.push('new writing')
  if (JSON.stringify(was.fields) !== JSON.stringify(now.fields)) out.push('details')
  if ((was.status ?? '') !== (now.status ?? '') && now.status) out.push(now.status)
  if (was.questStatus !== now.questStatus && now.questStatus) out.push(`quest ${now.questStatus}`)
  if (was.threadStatus !== now.threadStatus && now.threadStatus) out.push(now.threadStatus)
  const filled = (e: Entity) => (e.clocks ?? []).map((c) => `${c.id}:${c.filled}`).join()
  if (filled(was) !== filled(now)) out.push('clock moved')
  const insp = (now.inspiration ?? 0) - (was.inspiration ?? 0)
  if (insp > 0) out.push('inspiration')
  if ((was.heldBy ?? '') !== (now.heldBy ?? '') && now.heldBy) out.push('changed hands')
  if (was.imageId !== now.imageId && now.imageId) out.push('new picture')
  return out
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

/** Tells everyone else watching a joined world that something changed (a player saved a group note). */
export function tellOtherPlayers(cloudId: string) {
  void sendOnce(`members:${cloudId}`, 'changed')
}

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
  const room = joinRoom(name)
  room.on('changed', refresh)
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
    room.leave()
    clearInterval(poll)
    window.removeEventListener('online', refresh)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
