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

/** All sessions in a world the viewer may see, oldest first (none from a hidden campaign, for players). */
export function useWorldSessions(worldId: string) {
  const { isGM } = useViewMode()
  return (
    useLiveQuery(async () => {
      const hidden = isGM ? new Set<string>() : new Set((await db.campaigns.where({ worldId }).filter((c) => c.visibility === 'gm').toArray()).map((c) => c.id))
      return db.sessions
        .where({ worldId })
        .filter((s) => isGM || (s.visibility === 'players' && !hidden.has(s.campaignId)))
        .sortBy('date')
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
      const next = own.find((s) => s.date >= today && !s.recap.trim()) ?? own.at(-1)
      return next ? [{ campaign: c, session: next }] : []
    })
    .sort((a, b) => (a.session.date || '9999').localeCompare(b.session.date || '9999'))
}

/** The session most recently played (or the newest one, if none has a date yet). */
export function latestSession(sessions: Session[]) {
  const today = localDate()
  const played = sessions.filter((s) => s.date && s.date <= today)
  return played.at(-1) ?? sessions.at(-1)
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
