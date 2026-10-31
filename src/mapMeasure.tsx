import { useState } from 'react'
import { db, type MapScale, type WorldMap } from './db'
import { Help } from './help'
import { toast } from './undo'

/**
 * Map scale, the ruler and travel time. The GM tells a map how far it is across (or measures a
 * known distance and names it), then anyone can measure a route on it and see how long the
 * journey takes on foot, by horse, by wagon or by ship. Battle maps drawn in the app already know
 * their scale: one grid square is 5 feet.
 */

export const UNITS = ['miles', 'km', 'leagues', 'ft', 'm'] as const
/** Units for overland travel, where days on the road make sense. */
export const OVERLAND = ['miles', 'km', 'leagues']
/** Miles in one of each unit. */
const IN_MILES: Record<string, number> = { miles: 1, km: 0.621371, leagues: 3, ft: 1 / 5280, m: 0.000621371 }

/** How far a group goes in a day, in miles (about 8 hours on the road; ships sail on through the night). */
export const PACES = [
  { id: 'foot', label: 'On foot', perDay: 24 },
  { id: 'hurry', label: 'Hurrying', perDay: 30 },
  { id: 'horse', label: 'Riding', perDay: 40 },
  { id: 'wagon', label: 'Wagon', perDay: 18 },
  { id: 'ship', label: 'Sailing ship', perDay: 48 },
  { id: 'flying', label: 'Flying mount', perDay: 80 },
] as const
export type PaceId = (typeof PACES)[number]['id']

/** The scale a map uses: the GM's, or for a battle map drawn here, 5 ft a square. */
export function scaleOf(map: WorldMap): MapScale | undefined {
  if (map.scale && map.scale.pixels > 0 && map.scale.distance > 0) return map.scale
  const d = map.drawing
  if (d?.scene === 'battle' && d.gridSize > 0) return { pixels: d.gridSize, distance: 5, unit: 'ft' }
  return undefined
}

/** Length of a path in image pixels. Points are [y, x], like pins. */
export function pathPixels(points: [number, number][]) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  return total
}

export const toDistance = (pixels: number, scale: MapScale) => (pixels / scale.pixels) * scale.distance

/** "42 miles", "1.5 km", "35 ft". */
export function distanceText(d: number, unit: string) {
  const n = d >= 100 ? Math.round(d) : d >= 10 ? Math.round(d * 10) / 10 : Math.round(d * 100) / 100
  return `${n.toLocaleString()} ${unit === 'miles' && n === 1 ? 'mile' : unit === 'leagues' && n === 1 ? 'league' : unit}`
}

/** "half a day", "1 day", "2½ days", "3 weeks". */
export function daysText(days: number) {
  if (days < 0.15) return 'a couple of hours'
  if (days < 0.35) return 'a few hours'
  if (days < 0.7) return 'half a day'
  if (days < 1.15) return '1 day'
  if (days < 14) {
    const whole = Math.floor(days)
    const frac = days - whole
    const half = frac >= 0.25 && frac < 0.75
    const n = frac >= 0.75 ? whole + 1 : whole
    return `${half ? `${whole}½` : n} days`
  }
  const weeks = Math.round((days / 7) * 2) / 2
  return `${weeks % 1 ? `${Math.floor(weeks)}½` : weeks} weeks`
}

/** Days for a distance at a pace, when the map's unit is an overland one. */
export function travelDays(d: number, unit: string, pace: PaceId) {
  if (!OVERLAND.includes(unit)) return undefined
  const miles = d * IN_MILES[unit]
  return miles / PACES.find((p) => p.id === pace)!.perDay
}

/** A day's travel at a pace, in a distance unit (miles, km or leagues). */
export function paceIn(pace: string, unit: string) {
  const p = PACES.find((x) => x.id === pace) ?? PACES[0]
  return p.perDay / (IN_MILES[unit] ?? 1)
}

/** The ruler's readout: distance, and for overland maps how long it takes at each pace. */
export function MeasureBar({
  map,
  points,
  isGM,
  onUndo,
  onClear,
  onJourney,
}: {
  map: WorldMap
  points: [number, number][]
  isGM: boolean
  onUndo: () => void
  onClear: () => void
  /** Starts a journey at the Lectern with this distance (GM, overland maps). */
  onJourney?: (distance: number, unit: string) => void
}) {
  const scale = scaleOf(map)
  const px = pathPixels(points)
  const [naming, setNaming] = useState(false)
  const [known, setKnown] = useState('')
  const [unit, setUnit] = useState<string>(scale?.unit ?? 'miles')
  const d = scale ? toDistance(px, scale) : 0
  const overland = !!scale && OVERLAND.includes(scale.unit)
  return (
    <div className="map-toolbar measure-bar">
      <strong>Ruler</strong> <Help topic="ruler" />
      {points.length < 2 ? (
        <span className="muted small">Click points along the route. Double-click or press Clear to start again.</span>
      ) : scale ? (
        <>
          <span className="measure-total">{distanceText(d, scale.unit)}</span>
          {scale.unit === 'ft' && map.drawing?.scene === 'battle' && <span className="muted small">({Math.round(px / scale.pixels)} squares)</span>}
          {overland && (
            <span className="measure-paces small">
              {PACES.map((p) => (
                <span key={p.id}>
                  {p.label}: <b>{daysText(travelDays(d, scale.unit, p.id)!)}</b>
                </span>
              ))}
            </span>
          )}
          {isGM && overland && onJourney && (
            <button className="small" onClick={() => onJourney(d, scale.unit)} title="Plan a journey of this length at the Lectern">
              Make it a journey
            </button>
          )}
        </>
      ) : (
        <span className="muted small">{isGM ? 'This map has no scale yet. Name the length of this line to set one:' : 'Your GM hasn’t set this map’s scale yet.'}</span>
      )}
      {points.length >= 2 && isGM && (
        naming || !scale ? (
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault()
              const n = Number(known)
              if (!(n > 0) || !(px > 0)) return
              await db.maps.update(map.id, { scale: { pixels: px, distance: n, unit } })
              setNaming(false)
              setKnown('')
            }}
          >
            <span className="small">This line is</span>
            <input className="hp-input" type="number" min={0} step="any" value={known} onChange={(e) => setKnown(e.target.value)} aria-label="Its real length" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <button className="primary" disabled={!(Number(known) > 0)}>
              Set scale
            </button>
          </form>
        ) : (
          <button className="ghost small" onClick={() => setNaming(true)} title="Measure something you know the length of, and name it, to set the map’s scale">
            Set scale from this line
          </button>
        )
      )}
      <button onClick={onUndo} disabled={!points.length}>
        Undo point
      </button>
      <button onClick={onClear} disabled={!points.length}>
        Clear
      </button>
    </div>
  )
}

/** In Map settings: how far the whole map is across, as a quick way to set the scale. */
export function ScaleSetting({ map }: { map: WorldMap }) {
  const scale = scaleOf(map)
  const across = scale ? toDistance(map.width, scale) : 0
  const [value, setValue] = useState(scale ? String(Math.round(across * 100) / 100) : '')
  const [unit, setUnit] = useState<string>(scale?.unit ?? 'miles')
  const save = (v: string, u: string) => {
    const n = Number(v)
    if (n > 0) void db.maps.update(map.id, { scale: { pixels: map.width, distance: n, unit: u } })
  }
  return (
    <label>
      <span>
        Scale <Help topic="mapScale" />
      </span>
      <span className="row wrap">
        <span className="small">From left to right, the map is</span>
        <input
          className="hp-input"
          type="number"
          min={0}
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save(value, unit)}
          aria-label="How far across"
        />
        <select
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value)
            save(value, e.target.value)
          }}
          aria-label="Unit"
        >
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <span className="small">across</span>
      </span>
      {map.scale && (
        <button
          type="button"
          className="link small"
          onClick={async () => {
            const was = map.scale
            await db.maps.update(map.id, { scale: undefined })
            toast('Scale removed.', () => db.maps.update(map.id, { scale: was }))
          }}
        >
          Remove the scale
        </button>
      )}
    </label>
  )
}
