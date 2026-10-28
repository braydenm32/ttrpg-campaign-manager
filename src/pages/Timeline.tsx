import { useState } from 'react'
import { Help } from '../help'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Modal, VisibilityBadge } from '../components'
import { blankEntity, db, newId, type Entity, type TimelineAge, type World } from '../db'
import { useVisibleEntities, useWorld } from '../hooks'
import { useViewMode } from '../viewMode'
import { formatDate, MonthGrid, WorldToday } from '../calendar'
import { useWorldSessions } from '../threads'
import { Ico } from '../icons'
import { Hourglass } from '@phosphor-icons/react'
import { pagePath } from '../paths'

export default function Timeline() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const sessions = useWorldSessions(worldId)
  const [view, setView] = useState<'list' | 'month'>('list')
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const [place, setPlace] = useState('')
  const byId = new Map(entities.map((e) => [e.id, e]))

  // An event counts as "at" a place if it happened there or anywhere inside it.
  const isWithin = (e: Entity, placeId: string) => {
    for (let p = e.parentId, n = 0; p && n < 12; p = byId.get(p)?.parentId, n++) if (p === placeId) return true
    return false
  }
  const events = entities
    .filter((e) => e.type === 'event' && (!place || isWithin(e, place)))
    .sort((a, b) => (a.eventOrder ?? a.createdAt) - (b.eventOrder ?? b.createdAt))
  const [editingAges, setEditingAges] = useState(false)
  const ages = world?.ages ?? []
  const history = events.filter((e) => e.eventEra !== 'campaign')
  // With named ages, history splits into one section per age, oldest first; events in no age (or a
  // deleted one) gather under "Other history" so nothing goes missing.
  const inNoAge = history.filter((e) => !e.eventAge || !ages.some((a) => a.id === e.eventAge))
  const eras: { key: string; era: 'pre' | 'campaign'; age?: TimelineAge; title: string; items: Entity[] }[] = ages.length
    ? [
        ...ages.map((a) => ({ key: a.id, era: 'pre' as const, age: a, title: a.name, items: history.filter((e) => e.eventAge === a.id) })),
        ...(inNoAge.length ? [{ key: 'pre', era: 'pre' as const, title: 'Other history', items: inNoAge }] : []),
        { key: 'campaign', era: 'campaign', title: 'During the campaign', items: events.filter((e) => e.eventEra === 'campaign') },
      ]
    : [
        { key: 'pre', era: 'pre', title: 'History (before the campaign)', items: history },
        { key: 'campaign', era: 'campaign', title: 'During the campaign', items: events.filter((e) => e.eventEra === 'campaign') },
      ]

  const move = async (list: Entity[], i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const a = list[i]
    const b = list[j]
    const ao = a.eventOrder ?? a.createdAt
    const bo = b.eventOrder ?? b.createdAt
    await db.entities.bulkUpdate([
      { key: a.id, changes: { eventOrder: bo === ao ? bo + dir : bo } },
      { key: b.id, changes: { eventOrder: ao } },
    ])
  }

  const add = async (era: 'pre' | 'campaign', age?: TimelineAge) => {
    const e = blankEntity(worldId, 'event', 'New event')
    e.eventEra = era
    if (age) e.eventAge = age.id
    e.eventOrder = Date.now()
    if (place) e.parentId = place
    await db.entities.add(e)
    navigate(`${pagePath(worldId, e.id)}?edit=1`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={Hourglass} /> Timeline <Help topic="timeline" />
        </h1>
        <div className="row">
        {world?.calendar && (
          <div className="segmented">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
              List
            </button>
            <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>
              Month
            </button>
          </div>
        )}
        <select value={place} onChange={(e) => setPlace(e.target.value)}>
          <option value="">Everywhere</option>
          {entities
            .filter((e) => e.type === 'location')
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
        {isGM && !world?.shared && (
          <button onClick={() => setEditingAges(true)} title="Split history into named ages, like “The Age of Kings”">
            Ages of history
          </button>
        )}
        </div>
      </header>
      {world && <WorldToday world={world} isGM={isGM} />}
      {view === 'month' && world?.calendar ? (
        <MonthGrid world={world} events={events} sessions={sessions} />
      ) : eras.filter((era) => isGM || !era.age || era.items.length > 0).map((era) => (
        <section key={era.key}>
          <div className="section-header">
            <div>
              <h2>
                {era.title}
                {era.age?.span && <span className="muted age-span"> · {era.age.span}</span>}
              </h2>
              {era.age?.summary && <p className="muted small age-summary">{era.age.summary}</p>}
            </div>
            {isGM && <button onClick={() => add(era.era, era.age)}>+ Event</button>}
          </div>
          {era.items.length === 0 ? (
            <Empty>No events.</Empty>
          ) : (
            <ol className="timeline">
              {era.items.map((e, i) => (
                <li key={e.id}>
                  <div className="when">{formatDate(world?.calendar, e.eventWhen, false) || e.eventDate || '—'}</div>
                  <div className="what">
                    <Link to={`${pagePath(worldId, e.id)}`}>{e.name}</Link> <VisibilityBadge value={e.visibility} />
                    {e.parentId && byId.get(e.parentId) && <span className="muted"> · {byId.get(e.parentId)!.name}</span>}
                    {e.summary && <div className="muted small">{e.summary}</div>}
                  </div>
                  {isGM && (
                    <div className="reorder">
                      <button className="ghost" onClick={() => move(era.items, i, -1)} disabled={i === 0} aria-label="Earlier">
                        ↑
                      </button>
                      <button className="ghost" onClick={() => move(era.items, i, 1)} disabled={i === era.items.length - 1} aria-label="Later">
                        ↓
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
      {editingAges && world && <AgesEditor world={world} onClose={() => setEditingAges(false)} />}
    </div>
  )
}

/** Name the ages of history, oldest first. Each becomes its own section of the timeline. */
function AgesEditor({ world, onClose }: { world: World; onClose: () => void }) {
  const [ages, setAges] = useState<TimelineAge[]>(world.ages ?? [])
  const edit = (i: number, changes: Partial<TimelineAge>) => setAges(ages.map((a, j) => (j === i ? { ...a, ...changes } : a)))
  const swap = (i: number, j: number) => {
    const next = [...ages]
    ;[next[i], next[j]] = [next[j], next[i]]
    setAges(next)
  }
  return (
    <Modal title="Ages of history" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const clean = ages.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim(), span: a.span?.trim() || undefined, summary: a.summary?.trim() || undefined }))
          await db.worlds.update(world.id, { ages: clean, updatedAt: Date.now() })
          onClose()
        }}
      >
        <p className="muted small">
          Oldest first. Each age becomes its own section of the timeline, and an event’s page lets you pick its age. <Help topic="ages" />
        </p>
        {ages.length === 0 && <Empty>No ages yet. History stays in one list until you add one.</Empty>}
        <ol className="ages-list">
          {ages.map((a, i) => (
            <li key={a.id} className="card">
              <div className="row">
                <input aria-label="Name of the age" value={a.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder="e.g. The Age of Kings" />
                <input aria-label="When" value={a.span ?? ''} onChange={(e) => edit(i, { span: e.target.value })} placeholder="e.g. 940 to 1740 AW" />
              </div>
              <textarea aria-label="Summary" rows={2} value={a.summary ?? ''} onChange={(e) => edit(i, { summary: e.target.value })} placeholder="A line or two about this age (players see it)" />
              <div className="row end">
                <button type="button" className="ghost" onClick={() => swap(i, i - 1)} disabled={i === 0} aria-label="Earlier">↑</button>
                <button type="button" className="ghost" onClick={() => swap(i, i + 1)} disabled={i === ages.length - 1} aria-label="Later">↓</button>
                <button type="button" className="ghost" onClick={() => setAges(ages.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
        <div className="row end">
          <button type="button" onClick={() => setAges([...ages, { id: newId(), name: '' }])}>+ Age</button>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}
