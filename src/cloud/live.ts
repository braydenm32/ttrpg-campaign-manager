import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './client'

/**
 * Live rooms: one private realtime channel per topic ("members:<world>", "safety:<world>",
 * "share:<link>"), shared by every part of the app that uses it. The realtime client hands back the
 * same channel for the same topic, so if each part opened and closed its own, one closing would cut
 * the others off. Here each user joins, listens to the events it cares about and leaves; the channel
 * closes a little after the last one leaves.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (payload: any) => void

interface Room {
  ch?: RealtimeChannel
  refs: number
  handlers: Map<string, Set<Handler>>
  joined: boolean
  waiters: Set<(ok: boolean) => void>
  closeTimer?: ReturnType<typeof setTimeout>
}

const rooms = new Map<string, Room>()
/** Channels still closing, so a new one for the same topic waits rather than getting the dying one. */
const closing = new Map<string, Promise<unknown>>()

/** Fired here (never sent) each time the room connects, including after a dropped connection. */
export const JOINED = 'joined'

/** How long an empty room stays open, so quick leave-and-rejoin (changing pages) doesn't reconnect. */
const LINGER = 20_000

function open(topic: string): Room {
  const had = rooms.get(topic)
  if (had) {
    clearTimeout(had.closeTimer)
    had.closeTimer = undefined
    return had
  }
  const room: Room = { refs: 0, handlers: new Map(), joined: false, waiters: new Set() }
  rooms.set(topic, room)
  const start = () => {
    if (rooms.get(topic) !== room) return
    const ch = supabase.channel(topic, { config: { private: true } })
    room.ch = ch
    ch.on('broadcast', { event: '*' }, (msg) => fire(room, msg.event, msg.payload ?? {}))
    ch.subscribe((status) => {
      room.joined = status === 'SUBSCRIBED'
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        for (const w of room.waiters) w(room.joined)
        room.waiters.clear()
      }
      if (room.joined) fire(room, JOINED, {})
    })
  }
  const wait = closing.get(topic)
  if (wait) wait.finally(start)
  else start()
  return room
}

function fire(room: Room, event: string, payload: unknown) {
  for (const h of [...(room.handlers.get(event) ?? [])]) {
    try {
      h(payload)
    } catch (e) {
      console.error(e)
    }
  }
}

function close(topic: string, room: Room) {
  if (room.refs > 0 || rooms.get(topic) !== room) return
  rooms.delete(topic)
  for (const w of room.waiters) w(false)
  room.waiters.clear()
  if (!room.ch) return
  const done = supabase.removeChannel(room.ch).catch(() => undefined)
  closing.set(topic, done)
  void done.finally(() => closing.get(topic) === done && closing.delete(topic))
}

export interface LiveRoom {
  /** Calls fn for each message of this kind. Returns a function that stops listening. */
  on: <T = Record<string, unknown>>(event: string, fn: (payload: T) => void) => () => void
  /** Sends a message to everyone else in the room. False if it couldn't be sent in time. */
  send: (event: string, payload?: object, wait?: number) => Promise<boolean>
  /** Whether the room is connected right now. */
  connected: () => boolean
  /** Stops using the room. Call once. */
  leave: () => void
}

/** Joins a live room (opening it if nobody has yet). */
export function joinRoom(topic: string): LiveRoom {
  const room = open(topic)
  room.refs++
  const mine: [string, Handler][] = []
  let left = false
  return {
    on(event, fn) {
      const set = room.handlers.get(event) ?? new Set()
      room.handlers.set(event, set)
      set.add(fn as Handler)
      mine.push([event, fn as Handler])
      return () => set.delete(fn as Handler)
    },
    async send(event, payload = {}, wait = 5000) {
      if (rooms.get(topic) !== room) return false
      if (!room.joined) {
        const ok = await new Promise<boolean>((resolve) => {
          const t = setTimeout(() => {
            room.waiters.delete(done)
            resolve(false)
          }, wait)
          const done = (ok: boolean) => {
            clearTimeout(t)
            resolve(ok)
          }
          room.waiters.add(done)
        })
        if (!ok) return false
      }
      try {
        return (await room.ch!.send({ type: 'broadcast', event, payload })) === 'ok'
      } catch {
        return false
      }
    },
    connected: () => room.joined && rooms.get(topic) === room,
    leave() {
      if (left) return
      left = true
      for (const [event, fn] of mine) room.handlers.get(event)?.delete(fn)
      room.refs--
      if (room.refs <= 0) {
        clearTimeout(room.closeTimer)
        room.closeTimer = setTimeout(() => close(topic, room), LINGER)
      }
    },
  }
}

/** Sends one message to a room without staying in it (it reuses the room if it's already open). */
export async function sendOnce(topic: string, event: string, payload: object = {}, wait = 5000) {
  const room = joinRoom(topic)
  try {
    return await room.send(event, payload, wait)
  } finally {
    room.leave()
  }
}
