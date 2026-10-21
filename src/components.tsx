import { useState, type ReactNode } from 'react'
import type { Visibility } from './db'

export function VisibilityToggle({
  value,
  onChange,
}: {
  value: Visibility
  onChange: (v: Visibility) => void
}) {
  return (
    <button
      type="button"
      className={`vis-toggle ${value}`}
      title={value === 'gm' ? 'Only the GM can see this. Click to reveal to players.' : 'Players can see this. Click to hide.'}
      onClick={() => onChange(value === 'gm' ? 'players' : 'gm')}
    >
      {value === 'gm' ? '🔒 GM only' : '👁 Revealed'}
    </button>
  )
}

export function VisibilityBadge({ value }: { value: Visibility }) {
  return value === 'gm' ? <span className="badge gm" title="GM only">🔒</span> : null
}

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setDraft('')
  }
  return (
    <div className="tag-input">
      {tags.map((t) => (
        <span key={t} className="tag">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder="Add tag…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
      />
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
