import { Link } from 'react-router-dom'
import { Empty } from '../components'
import type { Showing } from '../db'
import { Help } from '../help'
import '../more.css'
import { useVisibleEntities, useWorld } from '../hooks'
import { removeHandout, revealAndShow, showToPlayers, ShowingView } from '../showing'
import { useViewMode } from '../viewMode'
import { useState } from 'react'
import { Ico } from '../icons'
import { Newspaper, Television } from '@phosphor-icons/react'
import { pagePath } from '../paths'
import { useVisibleHandouts } from '../counts'
import { toast } from '../undo'
import { stripSecrets } from '../Markdown'

/**
 * Handouts: everything the GM has shown at the table, newest first. Players can read a letter or
 * look at a picture again long after the GM pressed Stop. The GM can show one again or take it away.
 */
export default function Handouts() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const [open, setOpen] = useState<string>()
  // A page handout being removed: the page itself can stay revealed or be hidden again.
  const [removing, setRemoving] = useState<string>()
  // A ready handout whose "players will see" review is open.
  const [reviewing, setReviewing] = useState<string>()
  const entities = useVisibleEntities(worldId)
  // Players (and the GM previewing as one) get only the handouts the server sends them.
  const list = useVisibleHandouts(world, entities)
  if (!world) return null
  // Handouts prepared ahead: GM-only pages tagged "handout", waiting for the moment to show them.
  const ready = isGM ? entities.filter((e) => e.visibility === 'gm' && e.tags.includes('handout')) : []
  return (
    <div className="page more-screen">
      <header className="page-header">
        <h1>
          <Ico as={Newspaper} /> Handouts <Help topic="handouts" />
        </h1>
      </header>
      {isGM && (
        <section>
          <h2>
            Ready to show <Help topic="handoutsReady" />
          </h2>
          {ready.length === 0 ? (
            <Empty>Tag a GM-only page “handout” (a letter, a poster, a map scrap) and it waits here until you show it.</Empty>
          ) : (
            <ul className="handout-list">
              {ready.map((e) => (
                <li key={e.id} className="card">
                  <div className="row wrap">
                    <Link to={pagePath(worldId, e.id)}>
                      <strong>{e.name}</strong>
                    </Link>
                    {e.summary && <span className="muted small">{e.summary}</span>}
                    {reviewing !== e.id && (
                      <button className="small" onClick={() => setReviewing(e.id)} title="Reveal this page to every player and put it on their screens">
                        <Ico as={Television} /> Reveal and show…
                      </button>
                    )}
                  </div>
                  {reviewing === e.id && (
                    <div className="players-review" role="group" aria-label="What players will see">
                      <strong>
            Players will see <Help topic="playersWillSee" />
          </strong>
                      <ul className="small">
                        <li>the page “{e.name}”{e.summary ? ', its summary' : ''}{stripSecrets(e.body).trim() ? ' and its text' : ''}{e.imageId ? ', with its picture' : ''}</li>
                        <li>on every player’s screen now, and in their handouts afterwards</li>
                      </ul>
                      <p className="muted small">Its GM notes and secret passages stay hidden, and so do the pages it links to unless they’re revealed already.</p>
                      <div className="row wrap">
                        <button
                          className="primary"
                          onClick={async () => {
                            setReviewing(undefined)
                            const undo = await revealAndShow(worldId, e)
                            toast(`“${e.name}” is revealed and on the players’ screens.`, undo, 'Hide it again')
                          }}
                        >
                          <Ico as={Television} /> Reveal and show
                        </button>
                        <button onClick={() => setReviewing(undefined)}>Not yet</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <h2>Shown so far</h2>
        </section>
      )}
      <p className="muted">
        {isGM
          ? 'Everything you’ve shown players, newest first. Players can open these any time. Remove a picture or text to take it back; a page stays revealed unless you hide it too.'
          : 'Everything your GM has shown the table, newest first.'}
      </p>
      {list.length === 0 ? (
        <Empty>{isGM ? 'Nothing yet. Use “Show players” at the Lectern or on a page, and it lands here.' : 'Nothing yet.'}</Empty>
      ) : (
        <ul className="handout-list">
          {list.map((h: Showing) => {
            const page = h.kind === 'page' ? entities.find((e) => e.id === h.entityId) : undefined
            const revealed = page?.visibility === 'players'
            return (
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
                      <button
                        className="small ghost"
                        onClick={() =>
                          revealed
                            ? setRemoving(h.id)
                            : confirm(h.kind === 'page' ? `Take “${h.title}” off the handouts?` : `Take “${h.title}” back from the players?`) && removeHandout(worldId, h.id)
                        }
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </div>
                {isGM && removing === h.id && page && (
                  <div className="notice small" role="alert">
                    <p>Taking “{h.title}” off the handouts doesn’t hide the page: players can still read it in the world unless you hide it again.</p>
                    <div className="row wrap">
                      <button className="small" onClick={() => removeHandout(worldId, h.id)}>
                        Remove, keep the page revealed
                      </button>
                      <button className="small primary" onClick={() => removeHandout(worldId, h.id, page.id)}>
                        Remove and hide the page
                      </button>
                      <button className="small ghost" onClick={() => setRemoving(undefined)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {open === h.id && <ShowingView showing={h} worldId={worldId} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
