import { useEffect, useState } from 'react'
import { CalendarCheck, X } from '@phosphor-icons/react'
import { db, type Entity } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { revealDue } from './revealDue'

/**
 * Timed reveals: a GM-only page can carry a "reveal on" date (Entity.revealAt). From that moment
 * players get it like any revealed page, even with the GM's app closed: the server checks the date
 * (public.reveal_due in supabase/migrations). When the GM next opens the world, the page itself turns
 * "Players can see this" and the date goes, so the GM's own screens say the same.
 */

/** Turns the pages whose date has come into revealed pages. For the GM's own worlds. */
export async function revealDuePages(worldId: string) {
  const now = Date.now()
  await db.entities
    .where({ worldId })
    .filter((e) => revealDue(e, now))
    .modify((e) => {
      if (e.visibility === 'gm') {
        e.visibility = 'players'
        e.updatedAt = now
      }
      delete e.revealAt
    })
}

/** While a GM's world is open: on opening it, then once a minute. */
export function useTimedReveals(worldId: string | undefined, own: boolean) {
  useEffect(() => {
    if (!worldId || !own) return
    void revealDuePages(worldId)
    const t = setInterval(() => !document.hidden && revealDuePages(worldId), 60_000)
    return () => clearInterval(t)
  }, [worldId, own])
}

/** "Fri 7 Nov, 19:00". */
export const revealDay = (t: number) => new Date(t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** For a datetime-local box: "2026-11-07T19:00" in this device's time. */
function toLocalInput(t: number) {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** By a page's visibility, for the GM: "Appears for players on Fri 7 Nov, 19:00". */
export function RevealOnChip({ entity: e }: { entity: Pick<Entity, 'revealAt' | 'visibility'> }) {
  if (e.visibility !== 'gm' || typeof e.revealAt !== 'number') return null
  return (
    <span className="chip reveal-on-chip" title="Players get this page then, by themselves.">
      <Ico as={CalendarCheck} /> Appears for players on {revealDay(e.revealAt)}
    </span>
  )
}

/** In the page editor, for a GM-only page: pick the date and time it reveals itself. */
export function RevealOnField({ value, onChange }: { value: number | undefined; onChange: (t: number | undefined) => void }) {
  const [open, setOpen] = useState(value !== undefined)
  if (!open)
    return (
      <p className="reveal-on">
        <button type="button" className="ghost small" onClick={() => setOpen(true)}>
          <Ico as={CalendarCheck} /> Reveal on a date…
        </button>{' '}
        <Help topic="revealOn" />
      </p>
    )
  const past = value !== undefined && value <= Date.now()
  return (
    <div className="reveal-on row wrap">
      <label className="small">
        <Ico as={CalendarCheck} /> Reveal to players on{' '}
        <input
          type="datetime-local"
          value={value !== undefined ? toLocalInput(value) : ''}
          onChange={(ev) => {
            const t = ev.target.value ? new Date(ev.target.value).getTime() : NaN
            onChange(isNaN(t) ? undefined : t)
          }}
        />
      </label>
      <button
        type="button"
        className="ghost small"
        aria-label="No reveal date"
        onClick={() => {
          onChange(undefined)
          setOpen(false)
        }}
      >
        <Ico as={X} />
      </button>
      <Help topic="revealOn" />
      <span className="small muted">{past ? 'That time has passed: players get it as soon as you save.' : 'Players get it then, even if your app is closed. Needs cloud sync and your players invited.'}</span>
    </div>
  )
}
