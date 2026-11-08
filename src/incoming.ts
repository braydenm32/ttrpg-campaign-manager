import { cleanCalendar } from './calendar'
import { cleanDrawing } from './mapDrawing'
import type { WorldMap } from './db'

/**
 * Worlds and maps that come from outside this device (a backup someone else made, or another
 * device's copy through sync), made safe to keep before they're saved. One odd value must not be
 * able to stop the app or a world from opening, or run anything: the calendar and a map's drawing
 * are cleaned (see cleanCalendar and cleanDrawing), names are text, and the world's lists and
 * settings are lists and settings. What the app itself made comes back the same.
 */

type Loose = Record<string, unknown>
const isLoose = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
/** The world's lists, and what each holds. */
const LISTS = { customTypes: isLoose, partyFields: (x: unknown) => typeof x === 'string', partyCoin: isLoose, ages: isLoose, handouts: isLoose }
const SETTINGS = ['gmScreen', 'safety', 'weather', 'showing', 'spread'] as const

export function cleanWorld<T extends object>(world: T): T {
  const w = world as unknown as Loose
  const out: Loose = { ...w, name: text(w.name) }
  for (const k of ['description', 'system'] as const) if (w[k] !== undefined && typeof w[k] !== 'string') out[k] = text(w[k])
  if (w.coverId !== undefined && typeof w.coverId !== 'string') delete out.coverId
  for (const [k, ok] of Object.entries(LISTS)) {
    const v = w[k]
    if (Array.isArray(v)) out[k] = v.filter(ok)
    else if (v !== undefined) delete out[k]
  }
  for (const k of SETTINGS) if (w[k] != null && !isLoose(w[k])) delete out[k]
  if (w.calendar !== undefined) out.calendar = cleanCalendar(w.calendar)
  return out as unknown as T
}

export function cleanMap<T extends object>(map: T): T {
  const drawing = (map as Partial<WorldMap>).drawing
  return drawing === undefined ? map : { ...map, drawing: cleanDrawing(drawing) }
}
