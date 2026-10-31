import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ListChecks } from '@phosphor-icons/react'
import { db } from '../db'
import { Empty } from '../components'
import { Help } from '../help'
import { useWorld } from '../hooks'
import { Ico } from '../icons'
import { nextSessions } from '../threads'
import { createNextSession, playedAlready } from '../sessions'
import { useViewMode } from '../viewMode'
import { useFrameContext } from '../Sidebar'
import { worldPath } from '../paths'
import { NewCampaign } from './Dashboard'

/**
 * Where the Session area starts: the session being played, or the next one to play. With none to
 * go to (no campaign yet, or the last session already played), a calm page with one button to plan
 * the next session.
 */
export default function SessionLanding() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const frame = useFrameContext()
  const navigate = useNavigate()
  const [naming, setNaming] = useState(false)
  const data = useLiveQuery(async () => ({ campaigns: await db.campaigns.where({ worldId }).toArray(), sessions: await db.sessions.where({ worldId }).toArray() }), [worldId])
  if (!world || !data || !frame) return null
  const w = worldPath(worldId)
  if (!isGM || world.shared)
    return (
      <div className="page">
        <Empty>
          Sessions and their recaps are under <Link to={`${w}/timeline`}>the Timeline</Link>.
        </Empty>
      </div>
    )
  const home = frame.facts.sessionHome
  if (home && home !== `${w}/session`) return <Navigate to={home} replace />
  const next = nextSessions(data.campaigns, data.sessions)[0]
  if (next && !playedAlready(next.session)) return <Navigate to={`${w}/s/${next.session.id}?tab=prep`} replace />
  const campaign = next?.campaign ?? data.campaigns.find((c) => c.status !== 'finished') ?? data.campaigns[0]
  const plan = async (campaignId: string) => {
    const s = await createNextSession(worldId, campaignId, '')
    navigate(`${w}/s/${s.id}?tab=prep`)
  }
  return (
    <div className="page session-landing">
      <header className="page-header">
        <div>
          <h1>
            Session <Help topic="nextSession" />
          </h1>
          <p className="lead">
            {next && playedAlready(next.session)
              ? `Session #${next.session.number} of ${next.campaign.name} has been played.`
              : campaign
                ? `${campaign.name} has no sessions yet.`
                : 'No campaign yet. A campaign is one group’s story in this world; its sessions are planned, played and wrapped up here.'}
          </p>
        </div>
      </header>
      <div className="row wrap">
        <button className="primary" onClick={() => (campaign ? plan(campaign.id) : setNaming(true))}>
          <Ico as={ListChecks} /> {next ? `Plan session #${next.session.number + 1}` : 'Plan the first session'}
        </button>
        {next && <Link className="button" to={`${w}/s/${next.session.id}?tab=notes`}>Wrap up #{next.session.number}</Link>}
        {campaign && <Link className="button" to={`${w}/c/${campaign.id}`}>All sessions</Link>}
      </div>
      {naming && <NewCampaign worldId={worldId} defaultSystem={world.system} onClose={() => setNaming(false)} onCreated={(id) => plan(id)} />}
    </div>
  )
}
