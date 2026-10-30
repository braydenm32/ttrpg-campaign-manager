import { binCampaign } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DraftText, Empty, VisibilityBadge, VisibilityToggle } from '../components'
import { db, GAME_SYSTEMS, type Campaign } from '../db'
import { useLiveRecording } from '../recordingStore'
import { PartyGlance } from '../partyGlance'
import { bookNextSession, createNextSession, partyOf } from '../sessions'
import { useVisibleEntities, useWorld } from '../hooks'
import { SessionScheduler } from '../players/Schedule'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { Compass, Microphone, Shield } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'

export default function CampaignPage() {
  const { worldId, world } = useWorld()
  const { campaignId = '' } = useParams()
  const { isGM, canSee } = useViewMode()
  const navigate = useNavigate()
  const campaign = useLiveQuery(async () => (await db.campaigns.get(campaignId)) ?? null, [campaignId])
  const sessions =
    useLiveQuery(
      () => db.sessions.where({ campaignId }).filter((s) => canSee(s.visibility)).sortBy('number'),
      [campaignId, isGM],
    ) ?? []
  const live = useLiveRecording()
  const recording = !!live && sessions.some((s) => s.id === live.sessionId)
  const entities = useVisibleEntities(worldId)
  const pcs = partyOf(entities, campaignId)
  const quests = entities.filter((e) => e.type === 'quest' && e.questStatus === 'active')

  if (campaign === undefined) return null
  if (campaign === null || campaign.worldId !== worldId || (!isGM && campaign.visibility === 'gm')) return <Empty>Campaign not found.</Empty>
  const update = (patch: Partial<Campaign>) => db.campaigns.update(campaign.id, patch)

  const newSession = async (date?: string) => {
    const s = await createNextSession(worldId, campaignId, date)
    navigate(`${worldPath(worldId)}/s/${s.id}`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          {isGM ? (
            <DraftText className="title-input" value={campaign.name} onCommit={(name) => update({ name })} />
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
              <VisibilityToggle value={campaign.visibility ?? 'players'} onChange={(v) => update({ visibility: v === 'players' ? undefined : v })} />
              <Help topic="hiddenCampaign" />
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
        <>
          <DraftText
            multiline
            rows={3}
            placeholder="Campaign pitch, themes, what the players should know…"
            value={campaign.description}
            onCommit={(description) => update({ description })}
          />
          <small className="muted">{campaign.visibility === 'gm' ? 'This campaign is hidden from players.' : 'Players can read this. Keep secrets out of it.'}</small>
        </>
      ) : (
        campaign.description && <p className="lead">{campaign.description}</p>
      )}

      {world && (
        <SessionScheduler
          world={world}
          campaign={campaign}
          isGM={isGM}
          onBook={async (date) => {
            const s = await bookNextSession(worldId, campaignId, date)
            navigate(`${worldPath(worldId)}/s/${s.id}`)
          }}
        />
      )}

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
                  <Link to={`${worldPath(worldId)}/s/${s.id}`}>
                    #{s.number} {s.title}
                  </Link>{' '}
                  <VisibilityBadge value={s.visibility} />
                  {s.date && <span className="muted"> · {s.date}</span>}
                  {s.recordings.length > 0 && <span title="Has recordings"> <Ico as={Microphone} /></span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>The party</h2>
          {pcs.length === 0 ? (
            <Empty>Add Player Characters in the codex.</Empty>
          ) : isGM && world ? (
            <PartyGlance world={world} party={pcs} />
          ) : (
            <ul className="entity-list">
              {pcs.map((e) => (
                <li key={e.id}>
                  <Link to={`${pagePath(worldId, e.id)}`}><Ico as={Shield} /> {e.name}</Link>
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
                  <Link to={`${pagePath(worldId, e.id)}`}><Ico as={Compass} /> {e.name}</Link>
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
            disabled={recording}
            title={recording ? 'Stop the recording first' : undefined}
            onClick={async () => {
              if (!confirm(`Delete campaign "${campaign.name}" and its sessions? World content is kept.`)) return
              // Characters who played only in this campaign go back to "any campaign", so they don't vanish from every party.
              await db.entities.where({ worldId }).filter((e) => e.campaignId === campaignId).modify({ campaignId: undefined })
              await binCampaign(campaignId)
              navigate(`${worldPath(worldId)}`)
            }}
          >
            Delete campaign
          </button>
        </div>
      )}
    </div>
  )
}
