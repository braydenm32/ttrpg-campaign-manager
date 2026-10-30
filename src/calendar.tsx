import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Help } from './help'
import { db, type CalDate, type Entity, type Session, type World, type WorldCalendar } from './db'
import { Ico } from './icons'
import { CalendarBlank, CloudSun, Confetti, DiceFive } from '@phosphor-icons/react'
import { pagePath, worldPath } from './paths'
import { DraftText } from './components'
import { CLIMATES, FEELS, seasonIcon, seasonOn, usualSeasons, weatherFor } from './weather'

/**
 * In-world calendars: month and day names, the era after the year, and moons. Dates are stored as
 * { year, month, day } and turned into a day count for sorting, weekdays and moon phases.
 * Leap years add days to chosen months (or bring in a leap-year-only festival) every so many years.
 */

const months = (list: [string, number][]) => list.map(([name, days]) => ({ name, days }))

export const CALENDAR_PRESETS: Record<string, { label: string; calendar: WorldCalendar }> = {
  harptos: {
    label: 'Forgotten Realms (Harptos)',
    calendar: {
      preset: 'harptos',
      months: months([
        ['Hammer', 30], ['Midwinter', 1], ['Alturiak', 30], ['Ches', 30], ['Tarsakh', 30], ['Greengrass', 1], ['Mirtul', 30], ['Kythorn', 30],
        ['Flamerule', 30], ['Midsummer', 1], ['Shieldmeet', 0], ['Eleasis', 30], ['Eleint', 30], ['Highharvestide', 1], ['Marpenoth', 30], ['Uktar', 30],
        ['Feast of the Moon', 1], ['Nightal', 30],
      ]).map((m) => (m.days <= 1 ? { ...m, festival: true, leapDays: m.name === 'Shieldmeet' ? 1 : undefined } : m)),
      // Shieldmeet, the day after Midsummer, comes every fourth year.
      leapEvery: 4,
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
      ]).map((m) => (m.name === 'Calistril' ? { ...m, leapDays: 1 } : m)),
      // Calistril gets a 29th day every eighth year.
      leapEvery: 8,
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
      ]).map((m) => (m.days === 7 ? { ...m, festival: true } : m)),
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
      ]).map((m) => (m.name === 'February' ? { ...m, leapDays: 1 } : m)),
      leapEvery: 4,
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

/** A month's days in an ordinary year. Only a leap-year-only festival can have none. */
const baseDays = (m: WorldCalendar['months'][number]) => (m.leapDays ? Math.max(0, m.days) : Math.max(1, m.days))

/** Whether a year is a leap year (every leapEvery years, counting from year 0). */
export function isLeap(c: WorldCalendar, year: number) {
  const every = Math.round(c.leapEvery ?? 0)
  return every > 0 && ((year % every) + every) % every === 0
}

/** How many days a month has in a given year (0 for a leap-year festival in an ordinary year). */
export function monthDays(c: WorldCalendar, month: number, year: number) {
  const m = c.months[month]
  if (!m) return 0
  return baseDays(m) + (isLeap(c, year) ? Math.max(0, m.leapDays ?? 0) : 0)
}

/** Days in an ordinary (not leap) year. */
export const yearLength = (c: WorldCalendar) => c.months.reduce((n, m) => n + baseDays(m), 0) || 1
const leapExtra = (c: WorldCalendar) => (Math.round(c.leapEvery ?? 0) > 0 ? c.months.reduce((n, m) => n + Math.max(0, m.leapDays ?? 0), 0) : 0)

/** Days since day 1 of year 0. */
export function toDays(c: WorldCalendar, d: CalDate) {
  const extra = leapExtra(c)
  // Leap years before this one: 0, every, 2 × every… (and the same counting back before year 0).
  const leaps = extra ? Math.ceil(d.year / Math.round(c.leapEvery!)) : 0
  let n = d.year * yearLength(c) + leaps * extra
  for (let i = 0; i < Math.min(d.month, c.months.length); i++) n += monthDays(c, i, d.year)
  return n + d.day - 1
}

export function fromDays(c: WorldCalendar, n: number): CalDate {
  const extra = leapExtra(c)
  const start = (year: number) => toDays(c, { year, month: 0, day: 1 })
  let year = Math.floor(n / (yearLength(c) + (extra ? extra / Math.round(c.leapEvery!) : 0)))
  while (start(year) > n) year--
  while (start(year + 1) <= n) year++
  let rest = n - start(year)
  for (let month = 0; month < c.months.length; month++) {
    const days = monthDays(c, month, year)
    if (rest < days) return { year, month, day: rest + 1 }
    rest -= days
  }
  return { year, month: 0, day: 1 }
}

/** The named days (holidays) falling on a date. */
export const holidaysOn = (c: WorldCalendar, d: CalDate) => (c.holidays ?? []).filter((h) => h.month === d.month && h.day === d.day).map((h) => h.name)

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
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
  // One-day months and festivals read better without a day number; longer festivals count their days.
  const day = monthDays(c, d.month, d.year) <= 1 ? m.name : m.festival ? `${ordinal(d.day)} day of ${m.name}` : `${d.day} ${m.name}`
  return `${wd ? `${wd}, ` : ''}${day} ${d.year}${c.era ? ` ${c.era}` : ''}`
}

/** Pick a year, month and day on the world's calendar. */
export function CalDateInput({ calendar, value, onChange }: { calendar: WorldCalendar; value?: CalDate; onChange: (d: CalDate | undefined) => void }) {
  const d = value ?? calendar.today ?? { year: 1, month: 0, day: 1 }
  // A leap-year-only festival in an ordinary year moves on to the next month.
  const fit = (x: CalDate): CalDate => {
    for (let i = 0; i < calendar.months.length; i++) {
      const month = (x.month + i) % calendar.months.length
      const days = monthDays(calendar, month, x.year)
      if (days > 0) return { ...x, month, day: Math.min(Math.max(1, i ? 1 : x.day), days) }
    }
    return x
  }
  return (
    <span className="row cal-input">
      <select value={value ? d.day : ''} onChange={(e) => onChange(e.target.value ? { ...d, day: Number(e.target.value) } : undefined)} aria-label="Day">
        <option value="">Day</option>
        {Array.from({ length: Math.max(1, monthDays(calendar, d.month, d.year)) }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      <select
        value={value ? d.month : ''}
        onChange={(e) => {
          if (e.target.value === '') return onChange(undefined)
          onChange(fit({ ...d, month: Number(e.target.value) }))
        }}
        aria-label="Month"
      >
        <option value="">Month</option>
        {calendar.months.map((m, i) =>
          monthDays(calendar, i, d.year) > 0 || i === d.month ? (
            <option key={i} value={i}>
              {m.name}
            </option>
          ) : null,
        )}
      </select>
      <input
        type="number"
        className="year-input"
        value={value ? d.year : ''}
        placeholder="Year"
        onChange={(e) => onChange(e.target.value === '' ? undefined : fit({ ...d, year: Math.round(Number(e.target.value)) }))}
        aria-label="Year"
      />
      {calendar.era && <span className="muted">{calendar.era}</span>}
    </span>
  )
}

/**
 * Takes a month out of the calendar. Dates store the month's place in the list, so everything dated
 * after it is moved up to keep reading the same month; anything dated inside it loses its calendar date
 * (a date written by hand stays), and holidays in it go.
 */
async function removeMonth(world: World, c: WorldCalendar, i: number) {
  const events = await db.entities.where({ worldId: world.id }).filter((e) => !!e.eventWhen && e.eventWhen.month >= i).toArray()
  const sessions = await db.sessions.where({ worldId: world.id }).filter((x) => !!x.worldDate && x.worldDate.month >= i).toArray()
  const inside = events.filter((e) => e.eventWhen!.month === i).length + sessions.filter((x) => x.worldDate!.month === i).length
  const later = events.length + sessions.length - inside
  const holidays = (c.holidays ?? []).filter((h) => h.month === i).length
  const note = [
    inside && `${inside} dated event${inside === 1 ? '' : 's'} or session${inside === 1 ? '' : 's'} in it will lose their calendar date`,
    holidays && `${holidays} holiday${holidays === 1 ? '' : 's'} in it will be removed`,
    later && `${later} later date${later === 1 ? '' : 's'} will be moved up so they keep their month`,
  ].filter(Boolean)
  if (!confirm(`Remove the month “${c.months[i].name}”?${note.length ? ` ${note.join('; ')}.` : ''}`)) return
  const up = (d: CalDate): CalDate => (d.month > i ? { ...d, month: d.month - 1 } : d)
  const last = c.months.length - 2
  await db.transaction('rw', [db.worlds, db.entities, db.sessions], async () => {
    for (const e of events) await db.entities.update(e.id, { eventWhen: e.eventWhen!.month === i ? undefined : up(e.eventWhen!) })
    for (const x of sessions) await db.sessions.update(x.id, { worldDate: x.worldDate!.month === i ? undefined : up(x.worldDate!) })
    await db.worlds.update(world.id, {
      calendar: {
        ...c,
        months: c.months.filter((_, j) => j !== i),
        holidays: c.holidays?.filter((h) => h.month !== i).map((h) => ({ ...h, month: h.month > i ? h.month - 1 : h.month })),
        today: c.today && (c.today.month === i ? { ...c.today, month: Math.min(i, last), day: 1 } : up(c.today)),
      },
      updatedAt: Date.now(),
    })
  })
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
              <DraftText value={c.era ?? ''} onCommit={(era) => change({ era })} placeholder="e.g. DR" />
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
              Months and festivals ({c.months.length}, {yearLength(c)} days a year{leapExtra(c) ? `, ${yearLength(c) + leapExtra(c)} in a leap year` : ''})
            </summary>
            <label className="inline-check small">
              Leap year every
              <input
                type="number"
                min={0}
                className="year-input"
                value={c.leapEvery ?? 0}
                onChange={(e) => change({ leapEvery: Math.max(0, Math.round(Number(e.target.value) || 0)) || undefined })}
                aria-label="Leap year every how many years"
              />
              years (0 for none) <Help topic="leapYears" />
            </label>
            {c.months.map((m, i) => (
              <div key={i} className="row field-row wrap">
                <DraftText value={m.name} onCommit={(name) => change({ months: c.months.map((x, j) => (j === i ? { ...x, name } : x)) })} aria-label="Month name" />
                <input
                  type="number"
                  min={m.leapDays ? 0 : 1}
                  className="year-input"
                  value={m.days}
                  onChange={(e) => change({ months: c.months.map((x, j) => (j === i ? { ...x, days: Math.max(x.leapDays ? 0 : 1, Number(e.target.value) || 0) } : x)) })}
                  aria-label="Days"
                />
                <span className="muted small">days</span>
                {!!c.leapEvery && (
                  <>
                    <span className="muted small">+</span>
                    <input
                      type="number"
                      min={0}
                      className="year-input"
                      value={m.leapDays ?? 0}
                      onChange={(e) =>
                        change({
                          months: c.months.map((x, j) => {
                            if (j !== i) return x
                            const leapDays = Math.max(0, Math.round(Number(e.target.value) || 0)) || undefined
                            return { ...x, leapDays, days: leapDays ? x.days : Math.max(1, x.days) }
                          }),
                        })
                      }
                      aria-label="Extra days in a leap year"
                      title="Extra days in a leap year"
                    />
                    <span className="muted small">in a leap year</span>
                  </>
                )}
                <label className="inline-check small" title="A festival between months: its days read “Midwinter” or “3rd day of Needfest”">
                  <input type="checkbox" checked={!!m.festival} onChange={(e) => change({ months: c.months.map((x, j) => (j === i ? { ...x, festival: e.target.checked || undefined } : x)) })} />
                  festival
                </label>
                <button type="button" className="ghost" disabled={c.months.length < 2} onClick={() => removeMonth(world, c, i)}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => change({ months: [...c.months, { name: `Month ${c.months.length + 1}`, days: 30 }] })}>
              + Month
            </button>
          </details>
          <details>
            <summary>Holidays ({c.holidays?.length ?? 0})</summary>
            <p className="muted small">Named days that come round every year. They show with the date and on the calendar.</p>
            {(c.holidays ?? []).map((h, i) => (
              <div key={i} className="row field-row wrap">
                <DraftText value={h.name} onCommit={(name) => change({ holidays: c.holidays!.map((x, j) => (j === i ? { ...x, name } : x)) })} aria-label="Holiday name" />
                <select value={h.day} onChange={(e) => change({ holidays: c.holidays!.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)) })} aria-label="Day">
                  {Array.from({ length: Math.max(1, baseDays(c.months[h.month] ?? { name: '', days: 1 }) + (c.months[h.month]?.leapDays ?? 0)) }, (_, d) => (
                    <option key={d} value={d + 1}>
                      {d + 1}
                    </option>
                  ))}
                </select>
                <select value={h.month} onChange={(e) => change({ holidays: c.holidays!.map((x, j) => (j === i ? { ...x, month: Number(e.target.value), day: 1 } : x)) })} aria-label="Month">
                  {c.months.map((m, j) => (
                    <option key={j} value={j}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="ghost" onClick={() => change({ holidays: c.holidays!.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => change({ holidays: [...(c.holidays ?? []), { name: 'Holiday', month: c.today?.month ?? 0, day: c.today?.day ?? 1 }] })}>
              + Holiday
            </button>
          </details>
          <details>
            <summary>Seasons and weather ({c.seasons?.length ?? 0} seasons)</summary>
            <p className="muted small">
              Each season runs from the day it starts until the next one. The season and the climate decide the weather you roll. <Help topic="seasons" />
            </p>
            <label className="inline-check small">
              Climate
              <select value={world.climate ?? 'temperate'} onChange={(e) => db.worlds.update(world.id, { climate: e.target.value as never, updatedAt: Date.now() })}>
                {CLIMATES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            {(c.seasons ?? []).map((s, i) => (
              <div key={i} className="row field-row wrap">
                <DraftText value={s.name} onCommit={(name) => change({ seasons: c.seasons!.map((x, j) => (j === i ? { ...x, name } : x)) })} aria-label="Season name" />
                <span className="muted small">starts</span>
                <select value={s.day} onChange={(e) => change({ seasons: c.seasons!.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) } : x)) })} aria-label="Day">
                  {Array.from({ length: Math.max(1, baseDays(c.months[s.month] ?? { name: '', days: 1 })) }, (_, d) => (
                    <option key={d} value={d + 1}>
                      {d + 1}
                    </option>
                  ))}
                </select>
                <select value={s.month} onChange={(e) => change({ seasons: c.seasons!.map((x, j) => (j === i ? { ...x, month: Number(e.target.value), day: 1 } : x)) })} aria-label="Month">
                  {c.months.map((m, j) => (
                    <option key={j} value={j}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <span className="muted small">weather like</span>
                <select value={s.feel} onChange={(e) => change({ seasons: c.seasons!.map((x, j) => (j === i ? { ...x, feel: e.target.value as never } : x)) })} aria-label="Weather like">
                  {FEELS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.icon} {f.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="ghost" onClick={() => change({ seasons: c.seasons!.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
            ))}
            <div className="row wrap">
              <button type="button" onClick={() => change({ seasons: [...(c.seasons ?? []), { name: 'Season', month: c.today?.month ?? 0, day: 1, feel: 'spring' }] })}>
                + Season
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => (!c.seasons?.length || confirm('Replace your seasons with the usual four?')) && change({ seasons: usualSeasons(c) })}
              >
                Use the usual four
              </button>
            </div>
          </details>
          <details>
            <summary>Moons ({c.moons.length})</summary>
            {c.moons.map((m, i) => (
              <div key={i} className="row field-row">
                <DraftText value={m.name} onCommit={(name) => change({ moons: c.moons.map((x, j) => (j === i ? { ...x, name } : x)) })} aria-label="Moon name" />
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
                <span className="muted small">full on</span>
                <CalDateInput
                  calendar={c}
                  value={fromDays(c, Math.round(m.offset))}
                  onChange={(d) => d && change({ moons: c.moons.map((x, j) => (j === i ? { ...x, offset: toDays(c, d) } : x)) })}
                />
                <button
                  type="button"
                  className="small"
                  title="Make today a full moon"
                  onClick={() => c.today && change({ moons: c.moons.map((x, j) => (j === i ? { ...x, offset: toDays(c, c.today!) } : x)) })}
                >
                  Today
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

/** Days from a date to the same day number in the next ordinary month (festivals and leap-only months are skipped, short months clamp). */
function daysToNextMonth(c: WorldCalendar, d: CalDate) {
  let m = d.month
  let y = d.year
  for (let tries = 0; tries <= c.months.length; tries++) {
    m++
    if (m >= c.months.length) {
      m = 0
      y++
    }
    if (!c.months[m].festival && monthDays(c, m, y) > 0) break
  }
  const len = monthDays(c, m, y)
  return len ? Math.max(1, toDays(c, { year: y, month: m, day: Math.min(d.day, len) }) - toDays(c, d)) : 30
}

/** Today's date in the world, its moons, and (for the GM) buttons to move time on. */
export function WorldToday({ world, isGM }: { world: World; isGM: boolean }) {
  const c = world.calendar
  if (!c?.today) return null
  const days = toDays(c, c.today)
  const move = (n: number) => db.worlds.update(world.id, { calendar: { ...c, today: addDays(c, c.today!, n) }, updatedAt: Date.now() })
  const week = c.weekdays.length || 10
  const season = seasonOn(c, c.today)
  const weather = world.weather
  const stale = weather?.on && toDays(c, weather.on) !== days
  return (
    <div className="world-today">
      <span>
        <Ico as={CalendarBlank} /> <strong>{formatDate(c, c.today)}</strong> <Help topic="worldToday" />
      </span>
      {season && (
        <span className="small">
          {seasonIcon(season)} {season.name}
        </span>
      )}
      {weather?.text && (
        <span className={`small weather${stale ? ' muted' : ''}`} title={stale ? `Rolled for ${formatDate(c, weather.on, false)}` : 'Today’s weather'}>
          <Ico as={CloudSun} /> {stale && 'Last: '}
          {weather.text}
        </span>
      )}
      {isGM && (
        <button className="ghost small" onClick={() => db.worlds.update(world.id, { weather: weatherFor(c, c.today, world.climate), updatedAt: Date.now() })} title="Roll today’s weather from the season and climate. Players see it.">
          <Ico as={CloudSun} /> {weather ? 'Reroll weather' : 'Roll weather'}
        </button>
      )}
      {holidaysOn(c, c.today).map((h) => (
        <span key={h} className="holiday small">
          <Ico as={Confetti} /> {h}
        </span>
      ))}
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
          <button className="small" onClick={() => move(daysToNextMonth(c, c.today!))} title="The same day of the next month">
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
  const days = Math.max(1, monthDays(c, at.month, at.year))
  const cols = c.weekdays.length || 10
  const first = toDays(c, { year: at.year, month: at.month, day: 1 })
  const lead = c.weekdays.length ? (((first + (c.weekdayOffset ?? 0)) % cols) + cols) % cols : 0
  const step = (dir: 1 | -1) => {
    let m = at.month
    let y = at.year
    // Skip a leap-year-only festival in an ordinary year.
    for (let tries = 0; tries <= c.months.length; tries++) {
      m += dir
      if (m < 0) {
        m = c.months.length - 1
        y--
      } else if (m >= c.months.length) {
        m = 0
        y++
      }
      if (monthDays(c, m, y) > 0) break
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
          {month.festival && <span className="muted small"> · festival</span>}
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
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1
          const evs = events.filter((e) => on(e.eventWhen, day))
          const ses = sessions.filter((s) => on(s.worldDate, day))
          const named = holidaysOn(c, { year: at.year, month: at.month, day })
          return (
            <div key={day} className={`month-day ${isToday(day) ? 'today' : ''} ${month.festival ? 'festival' : ''}`}>
              <span className="month-num">{day}</span>
              {named.map((h) => (
                <span key={h} className="month-item holiday">
                  <Ico as={Confetti} /> {h}
                </span>
              ))}
              {ses.map((s) => (
                <Link key={s.id} className="month-item session" to={`${worldPath(world.id)}/s/${s.id}`}>
                  <Ico as={DiceFive} /> #{s.number}
                </Link>
              ))}
              {evs.map((e) => (
                <Link key={e.id} className="month-item" to={`${pagePath(world.id, e.id)}`}>
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
