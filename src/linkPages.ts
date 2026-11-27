import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EntityType } from './db'

/**
 * What the text boxes and the formatted editor share when suggesting things to the GM: pages to
 * link to as "@" or "[[" is typed, and player characters' short names for a ":::for" passage.
 */

export const GM_PLACEHOLDER = 'Only you can read this. Players never see it.'

/** A page a [[link]] can point at. */
export interface LinkPage {
  id: string
  name: string
  type: EntityType
  aliases: string[]
  gm: boolean
}

/** The world's pages, by name, for link suggestions (and its player characters, for ":::for"). */
export function useLinkPages(worldId: string): LinkPage[] {
  return (
    useLiveQuery(
      async () =>
        (await db.entities.where({ worldId }).filter((e) => !e.template).sortBy('name')).map((e) => ({ id: e.id, name: e.name, type: e.type, aliases: e.aliases ?? [], gm: e.visibility === 'gm' })),
      [worldId],
    ) ?? []
  )
}

/** The pages a typed "@Bro" or "[[Bro" could mean, best first, each with the name to link it by. */
export function findLinkPages(pages: LinkPage[], query: string) {
  return pages
    .map((p) => {
      const names = [p.name, ...p.aliases].map((n) => n.toLowerCase())
      const score = names.some((n) => n.startsWith(query)) ? 0 : names.some((n) => n.split(/[\s'’-]+/).some((w) => w.startsWith(query))) ? 1 : names.some((n) => n.includes(query)) ? 2 : -1
      return { p, score }
    })
    .filter((h) => h.score >= 0)
    .sort((a, b) => a.score - b.score || a.p.name.length - b.p.name.length)
    .slice(0, 8)
    .map(({ p }) => {
      // Found by a nickname of a GM-only page: link by that nickname, so the real name stays out of the text.
      const alias = p.name.toLowerCase().includes(query) ? undefined : p.aliases.find((a) => a.toLowerCase().includes(query))
      return { ...p, alias, link: p.gm && alias ? alias : p.name }
    })
}

/** Short names for player characters in a ":::for" line: first names ("Wren") unless two share one. */
export function shortNames(pcs: { name: string }[]): string[] {
  const firsts = pcs.map((p) => p.name.trim().split(/\s+/)[0])
  return pcs.map((p, i) => (firsts.filter((f) => f.toLowerCase() === firsts[i].toLowerCase()).length > 1 ? p.name.trim() : firsts[i]))
}
