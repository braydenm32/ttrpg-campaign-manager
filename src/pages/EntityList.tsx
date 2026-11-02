import { type ReactNode } from 'react'
import { Help } from '../help'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Empty } from '../components'
import { NothingHere } from '../NothingHere'
import { SeenMark } from '../reveal'
import { StatusBadge } from '../status'
import { ENTITY_TYPES, typeLabel, type Entity, type EntityType } from '../db'
import { treeRoots, useVisibleEntities, useWorld } from '../hooks'
import { NewPageButton } from '../NewPage'
import { listedEntries, TableRoller } from '../tables'
import { pagesIn } from '../counts'
import { useViewMode } from '../viewMode'
import { pagePath, resolveCustom, sectionType, typePath, usePathsVersion, worldPath } from '../paths'

/** Kinds that share one tab, with the switch between them. The heading is the tab's name; the kind sits above it in small type. */
const GROUPS: { title: string; types: readonly EntityType[]; always: boolean }[] = [
  { title: 'People', types: ['npc', 'pc'], always: true },
  { title: 'Places', types: ['location', 'shop'], always: false },
  { title: 'Lore', types: ['lore', 'deity'], always: false },
]

export default function EntityList() {
  const { worldId, world } = useWorld()
  const params = useParams()
  usePathsVersion()
  const type = sectionType(params.type ?? params.section ?? (params.kind ? 'custom' : '')) ?? ''
  const kind = params.kind && resolveCustom(worldId, params.kind)
  const { isGM } = useViewMode()
  const all = useVisibleEntities(worldId)
  // The filter and tag live in the address, so Back from a page comes back to the same list.
  const [search, setSearch] = useSearchParams()
  const query = search.get('q') ?? ''
  const tag = search.get('tag') ?? ''
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(search)
    if (v) next.set(k, v)
    else next.delete(k)
    setSearch(next, { replace: true })
  }

  if (!ENTITY_TYPES.includes(type as EntityType))
    return <NothingHere />
  if (type === 'custom' && kind && world && !world.customTypes?.some((c) => c.id === kind)) return <Empty>This page type has been removed.</Empty>
  const t = type as EntityType
  // The GM's tables live on Generators and tables (one place, not two); players keep this list.
  if (t === 'table' && isGM) return <Navigate to={`${worldPath(worldId)}/generators${search.size ? `?${search}` : ''}#tables`} replace />
  const label = typeLabel({ type: t, customType: kind }, world)
  // With no custom type named, the custom section is "Other pages": custom pages with no type of their own.
  const ofType = pagesIn(all, world, t !== 'custom' ? t : kind ? `custom:${kind}` : 'other')
  const tags = [...new Set(ofType.flatMap((e) => e.tags))].sort()
  const q = query.trim().toLowerCase()
  const filtered = ofType.filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)) &&
      (!tag || e.tags.includes(tag)),
  )

  const group = GROUPS.find((g) => g.types.includes(t))
  // The GM always gets the switch; players only when the other kind has something they can read.
  const switchTypes = group?.types.filter((x) => group.always || isGM || x === t || all.some((e) => e.type === x)) ?? []

  // Locations read best as a tree (region > city > district > building).
  const showTree = t === 'location' && !q && !tag

  return (
    <div className="page">
      <header className="page-header">
        <div>
          {group && <div className="kicker">{label.many}</div>}
          <h1>
            {label.icon} {group ? group.title : label.many} <Help topic={t === 'table' ? 'randomTables' : t === 'quest' ? 'questList' : t === 'custom' && kind ? 'customTypes' : 'codex'} />
          </h1>
        </div>
        {isGM && world && (t !== 'custom' || kind) && <NewPageButton world={world} type={t} customType={kind} />}
      </header>
      {isGM && ofType.length > 0 && (
        <p className="muted small list-seen">
          {ofType.length} {ofType.length === 1 ? 'page' : 'pages'} · <SeenMark entity={{ visibility: 'players' }} /> players can see {ofType.filter((e) => e.visibility === 'players').length}
          {' · '}
          <SeenMark entity={{ visibility: 'gm' }} /> GM only {ofType.filter((e) => e.visibility !== 'players').length} <Help topic="seenMarks" />
        </p>
      )}
      {group && switchTypes.length > 1 && (
        // People, Places and Lore each hold two kinds: a switch between them.
        <nav className="segmented people-switch" aria-label={`Which ${group.title.toLowerCase()}`}>
          {switchTypes.map((p) => (
            <Link key={p} to={typePath(worldId, p)} className={p === t ? 'on' : ''} aria-current={p === t ? 'page' : undefined}>
              {typeLabel({ type: p }, world).many}
            </Link>
          ))}
        </nav>
      )}
      {(group?.title === 'Places' || group?.title === 'Lore') && (
        <p className="muted small">
          Also: <Link to={typePath(worldId, 'item')}>Items</Link> · <Link to={typePath(worldId, 'event')}>Events</Link> · <Link to={`${worldPath(worldId)}/everything`}>Everything</Link>
        </p>
      )}
      {t === 'table' && ofType.length > 0 && (
        <div className="card">
          <TableRoller tables={ofType} worldId={worldId} entities={all} showSecrets={isGM} />
        </div>
      )}
      <div className="row wrap list-tools">
        <input className="search" type="search" placeholder="Filter…" aria-label={`Filter ${label.many.toLowerCase()}`} value={query} onChange={(e) => setParam('q', e.target.value)} />
        {tags.length > 0 && (
          <select value={tag} onChange={(e) => setParam('tag', e.target.value)} aria-label="Tag">
            <option value="">All tags</option>
            {tags.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
      </div>
      {filtered.length === 0 ? (
        <Empty>{ofType.length === 0 ? `No ${/^[A-Z]{2}/.test(label.many) ? label.many : label.many.toLowerCase()} yet.` : 'Nothing matches.'}</Empty>
      ) : showTree ? (
        <LocationTree worldId={worldId} entities={filtered} isGM={isGM} />
      ) : t === 'quest' ? (
        <QuestGroups worldId={worldId} entities={filtered} isGM={isGM} />
      ) : (
        <div className="card-grid">
          {filtered.map((e) => (
            <EntityCard key={e.id} worldId={worldId} entity={e} isGM={isGM} />
          ))}
        </div>
      )}
    </div>
  )
}

function EntityCard({ worldId, entity: e, isGM }: { worldId: string; entity: Entity; isGM: boolean }) {
  return (
    <Link className="card" to={`${pagePath(worldId, e.id)}`}>
      <h2 className="card-title">
        {e.name} {isGM && <SeenMark entity={e} />}
      </h2>
      {e.summary && <p>{e.summary}</p>}
      <div className="tags">
        {e.questStatus && <span className={`tag status-${e.questStatus}`}>{e.questStatus}</span>}
        <StatusBadge entity={e} />
        {e.type === 'table' && <span className="tag">{listedEntries(e, isGM).length} entries</span>}
        {e.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
    </Link>
  )
}

/** Quests by where they stand: what the party is on now, then what's open to take up, then what's over. */
const QUEST_GROUPS: { title: string; blurb: string; has: (e: Entity) => boolean }[] = [
  { title: 'Active', blurb: 'The party is on these now.', has: (e) => e.questStatus === 'active' },
  { title: 'Open', blurb: 'Waiting to be taken up.', has: (e) => !e.questStatus || e.questStatus === 'open' },
  { title: 'Done', blurb: 'Finished or failed.', has: (e) => e.questStatus === 'done' || e.questStatus === 'failed' },
]

function QuestGroups({ worldId, entities, isGM }: { worldId: string; entities: Entity[]; isGM: boolean }) {
  return (
    <>
      {QUEST_GROUPS.map((g) => {
        const list = entities.filter(g.has)
        if (!list.length) return null
        return (
          <section key={g.title} className="quest-group" aria-label={`${g.title} quests`}>
            <h2>
              {g.title} <span className="muted small">· {list.length} · {g.blurb}</span>
            </h2>
            <div className="card-grid">
              {list.map((e) => (
                <EntityCard key={e.id} worldId={worldId} entity={e} isGM={isGM} />
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

function LocationTree({ worldId, entities, isGM }: { worldId: string; entities: Entity[]; isGM: boolean }) {
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
            <Link to={`${pagePath(worldId, e.id)}`}>{e.name}</Link> {isGM && <SeenMark entity={e} />}
            {e.summary && <span className="muted"> · {e.summary}</span>}
            {render(e.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }
  return <>{render()}</>
}
