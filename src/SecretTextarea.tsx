import { useLiveQuery } from 'dexie-react-hooks'
import { useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { db } from './db'
import { forNames } from './Markdown'

/**
 * A Markdown text box for GM writing, with buttons to add a GM secret or a secret for chosen
 * characters, and character-name suggestions while you type a ":::for" line.
 */
export function SecretTextarea({
  worldId,
  value,
  onChange,
  ...rest
}: { worldId: string; value: string; onChange: (v: string) => void } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState<number | null>(null)
  const pcs = useLiveQuery(() => db.entities.where({ worldId }).filter((e) => e.type === 'pc' && !e.template).sortBy('name'), [worldId]) ?? []

  // Use first names ("Wren") unless two characters share one.
  const firsts = pcs.map((p) => p.name.trim().split(/\s+/)[0])
  const short = (i: number) => (firsts.filter((f) => f.toLowerCase() === firsts[i].toLowerCase()).length > 1 ? pcs[i].name.trim() : firsts[i])

  // The ":::for" line the caret is on, if any.
  const pos = caret ?? -1
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1
  const before = pos >= 0 ? value.slice(lineStart, pos) : ''
  const forLine = before.match(/^:::for[ \t]+(.*)$/) ?? (before === ':::for' ? ['', ''] : null)
  let suggestions: { label: string; insert: string }[] = []
  let partial = ''
  if (forLine && !forLine[1].includes(':::')) {
    const spec = forLine[1]
    // What's being typed now: everything after the last comma, "&" or "and".
    const seps = [...spec.matchAll(/,|&|\band\b/gi)]
    const last = seps[seps.length - 1]
    partial = spec.slice(last ? last.index + last[0].length : 0).replace(/^[ \t]+/, '')
    const listed = new Set(forNames(spec.slice(0, spec.length - partial.length)).map((n) => n.toLowerCase()))
    suggestions = pcs
      .map((p, i) => ({ label: p.name, insert: short(i) }))
      .filter((s, i) => !listed.has(s.insert.toLowerCase()) && !listed.has(pcs[i].name.trim().toLowerCase()))
      .filter((s) => !partial.trim() || s.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(partial.trim().toLowerCase())) || s.label.toLowerCase().startsWith(partial.trim().toLowerCase()))
  }

  // Where to put the caret once an inserted value has rendered (before the next key press lands).
  const pendingCaret = useRef<number | null>(null)
  useLayoutEffect(() => {
    const t = ref.current
    const at = pendingCaret.current
    if (!t || at === null || t.value !== value) return
    pendingCaret.current = null
    t.focus()
    t.setSelectionRange(at, at)
  }, [value])
  const edit = (start: number, end: number, text: string, caretAt = start + text.length) => {
    pendingCaret.current = caretAt
    setCaret(caretAt)
    onChange(value.slice(0, start) + text + value.slice(end))
  }
  const insertBlock = (kind: 'gm' | 'for') => {
    const t = ref.current
    const at = t ? t.selectionStart : value.length
    const end = t ? t.selectionEnd : at
    const picked = value.slice(at, end)
    const lead = at > 0 && value[at - 1] !== '\n' ? '\n' : ''
    const head = kind === 'gm' ? ':::gm' : ':::for '
    // Leave the caret where the next thing to type goes: the names for ":::for", the secret for ":::gm".
    const caretAt = at + lead.length + head.length + (kind === 'gm' ? 1 + picked.length : 0)
    edit(at, end, `${lead}${head}\n${picked}\n:::\n`, caretAt)
  }
  const pick = (name: string) => {
    const spec = forLine![1]
    const prefix = spec.slice(0, spec.length - partial.length)
    const sep = prefix.trim() && !/(,|&|\band)[ \t]*$/i.test(prefix) ? ', ' : ''
    edit(pos - partial.length, pos, `${sep}${name}`)
  }
  const track = () => setCaret(ref.current?.selectionStart ?? null)

  return (
    <div className="secret-textarea">
      <textarea
        ref={ref}
        {...rest}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart)
        }}
        onSelect={track}
        onClick={track}
        onKeyUp={track}
      />
      {suggestions.length > 0 ? (
        <div className="name-suggestions" role="listbox" aria-label="Characters">
          <span className="small muted">Who is it for?</span>
          {suggestions.map((s) => (
            <button key={s.label} type="button" className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s.insert)}>
              🛡️ {s.label}
            </button>
          ))}
          {pcs.length === 0 && <span className="small muted">No player characters yet.</span>}
        </div>
      ) : forLine && pcs.length === 0 ? (
        <div className="name-suggestions">
          <span className="small muted">Add your players’ characters as Player Character pages to pick them here.</span>
        </div>
      ) : null}
      <div className="row wrap secret-buttons">
        <button type="button" className="ghost small" title="Hide a passage from every player" onClick={() => insertBlock('gm')}>
          🔒 GM-only passage
        </button>
        <button
          type="button"
          className="ghost small"
          title="A passage only the players of the characters you name will see"
          onClick={() => insertBlock('for')}
        >
          🤫 Secret for…
        </button>
      </div>
    </div>
  )
}
