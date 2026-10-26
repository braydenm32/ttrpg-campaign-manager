import { Help } from '../help'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty, Modal } from '../components'
import { db, ENTITY_LABELS, GAME_SYSTEMS, newId, PICKER_TYPES, typeLabel } from '../db'
import { useCreatePage } from '../NewPage'
import { useVisibleEntities, useWorld } from '../hooks'
import { plainLinks } from '../text'
import { URGENCY, useCampaigns } from '../threads'
import { searchWorld, useSearchable } from '../search'
import { useViewMode } from '../viewMode'
import { WorldToday } from '../calendar'
import { BackupReminder } from '../BackupReminder'
import WikiHome from './WikiHome'
import PlayerHome from './PlayerHome'
import { localDate } from '../sessions'
import { showDate, upcoming } from '../players/Schedule'
import { useLiveQuery } from 'dexie-react-hooks'

export default function Dashboard() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const campaigns = useCampaigns(worldId)
  const [query, setQuery] = useState('')
  const [newCampaign, setNewCampaign] = useState(false)

  const q = query.trim().toLowerCase()
  const searchable = useSearchable(worldId)
  const results = searchWorld(query, { worldId, world, ...searchable })
  const recent = [...entities].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
  const urgencyRank = { high: 0, normal: 1, low: 2 }
  const openThreads = entities
    .filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active'))
    .sort((a, b) => urgencyRank[a.threadUrgency ?? 'normal'] - urgencyRank[b.threadUrgency ?? 'normal'] || b.updatedAt - a.updatedAt)
  const openQuests = entities.filter((e) => e.type === 'quest' && (e.questStatus === 'open' || e.questStatus === 'active'))

  const quickCreate = useCreatePage(world)

  if (!world) return null
  // Opened from a public wiki link: a tidy front page for readers instead of the GM's overview.
  if (world.shared?.token) return <WikiHome world={world} />
  // Players (and the GM previewing as one) get their own front page.
  if (!isGM) return <PlayerHome world={world} />
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
      {isGM && <BackupReminder world={world} />}
      <WorldToday world={world} isGM={isGM} />
      {entities.length < 3 && campaigns.length === 0 && <GettingStarted worldId={worldId} />}
      <NextSessions worldId={worldId} />

      <input
        className="search"
        placeholder="Search pages, text, sessions and maps…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {q && (
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

      {isGM && (
        <section>
          <h2>
            Quick add <Help topic="quickAdd" />
          </h2>
          <div className="row wrap">
            {PICKER_TYPES.map((t) => (
              <button key={t} onClick={() => quickCreate(t)}>
                {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].one}
              </button>
            ))}
            {world.customTypes?.map((c) => (
              <button key={c.id} onClick={() => quickCreate('custom', c.id)}>
                {c.icon} {c.one}
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
                    {typeLabel(e, world).icon} {e.name}
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

/** The GM's "what's next" card: each campaign's coming session, with its prep and the Lectern a click away. */
function NextSessions({ worldId }: { worldId: string }) {
  const campaigns = useCampaigns(worldId)
  const sessions = useLiveQuery(() => db.sessions.where({ worldId }).toArray(), [worldId]) ?? []
  const today = localDate()
  const cards = campaigns
    .filter((c) => c.status !== 'finished')
    .map((c) => {
      const own = sessions.filter((s) => s.campaignId === c.id).sort((a, b) => a.number - b.number)
      // The first session not played yet: dated today or later, or with nothing recapped.
      const next = own.find((s) => s.date >= today && !s.recap.trim()) ?? own.at(-1)
      return { c, next, booked: upcoming(c) }
    })
    .filter((x) => x.next || x.booked)
  if (!cards.length) return null
  return (
    <section className="next-sessions">
      <h2>
        Next session <Help topic="nextSession" />
      </h2>
      <div className="card-grid">
        {cards.map(({ c, next, booked }) => {
          const clues = next?.prep?.clues.filter((x) => !x.done && x.text.trim()).length ?? 0
          const scenes = next?.prep?.scenes.filter((x) => !x.done && x.text.trim()).length ?? 0
          return (
            <div key={c.id} className="card">
              <div className="muted small">🎲 {c.name}</div>
              {next ? (
                <Link to={`/w/${worldId}/s/${next.id}`}>
                  <strong>
                    #{next.number} {next.title}
                  </strong>
                </Link>
              ) : (
                <strong>No session yet</strong>
              )}
              <div className="muted small">
                {booked ? `📌 ${showDate(booked)}` : next?.date}
                {next && (clues || scenes) ? ` · ${scenes} scene${scenes === 1 ? '' : 's'}, ${clues} clue${clues === 1 ? '' : 's'} ready` : ''}
              </div>
              {next && (
                <div className="row wrap">
                  <Link className="button small" to={`/w/${worldId}/s/${next.id}?tab=prep`}>
                    📋 Prep
                  </Link>
                  <Link className="button small primary" to={`/w/${worldId}/s/${next.id}/lectern`}>
                    📖 Run at the Lectern
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** A short first-steps list for a new, nearly empty world. */
function GettingStarted({ worldId }: { worldId: string }) {
  const steps: [string, string, string][] = [
    ['🎲', 'Make a campaign', 'One group’s story in this world. Use “+ Campaign” below.'],
    ['🧑', 'Add a few people and places', 'Use Quick add. Link pages to each other by writing [[Name]].'],
    ['🗺️', 'Add a map', 'Upload one or draw it, then pin your places on it.'],
    ['🔒', 'Keep secrets', 'Pages start GM only. Reveal them when the players find out, and hide passages with the 🔒 buttons.'],
    ['☁️', 'Invite your players (optional)', 'Turn on cloud sync in World settings, then send invite links.'],
  ]
  return (
    <section className="card getting-started">
      <h2>
        Getting started <Help topic="gettingStarted" />
      </h2>
      <ol>
        {steps.map(([icon, title, text]) => (
          <li key={title}>
            {icon} <strong>{title}.</strong> <span className="muted">{text}</span>
          </li>
        ))}
      </ol>
      <p className="small muted">
        Every ? button explains the thing next to it. <Link to={`/w/${worldId}/settings`}>World settings</Link> can turn them off.
      </p>
    </section>
  )
}
