import { newId, type Combatant, type Encounter, type EncounterFoe, type Entity, type LecternState } from './db'

const field = (e: Entity, pattern: RegExp) => e.fields.find((f) => pattern.test(f.key.trim()))?.value
export const fieldOf = field

export const numberFrom = (text: string | undefined) => {
  const m = text?.match(/\d+/)
  return m ? Number(m[0]) : null
}

export const detailKey = (k: string) => k.trim().toLowerCase()
const norm = detailKey

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A character's value for a detail, by name. Without a detail of that name, a number written after
 * the name inside a longer detail counts too, so "AC" finds 15 in a stat line like "AC 15 (leather), HP 13".
 */
export function detailOf(e: Entity, key: string) {
  const own = e.fields.find((f) => norm(f.key) === norm(key))?.value
  if (own !== undefined) return own
  const k = key.trim()
  if (!k) return ''
  const re = new RegExp(`(?:^|[\\s,;(])${escape(k)}\\s*:?\\s*([+-]?\\d+)`, 'i')
  for (const f of e.fields) {
    const m = f.value.match(re)
    if (m) return m[1]
  }
  return ''
}

// A field named for it, else the number written after "HP" or "AC" in a longer stat line ("5e: AC 15 (leather), HP 13"), GM fields included: this is the GM's screen.
const hpOf = (e: Entity) => numberFrom(field(e, /^(hp|hit points|health)$/i)) ?? numberFrom(detailOf(e, 'HP')) ?? numberFrom(detailOf(e, 'Hit points'))
const acOf = (e: Entity) => field(e, /^(ac|armou?r class|armou?r|defen[cs]e|evasion)$/i) || detailOf(e, 'AC') || undefined

/** A combatant made from a page, with HP and AC read from its Details if it has them. */
export function fromEntity(e: Entity): Omit<Combatant, 'id'> {
  const hp = hpOf(e)
  return { name: e.name, init: null, hp, maxHp: hp, ac: acOf(e), side: e.type === 'pc' ? 'pc' : 'foe', conditions: [], entityId: e.id }
}

/** A planned foe made from a page. */
export function foeFromEntity(e: Entity): EncounterFoe {
  return { id: newId(), name: e.name, count: 1, hp: hpOf(e), ac: acOf(e), side: e.type === 'pc' ? 'pc' : 'foe', entityId: e.id }
}

/** Initiative order: highest first, unrolled at the bottom, ties keep the order they were added. */
export const initiativeOrder = (cs: Combatant[]) => [...cs].sort((a, b) => (b.init ?? -Infinity) - (a.init ?? -Infinity))

/** Adds combatants to the Lectern; two goblins become "Goblin" and "Goblin 2". */
export function addCombatants(l: LecternState, cs: Omit<Combatant, 'id'>[]) {
  for (const c of cs) {
    let name = c.name
    for (let n = 2; l.combat.combatants.some((x) => x.name === name); n++) name = `${c.name} ${n}`
    l.combat.combatants.push({ ...c, name, id: newId() })
  }
}

/** Everyone in a planned encounter, as combatants ready for initiative. */
export function encounterCombatants(enc: Encounter): Omit<Combatant, 'id'>[] {
  return enc.foes.flatMap((f) =>
    Array.from({ length: Math.min(Math.max(1, f.count), 30) }, () => ({
      name: f.name,
      init: null,
      hp: f.hp ?? null,
      maxHp: f.hp ?? null,
      ac: f.ac || undefined,
      side: f.side,
      conditions: [],
      entityId: f.entityId,
    })),
  )
}

export const foeCount = (enc: Encounter) => enc.foes.reduce((n, f) => n + Math.max(1, f.count), 0)
