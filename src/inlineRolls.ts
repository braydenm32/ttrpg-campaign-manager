import { db, type Entity } from './db'
import { roll } from './dice'
import type { AppElement } from './Markdown'
import { sessionStage } from './sessions'
import { listedEntries, rollOnTable } from './tables'

/**
 * Dice and tables inside page text. `roll:1d8+3` (in backticks or not) becomes a small button that
 * rolls in place, and `{{Blackwood encounters}}` one that rolls on that table. They're made after the
 * secret passages are taken out, so a player only ever gets buttons in text they can read, and rolls
 * only on the table lines they can see. For the GM, while a session is being played, a roll can go
 * into that session's notes with the time.
 */

const ROLL = /`roll:\s*([0-9dDkhl%+\-\s]+?)\s*`|(?<![\w`])roll:([0-9dDkhl%+-]+)/g
const TABLE = /\{\{([^{}\n]{1,80})\}\}/g

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** A roll button, with the box its result goes in. */
const rollButton = (what: { 'data-roll': string } | { 'data-table': string }, title: string, text: string): AppElement => ({
  tag: 'span',
  attrs: { class: 'inline-roll-wrap' },
  children: [
    { tag: 'button', attrs: { type: 'button', class: 'inline-roll', ...what, title }, text },
    { tag: 'output', attrs: { class: 'inline-roll-out', 'aria-live': 'polite' } },
  ],
})

/**
 * Turns the roll and table marks in Markdown source into buttons (code blocks are left alone).
 * `put` holds each button back and gives the marker that stands in for it (see renderMarkdown).
 */
export function inlineRolls(src: string, tables: Entity[], still: boolean | undefined, put: (el: AppElement, raw: string) => string): string {
  const byName = new Map(tables.map((t) => [t.name.trim().toLowerCase(), t]))
  return src
    .split(/(```[\s\S]*?```)/)
    .map((part, i) => {
      if (i % 2) return part
      return part
        .replace(ROLL, (whole, a?: string, b?: string) => {
          const expr = (a ?? b ?? '').replace(/\s+/g, '')
          try {
            roll(expr)
          } catch {
            return whole
          }
          if (still) return put({ tag: 'span', attrs: { class: 'inline-roll still' }, text: `🎲 ${expr}` }, whole)
          return put(rollButton({ 'data-roll': expr }, `Roll ${expr}`, `🎲 ${expr}`), whole)
        })
        .replace(TABLE, (whole, name: string) => {
          const t = byName.get(name.trim().toLowerCase())
          if (!t || t.type !== 'table') return whole
          if (still) return put({ tag: 'span', attrs: { class: 'inline-roll still' }, text: `🎲 ${t.name}` }, whole)
          return put(rollButton({ 'data-table': t.id }, `Roll on ${t.name}`, `🎲 ${t.name}`), whole)
        })
    })
    .join('')
}

/** The "Add to notes" buttons made after a roll, with the session and the line each one adds. */
const toNotesButtons = new WeakMap<HTMLButtonElement, { session: string; line: string }>()

/** The session being played in this world right now, if any (for "add to notes"). */
async function openSession(worldId: string) {
  const sessions = await db.sessions.where({ worldId }).toArray()
  return sessions.find((s) => !s.playedAt && sessionStage(s) === 'playing')
}

/**
 * A click on a roll button: rolls, shows the result beside it, and (GM, a session being played)
 * offers to put it in the session's notes. Returns false when the click wasn't on a roll button.
 */
export function clickInlineRoll(target: HTMLElement, { tables, showSecrets, isGM, worldId }: { tables: Entity[]; showSecrets: boolean; isGM: boolean; worldId: string }) {
  const toNotes = target.closest<HTMLButtonElement>('button.roll-to-notes')
  if (toNotes) {
    // Only a button made here after a roll, for the GM, and only once. One that merely looks like
    // it (typed into a page or the party's notes) does nothing.
    const made = toNotesButtons.get(toNotes)
    if (!made || !isGM) return true
    toNotesButtons.delete(toNotes)
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    db.sessions
      .where('id')
      .equals(made.session)
      .modify((s) => void (s.notes = `${s.notes.trimEnd()}${s.notes.trim() ? '\n' : ''}- ${time} ${made.line}`))
      .then(() => {
        toNotes.textContent = '✓ In the notes'
        toNotes.disabled = true
      })
    return true
  }
  const button = target.closest<HTMLButtonElement>('button.inline-roll')
  if (!button) return false
  const out = button.nextElementSibling as HTMLOutputElement | null
  let line = ''
  if (button.dataset.roll) {
    const r = roll(button.dataset.roll)
    if (out) out.innerHTML = `<b>${r.total}</b> <span class="muted small">${esc(r.detail.replace(/~~(\d+)~~/g, '($1)'))}</span>`
    line = `Rolled ${r.expr}: ${r.total}`
  } else if (button.dataset.table) {
    // Players roll only on the lines they can read.
    const visible = tables.map((t) => (showSecrets ? t : { ...t, entries: listedEntries(t, false) }))
    const t = visible.find((x) => x.id === button.dataset.table)
    if (!t) return true
    const result = rollOnTable(t, visible).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, n: string, l?: string) => l ?? n)
    if (out) out.innerHTML = `<b>${esc(result)}</b>`
    line = `${t.name}: ${result}`
  }
  if (isGM && out && line)
    openSession(worldId).then((s) => {
      if (!s) return
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'link small roll-to-notes'
      b.textContent = `Add to #${s.number}’s notes`
      toNotesButtons.set(b, { session: s.id, line })
      out.append(' ', b)
    })
  return true
}
