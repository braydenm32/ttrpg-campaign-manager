import { useLiveQuery } from 'dexie-react-hooks'
import { blankEntity, db, type Entity, type Session, type ThreadStatus } from './db'
import { stripSecrets } from './Markdown'
import { useViewMode } from './viewMode'

/** The pages a thread involves: anything it [[links]] to, plus where it's located. */
export function threadLinks(thread: Entity, entities: Entity[], showSecrets: boolean) {
  const byName = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e]))
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

/** All sessions in a world the viewer may see, oldest first. */
export function useWorldSessions(worldId: string) {
  const { isGM } = useViewMode()
  return (
    useLiveQuery(
      () =>
        db.sessions
          .where({ worldId })
          .filter((s) => isGM || s.visibility === 'players')
          .sortBy('date'),
      [worldId, isGM],
    ) ?? []
  )
}

/** The session most recently played (or the newest one, if none has a date yet). */
export function latestSession(sessions: Session[]) {
  const today = new Date().toISOString().slice(0, 10)
  const played = sessions.filter((s) => s.date && s.date <= today)
  return played.at(-1) ?? sessions.at(-1)
}

/** How many sessions have been played since the thread was last touched. */
export function sessionsSinceTouched(thread: Entity, sessions: Session[]) {
  const touched = new Date(thread.updatedAt).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return sessions.filter((s) => s.date && s.date > touched && s.date <= today).length
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
