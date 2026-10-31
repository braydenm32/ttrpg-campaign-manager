import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowCounterClockwise, Check } from '@phosphor-icons/react'
import { Ico } from './icons'

/**
 * Two quiet signs that the app did what you asked, shared by every screen:
 *
 * - toast(): a small note along the bottom ("Scene removed · Undo"). Quick removes happen at once
 *   and offer Undo for a few seconds instead of asking "are you sure?" first. One at a time: a new
 *   one replaces the last (its Undo is gone once it's off screen).
 * - markSaved() and <SavedMark />: a muted "Saved" by a title that autosaves, so you can tell your
 *   typing is kept without a Save button.
 */

export interface Toast {
  id: number
  text: string
  /** Puts things back. Leaving it out makes a plain note. */
  undo?: () => unknown
  /** The Undo button's words, if not "Undo". */
  undoLabel?: string
}

let current: Toast | undefined
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** Shows a note along the bottom of the screen, with Undo if `undo` is given. */
export function toast(text: string, undo?: () => unknown, undoLabel?: string) {
  current = { id: nextId++, text, undo, undoLabel }
  emit()
  return current.id
}

/** Takes a note away (e.g. once what it offered to undo can't be undone any more). */
export function dismissToast(id?: number) {
  if (!current || (id !== undefined && current.id !== id)) return
  current = undefined
  emit()
}

/**
 * Does a quick remove at once and offers Undo: `remove` runs now, `restore` puts it back if Undo
 * is pressed. The words say what went, e.g. “Scene “Ambush at the ford” removed”.
 */
export async function removeWithUndo(text: string, remove: () => unknown, restore: () => unknown) {
  await remove()
  toast(text, restore)
}

/** How long a note stays: long enough to read and reach for Undo at the table. */
const SHOW_FOR = 7000

/** The note itself, drawn once in the world's frame (App.tsx). */
export function ToastHost() {
  const t = useSyncExternalStore(subscribe, () => current)
  const [busy, setBusy] = useState(false)
  // Hovering or focusing it keeps it up, so Undo doesn't vanish under your finger.
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!t || held) return
    const timer = setTimeout(() => dismissToast(t.id), SHOW_FOR)
    return () => clearTimeout(timer)
  }, [t, held])
  if (!t) return null
  return (
    <div
      key={t.id}
      className="undo-toast"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span>{t.text}</span>
      {t.undo && (
        <button
          className="undo-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await t.undo!()
            } finally {
              setBusy(false)
              setHeld(false)
              dismissToast(t.id)
            }
          }}
        >
          <Ico as={ArrowCounterClockwise} /> {t.undoLabel ?? 'Undo'}
        </button>
      )}
      <button className="ghost undo-close" aria-label="Close" onClick={() => dismissToast(t.id)}>
        ✕
      </button>
    </div>
  )
}

// ——— "Saved" ———

let savedAt = 0
const savedListeners = new Set<() => void>()

/** Says a change was just saved: any <SavedMark /> on screen shows "Saved" for a moment. */
export function markSaved() {
  savedAt = Date.now()
  savedListeners.forEach((l) => l())
}

/** Runs a save and marks it saved once it's done (a value or a promise). */
export function saving<T>(result: T) {
  Promise.resolve(result).then(markSaved, () => {})
  return result
}

/** A muted "Saved ✓" that shows for a couple of seconds after each save, by a title or a box that autosaves. */
export function SavedMark({ className = '' }: { className?: string }) {
  const at = useSyncExternalStore(
    (l) => {
      savedListeners.add(l)
      return () => void savedListeners.delete(l)
    },
    () => savedAt,
  )
  const [shown, setShown] = useState(false)
  const first = useRef(at)
  useEffect(() => {
    if (at === first.current) return
    setShown(true)
    const t = setTimeout(() => setShown(false), 2200)
    return () => clearTimeout(t)
  }, [at])
  return (
    <span className={`saved-mark ${shown ? 'on' : ''} ${className}`} aria-live="polite">
      {shown && (
        <>
          <Ico as={Check} /> Saved
        </>
      )}
    </span>
  )
}
