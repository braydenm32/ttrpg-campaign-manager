import { CalendarPlus } from '@phosphor-icons/react'
import type { DateOption } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { useMenu } from './components'

/**
 * Add to calendar: the booked date of the next session, as a calendar file (Apple Calendar, Outlook,
 * most phones) or straight into Google Calendar. Made on the device: nothing is sent anywhere until
 * the person opens Google's page themselves. A game night is put down as four hours.
 */

const HOURS = 4

/** "20261108T190000Z" (with a time zone) or "20261108T190000" (the GM's local time, when that's all there is). */
function stamp(d: Date, utc: boolean) {
  const p = (n: number) => String(n).padStart(2, '0')
  return utc
    ? `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`
    : `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}

function times(at: DateOption) {
  const utc = !!at.utc
  const start = new Date(at.utc ?? at.at)
  if (isNaN(start.getTime())) return undefined
  const end = new Date(start.getTime() + HOURS * 3_600_000)
  return { start: stamp(start, utc), end: stamp(end, utc) }
}

/** Calendar text: commas, semicolons and new lines are written out, and long lines folded. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const fold = (line: string) => line.match(/.{1,73}/gu)?.join('\r\n ') ?? line

export function icsFile({ title, at, details, link }: { title: string; at: DateOption; details?: string; link?: string }) {
  const t = times(at)
  if (!t) return undefined
  const desc = [details, link].filter(Boolean).join('\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Warded Atlas//Game night//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${at.id}@wardedatlas.com`,
    `DTSTAMP:${stamp(new Date(), true)}`,
    `DTSTART:${t.start}`,
    `DTEND:${t.end}`,
    `SUMMARY:${esc(title)}`,
    desc && `DESCRIPTION:${esc(desc)}`,
    link && `URL:${link}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean) as string[]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function googleCalendarLink({ title, at, details, link }: { title: string; at: DateOption; details?: string; link?: string }) {
  const t = times(at)
  if (!t) return undefined
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${t.start}/${t.end}`, details: [details, link].filter(Boolean).join('\n') })
  return `https://calendar.google.com/calendar/render?${q}`
}

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  a.download = `${name.trim().replace(/[^\w-]+/g, '_') || 'game-night'}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** The small "Add to calendar" button by a booked date, with its two choices. */
export function AddToCalendar({ title, at, details, link }: { title: string; at: DateOption; details?: string; link?: string }) {
  const menu = useMenu()
  const ics = icsFile({ title, at, details, link })
  const google = googleCalendarLink({ title, at, details, link })
  if (!ics || !google) return null
  return (
    <span className="menu-wrap add-to-calendar" {...menu.wrapProps}>
      <button className="small ghost" {...menu.buttonProps}>
        <Ico as={CalendarPlus} /> Add to calendar
      </button>
      <Help topic="addToCalendar" />
      {menu.open && (
        <span className="menu" {...menu.menuProps}>
          <button
            role="menuitem"
            onClick={() => {
              download(title, ics)
              menu.setOpen(false)
            }}
          >
            Calendar file (Apple, Outlook, most phones)
          </button>
          <a role="menuitem" href={google} target="_blank" rel="noopener noreferrer" onClick={() => menu.setOpen(false)}>
            Google Calendar
          </a>
        </span>
      )}
    </span>
  )
}
