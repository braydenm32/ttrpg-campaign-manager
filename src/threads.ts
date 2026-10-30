import { nameIndex } from './links'
import { useLiveQuery } from 'dexie-react-hooks'
import { blankEntity, db, type Campaign, type Entity, type Session, type ThreadStatus } from './db'
import { stripSecrets } from './Markdown'
import { useViewMode } from './viewMode'
import { localDate } from './sessions'

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

/**
 * Each running campaign's coming session: the first one not played yet (dated today or later with
 * no recap), or its newest. Soonest first.
 */
export function nextSessions(campaigns: Campaign[], sessions: Session[]) {
  const today = localDate()
  return campaigns
    .filter((c) => c.status !== 'finished')
    .flatMap((c) => {
      const own = sessions.filter((s) => s.campaignId === c.id).sort((a, b) => a.number - b.number)
      // a booked session still to come, else the first one not yet played (no date, no recap), else the newest
      const next = own.find((s) => s.date >= today && !s.recap.trim()) ?? own.find((s) => !s.date && !s.recap.trim()) ?? own.at(-1)
      return next ? [{ campaign: c, session: next }] : []
    })
    .sort((a, b) => (a.session.date || '9999').localeCompare(b.session.date || '9999'))
}

/** A session that has been played: dated today or earlier, or written up without a date. */
const isPlayed = (s: Session, today = localDate()) => (s.date ? s.date <= today : !!s.recap.trim())

/** The session most recently played (or the newest one, if none has been played yet). */
export function latestSession(sessions: Session[]) {
  const sorted = [...sessions].sort(bySessionOrder)
  return sorted.filter((s) => isPlayed(s)).at(-1) ?? sorted.at(-1)
}

/**
 * The session in hand, for "raised in" and "tied off in": the one most recently played, or before
 * any has been played, the coming one (the same one the Desk offers to run).
 */
export function sessionInHand(campaigns: Campaign[], sessions: Session[]) {
  return [...sessions].sort(bySessionOrder).filter((s) => isPlayed(s)).at(-1) ?? nextSessions(campaigns, sessions)[0]?.session ?? latestSession(sessions)
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
