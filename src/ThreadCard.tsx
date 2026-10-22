import { Link } from 'react-router-dom'
import { VisibilityBadge } from './components'
import { db, ENTITY_LABELS, THREAD_STATUS, type Entity, type Session } from './db'
import { COLD_AFTER, sessionsSinceTouched, setThreadStatus, threadLinks, URGENCY } from './threads'
import { plainLinks } from './text'
import { useViewMode } from './viewMode'

const sessionName = (sessions: Session[], id?: string) => {
  const s = id && sessions.find((x) => x.id === id)
  return s ? `#${s.number} ${s.title}` : ''
}

/** One loose thread: what it is, who and where it involves, and (for the GM) buttons to move it along. */
export function ThreadCard({
  thread: t,
  entities,
  sessions,
  worldId,
  currentSessionId,
  highlight,
}: {
  thread: Entity
  entities: Entity[]
  sessions: Session[]
  worldId: string
  /** The session to record when tying the thread off (defaults to none). */
  currentSessionId?: string
  /** Shown as a small note, e.g. "here" in the Lectern. */
  highlight?: string
}) {
  const { isGM } = useViewMode()
  const status = t.threadStatus ?? 'open'
  const links = threadLinks(t, entities, isGM)
  const idle = sessionsSinceTouched(t, sessions)
  const unresolved = status === 'open' || status === 'active'
  const urgency = URGENCY[t.threadUrgency ?? 'normal']
  const raised = sessionName(sessions, t.raisedIn)
  const tied = sessionName(sessions, t.tiedOffIn)

  return (
    <div className={`thread-card status-${status} urgency-${t.threadUrgency ?? 'normal'}`}>
      <div className="row spread">
        <Link to={`/w/${worldId}/e/${t.id}`} className="thread-name">
          {urgency.icon && <span title={urgency.label}>{urgency.icon} </span>}
          {t.name}
        </Link>
        {isGM && <VisibilityBadge value={t.visibility} />}
      </div>
      {t.summary && <div className="small">{plainLinks(t.summary)}</div>}
      {links.length > 0 && (
        <div className="tags">
          {links.map((e) => (
            <Link key={e.id} className="tag" to={`/w/${worldId}/e/${e.id}`}>
              {ENTITY_LABELS[e.type].icon} {e.name}
            </Link>
          ))}
        </div>
      )}
      <div className="muted small">
        {highlight && <span className="thread-highlight">{highlight} · </span>}
        {raised && <>Raised in {raised}</>}
        {tied && <>{raised ? ' · ' : ''}Tied off in {tied}</>}
        {isGM && unresolved && idle >= COLD_AFTER && (
          <span className="thread-cold" title="No change to this thread for a while. Bring it back, or drop it.">
            {raised || tied ? ' · ' : ''}🕸️ untouched for {idle} sessions
          </span>
        )}
      </div>
      {isGM && (
        <div className="row wrap thread-actions">
          {status !== 'active' && unresolved && (
            <button className="ghost small" onClick={() => setThreadStatus(t, 'active')} title={THREAD_STATUS.active.hint}>
              ▶ In play
            </button>
          )}
          {unresolved && (
            <button className="ghost small" onClick={() => setThreadStatus(t, 'resolved', currentSessionId)} title={THREAD_STATUS.resolved.hint}>
              ✓ Tie off
            </button>
          )}
          {unresolved && (
            <button className="ghost small" onClick={() => setThreadStatus(t, 'dropped')} title={THREAD_STATUS.dropped.hint}>
              ✕ Drop
            </button>
          )}
          {!unresolved && (
            <button className="ghost small" onClick={() => setThreadStatus(t, 'open')}>
              ↺ Reopen
            </button>
          )}
          {unresolved && idle >= COLD_AFTER && (
            <button className="ghost small" title="Mark it as still alive" onClick={() => db.entities.update(t.id, { updatedAt: Date.now() })}>
              Still alive
            </button>
          )}
        </div>
      )}
    </div>
  )
}
