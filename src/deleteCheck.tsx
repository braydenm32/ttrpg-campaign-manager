import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Archive, ArrowCounterClockwise, Trash, Warning } from '@phosphor-icons/react'
import { Modal } from './components'
import { Ico } from './icons'

/**
 * The app's own "are you sure?" for the big deletes, in the same look as the reveal check: what
 * goes, what stays, whether anything brings it back, then Cancel (where the focus starts, so Enter
 * or a stray tap is safe) and a button named for what it does. Two kinds use it:
 *  - a session, campaign, map or file, which go to Recently deleted (`restorable`: the last line
 *    is a plain note, and nothing is typed);
 *  - a whole world or a world's cloud copy, which nothing brings back: `typeToConfirm` asks for
 *    the world's name to be typed first, which works the same with a phone's keyboard as with a
 *    laptop's.
 * Escape or tapping outside cancels.
 */

export interface DeleteCheck {
  title: string
  /** What is deleted with it, one line each, with real counts. */
  goes: string[]
  /** The heading over `goes` (if not "Deleted"), e.g. "Deleted from this device". */
  goesTitle?: string
  /** A second list of what goes, under its own heading (e.g. what goes from the cloud). */
  alsoGoes?: { title: string; lines: string[] }
  /** What isn't deleted but changes until it's restored (the pages and maps that use a file), under its own heading. */
  affects?: { title: string; lines: string[] }
  /** What it leaves alone. */
  stays?: string[]
  /** Whether it can be put back, in plain words. */
  back: string
  /** It goes to Recently deleted, so `back` is a plain note. Left out, `back` is shown as a warning. */
  restorable?: boolean
  /** The delete button's words, e.g. "Delete world". */
  confirm: string
  /** A name (or word) the GM types before the delete button works. */
  typeToConfirm?: string
  /** The words before what to type, if not "To delete it, type its name:". */
  typeHint?: string
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
  // Drawn at the top of the page, not inside the card its button sits in: nothing sticky shows over it, and the card's own styles don't reach it.
  const dialog = open ? createPortal(<DeleteDialog check={open.c} onDone={open.done} />, document.body) : null
  return { ask, dialog }
}

/**
 * A name as it's compared: spaces and capitals don't count (a phone's keyboard capitalises by
 * itself), and neither does the kind of quote mark or dash (a phone types ’ and — where a laptop
 * types ' and -), nor how an accented letter happens to be stored.
 */
const plainName = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u02BC`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

/** Whether what was typed is the name asked for (see plainName). */
export const sameName = (a: string, b: string) => plainName(a) === plainName(b)

/**
 * What the GM types to delete something by name: its name, or the word "delete" when it has none
 * (a blank name would otherwise let the button through with nothing typed).
 */
export function nameToType(name: string, what = 'world'): Pick<DeleteCheck, 'typeToConfirm' | 'typeHint'> {
  return plainName(name) ? { typeToConfirm: name.trim().replace(/\s+/g, ' ') } : { typeToConfirm: 'delete', typeHint: `This ${what} has no name. To delete it, type the word:` }
}

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
        {!!c.affects?.lines.length && (
          <>
            <h3 className="small">
              <Ico as={Warning} /> {c.affects.title}
            </h3>
            <ul className="small">
              {c.affects.lines.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </>
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
        <p className={c.restorable ? 'delete-check-back small' : 'secret-names small'}>
          <Ico as={c.restorable ? ArrowCounterClockwise : Warning} /> {c.back}
        </p>
        {c.extra}
        {c.typeToConfirm && (
          <label className="delete-check-name">
            <span className="small">
              {c.typeHint ?? 'To delete it, type its name:'} <strong>{c.typeToConfirm}</strong>
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
