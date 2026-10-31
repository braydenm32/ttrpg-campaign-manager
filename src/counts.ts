import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CheckItem, type Clock, type Entity, type SessionPrep, type Showing, type World, type WorldMap } from './db'
import { useViewMode } from './viewMode'
import { tidyPurse } from './purse'

/**
 * One calculation for each thing the app counts, so two screens can never disagree about it. A
 * screen passes in the pages the viewer can see (useVisibleEntities), so a player's numbers never
 * include anything GM-only.
 */

/** A loose thread still open: dangling or in play. A thread with no status yet counts as dangling. */
export const isOpenThread = (e: Entity) => e.type === 'thread' && ((e.threadStatus ?? 'open') === 'open' || e.threadStatus === 'active')

/** A quest still to do: open or under way. A quest with no status yet counts as open. */
export const isOpenQuest = (e: Entity) => e.type === 'quest' && ((e.questStatus ?? 'open') === 'open' || e.questStatus === 'active')

export const isActiveQuest = (e: Entity) => e.type === 'quest' && e.questStatus === 'active'

const URGENCY_RANK = { high: 0, normal: 1, low: 2 }

/** Open threads, most pressing first, then the most recently touched. */
export const openThreads = (entities: Entity[]) =>
  entities
    .filter(isOpenThread)
    .sort((a, b) => URGENCY_RANK[a.threadUrgency ?? 'normal'] - URGENCY_RANK[b.threadUrgency ?? 'normal'] || b.updatedAt - a.updatedAt)

/** A lead the party is working on now: a quest under way or a thread in play. */
export const isActiveLead = (e: Entity) => isActiveQuest(e) || (e.type === 'thread' && e.threadStatus === 'active')

/**
 * A player's leads: the open quests and open threads they can see, the ones under way first, then
 * the pressing ones. The sidebar badge, the Common Room and the Leads page all list these.
 */
export const openLeads = (entities: Entity[]) => {
  const all = [...entities.filter(isOpenQuest), ...openThreads(entities)]
  const rank = (e: Entity) => (isActiveLead(e) ? 0 : e.threadUrgency === 'high' ? 1 : 2)
  return all.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map(({ e }) => e)
}

/** Leads the party has finished with: quests done or failed, threads tied off. (Dropped threads are left out.) */
export const closedLeads = (entities: Entity[]) =>
  entities.filter((e) => (e.type === 'quest' && (e.questStatus === 'done' || e.questStatus === 'failed')) || (e.type === 'thread' && e.threadStatus === 'resolved'))

/** A clock's number of slices (a clock always has at least one). */
export const clockSize = (c: Clock) => Math.max(1, c.segments)

/** A clock that hasn't run out yet. */
export const isTicking = (c: Clock) => c.filled < clockSize(c)

/** Every clock on the given pages, with the page it belongs to. */
export const allClocks = (entities: Entity[]) => entities.flatMap((e) => (e.clocks ?? []).map((clock) => ({ clock, owner: e })))

export const tickingClocks = (entities: Entity[]) => allClocks(entities).filter(({ clock }) => isTicking(clock))

/** "×3" beside an item, or nothing for a single one. "×0" when the last one is used up. */
export const quantityLabel = (item: Pick<Entity, 'quantity'>) => (item.quantity != null && item.quantity !== 1 ? `×${item.quantity}` : '')

/**
 * The party's loot: the purse (coins with something in them, one line per kind of coin), the party
 * stash, and what each player character carries. Things carried by anyone else (an NPC, a shop, a
 * place) aren't the party's: the GM gets them in `elsewhere`, along with items nobody carries.
 */
export function partyLoot(entities: Entity[], world: Pick<World, 'partyCoin'> | null | undefined) {
  const coin = tidyPurse(world?.partyCoin)
  const byId = new Map(entities.map((e) => [e.id, e]))
  const items = entities.filter((e) => e.type === 'item')
  const carried = items.filter((e) => e.heldBy)
  // An item whose carrier is gone goes in the stash rather than vanishing.
  const stash = carried.filter((i) => i.heldBy === 'party' || !byId.has(i.heldBy!))
  const members = entities.filter((e) => e.type === 'pc').map((pc) => ({ holder: pc, items: carried.filter((i) => i.heldBy === pc.id) }))
  const mine = new Set([...stash, ...members.flatMap((m) => m.items)])
  return {
    coin: coin.filter((c) => c.amount),
    stash,
    members,
    /** Everything the party has: the stash first, then what each character carries. */
    items: [...mine],
    elsewhere: carried.filter((i) => !mine.has(i)),
    loose: items.filter((i) => !i.heldBy),
    /** Whether the party has anything at all, for showing the loot link. */
    any: mine.size > 0 || coin.some((c) => c.amount),
  }
}

/** Which codex section a page is listed in: its type, "custom:<id>" for a custom type, or "other" for a custom page whose type is unset or was removed. */
export function codexKey(e: Pick<Entity, 'type' | 'customType'>, world: Pick<World, 'customTypes'> | null | undefined) {
  if (e.type !== 'custom') return e.type
  return world?.customTypes?.some((c) => c.id === e.customType) ? `custom:${e.customType}` : 'other'
}

/** The pages in one codex section (see codexKey). */
export const pagesIn = (entities: Entity[], world: Pick<World, 'customTypes'> | null | undefined, key: string) =>
  entities.filter((e) => codexKey(e, world) === key)

/** How many pages each codex section has, keyed as codexKey. Every page is counted in exactly one section. */
export function countByType(entities: Entity[], world: Pick<World, 'customTypes'> | null | undefined) {
  const counts = new Map<string, number>()
  for (const e of entities) {
    const k = codexKey(e, world)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}

/**
 * Whether a map reaches the viewer. Players get a map once it's revealed, and a fogged one only
 * once its fogged picture exists (as public.player_view sends them).
 */
export const canSeeMap = (m: WorldMap, isGM: boolean) => isGM || (m.visibility === 'players' && (!m.fog?.on || !!m.fog.imageId))

/** The world's maps the viewer can see, by name. */
export function useVisibleMaps(worldId: string) {
  const { isGM } = useViewMode()
  return useLiveQuery(() => db.maps.where({ worldId }).filter((m) => canSeeMap(m, isGM)).sortBy('name'), [worldId, isGM]) ?? []
}

/**
 * The handouts a viewer gets, as public.player_view sends them: text always, a page only when the
 * viewer can see that page, a picture unless it's a map's clean picture (one with fog or secrets on
 * it). `entities` are the pages the viewer can see.
 */
export function visibleHandouts(world: Pick<World, 'handouts'> | null | undefined, entities: Entity[], isGM: boolean, maps: WorldMap[] = []): Showing[] {
  const list = world?.handouts ?? []
  if (isGM) return list
  const hiddenImages = new Set(
    maps.flatMap((m) => [
      ...(m.fog?.on || m.playerImageId ? [m.imageId] : []),
      ...(m.fog?.on && m.playerImageId ? [m.playerImageId] : []),
    ]),
  )
  const seen = new Set(entities.map((e) => e.id))
  return list.filter((h) => h.kind === 'text' || (h.kind === 'page' && !!h.entityId && seen.has(h.entityId)) || (h.kind === 'image' && !!h.assetId && !hiddenImages.has(h.assetId)))
}

/** visibleHandouts for the current viewer. */
export function useVisibleHandouts(world: World | null | undefined, entities: Entity[]) {
  const { isGM } = useViewMode()
  const worldId = world?.id ?? ''
  const maps = useLiveQuery(() => (isGM ? [] : db.maps.where({ worldId }).toArray()), [worldId, isGM]) ?? []
  return visibleHandouts(world, entities, isGM, maps)
}

/** Scenes played and clues found out of those planned. Lines left empty aren't counted. */
export function prepCounts(prep: Partial<SessionPrep> | undefined) {
  const tally = (list: CheckItem[] = []) => {
    const real = list.filter((x) => x.text.trim())
    const done = real.filter((x) => x.done).length
    return { done, total: real.length, left: real.length - done }
  }
  return { scenes: tally(prep?.scenes), clues: tally(prep?.clues) }
}

/** A player's question or downtime action still waiting on the GM's answer. */
export const needsAnswer = (x: { answer?: string | null }) => !x.answer

/** Whether the table has any safety tools set up (lines, veils, notes or the X-card): players see Table rules only then. */
export const hasSafety = (world: Pick<World, 'safety'> | null | undefined) =>
  !!world?.safety && (!!world.safety.lines.length || !!world.safety.veils.length || !!world.safety.notes.trim() || !!world.safety.xcard)
