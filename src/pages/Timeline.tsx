import { useState } from 'react'
import { Help } from '../help'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, VisibilityBadge } from '../components'
import { blankEntity, db, type Entity } from '../db'
import { useVisibleEntities, useWorld } from '../hooks'
import { useViewMode } from '../viewMode'

export default function Timeline() {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
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
  const eras = [
    { key: 'pre', title: 'History (before the campaign)', items: events.filter((e) => e.eventEra !== 'campaign') },
    { key: 'campaign', title: 'During the campaign', items: events.filter((e) => e.eventEra === 'campaign') },
  ] as const

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

  const add = async (era: 'pre' | 'campaign') => {
    const e = blankEntity(worldId, 'event', 'New event')
    e.eventEra = era
    e.eventOrder = Date.now()
    if (place) e.parentId = place
    await db.entities.add(e)
    navigate(`/w/${worldId}/e/${e.id}?edit=1`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>
          ⏳ Timeline <Help topic="timeline" />
        </h1>
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
      </header>
      {eras.map((era) => (
        <section key={era.key}>
          <div className="section-header">
            <h2>{era.title}</h2>
            {isGM && <button onClick={() => add(era.key)}>+ Event</button>}
          </div>
          {era.items.length === 0 ? (
            <Empty>No events.</Empty>
          ) : (
            <ol className="timeline">
              {era.items.map((e, i) => (
                <li key={e.id}>
                  <div className="when">{e.eventDate || '—'}</div>
                  <div className="what">
                    <Link to={`/w/${worldId}/e/${e.id}`}>{e.name}</Link> <VisibilityBadge value={e.visibility} />
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
    </div>
  )
}
