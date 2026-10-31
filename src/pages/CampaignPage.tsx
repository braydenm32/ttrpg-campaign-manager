import { binCampaign } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DraftText, Empty, Skeleton, VisibilityBadge, VisibilityToggle } from '../components'
import { db, GAME_SYSTEMS, type Campaign, type Session } from '../db'
import { useLiveRecording } from '../recordingStore'
import { PartyGlance } from '../partyGlance'
import { StorySoFar } from '../highlights'
import { questProgress } from '../quests'
import { isActiveQuest, isOpenQuest } from '../counts'
import { bookNextSession, createNextSession, partyOf, sessionFirstTab, sessionStage, startPlaying, type SessionStage } from '../sessions'
import { useVisibleEntities, useWorld } from '../hooks'
import { SessionScheduler } from '../players/Schedule'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { Compass, FlagCheckered, ListChecks, Microphone, Play, Shield } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { canSeeSession, nextSessions } from '../threads'
import { StageChip, usePlayingNow } from '../stage'
import { useKeepScroll } from '../jump'
import { SavedMark, toast } from '../undo'
import { prepCounts } from '../counts'

export default function CampaignPage() {
  const { worldId, world } = useWorld()
  const { campaignId = '' } = useParams()
  const { isGM } = useViewMode()
  const navigate = useNavigate()
  const campaign = useLiveQuery(async () => (await db.campaigns.get(campaignId)) ?? null, [campaignId])
  const sessions = (useLiveQuery(() => db.sessions.where({ campaignId }).sortBy('number'), [campaignId]) ?? []).filter((s) => canSeeSession(s, campaign, isGM))
  const live = useLiveRecording()
  const recording = !!live && sessions.some((s) => s.id === live.sessionId)
  const entities = useVisibleEntities(worldId)
  const pcs = partyOf(entities, campaignId)
  // Quests belong to the world, not to one campaign: the same list as Home's "Open quests".
  const quests = entities.filter(isOpenQuest)
  const playing = usePlayingNow(worldId)
  useKeepScroll(campaign !== undefined)

  if (campaign === undefined) return <Skeleton />
  if (campaign === null || campaign.worldId !== worldId || (!isGM && campaign.visibility === 'gm')) return <Empty>Campaign not found.</Empty>
  const update = (patch: Partial<Campaign>) => db.campaigns.update(campaign.id, patch)
  const w = worldPath(worldId)
  // The same "next session" the Desk shows (a finished campaign still has one here).
  const next = nextSessions([{ ...campaign, status: 'active' }], sessions, playing)[0]?.session

  const newSession = async (date?: string) => {
    const s = await createNextSession(worldId, campaignId, date)
    navigate(`${w}/s/${s.id}?tab=prep`)
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
              <VisibilityToggle
                value={campaign.visibility ?? 'players'}
                onChange={async (v) => {
                  const was = campaign.visibility
                  await update({ visibility: v === 'players' ? undefined : v })
                  toast(v === 'players' ? `Players can see “${campaign.name}” and the sessions you’ve shown them.` : `“${campaign.name}” is hidden from players.`, () => update({ visibility: was }))
                }}
              />
              <Help topic="hiddenCampaign" />
              <SavedMark />
            </div>
          ) : (
            <div className="muted">
              {campaign.system} · {campaign.status}
            </div>
          )}
        </div>
        {isGM && (
          <button onClick={() => newSession()}>
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

      {isGM && <NextUp worldId={worldId} next={next} stage={next && sessionStage(next, playing.includes(next.id))} onNew={() => newSession()} />}


      <div className="two-col">
        <section>
          <h2>
            Sessions <Help topic="session" />
          </h2>
          {sessions.length === 0 ? (
            <Empty>{isGM ? 'No sessions yet.' : 'No sessions shown to players yet.'}</Empty>
          ) : (
            <ul className="session-rows">
              {[...sessions].reverse().map((s) => {
                const stage = sessionStage(s, playing.includes(s.id))
                return (
                  <li key={s.id} className={s.id === next?.id ? 'is-next' : ''}>
                    <Link to={`${w}/s/${s.id}${isGM ? `?tab=${sessionFirstTab(s)}` : ''}`}>
                      <span className="session-num">#{s.number}</span>
                      <span className="session-name">{s.title}</span>
                      <span className="muted small session-date">{s.date || (isGM ? 'no date' : '')}</span>
                    </Link>
                    {isGM && <StageChip stage={stage} />}
                    {isGM && s.visibility === 'gm' && <VisibilityBadge value={s.visibility} />}
                    {s.recordings.length > 0 && <span title="Has recordings"> <Ico as={Microphone} /></span>}
                  </li>
                )
              })}
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
          <h2>Open quests in this world</h2>
          {quests.length === 0 ? (
            <Empty>None.</Empty>
          ) : (
            <ul className="entity-list">
              {quests.map((e) => (
                <li key={e.id}>
                  <Link to={`${pagePath(worldId, e.id)}`}><Ico as={Compass} /> {e.name}</Link>
                  {isActiveQuest(e) && <span className="muted"> · active</span>}
                  {questProgress(e) && <span className="muted"> · {questProgress(e)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {world && <StorySoFar world={world} campaign={campaign} sessions={sessions} entities={entities} isGM={isGM} />}

      {world && (
        <SessionScheduler
          world={world}
          campaign={campaign}
          isGM={isGM}
          heading={isGM ? 'Find a date with your players' : undefined}
          onBook={async (date) => {
            const s = await bookNextSession(worldId, campaignId, date)
            navigate(`${w}/s/${s.id}?tab=prep`)
          }}
        />
      )}

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

/**
 * All sessions › Next session: the session in hand itself, with its stage and the one next step
 * (Prepare, Start playing, Back to the table or Wrap up), or a way to make the next one.
 */
function NextUp({ worldId, next, stage, onNew }: { worldId: string; next: Session | undefined; stage: SessionStage | undefined; onNew: () => void }) {
  const navigate = useNavigate()
  const w = worldPath(worldId)
  if (!next || !stage || stage === 'played')
    return (
      <section className="card next-up">
        <h2>
          Next session <Help topic="nextSession" />
        </h2>
        <p className="muted">{next ? `#${next.number} ${next.title} is played.` : 'No sessions yet.'}</p>
        <button className="primary" onClick={onNew}>
          <Ico as={ListChecks} /> Plan session #{(next?.number ?? 0) + 1}
        </button>
      </section>
    )
  const { scenes, clues } = prepCounts(next.prep)
  return (
    <section className="card next-up">
      <h2>
        Next session <Help topic="nextSession" />
      </h2>
      <div className="row wrap">
        <StageChip stage={stage} />
        <Link className="next-title" to={`${w}/s/${next.id}?tab=${stage === 'playing' ? 'notes' : 'prep'}`}>
          #{next.number} {next.title}
        </Link>
      </div>
      <p className="muted small">
        {[next.date || 'No date yet', scenes.total ? `${scenes.total} scene${scenes.total === 1 ? '' : 's'}, ${clues.total} clue${clues.total === 1 ? '' : 's'} planned` : 'Nothing planned yet'].join(' · ')}
      </p>
      <div className="row wrap">
        {stage === 'playing' ? (
          <>
            <Link className="button primary" to={`${w}/s/${next.id}/lectern`}>
              <Ico as={Play} weight="fill" /> Back to the table
            </Link>
            <Link className="button" to={`${w}/s/${next.id}?tab=notes`}>
              <Ico as={FlagCheckered} /> Wrap up
            </Link>
          </>
        ) : (
          <>
            <Link className="button primary" to={`${w}/s/${next.id}?tab=prep`}>
              <Ico as={ListChecks} /> Prepare
            </Link>
            <button
              onClick={async () => {
                await startPlaying(next.id)
                navigate(`${w}/s/${next.id}/lectern`)
              }}
            >
              <Ico as={Play} weight="fill" /> Start playing
            </button>
          </>
        )}
      </div>
    </section>
  )
}
