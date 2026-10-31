import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty } from '../components'
import { ENTITY_LABELS, ENTITY_TYPES, type World } from '../db'
import { WorldCover } from '../WorldCover'
import { useVisibleEntities } from '../hooks'
import { Markdown } from '../Markdown'
import { searchWorld, useSearchable } from '../search'
import { plainLinks } from '../text'
import { useCampaigns, useWorldSessions } from '../threads'
import { Ico, TypeIcon } from '../icons'
import { Hourglass, MapTrifold } from '@phosphor-icons/react'
import { pagePath, typePath, worldPath } from '../paths'
import { countByType, useVisibleMaps } from '../counts'

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
  const maps = useVisibleMaps(worldId)
  const [query, setQuery] = useState('')
  const searchable = useSearchable(worldId)
  const results = searchWorld(query, { worldId, world, ...searchable })
  const recaps = [...sessions].filter((s) => s.recap.trim()).sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number)
  const counts = countByType(entities, world)
  // Custom pages with no custom type of their own are "Other pages", after the built-in types.
  const types = [...ENTITY_TYPES.filter((t) => t !== 'custom'), 'custom' as const].map((t) => [t, counts.get(t === 'custom' ? 'other' : t) ?? 0] as const).filter(([, n]) => n)
  const custom = (world.customTypes ?? []).map((c) => [c, counts.get(`custom:${c.id}`) ?? 0] as const).filter(([, n]) => n)
  const recent = [...entities].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)

  return (
    <div className="page wiki-home more-screen">
      <WorldCover world={world} help="wiki">
        <span className="world-cover-meta">Public wiki · read only</span>
      </WorldCover>

      <input className="search" type="search" aria-label="Search this world" placeholder="Search this world…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
              <Link key={t} className="wiki-card" to={`${typePath(worldId, t)}`}>
                <span className="wiki-card-icon"><TypeIcon type={t} /></span>
                <strong>{ENTITY_LABELS[t].many}</strong>
                <span className="muted small">{n}</span>
              </Link>
            ))}
            {custom.map(([c, n]) => (
              <Link key={c.id} className="wiki-card" to={`${typePath(worldId, 'custom', c.id)}`}>
                <span className="wiki-card-icon">{c.icon}</span>
                <strong>{c.many}</strong>
                <span className="muted small">{n}</span>
              </Link>
            ))}
            {maps.length > 0 && (
              <Link className="wiki-card" to={`${worldPath(worldId)}/maps`}>
                <span className="wiki-card-icon"><Ico as={MapTrifold} /></span>
                <strong>Maps</strong>
                <span className="muted small">{maps.length}</span>
              </Link>
            )}
            <Link className="wiki-card" to={`${worldPath(worldId)}/timeline`}>
              <span className="wiki-card-icon"><Ico as={Hourglass} /></span>
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
                  <Link to={`${worldPath(worldId)}/s/${s.id}`}>
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
          {recent.length === 0 && <Empty>Nothing here yet. Pages appear as the GM reveals them.</Empty>}
          <ul className="entity-list">
            {recent.map((e) => (
              <li key={e.id}>
                <Link to={`${pagePath(worldId, e.id)}`}>
                  <TypeIcon type={e.type} /> {e.name}
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
