import { useState } from 'react'
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom'
import { db, type Entity, type World } from './db'
import { Help } from './help'
import { noRoomFor } from './hooks'
import { pagePath, setPages, worldPath } from './paths'
import { outOfRoom, toast } from './undo'

/**
 * The first ten minutes: the way into Vael Ardith's hand-written guides (its "Start Here" page is
 * the best tour of the app there is), from a new world's Getting started and from the example's
 * own Desk.
 */

/** The example world's guide that starts the tour (the page's name; on screen it's "the Start here tour"). */
export const GUIDE_START = 'Start Here'

/**
 * Says why an example world couldn't be opened, in the note at the bottom: offline (its pages are
 * only downloaded when it's first opened), no room left on the device, or whatever else went wrong.
 * `what` is "the example" or "the small sample".
 */
export function tellExampleFailed(err: unknown, what = 'the example') {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const fetching = err instanceof Error && /fetch|dynamically imported|importing a module|load failed|network/i.test(err.message)
  toast(
    outOfRoom(err)
      ? noRoomFor(what === 'the example' ? 'the example world' : what).message
      : offline
        ? `You’re offline, so ${what} can’t be fetched. Try again when you’re back online.`
        : fetching
          ? `${what === 'the example' ? 'The example' : 'The small sample'} couldn’t be fetched. Check your connection, then try again.`
          : `Couldn’t open ${what}: ${(err as Error)?.message ?? 'something went wrong'}`,
  )
}

/** A load of the example already on its way, so a second press (or a second button) waits for it instead of making a second copy. */
let loading: Promise<string> | undefined

/**
 * Opens Vael Ardith at its Start Here guide, loading the example first if it isn't on this device
 * (a copy already here is opened, never loaded twice). `onStep` hears how far the load has got.
 */
export async function openExampleGuide(navigate: NavigateFunction, onStep?: (words: string) => void) {
  const existing = (await db.worlds.toArray()).find((w) => w.example && !w.shared)
  let worldId = existing?.id
  if (!worldId) {
    loading ??= import('./example/load').then((m) => m.loadExampleWorld(onStep)).finally(() => (loading = undefined))
    worldId = await loading
  }
  // The world's page names first, so the address reads /p/start-here rather than a long id.
  const pages = await db.entities.where({ worldId }).toArray()
  setPages(worldId, pages)
  const guide = pages.find((e) => e.name === GUIDE_START && !e.template)
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
          tellExampleFailed(err)
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
