import { Empty, Skeleton } from '../components'
import { Help } from '../help'
import '../more.css'
import { useVisibleEntities, useWorld } from '../hooks'
import { PlayerNotesBox } from '../players/Notes'
import { Ico } from '../icons'
import { Notepad } from '@phosphor-icons/react'

/** The players' world-wide notebook: a shared page for the party, and a private one for each player. */
export default function Scratchpad() {
  const { worldId, world } = useWorld()
  const entities = useVisibleEntities(worldId)
  if (!world) return <Skeleton />
  const player = !!world.shared?.memberOf
  if (!player && (world.shared || !world.cloud?.enabled))
    return <Empty>The scratchpad is for players who have joined this world. Turn on cloud sync and invite them from World settings.</Empty>
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
