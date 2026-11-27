import { strFromU8 } from 'fflate'
import type { Table } from 'dexie'
import { blankEntity, db, keepVersion, newId, type BinItem, type Entity, type OneShot, type Session, type StartingPoint, type World } from './db'
import { stableStringify, syncNow, tellPlayers } from './cloud/sync'
import { supabase } from './cloud/client'
import { setLiveSession } from './cloud/table'
import { listPlayers, removePlayer, UNNAMED, type Claim, type Member } from './cloud/players'
import { notesFromPlay } from './sessions'
import { BACKUP_ZIP, openZip, ZipError } from './zipSafe'
import { cleanMap, cleanWorld } from './incoming'

/**
 * One-shot mode: a world the GM runs again and again for different tables. Switching it on saves a
 * starting point (a copy of the whole world, on this device: see StartingPoint in db.ts), and
 * "Reset for the next table" puts the world back to it. Because the whole world is copied, every
 * part of play goes back without a list to keep up to date: reveals, fog, clocks, the in-game
 * clock, what's on players' screens, handouts, statuses, loot, quest steps, sessions and their
 * Lectern state. Before resetting, the GM can keep pages they fixed during play (they become part
 * of the starting point), keep a short record of the run on a GM-only "Past runs" page, and (with
 * cloud sync) remove the players, free the characters they claimed and clear their group notes.
 * The setting itself lives in world.gmScreen.oneShot, which public.player_view never sends.
 */

/** The tables a starting point holds besides the world row, each a list of rows with ids. */
const PARTS = ['campaigns', 'entities', 'maps', 'pins', 'sessions', 'boards', 'sounds', 'reputation', 'assets'] as const
type Part = (typeof PARTS)[number]
type Rows = Pick<StartingPoint, Part>

/** The world's one-shot setting, when it's switched on. */
export const oneShotOf = (w?: World | null): OneShot | undefined => (w?.gmScreen?.oneShot?.on ? w.gmScreen.oneShot : undefined)

/** Changes the one-shot setting (kept in gmScreen, so it syncs and never reaches players). */
export async function setOneShot(worldId: string, next: OneShot | undefined) {
  await db.transaction('rw', db.worlds, async () => {
    const w = await db.worlds.get(worldId)
    if (!w) return
    await db.worlds.update(worldId, { gmScreen: { pages: [], rolls: [], ...(w.gmScreen ?? {}), oneShot: next }, updatedAt: Date.now() })
  })
}

const table = (part: Part | 'worlds') => db[part] as unknown as Table<{ id: string }, string>

async function rowsOf(worldId: string): Promise<Rows> {
  const [campaigns, entities, maps, pins, sessions, boards, sounds, reputation, assets] = await Promise.all([
    db.campaigns.where({ worldId }).toArray(),
    db.entities.where({ worldId }).toArray(),
    db.maps.where({ worldId }).toArray(),
    db.pins.where({ worldId }).toArray(),
    db.sessions.where({ worldId }).toArray(),
    db.boards.where({ worldId }).toArray(),
    db.sounds.where({ worldId }).toArray(),
    db.reputation.where({ worldId }).toArray(),
    db.assets.where({ worldId }).toArray(),
  ])
  return { campaigns, entities, maps, pins, sessions, boards, sounds, reputation, assets }
}

/**
 * A starting point leaves session recordings out (they're the run, not the prep, and by far the
 * biggest files), and its sessions point at none, so a reset never leaves a session pointing at
 * audio that isn't there.
 */
function withoutRecordings(rows: Rows): Rows {
  const recorded = new Set(rows.sessions.flatMap((s) => s.recordings.map((r) => r.assetId)))
  return { ...rows, sessions: rows.sessions.map((s) => ({ ...s, recordings: [] })), assets: rows.assets.filter((a) => !recorded.has(a.id)) }
}

const plainWorld = (w: World): World => {
  const { cloud: _cloud, shared: _shared, ...plain } = w
  return plain
}

/** Saves the world as it is now as its starting point on this device (replacing any older one). */
export async function saveStartingPoint(worldId: string) {
  const world = await db.worlds.get(worldId)
  if (!world) throw new Error('World not found')
  const sp: StartingPoint = { worldId, savedAt: Date.now(), world: plainWorld(world), ...withoutRecordings(await rowsOf(worldId)) }
  await db.startingPoints.put(sp)
  return sp
}

/**
 * Uses a backup of this same world as its starting point, for a device where none was saved (the
 * starting point never syncs). The backup must have been downloaded from this world: an imported
 * copy of a world has ids of its own, so a backup of the original doesn't match it.
 */
export async function startingPointFromBackup(worldId: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error('Pick a backup of this world (a .zip file downloaded from Data and backups).')
  let b: Partial<Omit<Rows, 'assets'>> & { format?: string; exportedAt?: string; world?: World; assets?: (Omit<StartingPoint['assets'][number], 'blob'> & { data?: string })[] }
  let zip
  try {
    zip = openZip(bytes, BACKUP_ZIP)
    b = JSON.parse(strFromU8(zip.file('world.json') ?? new Uint8Array()))
  } catch (err) {
    if (err instanceof ZipError) console.warn('Opening the backup:', err.reason)
    throw new Error('This file is damaged, or not a Warded Atlas backup.')
  }
  if (b.format !== 'campaign-codex-world' || !b.world) throw new Error('This file is not a Warded Atlas world backup.')
  if (b.world.id !== worldId)
    throw new Error(
      'That backup is of another world, or of the file this world was imported from (importing gives a world new ids). Use a backup downloaded from this world, in World settings › Data and backups.',
    )
  const recorded = new Set((b.sessions ?? []).flatMap((s) => s.recordings.map((r) => r.assetId)))
  const assets = (b.assets ?? [])
    .filter((a) => !recorded.has(a.id))
    .map(({ data: _data, ...a }) => {
      let data: Uint8Array<ArrayBuffer> | undefined
      try {
        data = zip.file(`files/${a.id}`)
      } catch {
        data = undefined
      }
      return { ...a, worldId, blob: new Blob([data ?? new Uint8Array()], { type: a.mime }) }
    })
  const rows: Rows = {
    campaigns: b.campaigns ?? [],
    entities: b.entities ?? [],
    maps: (b.maps ?? []).map(cleanMap),
    pins: b.pins ?? [],
    sessions: b.sessions ?? [],
    boards: b.boards ?? [],
    sounds: b.sounds ?? [],
    reputation: b.reputation ?? [],
    assets,
  }
  const sp: StartingPoint = { worldId, savedAt: Date.parse(b.exportedAt ?? '') || Date.now(), world: plainWorld(cleanWorld(b.world)), ...withoutRecordings(rows) }
  await db.startingPoints.put(sp)
  return sp
}

/** How much the starting point's copies of the world's files take on this device. */
export const startingPointSize = (sp: StartingPoint) => sp.assets.reduce((n, a) => n + (a.size || 0), 0)

/**
 * Whether a row is as it was at the starting point. Files are compared by what's known about them
 * (the bytes only change with updatedAt); a page's edit time doesn't count on its own.
 */
function same(part: Part, a: object, b: object) {
  if (part === 'assets') {
    const { blob: _a, ...x } = a as StartingPoint['assets'][number]
    const { blob: _b, ...y } = b as StartingPoint['assets'][number]
    return stableStringify(x) === stableStringify(y)
  }
  if (part === 'entities') {
    const { updatedAt: _a, ...x } = a as Entity
    const { updatedAt: _b, ...y } = b as Entity
    return stableStringify(x) === stableStringify(y)
  }
  return stableStringify(a) === stableStringify(b)
}

export interface PageChange {
  id: string
  name: string
  type: Entity['type']
  /** Edited since the starting point, made since, or deleted since. */
  how: 'changed' | 'new' | 'deleted'
}

export interface ResetPlan {
  startingPoint: StartingPoint
  pages: PageChange[]
  /** How many rows of each other kind go back (changed, added or removed since). */
  others: Partial<Record<Exclude<Part, 'entities'> | 'world', number>>
}

/** What a reset would put back: the pages one by one (so the GM can keep fixes), the rest as counts. */
export async function planReset(worldId: string): Promise<ResetPlan | null> {
  const [sp, world] = await Promise.all([db.startingPoints.get(worldId), db.worlds.get(worldId)])
  if (!sp || !world) return null
  const now = await rowsOf(worldId)
  const logId = world.gmScreen?.oneShot?.logId
  const start = new Map(sp.entities.map((e) => [e.id, e]))
  const current = new Map(now.entities.map((e) => [e.id, e]))
  const pages: PageChange[] = []
  for (const e of now.entities) {
    if (e.id === logId) continue
    const s = start.get(e.id)
    if (!s) pages.push({ id: e.id, name: e.name || 'Untitled', type: e.type, how: 'new' })
    else if (!same('entities', e, s)) pages.push({ id: e.id, name: e.name || 'Untitled', type: e.type, how: 'changed' })
  }
  for (const s of sp.entities) if (!current.has(s.id) && s.id !== logId) pages.push({ id: s.id, name: s.name || 'Untitled', type: s.type, how: 'deleted' })
  pages.sort((a, b) => a.name.localeCompare(b.name))
  const others: ResetPlan['others'] = {}
  for (const part of PARTS) {
    if (part === 'entities') continue
    const n = differing(part, now[part], sp[part]).length
    if (n) others[part] = n
  }
  if (stableStringify(resetWorld(world, sp, world.gmScreen?.oneShot)) !== stableStringify({ ...world, updatedAt: 0 })) others.world = 1
  return { startingPoint: sp, pages, others }
}

/** The ids of rows that differ between now and the start: changed, added since or removed since. */
function differing(part: Part, now: { id: string }[], start: { id: string }[]) {
  const s = new Map(start.map((r) => [r.id, r]))
  const n = new Map(now.map((r) => [r.id, r]))
  const ids = new Set<string>()
  for (const r of now) if (!s.has(r.id) || !same(part, r, s.get(r.id)!)) ids.add(r.id)
  for (const r of start) if (!n.has(r.id)) ids.add(r.id)
  return [...ids]
}

/**
 * The world row as the reset leaves it: the starting point's, with this device's own sync settings,
 * nothing on players' screens, the in-game clock hidden and the one-shot setting as it is now.
 */
function resetWorld(world: World, sp: StartingPoint, oneShot: OneShot | undefined): World {
  const screen = sp.world.gmScreen
  return {
    ...sp.world,
    cloud: world.cloud,
    shared: world.shared,
    showing: null,
    spread: null,
    gameTime: null,
    gmScreen: {
      pages: [],
      rolls: [],
      ...(screen ?? {}),
      ...(screen?.gameClock ? { gameClock: { ...screen.gameClock, shown: false, running: false } } : {}),
      // Boards for showing several at once go back to not being on players' screens.
      ...(screen?.showBoards ? { showBoards: screen.showBoards.map((b) => ({ ...b, shown: undefined })) } : {}),
      oneShot,
    },
    updatedAt: 0,
  }
}

export interface ResetChoices {
  /** Pages to leave as they are now (fixes made during play); they become part of the starting point. */
  keep: string[]
  /** Add a short record of this run to the "Past runs" page. */
  log: boolean
  /** Cloud worlds: remove the players who joined (co-GMs stay), which also lets go of their characters and notes. */
  removePlayers: boolean
  /** Cloud worlds: let go of every claimed character (pregens are free for the next table) and clear players' questions. */
  freeCharacters: boolean
  /** Cloud worlds: clear the players' group notes and party scratchpad. */
  clearNotes: boolean
}

export interface ResetResult {
  run: number
  /** Things that couldn't be done on the server (offline, or a part the server doesn't have yet). */
  problems: string[]
}

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

/** Who played whom this run, as "Nell Carter (Sam)", from the claims (cloud) or who was at the table. */
function whoPlayed(entities: Entity[], sessions: Session[], players?: { members: Member[]; claims: Claim[] }) {
  const name = new Map(entities.map((e) => [e.id, e.name || 'Untitled']))
  if (players?.claims.length) {
    const who = new Map(players.members.map((m) => [m.userId, m.name || UNNAMED]))
    return players.claims.filter((c) => c.approved && name.has(c.entityId)).map((c) => `${name.get(c.entityId)} (${who.get(c.userId) ?? UNNAMED})`)
  }
  return [...new Set(sessions.flatMap((s) => s.present ?? []))].flatMap((id) => (name.has(id) ? [name.get(id)!] : []))
}

/** This run's entry for the "Past runs" page: the date, who played, and each session played (recap, notes from play, highlights). */
function runRecord(run: number, now: Rows, sp: StartingPoint, players?: { members: Member[]; claims: Claim[] }) {
  const start = new Map(sp.sessions.map((s) => [s.id, s]))
  const played = now.sessions
    .filter((s) => {
      const before = start.get(s.id)
      const touched = !before || stableStringify({ ...s, recordings: [] }) !== stableStringify(before)
      return touched && (s.startedAt || s.playedAt || s.recap.trim() || notesFromPlay(s).trim() !== (before ? notesFromPlay(before).trim() : ''))
    })
    .sort((a, b) => a.number - b.number)
  const who = whoPlayed(now.entities, played, players)
  const lines = [`## Run ${run} · ${day(Date.now())}`, '']
  if (who.length) lines.push(`**Played by:** ${who.join(', ')}`, '')
  if (!played.length) lines.push('_Nothing was written down in a session this run._', '')
  for (const s of played) {
    lines.push(`### #${s.number} ${s.title}`.trim(), '')
    const before = start.get(s.id)
    if (s.recap.trim() && s.recap !== before?.recap) lines.push(s.recap.trim(), '')
    const notes = notesFromPlay(s).trim()
    if (notes && notes !== (before ? notesFromPlay(before).trim() : '')) lines.push('**Notes from play:**', '', notes, '')
    const highlights = (s.highlights ?? []).filter((h) => !before?.highlights?.some((x) => x.id === h.id))
    if (highlights.length) lines.push(`**Highlights:** ${highlights.map((h) => h.text).join(' · ')}`, '')
  }
  return lines.join('\n').trim()
}

const LOG_SUMMARY = 'A short record of each time this one-shot was played. The reset leaves this page alone.'

/**
 * Puts the world back to its starting point (see the top of this file). What it replaces is kept:
 * every page's version from before goes into its history (pages made during the run show in
 * Recently deleted), and everything else goes into one "replaced by the one-shot reset" item in the
 * bin, so Restore there brings it back. With cloud sync the reset reaches other devices and the
 * players like any edit; the players' own things on the server are done after it.
 */
export async function resetToStart(worldId: string, choices: ResetChoices): Promise<ResetResult> {
  const first = await db.worlds.get(worldId)
  if (!first || first.shared) throw new Error('World not found')
  const cloud = !!first.cloud?.enabled
  // Anything another device sent meanwhile comes in first, so it's reset too rather than arriving after.
  if (cloud) await syncNow().catch(() => {})
  const players = cloud ? await listPlayers(worldId).catch(() => undefined) : undefined
  const problems: string[] = []
  let run = 0

  await db.transaction('rw', [db.worlds, ...PARTS.map(table), db.bin, db.history, db.startingPoints], async () => {
    const world = await db.worlds.get(worldId)
    const sp = await db.startingPoints.get(worldId)
    if (!world) throw new Error('World not found')
    if (!sp) throw new Error('There’s no starting point saved on this device.')
    const now = await rowsOf(worldId)
    const keep = new Set(choices.keep)
    const os: OneShot = world.gmScreen?.oneShot ?? { on: true, since: Date.now() }
    run = (os.runs ?? 0) + 1

    // The "Past runs" page: this run on top, the reset never touches it.
    let log = os.logId ? now.entities.find((e) => e.id === os.logId) : undefined
    if (choices.log) {
      const entry = runRecord(run, now, sp, players)
      log = log
        ? { ...log, body: `${entry}\n\n${log.body}`.trim(), updatedAt: Date.now() }
        : { ...blankEntity(worldId, 'lore', 'Past runs'), summary: LOG_SUMMARY, body: entry, gmTags: ['one-shot'] }
    }
    const logId = log?.id

    // Pages: each one changed back keeps its version from before in its history.
    const start = new Map(sp.entities.map((e) => [e.id, e]))
    for (const e of now.entities) {
      if (e.id === logId || keep.has(e.id)) continue
      const s = start.get(e.id)
      if (!s) {
        await keepVersion(e, 'deleted')
        await db.entities.delete(e.id)
      } else if (!same('entities', e, s)) {
        await keepVersion(e, 'edit')
        await db.entities.put(s)
      }
    }
    const current = new Set(now.entities.map((e) => e.id))
    for (const s of sp.entities) if (!current.has(s.id) && !keep.has(s.id) && s.id !== logId) await db.entities.put(s)
    if (log) await db.entities.put(log)

    // Everything else: what's replaced goes to the bin as one item.
    const binned: BinItem['rows'] = []
    for (const part of PARTS) {
      if (part === 'entities') continue
      const ids = new Set(differing(part, now[part], sp[part]))
      if (!ids.size) continue
      const before = (now[part] as { id: string }[]).filter((r) => ids.has(r.id))
      if (before.length) binned.push({ table: part, rows: before })
      const startIds = new Set(sp[part].map((r) => r.id))
      await table(part).bulkDelete(before.filter((r) => !startIds.has(r.id)).map((r) => r.id))
      await table(part).bulkPut((sp[part] as { id: string }[]).filter((r) => ids.has(r.id)))
    }
    const nextOneShot: OneShot = { ...os, on: true, runs: run, lastReset: Date.now(), ...(logId ? { logId } : {}) }
    binned.push({ table: 'worlds', rows: [world] })
    await db.worlds.put({ ...resetWorld(world, sp, nextOneShot), updatedAt: Date.now() })
    await db.bin.add({ id: newId(), worldId, at: Date.now(), kind: 'reset', label: `${world.name}, as it was after run ${run}`, rows: binned })

    // Kept fixes and the Past runs page become part of the starting point, so the next reset keeps them too.
    const kept = new Map(now.entities.filter((e) => keep.has(e.id) || e.id === logId).map((e) => [e.id, e]))
    if (log) kept.set(log.id, log)
    const entities = [...sp.entities.filter((e) => !keep.has(e.id) && e.id !== logId), ...kept.values()]
    await db.startingPoints.put({ ...sp, entities })
  })

  if (cloud) {
    // Players' screens stop following the session that was being played.
    setLiveSession(worldId, undefined)
    const server = (what: string) => (e: unknown) => problems.push(`${what} (${(e as Error)?.message || 'offline?'})`)
    if (choices.removePlayers && players)
      for (const m of players.members.filter((m) => m.role === 'player')) await removePlayer(worldId, m.userId).catch(server(`${m.name} couldn’t be removed`))
    if (choices.freeCharacters || choices.removePlayers) {
      const claims = await supabase.from('character_claims').delete().eq('world_id', worldId)
      if (claims.error) server('The characters couldn’t be freed up')(claims.error)
      const questions = await supabase.from('player_questions').delete().eq('world_id', worldId)
      if (questions.error) server('The players’ questions couldn’t be cleared')(questions.error)
    }
    if (choices.clearNotes) {
      const { error } = await supabase.rpc('clear_group_notes', { wid: worldId })
      if (error)
        problems.push(
          /clear_group_notes|function|schema cache/i.test(error.message)
            ? 'The group notes couldn’t be cleared: the server isn’t set up for it yet.'
            : `The group notes couldn’t be cleared (${error.message}).`,
        )
    }
    await tellPlayers(worldId).catch(() => {})
  }
  return { run, problems }
}
