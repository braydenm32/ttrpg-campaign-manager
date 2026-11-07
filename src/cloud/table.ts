import { liveQuery } from 'dexie'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { blankLectern, db, newId, type Campaign, type Entity, type Session, type Sound } from '../db'
import { initiativeOrder } from '../encounters'
import { recordingStore } from '../recordingStore'
import { supabase } from './client'
import { joinRoom, JOINED, postOnce, sendOnce, type LiveRoom } from './live'
import { listPlayers, memberWorldId } from './players'

/**
 * The live link between the GM's Lectern and the players' Common Room. Nothing here is saved
 * anywhere: it's what's happening at the table right now. Three rooms per world:
 *  - "members:<world>", where anyone in the world can send, so nothing from it counts as the GM's:
 *    - "hello" (player → GM): a player just opened the app; the GM's app answers with "table".
 *    - "dice" (players): a roll the whole table sees.
 *    - "ping" (players): "look here", a spot on a map everyone looking at that map sees for a moment.
 *    - "downtime" (player → GM): a player sent downtime, so the GM's list reloads.
 *    - "signal" and "call-answer", but only from a server without the GM's inbox yet (see below).
 *    A roll or a ping carries its sender's user id, and shows under that member's name from the
 *    world's member list (their characters' first names, or the name they joined with). The name
 *    it says it's from counts only for an older app that sends no id, and never reads as the GM's.
 *  - "table:<world>", where only a GM can send (public.channel_allowed), so players can trust it:
 *    - "table" (GM → players): the session being played, the scene, whose turn it is, the music,
 *      and whether the GM's app is recording (players see "This session is being recorded").
 *    - "dice" and "ping" (GM): the GM's own rolls and pings.
 *    - "downtime" (GM → players): the GM answered downtime.
 *    - "signal-seen" (GM → players): the GM saw a signal.
 *  - "gm:<world>", the GM's inbox: anyone in the world can post, only a GM can listen, so a secret
 *    roll's result isn't in a room every player's app hears:
 *    - "signal" (player → GM): "I'd like to do something", "I need a break" or "I'll use inspiration".
 *    - "call-answer" (player → GM): a player's result for the roll the GM called for.
 *    A server without this room refuses the post, and the player's app sends to the members' room instead.
 * The GM's messages go only to the GM's room (every server has it since 20261029010000_review_fixes.sql),
 * and players' apps only believe GM messages from there: one in the members' room is a player's.
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
  /** A player's roll, from the members' room: who sent it, so its name can be looked up again. */
  from?: Sender
}

/** Who a message in the members' room came from: their user id (an older app sends none) and the name it was signed with. */
interface Sender {
  uid?: string
  said: string
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
  /** A player's ping: who sent it, so its name can be looked up again. */
  from?: Sender
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
  /** For a player: when the GM's app last said it's recording (it says so every minute while it is; 0 once it says it stopped). */
  recordingAt: number
  /** When someone last said downtime changed (a player sent one, or the GM answered), so lists reload at once. */
  downtime: number
  rolls: TableRoll[]
  /** For the GM: signals players sent that haven't been answered. */
  signals: TableSignal[]
  /** For a player: signals sent from here, and whether the GM saw them. */
  sent: Record<string, 'sent' | 'seen'>
}

const empty: TableStore = { table: null, pings: [], heard: 0, recordingAt: 0, downtime: 0, rolls: [], signals: [], sent: {}, answers: [], answered: {} }
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
  const fresh = now - store.heard < STALE_AFTER
  // "Being recorded" fades the same way, so a GM's app that closed mid-recording doesn't leave it up.
  return { ...store, table: fresh && store.table ? store.table : null, recording: now - store.recordingAt < STALE_AFTER }
}

const HEARTBEAT = 60_000
const STALE_AFTER = 3 * HEARTBEAT

const room = (cloudId: string) => `members:${cloudId}`
const gmRoom = (cloudId: string) => `table:${cloudId}`
const inbox = (cloudId: string) => `gm:${cloudId}`

/** When the server last refused the GM's inbox (one without the room yet), so players don't ask every time. */
const inboxRefused = new Map<string, number>()
const ASK_AGAIN = 10 * 60_000

/** A player's message for the GM's eyes only: to the GM's inbox, or the members' room on a server without one. */
async function sendToGM(cloudId: string, event: string, payload: object) {
  const refused = inboxRefused.get(cloudId)
  if (!refused || Date.now() - refused > ASK_AGAIN) {
    if (await postOnce(inbox(cloudId), event, payload)) {
      inboxRefused.delete(cloudId)
      return true
    }
    inboxRefused.set(cloudId, Date.now())
  }
  return send(cloudId, event, payload)
}

/** A player's message: to the members' room, where everyone listens. */
const send = (cloudId: string, event: string, payload: object) => {
  const link = links.get(cloudId)
  return link ? link.members.send(event, payload) : sendOnce(room(cloudId), event, payload)
}

/**
 * The GM's message: to the GM's room only, where nobody else can send. (It once went to the members'
 * room too, for a server without the GM's room; players can post there, so they could pass for the GM.)
 */
function sendAsGM(cloudId: string, event: string, payload: object) {
  const link = links.get(cloudId)
  return link ? link.table.send(event, payload) : sendOnce(gmRoom(cloudId), event, payload)
}

/** Who's signed in here: rolls and pings carry it, so other apps show them under that member's name. */
async function myUserId() {
  try {
    return (await supabase.auth.getSession()).data.session?.user.id
  } catch {
    return undefined
  }
}

// ---------- reading what arrives (nothing is taken on trust, not even from the GM's room) ----------

const text = (x: unknown, max = 80) => (typeof x === 'string' ? x.slice(0, max) : '')
const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const SIDES = ['pc', 'ally', 'foe'] as const
const KINDS: SignalKind[] = ['act', 'break', 'inspiration']

// ---------- who's who: names come from the world's member list, not from what a message says ----------

/** Per world: each member's user id, and the name their rolls and pings go by. */
const rosters = new Map<string, Map<string, string>>()

/** A member's name at the table: their characters' first names ("Wren & Bram"), else the name they joined with. Like useMe's. */
const tableName = (joinedAs: string, characters: string[]) =>
  characters.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean).join(' & ') || joinedAs.trim() || 'A player'

function rosterOf(members: { userId: string; name: string }[], claims: { entityId: string; userId: string; approved?: boolean }[], pages: (Entity | undefined)[]) {
  const names = new Map(pages.flatMap((e) => (e ? [[e.id, e.name] as const] : [])))
  return new Map(
    members.map((m) => [m.userId, tableName(m.name, claims.filter((c) => c.userId === m.userId && c.approved !== false).map((c) => names.get(c.entityId) ?? ''))]),
  )
}

/** The name a player's roll or ping shows: theirs from the member list, else (an older app) what it was signed with, never as the GM. */
function senderName(cloudId: string, { uid, said }: Sender) {
  const name = (uid && rosters.get(cloudId)?.get(uid)) || said.trim() || 'A player'
  return posingAsGM(name) ? `${name} (a player)` : name
}

function setRoster(cloudId: string, roster: Map<string, string>) {
  rosters.set(cloudId, roster)
  // Whatever arrived before the list did gets its proper name now.
  const named = <T extends { who: string; from?: Sender }>(x: T) => (x.from ? { ...x, who: senderName(cloudId, x.from) } : x)
  update(cloudId, (s) => ({ ...s, rolls: s.rolls.map(named), pings: s.pings.map(named) }))
}

/** A player's app: the member list and who plays whom come with the joined world, so the names follow it. */
function watchRoster(cloudId: string) {
  const sub = liveQuery(async () => {
    const s = (await db.worlds.get(memberWorldId(cloudId)))?.shared
    const claims = s?.claims ?? []
    return rosterOf(s?.members ?? [], claims, await db.entities.bulkGet(claims.map((c) => c.entityId)))
  }).subscribe({ next: (r) => setRoster(cloudId, r), error: () => {} })
  return () => sub.unsubscribe()
}

/** The GM's app: asks the cloud who has joined, and asks again (at most once a minute) when someone it doesn't know turns up. */
function rosterFetcher(cloudId: string) {
  let asked = 0
  return (uid?: string) => {
    if (uid !== undefined && (!uid || rosters.get(cloudId)?.has(uid) || Date.now() - asked < 60_000)) return
    asked = Date.now()
    listPlayers(cloudId).then(
      async ({ members, claims }) => setRoster(cloudId, rosterOf(members, claims, await db.entities.bulkGet(claims.map((c) => c.entityId)))),
      () => {
        // Offline: names stay as they came for now.
      },
    )
  }
}

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

/** Who sent something to the members' room, as it says (only the user id is looked up). */
const senderOf = (p: Record<string, unknown>): Sender => ({ uid: text(p.uid, 64) || undefined, said: text(p.who, 40) })

/** A roll as it arrived: from the GM's room it's the GM's (or a co-GM's), from the members' room a player's. */
function readRoll(cloudId: string, p: Record<string, unknown>, fromGM: boolean): TableRoll | null {
  if (!text(p.id) || !text(p.expr)) return null
  const from = fromGM ? undefined : senderOf(p)
  return {
    id: text(p.id),
    who: from ? senderName(cloudId, from) : text(p.who) || 'GM',
    expr: text(p.expr, 60),
    total: num(p.total),
    detail: text(p.detail, 300),
    crit: p.crit === 'high' || p.crit === 'low' ? p.crit : undefined,
    at: Date.now(),
    from,
  }
}

/** A name that reads as the GM's ("GM", "DM", "Game Master (Sam)"). From a player, it gets "(a player)" after it. */
const posingAsGM = (who: string) => /^\s*(the\s+)?(gm|dm|game\s*master|dungeon\s*master)\b/i.test(who)

function readPing(cloudId: string, p: Record<string, unknown>, fromGM: boolean): MapPing | null {
  const at = p.at as unknown[]
  if (!text(p.id) || !text(p.mapId) || !Array.isArray(at) || at.length !== 2) return null
  const from = fromGM ? undefined : senderOf(p)
  return { id: text(p.id), mapId: text(p.mapId), at: [num(at[0]), num(at[1])], who: from ? senderName(cloudId, from) : text(p.who, 40) || 'GM', gm: fromGM, time: Date.now(), from }
}

/**
 * Keeps a roll or ping once (each has its own id). The GM's room's copy wins over a members' room
 * one: an older GM app still sends its own to both rooms, and the members' room copy reads as a player's.
 */
function withOne<T extends { id: string; from?: Sender }>(list: T[], x: T, add: (list: T[]) => T[]) {
  const had = list.find((y) => y.id === x.id)
  if (!had) return add(list)
  return had.from && !x.from ? list.map((y) => (y.id === x.id ? x : y)) : list
}

const addPing = (cloudId: string, ping: MapPing) =>
  update(cloudId, (s) => {
    const pings = withOne(s.pings, ping, (l) => [...l.filter((x) => Date.now() - x.time < 10_000), ping].slice(-20))
    return pings === s.pings ? s : { ...s, pings }
  })

/** Points at a spot on a map for everyone looking at it. */
export async function sendPing(cloudId: string, mapId: string, at: [number, number], who: string) {
  const link = links.get(cloudId)
  const ping = { id: newId(), mapId, at, who, gm: !!link?.host }
  addPing(cloudId, { ...ping, time: Date.now() })
  const out = { ...ping, uid: await myUserId() }
  return link?.host ? sendAsGM(cloudId, 'ping', out) : send(cloudId, 'ping', out)
}

const addRoll = (cloudId: string, r: TableRoll) =>
  update(cloudId, (s) => {
    const rolls = withOne(s.rolls, r, (l) => [r, ...l].slice(0, 30))
    return rolls === s.rolls ? s : { ...s, rolls }
  })

// ---------- players ----------

/** A player's side of the link, kept open while their world is on screen. */
export function linkAsPlayer(cloudId: string) {
  const members = joinRoom(room(cloudId))
  const table = joinRoom(gmRoom(cloudId))
  const link = { members, table, host: false }
  links.set(cloudId, link)
  const stopRoster = watchRoster(cloudId)
  const hello = async () => void members.send('hello', { uid: await myUserId() })
  members.on(JOINED, hello)
  // The GM answers in the GM's room, so say hello again once we're in it too.
  table.on(JOINED, hello)
  if (members.connected()) void hello()
  // What the GM says counts only from the GM's room, where nobody else can send. The same thing
  // in the members' room is a player passing for the GM (or an older GM app), and is ignored.
  // "recording" is said by the GM's app that records (every minute while it does, and false once it
  // stops); another of the GM's apps says nothing about it, so it can't switch it off by mistake.
  table.on('table', (p) =>
    update(cloudId, (s) => ({ ...s, table: readTable(p), heard: Date.now(), recordingAt: p.recording === true ? Date.now() : p.recording === false ? 0 : s.recordingAt })),
  )
  table.on('downtime', () => update(cloudId, (s) => ({ ...s, downtime: Date.now() })))
  table.on<{ id?: unknown }>('signal-seen', (p) => {
    const id = text(p.id)
    update(cloudId, (s) => (s.sent[id] ? { ...s, sent: { ...s.sent, [id]: 'seen' } } : s))
  })
  // Rolls and pings: the GM's from the GM's room, the other players' from the members' room.
  for (const [r, fromGM] of [
    [table, true],
    [members, false],
  ] as const) {
    r.on('dice', (p) => {
      const roll = readRoll(cloudId, p, fromGM)
      if (roll) addRoll(cloudId, roll)
    })
    r.on('ping', (p) => {
      const ping = readPing(cloudId, p, fromGM)
      if (ping) addPing(cloudId, ping)
    })
  }
  return () => {
    if (links.get(cloudId) === link) links.delete(cloudId)
    stopRoster()
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
  const ok = await sendToGM(cloudId, 'signal', sig)
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
  const ok = await sendToGM(cloudId, 'call-answer', answer)
  if (!secret) await shareRoll(cloudId, { who: a.who, expr: a.expr, total: a.total, detail: a.detail, crit: a.crit })
  return ok
}

/** Shows a roll to everyone at the table (and here). */
export async function shareRoll(cloudId: string, r: Omit<TableRoll, 'id' | 'at' | 'from'>) {
  const link = links.get(cloudId)
  // A player whose name happens to be "GM" still reads as a player.
  const who = link && !link.host && posingAsGM(r.who) ? `${r.who.trim()} (a player)` : r.who
  const roll = { ...r, who, id: newId(), at: Date.now() }
  addRoll(cloudId, roll)
  const out = { ...roll, uid: await myUserId() }
  return link?.host ? sendAsGM(cloudId, 'dice', out) : send(cloudId, 'dice', out)
}

// ---------- the GM ----------

/** The GM's side: answers players who arrive, and collects their rolls and signals. */
export function linkAsHost(cloudId: string, current: () => TableState | null) {
  const members = joinRoom(room(cloudId))
  const table = joinRoom(gmRoom(cloudId))
  // Only GMs may listen here (a server without the room yet just doesn't let anyone in).
  const gmInbox = joinRoom(inbox(cloudId))
  const link = { members, table, host: true }
  links.set(cloudId, link)
  // Who's who, for players' rolls and pings: asked now, and again when someone new turns up.
  const learn = rosterFetcher(cloudId)
  learn()
  const tell = (stopped = false) => void sendAsGM(cloudId, 'table', wire(cloudId, current(), stopped))
  members.on('hello', (p) => {
    tell()
    learn(text(p.uid, 64))
  })
  // Nothing to say while no session is being run or recorded: players start from nothing anyway.
  const remind = () => (current() || recordingHere(cloudId)) && tell()
  table.on(JOINED, remind)
  // Players hear at once when a recording starts or stops.
  let recording = recordingHere(cloudId)
  const unwatch = recordingStore.subscribe(() => {
    if (recordingHere(cloudId) === recording) return
    recording = !recording
    tell(!recording)
  })
  // Players' rolls and pings from the members' room, and a co-GM's from the GM's room.
  for (const [r, fromGM] of [
    [table, true],
    [members, false],
  ] as const) {
    r.on('dice', (p) => {
      const roll = readRoll(cloudId, p, fromGM)
      if (!roll) return
      addRoll(cloudId, roll)
      learn(roll.from?.uid ?? '')
    })
    r.on('ping', (p) => {
      const ping = readPing(cloudId, p, fromGM)
      if (!ping) return
      addPing(cloudId, ping)
      learn(ping.from?.uid ?? '')
    })
  }
  members.on('downtime', () => update(cloudId, (s) => ({ ...s, downtime: Date.now() })))
  const onAnswer = (p: Record<string, unknown>) => {
    const callId = text(p.callId)
    const call = current()?.call
    if (!call || call.id !== callId || !text(p.id)) return
    const entityId = text(p.entityId) || undefined
    if (call.to.length && (!entityId || !call.to.includes(entityId))) return
    const a: CallAnswer = { id: text(p.id), callId, entityId, who: text(p.who) || 'A player', expr: text(p.expr, 60), total: num(p.total), detail: text(p.detail, 300), crit: p.crit === 'high' || p.crit === 'low' ? p.crit : undefined }
    update(cloudId, (s) => (s.answers.some((x) => x.id === a.id) ? s : { ...s, answers: [...s.answers, a].slice(-60) }))
  }
  const onSignal = (p: Record<string, unknown>) => {
    const kind = p.kind as SignalKind
    if (!KINDS.includes(kind) || !text(p.id)) return
    const sig: TableSignal = { id: text(p.id), kind, who: text(p.who) || 'A player', entityId: text(p.entityId) || undefined, at: Date.now() }
    update(cloudId, (s) => (s.signals.some((x) => x.id === sig.id) ? s : { ...s, signals: [...s.signals, sig].slice(-20) }))
  }
  // From the GM's inbox, and from the members' room (older player apps, or a server without the inbox).
  for (const r of [gmInbox, members]) {
    r.on('call-answer', onAnswer)
    r.on('signal', onSignal)
  }
  // Players stop showing "playing now" (and "being recorded") if they hear nothing for a few minutes, so say it again now and then (only while live or recording).
  const beat = setInterval(remind, HEARTBEAT)
  return () => {
    clearInterval(beat)
    unwatch()
    if (links.get(cloudId) === link) links.delete(cloudId)
    members.leave()
    table.leave()
    gmInbox.leave()
  }
}

/** The GM's app sends what players should see now (null: nothing is being played). */
export function publishTable(cloudId: string, state: TableState | null) {
  const before = get(cloudId).table
  if (JSON.stringify(before) === JSON.stringify(state)) return
  // The GM's own copy, so previewing the Common Room shows it too.
  update(cloudId, (s) => ({ ...s, table: state, heard: Date.now() }))
  void sendAsGM(cloudId, 'table', wire(cloudId, state))
}

/**
 * A table state as sent: with the sender's clock (so timers can be shifted onto each player's), and
 * whether this app is recording a session of the world, so players are told (even with no session
 * live). Only the app that records says either way (stopped: it just stopped).
 */
function wire(cloudId: string, state: TableState | null, stopped = false) {
  const recording = recordingHere(cloudId) ? { recording: true } : stopped ? { recording: false } : {}
  return state ? { ...state, ...recording, sentAt: Date.now() } : { off: true, ...recording }
}

// ---------- "This session is being recorded" ----------

/** Whether this device's app is recording a session of this world right now. */
const recordingHere = (worldId: string) => recordingStore.get()?.worldId === worldId

/**
 * A recording carries on while the GM looks at another world or the list of worlds, where the
 * world's own link (linkAsHost) isn't open to say so: then this does, once a minute, and once more
 * when it stops, so players are never recorded without being told.
 */
let recordingWorld: string | undefined
let unlinkedBeat: ReturnType<typeof setInterval> | undefined
recordingStore.subscribe(() => {
  const now = recordingStore.get()?.worldId
  if (now === recordingWorld) return
  const was = recordingWorld
  recordingWorld = now
  clearInterval(unlinkedBeat)
  unlinkedBeat = now ? setInterval(() => void sayUnlinked(now, false), HEARTBEAT) : undefined
  if (was) void sayUnlinked(was, true)
})
async function sayUnlinked(worldId: string, stopped: boolean) {
  if (links.get(worldId)?.host) return
  const w = await db.worlds.get(worldId)
  if (w?.cloud?.enabled && !w.shared) void sendOnce(gmRoom(worldId), 'table', wire(worldId, get(worldId).table, stopped))
}

/**
 * The players' screen is a window of its own (for a TV), so it can't see a recording another window
 * on the device is making. The window that records says so on a channel between the device's windows,
 * when it starts and stops and every few seconds in between (so a closed window's word runs out).
 */
const RECORDING_CHANNEL = 'codex.recording'
const RECORDING_BEAT = 5_000
if (typeof BroadcastChannel === 'function') {
  const out = new BroadcastChannel(RECORDING_CHANNEL)
  const say = () => out.postMessage({ recording: recordingStore.get()?.worldId ?? null })
  // A players' screen that just opened asks straight away.
  out.onmessage = (e) => e.data === 'ask' && recordingStore.get() && say()
  let beat: ReturnType<typeof setInterval> | undefined
  recordingStore.subscribe(() => {
    const on = !!recordingStore.get()
    if (on === !!beat) return
    clearInterval(beat)
    beat = on ? setInterval(say, RECORDING_BEAT) : undefined
    say()
  })
}

/** For the players' screen: whether this device is recording a session of this world, in this window or another. */
export function useRecordingOnThisDevice(worldId: string) {
  const here = useSyncExternalStore(recordingStore.subscribe, () => recordingHere(worldId))
  const [heard, setHeard] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (typeof BroadcastChannel !== 'function') return
    const ch = new BroadcastChannel(RECORDING_CHANNEL)
    ch.onmessage = (e) => {
      const said = (e.data as { recording?: unknown } | null)?.recording
      if (said !== undefined) setHeard(said === worldId ? Date.now() : 0)
    }
    ch.postMessage('ask')
    const t = setInterval(() => setNow(Date.now()), RECORDING_BEAT)
    return () => {
      ch.close()
      clearInterval(t)
    }
  }, [worldId])
  return here || (heard > 0 && now - heard < 3 * RECORDING_BEAT)
}

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
  const order = initiativeOrder(l.combat.combatants.filter((c) => !c.defeated))
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
