import { Link } from 'react-router-dom'
import { HAS_STATUS, LIFE_STATUS, type Entity, type Session } from './db'
import { worldPath } from './paths'
import { bySessionOrder } from './threads'
import { useViewMode } from './viewMode'

/** A small badge for a character who is dead, missing or captured (alive needs no badge in lists). */
export function StatusBadge({ entity: e, showAlive }: { entity: Entity; showAlive?: boolean }) {
  if (!e.status || (e.status === 'alive' && !showAlive)) return null
  const s = LIFE_STATUS[e.status]
  return (
    <span className={`tag status-life status-${e.status}`} title={e.statusKnown === false ? `${s.label} (players don’t know)` : s.label}>
      {s.icon} {s.label}
    </span>
  )
}

/** The icon for a character's status, for tight spots like map pins ("" when alive or unset). */
export const statusIcon = (e: Entity | undefined) => (e?.status && e.status !== 'alive' ? LIFE_STATUS[e.status].icon : '')

/**
 * The latest session a page turned up in: featured in the session, or (for the GM) present at the
 * Lectern, which players never get. Sessions are the ones the viewer can see, so players only learn
 * of sessions they can read.
 */
export function lastSeenIn(e: Entity, sessions: Session[], isGM: boolean) {
  const seen = sessions.filter((s) => s.entityIds.includes(e.id) || (isGM && s.lectern?.presentIds.includes(e.id)))
  return [...seen].sort(bySessionOrder).at(-1)
}

export function LastSeen({ entity, sessions, worldId }: { entity: Entity; sessions: Session[]; worldId: string }) {
  const { isGM } = useViewMode()
  if (!HAS_STATUS.includes(entity.type)) return null
  const s = lastSeenIn(entity, sessions, isGM)
  if (!s) return null
  return (
    <>
      {' · last seen in '}
      <Link to={`${worldPath(worldId)}/s/${s.id}`}>
        #{s.number} {s.title}
      </Link>
    </>
  )
}
