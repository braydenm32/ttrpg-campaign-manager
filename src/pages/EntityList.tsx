import { useState, type ReactNode } from 'react'
import { Help } from '../help'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Empty, VisibilityBadge } from '../components'
import { blankEntity, db, ENTITY_LABELS, ENTITY_TYPES, type Entity, type EntityType } from '../db'
import { useVisibleEntities, useWorld } from '../hooks'
import { useViewMode } from '../viewMode'

export default function EntityList() {
  const { worldId } = useWorld()
  const { type = '' } = useParams()
  const { isGM } = useViewMode()
  const navigate = useNavigate()
  const all = useVisibleEntities(worldId)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')

  if (!ENTITY_TYPES.includes(type as EntityType)) return <Empty>Unknown category.</Empty>
  const t = type as EntityType
  const label = ENTITY_LABELS[t]
  const ofType = all.filter((e) => e.type === t)
  const tags = [...new Set(ofType.flatMap((e) => e.tags))].sort()
  const q = query.trim().toLowerCase()
  const filtered = ofType.filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)) &&
      (!tag || e.tags.includes(tag)),
  )

  const create = async () => {
    const e = blankEntity(worldId, t, `New ${label.one}`)
    await db.entities.add(e)
    navigate(`/w/${worldId}/e/${e.id}?edit=1`)
  }

  // Locations read best as a tree (region > city > district > building).
  const showTree = t === 'location' && !q && !tag

  return (
    <div className="page">
      <header className="page-header">
        <h1>
          {label.icon} {label.many} <Help topic="codex" />
        </h1>
        {isGM && (
          <button className="primary" onClick={create}>
            + New {label.one}
          </button>
        )}
      </header>
      <div className="row wrap">
        <input className="search" placeholder="Filter…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {tags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {tags.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
      </div>
      {filtered.length === 0 ? (
        <Empty>{ofType.length === 0 ? `No ${label.many.toLowerCase()} yet.` : 'Nothing matches.'}</Empty>
      ) : showTree ? (
        <LocationTree worldId={worldId} entities={filtered} />
      ) : (
        <div className="card-grid">
          {filtered.map((e) => (
            <EntityCard key={e.id} worldId={worldId} entity={e} />
          ))}
        </div>
      )}
    </div>
  )
}

function EntityCard({ worldId, entity: e }: { worldId: string; entity: Entity }) {
  return (
    <Link className="card" to={`/w/${worldId}/e/${e.id}`}>
      <h3>
        {e.name} <VisibilityBadge value={e.visibility} />
      </h3>
      {e.summary && <p>{e.summary}</p>}
      <div className="tags">
        {e.questStatus && <span className={`tag status-${e.questStatus}`}>{e.questStatus}</span>}
        {e.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
    </Link>
  )
}

function LocationTree({ worldId, entities }: { worldId: string; entities: Entity[] }) {
  const ids = new Set(entities.map((e) => e.id))
  const children = (parentId?: string) =>
    entities.filter((e) => (parentId ? e.parentId === parentId : !e.parentId || !ids.has(e.parentId)))
  const render = (parentId?: string, depth = 0): ReactNode => {
    const kids = children(parentId)
    if (!kids.length || depth > 12) return null
    return (
      <ul className={depth === 0 ? 'tree' : ''}>
        {kids.map((e) => (
          <li key={e.id}>
            <Link to={`/w/${worldId}/e/${e.id}`}>{e.name}</Link> <VisibilityBadge value={e.visibility} />
            {e.summary && <span className="muted"> · {e.summary}</span>}
            {render(e.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }
  return <>{render()}</>
}
