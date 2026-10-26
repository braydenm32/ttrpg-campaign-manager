import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Help } from './help'
import { db, type CalDate, type Entity, type Session, type World, type WorldCalendar } from './db'
import { Ico } from './icons'
import { CalendarBlank, DiceFive } from '@phosphor-icons/react'

/**
 * In-world calendars: month and day names, the era after the year, and moons. Dates are stored as
 * { year, month, day } and turned into a day count for sorting, weekdays and moon phases.
 * Calendars have no leap years, to keep things simple.
 */

const months = (list: [string, number][]) => list.map(([name, days]) => ({ name, days }))

export const CALENDAR_PRESETS: Record<string, { label: string; calendar: WorldCalendar }> = {
  harptos: {
    label: 'Forgotten Realms (Harptos)',
    calendar: {
      preset: 'harptos',
      months: months([
        ['Hammer', 30], ['Midwinter', 1], ['Alturiak', 30], ['Ches', 30], ['Tarsakh', 30], ['Greengrass', 1], ['Mirtul', 30], ['Kythorn', 30],
        ['Flamerule', 30], ['Midsummer', 1], ['Eleasis', 30], ['Eleint', 30], ['Highharvestide', 1], ['Marpenoth', 30], ['Uktar', 30],
        ['Feast of the Moon', 1], ['Nightal', 30],
      ]),
      // The Realms count days in tendays, without names.
      weekdays: [],
      era: 'DR',
      moons: [{ name: 'Selûne', cycle: 30.4375, offset: 0 }],
      today: { year: 1492, month: 0, day: 1 },
    },
  },
  golarion: {
    label: 'Golarion (Absalom Reckoning)',
    calendar: {
      preset: 'golarion',
      months: months([
        ['Abadius', 31], ['Calistril', 28], ['Pharast', 31], ['Gozran', 30], ['Desnus', 31], ['Sarenith', 30], ['Erastus', 31], ['Arodus', 31],
        ['Rova', 30], ['Lamashan', 31], ['Neth', 30], ['Kuthona', 31],
      ]),
      weekdays: ['Moonday', 'Toilday', 'Wealday', 'Oathday', 'Fireday', 'Starday', 'Sunday'],
      era: 'AR',
      moons: [{ name: 'Somal', cycle: 29.5, offset: 0 }],
      today: { year: 4725, month: 0, day: 1 },
    },
  },
  eberron: {
    label: 'Eberron (Galifar)',
    calendar: {
      preset: 'eberron',
      months: months([
        ['Zarantyr', 28], ['Olarune', 28], ['Therendor', 28], ['Eyre', 28], ['Dravago', 28], ['Nymm', 28], ['Lharvion', 28], ['Barrakas', 28],
        ['Rhaan', 28], ['Sypheros', 28], ['Aryth', 28], ['Vult', 28],
      ]),
      weekdays: ['Sul', 'Mol', 'Zol', 'Wir', 'Zor', 'Far', 'Sar'],
      era: 'YK',
      moons: [],
      today: { year: 998, month: 0, day: 1 },
    },
  },
  greyhawk: {
    label: 'Greyhawk (Common Year)',
    calendar: {
      preset: 'greyhawk',
      months: months([
        ['Needfest', 7], ['Fireseek', 28], ['Readying', 28], ['Coldeven', 28], ['Growfest', 7], ['Planting', 28], ['Flocktime', 28], ['Wealsun', 28],
        ['Richfest', 7], ['Reaping', 28], ['Goodmonth', 28], ['Harvester', 28], ['Brewfest', 7], ['Patchwall', 28], ['Ready’reat', 28], ['Sunsebb', 28],
      ]),
      weekdays: ['Starday', 'Sunday', 'Moonday', 'Godsday', 'Waterday', 'Earthday', 'Freeday'],
      era: 'CY',
      moons: [
        { name: 'Luna', cycle: 28, offset: 0 },
        { name: 'Celene', cycle: 91, offset: 0 },
      ],
      today: { year: 576, month: 1, day: 1 },
    },
  },
  exandria: {
    label: 'Exandria (Tal’Dorei)',
    calendar: {
      preset: 'exandria',
      months: months([
        ['Horisal', 29], ['Misuthar', 30], ['Dualahei', 30], ['Thunsheer', 31], ['Unndilar', 28], ['Brussendar', 31], ['Sydenstar', 32],
        ['Fessuran', 29], ['Quen’pillar', 27], ['Cuersaar', 29], ['Duscar', 32],
      ]),
      weekdays: ['Miresen', 'Grissen', 'Whelsen', 'Conthsen', 'Folsen', 'Yulisen', 'Da’leysen'],
      era: 'PD',
      moons: [{ name: 'Catha', cycle: 33, offset: 0 }],
      today: { year: 836, month: 0, day: 1 },
    },
  },
  earth: {
    label: 'Real-world months',
    calendar: {
      preset: 'earth',
      months: months([
        ['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31],
        ['September', 30], ['October', 31], ['November', 30], ['December', 31],
      ]),
      weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      era: '',
      moons: [{ name: 'The Moon', cycle: 29.53, offset: 0 }],
      today: { year: 1890, month: 0, day: 1 },
    },
  },
  custom: {
    label: 'My own calendar',
    calendar: {
      preset: 'custom',
      months: Array.from({ length: 12 }, (_, i) => ({ name: `Month ${i + 1}`, days: 30 })),
      weekdays: ['Firstday', 'Seconday', 'Thirdday', 'Fourthday', 'Fifthday', 'Sixthday', 'Restday'],
      era: '',
      moons: [],
      today: { year: 1, month: 0, day: 1 },
    },
  },
}

export const yearLength = (c: WorldCalendar) => c.months.reduce((n, m) => n + Math.max(1, m.days), 0) || 1

/** Days since day 1 of year 0. */
export function toDays(c: WorldCalendar, d: CalDate) {
  let n = d.year * yearLength(c)
  for (let i = 0; i < Math.min(d.month, c.months.length); i++) n += Math.max(1, c.months[i].days)
  return n + d.day - 1
}

export function fromDays(c: WorldCalendar, n: number): CalDate {
  const len = yearLength(c)
  const year = Math.floor(n / len)
  let rest = n - year * len
  for (let month = 0; month < c.months.length; month++) {
    const days = Math.max(1, c.months[month].days)
    if (rest < days) return { year, month, day: rest + 1 }
    rest -= days
  }
  return { year, month: 0, day: 1 }
}

export const addDays = (c: WorldCalendar, d: CalDate, n: number) => fromDays(c, toDays(c, d) + n)

export function weekday(c: WorldCalendar, d: CalDate) {
  if (!c.weekdays.length) return ''
  const n = toDays(c, d) + (c.weekdayOffset ?? 0)
  return c.weekdays[((n % c.weekdays.length) + c.weekdays.length) % c.weekdays.length]
}

const PHASES = ['🌑 New', '🌒 Waxing crescent', '🌓 First quarter', '🌔 Waxing gibbous', '🌕 Full', '🌖 Waning gibbous', '🌗 Last quarter', '🌘 Waning crescent']

/** A moon's phase on a day: full on day `offset`, new half a cycle later. */
export function moonPhase(moon: WorldCalendar['moons'][number], days: number) {
  const cycle = Math.max(1, moon.cycle)
  const t = ((((days - moon.offset) / cycle) % 1) + 1) % 1
  // t = 0 is full; shift so index 4 is full.
  return PHASES[Math.round(((t + 0.5) % 1) * 8) % 8]
}

export function formatDate(c: WorldCalendar | undefined, d: CalDate | undefined, withWeekday = true) {
  if (!c || !d) return ''
  const m = c.months[d.month]
  if (!m) return `${d.year}`
  const wd = withWeekday ? weekday(c, d) : ''
  // One-day months (festivals) read better without a day number.
  const day = m.days <= 1 ? m.name : `${d.day} ${m.name}`
  return `${wd ? `${wd}, ` : ''}${day} ${d.year}${c.era ? ` ${c.era}` : ''}`
}

/** Pick a year, month and day on the world's calendar. */
export function CalDateInput({ calendar, value, onChange }: { calendar: WorldCalendar; value?: CalDate; onChange: (d: CalDate | undefined) => void }) {
  const d = value ?? calendar.today ?? { year: 1, month: 0, day: 1 }
  const month = calendar.months[d.month]
  return (
    <span className="row cal-input">
      <select value={value ? d.day : ''} onChange={(e) => onChange(e.target.value ? { ...d, day: Number(e.target.value) } : undefined)} aria-label="Day">
        <option value="">Day</option>
        {Array.from({ length: Math.max(1, month?.days ?? 1) }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      <select
        value={value ? d.month : ''}
        onChange={(e) => {
          if (e.target.value === '') return onChange(undefined)
          const m = Number(e.target.value)
          onChange({ ...d, month: m, day: Math.min(d.day, Math.max(1, calendar.months[m]?.days ?? 1)) })
        }}
        aria-label="Month"
      >
        <option value="">Month</option>
        {calendar.months.map((m, i) => (
          <option key={i} value={i}>
            {m.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        className="year-input"
        value={value ? d.year : ''}
        placeholder="Year"
        onChange={(e) => onChange(e.target.value === '' ? undefined : { ...d, year: Math.round(Number(e.target.value)) })}
        aria-label="Year"
      />
      {calendar.era && <span className="muted">{calendar.era}</span>}
    </span>
  )
}

/** World settings: choose or build the calendar. */
export function CalendarEditor({ world }: { world: World }) {
  const c = world.calendar
  const set = (next: WorldCalendar | undefined) => db.worlds.update(world.id, { calendar: next, updatedAt: Date.now() })
  const change = (patch: Partial<WorldCalendar>) => c && set({ ...c, ...patch })
  const [weekdays, setWeekdays] = useState<string | null>(null)
  return (
    <section>
      <h2>
        <Ico as={CalendarBlank} /> Calendar <Help topic="calendar" />
      </h2>
      <div className="row wrap">
        <select
          value={c?.preset ?? (c ? 'custom' : '')}
          onChange={(e) => {
            const p = CALENDAR_PRESETS[e.target.value]
            if (!e.target.value) {
              if (confirm('Stop using a calendar? Dates already set on events stay, but are shown without month names.')) set(undefined)
              return
            }
            if (c && !confirm(`Switch to ${p.label}? Your months and weekdays are replaced.`)) return
            set(structuredClone(p.calendar))
          }}
        >
          <option value="">No calendar (dates are free text)</option>
          {Object.entries(CALENDAR_PRESETS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {c && (
        <div className="form calendar-editor">
          <label>
            <span>
              Today in the world <Help topic="worldToday" />
            </span>
            <CalDateInput calendar={c} value={c.today} onChange={(today) => change({ today })} />
          </label>
          <div className="grid-2">
            <label>
              Written after the year
              <input value={c.era} onChange={(e) => change({ era: e.target.value })} placeholder="e.g. DR" />
            </label>
            <label>
              Day names, in order (comma separated)
              <input
                value={weekdays ?? c.weekdays.join(', ')}
                onFocus={() => setWeekdays(c.weekdays.join(', '))}
                onChange={(e) => {
                  setWeekdays(e.target.value)
                  change({ weekdays: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })
                }}
                onBlur={() => setWeekdays(null)}
                placeholder="Leave empty for no day names"
              />
            </label>
          </div>
          <details>
            <summary>
              Months ({c.months.length}, {yearLength(c)} days a year)
            </summary>
            {c.months.map((m, i) => (
              <div key={i} className="row field-row">
                <input value={m.name} onChange={(e) => change({ months: c.months.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Month name" />
                <input
                  type="number"
                  min={1}
                  className="year-input"
                  value={m.days}
                  onChange={(e) => change({ months: c.months.map((x, j) => (j === i ? { ...x, days: Math.max(1, Number(e.target.value) || 1) } : x)) })}
                  aria-label="Days"
                />
                <span className="muted small">days</span>
                <button type="button" className="ghost" disabled={c.months.length < 2} onClick={() => change({ months: c.months.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => change({ months: [...c.months, { name: `Month ${c.months.length + 1}`, days: 30 }] })}>
              + Month
            </button>
          </details>
          <details>
            <summary>Moons ({c.moons.length})</summary>
            {c.moons.map((m, i) => (
              <div key={i} className="row field-row">
                <input value={m.name} onChange={(e) => change({ moons: c.moons.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Moon name" />
                <input
                  type="number"
                  min={1}
                  step="any"
                  className="year-input"
                  value={m.cycle}
                  onChange={(e) => change({ moons: c.moons.map((x, j) => (j === i ? { ...x, cycle: Math.max(1, Number(e.target.value) || 1) } : x)) })}
                  aria-label="Days per cycle"
                />
                <span className="muted small">days round</span>
                <button
                  type="button"
                  className="small"
                  title="Make today a full moon"
                  onClick={() => c.today && change({ moons: c.moons.map((x, j) => (j === i ? { ...x, offset: toDays(c, c.today!) } : x)) })}
                >
                  Full today
                </button>
                <button type="button" className="ghost" onClick={() => change({ moons: c.moons.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => change({ moons: [...c.moons, { name: 'Moon', cycle: 30, offset: 0 }] })}>
              + Moon
            </button>
          </details>
          {c.weekdays.length > 0 && c.today && (
            <label className="inline-check small">
              Today is a
              <select
                value={weekday(c, c.today)}
                onChange={(e) => {
                  const want = c.weekdays.indexOf(e.target.value)
                  const n = toDays(c, c.today!)
                  change({ weekdayOffset: (((want - n) % c.weekdays.length) + c.weekdays.length) % c.weekdays.length })
                }}
              >
                {c.weekdays.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </section>
  )
}

/** Today's date in the world, its moons, and (for the GM) buttons to move time on. */
export function WorldToday({ world, isGM }: { world: World; isGM: boolean }) {
  const c = world.calendar
  if (!c?.today) return null
  const days = toDays(c, c.today)
  const move = (n: number) => db.worlds.update(world.id, { calendar: { ...c, today: addDays(c, c.today!, n) }, updatedAt: Date.now() })
  const week = c.weekdays.length || 10
  return (
    <div className="world-today">
      <span>
        <Ico as={CalendarBlank} /> <strong>{formatDate(c, c.today)}</strong> <Help topic="worldToday" />
      </span>
      {c.moons.map((m) => (
        <span key={m.name} className="muted small">
          {moonPhase(m, days)} {m.name.toLowerCase().startsWith('the ') ? m.name.toLowerCase() : m.name}
        </span>
      ))}
      {isGM && (
        <span className="row">
          <button className="small" onClick={() => move(-1)} title="Back a day">
            −1 day
          </button>
          <button className="small" onClick={() => move(1)}>
            +1 day
          </button>
          <button className="small" onClick={() => move(week)}>
            +1 {c.weekdays.length ? 'week' : 'tenday'}
          </button>
          <button className="small" onClick={() => move(Math.max(1, c.months[c.today!.month]?.days ?? 30))}>
            +1 month
          </button>
        </span>
      )}
    </div>
  )
}

/** One month as a grid, with dated events and sessions on their days. */
export function MonthGrid({ world, events, sessions }: { world: World; events: Entity[]; sessions: Session[] }) {
  const c = world.calendar!
  const [at, setAt] = useState<{ year: number; month: number }>(() => ({ year: c.today?.year ?? 1, month: c.today?.month ?? 0 }))
  const month = c.months[at.month] ?? c.months[0]
  const cols = c.weekdays.length || 10
  const first = toDays(c, { year: at.year, month: at.month, day: 1 })
  const lead = c.weekdays.length ? (((first + (c.weekdayOffset ?? 0)) % cols) + cols) % cols : 0
  const step = (dir: 1 | -1) => {
    let m = at.month + dir
    let y = at.year
    if (m < 0) {
      m = c.months.length - 1
      y--
    } else if (m >= c.months.length) {
      m = 0
      y++
    }
    setAt({ year: y, month: m })
  }
  const on = (d: CalDate | undefined, day: number) => !!d && d.year === at.year && d.month === at.month && d.day === day
  const isToday = (day: number) => on(c.today, day)
  return (
    <div className="month-grid-wrap">
      <div className="row spread">
        <button className="ghost" onClick={() => step(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>
          {month.name} {at.year}
          {c.era ? ` ${c.era}` : ''}
        </strong>
        <button className="ghost" onClick={() => step(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="month-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 10)}, minmax(0, 1fr))` }}>
        {c.weekdays.map((w) => (
          <div key={w} className="month-head">
            {w.slice(0, 3)}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`x${i}`} />
        ))}
        {Array.from({ length: Math.max(1, month.days) }, (_, i) => {
          const day = i + 1
          const evs = events.filter((e) => on(e.eventWhen, day))
          const ses = sessions.filter((s) => on(s.worldDate, day))
          return (
            <div key={day} className={`month-day ${isToday(day) ? 'today' : ''}`}>
              <span className="month-num">{day}</span>
              {ses.map((s) => (
                <Link key={s.id} className="month-item session" to={`/w/${world.id}/s/${s.id}`}>
                  <Ico as={DiceFive} /> #{s.number}
                </Link>
              ))}
              {evs.map((e) => (
                <Link key={e.id} className="month-item" to={`/w/${world.id}/e/${e.id}`}>
                  {e.name}
                </Link>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
