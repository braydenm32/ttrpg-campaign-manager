import type { Entity } from './db'

/*
 * Where a page sits. Every page has one `parentId`, and it can point at one of two things:
 *  - a place (a location or a shop): a person in a tavern, a quest in a town, a town in a region;
 *  - a page of its own kind: a faction under a faction, lore under lore, an item under an item.
 * Walking up `parentId` gives the trail at the top of a page, so a sub-faction of a guild based in
 * Cinderford reads "Factions › Cinderford › The Guild". Players get `parentId` only when they can
 * see the page it points at (the server's player_view and useVisibleEntities both drop it).
 */

type Kind = Pick<Entity, 'type' | 'customType'>

/** Places can hold a page of any kind. */
export const isPlace = (e: Kind) => e.type === 'location' || e.type === 'shop'

/** Two pages of the same kind (for your own page types, the same one of them). */
export const sameKind = (a: Kind, b: Kind) => a.type === b.type && (a.type !== 'custom' || (a.customType ?? '') === (b.customType ?? ''))

/** Whether `child` may sit in or under `parent`: any page in a place, or under a page of its own kind. */
export const canHold = (parent: Kind, child: Kind) => isPlace(parent) || sameKind(parent, child)

/** "Part of" a page of its own kind (a sub-faction), as against "located in" a place. Places keep "Inside". */
export const isPartOf = (parent: Kind, child: Kind) => sameKind(parent, child) && child.type !== 'location'

/** The page and every page below it, however deep (what it can't be put under, so nothing loops). */
export function withBelow(id: string, entities: Pick<Entity, 'id' | 'parentId'>[]) {
  const below = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const x of entities) {
      if (!x.parentId || !below.has(x.parentId) || below.has(x.id)) continue
      below.add(x.id)
      grew = true
    }
  }
  return below
}

/** The pages above this one, nearest first (stops at a loop in old data, and after 12). */
export function above(e: Entity, byId: Map<string, Entity>) {
  const out: Entity[] = []
  for (let p = e.parentId ? byId.get(e.parentId) : undefined; p && p.id !== e.id && out.length < 12 && !out.includes(p); p = p.parentId ? byId.get(p.parentId) : undefined) out.push(p)
  return out
}

/** The nearest place above a page (for a sub-faction, where its faction is). */
export const placeAbove = (e: Entity, byId: Map<string, Entity>) => above(e, byId).find(isPlace)

/**
 * Where `child` goes when the page it sat under goes away or stops being able to hold it: the first
 * page above `from` (from included) that can hold it, or the top of its list. Never `child` itself.
 */
export function newHome(child: Kind & { id: string }, from: string | undefined, byId: Map<string, Entity>, skip?: string) {
  const seen = new Set<string>()
  for (let p = from ? byId.get(from) : undefined; p && !seen.has(p.id); p = p.parentId ? byId.get(p.parentId) : undefined) {
    seen.add(p.id)
    if (p.id !== child.id && p.id !== skip && canHold(p, child)) return p.id
  }
  return undefined
}

/**
 * After a page changes kind: where it and the pages under it now go. Its own parent stays if it can
 * still hold it, else it moves up to the nearest page that can. Pages under it stay if it can still
 * hold them (a place holds anything), else they move up to where it now sits, or the top of their list.
 * Returns only the pages that move, with where each was, so the move can be undone.
 */
export function afterKindChange(page: Entity, entities: Entity[]) {
  const byId = new Map(entities.map((x) => [x.id, x]))
  byId.set(page.id, page)
  const moves: { id: string; from?: string; to?: string }[] = []
  let home = page.parentId
  const parent = home ? byId.get(home) : undefined
  if (parent && !canHold(parent, page)) {
    home = newHome(page, parent.parentId, byId, page.id)
    moves.push({ id: page.id, from: page.parentId, to: home })
  }
  for (const x of entities)
    if (x.parentId === page.id && x.id !== page.id && !canHold(page, x)) moves.push({ id: x.id, from: page.id, to: newHome(x, home, byId, page.id) })
  return moves
}

/** Whether a list of one kind has any page sitting under another in the same list. */
export const hasNesting = (entities: Pick<Entity, 'id' | 'parentId'>[]) => {
  const ids = new Set(entities.map((e) => e.id))
  return entities.some((e) => !!e.parentId && e.parentId !== e.id && ids.has(e.parentId))
}
