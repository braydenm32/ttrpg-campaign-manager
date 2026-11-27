import { Link } from 'react-router-dom'
import type { Campaign, World } from './db'
import { Help } from './help'
import { worldPath } from './paths'
import { setCampaignStatus } from './campaignStatus'

/**
 * One line for paused campaigns, with "Carry on" for each: on the Desk and the Session area, so
 * un-pausing is one press. `finishedToo` lists the finished ones as well, each with "Back on the
 * Desk": for when no campaign is being run, so there is always a way back in sight.
 */
export function PausedCampaigns({ world, campaigns, finishedToo }: { world: World; campaigns: Campaign[]; finishedToo?: boolean }) {
  const resting = campaigns.filter((c) => c.status === 'paused' || (finishedToo && c.status === 'finished'))
  if (!resting.length) return null
  return (
    <p className="paused-campaigns small muted">
      {resting.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ' · '}
          {c.status === 'paused' ? 'Paused' : 'Finished'}: <Link to={`${worldPath(world.id)}/c/${c.id}`}>{c.name}</Link>{' '}
          <button className="small" onClick={() => setCampaignStatus(c, 'active')}>
            {c.status === 'paused' ? 'Carry on' : 'Back on the Desk'}
          </button>
        </span>
      ))}{' '}
      <Help topic="campaignStatus" />
    </p>
  )
}
