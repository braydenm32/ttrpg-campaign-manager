import { useState } from 'react'
import { Path } from '@phosphor-icons/react'
import { db, type Entity, type Journey, type LecternState, type World } from './db'
import { rollDie } from './dice'
import { Help } from './help'
import { Ico } from './icons'
import { LecternPanel } from './lecternPanel'
import { Markdown } from './Markdown'
import { addDays, formatDate } from './calendar'
import { rollOnTable } from './tables'
import { daysText, distanceText, OVERLAND, PACES, paceIn } from './mapMeasure'
import { weatherFor } from './weather'

/**
 * Journeys at the Lectern: how far, how fast, then one click per day on the road. Each day moves
 * the world's date on, rolls the weather (bad weather halves the day's travel), checks for an
 * encounter on one of the GM's tables and counts down rations.
 */

type Edit = (fn: (l: LecternState) => void) => unknown

export interface SavedRoute {
  distance: number
  unit: string
  /** The map it was measured on. */
  from: string
}

const routeKey = (worldId: string) => `atlas.lastRoute.${worldId}`

/** Keeps a route measured on a map (this browser tab only) for the Lectern's journey panel. */
export function saveRoute(worldId: string, route: SavedRoute) {
  try {
    sessionStorage.setItem(routeKey(worldId), JSON.stringify(route))
  } catch {
    // Storage is off: the GM can type the distance in instead.
  }
}

export function loadRoute(worldId: string): SavedRoute | undefined {
  try {
    const r = JSON.parse(sessionStorage.getItem(routeKey(worldId)) ?? 'null') as SavedRoute | null
    return r && r.distance > 0 && OVERLAND.includes(r.unit) ? r : undefined
  } catch {
    return undefined
  }
}

const round = (n: number) => Math.round(n * 10) / 10

export function JourneyPanel({ world, lectern, edit, entities, partySize }: { world: World; lectern: LecternState; edit: Edit; entities: Entity[]; partySize: number }) {
  const j = lectern.journey
  const tables = entities.filter((e) => e.type === 'table')
  return (
    <LecternPanel
      id="journey"
      name="Journey"
      keywords="travel road trip days weather pace rations encounter overland"
      title={
        <>
          <Ico as={Path} /> Journey <Help topic="journey" />
        </>
      }
      extra={j ? <span className="muted small">Day {j.days.length}</span> : undefined}
    >
      {j ? <OnTheRoad world={world} j={j} edit={edit} tables={tables} entities={entities} partySize={partySize} /> : <PlanJourney world={world} edit={edit} tables={tables} />}
    </LecternPanel>
  )
}

function PlanJourney({ world, edit, tables }: { world: World; edit: Edit; tables: Entity[] }) {
  const [route] = useState(() => loadRoute(world.id))
  const [to, setTo] = useState('')
  const [distance, setDistance] = useState('')
  const [unit, setUnit] = useState('miles')
  const [pace, setPace] = useState('foot')
  const [tableId, setTableId] = useState('')
  const [chance, setChance] = useState('6')
  const [rations, setRations] = useState('')
  const d = Number(distance)
  return (
    <form
      className="form journey-plan"
      onSubmit={(e) => {
        e.preventDefault()
        if (!(d > 0)) return
        edit(
          (l) =>
            void (l.journey = {
              to: to.trim() || 'the road ahead',
              distance: d,
              unit,
              pace,
              travelled: 0,
              encounterTableId: tableId || undefined,
              encounterChance: tableId ? Math.max(1, Number(chance) || 6) : undefined,
              rations: rations === '' ? undefined : Math.max(0, Math.round(Number(rations))),
              days: [],
            }),
        )
      }}
    >
      {route && (
        <button type="button" className="small" onClick={() => (setDistance(String(round(route.distance))), setUnit(route.unit))}>
          Use the route you measured on {route.from}: {distanceText(route.distance, route.unit)}
        </button>
      )}
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Where to? (Cinderford)" aria-label="Where to" />
      <div className="row wrap">
        <input className="hp-input" type="number" min={0} step="any" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="How far" aria-label="How far" />
        <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
          {OVERLAND.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select value={pace} onChange={(e) => setPace(e.target.value)} aria-label="Pace">
          {PACES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {d > 0 && <p className="muted small">About {daysText(d / paceIn(pace, unit))} at this pace, in good weather.</p>}
      <div className="row wrap small">
        <span>Encounters from</span>
        <select value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label="Encounter table">
          <option value="">{tables.length ? 'no table (none)' : 'no tables yet'}</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {tableId && (
          <>
            <span>a 1 in</span>
            <input className="hp-input" type="number" min={1} value={chance} onChange={(e) => setChance(e.target.value)} aria-label="Chance each day: 1 in" />
            <span>chance each day</span>
          </>
        )}
      </div>
      <label className="row small">
        Rations (optional)
        <input className="hp-input" type="number" min={0} value={rations} onChange={(e) => setRations(e.target.value)} aria-label="Rations" />
      </label>
      <button className="primary" disabled={!(d > 0)}>
        Set off
      </button>
    </form>
  )
}

function OnTheRoad({ world, j, edit, tables, entities, partySize }: { world: World; j: Journey; edit: Edit; tables: Entity[]; entities: Entity[]; partySize: number }) {
  const c = world.calendar
  const arrived = j.travelled >= j.distance - 1e-6
  const left = Math.max(0, j.distance - j.travelled)
  const perDay = paceIn(j.pace, j.unit)
  const table = tables.find((t) => t.id === j.encounterTableId)

  /** One day passes: on the road (moving) or in camp. */
  const nextDay = async (moving: boolean) => {
    const today = c?.today ? addDays(c, c.today, 1) : undefined
    const weather = weatherFor(c, today ?? c?.today, world.climate)
    await db.worlds.update(world.id, { ...(c && today ? { calendar: { ...c, today } } : {}), weather, updatedAt: Date.now() })
    const went = moving ? Math.min(left, perDay * (weather.slow ? 0.5 : 1)) : 0
    const encounter = table && j.encounterChance && rollDie(j.encounterChance) === 1 ? rollOnTable(table, tables) : undefined
    edit((l) => {
      const now = l.journey
      if (!now) return
      now.travelled += went
      if (now.rations !== undefined) now.rations = Math.max(0, now.rations - Math.max(1, partySize))
      now.days = [...now.days, { n: now.days.length + 1, date: c && today ? formatDate(c, today, false) : undefined, went, weather: weather.text, encounter }]
    })
  }

  const undo = async () => {
    const last = j.days[j.days.length - 1]
    if (!last) return
    if (c?.today) await db.worlds.update(world.id, { calendar: { ...c, today: addDays(c, c.today, -1) }, updatedAt: Date.now() })
    edit((l) => {
      const now = l.journey
      if (!now) return
      now.travelled = Math.max(0, now.travelled - last.went)
      if (now.rations !== undefined) now.rations += Math.max(1, partySize)
      now.days = now.days.slice(0, -1)
    })
  }

  return (
    <div className="journey">
      <div className="row spread wrap">
        <strong>To {j.to}</strong>
        <select value={j.pace} onChange={(e) => edit((l) => void (l.journey && (l.journey.pace = e.target.value)))} aria-label="Pace">
          {PACES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="journey-progress" aria-label={`${Math.round((j.travelled / j.distance) * 100)}% of the way`}>
        <span style={{ width: `${Math.min(100, (j.travelled / j.distance) * 100)}%` }} />
      </div>
      <p className="small">
        {distanceText(j.travelled, j.unit)} of {distanceText(j.distance, j.unit)}
        {!arrived && <span className="muted"> · {distanceText(left, j.unit)} to go, about {daysText(left / perDay)}</span>}
        {j.rations !== undefined && (
          <span className={j.rations < Math.max(1, partySize) ? 'error' : 'muted'}>
            {' '}
            · {j.rations} ration{j.rations === 1 ? '' : 's'} left
          </span>
        )}
      </p>
      {arrived ? (
        <p className="notice small">
          Arrived at {j.to} after {j.days.length} day{j.days.length === 1 ? '' : 's'}.
        </p>
      ) : (
        <div className="row wrap">
          <button className="primary" onClick={() => nextDay(true)} title="Move the date on a day, roll the weather and any encounter">
            Next day on the road
          </button>
          <button onClick={() => nextDay(false)} title="A day spent in camp: the date, weather and encounter roll, but no distance">
            Rest a day
          </button>
        </div>
      )}
      <div className="row wrap">
        {j.days.length > 0 && (
          <button className="ghost small" onClick={undo} title="Take back the last day (and move the date back)">
            Undo last day
          </button>
        )}
        <button className="ghost small" onClick={() => (arrived || confirm('End this journey? Its log is cleared.')) && edit((l) => void (l.journey = undefined))}>
          End journey
        </button>
      </div>
      {j.days.length > 0 && (
        <ol className="journey-log" reversed>
          {[...j.days].reverse().map((d) => (
            <li key={d.n}>
              <div className="small">
                <b>Day {d.n}</b>
                {d.date && <span className="muted"> · {d.date}</span>} · {d.went ? distanceText(d.went, j.unit) : 'in camp'}
              </div>
              {d.weather && <div className="muted small">{d.weather}</div>}
              {d.encounter && (
                <div className="journey-encounter small">
                  <b>Encounter:</b> <Markdown text={d.encounter} entities={entities} worldId={world.id} showSecrets />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
