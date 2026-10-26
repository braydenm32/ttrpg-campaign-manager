import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty } from '../components'
import { typeLabel, type World } from '../db'
import { Help } from '../help'
import { useAssetUrl, useVisibleEntities } from '../hooks'
import { Markdown } from '../Markdown'
import { useCharacterOwners } from '../players/owners'
import { SessionScheduler } from '../players/Schedule'
import { searchWorld, useSearchable } from '../search'
import { plainLinks } from '../text'
import { latestSession, useCampaigns, useWorldSessions } from '../threads'

/**
 * The overview for players (and the GM's player view): the next session, "previously on…" from the
 * latest recap, your character, handouts, and what to look at next.
 */
export default function PlayerHome({ world }: { world: World }) {
  const worldId = world.id
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const campaigns = useCampaigns(worldId)
  const { owners } = useCharacterOwners(world)
  const [query, setQuery] = useState('')
  const searchable = useSearchable(worldId)
  const results = searchWorld(query, { worldId, world, ...searchable })
  const memberOf = world.shared?.memberOf

  const last = latestSession(sessions.filter((s) => s.recap.trim()))
  const mine = entities.filter((e) => owners.get(e.id)?.mine)
  const leads = entities.filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active'))
  const quests = entities.filter((e) => e.type === 'quest' && (e.questStatus === 'open' || e.questStatus === 'active'))
  const recent = [...entities].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  const handouts = (world.handouts ?? []).slice(0, 4)
  const scheduled = campaigns.filter((c) => c.booked || c.schedule?.length)

  return (
    <div className="page player-home">
      <header className="page-header">
        <div>
          <h1>
            {world.name} <Help topic="playerHome" />
          </h1>
          <div className="muted">{world.system}</div>
        </div>
        {memberOf && (
          <Link className="button" to={`/w/${worldId}/questions`}>
            ❓ Ask the GM
          </Link>
        )}
      </header>
      {world.description && <p className="lead">{world.description}</p>}

      <input className="search" placeholder="Search what you know…" value={query} onChange={(e) => setQuery(e.target.value)} />
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

      {scheduled.map((c) => (
        <SessionScheduler key={c.id} world={world} campaign={c} isGM={false} onBook={async () => {}} />
      ))}

      <div className="two-col">
        <section>
          <h2>📜 Previously on…</h2>
          {last ? (
            <div className="card">
              <Link to={`/w/${worldId}/s/${last.id}`}>
                <strong>
                  #{last.number} {last.title}
                </strong>
              </Link>
              <div className="recap-preview">
                <Markdown text={last.recap} entities={entities} worldId={worldId} showSecrets={false} />
              </div>
            </div>
          ) : (
            <Empty>No recaps yet. Your GM’s write-up of each session lands here.</Empty>
          )}
          <h2>🧵 Leads</h2>
          {leads.length + quests.length === 0 ? (
            <Empty>No open leads or quests yet.</Empty>
          ) : (
            <ul className="entity-list">
              {[...quests, ...leads].slice(0, 10).map((e) => (
                <li key={e.id}>
                  <Link to={`/w/${worldId}/e/${e.id}`}>
                    {typeLabel(e, world).icon} {e.name}
                  </Link>
                  {e.summary && <span className="muted"> · {plainLinks(e.summary)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          {mine.length > 0 && (
            <>
              <h2>🛡️ {mine.length > 1 ? 'Your characters' : 'Your character'}</h2>
              {mine.map((e) => (
                <MyCharacterCard key={e.id} worldId={worldId} id={e.id} name={e.name} summary={e.summary} imageId={e.imageId} />
              ))}
            </>
          )}
          {handouts.length > 0 && (
            <>
              <h2>
                <Link to={`/w/${worldId}/handouts`}>🗞️ Handouts</Link>
              </h2>
              <ul className="entity-list">
                {handouts.map((h) => (
                  <li key={h.id}>
                    <Link to={`/w/${worldId}/handouts`}>
                      {{ image: '🖼️', page: '📄', text: '📝' }[h.kind]} {h.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2>Recently updated</h2>
          {recent.length === 0 ? (
            <Empty>Nothing revealed yet. Pages your GM reveals show up here.</Empty>
          ) : (
            <ul className="entity-list">
              {recent.map((e) => (
                <li key={e.id}>
                  <Link to={`/w/${worldId}/e/${e.id}`}>
                    {typeLabel(e, world).icon} {e.name}
                  </Link>
                  {e.summary && <span className="muted"> · {plainLinks(e.summary)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function MyCharacterCard({ worldId, id, name, summary, imageId }: { worldId: string; id: string; name: string; summary: string; imageId?: string }) {
  const image = useAssetUrl(imageId)
  return (
    <Link className="card my-character" to={`/w/${worldId}/e/${id}`}>
      {image && <img src={image} alt="" />}
      <div>
        <strong>{name}</strong>
        {summary && <div className="muted small">{plainLinks(summary)}</div>}
      </div>
    </Link>
  )
}
