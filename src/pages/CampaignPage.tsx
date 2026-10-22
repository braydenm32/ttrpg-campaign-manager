import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Empty, VisibilityBadge } from '../components'
import { db, GAME_SYSTEMS, newId, type Campaign } from '../db'
import { useVisibleEntities, useWorld } from '../hooks'
import { SessionScheduler } from '../players/Schedule'
import { useViewMode } from '../viewMode'

export default function CampaignPage() {
  const { worldId, world } = useWorld()
  const { campaignId = '' } = useParams()
  const { isGM, canSee } = useViewMode()
  const navigate = useNavigate()
  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId])
  const sessions =
    useLiveQuery(
      () => db.sessions.where({ campaignId }).filter((s) => canSee(s.visibility)).sortBy('number'),
      [campaignId, isGM],
    ) ?? []
  const entities = useVisibleEntities(worldId)
  const pcs = entities.filter((e) => e.type === 'pc')
  const quests = entities.filter((e) => e.type === 'quest' && e.questStatus === 'active')

  if (campaign === undefined) return null
  if (campaign === null || campaign.worldId !== worldId) return <Empty>Campaign not found.</Empty>
  const update = (patch: Partial<Campaign>) => db.campaigns.update(campaign.id, patch)

  const newSession = async (date = new Date().toISOString().slice(0, 10)) => {
    const id = newId()
    const number = (sessions.at(-1)?.number ?? 0) + 1
    await db.sessions.add({
      id,
      worldId,
      campaignId,
      number,
      title: `Session ${number}`,
      date,
      notes: '',
      recap: '',
      visibility: 'gm',
      entityIds: [],
      recordings: [],
      createdAt: Date.now(),
    })
    navigate(`/w/${worldId}/s/${id}`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          {isGM ? (
            <input className="title-input" value={campaign.name} onChange={(e) => update({ name: e.target.value })} />
          ) : (
            <h1>
              {campaign.name} <Help topic="campaign" />
            </h1>
          )}
          {isGM ? (
            <div className="row">
              <select value={campaign.system} onChange={(e) => update({ system: e.target.value })}>
                {GAME_SYSTEMS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select value={campaign.status} onChange={(e) => update({ status: e.target.value as Campaign['status'] })}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="finished">Finished</option>
              </select>
            </div>
          ) : (
            <div className="muted">
              {campaign.system} · {campaign.status}
            </div>
          )}
        </div>
        {isGM && (
          <button className="primary" onClick={() => newSession()}>
            + New session
          </button>
        )}
      </header>
      {isGM ? (
        <textarea
          rows={3}
          placeholder="Campaign pitch, themes, session zero notes…"
          value={campaign.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      ) : (
        campaign.description && <p className="lead">{campaign.description}</p>
      )}

      {world && <SessionScheduler world={world} campaign={campaign} isGM={isGM} onBook={newSession} />}

      <div className="two-col">
        <section>
          <h2>
            Sessions <Help topic="session" />
          </h2>
          {sessions.length === 0 ? (
            <Empty>No sessions yet.</Empty>
          ) : (
            <ul className="entity-list sessions">
              {[...sessions].reverse().map((s) => (
                <li key={s.id}>
                  <Link to={`/w/${worldId}/s/${s.id}`}>
                    #{s.number} {s.title}
                  </Link>{' '}
                  <VisibilityBadge value={s.visibility} />
                  <span className="muted"> · {s.date}</span>
                  {s.recordings.length > 0 && <span title="Has recordings"> 🎙️</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>The party</h2>
          {pcs.length === 0 ? (
            <Empty>Add Player Characters in the codex.</Empty>
          ) : (
            <ul className="entity-list">
              {pcs.map((e) => (
                <li key={e.id}>
                  <Link to={`/w/${worldId}/e/${e.id}`}>🛡️ {e.name}</Link>
                  {e.summary && <span className="muted"> · {e.summary}</span>}
                </li>
              ))}
            </ul>
          )}
          <h2>Active quests</h2>
          {quests.length === 0 ? (
            <Empty>None.</Empty>
          ) : (
            <ul className="entity-list">
              {quests.map((e) => (
                <li key={e.id}>
                  <Link to={`/w/${worldId}/e/${e.id}`}>🧭 {e.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {isGM && (
        <div className="row end">
          <button
            className="danger"
            onClick={async () => {
              if (!confirm(`Delete campaign "${campaign.name}" and its sessions? World content is kept.`)) return
              const recs = sessions.flatMap((s) => s.recordings.map((r) => r.assetId))
              await db.transaction('rw', [db.campaigns, db.sessions, db.assets], async () => {
                await db.assets.bulkDelete(recs)
                await db.sessions.where({ campaignId }).delete()
                await db.campaigns.delete(campaignId)
              })
              navigate(`/w/${worldId}`)
            }}
          >
            Delete campaign
          </button>
        </div>
      )}
    </div>
  )
}
