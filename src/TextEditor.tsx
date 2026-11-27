import { lazy, Suspense, useState, useSyncExternalStore } from 'react'
import type { Entity } from './db'
import { ErrorBoundary } from './ErrorBoundary'
import { Help } from './help'
import { Ico } from './icons'
import { Markdown } from './Markdown'
import { SecretTextarea } from './SecretTextarea'
import { Eye } from '@phosphor-icons/react'

/** The formatted editor and the library under it are fetched only when an editor opens. */
const FormattedEditor = lazy(() => import('./editor/FormattedEditor'))

type Mode = 'formatted' | 'markdown'
const KEY = 'editor.mode'
const listeners = new Set<() => void>()

/** How this device likes to write: formatted (the default) or as Markdown. */
function readMode(): Mode {
  try {
    return localStorage.getItem(KEY) === 'markdown' ? 'markdown' : 'formatted'
  } catch {
    return 'formatted'
  }
}
function saveMode(mode: Mode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Storage blocked: the choice lasts until the page is left.
    fallback = mode
  }
  listeners.forEach((l) => l())
}
let fallback: Mode | null = null
const useMode = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => fallback ?? readMode(),
  )

/**
 * A long piece of the GM's writing (a page's description, its GM notes), edited one of two ways:
 *  - Formatted: the text as it will look, with a toolbar (src/editor/FormattedEditor.tsx).
 *  - Markdown: the plain text box, as before, for anyone who prefers it or wants to type something exotic.
 * Both edit the same Markdown text, so switching loses nothing, and the choice is remembered on this
 * device. "As players see it" shows the text read-only, exactly as the page will show it to players.
 */
export function TextEditor({
  worldId,
  value,
  onChange,
  label,
  rows = 10,
  placeholder,
  secrets = true,
  preview,
}: {
  worldId: string
  value: string
  onChange: (v: string) => void
  /** What the box is, for screen readers ("Description"). */
  label: string
  rows?: number
  placeholder?: string
  /** False for GM notes: all of it is GM only, so no secret-passage buttons and no players' view. */
  secrets?: boolean
  /** The world's pages, to show the text as players will see it. */
  preview?: Entity[]
}) {
  const mode = useMode()
  const [asPlayers, setAsPlayers] = useState(false)
  const plain = secrets ? (
    <SecretTextarea worldId={worldId} rows={rows} value={value} onChange={onChange} placeholder={placeholder} aria-label={label} />
  ) : (
    <textarea rows={rows} value={value} onChange={(ev) => onChange(ev.target.value)} placeholder={placeholder} aria-label={label} />
  )
  const pick = (m: Mode) => {
    setAsPlayers(false)
    saveMode(m)
  }
  return (
    <div className="text-editor">
      <div className="row wrap text-editor-modes">
        <div className="segmented" role="group" aria-label={`How to write the ${label.toLowerCase()}`}>
          <button type="button" className={!asPlayers && mode === 'formatted' ? 'on' : ''} aria-pressed={!asPlayers && mode === 'formatted'} onClick={() => pick('formatted')}>
            Formatted
          </button>
          <button type="button" className={!asPlayers && mode === 'markdown' ? 'on' : ''} aria-pressed={!asPlayers && mode === 'markdown'} onClick={() => pick('markdown')}>
            Markdown
          </button>
          {preview && (
            <button type="button" className={asPlayers ? 'on' : ''} aria-pressed={asPlayers} onClick={() => setAsPlayers(true)}>
              <Ico as={Eye} /> As players see it
            </button>
          )}
        </div>
        <Help topic="formattedEditor" />
      </div>
      {asPlayers && preview ? (
        <div className="text-editor-preview">
          {value.trim() ? <Markdown text={value} entities={preview} worldId={worldId} showSecrets={false} /> : <p className="muted">Nothing written yet.</p>}
          <p className="small muted">This is the text players get once the page is revealed. GM-only passages are left out; a secret for some characters shows only to their players.</p>
        </div>
      ) : mode === 'formatted' ? (
        // If the editor can't be fetched or breaks, the plain box is still there, with the same text.
        <ErrorBoundary quiet fallback={plain}>
          <Suspense fallback={<textarea rows={rows} value={value} readOnly aria-label={label} aria-busy="true" />}>
            <FormattedEditor worldId={worldId} value={value} onChange={onChange} label={label} rows={rows} placeholder={placeholder} secrets={secrets} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        plain
      )}
    </div>
  )
}
