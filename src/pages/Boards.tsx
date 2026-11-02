import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Empty, Skeleton } from '../components'
import { db } from '../db'
import { Help } from '../help'
import '../more.css'
import { useVisibleEntities, useWorld } from '../hooks'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { PushPin } from '@phosphor-icons/react'
import { worldPath } from '../paths'
import { CopyBoardButton } from './BoardView'

/**
 * The world's old corkboards. Corkboards are retired: no new ones are made, and More only lists
 * this screen while the world still has some. Each one can be copied into a page so nothing is lost.
 */
export default function Boards() {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const stored = useLiveQuery(() => db.boards.where({ worldId }).sortBy('name'), [worldId])
  const boards = stored ?? []
  if (!isGM) return <Empty>Corkboards are a GM tool. Switch back to the GM view to use them.</Empty>
  if (!stored) return <Skeleton />
  return (
    <div className="page more-screen">
      <header className="page-header">
        <h1>
          <Ico as={PushPin} /> Old corkboards <Help topic="boards" />
        </h1>
      </header>
      <p className="notice small">
        Corkboards are retired, so you can’t make new ones. Your old boards stay here: “Copy into a page” writes a board’s cards and strings into a GM-only page, so nothing on it
        is lost. For a new mystery, use a page with links, or the Relationships web.
      </p>
      {boards.length === 0 ? (
        <Empty>
          No corkboards left in this world. <Link to={`${worldPath(worldId)}/more`}>Back to More</Link>
        </Empty>
      ) : (
        <div className="card-grid">
          {boards.map((b) => (
            <div key={b.id} className="card">
              <h3 className="board-name">
                <Link to={`${worldPath(worldId)}/boards/${b.id}`}>
                  <Ico as={PushPin} /> {b.name}
                </Link>
              </h3>
              <p className="muted small">
                {b.cards.length} card{b.cards.length === 1 ? '' : 's'} · {b.strings.length} string{b.strings.length === 1 ? '' : 's'}
              </p>
              <CopyBoardButton board={b} entities={entities} className="small" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
