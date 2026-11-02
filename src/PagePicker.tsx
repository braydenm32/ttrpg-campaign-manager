import { useState } from 'react'
import type { Entity } from './db'
import { TypeIcon } from './icons'

/**
 * Find a page by typing, instead of scrolling a list of every page. Without `value` it is an "add" box:
 * picking a page calls onPick and clears. With `value` (a page id, or '' for none) it works like a
 * choice box, showing the picked page and a way to clear it. `suggested` ids are listed first; with
 * `recent`, the rest of the empty list starts with the pages changed most recently (the ones you're
 * working on), instead of in the order given.
 */
export function PagePicker({
  entities,
  value,
  onPick,
  placeholder = 'Find a page…',
  suggested = [],
  recent = false,
  className,
  label,
}: {
  entities: Entity[]
  value?: string
  onPick: (id: string) => void
  placeholder?: string
  suggested?: string[]
  /** Empty box: most recently changed pages first. */
  recent?: boolean
  className?: string
  /** The box's name for screen readers and tests, when it isn't the placeholder. */
  label?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const picked = value ? entities.find((e) => e.id === value) : undefined
  const needle = q.trim().toLowerCase()
  const names = (e: Entity) => [e.name, ...(e.aliases ?? [])].map((n) => n.toLowerCase())
  const starts = (e: Entity) => Number(names(e).some((n) => n.startsWith(needle)))
  const found = needle
    ? entities.filter((e) => names(e).some((n) => n.includes(needle))).sort((a, b) => starts(b) - starts(a))
    : [
        ...entities.filter((e) => suggested.includes(e.id)),
        ...(recent ? [...entities].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)) : entities).filter((e) => !suggested.includes(e.id)),
      ]
  const shown = found.slice(0, 12)
  const choose = (id: string) => {
    onPick(id)
    setQ('')
    setOpen(false)
  }
  return (
    <div className={`page-picker ${className ?? ''}`}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-label={label ?? placeholder}
        autoComplete="off"
        value={open || !picked ? q : picked.name}
        placeholder={picked && open ? picked.name : placeholder}
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.max(0, Math.min(shown.length - 1, a + (e.key === 'ArrowDown' ? 1 : -1))))
          } else if (e.key === 'Enter' && open && shown[active]) {
            e.preventDefault()
            choose(shown[active].id)
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <ul className="page-picker-list" role="listbox">
          {value !== undefined && picked && (
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose('')}>
                <span className="muted">Clear</span>
              </button>
            </li>
          )}
          {shown.map((e, i) => (
            <li key={e.id} className={i === active ? 'active' : ''}>
              <button type="button" onMouseDown={(ev) => ev.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => choose(e.id)}>
                <TypeIcon type={e.type} /> {e.name}
                {suggested.includes(e.id) && !needle && <small className="muted"> · here</small>}
                {e.summary && recent && <small className="muted page-picker-summary"> · {e.summary.length > 60 ? `${e.summary.slice(0, 58).trim()}…` : e.summary}</small>}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted small">Nothing matches.</li>}
          {found.length > shown.length && <li className="muted small">{found.length - shown.length} more. Keep typing to narrow it down.</li>}
        </ul>
      )}
    </div>
  )
}
