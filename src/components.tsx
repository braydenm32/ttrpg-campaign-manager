import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import type { Visibility } from './db'
import { Ico } from './icons'
import { Lock } from '@phosphor-icons/react'

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
  return value === 'gm' ? <span className="badge gm" title="GM only"><Ico as={Lock} /></span> : null
}

export function TagInput({ tags, onChange, placeholder = 'Add tag…' }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
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
        placeholder={placeholder}
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

/**
 * Keyboard care for a pop-up: it takes the focus when it opens (so Tab and screen readers start
 * inside it), Escape closes it, and the focus goes back where it was afterwards.
 */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      before?.focus?.()
    }
  }, [])
  return ref
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useDialog(onClose)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
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

/**
 * A text box that keeps what you type locally and saves every change. Saved values come back a moment later,
 * so reading them straight back while typing would drop keystrokes. With `saveOn="leave"` it saves once,
 * when you press Enter or move on, for boxes whose value reorders a list (so rows don't jump while you type).
 */
export function DraftText({
  value,
  onCommit,
  multiline,
  rows,
  saveOn,
  ...rest
}: { value: string; onCommit: (v: string) => void; multiline?: boolean; rows?: number; saveOn?: 'leave' } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [draft, setDraft] = useState<string | null>(null)
  const props = {
    value: draft ?? value,
    onFocus: () => setDraft(value),
    onBlur: () => {
      if (saveOn === 'leave' && draft !== null && draft !== value) onCommit(draft)
      setDraft(null)
    },
    onChange: (e: { target: { value: string } }) => {
      setDraft(e.target.value)
      if (saveOn !== 'leave') onCommit(e.target.value)
    },
    ...(saveOn === 'leave' ? { onKeyDown: (e: { key: string; currentTarget: { blur: () => void } }) => e.key === 'Enter' && e.currentTarget.blur() } : {}),
  }
  return multiline ? <textarea rows={rows} placeholder={rest.placeholder} {...props} /> : <input {...rest} {...props} />
}

