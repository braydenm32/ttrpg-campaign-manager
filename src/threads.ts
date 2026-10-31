import { nameIndex } from './links'
import { useLiveQuery } from 'dexie-react-hooks'
import { blankEntity, db, type Campaign, type Entity, type Session, type ThreadStatus } from './db'
import { stripSecrets } from './Markdown'
import { useViewMode } from './viewMode'
import { isPlayed, localDate } from './sessions'

/** The pages a thread involves: anything it [[links]] to, plus where it's located. */
export function threadLinks(thread: Entity, entities: Entity[], showSecrets: boolean) {
  const byName = nameIndex(entities)
  const text = `${thread.summary}\n${showSecrets ? thread.body : stripSecrets(thread.body)}`
  const found = new Map<string, Entity>()
  const parent = thread.parentId && entities.find((e) => e.id === thread.parentId)
  if (parent) found.set(parent.id, parent)
  for (const m of text.matchAll(/\[\[([^\]|]+)/g)) {
    const e = byName.get(m[1].trim().toLowerCase())
    if (e && e.id !== thread.id) found.set(e.id, e)
  }
  return [...found.values()]
}

/** Campaigns the viewer may see: a campaign the GM keeps hidden never shows in the player view. */
export function useCampaigns(worldId: string) {
  const { isGM } = useViewMode()
  return useLiveQuery(() => db.campaigns.where({ worldId }).filter((c) => isGM || c.visibility !== 'gm').toArray(), [worldId, isGM]) ?? []
}

/** Whether a session reaches the viewer: players get it once it's revealed, and never from a campaign the GM keeps hidden. */
export const canSeeSession = (s: Session, campaign: Pick<Campaign, 'visibility'> | null | undefined, isGM: boolean) =>
  isGM || (s.visibility === 'players' && !!campaign && campaign.visibility !== 'gm')

/** Sessions in the order they were played: by date (undated ones first), then by number. */
export const bySessionOrder = (a: Session, b: Session) => (a.date || '').localeCompare(b.date || '') || a.number - b.number

/** All sessions in a world the viewer may see, oldest first (none from a hidden campaign, for players). */
export function useWorldSessions(worldId: string) {
  const { isGM } = useViewMode()
  return (
    useLiveQuery(async () => {
      const campaigns = new Map((await db.campaigns.where({ worldId }).toArray()).map((c) => [c.id, c]))
      const list = await db.sessions
        .where({ worldId })
        .filter((s) => canSeeSession(s, campaigns.get(s.campaignId), isGM))
        .toArray()
      return list.sort(bySessionOrder)
    }, [worldId, isGM]) ?? []
  )
}

/** Whether a session is under way: live or recording now (`playing`), or started and not yet marked played. */
const underWay = (s: Session, playing: Set<string>, today: string) => (playing.has(s.id) && !s.playedAt) || (!!s.startedAt && !isPlayed(s, today))

/**
 * Each running campaign's coming session, the one in hand: the one being played, else a booked
 * session still to come, else the first one not played yet, else its newest. Sessions being played
 * come first, then the soonest. `playing` is the sessions live to players or recording right now.
 * The Desk, the Session area and "Mark as played" all go by this, so they move on together.
 */
export function nextSessions(campaigns: Campaign[], sessions: Session[], playing: Iterable<string> = []) {
  const today = localDate()
  const live = new Set(playing)
  return campaigns
    .filter((c) => c.status !== 'finished')
    .flatMap((c) => {
      const own = sessions.filter((s) => s.campaignId === c.id).sort((a, b) => a.number - b.number)
      const next =
        own.find((s) => underWay(s, live, today)) ??
        own.find((s) => s.date >= today && !isPlayed(s, today)) ??
        own.find((s) => !s.date && !isPlayed(s, today)) ??
        own.at(-1)
      return next ? [{ campaign: c, session: next, underWay: underWay(next, live, today) }] : []
    })
    .sort((a, b) => Number(b.underWay) - Number(a.underWay) || (a.session.date || '9999').localeCompare(b.session.date || '9999'))
}

/** The session most recently played (or the newest one, if none has been played yet). */
export function latestSession(sessions: Session[]) {
  const sorted = [...sessions].sort(bySessionOrder)
  return sorted.filter((s) => isPlayed(s)).at(-1) ?? sorted.at(-1)
}

/**
 * The session in hand, for "raised in" and "tied off in": the one being played, else the one most
 * recently played, or before any has been played, the coming one (the same one the Desk offers).
 */
export function sessionInHand(campaigns: Campaign[], sessions: Session[], playing: Iterable<string> = []) {
  const first = nextSessions(campaigns, sessions, playing)[0]
  if (first?.underWay) return first.session
  return [...sessions].sort(bySessionOrder).filter((s) => isPlayed(s)).at(-1) ?? first?.session ?? latestSession(sessions)
}

/**
 * How many sessions have been played since the thread was last touched. A thread raised in one
 * campaign only counts that campaign's sessions, so a second group's games don't make it go cold.
 */
export function sessionsSinceTouched(thread: Entity, sessions: Session[]) {
  const touched = localDate(thread.updatedAt)
  const today = localDate()
  const campaignId = thread.raisedIn ? sessions.find((s) => s.id === thread.raisedIn)?.campaignId : undefined
  return sessions.filter((s) => s.date && s.date > touched && s.date <= today && (!campaignId || s.campaignId === campaignId)).length
}

/** Unresolved threads untouched for this many sessions get a "going cold" warning. */
export const COLD_AFTER = 3

export function newThread(worldId: string, name: string, raisedIn?: string): Entity {
  return { ...blankEntity(worldId, 'thread', name), raisedIn }
}

export const URGENCY = {
  high: { label: 'Pressing', icon: '🔥' },
  normal: { label: 'Normal', icon: '' },
  low: { label: 'Slow burn', icon: '🕯️' },
} as const

/** Moves a thread along. Tying it off records which session it was resolved in. */
export function setThreadStatus(thread: Entity, status: ThreadStatus, sessionId?: string) {
  return db.entities.update(thread.id, {
    threadStatus: status,
    tiedOffIn: status === 'resolved' ? (sessionId ?? thread.tiedOffIn) : status === 'dropped' ? thread.tiedOffIn : undefined,
    updatedAt: Date.now(),
  })
}
