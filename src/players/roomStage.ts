import type { Campaign, DateOption, Session } from '../db'
import { bySessionOrder } from '../threads'
import { localDate } from '../sessions'

/**
 * Where the players are between one game night and the next, for the Common Room's Now tab:
 *
 * - during: the GM is running a session live (the live link is on).
 * - before: the next booked or dated game is less than a day away. The next date comes first.
 * - after: there's a recap to read, or this device saw a live session in the last day and a half
 *   (the recap may still be coming). Last time's recap comes first and stays first until the next
 *   game is close.
 * - before also covers any other time (nothing played yet).
 *
 * Only what players actually receive decides it (public.player_view in supabase/migrations: a
 * session's number, title, date and recap, a campaign's booked date and suggested dates, and the
 * live link). The GM's own marks (started, played, notes) never reach players, so they're not used,
 * and the GM's "Player view" preview then shows the same as a player would.
 */
export type RoomStage = 'before' | 'during' | 'after'

/** The parts of a session players get. */
export type PlayerSession = Pick<Session, 'id' | 'campaignId' | 'number' | 'title' | 'date' | 'recap'>

export type NextSession =
  | { kind: 'booked'; campaign: Campaign; at: DateOption; time: number }
  | { kind: 'dated'; session: PlayerSession; time: number }
  | { kind: 'poll'; campaign: Campaign; count: number }
  | { kind: 'unset' }

/** A booked date still ahead (or earlier today). */
const bookedTime = (c: Campaign, now: number) => {
  const b = c.booked
  if (!b) return undefined
  const t = new Date(b.utc ?? b.at).getTime()
  return t > now - 12 * 3_600_000 ? t : undefined
}

/**
 * When the party plays next: the date the GM booked, else a revealed session dated today or later,
 * else the dates the GM suggested (the date poll), else not set. `campaigns` are the ones that
 * matter to this player (theirs, or all they can see), most relevant first.
 */
export function nextSession(campaigns: Campaign[], sessions: PlayerSession[], now = Date.now()): NextSession {
  const booked = campaigns
    .map((c) => ({ c, t: bookedTime(c, now) }))
    .filter((x): x is { c: Campaign; t: number } => x.t !== undefined)
    .sort((a, b) => a.t - b.t)[0]
  if (booked) return { kind: 'booked', campaign: booked.c, at: booked.c.booked!, time: booked.t }
  const today = localDate(now)
  const ids = new Set(campaigns.map((c) => c.id))
  const dated = sessions
    .filter((s) => s.date && s.date >= today && !s.recap.trim() && (!ids.size || ids.has(s.campaignId)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number)[0]
  if (dated) return { kind: 'dated', session: dated, time: new Date(`${dated.date}T00:00`).getTime() }
  const poll = campaigns.find((c) => c.schedule?.length)
  if (poll) return { kind: 'poll', campaign: poll, count: poll.schedule!.length }
  return { kind: 'unset' }
}

/** Last time: the newest session players can read a recap of. */
export function lastTime<S extends PlayerSession>(sessions: S[]) {
  return sessions
    .filter((s) => s.recap.trim())
    .sort(bySessionOrder)
    .at(-1)
}

const HOUR = 3_600_000

/** The stage, from what players get. `liveSeenAt` is when this device last saw the GM's live link (0 if never). */
export function roomStage({ live, next, last, liveSeenAt = 0, now = Date.now() }: { live: boolean; next: NextSession; last?: PlayerSession; liveSeenAt?: number; now?: number }): RoomStage {
  if (live) return 'during'
  // The next game is close: getting ready matters more than looking back.
  if ((next.kind === 'booked' || next.kind === 'dated') && next.time - now < 24 * HOUR) return 'before'
  // Otherwise last time's recap stays on top until the next game.
  if (last || (liveSeenAt && now - liveSeenAt < 36 * HOUR)) return 'after'
  return 'before'
}

const liveKey = (worldId: string) => `codex.room.liveSeen.${worldId}`

/** When this device last saw the GM's live link for a world (0 if never, or storage is blocked). */
export function liveSeenAt(worldId: string) {
  try {
    return Number(localStorage.getItem(liveKey(worldId))) || 0
  } catch {
    return 0
  }
}

/** Notes that this device saw the GM's live link just now. */
export function markLiveSeen(worldId: string, at = Date.now()) {
  try {
    localStorage.setItem(liveKey(worldId), String(at))
  } catch {
    // Storage blocked: "just played" is only known while the page stays open.
  }
}
