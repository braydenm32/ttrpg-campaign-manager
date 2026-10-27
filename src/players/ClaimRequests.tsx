import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { approveClaim, releaseCharacter } from '../cloud/players'
import type { World } from '../db'
import { useVisibleEntities } from '../hooks'
import { Help } from '../help'
import { useCharacterOwners } from './owners'
import { Ico } from '../icons'
import { MaskHappy } from '@phosphor-icons/react'
import { pagePath } from '../paths'

/**
 * For the GM: a banner when a player asks to play a character, with Approve and Decline right
 * there. It checks again every couple of minutes while the app is open.
 */
export function ClaimRequestsBanner({ world }: { world: World }) {
  const { owners, reload } = useCharacterOwners(world)
  const entities = useVisibleEntities(world.id)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const t = setInterval(() => !document.hidden && reload(), 120_000)
    return () => clearInterval(t)
  }, [reload])
  const pending = [...owners.entries()].filter(([, o]) => o.pending)
  if (!pending.length) return null
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      await reload()
      setBusy(false)
    }
  }
  return (
    <div className="player-banner claim-requests">
      {pending.map(([entityId, o]) => {
        const name = entities.find((e) => e.id === entityId)?.name ?? 'a character'
        return (
          <div key={entityId} className="row wrap">
            <span>
              <Ico as={MaskHappy} /> <strong>{o.name}</strong> asked to play <Link to={`${pagePath(world.id, entityId)}`}>{name}</Link>.
            </span>
            <button className="primary small" disabled={busy} onClick={() => run(() => approveClaim(world.id, entityId))}>
              ✓ Approve
            </button>
            <button className="small" disabled={busy} onClick={() => confirm(`Turn down ${o.name}’s request to play ${name}?`) && run(() => releaseCharacter(world.id, entityId, false))}>
              Decline
            </button>
          </div>
        )
      })}
      <Help topic="claimRequests" />
    </div>
  )
}
