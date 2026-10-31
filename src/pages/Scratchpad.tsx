import { Link } from 'react-router-dom'
import { Skeleton } from '../components'
import { Help } from '../help'
import '../more.css'
import { useVisibleEntities, useWorld } from '../hooks'
import { PlayerNotesBox } from '../players/Notes'
import { Ico } from '../icons'
import { Notepad, UsersThree } from '@phosphor-icons/react'
import { worldPath } from '../paths'
import { useViewMode } from '../viewMode'

/** The players' world-wide notebook: a shared page for the party, and a private one for each player. */
export default function Scratchpad() {
  const { worldId, world } = useWorld()
  const entities = useVisibleEntities(worldId)
  const { isGM } = useViewMode()
  if (!world) return <Skeleton />
  const player = !!world.shared?.memberOf
  if (!player && (world.shared || !world.cloud?.enabled))
    return (
      <div className="page more-screen">
        <div className="calm-note card">
          <Ico as={Notepad} size="2em" />
          <h1>Scratchpad</h1>
          <p>
            {world.shared
              ? 'The scratchpad is a notebook for the players who have joined this world.'
              : 'Your players’ notebook for this world: their own notes, and a shared one for the party that you can read. It needs your players invited: turn on cloud sync, then send them an invite link.'}
          </p>
          {!world.shared && isGM && (
            <Link className="button primary" to={`${worldPath(worldId)}/settings?tab=players`}>
              <Ico as={UsersThree} /> Players and sharing
            </Link>
          )}
        </div>
      </div>
    )
  return (
    <div className="page more-screen">
      <header className="page-header">
        <div>
          <h1>
            <Ico as={Notepad} /> Scratchpad <Help topic={player ? 'scratchpad' : 'gmPlayerNotes'} />
          </h1>
          <p className="lead">
            {player
              ? 'Notes that aren’t about any one page: keep your own, or add to the party’s shared notebook.'
              : 'Your players’ shared notebook for this world.'}
          </p>
        </div>
      </header>
      <PlayerNotesBox world={world} entityId="" entities={entities} big />
    </div>
  )
}
