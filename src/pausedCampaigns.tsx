import { Link } from 'react-router-dom'
import type { Campaign, World } from './db'
import { Help } from './help'
import { worldPath } from './paths'
import { setCampaignStatus } from './campaignStatus'

/** One line for paused campaigns, with "Carry on" for each: on the Desk and the Session area, so un-pausing is one press. */
export function PausedCampaigns({ world, campaigns }: { world: World; campaigns: Campaign[] }) {
  const paused = campaigns.filter((c) => c.status === 'paused')
  if (!paused.length) return null
  return (
    <p className="paused-campaigns small muted">
      {paused.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ' · '}
          Paused: <Link to={`${worldPath(world.id)}/c/${c.id}`}>{c.name}</Link>{' '}
          <button className="small" onClick={() => setCampaignStatus(c, 'active')}>
            Carry on
          </button>
        </span>
      ))}{' '}
      <Help topic="campaignStatus" />
    </p>
  )
}
