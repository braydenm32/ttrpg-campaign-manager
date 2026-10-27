import { Link } from 'react-router-dom'
import { Empty } from '../components'
import type { Showing } from '../db'
import { Help } from '../help'
import { useWorld } from '../hooks'
import { removeHandout, showToPlayers, ShowingView } from '../showing'
import { useViewMode } from '../viewMode'
import { useState } from 'react'
import { Ico } from '../icons'
import { Newspaper, Television } from '@phosphor-icons/react'
import { pagePath } from '../paths'

/**
 * Handouts: everything the GM has shown at the table, newest first. Players can read a letter or
 * look at a picture again long after the GM pressed Stop. The GM can show one again or take it away.
 */
export default function Handouts() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const [open, setOpen] = useState<string>()
  if (!world) return null
  const list = world.handouts ?? []
  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={Newspaper} /> Handouts <Help topic="handouts" />
        </h1>
      </header>
      <p className="muted">
        {isGM
          ? 'Everything you’ve shown players, newest first. Players can open these any time. Remove one to take it back.'
          : 'Everything your GM has shown the table, newest first.'}
      </p>
      {list.length === 0 ? (
        <Empty>{isGM ? 'Nothing yet. Use “Show players” at the Lectern or on a page, and it lands here.' : 'Nothing yet.'}</Empty>
      ) : (
        <ul className="handout-list">
          {list.map((h: Showing) => (
            <li key={h.id} className="card">
              <div className="row wrap">
                <button className="link" onClick={() => setOpen(open === h.id ? undefined : h.id)}>
                  <strong>
                    {{ image: '🖼️', page: '📄', text: '📝' }[h.kind]} {h.title}
                  </strong>
                </button>
                <span className="muted small">{new Date(h.at).toLocaleDateString()}</span>
                {h.kind === 'page' && h.entityId && <Link to={`${pagePath(worldId, h.entityId)}`} className="small">Open page</Link>}
                {isGM && (
                  <span className="row">
                    <button className="small" onClick={() => showToPlayers(worldId, h)}>
                      <Ico as={Television} /> Show again
                    </button>
                    <button className="small ghost" onClick={() => confirm(`Take “${h.title}” back from the players?`) && removeHandout(worldId, h.id)}>
                      Remove
                    </button>
                  </span>
                )}
              </div>
              {open === h.id && <ShowingView showing={h} worldId={worldId} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
