import { useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Help, type HelpTopic } from './help'

/**
 * Keeping your place on long screens: a row of buttons that jumps to each part (sticky under the
 * top bar, mostly for phones), and the scroll position kept per step in the browser's history, so
 * Back from a page you opened lands where you were, not at the top.
 */

export interface JumpTarget {
  /** The element's id on the page (and the `at=` word in the address). */
  id: string
  label: string
  /** Opens a folded panel before jumping to it. */
  open?: () => void
}

/** Scrolls to a part of the screen, leaving room for the top bar and the jump row. */
export function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ block: 'start' })
  return true
}

/**
 * The jump row. The part you jumped to goes in the address (`?at=fight`, replacing this step, not
 * adding one), so a reload or Back lands on it again. `current` lights the part on screen now.
 */
export function JumpRow({ targets, label, className = '', help }: { targets: JumpTarget[]; label: string; className?: string; help?: HelpTopic }) {
  const [params, setParams] = useSearchParams()
  const at = params.get('at')
  return (
    <nav className={`jump-row ${className}`} aria-label={label}>
      {targets.map((t) => (
        <button
          key={t.id}
          type="button"
          className={at === t.id ? 'on' : ''}
          aria-current={at === t.id ? 'true' : undefined}
          onClick={() => {
            t.open?.()
            const next = new URLSearchParams(params)
            next.set('at', t.id)
            setParams(next, { replace: true })
            // After the panel opens (if it was folded).
            requestAnimationFrame(() => jumpTo(t.id))
          }}
        >
          {t.label}
        </button>
      ))}
      {help && <Help topic={help} />}
    </nav>
  )
}

const scrollKey = (key: string) => `scroll.${key}`

/**
 * Remembers how far down this step of history was scrolled, and puts it back when you come back to
 * it (Back, or a reload). `ready` says the screen has drawn its content, so there's somewhere to
 * scroll to. Without a remembered place, an `at=` in the address jumps to that part instead.
 */
export function useKeepScroll(ready: boolean) {
  const { key } = useLocation()
  const [params] = useSearchParams()
  const at = params.get('at')
  const done = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!ready || done.current === key) return
    done.current = key
    let saved = 0
    try {
      saved = Number(sessionStorage.getItem(scrollKey(key))) || 0
    } catch {
      // Storage blocked: start at the top.
    }
    // Twice: once now, and once more after pictures and folded panels have settled.
    const go = () => (saved > 0 ? window.scrollTo(0, saved) : at ? jumpTo(at) : undefined)
    requestAnimationFrame(go)
    const later = setTimeout(go, 250)
    return () => clearTimeout(later)
  }, [ready, key, at])
  useEffect(() => {
    let frame = 0
    const save = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // Only for this step: while moving to another, the old screen's last scroll doesn't count.
        if (window.history.state?.key !== key && key !== 'default') return
        try {
          sessionStorage.setItem(scrollKey(key), String(Math.round(window.scrollY)))
        } catch {
          // Not remembered this time.
        }
      })
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      window.removeEventListener('scroll', save)
      cancelAnimationFrame(frame)
    }
  }, [key])
}
