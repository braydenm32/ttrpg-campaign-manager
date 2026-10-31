import { useState } from 'react'
import { Help } from '../help'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Empty } from '../components'
import { PagePicker } from '../PagePicker'
import { db, THREAD_STATUS, type Entity, type Session, type ThreadStatus } from '../db'
import { useVisibleEntities, useWorld } from '../hooks'
import { ThreadCard } from '../ThreadCard'
import { COLD_AFTER, newThread, nextSessions, sessionInHand, sessionsSinceTouched, threadLinks, URGENCY, useCampaigns, useWorldSessions } from '../threads'
import { useKeepScroll } from '../jump'
import { isOpenThread } from '../counts'
import { LeadsView } from '../players/Leads'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { Graph, Spiral } from '@phosphor-icons/react'
import { typePath } from '../paths'

const COLUMNS: ThreadStatus[] = ['open', 'active', 'resolved', 'dropped']
const URGENCY_ORDER = { high: 0, normal: 1, low: 2 }

/**
 * Loose threads: for the GM, every thread in the world on one board (dangling, in play, tied off,
 * dropped). Players get their Leads instead, the same list as the Common Room's Leads tab.
 */
export default function Threads() {
  const { isGM } = useViewMode()
  return isGM ? <ThreadBoard /> : <PlayerLeads />
}

function PlayerLeads() {
  const { worldId } = useWorld()
  const entities = useVisibleEntities(worldId)
  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={Spiral} /> Leads <Help topic="leads" />
        </h1>
      </header>
      <LeadsView worldId={worldId} entities={entities} />
    </div>
  )
}

function ThreadBoard() {
  const { worldId } = useWorld()
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const campaigns = useCampaigns(worldId)
  const [name, setName] = useState('')
  const [involves, setInvolves] = useState('')
  const [urgency, setUrgency] = useState<NonNullable<Entity['threadUrgency']>>('normal')
  // The search, the filter and the switches live in the address, so Back from a thread comes back to the same board.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const filter = params.get('involves') ?? ''
  const showClosed = params.get('closed') === '1'
  const onlyNext = params.get('next') === '1'
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  useKeepScroll(entities.length > 0)

  const threads = entities.filter((e) => e.type === 'thread')
  const others = entities.filter((e) => e.type !== 'thread')
  const latest = sessionInHand(campaigns, sessions)
  // The next session's plan: threads touching what's in it are the ones that matter now.
  const coming = nextSessions(campaigns, sessions)[0]?.session
  const upNext = new Set(coming ? threads.filter((t) => inPlan(t, coming, entities)).map((t) => t.id) : [])
  const q = search.trim().toLowerCase()
  const shown = threads.filter(
    (t) =>
      (!filter || threadLinks(t, entities, true).some((e) => e.id === filter)) &&
      (!q || t.name.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q)) &&
      (!onlyNext || upNext.has(t.id)),
  )
  const cold = threads.filter((t) => isOpenThread(t) && sessionsSinceTouched(t, sessions) >= COLD_AFTER).length
  const columns = showClosed ? COLUMNS : COLUMNS.slice(0, 2)
  const sorted = (status: ThreadStatus) =>
    shown
      .filter((t) => (t.threadStatus ?? 'open') === status)
      .sort(
        (a, b) =>
          Number(upNext.has(b.id)) - Number(upNext.has(a.id)) ||
          URGENCY_ORDER[a.threadUrgency ?? 'normal'] - URGENCY_ORDER[b.threadUrgency ?? 'normal'] ||
          b.updatedAt - a.updatedAt,
      )

  const add = async () => {
    if (!name.trim()) return
    const t = newThread(worldId, name.trim(), latest?.id)
    t.threadUrgency = urgency
    const target = others.find((e) => e.id === involves)
    if (target?.type === 'location') t.parentId = target.id
    // A page the players can't see is named only in a secret passage, so revealing the thread doesn't give it away.
    else if (target?.visibility === 'players') t.summary = `Involves [[${target.name}]].`
    else if (target) t.body = `:::gm\nInvolves [[${target.name}]].\n:::`
    await db.entities.add(t)
    setName('')
  }

  return (
    <div className="page wide">
      <header className="page-header">
        <div>
          <h1>
            <Ico as={Spiral} /> Loose threads <Help topic="threads" />
          </h1>
          <p className="muted">Hooks you’ve planted, mysteries the players noticed, promises and grudges. Keep them here so nothing gets forgotten.</p>
        </div>
      </header>

      <form
        className="thread-add card"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What’s left hanging? e.g. Who sent the assassin?" aria-label="New thread" />
        <PagePicker entities={others} value={involves} onPick={setInvolves} placeholder="Involves… (optional)" />
        <select value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)} title="How pressing it is" aria-label="How pressing it is">
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

      <div className="row wrap thread-filters">
        <input type="search" value={search} onChange={(e) => setParam('q', e.target.value)} placeholder="Search threads" aria-label="Search threads" />
        <PagePicker entities={others} value={filter} onPick={(id) => setParam('involves', id)} placeholder="Involving anyone or anywhere" />
        {coming && (
          <label className="row small thread-switch" title={`Threads that touch a place, person or page in the plan for #${coming.number} ${coming.title}`}>
            <input type="checkbox" checked={onlyNext} onChange={(e) => setParam('next', e.target.checked ? '1' : '')} /> Only ones for next session ({upNext.size})
          </label>
        )}
        <label className="row small thread-switch">
          <input type="checkbox" checked={showClosed} onChange={(e) => setParam('closed', e.target.checked ? '1' : '')} /> Show tied off and dropped
        </label>
        {cold > 0 && (
          <span className="thread-cold small">
            <Ico as={Graph} /> {cold} {cold === 1 ? 'thread hasn’t' : 'threads haven’t'} moved in {COLD_AFTER}+ sessions
          </span>
        )}
      </div>
      <p className="muted small thread-legend">
        Columns say where a thread stands with the players; <span aria-hidden="true">🔥</span> pressing, normal and <span aria-hidden="true">🕯️</span> slow burn say how soon it bites, and order each column.
        {coming && (
          <>
            {' '}
            <span className="tag up-next">Next session</span> marks the ones that touch the plan for #{coming.number} {coming.title}.
          </>
        )}
      </p>

      {threads.length === 0 ? (
        <Empty>No loose threads yet. Add one above, or from the Lectern during a game.</Empty>
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
                  <ThreadCard key={t.id} thread={t} entities={entities} sessions={sessions} worldId={worldId} currentSessionId={latest?.id} highlight={upNext.has(t.id) ? 'Next session' : undefined} />
                ))}
              </section>
            )
          })}
        </div>
      )}
      {threads.length > 0 && (
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

/** Whether a thread touches the plan for a session: its own name, or a page it involves, in the plan's text, places, people or fights. */
function inPlan(thread: Entity, session: Session, entities: Entity[]) {
  const prep = session.prep
  if (!prep) return false
  const ids = new Set(threadLinks(thread, entities, true).map((e) => e.id))
  const placed = prep.scenes.some((s) => (s.placeId && ids.has(s.placeId)) || s.presentIds?.some((id) => ids.has(id))) || prep.encounters.some((x) => x.foes.some((f) => f.entityId && ids.has(f.entityId)))
  if (placed) return true
  const text = [prep.strongStart, ...prep.scenes.map((s) => `${s.text}\n${s.readAloud ?? ''}`), ...prep.clues.map((c) => c.text), ...prep.encounters.map((x) => `${x.name}\n${x.notes}`)].join('\n').toLowerCase()
  const names = [thread.name, ...threadLinks(thread, entities, true).map((e) => e.name)].map((n) => n.trim().toLowerCase()).filter((n) => n.length > 3)
  return names.some((n) => text.includes(n))
}
