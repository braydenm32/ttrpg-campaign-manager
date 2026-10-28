import { Link } from 'react-router-dom'
import { Empty } from '../components'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { useWorldSessions } from '../threads'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { BookBookmark } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { LEDGER_NAME } from '../ai/worldUpdates'

/**
 * The Chronicle: every change made to the world from a session's world updates, newest session
 * first, so the GM can see what moved and when. GM-only (the lines live on each session).
 */
export default function Chronicle() {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
  const sessions = useWorldSessions(worldId)
  const entities = useVisibleEntities(worldId)
  if (!isGM) return <Empty>Only the GM can see this.</Empty>
  const byId = new Map(entities.map((e) => [e.id, e]))
  const withChanges = sessions.filter((s) => s.ledger?.length).sort((a, b) => b.number - a.number || (b.date || '').localeCompare(a.date || ''))
  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={BookBookmark} /> {LEDGER_NAME} <Help topic="chronicle" />
        </h1>
      </header>
      {withChanges.length === 0 ? (
        <Empty>
          Nothing yet. After a session, “Write up this session” suggests changes to your pages from the transcript; the ones you add are listed here.
        </Empty>
      ) : (
        withChanges.map((s) => (
          <section key={s.id}>
            <h2>
              <Link to={`${worldPath(worldId)}/s/${s.id}`}>
                Session {s.number}: {s.title}
              </Link>
              {s.date && <span className="muted small"> · {s.date}</span>}
            </h2>
            <ul className="entity-list chronicle">
              {s.ledger!.map((l) => {
                const page = l.entityId ? byId.get(l.entityId) : undefined
                return (
                  <li key={l.id}>
                    {l.made && <span className="badge new">new</span>} {page ? <Link to={pagePath(worldId, page.id)}>{l.text}</Link> : <span>{l.text}</span>}
                    {l.entityId && !page && <span className="muted small"> (page since deleted)</span>}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
