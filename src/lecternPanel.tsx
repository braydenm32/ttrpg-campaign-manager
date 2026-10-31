import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { Ico } from './icons'

/**
 * Folding panels for the Lectern. Each panel can be folded down to its title, and the Lectern's
 * search box hides the panels that don't match (and opens the ones that do). Which panels are
 * folded is remembered on this device. Outside the Lectern a panel is a plain card.
 */

interface Folding {
  folded: Set<string>
  toggle: (id: string) => void
  /** What the GM typed in the Lectern's search box, lower case. */
  query: string
}

const FoldingContext = createContext<Folding | null>(null)

const KEY = 'lectern.folded'
/** Folded until the GM opens them: the panels used now and then rather than every scene. */
const FOLDED_AT_FIRST = ['improvise', 'tables', 'timers', 'gmscreen', 'journey', 'recording', 'threads']

function loadFolded(): Set<string> {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return new Set(JSON.parse(saved) as string[])
  } catch {
    // Nothing saved, or storage is off: start with the usual.
  }
  return new Set(FOLDED_AT_FIRST)
}

/** Holds which Lectern panels are folded, and the search, for the panels inside it. */
export function useFolding(query: string) {
  const [folded, setFolded] = useState(loadFolded)
  const save = (next: Set<string>) => {
    setFolded(next)
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]))
    } catch {
      // Not remembered this time; folding still works.
    }
  }
  const toggle = useCallback(
    (id: string) =>
      setFolded((now) => {
        const next = new Set(now)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        try {
          localStorage.setItem(KEY, JSON.stringify([...next]))
        } catch {
          // As above.
        }
        return next
      }),
    [],
  )
  const value = useMemo<Folding>(() => ({ folded, toggle, query: query.trim().toLowerCase() }), [folded, toggle, query])
  return { value, foldAll: (ids: string[]) => save(new Set(ids)), openAll: () => save(new Set()) }
}

export const FoldingProvider = FoldingContext.Provider

/** Every panel's id, in the order they're registered, so "Fold all" can fold them all. */
export const LECTERN_PANELS = [
  'notes', 'scene', 'present', 'party', 'threads', 'prep', 'initiative', 'timers', 'clocks', 'journey',
  'commonroom', 'callroll', 'show', 'loot', 'sound', 'dice', 'recording', 'tables', 'gmscreen', 'improvise',
]

export function LecternPanel({
  id,
  name,
  keywords = '',
  title,
  extra,
  children,
  sectionId,
}: {
  /** Stable id for remembering whether it's folded. */
  id: string
  /** Plain name the search box matches, e.g. "Initiative". */
  name: string
  /** More words the search matches, e.g. "combat fight turn order hp". */
  keywords?: string
  /** The heading: icon, name and help tip. */
  title: ReactNode
  /** Buttons or links at the right of the heading. */
  extra?: ReactNode
  children: ReactNode
  sectionId?: string
}) {
  const folding = useContext(FoldingContext)
  if (!folding) {
    return (
      <section className="card lectern-panel" id={sectionId}>
        {extra ? (
          <div className="row spread">
            <h2>{title}</h2>
            <div className="row">{extra}</div>
          </div>
        ) : (
          <h2>{title}</h2>
        )}
        {children}
      </section>
    )
  }
  const { folded, toggle, query } = folding
  const matches = !query || `${name} ${keywords}`.toLowerCase().includes(query)
  if (!matches) return null
  const open = query ? true : !folded.has(id)
  return (
    <section className={`card lectern-panel ${open ? '' : 'folded'}`} id={sectionId}>
      <div className="lectern-panel-head">
        <button
          className="ghost fold-toggle"
          aria-expanded={open}
          aria-label={open ? `Fold ${name}` : `Open ${name}`}
          title={open ? 'Fold this panel' : 'Open this panel'}
          onClick={() => toggle(id)}
        >
          <Ico as={CaretDown} />
        </button>
        <h2
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a, button, input, select')) return
            toggle(id)
          }}
        >
          {title}
        </h2>
        {extra && <div className="row">{extra}</div>}
      </div>
      {open && children}
    </section>
  )
}
