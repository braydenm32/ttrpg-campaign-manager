import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, type World } from '../db'
import { Help } from '../help'

/**
 * For players: what's new since they last looked. Pages and sessions the GM has just revealed, and
 * answers to their questions, collected each time the world refreshes, until they say "got it".
 */
export function NewsBanner({ world }: { world: World }) {
  const news = world.shared?.news
  const pages = useLiveQuery(() => db.entities.bulkGet(news?.entityIds ?? []), [news?.entityIds?.join()]) ?? []
  const sessions = useLiveQuery(() => db.sessions.bulkGet(news?.sessionIds ?? []), [news?.sessionIds?.join()]) ?? []
  if (!news) return null
  const answers = (world.shared?.questions ?? []).filter((q) => news.questionIds.includes(q.id))
  const clear = () =>
    db.worlds
      .where('id')
      .equals(world.id)
      .modify((w) => {
        if (w.shared) w.shared.news = undefined
      })
  return (
    <div className="news-banner" role="status">
      <div className="row spread">
        <strong>
          ✨ New since you last looked <Help topic="news" />
        </strong>
        <button className="small" onClick={clear}>
          Got it
        </button>
      </div>
      <div className="row wrap small">
        {pages.map((e) => e && (
          <Link key={e.id} className="chip" to={`/w/${world.id}/e/${e.id}`}>
            📄 {e.name}
          </Link>
        ))}
        {sessions.map((s) => s && (
          <Link key={s.id} className="chip" to={`/w/${world.id}/s/${s.id}`}>
            📖 #{s.number} {s.title}
          </Link>
        ))}
        {answers.map((q) => (
          <Link key={q.id} className="chip" to={q.entityId ? `/w/${world.id}/e/${q.entityId}` : `/w/${world.id}/questions`}>
            💬 Your GM answered “{q.body.length > 40 ? `${q.body.slice(0, 40)}…` : q.body}”
          </Link>
        ))}
      </div>
    </div>
  )
}
