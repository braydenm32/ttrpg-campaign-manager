import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty } from '../components'
import { db, ENTITY_LABELS, ENTITY_TYPES, type World } from '../db'
import { Help } from '../help'
import { useVisibleEntities } from '../hooks'
import { Markdown } from '../Markdown'
import { searchWorld, useSearchable } from '../search'
import { plainLinks } from '../text'
import { useCampaigns, useWorldSessions } from '../threads'

/**
 * The front page of a world opened from a public wiki link: a tidy read-only wiki of everything the
 * GM has revealed to the whole table, for people outside the group. Secrets never reach it: the
 * server sends only what every player may see.
 */
export default function WikiHome({ world }: { world: World }) {
  const worldId = world.id
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const campaigns = useCampaigns(worldId)
  const maps = useLiveQuery(() => db.maps.where({ worldId }).sortBy('name'), [worldId]) ?? []
  const [query, setQuery] = useState('')
  const searchable = useSearchable(worldId)
  const results = searchWorld(query, { worldId, world, ...searchable })
  const recaps = [...sessions].filter((s) => s.recap.trim()).sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number)
  const types = ENTITY_TYPES.filter((t) => t !== 'custom').map((t) => [t, entities.filter((e) => e.type === t).length] as const).filter(([, n]) => n)
  const custom = (world.customTypes ?? []).map((c) => [c, entities.filter((e) => e.type === 'custom' && e.customType === c.id).length] as const).filter(([, n]) => n)
  const recent = [...entities].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)

  return (
    <div className="page wiki-home">
      <header className="wiki-hero">
        <div className="muted small">
          📜 Public wiki · read only <Help topic="wiki" />
        </div>
        <h1>{world.name}</h1>
        {world.system && <div className="muted">{world.system}</div>}
        {world.description && <p className="lead">{world.description}</p>}
      </header>

      <input className="search" placeholder="Search this world…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {query.trim() && (
        <ul className="entity-list">
          {results.map((h) => (
            <li key={h.key}>
              <Link to={h.to}>
                {h.icon} {h.title}
              </Link>
              {h.snippet && <span className="muted"> · {h.snippet}</span>}
            </li>
          ))}
          {results.length === 0 && <li className="muted">Nothing matches.</li>}
        </ul>
      )}

      <section>
        <h2>Browse</h2>
        {types.length + custom.length === 0 ? (
          <Empty>Nothing has been revealed yet. Check back after the next session.</Empty>
        ) : (
          <div className="wiki-cards">
            {types.map(([t, n]) => (
              <Link key={t} className="wiki-card" to={`/w/${worldId}/type/${t}`}>
                <span className="wiki-card-icon">{ENTITY_LABELS[t].icon}</span>
                <strong>{ENTITY_LABELS[t].many}</strong>
                <span className="muted small">{n}</span>
              </Link>
            ))}
            {custom.map(([c, n]) => (
              <Link key={c.id} className="wiki-card" to={`/w/${worldId}/type/custom/${c.id}`}>
                <span className="wiki-card-icon">{c.icon}</span>
                <strong>{c.many}</strong>
                <span className="muted small">{n}</span>
              </Link>
            ))}
            {maps.length > 0 && (
              <Link className="wiki-card" to={`/w/${worldId}/maps`}>
                <span className="wiki-card-icon">🗺️</span>
                <strong>Maps</strong>
                <span className="muted small">{maps.length}</span>
              </Link>
            )}
            <Link className="wiki-card" to={`/w/${worldId}/timeline`}>
              <span className="wiki-card-icon">⏳</span>
              <strong>Timeline</strong>
            </Link>
          </div>
        )}
      </section>

      <div className="two-col">
        <section>
          <h2>The story so far</h2>
          {recaps.length === 0 ? (
            <Empty>No session recaps yet.</Empty>
          ) : (
            recaps.slice(0, 3).map((s) => (
              <article key={s.id} className="wiki-recap">
                <h3>
                  <Link to={`/w/${worldId}/s/${s.id}`}>
                    #{s.number} {s.title}
                  </Link>{' '}
                  <span className="muted small">
                    {campaigns.find((c) => c.id === s.campaignId)?.name} · {s.date}
                  </span>
                </h3>
                <Markdown text={s.recap.length > 600 ? `${s.recap.slice(0, 600)}…` : s.recap} entities={entities} worldId={worldId} showSecrets={false} />
              </article>
            ))
          )}
        </section>
        <section>
          <h2>Recently added</h2>
          <ul className="entity-list">
            {recent.map((e) => (
              <li key={e.id}>
                <Link to={`/w/${worldId}/e/${e.id}`}>
                  {ENTITY_LABELS[e.type].icon} {e.name}
                </Link>
                {e.summary && <span className="muted"> · {plainLinks(e.summary)}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="muted small wiki-footer">Made with the Warded Atlas.</p>
    </div>
  )
}
