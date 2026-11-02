import { db, type Entity, type Pin } from './db'
import { stripSecrets } from './Markdown'
import { plainLinks } from './text'

/**
 * A map's numbered key, the way published adventures key a dungeon ("4. The ossuary"): each pin
 * and linked piece gets a number, shown on the map, with a key beside it listing number, name and
 * one line. Numbers are kept on the pins, so they stay put as pins are added and revealed; the
 * first numbering goes through what players can see first, so their copy starts at 1 with no gaps.
 * GM-only entries are left out of the players' copy (on screen, in the picture and on paper).
 */

/** Where a pin sits, in picture pixels [x, y] from the top left (pins are stored as [y up, x]). */
export function pinCentre(p: Pin, H: number): [number, number] | undefined {
  const at = p.position ?? (p.points?.length ? ([p.points.reduce((n, q) => n + q[0], 0) / p.points.length, p.points.reduce((n, q) => n + q[1], 0) / p.points.length] as [number, number]) : undefined)
  return at && [at[1], H - at[0]]
}

/** Reading order: top to bottom in rows about a twentieth of the map tall, then left to right. */
function reading(pins: Pin[], H: number) {
  const band = Math.max(1, H / 20)
  return [...pins].sort((a, b) => {
    const [ax, ay] = pinCentre(a, H) ?? [0, 0]
    const [bx, by] = pinCentre(b, H) ?? [0, 0]
    return Math.floor(ay / band) - Math.floor(by / band) || ax - bx
  })
}

/**
 * Gives numbers to the map's pins that have none, after the highest one used (or, with `again`,
 * numbers every pin afresh): what players can see first, then the GM's own, each in reading order.
 */
export async function numberPins(mapId: string, H: number, again = false) {
  const pins = await db.pins.where({ mapId }).toArray()
  const todo = again ? pins : pins.filter((p) => !p.number)
  if (!todo.length) return
  let next = again ? 1 : Math.max(0, ...pins.map((p) => p.number ?? 0)) + 1
  const order = [...reading(todo.filter((p) => p.visibility === 'players'), H), ...reading(todo.filter((p) => p.visibility !== 'players'), H)]
  await db.transaction('rw', db.pins, async () => {
    for (const p of order) await db.pins.update(p.id, { number: next++ })
  })
}

export interface KeyEntry {
  n: number
  pin: Pin
  title: string
  line: string
  /** Picture pixels from the top left. */
  at?: [number, number]
}

/** The key: numbered pins the viewer can see (the caller passes only those), in number order, with a name and one line each. */
export function mapKey(pins: Pin[], entities: Entity[], H: number, showSecrets: boolean): KeyEntry[] {
  const byId = new Map(entities.map((e) => [e.id, e]))
  return pins
    .filter((p) => p.number)
    .sort((a, b) => a.number! - b.number!)
    .map((p) => {
      const e = p.entityId ? byId.get(p.entityId) : undefined
      const note = plainLinks(showSecrets ? p.note : stripSecrets(p.note))
        .split('\n')
        .map((l) => l.replace(/[#>*_`~|]+/g, '').trim())
        .find(Boolean)
      const line = (e?.summary || note || '').trim()
      return { n: p.number!, pin: p, title: p.label || e?.name || 'Pin', line: line.length > 110 ? `${line.slice(0, 108).trim()}…` : line, at: pinCentre(p, H) }
    })
}
