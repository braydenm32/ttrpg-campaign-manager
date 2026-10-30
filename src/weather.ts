import type { CalDate, Climate, Season, SeasonFeel, Weather, WorldCalendar } from './db'
import { rollDie } from './dice'
import { toDays } from './calendar'

/**
 * Seasons and the day's weather. A calendar can name its seasons (each from the day it starts);
 * the weather is rolled from the season's feel and the world's climate, and comes with a note
 * when it matters on the road (fog, a blizzard, a gale).
 */

export const CLIMATES: { id: Climate; label: string }[] = [
  { id: 'cold', label: 'Cold (northlands, mountains)' },
  { id: 'temperate', label: 'Temperate' },
  { id: 'warm', label: 'Warm (southern coasts)' },
  { id: 'desert', label: 'Desert' },
  { id: 'tropical', label: 'Tropical (jungle, islands)' },
]

export const FEELS: { id: SeasonFeel; label: string; icon: string }[] = [
  { id: 'winter', label: 'Winter', icon: '❄️' },
  { id: 'spring', label: 'Spring', icon: '🌱' },
  { id: 'summer', label: 'Summer', icon: '☀️' },
  { id: 'autumn', label: 'Autumn', icon: '🍂' },
]

/** The usual four seasons, placed on a calendar's ordinary months (festivals skipped) like Earth's. */
export function usualSeasons(c: WorldCalendar): Season[] {
  const ordinary = c.months.map((m, i) => ({ m, i })).filter(({ m }) => !m.festival && m.days > 0).map(({ i }) => i)
  const n = ordinary.length
  if (!n) return []
  const at = (twelfths: number) => ordinary[Math.round((twelfths * n) / 12) % n]
  return [
    { name: 'Spring', month: at(2), day: 1, feel: 'spring' },
    { name: 'Summer', month: at(5), day: 1, feel: 'summer' },
    { name: 'Autumn', month: at(8), day: 1, feel: 'autumn' },
    { name: 'Winter', month: at(11), day: 1, feel: 'winter' },
  ]
}

/** The season a date falls in: the last one started by then, or last year's final one. */
export function seasonOn(c: WorldCalendar, d: CalDate): Season | undefined {
  const list = c.seasons ?? []
  if (!list.length) return undefined
  const dayOf = (month: number, day: number) => toDays(c, { year: d.year, month, day }) - toDays(c, { year: d.year, month: 0, day: 1 })
  const today = dayOf(d.month, d.day)
  const sorted = [...list].sort((a, b) => dayOf(a.month, a.day) - dayOf(b.month, b.day))
  return [...sorted].reverse().find((s) => dayOf(s.month, s.day) <= today) ?? sorted[sorted.length - 1]
}

export const seasonIcon = (s: Season) => FEELS.find((f) => f.id === s.feel)?.icon ?? ''

const TEMPS = ['bitterly cold', 'freezing', 'cold', 'chilly', 'cool', 'mild', 'warm', 'hot', 'sweltering']
/** Where each climate sits on TEMPS in winter, spring, summer and autumn. */
const BASE: Record<Climate, Record<SeasonFeel, number>> = {
  cold: { winter: 0, spring: 2, summer: 4, autumn: 2 },
  temperate: { winter: 2, spring: 4, summer: 6, autumn: 4 },
  warm: { winter: 4, spring: 5, summer: 7, autumn: 5 },
  desert: { winter: 4, spring: 6, summer: 8, autumn: 6 },
  tropical: { winter: 6, spring: 7, summer: 7, autumn: 7 },
}
/** How wet a climate is, as a weight on rain. */
const WET: Record<Climate, number> = { cold: 1, temperate: 1.2, warm: 0.8, desert: 0.15, tropical: 2 }

function pick<T>(options: [T, number][]): T {
  const total = options.reduce((n, [, w]) => n + w, 0)
  let r = Math.random() * total
  for (const [o, w] of options) if ((r -= w) < 0) return o
  return options[0][0]
}

/** Rolls a day's weather for a season (winter if unknown) and climate (temperate if unset). */
export function rollWeather(feel: SeasonFeel = 'winter', climate: Climate = 'temperate'): Weather {
  const shift = rollDie(6)
  const t = Math.max(0, Math.min(TEMPS.length - 1, BASE[climate][feel] + (shift === 1 ? -1 : shift === 6 ? 1 : 0)))
  const wet = WET[climate] * (feel === 'summer' ? 0.7 : feel === 'winter' && climate === 'tropical' ? 0.5 : 1)
  const snowy = t <= 1
  const sleety = t === 2
  const sky = pick<string>([
    ['clear skies', climate === 'desert' ? 6 : 3],
    ['scattered clouds', 3],
    ['overcast', 2],
    ['fog', climate === 'desert' ? 0 : feel === 'autumn' || feel === 'spring' ? 1.2 : 0.6],
    [snowy ? 'light snow' : sleety ? 'sleet' : 'light rain', 2 * wet],
    [snowy ? 'heavy snow' : 'heavy rain', 1 * wet],
    [snowy ? 'blizzard' : t >= 5 ? 'thunderstorm' : 'storm', 0.4 * wet + (feel === 'summer' && t >= 6 ? 0.4 : 0)],
    ['sandstorm', climate === 'desert' ? 0.6 : 0],
  ])
  const wind = pick<string>([
    ['still air', 3],
    ['a light breeze', 4],
    ['strong wind', 2],
    ['a gale', 0.5],
  ])
  const notes: string[] = []
  let slow = false
  if (sky === 'blizzard' || sky === 'sandstorm' || sky === 'heavy snow' || wind === 'a gale') {
    slow = true
    notes.push('travel at half pace')
  }
  if (sky === 'fog' || sky === 'blizzard' || sky === 'sandstorm') notes.push('can’t see far; easy to get lost')
  if (sky === 'thunderstorm' || sky === 'storm') notes.push('find shelter or get soaked')
  if (sky === 'heavy rain') notes.push('roads turn to mud')
  if (t === 0 || t === TEMPS.length - 1) notes.push('risk of exhaustion without shelter or water')
  const temp = TEMPS[t]
  const text = `${temp.charAt(0).toUpperCase()}${temp.slice(1)}, ${sky}, ${wind}${notes.length ? ` (${notes.join('; ')})` : ''}.`
  return { text, slow: slow || undefined }
}

/** The day's weather for a world on a date: its season's feel and the world's climate. */
export function weatherFor(c: WorldCalendar | undefined, d: CalDate | undefined, climate: Climate | undefined): Weather {
  const season = c && d ? seasonOn(c, d) : undefined
  return { ...rollWeather(season?.feel ?? 'spring', climate), on: d }
}
