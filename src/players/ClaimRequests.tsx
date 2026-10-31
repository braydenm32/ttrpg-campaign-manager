import { Link } from 'react-router-dom'
import type { World } from '../db'
import { useVisibleEntities } from '../hooks'
import { Help } from '../help'
import { Ico } from '../icons'
import { MaskHappy } from '@phosphor-icons/react'
import { pagePath } from '../paths'
import { useInbox } from '../Sidebar'
import { approveClaimLater, declineClaimLater } from './inboxActions'

/**
 * For the GM: a banner when a player asks to play a character, with Approve and Decline right
 * there (each with Undo for a few seconds). It reads the same inbox as the Desk and the Inbox,
 * where the same requests are listed, so it isn't shown on the Desk.
 */
export function ClaimRequestsBanner({ world }: { world: World }) {
  const { claims, reload } = useInbox()
  const entities = useVisibleEntities(world.id)
  if (!claims.length) return null
  return (
    <div className="player-banner claim-requests">
      {claims.map((c) => {
        const name = entities.find((e) => e.id === c.entityId)?.name ?? 'a character'
        return (
          <div key={c.entityId} className="row wrap">
            <span>
              <Ico as={MaskHappy} /> <strong>{c.who}</strong> asked to play <Link to={`${pagePath(world.id, c.entityId)}`}>{name}</Link>.
            </span>
            <button className="primary small" onClick={() => approveClaimLater(world.id, c, name, reload)}>
              ✓ Approve
            </button>
            <button className="small" onClick={() => declineClaimLater(world.id, c, name, reload)}>
              Decline
            </button>
          </div>
        )
      })}
      <Help topic="claimRequests" />
    </div>
  )
}
