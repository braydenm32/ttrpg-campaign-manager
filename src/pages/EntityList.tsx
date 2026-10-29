import { useState, type ReactNode } from 'react'
import { Help } from '../help'
import { Link, useParams } from 'react-router-dom'
import { Empty, VisibilityBadge } from '../components'
import { StatusBadge } from '../status'
import { ENTITY_TYPES, typeLabel, type Entity, type EntityType } from '../db'
import { treeRoots, useVisibleEntities, useWorld } from '../hooks'
import { NewPageButton } from '../NewPage'
import { TableRoller } from '../tables'
import { useViewMode } from '../viewMode'
import { pagePath, resolveCustom, sectionType, usePathsVersion } from '../paths'

export default function EntityList() {
  const { worldId, world } = useWorld()
  const params = useParams()
  usePathsVersion()
  const type = sectionType(params.type ?? params.section ?? (params.kind ? 'custom' : '')) ?? ''
  const kind = params.kind && resolveCustom(worldId, params.kind)
  const { isGM } = useViewMode()
  const all = useVisibleEntities(worldId)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')

  if (!ENTITY_TYPES.includes(type as EntityType)) return <Empty>Unknown category.</Empty>
  if (type === 'custom' && world && !world.customTypes?.some((c) => c.id === kind)) return <Empty>This page type has been removed.</Empty>
  const t = type as EntityType
  const label = typeLabel({ type: t, customType: kind }, world)
  const ofType = all.filter((e) => e.type === t && (t !== 'custom' || e.customType === kind))
  const tags = [...new Set(ofType.flatMap((e) => e.tags))].sort()
  const q = query.trim().toLowerCase()
  const filtered = ofType.filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)) &&
      (!tag || e.tags.includes(tag)),
  )

  // Locations read best as a tree (region > city > district > building).
  const showTree = t === 'location' && !q && !tag

  return (
    <div className="page">
      <header className="page-header">
        <h1>
          {label.icon} {label.many} <Help topic={t === 'table' ? 'randomTables' : t === 'custom' ? 'customTypes' : 'codex'} />
        </h1>
        {isGM && world && <NewPageButton world={world} type={t} customType={kind} />}
      </header>
      {t === 'table' && ofType.length > 0 && (
        <div className="card">
          <TableRoller tables={ofType} worldId={worldId} entities={all} showSecrets={isGM} />
        </div>
      )}
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
    <Link className="card" to={`${pagePath(worldId, e.id)}`}>
      <h3>
        {e.name} <VisibilityBadge value={e.visibility} />
      </h3>
      {e.summary && <p>{e.summary}</p>}
      <div className="tags">
        {e.questStatus && <span className={`tag status-${e.questStatus}`}>{e.questStatus}</span>}
        <StatusBadge entity={e} />
        {e.type === 'table' && <span className="tag">{e.entries?.filter((x) => x.trim()).length ?? 0} entries</span>}
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
  const roots = treeRoots(entities)
  const children = (parentId?: string) =>
    entities.filter((e) => (parentId ? e.parentId === parentId && !roots.has(e.id) : roots.has(e.id)))
  const render = (parentId?: string, depth = 0): ReactNode => {
    const kids = children(parentId)
    if (!kids.length || depth > 12) return null
    return (
      <ul className={depth === 0 ? 'tree' : ''}>
        {kids.map((e) => (
          <li key={e.id}>
            <Link to={`${pagePath(worldId, e.id)}`}>{e.name}</Link> <VisibilityBadge value={e.visibility} />
            {e.summary && <span className="muted"> · {e.summary}</span>}
            {render(e.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }
  return <>{render()}</>
}
