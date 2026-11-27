import { useState, type ReactNode } from 'react'
import { Archive, Trash, Warning } from '@phosphor-icons/react'
import { Modal } from './components'
import { Ico } from './icons'

/**
 * The app's own "are you sure?" for the deletes that can't be undone (a whole world, a world's
 * cloud copy), in the same look as the reveal check: what goes for good, what stays, whether
 * anything brings it back, then Cancel (where the focus starts, so Enter or a stray tap is safe)
 * and a button named for what it does. `typeToConfirm` asks for a name to be typed first, which
 * works the same with a phone's keyboard as with a laptop's. Escape or tapping outside cancels.
 */

export interface DeleteCheck {
  title: string
  /** What is deleted with it, one line each, with real counts. */
  goes: string[]
  /** The heading over `goes` (if not "Deleted"), e.g. "Deleted from this device". */
  goesTitle?: string
  /** A second list of what goes, under its own heading (e.g. what goes from the cloud). */
  alsoGoes?: { title: string; lines: string[] }
  /** What it leaves alone. */
  stays?: string[]
  /** Whether it can be put back, in plain words (shown as a warning when it can't). */
  back: string
  /** The delete button's words, e.g. "Delete world". */
  confirm: string
  /** A name the GM types before the delete button works. */
  typeToConfirm?: string
  /** Something to offer first, e.g. a backup button. */
  extra?: ReactNode
}

/** Asks with the dialog: `ask(check)` resolves true for delete, false for Cancel. Render `dialog` somewhere on the screen. */
export function useDeleteCheck() {
  const [open, setOpen] = useState<{ c: DeleteCheck; done: (yes: boolean) => void }>()
  const ask = (c: DeleteCheck) =>
    new Promise<boolean>((resolve) =>
      setOpen({
        c,
        done: (yes) => {
          setOpen(undefined)
          resolve(yes)
        },
      }),
    )
  const dialog = open ? <DeleteDialog check={open.c} onDone={open.done} /> : null
  return { ask, dialog }
}

/** Same name, give or take spaces and capitals (a phone's keyboard capitalises by itself). */
const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()

function DeleteDialog({ check: c, onDone }: { check: DeleteCheck; onDone: (yes: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const ready = !c.typeToConfirm || sameName(typed, c.typeToConfirm)
  return (
    <Modal title={c.title} onClose={() => onDone(false)}>
      <form
        className="review-step delete-check"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) onDone(true)
        }}
      >
        {[{ title: c.goesTitle ?? 'Deleted', lines: c.goes }, ...(c.alsoGoes ? [c.alsoGoes] : [])].map(
          (g) =>
            g.lines.length > 0 && (
              <div key={g.title}>
                <h3 className="small">
                  <Ico as={Trash} /> {g.title}
                </h3>
                <ul className="small">
                  {g.lines.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ),
        )}
        {!!c.stays?.length && (
          <>
            <h3 className="small">
              <Ico as={Archive} /> Kept
            </h3>
            <ul className="small muted">
              {c.stays.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
        )}
        <p className="secret-names small">
          <Ico as={Warning} /> {c.back}
        </p>
        {c.extra}
        {c.typeToConfirm && (
          <label className="delete-check-name">
            <span className="small">
              To delete it, type its name: <strong>{c.typeToConfirm}</strong>
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} aria-label={`Type “${c.typeToConfirm}” to delete it`} />
          </label>
        )}
        <div className="row end wrap review-step-buttons">
          <button type="button" autoFocus onClick={() => onDone(false)}>
            Cancel
          </button>
          <button type="submit" className="danger" disabled={!ready}>
            {c.confirm}
          </button>
        </div>
      </form>
    </Modal>
  )
}
