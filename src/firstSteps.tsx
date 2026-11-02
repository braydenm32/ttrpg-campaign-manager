import { useState } from 'react'
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom'
import { db, type Entity, type World } from './db'
import { Help } from './help'
import { pagePath, worldPath } from './paths'

/**
 * The first ten minutes: the way into Vael Ardith's hand-written guides (its "Start Here" page is
 * the best tour of the app there is), from a new world's Getting started and from the example's
 * own Desk.
 */

/** The example world's guide that starts the tour. */
export const GUIDE_START = 'Start Here'

/** Opens Vael Ardith at its Start Here guide, loading the example first if it isn't on this device. */
export async function openExampleGuide(navigate: NavigateFunction) {
  const existing = (await db.worlds.toArray()).find((w) => w.example && !w.shared)
  const worldId = existing?.id ?? (await (await import('./example/load')).loadExampleWorld())
  const guide = await db.entities.where({ worldId }).filter((e) => e.name === GUIDE_START && !e.template).first()
  navigate(guide ? pagePath(worldId, guide.id) : worldPath(worldId))
}

/** Getting started's last step: a button that opens (or loads) the example at its guide. */
export function SeeTheExampleButton() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  return (
    <button
      className="small"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await openExampleGuide(navigate)
        } catch (err) {
          alert(`Couldn’t open the example: ${(err as Error).message}`)
          setBusy(false)
        }
      }}
    >
      {busy ? 'Opening…' : 'Open Vael Ardith'}
    </button>
  )
}

/** On the example world's Desk: one line pointing at its Start Here guide. */
export function ExampleStartHere({ world, entities }: { world: World; entities: Entity[] }) {
  if (!world.example) return null
  const guide = entities.find((e) => e.name === GUIDE_START && !e.template)
  if (!guide) return null
  return (
    <p className="example-start-here">
      <strong>New here?</strong> <Link to={pagePath(world.id, guide.id)}>Start here</Link>: a short tour of Vael Ardith and of the app, and how to run it tonight.{' '}
      <Help topic="exampleStartHere" />
    </p>
  )
}
