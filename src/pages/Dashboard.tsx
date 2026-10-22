import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Modal } from '../components'
import { blankEntity, db, ENTITY_LABELS, ENTITY_TYPES, GAME_SYSTEMS, newId, type EntityType } from '../db'
import { useVisibleEntities, useWorld } from '../hooks'
import { plainLinks } from '../text'
import { URGENCY } from '../threads'
import { useViewMode } from '../viewMode'

export default function Dashboard() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const campaigns = useLiveQuery(() => db.campaigns.where({ worldId }).toArray(), [worldId]) ?? []
  const [query, setQuery] = useState('')
  const [newCampaign, setNewCampaign] = useState(false)

  const q = query.trim().toLowerCase()
  const results = q
    ? entities.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : []
  const recent = [...entities].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
  const urgencyRank = { high: 0, normal: 1, low: 2 }
  const openThreads = entities
    .filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active'))
    .sort((a, b) => urgencyRank[a.threadUrgency ?? 'normal'] - urgencyRank[b.threadUrgency ?? 'normal'] || b.updatedAt - a.updatedAt)
  const openQuests = entities.filter((e) => e.type === 'quest' && (e.questStatus === 'open' || e.questStatus === 'active'))

  const quickCreate = async (type: EntityType) => {
    const e = blankEntity(worldId, type, `New ${ENTITY_LABELS[type].one}`)
    await db.entities.add(e)
    navigate(`/w/${worldId}/e/${e.id}?edit=1`)
  }

  if (!world) return null
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            {world.name} <Help topic="overview" />
          </h1>
          <div className="muted">{world.system}</div>
        </div>
      </header>
      {world.description && <p className="lead">{world.description}</p>}

      <input
        className="search"
        placeholder="Search names, summaries and tags…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {q && (
        <ul className="entity-list">
          {results.map((e) => (
            <li key={e.id}>
              <Link to={`/w/${worldId}/e/${e.id}`}>
                {ENTITY_LABELS[e.type].icon} {e.name}
              </Link>
              <span className="muted"> · {e.summary}</span>
            </li>
          ))}
          {results.length === 0 && <li className="muted">Nothing matches.</li>}
        </ul>
      )}

      {isGM && (
        <section>
          <h2>
            Quick add <Help topic="quickAdd" />
          </h2>
          <div className="row wrap">
            {ENTITY_TYPES.map((t) => (
              <button key={t} onClick={() => quickCreate(t)}>
                {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].one}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="two-col">
        <section>
          <div className="section-header">
            <h2>
              Campaigns <Help topic="campaign" />
            </h2>
            {isGM && <button onClick={() => setNewCampaign(true)}>+ Campaign</button>}
          </div>
          {campaigns.length === 0 ? (
            <Empty>A campaign is one group's story in this world. You can run several in the same world.</Empty>
          ) : (
            <ul className="entity-list">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <Link to={`/w/${worldId}/c/${c.id}`}>🎲 {c.name}</Link>
                  <span className="muted"> · {c.status}</span>
                </li>
              ))}
            </ul>
          )}
          <h2>Open quests</h2>
          {openQuests.length === 0 ? (
            <Empty>No open quests.</Empty>
          ) : (
            <ul className="entity-list">
              {openQuests.map((e) => (
                <li key={e.id}>
                  <Link to={`/w/${worldId}/e/${e.id}`}>🧭 {e.name}</Link>
                  <span className="muted"> · {e.questStatus}</span>
                </li>
              ))}
            </ul>
          )}
          <h2>
            <Link to={`/w/${worldId}/threads`}>🧵 Loose threads</Link>
          </h2>
          {openThreads.length === 0 ? (
            <Empty>No loose threads.</Empty>
          ) : (
            <ul className="entity-list">
              {openThreads.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link to={`/w/${worldId}/e/${e.id}`}>
                    {e.threadUrgency && URGENCY[e.threadUrgency].icon} {e.name}
                  </Link>
                  {e.summary && <span className="muted"> · {plainLinks(e.summary)}</span>}
                </li>
              ))}
              {openThreads.length > 6 && (
                <li>
                  <Link to={`/w/${worldId}/threads`}>…and {openThreads.length - 6} more</Link>
                </li>
              )}
            </ul>
          )}
        </section>
        <section>
          <h2>Recently updated</h2>
          {recent.length === 0 ? (
            <Empty>Nothing here yet.</Empty>
          ) : (
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
          )}
        </section>
      </div>
      {newCampaign && (
        <NewCampaign
          worldId={worldId}
          defaultSystem={world.system}
          onClose={() => setNewCampaign(false)}
          onCreated={(id) => navigate(`/w/${worldId}/c/${id}`)}
        />
      )}
    </div>
  )
}

function NewCampaign({
  worldId,
  defaultSystem,
  onClose,
  onCreated,
}: {
  worldId: string
  defaultSystem: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [system, setSystem] = useState(defaultSystem)
  return (
    <Modal title="New campaign" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const id = newId()
          await db.campaigns.add({
            id,
            worldId,
            name: name.trim(),
            system,
            description: '',
            status: 'planning',
            createdAt: Date.now(),
          })
          onCreated(id)
        }}
      >
        <label>
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Game system
          <select value={system} onChange={(e) => setSystem(e.target.value)}>
            {GAME_SYSTEMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="row end">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </Modal>
  )
}
