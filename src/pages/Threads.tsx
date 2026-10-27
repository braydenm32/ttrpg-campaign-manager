import { useState } from 'react'
import { Help } from '../help'
import { useNavigate } from 'react-router-dom'
import { Empty } from '../components'
import { db, ENTITY_LABELS, THREAD_STATUS, type Entity, type ThreadStatus } from '../db'
import { useVisibleEntities, useWorld } from '../hooks'
import { ThreadCard } from '../ThreadCard'
import { COLD_AFTER, latestSession, newThread, sessionsSinceTouched, threadLinks, URGENCY, useWorldSessions } from '../threads'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { Graph, Spiral } from '@phosphor-icons/react'
import { typePath } from '../paths'

const COLUMNS: ThreadStatus[] = ['open', 'active', 'resolved', 'dropped']
const URGENCY_ORDER = { high: 0, normal: 1, low: 2 }

/** Every loose thread in the world on one board: dangling, in play, tied off and dropped. */
export default function Threads() {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const [name, setName] = useState('')
  const [involves, setInvolves] = useState('')
  const [urgency, setUrgency] = useState<NonNullable<Entity['threadUrgency']>>('normal')
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showClosed, setShowClosed] = useState(false)

  const threads = entities.filter((e) => e.type === 'thread')
  const others = entities.filter((e) => e.type !== 'thread')
  const q = search.trim().toLowerCase()
  const shown = threads.filter(
    (t) =>
      (!filter || threadLinks(t, entities, isGM).some((e) => e.id === filter)) &&
      (!q || t.name.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q)),
  )
  const latest = latestSession(sessions)
  const cold = threads.filter(
    (t) => (t.threadStatus === 'open' || t.threadStatus === 'active') && sessionsSinceTouched(t, sessions) >= COLD_AFTER,
  ).length
  const columns = isGM ? (showClosed ? COLUMNS : COLUMNS.slice(0, 2)) : COLUMNS.slice(0, 3)
  const sorted = (status: ThreadStatus) =>
    shown
      .filter((t) => (t.threadStatus ?? 'open') === status)
      .sort((a, b) => URGENCY_ORDER[a.threadUrgency ?? 'normal'] - URGENCY_ORDER[b.threadUrgency ?? 'normal'] || b.updatedAt - a.updatedAt)

  const add = async () => {
    if (!name.trim()) return
    const t = newThread(worldId, name.trim(), latest?.id)
    t.threadUrgency = urgency
    const target = others.find((e) => e.id === involves)
    if (target?.type === 'location') t.parentId = target.id
    else if (target) t.summary = `Involves [[${target.name}]].`
    await db.entities.add(t)
    setName('')
  }

  return (
    <div className="page wide">
      <header className="page-header">
        <div>
          <h1>
            <Ico as={Spiral} /> {isGM ? 'Loose threads' : 'Leads and rumours'} <Help topic={isGM ? 'threads' : 'leads'} />
          </h1>
          <p className="muted">
            {isGM
              ? 'Hooks you’ve planted, mysteries the players noticed, promises and grudges. Keep them here so nothing gets forgotten.'
              : 'Open questions and leads your GM has shared.'}
          </p>
        </div>
      </header>

      {isGM && (
        <form
          className="thread-add card"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What’s left hanging? e.g. Who sent the assassin?" />
          <select value={involves} onChange={(e) => setInvolves(e.target.value)} title="Who or where it involves">
            <option value="">Involves… (optional)</option>
            {others.map((e) => (
              <option key={e.id} value={e.id}>
                {ENTITY_LABELS[e.type].icon} {e.name}
              </option>
            ))}
          </select>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)} title="How pressing it is">
            {(['high', 'normal', 'low'] as const).map((u) => (
              <option key={u} value={u}>
                {URGENCY[u].icon} {URGENCY[u].label}
              </option>
            ))}
          </select>
          <button className="primary" disabled={!name.trim()}>
            Add thread
          </button>
          {latest && <span className="muted small">Will be marked as raised in #{latest.number} {latest.title}. New threads start GM only.</span>}
        </form>
      )}

      <div className="row wrap thread-filters">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search threads" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Involving anyone or anywhere</option>
          {others.map((e) => (
            <option key={e.id} value={e.id}>
              {ENTITY_LABELS[e.type].icon} {e.name}
            </option>
          ))}
        </select>
        {isGM && (
          <label className="row small">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show tied off and dropped
          </label>
        )}
        {isGM && cold > 0 && (
          <span className="thread-cold small">
            <Ico as={Graph} /> {cold} {cold === 1 ? 'thread hasn’t' : 'threads haven’t'} moved in {COLD_AFTER}+ sessions
          </span>
        )}
      </div>

      {threads.length === 0 ? (
        <Empty>{isGM ? 'No loose threads yet. Add one above, or from the Lectern during a game.' : 'Nothing shared yet.'}</Empty>
      ) : (
        <div className="thread-board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((status) => {
            const list = sorted(status)
            return (
              <section key={status} className={`thread-column status-${status}`}>
                <h2 title={THREAD_STATUS[status].hint}>
                  {THREAD_STATUS[status].label} <span className="count">{list.length}</span>
                </h2>
                <p className="muted small">{THREAD_STATUS[status].hint}</p>
                {list.map((t) => (
                  <ThreadCard key={t.id} thread={t} entities={entities} sessions={sessions} worldId={worldId} currentSessionId={latest?.id} />
                ))}
              </section>
            )
          })}
        </div>
      )}
      {isGM && threads.length > 0 && (
        <p className="muted small">
          Open a thread to write more about it, link pages with [[Name]], or reveal it to players.{' '}
          <button className="link" onClick={() => navigate(`${typePath(worldId, 'thread')}`)}>
            See them as a list
          </button>
        </p>
      )}
    </div>
  )
}
