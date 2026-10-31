import { Link, useSearchParams } from 'react-router-dom'
import { ENTITY_LABELS, ENTITY_TYPES, typeLabel } from '../db'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { TypeIcon } from '../icons'
import { countByType, pagesIn } from '../counts'
import { useViewMode } from '../viewMode'
import { pagePath, typePath } from '../paths'
import { SeenMark } from '../reveal'
import { Empty } from '../components'

/**
 * Everything: every kind of page in the world, with how many there are, including the GM's own
 * types. It's the last tab of the Atlas (players: The World), for the kinds without a tab of their
 * own (items, events, your own types…). Players see only kinds they have pages of. The search box
 * finds pages of any kind by name (it's kept in the address, so Back comes back to it).
 */
export default function Everything() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const counts = countByType(entities, world)
  const n = (key: string) => counts.get(key) ?? 0
  // How many of each kind players can read, for the GM.
  const seen = (key: string) => pagesIn(entities, world, key).filter((e) => e.visibility === 'players').length
  const kinds = [
    ...ENTITY_TYPES.filter((t) => t !== 'custom').map((t) => ({ key: t, to: typePath(worldId, t), label: ENTITY_LABELS[t].many, icon: <TypeIcon type={t} size="1.4em" /> })),
    ...(world?.customTypes ?? []).map((c) => ({ key: `custom:${c.id}`, to: typePath(worldId, 'custom', c.id), label: c.many, icon: <TypeIcon type="custom" custom={c} size="1.4em" /> })),
    { key: 'other', to: typePath(worldId, 'custom'), label: ENTITY_LABELS.custom.many, icon: <TypeIcon type="custom" size="1.4em" /> },
  ].filter((k) => n(k.key) > 0 || (isGM && k.key !== 'other'))
  const q = query.trim().toLowerCase()
  const found = q
    ? entities
        .filter((e) => !e.template && (e.name.toLowerCase().includes(q) || e.aliases?.some((a) => a.toLowerCase().includes(q)) || e.summary.toLowerCase().includes(q)))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
        .slice(0, 60)
    : []
  return (
    <div className="page everything-page">
      <header className="page-header">
        <div>
          <h1>
            Everything <Help topic="everything" />
          </h1>
          <p className="lead">{entities.length} pages, by kind.</p>
        </div>
      </header>
      <input
        className="search everything-search"
        type="search"
        placeholder="Find a page of any kind…"
        aria-label="Find a page of any kind"
        value={query}
        onChange={(e) => {
          const next = new URLSearchParams(params)
          if (e.target.value) next.set('q', e.target.value)
          else next.delete('q')
          setParams(next, { replace: true })
        }}
      />
      {q ? (
        found.length ? (
          <ul className="entity-list everything-found">
            {found.map((e) => (
              <li key={e.id}>
                <Link to={pagePath(worldId, e.id)}>
                  <TypeIcon type={e.type} custom={world?.customTypes?.find((c) => c.id === e.customType)} /> {e.name}
                </Link>{' '}
                {isGM && <SeenMark entity={e} />} <span className="muted small">· {typeLabel(e, world).one}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No page’s name has “{query.trim()}” in it.</Empty>
        )
      ) : (
        <ul className="everything-grid">
          {kinds.map((k) => (
            <li key={k.key}>
              <Link className={`card everything-card ${n(k.key) ? '' : 'empty-kind'}`} to={k.to}>
                {k.icon}
                <b>{k.label}</b>
                <span className="count">{n(k.key)}</span>
                {isGM && n(k.key) > 0 && (
                  <small className="muted everything-seen">
                    <SeenMark entity={{ visibility: 'players' }} /> {seen(k.key) === n(k.key) ? 'players see all' : seen(k.key) ? `players see ${seen(k.key)}` : 'all GM only'}
                  </small>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
