import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alarm, Clock, Eye, EyeSlash, Pause, Play } from '@phosphor-icons/react'
import { db, type GameClock, type GameTime, type World } from './db'
import { addDays, cleanCalendar, formatDate } from './calendar'
import { Help } from './help'
import { Ico } from './icons'
import { LecternPanel } from './lecternPanel'
import { useNow } from './atTheTable'
import { worldPath } from './paths'
import { toast } from './undo'
import './gameClock.css'

/**
 * The in-game clock: the time of day in the world, on the Clocks page and at the Lectern. The GM sets
 * it and lets it run at any speed (or "reach 21:00 in 1½ real hours"), and can show it on players'
 * screens as a clock face or 24-hour digital. Only a starting point is saved (World.gmScreen.gameClock,
 * see GameTime), so every screen works the time out for itself and nothing needs saving each second.
 * While it's shown, World.gameTime holds a copy without the GM's alarm: that's what players get.
 */

const DAY = 86400
const PLACES = ['tl', 'tr', 'bl', 'br', 'full'] as const
const MAX_RATE = 100_000
/** Speeds in game minutes for each real minute. */
const SPEEDS: { rate: number; label: string }[] = [
  { rate: 1, label: 'Real time' },
  { rate: 10, label: '1 min = 10 min' },
  { rate: 60, label: '1 min = 1 hour' },
]

const num = (v: unknown, or: number) => (typeof v === 'number' && Number.isFinite(v) ? v : or)
const clampRate = (r: number) => Math.min(MAX_RATE, Math.max(0.01, r))
const tidy = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
const pad = (n: number) => String(n).padStart(2, '0')
const mod = (n: number, m: number) => ((n % m) + m) % m

/** A clock as saved, read carefully (it may come from an old backup or another device). */
function readTime(raw: unknown): GameTime | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<GameTime>
  return tidy({
    secs: num(r.secs, 8 * 3600),
    at: num(r.at, Date.now()),
    rate: clampRate(num(r.rate, 1)),
    running: r.running === true,
    until: typeof r.until === 'number' && Number.isFinite(r.until) ? r.until : undefined,
    look: r.look === 'digital' ? ('digital' as const) : ('face' as const),
    place: PLACES.includes(r.place as (typeof PLACES)[number]) ? r.place : 'br',
  })
}

function readClock(raw: unknown): GameClock | null {
  const t = readTime(raw)
  if (!t) return null
  const r = raw as Partial<GameClock>
  const alarm = r.alarm && typeof r.alarm.secs === 'number' && Number.isFinite(r.alarm.secs) ? tidy({ secs: r.alarm.secs, label: typeof r.alarm.label === 'string' ? r.alarm.label : undefined }) : undefined
  return tidy({ ...t, shown: r.shown === true || undefined, alarm })
}

/** A new clock: 8 in the morning, stopped, at real time. */
const fresh = (): GameClock => ({ secs: 8 * 3600, at: Date.now(), rate: 1, running: false, look: 'face', place: 'br' })

/** Game seconds (after midnight of the world's date) at real time `now`. */
function secsAt(t: GameTime, now = Date.now()) {
  if (!t.running) return t.secs
  const s = t.secs + (Math.max(0, now - t.at) / 1000) * t.rate
  return t.until !== undefined && t.until > t.secs ? Math.min(s, t.until) : s
}

/** "14:32". */
const hhmm = (secs: number) => {
  const d = mod(Math.floor(secs), DAY)
  return `${pad(Math.floor(d / 3600))}:${pad(Math.floor((d % 3600) / 60))}`
}

/** Day from 6 in the morning to 6 in the evening. */
const isDay = (secs: number) => {
  const h = mod(secs, DAY) / 3600
  return h >= 6 && h < 18
}

/** "1 min = 10 min", "1 min = 2 hours". */
function speedWords(rate: number) {
  const preset = SPEEDS.find((s) => s.rate === rate)
  if (preset) return preset.label
  if (rate >= 60) {
    const h = Math.round((rate / 60) * 10) / 10
    return `1 min = ${h} hour${h === 1 ? '' : 's'}`
  }
  const m = Math.round(rate * 100) / 100
  return `1 min = ${m} min`
}

/** The world's date at this point on the clock (the clock counts on past midnight until the date is moved). */
function dateAt(world: Pick<World, 'calendar'>, secs: number) {
  const c = cleanCalendar(world.calendar)
  if (!c?.today) return ''
  return formatDate(c, addDays(c, c.today, Math.floor(secs / DAY)))
}

/** The clock as saved now, with its starting point moved up to `now` (so a new speed starts from here). */
function fromNow(c: GameClock, now: number): GameClock {
  return { ...c, secs: secsAt(c, now), at: now }
}

/** Past midnight (or back before it): the world's date moves on (or back) and the clock counts from the new midnight. */
function settle(w: World, c: GameClock): GameClock {
  const days = Math.floor(c.secs / DAY)
  if (!days) return c
  const cal = cleanCalendar(w.calendar)
  if (cal?.today) w.calendar = { ...cal, today: addDays(cal, cal.today, days) }
  const less = days * DAY
  return tidy({ ...c, secs: c.secs - less, until: c.until === undefined ? undefined : c.until - less, alarm: c.alarm && { ...c.alarm, secs: c.alarm.secs - less } })
}

/** What players get: the clock without the GM's alarm. */
const forPlayers = (c: GameClock): GameTime => tidy({ secs: c.secs, at: c.at, rate: c.rate, running: c.running, until: c.until, look: c.look, place: c.place })

/** Change the clock. `fn` gets it as it stands right now; players' copy follows while it's shown. */
export function editClock(worldId: string, fn: (c: GameClock) => GameClock) {
  return db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      const now = Date.now()
      const c = settle(w, tidy(fn(fromNow(readClock(w.gmScreen?.gameClock) ?? fresh(), now))))
      w.gmScreen = { pages: [], rolls: [], ...w.gmScreen, gameClock: c }
      w.gameTime = c.shown ? forPlayers(c) : null
      w.updatedAt = now
    })
}

/** The next time the clock shows hh:mm (in game seconds, the same count as the clock). */
function nextAt(from: number, hours: number, minutes: number) {
  const day = Math.floor(from / DAY) * DAY
  let t = day + hours * 3600 + minutes * 60
  if (t <= from) t += DAY
  return t
}

const parseTime = (v: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(v)
  return m ? { h: Math.min(23, Number(m[1])), m: Math.min(59, Number(m[2])) } : null
}

/** Stops the clock if it's running (a session marked played). Says whether it was. */
export async function pauseGameClock(worldId: string) {
  const w = await db.worlds.get(worldId)
  const c = readClock(w?.gmScreen?.gameClock)
  if (!c?.running) return false
  await editClock(worldId, (x) => ({ ...x, running: false }))
  return true
}

/** A short chime for the GM's alarm (quiet if the browser won't play sound yet). Also used by the Lectern's timers. */
export function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)
    osc.onended = () => void ctx.close()
  } catch {
    // No sound available: the message still shows.
  }
}

/** Re-draws as the clock moves: often enough for the minute hand at high speeds, once a second otherwise. */
function useTicking(t: GameTime | null) {
  const every = t?.running ? Math.max(100, Math.min(1000, 15_000 / t.rate)) : 1000
  useNow(every, !!t?.running)
  return t ? secsAt(t) : 0
}

/**
 * On the GM's own device, wherever they are in the app: moves the world's date on at midnight, stops
 * the clock at the time it was asked to reach, and rings the GM's alarm.
 */
export function GameClockWatcher({ world }: { world: World }) {
  const c = readClock(world.gmScreen?.gameClock)
  useTicking(c)
  const busy = useRef(false)
  const s = c ? secsAt(c) : 0
  const due = !!c && (s >= DAY || s < 0 || (c.running && c.until !== undefined && s >= c.until) || (!!c.alarm && s >= c.alarm.secs))
  useEffect(() => {
    if (!due || busy.current) return
    busy.current = true
    let reached: number | undefined
    let rang: GameClock['alarm']
    editClock(world.id, (x) => {
      let next = x
      if (next.running && next.until !== undefined && next.secs >= next.until) {
        reached = next.until
        next = { ...next, secs: next.until, running: false, until: undefined }
      }
      if (next.alarm && next.secs >= next.alarm.secs) {
        rang = next.alarm
        next = { ...next, alarm: undefined }
      }
      return next
    })
      .then(() => {
        if (rang) {
          beep()
          toast(`In-game alarm: it’s ${hhmm(rang.secs)}${rang.label ? `. ${rang.label}` : ''}`)
        } else if (reached !== undefined) toast(`The in-game time reached ${hhmm(reached)} and stopped.`)
      })
      .finally(() => (busy.current = false))
  }, [due, world.id])
  return null
}

/** A clock face: 12 hours, with a sun by day and a moon by night. */
export function ClockDial({ secs, size = 120 }: { secs: number; size?: number | string }) {
  const d = mod(secs, DAY)
  const hour = ((d / 3600) % 12) * 30
  const minute = ((d % 3600) / 3600) * 360
  const day = isDay(d)
  return (
    <svg className="game-dial" width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={`${hhmm(d)}, ${day ? 'day' : 'night'}`}>
      <circle cx="100" cy="100" r="94" className="dial-rim" />
      {Array.from({ length: 60 }, (_, i) => (
        <line key={i} x1="100" y1={i % 5 ? 12 : 10} x2="100" y2={i % 5 ? 18 : 26} className={i % 5 ? 'tick' : 'tick big'} transform={`rotate(${i * 6} 100 100)`} />
      ))}
      {[12, 3, 6, 9].map((n) => {
        const a = (n / 12) * Math.PI * 2
        return (
          <text key={n} x={100 + Math.sin(a) * 62} y={100 - Math.cos(a) * 62} className="dial-num" textAnchor="middle" dominantBaseline="central">
            {n}
          </text>
        )
      })}
      <g transform="translate(100 136)" className={day ? 'dial-sun' : 'dial-moon'}>
        {day ? (
          <>
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1="0" y1="-13" x2="0" y2="-17" transform={`rotate(${i * 45})`} />
            ))}
            <circle r="9" />
          </>
        ) : (
          <path d="M 3 -11 A 11 11 0 1 0 3 11 A 8.5 11 0 0 1 3 -11 Z" />
        )}
      </g>
      <line x1="100" y1="100" x2="100" y2="52" className="hand hour" transform={`rotate(${hour} 100 100)`} />
      <line x1="100" y1="100" x2="100" y2="28" className="hand minute" transform={`rotate(${minute} 100 100)`} />
      <circle cx="100" cy="100" r="6" className="dial-pin" />
    </svg>
  )
}

/** The time as players see it: a face or digital, with the world's date under it. */
export function GameTimeView({ time, world, size, className = '', noDate }: { time: GameTime; world: Pick<World, 'calendar'>; size?: number | string; className?: string; noDate?: boolean }) {
  const secs = useTicking(time)
  const date = noDate ? '' : dateAt(world, secs)
  return (
    <div className={`game-time look-${time.look ?? 'face'} ${className}`}>
      {time.look === 'digital' ? (
        <span className="game-digital" role="img" aria-label={hhmm(secs)}>
          {hhmm(secs)}
        </span>
      ) : (
        <ClockDial secs={secs} size={size} />
      )}
      {date && <span className="game-date">{date}</span>}
    </div>
  )
}

/** Players' screen for a TV: the clock in a corner over what's shown, or filling the screen. */
export function ScreenClock({ world, alone }: { world: World; alone: boolean }) {
  const time = readTime(world.gameTime)
  if (!time) return null
  if (alone || time.place === 'full') return <GameTimeView time={time} world={world} size="min(62vh, 80vw)" className="screen-clock-full" />
  return <GameTimeView time={time} world={world} size="clamp(110px, 14vw, 240px)" className={`screen-clock-corner at-${time.place}`} />
}

/** For players (the Common Room, the Clocks page): the time in the world, while the GM shows it. */
export function GameTimeBar({ world }: { world: World }) {
  const time = readTime(world.gameTime)
  if (!time) return null
  return (
    <div className="game-time-bar card">
      <GameTimeView time={time} world={world} size={56} noDate />
      <span className="game-time-words">
        <span className="small muted">
          In-game time <Help topic="gameTimePlayers" />
        </span>
        <BarDate world={world} time={time} />
      </span>
    </div>
  )
}

function BarDate({ world, time }: { world: World; time: GameTime }) {
  const date = dateAt(world, useTicking(time))
  return date ? <span className="small">{date}</span> : null
}

// ——— The GM's controls ———

function RunButton({ worldId, c }: { worldId: string; c: GameClock }) {
  return (
    <button className={c.running ? '' : 'primary'} onClick={() => editClock(worldId, (x) => ({ ...x, running: !x.running }))}>
      <Ico as={c.running ? Pause : Play} /> {c.running ? 'Pause' : 'Run'}
    </button>
  )
}

function SpeedPicker({ worldId, c }: { worldId: string; c: GameClock }) {
  const preset = SPEEDS.some((s) => s.rate === c.rate)
  const [other, setOther] = useState(!preset)
  const [typed, setTyped] = useState(preset ? '' : String(Math.round(c.rate * 100) / 100))
  const setRate = (rate: number) => editClock(worldId, (x) => ({ ...x, rate: clampRate(rate), until: undefined }))
  const saveTyped = () => {
    const n = Number(typed)
    if (n > 0) void setRate(n)
  }
  return (
    <span className="row wrap game-speed">
      <select
        aria-label="Speed"
        value={other ? 'other' : preset ? String(c.rate) : 'other'}
        onChange={(e) => {
          if (e.target.value === 'other') return setOther(true)
          setOther(false)
          void setRate(Number(e.target.value))
        }}
      >
        {SPEEDS.map((s) => (
          <option key={s.rate} value={s.rate}>
            {s.label}
          </option>
        ))}
        <option value="other">{preset ? 'Your own speed…' : `${speedWords(c.rate)} (your own)`}</option>
      </select>
      {other && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            saveTyped()
          }}
        >
          <label className="small">
            1 real minute ={' '}
            <input type="number" min="0.01" step="any" className="game-num" value={typed} onChange={(e) => setTyped(e.target.value)} onBlur={saveTyped} aria-label="Game minutes for each real minute" placeholder="5" />{' '}
            game minutes
          </label>
        </form>
      )}
    </span>
  )
}

const JUMPS = [
  { label: '−10 min', secs: -600 },
  { label: '+10 min', secs: 600 },
  { label: '+1 hour', secs: 3600 },
  { label: '+8 hours', secs: 8 * 3600 },
]

function Jumps({ worldId, few }: { worldId: string; few?: boolean }) {
  return (
    <span className="row wrap">
      {(few ? JUMPS.slice(0, 3) : JUMPS).map((j) => (
        <button key={j.label} className="small" onClick={() => editClock(worldId, (x) => ({ ...x, secs: x.secs + j.secs, until: x.until !== undefined && x.secs + j.secs >= x.until ? undefined : x.until }))}>
          {j.label}
        </button>
      ))}
    </span>
  )
}

function ShowToggle({ worldId, c }: { worldId: string; c: GameClock }) {
  return (
    <button
      className={c.shown ? 'on' : ''}
      aria-pressed={!!c.shown}
      title={c.shown ? 'The in-game time is on the players’ screen and their phones now. Press to take it off.' : 'Put the in-game time on the players’ screen and their phones'}
      onClick={() => editClock(worldId, (x) => ({ ...x, shown: !x.shown || undefined }))}
    >
      <Ico as={c.shown ? EyeSlash : Eye} /> {c.shown ? 'Stop showing' : 'Show players'}
    </button>
  )
}

/** "Heading for 21:00, there at 1:05 am", while the clock is on its way to a time. */
function Heading({ worldId, c }: { worldId: string; c: GameClock }) {
  if (c.until === undefined) return null
  const when = c.running ? new Date(c.at + ((c.until - c.secs) / c.rate) * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <p className="small game-heading">
      Heading for <strong>{hhmm(c.until)}</strong> at {speedWords(c.rate)}
      {when ? `, there at ${when} your time` : ' (paused)'}. It stops when it gets there.{' '}
      <button className="ghost small" onClick={() => editClock(worldId, (x) => ({ ...x, until: undefined }))}>
        Cancel
      </button>
    </p>
  )
}

/** The GM's clock on the Clocks page: everything. */
export function GameClockCard({ world }: { world: World }) {
  const c = readClock(world.gmScreen?.gameClock) ?? fresh()
  const secs = useTicking(c)
  const [time, setTime] = useState('')
  const [goal, setGoal] = useState('')
  const [hours, setHours] = useState('1')
  const [mins, setMins] = useState('30')
  const [alarmAt, setAlarmAt] = useState('')
  const [alarmLabel, setAlarmLabel] = useState('')
  const id = world.id
  const date = dateAt(world, secs)
  return (
    <section className="card game-clock">
      <div className="section-header">
        <h2>
          <Ico as={Clock} /> In-game time <Help topic="gameClock" />
        </h2>
        <ShowToggle worldId={id} c={c} />
      </div>
      <div className="game-clock-body">
        <div className="game-clock-now">
          {c.look === 'digital' ? <span className="game-digital">{hhmm(secs)}</span> : <ClockDial secs={secs} size={150} />}
          {date && <span className="game-date">{date}</span>}
          <span className="muted small">{c.running ? speedWords(c.rate) : 'Stopped'}</span>
        </div>
        <div className="game-clock-controls">
          <div className="row wrap">
            <RunButton worldId={id} c={c} />
            <SpeedPicker key={c.rate} worldId={id} c={c} />
          </div>
          <Jumps worldId={id} />
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault()
              const t = parseTime(time)
              if (!t) return
              void editClock(id, (x) => {
                const secs = t.h * 3600 + t.m * 60
                return { ...x, secs, until: x.until !== undefined && secs < x.until ? x.until : undefined }
              })
              setTime('')
            }}
          >
            <label className="small">
              Set the time to <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Set the time to" />
            </label>
            <button className="small" disabled={!parseTime(time)}>
              Set
            </button>
          </form>
          <form
            className="row wrap"
            onSubmit={(e) => {
              e.preventDefault()
              const t = parseTime(goal)
              const real = (Number(hours) || 0) * 3600 + (Number(mins) || 0) * 60
              if (!t || real <= 0) return
              void editClock(id, (x) => {
                const until = nextAt(x.secs, t.h, t.m)
                return { ...x, running: true, until, rate: clampRate((until - x.secs) / real) }
              })
              setGoal('')
            }}
          >
            <label className="small">
              Reach <input type="time" value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Reach this game time" />
            </label>
            <label className="small">
              in <input type="number" min="0" className="game-num" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Real hours" /> h{' '}
              <input type="number" min="0" max="59" className="game-num" value={mins} onChange={(e) => setMins(e.target.value)} aria-label="Real minutes" /> min real time
            </label>
            <button className="small" disabled={!parseTime(goal) || (Number(hours) || 0) * 60 + (Number(mins) || 0) <= 0}>
              Go
            </button>
          </form>
          <Heading worldId={id} c={c} />
          {c.alarm ? (
            <p className="small game-alarm">
              <Ico as={Alarm} /> Alarm at <strong>{hhmm(c.alarm.secs)}</strong>
              {c.alarm.label && `: ${c.alarm.label}`} <span className="muted">(only you hear it)</span>{' '}
              <button className="ghost small" aria-label="Remove the alarm" onClick={() => editClock(id, (x) => ({ ...x, alarm: undefined }))}>
                ×
              </button>
            </p>
          ) : (
            <form
              className="row wrap"
              onSubmit={(e) => {
                e.preventDefault()
                const t = parseTime(alarmAt)
                if (!t) return
                void editClock(id, (x) => ({ ...x, alarm: tidy({ secs: nextAt(x.secs, t.h, t.m), label: alarmLabel.trim() || undefined }) }))
                setAlarmAt('')
                setAlarmLabel('')
              }}
            >
              <label className="small">
                <Ico as={Alarm} /> Alarm at <input type="time" value={alarmAt} onChange={(e) => setAlarmAt(e.target.value)} aria-label="Alarm at" />
              </label>
              <input className="small" value={alarmLabel} onChange={(e) => setAlarmLabel(e.target.value)} placeholder="What happens? e.g. The ritual completes" aria-label="What happens at the alarm" />
              <button className="small" disabled={!parseTime(alarmAt)}>
                Set alarm
              </button>
            </form>
          )}
          <div className="row wrap">
            <span className="small muted">On players’ screens:</span>
            <span className="row" role="group" aria-label="How it looks">
              {(['face', 'digital'] as const).map((look) => (
                <button key={look} className={`small ${c.look === look ? 'on' : ''}`} aria-pressed={c.look === look} onClick={() => editClock(id, (x) => ({ ...x, look }))}>
                  {look === 'face' ? 'Clock face' : 'Digital 24-hour'}
                </button>
              ))}
            </span>
            <select aria-label="Where on the players’ screen" value={c.place ?? 'br'} onChange={(e) => editClock(id, (x) => ({ ...x, place: e.target.value as GameTime['place'] }))}>
              <option value="br">Bottom right corner</option>
              <option value="bl">Bottom left corner</option>
              <option value="tr">Top right corner</option>
              <option value="tl">Top left corner</option>
              <option value="full">Fill the screen</option>
            </select>
          </div>
          <p className="muted small">
            In a corner it sits over whatever you’re showing; with nothing else up, it fills the screen.{' '}
            <Link to={`/screen${worldPath(id).slice(2)}`} target="_blank">
              Open the players’ screen
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}

/** At the Lectern: the clock with the controls used mid-scene. */
export function GameClockPanel({ world }: { world: World }) {
  const c = readClock(world.gmScreen?.gameClock) ?? fresh()
  const secs = useTicking(c)
  const date = dateAt(world, secs)
  return (
    <LecternPanel
      id="gametime"
      sectionId="lectern-gametime"
      name="In-game time"
      keywords="clock time hour day night speed alarm"
      title={<><Ico as={Clock} /> <Link to={`${worldPath(world.id)}/clocks`}>In-game time</Link> <Help topic="gameClock" /></>}
    >
      <div className="game-clock-strip">
        <span className="game-clock-mini">
          <strong className="game-digital">{hhmm(secs)}</strong>
          {date && <span className="muted small">{date}</span>}
        </span>
        <RunButton worldId={world.id} c={c} />
        <SpeedPicker key={c.rate} worldId={world.id} c={c} />
        <Jumps worldId={world.id} few />
        <ShowToggle worldId={world.id} c={c} />
      </div>
      <Heading worldId={world.id} c={c} />
      {c.alarm && (
        <p className="small muted">
          <Ico as={Alarm} /> {hhmm(c.alarm.secs)}
          {c.alarm.label && `: ${c.alarm.label}`}
        </p>
      )}
    </LecternPanel>
  )
}
