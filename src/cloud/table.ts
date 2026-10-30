import { useEffect, useState, useSyncExternalStore } from 'react'
import { blankLectern, newId, type Campaign, type Entity, type Session, type Sound } from '../db'
import { initiativeOrder } from '../encounters'
import { joinRoom, JOINED, sendOnce, type LiveRoom } from './live'

/**
 * The live link between the GM's Lectern and the players' Common Room. Nothing here is saved
 * anywhere: it's what's happening at the table right now. Two rooms per world:
 *  - "members:<world>", where anyone in the world can send:
 *    - "hello" (player → GM): a player just opened the app; the GM's app answers with "table".
 *    - "dice" (players): a roll the whole table sees.
 *    - "signal" (player → GM): "I'd like to do something", "I need a break" or "I'll use inspiration".
 *    - "call-answer" (player → GM): a player's result for the roll the GM called for.
 *    - "ping" (anyone): "look here", a spot on a map everyone looking at that map sees for a moment.
 *  - "table:<world>", where only a GM can send (public.channel_allowed), so players can trust it:
 *    - "table" (GM → players): the session being played, the scene, whose turn it is, the music.
 *    - "dice" (GM): the GM's own rolls.
 *    - "signal-seen" (GM → players): the GM saw a signal.
 * The GM's messages go to the members' room too, for a server that doesn't have the GM's room yet.
 * Once a player's app gets into the GM's room it stops believing GM messages from the members' room.
 * Only what the GM's own filters let through is ever sent: never HP, conditions, scene notes or
 * a page players can't see.
 */

export interface TableTurn {
  id: string
  name: string
  side: 'pc' | 'ally' | 'foe'
  /** The GM's id of a player character's page, so its player gets "your turn". */
  entityId?: string
}

export interface TableState {
  session: { id: string; number: number; title: string; campaignId: string }
  scene?: { name: string; entityId?: string }
  music?: string[]
  combat?: { round: number; turnId?: string; order: TableTurn[] }
  /** A roll the GM has called for: who should roll (the GM's ids of their characters; empty for everyone) and what. */
  call?: { id: string; label: string; dice: string; dc?: number; secret?: boolean; to: string[] }
  /** Running or paused countdowns. endsAt is on the sender's clock until it arrives, then on this device's. */
  timers?: { id: string; label: string; endsAt?: number; left?: number }[]
}

export interface TableRoll {
  id: string
  who: string
  expr: string
  total: number
  detail: string
  crit?: 'high' | 'low'
  at: number
}

export type SignalKind = 'act' | 'break' | 'inspiration'

export interface TableSignal {
  id: string
  kind: SignalKind
  who: string
  /** The GM's id of the character (for inspiration). */
  entityId?: string
  at: number
}

/** A player's result for a called roll, as the GM hears it. */
export interface CallAnswer {
  id: string
  callId: string
  entityId?: string
  who: string
  expr: string
  total: number
  detail: string
  crit?: 'high' | 'low'
}

/** "Look here": a spot on a map (the GM's map id, image coordinates [y, x]). */
export interface MapPing {
  id: string
  mapId: string
  at: [number, number]
  who: string
  /** From the GM (drawn in the GM's colour). */
  gm?: boolean
  /** When it arrived, on this device's clock. */
  time: number
}

interface TableStore {
  table: TableState | null
  pings: MapPing[]
  /** For the GM: players' results for called rolls. */
  answers: CallAnswer[]
  /** For a player: the calls answered from here, and the result. */
  answered: Record<string, number>
  /** When the last "table" message arrived (this device's clock). */
  heard: number
  /** When someone last said downtime changed (a player sent one, or the GM answered), so lists reload at once. */
  downtime: number
  rolls: TableRoll[]
  /** For the GM: signals players sent that haven't been answered. */
  signals: TableSignal[]
  /** For a player: signals sent from here, and whether the GM saw them. */
  sent: Record<string, 'sent' | 'seen'>
}

const empty: TableStore = { table: null, pings: [], heard: 0, downtime: 0, rolls: [], signals: [], sent: {}, answers: [], answered: {} }
const stores = new Map<string, TableStore>()
const listeners = new Map<string, Set<() => void>>()
const links = new Map<string, { members: LiveRoom; table: LiveRoom; host: boolean }>()

const get = (cloudId: string) => stores.get(cloudId) ?? empty
function update(cloudId: string, fn: (s: TableStore) => TableStore) {
  stores.set(cloudId, fn(get(cloudId)))
  listeners.get(cloudId)?.forEach((l) => l())
}

/** The live table for a synced or joined world (its cloud id). */
export function useTable(cloudId: string | undefined) {
  const store = useSyncExternalStore(
    (l) => {
      if (!cloudId) return () => {}
      const set = listeners.get(cloudId) ?? new Set()
      listeners.set(cloudId, set)
      set.add(l)
      return () => set.delete(l)
    },
    () => (cloudId ? get(cloudId) : empty),
  )
  // "Playing now" fades if the GM's app goes quiet (it repeats itself every minute while open).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const live = !!store.table && now - store.heard < STALE_AFTER
  return { ...store, table: live ? store.table : null }
}

const HEARTBEAT = 60_000
const STALE_AFTER = 3 * HEARTBEAT

const room = (cloudId: string) => `members:${cloudId}`
const gmRoom = (cloudId: string) => `table:${cloudId}`

/** A player's message: to the members' room, where everyone listens. */
const send = (cloudId: string, event: string, payload: object) => {
  const link = links.get(cloudId)
  return link ? link.members.send(event, payload) : sendOnce(room(cloudId), event, payload)
}

/** The GM's message: to the GM's room, and to the members' room for a server without the GM's room yet. */
async function sendAsGM(cloudId: string, event: string, payload: object) {
  const link = links.get(cloudId)
  const sent = await Promise.all([
    link ? link.table.send(event, payload) : sendOnce(gmRoom(cloudId), event, payload),
    link ? link.members.send(event, payload) : sendOnce(room(cloudId), event, payload),
  ])
  return sent.some(Boolean)
}

// ---------- reading what arrives (nothing is taken on trust, not even from the GM's room) ----------

const text = (x: unknown, max = 80) => (typeof x === 'string' ? x.slice(0, max) : '')
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const SIDES = ['pc', 'ally', 'foe'] as const
const KINDS: SignalKind[] = ['act', 'break', 'inspiration']

function readTable(p: Record<string, unknown>): TableState | null {
  const s = p.session as Record<string, unknown> | undefined
  if (p.off || !s || typeof s !== 'object') return null
  const scene = p.scene as Record<string, unknown> | undefined
  const combat = p.combat as Record<string, unknown> | undefined
  // Timers are sent with the sender's clock; shift them onto this device's clock.
  const shift = Date.now() - num(p.sentAt)
  const timers = Array.isArray(p.timers)
    ? (p.timers as Record<string, unknown>[]).slice(0, 10).map((t) => ({
        id: text(t?.id),
        label: text(t?.label, 120),
        endsAt: typeof t?.endsAt === 'number' && p.sentAt ? num(t.endsAt) + shift : undefined,
        left: typeof t?.left === 'number' ? Math.max(0, num(t.left)) : undefined,
      }))
    : undefined
  const call = p.call as Record<string, unknown> | undefined
  return {
    call:
      call && typeof call === 'object' && text(call.id)
        ? {
            id: text(call.id),
            label: text(call.label, 80) || 'Roll',
            dice: text(call.dice, 30) || 'd20',
            dc: typeof call.dc === 'number' && Number.isFinite(call.dc) ? call.dc : undefined,
            secret: call.secret === true || undefined,
            to: Array.isArray(call.to) ? call.to.slice(0, 20).map((x) => text(x)).filter(Boolean) : [],
          }
        : undefined,
    timers: timers?.length ? timers : undefined,
    session: { id: text(s.id), number: num(s.number), title: text(s.title, 200), campaignId: text(s.campaignId) },
    scene: scene && typeof scene === 'object' ? { name: text(scene.name, 200), entityId: text(scene.entityId) || undefined } : undefined,
    music: Array.isArray(p.music) ? p.music.slice(0, 6).map((m) => text(m, 120)).filter(Boolean) : undefined,
    combat:
      combat && typeof combat === 'object' && Array.isArray(combat.order)
        ? {
            round: num(combat.round),
            turnId: text(combat.turnId) || undefined,
            order: (combat.order as Record<string, unknown>[]).slice(0, 60).map((t) => ({
              id: text(t?.id),
              name: text(t?.name),
              side: SIDES.includes(t?.side as 'pc') ? (t.side as TableTurn['side']) : 'foe',
              entityId: text(t?.entityId) || undefined,
            })),
          }
        : undefined,
  }
}

function readRoll(p: Record<string, unknown>): TableRoll | null {
  if (!text(p.id) || !text(p.expr)) return null
  return {
    id: text(p.id),
    who: text(p.who) || 'Someone',
    expr: text(p.expr, 60),
    total: num(p.total),
    detail: text(p.detail, 300),
    crit: p.crit === 'high' || p.crit === 'low' ? p.crit : undefined,
    at: Date.now(),
  }
}

/** Signed "GM". From the members' room, where any player can send, that's a player posing as the GM once the GM's room works. */
const posingAsGM = (p: Record<string, unknown>) => /^\s*gm\s*$/i.test(text(p.who))

function readPing(p: Record<string, unknown>, fromGM: boolean): MapPing | null {
  const at = p.at as unknown[]
  if (!text(p.id) || !text(p.mapId) || !Array.isArray(at) || at.length !== 2) return null
  return { id: text(p.id), mapId: text(p.mapId), at: [num(at[0]), num(at[1])], who: text(p.who, 40) || 'Someone', gm: fromGM && p.gm === true, time: Date.now() }
}

const addPing = (cloudId: string, ping: MapPing) =>
  update(cloudId, (s) => (s.pings.some((x) => x.id === ping.id) ? s : { ...s, pings: [...s.pings.filter((x) => Date.now() - x.time < 10_000), ping].slice(-20) }))

/** Points at a spot on a map for everyone looking at it. */
export function sendPing(cloudId: string, mapId: string, at: [number, number], who: string) {
  const link = links.get(cloudId)
  const ping = { id: newId(), mapId, at, who, gm: !!link?.host }
  addPing(cloudId, { ...ping, time: Date.now() })
  return link?.host ? sendAsGM(cloudId, 'ping', ping) : send(cloudId, 'ping', ping)
}

const addRoll = (cloudId: string, r: TableRoll) =>
  update(cloudId, (s) => (s.rolls.some((x) => x.id === r.id) ? s : { ...s, rolls: [r, ...s.rolls].slice(0, 30) }))

// ---------- players ----------

/** A player's side of the link, kept open while their world is on screen. */
export function linkAsPlayer(cloudId: string) {
  const members = joinRoom(room(cloudId))
  const table = joinRoom(gmRoom(cloudId))
  const link = { members, table, host: false }
  links.set(cloudId, link)
  // Set once the GM's room works: from then on the GM's messages count only from there.
  let gmRoomWorks = table.connected()
  const hello = () => void members.send('hello')
  members.on(JOINED, hello)
  table.on(JOINED, () => {
    gmRoomWorks = true
    hello()
  })
  if (members.connected()) hello()
  for (const [r, fromGM] of [
    [table, true],
    [members, false],
  ] as const) {
    r.on('table', (p) => (fromGM || !gmRoomWorks) && update(cloudId, (s) => ({ ...s, table: readTable(p), heard: Date.now() })))
    r.on('dice', (p) => {
      if (!fromGM && gmRoomWorks && posingAsGM(p)) return
      const roll = readRoll(p)
      if (roll) addRoll(cloudId, roll)
    })
    r.on('ping', (p) => {
      const ping = readPing(p, fromGM || !gmRoomWorks)
      if (ping) addPing(cloudId, ping)
    })
    // Only the GM answers downtime, so only the GM's word counts.
    r.on('downtime', () => (fromGM || !gmRoomWorks) && update(cloudId, (s) => ({ ...s, downtime: Date.now() })))
    r.on<{ id?: unknown }>('signal-seen', (p) => {
      if (!fromGM && gmRoomWorks) return
      const id = text(p.id)
      update(cloudId, (s) => (s.sent[id] ? { ...s, sent: { ...s.sent, [id]: 'seen' } } : s))
    })
  }
  return () => {
    if (links.get(cloudId) === link) links.delete(cloudId)
    members.leave()
    table.leave()
  }
}

/** Says downtime changed, so the other side's list reloads now rather than at its next check. */
export function tellDowntime(cloudId: string) {
  return links.get(cloudId)?.host ? sendAsGM(cloudId, 'downtime', {}) : send(cloudId, 'downtime', {})
}

/** Sends a signal to the GM. Returns its id, or '' if it couldn't be sent. */
export async function sendSignal(cloudId: string, kind: SignalKind, who: string, entityId?: string) {
  const sig: TableSignal = { id: newId(), kind, who, entityId, at: Date.now() }
  update(cloudId, (s) => ({ ...s, sent: { ...s.sent, [sig.id]: 'sent' } }))
  const ok = await send(cloudId, 'signal', sig)
  if (!ok)
    update(cloudId, (s) => {
      const { [sig.id]: _gone, ...sent } = s.sent
      return { ...s, sent }
    })
  return ok ? sig.id : ''
}

/** A player's result for the roll the GM called for: to the GM (and, unless it's secret, the table's dice). */
export async function answerCall(cloudId: string, a: Omit<CallAnswer, 'id'>, secret: boolean) {
  const answer = { ...a, id: newId() }
  update(cloudId, (s) => ({ ...s, answered: { ...s.answered, [a.callId]: a.total } }))
  const ok = await send(cloudId, 'call-answer', answer)
  if (!secret) await shareRoll(cloudId, { who: a.who, expr: a.expr, total: a.total, detail: a.detail, crit: a.crit })
  return ok
}

/** Shows a roll to everyone at the table (and here). */
export async function shareRoll(cloudId: string, r: Omit<TableRoll, 'id' | 'at'>) {
  const link = links.get(cloudId)
  // A player whose name happens to be "GM" still reads as a player.
  const who = link && !link.host && posingAsGM(r) ? `${r.who.trim()} (a player)` : r.who
  const roll = { ...r, who, id: newId(), at: Date.now() }
  addRoll(cloudId, roll)
  return link?.host ? sendAsGM(cloudId, 'dice', roll) : send(cloudId, 'dice', roll)
}

// ---------- the GM ----------

/** The GM's side: answers players who arrive, and collects their rolls and signals. */
export function linkAsHost(cloudId: string, current: () => TableState | null) {
  const members = joinRoom(room(cloudId))
  const table = joinRoom(gmRoom(cloudId))
  const link = { members, table, host: true }
  links.set(cloudId, link)
  let gmRoomWorks = table.connected()
  const tell = () => void sendAsGM(cloudId, 'table', wire(current()))
  members.on('hello', tell)
  // Nothing to say while no session is being run: players start from nothing anyway.
  const remind = () => current() && tell()
  members.on(JOINED, remind)
  table.on(JOINED, () => {
    gmRoomWorks = true
    remind()
  })
  // Players' rolls, and a co-GM's from the GM's room.
  for (const [r, fromGM] of [
    [table, true],
    [members, false],
  ] as const)
    r.on('dice', (p) => {
      if (!fromGM && gmRoomWorks && posingAsGM(p)) return
      const roll = readRoll(p)
      if (roll) addRoll(cloudId, roll)
    })
  members.on('downtime', () => update(cloudId, (s) => ({ ...s, downtime: Date.now() })))
  members.on('ping', (p) => {
    const ping = readPing(p, false)
    if (ping) addPing(cloudId, ping)
  })
  members.on('call-answer', (p) => {
    const callId = text(p.callId)
    const call = current()?.call
    if (!call || call.id !== callId || !text(p.id)) return
    const entityId = text(p.entityId) || undefined
    if (call.to.length && (!entityId || !call.to.includes(entityId))) return
    const a: CallAnswer = { id: text(p.id), callId, entityId, who: text(p.who) || 'A player', expr: text(p.expr, 60), total: num(p.total), detail: text(p.detail, 300), crit: p.crit === 'high' || p.crit === 'low' ? p.crit : undefined }
    update(cloudId, (s) => (s.answers.some((x) => x.id === a.id) ? s : { ...s, answers: [...s.answers, a].slice(-60) }))
  })
  members.on('signal', (p) => {
    const kind = p.kind as SignalKind
    if (!KINDS.includes(kind) || !text(p.id)) return
    const sig: TableSignal = { id: text(p.id), kind, who: text(p.who) || 'A player', entityId: text(p.entityId) || undefined, at: Date.now() }
    update(cloudId, (s) => (s.signals.some((x) => x.id === sig.id) ? s : { ...s, signals: [...s.signals, sig].slice(-20) }))
  })
  // Players stop showing "playing now" if they hear nothing for a few minutes, so say it again now and then (only while live).
  const beat = setInterval(remind, HEARTBEAT)
  return () => {
    clearInterval(beat)
    if (links.get(cloudId) === link) links.delete(cloudId)
    members.leave()
    table.leave()
  }
}

/** The GM's app sends what players should see now (null: nothing is being played). */
export function publishTable(cloudId: string, state: TableState | null) {
  const before = get(cloudId).table
  if (JSON.stringify(before) === JSON.stringify(state)) return
  // The GM's own copy, so previewing the Common Room shows it too.
  update(cloudId, (s) => ({ ...s, table: state, heard: Date.now() }))
  void sendAsGM(cloudId, 'table', wire(state))
}

/** A table state as sent: with the sender's clock, so timers can be shifted onto each player's. */
const wire = (state: TableState | null) => (state ? { ...state, sentAt: Date.now() } : { off: true })

/** The GM has dealt with a signal: it goes away, and the player sees that it was seen. */
export function answerSignal(cloudId: string, id: string) {
  update(cloudId, (s) => ({ ...s, signals: s.signals.filter((x) => x.id !== id) }))
  void sendAsGM(cloudId, 'signal-seen', { id })
}

/**
 * What players see of a session being run, filtered by the GM's choices on the Lectern. Only
 * pages revealed to everyone are linked, and a fighter made from a page players can't see goes
 * out as "Enemy 2" or "Ally 1" even when names are shown (only names typed in by hand go as they
 * are). Foes appear only once combat has started. A GM-only session, or one in a GM-only
 * campaign, goes out as just "Session 12".
 */
export function tableStateFor(session: Session, pages: Map<string, Entity>, sounds: Sound[], playing: string[], campaign?: Campaign): TableState | null {
  const l = { ...blankLectern(), ...session.lectern }
  const share = l.share ?? {}
  if (share.off) return null
  const visible = (id?: string) => {
    const e = id ? pages.get(id) : undefined
    return e && e.visibility === 'players' && !e.template ? e : undefined
  }
  const hiddenCampaign = campaign?.visibility === 'gm'
  const place = visible(l.sceneId)
  const order = initiativeOrder(l.combat.combatants)
  const counts = { pc: 0, ally: 0, foe: 0 }
  const music = share.noMusic
    ? []
    : sounds.filter((s) => playing.includes(s.id) && (s.loop || s.syrinscape?.kind === 'mood')).map((s) => s.name)
  return {
    session: {
      id: session.id,
      number: session.number,
      title: session.visibility === 'players' && !hiddenCampaign ? session.title : `Session ${session.number}`,
      campaignId: hiddenCampaign ? '' : session.campaignId,
    },
    scene: place ? { name: place.name, entityId: place.id } : undefined,
    call: l.rollCall
      ? { id: l.rollCall.id, label: l.rollCall.label, dice: l.rollCall.dice, dc: l.rollCall.showDc ? l.rollCall.dc : undefined, secret: l.rollCall.secret, to: l.rollCall.to }
      : undefined,
    timers: l.timers?.some((t) => !t.hidden) ? l.timers.filter((t) => !t.hidden).map(({ id, label, endsAt, left }) => ({ id, label, endsAt, left })) : undefined,
    music: music.length ? music : undefined,
    // Nothing about a fight until the GM starts it, so setting one up gives nothing away.
    combat:
      l.combat.activeId && order.length
        ? {
            round: l.combat.round,
            turnId: l.combat.activeId,
            order: order.map((c) => {
              const pc = c.side === 'pc' ? visible(c.entityId) : undefined
              counts[c.side]++
              // Its name came from a page players haven't been shown ("The Masked Duke"): that stays secret.
              const secret = c.side !== 'pc' && !!c.entityId && !visible(c.entityId)
              const name = pc?.name ?? ((share.hideNames || secret) && c.side !== 'pc' ? `${c.side === 'foe' ? 'Enemy' : 'Ally'} ${counts[c.side]}` : c.name)
              return { id: c.id, name, side: c.side, entityId: pc?.id }
            }),
          }
        : undefined,
  }
}

// ---------- which session the GM is running ----------

const liveKey = (worldId: string) => `codex.liveSession.${worldId}`
const liveListeners = new Set<() => void>()
const memory = new Map<string, string | undefined>()

/** The session the GM has gone live with in this world (from its Lectern), kept until they stop or end it. */
export function setLiveSession(worldId: string, sessionId: string | undefined) {
  if (memory.get(worldId) === sessionId && memory.has(worldId)) return
  memory.set(worldId, sessionId)
  try {
    // Kept for this tab, so a reload doesn't stop the table link.
    if (sessionId) sessionStorage.setItem(liveKey(worldId), sessionId)
    else sessionStorage.removeItem(liveKey(worldId))
  } catch {
    // Storage blocked: it lasts until the page reloads.
  }
  liveListeners.forEach((l) => l())
}

export function useLiveSession(worldId: string) {
  return useSyncExternalStore(
    (l) => {
      liveListeners.add(l)
      return () => liveListeners.delete(l)
    },
    () => {
      if (memory.has(worldId)) return memory.get(worldId)
      try {
        return sessionStorage.getItem(liveKey(worldId)) ?? undefined
      } catch {
        return undefined
      }
    },
  )
}

/** A page's GM id, from its id on this device (a joined world's local ids carry a suffix). */
export const gmIdOf = (localId: string) => localId.replace(/@m[0-9a-f]{8}$/, '')

/** A page's id on this device, from the GM's id. */
export const localIdOf = (memberOf: string | undefined, gmId: string) => (memberOf ? `${gmId}@m${memberOf.slice(0, 8)}` : gmId)
