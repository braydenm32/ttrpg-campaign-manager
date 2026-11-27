import { useEffect, useSyncExternalStore } from 'react'
import { db, type WorldMap } from '../db'
import { pinRevealed } from '../fog'
import { JOINED, joinRoom } from './live'

/**
 * The live map: while the GM shows a map (World.showing with a mapId), players' screens follow its
 * fog and pins within a second, without the GM pressing Show again.
 *
 * The picture players have is always the players' copy of the map (the fog painted on, GM-only
 * pieces left out), which syncs like any other file: that copy is the truth, and it's what a
 * player who opens the app late gets. Syncing a whole picture takes a while though, so in between
 * the GM's app says what changed in the GM's room ("table:<world>", where only a GM can send):
 *  - "map" (GM → players): a small piece of the players' copy, cut out where the fog just changed
 *    (never the clean map: a covered spot inside the piece is as black in it as in the copy), where
 *    it sits, and the pins players may see on the map right now. Each piece says which version of
 *    the copy it makes and which one it was painted over, so an app that missed one knows.
 *  - "map-ask" (player → GM, in the members' room): "this is the version I have", sent when a
 *    player's app opens the map, comes back from sleep, or finds a piece missing. The GM's app
 *    answers with the whole picture, small, if that version is behind.
 * Nothing here is saved: pieces sit over the picture on the player's device until the synced copy
 * catches up with them.
 */

/** A pin as players see it on a shown map: only what's drawn. Never a GM-only pin or one under the fog. */
export interface LivePin {
  id: string
  label: string
  kind: 'point' | 'region'
  position?: [number, number]
  points?: [number, number][]
  color: string
  number?: number
  /** A linked piece of a drawn map: only its outline is drawn. */
  piece?: boolean
}

/** A piece of the players' copy: where it sits (fractions of the picture, from its top left) and the piece itself. */
export interface MapPatch {
  /** The version of the players' copy this piece brings a player to, and the one it was painted over. */
  v: number
  prev: number
  box: [number, number, number, number]
  /** A JPEG as a data: address. */
  url: string
  /** The whole picture (after a player asked, or when all of it changed). */
  whole?: boolean
  /** Sent smaller than the copy itself, so it looks soft until the synced copy arrives. */
  soft?: boolean
}

export interface LiveMapState {
  /** The GM's id of the picture these belong to. */
  asset: string
  patches: MapPatch[]
  /** The pins to draw, once the GM's app has said (until then, the ones that came with the world). */
  pins?: LivePin[]
}

/**
 * The pins players see on a map, as public.player_view sends them: none of a map they can't see,
 * only pins marked for players, never one under the fog, and a linked page's name only when that
 * page is revealed to everyone. On a player's own device the world's copy is already filtered, so
 * this changes nothing there.
 */
export async function pinsForPlayers(map: WorldMap | null | undefined): Promise<LivePin[]> {
  if (!map || map.visibility !== 'players') return []
  const fog = map.fog?.on ? map.fog : undefined
  const pins = (await db.pins.where({ mapId: map.id }).toArray()).filter((p) => p.visibility === 'players' && pinRevealed(fog, p))
  const pages = new Map((await db.entities.bulkGet([...new Set(pins.flatMap((p) => (p.entityId ? [p.entityId] : [])))])).flatMap((e) => (e && e.visibility === 'players' && !e.template ? [[e.id, e.name] as const] : [])))
  return pins.map((p) => ({
    id: p.id,
    label: p.label || (p.entityId && pages.get(p.entityId)) || '',
    kind: p.kind,
    position: p.position,
    points: p.points,
    color: p.color,
    number: map.numbers ? p.number : undefined,
    piece: !!p.pieceId || undefined,
  }))
}

const tableRoom = (cloudId: string) => `table:${cloudId}`
const membersRoom = (cloudId: string) => `members:${cloudId}`

/** The most a piece may weigh once it's text, so a message stays well inside what a live room carries. */
export const PATCH_MAX_CHARS = 170_000
const PATCHES_KEPT = 60
const PINS_MAX = 400

// ---------- what a player's app has heard ----------

const states = new Map<string, LiveMapState>()
const listeners = new Map<string, Set<() => void>>()
const tell = (cloudId: string) => listeners.get(cloudId)?.forEach((l) => l())

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const text = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '')
const point = (x: unknown): [number, number] | undefined => (Array.isArray(x) && x.length === 2 && num(x[0]) !== undefined && num(x[1]) !== undefined ? [x[0], x[1]] : undefined)

/** A pin as it arrived: nothing is taken on trust, not even from the GM's room. */
function readPin(p: Record<string, unknown>): LivePin | undefined {
  if (!p || typeof p !== 'object' || !text(p.id, 80)) return undefined
  const position = point(p.position)
  const points = Array.isArray(p.points) ? p.points.slice(0, 400).map(point).filter((x): x is [number, number] => !!x) : undefined
  if (!position && !(points && points.length >= 3)) return undefined
  return {
    id: text(p.id, 80),
    label: text(p.label, 120),
    kind: p.kind === 'region' ? 'region' : 'point',
    position,
    points: points && points.length >= 3 ? points : undefined,
    color: text(p.color, 12),
    number: num(p.number),
    piece: p.piece === true || undefined,
  }
}

function readPatch(p: Record<string, unknown>): MapPatch | undefined {
  const v = num(p.v)
  const box = Array.isArray(p.box) && p.box.length === 4 ? p.box.map(num) : undefined
  const url = typeof p.img === 'string' && p.img.length <= PATCH_MAX_CHARS * 2 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.img) ? p.img : undefined
  if (v === undefined || !url || !box || box.some((n) => n === undefined || n < 0 || n > 1)) return undefined
  const [x0, y0, x1, y1] = box as number[]
  if (x1 <= x0 || y1 <= y0) return undefined
  return { v, prev: num(p.prev) ?? 0, box: [x0, y0, x1, y1], url, whole: p.whole === true || undefined, soft: p.soft === true || undefined }
}

function hear(cloudId: string, p: Record<string, unknown>) {
  const asset = text(p.asset, 80)
  if (!asset) return
  const had = states.get(cloudId)
  const state: LiveMapState = had?.asset === asset ? { ...had } : { asset, patches: [] }
  if (Array.isArray(p.pins)) state.pins = (p.pins as Record<string, unknown>[]).slice(0, PINS_MAX).map(readPin).filter((x): x is LivePin => !!x)
  const patch = readPatch(p)
  const last = state.patches.at(-1)?.v ?? 0
  // The same piece twice, or an older one arriving late, adds nothing.
  if (patch && patch.v > last) state.patches = patch.whole ? [patch] : [...state.patches, patch].slice(-PATCHES_KEPT)
  states.set(cloudId, state)
  tell(cloudId)
}

/**
 * The pieces that can be laid over a player's picture, given the version of the picture they have:
 * those newer than it, as long as each follows on from the one before. `gap` says a piece is
 * missing (the rest can't be trusted to add up), so the app should ask for the whole picture.
 */
export function usablePatches(patches: MapPatch[], have: number) {
  const use: MapPatch[] = []
  let at = have
  for (const p of patches) {
    if (p.v <= at) continue
    if (!p.whole && p.prev > at) return { use, at, gap: true }
    use.push(p)
    at = p.v
  }
  return { use, at, gap: false }
}

/**
 * A player's side: listens for the live map of a joined world while something that shows it is on
 * screen. Gives what's been heard for this picture (the GM's id of it), or undefined.
 */
export function useLiveMap(cloudId: string | undefined, asset: string | undefined) {
  useEffect(() => {
    if (!cloudId) return
    const table = joinRoom(tableRoom(cloudId))
    table.on('map', (p) => hear(cloudId, p))
    // After a dropped connection the pins said before may be out of date: back to the world's own until the GM's app answers.
    table.on(JOINED, () => {
      const s = states.get(cloudId)
      if (s?.pins) {
        states.set(cloudId, { ...s, pins: undefined })
        tell(cloudId)
      }
    })
    return () => table.leave()
  }, [cloudId])
  const state = useSyncExternalStore(
    (l) => {
      if (!cloudId) return () => {}
      const set = listeners.get(cloudId) ?? new Set()
      listeners.set(cloudId, set)
      set.add(l)
      return () => set.delete(l)
    },
    () => (cloudId ? states.get(cloudId) : undefined),
  )
  return state && state.asset === asset ? state : undefined
}

const asked = new Map<string, { asset: string; have: number; at: number }>()

/** A player's app tells the GM's which version of the picture it has (so it's sent the whole one if that's behind). */
export function askForMap(cloudId: string, asset: string, have: number) {
  // The same map is often on screen twice (the pop-up and the Now tab): one ask does for both.
  const was = asked.get(cloudId)
  if (was && was.asset === asset && was.have === have && Date.now() - was.at < 1000) return Promise.resolve(false)
  asked.set(cloudId, { asset, have, at: Date.now() })
  const room = joinRoom(membersRoom(cloudId))
  return room.send('map-ask', { asset, have }).finally(() => room.leave())
}

/** Calls fn each time a player's app connects to the GM's room (when the app opens, and again after the phone slept). */
export function onTableJoined(cloudId: string, fn: () => void) {
  const table = joinRoom(tableRoom(cloudId))
  table.on(JOINED, fn)
  if (table.connected()) fn()
  return () => table.leave()
}

/** Calls fn when the GM's app says the world changed in the cloud (a newer copy of the picture may be there). */
export function onWorldChanged(cloudId: string, fn: () => void) {
  const room = joinRoom(membersRoom(cloudId))
  room.on('changed', fn)
  return () => room.leave()
}

// ---------- the GM's side ----------

/** What the GM's app says about the map it's showing: see the top of this file. Only ever cut from the players' copy. */
export interface MapMessage {
  asset: string
  v: number
  prev?: number
  box?: [number, number, number, number]
  img?: string
  whole?: boolean
  soft?: boolean
  pins: LivePin[]
}

/**
 * The GM's side of a shown map: `send` says something to every player, and `onAsk` is called when a
 * player's app says which version of a picture it has. Returns a function that closes it.
 */
export function hostLiveMap(cloudId: string, onAsk: (asset: string, have: number) => void) {
  const table = joinRoom(tableRoom(cloudId))
  const members = joinRoom(membersRoom(cloudId))
  members.on('map-ask', (p) => {
    const asset = text(p.asset, 80)
    if (asset) onAsk(asset, num(p.have) ?? 0)
  })
  return {
    send: (m: MapMessage) => table.send('map', m),
    close: () => {
      table.leave()
      members.leave()
    },
  }
}
