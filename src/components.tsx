import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import type { Visibility } from './db'
import { Ico } from './icons'
import { Lock } from '@phosphor-icons/react'
import { saving } from './undo'

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
      title={value === 'gm' ? 'Only the GM can see this. Click to let players see it.' : 'Players can see this. Click to make it GM only.'}
      onClick={() => onChange(value === 'gm' ? 'players' : 'gm')}
    >
      {value === 'gm' ? '🔒 GM only' : '👁 Players can see this'}
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

/** The pop-ups open right now, topmost last: only that one answers Escape and Tab. */
const openDialogs: object[] = []

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/**
 * Everything on the page except the pop-up's own branch is switched off (`inert`), so Tab, taps from
 * a screen reader and typing can't reach what's behind it. Gives back what it switched off.
 */
function blockBehind(dialog: HTMLElement) {
  const switched: HTMLElement[] = []
  let node: HTMLElement | null = dialog
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement
    if (!parent) break
    for (const sibling of Array.from(parent.children) as HTMLElement[]) {
      // The Undo note and other live notes stay reachable.
      if (sibling === node || sibling.hasAttribute('inert') || sibling.matches('script, style, [role="status"], [aria-live]')) continue
      sibling.setAttribute('inert', '')
      switched.push(sibling)
    }
    node = parent
  }
  return () => switched.forEach((el) => el.removeAttribute('inert'))
}

/**
 * Keyboard care for a pop-up: it takes the focus when it opens (so Tab and screen readers start
 * inside it), Tab stays inside it, the page behind is switched off, Escape closes it, and the focus
 * goes back to what opened it afterwards.
 */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  // What had the focus before the pop-up drew: read while rendering, before a field inside takes it.
  const [opener] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)))
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const dialog = ref.current
    const me = {}
    openDialogs.push(me)
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus()
    const unblock = dialog ? blockBehind(dialog) : undefined
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== me) return
      if (e.key === 'Escape') {
        close.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const stops = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0 && el.tabIndex >= 0)
      if (!stops.length) {
        e.preventDefault()
        dialog.focus()
        return
      }
      const first = stops[0]
      const last = stops[stops.length - 1]
      const at = document.activeElement
      if (e.shiftKey && (at === first || at === dialog || !dialog.contains(at))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (at === last || !dialog.contains(at))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      openDialogs.splice(openDialogs.indexOf(me), 1)
      unblock?.()
      if (opener?.isConnected) opener.focus?.()
    }
  }, [opener])
  return ref
}

/**
 * A small pop-down menu (New page…): it closes on Escape (focus goes back to its button), when you
 * tap or click elsewhere, and when Tab leaves it; the arrow keys step through its items.
 * Spread `wrapProps` on the wrapper, `buttonProps` on the button and `menuProps` on the list.
 */
export function useMenu() {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      wrap.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const wrapProps = {
    ref: wrap,
    onBlur: (e: FocusEvent<HTMLElement>) => {
      // Only when focus lands somewhere else (Safari gives buttons no focus on a tap, so "nowhere" doesn't count).
      if (open && e.relatedTarget && !wrap.current?.contains(e.relatedTarget as Node)) setOpen(false)
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (!open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
      const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
      if (!items.length) return
      e.preventDefault()
      const at = items.indexOf(document.activeElement as HTMLElement)
      const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at <= 0 ? items.length : at) - 1
      items[next].focus()
    },
  }
  const buttonProps = { 'aria-haspopup': 'menu' as const, 'aria-expanded': open, onClick: () => setOpen(!open) }
  const menuProps = { role: 'menu', onMouseLeave: () => setOpen(false) }
  return { open, setOpen, wrapProps, buttonProps, menuProps }
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

/** While a screen loads: grey shapes where its title and text will be, instead of the word "Loading…" (which screen readers still hear). */
export function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk sk-line short" />
      <div className="sk sk-block" />
    </div>
  )
}

/**
 * A text box that keeps what you type locally and saves every change. Saved values come back a moment later,
 * so reading them straight back while typing would drop keystrokes. With `saveOn="leave"` it saves once,
 * when you press Enter or move on, for boxes whose value reorders a list (so rows don't jump while you type).
 * Each save lights any <SavedMark /> on screen. A multiline box with `grow` is as tall as its text,
 * so a long scene or note reads in full instead of scrolling inside a small box.
 */
export function DraftText({
  value,
  onCommit,
  multiline,
  rows,
  saveOn,
  grow,
  ...rest
}: { value: string; onCommit: (v: string) => unknown; multiline?: boolean; rows?: number; saveOn?: 'leave'; grow?: boolean } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [draft, setDraft] = useState<string | null>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const shown = draft ?? value
  useLayoutEffect(() => {
    const el = box.current
    if (!grow || !el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [grow, shown])
  const props = {
    value: draft ?? value,
    // A save that failed keeps what was typed in the box (rather than showing the old text), so it isn't lost.
    onFocus: () => setDraft((d) => d ?? value),
    onBlur: () => {
      if (saveOn === 'leave' && draft !== null && draft !== value) {
        const v = draft
        saving(onCommit(v), () => setDraft((d) => d ?? v))
      }
      setDraft(null)
    },
    onChange: (e: { target: { value: string } }) => {
      const v = e.target.value
      setDraft(v)
      if (saveOn !== 'leave') saving(onCommit(v), () => setDraft((d) => d ?? v))
    },
    ...(saveOn === 'leave' ? { onKeyDown: (e: { key: string; currentTarget: { blur: () => void } }) => e.key === 'Enter' && e.currentTarget.blur() } : {}),
  }
  return multiline ? (
    <textarea
      ref={box}
      rows={grow ? 1 : rows}
      placeholder={rest.placeholder}
      className={`${rest.className ?? ''} ${grow ? 'grow-text' : ''}`.trim() || undefined}
      aria-label={rest['aria-label']}
      title={rest.title}
      id={rest.id}
      autoFocus={rest.autoFocus}
      {...props}
    />
  ) : (
    <input {...rest} {...props} />
  )
}

