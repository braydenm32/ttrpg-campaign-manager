import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Empty } from '../components'
import { db, newId } from '../db'
import { Help } from '../help'
import '../more.css'
import { useWorld } from '../hooks'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { PushPin } from '@phosphor-icons/react'
import { worldPath } from '../paths'

/** The world's corkboards. */
export default function Boards() {
  const { worldId } = useWorld()
  const { isGM } = useViewMode()
  const navigate = useNavigate()
  const boards = useLiveQuery(() => db.boards.where({ worldId }).sortBy('name'), [worldId]) ?? []
  const [name, setName] = useState('')
  if (!isGM) return <Empty>Corkboards are a GM tool. Switch back to the GM view to use them.</Empty>
  return (
    <div className="page more-screen">
      <header className="page-header">
        <h1>
          <Ico as={PushPin} /> Corkboards <Help topic="boards" />
        </h1>
      </header>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          const id = newId()
          const now = Date.now()
          await db.boards.add({ id, worldId, name: n, cards: [], strings: [], createdAt: now, updatedAt: now })
          navigate(`${worldPath(worldId)}/boards/${id}`)
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New board, e.g. ‘Who killed the duke?’" />
        <button className="primary" disabled={!name.trim()}>
          + New board
        </button>
      </form>
      {boards.length === 0 ? (
        <Empty>No boards yet. A board is a place to pin pages and notes and run string between them, for mysteries, plots and politics.</Empty>
      ) : (
        <div className="card-grid">
          {boards.map((b) => (
            <Link key={b.id} className="card" to={`${worldPath(worldId)}/boards/${b.id}`}>
              <h3><Ico as={PushPin} /> {b.name}</h3>
              <p className="muted small">
                {b.cards.length} card{b.cards.length === 1 ? '' : 's'} · {b.strings.length} string{b.strings.length === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
