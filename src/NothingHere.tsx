import { Link } from 'react-router-dom'
import { Compass } from '@phosphor-icons/react'
import { useWorld } from './hooks'
import { Ico } from './icons'
import { worldPath } from './paths'
import { useFrameContext } from './Sidebar'
import { useViewMode } from './viewMode'

/**
 * An address inside a world that goes nowhere (a mistyped word, an old bookmark, a page that was
 * renamed or removed): says so plainly, with one way home: the Desk for the GM, the Common Room
 * for players, the front page for a public wiki.
 */
export function NothingHere() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const viewer = useFrameContext()?.facts.viewer ?? (world?.shared?.token ? 'wiki' : isGM ? 'gm' : 'player')
  const home = viewer === 'gm' ? 'the Desk' : viewer === 'wiki' ? 'the front page' : 'the Common Room'
  return (
    <div className="page nothing-here more-screen">
      <div className="calm-note card" role="status">
        <Ico as={Compass} size="2em" />
        <h1>Not found</h1>
        <p>
          There’s nothing at this address. It may have been renamed or removed, or the link was mistyped.
          {viewer === 'gm' ? '' : ' Some pages only appear once your GM reveals them.'}
        </p>
        <Link className="button primary" to={worldPath(worldId)}>
          Back to {home}
        </Link>
      </div>
    </div>
  )
}
