import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash } from '@phosphor-icons/react'
import { Modal } from './components'
import { db, deleteEntity, restoreDeletedPage, whatDeleteUnlinks, type Entity } from './db'
import { namesOf } from './links'
import { typePath, worldPath } from './paths'
import { toast } from './undo'
import { Ico } from './icons'

/**
 * Deleting a page: the app's own "are you sure?", saying what else it touches (places inside it,
 * items it carries, map pins, pages that link to it), then an Undo note. Restore (Undo, or More →
 * Recently deleted) brings it back with those links.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** What deleting this page does to the rest of the world, in plain words. */
async function consequences(e: Entity) {
  const { inside, carried, pins, maps } = await whatDeleteUnlinks(e.id)
  const out: string[] = []
  if (inside.length) {
    const places = inside.every((x) => x.type === 'location')
    out.push(`${plural(inside.length, places ? 'place' : 'page')} inside it will move up a level.`)
  }
  if (carried) out.push(`${plural(carried, 'item')} it carries will belong to no one.`)
  if (pins) out.push(`${plural(pins, 'map pin')} will stop opening it.`)
  if (maps) out.push(`${plural(maps, 'map')} will stop being the map of it.`)
  // Links to it in other pages' text turn into plain names.
  const names = namesOf(e)
  if (names.length) {
    const re = new RegExp(`\\[\\[\\s*(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*(\\||\\]\\])`, 'i')
    const linking = await db.entities
      .where({ worldId: e.worldId })
      .filter((x) => x.id !== e.id && !x.template && [x.body, x.gmNotes, x.summary, x.playerBody].some((t) => !!t && re.test(t)))
      .count()
    if (linking) out.push(`${plural(linking, 'other page')} link${linking === 1 ? 's' : ''} to it; ${linking === 1 ? 'that link stops' : 'those links stop'} working.`)
  }
  return out
}

/** Deletes a page now, and offers Undo, which brings it back with its links. Returns once it's gone. */
export async function deletePageWithUndo(e: Entity) {
  const v = await deleteEntity(e.id)
  // A new page that was never saved has nothing to bring back.
  if (v) toast(`“${e.name}” deleted. It’s in More → Recently deleted.`, () => restoreDeletedPage(v))
  else toast(`“${e.name || 'Untitled'}” deleted.`)
}

/**
 * The Delete button for a page, with its confirm. `beforeDelete` runs first (the editor uses it so
 * its "save on leave" doesn't write the page straight back).
 */
export function DeletePageButton({ entity, className = 'danger', beforeDelete }: { entity: Entity; className?: string; beforeDelete?: () => void }) {
  const navigate = useNavigate()
  const [ask, setAsk] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const open = async () => setAsk(await consequences(entity))
  const go = async () => {
    setBusy(true)
    try {
      beforeDelete?.()
      await deletePageWithUndo(entity)
      setAsk(null)
      navigate(entity.template ? `${worldPath(entity.worldId)}/settings` : typePath(entity.worldId, entity.type, entity.customType))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" className={className} onClick={open}>
        <Ico as={Trash} /> Delete
      </button>
      {ask && (
        <Modal title={`Delete “${entity.name || 'Untitled'}”?`} onClose={() => setAsk(null)}>
          <div className="review-step">
            {ask.length > 0 && (
              <ul className="small">
                {ask.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            <p className="small">
              {ask.length > 0 ? 'Restore puts them back. ' : ''}You can bring it back with Undo, or later from More → Recently deleted (on this device).
            </p>
            <div className="row end wrap review-step-buttons">
              <button type="button" onClick={() => setAsk(null)}>
                Cancel
              </button>
              <button type="button" className="danger" autoFocus disabled={busy} onClick={go}>
                Delete it
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
