import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db, type World } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { BookOpen, ChatCircleDots, File, Newspaper, PencilSimple, Sparkle } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'

/**
 * For players: what's new since they last looked. Pages, sessions and handouts the GM has just
 * revealed, answers to their questions, recaps that changed, and what changed on pages they already
 * had (new writing, a status, a clock that moved), collected each time the world refreshes, until
 * they say "got it".
 */
export function NewsBanner({ world }: { world: World }) {
  const news = world.shared?.news
  const changedIds = Object.keys(news?.changed ?? {})
  const pages = useLiveQuery(() => db.entities.bulkGet(news?.entityIds ?? []), [news?.entityIds?.join()]) ?? []
  const changedPages = useLiveQuery(() => db.entities.bulkGet(changedIds), [changedIds.join()]) ?? []
  const sessionIds = [...new Set([...(news?.sessionIds ?? []), ...(news?.recapIds ?? [])])]
  const sessions = useLiveQuery(() => db.sessions.bulkGet(sessionIds), [sessionIds.join()]) ?? []
  const [all, setAll] = useState(false)
  if (!news) return null
  const answers = (world.shared?.questions ?? []).filter((q) => news.questionIds.includes(q.id))
  const handouts = (world.handouts ?? []).filter((h) => news.handoutIds?.includes(h.id))
  const clear = () =>
    db.worlds
      .where('id')
      .equals(world.id)
      .modify((w) => {
        if (w.shared) w.shared.news = undefined
      })
  const chips = [
    ...pages.flatMap((e) =>
      e
        ? [
            <Link key={`n${e.id}`} className="chip" to={pagePath(world.id, e.id)}>
              <Ico as={File} /> {e.name} <span className="muted">new</span>
            </Link>,
          ]
        : [],
    ),
    ...handouts.map((h) => (
      <Link key={`h${h.id}`} className="chip" to={`${worldPath(world.id)}/handouts`}>
        <Ico as={Newspaper} /> {h.title}
      </Link>
    )),
    ...sessions.flatMap((s) =>
      s
        ? [
            <Link key={`s${s.id}`} className="chip" to={`${worldPath(world.id)}/s/${s.id}`}>
              <Ico as={BookOpen} /> #{s.number} {s.title} {!news.sessionIds.includes(s.id) && <span className="muted">recap updated</span>}
            </Link>,
          ]
        : [],
    ),
    ...answers.map((q) => (
      <Link key={`q${q.id}`} className="chip" to={q.entityId ? `${pagePath(world.id, q.entityId)}` : `${worldPath(world.id)}/questions`}>
        <Ico as={ChatCircleDots} /> Your GM answered “{q.body.length > 40 ? `${q.body.slice(0, 40)}…` : q.body}”
      </Link>
    )),
    ...changedPages.flatMap((e) =>
      e
        ? [
            <Link key={`c${e.id}`} className="chip" to={pagePath(world.id, e.id)}>
              <Ico as={PencilSimple} /> {e.name} <span className="muted">{(news.changed?.[e.id] ?? []).map(label).join(', ')}</span>
            </Link>,
          ]
        : [],
    ),
  ]
  const SHOW = 8
  return (
    <div className="news-banner" role="status">
      <div className="row spread">
        <strong>
          <Ico as={Sparkle} /> New since you last looked <Help topic="news" />
        </strong>
        <button className="small" onClick={clear}>
          Got it
        </button>
      </div>
      <div className="row wrap small">
        {all ? chips : chips.slice(0, SHOW)}
        {chips.length > SHOW && (
          <button className="link small" onClick={() => setAll(!all)}>
            {all ? 'Fewer' : `and ${chips.length - SHOW} more`}
          </button>
        )}
      </div>
    </div>
  )
}

/** Plain words for what changed on a page. */
const label = (what: string) =>
  ({
    'new writing': 'new writing',
    details: 'details changed',
    renamed: 'renamed',
    'clock moved': 'clock moved',
    inspiration: 'inspiration!',
    'changed hands': 'changed hands',
    'new picture': 'new picture',
    dead: 'dead',
    missing: 'missing',
    captured: 'captured',
    alive: 'alive',
    'quest done': 'quest done',
    'quest failed': 'quest failed',
    'quest active': 'quest active',
    'quest open': 'quest open',
    resolved: 'resolved',
    dropped: 'dropped',
    active: 'active',
    open: 'open',
  })[what] ?? what
