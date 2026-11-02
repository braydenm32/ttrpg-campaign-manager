import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate } from 'react-router-dom'
import { Empty, Skeleton } from '../components'
import { db } from '../db'
import { useWorld } from '../hooks'
import { bySessionOrder } from '../threads'
import { isPlayed } from '../sessions'
import { useViewMode } from '../viewMode'
import { worldPath } from '../paths'

/**
 * The old Chronicle address. The Chronicle is now "What changed" in each session's Wrap up, so this
 * opens the newest session that changed the world (else the newest one played) at that part. With
 * neither, it says where the list lives now and lists the sessions.
 */
export default function Chronicle() {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
  const sessions = useLiveQuery(async () => (await db.sessions.where({ worldId }).toArray()).sort(bySessionOrder), [worldId])
  if (!isGM) return <Empty>Only the GM can see this.</Empty>
  if (!sessions) return <Skeleton />
  const newestFirst = [...sessions].reverse()
  const target = newestFirst.find((s) => s.ledger?.length) ?? newestFirst.find((s) => isPlayed(s))
  const wrap = (id: string) => `${worldPath(worldId)}/s/${id}?tab=notes&at=changed`
  if (target) return <Navigate to={wrap(target.id)} replace />
  return (
    <div className="page">
      <header className="page-header">
        <h1>What changed</h1>
      </header>
      <p className="lead">
        The Chronicle now lives in each session: open a session’s Wrap up and look under “What changed” for the pages a write-up made or changed.
      </p>
      {newestFirst.length === 0 ? (
        <Empty>No sessions yet.</Empty>
      ) : (
        <ul className="entity-list">
          {newestFirst.map((s) => (
            <li key={s.id}>
              <Link to={wrap(s.id)}>
                Session {s.number}: {s.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
