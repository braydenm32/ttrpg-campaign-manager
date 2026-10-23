import { newId, type Combatant, type Encounter, type EncounterFoe, type Entity, type LecternState } from './db'

const field = (e: Entity, pattern: RegExp) => e.fields.find((f) => pattern.test(f.key.trim()))?.value
export const fieldOf = field

export const numberFrom = (text: string | undefined) => {
  const m = text?.match(/\d+/)
  return m ? Number(m[0]) : null
}

const hpOf = (e: Entity) => numberFrom(field(e, /^(hp|hit points|health)$/i))
const acOf = (e: Entity) => field(e, /^(ac|armou?r class|armou?r|defen[cs]e|evasion)$/i)

/** A combatant made from a page, with HP and AC read from its Details if it has them. */
export function fromEntity(e: Entity): Omit<Combatant, 'id'> {
  const hp = hpOf(e)
  return { name: e.name, init: null, hp, maxHp: hp, ac: acOf(e), side: e.type === 'pc' ? 'pc' : 'foe', conditions: [], entityId: e.id }
}

/** A planned foe made from a page. */
export function foeFromEntity(e: Entity): EncounterFoe {
  return { id: newId(), name: e.name, count: 1, hp: hpOf(e), ac: acOf(e), side: e.type === 'pc' ? 'pc' : 'foe', entityId: e.id }
}

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
