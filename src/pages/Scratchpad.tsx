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
        <header className="page-header">
          <div>
            <h1>
              <Ico as={Notepad} /> Group notes <Help topic="gmPlayerNotes" />
            </h1>
          </div>
        </header>
        <div className="calm-note card">
          <Ico as={Notepad} size="2em" />
          <p>
            {world.shared
              ? 'Group notes are a notebook for the players who have joined this world.'
              : 'Your players’ shared notebook for this world: a place for the party to write together, which you can read. It needs your players invited: turn on cloud sync, then send them an invite link.'}
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
            <Ico as={Notepad} /> Group notes <Help topic={player ? 'scratchpad' : 'gmPlayerNotes'} />
          </h1>
          <p className="lead">
            {player
              ? 'Notes that aren’t about any one page: keep your own (My notes), or add to the party’s Group notes.'
              : 'What your players have written together in this world.'}
          </p>
        </div>
      </header>
      <PlayerNotesBox world={world} entityId="" entities={entities} big />
    </div>
  )
}
